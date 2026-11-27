// 안 2 경제 상황판·금리(11/26): 물가·실업률·성장률·주가·환율·집값 6개 숫자가 15분마다 목표 쪽으로 움직임.
// 목표 = 기준금리·세금·예산 나누기·전쟁·관세·인구. 지도자는 기준금리를 6시간마다 0.25%p씩 올리고 내림(중앙은행 총재 능력이 효과를 키움).
// 물가가 높으면 지지도↓, 성장률이 높으면 나라 예산↑, 과열이 오래가면 금융위기·집값 거품 붕괴.
import { registerDomRows, snap } from './domestic';
import { registerGroupRows } from './groups';
import { atWar } from './codes';
import { postPower } from './cabinet';
import { DAY, H, bumpRival, clamp, polityOf, polityLog, r1, r2, registerPolityInit, roll, tell, withPolity, type EconState } from './polity';
import { policyOf } from './policy';
import { pressureOf } from './pressure';
import type { GameState } from './state';

export const RATE_MIN = 0.5;
export const RATE_MAX = 8;
export const RATE_STEP = 0.25;
export const RATE_WAIT_MS = 6 * H;
export const HIST_EVERY_MS = 3 * H;
export const HIST_MAX = 40;
/** 나라별 기본(물가·성장·금리) */
const BASE: Record<string, { cpi: number; growth: number; rate: number }> = {
  us: { cpi: 2.8, growth: 2.3, rate: 4.5 },
  cn: { cpi: 1, growth: 4.8, rate: 3 },
  ru: { cpi: 7, growth: 1.5, rate: 16 },
  de: { cpi: 2.2, growth: 0.5, rate: 3 },
  jp: { cpi: 2.5, growth: 0.8, rate: 0.5 },
  uk: { cpi: 3, growth: 1, rate: 4.5 },
  in: { cpi: 4.5, growth: 6.5, rate: 6 },
  kr: { cpi: 2.3, growth: 2, rate: 3 },
  tr: { cpi: 35, growth: 3, rate: 40 },
  ir: { cpi: 30, growth: 2, rate: 20 },
  il: { cpi: 3, growth: 2, rate: 4.5 },
  ua: { cpi: 10, growth: 3, rate: 13 },
  kp: { cpi: 5, growth: 1, rate: 5 },
  tw: { cpi: 2, growth: 3, rate: 2 },
  pl: { cpi: 4, growth: 3, rate: 5.5 },
  ph: { cpi: 3.5, growth: 5.5, rate: 6 },
  pk: { cpi: 12, growth: 2.5, rate: 15 },
  sa: { cpi: 2, growth: 3.5, rate: 5.5 },
  // 11-27 새 나라 18개
  eg: { cpi: 20, growth: 4, rate: 25 },
  ng: { cpi: 25, growth: 3, rate: 27 },
  za: { cpi: 4.5, growth: 1, rate: 8 },
  et: { cpi: 18, growth: 6.5, rate: 15 },
  dz: { cpi: 6, growth: 3.5, rate: 3 },
  br: { cpi: 4.5, growth: 2.5, rate: 11 },
  ar: { cpi: 60, growth: 3, rate: 40 },
  co: { cpi: 5, growth: 2, rate: 9.5 },
  ve: { cpi: 50, growth: 2, rate: 55 },
  cl: { cpi: 4, growth: 2.5, rate: 5.5 },
  au: { cpi: 3, growth: 2, rate: 4 },
  ca: { cpi: 2.5, growth: 1.5, rate: 3 },
  mx: { cpi: 4, growth: 1.5, rate: 9.5 },
  fr: { cpi: 2, growth: 1, rate: 3 },
  it: { cpi: 1.5, growth: 0.8, rate: 3 },
  es: { cpi: 2.5, growth: 2.5, rate: 3 },
  gr: { cpi: 3, growth: 2, rate: 3 },
  fi: { cpi: 1.5, growth: 0.8, rate: 3 },
};
export const baseOf = (s: GameState) => BASE[s.player.countryId] ?? BASE.kr;
/** 나라마다 금리 폭이 다름(튀르키예 40% 등) → '중립 금리'를 기준으로 계산 */
export const neutralRate = (s: GameState) => baseOf(s).rate;
export const rateMax = (s: GameState) => Math.max(RATE_MAX, neutralRate(s) * 2);

registerPolityInit((s, p) => {
  const b = baseOf(s);
  p.econ = { ...p.econ, cpi: b.cpi, growth: b.growth, rate: b.rate, unemp: 4 };
});

export const econOf = (s: GameState): EconState => polityOf(s).econ;

/** 금리가 중립보다 낮으면 + (경기 부양) */
function easing(s: GameState): number {
  const e = econOf(s);
  const n = neutralRate(s);
  return (n - e.rate) / Math.max(1, n * 0.35);
}

/** 목표 근거 줄 */
export function econTargets(s: GameState) {
  const b = baseOf(s);
  const pol = policyOf(s);
  const ease = easing(s);
  const war = atWar(s);
  const tariffs = pressureOf(s).tariffs.filter((t) => t.to === s.player.countryId && t.untilMs > s.worldMs).length;
  const p = polityOf(s);
  const old = p.pop.old;
  const crisis = p.econ.crisis;
  const g: Array<[string, number]> = [['기본', b.growth]];
  g.push(['🏦 기준금리', r2(ease * 0.8)]);
  if (pol.split.eco !== 20) g.push(['📊 경제 예산', r2((pol.split.eco - 20) * 0.05)]);
  if (pol.tax === 'low') g.push(['🧾 세금 낮음', 0.4]);
  if (pol.tax === 'high') g.push(['🧾 세금 높음', -0.4]);
  if (war) g.push(['⚔️ 전쟁', -1.2]);
  if (tariffs) g.push([`🛃 관세 ${tariffs}건`, -0.5 * tariffs]);
  if (old > 18) g.push(['👴 고령화', -r2((old - 18) * 0.08)]);
  if (crisis) g.push([crisis.kind === 'bank' ? '📉 금융위기' : '🏚️ 집값 폭락', -3]);
  const c: Array<[string, number]> = [['기본', b.cpi]];
  c.push(['🏦 기준금리', r2(ease * 1.1)]);
  if (pol.tax === 'low') c.push(['🧾 세금 낮음', 0.3]);
  if (war) c.push(['⚔️ 전쟁', 1.8]);
  if (tariffs) c.push([`🛃 관세 ${tariffs}건`, 0.6 * tariffs]);
  if (p.econ.fx > 110) c.push(['💱 환율 오름', r2((p.econ.fx - 110) * 0.06)]);
  return { growth: g, cpi: c };
}
const r3 = (v: number) => Math.round(v * 1000) / 1000 || 0;
const sum = (rows: Array<[string, number]>) => rows.reduce((a, [, v]) => a + v, 0);

export function canSetRate(s: GameState, dir: 1 | -1): string | null {
  if (!s.polity) return '아직 준비 중이에요';
  const e = econOf(s);
  if (e.rateMs > s.worldMs) return '금리는 6시간마다 바꿀 수 있어요';
  const next = e.rate + dir * RATE_STEP;
  if (next < RATE_MIN - 1e-9) return `금리는 ${RATE_MIN}%보다 낮출 수 없어요`;
  if (next > rateMax(s) + 1e-9) return `금리는 ${rateMax(s)}%보다 올릴 수 없어요`;
  return null;
}
/** 중앙은행 총재가 있으면 한 번에 0.5%p까지 */
export const rateStep = (s: GameState) => (postPower(s, 'bok') >= 1 ? RATE_STEP * 2 : RATE_STEP);
export function setRate(s: GameState, dir: 1 | -1): GameState {
  if (canSetRate(s, dir)) return s;
  const e = econOf(s);
  const rate = r2(clamp(e.rate + dir * rateStep(s), RATE_MIN, rateMax(s)));
  let ns = withPolity(s, { econ: { ...e, rate, rateMs: s.worldMs + RATE_WAIT_MS } });
  ns = polityLog(ns, `🏦 기준금리 ${dir > 0 ? '인상' : '인하'} ${e.rate}% → ${rate}%`);
  if (dir > 0) {
    let who: string | null;
    [ns, who] = bumpRival(ns, '재벌', 3);
    if (who) ns = tell(ns, `💼 재벌 회장 ${who}: "금리를 또 올리면 투자를 접겠습니다."`);
  }
  return ns;
}

/** 과열이 이만큼 쌓이면 위기 */
export const CRISIS_AT = 30;
/** 판단(15분)마다 과열이 쌓이는 세기: 물가가 기본보다 3%p 넘게 높거나 집값이 +25% 넘으면 */
const heatOf = (cpi: number, house: number, baseCpi: number) => Math.max(0, cpi - baseCpi - 3) + Math.max(0, house - 25) / 10;
/** 11-28 과열 게이지(점검 오류 6: 위기가 예고 없이 터짐) — 지금 과열·쌓이는 속도·위기까지 남은 시간·원인 */
export function overheat(s: GameState): { stress: number; at: number; perHour: number; hoursLeft: number | null; why: string[] } {
  const e = econOf(s);
  const b = baseOf(s);
  const hot = heatOf(e.cpi, e.house, b.cpi);
  const perHour = r1((hot > 0 ? hot * 0.6 : -0.5) * 4);
  const why: string[] = [];
  if (e.cpi - b.cpi > 3) why.push(`🛒 물가 ${e.cpi.toFixed(1)}%(기본 ${b.cpi}%보다 ${(e.cpi - b.cpi).toFixed(1)}%p 높음)`);
  if (e.house > 25) why.push(`🏠 집값 +${Math.round(e.house)}%`);
  const hoursLeft = e.crisis ? null : hot > 0 ? Math.max(0, (CRISIS_AT - e.stress) / (hot * 0.6 * 4)) : null;
  return { stress: e.crisis ? 0 : e.stress, at: CRISIS_AT, perHour, hoursLeft, why };
}

/** 15분마다 */
export function econTick(s: GameState): GameState {
  if (!s.polity) return s;
  let ns = s;
  let rnd: number;
  [rnd, ns] = roll(ns);
  const e = { ...econOf(ns) };
  const t = econTargets(ns);
  const tg = sum(t.growth);
  const tc = Math.max(-1, sum(t.cpi));
  const k = 0.06;
  e.growth = r3(e.growth + (tg - e.growth) * k + 0.08 * (rnd - 0.5));
  e.cpi = r3(e.cpi + (tc - e.cpi) * k + 0.05 * (rnd - 0.5));
  const tu = clamp(4 - (e.growth - baseOf(ns).growth) * 0.6 + (atWar(ns) ? 0.6 : 0), 1.5, 15);
  e.unemp = r3(e.unemp + (tu - e.unemp) * k);
  const fair = 2500 * (1 + (e.growth - baseOf(ns).growth) * 0.06 + easing(ns) * 0.04) * (e.crisis ? 0.8 : 1);
  e.stock = Math.round(clamp(e.stock + (fair - e.stock) * 0.02 + e.stock * (rnd - 0.5) * 0.01, 600, 9000));
  const tfx = 100 + (atWar(ns) ? 12 : 0) + easing(ns) * 6 + Math.max(0, e.cpi - baseOf(ns).cpi) * 1.5;
  e.fx = r1(e.fx + (tfx - e.fx) * k);
  const th = easing(ns) * 12 + (e.growth - baseOf(ns).growth) * 3 - (e.crisis?.kind === 'house' ? 25 : 0);
  e.house = r1(clamp(e.house + (th - e.house) * 0.03, -40, 60));
  // 과열 쌓임
  const hot = heatOf(e.cpi, e.house, baseOf(ns).cpi);
  e.stress = e.crisis ? 0 : r1(clamp(e.stress + (hot > 0 ? hot * 0.6 : -0.5), 0, 100));
  if (e.crisis && e.crisis.untilMs <= ns.worldMs) {
    e.crisis = null;
    ns = polityLog(ns, '📈 경제 위기가 끝났어요');
  }
  let crisisNow: 'bank' | 'house' | null = null;
  if (!e.crisis && e.stress >= CRISIS_AT) {
    crisisNow = e.house > 25 ? 'house' : 'bank';
    e.crisis = { kind: crisisNow, untilMs: ns.worldMs + 2 * DAY };
    e.stress = 0;
    e.stock = Math.round(e.stock * 0.75);
    if (crisisNow === 'house') e.house = r1(e.house - 20);
  }
  if (ns.worldMs >= e.histMs) {
    e.histMs = ns.worldMs + HIST_EVERY_MS;
    e.hist = {
      cpi: [...e.hist.cpi, e.cpi].slice(-HIST_MAX),
      growth: [...e.hist.growth, e.growth].slice(-HIST_MAX),
      stock: [...e.hist.stock, e.stock].slice(-HIST_MAX),
    };
  }
  ns = withPolity(ns, { econ: e });
  if (crisisNow) {
    const name = crisisNow === 'bank' ? '금융위기' : '집값 거품 붕괴';
    ns = polityLog(ns, `📉 ${name}! 주가 −25% · 이틀 동안 성장률 −3`);
    let who: string | null;
    [ns, who] = bumpRival(ns, '재벌', 6);
    ns = tell(ns, `📉 ${name}가 터졌어요! 주가가 크게 떨어졌어요.${who ? ` 재벌 회장 ${who}: "정부가 경제를 망쳤다."` : ''}`);
    ns = snap(ns, 'factory', name, '경제 상황판이 빨갛게 물들었어요');
  }
  return ns;
}

/** 경제 숫자가 내는 효과 */
registerDomRows((s, key) => {
  if (!s.polity) return [];
  const e = econOf(s);
  const b = baseOf(s);
  const out: Array<[string, number]> = [];
  if (key === 'approval') {
    const over = e.cpi - b.cpi - 1;
    if (over > 0) out.push([`🛒 물가 ${e.cpi}%`, -r1(Math.min(10, over * 1.5))]);
    if (e.unemp > 5) out.push([`🧑‍💼 실업률 ${e.unemp}%`, -r1(Math.min(6, (e.unemp - 5) * 1.5))]);
    if (e.crisis) out.push(['📉 경제 위기', -5]);
  }
  if (key === 'budget') {
    const d = e.growth - b.growth;
    const g = Math.abs(d) < 0.5 ? 0 : r2((d - Math.sign(d) * 0.5) * 0.02);
    if (g) out.push([`📈 성장률 ${e.growth}%`, clamp(g, -0.1, 0.1)]);
  }
  if (key === 'economy') {
    const v = r1((e.growth - b.growth) * 2 - Math.max(0, e.cpi - b.cpi - 1));
    if (v) out.push(['📈 경제 지표', clamp(v, -10, 10)]);
  }
  return out;
});
registerGroupRows((s, g) => {
  if (!s.polity) return [];
  const e = econOf(s);
  const b = baseOf(s);
  const ease = easing(s);
  const out: Array<[string, number]> = [];
  if (g === 'biz') {
    const v = Math.round(ease * 4 + (e.stock - 2500) / 250);
    if (v) out.push(['🏦 금리·주가', clamp(v, -12, 12)]);
  }
  if (g === 'labor' && e.unemp > 4.5) out.push([`🧑‍💼 실업률 ${e.unemp}%`, -Math.round((e.unemp - 4.5) * 4)]);
  if (g === 'youth' && e.house > 10) out.push([`🏠 집값 +${Math.round(e.house)}%`, -Math.round(e.house / 4)]);
  if ((g === 'civic' || g === 'labor') && e.cpi - b.cpi > 1.5) out.push([`🛒 물가 ${e.cpi}%`, -Math.round((e.cpi - b.cpi) * 1.5)]);
  return out;
});
