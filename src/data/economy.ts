// 6단계 내정 데이터: 자원 15종(전략 9 · 가공 1 · 판타지 1 · 생활 4) · 도시마다 나는 자원 · 병과 생산 비용 · 내정 시설.
// 11-23 대장 결정(자원 3안): 구리·우라늄·복합소재·청광석·생활 자원 4종 추가 + 지도 칸 매장지(civ.ts) + 전투 연료·탄약.
// 숫자는 시험판용(7단계에서 맞춤). 실제 1시간 = 게임 하루.
import { UNITS } from './catalog';

export const RESOURCES = ['강철', '석유', '알루미늄', '티타늄', '희토류', '리튬', '반도체', '구리', '우라늄', '복합소재', '청광석', '향신료', '진주', '차잎', '산호'] as const;
export type Res = (typeof RESOURCES)[number];
/** 처음부터 있던 기본 전략 자원 7종(하나라도 없으면 민심 −5) */
export const BASIC_RES: Res[] = ['강철', '석유', '알루미늄', '티타늄', '희토류', '리튬', '반도체'];
export type ResKind = '전략' | '가공' | '판타지' | '생활';
export const RES_KINDS: ResKind[] = ['전략', '가공', '판타지', '생활'];
export const RES_KIND: Record<Res, ResKind> = {
  강철: '전략', 석유: '전략', 알루미늄: '전략', 티타늄: '전략', 희토류: '전략', 리튬: '전략', 반도체: '전략', 구리: '전략', 우라늄: '전략',
  복합소재: '가공', 청광석: '판타지', 향신료: '생활', 진주: '생활', 차잎: '생활', 산호: '생활',
};
export const RES_KIND_TEXT: Record<ResKind, string> = {
  전략: '무기를 만드는 재료. 하나라도 모자라면 그 병과를 못 만들어요',
  가공: '공업 구역에서 다른 자원을 섞어 만들어요',
  판타지: '고대 성지 둘레 섬에서만 나는 푸른 광석',
  생활: '쓰지 않고 가지고만 있어도 모든 도시 민심 +3(종류마다). 남는 건 팔아요',
};
export const LUXURIES: Res[] = ['향신료', '진주', '차잎', '산호'];
/** 생활 자원 한 종류가 주는 민심 */
export const LUXURY_LOYALTY = 3;
export const RES_ICON: Record<Res, string> = {
  강철: '🔩', 석유: '🛢️', 알루미늄: '🥫', 티타늄: '💠', 희토류: '🪨', 리튬: '🔋', 반도체: '💾',
  구리: '🟠', 우라늄: '☢️', 복합소재: '🧶', 청광석: '💎', 향신료: '🌶️', 진주: '🦪', 차잎: '🍵', 산호: '🪸',
};
/** 자원 설명 */
export const RES_DESC: Record<Res, string> = {
  강철: '배·전차·대포의 뼈대. 가장 많이 쓰는 기본 금속',
  석유: '전차·비행기·배를 움직이는 연료',
  알루미늄: '가볍고 단단해 비행기·드론 몸체에 씀',
  티타늄: '열과 충격에 강한 고급 금속. 전투기·폭격기·미사일',
  희토류: '레이더·유도장치에 드는 귀한 광물',
  리튬: '전지 재료. 드론·잠수함 동력',
  반도체: '모든 첨단 무기의 두뇌. 비쌈',
  구리: '탄약·전선. 포병·미사일·방공에 들고, 지도 위 전투 탄약이 됨',
  우라늄: '원자로 연료. 항공모함·잠수함에 듦. 몇 도시에만 있어 아주 귀함',
  복합소재: '가볍고 레이더에 덜 잡히는 몸체. 공업 구역에서 알루미늄 2 + 석유 1로 만듦',
  청광석: '고대 성지의 푸른 광석. 청광석 연구·청광 개량형·청광 방벽함',
  향신료: '남쪽 섬의 매운 향신료. 가지고 있으면 민심 +3',
  진주: '얕은 바다의 진주. 가지고 있으면 민심 +3',
  차잎: '산비탈의 찻잎. 가지고 있으면 민심 +3',
  산호: '따뜻한 바다의 붉은 산호. 가지고 있으면 민심 +3',
};
/** 무역 기본 값(1개) */
export const RES_PRICE: Record<Res, number> = {
  강철: 40, 석유: 60, 알루미늄: 50, 티타늄: 120, 희토류: 150, 리튬: 110, 반도체: 200,
  구리: 70, 우라늄: 260, 복합소재: 180, 청광석: 320, 향신료: 90, 진주: 90, 차잎: 90, 산호: 90,
};
export type Stock = Record<Res, number>;
export const emptyStock = (): Stock => Object.fromEntries(RESOURCES.map((r) => [r, 0])) as Stock;

/** 도시 이름 → 하루(실제 1시간)에 나는 자원. 실제 산업 특징을 조금 반영 */
export const CITY_RES: Record<string, Partial<Stock>> = {
  워싱턴: { 석유: 2 }, 뉴욕: { 알루미늄: 2, 진주: 1 }, 샌프란시스코: { 리튬: 1, 반도체: 1 }, 호놀룰루: { 석유: 1, 산호: 1 },
  덴버: { 티타늄: 1 }, 피닉스: { 희토류: 1, 구리: 1 }, 피츠버그: { 강철: 2 }, 휴스턴: { 석유: 1, 리튬: 1 },
  베이징: { 희토류: 2 }, 톈진: { 강철: 3 }, 광저우: { 알루미늄: 2 }, 선전: { 반도체: 2, 차잎: 1 },
  바오터우: { 희토류: 1 }, 우한: { 강철: 1, 구리: 1 }, 란저우: { 티타늄: 1, 우라늄: 1 }, 상하이: { 석유: 1, 진주: 1 },
  모스크바: { 티타늄: 2 }, 상트페테르부르크: { 강철: 2 }, 튜멘: { 석유: 3 },
  무르만스크: { 리튬: 1 }, 예카테린부르크: { 강철: 1 }, 아르한겔스크: { 석유: 2 }, 노릴스크: { 티타늄: 1, 우라늄: 1 }, 야쿠츠크: { 희토류: 1 }, 블라디보스토크: { 알루미늄: 1, 진주: 1 }, 노보시비르스크: { 강철: 1 },
  베를린: { 반도체: 1 }, 함부르크: { 강철: 2, 구리: 1 },
  도쿄: { 반도체: 2, 차잎: 1 }, 후쿠오카: { 강철: 2, 진주: 1 },
  런던: { 반도체: 1, 차잎: 1 }, 버밍엄: { 강철: 1, 구리: 1 },
  뉴델리: { 희토류: 1 }, 콜카타: { 강철: 2 }, 벵갈루루: { 반도체: 1, 티타늄: 1, 차잎: 1 }, 첸나이: { 알루미늄: 1 }, 뭄바이: { 리튬: 1, 향신료: 1 },
  서울: { 반도체: 2 }, 부산: { 반도체: 1, 리튬: 1, 진주: 1 },
  앙카라: { 티타늄: 1 }, 이스탄불: { 강철: 2, 구리: 1 }, 이즈미르: { 알루미늄: 1, 향신료: 1 },
  텔아비브: { 반도체: 2 }, 하이파: { 알루미늄: 1, 산호: 1, 구리: 1 },
  테헤란: { 석유: 2 }, 이스파한: { 강철: 1, 티타늄: 1, 구리: 1 }, 반다르아바스: { 석유: 3 }, 시라즈: { 희토류: 1, 향신료: 1 },
  키이우: { 티타늄: 1 }, 하르키우: { 강철: 2 }, 오데사: { 석유: 1, 향신료: 1 },
  평양: { 희토류: 2, 우라늄: 1 }, 남포: { 강철: 1 },
};

export interface UnitCost {
  /** 국방예산 */
  money: number;
  res: Partial<Stock>;
  /** 만드는 데 걸리는 실제 시간 */
  hours: number;
  /** 전투력(대전투가 쉬워짐) */
  power: number;
  /** 늘어나는 병력(명) */
  troops: number;
}

/** 병과 15개 + 독점 병과 3개 생산 비용(1부대) */
export const UNIT_COST: Record<string, UnitCost> = {
  보병: { money: 300, res: { 강철: 1 }, hours: 1, power: 2, troops: 2000 },
  특수부대: { money: 600, res: { 강철: 1, 반도체: 1 }, hours: 2, power: 4, troops: 300 },
  기갑병: { money: 700, res: { 강철: 3, 석유: 1 }, hours: 2, power: 5, troops: 800 },
  무인드론: { money: 400, res: { 알루미늄: 1, 리튬: 1, 반도체: 1 }, hours: 1, power: 4, troops: 0 },
  해킹부대: { money: 800, res: { 반도체: 3 }, hours: 2, power: 5, troops: 100 },
  전차: { money: 1200, res: { 강철: 5, 석유: 2 }, hours: 3, power: 9, troops: 400 },
  포병: { money: 1000, res: { 강철: 4, 석유: 1, 구리: 1 }, hours: 3, power: 8, troops: 500 },
  방공부대: { money: 1300, res: { 강철: 2, 반도체: 2, 희토류: 1, 구리: 1 }, hours: 3, power: 8, troops: 400 },
  공격헬기: { money: 1800, res: { 알루미늄: 3, 티타늄: 1, 석유: 2 }, hours: 4, power: 12, troops: 100 },
  전투기: { money: 3000, res: { 알루미늄: 2, 복합소재: 2, 티타늄: 3, 반도체: 2, 석유: 2 }, hours: 6, power: 20, troops: 100 },
  구축함: { money: 3500, res: { 강철: 10, 석유: 4, 반도체: 2, 구리: 1 }, hours: 8, power: 22, troops: 300 },
  폭격기: { money: 4500, res: { 알루미늄: 3, 복합소재: 3, 티타늄: 4, 석유: 4 }, hours: 8, power: 28, troops: 100 },
  잠수함: { money: 4500, res: { 강철: 10, 리튬: 4, 반도체: 3, 우라늄: 1 }, hours: 10, power: 28, troops: 150 },
  미사일: { money: 2500, res: { 티타늄: 2, 희토류: 3, 반도체: 3, 구리: 2 }, hours: 4, power: 18, troops: 0 },
  항공모함: { money: 12000, res: { 강철: 30, 석유: 10, 반도체: 6, 티타늄: 4, 우라늄: 2 }, hours: 24, power: 70, troops: 2000 },
  // 독점 병과(몇 나라만 만듦, data/specials.ts EXCLUSIVES)
  강습상륙함: { money: 6000, res: { 강철: 16, 석유: 6, 반도체: 3, 구리: 2 }, hours: 12, power: 34, troops: 1500 },
  '원자력 잠수함': { money: 7000, res: { 강철: 12, 리튬: 2, 반도체: 4, 우라늄: 3 }, hours: 14, power: 40, troops: 150 },
  '청광 방벽함': { money: 8000, res: { 강철: 12, 반도체: 4, 청광석: 4 }, hours: 14, power: 42, troops: 300 },
};

/** 특화 유닛 = 기본 병과보다 조금 비싸고(×1.15) 세고(×1.25) 고유 능력이 있음. 특화마다 값을 따로 조절(data/specials.ts) */
export function specialCost(base: string, k: { money?: number; hours?: number; power?: number } = {}): UnitCost {
  const b = UNIT_COST[base];
  const m = k.money ?? 1.15;
  const res: Partial<Stock> = {};
  for (const [r, v] of Object.entries(b.res)) res[r as Res] = Math.max(1, Math.round(v! * m));
  return {
    money: Math.round(b.money * m),
    res,
    hours: Math.max(0.5, Math.round(b.hours * (k.hours ?? 1.1) * 10) / 10),
    power: Math.round(b.power * (k.power ?? 1.25)),
    troops: Math.round(b.troops * 1.1),
  };
}

/** 생산·무역·내정 일은 처음부터(지도자로 시작). 예전 숫자는 시험·호환용으로 남김 */
export const ECON_RANK = 0;
export const TOP_RANK = 10;

export const FACILITIES = ['산업', '인프라', '복지'] as const;
export type Facility = (typeof FACILITIES)[number];
export const FACILITY_TEXT: Record<Facility, string> = {
  산업: '국방예산과 자원이 더 많이 쌓임',
  인프라: '육·해·공 부대 모집이 빨라짐',
  복지: '병력이 늘고, 덜 줄고, 점령지가 조용해짐',
};

/** 내정 시설 9개(분야마다 3개). 단계 1~5 */
export const BUILDINGS = [
  { id: '군수공장', fac: '산업', icon: '🏭', does: '국방예산 수입', unit: '예산' },
  { id: '제련소', fac: '산업', icon: '🔥', does: '강철·알루미늄·티타늄·구리 생산', unit: '금속' },
  { id: '첨단공단', fac: '산업', icon: '🔬', does: '석유·희토류·리튬·반도체·우라늄 생산', unit: '첨단' },
  { id: '철도망', fac: '인프라', icon: '🚆', does: '육군 모집 속도', unit: '육군' },
  { id: '군항', fac: '인프라', icon: '⚓', does: '해군 모집 속도', unit: '해군' },
  { id: '공군기지', fac: '인프라', icon: '🛫', does: '공군 모집 속도', unit: '공군' },
  { id: '징병소', fac: '복지', icon: '📝', does: '병력 증가', unit: '모병' },
  { id: '군병원', fac: '복지', icon: '🏥', does: '병력 줄어듦 감소', unit: '감소' },
  { id: '치안청', fac: '복지', icon: '🚓', does: '점령지 반란 감소', unit: '반란' },
] as const;
export type BuildingId = (typeof BUILDINGS)[number]['id'];
export const BUILDING_IDS = BUILDINGS.map((b) => b.id) as BuildingId[];
export const buildingInfo = (id: BuildingId) => BUILDINGS.find((b) => b.id === id)!;
/** 금속 자원은 제련소, 나머지는 첨단공단 */
export const RES_BUILDING: Partial<Record<Res, BuildingId>> = {
  강철: '제련소', 알루미늄: '제련소', 티타늄: '제련소', 구리: '제련소',
  석유: '첨단공단', 희토류: '첨단공단', 리튬: '첨단공단', 반도체: '첨단공단', 우라늄: '첨단공단', 복합소재: '첨단공단',
};
/** 복합소재: 다 지은 공업 구역 1곳마다 실제 1시간에 이만큼(재료 알루미늄 2 + 석유 1씩). 켜고 끌 수 있음 */
export const COMPOSITE_PER_INDUSTRY = 1;
export const COMPOSITE_INPUT: Partial<Stock> = { 알루미늄: 2, 석유: 1 };

/** 단계(1~5)마다 효과 */
export const FACILITY_EFF = [0, 0.15, 0.35, 0.6, 1.0];
/** 시설을 다음 단계로 올리는 데 필요한 분야 경험치·예산·시간(인덱스 = 지금 단계) */
export const UPGRADE_EXP = [0, 60, 150, 300, 600];
export const UPGRADE_MONEY = [0, 2000, 5000, 12000, 25000];
export const UPGRADE_HOURS = [0, 1, 3, 6, 10];
/** 지도자 등급마다 올릴 수 있는 최고 단계: 1등급 2단계 … */
export const buildingMaxLevel = (rank: number) => Math.min(5, 2 + Math.floor(rank / 3));
/** 분야 경험치: 가만히 있어도 실제 1시간에 이만큼 */
export const PASSIVE_EXP_PER_HOUR = 2;
/** 내정 업무 1개: 실제 1시간, 분야 경험치 + 그 시설 특별 가동(버프) */
export const CHORE_HOURS = 1;
export const CHORE_EXP = 30;
export const BUFF_HOURS = 6;
export const BUFF_EFF = 0.2;
export const CHORES: Record<BuildingId, string> = {
  군수공장: '방산 수출 계약 협상',
  제련소: '용광로 증설 독려',
  첨단공단: '연구소 인재 영입',
  철도망: '군용 철도 보수',
  군항: '부두 확장 회의',
  공군기지: '활주로 정비',
  징병소: '모병 홍보 순회',
  군병원: '부상병 병원 방문',
  치안청: '점령지 순찰 강화',
};

/** 지도 위 대전투 한 번에 드는 연료(석유)·탄약(구리). 모자라면 그만큼 적게 채우고 출발 */
export const FIELD_FUEL_COST = 6;
export const FIELD_AMMO_COST = 4;

/** 점령한 도시는 자원이 절반만 남 */
export const OCCUPIED_RES = 0.5;
/** 무역: 상대 지도자 성향에 따른 값 배율 */
export const TRADE_MULT: Record<string, number> = { 경제형: 0.85, 공격형: 1.25, 방어형: 1.0, 기회주의: 1.1 };
export const ALLY_DISCOUNT = 0.9;
export const SELL_RATE = 0.7;

export const unitRank = (name: string) => UNITS.find((u) => u.name === name)?.rank ?? 0;
