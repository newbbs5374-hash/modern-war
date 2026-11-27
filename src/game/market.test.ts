// 11-28 나라별 시세: 무한 돈(사서 되팔기)과 AI 국고 마이너스(11-27 점검 오류 1·2)가 막혔는지
import { describe, expect, test } from 'vitest';
import { newGame, type GameState } from './state';
import { applyContracts, addContract, buyCost, canTrade, MARKET_DAY_CAP, producesOf, sellGain, trade, tradePartners, tradePrice } from './economy';
import type { Res } from '../data/economy';

const rich = (s: GameState): GameState => ({ ...s, nations: { ...s.nations, [s.player.countryId]: { ...s.nations[s.player.countryId], treasury: 1e9 } } });

function bestArb(s: GameState) {
  let best = { gain: -Infinity, a: '', b: '', r: '' as Res };
  for (const a of tradePartners(s)) for (const r of producesOf(s, a)) for (const b of tradePartners(s)) {
    if (a === b) continue;
    const g = sellGain(s, b, r, 1) - buyCost(s, a, r, 1);
    if (g > best.gain) best = { gain: g, a, b, r };
  }
  return best;
}

describe('나라별 시세', () => {
  test('사서 되팔기를 아무리 해도 하루 이익에 한도가 있음', () => {
    let s = rich(newGame('t', 'kr', 0, { seed: 3, realWorld: true }));
    const { a, b, r } = bestArb(s);
    const t0 = s.nations.kr.treasury;
    for (let i = 0; i < 200; i++) {
      if (canTrade(s, a, r, 10, true)) break;
      s = trade(s, a, r, 10, true);
      if (canTrade(s, b, r, 10, false)) break;
      s = trade(s, b, r, 10, false);
    }
    const profit = s.nations.kr.treasury - t0;
    // 하루 한도 300개 × 1개 값 정도를 넘지 않음
    expect(profit).toBeLessThan(MARKET_DAY_CAP * tradePrice(s, a, r));
    expect(canTrade(s, a, r, 10, true)).toMatch(/한도|남은|개만/);
  });
  test('많이 사면 값이 오름', () => {
    let s = rich(newGame('t', 'kr', 0, { seed: 3, realWorld: true }));
    const a = tradePartners(s).find((id) => producesOf(s, id).length)!;
    const r = producesOf(s, a)[0];
    const p0 = tradePrice(s, a, r);
    s = trade(s, a, r, 100, true);
    expect(tradePrice(s, a, r)).toBeGreaterThan(p0 * 1.4);
  });
  test('상대 국고가 바닥이면 사 주지 못함(마이너스 안 됨)', () => {
    let s = newGame('t', 'kr', 0, { seed: 3, realWorld: true });
    const b = tradePartners(s)[0];
    s = { ...s, nations: { ...s.nations, [b]: { ...s.nations[b], treasury: 10 } }, economy: { ...s.economy, stock: { ...s.economy.stock, 강철: 100 } } };
    expect(canTrade(s, b, '강철', 50, false)).toMatch(/국고/);
    s = addContract(s, b, '강철', 10, false);
    s = applyContracts(s, 3600e3);
    expect(s.nations[b].treasury).toBeGreaterThanOrEqual(0);
  });
});
