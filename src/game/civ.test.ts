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
import { CLAIM_INFLUENCE, REAL_ISLANDS } from '../data/islands';
import { relationOf } from './world';

const H = 3600e3;
const rich = (s: GameState): GameState => ({
  ...s,
  nations: { ...s.nations, [s.player.countryId]: { ...s.nations[s.player.countryId], treasury: 1e7, def: 1e7 } },
  economy: { ...s.economy, stock: Object.fromEntries(Object.keys(s.economy.stock).map((k) => [k, 500])) as GameState['economy']['stock'] },
});

describe('연구', () => {
  it('3단계 연구: 바꿔도 끝낸 단계는 남고, 옛 저장(stage 없음)도 이어서 됨', () => {
    let s = newGame('t', 'uk', 0, { seed: 5 });
    s = C.startResearch(s, 'm-rifle');
    s = advance(s, 1.1 * H);
    expect(C.techStage(s, 'm-rifle')).toBe(1);
    s = C.startResearch(s, 'm-comms');
    s = advance(s, 0.2 * H);
    expect(C.techStage(s, 'm-rifle')).toBe(1);
    // 옛 저장: stage 칸이 없어도 0단계로 봄
    const old = { ...s, civ: { ...C.civOf(s), stage: undefined } };
    expect(C.techStage(old, 'm-rifle')).toBe(0);
    expect(C.techLeft(old, { id: 'm-drone', hours: 1 } as never)).toBe(3);
  });
  it('고른 연구가 실제 시간으로 쌓여 끝나고, 병과는 등급 + 연구 둘 다 있어야 열림', () => {
    let s = rich(setRank(newGame('t', 'kr', 0, { seed: 1 }), 3));
    expect(canProduce(s, '전차')).toMatch(/연구/);
    expect(C.canResearch(s, 'm-armor')).toMatch(/먼저/);
    s = C.startResearch(s, 'm-mech');
    expect(C.civOf(s).cur.mil).toBe('m-mech');
    // 연구 속도 1일 때 기준 시간(11/24 대한민국 도시 특성·시설로 빨라짐)
    const hr = (h: number) => (h / C.researchRate(s)) * H;
    s = advance(s, hr(1.2));
    // 3단계 연구(11-24): 1단계만 끝나고 아직 완성 아님
    expect(C.hasTech(s, 'm-mech')).toBe(false);
    expect(C.techStage(s, 'm-mech')).toBe(1);
    s = advance(s, hr(2.4));
    expect(C.hasTech(s, 'm-mech')).toBe(true);
    expect(C.civOf(s).stage?.['m-mech']).toBeUndefined();
    s = C.startResearch(s, 'm-armor');
    s = advance(s, hr(9));
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
    s = advance(s, 2.6 * H);
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
    expect(C.canPutCard(s, 8, '군-보급')).toMatch(/없는 칸/);
    // 바꾸기는 하루 1번 무료
    const t0 = s.nations.kr.treasury;
    s = C.putCard(s, 0, '군-보급');
    expect(s.nations.kr.treasury).toBe(t0);
    s = C.putCard(s, 0, '군-훈련');
    expect(s.nations.kr.treasury).toBeLessThan(t0);
    // 체제 바꾸기는 국가 헌장 뒤, 하루 혼란
    expect(C.canSetGov(s, 'merchant')).toMatch(/국가 헌장/);
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
  it('분쟁 지역: 사절·부탁으로 영향력, 1등이면 섬 자원', () => {
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
  it('국제 회의: 열리고, 투표가 없으면 부관이 대신, 끌 수 있음', () => {
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
  it('항만은 실제 바닷가 도시만 · 항만·비행장은 연구 없이 지을 수 있음', () => {
    const s = rich(setRank(newGame('t', 'ru', 0, { seed: 3 }), 6));
    // 모스크바(ru-0)는 내륙: 바닷가 칸이 없고 항만은 못 지음
    const moscow = C.cityTiles('ru-0').filter((t) => !t.center);
    expect(moscow.some((t) => C.terrainOf('ru-0', t.q, t.r) === '바닷가')).toBe(false);
    expect(C.canDistrict(s, 'ru-0', hexKey(moscow[0].q, moscow[0].r), 'harbor')).toMatch(/바다에 닿지 않은/);
    // 내륙 도시도 비행장은 됨(연구 없이)
    const flat = moscow.find((t) => C.terrainOf('ru-0', t.q, t.r) === '평지')!;
    expect(C.canDistrict(s, 'ru-0', hexKey(flat.q, flat.r), 'airfield')).toBeNull();
    // 상트페테르부르크(ru-1)는 바닷가 도시: 연구 없이 항만
    const spb = C.cityTiles('ru-1').find((t) => !t.center && C.terrainOf('ru-1', t.q, t.r) === '바닷가')!;
    expect(C.canDistrict(s, 'ru-1', hexKey(spb.q, spb.r), 'harbor')).toBeNull();
    // 덴버(us-4)처럼 예전 지도 탓에 바닷가가 있던 내륙 도시도 이제 없음
    expect(C.cityTiles('us-4').some((t) => C.terrainOf('us-4', t.q, t.r) === '바닷가')).toBe(false);
  });

  it('구역 짓기(칸 조건·도시 크기만큼), 완공되면 효과·번뜩임, 항만 없으면 군함 못 만듦', () => {
    let s = rich(setRank(newGame('t', 'kr', 0, { seed: 8 }), 6));
    s = C.debugAllResearch(s);
    expect(canProduce(s, '구축함')).toMatch(/항만/);
    // 서울은 11/24부터 실제 모양이라 내륙 → 부산에 항만
    const city = 'kr-1';
    const tiles = C.cityTiles(city).filter((t) => !t.center);
    const coast = tiles.find((t) => C.terrainOf(city, t.q, t.r) === '바닷가' && !C.markAt(city, hexKey(t.q, t.r)))!;
    const inland = tiles.find((t) => C.terrainOf(city, t.q, t.r) !== '바닷가' && !C.markAt(city, hexKey(t.q, t.r)))!;
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
    let s = newGame('t', 'jp', 0, { seed: 9 });
    const pop0 = C.cityCiv(s, 'jp-0').pop;
    s = advance(s, 30 * H);
    expect(C.cityCiv(s, 'jp-0').pop).toBeGreaterThan(pop0);
    // 11-26 난이도로 전쟁이 잦아져서, 평화일 때 민심 효과는 전쟁을 모두 멈추고 봄
    {
      const calm = { ...s.world.pairs };
      for (const k of Object.keys(calm)) if (k.includes('jp')) calm[k] = { ...calm[k], rel: '중립', weariness: 0 };
      const peace = C.civAccrue({ ...s, world: { ...s.world, pairs: calm } }, 30 * H);
      expect(C.civBudgetMult(peace)).toBeGreaterThan(1);
    }
    // 모든 나라와 전쟁 + 큰 피로
    const pairs = { ...s.world.pairs };
    for (const k of Object.keys(pairs)) if (k.includes('jp')) pairs[k] = { ...pairs[k], rel: '전쟁', weariness: 300 };
    let w: GameState = { ...s, world: { ...s.world, pairs } };
    w = C.civAccrue(w, 30 * H);
    expect(C.cityCiv(w, 'jp-0').loyalty).toBeLessThan(50);
    expect(C.cityTotals(w).mult).toBeLessThan(1);
    expect(w.world.owner['jp-0']).toBe('jp');
  });
  it('옛 저장에도 문명 상태가 채워짐', () => {
    const s = newGame('t', 'kr', 0, { seed: 10 });
    const old = { ...s } as Partial<GameState>;
    delete old.civ;
    const back = parseSave(JSON.stringify(old))!;
    expect(back.civ?.council.on).toBe(true);
  });
});

describe('자원 3안: 매장지·채굴장 · 생활 자원 · 복합소재', () => {
  it('도시마다 크기만큼 매장지가 있고, 채굴장을 지으면 시간마다 그 자원이 쌓임', () => {
    let s = rich(newGame('t', 'kr', 0, { seed: 4 }));
    const city = 'kr-0';
    const dep = C.deposits(city);
    expect(dep.length).toBeGreaterThan(0);
    expect(C.deposits(city)).toEqual(dep); // 늘 같음
    const d = dep[0];
    expect(C.canMine(s, city, d.tile)).toBeNull();
    s = C.buildMine(s, city, d.tile);
    expect(C.canMine(s, city, d.tile)).toMatch(/이미/);
    expect(C.canDistrict(C.debugAllResearch(s), city, d.tile, 'housing')).toMatch(/채굴장/);
    s = advance(s, (C.MINE_HOURS + 0.01) * H);
    const before = s.economy.stock[d.res];
    expect(C.minePerHour(s)[d.res]).toBeGreaterThan(0);
    s = advance(s, 2 * H);
    expect(s.economy.stock[d.res] - before).toBeGreaterThan(1.5);
  });
  it('생활 자원은 종류마다 민심 +3, 기본 자원 7종이 없을 때만 자원 부족', () => {
    const s = rich(newGame('t', 'kr', 0, { seed: 4 }));
    const none = { ...s, economy: { ...s.economy, stock: { ...s.economy.stock, 향신료: 0, 진주: 0, 차잎: 0, 산호: 0 } } };
    const two = { ...s, economy: { ...s.economy, stock: { ...s.economy.stock, 향신료: 1, 진주: 5, 차잎: 0, 산호: 0 } } };
    expect(C.loyaltyTarget(two, 'kr-0') - C.loyaltyTarget(none, 'kr-0')).toBe(6);
    const noUranium = { ...none, economy: { ...none.economy, stock: { ...none.economy.stock, 우라늄: 0 } } };
    expect(C.loyaltyReasons(noUranium, 'kr-0').some(([k]) => k === '자원 부족')).toBe(false);
  });
  it('옛 저장에 새 자원이 없으면 0으로 채움', () => {
    const s = newGame('t', 'kr', 0, { seed: 4 });
    const old = JSON.parse(JSON.stringify(s));
    delete old.economy.stock.구리;
    delete old.economy.stock.갈륨;
    const back = parseSave(JSON.stringify(old))!;
    expect(typeof back.economy.stock.구리).toBe('number');
    expect(typeof back.economy.stock.갈륨).toBe('number');
  });
});

describe('자원 24종 · 연구 70개 · 체제 8가지(11-23)', () => {
  it('공업 구역에서 특수강·정밀부품도 만들고, 가공마다 끌 수 있음', () => {
    let s = rich(C.debugAllResearch(newGame('t', 'kr', 0, { seed: 4 })));
    const city = 'kr-0';
    const t = C.cityTiles(city).filter((x) => !x.center).find((x) => !C.canDistrict(s, city, hexKey(x.q, x.r), 'industry'))!;
    s = C.buildDistrict(s, city, hexKey(t.q, t.r), 'industry');
    s = advance(s, 2.1 * H);
    expect(C.processPerHour(s, '특수강')).toBe(1);
    const before = s.economy.stock.특수강;
    const nickel = s.economy.stock.니켈;
    s = advance(s, 2 * H);
    expect(s.economy.stock.특수강 - before).toBeGreaterThan(1.5);
    expect(s.economy.stock.니켈).toBeLessThan(nickel + 0.01 + 10);
    const off = { ...s, economy: { ...s.economy, process: { 특수강: false } } };
    expect(C.processPerHour(off, '특수강')).toBe(0);
    expect(C.processPerHour(off, '정밀부품')).toBe(1);
  });
  it('새 체제는 사회 제도 연구로 열림', () => {
    let s = rich(newGame('t', 'kr', 0, { seed: 4 }));
    expect(C.canSetGov(s, 'technocracy')).toMatch(/의무 교육/);
    s = C.startResearch(s, 's-school');
    s = advance(s, 6 * H);
    expect(C.canSetGov(s, 'technocracy')).toBeNull();
    s = C.setGov(s, 'technocracy');
    expect(C.effSum(s, 'research')).toBeGreaterThanOrEqual(0.25);
  });
});

describe('실제 분쟁 지역(11-24)', () => {
  it('섬 12곳 모두 실제 정보가 있고, 다투는 나라는 영향력 덤', () => {
    for (const p of PIONEER_ISLANDS) expect(REAL_ISLANDS[p.id]?.sides.length).toBeGreaterThan(0);
    const s = newGame('t', 'jp', 0, { seed: 1 });
    expect(C.influenceMult(s, 'p-dawn')).toBeCloseTo(C.influenceMult(s) + CLAIM_INFLUENCE);
    expect(C.influenceMult(s, 'p-flame')).toBeCloseTo(C.influenceMult(s));
  });
});

describe('연구 늘리기(11-26): 군사 100 · 사회 70', () => {
  it('개수와 선행·병과 연결이 맞음', async () => {
    const { MIL_TECHS, SOC_TECHS, TECHS, techById, techForUnit } = await import('../data/civ');
    const { UNITS } = await import('../data/catalog');
    expect(MIL_TECHS.length).toBe(100);
    expect(SOC_TECHS.length).toBe(70);
    expect(new Set(TECHS.map((t) => t.id)).size).toBe(TECHS.length);
    for (const t of TECHS) for (const n of t.needs) {
      expect(techById(n)?.line).toBe(t.line);
      expect(techById(n)!.era).toBeLessThanOrEqual(t.era);
    }
    // 처음부터 열린 보병·특수부대 말고 모든 병과는 연구 하나로 열림
    for (const u of UNITS) if (u.rank > 0) expect(techForUnit(u.name), u.name).toBeTruthy();
    for (const u of ['탄도미사일', '다연장로켓', '장거리 방공', '해안 미사일', '정찰 무인기', '스텔스 전투기', '조기경보기', '지상 공격기', '상륙장갑차', '바다 드론'])
      expect(techForUnit(u), u).toBeTruthy();
  });
});

describe('11-27 옛 저장 + 새 나라: AI 체제 채움', () => {
  it('aiGov가 빠진 옛 저장도 모든 나라 체제·호감을 계산함', () => {
    const s = newGame('t', 'kr', 0, { seed: 11 });
    const old = JSON.parse(JSON.stringify(s));
    for (const c of COUNTRIES.slice(13)) delete old.civ.aiGov[c.id];
    const back = parseSave(JSON.stringify(old))!;
    for (const c of COUNTRIES) {
      expect(back.civ!.aiGov[c.id]).toBeTruthy();
      expect(govById(back.civ!.aiGov[c.id]).icon).toBeTruthy();
      if (c.id !== 'kr') expect(Number.isFinite(C.favorOf(back, c.id))).toBe(true);
    }
    expect(govById(undefined).icon).toBeTruthy();
  });
});
