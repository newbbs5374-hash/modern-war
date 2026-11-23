import { describe, expect, it } from 'vitest';
import { newGame } from './state';
import { ALL_CRISES, crisesFor } from './crisis';
import { achList } from './goals';
import { ORIGINS } from './origin';
import { ORIGIN_CRISES, ORIGIN_LINES } from '../data/originContent';

describe('출신 전용 콘텐츠', () => {
  it('출신마다 사건 2개·대사 3줄·업적 1개', () => {
    for (const o of ORIGINS) {
      expect(ORIGIN_CRISES.filter((c) => c.origin === o.id).length).toBe(2);
      expect(ORIGIN_LINES[o.id].length).toBe(3);
    }
    expect(new Set(ALL_CRISES.map((c) => c.id)).size).toBe(ALL_CRISES.length);
  });
  it('그 출신에게만 나옴', () => {
    const a = newGame('t', 'kr', 0, { seed: 1, origin: 'econ' });
    const b = newGame('t', 'kr', 0, { seed: 1 });
    expect(crisesFor(a).some((c) => c.origin === 'econ')).toBe(true);
    expect(crisesFor(a).some((c) => c.origin === 'general')).toBe(false);
    expect(crisesFor(b).some((c) => c.origin)).toBe(false);
    expect(achList(a).filter((x) => x.origin).length).toBe(1);
    expect(achList(b).filter((x) => x.origin).length).toBe(0);
  });
});
