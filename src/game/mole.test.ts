import { describe, expect, it } from 'vitest';
import { newGame, type GameState } from './state';
import { domEff } from './domestic';
import { LEAK_RESEARCH, MOLE_FIRST_MS, MOLE_SPOTS, MOLE_STAY_MS, arrest, canClue, findClue, moleOf, moleTick } from './mole';

const rich = (s: GameState): GameState => ({ ...s, nations: { ...s.nations, kr: { ...s.nations.kr, treasury: 1e7 } } });
const open = () => {
  let s = rich(newGame('t', 'kr', 0, { seed: 9 }));
  s = moleTick(s);
  expect(moleOf(s).open).toBeNull();
  const base = domEff(s, 'research');
  s = moleTick({ ...s, worldMs: MOLE_FIRST_MS + 1 });
  return { s, base };
};

describe('방첩', () => {
  it('첩자가 숨어들면 연구가 샌다', () => {
    const { s, base } = open();
    expect(moleOf(s).open).not.toBeNull();
    void base;
    expect(domEff(s, 'research')).toBeCloseTo(domEff({ ...s, mole: { ...moleOf(s), open: null } }, 'research') + LEAK_RESEARCH, 5);
  });
  it('조사하면 결백한 곳이 지워지고, 끝까지 하면 한 곳만 남는다', () => {
    let { s } = open();
    for (let i = 0; i < MOLE_SPOTS.length - 1; i++) {
      expect(canClue(s)).toBeNull();
      s = findClue(s).state;
      s = { ...s, worldMs: s.worldMs + 5 * 3600e3 };
    }
    const o = moleOf(s).open!;
    expect(o.clear.length).toBe(4);
    expect(o.clear).not.toContain(o.at);
    expect(canClue(s)).not.toBeNull();
    const r = arrest(s, o.at);
    expect(r.ok).toBe(true);
    expect(moleOf(r.state).open).toBeNull();
    expect(moleOf(r.state).caught).toBe(1);
  });
  it('틀리면 신뢰도가 깎이고, 못 잡으면 달아난다', () => {
    const { s } = open();
    const o = moleOf(s).open!;
    const wrong = (o.at + 1) % MOLE_SPOTS.length;
    const r = arrest(s, wrong);
    expect(r.ok).toBe(false);
    expect(r.state.officer.trust).toBe(Math.max(0, s.officer.trust - 3));
    expect(moleOf(r.state).open!.clear).toContain(wrong);
    const gone = moleTick({ ...r.state, worldMs: s.worldMs + MOLE_STAY_MS + 1 });
    expect(moleOf(gone).open).toBeNull();
    expect(moleOf(gone).missed).toBe(1);
  });
});
