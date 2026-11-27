import { describe, expect, it } from 'vitest';
import { newGame, type GameState } from './state';
import { FRONT } from '../data/cities';
import { favorOf } from './civ';
import { pairKey } from './world';
import { JOINT_DIFF, JOINT_MS, alliesOf, allyWars, askSupport, canAsk, canHelp, helpAlly, jointDiff, jointOf } from './jointOps';

const rel = (s: GameState, a: string, b: string, r: '전쟁' | '연합'): GameState => {
  const k = pairKey(a, b);
  return { ...s, world: { ...s.world, pairs: { ...s.world.pairs, [k]: { ...s.world.pairs[k], rel: r } } } };
};
describe('연합 합동 작전', () => {
  const s0 = rel(rel(newGame('t', 'kr', 0, { seed: 8 }), 'kr', 'us', '연합'), 'kr', 'kp', '전쟁');
  const city = FRONT.find((c) => c.home === 'kp')!.id;
  it('연합국에만 청할 수 있다', () => {
    expect(alliesOf(s0).some((c) => c.id === 'us')).toBe(true);
    expect(canAsk(s0, 'cn', city)).not.toBeNull();
    expect(canAsk(s0, 'us', city)).toBeNull();
  });
  it('받아 주면 난이도가 내려가고 호감을 쓴다', () => {
    let s = s0;
    let ok = false;
    for (let i = 0; i < 30 && !ok; i++) {
      const r = askSupport(s, 'us', city);
      ok = r.ok;
      s = ok ? r.state : { ...r.state, worldMs: r.state.worldMs + 7 * 3600e3 };
    }
    expect(ok).toBe(true);
    expect(jointDiff(s, city)).toBeCloseTo(-JOINT_DIFF, 5);
    expect(favorOf(s, 'us')).toBeLessThan(favorOf(s0, 'us'));
    expect(canAsk(s, 'us', city)).not.toBeNull();
    expect(jointDiff({ ...s, worldMs: s.worldMs + JOINT_MS + 1 }, city)).toBeCloseTo(0, 5);
  });
  it('연합국이 전쟁 중일 때만 도우러 간다', () => {
    expect(canHelp(s0, 'us')).not.toBeNull();
    const s = rel(s0, 'us', 'ru', '전쟁');
    expect(allyWars(s, 'us').map((c) => c.id)).toContain('ru');
    const r = helpAlly(s, 'us');
    expect(r.text.length).toBeGreaterThan(5);
    expect(favorOf(r.state, 'us')).toBeGreaterThan(favorOf(s, 'us'));
    expect(canHelp(r.state, 'us')).not.toBeNull();
    expect(jointOf(r.state).helpMs).toBeGreaterThan(s.worldMs);
  });
});
