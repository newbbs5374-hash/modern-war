// 11-27 종합 확장안 개편 3 + 전투 1: AI 반격과 방어전.
// 내가 도시를 빼앗으면 빼앗긴 나라가 몇 시간 뒤 되찾으러 온다(장이 오를수록 자주).
// 닿기 전에 직접 3D 방어전으로 막거나, 그냥 두면 부대가 알아서 막는다(질 수도 있음).
// 장 기록이 없는 옛 저장에는 반격이 없다.
import { cityById } from '../data/cities';
import { countryById } from '../data/world';
import type { BattlePlan } from '../battle/spec';
import { CAPTURED_DEFENSE, COUNTER_AUTO_ACT, COUNTER_AUTO_ARMY, COUNTER_AUTO_BASE, COUNTER_BOUNTY_PER_VALUE, COUNTER_CHANCE, COUNTER_MAX, COUNTER_MAX_H, COUNTER_MIN_H, COUNTER_TRUST, EVENT_LOG_MAX, actAi, actOf } from './balance';
import { act1Power } from './acts';
import { armyPower } from './economy';
import { pushReport } from './report';
import { Rng } from './rng';
import type { GameState } from './state';
import { noteCapture } from './territory';
import { eul, ga, isAlive, relationOf, syncFollowers, type WorldEvent } from './world';

const H = 3600e3;

export interface Counter { id: number; city: string; from: string; dueMs: number }
export interface CounterState { list: Counter[]; nextId: number; won: number; lost: number }
export const counterOf = (s: GameState): CounterState => s.counter ?? { list: [], nextId: 1, won: 0, lost: 0 };

/** 도시를 빼앗은 직후(officer.captureCity)에 부름. ns를 직접 바꿈 */
export function planCounter(ns: GameState, city: string, prev: string): void {
  if (ns.world.act == null) return;
  const act = actOf(ns.world);
  const me = ns.player.countryId;
  const cs = counterOf(ns);
  if (prev === me || !isAlive(ns.world, prev) || relationOf(ns.world, me, prev) !== '전쟁') return;
  if (cs.list.length >= COUNTER_MAX || cs.list.some((c) => c.city === city)) return;
  const rng = new Rng(ns.officer.seed);
  const hit = rng.chance(COUNTER_CHANCE[act] ?? 0);
  const due = ns.worldMs + rng.range(COUNTER_MIN_H, COUNTER_MAX_H) * H;
  ns.officer = { ...ns.officer, seed: rng.seed };
  if (!hit) return;
  ns.counter = { ...cs, list: [...cs.list, { id: cs.nextId, city, from: prev, dueMs: due }], nextId: cs.nextId + 1 };
  const text = `🚨 ${ga(countryById(prev).name)} ${eul(cityById(city).name)} 되찾으러 와요. 본부의 반격 경보에서 직접 막을 수 있어요.`;
  ns.world.events.unshift({ t: ns.worldMs, kind: '전투', text, mine: true });
}

/** 맡겼을 때 막아 낼 확률 */
export function counterAutoChance(s: GameState): number {
  const army = Math.min(1, armyPower(s) / Math.max(1, act1Power(s) * 3));
  return Math.max(0.15, Math.min(0.9, COUNTER_AUTO_BASE + COUNTER_AUTO_ARMY * army - (actAi(s.world) - 1) * COUNTER_AUTO_ACT));
}

const SURVIVE = ['frost', 'bridgehold', 'border', 'oasis'];
/** 직접 막기: 3D 방어전 한 판(시간까지 버티기) */
export function counterPlan(s: GameState, c: Counter): BattlePlan {
  const name = cityById(c.city).name;
  const seed = (c.id * 7919 + Math.floor(c.dueMs / 1000)) >>> 0;
  const title = `${name} 방어전`;
  return {
    title,
    source: 'counter',
    mainIdx: 0,
    counter: c.id,
    intro: `${countryById(c.from).name}군이 ${eul(name)} 되찾으러 몰려와요. 끝까지 버티면 도시를 지켜요.`,
    stages: [{ frame: 'b3d', variant: SURVIVE[seed % SURVIVE.length], label: '방어전', title, difficulty: 1 + (actAi(s.world) - 1) * 0.5, seed, enemy: `${countryById(c.from).name}군`, city: c.city }],
  };
}

/** 반격 한 건을 끝냄(직접·맡김 공용). stars: 0~3 */
export function settleCounter(s: GameState, id: number, win: boolean, stars: number, how: '직접' | '맡김'): { state: GameState; text: string } {
  const cs = counterOf(s);
  const c = cs.list.find((x) => x.id === id);
  if (!c) return { state: s, text: '이미 끝난 반격이에요.' };
  const me = s.player.countryId;
  const city = cityById(c.city);
  const list = cs.list.filter((x) => x.id !== id);
  // 그 사이 도시 주인이 바뀌었거나 전쟁이 끝났으면 없던 일
  if (s.world.owner[c.city] !== me || relationOf(s.world, me, c.from) !== '전쟁' || !isAlive(s.world, c.from)) {
    return { state: { ...s, counter: { ...cs, list } }, text: `${countryById(c.from).name}군이 물러갔어요.` };
  }
  const ns: GameState = structuredClone(s);
  ns.counter = { ...cs, list, won: cs.won + (win ? 1 : 0), lost: cs.lost + (win ? 0 : 1) };
  let text: string;
  if (win) {
    const bounty = Math.round(city.value * COUNTER_BOUNTY_PER_VALUE * (1 + stars * 0.25));
    ns.nations[me].treasury += bounty;
    ns.officer.trust = Math.min(100, ns.officer.trust + COUNTER_TRUST);
    const boost = how === '직접' && stars >= 3 ? 1 : 0;
    ns.officer.boosts = (ns.officer.boosts ?? 0) + boost;
    text = `🛡️ ${eul(city.name)} 지켜 냈어요! 노획 나라 예산 +${bounty.toLocaleString('ko-KR')} · 신뢰도 +${COUNTER_TRUST}${boost ? ' · 🎫 가속권 +1' : ''}`;
  } else {
    noteCapture(ns.world, c.city, c.from);
    ns.world.owner[c.city] = c.from;
    ns.world.defense[c.city] = CAPTURED_DEFENSE;
    syncFollowers(ns.world);
    text = `💥 ${ga(countryById(c.from).name)} ${eul(city.name)} 되찾아 갔어요.`;
  }
  const ev: WorldEvent = { t: ns.worldMs, kind: win ? '전투' : '점령', text, mine: true };
  ns.world.events = [ev, ...ns.world.events].slice(0, EVENT_LOG_MAX);
  return { state: pushReport(ns, { icon: win ? '🛡️' : '💥', text: `${how === '맡김' ? '부대가 반격을 맞았습니다. ' : ''}${text}` }), text };
}

/** 세계 판단마다: 시간이 다 된 반격은 부대가 알아서 맞음 */
export function counterTick(s: GameState): GameState {
  const cs = counterOf(s);
  if (!cs.list.length) return s;
  let out = s;
  for (const c of cs.list) {
    if (c.dueMs > out.worldMs) continue;
    const rng = new Rng(out.officer.seed);
    const win = rng.chance(counterAutoChance(out));
    out = { ...out, officer: { ...out.officer, seed: rng.seed } };
    out = settleCounter(out, c.id, win, win ? 1 : 0, '맡김').state;
  }
  return out;
}
