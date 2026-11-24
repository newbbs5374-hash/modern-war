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
};
