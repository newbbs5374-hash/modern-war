// 문화: 문화 시설을 단계별로 키우고, 걸작을 모으고, 행사를 열어 우리 문화를 세계에 퍼뜨림(문명 게임의 관광 참고).
//  - 🎨 문화(시간당): 우리 나라 문화 점수(걸작 사기에 씀)와 누적 문화가 쌓임
//  - ✈️ 관광(시간당): 살아 있는 다른 나라마다 "우리 영향력"이 쌓임(전쟁 중인 나라엔 안 퍼짐)
//  - 그 나라 영향력 ≥ 그 나라가 스스로 쌓은 문화 → 그 나라에서 "문화 우세"
//  - 문화 승리(제안): 다른 나라 2/3 이상에서 문화 우세 + 5단계 시설 2곳 + 최고 등급, 이 상태를 7일 지킴
import { COUNTRIES, countryById } from '../data/world';
import { RANKS } from '../data/ranks';
import type { Res } from '../data/economy';
import {
  BUILD_TEAMS, CULTURE_BASE, CULTURE_EVENTS, CULTURE_SPECIAL, CULTURE_WIN_DAYS, CULTURE_WIN_SHARE, CULTURE_WIN_TOP, HERITAGE_COST_MULT,
  LEVEL_COST, LEVEL_HOURS, LEVEL_POWER, PACT_COST, PACT_MAX, PACT_MULT, SPECIAL_BONUS, VENUES, VENUE_IDS, VENUE_MAX, WORK_KINDS,
  ARCHITECT_FAST, TALENT_MONEY, ATHLETE_EVENT, ATHLETE_MOOD, COURSE_SLOTS, CREATE_HOURS, GRADES, STAR_KINDS, STAR_MAX, TALENT_RATE, THEME_MIN, THEME_MULT, WORKS,
  courseById, cultureEventById, levelRes, starCost, starKindById, venueById, workByName, workCost, workKindById,
  type CourseId, type CultureEventId, type Grade, type StarKind, type VenueId, type WorkDef, type WorkKind,
} from '../data/culture';
import { Rng } from './rng';
import type { GameState } from './state';
import { isAlive, relationOf, type WorldEvent } from './world';
import { addFavorNote, favorOf } from './civ';
import { addPresMod } from './approval';
import { ministryPower } from './cabinet';
import { pushReport } from './report';

const H = 3600e3;
const VICTORY_RANK = RANKS.length - 1;

export interface CultureBuild {
  venue: VenueId;
  to: number;
  endMs: number;
}
export interface CultureEventRun {
  id: CultureEventId;
  target?: string;
  startMs: number;
  endMs: number;
}
/** 스타(문화 인물) */
export interface CultureStar {
  id: number;
  kind: StarKind;
  name: string;
  /** 지금까지 만든 걸작 수 */
  made: number;
  /** 만드는 중인 걸작 */
  job?: { kind: WorkKind; endMs: number } | null;
  /** 11-28 해외 진출 중(그 나라에 우리 문화가 더 퍼짐) */
  abroad?: { to: string; untilMs: number } | null;
}
export interface CultureState {
  /** 마지막으로 계산한 세계 시각 */
  lastMs: number;
  venues: Record<VenueId, number>;
  builds: CultureBuild[];
  /** 쓸 수 있는 문화 점수 */
  points: number;
  /** 우리 나라가 쌓은 문화(누적) */
  total: number;
  /** 나라 → 우리 문화 영향력(누적) */
  infl: Record<string, number>;
  /** 나라 → 그 나라가 스스로 쌓은 문화(누적) */
  ai: Record<string, number>;
  /** 걸어 둔 걸작 이름 */
  works: Record<WorkKind, string[]>;
  event: CultureEventRun | null;
  /** 행사 → 다시 열 수 있는 시각 */
  cool: Partial<Record<CultureEventId, number>>;
  /** 문화 교류 협약을 맺은 나라 */
  pacts: string[];
  /** 문화 승리 조건을 채운 시각 */
  winSinceMs: number | null;
  /** 지금까지 번 관광 수입 */
  income: number;
  log: string[];
  /** (11-25) 스타별 인재 점수 · 데려온 스타 · 열어 둔 관광 코스 — 옛 저장엔 없음 */
  talent?: Partial<Record<StarKind, number>>;
  stars?: CultureStar[];
  starNext?: number;
  courses?: CourseId[];
}

/** AI 나라 문화: 처음 쌓여 있는 양, 시간당 기본, 하루마다 느는 양 */
export const AI_START = 2500;
export const AI_RATE = 34;
export const AI_GROW_PER_DAY = 0.45;
/** 관광 1점마다 시간당 관광 수입(나라 예산) */
export const TOUR_INCOME = 1.5;

export function newCulture(s?: Pick<GameState, 'worldMs' | 'player'>): CultureState {
  const ai: Record<string, number> = {};
  const infl: Record<string, number> = {};
  for (const c of COUNTRIES) {
    if (c.id === s?.player.countryId) continue;
    ai[c.id] = AI_START * (CULTURE_BASE[c.id] ?? 1);
    infl[c.id] = 0;
  }
  const venues = Object.fromEntries(VENUE_IDS.map((v) => [v, 0])) as Record<VenueId, number>;
  return { lastMs: s?.worldMs ?? 0, venues, builds: [], points: 0, total: 0, infl, ai, works: { relic: [], show: [], hit: [] }, event: null, cool: {}, pacts: [], winSinceMs: null, income: 0, log: [], talent: {}, stars: [], starNext: 1, courses: [] };
}
export const cultureOf = (s: GameState): CultureState => s.culture ?? newCulture(s);

const others = (s: GameState) => COUNTRIES.map((c) => c.id).filter((id) => id !== s.player.countryId && isAlive(s.world, id));
const atWarAny = (s: GameState) => others(s).some((id) => relationOf(s.world, s.player.countryId, id) === '전쟁');
const worksCount = (c: CultureState) => c.works.relic.length + c.works.show.length + c.works.hit.length;
export const starsOf = (c: CultureState) => c.stars ?? [];
export const coursesOf = (c: CultureState) => c.courses ?? [];
const starCount = (c: CultureState, k: StarKind) => starsOf(c).filter((x) => x.kind === k).length;
/** 만드는 중인 걸작 수(그 종류) */
const jobsOn = (c: CultureState, k?: WorkKind) => starsOf(c).filter((x) => x.job && (!k || x.job.kind === k)).length;

/** 걸작 정보(옛 저장의 모르는 이름은 보통 등급) */
export function workInfo(name: string, kind: WorkKind): WorkDef {
  return workByName(name) ?? { id: '', kind, name, grade: 'C', text: '' };
}
/** 테마 전시 완성: 칸이 3칸 이상이고 모두 찼는지 */
export function themeDone(c: CultureState, k: WorkKind): boolean {
  const slots = c.venues[workKindById(k).venue];
  return slots >= THEME_MIN && c.works[k].length >= slots;
}
/** 걸작 전체 효과(문화·관광·민심) */
export function worksPower(c: CultureState) {
  let cul = 0;
  let tour = 0;
  let mood = 0;
  for (const k of WORK_KINDS) {
    const m = themeDone(c, k.id) ? THEME_MULT : 1;
    for (const n of c.works[k.id]) {
      const g = GRADES[workInfo(n, k.id).grade];
      cul += g.cul * m;
      tour += g.tour * m;
      mood += g.mood;
    }
  }
  return { cul, tour, mood };
}
/** 열어 둔 관광 코스 효과 */
export function courseBonus(c: CultureState) {
  const b = { tour: 0, cul: 0, income: 0, mood: 0, event: 0 };
  for (const id of coursesOf(c)) {
    const d = courseById(id);
    b.tour += (d.tour ?? 0) + (d.perHit ?? 0) * c.works.hit.length;
    b.cul += d.cul ?? 0;
    b.income += d.income ?? 0;
    b.mood += d.mood ?? 0;
    b.event += d.eventPlus ?? 0;
  }
  return b;
}
export const courseSlots = (c: CultureState) => COURSE_SLOTS + (c.venues.park >= VENUE_MAX ? 1 : 0);

function venueMult(s: GameState, v: VenueId) {
  return CULTURE_SPECIAL[s.player.countryId]?.venue === v ? 1 + SPECIAL_BONUS : 1;
}
const kocis = (s: GameState) => 1 + ministryPower(s, 'kocis') * 0.1;

/** 시간당 문화 */
export function culturePerHour(s: GameState, c = cultureOf(s)): number {
  let v = 1;
  for (const d of VENUES) v += LEVEL_POWER[c.venues[d.id]] * d.cul * venueMult(s, d.id);
  v += worksPower(c).cul;
  return v * kocis(s) * (1 + courseBonus(c).cul);
}
/** 행사 덤을 뺀 시간당 관광 */
export function baseTourism(s: GameState, c = cultureOf(s)): number {
  let v = 0;
  for (const d of VENUES) v += LEVEL_POWER[c.venues[d.id]] * d.tour * venueMult(s, d.id);
  v += worksPower(c).tour;
  return v * kocis(s) * (1 + courseBonus(c).tour) * (atWarAny(s) ? 0.8 : 1);
}
/** 지금 시간당 관광(행사 덤 포함) */
export function tourismPerHour(s: GameState, c = cultureOf(s)): number {
  const ev = c.event && s.worldMs < c.event.endMs ? cultureEventById(c.event.id) : null;
  return baseTourism(s, c) * (1 + (ev?.boost ?? 0) * (1 + ATHLETE_EVENT * starCount(c, 'athlete') + courseBonus(c).event));
}
/** 그 나라에 퍼지는 배율(0 = 안 퍼짐) */
export function spreadMult(s: GameState, id: string, c = cultureOf(s)): number {
  const me = s.player.countryId;
  if (!isAlive(s.world, id)) return 0;
  if (relationOf(s.world, me, id) === '전쟁') return 0;
  let m = 1;
  if (c.pacts.includes(id)) m *= PACT_MULT;
  if ((s.economy.contracts ?? []).some((x) => x.country === id)) m *= 1.15;
  if (relationOf(s.world, me, id) === '연합') m *= 1.1;
  if (favorOf(s, id) >= 20) m *= 1.1;
  // 11-28 스타 해외 진출: 그 나라에 가 있는 스타마다 +25%
  m *= 1 + ABROAD_SPREAD * starsOf(c).filter((x) => x.abroad && x.abroad.to === id && x.abroad.untilMs > s.worldMs).length;
  return m;
}

// ── 11-28 국정 37 강화(문화·스타): 스타 해외 진출 ──
export const ABROAD_SPREAD = 0.25;
export const ABROAD_HOURS = 24;
export const ABROAD_COST = 1500;
export const isAbroad = (s: GameState, x: CultureStar) => !!x.abroad && x.abroad.untilMs > s.worldMs;
export function canSendAbroad(s: GameState, starId: number, to: string): string | null {
  const x = starsOf(cultureOf(s)).find((y) => y.id === starId);
  if (!x) return '없는 스타예요';
  if (x.job) return '작품을 만드는 중이에요';
  if (isAbroad(s, x)) return '이미 해외에 나가 있어요';
  if (to === s.player.countryId || !isAlive(s.world, to)) return '고를 수 없는 나라';
  if (relationOf(s.world, s.player.countryId, to) === '전쟁') return '전쟁 중인 나라에는 못 가요';
  if (treasury(s) < ABROAD_COST) return `나라 예산 ${ABROAD_COST.toLocaleString('ko-KR')} 필요`;
  return null;
}
export function sendAbroad(s: GameState, starId: number, to: string): GameState {
  if (canSendAbroad(s, starId, to)) return s;
  const ns = withC(pay(s, ABROAD_COST), (c) => {
    const x = (c.stars ?? []).find((y) => y.id === starId)!;
    x.abroad = { to, untilMs: s.worldMs + ABROAD_HOURS * H };
    c.log.unshift(`✈️ ${x.name}, ${countryById(to).name} 진출(${ABROAD_HOURS}시간)`);
  });
  return addFavorNote(ns, to, '우리 스타 방문', 2);
}
/** AI 나라가 스스로 쌓는 시간당 문화 */
export function aiCulturePerHour(s: GameState, id: string): number {
  const days = s.worldMs / (24 * H);
  return (CULTURE_BASE[id] ?? 1) * (AI_RATE + AI_GROW_PER_DAY * days);
}
/** 그 나라가 지금 몇 단계쯤의 문화 나라인지(1~5, 보여 주기용) */
export function aiStars(s: GameState, id: string): number {
  const v = cultureOf(s).ai[id] ?? 0;
  return Math.max(1, Math.min(5, Math.floor(Math.log2(Math.max(1, v / 2500)) + 1)));
}

export type Sway = '우세' | '퍼지는 중' | '안 퍼짐';
export interface CultureLine {
  id: string;
  infl: number;
  own: number;
  pct: number;
  sway: Sway;
  mult: number;
}
export function cultureLines(s: GameState): CultureLine[] {
  const c = cultureOf(s);
  return others(s).map((id) => {
    const infl = c.infl[id] ?? 0;
    const own = c.ai[id] ?? AI_START;
    const mult = spreadMult(s, id, c);
    return { id, infl, own, pct: Math.min(100, Math.round((infl / Math.max(1, own)) * 100)), sway: infl >= own ? '우세' : mult > 0 ? '퍼지는 중' : '안 퍼짐', mult };
  });
}
export function cultureProgress(s: GameState) {
  const lines = cultureLines(s);
  const c = cultureOf(s);
  const top = VENUE_IDS.filter((v) => c.venues[v] >= VENUE_MAX).length;
  const need = Math.ceil(lines.length * CULTURE_WIN_SHARE);
  const have = lines.filter((l) => l.sway === '우세').length;
  return { lines, have, need, total: lines.length, top, needTop: CULTURE_WIN_TOP, rankOk: s.player.rankIndex >= VICTORY_RANK };
}
export const cultureWinOk = (s: GameState) => {
  const p = cultureProgress(s);
  return p.total > 0 && p.have >= p.need && p.top >= p.needTop && p.rankOk;
};
export function cultureWinLeft(s: GameState): number | null {
  const w = cultureOf(s).winSinceMs;
  return w == null ? null : Math.max(0, w + CULTURE_WIN_DAYS * 24 * H - s.worldMs);
}

/* ───────── 바꾸기 ───────── */
function withC(s: GameState, f: (c: CultureState) => void): GameState {
  const o = cultureOf(s);
  const c: CultureState = {
    ...o,
    venues: { ...o.venues },
    builds: o.builds.map((b) => ({ ...b })),
    infl: { ...o.infl },
    ai: { ...o.ai },
    works: { relic: [...o.works.relic], show: [...o.works.show], hit: [...o.works.hit] },
    talent: { ...(o.talent ?? {}) },
    stars: starsOf(o).map((x) => ({ ...x, job: x.job ? { ...x.job } : null })),
    starNext: o.starNext ?? 1,
    courses: [...coursesOf(o)],
    cool: { ...o.cool },
    pacts: [...o.pacts],
    log: [...o.log],
  };
  f(c);
  c.log = c.log.slice(0, 30);
  return { ...s, culture: c };
}
function pay(s: GameState, money: number, res: Partial<Record<Res, number>> = {}): GameState {
  const me = s.player.countryId;
  const stock = { ...s.economy.stock };
  for (const [r, n] of Object.entries(res)) stock[r as Res] -= n!;
  return { ...s, nations: { ...s.nations, [me]: { ...s.nations[me], treasury: s.nations[me].treasury - money } }, economy: { ...s.economy, stock } };
}
function addEvent(s: GameState, text: string): GameState {
  const ev: WorldEvent = { t: s.worldMs, kind: '외교', text, mine: true };
  return { ...s, world: { ...s.world, events: [ev, ...s.world.events].slice(0, 200) } };
}
const treasury = (s: GameState) => s.nations[s.player.countryId]?.treasury ?? 0;

/** 다음 단계 값 */
export function upgradeCost(v: VenueId, to: number, s?: GameState) {
  const d = venueById(v);
  const m = v === 'heritage' ? HERITAGE_COST_MULT : 1;
  const fast = s ? 1 - ARCHITECT_FAST * starCount(cultureOf(s), 'architect') : 1;
  return { money: Math.round(LEVEL_COST[to] * m), hours: Math.round(LEVEL_HOURS[to] * fast * 10) / 10, res: levelRes(d, to) };
}
export function canUpgrade(s: GameState, v: VenueId): string | null {
  const c = cultureOf(s);
  if (s.ending) return '판이 끝났어요';
  const to = c.venues[v] + 1;
  if (to > VENUE_MAX) return '가장 높은 단계예요';
  if (c.builds.some((b) => b.venue === v)) return '공사 중이에요';
  if (c.builds.length >= BUILD_TEAMS) return `공사 팀 ${BUILD_TEAMS}개가 모두 일하는 중`;
  const cost = upgradeCost(v, to, s);
  if (treasury(s) < cost.money) return `나라 예산 ${cost.money.toLocaleString('ko-KR')} 필요`;
  for (const [r, n] of Object.entries(cost.res)) if ((s.economy.stock[r as Res] ?? 0) < n!) return `${r} ${n}개 필요`;
  return null;
}
export function upgradeVenue(s: GameState, v: VenueId): GameState {
  if (canUpgrade(s, v)) return s;
  const to = cultureOf(s).venues[v] + 1;
  const cost = upgradeCost(v, to, s);
  return withC(pay(s, cost.money, cost.res), (c) => {
    c.builds.push({ venue: v, to, endMs: s.worldMs + cost.hours * H });
    c.log.unshift(`🏗️ ${venueById(v).levels[to - 1]} 공사 시작(${cost.hours}시간)`);
  });
}

/** 걸작 칸 수 = 그 시설 단계 */
export const workSlots = (s: GameState, k: WorkKind) => cultureOf(s).venues[workKindById(k).venue];
/** 다음 걸작 값(만드는 중인 것까지 셈) */
export const nextWorkCost = (s: GameState) => {
  const c = cultureOf(s);
  return workCost(worksCount(c) + jobsOn(c));
};
/** 아직 안 나온 걸작(그 종류) */
export function worksLeft(s: GameState, k: WorkKind): WorkDef[] {
  const have = cultureOf(s).works[k];
  return WORKS.filter((w) => w.kind === k && !have.includes(w.name));
}
/** 스타 등급(만든 걸작 2개마다 +1, 최대 3) */
export const starLevel = (x: CultureStar) => Math.min(3, 1 + Math.floor(x.made / 2));
/** 이 스타가 만들면 나올 등급 확률(%) */
export function gradeOdds(s: GameState, x: CultureStar): Record<Grade, number> {
  const c = cultureOf(s);
  const lvB = (starLevel(x) - 1) * 8 + (x.kind === 'arch' ? c.venues.heritage * 2 : 0);
  const w: Record<Grade, number> = { C: Math.max(10, GRADES.C.weight - lvB * 2), B: GRADES.B.weight + lvB, A: GRADES.A.weight + lvB };
  const t = w.A + w.B + w.C;
  const A = Math.round((w.A / t) * 100);
  const B = Math.round((w.B / t) * 100);
  return { A, B, C: 100 - A - B };
}
export function canCreate(s: GameState, starId: number): string | null {
  const c = cultureOf(s);
  if (s.ending) return '판이 끝났어요';
  const x = starsOf(c).find((y) => y.id === starId);
  if (!x) return '없는 스타예요';
  const k = starKindById(x.kind).work;
  if (!k) return '걸작을 만들지 않는 스타예요';
  if (x.job) return '작품을 만드는 중이에요';
  if (x.abroad && x.abroad.untilMs > s.worldMs) return '해외에 나가 있어요';
  const d = workKindById(k);
  if (c.works[k].length + jobsOn(c, k) >= workSlots(s, k)) return c.venues[d.venue] === 0 ? `${venueById(d.venue).name}을 먼저 지어요` : `${venueById(d.venue).name} 칸이 다 찼어요(단계를 올리면 늘어요)`;
  if (!worksLeft(s, k).length) return '이 종류 걸작을 다 모았어요';
  const cost = nextWorkCost(s);
  if (c.points < cost) return `문화 점수 💠${cost} 필요`;
  return null;
}
/** 스타에게 걸작 만들기를 맡김(시간이 지나면 등급이 정해져 걸작이 들어옴) */
export function startCreate(s: GameState, starId: number): GameState {
  if (canCreate(s, starId)) return s;
  const cost = nextWorkCost(s);
  return withC(s, (c) => {
    const x = c.stars!.find((y) => y.id === starId)!;
    const k = starKindById(x.kind).work!;
    c.points -= cost;
    x.job = { kind: k, endMs: s.worldMs + CREATE_HOURS[k] * H };
    c.log.unshift(`${starKindById(x.kind).icon} ${x.name}이(가) ${workKindById(k).name} 걸작을 만들기 시작(${CREATE_HOURS[k]}시간)`);
  });
}
/** 걸작 칸의 ＋: 그 종류 스타 중 쉬고 있는 사람에게 맡김 */
export function canAddWork(s: GameState, k: WorkKind): string | null {
  const c = cultureOf(s);
  const x = starsOf(c).find((y) => starKindById(y.kind).work === k && !y.job);
  if (!x) return starsOf(c).some((y) => starKindById(y.kind).work === k) ? '스타가 작품을 만드는 중' : `${STAR_KINDS.find((d) => d.work === k)!.name}를 먼저 데려와요`;
  return canCreate(s, x.id);
}
export function addWork(s: GameState, k: WorkKind): GameState {
  const x = starsOf(cultureOf(s)).find((y) => starKindById(y.kind).work === k && !y.job);
  return x ? startCreate(s, x.id) : s;
}

/** 스타: 인재 점수 · 데려오기 */
export function talentPerHour(s: GameState, k: StarKind, c = cultureOf(s)): number {
  if (starCount(c, k) >= STAR_MAX) return 0;
  return starKindById(k).from.reduce((v, id) => v + LEVEL_POWER[c.venues[id]], 0) * TALENT_RATE;
}
export const nextStarCost = (s: GameState, k: StarKind) => starCost(starCount(cultureOf(s), k));
/** 그 분야 스타를 키우는 시설이 하나라도 있는지 */
export const starVenueOk = (s: GameState, k: StarKind) => starKindById(k).from.some((v) => cultureOf(s).venues[v] > 0);
/** 모자란 인재 점수 */
export const talentShort = (s: GameState, k: StarKind) => Math.max(0, Math.ceil(nextStarCost(s, k) - (cultureOf(s).talent?.[k] ?? 0)));
/** 모자란 인재를 나라 예산으로 채우는 값 */
export const recruitMoney = (s: GameState, k: StarKind) => talentShort(s, k) * TALENT_MONEY;
/** pay=true면 모자란 인재 점수를 나라 예산으로 채워서 데려옴 */
export function canRecruit(s: GameState, k: StarKind, payMoney = false): string | null {
  const c = cultureOf(s);
  if (s.ending) return '판이 끝났어요';
  if (starCount(c, k) >= STAR_MAX) return `${starKindById(k).name}는 ${STAR_MAX}명까지`;
  if (!starVenueOk(s, k)) return `${starKindById(k).from.map((v) => venueById(v).name).join('이나 ')}을 먼저 지어요`;
  const short = talentShort(s, k);
  if (short > 0 && !payMoney) return `인재 점수 ${short}점 모자람`;
  if (short > 0 && treasury(s) < short * TALENT_MONEY) return `나라 예산 ${(short * TALENT_MONEY).toLocaleString('ko-KR')} 필요`;
  return null;
}
export function nextStarName(s: GameState, k: StarKind): string {
  const used = starsOf(cultureOf(s)).map((x) => x.name);
  const d = starKindById(k);
  return d.names.find((n) => !used.includes(n)) ?? `${d.name} ${starCount(cultureOf(s), k) + 1}호`;
}
export function recruitStar(s: GameState, k: StarKind, payMoney = false): GameState {
  if (canRecruit(s, k, payMoney)) return s;
  const need = nextStarCost(s, k);
  const name = nextStarName(s, k);
  const d = starKindById(k);
  const money = recruitMoney(s, k);
  const ns = withC(money > 0 ? pay(s, money) : s, (c) => {
    c.talent![k] = Math.max(0, (c.talent![k] ?? 0) - need);
    c.stars!.push({ id: c.starNext!, kind: k, name, made: 0, job: null });
    c.starNext = c.starNext! + 1;
    c.log.unshift(`${d.icon} ${d.name} 「${name}」을(를) 데려왔어요`);
  });
  return pushReport(ns, { icon: d.icon, text: `${d.name} 「${name}」이(가) 우리 문화계에 합류했습니다. ${d.perk}.` });
}

/** 관광 코스 */
export function canOpenCourse(s: GameState, id: CourseId): string | null {
  const c = cultureOf(s);
  const d = courseById(id);
  if (s.ending) return '판이 끝났어요';
  if (coursesOf(c).includes(id)) return '이미 열었어요';
  if (coursesOf(c).length >= courseSlots(c)) return `코스는 ${courseSlots(c)}개까지(하나를 닫아요)`;
  for (const [v, n] of Object.entries(d.needs)) if (c.venues[v as VenueId] < n!) return `${venueById(v as VenueId).name} ${n}단계 필요`;
  if (treasury(s) < d.money) return `나라 예산 ${d.money.toLocaleString('ko-KR')} 필요`;
  return null;
}
export function openCourse(s: GameState, id: CourseId): GameState {
  if (canOpenCourse(s, id)) return s;
  const d = courseById(id);
  return withC(pay(s, d.money), (c) => {
    c.courses!.push(id);
    c.log.unshift(`${d.icon} 관광 코스 「${d.name}」을(를) 열었어요`);
  });
}
export function closeCourse(s: GameState, id: CourseId): GameState {
  return withC(s, (c) => {
    c.courses = c.courses!.filter((x) => x !== id);
  });
}

export function canHost(s: GameState, id: CultureEventId, target?: string): string | null {
  const c = cultureOf(s);
  const d = cultureEventById(id);
  if (s.ending) return '판이 끝났어요';
  if (c.event && s.worldMs < c.event.endMs) return '다른 행사가 열리는 중';
  for (const [v, n] of Object.entries(d.needs)) if (c.venues[v as VenueId] < n!) return `${venueById(v as VenueId).name} ${n}단계 필요`;
  if ((c.cool[id] ?? 0) > s.worldMs) return '아직 준비 중(다시 열 수 있는 때를 기다려요)';
  if (d.peace && atWarAny(s)) return '전쟁 중엔 못 열어요';
  if (d.target) {
    if (!target) return '나라를 골라요';
    if (spreadMult(s, target, c) === 0) return '전쟁 중인 나라엔 못 가요';
  }
  if (treasury(s) < d.money) return `나라 예산 ${d.money.toLocaleString('ko-KR')} 필요`;
  return null;
}
export function hostEvent(s: GameState, id: CultureEventId, target?: string): GameState {
  if (canHost(s, id, target)) return s;
  const d = cultureEventById(id);
  const ns = withC(pay(s, d.money), (c) => {
    c.event = { id, target, startMs: s.worldMs, endMs: s.worldMs + d.hours * H };
    c.log.unshift(`${d.icon} ${d.name} 시작${target ? ` → ${countryById(target).name}` : ''}`);
  });
  return addEvent(ns, `${d.icon} 우리 나라가 ${d.name}을(를) 열었어요${target ? `(${countryById(target).name})` : ''}.`);
}

export function canPact(s: GameState, id: string): string | null {
  const c = cultureOf(s);
  if (c.pacts.includes(id)) return '이미 맺었어요';
  if (c.pacts.length >= PACT_MAX) return `협약은 ${PACT_MAX}개까지`;
  if (!isAlive(s.world, id)) return '없는 나라예요';
  if (relationOf(s.world, s.player.countryId, id) === '전쟁') return '전쟁 중이에요';
  if (favorOf(s, id) < 0) return '호감이 0 이상이어야 해요';
  if (treasury(s) < PACT_COST) return `나라 예산 ${PACT_COST.toLocaleString('ko-KR')} 필요`;
  return null;
}
export function signPact(s: GameState, id: string): GameState {
  if (canPact(s, id)) return s;
  const ns = withC(pay(s, PACT_COST), (c) => {
    c.pacts.push(id);
    c.log.unshift(`🤝 ${countryById(id).name}와(과) 문화 교류 협약`);
  });
  return addFavorNote(ns, id, '문화 교류 협약', 4);
}
export function endPact(s: GameState, id: string): GameState {
  return withC(s, (c) => {
    c.pacts = c.pacts.filter((x) => x !== id);
  });
}

/* ───────── 시간 흐름 ───────── */
/** 지난번 뒤로 흐른 시간만큼 문화·관광·공사·행사를 반영(몇 번 불러도 같은 결과) */
export function cultureTick(s: GameState): GameState {
  const c0 = cultureOf(s);
  if (!s.culture) s = { ...s, culture: c0 };
  const dt = s.worldMs - c0.lastMs;
  if (!(dt > 0)) return s;
  // 공사·행사 끝나는 때에 맞춰 나눠서 계산
  const stops = [...c0.builds.map((b) => b.endMs), ...(c0.event ? [c0.event.endMs] : []), ...starsOf(c0).flatMap((x) => (x.job ? [x.job.endMs] : []))].filter((t) => t > c0.lastMs && t <= s.worldMs).sort((a, b) => a - b);
  let cur = s;
  for (const t of [...stops, s.worldMs]) cur = step(cur, t);
  return cur;
}

function step(s: GameState, until: number): GameState {
  const c0 = cultureOf(s);
  const hours = (until - c0.lastMs) / H;
  if (hours <= 0) return s;
  const at = { ...s, worldMs: until };
  const cul = culturePerHour(s, c0) * hours;
  const tour = tourismPerHour({ ...s, worldMs: c0.lastMs }, c0) * hours;
  const me = s.player.countryId;
  let out = withC(s, (c) => {
    c.lastMs = until;
    c.points += cul;
    c.total += cul;
    for (const id of Object.keys(c.ai)) {
      if (!isAlive(s.world, id)) continue;
      c.ai[id] += aiCulturePerHour(at, id) * hours;
      c.infl[id] = (c.infl[id] ?? 0) + tour * spreadMult(s, id, c0);
    }
    c.income += tour * TOUR_INCOME * (1 + courseBonus(c0).income);
    for (const k of STAR_KINDS) c.talent![k.id] = Math.min(starCost(STAR_MAX) * 2, (c.talent![k.id] ?? 0) + talentPerHour(s, k.id, c0) * hours);
  });
  const income = baseTourism(s, c0) * TOUR_INCOME * (1 + courseBonus(c0).income) * hours;
  if (income > 0 && out.nations[me]) out = { ...out, nations: { ...out.nations, [me]: { ...out.nations[me], treasury: out.nations[me].treasury + income } } };

  // 공사 완료
  const done = cultureOf(out).builds.filter((b) => b.endMs <= until);
  if (done.length) {
    out = withC(out, (c) => {
      c.builds = c.builds.filter((b) => b.endMs > until);
      for (const b of done) {
        c.venues[b.venue] = Math.max(c.venues[b.venue], b.to);
        c.log.unshift(`✅ ${venueById(b.venue).levels[b.to - 1]} 완공(${b.to}단계)`);
      }
    });
    for (const b of done) {
      const d = venueById(b.venue);
      out = pushReport(out, { icon: d.icon, text: `${d.name}이(가) 「${d.levels[b.to - 1]}」(${b.to}단계)로 완공되었습니다. 문화와 관광이 올랐습니다.` });
    }
  }
  // 걸작 완성
  for (const x of starsOf(cultureOf(out))) if (x.job && x.job.endMs <= until) out = finishWork(out, x.id);
  // 행사 끝
  const ev = cultureOf(out).event;
  if (ev && ev.endMs <= until) out = finishEvent(out, ev);
  return out;
}

function finishWork(s: GameState, starId: number): GameState {
  const x = starsOf(cultureOf(s)).find((y) => y.id === starId)!;
  const k = x.job!.kind;
  const left = worksLeft(s, k);
  const rng = new Rng((s.world.seed * 31 + x.id * 7919 + Math.floor(x.job!.endMs / 60000)) >>> 0);
  const odds = gradeOdds(s, x);
  // 등급을 먼저 뽑고, 그 등급이 다 나왔으면 가까운 등급에서
  const roll = rng.next() * 100;
  const want: Grade = roll < odds.A ? 'A' : roll < odds.A + odds.B ? 'B' : 'C';
  const order: Grade[] = want === 'A' ? ['A', 'B', 'C'] : want === 'B' ? ['B', 'C', 'A'] : ['C', 'B', 'A'];
  let w: WorkDef | null = null;
  for (const g of order) {
    const pool = left.filter((y) => y.grade === g);
    if (pool.length) {
      w = rng.pick(pool);
      break;
    }
  }
  const d = starKindById(x.kind);
  const out = withC(s, (c) => {
    const y = c.stars!.find((z) => z.id === starId)!;
    y.job = null;
    if (!w) return;
    y.made += 1;
    if (c.works[k].length < c.venues[workKindById(k).venue]) c.works[k].push(w.name);
    c.log.unshift(`${workKindById(k).icon} ${GRADES[w.grade].name} 걸작 「${w.name}」 완성! (${x.name})`);
  });
  if (!w) return out;
  return pushReport(out, { icon: workKindById(k).icon, text: `${d.name} 「${x.name}」이(가) ${GRADES[w.grade].name} 걸작 「${w.name}」을(를) 완성했습니다.${w.grade === 'A' ? ' 세계가 주목합니다!' : ''}` });
}

function finishEvent(s: GameState, ev: CultureEventRun): GameState {
  const d = cultureEventById(ev.id);
  const r = d.reward;
  const burst = r.burst && ev.target ? baseTourism(s) * r.burst * spreadMult(s, ev.target) : 0;
  let out = withC(s, (c) => {
    c.event = null;
    c.cool[ev.id] = ev.endMs + d.coolHours * H;
    if (r.points) c.points += r.points;
    if (burst && ev.target) c.infl[ev.target] = (c.infl[ev.target] ?? 0) + burst;
    c.log.unshift(`🎉 ${d.name} 성황리에 끝!`);
  });
  if (r.approval) out = addPresMod(out, d.name, r.approval, r.approvalHours ?? 24);
  if (r.favor && ev.target) out = addFavorNote(out, ev.target, d.name, r.favor);
  if (r.favorAll) for (const id of others(out)) out = addFavorNote(out, id, d.name, r.favorAll);
  const bits = [r.points ? `문화 점수 +${r.points}` : '', burst ? `${countryById(ev.target!).name}에 영향력 +${Math.round(burst)}` : '', r.approval ? `지지도 +${r.approval}` : '', r.favorAll ? `모든 나라 호감 +${r.favorAll}` : '', r.favor ? `호감 +${r.favor}` : ''].filter(Boolean);
  return pushReport(out, { icon: d.icon, text: `${d.name}이(가) 성황리에 끝났습니다. ${bits.join(' · ')}` });
}

/** 문화 승리 확인: 조건을 7일 지키면 true */
export function cultureWinTick(s: GameState): { s: GameState; won: boolean } {
  if (!s.culture) return { s, won: false };
  const ok = cultureWinOk(s);
  const since = s.culture.winSinceMs;
  if (!ok) {
    if (since == null) return { s, won: false };
    const ns = withC(s, (c) => {
      c.winSinceMs = null;
      c.log.unshift('💔 문화 승리 조건이 깨졌어요');
    });
    return { s: ns, won: false };
  }
  if (since == null) {
    const ns = withC(s, (c) => {
      c.winSinceMs = s.worldMs;
      c.log.unshift(`🎨 문화 승리 조건 달성! ${CULTURE_WIN_DAYS}일 지키면 승리`);
    });
    return { s: addEvent(ns, `🎨 문화 승리 조건 달성! ${CULTURE_WIN_DAYS}일 동안 지키면 문화로 세계를 이겨요.`), won: false };
  }
  return { s, won: s.worldMs - since >= CULTURE_WIN_DAYS * 24 * H };
}

/** 지지도 사회 점수에 붙는 문화 시설 민심 */
export function cultureMood(s: GameState): number {
  const c = s.culture;
  if (!c) return 0;
  let v = 0;
  for (const d of VENUES) v += c.venues[d.id] * d.mood;
  v += worksPower(c).mood + courseBonus(c).mood + starCount(c, 'athlete') * ATHLETE_MOOD;
  return Math.min(15, Math.round(v * 10) / 10);
}

/** 화면 위 띠 하나에 쓸 요약 */
export function cultureSummary(s: GameState) {
  const c = cultureOf(s);
  const p = cultureProgress(s);
  return { cul: culturePerHour(s, c), tour: tourismPerHour(s, c), points: c.points, have: p.have, total: p.total, top: p.top };
}

/** 이벤트 목록(화면용) */
export const cultureEvents = () => CULTURE_EVENTS;
export const workKinds = () => WORK_KINDS;
