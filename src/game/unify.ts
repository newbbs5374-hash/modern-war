// 11-28 대장 결정: 각 나라 수도는 함락할 수 없다(다른 도시는 차지할 수 있음).
// 대신 그 나라 도시를 점령하고 6개월(게임 180일 = 실제 180시간) 동안 반란 없이 지키면
// 그 나라 지도자에게 "통일"을 권할 수 있다. 점령 도시 민심이 높을수록·많이 쥘수록 받아들일 확률이 오른다.
// 통일이 되면 그 나라의 모든 도시(수도 포함)가 우리 땅(편입)이 되고 나라 예산·병력 일부가 합쳐진다.
import { FRONT, cityById } from '../data/cities';
import { COUNTRIES, countryById } from '../data/world';
import { aiStrength } from './balance';
import { cityCiv } from './civ';
import { setEntry } from './annex';
import { pushReport } from './report';
import { Rng } from './rng';
import type { GameState } from './state';
import { lordOf } from './surrender';
import { noteCapture } from './territory';
import { eul, homeOf, isAlive, relationOf, syncFollowers, type WorldState } from './world';

const H = 3600e3;
/** 반란 없이 지켜야 하는 시간: 게임 6개월 = 실제 180시간(7.5일) */
export const UNIFY_HOLD_H = 180;
/** 거절당하면 다시 권할 수 있을 때까지 */
export const UNIFY_RETRY_H = 72;
/** 통일 때 합쳐지는 그 나라 병력 몫 */
export const UNIFY_TROOPS = 0.5;

export interface UnifyOne {
  /** 반란·잃음 없이 지키기 시작한 시각 */
  since: number;
  /** 지금 쥔 그 나라 도시 */
  held: string[];
  /** 거절 뒤 다시 권할 수 있는 시각 */
  nextMs?: number;
  /** 거절당한 횟수 */
  tries?: number;
  /** 6개월이 찼다고 알렸는가 */
  told?: boolean;
}
export type UnifyState = Record<string, UnifyOne>;

/** 수도를 이 나라가 차지할 수 없는가(11-28: 수도는 원래 주인만 가짐) */
export function capitalLocked(w: WorldState, cityId: string, to: string): boolean {
  return cityById(cityId).capital && to !== homeOf(w, cityId);
}

const heldOf = (s: GameState, foe: string) => FRONT.filter((c) => c.home === foe && !c.capital && s.world.owner[c.id] === s.player.countryId).map((c) => c.id);
const baseCount = (foe: string) => Math.max(1, FRONT.filter((c) => c.home === foe && !c.capital).length);

/** 세계 판단마다: 쥔 도시를 하나라도 잃으면(반란·반격) 6개월을 처음부터 */
export function unifyTick(s: GameState): GameState {
  const me = s.player.countryId;
  const cur = s.unify ?? {};
  const next: UnifyState = {};
  let ns = s;
  let changed = false;
  for (const c of COUNTRIES) {
    const foe = c.id;
    if (foe === me || !isAlive(s.world, foe)) {
      if (cur[foe]) changed = true;
      continue;
    }
    const held = heldOf(s, foe);
    const prev = cur[foe];
    if (!held.length) {
      if (prev) changed = true;
      continue;
    }
    if (!prev) {
      next[foe] = { since: s.worldMs, held };
      changed = true;
      continue;
    }
    const lost = prev.held.some((id) => !held.includes(id));
    const one: UnifyOne = lost ? { ...prev, since: s.worldMs, held, told: false } : held.length !== prev.held.length ? { ...prev, held } : prev;
    if (one !== prev) changed = true;
    if (!one.told && s.worldMs - one.since >= UNIFY_HOLD_H * H) {
      next[foe] = { ...one, told: true };
      changed = true;
      ns = pushReport(ns, { icon: '🤝', text: `대장님, ${countryById(foe).name} 점령지를 6개월 동안 반란 없이 지켰습니다. 외교에서 ${countryById(foe).name} 지도자에게 통일을 권할 수 있습니다(지금 확률 ${Math.round(unifyChance(s, foe) * 100)}%).` });
      continue;
    }
    next[foe] = one;
  }
  return changed ? { ...ns, unify: next } : ns;
}

/** 통일을 받아들일 확률과 까닭 */
export function unifyRows(s: GameState, foe: string): Array<[string, number]> {
  const me = s.player.countryId;
  const held = s.unify?.[foe]?.held ?? heldOf(s, foe);
  const loy = held.length ? held.reduce((a, id) => a + cityCiv(s, id).loyalty, 0) / held.length : 0;
  const rows: Array<[string, number]> = [
    ['기본', 5],
    [`점령 도시 민심 ${Math.round(loy)}`, Math.round(Math.max(0, loy - 40) * 0.75)],
    [`쥔 도시 ${held.length}/${baseCount(foe)}곳`, Math.round((held.length / baseCount(foe)) * 30)],
  ];
  const strong = Math.round((aiStrength(foe, me) - 1) * 20);
  if (strong > 0) rows.push(['강대국 자존심', -strong]);
  if (relationOf(s.world, me, foe) === '전쟁') rows.push(['아직 전쟁 중', -10]);
  if (relationOf(s.world, me, foe) === '연합' || lordOf(s, foe) === me) rows.push([lordOf(s, foe) === me ? '우리 속국' : '연합국', 15]);
  const tries = s.unify?.[foe]?.tries ?? 0;
  if (tries) rows.push([`거절 ${tries}번`, -3 * tries]);
  return rows;
}
export function unifyChance(s: GameState, foe: string): number {
  const v = unifyRows(s, foe).reduce((a, [, n]) => a + n, 0) / 100;
  return Math.max(0.03, Math.min(0.9, v));
}

/** 남은 시간(ms). 권할 수 있으면 0 */
export function unifyWait(s: GameState, foe: string): number {
  const u = s.unify?.[foe];
  if (!u) return Infinity;
  return Math.max(0, u.since + UNIFY_HOLD_H * H - s.worldMs, (u.nextMs ?? 0) - s.worldMs);
}
export function canUnify(s: GameState, foe: string): string | null {
  if (foe === s.player.countryId) return '우리 나라예요';
  if (!isAlive(s.world, foe)) return '이미 없는 나라예요';
  const u = s.unify?.[foe];
  if (!u || !u.held.length) return `${countryById(foe).name} 도시를 먼저 점령해야 해요`;
  const left = unifyWait(s, foe);
  if (left > 0) return `${Math.ceil(left / H)}시간 더 반란 없이 지켜야 해요`;
  return null;
}

/** 통일 권유: 받아들이면 그 나라 전체가 우리 땅 */
export function proposeUnify(s: GameState, foe: string): { state: GameState; ok: boolean; text: string } {
  const why = canUnify(s, foe);
  if (why) return { state: s, ok: false, text: why };
  const me = s.player.countryId;
  const name = countryById(foe).name;
  const u = s.unify![foe];
  const rng = new Rng((s.world.seed ^ Math.floor(s.worldMs / 1000) ^ 0x0a1f7) >>> 0);
  if (!rng.chance(unifyChance(s, foe))) {
    const text = `${name} 지도자가 통일 권유를 거절했어요. ${UNIFY_RETRY_H / 24}일 뒤 다시 권할 수 있어요. 점령 도시 민심을 올리면 확률이 올라가요.`;
    const out: GameState = { ...s, unify: { ...s.unify, [foe]: { ...u, tries: (u.tries ?? 0) + 1, nextMs: s.worldMs + UNIFY_RETRY_H * H } } };
    return { state: pushReport(out, { icon: '🤝', text: `대장님, ${text}` }), ok: false, text };
  }
  const w: WorldState = { ...s.world, owner: { ...s.world.owner }, defense: { ...s.world.defense }, annexed: { ...(s.world.annexed ?? {}) }, events: [...s.world.events] };
  const cities = FRONT.filter((c) => w.owner[c.id] === foe || (c.home === foe && w.owner[c.id] === me)).map((c) => c.id);
  for (const id of cities) {
    if (w.owner[id] !== me) noteCapture(w, id, me);
    w.owner[id] = me;
    w.annexed![id] = me;
    w.defense[id] = Math.max(w.defense[id] ?? 0, 60);
  }
  syncFollowers(w);
  const text = `🇺🇳 ${name}와(과) 통일했어요! ${eul(cityById(`${foe}-0`).name)} 포함 ${cities.length}곳이 우리 땅이 됐어요.`;
  w.events.unshift({ t: s.worldMs, kind: '외교', text, mine: true });
  const mine = s.nations[me];
  const them = s.nations[foe];
  const nations = { ...s.nations, [me]: { ...mine, treasury: mine.treasury + (them?.treasury ?? 0), troops: mine.troops + Math.round((them?.troops ?? 0) * UNIFY_TROOPS) }, ...(them ? { [foe]: { ...them, treasury: 0, troops: 0 } } : {}) };
  const unify = { ...s.unify };
  delete unify[foe];
  let out: GameState = { ...s, world: w, nations, unify, officer: { ...s.officer, fame: s.officer.fame + 100 } };
  // 편입 진행·불안 기록이 있던 도시는 지움(통일로 바로 우리 땅)
  for (const id of cities) out = setEntry(out, id, null);
  if (out.world.unrest) {
    const unrest = { ...out.world.unrest };
    for (const id of cities) delete unrest[id];
    out = { ...out, world: { ...out.world, unrest } };
  }
  out = pushReport(out, { icon: '🇺🇳', text: `대장님, ${text} 나라 예산과 병력 절반이 합쳐졌습니다. 명성 +100` });
  return { state: out, ok: true, text };
}
