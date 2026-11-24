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
  { id: 'bank', name: '금융 센터', icon: '🏦', does: '국방예산 +4%' },
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
  대구: ['air', 'army'], 광주: ['air'], 대전: ['lab', 'univ'], 전주: [], 강릉: ['air'], 제주: ['navy'], 여수: [], 순천: [],
  앙카라: ['army'], 이스탄불: ['bank', 'navy'], 이즈미르: ['air'],
  텔아비브: ['lab', 'intel'], 하이파: ['navy'],
  테헤란: ['intel'], 이스파한: ['nuke'], 반다르아바스: ['navy'], 시라즈: [],
  키이우: ['univ'], 하르키우: ['army'], 오데사: ['navy'],
  평양: ['army', 'intel'], 남포: ['navy'],
};
