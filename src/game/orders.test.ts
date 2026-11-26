import { describe, expect, it } from 'vitest';
import { advance, budgetPerDay, newGame, setRank } from './state';
import { IMPORT_BELOW, ordersOf, setOrder, summarizeAway } from './orders';
import { crisisOf, debugCrisis } from './crisis';

const H = 3600e3;

describe('미리 명령 · 자리 비운 동안', () => {
  it('봉급 자동 받기: 쌓이지 않고 바로 받아 둠', () => {
    let s = setOrder(newGame('t', 'kr', 0, { seed: 1 }), 'autoSalary', true);
    s = advance(s, 3 * H);
    expect(s.player.pendingSalary).toBeLessThan(5);
    expect(s.player.salary).toBeGreaterThan(0);
  });

  it('방어 태세: 국방예산 수입 10% 줄어듦', () => {
    const s = newGame('t', 'kr', 0, { seed: 1 });
    const on = setOrder(s, 'defendFirst', true);
    expect(budgetPerDay(on, 'kr') / budgetPerDay(s, 'kr')).toBeCloseTo(0.9, 5);
  });

  it('자원 자동 수입: 강철이 모자라면 사 옴', () => {
    let s = setRank(newGame('t', 'kr', 0, { seed: 1 }), 5);
    s = { ...s, economy: { ...s.economy, stock: { ...s.economy.stock, 강철: 0 } }, nations: { ...s.nations, kr: { ...s.nations.kr, treasury: 1e6 } } }; // 11-26: 새 판은 금고가 적음
    s = setOrder(s, 'autoImport', true);
    s = advance(s, 0.3 * H);
    expect(s.economy.stock['강철']).toBeGreaterThanOrEqual(IMPORT_BELOW);
    expect(ordersOf(s).log.some((l) => l.includes('강철'))).toBe(true); // 11-26: 새 판은 자원이 0이라 다른 자원도 함께 사 옴
  });

  it('돌발 사건 부관에게 맡기기: 바로 처리', () => {
    let s = setOrder(debugCrisis(newGame('t', 'kr', 0, { seed: 2 })), 'crisisToAide', true);
    expect(crisisOf(s).open).not.toBeNull();
    s = advance(s, 0.3 * H);
    expect(crisisOf(s).open).toBeNull();
    expect(crisisOf(s).log[0]).toContain('부관');
  });

  it('자리 비운 동안 보고: 국방예산·병력 변화와 소식', () => {
    const b = newGame('t', 'kr', 0, { seed: 3 });
    const a = advance(b, 10 * H);
    const sum = summarizeAway(b, a, 10 * H);
    expect(sum.hours).toBe(10);
    expect(sum.rows.some((r) => r.label === '국방예산')).toBe(true);
    expect(sum.rows.some((r) => r.label === '돌발 사건')).toBe(false); // 6시간 뒤 열렸지만 아직 안 고름
  });
});
