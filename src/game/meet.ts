// 11-27 대장 결정: 콘텐츠 중간중간 인물을 만나 "내 사람"으로 만들기(제안서 A 현장 만남 + C 부탁 + E 인맥 수첩 + D 정적도 내 편).
// - 콘텐츠(법안 통과·도시 점령·시설 올림·정상회담 등)를 끝낸 순간, 그 자리에 어울리는 인물이 말을 걸어옴(현장 만남 카드).
// - 대답 3개: 따뜻한 대답 / 실리 대답(작은 덤) / 거절. 성향이 맞는 대답이면 인연이 더 오름.
// - 두 번째 만남부터 부탁을 건넴. 실제 24시간 안에 들어주면 인연 크게 오름, 못 하면 조금 깎임.
// - 인연 100 = 내 사람: 영입비 없이 '내각'으로 들어오고 충성 80, 숨은 특성 공개.
// - 나라 안 정적(rivals)도 만남에 나옴. 인연 100이면 협력 + 내 사람(같은 얼굴의 인물로 내각에 들어옴).
// - 대장 "더 자주": 실제 40~70분에 한 번까지, 하루 최대 10번.
import { PERSON_ORIGINS, type Faction, type Group, type PersonOrigin } from '../data/cabinet';
import { deckSize, faceFile, faceTag } from '../data/faces';
import { addPresMod } from './approval';
import { cabinetOf, genPerson, giveFaces, type Person } from './cabinet';
import { countDiff, type Count } from './goals';
import { assemblyOf } from './assembly';
import { mediaOf } from './media';
import { scheduleOf } from './schedule';
import { civOf } from './civ';
import { TITLES } from '../data/ranks';
import { ROLE_INFO, roleOf, type RivalRole } from './rivals';
import { Rng } from './rng';
import { budgetPerDay, type GameState } from './state';

const H = 3600e3;
const clamp = (v: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));

// ── 숫자(초안) ──
/** 만남 사이 쉬는 시간(실제, 대장 "더 자주") */
export const MEET_GAP_MS: [number, number] = [40 * 60e3, 70 * 60e3];
/** 하루(실제 24시간)에 만나는 최대 횟수 */
export const MEET_DAY_MAX = 10;
/** 만남 카드가 기다려 주는 시간(안 고르면 그냥 지나감) */
export const CARD_WAIT_MS = 3 * H;
/** 부탁 기한 · 동시에 들고 있을 수 있는 부탁 수 */
export const FAVOR_MS = 24 * H;
export const FAVOR_MAX = 3;
/** 인연: 따뜻한 대답 · 실리 대답 · 성향 맞음 덤 · 부탁 들어줌 · 부탁 못 들어줌 */
export const BOND_WARM = 15;
export const BOND_DEAL = 10;
export const BOND_LIKE = 5;
export const BOND_FAVOR = 30;
export const BOND_FAIL = -10;
export const BOND_MINE = 100;
/** 내 사람이 될 때 충성 */
export const MINE_LOYALTY = 80;
/** 이미 만난 사람을 다시 만날 확률(인연을 한 사람에게 모으기) */
const AGAIN = 0.65;
/** 정적이 만남에 나올 확률(그 자리에 맞는 정적이 있을 때) */
const RIVAL_P = 0.3;

export type SpotId = 'press' | 'assembly' | 'victory' | 'parade' | 'factory' | 'signing' | 'disaster' | 'protest' | 'summit' | 'launch' | 'meeting' | 'ceremony';
export type DealFx = 'approval' | 'money' | 'trust';

export interface SpotDef {
  /** 장면 그림(ui/scenes.ts) */
  scene: string;
  name: string;
  icon: string;
  /** 이 콘텐츠를 끝내면 이 자리에서 만남 */
  from: Count[];
  groups: Group[];
  rivals: RivalRole[];
  /** 처음 · 두 번째 · 그 뒤 만남 한마디 */
  lines: [string, string, string];
  warm: string;
  deal: string;
  fx: DealFx;
  /** 이 자리 사람이 주로 하는 부탁 */
  favors: FavorId[];
}

export const SPOTS: Record<SpotId, SpotDef> = {
  press: {
    scene: 'press', name: '기자회견 뒤', icon: '🎙️', from: ['plan', 'merit'], groups: ['언론'], rivals: ['언론 사주'],
    lines: ['오늘 답변, 생각보다 솔직하시던데요. 우리 쪽에 단독으로 한 번 나와 주실 수 있겠습니까?', '지난번 인터뷰 반응이 좋았습니다. 다음 특집도 같이 하시죠.', '이제 각하 기사라면 제가 직접 챙깁니다. 필요하신 게 있으면 말씀만 하세요.'],
    warm: '좋습니다. 날짜를 잡읍시다.', deal: '조건이 있소. 국방 특집으로 갑시다.', fx: 'approval', favors: ['culture', 'petition', 'research'],
  },
  assembly: {
    scene: 'assembly', name: '국회 본회의장', icon: '🏛️', from: ['law', 'budgetPass'], groups: ['정계'], rivals: ['야당 대표', '야당 원내대표', '여당 비주류'],
    lines: ['표결 잘 보셨습니까? 이번 표, 제가 몇 개 모아 드렸습니다.', '다음 회기에도 손을 잡을 수 있을지 여쭤보러 왔습니다.', '이제 각하 법안이라면 제 사람들이 먼저 움직입니다.'],
    warm: '고맙소. 앞으로도 같이 갑시다.', deal: '다음 예산에서 그쪽 지역을 챙기겠소.', fx: 'trust', favors: ['law', 'project', 'task'],
  },
  victory: {
    scene: 'victory', name: '승전 행사장', icon: '🏆', from: ['capture', 'recapture', 'deployWin', 'annex', 'island'], groups: ['군'], rivals: ['군부 실력자', '퇴역 대장'],
    lines: ['각하, 이번 승리는 현장 병사들이 피로 얻은 겁니다. 한번 직접 봐 주십시오.', '부대가 각하를 다시 보고 싶어 합니다. 사기가 하늘을 찌릅니다.', '명령만 내리십시오. 제 부대는 각하를 따릅니다.'],
    warm: '모두에게 내 감사를 전해 주시오.', deal: '공을 세운 부대에 포상금을 내리겠소.', fx: 'trust', favors: ['capture', 'train', 'deploy'],
  },
  parade: {
    scene: 'parade', name: '열병식', icon: '🎖️', from: ['star3', 'general', 'rank'], groups: ['군'], rivals: ['퇴역 대장', '군부 실력자'],
    lines: ['오늘 사열, 각 맞춰 준비했습니다. 마음에 드셨습니까?', '훈련장에 한번 더 들러 주시면 장병들이 힘이 날 겁니다.', '각하가 오시는 날엔 제가 맨 앞줄에 섭니다.'],
    warm: '훌륭했소. 자랑스럽소.', deal: '새 장비 예산을 먼저 배정하겠소.', fx: 'trust', favors: ['train', 'research', 'facUp'],
  },
  factory: {
    scene: 'factory', name: '공장 준공식', icon: '🏭', from: ['facUp', 'project'], groups: ['재계', '공공'], rivals: ['재벌', '금융 큰손'],
    lines: ['라인 돌아가는 소리, 들리십니까? 이 공장, 제가 끝까지 밀어붙였습니다.', '다음 공장 부지를 보고 왔습니다. 각하께서 허락만 하시면 됩니다.', '이제 우리 그룹 일은 각하 나라 일입니다.'],
    warm: '수고 많았소. 일자리가 늘겠군요.', deal: '세금 감면을 검토하겠소. 대신 투자를 늘려 주시오.', fx: 'money', favors: ['facUp', 'project', 'pact'],
  },
  signing: {
    scene: 'signing', name: '협정 서명식', icon: '✍️', from: ['pact', 'vote'], groups: ['재계', '외국'], rivals: ['금융 큰손'],
    lines: ['서명 잉크가 마르기도 전에 주문이 들어오고 있습니다.', '이번 계약 덕을 톡톡히 봤습니다. 다음 판도 같이 짜 보시죠.', '각하 나라와의 거래라면 제가 먼저 나섭니다.'],
    warm: '좋은 거래였소. 다음도 기대하오.', deal: '다음 계약은 그쪽에 먼저 기회를 주겠소.', fx: 'money', favors: ['pact', 'summit', 'facUp'],
  },
  disaster: {
    scene: 'disaster', name: '사건 현장', icon: '🚒', from: ['event'], groups: ['정계', '시민'], rivals: ['지방 실세', '종교계 거물'],
    lines: ['현장까지 와 주실 줄은 몰랐습니다. 주민들이 많이 놀랐어요.', '복구는 잘 되고 있습니다. 주민들이 각하 이야기를 자주 합니다.', '이 동네 사람들은 각하를 잊지 않을 겁니다.'],
    warm: '끝까지 돕겠소. 무엇이든 말하시오.', deal: '복구 예산을 바로 내려보내겠소.', fx: 'approval', favors: ['petition', 'task', 'project'],
  },
  protest: {
    scene: 'protest', name: '집회 현장', icon: '🪧', from: ['petition'], groups: ['시민'], rivals: ['노조 위원장'],
    lines: ['청원을 들어주셨다고요? 솔직히 기대 안 했습니다.', '조합원들이 각하를 다시 보고 있습니다. 이번엔 대화로 풀어 보죠.', '이제 우리 쪽 사람들도 각하 편에 설 겁니다.'],
    warm: '대화로 풉시다. 문은 열려 있소.', deal: '협의체를 만들고 자리를 드리겠소.', fx: 'approval', favors: ['petition', 'task', 'law'],
  },
  summit: {
    scene: 'summit', name: '정상회담장 복도', icon: '🤝', from: ['summit'], groups: ['외국'], rivals: [],
    lines: ['회담장 밖에서 따로 인사드리고 싶었습니다. 우리 정부 안에도 각하를 좋게 보는 사람이 있습니다.', '지난번 회담 뒤로 제 입지가 좋아졌습니다. 감사 인사를 드리러 왔습니다.', '제 나라를 떠나야 한다면, 각하 곁으로 가겠습니다.'],
    warm: '언제든 연락하시오.', deal: '다음 회담 의제를 미리 나눕시다.', fx: 'trust', favors: ['summit', 'pact', 'deploy'],
  },
  launch: {
    scene: 'launch', name: '연구 성과 발표', icon: '🚀', from: ['research'], groups: ['시민', '공공'], rivals: [],
    lines: ['이번 연구, 우리 연구진이 밤을 새웠습니다. 다음 과제도 맡겨 주십시오.', '실험실이 비좁습니다. 각하께서 한번 와 보시면 아실 겁니다.', '각하 나라를 위한 연구라면 어디든 가겠습니다.'],
    warm: '대단하오. 계속 밀어 주겠소.', deal: '연구 예산을 늘리겠소. 결과로 보여 주시오.', fx: 'money', favors: ['research', 'facUp', 'culture'],
  },
  meeting: {
    scene: 'meeting', name: '정부 청사', icon: '🗂️', from: ['task', 'appoint', 'spy'], groups: ['관료', '정계'], rivals: ['여당 비주류', '전 정보기관장'],
    lines: ['업무 보고를 보셨습니까? 실무는 제가 거의 다 챙겼습니다.', '각하 밑에서 일해 보고 싶다는 사람이 늘고 있습니다. 저도 그중 하나고요.', '어느 자리든 맡겨 주시면 해내겠습니다.'],
    warm: '수고가 많소. 눈여겨보겠소.', deal: '다음 인사에서 그쪽 사람을 챙기겠소.', fx: 'trust', favors: ['task', 'law', 'project'],
  },
  ceremony: {
    scene: 'ceremony', name: '문화 행사장', icon: '🎉', from: ['culture'], groups: ['언론', '시민'], rivals: ['종교계 거물', '언론 사주'],
    lines: ['오늘 무대, 객석 반응 보셨지요? 이런 자리를 더 만들고 싶습니다.', '다음 공연에도 꼭 와 주십시오. 관객들이 각하를 반깁니다.', '각하가 만든 문화가 나라 얼굴이 됐습니다.'],
    warm: '멋진 무대였소.', deal: '문화 시설을 더 짓겠소. 같이 꾸려 주시오.', fx: 'approval', favors: ['culture', 'facUp', 'petition'],
  },
};
export const SPOT_IDS = Object.keys(SPOTS) as SpotId[];

/** 따뜻한 대답을 좋아하는 성향 · 실리 대답을 좋아하는 성향 */
const WARM_LIKE: Faction[] = ['온건파', '개혁파'];
const DEAL_LIKE: Faction[] = ['경제파', '군부파'];

// ── 부탁(C) ──
export type FavorId = 'facUp' | 'research' | 'law' | 'pact' | 'capture' | 'petition' | 'summit' | 'culture' | 'project' | 'task' | 'train' | 'deploy';
export interface FavorDef {
  count: Count[];
  need: number;
  text: string;
  ask: string;
  /** 바로 가기: [화면, 탭] */
  go: [string, string];
}
export const FAVORS: Record<FavorId, FavorDef> = {
  facUp: { count: ['facUp'], need: 2, text: '시설·청사 2단계 올리기', ask: '우리 쪽 시설이 낡았습니다. 두 곳만 올려 주십시오.', go: ['economy', 'facall'] },
  research: { count: ['research'], need: 1, text: '연구 하나 끝내기', ask: '기다리는 연구가 하나 있습니다. 끝까지 밀어 주십시오.', go: ['society', 'tech'] },
  law: { count: ['law'], need: 1, text: '법안 하나 통과시키기', ask: '묶여 있는 법안이 있습니다. 통과만 시켜 주시면 됩니다.', go: ['society', 'politics'] },
  pact: { count: ['pact'], need: 1, text: '협정·무역 계약 하나 맺기', ask: '바깥과 거래를 하나만 더 터 주십시오.', go: ['diplo', 'agree'] },
  capture: { count: ['capture', 'recapture'], need: 1, text: '도시 하나 차지하기', ask: '저쪽 도시 하나만 가져와 주십시오. 장병들이 기다립니다.', go: ['defense', 'ops'] },
  petition: { count: ['petition'], need: 1, text: '국민 청원 하나 들어주기', ask: '주민들 목소리를 하나만 들어주십시오.', go: ['society', 'press'] },
  summit: { count: ['summit'], need: 1, text: '정상회담 한 번 성공하기', ask: '정상끼리 한 번 만나 주시면 길이 열립니다.', go: ['diplo', 'mofa'] },
  culture: { count: ['culture'], need: 1, text: '문화 작품·스타 하나 얻기', ask: '무대에 올릴 작품이 하나 필요합니다.', go: ['culture', 'works'] },
  project: { count: ['project'], need: 1, text: '대형 사업 한 단계 진행하기', ask: '멈춰 있는 대형 사업을 한 단계만 밀어 주십시오.', go: ['economy', 'proj'] },
  task: { count: ['task'], need: 2, text: '부처 업무 2개 끝내기', ask: '부처 일이 밀려 있습니다. 두 건만 처리해 주십시오.', go: ['society', 'mins'] },
  train: { count: ['train'], need: 2, text: '훈련 2번 끝내기', ask: '장병들 훈련을 두 번만 더 시켜 주십시오.', go: ['defense', 'train'] },
  deploy: { count: ['deployWin', 'capture'], need: 1, text: '파병·전투 한 번 이기기', ask: '한 번만 이겨 주시면 제가 사람들을 설득하겠습니다.', go: ['diplo', 'deploy'] },
};

/** 누구: 내각 인물 'p:<id>' · 정적 'r:<이름>' */
export type MeetKey = `p:${number}` | `r:${string}`;

export interface MeetCard {
  key: MeetKey;
  spot: SpotId;
  /** 몇 번째 만남(0 = 처음) */
  step: number;
  atMs: number;
  untilMs: number;
}
export interface Favor {
  key: MeetKey;
  id: FavorId;
  have: number;
  untilMs: number;
}
export interface MeetState {
  bond: Record<string, number>;
  /** 만난 횟수 */
  times: Record<string, number>;
  /** 만난 순서(수첩) */
  met: string[];
  mine: string[];
  card: MeetCard | null;
  favors: Favor[];
  nextMs: number;
  day: number;
  today: number;
  favorDone: number;
  /** 받은 모으기 보상 */
  got: string[];
  log: string[];
  /** 11/28 마지막으로 만남을 청한 시각 */
  askMs?: number;
}

export function newMeet(s: Pick<GameState, 'worldMs'>): MeetState {
  return { bond: {}, times: {}, met: [], mine: [], card: null, favors: [], nextMs: s.worldMs + 15 * 60e3, day: Math.floor(s.worldMs / (24 * H)), today: 0, favorDone: 0, got: [], log: [] };
}
export const meetOf = (s: GameState): MeetState => s.meet ?? newMeet(s);
export const bondOf = (s: GameState, key: string) => meetOf(s).bond[key] ?? 0;
export const isMine = (s: GameState, key: string) => meetOf(s).mine.includes(key);

/** 인연 단계 */
export function bondStage(b: number, mine: boolean): { name: string; icon: string } {
  if (mine) return { name: '내 사람', icon: '★' };
  if (b >= 60) return { name: '가까운 사이', icon: '🤝' };
  if (b >= 30) return { name: '아는 사이', icon: '🙂' };
  return { name: '처음 본 사이', icon: '👋' };
}

// ── 누구인지 ──
export interface Who {
  key: MeetKey;
  name: string;
  title: string;
  faction: Faction | null;
  group: Group | '정적';
  /** 얼굴: 내각 인물이면 person, 정적이면 faceKey */
  person?: Person;
  faceKey?: string;
  icon: string;
}
export function whoOf(s: GameState, key: string): Who | null {
  if (key.startsWith('p:')) {
    const id = Number(key.slice(2));
    const p = cabinetOf(s).people.find((x) => x.id === id);
    if (!p) return null;
    return { key: key as MeetKey, name: p.name, title: p.title ?? PERSON_ORIGINS[p.origin].name, faction: p.faction, group: p.group, person: p, icon: PERSON_ORIGINS[p.origin].icon };
  }
  const name = key.slice(2);
  const i = s.officer.rivals.findIndex((r) => r.name === name);
  if (i < 0) return null;
  const rv = s.officer.rivals[i];
  const role = roleOf(rv, i);
  return { key: key as MeetKey, name: rv.name, title: role, faction: null, group: '정적', faceKey: rv.faceKey, icon: ROLE_INFO[role].icon };
}

/** 이 자리에서 만날 수 있는 사람들 */
function candidates(s: GameState, spot: SpotId): MeetKey[] {
  const m = meetOf(s);
  const d = SPOTS[spot];
  const out: MeetKey[] = [];
  for (const p of cabinetOf(s).people) {
    if (!d.groups.includes(p.group)) continue;
    const k: MeetKey = `p:${p.id}`;
    if (m.mine.includes(k)) continue;
    out.push(k);
  }
  return out;
}
function rivalCandidates(s: GameState, spot: SpotId): MeetKey[] {
  const m = meetOf(s);
  const d = SPOTS[spot];
  return s.officer.rivals
    .map((rv, i) => ({ rv, role: roleOf(rv, i) }))
    .filter((x) => d.rivals.includes(x.role) && !m.mine.includes(`r:${x.rv.name}`))
    .map((x) => `r:${x.rv.name}` as MeetKey);
}

/** 고르기: 이미 만난(인연 쌓인) 사람을 더 자주 · 부탁을 들고 있는 사람은 빼고 */
function pickWho(s: GameState, spot: SpotId, rng: Rng): MeetKey | null {
  const m = meetOf(s);
  const busy = new Set(m.favors.map((f) => f.key));
  const rivals = rivalCandidates(s, spot).filter((k) => !busy.has(k));
  if (rivals.length && rng.chance(RIVAL_P)) return rng.pick(rivals);
  const list = candidates(s, spot).filter((k) => !busy.has(k));
  if (!list.length) return rivals.length ? rng.pick(rivals) : null;
  const known = list.filter((k) => (m.bond[k] ?? 0) > 0);
  if (known.length && rng.chance(AGAIN)) return rng.weighted(known, (k) => 10 + (m.bond[k] ?? 0)) ?? rng.pick(known);
  const fresh = list.filter((k) => !(k in m.bond));
  return rng.pick(fresh.length ? fresh : list);
}

/** 한 일 → 만남 자리 */
export function spotFor(d: Partial<Record<Count, number>>): SpotId | null {
  // 큰일부터(승리 > 의회 > 회담 > ... > 업무)
  const order: SpotId[] = ['victory', 'assembly', 'summit', 'disaster', 'protest', 'signing', 'factory', 'launch', 'ceremony', 'parade', 'press', 'meeting'];
  for (const id of order) if (SPOTS[id].from.some((c) => (d[c] ?? 0) > 0)) return id;
  return null;
}

const dayOf = (ms: number) => Math.floor(ms / (24 * H));

/** 만남 열기(시험·자리에서 직접 부를 때도 씀) */
export function openMeet(s: GameState, spot: SpotId, seed = s.worldMs): GameState {
  const m0 = meetOf(s);
  if (m0.card) return s;
  const rng = new Rng(((seed >>> 0) ^ 0x5bd1e995) >>> 0 || 7);
  const key = pickWho(s, spot, rng);
  if (!key) return s;
  const day = dayOf(s.worldMs);
  const m: MeetState = {
    ...m0,
    day,
    today: (m0.day === day ? m0.today : 0) + 1,
    card: { key, spot, step: m0.times[key] ?? 0, atMs: s.worldMs, untilMs: s.worldMs + CARD_WAIT_MS },
    nextMs: s.worldMs + MEET_GAP_MS[0] + rng.next() * (MEET_GAP_MS[1] - MEET_GAP_MS[0]),
  };
  return { ...s, meet: m };
}

/** 지금 만남이 생길 수 있나 */
export function canMeetNow(s: GameState): boolean {
  const m = meetOf(s);
  if (m.card) return false;
  if (s.worldMs < m.nextMs) return false;
  const today = m.day === dayOf(s.worldMs) ? m.today : 0;
  return today < MEET_DAY_MAX;
}

/** 바뀌기 전·후를 비교: 부탁 진행 + 콘텐츠를 끝냈으면 만남(App.tsx addReports에서 부름) */
export function trackMeet(b: GameState | null, a: GameState): GameState {
  if (!b || b === a || b.player.countryId !== a.player.countryId) return a;
  const d = countDiff(b, a);
  let s = a;
  const m0 = meetOf(s);
  // 부탁 진행
  if (m0.favors.length && Object.keys(d).length) {
    let changed = false;
    const favors = m0.favors.map((f) => {
      const n = FAVORS[f.id].count.reduce((t, c) => t + (d[c] ?? 0), 0);
      if (n <= 0) return f;
      changed = true;
      return { ...f, have: Math.min(FAVORS[f.id].need, f.have + n) };
    });
    if (changed) s = { ...s, meet: { ...m0, favors } };
  }
  s = settleFavors(s);
  const spot = spotFor(d);
  if (spot && canMeetNow(s)) s = openMeet(s, spot);
  return s;
}

/** 시간만 흘러도: 카드 지나감 · 부탁 기한 넘김 */
export function meetTick(s: GameState): GameState {
  if (!s.meet) return s;
  let m = s.meet;
  if (m.card && s.worldMs > m.card.untilMs) m = { ...m, card: null };
  const ns = m === s.meet ? s : { ...s, meet: m };
  return settleFavors(ns);
}

/** 다 한 부탁은 인연 +, 기한 넘긴 부탁은 인연 − */
function settleFavors(s: GameState): GameState {
  const m0 = meetOf(s);
  if (!m0.favors.length) return s;
  const done = m0.favors.filter((f) => f.have >= FAVORS[f.id].need);
  const late = m0.favors.filter((f) => f.have < FAVORS[f.id].need && s.worldMs > f.untilMs);
  if (!done.length && !late.length) return s;
  let ns: GameState = { ...s, meet: { ...m0, favors: m0.favors.filter((f) => !done.includes(f) && !late.includes(f)), favorDone: m0.favorDone + done.length } };
  for (const f of done) {
    const w = whoOf(ns, f.key);
    ns = addBond(ns, f.key, BOND_FAVOR, `📩 ${w?.name ?? '그 사람'}의 부탁(${FAVORS[f.id].text})을 들어줬어요. 인연 +${BOND_FAVOR}`);
  }
  for (const f of late) {
    const w = whoOf(ns, f.key);
    ns = addBond(ns, f.key, BOND_FAIL, `⌛ ${w?.name ?? '그 사람'}의 부탁을 기한 안에 못 들어줬어요. 인연 ${BOND_FAIL}`);
  }
  return ns;
}

function pushLog(m: MeetState, text: string): MeetState {
  return { ...m, log: [text, ...m.log].slice(0, 20) };
}

/** 인연 더하기(100이면 내 사람) */
export function addBond(s: GameState, key: MeetKey, v: number, why?: string): GameState {
  const m0 = meetOf(s);
  if (m0.mine.includes(key)) return s;
  const b = clamp((m0.bond[key] ?? 0) + v, 0, BOND_MINE);
  let m: MeetState = { ...m0, bond: { ...m0.bond, [key]: b } };
  if (why) m = pushLog(m, why);
  let ns: GameState = { ...s, meet: m };
  if (b >= BOND_MINE) ns = becomeMine(ns, key);
  return ns;
}

/** 인연 100: 내 사람으로 */
function becomeMine(s: GameState, key: MeetKey): GameState {
  const w = whoOf(s, key);
  if (!w) return s;
  const c = structuredClone(cabinetOf(s));
  let rivals = s.officer.rivals;
  if (key.startsWith('p:')) {
    const p = c.people.find((x) => x.id === Number(key.slice(2)))!;
    const was = p.title;
    p.group = '내각';
    p.loyalty = Math.max(p.loyalty, MINE_LOYALTY);
    p.known = true;
    if (was && p.country !== s.player.countryId) p.title = `망명한 ${was}`;
  } else {
    const i = s.officer.rivals.findIndex((r) => r.name === w.name);
    const rv = s.officer.rivals[i];
    const role = roleOf(rv, i);
    const rng = new Rng(((s.worldMs >>> 0) ^ 0x2f6b) >>> 0 || 3);
    const sex = rv.sex ?? 'm';
    const np = genPerson(c, rng, { country: s.player.countryId, group: '내각', origin: RIVAL_ORIGIN[role], grade: '우수', title: `전 ${role}`, sex, age: [52, 68] }, s.worldMs, new Set(c.people.map((x) => x.name)));
    np.name = rv.name;
    np.eth = rv.eth ?? np.eth;
    const fi = faceIndex(s.player.countryId, rv.eth, sex, rv.faceKey);
    if (fi !== null) np.face = fi;
    np.loyalty = MINE_LOYALTY;
    np.known = true;
    c.people.push(np);
    giveFaces(c); // 11-27 나이를 얼굴에 맞춤
    rivals = s.officer.rivals.map((r, j) => (j === i ? { ...r, ally: true, influence: 0, mine: true } : r));
  }
  const m0 = meetOf(s);
  const m = pushLog({ ...m0, mine: [...m0.mine, key] }, `★ ${w.name}(${w.title})이(가) 내 사람이 됐어요! 개인 → 인재 → 내 사람에서 자리에 앉힐 수 있어요.`);
  return { ...s, cabinet: c, officer: { ...s.officer, rivals }, meet: m };
}

const RIVAL_ORIGIN: Record<RivalRole, PersonOrigin> = {
  '야당 대표': 'partisan',
  '군부 실력자': 'general',
  재벌: 'chaebol',
  '야당 원내대표': 'partisan',
  '퇴역 대장': 'general',
  '금융 큰손': 'exec',
  '언론 사주': 'journalist',
  '노조 위원장': 'activist',
  '지방 실세': 'mayor',
  '종교계 거물': 'religious',
  '전 정보기관장': 'spy',
  '여당 비주류': 'partisan',
};

/** 정적 얼굴 파일 → 그 나라 얼굴 번호(같은 얼굴로 내각에 들어오게) */
function faceIndex(country: string, eth: string | undefined, sex: 'm' | 'f', faceKey?: string): number | null {
  if (!faceKey) return null;
  const tag = faceTag(country, eth);
  const n = deckSize(tag, sex);
  for (let i = 0; i < n; i++) if (faceFile(tag, sex, i) === faceKey) return i;
  return null;
}

// ── 대답 고르기 ──
export type Answer = 'warm' | 'deal' | 'no';
/** 이 대답으로 오르는 인연(성향 맞음 덤 포함) */
export function answerBond(s: GameState, card: MeetCard, a: Answer): { bond: number; like: boolean } {
  if (a === 'no') return { bond: 0, like: false };
  const w = whoOf(s, card.key);
  const like = !!w?.faction && (a === 'warm' ? WARM_LIKE : DEAL_LIKE).includes(w.faction);
  // 정적은 성향 대신 '실리'를 좋아함
  const rivalLike = w?.group === '정적' && a === 'deal';
  const base = a === 'warm' ? BOND_WARM : BOND_DEAL;
  return { bond: base + (like || rivalLike ? BOND_LIKE : 0), like: like || rivalLike };
}
/** 실리 대답 덤 */
export function dealGift(s: GameState, spot: SpotId): { text: string; apply: (s: GameState) => GameState } {
  const fx = SPOTS[spot].fx;
  if (fx === 'money') {
    const v = Math.round(budgetPerDay(s, s.player.countryId) * 1);
    return {
      text: `나라 예산 +${v.toLocaleString('ko-KR')}`,
      apply: (x) => {
        const me = x.player.countryId;
        return { ...x, nations: { ...x.nations, [me]: { ...x.nations[me], treasury: x.nations[me].treasury + v } } };
      },
    };
  }
  if (fx === 'trust') return { text: '의회 신뢰 +2', apply: (x) => ({ ...x, officer: { ...x.officer, trust: Math.min(100, x.officer.trust + 2) } }) };
  return { text: '지지도 +2(6시간)', apply: (x) => addPresMod(x, `${SPOTS[spot].name} 만남`, 2, 6) };
}

/** 이번 만남에서 부탁을 건네나(두 번째 만남부터, 부탁 칸이 남았을 때) */
export function willAsk(s: GameState, card: MeetCard, a: Answer): boolean {
  const m = meetOf(s);
  return a !== 'no' && card.step >= 1 && m.favors.length < FAVOR_MAX && !m.favors.some((f) => f.key === card.key);
}
export function favorFor(s: GameState, card: MeetCard): FavorId {
  const list = SPOTS[card.spot].favors;
  return list[(card.step + (meetOf(s).favorDone ?? 0)) % list.length];
}

export function answerMeet(s: GameState, a: Answer): GameState {
  const m0 = meetOf(s);
  const card = m0.card;
  if (!card) return s;
  const w = whoOf(s, card.key);
  if (!w) return { ...s, meet: { ...m0, card: null } };
  const ask = willAsk(s, card, a);
  const fav = ask ? favorFor(s, card) : null;
  const { bond, like } = answerBond(s, card, a);
  const met = m0.met.includes(card.key) ? m0.met : [...m0.met, card.key];
  let ns: GameState = {
    ...s,
    meet: {
      ...m0,
      card: null,
      met,
      times: { ...m0.times, [card.key]: (m0.times[card.key] ?? 0) + 1 },
      bond: { ...m0.bond, [card.key]: m0.bond[card.key] ?? 0 },
      favors: fav ? [...m0.favors, { key: card.key, id: fav, have: 0, untilMs: s.worldMs + FAVOR_MS }] : m0.favors,
    },
  };
  if (a === 'deal') ns = dealGift(ns, card.spot).apply(ns);
  const why = a === 'no' ? `👋 ${w.name}의 이야기를 정중히 거절했어요.` : `💬 ${SPOTS[card.spot].name}에서 ${w.name}(${w.title})을(를) 만났어요. 인연 +${bond}${like ? '(성향 맞음)' : ''}${fav ? ` · 부탁: ${FAVORS[fav].text}` : ''}`;
  ns = addBond(ns, card.key, bond, why);
  return ns;
}

/** 부탁 그만두기(인연 조금 깎임) */
export function dropFavor(s: GameState, key: MeetKey): GameState {
  const m0 = meetOf(s);
  if (!m0.favors.some((f) => f.key === key)) return s;
  const ns: GameState = { ...s, meet: { ...m0, favors: m0.favors.filter((f) => f.key !== key) } };
  return addBond(ns, key, BOND_FAIL / 2, `🙅 ${whoOf(s, key)?.name ?? '그 사람'}의 부탁을 거절했어요. 인연 ${BOND_FAIL / 2}`);
}

/** 만남 카드 그냥 닫기(지나감) */
export function skipMeet(s: GameState): GameState {
  const m0 = meetOf(s);
  return m0.card ? { ...s, meet: { ...m0, card: null } } : s;
}

// ── 인맥 수첩 모으기 보상(E) ──
export interface BookGoal {
  id: string;
  icon: string;
  text: string;
  ruby: number;
  boosts: number;
  prog: (m: MeetState) => [number, number];
}
export const BOOK_GOALS: BookGoal[] = [
  { id: 'met5', icon: '👋', text: '5명 만나기', ruby: 5, boosts: 1, prog: (m) => [m.met.length, 5] },
  { id: 'met15', icon: '👋', text: '15명 만나기', ruby: 10, boosts: 2, prog: (m) => [m.met.length, 15] },
  { id: 'met30', icon: '👋', text: '30명 만나기', ruby: 20, boosts: 3, prog: (m) => [m.met.length, 30] },
  { id: 'fav3', icon: '📩', text: '부탁 3번 들어주기', ruby: 5, boosts: 1, prog: (m) => [m.favorDone, 3] },
  { id: 'fav10', icon: '📩', text: '부탁 10번 들어주기', ruby: 10, boosts: 2, prog: (m) => [m.favorDone, 10] },
  { id: 'mine1', icon: '★', text: '내 사람 1명', ruby: 5, boosts: 1, prog: (m) => [m.mine.length, 1] },
  { id: 'mine5', icon: '★', text: '내 사람 5명', ruby: 15, boosts: 2, prog: (m) => [m.mine.length, 5] },
  { id: 'mine10', icon: '★', text: '내 사람 10명 · 인맥왕', ruby: 25, boosts: 3, prog: (m) => [m.mine.length, 10] },
  { id: 'rival1', icon: '🎭', text: '정적 1명을 내 사람으로', ruby: 15, boosts: 2, prog: (m) => [m.mine.filter((k) => k.startsWith('r:')).length, 1] },
];
export function bookReady(s: GameState): number {
  const m = meetOf(s);
  return BOOK_GOALS.filter((g) => !m.got.includes(g.id) && g.prog(m)[0] >= g.prog(m)[1]).length;
}
export function claimBook(s: GameState, id: string): GameState {
  const m = meetOf(s);
  const g = BOOK_GOALS.find((x) => x.id === id);
  if (!g || m.got.includes(id)) return s;
  const [have, need] = g.prog(m);
  if (have < need) return s;
  const goals = s.goals ? { ...s.goals, ruby: s.goals.ruby + g.ruby } : s.goals;
  if (!goals) return s;
  return { ...s, goals, officer: { ...s.officer, boosts: (s.officer.boosts ?? 0) + g.boosts }, meet: { ...m, got: [...m.got, id] } };
}

/** 수첩에 보일 묶음 */
export const BOOK_GROUPS: Array<{ id: Group | '정적'; icon: string; hint: string }> = [
  { id: '정계', icon: '🗳️', hint: '법안 통과·예산 통과·사건 대응' },
  { id: '재계', icon: '🏢', hint: '시설 올리기·대형 사업·협정' },
  { id: '언론', icon: '📺', hint: '일정 소화·공훈·문화 행사' },
  { id: '시민', icon: '✊', hint: '청원·사건 대응·연구·문화' },
  { id: '군', icon: '⭐', hint: '도시 점령·파병 승리·훈련 별 3개' },
  { id: '외국', icon: '🌐', hint: '정상회담·협정·국제 회의' },
  { id: '관료', icon: '🗂️', hint: '부처 업무·인사·첩보' },
  { id: '공공', icon: '🏭', hint: '시설 올리기·연구' },
  { id: '정적', icon: '🎭', hint: '의회·승전·공장·집회 현장에서 가끔' },
];
/** 수첩 목록(묶음별): 만날 수 있는 모든 사람 */
export function bookList(s: GameState, g: Group | '정적'): Who[] {
  const m = meetOf(s);
  if (g === '정적') return s.officer.rivals.map((rv) => whoOf(s, `r:${rv.name}`)!).filter(Boolean);
  const people = cabinetOf(s).people.filter((p) => p.group === g || (p.group === '내각' && m.mine.includes(`p:${p.id}`) && whoGroupWas(m, p) === g));
  return people.map((p) => whoOf(s, `p:${p.id}`)!).filter(Boolean);
}
/** 내 사람이 된 인물이 원래 어느 묶음이었는지(제목으로 가늠) */
function whoGroupWas(_m: MeetState, p: Person): Group {
  const t = p.title ?? '';
  if (/국회|여당|원내|정적 측근|야당|도지사/.test(t)) return '정계';
  if (/그룹 회장/.test(t)) return '재계';
  if (/언론사/.test(t)) return '언론';
  if (/시민단체|대학 총장|노조/.test(t)) return '시민';
  if (/야전 사령관/.test(t)) return '군';
  if (/외교장관|국방장관/.test(t)) return '외국';
  if (/실장|차장|전직 차관/.test(t)) return '관료';
  if (/공기업|연구원장|시장·군수/.test(t)) return '공공';
  return '인재';
}

// ── 11/28 대장 요청: 아직 못 만난 사람에게 만남 청하기 ──
// 스토리상 아직 이르거나 너무 일찍 만나면 밸런스가 흐트러지는 사람은 잠그고, 열 수 있는 힌트를 보여 줌.
/** 만남을 청하는 간격 */
export const ASK_MEET_GAP_MS = 1 * H;
/** 만남 자리 마련 비용: 나라 예산 하루치의 이만큼 */
export const ASK_MEET_COST = 0.3;
/** 정적을 청하려면 이 호칭부터 */
export const ASK_RIVAL_TITLE = 2;
/** 정적을 청하려면 먼저 만난 사람 수 */
export const ASK_RIVAL_MET = 5;

interface Gate {
  ok: (s: GameState) => boolean;
  hint: string;
}
const sumVals = (r: Record<string, number> | undefined) => Object.values(r ?? {}).reduce((a, b) => a + b, 0);
/** 묶음별 잠금: 그 묶음과 처음 얽히는 콘텐츠를 한 번은 해 봐야 만날 수 있음 */
const GROUP_GATE: Partial<Record<Group | '정적', Gate>> = {
  정계: { ok: (s) => (assemblyOf(s).passed ?? 0) + assemblyOf(s).confWins >= 1, hint: '국회에서 법안을 한 번 통과시키면' },
  재계: { ok: (s) => civOf(s).agreements.length + (s.economy.contracts?.length ?? 0) >= 1, hint: '협정이나 무역 계약을 한 번 맺으면' },
  언론: { ok: (s) => scheduleOf(s).total >= 3, hint: '대통령 일정을 3번 소화하면' },
  시민: { ok: (s) => mediaOf(s).petDone >= 1, hint: '국민 청원을 한 번 들어주면' },
  군: { ok: (s) => s.officer.generals.length >= 1, hint: '장군을 한 명 이상 두면' },
  외국: { ok: (s) => mediaOf(s).summits >= 1, hint: '정상회담을 한 번 성공하면' },
  관료: { ok: (s) => sumVals(s.cabinet?.minWork as Record<string, number> | undefined) >= 1, hint: '부처 업무를 한 번 끝내면' },
  공공: { ok: (s) => civOf(s).done.length >= 3, hint: '연구를 3개 끝내면' },
  정적: {
    ok: (s) => (s.player.title ?? 0) >= ASK_RIVAL_TITLE && meetOf(s).met.length >= ASK_RIVAL_MET,
    hint: `호칭 「${TITLES[ASK_RIVAL_TITLE].name}」을 받고 다른 사람을 ${ASK_RIVAL_MET}명 이상 만나면`,
  },
};

export const askMeetCost = (s: GameState) => Math.round(budgetPerDay(s, s.player.countryId) * ASK_MEET_COST);

/** 이 사람을 만날 자리 */
export function askSpot(s: GameState, key: string): SpotId {
  const w = whoOf(s, key);
  if (!w) return 'meeting';
  if (w.group === '정적') return SPOT_IDS.find((id) => SPOTS[id].rivals.includes(w.title as RivalRole)) ?? 'meeting';
  return SPOT_IDS.find((id) => SPOTS[id].groups.includes(w.group as Group)) ?? 'meeting';
}

/** 만남을 청할 수 없는 까닭(없으면 null). lock=true 면 스토리·밸런스 잠금(힌트 보여 줌) */
export function canAskMeet(s: GameState, key: string): { why: string; lock: boolean } | null {
  const m = meetOf(s);
  const w = whoOf(s, key);
  if (!w) return { why: '지금은 만날 수 없는 사람이에요', lock: false };
  if (m.met.includes(key)) return { why: '이미 만난 사람이에요', lock: false };
  const g = GROUP_GATE[w.group];
  if (g && !g.ok(s)) return { why: `🔒 아직 만날 때가 아니에요. ${g.hint} 만남을 청할 수 있어요`, lock: true };
  if (m.card) return { why: '지금 다른 만남이 열려 있어요', lock: false };
  const today = m.day === dayOf(s.worldMs) ? m.today : 0;
  if (today >= MEET_DAY_MAX) return { why: `오늘 만남 ${MEET_DAY_MAX}번을 다 했어요. 내일 다시 청해 보세요`, lock: false };
  const gap = (m.askMs ?? -Infinity) + ASK_MEET_GAP_MS - s.worldMs;
  if (gap > 0) return { why: `만남은 1시간에 한 번 청할 수 있어요(${Math.ceil(gap / 60e3)}분 남음)`, lock: false };
  const cost = askMeetCost(s);
  if ((s.nations[s.player.countryId]?.treasury ?? 0) < cost) return { why: `나라 예산 ${cost.toLocaleString('ko-KR')} 필요`, lock: false };
  return null;
}

/** 만남 청하기: 예산으로 자리를 마련하면 그 사람 만남 카드가 바로 열림 */
export function askMeet(s: GameState, key: string): GameState {
  if (canAskMeet(s, key)) return s;
  const me = s.player.countryId;
  const cost = askMeetCost(s);
  const m0 = meetOf(s);
  const day = dayOf(s.worldMs);
  const spot = askSpot(s, key);
  const m: MeetState = {
    ...m0,
    day,
    today: (m0.day === day ? m0.today : 0) + 1,
    askMs: s.worldMs,
    card: { key: key as MeetKey, spot, step: m0.times[key] ?? 0, atMs: s.worldMs, untilMs: s.worldMs + CARD_WAIT_MS },
  };
  return { ...s, meet: m, nations: { ...s.nations, [me]: { ...s.nations[me], treasury: s.nations[me].treasury - cost } } };
}
