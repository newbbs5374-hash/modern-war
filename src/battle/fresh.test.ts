// 11-26 새 훈련 틀 A~D: 목록·계산 시험
import { describe, expect, it } from 'vitest';
import { MINIGAMES, minisFor } from './minigames';
import { MINI_VIEWS } from '../ui/battle/mini';
import { TRAININGS } from '../data/catalog';
import { trainingPlan } from './spec';
import { autoResult } from './auto';

describe('새 훈련', () => {
  it('새 훈련은 모두 화면이 있고 훈련 창에 나옴', () => {
    const fresh = MINIGAMES.filter((m) => m.fresh);
    expect(fresh.length).toBeGreaterThanOrEqual(6);
    for (const m of fresh) {
      expect(MINI_VIEWS[m.id]).toBeTruthy();
      expect(minisFor(m.training).map((x) => x.id)).toContain(m.id);
      const plan = trainingPlan(m.training, 3, 5, m.id);
      expect(plan.stages[0].frame).toBe('mini');
      expect(autoResult({ spec: plan.stages[0], stats: {}, rank: 3, aides: [] }).stars).toBeGreaterThanOrEqual(0);
    }
    expect(TRAININGS.length).toBe(12);
  });
  it('틀 A 6개: 사격·항공·잠입·포격·해상·체력', () => {
    const a = MINIGAMES.filter((m) => m.fresh === 'A').map((m) => m.training).sort();
    expect(a).toEqual(['사격', '잠입', '체력', '포격', '항공', '해상'].sort());
  });
});
