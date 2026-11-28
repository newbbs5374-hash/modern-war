// 11-28 대장 요청: 그림자 요원 뽑기·키우기
//  - 뽑기: 후보 3명이 나오고 그중 한 명을 고름. 💎10으로 후보를 새로 받을 수 있음(인재 명단 새로 받기처럼). 가끔 전설(SS)급 후보.
//  - 키우기: 훈련(돈, 6시간마다) · 특훈(💎) 으로 경험치 → 등급이 오르면 능력치 점수 +3 → 잠입·공작·은밀에 나눠 줌.
//    💎로 능력치 바로 올리기, 특기 다시 배우기, 바로 치료, 은퇴.
//  - 능력치가 높아야 주요 임무(사고 위장·누명·기술 탈취 등)에 보낼 수 있음(spy.ts need).
import { SKILLS, LV_MAX, PTS_PER_LV, STAT_MAX, TRAITS, agentById, agentCap, agentsOf, canRecruit, freeLegends, makeAgent, patchAgent, recruitCost, statsOf, withAgents, AGENT_MAX, type Agent, type AgentSkill, type LegendTrait, type StatKey } from './agents';
import { agencyOf } from './agents';
import { Rng } from './rng';
import { priceBase, type GameState } from './state';

const H = 3600e3;
export const CAND_N = 3;
export const CAND_RUBY = 10;
/** 후보가 전설(SS)급일 확률 */
export const CAND_SS = 0.08;
export const TRAIN_GAP_MS = 6 * H;
export const TRAIN_XP = 60;
export const DRILL_RUBY = 5;
export const DRILL_XP = 150;
export const STAT_RUBY = 8;
export const STAT_RUBY_UP = 4;
export const RESKILL_RUBY = 10;
export const HEAL_RUBY = 5;

const rubyOf = (s: GameState) => s.goals?.ruby ?? 0;
const payRuby = (s: GameState, n: number): GameState => (s.goals ? { ...s, goals: { ...s.goals, ruby: s.goals.ruby - n } } : s);
export const trainCost = (s: GameState) => Math.max(300, Math.round(priceBase(s) * 0.04));

/** 후보 만들기(전설급은 내 나라 정보기관 전설 중 아직 남은 사람) */
function rollCands(s: GameState, seed: number): { cands: Agent[]; seed: number } {
  const ag = agentsOf(s);
  const rng = new Rng(seed);
  const taken = new Set(ag.list.map((x) => x.name));
  const out: Agent[] = [];
  const legends = freeLegends(s, s.player.countryId);
  for (let i = 0; i < CAND_N; i++) {
    if (legends.length && rng.next() < CAND_SS) {
      const l = legends.splice(Math.floor(rng.next() * legends.length), 1)[0];
      out.push({ id: -1 - i, name: l.name, code: l.code, sex: l.sex, age: l.age, face: l.photo, skills: l.skills, lv: 5, xp: 0, status: 'idle', ops: 0, wins: 0, legend: true, photo: l.photo, home: l.country, from: agencyOf(l.country), trait: l.trait, stats: l.stats });
      taken.add(l.name);
      continue;
    }
    const a = makeAgent({ ...s, agents: { ...ag, list: [...ag.list, ...out] } }, rng, -1 - i, taken);
    // 가끔 유망주(능력치 하나가 높음)
    if (rng.next() < 0.3) {
      const k = rng.pick(['infil', 'ops', 'hush'] as StatKey[]);
      a.stats = { ...statsOf(a), [k]: 70 + Math.floor(rng.next() * 15) };
    }
    out.push(a);
  }
  return { cands: out, seed: rng.seed };
}

/** 지금 후보(없으면 씨앗으로 만들어 보여 줌 — 저장은 뽑거나 새로 받을 때) */
export function candsOf(s: GameState): Agent[] {
  const ag = agentsOf(s);
  return ag.cands ?? rollCands(s, (ag.seed ^ 0x5eed) >>> 0).cands;
}
export function canRefreshCands(s: GameState): string | null {
  if (rubyOf(s) < CAND_RUBY) return `💎${CAND_RUBY} 필요`;
  return null;
}
export function refreshCands(s: GameState): { state: GameState; text: string } {
  const why = canRefreshCands(s);
  if (why) return { state: s, text: why };
  const ag = agentsOf(s);
  const r = rollCands(s, (ag.seed ^ (s.worldMs >>> 7) ^ ((ag.cands?.length ?? 0) * 977)) >>> 0);
  const ss = r.cands.some((c) => c.legend);
  return { state: withAgents(payRuby(s, CAND_RUBY), { ...ag, cands: r.cands, seed: r.seed }), text: ss ? '🔄 후보를 새로 받았어요. 전설(SS)급 요원이 섞여 있어요!' : '🔄 요원 후보 3명을 새로 받았어요.' };
}
/** 후보 하나를 뽑음(일반 요원 자리·정보 점수·돈) */
export function canHire(s: GameState, i: number): string | null {
  const c = candsOf(s)[i];
  if (!c) return '후보가 없어요';
  if (c.legend) {
    if (agentsOf(s).list.filter((a) => a.status !== 'dead').length >= AGENT_MAX + 4) return '요원이 너무 많아요';
    const cost = recruitCost(s);
    if (s.officer.intel < cost.intel) return `정보 점수 ${cost.intel} 필요`;
    if (s.nations[s.player.countryId].treasury < cost.money * 3) return '나라 예산이 모자라요';
    return null;
  }
  return canRecruit(s);
}
export function hire(s: GameState, i: number): { state: GameState; text: string } {
  const why = canHire(s, i);
  if (why) return { state: s, text: why };
  const ag = agentsOf(s);
  const c = candsOf(s)[i];
  const cost = recruitCost(s);
  const me = s.player.countryId;
  const money = cost.money * (c.legend ? 3 : 1);
  const a: Agent = { ...c, id: ag.nextId };
  const lkey = c.legend ? freeLegends(s, c.home ?? me).find((l) => l.name === c.name)?.key : undefined;
  const r = rollCands({ ...s, agents: { ...ag, list: [...ag.list, a] } }, (ag.seed ^ 0xa11ce ^ ag.nextId) >>> 0);
  const ns: GameState = {
    ...s,
    nations: { ...s.nations, [me]: { ...s.nations[me], treasury: s.nations[me].treasury - money } },
    officer: { ...s.officer, intel: s.officer.intel - cost.intel },
    agents: { ...ag, list: [...ag.list, a], nextId: ag.nextId + 1, cands: r.cands, seed: r.seed, gone: lkey ? [...new Set([...(ag.gone ?? []), lkey])] : ag.gone },
  };
  return { state: ns, text: c.legend ? `🖤 전설 요원 "${c.code}" ${c.name}이 그림자실에 들어왔어요!` : `🕵️ "${a.code}" ${a.name}(${SKILLS[a.skills[0]].name}·${SKILLS[a.skills[1]].name})이 그림자실에 들어왔어요.` };
}
export const slotsText = (s: GameState) => `일반 ${agentsOf(s).list.filter((a) => !a.legend && a.status !== 'dead').length}/${agentCap(s)}`;

/* ───────── 키우기 ───────── */
function addXp(s: GameState, id: number, xp: number): { state: GameState; up: number } {
  const a = agentById(s, id)!;
  let x = a.xp + xp;
  let lv = a.lv;
  let pts = a.pts ?? 0;
  let up = 0;
  while (lv < LV_MAX && x >= lv * 100) {
    x -= lv * 100;
    lv++;
    pts += PTS_PER_LV;
    up++;
  }
  if (lv >= LV_MAX) x = Math.min(x, LV_MAX * 100);
  return { state: patchAgent(s, id, { xp: x, lv, pts }), up };
}
const busy = (a: Agent) => a.status === 'busy' || a.status === 'caught' || a.status === 'dead';

export function canTrain(s: GameState, id: number): string | null {
  const a = agentById(s, id);
  if (!a || busy(a)) return '지금은 훈련할 수 없어요';
  if (a.lv >= LV_MAX) return '최고 등급이에요';
  if ((a.trainMs ?? 0) > s.worldMs) return '아직 쉬는 중';
  if (s.nations[s.player.countryId].treasury < trainCost(s)) return '나라 예산이 모자라요';
  return null;
}
export function train(s: GameState, id: number): { state: GameState; text: string } {
  const why = canTrain(s, id);
  if (why) return { state: s, text: why };
  const me = s.player.countryId;
  let ns: GameState = { ...s, nations: { ...s.nations, [me]: { ...s.nations[me], treasury: s.nations[me].treasury - trainCost(s) } } };
  ns = patchAgent(ns, id, { trainMs: s.worldMs + TRAIN_GAP_MS });
  const r = addXp(ns, id, TRAIN_XP);
  const a = agentById(r.state, id)!;
  return { state: r.state, text: `🏋️ "${a.code}" 훈련 경험치 +${TRAIN_XP}${r.up ? ` · 등급 ${a.lv}로 올랐어요! 능력치 점수 +${r.up * PTS_PER_LV}` : ''}` };
}
export function canDrill(s: GameState, id: number): string | null {
  const a = agentById(s, id);
  if (!a || busy(a)) return '지금은 특훈할 수 없어요';
  if (a.lv >= LV_MAX) return '최고 등급이에요';
  if (rubyOf(s) < DRILL_RUBY) return `💎${DRILL_RUBY} 필요`;
  return null;
}
export function drill(s: GameState, id: number): { state: GameState; text: string } {
  const why = canDrill(s, id);
  if (why) return { state: s, text: why };
  const r = addXp(payRuby(s, DRILL_RUBY), id, DRILL_XP);
  const a = agentById(r.state, id)!;
  return { state: r.state, text: `🔥 "${a.code}" 특훈 경험치 +${DRILL_XP}${r.up ? ` · 등급 ${a.lv}로 올랐어요! 능력치 점수 +${r.up * PTS_PER_LV}` : ''}` };
}
/** 능력치 점수 1점 = 능력치 +3 */
export const PT_STEP = 3;
export function canSpendPt(s: GameState, id: number, k: StatKey): string | null {
  const a = agentById(s, id);
  if (!a || a.status === 'dead') return '요원이 없어요';
  if ((a.pts ?? 0) <= 0) return '능력치 점수가 없어요';
  if (statsOf(a)[k] >= STAT_MAX) return '이미 최고예요';
  return null;
}
export function spendPt(s: GameState, id: number, k: StatKey): GameState {
  if (canSpendPt(s, id, k)) return s;
  const a = agentById(s, id)!;
  const t = statsOf(a);
  return patchAgent(s, id, { pts: (a.pts ?? 0) - 1, stats: { ...t, [k]: Math.min(STAT_MAX, t[k] + PT_STEP) } });
}
export function canRubyStat(s: GameState, id: number, k: StatKey): string | null {
  const a = agentById(s, id);
  if (!a || a.status === 'dead') return '요원이 없어요';
  if (statsOf(a)[k] >= STAT_MAX) return '이미 최고예요';
  if (rubyOf(s) < STAT_RUBY) return `💎${STAT_RUBY} 필요`;
  return null;
}
export function rubyStat(s: GameState, id: number, k: StatKey): GameState {
  if (canRubyStat(s, id, k)) return s;
  const a = agentById(s, id)!;
  const t = statsOf(a);
  return patchAgent(payRuby(s, STAT_RUBY), id, { stats: { ...t, [k]: Math.min(STAT_MAX, t[k] + STAT_RUBY_UP) } });
}
/** 두 번째 특기를 다른 특기로 */
export function canReskill(s: GameState, id: number, k: AgentSkill): string | null {
  const a = agentById(s, id);
  if (!a || busy(a)) return '지금은 안 돼요';
  if (a.skills.includes(k)) return '이미 가진 특기예요';
  if (rubyOf(s) < RESKILL_RUBY) return `💎${RESKILL_RUBY} 필요`;
  return null;
}
export function reskill(s: GameState, id: number, k: AgentSkill): GameState {
  if (canReskill(s, id, k)) return s;
  const a = agentById(s, id)!;
  return patchAgent(payRuby(s, RESKILL_RUBY), id, { skills: [a.skills[0], k] });
}
export function canHeal(s: GameState, id: number): string | null {
  const a = agentById(s, id);
  if (!a || a.status !== 'hurt') return '다친 요원이 아니에요';
  if (rubyOf(s) < HEAL_RUBY) return `💎${HEAL_RUBY} 필요`;
  return null;
}
export function heal(s: GameState, id: number): GameState {
  if (canHeal(s, id)) return s;
  return patchAgent(payRuby(s, HEAL_RUBY), id, { status: 'idle', untilMs: undefined });
}
/** 은퇴: 자리를 비움(작전 중·붙잡힘은 안 됨) */
export function canRetire(s: GameState, id: number): string | null {
  const a = agentById(s, id);
  if (!a || busy(a)) return '지금은 은퇴시킬 수 없어요';
  if (agentsOf(s).list.filter((x) => x.status !== 'dead').length <= 1) return '마지막 요원이에요';
  return null;
}
export function retire(s: GameState, id: number): { state: GameState; text: string } {
  const why = canRetire(s, id);
  if (why) return { state: s, text: why };
  const ag = agentsOf(s);
  const a = agentById(s, id)!;
  return { state: withAgents(s, { ...ag, list: ag.list.filter((x) => x.id !== id) }), text: `👋 "${a.code}" ${a.name}이 조용히 은퇴했어요.` };
}
export const traitText = (t?: LegendTrait) => (t ? `${TRAITS[t].name} · ${TRAITS[t].text}` : '');
