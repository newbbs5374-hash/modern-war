// AI 나라 성장(11-26 대장 요청): AI 지도자가 성향대로 나라 예산을 써서 자기 나라를 키운다.
// 갈래 5개(경제·군비·기술·요새·세력)마다 단계(0~GROW_MAX)가 있고, 단계마다 실제 힘이 붙는다.
// 이 파일은 효과만 계산(world.ts·state.ts가 씀). 판단(돈 쓰기)은 aiGrowthTick.ts.

import type { Personality } from '../data/leaders';
import type { WorldState } from './world';

export type GrowTrack = 'eco' | 'army' | 'tech' | 'fort' | 'reach';
export const GROW_TRACKS: GrowTrack[] = ['eco', 'army', 'tech', 'fort', 'reach'];

export interface AiGrow {
  /** 갈래별 단계 */
  lv: Record<GrowTrack, number>;
  /** 지금 전략 이름(화면 표시) */
  plan: string;
  /** 이번 판에 성장에 쓴 나라 예산 합계 */
  spent: number;
}

/** 갈래 하나 최고 단계 */
export const GROW_MAX = 30;

export const GROW_INFO: Record<GrowTrack, { icon: string; name: string; eff: string; per: number }> = {
  eco: { icon: '🏭', name: '경제', eff: '나라 예산', per: 0.03 },
  army: { icon: '🎖️', name: '군비', eff: '모병', per: 0.04 },
  tech: { icon: '🔬', name: '기술', eff: '병사 한 명의 힘', per: 0.02 },
  fort: { icon: '🏰', name: '요새', eff: '도시 수비 힘·방어도 회복', per: 0.03 },
  reach: { icon: '🌐', name: '세력', eff: '침공 횟수·바다 건너 힘·분쟁 지역 영향력', per: 0.04 },
};

/** 성향마다 기본 전략: 갈래 가중치와 이름 */
export const PLAN_BY_PERS: Record<Personality, { name: string; text: string; w: Record<GrowTrack, number> }> = {
  공격형: { name: '군비 확장', text: '군대·기술·세력에 먼저 돈을 써요', w: { eco: 1.5, army: 4, tech: 2.5, fort: 1, reach: 3 } },
  방어형: { name: '철벽 방어', text: '요새·기술을 쌓고 경제를 챙겨요', w: { eco: 2, army: 2, tech: 3, fort: 4, reach: 0.5 } },
  경제형: { name: '부국 우선', text: '돈을 불리고 기술에 투자해요. 군대는 나중에', w: { eco: 5, army: 1, tech: 3, fort: 1.5, reach: 1 } },
  기회주의: { name: '틈새 노리기', text: '맞수보다 뒤진 갈래를 따라잡고 상황 따라 바꿔요', w: { eco: 2, army: 2, tech: 2, fort: 2, reach: 2 } },
};

/** 나라마다 잘하는 갈래(나라 특징과 맞춤): 가중치 ×1.5, 값 15% 쌈 */
export const NATION_FOCUS: Record<string, GrowTrack> = {
  us: 'reach', cn: 'eco', ru: 'army', de: 'eco', jp: 'tech', uk: 'tech', in: 'army',
  kr: 'tech', tr: 'reach', il: 'tech', ir: 'army', ua: 'fort', kp: 'army',
};
export const FOCUS_WEIGHT = 1.5;
export const FOCUS_DISCOUNT = 0.85;

/** 단계 하나 값 = 그 나라 하루 기본 예산 × (1 + 단계 + 0.12·단계²). 주력 갈래 30단계까지 한 판(2~3개월) 내내 걸림 */
export function growCost(lv: number): number {
  return 1 + lv + 0.12 * lv * lv;
}

/** 10·20·30단계에 이루는 나라 사업 이름 */
export const MILESTONES: Record<GrowTrack, [string, string, string]> = {
  eco: ['산업 단지 완성', '세계의 공장', '경제 초강대국'],
  army: ['징병 체계 정비', '대군 육성', '총동원 체제'],
  tech: ['정밀 유도 무기', '스텔스 전력', '차세대 전쟁 기술'],
  fort: ['국경 요새선', '다층 방공망', '난공불락'],
  reach: ['원정군 창설', '해외 기지망', '세계 패권'],
};

export const newGrow = (plan = ''): AiGrow => ({ lv: { eco: 0, army: 0, tech: 0, fort: 0, reach: 0 }, plan, spent: 0 });

const lvOf = (w: WorldState, id: string, t: GrowTrack) => w.grow?.[id]?.lv[t] ?? 0;

/** 나라 예산 배율 */
export const growBudget = (w: WorldState, id: string) => 1 + lvOf(w, id, 'eco') * GROW_INFO.eco.per;
/** 모병 배율 */
export const growTroop = (w: WorldState, id: string) => 1 + lvOf(w, id, 'army') * GROW_INFO.army.per;
/** 병사 한 명의 힘 배율(공격·수비 모두) */
export const growQuality = (w: WorldState, id: string) => 1 + lvOf(w, id, 'tech') * GROW_INFO.tech.per;
/** 수비 힘 배율 */
export const growFort = (w: WorldState, id: string) => 1 + lvOf(w, id, 'fort') * GROW_INFO.fort.per;
/** 도시 방어도 회복 배율 */
export const growRegen = (w: WorldState, id: string) => 1 + lvOf(w, id, 'fort') * 0.05;
/** 침공 횟수 배율 */
export const growReach = (w: WorldState, id: string) => 1 + lvOf(w, id, 'reach') * GROW_INFO.reach.per;
/** 바다 건너 침공 벌칙을 줄이는 몫(0~0.6) */
export const growOverseas = (w: WorldState, id: string) => Math.min(0.6, lvOf(w, id, 'reach') * 0.02);
/** 성장 단계 합(나라 힘 순위용) */
export const growTotal = (w: WorldState, id: string) => GROW_TRACKS.reduce((a, t) => a + lvOf(w, id, t), 0);
