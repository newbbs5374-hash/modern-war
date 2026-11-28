import { describe, expect, it } from 'vitest';
import { newGame, setRank, type GameState } from './state';
import { FRONT } from '../data/cities';
import { RANKS } from '../data/ranks';
import { annexTick, annexEntry, canVote } from './annex';
import { controlTick, ctlOf, garTroops, setGarrison } from './control';
import { incomeShare } from './world';

const H = 3600e3;
const city = FRONT.find((c) => c.home === 'kp' && !c.capital)!.id;
const take = (): GameState => {
  const s = setRank(newGame('시험', 'kr', 0, { seed: 7, acts: true }), RANKS.length - 1);
  return annexTick({ ...s, world: { ...s.world, owner: { ...s.world.owner, [city]: 'kr' } } });
};

describe('11-28 장악도·주둔군', () => {
  it('점령 직후 장악도 0, 시간이 지나면 오르고 주둔군이 있으면 더 빨리', () => {
    let s = take();
    expect(ctlOf(annexEntry(s, city))).toBe(0);
    const low = incomeShare(s.world, 'kr', true);
    const t = s.nations.kr.troops;
    let g = setGarrison(s, city, 2);
    expect(g.nations.kr.troops).toBe(t - garTroops(city, 2));
    s = controlTick({ ...s, worldMs: s.worldMs + 10 * H });
    g = controlTick({ ...g, worldMs: g.worldMs + 10 * H });
    expect(ctlOf(annexEntry(g, city))).toBeGreaterThan(ctlOf(annexEntry(s, city)));
    expect(incomeShare(g.world, 'kr', true)).toBeGreaterThan(low);
  });
  it('장악도 60 전에는 주민투표 불가 · 도시를 잃으면 주둔군 절반이 돌아옴', () => {
    let s = take();
    expect(canVote({ ...s, world: { ...s.world, annex: { ...s.world.annex, [city]: { ...annexEntry(s, city)!, stage: '민정' } } } }, city)).toContain('장악도');
    s = setGarrison(s, city, 1);
    const t = s.nations.kr.troops;
    s = controlTick({ ...s, world: { ...s.world, owner: { ...s.world.owner, [city]: 'kp' } } });
    expect(s.nations.kr.troops).toBe(t + Math.round(garTroops(city, 1) * 0.5));
    expect(s.gars?.[city]).toBeUndefined();
  });
});
