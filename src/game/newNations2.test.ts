// 11-27 새 나라 18개(아프리카 5·남미 5·호주·캐나다·멕시코·유럽 5)
import { describe, expect, it } from 'vitest';
import { advance, newGame, type GameState } from './state';
import { parseSave } from './save';
import { COUNTRIES, countryById } from '../data/world';
import { CITIES } from '../data/cities';
import { NATION_GOV } from '../data/nations';
import { specialsOf } from '../data/specials';
import { LEADERS } from '../data/leaders';
import { NEW_FACE_COUNTRIES2 as NEW } from '../data/faces';
import { regionOf } from '../data/regions';
import { archRivalsOf } from '../data/archRivals';
import { relationOf } from './world';

const DAY = 24 * 3600e3;

describe('새 나라 18개', () => {
  it('나라마다 도시·내정·특별 병과 2개·지도자·대륙·숙적이 갖춰져 있음', () => {
    expect(NEW).toHaveLength(18);
    for (const id of NEW) {
      const c = countryById(id);
      expect(CITIES.filter((x) => x.home === id).length, id).toBe(c.cities.length);
      expect(NATION_GOV[id]?.traits, id).toHaveLength(3);
      expect(Object.keys(NATION_GOV[id].ministries).length, id).toBe(Object.keys(NATION_GOV.ua.ministries).length);
      expect(Object.keys(NATION_GOV[id].posts).length, id).toBe(Object.keys(NATION_GOV.ua.posts).length);
      expect(specialsOf(id).map((d) => d.slot).sort(), id).toEqual([1, 2]);
      expect(LEADERS[id], id).toBeTruthy();
      expect(['africa', 'americas', 'europe', 'asia'], id).toContain(regionOf(id));
      expect(archRivalsOf(id).length, id).toBeGreaterThan(0);
    }
    // 아메리카 패권: 미국·캐나다·멕시코·남미 5개가 함께 다툼
    expect(COUNTRIES.filter((c) => regionOf(c.id) === 'americas')).toHaveLength(8);
  });
  it('새 나라로 시작해서 사흘을 보낼 수 있음', () => {
    for (const id of ['eg', 'br', 'au', 'fr']) {
      const s = advance(newGame('t', id, 0, { seed: 5, realWorld: true }), 3 * DAY);
      expect(s.player.countryId).toBe(id);
      expect(Number.isFinite(s.nations[id].treasury)).toBe(true);
    }
  }, 180000);
  it('지금 세계 정세: 나일강 댐·포클랜드 긴장으로 시작', () => {
    const s = newGame('t', 'kr', 0, { seed: 5, realWorld: true });
    expect(s.world.pairs['eg|et'].tension).toBe(50);
    expect(s.world.pairs['ar|uk'].tension).toBe(40);
    expect(relationOf(s.world, 'fr', 'it')).toBe('연합');
  });
  it('옛 저장(18개국)도 그대로 이어 하고 새 나라가 들어옴', () => {
    const s = newGame('t', 'kr', 0, { seed: 7 });
    const old = JSON.parse(JSON.stringify(s)) as GameState;
    for (const id of NEW) {
      delete old.nations[id];
      delete old.world.personalities[id];
      for (const k of Object.keys(old.world.pairs)) if (k.split('|').includes(id)) delete old.world.pairs[k];
      for (const c of CITIES.filter((x) => x.home === id)) {
        delete old.world.owner[c.id];
        delete old.world.defense[c.id];
      }
    }
    const back = parseSave(JSON.stringify(old));
    expect(back).not.toBeNull();
    for (const c of COUNTRIES) expect(back!.nations[c.id], c.id).toBeTruthy();
    expect(back!.world.owner['br-0']).toBe('br');
    expect(back!.world.events[0].text).toContain('18개');
    const later = advance(back!, 1 * DAY);
    expect(later.world.pairs['ar|br']).toBeTruthy();
  }, 60000);
});
