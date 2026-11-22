// 6단계 내정 데이터: 전략 자원 7종 · 도시마다 나는 자원 · 병과 생산 비용 · 내정 시설 3개.
// 숫자는 시험판용(7단계에서 맞춤). 실제 1시간 = 게임 하루.
import { UNITS } from './catalog';

export const RESOURCES = ['강철', '석유', '알루미늄', '티타늄', '희토류', '리튬', '반도체'] as const;
export type Res = (typeof RESOURCES)[number];
export const RES_ICON: Record<Res, string> = { 강철: '🔩', 석유: '🛢️', 알루미늄: '🥫', 티타늄: '💠', 희토류: '🪨', 리튬: '🔋', 반도체: '💾' };
/** 무역 기본 값(1개) */
export const RES_PRICE: Record<Res, number> = { 강철: 40, 석유: 60, 알루미늄: 50, 티타늄: 120, 희토류: 150, 리튬: 110, 반도체: 200 };
export type Stock = Record<Res, number>;
export const emptyStock = (): Stock => Object.fromEntries(RESOURCES.map((r) => [r, 0])) as Stock;

/** 도시 이름 → 하루(실제 1시간)에 나는 자원. 실제 산업 특징을 조금 반영 */
export const CITY_RES: Record<string, Partial<Stock>> = {
  워싱턴: { 석유: 2 }, 뉴욕: { 알루미늄: 2 }, 로스앤젤레스: { 리튬: 1, 반도체: 1 }, 호놀룰루: { 석유: 1 },
  베이징: { 희토류: 2 }, 상하이: { 강철: 3 }, 광저우: { 알루미늄: 2 }, 선전: { 반도체: 2 },
  모스크바: { 티타늄: 2 }, 상트페테르부르크: { 강철: 2 }, 블라디보스토크: { 석유: 3 },
  베를린: { 반도체: 1 }, 함부르크: { 강철: 2 }, 뮌헨: { 알루미늄: 1, 반도체: 1 },
  도쿄: { 반도체: 2 }, 오사카: { 강철: 2 }, 요코스카: { 알루미늄: 1 }, 후쿠오카: { 리튬: 1 },
  런던: { 반도체: 1 }, 포츠머스: { 강철: 1 }, 에든버러: { 석유: 2 },
  뉴델리: { 희토류: 1 }, 뭄바이: { 강철: 2 }, 벵갈루루: { 반도체: 1, 티타늄: 1 },
  서울: { 반도체: 2 }, 부산: { 강철: 2 }, 인천: { 알루미늄: 1, 석유: 1 }, 대전: { 반도체: 1, 리튬: 1 },
  앙카라: { 티타늄: 1 }, 이스탄불: { 강철: 2 }, 이즈미르: { 알루미늄: 1 },
  텔아비브: { 반도체: 2 }, 하이파: { 알루미늄: 1 }, 베에르셰바: { 리튬: 1 },
  테헤란: { 석유: 2 }, 이스파한: { 강철: 1, 티타늄: 1 }, 반다르아바스: { 석유: 3 }, 마슈하드: { 희토류: 1 },
  키우: { 티타늄: 1 }, 하르키우: { 강철: 2 }, 오데사: { 석유: 1 }, 르비우: { 리튬: 1 },
  평양: { 희토류: 2 }, 남포: { 강철: 1 }, 원산: { 석유: 1 }, 신의주: { 희토류: 1 },
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

/** 생산은 준장부터, 내정 일은 준장부터, 시설 올리기는 준장 3단계까지 · 총사령관 5단계까지 */
export const ECON_RANK = 6;
export const TOP_RANK = 10;

export const FACILITIES = ['산업', '인프라', '복지'] as const;
export type Facility = (typeof FACILITIES)[number];
export const FACILITY_TEXT: Record<Facility, string> = {
  산업: '국방예산과 자원이 더 많이 쌓임',
  인프라: '병과 생산이 빨라짐',
  복지: '모병(병력 증가)이 빨라짐',
};
/** 단계(1~5)마다 효과 */
export const FACILITY_EFF = [0, 0.15, 0.35, 0.6, 1.0];
/** 다음 단계로 올리는 데 필요한 경험치·예산·시간(인덱스 = 지금 단계) */
export const UPGRADE_EXP = [0, 100, 250, 500, 900];
export const UPGRADE_MONEY = [0, 2000, 5000, 12000, 25000];
export const UPGRADE_HOURS = [0, 2, 4, 8, 12];
/** 시설 경험치: 가만히 있어도 실제 1시간에 이만큼 */
export const PASSIVE_EXP_PER_HOUR = 2;
/** 내정 일 1개: 실제 1시간, 경험치 */
export const CHORE_HOURS = 1;
export const CHORE_EXP = 30;
export const CHORES: Record<Facility, string[]> = {
  산업: ['공장 생산 라인 점검', '수출 계약 협상', '자원 광산 시찰'],
  인프라: ['철도 보수 지시', '항만 확장 회의', '전력망 복구'],
  복지: ['군 가족 지원', '부상병 병원 방문', '징병소 개선'],
};
/** 점령한 도시는 자원이 절반만 남 */
export const OCCUPIED_RES = 0.5;
/** 무역: 상대 지도자 성향에 따른 값 배율 */
export const TRADE_MULT: Record<string, number> = { 경제형: 0.85, 공격형: 1.25, 방어형: 1.0, 기회주의: 1.1 };
export const ALLY_DISCOUNT = 0.9;
export const SELL_RATE = 0.7;

export const unitRank = (name: string) => UNITS.find((u) => u.name === name)?.rank ?? 0;
