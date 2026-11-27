// A3 이익집단과 여론(11/24): 재계·노동계·군·시민단체·언론·청년층. 집단마다 힘(크기)과 만족도(0~100).
// 만족도는 세금·예산 나누기·법·기본법·전쟁·특구·대형 사업에 따라 목표가 정해지고 실제 15분마다 그쪽으로 움직임.
// 지지도 줄 = 집단 만족도를 힘만큼 섞은 값. 만족도 70↑면 덤, 25↓면 불만(파업·집회 등) 벌칙.
// 면담(6시간마다 집단별)으로 잠깐 +, 양보(금고)로 크게 + 대신 맞서는 집단 −.
import type { GameState } from './state';
import type { LawKey } from './laws';
import { domLog, domOf, payTreasury, registerDomRows, snap, withDom, type Rows } from './domestic';
import { policyOf } from './policy';
import { billById, liveLaws, type BillId } from './laws';
import { atWar, codeGroupRows } from './codes';
import { budgetPerDay } from './state';

const H = 3600e3;
export const MEET_WAIT_MS = 6 * H;
export const MEET_GAIN = 10;
export const MEET_HOURS = 12;
export const DEAL_GAIN = 22;
export const DEAL_HOURS = 48;
export const DEAL_COST_DAYS = 3;
export const RIOT_GAP_MS = 24 * H;

export interface GroupDef {
  id: string;
  icon: string;
  name: string;
  wants: string;
  /** 만족도 70↑ 덤 */
  good: Partial<Record<LawKey, number>>;
  goodText: string;
  /** 만족도 25↓ 벌칙 */
  bad: Partial<Record<LawKey, number>>;
  badText: string;
  riot: string;
  /** 양보하면 반대로 불만인 집단 */
  rival: string;
}
export const GROUPS: GroupDef[] = [
  { id: 'biz', icon: '🏢', name: '재계', wants: '낮은 세금·유연한 노동·경제 예산', good: { budget: 0.04 }, goodText: '나라 예산 +4%', bad: { budget: -0.05 }, badText: '나라 예산 −5%', riot: '투자 중단 선언', rival: 'labor' },
  { id: 'labor', icon: '👷', name: '노동계', wants: '노동 보호·사회 예산·누진세', good: { res: 0.04 }, goodText: '자원 +4%', bad: { res: -0.08 }, badText: '자원 −8%', riot: '총파업', rival: 'biz' },
  { id: 'mil', icon: '🎖️', name: '군', wants: '국방 예산·징병·안보 사업', good: { build: 0.04, troop: 0.03 }, goodText: '모집 +4% · 징병 +3%', bad: { build: -0.06, trust: -3 }, badText: '모집 −6% · 신뢰도 −3', riot: '군 내부 불만 표출', rival: 'civic' },
  { id: 'civic', icon: '🪧', name: '시민단체', wants: '복지·환경·언론 자유, 전쟁 반대', good: { loyalty: 3 }, goodText: '모든 도시 민심 +3', bad: { society: -6 }, badText: '사회 안정 −6', riot: '대규모 집회', rival: 'mil' },
  { id: 'press', icon: '📰', name: '언론', wants: '언론 자유·투명한 정치', good: { approval: 2, trust: 1 }, goodText: '지지도 +2 · 신뢰도 +1', bad: { approval: -3 }, badText: '지지도 −3', riot: '정권 비판 보도 쏟아짐', rival: 'mil' },
  { id: 'youth', icon: '🧑‍🎓', name: '청년층', wants: '일자리·교육·과학, 징병 반대', good: { research: 0.06 }, goodText: '연구 +6%', bad: { research: -0.06, approval: -1 }, badText: '연구 −6% · 지지도 −1', riot: '청년 이탈·해외 이주', rival: 'mil' },
];
export const groupById = (id: string) => GROUPS.find((g) => g.id === id)!;

/** 나라별 집단 힘(합 100). 없으면 기본 */
const POWER_BASE: Record<string, number> = { biz: 18, labor: 17, mil: 15, civic: 17, press: 15, youth: 18 };
const POWER_COUNTRY: Record<string, Partial<Record<string, number>>> = {
  kr: { biz: 20, youth: 19, mil: 15 },
  us: { biz: 21, press: 17, civic: 18, mil: 16 },
  cn: { biz: 20, mil: 20, press: 8, civic: 10, labor: 22 },
  ru: { mil: 26, press: 8, civic: 8, biz: 22 },
  kp: { mil: 34, press: 4, civic: 4, biz: 8, labor: 30 },
  ir: { mil: 24, press: 8, civic: 12 },
  il: { mil: 24, youth: 16 },
  ua: { mil: 24, civic: 18, youth: 14 },
  de: { labor: 20, civic: 20, mil: 10 },
  uk: { press: 19, civic: 19, mil: 12 },
  jp: { biz: 22, mil: 10, youth: 15 },
  in: { labor: 22, youth: 20, press: 13 },
  tr: { mil: 21, press: 11 },
  tw: { biz: 22, youth: 19, mil: 13 },
  pl: { mil: 20, civic: 18, labor: 18 },
  ph: { civic: 20, press: 17, mil: 14 },
  pk: { mil: 30, press: 9, civic: 10 },
  sa: { biz: 24, mil: 22, press: 5, civic: 5 },
  // 11-27 새 나라 18개
  eg: { mil: 30, press: 8, civic: 9 },
  ng: { mil: 20, labor: 20, youth: 22 },
  za: { labor: 24, civic: 20, biz: 18 },
  et: { mil: 24, press: 8, civic: 10 },
  dz: { mil: 28, labor: 18, press: 9 },
  br: { biz: 21, labor: 21, youth: 19 },
  ar: { labor: 25, civic: 19, press: 16 },
  co: { mil: 20, civic: 18, youth: 18 },
  ve: { mil: 28, labor: 18, press: 6, civic: 8 },
  cl: { civic: 21, youth: 21, labor: 18 },
  au: { biz: 21, labor: 19, press: 17 },
  ca: { civic: 20, labor: 18, press: 17 },
  mx: { labor: 20, biz: 19, press: 12, mil: 17 },
  fr: { labor: 23, civic: 20, press: 17 },
  it: { biz: 19, labor: 20, press: 16 },
  es: { labor: 20, civic: 19, youth: 20 },
  gr: { labor: 22, mil: 18, youth: 18 },
  fi: { civic: 21, mil: 18, press: 18 },
};
export function groupPower(s: GameState): Record<string, number> {
  const raw: Record<string, number> = { ...POWER_BASE, ...(POWER_COUNTRY[s.player.countryId] ?? {}) } as Record<string, number>;
  // 전쟁 중엔 군 +5
  if (atWar(s)) raw.mil += 5;
  const tot = Object.values(raw).reduce((a, b) => a + b, 0);
  const out: Record<string, number> = {};
  for (const g of GROUPS) out[g.id] = (raw[g.id] / tot) * 100;
  return out;
}

/** 법안(laws.ts BILLS)마다 집단 반응 */
const BILL_REACT: Record<string, Partial<Record<string, number>>> = {
  defauth: { mil: 8, civic: -4 },
  draft: { mil: 6, youth: -10 },
  aid: { civic: 5, biz: -2 },
  freetrade: { biz: 8, labor: -6 },
  taxcut: { biz: 6, labor: 2, youth: 2 },
  richtax: { biz: -10, labor: 6, civic: 3 },
  welfare: { labor: 6, civic: 6, biz: -3 },
  police: { mil: 3, civic: -8, press: -3 },
  science: { youth: 8, biz: 3 },
  intel: { mil: 4, press: -5, civic: -4 },
  anticorrupt: { press: 6, civic: 6, biz: -3 },
  media: { press: -6, civic: -2 },
};
/** 특구·사업 반응(zones.ts·projects.ts가 채움) */
const EXTRA: Array<(s: GameState, g: string) => Rows> = [];
export function registerGroupRows(fn: (s: GameState, g: string) => Rows) {
  EXTRA.push(fn);
}

/** 집단 만족도 목표의 근거 줄 */
export function groupTargetRows(s: GameState, g: string): Rows {
  const rows: Rows = [['기본', 50]];
  const p = policyOf(s);
  const tax = p.tax;
  const T: Record<string, Partial<Record<string, number>>> = {
    low: { biz: 12, labor: -4, civic: -4, youth: 3 },
    mid: {},
    high: { biz: -12, labor: 6, civic: 4, youth: -3 },
  };
  if (T[tax][g]) rows.push([`🧾 세금 ${tax === 'low' ? '낮음' : '높음'}`, T[tax][g]!]);
  const sp = p.split;
  const d = (v: number, base: number, k: number) => Math.round((v - base) * k);
  const SPLIT: Record<string, number> = {
    biz: d(sp.eco, 20, 0.6),
    labor: d(sp.soc, 20, 0.5),
    mil: d(sp.def, 40, 0.5),
    civic: d(sp.soc, 20, 0.4) - Math.max(0, d(sp.def, 40, 0.3)),
    press: d(sp.dip, 20, 0.2),
    youth: d(sp.soc, 20, 0.3) + d(sp.eco, 20, 0.2),
  };
  if (SPLIT[g]) rows.push(['📊 예산 나누기', SPLIT[g]]);
  for (const l of liveLaws(s)) {
    const v = BILL_REACT[l.id]?.[g];
    if (v) rows.push([`📜 ${billById(l.id as BillId).name}`, v]);
  }
  rows.push(...codeGroupRows(s, g));
  if (atWar(s)) {
    const W: Record<string, number> = { mil: 8, youth: -8, civic: -8, biz: -4, labor: -2, press: -2 };
    rows.push(['⚔️ 전쟁 중', W[g]]);
  }
  for (const f of EXTRA) rows.push(...f(s, g));
  const now = s.worldMs;
  for (const m of domOf(s).groups.mods) if (m.g === g && m.untilMs > now) rows.push([m.why, m.v]);
  return rows;
}
export function groupTarget(s: GameState, g: string): number {
  return Math.max(0, Math.min(100, groupTargetRows(s, g).reduce((a, r) => a + r[1], 0)));
}
export function groupSat(s: GameState, g: string): number {
  const v = domOf(s).groups.sat[g];
  return v === undefined ? groupTarget(s, g) : v;
}

export function canMeet(s: GameState, g: string): string | null {
  const t = domOf(s).groups.meetMs[g] ?? 0;
  if (t > s.worldMs) return '아직 다시 만날 수 없어요';
  return null;
}
export function meetGroup(s: GameState, g: string): GameState {
  if (canMeet(s, g)) return s;
  const d = domOf(s);
  const G = groupById(g);
  const mods = [...d.groups.mods.filter((m) => m.untilMs > s.worldMs), { g, v: MEET_GAIN, untilMs: s.worldMs + MEET_HOURS * H, why: '🤝 대표 면담' }];
  const sat = { ...d.groups.sat, [g]: Math.min(100, groupSat(s, g) + MEET_GAIN / 2) };
  let ns = withDom(s, { groups: { ...d.groups, mods, sat, meetMs: { ...d.groups.meetMs, [g]: s.worldMs + MEET_WAIT_MS } } });
  ns = domLog(ns, `🤝 ${G.icon} ${G.name} 대표와 면담`);
  return snap(ns, 'meeting', `${G.name} 대표 면담`, G.wants);
}
export function dealCost(s: GameState): number {
  return Math.round(budgetPerDay(s, s.player.countryId) * DEAL_COST_DAYS);
}
export function canDeal(s: GameState, g: string): string | null {
  const me = s.nations[s.player.countryId];
  if (!me || me.treasury < dealCost(s)) return '나라 예산이 모자라요';
  if (domOf(s).groups.mods.some((m) => m.g === g && m.why.startsWith('💼') && m.untilMs > s.worldMs)) return '이미 양보한 집단이에요';
  return null;
}
export function dealGroup(s: GameState, g: string): GameState {
  if (canDeal(s, g)) return s;
  const paid = payTreasury(s, dealCost(s));
  if (!paid) return s;
  const d = domOf(paid);
  const G = groupById(g);
  const R = groupById(G.rival);
  const until = s.worldMs + DEAL_HOURS * H;
  const mods = [...d.groups.mods.filter((m) => m.untilMs > s.worldMs), { g, v: DEAL_GAIN, untilMs: until, why: '💼 요구 수용' }, { g: G.rival, v: -8, untilMs: until, why: `😠 ${G.name}에 양보` }];
  const ns = withDom(paid, { groups: { ...d.groups, mods } });
  return domLog(ns, `💼 ${G.icon} ${G.name} 요구를 받아들임(${R.icon} ${R.name} 불만)`);
}

/** 실제 15분마다: 만족도가 목표 쪽으로 12%씩, 25↓면 하루 한 번 불만 사건 */
export function groupsTick(s: GameState): GameState {
  if (!s.dom) return s;
  let ns = s;
  const d = domOf(ns);
  const sat: Record<string, number> = { ...d.groups.sat };
  const riotMs = { ...d.groups.riotMs };
  const events: string[] = [];
  for (const g of GROUPS) {
    const tgt = groupTarget(ns, g.id);
    const cur = sat[g.id] ?? tgt;
    sat[g.id] = Math.round((cur + (tgt - cur) * 0.12) * 10) / 10;
    if (sat[g.id] <= 25 && (riotMs[g.id] ?? 0) + RIOT_GAP_MS <= ns.worldMs) {
      riotMs[g.id] = ns.worldMs;
      events.push(g.id);
    }
  }
  ns = withDom(ns, { groups: { ...d.groups, sat, riotMs, mods: d.groups.mods.filter((m) => m.untilMs > ns.worldMs) } });
  for (const id of events) {
    const g = groupById(id);
    ns = domLog(ns, `🔥 ${g.icon} ${g.name} ${g.riot}! (${g.badText})`);
    ns = snap(ns, id === 'press' ? 'press' : id === 'mil' ? 'parade' : 'protest', `${g.name} ${g.riot}`, `만족도 ${Math.round(sat[id])} · ${g.wants}`);
  }
  return ns;
}

/** 지지도에 더하는 몫: 힘 가중 평균이 50에서 벗어난 만큼 × 0.2 (−10~+10) */
export function groupApproval(s: GameState): number {
  const pw = groupPower(s);
  let v = 0;
  for (const g of GROUPS) v += (pw[g.id] / 100) * (groupSat(s, g.id) - 50);
  return Math.round(v * 0.2 * 10) / 10;
}

registerDomRows((s, key) => {
  const rows: Rows = [];
  if (key === 'approval') {
    const a = groupApproval(s);
    if (a) rows.push(['👥 이익집단 여론', a]);
  }
  for (const g of GROUPS) {
    const v = groupSat(s, g.id);
    if (v >= 70 && g.good[key]) rows.push([`${g.icon} ${g.name} 만족`, g.good[key]!]);
    if (v <= 25 && g.bad[key]) rows.push([`${g.icon} ${g.name} ${g.riot}`, g.bad[key]!]);
  }
  return rows;
});
