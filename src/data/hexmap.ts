// 육각 타일 세계지도(여명 군도). 나중에 이미지 작업을 할 때 이 좌표를 그대로 쓴다.
// - 타일: 뾰족한 위(pointy-top) 육각형, 축 좌표(q, r). 픽셀 중심 x = S·√3·(q + r/2), y = S·1.5·r (S = HEX_SIZE, 꼭짓점까지 거리)
// - 도시 = 육각 묶음: 소도시 반지름 2(19칸) · 중도시 반지름 3(37칸) · 대도시 반지름 4(61칸)
// - 나라 땅 = 그 나라 도시 묶음의 합. 도시 수는 모티브 나라 면적에 맞춰 정함(world.ts의 cities)
// - 개척 섬 12개(19칸, 주인 없음) + 떠오른 성소(7칸). 나머지는 모두 바다 타일
// 배치는 정해진 규칙(목표 자리에 가장 가까운 빈 곳)으로 계산하므로 언제나 같은 결과가 나온다.
import { COUNTRIES, type Country } from './world';
import type { Res } from './economy';

export const HEX_SIZE = 5.2;
const SQ3 = Math.sqrt(3);

export type Hex = { q: number; r: number };
export const hexKey = (q: number, r: number) => `${q},${r}`;
export const hexToPixel = (q: number, r: number) => ({ x: HEX_SIZE * SQ3 * (q + r / 2), y: HEX_SIZE * 1.5 * r });
export function pixelToHex(x: number, y: number): Hex {
  const qf = ((SQ3 / 3) * x - y / 3) / HEX_SIZE;
  const rf = ((2 / 3) * y) / HEX_SIZE;
  const sf = -qf - rf;
  let q = Math.round(qf);
  let r = Math.round(rf);
  const s = Math.round(sf);
  const dq = Math.abs(q - qf);
  const dr = Math.abs(r - rf);
  const ds = Math.abs(s - sf);
  if (dq > dr && dq > ds) q = -r - s;
  else if (dr > ds) r = -q - s;
  return { q, r };
}
export const hexDist = (a: Hex, b: Hex) => (Math.abs(a.q - b.q) + Math.abs(a.r - b.r) + Math.abs(a.q + a.r - b.q - b.r)) / 2;
export const HEX_DIRS: Hex[] = [
  { q: 1, r: 0 },
  { q: 1, r: -1 },
  { q: 0, r: -1 },
  { q: -1, r: 0 },
  { q: -1, r: 1 },
  { q: 0, r: 1 },
];
export function disk(c: Hex, R: number): Hex[] {
  const out: Hex[] = [];
  for (let dq = -R; dq <= R; dq++) for (let dr = Math.max(-R, -dq - R); dr <= Math.min(R, -dq + R); dr++) out.push({ q: c.q + dq, r: c.r + dr });
  return out;
}
/** 꼭짓점 i와 i+1 사이 변이 닿는 이웃 방향(HEX_DIRS 번호) */
export const EDGE_DIR = [0, 5, 4, 3, 2, 1];
/** 육각형 꼭짓점(픽셀) */
export function hexCorners(x: number, y: number, s = HEX_SIZE): Array<[number, number]> {
  return Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 180) * (60 * i - 30);
    return [x + s * Math.cos(a), y + s * Math.sin(a)];
  });
}

/** 도시 크기: 반지름 2·3·4 → 19·37·61칸 */
export type CitySize = 2 | 3 | 4;
export const SIZE_NAME: Record<CitySize, string> = { 2: '소도시', 3: '중도시', 4: '대도시' };
export const SIZE_TILES: Record<CitySize, number> = { 2: 19, 3: 37, 4: 61 };
/** 나라 도시 수에 따른 크기: 수도는 4개 이상이면 대도시(아니면 중도시), 4개 이상이면 둘째, 6개 이상이면 셋째도 중도시 */
export function citySizes(n: number): CitySize[] {
  return Array.from({ length: n }, (_, i) => (i === 0 ? (n >= 4 ? 4 : 3) : i === 1 && n >= 4 ? 3 : i === 2 && n >= 6 ? 3 : 2));
}

export type TileKind = 'city' | 'island' | 'holy';
export interface Tile {
  q: number;
  r: number;
  x: number;
  y: number;
  kind: TileKind;
  /** 처음 주인 나라(개척 섬·성소는 '') */
  home: string;
  /** 도시 id(나라-번호) 또는 섬 id */
  place: string;
  /** 도시·섬의 한가운데 칸 */
  center: boolean;
}

export interface PioneerIsland {
  id: string;
  name: string;
  res: Res | '항구';
  q: number;
  r: number;
  x: number;
  y: number;
}

/** 개척 섬 12개: 이름 · 나는 자원 · 놓을 자리(옛 지도 좌표 근처). 기획 스레드 목록과 같음 */
const PIONEER_DEF: Array<{ id: string; name: string; res: Res | '항구'; at: [number, number] }> = [
  { id: 'p-cheongseok', name: '청석섬', res: '희토류', at: [250, 160] },
  { id: 'p-whale', name: '고래섬', res: '석유', at: [640, 120] },
  { id: 'p-storm', name: '폭풍섬', res: '티타늄', at: [120, 110] },
  { id: 'p-twin', name: '쌍둥이섬', res: '알루미늄', at: [560, 175] },
  { id: 'p-flame', name: '불꽃섬', res: '석유', at: [300, 470] },
  { id: 'p-fog', name: '안개섬', res: '리튬', at: [30, 330] },
  { id: 'p-southwind', name: '남풍섬', res: '석유', at: [440, 470] },
  { id: 'p-coral', name: '산호환초', res: '리튬', at: [580, 450] },
  { id: 'p-turtle', name: '거북섬', res: '알루미늄', at: [760, 330] },
  { id: 'p-southcross', name: '남십자섬', res: '희토류', at: [170, 520] },
  { id: 'p-blackrock', name: '검은바위섬', res: '강철', at: [660, 30] },
  { id: 'p-dawn', name: '새벽섬', res: '항구', at: [560, 300] },
];
const HOLY_AT: [number, number] = [118, 318];

/** 나라 네모(옛 지도 좌표) 안에 도시 목표 자리를 긴 쪽으로 고르게 */
function targets(c: Country, n: number): Array<[number, number]> {
  const rects = c.shapes;
  const total = rects.reduce((s, r) => s + r.w * r.h, 0);
  // 네모마다 도시 수(넓이 비율, 첫 네모에 수도)
  const counts = rects.map((r) => Math.max(0, Math.round((n * r.w * r.h) / total)));
  let diff = n - counts.reduce((a, b) => a + b, 0);
  for (let i = 0; diff !== 0; i = (i + 1) % rects.length) {
    if (diff > 0) {
      counts[i]++;
      diff--;
    } else if (counts[i] > (i === 0 ? 1 : 0)) {
      counts[i]--;
      diff++;
    }
  }
  const out: Array<[number, number]> = [];
  rects.forEach((r, i) => {
    const k = counts[i];
    const long = r.w >= r.h;
    for (let j = 0; j < k; j++) {
      // 수도는 가운데, 나머지는 양쪽으로 번갈아
      const t = k === 1 ? 0.5 : j === 0 ? 0.5 : 0.5 + (j % 2 === 1 ? -1 : 1) * Math.ceil(j / 2) * (0.5 / Math.ceil((k - 1) / 2 + 0.01));
      const side = j % 4 < 2 ? 0.35 : 0.65;
      out.push(long ? [r.x + r.w * t, r.y + r.h * (k > 3 ? side : 0.5)] : [r.x + r.w * (k > 3 ? side : 0.5), r.y + r.h * t]);
    }
  });
  return out;
}

function build() {
  const owner = new Map<string, { home: string; place: string; kind: TileKind; center: boolean; continent: string }>();
  /** 대륙마다 못 쓰는 칸(다른 대륙 땅에서 2칸 안) */
  const forbid = new Map<string, Set<string>>();
  const continents = [...new Set(COUNTRIES.map((c) => c.continent))];
  for (const ct of continents) forbid.set(ct, new Set());
  const GAP = 3;
  const put = (h: Hex, v: { home: string; place: string; kind: TileKind; center: boolean; continent: string }) => {
    owner.set(hexKey(h.q, h.r), v);
    for (const n of disk(h, GAP)) for (const ct of continents) if (ct !== v.continent) forbid.get(ct)!.add(hexKey(n.q, n.r));
  };
  const free = (tiles: Hex[], continent: string) => tiles.every((t) => !owner.has(hexKey(t.q, t.r)) && !forbid.get(continent)?.has(hexKey(t.q, t.r)));

  type Job = { country: Country; idx: number; size: CitySize; target: Hex };
  const jobs: Job[] = [];
  for (const c of COUNTRIES) {
    const sizes = citySizes(c.cities.length);
    const tg = targets(c, c.cities.length);
    sizes.forEach((size, idx) => jobs.push({ country: c, idx, size, target: pixelToHex(tg[idx][0], tg[idx][1]) }));
  }
  // 수도 먼저(큰 나라부터), 다음은 둘째 도시들…
  jobs.sort((a, b) => a.idx - b.idx || b.country.cities.length - a.country.cities.length || COUNTRIES.indexOf(a.country) - COUNTRIES.indexOf(b.country));
  const centers: Record<string, Hex & { size: CitySize }> = {};
  for (const j of jobs) {
    const id = `${j.country.id}-${j.idx}`;
    let best: Hex | null = null;
    let bestScore = Infinity;
    for (let rad = 0; rad <= 30 && (best === null || rad <= bestScore + 1); rad++) {
      for (const cand of rad === 0 ? [j.target] : ring(j.target, rad)) {
        const tiles = disk(cand, j.size);
        if (!free(tiles, j.country.continent)) continue;
        // 자기 나라 땅에 붙으면 좋음(첫 도시는 상관없음)
        let touch = j.idx === 0;
        if (!touch)
          for (const t of disk(cand, j.size + 1))
            if (owner.get(hexKey(t.q, t.r))?.home === j.country.id) {
              touch = true;
              break;
            }
        const score = rad + (touch ? 0 : 6);
        if (score < bestScore) {
          bestScore = score;
          best = cand;
        }
      }
    }
    if (!best) throw new Error(`도시 자리를 못 찾음: ${id}`);
    centers[id] = { ...best, size: j.size };
    for (const t of disk(best, j.size)) put(t, { home: j.country.id, place: id, kind: 'city', center: t.q === best.q && t.r === best.r, continent: j.country.continent });
  }
  // 섬: 모든 땅에서 2칸 떨어진 곳
  const allFree = (tiles: Hex[]) =>
    tiles.every((t) => disk(t, 2).every((n) => !owner.has(hexKey(n.q, n.r))));
  const placeIsland = (at: [number, number], R: number): Hex => {
    const tg = pixelToHex(at[0], at[1]);
    for (let rad = 0; rad <= 40; rad++) for (const cand of rad === 0 ? [tg] : ring(tg, rad)) if (allFree(disk(cand, R))) return cand;
    throw new Error('섬 자리를 못 찾음');
  };
  const holyC = placeIsland(HOLY_AT, 1);
  for (const t of disk(holyC, 1)) put(t, { home: '', place: 'holy', kind: 'holy', center: t.q === holyC.q && t.r === holyC.r, continent: '' });
  const pioneers: PioneerIsland[] = [];
  for (const p of PIONEER_DEF) {
    const c = placeIsland(p.at, 2);
    for (const t of disk(c, 2)) put(t, { home: '', place: p.id, kind: 'island', center: t.q === c.q && t.r === c.r, continent: '' });
    pioneers.push({ id: p.id, name: p.name, res: p.res, q: c.q, r: c.r, ...hexToPixel(c.q, c.r) });
  }
  const tiles: Tile[] = [...owner.entries()].map(([k, v]) => {
    const [q, r] = k.split(',').map(Number);
    return { q, r, ...hexToPixel(q, r), kind: v.kind, home: v.home, place: v.place, center: v.center };
  });
  tiles.sort((a, b) => a.r - b.r || a.q - b.q);
  const xs = tiles.map((t) => t.x);
  const ys = tiles.map((t) => t.y);
  const M = 34;
  const bounds = { x: Math.floor(Math.min(...xs) - M), y: Math.floor(Math.min(...ys) - M), w: 0, h: 0 };
  bounds.w = Math.ceil(Math.max(...xs) + M - bounds.x);
  bounds.h = Math.ceil(Math.max(...ys) + M - bounds.y);
  return { tiles, centers, pioneers, holy: { q: holyC.q, r: holyC.r, ...hexToPixel(holyC.q, holyC.r) }, bounds };
}

function ring(c: Hex, R: number): Hex[] {
  const out: Hex[] = [];
  let h = { q: c.q + HEX_DIRS[4].q * R, r: c.r + HEX_DIRS[4].r * R };
  for (let d = 0; d < 6; d++)
    for (let i = 0; i < R; i++) {
      out.push(h);
      h = { q: h.q + HEX_DIRS[d].q, r: h.r + HEX_DIRS[d].r };
    }
  return out;
}

const BUILT = build();
/** 땅 타일 전부(도시·개척 섬·성소). 이 밖은 바다 */
export const TILES: Tile[] = BUILT.tiles;
/** 도시 id → 한가운데 칸과 크기(반지름) */
export const CITY_HEX = BUILT.centers;
export const PIONEER_ISLANDS: PioneerIsland[] = BUILT.pioneers;
export const HOLY_HEX = BUILT.holy;
/** 지도 그림 범위(픽셀) */
export const MAP_BOUNDS = BUILT.bounds;
export const TILE_AT = new Map(TILES.map((t) => [hexKey(t.q, t.r), t]));

/** 수도 앞바다: 수도에서 가장 가까운, 땅에서 2칸 떨어진 바다 칸 */
export function seaNear(countryId: string): { x: number; y: number } {
  const c = CITY_HEX[`${countryId}-0`];
  for (let rad = 1; rad < 40; rad++)
    for (const h of ring(c, rad)) if (disk(h, 2).every((n) => !TILE_AT.has(hexKey(n.q, n.r)))) return hexToPixel(h.q, h.r);
  return hexToPixel(c.q, c.r);
}

/** 이미지 작업용 자료(JSON) */
export function hexmapData() {
  return {
    설명: '여명 군도 육각 타일 지도. 뾰족한 위 육각형, 축 좌표(q,r). 픽셀 x = size·√3·(q + r/2), y = size·1.5·r. 목록에 없는 칸은 바다.',
    size: HEX_SIZE,
    orientation: 'pointy-top',
    bounds: MAP_BOUNDS,
    countries: COUNTRIES.map((c) => ({
      id: c.id,
      name: c.name,
      cities: c.cities.map((name, i) => {
        const h = CITY_HEX[`${c.id}-${i}`];
        return { id: `${c.id}-${i}`, name, capital: i === 0, size: SIZE_NAME[h.size], tiles: SIZE_TILES[h.size], q: h.q, r: h.r, ...round(hexToPixel(h.q, h.r)) };
      }),
      tiles: TILES.filter((t) => t.home === c.id).length,
    })),
    pioneerIslands: PIONEER_ISLANDS.map((p) => ({ ...p, ...round(p), tiles: 19 })),
    holy: { name: '떠오른 성소', ...HOLY_HEX, ...round(HOLY_HEX), tiles: 7 },
    tiles: TILES.map((t) => ({ q: t.q, r: t.r, ...round(t), kind: t.kind, home: t.home, place: t.place })),
  };
}
const round = (p: { x: number; y: number }) => ({ x: Math.round(p.x * 10) / 10, y: Math.round(p.y * 10) / 10 });
