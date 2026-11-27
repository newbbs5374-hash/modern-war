// 11-27 연구 비용: 시대 배율(A) · 예산·자원(B) · 가속권 한 장 = 연구 2점(C)
import { describe, expect, it } from 'vitest';
import { newGame, type GameState } from './state';
import * as C from './civ';
import { TECHS, TECH_PTS_PER_BOOST, techById } from '../data/civ';
import { boostLeft, BOOST_MS, useBoost } from './boost';

const withMoney = (s: GameState, money: number, res = 500): GameState => ({
  ...s,
  nations: { ...s.nations, [s.player.countryId]: { ...s.nations[s.player.countryId], treasury: money } },
  economy: { ...s.economy, stock: Object.fromEntries(Object.keys(s.economy.stock).map((k) => [k, res])) as GameState['economy']['stock'] },
  officer: { ...s.officer, boosts: 100 },
});
const me = (s: GameState) => s.nations[s.player.countryId];

describe('연구 비용(11-27)', () => {
  it('A: 뒤 시대일수록 한 단계가 오래 걸림', () => {
    const s = newGame('t', 'kr', 0, { seed: 1 });
    const e4 = TECHS.find((t) => t.era === 4)!;
    const e1 = TECHS.find((t) => t.era === 1)!;
    expect(C.techCost(s, e4)).toBeCloseTo(e4.hours * 2.25);
    expect(C.techCost(s, e1)).toBeCloseTo(e1.hours);
  });
  it('B: 시작할 때 3단계 값을 한꺼번에 내고, 바꿨다가 돌아와도 다시 내지 않음', () => {
    let s = withMoney(newGame('t', 'kr', 0, { seed: 1 }), 100000);
    const t = techById('m-drone')!;
    const p = C.techPrice(s, t);
    expect(p.money).toBe(200 * t.hours * t.era * 3);
    const m0 = me(s).treasury;
    s = C.startResearch(s, t.id);
    expect(C.civOf(s).cur.mil).toBe(t.id);
    expect(me(s).treasury).toBe(m0 - p.money);
    expect(C.techPrice(s, t).money).toBe(0);
    // 다른 연구로 바꿨다가 돌아옴
    s = C.startResearch(s, 'm-mech');
    const m1 = me(s).treasury;
    s = C.startResearch(s, t.id);
    expect(me(s).treasury).toBe(m1);
  });
  it('B: 2시대부터는 자원도 내고, 모자라면 시작 못 함', () => {
    const t = TECHS.find((x) => x.era === 2 && x.line === 'soc')!;
    let s = withMoney(newGame('t', 'kr', 0, { seed: 1 }), 1e7, 0);
    s = { ...s, civ: { ...C.civOf(s), done: [...C.civOf(s).done, ...t.needs, ...t.needs.flatMap((n) => techById(n)!.needs)] } };
    expect(C.canResearch(s, t.id)).toBeNull();
    expect(C.techPayWhy(s, t.id)).toMatch(/구리|리튬/);
    expect(C.startResearch(s, t.id)).toBe(s);
    s = withMoney(s, 1e7, 500);
    const ns = C.startResearch(s, t.id);
    expect(C.civOf(ns).cur.soc).toBe(t.id);
    expect(ns.economy.stock.구리).toBeLessThan(500);
    // 예산이 모자라도 못 함
    expect(C.techPayWhy(withMoney(s, 0, 500), t.id)).toMatch(/나라 예산/);
  });
  it('C: 가속권 한 장은 연구 속도와 상관없이 연구 2점', () => {
    let s = withMoney(newGame('t', 'kr', 0, { seed: 1 }), 1e7);
    const t = TECHS.find((x) => x.era === 1 && x.line === 'mil' && x.hours >= 1.5)!;
    s = C.startResearch(s, t.id);
    const left = C.techLeft(s, t);
    expect(Math.ceil((boostLeft(s, { kind: 'research', line: 'mil' })! - s.worldMs) / BOOST_MS)).toBe(Math.ceil(left / TECH_PTS_PER_BOOST));
    const ns = useBoost(s, { kind: 'research', line: 'mil' }, 1);
    expect(left - C.techLeft(ns, t)).toBeCloseTo(TECH_PTS_PER_BOOST);
  });
  it('옛 저장: 진행 중인 연구는 낸 것으로 침', () => {
    let s = newGame('t', 'kr', 0, { seed: 1 });
    s = { ...s, civ: { ...C.civOf(s), paid: undefined, progress: { 'm-arty': 0.3 } } };
    expect(C.techPaid(s, 'm-arty')).toBe(true);
    expect(C.techPrice(s, techById('m-arty')!).money).toBe(0);
  });
});
