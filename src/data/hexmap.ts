// 육각 타일 세계지도. 나중에 이미지 작업을 할 때 이 좌표를 그대로 쓴다.
// - 타일: 뾰족한 위(pointy-top) 육각형, 축 좌표(q, r). 픽셀 중심 x = S·√3·(q + r/2), y = S·1.5·r (S = HEX_SIZE, 꼭짓점까지 거리)
// - 도시 = 육각 칸 묶음: 소도시 19칸 · 중도시 37칸 · 대도시 61칸. 정육각형이 아니라 자연스러운 모양으로 키워 이웃 도시·나라와 이어짐
// - 나라 땅 = 그 나라 도시 묶음의 합. 도시 수는 모티브 나라 면적에 맞춰 정함(world.ts의 cities)
// - 분쟁 섬 12개(19칸, 주인 없음) + 고대 성지(7칸). 나머지는 모두 바다 타일
// 배치는 정해진 규칙(목표 자리에 가장 가까운 빈 곳)으로 계산하므로 언제나 같은 결과가 나온다.
import { COUNTRIES, type Country } from './world';
import type { Res } from './economy';
import { islandXY } from './realmap';

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
export const SIZE_TILES: Record<CitySize, number> = { 2: 37, 3: 61, 4: 91 };
/** 나라 도시 수에 따른 크기: 수도는 4개 이상이면 대도시(아니면 중도시), 4개 이상이면 둘째, 6개 이상이면 셋째도 중도시 */
/** 나라별로 정한 도시 크기(11/24 대한민국 10개 도시: 서울 대도시 · 광역시 4곳 중도시 · 나머지 소도시) */

export function citySizesOf(countryId: string, n: number): CitySize[] {
  // 11-24: 대장 고향 여수·순천·익산은 중도시(칸 271)
  if (countryId === 'kr' && n === 11) return [4, 3, 3, 3, 3, 2, 2, 2, 3, 3, 3];
  return citySizes(n);
}
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
  /** 처음 주인 나라(분쟁 섬·성지는 '') */
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

/** 분쟁 섬 12개(실제 분쟁 섬, 11-24): 이름 · 나는 자원 · 육각 자리(옛 지도 좌표). 실제 위치·다투는 나라는 data/islands.ts */
const PIONEER_DEF: Array<{ id: string; name: string; res: Res | '항구'; at: [number, number] }> = [
  { id: 'p-cheongseok', name: '스프래틀리 군도', res: '갈륨', at: [690, 120] },
  { id: 'p-whale', name: '남쿠릴 열도', res: '석유', at: [820, 60] },
  { id: 'p-storm', name: '로콜 섬', res: '티타늄', at: [130, 50] },
  { id: 'p-twin', name: '파라셀 군도', res: '알루미늄', at: [770, 350] },
  { id: 'p-flame', name: '아부무사 섬', res: '석유', at: [470, 345] },
  { id: 'p-fog', name: '스발바르 제도', res: '갈륨', at: [70, 300] },
  { id: 'p-southwind', name: '코코 제도', res: '석유', at: [380, 540] },
  { id: 'p-coral', name: '스카버러 암초', res: '산호', at: [720, 480] },
  { id: 'p-turtle', name: '웨이크 섬', res: '알루미늄', at: [850, 480] },
  { id: 'p-southcross', name: '카치섬', res: '희토류', at: [110, 540] },
  { id: 'p-blackrock', name: '브랑겔 섬', res: '강철', at: [560, 15] },
  { id: 'p-dawn', name: '센카쿠 열도', res: '항구', at: [770, 220] },
];
const HOLY_AT: [number, number] = [150, 455];
/** 분쟁 섬 크기(칸) */
export const ISLAND_TILES = 7;
/** 땅덩어리: 같은 대륙 나라끼리는 국경을 맞댈 수 있음. 나머지는 섬나라/따로 떨어진 대륙 */
const LANDMASS: Record<string, string> = { de: 'eurasia', ua: 'eurasia', ru: 'eurasia', cn: 'eurasia', kp: 'eurasia', kr: 'eurasia', tr: 'mideast', ir: 'mideast', il: 'mideast' };

/** 같은 대륙 나라는 도시 자리를 직접 정함(국경을 맞대도록). 순서는 world.ts 도시 순서 */
const CITY_AT: Record<string, Array<[number, number]>> = {
  uk: [[70, 190], [70, 135]],
  de: [[190, 195], [180, 145]],
  ru: [[268, 172], [258, 115], [380, 125], [300, 68], [325, 150], [358, 76], [420, 62], [485, 82], [548, 112], [455, 125]],
  ua: [[238, 245], [292, 238], [232, 292]],
  cn: [[555, 190], [600, 228], [565, 292], [615, 300], [480, 145], [525, 250], [458, 205], [640, 262]],
  kp: [[680, 188], [648, 160]],
  kr: [[708, 238], [748, 318], [748, 284], [692, 330], [712, 280], [700, 304], [750, 240], [686, 372], [726, 346], [708, 352], [690, 296]],
  jp: [[812, 225], [796, 292]],
};

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

/** 칸마다 정해진 흔들림(0~1). 이웃 칸끼리 조금씩 닮게 섞어 해안선이 자연스러움 */
function rawNoise(q: number, r: number): number {
  let h = Math.imul(q * 374761393 + r * 668265263, 1274126177) ^ 0x5bd1e995;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function noise(q: number, r: number): number {
  let s = rawNoise(q, r) * 2;
  for (const d of HEX_DIRS) s += rawNoise(q + d.q, r + d.r);
  for (const d of HEX_DIRS) s += 0.5 * rawNoise(q + 2 * d.q, r + 2 * d.r);
  return s / 11;
}

function build() {
  const owner = new Map<string, { home: string; place: string; kind: TileKind; center: boolean; continent: string }>();
  /** 대륙마다 못 쓰는 칸(다른 대륙 땅에서 2칸 안) */
  const forbid = new Map<string, Set<string>>();
  // 땅 덩어리 묶음: 같은 지역끼리는 이어질 수 있음. 일본은 따로 떨어진 긴 섬
  const landGroup = (c: Country) => LANDMASS[c.id] ?? c.id;
  const continents = [...new Set(COUNTRIES.map(landGroup))];
  for (const ct of continents) forbid.set(ct, new Set());
  const GAP = 2;
  const put = (h: Hex, v: { home: string; place: string; kind: TileKind; center: boolean; continent: string }) => {
    owner.set(hexKey(h.q, h.r), v);
    for (const n of disk(h, GAP)) for (const ct of continents) if (ct !== v.continent) forbid.get(ct)!.add(hexKey(n.q, n.r));
  };
  const free = (tiles: Hex[], continent: string) => tiles.every((t) => !owner.has(hexKey(t.q, t.r)) && !forbid.get(continent)?.has(hexKey(t.q, t.r)));

  type Job = { country: Country; idx: number; size: CitySize; target: Hex };
  const jobs: Job[] = [];
  for (const c of COUNTRIES) {
    const sizes = citySizesOf(c.id, c.cities.length);
    const tg = CITY_AT[c.id] ?? targets(c, c.cities.length);
    sizes.forEach((size, idx) => jobs.push({ country: c, idx, size, target: pixelToHex(tg[idx][0], tg[idx][1]) }));
  }
  // 수도 먼저(큰 나라부터), 다음은 둘째 도시들…
  jobs.sort((a, b) => a.idx - b.idx || b.country.cities.length - a.country.cities.length || COUNTRIES.indexOf(a.country) - COUNTRIES.indexOf(b.country));
  const centers: Record<string, Hex & { size: CitySize }> = {};
  const nbrs = (h: Hex) => HEX_DIRS.map((d) => ({ q: h.q + d.q, r: h.r + d.r }));
  /**
   * 정해진 칸 수(19·37·61)만큼 땅을 자연스럽게 키움: 이미 키운 칸·같은 나라·같은 지역 땅에 붙을수록,
   * 가운데에 가까울수록, 칸마다 정해진 흔들림이 클수록 먼저 붙임 → 들쭉날쭉한 해안선, 이웃과 이어지는 땅
   */
  const grow = (center: Hex, n: number, ok: (h: Hex) => boolean, home: string, continent: string): Hex[] | null => {
    if (!ok(center)) return null;
    const blob: Hex[] = [center];
    const inBlob = new Set([hexKey(center.q, center.r)]);
    while (blob.length < n) {
      let best: Hex | null = null;
      let bestScore = -Infinity;
      const seen = new Set<string>();
      for (const b of blob)
        for (const c of nbrs(b)) {
          const k = hexKey(c.q, c.r);
          if (inBlob.has(k) || seen.has(k)) continue;
          seen.add(k);
          if (!ok(c)) continue;
          let nb = 0;
          let own = 0;
          let cont = 0;
          for (const x of nbrs(c)) {
            const kk = hexKey(x.q, x.r);
            if (inBlob.has(kk)) nb++;
            else {
              const o = owner.get(kk);
              if (o && home && o.home === home) own++;
              else if (o && continent && o.continent === continent) cont++;
            }
          }
          const score = nb * 1.0 + own * 0.7 + cont * 0.45 + noise(c.q, c.r) * 2.2 - hexDist(c, center) * 0.4;
          if (score > bestScore) {
            bestScore = score;
            best = c;
          }
        }
      if (!best) return null;
      blob.push(best);
      inBlob.add(hexKey(best.q, best.r));
    }
    return blob;
  };
  for (const j of jobs) {
    const id = `${j.country.id}-${j.idx}`;
    const n = SIZE_TILES[j.size];
    const ok = (h: Hex) => free([h], landGroup(j.country));
    let done: { c: Hex; tiles: Hex[] } | null = null;
    // 목표 자리에서 가까운 순서로, 자기 나라 땅 가까이(둘째 도시부터) 자리를 찾아 키워 봄
    const cands: Array<{ c: Hex; score: number }> = [];
    for (let rad = 0; rad <= 30; rad++)
      for (const c of rad === 0 ? [j.target] : ring(j.target, rad)) {
        if (!ok(c)) continue;
        let near = j.idx === 0;
        if (!near)
          for (const t of disk(c, j.size + 2))
            if (owner.get(hexKey(t.q, t.r))?.home === j.country.id) {
              near = true;
              break;
            }
        cands.push({ c, score: rad + (near ? 0 : 6) });
      }
    cands.sort((a, b) => a.score - b.score);
    for (const { c } of cands.slice(0, 60)) {
      const tiles = grow(c, n, ok, j.country.id, landGroup(j.country));
      if (tiles) {
        done = { c, tiles };
        break;
      }
    }
    if (!done) throw new Error(`도시 자리를 못 찾음: ${id}`);
    const best = done.c;
    centers[id] = { ...best, size: j.size };
    for (const t of done.tiles) put(t, { home: j.country.id, place: id, kind: 'city', center: t.q === best.q && t.r === best.r, continent: landGroup(j.country) });
  }
  // 섬: 다른 땅에서 2칸 떨어진 곳에서 자연스럽게 키움
  const seaOk = (h: Hex) => disk(h, 2).every((x) => !owner.has(hexKey(x.q, x.r)));
  const placeIsland = (at: [number, number], n: number): { c: Hex; tiles: Hex[] } => {
    const tg = pixelToHex(at[0], at[1]);
    for (let rad = 0; rad <= 40; rad++)
      for (const cand of rad === 0 ? [tg] : ring(tg, rad)) {
        const tiles = grow(cand, n, seaOk, '', '');
        if (tiles) return { c: cand, tiles };
      }
    throw new Error('섬 자리를 못 찾음');
  };
  const holy = placeIsland(HOLY_AT, 7);
  const holyC = holy.c;
  for (const t of holy.tiles) put(t, { home: '', place: 'holy', kind: 'holy', center: t.q === holyC.q && t.r === holyC.r, continent: '' });
  const pioneers: PioneerIsland[] = [];
  for (const p of PIONEER_DEF) {
    const { c, tiles } = placeIsland(p.at, ISLAND_TILES);
    for (const t of tiles) put(t, { home: '', place: p.id, kind: 'island', center: t.q === c.q && t.r === c.r, continent: '' });
    pioneers.push({ id: p.id, name: p.name, res: p.res, q: c.q, r: c.r, ...islandXY(p.id) });
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
  return { tiles, centers, pioneers, holy: { q: holyC.q, r: holyC.r, ...islandXY('holy') }, bounds };
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
/** 땅 타일 전부(도시·분쟁 섬·성지). 이 밖은 바다 */
export const TILES: Tile[] = BUILT.tiles;
/** 도시 id → 한가운데 칸과 크기(반지름) */
export const CITY_HEX = BUILT.centers;
export const PIONEER_ISLANDS: PioneerIsland[] = BUILT.pioneers;
export const HOLY_HEX = BUILT.holy;
/** 지도 그림 범위(픽셀) */
export const MAP_BOUNDS = BUILT.bounds;
/** 실사 세계지도 그림(3:2, 1536×1024)을 까는 자리: 지도 범위를 가운데 두고 옆으로 넓힘 */
export const WORLD_ART = (() => {
  const b = BUILT.bounds;
  const w = Math.max(b.w, (b.h * 3) / 2);
  const h = (w * 2) / 3;
  return { x: b.x - (w - b.w) / 2, y: b.y - (h - b.h) / 2, w, h };
})();
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
    설명: '세계 육각 타일 지도. 뾰족한 위 육각형, 축 좌표(q,r). 픽셀 x = size·√3·(q + r/2), y = size·1.5·r. 목록에 없는 칸은 바다.',
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
    holy: { name: '고대 성지', ...HOLY_HEX, ...round(HOLY_HEX), tiles: 7 },
    tiles: TILES.map((t) => ({ q: t.q, r: t.r, ...round(t), kind: t.kind, home: t.home, place: t.place })),
  };
}
const round = (p: { x: number; y: number }) => ({ x: Math.round(p.x * 10) / 10, y: Math.round(p.y * 10) / 10 });
