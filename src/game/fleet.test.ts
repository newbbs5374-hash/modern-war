import { describe, expect, it } from 'vitest';
import { newGame, type GameState } from './state';
import { finishFleet, fleetSeed, fleetStateOf, planFleet, seaWars } from './fleet';
import { pairKey } from './world';

const war = (s: GameState, a: string, b: string): GameState => {
  const k = pairKey(a, b);
  return { ...s, world: { ...s.world, pairs: { ...s.world.pairs, [k]: { ...s.world.pairs[k], rel: '전쟁' } } } };
};

describe('함대 충돌 관전', () => {
  it('같은 씨앗이면 같은 장면, 끝에 승자가 정해짐', () => {
    const s = war(newGame('t', 'kr', 0, { seed: 1 }), 'kr', 'kp');
    const p1 = planFleet(s, 'kr', 'kp', 42);
    const p2 = planFleet(s, 'kr', 'kp', 42);
    expect(p1).toEqual(p2);
    expect(p1.ships.length).toBeGreaterThanOrEqual(6);
    expect(p1.events.some((e) => e.k === 'missile' || e.k === 'torpedo')).toBe(true);
    expect([0, 1]).toContain(p1.winner);
  });

  it('강한 쪽이 대체로 이김', () => {
    const s = war(newGame('t', 'us', 0, { seed: 1 }), 'us', 'kp');
    let usWins = 0;
    for (let i = 0; i < 20; i++) if (planFleet(s, 'us', 'kp', i * 977 + 1).winner === 0) usWins++;
    expect(usWins).toBeGreaterThanOrEqual(13);
  });

  it('결과는 6시간에 한 번만 반영되고, 이기면 공훈', () => {
    let s = war(newGame('t', 'us', 0, { seed: 1 }), 'us', 'kp');
    expect(seaWars(s)[0]).toMatchObject({ a: 'us', b: 'kp', ready: true, mine: true });
    let plan = planFleet(s, 'us', 'kp', fleetSeed(s, 'us', 'kp'));
    plan = { ...plan, winner: 0 };
    const merit = s.officer.totalMerit;
    const kpT = s.nations.kp.treasury;
    s = finishFleet(s, plan);
    expect(s.officer.totalMerit).toBe(merit + 30);
    expect(s.nations.kp.treasury).toBeCloseTo(kpT * 0.97);
    const again = finishFleet(s, plan);
    expect(again.nations.kp.treasury).toBe(s.nations.kp.treasury);
    expect(fleetStateOf(again).watched).toBe(2);
    expect(seaWars(s)[0].ready).toBe(false);
  });
});
