// 전선 지도(11/27 종합 확장안 세계 2): 지금 공격받는 도시와, 그 공격이 어디서 오는지(화살표)를 계산.
import { FRONT, type City } from '../data/cities';
import { CITY_DEFENSE_MAX } from './balance';
import { relationOf, type WorldState } from './world';

export interface Strike {
  /** 공격이 출발하는 도시(공격하는 나라의 가장 가까운 점령 도시) */
  from: City;
  /** 공격받는 도시 */
  to: City;
  /** 공격하는 나라 */
  by: string;
  /** 남은 방어도 비율 0~1 */
  left: number;
}

/** 방어도가 깎인 도시마다, 그 주인과 전쟁 중인 나라의 가장 가까운 도시에서 오는 화살표 하나 */
export function strikes(w: WorldState): Strike[] {
  const out: Strike[] = [];
  for (const c of FRONT) {
    const def = w.defense[c.id] ?? CITY_DEFENSE_MAX;
    if (def >= CITY_DEFENSE_MAX - 2) continue;
    const owner = w.owner[c.id];
    let best: City | null = null;
    let bd = Infinity;
    for (const f of FRONT) {
      const o = w.owner[f.id];
      if (o === owner || relationOf(w, o, owner) !== '전쟁') continue;
      const d = Math.hypot(f.x - c.x, f.y - c.y);
      if (d < bd) {
        bd = d;
        best = f;
      }
    }
    if (best) out.push({ from: best, to: c, by: w.owner[best.id], left: Math.max(0, def / CITY_DEFENSE_MAX) });
  }
  return out;
}
