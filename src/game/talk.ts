// 대화: 지도자·사절·부관·시민이 말을 걸고, 내가 고른 대답에 따라 세계 흐름이 바뀐다.
// 태도 5가지(화해·거래·위협·속임·원칙). 스탯이 선택지를 열고 성공 확률을 올린다(훈련 → 스탯 → 대화).
import { LEADERS } from '../data/leaders';
import { COUNTRIES, countryById, type Relation } from '../data/world';
import type { StatId } from '../data/officers';
import { REAL_MS_PER_GAME_DAY } from './balance';
import { Rng } from './rng';
import type { GameState } from './state';
import type { OfficerState } from './officer';
import { addFavorNote, eureka, onPlayerWar } from './civ';
import { gwa, isAlive, isRival, pairKey, relationOf, type WorldEvent, type WorldState } from './world';

const H = REAL_MS_PER_GAME_DAY; // 실제 1시간
/** 답할 수 있는 시간: 실제 6시간 */
export const TALK_TTL_MS = 6 * H;
/** 동시에 쌓이는 대화 수 */
export const TALK_MAX = 3;
/** 다음 대화까지 실제 3~6시간 */
const TALK_GAP: [number, number] = [3 * H, 6 * H];
/** 불가침 약속 기간: 실제 3일 */
export const PROMISE_MS = 72 * H;

export type Attitude = '화해' | '거래' | '위협' | '속임' | '원칙';
export const ATTITUDE_ICON: Record<Attitude, string> = { 화해: '🕊️', 거래: '🤝', 위협: '⚔️', 속임: '🎭', 원칙: '⚖️' };

export interface TalkEffect {
  text: string;
  /** 상대 나라(없으면 대화 상대) */
  with?: string;
  tension?: number;
  rel?: Relation;
  weariness?: number;
  trust?: number;
  fame?: number;
  merit?: number;
  intel?: number;
  /** 내 나라 국방예산 비율(−0.05 = 5% 냄) */
  treasury?: number;
  /** 내 나라 병력 비율 */
  troops?: number;
  /** 불가침 약속 */
  promise?: boolean;
}

export interface TalkChoice {
  att: Attitude;
  label: string;
  /** 이 스탯이 need 이상이어야 고를 수 있음 */
  stat?: StatId;
  need?: number;
  /** 성공 확률 바탕(1이면 반드시) */
  base: number;
  ok: TalkEffect;
  fail?: TalkEffect;
}

export interface Talk {
  id: number;
  kind: string;
  /** 대화 상대 나라 */
  who: string;
  speaker: string;
  icon: string;
  /** 인물 사진 파일 이름(src/assets/portraits). 없으면 icon */
  face?: string;
  text: string;
  choices: TalkChoice[];
  untilMs: number;
  /** 답하지 않고 시간이 지나면 */
  ignore: TalkEffect;
}

export interface Promise_ {
  who: string;
  untilMs: number;
}

/* ───────── 세계 흐름 ───────── */

/** 0~100: 맞수 사이 긴장과 전쟁 수로 세계 분위기를 잼 */
export function worldMood(w: WorldState): number {
  const ps = Object.entries(w.pairs).filter(([k]) => {
    const [a, b] = k.split('|');
    return isAlive(w, a) && isAlive(w, b);
  });
  if (!ps.length) return 0;
  const wars = ps.filter(([, p]) => p.rel === '전쟁').length;
  const rivals = ps.filter(([k, p]) => p.rel !== '전쟁' && p.rel !== '연합' && isRival(...(k.split('|') as [string, string])));
  const avg = rivals.length ? rivals.reduce((x, [, p]) => x + p.tension, 0) / rivals.length : 0;
  return Math.round(Math.min(100, avg * 0.6 + wars * 6));
}

export function moodName(m: number): { name: string; icon: string; text: string } {
  if (m < 30) return { name: '평화 개척', icon: '🌅', text: '나라들이 섬을 개척하며 평화롭게 지내요' };
  if (m < 60) return { name: '냉전', icon: '🧊', text: '자원과 항로를 두고 서로 노려봐요' };
  if (m < 80) return { name: '국지전', icon: '🔥', text: '곳곳에서 싸움이 일어나요' };
  return { name: '대전쟁', icon: '💥', text: '군도 전체가 전쟁에 휩싸였어요' };
}

/* ───────── 확률·표시 ───────── */

export function choiceLocked(o: OfficerState, c: TalkChoice): string | null {
  if (!c.stat || !c.need) return null;
  return o.stats[c.stat] >= c.need ? null : `${c.stat} ${c.need} 필요`;
}

/** 성공 확률: 바탕 + 스탯이 기준을 넘는 만큼 + 정치 조금 */
export function choiceChance(s: GameState, c: TalkChoice): number {
  if (c.base >= 1) return 1;
  const o = s.officer;
  const stat = c.stat ? o.stats[c.stat] - (c.need ?? 10) : 0;
  return Math.max(0.05, Math.min(0.95, c.base + stat * 0.02 + (o.stats['정치'] - 10) * 0.005 + s.player.rankIndex * 0.01));
}

export function effectHint(e: TalkEffect): string {
  const out: string[] = [];
  const sg = (n: number) => (n > 0 ? `+${n}` : `${n}`);
  if (e.rel) out.push(e.rel === '전쟁' ? '⚔️ 전쟁' : e.rel === '휴전' ? '🏳️ 휴전' : e.rel === '연합' ? '🤝 연합' : '중립');
  if (e.tension) out.push(`긴장 ${sg(e.tension)}`);
  if (e.weariness) out.push(`상대 피로 ${sg(e.weariness)}`);
  if (e.promise) out.push('📜 불가침 약속');
  if (e.trust) out.push(`신뢰 ${sg(e.trust)}`);
  if (e.fame) out.push(`명성 ${sg(e.fame)}`);
  if (e.merit) out.push(`공훈 ${sg(e.merit)}`);
  if (e.intel) out.push(`정보 ${sg(e.intel)}`);
  if (e.treasury) out.push(`국방예산 ${sg(Math.round(e.treasury * 100))}%`);
  if (e.troops) out.push(`병력 ${sg(Math.round(e.troops * 100))}%`);
  return out.join(' · ');
}

/* ───────── 대화 만들기 ───────── */

const nm = (id: string) => countryById(id).name;
const leader = (id: string) => `${LEADERS[id].title} ${LEADERS[id].name}`;

type Maker = (s: GameState, rng: Rng) => Omit<Talk, 'id' | 'untilMs'> | null;

function others(s: GameState): string[] {
  const me = s.player.countryId;
  return COUNTRIES.map((c) => c.id).filter((id) => id !== me && isAlive(s.world, id));
}

function pairOf(s: GameState, id: string) {
  return s.world.pairs[pairKey(s.player.countryId, id)];
}

/** 스탯 기준: 계급이 오를수록 높아짐 */
const need = (s: GameState, extra = 0) => 10 + s.player.rankIndex * 3 + extra;

const MAKERS: Maker[] = [
  // 맞수 사절: 항로·개척 다툼
  (s, rng) => {
    const xs = others(s).filter((id) => {
      const p = pairOf(s, id);
      return (p.rel === '중립' || p.rel === '휴전') && isRival(s.player.countryId, id) && p.tension >= 30;
    });
    if (!xs.length) return null;
    const x = rng.pick(xs);
    const what = rng.pick(['새로 떠오른 섬', '남쪽 항로', '해저 자원 광구', '어장']);
    return {
      kind: '맞수 사절',
      who: x,
      speaker: leader(x),
      face: `leader-${x}`,
      icon: '🧑‍⚖️',
      text: `"${what}은 우리가 먼저 찾았소. 당신네 함대가 물러나지 않으면, 우리도 가만있지 않겠소."`,
      choices: [
        { att: '화해', label: '공동 개척을 제안한다', stat: '정치', need: need(s), base: 0.45, ok: { text: '공동 개척 협정을 맺었어요. 긴장이 크게 내려갔어요.', tension: -35, fame: 3 }, fail: { text: '제안이 거절됐어요.', tension: 5 } },
        { att: '거래', label: '예산을 조금 내주고 물러난다', base: 1, ok: { text: '보상을 주고 물러났어요. 일단 조용해졌어요.', tension: -25, treasury: -0.04, fame: -2 } },
        { att: '위협', label: '"한 척이라도 넘어오면 침몰시킨다"', stat: '통솔', need: need(s), base: 0.5, ok: { text: '상대가 기가 꺾여 물러났어요.', tension: -10, fame: 6, merit: 40 }, fail: { text: '상대가 맞불을 놓았어요. 긴장이 치솟았어요!', tension: 30, fame: 2 } },
        { att: '원칙', label: '"국제 해양 규약대로 하자"', base: 1, ok: { text: '규약대로 하자고 했어요. 상대는 불만이지만 지켜봐요.', tension: 5, trust: 3 } },
      ],
      ignore: { text: '사절이 답을 못 듣고 돌아갔어요.', tension: 8 },
    };
  },
  // 전쟁 중 적의 휴전 제의
  (s, rng) => {
    const xs = others(s).filter((id) => pairOf(s, id).rel === '전쟁');
    if (!xs.length) return null;
    const x = rng.pick(xs);
    return {
      kind: '휴전 제의',
      who: x,
      speaker: `${nm(x)} 특사`,
      face: 'envoy',
      icon: '🏳️',
      text: `"${leader(x)}께서 전하라 하셨소. 더 피를 흘릴 필요가 있겠소? 지금 멈추면 서로 살 수 있소."`,
      choices: [
        { att: '화해', label: '휴전을 받아들이자고 건의한다', base: 0.55, stat: '정치', need: need(s, -4), ok: { text: '지도자가 건의를 받아들여 휴전했어요.', rel: '휴전', tension: 20, fame: 4 }, fail: { text: '지도자가 건의를 물리쳤어요. 전쟁은 계속돼요.', trust: -2 } },
        { att: '거래', label: '빼앗긴 섬을 돌려주면 멈춘다', stat: '정치', need: need(s), base: 0.3, ok: { text: '배상금을 받고 휴전했어요!', rel: '휴전', tension: 15, treasury: 0.08, fame: 6 }, fail: { text: '상대가 조건을 거절했어요.', tension: 0 } },
        { att: '속임', label: '받아들이는 척하고 기습을 준비한다', stat: '은밀', need: need(s), base: 0.45, ok: { text: '적이 방심했어요. 적 사기가 크게 떨어졌어요.', weariness: 40, merit: 80, fame: -3 }, fail: { text: '속임수가 들통났어요! 적이 이를 갈아요.', weariness: -20, fame: -6, trust: -3 } },
        { att: '위협', label: '"항복 말고는 없다"', base: 1, ok: { text: '단호히 거절했어요. 병사들의 사기가 올랐어요.', troops: 0.03, merit: 40, weariness: -10 } },
      ],
      ignore: { text: '특사가 빈손으로 돌아갔어요.', weariness: 0 },
    };
  },
  // 연합국의 지원 요청
  (s, rng) => {
    const me = s.player.countryId;
    const asks: Array<[string, string]> = [];
    for (const y of others(s)) {
      if (relationOf(s.world, me, y) !== '연합') continue;
      for (const z of others(s)) if (z !== y && relationOf(s.world, y, z) === '전쟁' && relationOf(s.world, me, z) !== '전쟁' && relationOf(s.world, me, z) !== '연합') asks.push([y, z]);
    }
    if (!asks.length) return null;
    const [y, z] = rng.pick(asks);
    return {
      kind: '지원 요청',
      who: y,
      speaker: leader(y),
      face: `leader-${y}`,
      icon: '📨',
      text: `"${nm(z)}의 함대가 우리 섬을 노리고 있소. 동맹이라면 함께 싸워 주시오."`,
      choices: [
        { att: '원칙', label: '"동맹은 지킨다" 함께 참전', base: 1, ok: { text: `동맹을 지켜 ${nm(z)}에 맞서 참전했어요!`, with: z, rel: '전쟁', trust: 5, fame: 6 } },
        { att: '거래', label: '병력 대신 물자를 보낸다', base: 1, ok: { text: '물자를 보냈어요. 동맹은 고마워해요.', treasury: -0.05, trust: 1 } },
        { att: '화해', label: '두 나라 사이를 중재한다', stat: '정치', need: need(s, 2), base: 0.35, ok: { text: `중재에 성공! ${gwa(nm(y))} ${nm(z)} 사이 싸움이 누그러졌어요.`, with: z, tension: -20, fame: 8, merit: 60 }, fail: { text: '중재가 실패했어요. 동맹이 서운해해요.', fame: -2 } },
        { att: '속임', label: '돕는 척 시간만 끈다', base: 0.6, ok: { text: '그럭저럭 넘어갔어요.', fame: -1 }, fail: { text: '들통나서 동맹이 깨졌어요!', rel: '중립', tension: 30, trust: -5 } },
      ],
      ignore: { text: '답이 없자 동맹이 크게 실망했어요.', tension: 15 },
    };
  },
  // 맞수가 아닌 나라의 친선 사절
  (s, rng) => {
    const xs = others(s).filter((id) => {
      const p = pairOf(s, id);
      return p.rel === '중립' && !isRival(s.player.countryId, id) && p.tension < 40;
    });
    if (!xs.length) return null;
    const x = rng.pick(xs);
    return {
      kind: '친선 사절',
      who: x,
      speaker: leader(x),
      face: `leader-${x}`,
      icon: '🎁',
      text: `"새 바다에서 이웃끼리 다툴 필요가 없지요. 우리 ${nm(x)}과 더 가까워질 방법이 있을까요?"`,
      choices: [
        { att: '화해', label: '연합을 맺자고 제안한다', stat: '정치', need: need(s, 2), base: 0.3, ok: { text: `${gwa(nm(x))} 연합을 맺었어요!`, rel: '연합', tension: -20, fame: 6, trust: 3 }, fail: { text: '아직 이르다며 정중히 거절했어요.', tension: -5 } },
        { att: '원칙', label: '불가침 약속을 맺는다', base: 1, ok: { text: '서로 공격하지 않기로 약속했어요(실제 3일).', promise: true, tension: -25, trust: 2 } },
        { att: '거래', label: '항로를 열어 주고 통행료를 받는다', base: 1, ok: { text: '통행료 협정으로 예산이 들어왔어요.', treasury: 0.04, tension: -5 } },
      ],
      ignore: { text: '사절이 섭섭해하며 돌아갔어요.', tension: 3 },
    };
  },
  // 휴전선 사건
  (s, rng) => {
    const xs = others(s).filter((id) => pairOf(s, id).rel === '휴전' && pairOf(s, id).tension >= 40);
    if (!xs.length) return null;
    const x = rng.pick(xs);
    return {
      kind: '휴전선 사건',
      who: x,
      speaker: '해안 경비대장',
      face: 'coastguard',
      icon: '🚨',
      text: `"${nm(x)} 초계정이 휴전선을 넘어 총을 쐈습니다! 병사 둘이 다쳤습니다. 명령을 내려 주십시오."`,
      choices: [
        { att: '위협', label: '즉시 반격한다', base: 1, ok: { text: `반격했어요! ${nm(x)}과 다시 전쟁이에요.`, rel: '전쟁', merit: 60, fame: 4 } },
        { att: '원칙', label: '조사단을 보내 진실을 밝힌다', stat: '정보', need: need(s), base: 0.45, ok: { text: '상대의 실수로 밝혀졌어요. 사과를 받았어요.', tension: -25, intel: 15, fame: 4 }, fail: { text: '조사가 흐지부지됐어요.', tension: 10 } },
        { att: '화해', label: '조용히 덮고 넘어간다', base: 1, ok: { text: '덮고 넘어갔어요. 병사들은 불만이에요.', tension: -5, fame: -4 } },
        { att: '속임', label: '사건을 부풀려 상대를 몰아붙인다', stat: '은밀', need: need(s), base: 0.5, ok: { text: '여론이 우리 편이에요. 상대가 배상금을 냈어요.', treasury: 0.03, fame: 3, tension: 10 }, fail: { text: '조작이 들켰어요!', fame: -8, trust: -3, tension: 15 } },
      ],
      ignore: { text: '명령이 없어 경비대가 알아서 물러났어요.', tension: 10 },
    };
  },
  // 전쟁 반대 시위(내 나라가 전쟁 중)
  (s, rng) => {
    const xs = others(s).filter((id) => pairOf(s, id).rel === '전쟁');
    if (!xs.length) return null;
    const x = rng.pick(xs);
    return {
      kind: '시민',
      who: x,
      speaker: '개척민 대표',
      face: 'settler',
      icon: '📢',
      text: `"우린 섬을 일구러 왔지 싸우러 온 게 아닙니다! ${gwa(nm(x))}의 전쟁을 멈춰 주세요!"`,
      choices: [
        { att: '화해', label: '시위대와 대화하고 평화를 약속한다', stat: '정치', need: need(s, -2), base: 0.5, ok: { text: '시민들이 진정했어요. 평화를 바라는 목소리가 상대에게도 퍼졌어요.', fame: 6, weariness: 30 }, fail: { text: '말이 통하지 않았어요.', fame: -3 } },
        { att: '원칙', label: '"나라를 지키는 것이 먼저"라고 설득한다', base: 1, ok: { text: '일부가 자원 입대했어요.', troops: 0.02, fame: -2, trust: 2 } },
        { att: '위협', label: '시위대를 해산시킨다', base: 1, ok: { text: '해산시켰어요. 민심이 나빠졌어요.', fame: -8, trust: 3 } },
      ],
      ignore: { text: '시위가 커졌어요.', fame: -3 },
    };
  },
  // 평화 시: 개척민·부관 이야기(언제나 가능)
  (s, rng) => {
    const o = s.officer;
    const who = o.aides.length ? rng.pick(o.aides) : null;
    const aide = who ? `부관 ${who.name}` : '당직 부관';
    const xs = others(s).filter((id) => pairOf(s, id).rel !== '전쟁');
    const x = xs.length ? rng.pick(xs) : others(s)[0];
    if (!x) return null;
    return {
      kind: '부관',
      who: x,
      speaker: aide,
      face: who ? `aide-${who.name}` : 'aide',
      icon: '🧑‍✈️',
      text: `"${nm(x)} 쪽 개척선이 우리 앞바다에서 길을 잃었답니다. 어떻게 할까요?"`,
      choices: [
        { att: '화해', label: '구조해서 돌려보낸다', base: 1, ok: { text: '구조해서 돌려보냈어요. 상대가 고마워해요.', tension: -12, fame: 4 } },
        { att: '속임', label: '구조하며 정보를 캐낸다', stat: '정보', need: need(s, -2), base: 0.6, ok: { text: '항로 정보를 얻었어요.', intel: 25, tension: -4 }, fail: { text: '눈치챈 선원들이 항의했어요.', tension: 8, fame: -2 } },
        { att: '거래', label: '구조비를 받는다', base: 1, ok: { text: '구조비를 받았어요.', treasury: 0.02, tension: 3 } },
      ],
      ignore: { text: '개척선은 알아서 떠났어요.' },
    };
  },
];

/** 세계 상황에 맞는 대화 하나(없으면 null). 상황이 급한 것부터 더 자주 */
export function makeTalk(s: GameState, rng: Rng): Omit<Talk, 'id' | 'untilMs'> | null {
  const cands = MAKERS.map((m) => m(s, rng)).filter((t): t is Omit<Talk, 'id' | 'untilMs'> => !!t);
  const fresh = cands.filter((t) => !(s.officer.talks ?? []).some((x) => x.kind === t.kind));
  const list = fresh.length ? fresh : [];
  if (!list.length) return null;
  // 마지막(부관 잡담)은 다른 대화가 없을 때 주로
  const weighted = list.flatMap((t) => (t.kind === '부관' ? [t] : [t, t, t]));
  return rng.pick(weighted);
}

/** AI 판단마다(officerTick에서) 부름: 만료 처리 + 새 대화 */
export function talkTick(ns: GameState, o: OfficerState): void {
  const talks = o.talks ?? [];
  const keep: Talk[] = [];
  for (const t of talks) {
    if (ns.worldMs >= t.untilMs) {
      applyEffect(ns, o, t.who, t.ignore, `💬 ${t.speaker}: ${t.ignore.text}`);
    } else keep.push(t);
  }
  o.talks = keep;
  o.promises = (o.promises ?? []).filter((p) => p.untilMs > ns.worldMs);
  if (o.talkNextMs === undefined) o.talkNextMs = ns.worldMs + H; // 첫 대화는 실제 1시간 뒤
  if (ns.worldMs < o.talkNextMs || keep.length >= TALK_MAX || !isAlive(ns.world, ns.player.countryId)) return;
  const rng = new Rng((o.seed ^ Math.floor(ns.worldMs / 1000) ^ 0x7a1c) >>> 0);
  const t = makeTalk({ ...ns, officer: o }, rng);
  o.talkNextMs = ns.worldMs + rng.range(TALK_GAP[0], TALK_GAP[1]);
  if (!t) return;
  o.talks.push({ ...t, id: o.nextId++, untilMs: ns.worldMs + TALK_TTL_MS });
}

/** 시험용: 지금 바로 대화 하나 */
export function debugTalk(s: GameState): GameState {
  const o = structuredClone(s.officer);
  const rng = new Rng((o.seed ^ Math.floor(s.worldMs / 7) ^ (o.nextId * 977)) >>> 0);
  const keep = (o.talks ?? []).slice(-(TALK_MAX - 1));
  const t = makeTalk({ ...s, officer: { ...o, talks: keep } }, rng);
  if (!t) return s;
  o.talks = [...keep, { ...t, id: o.nextId++, untilMs: s.worldMs + TALK_TTL_MS }];
  return { ...s, officer: o };
}

/* ───────── 대답 ───────── */

function hasPromise(o: OfficerState, who: string, now: number) {
  return (o.promises ?? []).some((p) => p.who === who && p.untilMs > now);
}

/** 효과 적용(ns, o는 이미 복사본이고 ns.world의 pairs·events는 고쳐도 되는 것) */
function applyEffect(ns: GameState, o: OfficerState, who: string, e: TalkEffect, logText: string) {
  const me = ns.player.countryId;
  const target = e.with ?? who;
  const w = ns.world;
  if (target && target !== me && w.pairs[pairKey(me, target)]) {
    const k = pairKey(me, target);
    const p = { ...w.pairs[k] };
    if (e.tension) p.tension = Math.max(0, Math.min(99, p.tension + e.tension));
    if (e.weariness && p.rel === '전쟁') p.weariness = Math.max(0, p.weariness + e.weariness);
    if (e.rel && e.rel !== p.rel) {
      if (e.rel === '전쟁' && hasPromise(o, target, ns.worldMs)) {
        o.trust = Math.max(0, o.trust - 10);
        o.fame -= 10;
        o.promises = (o.promises ?? []).filter((x) => x.who !== target);
        logText += ` (불가침 약속을 깨서 신뢰 −10 · 명성 −10)`;
      }
      p.rel = e.rel;
      if (e.rel === '전쟁') {
        p.tension = 0;
        p.weariness = 0;
      } else if (e.rel === '휴전') {
        p.weariness = 0;
        p.tension = e.tension ?? 20;
      } else if (e.rel === '연합') p.tension = 0;
    }
    // 긴장이 한계(남은 99)에서 또 오르면 전쟁
    if (!e.rel && e.tension && e.tension > 0 && p.rel !== '전쟁' && p.rel !== '연합' && w.pairs[k].tension + e.tension >= 100) {
      p.rel = '전쟁';
      p.tension = 0;
      p.weariness = 0;
      logText += ` 긴장이 터져 ${gwa(countryById(target).name)} 전쟁이 났어요!`;
    }
    w.pairs[k] = p;
  }
  if (e.promise && target) o.promises = [...(o.promises ?? []).filter((x) => x.who !== target), { who: target, untilMs: ns.worldMs + PROMISE_MS }];
  if (e.trust) o.trust = Math.max(0, Math.min(100, o.trust + e.trust));
  if (e.fame) o.fame = Math.max(0, o.fame + e.fame);
  if (e.merit) {
    o.merit += e.merit;
    o.totalMerit += e.merit;
  }
  if (e.intel) o.intel += e.intel;
  if (e.treasury || e.troops) {
    const n = { ...ns.nations[me] };
    if (e.treasury) n.treasury = Math.max(0, n.treasury * (1 + e.treasury));
    if (e.troops) n.troops = Math.max(0, n.troops * (1 + e.troops));
    ns.nations = { ...ns.nations, [me]: n };
  }
  const ev: WorldEvent = { t: ns.worldMs, kind: '외교', text: logText, mine: true };
  w.events.unshift(ev);
  if (w.events.length > 150) w.events.length = 150;
}

/** 대화 태도 → 호감 [성공, 실패] */
const TALK_FAVOR: Record<Attitude, [number, number]> = { 화해: [10, 2], 거래: [6, -2], 위협: [-8, -12], 속임: [0, -15], 원칙: [5, 0] };

export function answerTalk(s: GameState, talkId: number, idx: number): { state: GameState; out: { ok: boolean; text: string; hint: string } | null } {
  const t = (s.officer.talks ?? []).find((x) => x.id === talkId);
  const c = t?.choices[idx];
  if (!t || !c || choiceLocked(s.officer, c)) return { state: s, out: null };
  const o: OfficerState = structuredClone(s.officer);
  const ns: GameState = { ...s, world: { ...s.world, pairs: { ...s.world.pairs }, events: [...s.world.events] } };
  const rng = new Rng((s.world.seed ^ talkId * 7919 ^ Math.floor(s.worldMs / 1000)) >>> 0);
  const ok = rng.chance(choiceChance(s, c));
  const e = ok ? c.ok : (c.fail ?? c.ok);
  o.talks = (o.talks ?? []).filter((x) => x.id !== talkId);
  const wasWar = (id: string) => relationOf(s.world, s.player.countryId, id) === '전쟁';
  const target = e.with ?? t.who;
  applyEffect(ns, o, t.who, e, `💬 ${ATTITUDE_ICON[c.att]} ${t.speaker}에게 "${c.label}" → ${e.text}`);
  ns.officer = o;
  let out: GameState = ns;
  // 호감 이유로 남김(대화 결과가 호감도에 쌓임)
  if (t.who && t.who !== s.player.countryId) {
    const v = TALK_FAVOR[c.att][ok ? 0 : 1];
    if (v) out = addFavorNote(out, t.who, `대화: ${c.att}${ok ? '' : '(실패)'}`, v);
  }
  if (target && e.rel === '전쟁' && !wasWar(target) && target !== s.player.countryId) out = onPlayerWar(s, out, target);
  if (ok) out = eureka(out, { kind: 'talk', att: c.att });
  return { state: out, out: { ok, text: e.text, hint: effectHint(e) } };
}

/** 지금 이 나라와 불가침 약속 중인지(선전포고 화면용) */
export function promiseWith(s: GameState, who: string): boolean {
  return hasPromise(s.officer, who, s.worldMs);
}
