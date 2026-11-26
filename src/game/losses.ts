// 11-26 대장 "실제로 줄어야 현실감": 3D 전투(작전·대전투·공성전·점령지 임무)에서 쓰러진 우리 부대는 가진 부대에서 빠진다.
// 훈련·연습은 모의전이라 빠지지 않는다. 파병 교전은 파병 부대에서 빠진다(game/deploy.ts settleClash).
// 가진 수보다 많이 쓰러져도 가진 만큼만 빠진다(나머지는 예산으로 데려온 지원 부대).
import type { GameState } from './state';

/** 부대 묶음에서 쓰러진 만큼 빼기. 돌려주는 것: 남은 묶음 · 실제로 뺀 것 */
export function subtractDead(units: Record<string, number>, dead: Record<string, number> | undefined): { units: Record<string, number>; taken: Record<string, number> } {
  const out = { ...units };
  const taken: Record<string, number> = {};
  for (const [name, n] of Object.entries(dead ?? {})) {
    const k = Math.min(out[name] ?? 0, n);
    if (k <= 0) continue;
    out[name] -= k;
    if (!out[name]) delete out[name];
    taken[name] = k;
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
