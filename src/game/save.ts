// 저장/불러오기. 브라우저 안(localStorage)에 저장하고, 백업용 "저장 코드"로 내보내고 들여올 수 있다.
// 나중에 서버 저장으로 바꿀 때는 이 파일만 고치면 된다.

import { COUNTRIES } from '../data/world';
import { RANKS } from '../data/ranks';
import { SAVE_VERSION, type GameState } from './state';

export const SAVE_KEY = 'modern-war-save';

export interface Storage {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem(k: string): void;
}

function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** 저장 내용이 올바른지 확인하고, 틀리면 null */
export function parseSave(text: string): GameState | null {
  try {
    const s = JSON.parse(text) as GameState;
    if (!s || s.version !== SAVE_VERSION) return null;
    if (typeof s.worldMs !== 'number' || typeof s.lastRealTime !== 'number') return null;
    const p = s.player;
    if (!p || typeof p.name !== 'string' || !COUNTRIES.some((c) => c.id === p.countryId)) return null;
    if (!(p.rankIndex >= 0 && p.rankIndex < RANKS.length)) return null;
    if (typeof p.salary !== 'number' || typeof p.pendingSalary !== 'number') return null;
    for (const c of COUNTRIES) {
      const n = s.nations?.[c.id];
      if (!n || typeof n.treasury !== 'number' || typeof n.troops !== 'number') return null;
    }
    if (typeof s.debugSkippedMs !== 'number') s.debugSkippedMs = 0;
    return s;
  } catch {
    return null;
  }
}

export function saveGame(s: GameState, st: Storage | null = storage()): boolean {
  if (!st) return false;
  try {
    st.setItem(SAVE_KEY, JSON.stringify(s));
    return true;
  } catch {
    return false;
  }
}

export function loadGame(st: Storage | null = storage()): GameState | null {
  if (!st) return null;
  try {
    const t = st.getItem(SAVE_KEY);
    return t ? parseSave(t) : null;
  } catch {
    return null;
  }
}

export function deleteSave(st: Storage | null = storage()): void {
  try {
    st?.removeItem(SAVE_KEY);
  } catch {
    /* 무시 */
  }
}

/** 백업용 저장 코드(글자 한 줄) */
export function exportCode(s: GameState): string {
  const bytes = new TextEncoder().encode(JSON.stringify(s));
  let bin = '';
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin);
}

export function importCode(code: string): GameState | null {
  try {
    const bin = atob(code.trim());
    const bytes = Uint8Array.from(bin, (ch) => ch.charCodeAt(0));
    return parseSave(new TextDecoder().decode(bytes));
  } catch {
    return null;
  }
}
