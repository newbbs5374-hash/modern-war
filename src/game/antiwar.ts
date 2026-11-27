// 11-28 국정 37 강화: 반전 시위. 우리 문화가 앞선(우세) 나라가 우리와 전쟁 중이면, 6시간마다 그 나라에서 반전 시위가 일어날 수 있음.
// 시위가 나면 그 나라 전쟁 피로 +8(휴전을 받아들이기 쉬워짐) · 병력 −2%. 문화가 반쯤(50%↑) 퍼진 나라도 확률은 낮게 일어남.
import { countryById } from '../data/world';
import { cultureLines } from './culture';
import { note } from './officer';
import { Rng } from './rng';
import type { GameState } from './state';
import { pairKey, relationOf } from './world';

const H = 3600e3;
export const ANTIWAR_EVERY = 6 * H;
export const ANTIWAR_P_SWAY = 0.5;
export const ANTIWAR_P_HALF = 0.15;
export const ANTIWAR_WEARY = 8;
export const ANTIWAR_TROOPS = 0.02;

/** 지금 반전 시위가 날 수 있는 나라와 확률 */
export function antiwarOdds(s: GameState): Array<{ id: string; p: number }> {
  const me = s.player.countryId;
  if (!s.culture) return [];
  return cultureLines(s)
    .filter((l) => relationOf(s.world, me, l.id) === '전쟁')
    .map((l) => ({ id: l.id, p: l.sway === '우세' ? ANTIWAR_P_SWAY : l.pct >= 50 ? ANTIWAR_P_HALF : 0 }))
    .filter((x) => x.p > 0);
}

export function antiwarTick(s: GameState): GameState {
  const at = s.antiwarMs ?? s.worldMs + ANTIWAR_EVERY;
  if (s.antiwarMs === undefined) return { ...s, antiwarMs: at };
  if (s.worldMs < at) return s;
  const odds = antiwarOdds(s);
  let ns: GameState = { ...s, antiwarMs: s.worldMs + ANTIWAR_EVERY };
  if (!odds.length) return ns;
  const rng = new Rng(((Math.floor(s.worldMs / H) * 2654435761) >>> 0) || 1);
  const me = s.player.countryId;
  for (const o of odds) {
    if (!rng.chance(o.p)) continue;
    const k = pairKey(me, o.id);
    const pr = ns.world.pairs[k];
    if (!pr) continue;
    const n = ns.nations[o.id];
    const cut = Math.round((n?.troops ?? 0) * ANTIWAR_TROOPS);
    ns = {
      ...ns,
      world: { ...ns.world, events: [...ns.world.events], pairs: { ...ns.world.pairs, [k]: { ...pr, weariness: Math.min(100, pr.weariness + ANTIWAR_WEARY) } } },
      nations: n ? { ...ns.nations, [o.id]: { ...n, troops: n.troops - cut } } : ns.nations,
    };
    note(ns, `✊ ${countryById(o.id).name}에서 반전 시위! 우리 문화를 좋아하는 시민들이 "전쟁 그만"을 외쳐요. 그 나라 전쟁 피로 +${ANTIWAR_WEARY} · 병력 −${cut.toLocaleString('ko-KR')}`);
  }
  return ns;
}
