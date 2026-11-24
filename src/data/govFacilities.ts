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

export const GOV_FAC_MAX = 3;
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
];
export const govFacById = (id: string) => GOV_FACILITIES.find((f) => f.id === id);
export const govFacCost = (lv: number) => 5000 * (lv + 1);
