// 정상 SNS(11-26 대장 지시: "각 정상들이 발언하는 횟수도 늘리고, 홈 화면 핸드폰 아이콘 → SNS 화면").
// 실제 15~30분마다(AI 판단 15분마다 확인) 외국 정상 한 명이 SNS에 글을 올려요. 가장 자주 하는 말은 숙적 헐뜯기(data/archRivals.ts).
// 헐뜯긴 나라 정상은 절반쯤 바로 맞받아쳐요. 우리 나라를 헐뜯으면 내가 '맞받아치기'(명성 +3·긴장 +4)나 '무시'를 골라요.
// 효과는 작아요: 헐뜯기 = 두 나라 긴장 +2(전쟁 중이면 없음), 맞받아치기 = 긴장 +1.
import { archRivalsOf, archWhy, isArchRival } from '../data/archRivals';
import { LEADERS } from '../data/leaders';
import { COUNTRIES, countryById } from '../data/world';
import { tariffsBy } from './pressure';
import { Rng } from './rng';
import type { GameState } from './state';
import { isAlive, pairKey, relationOf } from './world';

const M = 60e3;
export const SNS_FIRST_MS = 2 * M;
export const SNS_MIN_MS = 10 * M;
export const SNS_MAX_MS = 20 * M;
/** 헐뜯긴 AI 정상이 맞받아칠 확률 */
export const SNS_REPLY_CHANCE = 0.5;
export const SNS_MAX = 60;
/** 헐뜯기 한 번에 오르는 긴장 */
export const SNS_DISS_TENSION = 2;
/** 내가 맞받아치면: 명성 +, 긴장 + */
export const SNS_COUNTER_FAME = 3;
export const SNS_COUNTER_TENSION = 4;

export type SnsKind = 'diss' | 'reply' | 'war' | 'tariff' | 'boast' | 'ally' | 'mine';
export interface SnsPost {
  id: number;
  t: number;
  /** 글쓴 나라(내 글이면 내 나라) */
  from: string;
  /** 겨냥한 나라 */
  to?: string;
  kind: SnsKind;
  text: string;
  likes: number;
  shares: number;
  /** 답글이면 원래 글 번호 */
  replyTo?: number;
  /** 내 나라를 겨냥한 글에 내가 이미 답했는가 */
  answered?: boolean;
}
export interface SnsState {
  nextMs: number;
  nextId: number;
  posts: SnsPost[];
  /** 마지막으로 핸드폰을 본 때 */
  seenMs: number;
}

export const snsOf = (s: GameState): SnsState => s.sns ?? { nextMs: s.worldMs + SNS_FIRST_MS, nextId: 1, posts: [], seenMs: s.worldMs };

/** 안 읽은 글 수(내 글 빼고) */
export const snsUnread = (s: GameState): number => snsOf(s).posts.filter((p) => p.t > snsOf(s).seenMs && p.kind !== 'mine').length;

// ── 글 만들기 ──
function batchim(w: string): boolean {
  const c = w.charCodeAt(w.length - 1);
  if (c < 0xac00 || c > 0xd7a3) return false;
  return (c - 0xac00) % 28 !== 0;
}
const JOSA: Record<string, [string, string]> = { 은: ['은', '는'], 이: ['이', '가'], 을: ['을', '를'], 과: ['과', '와'], 아: ['아', '야'] };
/** {A}=글쓴 나라, {B}=겨냥한 나라, {BL}=겨냥한 나라 정상 이름, {W}=앙숙인 까닭. {B:은}처럼 쓰면 조사를 붙여 줌 */
export function fillSns(text: string, v: Record<string, string>): string {
  return text.replace(/\{(\w+)(?::(.))?\}/g, (_, k: string, j?: string) => {
    const w = v[k] ?? '';
    if (!j) return w;
    const pair = JOSA[j];
    return pair ? w + (batchim(w) ? pair[0] : pair[1]) : w + j;
  });
}

const DISS = [
  '"{B:은} 늘 말뿐이죠. 우리 {A:은} 행동으로 보여 줍니다."',
  '"{BL}, 거울 좀 보세요. 그 나라 경제가 지금 어떤 꼴인지."',
  '"{B}산 물건? 안 사도 아무 문제 없습니다. 우리 것이 더 좋아요."',
  '"{B:이} 또 거짓 뉴스를 퍼뜨리고 있네요. 세계는 속지 않습니다."',
  '"{BL}의 외교는 사진 찍기가 전부입니다."',
  '"{B:은} 우리 상대가 안 됩니다. 숫자가 말해 주죠."',
  '"{B} 정부는 자기 국민부터 챙기세요. 남 걱정할 때가 아닙니다."',
  '"{W}? 역사가 누가 옳은지 말해 줄 겁니다. {B:은} 억지를 멈추세요."',
  '"{BL}, 협박은 우리에게 안 통합니다. 한 번 해 보시든가."',
  '"오늘도 {B:이} 우리를 흉내 냈네요. 따라 하려면 제대로 하세요."',
  '"{B}의 무기는 전시용입니다. 진짜 싸움은 못 해요."',
  '"{B} 지도부는 겁쟁이들입니다. 큰소리만 치고 뒤로 숨죠."',
  '"{W}, 이 일에서 우리는 한 발짝도 물러서지 않습니다. {B}, 똑똑히 들으세요."',
  '"{BL}의 연설, 졸려서 끝까지 못 들었습니다."',
  '"{B}에 투자하는 건 돈을 바다에 버리는 일입니다."',
  '"{B:과} 대화요? 먼저 사과부터 하라고 하세요."',
  '"{B:은} 지도를 다시 보세요. 그 땅은 처음부터 당신들 것이 아니었습니다."',
  '"{BL:은} 자기 나라 지지율이나 걱정하시죠. 바닥이던데요."',
  '"{B}의 제재? 오히려 고맙습니다. 우리 공장이 더 바빠졌어요."',
  '"세계 여러분, {B:이} 또 약속을 어겼습니다. 이게 처음이 아니에요."',
  '"{B} 선전 방송은 웃음거리입니다. 오늘도 크게 웃었네요."',
  '"우리 {A} 국민은 {B}의 위협에 절대 굴하지 않습니다."',
];
const REPLY = [
  '"@{B} 말이 많으시네요. 숫자로 이야기합시다."',
  '"@{B} 그쪽 걱정이나 하시죠. 우리 {A:은} 아주 잘 지냅니다."',
  '"@{B} 늘 하던 거짓말이군요. 이제 아무도 안 믿어요."',
  '"@{B} 협박하는 건 약하다는 증거입니다."',
  '"@{B} {W}에 대해 말할 자격이 없는 나라입니다."',
  '"@{B} 그 말, 그대로 돌려드립니다."',
  '"@{B} 답할 가치도 없지만, 한마디만 하죠. 꿈 깨세요."',
  '"@{B} 다음 정상회의에서 직접 얼굴 보고 말하시죠."',
  '"@{B} 우리 국민이 웃고 있습니다. 많이 웃고 있어요."',
];
const WAR = [
  '"{B} 전선이 무너지고 있습니다. 항복할 시간이 다가와요."',
  '"우리 군은 {B} 깊숙이 들어갈 준비가 됐습니다."',
  '"{BL}, 장병들 앞에서 거짓말 그만하세요. 지고 있잖아요."',
  '"{B:과}의 전쟁, 끝은 우리가 정합니다."',
  '"{B}의 미사일은 하나도 우리 하늘을 뚫지 못했습니다."',
  '"{B} 국민 여러분, 여러분 지도자가 이 전쟁을 시작했습니다."',
  '"오늘 밤 {B} 진지를 또 하나 부쉈습니다. 다음은 어디일까요?"',
];
const TARIFF = [
  '"{B}산 물건에 관세를 매겼습니다. 공정한 무역이 먼저입니다."',
  '"{B:이} 우리 시장을 우습게 봤죠. 관세 맛 좀 보세요."',
  '"관세를 풀어 달라고요? {B:이} 먼저 태도를 바꾸세요."',
  '"우리 일자리를 훔친 {B}, 이제 대가를 치를 차례입니다."',
  '"{B} 물건 대신 우리 물건을 쓰세요. 더 싸고 더 좋습니다."',
];
const BOAST = [
  '"{A} 경제가 또 기록을 세웠습니다! 우리 국민 덕분입니다."',
  '"새 항모·전투기가 곧 나옵니다. {A} 군은 더 강해집니다."',
  '"오늘 {A} 청년들과 이야기했습니다. 미래가 밝아요."',
  '"{A:은} 누구의 허락도 받지 않습니다. 우리 길을 갑니다."',
  '"지지해 주신 국민께 감사드립니다. {A:은} 하나입니다."',
  '"오늘 새 공장 문을 열었습니다. 일자리 1만 개!"',
  '"우리 과학자들이 해냈습니다. {A} 기술이 세계 최고입니다."',
];
const ALLY = [
  '"{B:과} 우리는 영원한 친구입니다. 함께라면 두렵지 않아요."',
  '"{BL}, 오늘 통화 즐거웠습니다. 우리의 동맹은 굳건합니다."',
  '"{B:과} 함께 훈련한 장병들, 자랑스럽습니다."',
  '"어려울 때 친구가 진짜 친구죠. 고마워요, {B}!"',
];

const leaderOf = (s: GameState, id: string) => (id === s.player.countryId ? s.player.name : (LEADERS[id]?.name ?? countryById(id).name));
function vars(s: GameState, from: string, to?: string): Record<string, string> {
  return { A: countryById(from).name, B: to ? countryById(to).name : '', BL: to ? leaderOf(s, to) : '', W: to ? archWhy(from, to) || '이 문제' : '' };
}
function counts(rng: Rng, from: string, big: boolean) {
  const eco = countryById(from).economy;
  const likes = Math.round(rng.range(0.4, 1.2) * eco * (big ? 900 : 400));
  return { likes, shares: Math.round(likes * rng.range(0.08, 0.3)) };
}
/** 문구 고르기(답글은 {W}가 빈 말이면 그 줄을 빼고) */
function pickText(rng: Rng, list: string[], v: Record<string, string>): string {
  const ok = v.W && v.W !== '이 문제' ? list : list.filter((x) => !x.includes('{W}'));
  return fillSns(rng.pick(ok.length ? ok : list), v);
}

/** 한 정상이 무엇을 쓸지 고르기 */
export function pickPost(s: GameState, rng: Rng): Omit<SnsPost, 'id' | 't'> | null {
  const me = s.player.countryId;
  const w = s.world;
  const alive = COUNTRIES.map((c) => c.id).filter((id) => isAlive(w, id));
  const ais = alive.filter((id) => id !== me);
  type Opt = { from: string; to?: string; kind: SnsKind; wt: number };
  const opts: Opt[] = [];
  for (const a of ais) {
    const per = w.personalities?.[a];
    const loud = per === '공격형' ? 1.5 : per === '기회주의' ? 1.2 : 1;
    for (const b of archRivalsOf(a).filter((x) => alive.includes(x))) opts.push({ from: a, to: b, kind: 'diss', wt: 5 * loud * (b === me ? 2.5 : 1) * (relationOf(w, a, b) === '연합' ? 0.4 : 1) });
    for (const b of alive) {
      if (b === a) continue;
      const rel = relationOf(w, a, b);
      if (rel === '전쟁') opts.push({ from: a, to: b, kind: 'war', wt: 2 * loud * (b === me ? 1.5 : 1) });
      if (rel === '연합') opts.push({ from: a, to: b, kind: 'ally', wt: 0.4 });
    }
    for (const t of tariffsBy(s, a)) if (alive.includes(t.to)) opts.push({ from: a, to: t.to, kind: 'tariff', wt: 1 * (t.to === me ? 1.5 : 1) });
    opts.push({ from: a, kind: 'boast', wt: 1.2 });
  }
  const o = rng.weighted(opts, (x) => x.wt);
  if (!o) return null;
  const v = vars(s, o.from, o.to);
  const list = o.kind === 'diss' ? DISS : o.kind === 'war' ? WAR : o.kind === 'tariff' ? TARIFF : o.kind === 'ally' ? ALLY : BOAST;
  return { from: o.from, to: o.to, kind: o.kind, text: pickText(rng, list, v), ...counts(rng, o.from, o.kind === 'diss' || o.kind === 'war') };
}

function bumpTension(s: GameState, a: string, b: string, v: number): GameState {
  const k = pairKey(a, b);
  const p = s.world.pairs[k];
  if (!p || p.rel === '전쟁' || p.rel === '연합') return s;
  return { ...s, world: { ...s.world, pairs: { ...s.world.pairs, [k]: { ...p, tension: Math.min(99, p.tension + v) } } } };
}

/** 시간이 흐를 때: 때가 되면 정상 한 명이 글을 올림(헐뜯긴 AI는 절반쯤 맞받아침) */
export function snsTick(s: GameState): GameState {
  if (s.ending) return s;
  const st = snsOf(s);
  if (s.worldMs < st.nextMs) return s.sns ? s : { ...s, sns: st };
  const rng = new Rng((Math.floor(st.nextMs / M) * 2654435761 + s.world.seed * 11 + 5) >>> 0);
  const nextMs = s.worldMs + rng.range(SNS_MIN_MS, SNS_MAX_MS);
  const got = pickPost(s, rng);
  if (!got) return { ...s, sns: { ...st, nextMs } };
  const posts: SnsPost[] = [];
  let id = st.nextId;
  let ns = s;
  const first: SnsPost = { ...got, id: id++, t: s.worldMs };
  posts.push(first);
  const hostile = got.kind === 'diss' || got.kind === 'war' || got.kind === 'tariff';
  if (hostile && got.to) {
    if (got.kind === 'diss') ns = bumpTension(ns, got.from, got.to, SNS_DISS_TENSION);
    // 헐뜯긴 AI 정상이 맞받아침
    if (got.to !== s.player.countryId && rng.chance(SNS_REPLY_CHANCE)) {
      const v = vars(s, got.to, got.from);
      posts.push({ id: id++, t: s.worldMs, from: got.to, to: got.from, kind: 'reply', replyTo: first.id, text: pickText(rng, REPLY, v), ...counts(rng, got.to, true) });
      ns = bumpTension(ns, got.from, got.to, 1);
    }
  }
  return { ...ns, sns: { ...st, nextMs, nextId: id, posts: [...posts.reverse(), ...st.posts].slice(0, SNS_MAX) } };
}

/** 핸드폰을 봤음 */
export function snsSeen(s: GameState): GameState {
  const st = snsOf(s);
  return { ...s, sns: { ...st, seenMs: s.worldMs } };
}

const MY_REPLY = [
  '"@{B} 우리 {A:은} 흔들리지 않습니다. 말조심하세요."',
  '"@{B} 그 말, 그대로 돌려드립니다. 우리 국민이 지켜보고 있어요."',
  '"@{B} 협박으로는 아무것도 얻지 못합니다."',
  '"@{B} 다음엔 숫자로 답해 드리죠. 기대하세요."',
  '"@{B} {W}? 진실은 우리 편입니다."',
];

/** 우리 나라를 겨냥한 글에 답하기: counter = 맞받아치기(명성 +3·긴장 +4), 아니면 무시 */
export function answerPost(s: GameState, postId: number, counter: boolean): { state: GameState; text: string } {
  const st = snsOf(s);
  const p = st.posts.find((x) => x.id === postId);
  const me = s.player.countryId;
  if (!p || p.to !== me || p.answered || p.kind === 'mine' || p.kind === 'ally' || p.kind === 'boast') return { state: s, text: '' };
  let posts = st.posts.map((x) => (x.id === postId ? { ...x, answered: true } : x));
  if (!counter) return { state: { ...s, sns: { ...st, posts } }, text: '못 본 척 넘어갔어요.' };
  const rng = new Rng((postId * 40503 + s.world.seed) >>> 0);
  const v = vars(s, me, p.from);
  const mine: SnsPost = { id: st.nextId, t: s.worldMs, from: me, to: p.from, kind: 'mine', replyTo: postId, text: pickText(rng, MY_REPLY, v), ...counts(rng, me, true) };
  posts = [mine, ...posts].slice(0, SNS_MAX);
  let ns: GameState = { ...s, sns: { ...st, nextId: st.nextId + 1, posts }, officer: { ...s.officer, fame: Math.min(1000, (s.officer.fame ?? 0) + SNS_COUNTER_FAME) } };
  ns = bumpTension(ns, me, p.from, SNS_COUNTER_TENSION);
  return { state: ns, text: `${countryById(p.from).name}에 맞받아쳤어요! 명성 +${SNS_COUNTER_FAME} · 긴장 +${SNS_COUNTER_TENSION}` };
}

/** 그 글이 숙적 사이 글인가(화면 꼬리표) */
export const isArchPost = (p: SnsPost) => !!p.to && isArchRival(p.from, p.to);
