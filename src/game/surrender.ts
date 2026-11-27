// 11-26 대장 결정: "속국 항복".
// - 크게 진 나라는 이긴 나라에 항복해 속국이 됨: 전쟁이 끝나고 연합으로 묶이며, 나라 예산의 30%를 공물로 바침.
//   속국은 연합이라 주인 나라 전쟁에 함께 끌려 나오고, 연합 승리 계산에도 들어감.
// - AI끼리는 저절로 항복. 내 나라에 지는 AI는 항복을 "제안"해 오고(12시간 안에 받기), 내가 "항복 요구"를 할 수도 있음.
// - 내 나라도 전쟁 중인 나라에 항복할 수 있음(판이 끝나지 않음). 속국은 '연합 깨기'를 못 하고 '독립 전쟁'(선전포고)으로만 벗어남.
// - AI 속국은 힘이 붙으면 독립 전쟁을 일으킴. 주인 나라가 망하면 저절로 풀려남.
import { CITIES } from '../data/cities';
import { PERSONALITIES } from '../data/leaders';
import { countryById } from '../data/world';
import { aiStrength } from './balance';
import { Rng } from './rng';
import type { GameState } from './state';
import { declareWar, eul, ga, isAlive, isLosing, pairKey, relationOf, type WorldState } from './world';

const H = 3600e3;

export interface VassalState {
  /** 속국 → 주인 나라 */
  lord: Record<string, string>;
  /** 속국이 된 시각 */
  since: Record<string, number>;
  /** 내 나라에 들어온 AI 항복 제안(나라 → 마감 시각) */
  offers: Record<string, number>;
  /** 항복 요구를 다시 할 수 있는 시각(11-27부터 안 씀) */
  demandReadyMs?: number;
  /** 11-27 나라마다 항복 요구를 거절한 횟수(전쟁이 끝나면 지움) */
  refused?: Record<string, number>;
}

/** 속국이 바치는 공물(나라 예산 몫) */
export const TRIBUTE = 0.3;
/** AI가 질 때 판단마다 항복할 확률(× 평화 성향) */
export const SURRENDER_CHANCE = 0.03;
/** 항복 제안이 열려 있는 시간(11-27: 전쟁이 이어지는 동안은 사라지지 않게 아주 길게) · 항복 요구 대기(11-27 대장 요청: 없앰) */
export const OFFER_HOURS = 24 * 365;
export const DEMAND_COOLDOWN_HOURS = 0;
/** 11-27 대기 대신: 거절당할 때마다 다음 성공 확률이 조금씩 줄어듦(최대 STUBBORN_MAX). 전쟁이 끝나면 처음부터 */
export const STUBBORN_STEP = 0.04;
export const STUBBORN_MAX = 0.2;
/** AI 속국이 독립 전쟁을 일으킬 확률(속국 병력이 주인의 80%를 넘을 때) · 속국이 된 뒤 최소 시간 */
export const REVOLT_CHANCE = 0.004;
export const REVOLT_MIN_HOURS = 48;

export function vassalOf(s: Pick<GameState, 'vassal'>): VassalState {
  return s.vassal ?? { lord: {}, since: {}, offers: {} };
}
/** 그 나라의 주인 나라(속국이 아니면 null) */
export const lordOf = (s: Pick<GameState, 'vassal'>, id: string): string | null => vassalOf(s).lord[id] ?? null;
/** 둘이 주인-속국 사이인가 */
export const isVassalPair = (s: Pick<GameState, 'vassal'>, a: string, b: string) => lordOf(s, a) === b || lordOf(s, b) === a;
export const vassalsOf = (s: Pick<GameState, 'vassal'>, lord: string) => Object.entries(vassalOf(s).lord).filter(([, l]) => l === lord).map(([v]) => v);

/** 나라 예산 배율: 속국은 공물만큼 줄고, 주인은 속국 공물만큼 늚 */
export function vassalMult(s: GameState, id: string): number {
  const me = s.player.countryId;
  const base = (x: string) => countryById(x).budget * aiStrength(x, me);
  let m = lordOf(s, id) ? 1 - TRIBUTE : 1;
  for (const v of vassalsOf(s, id)) m += (TRIBUTE * base(v)) / Math.max(1, base(id));
  return m;
}

const nm = (id: string) => countryById(id).name;

function event(w: WorldState, t: number, text: string, mine: boolean) {
  w.events.unshift({ t, kind: '외교', text, mine });
  if (w.events.length > 150) w.events.length = 150;
}

/** v가 lord에 항복: 둘 사이 전쟁 끝·연합, lord 편(연합국)과의 전쟁도 휴전. w·vs를 바꿈 */
function makeVassal(w: WorldState, vs: VassalState, v: string, lord: string, t: number, player: string) {
  // v가 거느리던 속국은 풀려남
  for (const [x, l] of Object.entries(vs.lord)) if (l === v) delete vs.lord[x];
  vs.lord[v] = lord;
  vs.since[v] = t;
  delete vs.offers[v];
  const p = w.pairs[pairKey(v, lord)];
  p.rel = '연합';
  p.tension = 0;
  p.weariness = 0;
  for (const [key, q] of Object.entries(w.pairs)) {
    if (q.rel !== '전쟁' || !key.split('|').includes(v)) continue;
    const other = key.split('|').find((x) => x !== v)!;
    if (relationOf(w, other, lord) === '연합') {
      q.rel = '휴전';
      q.tension = 20;
      q.weariness = 0;
    }
  }
  event(w, t, `🏳️ ${ga(nm(v))} ${nm(lord)}에 항복해 속국이 됐어요. 나라 예산 ${Math.round(TRIBUTE * 100)}%를 공물로 바쳐요.`, v === player || lord === player);
}

function cloneW(s: GameState): WorldState {
  return { ...s.world, pairs: Object.fromEntries(Object.entries(s.world.pairs).map(([k, p]) => [k, { ...p }])), events: [...s.world.events] };
}
function cloneV(s: GameState): VassalState {
  const v = vassalOf(s);
  return { lord: { ...v.lord }, since: { ...v.since }, offers: { ...v.offers }, demandReadyMs: v.demandReadyMs, refused: { ...(v.refused ?? {}) } };
}

/** AI 판단마다: AI 항복·내 나라에 항복 제안·속국 독립 전쟁·주인이 망하면 풀림 */
export function surrenderTick(s: GameState): GameState {
  const me = s.player.countryId;
  const t = s.worldMs;
  const rng = new Rng((Math.floor(t / 60e3) * 2654435761 + s.world.seed * 7 + 91) >>> 0);
  const w = cloneW(s);
  const vs = cloneV(s);
  const troops = (id: string) => s.nations[id]?.troops ?? 0;

  // 주인이 망했거나 속국이 망하면 풀림 · 지난 제안은 지움
  for (const [v, l] of Object.entries(vs.lord)) {
    if (!isAlive(w, v) || !isAlive(w, l)) {
      delete vs.lord[v];
      if (isAlive(w, v)) event(w, t, `🗽 ${nm(l)}이(가) 무너져 ${ga(nm(v))} 속국에서 풀려났어요.`, v === me || l === me);
    } else if (w.pairs[pairKey(v, l)].rel !== '연합') delete vs.lord[v]; // 독립 전쟁 등으로 관계가 바뀜
  }
  for (const [id, until] of Object.entries(vs.offers)) if (until <= t || relationOf(w, id, me) !== '전쟁') delete vs.offers[id];
  for (const id of Object.keys(vs.refused ?? {})) if (relationOf(w, id, me) !== '전쟁') delete vs.refused![id];

  // 지는 나라의 항복
  for (const [key, p] of Object.entries(w.pairs)) {
    if (p.rel !== '전쟁') continue;
    const [a, b] = key.split('|');
    if (!isAlive(w, a) || !isAlive(w, b)) continue;
    for (const [loser, winner] of [
      [a, b],
      [b, a],
    ]) {
      if (loser === me || vs.lord[loser] || !isLosing(w, loser) || troops(loser) > troops(winner) * 0.8) continue;
      if (!rng.chance(SURRENDER_CHANCE * PERSONALITIES[w.personalities[loser]].peace)) continue;
      if (winner === me) {
        if (!vs.offers[loser]) {
          vs.offers[loser] = t + OFFER_HOURS * H;
          event(w, t, `🏳️ ${ga(nm(loser))} 우리에게 항복하겠다고 해요! 외교 → 나라 창에서 언제든 받아 주세요.`, true);
        }
      } else makeVassal(w, vs, loser, winner, t, me);
      break;
    }
  }

  // AI 속국의 독립 전쟁
  for (const [v, l] of Object.entries(vs.lord)) {
    if (v === me || t - (vs.since[v] ?? 0) < REVOLT_MIN_HOURS * H) continue;
    if (troops(v) < troops(l) * 0.8) continue;
    if (!rng.chance(REVOLT_CHANCE * PERSONALITIES[w.personalities[v]].aggression)) continue;
    delete vs.lord[v];
    const p = w.pairs[pairKey(v, l)];
    p.rel = '중립';
    declareWar(w, t, me, v, l, '속국에서 벗어나려는 독립 전쟁');
  }

  return { ...s, world: w, vassal: vs };
}

// ── 내 나라가 하는 일 ──

/** 항복 요구 성공 확률: 상대가 지고 있을수록, 우리가 빼앗은 도시가 많을수록, 오래 싸울수록 */
export function demandChance(s: GameState, id: string): number {
  const me = s.player.countryId;
  const w = s.world;
  const p = w.pairs[pairKey(me, id)];
  const took = CITIES.filter((c) => c.front && c.home === id && w.owner[c.id] === me).length;
  const stronger = (s.nations[me]?.troops ?? 0) > (s.nations[id]?.troops ?? 0) ? 0.1 : -0.1;
  const stubborn = Math.min(STUBBORN_MAX, (vassalOf(s).refused?.[id] ?? 0) * STUBBORN_STEP);
  return Math.max(0.02, Math.min(0.9, 0.03 + (isLosing(w, id) ? 0.35 : 0) + took * 0.08 + (p?.weariness ?? 0) / 400 + stronger - stubborn));
}
export function canDemand(s: GameState, id: string): string | null {
  const me = s.player.countryId;
  if (id === me || !isAlive(s.world, id)) return '할 수 없는 나라';
  if (relationOf(s.world, me, id) !== '전쟁') return '전쟁 중일 때만';
  if (lordOf(s, me)) return '속국은 항복을 요구할 수 없어요';
  if (lordOf(s, id)) return '이미 다른 나라의 속국이에요';
  return null;
}
function finish(s: GameState, w: WorldState, vs: VassalState): GameState {
  return { ...s, world: w, vassal: vs };
}
/** 항복 요구(11-27: 대기 없이 바로 다시. 거절당할수록 다음 확률이 조금 줄어듦) */
export function doDemand(s: GameState, id: string): { state: GameState; text: string } {
  if (canDemand(s, id)) return { state: s, text: '' };
  const me = s.player.countryId;
  const tries = vassalOf(s).refused?.[id] ?? 0;
  const ok = new Rng((s.world.seed ^ Math.floor(s.worldMs / 1000) ^ 0x5a5a ^ (tries * 2654435761)) >>> 0).chance(demandChance(s, id));
  const w = cloneW(s);
  const vs = cloneV(s);
  vs.demandReadyMs = undefined;
  if (ok) {
    makeVassal(w, vs, id, me, s.worldMs, me);
    return { state: finish(s, w, vs), text: `${ga(nm(id))} 항복했어요! 이제 우리 속국이에요. 공물 ${Math.round(TRIBUTE * 100)}%를 받고, 연합 승리 계산에도 들어가요.` };
  }
  vs.refused = { ...(vs.refused ?? {}), [id]: tries + 1 };
  const text = `${ga(nm(id))} 항복 요구를 거절했어요. 바로 다시 요구할 수 있지만, 거절할수록 버티는 마음이 굳어져요(다음 성공 ${Math.round(demandChance({ ...s, vassal: vs }, id) * 100)}%).`;
  event(w, s.worldMs, `📜 ${text}`, true);
  return { state: finish(s, w, vs), text };
}
/** AI가 해 온 항복 제안 받기 */
export function canAccept(s: GameState, id: string): string | null {
  const until = vassalOf(s).offers[id];
  if (!until || until <= s.worldMs) return '항복 제안이 없어요';
  if (relationOf(s.world, s.player.countryId, id) !== '전쟁') return '전쟁 중일 때만';
  return null;
}
export function acceptSurrender(s: GameState, id: string): { state: GameState; text: string } {
  if (canAccept(s, id)) return { state: s, text: '' };
  const w = cloneW(s);
  const vs = cloneV(s);
  makeVassal(w, vs, id, s.player.countryId, s.worldMs, s.player.countryId);
  return { state: finish(s, w, vs), text: `${eul(nm(id))} 속국으로 받아들였어요. 공물 ${Math.round(TRIBUTE * 100)}%를 받아요.` };
}
/** 내 나라가 항복(판은 끝나지 않음. 나중에 독립 전쟁으로 벗어남) */
export function canSurrender(s: GameState, id: string): string | null {
  const me = s.player.countryId;
  if (id === me || !isAlive(s.world, id)) return '할 수 없는 나라';
  if (relationOf(s.world, me, id) !== '전쟁') return '전쟁 중일 때만';
  if (lordOf(s, me)) return '이미 속국이에요';
  return null;
}
export function doSurrender(s: GameState, id: string): { state: GameState; text: string } {
  if (canSurrender(s, id)) return { state: s, text: '' };
  const me = s.player.countryId;
  const w = cloneW(s);
  const vs = cloneV(s);
  makeVassal(w, vs, me, id, s.worldMs, me);
  const officer = { ...s.officer, trust: Math.max(0, s.officer.trust - 10), fame: Math.max(0, s.officer.fame - 20) };
  return {
    state: { ...finish(s, w, vs), officer },
    text: `${nm(id)}에 항복했어요. 전쟁은 끝났지만 나라 예산 ${Math.round(TRIBUTE * 100)}%를 공물로 바쳐요(신뢰 −10 · 명성 −20). 힘을 기르면 선전포고로 독립 전쟁을 할 수 있어요.`,
  };
}
/** 주인-속국 사이에 선전포고하면(독립 전쟁·속국 치기) 속국 관계가 끝남 */
export function endVassalPair(s: GameState, a: string, b: string): GameState {
  if (!isVassalPair(s, a, b)) return s;
  const vs = cloneV(s);
  if (vs.lord[a] === b) delete vs.lord[a];
  if (vs.lord[b] === a) delete vs.lord[b];
  return { ...s, vassal: vs };
}
