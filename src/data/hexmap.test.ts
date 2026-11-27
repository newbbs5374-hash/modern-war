import { describe, expect, it } from 'vitest';
import { CITY_HEX, HEX_DIRS, ISLAND_TILES, PIONEER_ISLANDS, SIZE_TILES, TILES, TILE_AT, citySizes, citySizesOf, disk, hexDist, hexKey, hexToPixel, pixelToHex } from './hexmap';
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
    // 11-25: 도시 67곳 추가(원래 도시 칸은 그대로)
    // 11-26: 미국 7곳·중국 3곳·러시아 2곳 더(소도시)
    const want: Record<string, number> = { us: 890, cn: 742, ru: 705, de: 368, jp: 368, uk: 368, in: 607, kr: 751, tr: 368, il: 368, ir: 422, ua: 368, kp: 368, tw: 398, pl: 435, ph: 435, pk: 435, sa: 472,
      // 11-27 새 나라 18개
      fi: 435, ca: 472, fr: 435, es: 435, mx: 435, it: 435, gr: 435, ve: 398, co: 435, dz: 435, eg: 435, br: 472, cl: 435, ng: 435, et: 435, au: 472, ar: 472, za: 435 };
    for (const c of COUNTRIES) {
      const n = TILES.filter((t) => t.home === c.id).length;
      expect(n).toBe(want[c.id]);
      expect(n).toBe(citySizesOf(c.id, c.cities.length).reduce((a, s) => a + SIZE_TILES[s], 0));
    }
    expect(new Set(TILES.map((t) => `${t.q},${t.r}`)).size).toBe(TILES.length);
    for (const [id, h] of Object.entries(CITY_HEX)) expect(TILES.filter((t) => t.place === id)).toHaveLength(SIZE_TILES[h.size]);
  });
  it('분쟁 지역 12개(작은 7칸), 다른 땅과 떨어져 있음', () => {
    expect(PIONEER_ISLANDS).toHaveLength(12);
    for (const p of PIONEER_ISLANDS) {
      expect(TILES.filter((t) => t.place === p.id)).toHaveLength(ISLAND_TILES);
      expect(ISLAND_TILES).toBe(7);
      const mine = TILES.filter((t) => t.place === p.id);
      const others = TILES.filter((t) => t.place !== p.id);
      for (const t of mine) expect(Math.min(...others.map((o) => hexDist(t, o)))).toBeGreaterThanOrEqual(3);
    }
  });
  it('모든 나라가 바다에 닿고 한 덩어리, 같은 대륙 나라는 국경을 맞댐', () => {
    const coast = new Set<string>();
    const pairs = new Set<string>();
    for (const t of TILES)
      for (const d of HEX_DIRS) {
        const n = TILE_AT.get(hexKey(t.q + d.q, t.r + d.r));
        if (!n) coast.add(t.home);
        else if (t.home && n.home && n.home !== t.home) pairs.add([t.home, n.home].sort().join('-'));
      }
    for (const c of COUNTRIES) {
      expect(coast.has(c.id)).toBe(true);
      const mine = TILES.filter((t) => t.home === c.id);
      const seen = new Set([hexKey(mine[0].q, mine[0].r)]);
      const st = [mine[0]];
      while (st.length) {
        const x = st.pop()!;
        for (const d of HEX_DIRS) {
          const n = TILE_AT.get(hexKey(x.q + d.q, x.r + d.r));
          if (n && n.home === c.id && !seen.has(hexKey(n.q, n.r))) {
            seen.add(hexKey(n.q, n.r));
            st.push(n);
          }
        }
      }
      expect(seen.size).toBe(mine.length);
    }
    for (const p of ['de-ru', 'de-ua', 'ru-ua', 'cn-ru', 'cn-kp', 'kp-kr', 'ir-tr', 'il-tr']) expect(pairs.has(p)).toBe(true);
    // 11-27 새 나라: 남서유럽·아프리카·중남미는 같은 땅덩어리끼리만 닿음
    for (const p of ['es-fr', 'fr-it', 'eg-et', 'ng-za', 'br-co', 'ar-cl', 'co-ve']) expect(pairs.has(p)).toBe(true);
    const GROUP: Record<string, string> = { fr: 'w', es: 'w', it: 'w', gr: 'w', eg: 'a', dz: 'a', ng: 'a', et: 'a', za: 'a', mx: 'l', co: 'l', ve: 'l', br: 'l', ar: 'l', cl: 'l' };
    for (const p of pairs) {
      const [a, b] = p.split('-');
      if (GROUP[a] || GROUP[b]) expect(GROUP[a], p).toBe(GROUP[b]);
    }
    // 섬나라·따로 떨어진 대륙은 아무와도 닿지 않음
    // 11-25: 중국 새 도시(칭다오)가 둘러싸여 인도 옆에 붙음(실제로도 국경이 맞닿음)
    for (const id of ['uk', 'jp', 'us', 'in', 'fi', 'ca', 'au']) expect([...pairs].some((p) => p !== 'cn-in' && p.split('-').includes(id))).toBe(false);
  });
  it('픽셀 ↔ 칸 변환이 서로 맞음', () => {
    for (const h of Object.values(CITY_HEX)) {
      const p = hexToPixel(h.q, h.r);
      const b = pixelToHex(p.x, p.y);
      expect({ q: b.q + 0, r: b.r + 0 }).toEqual({ q: h.q + 0, r: h.r + 0 });
    }
  });
});
