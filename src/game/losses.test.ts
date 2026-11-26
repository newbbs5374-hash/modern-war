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
