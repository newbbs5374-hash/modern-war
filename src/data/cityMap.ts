// 도시 화면 칸(11/24 대장 요청 "도시 규모 4~5배"): 세계 육각 지도(hexmap.ts, 전투 화면용)와 따로, 도시마다 자기 칸을 가짐.
// - 칸 수: 소도시 169 · 중도시 271 · 대도시 397(예전 37·61·91의 약 4.5배)
// - 대한민국 10개 도시: 실제 행정구역(구·군) 모양 그대로(krCityShapes.ts, scripts/gen_kr_cities.py). 바깥은 실제 땅(이웃 들판)·바다
// - 다른 나라 도시: 도심에서 자연스럽게 키운 땅. 바다에 닿은 도시는 둘레가 바다, 내륙 도시는 들판
import { COASTAL_CITIES } from './cities';
import { CITIES } from './cities';
import { HEX_DIRS, hexKey, hexToPixel, type CitySize } from './hexmap';
import { KR_CITY_SHAPES } from './krCityShapes';

export const CITY_TILES: Record<CitySize, number> = { 2: 169, 3: 271, 4: 397 };

export interface CityTile {
  q: number;
  r: number;
  x: number;
  y: number;
  center: boolean;
  /** 구·군 번호(대한민국 도시만) */
  gu?: number;
}
export interface CityMap {
  tiles: CityTile[];
  at: Map<string, CityTile>;
  /** 도시 밖이지만 땅인 칸(이웃 들판). 이 밖은 바다(바다에 닿은 도시) */
  outLand: Set<string>;
  /** 바다에 닿았는지 */
  coastal: boolean;
  /** 실제 모양 도시: 구·군 이름 */
  gu?: string[];
  /** 실제 모양 도시: 경도·위도 → 도시 화면 좌표 */
  geo?: (lon: number, lat: number) => { x: number; y: number };
}

function rawNoise(q: number, r: number, seed: number): number {
  let h = Math.imul(q * 374761393 + r * 668265263 + seed * 2246822519, 1274126177) ^ 0x5bd1e995;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function noise(q: number, r: number, seed: number): number {
  let s = rawNoise(q, r, seed) * 2;
  for (const d of HEX_DIRS) s += rawNoise(q + d.q, r + d.r, seed);
  return s / 8;
}
const seedOf = (id: string) => [...id].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) | 0, 7);

/** 도심(0,0)에서 n칸을 자연스럽게 키움(들쭉날쭉한 해안선) */
function growBlob(n: number, seed: number): Array<[number, number]> {
  const blob: Array<[number, number]> = [[0, 0]];
  const inBlob = new Set(['0,0']);
  const front = new Map<string, [number, number]>();
  const addFront = (q: number, r: number) => {
    for (const d of HEX_DIRS) {
      const k = hexKey(q + d.q, r + d.r);
      if (!inBlob.has(k)) front.set(k, [q + d.q, r + d.r]);
    }
  };
  addFront(0, 0);
  while (blob.length < n) {
    let best: string | null = null;
    let bs = -Infinity;
    for (const [k, [q, r]] of front) {
      let nb = 0;
      for (const d of HEX_DIRS) if (inBlob.has(hexKey(q + d.q, r + d.r))) nb++;
      const dist = (Math.abs(q) + Math.abs(r) + Math.abs(q + r)) / 2;
      const sc = nb * 1.0 + noise(q, r, seed) * 2.4 - dist * 0.32;
      if (sc > bs) {
        bs = sc;
        best = k;
      }
    }
    const [q, r] = front.get(best!)!;
    front.delete(best!);
    blob.push([q, r]);
    inBlob.add(best!);
    addFront(q, r);
  }
  return blob;
}

function build(cityId: string): CityMap {
  const city = CITIES.find((c) => c.id === cityId);
  const shape = KR_CITY_SHAPES[cityId];
  const tiles: CityTile[] = [];
  const outLand = new Set<string>();
  let gu: string[] | undefined;
  let geo: CityMap['geo'];
  if (shape) {
    for (const row of shape.t.split(';')) {
      const [q, r, g] = row.split(',').map(Number);
      tiles.push({ q, r, ...hexToPixel(q, r), center: q === 0 && r === 0, gu: g });
    }
    if (shape.o) for (const k of shape.o.split(';')) outLand.add(k);
    gu = shape.gu;
    // 칸 크기 k(경도·위도 단위)를 HEX_SIZE 화면 단위로
    const [lon0, lat0] = shape.c;
    const S = hexToPixel(1, 0).x / Math.sqrt(3); // = HEX_SIZE
    geo = (lon, lat) => ({ x: (((lon - lon0) * shape.cs) / shape.k) * S, y: ((lat0 - lat) / shape.k) * S });
  } else {
    const n = CITY_TILES[(city?.size ?? 2) as CitySize];
    for (const [q, r] of growBlob(n, seedOf(cityId))) tiles.push({ q, r, ...hexToPixel(q, r), center: q === 0 && r === 0 });
    if (city && !COASTAL_CITIES.has(city.name)) {
      // 내륙 도시: 둘레 3칸은 모두 땅
      const have = new Set(tiles.map((t) => hexKey(t.q, t.r)));
      let ring = new Set(have);
      for (let i = 0; i < 3; i++) {
        const nx = new Set(ring);
        for (const k of ring) {
          const [q, r] = k.split(',').map(Number);
          for (const d of HEX_DIRS) nx.add(hexKey(q + d.q, r + d.r));
        }
        ring = nx;
      }
      for (const k of ring) if (!have.has(k)) outLand.add(k);
    }
  }
  const at = new Map(tiles.map((t) => [hexKey(t.q, t.r), t]));
  let coastal = false;
  for (const t of tiles) {
    for (const d of HEX_DIRS) {
      const k = hexKey(t.q + d.q, t.r + d.r);
      if (!at.has(k) && !outLand.has(k)) coastal = true;
    }
    if (coastal) break;
  }
  return { tiles, at, outLand, coastal, gu, geo };
}

const cache = new Map<string, CityMap>();
/** 도시 화면 칸(처음 쓸 때 만들고 기억) */
export function cityMap(cityId: string): CityMap {
  let m = cache.get(cityId);
  if (!m) cache.set(cityId, (m = build(cityId)));
  return m;
}
/** 칸 (q,r) 바깥이 바다인지(도시 칸도 이웃 땅도 아님) */
export function isSeaCell(m: CityMap, q: number, r: number): boolean {
  const k = hexKey(q, r);
  return !m.at.has(k) && !m.outLand.has(k);
}
