// 11-28 국정 37 강화: 적 지원군 경고. 어떤 나라를 치면 누가 그 나라를 도우러 올지 미리 알려 줌.
// hegemony.ts 도움 요청 규칙(helpChance·JOIN_ME·HELP_TROOPS)을 그대로 써서 "도울 확률 · 보낼 병력"을 어림.
import { COUNTRIES, countryById } from '../data/world';
import { ME_MAX_FRONTS } from './balance';
import { HELP_TROOPS, JOIN_ME, helpChance, warsOf } from './hegemony';
import type { GameState } from './state';
import { isAlive, isRival, relationOf } from './world';

export interface Helper {
  id: string;
  name: string;
  /** 도움 요청에 응할 확률 */
  help: number;
  /** 함께 참전할 수 있는지 */
  join: boolean;
  /** 보낼 수 있는 병력(어림) */
  troops: number;
  why: string;
}

/** enemy를 치면 도우러 올 만한 나라(확률 높은 순, 최대 n곳) */
export function reinforceOf(s: GameState, enemy: string, n = 4): Helper[] {
  const me = s.player.countryId;
  const w = s.world;
  if (!enemy || enemy === me) return [];
  const fronts = warsOf(w, me).length + (relationOf(w, me, enemy) === '전쟁' ? 0 : 1);
  const out: Helper[] = [];
  for (const c of COUNTRIES) {
    if (c.id === me || c.id === enemy || !isAlive(w, c.id)) continue;
    if (relationOf(w, c.id, me) === '연합') continue;
    const p = helpChance(w, c.id, enemy, me);
    const ally = relationOf(w, c.id, enemy) === '연합';
    if (p < 0.25 && !ally) continue;
    const join = relationOf(w, c.id, me) !== '전쟁' && fronts < ME_MAX_FRONTS && (ally || isRival(c.id, me));
    out.push({
      id: c.id,
      name: countryById(c.id).name,
      help: p,
      join,
      troops: Math.round((s.nations[c.id]?.troops ?? 0) * HELP_TROOPS),
      why: ally ? '연합국' : isRival(c.id, me) ? '우리의 경쟁국' : '가까운 사이',
    });
  }
  return out.sort((a, b) => b.help - a.help).slice(0, n);
}

/** 함께 참전할 확률 = 도울 확률 × 참전 몫 */
export const joinChance = (h: Helper) => (h.join ? h.help * JOIN_ME : 0);
