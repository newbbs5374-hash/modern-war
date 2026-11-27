// 11-27 승전 강화(대장 요청): 전쟁에서 이기고 있으면 점령한 도시 가운데 몇 곳을 "골라" 우리 도시로 갖고 휴전.
//  고르지 않은 점령 도시는 원래 나라에 돌려줌(그만큼 받아들일 확률 ↑). 빼앗긴 우리 도시도 함께 돌려받을 수 있음.
//  고른 도시는 바로 우리 땅(편입)이 되지만 '불안' 상태로 시작 → 내정이 부실하거나 원래 나라가 선동하면 반란(unrest.ts).
import { FRONT, cityById } from '../data/cities';
import { COUNTRIES, countryById } from '../data/world';
import type { GameState } from './state';
import { addFavorNote } from './civ';
import { annexEntry, occupiedCities, setEntry } from './annex';
import { canDiplo, diploChance, DIPLO_COOLDOWN_HOURS } from './command';
import { pushReport } from './report';
import { Rng } from './rng';
import { noteCapture } from './territory';
import { ga, homeOf, pairKey, relationOf, syncFollowers, type WorldEvent } from './world';
import { startUnrest } from './unrest';

const H = 3600e3;
/** 이기고 있을 때 더해 주는 확률 */
export const WIN_BONUS = 0.25;
/** 고른 도시 하나마다 · 돌려받을 우리 도시 하나마다 · 수도를 고르면 빠지는 확률 */
export const KEEP_COST = 0.12;
export const BACK_COST = 0.1;
export const CAPITAL_COST = 0.15;
/** 돌려주는 점령 도시 하나마다 더해지는 확률 */
export const GIVE_BONUS = 0.06;
/** 승전 강화 반발(그 나라 호감) · 명성 */
export const PEACE_FAVOR = -15;
export const PEACE_FAME = 5;

/** 그 나라에게서 점령한 점령 도시(꼭두각시·기지·특구 같은 처분을 정한 곳은 뺌) */
export function peaceTaken(s: GameState, id: string): string[] {
  return occupiedCities(s).filter((c) => cityById(c).home === id && !annexEntry(s, c)?.mode);
}
/** 그 나라가 가진 우리 땅(돌려받을 수 있는 곳) */
export function peaceLost(s: GameState, id: string): string[] {
  const me = s.player.countryId;
  return FRONT.filter((c) => s.world.owner[c.id] === id && homeOf(s.world, c.id) === me).map((c) => c.id);
}
/** 전쟁 형세: 내가 빼앗은 도시 · 빼앗긴 도시 · 이기는 중인가 */
export function warLead(s: GameState, id: string): { took: number; lost: number; winning: boolean } {
  const me = s.player.countryId;
  const took = FRONT.filter((c) => c.home === id && s.world.owner[c.id] === me).length;
  const lost = peaceLost(s, id).length;
  return { took, lost, winning: took >= 1 && took > lost };
}

export function canVictoryPeace(s: GameState, id: string): string | null {
  if (relationOf(s.world, s.player.countryId, id) !== '전쟁') return '전쟁 중일 때만';
  const lead = warLead(s, id);
  if (!lead.winning) return `이기고 있어야 해요(빼앗은 도시 ${lead.took} · 빼앗긴 도시 ${lead.lost})`;
  if (!peaceTaken(s, id).length) return '고를 점령 도시가 없어요';
  return canDiplo(s, id, '휴전 제안');
}

/** 받아들일 확률 */
export function peaceChance(s: GameState, id: string, keep: string[], back: string[] = []): number {
  const taken = peaceTaken(s, id);
  const k = keep.filter((c) => taken.includes(c));
  const give = taken.length - k.length;
  const cap = k.some((c) => cityById(c).capital) ? CAPITAL_COST : 0;
  const v = diploChance(s, id, '휴전 제안') + WIN_BONUS + give * GIVE_BONUS - k.length * KEEP_COST - back.length * BACK_COST - cap;
  return Math.max(0.05, Math.min(0.95, v));
}

/** 승전 강화 제안: 받아들이면 휴전 · 고른 도시는 우리 땅(불안) · 나머지는 돌려줌 · 우리 도시 돌려받음 */
export function doVictoryPeace(s: GameState, id: string, keep: string[], back: string[] = []): { state: GameState; ok: boolean; text: string } {
  const why = canVictoryPeace(s, id);
  const taken = peaceTaken(s, id);
  const lostNow = peaceLost(s, id);
  const k = keep.filter((c) => taken.includes(c));
  const b = back.filter((c) => lostNow.includes(c));
  if (why) return { state: s, ok: false, text: why };
  if (!k.length) return { state: s, ok: false, text: '가질 도시를 하나 이상 골라 주세요' };
  const me = s.player.countryId;
  const nm = countryById(id).name;
  const rng = new Rng((s.world.seed ^ Math.floor(s.worldMs / 1000) ^ 0x9eace) >>> 0);
  const ok = rng.chance(peaceChance(s, id, k, b));
  const officer = { ...s.officer, diploReadyMs: s.worldMs + DIPLO_COOLDOWN_HOURS * H };
  const names = (ids: string[]) => ids.map((c) => cityById(c).name).join('·');
  if (!ok) {
    const text = `${nm}, 승전 강화(우리 도시: ${names(k)}${b.length ? ` · 돌려받기: ${names(b)}` : ''})를 거절했어요. 조건을 줄이면 받아들일 수도 있어요.`;
    const ev: WorldEvent = { t: s.worldMs, kind: '외교', text: `🎖️ ${text}`, mine: true };
    return { ok, text, state: { ...s, officer, world: { ...s.world, events: [ev, ...s.world.events] } } };
  }
  const w = { ...s.world, owner: { ...s.world.owner }, defense: { ...s.world.defense }, pairs: { ...s.world.pairs } };
  const pk = pairKey(me, id);
  w.pairs[pk] = { ...w.pairs[pk], rel: '휴전', tension: 20, weariness: 0 };
  const give = taken.filter((c) => !k.includes(c));
  for (const c of give) {
    noteCapture(w, c, id);
    w.owner[c] = id;
    w.defense[c] = Math.max(w.defense[c] ?? 0, 40);
  }
  for (const c of b) {
    noteCapture(w, c, me);
    w.owner[c] = me;
    w.defense[c] = Math.max(w.defense[c] ?? 0, 40);
  }
  let out: GameState = { ...s, officer: { ...officer, fame: officer.fame + PEACE_FAME }, world: w };
  // 고른 도시: 편입 진행 기록을 지우고 바로 우리 땅으로
  for (const c of k) out = setEntry(out, c, null);
  out = { ...out, world: { ...out.world, annexed: { ...(out.world.annexed ?? {}), ...Object.fromEntries(k.map((c) => [c, me])) } } };
  for (const c of k) out = startUnrest(out, c, id);
  const w2 = { ...out.world, owner: { ...out.world.owner }, defense: { ...out.world.defense } };
  syncFollowers(w2);
  out = { ...out, world: w2 };
  out = addFavorNote(out, id, `📜 승전 강화(${names(k)})`, PEACE_FAVOR);
  const text = `${nm}, 승전 강화에 서명했어요. 전쟁을 멈춰요. 🏙️ 우리 도시: ${names(k)}${give.length ? ` · 돌려줌: ${names(give)}` : ''}${b.length ? ` · 돌려받음: ${names(b)}` : ''}`;
  const ev: WorldEvent = { t: s.worldMs, kind: '외교', text: `📜 ${text}`, mine: true };
  out = { ...out, world: { ...out.world, events: [ev, ...out.world.events] } };
  out = pushReport(out, {
    icon: '📜',
    text: `대장님, ${ga(nm)} 승전 강화를 받아들였습니다! 오늘부터 우리 도시: ${names(k)}. 다만 아직 주민들이 불안해합니다. 민심을 60 이상으로 7일 지키면 안정되고, 그전에 내정이 부실하거나 ${ga(nm)} 선동하면 반란이 날 수 있습니다. 도시 창에서 살펴 주십시오.`,
  });
  return { ok, text, state: out };
}

/** 이기기 시작하면 한 번 알려 줌(전쟁이 끝나면 다시 알릴 수 있게 지움) */
export function peaceHintTick(s: GameState): GameState {
  const me = s.player.countryId;
  const hint = s.world.peaceHint ?? {};
  let next: Record<string, true> | null = null;
  let out = s;
  for (const o of COUNTRIES) {
    if (o.id === me) continue;
    const war = relationOf(s.world, me, o.id) === '전쟁';
    if (!war) {
      if (hint[o.id]) { next ??= { ...hint }; delete next[o.id]; }
      continue;
    }
    if (hint[o.id] || !warLead(s, o.id).winning || !peaceTaken(s, o.id).length) continue;
    next ??= { ...hint };
    next[o.id] = true;
    out = pushReport(out, { icon: '📜', text: `대장님, ${o.name} 전쟁에서 이기고 있습니다. 외교 → ${o.name}에서 📜 승전 강화로 점령한 도시 가운데 가질 곳을 골라 휴전할 수 있습니다.` });
  }
  return next ? { ...out, world: { ...out.world, peaceHint: next } } : out;
}
