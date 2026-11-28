// 11-28 7단계 추가 2 "안보리 자리와 거부권": 국제 회의에 상임이사국 5자리(처음은 미·중·러·영·프).
//  · 자리를 가진 나라는 회의 표 +1, 자기나 연합국을 겨눈 제재·수출 금지를 거부권으로 막음(우리는 반대표 = 거부권)
//  · 우리 세계 영향력이 자리 주인보다 높으면 자리를 빼앗으려 할 수 있음(나라 예산, 7일에 한 번, 확률은 영향력 차이)
//  · 망한 나라 자리는 영향력 1등(자리 없는 나라)에게 넘어감
import { COUNTRIES, countryById } from '../data/world';
import { addFavorNote } from './civ';
import { registerDomRows } from './domestic';
import { influenceAll } from './influence';
import { pushReport } from './report';
import { Rng } from './rng';
import { priceBase, type GameState } from './state';
import { P5_START, isP5, p5Of } from './unscSeats';
import { isAlive } from './world';

const DAY = 24 * 3600e3;
export const SEAT_WAIT = 7 * DAY;
export const seatCost = (s: GameState) => Math.max(500, Math.round(priceBase(s) * 3));
export const unscOf = (s: GameState) => s.unsc ?? { seats: [...P5_START], readyMs: 0, vetoes: 0 };

export function seatChance(s: GameState, holder: string): number {
  const all = influenceAll(s);
  const mine = all[s.player.countryId]?.total ?? 0;
  const theirs = all[holder]?.total ?? 0;
  return Math.max(0.15, Math.min(0.85, 0.35 + (mine - theirs) / 300));
}
export function canTakeSeat(s: GameState, holder: string): string | null {
  const me = s.player.countryId;
  if (isP5(s, me)) return '이미 상임이사국이에요';
  if (!isP5(s, holder)) return '상임이사국이 아니에요';
  if (unscOf(s).readyMs > s.worldMs) return '자리 도전은 7일에 한 번이에요';
  const all = influenceAll(s);
  if ((all[me]?.total ?? 0) <= (all[holder]?.total ?? 0)) return '세계 영향력이 자리 주인보다 높아야 해요';
  if (s.nations[me].treasury < seatCost(s)) return '나라 예산이 모자라요';
  return null;
}
export function takeSeat(s: GameState, holder: string): { state: GameState; text: string } {
  const why = canTakeSeat(s, holder);
  if (why) return { state: s, text: why };
  const me = s.player.countryId;
  const u = unscOf(s);
  const rng = new Rng(((s.world.seed ^ Math.floor(s.worldMs / 1000)) * 2246822519) >>> 0);
  const p = seatChance(s, holder);
  let ns: GameState = { ...s, nations: { ...s.nations, [me]: { ...s.nations[me], treasury: s.nations[me].treasury - seatCost(s) } } };
  if (rng.chance(p)) {
    ns = { ...ns, unsc: { ...u, seats: u.seats.map((x) => (x === holder ? me : x)), readyMs: s.worldMs + SEAT_WAIT } };
    ns = addFavorNote(ns, holder, '🏛️ 안보리 자리를 빼앗김', -15);
    const text = `🏛️ 총회 표결로 ${countryById(holder).name}의 안보리 상임이사국 자리를 가져왔어요! 회의 표 +1 · 거부권 · 외교 +4`;
    return { state: pushReport(ns, { icon: '🏛️', text }), text };
  }
  ns = { ...ns, unsc: { ...u, readyMs: s.worldMs + SEAT_WAIT } };
  ns = addFavorNote(ns, holder, '🏛️ 안보리 자리를 노림', -8);
  return { state: ns, text: `🏛️ 자리 도전이 총회에서 부결됐어요(확률 ${Math.round(p * 100)}%). ${countryById(holder).name} 호감 −8` };
}

/** 세계 판단마다: 망한 나라 자리 넘기기 */
export function unscTick(s: GameState): GameState {
  const u = unscOf(s);
  const dead = u.seats.filter((id) => !isAlive(s.world, id));
  if (!dead.length) return s.unsc ? s : { ...s, unsc: u };
  const all = influenceAll(s);
  const seats = [...u.seats];
  let ns = s;
  for (const d of dead) {
    const next = COUNTRIES.map((c) => c.id).filter((id) => isAlive(s.world, id) && !seats.includes(id)).sort((a, b) => (all[b]?.total ?? 0) - (all[a]?.total ?? 0))[0];
    if (!next) continue;
    seats[seats.indexOf(d)] = next;
    ns = pushReport(ns, { icon: '🏛️', text: `${countryById(d).name}이(가) 무너져 안보리 상임이사국 자리가 ${countryById(next).name}에 넘어갔어요.` });
  }
  return { ...ns, unsc: { ...u, seats } };
}

registerDomRows((s, key) => (key === 'diplo' && isP5(s, s.player.countryId) && p5Of(s).length ? [['🏛️ 안보리 상임이사국', 4]] : []));
