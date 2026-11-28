// 11-27 종합 확장안 전투 4: 전쟁 목표와 협상.
// 전쟁 중인 나라마다 목표 하나를 정함: 도시 한 곳 할양 · 배상금 · 정권 교체 · 완전 정복.
// 목표를 이루면 「협상으로 끝내기」로 확률 없이 전쟁을 끝내고 목표에 맞는 보상을 받음.
// 목표보다 더 차지하면(욕심) 다른 나라들의 호감이 깎임. 완전 정복은 협상이 없고, 정할 때 세계가 경계함.
import { FRONT, cityById } from '../data/cities';
import { COUNTRIES, countryById } from '../data/world';
import { addFavorNote } from './civ';
import { pushReport } from './report';
import { budgetPerDay, type GameState } from './state';
import { noteCapture } from './territory';
import { isAlive, pairKey, relationOf, syncFollowers } from './world';

export type GoalId = 'city' | 'money' | 'regime' | 'total';
export interface GoalDef { id: GoalId; icon: string; name: string; need: string; reward: string; /** 이만큼까지는 욕심이 아님(차지한 본토 도시 수) */ allow: number }
export const GOALS: GoalDef[] = [
  { id: 'city', icon: '🏙️', name: '도시 한 곳 할양', need: '본토 도시 1곳 차지', reward: '차지한 도시를 인정받고 휴전 · 명성 +30', allow: 2 },
  { id: 'money', icon: '💰', name: '배상금', need: '본토 도시 1곳 차지', reward: '도시를 모두 돌려주고 배상금(내 하루 예산 3일 치) · 호감 +10', allow: 1 },
  { id: 'regime', icon: '🏛️', name: '정권 교체', need: '수도 차지', reward: '수도만 돌려주고 우리 편 정권을 세움(연합) · 명성 +60', allow: 99 },
  { id: 'total', icon: '🔥', name: '완전 정복', need: '협상 없음', reward: '끝까지 싸워요. 정하는 순간 다른 나라 호감 −4', allow: 99 },
];
export const goalById = (id: GoalId) => GOALS.find((g) => g.id === id)!;
/** 욕심: 넘친 도시 하나마다 다른 나라 호감 */
export const GREED_FAVOR = -3;
export const TOTAL_FAVOR = -4;
export const MONEY_DAYS = 3;

export interface WarGoal { goal: GoalId; /** 목표를 정할 때 이미 갖고 있던 그 나라 본토 도시 수 */ base: number; /** 욕심 벌을 준 도시 수 */ greed: number }
export type WarGoals = Record<string, WarGoal>;

const atWar = (s: GameState, foe: string) => relationOf(s.world, s.player.countryId, foe) === '전쟁';
export const warGoalOf = (s: GameState, foe: string): WarGoal | null => (atWar(s, foe) ? s.warGoals?.[foe] ?? null : null);
const homeHeld = (s: GameState, foe: string) => FRONT.filter((c) => c.home === foe && s.world.owner[c.id] === s.player.countryId);
/** 이 전쟁에서 차지한 그 나라 본토 도시 수 */
export function takenIn(s: GameState, foe: string): number {
  const g = warGoalOf(s, foe);
  return Math.max(0, homeHeld(s, foe).length - (g?.base ?? 0));
}
// 11-28 수도는 함락 불가: 정권 교체 목표 = 수도를 뺀 본토 거점을 모두 차지
const capitalHeld = (s: GameState, foe: string) => FRONT.filter((c) => c.home === foe && !c.capital).every((c) => s.world.owner[c.id] === s.player.countryId);

export function canSetGoal(s: GameState, foe: string): string | null {
  if (!atWar(s, foe)) return '전쟁 중인 나라가 아니에요';
  if (warGoalOf(s, foe)) return '이미 목표를 정했어요';
  return null;
}
export function setGoal(s: GameState, foe: string, goal: GoalId): GameState {
  if (canSetGoal(s, foe)) return s;
  const me = s.player.countryId;
  let ns: GameState = { ...s, warGoals: { ...(s.warGoals ?? {}), [foe]: { goal, base: homeHeld(s, foe).length, greed: 0 } } };
  if (goal === 'total') for (const c of COUNTRIES) if (c.id !== me && c.id !== foe && isAlive(s.world, c.id)) ns = addFavorNote(ns, c.id, `🔥 ${countryById(foe).name} 완전 정복 선언`, TOTAL_FAVOR);
  return pushReport(ns, { icon: goalById(goal).icon, text: `${countryById(foe).name} 전쟁의 목표를 「${goalById(goal).name}」(으)로 정했습니다.` });
}

export function goalMet(s: GameState, foe: string): boolean {
  const g = warGoalOf(s, foe);
  if (!g || g.goal === 'total') return false;
  return g.goal === 'regime' ? capitalHeld(s, foe) : takenIn(s, foe) >= 1;
}

/** 세계 판단마다: 목표보다 더 차지했으면 세계가 견제 */
export function warGoalTick(s: GameState): GameState {
  if (!s.warGoals) return s;
  const me = s.player.countryId;
  let ns = s;
  for (const [foe, g] of Object.entries(s.warGoals)) {
    if (!atWar(s, foe)) {
      const rest = { ...ns.warGoals };
      delete rest[foe];
      ns = { ...ns, warGoals: rest };
      continue;
    }
    const over = Math.max(0, takenIn(s, foe) - goalById(g.goal).allow);
    if (over <= g.greed) continue;
    for (const c of COUNTRIES) if (c.id !== me && c.id !== foe && isAlive(s.world, c.id)) ns = addFavorNote(ns, c.id, `😠 ${countryById(foe).name}에서 목표보다 더 차지함`, GREED_FAVOR * (over - g.greed));
    ns = { ...ns, warGoals: { ...ns.warGoals, [foe]: { ...g, greed: over } } };
    ns = pushReport(ns, { icon: '😠', text: `전쟁 목표(${goalById(g.goal).name})보다 더 차지해서 다른 나라들이 우리를 경계합니다. 호감 ${GREED_FAVOR * (over - g.greed)}` });
  }
  return ns;
}

export const reparations = (s: GameState) => Math.round(budgetPerDay(s, s.player.countryId) * MONEY_DAYS);

/** 협상으로 끝내기(목표를 이뤘을 때만, 확률 없음) */
export function settleWar(s: GameState, foe: string): { state: GameState; text: string } {
  const g = warGoalOf(s, foe);
  if (!g || !goalMet(s, foe)) return { state: s, text: '' };
  const me = s.player.countryId;
  const name = countryById(foe).name;
  const k = pairKey(me, foe);
  const pair = s.world.pairs[k];
  const world = { ...structuredClone(s.world), pairs: { ...s.world.pairs, [k]: { ...pair, rel: g.goal === 'regime' ? ('연합' as const) : ('휴전' as const), tension: g.goal === 'regime' ? 0 : 20, weariness: 0 } } };
  let ns: GameState = { ...s, world };
  let text: string;
  const giveBack = (ids: string[]) => {
    for (const id of ids) {
      noteCapture(world, id, foe);
      world.owner[id] = foe;
      world.defense[id] = Math.max(world.defense[id] ?? 0, 40);
    }
    syncFollowers(world);
  };
  if (g.goal === 'city') {
    ns = { ...ns, officer: { ...ns.officer, fame: ns.officer.fame + 30 } };
    text = `🕊️ ${name}와(과) 협상으로 전쟁을 끝냈어요. 차지한 도시를 인정받았어요. 명성 +30`;
  } else if (g.goal === 'money') {
    const back = homeHeld(s, foe).map((c) => c.id);
    giveBack(back);
    const got = reparations(s);
    ns = { ...ns, nations: { ...ns.nations, [me]: { ...ns.nations[me], treasury: ns.nations[me].treasury + got } } };
    ns = addFavorNote(ns, foe, '🕊️ 도시를 돌려주고 끝냄', 10);
    text = `🕊️ ${name}에 도시 ${back.length}곳을 돌려주고 배상금 ${got.toLocaleString('ko-KR')}을(를) 받았어요. 호감 +10`;
  } else {
    giveBack([`${foe}-0`]);
    ns = { ...ns, officer: { ...ns.officer, fame: ns.officer.fame + 60 } };
    ns = addFavorNote(ns, foe, '🏛️ 우리가 세운 새 정권', 30);
    text = `🏛️ ${name}에 우리 편 정권이 들어섰어요. 수도 ${cityById(`${foe}-0`).name}을(를) 돌려주고 연합을 맺었어요. 명성 +60`;
  }
  const rest = { ...(ns.warGoals ?? {}) };
  delete rest[foe];
  ns = { ...ns, warGoals: rest, world: { ...ns.world, events: [{ t: s.worldMs, kind: '외교' as const, text, mine: true }, ...ns.world.events].slice(0, 200) } };
  return { state: pushReport(ns, { icon: '🕊️', text }), text };
}
