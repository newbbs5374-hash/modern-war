// 11-26 새 나라 5개(대만·폴란드·필리핀·파키스탄·사우디아라비아)
import { describe, expect, it } from 'vitest';
import { advance, newGame, type GameState } from './state';
import { parseSave } from './save';
import { COUNTRIES, countryById } from '../data/world';
import { CITIES } from '../data/cities';
import { NATION_GOV } from '../data/nations';
import { specialsOf } from '../data/specials';
import { LEADERS } from '../data/leaders';
import { faceTag } from '../data/faces';
import { relationOf } from './world';

const NEW = ['tw', 'pl', 'ph', 'pk', 'sa'];
const DAY = 24 * 3600e3;

describe('새 나라 5개', () => {
  it('나라마다 도시·내정·특별 병과 2개·지도자가 갖춰져 있음', () => {
    for (const id of NEW) {
      const c = countryById(id);
      expect(CITIES.filter((x) => x.home === id).length, id).toBe(c.cities.length);
      expect(NATION_GOV[id]?.traits, id).toHaveLength(3);
      expect(Object.keys(NATION_GOV[id].ministries).length, id).toBe(Object.keys(NATION_GOV.ua.ministries).length);
      expect(Object.keys(NATION_GOV[id].posts).length, id).toBe(Object.keys(NATION_GOV.ua.posts).length);
      expect(specialsOf(id).map((d) => d.slot).sort(), id).toEqual([1, 2]);
      expect(LEADERS[id], id).toBeTruthy();
      expect(faceTag(id), id).not.toBe('us-we');
    }
  });
  it('새 나라로 시작해서 열흘을 보낼 수 있음', () => {
    for (const id of NEW) {
      const s = advance(newGame('t', id, 0, { seed: 5, realWorld: true }), 5 * DAY); // 11-27 나라 36개: 느려져 닷새로
      expect(s.player.countryId).toBe(id);
      expect(Number.isFinite(s.nations[id].treasury)).toBe(true);
    }
  }, 180000);
  it('지금 세계 정세: 대만 해협·카슈미르 긴장으로 시작', () => {
    const s = newGame('t', 'kr', 0, { seed: 5, realWorld: true });
    expect(s.world.pairs['cn|tw'].tension).toBe(70);
    expect(relationOf(s.world, 'in', 'pk')).toBe('휴전');
  });
  it('옛 저장(13개국)도 그대로 이어 하고 새 나라가 들어옴', () => {
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
    expect(back!.world.owner['tw-0']).toBe('tw');
    const later = advance(back!, 3 * DAY);
    expect(later.world.pairs['cn|tw']).toBeTruthy();
  }, 30000);
});
