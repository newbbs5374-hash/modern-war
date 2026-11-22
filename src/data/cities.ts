// 거점 도시 목록(나라마다 3~4개). 지도 위 자리는 나라 네모 안에 고르게 자동 배치한다.
import { COUNTRIES, type Country, type Rect } from './world';

export interface City {
  id: string;
  name: string;
  /** 처음 주인 */
  home: string;
  capital: boolean;
  /** 수입 무게(수도 1.5, 나머지 1) */
  value: number;
  x: number;
  y: number;
}

/** 자동 배치가 어색한 나라만 자리를 직접 정함 */
const MANUAL: Record<string, Array<[number, number]>> = {
  us: [[634, 212], [672, 250], [630, 312], [660, 404]], // 코랄섬은 남쪽 작은 섬
  jp: [[719, 196], [719, 236], [719, 278], [714, 360]],
};

function autoPlace(c: Country): Array<[number, number]> {
  const r: Rect = c.shapes[0];
  const n = c.cities.length;
  return c.cities.map((_, k) => [r.x + (r.w * (k + 1)) / (n + 1), r.y + r.h * (k % 2 === 0 ? 0.3 : 0.72)]);
}

export const CITIES: City[] = COUNTRIES.flatMap((c) => {
  const pos = MANUAL[c.id] ?? autoPlace(c);
  return c.cities.map((name, i) => ({
    id: `${c.id}-${i}`,
    name,
    home: c.id,
    capital: i === 0,
    value: i === 0 ? 1.5 : 1,
    x: pos[i][0],
    y: pos[i][1],
  }));
});

const byId = new Map(CITIES.map((c) => [c.id, c]));
export function cityById(id: string): City {
  const c = byId.get(id);
  if (!c) throw new Error(`없는 도시: ${id}`);
  return c;
}

/** 나라가 처음 가진 도시 무게 합 */
export function homeValue(countryId: string): number {
  return CITIES.filter((c) => c.home === countryId).reduce((s, c) => s + c.value, 0);
}
