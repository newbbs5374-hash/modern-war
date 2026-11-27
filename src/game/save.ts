// 저장/불러오기. 브라우저 안(localStorage)에 저장하고, 백업용 "저장 코드"로 내보내고 들여올 수 있다.
// 나중에 서버 저장으로 바꿀 때는 이 파일만 고치면 된다.

import { applyNation } from './nation';
import { giveFaces, migrateBureau, migrateStats2 } from './cabinet';
import { migrateYoungAides } from './aidePick';
import { ensureRivalRoster } from './rivals';
import { COUNTRIES } from '../data/world';
import { RANKS } from '../data/ranks';
import { CITIES } from '../data/cities';
import { AI_TICK_MS } from './balance';
import { firstTestGrant } from './testgrant';
import { TEST_BOOSTS } from './boost';
import { SAVE_VERSION, type GameState } from './state';
import { newBuildings, newEconomy } from './economy';
import { BUILDING_IDS, FACILITIES, RESOURCES } from '../data/economy';
import { isRival, newWorld, pairKey, syncFollowers } from './world';
import { START_TREASURY_PER_POINT, START_TROOPS_PER_POINT, aiStrength } from './balance';
import { LEADERS } from '../data/leaders';
import { startingRelation } from '../data/world';
import { NOW_CONFLICTS } from '../data/conflicts';
import { newOfficer } from './officer';
import { fillAiGov, migrateCityTiles, newCiv } from './civ';
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
    let s = JSON.parse(text) as GameState;
    if (!s || typeof s !== 'object') return null;
    if (s.player?.countryId) applyNation(s.player.countryId);
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
    addNewNations(s); // 11-26 새 나라 5개: 옛 저장에도 넣어 줌
    // 11/24 새 도시(대한민국 10개 도시): 옛 저장엔 없으므로 그 나라 수도 주인에게(수도가 없으면 처음 나라)
    for (const c of CITIES) {
      if (typeof w.owner[c.id] !== 'string') w.owner[c.id] = w.owner[`${c.home}-0`] ?? c.home;
      if (typeof w.defense[c.id] !== 'number') w.defense[c.id] = w.defense[`${c.home}-0`] ?? 100;
    }
    if (CITIES.some((c) => typeof w.owner[c.id] !== 'string' || typeof w.defense[c.id] !== 'number')) return null;
    // 11/25 점령 도시·내정 도시: 내정 도시는 거점 도시 주인을 따라감
    syncFollowers(w);
    if (typeof s.worldMs !== 'number' || typeof s.lastRealTime !== 'number') return null;
    const p = s.player;
    if (!p || typeof p.name !== 'string' || !COUNTRIES.some((c) => c.id === p.countryId)) return null;
    if (!(p.rankIndex >= 0 && p.rankIndex < RANKS.length)) return null;
    if (typeof p.salary !== 'number' || typeof p.pendingSalary !== 'number') return null;
    for (const c of COUNTRIES) {
      const n = s.nations?.[c.id];
      if (!n || typeof n.treasury !== 'number' || typeof n.troops !== 'number') return null;
    }
    // 11-26 국방비 나누기(옛 저장): 내 금고를 예산 나누기 국방 몫만큼 국방비로 옮김
    {
      const mine = s.nations[p.countryId];
      if (typeof mine.def !== 'number') {
        const share = (s.policy?.split?.def ?? 40) / 100;
        mine.def = mine.treasury * share;
        mine.treasury -= mine.def;
      }
    }
    if (typeof s.debugSkippedMs !== 'number') s.debugSkippedMs = 0;
    const e = s.economy;
    if (!e || !e.facilities || !e.stock || !Array.isArray(e.queue)) return null;
    // 내정 시설 9개(옛 저장): 분야 단계를 그대로 물려받음
    if (!e.buildings) e.buildings = newBuildings(e.facilities);
    // 시설 15개(11-23): 새 분야(과학·국방)와 새 시설 6개는 빈 땅부터
    for (const f of FACILITIES) if (!e.facilities[f]) e.facilities[f] = { level: 1, exp: 0, buildEndMs: 0 };
    {
      const nb = newBuildings(e.facilities);
      for (const id of BUILDING_IDS) if (!e.buildings[id]) e.buildings[id] = nb[id];
    }
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
    s.civ.aiGov = fillAiGov(s.civ.aiGov ?? {}, s.world.personalities); // 11-27 새 나라 18개: 옛 저장엔 체제가 없어 호감·협정 탭이 멈췄음
    if (s.cabinet?.people) migrateStats2(s.cabinet); // 11/24 스탯 18개: 옛 인물에 새 스탯 채움
    if (s.cabinet?.people) migrateBureau(s.cabinet, s.player.countryId, s.worldMs); // 11/24 관료 56명
    if (s.cabinet?.people) giveFaces(s.cabinet); // 11/27 나이를 얼굴 나이대에 맞춤(얼굴은 그대로)
    ensureRivalRoster(s); // 11/26 정적 3명 → 12명(빠진 역할 채우고 얼굴 주기)
    migrateYoungAides(s); // 11/24 부관은 젊은 얼굴(장관 얼굴과 안 겹침)
    s = migrateCityTiles(s); // 11/24 도시 칸 4.5배·실제 모양: 옛 구역 자리 옮기기
    if (typeof o.boosts !== 'number') o.boosts = TEST_BOOSTS; // 시험판: 옛 저장에도 가속권 지급
    return firstTestGrant(s); // 시험판: 옛 저장에도 자원 넉넉히(한 번만)
  } catch {
    return null;
  }
}

/**
 * 11-26 나라 13→18개(대만·폴란드·필리핀·파키스탄·사우디): 옛 저장엔 그 나라 자리가 없으므로
 * 새 판을 시작할 때와 같은 값(지도자 성향·관계·금고·병력)으로 채워요. 도시는 아래에서 처음 주인에게 갑니다.
 */
function addNewNations(s: GameState): void {
  const w = s.world;
  if (!s.nations) return;
  const add = COUNTRIES.filter((c) => !s.nations[c.id]);
  if (!add.length) return;
  for (const c of add) {
    const k = aiStrength(c.id, s.player.countryId);
    s.nations[c.id] = { treasury: c.budget * START_TREASURY_PER_POINT * k, troops: c.military * START_TROOPS_PER_POINT * k };
    if (!w.personalities[c.id]) w.personalities[c.id] = LEADERS[c.id].personality;
  }
  for (const a of COUNTRIES)
    for (const b of COUNTRIES) {
      if (a.id >= b.id) continue;
      const key = pairKey(a.id, b.id);
      if (w.pairs[key]) continue;
      const rel = startingRelation(a.id, b.id);
      const now = s.player.realWorld ? NOW_CONFLICTS.find((x) => pairKey(x.a, x.b) === key) : undefined;
      w.pairs[key] = now
        ? { rel: now.rel, tension: now.tension, weariness: now.weariness }
        : { rel, tension: rel === '중립' ? (isRival(a.id, b.id) ? 25 : 5) : 0, weariness: 0 };
    }
  w.events.unshift({ t: s.worldMs, kind: '외교', text: `🌏 새 나라 ${add.length}개(${add.map((c) => c.name).join('·')})가 세계 무대에 나왔어요.`, mine: false });
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
