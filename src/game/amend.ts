// 안 7 개헌 국민투표(11/26): 한 판에 2번까지 헌법을 고침. 국회 3분의 2(200표, 여당 + 무소속 절반)가 찬성해야 국민투표로 감.
// 국민투표는 6시간 뒤, 지지도가 높을수록 통과. 통과하면 판 끝까지 큰 효과, 실패하면 지지도·신뢰도 크게 깎이고 3일 쉼.
import { addPresMod, approvalOf } from './approval';
import { registerDomRows, snap } from './domestic';
import { registerGroupRows } from './groups';
import { registerCoopAdd } from './governors';
import { DAY, H, bumpTrust, clamp, polityOf, polityLog, roll, tell, withPolity } from './polity';
import { TWO_THIRDS, seatsOf } from './seats';
import type { LawKey } from './laws';
import type { GameState } from './state';

export const AMEND_MAX = 2;
export const REF_MS = 6 * H;
export const AMEND_WAIT_MS = 3 * DAY;

export interface AmendDef {
  id: string;
  icon: string;
  name: string;
  text: string;
  eff: Partial<Record<LawKey, number>>;
  groups: Partial<Record<string, number>>;
}
export const AMENDS: AmendDef[] = [
  { id: 'term', icon: '⏳', name: '임기 연장', text: '재신임 통과 +10% · 언론·시민단체 −8', eff: {}, groups: { press: -8, civic: -8 } },
  { id: 'defense', icon: '🛡️', name: '국방 강화', text: '징병 +10% · 모집 +5% · 군 +8 · 시민단체 −6', eff: { troop: 0.1, build: 0.05 }, groups: { mil: 8, civic: -6 } },
  { id: 'local', icon: '🗺️', name: '지방 분권', text: '시·도지사 협조 +15 · 모든 도시 민심 +3', eff: { loyalty: 3 }, groups: { civic: 3 } },
  { id: 'econ', icon: '💹', name: '경제 헌법', text: '나라 예산 +6% · 재계 +6 · 노동계 −4', eff: { budget: 0.06 }, groups: { biz: 6, labor: -4 } },
  { id: 'power', icon: '🏛️', name: '대통령 권한 강화', text: '신뢰도 +8 · 지지도 −3 · 언론 −10', eff: { trust: 8, approval: -3 }, groups: { press: -10 } },
  { id: 'rights', icon: '⚖️', name: '기본권 강화', text: '지지도 +4 · 사회 안정 +5 · 시민단체 +8 · 군 −4', eff: { approval: 4, society: 5 }, groups: { civic: 8, mil: -4 } },
];
export const amendById = (id: string) => AMENDS.find((a) => a.id === id)!;
export const amendOf = (s: GameState) => polityOf(s).amend;
export const hasAmend = (s: GameState, id: string) => !!s.polity && amendOf(s).passed.includes(id);

/** 국회 찬성표: 여당 전부 + 무소속 절반 + (야당 대표 협력이면 야당 1/4) */
export function amendYes(s: GameState): number {
  const st = seatsOf(s);
  const allyOpp = s.officer.rivals.some((rv, i) => rv.ally && (rv.role ?? (['야당 대표', '군부 실력자', '재벌'] as const)[i % 3]) === '야당 대표');
  return Math.round(st.ruling + st.ind * 0.5 + (allyOpp ? st.opp * 0.25 : 0));
}
export const refChance = (s: GameState) => clamp((approvalOf(s) - 35) / 40, 0.1, 0.9);

export function canPropose(s: GameState, id: string): string | null {
  if (!s.polity) return '아직 준비 중이에요';
  const a = amendOf(s);
  if (a.vote) return '국민투표가 진행 중이에요';
  if (a.passed.length >= AMEND_MAX) return `개헌은 한 판에 ${AMEND_MAX}번까지예요`;
  if (a.passed.includes(id)) return '이미 고친 헌법이에요';
  if (a.readyMs > s.worldMs) return '개헌이 실패해 3일 동안 쉬어야 해요';
  return null;
}
/** 개헌안 발의 → 국회 표결(바로) → 통과하면 6시간 뒤 국민투표 */
export function propose(s: GameState, id: string): GameState {
  if (canPropose(s, id)) return s;
  const a = amendOf(s);
  const def = amendById(id);
  const yes = amendYes(s);
  if (yes < TWO_THIRDS) {
    let ns = bumpTrust(s, -5);
    ns = withPolity(ns, { amend: { ...a, readyMs: s.worldMs + AMEND_WAIT_MS, failed: a.failed + 1 } });
    ns = polityLog(ns, `📜 개헌안 '${def.name}' 국회 부결(찬성 ${yes}/${TWO_THIRDS})`);
    return tell(ns, `📜 개헌안 '${def.name}'이(가) 국회에서 부결됐어요(찬성 ${yes}, ${TWO_THIRDS} 필요). 신뢰도 −5`);
  }
  const ns = withPolity(s, { amend: { ...a, vote: { id, atMs: s.worldMs + REF_MS, chance: refChance(s) } } });
  return polityLog(ns, `📜 개헌안 '${def.name}' 국회 통과(찬성 ${yes}) → 6시간 뒤 국민투표`);
}

export function amendTick(s: GameState): GameState {
  if (!s.polity) return s;
  const a = amendOf(s);
  if (!a.vote || a.vote.atMs > s.worldMs) return s;
  let ns = s;
  let r: number;
  [r, ns] = roll(ns);
  const chance = (a.vote.chance + refChance(ns)) / 2;
  const def = amendById(a.vote.id);
  if (r < chance) {
    ns = withPolity(ns, { amend: { ...a, vote: null, passed: [...a.passed, def.id] } });
    ns = addPresMod(ns, `📜 개헌 '${def.name}' 통과`, 3, 48);
    ns = polityLog(ns, `📜 국민투표 통과! '${def.name}' (${def.text})`);
    ns = tell(ns, `📜 개헌 국민투표가 통과됐어요! ${def.icon} ${def.name}: ${def.text}`);
    return snap(ns, 'signing', `개헌 '${def.name}'`, '국민투표 통과');
  }
  ns = withPolity(ns, { amend: { ...a, vote: null, readyMs: ns.worldMs + AMEND_WAIT_MS, failed: a.failed + 1 } });
  ns = addPresMod(ns, `📜 개헌 '${def.name}' 부결`, -8, 48);
  ns = bumpTrust(ns, -8);
  ns = polityLog(ns, `📜 국민투표 부결 '${def.name}'`);
  return tell(ns, `📜 개헌 국민투표가 부결됐어요. 지지도 −8 · 신뢰도 −8`);
}


registerDomRows((s, key) => {
  if (!s.polity) return [];
  const out: Array<[string, number]> = [];
  for (const id of amendOf(s).passed) {
    const d = amendById(id);
    if (d.eff[key]) out.push([`📜 개헌 ${d.name}`, d.eff[key]!]);
  }
  return out;
});
registerGroupRows((s, g) => {
  if (!s.polity) return [];
  const out: Array<[string, number]> = [];
  for (const id of amendOf(s).passed) {
    const v = amendById(id).groups[g];
    if (v) out.push([`📜 개헌 ${amendById(id).name}`, v]);
  }
  return out;
});
registerCoopAdd((s) => (hasAmend(s, 'local') ? 15 : 0));
