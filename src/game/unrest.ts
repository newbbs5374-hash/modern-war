// 11-27 승전 강화로 받은 도시의 불안(대장 요청: "그 도시는 반란이 있을 수 있고, 내정을 잘 못하거나 원 국가가 반란을 유도할 수도").
//  우리 땅(편입)이지만 '불안' 동안은 하루 반란 확률이 있음:
//   기본 2% + 민심이 60보다 낮으면 (60−민심)×0.3% + 원래 나라 선동 중이면 +8% (치안청·주둔군이 낮춤, 원래 나라가 망했으면 ×0.3)
//  민심 60 이상을 7일 지키면 안정(불안 끝). 반란이 나면 도시는 원래 나라로 돌아감.
//  원래 나라는 하루마다 선동을 걸 수 있음(이틀 동안 민심 −6 · 반란 ↑). 대장은 선동 막기·주둔군·민심 달래기로 맞섬.
import { cityById } from '../data/cities';
import { countryById } from '../data/world';
import { budgetPerDay, type GameState } from './state';
import { cityCiv, registerCityLoyaltyRows } from './civ';
import { buildingEff } from './economy';
import { pushReport } from './report';
import { Rng } from './rng';
import { noteCapture } from './territory';
import { ga, isAlive, pairKey, relationOf, syncFollowers, type UnrestCity, type WorldEvent } from './world';
import { REVIVE_TROOPS } from './balance';

const H = 3600e3;
const DAY = 24 * H;
/** 안정까지: 민심 이 값 이상을 이 날수만큼 */
export const CALM_LOYALTY = 60;
export const CALM_DAYS = 7;
/** 하루 반란 확률(%) */
export const RISK_BASE = 2;
export const RISK_PER_LOY = 0.3;
export const RISK_INCITE = 8;
/** 원래 나라가 하루에 선동을 걸 확률 · 선동 시간 · 민심 */
export const INCITE_CHANCE = 0.35;
export const INCITE_HOURS = 48;
export const INCITE_LOYALTY = -6;
/** 불안 도시 민심 */
export const UNREST_LOYALTY = -5;
/** 대장이 맞서는 방법 */
export type UnrestAct = 'guard' | 'troops' | 'soothe';
/** 값 = max(도시 값어치 × perValue, 하루 나라 예산 × days) */
export const UNREST_ACTS: Record<UnrestAct, { icon: string; name: string; desc: string; hours: number; perValue: number; days: number }> = {
  guard: { icon: '🕵️', name: '선동 막기', desc: '원래 나라 선동을 끊고 3일 동안 못 하게 해요', hours: 72, perValue: 600, days: 0.25 },
  troops: { icon: '🪖', name: '주둔군 늘리기', desc: '3일 동안 반란 확률 절반', hours: 72, perValue: 800, days: 0.35 },
  soothe: { icon: '🎁', name: '민심 달래기', desc: '3일 동안 민심 +8(지원금·잔치)', hours: 72, perValue: 1000, days: 0.5 },
};
export const SOOTHE_LOYALTY = 8;

export const unrestOf = (s: GameState, cityId: string): UnrestCity | null => s.world.unrest?.[cityById(cityId).hub] ?? null;

function setUnrest(s: GameState, cityId: string, u: UnrestCity | null): GameState {
  const unrest = { ...(s.world.unrest ?? {}) };
  if (u) unrest[cityId] = u;
  else delete unrest[cityId];
  return { ...s, world: { ...s.world, unrest } };
}

export function startUnrest(s: GameState, cityId: string, from: string): GameState {
  return setUnrest(s, cityId, { from, since: s.worldMs, calmSince: null, dayMs: s.worldMs, hourMs: s.worldMs });
}

const inciting = (s: GameState, u: UnrestCity) => (u.inciteUntil ?? 0) > s.worldMs;

/** 하루 반란 확률(%)과 까닭 */
export function unrestRisk(s: GameState, cityId: string): { pct: number; rows: Array<[string, number]> } {
  const u = unrestOf(s, cityId);
  if (!u) return { pct: 0, rows: [] };
  const loy = cityCiv(s, cityId).loyalty;
  const rows: Array<[string, number]> = [['😟 넘어온 지 얼마 안 됨', RISK_BASE]];
  if (loy < CALM_LOYALTY) rows.push([`🏚️ 내정 부실(민심 ${Math.round(loy)})`, Math.round((CALM_LOYALTY - loy) * RISK_PER_LOY * 10) / 10]);
  if (inciting(s, u)) rows.push([`📢 ${countryById(u.from).name} 선동`, RISK_INCITE]);
  let pct = rows.reduce((a, [, v]) => a + v, 0);
  const pol = Math.min(1, buildingEff(s, '치안청'));
  if (pol) {
    rows.push(['🚓 치안청', -Math.round(pct * 0.4 * pol * 10) / 10]);
    pct *= 1 - 0.4 * pol;
  }
  if ((u.troopsUntil ?? 0) > s.worldMs) {
    rows.push(['🪖 주둔군', -Math.round(pct * 5) / 10]);
    pct *= 0.5;
  }
  if (!isAlive(s.world, u.from)) {
    rows.push([`🏳️ ${countryById(u.from).name} 없음`, -Math.round(pct * 7) / 10]);
    pct *= 0.3;
  }
  return { pct: Math.round(pct * 10) / 10, rows };
}

export function unrestActCost(s: GameState, cityId: string, a: UnrestAct): number {
  const d = UNREST_ACTS[a];
  return Math.round(Math.max(cityById(cityId).value * d.perValue, budgetPerDay(s, s.player.countryId) * d.days));
}
export function canUnrestAct(s: GameState, cityId: string, a: UnrestAct): string | null {
  const u = unrestOf(s, cityId);
  if (!u || !cityById(cityId).front) return '불안한 도시가 아니에요';
  const until = a === 'guard' ? u.guardUntil : a === 'troops' ? u.troopsUntil : u.sootheUntil;
  if ((until ?? 0) > s.worldMs) return `효과 중 · ${Math.ceil(((until ?? 0) - s.worldMs) / H)}시간 남음`;
  if (a === 'guard' && !isAlive(s.world, u.from)) return '선동할 나라가 없어요';
  const cost = unrestActCost(s, cityId, a);
  if (s.nations[s.player.countryId].treasury < cost) return `나라 예산 ${cost.toLocaleString('ko-KR')} 필요`;
  return null;
}
export function doUnrestAct(s: GameState, cityId: string, a: UnrestAct): { state: GameState; text: string } {
  const why = canUnrestAct(s, cityId, a);
  if (why) return { state: s, text: why };
  const me = s.player.countryId;
  const u = unrestOf(s, cityId)!;
  const until = s.worldMs + UNREST_ACTS[a].hours * H;
  const next: UnrestCity =
    a === 'guard' ? { ...u, guardUntil: until, inciteUntil: undefined } : a === 'troops' ? { ...u, troopsUntil: until } : { ...u, soothe: SOOTHE_LOYALTY, sootheUntil: until };
  const cost = unrestActCost(s, cityId, a);
  let out = setUnrest(s, cityById(cityId).hub, next);
  out = { ...out, nations: { ...out.nations, [me]: { ...out.nations[me], treasury: out.nations[me].treasury - cost } } };
  const d = UNREST_ACTS[a];
  return { state: out, text: `${cityById(cityId).name} ${d.icon} ${d.name} · ${d.desc} (나라 예산 −${cost.toLocaleString('ko-KR')})` };
}

/** 반란: 원래 나라로 돌아감(망했으면 되살아남) */
function revolt(s: GameState, cityId: string, u: UnrestCity, why: string): GameState {
  const c = cityById(cityId);
  const me = s.player.countryId;
  const revived = !isAlive(s.world, u.from);
  const w = { ...s.world, owner: { ...s.world.owner }, defense: { ...s.world.defense }, pairs: { ...s.world.pairs } };
  noteCapture(w, cityId, u.from);
  w.owner[cityId] = u.from;
  w.defense[cityId] = 40;
  syncFollowers(w);
  const k = pairKey(me, u.from);
  if (w.pairs[k]) w.pairs[k] = { ...w.pairs[k], tension: Math.min(100, (w.pairs[k].tension ?? 0) + 25) };
  const nm = countryById(u.from).name;
  const ev: WorldEvent = { t: s.worldMs, kind: '점령', text: `🔥 ${c.name}에서 반란! (${why}) ${nm} 땅으로 돌아갔어요.${revived ? ` ${ga(nm)} 되살아났어요.` : ''}`, mine: true };
  let out: GameState = setUnrest({ ...s, world: { ...w, events: [ev, ...w.events] } }, cityId, null);
  if (revived) out = { ...out, nations: { ...out.nations, [u.from]: { ...out.nations[u.from], troops: Math.max(out.nations[u.from]?.troops ?? 0, REVIVE_TROOPS) } } };
  return pushReport(out, { icon: '🔥', text: `대장님, ${c.name}에서 반란이 일어나 ${nm} 편으로 돌아갔습니다(${why}). 다시 찾으려면 전쟁을 해야 합니다.` });
}

/** AI 판단마다: 안정 판정 · 원래 나라 선동 · 반란 판정 */
export function unrestTick(s: GameState): GameState {
  const all = s.world.unrest;
  if (!all) return s;
  const me = s.player.countryId;
  let out = s;
  for (const id of Object.keys(all)) {
    let u = out.world.unrest?.[id];
    if (!u) continue;
    // 잃었거나 우리 땅이 아니면 기록 지움
    if (out.world.owner[id] !== me || out.world.annexed?.[id] !== me) {
      out = setUnrest(out, id, null);
      continue;
    }
    const now = out.worldMs;
    const c = cityById(id);
    // 안정 판정
    const loy = cityCiv(out, id).loyalty;
    if (loy >= CALM_LOYALTY && u.calmSince == null) u = { ...u, calmSince: now };
    if (loy < CALM_LOYALTY && u.calmSince != null) u = { ...u, calmSince: null };
    if (u.calmSince != null && now >= u.calmSince + CALM_DAYS * DAY) {
      out = setUnrest(out, id, null);
      out = pushReport(out, { icon: '🕊️', text: `대장님, ${c.name} 민심이 자리를 잡았습니다. 이제 반란 걱정 없는 우리 도시입니다.` });
      continue;
    }
    // 하루마다: 원래 나라 선동
    if (now >= u.dayMs + DAY) {
      const days = Math.floor((now - u.dayMs) / DAY);
      u = { ...u, dayMs: u.dayMs + days * DAY };
      const rel = relationOf(out.world, me, u.from);
      if (isAlive(out.world, u.from) && rel !== '연합' && (u.guardUntil ?? 0) <= now && !inciting(out, u)) {
        const rng = new Rng((out.world.seed ^ Math.floor(u.dayMs / 1000) ^ (id.length * 977)) >>> 0);
        if (rng.chance(Math.min(0.9, INCITE_CHANCE * days * (rel === '전쟁' ? 1.5 : 1)))) {
          u = { ...u, inciteUntil: now + INCITE_HOURS * H };
          out = pushReport(out, { icon: '📢', text: `대장님, ${ga(countryById(u.from).name)} ${c.name}에서 반란을 부추기고 있습니다! 이틀 동안 민심이 내려가고 반란 위험이 커집니다. 도시 창에서 🕵️ 선동 막기를 할 수 있습니다.` });
        }
      }
    }
    // 시간마다: 반란 판정(밀린 시간만큼, 최대 2일)
    const hours = Math.min(48, Math.floor((now - u.hourMs) / H));
    if (hours > 0) {
      const pDay = unrestRisk(setUnrest(out, id, u), id).pct / 100;
      const pHour = 1 - Math.pow(1 - pDay, 1 / 24);
      const rng = new Rng((out.world.seed ^ Math.floor(now / 1000) ^ (id.length * 7451)) >>> 0);
      let boom = false;
      for (let i = 0; i < hours && !boom; i++) boom = rng.chance(pHour);
      u = { ...u, hourMs: u.hourMs + hours * H };
      if (boom) {
        const why = inciting(out, u) ? `${countryById(u.from).name} 선동` : loy < CALM_LOYALTY ? `민심 ${Math.round(loy)}` : '불만 폭발';
        out = revolt(out, id, u, why);
        continue;
      }
    }
    out = setUnrest(out, id, u);
  }
  return out;
}

// 민심: 불안 · 선동 · 달래기
registerCityLoyaltyRows((s, cityId) => {
  const u = unrestOf(s, cityId);
  if (!u || s.world.owner[cityId] !== s.player.countryId) return [];
  const rows: Array<[string, number]> = [['😟 강화로 넘어온 도시', UNREST_LOYALTY]];
  if (inciting(s, u)) rows.push([`📢 ${countryById(u.from).name} 선동`, INCITE_LOYALTY]);
  if (u.soothe && (u.sootheUntil ?? 0) > s.worldMs) rows.push(['🎁 민심 달래기', u.soothe]);
  return rows;
});
