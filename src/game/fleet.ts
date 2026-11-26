// 함대 충돌 관전: 전쟁 중인 두 나라 함대가 바다에서 부딪히는 장면을 미리 계산(같은 씨앗 = 같은 장면).
// 화면은 이 타임라인을 시간대로 그리기만 함(src/ui/FleetBattle.tsx).
// 관전이 끝나면 결과가 한 번 반영됨(같은 두 나라는 6시간에 한 번): 진 쪽 나라 예산 -3%·병력 -1%.
import { countryById } from '../data/world';
import { START_TROOPS_PER_POINT } from './balance';
import { pushReport } from './report';
import { Rng } from './rng';
import type { GameState } from './state';
import { pairKey, relationOf, type WorldEvent } from './world';

export const FLEET_COOLDOWN_MS = 6 * 3600e3;
export const FLEET_DURATION = 36; // 초(1배속)

export type ShipKind = 'carrier' | 'cruiser' | 'destroyer' | 'sub';
export const SHIP_NAME: Record<ShipKind, string> = { carrier: '항공모함', cruiser: '순양함', destroyer: '구축함', sub: '잠수함' };
const SHIP_HP: Record<ShipKind, number> = { carrier: 6, cruiser: 4, destroyer: 3, sub: 2 };

export interface Ship {
  side: 0 | 1;
  idx: number;
  kind: ShipKind;
  hp: number;
  /** 화면 위치(0~1). 왼쪽 함대는 x 0.08~0.36, 오른쪽은 0.64~0.92 */
  x: number;
  y: number;
}
export type FleetEv =
  | { t: number; k: 'missile'; from: number; to: number; hit: boolean; dur: number; dmg: number }
  | { t: number; k: 'jet'; side: 0 | 1; y: number; dur: number }
  | { t: number; k: 'torpedo'; from: number; to: number; hit: boolean; dur: number; dmg: number }
  | { t: number; k: 'sink'; ship: number };

export interface FleetPlan {
  a: string;
  b: string;
  power: [number, number];
  ships: Ship[];
  events: FleetEv[];
  end: number;
  winner: 0 | 1;
  /** 끝났을 때 남은 배 수 */
  left: [number, number];
}

const NAVY_W: Record<string, number> = { 구축함: 3, 잠수함: 4, 항공모함: 10, 강습상륙함: 5, '원자력 잠수함': 6, '레이저 방공함': 6, 전투기: 1.5, 미사일: 1 };

/** 해군력(대충): 나라 군사력 × 지금 병력 비율의 제곱근 + 내가 만든 함선 */
export function navyPower(s: GameState, id: string): number {
  const c = countryById(id);
  const base = c.military * START_TROOPS_PER_POINT;
  const ratio = Math.sqrt(Math.max(0.05, s.nations[id].troops / Math.max(1, base)));
  let p = c.military * ratio;
  if (id === s.player.countryId) for (const [n, v] of Object.entries(s.economy.army)) p += (NAVY_W[n] ?? 0) * v;
  return Math.max(5, p);
}

function fleetOf(s: GameState, id: string, power: number): ShipKind[] {
  const n = Math.max(3, Math.min(6, Math.round(2 + power / 30)));
  const out: ShipKind[] = [];
  const myCarrier = id === s.player.countryId && (s.economy.army['항공모함'] ?? 0) > 0;
  if (power >= 70 || myCarrier) out.push('carrier');
  if (power >= 40) out.push('cruiser');
  if (power >= 55 || (id === s.player.countryId && (s.economy.army['잠수함'] ?? 0) + (s.economy.army['원자력 잠수함'] ?? 0) > 0)) out.push('sub');
  while (out.length < n) out.push(out.length % 3 === 2 ? 'cruiser' : 'destroyer');
  return out.slice(0, n);
}

/** 관전할 해전 하나 계산 */
export function planFleet(s: GameState, a: string, b: string, seed: number): FleetPlan {
  const rng = new Rng(seed >>> 0);
  const power: [number, number] = [navyPower(s, a), navyPower(s, b)];
  const ships: Ship[] = [];
  ([a, b] as const).forEach((id, side) => {
    const kinds = fleetOf(s, id, power[side]);
    kinds.forEach((kind, i) => {
      const row = i % 3;
      const col = Math.floor(i / 3);
      const x0 = side === 0 ? 0.1 + col * 0.13 + (row === 1 ? 0.06 : 0) : 0.9 - col * 0.13 - (row === 1 ? 0.06 : 0);
      ships.push({ side: side as 0 | 1, idx: ships.length, kind, hp: SHIP_HP[kind], x: x0, y: 0.28 + row * 0.24 + rng.range(-0.03, 0.03) });
    });
  });
  const hp = ships.map((x) => x.hp);
  const alive = (side: 0 | 1) => ships.filter((x) => x.side === side && hp[x.idx] > 0);
  const events: FleetEv[] = [];
  const share = power[0] / (power[0] + power[1]);
  // 공격 간격: 힘이 셀수록 자주 쏨
  const next: [number, number] = [1.5 + rng.range(0, 1), 1.5 + rng.range(0, 1)];
  const gap = (side: 0 | 1) => 2.6 - 1.4 * (side === 0 ? share : 1 - share) + rng.range(-0.3, 0.3);
  const acc = (side: 0 | 1) => 0.45 + 0.3 * (side === 0 ? share : 1 - share);
  // 항모가 있으면 시작과 중간에 전투기 출격
  for (const sh of ships) if (sh.kind === 'carrier') for (const t of [1, 13]) events.push({ t: t + rng.range(0, 1), k: 'jet', side: sh.side, y: sh.y - 0.12, dur: 3.2 });
  const pending: Array<{ at: number; to: number; dmg: number }> = [];
  let end = FLEET_DURATION;
  for (let t = 0; t < FLEET_DURATION; t += 0.1) {
    // 날아간 미사일이 맞는 순간
    for (let i = pending.length - 1; i >= 0; i--) {
      if (pending[i].at <= t) {
        const p = pending.splice(i, 1)[0];
        if (hp[p.to] > 0) {
          hp[p.to] -= p.dmg;
          if (hp[p.to] <= 0) events.push({ t: p.at + 0.4, k: 'sink', ship: p.to });
        }
      }
    }
    if (!alive(0).length || !alive(1).length) {
      end = Math.min(FLEET_DURATION, t + 3);
      break;
    }
    for (const side of [0, 1] as const) {
      if (t < next[side]) continue;
      next[side] = t + gap(side);
      const shooters = alive(side);
      const targets = alive((1 - side) as 0 | 1);
      const from = rng.pick(shooters);
      const to = rng.pick(targets);
      const hit = rng.chance(acc(side));
      const sub = from.kind === 'sub';
      const dur = sub ? 2.4 : 1.4;
      const dmg = sub ? 2 : from.kind === 'carrier' ? 2 : 1;
      events.push({ t, k: sub ? 'torpedo' : 'missile', from: from.idx, to: to.idx, hit, dur, dmg });
      if (hit) pending.push({ at: t + dur, to: to.idx, dmg });
    }
  }
  const sumHp = (side: 0 | 1) => ships.filter((x) => x.side === side).reduce((v, x) => v + Math.max(0, hp[x.idx]), 0);
  const left: [number, number] = [alive(0).length, alive(1).length];
  const winner: 0 | 1 = left[0] === 0 ? 1 : left[1] === 0 ? 0 : sumHp(0) / ships.filter((x) => x.side === 0).reduce((v, x) => v + x.hp, 0) >= sumHp(1) / ships.filter((x) => x.side === 1).reduce((v, x) => v + x.hp, 0) ? 0 : 1;
  events.sort((x, y) => x.t - y.t);
  return { a, b, power, ships, events, end, winner, left };
}

export interface FleetState {
  /** 두 나라 → 마지막으로 결과가 반영된 시각 */
  last: Record<string, number>;
  log: string[];
  watched: number;
}
export const fleetStateOf = (s: GameState): FleetState => s.fleet ?? { last: {}, log: [], watched: 0 };

/** 지금 해전을 볼 수 있는 전쟁(내 나라 전쟁 먼저) */
export function seaWars(s: GameState): Array<{ a: string; b: string; ready: boolean; mine: boolean }> {
  const me = s.player.countryId;
  const out: Array<{ a: string; b: string; ready: boolean; mine: boolean }> = [];
  for (const [k, p] of Object.entries(s.world.pairs)) {
    if (p.rel !== '전쟁') continue;
    let [a, b] = k.split('|');
    if (b === me) [a, b] = [b, a];
    const last = fleetStateOf(s).last[k] ?? -Infinity;
    out.push({ a, b, ready: s.worldMs - last >= FLEET_COOLDOWN_MS, mine: a === me });
  }
  return out.sort((x, y) => Number(y.mine) - Number(x.mine));
}

/** 이 전쟁의 해전 씨앗(6시간마다 바뀜 → 그 사이엔 같은 장면) */
export function fleetSeed(s: GameState, a: string, b: string): number {
  const slot = Math.floor(s.worldMs / FLEET_COOLDOWN_MS);
  let h = s.world.seed ^ (slot * 2654435761);
  for (const ch of pairKey(a, b)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
}

/** 관전 끝: 결과 반영(쿨다운 중이면 기록만) */
export function finishFleet(s: GameState, plan: FleetPlan): GameState {
  const k = pairKey(plan.a, plan.b);
  const f = fleetStateOf(s);
  const me = s.player.countryId;
  const win = plan.winner === 0 ? plan.a : plan.b;
  const lose = plan.winner === 0 ? plan.b : plan.a;
  const text = `⚓ 해전: ${countryById(win).name} 함대 승리, ${countryById(lose).name} 함대 후퇴`;
  if (relationOf(s.world, plan.a, plan.b) !== '전쟁' || s.worldMs - (f.last[k] ?? -Infinity) < FLEET_COOLDOWN_MS) {
    return { ...s, fleet: { ...f, watched: f.watched + 1 } };
  }
  const ln = s.nations[lose];
  let ns: GameState = {
    ...s,
    nations: { ...s.nations, [lose]: { treasury: ln.treasury * 0.97, troops: ln.troops * 0.99 } },
    fleet: { last: { ...f.last, [k]: s.worldMs }, log: [text, ...f.log].slice(0, 8), watched: f.watched + 1 },
  };
  const o = { ...ns.officer };
  if (win === me) {
    o.merit += 30;
    o.totalMerit += 30;
    o.fame += 3;
  } else if (lose === me) {
    o.trust = Math.max(0, o.trust - 3);
  } else {
    o.intel += 3; // 남의 해전 관전 = 적 전술 분석
  }
  ns = { ...ns, officer: o };
  const ev: WorldEvent = { t: s.worldMs, kind: '전투', text, mine: win === me || lose === me };
  ns = { ...ns, world: { ...ns.world, events: [ev, ...ns.world.events].slice(0, 200) } };
  const say = win === me ? '우리 함대가 이겼습니다! 공훈 +30, 명성 +3' : lose === me ? '우리 함대가 밀렸습니다. 다음엔 함선을 더 갖춰야겠어요.' : `관전 기록을 분석했습니다. 정보 +3`;
  return pushReport(ns, { icon: '⚓', text: say });
}
