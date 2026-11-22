// 게임 상태와 시간 흐름. 화면과 떨어진 순수 계산이라 시험(테스트)하기 쉽다.

import { COUNTRIES, countryById } from '../data/world';
import { RANKS } from '../data/ranks';
import {
  BUDGET_PER_DAY_PER_POINT,
  GAME_START_DATE,
  PENDING_CAP_HOURS,
  REAL_MS_PER_GAME_DAY,
  START_TREASURY_PER_POINT,
  START_TROOPS_PER_POINT,
  TROOPS_PER_DAY_PER_POINT,
} from './balance';

export const SAVE_VERSION = 1;

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
}

export function newGame(name: string, countryId: string, now: number): GameState {
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
export function budgetPerDay(countryId: string): number {
  return countryById(countryId).budget * BUDGET_PER_DAY_PER_POINT;
}
export function troopsPerDay(countryId: string): number {
  return countryById(countryId).military * TROOPS_PER_DAY_PER_POINT * (TROOP_BONUS[countryId] ?? 1);
}

/**
 * 세계 시간을 ms만큼 흘린다. 실시간·꺼 둔 동안·시험 버튼 모두 이 함수 하나로 계산한다.
 * 상태를 직접 바꾸지 않고 새 상태를 돌려준다.
 */
export function advance(s: GameState, ms: number): GameState {
  if (!(ms > 0)) return s;
  const days = ms / REAL_MS_PER_GAME_DAY;
  const nations: Record<string, NationState> = {};
  for (const [id, n] of Object.entries(s.nations)) {
    nations[id] = {
      treasury: n.treasury + budgetPerDay(id) * days,
      troops: n.troops + troopsPerDay(id) * days,
    };
  }
  const pendingSalary = Math.min(pendingCap(s), s.player.pendingSalary + salaryPerDay(s) * days);
  return { ...s, worldMs: s.worldMs + ms, player: { ...s.player, pendingSalary }, nations };
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
