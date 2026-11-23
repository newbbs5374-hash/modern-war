import { describe, expect, it } from 'vitest';
import { newGame, skip } from './state';
import { FIELDS, IMPEACH_MS, addPresMod, approvalBudgetMult, approvalTarget, fieldScore, presOf } from './approval';

const H = 3600e3;
describe('지지도·신뢰도·분야 점수', () => {
  it('분야 점수 5개는 0~100', () => {
    const s = newGame('t', 'kr', 0, { seed: 1 });
    for (const f of FIELDS) {
      const v = fieldScore(s, f.id);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(100);
    }
  });
  it('지지도는 목표 쪽으로 움직이고 기록이 쌓임', () => {
    let s = newGame('t', 'kr', 0, { seed: 2 });
    s = { ...s, pres: { ...presOf(s), approval: 5 } };
    const t = approvalTarget(s);
    s = skip(s, 6 * H);
    expect(presOf(s).approval).toBeGreaterThan(5);
    expect(presOf(s).approval).toBeLessThanOrEqual(Math.max(t, 100));
    expect(presOf(s).hist.length).toBeGreaterThan(3);
  });
  it('지지도가 높으면 국방예산이 늘고 낮으면 줄어듦', () => {
    const s = newGame('t', 'kr', 0, { seed: 3 });
    expect(approvalBudgetMult({ ...s, pres: { ...presOf(s), approval: 90 } })).toBeGreaterThan(1);
    expect(approvalBudgetMult({ ...s, pres: { ...presOf(s), approval: 10 } })).toBeLessThan(1);
  });
  it('덤은 목표에 더해짐', () => {
    const s = newGame('t', 'kr', 0, { seed: 4 });
    expect(approvalTarget(addPresMod(s, '승리', 10, 5))).toBeGreaterThan(approvalTarget(s));
  });
  it('탄핵 위기를 넘기지 못하면 한 등급 내려감', () => {
    let s = newGame('t', 'kr', 0, { seed: 5 });
    s = { ...s, player: { ...s.player, rankIndex: 3 }, pres: { ...presOf(s), approval: 0, mods: [{ why: '시험', v: -200, untilMs: 1e15 }] } };
    s = skip(s, H);
    expect(presOf(s).impeachMs).not.toBeNull();
    s = skip(s, IMPEACH_MS + H);
    expect(s.player.rankIndex).toBe(2);
  });
});
