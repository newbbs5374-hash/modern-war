// 3단계: 장교·부관·장군·라이벌 데이터(초안 숫자). 이름은 모두 가상.

export type StatId = '체력' | '사격' | '은밀' | '통솔' | '전술' | '포격' | '군수' | '정치' | '정보';
export const STAT_IDS: StatId[] = ['체력', '사격', '은밀', '통솔', '전술', '포격', '군수', '정치', '정보'];

/** 스탯 상한: 계급마다 오름 */
export const statCap = (rank: number) => 20 + rank * 10;
/** 스탯 1 올리는 데 드는 경험치(스탯이 높을수록 조금씩 더 듦) */
export const statExpNeed = (value: number) => 20 + Math.floor(value);
/** 훈련 경험치: 별 1개당 · 져도 받는 것 */
export const TRAIN_EXP_PER_STAR = 30;
export const TRAIN_EXP_LOSE = 10;
/** 임무 경험치: 성공 · 실패 */
export const MISSION_EXP_WIN = 20;
export const MISSION_EXP_LOSE = 6;
export const START_STAT = 8;

/** 진급 조건(지금 계급 → 다음 계급). 마지막(총사령관)은 없음 */
export interface PromotionRule {
  merit: number;
  stars: number;
  /** 지도자 신뢰도 최소(장군급부터) */
  trust: number;
  /** 진급 심사 작전 이름 */
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
  { merit: 3120, stars: 84, trust: 60, exam: '총사령관 심의' },
];

/** 임무 종류: 쓰는 스탯, 걸리는 실제 시간(시간), 세계에 주는 영향 */
export type MissionKind = '방어' | '기습' | '정찰' | '호송' | '구출' | '작전' | '대전투';
export const MISSION_KINDS: Record<
  MissionKind,
  { stats: StatId[]; hours: number; desc: string; aideFit: string }
> = {
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
/** 장군 칸: 준장 1 · 소장 2 · 중장 3 · 대장 4 · 총사령관 5 */
export const generalSlots = (rank: number) => Math.max(0, rank - 5);

export const GENERAL_FIELDS = ['육군', '해군', '공군', '정보', '군수'] as const;
export const GENERAL_STYLES = ['공격적', '신중함', '기동형'] as const;

/** 가상 이름 묶음(나라 상관없이 쓰는 시험용 이름) */
export const NAME_POOL = [
  '강하린', '윤태오', '박서진', '최도현', '한유나', '정민재', '오세라', '임건우', '신다온', '류지후',
  '배수아', '문하람', '송재민', '황이든', '조은결', '남궁현', '서도윤', '권나래', '백시우', '홍라온',
];
