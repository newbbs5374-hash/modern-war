import { SAVE_VERSION } from './state';
import { describe, expect, it } from 'vitest';
import { CITIES } from '../data/cities';
import { COUNTRIES } from '../data/world';
import { LEADERS } from '../data/leaders';
import { advance, newGame } from './state';
import { parseSave } from './save';
import { citiesOf, eul, ga, gwa, isRival, relationOf } from './world';

const DAY = 24 * 60 * 60 * 1000; // 실제 하루

describe('세계 움직이기', () => {
  it('시작: 도시 46개 모두 원래 주인, 지도자 기본 성향, 시작 구도', () => {
    const s = newGame('t', 'kr', 0, { seed: 1 });
    expect(CITIES.length).toBe(COUNTRIES.reduce((n, c) => n + c.cities.length, 0));
    for (const c of CITIES) expect(s.world.owner[c.id]).toBe(c.home);
    expect(s.world.personalities.kr).toBe(LEADERS.kr.personality);
    expect(relationOf(s.world, 'kr', 'kp')).toBe('중립');
    expect(Object.values(s.world.pairs).some((p) => p.rel === '전쟁')).toBe(false); // 평화로 시작
    expect(s.world.pairs['kp|kr'].tension).toBeGreaterThanOrEqual(20); // 맞수는 긴장 20부터
  });
  it('지도자 성향 무작위', () => {
    const a = newGame('t', 'kr', 0, { seed: 7, randomLeaders: true });
    const b = newGame('t', 'kr', 0, { seed: 8, randomLeaders: true });
    expect(a.world.personalities).not.toEqual(b.world.personalities);
  });
  it('같은 씨앗이면 같은 세계', () => {
    const a = advance(newGame('t', 'kr', 0, { seed: 3 }), 3 * DAY);
    const b = advance(newGame('t', 'kr', 0, { seed: 3 }), 3 * DAY);
    expect(a.world).toEqual(b.world);
  });
  it('2주 동안 외교가 바뀌고 침공 소식이 생기며, 내 나라는 버틴다', () => {
    for (const seed of [1, 2, 3]) {
      const s = advance(newGame('t', 'kr', 0, { seed }), 14 * DAY);
      const kinds = new Set(s.world.events.map((e) => e.kind));
      expect(kinds.has('외교')).toBe(true);
      expect(s.world.events.some((e) => e.mine)).toBe(true);
      expect(citiesOf(s.world, 'kr').length).toBeGreaterThan(0);
      expect(s.world.events.length).toBeLessThanOrEqual(150);
      for (const n of Object.values(s.nations)) {
        expect(Number.isFinite(n.troops) && n.troops >= 0).toBe(true);
        expect(Number.isFinite(n.treasury) && n.treasury >= 0).toBe(true);
      }
    }
  }, 60000); // 긴 모의(2주 × 3판) — 지지도 계산이 붙고 11-25 도시가 129곳으로 늘어 20초를 넘길 수 있음
  it('맞수 판정', () => {
    expect(isRival('us', 'cn')).toBe(true);
    expect(isRival('ru', 'de')).toBe(true);
    expect(isRival('il', 'ir')).toBe(true);
    expect(isRival('de', 'in')).toBe(false);
  });
  it('조사', () => {
    expect(ga('한국')).toBe('한국이');
    expect(ga('미국')).toBe('미국이');
    expect(ga('러시아')).toBe('러시아가');
    expect(eul('부산')).toBe('부산을');
    expect(eul('도쿄')).toBe('도쿄를');
    expect(gwa('중국')).toBe('중국과');
    expect(gwa('인도')).toBe('인도와');
  });
  it('1단계 저장을 불러오면 세계를 새로 만들어 이어간다', () => {
    const s = newGame('대장', 'kr', 0);
    const { world: _w, ...rest } = s;
    void _w;
    const old = JSON.stringify({ ...rest, version: 1, worldMs: 5 * 3600e3 });
    const loaded = parseSave(old);
    expect(loaded?.version).toBe(SAVE_VERSION);
    expect(loaded?.world.nextTickMs).toBeGreaterThan(5 * 3600e3);
    expect(loaded?.player.name).toBe('대장');
  });
});
