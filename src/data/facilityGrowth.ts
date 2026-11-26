// 시설 단계별 성장(11-24 대장 요청 "산업·인프라·복지·과학 시설을 더 늘리고 기능도 확대, 단계별 성장")
// 1) 새 시설 16개의 효과(5단계 기준, 단계마다 NEW_FACILITY_EFF 비율만큼)
// 2) 먼저 지어야 하는 시설(앞 시설이 몇 단계가 되어야 새 시설을 지을 수 있음)
// 3) 모든 시설 31개의 3단계·5단계 보너스
// 4) 분야 성장 단계(분야 시설 단계 합으로 1~5단계, 분야 전체 보너스)
// 효과 모양은 연구·체제·카드와 같은 Eff라 계산은 game/civ.ts civEffects 한 곳에서 더함.
import type { Eff } from './civ';
import type { BuildingId, Facility } from './economy';

/** 새 시설 16개: 5단계일 때의 효과(1단계 10% … 5단계 100%) */
export const FAC_EFF: Partial<Record<BuildingId, { eff: Eff; text: string }>> = {
  반도체팹: { eff: { res: 0.12 }, text: '모든 자원 생산 +12%' },
  석유화학단지: { eff: { budget: 0.1 }, text: '나라 예산 +10%' },
  조선소: { eff: { power: { dom: '해', v: 0.08 } }, text: '해군 전투력 +8%' },
  항공우주단지: { eff: { power: { dom: '공', v: 0.08 } }, text: '공군 전투력 +8%' },
  발전소: { eff: { build: { dom: 'all', v: 0.1 } }, text: '모든 부대 모집 속도 +10%' },
  고속도로망: { eff: { district: 0.2, growth: 0.05 }, text: '구역 짓는 시간 −20% · 도시 성장 +5%' },
  국제무역항: { eff: { trade: 0.1 }, text: '무역 값 이득 10%' },
  정보통신망: { eff: { mission: 0.05, research: 0.05 }, text: '임무 성공률 +5%p · 연구 +5%' },
  공공주택단지: { eff: { growth: 0.25 }, text: '도시 성장 +25%' },
  국립대학교: { eff: { research: 0.08 }, text: '연구 +8%' },
  문화체육센터: { eff: { loyalty: 4, favor: 2 }, text: '모든 도시 민심 +4 · 모든 나라 호감 +2' },
  보훈복지관: { eff: { loyalty: 3, power: { dom: 'all', v: 0.03 } }, text: '민심 +3 · 모든 전투력 +3%' },
  기초과학연구원: { eff: { research: 0.12 }, text: '연구 +12%' },
  원자력연구원: { eff: { res: 0.06, budget: 0.05 }, text: '자원 생산 +6% · 나라 예산 +5%' },
  인공지능센터: { eff: { power: { dom: 'all', v: 0.05 }, mission: 0.03 }, text: '모든 전투력 +5% · 임무 +3%p' },
  해양과학기지: { eff: { influence: 0.25 }, text: '분쟁 지역 영향력 +25%' },
};

/** 먼저 지어야 하는 시설: 이 시설이 이 단계가 되어야 지을 수 있음 */
export const FAC_NEED: Partial<Record<BuildingId, { id: BuildingId; lv: number }>> = {
  반도체팹: { id: '첨단공단', lv: 2 },
  석유화학단지: { id: '제련소', lv: 2 },
  조선소: { id: '군항', lv: 2 },
  항공우주단지: { id: '공군기지', lv: 2 },
  고속도로망: { id: '철도망', lv: 2 },
  정보통신망: { id: '발전소', lv: 1 },
  국립대학교: { id: '공공주택단지', lv: 1 },
  보훈복지관: { id: '군병원', lv: 2 },
  기초과학연구원: { id: '국방과학연구소', lv: 1 },
  원자력연구원: { id: '기초과학연구원', lv: 1 },
  인공지능센터: { id: '기초과학연구원', lv: 2 },
  해양과학기지: { id: '군항', lv: 2 },
};

export interface Milestone {
  text: string;
  eff: Eff;
}
/** 단계 보너스: 3단계·5단계가 되면 추가 효과(모든 시설) */
export const FAC_MILESTONE: Record<BuildingId, { 3: Milestone; 5: Milestone }> = {
  군수공장: { 3: { text: '나라 예산 +3%', eff: { budget: 0.03 } }, 5: { text: '방산 수출 · 무역 이득 5%', eff: { trade: 0.05 } } },
  제련소: { 3: { text: '자원 생산 +3%', eff: { res: 0.03 } }, 5: { text: '육군 모집 +5%', eff: { build: { dom: '육', v: 0.05 } } } },
  첨단공단: { 3: { text: '연구 +3%', eff: { research: 0.03 } }, 5: { text: '자원 생산 +5%', eff: { res: 0.05 } } },
  반도체팹: { 3: { text: '연구 +3%', eff: { research: 0.03 } }, 5: { text: '모든 전투력 +2%', eff: { power: { dom: 'all', v: 0.02 } } } },
  석유화학단지: { 3: { text: '자원 생산 +3%', eff: { res: 0.03 } }, 5: { text: '정기 계약 +1칸', eff: { contracts: 1 } } },
  조선소: { 3: { text: '해군 모집 +5%', eff: { build: { dom: '해', v: 0.05 } } }, 5: { text: '분쟁 지역 영향력 +10%', eff: { influence: 0.1 } } },
  항공우주단지: { 3: { text: '공군 모집 +5%', eff: { build: { dom: '공', v: 0.05 } } }, 5: { text: '연구 +4%', eff: { research: 0.04 } } },
  철도망: { 3: { text: '구역 짓기 −5%', eff: { district: 0.05 } }, 5: { text: '육군 전투력 +3%', eff: { power: { dom: '육', v: 0.03 } } } },
  군항: { 3: { text: '분쟁 지역 영향력 +10%', eff: { influence: 0.1 } }, 5: { text: '해군 전투력 +3%', eff: { power: { dom: '해', v: 0.03 } } } },
  공군기지: { 3: { text: '공군 모집 +5%', eff: { build: { dom: '공', v: 0.05 } } }, 5: { text: '공군 전투력 +3%', eff: { power: { dom: '공', v: 0.03 } } } },
  발전소: { 3: { text: '자원 생산 +3%', eff: { res: 0.03 } }, 5: { text: '도시 성장 +10%', eff: { growth: 0.1 } } },
  고속도로망: { 3: { text: '민심 +1', eff: { loyalty: 1 } }, 5: { text: '육군 모집 +5%', eff: { build: { dom: '육', v: 0.05 } } } },
  국제무역항: { 3: { text: '정기 계약 +1칸', eff: { contracts: 1 } }, 5: { text: '모든 나라 호감 +3', eff: { favor: 3 } } },
  정보통신망: { 3: { text: '모든 나라 호감 +1', eff: { favor: 1 } }, 5: { text: '모든 전투력 +2%', eff: { power: { dom: 'all', v: 0.02 } } } },
  징병소: { 3: { text: '도시 성장 +5%', eff: { growth: 0.05 } }, 5: { text: '모든 전투력 +2%', eff: { power: { dom: 'all', v: 0.02 } } } },
  군병원: { 3: { text: '민심 +1', eff: { loyalty: 1 } }, 5: { text: '민심 +2', eff: { loyalty: 2 } } },
  치안청: { 3: { text: '민심 +1', eff: { loyalty: 1 } }, 5: { text: '임무 +3%p', eff: { mission: 0.03 } } },
  공공주택단지: { 3: { text: '민심 +1', eff: { loyalty: 1 } }, 5: { text: '구역 짓기 −10%', eff: { district: 0.1 } } },
  국립대학교: { 3: { text: '임무 +2%p', eff: { mission: 0.02 } }, 5: { text: '연구 +5%', eff: { research: 0.05 } } },
  문화체육센터: { 3: { text: '모든 나라 호감 +2', eff: { favor: 2 } }, 5: { text: '국제 회의 표 +1', eff: { votes: 1 } } },
  보훈복지관: { 3: { text: '민심 +1', eff: { loyalty: 1 } }, 5: { text: '육군 전투력 +3%', eff: { power: { dom: '육', v: 0.03 } } } },
  국방과학연구소: { 3: { text: '연구 +3%', eff: { research: 0.03 } }, 5: { text: '모든 전투력 +2%', eff: { power: { dom: 'all', v: 0.02 } } } },
  정보본부: { 3: { text: '모든 나라 호감 +2', eff: { favor: 2 } }, 5: { text: '국제 회의 표 +1', eff: { votes: 1 } } },
  우주기지: { 3: { text: '연구 +3%', eff: { research: 0.03 } }, 5: { text: '분쟁 지역 영향력 +15%', eff: { influence: 0.15 } } },
  기초과학연구원: { 3: { text: '도시 성장 +5%', eff: { growth: 0.05 } }, 5: { text: '연구 +5%', eff: { research: 0.05 } } },
  원자력연구원: { 3: { text: '모든 부대 모집 +3%', eff: { build: { dom: 'all', v: 0.03 } } }, 5: { text: '모든 전투력 +3%', eff: { power: { dom: 'all', v: 0.03 } } } },
  인공지능센터: { 3: { text: '연구 +4%', eff: { research: 0.04 } }, 5: { text: '임무 +4%p', eff: { mission: 0.04 } } },
  해양과학기지: { 3: { text: '자원 생산 +3%', eff: { res: 0.03 } }, 5: { text: '해군 전투력 +3%', eff: { power: { dom: '해', v: 0.03 } } } },
  방공포대: { 3: { text: '민심 +1', eff: { loyalty: 1 } }, 5: { text: '모든 전투력 +2%', eff: { power: { dom: 'all', v: 0.02 } } } },
  훈련소: { 3: { text: '육군 전투력 +2%', eff: { power: { dom: '육', v: 0.02 } } }, 5: { text: '모든 전투력 +2%', eff: { power: { dom: 'all', v: 0.02 } } } },
  비축창고: { 3: { text: '자원 생산 +2%', eff: { res: 0.02 } }, 5: { text: '나라 예산 +3%', eff: { budget: 0.03 } } },
};

/** 분야 성장 단계: 분야 시설 단계 합 ÷ (시설 수 × 5)이 20%·40%·60%·80%·100%를 넘으면 1~5단계 */
export const FIELD_TIER_AT = [0.2, 0.4, 0.6, 0.8, 1.0];
export const FIELD_TIER_NAME = ['시작', '기초', '성장', '발전', '선진', '세계 최고'];
/** 분야 성장 1단계마다 분야 전체 보너스 */
export const FIELD_TIER_EFF: Record<Facility, { eff: Eff; text: string }> = {
  산업: { eff: { budget: 0.02 }, text: '나라 예산 +2%' },
  인프라: { eff: { build: { dom: 'all', v: 0.02 } }, text: '모든 부대 모집 +2%' },
  복지: { eff: { loyalty: 1 }, text: '모든 도시 민심 +1' },
  과학: { eff: { research: 0.03 }, text: '연구 +3%' },
  국방: { eff: { power: { dom: 'all', v: 0.01 } }, text: '모든 전투력 +1%' },
};

/** Eff에 비율 곱하기(숫자는 곱하고, 칸 수·표처럼 정수인 것은 5단계에서만) */
export function scaleEff(e: Eff, k: number): Eff {
  const o: Eff = {};
  for (const [key, v] of Object.entries(e) as [keyof Eff, Eff[keyof Eff]][]) {
    if (typeof v === 'number') (o as Record<string, number>)[key] = key === 'contracts' || key === 'votes' ? (k >= 1 ? v : 0) : v * k;
    else if (v) (o as Record<string, unknown>)[key] = { dom: v.dom, v: v.v * k };
  }
  return o;
}

const r1 = (x: number) => Math.round(x * 10) / 10;
const DOM_NAME = { all: '모든', 육: '육군', 해: '해군', 공: '공군' } as const;
/** 효과를 쉬운 말로("모든 자원 생산 +1.2% · 연구 +3%") */
export function describeEff(e: Eff): string {
  const p: string[] = [];
  if (e.res) p.push(`자원 생산 +${r1(e.res * 100)}%`);
  if (e.budget) p.push(`나라 예산 +${r1(e.budget * 100)}%`);
  if (e.research) p.push(`연구 +${r1(e.research * 100)}%`);
  if (e.power) p.push(`${DOM_NAME[e.power.dom]} 전투력 +${r1(e.power.v * 100)}%`);
  if (e.build) p.push(`${DOM_NAME[e.build.dom]} 모집 +${r1(e.build.v * 100)}%`);
  if (e.district) p.push(`구역 짓기 −${r1(e.district * 100)}%`);
  if (e.growth) p.push(`도시 성장 +${r1(e.growth * 100)}%`);
  if (e.trade) p.push(`무역 이득 ${r1(e.trade * 100)}%`);
  if (e.mission) p.push(`임무 +${r1(e.mission * 100)}%p`);
  if (e.influence) p.push(`분쟁 지역 영향력 +${r1(e.influence * 100)}%`);
  if (e.loyalty) p.push(`민심 +${r1(e.loyalty)}`);
  if (e.favor) p.push(`호감 +${r1(e.favor)}`);
  if (e.contracts) p.push(`계약 +${e.contracts}칸`);
  if (e.votes) p.push(`회의 표 +${e.votes}`);
  return p.join(' · ');
}
