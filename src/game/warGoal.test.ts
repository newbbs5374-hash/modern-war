import { describe, expect, it } from 'vitest';
import { newGame, type GameState } from './state';
import { FRONT } from '../data/cities';
import { favorOf } from './civ';
import { pairKey, relationOf } from './world';
import { GREED_FAVOR, canSetGoal, goalMet, reparations, setGoal, settleWar, takenIn, warGoalOf, warGoalTick } from './warGoal';

function war(): GameState {
  const s = newGame('t', 'kr', 0, { seed: 6 });
  const k = pairKey('kr', 'jp');
  return { ...s, world: { ...s.world, pairs: { ...s.world.pairs, [k]: { ...s.world.pairs[k], rel: '전쟁' } } } };
}
const take = (s: GameState, id: string): GameState => ({ ...s, world: { ...s.world, owner: { ...s.world.owner, [id]: 'kr' } } });
const jp = FRONT.filter((c) => c.home === 'jp').map((c) => c.id);

describe('전쟁 목표와 협상', () => {
  it('전쟁 중에만 한 번 정한다', () => {
    const peace = newGame('t', 'kr', 0, { seed: 6 });
    expect(canSetGoal(peace, 'jp')).not.toBeNull();
    const s = setGoal(war(), 'jp', 'city');
    expect(warGoalOf(s, 'jp')?.goal).toBe('city');
    expect(canSetGoal(s, 'jp')).not.toBeNull();
    expect(goalMet(s, 'jp')).toBe(false);
  });
  it('배상금: 도시를 차지하면 협상으로 끝내고 돌려주며 돈을 받는다', () => {
    let s = setGoal(war(), 'jp', 'money');
    const city = jp.find((id) => id !== 'jp-0')!;
    s = take(s, city);
    expect(takenIn(s, 'jp')).toBe(1);
    expect(goalMet(s, 'jp')).toBe(true);
    const money = s.nations.kr.treasury;
    const r = settleWar(s, 'jp');
    expect(relationOf(r.state.world, 'kr', 'jp')).toBe('휴전');
    expect(r.state.world.owner[city]).toBe('jp');
    expect(r.state.nations.kr.treasury).toBe(money + reparations(s));
    expect(warGoalOf(r.state, 'jp')).toBeNull();
  });
  it('정권 교체: 수도를 차지해야 하고, 끝내면 연합', () => {
    let s = setGoal(war(), 'jp', 'regime');
    s = take(s, jp.find((id) => id !== 'jp-0')!);
    expect(goalMet(s, 'jp')).toBe(false);
    s = take(s, 'jp-0');
    const r = settleWar(s, 'jp');
    expect(relationOf(r.state.world, 'kr', 'jp')).toBe('연합');
    expect(r.state.world.owner['jp-0']).toBe('jp');
  });
  it('욕심을 내면 다른 나라 호감이 깎인다', () => {
    let s = setGoal(war(), 'jp', 'money');
    const before = favorOf(s, 'us');
    for (const id of jp.filter((x) => x !== 'jp-0').slice(0, 2)) s = take(s, id);
    s = warGoalTick(s);
    expect(favorOf(s, 'us')).toBeCloseTo(before + GREED_FAVOR, 5);
    expect(favorOf(warGoalTick(s), 'us')).toBeCloseTo(before + GREED_FAVOR, 5);
  });
  it('완전 정복은 협상이 없다', () => {
    let s = setGoal(war(), 'jp', 'total');
    s = take(s, 'jp-0');
    expect(goalMet(s, 'jp')).toBe(false);
    expect(settleWar(s, 'jp').text).toBe('');
  });
});
