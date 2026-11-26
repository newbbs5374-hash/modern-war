// 11-26 새 훈련 틀 A~D: 목록·계산 시험
import { describe, expect, it } from 'vitest';
import { MINIGAMES, minisFor } from './minigames';
import { MINI_VIEWS } from '../ui/battle/mini';
import { TRAININGS } from '../data/catalog';
import { trainingPlan } from './spec';
import { autoResult } from './auto';
import { WG, bestNetPath, makeNet, netScore, runNetPath, wegoFoePlan, wegoNew, wegoOver, wegoRun, wegoScore } from './fresh';

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

  it('틀 B 작전 지도: 같은 씨앗이면 같은 결과, 4판이면 끝, 가만히 있으면 점수가 낮음', () => {
    const play = (move: boolean) => {
      const g = wegoNew(3);
      while (!wegoOver(g)) {
        wegoFoePlan(g);
        if (move) g.units.filter((u) => u.side === 'us').forEach((u, i) => (u.path = [[3 + i, 3]]));
        wegoRun(g);
      }
      return wegoScore(g);
    };
    expect(play(true)).toBe(play(true));
    expect(wegoNew(3).round).toBe(0);
    const g = wegoNew(3);
    for (let i = 0; i < WG.ROUNDS; i++) wegoRun(g);
    expect(wegoOver(g)).toBe(true);
    expect(play(false)).toBeLessThan(0.5);
  });
  it('틀 B 서버 침투: 잘못된 길은 0점, 가장 좋은 길은 성공', () => {
    for (let s = 1; s < 20; s++) {
      const n = makeNet(s, 1.2);
      expect(netScore(runNetPath(n, [n.entry, n.target]))).toBe(0);
      const best = bestNetPath(n);
      expect(best[0]).toBe(n.entry);
      expect(best[best.length - 1]).toBe(n.target);
      expect(netScore(runNetPath(n, best))).toBeGreaterThan(0);
    }
  });
});
