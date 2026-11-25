import { describe, expect, it } from "vitest";
import { CITIES } from "./cities";
import { PIONEER_ISLANDS, HOLY_HEX } from "./hexmap";
import {
  GEO,
  GEO_PATH,
  ISLAND_LONLAT,
  NARROW_SEA_ISLANDS,
  isLand,
  openSea,
  project,
  seaNearXY,
  voronoiCells,
} from "./realmap";
import { COUNTRIES } from "./world";

describe("현실 세계지도", () => {
  it("13개 나라 모양이 모두 있음", () => {
    for (const c of COUNTRIES)
      expect(GEO_PATH[c.id]?.length).toBeGreaterThan(20);
  });
  it("모든 도시가 지도 안, 대부분 땅 위", () => {
    let land = 0;
    for (const c of CITIES) {
      expect(c.x).toBeGreaterThan(0);
      expect(c.x).toBeLessThan(GEO.W);
      expect(c.y).toBeGreaterThan(0);
      expect(c.y).toBeLessThan(GEO.H);
      if (isLand(c.x, c.y)) land++;
    }
    expect(land).toBeGreaterThanOrEqual(CITIES.length - 6);
  });
  it("분쟁 지역·성지는 바다 위(다른 나라 땅과 겹치지 않음)", () => {
    for (const id of Object.keys(ISLAND_LONLAT)) {
      const p = project(...ISLAND_LONLAT[id]);
      expect(openSea(p.x, p.y, NARROW_SEA_ISLANDS.includes(id) ? 2 : 4)).toBe(true);
    }
    expect(PIONEER_ISLANDS.every((p) => p.x > 0 && p.x < GEO.W)).toBe(true);
    expect(HOLY_HEX.x).toBeGreaterThan(0);
  });
  it("수도 앞바다는 바다", () => {
    for (const c of CITIES.filter((x) => x.capital)) {
      const s = seaNearXY(c.x, c.y, 9);
      expect(isLand(s.x, s.y)).toBe(false);
    }
  });
  it("도시 영역(보로노이)이 도시마다 하나씩", () => {
    for (const c of COUNTRIES) {
      const cells = voronoiCells(CITIES.filter((x) => x.home === c.id));
      expect(Object.keys(cells)).toHaveLength(c.cities.length);
      for (const poly of Object.values(cells))
        expect(poly.length).toBeGreaterThanOrEqual(3);
    }
  });
});
