// 11-27 종합 확장안 전투 3: 사전 작전 3종.
// 대전투에 나서기 전에 그 도시에 걸어 두는 준비 작전: 제공권 장악(공군) · 해상 봉쇄(해군, 바닷가 도시만) · 참수·파괴 공작(특수전).
// 성공하면 그 도시 대전투 난이도가 작전 하나마다 내려감(하루 동안). 실패하면 병력을 조금 잃고 3시간 뒤 다시 할 수 있음.
// 성공 확률: 그 병과 부대 수 + 지도자 스탯 − 도시 방어도.
import { cityById, isCoastalCity } from '../data/cities';
import { MAP_DOMAIN, baseUnit } from '../data/forces';
import type { StatId } from '../data/officers';
import { pushReport } from './report';
import { Rng } from './rng';
import type { GameState } from './state';

const H = 3600e3;
export type PrepId = 'air' | 'sea' | 'spec';
export interface PrepDef { id: PrepId; icon: string; name: string; text: string; stat: StatId; cost: string }
export const PREPS: PrepDef[] = [
  { id: 'air', icon: '✈️', name: '제공권 장악', text: '전투기로 하늘을 먼저 잡아요', stat: '전술', cost: "석유 15" },
  { id: 'sea', icon: '⚓', name: '해상 봉쇄', text: '함대로 바닷길을 막아요(바닷가 도시만)', stat: '통솔', cost: "석유 15" },
  { id: 'spec', icon: '🥷', name: '참수·파괴 공작', text: '특수 부대가 지휘소와 탄약고를 노려요', stat: '은밀', cost: '정보 10' },
];
export const prepById = (id: PrepId) => PREPS.find((p) => p.id === id)!;
/** 작전 하나가 내리는 대전투 난이도 */
export const PREP_DIFF = 0.08;
export const PREP_MS = 24 * H;
export const PREP_RETRY_MS = 3 * H;
export const PREP_FUEL = 15;
export const PREP_INTEL = 10;
export const PREP_LOSS = 0.01;

export interface PrepState {
  /** 도시 → 성공한 작전과 효과가 끝나는 때 */
  done: Record<string, { ops: PrepId[]; untilMs: number }>;
  /** 도시 → 작전 → 다시 할 수 있는 때 */
  retry: Record<string, Partial<Record<PrepId, number>>>;
  wins: number;
  seed: number;
}
export const prepOf = (s: GameState): PrepState => s.prep ?? { done: {}, retry: {}, wins: 0, seed: (s.world.seed ^ 0x27d4eb2f) >>> 0 };
export const prepLive = (s: GameState, city: string): PrepId[] => {
  const d = prepOf(s).done[city];
  return d && d.untilMs > s.worldMs ? d.ops : [];
};
/** 대전투 난이도에 더하는 값(−) */
export const prepDiff = (s: GameState, city: string) => -PREP_DIFF * prepLive(s, city).length;

/** 그 작전에 쓰는 부대 수 */
export function prepUnits(s: GameState, id: PrepId): number {
  let n = 0;
  for (const [name, cnt] of Object.entries(s.economy.army ?? {})) {
    const b = baseUnit(name);
    const dom = b === '미사일' ? 'air' : MAP_DOMAIN[b] ?? 'land';
    if (id === 'spec' ? /특수|특전|공수|저격/.test(name) || /특수|특전|공수|저격/.test(b) : dom === id) n += cnt;
  }
  return n;
}
export function prepChance(s: GameState, city: string, id: PrepId): number {
  const units = Math.min(0.3, prepUnits(s, id) * 0.03);
  const stat = Math.min(0.2, (s.officer.stats[prepById(id).stat] ?? 0) / 150);
  const def = (s.world.defense[city] ?? 50) / 400;
  return Math.max(0.15, Math.min(0.92, 0.45 + units + stat - def));
}
export function canPrep(s: GameState, city: string, id: PrepId): string | null {
  const me = s.player.countryId;
  if (s.world.owner[city] === me) return '우리 도시예요';
  if (prepLive(s, city).includes(id)) return '이미 성공했어요';
  if (id === 'sea' && !isCoastalCity(city)) return '바다가 없는 도시예요';
  const rt = prepOf(s).retry[city]?.[id] ?? 0;
  if (s.worldMs < rt) return '다시 준비하는 중이에요';
  if (id === 'spec') {
    if (s.officer.intel < PREP_INTEL) return `정보 점수가 모자라요(${PREP_INTEL})`;
  } else if ((s.economy.stock.석유 ?? 0) < PREP_FUEL) return `석유가 모자라요(${PREP_FUEL})`;
  return null;
}
export function doPrep(s: GameState, city: string, id: PrepId): { state: GameState; ok: boolean; text: string } {
  if (canPrep(s, city, id)) return { state: s, ok: false, text: '' };
  const me = s.player.countryId;
  const p = structuredClone(prepOf(s));
  const rng = new Rng(p.seed);
  const ok = rng.chance(prepChance(s, city, id));
  p.seed = rng.seed;
  const d = prepById(id);
  const name = cityById(city).name;
  let ns: GameState = id === 'spec' ? { ...s, officer: { ...s.officer, intel: s.officer.intel - PREP_INTEL } } : { ...s, economy: { ...s.economy, stock: { ...s.economy.stock, 석유: (s.economy.stock.석유 ?? 0) - PREP_FUEL } } };
  let text: string;
  if (ok) {
    const live = prepLive(s, city);
    p.done[city] = { ops: [...live, id], untilMs: s.worldMs + PREP_MS };
    p.wins++;
    text = `${d.icon} ${name} ${d.name} 성공! 하루 동안 이 도시 대전투가 쉬워져요(난이도 −${PREP_DIFF}).`;
  } else {
    p.retry[city] = { ...(p.retry[city] ?? {}), [id]: s.worldMs + PREP_RETRY_MS };
    ns = { ...ns, nations: { ...ns.nations, [me]: { ...ns.nations[me], troops: Math.max(0, ns.nations[me].troops * (1 - PREP_LOSS)) } } };
    text = `${d.icon} ${name} ${d.name} 실패. 병력 −${Math.round(PREP_LOSS * 100)}% · 3시간 뒤 다시 할 수 있어요.`;
  }
  // 지난 기록 치우기
  for (const k of Object.keys(p.done)) if (p.done[k].untilMs <= s.worldMs) delete p.done[k];
  ns = { ...ns, prep: p };
  return { state: ok ? pushReport(ns, { icon: d.icon, text }) : ns, ok, text };
}
