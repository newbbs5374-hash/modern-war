// 11-28 새 병과 2: ICBM — 전략군 사령부.
// 개발 4단계(연구 → 엔진 시험 → 시험 발사 2번 → 실전 배치). 시험 발사 때마다 세계 긴장·강대국 제재 위험.
// 배치한 수(최대 5기)만큼 억지력: AI가 우리에게 쳐들어오거나 긴장이 쌓이는 게 줄고, 깡패 국가 요구도 덜 옴(world.ts deterMul).
// 발사(두 번 확인): 재래식 탄두는 도시 방어를 크게 깎음. 핵탄두는 도시를 무력화하지만 모든 나라가 등을 돌리는 "쓰면 지는 무기".
import { CITIES, cityById } from '../data/cities';
import { COUNTRIES, countryById } from '../data/world';
import { addPresMod } from './approval';
import { addFavorNote } from './civ';
import { hegOf } from './hegemony';
import { pushReport } from './report';
import { Rng } from './rng';
import { priceBase, type GameState } from './state';
import { DEFAULT_ICBM, ICBM_MAX, eul, ga, icbmOf, isAlive, pairKey, relationOf, type WorldEvent } from './world';

const H = 3600e3;

export type StratStep = 'research' | 'engine' | 'test' | 'build' | 'nuke';
export const STEPS: Array<{ id: StratStep; name: string; icon: string; hours: number; cost: number; text: string }> = [
  { id: 'research', name: '연구', icon: '🔬', hours: 30, cost: 0.8, text: '탄도 궤적·재진입체를 연구해요.' },
  { id: 'engine', name: '엔진 시험', icon: '🔥', hours: 24, cost: 1, text: '고체 연료 엔진을 지상에서 태워 봐요.' },
  { id: 'test', name: '시험 발사', icon: '🚀', hours: 6, cost: 0.5, text: '바다로 쏴 봐요(2번). 세계가 지켜보고 강대국이 제재할 수 있어요.' },
  { id: 'build', name: '실전 배치', icon: '🏗️', hours: 24, cost: 0.6, text: '사일로에 한 기를 세워요(최대 5기).' },
  { id: 'nuke', name: '핵탄두 개발', icon: '☢️', hours: 48, cost: 2, text: '핵탄두를 만들어요. 모든 나라가 싫어하고 강대국 둘이 제재해요.' },
];
export const stepDef = (id: StratStep) => STEPS.find((x) => x.id === id)!;
export const TESTS_NEED = 2;
export const TEST_TENSION = 8;
export const TEST_FAVOR = -8;
export const TEST_SANCTION = 0.35;
export const FLIGHT_MS = 0.5 * H;
/** 나라별 요격 확률(미사일 방어망) */
export const INTERCEPT: Record<string, number> = { us: 0.45, il: 0.5, ru: 0.35, cn: 0.3, jp: 0.3, kr: 0.25, uk: 0.2, fr: 0.2, de: 0.15, in: 0.15, tw: 0.2, sa: 0.15, pl: 0.15 };
export const interceptOf = (id: string) => INTERCEPT[id] ?? 0.08;
export const CONV = { def: 0.4, troops: 0.97, favor: -20, others: -3, tension: 20, approval: -2 };
export const NUKE = { troops: 0.85, treasury: 0.9, favor: -60, approval: -25, approvalHours: 7 * 24, sanctions: 4, tension: 25 };

export interface Flight { id: number; city: string; warhead: 'conv' | 'nuke'; launchMs: number; arriveMs: number }
export interface StratState {
  /** 0 미착수 · 1 연구 끝 · 2 엔진 끝 · 3 시험 끝(배치 가능) */
  stage: number;
  tests: number;
  /** 지금 하는 일 */
  job?: { step: StratStep; endMs: number };
  deployed: number;
  nuke: boolean;
  flights: Flight[];
  launches: number;
  nukesUsed: number;
  nextId: number;
  seed: number;
}

export function stratOf(s: GameState): StratState {
  if (s.strat) return s.strat;
  const me = s.player.countryId;
  const have = DEFAULT_ICBM[me] ?? 0;
  // 실제 핵보유국은 처음부터 다 갖춘 채 시작
  return { stage: have ? 3 : 0, tests: have ? TESTS_NEED : 0, deployed: have, nuke: !!have, flights: [], launches: 0, nukesUsed: 0, nextId: 1, seed: (s.world.seed ^ 0x1cb4) >>> 0 };
}
export const stepCost = (s: GameState, id: StratStep) => Math.max(1000, Math.round(priceBase(s) * stepDef(id).cost));

/** 다음에 할 수 있는 개발 일 */
export function nextStep(st: StratState): StratStep | null {
  if (st.stage === 0) return 'research';
  if (st.stage === 1) return 'engine';
  if (st.stage === 2) return 'test';
  return null;
}
export function canStep(s: GameState, id: StratStep): string | null {
  const st = stratOf(s);
  if (st.job) return '사령부가 다른 일을 하는 중이에요';
  if (id === 'build') {
    if (st.stage < 3) return '시험 발사까지 끝내야 해요';
    if (st.deployed >= ICBM_MAX) return `최대 ${ICBM_MAX}기예요`;
  } else if (id === 'nuke') {
    if (st.stage < 3) return '시험 발사까지 끝내야 해요';
    if (st.nuke) return '이미 핵탄두가 있어요';
  } else if (nextStep(st) !== id) return '아직 이 단계가 아니에요';
  if (s.nations[s.player.countryId].treasury < stepCost(s, id)) return '나라 예산이 모자라요';
  return null;
}
export function startStep(s: GameState, id: StratStep): { state: GameState; text: string } {
  const why = canStep(s, id);
  if (why) return { state: s, text: why };
  const me = s.player.countryId;
  const d = stepDef(id);
  const cost = stepCost(s, id);
  const st = stratOf(s);
  const ns: GameState = {
    ...s,
    nations: { ...s.nations, [me]: { ...s.nations[me], treasury: s.nations[me].treasury - cost } },
    strat: { ...st, job: { step: id, endMs: s.worldMs + d.hours * H } },
  };
  return { state: ns, text: `${d.icon} ${d.name}을(를) 시작했어요(${d.hours}시간).` };
}

function event(s: GameState, text: string): GameState {
  const ev: WorldEvent = { t: s.worldMs, kind: '외교', text, mine: true };
  return { ...s, world: { ...s.world, events: [ev, ...s.world.events].slice(0, 200) } };
}
function addTension(s: GameState, a: string, b: string, v: number): GameState {
  const k = pairKey(a, b);
  const p = s.world.pairs[k];
  if (!p || p.rel === '전쟁' || p.rel === '연합') return s;
  return { ...s, world: { ...s.world, pairs: { ...s.world.pairs, [k]: { ...p, tension: Math.min(95, p.tension + v) } } } };
}
const POWERS = ['us', 'cn', 'ru', 'uk', 'fr', 'in'];
/** 우리와 연합이 아닌 살아 있는 강대국 */
function watchers(s: GameState): string[] {
  const me = s.player.countryId;
  return POWERS.filter((id) => id !== me && isAlive(s.world, id) && relationOf(s.world, me, id) !== '연합');
}
function sanction(s: GameState, from: string, rate: number, hours: number): GameState {
  const h = hegOf(s);
  const me = s.player.countryId;
  if (h.sanctions.some((x) => x.from === from && x.to === me && x.untilMs > s.worldMs)) return s;
  return { ...s, hegemony: { ...h, sanctions: [...h.sanctions, { from, to: me, rate, untilMs: s.worldMs + hours * H }] } };
}
function syncWorld(s: GameState): GameState {
  const st = stratOf(s);
  const me = s.player.countryId;
  return { ...s, world: { ...s.world, icbm: { ...(s.world.icbm ?? DEFAULT_ICBM), [me]: st.deployed } } };
}

function finishJob(s: GameState): GameState {
  const st = stratOf(s);
  const job = st.job!;
  const me = s.player.countryId;
  const rng = new Rng(st.seed);
  let ns: GameState = { ...s, strat: { ...st, job: undefined } };
  const put = (p: Partial<StratState>) => (ns = { ...ns, strat: { ...stratOf(ns), ...p } });
  let text = '';
  switch (job.step) {
    case 'research':
      put({ stage: 1 });
      text = '🔬 탄도미사일 연구가 끝났어요. 이제 엔진 시험이에요.';
      break;
    case 'engine':
      put({ stage: 2 });
      text = '🔥 엔진 지상 시험 성공! 이제 시험 발사예요(2번).';
      break;
    case 'test': {
      const tests = st.tests + 1;
      put({ tests, stage: tests >= TESTS_NEED ? 3 : 2 });
      const w = watchers(ns);
      for (const id of w) ns = addTension(ns, me, id, TEST_TENSION);
      for (const id of w.slice(0, 3)) ns = addFavorNote(ns, id, '🚀 대륙간 탄도미사일 시험 발사', TEST_FAVOR);
      let sanc = '';
      if (w.length && rng.next() < TEST_SANCTION) {
        const by = rng.pick(w);
        ns = sanction(ns, by, 0.15, 72);
        sanc = ` ${ga(countryById(by).name)} 3일 동안 제재를 걸었어요(수입 −15%).`;
      }
      text = `🚀 ICBM 시험 발사 ${tests}/${TESTS_NEED}번째 성공! 강대국 긴장 +${TEST_TENSION}.${sanc}${tests >= TESTS_NEED ? ' 이제 실전 배치를 할 수 있어요.' : ''}`;
      ns = event(ns, `🚀 ${ga(countryById(me).name)} 대륙간 탄도미사일을 시험 발사했어요.`);
      break;
    }
    case 'build':
      put({ deployed: st.deployed + 1 });
      text = `🏗️ ICBM ${st.deployed + 1}기를 사일로에 세웠어요. 억지력이 올라가요.`;
      break;
    case 'nuke': {
      put({ nuke: true });
      for (const c of COUNTRIES) if (c.id !== me && isAlive(ns.world, c.id)) ns = addFavorNote(ns, c.id, '☢️ 핵무장', -10);
      const w = watchers(ns);
      for (let i = 0; i < 2 && w.length; i++) {
        const by = w.splice(Math.floor(rng.next() * w.length), 1)[0];
        ns = sanction(ns, by, 0.2, 96);
      }
      text = '☢️ 핵탄두를 손에 넣었어요. 모든 나라 호감 −10, 강대국 둘이 4일 동안 제재해요.';
      ns = event(ns, `☢️ ${ga(countryById(me).name)} 핵무장을 선언했어요.`);
      break;
    }
  }
  ns = { ...ns, strat: { ...stratOf(ns), seed: rng.seed } };
  ns = syncWorld(ns);
  return pushReport(ns, { icon: '☢️', text });
}

/* ───────── 발사 ───────── */
/** 쏠 수 있는 도시: 남의 도시(연합국 빼고) */
export function targetCities(s: GameState): string[] {
  const me = s.player.countryId;
  return CITIES.filter((c) => {
    const o = s.world.owner[c.id];
    return o && o !== me && isAlive(s.world, o) && relationOf(s.world, me, o) !== '연합';
  }).map((c) => c.id);
}
export function canLaunch(s: GameState, city: string, warhead: 'conv' | 'nuke'): string | null {
  const st = stratOf(s);
  if (st.deployed - st.flights.length <= 0) return '쏠 수 있는 ICBM이 없어요';
  if (warhead === 'nuke' && !st.nuke) return '핵탄두가 없어요';
  if (!targetCities(s).includes(city)) return '쏠 수 없는 도시예요';
  if (st.flights.some((f) => f.city === city)) return '이미 그 도시로 날아가는 중이에요';
  return null;
}
export function launch(s: GameState, city: string, warhead: 'conv' | 'nuke'): { state: GameState; text: string } {
  const why = canLaunch(s, city, warhead);
  if (why) return { state: s, text: why };
  const st = stratOf(s);
  const f: Flight = { id: st.nextId, city, warhead, launchMs: s.worldMs, arriveMs: s.worldMs + FLIGHT_MS };
  const c = cityById(city);
  const ns: GameState = { ...s, strat: { ...st, flights: [...st.flights, f], nextId: st.nextId + 1, launches: st.launches + 1 } };
  const text = `${warhead === 'nuke' ? '☢️' : '🚀'} ${c.name}을(를) 향해 ICBM을 쐈어요. 30분 뒤 닿아요.`;
  return { state: event(ns, `${warhead === 'nuke' ? '☢️' : '🚀'} ${ga(countryById(s.player.countryId).name)} ${c.name}에 대륙간 탄도미사일을 쐈어요!`), text };
}

function land(s: GameState, f: Flight): GameState {
  const st = stratOf(s);
  const me = s.player.countryId;
  const rng = new Rng((st.seed + f.id * 7919) >>> 0);
  const c = cityById(f.city);
  const owner = s.world.owner[f.city];
  // 한 기를 썼음(사일로에서 빠짐)
  let ns: GameState = { ...s, strat: { ...st, flights: st.flights.filter((x) => x.id !== f.id), deployed: Math.max(0, st.deployed - 1), nukesUsed: st.nukesUsed + (f.warhead === 'nuke' ? 1 : 0) } };
  ns = syncWorld(ns);
  if (!owner || owner === me) return pushReport(ns, { icon: '🚀', text: `${c.name}은(는) 이미 우리 도시라 미사일을 바다로 돌렸어요.` });
  const on = countryById(owner).name;
  if (rng.next() < interceptOf(owner)) {
    ns = addFavorNote(ns, owner, '🚀 우리에게 ICBM을 쏨', -10);
    ns = addTension(ns, me, owner, 10);
    const text = `🛡️ ${on}의 미사일 방어망이 우리 ICBM을 요격했어요. ${c.name}은(는) 무사해요.`;
    return pushReport(event(ns, text), { icon: '🛡️', text });
  }
  const n = ns.nations[owner];
  if (f.warhead === 'conv') {
    ns = { ...ns, world: { ...ns.world, defense: { ...ns.world.defense, [f.city]: Math.max(0, (ns.world.defense[f.city] ?? 0) * CONV.def) } } };
    if (n) ns = { ...ns, nations: { ...ns.nations, [owner]: { ...n, troops: n.troops * CONV.troops } } };
    ns = addFavorNote(ns, owner, '🚀 ICBM 공격', CONV.favor);
    ns = addTension(ns, me, owner, CONV.tension);
    for (const x of COUNTRIES) if (x.id !== me && x.id !== owner && isAlive(ns.world, x.id)) ns = addFavorNote(ns, x.id, '🚀 ICBM을 씀', CONV.others);
    ns = addPresMod(ns, 'ICBM 발사 논란', CONV.approval, 48);
    const text = `💥 ICBM이 ${c.name}에 떨어졌어요! 도시 방어 −${Math.round((1 - CONV.def) * 100)}%, ${on} 병력 −3%. 세계가 술렁여요.`;
    return pushReport(event(ns, text), { icon: '💥', text });
  }
  // 핵탄두
  ns = { ...ns, world: { ...ns.world, defense: { ...ns.world.defense, [f.city]: 0 } } };
  if (n) ns = { ...ns, nations: { ...ns.nations, [owner]: { ...n, troops: n.troops * NUKE.troops, treasury: n.treasury * NUKE.treasury } } };
  for (const x of COUNTRIES) {
    if (x.id === me || !isAlive(ns.world, x.id)) continue;
    ns = addFavorNote(ns, x.id, '☢️ 핵무기를 씀', NUKE.favor);
    ns = addTension(ns, me, x.id, NUKE.tension);
  }
  const w = watchers(ns);
  for (const by of w.slice(0, NUKE.sanctions)) ns = sanction(ns, by, 0.25, 120);
  ns = addPresMod(ns, '핵 공격 후폭풍', NUKE.approval, NUKE.approvalHours);
  const text = `☢️ 핵탄두가 ${c.name}에 떨어졌어요. 도시가 무력화됐어요. 모든 나라 호감 ${NUKE.favor}, 강대국 ${Math.min(NUKE.sanctions, w.length)}곳이 반핵 연합을 맺고 제재해요. 지지율이 크게 떨어졌어요.`;
  ns = event(ns, `☢️ ${ga(countryById(me).name)} ${eul(c.name)} 핵으로 공격했어요. 세계가 반핵 연합으로 뭉쳤어요.`);
  return pushReport(ns, { icon: '☢️', text });
}

export function stratTick(s: GameState): GameState {
  const st = s.strat;
  if (!st) return s;
  let ns = s;
  if (st.job && st.job.endMs <= s.worldMs) ns = finishJob(ns);
  for (const f of stratOf(ns).flights) if (f.arriveMs <= ns.worldMs) ns = land(ns, f);
  return ns;
}

/** 우리 억지력(AI가 쳐들어올 확률 배수, 낮을수록 셈) — 화면 표시용 */
export const myDeter = (s: GameState) => {
  const n = icbmOf(s.world, s.player.countryId);
  return n ? Math.round((1 - Math.max(0.6, 1 - 0.08 * n)) * 100) : 0;
};
