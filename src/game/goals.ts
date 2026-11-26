// 루비 얻는 길: 매일 할 일 3개 + 업적, 그리고 루비 상점.
// 할 일·업적 진행은 바뀌기 전·후 상태를 비교해서 센다(실시간·꺼 둔 동안·버튼 모두 같은 함수).
import { RESOURCES } from '../data/economy';
import { TITLES } from '../data/ranks';
import { CITIES, FRONT } from '../data/cities';
import { DRILL_MAX, DRILL_REFILL_MS, drillsNow } from './officer';
import { civOf, myIslands } from './civ';
import { assemblyOf } from './assembly';
import { annexedCount } from './annex';
import { cabinetOf, ministerCount } from './cabinet';
import { mediaOf } from './media';
import { scheduleOf } from './schedule';
import { presOf } from './approval';
import { favorOf } from './civ';
import { COUNTRIES } from '../data/world';
import type { OriginId } from './origin';
import { Rng } from './rng';
import type { GameState } from './state';

const DAY = 24 * 3600e3;

/** 세는 일 */
export type Count =
  | 'salary' // 봉급 받기
  | 'train' // 훈련 끝내기
  | 'merit' // 임무·전투에서 공훈 얻기
  | 'recruit' // 부대 모집 완료
  | 'research' // 연구 끝내기
  | 'pact' // 협정·무역 계약 맺기
  | 'chore' // 내정 일 시작
  | 'vote' // 국제 회의 투표
  | 'capture' // 도시 차지
  | 'rank' // 등급 오르기
  | 'island' // 분쟁 지역 차지
  | 'event' // 돌발 사건 고르기
  | 'spy' // 첩보 작전 성공
  | 'star3' // 훈련 별 3개(11-26)
  | 'annex' // 점령 도시 편입 완료(11-26)
  | 'facUp'; // 시설·부처 건물 한 단계 올림(11-26 보상 더 늘리기)

export interface DailyTask {
  id: Count;
  need: number;
  have: number;
  claimed: boolean;
}
export interface GoalsState {
  ruby: number;
  /** 매일 할 일의 날 번호(세계 시간 실제 하루) */
  day: number;
  daily: DailyTask[];
  /** 오늘 3개 다 하고 받은 보너스 */
  bonus: boolean;
  /** 연속으로 다 한 날 */
  streak: number;
  /** 전체 기록(업적용) */
  total: Partial<Record<Count, number>>;
  /** 받은 업적 */
  got: string[];
  /** 전과 보상: 점령·편입·등급·훈련 별 3개 등으로 쌓인 받을 루비(11-26) */
  spoils?: Spoil[];
  /** 작은 전과(훈련 별·전투 승리) 루비를 센 날과 그날 쌓인 양(하루 상한) */
  spoilDay?: number;
  spoilSmall?: number;
  /** 작은 전과로 그날 받은 가속권(하루 상한) */
  spoilBoost?: number;
  /** 봉급 받기로 그날 받은 루비·가속권(하루 상한, 11-26) */
  payDay?: number;
  payRuby?: number;
  payBoost?: number;
}
export interface Spoil {
  k: SpoilKind;
  n: number;
  ruby: number;
  boosts?: number;
}

export const DAILY_RUBY = 20; // 11-26 보상 늘리기: 10 → 15 → 20
export const DAILY_BONUS_RUBY = 40;
export const DAILY_BONUS_BOOSTS = 4;
/** 하루 할 일 수(11-26: 3 → 4) */
export const DAILY_COUNT = 4;

export const DAILY_POOL: Array<{ id: Count; name: string; icon: string; need: number }> = [
  { id: 'salary', name: '봉급 받기', icon: '💵', need: 2 },
  { id: 'train', name: '훈련 끝내기', icon: '🎯', need: 2 },
  { id: 'merit', name: '임무·전투 이기기', icon: '🎖️', need: 1 },
  { id: 'recruit', name: '부대 모집 완료', icon: '🪖', need: 2 },
  { id: 'chore', name: '내정 일 시작', icon: '🏗️', need: 1 },
  { id: 'pact', name: '협정·무역 계약 맺기', icon: '🤝', need: 1 },
  { id: 'vote', name: '국제 회의 투표', icon: '🏛️', need: 1 },
  { id: 'event', name: '돌발 사건 해결', icon: '⚡', need: 1 },
  { id: 'spy', name: '첩보 작전 성공', icon: '🕵️', need: 1 },
  { id: 'research', name: '연구 끝내기', icon: '🔬', need: 1 },
  { id: 'star3', name: '훈련 별 3개 받기', icon: '⭐', need: 1 },
  { id: 'facUp', name: '시설·청사 올리기', icon: '🏗️', need: 1 },
];

// ── 전과 보상(11-26 루비 얻는 곳 늘리기) ──
// 큰 일(점령·편입·등급)은 그때마다, 작은 일(훈련 별 3개·전투 승리)은 하루 상한까지 루비가 쌓이고, 상점에서 받는다.
export type SpoilKind = 'capture' | 'annex' | 'rank' | 'research' | 'facUp' | 'event' | 'spy' | 'pact' | 'star3' | 'merit';
export const SPOILS: Record<SpoilKind, { icon: string; name: string; ruby: number; boosts?: number; small?: boolean }> = {
  capture: { icon: '🏴', name: '도시 점령', ruby: 12, boosts: 2 },
  annex: { icon: '🗳️', name: '점령 도시 편입', ruby: 18, boosts: 3 },
  rank: { icon: '⭐', name: '호칭 오름', ruby: 15, boosts: 3 },
  research: { icon: '🔬', name: '연구 끝', ruby: 4, boosts: 1 },
  facUp: { icon: '🏗️', name: '시설·청사 올림', ruby: 3, boosts: 1, small: true },
  event: { icon: '⚡', name: '돌발 사건 해결', ruby: 3, boosts: 1, small: true },
  spy: { icon: '🕵️', name: '첩보 작전 성공', ruby: 3, small: true },
  pact: { icon: '🤝', name: '협정·무역 계약', ruby: 3, small: true },
  star3: { icon: '🎯', name: '훈련 별 3개', ruby: 3, small: true },
  merit: { icon: '🎖️', name: '임무·전투 승리', ruby: 3, small: true },
};
/** 작은 전과 루비 하루 상한(11-26: 12 → 30) */
export const SPOIL_SMALL_CAP = 30;
/** 작은 전과 가속권 하루 상한 */
export const SPOIL_SMALL_BOOST_CAP = 6;
/** 업적 가속권: 루비 20마다 1장(적어도 1장) */
export const achBoosts = (a: { ruby: number }) => Math.max(1, Math.round(a.ruby / 20));
export const dailyInfo = (id: Count) => DAILY_POOL.find((d) => d.id === id)!;

export interface Achievement {
  id: string;
  name: string;
  icon: string;
  text: string;
  ruby: number;
  /** 진행(현재, 목표) */
  prog: (s: GameState, g: GoalsState) => [number, number];
  /** 이 출신 지도자에게만 보이는 전용 업적(11-23) */
  origin?: OriginId;
}
const t = (g: GoalsState, k: Count) => g.total[k] ?? 0;
const ACH = (id: string, name: string, icon: string, text: string, ruby: number, prog: Achievement['prog']): Achievement => ({ id, name, icon, text, ruby, prog });
export const ACHIEVEMENTS: Achievement[] = [
  ACH('pay1', '첫 월급날', '💵', '봉급 처음 받기', 10, (_, g) => [t(g, 'salary'), 1]),
  ACH('train10', '땀 흘린 지도자', '🎯', '훈련 10번 끝내기', 30, (_, g) => [t(g, 'train'), 10]),
  ACH('train50', '훈련 교관', '🏅', '훈련 50번 끝내기', 80, (_, g) => [t(g, 'train'), 50]),
  ACH('merit10', '전장의 지휘관', '🎖️', '임무·전투 10번 이기기', 40, (_, g) => [t(g, 'merit'), 10]),
  ACH('army20', '든든한 군대', '🪖', '부대 20개 모집', 40, (s) => [Object.values(s.economy.army).reduce((a, b) => a + b, 0), 20]),
  ACH('army100', '대군', '🛡️', '부대 100개 모집', 100, (s) => [Object.values(s.economy.army).reduce((a, b) => a + b, 0), 100]),
  ACH('tech10', '연구 강국', '🔬', '연구 10개 끝내기', 50, (s) => [civOf(s).done.length, 10]),
  ACH('pact5', '외교의 달인', '🤝', '협정·무역 계약 5번 맺기', 40, (_, g) => [t(g, 'pact'), 5]),
  ACH('vote5', '회의장 단골', '🏛️', '국제 회의 투표 5번', 30, (_, g) => [t(g, 'vote'), 5]),
  ACH('city1', '첫 점령', '🏴', '다른 나라 도시 처음 차지하기', 50, (_, g) => [t(g, 'capture'), 1]),
  ACH('city5', '정복자', '🗺️', '다른 나라 도시 5개 차지하기', 120, (_, g) => [t(g, 'capture'), 5]),
  ACH('island1', '섬의 친구', '🏝️', '분쟁 지역 하나 차지하기', 40, (s) => [myIslands(s).length, 1]),
  ACH('rank5', '존경받는 길', '⭐', `${TITLES[8].name} 호칭 얻기`, 50, (s) => [s.player.title ?? 0, 8]),
  ACH('rankMax', '전설', '👑', `${TITLES[TITLES.length - 1].name} 호칭 얻기`, 200, (s) => [s.player.title ?? 0, TITLES.length - 1]),
  ACH('event5', '위기 해결사', '⚡', '돌발 사건 5번 직접 해결', 40, (_, g) => [t(g, 'event'), 5]),
  ACH('spy5', '그림자 사령관', '🕵️', '첩보 작전 5번 성공', 50, (_, g) => [t(g, 'spy'), 5]),
  ACH('streak3', '성실한 지도자', '📅', '매일 할 일 3일 연속 다 하기', 60, (_, g) => [g.streak, 3]),
  // 11-23 대통령식 내정
  ACH('plan20', '바쁜 대통령', '🗓️', '대통령 일정 20번 소화', 40, (s) => [scheduleOf(s).total, 20]),
  ACH('cab5', '내각 완성', '🏛️', '장관 5명 앉히기', 60, (s) => [s.cabinet ? ministerCount(cabinetOf(s)) : 0, 5]),
  ACH('law3', '입법의 달인', '📜', '법안 3개 국회 통과', 50, (s) => [assemblyOf(s).passed ?? 0, 3]),
  ACH('conf1', '국민의 재신임', '🗳️', '재신임 국민투표 통과', 80, (s) => [assemblyOf(s).confWins, 1]),
  ACH('pet5', '국민의 목소리', '📝', '국민 청원 5개 들어주기', 40, (s) => [mediaOf(s).petDone, 5]),
  ACH('summit3', '정상 외교', '🤝', '정상회담 3번 성공', 50, (s) => [mediaOf(s).summits, 3]),
  // 11-26 루비 얻는 곳 늘리기
  ACH('star3-5', '명사수', '🎯', '훈련 별 3개 5번 받기', 30, (_, g) => [t(g, 'star3'), 5]),
  ACH('star3-30', '완벽주의자', '🌟', '훈련 별 3개 30번 받기', 80, (_, g) => [t(g, 'star3'), 30]),
  ACH('merit50', '백전노장', '⚔️', '임무·전투 50번 이기기', 100, (_, g) => [t(g, 'merit'), 50]),
  ACH('city10', '대정복자', '🌍', '다른 나라 도시 10개 차지하기', 150, (_, g) => [t(g, 'capture'), 10]),
  ACH('annex1', '새 영토', '🗳️', '점령 도시 처음 편입하기', 60, (_, g) => [t(g, 'annex'), 1]),
  ACH('annex3', '영토 확장', '🗺️', '점령 도시 3개 편입하기', 120, (_, g) => [t(g, 'annex'), 3]),
  ACH('tech30', '기술 선진국', '🧪', '연구 30개 끝내기', 100, (s) => [civOf(s).done.length, 30]),
  ACH('island3', '바다의 주인', '⚓', '분쟁 지역 3곳 차지하기', 80, (s) => [myIslands(s).length, 3]),
  // 11-26 보상 더 늘리기
  ACH('pay30', '꼬박꼬박 월급날', '💵', '봉급 30번 받기', 60, (_, g) => [t(g, 'salary'), 30]),
  ACH('fac1', '첫 삽', '🏗️', '시설·청사 처음 올리기', 20, (_, g) => [t(g, 'facUp'), 1]),
  ACH('fac10', '건설 대통령', '🏗️', '시설·청사 10번 올리기', 60, (_, g) => [t(g, 'facUp'), 10]),
  ACH('fac40', '나라를 짓는 사람', '🏙️', '시설·청사 40번 올리기', 150, (_, g) => [t(g, 'facUp'), 40]),
  ACH('research5', '연구 시작', '🔬', '연구 5개 끝내기', 30, (s) => [civOf(s).done.length, 5]),
  ACH('streak7', '한결같은 지도자', '🗓️', '매일 할 일 7일 연속 다 하기', 120, (_, g) => [g.streak, 7]),
  ...ORIGIN_ACH(),
];

/** 출신 전용 업적 16개(그 출신일 때만 보임) */
function ORIGIN_ACH(): Achievement[] {
  const me = (s: GameState) => s.player.countryId;
  const O = (origin: OriginId, id: string, name: string, icon: string, text: string, prog: Achievement['prog']): Achievement => ({ ...ACH(`o-${id}`, name, icon, `[출신] ${text}`, 80, prog), origin });
  return [
    O('econ', 'econ', '나라 곳간지기', '💼', '나라 예산 금고 50,000 모으기', (s) => [Math.floor(s.nations[me(s)]?.treasury ?? 0), 50000]),
    O('general', 'general', '별들의 사령관', '⭐', '장군 4명 두기', (s) => [s.officer.generals.length, 4]),
    O('scientist', 'scientist', '과학 대국', '🔬', '연구 15개 끝내기', (s) => [civOf(s).done.length, 15]),
    O('athlete', 'athlete', '국민 영웅', '🏅', '지지도 80 넘기기', (s) => [Math.floor(presOf(s).approval), 80]),
    O('diplomat', 'diplomat', '세계의 중재자', '🌐', '정상회담 5번 성공', (s) => [mediaOf(s).summits, 5]),
    O('spy', 'spy', '보이지 않는 손', '🕵️', '첩보 작전 10번 성공', (_, g) => [t(g, 'spy'), 10]),
    O('lawyer', 'lawyer', '법치의 수호자', '⚖️', '법안 5개 국회 통과', (s) => [assemblyOf(s).passed ?? 0, 5]),
    O('chaebol', 'chaebol', '부자 나라', '🏢', '나라 예산 금고 150,000 모으기', (s) => [Math.floor(s.nations[me(s)]?.treasury ?? 0), 150000]),
    O('broadcaster', 'broadcaster', '국민 MC', '🎙️', '명성 1,000 쌓기', (s) => [Math.floor(s.officer.fame), 1000]),
    O('activist', 'activist', '광장의 목소리', '✊', '국민 청원 10개 들어주기', (s) => [mediaOf(s).petDone, 10]),
    O('doctor', 'doctor', '건강한 나라', '🩺', '내 도시 평균 민심 80 넘기기', (s) => {
      const c = civOf(s);
      const own = CITIES.filter((x) => s.world.owner[x.id] === me(s) && c.cities[x.id]);
      return [own.length ? Math.floor(own.reduce((a, x) => a + c.cities[x.id].loyalty, 0) / own.length) : 0, 80];
    }),
    O('mayor', 'mayor', '도시의 아버지', '🏙️', '도시 10개 갖기', (s) => [CITIES.filter((x) => s.world.owner[x.id] === me(s)).length, 10]),
    O('commando', 'commando', '전설의 특수요원', '🪂', '임무·전투 30번 이기기', (_, g) => [t(g, 'merit'), 30]),
    O('admiral', 'admiral', '바다의 지배자', '🚢', '다른 나라 도시 3개 차지하기', (_, g) => [t(g, 'capture'), 3]),
    O('commoner', 'commoner', '국민이 뽑은 대통령', '🌾', '재신임 국민투표 2번 통과', (s) => [assemblyOf(s).confWins, 2]),
    O('religious', 'religious', '화해의 사도', '🙏', '호감 50 넘는 나라 5개', (s) => [COUNTRIES.filter((c) => c.id !== me(s) && favorOf(s, c.id) >= 50).length, 5]),
  ];
}
/** 이 지도자에게 보이는 업적(출신 전용은 그 출신만) */
export const achList = (s: GameState) => ACHIEVEMENTS.filter((a) => !a.origin || a.origin === s.player.origin);

export const dayOf = (worldMs: number) => Math.floor(worldMs / DAY);

function rollDaily(seed: number, day: number): DailyTask[] {
  const rng = new Rng(((day + 1) * 2654435761 + seed) >>> 0);
  const pool = [...DAILY_POOL];
  const out: DailyTask[] = [];
  while (out.length < DAILY_COUNT && pool.length) {
    const p = pool.splice(Math.floor(rng.next() * pool.length), 1)[0];
    out.push({ id: p.id, need: p.need, have: 0, claimed: false });
  }
  return out;
}

export function newGoals(s: Pick<GameState, 'worldMs' | 'world'>): GoalsState {
  const day = dayOf(s.worldMs);
  return { ruby: 0, day, daily: rollDaily(s.world.seed, day), bonus: false, streak: 0, total: {}, got: [] };
}
export function goalsOf(s: GameState): GoalsState {
  return s.goals ?? newGoals(s);
}
export const rubyOf = (s: GameState) => s.goals?.ruby ?? 0;

/** 날이 바뀌었으면 새 할 일(어제 다 했으면 연속 +1, 못 했으면 0) */
function rollover(s: GameState, g: GoalsState): GoalsState {
  const day = dayOf(s.worldMs);
  if (day === g.day) return g;
  const keep = day === g.day + 1 && g.bonus ? g.streak : 0;
  return { ...g, day, daily: rollDaily(s.world.seed, day), bonus: false, streak: keep };
}

const sum = (r: Record<string, number> | undefined) => Object.values(r ?? {}).reduce((a, b) => a + b, 0);

/** 앞(b) → 뒤(a) 사이에 한 일을 센다 */
export function countDiff(b: GameState, a: GameState): Partial<Record<Count, number>> {
  const out: Partial<Record<Count, number>> = {};
  const add = (k: Count, v: number) => v > 0 && (out[k] = (out[k] ?? 0) + v);
  if (a.player.salary > b.player.salary + 0.5) add('salary', 1);
  add('train', sum(a.officer.mastery) - sum(b.officer.mastery));
  if (a.officer.totalMerit > b.officer.totalMerit + 0.5) add('merit', 1);
  add('recruit', sum(a.economy.army) - sum(b.economy.army));
  const cb = civOf(b);
  const ca = civOf(a);
  add('research', ca.done.length - cb.done.length);
  const newPacts = ca.agreements.filter((x) => !cb.agreements.some((y) => y.id === x.id)).length;
  const newContracts = (a.economy.contracts ?? []).filter((x) => !(b.economy.contracts ?? []).some((y) => y.id === x.id)).length;
  add('pact', newPacts + newContracts);
  if (a.economy.chore && (!b.economy.chore || b.economy.chore.endMs !== a.economy.chore.endMs) && a.economy.chore.endMs > a.worldMs) add('chore', 1);
  if (ca.council.open && ca.council.open.vote !== null && cb.council.open?.id === ca.council.open.id && cb.council.open.vote === null) add('vote', 1);
  const me = a.player.countryId;
  if (b.player.countryId === me)
    add('capture', FRONT.filter((c) => c.home !== me && a.world.owner[c.id] === me && b.world.owner[c.id] !== me).length);
  add('rank', (a.player.title ?? 0) - (b.player.title ?? 0));
  add('event', (a.crisis?.solved ?? 0) - (b.crisis?.solved ?? 0));
  add('spy', (a.spy?.ok ?? 0) - (b.spy?.ok ?? 0));
  add('star3', sum(a.officer.perfect) - sum(b.officer.perfect));
  if (b.player.countryId === me) add('annex', annexedCount(a) - annexedCount(b));
  const lv = (x: GameState) => Object.values(x.economy.buildings ?? {}).reduce((n, y) => n + (y?.level ?? 0), 0) + sum(x.cabinet?.minLv as Record<string, number> | undefined) + sum(x.cabinet?.fac);
  add('facUp', lv(a) - lv(b));
  return out;
}

/** 바뀌기 전·후를 비교해 할 일·업적 진행을 반영 */
export function trackGoals(b: GameState | null, a: GameState): GameState {
  if (!b || b === a || b.player.countryId !== a.player.countryId) return a;
  const d = countDiff(b, a);
  const g0 = goalsOf(a);
  const g = rollover(a, g0);
  if (!Object.keys(d).length) return g === g0 && a.goals ? a : { ...a, goals: g };
  const total = { ...g.total };
  for (const [k, v] of Object.entries(d)) total[k as Count] = (total[k as Count] ?? 0) + v;
  const daily = g.daily.map((x) => (d[x.id] ? { ...x, have: Math.min(x.need, x.have + d[x.id]!) } : x));
  return { ...a, goals: addSpoils(a, { ...g, total, daily }, d) };
}

/** 한 일에서 전과 루비를 쌓는다(작은 일은 하루 상한) */
function addSpoils(s: GameState, g: GoalsState, d: Partial<Record<Count, number>>): GoalsState {
  const today = dayOf(s.worldMs);
  const same = g.spoilDay === today;
  let small = same ? (g.spoilSmall ?? 0) : 0;
  let smallB = same ? (g.spoilBoost ?? 0) : 0;
  let spoils = g.spoils ?? [];
  let changed = false;
  for (const k of Object.keys(SPOILS) as SpoilKind[]) {
    const n = d[k] ?? 0;
    if (n <= 0) continue;
    const info = SPOILS[k];
    let ruby = n * info.ruby;
    let boosts = n * (info.boosts ?? 0);
    if (info.small) {
      ruby = Math.min(ruby, Math.max(0, SPOIL_SMALL_CAP - small));
      small += ruby;
      boosts = Math.min(boosts, Math.max(0, SPOIL_SMALL_BOOST_CAP - smallB));
      smallB += boosts;
    }
    if (ruby <= 0 && boosts <= 0) continue;
    changed = true;
    const i = spoils.findIndex((x) => x.k === k);
    spoils = i >= 0 ? spoils.map((x, j) => (j === i ? { ...x, n: x.n + n, ruby: x.ruby + ruby, boosts: (x.boosts ?? 0) + boosts } : x)) : [...spoils, { k, n, ruby, boosts }];
  }
  if (!changed && same) return g;
  return { ...g, spoils, spoilDay: today, spoilSmall: small, spoilBoost: smallB };
}
export const spoilRuby = (s: GameState) => (goalsOf(s).spoils ?? []).reduce((a, x) => a + x.ruby, 0);
export const spoilBoosts = (s: GameState) => (goalsOf(s).spoils ?? []).reduce((a, x) => a + (x.boosts ?? 0), 0);
export function claimSpoils(s: GameState): GameState {
  const g = goalsOf(s);
  const r = spoilRuby(s);
  const b = spoilBoosts(s);
  if (!r && !b) return s;
  return { ...s, goals: { ...g, ruby: g.ruby + r, spoils: [] }, officer: { ...s.officer, boosts: (s.officer.boosts ?? 0) + b } };
}

/** 모두받기: 다 한 매일 할 일·업적·전과 보상을 한 번에(11-26) */
export function claimAll(s: GameState): GameState {
  let ns = s;
  goalsOf(ns).daily.forEach((_, i) => (ns = claimDaily(ns, i)));
  for (const a of achList(ns)) if (achState(ns, a).ready) ns = claimAch(ns, a.id);
  return claimSpoils(ns);
}
/** 모두받기로 받을 것 미리 보기 */
export function claimAllPreview(s: GameState): { ruby: number; boosts: number; count: number } {
  const a = claimAll(s);
  return { ruby: rubyOf(a) - rubyOf(s), boosts: (a.officer.boosts ?? 0) - (s.officer.boosts ?? 0), count: goalsReady(s) };
}

/** 시간만 흐른 경우에도 날 바꾸기 */
export function goalsTick(s: GameState): GameState {
  const g0 = goalsOf(s);
  const g = rollover(s, g0);
  return g === g0 && s.goals ? s : { ...s, goals: g };
}

export function claimDaily(s: GameState, i: number): GameState {
  const g = rollover(s, goalsOf(s));
  const x = g.daily[i];
  if (!x || x.claimed || x.have < x.need) return s;
  const daily = g.daily.map((y, j) => (j === i ? { ...y, claimed: true } : y));
  let ruby = g.ruby + DAILY_RUBY;
  let bonus = g.bonus;
  let streak = g.streak;
  let boosts = s.officer.boosts ?? 0;
  if (!bonus && daily.every((y) => y.claimed)) {
    bonus = true;
    streak += 1;
    ruby += DAILY_BONUS_RUBY;
    boosts += DAILY_BONUS_BOOSTS;
  }
  return { ...s, goals: { ...g, daily, ruby, bonus, streak }, officer: { ...s.officer, boosts } };
}

export function achState(s: GameState, a: Achievement): { have: number; need: number; ready: boolean; got: boolean } {
  const g = goalsOf(s);
  const [have, need] = a.prog(s, g);
  const got = g.got.includes(a.id);
  return { have: Math.min(have, need), need, ready: !got && have >= need, got };
}
export function claimAch(s: GameState, id: string): GameState {
  const a = achList(s).find((x) => x.id === id);
  if (!a || !achState(s, a).ready) return s;
  const g = goalsOf(s);
  return { ...s, goals: { ...g, ruby: g.ruby + a.ruby, got: [...g.got, id] }, officer: { ...s.officer, boosts: (s.officer.boosts ?? 0) + achBoosts(a) } };
}
/** 받을 수 있는 보상 수(빨간 점) */
export function goalsReady(s: GameState): number {
  const g = goalsOf(s);
  return g.daily.filter((x) => !x.claimed && x.have >= x.need).length + achList(s).filter((a) => achState(s, a).ready).length + (spoilRuby(s) > 0 || spoilBoosts(s) > 0 ? 1 : 0);
}

// ── 루비 상점 ──
export interface ShopItem {
  id: string;
  name: string;
  icon: string;
  text: string;
  price: number;
  can?: (s: GameState) => string | null;
  give: (s: GameState) => GameState;
}
const giveRes = (s: GameState, n: number): GameState => {
  const stock = { ...s.economy.stock };
  for (const r of ['강철', '석유', '알루미늄', '구리'] as const) stock[r] = (stock[r] ?? 0) + n;
  return { ...s, economy: { ...s.economy, stock } };
};
export const SHOP: ShopItem[] = [
  { id: 'boost1', name: '가속권 1장', icon: '🎫', text: '기다리는 시간 30분 줄이기', price: 5, give: (s) => ({ ...s, officer: { ...s.officer, boosts: (s.officer.boosts ?? 0) + 1 } }) },
  { id: 'boost10', name: '가속권 10장', icon: '🎟️', text: '10% 싸게 · 5시간치', price: 45, give: (s) => ({ ...s, officer: { ...s.officer, boosts: (s.officer.boosts ?? 0) + 10 } }) },
  {
    id: 'drill',
    name: '훈련 일정 1개 채우기',
    icon: '🎯',
    text: '4시간 기다리지 않고 바로 훈련 1번 더',
    price: 8,
    can: (s) => (drillsNow(s.officer, s.worldMs).count >= DRILL_MAX ? '훈련 일정이 이미 가득해요' : null),
    give: (s) => {
      const o = s.officer;
      const { count } = drillsNow(o, s.worldMs);
      const part = (s.worldMs - o.drillAnchorMs) % DRILL_REFILL_MS;
      return { ...s, officer: { ...o, drills: count + 1, drillAnchorMs: s.worldMs - (count + 1 >= DRILL_MAX ? 0 : part) } };
    },
  },
  { id: 'res', name: '자원 상자', icon: '📦', text: '강철·석유·알루미늄·구리 각 100', price: 25, give: (s) => giveRes(s, 100) },
  {
    id: 'budget',
    name: '긴급 나라 예산',
    icon: '💰',
    text: '나라 예산 +5,000',
    price: 30,
    give: (s) => {
      const me = s.player.countryId;
      return { ...s, nations: { ...s.nations, [me]: { ...s.nations[me], treasury: s.nations[me].treasury + 5000 } } };
    },
  },
  {
    id: 'rare',
    name: '첨단 자원 상자',
    icon: '💠',
    text: '반도체·희토류·리튬·갈륨 각 30',
    price: 40,
    give: (s) => {
      const stock = { ...s.economy.stock };
      for (const r of ['반도체', '희토류', '리튬', '갈륨'] as const) if (RESOURCES.includes(r)) stock[r] = (stock[r] ?? 0) + 30;
      return { ...s, economy: { ...s.economy, stock } };
    },
  },
];
export function canBuy(s: GameState, id: string): string | null {
  const it = SHOP.find((x) => x.id === id);
  if (!it) return '없는 물건';
  if (rubyOf(s) < it.price) return `루비 ${it.price} 필요`;
  return it.can?.(s) ?? null;
}
export function buy(s: GameState, id: string): GameState {
  if (canBuy(s, id)) return s;
  const it = SHOP.find((x) => x.id === id)!;
  const g = goalsOf(s);
  return it.give({ ...s, goals: { ...g, ruby: g.ruby - it.price } });
}
