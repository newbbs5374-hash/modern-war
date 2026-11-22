// 세계 데이터: "새 대륙 개척 시대"(11-22 대장 결정).
// 대융기(大隆起)로 바다 밑 땅이 솟아 "여명 군도"가 생겼고, 그 섬들에 신생 연방 13개가 세워졌다.
// 처음엔 모두 평화롭게 개척을 시작하지만 자원·항로 다툼으로 긴장이 쌓여 전쟁이 날 수 있다.
// 나라 id(us, kr…)는 코드 안에서만 쓰는 이름표다(실제 나라와 상관없음).

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
  /** 군도가 차지한 얕은 바다(둥근 네모) */
  shapes: Rect[];
  label: { x: number; y: number };
}

export interface Country {
  id: string;
  name: string;
  continent: ContinentId;
  /** 거점 도시. 첫 번째가 수도 */
  cities: string[];
  /** 한 줄 소개 */
  intro: string;
  /** 게임 시작 수치(가장 큰 나라 = 100) */
  economy: number;
  budget: number;
  military: number;
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

/** 군도 5개(코드 id는 예전 대륙 id를 그대로 씀) */
export const CONTINENTS: Continent[] = [
  { id: 'norga', name: '북빙 군도', shapes: [{ x: 186, y: 50, w: 418, h: 92 }], label: { x: 196, y: 64 } },
  { id: 'eurona', name: '서풍 군도', shapes: [{ x: 24, y: 152, w: 180, h: 146 }], label: { x: 32, y: 166 } },
  { id: 'asien', name: '중앙 대도', shapes: [{ x: 276, y: 186, w: 272, h: 222 }], label: { x: 286, y: 200 } },
  { id: 'sahar', name: '남양 군도', shapes: [{ x: 64, y: 306, w: 196, h: 156 }], label: { x: 72, y: 458 } },
  { id: 'amern', name: '동해 군도', shapes: [{ x: 596, y: 156, w: 142, h: 284 }], label: { x: 604, y: 170 } },
];

export const BLOCS: Record<BlocId, { name: string; color: string }> = {
  pacific: { name: '동해 협의체', color: '#3b82f6' },
  continental: { name: '북방 협약', color: '#ef4444' },
  europe: { name: '서풍 동맹', color: '#22c55e' },
  independent: { name: '독자 세력', color: '#a3a3a3' },
};

export const FAITHS: Record<FaithId, { name: string; trait: string }> = {
  covenant: { name: '빛의 언약', trait: '떠오른 성소를 지키는 것이 가장 큰 사명' },
  blade: { name: '성검 교단', trait: '떠오른 성소를 차지하는 것이 사명 · 신관이 나라를 이끔' },
  polaris: { name: '북극성 정교', trait: '같은 신앙이지만 정통을 두고 갈라져 다툼' },
  pantheon: { name: '만신 전통', trait: '여러 신을 모시는 넓은 신앙 · 다른 신앙과 덜 부딪힘' },
  secular: { name: '세속', trait: '신앙보다 자원·항로·이익으로 움직임' },
};

/** 대융기 때 바다에서 함께 떠오른 고대 유적 "떠오른 성소"(서풍·남양 군도 사이 해협) */
export const HOLY_CITY = { name: '떠오른 성소', x: 120, y: 330 };

const C = (o: Omit<Country, 'label'> & { label?: { x: number; y: number } }): Country => {
  const r = o.shapes[0];
  return { ...o, label: o.label ?? { x: r.x + r.w / 2, y: r.y + r.h / 2 + 4 } };
};

export const COUNTRIES: Country[] = [
  C({
    id: 'us', name: '아스트라 연방', continent: 'amern', intro: '동해 군도의 큰 섬. 가장 먼저 항구를 연 부유한 해양 연방',
    cities: ['스타포트', '노바헤이븐', '실버베이', '코랄섬'],
    economy: 100, budget: 100, military: 100, difficulty: '쉬움',
    bloc: 'pacific', faith: 'covenant', faithStrength: '중',
    specialUnit: { name: '항모 타격단', base: '항공모함', effect: '함재기 출격 2배 · 호위함 보호막' },
    ability: { name: '대양 항로', effect: '먼 바다 보급 손실 −30% · 다른 군도에 기지 건설 가능' },
    shapes: [{ x: 608, y: 172, w: 90, h: 176 }, { x: 640, y: 384, w: 40, h: 40 }],
  }),
  C({
    id: 'cn', name: '용린 공화국', continent: 'asien', intro: '중앙 대도의 넓은 땅. 사람이 많고 공장이 쉬지 않는 나라',
    cities: ['용린성', '비취항', '홍등시', '운해진'],
    economy: 80, budget: 59, military: 80, difficulty: '쉬움',
    bloc: 'continental', faith: 'secular', faithStrength: '약',
    specialUnit: { name: '대규모 동원 사단', base: '보병', effect: '병력 1.5배 · 쓰러져도 빨리 채워짐' },
    ability: { name: '거대 공장', effect: '모든 생산 시간 −20%' },
    shapes: [{ x: 298, y: 202, w: 172, h: 100 }],
  }),
  C({
    id: 'ru', name: '북빙 연합', continent: 'norga', intro: '얼음과 오로라의 북빙 군도. 춥지만 미사일 기술이 앞선 나라',
    cities: ['빙관성', '백야항', '서리봉'],
    economy: 29, budget: 45, military: 94, difficulty: '쉬움',
    bloc: 'continental', faith: 'polaris', faithStrength: '중',
    specialUnit: { name: '전략 미사일 여단', base: '미사일', effect: '사거리 +50% · 방공 뚫기 +20%' },
    ability: { name: '혹한 요새', effect: '자기 땅 방어 때 적 이동·보급 −25%' },
    shapes: [{ x: 202, y: 64, w: 220, h: 62 }, { x: 436, y: 74, w: 94, h: 52 }],
  }),
  C({
    id: 'de', name: '철각 공국', continent: 'eurona', intro: '철광 섬 위의 공국. 용광로와 기갑 공장이 자랑',
    cities: ['철각성', '용광시', '망치항'],
    economy: 41, budget: 35, military: 30, difficulty: '보통',
    bloc: 'europe', faith: 'secular', faithStrength: '약',
    specialUnit: { name: '기갑 군단', base: '전차', effect: '장갑 +20% · 돌파 후 추격' },
    ability: { name: '공업력', effect: '강철 생산 +30% · 수리 빠름' },
    shapes: [{ x: 38, y: 172, w: 72, h: 60 }],
  }),
  C({
    id: 'jp', name: '벚섬 왕국', continent: 'amern', intro: '동해 군도의 꽃이 지지 않는 긴 섬. 정밀 기술과 방패 함대의 왕국',
    cities: ['벚꽃궁', '달빛항', '꽃잎만', '등불섬'],
    economy: 38, budget: 26, military: 39, difficulty: '보통',
    bloc: 'pacific', faith: 'secular', faithStrength: '약',
    specialUnit: { name: '방패 함대', base: '구축함', effect: '미사일 요격 +40%' },
    ability: { name: '기술 정밀', effect: '연구 속도 +25%' },
    shapes: [{ x: 708, y: 176, w: 22, h: 130 }, { x: 698, y: 334, w: 32, h: 56 }],
  }),
  C({
    id: 'uk', name: '안개항 왕국', continent: 'eurona', intro: '늘 안개 낀 항구 섬. 정보원과 잠수함이 강한 오래된 왕가',
    cities: ['안개항', '회색탑', '고래만'],
    economy: 36, budget: 31, military: 39, difficulty: '보통',
    bloc: 'europe', faith: 'secular', faithStrength: '약',
    specialUnit: { name: '그림자 공정대', base: '특수부대', effect: '잠입 성공 +30% · 기습 피해 2배' },
    ability: { name: '정보 강국', effect: '정보 점수 +30% · 잠수함 은밀 +' },
    shapes: [{ x: 124, y: 164, w: 56, h: 46 }, { x: 132, y: 218, w: 30, h: 22 }],
  }),
  C({
    id: 'in', name: '금빛평원 연방', continent: 'asien', intro: '중앙 대도 남쪽의 넓은 들. 사람이 많고 산악 부대가 강함',
    cities: ['금빛성', '태양평야', '연꽃항'],
    economy: 36, budget: 31, military: 55, difficulty: '보통',
    bloc: 'independent', faith: 'pantheon', faithStrength: '중',
    specialUnit: { name: '산악 보병 사단', base: '보병', effect: '산·고지 전투 +30%' },
    ability: { name: '인구 저력', effect: '병력 회복 +40%' },
    shapes: [{ x: 290, y: 318, w: 124, h: 76 }],
  }),
  C({
    id: 'kr', name: '가람 공화국', continent: 'asien', intro: '강이 흐르는 작은 섬. 정밀한 포병과 무기 수출로 살아가는 나라',
    cities: ['한빛', '해오름', '누리포', '별가람'],
    economy: 25, budget: 22, military: 45, difficulty: '어려움',
    bloc: 'pacific', faith: 'secular', faithStrength: '약',
    specialUnit: { name: '자주포 포병대', base: '포병', effect: '쏘고 바로 이동 · 정확도 +30%' },
    ability: { name: '방산 수출', effect: '무기를 팔아 국방예산 + · 연합국 생산 도움' },
    shapes: [{ x: 486, y: 300, w: 46, h: 58 }],
  }),
  C({
    id: 'tr', name: '쌍해협 칸국', continent: 'sahar', intro: '두 바다를 잇는 해협의 칸국. 무인기와 통행세로 힘을 키움',
    cities: ['쌍해협성', '바람시장', '초승항'],
    economy: 23, budget: 18, military: 37, difficulty: '어려움',
    bloc: 'independent', faith: 'blade', faithStrength: '중',
    specialUnit: { name: '무인기 비행대', base: '무인드론', effect: '드론 비용 −40% · 동시 출격 +' },
    ability: { name: '해협 통제', effect: '서풍↔남양 바닷길 막기 · 통행 수익' },
    shapes: [{ x: 182, y: 310, w: 66, h: 44 }],
  }),
  C({
    id: 'il', name: '별방패 도시국', continent: 'sahar', intro: '성소 곁의 작은 도시 섬. 하늘을 지키는 방공망이 촘촘함',
    cities: ['별방패성', '수정항', '감시탑'],
    economy: 14, budget: 22, military: 27, difficulty: '어려움',
    bloc: 'pacific', faith: 'covenant', faithStrength: '강',
    specialUnit: { name: '다층 방공망', base: '방공부대', effect: '미사일·로켓·드론 요격 +50%' },
    ability: { name: '예비군 결속', effect: '예비군 동원이 즉시 · 작은 나라지만 병력 +40%' },
    shapes: [{ x: 78, y: 372, w: 44, h: 38 }],
  }),
  C({
    id: 'ir', name: '붉은모래 신정국', continent: 'sahar', intro: '붉은 사막 섬의 신정국. 신관이 다스리고 고속정 떼가 바다를 누빔',
    cities: ['붉은모래성', '신탁시', '모래항', '오아시스진'],
    economy: 15, budget: 9, military: 23, difficulty: '어려움',
    bloc: 'continental', faith: 'blade', faithStrength: '강',
    specialUnit: { name: '고속정 떼 함대', base: '구축함', effect: '싸고 많은 고속정 · 큰 함선 상대 +30%' },
    ability: { name: '해협 봉쇄', effect: '남양 바닷길을 막아 적 석유 수입 −30%' },
    shapes: [{ x: 142, y: 366, w: 100, h: 84 }],
  }),
  C({
    id: 'ua', name: '푸른들 자유국', continent: 'eurona', intro: '밀밭과 해바라기의 섬. 작지만 땅을 지키려는 마음이 가장 단단함',
    cities: ['푸른들성', '밀밭시', '해바라기항', '버들강'],
    economy: 10, budget: 30, military: 20, difficulty: '매우 어려움',
    bloc: 'europe', faith: 'polaris', faithStrength: '중',
    specialUnit: { name: '해상 드론 부대', base: '무인드론', effect: '바다 위 드론으로 함선 공격 · 해군 없이도 바다 막기' },
    ability: { name: '국토 방위 의지', effect: '자기 땅 방어 때 피해 −20% · 사기 안 떨어짐 · 연합 원조 2배' },
    shapes: [{ x: 38, y: 240, w: 76, h: 52 }],
  }),
  C({
    id: 'kp', name: '흑철 요새국', continent: 'norga', intro: '북빙 군도 끝 검은 바위 섬의 요새국. 땅굴과 특수부대로 버티는 폐쇄된 나라',
    cities: ['흑철성', '동굴항', '무쇠령', '철벽진'],
    economy: 3, budget: 10, military: 12, difficulty: '매우 어려움',
    bloc: 'continental', faith: 'secular', faithStrength: '약',
    specialUnit: { name: '특수작전군', base: '특수부대', effect: '땅굴 침투 · 적 후방 도시 기습' },
    ability: { name: '철벽 체제', effect: '국방비 비율 상한 높음 · 병력 +50% · 대신 경제 성장 −50%' },
    shapes: [{ x: 544, y: 66, w: 52, h: 62 }],
  }),
];

export type Relation = '전쟁' | '휴전' | '연합' | '중립';

/** 시작: 모두 평화. 같은 협약끼리는 연합, 나머지는 중립(긴장은 낮게 시작) */
export function startingRelation(a: string, b: string): Relation {
  if (a === b) return '연합';
  const ca = countryById(a);
  const cb = countryById(b);
  if (ca.bloc === cb.bloc && ca.bloc !== 'independent') return '연합';
  return '중립';
}

const byId = new Map(COUNTRIES.map((c) => [c.id, c]));
export function countryById(id: string): Country {
  const c = byId.get(id);
  if (!c) throw new Error(`없는 나라: ${id}`);
  return c;
}
