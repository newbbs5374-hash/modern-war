// A5 기본법 8칸(11/24): 칸마다 3~4가지 중 하나. 바꾸려면 국회 개정 표결(바로 결과, 신뢰도가 높을수록 잘 통과).
// 이익집단(groups.ts)마다 찬반이 갈려 만족도가 움직임. 바꾼 뒤 하루 동안은 다시 못 바꿈.
import { seatBonus } from './polity';
import type { GameState } from './state';
import type { LawKey } from './laws';
import { domLog, domOf, registerDomRows, snap, withDom } from './domestic';
import { bumpApproval } from './approval';
import { relationOf } from './world';
import { COUNTRIES } from '../data/world';
import { nextRandom } from './rng';

const H = 3600e3;
export const CODE_WAIT_MS = 24 * H;
export const CODE_FAIL_WAIT_MS = 12 * H;

export interface CodeOption {
  name: string;
  text: string;
  eff: Partial<Record<LawKey, number>>;
  /** 이익집단 반응(만족도 ±) */
  groups: Partial<Record<string, number>>;
  /** 전쟁 중에만 고를 수 있음 */
  war?: boolean;
}
export interface CodeSlot {
  id: string;
  icon: string;
  name: string;
  opts: CodeOption[];
}
export const CODES: CodeSlot[] = [
  {
    id: 'army',
    icon: '🪖',
    name: '병역',
    opts: [
      { name: '모병제', text: '징병 −10% · 지지도 +2', eff: { troop: -0.1, approval: 2 }, groups: { youth: 10, mil: -4 } },
      { name: '혼합제', text: '그대로', eff: {}, groups: {} },
      { name: '징병제', text: '징병 +12% · 모집 +3%', eff: { troop: 0.12, build: 0.03 }, groups: { youth: -10, mil: 6 } },
      { name: '전시 동원', text: '징병 +25% · 모집 +6% · 경제 −4 (전쟁 중만)', eff: { troop: 0.25, build: 0.06, economy: -4 }, groups: { youth: -18, civic: -8, mil: 10 }, war: true },
    ],
  },
  {
    id: 'labor',
    icon: '👷',
    name: '노동',
    opts: [
      { name: '유연 노동', text: '자원 +6% · 경제 +2', eff: { res: 0.06, economy: 2 }, groups: { biz: 10, labor: -12 } },
      { name: '표준', text: '그대로', eff: {}, groups: {} },
      { name: '노동 보호', text: '도시 민심 +3 · 자원 −4%', eff: { loyalty: 3, res: -0.04 }, groups: { labor: 12, biz: -8 } },
    ],
  },
  {
    id: 'tax',
    icon: '🧾',
    name: '조세 구조',
    opts: [
      { name: '법인세 인하', text: '경제 +4 · 예산 −3%', eff: { economy: 4, budget: -0.03 }, groups: { biz: 12, labor: -6 } },
      { name: '표준', text: '그대로', eff: {}, groups: {} },
      { name: '누진 강화', text: '예산 +5% · 경제 −2', eff: { budget: 0.05, economy: -2 }, groups: { biz: -10, labor: 6, civic: 4 } },
    ],
  },
  {
    id: 'press',
    icon: '📺',
    name: '언론',
    opts: [
      { name: '언론 자유', text: '신뢰도 +2 · 첩보 −3%', eff: { trust: 2, spy: -0.03 }, groups: { press: 12, civic: 6 } },
      { name: '표준', text: '그대로', eff: {}, groups: {} },
      { name: '언론 통제', text: '사회 +3 · 첩보 +5% · 신뢰도 −2', eff: { society: 3, spy: 0.05, trust: -2 }, groups: { press: -15, civic: -10, mil: 3 } },
    ],
  },
  {
    id: 'migr',
    icon: '🛂',
    name: '이민',
    opts: [
      { name: '개방', text: '자원 +4% · 외교 +2', eff: { res: 0.04, diplo: 2 }, groups: { biz: 8, youth: 4, labor: -6 } },
      { name: '선별', text: '그대로', eff: {}, groups: {} },
      { name: '폐쇄', text: '사회 +3 · 외교 −3', eff: { society: 3, diplo: -3 }, groups: { labor: 4, biz: -6, civic: -4 } },
    ],
  },
  {
    id: 'edu',
    icon: '🎓',
    name: '교육',
    opts: [
      { name: '평준화', text: '도시 민심 +2 · 연구 −3%', eff: { loyalty: 2, research: -0.03 }, groups: { civic: 4, labor: 3 } },
      { name: '표준', text: '그대로', eff: {}, groups: {} },
      { name: '과학 영재', text: '연구 +10% · 예산 −3%', eff: { research: 0.1, budget: -0.03 }, groups: { youth: 6, biz: 3 } },
      { name: '군사 교육', text: '모집 +4% · 안보 +2', eff: { build: 0.04, defense: 2 }, groups: { mil: 6, youth: -6, civic: -4 } },
    ],
  },
  {
    id: 'env',
    icon: '🌳',
    name: '환경',
    opts: [
      { name: '개발 우선', text: '자원 +6%', eff: { res: 0.06 }, groups: { biz: 6, civic: -10, youth: -6 } },
      { name: '표준', text: '그대로', eff: {}, groups: {} },
      { name: '녹색 성장', text: '외교 +3 · 자원 −4%', eff: { diplo: 3, res: -0.04 }, groups: { civic: 10, youth: 8, biz: -6 } },
    ],
  },
  {
    id: 'police',
    icon: '🚓',
    name: '치안',
    opts: [
      { name: '자율', text: '신뢰도 +1 · 사회 −3', eff: { trust: 1, society: -3 }, groups: { civic: 6, youth: 3 } },
      { name: '표준', text: '그대로', eff: {}, groups: {} },
      { name: '강경', text: '사회 +5 · 도시 민심 +2 · 신뢰도 −2', eff: { society: 5, loyalty: 2, trust: -2 }, groups: { civic: -10, mil: 4, press: -4 } },
    ],
  },
];
export const codeById = (id: string) => CODES.find((c) => c.id === id)!;

export function codePick(s: GameState, id: string): number {
  return domOf(s).codes.pick[id] ?? 1;
}
export function atWar(s: GameState): boolean {
  const me = s.player.countryId;
  return COUNTRIES.some((c) => c.id !== me && relationOf(s.world, me, c.id) === '전쟁');
}
/** 개정 통과 확률 */
export function codeChance(s: GameState): number {
  return Math.max(0.2, Math.min(0.95, 0.35 + s.officer.trust / 160 + seatBonus(s)));
}
export function canChangeCode(s: GameState, id: string, opt: number): string | null {
  const c = codeById(id);
  if (!c.opts[opt]) return '없는 선택이에요';
  if (codePick(s, id) === opt) return '지금 이 법이에요';
  if (c.opts[opt].war && !atWar(s)) return '전쟁 중에만 고를 수 있어요';
  const ready = domOf(s).codes.readyMs[id] ?? 0;
  if (ready > s.worldMs) return '아직 다시 개정할 수 없어요';
  return null;
}
/** 개정 표결(바로 결과). 통과하면 바꾸고 하루 대기, 부결이면 신뢰도 −2·반나절 대기 */
export function changeCode(s: GameState, id: string, opt: number): GameState {
  if (canChangeCode(s, id, opt)) return s;
  const c = codeById(id);
  const d = domOf(s);
  const roll = nextRandom(Math.floor(s.worldMs / 1000) + id.charCodeAt(0) * 131 + opt * 17)[0];
  const ok = roll < codeChance(s);
  if (!ok) {
    let ns = withDom(s, { codes: { ...d.codes, readyMs: { ...d.codes.readyMs, [id]: s.worldMs + CODE_FAIL_WAIT_MS } } });
    ns = { ...ns, officer: { ...ns.officer, trust: Math.max(0, ns.officer.trust - 2) } };
    return domLog(ns, `❌ ${c.icon} ${c.name}법 '${c.opts[opt].name}' 개정안 부결(신뢰도 −2)`);
  }
  let ns = withDom(s, { codes: { pick: { ...d.codes.pick, [id]: opt }, readyMs: { ...d.codes.readyMs, [id]: s.worldMs + CODE_WAIT_MS } } });
  ns = bumpApproval(ns, 0);
  ns = domLog(ns, `✅ ${c.icon} ${c.name}법 개정: ${c.opts[opt].name}`);
  return snap(ns, 'assembly', `${c.name}법 개정 통과`, c.opts[opt].name + ' · ' + c.opts[opt].text);
}
/** 전쟁이 끝나면 전시 동원은 혼합제로 돌아감 */
export function codesTick(s: GameState): GameState {
  if (!s.dom) return s;
  let ns = s;
  for (const c of CODES) {
    const p = codePick(ns, c.id);
    if (c.opts[p]?.war && !atWar(ns)) {
      const d = domOf(ns);
      ns = withDom(ns, { codes: { ...d.codes, pick: { ...d.codes.pick, [c.id]: 1 } } });
      ns = domLog(ns, `🕊️ 전쟁이 끝나 ${c.name}법이 ${c.opts[1].name}로 돌아갔어요`);
    }
  }
  return ns;
}
/** 집단 반응 합(groups.ts가 읽음) */
export function codeGroupRows(s: GameState, g: string): Array<[string, number]> {
  const out: Array<[string, number]> = [];
  for (const c of CODES) {
    const o = c.opts[codePick(s, c.id)];
    const v = o?.groups[g];
    if (v) out.push([`${c.icon} ${c.name}법: ${o.name}`, v]);
  }
  return out;
}

registerDomRows((s, key) => {
  const out: Array<[string, number]> = [];
  for (const c of CODES) {
    const o = c.opts[codePick(s, c.id)];
    const v = o?.eff[key];
    if (v) out.push([`⚖️ ${c.name}법: ${o.name}`, v]);
  }
  return out;
});
