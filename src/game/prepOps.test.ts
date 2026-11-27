import { describe, expect, it } from 'vitest';
import { newGame, type GameState } from './state';
import { FRONT } from '../data/cities';
import { PREP_DIFF, PREP_MS, canPrep, doPrep, prepChance, prepDiff, prepLive } from './prepOps';

describe('사전 작전', () => {
  const s0: GameState = (() => {
    const s = newGame('t', 'kr', 0, { seed: 4 });
    return { ...s, officer: { ...s.officer, intel: 100 }, economy: { ...s.economy, stock: { ...s.economy.stock, 석유: 500 } } };
  })();
  const city = FRONT.find((c) => c.home === 'jp')!.id;
  it('확률은 15~92% 사이, 우리 도시에는 못 건다', () => {
    const c = prepChance(s0, city, 'air');
    expect(c).toBeGreaterThanOrEqual(0.15);
    expect(c).toBeLessThanOrEqual(0.92);
    expect(canPrep(s0, 'kr-0', 'air')).not.toBeNull();
  });
  it('성공하면 난이도가 내려가고 하루 뒤 사라진다. 실패하면 3시간 쉰다', () => {
    let s = s0;
    let ok = false;
    for (let i = 0; i < 40 && !ok; i++) {
      const r = doPrep(s, city, 'spec');
      s = r.state;
      ok = r.ok;
      if (!ok) {
        expect(canPrep(s, city, 'spec')).not.toBeNull();
        s = { ...s, worldMs: s.worldMs + 4 * 3600e3, officer: { ...s.officer, intel: 100 } };
      }
    }
    expect(ok).toBe(true);
    expect(prepLive(s, city)).toEqual(['spec']);
    expect(prepDiff(s, city)).toBeCloseTo(-PREP_DIFF, 5);
    expect(canPrep(s, city, 'spec')).toBe('이미 성공했어요');
    expect(prepDiff({ ...s, worldMs: s.worldMs + PREP_MS + 1 }, city)).toBeCloseTo(0, 5);
  });
  it('정보 점수가 없으면 특수 공작을 못 한다', () => {
    expect(canPrep({ ...s0, officer: { ...s0.officer, intel: 0 } }, city, 'spec')).not.toBeNull();
  });
});
