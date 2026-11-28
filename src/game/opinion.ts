// 11-28 7단계 추가 5 "여론전·정보전"(사다리 3단계 그림자 전쟁의 한 갈래): 가짜 뉴스·선거 개입·해킹 폭로로 상대 나라 여론을 흔듦.
//  · 상대 여론(−50~+50)이 −20 밑이면 그 나라는 우리에게 총동원을 걸지 못함(전쟁 관문이 막힘), 전쟁 중이면 전쟁 피로 +
//  · 해킹 폭로는 48시간 동안 그 나라 나라 예산 −5%
//  · 나라마다 8시간에 한 번, 25% 확률로 들킴(호감 −8 · 긴장 +8). 여론은 하루 5씩 제자리로
//  · 우리와 긴장이 높은 AI도 우리에게 여론전을 함(지지도 −3)
import { COUNTRIES, countryById } from '../data/world';
import { addPresMod } from './approval';
import { addFavorNote } from './civ';
import { pushReport } from './report';
import { Rng } from './rng';
import { priceBase, type GameState } from './state';
import { isAlive, pairKey, relationOf } from './world';

const H = 3600e3;
export const OP_WAIT = 8 * H;
export const OP_CAUGHT = 0.25;
export const MOOD_BLOCK = -20;
export type OpId = 'fake' | 'meddle' | 'leak';
export const OPS: Record<OpId, { icon: string; name: string; text: string; mood: number; cost: number }> = {
  fake: { icon: '📰', name: '가짜 뉴스', text: '여론 −10', mood: -10, cost: 0.3 },
  meddle: { icon: '🗳️', name: '선거 개입', text: '여론 −20(들키면 더 크게 미움)', mood: -20, cost: 0.6 },
  leak: { icon: '💻', name: '해킹 폭로', text: '여론 −15 · 48시간 그 나라 예산 −5%', mood: -15, cost: 0.5 },
};
export interface OpinionState { mood: Record<string, number>; ready: Record<string, number>; leak: Record<string, number>; lastMs: number; seed: number }
export const opinionOf = (s: GameState): OpinionState => s.opinion ?? { mood: {}, ready: {}, leak: {}, lastMs: s.worldMs, seed: (s.world.seed ^ 0x6c8e9cf5) >>> 0 };
export const moodOf = (s: GameState, id: string) => s.opinion?.mood[id] ?? 0;
export const opCost = (s: GameState, op: OpId) => Math.max(60, Math.round(priceBase(s) * OPS[op].cost));
/** 나라 예산 배율(해킹 폭로) */
export const opinionMult = (s: GameState, id: string) => ((s.opinion?.leak[id] ?? 0) > s.worldMs ? 0.95 : 1);

export function canOp(s: GameState, foe: string, op: OpId): string | null {
  const me = s.player.countryId;
  if (foe === me || !isAlive(s.world, foe)) return '할 수 없는 나라예요';
  if (relationOf(s.world, me, foe) === '연합') return '연합국에는 하지 않아요';
  if ((opinionOf(s).ready[foe] ?? 0) > s.worldMs) return '이 나라는 8시간에 한 번이에요';
  if (s.nations[me].treasury < opCost(s, op)) return '나라 예산이 모자라요';
  return null;
}
export function runOp(s: GameState, foe: string, op: OpId): { state: GameState; text: string } {
  const why = canOp(s, foe, op);
  if (why) return { state: s, text: why };
  const me = s.player.countryId;
  const o = opinionOf(s);
  const rng = new Rng(o.seed);
  const d = OPS[op];
  const mood = Math.max(-50, moodOf(s, foe) + d.mood);
  let ns: GameState = {
    ...s,
    opinion: { ...o, mood: { ...o.mood, [foe]: mood }, ready: { ...o.ready, [foe]: s.worldMs + OP_WAIT }, leak: op === 'leak' ? { ...o.leak, [foe]: s.worldMs + 48 * H } : o.leak, seed: rng.seed },
    nations: { ...s.nations, [me]: { ...s.nations[me], treasury: s.nations[me].treasury - opCost(s, op) } },
  };
  const k = pairKey(me, foe);
  const p = ns.world.pairs[k];
  if (p?.rel === '전쟁') ns = { ...ns, world: { ...ns.world, pairs: { ...ns.world.pairs, [k]: { ...p, weariness: p.weariness + 2 } } } };
  let text = `${d.icon} ${countryById(foe).name}에 ${d.name}: 여론 ${mood}${mood <= MOOD_BLOCK ? ' · 우리에게 총동원을 걸 수 없어요' : ''}`;
  if (rng.chance(OP_CAUGHT)) {
    const hurt = op === 'meddle' ? -14 : -8;
    ns = addFavorNote(ns, foe, `${d.icon} ${d.name}이 들킴`, hurt);
    const pr = ns.world.pairs[k];
    if (pr && pr.rel !== '전쟁') ns = { ...ns, world: { ...ns.world, pairs: { ...ns.world.pairs, [k]: { ...pr, tension: Math.min(95, pr.tension + 8) } } } };
    text += ` · ⚠️ 들켰어요(호감 ${hurt} · 긴장 +8)`;
  }
  return { state: { ...ns, opinion: { ...ns.opinion!, seed: rng.seed } }, text };
}

/** 세계 판단마다: 여론이 제자리로 · AI의 여론전 */
export function opinionTick(s: GameState): GameState {
  if (s.ending) return s;
  const o = opinionOf(s);
  const h = (s.worldMs - o.lastMs) / H;
  if (h < 1) return s.opinion ? s : { ...s, opinion: o };
  const me = s.player.countryId;
  const rng = new Rng(o.seed);
  const mood: Record<string, number> = {};
  for (const [id, v] of Object.entries(o.mood)) {
    const nv = v > 0 ? Math.max(0, v - (5 * h) / 24) : Math.min(0, v + (5 * h) / 24);
    if (nv) mood[id] = nv;
  }
  let ns: GameState = { ...s, opinion: { ...o, mood, lastMs: s.worldMs } };
  for (const c of COUNTRIES) {
    if (c.id === me || !isAlive(s.world, c.id)) continue;
    const t = s.world.pairs[pairKey(me, c.id)]?.tension ?? 0;
    const war = relationOf(s.world, me, c.id) === '전쟁';
    if ((t < 60 && !war) || !rng.chance(0.004 * h)) continue;
    ns = addPresMod(ns, `📰 ${c.name} 여론전`, -3, 24);
    ns = pushReport(ns, { icon: '📰', text: `대장님, ${c.name}이(가) 우리 나라에 가짜 뉴스를 퍼뜨렸습니다. 지지도 −3(하루). 외교 → 🌐 진영에서 맞받아칠 수 있습니다.` });
    break;
  }
  return { ...ns, opinion: { ...ns.opinion!, seed: rng.seed } };
}
