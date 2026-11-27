// 11-28 국채
import { describe, expect, test } from 'vitest';
import { newGame, advance } from './state';
import { bondDebt, borrow, bondSize, canBorrow, BOND_MAX, forecast } from './bonds';

describe('국채', () => {
  test('빌리면 예산이 늘고, 시간이 지나면 이자 붙여 갚음', () => {
    let s = newGame('t', 'kr', 0, { seed: 2, realWorld: true });
    const t0 = s.nations.kr.treasury;
    const amt = bondSize(s);
    s = borrow(s);
    expect(s.nations.kr.treasury).toBe(t0 + amt);
    const d0 = bondDebt(s);
    expect(d0).toBeGreaterThan(amt);
    s = advance(s, 6 * 3600e3);
    expect(bondDebt(s)).toBeLessThan(d0);
    expect(typeof forecast(s, 12)).toBe('number');
  });
  test('빚 한도', () => {
    let s = newGame('t', 'kr', 0, { seed: 2, realWorld: true });
    for (let i = 0; i < BOND_MAX; i++) s = borrow(s);
    expect(canBorrow(s)).toBeTruthy();
  });
});

import { fundValue, invest, withdrawFund } from './bonds';
describe('국부 펀드', () => {
  test('맡기면 예산이 줄고, 지수가 오르면 값이 오름', () => {
    let s = advance(newGame('t', 'kr', 0, { seed: 2, realWorld: true }), 3600e3);
    expect(s.polity).toBeTruthy();
    s = { ...s, nations: { ...s.nations, kr: { ...s.nations.kr, treasury: 1e6 } } };
    s = invest(s);
    expect(s.nations.kr.treasury).toBe(8e5);
    const v0 = fundValue(s);
    const up = { ...s, polity: { ...s.polity!, econ: { ...s.polity!.econ, stock: s.polity!.econ.stock * 1.1 } } };
    expect(fundValue(up)).toBeGreaterThan(v0);
    const out = withdrawFund(up);
    expect(out.nations.kr.treasury).toBeGreaterThan(8e5 + v0);
  });
});
