// 내정 확장(11/24 제안서 A2~A7·B): 국정 과제·이익집단·기본법·특구·국가 대형 사업·예산 국회·사진첩을 한 칸(GameState.dom)에 담음.
// 효과는 모두 법과 같은 이름(LawKey)으로 내서 laws.ts의 lawEff·lawRows가 함께 더함 → 예산·모집·자원·연구·민심·분야 점수·지지도에 바로 반영.
// 이 파일은 상태 모양·기록·효과 합치기만. 계산은 agenda.ts·groups.ts·codes.ts·zones.ts·projects.ts·budgetSeason.ts·album.ts
import type { GameState } from './state';
import type { LawKey } from './laws';

export type Rows = Array<[string, number]>;

export interface AgendaState {
  /** 공약으로 고른 갈래(처음 2개, 한 갈래를 다 끝내면 하나 더) */
  pledges: string[];
  /** 끝낸 과제 id */
  done: string[];
  /** 갈래별 공약 시작 시각(첫 단계 마감 계산) */
  since: Record<string, number>;
  /** 공약 파기 처리한 갈래 */
  broken: string[];
  /** 갈래별 시작 값(병력·예산 등 나라 크기에 맞춘 목표) */
  base: Record<string, Record<string, number>>;
}
export interface GroupsState {
  /** 집단별 만족도 0~100 */
  sat: Record<string, number>;
  /** 면담·양보로 잠깐 붙은 덤 */
  mods: Array<{ g: string; v: number; untilMs: number; why: string }>;
  /** 집단별 다음 면담 가능 시각 */
  meetMs: Record<string, number>;
  /** 집단별 마지막 불만 사건 시각 */
  riotMs: Record<string, number>;
}
export interface CodesState {
  /** 법 칸별 고른 단계 */
  pick: Record<string, number>;
  /** 법 칸별 다시 바꿀 수 있는 시각 */
  readyMs: Record<string, number>;
}
export interface ProjectState {
  /** 0 = 설계, 1 = 공사, 2 = 마무리, 3 = 완공 */
  stage: number;
  /** 지금 단계가 끝나는 시각(0 = 멈춤) */
  endMs: number;
  cityId: string;
}
export interface BudgetSeasonState {
  /** 다음 예산안 철(이때 제출 창이 열림) */
  nextMs: number;
  /** 제출 창: 고른 안·표결 시각 */
  open: { untilMs: number; plan: string | null; voteMs: number | null; chance: number } | null;
  /** 살아 있는 예산(통과·준예산) */
  active: { plan: string; untilMs: number; cut: boolean } | null;
  /** 통과·삭감 기록 */
  passed: number;
  cut: number;
}
export interface AlbumShot {
  t: number;
  scene: string;
  title: string;
  text: string;
}
export interface DomState {
  agenda: AgendaState;
  groups: GroupsState;
  codes: CodesState;
  /** 도시 id → 특구 종류 */
  zones: Record<string, string>;
  /** 방산 기업과 수출(11-27 내정 3, arms.ts). 옛 저장은 없음 */
  arms?: { lv: Partial<Record<'land' | 'sea' | 'air' | 'missile', number>>; deals: Array<{ to: string; firm: 'land' | 'sea' | 'air' | 'missile'; lv: number; untilMs: number }>; sold: number };
  /** 도시 id → 특화 길과 단계(11-27 내정 1, citySpec.ts). 옛 저장은 없음 */
  spec?: Record<string, { path: 'ind' | 'sci' | 'tour' | 'mil' | 'fin'; lv: number }>;
  projects: Record<string, ProjectState>;
  budget: BudgetSeasonState;
  album: AlbumShot[];
  log: string[];
}

const DAY = 24 * 3600e3;
export function newDom(s: Pick<GameState, 'worldMs'>): DomState {
  return {
    agenda: { pledges: [], done: [], since: {}, broken: [], base: {} },
    groups: { sat: {}, mods: [], meetMs: {}, riotMs: {} },
    codes: { pick: {}, readyMs: {} },
    zones: {},
    projects: {},
    budget: { nextMs: s.worldMs + DAY, open: null, active: null, passed: 0, cut: 0 },
    album: [],
    log: [],
  };
}
export function domOf(s: GameState): DomState {
  return s.dom ?? newDom(s);
}
/** 내정 칸 일부를 바꾼 새 상태 */
export function withDom(s: GameState, patch: Partial<DomState>): GameState {
  return { ...s, dom: { ...domOf(s), ...patch } };
}
/** 내정 소식 한 줄(최근 30줄) */
export function domLog(s: GameState, text: string): GameState {
  const d = domOf(s);
  return withDom(s, { log: [text, ...d.log].slice(0, 30) });
}
/** 사진첩(11/28 대장 요청으로 기능 없앰): 부르는 곳은 그대로 두고 아무것도 남기지 않음 */
export function snap(s: GameState, _scene: string, _title: string, _text: string): GameState {
  return s;
}

/* ── 효과 합치기 ── 각 계산 파일이 줄을 등록. laws.ts가 부름(순환을 피하려고 등록 방식) */
type RowFn = (s: GameState, key: LawKey) => Rows;
const SOURCES: RowFn[] = [];
export function registerDomRows(fn: RowFn) {
  SOURCES.push(fn);
}
export function domRows(s: GameState, key: LawKey): Rows {
  if (!s.dom) return [];
  const out: Rows = [];
  for (const f of SOURCES) for (const r of f(s, key)) if (r[1]) out.push(r);
  return out;
}
export function domEff(s: GameState, key: LawKey): number {
  let v = 0;
  for (const r of domRows(s, key)) v += r[1];
  return v;
}

/** 나라 예산(금고)에서 냄. 모자라면 null */
export function payTreasury(s: GameState, amount: number): GameState | null {
  const me = s.player.countryId;
  const n = s.nations[me];
  if (!n || n.treasury < amount) return null;
  return { ...s, nations: { ...s.nations, [me]: { ...n, treasury: n.treasury - amount } } };
}
