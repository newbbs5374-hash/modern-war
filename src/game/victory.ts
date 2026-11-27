// 승리 조건과 명예의 전당. 지도자가 된 뒤 아래 중 하나를 이루면 승리 팝업이 뜸.
//  팝업에서 '승리 선언(새 나라로)' 또는 '계속 플레이'(기록만 남기고 판을 이어 감, 11-25)를 고름.
//  ① 연합 승리: 내 나라 + 연합국이 세계 도시 76% 이상
//  ② 정복 승리: 내 나라 혼자 세계 도시 48% 이상
//  ③ 평화 승리: 세계 평화 헌장(서명 2/3)을 7일 지킴 — peace.ts
//  ④ 문화 승리: 다른 나라 2/3에서 문화 우세 + 5단계 문화 시설 2곳을 7일 지킴 — culture.ts
//  둘 중 하나를 HOLD_DAYS일 동안 계속 지켜야 이김(지도자가 된 날 바로 끝나지 않게)
import { FRONT } from '../data/cities';
import { COUNTRIES, countryById } from '../data/world';
import { lordOf } from './surrender';
import { RANKS } from '../data/ranks';
import type { GameState } from './state';
import { relationOf } from './world';
import { peaceTick } from './peace';
import { cultureWinTick } from './culture';

export const VICTORY_RANK = RANKS.length - 1;
export const ALLIED_SHARE = 0.76;
export const ALONE_SHARE = 0.48;
export const HOLD_DAYS = 7;
const HOLD_MS = HOLD_DAYS * 24 * 3600e3;

export interface Ending {
  kind: '연합 승리' | '정복 승리' | '평화 승리' | '문화 승리';
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

/** 강대국: 나를 뺀 나라 중 군사력이 가장 센 셋(11-27 정복 승리 조건) */
export const CAPITALS_NEED = 3;
export function greatPowers(me: string): string[] {
  return COUNTRIES.filter((c) => c.id !== me)
    .sort((a, b) => b.military - a.military)
    .slice(0, CAPITALS_NEED)
    .map((c) => c.id);
}

export function victoryProgress(s: GameState) {
  const me = s.player.countryId;
  const owner = s.world.owner;
  // 11-25: 점령 도시(거점)만 셈. 내정 도시는 거점을 따라감
  const mine = FRONT.filter((c) => owner[c.id] === me);
  const allied = FRONT.filter((c) => owner[c.id] === me || relationOf(s.world, me, owner[c.id]) === '연합').length;
  // 11-27: 정복 승리는 강대국 수도 3곳도 쥐어야 함(내 것이거나 내 속국 것). 장 기록이 없는 옛 저장은 조건 없음
  const caps = greatPowers(me).map((id) => {
    const o = owner[`${id}-0`];
    return { id, name: countryById(id).name, city: countryById(id).cities[0], held: o === me || lordOf(s, o) === me };
  });
  const capsNeed = s.world.act == null ? 0 : CAPITALS_NEED;
  return {
    caps,
    capsNeed,
    capsHave: caps.filter((c) => c.held).length,
    capsOk: caps.filter((c) => c.held).length >= capsNeed,
    mine: mine.length,
    allied,
    total: FRONT.length,
    needAllied: Math.ceil(FRONT.length * ALLIED_SHARE),
    needAlone: Math.ceil(FRONT.length * ALONE_SHARE),
    captured: mine.filter((c) => c.home !== me).map((c) => c.name),
  };
}

/** 이미 이루고 '계속 플레이'를 고른 승리인지 */
export const hasWon = (s: GameState, kind: Ending['kind']) => !!s.wins?.some((w) => w.kind === kind);

/** 승리 팝업에서 '계속 플레이': 승리는 기록만 남기고 판은 그대로 이어 감(11-25 대장 요청) */
export function continueAfterWin(s: GameState): GameState {
  if (!s.ending) return s;
  const e = s.ending;
  const ev = { t: s.worldMs, kind: '점령' as const, text: `▶️ ${e.kind}를 기록하고 계속 플레이해요. 다른 승리에도 도전할 수 있어요.`, mine: true };
  const officer = e.kind === '정복 승리' || e.kind === '연합 승리' ? { ...s.officer, winSinceMs: null } : s.officer;
  return { ...s, ending: null, officer, wins: [...(s.wins ?? []), e], world: { ...s.world, events: [ev, ...s.world.events] } };
}

/** 이겼으면 ending을 채운 새 상태, 아니면 그대로 */
export function checkVictory(s: GameState): GameState {
  if (s.ending) return s;
  const pt = peaceTick(s);
  s = pt.s;
  const ct = cultureWinTick(s);
  s = ct.s;
  if (s.player.rankIndex < VICTORY_RANK) return s;
  const p = victoryProgress(s);
  if (pt.won && !hasWon(s, '평화 승리')) return finish(s, '평화 승리', p);
  if (ct.won && !hasWon(s, '문화 승리')) return finish(s, '문화 승리', p);
  const kind = p.mine >= p.needAlone && p.capsOk && !hasWon(s, '정복 승리') ? '정복 승리' : p.allied >= p.needAllied && !hasWon(s, '연합 승리') ? '연합 승리' : null;
  const since = s.officer.winSinceMs ?? null;
  if (!kind) return since === null ? s : { ...s, officer: { ...s.officer, winSinceMs: null } };
  if (since === null) {
    const ev = { t: s.worldMs, kind: '점령' as const, text: `🏁 승리 조건 달성! ${HOLD_DAYS}일 동안 지키면 이겨요.`, mine: true };
    return { ...s, officer: { ...s.officer, winSinceMs: s.worldMs }, world: { ...s.world, events: [ev, ...s.world.events] } };
  }
  if (s.worldMs - since < HOLD_MS) return s;
  return finish(s, kind, p);
}

function finish(s: GameState, kind: Ending['kind'], p: ReturnType<typeof victoryProgress>): GameState {
  const ending: Ending = {
    kind,
    day: Math.floor(s.worldMs / 3600e3) + 1,
    country: countryById(s.player.countryId).name,
    name: s.player.name,
    cities: p.mine,
    captured: p.captured,
    generals: s.officer.generals.map((g) => g.name),
  };
  const ev = { t: s.worldMs, kind: '점령' as const, text: kind === '평화 승리' ? `🕊️ 평화 승리! ${ending.country}이(가) 세계에 평화를 가져왔어요.` : kind === '문화 승리' ? `🎨 문화 승리! ${ending.country}의 문화가 세계를 사로잡았어요.` : `🏆 ${kind}! ${ending.country}이(가) 전쟁을 끝냈어요.`, mine: true };
  return { ...s, ending, world: { ...s.world, events: [ev, ...s.world.events] } };
}

// ── 명예의 전당(판이 바뀌어도 남음) ──
const HALL_KEY = 'modern-war-hall';
export interface HallEntry extends Ending {
  at: number;
  /** 승리 후 계속 플레이를 고름 */
  kept?: boolean;
}
export function loadHall(): HallEntry[] {
  try {
    const t = localStorage.getItem(HALL_KEY);
    return t ? (JSON.parse(t) as HallEntry[]) : [];
  } catch {
    return [];
  }
}
export function recordHall(e: Ending & { kept?: boolean }, at: number) {
  try {
    const list = [{ ...e, at }, ...loadHall()].slice(0, 50);
    localStorage.setItem(HALL_KEY, JSON.stringify(list));
  } catch {
    /* 무시 */
  }
}
