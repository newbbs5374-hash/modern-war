// 11-28 국정 37 강화(경제·금고): 국채. 급할 때 나라 예산을 빌리고, 이자를 붙여 48시간 동안 나눠 갚음.
// 한 번에 시간당 예산 × BOND_HOURS만큼, 빚 합계는 그 3배까지. 갚을 돈이 모자라면 신용 하락(이자 ↑).
import { budgetPerDay, defShare, type GameState } from './state';
import { contractMoneyPerHour } from './economy';

const H = 3600e3;
/** 한 번에 빌리는 양 = 시간당 나라 예산 × 이만큼 */
export const BOND_HOURS = 12;
/** 이자(빌린 돈의 비율) */
export const BOND_RATE = 0.12;
/** 갚는 기간(실제 시간) */
export const BOND_PAY_H = 48;
/** 빚 합계 한도 = 한 번 양 × 이만큼 */
export const BOND_MAX = 3;

export interface Bond {
  id: number;
  /** 남은 빚 */
  left: number;
  /** 시간당 갚는 돈 */
  perHour: number;
}
export interface BondState {
  list: Bond[];
  next: number;
  /** 못 갚은 횟수(이자 +4%씩) */
  /** 못 갚은 시간 누적(1마다 이자 +4%p, 최대 5) */
  missed: number;
  lastMs: number;
}
export const bondsOf = (s: GameState): BondState => s.bonds ?? { list: [], next: 1, missed: 0, lastMs: s.worldMs };
/** 나라 예산 시간당(국방 몫 빼고, 계약 포함) */
export const treasuryPerHour = (s: GameState) => budgetPerDay(s, s.player.countryId) * (1 - defShare(s)) + contractMoneyPerHour(s);
export const bondDebt = (s: GameState) => bondsOf(s).list.reduce((a, b) => a + b.left, 0);
export const bondPayPerHour = (s: GameState) => bondsOf(s).list.reduce((a, b) => a + b.perHour, 0);
export const bondRate = (s: GameState) => BOND_RATE + 0.04 * Math.floor(Math.min(5, bondsOf(s).missed));
export const bondSize = (s: GameState) => Math.max(1000, Math.round(treasuryPerHour(s) * BOND_HOURS));
/** h시간 뒤 예상 나라 예산(빚 갚기 포함) */
export const forecast = (s: GameState, h: number) => Math.round((s.nations[s.player.countryId]?.treasury ?? 0) + (treasuryPerHour(s) - bondPayPerHour(s)) * h);

export function canBorrow(s: GameState): string | null {
  if (s.ending) return '판이 끝났어요';
  if (bondDebt(s) + bondSize(s) * (1 + bondRate(s)) > bondSize(s) * BOND_MAX * (1 + bondRate(s))) return `빚이 한도(${BOND_MAX}번 몫)에 찼어요. 조금 갚은 뒤 다시`;
  return null;
}
export function borrow(s: GameState): GameState {
  if (canBorrow(s)) return s;
  const b = bondsOf(s);
  const amt = bondSize(s);
  const owe = Math.round(amt * (1 + bondRate(s)));
  const me = s.player.countryId;
  return {
    ...s,
    nations: { ...s.nations, [me]: { ...s.nations[me], treasury: s.nations[me].treasury + amt } },
    bonds: { ...b, list: [...b.list, { id: b.next, left: owe, perHour: owe / BOND_PAY_H }], next: b.next + 1, lastMs: b.lastMs ?? s.worldMs },
  };
}
/** 판단(15분)마다 갚기 */
export function bondTick(s: GameState): GameState {
  const b = s.bonds;
  if (!b || !b.list.length) return s.bonds ? { ...s, bonds: { ...b!, lastMs: s.worldMs } } : s;
  const hours = Math.max(0, (s.worldMs - (b.lastMs ?? s.worldMs)) / H);
  if (hours <= 0) return s;
  const me = s.player.countryId;
  let money = s.nations[me].treasury;
  let missed = b.missed;
  let fail = false;
  const list: Bond[] = [];
  for (const x of b.list) {
    const pay = Math.min(x.left, x.perHour * hours);
    if (money >= pay) {
      money -= pay;
      if (x.left - pay > 0.5) list.push({ ...x, left: x.left - pay });
    } else {
      fail = true;
      list.push(x);
    }
  }
  // 못 갚으면 실제 1시간마다 신용 −1(이자 +4%p), 잘 갚으면 하루에 1씩 회복
  missed = fail ? Math.min(5, missed + hours) : Math.max(0, missed - hours / 24);
  return { ...s, nations: { ...s.nations, [me]: { ...s.nations[me], treasury: money } }, bonds: { ...b, list, missed, lastMs: s.worldMs } };
}

// ── 11-28 국부 펀드: 남는 나라 예산을 주식 지수에 맡김 → 지수가 오르면 이익, 위기면 손실(꺼낼 때 수수료 2%) ──
export const FUND_FEE = 0.02;
export interface FundState {
  units: number;
  /** 넣은 돈 합계 */
  cost: number;
}
const stockIdx = (s: GameState) => Math.max(1, s.polity?.econ.stock ?? 2500);
export const fundOf = (s: GameState): FundState => s.fund ?? { units: 0, cost: 0 };
export const fundValue = (s: GameState) => Math.round(fundOf(s).units * stockIdx(s));
/** 한 번에 넣는 양: 나라 예산의 20% */
export const fundChunk = (s: GameState) => Math.floor(Math.max(0, s.nations[s.player.countryId]?.treasury ?? 0) * 0.2);
export function canInvest(s: GameState): string | null {
  if (!s.polity) return '경기 지표가 아직 없어요';
  if (fundChunk(s) < 1000) return '맡길 나라 예산이 모자라요';
  return null;
}
export function invest(s: GameState): GameState {
  if (canInvest(s)) return s;
  const me = s.player.countryId;
  const amt = fundChunk(s);
  const f = fundOf(s);
  return { ...s, fund: { units: f.units + amt / stockIdx(s), cost: f.cost + amt }, nations: { ...s.nations, [me]: { ...s.nations[me], treasury: s.nations[me].treasury - amt } } };
}
export function withdrawFund(s: GameState): GameState {
  const v = fundValue(s);
  if (v <= 0) return s;
  const me = s.player.countryId;
  return { ...s, fund: { units: 0, cost: 0 }, nations: { ...s.nations, [me]: { ...s.nations[me], treasury: s.nations[me].treasury + Math.round(v * (1 - FUND_FEE)) } } };
}
