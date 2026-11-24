import { describe, expect, it } from 'vitest';
import { newGame } from './state';
import { cabinetOf, fitPct, migrateStats2, needPower, type Person } from './cabinet';
import { ALL_STATS, STAT2_IDS } from '../data/stats2';
import { GENERAL_NEEDS, NEEDS } from '../data/needs';
import { MINISTRIES } from '../data/cabinet';
import { POSTS } from '../data/staff';
import { advisorOf, canFollow, followAdvice, pickAdvice, type Tip } from './advice';

describe('스탯 18개', () => {
  const s = newGame('t', 'kr', 0, { seed: 11 });
  const people = cabinetOf(s).people;
  it('모든 인물이 18개 스탯을 가짐', () => {
    expect(ALL_STATS.length).toBe(18);
    for (const p of people) for (const id of ALL_STATS) expect(typeof p.stats[id]).toBe('number');
  });
  it('출신이 강한 스탯이 평균보다 높게 나옴', () => {
    const avg = (list: Person[], id: (typeof ALL_STATS)[number]) => list.reduce((a, p) => a + p.stats[id], 0) / Math.max(1, list.length);
    const dip = people.filter((p) => p.origin === 'diplomat');
    if (dip.length >= 2) expect(avg(dip, '외교')).toBeGreaterThan(avg(people, '외교'));
  });
  it('모든 부처·자리·병과에 안내가 있음', () => {
    for (const m of MINISTRIES) expect(NEEDS[m.id], m.id).toBeTruthy();
    for (const p of POSTS) expect(NEEDS[p.id], p.id).toBeTruthy();
    expect(Object.keys(GENERAL_NEEDS).length).toBe(6);
  });
  it('주 스탯이 높을수록 힘·적합도가 큼', () => {
    const p = { ...people[0], stats: { ...people[0].stats } };
    const need = NEEDS.mofa;
    const lo = needPower(p, need, []);
    p.stats.외교 += 10;
    p.stats.언변 += 10;
    expect(needPower(p, need, [])).toBeGreaterThan(lo);
    expect(fitPct(p, need, [])).toBeGreaterThanOrEqual(0);
    expect(fitPct(p, need, [])).toBeLessThanOrEqual(100);
  });
  it('옛 저장(스탯 9개)을 18개로 채움', () => {
    const c = structuredClone(cabinetOf(s));
    for (const p of c.people) for (const id of STAT2_IDS) delete (p.stats as Record<string, number>)[id];
    migrateStats2(c);
    for (const p of c.people) for (const id of STAT2_IDS) expect(p.stats[id]).toBeGreaterThan(0);
  });
});

describe('부하 조언', () => {
  const tips: Tip[] = [
    { id: 'a', text: 'A', tab: 'x', weight: 5 },
    { id: 'b', text: 'B', tab: 'x', weight: 3 },
    { id: 'i1', text: 'i', tab: 'x', weight: 0 },
    { id: 'i2', text: 'i', tab: 'x', weight: 0 },
    { id: 'i3', text: 'i', tab: 'x', weight: 0 },
  ];
  it('정확도 100%면 급한 일부터 짚음', () => {
    const r = pickAdvice(tips, 1, 5);
    expect(r[0].id).toBe('a');
    expect(r[1].id).toBe('b');
    expect(r.length).toBe(3);
  });
  it('정확도가 낮으면 엉뚱한 말이 섞임', () => {
    let wrong = 0;
    for (let i = 0; i < 50; i++) wrong += pickAdvice(tips, 0.25, i).filter((t) => !t.right).length;
    expect(wrong).toBeGreaterThan(50);
  });
  it('담당자가 없으면 조언 없음, 앉히면 조언하고 따르면 충성이 오름', () => {
    let s = newGame('t', 'kr', 0, { seed: 12 });
    expect(advisorOf(s, 'defense')).toBeNull();
    const c = cabinetOf(s);
    const p = c.people[0];
    s = { ...s, cabinet: { ...c, people: c.people.map((x) => (x.id === p.id ? { ...x, group: '내각', seat: { kind: 'min', id: 'mnd' }, loyalty: 50 } : x)) } };
    const a = advisorOf(s, 'defense');
    expect(a?.p.id).toBe(p.id);
    const s2 = followAdvice(s, 'defense', p.id, true);
    expect(cabinetOf(s2).people.find((x) => x.id === p.id)!.loyalty).toBe(52);
    expect(canFollow(s2, 'defense')).toBe(false);
    expect(followAdvice(s2, 'defense', p.id, true)).toBe(s2);
  });
});
