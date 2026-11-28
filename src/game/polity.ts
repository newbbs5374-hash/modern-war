// 내정 새 콘텐츠 8가지(11/26 대장 "8개 모두"): 국회 의석·선거 · 경제 상황판·금리 · 재난 지휘실 · 감사·수사·국정감사 ·
// 시·도지사 · 인구·세대 · 개헌 · 기념일 연설. 상태는 한 칸(GameState.polity)에 담고, 계산은 기능마다 파일 하나(seats·econ·disaster·
// probe·governors·population·amend·speech). 효과는 domestic.ts 등록 방식(registerDomRows)으로 법과 같은 이름(LawKey)으로 냄.
import type { GameState } from './state';

export interface Seats {
  ruling: number;
  opp: number;
  ind: number;
}
export interface Election {
  kind: 'general' | 'local';
  /** 투표 시각 */
  atMs: number;
  /** 유세한 도시 id(여러 번 가능) */
  rally: string[];
  /** 오늘 유세 횟수 · 유세 날 시작 */
  dayCount: number;
  dayMs: number;
}
export interface EconHist {
  cpi: number[];
  growth: number[];
  stock: number[];
}
export interface EconState {
  cpi: number;
  unemp: number;
  growth: number;
  stock: number;
  fx: number;
  house: number;
  rate: number;
  rateMs: number;
  histMs: number;
  hist: EconHist;
  /** 위기 쌓임(물가·집값 과열이 오래가면 오름) */
  stress: number;
  crisis: { kind: 'bank' | 'house'; untilMs: number } | null;
}
export interface Disaster {
  kind: string;
  cityId: string;
  stage: number;
  /** 지금 단계 마감 */
  endMs: number;
  /** 단계마다 성공(1)·실패(0) */
  wins: number[];
  /** 단계마다 고른 대응 id */
  picks: string[];
}
export interface Scandal {
  pid: number;
  kind: string;
  evidence: number;
  untilMs: number;
}
export interface Audit {
  untilMs: number;
  qs: string[];
  done: string[];
}
export interface Governor {
  name: string;
  sex: 'm' | 'f';
  age: number;
  id: number;
  party: 'ruling' | 'opp';
  coop: number;
}
export interface GovDemand {
  cityId: string;
  kind: string;
  untilMs: number;
}
export interface PopState {
  birth: number;
  old: number;
  young: number;
  migrant: number;
  /** 인구(시작 = 100) */
  size: number;
  policy: { id: string; untilMs: number } | null;
}
export interface AmendState {
  passed: string[];
  /** 국민투표 중 */
  vote: { id: string; atMs: number; chance: number } | null;
  readyMs: number;
  failed: number;
}
export interface SpeechState {
  /** 다음 기념일(이때 연설 창이 열림) */
  nextMs: number;
  /** 몇 번째 기념일(이름 고르기) */
  n: number;
  open: { day: string; untilMs: number; words: string[] } | null;
  last: { day: string; text: string; t: number } | null;
}
/** 도시 민심에 잠깐 붙는 덤(재난·유세·지사 요구) */
export interface CityMark {
  cityId: string;
  v: number;
  untilMs: number;
  why: string;
}
export interface PolityState {
  seed: number;
  seats: Seats;
  /** 다음 선거(유세 창은 2일 전부터) */
  election: Election;
  elections: number;
  /** 11-28 선거 예측: 3시간마다 잰 예상 득표율(최근 24번) */
  voteHist?: number[];
  voteHistMs?: number;
  econ: EconState;
  disaster: Disaster | null;
  disasterMs: number;
  disasterWins: number;
  disasterLoss: number;
  scandal: Scandal | null;
  scandalMs: number;
  /** 정적 수사 다음 가능 시각 */
  probeMs: number;
  audit: Audit | null;
  auditMs: number;
  governors: Record<string, Governor>;
  demand: GovDemand | null;
  demandMs: number;
  pop: PopState;
  amend: AmendState;
  speech: SpeechState;
  marks: CityMark[];
  log: string[];
}

export const H = 3600e3;
export const DAY = 24 * H;
export const clamp = (v: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));
export const r1 = (v: number) => Math.round(v * 10) / 10 || 0;
export const r2 = (v: number) => Math.round(v * 100) / 100 || 0;

/** 처음 상태를 만드는 함수는 각 파일이 채움(순환을 피하려고 여기선 틀만) */
type Init = (s: GameState, p: PolityState) => void;
const INITS: Init[] = [];
export function registerPolityInit(f: Init) {
  INITS.push(f);
}
export function newPolity(s: GameState): PolityState {
  const p: PolityState = {
    seed: (((s.world.seed ?? 1) * 31 + 7) >>> 0) || 1,
    seats: { ruling: 140, opp: 125, ind: 35 },
    election: { kind: 'general', atMs: s.worldMs + 5 * DAY, rally: [], dayCount: 0, dayMs: 0 },
    elections: 0,
    econ: { cpi: 2.5, unemp: 4, growth: 2, stock: 2500, fx: 100, house: 0, rate: 3, rateMs: 0, histMs: 0, hist: { cpi: [], growth: [], stock: [] }, stress: 0, crisis: null },
    disaster: null,
    disasterMs: s.worldMs + 10 * H,
    disasterWins: 0,
    disasterLoss: 0,
    scandal: null,
    scandalMs: s.worldMs + 16 * H,
    probeMs: 0,
    audit: null,
    auditMs: s.worldMs + 3 * DAY,
    governors: {},
    demand: null,
    demandMs: s.worldMs + 8 * H,
    pop: { birth: 1.5, old: 15, young: 15, migrant: 3, size: 100, policy: null },
    amend: { passed: [], vote: null, readyMs: 0, failed: 0 },
    speech: { nextMs: s.worldMs + 20 * H, n: 0, open: null, last: null },
    marks: [],
    log: [],
  };
  for (const f of INITS) f(s, p);
  return p;
}
export function polityOf(s: GameState): PolityState {
  return s.polity ?? newPolity(s);
}
export function withPolity(s: GameState, patch: Partial<PolityState>): GameState {
  return { ...s, polity: { ...polityOf(s), ...patch } };
}
export function polityLog(s: GameState, text: string): GameState {
  const p = polityOf(s);
  return withPolity(s, { log: [text, ...p.log].slice(0, 40) });
}
/** 상태 안 씨앗으로 난수 하나(씨앗을 다음으로 넘김) */
export function roll(s: GameState): [number, GameState] {
  const p = polityOf(s);
  let t = (p.seed + 0x6d2b79f5) | 0;
  let r = Math.imul(t ^ (t >>> 15), 1 | t);
  r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
  return [((r ^ (r >>> 14)) >>> 0) / 4294967296, withPolity(s, { seed: t })];
}
export function addMark(s: GameState, cityId: string, v: number, hours: number, why: string): GameState {
  const p = polityOf(s);
  const marks = [...p.marks.filter((m) => m.untilMs > s.worldMs), { cityId, v, untilMs: s.worldMs + hours * H, why }].slice(-30);
  return withPolity(s, { marks });
}
/** 소식 한 줄(세계 소식 · 내 나라) */
export function tell(s: GameState, text: string): GameState {
  const ev = { t: s.worldMs, kind: '장교' as const, text, mine: true };
  return { ...s, world: { ...s.world, events: [ev, ...s.world.events].slice(0, 150) } };
}
/** 의회 신뢰도를 바로 움직임 */
export function bumpTrust(s: GameState, v: number): GameState {
  return { ...s, officer: { ...s.officer, trust: clamp(s.officer.trust + v) } };
}
/** 정적(역할) 영향력 움직이기 · 이름 돌려줌 */
export function bumpRival(s: GameState, role: string, v: number): [GameState, string | null] {
  let name: string | null = null;
  const rivals = s.officer.rivals.map((rv, i) => {
    const r = rv.role ?? (['야당 대표', '군부 실력자', '재벌'] as const)[i % 3];
    if (r !== role || rv.ally) return rv;
    name = name ?? rv.name;
    const base = rv.influence ?? clamp(Math.round(25 + (rv.rate - 170) / 4));
    return { ...rv, influence: clamp(base + v) };
  });
  return [{ ...s, officer: { ...s.officer, rivals } }, name];
}
/** 그 역할의 (협력 안 한) 정적 이름 */
export function rivalName(s: GameState, role: string): string | null {
  const i = s.officer.rivals.findIndex((rv, k) => (rv.role ?? (['야당 대표', '군부 실력자', '재벌'] as const)[k % 3]) === role && !rv.ally);
  return i >= 0 ? s.officer.rivals[i].name : null;
}
/** 표결(법안·기본법·예산안) 통과 확률 덤: 여당 150석 → 0, 200석 → +0.2, 100석 → −0.2 (assembly·codes·budgetSeason이 읽음) */
export function seatBonus(s: GameState): number {
  if (!s.polity) return 0;
  return clamp((s.polity.seats.ruling - 150) / 250, -0.3, 0.3);
}
/** 개헌 '임기 연장'이면 재신임 통과 +10% */
export const amendConfBonus = (s: GameState) => (s.polity?.amend.passed.includes('term') ? 0.1 : 0);
