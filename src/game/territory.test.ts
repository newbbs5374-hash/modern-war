import { describe, expect, it } from 'vitest';
import { CITIES, cityById } from '../data/cities';
import { COUNTRIES } from '../data/world';
import { newWorld } from './world';
import { inProv, landCount, landOwners, noteCapture, provinces, provincesOf } from './territory';

describe('도(주·성) 땅', () => {
  it('36개 나라 모두 도가 있고, 도시마다 자기 도가 있음', () => {
    for (const c of COUNTRIES) expect(provincesOf(c.id).length).toBeGreaterThan(c.id === 'il' ? 3 : 5);
    for (const city of CITIES) {
      if (!city.front) continue; // 11-25 내정 도시는 거점을 따라가므로 도가 없어도 됨(해안·작은 섬은 경계 자료 밖일 수 있음)
      // 같은 도에 도시가 둘이면(전남 여수·순천) 한 도시만 다스림: 그 도의 주인이 같은 나라면 됨
      const own = provinces().filter((p) => p.seat === city.id || (inProv(p, city.x, city.y) && cityById(p.seat).home === city.home));
      expect(own.length, city.name).toBeGreaterThan(0);
    }
  });
  it('처음엔 모든 도가 처음 나라 것', () => {
    const w = newWorld(1, false, 0);
    const o = landOwners(w);
    for (const p of provinces()) expect(o[p.id]).toBe(p.c);
  });
  it('부산을 점령하면 서울 쪽은 남고, 출발 도시부터 부산까지 길목 땅이 넘어감', () => {
    const w = newWorld(1, false, 0);
    const busan = CITIES.find((c) => c.name === '부산')!;
    const seoul = CITIES.find((c) => c.name === '서울')!;
    const before = landCount(w, 'kr');
    noteCapture(w, busan.id, 'jp');
    w.owner[busan.id] = 'jp';
    const o = landOwners(w);
    expect(landCount(w, 'kr')).toBeLessThan(before - 1);
    const seoulProv = provinces().find((p) => p.c === 'kr' && inProv(p, seoul.x, seoul.y))!;
    expect(o[seoulProv.id]).toBe('kr');
    // 되찾으면 원래대로
    noteCapture(w, busan.id, 'kr');
    w.owner[busan.id] = 'kr';
    expect(landCount(w, 'kr')).toBe(before);
  });
});
