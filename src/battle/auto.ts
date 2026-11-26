// 맡기기(부관·장군) = 그 판을 자동전투로 끝까지 돌린 결과. 즉시완료와 같은 계산.
import { createArty, finishArty } from './arty';
import { createCourse, finishCourse } from './course';
import { createGridBattle, finishGrid, type Goal } from './grid';
import { createPuzzle, finishPuzzle, type PuzzleKind } from './puzzle';
import { createRange, finishRange } from './range';
import { createShooter, finishShooter } from './shooter';
import { createSideBattle, finishSide, type SideGoal } from './side';
import type { BattleSpec } from './spec';
import { createField, finishField } from './field';
import { autoMini } from './minigames';
import { fieldById } from '../battle3d/fields';
import { endOf, outcomeOf } from '../battle3d/outcome';
import { createSim, defaultPicks, runToEnd } from '../battle3d/sim';

export interface AutoInput {
  spec: BattleSpec;
  stats: Record<string, number>;
  rank: number;
  aides: Array<{ name: string; specialty: string; level: number; bond?: number }>;
}

export const rangeAim = (stats: Record<string, number>, rank: number) => 0.5 + 0.4 * Math.min(1, (stats['사격'] ?? 8) / (20 + rank * 10));

/** 전투 묶음의 부대 정보 → 지도 위 전투 입력 */
export function fieldArmy(spec: BattleSpec) {
  const a = spec.army;
  return { ...(a ? { roster: a.roster, enemyId: a.enemyId, fuel: a.fuel, ammo: a.ammo } : {}), ...(spec.picks ? { picks: spec.picks } : {}) };
}

export function autoResult({ spec, stats, rank, aides }: AutoInput): { win: boolean; stars: number; text: string } {
  const d = spec.difficulty;
  const seed = spec.seed;
  switch (spec.frame) {
    case 'b3d': {
      // 3D 메인 전투: 기본 배치로 명령 없이 끝까지
      const f = fieldById(spec.variant);
      const sim = createSim(f, defaultPicks(f));
      runToEnd(sim);
      return outcomeOf(endOf(sim));
    }
    case 'grid':
      return finishGrid(createGridBattle({ goal: spec.variant as Goal, difficulty: d, rank, stats, aides, seed, squadSize: spec.squadSize, weather: spec.weather, enemy: spec.enemy })).result!;
    case 'side':
      return finishSide(createSideBattle({ goal: spec.variant as SideGoal, difficulty: d, rank, stats, seed })).result!;
    case 'arty':
      return finishArty(createArty({ difficulty: d, rank, stats, seed, weather: spec.weather })).result!;
    case 'shooter':
      return finishShooter(createShooter({ difficulty: d, rank, stats, seed })).result!;
    case 'puzzle':
      return finishPuzzle(createPuzzle(spec.variant as PuzzleKind, seed, rank + Math.round((d - 1) * 10))).result!;
    case 'course':
      return finishCourse(createCourse({ rank, stats, seed })).result!;
    case 'range':
      return finishRange(createRange({ rank, stats, seed }), rangeAim(stats, rank)).result!;
    case 'mini':
      return autoMini(spec.variant, stats, rank, seed);
    case 'field':
      return finishField(createField({ city: spec.city, difficulty: d, rank, stats, seed, enemy: spec.enemy, defense: spec.defense, ...fieldArmy(spec) })).result!;
  }
}
