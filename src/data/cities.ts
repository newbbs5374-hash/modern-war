// 거점 도시 목록. 세계지도 자리는 실제 경도·위도(realmap.ts), 크기·도시 칸은 육각 타일 지도(hexmap.ts): 대도시 61칸 · 중도시 37칸 · 소도시 19칸
import { COUNTRIES } from './world';
import { CITY_HEX, type CitySize } from './hexmap';
import { CITY_LONLAT, project } from './realmap';

/** 수입 무게: 대도시 1.5 · 중도시 1.2 · 소도시 1 */
const VALUE: Record<CitySize, number> = { 4: 1.5, 3: 1.2, 2: 1 };

export interface City {
  id: string;
  name: string;
  /** 처음 주인 */
  home: string;
  capital: boolean;
  /** 육각 반지름: 2 소도시 · 3 중도시 · 4 대도시 */
  size: CitySize;
  /** 수입 무게 */
  value: number;
  x: number;
  y: number;
}

export const CITIES: City[] = COUNTRIES.flatMap((c) =>
  c.cities.map((name, i) => {
    const id = `${c.id}-${i}`;
    const h = CITY_HEX[id];
    // 세계지도 자리 = 실제 위치(육각 칸 자리는 CITY_HEX, 도시·전투 화면용)
    const p = project(...CITY_LONLAT[name]);
    return { id, name, home: c.id, capital: i === 0, size: h.size, value: VALUE[h.size], x: p.x, y: p.y };
  }),
);

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
