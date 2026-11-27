import { describe, expect, it } from 'vitest';
import { newGame, type GameState } from './state';
import { domEff } from './domestic';
import { goalsOf } from './goals';
import { WC_FIRST_MS, WC_GIVE_MAX, WC_GIVE_PTS, WC_OPEN_MS, WC_RUBY, canGive, give, pickSide, wcById, wcOf, wcTick } from './worldCrisis';

const start = (): GameState => {
  let s = newGame('t', 'kr', 0, { seed: 14 });
  s = { ...s, nations: { ...s.nations, kr: { ...s.nations.kr, treasury: 1e8 } } };
  s = wcTick(s);
  expect(wcOf(s).open).toBeNull();
  return wcTick({ ...s, worldMs: WC_FIRST_MS + 1 });
};
describe('주간 세계 위기', () => {
  it('열리면 모든 나라가 두 편으로 갈린다', () => {
    const s = start();
    const o = wcOf(s).open!;
    expect(o).toBeTruthy();
    expect(o.a.length + o.b.length).toBeGreaterThan(10);
    expect(o.a.some((x) => o.b.includes(x))).toBe(false);
    expect(o.a).not.toContain('kr');
  });
  it('편을 정해야 힘을 보탤 수 있고 3번까지', () => {
    let s = start();
    expect(canGive(s)).not.toBeNull();
    s = pickSide(s, 'b');
    const pb = wcOf(s).open!.pb;
    for (let i = 0; i < WC_GIVE_MAX; i++) s = give(s);
    expect(wcOf(s).open!.pb).toBeCloseTo(pb + WC_GIVE_PTS * WC_GIVE_MAX, 5);
    expect(canGive(s)).not.toBeNull();
  });
  it('이긴 편에 섰으면 루비와 일주일 효과, 진 편이면 손해, 중립이면 없음', () => {
    let s = start();
    const o = wcOf(s).open!;
    const win = o.pa >= o.pb ? 'a' : 'b';
    const d = wcById(o.def);
    const ruby = goalsOf(s).ruby;
    const won = wcTick({ ...pickSide(s, win), worldMs: s.worldMs + WC_OPEN_MS + 1 });
    expect(wcOf(won).open).toBeNull();
    expect(wcOf(won).last?.mine).toBe(1);
    expect(goalsOf(won).ruby).toBe(ruby + WC_RUBY);
    const base = domEff({ ...won, wcrisis: { ...wcOf(won), last: undefined } }, d.key);
    expect(domEff(won, d.key)).toBeCloseTo(base + d.v, 5);
    const lost = wcTick({ ...pickSide(s, win === 'a' ? 'b' : 'a'), worldMs: s.worldMs + WC_OPEN_MS + 1 });
    expect(wcOf(lost).last?.mine).toBe(-1);
    s = wcTick({ ...pickSide(s, 'n'), worldMs: s.worldMs + WC_OPEN_MS + 1 });
    expect(wcOf(s).last?.mine).toBe(0);
  });
});
