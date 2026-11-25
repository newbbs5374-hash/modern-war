// 지도 위 전투 위성 바탕 만들기 입력: 도시 id · 실제 경도·위도 (scripts/gen_fieldsat.py)
import { test } from 'vitest';
import { writeFileSync } from 'node:fs';
import { CITIES } from '../src/data/cities';
import { CITY_LONLAT } from '../src/data/realmap';

test('field cities', () => {
  const out = CITIES.map((c) => ({ id: c.id, name: c.name, ll: CITY_LONLAT[c.name] }));
  writeFileSync(process.env.OUT ?? '/tmp/fieldcities.json', JSON.stringify(out));
  console.log(out.length);
});
