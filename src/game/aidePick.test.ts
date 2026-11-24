import { describe, expect, it } from 'vitest';
import { newGame } from './state';
import { AIDE_SPECIALTIES } from '../data/officers';
import { aideCandidates, aideSeats, appointAide, candsOf, canAppointAide, dismissAide, rerollCands, rerollsLeft } from './aidePick';

const g = () => newGame('t', 'kr', 0, { seed: 5 });

describe('부관 병과별 후보 임명', () => {
  it('병과마다 후보 4명, 성향이 모두 다르고 이름이 겹치지 않음', () => {
    const s = g();
    for (const sp of AIDE_SPECIALTIES) {
      const c = candsOf(s, sp);
      expect(c.length).toBe(4);
      expect(new Set(c.map((x) => x.trait)).size).toBe(4);
    }
    const all = aideCandidates(s);
    expect(new Set(all.map((x) => x.name)).size).toBe(all.length);
    expect(all.every((x) => x.faceKey.startsWith('face-kr-'))).toBe(true);
  });
  it('조건 없이 임명, 꽉 차면 교대, 돌려보내기', () => {
    let s = g();
    const start = s.officer.aides.length;
    const c1 = candsOf(s, '저격')[0];
    s = appointAide(s, c1.key);
    expect(s.officer.aides.length).toBe(start + 1);
    const a = s.officer.aides.at(-1)!;
    expect(a.name).toBe(c1.name);
    expect(a.faceKey).toBe(c1.faceKey);
    expect(candsOf(s, '저격').some((x) => x.key === c1.key)).toBe(false);
    while (s.officer.aides.length < aideSeats(s)) s = appointAide(s, candsOf(s, '의무')[0].key);
    const c2 = candsOf(s, '정찰')[0];
    expect(canAppointAide(s, c2.key)).toBeTruthy();
    const out = s.officer.aides[0].id;
    s = appointAide(s, c2.key, out);
    expect(s.officer.aides.length).toBe(aideSeats(s));
    expect(s.officer.aides.some((x) => x.id === out)).toBe(false);
    s = dismissAide(s, s.officer.aides[0].id);
    expect(s.officer.aides.length).toBe(aideSeats(s) - 1);
  });
  it('새 후보 받기는 3번까지, 명단이 바뀜', () => {
    let s = g();
    const before = aideCandidates(s).map((x) => x.name).join();
    s = rerollCands(s);
    expect(aideCandidates(s).map((x) => x.name).join()).not.toBe(before);
    s = rerollCands(rerollCands(s));
    expect(rerollsLeft(s)).toBe(0);
  });
});
