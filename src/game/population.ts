// 안 6 인구·세대(11/26): 나라별 실제와 비슷한 출산율·고령 비율·청년 비율·이민 비율이 판 내내 천천히 움직임.
// 고령화가 오르면 징집 가능 인원↓·연금 부담(나라 예산)↓. 7일짜리 장기 정책 하나(출산 지원·이민 개방·정년 연장·교육 혁신)를 고름.
import { approvalOf } from './approval';
import { registerDomRows } from './domestic';
import { registerGroupRows } from './groups';
import { econOf } from './econ';
import { DAY, clamp, polityOf, polityLog, r2, registerPolityInit, tell, withPolity, type PopState } from './polity';
import type { LawKey } from './laws';
import type { GameState } from './state';

const r3 = (v: number) => Math.round(v * 1000) / 1000 || 0;
export const POLICY_MS = 7 * DAY;
const BASE: Record<string, { birth: number; old: number; young: number; migrant: number }> = {
  kr: { birth: 0.78, old: 19, young: 11, migrant: 3 },
  jp: { birth: 1.2, old: 29, young: 12, migrant: 2.5 },
  cn: { birth: 1, old: 14, young: 17, migrant: 0.1 },
  us: { birth: 1.6, old: 17, young: 18, migrant: 14 },
  in: { birth: 2, old: 7, young: 25, migrant: 0.4 },
  ir: { birth: 1.7, old: 8, young: 23, migrant: 3 },
  il: { birth: 2.9, old: 12, young: 28, migrant: 20 },
  ru: { birth: 1.4, old: 16, young: 18, migrant: 8 },
  ua: { birth: 1, old: 18, young: 15, migrant: 5 },
  de: { birth: 1.4, old: 22, young: 14, migrant: 16 },
  uk: { birth: 1.5, old: 19, young: 17, migrant: 14 },
  tr: { birth: 1.6, old: 10, young: 22, migrant: 7 },
  kp: { birth: 1.8, old: 10, young: 20, migrant: 0.1 },
};
export const popBase = (s: GameState) => BASE[s.player.countryId] ?? BASE.kr;
registerPolityInit((s, p) => {
  const b = popBase(s);
  p.pop = { ...b, size: 100, policy: null };
});

export interface PopPolicy {
  id: string;
  icon: string;
  name: string;
  text: string;
  eff: Partial<Record<LawKey, number>>;
  groups: Partial<Record<string, number>>;
  birth?: number;
  migrant?: number;
}
export const POP_POLICIES: PopPolicy[] = [
  { id: 'birth', icon: '🍼', name: '출산 지원', text: '출산율 목표 +0.25 · 나라 예산 −3% · 청년층 +6', eff: { budget: -0.03 }, groups: { youth: 6, labor: 2 }, birth: 0.25 },
  { id: 'migrant', icon: '✈️', name: '이민 개방', text: '이민 목표 +4%p · 자원 +4% · 징병 +2% · 노동계 −6', eff: { res: 0.04, troop: 0.02 }, groups: { labor: -6, biz: 4 }, migrant: 4 },
  { id: 'retire', icon: '👴', name: '정년 연장', text: '나라 예산 +3% · 자원 +2% · 청년층 −8', eff: { budget: 0.03, res: 0.02 }, groups: { youth: -8, labor: 3 } },
  { id: 'edu', icon: '🎓', name: '교육 혁신', text: '연구 +5% · 나라 예산 −2% · 청년층 +4', eff: { research: 0.05, budget: -0.02 }, groups: { youth: 4 } },
];
export const popPolicy = (id: string) => POP_POLICIES.find((x) => x.id === id)!;

export const popOf = (s: GameState): PopState => polityOf(s).pop;
export const livePolicy = (s: GameState) => {
  const p = popOf(s).policy;
  return p && p.untilMs > s.worldMs ? popPolicy(p.id) : null;
};
export function canPopPolicy(s: GameState, id: string): string | null {
  if (!s.polity) return '아직 준비 중이에요';
  const cur = popOf(s).policy;
  if (cur && cur.untilMs > s.worldMs) return '지금 정책이 끝나야 새로 고를 수 있어요';
  if (!POP_POLICIES.some((x) => x.id === id)) return '없는 정책이에요';
  return null;
}
export function setPopPolicy(s: GameState, id: string): GameState {
  if (canPopPolicy(s, id)) return s;
  const pol = popPolicy(id);
  const ns = withPolity(s, { pop: { ...popOf(s), policy: { id, untilMs: s.worldMs + POLICY_MS } } });
  return polityLog(ns, `${pol.icon} 인구 정책 '${pol.name}' 시작(7일)`);
}

export function birthTarget(s: GameState): number {
  const b = popBase(s);
  const e = econOf(s);
  let v = b.birth + (livePolicy(s)?.birth ?? 0) + (approvalOf(s) - 50) / 500;
  if (e.house > 15) v -= 0.1;
  if (e.unemp > 5) v -= 0.1;
  return clamp(v, 0.5, 3.5);
}

/** 15분마다 */
export function popTick(s: GameState): GameState {
  if (!s.polity) return s;
  const p = { ...popOf(s) };
  const b = popBase(s);
  p.birth = r3(p.birth + (birthTarget(s) - p.birth) * 0.01);
  const mt = b.migrant + (livePolicy(s)?.migrant ?? 0);
  p.migrant = r3(p.migrant + (mt - p.migrant) * 0.02);
  p.old = Math.round(clamp(p.old + (2.1 - p.birth) * 0.0015 - (p.migrant - b.migrant) * 0.0003, 3, 45) * 1000) / 1000;
  p.young = Math.round(clamp(p.young + (p.birth - 2.1) * 0.0012 + (p.migrant - b.migrant) * 0.0003, 5, 35) * 1000) / 1000;
  p.size = Math.round((p.size * (1 + (p.birth - 2.1) * 0.00001 + p.migrant * 0.000002)) * 1000) / 1000;
  let ns = withPolity(s, { pop: p });
  const was = popOf(s).policy;
  if (was && was.untilMs <= s.worldMs && was.untilMs > s.worldMs - 15 * 60e3) ns = tell(ns, `${popPolicy(was.id).icon} 인구 정책 '${popPolicy(was.id).name}'이(가) 끝났어요. 새로 고를 수 있어요.`);
  return ns;
}

/** 다섯 나이 묶음(80+·60대·40대·20대·10세↓) 비율: 고령·청년 비율에서 그림용으로 계산 */
export function pyramid(p: Pick<PopState, 'old' | 'young' | 'birth'>): number[] {
  const kid = clamp(p.birth * 7, 4, 30);
  const o80 = clamp(p.old * 0.35, 1, 20);
  const o60 = clamp(p.old * 0.9 + 4, 5, 30);
  const y20 = clamp(p.young + 2, 5, 30);
  const m40 = clamp(100 - kid - o80 - o60 - y20, 10, 30);
  return [o80, o60, m40, y20, kid];
}

registerDomRows((s, key) => {
  if (!s.polity) return [];
  const p = popOf(s);
  const b = popBase(s);
  const out: Array<[string, number]> = [];
  const pol = livePolicy(s);
  if (pol?.eff[key]) out.push([`${pol.icon} ${pol.name}`, pol.eff[key]!]);
  const aging = p.old - b.old;
  if (key === 'troop' && Math.abs(aging) >= 0.5) out.push([`👴 고령 ${p.old.toFixed(1)}%`, -r2(clamp(aging * 0.01, -0.1, 0.15))]);
  if (key === 'budget' && Math.abs(aging) >= 0.5) out.push(['👴 연금 부담', -r2(clamp(aging * 0.005, -0.05, 0.08))]);
  if (key === 'research' && p.young - b.young >= 0.5) out.push(['🧑‍🎓 청년 인구', r2(Math.min(0.06, (p.young - b.young) * 0.01))]);
  return out;
});
registerGroupRows((s, g) => {
  const pol = s.polity ? livePolicy(s) : null;
  const v = pol?.groups[g];
  return v ? [[`${pol!.icon} ${pol!.name}`, v]] : [];
});
