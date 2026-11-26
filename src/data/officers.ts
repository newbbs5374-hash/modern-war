// 3단계: 장교·부관·장군·라이벌 데이터(초안 숫자). 이름은 모두 가상.

export type StatId = '체력' | '사격' | '은밀' | '통솔' | '전술' | '포격' | '군수' | '정치' | '정보';
export const STAT_IDS: StatId[] = ['체력', '사격', '은밀', '통솔', '전술', '포격', '군수', '정치', '정보'];

/** 스탯 상한: 계급마다 오름 */
export const statCap = (rank: number) => 20 + rank * 10;
/** 스탯 1 올리는 데 드는 경험치(스탯이 높을수록 조금씩 더 듦) */
export const statExpNeed = (value: number) => 20 + Math.floor(value);
/** 훈련 경험치: 별 1개당 · 져도 받는 것 */
export const TRAIN_EXP_PER_STAR = 40; // 11-26 난이도: 얻는 경험치 늘림(30 → 40)
export const TRAIN_EXP_LOSE = 12;
/** 임무 경험치: 성공 · 실패 */
export const MISSION_EXP_WIN = 30; // 11-26: 20 → 30
export const MISSION_EXP_LOSE = 8;
export const START_STAT = 8;

/** 승급 조건(지금 계급 → 다음 계급). 마지막(지도자)은 없음 */
export interface PromotionRule {
  merit: number;
  stars: number;
  /** 의회 신뢰도 최소(장군급부터) */
  trust: number;
  /** 승급 심사 작전 이름 */
  exam: string;
}
export const PROMOTION: PromotionRule[] = [
  { merit: 480, stars: 30, trust: 0, exam: '분대 침투 작전' },
  { merit: 640, stars: 36, trust: 0, exam: '고지 방어전' },
  { merit: 840, stars: 42, trust: 0, exam: '인질 구출 작전' },
  { merit: 1040, stars: 48, trust: 0, exam: '대대 돌파 작전' },
  { merit: 1280, stars: 54, trust: 30, exam: '강 건너기 작전' },
  { merit: 1560, stars: 60, trust: 35, exam: '연대 합동 작전' },
  { merit: 1880, stars: 66, trust: 40, exam: '여단 반격전' },
  { merit: 2240, stars: 72, trust: 45, exam: '사단 포위 작전' },
  { merit: 2640, stars: 78, trust: 50, exam: '군단 상륙 작전' },
  { merit: 3120, stars: 84, trust: 60, exam: '지도자 심의' },
];

/**
 * 임무 종류: 쓰는 스탯, 걸리는 실제 시간(시간), 세계에 주는 영향.
 * 11-24 대장 지시: 지도자 현실에 맞는 임무로 개편(수송·호송 같은 병사 일 없앰).
 * 게시판에는 지도자 임무 8종 + 작전 지휘 + 대전투만 나옴. 옛 5종(방어·기습·정찰·호송·구출)은 옛 저장의 진행 중 임무용으로만 남김.
 */
export type LeaderMissionKind = '안보회의' | '특수작전' | '정보보고' | '전선시찰' | '교민철수' | '군수협상' | '현장방문' | '방산시찰';
export type MissionKind = LeaderMissionKind | '방어' | '기습' | '정찰' | '호송' | '구출' | '작전' | '대전투';
export const MISSION_KINDS: Record<
  MissionKind,
  { stats: StatId[]; hours: number; desc: string; aideFit: string }
> = {
  안보회의: { stats: ['통솔', '정보'], hours: 1.5, desc: '국가안전보장회의를 소집해 가장 약한 우리 도시의 방어 대책을 세움. 성공하면 그 도시 방어도 +25', aideFit: '통신' },
  특수작전: { stats: ['전술', '정보'], hours: 2, desc: '특수부대의 적 도시 타격 작전을 승인하고 상황실에서 지휘. 성공하면 그 도시 방어도 −20', aideFit: '저격' },
  정보보고: { stats: ['정보', '정치'], hours: 1, desc: '정보기관장에게 비공개 보고를 받고 지시. 성공하면 정보 점수 +12', aideFit: '정찰' },
  전선시찰: { stats: ['통솔', '체력'], hours: 2, desc: '전방 부대를 찾아가 장병을 격려. 성공하면 그 도시 방어도 +15 · 병력 +1%', aideFit: '의무' },
  교민철수: { stats: ['정치', '군수'], hours: 1.5, desc: '위험 지역 재외국민 철수 작전을 지시. 성공하면 명성 +8 · 지지도 +2(하루)', aideFit: '의무' },
  군수협상: { stats: ['정치', '군수'], hours: 2, desc: '우방 정상과 통화해 무기·탄약 지원을 얻어 냄. 성공하면 병력 +3%', aideFit: '통신' },
  현장방문: { stats: ['정치', '체력'], hours: 1, desc: '피해 지역·민생 현장을 찾아 국민을 만남. 성공하면 지지도 +4(하루) · 신뢰도 +1', aideFit: '의무' },
  방산시찰: { stats: ['군수', '포격'], hours: 1.5, desc: '방위산업체를 찾아 신무기 시연을 보고 생산을 독려. 성공하면 국방예산 +400', aideFit: '공병' },
  방어: { stats: ['통솔', '전술'], hours: 2, desc: '공격받는 우리 도시를 지켜 방어도를 올림', aideFit: '공병' },
  기습: { stats: ['은밀', '사격'], hours: 1.5, desc: '적 도시를 기습해 방어도를 깎음', aideFit: '저격' },
  정찰: { stats: ['정보', '은밀'], hours: 1, desc: '적 전력을 살핌. 성공하면 정보 점수', aideFit: '정찰' },
  호송: { stats: ['군수', '체력'], hours: 2, desc: '전선 보급을 지킴. 성공하면 우리 나라 병력 보충', aideFit: '통신' },
  구출: { stats: ['체력', '사격'], hours: 1.5, desc: '고립된 아군을 구함. 명성이 크게 오름', aideFit: '의무' },
  작전: { stats: ['전술', '통솔'], hours: 3, desc: '전선 도시 하나를 두고 2~3판을 이어 싸움. 이기면 도시 방어도가 크게 바뀌고, 적 도시는 무너지면 점령', aideFit: '통신' },
  대전투: { stats: ['통솔', '군수'], hours: 4, desc: '적 도시를 차지하는 다섯 판 대전투', aideFit: '공병' },
};
/** 작전은 대위부터, 대전투는 준장부터 */
export const OPERATION_RANK = 2;
export const GRAND_RANK = 6;
export const GRAND_COOLDOWN_HOURS = 12;

export const AIDE_SPECIALTIES = ['저격', '의무', '통신', '공병', '정찰'] as const;
export type AideSpecialty = (typeof AIDE_SPECIALTIES)[number];

/** 부관 칸: 중위 1 · 소령 2 · 대령 3 */
export const aideSlots = (rank: number) => (rank >= 5 ? 3 : rank >= 3 ? 2 : rank >= 1 ? 1 : 0);
/** 장군 칸(11-23): 지도자 등급 5부터 1칸씩, 최대 6칸(병과마다 한 명 + 합참의장) */
export const generalSlots = (rank: number) => Math.max(0, Math.min(6, rank - 4));

export const GENERAL_FIELDS = ['합참', '육군', '해군', '공군', '정보', '군수'] as const;
export const GENERAL_STYLES = ['공격적', '신중함', '기동형'] as const;

/** 가상 이름 묶음(나라 상관없이 쓰는 시험용 이름) */
export const NAME_POOL = [
  '강하린', '윤태오', '박서진', '최도현', '한유나', '정민재', '오세라', '임건우', '신다온', '류지후',
  '배수아', '문하람', '송재민', '황이든', '조은결', '남궁현', '서도윤', '권나래', '백시우', '홍라온',
];
