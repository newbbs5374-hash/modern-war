import { describe, expect, it } from 'vitest';
import { advance, newGame } from './state';
import { CRISES, CRISIS_ANSWER_MS, canChoose, chooseCrisis, crisisOf, debugCrisis, crisisTick } from './crisis';
import { goalsOf, trackGoals } from './goals';

const H = 3600e3;

describe('돌발 사건', () => {
  it('처음 6시간 뒤 사건이 열리고, 직접 고르면 효과가 들고 해결 수가 오름', () => {
    let s = newGame('t', 'kr', 0, { seed: 9 });
    s = advance(s, 5 * H);
    expect(crisisOf(s).open).toBeNull();
    s = advance(s, 1.2 * H);
    const o = crisisOf(s).open;
    expect(o).not.toBeNull();
    const d = CRISES.find((x) => x.id === o!.def)!;
    const i = d.options.findIndex((x) => !canChoose(s, x));
    const b = s;
    s = chooseCrisis(s, i);
    expect(crisisOf(s).open).toBeNull();
    expect(crisisOf(s).solved).toBe(1);
    expect(crisisOf(s).log[0]).toContain(d.title);
    s = trackGoals(b, s);
    expect(goalsOf(s).total.event).toBe(1);
  });

  it('시간 안에 안 고르면 부관이 고름(해결 수는 안 오름)', () => {
    let s = debugCrisis(newGame('t', 'kr', 0, { seed: 3 }));
    expect(crisisOf(s).open).not.toBeNull();
    s = crisisTick({ ...s, worldMs: s.worldMs + CRISIS_ANSWER_MS + 1 });
    expect(crisisOf(s).solved).toBe(0);
    expect(crisisOf(s).log[0]).toContain('부관');
  });

  it('국방예산이 모자라면 돈 드는 선택은 못 고름', () => {
    let s = newGame('t', 'kr', 0, { seed: 1 });
    s = { ...s, nations: { ...s.nations, kr: { ...s.nations.kr, treasury: 0 } } };
    const oil = CRISES.find((x) => x.id === 'oil')!;
    expect(canChoose(s, oil.options[1])).toMatch(/모자라/);
    expect(canChoose(s, oil.options[2])).toBeNull();
  });

  it('모든 사건은 선택지 2~3개, 부관 선택 번호가 올바름', () => {
    for (const d of CRISES) {
      expect(d.options.length).toBeGreaterThanOrEqual(2);
      expect(d.options.length).toBeLessThanOrEqual(3);
      expect(d.options[d.auto]).toBeDefined();
    }
  });
});
