// 지도자 권한: 선전포고(언제든) · 휴전 제안 · 연합 제안(12시간마다 한 번).
import { PERSONALITIES } from '../data/leaders';
import { CITIES } from '../data/cities';
import { countryById } from '../data/world';
import { RANKS } from '../data/ranks';
import { Rng } from './rng';
import type { GameState } from './state';
import { onPlayerWar } from './civ';
import { actBlocksWar } from './acts';
import { endVassalPair, isVassalPair, lordOf } from './surrender';
import { ga, gwa, isAlive, isLosing, isRival, pairKey, relationOf, sameBloc, type WorldEvent } from './world';

export const COMMAND_TOP = RANKS.length - 1;
/** 지도자가 직접 외교(선전포고·휴전·연합)를 하는 등급: 존경받는 지도자부터 */
export const DIPLO_RANK = 6;
export const DIPLO_COOLDOWN_HOURS = 12;
const H = 3600e3;

export type DiploAct = '선전포고' | '휴전 제안' | '연합 제안' | '연합 깨기';

export function diploReady(s: GameState): number {
  return s.officer.diploReadyMs ?? 0;
}

/** 성공 확률(선전포고는 1) */
export function diploChance(s: GameState, id: string, act: DiploAct): number {
  const me = s.player.countryId;
  const w = s.world;
  const p = w.pairs[pairKey(me, id)];
  const per = PERSONALITIES[w.personalities[id]];
  if (act === '선전포고' || act === '연합 깨기') return 1;
  if (act === '휴전 제안') {
    const tookFromThem = CITIES.filter((c) => c.home === id && w.owner[c.id] === me).length;
    return Math.min(0.95, 0.15 + p.weariness / 250 + tookFromThem * 0.12 + (isLosing(w, id) ? 0.3 : 0) + (per.peace - 1) * 0.3);
  }
  // 연합: 같은 묶음·같은 신앙이면 쉬움, 맞수면 거의 안 됨, 긴장이 높으면 어려움
  const faith = countryById(me).faith === countryById(id).faith ? 0.15 : 0;
  return Math.max(0.02, Math.min(0.9, 0.2 + (sameBloc(me, id) ? 0.35 : 0) + faith - (isRival(me, id) ? 0.4 : 0) - p.tension / 200 - (per.aggression - 1) * 0.2));
}

/** 남은 시간을 "3시간 20분"처럼 */
export function waitText(ms: number): string {
  const m = Math.max(1, Math.ceil(ms / 60e3));
  const h = Math.floor(m / 60);
  return h ? `${h}시간${m % 60 ? ` ${m % 60}분` : ''}` : `${m}분`;
}

export function canDiplo(s: GameState, id: string, act: DiploAct): string | null {
  const me = s.player.countryId;
  if (s.player.rankIndex < DIPLO_RANK) return `${ga(RANKS[DIPLO_RANK].name)} 되면 직접 정해요`;
  if (id === me || !isAlive(s.world, id)) return '할 수 없는 나라';
  const rel = relationOf(s.world, me, id);
  // 11-26 대장 요청(다 정복하고 싶음): 선전포고는 외교 대기 시간과 상관없이 바로, 연합국도 연합을 깨고 칠 수 있음
  if (act === '선전포고') return rel === '전쟁' ? '이미 전쟁 중이에요' : actBlocksWar(s, id);
  // 11-26 대장 요청: 연합은 언제든(외교 대기 없이) 깰 수 있음
  if (act === '연합 깨기') return rel !== '연합' ? '연합이 아니에요' : isVassalPair(s, me, id) ? (lordOf(s, me) === id ? '속국은 선전포고(독립 전쟁)로만 벗어나요' : '속국은 선전포고로만 다시 쳐요') : null;
  if (s.worldMs < diploReady(s)) return `외교 준비 중 · ${waitText(diploReady(s) - s.worldMs)} 남음`;
  if (act === '휴전 제안' && rel !== '전쟁') return '전쟁 중일 때만';
  if (act === '연합 제안' && (rel === '전쟁' || rel === '연합')) return rel === '연합' ? '이미 연합' : '먼저 휴전해야 해요';
  return null;
}

export function doDiplo(s: GameState, id: string, act: DiploAct): { state: GameState; ok: boolean; text: string } {
  if (canDiplo(s, id, act)) return { state: s, ok: false, text: '' };
  const me = s.player.countryId;
  const rng = new Rng((s.world.seed ^ Math.floor(s.worldMs / 1000)) >>> 0);
  const ok = rng.chance(diploChance(s, id, act));
  const pairs = { ...s.world.pairs };
  const k = pairKey(me, id);
  const p = { ...pairs[k] };
  const nm = countryById(id).name;
  const mine = countryById(me).name;
  let text: string;
  let text0 = '';
  let trust = 0;
  let fame = 0;
  const promised = (s.officer.promises ?? []).some((x) => x.who === id && x.untilMs > s.worldMs);
  if (act === '선전포고') {
    const brokeAlly = p.rel === '연합' && lordOf(s, me) !== id; // 독립 전쟁은 배신이 아님
    trust = (p.rel === '휴전' ? -5 : 0) + (promised ? -10 : 0) + (brokeAlly ? -10 : 0);
    fame = (promised ? -10 : 0) + (brokeAlly ? -10 : 0);
    const brokeTruce = p.rel === '휴전';
    if (lordOf(s, me) === id) text0 = ' 🗽 독립 전쟁! 속국에서 벗어나요.';
    p.rel = '전쟁';
    p.tension = 0;
    p.weariness = 0;
    text = `${mine}, ${nm}에 선전포고했어요.${text0}${brokeTruce ? ' (휴전을 깨서 신뢰도 −5)' : ''}${promised ? ' (불가침 약속을 깨서 신뢰 −10 · 명성 −10)' : ''}${brokeAlly ? ' (연합을 깨서 신뢰 −10 · 명성 −10)' : ''}`;
  } else if (act === '연합 깨기') {
    p.rel = '중립';
    p.tension = 40;
    p.weariness = 0;
    trust = -5;
    fame = -5;
    text = `${mine}, ${gwa(nm)} 맺은 연합을 깼어요. (신뢰 −5 · 명성 −5)`;
  } else if (act === '휴전 제안') {
    if (ok) {
      p.rel = '휴전';
      p.tension = 20;
      p.weariness = 0;
      text = `${nm}, 우리 휴전 제안을 받아들였어요.`;
    } else text = `${nm}, 휴전 제안을 거절했어요.`;
  } else {
    if (ok) {
      p.rel = '연합';
      p.tension = 0;
      text = `${nm}, 우리와 연합을 맺었어요!`;
      trust = 3;
    } else text = `${nm}, 연합 제안을 거절했어요.`;
  }
  pairs[k] = p;
  const ev: WorldEvent = { t: s.worldMs, kind: '외교', text: `🎖️ ${text}`, mine: true };
  const next: GameState = {
      ...s,
      world: { ...s.world, pairs, events: [ev, ...s.world.events] },
      officer: { ...s.officer, fame: Math.max(0, s.officer.fame + fame), promises: act === '선전포고' ? (s.officer.promises ?? []).filter((x) => x.who !== id) : s.officer.promises, diploReadyMs: act === '선전포고' || act === '연합 깨기' ? s.officer.diploReadyMs : s.worldMs + DIPLO_COOLDOWN_HOURS * H, trust: Math.max(0, Math.min(100, s.officer.trust + trust)) },
  };
  return { ok: ok || act === '선전포고' || act === '연합 깨기', text, state: act === '선전포고' ? endVassalPair(onPlayerWar(s, next, id), me, id) : next };
}
