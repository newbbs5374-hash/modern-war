import { describe, expect, it } from 'vitest';
import { newGame } from './state';
import { ORIGINS, originOpen } from './origin';
import { STAT_IDS } from '../data/officers';
import { approvalOf, fieldScore } from './approval';
import { researchRate } from './civ';

describe('지도자 출신 16가지', () => {
  it('16가지, 스탯 합은 72 그대로, 처음엔 10가지만 열림', () => {
    expect(ORIGINS.length).toBe(16);
    for (const o of ORIGINS) {
      const s = newGame('t', 'kr', 0, { seed: 1, origin: o.id });
      expect(STAT_IDS.reduce((a, id) => a + s.officer.stats[id], 0)).toBe(72);
      expect(s.player.origin).toBe(o.id);
    }
    expect(ORIGINS.filter((o) => originOpen(o, [])).length).toBe(10);
    expect(ORIGINS.filter((o) => originOpen(o, [{ kind: '정복 승리' }, { kind: '연합 승리' }, { kind: '평화 승리' }])).length).toBe(16);
  });
  it('출신이 출발점과 효과를 바꿈', () => {
    const base = newGame('t', 'kr', 0, { seed: 2 });
    const athlete = newGame('t', 'kr', 0, { seed: 2, origin: 'athlete' });
    expect(approvalOf(athlete)).toBeGreaterThan(approvalOf(base));
    expect(athlete.officer.trust).toBeLessThan(base.officer.trust);
    const econ = newGame('t', 'kr', 0, { seed: 2, origin: 'econ' });
    expect(fieldScore(econ, 'economy')).toBeGreaterThan(fieldScore(base, 'economy'));
    const sci = newGame('t', 'kr', 0, { seed: 2, origin: 'scientist' });
    expect(researchRate(sci)).toBeGreaterThan(researchRate(base));
    const chaebol = newGame('t', 'kr', 0, { seed: 2, origin: 'chaebol' });
    expect(chaebol.nations.kr.treasury).toBeCloseTo(base.nations.kr.treasury * 1.5);
  });
});
