// 부처·청 소속 시설 27곳(11-24 대장 요청 5번). 실제 위치를 따라 한국 도시에 둠(다른 나라로 하면 내 도시에 차례로 둠).
// 1~3단계로 키우고, 단계마다 eff 만큼 효과(대통령실 효과와 같은 종류). 계산은 game/govFac.ts
import type { MinistryId } from './cabinet';
import type { PostEff, PostId } from './staff';

export interface GovFacility {
  id: string;
  icon: string;
  name: string;
  /** 주인 부처(장관 자리) 또는 청장 자리 */
  owner: { min: MinistryId } | { post: PostId };
  /** 한국 도시 번호(kr-0 서울 … kr-10 익산) */
  city: number;
  text: string;
  /** 1단계마다 효과 */
  eff: Partial<Record<PostEff, number>>;
  /** 이 국가 사업을 끝내면 1단계 덤 */
  project?: string;
}

const F = (id: string, icon: string, name: string, owner: GovFacility['owner'], city: number, text: string, eff: GovFacility['eff'], project?: string): GovFacility => ({ id, icon, name, owner, city, text, eff, project });

/** 11-25 대장 요청: 1~3단계 → 1~5단계로 규모를 키움 */
export const GOV_FAC_MAX = 5;
/** 단계마다 규모 이름 */
export const GOV_FAC_SCALE = ['빈 터', '작은 사무소', '지역 센터', '국가 센터', '광역 본부', '세계 거점'] as const;
export const GOV_FACILITIES: GovFacility[] = [
  // 새 부 6
  F('foodcluster', '🥫', '국가식품클러스터', { min: 'mafra' }, 10, '익산에 있는 식품 기업 단지. 먹거리 산업이 커져요.', { growth: 0.01, loyalty: 0.4 }),
  F('energyhub', '⚡', '탄소중립 에너지 단지', { min: 'mcee' }, 8, '여수 산단 옆 수소·태양광 단지.', { econ: 0.6 }),
  F('startup', '💡', '창업 허브', { min: 'mss' }, 0, '서울의 새 회사 둥지.', { econ: 0.5, recruit: 0.01 }),
  F('cemetery', '🎖️', '국립대전현충원', { min: 'mpva' }, 4, '나라를 지킨 사람들이 잠든 곳.', { sec: 0.5, cabLoyal: 0.3 }),
  F('family', '👨‍👩‍👧', '가족 돌봄 센터', { min: 'mogef' }, 2, '아이와 가족을 함께 돌보는 큰 센터.', { growth: 0.01, soc: 0.3 }),
  F('museum', '🏛️', '국립중앙박물관', { min: 'mcst' }, 0, '나라의 보물을 모은 박물관.', { approval: 0.3, favor: 0.3 }),
  // 처 3
  F('civilacademy', '🏫', '국가공무원인재개발원', { min: 'mpm' }, 4, '공무원을 길러 내는 학교.', { taskTime: 0.01 }),
  F('lawcenter', '📜', '국가법령정보센터', { min: 'moleg' }, 4, '모든 법을 모아 둔 곳.', { trust: 0.3 }),
  F('vaccine', '💉', '백신 심사센터', { min: 'mfds' }, 2, '새 약과 백신을 빠르게 살피는 곳.', { growth: 0.01, approval: 0.2 }),
  // 청 18
  F('draft', '🪪', '징병 검사소', { post: 'mma' }, 2, '입대할 젊은이를 검사하는 곳.', { troop: 0.01 }),
  F('add', '🔬', '국방과학연구소', { post: 'dapa' }, 4, '대전에 있는 무기 연구소.', { research: 0.01, build: 0.01 }),
  F('riot', '🚓', '경찰 기동대', { post: 'police' }, 0, '큰 시위와 사건에 나서는 부대.', { loyalty: 0.5 }),
  F('rescue', '🚒', '119 특수구조대', { post: 'nfa' }, 3, '큰 재난에 뛰어드는 구조대.', { soc: 0.5 }),
  F('taxdata', '🧾', '국세 전산센터', { post: 'tax' }, 0, '세금 기록을 지키는 곳.', { budget: 0.005 }),
  F('customs', '🛃', '부산 본부세관', { post: 'kcs' }, 1, '부산항으로 드나드는 물건을 살피는 곳.', { budget: 0.005, econ: 0.3 }),
  F('stockpile', '📦', '여수 비축 기지', { post: 'pps' }, 8, '나라의 원자재를 쌓아 두는 창고.', { build: 0.01 }),
  F('kcgacademy', '🚤', '해양경찰교육원', { post: 'kcg' }, 8, '여수에서 해양경찰을 길러요.', { sec: 0.5 }),
  F('naro', '🚀', '나로우주센터', { post: 'kasa' }, 9, '고흥 바닷가의 로켓 발사장(순천 권역).', { research: 0.01 }, 'space'),
  F('garden', '🌿', '순천만 국가정원 관리소', { post: 'kfs' }, 9, '순천만 국가정원과 숲을 가꿔요.', { loyalty: 0.4, approval: 0.2 }),
  F('farmlab', '🧑‍🌾', '농업 시험장', { post: 'rda' }, 5, '전주의 새 농업 기술 시험장.', { growth: 0.01 }),
  F('supercom', '🌦️', '기상 슈퍼컴퓨터 센터', { post: 'kma' }, 4, '날씨를 계산하는 큰 컴퓨터.', { mission: 0.005 }),
  F('patent', '📑', '특허 심사원', { post: 'kipo' }, 4, '새 기술을 심사하고 지켜요.', { research: 0.01 }),
  F('cdc', '🦠', '감염병 대응 센터', { post: 'kdca' }, 3, '병이 번지기 전에 막는 곳.', { growth: 0.01 }),
  F('diaspora', '🧳', '세계 동포 교류 센터', { post: 'oka' }, 7, '제주에서 해외 동포를 맞이해요.', { favor: 0.5 }),
  F('saemangeum', '🏗️', '새만금 산업단지', { post: 'sma' }, 10, '바다를 메운 땅의 새 공장 단지(익산 권역).', { econ: 0.5 }),
  F('sejong', '🏙️', '행복도시 정부청사', { post: 'macc' }, 4, '세종 행정도시의 정부 청사(대전 권역).', { taskTime: 0.01 }, 'capital'),
  F('baekje', '🏯', '백제 유적 보존소', { post: 'kh' }, 10, '익산 미륵사지·왕궁리 유적을 지켜요.', { approval: 0.3 }),
  // 11-25 대장 요청 1번: 처음부터 있던 부처 15곳에도 직속 시설 2곳씩(30곳)
  F('jointcollege', '🎖️', '합동 군사 대학교', { min: 'mnd' }, 4, '장교와 참모를 길러 내는 군 대학.', { troop: 0.01, sec: 0.3 }),
  F('transport', '🚛', '국군 수송 사령부', { min: 'mnd' }, 2, '병력과 물자를 실어 나르는 사령부.', { build: 0.01 }),
  F('nisschool', '🕵️', '정보 요원 교육원', { min: 'nis' }, 0, '비밀 요원을 길러 내는 곳.', { mission: 0.005 }),
  F('sigint', '📡', '해안 신호 정보 기지', { min: 'nis' }, 6, '강릉 바닷가에서 전파를 엿듣는 기지.', { mission: 0.004, sec: 0.3 }),
  F('diplacademy', '🌐', '국립 외교원', { min: 'mofa' }, 0, '외교관을 길러 내는 학교.', { favor: 0.5 }),
  F('aid', '🎁', '국제 개발 협력단', { min: 'mofa' }, 3, '가난한 나라를 돕는 원조 기관.', { favor: 0.3, diplo: 0.3 }),
  F('treasury', '🏦', '국고 관리 센터', { min: 'mof' }, 4, '나라 돈의 들고 남을 지키는 곳.', { budget: 0.005 }),
  F('finance', '💹', '국제 금융 센터', { min: 'mof' }, 1, '부산 바닷가의 금융 단지.', { econ: 0.5 }),
  F('complex', '🏭', '국가 산업 단지', { min: 'moti' }, 2, '큰 공장이 모인 산업 단지.', { econ: 0.4, build: 0.005 }),
  F('mineral', '⛏️', '광물 비축 기지', { min: 'moti' }, 6, '희귀 광물을 쌓아 두는 기지.', { build: 0.01 }),
  F('crisisroom', '🚨', '중앙 재난 상황실', { min: 'mois' }, 0, '재난이 나면 모든 기관을 이끄는 곳.', { soc: 0.4, loyalty: 0.3 }),
  F('egov', '💻', '정부 통합 전산 센터', { min: 'mois' }, 4, '정부 전산망을 지키는 곳.', { taskTime: 0.01 }),
  F('natlhosp', '🏥', '국립 중앙 의료원', { min: 'mohw' }, 0, '나라에서 가장 큰 공공 병원.', { growth: 0.01, approval: 0.2 }),
  F('eldercare', '🧓', '노인 돌봄 복지관', { min: 'mohw' }, 5, '어르신을 모시는 큰 복지관.', { loyalty: 0.4 }),
  F('scitech', '🧪', '과학 기술원', { min: 'msit' }, 4, '과학자를 길러 내는 연구 대학.', { research: 0.01 }),
  F('datacenter', '🖥️', '국가 데이터 센터', { min: 'msit' }, 3, '나라의 정보를 모아 두는 큰 전산 시설.', { research: 0.005, mission: 0.003 }),
  F('broadcast', '📡', '국제 방송 센터', { min: 'kocis' }, 0, '세계에 우리 소식을 전하는 방송국.', { approval: 0.2, favor: 0.3 }),
  F('pressctr', '🎙️', '정부 브리핑 센터', { min: 'kocis' }, 4, '기자들이 모이는 정부 발표장.', { trust: 0.2, approval: 0.1 }),
  F('talkhall', '🕊️', '남북 회담 본부', { min: 'mou' }, 0, '평화 회담을 준비하는 곳.', { favor: 0.3, diplo: 0.3 }),
  F('settle', '🏡', '새 정착민 지원 센터', { min: 'mou' }, 6, '새로 온 사람들의 정착을 돕는 곳.', { loyalty: 0.3 }),
  F('forensic', '🔍', '과학 수사 연구소', { min: 'moj' }, 0, '증거를 과학으로 밝히는 곳.', { trust: 0.3 }),
  F('immig', '🛂', '출입국 외국인 센터', { min: 'moj' }, 7, '외국인 인재가 들어오는 문.', { recruit: 0.01 }),
  F('eduinst', '📚', '국가 교육 연구원', { min: 'moe' }, 4, '새 교육 방법을 연구하는 곳.', { research: 0.005, soc: 0.2 }),
  F('gifted', '🏫', '과학 영재 학교', { min: 'moe' }, 3, '재능 있는 아이들을 기르는 학교.', { research: 0.005, recruit: 0.01 }),
  F('newtown', '🏘️', '신도시 개발 본부', { min: 'molit' }, 5, '새 주거 도시를 짓는 본부.', { growth: 0.01, loyalty: 0.3 }),
  F('rail', '🚄', '고속철도 관제 센터', { min: 'molit' }, 4, '나라 고속철도를 이끄는 관제실.', { build: 0.005, econ: 0.3 }),
  F('newport', '⚓', '신항만 건설단', { min: 'mofs' }, 1, '큰 배가 드나드는 새 항만을 짓는 곳.', { econ: 0.4 }),
  F('fishery', '🐟', '수산 자원 연구소', { min: 'mofs' }, 8, '바다 자원을 늘리는 연구소.', { growth: 0.005, loyalty: 0.2 }),
  F('jobcenter', '💼', '고용 복지 센터', { min: 'moel' }, 2, '일자리를 찾아 주는 곳.', { loyalty: 0.3, soc: 0.2 }),
  F('polytech', '🔧', '직업 훈련 대학', { min: 'moel' }, 10, '기술자를 길러 내는 학교.', { build: 0.005, recruit: 0.01 }),
];
export const govFacById = (id: string) => GOV_FACILITIES.find((f) => f.id === id);
export const govFacCost = (lv: number) => 5000 * (lv + 1);
