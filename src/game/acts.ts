// 11-27 종합 확장안 개편 1·2: 한 판을 4장으로.
//  1장 취임 100일 — 인사·내정·훈련. 내 나라는 전쟁 없음
//  2장 지역의 맹주 — 이웃 나라와만, 한 번에 한 나라
//  3장 세계 대전 — 제한 없음, AI가 세짐
//  4장 마지막 위기 — 승리 조건을 채운 뒤. AI가 가장 셈
// 막을 넘는 조건은 루비·가속권으로 건너뛸 수 없다. 옛 저장(막 기록 없음)은 3장으로 대접(막힘 없음).
import { FRONT } from '../data/cities';
import { CITY_LONLAT } from '../data/realmap';
import { COUNTRIES, countryById } from '../data/world';
import { TECHS } from '../data/civ';
import { ACT1_MAX_HOURS, ACT1_MIN_HOURS, ACT1_POWER_PER_MIL, ACT1_TECHS, ACT2_MAX_HOURS, ACT2_NEIGHBORS, ACT2_SUBDUE, ACT_REWARD, EVENT_LOG_MAX, GRAND_EXTRA_MAX, GRAND_EXTRA_RUBY, GRAND_NOBUY_ACTS, GRAND_PER_DAY, actOf } from './balance';
import type { GameState } from './state';
import { homeOf, isAlive, relationOf } from './world';
import { goalsOf } from './goals';
import { armyPower } from './economy';
import { lordOf } from './surrender';
import { pushReport } from './report';

const H = 3600e3;

export const ACTS: Array<{ n: 1 | 2 | 3 | 4; icon: string; name: string; text: string; next: string }> = [
  { n: 1, icon: '🏛️', name: '취임 100일', text: '사람을 앉히고 나라 살림과 군대를 키워요. 이때는 어느 나라도 우리와 전쟁하지 않아요.', next: '조건을 모두 채우면 2장' },
  { n: 2, icon: '🗺️', name: '지역의 맹주', text: '이웃 나라와 겨뤄요. 한 번에 한 나라와만 싸울 수 있어요.', next: '이웃을 굴복시키면 3장' },
  { n: 3, icon: '🌍', name: '세계 대전', text: '어느 나라와도 싸울 수 있어요. 다른 나라들이 훨씬 세져요.', next: '승리 조건을 채우면 4장' },
  { n: 4, icon: '🔥', name: '마지막 위기', text: '승리 조건을 지키는 동안 세계가 마지막으로 막아서요.', next: '끝까지 지키면 승리' },
];
export const actInfo = (s: GameState) => ACTS[actOf(s.world) - 1];

/** 수도끼리 거리(도). 이웃 나라를 고르는 데만 씀 */
function capDist(a: string, b: string): number {
  const [x1, y1] = CITY_LONLAT[countryById(a).cities[0]];
  const [x2, y2] = CITY_LONLAT[countryById(b).cities[0]];
  const dx = Math.min(Math.abs(x1 - x2), 360 - Math.abs(x1 - x2)) * Math.cos((((y1 + y2) / 2) * Math.PI) / 180);
  return Math.hypot(dx, y1 - y2);
}
const NEAR: Record<string, string[]> = {};
/** 다른 나라 모두, 수도가 가까운 순서 */
export function nearestOf(me: string): string[] {
  return (NEAR[me] ??= COUNTRIES.map((c) => c.id)
    .filter((id) => id !== me)
    .sort((a, b) => capDist(me, a) - capDist(me, b)));
}
/** 이웃 나라: 수도가 가까운 순서로 5개 */
export const neighborsOf = (me: string): string[] => nearestOf(me).slice(0, ACT2_NEIGHBORS);

/** 내가 굴복시킨 나라: 처음 거점을 내가(또는 내 속국이) 모두 가졌거나, 내 속국이 됨 */
export function subdued(s: GameState): string[] {
  const me = s.player.countryId;
  const mineOrVassal = (o: string) => o === me || lordOf(s, o) === me;
  return COUNTRIES.map((c) => c.id).filter((id) => id !== me && (lordOf(s, id) === me || FRONT.filter((c) => c.home === id).every((c) => mineOrVassal(s.world.owner[c.id]))));
}

export const milTechs = (s: GameState) => TECHS.filter((t) => t.line === 'mil' && (s.civ?.done ?? []).includes(t.id)).length;
export const act1Power = (s: GameState) => Math.round(countryById(s.player.countryId).military * ACT1_POWER_PER_MIL);

export interface ActGoal { icon: string; text: string; have: number; need: number; unit?: string; done: boolean }
/** 다음 장으로 가는 조건(화면·판정 공용) */
export function actGoals(s: GameState): ActGoal[] {
  const act = actOf(s.world);
  const since = s.world.actSinceMs ?? 0;
  const g = (icon: string, text: string, have: number, need: number, unit = ''): ActGoal => ({ icon, text, have: Math.min(have, need), need, unit, done: have >= need });
  if (act === 1) {
    const left = Math.max(0, Math.ceil((since + ACT1_MAX_HOURS * H - s.worldMs) / (24 * H)));
    return [
      g('📅', '취임 100일(게임 날짜)', Math.floor((s.worldMs - since) / H), ACT1_MIN_HOURS, '일'),
      g('⚙️', '군사 연구 끝내기', milTechs(s), ACT1_TECHS, '개'),
      { ...g('🪖', '', Math.round(armyPower(s)), act1Power(s)), text: `부대 전투력 키우기 · 못 해도 실제 ${left}일 뒤 2장이 열려요` },
    ];
  }
  if (act === 2) {
    const left = Math.max(0, Math.ceil((since + ACT2_MAX_HOURS * H - s.worldMs) / (24 * H)));
    return [{ ...g('🏳️', `이웃 나라 굴복시키기(거점 모두 차지·속국)`, subdued(s).length, ACT2_SUBDUE, '개'), text: `이웃 나라 굴복시키기 · 못 해도 실제 ${left}일 뒤 세계 대전이 터져요` }];
  }
  if (act === 3) return [g('🏁', '승리 조건 하나 채우기(정복·연합·평화·문화)', holding(s) ? 1 : 0, 1, '')];
  return [];
}
/** 승리 조건을 채우고 지키는 중인가 */
const holding = (s: GameState) => s.officer.winSinceMs != null || (s.peace?.sinceMs ?? null) !== null || !!s.ending || (s.wins?.length ?? 0) > 0;

/** 선전포고를 막는 까닭(없으면 null) */
export function actBlocksWar(s: GameState, id: string): string | null {
  const act = actOf(s.world);
  const me = s.player.countryId;
  if (act === 1) return '1장(취임 100일)에는 먼저 전쟁을 걸 수 없어요. 본부의 장 조건을 채우면 2장이 열려요';
  if (act === 2) {
    const nb = neighborsOf(me);
    if (!nb.includes(id)) return `2장에는 이웃 나라(${nb.map((x) => countryById(x).name).join('·')})와만 싸울 수 있어요`;
    const wars = COUNTRIES.filter((c) => c.id !== me && isAlive(s.world, c.id) && relationOf(s.world, me, c.id) === '전쟁');
    if (wars.length >= 1) return `2장에는 한 번에 한 나라와만 싸워요(지금 ${wars[0].name}와 전쟁 중)`;
  }
  return null;
}
/** 대전투로 칠 수 있는 도시인가: 1장에는 빼앗긴 우리 도시만 */
export const actAllowsTarget = (s: GameState, city: string) => actOf(s.world) !== 1 || homeOf(s.world, city) === s.player.countryId;

// ── 하루 대전투 상한(루비로 2번까지 더) ──
export const dayKey = (s: GameState) => Math.floor(s.worldMs / (24 * H));
export function grandToday(s: GameState): { n: number; extra: number; cap: number } {
  const d = s.officer.grandDay;
  const cur = d && d.key === dayKey(s) ? d : { n: 0, extra: 0 };
  return { n: cur.n, extra: cur.extra, cap: GRAND_PER_DAY + cur.extra };
}
/** 오늘 대전투를 더 할 수 있나(옛 저장·막 기록 없는 판은 상한 없음). 우리 도시 되찾기는 세지 않음 */
export function grandCapLeft(s: GameState): number {
  if (s.world.act == null) return 99;
  const t = grandToday(s);
  return t.cap - t.n;
}
export function noteGrand(s: GameState, city: string): GameState['officer']['grandDay'] {
  const t = grandToday(s);
  const own = homeOf(s.world, city) === s.player.countryId;
  return { key: dayKey(s), n: t.n + (own || s.world.act == null ? 0 : 1), extra: t.extra };
}
export function canBuyGrand(s: GameState): string | null {
  if (grandCapLeft(s) > 0) return '아직 오늘 횟수가 남았어요';
  if (s.world.act != null && GRAND_NOBUY_ACTS.includes(actOf(s.world))) return `${actOf(s.world)}장에는 대전투를 더 살 수 없어요. 내일 다시 할 수 있어요`;
  if (grandToday(s).extra >= GRAND_EXTRA_MAX) return `하루 ${GRAND_PER_DAY + GRAND_EXTRA_MAX}번이 끝이에요. 내일 다시 할 수 있어요`;
  if ((s.goals?.ruby ?? 0) < GRAND_EXTRA_RUBY) return `루비 ${GRAND_EXTRA_RUBY} 필요`;
  return null;
}
export function buyGrand(s: GameState): GameState {
  if (canBuyGrand(s)) return s;
  const t = grandToday(s);
  const g = goalsOf(s);
  return { ...s, goals: { ...g, ruby: g.ruby - GRAND_EXTRA_RUBY }, officer: { ...s.officer, grandDay: { key: dayKey(s), n: t.n, extra: t.extra + 1 } } };
}

/** 막 넘기기 판정(세계 판단마다). 장이 넘어가면 소식·부관 보고·보상 */
export function actsTick(s: GameState): GameState {
  if (s.world.act == null) return s;
  const act = s.world.act;
  if (act >= 4) {
    // 승리 조건을 놓치면 3장으로 돌아감(다시 채우면 마지막 위기가 다시 옴)
    if (holding(s)) return s;
    const text = '⏪ 승리 조건을 놓쳐 3장 「세계 대전」으로 돌아갔어요.';
    return { ...s, world: { ...s.world, act: 3, actSinceMs: s.worldMs, events: [{ t: s.worldMs, kind: '점령' as const, text, mine: true }, ...s.world.events].slice(0, EVENT_LOG_MAX) } };
  }
  const since = s.world.actSinceMs ?? 0;
  const ok = act === 2 ? subdued(s).length >= ACT2_SUBDUE || s.worldMs - since >= ACT2_MAX_HOURS * H : actGoals(s).every((g) => g.done) || (act === 1 && s.worldMs - since >= ACT1_MAX_HOURS * H);
  if (!ok) return s;
  const nx = ACTS[act];
  // 보상은 그 장에 처음 닿았을 때만
  const first = (s.world.actMax ?? act) <= act;
  const rw = first ? ACT_REWARD[act] : { ruby: 0, boosts: 0 };
  const text = `${nx.icon} ${nx.n}장 「${nx.name}」이 올랐어요. ${nx.text}`;
  const ev = { t: s.worldMs, kind: '점령' as const, text, mine: true };
  let out: GameState = { ...s, world: { ...s.world, act: act + 1, actMax: Math.max(s.world.actMax ?? 1, act + 1), actSinceMs: s.worldMs, events: [ev, ...s.world.events].slice(0, EVENT_LOG_MAX) } };
  const g = goalsOf(out);
  out = { ...out, goals: { ...g, ruby: g.ruby + rw.ruby } };
  out = { ...out, officer: { ...out.officer, boosts: (out.officer.boosts ?? 0) + rw.boosts } };
  return pushReport(out, { icon: nx.icon, text: `${nx.n}장 「${nx.name}」이 시작됐습니다. ${nx.text} ${first ? `(💎 +${rw.ruby} · 🎫 +${rw.boosts})` : ''}` });
}
