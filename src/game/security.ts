// 11-27 종합 확장안 전투 9: 점령지 치안 작전.
// 점령한(아직 편입 안 된) 도시에 가끔 저항 조직이 생김. 6시간 안에 손쓰지 않으면 파괴 공작을 벌임.
//  · 소탕: 부대를 보내 힘으로 누름(성공률은 부대 전투력·통솔). 이기면 조직이 사라지지만 민심이 조금 깎임
//  · 회유: 예산을 써서 달램(성공률은 정치 스탯). 성공하면 민심이 오름
//  · 내버려 두면 민심 · 방어도가 깎이고 복구비가 나감
import { cityById } from '../data/cities';
import { occupiedCities } from './annex';
import { cityCiv, civOf } from './civ';
import { armyPower } from './economy';
import { pushReport } from './report';
import { Rng } from './rng';
import { budgetPerDay, type GameState } from './state';

const H = 3600e3;
export const SEC_GAP_MS: [number, number] = [10 * H, 18 * H];
export const SEC_DUE_MS = 6 * H;
export const SEC_MAX = 2;
export const SWEEP_LOYALTY = 2;
export const TALK_LOYALTY = 4;
/** 회유 값(하루 예산의 몫) */
export const TALK_COST = 0.04;
export const SAB_LOYALTY = 4;
export const SAB_DEFENSE = 6;
export const SAB_COST = 0.03;
export const SWEEP_FAME = 5;

export interface Cell { id: number; city: string; size: number; dueMs: number; tried?: boolean }
export interface SecState { nextMs: number; list: Cell[]; nextId: number; seed: number; cleared: number; hit: number }
export const secOf = (s: GameState): SecState => s.sec ?? { nextMs: s.worldMs + SEC_GAP_MS[0], list: [], nextId: 1, seed: (s.world.seed ^ 0x27d4eb2f) >>> 0, cleared: 0, hit: 0 };

export const sweepChance = (s: GameState, size: number) => Math.max(0.25, Math.min(0.95, 0.55 + Math.min(0.25, armyPower(s) / 6000) + (s.officer.stats['통솔'] ?? 0) / 250 - size * 0.08));
export const talkChance = (s: GameState, size: number) => Math.max(0.2, Math.min(0.9, 0.45 + (s.officer.stats['정치'] ?? 0) / 150 - size * 0.06));
export const talkCost = (s: GameState) => Math.max(40, Math.round(budgetPerDay(s, s.player.countryId) * TALK_COST));

export type SecHow = 'sweep' | 'talk';
export function canAct(s: GameState, id: number, how: SecHow): string | null {
  const c = secOf(s).list.find((x) => x.id === id);
  if (!c) return '이미 끝난 일이에요';
  if (how === 'talk' && s.nations[s.player.countryId].treasury < talkCost(s)) return '나라 예산이 모자라요';
  return null;
}
const addLoyalty = (s: GameState, city: string, v: number): GameState => {
  const civ = structuredClone(civOf(s));
  const cc = (civ.cities[city] ??= structuredClone(cityCiv(s, city)));
  cc.loyalty = Math.max(0, Math.min(100, cc.loyalty + v));
  return { ...s, civ };
};
export function act(s: GameState, id: number, how: SecHow): { state: GameState; ok: boolean; text: string } {
  if (canAct(s, id, how)) return { state: s, ok: false, text: '' };
  const me = s.player.countryId;
  const sc = structuredClone(secOf(s));
  const c = sc.list.find((x) => x.id === id)!;
  const rng = new Rng(sc.seed);
  const ok = rng.chance(how === 'sweep' ? sweepChance(s, c.size) : talkChance(s, c.size));
  sc.seed = rng.seed;
  const name = cityById(c.city).name;
  let ns: GameState = s;
  if (how === 'talk') ns = { ...ns, nations: { ...ns.nations, [me]: { ...ns.nations[me], treasury: ns.nations[me].treasury - talkCost(s) } } };
  if (!ok) {
    c.tried = true;
    if (how === 'sweep') ns = { ...ns, nations: { ...ns.nations, [me]: { ...ns.nations[me], troops: ns.nations[me].troops * 0.99 } } };
    return { state: { ...ns, sec: sc }, ok, text: how === 'sweep' ? `💨 ${name} 저항 조직이 골목으로 숨었어요. 병력 −1%` : `🙅 ${name} 저항 조직이 손을 뿌리쳤어요.` };
  }
  sc.list = sc.list.filter((x) => x.id !== id);
  sc.cleared++;
  ns = { ...ns, sec: sc };
  let text: string;
  if (how === 'sweep') {
    ns = addLoyalty(ns, c.city, -SWEEP_LOYALTY);
    ns = { ...ns, officer: { ...ns.officer, fame: ns.officer.fame + SWEEP_FAME } };
    text = `🪖 ${name} 저항 조직을 소탕했어요. 명성 +${SWEEP_FAME} · 민심 −${SWEEP_LOYALTY}(거친 진압)`;
  } else {
    ns = addLoyalty(ns, c.city, TALK_LOYALTY);
    text = `🤝 ${name} 저항 조직이 무기를 내려놓았어요. 민심 +${TALK_LOYALTY}`;
  }
  return { state: pushReport(ns, { icon: how === 'sweep' ? '🪖' : '🤝', text }), ok, text };
}

function sabotage(s: GameState, c: Cell): GameState {
  const me = s.player.countryId;
  if (s.world.owner[c.city] !== me) return s;
  let ns = addLoyalty(s, c.city, -SAB_LOYALTY * c.size);
  const cost = Math.round(budgetPerDay(s, me) * SAB_COST * c.size);
  ns = {
    ...ns,
    world: { ...ns.world, defense: { ...ns.world.defense, [c.city]: Math.max(0, (ns.world.defense[c.city] ?? 0) - SAB_DEFENSE * c.size) } },
    nations: { ...ns.nations, [me]: { ...ns.nations[me], treasury: Math.max(0, ns.nations[me].treasury - cost) } },
  };
  return pushReport(ns, { icon: '💣', text: `${cityById(c.city).name}에서 저항 조직이 파괴 공작을 벌였습니다. 민심 −${SAB_LOYALTY * c.size} · 방어도 −${SAB_DEFENSE * c.size} · 복구비 ${cost.toLocaleString('ko-KR')}` });
}

/** 세계 판단마다 */
export function secTick(s: GameState): GameState {
  if (s.ending) return s;
  const sc0 = secOf(s);
  const due = sc0.list.filter((c) => c.dueMs <= s.worldMs);
  if (!due.length && s.worldMs < sc0.nextMs) return s.sec ? s : { ...s, sec: sc0 };
  const sc = structuredClone(sc0);
  const rng = new Rng(sc.seed);
  let ns = s;
  for (const c of due) {
    ns = sabotage(ns, c);
    sc.hit++;
  }
  sc.list = sc.list.filter((c) => c.dueMs > s.worldMs);
  if (s.worldMs >= sc.nextMs) {
    sc.nextMs = s.worldMs + rng.range(SEC_GAP_MS[0], SEC_GAP_MS[1]);
    const occ = occupiedCities(s).filter((id) => !sc.list.some((c) => c.city === id));
    if (occ.length && sc.list.length < SEC_MAX) {
      // 민심이 낮은 도시일수록 잘 생김
      const sorted = [...occ].sort((a, b) => cityCiv(s, a).loyalty - cityCiv(s, b).loyalty);
      const city = sorted[Math.floor(rng.next() * Math.min(3, sorted.length))];
      const size = cityCiv(s, city).loyalty < 35 ? 3 : cityCiv(s, city).loyalty < 55 ? 2 : 1;
      sc.list.push({ id: sc.nextId++, city, size, dueMs: s.worldMs + SEC_DUE_MS });
      ns = pushReport(ns, { icon: '🕵️', text: `${cityById(city).name}에 저항 조직이 생겼습니다(${['작은', '중간', '큰'][size - 1]} 조직). 6시간 안에 본부에서 소탕하거나 회유하십시오.` });
    }
  }
  sc.seed = rng.seed;
  return { ...ns, sec: sc };
}
