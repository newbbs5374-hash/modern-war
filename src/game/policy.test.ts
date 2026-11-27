import { describe, expect, it } from 'vitest';
import { budgetPerDay, newGame, skip, troopsPerDay } from './state';
import { POLICY_COOLDOWN_MS, defConsentCap, setSplit, setTax, splitProblem, policyOf } from './policy';
import { favorOf, loyaltyTarget } from './civ';
import { approvalTarget } from './approval';
import { citiesOf } from './world';

describe('예산 나누기·세금', () => {
  it('합 100·범위·5% 단위를 지켜야 함', () => {
    expect(splitProblem({ def: 40, dip: 20, soc: 20, eco: 20 })).toBeNull();
    expect(splitProblem({ def: 45, dip: 20, soc: 20, eco: 20 })).not.toBeNull();
    expect(splitProblem({ def: 80, dip: 5, soc: 5, eco: 10 })).not.toBeNull();
    expect(splitProblem({ def: 37, dip: 23, soc: 20, eco: 20 })).not.toBeNull();
  });
  it('경제를 늘리면 예산↑, 국방을 늘리면 징병↑, 사회를 늘리면 민심↑, 외교를 늘리면 호감↑', () => {
    const s = newGame('t', 'kr', 0, { seed: 1 });
    const city = citiesOf(s.world, 'kr')[0];
    const eco = setSplit(s, { def: 20, dip: 20, soc: 20, eco: 40 });
    expect(budgetPerDay(eco, 'kr')).toBeGreaterThan(budgetPerDay(s, 'kr'));
    const strong = { ...s, officer: { ...s.officer, trust: 100 } };
    const def = setSplit(strong, { def: 60, dip: 10, soc: 15, eco: 15 });
    expect(policyOf(def).split.def).toBe(60);
    expect(troopsPerDay(def, 'kr')).toBeGreaterThan(troopsPerDay(s, 'kr'));
    const soc = setSplit(s, { def: 30, dip: 15, soc: 40, eco: 15 });
    expect(loyaltyTarget(soc, city)).toBeGreaterThan(loyaltyTarget(s, city));
    const dip = setSplit(s, { def: 30, dip: 40, soc: 15, eco: 15 });
    expect(favorOf(dip, 'us')).toBeGreaterThan(favorOf(s, 'us'));
  });
  it('세금: 높으면 예산↑ 지지도 목표↓, 바꾼 뒤 1시간은 다시 못 바꿈', () => {
    const s = newGame('t', 'kr', 0, { seed: 2 });
    const hi = setTax(s, 'high');
    expect(budgetPerDay(hi, 'kr')).toBeGreaterThan(budgetPerDay(s, 'kr'));
    expect(approvalTarget(hi)).toBeLessThan(approvalTarget(s));
    expect(policyOf(setTax(hi, 'low')).tax).toBe('high');
    expect(policyOf(setTax(skip(hi, POLICY_COOLDOWN_MS), 'low')).tax).toBe('low');
  });
  it('국방 몫은 국회 동의 한도까지만 늘릴 수 있고, 줄이는 건 언제나 됨', () => {
    const s = newGame('t', 'kr', 0, { seed: 3 });
    const cap = defConsentCap(s);
    expect(cap).toBeGreaterThanOrEqual(policyOf(s).split.def);
    const over = cap + 10;
    const blocked = setSplit(s, { def: over, dip: 20, soc: 20, eco: 60 - over });
    expect(policyOf(blocked).split.def).toBe(policyOf(s).split.def);
    const low = setSplit(s, { def: 20, dip: 20, soc: 20, eco: 40 });
    expect(policyOf(low).split.def).toBe(20);
    const trusted = { ...s, officer: { ...s.officer, trust: 100 } };
    expect(defConsentCap(trusted)).toBeGreaterThan(cap);
  });
});
