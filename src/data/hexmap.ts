// 육각 타일 세계지도. 나중에 이미지 작업을 할 때 이 좌표를 그대로 쓴다.
// - 타일: 뾰족한 위(pointy-top) 육각형, 축 좌표(q, r). 픽셀 중심 x = S·√3·(q + r/2), y = S·1.5·r (S = HEX_SIZE, 꼭짓점까지 거리)
// - 도시 = 육각 칸 묶음: 소도시 19칸 · 중도시 37칸 · 대도시 61칸. 정육각형이 아니라 자연스러운 모양으로 키워 이웃 도시·나라와 이어짐
// - 나라 땅 = 그 나라 도시 묶음의 합. 도시 수는 모티브 나라 면적에 맞춰 정함(world.ts의 cities)
// - 분쟁 섬 12개(19칸, 주인 없음) + 고대 성지(7칸). 나머지는 모두 바다 타일
// 배치는 정해진 규칙(목표 자리에 가장 가까운 빈 곳)으로 계산하므로 언제나 같은 결과가 나온다.
import { COUNTRIES } from "./world";
import type { Res } from "./economy";
import {
  LAND_BASE,
  blob,
  inPoly,
  naturalOutline,
  seedOf,
  type Pt,
} from "./land";

export const HEX_SIZE = 5.2;
const SQ3 = Math.sqrt(3);

export type Hex = { q: number; r: number };
export const hexKey = (q: number, r: number) => `${q},${r}`;
export const hexToPixel = (q: number, r: number) => ({
  x: HEX_SIZE * SQ3 * (q + r / 2),
  y: HEX_SIZE * 1.5 * r,
});
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
export const hexDist = (a: Hex, b: Hex) =>
  (Math.abs(a.q - b.q) +
    Math.abs(a.r - b.r) +
    Math.abs(a.q + a.r - b.q - b.r)) /
  2;
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
  for (let dq = -R; dq <= R; dq++)
    for (let dr = Math.max(-R, -dq - R); dr <= Math.min(R, -dq + R); dr++)
      out.push({ q: c.q + dq, r: c.r + dr });
  return out;
}
/** 꼭짓점 i와 i+1 사이 변이 닿는 이웃 방향(HEX_DIRS 번호) */
export const EDGE_DIR = [0, 5, 4, 3, 2, 1];
/** 육각형 꼭짓점(픽셀) */
export function hexCorners(
  x: number,
  y: number,
  s = HEX_SIZE,
): Array<[number, number]> {
  return Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 180) * (60 * i - 30);
    return [x + s * Math.cos(a), y + s * Math.sin(a)];
  });
}

/** 도시 크기: 반지름 2·3·4 → 19·37·61칸 */
export type CitySize = 2 | 3 | 4;
export const SIZE_NAME: Record<CitySize, string> = {
  2: "소도시",
  3: "중도시",
  4: "대도시",
};
export const SIZE_TILES: Record<CitySize, number> = { 2: 37, 3: 61, 4: 91 };
/** 나라 도시 수에 따른 크기: 수도는 4개 이상이면 대도시(아니면 중도시), 4개 이상이면 둘째, 6개 이상이면 셋째도 중도시 */
export function citySizes(n: number): CitySize[] {
  return Array.from({ length: n }, (_, i) =>
    i === 0
      ? n >= 4
        ? 4
        : 3
      : i === 1 && n >= 4
        ? 3
        : i === 2 && n >= 6
          ? 3
          : 2,
  );
}

export type TileKind = "city" | "island" | "holy";
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
  res: Res | "항구";
  q: number;
  r: number;
  x: number;
  y: number;
}

/** 분쟁 섬 12개: 이름 · 나는 자원 · 놓을 자리(옛 지도 좌표 근처). 기획 스레드 목록과 같음 */
const PIONEER_DEF: Array<{
  id: string;
  name: string;
  res: Res | "항구";
  at: [number, number];
}> = [
  { id: "p-cheongseok", name: "푸른암초", res: "갈륨", at: [745, 128] },
  { id: "p-whale", name: "고래섬", res: "석유", at: [820, 60] },
  { id: "p-storm", name: "폭풍섬", res: "티타늄", at: [130, 50] },
  { id: "p-twin", name: "쌍둥이섬", res: "알루미늄", at: [760, 380] },
  { id: "p-flame", name: "불꽃섬", res: "석유", at: [392, 270] },
  { id: "p-fog", name: "안개섬", res: "갈륨", at: [40, 300] },
  { id: "p-southwind", name: "남풍섬", res: "석유", at: [420, 545] },
  { id: "p-coral", name: "산호환초", res: "산호", at: [700, 470] },
  { id: "p-turtle", name: "거북섬", res: "알루미늄", at: [860, 485] },
  { id: "p-southcross", name: "남십자섬", res: "희토류", at: [110, 525] },
  { id: "p-blackrock", name: "검은바위섬", res: "강철", at: [560, 8] },
  { id: "p-dawn", name: "새벽섬", res: "항구", at: [766, 212] },
];
const HOLY_AT: Pt = [186, 470];
/** 분쟁 섬 크기(칸) */
export const ISLAND_TILES = 7; // (예전 값) 지금 섬 칸 수는 모양에 따라 5~12칸
/** 땅덩어리: 같은 대륙 나라끼리는 국경을 맞댈 수 있음. 나머지는 섬나라/따로 떨어진 대륙 */
const LANDMASS: Record<string, string> = {
  de: "eurasia",
  ua: "eurasia",
  ru: "eurasia",
  cn: "eurasia",
  kp: "eurasia",
  kr: "eurasia",
  tr: "mideast",
  ir: "mideast",
  il: "mideast",
  uk: "uk",
  jp: "japan",
  in: "india",
  us: "us",
};
/** 도시 크기별 땅 넓이 가중치(클수록 넓게 차지) */
const CITY_WEIGHT: Record<CitySize, number> = { 2: 1, 3: 1.18, 4: 1.38 };

/** 같은 대륙 나라는 도시 자리를 직접 정함(국경을 맞대도록). 순서는 world.ts 도시 순서 */
const CITY_AT: Record<string, Pt[]> = {
  uk: [
    [82, 205],
    [66, 150],
  ],
  de: [
    [185, 215],
    [165, 165],
  ],
  ua: [
    [235, 268],
    [282, 272],
    [228, 305],
  ],
  ru: [
    [272, 205],
    [250, 120],
    [380, 150],
    [236, 80],
    [330, 180],
    [300, 98],
    [420, 92],
    [510, 90],
    [628, 110],
    [450, 145],
  ],
  cn: [
    [580, 200],
    [615, 232],
    [568, 302],
    [610, 305],
    [520, 182],
    [540, 255],
    [482, 232],
    [636, 268],
  ],
  kp: [
    [690, 185],
    [665, 160],
  ],
  kr: [
    [712, 242],
    [722, 286],
  ],
  jp: [
    [826, 228],
    [784, 312],
  ],
  tr: [
    [252, 365],
    [198, 372],
    [300, 362],
  ],
  ir: [
    [382, 395],
    [410, 428],
    [440, 420],
    [350, 445],
  ],
  il: [
    [240, 478],
    [232, 440],
  ],
  in: [
    [560, 398],
    [622, 400],
    [565, 470],
    [590, 450],
    [522, 420],
  ],
  us: [
    [1018, 240],
    [1033, 195],
    [894, 250],
    [900, 330],
    [948, 232],
    [924, 380],
    [988, 190],
    [973, 320],
  ],
};

/** 땅 칸 조각 = 해안선 안쪽 칸 */
function build() {
  const owner = new Map<
    string,
    { home: string; place: string; kind: TileKind; center: boolean }
  >();
  const outlines: Array<{ id: string; pts: Pt[] }> = [];
  const inside = (pts: Pt[]) => {
    const xs = pts.map((p) => p[0]);
    const ys = pts.map((p) => p[1]);
    const a = pixelToHex(Math.min(...xs) - 10, Math.min(...ys) - 10);
    const b = pixelToHex(Math.max(...xs) + 10, Math.max(...ys) + 10);
    const out: Hex[] = [];
    for (let r = a.r - 2; r <= b.r + 2; r++)
      for (let q = a.q - 40; q <= b.q + 40; q++) {
        const { x, y } = hexToPixel(q, r);
        if (inPoly(x, y, pts)) out.push({ q, r });
      }
    return out;
  };
  const nbrs = (h: Hex) =>
    HEX_DIRS.map((d) => ({ q: h.q + d.q, r: h.r + d.r }));
  const centers: Record<string, Hex & { size: CitySize }> = {};
  // 1) 나라 땅: 땅덩어리마다 칸을 가장 가까운 도시(큰 도시일수록 넓게)에 나눔
  for (const [land, base] of Object.entries(LAND_BASE)) {
    const pts = naturalOutline(base, seedOf(land));
    outlines.push({ id: land, pts });
    const cells = inside(pts);
    const seeds: Array<{
      id: string;
      home: string;
      x: number;
      y: number;
      w: number;
      size: CitySize;
    }> = [];
    for (const c of COUNTRIES) {
      if (LANDMASS[c.id] !== land) continue;
      const sizes = citySizes(c.cities.length);
      CITY_AT[c.id].forEach(([x, y], i) =>
        seeds.push({
          id: `${c.id}-${i}`,
          home: c.id,
          x,
          y,
          w: CITY_WEIGHT[sizes[i]],
          size: sizes[i],
        }),
      );
    }
    const place = new Map<string, (typeof seeds)[number]>();
    for (const h of cells) {
      const { x, y } = hexToPixel(h.q, h.r);
      let best = seeds[0];
      let bd = Infinity;
      for (const sd of seeds) {
        const d = Math.hypot(x - sd.x, y - sd.y) / sd.w;
        if (d < bd) {
          bd = d;
          best = sd;
        }
      }
      place.set(hexKey(h.q, h.r), best);
    }
    // 떨어진 조각(같은 도시인데 이어지지 않은 칸)은 이웃 도시에 붙임
    for (let pass = 0; pass < 4; pass++) {
      const seen = new Set<string>();
      const parts = new Map<string, Hex[][]>();
      for (const h of cells) {
        const k = hexKey(h.q, h.r);
        if (seen.has(k)) continue;
        const sd = place.get(k)!;
        const comp: Hex[] = [];
        const st = [h];
        seen.add(k);
        while (st.length) {
          const c = st.pop()!;
          comp.push(c);
          for (const n of nbrs(c)) {
            const nk = hexKey(n.q, n.r);
            if (!seen.has(nk) && place.get(nk) === sd) {
              seen.add(nk);
              st.push(n);
            }
          }
        }
        (parts.get(sd.id) ?? parts.set(sd.id, []).get(sd.id)!).push(comp);
      }
      let moved = 0;
      for (const [, comps] of parts) {
        if (comps.length < 2) continue;
        comps.sort((x, y) => y.length - x.length);
        for (const comp of comps.slice(1))
          for (const h of comp) {
            const cnt = new Map<(typeof seeds)[number], number>();
            for (const n of nbrs(h)) {
              const o = place.get(hexKey(n.q, n.r));
              if (o && o !== place.get(hexKey(h.q, h.r)))
                cnt.set(o, (cnt.get(o) ?? 0) + 1);
            }
            const to = [...cnt.entries()].sort((x, y) => y[1] - x[1])[0]?.[0];
            if (to) {
              place.set(hexKey(h.q, h.r), to);
              moved++;
            }
          }
      }
      if (!moved) break;
    }
    for (const sd of seeds) {
      const mine = cells.filter((h) => place.get(hexKey(h.q, h.r)) === sd);
      if (!mine.length) throw new Error(`도시 땅이 없음: ${sd.id}`);
      const c = mine.reduce((a, h) => {
        const p = hexToPixel(h.q, h.r);
        const pa = hexToPixel(a.q, a.r);
        return Math.hypot(p.x - sd.x, p.y - sd.y) <
          Math.hypot(pa.x - sd.x, pa.y - sd.y)
          ? h
          : a;
      });
      centers[sd.id] = { q: c.q, r: c.r, size: sd.size };
      for (const h of mine)
        owner.set(hexKey(h.q, h.r), {
          home: sd.home,
          place: sd.id,
          kind: "city",
          center: h.q === c.q && h.r === c.r,
        });
    }
  }
  // 2) 작은 섬(분쟁 섬·고대 성지)
  const island = (id: string, at: Pt, r: number, kind: TileKind) => {
    let pts: Pt[] = [];
    let cells: Hex[] = [];
    for (let rr = r; cells.length < 5; rr += 1.5) {
      pts = naturalOutline(
        blob(at[0], at[1], rr, seedOf(id)),
        seedOf(id) + 1,
        0.12,
        2,
      );
      cells = inside(pts);
    }
    outlines.push({ id, pts });
    const c = pixelToHex(at[0], at[1]);
    const cc = cells.some((h) => h.q === c.q && h.r === c.r) ? c : cells[0];
    for (const h of cells)
      owner.set(hexKey(h.q, h.r), {
        home: "",
        place: id,
        kind,
        center: h.q === cc.q && h.r === cc.r,
      });
    return cc;
  };
  const holyC = island("holy", HOLY_AT, 9, "holy");
  const pioneers: PioneerIsland[] = PIONEER_DEF.map((p) => {
    const c = island(p.id, p.at, 12, "island");
    return {
      id: p.id,
      name: p.name,
      res: p.res,
      q: c.q,
      r: c.r,
      ...hexToPixel(c.q, c.r),
    };
  });
  const tiles: Tile[] = [...owner.entries()].map(([k, v]) => {
    const [q, r] = k.split(",").map(Number);
    return {
      q,
      r,
      ...hexToPixel(q, r),
      kind: v.kind,
      home: v.home,
      place: v.place,
      center: v.center,
    };
  });
  tiles.sort((a, b) => a.r - b.r || a.q - b.q);
  const xs = tiles.map((t) => t.x);
  const ys = tiles.map((t) => t.y);
  const M = 34;
  const bounds = {
    x: Math.floor(Math.min(...xs) - M),
    y: Math.floor(Math.min(...ys) - M),
    w: 0,
    h: 0,
  };
  bounds.w = Math.ceil(Math.max(...xs) + M - bounds.x);
  bounds.h = Math.ceil(Math.max(...ys) + M - bounds.y);
  return {
    tiles,
    centers,
    pioneers,
    holy: { q: holyC.q, r: holyC.r, ...hexToPixel(holyC.q, holyC.r) },
    bounds,
    outlines,
  };
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
/** 해안선(곡선 점 목록): 땅덩어리·분쟁 섬·성지 */
export const LAND_OUTLINES = BUILT.outlines;
/** 해안선 경로(SVG d) */
export const LAND_PATH = BUILT.outlines
  .map(
    (o) =>
      "M" +
      o.pts.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join("L") +
      "Z",
  )
  .join("");
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
    for (const h of ring(c, rad))
      if (disk(h, 2).every((n) => !TILE_AT.has(hexKey(n.q, n.r))))
        return hexToPixel(h.q, h.r);
  return hexToPixel(c.q, c.r);
}

/** 이미지 작업용 자료(JSON) */
export function hexmapData() {
  return {
    설명: "세계 육각 타일 지도. 뾰족한 위 육각형, 축 좌표(q,r). 픽셀 x = size·√3·(q + r/2), y = size·1.5·r. 목록에 없는 칸은 바다.",
    size: HEX_SIZE,
    orientation: "pointy-top",
    bounds: MAP_BOUNDS,
    countries: COUNTRIES.map((c) => ({
      id: c.id,
      name: c.name,
      cities: c.cities.map((name, i) => {
        const h = CITY_HEX[`${c.id}-${i}`];
        return {
          id: `${c.id}-${i}`,
          name,
          capital: i === 0,
          size: SIZE_NAME[h.size],
          tiles: SIZE_TILES[h.size],
          q: h.q,
          r: h.r,
          ...round(hexToPixel(h.q, h.r)),
        };
      }),
      tiles: TILES.filter((t) => t.home === c.id).length,
    })),
    pioneerIslands: PIONEER_ISLANDS.map((p) => ({
      ...p,
      ...round(p),
      tiles: 19,
    })),
    holy: { name: "고대 성지", ...HOLY_HEX, ...round(HOLY_HEX), tiles: 7 },
    tiles: TILES.map((t) => ({
      q: t.q,
      r: t.r,
      ...round(t),
      kind: t.kind,
      home: t.home,
      place: t.place,
    })),
  };
}
const round = (p: { x: number; y: number }) => ({
  x: Math.round(p.x * 10) / 10,
  y: Math.round(p.y * 10) / 10,
});
