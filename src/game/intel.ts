// 11-28 국정 37 강화(외교·국가정보): 위협도 점수 · 그 나라가 지금 원하는 것.
import { RESOURCES, type Res } from '../data/economy';
import { isAlive, pairKey, relationOf } from './world';
import { producesOf, tradePrice } from './economy';
import type { GameState } from './state';

/** 0~100(나·무너진 나라는 −1): 우리와 긴장(전쟁이면 100) × 병력 비율 */
export function threatOf(s: GameState, id: string): number {
  const me = s.player.countryId;
  if (id === me || !isAlive(s.world, id)) return -1;
  const p = s.world.pairs[pairKey(me, id)];
  const base = relationOf(s.world, me, id) === '전쟁' ? 100 : p?.tension ?? 0;
  const ratio = (s.nations[id]?.troops ?? 0) / Math.max(1, s.nations[me]?.troops ?? 1);
  return Math.round(Math.min(100, base * Math.min(1.5, 0.5 + ratio * 0.5)));
}
/** 그 나라가 만들지 못해 가장 비싸게 사는 자원(팔면 호감·이득) */
export function wantOf(s: GameState, id: string): Res | null {
  const have = new Set(producesOf(s, id));
  let best: { r: Res; p: number } | null = null;
  for (const r of RESOURCES) {
    if (have.has(r)) continue;
    const p = tradePrice(s, id, r);
    if (!best || p > best.p) best = { r, p };
  }
  return best?.r ?? null;
}
