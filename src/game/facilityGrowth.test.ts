import { describe, expect, it } from 'vitest';
import { newGame } from './state';
import { canUpgrade } from './economy';
import { facilityEffects, fieldTier } from './facility';
import { effSum } from './civ';
import { BUILDINGS, CHORES } from '../data/economy';
import { FAC_EFF, FAC_MILESTONE } from '../data/facilityGrowth';
import { BUILDING_KEY } from '../ui/iconArt';

const withLv = (s: ReturnType<typeof newGame>, lv: Record<string, number>) => ({
  ...s,
  economy: { ...s.economy, buildings: { ...s.economy.buildings, ...Object.fromEntries(Object.entries(lv).map(([k, v]) => [k, { level: v, buildEndMs: 0, buffEndMs: 0 }])) } },
});

describe('시설 단계별 성장(11-24)', () => {
  it('시설 31개 모두 업무·그림 이름·단계 보너스가 있음', () => {
    for (const b of BUILDINGS) {
      expect(CHORES[b.id]).toBeTruthy();
      expect(BUILDING_KEY[b.id]).toBeTruthy();
      expect(FAC_MILESTONE[b.id][3].text).toBeTruthy();
    }
    expect(new Set(Object.values(BUILDING_KEY)).size).toBe(Object.keys(BUILDING_KEY).length);
    expect(Object.keys(FAC_EFF).length).toBe(16);
  });
  it('새 게임은 시설 효과 0(아무 보너스 없음)', () => {
    const s = newGame('t', 'kr', 0, { seed: 1 });
    expect(facilityEffects(s)).toEqual([]);
  });
  it('먼저 지을 시설이 모자라면 못 지음', () => {
    const s = newGame('t', 'kr', 0, { seed: 1 });
    expect(canUpgrade(s, '반도체팹')).toBe('첨단공단 2단계 필요');
    expect(canUpgrade(withLv(s, { 첨단공단: 2 }), '반도체팹')).not.toBe('첨단공단 2단계 필요');
  });
  it('새 시설은 단계만큼 효과, 3단계에 보너스', () => {
    const s = newGame('t', 'kr', 0, { seed: 1 });
    const base = effSum(s, 'research');
    const a = effSum(withLv(s, { 기초과학연구원: 1 }), 'research') - base;
    const c = effSum(withLv(s, { 기초과학연구원: 3 }), 'research') - base;
    expect(a).toBeCloseTo(0.012, 5);
    expect(c).toBeCloseTo(0.12 * 0.45, 5);
    expect(effSum(withLv(s, { 기초과학연구원: 3 }), 'growth') - effSum(s, 'growth')).toBeCloseTo(0.05, 5);
  });
  it('분야 성장 단계', () => {
    const s = newGame('t', 'kr', 0, { seed: 1 });
    expect(fieldTier(s, '과학')).toBe(0);
    const all = Object.fromEntries(BUILDINGS.filter((b) => b.fac === '과학').map((b) => [b.id, 5]));
    expect(fieldTier(withLv(s, all), '과학')).toBe(5);
  });
});
