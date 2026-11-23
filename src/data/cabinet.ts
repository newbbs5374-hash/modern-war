// 정부 부처 9곳 · 인물 특화·성향·숨은 특성·파벌·등급(11-23 대장 결정). 계산은 src/game/cabinet.ts
import type { StatId } from './officers';

export type MinistryId = 'mnd' | 'nis' | 'mofa' | 'mof' | 'moti' | 'mois' | 'mohw' | 'msit' | 'kocis';
export type FieldTab = 'defense' | 'diplo' | 'society' | 'economy';

export type SpecId = '경제통' | '외교통' | '행정통' | '복지통' | '과학자' | '홍보통' | '육군통' | '해군통' | '공군통' | '정보통' | '군수통';
export const SPECS: SpecId[] = ['경제통', '외교통', '행정통', '복지통', '과학자', '홍보통', '육군통', '해군통', '공군통', '정보통', '군수통'];

export interface Ministry {
  id: MinistryId;
  icon: string;
  name: string;
  short: string;
  tab: FieldTab;
  role: string;
  /** 정보창 긴 설명 */
  text: string;
  stats: StatId[];
  spec: SpecId[];
  /** 장관 효과 설명(p = 장관 힘, 0~약 1.5) */
  effText: string;
  tasks: Array<{ id: string; icon: string; name: string; hours: number; text: string }>;
}

export const MINISTRIES: Ministry[] = [
  {
    id: 'mnd', icon: '🛡️', name: '국방부', short: '국방', tab: 'defense', role: '군대 살림과 모집',
    text: '군대에 필요한 사람·장비·예산을 챙기는 부처예요. 부대를 얼마나 빨리 모으고, 병력을 얼마나 오래 지키는지가 국방부 손에 달려 있어요.',
    stats: ['통솔', '군수'], spec: ['육군통', '해군통', '공군통', '군수통'], effText: '모든 부대 모집 속도 · 징병',
    tasks: [
      { id: 'reform', icon: '🔧', name: '국방 개혁', hours: 6, text: '하루 동안 모든 모집 +20%(장관 힘만큼 더)' },
      { id: 'drill', icon: '🎖️', name: '합동 훈련', hours: 4, text: '안보 점수 +8(12시간) · 병력 조금 +' },
    ],
  },
  {
    id: 'nis', icon: '🕵️', name: '국가정보원', short: '정보', tab: 'defense', role: '첩보와 방첩',
    text: '다른 나라의 비밀을 캐고, 우리 나라에 들어온 공작원을 잡는 곳이에요. 인물 신원 조회도 여기서 해요.',
    stats: ['정보', '은밀'], spec: ['정보통'], effText: '첩보 성공률 · 임무 성공률',
    tasks: [
      { id: 'counter', icon: '🧲', name: '방첩 작전', hours: 6, text: '정보 점수 + · 하루 동안 정적 방해 공작을 막음' },
      { id: 'vet', icon: '🗂️', name: '인재 신원 조회', hours: 3, text: '인재 명단의 숨은 특성을 모두 알아냄' },
    ],
  },
  {
    id: 'mofa', icon: '🌐', name: '외교부', short: '외교', tab: 'diplo', role: '다른 나라와 관계',
    text: '다른 나라와 대화하고 협정을 지키는 부처예요. 호감이 오르는 속도와 정상회담 성공이 외교부에 달려 있어요.',
    stats: ['정치', '정보'], spec: ['외교통'], effText: '모든 나라 호감',
    tasks: [
      { id: 'envoy', icon: '✈️', name: '특사 파견', hours: 6, text: '가장 긴장된 나라 호감 +10(장관 힘만큼 더)' },
      { id: 'summit', icon: '🤝', name: '정상회담 준비', hours: 4, text: '하루 동안 외교 위상 +8 · 친서 성공 +' },
    ],
  },
  {
    id: 'mof', icon: '💼', name: '기획재정부', short: '재정', tab: 'economy', role: '나라 돈과 세금',
    text: '나라 살림을 짜고 세금을 걷는 부처예요. 장관이 유능하면 같은 세금으로도 수입이 늘고 국민 불만은 줄어요.',
    stats: ['군수', '정치'], spec: ['경제통'], effText: '국방예산 수입 · 세금 불만 줄이기',
    tasks: [
      { id: 'stimulus', icon: '📈', name: '경기 부양', hours: 6, text: '12시간 동안 경제 지수 +10 · 지지도 +3' },
      { id: 'bond', icon: '🏦', name: '국채 발행', hours: 2, text: '금고 +6시간치 수입(대신 하루 동안 경제 지수 −5)' },
    ],
  },
  {
    id: 'moti', icon: '🏭', name: '산업자원부', short: '산업', tab: 'economy', role: '공장과 자원',
    text: '공장을 돌리고 광산·자원을 관리하는 부처예요. 장관이 자원 생산과 가공을 키워요.',
    stats: ['군수', '전술'], spec: ['경제통', '과학자', '군수통'], effText: '모든 자원 생산',
    tasks: [
      { id: 'survey', icon: '⛏️', name: '자원 탐사', hours: 6, text: '부족한 기본 자원 3가지를 넉넉히 얻음' },
      { id: 'overtime', icon: '⚙️', name: '공장 특근', hours: 4, text: '하루 동안 자원 +15%(대신 사회 안정 −3)' },
    ],
  },
  {
    id: 'mois', icon: '🏛️', name: '행정안전부', short: '행정', tab: 'society', role: '도시·치안·재난',
    text: '도시 행정과 치안, 재난 대응을 맡는 부처예요. 점령지를 조용히 하고 도시 민심을 받쳐 줘요.',
    stats: ['통솔', '정치'], spec: ['행정통'], effText: '모든 도시 민심',
    tasks: [
      { id: 'disaster', icon: '🚒', name: '재난 대비', hours: 6, text: '모든 도시 민심 +5 · 하루 동안 사회 안정 +5' },
      { id: 'police', icon: '🚓', name: '치안 강화', hours: 4, text: '점령지 민심 +10' },
    ],
  },
  {
    id: 'mohw', icon: '🏥', name: '보건복지부', short: '복지', tab: 'society', role: '국민 생활과 병원',
    text: '병원과 복지를 맡는 부처예요. 민심과 인구 성장을 돕고, 다친 병사가 빨리 돌아오게 해요.',
    stats: ['정치', '군수'], spec: ['복지통'], effText: '인구 성장 · 민심',
    tasks: [
      { id: 'welfare', icon: '🍲', name: '복지 정책', hours: 6, text: '민심이 가장 낮은 도시 민심 +12' },
      { id: 'vaccine', icon: '💉', name: '예방 접종', hours: 4, text: '하루 동안 지지도 +4' },
    ],
  },
  {
    id: 'msit', icon: '🔬', name: '과학기술부', short: '과학', tab: 'society', role: '연구',
    text: '군사·사회 연구를 이끄는 부처예요. 장관이 똑똑할수록 연구가 빨라져요.',
    stats: ['정보', '전술'], spec: ['과학자'], effText: '연구 속도(군사·사회 둘 다)',
    tasks: [
      { id: 'focus', icon: '🧪', name: '연구 집중', hours: 6, text: '지금 연구 두 줄에 3시간치 점수(장관 힘만큼 더)' },
      { id: 'expo', icon: '🚀', name: '과학 박람회', hours: 4, text: '하루 동안 지지도 +3 · 명성 +' },
    ],
  },
  {
    id: 'kocis', icon: '📺', name: '문화홍보처', short: '홍보', tab: 'society', role: '언론과 홍보',
    text: '정부 소식을 국민에게 알리고 언론을 상대하는 곳이에요. 지지도가 쉽게 떨어지지 않게 받쳐 줘요.',
    stats: ['정치', '정보'], spec: ['홍보통'], effText: '지지도 덤 · 연설 효과',
    tasks: [
      { id: 'campaign', icon: '📣', name: '홍보 캠페인', hours: 6, text: '12시간 동안 지지도 +5(장관 힘만큼 더)' },
      { id: 'brief', icon: '🎙️', name: '정례 브리핑', hours: 3, text: '신뢰도 +3' },
    ],
  },
];
export const ministryById = (id: MinistryId) => MINISTRIES.find((m) => m.id === id)!;
/** 장관 자리 수: 등급이 오를수록(처음 3석 → 전설의 지도자 9석) */
export const ministerSlots = (rank: number) => Math.min(9, 3 + Math.floor(rank * 0.6));

/* ───────── 인물 ───────── */

export type PersonOrigin =
  | 'econ' | 'general' | 'scientist' | 'athlete' | 'diplomat' | 'spy' | 'lawyer' | 'chaebol' | 'broadcaster' | 'activist' | 'doctor' | 'mayor' | 'commando' | 'admiral' | 'commoner' | 'religious'
  | 'soldier' | 'partisan' | 'professor' | 'exec' | 'prosecutor' | 'journalist';

/** 인물 출신 22가지(지도자 16 + 인물 전용 6): 이름·스탯 모양·보통 특화·파벌 */
export const PERSON_ORIGINS: Record<PersonOrigin, { name: string; icon: string; shape: Partial<Record<StatId, number>>; spec: SpecId[]; faction: Faction }> = {
  econ: { name: '경제관료', icon: '💼', shape: { 군수: 6, 정치: 4, 체력: -3, 사격: -3, 포격: -4 }, spec: ['경제통'], faction: '경제파' },
  general: { name: '군 장성', icon: '⭐', shape: { 통솔: 6, 전술: 4, 포격: 2, 정치: -5, 정보: -3, 은밀: -4 }, spec: ['육군통', '공군통'], faction: '군부파' },
  scientist: { name: '과학자', icon: '🔬', shape: { 정보: 6, 전술: 3, 체력: -4, 사격: -3, 통솔: -2 }, spec: ['과학자'], faction: '개혁파' },
  athlete: { name: '운동선수', icon: '🏅', shape: { 체력: 8, 사격: 3, 정치: -4, 군수: -4, 정보: -3 }, spec: ['홍보통'], faction: '온건파' },
  diplomat: { name: '외교관', icon: '🌐', shape: { 정치: 5, 정보: 3, 체력: -3, 사격: -3, 포격: -2 }, spec: ['외교통'], faction: '온건파' },
  spy: { name: '정보요원', icon: '🕵️', shape: { 은밀: 6, 정보: 5, 정치: -5, 통솔: -3, 체력: -3 }, spec: ['정보통'], faction: '군부파' },
  lawyer: { name: '인권 변호사', icon: '⚖️', shape: { 정치: 6, 정보: 2, 사격: -3, 포격: -3, 체력: -2 }, spec: ['행정통', '복지통'], faction: '개혁파' },
  chaebol: { name: '재벌 2세', icon: '🏢', shape: { 군수: 5, 정치: 3, 통솔: -3, 체력: -2, 은밀: -3 }, spec: ['경제통'], faction: '경제파' },
  broadcaster: { name: '방송인', icon: '🎙️', shape: { 정치: 5, 정보: 3, 포격: -3, 군수: -3, 전술: -2 }, spec: ['홍보통'], faction: '온건파' },
  activist: { name: '시민운동가', icon: '✊', shape: { 통솔: 4, 정치: 4, 포격: -3, 군수: -3, 사격: -2 }, spec: ['복지통', '행정통'], faction: '개혁파' },
  doctor: { name: '의사', icon: '🩺', shape: { 체력: 3, 정보: 3, 군수: 2, 사격: -3, 포격: -3, 은밀: -2 }, spec: ['복지통'], faction: '온건파' },
  mayor: { name: '지방 시장', icon: '🏙️', shape: { 군수: 3, 통솔: 3, 정치: 3, 사격: -3, 은밀: -3, 포격: -3 }, spec: ['행정통'], faction: '온건파' },
  commando: { name: '특수부대원', icon: '🪂', shape: { 은밀: 5, 사격: 5, 체력: 2, 정치: -5, 군수: -4, 정보: -3 }, spec: ['정보통', '육군통'], faction: '군부파' },
  admiral: { name: '해군 제독', icon: '🚢', shape: { 전술: 5, 포격: 4, 체력: -3, 은밀: -3, 정치: -3 }, spec: ['해군통'], faction: '군부파' },
  commoner: { name: '서민', icon: '🌾', shape: { 체력: 4, 통솔: 3, 정보: -3, 포격: -2, 군수: -2 }, spec: ['복지통'], faction: '개혁파' },
  religious: { name: '종교인', icon: '🙏', shape: { 정치: 4, 통솔: 4, 사격: -3, 포격: -3, 전술: -2 }, spec: ['외교통', '복지통'], faction: '온건파' },
  soldier: { name: '직업 군인', icon: '🪖', shape: { 통솔: 4, 사격: 4, 체력: 3, 정치: -4, 정보: -3, 군수: -4 }, spec: ['육군통', '해군통', '공군통', '군수통'], faction: '군부파' },
  partisan: { name: '정당인', icon: '🗳️', shape: { 정치: 7, 통솔: 2, 사격: -3, 포격: -3, 은밀: -3 }, spec: ['행정통', '홍보통'], faction: '온건파' },
  professor: { name: '교수', icon: '🎓', shape: { 정보: 5, 전술: 2, 정치: 2, 체력: -3, 사격: -3, 은밀: -3 }, spec: ['과학자', '경제통', '외교통'], faction: '개혁파' },
  exec: { name: '기업 임원', icon: '📊', shape: { 군수: 6, 전술: 2, 정치: 1, 체력: -3, 사격: -3, 포격: -3 }, spec: ['경제통', '군수통'], faction: '경제파' },
  prosecutor: { name: '검사', icon: '🔍', shape: { 정보: 4, 정치: 4, 통솔: 1, 사격: -3, 포격: -3, 체력: -3 }, spec: ['행정통', '정보통'], faction: '개혁파' },
  journalist: { name: '기자', icon: '📰', shape: { 정보: 5, 정치: 3, 포격: -3, 군수: -3, 통솔: -2 }, spec: ['홍보통', '외교통'], faction: '개혁파' },
};

export type Faction = '군부파' | '경제파' | '개혁파' | '온건파';
export const FACTIONS: Array<{ id: Faction; icon: string; bonus: string }> = [
  { id: '군부파', icon: '🎖️', bonus: '모든 모집 +6%' },
  { id: '경제파', icon: '💹', bonus: '국방예산 +5%' },
  { id: '개혁파', icon: '🌱', bonus: '모든 도시 민심 +3' },
  { id: '온건파', icon: '🕊️', bonus: '모든 나라 호감 +5' },
];
/** 같은 파벌이 이만큼 자리에 앉으면 보너스 */
export const FACTION_BONUS_AT = 3;

export type Trait = '청렴' | '야심' | '충직' | '인기인' | '강경파' | '원칙주의' | '실용주의' | '신중파';
export const TRAITS: Record<Trait, { icon: string; text: string }> = {
  청렴: { icon: '🤍', text: '스캔들이 없고 청문회에 유리 · 회유·빼 가기에 안 넘어감' },
  야심: { icon: '🔥', text: '능력 +15% · 대신 충성이 잘 떨어짐' },
  충직: { icon: '🫡', text: '충성이 잘 떨어지지 않음' },
  인기인: { icon: '🌟', text: '자리에 앉으면 지지도 +1' },
  강경파: { icon: '⚔️', text: '안보 +2 · 외교 위상 −2(자리에 있을 때)' },
  원칙주의: { icon: '📏', text: '청문회에 조금 유리 · 법안 반대 줄임' },
  실용주의: { icon: '🧰', text: '부처 업무 시간 −20%' },
  신중파: { icon: '🧐', text: '부처 업무 결과 +10%' },
};
export const TRAIT_IDS = Object.keys(TRAITS) as Trait[];

export type Hidden = '비리 전력' | '숨은 천재' | '건강 문제' | '언론 인기' | '이중 첩자 의혹';
export const HIDDEN: Record<Hidden, { icon: string; good: boolean; text: string }> = {
  '비리 전력': { icon: '💸', good: false, text: '청문회 크게 불리 · 가끔 스캔들(지지도 −)' },
  '숨은 천재': { icon: '💡', good: true, text: '능력 +25%' },
  '건강 문제': { icon: '🤒', good: false, text: '일찍 은퇴할 수 있음' },
  '언론 인기': { icon: '📸', good: true, text: '자리에 앉으면 지지도 +2' },
  '이중 첩자 의혹': { icon: '🎭', good: false, text: '다른 나라가 빼 가기 쉬움' },
};
export const HIDDEN_IDS = Object.keys(HIDDEN) as Hidden[];

export type Grade = '일반' | '우수' | '전설';
export const GRADES: Record<Grade, { icon: string; total: [number, number]; pay: number }> = {
  일반: { icon: '⚪', total: [60, 75], pay: 600 },
  우수: { icon: '🔵', total: [76, 90], pay: 1500 },
  전설: { icon: '🟡', total: [91, 105], pay: 4000 },
};

/** 인물 무리(도감·인물 수) */
export type Group = '인재' | '내각' | '군' | '정계' | '재계' | '언론' | '시민' | '외국';
export const GROUP_ICON: Record<Group, string> = { 인재: '📋', 내각: '🏛️', 군: '⭐', 정계: '🗳️', 재계: '🏢', 언론: '📺', 시민: '✊', 외국: '🌐' };
