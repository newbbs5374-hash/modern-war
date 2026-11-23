// 호칭(11-23 대장 결정): 승급 제도를 빼고, 의회 신뢰도(0~100) + 명성 점수(0~100) = 최대 200점으로 호칭 15단계가 정해짐.
// 명성 점수 = 명성 ÷ 10(명성 1,000이면 100점). 점수가 오르면 바로 호칭이 오르고, 내려가면(3점 여유) 호칭도 내려가요.
// 11-24 대장 결정: 호칭(평판)은 재신임 국민투표 통과 확률에만 영향을 줘요.
// 장관·장군·부관 자리 수, 만들 수 있는 병과, 잠금은 호칭과 상관없이 처음부터 모두 열려 있어요(player.rankIndex = 가장 높은 단계로 고정).
import { RANKS, TITLES, rankOfTier, type Title } from '../data/ranks';
import { eureka } from './civ';
import { makeAide, note, type OfficerState } from './officer';
import { Rng } from './rng';
import { rivalBlock } from './rivals';
import type { GameState } from './state';

/** 내려갈 때 여유(이만큼 더 떨어져야 호칭이 내려감) */
export const TITLE_SLACK = 3;
export const TITLE_MAX = 200;

export const famePts = (o: Pick<OfficerState, 'fame'>) => Math.max(0, Math.min(100, (o.fame ?? 0) / 10));
export const titleScore = (s: GameState) => Math.round(Math.max(0, Math.min(100, s.officer.trust)) + famePts(s.officer));

/** 점수 → 호칭 단계. prev를 주면 내려갈 때 여유를 둠 */
export function tierOf(score: number, prev?: number): number {
  let t = 0;
  for (let i = TITLES.length - 1; i >= 0; i--)
    if (score >= TITLES[i].min) {
      t = i;
      break;
    }
  if (prev !== undefined && t < prev && score >= TITLES[prev].min - TITLE_SLACK) return prev;
  return t;
}
export const tierNow = (s: GameState) => s.player.title ?? tierOf(titleScore(s));
export const titleOf = (s: GameState): Title => TITLES[tierNow(s)];
/** 다음 호칭과 남은 점수 */
export function nextTitle(s: GameState): { title: Title; need: number } | null {
  const t = tierNow(s);
  if (t >= TITLES.length - 1) return null;
  return { title: TITLES[t + 1], need: Math.max(0, TITLES[t + 1].min - titleScore(s)) };
}

/** 혜택 단계: 호칭과 상관없이 늘 가장 높은 단계(모든 자리·병과·잠금이 열림) */
export const OPEN_RANK = RANKS.length - 1;

/** 점수에 맞게 호칭을 맞추고 혜택 단계는 늘 열어 둠(advance 끝, 새 판, 옛 저장). 바뀌면 소식 */
export function syncTitle(s: GameState, quiet = false): GameState {
  const prev = s.player.title;
  let tier = tierOf(titleScore(s), prev);
  // 영향력 큰 정적이 있으면 가장 높은 호칭은 막힘(견제·회유로 풀기)
  if (tier === TITLES.length - 1 && rivalBlock(s)) tier = TITLES.length - 2;
  let ns: GameState = s;
  if (tier !== prev || s.player.rankIndex !== OPEN_RANK) ns = { ...s, player: { ...s.player, title: tier, rankIndex: OPEN_RANK } };
  // 첫 부관(출신 동료가 없을 때)
  if (ns.officer.aides.length === 0) {
    const o = structuredClone(ns.officer);
    const rng = new Rng(o.seed);
    const a = makeAide(o, rng);
    o.aides.push(a);
    o.seed = rng.seed;
    ns = { ...ns, officer: o };
    if (!quiet && prev !== undefined) {
      ns = { ...ns, world: { ...ns.world, events: [...ns.world.events] } };
      note(ns, `${a.name}이(가) 곁을 지키는 부관이 되었어요(${a.specialty}).`);
    }
  }
  if (prev === undefined || quiet || tier === prev) return ns;
  ns = { ...ns, world: { ...ns.world, events: [...ns.world.events] } };
  if (tier > prev) {
    note(ns, `🎖️ 호칭이 「${TITLES[tier].name}」(으)로 올랐어요! 재신임 국민투표가 조금 쉬워져요. (신뢰도+명성 ${titleScore(s)}점)`);
    const r = rankOfTier(tier);
    if (r > rankOfTier(prev)) ns = { ...ns, civ: eureka(ns, { kind: 'rank', at: r }).civ };
  } else note(ns, `📉 호칭이 「${TITLES[tier].name}」(으)로 내려갔어요. 재신임 국민투표가 조금 어려워져요.`);
  return ns;
}

/** 탄핵·재신임 실패·불신임 벌점: 신뢰도 −15 · 명성 −100(점수 −25). 호칭이 내려갈 수 있어요 */
export function titlePenalty(s: GameState, text: string): GameState {
  const o = structuredClone(s.officer);
  o.trust = Math.max(0, o.trust - 15);
  o.fame = Math.max(0, o.fame - 100);
  o.merit = 0;
  o.stars = 0;
  const ns: GameState = { ...s, officer: o, world: { ...s.world, events: [...s.world.events] } };
  note(ns, text);
  return ns;
}

/** 시험 버튼: 다음 호칭 점수까지 명성(모자라면 신뢰도)을 채움 */
export function debugTitleUp(s: GameState): GameState {
  const n = nextTitle(s);
  if (!n) return s;
  const o = structuredClone(s.officer);
  const want = n.title.min;
  const fameNeed = Math.max(0, want - Math.floor(o.trust) + 1);
  if (fameNeed <= 100) o.fame = Math.max(o.fame, fameNeed * 10);
  else {
    o.fame = 1000;
    o.trust = Math.min(100, Math.max(o.trust, want - 100 + 1));
  }
  return syncTitle({ ...s, officer: o });
}
