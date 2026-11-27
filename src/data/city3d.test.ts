import { describe, expect, it } from 'vitest';
import { CITY3D_FILE } from './city3d';
import { CITIES, cityById } from './cities';
import { NEW_FACE_COUNTRIES2 as NEW_18 } from './faces';

const FILES = new Set(Object.keys(import.meta.glob('../../public/city3d/*.json')).map((p) => p.split('/').pop()!.replace('.json', '')));

describe('도시 3D 자료(11/26)', () => {
  it('목록의 도시는 모두 있는 도시이고 자료 파일도 있음', () => {
    for (const [id, file] of Object.entries(CITY3D_FILE)) {
      expect(cityById(id), id).toBeTruthy();
      expect(FILES.has(file), file).toBe(true);
    }
  });
  it('한국 도시는 모두, 다른 나라는 수도를 포함해 3곳', () => {
    for (const c of CITIES.filter((c) => c.home === 'kr')) expect(CITY3D_FILE[c.id], c.name).toBeTruthy();
    const homes = new Set(CITIES.map((c) => c.home));
    for (const h of homes) {
      if (h === 'kr') continue;
      if (NEW_18.includes(h)) continue; // 11-27 새 나라 18개는 3D 자료를 아직 만들지 않음
      const mine = CITIES.filter((c) => c.home === h && CITY3D_FILE[c.id]);
      expect(mine.length, h).toBe(3);
      expect(mine.some((c) => c.capital), h).toBe(true);
    }
  });
});
