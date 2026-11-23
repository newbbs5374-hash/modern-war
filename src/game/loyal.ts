// 11/23 대장 요청: 부관 인연·충성도, 장군 교육 → 장군 임명, 임명한 장군이 병과 효율을 올림.
// 인연 = 지도자와 가까운 정도(대화·선물·같이 싸우기). 충성 = 지도자를 따르는 마음(인연·의회 신뢰·승패에 따라 움직임).
import { GENERAL_FIELDS, GENERAL_STYLES, generalSlots } from '../data/officers';
import { RANKS } from '../data/ranks';
import { UNITS } from '../data/catalog';
import type { GameState } from './state';
import { note, withOfficer, type Aide, type General, type OfficerState } from './officer';

const HOUR = 60 * 60 * 1000;
const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));

export type GeneralField = (typeof GENERAL_FIELDS)[number];

// ── 숫자(초안) ──
/** 이만큼(실제 시간) 돌보지 않으면 인연이 줄기 시작 */
export const NEGLECT_MS = 24 * HOUR;
/** 돌보지 않을 때 인연이 줄어드는 양(실제 1시간에) */
export const NEGLECT_PER_HOUR = 0.5;
/** 충성이 목표로 다가가는 빠르기(실제 1시간에) */
export const LOYALTY_DRIFT_PER_HOUR = 1;
/** 충성 경고 · 떠남 */
export const LOYALTY_LOW = 30;
export const LOYALTY_LEAVE = 15;
export const LOYALTY_HIGH = 80;
/** 장군 교육 조건 · 시간 · 값 */
export const SCHOOL_LEVEL = 5;
export const SCHOOL_BOND = 50;
export const SCHOOL_LOYALTY = 60;
export const SCHOOL_HOURS = 6;
export const schoolCost = (rank: number) => 1500 + rank * 300;
/** 장군 능력 1점당 맡은 병과 효율 */
export const BRANCH_POWER_PER_SKILL = 0.015;
export const BRANCH_BUILD_PER_SKILL = 0.02;
export const INTEL_MISSION_PER_SKILL = 0.006;
export const SUPPLY_RES_PER_SKILL = 0.015;

/** 인연 단계 */
export function bondStage(bond: number): { name: string; icon: string } {
  if (bond >= 90) return { name: '평생 동료', icon: '💞' };
  if (bond >= 60) return { name: '전우', icon: '🤝' };
  if (bond >= 30) return { name: '믿음', icon: '🙂' };
  return { name: '낯섦', icon: '😐' };
}

/** 충성(옛 저장은 인연으로 채움) */
export const loyaltyOf = (a: Aide) => a.loyalty ?? Math.round(40 + a.bond / 2);

/** 충성이 다가가는 값: 인연이 깊고, 의회 신뢰가 높을수록 높음 */
export function loyaltyTarget(o: OfficerState, a: Aide): number {
  return clamp(25 + a.bond * 0.65 + (o.trust - 50) * 0.3, 0, 100);
}

export function loyaltyMood(v: number): { name: string; icon: string; text: string } {
  if (v >= LOYALTY_HIGH) return { name: '충직', icon: '🫡', text: '어떤 명령이든 따라요. 임무 성공 +3% · 부관 임무 보상 ×1.2' };
  if (v >= LOYALTY_LOW) return { name: '따름', icon: '🙂', text: '명령을 잘 따라요.' };
  if (v >= LOYALTY_LEAVE) return { name: '불만', icon: '😟', text: `불만이 쌓였어요. 임무 도움이 절반, 부관 임무 보상 ×0.7. ${LOYALTY_LEAVE} 밑으로 떨어지면 떠나요.` };
  return { name: '떠나려 함', icon: '😠', text: '곧 떠나요.' };
}

/** 부관 임무 보상 배율(충성) */
export function loyaltyRewardMult(a: Aide): number {
  const v = loyaltyOf(a);
  return v >= LOYALTY_HIGH ? 1.2 : v < LOYALTY_LOW ? 0.7 : 1;
}
/** 임무 성공 확률에 주는 부관 도움 배율과 덤 */
export function loyaltyMissionMult(a: Aide): number {
  return loyaltyOf(a) < LOYALTY_LOW ? 0.5 : 1;
}
export function loyaltyMissionBonus(a: Aide): number {
  return loyaltyOf(a) >= LOYALTY_HIGH ? 0.03 : 0;
}

/** 돌본 때를 적어 둠(대화·선물·훈련·임무·전투) */
export function touchAide(a: Aide, worldMs: number) {
  a.seenMs = worldMs;
}
/** 충성 바로 바꾸기(이긴 전투 +, 진 전투 −, 선물 + 등) */
export function addLoyalty(a: Aide, v: number) {
  a.loyalty = clamp(loyaltyOf(a) + v, 0, 100);
}

/** 판단마다(실제 15분): 돌보지 않으면 인연 −, 충성은 목표로 천천히, 너무 낮으면 떠남 */
export function loyaltyTick(ns: GameState, o: OfficerState, tickMs: number) {
  const h = tickMs / HOUR;
  for (const a of [...o.aides]) {
    if (a.seenMs === undefined) a.seenMs = ns.worldMs;
    const away = a.errand && ns.worldMs < a.errand.endMs;
    const school = a.school && ns.worldMs < a.school.endMs;
    if (!away && !school && ns.worldMs - a.seenMs > NEGLECT_MS) {
      const before = a.bond;
      a.bond = Math.max(0, a.bond - NEGLECT_PER_HOUR * h);
      if (Math.floor(before / 10) !== Math.floor(a.bond / 10)) note(ns, `💭 ${a.name} 부관이 요즘 지도자님과 이야기를 못 해 서운해해요(인연 ${Math.round(a.bond)}).`);
    }
    const cur = loyaltyOf(a);
    const target = loyaltyTarget(o, a);
    const step = LOYALTY_DRIFT_PER_HOUR * h;
    const next = cur < target ? Math.min(target, cur + step) : Math.max(target, cur - step);
    if (cur >= LOYALTY_LOW && next < LOYALTY_LOW) note(ns, `😟 ${a.name} 부관의 충성이 ${LOYALTY_LOW} 밑으로 떨어졌어요. 대화·선물로 달래 주세요.`);
    a.loyalty = next;
    if (next < LOYALTY_LEAVE) {
      o.aides = o.aides.filter((x) => x.id !== a.id);
      note(ns, `😠 ${a.name} 부관이 실망해 떠났어요. 충성이 너무 낮았어요.`);
    }
  }
  // 장군: 오래 회의·격려가 없으면 충성이 조금씩(하루 −2) 줄어듦(30까지)
  for (const g of o.generals) {
    if (g.seenMs === undefined) g.seenMs = ns.worldMs;
    if (ns.worldMs - g.seenMs > NEGLECT_MS && g.loyalty > 30) g.loyalty = Math.max(30, g.loyalty - (2 / 24) * h);
  }
}

// ── 장군 교육 → 임명 ──

export function canSchool(s: GameState, id: number): string | null {
  const a = s.officer.aides.find((x) => x.id === id);
  if (!a) return '없는 부관';
  if (a.schooled) return '이미 교육을 마쳤어요';
  if (a.school) return '교육 중이에요';
  if (a.errand) return '부관 임무 중이에요';
  if (a.level < SCHOOL_LEVEL) return `Lv.${SCHOOL_LEVEL} 필요`;
  if (a.bond < SCHOOL_BOND) return `인연 ${SCHOOL_BOND} 필요`;
  if (loyaltyOf(a) < SCHOOL_LOYALTY) return `충성 ${SCHOOL_LOYALTY} 필요`;
  const cost = schoolCost(s.player.rankIndex);
  if (s.player.salary < cost) return `봉급 ${cost} 필요`;
  return null;
}

/** 장군 교육 시작: 봉급을 쓰고 6시간 동안 전투·임무에 못 나감 */
export function startSchool(s: GameState, id: number): GameState {
  if (canSchool(s, id)) return s;
  const cost = schoolCost(s.player.rankIndex);
  const ns = withOfficer(s, (o, _rng, ns) => {
    const a = o.aides.find((x) => x.id === id)!;
    a.school = { endMs: ns.worldMs + SCHOOL_HOURS * HOUR };
    touchAide(a, ns.worldMs);
    note(ns, `🎓 ${a.name} 부관이 장군 교육에 들어갔어요(${SCHOOL_HOURS}시간).`);
  });
  return { ...ns, player: { ...ns.player, salary: ns.player.salary - cost } };
}

/** 교육이 끝났으면 마침 표시(판단마다 부름) */
export function schoolTick(ns: GameState, o: OfficerState) {
  for (const a of o.aides) {
    if (a.school && ns.worldMs >= a.school.endMs) {
      a.school = null;
      a.schooled = true;
      addLoyalty(a, 5);
      note(ns, `🎓 ${a.name} 부관이 장군 교육을 마쳤어요. 장군으로 임명할 수 있어요.`);
    }
  }
}

/** 장군 자리가 남았는지(사람 임명에도 씀) */
export function canAppointGeneralSlot(s: GameState): string | null {
  const slots = generalSlots(s.player.rankIndex);
  if (slots === 0) return `「${RANKS[5].name}」 호칭부터 장군을 둘 수 있어요`;
  if (s.officer.generals.length >= slots) return `장군 자리가 다 찼어요(${slots}자리)`;
  return null;
}
export function canAppoint(s: GameState, id: number): string | null {
  const a = s.officer.aides.find((x) => x.id === id);
  if (!a) return '없는 부관';
  if (!a.schooled) return '장군 교육을 먼저 마쳐야 해요';
  const slots = generalSlots(s.player.rankIndex);
  if (slots === 0) return '존경받는 지도자부터 장군을 둘 수 있어요';
  if (s.officer.generals.length >= slots) return `장군 자리가 다 찼어요(${slots}자리)`;
  return null;
}
/** 병과마다 장군은 한 명(11-23) */
export const fieldTaken = (s: GameState, field: GeneralField) => s.officer.generals.some((g) => g.field === field);
export const freeFields = (s: GameState) => GENERAL_FIELDS.filter((f) => !fieldTaken(s, f));

/** 임명할 때 능력: 레벨 + 인연·충성 덤 */
export function appointSkill(a: Aide): number {
  return clamp(Math.round(1 + a.level * 0.7 + a.bond / 40 + loyaltyOf(a) / 50), 1, 10);
}

/** 장군 임명: 맡길 병과를 지도자가 고름 */
export function appointGeneral(s: GameState, id: number, field: GeneralField): GameState {
  if (canAppoint(s, id) || fieldTaken(s, field)) return s;
  return withOfficer(s, (o, rng, ns) => {
    const a = o.aides.find((x) => x.id === id)!;
    o.aides = o.aides.filter((x) => x.id !== id);
    const g: General = {
      id: o.nextId++,
      name: a.name,
      field,
      style: rng.pick([...GENERAL_STYLES]),
      skill: appointSkill(a),
      loyalty: clamp(loyaltyOf(a) + 10, 0, 100),
      from: '부관 임명',
      bond: a.bond,
      specialty: a.specialty,
      seenMs: ns.worldMs,
    };
    o.generals.push(g);
    note(ns, `⭐ ${a.name}을(를) ${field} 장군으로 임명했어요. ${FIELD_TEXT[field]}`);
  });
}

// ── 장군이 맡은 병과 효율 ──

export const FIELD_ICON: Record<GeneralField, string> = { 합참: '🎖️', 육군: '🪖', 해군: '⚓', 공군: '✈️', 정보: '🔐', 군수: '📦' };
export const FIELD_TEXT: Record<GeneralField, string> = {
  합참: '합참의장: 모든 부대 전투력·모집 속도가 조금씩 올라요.',
  육군: '육군 부대 전투력·모집 속도가 올라요.',
  해군: '해군 함정 전투력·건조 속도가 올라요.',
  공군: '공군 전투력·모집 속도가 올라요.',
  정보: '임무 성공 확률이 올라요.',
  군수: '전략 자원이 더 많이 나와요.',
};
const DOM_FIELD: Record<'육' | '해' | '공', GeneralField> = { 육: '육군', 해: '해군', 공: '공군' };

/** 충성에 따른 장군 효과 배율 */
export function generalLoyalMult(g: General): number {
  return g.loyalty >= LOYALTY_HIGH ? 1.2 : g.loyalty < LOYALTY_LOW ? 0.5 : 1;
}
function fieldSkill(o: OfficerState, field: GeneralField): number {
  return o.generals.filter((g) => g.field === field).reduce((a, g) => a + g.skill * generalLoyalMult(g), 0);
}
function domOfUnit(unit: string): '육' | '해' | '공' {
  const d = UNITS.find((u) => u.name === unit)?.domain;
  return d === '해' ? '해' : d === '공' ? '공' : '육';
}
/** 맡은 장군이 있는 병과의 전투력 배율 */
export function generalPowerMult(s: GameState, unit: string): number {
  return 1 + fieldSkill(s.officer, DOM_FIELD[domOfUnit(unit)]) * BRANCH_POWER_PER_SKILL + fieldSkill(s.officer, '합참') * JCS_PER_SKILL;
}
/** 합참의장: 모든 병과 힘·모집 +(능력 1당 0.8%) */
export const JCS_PER_SKILL = 0.008;
/** 맡은 장군이 있는 병과의 모집 속도 배율 */
export function generalBuildMult(s: GameState, unit: string): number {
  return 1 + fieldSkill(s.officer, DOM_FIELD[domOfUnit(unit)]) * BRANCH_BUILD_PER_SKILL + fieldSkill(s.officer, '합참') * JCS_PER_SKILL;
}
export function generalMissionBonus(s: GameState): number {
  return fieldSkill(s.officer, '정보') * INTEL_MISSION_PER_SKILL;
}
export function generalResMult(s: GameState): number {
  return 1 + fieldSkill(s.officer, '군수') * SUPPLY_RES_PER_SKILL;
}
/** 장군 한 명이 주는 효과(화면용) */
export function generalEffectText(g: General): string {
  const k = g.skill * generalLoyalMult(g);
  const f = g.field as GeneralField;
  if (f === '합참') return `모든 부대 힘·모집 +${(k * JCS_PER_SKILL * 100).toFixed(1)}%`;
  if (f === '정보') return `임무 성공 +${(k * INTEL_MISSION_PER_SKILL * 100).toFixed(1)}%`;
  if (f === '군수') return `전략 자원 +${(k * SUPPLY_RES_PER_SKILL * 100).toFixed(1)}%`;
  return `${f} 전투력 +${(k * BRANCH_POWER_PER_SKILL * 100).toFixed(1)}% · 모집 속도 +${(k * BRANCH_BUILD_PER_SKILL * 100).toFixed(1)}%`;
}
/** 지금 병과별 효율 합(장군 탭 위 요약) */
export function branchSummary(s: GameState): Array<{ field: GeneralField; text: string; on: boolean }> {
  return GENERAL_FIELDS.map((f) => {
    const k = fieldSkill(s.officer, f);
    const text =
      f === '합참' ? `전군 +${(k * JCS_PER_SKILL * 100).toFixed(0)}%` : f === '정보' ? `임무 +${(k * INTEL_MISSION_PER_SKILL * 100).toFixed(0)}%` : f === '군수' ? `자원 +${(k * SUPPLY_RES_PER_SKILL * 100).toFixed(0)}%` : `힘 +${(k * BRANCH_POWER_PER_SKILL * 100).toFixed(0)}%`;
    return { field: f, text, on: k > 0 };
  });
}
