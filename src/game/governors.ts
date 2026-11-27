// 안 5 시·도지사와 지방(11/26): 내 도시마다 지사(시장)가 있고 여당·야당으로 갈림. 협조도가 그 도시 민심과 자원에 반영.
// 지사는 실제 14~22시간마다 지역 요구(신공항·병원 등)를 올림 → 들어주면 협조·민심↑(나라 예산), 거절하면↓.
// 지방선거(seats.ts가 7일마다 총선과 번갈아)에서 도시마다 지사가 다시 뽑힘.
import { payTreasury, registerDomRows, snap } from './domestic';
import { registerCityLoyaltyRows, loyaltyTarget } from './civ';
import { DAY, H, addMark, bumpRival, clamp, polityOf, polityLog, roll, tell, withPolity, type GovDemand, type Governor } from './polity';
import { Rng } from './rng';
import { budgetPerDay, type GameState } from './state';
import { myCityIds } from './zones';
import { homeOf } from './world';
import { cityById } from '../data/cities';
import { isHometown } from '../data/krCities';
import { makeName } from '../data/names';

export const DEMAND_GAP_H: [number, number] = [14, 22];
export const DEMAND_MS = 12 * H;
export interface DemandDef {
  id: string;
  icon: string;
  name: string;
  days: number;
}
export const DEMANDS: DemandDef[] = [
  { id: 'air', icon: '🛫', name: '신공항 예산', days: 3 },
  { id: 'subway', icon: '🚇', name: '지하철 연장', days: 2.5 },
  { id: 'hospital', icon: '🏥', name: '공공 병원', days: 2 },
  { id: 'arena', icon: '🏟️', name: '체육관·문화 시설', days: 1.5 },
  { id: 'factory', icon: '🏭', name: '산업단지 유치', days: 2.5 },
  { id: 'school', icon: '🏫', name: '학교 신설', days: 1.5 },
];
export const demandDef = (id: string) => DEMANDS.find((d) => d.id === id)!;

/** 분권 개헌이면 협조 +15(amend.ts가 넣음) */
const COOP_ADD: Array<(s: GameState) => number> = [];
export function registerCoopAdd(f: (s: GameState) => number) {
  COOP_ADD.push(f);
}
const coopAdd = (s: GameState) => COOP_ADD.reduce((a, f) => a + f(s), 0);
export const coopGoal = (s: GameState, g: Governor) => clamp((g.party === 'ruling' ? 70 : 30) + coopAdd(s));

function makeGov(s: GameState, rng: Rng, party: 'ruling' | 'opp', taken: Set<string>): Governor {
  const sex: 'm' | 'f' = rng.next() < 0.3 ? 'f' : 'm';
  const age = 50 + Math.floor(rng.next() * 18);
  const name = makeName(s.player.countryId, sex, rng, taken);
  return { name, sex, age, id: 7000 + Math.floor(rng.next() * 90000), party, coop: party === 'ruling' ? 58 + Math.floor(rng.next() * 10) : 33 + Math.floor(rng.next() * 10) };
}

export const governorsOf = (s: GameState) => polityOf(s).governors;
/** 11-27 지사가 있는 도시: 내 도시 가운데 '우리 땅'(원래 땅·편입한 땅). 편입 전 점령지는 점령지 관리청(occAdmin.ts)이 맡음 */
export const governedCityIds = (s: GameState): string[] => myCityIds(s).filter((id) => homeOf(s.world, id) === s.player.countryId);
export const myGovernors = (s: GameState): Array<[string, Governor]> => governedCityIds(s).filter((id) => governorsOf(s)[id]).map((id) => [id, governorsOf(s)[id]]);

/** 지사 채우기(새로 얻은 도시)·잃은 도시 지우기 */
export function ensureGovernors(s: GameState): GameState {
  const p = polityOf(s);
  const mine = governedCityIds(s);
  const have = Object.keys(p.governors);
  if (mine.length === have.length && mine.every((id) => p.governors[id])) return s;
  const rng = new Rng(p.seed ^ 0x9e37);
  const taken = new Set(Object.values(p.governors).map((g) => g.name));
  const governors: Record<string, Governor> = {};
  for (const id of mine) governors[id] = p.governors[id] ?? makeGov(s, rng, rng.next() < 0.55 ? 'ruling' : 'opp', taken);
  return withPolity(s, { governors, seed: rng.seed });
}

/** 지방선거: 도시마다 여당이 이길 확률 = 득표율 + 도시 민심 + 유세 + 고향 */
export function localChance(s: GameState, cityId: string, share: number): number {
  const rally = polityOf(s).election.rally.filter((c) => c === cityId).length;
  const home = isHometown(cityById(cityId).name) ? 0.1 : 0;
  return clamp(share / 100 + (loyaltyTarget(s, cityId) - 50) / 200 + rally * 0.06 + home, 0.05, 0.95);
}
export function localElection(s: GameState, share: number): GameState {
  let ns = ensureGovernors(s);
  const p = polityOf(ns);
  const rng = new Rng(p.seed ^ 0x51ed);
  const taken = new Set(Object.values(p.governors).map((g) => g.name));
  const governors: Record<string, Governor> = {};
  let win = 0;
  let flip = 0;
  for (const [id, g] of Object.entries(p.governors)) {
    const party = rng.next() < localChance(ns, id, share) ? 'ruling' : 'opp';
    if (party === 'ruling') win++;
    if (party === g.party) governors[id] = { ...g, coop: party === 'ruling' ? Math.max(g.coop, 60) : Math.min(g.coop, 40) };
    else {
      flip++;
      governors[id] = makeGov(ns, rng, party, taken);
    }
  }
  const total = Object.keys(governors).length;
  ns = withPolity(ns, { governors, seed: rng.seed });
  const line = `🗳️ 지방선거 결과 여당 ${win}/${total}곳 · 바뀐 곳 ${flip} · 득표 ${Math.round(share)}%`;
  ns = polityLog(ns, line);
  const good = win * 2 >= total;
  let who: string | null;
  [ns, who] = bumpRival(ns, '야당 대표', good ? -5 : 8);
  ns = tell(ns, `${line}. ${good ? '지방 권력을 지켰어요.' : `야당이 지방을 휩쓸었어요.${who ? ` 야당 대표 ${who}: "지방에서부터 정권을 바꾸겠다!"` : ''}`}`);
  return snap(ns, 'rally', good ? '지방선거 승리' : '지방선거 패배', line);
}

export function canAnswer(s: GameState, pay: boolean): string | null {
  const d = polityOf(s).demand;
  if (!d) return '요구가 없어요';
  if (pay) {
    const me = s.nations[s.player.countryId];
    if (!me || me.treasury < demandCost(s, d)) return '나라 예산이 모자라요';
  }
  return null;
}
export const demandCost = (s: GameState, d: GovDemand) => Math.round(budgetPerDay(s, s.player.countryId) * demandDef(d.kind).days);
export function answerDemand(s: GameState, pay: boolean): GameState {
  if (canAnswer(s, pay)) return s;
  const d = polityOf(s).demand!;
  let ns = s;
  if (pay) ns = payTreasury(ns, demandCost(ns, d)) ?? ns;
  return closeDemand(ns, pay, false);
}
function closeDemand(s: GameState, pay: boolean, late: boolean): GameState {
  const p = polityOf(s);
  const d = p.demand!;
  const g = p.governors[d.cityId];
  const def = demandDef(d.kind);
  const cname = cityById(d.cityId).name;
  let gap: number;
  let ns = s;
  [gap, ns] = roll(ns);
  const governors = g ? { ...p.governors, [d.cityId]: { ...g, coop: clamp(g.coop + (pay ? 15 : -15)) } } : p.governors;
  ns = withPolity(ns, { governors, demand: null, demandMs: ns.worldMs + (DEMAND_GAP_H[0] + (DEMAND_GAP_H[1] - DEMAND_GAP_H[0]) * gap) * H });
  ns = addMark(ns, d.cityId, pay ? 6 : -6, 48, pay ? `${def.icon} ${def.name} 들어줌` : `${def.icon} ${def.name} 거절`);
  ns = polityLog(ns, `${def.icon} ${cname} ${def.name}: ${pay ? '들어줌' : late ? '답 안 함(거절)' : '거절'}`);
  if (!pay && g?.party === 'opp') {
    let who: string | null;
    [ns, who] = bumpRival(ns, '야당 대표', 3);
    ns = tell(ns, `🗺️ ${cname} ${g.name}: "중앙정부가 ${cname}을(를) 버렸습니다!"${who ? ` 야당 대표 ${who}도 거들었어요.` : ''}`);
  }
  return ns;
}

/** 15분마다: 지사 채우기·협조도 움직임·요구 */
export function governorsTick(s: GameState): GameState {
  if (!s.polity) return s;
  let ns = ensureGovernors(s);
  const p = polityOf(ns);
  const governors: Record<string, Governor> = {};
  for (const [id, g] of Object.entries(p.governors)) governors[id] = { ...g, coop: Math.round((g.coop + (coopGoal(ns, g) - g.coop) * 0.02) * 10) / 10 };
  ns = withPolity(ns, { governors });
  if (p.demand) {
    if (p.demand.untilMs <= ns.worldMs) ns = closeDemand(ns, false, true);
    return ns;
  }
  if (ns.worldMs < p.demandMs) return ns;
  const ids = Object.keys(governors);
  if (!ids.length) return withPolity(ns, { demandMs: ns.worldMs + DAY });
  let a: number, b: number;
  [a, ns] = roll(ns);
  [b, ns] = roll(ns);
  const cityId = ids[Math.floor(a * ids.length)];
  const kind = DEMANDS[Math.floor(b * DEMANDS.length)].id;
  ns = withPolity(ns, { demand: { cityId, kind, untilMs: ns.worldMs + DEMAND_MS } });
  const g = governors[cityId];
  return tell(ns, `🗺️ ${cityById(cityId).name} ${g.name}(${g.party === 'ruling' ? '여당' : '야당'})이 ${demandDef(kind).name}을(를) 요구해요(12시간 안에 답).`);
}

registerCityLoyaltyRows((s, cityId) => {
  if (!s.polity) return [];
  const p = polityOf(s);
  const out: Array<[string, number]> = [];
  const g = p.governors[cityId];
  if (g) {
    const v = g.coop >= 70 ? Math.round((g.coop - 60) / 10) : g.coop <= 30 ? -Math.round((40 - g.coop) / 10) : 0;
    if (v) out.push([`🗺️ ${g.name} ${g.party === 'ruling' ? '(여)' : '(야)'} 협조 ${Math.round(g.coop)}`, v]);
  }
  for (const m of p.marks) if (m.cityId === cityId && m.untilMs > s.worldMs) out.push([m.why, m.v]);
  return out;
});
registerDomRows((s, key) => {
  if (!s.polity || key !== 'res') return [];
  let v = 0;
  for (const [, g] of myGovernors(s)) {
    if (g.coop >= 80) v += 0.01;
    if (g.coop < 20) v -= 0.01;
  }
  v = clamp(v, -0.05, 0.05);
  return v ? [['🗺️ 시·도지사 협조', Math.round(v * 100) / 100]] : [];
});
