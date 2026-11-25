// 가속권: 기다리는 모든 일(임무·심부름·내정 일·시설 공사·부대 생산·대전투 준비·청문회·
// 체제 혼란도 줄일 수 있음(11-24).
// 연구·도시 구역·채굴장·문화 시설·첩보 공작·장군 교육·부처 업무·법안 표결·파병 이동) 시간을 줄임.
// 한 장 = 실제 30분. 가속권이 모자라면 모자란 장수만큼 루비로 냄(1장 = 💎5, 상점 값과 같음, 11-24).
import type { GameState } from './state';
import { hearingNow } from './cabinetOps';
import { addResearch, civOf, researchRate, techLeft } from './civ';
import { techById } from '../data/civ';
import { rubyOf } from './goals';

export const BOOST_MS = 30 * 60e3;
/** 가속권 1장 대신 내는 루비(상점 가속권 1장 값) */
export const RUBY_PER_BOOST = 5;
/** 시험판: 새 판·옛 저장에 주는 가속권 */
export const TEST_BOOSTS = 300;
const H = 3600e3;

export type BoostTarget =
  | { kind: 'mission' }
  | { kind: 'errand'; id: number }
  | { kind: 'chore' }
  | { kind: 'build'; fac: string }
  | { kind: 'queue'; id: number }
  | { kind: 'grand' }
  | { kind: 'hearing' }
  | { kind: 'research'; line: 'mil' | 'soc' }
  | { kind: 'district'; city: string; tile: string }
  | { kind: 'mine'; city: string; tile: string }
  | { kind: 'venue'; venue: string }
  | { kind: 'spy'; id: number }
  | { kind: 'school'; id: number }
  | { kind: 'task'; min: string }
  | { kind: 'minUp'; min: string }
  | { kind: 'vote' }
  | { kind: 'deploy'; id: number }
  | { kind: 'chaos' };

export const boostsOf = (s: GameState) => s.officer.boosts ?? 0;

/** 끝나는 시각(연구는 지금 속도로 계산). 없으면 undefined */
function endOf(s: GameState, t: BoostTarget): number | undefined {
  switch (t.kind) {
    case 'mission':
      return s.officer.active?.endMs;
    case 'errand':
      return s.officer.aides.find((a) => a.id === t.id)?.errand?.endMs;
    case 'chore':
      return s.economy.chore?.endMs;
    case 'build':
      return (s.economy.buildings as Record<string, { buildEndMs: number }>)[t.fac]?.buildEndMs || undefined;
    case 'queue':
      return s.economy.queue.find((q) => q.id === t.id)?.endMs;
    case 'grand':
      return s.officer.grandReadyMs;
    case 'hearing':
      return s.cabinet?.hearing?.endMs;
    case 'research': {
      const id = s.civ ? civOf(s).cur[t.line] : null;
      const tech = id ? techById(id) : undefined;
      if (!tech) return undefined;
      return s.worldMs + (techLeft(s, tech) / Math.max(0.01, researchRate(s))) * H;
    }
    case 'district':
      return s.civ?.cities[t.city]?.districts.find((d) => d.tile === t.tile)?.doneMs;
    case 'mine':
      return s.civ?.cities[t.city]?.mines?.find((m) => m.tile === t.tile)?.doneMs;
    case 'venue':
      return s.culture?.builds.find((b) => b.venue === t.venue)?.endMs;
    case 'spy':
      return s.spy?.active.find((m) => m.id === t.id)?.endMs;
    case 'school':
      return s.officer.aides.find((a) => a.id === t.id)?.school?.endMs;
    case 'task':
      return (s.cabinet?.tasks as Record<string, { endMs: number } | undefined> | undefined)?.[t.min]?.endMs;
    case 'minUp':
      return (s.cabinet?.minUp as Record<string, number> | undefined)?.[t.min] || undefined;
    case 'vote':
      return s.assembly?.vote?.endMs;
    case 'chaos': {
      const u = s.civ?.chaosUntil ?? 0;
      return u > s.worldMs ? u : undefined;
    }
    case 'deploy': {
      const d = s.deploy?.list.find((x) => x.id === t.id);
      return d ? (d.returnMs ?? d.arriveMs) : undefined;
    }
  }
}

/** 남은 시간(ms). 없거나 끝났으면 0 */
export function boostLeft(s: GameState, t: BoostTarget): number {
  const end = endOf(s, t);
  return end ? Math.max(0, end - s.worldMs) : 0;
}

/** 다 끝내는 데 드는 가속권 수 */
export const boostsToFinish = (s: GameState, t: BoostTarget) => Math.ceil(boostLeft(s, t) / BOOST_MS);

/** n장을 쓸 때 내는 것: 가속권 먼저, 모자라면 루비 */
export function boostPrice(s: GameState, n: number): { boosts: number; ruby: number } {
  const b = Math.min(n, boostsOf(s));
  return { boosts: b, ruby: (n - b) * RUBY_PER_BOOST };
}
/** 가속권+루비로 낼 수 있는 최대 장수 */
export const boostsAffordable = (s: GameState) => boostsOf(s) + Math.floor(rubyOf(s) / RUBY_PER_BOOST);

/** 가속권 n장 사용(남은 시간보다 많이 쓰지 않음, 모자라면 루비로) */
export function useBoost(s: GameState, t: BoostTarget, n: number): GameState {
  const left = boostLeft(s, t);
  const k = Math.min(n, boostsAffordable(s), Math.ceil(left / BOOST_MS));
  if (k <= 0) return s;
  const cut = Math.min(left, k * BOOST_MS);
  const pay = boostPrice(s, k);
  const o = { ...s.officer, boosts: boostsOf(s) - pay.boosts };
  let ns: GameState = { ...s, officer: o };
  if (pay.ruby && s.goals) ns = { ...ns, goals: { ...s.goals, ruby: s.goals.ruby - pay.ruby } };
  let e = ns.economy;
  const minus = (v: number) => v - cut;
  if (t.kind === 'mission' && o.active) o.active = { ...o.active, endMs: o.active.endMs - cut, startMs: o.active.startMs - cut };
  if (t.kind === 'errand') o.aides = o.aides.map((a) => (a.id === t.id && a.errand ? { ...a, errand: { ...a.errand, endMs: a.errand.endMs - cut } } : a));
  if (t.kind === 'school') o.aides = o.aides.map((a) => (a.id === t.id && a.school ? { ...a, school: { endMs: a.school.endMs - cut } } : a));
  if (t.kind === 'grand') o.grandReadyMs -= cut;
  if (t.kind === 'chore' && e.chore) e = { ...e, chore: { ...e.chore, endMs: e.chore.endMs - cut } };
  if (t.kind === 'build') {
    const f = (e.buildings as Record<string, { buildEndMs: number }>)[t.fac];
    e = { ...e, buildings: { ...e.buildings, [t.fac]: { ...f, buildEndMs: f.buildEndMs - cut } } };
  }
  if (t.kind === 'queue') {
    // 줄에서 뒤에 선 것들도 같이 당겨짐
    const i = e.queue.findIndex((q) => q.id === t.id);
    e = { ...e, queue: e.queue.map((q, j) => (j < i ? q : j === i ? { ...q, endMs: q.endMs - cut } : { ...q, startMs: q.startMs - cut, endMs: q.endMs - cut })) };
  }
  ns = { ...ns, economy: e };
  // 청문회(11-24): 줄인 만큼 당기고, 다 줄였으면 바로 결과
  if (t.kind === 'hearing' && s.cabinet?.hearing) {
    ns = { ...ns, cabinet: { ...s.cabinet, hearing: { ...s.cabinet.hearing, endMs: minus(s.cabinet.hearing.endMs) } } };
    ns = hearingNow(ns);
  }
  // 연구: 줄인 시간만큼의 연구 점수를 바로 넣음(남은 점수보다 많이 넣지 않음)
  if (t.kind === 'research') {
    const tech = techById(civOf(s).cur[t.line]!)!;
    const pts = left - cut <= 0 ? techLeft(s, tech) : Math.min(techLeft(s, tech), (researchRate(s) * cut) / H);
    ns = addResearch(ns, t.line, pts);
  }
  if ((t.kind === 'district' || t.kind === 'mine') && s.civ) {
    const cc = s.civ.cities[t.city];
    const city =
      t.kind === 'district'
        ? { ...cc, districts: cc.districts.map((d) => (d.tile === t.tile ? { ...d, doneMs: minus(d.doneMs) } : d)) }
        : { ...cc, mines: cc.mines?.map((m) => (m.tile === t.tile ? { ...m, doneMs: minus(m.doneMs) } : m)) };
    ns = { ...ns, civ: { ...s.civ, cities: { ...s.civ.cities, [t.city]: city } } };
  }
  if (t.kind === 'venue' && s.culture) ns = { ...ns, culture: { ...s.culture, builds: s.culture.builds.map((b) => (b.venue === t.venue ? { ...b, endMs: minus(b.endMs) } : b)) } };
  if (t.kind === 'spy' && s.spy) ns = { ...ns, spy: { ...s.spy, active: s.spy.active.map((m) => (m.id === t.id ? { ...m, endMs: minus(m.endMs), startMs: minus(m.startMs) } : m)) } };
  if (t.kind === 'task' && s.cabinet) {
    const tasks = s.cabinet.tasks as Record<string, { task: string; endMs: number }>;
    ns = { ...ns, cabinet: { ...s.cabinet, tasks: { ...tasks, [t.min]: { ...tasks[t.min], endMs: minus(tasks[t.min].endMs) } } } };
  }
  if (t.kind === 'minUp' && s.cabinet?.minUp) {
    const up = s.cabinet.minUp as Record<string, number>;
    ns = { ...ns, cabinet: { ...s.cabinet, minUp: { ...up, [t.min]: minus(up[t.min]) } } };
  }
  // 체제 혼란(11-24): 줄인 만큼 일찍 끝남
  if (t.kind === 'chaos' && s.civ) ns = { ...ns, civ: { ...s.civ, chaosUntil: minus(s.civ.chaosUntil) } };
  if (t.kind === 'vote' && s.assembly?.vote) ns = { ...ns, assembly: { ...s.assembly, vote: { ...s.assembly.vote, endMs: minus(s.assembly.vote.endMs) } } };
  if (t.kind === 'deploy' && s.deploy)
    ns = { ...ns, deploy: { ...s.deploy, list: s.deploy.list.map((x) => (x.id !== t.id ? x : x.returnMs ? { ...x, returnMs: minus(x.returnMs) } : { ...x, arriveMs: minus(x.arriveMs) })) } };
  return ns;
}
