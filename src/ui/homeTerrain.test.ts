import { describe, expect, it } from 'vitest';
import { COUNTRIES } from '../data/world';
import { CITIES } from '../data/cities';
import { homeTerrain } from './homeTerrain';

describe('본부 지도 실제 땅', () => {
  it('13개 나라 모두 도시가 화면 안, 수도는 땅 위, 땅 모양이 있음', () => {
    for (const c of COUNTRIES) {
      const t = homeTerrain(c.id);
      expect(t.land.length, c.id).toBeGreaterThan(50);
      for (const city of CITIES.filter((x) => x.home === c.id)) {
        const [x, y] = t.cityPos[city.id];
        // 도시는 모두 화면 안
        expect(x > 0 && x < 390 && y > 0 && y < 640, city.name).toBe(true);
      }
      const cap = CITIES.find((x) => x.home === c.id && x.capital)!;
      expect(t.onLand(...t.cityPos[cap.id]), cap.name).toBe(true);
    }
  });
  it('한국은 시·도 경계·바다 배 길이 있고, 여수는 표기 대신 실제 도시(11/24)', () => {
    const t = homeTerrain('kr');
    expect(t.inner.length).toBeGreaterThan(50);
    expect(t.seaLoop).not.toBeNull();
    expect(t.marks).toHaveLength(0);
  });
});
