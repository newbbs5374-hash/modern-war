import { describe, expect, it } from 'vitest';
import { EASY, EASY_MAX_LV, easyLevel, easyLv, easyNextLv, easyStats } from './easy';
import { MINIGAMES, minisFor } from './minigames';
import { MINI_VIEWS } from '../ui/battle/mini';
import { Rng } from '../game/rng';
import { PACK_H, PACK_W, ambushKills, liarRound, packFits, packPieces, pathEval, sandBest, sandCells, sandScore } from './easyLogic';
import { TRAININGS } from '../data/catalog';

describe('한 손가락 미니 훈련', () => {
  it('84개 · 훈련마다 7개 · id 겹침 없음', () => {
    expect(EASY.length).toBe(84);
    for (const t of TRAININGS) expect(EASY.filter((e) => e.training === t.name).length, t.name).toBe(7);
    expect(new Set(EASY.map((e) => e.id)).size).toBe(84);
  });
  it('1차 24개가 열려 있고 화면이 있다(훈련마다 2개)', () => {
    const on = EASY.filter((e) => e.view);
    expect(on.length).toBe(24);
    for (const e of on) {
      expect(MINI_VIEWS[e.id], e.name).toBeTruthy();
      expect(MINIGAMES.find((m) => m.id === e.id)?.easy).toBe(e.ctl);
    }
    for (const t of TRAININGS) expect(minisFor(t.name).filter((m) => m.easy).length, t.name).toBe(2);
  });
  it('능력은 내 능력 9개로 바뀌고 겹치지 않는다', () => {
    for (const e of EASY) {
      const st = easyStats(e);
      expect(st.length, e.name).toBeGreaterThan(0);
      expect(new Set(st).size).toBe(st.length);
    }
  });
  it('단계: 별 2개부터 오르고 5단계가 끝', () => {
    expect(easyNextLv(1, 1)).toBe(1);
    expect(easyNextLv(1, 2)).toBe(2);
    expect(easyNextLv(EASY_MAX_LV, 3)).toBe(EASY_MAX_LV);
    expect(easyLv(undefined, 'x')).toBe(1);
    expect(easyLevel(1)).toBe(1);
    expect(easyLevel(5)).toBe(2);
  });
});

describe('미니 훈련 규칙', () => {
  it('모래판: 가장 좋은 배치는 1점, 엉뚱한 배치는 그보다 낮다', () => {
    for (let seed = 1; seed < 30; seed++) {
      const b = sandCells(new Rng(seed), 1 + (seed % 5) * 0.25);
      expect(b.cells.length).toBe(6);
      expect(sandBest(b)).toBeGreaterThan(0);
      let best = 0;
      for (let a = 0; a < 6; a++) for (let c = 0; c < 6; c++) for (let d = 0; d < 6; d++) if (a !== c && a !== d && c !== d) best = Math.max(best, sandScore(b, { inf: a, tank: c, spg: d }).score);
      expect(best).toBeCloseTo(1);
      expect(sandScore(b, {}).score).toBe(0);
    }
  });
  it('매복: 사거리 안 가까운 차를 조마다 3대까지', () => {
    const cars = [[0, 0], [1, 0], [2, 0], [3, 0], [20, 0], null];
    expect(ambushKills([[0, 0]], cars)).toEqual([0, 1, 2]);
    expect(ambushKills([[0, 0], [1, 0]], cars)).toEqual([0, 1, 2, 3]);
    expect(ambushKills([[50, 50]], cars)).toEqual([]);
  });
  it('호송: 다리로 건너면 살고, 강에 빠지면 모두 잃고, 매복 원마다 1대', () => {
    const m = { start: [-8, 0], goal: [8, 0], bridges: [3], haz: [{ x: 4, z: 0, r: 1 }] };
    expect(pathEval(m, [[-8, 0], [8, 0]], 4).alive).toBe(0);
    const viaBridge = pathEval(m, [[-8, 0], [-2, 3], [2, 3], [8, 0]], 4);
    expect(viaBridge.alive).toBe(4);
    expect(viaBridge.score).toBe(1);
    const hit = pathEval(m, [[-8, 0], [-2, 3], [2, 3], [4, 0], [8, 0]], 4);
    expect(hit.alive).toBe(3);
    expect(hit.lossAt.length).toBe(1);
  });
  it('짐 싣기: 조각을 제자리에 놓으면 짐칸이 꼭 찬다', () => {
    for (let seed = 1; seed < 30; seed++) {
      const ps = packPieces(new Rng(seed), 1 + (seed % 5) * 0.25);
      const grid = Array(PACK_W * PACK_H).fill(-1);
      ps.forEach((p, i) => {
        expect(packFits(grid, p, p.home[0], p.home[1])).toBe(true);
        p.cells.forEach(([x, y]) => (grid[(p.home[1] + y) * PACK_W + p.home[0] + x] = i));
      });
      expect(grid.every((x) => x >= 0)).toBe(true);
    }
  });
  it('첩보: 거짓은 늘 하나', () => {
    for (let seed = 1; seed < 30; seed++) {
      const r = liarRound(new Rng(seed), 1.5);
      expect(r.facts.length).toBe(3);
      expect(r.lie).toBeGreaterThanOrEqual(0);
      expect(r.facts[r.lie]).toContain('첩보원');
    }
  });
});
