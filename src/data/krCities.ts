// 대한민국 11개 도시의 실제 정보(11/24 대장 요청 "각 도시마다 더 세밀한 정보, 실제와 이질감 없게").
// 인구·면적은 2024년 무렵 주민등록·통계 기준 어림값. 시설 위치는 실제 경도·위도(도시 화면에 그 자리로 찍힘).
// 숫자 효과는 시험판용(balance에서 맞춤).

/** 도시·시설 효과(나라 전체에 더해짐. 민심은 그 도시만) */
export interface CityEff {
  /** 나라 예산 배율 + */
  budget?: number;
  /** 자원 생산 배율 + */
  res?: number;
  /** 연구 점수/시간 + */
  research?: number;
  /** 그 도시 민심 + */
  loyalty?: number;
  /** 모든 우리 도시 민심 + */
  loyaltyAll?: number;
  /** 육군·해군·공군 모집 빠르기 + */
  army?: number;
  navy?: number;
  air?: number;
  /** 전투력 + */
  power?: number;
  /** 임무 성공 + */
  mission?: number;
}

export type MarkKind = 'gov' | 'intel' | 'army' | 'navy' | 'air' | 'lab' | 'univ' | 'bank' | 'industry' | 'port' | 'airport' | 'culture' | 'tourism' | 'nature' | 'energy' | 'shipyard';

export const MARK_KIND: Record<MarkKind, { name: string; icon: string; per: CityEff }> = {
  gov: { name: '행정', icon: '🏛️', per: { loyalty: 1, mission: 0.002 } },
  intel: { name: '정보', icon: '🕵️', per: { mission: 0.004 } },
  army: { name: '육군', icon: '🪖', per: { army: 0.01 } },
  navy: { name: '해군', icon: '⚓', per: { navy: 0.01 } },
  air: { name: '공군', icon: '🛩️', per: { air: 0.01 } },
  lab: { name: '국방 연구', icon: '🧪', per: { research: 0.012, power: 0.002 } },
  univ: { name: '대학', icon: '🎓', per: { research: 0.008 } },
  bank: { name: '금융', icon: '🏦', per: { budget: 0.006 } },
  industry: { name: '산업', icon: '🏭', per: { res: 0.006, budget: 0.002 } },
  port: { name: '항구', icon: '🚢', per: { budget: 0.004, navy: 0.004 } },
  airport: { name: '공항', icon: '✈️', per: { budget: 0.003, air: 0.004 } },
  culture: { name: '문화', icon: '🏯', per: { loyalty: 1 } },
  tourism: { name: '관광', icon: '🏖️', per: { budget: 0.003, loyalty: 0.5 } },
  nature: { name: '자연', icon: '🌿', per: { loyalty: 1 } },
  energy: { name: '에너지', icon: '⚡', per: { res: 0.006 } },
  shipyard: { name: '조선', icon: '🛳️', per: { navy: 0.01 } },
};
/** 도시 특성·실제 시설·군사 연구 구역을 모두 더한 나라 전체 효과 상한(한 나라만 너무 세지 않게) */
export const CITY_EFF_CAP: Required<Omit<CityEff, 'loyalty' | 'loyaltyAll'>> = { budget: 0.2, res: 0.2, research: 0.4, army: 0.2, navy: 0.2, air: 0.2, power: 0.1, mission: 0.08 };
/** 실제 시설 효과 배율(처음부터 너무 세지 않게: 단계 × 기본값 × 이 값) */
export const MARK_SCALE = 0.25;
/** 실제 시설 발전 단계 최대 */
export const MARK_MAX = 5;

export interface Landmark {
  id: string;
  name: string;
  kind: MarkKind;
  /** [경도, 위도] */
  at: [number, number];
  /** 지금 실제 발전 단계(1~5). 고향 전용 시설은 0(빈 터)에서 시작 */
  lv: number;
  note: string;
  /** 고향 전용 시설(11-24): 직접 지어 max 단계까지. 단계마다 eff가 더해짐(MARK_SCALE 안 곱함) */
  home?: { max: number; eff: CityEff };
}

/** 대장 고향 도시(11-24 대장: "익산·여수·순천은 고향이야. 더 꾸며줘") */
export const HOMETOWNS = ['익산', '여수', '순천'] as const;
export const isHometown = (name: string) => (HOMETOWNS as readonly string[]).includes(name);
/** 고향 도시 민심 덤 */
export const HOMETOWN_LOYALTY = 10;
/** 고향 세 도시를 모두 가지면: 전라 고향 벨트 */
export const HOME_BELT: CityEff = { budget: 0.03, navy: 0.05 };
/** 고향 전용 시설 짓기·올리기 값(지금 단계 lv → 다음 단계) */
export const homeBuildCost = (lv: number) => ({ cost: 4000 * (lv + 1), res: { 강철: 3 * (lv + 1) } as Record<string, number>, hours: 2 * (lv + 1) });

export interface KrCityInfo {
  /** 별명 */
  nick: string;
  /** 실제 인구(만 명) */
  pop: number;
  /** 면적(km²) */
  area: number;
  /** 행정구역 설명 */
  admin: string;
  /** 주요 산업 */
  industry: string[];
  /** 도시 특성: 나라 내정에 주는 힘 */
  trait: { name: string; icon: string; text: string; eff: CityEff };
  landmarks: Landmark[];
  /** 강(그림만): [경도, 위도] 점 목록 */
  rivers?: Array<{ name: string; pts: Array<[number, number]>; w: number }>;
}

export const KR_CITY_INFO: Record<string, KrCityInfo> = {
  서울: {
    nick: '수도 · 정치·금융 중심',
    pop: 935,
    area: 605,
    admin: '특별시 · 25개 자치구',
    industry: ['금융', 'IT·반도체 설계', '방송·문화', '대학·연구'],
    trait: { name: '수도', icon: '👑', text: '나라 예산 +3% · 임무 성공 +1%', eff: { budget: 0.03, mission: 0.01 } },
    landmarks: [
      { id: 'yongsan', name: '대통령실·국방부', kind: 'gov', at: [126.977, 37.533], lv: 5, note: '용산. 대통령 집무실과 국방부·합참' },
      { id: 'nis', name: '국가정보원', kind: 'intel', at: [127.06, 37.462], lv: 4, note: '서초구 내곡동' },
      { id: 'snu', name: '서울대학교', kind: 'univ', at: [126.952, 37.46], lv: 4, note: '관악구' },
      { id: 'yeouido', name: '여의도 금융가', kind: 'bank', at: [126.925, 37.525], lv: 5, note: '증권·은행 본사, 국회' },
      { id: 'kist', name: 'KIST 한국과학기술연구원', kind: 'lab', at: [127.045, 37.602], lv: 3, note: '성북구 홍릉' },
      { id: 'gimpo', name: '김포국제공항', kind: 'airport', at: [126.801, 37.558], lv: 4, note: '강서구' },
      { id: 'gyeongbok', name: '경복궁·광화문', kind: 'culture', at: [126.977, 37.579], lv: 5, note: '종로구' },
      { id: 'gangnam', name: '강남 테헤란로', kind: 'industry', at: [127.04, 37.503], lv: 4, note: 'IT·벤처 기업 거리' },
    ],
    rivers: [
      {
        name: '한강',
        w: 2.4,
        pts: [
          [127.19, 37.565], [127.15, 37.55], [127.11, 37.533], [127.08, 37.522], [127.05, 37.523], [127.02, 37.525], [126.995, 37.513], [126.97, 37.515], [126.945, 37.522], [126.915, 37.537], [126.885, 37.553], [126.86, 37.572], [126.83, 37.59], [126.79, 37.61],
        ],
      },
    ],
  },
  부산: {
    nick: '해양 수도 · 제2의 도시',
    pop: 328,
    area: 770,
    admin: '광역시 · 15개 구 · 1개 군(기장)',
    industry: ['항만·물류', '조선·해양', '수산', '관광', '금융(BIFC)'],
    trait: { name: '해양 수도', icon: '🌊', text: '해군 모집 +4% · 나라 예산 +1%', eff: { navy: 0.04, budget: 0.01 } },
    landmarks: [
      { id: 'rokn', name: '해군작전사령부', kind: 'navy', at: [129.1, 35.105], lv: 5, note: '남구 백운포. 함대 지휘' },
      { id: 'busanport', name: '부산항 북항', kind: 'port', at: [129.05, 35.107], lv: 5, note: '세계 7위권 컨테이너 항' },
      { id: 'newport', name: '부산항 신항', kind: 'port', at: [128.81, 35.08], lv: 4, note: '강서구' },
      { id: 'gimhae', name: '김해공항·5공중기동비행단', kind: 'air', at: [128.94, 35.175], lv: 3, note: '강서구. 공군 수송기' },
      { id: 'bifc', name: '문현 금융단지(BIFC)', kind: 'bank', at: [129.068, 35.147], lv: 3, note: '남구' },
      { id: 'yeongdo', name: '영도 조선소', kind: 'shipyard', at: [129.045, 35.083], lv: 3, note: '함정 건조' },
      { id: 'haeundae', name: '해운대', kind: 'tourism', at: [129.16, 35.159], lv: 5, note: '해수욕장·센텀시티' },
      { id: 'kori', name: '고리 원자력발전소', kind: 'energy', at: [129.29, 35.32], lv: 4, note: '기장군' },
    ],
    rivers: [{ name: '낙동강', w: 2.2, pts: [[128.985, 35.38], [128.975, 35.3], [128.965, 35.22], [128.955, 35.16], [128.95, 35.1], [128.955, 35.05]] }],
  },
  대구: {
    nick: '섬유·로봇·내륙 교통 중심',
    pop: 237,
    area: 884,
    admin: '광역시 · 7개 구 · 1개 군(달성)',
    industry: ['섬유', '기계·자동차 부품', '로봇', '의료'],
    trait: { name: '내륙 산업 도시', icon: '🤖', text: '자원 +2% · 육군 모집 +2%', eff: { res: 0.02, army: 0.02 } },
    landmarks: [
      { id: 'k2', name: '제11전투비행단(K-2)', kind: 'air', at: [128.659, 35.894], lv: 4, note: '동구. F-15K' },
      { id: 'army2', name: '제2작전사령부', kind: 'army', at: [128.64, 35.857], lv: 4, note: '수성구. 후방 지역 방어' },
      { id: 'dgist', name: 'DGIST 대구경북과학기술원', kind: 'lab', at: [128.456, 35.702], lv: 3, note: '달성군 현풍' },
      { id: 'knu', name: '경북대학교', kind: 'univ', at: [128.61, 35.89], lv: 3, note: '북구' },
      { id: 'dnic', name: '대구국가산업단지', kind: 'industry', at: [128.42, 35.65], lv: 3, note: '달성군 구지. 미래차·로봇' },
      { id: 'seomun', name: '서문시장', kind: 'culture', at: [128.581, 35.869], lv: 3, note: '중구' },
    ],
    rivers: [
      { name: '금호강', w: 1.4, pts: [[128.76, 35.925], [128.69, 35.905], [128.63, 35.902], [128.57, 35.895], [128.51, 35.87], [128.47, 35.85]] },
      { name: '낙동강', w: 2.2, pts: [[128.47, 35.97], [128.455, 35.88], [128.45, 35.8], [128.42, 35.72], [128.39, 35.64]] },
    ],
  },
  광주: {
    nick: '빛고을 · 민주·인권·AI 도시',
    pop: 141,
    area: 501,
    admin: '광역시 · 5개 구',
    industry: ['자동차', '가전', '인공지능', '광산업'],
    trait: { name: 'AI·자동차 도시', icon: '🚗', text: '연구 +0.04/시간 · 자원 +1%', eff: { research: 0.04, res: 0.01 } },
    landmarks: [
      { id: 'w1', name: '제1전투비행단', kind: 'air', at: [126.81, 35.126], lv: 4, note: '광산구 광주공항. 조종사 양성' },
      { id: 'gist', name: 'GIST 광주과학기술원', kind: 'lab', at: [126.843, 35.229], lv: 3, note: '북구 오룡동' },
      { id: 'kia', name: '기아 오토랜드 광주', kind: 'industry', at: [126.862, 35.149], lv: 4, note: '서구. 군용 차량도 만듦' },
      { id: 'acc', name: '국립아시아문화전당', kind: 'culture', at: [126.92, 35.147], lv: 4, note: '동구 옛 전남도청' },
      { id: 'may18', name: '국립 5·18 민주묘지', kind: 'culture', at: [126.94, 35.236], lv: 3, note: '북구' },
      { id: 'jnu', name: '전남대학교', kind: 'univ', at: [126.906, 35.176], lv: 3, note: '북구' },
    ],
    rivers: [{ name: '영산강', w: 1.6, pts: [[126.95, 35.27], [126.9, 35.23], [126.86, 35.2], [126.82, 35.16], [126.79, 35.11], [126.77, 35.07]] }],
  },
  대전: {
    nick: '과학 수도 · 대덕연구단지',
    pop: 144,
    area: 540,
    admin: '광역시 · 5개 구',
    industry: ['연구개발', '국방 과학', '바이오', '반도체 장비'],
    trait: { name: '과학 수도', icon: '🔬', text: '연구 +0.08/시간 · 전투력 +1%', eff: { research: 0.08, power: 0.01 } },
    landmarks: [
      { id: 'add', name: '국방과학연구소(ADD)', kind: 'lab', at: [127.338, 36.4], lv: 5, note: '유성구. 미사일·무기 개발' },
      { id: 'kaist', name: 'KAIST', kind: 'univ', at: [127.36, 36.372], lv: 5, note: '유성구' },
      { id: 'daedeok', name: '대덕연구개발특구', kind: 'lab', at: [127.373, 36.39], lv: 4, note: '정부 출연 연구소 20여 곳' },
      { id: 'kari', name: '한국항공우주연구원', kind: 'lab', at: [127.355, 36.374], lv: 4, note: '누리호·위성' },
      { id: 'govdj', name: '정부대전청사', kind: 'gov', at: [127.386, 36.36], lv: 3, note: '서구 둔산동. 방위사업청 등' },
      { id: 'jaun', name: '자운대(육군 교육 시설)', kind: 'army', at: [127.36, 36.43], lv: 3, note: '유성구. 군 병원·교육' },
    ],
    rivers: [{ name: '갑천', w: 1.2, pts: [[127.3, 36.26], [127.33, 36.31], [127.36, 36.35], [127.38, 36.375], [127.405, 36.395], [127.43, 36.42]] }],
  },
  전주: {
    nick: '맛과 멋의 전통문화 도시',
    pop: 64,
    area: 206,
    admin: '시 · 2개 구(완산·덕진)',
    industry: ['탄소 소재', '식품', '전통문화·관광', '공공기관'],
    trait: { name: '전통문화 도시', icon: '🏯', text: '모든 우리 도시 민심 +1 · 나라 예산 +0.5%', eff: { loyaltyAll: 1, budget: 0.005 } },
    landmarks: [
      { id: 'hanok', name: '전주 한옥마을', kind: 'culture', at: [127.153, 35.815], lv: 5, note: '완산구' },
      { id: 'jbgov', name: '전북특별자치도청', kind: 'gov', at: [127.108, 35.82], lv: 3, note: '완산구 효자동' },
      { id: 'nps', name: '국민연금공단(혁신도시)', kind: 'bank', at: [127.062, 35.834], lv: 4, note: '덕진구. 기금 1,000조 원' },
      { id: 'carbon', name: '탄소 소재 국가산단', kind: 'industry', at: [127.065, 35.87], lv: 2, note: '덕진구. 탄소섬유(군용 소재)' },
      { id: 'jbnu', name: '전북대학교', kind: 'univ', at: [127.13, 35.846], lv: 3, note: '덕진구' },
    ],
    rivers: [{ name: '전주천', w: 1, pts: [[127.18, 35.77], [127.16, 35.8], [127.14, 35.825], [127.12, 35.845], [127.1, 35.87]] }],
  },
  강릉: {
    nick: '동해의 관문 · 커피와 바다',
    pop: 21,
    area: 1040,
    admin: '시 · 1읍 7면 13동',
    industry: ['관광', '커피', '신소재', '발전'],
    trait: { name: '동해 방위 거점', icon: '🛩️', text: '공군 모집 +3% · 이 도시 민심 +3', eff: { air: 0.03, loyalty: 3 } },
    landmarks: [
      { id: 'w18', name: '제18전투비행단', kind: 'air', at: [128.944, 37.753], lv: 4, note: '강릉 공군기지. 동해 하늘 방어' },
      { id: 'gyeongpo', name: '경포대·경포해변', kind: 'tourism', at: [128.896, 37.795], lv: 4, note: '' },
      { id: 'jeongdongjin', name: '정동진', kind: 'tourism', at: [129.034, 37.69], lv: 3, note: '해돋이 명소' },
      { id: 'anin', name: '안인 화력발전소', kind: 'energy', at: [129.06, 37.73], lv: 3, note: '' },
      { id: 'okgye', name: '옥계항·마그네슘 단지', kind: 'port', at: [129.05, 37.62], lv: 2, note: '' },
      { id: 'gwnu', name: '강릉원주대학교', kind: 'univ', at: [128.87, 37.77], lv: 2, note: '' },
    ],
    rivers: [{ name: '남대천', w: 1, pts: [[128.78, 37.735], [128.84, 37.75], [128.89, 37.758], [128.94, 37.77]] }],
  },
  제주: {
    nick: '평화의 섬 · 국제 자유 도시',
    pop: 67,
    area: 1850,
    admin: '특별자치도 · 2개 행정시(제주시·서귀포시)',
    industry: ['관광', '감귤 농업', '수산', '신재생 에너지'],
    trait: { name: '관광·평화의 섬', icon: '🏝️', text: '나라 예산 +1% · 모든 우리 도시 민심 +1 · 해군 모집 +1%', eff: { budget: 0.01, loyaltyAll: 1, navy: 0.01 } },
    landmarks: [
      { id: 'jejunavy', name: '제주 민군복합항(해군기지)', kind: 'navy', at: [126.48, 33.226], lv: 4, note: '서귀포 강정. 기동함대' },
      { id: 'cju', name: '제주국제공항', kind: 'airport', at: [126.493, 33.507], lv: 5, note: '제주시' },
      { id: 'halla', name: '한라산', kind: 'nature', at: [126.533, 33.362], lv: 5, note: '1,947m. 국립공원' },
      { id: 'seongsan', name: '성산일출봉', kind: 'tourism', at: [126.942, 33.459], lv: 5, note: '세계자연유산' },
      { id: 'jungmun', name: '중문관광단지', kind: 'tourism', at: [126.412, 33.25], lv: 4, note: '서귀포' },
      { id: 'jjgov', name: '제주도청', kind: 'gov', at: [126.498, 33.489], lv: 3, note: '제주시' },
      { id: 'wind', name: '해상 풍력 단지', kind: 'energy', at: [126.17, 33.33], lv: 2, note: '한경면' },
    ],
  },
  여수: {
    nick: '남해안 석유화학·해양 관광 도시',
    pop: 27,
    area: 512,
    admin: '시 · 1읍 6면 20동 · 섬 365개',
    industry: ['석유화학', '정유', '해양 관광', '수산'],
    trait: { name: '석유화학 단지', icon: '🛢️', text: '자원 +3% · 나라 예산 +0.5%', eff: { res: 0.03, budget: 0.005 } },
    landmarks: [
      { id: 'ysnic', name: '여수국가산업단지', kind: 'industry', at: [127.685, 34.85], lv: 5, note: '국내 최대 석유화학 단지' },
      { id: 'gsref', name: '정유 공장', kind: 'energy', at: [127.71, 34.83], lv: 4, note: '하루 80만 배럴' },
      { id: 'ysport', name: '여수항·광양만 항로', kind: 'port', at: [127.74, 34.738], lv: 3, note: '' },
      { id: 'rsu', name: '여수공항', kind: 'airport', at: [127.617, 34.842], lv: 2, note: '' },
      { id: 'expo', name: '여수 엑스포 해양공원', kind: 'tourism', at: [127.745, 34.753], lv: 4, note: '' },
      { id: 'jinnam', name: '진남관(전라좌수영)', kind: 'culture', at: [127.735, 34.745], lv: 3, note: '이순신 장군 본영' },
      { id: 'odongdo', name: '오동도', kind: 'nature', at: [127.766, 34.745], lv: 4, note: '동백꽃 섬·방파제 산책길' },
      { id: 'hyangiram', name: '향일암', kind: 'culture', at: [127.8, 34.592], lv: 3, note: '돌산 끝 해돋이 암자' },
      { id: 'dolsan', name: '돌산대교·해상케이블카', kind: 'tourism', at: [127.735, 34.727], lv: 4, note: '여수 밤바다 야경' },
      { id: 'yisunsin', name: '이순신대교', kind: 'port', at: [127.71, 34.905], lv: 3, note: '광양만을 잇는 현수교' },
      { id: 'kcga', name: '해양경찰교육원', kind: 'navy', at: [127.61, 34.75], lv: 3, note: '해경 간부 교육' },
      { id: 'geomundo', name: '거문도', kind: 'navy', at: [127.31, 34.03], lv: 2, note: '1885 거문도 사건. 남해 길목 섬' },
      { id: 'h-fire', name: '밤바다 불꽃 축제장', kind: 'tourism', at: [127.75, 34.74], lv: 0, note: '고향 전용 · 여수 밤바다 불꽃놀이', home: { max: 3, eff: { budget: 0.006, loyaltyAll: 1 } } },
      { id: 'h-navyfwd', name: '남해 해군 전진기지', kind: 'navy', at: [127.66, 34.69], lv: 0, note: '고향 전용 · 남해 함대 정박지', home: { max: 3, eff: { navy: 0.02 } } },
      { id: 'h-oil', name: '전략 석유 비축기지', kind: 'energy', at: [127.7, 34.87], lv: 0, note: '고향 전용 · 지하 원유 저장 동굴', home: { max: 3, eff: { res: 0.01 } } },
      { id: 'h-kcga', name: '해경 교육원 확장', kind: 'navy', at: [127.6, 34.77], lv: 0, note: '고향 전용 · 섬 지키는 해경', home: { max: 3, eff: { navy: 0.01, mission: 0.005 } } },
      { id: 'h-watch', name: '거문도 해양 감시소', kind: 'intel', at: [127.32, 34.05], lv: 0, note: '고향 전용 · 남해 레이더', home: { max: 3, eff: { mission: 0.008 } } },
    ],
  },
  순천: {
    nick: '대한민국 생태 수도',
    pop: 28,
    area: 911,
    admin: '시 · 1읍 10면 13동',
    industry: ['생태 관광', '농업', '철강 협력', '교육'],
    trait: { name: '생태 수도', icon: '🌾', text: '모든 우리 도시 민심 +1 · 자원 +0.5%', eff: { loyaltyAll: 1, res: 0.005 } },
    landmarks: [
      { id: 'scbay', name: '순천만 습지', kind: 'nature', at: [127.51, 34.88], lv: 5, note: '연안 습지·흑두루미' },
      { id: 'garden', name: '순천만 국가정원', kind: 'tourism', at: [127.5, 34.929], lv: 4, note: '' },
      { id: 'nagan', name: '낙안읍성', kind: 'culture', at: [127.343, 34.907], lv: 3, note: '조선 읍성 마을' },
      { id: 'scnu', name: '순천대학교', kind: 'univ', at: [127.48, 34.97], lv: 2, note: '' },
      { id: 'haeryong', name: '해룡 산업단지', kind: 'industry', at: [127.55, 34.92], lv: 2, note: '광양제철소 협력' },
      { id: 'seonam', name: '선암사·송광사', kind: 'culture', at: [127.33, 34.99], lv: 3, note: '천년 고찰' },
      { id: 'scstation', name: '순천역', kind: 'port', at: [127.502, 34.945], lv: 3, note: '전라선·경전선이 만나는 역' },
      { id: 'yulchon', name: '율촌 산업단지', kind: 'industry', at: [127.58, 34.88], lv: 3, note: '해룡면. 금속·기계' },
      { id: 'dramaset', name: '순천 드라마촬영장', kind: 'culture', at: [127.52, 34.952], lv: 3, note: '1960~80년대 거리 재현' },
      { id: 'crane', name: '흑두루미 마을', kind: 'nature', at: [127.47, 34.87], lv: 4, note: '천연기념물 겨울 철새' },
      { id: 'jorye', name: '조례호수공원', kind: 'nature', at: [127.53, 34.96], lv: 2, note: '' },
      { id: 'jobworld', name: '순천만 잡월드', kind: 'univ', at: [127.495, 34.92], lv: 2, note: '어린이 직업 체험관' },
      { id: 'h-garden', name: '국가정원 확장', kind: 'tourism', at: [127.49, 34.935], lv: 0, note: '고향 전용 · 정원 박람회', home: { max: 3, eff: { loyaltyAll: 1, budget: 0.004 } } },
      { id: 'h-eco', name: '생태 연구소', kind: 'lab', at: [127.52, 34.89], lv: 0, note: '고향 전용 · 습지·기후 연구', home: { max: 3, eff: { research: 0.04 } } },
      { id: 'h-hosp', name: '순천 의대 병원', kind: 'univ', at: [127.47, 34.98], lv: 0, note: '고향 전용 · 전남 동부 거점 병원', home: { max: 3, eff: { loyalty: 2, army: 0.005 } } },
      { id: 'h-rail', name: '남해안 철도 교차역', kind: 'port', at: [127.51, 34.94], lv: 0, note: '고향 전용 · 보급 철도', home: { max: 3, eff: { army: 0.01, res: 0.004 } } },
      { id: 'h-film', name: '영상 단지', kind: 'culture', at: [127.535, 34.95], lv: 0, note: '고향 전용 · 드라마·영화 촬영', home: { max: 3, eff: { loyaltyAll: 1 } } },
    ],
    rivers: [{ name: '동천', w: 1, pts: [[127.47, 35.02], [127.485, 34.97], [127.495, 34.93], [127.505, 34.9], [127.51, 34.87]] }],
  },
  익산: {
    nick: '백제의 왕도 · 보석과 식품의 도시',
    pop: 27,
    area: 507,
    admin: '시 · 1읍 14면 14동',
    industry: ['식품', '보석 가공', '철도 물류', '농업'],
    trait: { name: '백제 왕도', icon: '🛕', text: '모든 우리 도시 민심 +1 · 육군 모집 +1%', eff: { loyaltyAll: 1, army: 0.01 } },
    landmarks: [
      { id: 'mireuksa', name: '미륵사지 석탑', kind: 'culture', at: [127.032, 36.012], lv: 5, note: '백제역사유적지구(세계유산)' },
      { id: 'wanggung', name: '왕궁리 유적', kind: 'culture', at: [127.054, 35.973], lv: 4, note: '백제 무왕의 궁궐 터' },
      { id: 'foodcl', name: '국가식품클러스터', kind: 'industry', at: [127.03, 35.99], lv: 4, note: '왕궁면. 식품 기업 단지' },
      { id: 'iksanst', name: '익산역', kind: 'port', at: [126.946, 35.94], lv: 4, note: '호남·전라·장항선이 만나는 KTX역' },
      { id: 'wku', name: '원광대학교', kind: 'univ', at: [126.958, 35.968], lv: 3, note: '' },
      { id: 'jewel', name: '보석박물관·보석 가공단지', kind: 'bank', at: [127.03, 35.98], lv: 3, note: '귀금속 가공 특구' },
      { id: 'nco', name: '육군부사관학교', kind: 'army', at: [127.06, 36.08], lv: 4, note: '부사관 양성' },
      { id: 'ind2', name: '익산 제2산업단지', kind: 'industry', at: [126.99, 35.93], lv: 3, note: '' },
      { id: 'iksangov', name: '익산시청', kind: 'gov', at: [126.957, 35.948], lv: 3, note: '' },
      { id: 'mangyeong', name: '만경강 들판', kind: 'nature', at: [126.93, 35.88], lv: 3, note: '호남평야 곡창' },
      { id: 'h-baekje', name: '백제 왕도 복원', kind: 'culture', at: [127.045, 35.98], lv: 0, note: '고향 전용 · 왕궁·미륵사 복원, 서동축제', home: { max: 3, eff: { loyaltyAll: 1, budget: 0.004 } } },
      { id: 'h-jewel', name: '보석 가공 특구', kind: 'bank', at: [127.0, 35.97], lv: 0, note: '고향 전용 · 귀금속 수출', home: { max: 3, eff: { budget: 0.008 } } },
      { id: 'h-food', name: '식품클러스터 확장', kind: 'industry', at: [127.04, 35.995], lv: 0, note: '고향 전용 · 군 전투식량 공장', home: { max: 3, eff: { res: 0.006, loyalty: 2 } } },
      { id: 'h-rail', name: '호남 철도 허브', kind: 'port', at: [126.94, 35.95], lv: 0, note: '고향 전용 · 호남 보급 중심', home: { max: 3, eff: { army: 0.01, res: 0.004 } } },
      { id: 'h-nco', name: '부사관학교 확장', kind: 'army', at: [127.07, 36.07], lv: 0, note: '고향 전용 · 간부 양성', home: { max: 3, eff: { army: 0.015, mission: 0.004 } } },
    ],
    rivers: [{ name: '만경강', w: 1.2, pts: [[127.1, 35.92], [127.03, 35.9], [126.97, 35.885], [126.9, 35.88], [126.85, 35.87]] }],
  },
  // 11-25 내정 도시(점령 도시 대전·부산을 따라감)
  인천: {
    nick: '하늘길·바닷길 관문',
    pop: 300,
    area: 1067,
    admin: '광역시 · 8구 2군(옹진군 섬 제외)',
    industry: ['항공 물류', '항만', '바이오', '철강'],
    trait: { name: '관문 도시', icon: '✈️', text: '나라 예산 +1% · 공군 모집 +1%', eff: { budget: 0.01, air: 0.01 } },
    landmarks: [
      { id: 'icn', name: '인천국제공항', kind: 'airport', at: [126.44, 37.46], lv: 5, note: '영종도. 세계적인 허브 공항' },
      { id: 'icport', name: '인천항', kind: 'port', at: [126.6, 37.46], lv: 5, note: '수도권 바닷길 관문' },
      { id: 'bridge', name: '인천대교', kind: 'port', at: [126.55, 37.42], lv: 4, note: '송도와 영종도를 잇는 다리' },
      { id: 'songdo', name: '송도 국제도시', kind: 'bank', at: [126.65, 37.39], lv: 4, note: '국제기구·금융 업무 지구' },
      { id: 'bio', name: '송도 바이오 단지', kind: 'lab', at: [126.665, 37.38], lv: 4, note: '의약품 생산 단지' },
      { id: 'namdong', name: '남동 국가산업단지', kind: 'industry', at: [126.7, 37.405], lv: 4, note: '기계·부품' },
      { id: 'wolmi', name: '월미도', kind: 'tourism', at: [126.597, 37.475], lv: 3, note: '바닷가 놀이공원·문화의 거리' },
      { id: 'landing', name: '인천상륙작전 기념관', kind: 'culture', at: [126.627, 37.448], lv: 3, note: '1950년 상륙작전' },
      { id: 'dolmen', name: '강화 고인돌', kind: 'culture', at: [126.43, 37.75], lv: 4, note: '고인돌 유적(세계유산)' },
      { id: 'inha', name: '인하대학교', kind: 'univ', at: [126.654, 37.45], lv: 3, note: '' },
      { id: 'icnavy', name: '인천 해역방어사령부', kind: 'navy', at: [126.61, 37.46], lv: 3, note: '서해 수도권 바다 지킴' },
      { id: 'icgov', name: '인천시청', kind: 'gov', at: [126.705, 37.456], lv: 3, note: '' },
    ],
  },
  울산: {
    nick: '대한민국 산업 수도',
    pop: 110,
    area: 1062,
    admin: '광역시 · 4구 1군',
    industry: ['자동차', '조선', '석유화학', '에너지'],
    trait: { name: '산업 수도', icon: '🏭', text: '자원 +1% · 해군 모집 +1%', eff: { res: 0.01, navy: 0.01 } },
    landmarks: [
      { id: 'usyard', name: '동구 조선소', kind: 'shipyard', at: [129.43, 35.51], lv: 5, note: '세계 최대급 조선소' },
      { id: 'auto', name: '북구 자동차 공장', kind: 'industry', at: [129.38, 35.55], lv: 5, note: '한 공장에서 가장 많은 차를 만듦' },
      { id: 'petro', name: '석유화학 단지', kind: 'industry', at: [129.33, 35.48], lv: 5, note: '정유·화학' },
      { id: 'usport', name: '울산항', kind: 'port', at: [129.38, 35.5], lv: 4, note: '액체 화물 항만' },
      { id: 'nuke', name: '새울 원자력발전소', kind: 'energy', at: [129.31, 35.33], lv: 4, note: '울주군 서생면' },
      { id: 'unist', name: '울산과학기술원', kind: 'univ', at: [129.19, 35.57], lv: 3, note: '' },
      { id: 'taehwa', name: '태화강 국가정원', kind: 'tourism', at: [129.3, 35.55], lv: 4, note: '대숲·십리대숲' },
      { id: 'bangudae', name: '반구대 암각화', kind: 'culture', at: [129.17, 35.61], lv: 4, note: '선사 시대 고래 그림' },
      { id: 'daewang', name: '대왕암공원', kind: 'nature', at: [129.44, 35.49], lv: 3, note: '바닷가 바위 공원' },
      { id: 'ganjeol', name: '간절곶', kind: 'nature', at: [129.36, 35.36], lv: 3, note: '해돋이 명소' },
      { id: 'usair', name: '울산공항', kind: 'airport', at: [129.35, 35.59], lv: 2, note: '' },
      { id: 'usgov', name: '울산시청', kind: 'gov', at: [129.311, 35.539], lv: 3, note: '' },
    ],
    rivers: [{ name: '태화강', w: 1.2, pts: [[129.15, 35.6], [129.22, 35.57], [129.28, 35.555], [129.33, 35.545], [129.38, 35.53]] }],
  },
};

export const krInfo = (name: string): KrCityInfo | null => KR_CITY_INFO[name] ?? null;

/** 효과 설명 한 줄 */
export function effText(e: CityEff): string {
  const pct = (v: number) => `${Math.round(v * 1000) / 10}%`;
  const out: string[] = [];
  if (e.budget) out.push(`예산 +${pct(e.budget)}`);
  if (e.res) out.push(`자원 +${pct(e.res)}`);
  if (e.research) out.push(`연구 +${Math.round(e.research * 100) / 100}`);
  if (e.loyalty) out.push(`민심 +${e.loyalty}`);
  if (e.loyaltyAll) out.push(`전국 민심 +${e.loyaltyAll}`);
  if (e.army) out.push(`육군 모집 +${pct(e.army)}`);
  if (e.navy) out.push(`해군 모집 +${pct(e.navy)}`);
  if (e.air) out.push(`공군 모집 +${pct(e.air)}`);
  if (e.power) out.push(`전투력 +${pct(e.power)}`);
  if (e.mission) out.push(`임무 +${pct(e.mission)}`);
  return out.join(' · ');
}
