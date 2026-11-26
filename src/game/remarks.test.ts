import { describe, expect, it } from 'vitest';
import { advance, newGame } from './state';
import { LINES, moodsOf, remarksOf } from './remarks';

const H = 3600e3;

describe('정치인 발언(11-24)', () => {
  it('11-26: 하루면 발언이 30개 넘게, 정적이 가장 많이 말하고 거들기도 함', () => {
    const s = advance(newGame('t', 'kr', 0, { seed: 4 }), 24 * H);
    const log = remarksOf(s).log;
    expect(log.length).toBeGreaterThanOrEqual(30);
    const names = new Set(s.officer.rivals.map((r) => r.name));
    expect(log.filter((r) => r.name && names.has(r.name)).length).toBeGreaterThan(log.length / 2);
    expect(log.some((r) => r.echo)).toBe(true);
  });
  it('11-26: 옛 저장(정적 3명)을 불러오면 12명으로 채움', async () => {
    const { parseSave } = await import('./save');
    const s = newGame('t', 'kr', 0, { seed: 9 });
    const old = { ...s, officer: { ...s.officer, rivals: s.officer.rivals.slice(0, 3).map(({ faceKey: _f, sex: _s, eth: _e, ...r }) => r) } };
    const loaded = parseSave(JSON.stringify(old))!;
    expect(loaded.officer.rivals.length).toBe(12);
    expect(loaded.officer.rivals.slice(0, 3).map((r) => r.name)).toEqual(s.officer.rivals.slice(0, 3).map((r) => r.name));
    expect(loaded.officer.rivals.every((r) => r.faceKey)).toBe(true);
  });
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
