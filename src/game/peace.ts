// 평화 승리: "세계 평화 헌장"에 여러 나라의 서명을 받고, 헌장을 7일 동안 지키면 이김.
//  - 사회 연구 "국제 평화 헌장"을 마쳐야 제안할 수 있음
//  - 제안할 때 우리 나라는 어느 나라와도 전쟁 중이 아니어야 함
//  - 살아 있는 다른 나라 중 2/3 이상이 서명해야 헌장이 시작됨(호감 20 이상인 나라만 서명)
//  - 시작되면 7일 동안: 우리가 전쟁하지 않고, 서명국이 2/3 아래로 줄지 않게 지키면 평화 승리
import { COUNTRIES, countryById } from '../data/world';
import { RANKS } from '../data/ranks';

const VICTORY_RANK = RANKS.length - 1;
import type { GameState } from './state';
import { favorOf, hasTech } from './civ';
import { isAlive, relationOf, type WorldEvent } from './world';

export const PEACE_TECH = 's-peace';
export const PEACE_FAVOR = 20;
export const PEACE_SHARE = 2 / 3;
export const PEACE_COST = 10000;
export const PEACE_HOLD_DAYS = 7;
export const PEACE_RETRY_MS = 12 * 3600e3;
const HOLD_MS = PEACE_HOLD_DAYS * 24 * 3600e3;

export interface PeaceState {
  /** 헌장이 시작된 시각(null = 아직) */
  sinceMs: number | null;
  /** 처음 서명한 나라 */
  signers: string[];
  /** 실패한 뒤 다시 제안할 수 있는 시각 */
  retryMs: number;
  /** 마지막 결과 한 줄 */
  last: string | null;
}

export const newPeace = (): PeaceState => ({ sinceMs: null, signers: [], retryMs: 0, last: null });
export const peaceOf = (s: GameState): PeaceState => s.peace ?? newPeace();

const others = (s: GameState) => COUNTRIES.map((c) => c.id).filter((id) => id !== s.player.countryId && isAlive(s.world, id));
export const atWar = (s: GameState) => others(s).some((id) => relationOf(s.world, s.player.countryId, id) === '전쟁');

export interface PeaceLine {
  id: string;
  favor: number;
  signs: boolean;
  why: string;
}
/** 나라마다 지금 서명해 줄지와 이유 */
export function peaceLines(s: GameState): PeaceLine[] {
  const me = s.player.countryId;
  return others(s).map((id) => {
    const favor = favorOf(s, id);
    const war = relationOf(s.world, me, id) === '전쟁';
    const signs = !war && favor >= PEACE_FAVOR;
    return { id, favor, signs, why: war ? '전쟁 중' : signs ? '서명해 줄 거예요' : `호감 ${PEACE_FAVOR} 필요` };
  });
}
export function peaceProgress(s: GameState) {
  const lines = peaceLines(s);
  const need = Math.ceil(lines.length * PEACE_SHARE);
  return { lines, have: lines.filter((l) => l.signs).length, need, total: lines.length };
}

export function canProposePeace(s: GameState): string | null {
  const p = peaceOf(s);
  if (s.ending) return '판이 끝났어요';
  if (p.sinceMs !== null) return '헌장을 지키는 중이에요';
  if (s.player.rankIndex < VICTORY_RANK) return `${RANKS[VICTORY_RANK].name}가 되면 제안할 수 있어요`;
  if (!hasTech(s, PEACE_TECH)) return '사회 연구 "국제 평화 헌장"이 필요해요';
  if (atWar(s)) return '전쟁을 모두 끝내야 제안할 수 있어요';
  if (s.worldMs < p.retryMs) return '지난 제안이 부결돼서 잠시 뒤에 다시 할 수 있어요';
  if (s.nations[s.player.countryId].treasury < PEACE_COST) return `국방예산 ${PEACE_COST.toLocaleString('ko-KR')} 필요`;
  return null;
}

function addEvent(s: GameState, text: string): GameState {
  const ev: WorldEvent = { t: s.worldMs, kind: '외교', text, mine: true };
  return { ...s, world: { ...s.world, events: [ev, ...s.world.events].slice(0, 200) } };
}

/** 헌장 제안: 서명이 2/3 이상이면 시작, 아니면 부결(돈은 씀) */
export function proposePeace(s: GameState): GameState {
  if (canProposePeace(s)) return s;
  const me = s.player.countryId;
  const pr = peaceProgress(s);
  const ns: GameState = { ...s, nations: { ...s.nations, [me]: { ...s.nations[me], treasury: s.nations[me].treasury - PEACE_COST } } };
  if (pr.have >= pr.need) {
    const signers = pr.lines.filter((l) => l.signs).map((l) => l.id);
    const last = `☮️ 세계 평화 헌장 서명 ${pr.have}/${pr.total}개 나라 — ${PEACE_HOLD_DAYS}일 동안 지키면 평화 승리!`;
    return addEvent({ ...ns, peace: { sinceMs: s.worldMs, signers, retryMs: 0, last } }, last);
  }
  const last = `☮️ 세계 평화 헌장 부결: 서명 ${pr.have}/${pr.need} (호감을 더 쌓아 보세요)`;
  return addEvent({ ...ns, peace: { ...peaceOf(s), retryMs: s.worldMs + PEACE_RETRY_MS, last } }, last);
}

/** 헌장이 남은 시간(ms). 헌장 중이 아니면 null */
export function peaceLeft(s: GameState): number | null {
  const p = peaceOf(s);
  return p.sinceMs === null ? null : Math.max(0, p.sinceMs + HOLD_MS - s.worldMs);
}

/** 시간이 흐를 때마다: 헌장이 깨졌는지 / 다 지켰는지. 이기면 true */
export function peaceTick(s: GameState): { s: GameState; won: boolean } {
  const p = peaceOf(s);
  if (p.sinceMs === null) return { s, won: false };
  const pr = peaceProgress(s);
  let broke: string | null = null;
  if (atWar(s)) broke = '우리가 전쟁에 휘말려';
  else if (pr.have < pr.need) broke = `서명국이 ${pr.have}개로 줄어`;
  if (broke) {
    const last = `💔 ${broke} 세계 평화 헌장이 깨졌어요. 다시 호감을 쌓아 제안하세요.`;
    return { s: addEvent({ ...s, peace: { ...p, sinceMs: null, retryMs: s.worldMs + PEACE_RETRY_MS, last } }, last), won: false };
  }
  return { s, won: s.worldMs - p.sinceMs >= HOLD_MS };
}

export const peaceName = (id: string) => countryById(id).name;
