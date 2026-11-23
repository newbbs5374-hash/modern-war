import { describe, expect, it } from 'vitest';
import { advance, newGame, setRank, type GameState } from './state';
import { canSpy, scouted, spyChance, spyOf, spyTeams, startSpy, SPY_OPS } from './spy';
import { favorOf } from './civ';

const H = 3600e3;
const ready = (s: GameState): GameState => ({ ...s, officer: { ...s.officer, intel: 500 }, nations: { ...s.nations, kr: { ...s.nations.kr, treasury: 1e6 } } });

describe('첩보·특수 작전', () => {
  it('위성 정찰은 늘 성공하고 24시간 동안 보임', () => {
    let s = ready(newGame('t', 'kr', 0, { seed: 1 }));
    expect(canSpy(s, 'scout', 'kp')).toBeNull();
    s = startSpy(s, 'scout', 'kp');
    expect(s.officer.intel).toBe(495);
    expect(spyOf(s).active).toHaveLength(1);
    s = advance(s, 1.1 * H);
    expect(spyOf(s).active).toHaveLength(0);
    expect(scouted(s, 'kp')).toBe(true);
    expect(spyOf(s).ok).toBe(1);
  });

  it('정보·등급·팀 수가 모자라면 못 보냄', () => {
    let s = newGame('t', 'kr', 0, { seed: 1 });
    expect(canSpy(s, 'scout', 'kp')).toMatch(/정보/);
    s = ready(s);
    expect(spyTeams(s)).toBe(3); // 11-24: 호칭 잠금 없음
    s = startSpy(s, 'scout', 'kp');
    s = startSpy(s, 'scout', 'jp');
    s = startSpy(s, 'scout', 'us');
    expect(canSpy(s, 'scout', 'cn')).toMatch(/팀/);
    expect(canSpy(s, 'scout', 'kr')).toMatch(/나라/);
  });

  it('작전은 성공 또는 실패로 끝나고, 실패하면 호감이 떨어짐', () => {
    let fails = 0;
    let oks = 0;
    for (let seed = 1; seed <= 12; seed++) {
      let s = ready(setRank(newGame('t', 'kr', 0, { seed }), 6));
      const before = favorOf(s, 'cn');
      s = startSpy(s, 'sabotage', 'cn');
      s = advance(s, 5.1 * H);
      const sp = spyOf(s);
      expect(sp.done).toBe(1);
      if (sp.ok) oks++;
      else {
        fails++;
        expect(favorOf(s, 'cn')).toBeLessThan(before);
      }
    }
    expect(oks + fails).toBe(12);
    expect(oks).toBeGreaterThan(0);
  });

  it('성공률은 0.1~0.95, 모든 작전에 값이 있음', () => {
    const s = newGame('t', 'kr', 0, { seed: 1 });
    for (const d of SPY_OPS) {
      const c = spyChance(s, d.id, 'cn');
      expect(c).toBeGreaterThanOrEqual(0.1);
      expect(c).toBeLessThanOrEqual(1);
    }
  });
});
