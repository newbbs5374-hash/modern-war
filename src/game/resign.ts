// 11/28 대장 요청: 장관이 개인 사정·건강·비리 같은 까닭으로 가끔 사직을 청함(인재 명단 순환).
// - 실제 30~54시간마다 자리에 앉은 장관 한 명이 사표를 냄(숨은 특성 '건강 문제'면 건강, '비리 전력'이면 비리가 잘 나옴).
// - 📨 보고 화면에서 고름: 사직 수리(자리를 비우고 인재 명단에 새 사람) / 만류(봉급, 성공 확률은 충성·까닭에 따라).
// - 12시간 안에 고르지 않으면 그대로 수리.
import { ministryById } from '../data/cabinet';
import { addPresMod } from './approval';
import { cabLog, cabinetOf, poolPerson, takenNames, type Person } from './cabinet';
import { note } from './officer';
import { Rng } from './rng';
import type { GameState } from './state';

const H = 3600e3;
export const RESIGN_GAP_H: [number, number] = [30, 54];
export const RESIGN_WAIT_H = 12;
/** 만류 비용(봉급) */
export const RESIGN_KEEP_COST = 400;
/** 처음 이만큼은 사직 없음(게임 시작 뒤) */
export const RESIGN_FIRST_H = 24;

export type ResignWhy = 'personal' | 'family' | 'health' | 'scandal' | 'burnout';
export const RESIGN_WHY: Record<ResignWhy, { icon: string; name: string; lines: string[] }> = {
  personal: { icon: '🧳', name: '개인 사정', lines: ['개인적인 사정으로 더는 자리를 지키기 어렵습니다.', '오래 미뤄 둔 일을 정리해야 할 때가 왔습니다. 물러나게 해 주십시오.'] },
  family: { icon: '🏠', name: '가족 문제', lines: ['가족이 많이 아픕니다. 곁에 있어야 할 것 같습니다.', '집안일로 한동안 멀리 떠나 있어야 합니다. 사표를 받아 주십시오.'] },
  health: { icon: '🏥', name: '건강 문제', lines: ['의사가 당장 쉬라고 합니다. 더 버티면 일을 그르칠 것 같습니다.', '몸이 예전 같지 않습니다. 자리를 비워 드리는 게 도리라 생각합니다.'] },
  scandal: { icon: '💸', name: '비리 의혹', lines: ['제 주변 일로 언론이 시끄럽습니다. 정부에 누를 끼치기 전에 물러나겠습니다.', '오래전 일이 터졌습니다. 책임지고 사표를 내겠습니다.'] },
  burnout: { icon: '😮‍💨', name: '번아웃', lines: ['솔직히 지쳤습니다. 새 사람이 맡는 게 부처를 위해 낫겠습니다.', '요즘 판단이 흐려집니다. 쉬어야 할 때인 것 같습니다.'] },
};

export interface ResignAsk {
  pid: number;
  why: ResignWhy;
  text: string;
  atMs: number;
  untilMs: number;
}
export interface ResignState {
  nextMs: number;
  ask: ResignAsk | null;
  seed: number;
  /** 수리 · 만류 성공 · 만류 실패 */
  ok: number;
  kept: number;
  lost: number;
}

export const resignOf = (s: GameState): ResignState =>
  s.resign ?? { nextMs: s.worldMs + RESIGN_FIRST_H * H, ask: null, seed: 7177 + (Math.floor(s.worldMs) % 9973), ok: 0, kept: 0, lost: 0 };

const seated = (s: GameState) => cabinetOf(s).people.filter((p) => p.group === '내각' && p.seat?.kind === 'min');
export const resignPerson = (s: GameState): Person | null => {
  const a = s.resign?.ask;
  return a ? (cabinetOf(s).people.find((p) => p.id === a.pid) ?? null) : null;
};

function pickWhy(p: Person, rng: Rng): ResignWhy {
  if (p.hidden === '건강 문제' && rng.chance(0.6)) return 'health';
  if (p.hidden === '비리 전력' && rng.chance(0.6)) return 'scandal';
  if (p.loyalty < 40 && rng.chance(0.4)) return 'burnout';
  return rng.weighted(['personal', 'family', 'health', 'scandal', 'burnout'] as ResignWhy[], (w) => ({ personal: 4, family: 3, health: 2, scandal: 1.5, burnout: 2 })[w]) ?? 'personal';
}

/** 만류 성공 확률 */
export function keepChance(s: GameState): number {
  const p = resignPerson(s);
  const a = s.resign?.ask;
  if (!p || !a) return 0;
  const base = { personal: 0.55, family: 0.4, health: 0.3, scandal: 0.5, burnout: 0.45 }[a.why];
  return Math.max(0.1, Math.min(0.9, base + (p.loyalty - 50) / 150 + (p.trait === '충직' ? 0.15 : 0)));
}

function removeSeat(s: GameState, pid: number, rng: Rng): GameState {
  const c = structuredClone(cabinetOf(s));
  c.people = c.people.filter((x) => x.id !== pid);
  // 인재 명단 순환: 새 후보 한 명
  c.seed = rng.seed;
  c.people.push(poolPerson(c, rng, s.player.countryId, s.worldMs, takenNames(c)));
  return { ...s, cabinet: c };
}

function say(s: GameState, text: string): GameState {
  const c = structuredClone(cabinetOf(s));
  cabLog(c, text);
  const ns: GameState = { ...s, cabinet: c, world: { ...s.world, events: [...s.world.events] } };
  note(ns, text);
  return ns;
}

/** 사직 수리 */
export function acceptResign(s: GameState): GameState {
  const r = resignOf(s);
  const a = r.ask;
  const p = resignPerson(s);
  if (!a) return s;
  const rng = new Rng(r.seed);
  let ns: GameState = { ...s, resign: { ...r, ask: null, ok: r.ok + 1, seed: rng.seed } };
  if (!p) return ns;
  const min = p.seat ? ministryById(p.seat.id).name : '';
  ns = removeSeat(ns, p.id, rng);
  ns = { ...ns, resign: { ...resignOf(ns), seed: rng.seed } };
  // 비리 의혹은 빨리 수리하면 오히려 조금 좋게 봄
  if (a.why === 'scandal') ns = addPresMod(ns, `💸 ${p.name} 사표 수리`, 1, 12);
  return say(ns, `📄 ${p.name} ${min} 장관의 사표를 수리했어요(${RESIGN_WHY[a.why].name}). 자리가 비었어요. 인재 명단에 새 후보가 들어왔어요.`);
}

/** 만류: 봉급을 쓰고 확률로 붙잡음. 실패하면 그대로 떠남 */
export function canKeep(s: GameState): string | null {
  if (!s.resign?.ask || !resignPerson(s)) return '사직 요청이 없어요';
  if (s.player.salary < RESIGN_KEEP_COST) return `봉급 ${RESIGN_KEEP_COST} 필요`;
  return null;
}
export function keepResign(s: GameState): { state: GameState; ok: boolean } {
  if (canKeep(s)) return { state: s, ok: false };
  const r = resignOf(s);
  const a = r.ask!;
  const p = resignPerson(s)!;
  const rng = new Rng(r.seed);
  const ok = rng.chance(keepChance(s));
  let ns: GameState = { ...s, player: { ...s.player, salary: s.player.salary - RESIGN_KEEP_COST } };
  const min = p.seat ? ministryById(p.seat.id).name : '';
  if (ok) {
    const c = structuredClone(cabinetOf(ns));
    const q = c.people.find((x) => x.id === p.id)!;
    q.loyalty = Math.min(100, q.loyalty + 10);
    if (a.why === 'scandal') q.known = true;
    ns = { ...ns, cabinet: c, resign: { ...r, ask: null, kept: r.kept + 1, seed: rng.seed } };
    // 비리 의혹인데 붙잡으면 여론이 나빠짐
    if (a.why === 'scandal') ns = addPresMod(ns, `💸 ${p.name} 감싸기`, -4, 24);
    return { state: say(ns, `🤝 ${p.name} ${min} 장관을 붙잡았어요. 충성 +10${a.why === 'scandal' ? ' · 감싸기 논란 지지도 −4(24시간)' : ''}`), ok };
  }
  ns = { ...ns, resign: { ...r, ask: null, lost: r.lost + 1, seed: rng.seed } };
  ns = removeSeat(ns, p.id, rng);
  ns = { ...ns, resign: { ...resignOf(ns), seed: rng.seed } };
  return { state: say(ns, `🚪 만류했지만 ${p.name} ${min} 장관은 끝내 떠났어요. 자리가 비었어요.`), ok };
}

/** 시간이 흐를 때(15분마다) */
export function resignTick(s: GameState): GameState {
  if (!s.cabinet) return s;
  let r = resignOf(s);
  // 기다리는 사직: 사람이 이미 떠났으면 지움, 시간이 지나면 수리
  if (r.ask) {
    if (!resignPerson(s) || !resignPerson(s)?.seat) return { ...s, resign: { ...r, ask: null } };
    if (s.worldMs >= r.ask.untilMs) return acceptResign(s);
    return s.resign ? s : { ...s, resign: r };
  }
  if (s.worldMs < r.nextMs) return s.resign ? s : { ...s, resign: r };
  const rng = new Rng(r.seed);
  const list = seated(s);
  const nextMs = s.worldMs + (RESIGN_GAP_H[0] + rng.next() * (RESIGN_GAP_H[1] - RESIGN_GAP_H[0])) * H;
  // 장관이 3명은 넘어야 사직이 생김(빈자리만 늘지 않게)
  if (list.length < 3) return { ...s, resign: { ...r, nextMs, seed: rng.seed } };
  // 충성이 낮을수록·나이가 많을수록 잘 냄
  const p = rng.weighted(list, (x) => 1 + (100 - x.loyalty) / 40 + Math.max(0, x.age - 60) / 10 + (x.hidden === '건강 문제' || x.hidden === '비리 전력' ? 1 : 0)) ?? list[0];
  const why = pickWhy(p, rng);
  const text = rng.pick(RESIGN_WHY[why].lines);
  r = { ...r, nextMs, seed: rng.seed, ask: { pid: p.id, why, text, atMs: s.worldMs, untilMs: s.worldMs + RESIGN_WAIT_H * H } };
  const ns: GameState = { ...s, resign: r, world: { ...s.world, events: [...s.world.events] } };
  note(ns, `📄 ${p.name} ${ministryById(p.seat!.id).name} 장관이 사직을 청했어요(${RESIGN_WHY[why].name}). 📨 보고에서 정해 주세요.`);
  return ns;
}
