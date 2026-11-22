import { describe, expect, it } from 'vitest';
import { advance, budgetPerDay, newGame, setRank, troopsPerDay, type GameState } from './state';
import { canProduce, canTrade, canUpgrade, claimChore, produce, resPerDay, startChore, trade, tradePartners, upgradeFacility } from './economy';
import { claimMission, finishTraining, grandTargets, startGrand, startTraining } from './officer';
import { parseSave } from './save';

const H = 3600e3;
const rich = (s: GameState): GameState => ({ ...s, nations: { ...s.nations, kr: { ...s.nations.kr, treasury: 1e6 } } });

describe('내정', () => {
  it('내 도시에서 자원이 쌓이고, 점령 도시는 절반', () => {
    let s = newGame('t', 'kr', 0, { seed: 1 });
    const per = resPerDay(s);
    expect(per.반도체).toBe(3); // 서울 2 + 대전 1
    s = advance(s, 2 * H);
    expect(s.economy.stock.반도체).toBeCloseTo(6, 5);
    const w = { ...s.world, owner: { ...s.world.owner, 'jp-0': 'kr' } };
    expect(resPerDay({ ...s, world: w }).반도체).toBe(4); // 도쿄 2 × 0.5
  });
  it('준장 전에는 잠김, 준장부터 내정 일 → 경험치, 총사령관이 되면 시설 올리기', () => {
    let s = rich(newGame('t', 'kr', 0, { seed: 2 }));
    expect(canUpgrade(s, '산업')).not.toBeNull();
    expect(startChore(s, '산업')).toBe(s);
    s = setRank(s, 6);
    s = startChore(s, '산업');
    expect(s.economy.chore?.fac).toBe('산업');
    s = claimChore(advance(s, H));
    expect(s.economy.facilities.산업.exp).toBeGreaterThanOrEqual(30);
    s = advance(s, 40 * H); // 가만히 있어도 경험치
    expect(canUpgrade(s, '산업')).toMatch(/총사령관/);
    s = setRank(s, 10);
    const before = budgetPerDay(s, 'kr');
    s = upgradeFacility(s, '산업');
    expect(s.economy.facilities.산업.buildEndMs).toBeGreaterThan(0);
    s = advance(s, 2 * H);
    expect(s.economy.facilities.산업.level).toBe(2);
    expect(budgetPerDay(s, 'kr')).toBeGreaterThan(before);
    s = { ...s, economy: { ...s.economy, facilities: { ...s.economy.facilities, 산업: { level: 5, exp: 9999, buildEndMs: 0 } } } };
    expect(canUpgrade(s, '산업')).toBe('최고 단계');
  });
  it('복지는 모병을 늘림', () => {
    const s = newGame('t', 'kr', 0, { seed: 2 });
    const s2 = { ...s, economy: { ...s.economy, facilities: { ...s.economy.facilities, 복지: { level: 5, exp: 0, buildEndMs: 0 } } } };
    expect(troopsPerDay(s2, 'kr')).toBeCloseTo(troopsPerDay(s, 'kr') * 2, 5);
  });
  it('생산: 예산·자원을 쓰고 시간이 지나면 부대·병력이 늘어남, 인프라가 빠르게', () => {
    let s = rich(setRank(newGame('t', 'kr', 0, { seed: 3 }), 6));
    expect(canProduce(s, '보병')).toMatch(/강철/);
    s = { ...s, economy: { ...s.economy, stock: { ...s.economy.stock, 강철: 50, 석유: 20 } } };
    expect(canProduce(s, '항공모함')).toMatch(/대장|총사령관|부터/);
    const base = advance(s, 4 * H);
    s = produce(s, '전차');
    s = produce(s, '보병');
    expect(s.economy.queue.length).toBe(2);
    expect(s.economy.stock.강철).toBe(44);
    s = advance(s, 4 * H);
    expect(s.economy.queue.length).toBe(0);
    expect(s.economy.army.전차).toBe(1);
    expect(s.economy.power).toBe(11);
    expect(s.nations.kr.troops).toBeGreaterThan(base.nations.kr.troops + 2000);
    // 특별 병과(한국: 자주포 포병대)
    s = produce(s, '포병', true);
    s = advance(s, 5 * H);
    expect(s.economy.army['자주포 포병대']).toBe(1);
  });
  it('무역: 전쟁 중이 아닌 나라와 사고팔기, 성향에 따라 값이 다름', () => {
    let s = rich(setRank(newGame('t', 'kr', 0, { seed: 4 }), 6));
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
    expect(loaded?.version).toBe(4);
    expect(loaded?.economy.facilities.산업.level).toBe(1);
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
    expect(l.result.ok && l.result.gains.체력).toBe(0.5);
  });
  it('대전투: 준장부터, 전쟁 중인 나라 도시, 이기면 점령', () => {
    let s = setRank(newGame('t', 'kr', 0, { seed: 7 }), 6);
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
  it('총사령관 + 연합·정복 조건을 일정 기간 지키면 판이 끝남', async () => {
    const { checkVictory, victoryProgress } = await import('./victory');
    const { CITIES } = await import('../data/cities');
    let s = newGame('t', 'kr', 0, { seed: 9 });
    const owner = { ...s.world.owner };
    for (const c of CITIES.slice(0, 20)) owner[c.id] = 'kr';
    s = { ...s, world: { ...s.world, owner } };
    expect(victoryProgress(s).mine).toBeGreaterThanOrEqual(20);
    expect(checkVictory(s).ending).toBeNull(); // 아직 총사령관 아님
    const { HOLD_DAYS } = await import('./victory');
    let w = checkVictory(setRank(s, 10));
    expect(w.ending).toBeNull(); // 막 채움: 지키는 중
    w = checkVictory({ ...w, worldMs: w.worldMs + HOLD_DAYS * 24 * 3600e3 });
    expect(w.ending?.kind).toBe('정복 승리');
    expect(w.ending?.captured.length).toBeGreaterThan(10);
  });
});
