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

import { OPP_MS, TERM_BREAK, TERM_KEEP, canSubmit as canSubmit2, confRows as confRows2, isOpposition, termNo, termPledges } from './assembly';
import { withDom as withDom2, domOf as domOf2 } from './domestic';

describe('내정 2 임기와 선거', () => {
  const base = () => withDom2(newGame('시험', 'kr', 0, { seed: 5 }), {});
  const sum = (s: ReturnType<typeof base>) => confRows2(s).reduce((a, [, v]) => a + v, 0);
  it('이번 임기에 지킨 공약은 표가 되고 깬 공약은 표를 깎는다', () => {
    const s = base();
    const d = domOf2(s);
    const kept = withDom2(s, { agenda: { ...d.agenda, done: ['a', 'b'] } });
    expect(termPledges(kept)).toEqual({ kept: 2, broken: 0 });
    expect(sum(kept) - sum(s)).toBeCloseTo(2 * TERM_KEEP);
    const broke = withDom2(s, { agenda: { ...d.agenda, broken: ['x'] } });
    expect(sum(broke) - sum(s)).toBeCloseTo(-TERM_BREAK);
  });
  it('지난 임기의 공약은 다시 세지 않는다', () => {
    const s = base();
    const d = domOf2(s);
    const t = withDom2({ ...s, assembly: { ...assemblyOf(s), termDone: 2 } }, { agenda: { ...d.agenda, done: ['a', 'b', 'c'] } });
    expect(termPledges(t).kept).toBe(1);
  });
  it('야당 지도자인 동안은 법안을 못 내고, 임기 번호는 투표 횟수로 센다', () => {
    const s = base();
    const a = assemblyOf(s);
    const opp = { ...s, assembly: { ...a, confLoss: 1, oppUntilMs: s.worldMs + OPP_MS } };
    expect(isOpposition(opp)).toBe(true);
    expect(canSubmit2(opp, a.offer[0])).toBe('야당 지도자인 동안은 법안을 못 내요');
    expect(termNo(opp)).toBe(2);
    expect(isOpposition({ ...opp, worldMs: s.worldMs + OPP_MS + 1 })).toBe(false);
  });
});
