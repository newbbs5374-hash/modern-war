// 본부 지도 땅: 수도 둘레의 실제 해안선(11/23 대장 결정 "1안. 수도 둘레 실제 땅")
// - 세계지도와 같은 자료(realGeo, 대한민국은 시·도 자료)를 수도 둘레 가로 2.4도만큼 잘라 본부 화면(390×640)에 맞춤
// - 각진 선은 부드러운 곡선으로, 산·숲·도로·배 길은 실제 땅/바다에 맞춰 고름
import { CITIES } from '../data/cities';
import { GEO_PATH } from '../data/realGeo';
import { KR_INNER, KR_OUTLINE } from '../data/krProvinces';
import { CITY_LONLAT, project } from '../data/realmap';

export const HOME_W = 390;
export const HOME_H = 640;
/** 수도가 놓이는 자리(왼쪽 임무 칸을 피해 오른쪽 아래) */
export const HOME_CAP: [number, number] = [262, 420];
/** 본부 화면 가로에 들어가는 경도 폭 */
export const HOME_SPAN_DEG = 2.4;

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
  /** 시·도 경계(대한민국만, 없으면 '') */
  inner: string;
  onLand: (x: number, y: number) => boolean;
  /** 배가 도는 바다 길(화면 안에 바다가 없으면 null) */
  seaLoop: string | null;
  /** 수도에서 밖으로 뻗는 큰길 끝점(땅 위) */
  roadEnds: Array<[number, number]>;
  /** 둘째 순환 도로가 땅 위에 들어가는지 */
  outerRing: boolean;
}

const CACHE = new Map<string, HomeTerrain>();

export function homeTerrain(countryId: string): HomeTerrain {
  const hit = CACHE.get(countryId);
  if (hit) return hit;
  const W = HOME_W;
  const H = HOME_H;
  const cap = CITIES.find((c) => c.home === countryId && c.capital) ?? CITIES.find((c) => c.home === countryId)!;
  const cp = project(...CITY_LONLAT[cap.name]);
  const s = W / (HOME_SPAN_DEG * 6);
  let tx = cp.x - HOME_CAP[0] / s;
  let ty = cp.y - HOME_CAP[1] / s;
  // 바닷가 수도(텔아비브 등): 시가지가 바다에 걸치지 않게 땅 쪽으로 조금 옮김(최대 0.5도)
  {
    const near = allRings().filter((r) => r.some(([x, y]) => Math.abs(x - cp.x) < 12 && Math.abs(y - cp.y) < 12));
    const landW = (x: number, y: number) => near.some((r) => inRing(x, y, r));
    const fits = (dx: number, dy: number) => {
      for (let i = 0; i < 20; i++) {
        const a = (i / 20) * Math.PI * 2;
        if (!landW(cp.x + (dx + Math.cos(a) * 120) / s, cp.y + (dy + Math.sin(a) * 75) / s)) return false;
      }
      return true;
    };
    if (!fits(0, 0)) {
      let best: [number, number] | null = null;
      for (let dy = -150; dy <= 150; dy += 10)
        for (let dx = -150; dx <= 150; dx += 10)
          if ((!best || Math.hypot(dx, dy) < Math.hypot(...best)) && fits(dx, dy)) best = [dx, dy];
      if (best) {
        tx += best[0] / s;
        ty += best[1] / s;
      }
    }
  }
  const T = (x: number, y: number) => [(x - tx) * s, (y - ty) * s];
  // 화면 둘레(여유 포함)와 겹치는 땅만
  const M = 200;
  const rings: Ring[] = [];
  for (const r of allRings()) {
    const t = r.map(([x, y]) => T(x, y));
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (const [x, y] of t) {
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
    if (x1 < -M || x0 > W + M || y1 < -M || y0 > H + M) continue;
    rings.push(t);
  }
  const onLand = (x: number, y: number) => rings.some((r) => inRing(x, y, r));
  const land = rings.map(smoothPath).join('');
  const inner =
    countryId === 'kr'
      ? KR_INNER.replace(/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g, (_m, a, b) => {
          const [x, y] = T(+a, +b);
          return `${x.toFixed(1)},${y.toFixed(1)}`;
        })
      : '';

  // 큰길: 네 방향(왼위·오른위·왼아래·오른아래)으로 땅이 끝나기 전까지
  const [cx, cy] = HOME_CAP;
  const roadEnds: Array<[number, number]> = [];
  for (const [ax, ay] of [
    [-0.55, -1],
    [0.7, -0.9],
    [-0.6, 1],
    [0.5, 1],
  ]) {
    const len = Math.hypot(ax, ay);
    let last: [number, number] | null = null;
    for (let t = 20; t < 420; t += 8) {
      const x = cx + (ax / len) * t;
      const y = cy + (ay / len) * t;
      if (!onLand(x, y)) break;
      last = [Math.round(x), Math.round(y)];
    }
    if (last && Math.hypot(last[0] - cx, last[1] - cy) > 110) roadEnds.push(last);
  }
  // 둘째 순환 도로(104×64): 거의 다 땅이면 그림
  let onCnt = 0;
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    if (onLand(cx + Math.cos(a) * 104, cy + Math.sin(a) * 64)) onCnt++;
  }
  const outerRing = onCnt >= 21;

  // 배 길: 수도에서 가까운 넓은 바다에 타원(화면 안)
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
  search: for (const [rx, ry] of [
    [110, 60],
    [80, 44],
    [56, 32],
    [38, 22],
  ]) {
    let best: [number, number] | null = null;
    let bd = Infinity;
    for (let y = ry + 12; y < H - ry - 12; y += 14)
      for (let x = rx + 12; x < W - rx - 12; x += 14) {
        const d = Math.hypot(x - cx, y - cy);
        if (d < bd && openSea(x, y, rx, ry)) {
          bd = d;
          best = [x, y];
        }
      }
    if (best) {
      const [x, y] = best;
      seaLoop = `M${x - rx},${y} a${rx},${ry} 0 1,0 ${rx * 2},0 a${rx},${ry} 0 1,0 ${-rx * 2},0`;
      break search;
    }
  }
  const out = { land, inner, onLand, seaLoop, roadEnds, outerRing };
  CACHE.set(countryId, out);
  return out;
}
