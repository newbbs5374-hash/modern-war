// A6 특구 지정(11/24): 내 도시를 특구로 지정(한국 경제자유구역·연구개발특구·혁신도시 등 참고).
// 나라 전체에 효과 + 이익집단 반응. 특구가 늘수록 '균형 발전 논란'으로 사회 안정이 조금 내려감. 해제는 공짜(하루 뒤 다시 지정 가능).
import type { GameState } from './state';
import type { LawKey } from './laws';
import { domLog, domOf, payTreasury, registerDomRows, snap, withDom, type Rows } from './domestic';
import { registerGroupRows } from './groups';
import { CITIES, cityById, isCoastalCity } from '../data/cities';
import { budgetPerDay } from './state';

export interface ZoneDef {
  id: string;
  icon: string;
  name: string;
  text: string;
  eff: Partial<Record<LawKey, number>>;
  groups: Partial<Record<string, number>>;
  coastal?: boolean;
}
export const ZONES: ZoneDef[] = [
  { id: 'fez', icon: '🏦', name: '경제자유구역', text: '국방예산 +4% · 경제 +2', eff: { budget: 0.04, economy: 2 }, groups: { biz: 5 } },
  { id: 'rnd', icon: '🔬', name: '연구개발특구', text: '연구 +8%', eff: { research: 0.08 }, groups: { youth: 4 } },
  { id: 'port', icon: '⚓', name: '항만물류특구', text: '자원 +5% · 무역 길 (바닷가 도시만)', eff: { res: 0.05, diplo: 1 }, groups: { labor: 3, biz: 2 }, coastal: true },
  { id: 'tour', icon: '🎡', name: '관광특구', text: '지지도 +1 · 외교 +2', eff: { approval: 1, diplo: 2 }, groups: { civic: 2, youth: 2 } },
  { id: 'arms', icon: '🛠️', name: '방위산업특구', text: '모집 +6%', eff: { build: 0.06 }, groups: { mil: 5, civic: -3 } },
  { id: 'inno', icon: '🏛️', name: '혁신도시', text: '모든 도시 민심 +3 · 사회 +2', eff: { loyalty: 3, society: 2 }, groups: { civic: 3, labor: 2 } },
];
export const zoneById = (id: string) => ZONES.find((z) => z.id === id);
export const ZONE_COST_DAYS = 6;
export const ZONE_WAIT_MS = 24 * 3600e3;

export function myCityIds(s: GameState): string[] {
  const me = s.player.countryId;
  return CITIES.filter((c) => s.world.owner[c.id] === me).map((c) => c.id);
}
export function zoneSlots(s: GameState): number {
  return Math.min(4, 1 + Math.floor(myCityIds(s).length / 3));
}
export function zoneCost(s: GameState): number {
  return Math.round(budgetPerDay(s, s.player.countryId) * ZONE_COST_DAYS);
}
export function canZone(s: GameState, cityId: string, kind: string): string | null {
  const d = domOf(s);
  const z = zoneById(kind);
  if (!z) return '없는 특구예요';
  if (!myCityIds(s).includes(cityId)) return '내 도시가 아니에요';
  if (d.zones[cityId]) return '이미 특구인 도시예요';
  if (liveZones(s).some(([, z]) => z.id === kind)) return '이 특구는 이미 다른 도시에 있어요';
  if (liveZones(s).length >= zoneSlots(s)) return `특구는 ${zoneSlots(s)}곳까지(도시 3곳마다 1곳 더)`;
  if (z.coastal && !isCoastalCity(cityId)) return '바닷가 도시만 돼요';
  const wait = Number(d.zones[`_wait_${cityId}`] ?? 0);
  if (wait > s.worldMs) return '해제한 지 하루가 안 지났어요';
  const me = s.nations[s.player.countryId];
  if (!me || me.treasury < zoneCost(s)) return '국방예산이 모자라요';
  return null;
}
export function setZone(s: GameState, cityId: string, kind: string): GameState {
  if (canZone(s, cityId, kind)) return s;
  const paid = payTreasury(s, zoneCost(s));
  if (!paid) return s;
  const d = domOf(paid);
  const z = zoneById(kind)!;
  const zones = { ...d.zones, [cityId]: kind };
  delete zones[`_wait_${cityId}`];
  let ns = withDom(paid, { zones });
  ns = domLog(ns, `${z.icon} ${cityById(cityId)?.name ?? cityId} ${z.name} 지정`);
  return snap(ns, 'ceremony', `${cityById(cityId)?.name ?? ''} ${z.name} 지정`, z.text);
}
export function clearZone(s: GameState, cityId: string): GameState {
  const d = domOf(s);
  if (!d.zones[cityId]) return s;
  const z = zoneById(d.zones[cityId]);
  const zones = { ...d.zones, [`_wait_${cityId}`]: String(s.worldMs + ZONE_WAIT_MS) };
  delete zones[cityId];
  return domLog(withDom(s, { zones }), `${z?.icon ?? ''} ${cityById(cityId)?.name ?? cityId} 특구 해제`);
}
/** 실제 특구(대기 기록 뺌) */
export function liveZones(s: GameState): Array<[string, ZoneDef]> {
  const me = s.player.countryId;
  return Object.entries(domOf(s).zones)
    .filter(([c]) => !c.startsWith('_wait_'))
    .filter(([c]) => s.world.owner[c] === me)
    .map(([c, k]) => [c, zoneById(k)!] as [string, ZoneDef])
    .filter(([, z]) => !!z);
}

registerDomRows((s, key) => {
  const rows: Rows = [];
  const live = liveZones(s);
  for (const [c, z] of live) if (z.eff[key]) rows.push([`${z.icon} ${z.name}(${cityById(c)?.name ?? c})`, z.eff[key]!]);
  if (key === 'society' && live.length > 1) rows.push(['⚖️ 균형 발전 논란', -(live.length - 1) * 1.5]);
  return rows;
});
registerGroupRows((s, g) => {
  const rows: Rows = [];
  for (const [, z] of liveZones(s)) if (z.groups[g]) rows.push([`${z.icon} ${z.name}`, z.groups[g]!]);
  return rows;
});
