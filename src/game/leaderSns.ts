// 정상 SNS(11-26 대장 지시: "각 정상들이 발언하는 횟수도 늘리고, 홈 화면 핸드폰 아이콘 → SNS 화면").
// 실제 15~30분마다(AI 판단 15분마다 확인) 외국 정상 한 명이 SNS에 글을 올려요. 가장 자주 하는 말은 숙적 헐뜯기(data/archRivals.ts).
// 헐뜯긴 나라 정상은 절반쯤 바로 맞받아쳐요. 우리 나라를 헐뜯으면 내가 '맞받아치기'(명성 +3·긴장 +4)나 '무시'를 골라요.
// 효과는 작아요: 헐뜯기 = 두 나라 긴장 +2(전쟁 중이면 없음), 맞받아치기 = 긴장 +1.
import { archRivalsOf, archWhy, isArchRival } from '../data/archRivals';
import { LEADERS } from '../data/leaders';
import { COUNTRIES, countryById } from '../data/world';
import { bumpApproval } from './approval';
import { addFavorNote, favorOf } from './civ';
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
  /** 내가 쓴 글의 말투(11-27) */
  tone?: MyTone;
}
export interface SnsState {
  nextMs: number;
  nextId: number;
  posts: SnsPost[];
  /** 마지막으로 핸드폰을 본 때 */
  seenMs: number;
  /** 내가 마지막으로 글을 쓴 때(11-27) */
  myLastMs?: number;
  /** 나라별로 내가 마지막으로 겨냥한 때(같은 나라에 자주 쓰면 효과가 줄어요) */
  myTo?: Record<string, number>;
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


// ── 내 글 쓰기(11-27 대장 지시: "SNS에 나도 다른 지도자에게 긍정적인 글, 부정적인 글 등을 작성할 수 있게") ──
// 말투 6가지. 겨냥한 나라 호감·긴장이 바뀌고, 그 나라의 숙적들은 반대로 움직여요(적의 적은 친구).
// 상대 정상은 말투에 따라 고맙다고 하거나 화를 내며 답글을 달고, 숙적 정상이 맞장구를 치기도 해요.
export type MyTone = 'praise' | 'cheer' | 'thanks' | 'criticize' | 'mock' | 'warn' | 'boast';
export interface ToneInfo {
  id: MyTone;
  icon: string;
  name: string;
  /** 긍정(호감 오름) / 부정(호감 내림) / 자랑(상대 없음) */
  side: 'good' | 'bad' | 'self';
  /** 겨냥한 나라 호감 */
  favor: number;
  /** 겨냥한 나라와 긴장(− 면 내려감) */
  tension: number;
  /** 그 나라 숙적들 호감(적의 적) */
  rivals: number;
  fame: number;
  /** 상대 정상이 답글 달 확률 */
  reply: number;
  hint: string;
}
export const TONES: ToneInfo[] = [
  { id: 'praise', icon: '👏', name: '칭찬', side: 'good', favor: 6, tension: -3, rivals: -2, fame: 1, reply: 0.6, hint: '호감 오르고 긴장 내려요' },
  { id: 'cheer', icon: '🤝', name: '응원·연대', side: 'good', favor: 8, tension: -2, rivals: -3, fame: 1, reply: 0.65, hint: '전쟁·위기 중인 나라에 쓰면 효과 2배' },
  { id: 'thanks', icon: '🙏', name: '감사', side: 'good', favor: 5, tension: -4, rivals: -1, fame: 0, reply: 0.7, hint: '연합국·협정 맺은 나라에 효과 2배' },
  { id: 'criticize', icon: '👎', name: '비판', side: 'bad', favor: -6, tension: 3, rivals: 3, fame: 2, reply: 0.55, hint: '숙적들이 좋아해요' },
  { id: 'mock', icon: '🤡', name: '조롱', side: 'bad', favor: -10, tension: 5, rivals: 4, fame: 3, reply: 0.8, hint: '명성 크게 오르지만 상대가 화나요' },
  { id: 'warn', icon: '⚠️', name: '경고', side: 'bad', favor: -4, tension: 7, rivals: 2, fame: 2, reply: 0.5, hint: '긴장이 크게 올라요(전쟁 각오)' },
  { id: 'boast', icon: '📣', name: '자랑', side: 'self', favor: 0, tension: 0, rivals: 0, fame: 2, reply: 0, hint: '우리 국민에게. 지지도 +1 · 명성 +2' },
];
export const toneById = (id: MyTone) => TONES.find((t) => t.id === id)!;
/** 글 사이 쉬는 시간 */
export const MY_COOLDOWN_MS = 5 * M;
/** 같은 나라에 이 시간 안에 또 쓰면 효과 절반 */
export const MY_SAME_MS = 60 * M;
export const MY_TEXT_MAX = 120;

const MY_TEXTS: Record<MyTone, string[]> = {
  praise: [
    '"{B}의 이번 결정, 정말 멋졌습니다. {BL}께 박수를 보냅니다."',
    '"{B} 경제가 잘 굴러가네요. 배울 점이 많습니다."',
    '"{BL}의 연설 감동적이었어요. {A:은} {B:을} 존중합니다."',
    '"{B} 국민 여러분, 여러분의 지도자는 훌륭합니다."',
    '"{B:과} 함께라면 더 좋은 세상을 만들 수 있다고 믿습니다."',
  ],
  cheer: [
    '"{B} 국민 여러분, 힘내세요. {A:이} 함께합니다."',
    '"어려운 때일수록 친구가 필요하죠. {BL}, 우리가 곁에 있습니다."',
    '"{B}의 용기에 경의를 표합니다. 끝까지 응원합니다."',
    '"{B:은} 혼자가 아닙니다. {A}의 마음이 함께해요."',
  ],
  thanks: [
    '"{BL}, 늘 도와줘서 고맙습니다. 이 우정 잊지 않겠습니다."',
    '"{B:과}의 협력 덕분에 우리 국민이 웃습니다. 감사합니다!"',
    '"어려울 때 손 내밀어 준 {B}, 고마워요."',
    '"{A:은} {B}의 친구라는 게 자랑스럽습니다."',
  ],
  criticize: [
    '"{B}의 이번 행동은 실망스럽습니다. 세계가 지켜보고 있어요."',
    '"{BL}, 약속을 지키세요. 말과 행동이 다르면 아무도 안 믿습니다."',
    '"{B:은} 자기 국민부터 챙기시죠. 남 탓은 그만."',
    '"{W}? {B:은} 억지를 멈춰야 합니다."',
    '"{B} 정부의 거짓말, 이제 지겹습니다."',
  ],
  mock: [
    '"{BL}의 연설, 졸려서 반도 못 들었네요. 😴"',
    '"{B}의 무기는 퍼레이드용이죠? 사진은 잘 나오더군요."',
    '"{B} 경제 그래프 봤어요? 미끄럼틀인 줄 알았습니다."',
    '"{B:은} 오늘도 우리를 따라 하네요. 따라 하려면 제대로 하세요."',
    '"{BL}, 지지율 바닥이던데 괜찮으세요? 😂"',
  ],
  warn: [
    '"{B}에 경고합니다. 선을 넘으면 대가를 치를 겁니다."',
    '"{BL}, 한 번만 더 도발하면 우리도 가만있지 않습니다."',
    '"{A} 군은 준비가 끝났습니다. {B:은} 똑똑히 기억하세요."',
    '"{W}, 이 문제에서 우리는 한 발짝도 물러서지 않습니다. {B}, 경고했습니다."',
  ],
  boast: [
    '"{A} 경제가 또 기록을 세웠습니다! 국민 여러분 덕분입니다."',
    '"오늘 새 공장 문을 열었습니다. {A}의 미래는 밝습니다."',
    '"{A} 군은 세계 최고입니다. 장병 여러분, 자랑스럽습니다."',
    '"{A:은} 누구의 허락도 받지 않습니다. 우리 길을 갑니다."',
    '"우리 과학자들이 또 해냈습니다. {A} 기술 만세!"',
  ],
};
const THANK_BACK = [
  '"@{B} 따뜻한 말 고마워요. {A:도} 같은 마음입니다."',
  '"@{B} 감사합니다! 우리의 우정은 계속됩니다."',
  '"@{B} 좋은 친구가 있어 든든하네요."',
  '"@{B} 고맙습니다. 곧 직접 만나 이야기하시죠."',
];
const COLD_BACK = [
  '"@{B} 칭찬은 고맙지만, 행동으로 보여 주시죠."',
  '"@{B} 말은 쉽죠. 지켜보겠습니다."',
];
const ANGRY_BACK = [
  '"@{B} 말조심하세요. {A:은} 잊지 않습니다."',
  '"@{B} 그 말, 그대로 돌려드립니다."',
  '"@{B} 웃기는 소리. 그쪽 걱정이나 하시죠."',
  '"@{B} 협박으로는 아무것도 얻지 못합니다."',
  '"@{B} {W}? 진실은 우리 편입니다."',
];
const CHIME = [
  '"@{B} 맞는 말입니다! 속이 다 시원하네요. 👍"',
  '"@{B} 100% 동의합니다. 세계가 알아야 해요."',
  '"@{B} 이제야 누가 바른말을 하네요."',
];
const SNEER = [
  '"@{B} 그런 나라를 칭찬하다니, 실망입니다."',
  '"@{B} 친구를 잘 고르세요. 후회할 겁니다."',
];

/** 글을 쓸 수 있는 나라(살아 있는 다른 나라) */
export const myTargets = (s: GameState): string[] => COUNTRIES.map((c) => c.id).filter((id) => id !== s.player.countryId && isAlive(s.world, id));

/** 남은 쉬는 시간(ms) */
export const myCooldown = (s: GameState): number => Math.max(0, (snsOf(s).myLastMs ?? -Infinity) + MY_COOLDOWN_MS - s.worldMs);

/** 추천 문구 하나(n번째) */
export function suggestText(s: GameState, tone: MyTone, to: string | undefined, n: number): string {
  const me = s.player.countryId;
  const v = vars(s, me, to);
  const all = MY_TEXTS[tone];
  const list = v.W && v.W !== '이 문제' ? all : all.filter((x) => !x.includes('{W}'));
  return fillSns(list[((n % list.length) + list.length) % list.length], v).replace(/^"|"$/g, '');
}

/** 효과 배수: 같은 나라 자주(×0.5), 응원은 위기 중 ×2, 감사는 연합 ×2, 전쟁 상대 칭찬은 ×0.3 */
function toneMult(s: GameState, tone: MyTone, to: string): number {
  const me = s.player.countryId;
  const w = s.world;
  let m = 1;
  const last = snsOf(s).myTo?.[to];
  if (last !== undefined && s.worldMs - last < MY_SAME_MS) m *= 0.5;
  const t = toneById(tone);
  if (tone === 'cheer' && myTargets(s).some((x) => x !== to && relationOf(w, to, x) === '전쟁')) m *= 2;
  if (tone === 'thanks' && relationOf(w, me, to) === '연합') m *= 2;
  if (t.side === 'good' && relationOf(w, me, to) === '전쟁') m *= 0.3;
  return m;
}

/** 쓰기 전에 보여 줄 효과 */
export function previewPost(s: GameState, tone: MyTone, to?: string): { favor: number; tension: number; rivals: number; rivalIds: string[]; fame: number; mult: number } {
  const t = toneById(tone);
  if (t.side === 'self' || !to) return { favor: 0, tension: 0, rivals: 0, rivalIds: [], fame: t.fame, mult: 1 };
  const mult = toneMult(s, tone, to);
  const rivalIds = archRivalsOf(to).filter((x) => x !== s.player.countryId && isAlive(s.world, x));
  return { favor: Math.round(t.favor * mult), tension: Math.round(t.tension * mult), rivals: Math.round(t.rivals * mult), rivalIds, fame: t.fame, mult };
}

function moveTension(s: GameState, a: string, b: string, v: number): GameState {
  if (v >= 0) return bumpTension(s, a, b, v);
  const k = pairKey(a, b);
  const p = s.world.pairs[k];
  if (!p || p.rel === '전쟁' || p.rel === '연합') return s;
  return { ...s, world: { ...s.world, pairs: { ...s.world.pairs, [k]: { ...p, tension: Math.max(0, p.tension + v) } } } };
}

/** 내 글 올리기. text가 비면 추천 문구. 결과 말풍선 글도 줌 */
export function writePost(s: GameState, tone: MyTone, to: string | undefined, text: string, replyTo?: number): { state: GameState; text: string } {
  if (s.ending) return { state: s, text: '' };
  const cd = myCooldown(s);
  if (cd > 0) return { state: s, text: `⏳ ${Math.ceil(cd / 60e3)}분 뒤에 또 쓸 수 있어요` };
  const t = toneById(tone);
  const me = s.player.countryId;
  if (t.side !== 'self' && (!to || !myTargets(s).includes(to))) return { state: s, text: '글을 보낼 나라를 골라 주세요' };
  if (t.side === 'self') to = undefined;
  const st = snsOf(s);
  const body = (text.trim() || suggestText(s, tone, to, st.nextId)).slice(0, MY_TEXT_MAX);
  const pv = previewPost(s, tone, to);
  const rng = new Rng((st.nextId * 2246822519 + s.world.seed * 7 + Math.floor(s.worldMs / M)) >>> 0);
  const fameNow = s.officer.fame ?? 0;
  const c0 = counts(rng, me, t.side === 'bad');
  const boost = 1 + fameNow / 400;
  let id = st.nextId;
  const mine: SnsPost = { id: id++, t: s.worldMs, from: me, to, kind: 'mine', tone, replyTo, text: `"${body}"`, likes: Math.round(c0.likes * boost), shares: Math.round(c0.shares * boost) };
  const posts: SnsPost[] = [mine];
  let ns: GameState = { ...s, officer: { ...s.officer, fame: Math.min(1000, fameNow + pv.fame) } };
  const out: string[] = [];
  if (pv.fame) out.push(`명성 +${pv.fame}`);
  if (t.side === 'self') {
    ns = bumpApproval(ns, 1);
    out.push('지지도 +1');
  } else if (to) {
    const nm = countryById(to).name;
    ns = addFavorNote(ns, to, t.side === 'good' ? '📱 SNS에서 좋은 말' : '📱 SNS에서 나쁜 말', pv.favor);
    ns = moveTension(ns, me, to, pv.tension);
    out.push(`${nm} 호감 ${pv.favor > 0 ? '+' : ''}${pv.favor}`);
    if (pv.tension) out.push(`긴장 ${pv.tension > 0 ? '+' : ''}${pv.tension}`);
    if (pv.rivals && pv.rivalIds.length) {
      for (const r of pv.rivalIds) ns = addFavorNote(ns, r, pv.rivals > 0 ? `📱 숙적 ${nm}${batchim(nm) ? '을' : '를'} 비판` : `📱 숙적 ${nm}${batchim(nm) ? '을' : '를'} 칭찬`, pv.rivals);
      out.push(`${pv.rivalIds.map((r) => countryById(r).name).join('·')} 호감 ${pv.rivals > 0 ? '+' : ''}${pv.rivals}`);
    }
    // 상대 정상 답글
    if (rng.chance(t.reply)) {
      const fav = favorOf(ns, to);
      const v = vars(ns, to, me);
      const list = t.side === 'bad' ? ANGRY_BACK : fav < -20 ? COLD_BACK : THANK_BACK;
      posts.push({ id: id++, t: s.worldMs, from: to, to: me, kind: t.side === 'bad' ? 'reply' : 'ally', replyTo: mine.id, text: pickText(rng, list, v), answered: t.side !== 'bad', ...counts(rng, to, true) });
      if (t.side === 'bad') ns = bumpTension(ns, me, to, 1);
    }
    // 숙적 정상이 맞장구(나쁜 말) 또는 비꼼(좋은 말)
    const r = pv.rivalIds.length ? rng.pick(pv.rivalIds) : undefined;
    if (r && rng.chance(t.side === 'bad' ? 0.45 : 0.25)) {
      const v = vars(ns, r, me);
      posts.push({ id: id++, t: s.worldMs, from: r, to: me, kind: t.side === 'bad' ? 'ally' : 'reply', replyTo: mine.id, text: pickText(rng, t.side === 'bad' ? CHIME : SNEER, v), answered: true, ...counts(rng, r, false) });
    }
  }
  const myTo = to ? { ...(st.myTo ?? {}), [to]: s.worldMs } : st.myTo;
  ns = { ...ns, sns: { ...st, nextId: id, myLastMs: s.worldMs, myTo, seenMs: s.worldMs, posts: [...posts.reverse(), ...st.posts].slice(0, SNS_MAX) } };
  return { state: ns, text: `${t.icon} 글을 올렸어요! ${out.join(' · ')}` };
}
