// 자리마다 중요한 스탯·성향·출신(11-24 대장 요청 3번: "어떤 스탯이 중요한지, 어떤 성향이 중요한지 안내").
// main 2개가 능력의 80%, sub 1개가 20%. 성향이 맞으면 ×1.1, 출신이 맞으면 ×1.05.
import type { GeneralField } from '../game/loyal';
import type { PersonOrigin, Trait } from './cabinet';
import type { AnyStat } from './stats2';

export interface Need {
  main: [AnyStat, AnyStat];
  sub: AnyStat;
  traits: Trait[];
  origins: PersonOrigin[];
}
const N = (main: [AnyStat, AnyStat], sub: AnyStat, traits: Trait[], origins: PersonOrigin[]): Need => ({ main, sub, traits, origins });

export const NEEDS: Record<string, Need> = {
  // 부처
  mnd: N(['통솔', '지휘'], '군수', ['강경파', '원칙주의', '현장형'], ['general', 'admiral', 'soldier']),
  nis: N(['정보', '정치'], '은밀', ['충직', '신중파', '냉철'], ['spy', 'diplomat', 'prosecutor']),
  mofa: N(['외교', '언변'], '정보', ['협상가', '실용주의'], ['diplomat', 'professor']),
  mof: N(['경제', '행정'], '정치', ['신중파', '실용주의'], ['econ', 'exec']),
  moti: N(['경제', '과학'], '군수', ['혁신가', '실용주의'], ['exec', 'econ', 'scientist']),
  mois: N(['행정', '통솔'], '정치', ['현장형', '원칙주의'], ['mayor', 'partisan']),
  mohw: N(['행정', '매력'], '과학', ['청렴', '현장형'], ['doctor', 'activist']),
  msit: N(['과학', '행정'], '경제', ['혁신가'], ['scientist', 'professor']),
  kocis: N(['언변', '매력'], '정치', ['인기인'], ['broadcaster', 'journalist']),
  mou: N(['외교', '정치'], '언변', ['협상가', '신중파'], ['diplomat', 'religious']),
  moj: N(['법률', '청렴'], '행정', ['원칙주의', '청렴'], ['lawyer', 'prosecutor']),
  moe: N(['행정', '과학'], '매력', ['혁신가', '청렴'], ['professor', 'scientist']),
  molit: N(['행정', '경제'], '군수', ['실용주의', '현장형'], ['mayor', 'exec']),
  mofs: N(['경제', '군수'], '외교', ['현장형', '실용주의'], ['admiral', 'econ']),
  moel: N(['경제', '언변'], '청렴', ['협상가', '청렴'], ['activist', 'commoner']),
  // 대통령실·기관장
  chief: N(['정치', '행정'], '매력', ['충직', '신중파'], ['partisan', 'mayor']),
  polit: N(['정치', '언변'], '매력', ['협상가'], ['partisan']),
  civil: N(['법률', '정보'], '청렴', ['원칙주의', '냉철'], ['prosecutor', 'lawyer']),
  press: N(['언변', '매력'], '정치', ['인기인'], ['broadcaster', 'journalist']),
  society: N(['매력', '청렴'], '언변', ['청렴', '현장형'], ['activist', 'religious']),
  hr: N(['행정', '정보'], '청렴', ['신중파', '원칙주의'], ['prosecutor', 'econ']),
  spokes: N(['언변', '매력'], '체력', ['인기인'], ['broadcaster', 'journalist']),
  policy: N(['행정', '경제'], '정치', ['실용주의', '혁신가'], ['econ', 'professor']),
  econ: N(['경제', '행정'], '정치', ['신중파', '실용주의'], ['econ', 'exec']),
  social: N(['행정', '매력'], '경제', ['청렴', '현장형'], ['doctor', 'activist']),
  sci: N(['과학', '정보'], '행정', ['혁신가'], ['scientist', 'professor']),
  nsa: N(['전술', '외교'], '정보', ['신중파', '냉철'], ['general', 'diplomat']),
  nsa1: N(['외교', '언변'], '정보', ['협상가'], ['diplomat']),
  nsa2: N(['지휘', '전술'], '통솔', ['강경파', '냉철'], ['general', 'admiral']),
  guard: N(['은밀', '체력'], '사격', ['충직', '냉철'], ['commando', 'soldier']),
  pm: N(['행정', '정치'], '매력', ['원칙주의', '신중파'], ['mayor', 'partisan']),
  pros: N(['법률', '정보'], '청렴', ['원칙주의', '냉철'], ['prosecutor', 'lawyer']),
  police: N(['통솔', '행정'], '체력', ['현장형', '원칙주의'], ['prosecutor', 'soldier']),
  tax: N(['경제', '법률'], '청렴', ['원칙주의'], ['econ', 'exec']),
  audit: N(['법률', '청렴'], '행정', ['원칙주의', '청렴'], ['prosecutor', 'lawyer']),
  bok: N(['경제', '과학'], '청렴', ['신중파'], ['econ', 'professor']),
  dapa: N(['군수', '과학'], '지휘', ['실용주의', '혁신가'], ['exec', 'soldier']),
};

/** 장군 자리 */
export const GENERAL_NEEDS: Record<GeneralField, Need> = {
  합참: N(['지휘', '전술'], '통솔', ['강경파', '신중파'], ['general', 'admiral']),
  육군: N(['지휘', '통솔'], '전술', ['현장형', '강경파'], ['general', 'soldier']),
  해군: N(['지휘', '포격'], '전술', ['현장형', '냉철'], ['admiral']),
  공군: N(['지휘', '과학'], '전술', ['혁신가', '냉철'], ['general', 'soldier']),
  정보: N(['정보', '은밀'], '전술', ['냉철', '신중파'], ['spy', 'commando']),
  군수: N(['군수', '행정'], '지휘', ['실용주의'], ['exec', 'soldier']),
};
