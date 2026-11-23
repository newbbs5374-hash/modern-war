// 대통령식 내정(11-23 대장 결정): 지지도(국민) · 신뢰도(의회·군·재계) · 분야 점수 5개.
// 지지도는 분야 점수가 정하는 목표 쪽으로 천천히 움직이고, 바닥이면 탄핵 위기(실제 3일 안에 못 올리면 등급 1단계 ↓).
// 신뢰도는 지금 있던 '의회 신뢰도'(officer.trust)를 그대로 쓰고, 외교·안보·경제 점수 쪽으로 조금씩 끌려가요.
import { COUNTRIES, countryById } from '../data/world';
import { CITIES } from '../data/cities';
import { BASIC_RES } from '../data/economy';
import { titlePenalty } from './title';
import { budgetMult } from './economy';
import { activeAgreements, chaos, civBudgetMult, cityTotals, favorOf } from './civ';
import { addLoyalty } from './loyal';
import { note } from './officer';
import { incomeShare, isAlive, pairKey, relationOf } from './world';
import type { GameState } from './state';
import { originEff, originOf, type OriginEffKey } from './origin';
import { cabApprovalRows, cabFieldRows, cabTaxSoft, cabTrust } from './cabinet';
import { scheduleFieldRows } from './schedule';
import { lawEff, lawRows } from './laws';
import { mediaFieldRows } from './media';
import { TAX_INFO, splitDefenseScore, splitDiploScore, splitEcoScore, splitOf, taxApproval, taxOf } from './policy';

const H = 3600e3;
export const IMPEACH_BELOW = 20;
export const IMPEACH_SAFE = 30;
export const IMPEACH_MS = 72 * H;
/** 지지도가 목표 쪽으로 실제 1시간에 다가가는 몫 */
const APPROVAL_PULL_PER_H = 0.3;
/** 신뢰도가 분야 점수 쪽으로 실제 1시간에 다가가는 몫 */
const TRUST_PULL_PER_H = 0.04;
const HIST_MAX = 48;

export type FieldId = 'personal' | 'defense' | 'diplo' | 'society' | 'economy';
export const FIELDS: Array<{ id: FieldId; icon: string; name: string; tab: string; text: string }> = [
  { id: 'personal', icon: '👤', name: '지도자 평판', tab: '개인', text: '명성·정치 스탯·일정이 쌓는 내 이름값' },
  { id: 'defense', icon: '🛡️', name: '안보', tab: '국방', text: '병력과 적의 힘, 도시를 지키는지' },
  { id: 'diplo', icon: '🌐', name: '외교 위상', tab: '외교', text: '협정·호감·연합, 전쟁 수' },
  { id: 'society', icon: '👥', name: '사회 안정', tab: '사회', text: '도시 민심 평균, 체제 혼란' },
  { id: 'economy', icon: '💰', name: '경제 지수', tab: '경제', text: '수입 배율·무역·자원 부족' },
];
/** 지지도 = 사회 40% + 경제 30% + 안보 20% + 평판 10% */
export const APPROVAL_W: Record<FieldId, number> = { society: 0.4, economy: 0.3, defense: 0.2, personal: 0.1, diplo: 0 };
/** 신뢰도가 끌려가는 목표 = 외교 40% + 안보 30% + 경제 30% */
/** 안보 점수: 연합국 병력 중 우리 편으로 쳐 주는 몫 */
export const ALLY_DEFENSE_SHARE = 0.3;
export const TRUST_W: Record<FieldId, number> = { diplo: 0.4, defense: 0.3, economy: 0.3, personal: 0, society: 0 };

export interface PresMod {
  why: string;
  v: number;
  untilMs: number;
}
export interface PresState {
  approval: number;
  /** 탄핵 위기 마감(이 시각까지 지지도를 30 넘게 올려야 함) */
  impeachMs: number | null;
  /** 실제 1시간마다 기록(국정 보고서 그래프) */
  hist: Array<{ t: number; a: number; tr: number }>;
  /** 잠깐 붙는 지지도 덤(승리·사건·연설 등) */
  mods: PresMod[];
}

export function newPres(): PresState {
  return { approval: 50, impeachMs: null, hist: [], mods: [] };
}
export function presOf(s: GameState): PresState {
  return s.pres ?? newPres();
}

const clamp = (v: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));
const r0 = (v: number) => Math.round(v);
type Rows = Array<[string, number]>;
const sum = (rows: Rows) => rows.reduce((a, [, v]) => a + v, 0);

/* ───────── 분야 점수(이유 표와 함께) ───────── */

function defenseRows(s: GameState): Rows {
  const me = s.player.countryId;
  const own = s.nations[me]?.troops ?? 0;
  let allyTroops = 0;
  let threat = 0;
  let wars = 0;
  for (const c of COUNTRIES) {
    if (c.id === me || !isAlive(s.world, c.id)) continue;
    const rel = relationOf(s.world, me, c.id);
    const t = s.nations[c.id]?.troops ?? 0;
    if (rel === '연합') allyTroops += t;
    if (rel === '전쟁') {
      wars++;
      threat = Math.max(threat, t);
    } else if (rel !== '연합') {
      const p = s.world.pairs[pairKey(me, c.id)];
      if (p && p.tension >= 50) threat = Math.max(threat, t * 0.6);
    }
  }
  // 연합국 병력도 함께 지켜 준다고 봄(11-23 점검: 작은 나라는 큰 나라 병력과 1:1로 비교하면 안보 점수가 늘 바닥이었음)
  const mine = own + allyTroops * ALLY_DEFENSE_SHARE;
  const rows: Rows = [];
  if (threat <= 0) rows.push(['위협 없음', 75]);
  else {
    const v = clamp(50 + 25 * Math.log2(Math.max(0.05, mine / threat)), 10, 92);
    rows.push([`병력${allyTroops ? '(연합 몫 포함)' : ''} ÷ 가장 센 적(${wars ? '전쟁' : '긴장'})`, v]);
  }
  let lost = 0;
  let won = 0;
  for (const c of CITIES) {
    const o = s.world.owner[c.id];
    if (c.home === me && o !== me) lost++;
    if (c.home !== me && o === me) won++;
  }
  if (lost) rows.push([`빼앗긴 우리 도시 ${lost}곳`, -12 * lost]);
  if (won) rows.push([`차지한 도시 ${won}곳`, Math.min(15, 3 * won)]);
  const sp = splitDefenseScore(s);
  if (sp) rows.push([`국방 예산 ${splitOf(s).def}%`, sp]);
  return rows;
}

function diploRows(s: GameState): Rows {
  const me = s.player.countryId;
  const rows: Rows = [['기본', 35]];
  const ag = activeAgreements(s).length;
  if (ag) rows.push([`맺은 협정 ${ag}개`, Math.min(24, 4 * ag)]);
  let allies = 0;
  let wars = 0;
  let fav = 0;
  let n = 0;
  for (const c of COUNTRIES) {
    if (c.id === me || !isAlive(s.world, c.id)) continue;
    const rel = relationOf(s.world, me, c.id);
    if (rel === '연합') allies++;
    if (rel === '전쟁') wars++;
    fav += favorOf(s, c.id);
    n++;
  }
  if (allies) rows.push([`연합국 ${allies}곳`, Math.min(15, 5 * allies)]);
  if (n) {
    const avg = fav / n;
    if (Math.abs(avg) >= 2) rows.push([`평균 호감 ${r0(avg)}`, avg * 0.25]);
  }
  if (wars) rows.push([`전쟁 ${wars}곳`, -6 * wars]);
  const sp = splitDiploScore(s);
  if (sp) rows.push([`외교 예산 ${splitOf(s).dip}%`, sp]);
  return rows;
}

function societyRows(s: GameState): Rows {
  const t = cityTotals(s);
  const rows: Rows = [['도시 민심 평균', t.avgLoyalty]];
  if (chaos(s)) rows.push(['체제 혼란', -10]);
  return rows;
}

function economyRows(s: GameState): Rows {
  const me = s.player.countryId;
  const mult = budgetMult(s) * civBudgetMult(s) * incomeShare(s.world, me);
  const rows: Rows = [
    ['기본', 30],
    [`수입 배율 ×${(Math.round(mult * 100) / 100).toFixed(2)}`, clamp(30 * mult, 0, 60)],
  ];
  const contracts = s.economy.contracts?.length ?? 0;
  if (contracts) rows.push([`무역 계약 ${contracts}개`, Math.min(10, 3 * contracts)]);
  if (BASIC_RES.some((r) => (s.economy.stock[r] ?? 0) < 1)) rows.push(['기본 자원 부족', -10]);
  if ((s.nations[me]?.treasury ?? 0) < 0) rows.push(['금고 빚', -15]);
  const sp = splitEcoScore(s);
  if (sp) rows.push([`경제 예산 ${splitOf(s).eco}%`, sp]);
  return rows;
}

function personalRows(s: GameState): Rows {
  const o = s.officer;
  const rows: Rows = [['기본', 35]];
  const fame = Math.min(35, Math.sqrt(Math.max(0, o.fame)) * 2.5);
  if (fame) rows.push([`명성 ${r0(o.fame)}`, fame]);
  const pol = Math.min(20, Math.floor(o.stats['정치'] ?? 0) * 0.5);
  if (pol) rows.push([`정치 스탯 ${Math.floor(o.stats['정치'] ?? 0)}`, pol]);
  return rows;
}

const ORIGIN_FIELD: Record<FieldId, OriginEffKey> = { personal: 'fieldPersonal', defense: 'fieldDefense', diplo: 'fieldDiplo', society: 'fieldSociety', economy: 'fieldEconomy' };
function baseRows(s: GameState, f: FieldId): Rows {
  switch (f) {
    case 'defense':
      return defenseRows(s);
    case 'diplo':
      return diploRows(s);
    case 'society':
      return societyRows(s);
    case 'economy':
      return economyRows(s);
    case 'personal':
      return personalRows(s);
  }
}
export function fieldRows(s: GameState, f: FieldId): Rows {
  const rows = baseRows(s, f);
  const o = originEff(s, ORIGIN_FIELD[f]);
  if (o) rows.push([`🎓 출신(${originOf(s)!.name})`, o]);
  if (f !== 'personal') rows.push(...cabFieldRows(s, f));
  rows.push(...scheduleFieldRows(s, f));
  rows.push(...mediaFieldRows(s, f));
  if (f !== 'personal') rows.push(...lawRows(s, f));
  return rows;
}
/** 분야 점수(계산용, 반올림 안 함) */
export function fieldValue(s: GameState, f: FieldId): number {
  return clamp(sum(fieldRows(s, f)));
}
/** 분야 점수(화면용 정수) */
export function fieldScore(s: GameState, f: FieldId): number {
  return r0(fieldValue(s, f));
}
export function fieldValues(s: GameState): Record<FieldId, number> {
  return Object.fromEntries(FIELDS.map((f) => [f.id, fieldValue(s, f.id)])) as Record<FieldId, number>;
}
export function fieldScores(s: GameState): Record<FieldId, number> {
  return Object.fromEntries(FIELDS.map((f) => [f.id, fieldScore(s, f.id)])) as Record<FieldId, number>;
}

/* ───────── 지지도 · 신뢰도 ───────── */

export function approvalRows(s: GameState, sc: Record<FieldId, number> = fieldValues(s)): Rows {
  const rows: Rows = FIELDS.filter((f) => APPROVAL_W[f.id] > 0).map((f) => [`${f.icon} ${f.name} ${r0(sc[f.id])} × ${Math.round(APPROVAL_W[f.id] * 100)}%`, sc[f.id] * APPROVAL_W[f.id]]);
  const tx0 = taxApproval(s);
  const tx = tx0 < 0 ? tx0 * (1 - originEff(s, 'taxSoft')) * (1 - cabTaxSoft(s)) : tx0;
  if (tx) rows.push([`${TAX_INFO[taxOf(s)].icon} 세금 ${TAX_INFO[taxOf(s)].name}`, tx]);
  rows.push(...cabApprovalRows(s));
  rows.push(...lawRows(s, 'approval'));
  for (const m of presOf(s).mods) if (m.untilMs > s.worldMs && m.v) rows.push([m.why, m.v]);
  return rows;
}
export function approvalTarget(s: GameState, sc?: Record<FieldId, number>): number {
  return clamp(sum(approvalRows(s, sc)));
}
export function trustTarget(s: GameState, sc: Record<FieldId, number> = fieldValues(s)): number {
  return clamp(FIELDS.reduce((a, f) => a + sc[f.id] * TRUST_W[f.id], 0) + cabTrust(s) + lawEff(s, 'trust'));
}
export const approvalOf = (s: GameState) => presOf(s).approval;
export const trustOf = (s: GameState) => s.officer.trust;

export function moodLabel(v: number): { name: string; tone: 'green' | 'gold' | 'red' | undefined } {
  if (v >= 70) return { name: '높음', tone: 'green' };
  if (v >= 45) return { name: '보통', tone: undefined };
  if (v >= IMPEACH_SAFE) return { name: '낮음', tone: 'gold' };
  return { name: '위험', tone: 'red' };
}

/** 지지도 → 국방예산 배율(50이면 1, 100이면 +10%, 0이면 −20%) */
export function approvalBudgetMult(s: GameState): number {
  const a = approvalOf(s);
  return a >= 50 ? 1 + (a - 50) / 500 : 1 - (50 - a) / 250;
}
/** 지지도 → 모병(징병) 배율(50이면 1, 100이면 +12.5%, 0이면 −25%) */
export function approvalTroopMult(s: GameState): number {
  const a = approvalOf(s);
  return a >= 50 ? 1 + (a - 50) / 400 : 1 - (50 - a) / 200;
}

/** 잠깐 붙는 지지도 덤(사건·승리·연설). hours 동안 */
export function addPresMod(s: GameState, why: string, v: number, hours: number): GameState {
  const p = presOf(s);
  const mods = [...p.mods.filter((m) => m.untilMs > s.worldMs), { why, v, untilMs: s.worldMs + hours * H }].slice(-12);
  return { ...s, pres: { ...p, mods } };
}
/** 지지도를 바로 움직임(사건 결과 등) */
export function bumpApproval(s: GameState, v: number): GameState {
  const p = presOf(s);
  return { ...s, pres: { ...p, approval: clamp(p.approval + v) } };
}

/**
 * AI 판단마다(실제 15분) 부름: 지지도가 목표 쪽으로, 신뢰도가 분야 점수 쪽으로 움직이고, 탄핵 위기를 살핌.
 * 새 상태를 돌려줌.
 */
export function presTick(s: GameState, tickMs: number): GameState {
  const p0 = presOf(s);
  const h = tickMs / H;
  const sc = fieldValues(s);
  const target = approvalTarget(s, sc);
  const k = 1 - Math.pow(1 - APPROVAL_PULL_PER_H, h);
  const p: PresState = { ...p0, approval: clamp(p0.approval + (target - p0.approval) * k), mods: p0.mods.filter((m) => m.untilMs > s.worldMs) };
  const o = { ...s.officer };
  const tk = 1 - Math.pow(1 - TRUST_PULL_PER_H, h);
  o.trust = clamp(o.trust + (trustTarget(s, sc) - o.trust) * tk);
  let ns: GameState = { ...s, officer: o, pres: p };
  // 기록(실제 1시간마다)
  const last = p.hist[p.hist.length - 1];
  if (!last || s.worldMs - last.t >= H) p.hist = [...p.hist, { t: s.worldMs, a: r0(p.approval), tr: r0(o.trust) }].slice(-HIST_MAX);
  // 탄핵 위기(11-23: 등급 대신 신뢰도·명성 벌점 → 호칭이 내려갈 수 있음)
  if (p.impeachMs === null && p.approval < IMPEACH_BELOW) {
    p.impeachMs = s.worldMs + IMPEACH_MS;
    ns = { ...ns, world: { ...ns.world, events: [...ns.world.events] } };
    note(ns, `⚠️ 탄핵 위기! 지지도가 ${IMPEACH_BELOW} 밑이에요. 실제 3일 안에 ${IMPEACH_SAFE} 넘게 올리지 못하면 신뢰도 −15·명성 −100이에요.`);
  } else if (p.impeachMs !== null && p.approval >= IMPEACH_SAFE) {
    p.impeachMs = null;
    ns = { ...ns, world: { ...ns.world, events: [...ns.world.events] } };
    note(ns, '탄핵 위기를 넘겼어요. 국민이 다시 믿어 주고 있어요.');
  } else if (p.impeachMs !== null && s.worldMs >= p.impeachMs) {
    p.impeachMs = null;
    p.approval = 40;
    ns = demote(ns, '탄핵되었어요. 신뢰도 −15 · 명성 −100. 호칭이 내려갈 수 있어요. 다시 민심을 얻어야 해요.');
  }
  return ns;
}

/** 탄핵·재신임 실패 벌점(11-23: 등급 강등 대신 신뢰도 −15 · 명성 −100) */
export function demote(s: GameState, text: string): GameState {
  const oo = structuredClone(s.officer);
  for (const a of oo.aides) addLoyalty(a, -10);
  return titlePenalty({ ...s, officer: oo }, text);
}

/** 본부·보고용 한 줄: 나라 이름과 두 숫자 */
export function presLine(s: GameState): string {
  return `${countryById(s.player.countryId).name} 지지도 ${r0(approvalOf(s))} · 신뢰도 ${r0(trustOf(s))}`;
}
