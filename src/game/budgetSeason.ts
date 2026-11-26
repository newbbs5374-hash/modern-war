// A7 예산 국회 시즌(11/24): 실제 7일마다 예산안 철. 하루 안에 예산안(4가지)을 내면 6시간 뒤 국회 표결.
// 통과하면 다음 철까지 그 예산 효과, 부결(또는 안 냄)이면 준예산: 나라 예산 −5%·신뢰도 −3.
import type { GameState } from './state';
import type { LawKey } from './laws';
import { domLog, domOf, registerDomRows, snap, withDom, type Rows } from './domestic';
import { registerGroupRows } from './groups';
import { nextRandom } from './rng';

const H = 3600e3;
export const SEASON_MS = 7 * 24 * H;
export const WINDOW_MS = 24 * H;
export const VOTE_MS = 6 * H;

export interface BudgetPlan {
  id: string;
  icon: string;
  name: string;
  text: string;
  eff: Partial<Record<LawKey, number>>;
  groups: Partial<Record<string, number>>;
  /** 통과 확률 덤 */
  ease: number;
}
export const PLANS: BudgetPlan[] = [
  { id: 'tight', icon: '✂️', name: '긴축 예산', text: '나라 예산 +4% · 경제 −3 · 지지도 −2', eff: { budget: 0.04, economy: -3, approval: -2 }, groups: { biz: 4, labor: -6, civic: -3 }, ease: 0.05 },
  { id: 'even', icon: '⚖️', name: '균형 예산', text: '신뢰도 +2', eff: { trust: 2 }, groups: {}, ease: 0.15 },
  { id: 'grow', icon: '📈', name: '확장 예산', text: '경제 +5 · 지지도 +2 · 나라 예산 −4%', eff: { economy: 5, approval: 2, budget: -0.04 }, groups: { labor: 4, youth: 3, biz: -2 }, ease: -0.05 },
  { id: 'arms', icon: '🛡️', name: '국방 강화 예산', text: '모집 +5% · 안보 +3 · 경제 −2', eff: { build: 0.05, defense: 3, economy: -2 }, groups: { mil: 6, civic: -4 }, ease: 0 },
];
export const CUT = { eff: { budget: -0.05 } as Partial<Record<LawKey, number>>, text: '준예산: 나라 예산 −5%' };
export const planById = (id: string) => PLANS.find((p) => p.id === id);

export function planChance(s: GameState, id: string): number {
  return Math.max(0.15, Math.min(0.95, 0.4 + s.officer.trust / 200 + (planById(id)?.ease ?? 0)));
}
export function canSubmitBudget(s: GameState, id: string): string | null {
  const b = domOf(s).budget;
  if (!b.open) return '예산안 철이 아니에요';
  if (b.open.plan) return '이미 예산안을 냈어요';
  if (!planById(id)) return '없는 예산안이에요';
  return null;
}
export function submitBudget(s: GameState, id: string): GameState {
  if (canSubmitBudget(s, id)) return s;
  const b = domOf(s).budget;
  const ns = withDom(s, { budget: { ...b, open: { ...b.open!, plan: id, voteMs: s.worldMs + VOTE_MS, chance: planChance(s, id) } } });
  return domLog(ns, `📨 ${planById(id)!.icon} ${planById(id)!.name}을 국회에 냄(표결 6시간 뒤)`);
}

export function budgetTick(s: GameState): GameState {
  if (!s.dom) return s;
  let ns = s;
  let b = domOf(ns).budget;
  // 철이 열림
  if (!b.open && ns.worldMs >= b.nextMs) {
    b = { ...b, open: { untilMs: ns.worldMs + WINDOW_MS, plan: null, voteMs: null, chance: 0 }, nextMs: b.nextMs + SEASON_MS };
    ns = withDom(ns, { budget: b });
    ns = domLog(ns, '📅 예산안 철이에요! 하루 안에 예산안을 국회에 내세요');
  }
  // 안 내고 지나감 → 준예산
  if (b.open && !b.open.plan && ns.worldMs >= b.open.untilMs) {
    b = { ...b, open: null, active: { plan: 'cut', untilMs: b.nextMs, cut: true }, cut: b.cut + 1 };
    ns = withDom(ns, { budget: b });
    ns = { ...ns, officer: { ...ns.officer, trust: Math.max(0, ns.officer.trust - 3) } };
    ns = domLog(ns, '⚠️ 예산안을 내지 않아 준예산(나라 예산 −5%·신뢰도 −3)');
  }
  // 표결
  if (b.open?.plan && b.open.voteMs !== null && ns.worldMs >= b.open.voteMs) {
    const plan = planById(b.open.plan)!;
    const ok = nextRandom(Math.floor(b.open.voteMs / 1000) + 77)[0] < b.open.chance;
    if (ok) {
      b = { ...b, open: null, active: { plan: plan.id, untilMs: b.nextMs, cut: false }, passed: b.passed + 1 };
      ns = withDom(ns, { budget: b });
      ns = domLog(ns, `✅ ${plan.icon} ${plan.name} 국회 통과`);
      ns = snap(ns, 'assembly', `${plan.name} 통과`, plan.text);
    } else {
      b = { ...b, open: null, active: { plan: 'cut', untilMs: b.nextMs, cut: true }, cut: b.cut + 1 };
      ns = withDom(ns, { budget: b });
      ns = { ...ns, officer: { ...ns.officer, trust: Math.max(0, ns.officer.trust - 3) } };
      ns = domLog(ns, `❌ ${plan.name} 부결 → 준예산(나라 예산 −5%·신뢰도 −3)`);
    }
  }
  return ns;
}

function activePlan(s: GameState): { plan: BudgetPlan | null; cut: boolean } | null {
  const a = domOf(s).budget.active;
  if (!a || a.untilMs <= s.worldMs) return null;
  return { plan: a.cut ? null : planById(a.plan) ?? null, cut: a.cut };
}
registerDomRows((s, key) => {
  const a = activePlan(s);
  if (!a) return [];
  if (a.cut) return CUT.eff[key] ? ([['⚠️ 준예산', CUT.eff[key]!]] as Rows) : [];
  return a.plan?.eff[key] ? ([[`${a.plan.icon} ${a.plan.name}`, a.plan.eff[key]!]] as Rows) : [];
});
registerGroupRows((s, g) => {
  const a = activePlan(s);
  if (!a?.plan?.groups[g]) return [];
  return [[`${a.plan.icon} ${a.plan.name}`, a.plan.groups[g]!]];
});
