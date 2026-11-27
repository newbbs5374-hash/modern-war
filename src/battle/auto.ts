// 맡기기(부관·장군) = 그 판을 자동전투로 끝까지 돌린 결과. 즉시완료와 같은 계산.
// 11-26: 전투는 3D 전투만 남음(훈련 미니게임 · 3D 훈련 · 3D 전투/공성전).
import type { BattleSpec } from './spec';
import { autoMini } from './minigames';
import { COAST, type Kind, autoDeploy, createSim, headlessOutcome, runHeadless, setupDeploy, startBattle, step, useStage } from '../battle3d/sim';
import { runSiegeHeadless } from '../battle3d/siege';
import { actsFor } from '../battle3d/stages';
import { foeHpOf } from '../battle3d/foeHp';
import { stageFor } from '../battle3d/pick';
import { autoThree } from '../battle3d/train3d';
import { isCoastalCity } from '../data/cities';

export interface AutoInput {
  spec: BattleSpec;
  stats: Record<string, number>;
  rank: number;
  aides: Array<{ name: string; specialty: string; level: number; bond?: number }>;
  /** 11-27 특별 병과 ×1.3(우리 · 적 나라) — 맡기기에도 똑같이 */
  usBuff?: Partial<Record<Kind, number>>;
  foeBuff?: Partial<Record<Kind, number>>;
}

/** 3D 전장 한 판을 기본 배치로 끝까지(맡기기) */
export function autoField(spec: Pick<BattleSpec, 'variant' | 'difficulty' | 'kinds' | 'budget'>, buffs: Pick<AutoInput, 'usBuff' | 'foeBuff'> = {}): { win: boolean; stars: number; text: string } {
  if (spec.variant === 'coast') return headlessOutcome(runHeadless(undefined, undefined, buffs));
  const st = stageFor(spec);
  useStage(st);
  const S = createSim();
  setupDeploy(S, autoDeploy(), { foeHp: foeHpOf(spec.difficulty), ...buffs });
  startBattle(S);
  for (let i = 0; i < 9000 && S.phase === 'battle'; i++) step(S);
  const r = headlessOutcome(S);
  useStage(COAST);
  return r;
}

export function autoResult({ spec, stats, rank, usBuff, foeBuff }: AutoInput): { win: boolean; stars: number; text: string } {
  const d = spec.difficulty;
  switch (spec.frame) {
    case 'mini':
      return autoMini(spec.variant, stats, rank, spec.seed);
    case 'b3d':
      return spec.variant === 'siege' ? runSiegeHeadless(foeHpOf(d), undefined, actsFor(spec.seed, spec.city ? isCoastalCity(spec.city) : undefined), { usBuff, foeBuff }).outcome : autoField(spec, { usBuff, foeBuff });
    case 'd3':
      return autoThree(spec.variant, spec.seed);
  }
}
