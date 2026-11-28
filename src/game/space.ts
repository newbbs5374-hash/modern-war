// 11-28 새 병과 4: 우주군. 지구 궤도에 위성을 띄움(전략군 탭).
// 정찰 위성: 전쟁 중인 나라를 늘 위성 정찰(정보전 신선도 유지) · 항법 위성: 우리 ICBM 요격당할 확률 ↓, 3D 전투 미사일류 공격 ↑
// 위성 요격(ASAT): 한 나라의 위성을 떨어뜨려 3일 동안 그 나라 미사일 방어망 절반 · 우주 쓰레기로 모든 나라 호감 −5
import { COUNTRIES, countryById } from '../data/world';
import { addFavorNote } from './civ';
import { pushReport } from './report';
import { priceBase, type GameState } from './state';
import { spyOf } from './spy';
import { isAlive, relationOf } from './world';

const H = 3600e3;
export type SatKind = 'recon' | 'nav' | 'asat';
export const SATS: Record<SatKind, { icon: string; name: string; text: string; hours: number; cost: number; max: number }> = {
  recon: { icon: '🛰️', name: '정찰 위성', text: '전쟁 중인 나라를 늘 내려다봐요(정보전 위성 정찰이 계속 켜짐). 2기부터 모든 맞수 나라도.', hours: 24, cost: 0.7, max: 3 },
  nav: { icon: '📡', name: '항법 위성', text: '한 기당 우리 ICBM이 요격당할 확률 −15%, 3D 전투 탄도·극초음속·해안 미사일 공격 +5%.', hours: 24, cost: 0.6, max: 3 },
  asat: { icon: '💥', name: '위성 요격 미사일', text: '한 나라 위성을 떨어뜨려요. 3일 동안 그 나라 미사일 방어망이 절반. 우주 쓰레기로 모든 나라 호감 −5.', hours: 12, cost: 0.9, max: 2 },
};
/** AI 나라 위성(떨어뜨릴 수 있는 나라) */
export const AI_SATS: Record<string, number> = { us: 6, cn: 4, ru: 4, uk: 2, fr: 2, in: 2, jp: 2, il: 1, de: 1, kr: 1 };
export const BLIND_MS = 72 * H;

export interface SpaceState { recon: number; nav: number; asat: number; job?: { kind: SatKind; endMs: number }; blind: Record<string, number>; shot: number }
export const spaceOf = (s: GameState): SpaceState => s.space ?? { recon: 0, nav: 0, asat: 0, blind: {}, shot: 0 };
export const satCost = (s: GameState, k: SatKind) => Math.max(800, Math.round(priceBase(s) * SATS[k].cost));

export function canLaunchSat(s: GameState, k: SatKind): string | null {
  const sp = spaceOf(s);
  if (sp.job) return '발사대가 다른 위성을 쏘는 중이에요';
  if (sp[k] >= SATS[k].max) return `${SATS[k].name}은(는) ${SATS[k].max}기까지예요`;
  if (s.nations[s.player.countryId].treasury < satCost(s, k)) return '나라 예산이 모자라요';
  return null;
}
export function launchSat(s: GameState, k: SatKind): { state: GameState; text: string } {
  const why = canLaunchSat(s, k);
  if (why) return { state: s, text: why };
  const me = s.player.countryId;
  const sp = spaceOf(s);
  return {
    state: { ...s, nations: { ...s.nations, [me]: { ...s.nations[me], treasury: s.nations[me].treasury - satCost(s, k) } }, space: { ...sp, job: { kind: k, endMs: s.worldMs + SATS[k].hours * H } } },
    text: `🚀 ${SATS[k].name} 발사 준비(${SATS[k].hours}시간).`,
  };
}
export const asatTargets = (s: GameState) => COUNTRIES.filter((c) => c.id !== s.player.countryId && isAlive(s.world, c.id) && (AI_SATS[c.id] ?? 0) > 0 && relationOf(s.world, s.player.countryId, c.id) !== '연합').map((c) => c.id);
export function canShoot(s: GameState, id: string): string | null {
  const sp = spaceOf(s);
  if (sp.asat <= 0) return '위성 요격 미사일이 없어요';
  if (!asatTargets(s).includes(id)) return '떨어뜨릴 위성이 없는 나라예요';
  if ((sp.blind[id] ?? 0) > s.worldMs) return '이미 눈이 먼 나라예요';
  return null;
}
export function shootSat(s: GameState, id: string): { state: GameState; text: string } {
  const why = canShoot(s, id);
  if (why) return { state: s, text: why };
  const me = s.player.countryId;
  const sp = spaceOf(s);
  let ns: GameState = { ...s, space: { ...sp, asat: sp.asat - 1, shot: sp.shot + 1, blind: { ...sp.blind, [id]: s.worldMs + BLIND_MS } } };
  ns = addFavorNote(ns, id, '💥 우리 위성을 떨어뜨림', -15);
  for (const c of COUNTRIES) if (c.id !== me && c.id !== id && isAlive(ns.world, c.id)) ns = addFavorNote(ns, c.id, '🛰️ 우주 쓰레기', -5);
  const text = `💥 ${countryById(id).name}의 군사 위성을 떨어뜨렸어요! 3일 동안 그 나라 미사일 방어망이 절반으로 줄어요.`;
  return { state: pushReport(ns, { icon: '💥', text }), text };
}
/** 그 나라 요격 확률 배수(눈 먼 나라 ×0.5, 우리 항법 위성 한 기당 ×0.85) */
export function interceptMul(s: GameState, id: string): number {
  const sp = spaceOf(s);
  return ((sp.blind[id] ?? 0) > s.worldMs ? 0.5 : 1) * Math.pow(0.85, sp.nav);
}
/** 3D 전투 미사일류 공격 배수 */
export const navBuff = (s: GameState) => 1 + 0.05 * spaceOf(s).nav;

export function spaceTick(s: GameState): GameState {
  const sp = s.space;
  if (!sp) return s;
  let ns = s;
  if (sp.job && sp.job.endMs <= s.worldMs) {
    const k = sp.job.kind;
    ns = { ...ns, space: { ...sp, job: undefined, [k]: sp[k] + 1 } };
    ns = pushReport(ns, { icon: '🛰️', text: `🛰️ ${SATS[k].name}이(가) 궤도에 올랐어요(${sp[k] + 1}기).` });
  }
  // 정찰 위성: 전쟁 중인 나라(2기부터 맞수까지)를 계속 정찰
  const rec = spaceOf(ns).recon;
  if (rec > 0) {
    const me = ns.player.countryId;
    const spy = spyOf(ns);
    const scout = { ...spy.scout };
    let changed = false;
    for (const c of COUNTRIES) {
      if (c.id === me || !isAlive(ns.world, c.id)) continue;
      const rel = relationOf(ns.world, me, c.id);
      if (rel !== '전쟁' && !(rec >= 2 && rel !== '연합' && (ns.world.pairs[[me, c.id].sort().join('|')]?.tension ?? 0) >= 40)) continue;
      const want = ns.worldMs + 24 * H;
      if ((scout[c.id] ?? 0) < want - 2 * H) {
        scout[c.id] = want;
        changed = true;
      }
    }
    if (changed) ns = { ...ns, spy: { ...spy, scout } };
  }
  return ns;
}
