// 11-28 7단계 추가 4 "벼랑끝 위기(72시간)": 쿠바 미사일 위기처럼 핵을 가진 나라와 실제 72시간 맞섬.
//  · 3장부터, 핵(ICBM)을 가진 나라와 긴장이 70을 넘으면 가끔 터짐(7일에 한 번까지)
//  · 버티기: 끝날 때 상대가 물러설 확률 = ICBM 차이 · 세계 영향력 차이 · 압박(함대·동맹 결집). 물러서면 명성 +60 · 💎 +25 · 영향력 +20
//    물러서지 않으면 판이 뒤집힘(상대가 전쟁을 선포)
//  · 물러서기: 바로 끝. 명성 −40 · 지지도 −3 · 14일 동안 영향력 −15
//  · 협상(24시간 뒤부터): 나라 예산을 내고 둘 다 한 발씩 물러섬(긴장 −25)
import { COUNTRIES, countryById } from '../data/world';
import { addPresMod } from './approval';
import { goalsOf } from './goals';
import { influenceAll } from './influence';
import { pushReport } from './report';
import { Rng } from './rng';
import { priceBase, type GameState } from './state';
import { declareWar, icbmOf, isAlive, pairKey, relationOf } from './world';

const H = 3600e3;
const DAY = 24 * H;
export const BRINK_MS = 72 * H;
export const BRINK_GAP = 7 * DAY;
export const BRINK_TENSION = 70;
export const BRINK_INF = 20;
export const BRINK_MALUS = 15;
export const PRESS_MAX = 3;

export interface BrinkOpen { foe: string; startMs: number; endMs: number; stance: 'hold' | null; press: number; pressMs: number }
export interface BrinkState { open: BrinkOpen | null; nextMs: number; wins: number; malusUntil: number; seed: number }
export const brinkOf = (s: GameState): BrinkState => s.brink ?? { open: null, nextMs: s.worldMs + 2 * DAY, wins: 0, malusUntil: 0, seed: (s.world.seed ^ 0x2545f491) >>> 0 };
export const brinkInfluence = (s: GameState) => {
  const b = s.brink;
  if (!b) return 0;
  return Math.min(60, b.wins * BRINK_INF) - (b.malusUntil > s.worldMs ? BRINK_MALUS : 0);
};
export const talkCost = (s: GameState) => Math.max(300, Math.round(priceBase(s) * 2));
export const pressCost = (s: GameState) => Math.max(150, Math.round(priceBase(s) * 0.8));

/** 상대가 물러설 확률 */
export function yieldChance(s: GameState): number {
  const o = brinkOf(s).open;
  if (!o) return 0;
  const me = s.player.countryId;
  const all = influenceAll(s);
  const d = (all[me]?.total ?? 0) - (all[o.foe]?.total ?? 0);
  return Math.max(0.1, Math.min(0.85, 0.35 + (icbmOf(s.world, me) - icbmOf(s.world, o.foe)) * 0.06 + d / 400 + o.press * 0.07));
}

export function canPress(s: GameState): string | null {
  const o = brinkOf(s).open;
  if (!o) return '벼랑끝 위기가 없어요';
  if (o.press >= PRESS_MAX) return `압박은 ${PRESS_MAX}번까지예요`;
  if (s.worldMs - o.pressMs < 6 * H) return '압박은 6시간에 한 번이에요';
  if (s.nations[s.player.countryId].treasury < pressCost(s)) return '나라 예산이 모자라요';
  return null;
}
/** 함대 배치·동맹 결집으로 압박(버티기도 함께 정함) */
export function press(s: GameState): { state: GameState; text: string } {
  const why = canPress(s);
  if (why) return { state: s, text: why };
  const b = brinkOf(s);
  const me = s.player.countryId;
  const allies = COUNTRIES.filter((c) => c.id !== me && isAlive(s.world, c.id) && relationOf(s.world, me, c.id) === '연합').length;
  const add = allies >= 2 ? 1.5 : 1;
  const open = { ...b.open!, stance: 'hold' as const, press: Math.min(PRESS_MAX + 0.5, b.open!.press + add), pressMs: s.worldMs };
  const ns: GameState = { ...s, brink: { ...b, open }, nations: { ...s.nations, [me]: { ...s.nations[me], treasury: s.nations[me].treasury - pressCost(s) } } };
  return { state: ns, text: `🚢 함대를 보내고 ${allies >= 2 ? '동맹을 모아 ' : ''}압박했어요. 상대가 물러설 확률 ${Math.round(yieldChance(ns) * 100)}%` };
}
export function hold(s: GameState): { state: GameState; text: string } {
  const b = brinkOf(s);
  if (!b.open) return { state: s, text: '벼랑끝 위기가 없어요' };
  return { state: { ...s, brink: { ...b, open: { ...b.open, stance: 'hold' } } }, text: `🧊 끝까지 버티기로 했어요. 상대가 물러설 확률 ${Math.round(yieldChance(s) * 100)}%` };
}
export function backDown(s: GameState): { state: GameState; text: string } {
  const b = brinkOf(s);
  if (!b.open) return { state: s, text: '벼랑끝 위기가 없어요' };
  const k = pairKey(s.player.countryId, b.open.foe);
  const p = s.world.pairs[k];
  let ns: GameState = { ...s, brink: { ...b, open: null, malusUntil: s.worldMs + 14 * DAY }, officer: { ...s.officer, fame: Math.max(0, s.officer.fame - 40) } };
  if (p) ns = { ...ns, world: { ...ns.world, pairs: { ...ns.world.pairs, [k]: { ...p, tension: Math.max(0, p.tension - 20) } } } };
  ns = addPresMod(ns, '🏳️ 벼랑끝에서 물러섬', -3, 48);
  const text = `🏳️ ${countryById(b.open.foe).name}과의 벼랑끝 위기에서 물러섰어요. 전쟁은 피했지만 명성 −40 · 지지도 −3 · 14일 동안 세계 영향력 −${BRINK_MALUS}`;
  return { state: pushReport(ns, { icon: '🏳️', text }), text };
}
export function canTalk(s: GameState): string | null {
  const o = brinkOf(s).open;
  if (!o) return '벼랑끝 위기가 없어요';
  if (s.worldMs - o.startMs < DAY) return '협상은 위기 24시간 뒤부터 열려요';
  if (s.nations[s.player.countryId].treasury < talkCost(s)) return '나라 예산이 모자라요';
  return null;
}
export function talk(s: GameState): { state: GameState; text: string } {
  const why = canTalk(s);
  if (why) return { state: s, text: why };
  const b = brinkOf(s);
  const me = s.player.countryId;
  const k = pairKey(me, b.open!.foe);
  const p = s.world.pairs[k];
  let ns: GameState = { ...s, brink: { ...b, open: null }, nations: { ...s.nations, [me]: { ...s.nations[me], treasury: s.nations[me].treasury - talkCost(s) } } };
  if (p) ns = { ...ns, world: { ...ns.world, pairs: { ...ns.world.pairs, [k]: { ...p, tension: Math.max(0, p.tension - 25) } } } };
  const text = `🤝 ${countryById(b.open!.foe).name}과 비밀 협상으로 둘 다 한 발씩 물러섰어요. 긴장 −25`;
  return { state: pushReport(ns, { icon: '🤝', text }), text };
}

/** 세계 판단마다 */
export function brinkTick(s: GameState): GameState {
  if (s.ending || (s.world.act ?? 3) < 3) return s;
  const me = s.player.countryId;
  const b = brinkOf(s);
  const rng = new Rng(b.seed);
  if (b.open) {
    const o = b.open;
    if (!isAlive(s.world, o.foe) || relationOf(s.world, me, o.foe) === '전쟁') return { ...s, brink: { ...b, open: null } };
    if (s.worldMs < o.endMs) return s.brink ? s : { ...s, brink: b };
    const p = yieldChance(s);
    const nm = countryById(o.foe).name;
    if (rng.chance(p)) {
      const g = goalsOf(s);
      const k = pairKey(me, o.foe);
      const pr = s.world.pairs[k];
      let ns: GameState = { ...s, brink: { ...b, open: null, wins: b.wins + 1, seed: rng.seed }, goals: { ...g, ruby: g.ruby + 25 }, officer: { ...s.officer, fame: s.officer.fame + 60 } };
      if (pr) ns = { ...ns, world: { ...ns.world, pairs: { ...ns.world.pairs, [k]: { ...pr, tension: Math.max(0, pr.tension - 30) } } } };
      return pushReport(ns, { icon: '🏆', text: `대장님, 72시간을 버텨 냈습니다! ${nm}이(가) 먼저 물러섰습니다. 명성 +60 · 💎 +25 · 세계 영향력 +${BRINK_INF}` });
    }
    const w = structuredClone(s.world);
    declareWar(w, s.worldMs, me, o.foe, me, '벼랑끝 위기에서 아무도 물러서지 않음');
    return pushReport({ ...s, world: w, brink: { ...b, open: null, seed: rng.seed } }, { icon: '💥', text: `대장님, 72시간 동안 아무도 물러서지 않았습니다. ${nm}이(가) 전쟁을 선포했습니다! (물러설 확률이 ${Math.round(p * 100)}%였습니다)` });
  }
  if (s.worldMs < b.nextMs) return s.brink ? s : { ...s, brink: b };
  const cands = COUNTRIES.filter((c) => {
    if (c.id === me || !isAlive(s.world, c.id) || icbmOf(s.world, c.id) < 1) return false;
    const r = relationOf(s.world, me, c.id);
    return r !== '전쟁' && r !== '연합' && (s.world.pairs[pairKey(me, c.id)]?.tension ?? 0) >= BRINK_TENSION;
  });
  if (!cands.length || !rng.chance(0.02)) return { ...s, brink: { ...b, seed: rng.seed } };
  const foe = rng.pick(cands).id;
  const open: BrinkOpen = { foe, startMs: s.worldMs, endMs: s.worldMs + BRINK_MS, stance: null, press: 0, pressMs: 0 };
  return pushReport(
    { ...s, brink: { ...b, open, nextMs: s.worldMs + BRINK_GAP, seed: rng.seed } },
    { icon: '☢️', text: `대장님, ${countryById(foe).name}이(가) 핵미사일을 앞세워 최후통첩을 보냈습니다! 72시간 벼랑끝 위기입니다. 외교 → 🌐 진영에서 버티기·압박·물러서기·협상 중 고르십시오.` },
  );
}
