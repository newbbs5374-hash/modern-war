// 11-28 부처 예산 나누기
import { describe, expect, test } from 'vitest';
import { advance, newGame } from './state';
import { canSetMb, mbOf, setMb, MB_WAIT } from './ministryBudget';
import { domRows } from './domestic';
import { canSetTax, setTax } from './taxes';

describe('부처 예산 나누기', () => {
  test('10점을 다 나눠야 하고, 많이 준 갈래는 효과 +, 적게 준 갈래는 −', () => {
    let s = advance(newGame('t', 'kr', 0, { seed: 4, realWorld: true }), 3600e3);
    expect(canSetMb(s, { def: 3, eco: 2, wel: 2, sci: 2, dip: 2 })).toBeTruthy();
    const pts = { def: 5, eco: 2, wel: 2, sci: 1, dip: 0 };
    expect(canSetMb(s, pts)).toBeNull();
    s = setMb(s, pts);
    expect(mbOf(s).pts.def).toBe(5);
    const sum = (k: Parameters<typeof domRows>[1]) => domRows(s, k).filter(([n]) => n.includes('부처 예산')).reduce((a, [, v]) => a + v, 0);
    expect(sum('defense')).toBeCloseTo(4.5);
    expect(sum('research')).toBeLessThan(0);
    expect(sum('diplo')).toBeCloseTo(-1.5);
    expect(sum('economy')).toBe(0);
    expect(canSetMb(s, { def: 2, eco: 2, wel: 2, sci: 2, dip: 2 })).toBeTruthy();
    expect(canSetMb({ ...s, worldMs: s.worldMs + MB_WAIT }, { def: 2, eco: 2, wel: 2, sci: 2, dip: 2 })).toBeNull();
  });
  test('세금: 높이면 예산 +, 지지도 −, 하루에 한 번', () => {
    let s = advance(newGame('t', 'kr', 0, { seed: 4, realWorld: true }), 3600e3);
    expect(canSetTax(s, 'income', 'mid')).toBeTruthy();
    s = setTax(s, 'income', 'high');
    const sum = (k: Parameters<typeof domRows>[1]) => domRows(s, k).filter(([n]) => n.includes('소득세')).reduce((a, [, v]) => a + v, 0);
    expect(sum('budget')).toBeCloseTo(0.04);
    expect(sum('approval')).toBeCloseTo(-2);
    expect(canSetTax(s, 'vat', 'low')).toBeTruthy();
  });
});
