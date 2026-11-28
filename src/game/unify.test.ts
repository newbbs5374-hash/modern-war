import { describe, expect, it } from 'vitest';
import { newGame, setRank, type GameState } from './state';
import { FRONT } from '../data/cities';
import { RANKS } from '../data/ranks';
import { grandTargets } from './officer';
import { canUnify, proposeUnify, unifyTick, UNIFY_HOLD_H } from './unify';
import { isAlive, pairKey } from './world';
import { campaignRoute } from './campaign';

const H = 3600e3;
const fresh = () => setRank(newGame('시험', 'kr', 0, { seed: 7, acts: true }), RANKS.length - 1);
const atWar = (s: GameState, foe: string): GameState => {
  const k = pairKey('kr', foe);
  return { ...s, world: { ...s.world, act: 3, pairs: { ...s.world.pairs, [k]: { ...s.world.pairs[k], rel: '전쟁' } } } };
};

describe('11-28 수도 함락 불가 · 통일 권유', () => {
  it('남의 수도는 대전투 대상·전역 길에서 빠짐', () => {
    const s = atWar(fresh(), 'kp');
    expect(grandTargets(s).some((id) => id === 'kp-0')).toBe(false);
    expect(campaignRoute(s, 'kp')).not.toContain('kp-0');
  });

  it('점령지를 180시간 반란 없이 지키면 통일을 권할 수 있고, 잃으면 처음부터', () => {
    let s = fresh();
    const city = FRONT.find((c) => c.home === 'kp' && !c.capital)!.id;
    s = { ...s, world: { ...s.world, owner: { ...s.world.owner, [city]: 'kr' } } };
    s = unifyTick(s);
    expect(s.unify?.kp?.held).toEqual([city]);
    expect(canUnify(s, 'kp')).toContain('시간');
    s = unifyTick({ ...s, worldMs: s.worldMs + UNIFY_HOLD_H * H });
    expect(canUnify(s, 'kp')).toBeNull();
    // 잃으면 처음부터
    const lost = unifyTick({ ...s, world: { ...s.world, owner: { ...s.world.owner, [city]: 'kp' } } });
    expect(lost.unify?.kp).toBeUndefined();
  });

  it('통일하면 수도까지 모두 우리 땅', () => {
    let s = fresh();
    const cities = FRONT.filter((c) => c.home === 'kp' && !c.capital).map((c) => c.id);
    const owner = { ...s.world.owner };
    for (const c of cities) owner[c] = 'kr';
    s = unifyTick({ ...s, world: { ...s.world, owner } });
    s = unifyTick({ ...s, worldMs: s.worldMs + UNIFY_HOLD_H * H });
    // 확률이 낮아도 될 때까지(거절 대기 넘기며)
    let r = proposeUnify(s, 'kp');
    for (let i = 0; i < 40 && !r.ok; i++) {
      s = { ...r.state, worldMs: r.state.worldMs + 73 * H };
      r = proposeUnify(s, 'kp');
    }
    expect(r.ok).toBe(true);
    expect(r.state.world.owner['kp-0']).toBe('kr');
    expect(isAlive(r.state.world, 'kp')).toBe(false);
  });
});
