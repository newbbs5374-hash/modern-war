import { describe, expect, it } from 'vitest';
import { newGame, advance } from './state';
import { canDeploy, deployOf, deployTroops, recallTroops, stationed, travelMs } from './deploy';
import { pairKey } from './world';

const HOUR = 3600e3;
describe('해외 파병', () => {
  it('연합국에 보내면 도착·호감·귀국', () => {
    let s = newGame('t', 'kr', 0, { seed: 3 });
    s = { ...s, economy: { ...s.economy, army: { 보병: 3, 전차: 1 }, power: 15 } };
    s.world.pairs[pairKey('kr', 'us')].rel = '연합';
    expect(canDeploy(s, 'us', { 보병: 2 })).toBeNull();
    expect(canDeploy(s, 'kr', { 보병: 2 })).not.toBeNull();
    s = deployTroops(s, 'us', { 보병: 2, 전차: 1 });
    expect(s.economy.army.보병).toBe(1);
    expect(deployOf(s).list.length).toBe(1);
    s = advance(s, travelMs('kr', 'us') + HOUR);
    expect(stationed(s).length).toBe(1);
    s = recallTroops(s, deployOf(s).list[0].id);
    s = advance(s, travelMs('kr', 'us') + HOUR);
    expect(deployOf(s).list.length).toBe(0);
    expect((s.economy.army.보병 ?? 0) + (s.economy.army.전차 ?? 0)).toBeGreaterThanOrEqual(2);
  });
  it('전쟁 중인 나라엔 못 보냄', () => {
    const s = newGame('t', 'kr', 0, { seed: 3 });
    s.economy.army = { 보병: 1 };
    s.world.pairs[pairKey('kr', 'kp')].rel = '전쟁';
    expect(canDeploy(s, 'kp', { 보병: 1 })).toMatch(/전쟁/);
  });
});

import { CLASHES, MODE_NEED, REGIONS, REQUEST_KINDS, kindsFor, BRANCH_KINDS } from '../data/deployOps';
import { acceptRequest, canAccept, clashPlan, clashes, openRequests, settleClash, clashFits, placeName } from './deploy';
import { fieldById } from '../battle3d/pick';
import { autoField } from '../battle/auto';

describe('11-26 파병 요청 · 교전', () => {
  it('요청 지역·종류·교전이 충분하고 모든 교전 전장이 있음', () => {
    expect(REGIONS.length).toBeGreaterThanOrEqual(25);
    expect(REQUEST_KINDS.length).toBeGreaterThanOrEqual(10);
    expect(REGIONS.reduce((a, r) => a + kindsFor(r).length, 0)).toBeGreaterThan(150);
    expect(CLASHES.length).toBeGreaterThanOrEqual(30);
    expect(new Set(CLASHES.map((c) => c.id)).size).toBe(CLASHES.length);
    for (const m of ['air', 'sea', 'land', 'sea-land', 'sea-air', 'land-air'] as const) expect(CLASHES.some((c) => c.mode === m), m).toBe(true);
    for (const c of CLASHES) {
      const st = fieldById(c.field);
      expect(st.id, c.id).toBe(c.field);
      // 전투 모양에 맞는 병과가 그 전장에서 쓰일 수 있음
      for (const b of MODE_NEED[c.mode]) expect(!st.kinds || st.kinds.some((k) => BRANCH_KINDS[b].includes(k)), `${c.id} ${b}`).toBe(true);
      // 어느 지역 하나 이상에서 일어날 수 있음
      expect(REGIONS.some((r) => c.tags.some((t) => r.tags.includes(t))), c.id).toBe(true);
    }
  });
  it('요청이 자주 오고(하루에 여러 개), 받아들이면 그 지역으로 파병 → 임무 끝나면 보상', () => {
    let s = newGame('t', 'kr', 0, { seed: 5 });
    s = advance(s, 6 * HOUR);
    expect(openRequests(s).length).toBeGreaterThanOrEqual(1);
    // 아무 부대나 되는 요청을 만들어 받아들임
    s = { ...s, economy: { ...s.economy, army: { 보병: 4, 구축함: 2, 전투기: 2 }, power: 100 }, deploy: { list: [], next: 50, requests: [{ id: 49, region: 'r-indian', kind: 'pirate', untilMs: s.worldMs + 5 * HOUR }] } };
    expect(canAccept(s, 49, { 보병: 2 })).toMatch(/해군/);
    expect(canAccept(s, 49, { 구축함: 1, 전투기: 1 })).toBeNull();
    const fame0 = s.officer.fame;
    s = acceptRequest(s, 49, { 구축함: 1, 전투기: 1 });
    expect(deployOf(s).list[0].to).toBe('r-indian');
    expect(placeName('r-indian')).toBe('인도양');
    expect(openRequests(s).some((r) => r.id === 49)).toBe(false);
    s = advance(s, 40 * HOUR);
    expect(s.officer.fame).toBeGreaterThan(fame0);
    expect(s.economy.army.구축함 ?? 0).toBeGreaterThanOrEqual(1);
  });
  it('파병 중이면 병과에 맞는 교전이 생기고, 3D 전투로 치르거나 결과를 받음', () => {
    let s = newGame('t', 'kr', 0, { seed: 7 });
    s = { ...s, economy: { ...s.economy, army: { 구축함: 2, 전투기: 2 }, power: 100 }, deploy: { list: [], next: 50, requests: [{ id: 49, region: 'r-aden', kind: 'escort', untilMs: s.worldMs + 5 * HOUR }] } };
    s = acceptRequest(s, 49, { 구축함: 2, 전투기: 2 });
    let found = false;
    for (let i = 0; i < 40 && !found; i++) {
      s = advance(s, HOUR);
      const c = clashes(s)[0];
      if (c) {
        found = true;
        expect(clashFits(CLASHES.find((x) => x.id === c.clash!.id)!, c)).toBe(true);
        const plan = clashPlan(c)!;
        expect(plan.source).toBe('deploy');
        expect(plan.stages[0].frame).toBe('b3d');
        // 해군·공군만 보냈으니 육군 병과는 없음
        expect(plan.stages[0].kinds!.every((k) => !BRANCH_KINDS.land.includes(k as never))).toBe(true);
        const money0 = s.nations.kr.treasury;
        const r = settleClash(s, c.id, true, 3, '직접');
        expect(r.state.nations.kr.treasury).toBeGreaterThan(money0);
        expect(clashes(r.state).length).toBe(0);
        const lose = settleClash(s, c.id, false, 0, '직접');
        expect(deployOf(lose.state).list[0].lost).toBe(1);
      }
    }
    expect(found).toBe(true);
  });
  it('교전 40가지 모두 맞는 병과로 이길 수 있음(자동 배치)', () => {
    let wins = 0;
    for (const c of CLASHES) {
      const dep = { id: 1, to: 'r-indian', units: {}, arriveMs: 0, lost: 0, clash: { id: c.id, untilMs: 1, seed: 11 } };
      const r = autoField(clashPlan(dep)!.stages[0]);
      if (r.win) wins++;
    }
    expect(wins).toBe(CLASHES.length);
  }, 120000);
});
