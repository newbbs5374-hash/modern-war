import { describe, expect, it } from 'vitest';
import { claimSalary, newGame, advance, type GameState } from './state';
import { ACHIEVEMENTS, buy, canBuy, claimAch, claimDaily, goalsOf, rubyOf, trackGoals, achState, DAILY_RUBY, DAILY_BONUS_RUBY, claimAll, claimAllPreview, SPOIL_SMALL_CAP } from './goals';
import { DRILL_MAX, drillsNow } from './officer';

const H = 3600e3;

describe('매일 할 일 · 업적 · 루비 상점', () => {
  it('하루에 할 일 3개가 나오고, 날이 바뀌면 새로 바뀜', () => {
    let s = newGame('t', 'kr', 0, { seed: 1 });
    const g = goalsOf(s);
    expect(g.daily).toHaveLength(3);
    expect(new Set(g.daily.map((d) => d.id)).size).toBe(3);
    const b = advance(s, 25 * H);
    s = trackGoals(s, b);
    expect(goalsOf(s).day).toBe(1);
  });

  it('봉급 받기를 세고, 다 하면 루비를 받음 · 3개 다 하면 보너스', () => {
    let s = advance(newGame('t', 'kr', 0, { seed: 1 }), 2 * H);
    s = { ...s, goals: { ...goalsOf(s), daily: goalsOf(s).daily.map((d, i) => (i === 0 ? { id: 'salary', need: 1, have: 0, claimed: false } : { ...d, have: d.need })) } };
    const b = s;
    s = trackGoals(b, claimSalary(b));
    expect(goalsOf(s).daily[0].have).toBe(1);
    expect(goalsOf(s).total.salary).toBe(1);
    const boosts = s.officer.boosts ?? 0;
    s = claimDaily(s, 0);
    s = claimDaily(s, 1);
    s = claimDaily(s, 2);
    expect(rubyOf(s)).toBe(DAILY_RUBY * 3 + DAILY_BONUS_RUBY);
    expect(s.officer.boosts).toBe(boosts + 2);
    expect(goalsOf(s).streak).toBe(1);
    // 두 번 못 받음
    expect(rubyOf(claimDaily(s, 0))).toBe(rubyOf(s));
    // 업적: 첫 월급날
    const a = ACHIEVEMENTS.find((x) => x.id === 'pay1')!;
    expect(achState(s, a).ready).toBe(true);
    s = claimAch(s, 'pay1');
    expect(rubyOf(s)).toBe(DAILY_RUBY * 3 + DAILY_BONUS_RUBY + a.ruby);
    expect(achState(s, a).ready).toBe(false);
  });

  it('상점: 루비가 모자라면 못 사고, 사면 루비가 줄고 물건이 들어옴', () => {
    let s: GameState = newGame('t', 'kr', 0, { seed: 1 });
    expect(canBuy(s, 'boost10')).toMatch(/루비/);
    s = { ...s, goals: { ...goalsOf(s), ruby: 100 } };
    const b0 = s.officer.boosts ?? 0;
    s = buy(s, 'boost10');
    expect(rubyOf(s)).toBe(55);
    expect(s.officer.boosts).toBe(b0 + 10);
    // 훈련 일정이 가득하면 못 삼
    expect(drillsNow(s.officer, s.worldMs).count).toBe(DRILL_MAX);
    expect(canBuy(s, 'drill')).toMatch(/가득/);
    s = { ...s, officer: { ...s.officer, drills: 2, drillAnchorMs: s.worldMs } };
    s = buy(s, 'drill');
    expect(drillsNow(s.officer, s.worldMs).count).toBe(3);
    const steel = s.economy.stock['강철'];
    s = buy(s, 'res');
    expect(s.economy.stock['강철']).toBe(steel + 100);
  });

  it('모두받기: 다 한 할 일·업적·전과를 한 번에 받음', () => {
    let s = advance(newGame('t', 'kr', 0, { seed: 1 }), 2 * H);
    const g = goalsOf(s);
    s = { ...s, goals: { ...g, daily: g.daily.map((d) => ({ ...d, have: d.need })), total: { salary: 1 }, spoils: [{ k: 'capture', n: 1, ruby: 8 }] } };
    const pv = claimAllPreview(s);
    const pay1 = ACHIEVEMENTS.find((x) => x.id === 'pay1')!.ruby;
    expect(pv.ruby).toBe(DAILY_RUBY * 3 + DAILY_BONUS_RUBY + pay1 + 8);
    const a = claimAll(s);
    expect(rubyOf(a)).toBe(pv.ruby);
    expect(goalsOf(a).spoils).toEqual([]);
    expect(claimAllPreview(a).ruby).toBe(0);
  });

  it('전과 루비: 훈련 별 3개·전투 승리는 하루 상한, 등급은 그대로', () => {
    const s = advance(newGame('t', 'kr', 0, { seed: 1 }), 2 * H);
    const a = { ...s, officer: { ...s.officer, perfect: { 사격: 20 }, totalMerit: s.officer.totalMerit + 10 }, player: { ...s.player, title: (s.player.title ?? 0) + 1 } };
    const t = trackGoals(s, a);
    const sp = goalsOf(t).spoils ?? [];
    const small = sp.filter((x) => x.k === 'star3' || x.k === 'merit').reduce((x, y) => x + y.ruby, 0);
    expect(small).toBe(SPOIL_SMALL_CAP);
    expect(sp.find((x) => x.k === 'rank')?.ruby).toBe(10);
    expect(goalsOf(t).total.star3).toBe(20);
  });
});
