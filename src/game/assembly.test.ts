import { describe, expect, it } from 'vitest';
import { advance, newGame, budgetPerDay, setRank, type GameState } from './state';
import { assemblyOf, billChance, confChance, CONF_MS, newAssembly, submitBill } from './assembly';
import { lawEff, liveLaws } from './laws';
import { newPres } from './approval';

const H = 3600e3;
describe('국회·재신임', () => {
  it('법안 제출 → 2시간 뒤 표결 → 통과하면 법 효과', () => {
    let s: GameState = newGame('t', 'kr', 0, { seed: 11 });
    s = { ...s, assembly: newAssembly(s), officer: { ...s.officer, trust: 100 } };
    const id = assemblyOf(s).offer[0];
    expect(billChance(s, id)).toBeGreaterThan(0.5);
    s = submitBill(s, id);
    expect(assemblyOf(s).vote?.id).toBe(id);
    s = advance(s, 3 * H);
    expect(assemblyOf(s).vote).toBeNull();
    expect(assemblyOf(s).offer).not.toContain(id);
  });
  it('법 효과가 예산에 붙음', () => {
    let s: GameState = newGame('t', 'kr', 0, { seed: 12 });
    const b0 = budgetPerDay(s, 'kr');
    s = { ...s, assembly: { ...newAssembly(s), laws: [{ id: 'richtax', untilMs: 1e12 }] } };
    expect(liveLaws(s).length).toBe(1);
    expect(lawEff(s, 'budget')).toBeCloseTo(0.08);
    expect(budgetPerDay(s, 'kr')).toBeGreaterThan(b0);
  });
  it('재신임: 지지도 높으면 통과 보상, 낮으면 신뢰도·명성 벌점', () => {
    let s: GameState = newGame('t', 'kr', 0, { seed: 13 });
    s = setRank(s, 3);
    s = { ...s, assembly: { ...newAssembly(s), confMs: H }, pres: { ...newPres(), approval: 99 } };
    expect(confChance(s)).toBe(1);
    const won = advance(s, 2 * H);
    expect(assemblyOf(won).confWins).toBe(1);
    expect(assemblyOf(won).confMs).toBeGreaterThan(CONF_MS);
    s = { ...s, pres: { ...newPres(), approval: 0 } };
    const lost = advance(s, 0.3 * H);
    expect(lost.player.rankIndex).toBe(10);
    const lost2 = advance(lost, 1 * H);
    expect(assemblyOf(lost2).confLoss).toBe(1);
    expect(lost2.player.title!).toBeLessThan(lost.player.title!);
  });
});
