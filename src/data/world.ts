// 세계 데이터: 현실 나라 13개와 실제 도시(11-23 대장 결정으로 가상 "여명 군도"에서 되돌림).
// 가까운 미래. 처음엔 모두 평화롭지만 자원·바닷길 다툼으로 긴장이 쌓여 전쟁이 날 수 있다.
// 지도는 게임용으로 줄인 세계지도(지역 5개). 지도자는 실제 같은 가상 인물(data/leaders.ts).
// 나라 id(us, kr…)는 그림 파일 이름(leader-kr.png 등)에도 쓰므로 바꾸지 않는다.

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
  /** 지역이 차지한 얕은 바다(둥근 네모) */
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

/** 지역 5개(코드 id는 예전 대륙 id를 그대로 씀) */
export const CONTINENTS: Continent[] = [
  { id: 'norga', name: '북유라시아', shapes: [{ x: 186, y: 50, w: 418, h: 92 }], label: { x: 196, y: 64 } },
  { id: 'eurona', name: '유럽', shapes: [{ x: 24, y: 152, w: 180, h: 146 }], label: { x: 32, y: 166 } },
  { id: 'asien', name: '아시아', shapes: [{ x: 276, y: 186, w: 272, h: 222 }], label: { x: 286, y: 200 } },
  { id: 'sahar', name: '중동', shapes: [{ x: 64, y: 306, w: 196, h: 156 }], label: { x: 72, y: 458 } },
  { id: 'amern', name: '태평양', shapes: [{ x: 596, y: 156, w: 142, h: 284 }], label: { x: 604, y: 170 } },
];

export const BLOCS: Record<BlocId, { name: string; color: string }> = {
  pacific: { name: '태평양 연합', color: '#3b82f6' },
  continental: { name: '대륙 협약', color: '#ef4444' },
  europe: { name: '유럽 연합', color: '#22c55e' },
  independent: { name: '독자 세력', color: '#a3a3a3' },
};

export const FAITHS: Record<FaithId, { name: string; trait: string }> = {
  covenant: { name: '빛의 언약', trait: '고대 성지를 지키는 것이 가장 큰 사명' },
  blade: { name: '성검 교단', trait: '고대 성지를 차지하는 것이 사명 · 신관이 나라를 이끔' },
  polaris: { name: '북극성 정교', trait: '같은 신앙이지만 정통을 두고 갈라져 다툼' },
  pantheon: { name: '만신 전통', trait: '여러 신을 모시는 넓은 신앙 · 다른 신앙과 덜 부딪힘' },
  secular: { name: '세속', trait: '신앙보다 자원·항로·이익으로 움직임' },
};

/** 여러 신앙이 함께 받드는 "고대 성지"(유럽·중동 사이 해협). 어느 나라 땅도 아님 */
export const HOLY_CITY = { name: '고대 성지', x: 120, y: 330 };

const C = (o: Omit<Country, 'label'> & { label?: { x: number; y: number } }): Country => {
  const r = o.shapes[0];
  return { ...o, label: o.label ?? { x: r.x + r.w / 2, y: r.y + r.h / 2 + 4 } };
};

export const COUNTRIES: Country[] = [
  C({
    id: 'us', name: '미국', continent: 'amern', intro: '세계 최강의 해군과 항공모함을 가진 부유한 나라',
    cities: ['워싱턴', '뉴욕', '샌프란시스코', '호놀룰루', '덴버', '피닉스', '피츠버그', '휴스턴'],
    economy: 100, budget: 100, military: 100, difficulty: '쉬움',
    bloc: 'pacific', faith: 'covenant', faithStrength: '중',
    specialUnit: { name: '항모 타격단', base: '항공모함', effect: '함재기 출격 2배 · 호위함 보호막' },
    ability: { name: '대양 항로', effect: '먼 바다 보급 손실 −30% · 다른 지역에 기지 건설 가능' },
    shapes: [{ x: 880, y: 150, w: 120, h: 280 }],
  }),
  C({
    id: 'cn', name: '중국', continent: 'asien', intro: '사람이 많고 공장이 쉬지 않는 넓은 나라',
    cities: ['베이징', '톈진', '광저우', '선전', '바오터우', '우한', '란저우', '상하이'],
    economy: 80, budget: 59, military: 80, difficulty: '쉬움',
    bloc: 'continental', faith: 'secular', faithStrength: '약',
    specialUnit: { name: '대규모 동원 사단', base: '보병', effect: '병력 1.5배 · 쓰러져도 빨리 채워짐' },
    ability: { name: '거대 공장', effect: '모든 생산 시간 −20%' },
    shapes: [{ x: 440, y: 160, w: 210, h: 140 }],
  }),
  C({
    id: 'ru', name: '러시아', continent: 'norga', intro: '세계에서 가장 넓은 땅. 춥지만 미사일 기술이 앞선 나라',
    cities: ['모스크바', '상트페테르부르크', '튜멘', '무르만스크', '예카테린부르크', '아르한겔스크', '노릴스크', '야쿠츠크', '블라디보스토크', '노보시비르스크'],
    economy: 29, budget: 45, military: 94, difficulty: '쉬움',
    bloc: 'continental', faith: 'polaris', faithStrength: '중',
    specialUnit: { name: '전략 미사일 여단', base: '미사일', effect: '사거리 +50% · 방공 뚫기 +20%' },
    ability: { name: '혹한 요새', effect: '자기 땅 방어 때 적 이동·보급 −25%' },
    shapes: [{ x: 232, y: 118, w: 108, h: 112 }, { x: 330, y: 72, w: 400, h: 86 }],
  }),
  C({
    id: 'de', name: '독일', continent: 'eurona', intro: '유럽 한가운데의 공업 강국. 기갑 공장이 자랑',
    cities: ['베를린', '함부르크'],
    economy: 41, budget: 35, military: 30, difficulty: '보통',
    bloc: 'europe', faith: 'secular', faithStrength: '약',
    specialUnit: { name: '기갑 군단', base: '전차', effect: '장갑 +20% · 돌파 후 추격' },
    ability: { name: '공업력', effect: '강철 생산 +30% · 수리 빠름' },
    shapes: [{ x: 138, y: 140, w: 92, h: 86 }],
  }),
  C({
    id: 'jp', name: '일본', continent: 'amern', intro: '긴 섬나라. 정밀 기술과 이지스 함대가 강함',
    cities: ['도쿄', '후쿠오카'],
    economy: 38, budget: 26, military: 39, difficulty: '보통',
    bloc: 'pacific', faith: 'secular', faithStrength: '약',
    specialUnit: { name: '이지스 함대', base: '구축함', effect: '미사일 요격 +40%' },
    ability: { name: '기술 정밀', effect: '연구 속도 +25%' },
    shapes: [{ x: 795, y: 150, w: 40, h: 160 }],
  }),
  C({
    id: 'uk', name: '영국', continent: 'eurona', intro: '오랜 해양 강국. 정보기관과 잠수함이 강함',
    cities: ['런던', '버밍엄'],
    economy: 36, budget: 31, military: 39, difficulty: '보통',
    bloc: 'europe', faith: 'secular', faithStrength: '약',
    specialUnit: { name: '특수 공정대', base: '특수부대', effect: '잠입 성공 +30% · 기습 피해 2배' },
    ability: { name: '정보 강국', effect: '정보 점수 +30% · 잠수함 은밀 +' },
    shapes: [{ x: 35, y: 110, w: 70, h: 100 }],
  }),
  C({
    id: 'in', name: '인도', continent: 'asien', intro: '인구가 가장 많은 나라. 산악 부대가 강함',
    cities: ['뉴델리', '콜카타', '벵갈루루', '첸나이', '뭄바이'],
    economy: 36, budget: 31, military: 55, difficulty: '보통',
    bloc: 'independent', faith: 'pantheon', faithStrength: '중',
    specialUnit: { name: '산악 보병 사단', base: '보병', effect: '산·고지 전투 +30%' },
    ability: { name: '인구 저력', effect: '병력 회복 +40%' },
    shapes: [{ x: 500, y: 385, w: 140, h: 130 }],
  }),
  C({
    id: 'kr', name: '한국', continent: 'asien', intro: '작지만 반도체와 무기 수출이 강한 나라. 포병이 정밀함',
    cities: ['서울', '부산', '대구', '광주', '대전', '전주', '강릉', '제주', '여수', '순천', '익산'],
    economy: 25, budget: 22, military: 45, difficulty: '어려움',
    bloc: 'pacific', faith: 'secular', faithStrength: '약',
    specialUnit: { name: '자주포 포병대', base: '포병', effect: '쏘고 바로 이동 · 정확도 +30%' },
    ability: { name: '방산 수출', effect: '무기를 팔아 국방예산 + · 연합국 생산 도움' },
    shapes: [{ x: 672, y: 212, w: 58, h: 75 }],
  }),
  C({
    id: 'tr', name: '튀르키예', continent: 'sahar', intro: '두 바다를 잇는 해협의 나라. 무인기와 통행세로 힘을 키움',
    cities: ['앙카라', '이스탄불', '이즈미르'],
    economy: 23, budget: 18, military: 37, difficulty: '어려움',
    bloc: 'independent', faith: 'blade', faithStrength: '중',
    specialUnit: { name: '무인기 비행대', base: '무인드론', effect: '드론 비용 −40% · 동시 출격 +' },
    ability: { name: '해협 통제', effect: '유럽↔중동 바닷길 막기 · 통행 수익' },
    shapes: [{ x: 200, y: 345, w: 120, h: 75 }],
  }),
  C({
    id: 'il', name: '이스라엘', continent: 'sahar', intro: '성지 곁의 작은 나라. 하늘을 지키는 방공망이 촘촘함',
    cities: ['텔아비브', '하이파'],
    economy: 14, budget: 22, military: 27, difficulty: '어려움',
    bloc: 'pacific', faith: 'covenant', faithStrength: '강',
    specialUnit: { name: '다층 방공망', base: '방공부대', effect: '미사일·로켓·드론 요격 +50%' },
    ability: { name: '예비군 결속', effect: '예비군 동원이 즉시 · 작은 나라지만 병력 +40%' },
    shapes: [{ x: 200, y: 430, w: 70, h: 70 }],
  }),
  C({
    id: 'ir', name: '이란', continent: 'sahar', intro: '사막과 산의 나라. 종교 지도자가 다스리고 고속정 떼가 바다를 누빔',
    cities: ['테헤란', '이스파한', '반다르아바스', '시라즈'],
    economy: 15, budget: 9, military: 23, difficulty: '어려움',
    bloc: 'continental', faith: 'blade', faithStrength: '강',
    specialUnit: { name: '고속정 떼 함대', base: '구축함', effect: '싸고 많은 고속정 · 큰 함선 상대 +30%' },
    ability: { name: '해협 봉쇄', effect: '호르무즈 해협을 막아 적 석유 수입 −30%' },
    shapes: [{ x: 320, y: 380, w: 140, h: 105 }],
  }),
  C({
    id: 'ua', name: '우크라이나', continent: 'eurona', intro: '밀밭과 해바라기의 나라. 땅을 지키려는 마음이 가장 단단함',
    cities: ['키이우', '하르키우', '오데사'],
    economy: 10, budget: 30, military: 20, difficulty: '매우 어려움',
    bloc: 'europe', faith: 'polaris', faithStrength: '중',
    specialUnit: { name: '해상 드론 부대', base: '무인드론', effect: '바다 위 드론으로 함선 공격 · 해군 없이도 바다 막기' },
    ability: { name: '국토 방위 의지', effect: '자기 땅 방어 때 피해 −20% · 사기 안 떨어짐 · 연합 원조 2배' },
    shapes: [{ x: 170, y: 232, w: 120, h: 72 }],
  }),
  C({
    id: 'kp', name: '북한', continent: 'norga', intro: '땅굴과 특수부대로 버티는 닫힌 나라',
    cities: ['평양', '남포'],
    economy: 3, budget: 10, military: 12, difficulty: '매우 어려움',
    bloc: 'continental', faith: 'secular', faithStrength: '약',
    specialUnit: { name: '특수작전군', base: '특수부대', effect: '땅굴 침투 · 적 후방 도시 기습' },
    ability: { name: '철벽 체제', effect: '국방비 비율 상한 높음 · 병력 +50% · 대신 경제 성장 −50%' },
    shapes: [{ x: 655, y: 140, w: 70, h: 62 }],
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
