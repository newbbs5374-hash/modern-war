import { describe, expect, it } from 'vitest';
import { newGame, type GameState } from './state';
import { pairKey } from './world';
import { RAID_BASE, RAID_FLY_MS, RAID_GAP_MS, RAID_NET, canStrike, interceptRate, raidOf, raidTick, raiseNet, strikeFirst } from './missileWar';

function war(): GameState {
  const s = newGame('t', 'kr', 0, { seed: 12 });
  const k = pairKey('kr', 'kp');
  return { ...s, nations: { ...s.nations, kr: { ...s.nations.kr, treasury: 1e6 } }, world: { ...s.world, pairs: { ...s.world.pairs, [k]: { ...s.world.pairs[k], rel: '전쟁' } } } };
}
describe('미사일·드론 전', () => {
  it('평화로우면 공습이 없다', () => {
    let s = newGame('t', 'kr', 0, { seed: 12 });
    s = raidTick(s);
    s = raidTick({ ...s, worldMs: RAID_GAP_MS[1] + 1 });
    expect(raidOf(s).list.length).toBe(0);
  });
  it('전쟁 중이면 경보가 오고, 요격망을 켜면 요격률이 오른다', () => {
    let s = raidTick(war());
    s = raidTick({ ...s, worldMs: RAID_GAP_MS[0] + 1 });
    const r = raidOf(s).list[0];
    expect(r).toBeTruthy();
    expect(r.from).toBe('kp');
    expect(interceptRate(s, true)).toBeCloseTo(interceptRate(s, false) + RAID_NET, 5);
    expect(interceptRate(s, false)).toBeGreaterThanOrEqual(RAID_BASE);
    const money = s.nations.kr.treasury;
    s = raiseNet(s, r.id);
    expect(raidOf(s).list[0].net).toBe(true);
    expect(s.nations.kr.treasury).toBeLessThan(money);
    s = raidTick({ ...s, worldMs: s.worldMs + RAID_FLY_MS + 1 });
    expect(raidOf(s).list.find((x) => x.id === r.id)).toBeUndefined();
    expect(raidOf(s).shot + raidOf(s).hit).toBe(r.n);
  });
  it('선제 타격은 부대가 있어야 하고 한 번만', () => {
    let s = raidTick(war());
    s = raidTick({ ...s, worldMs: RAID_GAP_MS[0] + 1 });
    const r = raidOf(s).list[0];
    const none = { ...s, economy: { ...s.economy, army: {} } };
    expect(canStrike(none, r.id)).not.toBeNull();
    const armed = { ...s, economy: { ...s.economy, army: { 미사일: 5 } } };
    expect(canStrike(armed, r.id)).toBeNull();
    const out = strikeFirst(armed, r.id);
    if (out.ok) expect(raidOf(out.state).list.length).toBe(0);
    else expect(canStrike(out.state, r.id)).not.toBeNull();
  });
});
