import { describe, expect, it } from 'vitest';
import { advance, newGame } from './state';
import { LINES, moodsOf, remarksOf } from './remarks';

const H = 3600e3;

describe('정치인 발언(11-24)', () => {
  it('하루면 발언이 여러 개 쌓이고 소식에 뜸', () => {
    const s = advance(newGame('t', 'kr', 0, { seed: 4 }), 24 * H);
    const n = remarksOf(s).log.length;
    expect(n).toBeGreaterThanOrEqual(10);
    expect(s.world.events.some((e) => e.text.includes('야당 대표') || e.text.includes('원내대표') || e.text.includes('논객') || e.text.includes('시민단체'))).toBe(true);
  });
  it('나라 형편에 따라 고르는 발언이 달라짐', () => {
    const s = newGame('t', 'kr', 0, { seed: 1 });
    expect(moodsOf(s)).toContain('any');
    const low = { ...s, pres: { ...(s.pres ?? ({} as never)), approval: 20 } } as typeof s;
    expect(moodsOf(low)).toContain('lowAp');
    expect(LINES.filter((l) => l.who === '야당 대표').length).toBeGreaterThanOrEqual(12);
  });
});
