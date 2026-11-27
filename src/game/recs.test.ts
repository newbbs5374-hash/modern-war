// 11-28 장관 추천·은혜 장부·파병 7곳
import { describe, expect, test } from 'vitest';
import { newGame, type GameState } from './state';
import { allRecs, morningBrief, pickRecs, recLogOf, recTick, runRec, setAuto } from './recs';
import { DEPLOY_MAX, deployMax, oweOf } from './deploy';
import { buyCost, oweCut, producesOf, sellGain, tradePartners } from './economy';

const rich = (s: GameState): GameState => ({ ...s, nations: { ...s.nations, [s.player.countryId]: { ...s.nations[s.player.countryId], treasury: 1e8 } } });
const base = () => rich(newGame('t', 'kr', 0, { seed: 5, realWorld: true }));

describe('장관 추천', () => {
  test('남는 자원이 있으면 팔기 추천, 실행하면 돈이 늘고 자원이 줆', () => {
    let s = base();
    s = { ...s, economy: { ...s.economy, stock: { ...s.economy.stock, 희토류: 200 } } };
    const r = allRecs(s, 'economy').find((x) => x.id.startsWith('sell:희토류'));
    expect(r).toBeTruthy();
    const t0 = s.nations.kr.treasury;
    const ns = runRec(s, 'economy', r!.id);
    expect(ns.nations.kr.treasury).toBeGreaterThan(t0);
    expect(ns.economy.stock.희토류).toBeLessThan(200);
    expect(Object.values(recLogOf(ns).score)[0].n).toBe(1);
  });
  test('중계 무역 추천은 실제로 이득', () => {
    const s = base();
    const r = allRecs(s, 'economy').find((x) => x.id.startsWith('relay:'));
    if (!r) return; // 값 차이가 없는 판도 있음
    const ns = runRec(s, 'economy', r.id);
    expect(ns.nations.kr.treasury).toBeGreaterThan(s.nations.kr.treasury);
  });
  test('장관이 없으면 비서실 1개만', () => {
    const s = base();
    const v = pickRecs(s, 'economy', 3);
    if (!v.advisor) expect(v.list.length).toBeLessThanOrEqual(1);
    expect(morningBrief(s, 5).length).toBeLessThanOrEqual(5);
  });
  test('분야 맡기기는 처음엔 꺼짐, 켜면 1시간마다 실행', () => {
    let s = base();
    s = { ...s, economy: { ...s.economy, stock: { ...s.economy.stock, 희토류: 200 } } };
    expect(recLogOf(s).auto.economy).toBeFalsy();
    expect(recTick(s)).toBe(s);
    s = setAuto(s, 'economy', true);
    const ns = recTick(s);
    expect(ns.recLog!.autoMs.economy).toBe(s.worldMs);
  });
});

describe('파병 7곳 · 은혜', () => {
  test('호칭에 따라 5→7곳', () => {
    const s = base();
    expect(deployMax({ ...s, player: { ...s.player, rankIndex: 0 } })).toBe(5);
    expect(deployMax({ ...s, player: { ...s.player, rankIndex: 10 } })).toBe(DEPLOY_MAX);
  });
  test('은혜만큼 살 때만 싸지고 팔 때 값은 그대로', () => {
    const s = base();
    const id = tradePartners(s).find((x) => producesOf(s, x).length)!;
    const r = producesOf(s, id)[0];
    const s2: GameState = { ...s, deploy: { list: [], next: 1, owe: { [id]: 5 } } };
    expect(oweOf(s2, id)).toBe(5);
    expect(oweCut(s2, id)).toBeCloseTo(0.95);
    expect(buyCost(s2, id, r, 10)).toBeLessThan(buyCost(s, id, r, 10));
    expect(sellGain(s2, id, r, 10)).toBe(sellGain(s, id, r, 10));
  });
});
