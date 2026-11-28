// 11-28 7단계 추가 1 "해상 교통로와 해협": 호르무즈·수에즈·대만 해협·보스포루스를 쥔 나라는 교역 몫(자원 +4%)을 받고,
// 해협을 48시간 막으면 세계가 흔들림(막은 나라 나라 예산 +4%, 다른 나라 −3%, 호르무즈는 세계 자원 −5%). 해협마다 5일에 한 번.
// 막으면 세계 여러 나라가 싫어함(호감 −4). AI가 해협을 쥐고 우리와 싸우면 우리를 막기도 함.
import { FRONT } from '../data/cities';
import { COUNTRIES, countryById } from '../data/world';
import { addFavorNote } from './civ';
import { registerDomRows } from './domestic';
import { pushReport } from './report';
import { Rng } from './rng';
import type { GameState } from './state';
import { isAlive, relationOf } from './world';

const H = 3600e3;
export const BLOCK_MS = 48 * H;
export const BLOCK_WAIT = 5 * 24 * H;
export const STRAIT_RES = 0.04;
export const STRAITS = [
  { id: 'hormuz', icon: '🛢️', name: '호르무즈 해협', city: '반다르아바스', text: '세계 기름의 다섯에 하나가 지나는 길' },
  { id: 'suez', icon: '🚢', name: '수에즈 운하', city: '수에즈', text: '유럽과 아시아를 잇는 지름길' },
  { id: 'taiwan', icon: '⚓', name: '대만 해협', city: '가오슝', text: '반도체와 동아시아 무역의 길목' },
  { id: 'bosporus', icon: '🌉', name: '보스포루스 해협', city: '이스탄불', text: '흑해에서 지중해로 나가는 유일한 문' },
] as const;
export type StraitId = (typeof STRAITS)[number]['id'];
export const straitCity = (id: StraitId) => FRONT.find((c) => c.name === STRAITS.find((x) => x.id === id)!.city)?.id ?? '';
export const straitOwner = (s: GameState, id: StraitId) => s.world.owner[straitCity(id)] ?? '';

export interface StraitState { blocks: Partial<Record<StraitId, { by: string; untilMs: number }>>; ready: Partial<Record<StraitId, number>>; seed: number }
export const straitsOf = (s: GameState): StraitState => s.straits ?? { blocks: {}, ready: {}, seed: (s.world.seed ^ 0x51ed270b) >>> 0 };
export const liveBlocks = (s: GameState) => (Object.entries(straitsOf(s).blocks) as Array<[StraitId, { by: string; untilMs: number }]>).filter(([, b]) => b.untilMs > s.worldMs);

export function canBlock(s: GameState, id: StraitId): string | null {
  const me = s.player.countryId;
  if (straitOwner(s, id) !== me) return '우리가 쥔 해협이 아니에요';
  if (liveBlocks(s).some(([k]) => k === id)) return '이미 막혀 있어요';
  if ((straitsOf(s).ready[id] ?? 0) > s.worldMs) return '해협은 5일에 한 번 막을 수 있어요';
  return null;
}
export function blockStrait(s: GameState, id: StraitId): { state: GameState; text: string } {
  const why = canBlock(s, id);
  if (why) return { state: s, text: why };
  const me = s.player.countryId;
  const st = straitsOf(s);
  let ns: GameState = { ...s, straits: { ...st, blocks: { ...st.blocks, [id]: { by: me, untilMs: s.worldMs + BLOCK_MS } }, ready: { ...st.ready, [id]: s.worldMs + BLOCK_WAIT } } };
  const d = STRAITS.find((x) => x.id === id)!;
  for (const c of COUNTRIES) if (c.id !== me && isAlive(s.world, c.id) && relationOf(s.world, me, c.id) !== '전쟁') ns = addFavorNote(ns, c.id, `${d.icon} ${d.name} 봉쇄`, -4);
  const text = `${d.icon} ${d.name}을(를) 48시간 막았어요. 우리 나라 예산 +4% · 다른 나라 −3%${id === 'hormuz' ? ' · 세계 자원 −5%' : ''} · 세계 호감 −4`;
  ns = { ...ns, world: { ...ns.world, events: [{ t: s.worldMs, kind: '외교' as const, text, mine: true }, ...ns.world.events].slice(0, 200) } };
  return { state: ns, text };
}

/** 나라 예산 배율 */
export function straitMult(s: GameState, id: string): number {
  let m = 1;
  for (const [, b] of liveBlocks(s)) m *= b.by === id ? 1.04 : 0.97;
  return m;
}

/** 세계 판단마다: AI가 해협으로 우리를 압박 */
export function straitTick(s: GameState): GameState {
  if (s.ending) return s;
  const me = s.player.countryId;
  const st = straitsOf(s);
  const rng = new Rng(st.seed);
  let ns = s;
  let next = st;
  for (const d of STRAITS) {
    const own = straitOwner(s, d.id);
    if (!own || own === me || liveBlocks(s).some(([k]) => k === d.id) || (st.ready[d.id] ?? 0) > s.worldMs) continue;
    if (relationOf(s.world, own, me) !== '전쟁' || !rng.chance(0.01)) continue;
    next = { ...next, blocks: { ...next.blocks, [d.id]: { by: own, untilMs: s.worldMs + BLOCK_MS } }, ready: { ...next.ready, [d.id]: s.worldMs + BLOCK_WAIT } };
    ns = pushReport(ns, { icon: d.icon, text: `대장님, ${countryById(own).name}이(가) ${d.name}을(를) 막았습니다! 48시간 동안 세계 나라 예산 −3%${d.id === 'hormuz' ? ' · 자원 −5%' : ''}. 해협 도시 ${d.city}을(를) 차지하면 풀 수 있습니다.` });
  }
  // 해협 도시 주인이 바뀌면 그 봉쇄는 풀림
  const blocks = { ...next.blocks };
  for (const [k, b] of Object.entries(blocks) as Array<[StraitId, { by: string; untilMs: number }]>) if (b.untilMs > s.worldMs && straitOwner(s, k) !== b.by) blocks[k] = { ...b, untilMs: s.worldMs };
  next = { ...next, blocks, seed: rng.seed };
  return { ...ns, straits: next };
}

registerDomRows((s, key) => {
  if (key !== 'res') return [];
  const me = s.player.countryId;
  const rows: Array<[string, number]> = [];
  const held = STRAITS.filter((d) => straitOwner(s, d.id) === me);
  if (held.length) rows.push([`⚓ 해협 ${held.length}곳 교역 몫`, held.length * STRAIT_RES]);
  if (liveBlocks(s).some(([k, b]) => k === 'hormuz' && b.by !== me)) rows.push(['🛢️ 호르무즈 봉쇄', -0.05]);
  return rows;
});
