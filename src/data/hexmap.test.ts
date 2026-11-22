import { describe, expect, it } from 'vitest';
import { CITY_HEX, PIONEER_ISLANDS, SIZE_TILES, TILES, citySizes, disk, hexDist, hexToPixel, pixelToHex } from './hexmap';
import { COUNTRIES } from './world';

describe('육각 타일 지도', () => {
  it('도시 크기: 소 19 · 중 37 · 대 61칸(모양은 자연스럽게)', () => {
    expect(disk({ q: 0, r: 0 }, 2)).toHaveLength(19);
    expect(disk({ q: 0, r: 0 }, 3)).toHaveLength(37);
    expect(disk({ q: 0, r: 0 }, 4)).toHaveLength(61);
    expect(citySizes(10)).toEqual([4, 3, 3, 2, 2, 2, 2, 2, 2, 2]);
    expect(citySizes(2)).toEqual([3, 2]);
  });
  it('나라 타일 수 = 도시 묶음 합(겹침 없음), 표와 같음', () => {
    const want: Record<string, number> = { ru: 268, us: 230, cn: 230, in: 155, ir: 136, tr: 75, ua: 75, jp: 56, de: 56, uk: 56, kr: 56, kp: 56, il: 56 };
    for (const c of COUNTRIES) {
      const n = TILES.filter((t) => t.home === c.id).length;
      expect(n).toBe(want[c.id]);
      expect(n).toBe(citySizes(c.cities.length).reduce((a, s) => a + SIZE_TILES[s], 0));
    }
    expect(new Set(TILES.map((t) => `${t.q},${t.r}`)).size).toBe(TILES.length);
    for (const [id, h] of Object.entries(CITY_HEX)) expect(TILES.filter((t) => t.place === id)).toHaveLength(SIZE_TILES[h.size]);
  });
  it('개척 섬 12개(19칸), 다른 땅과 떨어져 있음', () => {
    expect(PIONEER_ISLANDS).toHaveLength(12);
    for (const p of PIONEER_ISLANDS) {
      expect(TILES.filter((t) => t.place === p.id)).toHaveLength(19);
      const mine = TILES.filter((t) => t.place === p.id);
      const others = TILES.filter((t) => t.place !== p.id);
      for (const t of mine) expect(Math.min(...others.map((o) => hexDist(t, o)))).toBeGreaterThanOrEqual(3);
    }
  });
  it('픽셀 ↔ 칸 변환이 서로 맞음', () => {
    for (const h of Object.values(CITY_HEX)) {
      const p = hexToPixel(h.q, h.r);
      expect(pixelToHex(p.x, p.y)).toEqual({ q: h.q, r: h.r });
    }
  });
});
