// 3단계: 장교의 성장(스탯·공훈·승급), 임무, 간이 훈련, 부관·장군, 라이벌, 불신임.
// 전투·훈련 미니게임(4·5단계)이 생기기 전까지는 스탯으로 결과를 자동 계산한다.

import { originEff } from './origin';
import { cabMission } from './cabinet';
import { TEST_BOOSTS } from './boost';
import { CITIES, cityById } from '../data/cities';
import {
  AIDE_SPECIALTIES,
  GENERAL_FIELDS,
  GENERAL_STYLES,
  MISSION_KINDS,
  NAME_POOL,
  START_STAT,
  STAT_IDS,
  GRAND_COOLDOWN_HOURS,
  GRAND_RANK,
  OPERATION_RANK,
  aideSlots,
  generalSlots,
  statCap,
  statExpNeed,
  TRAIN_EXP_PER_STAR,
  TRAIN_EXP_LOSE,
  MISSION_EXP_WIN,
  MISSION_EXP_LOSE,
  type AideSpecialty,
  type MissionKind,
  type StatId,
} from '../data/officers';
import { TRAININGS } from '../data/catalog';
import { OPERATIONS } from '../battle/spec';
import { RANKS } from '../data/ranks';
import { COUNTRIES, countryById } from '../data/world';
import { CAPTURED_DEFENSE, REAL_MS_PER_GAME_DAY } from './balance';
import { Rng } from './rng';
import { talkTick, type Promise_, type Talk } from './talk';
import type { GameState } from './state';
import { armyPower } from './economy';
import { FIELD_AMMO_COST, FIELD_FUEL_COST } from '../data/economy';
import { civMission, eureka } from './civ';
import { addPresMod } from './approval';
import { facBonus } from './facility';
import { citiesOf, eul, ga, isAlive, relationOf, type WorldEvent } from './world';
import { RIVAL_ROLES, hasAlly, rivalTick, shiftInfluence, type RivalRole } from './rivals';
import { addLoyalty, generalMissionBonus, loyaltyMissionBonus, loyaltyMissionMult, loyaltyRewardMult, loyaltyTick, schoolTick, touchAide } from './loyal';

const HOUR = 60 * 60 * 1000;

// ── 숫자(초안) ──
export const DRILL_MAX = 6;
export const DRILL_REFILL_MS = 4 * HOUR;
export const BOARD_REFRESH_MS = 6 * HOUR;
export const EXAM_HOURS = 2;
export const EXAM_COOLDOWN_MS = 6 * HOUR;
export const MISSION_MERIT = 40;
export const TRUST_START = 50;
export const TRUST_WARN = 25;
export const TRUST_SAFE = 40;
export const DISMISS_DEADLINE_MS = 72 * HOUR;
/** 불신임 경고가 생기는 계급(준장부터 = 사령관 시대) */
export const COMMAND_RANK = 6;
export const RECRUIT_COST = 3000;
/** 장군 능력 1점당 내 나라 도시 방어 보너스 */
export const GENERAL_DEFENSE_PER_SKILL = 0.015;

export interface Aide {
  id: number;
  name: string;
  specialty: AideSpecialty;
  level: number;
  exp: number;
  /** 신뢰(인연) 0~100 */
  bond: number;
  /** 들려준 인연 이야기 수(인연 30·60·90) */
  stories?: number;
  /** 마지막으로 선물·특별 훈련한 게임 날짜 */
  giftDay?: number;
  trainDay?: number;
  /** 따로 보낸 부관 임무(이 동안은 전투·임무에 못 나감) */
  errand?: { kind: ErrandKind; endMs: number } | null;
  /** 충성 0~100(옛 저장은 인연으로 채움, loyal.ts) */
  loyalty?: number;
  /** 마지막으로 돌본 시각(대화·선물·훈련·임무·전투) */
  seenMs?: number;
  /** 장군 교육 중(이 동안 전투·임무에 못 나감) · 교육을 마침 */
  school?: { endMs: number } | null;
  schooled?: boolean;
}

export type ErrandKind = '정보 수집' | '보급 조달' | '전공 쌓기';
export const ERRANDS: Record<ErrandKind, { hours: number; icon: string; text: string }> = {
  '정보 수집': { hours: 2, icon: '🕵️', text: '정보 점수 + · 정찰·통신 특기면 2배' },
  '보급 조달': { hours: 3, icon: '📦', text: '봉급 + · 공병·의무 특기면 2배' },
  '전공 쌓기': { hours: 4, icon: '🎖️', text: '공훈 + · 저격 특기면 2배' },
};
const ERRAND_FIT: Record<ErrandKind, string[]> = { '정보 수집': ['정찰', '통신'], '보급 조달': ['공병', '의무'], '전공 쌓기': ['저격'] };

/** 인연 이야기(특기마다 3편) */
export const AIDE_STORIES: Record<string, string[]> = {
  저격: ['총을 처음 잡은 날, 아버지의 사냥총 이야기를 들려줬어요.', '"당신 등 뒤는 제가 지킵니다." 조준경 너머로 웃었어요.', '전쟁이 끝나면 산에서 별을 보겠다고 했어요. 그날까지 함께하겠대요.'],
  의무: ['야전병원에서 밤새 버틴 이야기를 들려줬어요.', '당신이 다친 병사를 업고 온 날을 기억한대요.', '"한 명도 잃지 않는 게 제 전쟁이에요." 당신 곁에 끝까지 남겠대요.'],
  통신: ['무전기 너머 고향 라디오를 몰래 들었던 이야기를 해 줬어요.', '적 암호를 처음 풀던 밤, 당신이 커피를 건넸던 걸 기억한대요.', '"당신 목소리는 어떤 잡음 속에서도 들려요." 끝까지 연결해 두겠대요.'],
  공병: ['다리를 놓던 첫 작전 이야기를 들려줬어요.', '무너진 진지에서 당신을 꺼낸 날을 웃으며 꺼냈어요.', '전쟁이 끝나면 부서진 도시를 다시 짓고 싶대요. 그 첫 벽돌을 같이 놓재요.'],
  정찰: ['혼자 사흘을 숲에서 버틴 이야기를 해 줬어요.', '당신이 자기 보고를 믿어 준 첫 지도자라고 했어요.', '"어디든 먼저 가서 길을 보여 드릴게요." 당신의 눈이 되겠대요.'],
};
export const STORY_AT = [30, 60, 90];

export interface General {
  id: number;
  name: string;
  field: (typeof GENERAL_FIELDS)[number];
  style: (typeof GENERAL_STYLES)[number];
  /** 능력 1~10 */
  skill: number;
  /** 충성도 0~100 */
  loyalty: number;
  from: '부관 승격' | '부관 임명' | '영입' | '인재 임명';
  /** 부관 시절 인연 · 특기(부관에서 임명된 장군만) */
  bond?: number;
  specialty?: AideSpecialty;
  /** 마지막 작전 회의·격려 시각 */
  seenMs?: number;
}

export interface Rival {
  name: string;
  /** 영향력이 쌓이는 빠르기(옛 '하루 공훈', 170~260) */
  rate: number;
  /** 예전 계급 알림(이제 안 씀) */
  shownRank: number;
  /** 11/23 정적: 역할 · 영향력 0~100 · 협력(회유 성공) · 회유 횟수 · 다음 방해 시각 · 동향 살피기 끝 */
  role?: RivalRole;
  influence?: number;
  ally?: boolean;
  woo?: number;
  nextPlotMs?: number;
  watchUntil?: number;
}

export interface Mission {
  id: number;
  kind: MissionKind;
  title: string;
  /** 대상 도시 */
  city: string;
  /** 난이도 0.8~1.4 */
  difficulty: number;
  hours: number;
  exam?: boolean;
  /** 작전 종류 번호(spec의 OPERATIONS) */
  op?: number;
  /** 대전투를 지도 위 전투로(아니면 다섯 판) */
  field?: boolean;
  /** 지도 위 대전투: 출발 때 채운 연료·탄약(0~1) */
  fuel?: number;
  ammo?: number;
}

export interface ActiveMission extends Mission {
  startMs: number;
  endMs: number;
}

export interface OfficerState {
  seed: number;
  nextId: number;
  /** 스탯(정수). 경험치가 다 차면 1씩 오름 */
  stats: Record<StatId, number>;
  /** 스탯마다 모은 경험치(다음 1점까지) */
  statExp?: Partial<Record<StatId, number>>;
  /** 이번 계급에서 모은 공훈 / 전체 공훈 */
  merit: number;
  totalMerit: number;
  /** 명성(국민 인기) · 의회 신뢰도(0~100) · 정보 점수 */
  fame: number;
  trust: number;
  intel: number;
  /** 훈련 일정: anchor 시각에 count개였음(이후 4시간마다 1개) */
  drills: number;
  drillAnchorMs: number;
  /** 이번 계급에서 모은 훈련 별 */
  stars: number;
  /** 오늘(게임 날짜) 훈련 횟수 — 같은 훈련 3번째부터 절반 */
  trainDay: number;
  trainCounts: Record<string, number>;
  board: Mission[];
  boardMs: number;
  active: ActiveMission | null;
  examReadyMs: number;
  aides: Aide[];
  generals: General[];
  rivals: Rival[];
  /** 불신임 경고(이 시각까지 신뢰도를 회복하지 못하면 불신임) */
  dismissDeadlineMs: number | null;
  /** 지도자 자리를 가진 라이벌 이름(없으면 null) */
  chiefRival: string | null;
  /** 5단계: 지금 하고 있는 훈련(훈련 일정을 이미 씀) */
  training: { name: string; seed: number } | null;
  /** 다음 대전투를 열 수 있는 시각 */
  grandReadyMs: number;
  /** 훈련별 별 3개 받은 횟수(특기) */
  perfect: Record<string, number>;
  /** 훈련별 한 횟수(숙련) · 최고 별 */
  mastery?: Record<string, number>;
  best?: Record<string, number>;
  /** 지도자 외교를 다시 할 수 있는 시각 */
  diploReadyMs?: number;
  /** 승리 조건을 처음 채운 때(계속 지키는 중). 못 채우면 null */
  winSinceMs?: number | null;
  /** 가속권 */
  boosts?: number;
  /** 대화: 답을 기다리는 대화 · 다음 대화 시각 · 불가침 약속 */
  talks?: Talk[];
  talkNextMs?: number;
  promises?: Promise_[];
  /** 시험판 자원 지급을 받았는지 */
  testGrant?: number;
  /** 승급 심사에 떨어지면 6시간 기다리기(시험판 기본은 꺼짐) */
  examPenalty?: boolean;
  /** 인물 창 교류를 마지막으로 한 게임 날짜("aide:3:chat" → 날짜) */
  people?: Record<string, number>;
}

export function newOfficer(seed: number): OfficerState {
  const rng = new Rng(seed);
  const stats = {} as Record<StatId, number>;
  for (const id of STAT_IDS) stats[id] = START_STAT;
  const names = [...NAME_POOL];
  const take = () => names.splice(Math.floor(rng.next() * names.length), 1)[0];
  const rivals: Rival[] = RIVAL_ROLES.map((role) => {
    const rate = Math.round(rng.range(170, 260));
    return { name: take(), rate, shownRank: 0, role, influence: Math.round(25 + (rate - 170) / 4), nextPlotMs: 6 * HOUR };
  });
  return {
    seed: rng.seed,
    nextId: 1,
    stats,
    statExp: {},
    merit: 0,
    totalMerit: 0,
    fame: 0,
    trust: TRUST_START,
    intel: 0,
    drills: DRILL_MAX,
    drillAnchorMs: 0,
    stars: 0,
    trainDay: 0,
    trainCounts: {},
    board: [],
    boardMs: 0,
    active: null,
    examReadyMs: 0,
    aides: [],
    generals: [],
    rivals,
    dismissDeadlineMs: null,
    chiefRival: null,
    training: null,
    grandReadyMs: 0,
    boosts: TEST_BOOSTS,
    perfect: {},
  };
}

// ── 공통 도우미 ──

export function withOfficer(s: GameState, f: (o: OfficerState, rng: Rng, s: GameState) => void): GameState {
  const o: OfficerState = structuredClone(s.officer);
  const rng = new Rng(o.seed);
  const next: GameState = { ...s, officer: o, world: { ...s.world, events: [...s.world.events], defense: { ...s.world.defense }, owner: { ...s.world.owner } } };
  f(o, rng, next);
  o.seed = rng.seed;
  return next;
}

export function note(s: GameState, text: string) {
  const ev: WorldEvent = { t: s.worldMs, kind: '장교', text, mine: true };
  s.world.events.unshift(ev);
  if (s.world.events.length > 150) s.world.events.length = 150;
}

const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));

export function rankName(r: number) {
  return RANKS[r].name;
}

// ── 훈련 일정 ──

export function drillsNow(o: OfficerState, worldMs: number): { count: number; nextInMs: number } {
  if (o.drills >= DRILL_MAX) return { count: DRILL_MAX, nextInMs: 0 };
  const gained = Math.floor((worldMs - o.drillAnchorMs) / DRILL_REFILL_MS);
  const count = Math.min(DRILL_MAX, o.drills + Math.max(0, gained));
  const nextInMs = count >= DRILL_MAX ? 0 : DRILL_REFILL_MS - ((worldMs - o.drillAnchorMs) % DRILL_REFILL_MS);
  return { count, nextInMs };
}

function useDrill(o: OfficerState, worldMs: number): boolean {
  const { count } = drillsNow(o, worldMs);
  if (count <= 0) return false;
  // 가득 차 있었다면 지금부터 충전 시작, 아니면 충전 진행을 유지
  if (count >= DRILL_MAX) {
    o.drillAnchorMs = worldMs;
  } else {
    const gained = Math.floor((worldMs - o.drillAnchorMs) / DRILL_REFILL_MS);
    o.drillAnchorMs += Math.max(0, gained) * DRILL_REFILL_MS;
  }
  o.drills = count - 1;
  return true;
}

// ── 간이 훈련(5단계 미니게임 자리) ──

export const TRAINING_STATS: Record<string, StatId[]> = {
  잠입: ['은밀'],
  체력: ['체력'],
  전술: ['전술'],
  사격: ['사격'],
  포격: ['포격'],
  정보: ['정보'],
  통솔: ['통솔'],
  보급: ['군수'],
  해킹: ['정보', '은밀'],
  모병: ['정치'],
  항공: ['사격', '전술'],
  해상: ['전술', '통솔'],
};

export type TrainResult =
  | { ok: false; why: string }
  | {
      ok: true;
      stars: number;
      /** 오른 스탯 점수 */
      gains: Partial<Record<StatId, number>>;
      /** 받은 경험치 */
      exp: Partial<Record<StatId, number>>;
      perk?: string;
      featured?: boolean;
      masteryUp?: number;
      record?: boolean;
    };

/** 다음 1점까지 모은 경험치 */
export const statExpOf = (o: OfficerState, id: StatId) => o.statExp?.[id] ?? 0;

/**
 * 스탯 경험치 주기: 다 차면 스탯 +1(여러 번 오를 수 있음). 상한이면 경험치는 더 쌓이지 않음.
 * 오른 점수를 돌려줌.
 */
export function gainStatExp(o: OfficerState, id: StatId, exp: number, cap: number): number {
  const ex = (o.statExp ??= {});
  const before = o.stats[id];
  let v = Math.floor(before);
  let e = (ex[id] ?? 0) + Math.max(0, exp);
  while (v < cap && e >= statExpNeed(v)) {
    e -= statExpNeed(v);
    v++;
  }
  if (v >= cap) {
    v = Math.max(v, Math.floor(before));
    e = 0;
  }
  o.stats[id] = v;
  ex[id] = Math.round(e * 10) / 10;
  return v - Math.floor(before);
}

/** 숙련 단계: 같은 훈련을 이만큼 하면 1~5단계(단계마다 오르는 스탯 +10%) */
export const MASTERY_AT = [0, 5, 15, 30, 60];
export const MASTERY_NAME = ['초보', '익숙', '능숙', '숙련', '달인'];
export function masteryLevel(runs: number): number {
  let k = 0;
  while (k < MASTERY_AT.length - 1 && runs >= MASTERY_AT[k + 1]) k++;
  return k + 1;
}
/** 오늘의 훈련(게임 날짜마다 바뀜): 오르는 스탯 2배 */
export function featuredTraining(worldMs: number, rank: number): string {
  const list = TRAININGS.filter((t) => t.rank <= rank);
  const day = Math.floor(worldMs / REAL_MS_PER_GAME_DAY);
  return list[(day * 7 + 3) % list.length].name;
}

/** 훈련 별 3개를 이만큼 받으면 특기 */
export const PERK_AT = 10;
export const PERKS: Record<string, string> = {
  잠입: '그림자 걸음',
  사격: '명사수',
  체력: '강철 체력',
  포격: '포병 감각',
  전술: '전장의 눈',
  통솔: '타고난 지휘관',
};

export function canTrain(s: GameState, name: string): string | null {
  const t = TRAININGS.find((x) => x.name === name);
  if (!t) return '없는 훈련';
  if (s.player.rankIndex < t.rank) return `${rankName(t.rank)}부터 할 수 있어요`;
  if (s.officer.training) return `하던 ${s.officer.training.name} 훈련을 먼저 끝내세요`;
  if (drillsNow(s.officer, s.worldMs).count <= 0) return '훈련 일정이 없어요';
  return null;
}

/** 훈련 시작: 훈련 일정 1개를 씀. 전투 화면에서 끝나면 finishTraining */
export function startTraining(s: GameState, name: string): GameState {
  if (canTrain(s, name)) return s;
  return withOfficer(s, (o, rng, ns) => {
    useDrill(o, ns.worldMs);
    o.training = { name, seed: Math.floor(rng.next() * 1e9) };
  });
}

/**
 * 훈련 결과 반영. auto(자동·즉시완료)면 별 최대 2개.
 * 별이 많을수록 스탯이 더 오르고, 져도 조금은 오름. 같은 훈련은 하루 3번째부터 절반.
 */
export function finishTraining(s: GameState, outcome: { win: boolean; stars: number; auto: boolean }): { state: GameState; result: TrainResult } {
  const cur = s.officer.training;
  if (!cur) return { state: s, result: { ok: false, why: '하고 있는 훈련이 없어요' } };
  const name = cur.name;
  let result: TrainResult = { ok: false, why: '' };
  const state = withOfficer(s, (o, rng, ns) => {
    o.training = null;
    const day = Math.floor(ns.worldMs / REAL_MS_PER_GAME_DAY);
    if (o.trainDay !== day) {
      o.trainDay = day;
      o.trainCounts = {};
    }
    o.trainCounts[name] = (o.trainCounts[name] ?? 0) + 1;
    const stars = outcome.win ? Math.min(outcome.auto ? 2 : 3, Math.max(1, outcome.stars)) : 0;
    const ids = TRAINING_STATS[name];
    const cap = statCap(ns.player.rankIndex);
    const tired = o.trainCounts[name] >= 3 ? 0.5 : 1;
    const mastery = (o.mastery ??= {});
    const best = (o.best ??= {});
    const lvBefore = masteryLevel(mastery[name] ?? 0);
    mastery[name] = (mastery[name] ?? 0) + 1;
    const lvAfter = masteryLevel(mastery[name]);
    const featured = featuredTraining(ns.worldMs, ns.player.rankIndex) === name;
    const record = stars > (best[name] ?? 0);
    if (record) best[name] = stars;
    const mult = tired * (1 + 0.1 * (lvBefore - 1)) * (featured ? 2 : 1) * (1 + facBonus(ns, '훈련소')) * (1 + originEff(ns, 'train'));
    const gains: Partial<Record<StatId, number>> = {};
    const exp: Partial<Record<StatId, number>> = {};
    for (const id of ids) {
      exp[id] = Math.round((stars ? stars * TRAIN_EXP_PER_STAR : TRAIN_EXP_LOSE) * mult);
      gains[id] = gainStatExp(o, id, exp[id]!, cap);
    }
    o.stars += stars;
    let perk: string | undefined;
    if (stars === 3) {
      o.perfect[name] = (o.perfect[name] ?? 0) + 1;
      if (o.perfect[name] === PERK_AT && PERKS[name]) {
        perk = PERKS[name];
        note(ns, `특기 "${perk}"을 얻었어요(${name} 별 3개 ${PERK_AT}번).`);
      }
    }
    // 모병 훈련 별 3개: 숨은 인재가 부관으로 합류(칸이 있으면)
    if (name === '모병' && stars === 3 && o.aides.length < aideSlots(ns.player.rankIndex) && rng.chance(0.5)) {
      const a = makeAide(o, rng);
      o.aides.push(a);
      note(ns, `모병 훈련에서 숨은 인재 ${ga(a.name)} 부관으로 합류했어요(${a.specialty}).`);
    }
    // 모병 훈련은 나라 병력도 조금 보탬
    if (name === '모병' && stars > 0) {
      const me = ns.player.countryId;
      ns.nations = { ...ns.nations, [me]: { ...ns.nations[me], troops: ns.nations[me].troops + 500 * stars } };
    }
    if (lvAfter > lvBefore) note(ns, `${name} 훈련 숙련 ${MASTERY_NAME[lvAfter - 1]}(${lvAfter}단계)! 오르는 스탯 +${(lvAfter - 1) * 10}%`);
    result = { ok: true, stars, gains, exp, perk, featured, masteryUp: lvAfter > lvBefore ? lvAfter : undefined, record };
  });
  const got = (result as TrainResult).ok ? ((result as { stars?: number }).stars ?? 0) : 0;
  return { state: got ? eureka(state, { kind: 'train', name, stars: got }) : state, result };
}

/** 특기 효과(전투 보정) */
export function perkBonus(o: OfficerState): Record<string, number> {
  const has = (n: string) => (o.perfect[n] ?? 0) >= PERK_AT;
  return {
    은밀: has('잠입') ? 4 : 0,
    사격: has('사격') ? 4 : 0,
    체력: has('체력') ? 4 : 0,
    포격: has('포격') ? 4 : 0,
    전술: has('전술') ? 4 : 0,
    통솔: has('통솔') ? 4 : 0,
  };
}

// ── 부관 ──

function pickName(o: OfficerState, rng: Rng): string {
  const used = new Set([...o.aides.map((a) => a.name), ...o.generals.map((g) => g.name), ...o.rivals.map((r) => r.name)]);
  const free = NAME_POOL.filter((n) => !used.has(n));
  return free.length ? rng.pick(free) : `${rng.pick(NAME_POOL)} ${o.nextId}`;
}

export function makeAide(o: OfficerState, rng: Rng): Aide {
  return { id: o.nextId++, name: pickName(o, rng), specialty: rng.pick([...AIDE_SPECIALTIES]), level: 1, exp: 0, bond: 10, stories: 0, errand: null };
}

/** 시험 버튼: 부관 한 명 데려오기(칸이 남으면) */
export function debugAddAide(s: GameState): GameState {
  if (s.officer.aides.length >= Math.max(1, aideSlots(s.player.rankIndex))) return s;
  return withOfficer(s, (o, rng, ns) => {
    const a = makeAide(o, rng);
    o.aides.push(a);
    note(ns, `(시험) ${ga(a.name)} 부관으로 합류했어요(${a.specialty}).`);
  });
}

/** 지금 전투·임무에 나갈 수 있는 부관(따로 임무 중이면 빠짐) */
export function readyAides(o: OfficerState, worldMs: number): Aide[] {
  return o.aides.filter((a) => (!a.errand || worldMs >= a.errand.endMs) && !a.school);
}

function aideGain(ns: GameState, a: Aide, exp: number, bond: number, loyalty = 0) {
  touchAide(a, ns.worldMs);
  if (loyalty) addLoyalty(a, loyalty);
  a.exp += exp;
  a.bond = Math.min(100, a.bond + bond);
  while (a.exp >= a.level * 100 && a.level < 10) {
    a.exp -= a.level * 100;
    a.level += 1;
    note(ns, `부관 ${a.name} Lv.${a.level}이 되었어요.`);
  }
  const told = a.stories ?? 0;
  if (told < STORY_AT.length && a.bond >= STORY_AT[told]) {
    a.stories = told + 1;
    note(ns, `💬 ${a.name}: ${AIDE_STORIES[a.specialty][told]}${told === 1 ? ' (인연 60: 전투 공격 +1)' : told === 2 ? ' (인연 90: 임무 성공 확률 +5%)' : ''}`);
  }
}

const gameDay = (ms: number) => Math.floor(ms / REAL_MS_PER_GAME_DAY);
export const giftCost = (rank: number) => 300 + rank * 100;
export const aideTrainCost = (rank: number) => 400 + rank * 150;

export function canGift(s: GameState, id: number): string | null {
  const a = s.officer.aides.find((x) => x.id === id);
  if (!a) return '없는 부관';
  if (a.giftDay === gameDay(s.worldMs)) return '오늘은 이미 선물했어요';
  if (s.player.salary < giftCost(s.player.rankIndex)) return `봉급 ${giftCost(s.player.rankIndex)} 필요`;
  return null;
}
/** 선물: 봉급을 써서 인연 +8(하루 한 번) */
export function giftAide(s: GameState, id: number): GameState {
  if (canGift(s, id)) return s;
  const cost = giftCost(s.player.rankIndex);
  const ns = withOfficer(s, (o, _rng, ns) => {
    const a = o.aides.find((x) => x.id === id)!;
    a.giftDay = gameDay(ns.worldMs);
    aideGain(ns, a, 0, 8, 3);
  });
  return { ...ns, player: { ...ns.player, salary: ns.player.salary - cost } };
}
export function canTrainAide(s: GameState, id: number): string | null {
  const a = s.officer.aides.find((x) => x.id === id);
  if (!a) return '없는 부관';
  if (a.level >= 10) return '최고 레벨';
  if (a.trainDay === gameDay(s.worldMs)) return '오늘은 이미 훈련했어요';
  if (s.player.salary < aideTrainCost(s.player.rankIndex)) return `봉급 ${aideTrainCost(s.player.rankIndex)} 필요`;
  return null;
}
/** 특별 훈련: 봉급을 써서 경험 +60, 인연 +2(하루 한 번) */
export function trainAide(s: GameState, id: number): GameState {
  if (canTrainAide(s, id)) return s;
  const cost = aideTrainCost(s.player.rankIndex);
  const ns = withOfficer(s, (o, _rng, ns) => {
    const a = o.aides.find((x) => x.id === id)!;
    a.trainDay = gameDay(ns.worldMs);
    aideGain(ns, a, 60, 2);
  });
  return { ...ns, player: { ...ns.player, salary: ns.player.salary - cost } };
}
export function canErrand(s: GameState, id: number): string | null {
  const a = s.officer.aides.find((x) => x.id === id);
  if (!a) return '없는 부관';
  if (a.errand) return '이미 임무 중';
  if (a.school) return '장군 교육 중';
  return null;
}
/** 부관 임무: 몇 시간 따로 나가 보상을 가져옴(그동안 전투에 못 나감) */
export function sendAide(s: GameState, id: number, kind: ErrandKind): GameState {
  if (canErrand(s, id)) return s;
  return withOfficer(s, (o, _rng, ns) => {
    const a = o.aides.find((x) => x.id === id)!;
    a.errand = { kind, endMs: ns.worldMs + ERRANDS[kind].hours * HOUR };
  });
}
export function errandReward(s: GameState, a: Aide): { intel: number; salary: number; merit: number } {
  if (!a.errand) return { intel: 0, salary: 0, merit: 0 };
  const fit = ERRAND_FIT[a.errand.kind].includes(a.specialty) ? 2 : 1;
  const r = s.player.rankIndex;
  const lv = (1 + 0.15 * (a.level - 1)) * loyaltyRewardMult(a);
  if (a.errand.kind === '정보 수집') return { intel: Math.round(8 * fit * lv), salary: 0, merit: 0 };
  if (a.errand.kind === '보급 조달') return { intel: 0, salary: Math.round((150 + r * 60) * fit * lv), merit: 0 };
  return { intel: 0, salary: 0, merit: Math.round((20 + r * 12) * fit * lv) };
}
export function claimErrand(s: GameState, id: number): { state: GameState; text: string } {
  const a0 = s.officer.aides.find((x) => x.id === id);
  if (!a0?.errand || s.worldMs < a0.errand.endMs) return { state: s, text: '' };
  const rw = errandReward(s, a0);
  let text = '';
  const ns = withOfficer(s, (o, _rng, ns) => {
    const a = o.aides.find((x) => x.id === id)!;
    o.intel += rw.intel;
    o.merit += rw.merit;
    o.totalMerit += rw.merit;
    text = `${a.name} ${a.errand!.kind} 끝: ${[rw.intel && `정보 +${rw.intel}`, rw.salary && `봉급 +${rw.salary}`, rw.merit && `공훈 +${rw.merit}`].filter(Boolean).join(' · ')} · 경험 +30`;
    a.errand = null;
    aideGain(ns, a, 30, 2);
    note(ns, text);
  });
  return { state: { ...ns, player: { ...ns.player, salary: ns.player.salary + rw.salary } }, text };
}

/** 같은 나라 장군 영입(봉급으로) */
export function recruitGeneral(s: GameState): GameState {
  if (s.officer.generals.length >= generalSlots(s.player.rankIndex)) return s;
  if (s.player.salary < RECRUIT_COST) return s;
  const free = GENERAL_FIELDS.filter((f) => !s.officer.generals.some((g) => g.field === f));
  if (!free.length) return s;
  return withOfficer(s, (o, rng, ns) => {
    ns.player = { ...ns.player, salary: ns.player.salary - RECRUIT_COST };
    const politics = o.stats['정치'] / statCap(ns.player.rankIndex);
    const g: General = {
      id: o.nextId++,
      name: pickName(o, rng),
      field: rng.pick(free),
      style: rng.pick([...GENERAL_STYLES]),
      skill: clamp(Math.round(rng.range(2, 5) + politics * 3), 1, 10),
      loyalty: Math.round(rng.range(35, 60) + politics * 20),
      from: '영입',
    };
    o.generals.push(g);
    note(ns, `${g.name} 장군(${g.field} · ${g.style})을 영입했어요.`);
  });
}

export function dismissGeneral(s: GameState, id: number): GameState {
  return withOfficer(s, (o) => {
    o.generals = o.generals.filter((g) => g.id !== id);
  });
}

/** 장군들이 내 나라 도시를 지켜 주는 배율 */
export function generalDefense(o: OfficerState): number {
  return 1 + o.generals.reduce((a, g) => a + g.skill * (g.loyalty >= 30 ? 1 : 0.5), 0) * GENERAL_DEFENSE_PER_SKILL + (hasAlly(o, '군부 실력자') ? 0.05 : 0);
}

// ── 임무 ──

function makeMission(o: OfficerState, rng: Rng, kind: MissionKind, city: string, rank: number): Mission {
  const c = cityById(city);
  const words: Record<MissionKind, string> = {
    안보회의: `${c.name} 방어 안보회의`,
    특수작전: `${c.name} 특수작전 승인`,
    정보보고: `${c.name} 정보 보고`,
    전선시찰: `${c.name} 전방 부대 시찰`,
    교민철수: `${c.name} 교민 철수 지시`,
    군수협상: `${c.name} 무기 지원 협상`,
    현장방문: `${c.name} 민생 현장 방문`,
    방산시찰: `${c.name} 방산업체 시찰`,
    방어: `${c.name} 방어`,
    기습: `${c.name} 기습`,
    정찰: `${c.name} 정찰`,
    호송: `${c.name} 보급 호송`,
    구출: `${c.name} 고립 부대 구출`,
    작전: `${c.name} 작전`,
    대전투: `${c.name} 점령 대전투`,
  };
  const m: Mission = {
    id: o.nextId++,
    kind,
    title: words[kind],
    city,
    difficulty: Math.round(rng.range(0.8, 1.3 + rank * 0.01) * 100) / 100,
    hours: MISSION_KINDS[kind].hours,
  };
  return m;
}

/** 작전 하나 만들기: 공격형은 적 도시, 지키는 작전은 우리 도시 */
function makeOperation(o: OfficerState, rng: Rng, mine: string[], enemyCities: string[], rank: number): Mission | null {
  const opIdx = Math.floor(rng.next() * OPERATIONS.length);
  const op = OPERATIONS[opIdx];
  const pool = op.attack ? enemyCities : mine;
  if (!pool.length) return null;
  const m = makeMission(o, rng, '작전', rng.pick(pool), rank);
  m.op = opIdx;
  m.title = `${cityById(m.city).name} ${op.name} 지휘`;
  return m;
}

/** 임무 게시판: 지금 세계(우리 전쟁·도시)에 맞춰 3개 */
function buildBoard(s: GameState, o: OfficerState, rng: Rng): Mission[] {
  const me = s.player.countryId;
  const w = s.world;
  const mine = citiesOf(w, me);
  const enemies = COUNTRIES.map((c) => c.id).filter((id) => id !== me && isAlive(w, id) && relationOf(w, me, id) === '전쟁');
  const enemyCities = CITIES.filter((c) => enemies.includes(w.owner[c.id])).map((c) => c.id);
  const near = enemyCities.filter((id) => countryById(cityById(id).home).continent === countryById(me).continent);
  const out: Mission[] = [];
  const r = s.player.rankIndex;
  const weakest = [...mine].sort((a, b) => w.defense[a] - w.defense[b])[0];
  const any = CITIES.filter((c) => w.owner[c.id] !== me).map((c) => c.id);
  // 지도자 임무 하나 만들기(어느 도시에서 하는 일인지 정함)
  const mk = (k: MissionKind) => {
    const front = enemyCities.length ? rng.pick(near.length ? near : enemyCities) : rng.pick(any.length ? any : mine);
    const city = k === '안보회의' ? (weakest ?? rng.pick(mine)) : k === '특수작전' || k === '교민철수' || k === '정보보고' ? front : rng.pick(mine);
    return makeMission(o, rng, k, city, r);
  };
  const pickSome = (pool: MissionKind[], n: number) => {
    const p = [...pool];
    for (let i = 0; i < n && p.length; i++) out.push(mk(p.splice(Math.floor(rng.next() * p.length), 1)[0]));
  };
  if (enemies.length && mine.length) {
    out.push(mk('안보회의'));
    out.push(mk('특수작전'));
    const op = r >= OPERATION_RANK ? makeOperation(o, rng, mine, enemyCities, r) : null;
    if (op && rng.chance(0.6)) out.push(op);
    else pickSome(['전선시찰', '정보보고', '교민철수', '군수협상'], 1);
  } else if (mine.length) {
    pickSome(['정보보고', '현장방문', '방산시찰', '군수협상', '교민철수'], 3);
  }
  return out;
}

export function boardNow(s: GameState): { state: GameState; board: Mission[] } {
  const o = s.officer;
  if (o.board.length && s.worldMs - o.boardMs < BOARD_REFRESH_MS) return { state: s, board: o.board };
  const state = withOfficer(s, (o2, rng, ns) => {
    o2.board = buildBoard(ns, o2, rng);
    o2.boardMs = ns.worldMs;
  });
  return { state, board: state.officer.board };
}

/** 임무 성공 확률 */
export function missionChance(s: GameState, m: Mission): number {
  const o = s.officer;
  const info = MISSION_KINDS[m.kind];
  const cap = statCap(s.player.rankIndex);
  const level = info.stats.reduce((a, id) => a + o.stats[id], 0) / info.stats.length / cap;
  const aide = readyAides(o, s.worldMs).reduce((a, x) => a + ((x.specialty === info.aideFit ? 0.06 : 0.02) + x.level * 0.005 + (x.bond >= 90 ? 0.05 : 0)) * loyaltyMissionMult(x) + loyaltyMissionBonus(x), 0);
  return clamp(0.3 + level * 0.6 + aide - (m.difficulty - 1) * 0.4 + civMission(s) + generalMissionBonus(s) + originEff(s, 'mission') + cabMission(s), 0.1, 0.95);
}

export function startMission(s: GameState, missionId: number): GameState {
  const o = s.officer;
  const m = o.board.find((x) => x.id === missionId);
  if (!m || o.active) return s;
  return withOfficer(s, (o2, _rng, ns) => {
    o2.board = o2.board.filter((x) => x.id !== missionId);
    o2.active = { ...m, startMs: ns.worldMs, endMs: ns.worldMs + m.hours * HOUR };
  });
}

// ── 승급(11-23에 없앰) ──
// 호칭은 신뢰도 + 명성 점수로 저절로 정해져요(title.ts). 공훈·훈련 별은 임무·훈련 기록으로만 남아요.

/** 끝난 임무 결과 받기 */
/** 전투 결과(직접 싸운 경우). 없으면 스탯으로 자동 계산 */
export interface BattleOutcome {
  win: boolean;
  stars: number;
}

export function claimMission(s: GameState, outcome?: BattleOutcome): { state: GameState; text: string | null } {
  const a = s.officer.active;
  if (!a || s.worldMs < a.endMs) return { state: s, text: null };
  let text = '';
  let won = false;
  const state = withOfficer(s, (o, rng, ns) => {
    o.active = null;
    const chance = missionChance(ns, a);
    const rolled = rng.chance(chance);
    const win = outcome ? outcome.win : rolled;
    won = win;
    // 직접 싸워 별을 많이 받으면 공훈이 더 큼(1★ ×1.0 · 2★ ×1.2 · 3★ ×1.4)
    const starMult = outcome && outcome.win ? 0.8 + 0.2 * Math.max(1, outcome.stars) : 1;
    const r = ns.player.rankIndex;
    const info = MISSION_KINDS[a.kind];
    const cap = statCap(r);
    for (const x of readyAides(o, ns.worldMs)) aideGain(ns, x, win ? 25 : 10, win ? 3 : 1, win ? 2 : -2);
    if (a.exam) {
      if (win) {
        o.trust = Math.min(100, o.trust + 5);
        text = `${a.title} 통과!${outcome ? ` ${'★'.repeat(outcome.stars)}` : ''}`;
      } else {
        // 시험판: 기본은 대기 시간 없음(설정에서 켤 수 있음)
        o.examReadyMs = o.examPenalty ? ns.worldMs + EXAM_COOLDOWN_MS : 0;
        o.trust = Math.max(0, o.trust - 3);
        text = o.examPenalty ? `${a.title}에서 떨어졌어요. 6시간 뒤 다시 도전할 수 있어요.` : `${a.title}에서 떨어졌어요. 바로 다시 도전할 수 있어요.`;
        note(ns, text);
      }
      return;
    }
    const kindMult = a.kind === '대전투' ? 4 : a.kind === '작전' ? 2.2 : 1;
    const merit = MISSION_MERIT * kindMult * a.difficulty * (1 + 0.3 * r) * (win ? starMult : 0.25);
    o.merit += merit;
    o.totalMerit += merit;
    for (const id of info.stats) gainStatExp(o, id, win ? MISSION_EXP_WIN : MISSION_EXP_LOSE, cap);
    const c = cityById(a.city);
    if (win) {
      o.fame += a.kind === '구출' ? 6 : a.kind === '대전투' ? 15 : a.kind === '작전' ? 4 : 2;
      o.trust = Math.min(100, o.trust + (a.kind === '대전투' ? 8 : a.kind === '작전' ? 4 : 2));
      const w = ns.world;
      const me = ns.player.countryId;
      let extra = '';
      if (a.kind === '작전') {
        const op = OPERATIONS[(a.op ?? 0) % OPERATIONS.length];
        if (w.owner[a.city] === me) {
          w.defense[a.city] = Math.min(100, w.defense[a.city] + 40);
          extra = `${c.name} 방어도 +40`;
        } else {
          w.defense[a.city] = Math.max(0, w.defense[a.city] - 45);
          extra = `${c.name} 방어도 −45`;
          if (w.defense[a.city] <= 0 && relationOf(w, me, w.owner[a.city]) === '전쟁') {
            extra += ` · ${eul(c.name)} 점령했어요!`;
            captureCity(ns, a.city);
          }
        }
        extra = `${op.name} · ${extra}`;
      }
      if (a.kind === '대전투') {
        if (w.owner[a.city] !== me) {
          captureCity(ns, a.city);
          extra = `${eul(c.name)} 점령했어요!`;
        } else extra = `${c.name}는 이미 우리 도시예요`;
      }
      if (a.kind === '방어') w.defense[a.city] = Math.min(100, w.defense[a.city] + 25);
      if (a.kind === '기습') w.defense[a.city] = Math.max(0, w.defense[a.city] - 20);
      if (a.kind === '정찰') o.intel += 10;
      if (a.kind === '안보회의') w.defense[a.city] = Math.min(100, w.defense[a.city] + 25);
      if (a.kind === '특수작전') w.defense[a.city] = Math.max(0, w.defense[a.city] - 20);
      if (a.kind === '정보보고') o.intel += 12;
      if (a.kind === '전선시찰') {
        w.defense[a.city] = Math.min(100, w.defense[a.city] + 15);
        ns.nations = { ...ns.nations, [me]: { ...ns.nations[me], troops: ns.nations[me].troops * 1.01 } };
      }
      if (a.kind === '교민철수') o.fame += 6;
      if (a.kind === '군수협상') ns.nations = { ...ns.nations, [me]: { ...ns.nations[me], troops: ns.nations[me].troops * 1.03 } };
      if (a.kind === '현장방문') o.trust = Math.min(100, o.trust + 1);
      if (a.kind === '방산시찰') ns.nations = { ...ns.nations, [me]: { ...ns.nations[me], treasury: ns.nations[me].treasury + 400 } };
      if (a.kind === '호송') {
        const me = ns.player.countryId;
        ns.nations = { ...ns.nations, [me]: { ...ns.nations[me], troops: ns.nations[me].troops * 1.02 } };
      }
      const effect: Record<MissionKind, string> = {
        안보회의: `${c.name} 방어도 +25`,
        특수작전: `${c.name} 방어도 −20`,
        정보보고: '정보 점수 +12',
        전선시찰: `${c.name} 방어도 +15 · 병력 +1%`,
        교민철수: '명성 +8 · 지지도 +2',
        군수협상: '병력 +3%',
        현장방문: '지지도 +4 · 신뢰도 +1',
        방산시찰: '국방예산 +400',
        방어: `${c.name} 방어도 +25`,
        기습: `${c.name} 방어도 −20`,
        정찰: '정보 점수 +10',
        호송: '병력 +2%',
        구출: '명성 +6',
        작전: extra,
        대전투: extra,
      };
      text = `${a.title} 성공!${outcome ? ` ${'★'.repeat(outcome.stars)}` : ''} 공훈 +${Math.round(merit)} · ${effect[a.kind]}`;
    } else {
      o.trust = Math.max(0, o.trust - (a.kind === '대전투' ? 5 : 2));
      if (a.kind === '대전투') {
        const me = ns.player.countryId;
        ns.nations = { ...ns.nations, [me]: { ...ns.nations[me], troops: ns.nations[me].troops * 0.95 } };
      }
      text = `${a.title} 실패… 공훈 +${Math.round(merit)}${a.kind === '대전투' ? ' · 병력 −5%' : ''}`;
    }
    note(ns, text);
    // 성공한 임무에서 가끔 인재가 합류
    if (win && o.aides.length < aideSlots(r) && rng.chance(0.1)) {
      const aide = makeAide(o, rng);
      o.aides.push(aide);
      note(ns, `작전 중 만난 ${ga(aide.name)} 부관으로 합류했어요(${aide.specialty}).`);
    }
  });
  let out = state;
  if (won && a.kind === '현장방문') out = addPresMod(out, '🤝 민생 현장 방문', 4, 24);
  if (won && a.kind === '교민철수') out = addPresMod(out, '✈️ 교민 무사 귀환', 2, 24);
  return { state: won ? eureka(out, { kind: 'mission', name: a.kind }) : out, text };
}

/** 도시를 우리 나라가 차지 */
function captureCity(ns: GameState, city: string) {
  const w = ns.world;
  const me = ns.player.countryId;
  const prev = w.owner[city];
  w.owner[city] = me;
  w.defense[city] = CAPTURED_DEFENSE;
  const ev: WorldEvent = { t: ns.worldMs, kind: '점령', text: `${countryById(me).name}, ${countryById(prev).name}의 ${eul(cityById(city).name)} 점령(내 작전)`, mine: true };
  w.events.unshift(ev);
}

/** 대전투 시작(준장부터, 12시간마다): 전쟁 중인 나라의 도시 */
export function grandTargets(s: GameState): string[] {
  const me = s.player.countryId;
  const w = s.world;
  return CITIES.filter((c) => w.owner[c.id] !== me && relationOf(w, me, w.owner[c.id]) === '전쟁')
    .map((c) => c.id)
    .sort((a, b) => w.defense[a] - w.defense[b]);
}
export function canGrand(s: GameState): string | null {
  if (s.player.rankIndex < GRAND_RANK) return `${rankName(GRAND_RANK)}부터 열려요`;
  if (s.officer.active) return '다른 임무를 하는 중이에요';
  if (s.worldMs < s.officer.grandReadyMs) return '다음 대전투를 준비하는 중이에요';
  if (!grandTargets(s).length) return '전쟁 중인 나라가 없어요';
  return null;
}
export function startGrand(s: GameState, city: string, field = true): GameState {
  if (canGrand(s) || !grandTargets(s).includes(city)) return s;
  return withOfficer(s, (o, rng, ns) => {
    const m = makeMission(o, rng, '대전투', city, ns.player.rankIndex);
    // 방어도가 높을수록 어려움
    // 직접 만든 부대가 많을수록 쉬워짐(6단계 생산)
    const army = Math.min(0.3, armyPower(ns) / 300);
    m.field = field;
    if (field) {
      // 연료·탄약: 창고의 석유·구리를 씀(모자라면 그만큼만 채우고 출발)
      const st = { ...ns.economy.stock };
      // 비축창고: 같은 양을 채우는 데 드는 석유·구리가 줄어듦
      const save = 1 - facBonus(ns, '비축창고');
      const needF = FIELD_FUEL_COST * save;
      const needA = FIELD_AMMO_COST * save;
      const fuel = Math.min(needF, Math.max(0, st.석유));
      const ammo = Math.min(needA, Math.max(0, st.구리 ?? 0));
      st.석유 -= fuel;
      st.구리 = (st.구리 ?? 0) - ammo;
      ns.economy = { ...ns.economy, stock: st };
      m.fuel = Math.round((needF ? fuel / needF : 1) * 100) / 100;
      m.ammo = Math.round((needA ? ammo / needA : 1) * 100) / 100;
    }
    m.difficulty = Math.round(Math.max(0.7, 0.9 + ns.world.defense[city] / 250 + ns.player.rankIndex * 0.01 - army) * 100) / 100;
    o.active = { ...m, startMs: ns.worldMs, endMs: ns.worldMs + m.hours * HOUR };
    // 지도자는 6시간마다
    o.grandReadyMs = ns.worldMs + (ns.player.rankIndex >= RANKS.length - 1 ? GRAND_COOLDOWN_HOURS / 2 : GRAND_COOLDOWN_HOURS) * HOUR;
    o.board = [];
  });
}

// ── 라이벌(정적) → rivals.ts ──

/** 평판 점수(지도자 경쟁) */
export function myRenown(o: OfficerState): number {
  return Math.round(o.totalMerit + o.fame * 10 + o.trust * 20);
}
// ── 판단마다(실제 15분) ──

/**
 * AI 판단 직후에 부름. 라이벌 승급 소식, 내 나라 도시를 잃었을 때 신뢰도, 불신임 경고와 불신임.
 * ns를 직접 바꾼다(advance 안에서 이미 복사한 상태).
 */
export function officerTick(ns: GameState, ownerBefore: Record<string, string>, tickMs: number): void {
  const o: OfficerState = structuredClone(ns.officer);
  const me = ns.player.countryId;
  const r = ns.player.rankIndex;
  // 내 나라 도시를 잃으면 신뢰도 하락(사령관이면 크게)
  for (const c of CITIES) {
    if (ownerBefore[c.id] === me && ns.world.owner[c.id] !== me) {
      const big = r >= COMMAND_RANK;
      // 점령했던 남의 도시를 잃는 것은 덜 아픔
      const loss = (c.home !== me ? 2 : c.capital ? 20 : 8) * (big ? 1 : 0.4);
      o.trust = Math.max(0, o.trust - loss);
      // 도시를 잃으면 정적들 목소리가 커짐
      shiftInfluence(o, c.home === me ? 4 : 1);
      if (big) note(ns, `${eul(c.name)} 잃어 의회 신뢰도가 ${Math.round(loss)} 떨어졌어요.`);
    }
  }
  // 신뢰도는 50까지 천천히 회복(하루 +1)
  if (o.trust < TRUST_START) o.trust = Math.min(TRUST_START, o.trust + tickMs / REAL_MS_PER_GAME_DAY / 24);
  // 불신임 경고와 불신임(준장부터)
  if (r >= COMMAND_RANK) {
    if (o.dismissDeadlineMs === null && o.trust < TRUST_WARN) {
      o.dismissDeadlineMs = ns.worldMs + DISMISS_DEADLINE_MS;
      note(ns, `⚠️ 불신임 경고! 실제 3일 안에 의회 신뢰도를 ${TRUST_SAFE} 넘게 되돌리지 못하면 명성이 크게 깎여요.`);
    } else if (o.dismissDeadlineMs !== null && o.trust >= TRUST_SAFE) {
      o.dismissDeadlineMs = null;
      note(ns, '불신임 경고가 풀렸어요.');
    } else if (o.dismissDeadlineMs !== null && ns.worldMs >= o.dismissDeadlineMs) {
      o.dismissDeadlineMs = null;
      o.merit = 0;
      o.stars = 0;
      // 11-23: 등급 강등 대신 명성 벌점(신뢰도는 바닥이라 그대로) → 호칭이 내려갈 수 있어요
      o.fame = Math.max(0, o.fame - 150);
      for (const a of o.aides) addLoyalty(a, -10);
      note(ns, '불신임되었어요. 명성 −150. 호칭이 내려갈 수 있어요. 다시 신뢰를 쌓아요.');
    }
  } else {
    o.dismissDeadlineMs = null;
  }
  schoolTick(ns, o);
  loyaltyTick(ns, o, tickMs);
  {
    const rng = new Rng(o.seed);
    rivalTick(ns, o, rng, tickMs);
    o.seed = rng.seed;
  }
  talkTick(ns, o);
  ns.officer = o;
}

export { rivalsView } from './rivals';
