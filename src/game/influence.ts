// 11-28 대장 결정 "세계 영향력 승리": 군사 250 · 경제 200 · 외교 200 · 문화(신앙 포함) 200 · 과학 150 = 1000점.
//  · 600점 이상 + 2등의 1.5배 이상을 7일 지키면 세계 영향력 승리
//  · 실제 12주가 지나면 "점수 마감": 그때 1등이면 승리, 아니면 순위만 남기고 끝(계속 플레이 가능)
// AI 나라도 같은 잣대로 셈(문화는 스스로 쌓은 문화, 과학은 기술 성장 단계).
import { FRONT } from '../data/cities';
import { TECHS } from '../data/civ';
import { COUNTRIES, countryById } from '../data/world';
import { GROW_MAX } from './aiGrowth';
import { cultureOf } from './culture';
import { favorOf } from './civ';
import { faithLv, faithTotal } from './faith';
import { budgetPerDay, type GameState } from './state';
import { lordOf, vassalsOf } from './surrender';
import { isAlive, relationOf } from './world';
import { isCampLeader } from './camps';
import { raceInfluence } from './techRace';
import { secretInfluence } from './secretGoals';
import { proxyInfluence } from './proxy';

const H = 3600e3;
export type InfBranch = 'mil' | 'eco' | 'dip' | 'cul' | 'sci';
export const INF_BRANCHES: Array<{ id: InfBranch; icon: string; name: string; max: number; how: string }> = [
  { id: 'mil', icon: '⚔️', name: '군사', max: 250, how: '병력·전투 질·세계 도시 몫' },
  { id: 'eco', icon: '💰', name: '경제', max: 200, how: '하루 나라 예산의 세계 몫' },
  { id: 'dip', icon: '🤝', name: '외교', max: 200, how: '연합국·속국 수·호감' },
  { id: 'cul', icon: '🎨', name: '문화·신앙', max: 200, how: '쌓은 문화의 세계 몫 + 신앙 시설' },
  { id: 'sci', icon: '🔬', name: '과학', max: 150, how: '연구한 기술 몫' },
];
export const INF_WIN = 600;
export const INF_LEAD = 1.5;
export const INF_HOLD_DAYS = 7;
/** 실제 12주 점수 마감 */
export const INF_DEADLINE_DAYS = 84;

export type InfScore = Record<InfBranch, number> & { total: number; bonus: number };
/** 11-28 6단계 덤: 진영 맹주 +20 · 기술 경주 1등 +25씩 · (우리) 비밀 목표 +30씩 · 대리전 승리 +10씩 */
export function infBonusRows(s: GameState, id: string): Array<[string, number]> {
  const rows: Array<[string, number]> = [];
  if (isCampLeader(s, id)) rows.push(['👑 진영 맹주', 20]);
  const r = raceInfluence(s, id);
  if (r) rows.push(['🏁 기술 경주 세계 최초', r]);
  if (id === s.player.countryId) {
    const sc = secretInfluence(s);
    if (sc) rows.push(['🎯 비밀 목표', sc]);
    const px = proxyInfluence(s);
    if (px) rows.push(['🎭 대리전 승리', px]);
  }
  return rows;
}

/** 모든 살아 있는 나라 점수 */
export function influenceAll(s: GameState): Record<string, InfScore> {
  const me = s.player.countryId;
  const ids = COUNTRIES.map((c) => c.id).filter((id) => isAlive(s.world, id));
  const c = cultureOf(s);
  const power: Record<string, number> = {};
  const cities: Record<string, number> = {};
  const budget: Record<string, number> = {};
  const cul: Record<string, number> = {};
  for (const id of ids) {
    const n = s.nations[id];
    power[id] = (n?.troops ?? 0) * (0.5 + countryById(id).military / 100) * (1 + (s.world.grow?.[id]?.lv.tech ?? 0) * 0.01);
    cities[id] = FRONT.filter((x) => s.world.owner[x.id] === id).length;
    budget[id] = Math.max(0, budgetPerDay(s, id));
    cul[id] = id === me ? c.total : (c.ai[id] ?? 0);
  }
  const sum = (r: Record<string, number>) => Math.max(1, Object.values(r).reduce((a, v) => a + v, 0));
  const sp = sum(power), sb = sum(budget), sc = sum(cul);
  const out: Record<string, InfScore> = {};
  for (const id of ids) {
    const mil = 250 * Math.min(1, (0.5 * (power[id] / sp) + 0.5 * (cities[id] / FRONT.length)) / 0.3);
    const eco = 200 * Math.min(1, budget[id] / sb / 0.25);
    const allies = ids.filter((x) => x !== id && relationOf(s.world, id, x) === '연합').length;
    const vas = vassalsOf(s, id).length;
    const favor = id === me ? ids.filter((x) => x !== me && favorOf(s, x) >= 30).length / Math.max(1, ids.length - 1) : 0.15;
    const dip = 200 * Math.min(1, Math.min(1, allies / 8) * 0.45 + Math.min(1, vas / 4) * 0.3 + favor * 0.25 + (id === me ? faithLv(s, 'shrine') * 0.02 : 0)) * (lordOf(s, id) ? 0.5 : 1);
    const culV = 200 * Math.min(1, cul[id] / sc / 0.2) + (id === me ? faithTotal(s) * 4 + faithLv(s, 'shrine') * 2 : 0);
    const sciV = id === me ? (s.civ?.done ?? []).length / Math.max(1, TECHS.length) : Math.min(1, (s.world.grow?.[id]?.lv.tech ?? 0) / GROW_MAX * 0.8 + countryById(id).economy / 500);
    const v: Record<InfBranch, number> = { mil, eco, dip, cul: Math.min(200, culV), sci: 150 * Math.min(1, sciV) };
    const r = (x: number) => Math.round(x);
    const bonus = infBonusRows(s, id).reduce((a, [, x]) => a + x, 0);
    out[id] = { mil: r(v.mil), eco: r(v.eco), dip: r(v.dip), cul: r(v.cul), sci: r(v.sci), bonus, total: r(v.mil + v.eco + v.dip + v.cul + v.sci + bonus) };
  }
  return out;
}
export function influenceRank(s: GameState) {
  const all = influenceAll(s);
  return Object.entries(all)
    .map(([id, sc]) => ({ id, ...sc }))
    .sort((a, b) => b.total - a.total);
}
export function influenceProgress(s: GameState) {
  const me = s.player.countryId;
  const rank = influenceRank(s);
  const mine = rank.find((r) => r.id === me)!;
  const second = rank.find((r) => r.id !== me);
  const place = rank.findIndex((r) => r.id === me) + 1;
  const ok = !!mine && mine.total >= INF_WIN && (!second || mine.total >= second.total * INF_LEAD);
  const start = s.infl?.startMs ?? 0;
  const deadline = start + INF_DEADLINE_DAYS * 24 * H;
  return { rank, mine, second, place, ok, deadline, left: Math.max(0, deadline - s.worldMs) };
}
export interface InflState {
  /** 점수 마감을 세기 시작한 시각 */
  startMs: number;
  winSinceMs: number | null;
  /** 점수 마감이 끝났나 */
  closed?: boolean;
}
