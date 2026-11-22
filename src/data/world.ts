// 세계 데이터: 가상 대륙 5개, 나라 13개, 시작 구도.
// 숫자는 기획서 v2(2026-11-21)의 "나라와 거점 도시" 표를 그대로 옮긴 초안이다.
// 지도 좌표는 기획서의 대략 그림(가로 760 × 세로 572)과 같은 좌표계를 쓴다.

export type ContinentId = 'eurona' | 'norga' | 'sahar' | 'asien' | 'amern';
export type BlocId = 'pacific' | 'continental' | 'europe' | 'independent';
export type FaithId = 'covenant' | 'blade' | 'polaris' | 'pantheon' | 'secular';
export type Difficulty = '쉬움' | '보통' | '어려움' | '매우 어려움';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Continent {
  id: ContinentId;
  name: string;
  /** 바다 위 대륙 판(둥근 네모). 아시엔은 본토 + 섬 두 판 */
  shapes: Rect[];
  label: { x: number; y: number };
}

export interface Country {
  id: string;
  name: string;
  continent: ContinentId;
  /** 거점 도시. 첫 번째가 수도 */
  cities: string[];
  /** 실제 자료(십억 달러). 자료 없으면 null */
  gdp2025: number | null;
  milSpend2025: number | null;
  gfpRank2026: number;
  /** 게임 시작 수치(미국 = 100) */
  economy: number;
  budget: number;
  military: number;
  estimated: boolean;
  difficulty: Difficulty;
  bloc: BlocId;
  /** 신앙: 많이 믿는 신앙과 세기 */
  faith: FaithId;
  faithStrength: '강' | '중' | '약';
  specialUnit: { name: string; base: string; effect: string };
  ability: { name: string; effect: string };
  /** 지도 위 땅 모양 */
  shapes: Rect[];
  label: { x: number; y: number };
}

export const MAP_SIZE = { w: 760, h: 470 };

export const CONTINENTS: Continent[] = [
  {
    id: 'eurona',
    name: '유로나 대륙',
    shapes: [
      { x: 64, y: 118, w: 142, h: 176 },
      { x: 20, y: 126, w: 42, h: 56 }, // 섬(영국)
    ],
    label: { x: 76, y: 138 },
  },
  { id: 'norga', name: '노르가 대륙', shapes: [{ x: 202, y: 58, w: 406, h: 112 }], label: { x: 220, y: 78 } },
  { id: 'sahar', name: '사하르 대륙', shapes: [{ x: 114, y: 300, w: 180, h: 142 }], label: { x: 124, y: 320 } },
  {
    id: 'asien',
    name: '아시엔 대륙',
    shapes: [
      { x: 300, y: 186, w: 250, h: 270 },
      { x: 536, y: 198, w: 66, h: 72 },
    ],
    label: { x: 312, y: 206 },
  },
  { id: 'amern', name: '아메른 대륙', shapes: [{ x: 640, y: 150, w: 108, h: 242 }], label: { x: 650, y: 170 } },
];

export const BLOCS: Record<BlocId, { name: string; color: string }> = {
  pacific: { name: '태평양 연합', color: '#3b82f6' },
  continental: { name: '대륙 협약', color: '#ef4444' },
  europe: { name: '유럽 연합', color: '#22c55e' },
  independent: { name: '독자 세력', color: '#a3a3a3' },
};

export const FAITHS: Record<FaithId, { name: string; trait: string }> = {
  covenant: { name: '빛의 언약', trait: '성지를 지키는 것이 가장 큰 사명' },
  blade: { name: '성검 교단', trait: '성지를 되찾는 것이 사명 · 신앙 지도자가 나라를 이끔' },
  polaris: { name: '북극성 정교', trait: '같은 신앙이지만 정통을 두고 갈라져 싸움' },
  pantheon: { name: '만신 전통', trait: '여러 신을 모시는 넓은 신앙 · 다른 신앙과 덜 부딪힘' },
  secular: { name: '세속', trait: '신앙 사건 영향이 적고 이념·자원으로 싸움' },
};

/** 가상 성지 "고대 성도" (사하르 대륙 한가운데) */
export const HOLY_CITY = { name: '고대 성도', x: 184, y: 345 };

export const COUNTRIES: Country[] = [
  {
    id: 'us', name: '미국', continent: 'amern',
    cities: ['워싱턴', '뉴욕', '로스앤젤레스', '호놀룰루'],
    gdp2025: 30861, milSpend2025: 954, gfpRank2026: 1,
    economy: 100, budget: 100, military: 100, estimated: false, difficulty: '쉬움',
    bloc: 'pacific', faith: 'covenant', faithStrength: '중',
    specialUnit: { name: '항모 타격단', base: '항공모함', effect: '함재기 출격 2배 · 호위함 보호막' },
    ability: { name: '전력 투사', effect: '먼 전선 보급 손실 −30% · 다른 대륙에 기지 건설 가능' },
    shapes: [{ x: 652, y: 182, w: 84, h: 142 }, { x: 688, y: 418, w: 12, h: 12 }],
    label: { x: 694, y: 258 },
  },
  {
    id: 'cn', name: '중국', continent: 'asien',
    cities: ['베이징', '상하이', '광저우', '선전'],
    gdp2025: 19626, milSpend2025: 336, gfpRank2026: 3,
    economy: 80, budget: 59, military: 80, estimated: false, difficulty: '쉬움',
    bloc: 'continental', faith: 'secular', faithStrength: '약',
    specialUnit: { name: '대규모 동원 사단', base: '보병', effect: '병력 1.5배 · 쓰러져도 빨리 채워짐' },
    ability: { name: '제조 대국', effect: '모든 생산 시간 −20%' },
    shapes: [{ x: 356, y: 214, w: 176, h: 108 }],
    label: { x: 444, y: 272 },
  },
  {
    id: 'ru', name: '러시아', continent: 'norga',
    cities: ['모스크바', '상트페테르부르크', '블라디보스토크'],
    gdp2025: 2572, milSpend2025: 190, gfpRank2026: 2,
    economy: 29, budget: 45, military: 94, estimated: false, difficulty: '쉬움',
    bloc: 'continental', faith: 'polaris', faithStrength: '중',
    specialUnit: { name: '전략 미사일 여단', base: '미사일', effect: '사거리 +50% · 방공 뚫기 +20%' },
    ability: { name: '동장군', effect: '자기 땅 방어 때 적 이동·보급 −25%' },
    shapes: [{ x: 214, y: 90, w: 384, h: 68 }],
    label: { x: 406, y: 130 },
  },
  {
    id: 'de', name: '독일', continent: 'eurona',
    cities: ['베를린', '함부르크', '뮌헨'],
    gdp2025: 5116, milSpend2025: 114, gfpRank2026: 12,
    economy: 41, budget: 35, military: 30, estimated: false, difficulty: '보통',
    bloc: 'europe', faith: 'secular', faithStrength: '약',
    specialUnit: { name: '기갑 군단', base: '전차', effect: '장갑 +20% · 돌파 후 추격' },
    ability: { name: '공업력', effect: '강철 생산 +30% · 수리 빠름' },
    shapes: [{ x: 78, y: 150, w: 62, h: 60 }],
    label: { x: 109, y: 184 },
  },
  {
    id: 'jp', name: '일본', continent: 'asien',
    cities: ['도쿄', '오사카', '요코스카', '후쿠오카'],
    gdp2025: 4453, milSpend2025: 62, gfpRank2026: 7,
    economy: 38, budget: 26, military: 39, estimated: false, difficulty: '보통',
    bloc: 'pacific', faith: 'secular', faithStrength: '약',
    specialUnit: { name: '이지스 함대', base: '구축함', effect: '미사일 요격 +40%' },
    ability: { name: '기술 정밀', effect: '연구 속도 +25%' },
    shapes: [{ x: 616, y: 204, w: 10, h: 42 }, { x: 620, y: 252, w: 10, h: 46 }],
    label: { x: 626, y: 316 },
  },
  {
    id: 'uk', name: '영국', continent: 'eurona',
    cities: ['런던', '포츠머스', '에든버러'],
    gdp2025: 4012, milSpend2025: 89, gfpRank2026: 8,
    economy: 36, budget: 31, military: 39, estimated: false, difficulty: '보통',
    bloc: 'europe', faith: 'secular', faithStrength: '약',
    specialUnit: { name: '특수공정대', base: '특수부대', effect: '잠입 성공 +30% · 기습 피해 2배' },
    ability: { name: '정보 강국', effect: '정보 점수 +30% · 잠수함 은밀 +' },
    shapes: [{ x: 26, y: 132, w: 30, h: 44 }],
    label: { x: 41, y: 196 },
  },
  {
    id: 'in', name: '인도', continent: 'asien',
    cities: ['뉴델리', '뭄바이', '벵갈루루'],
    gdp2025: 3909, milSpend2025: 92, gfpRank2026: 4,
    economy: 36, budget: 31, military: 55, estimated: false, difficulty: '보통',
    bloc: 'independent', faith: 'pantheon', faithStrength: '중',
    specialUnit: { name: '산악 보병 사단', base: '보병', effect: '산·고지 전투 +30%' },
    ability: { name: '인구 저력', effect: '병력 회복 +40%' },
    shapes: [{ x: 326, y: 334, w: 96, h: 108 }],
    label: { x: 374, y: 392 },
  },
  {
    id: 'kr', name: '한국', continent: 'asien',
    cities: ['서울', '부산', '인천', '대전'],
    gdp2025: 1882, milSpend2025: 48, gfpRank2026: 5,
    economy: 25, budget: 22, military: 45, estimated: false, difficulty: '어려움',
    bloc: 'pacific', faith: 'secular', faithStrength: '약',
    specialUnit: { name: '자주포 포병대', base: '포병', effect: '쏘고 바로 이동 · 정확도 +30%' },
    ability: { name: '방산 수출', effect: '무기를 팔아 국방예산 + · 연합국 생산 도움' },
    shapes: [{ x: 548, y: 236, w: 22, h: 26 }],
    label: { x: 578, y: 253 },
  },
  {
    id: 'tr', name: '튀르키예', continent: 'eurona',
    cities: ['앙카라', '이스탄불', '이즈미르'],
    gdp2025: 1603, milSpend2025: 30, gfpRank2026: 9,
    economy: 23, budget: 18, military: 37, estimated: false, difficulty: '어려움',
    bloc: 'independent', faith: 'blade', faithStrength: '중',
    specialUnit: { name: '무인기 비행대', base: '무인드론', effect: '드론 비용 −40% · 동시 출격 +' },
    ability: { name: '해협 통제', effect: '유로나↔사하르 바닷길 막기 · 통행 수익' },
    shapes: [{ x: 146, y: 262, w: 96, h: 32 }],
    label: { x: 194, y: 282 },
  },
  {
    id: 'il', name: '이스라엘', continent: 'sahar',
    cities: ['텔아비브', '하이파', '베에르셰바'],
    gdp2025: 617, milSpend2025: 48, gfpRank2026: 15,
    economy: 14, budget: 22, military: 27, estimated: false, difficulty: '어려움',
    bloc: 'pacific', faith: 'covenant', faithStrength: '강',
    specialUnit: { name: '다층 방공망', base: '방공부대', effect: '미사일·로켓·드론 요격 +50%' },
    ability: { name: '예비군 결속', effect: '예비군 동원이 즉시 · 작은 나라지만 병력 +40%' },
    shapes: [{ x: 146, y: 334, w: 14, h: 28 }],
    label: { x: 153, y: 378 },
  },
  {
    id: 'ir', name: '이란', continent: 'sahar',
    cities: ['테헤란', '이스파한', '반다르아바스', '마슈하드'],
    gdp2025: null, milSpend2025: 7.4, gfpRank2026: 16,
    economy: 15, budget: 9, military: 23, estimated: true, difficulty: '어려움',
    bloc: 'continental', faith: 'blade', faithStrength: '강',
    specialUnit: { name: '고속정 떼 함대', base: '구축함', effect: '싸고 많은 고속정 · 큰 함선 상대 +30%' },
    ability: { name: '해협 봉쇄', effect: '사하르 남쪽 바닷길을 막아 적 석유 수입 −30% · 대리 세력 지원' },
    shapes: [{ x: 214, y: 318, w: 78, h: 78 }],
    label: { x: 253, y: 361 },
  },
  {
    id: 'ua', name: '우크라이나', continent: 'eurona',
    cities: ['키우', '하르키우', '오데사', '르비우'],
    gdp2025: null, milSpend2025: 84, gfpRank2026: 20,
    economy: 10, budget: 30, military: 20, estimated: true, difficulty: '매우 어려움',
    bloc: 'europe', faith: 'polaris', faithStrength: '중',
    specialUnit: { name: '해상 드론 부대', base: '무인드론', effect: '바다 위 드론으로 함선 공격 · 해군 없이도 바다 막기' },
    ability: { name: '국토 방위 의지', effect: '자기 땅 방어 때 피해 −20% · 사기 안 떨어짐 · 연합 원조 2배' },
    shapes: [{ x: 146, y: 150, w: 58, h: 56 }],
    label: { x: 175, y: 182 },
  },
  {
    id: 'kp', name: '북한', continent: 'asien',
    cities: ['평양', '남포', '원산', '신의주'],
    gdp2025: null, milSpend2025: null, gfpRank2026: 31,
    economy: 3, budget: 10, military: 12, estimated: true, difficulty: '매우 어려움',
    bloc: 'continental', faith: 'secular', faithStrength: '약',
    specialUnit: { name: '특수작전군', base: '특수부대', effect: '땅굴 침투 · 적 후방 도시 기습' },
    ability: { name: '선군 체제', effect: '국방비 비율 상한 높음 · 병력 +50% · 대신 경제 성장 −50% · 석유 부족' },
    shapes: [{ x: 546, y: 206, w: 26, h: 26 }],
    label: { x: 578, y: 223 },
  },
];

export type Relation = '전쟁' | '휴전' | '연합' | '중립';

/** 시작 구도에서 따로 정한 나라 쌍. 나머지는 묶음으로 정한다. */
const SPECIAL_RELATIONS: Array<[string, string, Relation]> = [
  ['ir', 'il', '휴전'], // 성지 분쟁. 자주 깨짐
  ['in', 'cn', '휴전'], // 국경 휴전. 자주 깨짐
  ['ua', 'ru', '전쟁'], // 세계 최대 격전지
];

export function startingRelation(a: string, b: string): Relation {
  if (a === b) return '연합';
  for (const [x, y, r] of SPECIAL_RELATIONS) {
    if ((x === a && y === b) || (x === b && y === a)) return r;
  }
  const ca = countryById(a);
  const cb = countryById(b);
  if (ca.bloc === cb.bloc && ca.bloc !== 'independent') return '연합';
  const pair = [ca.bloc, cb.bloc].sort().join('-');
  if (pair === 'continental-pacific') return '전쟁';
  return '중립';
}

/** 지도에 그리는 전선(기획서 그림 그대로) */
export const FRONTS: Array<{ x1: number; y1: number; x2: number; y2: number; kind: '전쟁' | '휴전'; name: string }> = [
  { x1: 209, y1: 146, x2: 209, y2: 210, kind: '전쟁', name: '러시아–우크라이나 전선' },
  { x1: 540, y1: 234, x2: 576, y2: 234, kind: '전쟁', name: '한반도 휴전선 전선' },
  { x1: 608, y1: 196, x2: 608, y2: 330, kind: '전쟁', name: '동방 바다 전선' },
  { x1: 204, y1: 322, x2: 204, y2: 392, kind: '휴전', name: '이란–이스라엘 휴전선' },
  { x1: 340, y1: 328, x2: 420, y2: 328, kind: '휴전', name: '중국–인도 휴전선' },
];

const byId = new Map(COUNTRIES.map((c) => [c.id, c]));
export function countryById(id: string): Country {
  const c = byId.get(id);
  if (!c) throw new Error(`없는 나라: ${id}`);
  return c;
}
