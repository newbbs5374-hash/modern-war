// 육각 타일 지도 그림·자료 만들기: npm run hexmap → docs/hexmap.svg · docs/hexmap.json (이미지 작업 밑그림)
import { it } from 'vitest';
import { writeFileSync } from 'fs';
import { TILES, MAP_BOUNDS, hexCorners, CITY_HEX, PIONEER_ISLANDS, HOLY_HEX, hexmapData } from '../src/data/hexmap';
import { CITIES } from '../src/data/cities';
import { COUNTRIES } from '../src/data/world';
const COL: Record<string, string> = { us:'#3b82f6', cn:'#ef4444', ru:'#a78bfa', de:'#9ca3af', jp:'#f472b6', uk:'#14b8a6', in:'#f59e0b', kr:'#fde047', tr:'#22c55e', il:'#60a5fa', ir:'#b45309', ua:'#84cc16', kp:'#475569' };
it('hexmap svg', () => {
  const b = MAP_BOUNDS;
  const out: string[] = [`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${b.x} ${b.y} ${b.w} ${b.h}" width="${b.w*2}" height="${b.h*2}" font-family="sans-serif"><rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" fill="#0c2a44"/>`];
  for (const t of TILES) {
    const pts = hexCorners(t.x, t.y, 5.0).map(p => p.map(v => v.toFixed(1)).join(',')).join(' ');
    const f = t.kind === 'city' ? COL[t.home] : t.kind === 'holy' ? '#fbbf24' : '#d6c08a';
    out.push(`<polygon points="${pts}" fill="${f}" fill-opacity="${t.center ? 1 : 0.75}"/>`);
  }
  for (const c of CITIES) out.push(`<text x="${c.x}" y="${c.y - 3}" font-size="5" text-anchor="middle" fill="#000">${c.capital ? '★' : ''}${c.name}</text>`);
  for (const p of PIONEER_ISLANDS) out.push(`<text x="${p.x}" y="${p.y + 12}" font-size="5" text-anchor="middle" fill="#fff">${p.name}</text>`);
  for (const c of COUNTRIES) { const ts = TILES.filter(t => t.home === c.id); const x = ts.reduce((a,t)=>a+t.x,0)/ts.length, y = ts.reduce((a,t)=>a+t.y,0)/ts.length; out.push(`<text x="${x}" y="${y+8}" font-size="8" font-weight="bold" text-anchor="middle" fill="#fff" stroke="#000" stroke-width="0.3">${c.name} ${ts.length}</text>`); }
  out.push(`<text x="${HOLY_HEX.x}" y="${HOLY_HEX.y + 10}" font-size="5" text-anchor="middle" fill="#fde68a">떠오른 성소</text></svg>`);
  writeFileSync(process.env.OUT ?? '/tmp/hexmap.svg', out.join('\n'));
  writeFileSync((process.env.OUT ?? '/tmp/hexmap.svg').replace('.svg', '.json'), JSON.stringify(hexmapData(), null, 1));
  console.log('tiles', TILES.length, 'bounds', JSON.stringify(b), Object.keys(CITY_HEX).length);
});
