// 게임 상태와 시간 흐름. 화면과 떨어진 순수 계산이라 시험(테스트)하기 쉽다.

import { COUNTRIES, countryById } from '../data/world';
import { RANKS } from '../data/ranks';
import { PERSONALITIES } from '../data/leaders';
import { aiTick, cloneWorld, incomeShare, newWorld, type WorldState } from './world';
import { generalDefense, newOfficer, officerTick, type OfficerState } from './officer';
import { checkVictory, type Ending } from './victory';
import type { Report } from './report';
import { accrueEconomy, economyTick, industryMult, occupyHold, newEconomy, welfareMult, type EconomyState } from './economy';
import {
  AI_TICK_MS,
  BUDGET_PER_DAY_PER_POINT,
  GAME_START_DATE,
  PENDING_CAP_HOURS,
  REAL_MS_PER_GAME_DAY,
  START_TREASURY_PER_POINT,
  START_TROOPS_PER_POINT,
  TROOPS_PER_DAY_PER_POINT,
  TROOP_ATTRITION_PER_DAY,
} from './balance';

export const SAVE_VERSION = 6; // 5: 새 세계관(여명 군도), 6: 육각 타일 지도(도시 53개) — 예전 저장은 새 판으로

export interface NationState {
  /** 나라 금고(국방예산) */
  treasury: number;
  /** 병력(명) */
  troops: number;
}

export interface GameState {
  version: number;
  /** 세계가 흘러간 시간(실제 ms). 시험 버튼으로 건너뛴 시간도 포함 */
  worldMs: number;
  /** 마지막으로 시간을 반영한 실제 시각(Date.now()) */
  lastRealTime: number;
  player: {
    name: string;
    countryId: string;
    rankIndex: number;
    /** 받은 봉급(내 주머니) */
    salary: number;
    /** 아직 받지 않고 쌓인 봉급 */
    pendingSalary: number;
  };
  nations: Record<string, NationState>;
  /** 시험 버튼으로 건너뛴 총 시간(ms). 기록용 */
  debugSkippedMs: number;
  /** 2단계: 외교·도시 주인·AI 지도자·소식 */
  world: WorldState;
  /** 3단계: 장교 성장·임무·부관·장군·라이벌 */
  officer: OfficerState;
  /** 6단계: 내 나라 내정(시설·자원·생산·무역) */
  economy: EconomyState;
  /** 승리하면 채워짐(판 끝) */
  ending: Ending | null;
  /** 부관 보고(아직 안 본 것) */
  reports?: Report[];
}

export interface NewGameOptions {
  /** 지도자 성향을 무작위로 */
  randomLeaders?: boolean;
  /** 세계 난수 씨앗(시험용으로 고정할 수 있음) */
  seed?: number;
}

export function newGame(name: string, countryId: string, now: number, opt: NewGameOptions = {}): GameState {
  countryById(countryId); // 없는 나라면 오류
  const nations: Record<string, NationState> = {};
  for (const c of COUNTRIES) {
    nations[c.id] = {
      treasury: c.budget * START_TREASURY_PER_POINT,
      troops: c.military * START_TROOPS_PER_POINT,
    };
  }
  return {
    version: SAVE_VERSION,
    worldMs: 0,
    lastRealTime: now,
    player: { name, countryId, rankIndex: 0, salary: 0, pendingSalary: 0 },
    nations,
    debugSkippedMs: 0,
    world: newWorld(opt.seed ?? (now ^ 0x5eed) >>> 0, !!opt.randomLeaders, AI_TICK_MS),
    officer: newOfficer(((opt.seed ?? now) * 7 + 13) >>> 0),
    economy: newEconomy(),
    ending: null,
  };
}

/** 나라 특수 능력 중 병력에 붙는 배율(기획서의 나라별 특수 능력치) */
const TROOP_BONUS: Record<string, number> = { il: 1.4, kp: 1.5, in: 1.4 };

export function salaryPerDay(s: GameState): number {
  return RANKS[s.player.rankIndex].salaryPerDay;
}
export function pendingCap(s: GameState): number {
  return salaryPerDay(s) * (PENDING_CAP_HOURS * 60 * 60 * 1000) / REAL_MS_PER_GAME_DAY;
}
/** 하루 국방예산 = 시작 예산 × 지도자 성향 × 가진 도시 비율 */
export function budgetPerDay(s: GameState, countryId: string): number {
  const lead = PERSONALITIES[s.world.personalities[countryId]].budget;
  const ind = countryId === s.player.countryId ? industryMult(s.economy) : 1;
  return countryById(countryId).budget * BUDGET_PER_DAY_PER_POINT * lead * incomeShare(s.world, countryId) * ind;
}
/** 하루 모병 = 군사력 × 나라 보너스 × 가진 도시 비율 */
export function troopsPerDay(s: GameState, countryId: string): number {
  return (
    countryById(countryId).military *
    TROOPS_PER_DAY_PER_POINT *
    (TROOP_BONUS[countryId] ?? 1) *
    incomeShare(s.world, countryId) *
    (countryId === s.player.countryId ? welfareMult(s.economy) : 1)
  );
}

/** 쌓이는 것만 ms만큼(판단 없이) */
function accrue(s: GameState, ms: number): GameState {
  if (!(ms > 0)) return s;
  const days = ms / REAL_MS_PER_GAME_DAY;
  const nations: Record<string, NationState> = {};
  for (const [id, n] of Object.entries(s.nations)) {
    nations[id] = {
      treasury: n.treasury + budgetPerDay(s, id) * days,
      troops: n.troops * Math.exp(-TROOP_ATTRITION_PER_DAY * days) + troopsPerDay(s, id) * days,
    };
  }
  const pendingSalary = Math.min(pendingCap(s), s.player.pendingSalary + salaryPerDay(s) * days);
  const economy = accrueEconomy(s, ms);
  return economyTick({ ...s, worldMs: s.worldMs + ms, player: { ...s.player, pendingSalary }, nations, economy });
}

/**
 * 세계 시간을 ms만큼 흘린다. 실시간·꺼 둔 동안·시험 버튼 모두 이 함수 하나로 계산한다.
 * 실제 15분마다 AI가 판단(외교·침공)하고, 그 사이에는 수입이 쌓인다.
 * 상태를 직접 바꾸지 않고 새 상태를 돌려준다.
 */
export function advance(s: GameState, ms: number): GameState {
  if (!(ms > 0)) return s;
  let cur = s;
  let left = ms;
  let world: WorldState | null = null;
  while (cur.worldMs + left >= cur.world.nextTickMs) {
    const step = cur.world.nextTickMs - cur.worldMs;
    cur = accrue(cur, step);
    left -= step;
    if (!world) world = cloneWorld(cur.world);
    const nations: Record<string, NationState> = {};
    for (const [id, n] of Object.entries(cur.nations)) nations[id] = { ...n };
    const ownerBefore = { ...world.owner };
    aiTick(world, nations, cur.worldMs, cur.player.countryId, generalDefense(cur.officer), occupyHold(cur));
    world.nextTickMs += AI_TICK_MS;
    cur = { ...cur, nations, world };
    officerTick(cur, ownerBefore, AI_TICK_MS);
  }
  return checkVictory(accrue(cur, left));
}

/** 실제 시각까지 따라잡기. 시계가 거꾸로 가면(기기 시간 변경) 아무것도 하지 않는다. */
export function catchUp(s: GameState, now: number, speed = 1): GameState {
  const dt = now - s.lastRealTime;
  if (dt <= 0) return { ...s, lastRealTime: now };
  return { ...advance(s, dt * speed), lastRealTime: now };
}

/** 시험 버튼: 시간 건너뛰기 */
export function skip(s: GameState, ms: number): GameState {
  const next = advance(s, ms);
  return { ...next, debugSkippedMs: s.debugSkippedMs + ms };
}

/** 쌓인 봉급 받기 */
export function claimSalary(s: GameState): GameState {
  const got = Math.floor(s.player.pendingSalary);
  if (got <= 0) return s;
  return {
    ...s,
    player: { ...s.player, salary: s.player.salary + got, pendingSalary: s.player.pendingSalary - got },
  };
}

/** 시험 버튼: 계급 바꾸기(진급 시스템은 다음 단계) */
export function setRank(s: GameState, rankIndex: number): GameState {
  const r = Math.max(0, Math.min(RANKS.length - 1, rankIndex));
  return { ...s, player: { ...s.player, rankIndex: r } };
}

export interface GameClock {
  /** 전쟁 며칠째(1부터) */
  dayNumber: number;
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}

/** 세계 시간 → 게임 달력. 실제 1시간 = 게임 24시간이므로 실제 2.5초 = 게임 1분 */
export function gameClock(worldMs: number): GameClock {
  const gameMinutes = Math.floor((worldMs / REAL_MS_PER_GAME_DAY) * 24 * 60);
  const dayIndex = Math.floor(gameMinutes / (24 * 60));
  const minuteOfDay = gameMinutes % (24 * 60);
  const d = new Date(Date.UTC(GAME_START_DATE.year, GAME_START_DATE.month - 1, GAME_START_DATE.day + dayIndex));
  return {
    dayNumber: dayIndex + 1,
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
    hour: Math.floor(minuteOfDay / 60),
    minute: minuteOfDay % 60,
  };
}
