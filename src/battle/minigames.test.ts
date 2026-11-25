import { expect, test } from 'vitest';
import { MINIGAMES, autoMini, minisFor, miniOutcome, pickMini } from './minigames';
import { TRAININGS } from '../data/catalog';
import { cipherOk, makeCipher, makeFlowPuzzle, makePipePuzzle, makeSlidePuzzle, makeTruck, pipeConnected, solvable } from './miniLogic';
import { trainingPlan } from './spec';
import { autoResult } from './auto';
import { Rng } from '../game/rng';
import { MINI_VIEWS } from '../ui/battle/mini';

test('훈련 12개마다 미니게임 3개, 모두 화면이 있음', () => {
  for (const t of TRAININGS) {
    expect(MINIGAMES.filter((m) => m.training === t.name).length).toBe(3);
    expect(minisFor(t.name).length).toBeGreaterThan(0);
  }
  expect(MINIGAMES.length).toBe(36);
  for (const m of MINIGAMES) expect(MINI_VIEWS[m.id]).toBeTruthy();
  expect(new Set(MINIGAMES.map((m) => m.id)).size).toBe(36);
});

test('끈 미니게임은 안 나옴', () => {
  const m = MINIGAMES.find((x) => x.id === 'sneak-lock')!;
  m.on = false;
  expect(minisFor('잠입').map((x) => x.id)).not.toContain('sneak-lock');
  for (let s = 0; s < 20; s++) expect(pickMini('잠입', s).id).not.toBe('sneak-lock');
  m.on = true;
});

test('훈련 계획 = 미니게임 1판, 자동 결과는 성공', () => {
  const stats = { 체력: 10, 사격: 10, 은밀: 10, 통솔: 10, 전술: 10, 포격: 10, 군수: 10, 정치: 10, 정보: 10 };
  for (const t of TRAININGS) {
    const plan = trainingPlan(t.name, 3, 99, minisFor(t.name)[1].id);
    expect(plan.stages[0].frame).toBe('mini');
    expect(plan.stages[0].variant).toBe(minisFor(t.name)[1].id);
    const r = autoResult({ spec: plan.stages[0], stats, rank: 3, aides: [] });
    expect(r.win).toBe(true);
  }
  expect(autoMini('fit-run', {}, 0, 1).stars).toBeGreaterThan(0);
  expect(miniOutcome(0.9, 'x').stars).toBe(3);
  expect(miniOutcome(0.3, 'x').win).toBe(false);
});

test('퍼즐은 모두 풀 수 있음', () => {
  const rng = new Rng(12345);
  for (let i = 0; i < 60; i++) {
    const p = makeSlidePuzzle(rng, 2 + (i % 4));
    expect(solvable(p)).toBe(true);
    const pp = makePipePuzzle(rng, 5 + (i % 2), 5 + (i % 2));
    expect(pipeConnected(pp, pp.shape.map(() => 0))).toBe(true);
    const f = makeFlowPuzzle(rng, 5, 3 + (i % 3));
    const all = f.paths.flat();
    expect(new Set(all).size).toBe(all.length);
    const truck = makeTruck(rng, 6, 4);
    expect(truck.reduce((a, p) => a + p.length, 0)).toBe(24);
    const c = makeCipher(rng);
    expect(cipherOk(c.nums, c.shift)).toBe(true);
    expect(Array.from({ length: 10 }, (_, k) => k).filter((k) => cipherOk(c.nums, k)).length).toBe(1);
  }
});
