// 비서 인사 추천(11-25 대장 요청 "각 내정에 임명할 인사들을 추천하는 기능, 비서가 보고하는 형식, 부처별로 합쳐도 됨").
// 빈 자리(장관·대통령실 참모·국무총리·기관장·청장)마다 가장 잘 맞는 사람을 한 명씩 겹치지 않게 골라요.
// 후보 = 자리 없는 내 사람 + 인재 명단(영입비가 들어서 적합도 8점 덜 쳐 줌).
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
/** 인재 명단 사람(영입비 듦)은 이만큼 덜 쳐 줌 */
export const POOL_PENALTY = 8;
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

/** 비서 보고 만들기 */
export function recommend(s: GameState): RecReport {
  const c = cabinetOf(s);
  const busy = c.hearing?.pid;
  const cands = c.people.filter(
    (p) => p.id !== busy && ((p.group === '내각' && !p.seat && !p.post) || p.group === '인재'),
  );
  const seats = allSeats().map((seat) => {
    const h = holderOf(s, seat);
    return { seat, holder: h, holderFit: h ? seatFit(h, seat) : 0 };
  });
  // 장관 석: 청문회 중인 부처는 비어도 추천하지 않음
  const hearingMin = c.hearing?.min;
  const minLeft = Math.max(0, ministerSlots(s.player.rankIndex) - ministerCount(c) - (c.hearing ? 1 : 0));
  const open = seats.filter((x) => !(x.seat.kind === 'min' && x.seat.id === hearingMin));

  // 짝(자리·사람) 점수 → 큰 것부터 겹치지 않게
  type Pair = { i: number; p: Person; fit: number; score: number };
  const pairs: Pair[] = [];
  open.forEach((x, i) => {
    for (const p of cands) {
      const fit = seatFit(p, x.seat);
      if (fit < MIN_FIT) continue;
      // 앉은 사람이 있으면 그보다 SWAP_GAP 넘게 나아야 후보
      if (x.holder && fit - x.holderFit < SWAP_GAP) continue;
      const score = fit - (p.group === '인재' ? POOL_PENALTY : 0) - (x.holder ? 5 : 0);
      pairs.push({ i, p, fit, score });
    }
  });
  pairs.sort((a, b) => b.score - a.score);
  const usedSeat = new Set<number>();
  const usedP = new Set<number>();
  let minUsed = 0;
  let minBlocked = 0;
  const blockedSeat = new Set<number>();
  const recs: Rec[] = [];
  for (const pr of pairs) {
    if (usedSeat.has(pr.i) || usedP.has(pr.p.id)) continue;
    const x = open[pr.i];
    // 빈 장관 자리는 남은 석만큼만
    if (x.seat.kind === 'min' && !x.holder) {
      if (minUsed >= minLeft) {
        if (!blockedSeat.has(pr.i)) (blockedSeat.add(pr.i), minBlocked++);
        continue;
      }
      minUsed++;
    }
    usedSeat.add(pr.i);
    usedP.add(pr.p.id);
    const p = pr.p;
    const cost = p.group === '인재' ? recruitCost(s, p) : 0;
    const name = seatName(x.seat);
    const why = reasonLine(p, x.seat);
    const say = x.holder
      ? `각하, ${name} ${x.holder.name}(적합 ${x.holderFit}%)보다 ${p.name}(${pr.fit}%)이(가) 훨씬 낫습니다. ${why} 교체를 건의드립니다.`
      : `각하, ${name} 자리가 비어 있습니다. ${p.name}을(를) 추천드립니다. ${why}${cost ? ' 아직 영입 전이라 영입비가 듭니다.' : ''}`;
    recs.push({
      seat: x.seat,
      name,
      icon: seatIcon(x.seat),
      pid: p.id,
      fit: pr.fit,
      cost,
      holder: x.holder ? { pid: x.holder.id, name: x.holder.name, fit: x.holderFit } : null,
      say,
    });
  }
  const noOne: SeatInfo[] = open
    .filter((x, i) => !x.holder && !usedSeat.has(i) && !blockedSeat.has(i))
    .map((x) => ({ seat: x.seat, name: seatName(x.seat), icon: seatIcon(x.seat), holder: null, holderFit: 0 }));
  const good = seats.filter((x) => x.holder && !recs.some((r) => seatKey(r.seat) === seatKey(x.seat))).length;
  // 실제로 부족한 장관 석: 추천 못 한 빈 부처 수(blocked) — 다른 자리로 간 사람 때문일 수 있어 seat 기준
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
