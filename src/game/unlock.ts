// 11-27 종합 확장안 개편 8: 첫 판은 대한민국으로 시작, 이기면 나라가 열림 + 유산(다음 판 시작 보너스).
// 따로 저장하지 않고 명예의 전당(이긴 기록)에서 셈. 시험용 '모든 나라 열기' 스위치는 이 기기에만 저장.
import { COUNTRIES } from '../data/world';
import { nearestOf } from './acts';
import { goalsOf } from './goals';
import type { GameState } from './state';

export const FIRST_NATION = 'kr';
/** 한 번 이길 때마다 열리는 나라 수(이긴 나라에서 가까운 순서) */
export const UNLOCK_PER_WIN = 5;
/** 유산: 이긴 횟수마다 다음 판 시작 때 받는 것(최대 5번까지 쌓임) */
export const LEGACY_RUBY = 60;
export const LEGACY_BOOSTS = 3;
export const LEGACY_MAX = 5;

/** 지금 고를 수 있는 나라. hall은 최근 것이 앞(loadHall 그대로) */
export function unlockedNations(hall: Array<{ country: string }>, all = false): string[] {
  if (all) return COUNTRIES.map((c) => c.id);
  const open = new Set<string>([FIRST_NATION]);
  for (const e of [...hall].reverse()) {
    const id = COUNTRIES.find((c) => c.name === e.country)?.id;
    if (!id) continue;
    open.add(id);
    let n = 0;
    for (const x of nearestOf(id)) {
      if (n >= UNLOCK_PER_WIN) break;
      if (!open.has(x)) { open.add(x); n++; }
    }
  }
  return COUNTRIES.map((c) => c.id).filter((id) => open.has(id));
}

export function legacyOf(hall: unknown[]): { wins: number; ruby: number; boosts: number } {
  const wins = Math.min(LEGACY_MAX, hall.length);
  return { wins, ruby: wins * LEGACY_RUBY, boosts: wins * LEGACY_BOOSTS };
}

const ALL_KEY = 'modern-war-unlock-all';
export function unlockAllOn(): boolean {
  try { return localStorage.getItem(ALL_KEY) === '1'; } catch { return false; }
}
export function setUnlockAll(on: boolean) {
  try { if (on) localStorage.setItem(ALL_KEY, '1'); else localStorage.removeItem(ALL_KEY); } catch { /* 무시 */ }
}

/** 새 판에 유산 보너스를 얹음 */
export function applyLegacy(s: GameState, hall: unknown[]): GameState {
  const l = legacyOf(hall);
  if (!l.wins) return s;
  const g = goalsOf(s);
  return { ...s, goals: { ...g, ruby: g.ruby + l.ruby }, officer: { ...s.officer, boosts: (s.officer.boosts ?? 0) + l.boosts } };
}
