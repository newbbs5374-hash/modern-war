// 11-27 대장 요청 2번: AI 나라들이 대륙 패권을 먼저 노리고, 강대국은 약소국을 쥐어짬.
// - 대륙 패권: 대륙(data/regions.ts)마다 힘 지분 1등이 패권국. 지분이 크면 나라 예산 +10%.
//   센 나라는 같은 대륙의 가장 약한 이웃을 '먹잇감'으로 골라 긴장을 쌓고, 2등은 1등에 도전함.
// - 경제 제재: 강대국이 약한 나라 예산을 깎음(12~25%, 2~4일).
// - 약탈 계약: 강대국이 약한 나라 자원을 헐값에 가져감(약한 나라 예산 −10~20%, 강대국은 그만큼 벌어 감).
//   AI 약소국은 겁먹고 받아들이거나 버티다 제재를 맞음. 우리 나라에는 '요구'로 와서 받기·거절을 고름.
// - 연합: 같은 적과 싸우거나 같은 패권국에 눌린 나라끼리 자주 연합을 맺고, 패권 다툼·외면으로 자주 깨짐.
// - 도움 요청: 전쟁에서 밀리는 나라가 연합국·이웃에 도움을 청함 → 함께 참전·병력·돈을 보내거나 외면.
//   우리에게도 도움 요청이 오고, 우리도 다른 나라에 도움을 청할 수 있음.
// - 정상 SNS: 이런 일이 생기면 정상들이 SNS로 헐뜯고 도움을 청하고 고마워함.
// AI 판단(실제 15분)마다 한 번. 같은 상태면 결과가 늘 같음.
import { isArchRival } from '../data/archRivals';
import { PERSONALITIES } from '../data/leaders';
import { regionName, regionOf } from '../data/regions';
import { COUNTRIES, countryById } from '../data/world';
import { actBlocksWar } from './acts';
import { ME_MAX_FRONTS, aiStrength } from './balance';
import { fillSns, snsOf, SNS_MAX, type SnsKind, type SnsPost } from './leaderSns';
import { Rng } from './rng';
import { bullyDoctrineOf } from './bully';
import type { GameState, NationState } from './state';
import { isVassalPair, lordOf } from './surrender';
import { declareWar, eul, ga, gwa, incomeShare, isAlive, isLosing, isRival, pairKey, playerFronts, relationOf, sameBloc, type WorldState } from './world';

const H = 3600e3;

export interface Sanction { from: string; to: string; rate: number; untilMs: number }
export interface Squeeze { from: string; to: string; res: string; drain: number; untilMs: number }
/** 우리 나라에 온 요구·요청 */
export interface HegAsk {
  id: number;
  kind: 'squeeze' | 'help' | 'bully';
  from: string;
  /** 깡패짓(bully.ts): 종류 · 우기는 것 · 굴복 값 */
  act?: import('../data/bullies').BullyAct;
  item?: string;
  cost?: number;
  /** 도움 요청: 그 나라와 싸우는 적 */
  enemy?: string;
  res?: string;
  drain?: number;
  untilMs: number;
}
export interface HegemonyState {
  sanctions: Sanction[];
  squeezes: Squeeze[];
  asks: HegAsk[];
  nextId: number;
  /** 대륙 → 지금 패권국 */
  leaders: Record<string, string>;
  /** 지분이 LEADER_SHARE를 넘어 예산 보너스를 받는 패권국(판단 때 정함) */
  bonus?: string[];
  /** AI 나라 → 다음에 도움을 청할 수 있는 시각 */
  helpCd: Record<string, number>;
  /** 우리가 그 나라에 다시 도움을 청할 수 있는 시각 */
  myHelpCd?: Record<string, number>;
  /** 세계에서 일어난 일 수(화면 요약) */
  stats?: { allies: number; breaks: number; helps: number; sanctions: number; squeezes: number; wars: number };
  /** 11-27 깡패 강대국 기록(bully.ts) */
  bully?: BullyStats;
}
export interface BullyStats {
  /** 깡패 나라 → 깡패짓 수 · 우리에게 한 수 */
  acts: Record<string, number>;
  onMe: Record<string, number>;
  /** 최근 깡패짓(새것 먼저) */
  log: Array<{ t: number; from: string; to: string; act: import('../data/bullies').BullyAct; text: string }>;
}

// ── 숫자(밸런스) ──
/** 먹잇감: 힘이 이 배율 넘게 차이 나는 같은 대륙 나라 · 판단마다 오르는 긴장(× 공격성) · 이미 이만큼 전쟁 중이면 쉼 */
export const PREY_RATIO = 1.3;
export const PREY_TENSION = 0.55;
export const PREY_MAX_WARS = 2;
/** 도전: 패권국 힘의 이 몫을 넘는 2등은 1등에게 긴장을 쌓음 */
export const CHALLENGE_SHARE = 0.6;
export const CHALLENGE_TENSION = 0.3;
/** 패권국 보너스: 대륙 힘 지분이 이만큼 넘으면 나라 예산 +LEADER_BONUS */
export const LEADER_SHARE = 0.4;
export const LEADER_BONUS = 0.1;
/** 강대국: 세계 힘 순위 이 안, 또는 대륙 패권국 */
export const GREAT_TOP = 5;
/** 제재: 강대국 하나가 판단마다 걸 확률 · 비율 · 시간 */
export const SANCTION_CHANCE = 0.002;
export const SANCTION_RATE: [number, number] = [0.12, 0.25];
export const SANCTION_HOURS: [number, number] = [48, 96];
/** 약탈 계약: 판단마다 확률 · 상대 힘이 이 몫 아래여야 · 빼앗는 몫 · 시간 */
export const SQUEEZE_CHANCE = 0.003;
export const SQUEEZE_WEAK = 0.6;
export const SQUEEZE_DRAIN: [number, number] = [0.1, 0.2];
export const SQUEEZE_HOURS: [number, number] = [72, 120];
/** 우리 나라에 온 요구·요청이 기다리는 시간 · 한 번에 열린 수 */
export const ASK_HOURS = 8;
export const ASK_MAX = 3;
/** 거절하면 맞는 제재 */
export const REFUSE_SANCTION = 0.2;
export const REFUSE_TENSION = 25;
/** 깎이는 나라 예산 상한 · 벌어 가는 상한 */
export const CUT_MAX = 0.5;
export const GAIN_MAX = 0.4;
/** 연합 맺기: 쌍마다 판단마다 바탕 확률(같은 적 ×8 · 같은 패권국 견제 ×4 · 같은 묶음 ×2) */
export const ALLY_FORM = 0.00015;
export const ALLY_MAX = 4;
/** 같은 대륙 연합국끼리 패권을 다투면 깨질 확률 */
export const RIVAL_BREAK = 0.004;
/** 도움 요청: 밀리는 나라가 판단마다 청할 확률 · 다시 청하기까지 */
export const HELP_ASK = 0.03;
export const HELP_CD_HOURS = 16;
/** 도와 달라는 말에 응한 AI가 함께 참전할 확률(AI 상대 · 우리 나라 상대) · 우리 나라가 이미 전선 ME_MAX_FRONTS개면 참전 안 함 */
export const JOIN_AI = 0.35;
export const JOIN_ME = 0.15;
/** 돕는 몫: 병력 · 돈 */
export const HELP_TROOPS = 0.06;
export const HELP_MONEY = 0.1;
/** 내가 도울 때 보내는 몫 · 외면하면 연합이 깨질 확률 */
export const MY_HELP_TROOPS = 0.05;
export const MY_HELP_MONEY = 0.08;
export const SNUB_BREAK = 0.3;
/** 우리가 같은 나라에 다시 도움을 청하기까지 */
export const MY_ASK_CD_HOURS = 6;

const RES = ['희토류', '석유', '천연가스', '리튬', '곡물', '반도체', '철광석', '코발트'];

export function hegOf(s: Pick<GameState, 'hegemony'>): HegemonyState {
  return s.hegemony ?? { sanctions: [], squeezes: [], asks: [], nextId: 1, leaders: {}, helpCd: {} };
}
const nm = (id: string) => countryById(id).name;
const per = (w: WorldState, id: string) => PERSONALITIES[w.personalities[id]];

/** 나라 힘 점수(병력·금고·가진 도시) */
export function strengthScore(s: Pick<GameState, 'nations' | 'world'>, id: string): number {
  const n = s.nations[id];
  if (!n || !isAlive(s.world, id)) return 0;
  const c = countryById(id);
  return (n.troops * (0.5 + c.military / 100)) / 1000 + n.treasury / 200 + incomeShare(s.world, id) * c.economy * 5;
}
/** 대륙 순위: 힘 지분 큰 순 */
export function regionStanding(s: Pick<GameState, 'nations' | 'world'>, rid: string, pre?: Record<string, number>): Array<{ id: string; score: number; share: number }> {
  const list = COUNTRIES.filter((c) => regionOf(c.id) === rid && isAlive(s.world, c.id)).map((c) => ({ id: c.id, score: pre?.[c.id] ?? strengthScore(s, c.id), share: 0 }));
  const sum = list.reduce((a, x) => a + x.score, 0) || 1;
  for (const x of list) x.share = x.score / sum;
  return list.sort((a, b) => b.score - a.score);
}
/** 나라가 쓰는 대륙 목록(사는 나라가 있는 곳만) */
export const liveRegions = (s: Pick<GameState, 'world'>) => [...new Set(COUNTRIES.filter((c) => isAlive(s.world, c.id)).map((c) => regionOf(c.id)))];

/** 그 나라가 지분이 큰 대륙 패권국인가 */
export function isHegemon(s: Pick<GameState, 'nations' | 'world'>, id: string): boolean {
  const st = regionStanding(s, regionOf(id));
  return st.length > 1 && st[0].id === id && st[0].share >= LEADER_SHARE;
}

/** 나라 예산 배율: 제재·약탈 계약으로 깎이고, 약탈 계약으로 벌고, 패권국이면 늚 */
export function hegemonyMult(s: GameState, id: string): number {
  const h = s.hegemony;
  if (!h) return 1;
  const t = s.worldMs;
  const me = s.player.countryId;
  let cut = 0;
  for (const x of h.sanctions) if (x.to === id && x.untilMs > t) cut += x.rate;
  for (const x of h.squeezes) if (x.to === id && x.untilMs > t) cut += x.drain;
  const base = (x: string) => countryById(x).budget * aiStrength(x, me);
  let gain = 0;
  for (const x of h.squeezes) if (x.from === id && x.untilMs > t) gain += (x.drain * base(x.to)) / Math.max(1, base(id));
  const bonus = h.bonus?.includes(id) ? LEADER_BONUS : 0;
  return (1 - Math.min(CUT_MAX, cut)) * (1 + Math.min(GAIN_MAX, gain)) * (1 + bonus);
}

export const sanctionsOn = (s: GameState, id: string) => hegOf(s).sanctions.filter((x) => x.to === id && x.untilMs > s.worldMs);
export const squeezesOn = (s: GameState, id: string) => hegOf(s).squeezes.filter((x) => x.to === id && x.untilMs > s.worldMs);
export const openAsks = (s: GameState) => hegOf(s).asks.filter((a) => a.untilMs > s.worldMs);

// ── SNS 글 ──
const SNS_TEXT: Record<string, string[]> = {
  sanction: [
    '"{B}에 경제 제재를 겁니다. 이 대륙의 질서는 우리가 정합니다."',
    '"{B:은} 선을 넘었습니다. 오늘부터 {B}의 돈줄을 막겠습니다."',
    '"{B}, 고개를 숙이기 전까지 제재는 풀리지 않습니다."',
  ],
  squeeze: [
    '"{B:과} 새 자원 협정을 맺었습니다. {R} 값은 우리가 정했죠."',
    '"{B}의 {R}, 이제 우리가 가져갑니다. 서로 좋은 거래입니다."',
  ],
  refused: [
    '"{B:이} 우리 제안을 거절했습니다. 후회하게 될 겁니다."',
    '"감히 {B:이}? 대가를 치르게 하겠습니다."',
  ],
  defy: [
    '"@{B} 우리 {R:은} 팔지 않습니다. 협박은 통하지 않아요."',
    '"@{B} 약한 나라를 쥐어짜는 게 강대국입니까? 부끄러운 줄 아세요."',
  ],
  hegemon: [
    '"{G}의 주인은 {A}입니다. 이 대륙은 우리가 지킵니다."',
    '"{G}에서 {A:을} 넘볼 나라는 없습니다."',
    '"{G}의 질서를 흔드는 나라는 우리가 상대합니다."',
  ],
  challenge: [
    '"{B}의 시대는 끝났습니다. {G}의 새 주인은 {A}입니다."',
    '"{B:은} 더 이상 {G}의 패권국이 아닙니다. 두고 보세요."',
  ],
  ask: [
    '"🆘 {B}, 지금 도와주세요! {E}의 공격을 함께 막아야 합니다."',
    '"🆘 친구 {B}, 우리 장병들이 버티고 있습니다. {E:을} 막을 힘을 빌려 주세요."',
  ],
  thanks: [
    '"고마워요, {B}! 어려울 때 친구가 진짜 친구입니다. {E}, 이제 각오하세요."',
    '"{B}의 도움 덕분에 다시 일어섰습니다. 이 은혜는 잊지 않겠습니다."',
  ],
  snub: [
    '"@{B} 친구라더니, 위기 때 등을 돌리는군요. 똑똑히 기억하겠습니다."',
    '"@{B} 말뿐인 동맹이었네요. 실망입니다."',
  ],
  ally: [
    '"{B:과} 손을 잡았습니다. {E:은} 이제 둘을 상대해야 합니다."',
    '"오늘 {B:과} 연합을 맺었습니다. 함께라면 두렵지 않아요."',
  ],
  betray: [
    '"@{B} 우리 연합은 여기까지입니다. {G}의 주인은 하나뿐이니까요."',
  ],
};
export function snsPush(ns: GameState, rng: Rng, from: string, to: string | undefined, kind: SnsKind, key: string, v: Record<string, string> = {}): GameState {
  const st = snsOf(ns);
  const vars = { A: nm(from), B: to ? nm(to) : '', ...v };
  const likes = Math.round(rng.range(0.4, 1.2) * countryById(from).economy * 700);
  const post: SnsPost = { id: st.nextId, t: ns.worldMs, from, to, kind, text: fillSns(rng.pick(SNS_TEXT[key]), vars), likes, shares: Math.round(likes * rng.range(0.08, 0.3)) };
  return { ...ns, sns: { ...st, nextId: st.nextId + 1, posts: [post, ...st.posts].slice(0, SNS_MAX) } };
}

export function event(w: WorldState, t: number, text: string, player: string, ...who: string[]) {
  w.events.unshift({ t, kind: '외교', text, mine: who.includes(player) });
  if (w.events.length > 150) w.events.length = 150;
}
export function addTension(w: WorldState, a: string, b: string, v: number): number {
  const p = w.pairs[pairKey(a, b)];
  if (!p || p.rel === '전쟁') return p?.tension ?? 0;
  if (p.rel === '연합' && v > 0) return p.tension;
  p.tension = Math.max(0, Math.min(100, p.tension + v));
  return p.tension;
}
export const warsOf = (w: WorldState, id: string) => COUNTRIES.filter((c) => c.id !== id && isAlive(w, c.id) && relationOf(w, id, c.id) === '전쟁').map((c) => c.id);
export const alliesOf = (w: WorldState, id: string) => COUNTRIES.filter((c) => c.id !== id && isAlive(w, c.id) && relationOf(w, id, c.id) === '연합').map((c) => c.id);

export function cloneW(s: GameState): WorldState {
  return { ...s.world, pairs: Object.fromEntries(Object.entries(s.world.pairs).map(([k, p]) => [k, { ...p }])), events: [...s.world.events] };
}
export function cloneH(s: GameState): HegemonyState {
  const h = hegOf(s);
  const t = s.worldMs;
  return {
    sanctions: h.sanctions.filter((x) => x.untilMs > t).map((x) => ({ ...x })),
    squeezes: h.squeezes.filter((x) => x.untilMs > t).map((x) => ({ ...x })),
    asks: h.asks.map((x) => ({ ...x })),
    nextId: h.nextId,
    leaders: { ...h.leaders },
    bonus: h.bonus,
    helpCd: { ...h.helpCd },
    myHelpCd: { ...(h.myHelpCd ?? {}) },
    stats: { allies: 0, breaks: 0, helps: 0, sanctions: 0, squeezes: 0, wars: 0, ...(h.stats ?? {}) },
    bully: { acts: { ...(h.bully?.acts ?? {}) }, onMe: { ...(h.bully?.onMe ?? {}) }, log: [...(h.bully?.log ?? [])] },
  };
}
export function put<T extends { from: string; to: string }>(list: T[], x: T) {
  const i = list.findIndex((y) => y.from === x.from && y.to === x.to);
  if (i >= 0) list[i] = x;
  else list.push(x);
}

/** AI가 도와 달라는 말에 응할 확률 */
export function helpChance(w: WorldState, helper: string, asker: string, enemy: string): number {
  if (relationOf(w, helper, enemy) === '연합' && relationOf(w, helper, asker) !== '연합') return 0.05;
  let p = relationOf(w, helper, asker) === '연합' ? 0.7 : 0.3;
  if (isRival(helper, enemy)) p *= 1.4;
  if (isArchRival(helper, enemy)) p *= 1.3;
  if (sameBloc(helper, asker)) p *= 1.2;
  if (warsOf(w, helper).length >= 2) p *= 0.5;
  const tz = w.pairs[pairKey(helper, asker)]?.tension ?? 0;
  p *= Math.max(0.2, 1 - tz / 120);
  return Math.max(0.02, Math.min(0.92, p));
}

export interface Tick {
  s: GameState;
  w: WorldState;
  h: HegemonyState;
  nations: Record<string, NationState>;
  rng: Rng;
  t: number;
  me: string;
}
export const live = (k: Tick): GameState => ({ ...k.s, world: k.w, nations: k.nations, hegemony: k.h });

/** AI가 도움 요청에 답함(돕거나 외면). 돌려준 글은 소식에 씀 */
function aiAnswerHelp(k: Tick, asker: string, helper: string, enemy: string): { ok: boolean; text: string } {
  const { w, rng, t, me, nations } = k;
  const ok = rng.chance(helpChance(w, helper, asker, enemy));
  if (!ok) {
    let text = `🙅 ${ga(nm(helper))} ${nm(asker)}의 도움 요청을 외면했어요.`;
    addTension(w, asker, helper, 12);
    if (relationOf(w, asker, helper) === '연합' && !isVassalPair(k.s, asker, helper) && rng.chance(SNUB_BREAK) && asker !== me && helper !== me) {
      const p = w.pairs[pairKey(asker, helper)];
      p.rel = '중립';
      p.tension = 40;
      k.h.stats!.breaks++;
      text += ` 화가 난 ${ga(nm(asker))} 연합을 깼어요.`;
    }
    event(w, t, text, me, asker, helper);
    if (asker !== me && rng.chance(0.6)) k.s = snsPush(live(k), rng, asker, helper, 'heg', 'snub');
    return { ok: false, text };
  }
  k.h.stats!.helps++;
  const canJoin = relationOf(w, helper, enemy) !== '전쟁' && !(w.act === 1 && (helper === me || enemy === me)) && !isVassalPair(k.s, helper, enemy);
  const r = rng.next();
  let text: string;
  // 우리 나라를 상대로는 덜 끼어듦(한꺼번에 여러 나라가 몰려와 판이 끝나지 않게): 이미 전쟁 3개 넘으면 참전 안 함
  const joinP = enemy === me ? (warsOf(w, me).length >= ME_MAX_FRONTS ? 0 : JOIN_ME) : JOIN_AI;
  if (canJoin && r < joinP && (relationOf(w, helper, asker) === '연합' || isRival(helper, enemy))) {
    declareWar(w, t, me, helper, enemy, `${eul(nm(asker))} 도우려고`);
    k.h.stats!.wars++;
    text = `🤝 ${ga(nm(helper))} ${nm(asker)} 편에 서서 ${nm(enemy)}에 맞서 참전했어요!`;
  } else if (r < 0.7) {
    const v = Math.round((nations[helper]?.troops ?? 0) * HELP_TROOPS);
    nations[helper] = { ...nations[helper], troops: nations[helper].troops - v };
    nations[asker] = { ...nations[asker], troops: nations[asker].troops + v };
    text = `🪖 ${ga(nm(helper))} ${nm(asker)}에 병력 ${v.toLocaleString('ko-KR')}명을 보냈어요.`;
  } else {
    const v = Math.round((nations[helper]?.treasury ?? 0) * HELP_MONEY);
    nations[helper] = { ...nations[helper], treasury: nations[helper].treasury - v };
    nations[asker] = { ...nations[asker], treasury: nations[asker].treasury + v };
    text = `💰 ${ga(nm(helper))} ${nm(asker)}에 전쟁 자금 ${v.toLocaleString('ko-KR')}을 보냈어요.`;
  }
  addTension(w, asker, helper, -15);
  event(w, t, text, me, asker, helper, enemy);
  if (asker !== me && rng.chance(0.6)) k.s = snsPush(live(k), rng, asker, helper, 'ally', 'thanks', { E: nm(enemy) });
  return { ok: true, text };
}

/** AI 판단마다: 패권 다툼·제재·약탈 계약·연합 맺고 깨기·도움 요청 */
export function hegemonyTick(s: GameState): GameState {
  if (s.ending) return s;
  const me = s.player.countryId;
  const t = s.worldMs;
  const k: Tick = { s, w: cloneW(s), h: cloneH(s), nations: { ...s.nations }, rng: new Rng((Math.floor(t / 60e3) * 2971215073 + s.world.seed * 13 + 29) >>> 0), t, me };
  const { w, h, rng } = k;
  const alive = COUNTRIES.map((c) => c.id).filter((id) => isAlive(w, id));
  const ais = alive.filter((id) => id !== me);
  const score: Record<string, number> = {};
  for (const id of alive) score[id] = strengthScore(s, id);
  const world = [...alive].sort((a, b) => score[b] - score[a]);
  const stand: Record<string, Array<{ id: string; score: number; share: number }>> = {};
  for (const r of liveRegions(s)) stand[r] = regionStanding(s, r, score);
  const great = new Set([...world.slice(0, GREAT_TOP), ...Object.values(stand).filter((x) => x.length > 1 && x[0].share >= LEADER_SHARE).map((x) => x[0].id)]);
  const meFull = playerFronts(w, me) >= ME_MAX_FRONTS;
  const lordAllied = (a: string, b: string) => relationOf(w, a, b) === '연합' || isVassalPair(s, a, b);

  // 지난 요구·요청: 시간이 지나면 거절로 침
  for (const a of h.asks.filter((x) => x.untilMs <= t)) {
    if (a.kind === 'squeeze' && isAlive(w, a.from)) refuseSqueeze(k, a, true);
  }
  h.asks = h.asks.filter((x) => x.untilMs > t && isAlive(w, x.from) && (x.kind !== 'help' || (x.enemy && relationOf(w, x.from, x.enemy) === '전쟁')));

  // ── 대륙 패권국 바뀜 ──
  for (const [rid, st] of Object.entries(stand)) {
    if (st.length < 2) continue;
    const top = st[0];
    const prev = h.leaders[rid];
    if (prev !== top.id && top.share >= LEADER_SHARE * 0.9) {
      h.leaders[rid] = top.id;
      event(w, t, `👑 ${ga(nm(top.id))} ${regionName(rid)} 패권을 쥐었어요(힘 지분 ${Math.round(top.share * 100)}%).${prev && isAlive(w, prev) ? ` ${nm(prev)}의 시대가 저물어요.` : ''}`, me, top.id, prev ?? '');
      if (top.id !== me) k.s = snsPush(live(k), rng, top.id, prev && isAlive(w, prev) ? prev : undefined, 'heg', prev && isAlive(w, prev) ? 'challenge' : 'hegemon', { G: regionName(rid) });
    } else if (!prev) h.leaders[rid] = top.id;
  }

  h.bonus = Object.values(stand).filter((x) => x.length > 1 && x[0].share >= LEADER_SHARE).map((x) => x[0].id);

  // ── 먹잇감·도전: 같은 대륙에서 긴장 쌓기 ──
  for (const a of ais) {
    const rid = regionOf(a);
    const st = stand[rid] ?? [];
    if (st.length < 2) continue;
    const foesA = warsOf(w, a);
    const myWars = foesA.length;
    // 같은 적과 싸우는 나라는 먹잇감으로 삼지 않음
    const sharesFoe = (x: string, y: string) => x === a && foesA.some((f) => relationOf(w, y, f) === '전쟁');
    const bd = bullyDoctrineOf(s, a);
    const agg = per(w, a).aggression * aiStrength(a, me) ** 0.5 * (bd?.agg ?? 1);
    if (myWars < PREY_MAX_WARS + (bd ? 1 : 0)) {
      // 가장 약한(힘 차이가 가장 큰) 같은 대륙 나라
      const prey = st
        .filter((x) => x.id !== a && !lordAllied(a, x.id) && relationOf(w, a, x.id) !== '전쟁' && score[a] >= x.score * PREY_RATIO && !(x.id === me && meFull) && !sharesFoe(a, x.id))
        .sort((x, y) => x.score - y.score)[0];
      if (prey) {
        const v = addTension(w, a, prey.id, PREY_TENSION * agg * rng.range(0.5, 1.5));
        if (v >= 100) {
          declareWar(w, t, me, a, prey.id, bd ? `${bd.name}를 외치며` : `${regionName(rid)} 패권을 노리고`);
          h.stats!.wars++;
        }
      }
    }
    // 2등 이하가 1등에게 도전
    const top = st[0];
    const mine = st.find((x) => x.id === a);
    if (top.id !== a && mine && mine.score >= top.score * CHALLENGE_SHARE && !lordAllied(a, top.id) && relationOf(w, a, top.id) !== '전쟁') {
      const v = addTension(w, a, top.id, CHALLENGE_TENSION * agg * rng.range(0.5, 1.5));
      if (v >= 100) {
        declareWar(w, t, me, a, top.id, `${regionName(rid)} 패권국 자리를 빼앗으려고`);
        h.stats!.wars++;
      }
    }
  }

  // ── 경제 제재 ──
  for (const a of ais) {
    if (!great.has(a) || !rng.chance(SANCTION_CHANCE * per(w, a).tension * aiStrength(a, me))) continue;
    const to = rng.weighted(
      alive.filter((b) => b !== a && !lordAllied(a, b) && relationOf(w, a, b) !== '전쟁' && score[b] < score[a] * 0.7 && !h.sanctions.some((x) => x.from === a && x.to === b)),
      (b) => (regionOf(a) === regionOf(b) ? 3 : 1) * (isArchRival(a, b) ? 3 : isRival(a, b) ? 2 : 1) * (b === me ? 1.5 : 1),
    );
    if (!to) continue;
    const rate = Math.round(rng.range(...SANCTION_RATE) * 100) / 100;
    put(h.sanctions, { from: a, to, rate, untilMs: t + rng.range(...SANCTION_HOURS) * H });
    h.stats!.sanctions++;
    addTension(w, a, to, 10);
    event(w, t, `🚫 강대국 ${ga(nm(a))} ${nm(to)}에 경제 제재! 나라 예산 −${Math.round(rate * 100)}%.${to === me ? ' 우리 예산이 줄어요(외교 → 패권에서 협상할 수 있어요).' : ''}`, me, a, to);
    if (rng.chance(0.7)) k.s = snsPush(live(k), rng, a, to, 'heg', 'sanction');
  }

  // ── 약탈 계약 ──
  for (const a of ais) {
    if (!great.has(a) || !rng.chance(SQUEEZE_CHANCE * per(w, a).aggression * aiStrength(a, me))) continue;
    const to = rng.weighted(
      alive.filter((b) => b !== a && relationOf(w, a, b) !== '전쟁' && score[b] < score[a] * SQUEEZE_WEAK && !h.squeezes.some((x) => x.from === a && x.to === b) && !h.asks.some((x) => x.from === a && x.kind === 'squeeze')),
      (b) => (regionOf(a) === regionOf(b) ? 3 : 1) * (lordOf(s, b) === a ? 3 : relationOf(w, a, b) === '연합' ? 0.5 : 1) * (b === me ? 1.3 : 1),
    );
    if (!to) continue;
    const res = rng.pick(RES);
    const drain = Math.round(rng.range(...SQUEEZE_DRAIN) * 100) / 100;
    if (to === me) {
      if (h.asks.length >= ASK_MAX) continue;
      h.asks.push({ id: h.nextId++, kind: 'squeeze', from: a, res, drain, untilMs: t + ASK_HOURS * H });
      event(w, t, `⛓️ ${ga(nm(a))} 우리 ${eul(res)} 헐값에 넘기라고 요구해요(나라 예산 −${Math.round(drain * 100)}%). 외교 → 패권에서 ${ASK_HOURS}시간 안에 답하세요. 거절하면 제재가 와요.`, me, a, me);
      continue;
    }
    // AI 약소국: 힘 차이가 클수록 겁먹고 받아들임(속국은 거의 늘)
    const fear = Math.max(0.2, Math.min(0.9, 1 - (score[to] / Math.max(1, score[a])) * 1.2)) * (lordOf(s, to) === a ? 1.5 : 1) / Math.max(0.6, per(w, to).aggression);
    if (rng.chance(fear)) {
      put(h.squeezes, { from: a, to, res, drain, untilMs: t + rng.range(...SQUEEZE_HOURS) * H });
      h.stats!.squeezes++;
      event(w, t, `⛓️ ${ga(nm(a))} ${nm(to)}의 ${eul(res)} 헐값에 가져가는 계약을 강요했어요. ${nm(to)} 예산 −${Math.round(drain * 100)}%.`, me, a, to);
      if (rng.chance(0.5)) k.s = snsPush(live(k), rng, a, to, 'heg', 'squeeze', { R: res });
    } else {
      refuseSqueeze(k, { id: 0, kind: 'squeeze', from: a, res, drain, untilMs: t }, false, to);
    }
  }

  // ── 연합 맺기 ──
  const foesOf: Record<string, string[]> = {};
  const allyN: Record<string, number> = {};
  for (const id of ais) {
    foesOf[id] = warsOf(w, id);
    allyN[id] = alliesOf(w, id).length;
  }
  for (let i = 0; i < ais.length; i++) {
    for (let j = i + 1; j < ais.length; j++) {
      const a = ais[i];
      const b = ais[j];
      const p = w.pairs[pairKey(a, b)];
      if (!p || (p.rel !== '중립' && p.rel !== '휴전') || p.tension >= 35) continue;
      // 먼저 주사위(가장 큰 배율로도 안 되면 바로 넘김: 쌍이 많아 계산을 아낌)
      const roll = rng.next();
      if (roll >= ALLY_FORM * 40) continue;
      const ea = foesOf[a];
      const eb = foesOf[b];
      const common = ea.find((x) => eb.includes(x));
      const ra = regionOf(a);
      const top = stand[ra]?.[0]?.id;
      const press = ra === regionOf(b) && top && top !== a && top !== b && !lordAllied(a, top) && !lordAllied(b, top) ? top : undefined;
      let m = 1;
      if (common) m *= 8;
      else if (press) m *= 4;
      if (sameBloc(a, b)) m *= 2;
      if (countryById(a).faith === countryById(b).faith) m *= 1.3;
      if (isRival(a, b)) m *= common ? 0.5 : 0.1;
      if (allyN[a] >= ALLY_MAX || allyN[b] >= ALLY_MAX) m *= 0.2;
      if (roll >= ALLY_FORM * m * (per(w, a).peace + per(w, b).peace) / 2) continue;
      p.rel = '연합';
      p.tension = 0;
      p.weariness = 0;
      allyN[a]++;
      allyN[b]++;
      h.stats!.allies++;
      const foe = common ?? press;
      event(w, t, `🤝 ${gwa(nm(a))} ${ga(nm(b))} ${foe ? `${nm(foe)}에 맞서 ` : ''}연합을 맺었어요.`, me, a, b);
      if (rng.chance(0.5)) k.s = snsPush(live(k), rng, a, b, 'ally', 'ally', { E: foe ? nm(foe) : '누구든' });
    }
  }

  // ── 같은 대륙 연합국끼리 패권 다툼으로 깨짐 ──
  for (const [rid, st] of Object.entries(stand)) {
    if (st.length < 2) continue;
    const [one, two] = st;
    if (!two || one.id === me || two.id === me || isVassalPair(s, one.id, two.id) || relationOf(w, one.id, two.id) !== '연합') continue;
    if (two.score < one.score * 0.7 || !rng.chance(RIVAL_BREAK * per(w, two.id).aggression)) continue;
    const p = w.pairs[pairKey(one.id, two.id)];
    p.rel = '중립';
    p.tension = 50;
    h.stats!.breaks++;
    event(w, t, `💔 ${gwa(nm(two.id))} ${ga(nm(one.id))} ${regionName(rid)} 패권을 두고 다투다 연합을 깼어요.`, me, one.id, two.id);
    k.s = snsPush(live(k), rng, two.id, one.id, 'heg', 'betray', { G: regionName(rid) });
  }

  // ── 도움 요청 ──
  for (const x of ais) {
    const foes = warsOf(w, x);
    if (!foes.length || (h.helpCd[x] ?? 0) > t) continue;
    const enemy = foes.sort((m, n) => score[n] - score[m])[0];
    const hurting = isLosing(w, x) || score[x] < score[enemy] * 0.9;
    if (!hurting || !rng.chance(HELP_ASK)) continue;
    h.helpCd[x] = t + HELP_CD_HOURS * H;
    const helper = rng.weighted(
      alive.filter((y) => y !== x && y !== enemy && relationOf(w, y, x) !== '전쟁' && relationOf(w, y, enemy) !== '연합'),
      (y) =>
        (relationOf(w, y, x) === '연합' ? 4 : 1) * (regionOf(y) === regionOf(x) ? 2 : 1) * (isArchRival(y, enemy) ? 4 : isRival(y, enemy) ? 3 : 1) * Math.max(0.1, 1 - (w.pairs[pairKey(x, y)]?.tension ?? 0) / 100) * (y === me ? 1.5 : 1),
    );
    if (!helper) continue;
    event(w, t, `🆘 ${ga(nm(x))} ${nm(enemy)}에 밀려 ${nm(helper)}에 도움을 청했어요.`, me, x, helper, enemy);
    if (rng.chance(0.7)) k.s = snsPush(live(k), rng, x, helper, 'ally', 'ask', { E: nm(enemy) });
    if (helper === me) {
      if (h.asks.length < ASK_MAX) h.asks.push({ id: h.nextId++, kind: 'help', from: x, enemy, untilMs: t + ASK_HOURS * H });
    } else aiAnswerHelp(k, x, helper, enemy);
  }

  return live(k);
}

/** 약탈 계약 거절: 강대국이 화가 나 제재. timeout = 우리가 답을 안 함 */
function refuseSqueeze(k: Tick, a: HegAsk, timeout: boolean, to = k.me) {
  const { w, h, rng, t, me } = k;
  addTension(w, a.from, to, REFUSE_TENSION);
  put(h.sanctions, { from: a.from, to, rate: REFUSE_SANCTION, untilMs: t + 72 * H });
  h.stats!.sanctions++;
  event(w, t, `🚫 ${ga(nm(to))} ${nm(a.from)}의 ${a.res} 요구를 ${timeout ? '못 본 척 넘겼어요' : '거절했어요'}. ${ga(nm(a.from))} 보복 제재 −${Math.round(REFUSE_SANCTION * 100)}%(3일).`, me, a.from, to);
  if (to !== me && rng.chance(0.6)) k.s = snsPush(live(k), rng, to, a.from, 'heg', 'defy', { R: a.res ?? '자원' });
  else if (rng.chance(0.6)) k.s = snsPush(live(k), rng, a.from, to, 'heg', 'refused');
}

// ── 우리 나라가 하는 일 ──

export function mine(s: GameState) {
  const rng = new Rng((s.world.seed ^ Math.floor(s.worldMs / 1000) ^ (hegOf(s).nextId * 7919) ^ 0x3c3c) >>> 0);
  return { s, w: cloneW(s), h: cloneH(s), nations: { ...s.nations }, rng, t: s.worldMs, me: s.player.countryId } as Tick;
}

/** 강대국 요구 받기·거절 */
export function answerSqueeze(s: GameState, askId: number, accept: boolean): { state: GameState; text: string } {
  const a = openAsks(s).find((x) => x.id === askId && x.kind === 'squeeze');
  if (!a) return { state: s, text: '' };
  const k = mine(s);
  k.h.asks = k.h.asks.filter((x) => x.id !== askId);
  if (accept) {
    put(k.h.squeezes, { from: a.from, to: k.me, res: a.res!, drain: a.drain!, untilMs: k.t + 96 * H });
    k.h.stats!.squeezes++;
    addTension(k.w, a.from, k.me, -15);
    event(k.w, k.t, `⛓️ ${nm(a.from)}의 ${a.res} 요구를 받아들였어요. 4일 동안 나라 예산 −${Math.round(a.drain! * 100)}%, 긴장 −15.`, k.me, a.from);
    return { state: live(k), text: `${nm(a.from)}에 ${eul(a.res!)} 헐값에 넘겼어요. 4일 동안 나라 예산 −${Math.round(a.drain! * 100)}% · 긴장 −15.` };
  }
  refuseSqueeze(k, a, false);
  return { state: live(k), text: `${nm(a.from)}의 요구를 거절했어요! 보복 제재 −${Math.round(REFUSE_SANCTION * 100)}%(3일) · 긴장 +${REFUSE_TENSION}.` };
}

/** 제재 풀기 협상 값 */
export function liftCost(s: GameState, from: string): number {
  const x = sanctionsOn(s, s.player.countryId).find((y) => y.from === from);
  return x ? Math.round(x.rate * countryById(from).economy * 350) : 0;
}
export function canLift(s: GameState, from: string): string | null {
  if (!sanctionsOn(s, s.player.countryId).some((y) => y.from === from)) return '우리에게 건 제재가 없어요';
  if ((s.nations[s.player.countryId]?.treasury ?? 0) < liftCost(s, from)) return `나라 예산 ${liftCost(s, from).toLocaleString('ko-KR')} 필요`;
  return null;
}
export function liftSanction(s: GameState, from: string): { state: GameState; text: string } {
  if (canLift(s, from)) return { state: s, text: '' };
  const k = mine(s);
  const cost = liftCost(s, from);
  k.h.sanctions = k.h.sanctions.filter((x) => !(x.from === from && x.to === k.me));
  k.nations[k.me] = { ...k.nations[k.me], treasury: k.nations[k.me].treasury - cost };
  const text = `${gwa(nm(from))} 협상해 제재를 풀었어요(나라 예산 −${cost.toLocaleString('ko-KR')}).`;
  event(k.w, k.t, `🤝 ${text}`, k.me, from);
  return { state: live(k), text };
}

export type HelpMode = 'troops' | 'money' | 'join' | 'refuse';
export function canHelp(s: GameState, askId: number, mode: HelpMode): string | null {
  const a = openAsks(s).find((x) => x.id === askId && x.kind === 'help');
  if (!a) return '요청이 없어요';
  if (mode === 'join') {
    if (relationOf(s.world, s.player.countryId, a.enemy!) === '전쟁') return '이미 전쟁 중이에요';
    return actBlocksWar(s, a.enemy!);
  }
  return null;
}
/** 도움 요청에 답하기 */
export function answerHelp(s: GameState, askId: number, mode: HelpMode): { state: GameState; text: string } {
  if (canHelp(s, askId, mode)) return { state: s, text: '' };
  const a = openAsks(s).find((x) => x.id === askId)!;
  const k = mine(s);
  const { me, w, t, nations } = k;
  k.h.asks = k.h.asks.filter((x) => x.id !== askId);
  let text: string;
  let fame = 0;
  if (mode === 'refuse') {
    addTension(w, a.from, me, 12);
    text = `${nm(a.from)}의 도움 요청을 거절했어요. 긴장 +12.`;
    if (relationOf(w, a.from, me) === '연합' && !isVassalPair(s, a.from, me) && k.rng.chance(SNUB_BREAK)) {
      const p = w.pairs[pairKey(a.from, me)];
      p.rel = '중립';
      p.tension = 40;
      text += ` 화가 난 ${ga(nm(a.from))} 우리와 맺은 연합을 깼어요!`;
    }
    event(w, t, `🙅 ${text}`, me, a.from);
    k.s = snsPush(live(k), k.rng, a.from, me, 'heg', 'snub');
    return { state: live(k), text };
  }
  if (mode === 'join') {
    declareWar(w, t, me, me, a.enemy!, `${eul(nm(a.from))} 도우려고`);
    text = `${nm(a.from)} 편에 서서 ${nm(a.enemy!)}에 선전포고했어요!`;
    fame = 8;
  } else if (mode === 'troops') {
    const v = Math.round(nations[me].troops * MY_HELP_TROOPS);
    nations[me] = { ...nations[me], troops: nations[me].troops - v };
    nations[a.from] = { ...nations[a.from], troops: nations[a.from].troops + v };
    text = `${nm(a.from)}에 병력 ${v.toLocaleString('ko-KR')}명을 보냈어요.`;
    fame = 5;
  } else {
    const v = Math.round(nations[me].treasury * MY_HELP_MONEY);
    nations[me] = { ...nations[me], treasury: nations[me].treasury - v };
    nations[a.from] = { ...nations[a.from], treasury: nations[a.from].treasury + v };
    text = `${nm(a.from)}에 전쟁 자금 ${v.toLocaleString('ko-KR')}을 보냈어요.`;
    fame = 4;
  }
  addTension(w, a.from, me, -20);
  text += ` 긴장 −20 · 명성 +${fame}.`;
  event(w, t, `🤝 ${text}`, me, a.from);
  k.s = snsPush(live(k), k.rng, a.from, me, 'ally', 'thanks', { E: nm(a.enemy!) });
  const ns = live(k);
  return { state: { ...ns, officer: { ...ns.officer, fame: Math.min(1000, (ns.officer.fame ?? 0) + fame) } }, text };
}

/** 우리가 도움을 청할 수 있는 나라(가능성 큰 순) */
export function myHelpCands(s: GameState): Array<{ id: string; enemy: string; chance: number }> {
  const me = s.player.countryId;
  const w = s.world;
  const foes = warsOf(w, me);
  if (!foes.length) return [];
  const enemy = [...foes].sort((a, b) => strengthScore(s, b) - strengthScore(s, a))[0];
  return COUNTRIES.map((c) => c.id)
    .filter((y) => y !== me && isAlive(w, y) && !foes.includes(y) && relationOf(w, y, enemy) !== '연합')
    .map((id) => ({ id, enemy, chance: helpChance(w, id, me, enemy) }))
    .sort((a, b) => b.chance - a.chance);
}
export function canAskHelp(s: GameState, id: string): string | null {
  const c = myHelpCands(s).find((x) => x.id === id);
  if (!c) return '전쟁 중일 때, 적과 연합이 아닌 나라에만';
  const cd = hegOf(s).myHelpCd?.[id] ?? 0;
  if (cd > s.worldMs) return `다시 청하기까지 ${Math.ceil((cd - s.worldMs) / 60e3)}분`;
  return null;
}
export function askHelp(s: GameState, id: string): { state: GameState; text: string } {
  if (canAskHelp(s, id)) return { state: s, text: '' };
  const c = myHelpCands(s).find((x) => x.id === id)!;
  const k = mine(s);
  k.h.myHelpCd![id] = k.t + MY_ASK_CD_HOURS * H;
  event(k.w, k.t, `🆘 우리가 ${nm(c.enemy)}에 맞서 ${nm(id)}에 도움을 청했어요.`, k.me, id);
  k.s = snsPush(live(k), k.rng, k.me, id, 'mine', 'ask', { E: nm(c.enemy) });
  const r = aiAnswerHelp(k, k.me, id, c.enemy);
  return { state: live(k), text: r.text.replace(/^\S+ /, '') };
}
