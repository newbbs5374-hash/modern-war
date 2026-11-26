// 11-26 새 훈련 틀 A~D: 목록·계산 시험
import { describe, expect, it } from 'vitest';
import { MINIGAMES, minisFor } from './minigames';
import { MINI_VIEWS } from '../ui/battle/mini';
import { TRAININGS } from '../data/catalog';
import { trainingPlan } from './spec';
import { autoResult } from './auto';
import { Rng } from '../game/rng';
import { AD, CASES, RADIO_TYPES, adBestDay, adDay, adNew, adScore, interroScore, radioAnswer, radioNew, radioScore, radioTick, supNew, supScore, supSend, supTick, SUP, WG, bestNetPath, makeNet, netScore, runNetPath, wegoFoePlan, wegoNew, wegoOver, wegoRun, wegoScore } from './fresh';

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

  it('훈련 12개 모두 새 훈련이 하나씩', () => {
    for (const t of TRAININGS) expect(MINIGAMES.filter((m) => m.fresh && m.training === t.name).length).toBe(1);
  });
  it('틀 C 포로 심문: 사건마다 거짓말 3개, 증거가 있음', () => {
    for (const c of CASES) {
      expect(Object.keys(c.lies).length).toBe(3);
      for (const id of Object.values(c.lies)) expect(c.cards.some((x) => x.id === id)).toBe(true);
      expect(c.lines.length).toBe(6);
    }
    expect(interroScore(3, 0)).toBe(1);
    expect(interroScore(0, 2)).toBe(0);
  });
  it('틀 D 보급: 요청을 바로 보내면 점수가 높음', () => {
    const run = (send: boolean) => {
      const s = supNew();
      const r = new Rng(5);
      while (s.t < SUP.SECS) {
        supTick(s, 0.5, r);
        if (send) for (const q of s.reqs.filter((x) => x.state === 'wait')) supSend(s, q.id);
      }
      return supScore(s);
    };
    expect(run(true)).toBeGreaterThan(run(false));
    expect(run(false)).toBe(0);
  });
  it('틀 D 무전: 바르게 답하면 놓친 것보다 점수가 높음', () => {
    const run = (ans: boolean) => {
      const s = radioNew();
      const r = new Rng(9);
      while (s.t < 60) {
        radioTick(s, 0.5, r);
        if (ans) for (const m of [...s.msgs]) radioAnswer(s, m.id, RADIO_TYPES[m.type].ok);
      }
      return radioScore(s);
    };
    expect(run(true)).toBeGreaterThan(0.8);
    expect(run(false)).toBeLessThan(0.3);
  });
  it('틀 D 광고: 잘 나누면 고르게 나눈 것보다 많이 모음', () => {
    const run = (best: boolean) => {
      const s = adNew(11);
      const r = new Rng(3);
      if (best) {
        const order = s.eff.map((e, i) => [e, i]).sort((a, b) => b[0] - a[0]);
        s.spend = [0, 0, 0, 0];
        s.spend[order[0][1]] = 6;
        s.spend[order[1][1]] = 3;
        s.spend[order[2][1]] = 1;
      } else s.spend = [3, 3, 2, 2];
      for (let d = 0; d < AD.DAYS; d++) adDay(s, r);
      return adScore(s);
    };
    expect(run(true)).toBeGreaterThan(run(false));
    expect(adBestDay([10, 10, 10, 10])).toBeGreaterThan(0);
  });
});
