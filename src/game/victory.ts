// 승리 조건과 명예의 전당. 총사령관이 된 뒤 아래 둘 중 하나를 이루면 판이 끝남(기획서 제안).
//  ① 연합 승리: 내 나라 + 연합국이 세계 도시 76% 이상
//  ② 정복 승리: 내 나라 혼자 세계 도시 48% 이상
//  둘 중 하나를 HOLD_DAYS일 동안 계속 지켜야 이김(총사령관이 된 날 바로 끝나지 않게)
import { CITIES } from '../data/cities';
import { countryById } from '../data/world';
import { RANKS } from '../data/ranks';
import type { GameState } from './state';
import { relationOf } from './world';

export const VICTORY_RANK = RANKS.length - 1;
export const ALLIED_SHARE = 0.76;
export const ALONE_SHARE = 0.48;
export const HOLD_DAYS = 7;
const HOLD_MS = HOLD_DAYS * 24 * 3600e3;

export interface Ending {
  kind: '연합 승리' | '정복 승리';
  /** 전쟁 며칠째에 이겼는지 */
  day: number;
  country: string;
  name: string;
  cities: number;
  captured: string[];
  generals: string[];
}

/** 승리 조건을 지킨 시간(ms). 조건을 못 채우면 null */
export const holdLeft = (s: GameState) => (s.officer.winSinceMs == null ? null : Math.max(0, s.officer.winSinceMs + HOLD_MS - s.worldMs));

export function victoryProgress(s: GameState) {
  const me = s.player.countryId;
  const owner = s.world.owner;
  const mine = CITIES.filter((c) => owner[c.id] === me);
  const allied = CITIES.filter((c) => owner[c.id] === me || relationOf(s.world, me, owner[c.id]) === '연합').length;
  return {
    mine: mine.length,
    allied,
    total: CITIES.length,
    needAllied: Math.ceil(CITIES.length * ALLIED_SHARE),
    needAlone: Math.ceil(CITIES.length * ALONE_SHARE),
    captured: mine.filter((c) => c.home !== me).map((c) => c.name),
  };
}

/** 이겼으면 ending을 채운 새 상태, 아니면 그대로 */
export function checkVictory(s: GameState): GameState {
  if (s.ending || s.player.rankIndex < VICTORY_RANK) return s;
  const p = victoryProgress(s);
  const kind = p.mine >= p.needAlone ? '정복 승리' : p.allied >= p.needAllied ? '연합 승리' : null;
  const since = s.officer.winSinceMs ?? null;
  if (!kind) return since === null ? s : { ...s, officer: { ...s.officer, winSinceMs: null } };
  if (since === null) {
    const ev = { t: s.worldMs, kind: '점령' as const, text: `🏁 승리 조건 달성! ${HOLD_DAYS}일 동안 지키면 전쟁이 끝나요.`, mine: true };
    return { ...s, officer: { ...s.officer, winSinceMs: s.worldMs }, world: { ...s.world, events: [ev, ...s.world.events] } };
  }
  if (s.worldMs - since < HOLD_MS) return s;
  const ending: Ending = {
    kind,
    day: Math.floor(s.worldMs / 3600e3) + 1,
    country: countryById(s.player.countryId).name,
    name: s.player.name,
    cities: p.mine,
    captured: p.captured,
    generals: s.officer.generals.map((g) => g.name),
  };
  const ev = { t: s.worldMs, kind: '점령' as const, text: `🏆 ${kind}! ${ending.country}이(가) 전쟁을 끝냈어요.`, mine: true };
  return { ...s, ending, world: { ...s.world, events: [ev, ...s.world.events] } };
}

// ── 명예의 전당(판이 바뀌어도 남음) ──
const HALL_KEY = 'modern-war-hall';
export interface HallEntry extends Ending {
  at: number;
}
export function loadHall(): HallEntry[] {
  try {
    const t = localStorage.getItem(HALL_KEY);
    return t ? (JSON.parse(t) as HallEntry[]) : [];
  } catch {
    return [];
  }
}
export function recordHall(e: Ending, at: number) {
  try {
    const list = [{ ...e, at }, ...loadHall()].slice(0, 50);
    localStorage.setItem(HALL_KEY, JSON.stringify(list));
  } catch {
    /* 무시 */
  }
}
