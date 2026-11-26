import { describe, expect, it } from 'vitest';
import { FRONT } from '../data/cities';
import { advance, budgetPerDay, newGame, type GameState } from './state';
import { doDiplo, canDiplo } from './command';
import { acceptSurrender, canAccept, canSurrender, doDemand, doSurrender, lordOf, surrenderTick, vassalsOf } from './surrender';
import { pairKey, relationOf } from './world';

const H = 3600e3;
function war(s: GameState, a: string, b: string): GameState {
  const k = pairKey(a, b);
  return { ...s, world: { ...s.world, pairs: { ...s.world.pairs, [k]: { ...s.world.pairs[k], rel: '전쟁', tension: 0, weariness: 50 } } } };
}
/** b의 점령 도시를 a가 반 넘게 차지 */
function crush(s: GameState, a: string, b: string): GameState {
  const owner = { ...s.world.owner };
  const fr = FRONT.filter((c) => c.home === b);
  for (const c of fr.slice(1, fr.length)) owner[c.id] = a;
  return { ...s, world: { ...s.world, owner }, nations: { ...s.nations, [b]: { ...s.nations[b], troops: 1000 } } };
}

describe('속국 항복(11-26)', () => {
  it('내 나라 항복: 전쟁이 끝나고 연합(속국), 공물로 예산이 줄고, 연합 깨기는 막히고 선전포고로 독립', () => {
    let s = war(newGame('t', 'kr', 0, { seed: 1 }), 'kr', 'cn');
    const before = budgetPerDay(s, 'kr');
    const cnBefore = budgetPerDay(s, 'cn');
    expect(canSurrender(s, 'cn')).toBeNull();
    s = doSurrender(s, 'cn').state;
    expect(lordOf(s, 'kr')).toBe('cn');
    expect(relationOf(s.world, 'kr', 'cn')).toBe('연합');
    expect(budgetPerDay(s, 'kr')).toBeCloseTo(before * 0.7, 3);
    expect(budgetPerDay(s, 'cn')).toBeGreaterThan(cnBefore);
    expect(canDiplo(s, 'cn', '연합 깨기')).toMatch(/독립 전쟁/);
    const r = doDiplo(s, 'cn', '선전포고');
    expect(r.text).toContain('독립 전쟁');
    expect(lordOf(r.state, 'kr')).toBeNull();
    expect(relationOf(r.state.world, 'kr', 'cn')).toBe('전쟁');
  });
  it('지는 AI는 나에게 항복을 제안하고, 받으면 속국', () => {
    let s = crush(war(newGame('t', 'kr', 0, { seed: 2 }), 'kr', 'jp'), 'kr', 'jp');
    for (let i = 0; i < 400 && canAccept(s, 'jp'); i++) s = surrenderTick({ ...s, worldMs: s.worldMs + 15 * 60e3 });
    expect(canAccept(s, 'jp')).toBeNull();
    s = acceptSurrender(s, 'jp').state;
    expect(vassalsOf(s, 'kr')).toEqual(['jp']);
    expect(relationOf(s.world, 'kr', 'jp')).toBe('연합');
  });
  it('AI끼리는 저절로 항복', () => {
    let s = crush(war(newGame('t', 'kr', 0, { seed: 3 }), 'cn', 'in'), 'cn', 'in');
    for (let i = 0; i < 400 && !lordOf(s, 'in'); i++) s = surrenderTick({ ...s, worldMs: s.worldMs + 15 * 60e3 });
    expect(lordOf(s, 'in')).toBe('cn');
  });
  it('항복 요구: 실패하면 대기, 전쟁 중일 때만', () => {
    let s = crush(war(newGame('t', 'kr', 0, { seed: 4 }), 'kr', 'kp'), 'kr', 'kp');
    s = doDemand(s, 'kp').state;
    if (!lordOf(s, 'kp')) expect(doDemand(s, 'kp').state).toBe(s);
    expect(doDemand(newGame('t', 'kr', 0), 'us').text).toBe('');
  });
  it('세계가 흘러도 망가지지 않음', () => {
    const s = advance(newGame('t', 'kr', 0, { seed: 5 }), 3 * 24 * H);
    for (const [v, l] of Object.entries(s.vassal?.lord ?? {})) expect(relationOf(s.world, v, l)).toBe('연합');
  });
});
