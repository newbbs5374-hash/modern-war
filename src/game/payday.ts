// 봉급날(11-26 보상 더 늘리기): 봉급을 받으면 봉급 + 나라 예산 + 루비(+가속권)를 함께 받는다.
import { claimSalary, salaryPerDay, type GameState } from './state';
import { dayOf, goalsOf } from './goals';

/** 봉급 1마다 나라 예산 */
export const PAY_BUDGET_PER_SALARY = 2;
/** 봉급 1시간치마다 루비 1, 하루 상한 */
export const PAY_RUBY_CAP = 15;
/** 봉급 4시간치마다 가속권 1장, 하루 상한 */
export const PAY_BOOST_HOURS = 4;
export const PAY_BOOST_CAP = 3;

/** 지금 봉급을 받으면 들어올 것 */
export function payPreview(s: GameState): { salary: number; budget: number; ruby: number; boosts: number } {
  const salary = Math.floor(s.player.pendingSalary);
  if (salary <= 0) return { salary: 0, budget: 0, ruby: 0, boosts: 0 };
  const g = goalsOf(s);
  const same = g.payDay === dayOf(s.worldMs);
  const hours = salary / Math.max(1, salaryPerDay(s));
  const ruby = Math.max(0, Math.min(Math.floor(hours), PAY_RUBY_CAP - (same ? (g.payRuby ?? 0) : 0)));
  const boosts = Math.max(0, Math.min(Math.floor(hours / PAY_BOOST_HOURS), PAY_BOOST_CAP - (same ? (g.payBoost ?? 0) : 0)));
  return { salary, budget: Math.round(salary * PAY_BUDGET_PER_SALARY), ruby, boosts };
}

/** 봉급 받기: 봉급 + 나라 예산 + 루비 + 가속권 */
export function claimPay(s: GameState): GameState {
  const pv = payPreview(s);
  if (pv.salary <= 0) return s;
  const ns = claimSalary(s);
  const me = ns.player.countryId;
  const g = goalsOf(ns);
  const today = dayOf(ns.worldMs);
  const same = g.payDay === today;
  return {
    ...ns,
    nations: ns.nations[me] ? { ...ns.nations, [me]: { ...ns.nations[me], treasury: ns.nations[me].treasury + pv.budget } } : ns.nations,
    goals: { ...g, ruby: g.ruby + pv.ruby, payDay: today, payRuby: (same ? (g.payRuby ?? 0) : 0) + pv.ruby, payBoost: (same ? (g.payBoost ?? 0) : 0) + pv.boosts },
    officer: { ...ns.officer, boosts: (ns.officer.boosts ?? 0) + pv.boosts },
  };
}
