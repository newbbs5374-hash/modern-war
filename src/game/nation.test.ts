import { describe, expect, it } from 'vitest';
import { COUNTRIES } from '../data/world';
import { MINISTRIES, ministryById } from '../data/cabinet';
import { POSTS, postById } from '../data/staff';
import { GOV_FACILITIES, govFacById } from '../data/govFacilities';
import { NATION_GOV } from '../data/nations';
import { GENERAL_TITLE, applyNation, nationEff, nationTraits } from './nation';
import { newGame } from './state';
import { govFacCity } from './govFac';
import { cabBudget, postEff } from './cabinet';

describe('나라별 내정(11-25)', () => {
  it('13개국 모두 자료가 있고 특징은 강점 2·약점 1', () => {
    for (const c of COUNTRIES) {
      const g = NATION_GOV[c.id];
      expect(g, c.id).toBeTruthy();
      expect(g.traits.length).toBe(3);
      expect(g.traits.filter((t) => t.weak).length).toBe(1);
      for (const id of Object.keys(g.ministries)) expect(MINISTRIES.some((m) => m.id === id), `${c.id} ${id}`).toBe(true);
      for (const id of Object.keys(g.posts)) expect(POSTS.some((p) => p.id === id), `${c.id} ${id}`).toBe(true);
      for (const id of Object.keys(g.facilities)) expect(GOV_FACILITIES.some((f) => f.id === id), `${c.id} ${id}`).toBe(true);
    }
  });
  it('나라를 고르면 이름이 그 나라 것으로, 한국으로 돌아오면 원래대로', () => {
    applyNation('us');
    expect(ministryById('nis').name).toBe('중앙정보국(CIA)');
    expect(postById('bok').name).toBe('연방준비제도 의장');
    expect(govFacById('cemetery')!.name).toBe('알링턴 국립묘지');
    applyNation('jp');
    expect(ministryById('mnd').name).toBe('방위성');
    expect(GENERAL_TITLE.합참).toBe('통합막료장');
    applyNation('kr');
    expect(ministryById('nis').name).toBe('국가정보원');
    expect(postById('bok').name).toBe('한국은행 총재');
    expect(GENERAL_TITLE.합참).toBe('합참의장');
  });
  it('특징 효과가 실제 계산에 들어감', () => {
    const us = newGame('t', 'us', 0);
    expect(nationEff('us', 'budget')).toBeCloseTo(0.08);
    expect(cabBudget(us)).toBeGreaterThanOrEqual(1.08 - 1e-9);
    const kp = newGame('t', 'kp', 0);
    expect(postEff(kp, 'troop')).toBeGreaterThanOrEqual(0.15 - 1e-9);
    expect(nationTraits('kp')[2].weak).toBe(true);
    applyNation('kr');
  });
  it('시설은 그 나라 실제 도시에 놓임', () => {
    const s = newGame('t', 'us', 0);
    const cities = COUNTRIES.find((c) => c.id === 'us')!.cities;
    expect(govFacCity(s, govFacById('cemetery')!)).toBe(`us-${cities.indexOf('워싱턴')}`);
    applyNation('kr');
  });
});
