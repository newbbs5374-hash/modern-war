import { describe, expect, it } from 'vitest';
import { DEAL_BUDGET, DEAL_MS, DEAL_TROOPS, canDeal, dealSlots, firmCost, firmLv, growFirm, liveDeals, signDeal } from './arms';
import { favorOf } from './civ';
import { domEff, withDom } from './domestic';
import { newGame } from './state';
import { pairKey } from './world';

function rich() {
  const s = withDom(newGame('시험', 'kr', 0, { seed: 4 }), {});
  s.nations.kr.treasury = 1e9;
  for (const k of Object.keys(s.world.pairs)) if (s.world.pairs[k].rel === '전쟁') s.world.pairs[k].rel = '중립';
  return s;
}

describe('방산 기업과 수출', () => {
  it('기업을 키우면 예산이 줄고 다음 단계는 더 비싸다', () => {
    let s = rich();
    const c1 = firmCost(s, 'land');
    s = growFirm(s, 'land');
    expect(firmLv(s, 'land')).toBe(1);
    expect(s.nations.kr.treasury).toBe(1e9 - c1);
    expect(firmCost(s, 'land')).toBeGreaterThan(c1);
  });
  it('기업이 없으면 못 팔고, 전쟁 중인 나라에도 못 판다', () => {
    let s = rich();
    expect(canDeal(s, 'pl', 'air')).toBe('기업을 먼저 키워요');
    s = growFirm(s, 'air');
    expect(canDeal(s, 'pl', 'air')).toBeNull();
    s.world.pairs[pairKey('kr', 'kp')].rel = '전쟁';
    expect(canDeal(s, 'kp', 'air')).toBe('전쟁 중인 나라에는 못 팔아요');
  });
  it('계약하면 예산 덤·호감·사는 나라 병력이 오르고 3일 뒤 끝난다', () => {
    let s = growFirm(growFirm(rich(), 'sea'), 'sea');
    const b0 = domEff(s, 'budget');
    const f0 = favorOf(s, 'pl');
    const t0 = s.nations.pl.troops;
    s = signDeal(s, 'pl', 'sea');
    expect(liveDeals(s)).toHaveLength(1);
    expect(domEff(s, 'budget') - b0).toBeCloseTo(DEAL_BUDGET * 2);
    expect(favorOf(s, 'pl')).toBeGreaterThan(f0);
    expect(s.nations.pl.troops).toBe(t0 + DEAL_TROOPS * 2);
    expect(canDeal(s, 'pl', 'sea')).toBe('이미 계약 중인 나라예요');
    const later = { ...s, worldMs: s.worldMs + DEAL_MS + 1 };
    expect(liveDeals(later)).toHaveLength(0);
    expect(domEff(later, 'budget')).toBeCloseTo(b0);
  });
  it('계약 수는 기업 단계 합의 절반까지', () => {
    let s = growFirm(rich(), 'land');
    expect(dealSlots(s)).toBe(1);
    s = signDeal(s, 'pl', 'land');
    expect(canDeal(s, 'tr', 'land')).toContain('계약은 1건까지');
  });
  it('내 연합국과 싸우는 나라에 팔면 연합국이 싫어한다', () => {
    let s = growFirm(rich(), 'missile');
    s.world.pairs[pairKey('kr', 'us')].rel = '연합';
    s.world.pairs[pairKey('us', 'ir')].rel = '전쟁';
    const f0 = favorOf(s, 'us');
    s = signDeal(s, 'ir', 'missile');
    expect(favorOf(s, 'us')).toBeLessThan(f0);
  });
});
