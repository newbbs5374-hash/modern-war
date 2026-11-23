import { describe, expect, it } from 'vitest';
import { CITIES } from '../data/cities';
import { COUNTRIES } from '../data/world';
import { EXCLUSIVES, SPECIALS, specialsOf } from '../data/specials';
import { UNIT_COST } from '../data/economy';
import { buildField, createField, finishField, unitName } from './field';

const stats = { 통솔: 30, 전술: 30, 포격: 30, 정보: 30, 군수: 30, 사격: 30 };
const seaCities = CITIES.filter((c) => buildField(c.id).hasSea);

function rate(extra: Parameters<typeof createField>[0] extends infer T ? Partial<T> : never, d = 1.3) {
  let win = 0;
  for (const [i, c] of CITIES.entries()) if (finishField(createField({ city: c.id, difficulty: d, rank: 6, stats, seed: 100 + i, ...extra })).result!.win) win++;
  return win / CITIES.length;
}

describe('특화 유닛·독점 병과', () => {
  it('나라마다 특화 유닛 2개, 바탕 병과는 모두 있는 병과', () => {
    for (const c of COUNTRIES) {
      const list = specialsOf(c.id);
      expect(list.map((d) => d.slot)).toEqual([1, 2]);
      for (const d of list) expect(UNIT_COST[d.base]).toBeTruthy();
    }
    expect(SPECIALS.length).toBe(26);
    expect(new Set(SPECIALS.map((d) => d.name)).size).toBe(26);
    for (const x of EXCLUSIVES) expect(UNIT_COST[x.name]).toBeTruthy();
  });
  it('가진 특화 유닛이 지도 위 전투에 나오고, 적 나라 특화 유닛도 나옴', () => {
    const city = seaCities[0].id;
    const b = createField({ city, difficulty: 1, rank: 6, stats, seed: 5, roster: { 'kr-2': 3, 'kr-1': 1, 강습상륙함: 1 }, enemyId: 'cn' });
    const mine = b.units.filter((u) => u.side === 'me' && u.sp).map((u) => unitName(u));
    expect(mine.filter((n) => n === '흑표 수출 전차').length).toBe(2); // 종류마다 2부대까지
    expect(mine).toContain('자주포 포병대');
    expect(mine).toContain('강습상륙함');
    const foe = b.units.filter((u) => u.side === 'foe' && u.sp).map((u) => unitName(u));
    expect(foe).toContain('대규모 동원 사단');
    expect(foe).toContain('남해 호위전단');
  });
  it('특화 유닛이 있으면 이기기 쉬워지고, 연료·탄약이 모자라면 어려워짐', { timeout: 120000 }, () => {
    const base = rate({});
    const strong = rate({ roster: { 'de-1': 2, 'de-2': 2 } });
    const poor = rate({ fuel: 0.3, ammo: 0.3 });
    console.log(`난이도 1.3 승률: 보통 ${Math.round(base * 100)}% · 독일 특화 ${Math.round(strong * 100)}% · 연료·탄약 30% ${Math.round(poor * 100)}%`);
    expect(strong).toBeGreaterThanOrEqual(base);
    expect(poor).toBeLessThanOrEqual(base);
  });
  it('같은 입력이면 같은 결과(특화 유닛 포함)', () => {
    const inp = { city: seaCities[1].id, difficulty: 1.2, rank: 6, stats, seed: 77, roster: { 'us-1': 1, 'us-2': 2, '원자력 잠수함': 1, '레이저 방공함': 1 }, enemyId: 'ru', fuel: 0.6, ammo: 0.8 };
    expect(finishField(createField(inp)).result).toEqual(finishField(createField(inp)).result);
  });
});
