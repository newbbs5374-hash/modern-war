import { describe, expect, it } from 'vitest';
import { newGame } from './state';
import { cabinetOf } from './cabinet';
import { cityCiv } from './civ';
import { citiesOf } from './world';
import { TOUR_GAP_MS, canSolve, canTour, payCost, solveIssue, startTour, tourOf } from './tour';

describe('지방 순방', () => {
  const s0 = (() => {
    const s = newGame('t', 'kr', 0, { seed: 5 });
    return { ...s, nations: { ...s.nations, kr: { ...s.nations.kr, treasury: 1e6 } } };
  })();
  const city = citiesOf(s0.world, 'kr')[1];
  it('현안 3곳이 서로 다르게 나온다', () => {
    const s = startTour(s0, city);
    const o = tourOf(s).open!;
    expect(o.issues.length).toBe(3);
    expect(new Set(o.issues.map((x) => x.def)).size).toBe(3);
    expect(canTour(s, city)).not.toBeNull();
  });
  it('다 풀면 민심·인재·하루 쉬기', () => {
    let s = startTour(s0, city);
    const before = cityCiv(s, city).loyalty;
    const people = cabinetOf(s).people.length;
    const money = s.nations.kr.treasury;
    s = solveIssue(s, 0, 'pay');
    expect(s.nations.kr.treasury).toBe(money - payCost(s0));
    expect(canSolve(s, 0, 'talk')).not.toBeNull();
    s = solveIssue(s, 1, 'talk');
    expect(tourOf(s).open).not.toBeNull();
    s = solveIssue(s, 2, 'talk');
    expect(tourOf(s).open).toBeNull();
    expect(tourOf(s).count).toBe(1);
    expect(cityCiv(s, city).loyalty).toBeGreaterThanOrEqual(Math.min(100, before + 1));
    const cab = cabinetOf(s);
    expect(cab.people.length).toBe(people + 1);
    expect(cab.people.at(-1)!.home).toBe(city);
    expect(canTour(s, city)).toBe('순방은 하루에 한 번이에요');
    expect(canTour({ ...s, worldMs: s.worldMs + TOUR_GAP_MS }, city)).toBeNull();
  });
  it('남의 도시는 못 간다', () => {
    const other = citiesOf(s0.world, 'jp')[0];
    expect(canTour(s0, other)).not.toBeNull();
  });
});
