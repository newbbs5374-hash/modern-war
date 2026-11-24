// 11/24 대한민국 10개 도시 · 도시 칸 4.5배 · 실제 시설 · 군사 연구시설 · 옛 저장 옮기기
import { describe, expect, it } from 'vitest';
import { advance, newGame, type GameState } from './state';
import * as C from './civ';
import { CITIES, COASTAL_CITIES } from '../data/cities';
import { CITY_TILES, cityMap } from '../data/cityMap';
import { KR_CITY_INFO } from '../data/krCities';
import { hexKey } from '../data/hexmap';
import { parseSave } from './save';

const H = 3600e3;
const rich = (s: GameState): GameState => ({
  ...s,
  nations: { ...s.nations, kr: { ...s.nations.kr, treasury: 1e7 } },
  economy: { ...s.economy, stock: Object.fromEntries(Object.keys(s.economy.stock).map((k) => [k, 500])) as GameState['economy']['stock'] },
});

describe('대한민국 10개 도시', () => {
  it('서울·부산·대구·광주·대전·전주·강릉·제주·여수·순천, 모두 실제 정보와 시설이 있음', () => {
    const kr = CITIES.filter((c) => c.home === 'kr').map((c) => c.name);
    expect(kr).toEqual(['서울', '부산', '대구', '광주', '대전', '전주', '강릉', '제주', '여수', '순천']);
    for (const n of kr) expect(KR_CITY_INFO[n].landmarks.length).toBeGreaterThan(4);
  });
  it('도시 칸은 예전의 약 4.5배이고, 실제 바다에 닿은 도시만 바닷가가 있음', () => {
    for (const c of CITIES) {
      const m = cityMap(c.id);
      expect(m.tiles.length, c.name).toBe(CITY_TILES[c.size]);
      expect(m.tiles.filter((t) => t.center)).toHaveLength(1);
      if (c.home === 'kr') expect(m.coastal, c.name).toBe(COASTAL_CITIES.has(c.name));
    }
    // 서울은 25개 구, 실제 모양이라 내륙
    expect(cityMap('kr-0').gu).toHaveLength(25);
    expect(cityMap('kr-0').coastal).toBe(false);
  });
  it('실제 시설은 칸마다 하나씩, 그 자리엔 구역을 못 짓고, 발전 단계를 올리면 효과가 커짐', () => {
    let s = rich(newGame('t', 'kr', 0, { seed: 3 }));
    const marks = C.cityMarks('kr-4');
    expect(new Set(marks.map((m) => m.tile)).size).toBe(marks.length);
    const add = marks.find((m) => m.id === 'add')!;
    expect(C.canDistrict(s, 'kr-4', add.tile, 'adl')).toMatch(/자리/);
    const gov = marks.find((m) => m.id === 'govdj')!;
    const lv = C.markLevel(s, 'kr-4', gov.id);
    const before = C.loyaltyTarget(s, 'kr-4');
    s = C.upgradeMark(s, 'kr-4', gov.id);
    expect(C.canUpgradeMark(s, 'kr-4', gov.id)).toMatch(/공사/);
    s = advance(s, 1.6 * lv * H);
    expect(C.markLevel(s, 'kr-4', gov.id)).toBe(lv + 1);
    expect(C.loyaltyTarget(s, 'kr-4')).toBeGreaterThan(before);
  });
  it('군사 연구시설: 연구가 필요한 것은 잠기고, 지으면 연구·모집·전투력이 오름', () => {
    let s = rich(newGame('t', 'kr', 0, { seed: 4 }));
    const city = 'kr-1';
    const free = C.cityTiles(city).filter((t) => !t.center && !C.markAt(city, hexKey(t.q, t.r)) && C.terrainOf(city, t.q, t.r) === '평지');
    expect(C.canDistrict(s, city, hexKey(free[0].q, free[0].r), 'drone')).toMatch(/연구/);
    const r0 = C.researchRate(s);
    const b0 = C.civBuildSpeed(s, '보병');
    s = C.buildDistrict(s, city, hexKey(free[0].q, free[0].r), 'adl');
    s = C.buildDistrict(s, city, hexKey(free[1].q, free[1].r), 'arms');
    s = advance(s, 4.1 * H);
    expect(C.researchRate(s)).toBeGreaterThan(r0);
    expect(C.civBuildSpeed(s, '보병')).toBeGreaterThan(b0);
    // 내륙 도시는 군 조선소 불가
    const dj = C.cityTiles('kr-4').find((t) => !t.center && !C.markAt('kr-4', hexKey(t.q, t.r)))!;
    expect(C.canDistrict(s, 'kr-4', hexKey(dj.q, dj.r), 'shipyard')).toMatch(/바다/);
  });
  it('옛 저장: 새 도시 주인을 채우고, 옛 칸 자리의 구역은 새 칸으로 옮김', () => {
    const s = newGame('t', 'kr', 0, { seed: 5 });
    const old = JSON.parse(JSON.stringify(s)) as GameState;
    for (let i = 2; i < 10; i++) {
      delete old.world.owner[`kr-${i}`];
      delete old.world.defense[`kr-${i}`];
    }
    old.civ!.cities['kr-0'] = { loyalty: 70, pop: 3, grow: 0, districts: [{ id: 'industry', tile: '999,999', doneMs: 0, told: true }], mines: [{ tile: '998,998', res: '반도체', doneMs: 0 }] };
    const back = parseSave(JSON.stringify(old))!;
    expect(back).not.toBeNull();
    expect(back.world.owner['kr-9']).toBe('kr');
    const cc = back.civ!.cities['kr-0'];
    expect(cc.districts).toHaveLength(1);
    expect(cityMap('kr-0').at.has(cc.districts[0].tile)).toBe(true);
    expect(cc.mines).toHaveLength(1);
    expect(C.deposits('kr-0').some((d) => d.tile === cc.mines![0].tile)).toBe(true);
  });
});
