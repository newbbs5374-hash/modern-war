import { describe, expect, it } from 'vitest';
import { advance, budgetPerDay, newGame, troopsPerDay } from './state';
import { GROW_TRACKS, growTotal } from './aiGrowth';
import { planOf } from './aiGrowthTick';

describe('AI 나라 성장(11-26)', () => {
  it('새 판엔 성장 없음, 시간이 흐르면 AI만 단계가 오름', () => {
    let s = newGame('t', 'kr', 0, { seed: 5 });
    expect(s.world.grow).toBeUndefined();
    const b0 = budgetPerDay(s, 'cn');
    const t0 = troopsPerDay(s, 'ru');
    s = advance(s, 3600e3 * 24 * 5);
    expect(s.world.grow?.kr).toBeUndefined();
    expect(growTotal(s.world, 'cn')).toBeGreaterThan(5);
    expect(budgetPerDay(s, 'cn')).toBeGreaterThan(b0 * 0.9);
    expect(troopsPerDay(s, 'ru')).toBeGreaterThan(0);
    void t0;
  }, 30000);
  it('성향대로 다른 갈래를 키움: 경제형 중국은 경제, 공격형 러시아는 군비', () => {
    let s = newGame('t', 'kr', 0, { seed: 7 });
    s = advance(s, 3600e3 * 24 * 4);
    const cn = s.world.grow!.cn.lv;
    const ru = s.world.grow!.ru.lv;
    expect(cn.eco).toBeGreaterThan(cn.army);
    expect(ru.army).toBeGreaterThan(ru.eco);
    for (const t of GROW_TRACKS) expect(cn[t]).toBeLessThanOrEqual(30);
  }, 30000);
  it('전쟁 중이면 전시 전략', () => {
    const s = newGame('t', 'kr', 0, { seed: 1, realWorld: true });
    expect(planOf(s.world, 'ru').name).toContain('전시');
    expect(planOf(s.world, 'ru').w.army).toBeGreaterThan(planOf(s.world, 'cn').w.army);
  }, 30000);
});
