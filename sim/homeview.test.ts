// 본부 지도마다 보이는 세계 범위(경도·위도)를 출력(scripts/gen_homegeo.py 입력용)
import { test } from 'vitest';
import { writeFileSync } from 'node:fs';
import { COUNTRIES } from '../src/data/world';
import { homeTerrain, HOME_W, HOME_H } from '../src/ui/homeTerrain';
import { GEO } from '../src/data/realGeo';

test('home views', () => {
  const out: Record<string, number[]> = {};
  for (const c of COUNTRIES) {
    const { tx, ty, s } = homeTerrain(c.id).view;
    const m = 40 / s; // 여유
    const lon0 = (tx - m) / GEO.PX + GEO.L0;
    const lon1 = (tx + HOME_W / s + m) / GEO.PX + GEO.L0;
    const lat1 = GEO.B1 - (ty - m) / GEO.PX;
    const lat0 = GEO.B1 - (ty + HOME_H / s + m) / GEO.PX;
    out[c.id] = [lon0, lat0, lon1, lat1, s * 6].map((v) => Math.round(v * 100) / 100);
  }
  writeFileSync(process.env.OUT ?? '/tmp/homeviews.json', JSON.stringify(out));
  console.log(out);
});
