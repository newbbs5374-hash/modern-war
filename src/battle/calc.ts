// 모든 전투 틀이 같이 쓰는 계산기: 명중 · 피해 · 상성 · 사기 · 엄폐.
// 같은 씨앗이면 같은 결과(자동전투 = 즉시완료 결과가 같도록).
import { Rng } from '../game/rng';

export type UnitKind = '소총' | '저격' | '기관총' | '의무' | '전차' | '인질' | '구축함' | '잠수함';
export type Terrain = '평지' | '숲' | '건물' | '물' | '언덕';

/** 병과 기본 수치(전투 틀 공통) */
export const UNIT_BASE: Record<UnitKind, { hp: number; atk: number; def: number; move: number; range: number; sight: number; icon: string }> = {
  소총: { hp: 10, atk: 4, def: 1, move: 3, range: 2, sight: 4, icon: '🪖' },
  저격: { hp: 7, atk: 6, def: 0, move: 2, range: 4, sight: 5, icon: '🎯' },
  기관총: { hp: 11, atk: 5, def: 1, move: 2, range: 3, sight: 4, icon: '🔫' },
  의무: { hp: 8, atk: 2, def: 0, move: 3, range: 1, sight: 4, icon: '⛑️' },
  전차: { hp: 22, atk: 7, def: 4, move: 3, range: 3, sight: 3, icon: '🛡️' },
  구축함: { hp: 16, atk: 5, def: 2, move: 3, range: 3, sight: 4, icon: '🚢' },
  잠수함: { hp: 12, atk: 7, def: 1, move: 2, range: 2, sight: 3, icon: '⚓' },
  인질: { hp: 10, atk: 0, def: 0, move: 3, range: 0, sight: 2, icon: '🙋' },
};

/** 상성: 공격 병과 → 맞는 병과 배율(없으면 1) */
export const TYPE_MULT: Partial<Record<UnitKind, Partial<Record<UnitKind, number>>>> = {
  전차: { 소총: 1.3, 저격: 1.3, 기관총: 1.2, 의무: 1.3 },
  기관총: { 소총: 1.2, 의무: 1.2, 전차: 0.5 },
  저격: { 기관총: 1.25, 저격: 1.2, 전차: 0.4 },
  소총: { 전차: 0.6 },
  구축함: { 잠수함: 1.3 },
  잠수함: { 구축함: 1.4 },
  의무: { 전차: 0.3 },
};
export const typeMult = (a: UnitKind, d: UnitKind) => TYPE_MULT[a]?.[d] ?? 1;

/** 지형: 엄폐(명중 깎음) · 이동 비용(0 = 못 감) */
export const TERRAIN: Record<Terrain, { cover: number; cost: number; icon: string }> = {
  평지: { cover: 0, cost: 1, icon: '' },
  숲: { cover: 0.2, cost: 2, icon: '🌲' },
  건물: { cover: 0.3, cost: 1, icon: '🏢' },
  언덕: { cover: 0.1, cost: 2, icon: '⛰️' },
  물: { cover: 0, cost: 0, icon: '' },
};

export const BASE_HIT = 0.8;
export const FLANK_MULT = 1.25;
export const HEIGHT_MULT = 1.15;
export const AMBUSH_MULT = 1.5;
export const LOW_MORALE = 30;
export const LOW_MORALE_MULT = 0.8;
export const MORALE_LOSS_ON_DEATH = 15;
export const MORALE_GAIN_ON_KILL = 5;

/** 명중 확률: 기본 80% − 엄폐 − 거리(1칸 넘을 때마다), 저격은 멀어도 덜 빗나감 */
export function hitChance(kind: UnitKind, cover: number, dist: number, bonus = 0): number {
  const perTile = kind === '저격' ? 0.02 : 0.05;
  const base = BASE_HIT + (kind === '저격' ? 0.1 : 0) + bonus;
  return Math.min(0.97, Math.max(0.15, base - cover - Math.max(0, dist - 1) * perTile));
}

/** 피해: 공격력 × 배율 × (0.85~1.15) × 방어 감쇠. 최소 1 */
export function rollDamage(rng: Rng, atk: number, def: number, mult: number): number {
  const raw = atk * mult * rng.range(0.85, 1.15) * (10 / (10 + def * 2));
  return Math.max(1, Math.round(raw));
}

/** 사기에 따른 공격 배율 */
export const moraleMult = (morale: number) => (morale < LOW_MORALE ? LOW_MORALE_MULT : 1);

/** 장교 스탯 → 전투 보정(모든 틀 공통) */
export interface CombatBonus {
  atkMult: number;
  hpAdd: number;
  sightAdd: number;
  moveAdd: number;
  morale: number;
  /** 적 시야 깎기(은밀) */
  stealth: number;
  /** 명중 보너스(사격) */
  hit: number;
}

export function combatBonus(stats: Record<string, number>): CombatBonus {
  const s = (k: string) => stats[k] ?? 8;
  return {
    atkMult: 1 + (s('사격') - 8) / 50,
    hpAdd: Math.floor((s('체력') - 8) / 4),
    sightAdd: s('정보') >= 20 ? 1 : 0,
    moveAdd: s('전술') >= 30 ? 1 : 0,
    morale: Math.min(100, 60 + s('통솔')),
    stealth: s('은밀') >= 18 ? 1 : 0,
    hit: Math.min(0.1, (s('사격') - 8) / 200),
  };
}
