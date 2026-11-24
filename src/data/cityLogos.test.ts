import { describe, expect, it } from 'vitest';
import { CITIES } from './cities';
import { CITY_LOGO } from './cityLogos';

describe('도시 상징', () => {
  it('모든 도시에 상징 칸이 있고 이름표가 겹치지 않음', () => {
    for (const c of CITIES) expect(CITY_LOGO[c.name], c.name).toBeTruthy();
    const keys = Object.values(CITY_LOGO).map((x) => x.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
  it('한국 11개 도시는 모두 실제 상징 파일이 정해져 있음', () => {
    for (const c of CITIES.filter((x) => x.home === 'kr')) expect(CITY_LOGO[c.name].file, c.name).toBeTruthy();
  });
});
