// 11-28 대장 결정 "신앙 = 가(문화 갈래 안)": 직접 짓고 키우는 신앙 시설 3곳(각 1~5단계).
//  · ⛪ 신앙 센터·순례관: 우리 도시 민심 +(단계×0.6), 세계 영향력 문화 갈래 +
//  · 🤝 종교 간 대화 센터: 점령지 민심 +(단계×1), 다른 신앙 도시 저항 ↓(장악도 저항 확률 × (1 − 0.1×단계))
//  · 🏛️ 고대 성지 수호소: 세계 영향력 문화·외교 갈래 +, 단계마다 관광 수입 조금
// 그림은 /mnt/project-files/guides/faith-art(faith-<id>-<단계>.png). 그림이 오기 전에는 글자 아이콘.
import type { GameState } from './state';
import { budgetPerDay } from './state';
import { registerCityLoyaltyRows } from './civ';
import { homeOf } from './world';
import { pushReport } from './report';

const H = 3600e3;
export type FaithBuild = 'center' | 'dialog' | 'shrine';
export const FAITH_BUILDS: Array<{ id: FaithBuild; icon: string; name: string; text: string }> = [
  { id: 'center', icon: '⛪', name: '신앙 센터·순례관', text: '우리 도시 민심 +0.6/단계 · 문화 영향력 +' },
  { id: 'dialog', icon: '🤝', name: '종교 간 대화 센터', text: '점령지 민심 +1/단계 · 저항 −10%/단계' },
  { id: 'shrine', icon: '🏛️', name: '고대 성지 수호소', text: '문화·외교 영향력 + · 순례 관광 수입' },
];
export const FAITH_MAX = 5;
export interface FaithState {
  lv: Record<FaithBuild, number>;
  build: { id: FaithBuild; endMs: number } | null;
}
export const faithOf = (s: GameState): FaithState => s.faith ?? { lv: { center: 0, dialog: 0, shrine: 0 }, build: null };
export const faithLv = (s: GameState, id: FaithBuild) => faithOf(s).lv[id] ?? 0;
export const faithTotal = (s: GameState) => faithLv(s, 'center') + faithLv(s, 'dialog') + faithLv(s, 'shrine');
/** 다음 단계 값(하루 나라 예산 × 0.4 × 다음 단계) · 시간(6시간 × 다음 단계) */
export const faithCost = (s: GameState, id: FaithBuild) => Math.round(budgetPerDay(s, s.player.countryId) * 0.4 * (faithLv(s, id) + 1));
export const faithHours = (s: GameState, id: FaithBuild) => 6 * (faithLv(s, id) + 1);

export function canFaith(s: GameState, id: FaithBuild): string | null {
  const f = faithOf(s);
  if (f.build) return `${FAITH_BUILDS.find((b) => b.id === f.build!.id)!.name} 짓는 중`;
  if (faithLv(s, id) >= FAITH_MAX) return '최고 단계';
  const cost = faithCost(s, id);
  if (s.nations[s.player.countryId].treasury < cost) return `나라 예산 ${cost.toLocaleString('ko-KR')} 필요`;
  return null;
}
export function startFaith(s: GameState, id: FaithBuild): GameState {
  if (canFaith(s, id)) return s;
  const me = s.player.countryId;
  const cost = faithCost(s, id);
  return { ...s, faith: { ...faithOf(s), build: { id, endMs: s.worldMs + faithHours(s, id) * H } }, nations: { ...s.nations, [me]: { ...s.nations[me], treasury: s.nations[me].treasury - cost } } };
}
export function faithTick(s: GameState): GameState {
  const f = faithOf(s);
  if (!f.build || s.worldMs < f.build.endMs) return s;
  const id = f.build.id;
  const lv = { ...f.lv, [id]: (f.lv[id] ?? 0) + 1 };
  const b = FAITH_BUILDS.find((x) => x.id === id)!;
  return pushReport({ ...s, faith: { lv, build: null } }, { icon: b.icon, text: `대장님, ${b.name}이(가) ${lv[id]}단계가 됐습니다.` });
}
/** 장악도 저항 확률 배율 */
export const faithResist = (s: GameState) => 1 - 0.1 * faithLv(s, 'dialog');

registerCityLoyaltyRows((s, cityId) => {
  const me = s.player.countryId;
  if (s.world.owner[cityId] !== me || !s.faith) return [];
  const rows: Array<[string, number]> = [];
  const c = faithLv(s, 'center');
  if (c) rows.push(['⛪ 신앙 센터', Math.round(c * 0.6 * 10) / 10]);
  const d = faithLv(s, 'dialog');
  if (d && homeOf(s.world, cityId) !== me) rows.push(['🤝 종교 간 대화', d]);
  return rows;
});
