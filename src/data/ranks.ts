// 지도자 혜택 단계 11개(자리 수·잠금·봉급). 11-23부터 단계는 승급이 아니라 호칭(신뢰도+명성)으로 정해짐.
// 봉급은 게임 하루(= 실제 1시간)마다 받는 양. 숫자는 시험용 초안.

export interface Rank {
  name: string;
  unit: string;
  salaryPerDay: number;
}

/**
 * 호칭 15단계(11-23 대장 결정: 승급 제도를 빼고 "신뢰도 + 명성 점수"(최대 200)로 호칭이 정해짐).
 * min = 이 호칭이 되는 최소 점수. 점수가 내려가면 호칭도 내려감(3점 여유).
 */
export interface Title {
  name: string;
  icon: string;
  min: number;
}
export const TITLES: Title[] = [
  { name: '신참 지도자', icon: '▫️', min: 0 },
  { name: '초보 지도자', icon: '◽', min: 60 },
  { name: '실무형 지도자', icon: '🔹', min: 70 },
  { name: '믿음직한 지도자', icon: '🔷', min: 80 },
  { name: '국민의 일꾼', icon: '🔶', min: 90 },
  { name: '개혁가', icon: '🟧', min: 100 },
  { name: '노련한 정치가', icon: '🟠', min: 110 },
  { name: '국민의 지도자', icon: '⭐', min: 120 },
  { name: '존경받는 지도자', icon: '🌟', min: 130 },
  { name: '강단 있는 지도자', icon: '⭐⭐', min: 140 },
  { name: '국가의 기둥', icon: '🏛️', min: 150 },
  { name: '위대한 지도자', icon: '⭐⭐⭐', min: 160 },
  { name: '세계의 지도자', icon: '🌐', min: 170 },
  { name: '역사적 지도자', icon: '📜', min: 180 },
  { name: '전설의 지도자', icon: '🎖️', min: 190 },
];
/** 호칭 단계 → 혜택 단계(0~10). 자리 수·잠금·봉급은 이 단계를 따름 */
export const rankOfTier = (t: number) => Math.round((Math.max(0, Math.min(TITLES.length - 1, t)) * 10) / (TITLES.length - 1));
/** 혜택 단계 r이 열리는 첫 호칭 */
export const firstTierOfRank = (r: number) => {
  const t = TITLES.findIndex((_, i) => rankOfTier(i) >= r);
  return t < 0 ? TITLES.length - 1 : t;
};

const RANK_BASE: Array<Omit<Rank, 'name'>> = [
  { unit: '소대(병사 4~5)', salaryPerDay: 100 },
  { unit: '소대 2개', salaryPerDay: 150 },
  { unit: '중대', salaryPerDay: 220 },
  { unit: '대대', salaryPerDay: 320 },
  { unit: '대대 2개', salaryPerDay: 450 },
  { unit: '연대', salaryPerDay: 620 },
  { unit: '여단', salaryPerDay: 850 },
  { unit: '사단', salaryPerDay: 1150 },
  { unit: '군단', salaryPerDay: 1550 },
  { unit: '군', salaryPerDay: 2100 },
  { unit: '전군', salaryPerDay: 3000 },
];
/** 혜택 단계 11개. 이름은 그 단계가 열리는 호칭("○○부터" 안내에 씀) */
export const RANKS: Rank[] = RANK_BASE.map((b, r) => ({ ...b, name: TITLES[firstTierOfRank(r)].name }));
