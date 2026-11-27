import { describe, expect, it } from 'vitest';
import { newGame } from './state';
import { recommendActs, runDay } from './dayPlan';
import { scheduleOf } from './schedule';

describe('대통령의 하루', () => {
  it('빈 칸만큼 서로 다른 일정을 추천하고, 한 번에 다 채운다', () => {
    const s = newGame('t', 'kr', 0, { seed: 2 });
    const rec = recommendActs(s);
    expect(rec.length).toBe(3);
    expect(new Set(rec.map((c) => c.id)).size).toBe(3);
    const r = runDay(s);
    expect(scheduleOf(r.state).slots.filter(Boolean).length).toBe(3);
    expect(r.text.split('\n').length).toBe(3);
    expect(recommendActs(r.state).length).toBe(0);
    expect(runDay(r.state).text).toBe('');
  });
  it('신뢰도가 낮으면 국회 연설이 먼저', () => {
    const s0 = newGame('t', 'kr', 0, { seed: 2 });
    const s = { ...s0, officer: { ...s0.officer, trust: 5 } };
    expect(recommendActs(s)[0].id).toBe('assembly');
  });
});
