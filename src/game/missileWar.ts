// 11-27 종합 확장안 전투 6: 미사일·드론 전.
// 전쟁 중인 나라가 가끔 내 도시로 미사일·드론을 쏨. 떨어지기까지 2시간.
//  · 요격망 가동: 방공 부대와 예산으로 요격률을 올림
//  · 발사대 선제 타격: 미사일·공군 부대로 쏘기 전에 부숨(성공하면 공습이 통째로 취소, 실패하면 그대로 날아옴)
//  · 아무것도 안 하면 기본 요격률로 맞음
// 맞은 발마다 그 도시 민심 · 방어도가 깎이고 복구비가 나감.
import { FRONT, cityById } from '../data/cities';
import { MAP_DOMAIN, baseUnit } from '../data/forces';
import { COUNTRIES, countryById } from '../data/world';
import { cityCiv, civOf } from './civ';
import { pushReport } from './report';
import { Rng } from './rng';
import { priceBase, type GameState } from './state';
import { isAlive, relationOf } from './world';

const H = 3600e3;
export const RAID_GAP_MS: [number, number] = [8 * H, 14 * H];
export const RAID_FLY_MS = 2 * H;
export const RAID_BASE = 0.4;
export const RAID_NET = 0.3;
/** 요격망 값(하루 예산의 몫) */
export const RAID_NET_COST = 0.03;
export const HIT_LOYALTY = 3;
export const HIT_DEFENSE = 4;
/** 한 발마다 복구비(하루 예산의 몫) */
export const HIT_COST = 0.015;

export interface Raid { id: number; from: string; city: string; n: number; dueMs: number; net: boolean; struck: boolean }
export interface RaidState { nextMs: number; list: Raid[]; nextId: number; seed: number; shot: number; hit: number }
export const raidOf = (s: GameState): RaidState => s.raid ?? { nextMs: s.worldMs + RAID_GAP_MS[0], list: [], nextId: 1, seed: (s.world.seed ^ 0x9e3779b9) >>> 0, shot: 0, hit: 0 };

const count = (s: GameState, test: (base: string, name: string) => boolean) => Object.entries(s.economy.army ?? {}).reduce((a, [name, n]) => a + (test(baseUnit(name), name) ? n : 0), 0);
export const airDefUnits = (s: GameState) => count(s, (b, n) => /방공/.test(b) || /방공|요격|패트리|천궁|이지스/.test(n));
export const strikeUnits = (s: GameState) => count(s, (b) => b === '미사일' || MAP_DOMAIN[b] === 'air');

/** 요격률(망을 켰는지에 따라) */
export function interceptRate(s: GameState, net: boolean): number {
  return Math.min(0.95, RAID_BASE + Math.min(0.25, airDefUnits(s) * 0.03) + (net ? RAID_NET : 0));
}
export function strikeChance(s: GameState): number {
  return Math.max(0.1, Math.min(0.8, 0.25 + strikeUnits(s) * 0.04 + (s.officer.stats['포격'] ?? 0) / 200));
}
export const netCost = (s: GameState) => Math.max(30, Math.round(priceBase(s) * RAID_NET_COST));

export function canNet(s: GameState, id: number): string | null {
  const r = raidOf(s).list.find((x) => x.id === id);
  if (!r) return '이미 끝난 공습이에요';
  if (r.net) return '요격망을 이미 켰어요';
  if (s.nations[s.player.countryId].treasury < netCost(s)) return '나라 예산이 모자라요';
  return null;
}
export function raiseNet(s: GameState, id: number): GameState {
  if (canNet(s, id)) return s;
  const me = s.player.countryId;
  const rs = raidOf(s);
  return { ...s, raid: { ...rs, list: rs.list.map((x) => (x.id === id ? { ...x, net: true } : x)) }, nations: { ...s.nations, [me]: { ...s.nations[me], treasury: s.nations[me].treasury - netCost(s) } } };
}
export function canStrike(s: GameState, id: number): string | null {
  const r = raidOf(s).list.find((x) => x.id === id);
  if (!r) return '이미 끝난 공습이에요';
  if (r.struck) return '선제 타격은 한 번만 할 수 있어요';
  if (!strikeUnits(s)) return '미사일이나 공군 부대가 없어요';
  return null;
}
/** 발사대 선제 타격: 성공하면 공습 취소 */
export function strikeFirst(s: GameState, id: number): { state: GameState; ok: boolean; text: string } {
  if (canStrike(s, id)) return { state: s, ok: false, text: '' };
  const rs = structuredClone(raidOf(s));
  const r = rs.list.find((x) => x.id === id)!;
  const rng = new Rng(rs.seed);
  const ok = rng.chance(strikeChance(s));
  rs.seed = rng.seed;
  const from = countryById(r.from).name;
  if (ok) {
    rs.list = rs.list.filter((x) => x.id !== id);
    const text = `🎯 ${from} 발사대를 먼저 부쉈습니다! ${cityById(r.city).name}(으)로 오던 공습이 취소됐어요.`;
    return { state: pushReport({ ...s, raid: rs }, { icon: '🎯', text }), ok, text };
  }
  r.struck = true;
  return { state: { ...s, raid: rs }, ok, text: `💨 ${from} 발사대를 놓쳤어요. 미사일이 그대로 날아와요.` };
}

function land(s: GameState, r: Raid, rs: RaidState, rng: Rng): GameState {
  const me = s.player.countryId;
  if (s.world.owner[r.city] !== me) return s;
  const rate = interceptRate(s, r.net);
  let hit = 0;
  for (let i = 0; i < r.n; i++) if (!rng.chance(rate)) hit++;
  rs.shot += r.n - hit;
  rs.hit += hit;
  const city = cityById(r.city);
  const from = countryById(r.from).name;
  if (!hit) return pushReport(s, { icon: '🛡️', text: `${from}이(가) ${city.name}에 쏜 미사일 ${r.n}발을 모두 요격했습니다!` });
  const civ = structuredClone(civOf(s));
  const cc = (civ.cities[r.city] ??= structuredClone(cityCiv(s, r.city)));
  cc.loyalty = Math.max(0, cc.loyalty - HIT_LOYALTY * hit);
  const cost = Math.round(priceBase(s) * HIT_COST * hit);
  const world = { ...s.world, defense: { ...s.world.defense, [r.city]: Math.max(0, (s.world.defense[r.city] ?? 0) - HIT_DEFENSE * hit) } };
  const ns: GameState = { ...s, civ, world, nations: { ...s.nations, [me]: { ...s.nations[me], treasury: Math.max(0, s.nations[me].treasury - cost) } } };
  return pushReport(ns, { icon: '🚀', text: `${from} 미사일 ${r.n}발 가운데 ${hit}발이 ${city.name}에 떨어졌습니다. 민심 −${HIT_LOYALTY * hit} · 방어도 −${HIT_DEFENSE * hit} · 복구비 ${cost.toLocaleString('ko-KR')}` });
}

/** 세계 판단마다 */
export function raidTick(s: GameState): GameState {
  if (s.ending) return s;
  const rs0 = raidOf(s);
  const due = rs0.list.filter((r) => r.dueMs <= s.worldMs);
  const me = s.player.countryId;
  if (!due.length && s.worldMs < rs0.nextMs) return s.raid ? s : { ...s, raid: rs0 };
  const rs = structuredClone(rs0);
  const rng = new Rng(rs.seed);
  let ns = s;
  for (const r of due) ns = land(ns, r, rs, rng);
  rs.list = rs.list.filter((r) => r.dueMs > s.worldMs);
  if (s.worldMs >= rs.nextMs) {
    rs.nextMs = s.worldMs + rng.range(RAID_GAP_MS[0], RAID_GAP_MS[1]);
    const foes = COUNTRIES.filter((c) => c.id !== me && isAlive(s.world, c.id) && relationOf(s.world, me, c.id) === '전쟁');
    const mine = FRONT.filter((c) => s.world.owner[c.id] === me);
    if (foes.length && mine.length && rs.list.length < 2) {
      const foe = rng.pick(foes)!;
      const city = rng.pick(mine)!;
      const n = 2 + Math.floor(rng.next() * 4) + (foe.military >= 70 ? 2 : 0);
      rs.list.push({ id: rs.nextId++, from: foe.id, city: city.id, n, dueMs: s.worldMs + RAID_FLY_MS, net: false, struck: false });
      ns = pushReport(ns, { icon: '🚀', text: `경보! ${foe.name}이(가) ${city.name}(으)로 미사일·드론 ${n}발을 쏘려 합니다. 본부에서 요격망을 켜거나 발사대를 먼저 치십시오.` });
    }
  }
  rs.seed = rng.seed;
  return { ...ns, raid: rs };
}
