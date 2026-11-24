import { describe, expect, test } from 'vitest';
import { advance, budgetPerDay, newGame } from './state';
import { domOf } from './domestic';
import { AGENDA, canFinish, canPledge, finishTask, pledge, taskTarget } from './agenda';
import { GROUPS, groupApproval, groupSat, meetGroup, dealGroup } from './groups';
import { CODES, canChangeCode, changeCode, codePick } from './codes';
import { ZONES, canZone, myCityIds, setZone } from './zones';
import { PROJECTS, advanceProject, canStartProject, projectCities, startProject } from './projects';
import { submitBudget } from './budgetSeason';
import { lawEff } from './laws';
import { metric, METRICS, type MetricId } from './metrics';

const H = 3600e3;
const fresh = (id = 'kr') => advance(newGame('시험', id, 0, { seed: 1 }), 20 * 60e3);

describe('내정 확장', () => {
  test('처음 틱에 dom이 생기고 집단 만족도가 채워짐', () => {
    const s = fresh();
    expect(s.dom).toBeTruthy();
    for (const g of GROUPS) expect(groupSat(s, g.id)).toBeGreaterThan(20);
    expect(Math.abs(groupApproval(s))).toBeLessThan(10);
  });
  test('지표 출력(값 맞추기용)', () => {
    const s = fresh();
    const out: Record<string, number> = {};
    for (const m of Object.keys(METRICS) as MetricId[]) out[m] = Math.round(metric(s, m));
    console.log(JSON.stringify(out), 'budget/day', Math.round(budgetPerDay(s, 'kr')), 'treasury', Math.round(s.nations.kr.treasury));
  });
  test('공약 2개 → 3번째는 막힘, 과제 조건이 맞으면 완수', () => {
    let s = fresh();
    s = pledge(s, 'sec');
    s = pledge(s, 'eco');
    expect(canPledge(s, 'wel')).toBeTruthy();
    const t = AGENDA[0].tasks[0][0];
    expect(taskTarget(s, 'sec', t)).toBeGreaterThan(0);
    // 병력 목표를 억지로 채움
    s = { ...s, nations: { ...s.nations, kr: { ...s.nations.kr, troops: s.nations.kr.troops * 2 } } };
    expect(canFinish(s, 'sec1')).toBeNull();
    const before = lawEff(s, 'troop');
    s = finishTask(s, 'sec1');
    expect(domOf(s).agenda.done).toContain('sec1');
    expect(lawEff(s, 'troop')).toBeCloseTo(before + 0.03, 5);
    expect(canFinish(s, 'sec4')).toMatch(/앞 단계/);
  });
  test('공약 파기: 3일 안에 첫 단계 못 하면 지지도 하락 한 번', () => {
    let s = fresh();
    s = pledge(s, 'dip');
    const a0 = s.pres!.approval;
    s = advance(s, 3 * 24 * H + 20 * 60e3);
    expect(domOf(s).agenda.broken).toContain('dip');
    expect(s.pres!.approval).toBeLessThan(a0 + 20);
  });
  test('면담·양보', () => {
    let s = fresh();
    const g = 'labor';
    s = meetGroup(s, g);
    expect(domOf(s).groups.meetMs[g]).toBeGreaterThan(s.worldMs);
    const t0 = s.nations.kr.treasury;
    s = dealGroup(s, 'biz');
    expect(s.nations.kr.treasury).toBeLessThan(t0);
    expect(domOf(s).groups.mods.some((m) => m.g === 'labor' && m.v < 0)).toBe(true);
  });
  test('기본법 개정(통과하면 효과·대기)', () => {
    let s = fresh();
    s = { ...s, officer: { ...s.officer, trust: 100 } };
    let tries = 0;
    while (codePick(s, 'edu') !== 2 && tries < 20) {
      s = { ...s, worldMs: s.worldMs + 13 * H };
      s = changeCode(s, 'edu', 2);
      tries++;
    }
    expect(codePick(s, 'edu')).toBe(2);
    expect(lawEff(s, 'research')).toBeGreaterThan(0.05);
    expect(canChangeCode(s, 'edu', 1)).toMatch(/아직/);
    expect(canChangeCode(s, 'army', 3)).toMatch(/전쟁/);
    expect(CODES.length).toBe(8);
  });
  test('특구 지정과 바닷가 제한', () => {
    let s = fresh();
    const cities = myCityIds(s);
    expect(cities.length).toBeGreaterThan(0);
    s = setZone(s, cities[0], 'rnd');
    expect(lawEff(s, 'research')).toBeGreaterThan(0.07);
    expect(canZone(s, cities[0], 'fez')).toMatch(/이미/);
    expect(ZONES.length).toBe(6);
  });
  test('대형 사업 3단계 → 완공 효과', () => {
    let s = fresh();
    s = { ...s, nations: { ...s.nations, kr: { ...s.nations.kr, treasury: 1e12 } } };
    const id = 'shield';
    const c = projectCities(s, id)[0];
    expect(canStartProject(s, id, c)).toBeNull();
    s = startProject(s, id, c);
    for (let i = 0; i < 3; i++) {
      s = { ...s, worldMs: s.worldMs + 40 * H };
      s = advanceProject(s, id);
    }
    expect(domOf(s).projects[id].stage).toBe(3);
    expect(lawEff(s, 'defense')).toBeGreaterThanOrEqual(8);
    expect(PROJECTS.length).toBe(10);
  });
  test('예산안 철: 안 내면 준예산, 내면 표결', () => {
    let s = fresh();
    s = advance(s, 24 * H + 30 * 60e3);
    expect(domOf(s).budget.open).toBeTruthy();
    s = submitBudget(s, 'even');
    s = advance(s, 7 * H);
    const b = domOf(s).budget;
    expect(b.open).toBeNull();
    expect(b.passed + b.cut).toBe(1);
  });
});
