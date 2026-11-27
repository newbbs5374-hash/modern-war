// 게임 상태와 시간 흐름. 화면과 떨어진 순수 계산이라 시험(테스트)하기 쉽다.

import { addDef, defOf } from './defFund';
export { addDef, defOf };
import { applyNation } from './nation';
import { deployHelp, deployTick, type DeployState } from './deploy';
import { cultureTick, type CultureState } from './culture';
import { annexTick } from './annex';
import { occAdminTick } from './occAdmin';
import type { OccAdminState } from './occAdmin';
import { pressureTick, tariffMult, type PressureState } from './pressure';
import { surrenderTick, vassalMult, type VassalState } from './surrender';
import { hegemonyMult, hegemonyTick, type HegemonyState } from './hegemony';
import { bullyTick } from './bully';
import { applyOrigin, type OriginId } from './origin';
import type { LeaderLook } from '../data/looks';
import { START_SANCTIONS } from '../data/conflicts';
import { COUNTRIES, countryById } from '../data/world';
import { RANKS, TITLES, firstTierOfRank } from '../data/ranks';
import { TITLE_MAX, syncTitle } from './title';
import { PERSONALITIES } from '../data/leaders';
import { aiTick, applyNowConflicts, cloneWorld, incomeShare, newWorld, type WorldState } from './world';
import { applyContracts, contractMoneyPerHour } from './economy';
import { TRUST_START, generalDefense, newOfficer, officerTick, type OfficerState } from './officer';
import { checkVictory, type Ending } from './victory';
import type { Report } from './report';
import type { PeaceState } from './peace';
import type { GoalsState } from './goals';
import { crisisTick, newCrisis, type CrisisState } from './crisis';
import { meetTick, type MeetState } from './meet';
import { remarksTick, type RemarkState } from './remarks';
import { snsTick, type SnsState } from './leaderSns';
import { ensureRivalRoster } from './rivals';
import { ordersBudget, ordersDefense, ordersTick, type OrdersState } from './orders';
import { spyTick, type SpyState } from './spy';
import type { FleetState } from './fleet';
import type { GuideState } from './guide';
import { splitEco, splitTroop, taxBudget, TAX_INFO, taxOf, splitOf, type PolicyState } from './policy';
import { cabBudget, cabTroop, newCabinet, addBuddy, type CabinetState } from './cabinet';
import { cabinetTick } from './cabinetOps';
import { propTick, type PropState } from './proposals';
import type { ChatState } from './chat';
import type { ScheduleState } from './schedule';
import { lawEff, type AssemblyState } from './laws';
import { assemblyTick } from './assembly';
import { mediaTick, type MediaState } from './media';
import { domTick } from './domesticTick';
import type { PolityState } from './polity';
import type { DomState } from './domestic';
import { approvalBudgetMult, approvalTroopMult, presTick, type PresState } from './approval';
import { aiGovBudget, aiGovEff, civAccrue, civBudgetMult, civTick, techGoalTick, defenseMult, newCiv, sanctionMult, type CivState } from './civ';
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
  PLAYER_START_TREASURY_MULT,
  PLAYER_START_TROOPS_MULT,
  aiStrength,
  actAi,
  SIZE_BONUS_MAX,
  SIZE_BONUS_PER,
  PLAYER_BUDGET_MULT,
  AI_START_TREASURY_MULT,
} from './balance';

export const SAVE_VERSION = 7; // 5: 새 세계관(여명 군도), 6: 육각 타일 지도(도시 53개), 7: 현실 나라·도시 이름(11-23) — 예전 저장은 새 판으로

import { growBudget, growTroop } from './aiGrowth';
import { growTick } from './aiGrowthTick';
import { actsTick } from './acts';
import { counterTick, type CounterState } from './counter';
import { finaleTick, type FinaleState } from './finale';
import { sagaTick, type SagaState } from './saga';
import type { TourState } from './tour';
import { megaTick, type MegaState } from './megaPlan';
import { moleTick, type MoleState } from './mole';
import type { PrepState } from './prepOps';
import { warGoalTick, type WarGoals } from './warGoal';
import { raidTick, type RaidState } from './missileWar';
import type { JointState } from './jointOps';
import { wcTick, type WcState } from './worldCrisis';
import { secTick, type SecState } from './security';
import type { BattleLogState } from './battleLog';
import type { CampaignState } from './campaign';

export interface NationState {
  /** 나라 금고(나라 예산) */
  treasury: number;
  /** 병력(명) */
  troops: number;
  /** 국방비(11-26): 내 나라만. 부대 만들기·국방 시설 짓기·올리기·파병 유지비에만 쓴다 */
  def?: number;
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
    /** 내 얼굴(11-24). 옛 저장은 없음 → 예전 그림 */
    look?: LeaderLook;
    /** 지금 세계 정세로 시작한 판(11-24) */
    realWorld?: boolean;
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
  /** 승리한 뒤 '계속 플레이'를 고른 기록(11-25). 같은 승리는 다시 끝내지 않음. 옛 저장은 없음 */
  wins?: Ending[];
  /** 부관 보고(아직 안 본 것) */
  reports?: Report[];
  /** 문명식 운영(연구·체제·호감·협정·분쟁 지역·국제 회의·도시 구역/민심/인구). 옛 저장은 불러올 때 채움 */
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
  /** 정치인 발언(11-24) */
  remarks?: RemarkState;
  /** 대통령식 내정: 지지도·탄핵 위기·기록(없으면 처음 쓸 때 채움) */
  pres?: PresState;
  /** 인물·부처(11-23) */
  cabinet?: CabinetState;
  /** 장관·장군·부관 건의와 도시 개발 계획(11-25) */
  props?: PropState;
  /** 11-27 점령지 관리청(편입 전 점령 도시를 맡는 관리단·건의, game/occAdmin.ts) */
  occAdmin?: OccAdminState;
  /** 인물 대화 기록(11-25) */
  chat?: ChatState;
  /** 11-27 인물 만남·인연·부탁·인맥 수첩(game/meet.ts) */
  meet?: MeetState;
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
  /** 해외 파병(11-24). 없으면 파병 없음 */
  deploy?: DeployState;
  /** 11-27 AI 반격(빼앗은 도시를 되찾으러 옴) */
  counter?: CounterState;
  /** 11-27 전역(나라별 연승 기세·보급선) */
  campaign?: CampaignState;
  /** 11-27 4장 마지막 위기 진행 */
  finale?: FinaleState;
  /** 11-27 연속 위기 이야기 */
  saga?: SagaState;
  /** 11-27 지방 순방 */
  tour?: TourState;
  /** 11-27 국가 대계획 */
  mega?: MegaState;
  /** 11-27 방첩 */
  mole?: MoleState;
  /** 11-27 사전 작전 */
  prep?: PrepState;
  /** 11-27 전쟁 목표(나라 → 목표) */
  warGoals?: WarGoals;
  /** 11-27 미사일·드론 전 */
  raid?: RaidState;
  /** 11-27 연합 합동 작전 */
  joint?: JointState;
  /** 11-27 주간 세계 위기 */
  wcrisis?: WcState;
  /** 11-27 점령지 치안 작전 */
  sec?: SecState;
  /** 11-27 전투 기록관 */
  blog?: BattleLogState;
  /** 내정 확장(국정 과제·이익집단·기본법·특구·대형 사업·예산 국회·사진첩, 11-24). 없으면 처음 쓸 때 채움 */
  dom?: DomState;
  /** 정상 SNS(11-26). 없으면 처음 쓸 때 채움 */
  sns?: SnsState;
  /** 관세(11-26 난이도). 없으면 관세 없음 */
  pressure?: PressureState;
  /** 속국 항복(11-26). 없으면 속국 없음 */
  vassal?: VassalState;
  /** 11-27 대륙 패권·제재·약탈 계약·도움 요청(hegemony.ts). 없으면 처음 판단 때 채움 */
  hegemony?: HegemonyState;
  /** 내정 새 콘텐츠 8가지(11-26: 선거·경제 지표·재난·감사·지사·인구·개헌·연설). 없으면 처음 쓸 때 채움 */
  polity?: PolityState;
}

export interface NewGameOptions {
  /** 지도자 성향을 무작위로 */
  randomLeaders?: boolean;
  /** 세계 난수 씨앗(시험용으로 고정할 수 있음) */
  seed?: number;
  /** 지도자 출신(11-23) */
  origin?: OriginId;
  /** 지금 세계 정세로 시작(러-우 전쟁 등, 11-24). 끄면 모두 평화로 출발 */
  realWorld?: boolean;
  /** 내 얼굴(남/여 × 30·40·50·60대, 11-24) */
  look?: LeaderLook;
  /** 11-27 4막 구조로 시작(게임 화면에서 새 판을 만들 때 켬). 끄면 막 제한 없음 */
  acts?: boolean;
}

export function newGame(name: string, countryId: string, now: number, opt: NewGameOptions = {}): GameState {
  countryById(countryId); // 없는 나라면 오류
  applyNation(countryId); // 11-25 부처·참모·시설 이름을 그 나라 것으로
  const nations: Record<string, NationState> = {};
  for (const c of COUNTRIES) {
    // 11-26 난이도: 내 나라는 적게, 한국을 뺀 AI 나라는 힘 배율만큼 많이
    const k = aiStrength(c.id, countryId);
    const mine = c.id === countryId;
    nations[c.id] = {
      treasury: c.budget * START_TREASURY_PER_POINT * k * (mine ? PLAYER_START_TREASURY_MULT : AI_START_TREASURY_MULT),
      troops: c.military * START_TROOPS_PER_POINT * k * (mine ? PLAYER_START_TROOPS_MULT : 1),
    };
    if (mine) {
      // 11-26 국방비 나누기: 나라 예산과 따로 시작 국방비(나라 예산의 절반)
      nations[c.id] = { ...nations[c.id], def: nations[c.id].treasury * START_DEF_SHARE };
    }
  }
  const world = newWorld(opt.seed ?? (now ^ 0x5eed) >>> 0, !!opt.randomLeaders, AI_TICK_MS);
  if (opt.realWorld) applyNowConflicts(world, countryId);
  if (opt.acts) {
    world.act = 1;
    world.actSinceMs = 0;
    // 1장에는 내 나라가 전쟁을 하지 않음: 시작부터 전쟁 중인 나라(러·우)는 잠깐 휴전으로 출발
    for (const [key, p] of Object.entries(world.pairs)) if (p.rel === '전쟁' && key.split('|').includes(countryId)) { p.rel = '휴전'; p.tension = 0; }
  }
  const s: GameState = {
    version: SAVE_VERSION,
    worldMs: 0,
    lastRealTime: now,
    player: { name, countryId, rankIndex: 0, salary: 0, pendingSalary: 0, ...(opt.look ? { look: opt.look } : {}), ...(opt.realWorld ? { realWorld: true } : {}) },
    nations,
    debugSkippedMs: 0,
    world,
    // 11-26 난이도: 시험판 자원 넉넉히(testgrant.ts)는 새 판에선 안 줌 → 이미 받은 것으로 표시(TEST_GRANT_NOW)
    officer: { ...newOfficer(((opt.seed ?? now) * 7 + 13) >>> 0), testGrant: 4 },
    economy: newEconomy(),
    ending: null,
    civ: newCiv({ world, worldMs: 0 }),
    crisis: newCrisis(0),
  };
  s.cabinet = newCabinet(s);
  ensureRivalRoster(s, true); // 11/26 정적 12명: 그 나라 이름·얼굴
  if (opt.realWorld) {
    // 시작부터 국제 제재를 받는 나라(러시아): 나라 예산 −20%
    for (const [id, days] of Object.entries(START_SANCTIONS)) s.civ!.council.active.push({ agenda: 'sanction', target: id, untilMs: days * REAL_MS_PER_GAME_DAY });
  }
  return syncTitle(opt.origin ? addBuddy(applyOrigin(s, opt.origin), opt.origin, null) : s, true);
}

/** 나라 특수 능력 중 병력에 붙는 배율(기획서의 나라별 특수 능력치) */
export const TROOP_BONUS: Record<string, number> = { il: 1.4, kp: 1.5, in: 1.4, pl: 1.1, ng: 1.2, br: 1.1, co: 1.1, fi: 1.3 };
/** 나라 특수 능력 중 나라 예산에 붙는 배율(11-26 사우디 오일 머니) */
export const BUDGET_BONUS: Record<string, number> = { sa: 1.2, eg: 1.1, za: 1.1, dz: 1.1, br: 1.1, ve: 1.15, au: 1.15, mx: 1.1, es: 1.1 };

export function salaryPerDay(s: GameState): number {
  return RANKS[s.player.rankIndex].salaryPerDay;
}
export function pendingCap(s: GameState): number {
  return salaryPerDay(s) * (PENDING_CAP_HOURS * 60 * 60 * 1000) / REAL_MS_PER_GAME_DAY;
}
// ── 국방비(11-26 대장 결정) ──
// 나라 수입 중 예산 나누기의 국방 몫(기본 40%)은 국방비로, 나머지는 나라 예산으로 들어간다.
// 국방비는 부대 만들기·국방 시설 짓기·올리기(·파병 유지비)에만 쓰고, 나머지는 모두 나라 예산을 쓴다.
/** 새 판 시작 국방비 = 시작 나라 예산 × 이 값 */
export const START_DEF_SHARE = 0.5;
/** 수입 중 국방비로 가는 몫(0~1) */
export const defShare = (s: GameState) => splitOf(s).def / 100;
/** 국방비 시간당 */
export const defPerDay = (s: GameState) => budgetPerDay(s, s.player.countryId) * defShare(s);
/** 나라 예산 시간당(국방비 몫을 뺀 것) */
export const nationPerDay = (s: GameState) => budgetPerDay(s, s.player.countryId) * (1 - defShare(s));
/** 하루 나라 예산 = 시작 예산 × 지도자 성향 × 가진 도시 비율 */
export function budgetPerDay(s: GameState, countryId: string): number {
  const lead = PERSONALITIES[s.world.personalities[countryId]].budget;
  const ind = countryId === s.player.countryId ? budgetMult(s) * civBudgetMult(s) * ordersBudget(s) * approvalBudgetMult(s) * splitEco(s) * taxBudget(s) * cabBudget(s) * (1 + lawEff(s, 'budget')) * tariffMult(s, countryId) * vassalMult(s, countryId) * hegemonyMult(s, countryId) : sanctionMult(s, countryId) * aiGovBudget(s, countryId) * aiStrength(countryId, s.player.countryId) * growBudget(s.world, countryId) * tariffMult(s, countryId) * vassalMult(s, countryId) * hegemonyMult(s, countryId);
  const share = incomeShare(s.world, countryId, true);
  const size = countryId === s.player.countryId ? sizeBonus(share) * PLAYER_BUDGET_MULT : 1;
  return countryById(countryId).budget * BUDGET_PER_DAY_PER_POINT * lead * share * size * ind * (BUDGET_BONUS[countryId] ?? 1);
}
/** 11-27 나라 규모 보너스(내 나라만): 가진 도시 값어치가 본토보다 커진 만큼 × 0.2, 최대 +40% */
export const sizeBonus = (share: number) => 1 + Math.min(SIZE_BONUS_MAX, Math.max(0, share - 1) * SIZE_BONUS_PER);
/**
 * 11-27 내정 비용 기준(시간당 수입 한 시간치).
 * 예전엔 비용을 '지금 수입 × N시간'으로 매겨 나라가 커지면 비용도 똑같이 커졌음 → 땅을 늘려도 여유가 안 생김.
 * 이제 본토보다 커진 만큼(가진 도시·규모 보너스)은 비용에 넣지 않음. 본토 이하일 땐 예전과 같음.
 */
export function priceBase(s: GameState): number {
  const share = incomeShare(s.world, s.player.countryId, true);
  return budgetPerDay(s, s.player.countryId) / (Math.max(1, share) * sizeBonus(share) * PLAYER_BUDGET_MULT);
}
/** 하루 모병 = 군사력 × 나라 보너스 × 가진 도시 비율 */
export function troopsPerDay(s: GameState, countryId: string): number {
  return (
    countryById(countryId).military *
    TROOPS_PER_DAY_PER_POINT *
    (TROOP_BONUS[countryId] ?? 1) *
    incomeShare(s.world, countryId) *
    (countryId === s.player.countryId ? welfareMult(s) * approvalTroopMult(s) * splitTroop(s) * cabTroop(s) * (1 + lawEff(s, 'troop')) : aiStrength(countryId, s.player.countryId) * actAi(s.world) * growTroop(s.world, countryId))
  );
}

/** 금고 화면 말풍선: 시간당 숫자가 어떻게 나오는지 [이름, 값] */
export function budgetBreakdown(s: GameState): Array<[string, string]> {
  const me = s.player.countryId;
  const p = s.world.personalities[me];
  const share = incomeShare(s.world, me, true);
  const x = (v: number) => `×${(Math.round(v * 100) / 100).toFixed(2)}`;
  return [
    ['기본(나라 예산 점수)', `${Math.round(countryById(me).budget * BUDGET_PER_DAY_PER_POINT).toLocaleString('ko-KR')}`],
    [`지도자 성향(${p})`, x(PERSONALITIES[p].budget)],
    ...(BUDGET_BONUS[me] ? [['나라 특수 능력', x(BUDGET_BONUS[me])] as [string, string]] : []),
    ['가진 도시(점령지 60%·민정 85%)', x(share)],
    ['💹 기본 예산 2배', x(PLAYER_BUDGET_MULT)],
    ...(sizeBonus(share) > 1 ? [['🌏 나라 규모 보너스', x(sizeBonus(share))] as [string, string]] : []),
    ['🏭 군수공장', x(budgetMult(s))],
    ['🏛️ 체제·카드·도시 민심·인구', x(civBudgetMult(s))],
    ['🙂 지지도', x(approvalBudgetMult(s))],
    [`💰 경제 예산 ${splitOf(s).eco}%`, x(splitEco(s))],
    [`${TAX_INFO[taxOf(s)].icon} 세금 ${TAX_INFO[taxOf(s)].name}`, x(taxBudget(s))],
    ['💰 기획재정부', x(cabBudget(s))],
    ['📜 법', x(1 + lawEff(s, 'budget'))],
    ['📦 관세(맞은 것·매긴 것)', x(tariffMult(s, me))],
    ['🏳️ 속국 공물(바침·받음)', x(vassalMult(s, me))],
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
  const me = s.player.countryId;
  const share = defShare(s);
  for (const [id, n] of Object.entries(s.nations)) {
    const inc = budgetPerDay(s, id) * days;
    nations[id] = {
      ...(id === me ? { def: (n.def ?? 0) + inc * share } : {}),
      treasury: n.treasury + (id === me ? inc * (1 - share) : inc),
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
    aiTick(world, nations, cur.worldMs, cur.player.countryId, generalDefense(cur.officer) * defenseMult(cur) * ordersDefense(cur), occupyHold(cur), deployHelp(cur), aiGovEff(cur));
    growTick(world, nations, cur.worldMs, cur.player.countryId); // 11-26 AI 나라가 성향대로 성장
    world.nextTickMs += AI_TICK_MS;
    cur = { ...cur, nations, world };
    officerTick(cur, ownerBefore, AI_TICK_MS);
    cur = hegemonyTick(bullyTick(surrenderTick(pressureTick(occAdminTick(annexTick(deployTick(civTick(cur, pairsBefore))))))));
    cur = techGoalTick(secTick(wcTick(raidTick(warGoalTick(moleTick(megaTick(sagaTick(counterTick(finaleTick(actsTick(cur)))))))))));
    cur = meetTick(propTick(domTick(snsTick(remarksTick(mediaTick(assemblyTick(cabinetTick(presTick(spyTick(ordersTick(crisisTick(cur))), AI_TICK_MS), AI_TICK_MS))))))));
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
