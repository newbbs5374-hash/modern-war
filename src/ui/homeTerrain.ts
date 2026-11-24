// 본부 지도 땅: 우리나라 전체 실제 모양(11/24 대장 결정 "2안. 나라 전체 실제 모양")
// - 세계지도와 같은 자료(realGeo, 대한민국은 시·도 자료)에서 우리나라가 화면(390×640)에 들어오게 잘라 맞춤
//   큰 나라(러시아·미국·중국 등)는 나라 전체 대신 우리 도시들이 있는 곳 위주로
// - 내 도시는 모두 실제 위치. 각진 선은 부드러운 곡선으로, 산·숲·배 길은 실제 땅/바다에 맞춰 고름
import { CITIES } from '../data/cities';
import { GEO_PATH } from '../data/realGeo';
import { KR_INNER, KR_OUTLINE } from '../data/krProvinces';
import { CITY_LONLAT, project } from '../data/realmap';
import { GEO_PROV_INNER } from '../data/provinces';
import { provincesOf } from '../game/territory';

function ringArea(r: number[][]): number {
  let a = 0;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) a += r[j][0] * r[i][1] - r[i][0] * r[j][1];
  return Math.abs(a) / 2;
}

export const HOME_W = 390;
export const HOME_H = 640;
/** 표기만 하는 지명(도시 기능 없음): 경도·위도 */
export const HOME_MARKS: Record<string, Array<{ name: string; lonlat: [number, number] }>> = {
  kr: [{ name: '여수', lonlat: [127.66, 34.76] }],
};

type Ring = number[][];

function parseRings(d: string): Ring[] {
  const out: Ring[] = [];
  for (const seg of d.split('M')) {
    if (!seg.trim()) continue;
    const pts: Ring = [];
    const re = /(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(seg))) pts.push([+m[1], +m[2]]);
    if (pts.length >= 3) out.push(pts);
  }
  return out;
}

let ALL: Ring[] | null = null;
function allRings(): Ring[] {
  if (!ALL) {
    ALL = [];
    for (const [k, d] of Object.entries(GEO_PATH)) if (k !== 'kr') ALL.push(...parseRings(d));
    ALL.push(...parseRings(KR_OUTLINE));
  }
  return ALL;
}

function inRing(x: number, y: number, r: Ring): boolean {
  let c = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const [xi, yi] = r[i];
    const [xj, yj] = r[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}

/** 꼭짓점 사이 가운데를 잇는 부드러운 곡선 */
function smoothPath(r: Ring): string {
  const n = r.length;
  const mid = (i: number) => [(r[i % n][0] + r[(i + 1) % n][0]) / 2, (r[i % n][1] + r[(i + 1) % n][1]) / 2];
  const f = (v: number) => v.toFixed(1);
  let d = `M${f(mid(0)[0])},${f(mid(0)[1])}`;
  for (let i = 1; i <= n; i++) {
    const [mx, my] = mid(i);
    d += `Q${f(r[i % n][0])},${f(r[i % n][1])} ${f(mx)},${f(my)}`;
  }
  return d + 'Z';
}

export interface HomeTerrain {
  /** 땅 모양(본부 좌표) */
  land: string;
  /** 도(시·주·성) 경계(본부 좌표) */
  inner: string;
  /** 우리나라 도 모양(본부 좌표): 빼앗긴 도를 색칠할 때 씀 */
  provs: Array<{ id: string; name: string; d: string }>;
  onLand: (x: number, y: number) => boolean;
  /** 배가 도는 바다 길(화면 안에 바다가 없으면 null) */
  seaLoop: string | null;
  /** 도시 자리(도시 id → 본부 좌표) */
  cityPos: Record<string, [number, number]>;
  /** 너무 멀어 가장자리 표지판으로 그리는 도시 id */
  far: string[];
  /** 표기만 하는 지명 */
  marks: Array<{ name: string; x: number; y: number }>;
  /** 1도 = 몇 칸(본부 좌표) */
  scale: number;
  /** 세계 좌표(realGeo, 1도=6) → 본부 좌표: 본부 = (세계 − t) × s */
  view: { tx: number; ty: number; s: number };
}

const CACHE = new Map<string, HomeTerrain>();

export function homeTerrain(countryId: string): HomeTerrain {
  const hit = CACHE.get(countryId);
  if (hit) return hit;
  const W = HOME_W;
  const H = HOME_H;
  const mine = CITIES.filter((c) => c.home === countryId);
  const cityW = mine.map((c) => project(...CITY_LONLAT[c.name]));
  // 수도에서 50도 넘게 먼 도시(호놀룰루·블라디보스토크 등)는 화면 범위에서 빼고 가장자리 표지판으로
  const capW = cityW[mine.findIndex((c) => c.capital)] ?? cityW[0];
  const isFar = mine.map((_c, i) => Math.hypot(cityW[i].x - capW.x, cityW[i].y - capW.y) / 6 > 50);
  const nearW = cityW.filter((_p, i) => !isFar[i]);
  // 화면에 넣을 범위(세계 좌표): 나라 본토(+큰 섬) 또는 도시들
  const own = parseRings(countryId === 'kr' ? KR_OUTLINE : (GEO_PATH[countryId] ?? ''));
  const maxA = Math.max(0, ...own.map(ringArea));
  const body = own.filter((r) => ringArea(r) >= maxA * 0.05);
  let x0 = Math.min(...nearW.map((p) => p.x));
  let x1 = Math.max(...nearW.map((p) => p.x));
  let y0 = Math.min(...nearW.map((p) => p.y));
  let y1 = Math.max(...nearW.map((p) => p.y));
  if (body.length) {
    const xs = body.flat().map((p) => p[0]);
    const ys = body.flat().map((p) => p[1]);
    const bx0 = Math.min(...xs);
    const bx1 = Math.max(...xs);
    const by0 = Math.min(...ys);
    const by1 = Math.max(...ys);
    // 나라가 너무 크면(가로 20도·세로 16도 넘음) 도시들 둘레만
    if (bx1 - bx0 <= 20 * 6 && by1 - by0 <= 16 * 6) {
      x0 = Math.min(x0, bx0);
      x1 = Math.max(x1, bx1);
      y0 = Math.min(y0, by0);
      y1 = Math.max(y1, by1);
    }
  }
  // 여유(가장자리 0.5도 이상) + 화면 위·왼쪽 메뉴를 피해 가운데를 조금 오른쪽 아래로
  const padX = Math.max(3, (x1 - x0) * 0.1);
  const padY = Math.max(3, (y1 - y0) * 0.1);
  const bw = x1 - x0 + padX * 2;
  const bh = y1 - y0 + padY * 2;
  const s = Math.min((W * 0.8) / bw, (H * 0.74) / bh, W / (1.6 * 6));
  const cxW = (x0 + x1) / 2;
  const cyW = (y0 + y1) / 2;
  const tx = cxW - (W * 0.6) / s;
  const ty = cyW - (H * 0.56) / s;
  const T = (x: number, y: number): [number, number] => [(x - tx) * s, (y - ty) * s];
  // 화면 둘레(여유 포함)와 겹치는 땅만
  const M = 200;
  const rings: Ring[] = [];
  for (const r of allRings()) {
    const t = r.map(([x, y]) => T(x, y));
    let a0 = Infinity;
    let b0 = Infinity;
    let a1 = -Infinity;
    let b1 = -Infinity;
    for (const [x, y] of t) {
      if (x < a0) a0 = x;
      if (x > a1) a1 = x;
      if (y < b0) b0 = y;
      if (y > b1) b1 = y;
    }
    if (a1 < -M || a0 > W + M || b1 < -M || b0 > H + M) continue;
    // 화면에서 너무 작은 섬은 뺌
    if ((a1 - a0) * (b1 - b0) < 4) continue;
    rings.push(t);
  }
  const onLand = (x: number, y: number) => rings.some((r) => inRing(x, y, r));
  const land = rings.map(smoothPath).join('');
  const toT = (d: string) =>
    d.replace(/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g, (_m, a, b) => {
      const [x, y] = T(+a, +b);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
  const inner = toT(countryId === 'kr' ? KR_INNER : (GEO_PROV_INNER[countryId] ?? ''));
  const provs = provincesOf(countryId).map((p) => ({ id: p.id, name: p.name, d: toT(p.d) }));
  const cityPos: Record<string, [number, number]> = {};
  const far: string[] = [];
  mine.forEach((c, i) => {
    let [x, y] = T(cityW[i].x, cityW[i].y);
    if (isFar[i]) {
      // 화면 가장자리 표지판: 수도에서 그 도시 쪽으로 화면 끝(여백 40)
      far.push(c.id);
      const [qx, qy] = T(capW.x, capW.y);
      const dx = x - qx;
      const dy = y - qy;
      const k = Math.min(dx ? (dx > 0 ? W - 40 - qx : 40 - qx) / dx : Infinity, dy ? (dy > 0 ? H - 60 - qy : 60 - qy) / dy : Infinity);
      x = qx + dx * k;
      y = qy + dy * k;
    }
    cityPos[c.id] = [Math.round(x * 10) / 10, Math.round(y * 10) / 10];
  });
  const marks = (HOME_MARKS[countryId] ?? []).map((m) => {
    const p = project(...m.lonlat);
    const [x, y] = T(p.x, p.y);
    return { name: m.name, x, y };
  });

  // 배 길: 수도 가까운 넓은 바다에 타원(화면 안)
  const cap = mine.find((c) => c.capital) ?? mine[0];
  const [cx, cy] = cityPos[cap.id];
  const openSea = (x: number, y: number, rx: number, ry: number) => {
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const px = x + Math.cos(a) * rx;
      const py = y + Math.sin(a) * ry;
      if (px < 10 || px > W - 10 || py < 10 || py > H - 10 || onLand(px, py)) return false;
    }
    return !onLand(x, y);
  };
  let seaLoop: string | null = null;
  for (const [rx, ry] of [
    [90, 50],
    [64, 36],
    [44, 26],
    [30, 18],
  ]) {
    let best: [number, number] | null = null;
    let bd = Infinity;
    for (let y = ry + 12; y < H - ry - 12; y += 12)
      for (let x = rx + 12; x < W - rx - 12; x += 12) {
        const d = Math.hypot(x - cx, y - cy);
        if (d < bd && openSea(x, y, rx, ry)) {
          bd = d;
          best = [x, y];
        }
      }
    if (best) {
      const [x, y] = best;
      seaLoop = `M${x - rx},${y} a${rx},${ry} 0 1,0 ${rx * 2},0 a${rx},${ry} 0 1,0 ${-rx * 2},0`;
      break;
    }
  }
  const out = { land, inner, provs, onLand, seaLoop, cityPos, far, marks, scale: s * 6, view: { tx, ty, s } };
  CACHE.set(countryId, out);
  return out;
}
