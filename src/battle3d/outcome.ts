// 3D 메인 전투 결과 → 게임 결과(승패 · 별 · 한 줄). 화면과 자동전투가 같이 씀.
import { fmtTime, type Sim } from './sim';

export interface B3dEnd {
  win: boolean;
  timeout: boolean;
  t: number;
  lost: number;
  total: number;
}

export function endOf(sim: Sim): B3dEnd {
  const mine = sim.units.filter((u) => u.side === 'us' && !u.d.missile && u.kind !== 'cvjet');
  return { win: !!sim.over?.win, timeout: !!sim.over?.timeout, t: sim.t, lost: mine.filter((u) => !u.alive).length, total: mine.length };
}

/** 별: 이기면 손실 ¼ 이하 3개, ½ 이하 2개, 나머지 1개 */
export function outcomeOf(e: B3dEnd): { win: boolean; stars: number; text: string } {
  const k = e.total ? e.lost / e.total : 0;
  const stars = e.win ? (k <= 0.25 ? 3 : k <= 0.5 ? 2 : 1) : 0;
  const why = e.win ? '적 지휘소 파괴' : e.timeout ? '제한 시간 초과' : '아군 전멸';
  return { win: e.win, stars, text: `${why} · 걸린 시간 ${fmtTime(e.t)} · 아군 손실 ${e.lost}/${e.total}` };
}
