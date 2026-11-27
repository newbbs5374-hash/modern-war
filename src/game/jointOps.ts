// 11-27 종합 확장안 전투 7: 연합 합동 작전.
//  · 지원 요청: 대전투에 나서기 전에 연합국 하나에 지원을 청함. 받아 주면 그 도시 대전투가 쉬워지고(하루), 그 나라 호감을 조금 씀.
//  · 도우러 가기: 전쟁 중인 연합국의 싸움에 우리 부대를 보냄. 이기면 호감과 전리품을 나눠 받고, 지면 병력을 조금 잃음.
import { cityById } from '../data/cities';
import { COUNTRIES, countryById } from '../data/world';
import { addFavorNote, favorOf } from './civ';
import { armyPower } from './economy';
import { pushReport } from './report';
import { Rng } from './rng';
import { budgetPerDay, type GameState } from './state';
import { isAlive, relationOf } from './world';

const H = 3600e3;
export const JOINT_DIFF = 0.1;
export const JOINT_MS = 24 * H;
/** 지원을 받으면 그 나라 호감에서 빠지는 값(신세) */
export const JOINT_FAVOR_COST = 6;
export const JOINT_ASK_GAP_MS = 6 * H;
export const HELP_GAP_MS = 8 * H;
export const HELP_FAVOR = 10;
/** 도와서 이기면 받는 전리품(하루 예산의 몫) · 지면 잃는 병력 */
export const HELP_LOOT = 0.4;
export const HELP_LOSS = 0.015;

export interface JointState {
  /** 도시 → 지원 온 연합국과 끝나는 때 */
  support: Record<string, { ally: string; untilMs: number }>;
  askMs: number;
  helpMs: number;
  helped: number;
  seed: number;
}
export const jointOf = (s: GameState): JointState => s.joint ?? { support: {}, askMs: 0, helpMs: 0, helped: 0, seed: (s.world.seed ^ 0x85ebca6b) >>> 0 };
export const alliesOf = (s: GameState) => COUNTRIES.filter((c) => c.id !== s.player.countryId && isAlive(s.world, c.id) && relationOf(s.world, s.player.countryId, c.id) === '연합');
export const supportOn = (s: GameState, city: string) => {
  const x = jointOf(s).support[city];
  return x && x.untilMs > s.worldMs ? x : null;
};
/** 대전투 난이도에 더하는 값(−) */
export const jointDiff = (s: GameState, city: string) => (supportOn(s, city) ? -JOINT_DIFF : 0);

export const askChance = (s: GameState, ally: string) => Math.max(0.2, Math.min(0.95, 0.3 + favorOf(s, ally) / 150));
export function canAsk(s: GameState, ally: string, city: string): string | null {
  if (!alliesOf(s).some((c) => c.id === ally)) return '연합국이 아니에요';
  if (supportOn(s, city)) return '이미 지원이 오고 있어요';
  if (s.worldMs < jointOf(s).askMs) return '방금 요청했어요. 조금 뒤에 다시 청하세요';
  if (s.world.owner[city] === ally) return '그 나라 도시예요';
  return null;
}
export function askSupport(s: GameState, ally: string, city: string): { state: GameState; ok: boolean; text: string } {
  if (canAsk(s, ally, city)) return { state: s, ok: false, text: '' };
  const j = structuredClone(jointOf(s));
  const rng = new Rng(j.seed);
  const ok = rng.chance(askChance(s, ally));
  j.seed = rng.seed;
  j.askMs = s.worldMs + JOINT_ASK_GAP_MS;
  const name = countryById(ally).name;
  let ns: GameState = { ...s, joint: j };
  if (!ok) return { state: ns, ok, text: `🤝 ${name}이(가) 지금은 부대를 보내기 어렵대요.` };
  j.support[city] = { ally, untilMs: s.worldMs + JOINT_MS };
  for (const k of Object.keys(j.support)) if (j.support[k].untilMs <= s.worldMs) delete j.support[k];
  ns = addFavorNote(ns, ally, '🤝 합동 작전 지원(신세)', -JOINT_FAVOR_COST);
  const text = `🤝 ${name}군이 ${cityById(city).name} 공격을 돕기로 했어요! 하루 동안 이 도시 대전투 난이도 −${JOINT_DIFF} · ${name} 호감 −${JOINT_FAVOR_COST}`;
  return { state: pushReport(ns, { icon: '🤝', text }), ok, text };
}

/** 연합국이 지금 싸우는 나라들 */
export const allyWars = (s: GameState, ally: string) => COUNTRIES.filter((c) => c.id !== ally && c.id !== s.player.countryId && isAlive(s.world, c.id) && relationOf(s.world, ally, c.id) === '전쟁');
export const helpChance = (s: GameState) => Math.max(0.3, Math.min(0.9, 0.45 + Math.min(0.3, armyPower(s) / 5000) + (s.officer.stats['통솔'] ?? 0) / 200));
export const helpLoot = (s: GameState) => Math.round(budgetPerDay(s, s.player.countryId) * HELP_LOOT);
export function canHelp(s: GameState, ally: string): string | null {
  if (!alliesOf(s).some((c) => c.id === ally)) return '연합국이 아니에요';
  if (!allyWars(s, ally).length) return '그 나라는 지금 전쟁 중이 아니에요';
  if (s.worldMs < jointOf(s).helpMs) return '부대가 돌아와 쉬는 중이에요';
  return null;
}
export function helpAlly(s: GameState, ally: string): { state: GameState; ok: boolean; text: string } {
  if (canHelp(s, ally)) return { state: s, ok: false, text: '' };
  const me = s.player.countryId;
  const j = structuredClone(jointOf(s));
  const rng = new Rng(j.seed);
  const ok = rng.chance(helpChance(s));
  const foe = rng.pick(allyWars(s, ally))!;
  j.seed = rng.seed;
  j.helpMs = s.worldMs + HELP_GAP_MS;
  const name = countryById(ally).name;
  let ns: GameState = { ...s, joint: j };
  let text: string;
  if (ok) {
    j.helped++;
    const loot = helpLoot(s);
    ns = { ...ns, nations: { ...ns.nations, [me]: { ...ns.nations[me], treasury: ns.nations[me].treasury + loot } } };
    ns = addFavorNote(ns, ally, '⚔️ 함께 싸워 줌', HELP_FAVOR);
    ns = addFavorNote(ns, foe.id, `⚔️ ${name} 편에서 싸움`, -6);
    text = `⚔️ ${name}군과 함께 ${foe.name}군을 물리쳤어요! ${name} 호감 +${HELP_FAVOR} · 전리품 나라 예산 +${loot.toLocaleString('ko-KR')}`;
  } else {
    ns = { ...ns, nations: { ...ns.nations, [me]: { ...ns.nations[me], troops: Math.max(0, ns.nations[me].troops * (1 - HELP_LOSS)) } } };
    ns = addFavorNote(ns, ally, '⚔️ 도우러 와 줌', Math.round(HELP_FAVOR / 3));
    text = `⚔️ ${name}을(를) 도우러 갔지만 ${foe.name}군에 밀렸어요. 병력 −${(HELP_LOSS * 100).toFixed(1)}% · ${name} 호감 +${Math.round(HELP_FAVOR / 3)}`;
  }
  return { state: pushReport(ns, { icon: '⚔️', text }), ok, text };
}
