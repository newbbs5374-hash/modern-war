// 지도자 출신 16가지(11-23 대장 결정): 시작할 때 나라 다음에 고름. 스탯 합 72는 그대로, 높낮이만 바뀜.
// 출신마다: 스탯 · 시작 혜택 · 약점 · 지지도/신뢰도 출발점 · 잘 맞는 나라(★) · 전용 업적. 이 파일은 다른 게임 계산 파일을 부르지 않아요(순환 막기).
import type { StatId } from '../data/officers';
import type { GameState } from './state';

export type OriginId =
  | 'econ'
  | 'general'
  | 'scientist'
  | 'athlete'
  | 'diplomat'
  | 'spy'
  | 'lawyer'
  | 'chaebol'
  | 'broadcaster'
  | 'activist'
  | 'doctor'
  | 'mayor'
  | 'commando'
  | 'admiral'
  | 'commoner'
  | 'religious';

/** 출신 효과 종류(값은 배율 덤 또는 점수 덤) */
export type OriginEffKey =
  | 'fieldPersonal'
  | 'fieldDefense'
  | 'fieldDiplo'
  | 'fieldSociety'
  | 'fieldEconomy'
  | 'build' // 모든 모집 속도 +
  | 'buildNavy' // 해군 모집 속도 +
  | 'research' // 연구 속도 +(시간당 점수)
  | 'favor' // 모든 나라 호감 +
  | 'favorFaith' // 같은 신앙 +, 다른 신앙 −(값의 1/3)
  | 'loyalty' // 모든 도시 민심 +
  | 'growth' // 인구 성장 +
  | 'district' // 구역 짓기 시간 −
  | 'spy' // 첩보 성공률 +
  | 'mission' // 임무 성공률 +
  | 'train' // 훈련 경험치 +
  | 'taxSoft' // 세금 높음의 지지도 손해를 줄임(몫)
  | 'speech' // 연설·기자회견 효과 +(몫)
  | 'law' // 법안 통과 +(몫)
  | 'hearing' // 인사청문회 통과 +(몫, 음수면 불리)
  | 'luxury'; // 생활 자원 생산 +

export interface Origin {
  id: OriginId;
  icon: string;
  name: string;
  line: string;
  stats: Partial<Record<StatId, number>>;
  perk: string;
  weak: string;
  /** 동료(인물 단계에서 함께 오는 사람) */
  buddy: string;
  eff: Partial<Record<OriginEffKey, number>>;
  startApproval: number;
  startTrust: number;
  /** 시작 금고 배율 */
  treasury?: number;
  /** 시작 명성 · 정보 점수 */
  fame?: number;
  intel?: number;
  /** 시작 연구 점수(군사·사회 각각, 시간) */
  bank?: number;
  /** 잘 맞는 나라(★ 덤: 출신 혜택 효과 +50%) */
  fit: string[];
  /** 잠금(처음엔 닫힘) · 여는 조건 설명 */
  lock?: { text: string; test: (h: HallLike[]) => boolean };
}
export interface HallLike {
  kind: string;
}

export const ORIGINS: Origin[] = [
  { id: 'econ', icon: '💼', name: '경제관료', line: '숫자로 나라를 살려 온 재정 전문가', stats: { 군수: 6, 정치: 4, 체력: -3, 사격: -3, 포격: -4 }, perk: '경제 지수 +10 · 세금 불만 −20%', weak: '군부 신뢰 −10', buddy: '기재부 장관 후보', eff: { fieldEconomy: 10, taxSoft: 0.2 }, startApproval: 50, startTrust: 40, fit: ['kr', 'jp', 'de'] },
  { id: 'general', icon: '⭐', name: '군 장성', line: '전선에서 별을 단 야전 지휘관', stats: { 통솔: 6, 전술: 4, 포격: 2, 정치: -5, 정보: -3, 은밀: -4 }, perk: '안보 +10 · 모집 +10%', weak: '외교 위상 −5 · 야당 견제', buddy: '장군 후보', eff: { fieldDefense: 10, build: 0.1, fieldDiplo: -5 }, startApproval: 50, startTrust: 50, fit: ['us', 'kp', 'tr'] },
  { id: 'scientist', icon: '🔬', name: '과학자', line: '연구실에서 나라의 미래를 설계한 학자', stats: { 정보: 6, 전술: 3, 체력: -4, 사격: -3, 통솔: -2 }, perk: '연구 속도 +15% · 첫 연구 점수 3시간치', weak: '지지도 출발 −5', buddy: '과기부 장관 후보', eff: { research: 0.15 }, startApproval: 45, startTrust: 50, bank: 3, fit: ['jp', 'de', 'il'] },
  { id: 'athlete', icon: '🏅', name: '운동선수', line: '금메달로 국민 영웅이 된 스타', stats: { 체력: 8, 사격: 3, 정치: -4, 군수: -4, 정보: -3 }, perk: '지지도 +12 · 높은 명성으로 시작', weak: '신뢰도 −10', buddy: '인기 많은 부관', eff: { fieldPersonal: 10 }, startApproval: 62, startTrust: 40, fame: 40, fit: ['kr', 'us', 'ua'] },
  { id: 'diplomat', icon: '🌐', name: '외교관', line: '세계 수도를 누빈 노련한 협상가', stats: { 정치: 5, 정보: 3, 체력: -3, 사격: -3, 포격: -2 }, perk: '모든 나라 호감 +10', weak: '안보 −5', buddy: '외교부 장관 후보', eff: { favor: 10, fieldDefense: -5 }, startApproval: 50, startTrust: 50, fit: ['uk', 'in', 'tr'] },
  { id: 'spy', icon: '🕵️', name: '정보요원', line: '그림자 속에서 나라를 지킨 요원', stats: { 은밀: 6, 정보: 5, 정치: -5, 통솔: -3, 체력: -3 }, perk: '첩보 성공 +10%p · 정보 점수 넉넉히', weak: '지지도 −5(어두운 과거)', buddy: '국정원장 후보', eff: { spy: 0.1 }, startApproval: 45, startTrust: 50, intel: 300, fit: ['il', 'ru', 'ir'], lock: { text: '연합 승리 1번', test: (h) => h.some((x) => x.kind === '연합 승리') } },
  { id: 'lawyer', icon: '⚖️', name: '인권 변호사', line: '약자의 편에서 싸워 온 법률가', stats: { 정치: 6, 정보: 2, 사격: -3, 포격: -3, 체력: -2 }, perk: '법안 통과 +10%p · 청문회 유리', weak: '군부 신뢰 −10', buddy: '법무 차관', eff: { law: 0.1, hearing: 0.1 }, startApproval: 52, startTrust: 40, fit: ['kr', 'uk', 'in'] },
  { id: 'chaebol', icon: '🏢', name: '재벌 2세', line: '대기업을 물려받은 재계의 후계자', stats: { 군수: 5, 정치: 3, 통솔: -3, 체력: -2, 은밀: -3 }, perk: '시작 금고 +50% · 재계 신뢰', weak: '지지도 −8', buddy: '재벌 회장 1명', eff: { fieldEconomy: 5 }, startApproval: 42, startTrust: 55, treasury: 1.5, fit: ['kr', 'jp', 'us'], lock: { text: '아무 승리 1번', test: (h) => h.length >= 1 } },
  { id: 'broadcaster', icon: '🎙️', name: '방송인', line: '말 한마디로 여론을 움직이는 진행자', stats: { 정치: 5, 정보: 3, 포격: -3, 군수: -3, 전술: -2 }, perk: '연설·기자회견 효과 +30%', weak: '신뢰도 −5', buddy: '문화홍보처장 후보', eff: { speech: 0.3, fieldPersonal: 5 }, startApproval: 55, startTrust: 45, fame: 20, fit: ['us', 'uk', 'ua'], lock: { text: '승리 2번', test: (h) => h.length >= 2 } },
  { id: 'activist', icon: '✊', name: '시민운동가', line: '광장에서 시민과 함께 걸어 온 운동가', stats: { 통솔: 4, 정치: 4, 포격: -3, 군수: -3, 사격: -2 }, perk: '모든 도시 민심 +5 · 파업을 쉽게 풂', weak: '재계 신뢰 −10', buddy: '시민단체 대표', eff: { loyalty: 5 }, startApproval: 55, startTrust: 40, fit: ['kr', 'ua', 'in'] },
  { id: 'doctor', icon: '🩺', name: '의사', line: '병원과 재난 현장을 지켜 온 의사', stats: { 체력: 3, 정보: 3, 군수: 2, 사격: -3, 포격: -3, 은밀: -2 }, perk: '인구 성장 +15% · 민심 +2', weak: '안보 −5', buddy: '복지부 장관 후보', eff: { growth: 0.15, loyalty: 2, fieldDefense: -5 }, startApproval: 52, startTrust: 50, fit: ['de', 'jp', 'in'] },
  { id: 'mayor', icon: '🏙️', name: '지방 시장', line: '도시를 키워 낸 살림꾼 시장', stats: { 군수: 3, 통솔: 3, 정치: 3, 사격: -3, 은밀: -3, 포격: -3 }, perk: '도시 구역 짓기 15% 빠름', weak: '외교 위상 −5', buddy: '행안부 장관 후보', eff: { district: 0.15, fieldDiplo: -5, fieldSociety: 3 }, startApproval: 52, startTrust: 50, fit: ['kr', 'cn', 'tr'] },
  { id: 'commando', icon: '🪂', name: '특수부대원', line: '적진 깊숙이 뛰어든 특수전 요원', stats: { 은밀: 5, 사격: 5, 체력: 2, 정치: -5, 군수: -4, 정보: -3 }, perk: '훈련 경험치 +20% · 임무 성공 +5%p', weak: '신뢰도 −8', buddy: '특수부대 출신 부관', eff: { train: 0.2, mission: 0.05 }, startApproval: 50, startTrust: 42, fit: ['il', 'us', 'ru'], lock: { text: '정복 승리 1번', test: (h) => h.some((x) => x.kind === '정복 승리') } },
  { id: 'admiral', icon: '🚢', name: '해군 제독', line: '대양 함대를 이끈 바다의 지휘관', stats: { 전술: 5, 포격: 4, 체력: -3, 은밀: -3, 정치: -3 }, perk: '해군 모집 +20% · 안보 +5', weak: '육군 쪽 불만(신뢰 −5)', buddy: '해군 참모총장 후보', eff: { buildNavy: 0.2, fieldDefense: 5 }, startApproval: 50, startTrust: 45, fit: ['uk', 'jp', 'us'], lock: { text: '승리 3번', test: (h) => h.length >= 3 } },
  { id: 'commoner', icon: '🌾', name: '서민(농부·어부)', line: '논밭과 바다에서 올라온 보통 사람', stats: { 체력: 4, 통솔: 3, 정보: -3, 포격: -2, 군수: -2 }, perk: '지지도 +10 · 생활 자원 생산 +', weak: '정계 인맥 없음(청문회 불리)', buddy: '고향 친구 부관', eff: { luxury: 0.25, hearing: -0.1, fieldPersonal: 5 }, startApproval: 60, startTrust: 45, fit: ['in', 'cn', 'ir'] },
  { id: 'religious', icon: '🙏', name: '종교인', line: '신앙 공동체가 믿고 따르는 지도자', stats: { 정치: 4, 통솔: 4, 사격: -3, 포격: -3, 전술: -2 }, perk: '같은 신앙 나라 호감 +15', weak: '다른 신앙 나라 호감 −5', buddy: '종교계 원로', eff: { favorFaith: 15, loyalty: 2 }, startApproval: 52, startTrust: 50, fit: ['ir', 'il', 'tr'], lock: { text: '평화 승리 1번', test: (h) => h.some((x) => x.kind === '평화 승리') } },
];

export const originById = (id: string | undefined | null): Origin | null => ORIGINS.find((o) => o.id === id) ?? null;
export const originOf = (s: GameState): Origin | null => originById(s.player.origin);

/** 이 나라와 잘 맞는 출신인지(★) */
export const originFits = (o: Origin, countryId: string) => o.fit.includes(countryId);

/** 출신 효과 값(잘 맞는 나라면 1.5배) */
export function originEff(s: GameState, k: OriginEffKey): number {
  const o = originOf(s);
  const v = o?.eff[k] ?? 0;
  if (!v) return 0;
  return originFits(o!, s.player.countryId) && v > 0 ? v * 1.5 : v;
}

/** 출신 잠금: 명예의 전당(승리 기록)으로 판단 */
export function originOpen(o: Origin, hall: HallLike[]): boolean {
  return !o.lock || o.lock.test(hall);
}

/** 출신 스탯: 모두 8에서 시작해 더하고 빼기(합 72 그대로, 최소 3) */
export function originStats(o: Origin, base: number): Partial<Record<StatId, number>> {
  return Object.fromEntries(Object.entries(o.stats).map(([k, v]) => [k, Math.max(3, base + (v ?? 0))])) as Partial<Record<StatId, number>>;
}

/** 새 게임에 출신을 입힘(스탯·지지도·신뢰도·금고·명성·연구 점수) */
export function applyOrigin(s: GameState, id: OriginId): GameState {
  const o = originById(id);
  if (!o) return s;
  const stats = { ...s.officer.stats };
  for (const [k, v] of Object.entries(o.stats)) stats[k as StatId] = Math.max(3, (stats[k as StatId] ?? 8) + (v ?? 0));
  const me = s.player.countryId;
  const nations = { ...s.nations, [me]: { ...s.nations[me], treasury: s.nations[me].treasury * (o.treasury ?? 1), def: (s.nations[me].def ?? 0) * (o.treasury ?? 1) } };
  const civ = s.civ && o.bank ? { ...s.civ, bank: { mil: s.civ.bank.mil + o.bank, soc: s.civ.bank.soc + o.bank } } : s.civ;
  return {
    ...s,
    player: { ...s.player, origin: id },
    nations,
    civ,
    officer: { ...s.officer, stats, trust: o.startTrust, fame: s.officer.fame + (o.fame ?? 0), intel: s.officer.intel + (o.intel ?? 0) },
    pres: { approval: o.startApproval, impeachMs: null, hist: [], mods: [] },
  };
}
