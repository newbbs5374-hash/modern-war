// 화면에 보여 줄 목록(기획서 v2 초안). 실제 동작은 다음 단계에서 붙인다.
// rank = 열리는 계급 번호(0 소위 … 10 총사령관)

export const STAT_GROUPS = [
  {
    name: '개인',
    note: '장교 때 중요',
    stats: [
      { name: '체력', does: '직접 전투 체력, 행군 속도' },
      { name: '사격', does: '보병·저격 피해, 명중' },
      { name: '은밀', does: '잠입 성공, 기습 보너스' },
    ],
  },
  {
    name: '지휘',
    note: '',
    stats: [
      { name: '통솔', does: '지휘할 수 있는 부대 수, 사기' },
      { name: '전술', does: '지형·진형 보너스, 선공' },
      { name: '포격', does: '포병·미사일 정확도·피해' },
    ],
  },
  {
    name: '운영',
    note: '사령관 때 중요',
    stats: [
      { name: '군수', does: '보급 비용 ↓, 생산 속도 ↑' },
      { name: '정치', does: '지도자 신뢰, 예산 협상, 모병량' },
      { name: '정보', does: '적 전력 보이기, 전쟁 안개 걷기' },
    ],
  },
];

export type Domain = '육' | '공' | '해' | '사이버';

export const UNITS: Array<{ name: string; domain: Domain; role: string; rank: number }> = [
  { name: '보병', domain: '육', role: '점령·도시전, 싸고 많음', rank: 0 },
  { name: '특수부대', domain: '육', role: '잠입·기습·정찰', rank: 0 },
  { name: '기갑병', domain: '육', role: '빠른 보병 수송·돌파', rank: 2 },
  { name: '무인드론', domain: '공', role: '정찰·자폭, 싸고 생산 빠름', rank: 2 },
  { name: '해킹부대', domain: '사이버', role: '통신·방공망·보급 마비', rank: 2 },
  { name: '전차', domain: '육', role: '정면 돌파, 두꺼운 장갑', rank: 3 },
  { name: '포병', domain: '육', role: '멀리서 넓게 때림', rank: 3 },
  { name: '방공부대', domain: '육', role: '하늘 막기', rank: 4 },
  { name: '공격헬기', domain: '공', role: '낮게 날아 전차 사냥', rank: 4 },
  { name: '전투기', domain: '공', role: '하늘 장악', rank: 5 },
  { name: '구축함', domain: '해', role: '호위·대잠·대공', rank: 5 },
  { name: '폭격기', domain: '공', role: '도시·기지 큰 피해', rank: 7 },
  { name: '잠수함', domain: '해', role: '숨어서 기습', rank: 7 },
  { name: '미사일', domain: '공', role: '한 번 쓰고 사라짐, 아주 멀리', rank: 8 },
  { name: '항공모함', domain: '해', role: '바다 위 비행장, 함재기 출격', rank: 9 },
];

export const TRAININGS: Array<{ name: string; frame: string; raises: string; rank: number }> = [
  { name: '잠입', frame: '격자 턴제', raises: '은밀', rank: 0 },
  { name: '체력', frame: '옆보기 실시간', raises: '체력', rank: 0 },
  { name: '전술', frame: '격자 턴제', raises: '전술', rank: 0 },
  { name: '사격', frame: '옆보기 실시간', raises: '사격 · 보병 숙련', rank: 0 },
  { name: '포격', frame: '포물선 대결', raises: '포격', rank: 1 },
  { name: '정보', frame: '퍼즐·카드', raises: '정보', rank: 1 },
  { name: '통솔', frame: '옆보기 실시간', raises: '통솔', rank: 2 },
  { name: '보급', frame: '퍼즐·카드', raises: '군수', rank: 2 },
  { name: '해킹', frame: '퍼즐·카드', raises: '정보 · 해킹부대 숙련', rank: 2 },
  { name: '모병', frame: '퍼즐·카드', raises: '정치 · 병력', rank: 3 },
  { name: '항공', frame: '위에서 본 슈팅', raises: '항공 병과 숙련', rank: 4 },
  { name: '해상', frame: '격자 턴제', raises: '해군 병과 숙련', rank: 5 },
];

/** 재화(기획서 "재화" 표). 지금 실제로 쌓이는 것은 봉급뿐 */
export const CURRENCIES = [
  { id: 'salary', name: '봉급', icon: '💵', where: '계급마다 시간당 · 홈에서 받기' },
  { id: 'merit', name: '공훈', icon: '🎖️', where: '전투 승리 · 어려운 작전 (다음 단계)' },
  { id: 'drill', name: '훈련 일정', icon: '📅', where: '매일 채워짐 (다음 단계)' },
  { id: 'ruby', name: '루비', icon: '💎', where: '시간 줄이기 (나중에 정함)' },
] as const;
