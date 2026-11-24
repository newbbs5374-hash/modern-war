// 도시 성장(11/24 C1·C2): 실제 인구(만 명)로 7단계(마을 → 세계 도시).
// 지도에서 도시가 넓어지고 건물이 높아지며 밤 불빛이 밝아지는 정도를 정함.
import { CITIES, cityById } from '../data/cities';
import { POP_MAX } from '../data/civ';
import { cityCiv, cityPeople } from './civ';
import type { GameState } from './state';

export interface CityStage {
  /** 0 = 마을 … 6 = 세계 도시 */
  lv: number;
  name: string;
  icon: string;
  /** 이 단계가 시작되는 인구(만 명) */
  min: number;
}
export const CITY_STAGES: CityStage[] = [
  { lv: 0, name: '마을', icon: '🏡', min: 0 },
  { lv: 1, name: '소도시', icon: '🏘️', min: 5 },
  { lv: 2, name: '중도시', icon: '🏢', min: 20 },
  { lv: 3, name: '대도시', icon: '🏙️', min: 50 },
  { lv: 4, name: '광역시', icon: '🌆', min: 100 },
  { lv: 5, name: '메가시티', icon: '🌃', min: 500 },
  { lv: 6, name: '세계 도시', icon: '🌐', min: 1000 },
];

/** 인구(만 명) → 단계와 다음 단계까지 진행(0~1) */
export function stageOfPeople(people: number): { stage: CityStage; next: CityStage | null; frac: number } {
  let i = 0;
  while (i + 1 < CITY_STAGES.length && people >= CITY_STAGES[i + 1].min) i++;
  const stage = CITY_STAGES[i];
  const next = CITY_STAGES[i + 1] ?? null;
  const frac = next ? Math.max(0, Math.min(1, (people - stage.min) / (next.min - stage.min))) : 1;
  return { stage, next, frac };
}
export function cityStage(s: GameState, cityId: string) {
  return stageOfPeople(cityPeople(s, cityId));
}
/** 취임 첫날 인구(만 명): 발전 단계가 처음 값일 때 */
export function cityPeopleAtStart(s: GameState, cityId: string): number {
  const c = cityById(cityId);
  const now = cityPeople(s, cityId);
  const grown = cityCiv(s, cityId).pop - (c.size - 1);
  return Math.round(now / (1 + 0.08 * grown));
}

/** 성장 정도(0~1): 발전 단계와 도시 단계를 반씩 */
export function cityGrowth(s: GameState, cityId: string): number {
  const pop = cityCiv(s, cityId).pop;
  const { stage, frac } = cityStage(s, cityId);
  const g = 0.5 * (pop / POP_MAX) + 0.5 * ((stage.lv + frac) / (CITY_STAGES.length - 1));
  return Math.max(0, Math.min(1, g));
}

export function cityGrowthMap(s: GameState, countryId: string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const c of CITIES) if (c.home === countryId || s.world.owner[c.id] === countryId) out[c.id] = cityGrowth(s, c.id);
  return out;
}
