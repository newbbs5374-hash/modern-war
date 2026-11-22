import { describe, expect, it } from 'vitest';
import { advance, newGame, setRank, type GameState } from './state';
import * as C from './civ';
import { canProduce } from './economy';
import { finishTraining, startTraining } from './officer';
import { doDiplo } from './command';
import { PIONEER_ISLANDS, hexKey } from '../data/hexmap';
import { govSlots, govById, slotCount } from '../data/civ';
import { parseSave } from './save';
import { COUNTRIES } from '../data/world';
import { relationOf } from './world';

const H = 3600e3;
const rich = (s: GameState): GameState => ({
  ...s,
  nations: { ...s.nations, kr: { ...s.nations.kr, treasury: 1e7 } },
  economy: { ...s.economy, stock: Object.fromEntries(Object.keys(s.economy.stock).map((k) => [k, 500])) as GameState['economy']['stock'] },
});

describe('연구', () => {
  it('고른 연구가 실제 시간으로 쌓여 끝나고, 병과는 등급 + 연구 둘 다 있어야 열림', () => {
    let s = rich(setRank(newGame('t', 'kr', 0, { seed: 1 }), 3));
    expect(canProduce(s, '전차')).toMatch(/연구/);
    expect(C.canResearch(s, 'm-armor')).toMatch(/먼저/);
    s = C.startResearch(s, 'm-mech');
    expect(C.civOf(s).cur.mil).toBe('m-mech');
    s = advance(s, 1.2 * H);
    expect(C.hasTech(s, 'm-mech')).toBe(true);
    s = C.startResearch(s, 'm-armor');
    s = advance(s, 3 * H);
    expect(C.hasTech(s, 'm-armor')).toBe(true);
    expect(canProduce(s, '전차')).toBeNull();
    // 등급이 모자라면 연구가 있어도 안 열림
    expect(canProduce(setRank(s, 0), '전차')).toMatch(/부터/);
  });
  it('고르지 않은 동안 점수는 모였다가 다음 연구에 쓰임', () => {
    let s = newGame('t', 'kr', 0, { seed: 2 });
    s = advance(s, 0.5 * H);
    expect(C.civOf(s).bank.mil).toBeGreaterThan(0.4);
    s = C.startResearch(s, 'm-drone');
    s = advance(s, 0.6 * H);
    expect(C.hasTech(s, 'm-drone')).toBe(true);
  });
  it('번뜩임: 훈련을 해내면 관련 연구가 절반', () => {
    let s = newGame('t', 'kr', 0, { seed: 3 });
    s = startTraining(s, '체력');
    s = finishTraining(s, { win: true, stars: 3, auto: false }).state;
    expect(C.civOf(s).eureka).toContain('m-mech');
    expect(C.techCost(s, { id: 'm-mech', hours: 1 } as never)).toBe(0.5);
  });
});

describe('체제·정책 카드', () => {
  it('처음 고르기는 무료, 칸은 등급에 따라 2→8칸, 칸 종류에 맞는 카드만', () => {
    let s = rich(newGame('t', 'kr', 0, { seed: 4 }));
    expect(slotCount(0)).toBe(2);
    expect(slotCount(10)).toBe(8);
    s = C.setGov(s, 'navy');
    expect(C.civOf(s).gov).toBe('navy');
    expect(C.chaos(s)).toBe(false);
    expect(govSlots(govById('navy'), 0)).toEqual(['군사', '군사']);
    expect(C.canPutCard(s, 0, '경-세금')).toMatch(/군사/);
    s = C.putCard(s, 0, '군-훈련');
    expect(C.effSum(s, 'mission')).toBeCloseTo(0.04);
    expect(C.canPutCard(s, 2, '군-보급')).toMatch(/없는 칸/);
    // 바꾸기는 하루 1번 무료
    const t0 = s.nations.kr.treasury;
    s = C.putCard(s, 0, '군-보급');
    expect(s.nations.kr.treasury).toBe(t0);
    s = C.putCard(s, 0, '군-훈련');
    expect(s.nations.kr.treasury).toBeLessThan(t0);
    // 체제 바꾸기는 개척 헌장 뒤, 하루 혼란
    expect(C.canSetGov(s, 'merchant')).toMatch(/개척 헌장/);
    s = C.debugAllResearch(s);
    s = C.setGov(s, 'merchant');
    expect(C.chaos(s)).toBe(true);
    s = advance(s, 25 * H);
    expect(C.chaos(s)).toBe(false);
  });
});

describe('외교', () => {
  it('호감과 이유, 협정, 기습하면 오래 남는 불만(이웃도)', () => {
    let s = rich(setRank(newGame('t', 'kr', 0, { seed: 5 }), 6));
    s = C.debugAllResearch(s);
    const partner = COUNTRIES.map((c) => c.id).find((id) => id !== 'kr' && relationOf(s.world, 'kr', id) === '중립' && C.canAgree(s, id, 'nonagg') === null)!;
    const f0 = C.favorOf(s, partner);
    expect(C.favorReasons(s, partner).length).toBeGreaterThan(0);
    expect(C.canAgree(s, partner, 'route')).toBeNull();
    s = C.makeAgreement(s, partner, 'route');
    expect(C.favorOf(s, partner)).toBe(f0 + 5);
    s = C.makeAgreement(s, partner, 'nonagg');
    // 협정 중에 선전포고 = 기습 + 협정 깨기
    s = { ...s, officer: { ...s.officer, diploReadyMs: 0 } };
    s = doDiplo(s, partner, '선전포고').state;
    const g = C.civOf(s).grievance[partner];
    expect(g).toBeGreaterThanOrEqual(70);
    expect(C.activeAgreements(s, partner).length).toBe(0);
    expect(C.favorReasons(s, partner).some(([k]) => k.includes('불만'))).toBe(true);
    // 시간이 지나면 천천히 줄어듦
    s = advance(s, 24 * H);
    expect(C.civOf(s).grievance[partner]).toBeLessThan(g);
    expect(C.civOf(s).grievance[partner]).toBeGreaterThan(g * 0.8);
  });
  it('개척 섬: 사절·부탁으로 영향력, 1등이면 섬 자원', () => {
    let s = rich(newGame('t', 'kr', 0, { seed: 6 }));
    const isl = PIONEER_ISLANDS.find((p) => p.res !== '항구')!;
    for (let i = 0; i < 4; i++) {
      s = C.sendEnvoy(s, isl.id);
      s = { ...s, civ: { ...C.civOf(s), envoyReadyMs: 0 } };
    }
    s = C.fulfillRequest(s, isl.id);
    expect(C.islandLeader(s, isl.id).id).toBe('kr');
    expect(C.civOf(s).eureka).toContain('m-crystal');
    const before = s.economy.stock[isl.res as 'KEY' & keyof GameState['economy']['stock']];
    s = advance(s, 1 * H);
    expect(s.economy.stock[isl.res as keyof GameState['economy']['stock']]).toBeGreaterThan(before);
  });
  it('군도 회의: 열리고, 투표가 없으면 부관이 대신, 끌 수 있음', () => {
    let s = newGame('t', 'kr', 0, { seed: 7 });
    s = C.debugCouncil(s);
    expect(C.civOf(s).council.open).not.toBeNull();
    s = C.voteCouncil(s, true);
    expect(C.civOf(s).council.open?.vote).toBe(true);
    s = C.debugCouncil(s);
    expect(C.civOf(s).council.open).toBeNull();
    expect(C.civOf(s).council.last).toMatch(/찬성/);
    s = C.setCouncilOn(s, false);
    s = advance(s, 30 * H);
    expect(C.civOf(s).council.open).toBeNull();
    s = C.setCouncilOn(s, true);
    s = advance(s, 25 * H);
    expect(C.civOf(s).council.last).not.toBeNull();
  });
});

describe('도시', () => {
  it('구역 짓기(칸 조건·도시 크기만큼), 완공되면 효과·번뜩임, 항만 없으면 군함 못 만듦', () => {
    let s = rich(setRank(newGame('t', 'kr', 0, { seed: 8 }), 6));
    s = C.debugAllResearch(s);
    expect(canProduce(s, '구축함')).toMatch(/항만/);
    const city = 'kr-0';
    const tiles = C.cityTiles(city).filter((t) => !t.center);
    const coast = tiles.find((t) => C.terrainOf(t.q, t.r) === '바닷가')!;
    const inland = tiles.find((t) => C.terrainOf(t.q, t.r) !== '바닷가')!;
    expect(C.canDistrict(s, city, hexKey(inland.q, inland.r), 'harbor')).toMatch(/바닷가/);
    s = C.buildDistrict(s, city, hexKey(coast.q, coast.r), 'harbor');
    expect(C.cityCiv(s, city).districts.length).toBe(1);
    s = advance(s, 3.1 * H);
    expect(C.hasDistrict(s, 'harbor')).toBe(true);
    expect(canProduce(s, '구축함')).toBeNull();
    const slots = C.districtSlots(s, city);
    let k = 0;
    for (const t of tiles) {
      if (C.cityCiv(s, city).districts.length >= slots) break;
      const key = hexKey(t.q, t.r);
      if (!C.canDistrict(s, city, key, 'housing')) s = C.buildDistrict(s, city, key, 'housing');
      if (++k > 60) break;
    }
    expect(C.canDistrict(s, city, hexKey(tiles[tiles.length - 1].q, tiles[tiles.length - 1].r), 'industry')).toMatch(/까지|이미/);
  });
  it('민심: 전쟁 피로로 떨어지면 생산이 줄지만 도시는 잃지 않음, 인구는 민심이 좋으면 자람', () => {
    let s = newGame('t', 'kr', 0, { seed: 9 });
    const pop0 = C.cityCiv(s, 'kr-0').pop;
    s = advance(s, 30 * H);
    expect(C.cityCiv(s, 'kr-0').pop).toBeGreaterThan(pop0);
    expect(C.civBudgetMult(s)).toBeGreaterThan(1);
    // 모든 나라와 전쟁 + 큰 피로
    const pairs = { ...s.world.pairs };
    for (const k of Object.keys(pairs)) if (k.includes('kr')) pairs[k] = { ...pairs[k], rel: '전쟁', weariness: 300 };
    let w: GameState = { ...s, world: { ...s.world, pairs } };
    w = C.civAccrue(w, 30 * H);
    expect(C.cityCiv(w, 'kr-0').loyalty).toBeLessThan(50);
    expect(C.cityTotals(w).mult).toBeLessThan(1);
    expect(w.world.owner['kr-0']).toBe('kr');
  });
  it('옛 저장에도 문명 상태가 채워짐', () => {
    const s = newGame('t', 'kr', 0, { seed: 10 });
    const old = { ...s } as Partial<GameState>;
    delete old.civ;
    const back = parseSave(JSON.stringify(old))!;
    expect(back.civ?.council.on).toBe(true);
  });
});
