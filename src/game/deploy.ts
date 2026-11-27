// 해외 파병(11/24 대장 요청 "해외파병도 외교에 구현"). 외교 → 파병 탭.
// 내가 만든 부대를 연합국·친한 나라로 보냄: 도착하면 그 나라 호감↑, 그 나라 도시 방어↑(전투력만큼, 최대 +40%).
// 그 나라가 전쟁 중이면 가끔 부대를 잃고 명성을 얻음. 머무는 동안 나라 예산에서 유지비. 부르면 돌아옴.
import { CITIES } from '../data/cities';
import { UNIT_COST, specialCost } from '../data/economy';
import { SPECIALS } from '../data/specials';
import { countryById } from '../data/world';
import { BRANCH_NAME, CLASHES, MODE_NAME, MODE_NEED, clashById, isRegion, kindsFor, regionById, REGIONS, requestKindById, type Branch, type Clash } from '../data/deployOps';
import { MAP_DOMAIN, baseUnit } from '../data/forces';
import { BRANCH_KINDS } from '../data/deployOps';
import { fieldById } from '../battle3d/pick';
import type { BattlePlan } from '../battle/spec';
import { addFavorNote, favorOf } from './civ';
import { subtractDead, takenText } from './losses';
import { Rng } from './rng';
import type { GameState } from './state';
import { addDef } from './defFund';
import { priceBase } from './state';
import { actOf } from './balance';
import { isAlive, relationOf, type WorldEvent } from './world';

const HOUR = 3600e3;
/** 11/28 디자인 개편 6단계: 파병 칸 7칸. 처음 5칸, 2막에 6칸, 3막에 7칸 */
export const DEPLOY_MAX = 7;
export const DEPLOY_BASE = 5;
export const deployMax = (s: GameState) => Math.min(DEPLOY_MAX, DEPLOY_BASE + (actOf(s.world) >= 2 ? 1 : 0) + (actOf(s.world) >= 3 ? 1 : 0));
/** 은혜: 실제 이만큼 머물 때마다 그 나라에 +1(최대 OWE_MAX) */
export const OWE_EVERY = 6 * 3600e3;
export const OWE_MAX = 10;
/** 은혜 1마다 그 나라 무역 값 −1% */
export const OWE_TRADE = 0.01;
/** 재건 계약: 전쟁이 끝나면 은혜 × 나라 기준값 × 이만큼 */
export const REBUILD_MULT = 0.6;
/** 실제 이만큼 넘게 머물면 지쳐서 도시 방어 도움이 절반(교대하면 회복) */
export const TIRED_MS = 48 * 3600e3;
/** 연합이 아니면 이만큼 호감이 있어야 받아 줌 */
export const DEPLOY_FAVOR = 30;
/** AI 판단(15분)마다 유지비: 부대 값의 0.04%(11-26 대장 "1/10로") */
const UPKEEP = 0.0004;
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
  /** 11-26 파병 요청을 받아 간 곳: 요청 종류 · 임무가 끝나는 시각 */
  req?: { kind: string; endMs: number };
  /** 11-26 지금 벌어진 교전(전투하러 가거나, 시간이 지나면 현지 부대가 알아서 싸움) */
  clash?: { id: string; untilMs: number; seed: number };
  /** 교전에서 이긴 횟수 */
  wins?: number;
  /** 11-28 지금까지 쓴 유지비(국방비) */
  spent?: number;
  /** 머무는 동안 그 나라가 전쟁을 했는가(끝나면 재건 계약) */
  warSeen?: boolean;
  /** 은혜를 마지막으로 쌓은 시각 */
  oweMs?: number;
}
/** 11-26 다른 나라·바다에서 온 파병 요청 */
export interface DeployRequest {
  id: number;
  region: string;
  kind: string;
  untilMs: number;
}
export interface DeployState {
  list: Deployment[];
  next: number;
  requests?: DeployRequest[];
  /** 11-28 은혜 장부: 나라 → 은혜(파병해 준 만큼 쌓임) */
  owe?: Record<string, number>;
  /** 재건 계약으로 받은 돈 합계 */
  rebuilt?: number;
}
export const oweOf = (s: GameState, id: string) => deployOf(s).owe?.[id] ?? 0;
function addOwe(s: GameState, id: string, v: number): GameState {
  const d = deployOf(s);
  return { ...s, deploy: { ...d, owe: { ...(d.owe ?? {}), [id]: Math.min(OWE_MAX, (d.owe?.[id] ?? 0) + v) } } };
}
/** 지친 파병인가(오래 머묾) */
export const tired = (s: GameState, x: Deployment) => !x.returnMs && s.worldMs - x.arriveMs > TIRED_MS;
/** 재건 계약 예상 돈(그 나라가 지금 전쟁 중일 때) */
export const rebuildValue = (s: GameState, id: string) => Math.round(priceBase(s) * oweOf(s, id) * REBUILD_MULT);
/** 한 번에 열려 있는 요청 수 · 요청이 기다리는 시간 · 판단(15분)마다 새 요청 확률 */
export const REQ_MAX = 4;
const REQ_WAIT = 10 * HOUR;
const REQ_CHANCE = 0.14;
/** 주둔 부대마다 판단(15분)마다 교전이 생길 확률 · 교전 결정 시간 */
const CLASH_CHANCE = 0.07;
export const CLASH_WAIT = 4 * HOUR;

/** 파병지 이름(13개국 또는 요청 지역) */
export const placeName = (id: string) => (isRegion(id) ? regionById(id)?.name ?? '해외' : countryById(id).name);
/** 부대 이름 → 병과(육·해·공) */
export const branchOf = (name: string): Branch => (baseUnit(name) === '미사일' ? 'air' : ((MAP_DOMAIN[baseUnit(name)] ?? 'land') as Branch));
export function branchesOf(units: Record<string, number>): Branch[] {
  const out = new Set<Branch>();
  for (const [n, k] of Object.entries(units)) if (k > 0) out.add(branchOf(n));
  return [...out];
}
/** 이 파병 부대로 치를 수 있는 교전인가(병과가 모두 있고, 지역 성격이 맞음) */
export function clashFits(c: Clash, dep: Pick<Deployment, 'to' | 'units'>): boolean {
  const br = branchesOf(dep.units);
  if (!MODE_NEED[c.mode].every((b) => br.includes(b))) return false;
  if (!isRegion(dep.to)) return true;
  const r = regionById(dep.to);
  return !!r && c.tags.some((t) => r.tags.includes(t));
}

export const deployOf = (s: GameState): DeployState => s.deploy ?? { list: [], next: 1 };

function capital(id: string) {
  return CITIES.find((c) => c.home === id && c.capital) ?? CITIES.find((c) => c.home === id)!;
}
/** 가는(오는) 데 걸리는 실제 시간: 수도 사이 거리(도) / 20, 1~6시간 */
export function travelMs(from: string, to: string): number {
  if (isRegion(to) || isRegion(from)) {
    // 요청 지역: 이름으로 정한 1.5~4시간
    const id = isRegion(to) ? to : from;
    const h = [...id].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) >>> 0, 7);
    return (1.5 + (h % 11) * 0.25) * HOUR;
  }
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

/** 파병 칸을 차지하는 곳(돌아오는 중인 부대는 빼고 셈) */
export const activeDeploys = (s: GameState) => deployOf(s).list.filter((x) => !x.returnMs).length;
/** 요청 지역이 지금은 정식 나라와 같은 곳이면 그 나라 id(11-28: 필리핀·폴란드·핀란드·콜롬비아 등) */
export const REGION_NATION: Record<string, string> = { 'r-philippines': 'ph', 'r-poland': 'pl', 'r-finland': 'fi', 'r-colombia': 'co' };
/** 이 요청 지역을 우리에게 보여 줘도 되나: 내 나라이거나, 전쟁 중인 나라 땅이면 안 됨 */
export function regionOk(s: GameState, region: string): boolean {
  const me = s.player.countryId;
  const n = REGION_NATION[region];
  if (n && (n === me || !isAlive(s.world, n) || relationOf(s.world, me, n) === '전쟁')) return false;
  const f = regionById(region)?.friend;
  if (f && (f === me || relationOf(s.world, me, f) === '전쟁')) return false;
  return true;
}

/** 받아 줄 수 있는 나라인가(요청 지역은 요청이 와 있어야) */
export function canHost(s: GameState, to: string): string | null {
  if (isRegion(to)) {
    if (!regionOk(s, to)) return '지금은 보낼 수 없는 곳이에요(우리나라이거나 전쟁 중인 나라)';
    return openRequests(s).some((r) => r.region === to) ? null : '파병 요청이 온 곳에만 보낼 수 있어요';
  }
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
  if (activeDeploys(s) >= deployMax(s)) return `파병은 지금 한 번에 ${deployMax(s)}곳까지${deployMax(s) < DEPLOY_MAX ? ' (다음 막에서 칸이 늘어요)' : ''}`;
  if (d.list.some((x) => x.to === to && !x.returnMs)) return '이미 파병 중인 곳이에요';
  if (!unitsCount(units)) return '보낼 부대를 고르세요';
  for (const [n, k] of Object.entries(units)) if ((s.economy.army[n] ?? 0) < k) return `${n}가 모자라요`;
  return null;
}

function log(s: GameState, text: string): GameState {
  const ev: WorldEvent = { t: s.worldMs, kind: '외교', text, mine: true };
  return { ...s, world: { ...s.world, events: [ev, ...s.world.events].slice(0, 150) } };
}

export function deployTroops(s: GameState, to: string, units: Record<string, number>, req?: { kind: string; hours: number }): GameState {
  if (canDeploy(s, to, units)) return s;
  const clean = Object.fromEntries(Object.entries(units).filter(([, k]) => k > 0));
  const army = { ...s.economy.army };
  for (const [n, k] of Object.entries(clean)) army[n] -= k;
  const d = deployOf(s);
  const arriveMs = s.worldMs + travelMs(s.player.countryId, to);
  const dep: Deployment = { id: d.next, to, units: clean, arriveMs, lost: 0, ...(req ? { req: { kind: req.kind, endMs: arriveMs + req.hours * HOUR } } : {}) };
  const ns: GameState = {
    ...s,
    economy: { ...s.economy, army, power: Math.max(0, s.economy.power - unitsPower(clean)) },
    deploy: { ...d, list: [...d.list, dep], next: d.next + 1 },
  };
  return log(ns, `🪖 ${placeName(to)}에 부대 ${unitsCount(clean)}개를 파병했어요. ${Math.round((dep.arriveMs - s.worldMs) / HOUR * 10) / 10}시간 뒤 도착해요.`);
}

/* ───────── 11-26 파병 요청 ───────── */

/** 아직 기다리는 요청 */
export const openRequests = (s: GameState) => (deployOf(s).requests ?? []).filter((r) => r.untilMs > s.worldMs && regionOk(s, r.region));

/** 요청을 받아들일 수 있나(병과가 맞아야) */
export function canAccept(s: GameState, reqId: number, units: Record<string, number>): string | null {
  const r = openRequests(s).find((x) => x.id === reqId);
  if (!r) return '이미 지난 요청이에요';
  const k = requestKindById(r.kind);
  const br = branchesOf(units);
  const miss = (k?.need ?? []).filter((b) => !br.includes(b));
  if (miss.length) return `${miss.map((b) => BRANCH_NAME[b]).join('·')} 부대가 꼭 있어야 해요`;
  return canDeploy(s, r.region, units);
}

/** 요청을 받아 파병(끝나면 보상) */
export function acceptRequest(s: GameState, reqId: number, units: Record<string, number>): GameState {
  if (canAccept(s, reqId, units)) return s;
  const r = openRequests(s).find((x) => x.id === reqId)!;
  const k = requestKindById(r.kind)!;
  const ns = deployTroops(s, r.region, units, { kind: r.kind, hours: k.hours });
  const d = deployOf(ns);
  return { ...ns, deploy: { ...d, requests: (d.requests ?? []).filter((x) => x.id !== reqId) } };
}

export function declineRequest(s: GameState, reqId: number): GameState {
  const d = deployOf(s);
  return { ...s, deploy: { ...d, requests: (d.requests ?? []).filter((x) => x.id !== reqId) } };
}

/** 새 요청 하나(이미 요청·파병 중인 곳은 빼고) */
function newRequest(s: GameState, rng: Rng): DeployRequest | null {
  const d = deployOf(s);
  const busy = new Set([...(d.requests ?? []).map((r) => r.region), ...d.list.map((x) => x.to)]);
  const free = REGIONS.filter((r) => !busy.has(r.id) && regionOk(s, r.id));
  if (!free.length) return null;
  const region = rng.pick(free);
  const kind = rng.pick(kindsFor(region));
  return { id: d.next, region: region.id, kind: kind.id, untilMs: s.worldMs + REQ_WAIT };
}

/* ───────── 11-26 파병 교전 ───────── */

/** 지금 교전이 벌어진 파병 */
export const clashes = (s: GameState) => deployOf(s).list.filter((x) => x.clash && x.clash.untilMs > s.worldMs && !x.returnMs);

/** 이 파병지 교전 알림 글 */
export function clashText(dep: Deployment): string {
  const c = dep.clash && clashById(dep.clash.id);
  if (!c) return '';
  const br = MODE_NEED[c.mode].map((b) => BRANCH_NAME[b]).join('·');
  return c.text.replaceAll('{곳}', placeName(dep.to)).replaceAll("{병과}", `우리 ${br} 부대`);
}
export const clashModeName = (dep: Deployment) => {
  const c = dep.clash && clashById(dep.clash.id);
  return c ? MODE_NAME[c.mode] : '';
};

/** 교전 결과(직접 싸움 · 맡김 · 시간 지남) → 보상·손실 */
/** dead = 직접 싸운 3D 전투에서 쓰러진 부대(있으면 그만큼 파병 부대에서 빠짐, 없으면 지면 1~2개) */
export function settleClash(s: GameState, depId: number, win: boolean, stars: number, how: '직접' | '맡김' | '현지', dead?: Record<string, number>): { state: GameState; text: string } {
  const d = deployOf(s);
  const dep = d.list.find((x) => x.id === depId);
  const c = dep?.clash && clashById(dep.clash.id);
  if (!dep || !c) return { state: s, text: '이미 끝난 교전이에요.' };
  const me = s.player.countryId;
  let ns = s;
  let text: string;
  let units = { ...dep.units };
  let lost = 0;
  let deadText = '';
  if (dead) {
    const r = subtractDead(units, dead);
    units = r.units;
    lost = Object.values(r.taken).reduce((a, b) => a + b, 0);
    if (lost) deadText = ` 🪦 잃은 부대: ${takenText(r.taken)}`;
  }
  if (win) {
    const money = c.money * Math.max(1, stars);
    const fame = c.fame + (stars >= 3 ? 2 : 0);
    ns = { ...ns, nations: { ...ns.nations, [me]: { ...ns.nations[me], treasury: ns.nations[me].treasury + money } }, officer: { ...ns.officer, fame: ns.officer.fame + fame } };
    const friend = isRegion(dep.to) ? regionById(dep.to)?.friend : dep.to;
    if (friend) ns = addFavorNote(ns, friend, `${placeName(dep.to)}에서 ${c.title}을(를) 막아 줌`, 5 + stars);
    text = `⚔️ ${placeName(dep.to)} ${c.title}: 승리! 나라 예산 +${money.toLocaleString('ko-KR')} · 명성 +${fame}${friend ? ' · 호감↑' : ''}`;
  } else if (dead) {
    text = `⚔️ ${placeName(dep.to)} ${c.title}: 패배…`;
  } else {
    // 지면 파병 부대 하나(현지에서 알아서 싸워 지면 둘)를 잃음
    const n = how === '현지' ? 2 : 1;
    for (let i = 0; i < n; i++) {
      const names = Object.keys(units).filter((u) => units[u] > 0 && MODE_NEED[c.mode].includes(branchOf(u)));
      const u = names[(depId + i) % Math.max(1, names.length)];
      if (!u) break;
      units[u] -= 1;
      if (!units[u]) delete units[u];
      lost += 1;
    }
    text = `⚔️ ${placeName(dep.to)} ${c.title}: 패배… 부대 ${lost}개를 잃었어요.`;
  }
  if (how === '현지') text = `${text} (결정이 늦어 현지 부대가 알아서 싸웠어요)`;
  text += deadText;
  const left = unitsCount(units);
  const list = d.list
    .map((x) => (x.id === depId ? { ...x, units, lost: x.lost + lost, clash: undefined, wins: (x.wins ?? 0) + (win ? 1 : 0) } : x))
    .filter((x) => x.id !== depId || left > 0);
  ns = { ...ns, deploy: { ...deployOf(ns), list } };
  if (!left) text += ' 파병 부대가 모두 쓰러졌어요.';
  return { state: log(ns, text), text };
}

/** 교전 → 3D 전투 한 판(전장 · 전투 모양에 맞는 병과만) */
export function clashPlan(dep: Deployment): BattlePlan | null {
  const c = dep.clash && clashById(dep.clash.id);
  if (!c || !dep.clash) return null;
  const st = fieldById(c.field);
  const mk = MODE_NEED[c.mode].flatMap((b) => BRANCH_KINDS[b]);
  const kinds = st.kinds ? st.kinds.filter((k) => mk.includes(k)) : mk;
  const title = `${placeName(dep.to)} · ${c.title}`;
  return {
    title,
    source: 'deploy',
    mainIdx: 0,
    deploy: { dep: dep.id, clash: c.id },
    intro: `${c.icon} ${MODE_NAME[c.mode]} · ${clashText(dep)}`,
    stages: [{ frame: 'b3d', variant: c.field, title, label: MODE_NAME[c.mode], difficulty: 1, seed: dep.clash.seed, kinds, ...(c.budget ? { budget: c.budget } : {}) }],
  };
}

/** 맡기기·시간 지남: 부대 전투력으로 이길 확률 */
export function autoClashOdds(dep: Deployment): number {
  return Math.max(0.35, Math.min(0.85, 0.35 + unitsPower(dep.units) / 200));
}

export function recallTroops(s: GameState, id: number): GameState {
  const d = deployOf(s);
  const dep = d.list.find((x) => x.id === id);
  if (!dep || dep.returnMs) return s;
  // 아직 가는 중이면 간 만큼만 돌아옴
  const back = s.worldMs < dep.arriveMs ? travelMs(s.player.countryId, dep.to) - (dep.arriveMs - s.worldMs) : travelMs(s.player.countryId, dep.to);
  const list = d.list.map((x) => (x.id === id ? { ...x, returnMs: s.worldMs + Math.max(0, back), clash: undefined } : x));
  return log({ ...s, deploy: { ...d, list } }, `🪖 ${placeName(dep.to)} 파병 부대를 불러들였어요.${dep.req ? ' 요청 임무를 끝내지 못해 보상은 없어요.' : ''}`);
}

/** 도착해서 머무는 파병 */
export const stationed = (s: GameState) => deployOf(s).list.filter((x) => !x.returnMs && s.worldMs >= x.arriveMs);

/** 나라별 도시 방어 배율(파병 부대가 지켜 줌) */
export function deployHelp(s: GameState): Record<string, number> {
  const out: Record<string, number> = {};
  for (const x of stationed(s)) if (!isRegion(x.to)) out[x.to] = (out[x.to] ?? 1) * (1 + Math.min(0.4, unitsPower(x.units) / 150) * (tired(s, x) ? 0.5 : 1));
  return out;
}

/** 시간당 유지비(나라 예산) */
export const upkeepPerHour = (s: GameState) => stationed(s).reduce((a, x) => a + unitsMoney(x.units) * UPKEEP * 4, 0);

/** AI 판단마다: 요청 · 도착 · 임무 끝 · 교전 · 귀국 · 유지비 · 전쟁 피해 */
export function deployTick(s: GameState): GameState {
  let ns = s;
  const me = s.player.countryId;
  const rng = new Rng((s.world.seed ^ Math.floor(s.worldMs / 1000)) >>> 0);
  // 파병 요청: 자주 생김(판단마다 14%, 하나도 없으면 40%)
  {
    const d = deployOf(ns);
    const open = (d.requests ?? []).filter((r) => r.untilMs > s.worldMs);
    let reqs = open;
    let next = d.next;
    if (open.length < REQ_MAX && rng.chance(open.length ? REQ_CHANCE : 0.4)) {
      const r = newRequest(ns, rng);
      if (r) {
        reqs = [...open, r];
        next += 1;
        const k = requestKindById(r.kind)!;
        const reg = regionById(r.region)!;
        ns = log(ns, `📨 ${reg.icon} ${reg.name}에서 파병 요청이 왔어요: ${k.icon} ${k.name}. 외교 → 파병에서 볼 수 있어요.`);
      }
    }
    if (reqs !== d.requests || next !== d.next) ns = { ...ns, deploy: { ...d, requests: reqs, next } };
  }
  const dl = deployOf(ns);
  if (!dl.list.length) return ns;
  const army = { ...ns.economy.army };
  let power = ns.economy.power;
  const keep: Deployment[] = [];
  let money = 0;
  const later: Array<{ id: number; win: boolean }> = [];
  for (const x0 of dl.list) {
    const x = { ...x0, units: { ...x0.units } };
    const region = isRegion(x.to);
    if (x.returnMs && s.worldMs >= x.returnMs) {
      for (const [n, k] of Object.entries(x.units)) army[n] = (army[n] ?? 0) + k;
      power += unitsPower(x.units);
      ns = log(ns, `🪖 ${placeName(x.to)} 파병 부대 ${unitsCount(x.units)}개가 돌아왔어요.`);
      continue;
    }
    // 그 나라가 없어지거나 우리와 전쟁이 나면 바로 귀국길
    if (!region && !x.returnMs && (!isAlive(s.world, x.to) || relationOf(s.world, me, x.to) === '전쟁')) {
      x.returnMs = s.worldMs + travelMs(me, x.to);
      x.clash = undefined;
      ns = log(ns, `🪖 ${placeName(x.to)}에서 철수해요.`);
    }
    if (!x.returnMs && s.worldMs >= x.arriveMs) {
      if (!x.greeted) {
        x.greeted = true;
        if (region) {
          const f0 = regionById(x.to)?.friend;
          const f = f0 && f0 !== me && relationOf(ns.world, me, f0) !== '전쟁' ? f0 : undefined;
          if (f) ns = addFavorNote(ns, f, `${placeName(x.to)} 요청에 응해 파병함`, 8);
          ns = log(ns, `🪖 파병 부대가 ${placeName(x.to)}에 도착했어요.${f ? ` ${countryById(f).name} 호감 +8` : ''}`);
        } else {
          ns = addFavorNote(ns, x.to, '우리 땅에 파병해 줌', 15);
          ns = log(ns, `🪖 파병 부대가 ${placeName(x.to)}에 도착했어요. 호감 +15`);
        }
      }
      const up = unitsMoney(x.units) * UPKEEP;
      money += up;
      x.spent = (x.spent ?? 0) + up;
      if (!region) {
        // 11-28 은혜 장부 · 재건 계약
        if (s.worldMs - (x.oweMs ?? x.arriveMs) >= OWE_EVERY) {
          x.oweMs = s.worldMs;
          ns = addOwe(ns, x.to, 1);
        }
        const war = Object.keys(s.world.pairs).some((k) => k.split('|').includes(x.to) && s.world.pairs[k].rel === '전쟁');
        if (war) x.warSeen = true;
        else if (x.warSeen) {
          x.warSeen = false;
          const pay = rebuildValue(ns, x.to);
          if (pay > 0) {
            ns = { ...ns, nations: { ...ns.nations, [me]: { ...ns.nations[me], treasury: ns.nations[me].treasury + pay } } };
            ns = { ...ns, deploy: { ...deployOf(ns), rebuilt: (deployOf(ns).rebuilt ?? 0) + pay } };
            ns = log(ns, `🏗️ ${placeName(x.to)} 전쟁이 끝났어요. 함께 지켜 준 은혜로 재건 계약을 따냈어요! 나라 예산 +${pay.toLocaleString('ko-KR')}`);
          }
        }
      }
      // 교전: 시간이 지나면 현지 부대가 알아서 싸움
      if (x.clash && x.clash.untilMs <= s.worldMs) later.push({ id: x.id, win: rng.chance(autoClashOdds(x)) });
      else if (!x.clash && rng.chance(CLASH_CHANCE)) {
        const fit = CLASHES.filter((c) => clashFits(c, x));
        if (fit.length) {
          const c = rng.pick(fit);
          x.clash = { id: c.id, untilMs: s.worldMs + CLASH_WAIT, seed: Math.floor(rng.next() * 1e9) };
          ns = log(ns, `⚔️ ${clashText(x)}`);
        }
      }
      // 요청 임무 끝: 보상 받고 귀국길
      if (x.req && s.worldMs >= x.req.endMs && !x.clash) {
        const k = requestKindById(x.req.kind);
        if (k) {
          const f0 = regionById(x.to)?.friend;
          const f = f0 && f0 !== me && relationOf(ns.world, me, f0) !== '전쟁' ? f0 : undefined;
          ns = { ...ns, nations: { ...ns.nations, [me]: { ...ns.nations[me], treasury: ns.nations[me].treasury + k.money } }, officer: { ...ns.officer, fame: ns.officer.fame + k.fame } };
          if (f) ns = addOwe(addFavorNote(ns, f, `${placeName(x.to)} ${k.name} 임무를 마침`, 10), f, 2);
          ns = log(ns, `🎖️ ${placeName(x.to)} ${k.name} 임무를 마쳤어요! 나라 예산 +${k.money.toLocaleString('ko-KR')} · 명성 +${k.fame}${f ? ` · ${countryById(f).name} 호감 +10` : ''}. 부대가 돌아와요.`);
        }
        x.req = undefined;
        x.returnMs = s.worldMs + travelMs(me, x.to);
      }
      const atWar = !region && Object.keys(s.world.pairs).some((k) => k.split('|').includes(x.to) && s.world.pairs[k].rel === '전쟁');
      if (atWar && rng.chance(LOSS_CHANCE)) {
        const names = Object.keys(x.units).filter((n) => x.units[n] > 0);
        const n = names[Math.floor(rng.next() * names.length)];
        if (n) {
          x.units[n] -= 1;
          if (!x.units[n]) delete x.units[n];
          x.lost += 1;
          ns = log(ns, `🪖 ${placeName(x.to)} 전선에서 ${n} 1개를 잃었어요. 동맹을 지킨 공로로 명성 +2`);
          ns = { ...ns, officer: { ...ns.officer, fame: ns.officer.fame + 2 } };
        }
      }
      if (!unitsCount(x.units)) {
        ns = log(ns, `🪖 ${placeName(x.to)} 파병 부대가 모두 쓰러졌어요.`);
        continue;
      }
    }
    keep.push(x);
  }
  // 11-26 파병 유지비는 국방비에서
  ns = addDef(ns, -money);
  ns = {
    ...ns,
    economy: { ...ns.economy, army, power },
    deploy: { ...deployOf(ns), list: keep },
  };
  for (const l of later) ns = settleClash(ns, l.id, l.win, l.win ? 1 : 0, '현지').state;
  return ns;
}

/** 파병된 부대 수(병과별, 가는 중·머무는 중·오는 중 모두) */
export function awayUnits(s: GameState): Record<string, number> {
  const out: Record<string, number> = {};
  for (const x of deployOf(s).list) for (const [n, k] of Object.entries(x.units)) out[n] = (out[n] ?? 0) + k;
  return out;
}
