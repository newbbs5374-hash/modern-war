// 도시 성장 정도(0~1): 지도에서 도시가 넓어지고 밤 불빛이 밝아지는 정도(11/24 C1·C2).
// 지금은 인구(1~10단계)로 정함. 건물 단계(A1)가 들어오면 함께 셈.
import { CITIES } from '../data/cities';
import { POP_MAX } from '../data/civ';
import { cityCiv } from './civ';
import type { GameState } from './state';

export function cityGrowth(s: GameState, cityId: string): number {
  const pop = cityCiv(s, cityId).pop;
  return Math.max(0, Math.min(1, pop / POP_MAX));
}

export function cityGrowthMap(s: GameState, countryId: string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const c of CITIES) if (c.home === countryId || s.world.owner[c.id] === countryId) out[c.id] = cityGrowth(s, c.id);
  return out;
}
