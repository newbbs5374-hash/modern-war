import { describe, expect, it } from 'vitest';
import { claimSalary, newGame, advance, type GameState } from './state';
import { ACHIEVEMENTS, buy, canBuy, claimAch, claimDaily, goalsOf, rubyOf, trackGoals, achState, DAILY_RUBY, DAILY_BONUS_RUBY, DAILY_BONUS_BOOSTS, DAILY_COUNT, SPOILS, claimAll, claimAllPreview, SPOIL_SMALL_CAP } from './goals';
import { PAY_BUDGET_PER_SALARY, PAY_RUBY_CAP, claimPay, payPreview } from './payday';
import { DRILL_MAX, drillsNow } from './officer';

const H = 3600e3;

describe('매일 할 일 · 업적 · 루비 상점', () => {
  it('하루에 할 일 4개가 나오고, 날이 바뀌면 새로 바뀜', () => {
    let s = newGame('t', 'kr', 0, { seed: 1 });
    const g = goalsOf(s);
    expect(g.daily).toHaveLength(DAILY_COUNT);
    expect(new Set(g.daily.map((d) => d.id)).size).toBe(DAILY_COUNT);
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
    s = claimDaily(s, 3);
    expect(rubyOf(s)).toBe(DAILY_RUBY * DAILY_COUNT + DAILY_BONUS_RUBY);
    expect(s.officer.boosts).toBe(boosts + DAILY_BONUS_BOOSTS);
    expect(goalsOf(s).streak).toBe(1);
    // 두 번 못 받음
    expect(rubyOf(claimDaily(s, 0))).toBe(rubyOf(s));
    // 업적: 첫 월급날
    const a = ACHIEVEMENTS.find((x) => x.id === 'pay1')!;
    expect(achState(s, a).ready).toBe(true);
    s = claimAch(s, 'pay1');
    expect(rubyOf(s)).toBe(DAILY_RUBY * DAILY_COUNT + DAILY_BONUS_RUBY + a.ruby);
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
    expect(pv.ruby).toBe(DAILY_RUBY * DAILY_COUNT + DAILY_BONUS_RUBY + pay1 + 8);
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
    expect(sp.find((x) => x.k === 'rank')?.ruby).toBe(SPOILS.rank.ruby);
    expect(sp.find((x) => x.k === 'rank')?.boosts).toBe(SPOILS.rank.boosts);
    expect(goalsOf(t).total.star3).toBe(20);
  });

  it('봉급날: 봉급 받으면 나라 예산·루비·가속권도 함께(하루 상한)', () => {
    let s = advance(newGame('t', 'kr', 0, { seed: 1 }), 8 * H);
    const me = s.player.countryId;
    const pv = payPreview(s);
    expect(pv.salary).toBeGreaterThan(0);
    expect(pv.budget).toBe(Math.round(pv.salary * PAY_BUDGET_PER_SALARY));
    expect(pv.ruby).toBeGreaterThan(0);
    const t0 = s.nations[me].treasury;
    const r0 = rubyOf(s);
    const b0 = s.officer.boosts ?? 0;
    s = claimPay(s);
    expect(s.player.pendingSalary).toBeLessThan(1);
    expect(s.nations[me].treasury).toBeCloseTo(t0 + pv.budget);
    expect(rubyOf(s)).toBe(r0 + pv.ruby);
    expect(s.officer.boosts).toBe(b0 + pv.boosts);
    // 하루 상한
    for (let i = 0; i < 5; i++) s = claimPay(advance(s, 2 * H));
    expect(goalsOf(s).payRuby ?? 0).toBeLessThanOrEqual(PAY_RUBY_CAP);
  });

  it('시설을 올리면 전과(루비+가속권)가 쌓이고, 받으면 가속권이 늘어남', () => {
    const s = advance(newGame('t', 'kr', 0, { seed: 1 }), 2 * H);
    const id = Object.keys(s.economy.buildings)[0] as keyof typeof s.economy.buildings;
    const a = { ...s, economy: { ...s.economy, buildings: { ...s.economy.buildings, [id]: { ...s.economy.buildings[id], level: s.economy.buildings[id].level + 1 } } } };
    const t = trackGoals(s, a);
    const sp = goalsOf(t).spoils?.find((x) => x.k === 'facUp');
    expect(sp?.ruby).toBe(SPOILS.facUp.ruby);
    expect(sp?.boosts).toBe(SPOILS.facUp.boosts);
    const b0 = t.officer.boosts ?? 0;
    expect(claimAll(t).officer.boosts ?? 0).toBeGreaterThanOrEqual(b0 + 1);
  });
});

describe('모든 콘텐츠에서 전과(11-26)', () => {
  it('훈련·모집·스탯·장군·부처 업무가 전과로 쌓이고 작은 전과는 하루 상한', () => {
    const s = advance(newGame('t', 'kr', 0, { seed: 1 }), 2 * H);
    const a: GameState = {
      ...s,
      officer: { ...s.officer, mastery: { ...s.officer.mastery, 사격: (s.officer.mastery?.사격 ?? 0) + 2 }, stats: { ...s.officer.stats, 체력: s.officer.stats.체력 + 1 } },
      economy: { ...s.economy, army: { ...s.economy.army, 보병: (s.economy.army.보병 ?? 0) + 1 } },
    };
    const sp = goalsOf(trackGoals(s, a)).spoils ?? [];
    for (const k of ['train', 'recruit', 'stat'] as const) expect(sp.some((x) => x.k === k && x.ruby > 0)).toBe(true);
    // 상한
    const big: GameState = { ...a, officer: { ...a.officer, stats: { ...a.officer.stats, 체력: a.officer.stats.체력 + 500 } } };
    const sp2 = goalsOf(trackGoals(s, big)).spoils ?? [];
    expect(sp2.filter((x) => SPOILS[x.k].small).reduce((n, x) => n + x.ruby, 0)).toBeLessThanOrEqual(SPOIL_SMALL_CAP);
  });
  it('모든 탭(본부·개인·국방·외교·사회·경제·문화)에 받는 곳이 있음', () => {
    for (const w of ['본부', '개인', '국방', '외교', '사회', '경제', '문화']) expect(Object.values(SPOILS).some((x) => x.where === w && x.ruby > 0)).toBe(true);
  });
});
