import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { CITY3D_FILE } from './city3d';
import { CITIES, cityById } from './cities';

describe('도시 3D 자료(11/26)', () => {
  it('목록의 도시는 모두 있는 도시이고 자료 파일도 있음', () => {
    for (const [id, file] of Object.entries(CITY3D_FILE)) {
      expect(cityById(id), id).toBeTruthy();
      expect(existsSync(`public/city3d/${file}.json`), file).toBe(true);
    }
  });
  it('한국 도시는 모두, 다른 나라는 수도를 포함해 3곳', () => {
    for (const c of CITIES.filter((c) => c.home === 'kr')) expect(CITY3D_FILE[c.id], c.name).toBeTruthy();
    const homes = new Set(CITIES.map((c) => c.home));
    for (const h of homes) {
      if (h === 'kr') continue;
      const mine = CITIES.filter((c) => c.home === h && CITY3D_FILE[c.id]);
      expect(mine.length, h).toBe(3);
      expect(mine.some((c) => c.capital), h).toBe(true);
    }
  });
});
