import { describe, expect, it } from 'vitest';
import { advance, newGame, setRank, type GameState } from './state';
import { COUNTRIES } from '../data/world';
import { pairKey } from './world';
import { VENUE_IDS } from '../data/culture';
import {
  addWork, canHost, canUpgrade, cultureOf, cultureProgress, cultureTick, hostEvent, signPact, tourismPerHour, upgradeVenue,
} from './culture';
import { checkVictory, VICTORY_RANK } from './victory';

const H = 3600e3;
const DAY = 24 * H;

function rich(s: GameState): GameState {
  const stock = { ...s.economy.stock };
  for (const k of Object.keys(stock)) stock[k as keyof typeof stock] = 999;
  return { ...s, nations: { ...s.nations, kr: { ...s.nations.kr, treasury: 1e7 } }, economy: { ...s.economy, stock } };
}
function calm(s: GameState): GameState {
  const pairs = { ...s.world.pairs };
  for (const c of COUNTRIES) {
    if (c.id === 'kr') continue;
    const k = pairKey('kr', c.id);
    if (pairs[k]) pairs[k] = { ...pairs[k], rel: '중립' };
  }
  return { ...s, world: { ...s.world, pairs } };
}
/** 시간만 흐르게(세계 AI 없이) */
const pass = (s: GameState, ms: number) => cultureTick({ ...s, worldMs: s.worldMs + ms });

describe('문화', () => {
  it('시설을 짓고 시간이 지나면 완공된다', () => {
    let s = rich(newGame('테스트', 'kr', 0));
    expect(canUpgrade(s, 'museum')).toBeNull();
    s = upgradeVenue(s, 'museum');
    expect(cultureOf(s).builds.length).toBe(1);
    s = pass(s, 1 * H);
    expect(cultureOf(s).venues.museum).toBe(0);
    s = pass(s, 1.5 * H);
    expect(cultureOf(s).venues.museum).toBe(1);
    expect(cultureOf(s).points).toBeGreaterThan(0);
  });

  it('돈이 모자라거나 공사 팀이 다 차면 못 짓는다', () => {
    let s = newGame('테스트', 'kr', 0);
    s = { ...s, nations: { ...s.nations, kr: { ...s.nations.kr, treasury: 0 } } };
    expect(canUpgrade(s, 'museum')).toMatch(/국방예산/);
    s = rich(s);
    s = upgradeVenue(upgradeVenue(s, 'museum'), 'stage');
    expect(canUpgrade(s, 'park')).toMatch(/공사 팀/);
  });

  it('걸작은 시설 단계만큼 칸이 있고 문화 점수를 쓴다', () => {
    let s = rich(newGame('테스트', 'kr', 0));
    s = pass(upgradeVenue(s, 'museum'), 3 * H);
    s = { ...s, culture: { ...cultureOf(s), points: 1000 } };
    s = addWork(s, 'relic');
    expect(cultureOf(s).works.relic.length).toBe(1);
    s = addWork(s, 'relic');
    expect(cultureOf(s).works.relic.length).toBe(1); // 박물관 1단계 = 1칸
    expect(cultureOf(s).points).toBe(880);
  });

  it('관광은 다른 나라에 영향력으로 쌓이고, 전쟁 중인 나라엔 안 퍼진다', () => {
    let s = calm(rich(newGame('테스트', 'kr', 0)));
    s = { ...s, culture: { ...cultureOf(s), venues: { museum: 3, stage: 3, stadium: 3, studio: 3, park: 3, heritage: 3 } } };
    const war = pairKey('kr', 'kp');
    s = { ...s, world: { ...s.world, pairs: { ...s.world.pairs, [war]: { ...s.world.pairs[war], rel: '전쟁' } } } };
    expect(tourismPerHour(s)).toBeGreaterThan(0);
    s = pass(s, 10 * H);
    expect(cultureOf(s).infl.jp).toBeGreaterThan(0);
    expect(cultureOf(s).infl.kp).toBe(0);
  });

  it('협약 나라에는 더 많이 퍼진다', () => {
    let s = calm(rich(newGame('테스트', 'kr', 0)));
    s = { ...s, culture: { ...cultureOf(s), venues: { museum: 2, stage: 2, stadium: 2, studio: 2, park: 2, heritage: 2 } } };
    s = signPact(s, 'jp');
    s = pass(s, 10 * H);
    expect(cultureOf(s).infl.jp).toBeGreaterThan(cultureOf(s).infl.uk * 1.4);
  });

  it('행사: 조건이 되면 열고, 끝나면 보상과 쉬는 시간', () => {
    let s = calm(rich(newGame('테스트', 'kr', 0)));
    expect(canHost(s, 'exhibit')).toMatch(/박물관/);
    s = { ...s, culture: { ...cultureOf(s), venues: { ...cultureOf(s).venues, museum: 2 } } };
    expect(canHost(s, 'exhibit')).toBeNull();
    s = hostEvent(s, 'exhibit');
    const before = cultureOf(s).points;
    s = pass(s, 7 * H);
    expect(cultureOf(s).event).toBeNull();
    expect(cultureOf(s).points).toBeGreaterThan(before + 150);
    expect(canHost(s, 'exhibit')).toMatch(/준비/);
  });

  it('문화 승리: 2/3 우세 + 5단계 2곳 + 최고 등급을 7일 지키면 이김', () => {
    let s = calm(rich(setRank(newGame('테스트', 'kr', 0), VICTORY_RANK)));
    const c = cultureOf(s);
    const infl = Object.fromEntries(Object.keys(c.infl).map((k) => [k, 1e9]));
    s = { ...s, culture: { ...c, infl, venues: { ...c.venues, museum: 5, stage: 5 } } };
    expect(cultureProgress(s).have).toBeGreaterThanOrEqual(cultureProgress(s).need);
    s = checkVictory(s);
    expect(cultureOf(s).winSinceMs).not.toBeNull();
    s = checkVictory(pass(s, 3 * DAY));
    expect(s.ending).toBeNull();
    s = checkVictory(pass(s, 4.1 * DAY));
    expect(s.ending?.kind).toBe('문화 승리');
  });

  it('문화를 안 키우면 우세가 되지 않는다(60일)', () => {
    let s = calm(newGame('테스트', 'kr', 0));
    s = pass(s, 60 * DAY);
    expect(cultureProgress(s).have).toBe(0);
  });

  it('시설을 다 키워도 하루 만에 이기지 못한다(밸런스)', () => {
    let s = calm(rich(newGame('테스트', 'kr', 0)));
    const max = Object.fromEntries(VENUE_IDS.map((v) => [v, 5])) as Record<(typeof VENUE_IDS)[number], number>;
    s = { ...s, culture: { ...cultureOf(s), venues: max } };
    s = pass(s, 2 * DAY);
    expect(cultureProgress(s).have).toBeLessThan(cultureProgress(s).need);
    s = pass(s, 40 * DAY);
    expect(cultureProgress(s).have).toBeGreaterThanOrEqual(cultureProgress(s).need);
  });

  it('게임 시간 흐름(advance)에 붙어 있다', () => {
    let s = rich(newGame('테스트', 'kr', 0));
    s = upgradeVenue(s, 'museum');
    s = advance(s, 3 * H);
    expect(cultureOf(s).venues.museum).toBe(1);
  });
});
