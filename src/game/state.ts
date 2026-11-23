// 게임 상태와 시간 흐름. 화면과 떨어진 순수 계산이라 시험(테스트)하기 쉽다.

import { cultureTick, type CultureState } from './culture';
import { applyOrigin, type OriginId } from './origin';
import { COUNTRIES, countryById } from '../data/world';
import { RANKS, TITLES, firstTierOfRank } from '../data/ranks';
import { TITLE_MAX, syncTitle } from './title';
import { PERSONALITIES } from '../data/leaders';
import { aiTick, cloneWorld, incomeShare, newWorld, type WorldState } from './world';
import { applyContracts, contractMoneyPerHour } from './economy';
import { TRUST_START, generalDefense, newOfficer, officerTick, type OfficerState } from './officer';
import { checkVictory, type Ending } from './victory';
import type { Report } from './report';
import type { PeaceState } from './peace';
import type { GoalsState } from './goals';
import { crisisTick, newCrisis, type CrisisState } from './crisis';
import { ordersBudget, ordersDefense, ordersTick, type OrdersState } from './orders';
import { spyTick, type SpyState } from './spy';
import type { FleetState } from './fleet';
import type { GuideState } from './guide';
import { splitEco, splitTroop, taxBudget, TAX_INFO, taxOf, splitOf, type PolicyState } from './policy';
import { cabBudget, cabTroop, newCabinet, addBuddy, type CabinetState } from './cabinet';
import { cabinetTick } from './cabinetOps';
import type { ScheduleState } from './schedule';
import { lawEff, type AssemblyState } from './laws';
import { assemblyTick } from './assembly';
import { mediaTick, type MediaState } from './media';
import { approvalBudgetMult, approvalTroopMult, presTick, type PresState } from './approval';
import { civAccrue, civBudgetMult, civTick, defenseMult, newCiv, sanctionMult, type CivState } from './civ';
import { accrueEconomy, attritionMult, budgetMult, economyTick, occupyHold, newEconomy, welfareMult, type EconomyState } from './economy';
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

export const SAVE_VERSION = 7; // 5: 새 세계관(여명 군도), 6: 육각 타일 지도(도시 53개), 7: 현실 나라·도시 이름(11-23) — 예전 저장은 새 판으로

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
    /** 혜택 단계 0~10(자리 수·잠금·봉급). 11-23부터 호칭에서 저절로 정해짐(title.ts) */
    rankIndex: number;
    /** 호칭 단계 0~14(신뢰도+명성). 옛 저장은 없음 */
    title?: number;
    /** 받은 봉급(내 주머니) */
    salary: number;
    /** 아직 받지 않고 쌓인 봉급 */
    pendingSalary: number;
    /** 지도자 출신(11-23). 옛 저장은 없음 */
    origin?: OriginId;
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
  /** 문명식 운영(연구·체제·호감·협정·분쟁 섬·국제 회의·도시 구역/민심/인구). 옛 저장은 불러올 때 채움 */
  civ?: CivState;
  /** 평화 승리(세계 평화 헌장). 없으면 아직 제안 안 함 */
  peace?: PeaceState;
  /** 루비·매일 할 일·업적. 없으면 불러올 때·처음 쓸 때 채움 */
  goals?: GoalsState;
  /** 돌발 사건 카드 */
  crisis?: CrisisState;
  /** 미리 명령(자리 비운 동안 부관이 지키는 규칙) */
  orders?: OrdersState;
  /** 첩보·특수 작전 */
  spy?: SpyState;
  /** 함대 충돌 관전 기록 */
  fleet?: FleetState;
  /** 첫 판 안내 임무 */
  guide?: GuideState;
  /** 대통령식 내정: 지지도·탄핵 위기·기록(없으면 처음 쓸 때 채움) */
  pres?: PresState;
  /** 인물·부처(11-23) */
  cabinet?: CabinetState;
  /** 대통령 일정(11-23) */
  schedule?: ScheduleState;
  /** 국회·법·재신임(11-23) */
  assembly?: AssemblyState;
  /** 기자회견·청원·정상회담(11-23) */
  media?: MediaState;
  /** 문화(시설·걸작·행사·영향력, 11-23). 없으면 처음 쓸 때 채움 */
  culture?: CultureState;
  /** 예산 나누기·세금(없으면 기본 40/20/20/20 · 보통) */
  policy?: PolicyState;
}

export interface NewGameOptions {
  /** 지도자 성향을 무작위로 */
  randomLeaders?: boolean;
  /** 세계 난수 씨앗(시험용으로 고정할 수 있음) */
  seed?: number;
  /** 지도자 출신(11-23) */
  origin?: OriginId;
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
  const world = newWorld(opt.seed ?? (now ^ 0x5eed) >>> 0, !!opt.randomLeaders, AI_TICK_MS);
  const s: GameState = {
    version: SAVE_VERSION,
    worldMs: 0,
    lastRealTime: now,
    player: { name, countryId, rankIndex: 0, salary: 0, pendingSalary: 0 },
    nations,
    debugSkippedMs: 0,
    world,
    officer: newOfficer(((opt.seed ?? now) * 7 + 13) >>> 0),
    economy: newEconomy(),
    ending: null,
    civ: newCiv({ world, worldMs: 0 }),
    crisis: newCrisis(0),
  };
  s.cabinet = newCabinet(s);
  return syncTitle(opt.origin ? addBuddy(applyOrigin(s, opt.origin), opt.origin, null) : s, true);
}

/** 나라 특수 능력 중 병력에 붙는 배율(기획서의 나라별 특수 능력치) */
export const TROOP_BONUS: Record<string, number> = { il: 1.4, kp: 1.5, in: 1.4 };

export function salaryPerDay(s: GameState): number {
  return RANKS[s.player.rankIndex].salaryPerDay;
}
export function pendingCap(s: GameState): number {
  return salaryPerDay(s) * (PENDING_CAP_HOURS * 60 * 60 * 1000) / REAL_MS_PER_GAME_DAY;
}
/** 하루 국방예산 = 시작 예산 × 지도자 성향 × 가진 도시 비율 */
export function budgetPerDay(s: GameState, countryId: string): number {
  const lead = PERSONALITIES[s.world.personalities[countryId]].budget;
  const ind = countryId === s.player.countryId ? budgetMult(s) * civBudgetMult(s) * ordersBudget(s) * approvalBudgetMult(s) * splitEco(s) * taxBudget(s) * cabBudget(s) * (1 + lawEff(s, 'budget')) : sanctionMult(s, countryId);
  return countryById(countryId).budget * BUDGET_PER_DAY_PER_POINT * lead * incomeShare(s.world, countryId) * ind;
}
/** 하루 모병 = 군사력 × 나라 보너스 × 가진 도시 비율 */
export function troopsPerDay(s: GameState, countryId: string): number {
  return (
    countryById(countryId).military *
    TROOPS_PER_DAY_PER_POINT *
    (TROOP_BONUS[countryId] ?? 1) *
    incomeShare(s.world, countryId) *
    (countryId === s.player.countryId ? welfareMult(s) * approvalTroopMult(s) * splitTroop(s) * cabTroop(s) * (1 + lawEff(s, 'troop')) : 1)
  );
}

/** 금고 화면 말풍선: 시간당 숫자가 어떻게 나오는지 [이름, 값] */
export function budgetBreakdown(s: GameState): Array<[string, string]> {
  const me = s.player.countryId;
  const p = s.world.personalities[me];
  const share = incomeShare(s.world, me);
  const x = (v: number) => `×${(Math.round(v * 100) / 100).toFixed(2)}`;
  return [
    ['기본(나라 국방예산 점수)', `${Math.round(countryById(me).budget * BUDGET_PER_DAY_PER_POINT).toLocaleString('ko-KR')}`],
    [`지도자 성향(${p})`, x(PERSONALITIES[p].budget)],
    ['가진 도시(점령지는 절반)', x(share)],
    ['🏭 군수공장', x(budgetMult(s))],
    ['🏛️ 체제·카드·도시 민심·인구', x(civBudgetMult(s))],
    ['🙂 지지도', x(approvalBudgetMult(s))],
    [`💰 경제 예산 ${splitOf(s).eco}%`, x(splitEco(s))],
    [`${TAX_INFO[taxOf(s)].icon} 세금 ${TAX_INFO[taxOf(s)].name}`, x(taxBudget(s))],
    ['💰 기획재정부', x(cabBudget(s))],
    ['📜 법', x(1 + lawEff(s, 'budget'))],
    ...(ordersBudget(s) !== 1 ? [['🛡️ 방어 태세(미리 명령)', x(ordersBudget(s))] as [string, string]] : []),
    ['무역 계약(시간당)', `${Math.round(contractMoneyPerHour(s)).toLocaleString('ko-KR')}`],
  ];
}
/** 내 나라 병력 자연 감소(시간당) */
export function troopLossPerDay(s: GameState): number {
  return s.nations[s.player.countryId].troops * (1 - Math.exp(-TROOP_ATTRITION_PER_DAY * attritionMult(s)));
}
export function troopsBreakdown(s: GameState): Array<[string, string]> {
  const me = s.player.countryId;
  const x = (v: number) => `×${(Math.round(v * 100) / 100).toFixed(2)}`;
  const loss = troopLossPerDay(s);
  return [
    ['기본(나라 군사력 점수)', `${Math.round(countryById(me).military * TROOPS_PER_DAY_PER_POINT).toLocaleString('ko-KR')}`],
    ['나라 특수 능력', x(TROOP_BONUS[me] ?? 1)],
    ['가진 도시(점령지는 절반)', x(incomeShare(s.world, me))],
    ['📝 징병소', x(welfareMult(s))],
    ['🙂 지지도(징병)', x(approvalTroopMult(s))],
    [`🛡️ 국방 예산 ${splitOf(s).def}%`, x(splitTroop(s))],
    ['🎖️ 국방부', x(cabTroop(s))],
    ['📜 법', x(1 + lawEff(s, 'troop'))],
    ['자연 감소(전역·부상)', `-${Math.round(loss).toLocaleString('ko-KR')}`],
    ['🏥 군병원(감소 줄임)', x(attritionMult(s))],
  ];
}

/** 쌓이는 것만 ms만큼(판단 없이) */
function accrue(s: GameState, ms: number): GameState {
  if (!(ms > 0)) return s;
  const days = ms / REAL_MS_PER_GAME_DAY;
  const nations: Record<string, NationState> = {};
  for (const [id, n] of Object.entries(s.nations)) {
    nations[id] = {
      treasury: n.treasury + budgetPerDay(s, id) * days,
      troops: n.troops * Math.exp(-TROOP_ATTRITION_PER_DAY * (id === s.player.countryId ? attritionMult(s) : 1) * days) + troopsPerDay(s, id) * days,
    };
  }
  const pendingSalary = Math.min(pendingCap(s), s.player.pendingSalary + salaryPerDay(s) * days);
  const economy = accrueEconomy(s, ms);
  return civAccrue(economyTick(applyContracts({ ...s, worldMs: s.worldMs + ms, player: { ...s.player, pendingSalary }, nations, economy }, ms)), ms);
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
    const pairsBefore = Object.fromEntries(Object.entries(world.pairs).map(([k, p]) => [k, { tension: p.tension }]));
    aiTick(world, nations, cur.worldMs, cur.player.countryId, generalDefense(cur.officer) * defenseMult(cur) * ordersDefense(cur), occupyHold(cur));
    world.nextTickMs += AI_TICK_MS;
    cur = { ...cur, nations, world };
    officerTick(cur, ownerBefore, AI_TICK_MS);
    cur = civTick(cur, pairsBefore);
    cur = mediaTick(assemblyTick(cabinetTick(presTick(spyTick(ordersTick(crisisTick(cur))), AI_TICK_MS), AI_TICK_MS)));
    world = cur.world;
  }
  return syncTitle(spyTick(ordersTick(crisisTick(checkVictory(cultureTick(accrue(cur, left)))))));
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

/** 시험용: 혜택 단계를 r로 바꿈(11-24부터 평소엔 늘 가장 높은 단계. 시간이 흐르면 다시 열림). 신뢰도·명성도 그 호칭쯤으로 맞춤 */
export function setRank(s: GameState, rankIndex: number): GameState {
  const r = Math.max(0, Math.min(RANKS.length - 1, rankIndex));
  const t = firstTierOfRank(r);
  const lo = TITLES[t].min;
  const hi = t + 1 < TITLES.length ? TITLES[t + 1].min - 1 : TITLE_MAX;
  const want = Math.round((lo + hi) / 2);
  const trust = Math.max(TRUST_START, Math.min(100, want - 100 + 5));
  const fame = Math.max(0, Math.min(1000, (want - trust) * 10));
  const ns = syncTitle({ ...s, officer: { ...s.officer, trust, fame }, player: { ...s.player, title: undefined } }, true);
  return { ...ns, player: { ...ns.player, rankIndex: r } };
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
