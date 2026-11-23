// 실사 세계지도 밑그림: npm run worldart → docs/worldart-guide.svg(땅/바다/국경, 글자 없음) · docs/worldart-label.svg(이름 포함)
import { it } from 'vitest';
import { writeFileSync } from 'fs';
import { TILES, TILE_AT, HEX_DIRS, EDGE_DIR, hexCorners, hexKey, WORLD_ART, LAND_PATH, PIONEER_ISLANDS, HOLY_HEX } from '../src/data/hexmap';
import { CITIES } from '../src/data/cities';
import { COUNTRIES } from '../src/data/world';
import { smoothPath, type Seg } from '../src/ui/smoothHex';

it('worldart guide', () => {
  const coast: Seg[] = [];
  const border: Seg[] = [];
  for (const t of TILES) {
    const cs = hexCorners(t.x, t.y);
    cs.forEach((p, i) => {
      const d = HEX_DIRS[EDGE_DIR[i]];
      const n = TILE_AT.get(hexKey(t.q + d.q, t.r + d.r));
      if (!n) coast.push([p, cs[(i + 1) % 6]]);
      else if (n.home !== t.home && EDGE_DIR[i] < 3) border.push([p, cs[(i + 1) % 6]]);
    });
  }
  const COAST = LAND_PATH;
  const BORDER = smoothPath(border, { relax: 6 });
  const A = WORLD_ART;
  const W = 1536;
  const head = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${A.x} ${A.y} ${A.w} ${A.h}" width="${W}" height="${Math.round((W * A.h) / A.w)}" font-family="sans-serif">`;
  const base = [head, `<rect x="${A.x}" y="${A.y}" width="${A.w}" height="${A.h}" fill="#2f6f9f"/>`, `<path d="${COAST}" fill="#e8dcc0" fill-rule="evenodd" stroke="#1d4f73" stroke-width="1"/>`, `<path d="${BORDER}" fill="none" stroke="#8a3b2a" stroke-width="1.2" stroke-dasharray="3 2"/>`];
  writeFileSync('docs/worldart-guide.svg', [...base, '</svg>'].join('\n'));
  const lab = [...base];
  for (const c of COUNTRIES) {
    const ts = TILES.filter((t) => t.home === c.id);
    const x = ts.reduce((a, t) => a + t.x, 0) / ts.length;
    const y = ts.reduce((a, t) => a + t.y, 0) / ts.length;
    lab.push(`<text x="${x}" y="${y}" font-size="14" font-weight="bold" text-anchor="middle" fill="#111">${c.name}</text>`);
  }
  for (const c of CITIES) lab.push(`<circle cx="${c.x}" cy="${c.y}" r="1.6" fill="#333"/><text x="${c.x}" y="${c.y - 3}" font-size="5.5" text-anchor="middle" fill="#333">${c.name}</text>`);
  for (const p of PIONEER_ISLANDS) lab.push(`<text x="${p.x}" y="${p.y + 12}" font-size="6" text-anchor="middle" fill="#fff">${p.name}</text>`);
  lab.push(`<text x="${HOLY_HEX.x}" y="${HOLY_HEX.y + 11}" font-size="6" text-anchor="middle" fill="#ffe08a">고대 성지</text>`);
  writeFileSync('docs/worldart-label.svg', [...lab, '</svg>'].join('\n'));
});
