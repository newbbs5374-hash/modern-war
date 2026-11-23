import { describe, expect, it } from 'vitest';
import { newGame, setRank, type GameState } from './state';
import { addFavorNote, civOf } from './civ';
import { canProposePeace, peaceLeft, peaceOf, peaceProgress, proposePeace, PEACE_HOLD_DAYS } from './peace';
import { checkVictory, VICTORY_RANK } from './victory';
import { COUNTRIES } from '../data/world';
import { pairKey } from './world';

const DAY = 24 * 3600e3;

function calmWorld(s: GameState): GameState {
  const pairs = { ...s.world.pairs };
  for (const c of COUNTRIES) {
    if (c.id === 'kr') continue;
    const k = pairKey('kr', c.id);
    if (pairs[k]) pairs[k] = { ...pairs[k], rel: '중립' };
  }
  return { ...s, world: { ...s.world, pairs }, nations: { ...s.nations, kr: { ...s.nations.kr, treasury: 1e7 } } };
}
function liked(s: GameState, n: number): GameState {
  let out = s;
  for (const c of COUNTRIES.filter((x) => x.id !== 'kr').slice(0, n)) out = addFavorNote(out, c.id, '시험 호감', 60);
  return out;
}
function withTech(s: GameState): GameState {
  const c = structuredClone(civOf(s));
  c.done.push('s-peace');
  return { ...s, civ: c };
}

describe('평화 승리', () => {
  it('연구·등급·전쟁 조건이 맞아야 제안할 수 있음', () => {
    let s = calmWorld(newGame('t', 'kr', 0, { seed: 4 }));
    expect(canProposePeace(s)).toMatch(/연구/);
    s = withTech(s);
    expect(canProposePeace(s)).toBeNull();
  });

  it('서명이 모자라면 부결, 2/3 넘으면 헌장 시작 → 7일 지키면 평화 승리', () => {
    let s = setRank(withTech(calmWorld(newGame('t', 'kr', 0, { seed: 5 }))), VICTORY_RANK);
    s = proposePeace(s);
    expect(peaceOf(s).sinceMs).toBeNull();
    expect(peaceOf(s).last).toMatch(/부결/);
    expect(canProposePeace(s)).toMatch(/잠시/);
    s = { ...s, worldMs: s.worldMs + 13 * 3600e3 };
    s = liked(s, 12);
    const pr = peaceProgress(s);
    expect(pr.have).toBeGreaterThanOrEqual(pr.need);
    s = proposePeace(s);
    expect(peaceOf(s).sinceMs).not.toBeNull();
    expect(peaceLeft(s)).toBe(PEACE_HOLD_DAYS * DAY);
    s = checkVictory({ ...s, worldMs: s.worldMs + 3 * DAY });
    expect(s.ending).toBeNull();
    s = checkVictory({ ...s, worldMs: s.worldMs + 4 * DAY + 1 });
    expect(s.ending?.kind).toBe('평화 승리');
  });

  it('헌장 중 전쟁에 휘말리면 깨짐', () => {
    let s = liked(setRank(withTech(calmWorld(newGame('t', 'kr', 0, { seed: 6 }))), VICTORY_RANK), 12);
    s = proposePeace(s);
    expect(peaceOf(s).sinceMs).not.toBeNull();
    const k = pairKey('kr', 'kp');
    s = { ...s, world: { ...s.world, pairs: { ...s.world.pairs, [k]: { ...s.world.pairs[k], rel: '전쟁' } } } };
    s = checkVictory(s);
    expect(peaceOf(s).sinceMs).toBeNull();
    expect(peaceOf(s).last).toMatch(/깨졌/);
  });
});
