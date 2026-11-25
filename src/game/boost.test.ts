import { describe, expect, test } from 'vitest';
import { newGame } from './state';
import { BOOST_MS, RUBY_PER_BOOST, TEST_BOOSTS, boostLeft, boostsOf, boostsToFinish, useBoost } from './boost';
import { boardNow, debugAddAide, sendAide, startMission } from './officer';

describe('가속권', () => {
  test('새 판은 시험용 가속권을 넉넉히 받음', () => {
    expect(boostsOf(newGame('t', 'kr', 0, { seed: 1 }))).toBe(TEST_BOOSTS);
  });
  test('임무: 한 장에 30분, 바로 끝내기는 필요한 만큼만 씀', () => {
    let s = newGame('t', 'kr', 0, { seed: 1 });
    const b = boardNow(s);
    s = startMission(b.state, b.state.officer.board[0].id);
    const left = boostLeft(s, { kind: 'mission' });
    expect(left).toBeGreaterThan(0);
    const one = useBoost(s, { kind: 'mission' }, 1);
    expect(boostLeft(one, { kind: 'mission' })).toBe(left - BOOST_MS);
    expect(boostsOf(one)).toBe(TEST_BOOSTS - 1);
    const need = boostsToFinish(s, { kind: 'mission' });
    const all = useBoost(s, { kind: 'mission' }, 999);
    expect(boostLeft(all, { kind: 'mission' })).toBe(0);
    expect(boostsOf(all)).toBe(TEST_BOOSTS - need);
    expect(useBoost(all, { kind: 'mission' }, 1)).toBe(all); // 끝난 건 안 씀
  });
  test('부관 심부름도 줄어듦', () => {
    let s = debugAddAide(newGame('t', 'kr', 0, { seed: 3 }));
    const id = s.officer.aides[0].id;
    s = sendAide(s, id, '전공 쌓기');
    const t = { kind: 'errand', id } as const;
    expect(boostLeft(useBoost(s, t, 999), t)).toBe(0);
  });
});

describe('가속 버튼 넓히기(11-24)', () => {
  test('연구: 30분치 점수가 들어가고, 바로 끝내기는 3단계 모두 끝냄', async () => {
    const { startResearch, civOf, hasTech } = await import('./civ');
    const { TECHS } = await import('../data/civ');
    let s = newGame('t', 'kr', 0, { seed: 1 });
    const t = TECHS.find((x) => x.line === 'mil' && !x.needs.length)!;
    s = startResearch(s, t.id);
    const tg = { kind: 'research', line: 'mil' } as const;
    const left = boostLeft(s, tg);
    expect(left).toBeGreaterThan(BOOST_MS);
    const one = useBoost(s, tg, 1);
    expect(Math.abs(boostLeft(one, tg) - (left - BOOST_MS))).toBeLessThan(1000);
    const all = useBoost(s, tg, 999);
    expect(hasTech(all, t.id)).toBe(true);
    expect(civOf(all).cur.mil).toBe(null);
    expect(boostsOf(all)).toBe(TEST_BOOSTS - boostsToFinish(s, tg));
  });
  test('가속권이 없으면 루비로(1장 = 💎5), 둘 다 없으면 안 됨', () => {
    let s = newGame('t', 'kr', 0, { seed: 1 });
    const b = boardNow(s);
    s = startMission(b.state, b.state.officer.board[0].id);
    s = { ...s, officer: { ...s.officer, boosts: 0 }, goals: { ...s.goals!, ruby: 12 } };
    const left = boostLeft(s, { kind: 'mission' });
    const one = useBoost(s, { kind: 'mission' }, 999);
    expect(one.goals!.ruby).toBe(12 - 2 * RUBY_PER_BOOST);
    expect(boostLeft(one, { kind: 'mission' })).toBe(Math.max(0, left - 2 * BOOST_MS));
    const none = { ...s, goals: { ...s.goals!, ruby: 4 } };
    expect(useBoost(none, { kind: 'mission' }, 1)).toBe(none);
  });
  test('문화 시설·첩보 공작도 바로 끝남', async () => {
    const { upgradeVenue, cultureOf } = await import('./culture');
    const { VENUES } = await import('../data/culture');
    let s = newGame('t', 'kr', 0, { seed: 2 });
    s = { ...s, culture: cultureOf(s) };
    const v = VENUES[0].id;
    s = upgradeVenue(s, v);
    if (cultureOf(s).builds.length) {
      const tg = { kind: 'venue', venue: v } as const;
      expect(boostLeft(s, tg)).toBeGreaterThan(0);
      expect(boostLeft(useBoost(s, tg, 999), tg)).toBe(0);
    }
    s = { ...s, spy: { active: [{ id: 1, op: 'sabotage', target: 'cn', startMs: s.worldMs, endMs: s.worldMs + 5 * 3600e3 }], scout: {}, log: [], nextId: 2, done: 0, ok: 0 } };
    const sp = { kind: 'spy', id: 1 } as const;
    expect(boostsToFinish(s, sp)).toBe(10);
    expect(boostLeft(useBoost(s, sp, 999), sp)).toBe(0);
  });
});

describe('카드 안 가속(11-24)', () => {
  test('체제 혼란도 가속권으로 줄이고 바로 끝냄', async () => {
    const { civOf, chaos } = await import('./civ');
    let s = newGame('t', 'kr', 0, { seed: 1 });
    s = { ...s, civ: { ...civOf(s), chaosUntil: s.worldMs + 24 * 3600e3 } };
    const tg = { kind: 'chaos' } as const;
    expect(boostLeft(s, tg)).toBe(24 * 3600e3);
    expect(boostLeft(useBoost(s, tg, 1), tg)).toBe(24 * 3600e3 - BOOST_MS);
    const all = useBoost(s, tg, 999);
    expect(chaos(all)).toBe(false);
    expect(boostsOf(all)).toBe(TEST_BOOSTS - 48);
  });
});

describe('모든 카드 안 가속(11-25)', () => {
  test('연구 트리: 연구 중이 아닌 카드도 바로 끝내고, 하던 연구는 그대로', async () => {
    const { startResearch, civOf, hasTech } = await import('./civ');
    const { TECHS } = await import('../data/civ');
    let s = newGame('t', 'kr', 0, { seed: 1 });
    const [a, b] = TECHS.filter((x) => x.line === 'mil' && !x.needs.length);
    s = startResearch(s, a.id);
    const tg = { kind: 'tech', id: b.id } as const;
    expect(boostLeft(s, tg)).toBeGreaterThan(0);
    const one = useBoost(s, tg, 1);
    expect(civOf(one).cur.mil).toBe(a.id);
    expect(boostLeft(one, tg)).toBeLessThan(boostLeft(s, tg));
    const all = useBoost(s, tg, 999);
    expect(hasTech(all, b.id)).toBe(true);
    expect(civOf(all).cur.mil).toBe(a.id);
    expect(hasTech(all, a.id)).toBe(false);
  });
  test('시설: 시작하고 바로 끝내기 · 모자라면 시작도 안 함', async () => {
    const { startAndFinish } = await import('./boost');
    const { upgradeFacility, canUpgrade, economyTick } = await import('./economy');
    const { BUILDING_IDS } = await import('../data/economy');
    let s = { ...newGame('t', 'kr', 0, { seed: 1 }), worldMs: 3600e3 };
    s = { ...s, economy: { ...s.economy, facilities: Object.fromEntries(Object.entries(s.economy.facilities).map(([k, v]) => [k, { ...v, exp: 1e6 }])) as typeof s.economy.facilities } };
    const id = BUILDING_IDS.find((x) => !canUpgrade(s, x))!;
    expect(id).toBeTruthy();
    const lv = s.economy.buildings[id].level;
    const tg = { kind: 'build', fac: id } as const;
    const done = startAndFinish(s, (x) => upgradeFacility(x, id), tg);
    expect(boostLeft(done, tg)).toBe(0);
    expect(economyTick(done).economy.buildings[id].level).toBe(lv + 1);
    const poor = { ...s, officer: { ...s.officer, boosts: 0 }, goals: { ...s.goals!, ruby: 0 } };
    expect(startAndFinish(poor, (x) => upgradeFacility(x, id), tg)).toBe(poor);
  });
  test('정책 카드: 다음 무료 바꾸기까지 줄이기', async () => {
    const { civOf, swapCost } = await import('./civ');
    let s = newGame('t', 'kr', 0, { seed: 1 });
    const c = civOf(s);
    s = { ...s, civ: { ...c, cards: ['x', null], lastSwapMs: s.worldMs - 3600e3 } } as typeof s;
    const tg = { kind: 'swap' } as const;
    expect(boostsToFinish(s, tg)).toBe(46);
    const all = useBoost(s, tg, 999);
    expect(boostLeft(all, tg)).toBe(0);
    expect(swapCost(all)).toBe(0);
  });
});
