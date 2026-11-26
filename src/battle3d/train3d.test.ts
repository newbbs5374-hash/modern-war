// 11-26 3D 훈련(안 1~6): 퍼즐 30판·훈련 목록·병과 숙련·주간 합동·자동 결과
import { describe, expect, it } from 'vitest';
import { PUZZLES, puzzleStars, runPuzzle, placeKinds } from './puzzles';
import { DRILLS } from './drills';
import { autoThree, threeFor, unitBuffs, unitLevel, weekInfo, weeklyInfo } from './train3d';
import { TRAININGS } from '../data/catalog';
import { newGame } from '../game/state';
import { finishTraining, startTraining } from '../game/officer';
import { trainingPlan } from '../battle/spec';
import { ST, COAST, runHeadless, headlessOutcome } from './sim';

describe('3D 훈련', () => {
  it('배치 퍼즐 30판: 예산·기준이 있고 기준이 예산 안', () => {
    expect(PUZZLES.length).toBe(30);
    for (const p of PUZZLES) {
      expect(p.parCost).toBeLessThanOrEqual(p.budget);
      expect(p.parT).toBeLessThanOrEqual(120);
      expect(p.kinds.length).toBeGreaterThan(2);
    }
  });
  it('퍼즐: 아무것도 안 내면 별 0, 결과는 늘 같음', () => {
    const p = PUZZLES[0];
    const a = runPuzzle(p, placeKinds(p, ['tank', 'tank']));
    const b = runPuzzle(p, placeKinds(p, ['tank', 'tank']));
    expect(a.simT).toBe(b.simT);
    expect(a.result?.win).toBe(b.result?.win);
    expect(puzzleStars(p, runPuzzle(p, []), 0)).toBe(0);
    expect(ST.id).toBe(COAST.id);
  });
  it('훈련 12개마다 3D 실전이 있고, 전술·통솔엔 퍼즐', () => {
    for (const t of TRAININGS) expect(threeFor(t.name).some((x) => x.tag === '3D 실전')).toBe(true);
    expect(threeFor('전술').some((x) => x.id === 'p3')).toBe(true);
    expect(threeFor('통솔').some((x) => x.id === 'p3')).toBe(true);
    expect(DRILLS.filter((d) => d.id.startsWith('c3-')).length).toBe(7);
  });
  it('훈련 계획: 3D 훈련 id면 d3 전투', () => {
    expect(trainingPlan('전술', 3, 1, 'd3-tac').stages[0].frame).toBe('d3');
    expect(trainingPlan('전술', 3, 1, 'p3').stages[0].frame).toBe('d3');
    expect(trainingPlan('전술', 3, 1, 'w3:5').stages[0].variant).toBe('w3:5');
    expect(trainingPlan('전술', 3, 1).stages[0].frame).toBe('mini');
  });
  it('병과 숙련: 단계마다 +2%, 최대 +10%', () => {
    expect(unitLevel(0)).toBe(0);
    expect(unitLevel(3)).toBe(1);
    expect(unitLevel(999)).toBe(5);
    expect(unitBuffs({ tank: 999, inf: 1 })).toEqual({ tank: 1.1 });
  });
  it('주간 합동: 주마다 전장이 돌아가며 바뀜', () => {
    expect(weekInfo(0).stage.id).not.toBe(weekInfo(1).stage.id);
    expect(weekInfo(3).stage.id).toBe(weekInfo(0).stage.id);
    expect(weeklyInfo(0).week).toBe(0);
  });
  it('훈련 끝: 병과 숙련·퍼즐 별·주간 보상 ×3(주에 한 번)', () => {
    let s = newGame('t', 'kr', 0, { seed: 3 });
    s = startTraining(s, '전술');
    const a = finishTraining(s, { win: true, stars: 3, auto: false, drill: { kinds: ['tank'], puzzle: { n: 1, stars: 3 } } });
    expect(a.state.officer.unitXp?.tank).toBe(3);
    expect(a.state.officer.puzzle3d?.[1]).toBe(3);
    expect(a.result.ok && a.result.unitUp).toEqual(['tank']);
    let t = startTraining(newGame('t', 'kr', 0, { seed: 3 }), '전술');
    const plain = finishTraining(t, { win: true, stars: 2, auto: false });
    t = startTraining(newGame('t', 'kr', 0, { seed: 3 }), '전술');
    const wk = finishTraining(t, { win: true, stars: 2, auto: false, drill: { kinds: [], weekly: 7 } });
    expect(wk.state.officer.weekly3d).toBe(7);
    const e1 = plain.result.ok ? Object.values(plain.result.exp)[0]! : 0;
    const e2 = wk.result.ok ? Object.values(wk.result.exp)[0]! : 0;
    expect(e2).toBe(e1 * 3);
  });
  it('자동: 실전·사격장은 봇으로 끝나고 본 전투는 그대로', () => {
    for (const d of DRILLS) {
      const r = autoThree(d.id, 2);
      expect(r.stars).toBeGreaterThanOrEqual(0);
      expect(r.drill).toBeTruthy();
    }
    expect(autoThree('w3:0', 1).drill?.weekly).toBe(0);
    expect(ST.id).toBe(COAST.id);
    expect(headlessOutcome(runHeadless()).win).toBe(true);
  }, 120000);
});
