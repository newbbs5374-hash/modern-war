// 정부 부처 15곳(11-24: 9곳 + 통일·법무·교육·국토교통·해양수산·고용노동) · 인물 특화·성향·숨은 특성·파벌·등급(11-23 대장 결정). 계산은 src/game/cabinet.ts
import type { StatId } from './officers';
import type { AnyStat } from './stats2';

export type MinistryId =
  | 'mnd' | 'nis' | 'mofa' | 'mof' | 'moti' | 'mois' | 'mohw' | 'msit' | 'kocis' | 'mou' | 'moj' | 'moe' | 'molit' | 'mofs' | 'moel'
  // 11-24 대장 요청 5번: 새 부 6 + 처 3
  | 'mafra' | 'mcee' | 'mss' | 'mpva' | 'mogef' | 'mcst' | 'mpm' | 'moleg' | 'mfds';

/** 업무 결과를 자료로 적은 것(새 부처 업무는 이걸로 계산: game/cabinetOps finishTask) */
export interface TaskFx {
  /** [버프 종류, 값(장관 힘 1 기준), 시간] */
  buff?: Array<['build' | 'res' | 'secScore' | 'diploScore' | 'econScore' | 'socScore' | 'counter', number, number]>;
  /** [지지도, 시간] */
  pres?: [number, number];
  trust?: number;
  /** 모든 내 도시 민심 + */
  cityLoyal?: number;
  intel?: number;
  fame?: number;
  /** 금고 + (몇 시간치 수입) */
  treasuryH?: number;
  /** 부족한 기본 자원 [가짓수, 양] */
  stockLow?: [number, number];
  /** 연구 두 줄에 몇 시간치 */
  research?: number;
  /** 내 사람 충성 + */
  cabLoyal?: number;
}
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
  /** 중요한 스탯 2개(보조·성향·출신은 data/needs.ts) */
  stats: AnyStat[];
  spec: SpecId[];
  /** 장관 효과 설명(p = 장관 힘, 0~약 1.5) */
  effText: string;
  tasks: Array<{ id: string; icon: string; name: string; hours: number; text: string; fx?: TaskFx }>;
  /** 부·처 구분(보여 주기용, 없으면 부) */
  kind?: '부' | '처';
}

export const MINISTRIES: Ministry[] = [
  {
    id: 'mnd', icon: '🛡️', name: '국방부', short: '국방', tab: 'defense', role: '군대 살림과 모집',
    text: '군대에 필요한 사람·장비·예산을 챙기는 부처예요. 부대를 얼마나 빨리 모으고, 병력을 얼마나 오래 지키는지가 국방부 손에 달려 있어요.',
    stats: ['통솔', '지휘'], spec: ['육군통', '해군통', '공군통', '군수통'], effText: '모든 부대 모집 속도 · 징병',
    tasks: [
      { id: 'reform', icon: '🔧', name: '국방 개혁', hours: 6, text: '하루 동안 모든 모집 +20%(장관 힘만큼 더)' },
      { id: 'drill', icon: '🎖️', name: '합동 훈련', hours: 4, text: '안보 점수 +8(12시간) · 병력 조금 +' },
    ],
  },
  {
    id: 'nis', icon: '🕵️', name: '국가정보원', short: '정보', tab: 'defense', role: '첩보와 방첩',
    text: '다른 나라의 비밀을 캐고, 우리 나라에 들어온 공작원을 잡는 곳이에요. 인물 신원 조회도 여기서 해요.',
    stats: ['정보', '정치'], spec: ['정보통'], effText: '첩보 성공률 · 임무 성공률',
    tasks: [
      { id: 'counter', icon: '🧲', name: '방첩 작전', hours: 6, text: '정보 점수 + · 하루 동안 정적 방해 공작을 막음' },
      { id: 'vet', icon: '🗂️', name: '인재 신원 조회', hours: 3, text: '인재 명단의 숨은 특성을 모두 알아냄' },
    ],
  },
  {
    id: 'mofa', icon: '🌐', name: '외교부', short: '외교', tab: 'diplo', role: '다른 나라와 관계',
    text: '다른 나라와 대화하고 협정을 지키는 부처예요. 호감이 오르는 속도와 정상회담 성공이 외교부에 달려 있어요.',
    stats: ['외교', '언변'], spec: ['외교통'], effText: '모든 나라 호감',
    tasks: [
      { id: 'envoy', icon: '✈️', name: '특사 파견', hours: 6, text: '가장 긴장된 나라 호감 +10(장관 힘만큼 더)' },
      { id: 'summit', icon: '🤝', name: '정상회담 준비', hours: 4, text: '하루 동안 외교 위상 +8 · 친서 성공 +' },
    ],
  },
  {
    id: 'mof', icon: '💼', name: '기획재정부', short: '재정', tab: 'economy', role: '나라 돈과 세금',
    text: '나라 살림을 짜고 세금을 걷는 부처예요. 장관이 유능하면 같은 세금으로도 수입이 늘고 국민 불만은 줄어요.',
    stats: ['경제', '행정'], spec: ['경제통'], effText: '국방예산 수입 · 세금 불만 줄이기',
    tasks: [
      { id: 'stimulus', icon: '📈', name: '경기 부양', hours: 6, text: '12시간 동안 경제 지수 +10 · 지지도 +3' },
      { id: 'bond', icon: '🏦', name: '국채 발행', hours: 2, text: '금고 +6시간치 수입(대신 하루 동안 경제 지수 −5)' },
    ],
  },
  {
    id: 'moti', icon: '🏭', name: '산업자원부', short: '산업', tab: 'economy', role: '공장과 자원',
    text: '공장을 돌리고 광산·자원을 관리하는 부처예요. 장관이 자원 생산과 가공을 키워요.',
    stats: ['경제', '과학'], spec: ['경제통', '과학자', '군수통'], effText: '모든 자원 생산',
    tasks: [
      { id: 'survey', icon: '⛏️', name: '자원 탐사', hours: 6, text: '부족한 기본 자원 3가지를 넉넉히 얻음' },
      { id: 'overtime', icon: '⚙️', name: '공장 특근', hours: 4, text: '하루 동안 자원 +15%(대신 사회 안정 −3)' },
    ],
  },
  {
    id: 'mois', icon: '🏛️', name: '행정안전부', short: '행정', tab: 'society', role: '도시·치안·재난',
    text: '도시 행정과 치안, 재난 대응을 맡는 부처예요. 점령지를 조용히 하고 도시 민심을 받쳐 줘요.',
    stats: ['행정', '통솔'], spec: ['행정통'], effText: '모든 도시 민심',
    tasks: [
      { id: 'disaster', icon: '🚒', name: '재난 대비', hours: 6, text: '모든 도시 민심 +5 · 하루 동안 사회 안정 +5' },
      { id: 'police', icon: '🚓', name: '치안 강화', hours: 4, text: '점령지 민심 +10' },
    ],
  },
  {
    id: 'mohw', icon: '🏥', name: '보건복지부', short: '복지', tab: 'society', role: '국민 생활과 병원',
    text: '병원과 복지를 맡는 부처예요. 민심과 인구 성장을 돕고, 다친 병사가 빨리 돌아오게 해요.',
    stats: ['행정', '매력'], spec: ['복지통'], effText: '인구 성장 · 민심',
    tasks: [
      { id: 'welfare', icon: '🍲', name: '복지 정책', hours: 6, text: '민심이 가장 낮은 도시 민심 +12' },
      { id: 'vaccine', icon: '💉', name: '예방 접종', hours: 4, text: '하루 동안 지지도 +4' },
    ],
  },
  {
    id: 'msit', icon: '🔬', name: '과학기술부', short: '과학', tab: 'society', role: '연구',
    text: '군사·사회 연구를 이끄는 부처예요. 장관이 똑똑할수록 연구가 빨라져요.',
    stats: ['과학', '행정'], spec: ['과학자'], effText: '연구 속도(군사·사회 둘 다)',
    tasks: [
      { id: 'focus', icon: '🧪', name: '연구 집중', hours: 6, text: '지금 연구 두 줄에 3시간치 점수(장관 힘만큼 더)' },
      { id: 'expo', icon: '🚀', name: '과학 박람회', hours: 4, text: '하루 동안 지지도 +3 · 명성 +' },
    ],
  },
  {
    id: 'kocis', icon: '📺', name: '문화홍보처', short: '홍보', tab: 'society', role: '언론과 홍보',
    text: '정부 소식을 국민에게 알리고 언론을 상대하는 곳이에요. 지지도가 쉽게 떨어지지 않게 받쳐 줘요.',
    stats: ['언변', '매력'], spec: ['홍보통'], effText: '지지도 덤 · 연설 효과',
    tasks: [
      { id: 'campaign', icon: '📣', name: '홍보 캠페인', hours: 6, text: '12시간 동안 지지도 +5(장관 힘만큼 더)' },
      { id: 'brief', icon: '🎙️', name: '정례 브리핑', hours: 3, text: '신뢰도 +3' },
    ],
  },
  // ── 11-24 대장 요청: 대통령이 장관을 임명하는 실제 부처 더하기 ──
  {
    id: 'mou', icon: '🕊️', name: '통일부', short: '통일', tab: 'diplo', role: '남북 관계·평화',
    text: '갈라진 이웃과 대화하고 평화를 준비하는 부처예요. 장관이 유능하면 사이 나쁜 나라와도 말이 통하고 외교 위상이 올라요.',
    stats: ['외교', '정치'], spec: ['외교통'], effText: '모든 나라 호감 · 외교 점수',
    tasks: [
      { id: 'talks', icon: '🤝', name: '고위급 회담', hours: 6, text: '가장 사이 나쁜 나라 호감 +12(장관 힘만큼 더)' },
      { id: 'family', icon: '👪', name: '이산가족 상봉', hours: 4, text: '하루 동안 지지도 +4 · 외교 위상 +4' },
    ],
  },
  {
    id: 'moj', icon: '⚖️', name: '법무부', short: '법무', tab: 'society', role: '법질서·검찰·출입국',
    text: '법을 지키게 하고 검찰과 교정·출입국을 맡는 부처예요. 의회와 국민이 정부를 믿게 받쳐 줘요.',
    stats: ['법률', '청렴'], spec: ['행정통', '정보통'], effText: '신뢰도 · 정적 견제',
    tasks: [
      { id: 'probe', icon: '🔍', name: '부패 수사', hours: 6, text: '하루 동안 정적 방해 공작을 막음 · 신뢰도 +2' },
      { id: 'amnesty', icon: '🕊️', name: '특별 사면', hours: 3, text: '12시간 동안 지지도 +4(대신 신뢰도 −1)' },
    ],
  },
  {
    id: 'moe', icon: '🎓', name: '교육부', short: '교육', tab: 'society', role: '학교·대학·인재 기르기',
    text: '학교와 대학을 맡아 나라의 인재를 길러요. 연구가 빨라지고 사람이 늘어요.',
    stats: ['행정', '과학'], spec: ['과학자', '복지통'], effText: '연구 속도 · 인구 성장',
    tasks: [
      { id: 'scholar', icon: '📚', name: '국비 장학생', hours: 6, text: '인재 명단에 🔵우수 후보 2명' },
      { id: 'reform', icon: '🏫', name: '교육 개혁', hours: 4, text: '하루 동안 사회 안정 +6' },
    ],
  },
  {
    id: 'molit', icon: '🛣️', name: '국토교통부', short: '국토', tab: 'economy', role: '도로·철도·주택·도시',
    text: '길과 철도, 집과 도시를 짓는 부처예요. 부대가 빨리 움직이고 자원이 잘 돌아요.',
    stats: ['행정', '경제'], spec: ['행정통', '경제통'], effText: '부대 모집 속도 · 자원 생산',
    tasks: [
      { id: 'soc', icon: '🚄', name: 'SOC 투자', hours: 6, text: '12시간 동안 경제 지수 +8 · 모집 +10%' },
      { id: 'housing', icon: '🏘️', name: '주택 공급', hours: 4, text: '모든 도시 민심 +4' },
    ],
  },
  {
    id: 'mofs', icon: '⚓', name: '해양수산부', short: '해양', tab: 'economy', role: '바다·항만·수산',
    text: '바다와 항만, 고기잡이를 맡는 부처예요. 바닷길 자원과 항구가 튼튼해져요.',
    stats: ['경제', '군수'], spec: ['해군통', '경제통'], effText: '자원 생산 · 호감 조금',
    tasks: [
      { id: 'port', icon: '🚢', name: '항만 정비', hours: 6, text: '하루 동안 자원 +12%' },
      { id: 'fish', icon: '🐟', name: '수산물 비축', hours: 3, text: '부족한 기본 자원 2가지를 얻음' },
    ],
  },
  {
    id: 'moel', icon: '👷', name: '고용노동부', short: '노동', tab: 'economy', role: '일자리·노사',
    text: '일자리를 만들고 노동자와 회사 사이를 조율하는 부처예요. 세금 불만이 줄고 공장이 멈추지 않아요.',
    stats: ['경제', '언변'], spec: ['복지통', '경제통'], effText: '세금 불만 줄이기 · 경제 점수',
    tasks: [
      { id: 'jobs', icon: '💼', name: '일자리 정책', hours: 6, text: '12시간 동안 경제 지수 +6 · 지지도 +3' },
      { id: 'deal', icon: '🤝', name: '노사 대타협', hours: 4, text: '하루 동안 사회 안정 +5 · 자원 +5%' },
    ],
  },
  // ── 11-24 대장 요청 5번: 새 부 6곳 ──
  {
    id: 'mafra', icon: '🌾', name: '농림축산식품부', short: '농식품', tab: 'economy', role: '농업·먹거리·농촌',
    text: '쌀과 고기, 먹거리와 농촌을 챙기는 부처예요. 식량이 넉넉하면 도시 민심이 안정돼요. 산림청·농촌진흥청이 딸려 있어요.',
    stats: ['경제', '행정'], spec: ['경제통', '복지통'], effText: '도시 민심 · 자원 조금',
    tasks: [
      { id: 'harvest', icon: '🌾', name: '풍년 지원', hours: 6, text: '부족한 기본 자원 2가지 +15 · 모든 도시 민심 +2', fx: { stockLow: [2, 15], cityLoyal: 2 } },
      { id: 'local', icon: '🧺', name: '로컬푸드 장터', hours: 3, text: '12시간 동안 지지도 +3', fx: { pres: [3, 12] } },
    ],
  },
  {
    id: 'mcee', icon: '🌍', name: '기후에너지환경부', short: '기후', tab: 'economy', role: '에너지·환경·기후',
    text: '발전소와 에너지, 깨끗한 공기와 물을 맡는 부처예요. 에너지가 넉넉하면 공장이 잘 돌아요. 기상청이 딸려 있어요.',
    stats: ['과학', '경제'], spec: ['과학자', '경제통'], effText: '자원 생산 · 사회 점수',
    tasks: [
      { id: 'grid', icon: '⚡', name: '전력망 확충', hours: 6, text: '하루 동안 자원 +10%', fx: { buff: [['res', 0.1, 24]] } },
      { id: 'clean', icon: '🌳', name: '탄소중립 선언', hours: 4, text: '하루 동안 사회 안정 +4 · 명성 +', fx: { buff: [['socScore', 4, 24]], fame: 8 } },
    ],
  },
  {
    id: 'mss', icon: '🚀', name: '중소벤처기업부', short: '중기', tab: 'economy', role: '중소기업·창업·소상공인',
    text: '작은 회사와 새 회사를 키우는 부처예요. 일자리가 늘고 경제가 탄탄해져요.',
    stats: ['경제', '과학'], spec: ['경제통'], effText: '경제 점수 · 국방예산 조금',
    tasks: [
      { id: 'startup', icon: '💡', name: '창업 지원', hours: 6, text: '12시간 동안 경제 지수 +7', fx: { buff: [['econScore', 7, 12]] } },
      { id: 'shop', icon: '🏪', name: '소상공인 지원금', hours: 3, text: '12시간 동안 지지도 +3 · 금고 조금 −', fx: { pres: [3, 12], treasuryH: -1 } },
    ],
  },
  {
    id: 'mpva', icon: '🎗️', name: '국가보훈부', short: '보훈', tab: 'defense', role: '참전 용사·유공자 예우',
    text: '나라를 위해 싸운 사람과 가족을 돌보는 부처예요. 군의 사기가 오르고 병력이 오래 버텨요.',
    stats: ['행정', '청렴'], spec: ['복지통', '육군통'], effText: '병력 보충 · 안보 점수',
    tasks: [
      { id: 'honor', icon: '🎖️', name: '호국 영웅 예우', hours: 6, text: '12시간 동안 안보 +6 · 지지도 +2', fx: { buff: [['secScore', 6, 12]], pres: [2, 12] } },
      { id: 'vet', icon: '🏥', name: '보훈 병원 지원', hours: 4, text: '내 사람 충성 +3 · 신뢰도 +1', fx: { cabLoyal: 3, trust: 1 } },
    ],
  },
  {
    id: 'mogef', icon: '👨‍👩‍👧', name: '성평등가족부', short: '가족', tab: 'society', role: '가족·청소년·성평등',
    text: '가족과 아이, 청소년을 돌보고 차별을 줄이는 부처예요. 인구가 늘고 사회가 안정돼요.',
    stats: ['행정', '매력'], spec: ['복지통'], effText: '인구 성장 · 사회 점수',
    tasks: [
      { id: 'care', icon: '🍼', name: '돌봄 확대', hours: 6, text: '하루 동안 사회 안정 +5', fx: { buff: [['socScore', 5, 24]] } },
      { id: 'youth', icon: '🧒', name: '청소년 캠프', hours: 3, text: '12시간 동안 지지도 +3', fx: { pres: [3, 12] } },
    ],
  },
  {
    id: 'mcst', icon: '🎭', name: '문화체육관광부', short: '문체', tab: 'society', role: '문화·체육·관광',
    text: '문화와 스포츠, 관광을 키우는 부처예요. 나라 매력이 커지고 국민이 즐거워요. 국가유산청이 딸려 있어요.',
    stats: ['매력', '언변'], spec: ['홍보통'], effText: '지지도 · 모든 나라 호감 조금',
    tasks: [
      { id: 'festival', icon: '🎆', name: '국가 축제', hours: 6, text: '하루 동안 지지도 +4 · 명성 +', fx: { pres: [4, 24], fame: 10 } },
      { id: 'tour', icon: '🧳', name: '관광 홍보', hours: 4, text: '하루 동안 외교 위상 +4 · 금고 +2시간치', fx: { buff: [['diploScore', 4, 24]], treasuryH: 2 } },
    ],
  },
  // ── 새 처 3곳(국무총리 소속) ──
  {
    id: 'mpm', icon: '🗂️', name: '인사혁신처', short: '인사처', tab: 'society', kind: '처', role: '공무원 뽑기·기르기',
    text: '공무원을 뽑고 기르는 곳이에요. 좋은 사람이 정부에 들어오고 부처 일이 빨라져요.',
    stats: ['행정', '청렴'], spec: ['행정통'], effText: '부처 업무 시간 · 영입비',
    tasks: [
      { id: 'exam', icon: '📝', name: '특별 채용', hours: 6, text: '인재 명단에 후보 1명(우수)', fx: {} },
      { id: 'train', icon: '🏫', name: '공무원 연수', hours: 4, text: '내 사람 충성 +2', fx: { cabLoyal: 2 } },
    ],
  },
  {
    id: 'moleg', icon: '📜', name: '법제처', short: '법제처', tab: 'society', kind: '처', role: '법 다듬기',
    text: '새 법과 규칙을 다듬어 서로 어긋나지 않게 하는 곳이에요. 의회가 정부를 더 믿어요.',
    stats: ['법률', '행정'], spec: ['행정통'], effText: '신뢰도',
    tasks: [
      { id: 'clean', icon: '✂️', name: '규제 정리', hours: 6, text: '12시간 동안 경제 지수 +5 · 신뢰도 +1', fx: { buff: [['econScore', 5, 12]], trust: 1 } },
      { id: 'easy', icon: '📖', name: '쉬운 법령 만들기', hours: 3, text: '신뢰도 +2', fx: { trust: 2 } },
    ],
  },
  {
    id: 'mfds', icon: '💊', name: '식품의약품안전처', short: '식약처', tab: 'society', kind: '처', role: '먹거리·약 안전',
    text: '먹거리와 약이 안전한지 살피는 곳이에요. 큰 사고가 줄고 국민이 안심해요.',
    stats: ['과학', '청렴'], spec: ['과학자', '복지통'], effText: '사회 점수 · 인구 성장',
    tasks: [
      { id: 'inspect', icon: '🔬', name: '안전 일제 점검', hours: 6, text: '하루 동안 사회 안정 +4 · 신뢰도 +1', fx: { buff: [['socScore', 4, 24]], trust: 1 } },
      { id: 'fast', icon: '💉', name: '신약 빠른 심사', hours: 4, text: '연구 두 줄에 2시간치 점수', fx: { research: 2 } },
    ],
  },
];
export const ministryById = (id: MinistryId) => MINISTRIES.find((m) => m.id === id)!;
/** 장관 자리 수: 등급이 오를수록(처음 3석 → 전설의 지도자 15석). 11-24 부처 15곳 */
export const ministerSlots = (rank: number) => Math.min(24, 3 + Math.floor(rank * 1.2));

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

export type Trait = '청렴' | '야심' | '충직' | '인기인' | '강경파' | '원칙주의' | '실용주의' | '신중파' | '협상가' | '혁신가' | '현장형' | '냉철';
export const TRAITS: Record<Trait, { icon: string; text: string }> = {
  청렴: { icon: '🤍', text: '스캔들이 없고 청문회에 유리 · 회유·빼 가기에 안 넘어감' },
  야심: { icon: '🔥', text: '능력 +15% · 대신 충성이 잘 떨어짐' },
  충직: { icon: '🫡', text: '충성이 잘 떨어지지 않음' },
  인기인: { icon: '🌟', text: '자리에 앉으면 지지도 +1' },
  강경파: { icon: '⚔️', text: '안보 +2 · 외교 위상 −2(자리에 있을 때)' },
  원칙주의: { icon: '📏', text: '청문회에 조금 유리 · 법안 반대 줄임' },
  실용주의: { icon: '🧰', text: '부처 업무 시간 −20%' },
  신중파: { icon: '🧐', text: '부처 업무 결과 +10%' },
  협상가: { icon: '🤝', text: '외교·통일·노동처럼 말로 푸는 자리에서 능력 +10%' },
  혁신가: { icon: '💡', text: '과학·산업·교육 자리에서 능력 +10%' },
  현장형: { icon: '🥾', text: '국방·행정·복지처럼 발로 뛰는 자리에서 능력 +10%' },
  냉철: { icon: '🧊', text: '정보·안보·수사 자리에서 능력 +10%' },
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
export type Group = '인재' | '내각' | '군' | '정계' | '재계' | '언론' | '시민' | '외국' | '관료' | '공공';
export const GROUP_ICON: Record<Group, string> = { 인재: '📋', 내각: '🏛️', 군: '⭐', 정계: '🗳️', 재계: '🏢', 언론: '📺', 시민: '✊', 외국: '🌐', 관료: '🗂️', 공공: '🏭' };
