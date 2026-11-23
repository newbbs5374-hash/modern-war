// 시설 효과 계산(다른 모듈이 서로 부르지 않게 따로 둠)
import { BUFF_EFF, BUILDING_SCALE, levelEff, type BuildingId } from '../data/economy';
import type { GameState } from './state';

/** 시설 효과(단계 + 특별 가동 중이면 +BUFF_EFF). 0단계(아직 안 지음) = 0 */
export function facEff(s: GameState, id: BuildingId): number {
  const b = s.economy?.buildings?.[id];
  if (!b || b.level < 1) return 0;
  return levelEff(id, b.level) + (b.buffEndMs > s.worldMs ? BUFF_EFF : 0);
}
/** 새 시설처럼 세기가 따로 정해진 효과(BUILDING_SCALE 곱함) */
export const facBonus = (s: GameState, id: BuildingId): number => facEff(s, id) * (BUILDING_SCALE[id] ?? 1);
