import { describe, expect, it } from 'vitest';
import { advance, newGame, type GameState } from './state';
import { canHire, hire, pmcOf } from './pmc';
import { canLaunchSat, interceptMul, launchSat, shootSat, spaceOf } from './space';
import { scouted } from './spy';
import { DEF } from '../battle3d/sim';
import { UNIT_COST } from '../data/economy';

const H = 3600e3;
const rich = (s: GameState): GameState => ({ ...s, nations: { ...s.nations, [s.player.countryId]: { ...s.nations[s.player.countryId], treasury: 1e9 } } });

describe('새 병과(용병·우주군·공병·극초음속)', () => {
  it('3D 부대 이름이 생산 표와 맞음', () => {
    for (const k of ['eng', 'hgv', 'pmc'] as const) expect(UNIT_COST[DEF[k].name]).toBeDefined();
  });

  it('용병은 바로 들어오고 72시간 뒤 돌아감', () => {
    let s = rich(newGame('t', 'kr', 0, { seed: 4 }));
    expect(canHire(s, 4)).toBeNull();
    s = hire(s, 4).state;
    expect(s.economy.army['용병']).toBe(4);
    s = advance(s, 73 * H);
    expect(pmcOf(s).list.length).toBe(0);
    expect(s.economy.army['용병'] ?? 0).toBe(0);
  });

  it('정찰 위성은 전쟁 상대를 늘 보고, 위성 요격은 요격 확률을 줄임', () => {
    let s = rich(newGame('t', 'kr', 0, { seed: 4 }));
    s = advance(launchSat(s, 'recon').state, 25 * H);
    expect(spaceOf(s).recon).toBe(1);
    expect(canLaunchSat(s, 'recon')).toBeNull();
    // 북한과 전쟁이면 계속 보임
    const k = ['kp', 'kr'].sort().join('|');
    s = { ...s, world: { ...s.world, pairs: { ...s.world.pairs, [k]: { ...s.world.pairs[k], rel: '전쟁' } } } };
    s = advance(s, 2 * H);
    expect(scouted(s, 'kp')).toBe(true);
    s = advance(launchSat(s, 'asat').state, 13 * H);
    expect(spaceOf(s).asat).toBe(1);
    s = shootSat(s, 'cn').state;
    expect(interceptMul(s, 'cn')).toBeLessThan(0.6);
  });
});
