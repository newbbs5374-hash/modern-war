// 문화(11-23 대장 요청, 문명 게임의 문화·관광 참고).
// 문화 시설 6가지 × 5단계, 걸작(유물·공연·히트작), 문화 행사, 나라별 문화 특기.
import type { Res } from './economy';

export type VenueId = 'museum' | 'stage' | 'stadium' | 'studio' | 'park' | 'heritage';
export const VENUE_IDS: VenueId[] = ['museum', 'stage', 'stadium', 'studio', 'park', 'heritage'];
export const VENUE_MAX = 5;

export interface VenueDef {
  id: VenueId;
  name: string;
  icon: string;
  text: string;
  /** 단계 이름(1~5단계) */
  levels: [string, string, string, string, string];
  /** 단계 힘 1점마다 시간당 문화 / 관광 */
  cul: number;
  tour: number;
  /** 단계마다 도시 민심(지지도 사회 점수) */
  mood: number;
  /** 5단계에 드는 특별 자원 */
  topRes: Res;
}

export const VENUES: VenueDef[] = [
  { id: 'museum', name: '박물관', icon: '🏛️', text: '나라의 역사와 유물을 모아 보여 줘요. 문화가 크게 오르고, 유물 걸작을 걸 수 있어요.', levels: ['향토 사료관', '시립 박물관', '국립 박물관', '국립 중앙박물관', '세계 유산 박물관'], cul: 1.4, tour: 0.6, mood: 0.4, topRes: '비단' },
  { id: 'stage', name: '공연장', icon: '🎭', text: '음악·연극·무용 무대. 문화와 관광이 고르게 오르고, 공연 걸작을 올릴 수 있어요.', levels: ['야외 무대', '시민 회관', '예술의 전당', '오페라 하우스', '세계 공연 센터'], cul: 1.0, tour: 1.0, mood: 0.6, topRes: '진주' },
  { id: 'stadium', name: '경기장', icon: '🏟️', text: '운동 경기로 국민이 하나가 돼요. 민심이 가장 많이 오르고, 월드컵·올림픽을 열 수 있어요.', levels: ['동네 운동장', '종합 운동장', '프로 구장', '국제 경기장', '올림픽 주경기장'], cul: 0.4, tour: 1.2, mood: 1.0, topRes: '알루미늄' },
  { id: 'studio', name: '방송·영화', icon: '🎬', text: '드라마·영화·음반을 만들어 세계로 내보내요. 다른 나라에 퍼지는 관광(영향력)이 가장 커요.', levels: ['지역 방송국', '영화 촬영소', '방송 스튜디오 단지', '영상 산업 도시', '세계 미디어 허브'], cul: 0.5, tour: 1.6, mood: 0.4, topRes: '반도체' },
  { id: 'park', name: '관광 단지', icon: '🎡', text: '공원·놀이공원·리조트. 관광객이 와서 돈을 쓰고 가요(관광 수입이 커요).', levels: ['관광 안내소', '도시 공원', '테마파크', '리조트 단지', '세계 관광 도시'], cul: 0.4, tour: 1.3, mood: 0.6, topRes: '산호' },
  { id: 'heritage', name: '문화유산', icon: '🏯', text: '옛 성·궁궐·유적을 되살려요. 비싸지만 문화와 관광이 둘 다 커요.', levels: ['유적 발굴지', '복원한 옛 성터', '국가 사적지', '세계 유산 등재지', '세계 7대 명소'], cul: 1.3, tour: 1.1, mood: 0.4, topRes: '차잎' },
];
export const venueById = (id: VenueId) => VENUES.find((v) => v.id === id)!;

/** 단계별 힘(1단계 1 … 5단계 10) */
export const LEVEL_POWER = [0, 1, 2.5, 4.5, 7, 10];
/** 그 단계로 올리는 값(국방예산)과 시간(실제 시간) */
export const LEVEL_COST = [0, 400, 1000, 2400, 5000, 10000];
export const LEVEL_HOURS = [0, 2, 4, 8, 16, 30];
/** 문화유산은 더 비쌈 */
export const HERITAGE_COST_MULT = 1.3;
/** 그 단계로 올릴 때 드는 자원 */
export function levelRes(v: VenueDef, to: number): Partial<Record<Res, number>> {
  if (to <= 2) return {};
  if (to === 3) return { 강철: 3 };
  if (to === 4) return { 강철: 5, 구리: 2 };
  return { 강철: 6, [v.topRes]: 2 };
}

/* ── 걸작 ── */
export type WorkKind = 'relic' | 'show' | 'hit';
export interface WorkKindDef {
  id: WorkKind;
  name: string;
  icon: string;
  /** 걸어 둘 시설(그 시설 단계 = 걸 수 있는 칸 수) */
  venue: VenueId;
  names: string[];
}
export const WORK_KINDS: WorkKindDef[] = [
  { id: 'relic', name: '유물', icon: '🏺', venue: 'museum', names: ['고대 왕관', '청동 투구', '두루마리 산수화', '황금 가면', '대리석 조각상', '옛 세계 지도', '왕실 도장', '첫 인쇄 활자', '고대 악기', '전설의 검'] },
  { id: 'show', name: '공연', icon: '🎻', venue: 'stage', names: ['국민 오페라', '전통 무용극', '교향곡 「새벽」', '전설의 뮤지컬', '세계 발레 갈라', '거리 예술 축제', '록 페스티벌', '합창 대서사시', '마당극 한 판', '재즈의 밤'] },
  { id: 'hit', name: '히트작', icon: '📀', venue: 'studio', names: ['천만 관객 영화', '세계 1위 드라마', '아이돌 월드 앨범', '애니메이션 대작', '역사 대하 사극', '첩보 액션 시리즈', '요리 예능', '다큐 「푸른 별」', '게임 원작 영화', '세계 가요 1위 곡'] },
];
export const workKindById = (id: WorkKind) => WORK_KINDS.find((w) => w.id === id)!;

/* 걸작 등급(11-25): 스타가 만들 때 등급이 정해져요 */
export type Grade = 'C' | 'B' | 'A';
export const GRADES: Record<Grade, { name: string; cul: number; tour: number; mood: number; weight: number; tone: 'blue' | 'green' | 'gold' }> = {
  C: { name: '보통', cul: 0.5, tour: 1, mood: 0, weight: 60, tone: 'blue' },
  B: { name: '귀한', cul: 1, tour: 2, mood: 0, weight: 30, tone: 'green' },
  A: { name: '전설', cul: 2, tour: 4, mood: 1, weight: 10, tone: 'gold' },
};
export interface WorkDef {
  /** 그림 파일 icon-cul-work-<id> */
  id: string;
  kind: WorkKind;
  name: string;
  grade: Grade;
  text: string;
}
const W = (kind: WorkKind, n: number, name: string, grade: Grade, text: string): WorkDef => ({ id: `${kind}-${n}`, kind, name, grade, text });
export const WORKS: WorkDef[] = [
  W('relic', 1, '고대 왕관', 'A', '천오백 년 전 왕이 쓰던 금관. 나뭇가지 모양 장식이 반짝여요.'),
  W('relic', 2, '청동 투구', 'C', '옛 장수가 쓰던 녹슨 청동 투구.'),
  W('relic', 3, '두루마리 산수화', 'B', '산과 강을 그린 길이 10미터 두루마리 그림.'),
  W('relic', 4, '황금 가면', 'A', '왕의 무덤에서 나온 순금 가면.'),
  W('relic', 5, '대리석 조각상', 'B', '바다 건너 들어온 하얀 대리석 여신상.'),
  W('relic', 6, '옛 세계 지도', 'B', '600년 전 사람들이 그린 세계 지도.'),
  W('relic', 7, '왕실 도장', 'C', '왕이 문서에 찍던 옥 도장.'),
  W('relic', 8, '첫 인쇄 활자', 'B', '세계에서 가장 오래된 금속 활자 몇 개.'),
  W('relic', 9, '고대 악기', 'C', '줄이 다섯 개인 옛 현악기.'),
  W('relic', 10, '전설의 검', 'A', '나라를 세운 영웅이 썼다는 칼.'),
  W('show', 1, '국민 오페라', 'B', '온 국민이 따라 부르는 아리아가 있는 오페라.'),
  W('show', 2, '전통 무용극', 'C', '옛 이야기를 춤으로 풀어낸 무대.'),
  W('show', 3, '교향곡 「새벽」', 'A', '전쟁 뒤 새벽을 노래한 교향곡. 세계 오케스트라가 연주해요.'),
  W('show', 4, '전설의 뮤지컬', 'A', '10년째 매진인 뮤지컬.'),
  W('show', 5, '세계 발레 갈라', 'A', '세계 최고 무용수가 모이는 밤.'),
  W('show', 6, '거리 예술 축제', 'C', '도시 곳곳이 무대가 되는 축제.'),
  W('show', 7, '록 페스티벌', 'C', '사흘 동안 이어지는 야외 공연.'),
  W('show', 8, '합창 대서사시', 'B', '천 명이 함께 부르는 합창.'),
  W('show', 9, '마당극 한 판', 'C', '관객과 함께 웃고 우는 마당 놀이.'),
  W('show', 10, '재즈의 밤', 'B', '항구 도시의 작은 클럽에서 시작된 재즈 공연.'),
  W('hit', 1, '천만 관객 영화', 'A', '국민 다섯 명 중 한 명이 본 영화.'),
  W('hit', 2, '세계 1위 드라마', 'A', '90개 나라에서 1위를 한 드라마.'),
  W('hit', 3, '아이돌 월드 앨범', 'B', '세계 순위표 꼭대기에 오른 앨범.'),
  W('hit', 4, '애니메이션 대작', 'B', '아이부터 어른까지 우는 애니메이션.'),
  W('hit', 5, '역사 대하 사극', 'B', '100부작 역사 드라마.'),
  W('hit', 6, '첩보 액션 시리즈', 'C', '비밀 요원 이야기 시리즈.'),
  W('hit', 7, '요리 예능', 'C', '세계 음식을 만드는 예능 방송.'),
  W('hit', 8, '다큐 「푸른 별」', 'C', '지구의 바다를 담은 다큐멘터리.'),
  W('hit', 9, '게임 원작 영화', 'C', '인기 게임을 영화로 만든 작품.'),
  W('hit', 10, '세계 가요 1위 곡', 'A', '전 세계가 따라 추는 노래.'),
];
export const workByName = (name: string) => WORKS.find((w) => w.name === name);
/** 걸작 하나가 주는 시간당 문화 / 관광(옛 기본값 = 보통 등급) */
export const WORK_CUL = GRADES.C.cul;
export const WORK_TOUR = GRADES.C.tour;
/** n번째 걸작 값(문화 점수) */
export const workCost = (have: number) => 120 * (have + 1);
/** 칸이 3칸 이상이고 모두 차면 "테마 전시 완성": 그 종류 걸작 효과 ×1.5 */
export const THEME_MIN = 3;
export const THEME_MULT = 1.5;
/** 걸작 만드는 시간(실제 시간) */
export const CREATE_HOURS: Record<WorkKind, number> = { relic: 8, show: 6, hit: 10 };

/* ── 스타(문화 인물, 11-25) ── */
export type StarKind = 'arch' | 'artist' | 'director' | 'athlete' | 'architect';
export interface StarKindDef {
  id: StarKind;
  name: string;
  icon: string;
  /** 이 시설 단계 힘만큼 인재가 모여요 */
  from: VenueId[];
  /** 만드는 걸작 */
  work?: WorkKind;
  /** 데리고 있으면 생기는 효과 */
  perk: string;
  names: string[];
}
export const STAR_KINDS: StarKindDef[] = [
  { id: 'arch', name: '고고학자', icon: '🧭', from: ['museum', 'heritage'], work: 'relic', perk: '유적을 발굴해 🏺유물 걸작을 찾아요', names: ['사막의 여우', '모래시계 박사', '잃어버린 왕국의 발견자', '바닷속 보물 사냥꾼'] },
  { id: 'artist', name: '예술가', icon: '🎼', from: ['stage'], work: 'show', perk: '무대를 만들어 🎻공연 걸작을 올려요', names: ['무대의 마술사', '은빛 목소리', '맨발의 무용수', '천재 지휘자'] },
  { id: 'director', name: '감독', icon: '🎬', from: ['studio'], work: 'hit', perk: '작품을 찍어 📀히트작 걸작을 만들어요', names: ['천만 감독', '밤의 이야기꾼', '액션의 장인', '다큐의 눈'] },
  { id: 'athlete', name: '스포츠 스타', icon: '🏅', from: ['stadium'], perk: '한 명마다 행사 관광 덤 +15% · 민심 +0.5', names: ['국민 골잡이', '철인 마라토너', '빙판의 여왕', '홈런왕'] },
  { id: 'architect', name: '건축가', icon: '📐', from: ['park', 'heritage'], perk: '한 명마다 문화 시설 공사 시간 -15%', names: ['유리 탑의 건축가', '돌다리 장인', '하늘 정원 설계자', '곡선의 거장'] },
];
export const starKindById = (id: StarKind) => STAR_KINDS.find((k) => k.id === id)!;
/** 종류마다 데리고 있을 수 있는 스타 */
export const STAR_MAX = 2;
/** 인재 점수: 시설 단계 힘 1마다 시간당 */
export const TALENT_RATE = 1;
/** n번째(0부터) 스타를 데려오는 데 드는 인재 점수 */
export const starCost = (n: number) => 30 * (n + 1);
export const ATHLETE_EVENT = 0.15;
export const ATHLETE_MOOD = 0.5;
export const ARCHITECT_FAST = 0.15;

/* ── 관광 코스(11-25) ── */
export type CourseId = 'history' | 'stage' | 'sports' | 'resort' | 'filmset' | 'grand';
export interface CourseDef {
  id: CourseId;
  name: string;
  icon: string;
  text: string;
  needs: Partial<Record<VenueId, number>>;
  money: number;
  /** 관광 +비율 / 문화 +비율 / 관광 수입 +비율 / 민심 */
  tour?: number;
  cul?: number;
  income?: number;
  mood?: number;
  /** 히트작 하나마다 관광 +비율 */
  perHit?: number;
}
export const COURSES: CourseDef[] = [
  { id: 'history', name: '역사 탐방', icon: '🏯', text: '박물관과 옛 유적을 하루에 도는 코스.', needs: { museum: 2, heritage: 2 }, money: 1500, tour: 0.15, cul: 0.1 },
  { id: 'stage', name: '공연 순례', icon: '🎤', text: '밤마다 다른 무대를 보러 다니는 코스.', needs: { stage: 2, studio: 2 }, money: 1500, tour: 0.2 },
  { id: 'sports', name: '스포츠 관전', icon: '⚽', text: '경기 보고 놀이공원까지 가는 코스.', needs: { stadium: 2, park: 2 }, money: 1500, tour: 0.1, mood: 2 },
  { id: 'resort', name: '가족 휴양', icon: '🏖️', text: '리조트에서 쉬며 돈을 많이 쓰는 코스.', needs: { park: 3 }, money: 2500, income: 0.5 },
  { id: 'filmset', name: '촬영지 순례', icon: '🎥', text: '드라마·영화에 나온 곳을 찾아가는 코스. 히트작이 많을수록 더 와요.', needs: { studio: 3, park: 2 }, money: 3000, tour: 0.1, perHit: 0.04 },
  { id: 'grand', name: '세계 명소 일주', icon: '🌍', text: '나라의 보물을 모두 도는 최고급 코스.', needs: { heritage: 4, park: 4, museum: 3 }, money: 8000, tour: 0.3, cul: 0.15, income: 0.3 },
];
export const courseById = (id: CourseId) => COURSES.find((c) => c.id === id)!;
/** 동시에 열 수 있는 코스(관광 단지 5단계면 +1) */
export const COURSE_SLOTS = 2;
/** 하루 관광객 = 시간당 관광 × 이만큼(보여 주기용) */
export const VISITORS_PER_TOUR = 1000;

/* ── 문화 행사 ── */
export type CultureEventId = 'exhibit' | 'tour' | 'film' | 'expo' | 'worldcup' | 'olympics';
export interface CultureEventDef {
  id: CultureEventId;
  name: string;
  icon: string;
  text: string;
  /** 필요한 시설 단계 */
  needs: Partial<Record<VenueId, number>>;
  money: number;
  hours: number;
  /** 다시 열 수 있을 때까지(실제 시간, 끝난 뒤부터) */
  coolHours: number;
  /** 행사 동안 관광 배율 덤 */
  boost: number;
  /** 한 나라를 골라야 함 */
  target?: boolean;
  /** 전쟁 중엔 못 엶 */
  peace?: boolean;
  /** 끝날 때 보상 */
  reward: { points?: number; approval?: number; approvalHours?: number; favorAll?: number; favor?: number; burst?: number };
}
export const CULTURE_EVENTS: CultureEventDef[] = [
  { id: 'exhibit', name: '특별 전시회', icon: '🖼️', text: '세계의 보물을 빌려 와 전시해요. 끝나면 문화 점수 +150.', needs: { museum: 2 }, money: 800, hours: 6, coolHours: 24, boost: 0.3, reward: { points: 150 } },
  { id: 'tour', name: '월드 투어 콘서트', icon: '🎤', text: '한 나라를 골라 큰 공연을 열어요. 그 나라에 우리 문화가 확 퍼지고(관광 30시간치) 호감 +5.', needs: { stage: 3 }, money: 1500, hours: 8, coolHours: 24, boost: 0.2, target: true, reward: { burst: 30, favor: 5 } },
  { id: 'film', name: '국제 영화제', icon: '🎬', text: '세계 영화인이 모여요. 행사 동안 관광 +50%, 끝나면 지지도 +4(하루).', needs: { studio: 3 }, money: 2500, hours: 12, coolHours: 48, boost: 0.5, reward: { approval: 4, approvalHours: 24, points: 200 } },
  { id: 'expo', name: '세계 박람회', icon: '🎪', text: '온 세계가 기술·문화를 뽐내요. 행사 동안 관광 2배, 끝나면 모든 나라 호감 +3.', needs: { park: 4, museum: 3 }, money: 6000, hours: 24, coolHours: 5 * 24, boost: 1, reward: { points: 600, favorAll: 3 } },
  { id: 'worldcup', name: '월드컵 유치', icon: '⚽', text: '세계가 열광하는 축구 대회. 행사 동안 관광 2.2배, 끝나면 지지도 +8(이틀)·모든 나라 호감 +3. 전쟁 중엔 못 열어요.', needs: { stadium: 4 }, money: 8000, hours: 36, coolHours: 7 * 24, boost: 1.2, peace: true, reward: { approval: 8, approvalHours: 48, favorAll: 3 } },
  { id: 'olympics', name: '올림픽 유치', icon: '🏅', text: '가장 큰 세계 축제. 행사 동안 관광 3배, 끝나면 지지도 +10(사흘)·모든 나라 호감 +5. 전쟁 중엔 못 열어요.', needs: { stadium: 5, park: 3 }, money: 15000, hours: 48, coolHours: 14 * 24, boost: 2, peace: true, reward: { approval: 10, approvalHours: 72, favorAll: 5, points: 800 } },
];
export const cultureEventById = (id: CultureEventId) => CULTURE_EVENTS.find((e) => e.id === id)!;

/* ── 나라별 문화 ── */
/** 나라마다 타고난 문화 힘(AI 나라 문화가 쌓이는 빠르기). 1 = 보통 */
export const CULTURE_BASE: Record<string, number> = {
  us: 1.35, uk: 1.2, jp: 1.2, de: 1.05, kr: 1.15, cn: 1.15, in: 1.05, ru: 0.95, tr: 1.0, il: 0.85, ir: 0.85, ua: 0.8, kp: 0.45,
};
/** 나라별 문화 특기: 이 시설 관광·문화 +30% */
export const CULTURE_SPECIAL: Record<string, { venue: VenueId; text: string }> = {
  us: { venue: 'studio', text: '할리우드 영화' },
  uk: { venue: 'museum', text: '오래된 대영 수집품' },
  jp: { venue: 'studio', text: '애니메이션·게임' },
  de: { venue: 'stage', text: '클래식 음악' },
  kr: { venue: 'stage', text: '한류 음악·공연' },
  cn: { venue: 'heritage', text: '긴 역사의 유적' },
  in: { venue: 'studio', text: '노래하는 영화' },
  ru: { venue: 'stage', text: '발레와 교향곡' },
  tr: { venue: 'heritage', text: '두 대륙의 옛 도시' },
  il: { venue: 'museum', text: '성지 유물' },
  ir: { venue: 'heritage', text: '페르시아 궁전 터' },
  ua: { venue: 'stadium', text: '축구 사랑' },
  kp: { venue: 'stadium', text: '대집단 체조' },
};
export const SPECIAL_BONUS = 0.3;

/* ── 문화 승리(제안 조건) ── */
/** 살아 있는 다른 나라 중 이만큼 이상에서 "문화 우세" */
export const CULTURE_WIN_SHARE = 2 / 3;
/** 5단계 문화 시설이 이만큼 이상 */
export const CULTURE_WIN_TOP = 2;
/** 조건을 지켜야 하는 날 */
export const CULTURE_WIN_DAYS = 7;
/** 문화 교류 협약 */
export const PACT_MAX = 3;
export const PACT_COST = 1000;
export const PACT_MULT = 1.5;
/** 공사 팀 수 */
export const BUILD_TEAMS = 2;
