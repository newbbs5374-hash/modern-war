import { describe, expect, it } from 'vitest';
import { newGame, advance } from './state';
import { canDeploy, deployOf, deployTroops, recallTroops, stationed, travelMs } from './deploy';
import { pairKey } from './world';

const HOUR = 3600e3;
describe('해외 파병', () => {
  it('연합국에 보내면 도착·호감·귀국', () => {
    let s = newGame('t', 'kr', 0, { seed: 3 });
    s = { ...s, economy: { ...s.economy, army: { 보병: 3, 전차: 1 }, power: 15 } };
    s.world.pairs[pairKey('kr', 'us')].rel = '연합';
    expect(canDeploy(s, 'us', { 보병: 2 })).toBeNull();
    expect(canDeploy(s, 'kr', { 보병: 2 })).not.toBeNull();
    s = deployTroops(s, 'us', { 보병: 2, 전차: 1 });
    expect(s.economy.army.보병).toBe(1);
    expect(deployOf(s).list.length).toBe(1);
    s = advance(s, travelMs('kr', 'us') + HOUR);
    expect(stationed(s).length).toBe(1);
    s = recallTroops(s, deployOf(s).list[0].id);
    s = advance(s, travelMs('kr', 'us') + HOUR);
    expect(deployOf(s).list.length).toBe(0);
    expect((s.economy.army.보병 ?? 0) + (s.economy.army.전차 ?? 0)).toBeGreaterThanOrEqual(2);
  });
  it('전쟁 중인 나라엔 못 보냄', () => {
    const s = newGame('t', 'kr', 0, { seed: 3 });
    s.economy.army = { 보병: 1 };
    s.world.pairs[pairKey('kr', 'kp')].rel = '전쟁';
    expect(canDeploy(s, 'kp', { 보병: 1 })).toMatch(/전쟁/);
  });
});
