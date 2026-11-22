// 6단계 내정 데이터: 전략 자원 7종 · 도시마다 나는 자원 · 병과 생산 비용 · 내정 시설 3개.
// 숫자는 시험판용(7단계에서 맞춤). 실제 1시간 = 게임 하루.
import { UNITS } from './catalog';

export const RESOURCES = ['강철', '석유', '알루미늄', '티타늄', '희토류', '리튬', '반도체'] as const;
export type Res = (typeof RESOURCES)[number];
export const RES_ICON: Record<Res, string> = { 강철: '🔩', 석유: '🛢️', 알루미늄: '🥫', 티타늄: '💠', 희토류: '🪨', 리튬: '🔋', 반도체: '💾' };
/** 자원 설명 */
export const RES_DESC: Record<Res, string> = {
  강철: '배·전차·대포의 뼈대. 가장 많이 쓰는 기본 금속',
  석유: '전차·비행기·배를 움직이는 연료',
  알루미늄: '가볍고 단단해 비행기·드론 몸체에 씀',
  티타늄: '열과 충격에 강한 고급 금속. 전투기·폭격기·미사일',
  희토류: '레이더·유도장치에 드는 귀한 광물',
  리튬: '전지 재료. 드론·잠수함 동력',
  반도체: '모든 첨단 무기의 두뇌. 가장 비쌈',
};
/** 무역 기본 값(1개) */
export const RES_PRICE: Record<Res, number> = { 강철: 40, 석유: 60, 알루미늄: 50, 티타늄: 120, 희토류: 150, 리튬: 110, 반도체: 200 };
export type Stock = Record<Res, number>;
export const emptyStock = (): Stock => Object.fromEntries(RESOURCES.map((r) => [r, 0])) as Stock;

/** 도시 이름 → 하루(실제 1시간)에 나는 자원. 실제 산업 특징을 조금 반영 */
export const CITY_RES: Record<string, Partial<Stock>> = {
  스타포트: { 석유: 2 }, 노바헤이븐: { 알루미늄: 2 }, 실버베이: { 리튬: 1, 반도체: 1 }, 코랄섬: { 석유: 1 },
  이글록: { 티타늄: 1 }, 썬더캐년: { 희토류: 1 }, 프론티어시: { 강철: 2 }, 레드메사: { 석유: 1, 리튬: 1 },
  용린성: { 희토류: 2 }, 비취항: { 강철: 3 }, 홍등시: { 알루미늄: 2 }, 운해진: { 반도체: 2 },
  금룡시: { 희토류: 1 }, 청하진: { 강철: 1 }, 옥문관: { 티타늄: 1 }, 남풍포: { 석유: 1 },
  빙관성: { 티타늄: 2 }, 백야항: { 강철: 2 }, 서리봉: { 석유: 3 },
  오로라시: { 리튬: 1 }, 설원진: { 강철: 1 }, 툰드라항: { 석유: 2 }, 얼음송곳: { 티타늄: 1 }, 북극성채: { 희토류: 1 }, 백곰만: { 알루미늄: 1 }, 눈보라령: { 강철: 1 },
  철각성: { 반도체: 1 }, 용광시: { 강철: 2 },
  벚꽃궁: { 반도체: 2 }, 달빛항: { 강철: 2 },
  안개항: { 반도체: 1 }, 회색탑: { 강철: 1 },
  금빛성: { 희토류: 1 }, 태양평야: { 강철: 2 }, 연꽃항: { 반도체: 1, 티타늄: 1 }, 코끼리강: { 알루미늄: 1 }, 향신료시: { 리튬: 1 },
  한빛: { 반도체: 2 }, 별가람: { 반도체: 1, 리튬: 1 },
  쌍해협성: { 티타늄: 1 }, 바람시장: { 강철: 2 }, 초승항: { 알루미늄: 1 },
  별방패성: { 반도체: 2 }, 수정항: { 알루미늄: 1 },
  붉은모래성: { 석유: 2 }, 신탁시: { 강철: 1, 티타늄: 1 }, 모래항: { 석유: 3 }, 오아시스진: { 희토류: 1 },
  푸른들성: { 티타늄: 1 }, 밀밭시: { 강철: 2 }, 해바라기항: { 석유: 1 },
  흑철성: { 희토류: 2 }, 동굴항: { 강철: 1 },
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

/** 병과 15개 생산 비용(1부대) */
export const UNIT_COST: Record<string, UnitCost> = {
  보병: { money: 300, res: { 강철: 1 }, hours: 1, power: 2, troops: 2000 },
  특수부대: { money: 600, res: { 강철: 1, 반도체: 1 }, hours: 2, power: 4, troops: 300 },
  기갑병: { money: 700, res: { 강철: 3, 석유: 1 }, hours: 2, power: 5, troops: 800 },
  무인드론: { money: 400, res: { 알루미늄: 1, 리튬: 1, 반도체: 1 }, hours: 1, power: 4, troops: 0 },
  해킹부대: { money: 800, res: { 반도체: 3 }, hours: 2, power: 5, troops: 100 },
  전차: { money: 1200, res: { 강철: 5, 석유: 2 }, hours: 3, power: 9, troops: 400 },
  포병: { money: 1000, res: { 강철: 4, 석유: 1 }, hours: 3, power: 8, troops: 500 },
  방공부대: { money: 1300, res: { 강철: 2, 반도체: 2, 희토류: 1 }, hours: 3, power: 8, troops: 400 },
  공격헬기: { money: 1800, res: { 알루미늄: 3, 티타늄: 1, 석유: 2 }, hours: 4, power: 12, troops: 100 },
  전투기: { money: 3000, res: { 알루미늄: 4, 티타늄: 3, 반도체: 2, 석유: 2 }, hours: 6, power: 20, troops: 100 },
  구축함: { money: 3500, res: { 강철: 10, 석유: 4, 반도체: 2 }, hours: 8, power: 22, troops: 300 },
  폭격기: { money: 4500, res: { 알루미늄: 6, 티타늄: 4, 석유: 4 }, hours: 8, power: 28, troops: 100 },
  잠수함: { money: 4500, res: { 강철: 10, 리튬: 4, 반도체: 3 }, hours: 10, power: 28, troops: 150 },
  미사일: { money: 2500, res: { 티타늄: 2, 희토류: 3, 반도체: 3 }, hours: 4, power: 18, troops: 0 },
  항공모함: { money: 12000, res: { 강철: 30, 석유: 10, 반도체: 6, 티타늄: 4 }, hours: 24, power: 70, troops: 2000 },
};

/** 나라 특별 병과 = 기본 병과보다 비싸고 강함 */
export function specialCost(base: string): UnitCost {
  const b = UNIT_COST[base];
  const res: Partial<Stock> = {};
  for (const [k, v] of Object.entries(b.res)) res[k as Res] = Math.ceil(v! * 1.5);
  return { money: Math.round(b.money * 1.5), res, hours: Math.ceil(b.hours * 1.3), power: Math.round(b.power * 1.7), troops: Math.round(b.troops * 1.2) };
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
  { id: '제련소', fac: '산업', icon: '🔥', does: '강철·알루미늄·티타늄 생산', unit: '금속' },
  { id: '첨단공단', fac: '산업', icon: '🔬', does: '석유·희토류·리튬·반도체 생산', unit: '첨단' },
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
export const RES_BUILDING: Record<Res, BuildingId> = { 강철: '제련소', 알루미늄: '제련소', 티타늄: '제련소', 석유: '첨단공단', 희토류: '첨단공단', 리튬: '첨단공단', 반도체: '첨단공단' };

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

/** 점령한 도시는 자원이 절반만 남 */
export const OCCUPIED_RES = 0.5;
/** 무역: 상대 지도자 성향에 따른 값 배율 */
export const TRADE_MULT: Record<string, number> = { 경제형: 0.85, 공격형: 1.25, 방어형: 1.0, 기회주의: 1.1 };
export const ALLY_DISCOUNT = 0.9;
export const SELL_RATE = 0.7;

export const unitRank = (name: string) => UNITS.find((u) => u.name === name)?.rank ?? 0;
