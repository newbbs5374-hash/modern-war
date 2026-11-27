// 주요 도시의 국가 기관(11/24 대장 요청 "주요 도시에 자원 및 기관 배치").
// 자원(CITY_RES)은 그대로 두어 희소성을 지키고, 기관은 도시마다 0~3개. 도시를 가진 나라가 효과를 받음(점령지는 절반).
export type InstId = 'lab' | 'univ' | 'bank' | 'army' | 'navy' | 'air' | 'nuke' | 'intel';

export interface InstDef {
  id: InstId;
  name: string;
  icon: string;
  /** 효과 설명 */
  does: string;
}

export const INSTS: InstDef[] = [
  { id: 'lab', name: '국립 연구소', icon: '🔬', does: '연구 +0.15/시간' },
  { id: 'univ', name: '명문 대학', icon: '🎓', does: '연구 +0.1/시간' },
  { id: 'bank', name: '금융 센터', icon: '🏦', does: '나라 예산 +4%' },
  { id: 'army', name: '육군 기지', icon: '🪖', does: '육군 모집 +8% · 이 도시 방어 +15%' },
  { id: 'navy', name: '해군 기지', icon: '⚓', does: '해군 모집 +10% · 함대 모항' },
  { id: 'air', name: '공군 기지', icon: '🛩️', does: '공군 모집 +10% · 전투기 출격지' },
  { id: 'nuke', name: '원자력 발전소', icon: '⚛️', does: '자원 생산 +3%' },
  { id: 'intel', name: '정보 기관', icon: '🕵️', does: '임무 성공 +3%' },
];
export const instById = (id: InstId) => INSTS.find((x) => x.id === id)!;

/** 도시 이름 → 기관(실제 도시 성격 참고, 없는 도시도 있음) */
export const CITY_INST: Record<string, InstId[]> = {
  워싱턴: ['intel', 'univ'], 뉴욕: ['bank', 'univ'], 샌프란시스코: ['lab', 'univ'], 호놀룰루: ['navy', 'air'],
  덴버: ['air'], 피닉스: [], 피츠버그: ['univ'], 휴스턴: ['lab'],
  베이징: ['intel', 'univ'], 톈진: ['navy'], 광저우: [], 선전: ['lab', 'bank'],
  바오터우: ['army'], 우한: ['univ'], 란저우: ['nuke'], 상하이: ['bank', 'navy'],
  모스크바: ['intel', 'univ'], 상트페테르부르크: ['navy', 'univ'], 튜멘: [], 무르만스크: ['navy'],
  예카테린부르크: ['army'], 아르한겔스크: [], 노릴스크: [], 야쿠츠크: [], 블라디보스토크: ['navy'], 노보시비르스크: ['lab'],
  베를린: ['univ', 'intel'], 함부르크: ['bank', 'navy'],
  도쿄: ['bank', 'lab'], 후쿠오카: ['air'],
  런던: ['bank', 'intel'], 버밍엄: ['univ'],
  뉴델리: ['intel'], 콜카타: [], 벵갈루루: ['lab', 'univ'], 첸나이: ['nuke'], 뭄바이: ['bank', 'navy'],
  서울: ['intel', 'univ', 'bank'], 부산: ['navy', 'bank'],
  대구: ['air', 'army'], 광주: ['air'], 대전: ['lab', 'univ'], 전주: [], 강릉: ['air'], 제주: ['navy'], 여수: [], 순천: [], 익산: ['army'],
  앙카라: ['army'], 이스탄불: ['bank', 'navy'], 이즈미르: ['air'],
  텔아비브: ['lab', 'intel'], 하이파: ['navy'],
  테헤란: ['intel'], 이스파한: ['nuke'], 반다르아바스: ['navy'], 시라즈: [],
  키이우: ['univ'], 하르키우: ['army'], 오데사: ['navy'],
  평양: ['army', 'intel'], 남포: ['navy'],
  // 11-26 새 나라
  타이베이: ['intel', 'bank'], 가오슝: ['navy'], 신주: ['lab', 'univ'], 타이중: ['air'], 마궁: ['navy'],
  바르샤바: ['univ', 'bank'], 크라쿠프: ['univ'], 그단스크: ['navy'], 제슈프: ['air'], 루블린: ['army'],
  마닐라: ['intel', 'bank'], 수비크: ['navy'], 다바오: ['army'], 세부: [],
  이슬라마바드: ['intel', 'army'], 카라치: ['navy', 'bank'], 라호르: ['univ'], 페샤와르: ['army'], 퀘타: ['nuke'],
  리야드: ['intel', 'bank'], 담맘: ['air'], 제다: ['navy'], 네옴: ['lab'], 타부크: ['air'],
  // 11-27 새 나라 18개
  카이로: ['intel', 'univ', 'bank'], 알렉산드리아: ['navy'], 수에즈: ['army'], 아스완: ['air'], 포트사이드: ['navy'],
  아부자: ['intel', 'army'], 라고스: ['bank', 'navy'], 카두나: ['army'], 이바단: ['univ'],
  프리토리아: ['intel', 'army'], 요하네스버그: ['bank', 'univ'], 케이프타운: ['navy'], 블룸폰테인: ['air'],
  아디스아바바: ['intel', 'army', 'univ'], 바히르다르: ['air'], 디레다와: ['army'],
  알제: ['intel', 'army', 'bank'], 오랑: ['navy'], 타만라세트: ['air'], 콘스탄틴: ['univ'],
  브라질리아: ['intel', 'army'], 상파울루: ['bank', 'univ', 'air'], 리우데자네이루: ['navy', 'lab'], 마나우스: ['army'],
  부에노스아이레스: ['intel', 'bank', 'univ'], 코르도바: ['air', 'lab'], 바이아블랑카: ['navy'], 멘도사: ['army'],
  보고타: ['intel', 'army', 'bank'], 메데인: ['univ'], 카르타헤나: ['navy'], 쿠쿠타: ['army'],
  카라카스: ['intel', 'army'], 마라카이: ['air'], 마라카이보: ['bank'], 푸에르토라크루스: ['navy'],
  산티아고: ['intel', 'bank', 'univ'], 발파라이소: ['navy'], 안토파가스타: ['army'], 이키케: ['air'],
  캔버라: ['intel', 'army'], 시드니: ['bank', 'univ', 'navy'], 멜버른: ['univ', 'lab'], 다윈: ['air'], 애들레이드: ['navy'], 퍼스: ['navy'],
  오타와: ['intel', 'army'], 토론토: ['bank', 'univ', 'lab'], 몬트리올: ['univ'], 핼리팩스: ['navy'], 밴쿠버: ['navy'], 에드먼턴: ['air'],
  멕시코시티: ['intel', 'army', 'bank'], 과달라하라: ['univ', 'lab'], 몬테레이: ['bank'], 베라크루스: ['navy'], 치와와: ['army'],
  파리: ['intel', 'bank', 'univ'], 브레스트: ['navy', 'nuke'], 툴롱: ['navy'], 툴루즈: ['lab', 'air'], 리옹: ['univ'], 스트라스부르: ['army'],
  로마: ['intel', 'bank', 'univ'], 밀라노: ['bank', 'univ'], 타란토: ['navy'], 토리노: ['lab'], 나폴리: ['navy'],
  마드리드: ['intel', 'bank', 'army'], 바르셀로나: ['univ'], 카디스: ['navy'], 사라고사: ['air'], 라코루냐: ['navy'],
  아테네: ['intel', 'bank', 'univ'], 테살로니키: ['army'], 헤라클리온: ['navy'], 라리사: ['air'],
  헬싱키: ['intel', 'bank', 'univ'], 탐페레: ['lab'], 로바니에미: ['air'], 라펜란타: ['army'], 투르쿠: ['navy'],
};
