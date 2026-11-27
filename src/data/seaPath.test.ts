import { describe, expect, it } from "vitest";
import { CITIES } from "./cities";
import { COUNTRIES } from "./world";
import { isLand, project, seaNearXY } from "./realmap";
import { CANALS, seaLoop, seaRoute } from "./seaPath";

/** 운하·해협 곁(4px 안)은 땅을 지나도 됨 */
const CANAL_PTS = CANALS.flatMap((l) => {
  const ps = l.map(([lon, lat]) => project(lon, lat));
  return ps.slice(1).flatMap((q, i) => {
    const d = Math.hypot(q.x - ps[i].x, q.y - ps[i].y);
    return Array.from({ length: Math.ceil(d) + 1 }, (_, t) => ({
      x: ps[i].x + ((q.x - ps[i].x) * t) / Math.max(1, Math.ceil(d)),
      y: ps[i].y + ((q.y - ps[i].y) * t) / Math.max(1, Math.ceil(d)),
    }));
  });
});
const nearCanal = (x: number, y: number) => CANAL_PTS.some((p) => Math.hypot(p.x - x, p.y - y) < 4);

const SEA = Object.fromEntries(
  COUNTRIES.map((c) => {
    const cap = CITIES.find((x) => x.home === c.id && x.capital)!;
    return [c.id, seaNearXY(cap.x, cap.y, 9)];
  }),
);

/** path "M x,y a rx,ry ..." 고리를 따라 점 찍기 */
function loopPts(d: string) {
  const m = d.match(/M([\d.-]+),([\d.-]+) a([\d.]+),([\d.]+)/)!;
  const rx = +m[3];
  const ry = +m[4];
  const cx = +m[1] + rx;
  const cy = +m[2];
  return Array.from({ length: 72 }, (_, i) => ({
    x: cx + Math.cos((i / 72) * Math.PI * 2) * rx,
    y: cy + Math.sin((i / 72) * Math.PI * 2) * ry,
  }));
}

describe("바닷길: 배가 땅에 들어가지 않음", () => {
  it("나라마다 앞바다 순찰 고리는 모두 바다", () => {
    for (const c of COUNTRIES) {
      const p = SEA[c.id];
      for (const q of loopPts(seaLoop(p.x, p.y, 10, 4).d)) expect(isLand(q.x, q.y), c.id).toBe(false);
      for (const q of loopPts(seaLoop(p.x + 5, p.y + 4, 8, 3).d)) expect(isLand(q.x, q.y), c.id).toBe(false);
    }
  });
  it("나라 사이 바닷길은 땅을 가로지르지 않음", () => {
    let found = 0;
    for (const a of COUNTRIES)
      for (const b of COUNTRIES) {
        if (a.id >= b.id) continue;
        const r = seaRoute(SEA[a.id], SEA[b.id]);
        if (!r) continue;
        found++;
        // 1px마다 짚어 땅에 닿는 점이 거의 없어야 함(해안선 자료의 아주 작은 모서리 2점까지만 허용)
        let hit = 0;
        for (let i = 1; i < r.length; i++) {
          const d = Math.hypot(r[i].x - r[i - 1].x, r[i].y - r[i - 1].y);
          for (let t = 0; t <= d; t++)
          {
            const x = r[i - 1].x + ((r[i].x - r[i - 1].x) * t) / d;
            const y = r[i - 1].y + ((r[i].y - r[i - 1].y) * t) / d;
            if (isLand(x, y) && !nearCanal(x, y)) hit++;
          }
        }
        expect(hit, `${a.id}-${b.id}`).toBeLessThanOrEqual(2);
      }
    // 태평양(미·중·일·한·북) 10쌍 + 유럽·지중해·흑해·인도양(러·독·영·인·튀·이스라엘·우) 21쌍
    expect(found).toBeGreaterThanOrEqual(31);
  }, 60000); // 11-27 나라 36개: 짝 630개
});
