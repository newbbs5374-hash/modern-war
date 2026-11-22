// 3단계: 장교의 성장(스탯·공훈·진급), 임무, 간이 훈련, 부관·장군, 라이벌, 해임.
// 전투·훈련 미니게임(4·5단계)이 생기기 전까지는 스탯으로 결과를 자동 계산한다.

import { CITIES, cityById } from '../data/cities';
import {
  AIDE_SPECIALTIES,
  GENERAL_FIELDS,
  GENERAL_STYLES,
  MISSION_KINDS,
  NAME_POOL,
  PROMOTION,
  START_STAT,
  STAT_IDS,
  GRAND_COOLDOWN_HOURS,
  GRAND_RANK,
  OPERATION_RANK,
  aideSlots,
  generalSlots,
  statCap,
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
import type { GameState } from './state';
import { armyPower } from './economy';
import { citiesOf, eul, ga, isAlive, relationOf, type WorldEvent } from './world';

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
/** 해임 경고가 생기는 계급(준장부터 = 사령관 시대) */
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
}

export interface General {
  id: number;
  name: string;
  field: (typeof GENERAL_FIELDS)[number];
  style: (typeof GENERAL_STYLES)[number];
  /** 능력 1~10 */
  skill: number;
  /** 충성도 0~100 */
  loyalty: number;
  from: '부관 승격' | '영입';
}

export interface Rival {
  name: string;
  /** 하루에 쌓는 공훈 */
  rate: number;
  /** 마지막으로 알린 계급 */
  shownRank: number;
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
}

export interface ActiveMission extends Mission {
  startMs: number;
  endMs: number;
}

export interface OfficerState {
  seed: number;
  nextId: number;
  stats: Record<StatId, number>;
  /** 이번 계급에서 모은 공훈 / 전체 공훈 */
  merit: number;
  totalMerit: number;
  /** 명성(국민 인기) · 지도자 신뢰도(0~100) · 정보 점수 */
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
  /** 해임 경고(이 시각까지 신뢰도를 회복하지 못하면 해임) */
  dismissDeadlineMs: number | null;
  /** 총사령관 자리를 가진 라이벌 이름(없으면 null) */
  chiefRival: string | null;
  /** 5단계: 지금 하고 있는 훈련(훈련 일정을 이미 씀) */
  training: { name: string; seed: number } | null;
  /** 다음 대전투를 열 수 있는 시각 */
  grandReadyMs: number;
  /** 훈련별 별 3개 받은 횟수(특기) */
  perfect: Record<string, number>;
}

export function newOfficer(seed: number): OfficerState {
  const rng = new Rng(seed);
  const stats = {} as Record<StatId, number>;
  for (const id of STAT_IDS) stats[id] = START_STAT;
  const names = [...NAME_POOL];
  const take = () => names.splice(Math.floor(rng.next() * names.length), 1)[0];
  const rivals: Rival[] = [0, 1, 2].map(() => ({ name: take(), rate: Math.round(rng.range(170, 260)), shownRank: 0 }));
  return {
    seed: rng.seed,
    nextId: 1,
    stats,
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
    perfect: {},
  };
}

// ── 공통 도우미 ──

function withOfficer(s: GameState, f: (o: OfficerState, rng: Rng, s: GameState) => void): GameState {
  const o: OfficerState = structuredClone(s.officer);
  const rng = new Rng(o.seed);
  const next: GameState = { ...s, officer: o, world: { ...s.world, events: [...s.world.events], defense: { ...s.world.defense }, owner: { ...s.world.owner } } };
  f(o, rng, next);
  o.seed = rng.seed;
  return next;
}

function note(s: GameState, text: string) {
  const ev: WorldEvent = { t: s.worldMs, kind: '장교', text, mine: true };
  s.world.events.unshift(ev);
  if (s.world.events.length > 150) s.world.events.length = 150;
}

/** 받침이 있으면 '으로'(ㄹ 받침은 '로') */
function ro(word: string): string {
  const code = word.charCodeAt(word.length - 1) - 0xac00;
  const jong = code >= 0 && code <= 11171 ? code % 28 : 0;
  return word + (jong === 0 || jong === 8 ? '로' : '으로');
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

export type TrainResult = { ok: false; why: string } | { ok: true; stars: number; gains: Partial<Record<StatId, number>>; perk?: string };

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
    const gains: Partial<Record<StatId, number>> = {};
    for (const id of ids) {
      const before = o.stats[id];
      o.stats[id] = Math.min(cap, before + (stars ? stars * 1.5 : 0.5) * tired);
      gains[id] = Math.round((o.stats[id] - before) * 10) / 10;
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
    result = { ok: true, stars, gains, perk };
  });
  return { state, result };
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

function makeAide(o: OfficerState, rng: Rng): Aide {
  return { id: o.nextId++, name: pickName(o, rng), specialty: rng.pick([...AIDE_SPECIALTIES]), level: 1, exp: 0, bond: 10 };
}

/** 부관을 장군으로 승격(장군 칸이 있고 부관 레벨 3 이상) */
export function promoteAide(s: GameState, aideId: number): GameState {
  const o = s.officer;
  const a = o.aides.find((x) => x.id === aideId);
  if (!a || a.level < 3 || o.generals.length >= generalSlots(s.player.rankIndex)) return s;
  return withOfficer(s, (o2, rng, ns) => {
    o2.aides = o2.aides.filter((x) => x.id !== aideId);
    o2.generals.push({
      id: o2.nextId++,
      name: a.name,
      field: rng.pick([...GENERAL_FIELDS]),
      style: rng.pick([...GENERAL_STYLES]),
      skill: clamp(2 + a.level, 1, 10),
      loyalty: clamp(60 + a.bond / 2, 0, 100),
      from: '부관 승격',
    });
    note(ns, `부관 ${ga(a.name)} 장군으로 승격했어요. 이제 전선 하나를 맡아요.`);
  });
}

/** 같은 나라 장군 영입(봉급으로) */
export function recruitGeneral(s: GameState): GameState {
  if (s.officer.generals.length >= generalSlots(s.player.rankIndex)) return s;
  if (s.player.salary < RECRUIT_COST) return s;
  return withOfficer(s, (o, rng, ns) => {
    ns.player = { ...ns.player, salary: ns.player.salary - RECRUIT_COST };
    const politics = o.stats['정치'] / statCap(ns.player.rankIndex);
    const g: General = {
      id: o.nextId++,
      name: pickName(o, rng),
      field: rng.pick([...GENERAL_FIELDS]),
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
  return 1 + o.generals.reduce((a, g) => a + g.skill * (g.loyalty >= 30 ? 1 : 0.5), 0) * GENERAL_DEFENSE_PER_SKILL;
}

// ── 임무 ──

function makeMission(o: OfficerState, rng: Rng, kind: MissionKind, city: string, rank: number): Mission {
  const c = cityById(city);
  const words: Record<MissionKind, string> = {
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
  m.title = `${cityById(m.city).name} ${op.name}`;
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
  if (enemies.length && mine.length) {
    out.push(makeMission(o, rng, '방어', weakest ?? rng.pick(mine), r));
    out.push(makeMission(o, rng, '기습', rng.pick(near.length ? near : enemyCities), r));
    const op = r >= OPERATION_RANK ? makeOperation(o, rng, mine, enemyCities, r) : null;
    if (op) out.push(op);
    else {
      const k = rng.pick(['정찰', '구출', '호송'] as MissionKind[]);
      out.push(makeMission(o, rng, k, k === '호송' ? rng.pick(mine) : rng.pick(enemyCities), r));
    }
  } else if (mine.length) {
    const any = CITIES.filter((c) => w.owner[c.id] !== me).map((c) => c.id);
    out.push(makeMission(o, rng, '호송', rng.pick(mine), r));
    out.push(makeMission(o, rng, '정찰', rng.pick(any), r));
    out.push(makeMission(o, rng, '구출', rng.pick(mine), r));
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
  const aide = o.aides.reduce((a, x) => a + (x.specialty === info.aideFit ? 0.06 : 0.02) + x.level * 0.005, 0);
  return clamp(0.3 + level * 0.6 + aide - (m.difficulty - 1) * 0.4, 0.1, 0.95);
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

// ── 진급 ──

export interface PromotionCheck {
  ready: boolean;
  lines: Array<{ label: string; have: number; need: number; ok: boolean }>;
  why: string | null;
}

export function promotionCheck(s: GameState): PromotionCheck {
  const r = s.player.rankIndex;
  const o = s.officer;
  if (r >= PROMOTION.length) return { ready: false, lines: [], why: '가장 높은 계급이에요' };
  const rule = PROMOTION[r];
  const lines = [
    { label: '공훈', have: Math.floor(o.merit), need: rule.merit, ok: o.merit >= rule.merit },
    { label: '훈련 별', have: o.stars, need: rule.stars, ok: o.stars >= rule.stars },
  ];
  if (rule.trust) lines.push({ label: '지도자 신뢰도', have: Math.floor(o.trust), need: rule.trust, ok: o.trust >= rule.trust });
  let why: string | null = null;
  if (lines.some((l) => !l.ok)) why = '조건을 채워야 해요';
  else if (o.active) why = '다른 임무를 하는 중이에요';
  else if (s.worldMs < o.examReadyMs) why = '심사에 떨어져 잠시 기다려야 해요';
  else if (r === PROMOTION.length - 1) {
    const lead = rivalAhead(s);
    if (lead) why = `라이벌 ${lead.name}의 평판이 더 높아요`;
  }
  return { ready: why === null, lines, why };
}

export function startExam(s: GameState): GameState {
  if (!promotionCheck(s).ready) return s;
  const r = s.player.rankIndex;
  return withOfficer(s, (o, _rng, ns) => {
    const kind: MissionKind = r % 2 === 0 ? '기습' : '방어';
    const city = citiesOf(ns.world, ns.player.countryId)[0] ?? CITIES[0].id;
    o.active = {
      id: o.nextId++,
      kind,
      title: `진급 심사: ${PROMOTION[r].exam}`,
      city,
      difficulty: 1.1 + r * 0.02,
      hours: EXAM_HOURS,
      exam: true,
      startMs: ns.worldMs,
      endMs: ns.worldMs + EXAM_HOURS * HOUR,
    };
  });
}

function promote(ns: GameState, o: OfficerState, rng: Rng) {
  const r = ns.player.rankIndex;
  const rule = PROMOTION[r];
  o.merit = Math.max(0, o.merit - rule.merit);
  o.stars = 0;
  ns.player = { ...ns.player, rankIndex: r + 1 };
  note(ns, `🎖️ ${ro(rankName(r + 1))} 진급했어요! 지휘: ${RANKS[r + 1].unit}`);
  // 중위가 되면 첫 부관이 이야기로 합류
  if (r + 1 === 1 && o.aides.length === 0) {
    const a = makeAide(o, rng);
    o.aides.push(a);
    note(ns, `첫 작전에서 함께 살아남은 ${ga(a.name)} 부관이 되었어요(${a.specialty}).`);
  }
  if (r + 1 === PROMOTION.length) {
    o.chiefRival = null;
    note(ns, '총사령관이 되었어요. 이제 나라 군대 전체를 맡아요.');
  }
}

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
  const state = withOfficer(s, (o, rng, ns) => {
    o.active = null;
    const chance = missionChance(ns, a);
    const rolled = rng.chance(chance);
    const win = outcome ? outcome.win : rolled;
    // 직접 싸워 별을 많이 받으면 공훈이 더 큼(1★ ×1.0 · 2★ ×1.2 · 3★ ×1.4)
    const starMult = outcome && outcome.win ? 0.8 + 0.2 * Math.max(1, outcome.stars) : 1;
    const r = ns.player.rankIndex;
    const info = MISSION_KINDS[a.kind];
    const cap = statCap(r);
    for (const x of o.aides) {
      x.exp += win ? 25 : 10;
      x.bond = Math.min(100, x.bond + (win ? 3 : 1));
      while (x.exp >= x.level * 100 && x.level < 10) {
        x.exp -= x.level * 100;
        x.level += 1;
      }
    }
    if (a.exam) {
      if (win) {
        o.trust = Math.min(100, o.trust + 5);
        text = `${a.title} 통과!${outcome ? ` ${'★'.repeat(outcome.stars)}` : ''}`;
        promote(ns, o, rng);
      } else {
        o.examReadyMs = ns.worldMs + EXAM_COOLDOWN_MS;
        o.trust = Math.max(0, o.trust - 3);
        text = `${a.title}에서 떨어졌어요. 6시간 뒤 다시 도전할 수 있어요.`;
        note(ns, text);
      }
      return;
    }
    const kindMult = a.kind === '대전투' ? 4 : a.kind === '작전' ? 2.2 : 1;
    const merit = MISSION_MERIT * kindMult * a.difficulty * (1 + 0.3 * r) * (win ? starMult : 0.25);
    o.merit += merit;
    o.totalMerit += merit;
    for (const id of info.stats) o.stats[id] = Math.min(cap, o.stats[id] + (win ? 1 : 0.3));
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
      if (a.kind === '호송') {
        const me = ns.player.countryId;
        ns.nations = { ...ns.nations, [me]: { ...ns.nations[me], troops: ns.nations[me].troops * 1.02 } };
      }
      const effect: Record<MissionKind, string> = {
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
  return { state, text };
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
export function startGrand(s: GameState, city: string): GameState {
  if (canGrand(s) || !grandTargets(s).includes(city)) return s;
  return withOfficer(s, (o, rng, ns) => {
    const m = makeMission(o, rng, '대전투', city, ns.player.rankIndex);
    // 방어도가 높을수록 어려움
    // 직접 만든 부대가 많을수록 쉬워짐(6단계 생산)
    const army = Math.min(0.3, armyPower(ns) / 300);
    m.difficulty = Math.round(Math.max(0.7, 0.9 + ns.world.defense[city] / 250 + ns.player.rankIndex * 0.01 - army) * 100) / 100;
    o.active = { ...m, startMs: ns.worldMs, endMs: ns.worldMs + m.hours * HOUR };
    o.grandReadyMs = ns.worldMs + GRAND_COOLDOWN_HOURS * HOUR;
    o.board = [];
  });
}

// ── 라이벌 ──

/** 라이벌이 쌓은 공훈 / 계급(최대 대장) */
export function rivalMerit(r: Rival, worldMs: number): number {
  return (r.rate * worldMs) / REAL_MS_PER_GAME_DAY / 24;
}
export function rivalRank(r: Rival, worldMs: number): number {
  let m = rivalMerit(r, worldMs);
  let k = 0;
  while (k < PROMOTION.length - 1 && m >= PROMOTION[k].merit) {
    m -= PROMOTION[k].merit;
    k++;
  }
  return k;
}
/** 평판 점수(총사령관 경쟁) */
export function myRenown(o: OfficerState): number {
  return Math.round(o.totalMerit + o.fame * 10 + o.trust * 20);
}
export function rivalRenown(r: Rival, worldMs: number): number {
  return Math.round(rivalMerit(r, worldMs) * 1.1 + 1000);
}
function rivalAhead(s: GameState): Rival | null {
  const mine = myRenown(s.officer);
  return s.officer.rivals.find((r) => rivalRenown(r, s.worldMs) > mine) ?? null;
}

// ── 판단마다(실제 15분) ──

/**
 * AI 판단 직후에 부름. 라이벌 진급 소식, 내 나라 도시를 잃었을 때 신뢰도, 해임 경고와 해임.
 * ns를 직접 바꾼다(advance 안에서 이미 복사한 상태).
 */
export function officerTick(ns: GameState, ownerBefore: Record<string, string>, tickMs: number): void {
  const o: OfficerState = structuredClone(ns.officer);
  const me = ns.player.countryId;
  const r = ns.player.rankIndex;
  // 라이벌 진급
  for (const rv of o.rivals) {
    const rk = rivalRank(rv, ns.worldMs);
    if (rk > rv.shownRank) {
      rv.shownRank = rk;
      if (rk >= r) note(ns, `라이벌 ${ga(rv.name)} ${ro(rankName(rk))} 진급했어요.${rk > r ? ' 나보다 앞서요!' : ''}`);
    }
    if (rk === PROMOTION.length - 1 && r < PROMOTION.length && !o.chiefRival && rivalRenown(rv, ns.worldMs) > myRenown(o)) {
      o.chiefRival = rv.name;
      note(ns, `라이벌 ${ga(rv.name)} 총사령관 후보 1순위가 되었어요.`);
    }
  }
  // 내 나라 도시를 잃으면 신뢰도 하락(사령관이면 크게)
  for (const c of CITIES) {
    if (ownerBefore[c.id] === me && ns.world.owner[c.id] !== me) {
      const big = r >= COMMAND_RANK;
      // 점령했던 남의 도시를 잃는 것은 덜 아픔
      const loss = (c.home !== me ? 2 : c.capital ? 20 : 8) * (big ? 1 : 0.4);
      o.trust = Math.max(0, o.trust - loss);
      if (big) note(ns, `${eul(c.name)} 잃어 지도자 신뢰도가 ${Math.round(loss)} 떨어졌어요.`);
    }
  }
  // 신뢰도는 50까지 천천히 회복(하루 +1)
  if (o.trust < TRUST_START) o.trust = Math.min(TRUST_START, o.trust + tickMs / REAL_MS_PER_GAME_DAY / 24);
  // 해임 경고와 해임(준장부터)
  if (r >= COMMAND_RANK) {
    if (o.dismissDeadlineMs === null && o.trust < TRUST_WARN) {
      o.dismissDeadlineMs = ns.worldMs + DISMISS_DEADLINE_MS;
      note(ns, `⚠️ 해임 경고! 실제 3일 안에 지도자 신뢰도를 ${TRUST_SAFE} 넘게 되돌리지 못하면 한 계급 내려가요.`);
    } else if (o.dismissDeadlineMs !== null && o.trust >= TRUST_SAFE) {
      o.dismissDeadlineMs = null;
      note(ns, '해임 경고가 풀렸어요.');
    } else if (o.dismissDeadlineMs !== null && ns.worldMs >= o.dismissDeadlineMs) {
      o.dismissDeadlineMs = null;
      o.merit = 0;
      o.stars = 0;
      o.trust = TRUST_SAFE;
      ns.player = { ...ns.player, rankIndex: r - 1 };
      // 장군 칸이 줄면 마지막 장군부터 떠남
      while (o.generals.length > generalSlots(r - 1)) o.generals.pop();
      note(ns, `해임되었어요. ${ro(rankName(r - 1))} 내려가 다시 도전해요.`);
    }
  } else {
    o.dismissDeadlineMs = null;
  }
  ns.officer = o;
}

/** 라이벌 중 지금 계급이 가장 높은 사람(화면용) */
export function rivalsView(s: GameState) {
  return s.officer.rivals.map((r) => ({
    name: r.name,
    rank: rivalRank(r, s.worldMs),
    renown: rivalRenown(r, s.worldMs),
  }));
}

