// 11-27 나라가 커지면 예산이 늘게: 점령 세금·규모 보너스·비용 고정·전리품·국방비 옮기기
import { describe, expect, it } from 'vitest';
import { CITIES, FRONT } from '../data/cities';
import { budgetPerDay, newGame, priceBase, sizeBonus, type GameState } from './state';
import { noteCapture } from './territory';
import { incomeShare, spoilsOf } from './world';
import { megaCost } from './megaPlan';
import { canMoveDef, moveDefToNation } from './defFund';
import { annexGrant } from './annex';

function take(s: GameState, ids: string[]): GameState {
  const w = { ...s.world, owner: { ...s.world.owner } };
  for (const id of ids) {
    noteCapture(w, id, s.player.countryId);
    w.owner[id] = s.player.countryId;
  }
  return { ...s, world: w };
}
const citiesOf = (id: string) => CITIES.filter((c) => c.home === id).map((c) => c.id);

describe('나라 커질수록 예산', () => {
  it('점령 도시 세금은 나라 예산에선 60%(병력은 그대로 50%)', () => {
    const s = take(newGame('t', 'kr', 0, { seed: 1 }), citiesOf('jp'));
    const troop = incomeShare(s.world, 'kr');
    const budget = incomeShare(s.world, 'kr', true);
    expect(budget).toBeGreaterThan(troop);
  });
  it('본토보다 커지면 규모 보너스, 최대 +40%', () => {
    expect(sizeBonus(1)).toBe(1);
    expect(sizeBonus(1.5)).toBeCloseTo(1.1);
    expect(sizeBonus(9)).toBeCloseTo(1.4);
  });
  it('땅이 늘면 수입은 늘지만 내정 비용은 그대로', () => {
    const s0 = newGame('t', 'kr', 0, { seed: 1 });
    const s1 = take(s0, [...citiesOf('jp'), ...citiesOf('cn')]);
    expect(budgetPerDay(s1, 'kr')).toBeGreaterThan(budgetPerDay(s0, 'kr') * 1.5);
    // 다른 배율(도시 민심·패권 등)만 조금 움직이고 땅 크기만큼은 안 커짐
    expect(priceBase(s1) / priceBase(s0)).toBeLessThan(1.1);
    expect(megaCost(s1, 'space') / megaCost(s0, 'space')).toBeLessThan(1.1);
  });
  it('수도 차지하면 국고 25%, 내정 도시 전리품도', () => {
    const s = newGame('t', 'kr', 0, { seed: 1 });
    const cap = FRONT.find((c) => c.home === 'jp' && c.capital)!;
    const w = { ...s.world, owner: { ...s.world.owner, [cap.id]: 'kr' } };
    const sp = spoilsOf(w, cap.id, 'jp', 10000);
    expect(sp.take).toBe(2500);
    const other = FRONT.find((c) => c.home === 'jp' && !c.capital)!;
    const sp2 = spoilsOf({ ...s.world, owner: { ...s.world.owner, [other.id]: 'kr' } }, other.id, 'jp', 10000);
    expect(sp2.take).toBe(600);
  });
  it('편입 지원금은 따라오는 도시까지', () => {
    const hub = FRONT.find((c) => CITIES.some((x) => !x.front && x.hub === c.id))!;
    expect(annexGrant(hub.id)).toBeGreaterThan(Math.round(hub.value * 1200));
  });
  it('국방비 → 나라 예산 옮기기(25%, 10% 사라짐)', () => {
    const s = newGame('t', 'kr', 0, { seed: 1 });
    const n = s.nations.kr;
    expect(canMoveDef(s)).toBeNull();
    const t = moveDefToNation(s);
    const from = Math.floor((n.def ?? 0) * 0.25);
    expect(t.nations.kr.def).toBe((n.def ?? 0) - from);
    expect(t.nations.kr.treasury).toBe(n.treasury + Math.floor(from * 0.9));
  });
});
