import { describe, expect, it } from 'vitest';
import { advance, newGame, setRank, type GameState } from './state';
import { COUNTRIES } from '../data/world';
import { pairKey } from './world';
import { CREATE_HOURS, VENUE_IDS, WORKS } from '../data/culture';
import {
  addWork, canAddWork, canCreate, canOpenCourse, canRecruit, openCourse, recruitStar, starsOf, talentPerHour, worksPower, canHost, canUpgrade, cultureOf, cultureProgress, cultureTick, hostEvent, signPact, tourismPerHour, upgradeVenue,
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

  it('걸작은 스타가 만들고, 시설 단계만큼 칸이 있고, 시간이 지나면 등급이 정해진다', () => {
    let s = rich(newGame('테스트', 'kr', 0));
    s = pass(upgradeVenue(s, 'museum'), 3 * H);
    s = { ...s, culture: { ...cultureOf(s), points: 1000 } };
    expect(canAddWork(s, 'relic')).toMatch(/고고학자/);
    // 감독은 방송·영화가 없어서 못 데려옴, 첫 고고학자는 박물관만 있으면 바로
    expect(canRecruit(s, 'director')).toMatch(/방송/);
    expect(canRecruit(s, 'arch')).toBeNull();
    s = recruitStar(s, 'arch');
    // 두 번째는 인재 점수 40 — 모자라면 돈으로 채워 바로
    expect(canRecruit(s, 'arch')).toMatch(/모자람/);
    const money = s.nations.kr.treasury;
    const s2 = recruitStar(s, 'arch', true);
    expect(starsOf(cultureOf(s2)).length).toBe(2);
    expect(s2.nations.kr.treasury).toBeLessThan(money);
    const star = starsOf(cultureOf(s))[0];
    expect(star.kind).toBe('arch');
    s = addWork(s, 'relic');
    expect(cultureOf(s).points).toBe(880);
    expect(starsOf(cultureOf(s))[0].job).toBeTruthy();
    expect(canCreate(s, star.id)).toMatch(/만드는 중/);
    s = pass(s, CREATE_HOURS.relic * H + 1000);
    const c = cultureOf(s);
    expect(c.works.relic.length).toBe(1);
    expect(starsOf(c)[0].made).toBe(1);
    expect(starsOf(c)[0].job).toBeFalsy();
    expect(WORKS.find((w) => w.name === c.works.relic[0])).toBeTruthy();
    // 박물관 1단계 = 1칸
    expect(canCreate(s, star.id)).toMatch(/칸이 다 찼/);
  });

  it('시설이 인재 점수를 모으고, 관광 코스는 조건·자리·돈을 본다', () => {
    let s = rich(newGame('테스트', 'kr', 0));
    s = { ...s, culture: { ...cultureOf(s), venues: { museum: 2, stage: 0, stadium: 0, studio: 0, park: 0, heritage: 2 } } };
    expect(talentPerHour(s, 'arch')).toBe(5);
    s = pass(s, 10 * H);
    expect(cultureOf(s).talent?.arch).toBeCloseTo(50);
    expect(canRecruit(s, 'arch')).toBeNull();
    const t0 = tourismPerHour(s);
    expect(canOpenCourse(s, 'stage')).toMatch(/공연장/);
    expect(canOpenCourse(s, 'history')).toBeNull();
    s = openCourse(s, 'history');
    expect(tourismPerHour(s)).toBeCloseTo(t0 * 1.15);
    expect(canOpenCourse(s, 'history')).toMatch(/이미/);
  });

  it('전설 걸작·테마 전시는 효과가 더 크다', () => {
    let s = rich(newGame('테스트', 'kr', 0));
    s = { ...s, culture: { ...cultureOf(s), venues: { museum: 3, stage: 0, stadium: 0, studio: 0, park: 0, heritage: 0 }, works: { relic: ['청동 투구', '왕실 도장'], show: [], hit: [] } } };
    const a = worksPower(cultureOf(s)).tour;
    expect(a).toBe(2);
    s = { ...s, culture: { ...cultureOf(s), works: { relic: ['청동 투구', '왕실 도장', '고대 왕관'], show: [], hit: [] } } };
    expect(worksPower(cultureOf(s)).tour).toBe((1 + 1 + 4) * 1.5);
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
