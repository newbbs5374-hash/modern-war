import { describe, expect, test } from 'vitest';
import { advance, newGame } from './state';
import { CITY_STAGES, cityGrowth, cityPeopleAtStart, cityStage, stageOfPeople } from './growth';
import { CHAINS, chainMult, chainState, cityJobs } from './chains';
import { cityPeople, loyaltyReasons } from './civ';
import { lawEff } from './laws';
import { myCityIds } from './zones';
import { CITIES } from '../data/cities';

const fresh = (id = 'kr') => advance(newGame('시험', id, 0, { seed: 1 }), 20 * 60e3);

describe('자라는 도시(C1)', () => {
  test('인구 → 7단계', () => {
    expect(CITY_STAGES).toHaveLength(7);
    expect(stageOfPeople(3).stage.name).toBe('마을');
    expect(stageOfPeople(30).stage.name).toBe('중도시');
    expect(stageOfPeople(30).frac).toBeCloseTo(10 / 30);
    expect(stageOfPeople(1200).stage.name).toBe('세계 도시');
    expect(stageOfPeople(1200).next).toBeNull();
  });
  test('서울은 메가시티 이상, 취임 첫날 인구 = 지금(아직 안 자람)', () => {
    const s = fresh();
    const seoul = CITIES.find((c) => c.name === '서울')!;
    expect(cityStage(s, seoul.id).stage.lv).toBeGreaterThanOrEqual(5);
    expect(cityPeopleAtStart(s, seoul.id)).toBe(cityPeople(s, seoul.id));
    const g = cityGrowth(s, seoul.id);
    expect(g).toBeGreaterThan(0);
    expect(g).toBeLessThanOrEqual(1);
  });
  test('발전하면 인구·단계 진행이 오름', () => {
    const s = fresh();
    const id = myCityIds(s)[1];
    const cc = s.civ!.cities[id] ?? { loyalty: 70, pop: 0, grow: 0, districts: [] };
    const grown = { ...s, civ: { ...s.civ!, cities: { ...s.civ!.cities, [id]: { ...cc, pop: cc.pop + 4 } } } };
    expect(cityPeople(grown, id)).toBeGreaterThan(cityPeople(s, id));
    expect(cityGrowth(grown, id)).toBeGreaterThan(cityGrowth(s, id));
    expect(cityPeopleAtStart(grown, id)).toBeCloseTo(cityPeople(s, id), -1);
  });
});

describe('생산 줄·일자리(A1)', () => {
  test('6줄, 줄마다 고리 4개', () => {
    expect(CHAINS).toHaveLength(6);
    for (const c of CHAINS) expect(c.links).toHaveLength(4);
    expect(chainMult(4)).toBe(1.5);
    expect(chainMult(2)).toBe(0.5);
  });
  test('자원을 채우면 고리가 이어지고 효과가 붙음', () => {
    const s = fresh();
    const before = chainState(s).find((r) => r.def.id === 'energy')!.done;
    const rich = { ...s, economy: { ...s.economy, stock: { ...s.economy.stock, 석유: 50, 우라늄: 20 } } };
    const after = chainState(rich).find((r) => r.def.id === 'energy')!;
    expect(after.done).toBeGreaterThanOrEqual(Math.min(4, before + 1));
    expect(after.links[0] && after.links[1]).toBe(true);
    expect(lawEff(rich, 'res')).toBeGreaterThan(lawEff({ ...s, economy: { ...s.economy, stock: { ...s.economy.stock, 석유: 0, 우라늄: 0 } } }, 'res'));
  });
  test('도시 일자리 줄이 민심 이유에 들어감, 인구만 늘면 부족', () => {
    const s = fresh();
    const id = myCityIds(s)[0];
    expect(loyaltyReasons(s, id).some(([k]) => k.startsWith('💼'))).toBe(true);
    const cc = s.civ!.cities[id] ?? { loyalty: 70, pop: 0, grow: 0, districts: [] };
    const crowd = { ...s, civ: { ...s.civ!, cities: { ...s.civ!.cities, [id]: { ...cc, pop: 10 } } } };
    expect(cityJobs(crowd, id).loyalty).toBeLessThanOrEqual(cityJobs(s, id).loyalty);
  });
});
