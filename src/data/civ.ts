// 문명식 운영(기획서 "문명 5·6에서 배울 것", 11-22 대장 결정 반영) 데이터:
// 연구 두 줄(군사 기술 20 · 사회 제도 15) · 시대 4개 · 번뜩임 · 나라 체제 4가지 · 정책 카드 24장
// · 협정 5종 · 도시 구역 5가지 · 국제 회의 안건. 숫자는 시험판 초안.
import type { Res } from './economy';

/** 효과 하나. 연구·체제·카드·회의 결과가 모두 이 모양을 씀 */
export interface Eff {
  /** 생산 시간 배율(0.1 = 10% 빨라짐). 'all' 또는 '육'·'해'·'공' */
  build?: { dom: 'all' | '육' | '해' | '공'; v: number };
  /** 만든 부대 전투력 + 비율 */
  power?: { dom: 'all' | '육' | '해' | '공'; v: number };
  /** 연구 속도 + 비율 */
  research?: number;
  /** 국방예산 수입 + 비율 */
  budget?: number;
  /** 자원 생산 + 비율 */
  res?: number;
  /** 모든 도시 민심 목표 + */
  loyalty?: number;
  /** 모든 나라 호감 + */
  favor?: number;
  /** 개척 섬 영향력 얻는 양 + 비율 */
  influence?: number;
  /** 임무 성공률 + (0.05 = 5%p) */
  mission?: number;
  /** 무역 값 이득(0.1 = 사는 값 10% 싸고 파는 값 10% 비쌈) */
  trade?: number;
  /** 정기 무역 계약 칸 + */
  contracts?: number;
  /** 국제 회의 표 + */
  votes?: number;
  /** 도시 인구 자라는 속도 + 비율 */
  growth?: number;
  /** 구역 짓는 시간 − 비율 */
  district?: number;
}

export type Era = 1 | 2 | 3 | 4;
export const ERAS: Record<Era, { name: string; icon: string; text: string }> = {
  1: { name: '개척기', icon: '🌱', text: '섬에 첫 항구와 마을을 세우는 때' },
  2: { name: '항로기', icon: '🧭', text: '섬과 섬 사이 바닷길이 열리는 때' },
  3: { name: '제공기', icon: '✈️', text: '하늘을 차지하는 쪽이 이기는 때' },
  4: { name: '대양기', icon: '🌊', text: '항모 전단이 먼 바다를 누비는 때' },
};

/** 번뜩임: 이 일을 해내면 그 연구가 절반으로 줄어듦 */
export type EurekaKey =
  | { kind: 'train'; name: string; stars: number }
  | { kind: 'mission'; name: string }
  | { kind: 'talk'; att?: string }
  | { kind: 'district'; id: DistrictId }
  | { kind: 'agree'; id: AgreeId }
  | { kind: 'island' }
  | { kind: 'rank'; at: number }
  | { kind: 'army'; count: number };

export interface Tech {
  id: string;
  line: 'mil' | 'soc';
  name: string;
  icon: string;
  era: Era;
  /** 기본 속도로 걸리는 실제 시간 */
  hours: number;
  needs: string[];
  /** 여는 병과(병과는 지도자 등급 + 이 연구 둘 다 있어야 열림) */
  units?: string[];
  /** 여는 정책 카드 · 협정 · 구역 */
  cards?: string[];
  agree?: AgreeId[];
  districts?: DistrictId[];
  eff?: Eff;
  /** 한 줄 설명 */
  text: string;
  eureka?: { key: EurekaKey; text: string };
}

const T = (t: Tech) => t;

/** 군사 기술 20개 */
export const MIL_TECHS: Tech[] = [
  // 개척기
  T({ id: 'm-drone', line: 'mil', name: '무인기 기술', icon: '🛸', era: 1, hours: 1, needs: [], units: ['무인드론'], text: '싸고 빠른 정찰·자폭 드론', eureka: { key: { kind: 'train', name: '정보', stars: 2 }, text: '정보 훈련 별 2개 이상' } }),
  T({ id: 'm-mech', line: 'mil', name: '기계화 보병', icon: '🚙', era: 1, hours: 1, needs: [], units: ['기갑병'], text: '보병을 장갑차에 태워 빠르게', eureka: { key: { kind: 'train', name: '체력', stars: 2 }, text: '체력 훈련 별 2개 이상' } }),
  T({ id: 'm-cyber', line: 'mil', name: '전자전', icon: '💻', era: 1, hours: 1.5, needs: [], units: ['해킹부대'], text: '적 통신·방공망을 흔드는 부대', eureka: { key: { kind: 'train', name: '해킹', stars: 1 }, text: '해킹 훈련 성공' } }),
  T({ id: 'm-arty', line: 'mil', name: '자주포', icon: '💥', era: 1, hours: 1.5, needs: [], units: ['포병'], text: '멀리서 넓게 때리는 대포', eureka: { key: { kind: 'train', name: '포격', stars: 2 }, text: '포격 훈련 별 2개 이상' } }),
  T({ id: 'm-armor', line: 'mil', name: '복합 장갑', icon: '🛡️', era: 1, hours: 2, needs: ['m-mech'], units: ['전차'], text: '두꺼운 장갑의 주력 전차', eureka: { key: { kind: 'mission', name: '방어' }, text: '방어 임무 성공' } }),
  // 항로기
  T({ id: 'm-radar', line: 'mil', name: '방공 레이더', icon: '📡', era: 2, hours: 3, needs: ['m-cyber'], units: ['방공부대'], text: '하늘을 지키는 방공 부대', eureka: { key: { kind: 'train', name: '항공', stars: 1 }, text: '항공 훈련 성공' } }),
  T({ id: 'm-heli', line: 'mil', name: '회전익 항공', icon: '🚁', era: 2, hours: 3, needs: ['m-drone'], units: ['공격헬기'], text: '낮게 날아 전차를 사냥', eureka: { key: { kind: 'mission', name: '기습' }, text: '기습 임무 성공' } }),
  T({ id: 'm-aegis', line: 'mil', name: '이지스 구축함', icon: '🚢', era: 2, hours: 3.5, needs: [], units: ['구축함', '강습상륙함'], text: '호위·대잠·대공 군함 · 강습상륙함(독점)', eureka: { key: { kind: 'district', id: 'harbor' }, text: '항만 구역 첫 완공' } }),
  T({ id: 'm-jet', line: 'mil', name: '제트 전투기', icon: '✈️', era: 2, hours: 4, needs: ['m-heli'], units: ['전투기'], text: '하늘 장악의 주인공', eureka: { key: { kind: 'district', id: 'airfield' }, text: '비행장 구역 첫 완공' } }),
  T({ id: 'm-supply', line: 'mil', name: '해상 보급선', icon: '📦', era: 2, hours: 3, needs: [], eff: { build: { dom: 'all', v: 0.1 } }, text: '모든 부대 모집 시간 −10%', eureka: { key: { kind: 'mission', name: '호송' }, text: '호송 임무 성공' } }),
  // 제공기
  T({ id: 'm-bomber', line: 'mil', name: '전략 폭격', icon: '🛩️', era: 3, hours: 6, needs: ['m-jet'], units: ['폭격기'], text: '도시·기지에 큰 피해', eureka: { key: { kind: 'train', name: '항공', stars: 3 }, text: '항공 훈련 별 3개' } }),
  T({ id: 'm-silent', line: 'mil', name: '잠수함 정숙화', icon: '🫧', era: 3, hours: 6, needs: ['m-aegis'], units: ['잠수함', '원자력 잠수함'], text: '소리 없이 숨어 기습 · 원자력 잠수함(독점)', eureka: { key: { kind: 'train', name: '해상', stars: 2 }, text: '해상 훈련 별 2개 이상(해전 승리)' } }),
  T({ id: 'm-guided', line: 'mil', name: '정밀 유도', icon: '🚀', era: 3, hours: 6, needs: ['m-arty', 'm-radar'], units: ['미사일'], text: '아주 멀리서 정확히', eureka: { key: { kind: 'train', name: '포격', stars: 3 }, text: '포격 훈련 별 3개' } }),
  T({ id: 'm-stealth', line: 'mil', name: '스텔스 도료', icon: '🦇', era: 3, hours: 7, needs: ['m-jet'], eff: { power: { dom: '공', v: 0.15 } }, text: '공군 전투력 +15%', eureka: { key: { kind: 'train', name: '잠입', stars: 3 }, text: '잠입 훈련 별 3개' } }),
  T({ id: 'm-sat', line: 'mil', name: '정찰 위성', icon: '🛰️', era: 3, hours: 7, needs: ['m-radar'], eff: { mission: 0.05 }, text: '임무 성공률 +5%', eureka: { key: { kind: 'mission', name: '정찰' }, text: '정찰 임무 성공' } }),
  // 대양기
  T({ id: 'm-carrier', line: 'mil', name: '항모 운용', icon: '🛳️', era: 4, hours: 10, needs: ['m-jet', 'm-aegis'], units: ['항공모함'], text: '바다 위 비행장, 함재기 출격', eureka: { key: { kind: 'train', name: '항공', stars: 2 }, text: '항공 훈련 별 2개 이상(함재기 운용)' } }),
  T({ id: 'm-secret', line: 'mil', name: '국가 비밀 병기', icon: '🌟', era: 4, hours: 9, needs: ['m-armor'], text: '특화 유닛 전투력 +15%', eureka: { key: { kind: 'mission', name: '대전투' }, text: '대전투 승리' } }),
  T({ id: 'm-crystal', line: 'mil', name: '청광석 동력', icon: '💎', era: 4, hours: 10, needs: ['m-silent'], units: ['청광 방벽함'], eff: { power: { dom: 'all', v: 0.1 } }, text: '청광석으로 모든 전투력 +10% · 특화 유닛 청광 개량형 · 청광 방벽함(독점)', eureka: { key: { kind: 'island' }, text: '개척 섬 한 곳에서 영향력 1등' } }),
  T({ id: 'm-net', line: 'mil', name: '통합 전장망', icon: '🕸️', era: 4, hours: 11, needs: ['m-sat'], eff: { mission: 0.05, power: { dom: '육', v: 0.15 } }, text: '임무 성공률 +5% · 육군 전투력 +15%', eureka: { key: { kind: 'army', count: 20 }, text: '부대 20개 보유' } }),
  T({ id: 'm-fleet', line: 'mil', name: '대양 함대 교리', icon: '⚓', era: 4, hours: 12, needs: ['m-carrier'], eff: { build: { dom: '해', v: 0.2 }, power: { dom: '해', v: 0.15 } }, text: '해군 모집 −20% · 해군 전투력 +15%', eureka: { key: { kind: 'train', name: '해상', stars: 3 }, text: '해상 훈련 별 3개' } }),
];

/** 사회 제도 15개 */
export const SOC_TECHS: Tech[] = [
  // 개척기
  T({ id: 's-charter', line: 'soc', name: '개척 헌장', icon: '📜', era: 1, hours: 1, needs: [], cards: ['군-징집', '경-개척'], text: '체제 바꾸기 · 카드 2장', eureka: { key: { kind: 'rank', at: 1 }, text: '신임 지도자로 승급' } }),
  T({ id: 's-urban', line: 'soc', name: '도시 계획', icon: '🏘️', era: 1, hours: 1, needs: [], districts: ['industry', 'housing'], cards: ['경-도시'], text: '공업·주거 구역 짓기', eureka: { key: { kind: 'train', name: '보급', stars: 1 }, text: '보급 훈련 성공' } }),
  T({ id: 's-envoy', line: 'soc', name: '사절단', icon: '🕊️', era: 1, hours: 1.5, needs: [], agree: ['route'], cards: ['외-사절'], text: '항로 개방 협정 · 개척 섬 사절 효율 ↑', eureka: { key: { kind: 'talk', att: '화해' }, text: '대화에서 화해 성공' } }),
  T({ id: 's-guild', line: 'soc', name: '항로 상회', icon: '⚖️', era: 1, hours: 1.5, needs: [], agree: ['swap'], cards: ['경-상회'], text: '자원 교환 계약 협정', eureka: { key: { kind: 'talk', att: '거래' }, text: '대화에서 거래 성공' } }),
  // 항로기
  T({ id: 's-harbor', line: 'soc', name: '항만법', icon: '⚓', era: 2, hours: 3, needs: ['s-urban'], districts: ['harbor'], cards: ['군-해병'], text: '항만 구역(바닷가 칸) 짓기', eureka: { key: { kind: 'train', name: '해상', stars: 1 }, text: '해상 훈련 성공' } }),
  T({ id: 's-aviation', line: 'soc', name: '항공법', icon: '🛫', era: 2, hours: 3, needs: ['s-urban'], districts: ['airfield'], cards: ['군-조종'], text: '비행장 구역(평지 칸) 짓기', eureka: { key: { kind: 'train', name: '항공', stars: 1 }, text: '항공 훈련 성공' } }),
  T({ id: 's-academy', line: 'soc', name: '학술원', icon: '🎓', era: 2, hours: 3.5, needs: ['s-urban'], districts: ['lab'], agree: ['science'], cards: ['경-학자'], text: '연구소 구역 · 연구 협력 협정', eureka: { key: { kind: 'district', id: 'industry' }, text: '공업 구역 첫 완공' } }),
  T({ id: 's-nonagg', line: 'soc', name: '불가침 조약법', icon: '🤝', era: 2, hours: 3, needs: ['s-envoy'], agree: ['nonagg'], cards: ['외-불가침'], text: '불가침 협정', eureka: { key: { kind: 'agree', id: 'route' }, text: '항로 개방 협정 맺기' } }),
  // 제공기
  T({ id: 's-defense', line: 'soc', name: '상호 방위법', icon: '🛡️', era: 3, hours: 6, needs: ['s-nonagg'], agree: ['defense'], cards: ['외-방위', '군-방위'], text: '방위 약속 협정', eureka: { key: { kind: 'mission', name: '작전' }, text: '작전 성공' } }),
  T({ id: 's-welfare', line: 'soc', name: '복지 제도', icon: '🏥', era: 3, hours: 5, needs: ['s-urban'], eff: { loyalty: 5 }, cards: ['경-복지'], text: '모든 도시 민심 +5', eureka: { key: { kind: 'district', id: 'housing' }, text: '주거 구역 첫 완공' } }),
  T({ id: 's-draft', line: 'soc', name: '국민 개병제', icon: '🪖', era: 3, hours: 5, needs: ['s-charter'], cards: ['군-동원', '군-정예'], text: '군사 카드 2장', eureka: { key: { kind: 'train', name: '모병', stars: 2 }, text: '모병 훈련 별 2개 이상' } }),
  T({ id: 's-council', line: 'soc', name: '국제 회의 제도', icon: '🏛️', era: 3, hours: 6, needs: ['s-envoy'], eff: { votes: 1 }, cards: ['외-회의'], text: '회의 표 +1', eureka: { key: { kind: 'talk' }, text: '성소 회담(대화) 성공' } }),
  // 대양기
  T({ id: 's-federal', line: 'soc', name: '헌법 개정', icon: '🏛️', era: 4, hours: 10, needs: ['s-charter', 's-welfare'], cards: ['경-연방', '외-연방'], eff: { growth: 0.2 }, text: '도시 성장 +20% · 카드 2장', eureka: { key: { kind: 'rank', at: 6 }, text: '존경받는 지도자로 승급' } }),
  T({ id: 's-media', line: 'soc', name: '국민 방송', icon: '📺', era: 4, hours: 9, needs: ['s-welfare'], eff: { loyalty: 5, favor: 5 }, cards: ['외-방송'], text: '민심 +5 · 모든 나라 호감 +5', eureka: { key: { kind: 'talk', att: '원칙' }, text: '대화에서 원칙 성공' } }),
  T({ id: 's-peace', line: 'soc', name: '국제 평화 헌장', icon: '☮️', era: 4, hours: 12, needs: ['s-council', 's-defense'], eff: { favor: 10, influence: 0.25 }, cards: ['외-평화'], text: '모든 나라 호감 +10 · 섬 영향력 +25%', eureka: { key: { kind: 'agree', id: 'defense' }, text: '방위 약속 협정 맺기' } }),
];

export const TECHS: Tech[] = [...MIL_TECHS, ...SOC_TECHS];
export const techById = (id: string) => TECHS.find((t) => t.id === id);
/** 병과 → 여는 연구(없으면 처음부터 열림: 보병·특수부대) */
export function techForUnit(unit: string): Tech | undefined {
  return MIL_TECHS.find((t) => t.units?.includes(unit));
}

// ── 나라 체제(4가지만, 11-22 결정) · 정책 카드 ──

export type SlotKind = '군사' | '경제' | '외교' | '자유';
export const SLOT_ICON: Record<SlotKind, string> = { 군사: '⚔️', 경제: '💰', 외교: '🕊️', 자유: '⭐' };
export type GovId = 'assembly' | 'navy' | 'merchant' | 'sanctum';
export interface Gov {
  id: GovId;
  name: string;
  icon: string;
  /** 처음 5칸(기획서 칸 구성) */
  slots: SlotKind[];
  eff: Eff;
  text: string;
  play: string;
}
export const GOVS: Gov[] = [
  { id: 'assembly', name: '개척 의회', icon: '🏛️', slots: ['경제', '외교', '경제', '외교', '자유'], eff: { influence: 0.25 }, text: '개척 섬 영향력 +25%', play: '평화·연합 승리' },
  { id: 'navy', name: '해군 통치', icon: '⚓', slots: ['군사', '군사', '경제', '군사', '자유'], eff: { build: { dom: '해', v: 0.2 } }, text: '군함·항모 모집 +20% 빠름', play: '바다 장악, 정복' },
  { id: 'merchant', name: '상업 연합', icon: '⚖️', slots: ['경제', '경제', '외교', '경제', '자유'], eff: { trade: 0.1, contracts: 1 }, text: '무역 값 10% 이득 · 정기 계약 +1칸', play: '자원 부자' },
  { id: 'sanctum', name: '성지 회의', icon: '🔷', slots: ['외교', '군사', '외교', '자유', '자유'], eff: { votes: 1, research: 0.1 }, text: '국제 회의 표 +1 · 연구 +10%(청광석 연구 ×2)', play: '성소와 유적 중심' },
];
export const govById = (id: GovId) => GOVS.find((g) => g.id === id)!;

/** 지도자 등급(0~10)마다 쓸 수 있는 카드 칸: 2칸에서 시작해 전설의 지도자 8칸 */
export const slotCount = (rank: number) => Math.min(8, 2 + Math.floor((rank * 6) / 10));
/** 정해진 5칸 뒤에 붙는 칸(6~8번째)은 자유 칸 */
export function govSlots(g: Gov, rank: number): SlotKind[] {
  const all: SlotKind[] = [...g.slots, '자유', '자유', '자유'];
  return all.slice(0, slotCount(rank));
}

export interface Card {
  id: string;
  kind: Exclude<SlotKind, '자유'>;
  name: string;
  icon: string;
  eff: Eff;
  text: string;
}
const C = (c: Card) => c;
/** 정책 카드 24장(군사 8 · 경제 8 · 외교 8). 처음 8장은 연구 없이 씀 */
export const CARDS: Card[] = [
  C({ id: '군-훈련', kind: '군사', name: '실전 훈련', icon: '🎯', eff: { mission: 0.04 }, text: '임무 성공률 +4%' }),
  C({ id: '군-보급', kind: '군사', name: '보급 우선', icon: '📦', eff: { build: { dom: '육', v: 0.15 } }, text: '육군 모집 −15%' }),
  C({ id: '군-징집', kind: '군사', name: '징집 확대', icon: '📝', eff: { power: { dom: '육', v: 0.1 }, loyalty: -3 }, text: '육군 전투력 +10% · 민심 −3' }),
  C({ id: '군-해병', kind: '군사', name: '해병 전통', icon: '⚓', eff: { build: { dom: '해', v: 0.15 } }, text: '해군 모집 −15%' }),
  C({ id: '군-조종', kind: '군사', name: '조종사 양성', icon: '✈️', eff: { build: { dom: '공', v: 0.15 } }, text: '공군 모집 −15%' }),
  C({ id: '군-방위', kind: '군사', name: '국토 방위', icon: '🛡️', eff: { power: { dom: 'all', v: 0.08 } }, text: '모든 전투력 +8%' }),
  C({ id: '군-동원', kind: '군사', name: '총동원', icon: '📣', eff: { build: { dom: 'all', v: 0.2 }, budget: -0.1 }, text: '모든 모집 −20% · 국방예산 −10%' }),
  C({ id: '군-정예', kind: '군사', name: '정예 부대', icon: '🎖️', eff: { power: { dom: 'all', v: 0.15 }, build: { dom: 'all', v: -0.1 } }, text: '전투력 +15% · 모집 +10% 느림' }),
  C({ id: '경-세금', kind: '경제', name: '군수 세금', icon: '💰', eff: { budget: 0.08 }, text: '국방예산 +8%' }),
  C({ id: '경-광산', kind: '경제', name: '광산 장려', icon: '⛏️', eff: { res: 0.1 }, text: '자원 +10%' }),
  C({ id: '경-개척', kind: '경제', name: '개척민 지원', icon: '🌱', eff: { growth: 0.25 }, text: '도시 성장 +25%' }),
  C({ id: '경-도시', kind: '경제', name: '도시 정비', icon: '🏗️', eff: { district: 0.25 }, text: '구역 짓는 시간 −25%' }),
  C({ id: '경-상회', kind: '경제', name: '자유 항구', icon: '🚢', eff: { trade: 0.08 }, text: '무역 값 8% 이득' }),
  C({ id: '경-학자', kind: '경제', name: '학자 초빙', icon: '🎓', eff: { research: 0.15 }, text: '연구 +15%' }),
  C({ id: '경-복지', kind: '경제', name: '배급 확대', icon: '🍞', eff: { loyalty: 8, budget: -0.05 }, text: '민심 +8 · 국방예산 −5%' }),
  C({ id: '경-연방', kind: '경제', name: '국가 투자', icon: '🏦', eff: { budget: 0.12, res: 0.1 }, text: '국방예산 +12% · 자원 +10%' }),
  C({ id: '외-사절', kind: '외교', name: '상주 사절', icon: '🕊️', eff: { influence: 0.2 }, text: '섬 영향력 +20%' }),
  C({ id: '외-친선', kind: '외교', name: '친선 방문', icon: '🤝', eff: { favor: 5 }, text: '모든 나라 호감 +5' }),
  C({ id: '외-정보', kind: '외교', name: '외교 정보망', icon: '🗝️', eff: { mission: 0.03, favor: -2 }, text: '임무 성공률 +3% · 호감 −2' }),
  C({ id: '외-불가침', kind: '외교', name: '국경 안정', icon: '🧱', eff: { loyalty: 4, favor: 3 }, text: '민심 +4 · 호감 +3' }),
  C({ id: '외-방위', kind: '외교', name: '동맹 의무', icon: '🛡️', eff: { favor: 4, power: { dom: 'all', v: 0.04 } }, text: '호감 +4 · 전투력 +4%' }),
  C({ id: '외-회의', kind: '외교', name: '회의 로비', icon: '🗳️', eff: { votes: 1 }, text: '국제 회의 표 +1' }),
  C({ id: '외-방송', kind: '외교', name: '국제 방송', icon: '📻', eff: { favor: 6, influence: 0.1 }, text: '호감 +6 · 섬 영향력 +10%' }),
  C({ id: '외-연방', kind: '외교', name: '국제 우호', icon: '🌐', eff: { favor: 8, contracts: 1 }, text: '호감 +8 · 정기 계약 +1칸' }),
];
// 처음부터 쓸 수 있는 8장
export const START_CARDS = ['군-훈련', '군-보급', '경-세금', '경-광산', '외-친선', '외-정보', '경-학자', '경-개척'];
// 나머지 '외-평화'처럼 연구 목록에만 있는 이름은 카드가 없으면 건너뜀
export const cardById = (id: string) => CARDS.find((c) => c.id === id);

/** 카드 바꾸기: 실제 하루 1번 무료, 그 밖엔 예산 */
export const CARD_SWAP_FREE_MS = 24 * 3600e3;
export const CARD_SWAP_COST = 3000;
/** 체제 바꾸기: 예산 + 하루 혼란(생산 −20%). 처음 고르는 것은 무료 */
export const GOV_CHANGE_COST = 20000;
export const GOV_CHAOS_MS = 24 * 3600e3;
export const GOV_CHAOS = 0.2;

// ── 연구 속도 ──
/** 기본 연구 점수: 실제 1시간에 1(= 연구 'hours'만큼 걸림) */
export const RESEARCH_BASE = 1;
export const RESEARCH_PER_POP = 0.015;
export const RESEARCH_PER_LAB = 0.12;
export const RESEARCH_PER_LAB_ADJ = 0.04;
export const RESEARCH_PER_SCIENCE_PACT = 0.1;
/** 시대가 바뀌면 모든 맞수 사이 긴장 + */
export const ERA_TENSION = 4;

// ── 외교: 호감 · 협정 · 불만 장부 ──

export type AgreeId = 'route' | 'science' | 'swap' | 'defense' | 'nonagg';
export interface Agree {
  id: AgreeId;
  name: string;
  icon: string;
  /** 상대 호감이 이만큼은 돼야 받아 줌 */
  favorNeed: number;
  /** 실제 시간 */
  hours: number;
  cost: number;
  text: string;
}
export const AGREES: Agree[] = [
  { id: 'route', name: '항로 개방', icon: '🧭', favorNeed: -10, hours: 24, cost: 1500, text: '그 나라와 무역 값 10% 이득 · 호감 +5' },
  { id: 'science', name: '연구 협력', icon: '🔬', favorNeed: 10, hours: 48, cost: 4000, text: '연구 속도 +10% · 호감 +5' },
  { id: 'swap', name: '자원 교환 계약', icon: '🔁', favorNeed: 0, hours: 48, cost: 2000, text: '그 나라가 만드는 자원 1가지를 시간당 1개 받고, 우리 가장 많은 자원 1개를 줌' },
  { id: 'defense', name: '방위 약속', icon: '🛡️', favorNeed: 30, hours: 72, cost: 6000, text: '그 나라와 긴장이 오르지 않고, 내 도시 방어 +5% · 호감 +10' },
  { id: 'nonagg', name: '불가침', icon: '🤝', favorNeed: 5, hours: 72, cost: 3000, text: '그 나라와 긴장이 오르지 않음 · 호감 +5' },
];
export const agreeById = (id: AgreeId) => AGREES.find((a) => a.id === id)!;
export const AGREE_FAVOR: Record<AgreeId, number> = { route: 5, science: 5, swap: 3, defense: 10, nonagg: 5 };
/** 협정·체제 같은 계산 이유 외에, 쌓이는 이유(대화·불만)는 시간이 지나면 줄어듦: 실제 하루에 이 비율 */
export const FAVOR_DECAY_PER_DAY = 0.2;
export const GRIEVANCE_DECAY_PER_DAY = 0.1;
/** 불만 장부 */
export const GRIEVANCE = {
  surprise: 40, // 기습 침공(호감이 좋았거나 협정·약속 중이던 나라에 선전포고)
  brokeAgree: 30, // 협정 깨기
  war: 15, // 그냥 선전포고
  capture: 15, // 도시 빼앗기
  holy: 25, // 성지 더럽히기(회의 결의를 어기고 전쟁)
  neighbor: 0.4, // 같은 지역·같은 협약 이웃은 이 비율만큼 같이 미워함
};

// ── 개척 섬 영향력 ──
export const ENVOY_COST = 1500;
export const ENVOY_INFLUENCE = 10;
export const ENVOY_COOLDOWN_MS = 4 * 3600e3;
/** 1등이면서 이 영향력 이상이어야 섬 혜택 */
export const ISLAND_LEAD_MIN = 30;
export const ISLAND_RES_PER_HOUR = 2;
/** 섬 부탁: 자원을 보내면 영향력 + */
export const ISLAND_REQUEST_INFLUENCE = 15;
export const ISLAND_REQUEST_MS = 12 * 3600e3;
/** AI 나라이 판단마다 섬에 쌓는 영향력(쏠리는 섬 2~3곳) */
export const AI_INFLUENCE_PER_TICK = 0.35;
export const INFLUENCE_MAX = 200;

// ── 국제 회의(고대 성지, 실제 하루마다) ──
export const COUNCIL_EVERY_MS = 24 * 3600e3;
export const COUNCIL_ANSWER_MS = 6 * 3600e3;
export const COUNCIL_EFFECT_MS = 24 * 3600e3;
export type AgendaId = 'embargo' | 'sanction' | 'truce' | 'science' | 'islands';
export interface Agenda {
  id: AgendaId;
  name: string;
  icon: string;
  /** 통과하면(모든 나라에) */
  yes: Eff;
  text: string;
  /** 대상 나라이 있는 안건 */
  target?: boolean;
}
export const AGENDAS: Agenda[] = [
  { id: 'embargo', name: '청광석 수출 금지', icon: '⛔', yes: { trade: -0.15 }, text: '하루 동안 모든 무역 값 15% 손해' },
  { id: 'sanction', name: '항로 제재', icon: '🚫', yes: {}, text: '대상 나라의 국방예산 −20%, 하루 동안', target: true },
  { id: 'truce', name: '성지 휴전', icon: '☮️', yes: {}, text: '모든 나라 사이 긴장 −15 · 하루 동안 전쟁 선포 시 불만 큼' },
  { id: 'science', name: '연구 공유', icon: '📚', yes: { research: 0.15 }, text: '하루 동안 연구 +15%' },
  { id: 'islands', name: '개척 섬 보호', icon: '🏝️', yes: { influence: 0.5 }, text: '하루 동안 섬 영향력 +50%' },
];
export const agendaById = (id: AgendaId) => AGENDAS.find((a) => a.id === id)!;

// ── 내정: 도시 구역 · 민심 · 인구 ──

export type DistrictId = 'industry' | 'harbor' | 'airfield' | 'lab' | 'housing';
export interface District {
  id: DistrictId;
  name: string;
  icon: string;
  /** 지을 수 있는 칸 */
  where: '아무 칸' | '바닷가 칸' | '평지 칸';
  cost: number;
  res: Partial<Record<Res, number>>;
  hours: number;
  text: string;
  adj: string;
}
export const DISTRICTS: District[] = [
  { id: 'industry', name: '공업 구역', icon: '🏭', where: '아무 칸', cost: 3000, res: { 강철: 5 }, hours: 2, text: '국방예산 +4% · 자원 +4%', adj: '옆 공업 구역·산 칸마다 +1%씩 더' },
  { id: 'harbor', name: '항만', icon: '⚓', where: '바닷가 칸', cost: 4000, res: { 강철: 8 }, hours: 3, text: '군함을 만들 수 있음 · 해군 모집 −5%', adj: '옆 바다 칸마다 해군 모집 −2%씩 더' },
  { id: 'airfield', name: '비행장', icon: '🛫', where: '평지 칸', cost: 4000, res: { 강철: 4, 석유: 4 }, hours: 3, text: '전투기·헬기·폭격기를 만들 수 있음 · 공군 모집 −5%', adj: '옆 공업 구역마다 공군 모집 −2%씩 더' },
  { id: 'lab', name: '연구소', icon: '🔬', where: '아무 칸', cost: 3500, res: { 반도체: 3 }, hours: 3, text: '연구 +12%', adj: '옆 산·유적 칸마다 연구 +4%씩 더' },
  { id: 'housing', name: '주거 구역', icon: '🏘️', where: '아무 칸', cost: 2500, res: { 강철: 3 }, hours: 2, text: '그 도시 민심 +10 · 인구 상한 +2 · 성장 빨라짐', adj: '옆 주거·바다 칸마다 민심 +2씩 더' },
];
export const districtById = (id: DistrictId) => DISTRICTS.find((d) => d.id === id)!;
/** 도시 크기(19·37·61칸)에 따른 구역 수 1·2·3 */
export const DISTRICT_SLOTS: Record<2 | 3 | 4, number> = { 2: 1, 3: 2, 4: 3 };
/** 연구로 칸을 더: 헌법 개정 +1 */
export const POP_MAX = 10;
/** 인구 1 → 2에 필요한 성장 점수(인구 × 이 값) */
export const GROW_NEED_PER_POP = 6;
/** 인구 1마다 국방예산 +2%(평균) */
export const POP_BUDGET = 0.02;
/** 민심이 이보다 낮으면 생산이 줄어듦(아주 낮아도 도시는 잃지 않음, 11-22 결정) */
export const LOYALTY_OK = 50;
/** 민심이 목표로 다가가는 속도(실제 1시간에 차이의 이 비율) */
export const LOYALTY_SPEED = 0.15;
