// 기자회견·국민 청원·정상회담(11-23 기획 ⑥⑦⑧).
// - 기자회견: 실제 6시간마다. 지금 나라 상황에 맞는 질문 3개 → 답 고르기 → 지지도·신뢰도·분야 점수·호감·정적
// - 국민 청원: 도시마다 요구(병원·도로·치안·학교·일자리)가 올라옴. 예산을 써서 들어주면 그 도시 민심↑, 하루 안에 안 들어주면 민심↓
// - 정상회담: 실제 하루 한 번. 나라와 의제를 골라 만남 → 성공하면 호감·의제 효과·명성, 실패하면 호감·지지도↓
import { COUNTRIES } from '../data/world';
import { CITIES } from '../data/cities';
import { addPresMod, approvalOf, type FieldId } from './approval';
import { cabinetOf, ministerOf, ministryPower } from './cabinet';
import { addFavorNote, civOf, favorOf } from './civ';
import { note, withOfficer } from './officer';
import { taxOf } from './policy';
import { influenceOf, roleOf } from './rivals';
import { Rng } from './rng';
import { budgetPerDay, type GameState } from './state';
import { isAlive, pairKey, relationOf } from './world';

const H = 3600e3;
const clamp = (v: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));
export const PRESS_GAP_MS = 6 * H;
export const PET_EVERY_MS = 4 * H;
export const PET_MAX = 3;
export const PET_LIFE_MS = 24 * H;
export const SUMMIT_GAP_MS = 24 * H;

/* ───────── 상태 ───────── */

export type PetKind = 'hospital' | 'road' | 'police' | 'school' | 'jobs';
export const PET_KINDS: Record<PetKind, { icon: string; name: string; text: string }> = {
  hospital: { icon: '🏥', name: '병원을 지어 주세요', text: '아픈 사람이 멀리까지 가야 해요' },
  road: { icon: '🛣️', name: '도로를 고쳐 주세요', text: '출퇴근길이 너무 막혀요' },
  police: { icon: '🚓', name: '치안을 강화해 주세요', text: '밤길이 무서워요' },
  school: { icon: '🏫', name: '학교를 늘려 주세요', text: '한 반에 학생이 너무 많아요' },
  jobs: { icon: '🧑‍🏭', name: '일자리를 만들어 주세요', text: '젊은이들이 도시를 떠나요' },
};
export interface Petition {
  id: number;
  city: string;
  kind: PetKind;
  cost: number;
  signs: number;
  endMs: number;
}
export interface MediaMod {
  field: FieldId;
  v: number;
  untilMs: number;
  why: string;
}
export interface MediaState {
  seed: number;
  nextId: number;
  /** 다음 기자회견을 열 수 있는 시각 */
  pressMs: number;
  /** 진행 중인 기자회견: 질문 3개와 지금 몇 번째 */
  press: { qs: QId[]; i: number; got: string[] } | null;
  petitions: Petition[];
  petMs: number;
  /** 청원 들어준 수 */
  petDone: number;
  summitMs: number;
  summits: number;
  mods: MediaMod[];
}
export function newMedia(s: Pick<GameState, 'worldMs' | 'world'>): MediaState {
  return { seed: (((s.world.seed ?? 1) * 13 + 5) >>> 0) || 1, nextId: 1, pressMs: s.worldMs, press: null, petitions: [], petMs: s.worldMs + 1 * H, petDone: 0, summitMs: s.worldMs, summits: 0, mods: [] };
}
export const mediaOf = (s: GameState): MediaState => s.media ?? newMedia(s);

export function mediaFieldRows(s: GameState, f: FieldId): Array<[string, number]> {
  const out: Array<[string, number]> = [];
  for (const m of s.media?.mods ?? []) if (m.field === f && m.untilMs > s.worldMs) out.push([m.why, m.v]);
  return out;
}
function addMod(m: MediaState, now: number, field: FieldId, v: number, hours: number, why: string) {
  m.mods = [...m.mods.filter((x) => x.untilMs > now), { field, v: Math.round(v * 10) / 10, untilMs: now + hours * H, why }].slice(-10);
}

/* ───────── 기자회견 ───────── */

const me = (s: GameState) => s.player.countryId;
/** 받침 있으면 '과', 없으면 '와' */
const wa = (w: string) => {
  const c = w.charCodeAt(w.length - 1) - 0xac00;
  return w + (c >= 0 && c <= 11171 && c % 28 ? '과' : '와');
};
const wars = (s: GameState) => COUNTRIES.filter((c) => c.id !== me(s) && isAlive(s.world, c.id) && relationOf(s.world, me(s), c.id) === '전쟁');
const coldest = (s: GameState) =>
  COUNTRIES.filter((c) => c.id !== me(s) && isAlive(s.world, c.id) && relationOf(s.world, me(s), c.id) !== '전쟁').sort((a, b) => favorOf(s, a.id) - favorOf(s, b.id))[0] ?? null;
const scandal = (s: GameState) => (s.cabinet ? cabinetOf(s).people.find((p) => (p.seat || p.post) && p.known && p.hidden === '비리 전력') ?? null : null);
const lowCity = (s: GameState) => {
  const civ = civOf(s);
  return CITIES.filter((c) => s.world.owner[c.id] === me(s) && civ.cities[c.id]).sort((a, b) => civ.cities[a.id].loyalty - civ.cities[b.id].loyalty)[0] ?? null;
};

/** 답 하나의 효과 */
export interface Answer {
  text: string;
  /** 결과 요약(화면) */
  sum: string;
  approval?: number;
  trust?: number;
  field?: [FieldId, number];
  favor?: number;
  rival?: number;
  fire?: boolean;
}
export type QId = 'war' | 'tax' | 'scandal' | 'opp' | 'cold' | 'city' | 'goal' | 'health' | 'vote' | 'economy';
interface Question {
  id: QId;
  when: (s: GameState) => boolean;
  ask: (s: GameState) => string;
  answers: (s: GameState) => Answer[];
}
export const QUESTIONS: Question[] = [
  {
    id: 'war',
    when: (s) => wars(s).length > 0,
    ask: (s) => `${wa(wars(s)[0]?.name ?? '적국')}의 전쟁, 언제 끝납니까?`,
    answers: () => [
      { text: '끝까지 싸워 이깁니다', sum: '안보 +5 · 외교 −3', field: ['defense', 5] },
      { text: '평화의 문은 열려 있습니다', sum: '외교 +4 · 신뢰도 +1', field: ['diplo', 4], trust: 1 },
      { text: '작전상 말씀드릴 수 없습니다', sum: '신뢰도 −1', trust: -1 },
    ],
  },
  {
    id: 'tax',
    when: (s) => taxOf(s) === 'high',
    ask: () => '세금이 너무 높다는 불만이 많습니다.',
    answers: () => [
      { text: '곧 세금을 낮추겠습니다', sum: '지지도 +4 · 신뢰도 −3(약속만)', approval: 4, trust: -3 },
      { text: '나라 살림을 위해 꼭 필요합니다', sum: '신뢰도 +2 · 지지도 −1', trust: 2, approval: -1 },
      { text: '불만은 일부일 뿐입니다', sum: '지지도 −3', approval: -3 },
    ],
  },
  {
    id: 'scandal',
    when: (s) => !!scandal(s),
    ask: (s) => `${scandal(s)?.name ?? '장관'} 장관의 비리 의혹, 어떻게 하실 겁니까?`,
    answers: () => [
      { text: '즉시 경질하겠습니다', sum: '지지도 +4 · 그 장관 물러남', approval: 4, fire: true },
      { text: '철저히 조사하겠습니다', sum: '신뢰도 +2', trust: 2 },
      { text: '근거 없는 의혹입니다', sum: '지지도 −4', approval: -4 },
    ],
  },
  {
    id: 'opp',
    when: (s) => s.officer.rivals.some((r, i) => roleOf(r, i) === '야당 대표' && !r.ally),
    ask: () => '야당 대표가 정부를 무능하다고 비판했습니다.',
    answers: () => [
      { text: '숫자로 반박하겠습니다', sum: '야당 영향력 −6 · 지지도 −1', rival: -6, approval: -1 },
      { text: '야당과 함께 풀겠습니다', sum: '신뢰도 +3', trust: 3 },
      { text: '대꾸할 가치도 없습니다', sum: '야당 영향력 +3', rival: 3 },
    ],
  },
  {
    id: 'cold',
    when: (s) => !!coldest(s) && favorOf(s, coldest(s)!.id) < 0,
    ask: (s) => `${wa(coldest(s)?.name ?? '이웃 나라')} 사이가 나빠지고 있습니다.`,
    answers: () => [
      { text: '대화로 풀겠습니다', sum: '그 나라 호감 +6', favor: 6 },
      { text: '도발하면 대가를 치를 것입니다', sum: '안보 +3 · 그 나라 호감 −5', field: ['defense', 3], favor: -5 },
      { text: '지켜보겠습니다', sum: '변화 없음' },
    ],
  },
  {
    id: 'city',
    when: (s) => !!lowCity(s) && civOf(s).cities[lowCity(s)!.id].loyalty < 50,
    ask: (s) => `${lowCity(s)?.name} 시민들의 불만이 큽니다.`,
    answers: () => [
      { text: '직접 찾아가겠습니다', sum: '사회 +4 · 지지도 +1', field: ['society', 4], approval: 1 },
      { text: '예산을 더 보내겠습니다', sum: '사회 +6 · 경제 −2', field: ['society', 6] },
      { text: '곧 나아질 것입니다', sum: '지지도 −2', approval: -2 },
    ],
  },
  {
    id: 'economy',
    when: () => true,
    ask: () => '물가가 올라 서민들이 힘들어합니다.',
    answers: () => [
      { text: '물가 안정 대책을 내놓겠습니다', sum: '경제 +4 · 지지도 +1', field: ['economy', 4], approval: 1 },
      { text: '세계 경제 탓입니다', sum: '신뢰도 −2', trust: -2 },
      { text: '기업과 함께 해결하겠습니다', sum: '경제 +3', field: ['economy', 3] },
    ],
  },
  {
    id: 'goal',
    when: () => true,
    ask: () => '올해 국정 목표가 무엇입니까?',
    answers: () => [
      { text: '튼튼한 안보', sum: '안보 +5', field: ['defense', 5] },
      { text: '살아나는 경제', sum: '경제 +5', field: ['economy', 5] },
      { text: '따뜻한 복지', sum: '사회 +5', field: ['society', 5] },
    ],
  },
  {
    id: 'health',
    when: () => true,
    ask: () => '대통령 건강 이상설이 돌고 있습니다.',
    answers: () => [
      { text: '(웃으며) 아침마다 뛰고 있습니다', sum: '지지도 +2', approval: 2 },
      { text: '진단서를 공개하겠습니다', sum: '신뢰도 +2', trust: 2 },
      { text: '사생활입니다', sum: '지지도 −1', approval: -1 },
    ],
  },
  {
    id: 'vote',
    when: (s) => approvalOf(s) < 50,
    ask: () => '재신임 투표가 걱정되지 않습니까?',
    answers: () => [
      { text: '국민을 믿습니다', sum: '지지도 +2', approval: 2 },
      { text: '성과로 보여 드리겠습니다', sum: '신뢰도 +2', trust: 2 },
      { text: '여론조사는 틀립니다', sum: '지지도 −2', approval: -2 },
    ],
  },
];
export const questionById = (id: QId) => QUESTIONS.find((q) => q.id === id)!;

export function canPress(s: GameState): string | null {
  const m = mediaOf(s);
  if (m.press) return null;
  if (s.worldMs < m.pressMs) return '다음 기자회견을 기다려요';
  return null;
}
/** 기자회견 열기: 상황에 맞는 질문 우선 3개 */
export function startPress(s: GameState): GameState {
  const m = structuredClone(mediaOf(s));
  if (m.press || s.worldMs < m.pressMs) return s;
  const rng = new Rng(m.seed);
  const hot = QUESTIONS.filter((q) => !['economy', 'goal', 'health'].includes(q.id) && q.when(s)).map((q) => q.id);
  const calm: QId[] = ['economy', 'goal', 'health'];
  const pick: QId[] = [];
  while (pick.length < 3 && hot.length) pick.push(hot.splice(Math.floor(rng.next() * hot.length), 1)[0]);
  while (pick.length < 3 && calm.length) pick.push(calm.splice(Math.floor(rng.next() * calm.length), 1)[0]);
  m.seed = rng.seed;
  m.press = { qs: pick, i: 0, got: [] };
  return { ...s, media: m };
}
/** 정치 스탯 배율(좋은 효과만 키움) */
export const pressMult = (s: GameState) => Math.max(0.8, Math.min(1.6, 0.75 + (s.officer.stats['정치'] ?? 8) / 40)) + ministryPower(s, 'kocis') * 0.1;

export function answerPress(s: GameState, n: number): GameState {
  const m0 = mediaOf(s);
  if (!m0.press) return s;
  const q = questionById(m0.press.qs[m0.press.i]);
  const a = q.answers(s)[n];
  if (!a) return s;
  const k = pressMult(s);
  const up = (v: number) => (v > 0 ? v * k : v);
  let ns: GameState = s;
  if (a.approval) ns = addPresMod(ns, '🎙️ 기자회견', up(a.approval), 24);
  if (a.trust) ns = withOfficer(ns, (o) => void (o.trust = clamp(o.trust + up(a.trust!))));
  if (a.rival)
    ns = withOfficer(ns, (o) =>
      o.rivals.forEach((r, i) => {
        if (roleOf(r, i) === '야당 대표' && !r.ally) r.influence = clamp(influenceOf(r) + a.rival!);
      }),
    );
  if (a.favor) {
    const c = coldest(s);
    if (c) ns = addFavorNote(ns, c.id, '🎙️ 기자회견 발언', Math.round(up(a.favor)));
  }
  if (a.fire && s.cabinet) {
    const p = scandal(s);
    if (p) {
      const cab = structuredClone(cabinetOf(ns));
      const x = cab.people.find((y) => y.id === p.id);
      if (x) {
        x.seat = null;
        x.post = undefined;
      }
      ns = { ...ns, cabinet: cab };
    }
  }
  const m = structuredClone(mediaOf(ns));
  if (a.field) addMod(m, s.worldMs, a.field[0], up(a.field[1]), 24, '🎙️ 기자회견');
  const press = m.press!;
  press.got = [...press.got, `${a.text} → ${a.sum}`];
  press.i++;
  if (press.i >= press.qs.length) {
    m.press = null;
    m.pressMs = s.worldMs + PRESS_GAP_MS;
    ns = { ...ns, media: m, world: { ...ns.world, events: [...ns.world.events] } };
    note(ns, `🎙️ 기자회견을 마쳤어요. ${press.got.map((g) => g.split(' → ')[1]).join(' / ')}`);
    return ns;
  }
  return { ...ns, media: m };
}
/** 마지막으로 끝낸 회견 결과를 보여 주려고 따로 남기지 않고, 화면이 답한 뒤 바로 결과 글을 받음 */
export function pressAnswerText(s: GameState, n: number): string {
  const m = mediaOf(s);
  if (!m.press) return '';
  const a = questionById(m.press.qs[m.press.i]).answers(s)[n];
  return a ? `"${a.text}" → ${a.sum}` : '';
}

/* ───────── 국민 청원 ───────── */

export function canGrant(s: GameState, id: number): string | null {
  const p = mediaOf(s).petitions.find((x) => x.id === id);
  if (!p) return '없는 청원';
  if ((s.nations[me(s)]?.treasury ?? 0) < p.cost) return '국방예산이 모자라요';
  return null;
}
export function grantPetition(s: GameState, id: number): GameState {
  if (canGrant(s, id)) return s;
  const m = structuredClone(mediaOf(s));
  const p = m.petitions.find((x) => x.id === id)!;
  m.petitions = m.petitions.filter((x) => x.id !== id);
  m.petDone++;
  addMod(m, s.worldMs, 'society', 2, 12, '📝 청원 들어줌');
  const civ = structuredClone(civOf(s));
  if (civ.cities[p.city]) civ.cities[p.city].loyalty = clamp(civ.cities[p.city].loyalty + 12);
  const city = CITIES.find((c) => c.id === p.city);
  const ns: GameState = {
    ...s,
    civ,
    media: m,
    nations: { ...s.nations, [me(s)]: { ...s.nations[me(s)], treasury: s.nations[me(s)].treasury - p.cost } },
    world: { ...s.world, events: [...s.world.events] },
  };
  note(ns, `📝 ${city?.name ?? ''} 청원 "${PET_KINDS[p.kind].name}"을(를) 들어줬어요. 민심 +12`);
  return addPresMod(ns, '📝 국민 청원 응답', 1, 12);
}

/* ───────── 정상회담 ───────── */

export type Agenda = 'trade' | 'security' | 'culture' | 'peace';
export const AGENDAS: Record<Agenda, { icon: string; name: string; text: string }> = {
  trade: { icon: '🚢', name: '무역', text: '성공하면 금고 +반나절 수입 · 경제 +4' },
  security: { icon: '🛡️', name: '안보', text: '성공하면 긴장 −20 · 안보 +4' },
  culture: { icon: '🎭', name: '문화 교류', text: '성공하면 지지도 +3(하루)' },
  peace: { icon: '🕊️', name: '평화 선언', text: '성공하면 외교 +6(하루) · 호감 더 +4' },
};
export function summitTargets(s: GameState) {
  return COUNTRIES.filter((c) => c.id !== me(s) && isAlive(s.world, c.id) && relationOf(s.world, me(s), c.id) !== '전쟁');
}
export function summitChance(s: GameState, id: string): number {
  const v = 0.4 + favorOf(s, id) / 200 + (s.officer.stats['정치'] ?? 8) / 100 + ministryPower(s, 'mofa') * 0.1 + (ministerOf(cabinetOf(s), 'mofa') ? 0.03 : 0);
  return Math.max(0.15, Math.min(0.92, v));
}
export function canSummit(s: GameState, id: string): string | null {
  if (s.worldMs < mediaOf(s).summitMs) return '정상회담은 하루 한 번이에요';
  if (!summitTargets(s).some((c) => c.id === id)) return '전쟁 중인 나라와는 만날 수 없어요';
  return null;
}
export function holdSummit(s: GameState, id: string, ag: Agenda): { state: GameState; text: string } {
  if (canSummit(s, id)) return { state: s, text: '' };
  const m = structuredClone(mediaOf(s));
  const rng = new Rng(m.seed);
  const ok = rng.chance(summitChance(s, id));
  m.seed = rng.seed;
  m.summitMs = s.worldMs + SUMMIT_GAP_MS;
  const name = COUNTRIES.find((c) => c.id === id)!.name;
  let ns: GameState = { ...s, media: m };
  let text: string;
  if (ok) {
    m.summits++;
    ns = addFavorNote(ns, id, `🤝 정상회담(${AGENDAS[ag].name})`, ag === 'peace' ? 16 : 12);
    ns = { ...ns, officer: { ...ns.officer, fame: ns.officer.fame + 20 } };
    let extra = '';
    if (ag === 'trade') {
      const got = Math.round(budgetPerDay(s, me(s)) * 0.5);
      ns = { ...ns, nations: { ...ns.nations, [me(s)]: { ...ns.nations[me(s)], treasury: ns.nations[me(s)].treasury + got } } };
      addMod(m, s.worldMs, 'economy', 4, 24, '🤝 정상회담');
      extra = `금고 +${got.toLocaleString('ko-KR')} · 경제 +4`;
    } else if (ag === 'security') {
      const key = pairKey(me(s), id);
      const pair = ns.world.pairs[key];
      if (pair) ns = { ...ns, world: { ...ns.world, pairs: { ...ns.world.pairs, [key]: { ...pair, tension: Math.max(0, pair.tension - 20) } } } };
      addMod(m, s.worldMs, 'defense', 4, 24, '🤝 정상회담');
      extra = '긴장 −20 · 안보 +4';
    } else if (ag === 'culture') {
      ns = addPresMod(ns, '🎭 문화 정상회담', 3, 24);
      extra = '지지도 +3';
    } else {
      addMod(m, s.worldMs, 'diplo', 6, 24, '🤝 정상회담');
      extra = '외교 +6';
    }
    ns = { ...ns, media: m };
    text = `🤝 ${name} 정상회담 성공! 호감 +${ag === 'peace' ? 16 : 12} · 명성 +20 · ${extra}`;
  } else {
    ns = addFavorNote(ns, id, '😶 정상회담 결렬', -4);
    ns = addPresMod({ ...ns, media: m }, '😶 정상회담 결렬', -2, 12);
    text = `😶 ${name} 정상회담이 결렬됐어요. 호감 −4 · 지지도 −2(12시간)`;
  }
  ns = { ...ns, world: { ...ns.world, events: [...ns.world.events] } };
  note(ns, text);
  return { state: ns, text };
}

/* ───────── 시간 흐름 ───────── */

export function mediaTick(s: GameState): GameState {
  const m = structuredClone(mediaOf(s));
  const rng = new Rng(m.seed);
  let ns: GameState = { ...s, media: m };
  const notes: string[] = [];
  // 시간이 지난 청원: 민심 −4
  const expired = m.petitions.filter((p) => p.endMs <= s.worldMs);
  if (expired.length) {
    const civ = structuredClone(civOf(ns));
    for (const p of expired) {
      if (civ.cities[p.city]) civ.cities[p.city].loyalty = clamp(civ.cities[p.city].loyalty - 4);
      notes.push(`📝 ${CITIES.find((c) => c.id === p.city)?.name ?? ''} 청원 "${PET_KINDS[p.kind].name}"이(가) 응답 없이 끝났어요. 민심 −4`);
    }
    m.petitions = m.petitions.filter((p) => p.endMs > s.worldMs);
    ns = { ...ns, civ };
  }
  // 새 청원
  while (s.worldMs >= m.petMs) {
    m.petMs += PET_EVERY_MS;
    if (m.petitions.length >= PET_MAX) continue;
    const civ = civOf(ns);
    const mine = CITIES.filter((c) => s.world.owner[c.id] === me(s) && civ.cities[c.id] && !m.petitions.some((p) => p.city === c.id));
    if (!mine.length) continue;
    // 민심 낮은 도시일수록 청원이 잘 올라옴
    const w = mine.map((c) => 110 - civ.cities[c.id].loyalty);
    let r = rng.next() * w.reduce((a, b) => a + b, 0);
    let city = mine[0];
    for (let i = 0; i < mine.length; i++) {
      r -= w[i];
      if (r <= 0) {
        city = mine[i];
        break;
      }
    }
    const kinds = Object.keys(PET_KINDS) as PetKind[];
    const kind = kinds[Math.floor(rng.next() * kinds.length)];
    const cost = Math.round((budgetPerDay(s, me(s)) * (0.3 + rng.next() * 0.3)) / 10) * 10;
    m.petitions.push({ id: m.nextId++, city: city.id, kind, cost, signs: Math.round(20 + rng.next() * 180) * 1000, endMs: m.petMs - PET_EVERY_MS + PET_LIFE_MS });
    notes.push(`📝 새 국민 청원: ${city.name} "${PET_KINDS[kind].name}"`);
  }
  m.mods = m.mods.filter((x) => x.untilMs > s.worldMs);
  m.seed = rng.seed;
  ns = { ...ns, media: m };
  if (notes.length) {
    ns = { ...ns, world: { ...ns.world, events: [...ns.world.events] } };
    for (const t of notes) note(ns, t);
  }
  return ns;
}
