// 해외 파병(11/24 대장 요청 "해외파병도 외교에 구현"). 외교 → 파병 탭.
// 내가 만든 부대를 연합국·친한 나라로 보냄: 도착하면 그 나라 호감↑, 그 나라 도시 방어↑(전투력만큼, 최대 +40%).
// 그 나라가 전쟁 중이면 가끔 부대를 잃고 명성을 얻음. 머무는 동안 국방예산에서 유지비. 부르면 돌아옴.
import { CITIES } from '../data/cities';
import { UNIT_COST, specialCost } from '../data/economy';
import { SPECIALS } from '../data/specials';
import { countryById } from '../data/world';
import { addFavorNote, favorOf } from './civ';
import { Rng } from './rng';
import type { GameState } from './state';
import { isAlive, relationOf, type WorldEvent } from './world';

const HOUR = 3600e3;
export const DEPLOY_MAX = 3;
/** 연합이 아니면 이만큼 호감이 있어야 받아 줌 */
export const DEPLOY_FAVOR = 30;
/** AI 판단(15분)마다 유지비: 부대 값의 0.4% */
const UPKEEP = 0.004;
/** 전쟁 중인 나라에 있으면 판단마다 부대 하나를 잃을 확률 */
const LOSS_CHANCE = 0.08;

export interface Deployment {
  id: number;
  to: string;
  units: Record<string, number>;
  /** 도착 시각(세계 ms) */
  arriveMs: number;
  /** 돌아오는 중이면 돌아오는 시각 */
  returnMs?: number;
  /** 잃은 부대 수 */
  lost: number;
  /** 도착 인사(호감)를 했는가 */
  greeted?: boolean;
}
export interface DeployState {
  list: Deployment[];
  next: number;
}

export const deployOf = (s: GameState): DeployState => s.deploy ?? { list: [], next: 1 };

function capital(id: string) {
  return CITIES.find((c) => c.home === id && c.capital) ?? CITIES.find((c) => c.home === id)!;
}
/** 가는(오는) 데 걸리는 실제 시간: 수도 사이 거리(도) / 20, 1~6시간 */
export function travelMs(from: string, to: string): number {
  const a = capital(from);
  const b = capital(to);
  const deg = Math.hypot(a.x - b.x, a.y - b.y) / 6;
  return Math.round(Math.max(1, Math.min(6, deg / 20)) * 4) / 4 * HOUR;
}

function unitInfo(name: string): { power: number; money: number } {
  const u = UNIT_COST[name];
  if (u) return u;
  const sp = SPECIALS.find((d) => d.name === name);
  if (sp) return specialCost(sp.base, sp.cost);
  return { power: 5, money: 500 };
}
export const unitsPower = (units: Record<string, number>) => Object.entries(units).reduce((a, [n, k]) => a + unitInfo(n).power * k, 0);
export const unitsMoney = (units: Record<string, number>) => Object.entries(units).reduce((a, [n, k]) => a + unitInfo(n).money * k, 0);
export const unitsCount = (units: Record<string, number>) => Object.values(units).reduce((a, k) => a + k, 0);

/** 받아 줄 수 있는 나라인가 */
export function canHost(s: GameState, to: string): string | null {
  const me = s.player.countryId;
  if (to === me) return '우리나라예요';
  if (!isAlive(s.world, to)) return '없어진 나라예요';
  const rel = relationOf(s.world, me, to);
  if (rel === '전쟁') return '전쟁 중인 나라예요';
  if (rel !== '연합' && favorOf(s, to) < DEPLOY_FAVOR) return `연합국이거나 호감 ${DEPLOY_FAVOR} 이상이어야 받아 줘요`;
  return null;
}
export function canDeploy(s: GameState, to: string, units: Record<string, number>): string | null {
  const h = canHost(s, to);
  if (h) return h;
  const d = deployOf(s);
  if (d.list.filter((x) => !x.returnMs).length >= DEPLOY_MAX) return `파병은 한 번에 ${DEPLOY_MAX}곳까지`;
  if (d.list.some((x) => x.to === to && !x.returnMs)) return '이미 파병 중인 나라예요';
  if (!unitsCount(units)) return '보낼 부대를 고르세요';
  for (const [n, k] of Object.entries(units)) if ((s.economy.army[n] ?? 0) < k) return `${n}가 모자라요`;
  return null;
}

function log(s: GameState, text: string): GameState {
  const ev: WorldEvent = { t: s.worldMs, kind: '외교', text, mine: true };
  return { ...s, world: { ...s.world, events: [ev, ...s.world.events].slice(0, 150) } };
}

export function deployTroops(s: GameState, to: string, units: Record<string, number>): GameState {
  if (canDeploy(s, to, units)) return s;
  const clean = Object.fromEntries(Object.entries(units).filter(([, k]) => k > 0));
  const army = { ...s.economy.army };
  for (const [n, k] of Object.entries(clean)) army[n] -= k;
  const d = deployOf(s);
  const dep: Deployment = { id: d.next, to, units: clean, arriveMs: s.worldMs + travelMs(s.player.countryId, to), lost: 0 };
  const ns: GameState = {
    ...s,
    economy: { ...s.economy, army, power: Math.max(0, s.economy.power - unitsPower(clean)) },
    deploy: { list: [...d.list, dep], next: d.next + 1 },
  };
  return log(ns, `🪖 ${countryById(to).name}에 부대 ${unitsCount(clean)}개를 파병했어요. ${Math.round((dep.arriveMs - s.worldMs) / HOUR * 10) / 10}시간 뒤 도착해요.`);
}

export function recallTroops(s: GameState, id: number): GameState {
  const d = deployOf(s);
  const dep = d.list.find((x) => x.id === id);
  if (!dep || dep.returnMs) return s;
  // 아직 가는 중이면 간 만큼만 돌아옴
  const back = s.worldMs < dep.arriveMs ? travelMs(s.player.countryId, dep.to) - (dep.arriveMs - s.worldMs) : travelMs(s.player.countryId, dep.to);
  const list = d.list.map((x) => (x.id === id ? { ...x, returnMs: s.worldMs + Math.max(0, back) } : x));
  return log({ ...s, deploy: { ...d, list } }, `🪖 ${countryById(dep.to).name} 파병 부대를 불러들였어요.`);
}

/** 도착해서 머무는 파병 */
export const stationed = (s: GameState) => deployOf(s).list.filter((x) => !x.returnMs && s.worldMs >= x.arriveMs);

/** 나라별 도시 방어 배율(파병 부대가 지켜 줌) */
export function deployHelp(s: GameState): Record<string, number> {
  const out: Record<string, number> = {};
  for (const x of stationed(s)) out[x.to] = (out[x.to] ?? 1) * (1 + Math.min(0.4, unitsPower(x.units) / 150));
  return out;
}

/** 시간당 유지비(국방예산) */
export const upkeepPerHour = (s: GameState) => stationed(s).reduce((a, x) => a + unitsMoney(x.units) * UPKEEP * 4, 0);

/** AI 판단마다: 도착·귀국·유지비·전쟁 피해 */
export function deployTick(s: GameState): GameState {
  if (!s.deploy?.list.length) return s;
  let ns = s;
  const me = s.player.countryId;
  const rng = new Rng((s.world.seed ^ Math.floor(s.worldMs / 1000)) >>> 0);
  const army = { ...s.economy.army };
  let power = s.economy.power;
  const keep: Deployment[] = [];
  let money = 0;
  for (const x0 of s.deploy.list) {
    const x = { ...x0, units: { ...x0.units } };
    if (x.returnMs && s.worldMs >= x.returnMs) {
      for (const [n, k] of Object.entries(x.units)) army[n] = (army[n] ?? 0) + k;
      power += unitsPower(x.units);
      ns = log(ns, `🪖 ${countryById(x.to).name} 파병 부대 ${unitsCount(x.units)}개가 돌아왔어요.`);
      continue;
    }
    // 그 나라가 없어지거나 우리와 전쟁이 나면 바로 귀국길
    if (!x.returnMs && (!isAlive(s.world, x.to) || relationOf(s.world, me, x.to) === '전쟁')) {
      x.returnMs = s.worldMs + travelMs(me, x.to);
      ns = log(ns, `🪖 ${countryById(x.to).name}에서 철수해요.`);
    }
    if (!x.returnMs && s.worldMs >= x.arriveMs) {
      if (!x.greeted) {
        ns = addFavorNote(ns, x.to, '우리 땅에 파병해 줌', 15);
        x.greeted = true;
        ns = log(ns, `🪖 파병 부대가 ${countryById(x.to).name}에 도착했어요. 호감 +15`);
      }
      money += unitsMoney(x.units) * UPKEEP;
      const atWar = Object.keys(s.world.pairs).some((k) => k.split('|').includes(x.to) && s.world.pairs[k].rel === '전쟁');
      if (atWar && rng.chance(LOSS_CHANCE)) {
        const names = Object.keys(x.units).filter((n) => x.units[n] > 0);
        const n = names[Math.floor(rng.next() * names.length)];
        if (n) {
          x.units[n] -= 1;
          if (!x.units[n]) delete x.units[n];
          x.lost += 1;
          ns = log(ns, `🪖 ${countryById(x.to).name} 전선에서 ${n} 1개를 잃었어요. 동맹을 지킨 공로로 명성 +2`);
          ns = { ...ns, officer: { ...ns.officer, fame: ns.officer.fame + 2 } };
        }
      }
      if (!unitsCount(x.units)) {
        ns = log(ns, `🪖 ${countryById(x.to).name} 파병 부대가 모두 쓰러졌어요.`);
        continue;
      }
    }
    keep.push(x);
  }
  const treasury = Math.max(0, ns.nations[me].treasury - money);
  return {
    ...ns,
    nations: { ...ns.nations, [me]: { ...ns.nations[me], treasury } },
    economy: { ...ns.economy, army, power },
    deploy: { ...s.deploy, list: keep },
  };
}

/** 파병된 부대 수(병과별, 가는 중·머무는 중·오는 중 모두) */
export function awayUnits(s: GameState): Record<string, number> {
  const out: Record<string, number> = {};
  for (const x of deployOf(s).list) for (const [n, k] of Object.entries(x.units)) out[n] = (out[n] ?? 0) + k;
  return out;
}
