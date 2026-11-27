// 11-28 국정 37 강화(외교부): 대사관. 나라를 골라 대사를 보내면 그 나라 호감이 날마다 조금씩 오름(최대 +12).
// 칸 수는 호칭 따라 2·3·4. 호감 계산은 civ.ts favorReasons가 s.embassy를 읽음.
import { isAlive, relationOf } from './world';
import type { GameState } from './state';
import { addFavorNote } from './civ';
import { pairKey } from './world';

export const EMBASSY_COST = 1500;
export const EMBASSY_START = 4;
export const EMBASSY_PER_DAY = 2;
export const EMBASSY_MAX_FAVOR = 12;
const DAY = 24 * 3600e3;

export interface EmbassyState {
  /** 나라 → 연 시각 */
  open: Record<string, number>;
  /** 특사가 다시 갈 수 있는 시각 */
  envoyMs?: number;
}
export const embassyOf = (s: GameState): EmbassyState => s.embassy ?? { open: {} };
export const embassySlots = (s: GameState) => 2 + (s.player.rankIndex >= 4 ? 1 : 0) + (s.player.rankIndex >= 8 ? 1 : 0);
/** 대사관 호감(0이면 없음) */
export function embassyFavor(s: GameState, id: string): number {
  const t = s.embassy?.open[id];
  if (t == null) return 0;
  return Math.min(EMBASSY_MAX_FAVOR, Math.round(EMBASSY_START + ((s.worldMs - t) / DAY) * EMBASSY_PER_DAY));
}
export function canOpenEmbassy(s: GameState, id: string): string | null {
  const me = s.player.countryId;
  const e = embassyOf(s);
  if (id === me || !isAlive(s.world, id)) return '고를 수 없는 나라';
  if (e.open[id] != null) return '이미 대사가 있어요';
  if (relationOf(s.world, me, id) === '전쟁') return '전쟁 중인 나라에는 대사를 못 보내요';
  if (Object.keys(e.open).length >= embassySlots(s)) return `대사는 ${embassySlots(s)}곳까지(호칭이 오르면 늘어요)`;
  if ((s.nations[me]?.treasury ?? 0) < EMBASSY_COST) return `나라 예산 ${EMBASSY_COST.toLocaleString('ko-KR')} 필요`;
  return null;
}
export function openEmbassy(s: GameState, id: string): GameState {
  if (canOpenEmbassy(s, id)) return s;
  const me = s.player.countryId;
  const e = embassyOf(s);
  return { ...s, embassy: { ...e, open: { ...e.open, [id]: s.worldMs } }, nations: { ...s.nations, [me]: { ...s.nations[me], treasury: s.nations[me].treasury - EMBASSY_COST } } };
}
export function closeEmbassy(s: GameState, id: string): GameState {
  const e = embassyOf(s);
  if (e.open[id] == null) return s;
  const open = { ...e.open };
  delete open[id];
  return { ...s, embassy: { ...e, open } };
}
/** 전쟁이 나거나 나라가 무너지면 대사관을 닫음(판단마다) */
export function embassyTick(s: GameState): GameState {
  const e = s.embassy;
  if (!e) return s;
  const me = s.player.countryId;
  const bad = Object.keys(e.open).filter((id) => !isAlive(s.world, id) || relationOf(s.world, me, id) === '전쟁');
  if (!bad.length) return s;
  let ns = s;
  for (const id of bad) ns = closeEmbassy(ns, id);
  return ns;
}

// ── 11-28 특사: 빠른 1:1 임무(긴장 −15, 호감 +3). 실제 2시간마다 한 번 ──
export const ENVOY2_COST = 2000;
export const ENVOY2_WAIT = 2 * 3600e3;
export const ENVOY2_TENSION = 15;
export function canSendEnvoy(s: GameState, id: string): string | null {
  const me = s.player.countryId;
  if (id === me || !isAlive(s.world, id)) return '고를 수 없는 나라';
  if (relationOf(s.world, me, id) === '전쟁') return '전쟁 중에는 특사를 받지 않아요';
  if (s.worldMs < (s.embassy?.envoyMs ?? 0)) return `특사가 돌아오는 중(${Math.ceil(((s.embassy?.envoyMs ?? 0) - s.worldMs) / 60e3)}분)`;
  if ((s.nations[me]?.treasury ?? 0) < ENVOY2_COST) return `나라 예산 ${ENVOY2_COST.toLocaleString('ko-KR')} 필요`;
  return null;
}
export function sendEnvoy2(s: GameState, id: string): GameState {
  if (canSendEnvoy(s, id)) return s;
  const me = s.player.countryId;
  const k = pairKey(me, id);
  const p = s.world.pairs[k];
  let ns: GameState = {
    ...s,
    embassy: { ...embassyOf(s), envoyMs: s.worldMs + ENVOY2_WAIT },
    nations: { ...s.nations, [me]: { ...s.nations[me], treasury: s.nations[me].treasury - ENVOY2_COST } },
    world: p ? { ...s.world, pairs: { ...s.world.pairs, [k]: { ...p, tension: Math.max(0, p.tension - ENVOY2_TENSION) } } } : s.world,
  };
  ns = addFavorNote(ns, id, '특사 방문', 3);
  return ns;
}
