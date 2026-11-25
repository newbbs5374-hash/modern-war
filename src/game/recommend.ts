// 비서 인사 추천(11-25 대장 요청 "각 내정에 임명할 인사들을 추천하는 기능, 비서가 보고하는 형식, 부처별로 합쳐도 됨").
// 11-25 후속: 가장 시급한 공석부터 차례로, 자리 없는 '내 사람' 중에서 먼저 고르고(적합 OWN_OK 밑이면)
// 인재 명단에 더 나은 사람이 있을 때만 영입 추천. 한 사람은 한 자리에만.
// 이미 앉은 사람보다 20점 넘게 잘 맞는 사람이 남아 있으면 교체도 건의해요.
import { NEEDS, type Need } from '../data/needs';
import { MINISTRIES, PERSON_ORIGINS, TRAITS, ministerSlots, ministryById, type MinistryId } from '../data/cabinet';
import { POSTS, postById, type PostId } from '../data/staff';
import type { AnyStat } from '../data/stats2';
import {
  appointMinister,
  appointPost,
  cabinetOf,
  canAppointMinister,
  canAppointPost,
  canRecruit,
  fitPct,
  ministerCount,
  ministerOf,
  postHolder,
  recruit,
  recruitCost,
  unseat,
  type Person,
} from './cabinet';
import type { GameState } from './state';
import { atWar } from './peace';
import { presOf } from './approval';

export type RecSeat = { kind: 'min'; id: MinistryId } | { kind: 'post'; id: PostId };
export interface Rec {
  seat: RecSeat;
  /** 자리 이름(예: 외교부 장관, 정무수석) */
  name: string;
  icon: string;
  /** 추천 인물 */
  pid: number;
  fit: number;
  /** 인재 명단 사람이면 영입비 */
  cost: number;
  /** 교체 건의면 지금 앉은 사람 */
  holder: { pid: number; name: string; fit: number } | null;
  /** 비서 보고 말투 한 줄 */
  say: string;
  /** 시급도 1~4(클수록 급함) */
  urgency: number;
}
export interface SeatInfo {
  seat: RecSeat;
  name: string;
  icon: string;
  holder: Person | null;
  holderFit: number;
}
export interface RecReport {
  recs: Rec[];
  /** 추천할 사람이 없는 빈 자리 */
  noOne: SeatInfo[];
  /** 잘 맞는 사람이 앉아 있는 자리 수 */
  good: number;
  /** 남은 장관 석 */
  minLeft: number;
  /** 장관 석이 모자라 추천 못 한 부처 수 */
  minBlocked: number;
}

/** 교체를 건의하는 적합도 차이 */
export const SWAP_GAP = 20;
/** 이 적합도 밑이면 추천하지 않음(차라리 비워 둠) */
export const MIN_FIT = 25;

const needOfSeat = (seat: RecSeat): { need: Need; spec: readonly string[] } =>
  seat.kind === 'min' ? { need: NEEDS[seat.id], spec: ministryById(seat.id).spec } : { need: NEEDS[seat.id], spec: postById(seat.id).spec };

export const seatName = (seat: RecSeat) => (seat.kind === 'min' ? `${ministryById(seat.id).name} 장관` : postById(seat.id).name);
export const seatIcon = (seat: RecSeat) => (seat.kind === 'min' ? ministryById(seat.id).icon : postById(seat.id).icon);
export const seatKey = (seat: RecSeat) => `${seat.kind}:${seat.id}`;
export const seatFit = (p: Person, seat: RecSeat) => {
  const { need, spec } = needOfSeat(seat);
  return fitPct(p, need, spec);
};

/** 모든 내정 자리(장관 24 + 대통령실·총리·기관장·청장 37) */
export function allSeats(): RecSeat[] {
  return [...MINISTRIES.map((m) => ({ kind: 'min', id: m.id }) as RecSeat), ...POSTS.map((p) => ({ kind: 'post', id: p.id }) as RecSeat)];
}

function holderOf(s: GameState, seat: RecSeat): Person | null {
  const c = cabinetOf(s);
  return seat.kind === 'min' ? ministerOf(c, seat.id) : postHolder(c, seat.id);
}

/** 추천 이유 한 줄(비서 말투) */
export function reasonLine(p: Person, seat: RecSeat): string {
  const { need, spec } = needOfSeat(seat);
  const st = (k: AnyStat) => `${k} ${p.stats[k] ?? 0}`;
  const plus: string[] = [];
  if (spec.includes(p.spec)) plus.push(p.spec);
  if (need.traits.includes(p.trait)) plus.push(`${p.trait} 성향`);
  if (need.origins.includes(p.origin)) plus.push(`${PERSON_ORIGINS[p.origin].name} 출신`);
  const head = `${st(need.main[0])}·${st(need.main[1])}`;
  return plus.length ? `${head}에 ${plus.join('·')}이라 딱 맞습니다.` : `${head}로 이 자리에 가장 낫습니다.`;
}

/* ───────── 시급도(11-25 대장 요청 "가장 시급한 공석부터") ───────── */
// 기본: 총리·3실장·안보 4부처(국방·국정원·외교·기재) 장관 = 매우 시급(3),
// 나머지 장관·수석·차장·경호처장·검찰총장·감사원장·한은 총재 = 시급(2), 청장 = 보통(1).
// 상황 덤: 전쟁 중이면 국방·안보 자리 +1, 지지도 40 밑이면 홍보·소통 자리 +1.
const TOP: string[] = ['pm', 'chief', 'policy', 'nsa', 'mnd', 'nis', 'mofa', 'mof'];
const WAR_SEATS: string[] = ['mnd', 'nis', 'nsa', 'nsa2', 'guard', 'dapa', 'mma', 'kcg', 'mpva'];
const PR_SEATS: string[] = ['press', 'spokes', 'kocis', 'society', 'polit'];
export const URGENCY_NAME = ['', '🟢 보통', '🟠 시급', '🔴 매우 시급', '🚨 지금 당장'];

export function urgencyOf(s: GameState, seat: RecSeat): number {
  let u = TOP.includes(seat.id) ? 3 : seat.kind === 'post' && postById(seat.id).office === 'agency' ? 1 : 2;
  if (WAR_SEATS.includes(seat.id) && atWar(s)) u++;
  if (PR_SEATS.includes(seat.id) && presOf(s).approval < 40) u++;
  return Math.min(4, u);
}
/** 같은 시급도 안에서 앞세울 순서(위 자리일수록 먼저) */
function rankBonus(seat: RecSeat): number {
  if (seat.kind === 'min') return 2;
  const o = postById(seat.id).office;
  return o === 'gov' || OFFICE_HEADS.includes(seat.id) ? 3 : o === 'agency' ? 0 : 1;
}
const OFFICE_HEADS: string[] = ['chief', 'policy', 'nsa'];

/** 내 사람이 이 적합도 밑이면 인재 명단에서 더 나은 사람을 찾아봄 */
export const OWN_OK = 45;

/** 비서 보고 만들기: 시급한 공석부터 차례로, 내 사람 먼저 → 모자라면 인재 명단 */
export function recommend(s: GameState): RecReport {
  const c = cabinetOf(s);
  const busy = c.hearing?.pid;
  const own = c.people.filter((p) => p.id !== busy && p.group === '내각' && !p.seat && !p.post);
  const pool = c.people.filter((p) => p.id !== busy && p.group === '인재');
  const hearingMin = c.hearing?.min;
  const minLeft = Math.max(0, ministerSlots(s.player.rankIndex) - ministerCount(c) - (c.hearing ? 1 : 0));
  const seats = allSeats()
    .filter((seat) => !(seat.kind === 'min' && seat.id === hearingMin))
    .map((seat) => {
      const h = holderOf(s, seat);
      return { seat, holder: h, holderFit: h ? seatFit(h, seat) : 0, urg: urgencyOf(s, seat), bonus: rankBonus(seat) };
    });
  const used = new Set<number>();
  let minUsed = 0;
  let minBlocked = 0;
  const recs: Rec[] = [];
  const noOne: SeatInfo[] = [];
  const best = (list: Person[], seat: RecSeat, floor: number) => {
    let top: { p: Person; fit: number } | null = null;
    for (const p of list) {
      if (used.has(p.id)) continue;
      const fit = seatFit(p, seat);
      if (fit >= floor && (!top || fit > top.fit)) top = { p, fit };
    }
    return top;
  };
  /** 내 사람 먼저: OWN_OK 넘는 사람이 있으면 그 사람, 없으면 인재 명단이 더 나을 때만 인재 */
  const pick = (seat: RecSeat, floor: number) => {
    const a = best(own, seat, floor);
    if (a && a.fit >= OWN_OK) return a;
    const b = best(pool, seat, floor);
    if (b && (!a || b.fit > a.fit)) return b;
    return a;
  };
  const push = (x: (typeof seats)[number], p: Person, fit: number) => {
    used.add(p.id);
    const cost = p.group === '인재' ? recruitCost(s, p) : 0;
    const name = seatName(x.seat);
    const why = reasonLine(p, x.seat);
    const say = x.holder
      ? `각하, ${name} ${x.holder.name}(적합 ${x.holderFit}%)보다 ${p.name}(${fit}%)이(가) 훨씬 낫습니다. ${why} 교체를 건의드립니다.`
      : `각하, ${name} 자리가 비어 있습니다. ${cost ? '내 사람 중엔 맞는 분이 없어 인재 명단에서 ' : ''}${p.name}을(를) 추천드립니다. ${why}`;
    recs.push({ seat: x.seat, name, icon: seatIcon(x.seat), pid: p.id, fit, cost, holder: x.holder ? { pid: x.holder.id, name: x.holder.name, fit: x.holderFit } : null, say, urgency: x.urg });
  };
  // 1) 빈 자리: 시급한 순
  const empty = seats.filter((x) => !x.holder).sort((a, b) => b.urg - a.urg || b.bonus - a.bonus);
  for (const x of empty) {
    if (x.seat.kind === 'min' && minUsed >= minLeft) {
      minBlocked++;
      continue;
    }
    const top = pick(x.seat, MIN_FIT);
    if (!top) {
      noOne.push({ seat: x.seat, name: seatName(x.seat), icon: seatIcon(x.seat), holder: null, holderFit: 0 });
      continue;
    }
    if (x.seat.kind === 'min') minUsed++;
    push(x, top.p, top.fit);
  }
  // 2) 교체 건의: 남은 사람으로, 시급한 자리부터
  const filled = seats.filter((x) => x.holder).sort((a, b) => b.urg - a.urg || b.bonus - a.bonus);
  for (const x of filled) {
    const top = pick(x.seat, Math.max(MIN_FIT, x.holderFit + SWAP_GAP));
    if (top) push(x, top.p, top.fit);
  }
  const good = seats.filter((x) => x.holder).length - recs.filter((r) => r.holder).length;
  return { recs, noOne, good, minLeft, minBlocked };
}

/** 추천 하나를 따를 수 있는지(안 되면 까닭) */
export function canTakeRec(s: GameState, r: Rec): string | null {
  const c = cabinetOf(s);
  const p = c.people.find((x) => x.id === r.pid);
  if (!p) return '그 사람이 이제 없어요';
  if (p.group === '인재') {
    const w = canRecruit(s, p.id);
    if (w) return w;
  } else if (p.group !== '내각') return '이제 내 사람이 아니에요';
  if (p.group === '내각' && (p.seat || p.post)) return '이미 다른 자리에 앉았어요';
  const h = holderOf(s, r.seat);
  if (r.holder ? h?.id !== r.holder.pid : !!h) return '자리 사정이 바뀌었어요(다시 보고받기)';
  if (r.seat.kind === 'min') {
    if (c.hearing) return '청문회가 끝난 뒤에 할 수 있어요(한 번에 한 명)';
    if (!r.holder && ministerCount(c) >= ministerSlots(s.player.rankIndex)) return `장관 자리가 다 찼어요(${ministerSlots(s.player.rankIndex)}석)`;
  }
  return null;
}

/** 추천대로 (영입하고) 임명. 장관 교체면 앞사람을 먼저 내림 */
export function takeRec(s: GameState, r: Rec): GameState {
  if (canTakeRec(s, r)) return s;
  let ns = s;
  if (cabinetOf(ns).people.find((x) => x.id === r.pid)?.group === '인재') ns = recruit(ns, r.pid);
  if (r.seat.kind === 'min') {
    if (r.holder) ns = unseat(ns, r.holder.pid);
    if (canAppointMinister(ns, r.pid, r.seat.id)) return s;
    return appointMinister(ns, r.pid, r.seat.id);
  }
  if (canAppointPost(ns, r.pid, r.seat.id)) return s;
  return appointPost(ns, r.pid, r.seat.id);
}

/** 여러 추천을 차례로(안 되는 건 건너뜀). 몇 개 했는지 함께 */
export function takeRecs(s: GameState, recs: Rec[]): { s: GameState; done: number } {
  let ns = s;
  let done = 0;
  for (const r of recs) {
    if (canTakeRec(ns, r)) continue;
    const next = takeRec(ns, r);
    if (next !== ns) (ns = next, done++);
  }
  return { s: ns, done };
}

/** 성향 아이콘(화면용) */
export const traitIcon = (p: Person) => TRAITS[p.trait].icon;
