// 국방비(11-26 대장 결정): 내 나라 금고를 둘로 나눔. 국방비 = 부대 만들기·국방 시설 짓기·올리기·파병 유지비.
// 나머지는 모두 나라 예산(treasury). 수입 나누기는 state.ts accrue(예산 나누기의 국방 몫).
import type { GameState } from './state';

/** 내 국방비 */
export const defOf = (s: GameState) => s.nations[s.player.countryId]?.def ?? 0;

/** 국방비 더하기·빼기(0 밑으로 안 감) */
export function addDef(s: GameState, n: number): GameState {
  const me = s.player.countryId;
  const nt = s.nations[me];
  if (!nt) return s;
  return { ...s, nations: { ...s.nations, [me]: { ...nt, def: Math.max(0, (nt.def ?? 0) + n) } } };
}
