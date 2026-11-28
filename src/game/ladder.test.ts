import { describe, expect, it } from 'vitest';
import { newGame, setRank, skip, type GameState } from './state';
import { RANKS } from '../data/ranks';
import { CB_NEED, canMobilize, canStep, cbOf, doStep, ladderTick, levelOf, mobilize, mobOf } from './ladder';
import { pairKey, relationOf } from './world';

const H = 3600e3;
const fresh = (): GameState => {
  const s = setRank(newGame('시험', 'kr', 0, { seed: 7, acts: true }), RANKS.length - 1);
  return { ...s, world: { ...s.world, act: 3 }, nations: { ...s.nations, kr: { ...s.nations.kr, treasury: 1e9 } } };
};
const tense = (s: GameState, foe: string, t: number): GameState => {
  const k = pairKey('kr', foe);
  return { ...s, world: { ...s.world, pairs: { ...s.world.pairs, [k]: { ...s.world.pairs[k], rel: '중립', tension: t } } } };
};

describe('11-28 분쟁 사다리', () => {
  it('사다리는 한 칸씩 오르고, 행동마다 명분이 쌓임', () => {
    let s = tense(fresh(), 'jp', 0);
    expect(levelOf(s, 'jp')).toBe(0);
    expect(canStep(s, 'jp', 'strike')).toContain('먼저');
    const before = cbOf(s, 'jp');
    s = doStep(s, 'jp', 'protest').state;
    expect(levelOf(s, 'jp')).toBeGreaterThanOrEqual(1);
    expect(cbOf(s, 'jp')).toBeGreaterThan(before);
    expect(canStep(s, 'jp', 'tariff')).toContain('시간');
  });

  it('명분이 모자라면 총동원 불가, 채우면 24시간 뒤 전면전', () => {
    let s = tense(fresh(), 'jp', 0);
    expect(canMobilize(s, 'jp')).toContain('명분');
    s = tense(s, 'jp', 99);
    s = { ...s, ladder: { mobs: [], cb: { jp: 40 }, last: {}, hitMe: { jp: s.worldMs } } };
    expect(cbOf(s, 'jp')).toBeGreaterThanOrEqual(CB_NEED);
    const why = canMobilize(s, 'jp');
    if (why) expect(why).toContain('지지도');
    else {
      s = mobilize(s, 'jp').state;
      expect(mobOf(s, 'kr', 'jp')).toBeTruthy();
      expect(relationOf(s.world, 'kr', 'jp')).not.toBe('전쟁');
      s = ladderTick({ ...s, worldMs: s.worldMs + 12 * H });
      expect(mobOf(s, 'kr', 'jp')!.preps.length).toBeGreaterThan(0);
      s = ladderTick({ ...s, worldMs: s.worldMs + 13 * H });
      expect(relationOf(s.world, 'kr', 'jp')).toBe('전쟁');
    }
  });

  it('24시간 건너뛰기가 돌아감', () => {
    const s = fresh();
    const after = skip(s, 24 * H);
    expect(after.worldMs).toBeGreaterThan(s.worldMs);
  });
});
