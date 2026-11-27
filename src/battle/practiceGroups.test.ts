import { describe, expect, it } from 'vitest';
import { PRACTICE, PRACTICE_GROUPS } from './spec';

describe('전투 연습장 묶음', () => {
  it('모든 연습 전투가 묶음 하나에 들어감', () => {
    const ids = new Set(PRACTICE_GROUPS.map((g) => g.id));
    for (const p of PRACTICE) expect(ids.has(p.group)).toBe(true);
    for (const g of PRACTICE_GROUPS) expect(PRACTICE.some((p) => p.group === g.id)).toBe(true);
  });
});
