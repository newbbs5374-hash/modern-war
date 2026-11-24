// 본부 지도 도시 위 작은 표시(11/24 C1): 특구 아이콘 + 대형 사업 공사 중이면 🏗️+사업 아이콘
import { buildingCities } from './projects';
import { liveZones } from './zones';
import type { GameState } from './state';

export function cityTagMap(s: GameState): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [c, z] of liveZones(s)) out[c] = (out[c] ?? '') + z.icon;
  for (const [c, icon] of Object.entries(buildingCities(s))) out[c] = (out[c] ?? '') + '🏗️' + icon;
  return out;
}
