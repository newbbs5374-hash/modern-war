// 법안·법(11-23 기획 ⑤): 법안 카드와 통과된 법의 효과. 계산 파일을 부르지 않아 어디서든 읽을 수 있어요.
// 국회 표결·재신임 투표 시간 흐름은 assembly.ts
import type { GameState } from './state';

const H = 3600e3;
/** 통과된 법이 살아 있는 기간(실제 7일) */
export const LAW_DAYS = 7;
export const LAW_MS = LAW_DAYS * 24 * H;
/** 한꺼번에 살아 있을 수 있는 법 */
export const LAW_MAX = 4;

export type LawKey = 'build' | 'troop' | 'budget' | 'res' | 'research' | 'spy' | 'favor' | 'loyalty' | 'approval' | 'trust' | 'defense' | 'diplo' | 'society' | 'economy';
export type BillId =
  | 'defauth' | 'draft' | 'aid' | 'freetrade' | 'taxcut' | 'richtax' | 'welfare' | 'police' | 'science' | 'intel' | 'anticorrupt' | 'media';
export interface Bill {
  id: BillId;
  icon: string;
  name: string;
  text: string;
  eff: Partial<Record<LawKey, number>>;
  /** 표결이 어려운 정도(통과 확률에서 뺌) */
  hard: number;
}
export const BILLS: Bill[] = [
  { id: 'defauth', icon: '🛡️', name: '국방수권법', text: '모집 +8% · 안보 +4 · 경제 −2', eff: { build: 0.08, defense: 4, economy: -2 }, hard: 0.05 },
  { id: 'draft', icon: '🪖', name: '병역법 개정', text: '징병 +10% · 지지도 −2', eff: { troop: 0.1, approval: -2 }, hard: 0.1 },
  { id: 'aid', icon: '🌐', name: '해외 원조법', text: '모든 나라 호감 +4 · 외교 +4 · 예산 −3%', eff: { favor: 4, diplo: 4, budget: -0.03 }, hard: 0.05 },
  { id: 'freetrade', icon: '🚢', name: '무역 자유화법', text: '자원 +8% · 경제 +3', eff: { res: 0.08, economy: 3 }, hard: 0.05 },
  { id: 'taxcut', icon: '🪶', name: '감세법', text: '지지도 +4 · 예산 −6%', eff: { approval: 4, budget: -0.06 }, hard: 0 },
  { id: 'richtax', icon: '💰', name: '부자 증세법', text: '예산 +8% · 경제 −3', eff: { budget: 0.08, economy: -3 }, hard: 0.15 },
  { id: 'welfare', icon: '🏥', name: '복지 확대법', text: '모든 도시 민심 +4 · 사회 +3 · 예산 −4%', eff: { loyalty: 4, society: 3, budget: -0.04 }, hard: 0.05 },
  { id: 'police', icon: '🚓', name: '치안 강화법', text: '사회 +5 · 신뢰도 −2', eff: { society: 5, trust: -2 }, hard: 0.05 },
  { id: 'science', icon: '🔬', name: '과학 진흥법', text: '연구 +12% · 예산 −3%', eff: { research: 0.12, budget: -0.03 }, hard: 0.05 },
  { id: 'intel', icon: '🕵️', name: '국가정보법', text: '첩보 성공 +5% · 외교 −2', eff: { spy: 0.05, diplo: -2 }, hard: 0.1 },
  { id: 'anticorrupt', icon: '⚖️', name: '반부패법', text: '신뢰도 +4 · 지지도 +1', eff: { trust: 4, approval: 1 }, hard: 0.2 },
  { id: 'media', icon: '📺', name: '방송 개혁법', text: '지지도 +3 · 신뢰도 −1', eff: { approval: 3, trust: -1 }, hard: 0.1 },
];
export const billById = (id: BillId) => BILLS.find((b) => b.id === id)!;

export interface Law {
  id: BillId;
  untilMs: number;
}
export interface AssemblyState {
  seed: number;
  /** 지금 고를 수 있는 법안 카드 3장 */
  offer: BillId[];
  /** 카드를 새로 받는 시각 */
  offerMs: number;
  /** 표결 중인 법안 */
  vote: { id: BillId; endMs: number; chance: number } | null;
  laws: Law[];
  /** 다음 재신임 투표 시각 */
  confMs: number;
  /** 재신임 기록 */
  confWins: number;
  confLoss: number;
  /** 미리 알림을 했는지(하루 전) */
  confWarned: boolean;
  log: string[];
}

export const liveLaws = (s: GameState): Law[] => (s.assembly?.laws ?? []).filter((l) => l.untilMs > s.worldMs);
/** 살아 있는 법들의 효과 합 */
export function lawEff(s: GameState, key: LawKey): number {
  let v = 0;
  for (const l of liveLaws(s)) v += billById(l.id).eff[key] ?? 0;
  return v;
}
/** 화면용 한 줄 이름(살아 있는 법 중 이 효과를 가진 것) */
export function lawRows(s: GameState, key: LawKey): Array<[string, number]> {
  return liveLaws(s)
    .filter((l) => billById(l.id).eff[key])
    .map((l) => [`📜 ${billById(l.id).name}`, billById(l.id).eff[key]!]);
}
