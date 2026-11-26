// AI 나라 성장 판단(11-26): AI 판단(실제 15분)마다 남는 나라 예산을 성향·상황에 맞는 갈래에 쓴다.
// 효과는 aiGrowth.ts. 세계 난수 씨앗(w.seed)은 건드리지 않는다(다른 판단 결과가 그대로 유지).

import { CITIES } from '../data/cities';
import { COUNTRIES, countryById } from '../data/world';
import { BUDGET_PER_DAY_PER_POINT, EVENT_LOG_MAX, aiStrength } from './balance';
import {
  FOCUS_DISCOUNT,
  FOCUS_WEIGHT,
  GROW_INFO,
  GROW_MAX,
  GROW_TRACKS,
  MILESTONES,
  NATION_FOCUS,
  PLAN_BY_PERS,
  growCost,
  newGrow,
  type AiGrow,
  type GrowTrack,
} from './aiGrowth';
import { Rng } from './rng';
import { ga, isAlive, isRival, relationOf, type WorldState } from './world';
import type { NationState } from './state';

/** 남겨 두는 나라 예산(하루 기본 예산 × 이 값). 침공 비용 등에 씀 */
export const GROW_RESERVE_DAYS = 4;
/** 판단마다 남는 돈 중 성장에 쓰는 몫 */
export const GROW_INVEST_SHARE = 0.5;
/** 판단 한 번에 올리는 최대 단계 수 */
export const GROW_BUYS_PER_TICK = 3;

/** 그 나라 하루 기본 예산(성장 값 기준) */
export const growBase = (id: string, player: string) => countryById(id).budget * BUDGET_PER_DAY_PER_POINT * aiStrength(id, player);

/** 다음 단계 값(나라 예산) */
export function nextCost(id: string, player: string, track: GrowTrack, lv: number): number {
  return growBase(id, player) * growCost(lv) * (NATION_FOCUS[id] === track ? FOCUS_DISCOUNT : 1);
}

/** 지금 상황에 맞는 갈래 가중치와 전략 이름 */
export function planOf(w: WorldState, id: string): { name: string; w: Record<GrowTrack, number> } {
  const pers = w.personalities[id];
  const base = PLAN_BY_PERS[pers] ?? PLAN_BY_PERS.방어형;
  const wt = { ...base.w };
  let name = base.name;
  const g = w.grow?.[id] ?? newGrow();
  const atWar = COUNTRIES.some((c) => c.id !== id && isAlive(w, c.id) && relationOf(w, id, c.id) === '전쟁');
  const lost = CITIES.some((c) => c.front && c.home === id && w.owner[c.id] !== id);
  if (atWar) {
    wt.army *= 2;
    wt.fort *= 1.6;
    wt.eco *= 0.6;
    name = `${name} · 전시 총력전`;
  }
  if (lost) {
    wt.fort *= 1.5;
    wt.army *= 1.5;
    name = `${base.name} · 잃은 땅 되찾기`;
  }
  if (!atWar && pers === '공격형' && g.lv.army >= 10) {
    wt.reach *= 1.5; // 군대가 커지면 밖으로
    if (!lost) name = `${base.name} · 세력 넓히기`;
  }
  if (!atWar && pers === '경제형' && g.lv.eco >= 15) {
    wt.tech *= 1.5; // 부자가 되면 기술로
    if (!lost) name = `${base.name} · 기술 강국`;
  }
  if (pers === '기회주의') {
    // 가장 센 맞수(성장 단계 합이 가장 큰 나라)보다 뒤진 갈래를 따라잡음
    const rivals = COUNTRIES.filter((c) => c.id !== id && isAlive(w, c.id) && (isRival(id, c.id) || relationOf(w, id, c.id) === '전쟁'));
    const top = rivals.sort((a, b) => sum(w, b.id) - sum(w, a.id))[0];
    if (top) {
      const tg = w.grow?.[top.id];
      if (tg) for (const t of GROW_TRACKS) if (g.lv[t] < tg.lv[t]) wt[t] *= 2;
      if (!atWar && !lost) name = `${base.name} · ${countryById(top.id).name} 따라잡기`;
    }
  }
  const focus = NATION_FOCUS[id];
  if (focus) wt[focus] *= FOCUS_WEIGHT;
  for (const t of GROW_TRACKS) if (g.lv[t] >= GROW_MAX) wt[t] = 0;
  return { name, w: wt };
}

const sum = (w: WorldState, id: string) => {
  const g = w.grow?.[id];
  return g ? GROW_TRACKS.reduce((a, t) => a + g.lv[t], 0) : 0;
};

/** AI 판단 한 번: 나라마다 남는 예산을 성장에 씀. w.grow와 nations를 바꾼다 */
export function growTick(w: WorldState, nations: Record<string, NationState>, t: number, player: string): void {
  const rng = new Rng((Math.floor(t / 1000) * 2654435761 + 17) >>> 0);
  const grow: Record<string, AiGrow> = { ...(w.grow ?? {}) };
  for (const c of COUNTRIES) {
    const id = c.id;
    if (id === player || !isAlive(w, id) || !nations[id]) continue;
    const n = nations[id];
    const g: AiGrow = grow[id] ? { ...grow[id], lv: { ...grow[id].lv } } : newGrow();
    const plan = planOf({ ...w, grow }, id);
    g.plan = plan.name;
    const reserve = growBase(id, player) * GROW_RESERVE_DAYS;
    let budget = Math.max(0, n.treasury - reserve) * GROW_INVEST_SHARE;
    for (let i = 0; i < GROW_BUYS_PER_TICK; i++) {
      // 가중치에 맞춰 단계를 채움(가중치 4인 갈래는 1인 갈래보다 약 4배 높이 올라감). 조금씩 흔들어 판마다 다르게
      let track: GrowTrack | null = null;
      let best = 0;
      for (const x of GROW_TRACKS) {
        const sc = (plan.w[x] / (g.lv[x] + 1)) * rng.range(0.85, 1.15);
        if (sc > best) { best = sc; track = x; }
      }
      if (!track) break;
      const cost = nextCost(id, player, track, g.lv[track]);
      if (cost > budget) break;
      budget -= cost;
      n.treasury -= cost;
      g.spent += cost;
      g.lv[track] += 1;
      const lv = g.lv[track];
      if (lv % 10 === 0) {
        const info = GROW_INFO[track];
        const text = `${info.icon} ${ga(c.name)} '${MILESTONES[track][lv / 10 - 1]}'을 이뤘어요(${info.name} ${lv}단계: ${info.eff} +${Math.round(lv * info.per * 100)}%).`;
        w.events.unshift({ t, kind: '성장', text, mine: false });
        if (w.events.length > EVENT_LOG_MAX) w.events.length = EVENT_LOG_MAX;
      }
    }
    grow[id] = g;
  }
  w.grow = grow;
}
