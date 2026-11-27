// 11-27 종합 확장안 전투 5: 장군 지휘 기술.
// 대전투(3D)에 나갈 때 장군 한 명이 함께 가서, 막마다 한 번 지휘력 없이 기술을 씀.
// 기술은 장군 분야로 정해지고, 충성도 70 이상이면 두 번 연달아 떨어짐(더 셈).
import type { General, OfficerState } from './officer';

export type SkillCmd = 'arty' | 'smoke' | 'air' | 'cruise' | 'emp' | 'repair';
export const FIELD_SKILL: Record<General['field'], { k: SkillCmd; label: string }> = {
  합참: { k: 'smoke', label: '연막 차장' },
  육군: { k: 'arty', label: '포격 지원' },
  해군: { k: 'cruise', label: '함대 순항 미사일' },
  공군: { k: 'air', label: '정밀 공습' },
  정보: { k: 'emp', label: '야간 전자전 기습' },
  군수: { k: 'repair', label: '긴급 수리' },
};
export const SKILL_LOYAL = 70;
export interface GenSkill { name: string; k: SkillCmd; label: string; twice: boolean; loyalty: number }

/** 함께 나갈 장군: 능력 × 충성이 가장 높은 장군(충성 30 아래는 안 따라옴) */
export function battleGeneral(o: Pick<OfficerState, 'generals'>): General | null {
  const list = o.generals.filter((g) => g.loyalty >= 30);
  if (!list.length) return null;
  return [...list].sort((a, b) => b.skill * b.loyalty - a.skill * a.loyalty)[0];
}
export function genSkillOf(o: Pick<OfficerState, 'generals'>): GenSkill | null {
  const g = battleGeneral(o);
  if (!g) return null;
  const f = FIELD_SKILL[g.field];
  return { name: g.name, k: f.k, label: f.label, twice: g.loyalty >= SKILL_LOYAL, loyalty: g.loyalty };
}
