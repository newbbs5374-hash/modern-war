// 가속권: 임무·부관 심부름·내정 일·시설 공사·부대 생산·대전투 준비 시간을 줄임.
// 한 장 = 실제 30분. 시험판에서는 넉넉히 줌(얻는 곳·값은 나중에 정함).
import type { GameState } from './state';

export const BOOST_MS = 30 * 60e3;
/** 시험판: 새 판·옛 저장에 주는 가속권 */
export const TEST_BOOSTS = 300;

export type BoostTarget =
  | { kind: 'mission' }
  | { kind: 'errand'; id: number }
  | { kind: 'chore' }
  | { kind: 'build'; fac: string }
  | { kind: 'queue'; id: number }
  | { kind: 'grand' };

export const boostsOf = (s: GameState) => s.officer.boosts ?? 0;

/** 남은 시간(ms). 없거나 끝났으면 0 */
export function boostLeft(s: GameState, t: BoostTarget): number {
  const now = s.worldMs;
  const end =
    t.kind === 'mission'
      ? s.officer.active?.endMs
      : t.kind === 'errand'
        ? s.officer.aides.find((a) => a.id === t.id)?.errand?.endMs
        : t.kind === 'chore'
          ? s.economy.chore?.endMs
          : t.kind === 'build'
            ? (s.economy.facilities as Record<string, { buildEndMs: number }>)[t.fac]?.buildEndMs || undefined
            : t.kind === 'queue'
              ? s.economy.queue.find((q) => q.id === t.id)?.endMs
              : s.officer.grandReadyMs;
  return end ? Math.max(0, end - now) : 0;
}

/** 다 끝내는 데 드는 가속권 수 */
export const boostsToFinish = (s: GameState, t: BoostTarget) => Math.ceil(boostLeft(s, t) / BOOST_MS);

/** 가속권 n장 사용(남은 시간보다 많이 쓰지 않음) */
export function useBoost(s: GameState, t: BoostTarget, n: number): GameState {
  const left = boostLeft(s, t);
  const k = Math.min(n, boostsOf(s), Math.ceil(left / BOOST_MS));
  if (k <= 0) return s;
  const cut = Math.min(left, k * BOOST_MS);
  const o = { ...s.officer, boosts: boostsOf(s) - k };
  let e = s.economy;
  if (t.kind === 'mission' && o.active) o.active = { ...o.active, endMs: o.active.endMs - cut, startMs: o.active.startMs - cut };
  if (t.kind === 'errand') o.aides = o.aides.map((a) => (a.id === t.id && a.errand ? { ...a, errand: { ...a.errand, endMs: a.errand.endMs - cut } } : a));
  if (t.kind === 'grand') o.grandReadyMs -= cut;
  if (t.kind === 'chore' && e.chore) e = { ...e, chore: { ...e.chore, endMs: e.chore.endMs - cut } };
  if (t.kind === 'build') {
    const f = (e.facilities as Record<string, { buildEndMs: number }>)[t.fac];
    e = { ...e, facilities: { ...e.facilities, [t.fac]: { ...f, buildEndMs: f.buildEndMs - cut } } };
  }
  if (t.kind === 'queue') {
    // 줄에서 뒤에 선 것들도 같이 당겨짐
    const i = e.queue.findIndex((q) => q.id === t.id);
    e = { ...e, queue: e.queue.map((q, j) => (j < i ? q : j === i ? { ...q, endMs: q.endMs - cut } : { ...q, startMs: q.startMs - cut, endMs: q.endMs - cut })) };
  }
  return { ...s, officer: o, economy: e };
}
