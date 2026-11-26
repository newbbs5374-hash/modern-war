// 국가 예산 나누기(국방·외교·사회·경제 %) · 세금 3단계. 경제 → 예산·세금 탭.
// 다른 계산(나라 예산·자원·모집·징병·민심·호감·분야 점수)이 이 값을 읽어요. 이 파일은 다른 게임 파일을 부르지 않아요(순환 막기).
import type { GameState } from './state';

export type SplitKey = 'def' | 'dip' | 'soc' | 'eco';
export type Split = Record<SplitKey, number>;
export type Tax = 'low' | 'mid' | 'high';

export const SPLIT_DEFAULT: Split = { def: 40, dip: 20, soc: 20, eco: 20 };
export const SPLIT_MIN = 5;
export const SPLIT_MAX = 70;
export const SPLIT_STEP = 5;
/** 예산·세금은 실제 1시간(게임 하루)에 한 번 바꿀 수 있어요 */
export const POLICY_COOLDOWN_MS = 3600e3;

export const SPLIT_INFO: Array<{ key: SplitKey; icon: string; name: string; does: string }> = [
  { key: 'def', icon: '🛡️', name: '국방', does: '부대 모집 속도 · 징병 · 안보 점수' },
  { key: 'dip', icon: '🌐', name: '외교', does: '모든 나라 호감 · 외교 위상' },
  { key: 'soc', icon: '👥', name: '사회', does: '모든 도시 민심(→ 지지도)' },
  { key: 'eco', icon: '💰', name: '경제', does: '나라 예산·자원 생산 · 경제 지수' },
];
export const TAX_INFO: Record<Tax, { icon: string; name: string; budget: number; approval: number; text: string }> = {
  low: { icon: '🪶', name: '낮음', budget: 0.85, approval: 6, text: '나라 예산 −15% · 지지도 +6' },
  mid: { icon: '⚖️', name: '보통', budget: 1, approval: 0, text: '그대로' },
  high: { icon: '🏦', name: '높음', budget: 1.2, approval: -10, text: '나라 예산 +20% · 지지도 −10' },
};

export interface PolicyState {
  split: Split;
  tax: Tax;
  /** 마지막으로 예산 나누기·세금을 바꾼 세계 시각 */
  changedMs: number | null;
  taxMs?: number | null;
}
export function newPolicy(): PolicyState {
  return { split: { ...SPLIT_DEFAULT }, tax: 'mid', changedMs: null, taxMs: null };
}
export function policyOf(s: GameState): PolicyState {
  return s.policy ?? newPolicy();
}
export const splitOf = (s: GameState): Split => policyOf(s).split;
export const taxOf = (s: GameState): Tax => policyOf(s).tax;

/* ───────── 효과(기본 나누기 40/20/20/20이면 모두 0 · ×1) ───────── */
/** 국방 예산 → 모집 빠르기 배율(70%면 +24%, 10%면 −24%) */
export const splitBuild = (s: GameState) => 1 + (splitOf(s).def - SPLIT_DEFAULT.def) * 0.008;
/** 국방 예산 → 징병 배율 */
export const splitTroop = (s: GameState) => 1 + (splitOf(s).def - SPLIT_DEFAULT.def) * 0.005;
/** 외교 예산 → 모든 나라 호감 덤 */
export const splitFavor = (s: GameState) => (splitOf(s).dip - SPLIT_DEFAULT.dip) * 0.3;
/** 사회 예산 → 모든 도시 민심 목표 덤 */
export const splitLoyalty = (s: GameState) => (splitOf(s).soc - SPLIT_DEFAULT.soc) * 0.35;
/** 경제 예산 → 나라 예산·자원 배율(50%면 +18%) */
export const splitEco = (s: GameState) => 1 + (splitOf(s).eco - SPLIT_DEFAULT.eco) * 0.006;
/** 분야 점수 덤 */
export const splitDefenseScore = (s: GameState) => (splitOf(s).def - SPLIT_DEFAULT.def) * 0.25;
export const splitDiploScore = (s: GameState) => (splitOf(s).dip - SPLIT_DEFAULT.dip) * 0.4;
export const splitEcoScore = (s: GameState) => (splitOf(s).eco - SPLIT_DEFAULT.eco) * 0.3;
/** 세금 → 나라 예산 배율 · 지지도 목표 덤 */
export const taxBudget = (s: GameState) => TAX_INFO[taxOf(s)].budget;
export const taxApproval = (s: GameState) => TAX_INFO[taxOf(s)].approval;

/** 바꾸기까지 남은 시간(ms), 0이면 지금 바꿀 수 있음 */
export function policyWait(s: GameState, what: 'split' | 'tax' = 'split'): number {
  const p = policyOf(s);
  const c = what === 'split' ? p.changedMs : (p.taxMs ?? null);
  return c === null ? 0 : Math.max(0, c + POLICY_COOLDOWN_MS - s.worldMs);
}

export function splitProblem(split: Split): string | null {
  const keys = Object.keys(SPLIT_DEFAULT) as SplitKey[];
  const total = keys.reduce((a, k) => a + split[k], 0);
  if (total !== 100) return `합이 100%여야 해요(지금 ${total}%)`;
  for (const k of keys) {
    if (split[k] < SPLIT_MIN) return `한 분야는 ${SPLIT_MIN}% 아래로 줄일 수 없어요`;
    if (split[k] > SPLIT_MAX) return `한 분야는 ${SPLIT_MAX}%를 넘길 수 없어요`;
    if (split[k] % SPLIT_STEP) return `${SPLIT_STEP}% 단위로 나눠요`;
  }
  return null;
}
export function canSetPolicy(s: GameState, what: 'split' | 'tax' = 'split'): string | null {
  const w = policyWait(s, what);
  return w > 0 ? `다음 변경까지 ${Math.ceil(w / 60000)}분` : null;
}
export function setSplit(s: GameState, split: Split): GameState {
  if (splitProblem(split) || canSetPolicy(s)) return s;
  const p = policyOf(s);
  return { ...s, policy: { ...p, split: { ...split }, changedMs: s.worldMs } };
}
export function setTax(s: GameState, tax: Tax): GameState {
  const p = policyOf(s);
  if (p.tax === tax || canSetPolicy(s, 'tax')) return s;
  return { ...s, policy: { ...p, tax, taxMs: s.worldMs } };
}
