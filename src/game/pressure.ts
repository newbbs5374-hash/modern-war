// 11-26 난이도 올리기(대장 요청 2번): AI 나라가 스스로 압박해 옴.
// - 관세: 나라끼리 관세를 매기고(미국이 가장 자주·가장 세게), 맞은 나라는 국방예산이 줄어듦. 내 나라도 매기거나 협상할 수 있음
// - 분쟁 지역 전쟁: 자기가 다투는 섬을 남이 쥐고 있으면 긴장이 쌓이다 선전포고
// - 자원 전쟁: 석유·희토류 같은 자원 산지를 노려 약한 이웃에 긴장을 크게 올리고, 차면 선전포고
// - 연합 배신: 연합은 언제든 깨질 수 있음(AI도 깨고, 나도 '연합 깨기'로 깸)
// AI 판단(실제 15분)마다 한 번 돌아감. 같은 상태면 결과가 늘 같음.
import { PIONEER_ISLANDS } from '../data/hexmap';
import { REAL_ISLANDS } from '../data/islands';
import { PERSONALITIES } from '../data/leaders';
import { COUNTRIES, countryById } from '../data/world';
import { aiStrength } from './balance';
import { islandLeader } from './civ';
import { Rng } from './rng';
import { isVassalPair } from './surrender';
import type { GameState } from './state';
import { declareWar, eul, ga, gwa, isAlive, isRival, pairKey, relationOf, sameBloc, type WorldState } from './world';

const H = 3600e3;

export interface Tariff {
  /** 관세를 매긴 나라 */
  from: string;
  /** 관세를 맞은 나라 */
  to: string;
  /** 관세율(0.1 = 10%) */
  rate: number;
  untilMs: number;
}
export interface PressureState {
  tariffs: Tariff[];
}

/** AI 한 나라가 판단마다 관세를 매길 확률(미국은 × 3) */
export const TARIFF_CHANCE = 0.003;
export const US_TARIFF_MULT = 3;
/** 관세가 이어지는 시간(실제 시간) */
export const TARIFF_HOURS: [number, number] = [24, 72];
/** 관세 1(100%)마다 국방예산이 깎이는 몫(매긴 나라 경제 100 기준). 모두 합쳐 최대 TARIFF_CUT_MAX */
export const TARIFF_CUT = 0.3;
export const TARIFF_CUT_MAX = 0.4;
/** 매긴 나라가 얻는 몫(맞은 나라 경제 100 기준) */
export const TARIFF_GAIN = 0.12;
/** 관세를 맞으면 오르는 긴장도 · 맞관세 확률(AI) */
export const TARIFF_TENSION = 6;
export const RETALIATE_CHANCE = 0.5;
/** 관세 협상: 관세율 × 경제 × 이 값만큼 국방예산을 내면 풀어 줌 */
export const TARIFF_DEAL_COST = 300;

/** 분쟁 지역을 남이 쥐고 있을 때 판단마다 오르는 긴장(× 공격성) */
export const ISLAND_WAR_TENSION = 1.2;
/** 자원 전쟁: 판단마다 AI 한 나라가 자원을 노릴 확률(× 공격성 × 힘) · 오르는 긴장 */
export const RES_WAR_CHANCE = 0.006;
export const RES_WAR_TENSION = 30;
/** 연합 배신: 연합 한 쌍이 판단마다 깨질 확률(× 공격성) · 깨면서 바로 칠 확률 */
export const BETRAY_CHANCE = 0.0012;
export const BETRAY_ATTACK = 0.3;

const RES_TARGETS = ['석유 유전', '천연가스전', '희토류 광산', '리튬 광산', '곡창 지대', '물길(댐)', '반도체 공장', '항구'];

export function pressureOf(s: GameState): PressureState {
  return s.pressure ?? { tariffs: [] };
}
const nm = (id: string) => countryById(id).name;
const per = (w: WorldState, id: string) => PERSONALITIES[w.personalities[id]];

/** 지금 그 나라에 걸린 관세들 */
export function tariffsOn(s: GameState, to: string): Tariff[] {
  return pressureOf(s).tariffs.filter((t) => t.to === to && t.untilMs > s.worldMs);
}
export function tariffsBy(s: GameState, from: string): Tariff[] {
  return pressureOf(s).tariffs.filter((t) => t.from === from && t.untilMs > s.worldMs);
}
export function tariffBetween(s: GameState, from: string, to: string): Tariff | undefined {
  return pressureOf(s).tariffs.find((t) => t.from === from && t.to === to && t.untilMs > s.worldMs);
}
/** 관세로 줄고(맞음) 느는(매김) 국방예산 배율 */
export function tariffMult(s: GameState, id: string): number {
  let cut = 0;
  for (const t of tariffsOn(s, id)) cut += t.rate * TARIFF_CUT * (countryById(t.from).economy / 100);
  let gain = 0;
  for (const t of tariffsBy(s, id)) gain += t.rate * TARIFF_GAIN * (countryById(t.to).economy / 100);
  return (1 - Math.min(TARIFF_CUT_MAX, cut)) * (1 + Math.min(0.3, gain));
}

function event(w: WorldState, t: number, text: string, player: string, ...who: string[]) {
  w.events.unshift({ t, kind: '외교', text, mine: who.includes(player) });
  if (w.events.length > 150) w.events.length = 150;
}

function addTension(w: WorldState, a: string, b: string, v: number): number {
  const p = w.pairs[pairKey(a, b)];
  if (!p || p.rel === '전쟁') return p?.tension ?? 0;
  p.tension = Math.min(100, p.tension + v);
  return p.tension;
}

function putTariff(list: Tariff[], t: Tariff) {
  const i = list.findIndex((x) => x.from === t.from && x.to === t.to);
  if (i >= 0) list[i] = t;
  else list.push(t);
}

/** AI 판단마다: 관세·분쟁 지역 전쟁·자원 전쟁·연합 배신 */
export function pressureTick(s: GameState): GameState {
  const me = s.player.countryId;
  const t = s.worldMs;
  const rng = new Rng((Math.floor(t / 60e3) * 2246822519 + s.world.seed * 3 + 17) >>> 0);
  const w: WorldState = { ...s.world, pairs: Object.fromEntries(Object.entries(s.world.pairs).map(([k, p]) => [k, { ...p }])), events: [...s.world.events] };
  const tariffs = pressureOf(s).tariffs.filter((x) => x.untilMs > t).map((x) => ({ ...x }));
  const alive = COUNTRIES.map((c) => c.id).filter((id) => isAlive(w, id));
  const ais = alive.filter((id) => id !== me);

  // ── 관세 ──
  for (const a of ais) {
    const k = (a === 'us' ? US_TARIFF_MULT : 1) * per(w, a).tension * aiStrength(a, me);
    if (!rng.chance(TARIFF_CHANCE * k)) continue;
    const to = rng.weighted(
      alive.filter((b) => b !== a && !tariffs.some((x) => x.from === a && x.to === b)),
      (b) => (isRival(a, b) ? 3 : sameBloc(a, b) ? 0.4 : 1) * (b === me ? 2 : 1) * (0.5 + countryById(b).economy / 50) * (relationOf(w, a, b) === '전쟁' ? 0.3 : 1),
    );
    if (!to) continue;
    const rate = Math.round((a === 'us' ? rng.range(0.25, 0.6) : rng.range(0.1, 0.35)) * 100) / 100;
    putTariff(tariffs, { from: a, to, rate, untilMs: t + rng.range(...TARIFF_HOURS) * H });
    addTension(w, a, to, TARIFF_TENSION);
    const goods = rng.pick(['자동차', '반도체', '철강', '배터리', '농산물', '조선', '가전제품', '화학제품']);
    event(w, t, `📦 ${ga(nm(a))} ${nm(to)}산 ${goods}에 관세 ${Math.round(rate * 100)}%를 매겼어요.${to === me ? ' 우리 국방예산이 줄어요.' : ''}`, me, a, to);
    // AI가 맞으면 맞관세로 맞섬
    if (to !== me && rng.chance(RETALIATE_CHANCE * per(w, to).tension)) {
      const r2 = Math.round(rate * rng.range(0.6, 1.1) * 100) / 100;
      putTariff(tariffs, { from: to, to: a, rate: r2, untilMs: t + rng.range(...TARIFF_HOURS) * H });
      addTension(w, a, to, TARIFF_TENSION);
      event(w, t, `📦 ${ga(nm(to))} 맞관세 ${Math.round(r2 * 100)}%로 ${nm(a)}에 맞섰어요.`, me, a, to);
    }
  }

  // ── 분쟁 지역 전쟁: 내가 다투는 섬을 남이 1등으로 쥐고 있으면 ──
  const ns0: GameState = { ...s, world: w };
  for (const p of PIONEER_ISLANDS) {
    const lead = islandLeader(ns0, p.id).id;
    if (!lead || !isAlive(w, lead)) continue;
    for (const side of REAL_ISLANDS[p.id]?.sides ?? []) {
      if (side === lead || side === me || !isAlive(w, side)) continue;
      const rel = relationOf(w, side, lead);
      if (rel === '전쟁' || rel === '연합') continue;
      const v = addTension(w, side, lead, ISLAND_WAR_TENSION * per(w, side).aggression * rng.range(0.5, 1.5));
      if (v >= 100) declareWar(w, t, me, side, lead, `분쟁 지역 ${REAL_ISLANDS[p.id].name}을(를) 되찾으려고`);
    }
  }

  // ── 자원 전쟁: 약한 이웃의 자원 산지를 노림 ──
  for (const a of ais) {
    if (!rng.chance(RES_WAR_CHANCE * per(w, a).aggression * aiStrength(a, me))) continue;
    const cont = countryById(a).continent;
    const targets = alive.filter((b) => {
      if (b === a || relationOf(w, a, b) === '연합' || relationOf(w, a, b) === '전쟁' || sameBloc(a, b)) return false;
      return countryById(b).continent === cont || isRival(a, b) || a === 'us';
    });
    const b = rng.weighted(targets, (x) => (s.nations[x]?.troops ?? 0) < (s.nations[a]?.troops ?? 0) ? (x === me ? 2 : 1) : 0.2);
    if (!b) continue;
    const what = rng.pick(RES_TARGETS);
    const v = addTension(w, a, b, RES_WAR_TENSION * rng.range(0.7, 1.3));
    if (v >= 100) declareWar(w, t, me, a, b, `${nm(b)}의 ${eul(what)} 차지하려고`);
    else event(w, t, `⛏️ ${ga(nm(a))} ${nm(b)}의 ${eul(what)} 노리고 있어요. 긴장 ${Math.round(v)}`, me, a, b);
  }

  // ── 연합 배신 ──
  for (const [key, p] of Object.entries(w.pairs)) {
    if (p.rel !== '연합') continue;
    const [x, y] = key.split('|');
    if (!isAlive(w, x) || !isAlive(w, y) || isVassalPair(s, x, y)) continue; // 속국은 독립 전쟁으로만(surrender.ts)
    // 깨는 쪽은 AI(둘 다 AI면 더 공격적인 쪽)
    const cands = [x, y].filter((id) => id !== me);
    if (!cands.length) continue;
    const a = cands.sort((m, n) => per(w, n).aggression - per(w, m).aggression)[0];
    const b = a === x ? y : x;
    if (!rng.chance(BETRAY_CHANCE * per(w, a).aggression * (sameBloc(a, b) ? 0.5 : 1.5))) continue;
    p.rel = '중립';
    p.tension = 40;
    p.weariness = 0;
    event(w, t, `💔 ${ga(nm(a))} ${gwa(nm(b))} 맺은 연합을 깼어요.`, me, a, b);
    if ((s.nations[a]?.troops ?? 0) > (s.nations[b]?.troops ?? 0) && rng.chance(BETRAY_ATTACK * per(w, a).aggression)) declareWar(w, t, me, a, b, '연합을 깨고 뒤통수를 침');
  }

  return { ...s, world: w, pressure: { tariffs } };
}

// ── 내 나라가 하는 일(외교 → 나라 → 요약) ──

/** 내가 매기는 관세(그 나라 경제가 클수록 많이 벌지만 긴장·호감 손해) */
export const MY_TARIFF_RATE = 0.25;
export const MY_TARIFF_HOURS = 48;

export function canTariff(s: GameState, id: string): string | null {
  const me = s.player.countryId;
  if (id === me || !isAlive(s.world, id)) return '할 수 없는 나라';
  if (tariffBetween(s, me, id)) return '이미 관세를 매겼어요';
  return null;
}
export function doTariff(s: GameState, id: string): { state: GameState; text: string } {
  if (canTariff(s, id)) return { state: s, text: '' };
  const me = s.player.countryId;
  const tariffs = pressureOf(s).tariffs.filter((x) => x.untilMs > s.worldMs).map((x) => ({ ...x }));
  const hit = !!tariffBetween(s, id, me);
  putTariff(tariffs, { from: me, to: id, rate: MY_TARIFF_RATE, untilMs: s.worldMs + MY_TARIFF_HOURS * H });
  const pairs = { ...s.world.pairs };
  const k = pairKey(me, id);
  if (pairs[k] && pairs[k].rel !== '전쟁') pairs[k] = { ...pairs[k], tension: Math.min(99, pairs[k].tension + TARIFF_TENSION * (hit ? 1 : 1.5)) };
  const text = `${countryById(me).name}, ${nm(id)}에 ${hit ? '맞관세' : '관세'} ${Math.round(MY_TARIFF_RATE * 100)}%를 매겼어요(${MY_TARIFF_HOURS}시간). 긴장이 올라요.`;
  return { state: { ...s, pressure: { tariffs }, world: { ...s.world, pairs, events: [{ t: s.worldMs, kind: '외교', text: `📦 ${text}`, mine: true }, ...s.world.events] } }, text };
}
export function dealCost(s: GameState, id: string): number {
  const t = tariffBetween(s, id, s.player.countryId);
  return t ? Math.round(t.rate * countryById(id).economy * TARIFF_DEAL_COST) : 0;
}
export function canDeal(s: GameState, id: string): string | null {
  if (!tariffBetween(s, id, s.player.countryId)) return '우리에게 매긴 관세가 없어요';
  if (s.nations[s.player.countryId].treasury < dealCost(s, id)) return `국방예산 ${dealCost(s, id).toLocaleString('ko-KR')} 필요`;
  return null;
}
/** 관세 협상: 국방예산을 내고(무기·농산물을 사 주는 조건) 관세를 풀어 받음 */
export function doDeal(s: GameState, id: string): { state: GameState; text: string } {
  if (canDeal(s, id)) return { state: s, text: '' };
  const me = s.player.countryId;
  const cost = dealCost(s, id);
  const tariffs = pressureOf(s).tariffs.filter((x) => x.untilMs > s.worldMs && !(x.from === id && x.to === me)).map((x) => ({ ...x }));
  const text = `${gwa(nm(id))} 관세 협상 타결! 국방예산 ${cost.toLocaleString('ko-KR')}을 내고 관세를 풀었어요.`;
  return {
    state: {
      ...s,
      pressure: { tariffs },
      nations: { ...s.nations, [me]: { ...s.nations[me], treasury: s.nations[me].treasury - cost } },
      world: { ...s.world, events: [{ t: s.worldMs, kind: '외교', text: `🤝 ${text}`, mine: true }, ...s.world.events] },
    },
    text,
  };
}
