// 지도자 등급 11개(11/22 대장 결정: 처음부터 지도자로 취임해 등급이 오름). 예전 계급(소위~총사령관) 자리를 그대로 이어받음.
// 봉급은 게임 하루(= 실제 1시간)마다 받는 양. 숫자는 시험용 초안.

export interface Rank {
  name: string;
  unit: string;
  salaryPerDay: number;
}

export const RANKS: Rank[] = [
  { name: '임시 지도자', unit: '소대(병사 4~5)', salaryPerDay: 100 },
  { name: '신임 지도자', unit: '소대 2개', salaryPerDay: 150 },
  { name: '실무 지도자', unit: '중대', salaryPerDay: 220 },
  { name: '국토 수호자', unit: '대대', salaryPerDay: 320 },
  { name: '외교 지도자', unit: '대대 2개', salaryPerDay: 450 },
  { name: '지역 지도자', unit: '연대', salaryPerDay: 620 },
  { name: '존경받는 지도자', unit: '여단', salaryPerDay: 850 },
  { name: '강국 지도자', unit: '사단', salaryPerDay: 1150 },
  { name: '위대한 지도자', unit: '군단', salaryPerDay: 1550 },
  { name: '세계 강자', unit: '군', salaryPerDay: 2100 },
  { name: '전설의 지도자', unit: '전군', salaryPerDay: 3000 },
];
