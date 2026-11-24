import { SAVE_VERSION } from './state';
import { describe, expect, it } from 'vitest';
import { advance, budgetPerDay, newGame, setRank, troopsPerDay, type GameState } from './state';
import { addContract, buildMs, canProduce, canTrade, canUpgrade, cancelContract, claimChore, produce, producesOf, resPerDay, startChore, trade, tradePartners, upgradeFacility } from './economy';
import { claimMission, finishTraining, grandTargets, startGrand, startTraining } from './officer';
import { parseSave } from './save';
import { civResMult, debugAllResearch } from './civ';

const H = 3600e3;
const rich = (s: GameState): GameState => ({ ...s, nations: { ...s.nations, kr: { ...s.nations.kr, treasury: 1e6 } } });

/** 새 세계관은 평화로 시작하므로 시험에서 전쟁을 직접 걸어 둠 */
function war(s: GameState, a: string, b: string): GameState {
  const k = [a, b].sort().join('|');
  return { ...s, world: { ...s.world, pairs: { ...s.world.pairs, [k]: { ...s.world.pairs[k], rel: '전쟁' } } } };
}

describe('내정', () => {
  it('내 도시에서 자원이 쌓이고, 점령 도시는 절반', () => {
    let s = newGame('t', 'kr', 0, { seed: 1 });
    const per = resPerDay(s);
    // 서울 2 + 부산 1 + 광주 1, 도시 특성·실제 시설 자원 배율(11/24)
    expect(per.반도체).toBeCloseTo(4 * civResMult(s), 5);
    const before = s.economy.stock.반도체;
    s = advance(s, 2 * H);
    expect(s.economy.stock.반도체 - before).toBeCloseTo(2 * per.반도체!, 0);
    const w = { ...s.world, owner: { ...s.world.owner, 'jp-0': 'kr' } };
    const m = civResMult(s);
    expect(resPerDay({ ...s, world: w }).반도체! - resPerDay(s).반도체!).toBeCloseTo(1 * m, 1); // 도쿄 2 × 0.5
  });
  it('내정 업무 → 분야 경험치 + 시설 특별 가동, 시설 올리기는 등급마다 최고 단계', () => {
    let s = rich(newGame('t', 'kr', 0, { seed: 2 }));
    expect(canUpgrade(s, '군수공장')).toMatch(/경험치/);
    s = startChore(s, '군수공장');
    expect(s.economy.chore?.fac).toBe('산업');
    const b0 = budgetPerDay(s, 'kr');
    s = claimChore(advance(s, H));
    expect(s.economy.facilities.산업.exp).toBeGreaterThanOrEqual(30);
    expect(budgetPerDay(s, 'kr')).toBeGreaterThan(b0); // 특별 가동 +20%
    s = advance(s, 7 * H); // 특별 가동 끝
    s = { ...s, economy: { ...s.economy, facilities: { ...s.economy.facilities, 산업: { ...s.economy.facilities.산업, exp: 5000 } } } };
    const before = budgetPerDay(s, 'kr');
    s = upgradeFacility(s, '군수공장');
    expect(s.economy.buildings.군수공장.buildEndMs).toBeGreaterThan(0);
    s = advance(s, 2 * H);
    expect(s.economy.buildings.군수공장.level).toBe(2);
    expect(budgetPerDay(s, 'kr')).toBeGreaterThan(before);
    expect(canUpgrade(s, '군수공장')).toBeNull();
    s = { ...s, economy: { ...s.economy, buildings: { ...s.economy.buildings, 군수공장: { level: 5, buildEndMs: 0, buffEndMs: 0 } } } };
    expect(canUpgrade(s, '군수공장')).toBe('최고 단계');
  });
  it('징병소는 모병을 늘리고, 철도망은 육군 모집만 빠르게', () => {
    const s = newGame('t', 'kr', 0, { seed: 2 });
    const s2 = { ...s, economy: { ...s.economy, buildings: { ...s.economy.buildings, 징병소: { level: 5, buildEndMs: 0, buffEndMs: 0 }, 철도망: { level: 5, buildEndMs: 0, buffEndMs: 0 } } } };
    expect(troopsPerDay(s2, 'kr')).toBeCloseTo(troopsPerDay(s, 'kr') * 2, 5);
    // 철도망 5단계는 육군만 2배 빠르게(분야 성장 보너스는 모든 부대에 똑같이 붙음, 11-24)
    const navy = buildMs(s2, '구축함', false) / buildMs(s, '구축함', false);
    expect(navy).toBeLessThanOrEqual(1);
    expect(buildMs(s2, '보병', false) / buildMs(s, '보병', false)).toBeCloseTo(navy / 2, 2);
  });
  it('정기 무역 계약: 매시간 수입, 전쟁이 나면 멈춤', () => {
    let s = rich(newGame('t', 'kr', 0, { seed: 9 }));
    const partner = tradePartners(s).find((id) => producesOf(s, id).includes('석유'))!;
    s = addContract(s, partner, '석유', 5, true);
    expect(s.economy.contracts?.length).toBe(1);
    const oil = s.economy.stock.석유;
    const money = s.nations.kr.treasury;
    s = advance(s, 2 * H);
    expect(s.economy.stock.석유 - oil).toBeGreaterThan(9.9);
    expect(s.nations.kr.treasury).toBeLessThan(money + budgetPerDay(s, 'kr') * 2);
    s = war(s, 'kr', partner);
    const oil2 = s.economy.stock.석유;
    s = advance(s, 1 * H);
    expect(s.economy.stock.석유 - oil2).toBeCloseTo(resPerDay(s).석유, 3);
    s = cancelContract(s, s.economy.contracts![0].id);
    expect(s.economy.contracts?.length).toBe(0);
  });
  it('생산: 예산·자원을 쓰고 시간이 지나면 부대·병력이 늘어남, 인프라가 빠르게', () => {
    let s = rich(setRank(newGame('t', 'kr', 0, { seed: 3 }), 6));
    expect(canProduce(s, '보병')).toMatch(/강철/);
    expect(canProduce({ ...s, economy: { ...s.economy, stock: { ...s.economy.stock, 강철: 50, 석유: 20 } } }, '전차')).toMatch(/연구/); // 등급 + 연구 둘 다
    s = debugAllResearch(s);
    s = { ...s, economy: { ...s.economy, stock: { ...s.economy.stock, 강철: 50, 석유: 20, 특수강: 5, 텅스텐: 5 } } };
    const base = advance(s, 4 * H);
    s = produce(s, '전차');
    s = produce(s, '보병');
    expect(s.economy.queue.length).toBe(2);
    expect(s.economy.stock.강철).toBe(45);
    s = advance(s, 4 * H);
    expect(s.economy.queue.length).toBe(0);
    expect(s.economy.army.전차).toBe(1);
    expect(s.economy.power).toBe(21); // 9 + 2, 연구 40개(육군·전체 전투력 강화들)로 ×1.9쯤
    expect(s.nations.kr.troops).toBeGreaterThan(base.nations.kr.troops + 2000);
    // 특화 유닛(한국: ① 자주포 포병대 · ② 흑표 수출 전차). 바탕 병과도 계속 만들 수 있음
    s = { ...s, economy: { ...s.economy, stock: { ...s.economy.stock, 강철: 80, 석유: 30, 구리: 10, 텅스텐: 10, 특수강: 10 } } };
    expect(canProduce(s, '포병', 'kr-1')).toBeNull();
    expect(canProduce(s, '포병', 'us-1')).toMatch(/특화/);
    expect(canProduce(s, '전차', 'kr-2')).toBeNull();
    s = produce(s, '포병', true);
    s = produce(s, '전차', 'kr-2');
    s = produce(s, '포병');
    s = advance(s, 12 * H);
    expect(s.economy.army['자주포 포병대']).toBe(1);
    expect(s.economy.army['흑표 수출 전차']).toBe(1);
    expect(s.economy.army.포병).toBe(1);
    // 독점 병과: 한국은 강습상륙함 O, 원자력 잠수함 X
    expect(canProduce(s, '원자력 잠수함')).toMatch(/전용/);
  });
  it('무역: 전쟁 중이 아닌 나라와 사고팔기, 성향에 따라 값이 다름', () => {
    let s = rich(setRank(war(newGame('t', 'kr', 0, { seed: 4 }), 'kr', 'kp'), 6));
    const ps = tradePartners(s);
    expect(ps.length).toBeGreaterThan(0);
    expect(ps).not.toContain('kp'); // 북한과는 전쟁 중
    const seller = ps.find((id) => canTrade(s, id, '강철', 5, true) === null)!;
    expect(seller).toBeTruthy();
    const t0 = s.nations.kr.treasury;
    s = trade(s, seller, '강철', 5, true);
    expect(s.economy.stock.강철).toBe(5);
    expect(s.nations.kr.treasury).toBeLessThan(t0);
    s = trade(s, seller, '강철', 5, false);
    expect(s.economy.stock.강철).toBe(0);
  });
  it('3단계 저장(4단계 이전) 불러오면 내정이 새로 생김', () => {
    const s = newGame('t', 'kr', 0, { seed: 5 });
    const { economy: _e, ...rest } = s;
    void _e;
    const loaded = parseSave(JSON.stringify({ ...rest, version: 3 }));
    expect(loaded?.version).toBe(SAVE_VERSION);
    expect(loaded?.economy.facilities.산업.level).toBe(1);
    expect(loaded?.economy.buildings.제련소.level).toBe(1);
    expect(loaded?.officer.training).toBeNull();
  });
});

describe('5단계 훈련·대전투', () => {
  it('훈련: 자동이면 별 최대 2개, 지면 스탯 조금', () => {
    let s = newGame('t', 'kr', 0, { seed: 6 });
    s = startTraining(s, '사격');
    expect(s.officer.training?.name).toBe('사격');
    const r = finishTraining(s, { win: true, stars: 3, auto: true });
    expect(r.result.ok && r.result.stars).toBe(2);
    const l = finishTraining(startTraining(r.state, '체력'), { win: false, stars: 0, auto: false });
    expect(l.result.ok && l.result.exp.체력).toBe(10);
    expect(l.result.ok && l.result.gains.체력).toBe(0);
  });
  it('대전투: 준장부터, 전쟁 중인 나라 도시, 이기면 점령', () => {
    let s = setRank(war(newGame('t', 'kr', 0, { seed: 7 }), 'kr', 'kp'), 6);
    const ts = grandTargets(s);
    expect(ts.length).toBeGreaterThan(0);
    s = startGrand(s, ts[0]);
    expect(s.officer.active?.kind).toBe('대전투');
    const city = ts[0];
    s = advance(s, s.officer.active!.endMs - s.worldMs);
    s = claimMission(s, { win: true, stars: 3 }).state;
    expect(s.world.owner[city]).toBe('kr');
    expect(s.world.events.some((e) => e.kind === '점령' && e.mine)).toBe(true);
  });
});

describe('승리', () => {
  it('지도자 + 연합·정복 조건을 일정 기간 지키면 판이 끝남', async () => {
    const { checkVictory, victoryProgress } = await import('./victory');
    const { CITIES } = await import('../data/cities');
    let s = newGame('t', 'kr', 0, { seed: 9 });
    const owner = { ...s.world.owner };
    for (const c of CITIES.slice(0, 30)) owner[c.id] = 'kr';
    s = { ...s, world: { ...s.world, owner } };
    expect(victoryProgress(s).mine).toBeGreaterThanOrEqual(20);
    expect(checkVictory(s).ending).toBeNull(); // 아직 지도자 아님
    const { HOLD_DAYS } = await import('./victory');
    let w = checkVictory(setRank(s, 10));
    expect(w.ending).toBeNull(); // 막 채움: 지키는 중
    w = checkVictory({ ...w, worldMs: w.worldMs + HOLD_DAYS * 24 * 3600e3 });
    expect(w.ending?.kind).toBe('정복 승리');
    expect(w.ending?.captured.length).toBeGreaterThan(10);
  });
});
