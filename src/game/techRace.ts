// 11-28 대장 결정 "중-6 기술 경주": 초지능 AI · 우주 정거장 · 핵융합 · 초음속 여객기를 세계에서 먼저 완성한 나라만 큰 보너스.
//  · 3장부터. 우리는 나라 예산을 부어 하루 3번 밀어붙임(+6), AI는 경제·기술 성장만큼 스스로 나아감
//  · 첩보로 1등 나라의 연구를 훔칠 수 있음(55%, 실패하면 호감 −10 · 긴장 +12), 12시간에 한 번
//  · 먼저 끝낸 나라: 영구 보너스 + 세계 영향력 +25
import { COUNTRIES, countryById } from '../data/world';
import { addFavorNote } from './civ';
import { registerDomRows } from './domestic';
import { goalsOf } from './goals';
import type { LawKey } from './laws';
import { pushReport } from './report';
import { Rng } from './rng';
import { priceBase, type GameState } from './state';
import { isAlive, pairKey } from './world';

const H = 3600e3;
const DAY = 24 * H;
export const RACE_ACT = 3;
export const RACE_NEED = 150;
export const RACE_PUSH = 6;
export const RACE_PUSH_DAY = 3;
export const RACE_PUSH_COST = 0.6;
export const RACE_STEAL_WAIT = 12 * H;
export const RACE_STEAL_CHANCE = 0.55;
export const RACE_STEAL_PTS = 12;
export const RACE_INF = 25;
export const RACE_RUBY = 30;

export type RaceId = 'ai' | 'space' | 'fusion' | 'hyper';
export const RACES: Array<{ id: RaceId; icon: string; name: string; prize: string; key: LawKey; v: number }> = [
  { id: 'ai', icon: '🤖', name: '초지능 AI', prize: '연구 속도 +12%', key: 'research', v: 0.12 },
  { id: 'space', icon: '🛰️', name: '우주 정거장', prize: '안보 +6', key: 'defense', v: 6 },
  { id: 'fusion', icon: '⚛️', name: '핵융합 발전', prize: '자원 +10%', key: 'res', v: 0.1 },
  { id: 'hyper', icon: '✈️', name: '초음속 여객기', prize: '나라 예산 +5%', key: 'budget', v: 0.05 },
];
export interface RaceState { pts: Record<RaceId, Record<string, number>>; winner: Partial<Record<RaceId, string>>; lastMs: number; push: { day: string; n: number }; stealMs: number; seed: number }
export const raceOn = (s: GameState) => (s.world.act ?? RACE_ACT) >= RACE_ACT;
export function raceOf(s: GameState): RaceState {
  return s.race ?? { pts: { ai: {}, space: {}, fusion: {}, hyper: {} }, winner: {}, lastMs: s.worldMs, push: { day: '', n: 0 }, stealMs: 0, seed: (s.world.seed ^ 0x27d4eb2f) >>> 0 };
}
const dayKey = (ms: number) => String(Math.floor(ms / DAY));
export const pushCost = (s: GameState) => Math.max(100, Math.round(priceBase(s) * RACE_PUSH_COST));

/** 경주마다 1등(점수 · 나라) */
export function raceTop(s: GameState, id: RaceId): Array<{ id: string; v: number }> {
  return Object.entries(raceOf(s).pts[id] ?? {})
    .filter(([c]) => isAlive(s.world, c))
    .map(([c, v]) => ({ id: c, v }))
    .sort((a, b) => b.v - a.v);
}

export function canPush(s: GameState, id: RaceId): string | null {
  if (!raceOn(s)) return `기술 경주는 ${RACE_ACT}장부터 열려요`;
  const r = raceOf(s);
  if (r.winner[id]) return '이미 끝난 경주예요';
  const n = r.push.day === dayKey(s.worldMs) ? r.push.n : 0;
  if (n >= RACE_PUSH_DAY) return `하루 ${RACE_PUSH_DAY}번까지 밀어붙일 수 있어요`;
  if (s.nations[s.player.countryId].treasury < pushCost(s)) return '나라 예산이 모자라요';
  return null;
}
/** 연구 밀어붙이기(완성 판정은 tick에서) */
export function pushRace(s: GameState, id: RaceId): { state: GameState; text: string } {
  const why = canPush(s, id);
  if (why) return { state: s, text: why };
  const me = s.player.countryId;
  const r = raceOf(s);
  const day = dayKey(s.worldMs);
  const n = r.push.day === day ? r.push.n : 0;
  const add = RACE_PUSH * (1 + Math.min(0.5, (s.civ?.done.length ?? 0) / 140));
  const pts = { ...r.pts, [id]: { ...r.pts[id], [me]: (r.pts[id][me] ?? 0) + add } };
  const cost = pushCost(s);
  const ns: GameState = { ...s, race: { ...r, pts, push: { day, n: n + 1 } }, nations: { ...s.nations, [me]: { ...s.nations[me], treasury: s.nations[me].treasury - cost } } };
  const d = RACES.find((x) => x.id === id)!;
  return { state: raceTick(ns, true), text: `${d.icon} ${d.name} 연구 +${add.toFixed(1)} (나라 예산 −${cost.toLocaleString('ko-KR')})` };
}

export function canSteal(s: GameState, id: RaceId): string | null {
  if (!raceOn(s)) return `기술 경주는 ${RACE_ACT}장부터 열려요`;
  const r = raceOf(s);
  if (r.winner[id]) return '이미 끝난 경주예요';
  const top = raceTop(s, id).find((x) => x.id !== s.player.countryId);
  if (!top || top.v < RACE_STEAL_PTS) return '훔칠 만한 연구가 없어요';
  if (s.worldMs < r.stealMs) return '첩보는 12시간에 한 번이에요';
  return null;
}
export function stealRace(s: GameState, id: RaceId): { state: GameState; text: string } {
  const why = canSteal(s, id);
  if (why) return { state: s, text: why };
  const me = s.player.countryId;
  const r = raceOf(s);
  const rng = new Rng(r.seed);
  const top = raceTop(s, id).find((x) => x.id !== me)!;
  const d = RACES.find((x) => x.id === id)!;
  const nm = countryById(top.id).name;
  const race: RaceState = { ...r, stealMs: s.worldMs + RACE_STEAL_WAIT };
  let ns: GameState;
  let text: string;
  if (rng.chance(RACE_STEAL_CHANCE)) {
    race.pts = { ...r.pts, [id]: { ...r.pts[id], [top.id]: top.v - RACE_STEAL_PTS, [me]: (r.pts[id][me] ?? 0) + RACE_STEAL_PTS * 0.7 } };
    ns = { ...s, race };
    text = `🕵️ ${nm}의 ${d.name} 연구를 훔쳤어요! 상대 −${RACE_STEAL_PTS} · 우리 +${(RACE_STEAL_PTS * 0.7).toFixed(1)}`;
  } else {
    ns = addFavorNote({ ...s, race }, top.id, '🕵️ 기술을 훔치려다 들킴', -10);
    const pk = pairKey(me, top.id);
    const pr = ns.world.pairs[pk];
    if (pr && pr.rel !== '전쟁') ns = { ...ns, world: { ...ns.world, pairs: { ...ns.world.pairs, [pk]: { ...pr, tension: Math.min(95, pr.tension + 12) } } } };
    text = `🚨 ${nm}의 ${d.name} 연구를 훔치려다 들켰어요. 호감 −10 · 긴장 +12`;
  }
  race.seed = rng.seed;
  return { state: { ...ns, race: { ...race, seed: rng.seed } }, text };
}

/** 내가 이긴 경주 수 · 나라가 이긴 경주 수 */
export const raceWins = (s: GameState, id: string) => RACES.filter((d) => s.race?.winner[d.id] === id).length;
export const raceInfluence = (s: GameState, id: string) => raceWins(s, id) * RACE_INF;

/** 세계 판단마다: AI가 나아가고, 먼저 닿은 나라가 이김 */
export function raceTick(s: GameState, only = false): GameState {
  if (s.ending || !raceOn(s)) return s;
  const me = s.player.countryId;
  const r0 = raceOf(s);
  const h = only ? 0 : Math.min(48, (s.worldMs - r0.lastMs) / H);
  if (!only && h < 1 && s.race) return s;
  const rng = new Rng(r0.seed);
  const pts = { ...r0.pts };
  const winner = { ...r0.winner };
  let ns = s;
  for (const d of RACES) {
    if (winner[d.id]) continue;
    const row = { ...pts[d.id] };
    if (h > 0)
      for (const c of COUNTRIES) {
        if (c.id === me || !isAlive(s.world, c.id) || c.economy < 45) continue;
        const tech = s.world.grow?.[c.id]?.lv.tech ?? 0;
        row[c.id] = (row[c.id] ?? 0) + (c.economy / 100) * 0.2 * (1 + tech * 0.04) * rng.range(0.5, 1.5) * h;
      }
    pts[d.id] = row;
    const best = Object.entries(row).filter(([c]) => isAlive(s.world, c)).sort((a, b) => b[1] - a[1])[0];
    if (best && best[1] >= RACE_NEED) {
      winner[d.id] = best[0];
      const mine = best[0] === me;
      const text = mine
        ? `${d.icon} 세계 최초! 우리가 ${d.name}을(를) 먼저 완성했어요. ${d.prize}(영구) · 세계 영향력 +${RACE_INF} · 💎 +${RACE_RUBY}`
        : `${d.icon} ${countryById(best[0]).name}이(가) ${d.name}을(를) 세계에서 먼저 완성했어요. 이 경주는 끝났어요.`;
      if (mine) {
        const g = goalsOf(ns);
        ns = { ...ns, goals: { ...g, ruby: g.ruby + RACE_RUBY } };
      }
      ns = { ...ns, world: { ...ns.world, events: [{ t: s.worldMs, kind: '성장' as const, text, mine }, ...ns.world.events].slice(0, 200) } };
      ns = pushReport(ns, { icon: d.icon, text });
    }
  }
  return { ...ns, race: { ...r0, pts, winner, lastMs: only ? r0.lastMs : s.worldMs, seed: rng.seed } };
}

registerDomRows((s, key) => {
  if (!s.race) return [];
  const me = s.player.countryId;
  return RACES.filter((d) => d.key === key && s.race!.winner[d.id] === me).map((d): [string, number] => [`${d.icon} ${d.name} 세계 최초`, d.v]);
});
