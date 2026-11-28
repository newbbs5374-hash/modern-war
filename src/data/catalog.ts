// 화면에 보여 줄 목록(기획서 v2 초안). 실제 동작은 다음 단계에서 붙인다.
// rank = 열리는 계급 번호(0 소위 … 10 지도자)

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
  // 새 병과 10개(11-26)
  { name: '상륙장갑차', domain: '육', role: '바다를 헤엄쳐 건너 땅에 바로 올라감', rank: 3 },
  { name: '다연장로켓', domain: '육', role: '로켓 12발을 한꺼번에 넓게 뿌림', rank: 4 },
  { name: '해안 미사일', domain: '육', role: '바닷가에서 적 군함을 멀리서 잡음', rank: 5 },
  { name: '장거리 방공', domain: '육', role: '멀리서 오는 미사일·폭격기를 떨어뜨림', rank: 6 },
  { name: '탄도미사일', domain: '육', role: '아주 멀리 쏘는 큰 미사일, 요격당할 수 있음', rank: 8 },
  // 11-28 새 병과
  { name: '공병', domain: '육', role: '지뢰를 묻고 둘레 아군을 엄폐시킴, 지휘소 벽을 뚫음', rank: 3 },
  { name: '극초음속 미사일', domain: '육', role: '아주 빨라서 방공이 거의 못 막음', rank: 9 },
  { name: '정찰 무인기', domain: '공', role: '숨은 적을 찾아 포격이 더 잘 맞게 함', rank: 2 },
  { name: '조기경보기', domain: '공', role: '하늘의 눈, 둘레 공군 사거리·요격 ↑', rank: 6 },
  { name: '대잠 초계기', domain: '공', role: '소노부이로 숨은 잠수함을 찾고 어뢰로 잡음', rank: 5 },
  { name: '전자전기', domain: '공', role: '둘레 적 미사일·포 명중 −30%, 적 방공 사거리 ↓', rank: 6 },
  { name: '군집 드론', domain: '공', role: '작은 드론 떼가 한꺼번에 덮침, 한 발씩 쏘는 방공으로는 다 못 막음', rank: 7 },
  { name: '공중급유기', domain: '공', role: '둘레 아군 공군 공격 속도 +15%', rank: 5 },
  { name: '대드론 레이저 차량', domain: '육', role: '드론·미사일을 레이저로 지짐(3배), 땅 부대엔 못 쏨', rank: 6 },
  { name: '무인 전투 로봇', domain: '육', role: '적이 먼저 노리는 단단한 미끼, 병력이 안 듦', rank: 6 },
  { name: '해병대', domain: '육', role: '바다에서 바로 상륙, 해안에서 공격 +30%', rank: 4 },
  { name: '기뢰 부설함', domain: '해', role: '바다 길목에 기뢰를 깔아 적 배·잠수함을 막음', rank: 3 },
  { name: '지상 공격기', domain: '공', role: '하늘에서 맴돌며 땅을 계속 때림', rank: 6 },
  { name: '스텔스 전투기', domain: '공', role: '레이더에 잘 안 잡힘, 들키기 전엔 먼저 때림', rank: 8 },
  { name: '바다 드론', domain: '해', role: '싸고 빠른 자폭 보트, 큰 배 사냥', rank: 3 },
  // 독점 병과(몇 나라만, data/specials.ts EXCLUSIVES)
  { name: '강습상륙함', domain: '해', role: '보병을 싣고 섬에 바로 상륙, 바다 위 보급 기지', rank: 6 },
  { name: '원자력 잠수함', domain: '해', role: '우라늄 원자로라 멀리 가도 지치지 않음, 더 깊이 숨음', rank: 8 },
  { name: '레이저 방공함', domain: '해', role: '레이저 방공망으로 둘레 2칸 우리 편 피해 −30%', rank: 8 },
];

export const TRAININGS: Array<{ name: string; frame: string; raises: string; rank: number }> = [
  { name: '잠입', frame: '미니게임', raises: '은밀', rank: 0 },
  { name: '체력', frame: '미니게임', raises: '체력', rank: 0 },
  { name: '전술', frame: '미니게임', raises: '전술', rank: 0 },
  { name: '사격', frame: '미니게임', raises: '사격 · 보병 숙련', rank: 0 },
  { name: '포격', frame: '미니게임', raises: '포격', rank: 1 },
  { name: '정보', frame: '미니게임', raises: '정보', rank: 1 },
  { name: '통솔', frame: '미니게임', raises: '통솔', rank: 2 },
  { name: '보급', frame: '미니게임', raises: '군수', rank: 2 },
  { name: '해킹', frame: '미니게임', raises: '정보 · 해킹부대 숙련', rank: 2 },
  { name: '모병', frame: '미니게임', raises: '정치 · 병력', rank: 3 },
  { name: '항공', frame: '미니게임', raises: '항공 병과 숙련', rank: 4 },
  { name: '해상', frame: '미니게임', raises: '해군 병과 숙련', rank: 5 },
];

/** 재화(기획서 "재화" 표). 지금 실제로 쌓이는 것은 봉급뿐 */
export const CURRENCIES = [
  { id: 'salary', name: '봉급', icon: '💵', where: '호칭 단계마다 시간당 · 본부에서 받기' },
  { id: 'merit', name: '공훈', icon: '🎖️', where: '임무 성공(기록용)' },
  { id: 'drill', name: '훈련 일정', icon: '📅', where: '실제 4시간마다 1개 · 최대 6개' },
  { id: 'boost', name: '가속권', icon: '🎫', where: '임무·심부름·생산 시간 30분 줄이기 · 시험판은 넉넉히 줌' },
  { id: 'ruby', name: '루비', icon: '💎', where: '매일 할 일·업적으로 얻고 상점에서 가속권·자원으로 바꿈' },
] as const;

/** 부대 화면 분류: 1차 육·해·공 → 2차 세부(병과 15개 + 독점 병과 3개). 특화 유닛은 바탕 병과 밑에 붙음 */
export const FORCE_BRANCHES: Array<{ id: '육' | '해' | '공'; name: string; icon: string; groups: Array<{ name: string; icon: string; units: string[] }> }> = [
  {
    id: '육',
    name: '육군',
    icon: '🪖',
    groups: [
      { name: '보병', icon: '🪖', units: ['보병', '기갑병', '상륙장갑차', '공병', '해병대', '무인 전투 로봇'] },
      { name: '특수전', icon: '🥷', units: ['특수부대', '해킹부대'] },
      { name: '기갑·화력', icon: '🛡️', units: ['전차', '포병', '방공부대'] },
      { name: '미사일·방공', icon: '🚀', units: ['다연장로켓', '탄도미사일', '극초음속 미사일', '해안 미사일', '장거리 방공', '대드론 레이저 차량'] },
    ],
  },
  {
    id: '해',
    name: '해군',
    icon: '⚓',
    groups: [
      { name: '수상함', icon: '🚢', units: ['구축함', '항공모함'] },
      { name: '잠수함', icon: '🫧', units: ['잠수함'] },
      { name: '무인정', icon: '🚤', units: ['바다 드론'] },
      { name: '독점 병과', icon: '👑', units: ['강습상륙함', '원자력 잠수함', '레이저 방공함'] },
    ],
  },
  {
    id: '공',
    name: '공군',
    icon: '✈️',
    groups: [
      { name: '무인기', icon: '🛸', units: ['무인드론', '정찰 무인기'] },
      { name: '항공기', icon: '✈️', units: ['공격헬기', '전투기', '폭격기'] },
      { name: '첨단 항공기', icon: '🛩️', units: ['스텔스 전투기', '조기경보기', '대잠 초계기', '전자전기', '공중급유기', '지상 공격기', '군집 드론'] },
      { name: '미사일', icon: '🚀', units: ['미사일'] },
    ],
  },
];

/**
 * 11-28 훈련 11병과(대장 결정): 육군 4 · 해군 3 · 공군 4.
 * 훈련(스탯 오름·숙련·별 기록)은 그대로 12개이고, 화면에서 병과별로 묶어 보여 줌.
 * 항공·해상처럼 여러 병과에 걸친 훈련은 그 병과에 맞는 미니게임만 고를 수 있게 only로 거름.
 * 훈련이 없는 병과(미사일방공·무인정·미사일)는 새 훈련 게임이 들어올 자리.
 */
export const TRAIN_BRANCHES: Array<{ arm: '육' | '해' | '공'; name: string; icon: string; items: Array<{ t: string; only?: string[] }>; soon?: string }> = [
  { arm: '육', name: '보병', icon: '🪖', items: [{ t: '사격' }, { t: '체력' }, { t: '모병' }] },
  { arm: '육', name: '특수전', icon: '🥷', items: [{ t: '잠입' }, { t: '정보' }, { t: '해킹' }] },
  { arm: '육', name: '기갑화력', icon: '🛡️', items: [{ t: '포격' }, { t: '전술' }, { t: '통솔' }, { t: '보급' }] },
  { arm: '육', name: '미사일방공', icon: '🚀', items: [], soon: '하늘의 방패(요격)' },
  { arm: '해', name: '수상함', icon: '🚢', items: [{ t: '해상', only: ['sea-formation', 'n-sea-bridge', 'e-sea-3', 'e-sea-4', 'e-sea-5', 'e-sea-6', 'e-sea-7'] }], soon: '함대 포돌전' },
  { arm: '해', name: '잠수함', icon: '🫧', items: [{ t: '해상', only: ['sea-sonar', 'sea-torpedo', 'm3-sea-sonar', 'm3-sea-torpedo', 'e-sea-1', 'e-sea-2'] }], soon: '어둠 속 사냥' },
  { arm: '해', name: '무인정', icon: '🚤', items: [], soon: '자폭 보트 돌격' },
  { arm: '공', name: '무인기', icon: '🛸', items: [{ t: '정보', only: ['e-intel-4'] }, { t: '해킹', only: ['e-hack-6'] }], soon: '부품 짝 맞추기·위성 사진 맞추기' },
  { arm: '공', name: '항공기', icon: '✈️', items: [{ t: '항공', only: ['air-intercept', 'air-landing', 'm3-air-intercept', 'n-air-cockpit', 'e-air-1', 'e-air-2', 'e-air-4', 'e-air-5', 'e-air-6'] }], soon: '폭격 투하' },
  { arm: '공', name: '첨단항공기', icon: '🛩️', items: [{ t: '항공', only: ['air-flare', 'm3-air-flare', 'e-air-3', 'e-air-7'] }], soon: '스텔스 침투' },
  { arm: '공', name: '미사일', icon: '🎯', items: [], soon: '탄도 사격' },
];
export const TRAIN_ARMS = [
  { id: '육', name: '육군', icon: '🪖' },
  { id: '해', name: '해군', icon: '⚓' },
  { id: '공', name: '공군', icon: '✈️' },
] as const;
