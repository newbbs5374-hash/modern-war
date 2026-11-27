// 11-26 대장 "실제로 줄어야 현실감": 3D 전투(작전·대전투·공성전·점령지 임무)에서 쓰러진 우리 부대는 가진 부대에서 빠진다.
// 훈련·연습은 모의전이라 빠지지 않는다. 파병 교전은 파병 부대에서 빠진다(game/deploy.ts settleClash).
// 가진 수보다 많이 쓰러져도 가진 만큼만 빠진다(나머지는 예산으로 데려온 지원 부대).
import type { GameState } from './state';
import { baseUnit } from '../data/forces';
import { DEF, type Kind } from '../battle3d/sim';
import { SPECIAL_POWER } from '../data/economy';

/** 부대 묶음에서 쓰러진 만큼 빼기. 돌려주는 것: 남은 묶음 · 실제로 뺀 것 */
export function subtractDead(units: Record<string, number>, dead: Record<string, number> | undefined): { units: Record<string, number>; taken: Record<string, number> } {
  const out = { ...units };
  const taken: Record<string, number> = {};
  for (const [name, n] of Object.entries(dead ?? {})) {
    // 기본 병과부터, 모자라면 같은 바탕의 특화 유닛(예: 이지스 함대 = 구축함)에서
    let left = n;
    for (const key of [name, ...Object.keys(out).filter((x) => x !== name && baseUnit(x) === name)]) {
      const k = Math.min(out[key] ?? 0, left);
      if (k <= 0) continue;
      out[key] -= k;
      if (!out[key]) delete out[key];
      taken[key] = (taken[key] ?? 0) + k;
      left -= k;
      if (!left) break;
    }
  }
  return { units: out, taken };
}

export const takenText = (taken: Record<string, number>) =>
  Object.entries(taken).map(([n, k]) => `${n} ${k}`).join(' · ');

/** 가진 부대(본국)에서 3D 전투 손실을 뺌 */
export function loseUnits(s: GameState, dead: Record<string, number> | undefined): { state: GameState; text: string } {
  const { units, taken } = subtractDead(s.economy.army, dead);
  if (!Object.keys(taken).length) return { state: s, text: '' };
  return { state: { ...s, economy: { ...s.economy, army: units } }, text: `🪦 잃은 부대: ${takenText(taken)}` };
}

/** 3D 전투에 낼 수 있는 부대(바탕 병과 이름별 합). 특화 유닛은 바탕 병과로 셈 */
export function ownedByBase(units: Record<string, number>, dead?: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [n, k] of Object.entries(units)) if (k > 0) out[baseUnit(n)] = (out[baseUnit(n)] ?? 0) + k;
  for (const [n, k] of Object.entries(dead ?? {})) if (out[n]) out[n] = Math.max(0, out[n] - k);
  return out;
}

/** 11-27 나라 특별 병과는 3D 전투에서도 같은 종류보다 체력·공격 ×1.3.
 *  3D 전투는 바탕 병과로 나가므로, 그 병과 중 특별 병과 비율만큼 세짐(모두 특별 병과면 ×1.3). */
export function specialBuffs(units: Record<string, number> | null | undefined): Partial<Record<Kind, number>> {
  const all: Record<string, number> = {};
  const sp: Record<string, number> = {};
  for (const [n, k] of Object.entries(units ?? {})) {
    if (!(k > 0)) continue;
    const b = baseUnit(n);
    all[b] = (all[b] ?? 0) + k;
    if (b !== n) sp[b] = (sp[b] ?? 0) + k;
  }
  const out: Partial<Record<Kind, number>> = {};
  for (const [kind, d] of Object.entries(DEF) as Array<[Kind, { name: string }]>) {
    const n = sp[d.name];
    if (n) out[kind] = Math.round((1 + (SPECIAL_POWER - 1) * n / all[d.name]) * 1000) / 1000;
  }
  return out;
}

/** 두 배수 묶음 곱하기(숙련 × 특별 병과) */
export function mulBuffs(a: Partial<Record<Kind, number>>, b: Partial<Record<Kind, number>>): Partial<Record<Kind, number>> {
  const out: Partial<Record<Kind, number>> = { ...a };
  for (const [k, v] of Object.entries(b) as Array<[Kind, number]>) out[k] = Math.round((out[k] ?? 1) * v * 1000) / 1000;
  return out;
}
