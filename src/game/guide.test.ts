import { describe, expect, it } from 'vitest';
import { advance, claimSalary, newGame } from './state';
import { GUIDE, claimGuide, guideOf, guideStep } from './guide';
import { trackGoals, rubyOf } from './goals';
import { setOrder } from './orders';

const H = 3600e3;

describe('첫 판 안내', () => {
  it('조건을 채워야 보상을 받고 다음 단계로', () => {
    let s = advance(newGame('t', 'kr', 0, { seed: 1 }), 2 * H);
    expect(guideStep(s)?.id).toBe('salary');
    expect(claimGuide(s)).toBe(s); // 아직 안 함
    s = trackGoals(s, claimSalary(s));
    const boosts = s.officer.boosts ?? 0;
    s = claimGuide(s);
    expect(guideOf(s).step).toBe(1);
    expect(s.officer.boosts).toBe(boosts + 2);
    expect(guideStep(s)?.id).toBe('train');
  });

  it('미리 명령 단계는 명령 하나만 켜도 완료', () => {
    let s = newGame('t', 'kr', 0, { seed: 1 });
    const i = GUIDE.findIndex((g) => g.id === 'orders');
    s = { ...s, guide: { step: i, hidden: false } };
    expect(guideStep(s)!.done(s)).toBe(false);
    s = setOrder(s, 'autoSalary', true);
    expect(guideStep(s)!.done(s)).toBe(true);
    s = claimGuide(s);
    expect(guideOf(s).step).toBe(i + 1);
  });

  it('마지막 단계 보상 뒤엔 안내가 끝남', () => {
    let s = newGame('t', 'kr', 0, { seed: 1 });
    s = { ...s, guide: { step: GUIDE.length - 1, hidden: false }, goals: { ...(s.goals ?? { ruby: 0, day: 0, daily: [], bonus: false, streak: 0, total: {}, got: [] }), got: ['pay1'] } };
    const r = rubyOf(s);
    s = claimGuide(s);
    expect(guideStep(s)).toBeNull();
    expect(rubyOf(s)).toBe(r + 10);
  });
});
