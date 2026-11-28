// 11-28 7단계 추가 7 "자원 독점과 고갈": 희토류·리튬·갈륨의 세계 몫(실제 생산 나라 몫 × 그 나라 도시를 누가 쥐었나).
//  · 한 나라가 70% 넘게 쥐면 '수출 통제'로 상대 산업을 막음: 72시간 그 나라 나라 예산 −8%(우리가 당하면 부대 모집 −10%)
//  · 광물마다 3일에 한 번. 통제당한 나라 호감 −10
//  · 4장이 되면 석유가 줄어 세계 자원 −5%
import { FRONT } from '../data/cities';
import { countryById } from '../data/world';
import { addFavorNote } from './civ';
import { registerDomRows } from './domestic';
import { pushReport } from './report';
import { Rng } from './rng';
import type { GameState } from './state';
import { isAlive, pairKey, relationOf } from './world';

const H = 3600e3;
export const MONO_SHARE = 0.7;
export const CTRL_MS = 72 * H;
export const CTRL_WAIT = 72 * H;
export type MineralId = 'rare' | 'lithium' | 'gallium';
export const MINERALS: Record<MineralId, { icon: string; name: string; base: Record<string, number> }> = {
  rare: { icon: '🧲', name: '희토류', base: { cn: 0.7, au: 0.1, us: 0.08, in: 0.06, br: 0.06 } },
  lithium: { icon: '🔋', name: '리튬', base: { au: 0.45, cl: 0.25, cn: 0.15, ar: 0.1, br: 0.05 } },
  gallium: { icon: '🧪', name: '갈륨', base: { cn: 0.9, ru: 0.05, jp: 0.05 } },
};
export interface MineralState { ctrl: Array<{ m: MineralId; by: string; to: string; untilMs: number }>; ready: Record<string, number>; seed: number }
export const mineralsOf = (s: GameState): MineralState => s.minerals ?? { ctrl: [], ready: {}, seed: (s.world.seed ^ 0x3c6ef372) >>> 0 };

/** 광물별 나라 몫 */
export function mineralShares(s: GameState, m: MineralId): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [prod, v] of Object.entries(MINERALS[m].base)) {
    const cities = FRONT.filter((c) => c.home === prod);
    if (!cities.length) continue;
    for (const c of cities) {
      const own = s.world.owner[c.id];
      out[own] = (out[own] ?? 0) + v / cities.length;
    }
  }
  return out;
}
export const topHolder = (s: GameState, m: MineralId) => Object.entries(mineralShares(s, m)).sort((a, b) => b[1] - a[1])[0] ?? ['', 0];
const liveCtrl = (s: GameState) => mineralsOf(s).ctrl.filter((c) => c.untilMs > s.worldMs);
export const ctrlOn = (s: GameState, to: string) => liveCtrl(s).filter((c) => c.to === to);
/** 나라 예산 배율(AI가 통제당함) */
export const mineralMult = (s: GameState, id: string) => (id === s.player.countryId ? 1 : Math.pow(0.92, ctrlOn(s, id).length));

export function canControl(s: GameState, m: MineralId, to: string): string | null {
  const me = s.player.countryId;
  const share = mineralShares(s, m)[me] ?? 0;
  if (share < MONO_SHARE) return `${MINERALS[m].name} 세계 몫이 ${Math.round(MONO_SHARE * 100)}%를 넘어야 해요(지금 ${Math.round(share * 100)}%)`;
  if (to === me || !isAlive(s.world, to)) return '통제할 수 없는 나라예요';
  if ((mineralsOf(s).ready[`${me}:${m}`] ?? 0) > s.worldMs) return '광물마다 3일에 한 번이에요';
  return null;
}
export function exportControl(s: GameState, m: MineralId, to: string): { state: GameState; text: string } {
  const why = canControl(s, m, to);
  if (why) return { state: s, text: why };
  const me = s.player.countryId;
  const st = mineralsOf(s);
  let ns: GameState = { ...s, minerals: { ...st, ctrl: [...liveCtrl(s), { m, by: me, to, untilMs: s.worldMs + CTRL_MS }], ready: { ...st.ready, [`${me}:${m}`]: s.worldMs + CTRL_WAIT } } };
  ns = addFavorNote(ns, to, `${MINERALS[m].icon} ${MINERALS[m].name} 수출 통제`, -10);
  return { state: ns, text: `${MINERALS[m].icon} ${countryById(to).name}에 ${MINERALS[m].name} 수출을 막았어요. 72시간 그 나라 예산 −8% · 호감 −10` };
}

/** 세계 판단마다: 독점한 AI가 우리를 통제 */
export function mineralTick(s: GameState): GameState {
  if (s.ending || (s.world.act ?? 3) < 2) return s;
  const me = s.player.countryId;
  const st = mineralsOf(s);
  const rng = new Rng(st.seed);
  let ns = s;
  let next = st;
  for (const m of Object.keys(MINERALS) as MineralId[]) {
    const [by, share] = topHolder(s, m);
    if (!by || by === me || share < MONO_SHARE || !isAlive(s.world, by)) continue;
    if ((next.ready[`${by}:${m}`] ?? 0) > s.worldMs || ctrlOn(s, me).some((c) => c.m === m)) continue;
    const r = relationOf(s.world, me, by);
    if (r === '연합' || ((s.world.pairs[pairKey(me, by)]?.tension ?? 0) < 55 && r !== '전쟁') || !rng.chance(0.004)) continue;
    next = { ...next, ctrl: [...next.ctrl.filter((c) => c.untilMs > s.worldMs), { m, by, to: me, untilMs: s.worldMs + CTRL_MS }], ready: { ...next.ready, [`${by}:${m}`]: s.worldMs + CTRL_WAIT } };
    ns = pushReport(ns, { icon: MINERALS[m].icon, text: `대장님, ${countryById(by).name}이(가) 우리에게 ${MINERALS[m].name} 수출을 막았습니다. 72시간 부대 모집 −10%. 그 나라 광산 도시를 차지하면 몫을 빼앗을 수 있습니다.` });
  }
  return { ...ns, minerals: { ...next, seed: rng.seed } };
}

registerDomRows((s, key) => {
  const rows: Array<[string, number]> = [];
  if (key === 'build') for (const c of ctrlOn(s, s.player.countryId)) rows.push([`${MINERALS[c.m].icon} ${MINERALS[c.m].name} 수출 통제당함`, -0.1]);
  if (key === 'res' && (s.world.act ?? 0) >= 4) rows.push(['🛢️ 석유 고갈(4장)', -0.05]);
  return rows;
});
export const MINERAL_IDS = Object.keys(MINERALS) as MineralId[];
