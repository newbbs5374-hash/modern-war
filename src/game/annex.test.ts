import { describe, expect, it } from 'vitest';
import { CITIES } from '../data/cities';
import { newGame, type GameState } from './state';
import { annexEntry, annexTick, canVote, doCede, isAnnexed, startVote, OK_HOURS, VOTE_HOURS } from './annex';
import { noteCapture } from './territory';
import { homeOf, incomeShare, pairKey } from './world';
import { favorOf } from './civ';

const H = 3600e3;
const city = (n: string) => CITIES.find((c) => c.name === n)!.id;

function take(s: GameState, id: string): GameState {
  const w = { ...s.world, owner: { ...s.world.owner } };
  noteCapture(w, id, s.player.countryId);
  w.owner[id] = s.player.countryId;
  return { ...s, world: w };
}
const later = (s: GameState, h: number) => ({ ...s, worldMs: s.worldMs + h * H });
function setLoyalty(s: GameState, id: string, v: number): GameState {
  const civ = s.civ!;
  const cur = civ.cities[id] ?? { loyalty: v, pop: 1, grow: 0, districts: [] };
  return { ...s, civ: { ...civ, cities: { ...civ.cities, [id]: { ...cur, loyalty: v } } } };
}

describe('점령 도시 편입', () => {
  it('군정 → 민정 → 주민투표 → 편입', () => {
    const fk = city('후쿠오카');
    let s = take(newGame('t', 'kr', 0, { seed: 3 }), fk);
    s = annexTick(s);
    expect(annexEntry(s, fk)?.stage).toBe('군정');
    expect(canVote(s, fk)).toBeTruthy();
    s = annexTick(later(s, 25));
    expect(annexEntry(s, fk)?.stage).toBe('민정');
    s = annexTick(setLoyalty(s, fk, 95));
    expect(canVote(s, fk)).toBeTruthy();
    s = annexTick(setLoyalty(later(s, OK_HOURS + 1), fk, 95));
    expect(canVote(s, fk)).toBeNull();
    const favor = favorOf(s, 'jp');
    const income = incomeShare(s.world, 'kr');
    s = startVote(s, fk);
    s = annexTick(setLoyalty(later(s, VOTE_HOURS + 1), fk, 95));
    expect(isAnnexed(s, fk)).toBe(true);
    expect(homeOf(s.world, fk)).toBe('kr');
    expect(annexEntry(s, fk)).toBeNull();
    expect(incomeShare(s.world, 'kr')).toBeGreaterThan(income);
    expect(favorOf(s, 'jp')).toBeLessThan(favor);
  });
  it('빼앗기면 편입 기록이 지워짐', () => {
    const fk = city('후쿠오카');
    let s = take(newGame('t', 'kr', 0, { seed: 3 }), fk);
    s = { ...s, world: { ...s.world, annexed: { [fk]: 'kr' } } };
    expect(homeOf(s.world, fk)).toBe('kr');
    const w = { ...s.world, owner: { ...s.world.owner } };
    noteCapture(w, fk, 'jp');
    w.owner[fk] = 'jp';
    expect(homeOf(w, fk)).toBe('jp');
  });
  it('강화 조약으로 받은 도시는 민정부터, 투표 없이 편입', () => {
    const fk = city('후쿠오카');
    let s = take(newGame('t', 'kr', 0, { seed: 3 }), fk);
    const k = pairKey('kr', 'jp');
    s = {
      ...s,
      player: { ...s.player, rankIndex: 10 },
      world: { ...s.world, pairs: { ...s.world.pairs, [k]: { ...s.world.pairs[k], rel: '전쟁', weariness: 400 } } },
    };
    let ok = false;
    for (let i = 0; i < 20 && !ok; i++) {
      const r = doCede(later(s, i * 13), 'jp', fk);
      ok = r.ok;
      if (ok) s = r.state;
    }
    expect(ok).toBe(true);
    expect(annexEntry(s, fk)?.stage).toBe('민정');
    expect(annexEntry(s, fk)?.treaty).toBe(true);
    expect(s.world.pairs[k].rel).toBe('휴전');
    s = annexTick(setLoyalty(s, fk, 95));
    s = annexTick(setLoyalty(later(s, OK_HOURS + 1), fk, 95));
    expect(isAnnexed(s, fk)).toBe(true);
  });
});
