// 기자회견·국민 청원·정상회담(11-23 기획 ⑥⑦⑧).
// - 기자회견: 실제 6시간마다. 나라 상황 질문 + 평소 질문 50여 개 중 7~10개(최근에 나온 질문은 피함) → 답 고르기 → 지지도·신뢰도·분야 점수·호감·정적
// - 국민 청원: 도시마다 요구(병원·도로·치안·학교·일자리)가 올라옴. 예산을 써서 들어주면 그 도시 민심↑, 하루 안에 안 들어주면 민심↓
// - 정상회담: 실제 하루 한 번. 나라와 의제를 골라 만남 → 성공하면 호감·의제 효과·명성, 실패하면 호감·지지도↓
import { COUNTRIES } from '../data/world';
import { CITIES } from '../data/cities';
import { addPresMod, approvalOf, presOf, type FieldId } from './approval';
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
  /** 진행 중인 기자회견: 질문 7~10개와 지금 몇 번째 */
  press: { qs: QId[]; i: number; got: string[] } | null;
  /** 최근 기자회견에 나온 질문(되풀이 줄이기) */
  recent?: QId[];
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
export type QId = string;
interface Question {
  id: QId;
  when: (s: GameState) => boolean;
  ask: (s: GameState) => string;
  answers: (s: GameState) => Answer[];
  /** 언제든 나오는 평소 질문 */
  calm?: boolean;
}
const BASE_QUESTIONS: Question[] = [
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

/* ───────── 11/28 대장 요청: 평소 질문 더 많이(매번 같은 질문이 나오지 않게) ───────── */

/** 짧게 적는 답: [말, 효과] — 효과 글은 자동으로 만듦 */
type Eff = Pick<Answer, 'approval' | 'trust' | 'field'>;
const FIELD_NAME: Record<FieldId, string> = { personal: '평판', defense: '안보', diplo: '외교', society: '사회', economy: '경제' };
const sgn = (v: number) => (v > 0 ? `+${v}` : `−${-v}`);
export function effSum(e: Eff): string {
  const out: string[] = [];
  if (e.field) out.push(`${FIELD_NAME[e.field[0]]} ${sgn(e.field[1])}`);
  if (e.approval) out.push(`지지도 ${sgn(e.approval)}`);
  if (e.trust) out.push(`신뢰도 ${sgn(e.trust)}`);
  return out.join(' · ') || '변화 없음';
}
const A = (text: string, e: Eff): Answer => ({ text, sum: effSum(e), ...e });
const F = (f: FieldId, v: number, more: Omit<Eff, 'field'> = {}): Eff => ({ field: [f, v], ...more });
/** 평소 질문 하나 */
const calm = (id: string, ask: string, answers: Answer[], when: (s: GameState) => boolean = () => true): Question => ({ id, when, ask: () => ask, answers: () => answers, calm: true });

export const CALM_QUESTIONS: Question[] = [
  // 경제
  calm('jobs', '청년 일자리가 부족하다는 목소리가 높습니다.', [A('청년 고용 기업에 세금을 깎겠습니다', F('economy', 3, { approval: 1 })), A('공공 일자리를 늘리겠습니다', F('society', 4)), A('시장이 알아서 풀 문제입니다', { approval: -2 })]),
  calm('house', '집값이 너무 올랐다는 불만이 큽니다.', [A('공공 주택을 대거 짓겠습니다', F('society', 4)), A('대출 규제를 풀겠습니다', F('economy', 3, { trust: -1 })), A('곧 안정될 것입니다', { approval: -2 })]),
  calm('export', '수출이 줄고 있다는 보도가 나왔습니다.', [A('직접 해외 세일즈에 나서겠습니다', F('economy', 4)), A('새 시장을 찾겠습니다', F('diplo', 3)), A('일시적인 현상입니다', { trust: -1 })]),
  calm('oil', '기름값이 크게 올랐습니다.', [A('유류세를 잠시 낮추겠습니다', { approval: 3, trust: -1 }), A('비축유를 풀겠습니다', F('economy', 3)), A('아껴 쓰자고 부탁드립니다', { approval: -1 })]),
  calm('startup', '새로 생기는 회사가 줄고 있습니다.', [A('창업 지원금을 두 배로 늘리겠습니다', F('economy', 4)), A('규제를 확 풀겠습니다', F('economy', 3, { trust: 1 })), A('대기업이 더 중요합니다', { approval: -2 })]),
  calm('farm', '농민들이 쌀값 폭락에 시위하고 있습니다.', [A('정부가 사들이겠습니다', F('society', 3, { approval: 1 })), A('수출길을 열겠습니다', F('economy', 3)), A('경쟁력을 키워야 합니다', { approval: -2 })]),
  calm('chip', '반도체 경쟁에서 뒤처진다는 우려가 있습니다.', [A('연구 단지를 새로 짓겠습니다', F('economy', 4)), A('인재를 키우겠습니다', F('society', 3)), A('아직 우리가 앞서 있습니다', { trust: -1 })]),
  calm('debt', '나랏빚이 너무 늘었다는 지적입니다.', [A('씀씀이를 줄이겠습니다', { trust: 3, approval: -1 }), A('성장으로 갚겠습니다', F('economy', 3)), A('빚도 투자입니다', { trust: -2 })]),
  calm('small', '골목 가게들이 문을 닫고 있습니다.', [A('소상공인 지원금을 풀겠습니다', F('society', 3, { approval: 1 })), A('전통시장 상품권을 늘리겠습니다', F('economy', 3)), A('시대의 흐름입니다', { approval: -3 })]),
  calm('coin', '가상화폐 투자 피해가 늘고 있습니다.', [A('투자자 보호법을 만들겠습니다', { trust: 2 }), A('새 산업으로 키우겠습니다', F('economy', 3)), A('투자는 본인 책임입니다', { approval: -2 })]),
  // 사회
  calm('birth', '아이를 낳는 집이 줄고 있습니다.', [A('육아 수당을 크게 올리겠습니다', F('society', 4, { approval: 1 })), A('집 걱정부터 덜어 드리겠습니다', F('society', 3)), A('개인의 선택입니다', { approval: -2 })]),
  calm('old', '노인 빈곤 문제가 심각합니다.', [A('기초 연금을 올리겠습니다', F('society', 4)), A('어르신 일자리를 만들겠습니다', F('economy', 2, { approval: 1 })), A('가족이 함께 돌봐야 합니다', { approval: -2 })]),
  calm('school', '사교육비 부담이 크다는 학부모가 많습니다.', [A('공교육을 확 바꾸겠습니다', F('society', 4)), A('방과후 수업을 무료로 하겠습니다', { approval: 2 }), A('교육열은 우리의 힘입니다', { trust: -1 })]),
  calm('hospital', '지방에 병원이 부족합니다.', [A('국립 병원을 짓겠습니다', F('society', 4)), A('원격 진료를 열겠습니다', F('economy', 2, { trust: 1 })), A('큰 도시로 가시면 됩니다', { approval: -3 })]),
  calm('crime', '흉악 범죄가 늘었다는 불안이 큽니다.', [A('경찰을 늘리겠습니다', F('society', 3, { approval: 1 })), A('처벌을 무겁게 하겠습니다', { approval: 2, trust: -1 }), A('통계로는 줄었습니다', { approval: -1 })]),
  calm('dust', '미세먼지가 너무 심합니다.', [A('공장 배출을 강하게 막겠습니다', F('society', 3, { trust: 1 })), A('이웃 나라와 함께 풀겠습니다', F('diplo', 3)), A('비가 오면 좋아집니다', { approval: -2 })]),
  calm('quake', '지진 대비가 부족하다는 지적입니다.', [A('건물 안전 점검을 하겠습니다', F('society', 3, { trust: 1 })), A('재난 훈련을 늘리겠습니다', F('defense', 2, { approval: 1 })), A('우리 땅은 안전합니다', { trust: -2 })]),
  calm('drug', '마약 사건이 잇따르고 있습니다.', [A('마약과의 전쟁을 선포합니다', F('society', 3, { approval: 1 })), A('치료 센터를 늘리겠습니다', F('society', 2, { trust: 1 })), A('일부의 일탈입니다', { trust: -2 })]),
  calm('sports', '국가대표팀이 큰 대회에서 우승했습니다!', [A('선수단을 청와대로 초대하겠습니다', { approval: 3 }), A('체육 예산을 늘리겠습니다', F('society', 3)), A('축하는 국민 몫입니다', F('personal', 2))]),
  calm('idol', '우리 가수가 세계 1위를 했습니다.', [A('문화 예산을 늘리겠습니다', F('personal', 3, { approval: 1 })), A('해외 공연을 돕겠습니다', F('diplo', 3)), A('잘 모르는 분야입니다', { approval: -1 })]),
  calm('strike', '큰 노조가 파업을 예고했습니다.', [A('직접 만나 이야기하겠습니다', F('society', 3, { trust: 1 })), A('법대로 하겠습니다', F('economy', 2, { approval: -1 })), A('불법 파업은 용서 없습니다', { approval: -2, trust: 1 })]),
  calm('ai', '인공지능이 일자리를 빼앗는다는 걱정이 있습니다.', [A('새 기술 교육을 무료로 하겠습니다', F('society', 3)), A('AI 산업을 키워 새 일자리를 만들겠습니다', F('economy', 4)), A('막을 수 없는 흐름입니다', { approval: -2 })]),
  // 안보·외교
  calm('spy', '외국 간첩이 잡혔다는 소식입니다.', [A('배후를 끝까지 밝히겠습니다', F('defense', 4)), A('외교 경로로 항의하겠습니다', F('diplo', 2, { trust: 1 })), A('조용히 처리하겠습니다', { trust: -1 })]),
  calm('cyber', '정부 전산망이 해킹당했습니다.', [A('사이버 부대를 늘리겠습니다', F('defense', 4)), A('피해를 숨김없이 밝히겠습니다', { trust: 3 }), A('큰 피해는 없습니다', { trust: -2 })]),
  calm('draft', '군 복무 기간을 줄여 달라는 요구가 있습니다.', [A('줄이고 첨단 무기로 채우겠습니다', { approval: 3, field: ['defense', -2] }), A('지금이 꼭 필요합니다', F('defense', 3, { approval: -1 })), A('급여를 올려 드리겠습니다', F('defense', 2, { approval: 1 }))]),
  calm('arms', '무기 수출이 늘었다는데 비판도 있습니다.', [A('우리 방산은 세계 최고입니다', F('economy', 3)), A('평화를 위한 나라에만 팝니다', F('diplo', 3)), A('비판은 받아들이겠습니다', { trust: 1 })]),
  calm('ally', '동맹국이 방위비를 더 내라고 합니다.', [A('당당히 협상하겠습니다', F('diplo', 3, { approval: 1 })), A('우리 힘으로 지키겠습니다', F('defense', 4)), A('요구를 들어주겠습니다', { approval: -3, field: ['diplo', 2] })]),
  calm('refugee', '난민을 받아야 하느냐는 논쟁이 뜨겁습니다.', [A('인도적으로 받겠습니다', F('diplo', 4, { approval: -1 })), A('엄격히 심사하겠습니다', { trust: 2 }), A('받지 않겠습니다', { approval: 1, field: ['diplo', -3] })]),
  calm('nuke', '핵무장을 해야 한다는 여론이 있습니다.', [A('모든 길을 열어 두겠습니다', F('defense', 4)), A('비핵화 원칙은 그대로입니다', F('diplo', 3)), A('지금 말할 때가 아닙니다', { trust: -1 })]),
  calm('space', '우리 위성 발사가 성공했습니다.', [A('우주 강국이 되겠습니다', F('personal', 3, { approval: 1 })), A('국방 위성도 늘리겠습니다', F('defense', 3)), A('연구원들의 공입니다', { trust: 2 })]),
  calm('border', '국경에서 작은 충돌이 있었습니다.', [A('단호히 대응하겠습니다', F('defense', 4)), A('대화로 풀겠습니다', F('diplo', 3)), A('별일 아닙니다', { trust: -2 })]),
  calm('un', '국제기구에서 우리 목소리가 작다는 지적입니다.', [A('분담금을 늘리겠습니다', F('diplo', 4, { approval: -1 })), A('평화 유지군을 보내겠습니다', F('diplo', 3)), A('실리가 더 중요합니다', F('economy', 2))]),
  // 개인·정치
  calm('family', '가족 회사 특혜 의혹이 나왔습니다.', [A('모든 자료를 공개하겠습니다', { trust: 3, approval: -1 }), A('사실이 아닙니다', { approval: -2 }), A('법대로 조사받겠습니다', { trust: 2 })]),
  calm('promise', '선거 공약을 안 지켰다는 비판이 있습니다.', [A('남은 임기에 꼭 지키겠습니다', { approval: 1, trust: -1 }), A('상황이 바뀌어 고쳤습니다', { trust: 2 }), A('대부분 지켰습니다', { approval: -2 })]),
  calm('holiday', '휴가를 너무 오래 갔다는 지적입니다.', [A('휴가를 줄이겠습니다', { approval: 2 }), A('쉬어야 일도 잘합니다', F('personal', 1, { approval: -1 })), A('휴가 중에도 일했습니다', { trust: -1 })]),
  calm('young', '젊은 층의 지지가 낮습니다.', [A('청년 장관을 뽑겠습니다', { approval: 2 }), A('SNS로 직접 소통하겠습니다', F('personal', 3)), A('결국 성과로 알아줄 것입니다', { trust: 1 })]),
  calm('media', '언론을 탄압한다는 비판이 있습니다.', [A('언론 자유는 꼭 지키겠습니다', { trust: 3 }), A('가짜 뉴스만 막겠습니다', F('society', 2, { approval: -1 })), A('언론도 반성해야 합니다', { approval: -3 })]),
  calm('reform', '공무원 사회가 너무 느리다는 불만입니다.', [A('부처를 확 줄이겠습니다', F('economy', 3, { trust: -1 })), A('일 잘하면 상을 주겠습니다', F('society', 2, { trust: 1 })), A('공무원은 잘하고 있습니다', { approval: -1 })]),
  calm('hobby', '대통령의 취미가 궁금합니다.', [A('(웃으며) 등산입니다', { approval: 2 }), A('밤마다 역사책을 읽습니다', F('personal', 2)), A('일이 취미입니다', { trust: 1 })]),
  calm('rich', '부자 증세를 해야 한다는 목소리가 있습니다.', [A('공정하게 더 걷겠습니다', F('society', 3, { approval: 1 })), A('투자가 줄어들 것입니다', F('economy', 3, { approval: -1 })), A('검토하겠습니다', { trust: -1 })]),
  calm('flood', '장마로 큰 피해가 났습니다.', [A('바로 현장으로 가겠습니다', { approval: 3 }), A('특별 재난 지역으로 정하겠습니다', F('society', 4)), A('하늘이 한 일입니다', { approval: -4 })]),
];

/** 상황 질문 더(나라 상황에 맞을 때만) */
const hot = (id: string, when: (s: GameState) => boolean, ask: (s: GameState) => string, answers: Answer[]): Question => ({ id, when, ask, answers: () => answers });
export const HOT_MORE: Question[] = [
  hot('warcost', (s) => wars(s).length > 0, () => '전쟁 비용이 너무 크다는 지적입니다.', [A('승리가 가장 싼 길입니다', F('defense', 3, { approval: -1 })), A('전쟁 국채를 발행하겠습니다', F('economy', -2, { trust: 1 })), A('다른 예산을 줄이겠습니다', F('society', -2, { trust: 2 }))]),
  hot('warfam', (s) => wars(s).length > 0, (s) => `${wa(wars(s)[0]?.name ?? '적국')}의 전쟁에 나간 장병 가족들이 걱정이 많습니다.`, [A('장병 가족을 끝까지 돌보겠습니다', F('society', 3, { approval: 2 })), A('곧 모두 돌아올 것입니다', { approval: 2, trust: -2 }), A('희생은 잊지 않겠습니다', { trust: 2 })]),
  hot('hightrust', (s) => s.officer.trust < 40, () => '정부를 믿지 못하겠다는 국민이 늘었습니다.', [A('모든 회의를 공개하겠습니다', { trust: 4, approval: -1 }), A('결과로 믿음을 되찾겠습니다', { trust: 2 }), A('오해가 쌓였을 뿐입니다', { trust: -2 })]),
  hot('popular', (s) => approvalOf(s) >= 65, () => '지지도가 아주 높은데, 비결이 무엇입니까?', [A('모두 국민 덕분입니다', { approval: 2 }), A('지금부터가 더 중요합니다', { trust: 2 }), A('제가 잘해서입니다', F('personal', 2, { approval: -2 }))]),
  hot('lowtax', (s) => taxOf(s) === 'low', () => '세금이 너무 낮아 나라 살림이 걱정된다는 말이 있습니다.', [A('세금은 그대로, 씀씀이를 줄이겠습니다', { approval: 1, trust: 1 }), A('조금 올리겠습니다', { approval: -2, trust: 2 }), A('경제가 살아나면 채워집니다', F('economy', 3))]),
];

for (const q of BASE_QUESTIONS) if (['economy', 'goal', 'health'].includes(q.id)) q.calm = true;
export const QUESTIONS: Question[] = [...BASE_QUESTIONS, ...HOT_MORE, ...CALM_QUESTIONS];
/** 한 번 회견의 질문 수(7~10) */
export const PRESS_MIN = 7;
export const PRESS_MAX = 10;
/** 상황 질문은 한 회견에 이만큼까지 */
const PRESS_HOT_MAX = 4;
/** 최근 질문 기억 수 */
const PRESS_RECENT = 30;
const QMAP = new Map(QUESTIONS.map((q) => [q.id, q]));
/** 없는 질문(옛 저장 등)은 평소 질문으로 대신 */
export const questionById = (id: QId) => QMAP.get(id) ?? QMAP.get('goal')!;

export function canPress(s: GameState): string | null {
  const m = mediaOf(s);
  if (m.press) return null;
  if (s.worldMs < m.pressMs) return '다음 기자회견을 기다려요';
  return null;
}
/** 기자회견 열기: 상황 질문 먼저(최대 4개), 나머지는 최근에 안 나온 평소 질문으로 7~10개 */
export function startPress(s: GameState): GameState {
  const m = structuredClone(mediaOf(s));
  if (m.press || s.worldMs < m.pressMs) return s;
  const rng = new Rng(m.seed);
  const recent = new Set(m.recent ?? []);
  const total = PRESS_MIN + Math.floor(rng.next() * (PRESS_MAX - PRESS_MIN + 1));
  const take = (from: QId[], n: number, out: QId[]) => {
    while (out.length < n && from.length) out.push(from.splice(Math.floor(rng.next() * from.length), 1)[0]);
  };
  const hotIds = QUESTIONS.filter((q) => !q.calm && q.when(s)).map((q) => q.id);
  const pick: QId[] = [];
  // 상황 질문: 최근에 안 나온 것 먼저
  take(hotIds.filter((id) => !recent.has(id)), PRESS_HOT_MAX, pick);
  take(hotIds.filter((id) => recent.has(id) && !pick.includes(id)), Math.min(2, PRESS_HOT_MAX), pick);
  const calmIds = QUESTIONS.filter((q) => q.calm && q.when(s)).map((q) => q.id);
  take(calmIds.filter((id) => !recent.has(id)), total, pick);
  take(calmIds.filter((id) => !pick.includes(id)), total, pick);
  // 상황 질문을 섞어서 앞에만 몰리지 않게
  for (let i = pick.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    [pick[i], pick[j]] = [pick[j], pick[i]];
  }
  m.seed = rng.seed;
  m.press = { qs: pick, i: 0, got: [] };
  m.recent = [...(m.recent ?? []).filter((id) => !pick.includes(id)), ...pick].slice(-PRESS_RECENT);
  return { ...s, media: m };
}
/** 정치 스탯 배율(좋은 효과만 키움) */
export const pressMult = (s: GameState) => Math.max(0.8, Math.min(1.6, 0.75 + (s.officer.stats['정치'] ?? 8) / 40)) + ministryPower(s, 'kocis') * 0.1;

const PRESS_WHY = '🎙️ 기자회견';
/** 기자회견 지지도 효과 합계 한도 */
export const PRESS_APPROVAL_CAP = 8;
/** 기자회견 분야 점수 효과(분야마다) 합계 한도 */
export const PRESS_FIELD_CAP = 10;
function mergePresMod(s: GameState, v: number): GameState {
  const p = presOf(s);
  const live = p.mods.filter((x) => x.untilMs > s.worldMs);
  const old = live.find((x) => x.why === PRESS_WHY);
  const nv = Math.round(Math.max(-PRESS_APPROVAL_CAP, Math.min(PRESS_APPROVAL_CAP, (old?.v ?? 0) + v)) * 10) / 10;
  if (!old) return addPresMod(s, PRESS_WHY, nv, 24);
  return { ...s, pres: { ...p, mods: live.map((x) => (x === old ? { ...x, v: nv, untilMs: s.worldMs + 24 * H } : x)) } };
}
function mergeFieldMod(m: MediaState, now: number, field: FieldId, v: number) {
  const old = m.mods.find((x) => x.untilMs > now && x.field === field && x.why === PRESS_WHY);
  if (!old) return addMod(m, now, field, Math.max(-PRESS_FIELD_CAP, Math.min(PRESS_FIELD_CAP, v)), 24, PRESS_WHY);
  old.v = Math.round(Math.max(-PRESS_FIELD_CAP, Math.min(PRESS_FIELD_CAP, old.v + v)) * 10) / 10;
  old.untilMs = now + 24 * H;
}
export function answerPress(s: GameState, n: number): GameState {
  const m0 = mediaOf(s);
  if (!m0.press) return s;
  const q = questionById(m0.press.qs[m0.press.i]);
  const a = q.answers(s)[n];
  if (!a) return s;
  const k = pressMult(s);
  const up = (v: number) => (v > 0 ? v * k : v);
  let ns: GameState = s;
  // 질문이 7~10개라 효과는 회견 하나에 한 줄로 합치고 한도를 둠(다른 효과 줄을 밀어내지 않게)
  if (a.approval) ns = mergePresMod(ns, up(a.approval));
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
  if (a.field) mergeFieldMod(m, s.worldMs, a.field[0], up(a.field[1]));
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
  if ((s.nations[me(s)]?.treasury ?? 0) < p.cost) return '나라 예산이 모자라요';
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
/** opt.ok = 3단계 대화 결과로 성패를 정함(없으면 확률), opt.big = 큰 협정(호감·명성 1.5배) */
export function holdSummit(s: GameState, id: string, ag: Agenda, opt?: { ok: boolean; big?: boolean }): { state: GameState; text: string } {
  if (canSummit(s, id)) return { state: s, text: '' };
  const m = structuredClone(mediaOf(s));
  const rng = new Rng(m.seed);
  const ok = opt ? (rng.next(), opt.ok) : rng.chance(summitChance(s, id));
  m.seed = rng.seed;
  const big = !!opt?.big;
  const fav = Math.round((ag === 'peace' ? 16 : 12) * (big ? 1.5 : 1));
  const fame = big ? 35 : 20;
  m.summitMs = s.worldMs + SUMMIT_GAP_MS;
  const name = COUNTRIES.find((c) => c.id === id)!.name;
  let ns: GameState = { ...s, media: m };
  let text: string;
  if (ok) {
    m.summits++;
    ns = addFavorNote(ns, id, `🤝 정상회담(${AGENDAS[ag].name})`, fav);
    ns = { ...ns, officer: { ...ns.officer, fame: ns.officer.fame + fame } };
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
    text = `🤝 ${name} 정상회담 ${big ? '큰 협정!' : '성공!'} 호감 +${fav} · 명성 +${fame} · ${extra}`;
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
