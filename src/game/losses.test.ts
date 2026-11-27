import { describe, expect, it } from 'vitest';
import { loseUnits, subtractDead } from './losses';
import { newGame } from './state';
import { DEF } from '../battle3d/sim';
import { UNIT_COST } from '../data/economy';

describe('3D 전투 손실(11-26)', () => {
  it('가진 만큼만 빠지고, 0이 되면 지움', () => {
    const r = subtractDead({ 전차: 3, 보병: 1 }, { 전차: 2, 보병: 4, 폭격기: 1 });
    expect(r.units).toEqual({ 전차: 1 });
    expect(r.taken).toEqual({ 전차: 2, 보병: 1 });
  });
  it('본국 부대에서 빠지고 글이 나옴', () => {
    let s = newGame('t', 'kr', 0, { seed: 1 });
    s = { ...s, economy: { ...s.economy, army: { 전차: 2 } } };
    const r = loseUnits(s, { 전차: 1, 보병: 1 });
    expect(r.state.economy.army).toEqual({ 전차: 1 });
    expect(r.text).toContain('전차 1');
    expect(loseUnits(s, {}).state).toBe(s);
  });
  it('3D 병과 이름은 모집할 수 있는 부대 이름과 같음', () => {
    const skip = ['hq', 'cvjet', 'boat', 'tech']; /* 적만 쓰는 것 */ const miss: string[] = [];
    for (const [k, d] of Object.entries(DEF)) if (!skip.includes(k) && !(d as { ally?: boolean }).ally) if (!UNIT_COST[d.name]) miss.push(`${k} ${d.name}`);
    expect(miss).toEqual([]);
  });
});

describe('가진 부대만 냄(11-26)', () => {
  it('특화 유닛은 바탕 병과로 세고, 앞 판에서 쓰러진 만큼 뺌', async () => {
    const { ownedByBase } = await import('./losses');
    const { SPECIALS } = await import('../data/specials');
    const sp = SPECIALS.find((d) => d.base === '구축함')!;
    expect(ownedByBase({ 구축함: 1, [sp.name]: 2, 전차: 0 }, { 구축함: 1 })).toEqual({ 구축함: 2 });
    const r = subtractDead({ 구축함: 1, [sp.name]: 2 }, { 구축함: 2 });
    expect(r.units).toEqual({ [sp.name]: 1 });
  });
});

describe('특별 병과 1.3배(11-27)', () => {
  it('특별 병과 전투력은 같은 종류의 1.3배 이상, 3D에서는 비율만큼', async () => {
    const { SPECIALS } = await import('../data/specials');
    const { UNIT_COST, specialCost } = await import('../data/economy');
    for (const d of SPECIALS) expect(specialCost(d.base, d.cost).power).toBeGreaterThanOrEqual(Math.round(UNIT_COST[d.base].power * 1.3) - 1);
    const { specialBuffs } = await import('./losses');
    const sp = SPECIALS.find((d) => d.base === '구축함')!;
    expect(specialBuffs({ [sp.name]: 2 }).dd).toBe(1.3);
    expect(specialBuffs({ [sp.name]: 1, 구축함: 1 }).dd).toBe(1.15);
    expect(specialBuffs({ 구축함: 3 })).toEqual({});
  });
});
