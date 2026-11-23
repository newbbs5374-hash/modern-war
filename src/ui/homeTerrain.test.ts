import { describe, expect, it } from 'vitest';
import { COUNTRIES } from '../data/world';
import { HOME_CAP, homeTerrain } from './homeTerrain';

describe('본부 지도 실제 땅', () => {
  it('13개 나라 모두 수도가 땅 위에 있고, 땅 모양이 있음', () => {
    for (const c of COUNTRIES) {
      const t = homeTerrain(c.id);
      expect(t.land.length, c.id).toBeGreaterThan(50);
      expect(t.onLand(...HOME_CAP), c.id).toBe(true);
      for (const [x, y] of t.roadEnds) expect(t.onLand(x, y), c.id).toBe(true);
    }
  });
  it('한국은 시·도 경계가 있고, 바다 배 길도 있음', () => {
    const t = homeTerrain('kr');
    expect(t.inner.length).toBeGreaterThan(50);
    expect(t.seaLoop).not.toBeNull();
  });
});
