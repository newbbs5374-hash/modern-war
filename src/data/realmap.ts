// 현실 세계지도: 실제 경도·위도 → 지도 그림 좌표. 세계지도 화면(WorldMap)·도시 점·분쟁 섬 자리에 씀.
// 육각 칸(hexmap.ts)은 도시 화면·전투 화면 안에서만 쓰고, 세계지도에는 그리지 않는다.
import { GEO, GEO_POLYS } from "./realGeo";

export { GEO, GEO_PATH } from "./realGeo";

/** 경도·위도 → 지도 좌표(px) */
export function project(lon: number, lat: number): { x: number; y: number } {
  const l = lon < GEO.L0 ? lon + 360 : lon;
  return { x: (l - GEO.L0) * GEO.PX, y: (GEO.B1 - lat) * GEO.PX };
}

/** 도시 실제 위치 [경도, 위도] (이름으로 찾음) */
export const CITY_LONLAT: Record<string, [number, number]> = {
  워싱턴: [-77.0, 38.9],
  뉴욕: [-74.0, 40.7],
  샌프란시스코: [-122.4, 37.8],
  호놀룰루: [-157.9, 21.3],
  덴버: [-105.0, 39.7],
  피닉스: [-112.1, 33.4],
  피츠버그: [-80.0, 40.4],
  휴스턴: [-95.4, 29.8],
  베이징: [116.4, 39.9],
  톈진: [117.2, 39.1],
  광저우: [113.3, 23.1],
  선전: [114.1, 22.5],
  바오터우: [109.8, 40.6],
  우한: [114.3, 30.6],
  란저우: [103.8, 36.1],
  상하이: [121.5, 31.2],
  모스크바: [37.6, 55.8],
  상트페테르부르크: [30.3, 59.9],
  튜멘: [65.5, 57.2],
  무르만스크: [33.1, 68.9],
  예카테린부르크: [60.6, 56.8],
  아르한겔스크: [40.5, 64.5],
  노릴스크: [88.2, 69.3],
  야쿠츠크: [129.7, 62.0],
  블라디보스토크: [131.9, 43.1],
  노보시비르스크: [82.9, 55.0],
  베를린: [13.4, 52.5],
  함부르크: [10.0, 53.6],
  도쿄: [139.7, 35.7],
  후쿠오카: [130.4, 33.6],
  런던: [-0.1, 51.5],
  버밍엄: [-1.9, 52.5],
  뉴델리: [77.2, 28.6],
  콜카타: [88.4, 22.6],
  벵갈루루: [77.6, 13.0],
  첸나이: [80.3, 13.1],
  뭄바이: [72.9, 19.1],
  서울: [127.0, 37.6],
  부산: [129.1, 35.2],
  앙카라: [32.9, 39.9],
  이스탄불: [29.0, 41.0],
  이즈미르: [27.1, 38.4],
  텔아비브: [34.8, 32.1],
  하이파: [35.0, 32.8],
  테헤란: [51.4, 35.7],
  이스파한: [51.7, 32.7],
  반다르아바스: [56.3, 27.2],
  시라즈: [52.5, 29.6],
  키이우: [30.5, 50.45],
  하르키우: [36.2, 50.0],
  오데사: [30.7, 46.5],
  평양: [125.8, 39.0],
  남포: [124.9, 38.4],
};

/** 분쟁 섬(가상의 작은 섬)·고대 성지 자리 [경도, 위도]: 실제 바다 위 */
export const ISLAND_LONLAT: Record<string, [number, number]> = {
  "p-cheongseok": [114, 12],
  "p-whale": [150, 55],
  "p-storm": [-10, 62],
  "p-twin": [155, 33],
  "p-flame": [63, 18],
  "p-fog": [45, 74],
  "p-southwind": [89, 14],
  "p-coral": [135, 18],
  "p-turtle": [175, 28],
  "p-southcross": [75, 6.5],
  "p-blackrock": [178, 58],
  "p-dawn": [126, 30],
  holy: [31, 33.6],
};

export const islandXY = (id: string) => project(...ISLAND_LONLAT[id]);

// ── 땅/바다 판별(함대 길) ──
const BOX = GEO_POLYS.map((p) => {
  let x0 = Infinity,
    y0 = Infinity,
    x1 = -Infinity,
    y1 = -Infinity;
  for (let i = 0; i < p.length; i += 2) {
    x0 = Math.min(x0, p[i]);
    x1 = Math.max(x1, p[i]);
    y0 = Math.min(y0, p[i + 1]);
    y1 = Math.max(y1, p[i + 1]);
  }
  return [x0, y0, x1, y1];
});
function inFlat(x: number, y: number, p: number[]): boolean {
  let ins = false;
  for (let i = 0, j = p.length - 2; i < p.length; j = i, i += 2) {
    const xi = p[i],
      yi = p[i + 1],
      xj = p[j],
      yj = p[j + 1];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi)
      ins = !ins;
  }
  return ins;
}
/** 땅 위인가 */
export function isLand(x: number, y: number): boolean {
  for (let k = 0; k < GEO_POLYS.length; k++) {
    const b = BOX[k];
    if (
      x >= b[0] &&
      x <= b[2] &&
      y >= b[1] &&
      y <= b[3] &&
      inFlat(x, y, GEO_POLYS[k])
    )
      return true;
  }
  return false;
}
/** 둘레 r 안이 모두 바다인가 */
export function openSea(x: number, y: number, r: number): boolean {
  if (isLand(x, y)) return false;
  for (let a = 0; a < 8; a++)
    if (
      isLand(
        x + Math.cos((a * Math.PI) / 4) * r,
        y + Math.sin((a * Math.PI) / 4) * r,
      )
    )
      return false;
  return true;
}
/** (x,y)에서 가장 가까운 넓은 바다 자리 */
export function seaNearXY(
  x: number,
  y: number,
  r = 10,
): { x: number; y: number } {
  for (let d = 4; d < 400; d += 4)
    for (let a = 0; a < 24; a++) {
      const px = x + Math.cos((a * Math.PI) / 12) * d;
      const py = y + Math.sin((a * Math.PI) / 12) * d;
      if (px > 0 && px < GEO.W && py > 0 && py < GEO.H && openSea(px, py, r))
        return { x: px, y: py };
    }
  return { x, y };
}

/** 한 나라 도시들의 영역(보로노이 칸): 나라 모양으로 잘라 그리면 도시마다 주인 색을 칠할 수 있음 */
export function voronoiCells(
  pts: Array<{ id: string; x: number; y: number }>,
  pad = 400,
): Record<string, Array<[number, number]>> {
  const out: Record<string, Array<[number, number]>> = {};
  for (const a of pts) {
    let poly: Array<[number, number]> = [
      [a.x - pad, a.y - pad],
      [a.x + pad, a.y - pad],
      [a.x + pad, a.y + pad],
      [a.x - pad, a.y + pad],
    ];
    for (const b of pts) {
      if (b === a) continue;
      // a 쪽 반평면: (p - m)·(b - a) <= 0
      const mx = (a.x + b.x) / 2,
        my = (a.y + b.y) / 2,
        nx = b.x - a.x,
        ny = b.y - a.y;
      const side = (p: [number, number]) => (p[0] - mx) * nx + (p[1] - my) * ny;
      const np: Array<[number, number]> = [];
      for (let i = 0; i < poly.length; i++) {
        const p = poly[i],
          q = poly[(i + 1) % poly.length];
        const sp = side(p),
          sq = side(q);
        if (sp <= 0) np.push(p);
        if ((sp < 0 && sq > 0) || (sp > 0 && sq < 0)) {
          const t = sp / (sp - sq);
          np.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]);
        }
      }
      poly = np;
    }
    out[a.id] = poly;
  }
  return out;
}
