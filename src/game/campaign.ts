// 11-27 종합 확장안 전투 2: 전역.
// 나라 하나를 칠 때 그 나라 본토 거점을 "내 수도에서 가까운 곳 → 수도" 순서로 차례로 뚫는다.
//  · 연달아 이기면 기세가 붙어 다음 전투가 쉬워짐
//  · 반격에 도시를 잃으면 보급선이 끊겨 다음 전투가 어려워짐
//  · 수도를 뺀 본토 거점을 모두 차지하면 전역 완료 보상(11-28 수도는 함락 불가 → 통일 권유)
// 그 나라가 남의 땅에서 차지한 도시는 순서와 상관없이 언제든 칠 수 있다. 장 기록이 없는 옛 저장은 순서 없음.
import { FRONT, cityById } from '../data/cities';
import { countryById } from '../data/world';
import { CAMPAIGN_CUT_DIFF, CAMPAIGN_REWARD, CAMPAIGN_STREAK_DIFF, CAMPAIGN_STREAK_MAX } from './balance';
import { goalsOf } from './goals';
import { pushReport } from './report';
import type { GameState } from './state';

export interface CampaignOne { streak: number; cut: boolean; taken: number }
export type CampaignState = { list: Record<string, CampaignOne>; done: string[] };
export const campaignOf = (s: GameState): CampaignState => s.campaign ?? { list: {}, done: [] };
const one = (s: GameState, foe: string): CampaignOne => campaignOf(s).list[foe] ?? { streak: 0, cut: false, taken: 0 };

/** 전역 길: 그 나라 본토 거점을 내 수도에서 가까운 순서로, 수도는 맨 끝 */
export function campaignRoute(s: GameState, foe: string): string[] {
  const cap = cityById(`${s.player.countryId}-0`);
  const d = (id: string) => Math.hypot(cityById(id).x - cap.x, cityById(id).y - cap.y);
  // 11-28: 수도는 함락할 수 없으므로 길에서 뺌
  return FRONT.filter((c) => c.home === foe && !c.capital)
    .map((c) => c.id)
    .sort((a, b) => d(a) - d(b));
}
/** 전역에서 다음에 칠 도시(그 나라가 아직 쥔 본토 거점 중 맨 앞). 없으면 null */
export function campaignNext(s: GameState, foe: string): string | null {
  return campaignRoute(s, foe).find((id) => s.world.owner[id] === foe) ?? null;
}
/** 전역 순서 때문에 아직 칠 수 없는 도시인가 */
export function campaignLocked(s: GameState, city: string): boolean {
  if (s.world.act == null) return false;
  const foe = s.world.owner[city];
  if (cityById(city).home !== foe) return false; // 남의 땅에서 차지한 도시는 언제든
  return campaignNext(s, foe) !== city;
}
/** 대전투 난이도에 더하는 값(기세는 −, 보급선 끊김은 +) */
export function campaignDiff(s: GameState, city: string): number {
  if (s.world.act == null) return 0;
  const c = one(s, s.world.owner[city]);
  return (c.cut ? CAMPAIGN_CUT_DIFF : 0) - Math.min(CAMPAIGN_STREAK_MAX, c.streak) * CAMPAIGN_STREAK_DIFF;
}
export function campaignInfo(s: GameState, foe: string) {
  const route = campaignRoute(s, foe);
  const me = s.player.countryId;
  return { route, next: campaignNext(s, foe), mine: route.filter((id) => s.world.owner[id] === me).length, ...one(s, foe) };
}

/** 도시를 차지한 직후(officer.captureCity). ns를 직접 바꿈 */
export function noteCampaignWin(ns: GameState, city: string, prev: string): void {
  if (ns.world.act == null || cityById(city).home !== prev) return;
  const cs = campaignOf(ns);
  const c = one(ns, prev);
  const list = { ...cs.list, [prev]: { streak: c.streak + 1, cut: false, taken: c.taken + 1 } };
  ns.campaign = { ...cs, list };
  if (campaignNext(ns, prev) === null && !cs.done.includes(prev)) {
    ns.campaign = { list, done: [...cs.done, prev] };
    const g = goalsOf(ns);
    ns.goals = { ...g, ruby: g.ruby + CAMPAIGN_REWARD.ruby };
    ns.officer.boosts = (ns.officer.boosts ?? 0) + CAMPAIGN_REWARD.boosts; // withOfficer 안이라 그 자리에서 바꿈
    const text = `🏁 ${countryById(prev).name} 전역 완료! 수도만 남기고 본토 거점을 모두 차지했어요. 6개월 반란 없이 지키면 통일을 권할 수 있어요. 💎 +${CAMPAIGN_REWARD.ruby} · 🎫 +${CAMPAIGN_REWARD.boosts}`;
    ns.world.events.unshift({ t: ns.worldMs, kind: '점령', text, mine: true });
    ns.reports = pushReport(ns, { icon: '🏁', text }).reports;
  }
}
/** 반격에 도시를 잃음(counter.settleCounter). ns를 직접 바꿈 */
export function noteCampaignLoss(ns: GameState, foe: string): void {
  if (ns.world.act == null) return;
  const cs = campaignOf(ns);
  ns.campaign = { ...cs, list: { ...cs.list, [foe]: { ...one(ns, foe), streak: 0, cut: true } } };
}
