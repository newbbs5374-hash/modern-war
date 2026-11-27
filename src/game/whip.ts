// 11-27 종합 확장안 내정 7: 법안 표 대결.
// 법안을 내고 표결(2시간)까지 의원 묶음 5곳을 하나씩 설득해 과반(151석)을 만듦.
// 방법 3가지: 💰 지역 예산 주기(확실, 돈이 듦) · 🤝 약속하기(공짜지만 빚이 남아 다음 법안이 어려워짐) · 🗣️ 직접 설득(정치 스탯, 실패할 수 있음).
// 한 표결에 3번까지. 과반을 채우면 통과 90% 이상, 못 채워도 모은 표만큼 확률이 오름.
import { assemblyOf } from './assembly';
import type { AssemblyState } from './laws';
import { Rng } from './rng';
import { budgetPerDay, type GameState } from './state';

const H = 3600e3;
export const WHIP_MAX = 3;
export const MAJORITY = 151;
/** 지역 예산: 하루 예산 × 의석 몫 × 이 값 */
export const WHIP_PAY = 0.3;
/** 약속 빚: 하나마다 다음 법안 확률 −4%, 5일 뒤 잊힘(갚으면 바로 없어짐) */
export const DEBT_HARD = 0.04;
export const DEBT_MS = 5 * 24 * H;
export const DEBT_PAY = 0.05;

export type Stance = 'yes' | 'maybe' | 'no';
export type WhipHow = 'pay' | 'promise' | 'talk';
export interface BlocDef { id: string; icon: string; name: string; text: string }
export const BLOCS: BlocDef[] = [
  { id: 'core', icon: '🟦', name: '여당 주류', text: '늘 우리 편' },
  { id: 'rebel', icon: '🟪', name: '여당 비주류', text: '챙겨 주면 따라옴' },
  { id: 'mid', icon: '⬜', name: '무소속·중도', text: '지역 예산에 약함' },
  { id: 'soft', icon: '🟧', name: '야당 온건파', text: '명분이 있으면 움직임' },
  { id: 'hard', icon: '🟥', name: '야당 강경파', text: '약속은 안 믿음' },
];

/** 묶음마다 의석(모두 300) */
export function blocSeats(s: GameState): number[] {
  const p = s.polity?.seats ?? { ruling: 150, opp: 120, ind: 30 };
  const core = Math.round(p.ruling * 0.7);
  const soft = Math.round(p.opp * 0.45);
  return [core, p.ruling - core, p.ind, soft, p.opp - soft];
}
/** 제출할 때 확률로 정해지는 첫 태도 */
export function firstStances(chance: number): Stance[] {
  return ['yes', chance >= 0.45 ? 'yes' : 'maybe', chance >= 0.7 ? 'yes' : 'maybe', chance >= 0.6 ? 'maybe' : 'no', 'no'];
}
export interface WhipState { st: Stance[]; used: number; base: number; first: number }

export const yesSeats = (s: GameState, st: Stance[]) => blocSeats(s).reduce((a, n, i) => a + (st[i] === 'yes' ? n : 0), 0);

/** 표결 중인 법안의 표 대결 판(없으면 만들어 줌) */
export function whipOf(s: GameState): WhipState | null {
  const v = assemblyOf(s).vote;
  if (!v) return null;
  if (v.whip) return v.whip;
  const st = firstStances(v.chance);
  return { st, used: 0, base: v.chance, first: yesSeats(s, st) };
}
/** 모은 표로 바뀐 통과 확률 */
export function whipChance(s: GameState, w: WhipState): number {
  const yes = yesSeats(s, w.st);
  const v = yes >= MAJORITY ? Math.max(w.base, 0.9) : w.base + ((yes - w.first) / 300) * 0.5;
  return Math.max(0.1, Math.min(0.95, v));
}
export const liveDebts = (s: GameState) => (assemblyOf(s).debts ?? []).filter((d) => d > s.worldMs).length;
export const payCostOf = (s: GameState, i: number) => Math.max(30, Math.round(budgetPerDay(s, s.player.countryId) * (blocSeats(s)[i] / 300) * WHIP_PAY));
export const talkChance = (s: GameState) => Math.min(0.8, 0.35 + (s.officer.stats['정치'] ?? 0) / 100);
export const debtCost = (s: GameState) => Math.max(30, Math.round(budgetPerDay(s, s.player.countryId) * DEBT_PAY));

export function canWhip(s: GameState, i: number, how: WhipHow): string | null {
  const w = whipOf(s);
  if (!w) return '표결 중인 법안이 없어요';
  if (w.used >= WHIP_MAX) return `설득은 한 표결에 ${WHIP_MAX}번까지예요`;
  if (!BLOCS[i] || w.st[i] === 'yes') return '이미 찬성이에요';
  if (how === 'promise' && w.st[i] === 'no') return '반대하는 쪽은 약속을 안 믿어요';
  if (how === 'pay' && s.nations[s.player.countryId].treasury < payCostOf(s, i)) return '나라 예산이 모자라요';
  return null;
}

const up = (x: Stance): Stance => (x === 'no' ? 'maybe' : 'yes');

export function whip(s: GameState, i: number, how: WhipHow): { state: GameState; text: string } {
  if (canWhip(s, i, how)) return { state: s, text: '' };
  const me = s.player.countryId;
  const a: AssemblyState = structuredClone(assemblyOf(s));
  const w = structuredClone(whipOf(s)!);
  const b = BLOCS[i];
  let ns: GameState = s;
  let text = '';
  w.used++;
  if (how === 'pay') {
    const cost = payCostOf(s, i);
    ns = { ...ns, nations: { ...ns.nations, [me]: { ...ns.nations[me], treasury: ns.nations[me].treasury - cost } } };
    w.st[i] = up(w.st[i]);
    text = `💰 ${b.name}에 지역 예산을 약속했어요. ${w.st[i] === 'yes' ? '찬성으로 돌아섰어요.' : '고민해 보겠대요.'}`;
  } else if (how === 'promise') {
    w.st[i] = 'yes';
    a.debts = [...(a.debts ?? []).filter((d) => d > s.worldMs), s.worldMs + DEBT_MS];
    text = `🤝 ${b.name}과(와) 다음 법안에서 돕기로 약속했어요. 찬성! (약속 빚 +1)`;
  } else {
    const rng = new Rng(a.seed);
    const ok = rng.chance(talkChance(s));
    a.seed = rng.seed;
    if (ok) {
      w.st[i] = up(w.st[i]);
      text = `🗣️ ${b.name}을(를) 직접 만나 설득했어요. ${w.st[i] === 'yes' ? '찬성으로 돌아섰어요.' : '마음이 조금 열렸어요.'}`;
    } else {
      ns = { ...ns, officer: { ...ns.officer, trust: Math.max(0, ns.officer.trust - 1) } };
      text = `🗣️ ${b.name} 설득에 실패했어요. 신뢰도 −1`;
    }
  }
  a.vote = { ...a.vote!, whip: w, chance: whipChance(s, w) };
  a.log = [`${text}`, ...a.log].slice(0, 20);
  return { state: { ...ns, assembly: a }, text };
}

/** 약속 빚 하나 갚기(지역 예산으로) */
export function payDebt(s: GameState): GameState {
  const me = s.player.countryId;
  const a = structuredClone(assemblyOf(s));
  const live = (a.debts ?? []).filter((d) => d > s.worldMs).sort((x, y) => x - y);
  if (!live.length || s.nations[me].treasury < debtCost(s)) return s;
  live.pop();
  a.debts = live;
  return { ...s, assembly: a, nations: { ...s.nations, [me]: { ...s.nations[me], treasury: s.nations[me].treasury - debtCost(s) } } };
}
