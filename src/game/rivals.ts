// 11/23 대장 결정: 지도자가 된 뒤의 라이벌 = 나라 안 정적 3명(야당 대표·군부 실력자·재벌).
// 영향력이 쌓이면 방해 사건을 일으키고, 지도자는 동향 살피기·견제·회유로 맞섬. 회유에 성공하면 내 편(협력)이 되어 덤을 줌.
import { PROMOTION } from '../data/officers';
import { RANKS } from '../data/ranks';
import { REAL_MS_PER_GAME_DAY } from './balance';
import type { Rng } from './rng';
import type { GameState } from './state';
import { note, type OfficerState, type Rival } from './officer';
import { counterOn } from './cabinet';

const HOUR = 60 * 60 * 1000;
const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));

export const RIVAL_ROLES = ['야당 대표', '군부 실력자', '재벌'] as const;
export type RivalRole = (typeof RIVAL_ROLES)[number];

export const ROLE_INFO: Record<RivalRole, { icon: string; text: string; plot: string; ally: string }> = {
  '야당 대표': { icon: '🗳️', text: '의회에서 지도자를 몰아내려는 야당 대표예요.', plot: '예산안 반대·폭로 연설로 의회 신뢰를 깎아요.', ally: '협력하면 의회 신뢰가 천천히 올라요(70까지).' },
  '군부 실력자': { icon: '🎖️', text: '군 안에 따르는 사람이 많은 장성 출신 실력자예요.', plot: '장군·부관 사이에 불만을 퍼뜨려 충성을 깎아요.', ally: '협력하면 장군 도시 방어 +5%.' },
  재벌: { icon: '💼', text: '나라 돈줄을 쥔 재벌 회장이에요.', plot: '자금줄을 죄어 봉급을 빼앗아요.', ally: '협력하면 봉급이 10% 더 들어와요.' },
};

// ── 숫자(초안) ──
/** 이 영향력을 넘으면 방해 사건을 일으키기 시작 */
export const PLOT_MIN = 40;
/** 이 영향력을 넘는 정적이 있으면 전설의 지도자 승급이 막힘 */
export const BLOCK_AT = 70;
/** 방해 사건 간격(실제 시간) */
export const PLOT_GAP_H: [number, number] = [6, 10];
/** 동향 살피기로 지켜보는 시간 */
export const WATCH_HOURS = 6;
/** 견제 값(정보 점수) */
export const PRESS_INTEL = 10;
/** 회유 3번 성공하면 협력 */
export const WOO_NEED = 3;
export const wooCost = (rank: number) => 500 + rank * 200;

export const roleOf = (rv: Rival, i: number): RivalRole => rv.role ?? RIVAL_ROLES[i % RIVAL_ROLES.length];
export const influenceOf = (rv: Rival) => rv.influence ?? clamp(Math.round(25 + (rv.rate - 170) / 4), 0, 100);

/** 옛 저장·새 판: 빈 칸을 채움 */
export function ensureRivals(o: OfficerState, worldMs: number) {
  o.rivals.forEach((rv, i) => {
    if (!rv.role) rv.role = RIVAL_ROLES[i % RIVAL_ROLES.length];
    if (rv.influence === undefined) rv.influence = influenceOf(rv);
    if (rv.nextPlotMs === undefined) rv.nextPlotMs = worldMs + PLOT_GAP_H[0] * HOUR;
  });
}

export const watching = (rv: Rival, worldMs: number) => (rv.watchUntil ?? 0) > worldMs;
export const hostile = (o: OfficerState) => o.rivals.filter((r) => !r.ally);
export const hasAlly = (o: OfficerState, role: RivalRole) => o.rivals.some((r, i) => r.ally && roleOf(r, i) === role);

/** 가장 위험한 정적(영향력 70 넘는 사람 중 가장 센 사람) */
export function chiefRivalOf(o: OfficerState): Rival | null {
  const top = hostile(o).sort((a, b) => influenceOf(b) - influenceOf(a))[0];
  return top && influenceOf(top) >= BLOCK_AT ? top : null;
}

/** 모든 적대 정적의 영향력 바꾸기(승급 −, 도시를 잃으면 + 등) */
export function shiftInfluence(o: OfficerState, v: number) {
  for (const r of hostile(o)) r.influence = clamp(influenceOf(r) + v, 0, 100);
}

/** 판단마다(실제 15분): 영향력이 쌓이고, 때가 되면 방해 사건. 협력한 정적은 덤 */
export function rivalTick(ns: GameState, o: OfficerState, rng: Rng, tickMs: number) {
  ensureRivals(o, ns.worldMs);
  const h = tickMs / HOUR;
  const r = ns.player.rankIndex;
  o.rivals.forEach((rv, i) => {
    const role = roleOf(rv, i);
    if (rv.ally) {
      if (role === '야당 대표' && o.trust < 70) o.trust = Math.min(70, o.trust + 0.25 * h);
      if (role === '재벌') ns.player = { ...ns.player, salary: ns.player.salary + RANKS[r].salaryPerDay * 0.1 * (tickMs / REAL_MS_PER_GAME_DAY) };
      return;
    }
    // 하루(실제 24시간)에 약 3~5씩 쌓임
    rv.influence = clamp(influenceOf(rv) + (rv.rate / 50 / 24) * h, 0, 100);
    if (ns.worldMs < (rv.nextPlotMs ?? 0)) return;
    rv.nextPlotMs = ns.worldMs + rng.range(PLOT_GAP_H[0], PLOT_GAP_H[1]) * HOUR;
    const inf = influenceOf(rv);
    if (inf < PLOT_MIN || !rng.chance(inf / 100)) return;
    if (watching(rv, ns.worldMs) || counterOn(ns)) {
      rv.influence = clamp(inf - 8, 0, 100);
      o.intel += 5;
      note(ns, `🕵️ ${rv.name}(${role})의 방해 공작을 미리 막았어요. 영향력 −8 · 정보 +5`);
      return;
    }
    if (role === '야당 대표') {
      const loss = Math.round(3 + inf / 20);
      o.trust = Math.max(0, o.trust - loss);
      note(ns, `🗳️ 야당 대표 ${rv.name}이(가) 예산안 반대 연설을 했어요. 의회 신뢰 −${loss}`);
    } else if (role === '군부 실력자') {
      const pool = [...o.generals.map((g) => ({ name: `${g.name} 장군`, hit: () => (g.loyalty = Math.max(0, g.loyalty - 8)) })), ...o.aides.map((a) => ({ name: `${a.name} 부관`, hit: () => (a.loyalty = Math.max(0, (a.loyalty ?? 40 + a.bond / 2) - 6)) }))];
      if (pool.length) {
        const t = rng.pick(pool);
        t.hit();
        note(ns, `🎖️ 군부 실력자 ${rv.name}이(가) ${t.name}에게 불만을 퍼뜨렸어요. 충성 −`);
      } else {
        o.trust = Math.max(0, o.trust - 2);
        note(ns, `🎖️ 군부 실력자 ${rv.name}이(가) 군 안에 지도자 험담을 퍼뜨렸어요. 의회 신뢰 −2`);
      }
    } else {
      const loss = Math.min(Math.round(ns.player.salary * 0.1), 500 + r * 200);
      ns.player = { ...ns.player, salary: Math.max(0, ns.player.salary - loss) };
      note(ns, `💼 재벌 ${rv.name}이(가) 자금줄을 죄었어요. 봉급 −${loss}`);
    }
  });
  const chief = chiefRivalOf(o);
  if (chief && o.chiefRival !== chief.name) note(ns, `⚠️ 정적 ${chief.name}의 영향력이 ${BLOCK_AT}을 넘었어요. 이대로면 전설의 지도자 승급을 막아요.`);
  o.chiefRival = chief?.name ?? null;
}

/** 마지막 승급(세계 강자 → 전설의 지도자)을 막는 까닭 */
export function rivalBlock(s: GameState): string | null {
  if (s.player.rankIndex !== PROMOTION.length - 1) return null;
  const c = chiefRivalOf(s.officer);
  return c ? `정적 ${c.name}의 영향력이 ${BLOCK_AT}을 넘어요(견제·회유 필요)` : null;
}

/** 회유 성공 확률: 정치 스탯 + 의회 신뢰, 영향력이 클수록 어려움 */
export function wooChance(s: GameState, rv: Rival): number {
  const pol = s.officer.stats['정치'] ?? 0;
  return clamp(0.25 + pol * 0.01 + (60 - influenceOf(rv)) / 200 + s.officer.trust / 400, 0.1, 0.85);
}
/** 견제로 깎는 영향력 */
export const pressAmount = (s: GameState) => Math.round(6 + (s.officer.stats['정보'] ?? 0) / 5);

/** 화면용 */
export function rivalsView(s: GameState) {
  return s.officer.rivals.map((rv, i) => ({
    name: rv.name,
    role: roleOf(rv, i),
    influence: Math.round(influenceOf(rv)),
    ally: !!rv.ally,
    woo: rv.woo ?? 0,
    watch: watching(rv, s.worldMs),
    nextPlotMs: rv.nextPlotMs ?? 0,
  }));
}
