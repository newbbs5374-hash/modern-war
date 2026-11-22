// 계급 11개(기획서 "진급: 소위에서 총사령관까지").
// 봉급은 게임 하루(= 실제 1시간)마다 받는 양. 숫자는 시험용 초안.

export interface Rank {
  name: string;
  unit: string;
  salaryPerDay: number;
}

export const RANKS: Rank[] = [
  { name: '소위', unit: '소대(병사 4~5)', salaryPerDay: 100 },
  { name: '중위', unit: '소대 2개', salaryPerDay: 150 },
  { name: '대위', unit: '중대', salaryPerDay: 220 },
  { name: '소령', unit: '대대', salaryPerDay: 320 },
  { name: '중령', unit: '대대 2개', salaryPerDay: 450 },
  { name: '대령', unit: '연대', salaryPerDay: 620 },
  { name: '준장', unit: '여단', salaryPerDay: 850 },
  { name: '소장', unit: '사단', salaryPerDay: 1150 },
  { name: '중장', unit: '군단', salaryPerDay: 1550 },
  { name: '대장', unit: '군', salaryPerDay: 2100 },
  { name: '총사령관', unit: '전군', salaryPerDay: 3000 },
];
