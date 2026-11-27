// 11-28 국정 37 점검 오류 고침: 파병 지역·국가 사업 옮기기·과열 게이지·첩보 확률
import { describe, expect, test } from 'vitest';
import { newGame, type GameState } from './state';
import { activeDeploys, canHost, deployOf, regionOk } from './deploy';
import { canAdvanceProject, canMoveProject, moveProject, projectCities, projectLost, startProject, busyProjects } from './projects';
import { domOf } from './domestic';
import { overheat, CRISIS_AT } from './econ';
import { startSpy, spyOf } from './spy';
import { polityOf } from './polity';

const rich = (s: GameState): GameState => ({ ...s, nations: { ...s.nations, [s.player.countryId]: { ...s.nations[s.player.countryId], treasury: 1e9 } } });

describe('11-28 오류 고침', () => {
  test('필리핀으로 하면 필리핀 파병 요청 지역은 안 나옴', () => {
    const s = newGame('t', 'ph', 0, { seed: 1, realWorld: true });
    expect(regionOk(s, 'r-philippines')).toBe(false);
    expect(canHost(s, 'r-philippines')).toMatch(/보낼 수 없는/);
    const k = newGame('t', 'kr', 0, { seed: 1, realWorld: true });
    expect(regionOk(k, 'r-indian')).toBe(true);
  });
  test('돌아오는 부대는 파병 칸을 차지하지 않음', () => {
    const s = newGame('t', 'kr', 0, { seed: 1 });
    const d = { list: [{ id: 1, to: 'us', units: { 보병: 1 }, arriveMs: 0, lost: 0, returnMs: 5 }, { id: 2, to: 'jp', units: { 보병: 1 }, arriveMs: 0, lost: 0 }], next: 3 };
    expect(activeDeploys({ ...s, deploy: d })).toBe(1);
    expect(deployOf({ ...s, deploy: d }).list.length).toBe(2);
  });
  test('사업 도시를 잃으면 멈추고, 다른 도시로 옮겨 이어 감', () => {
    let s = rich(newGame('t', 'kr', 0, { seed: 1 }));
    const cities = projectCities(s, 'rail');
    s = startProject(s, 'rail', cities[0]);
    expect(domOf(s).projects.rail).toBeTruthy();
    s = { ...s, world: { ...s.world, owner: { ...s.world.owner, [cities[0]]: 'jp' } } };
    expect(projectLost(s, 'rail')).toBe(true);
    expect(busyProjects(s).length).toBe(0);
    expect(canAdvanceProject({ ...s, worldMs: 1e9 }, 'rail')).toMatch(/잃어/);
    const to = projectCities(s, 'rail')[0];
    expect(canMoveProject(s, 'rail', to)).toBeNull();
    s = moveProject(s, 'rail', to);
    expect(domOf(s).projects.rail.cityId).toBe(to);
    expect(projectLost(s, 'rail')).toBe(false);
  });
  test('과열 게이지: 물가가 높으면 위기까지 남은 시간을 알려 줌', () => {
    let s = newGame('t', 'kr', 0, { seed: 1 });
    s = { ...s, polity: polityOf(s) };
    const p = polityOf(s);
    s = { ...s, polity: { ...p, econ: { ...p.econ, cpi: 9, stress: 20 } } };
    const o = overheat(s);
    expect(o.at).toBe(CRISIS_AT);
    expect(o.hoursLeft).not.toBeNull();
    expect(o.why.length).toBeGreaterThan(0);
  });
  test('첩보 성공률은 시작 때 정해짐', () => {
    let s = rich(newGame('t', 'kr', 0, { seed: 1 }));
    s = { ...s, officer: { ...s.officer, intel: 999 } };
    s = startSpy(s, 'scout', 'jp');
    expect(spyOf(s).active[0].chance).toBe(1);
  });
});
