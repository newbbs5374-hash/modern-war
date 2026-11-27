// 13개 나라 실제 기본 정보(11-24 대장 요청 "나라 정보를 더 많이"). 2024년 무렵 어림값. 게임 계산에는 안 씀(보여 주기만).
export interface CountryFacts {
  capital: string;
  /** 인구(백만 명) */
  pop: number;
  /** 면적(만 km²) */
  area: number;
  /** 국내총생산 세계 순위(어림) */
  gdpRank: number;
  /** 핵무기: 있음 · 있다고 알려짐 · 없음 */
  nuke: '보유' | '보유 추정' | '없음';
  /** 현역 군인(만 명, 어림) */
  active: number;
  /** 한 줄 소개(실제) */
  note: string;
  /** 주요 수출품 */
  exports: string[];
}

export const COUNTRY_FACTS: Record<string, CountryFacts> = {
  us: { capital: '워싱턴 D.C.', pop: 335, area: 983, gdpRank: 1, nuke: '보유', active: 130, note: '항공모함 11척을 가진 세계 최대 군사·경제 대국', exports: ['반도체', '항공기', '석유·가스'] },
  cn: { capital: '베이징', pop: 1410, area: 960, gdpRank: 2, nuke: '보유', active: 200, note: '세계 최대 제조국, 해군 함정 수 세계 1위', exports: ['전자제품', '기계', '철강'] },
  ru: { capital: '모스크바', pop: 144, area: 1710, gdpRank: 11, nuke: '보유', active: 130, note: '가장 넓은 나라, 핵탄두 수 세계 1위', exports: ['석유·가스', '곡물', '무기'] },
  de: { capital: '베를린', pop: 84, area: 36, gdpRank: 3, nuke: '없음', active: 18, note: '유럽 최대 경제, 자동차·기계 강국', exports: ['자동차', '기계', '화학'] },
  jp: { capital: '도쿄', pop: 124, area: 38, gdpRank: 4, nuke: '없음', active: 25, note: '정밀 기술과 이지스함을 가진 섬나라', exports: ['자동차', '반도체 장비', '기계'] },
  uk: { capital: '런던', pop: 68, area: 24, gdpRank: 6, nuke: '보유', active: 14, note: '금융 중심지, 핵잠수함과 정보기관이 강함', exports: ['금융', '기계', '의약품'] },
  in: { capital: '뉴델리', pop: 1430, area: 329, gdpRank: 5, nuke: '보유', active: 145, note: '인구 세계 1위, 빠르게 크는 경제', exports: ['소프트웨어', '의약품', '정유 제품'] },
  kr: { capital: '서울', pop: 52, area: 10, gdpRank: 12, nuke: '없음', active: 50, note: '반도체·조선·방산 수출 강국', exports: ['반도체', '자동차', '선박'] },
  tr: { capital: '앙카라', pop: 85, area: 78, gdpRank: 17, nuke: '없음', active: 36, note: '보스포루스 해협을 쥔 나라, 무인기 수출국', exports: ['자동차', '섬유', '무인기'] },
  il: { capital: '예루살렘', pop: 10, area: 2.2, gdpRank: 29, nuke: '보유 추정', active: 17, note: '아이언돔 방공망과 첨단 기술의 작은 나라', exports: ['반도체', '보안 기술', '다이아몬드'] },
  ir: { capital: '테헤란', pop: 89, area: 165, gdpRank: 35, nuke: '없음', active: 61, note: '호르무즈 해협 옆 석유 대국, 미사일·무인기 개발', exports: ['석유', '가스', '석유화학'] },
  ua: { capital: '키이우', pop: 37, area: 60, gdpRank: 55, nuke: '없음', active: 90, note: '유럽의 곡창, 2022년부터 전쟁 중', exports: ['곡물', '해바라기유', '철강'] },
  kp: { capital: '평양', pop: 26, area: 12, gdpRank: 150, nuke: '보유', active: 128, note: '병력 비율이 가장 높은 닫힌 나라', exports: ['석탄', '광물', '무기'] },
  tw: { capital: '타이베이', pop: 23, area: 3.6, gdpRank: 21, nuke: '없음', active: 17, note: '세계 최첨단 반도체의 대부분을 만드는 섬', exports: ['반도체', '전자제품', '기계'] },
  pl: { capital: '바르샤바', pop: 37, area: 31, gdpRank: 20, nuke: '없음', active: 20, note: '국방비 비율이 나토에서 가장 높은 나라 중 하나', exports: ['자동차 부품', '가구', '전자제품'] },
  ph: { capital: '마닐라', pop: 115, area: 30, gdpRank: 32, nuke: '없음', active: 15, note: '섬 7천여 개, 남중국해 암초를 두고 중국과 다툼', exports: ['전자제품', '니켈', '바나나'] },
  pk: { capital: '이슬라마바드', pop: 240, area: 80, gdpRank: 42, nuke: '보유', active: 65, note: '핵무기를 가진 나라, 카슈미르를 두고 인도와 대치', exports: ['섬유', '쌀', '가죽'] },
  sa: { capital: '리야드', pop: 33, area: 215, gdpRank: 18, nuke: '없음', active: 26, note: '석유 수출 세계 1위, 국방비 세계 상위권', exports: ['석유', '석유화학', '플라스틱'] },
  // 11-27 새 나라 18개
  eg: { capital: '카이로', pop: 112, area: 100, gdpRank: 40, nuke: '없음', active: 44, note: '수에즈 운하를 가진 아랍 최대 인구국, 아프리카 최대 기갑 전력', exports: ['천연가스', '석유', '면화'] },
  ng: { capital: '아부자', pop: 225, area: 92, gdpRank: 45, nuke: '없음', active: 14, note: '아프리카 최대 인구, 석유 수출이 나라 살림의 대부분', exports: ['석유', '가스', '코코아'] },
  za: { capital: '프리토리아', pop: 62, area: 122, gdpRank: 38, nuke: '없음', active: 7, note: '핵무기를 스스로 없앤 유일한 나라, 백금·금 세계 상위', exports: ['백금', '금', '철광석'] },
  et: { capital: '아디스아바바', pop: 126, area: 110, gdpRank: 60, nuke: '없음', active: 16, note: '나일강 상류에 아프리카 최대 댐을 지어 이집트와 맞섬', exports: ['커피', '금', '꽃'] },
  dz: { capital: '알제', pop: 46, area: 238, gdpRank: 50, nuke: '없음', active: 13, note: '아프리카에서 가장 넓은 나라, 국방비 아프리카 1위', exports: ['천연가스', '석유', '헬륨'] },
  br: { capital: '브라질리아', pop: 216, area: 852, gdpRank: 9, nuke: '없음', active: 37, note: '남미 경제의 절반, 아마존과 비행기 회사로 유명', exports: ['철광석', '콩', '석유'] },
  ar: { capital: '부에노스아이레스', pop: 46, area: 278, gdpRank: 25, nuke: '없음', active: 7, note: '리튬 삼각지대의 한 축, 포클랜드를 두고 영국과 싸운 적 있음', exports: ['콩', '소고기', '리튬'] },
  co: { capital: '보고타', pop: 52, area: 114, gdpRank: 42, nuke: '없음', active: 30, note: '50년 내전을 겪은 군대, 남미에서 미국과 가장 가까운 나라', exports: ['석유', '커피', '석탄'] },
  ve: { capital: '카라카스', pop: 28, area: 92, gdpRank: 80, nuke: '없음', active: 12, note: '세계 최대 석유 매장량, 제재로 경제가 무너짐', exports: ['석유', '금', '철'] },
  cl: { capital: '산티아고', pop: 20, area: 76, gdpRank: 45, nuke: '없음', active: 8, note: '구리 세계 1위·리튬 2위, 남미에서 가장 잘 정비된 해군', exports: ['구리', '리튬', '연어'] },
  au: { capital: '캔버라', pop: 27, area: 769, gdpRank: 13, nuke: '없음', active: 6, note: '철광석·리튬 세계 1위, 미국·영국과 핵잠수함 동맹(오커스)', exports: ['철광석', '석탄', '천연가스'] },
  ca: { capital: '오타와', pop: 40, area: 998, gdpRank: 10, nuke: '없음', active: 7, note: '세계 두 번째로 넓은 나라, 석유·우라늄 수출 대국', exports: ['석유', '자동차', '우라늄'] },
  mx: { capital: '멕시코시티', pop: 129, area: 196, gdpRank: 12, nuke: '없음', active: 22, note: '미국의 최대 교역국, 마약 조직과 싸우는 국가방위대', exports: ['자동차', '전자제품', '석유'] },
  fr: { capital: '파리', pop: 68, area: 55, gdpRank: 7, nuke: '보유', active: 20, note: '유럽연합의 유일한 핵보유국, 원자력 항공모함 보유', exports: ['비행기', '포도주', '약품'] },
  it: { capital: '로마', pop: 59, area: 30, gdpRank: 8, nuke: '없음', active: 17, note: '지중해 한가운데의 공업국, 항공모함 2척', exports: ['기계', '자동차', '옷'] },
  es: { capital: '마드리드', pop: 48, area: 51, gdpRank: 15, nuke: '없음', active: 12, note: '지브롤터 해협을 두고 영국과 다툼, 세계 2위 관광국', exports: ['자동차', '올리브유', '과일'] },
  gr: { capital: '아테네', pop: 10, area: 13, gdpRank: 55, nuke: '없음', active: 14, note: '국방비 비율이 나토 상위, 에게해 섬을 두고 튀르키예와 대치', exports: ['석유제품', '알루미늄', '올리브'] },
  fi: { capital: '헬싱키', pop: 5.6, area: 34, gdpRank: 48, nuke: '없음', active: 2.4, note: '예비군 90만, 러시아와 가장 긴 국경을 맞댄 나토 회원국', exports: ['종이', '기계', '전자제품'] },
};
