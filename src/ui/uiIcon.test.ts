import { describe, expect, it } from 'vitest';
import { fmtK } from './uiIcon';

describe('fmtK', () => {
  it('k 단위로 짧게', () => {
    expect(fmtK(566)).toBe('566');
    expect(fmtK(5000)).toBe('5k');
    expect(fmtK(12_345)).toBe('12.3k');
    expect(fmtK(200_521)).toBe('200k');
    expect(fmtK(2_004_859)).toBe('2,004k');
  });
});
