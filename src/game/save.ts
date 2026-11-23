// 저장/불러오기. 브라우저 안(localStorage)에 저장하고, 백업용 "저장 코드"로 내보내고 들여올 수 있다.
// 나중에 서버 저장으로 바꿀 때는 이 파일만 고치면 된다.

import { COUNTRIES } from '../data/world';
import { RANKS } from '../data/ranks';
import { CITIES } from '../data/cities';
import { AI_TICK_MS } from './balance';
import { firstTestGrant } from './testgrant';
import { TEST_BOOSTS } from './boost';
import { SAVE_VERSION, type GameState } from './state';
import { newBuildings, newEconomy } from './economy';
import { RESOURCES } from '../data/economy';
import { newWorld } from './world';
import { newOfficer } from './officer';
import { newCiv } from './civ';
import { START_STAT, STAT_IDS, statExpNeed } from '../data/officers';

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
    if (!s || typeof s !== 'object') return null;
    // 1단계 저장(세계 정보 없음) → 시작 구도로 세계를 새로 만들어 이어감
    if (s.version === 1 && typeof s.worldMs === 'number') {
      s.world = newWorld((s.lastRealTime ^ 0x5eed) >>> 0, false, s.worldMs + AI_TICK_MS);
      s.version = 2;
    }
    // 2단계 저장(장교 정보 없음) → 소위 장교를 새로 만들고 계급은 그대로
    if (s.version === 2) {
      s.officer = newOfficer((s.lastRealTime * 7 + 13) >>> 0);
      s.version = 3;
    }
    // 4단계까지 저장(훈련 미니게임·내정 없음) → 새 칸을 채움
    if (s.version === 3) {
      const o = s.officer as Partial<GameState['officer']>;
      if (o) {
        o.training = null;
        o.grandReadyMs = 0;
        o.perfect = {};
      }
      s.economy = newEconomy();
      s.version = SAVE_VERSION;
    }
    if (s.version !== SAVE_VERSION) return null;
    const o = s.officer;
    if (!o || typeof o.seed !== 'number' || !o.stats || !Array.isArray(o.aides) || !Array.isArray(o.rivals)) return null;
    if (o.boardMs === null) o.boardMs = -Infinity; // JSON에서 -Infinity는 null이 됨
    const w = s.world;
    if (!w || typeof w.seed !== 'number' || typeof w.nextTickMs !== 'number' || !Array.isArray(w.events)) return null;
    if (!w.pairs || !w.personalities || !w.owner || !w.defense) return null;
    if (CITIES.some((c) => typeof w.owner[c.id] !== 'string' || typeof w.defense[c.id] !== 'number')) return null;
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
    const e = s.economy;
    if (!e || !e.facilities || !e.stock || !Array.isArray(e.queue)) return null;
    // 내정 시설 9개(옛 저장): 분야 단계를 그대로 물려받음
    if (!e.buildings) e.buildings = newBuildings(e.facilities);
    // 자원 3안(11-23): 새 자원 8종은 0부터
    for (const r of RESOURCES) if (typeof e.stock[r] !== 'number') e.stock[r] = 0;
    if (typeof o.grandReadyMs !== 'number') o.grandReadyMs = 0;
    if (!o.perfect) o.perfect = {};
    if (o.training === undefined) o.training = null;
    if (s.ending === undefined) s.ending = null;
    // 스탯 경험치 방식(옛 저장): 소수점은 경험치로 바꿈
    if (!o.statExp) {
      o.statExp = {};
      for (const id of STAT_IDS) {
        const v = Number(o.stats[id]) || START_STAT;
        o.stats[id] = Math.floor(v);
        o.statExp[id] = Math.round((v - Math.floor(v)) * statExpNeed(Math.floor(v)));
      }
    }
    // 문명식 운영(연구·체제·외교·도시)이 없는 옛 저장: 새로 채움
    if (!s.civ || !Array.isArray(s.civ.done) || !s.civ.council) s.civ = newCiv(s);
    if (s.civ.lastSwapMs === null) s.civ.lastSwapMs = -Infinity;
    if (typeof o.boosts !== 'number') o.boosts = TEST_BOOSTS; // 시험판: 옛 저장에도 가속권 지급
    return firstTestGrant(s); // 시험판: 옛 저장에도 자원 넉넉히(한 번만)
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
