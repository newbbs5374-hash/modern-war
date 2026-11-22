// 총사령관 권한: 선전포고 · 휴전 제안 · 연합 제안(12시간마다 한 번). 그전엔 AI 지도자가 정함.
import { PERSONALITIES } from '../data/leaders';
import { CITIES } from '../data/cities';
import { countryById } from '../data/world';
import { RANKS } from '../data/ranks';
import { Rng } from './rng';
import type { GameState } from './state';
import { isAlive, isLosing, isRival, pairKey, relationOf, sameBloc, type WorldEvent } from './world';

export const COMMAND_TOP = RANKS.length - 1;
export const DIPLO_COOLDOWN_HOURS = 12;
const H = 3600e3;

export type DiploAct = '선전포고' | '휴전 제안' | '연합 제안';

export function diploReady(s: GameState): number {
  return s.officer.diploReadyMs ?? 0;
}

/** 성공 확률(선전포고는 1) */
export function diploChance(s: GameState, id: string, act: DiploAct): number {
  const me = s.player.countryId;
  const w = s.world;
  const p = w.pairs[pairKey(me, id)];
  const per = PERSONALITIES[w.personalities[id]];
  if (act === '선전포고') return 1;
  if (act === '휴전 제안') {
    const tookFromThem = CITIES.filter((c) => c.home === id && w.owner[c.id] === me).length;
    return Math.min(0.95, 0.15 + p.weariness / 250 + tookFromThem * 0.12 + (isLosing(w, id) ? 0.3 : 0) + (per.peace - 1) * 0.3);
  }
  // 연합: 같은 묶음·같은 신앙이면 쉬움, 맞수면 거의 안 됨, 긴장이 높으면 어려움
  const faith = countryById(me).faith === countryById(id).faith ? 0.15 : 0;
  return Math.max(0.02, Math.min(0.9, 0.2 + (sameBloc(me, id) ? 0.35 : 0) + faith - (isRival(me, id) ? 0.4 : 0) - p.tension / 200 - (per.aggression - 1) * 0.2));
}

export function canDiplo(s: GameState, id: string, act: DiploAct): string | null {
  const me = s.player.countryId;
  if (s.player.rankIndex < COMMAND_TOP) return `${RANKS[COMMAND_TOP].name}이 되면 직접 정해요`;
  if (id === me || !isAlive(s.world, id)) return '할 수 없는 나라';
  if (s.worldMs < diploReady(s)) return '외교 준비 중';
  const rel = relationOf(s.world, me, id);
  if (act === '선전포고' && (rel === '전쟁' || rel === '연합')) return rel === '전쟁' ? '이미 전쟁 중' : '연합국과는 싸울 수 없어요';
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
  let trust = 0;
  if (act === '선전포고') {
    trust = p.rel === '휴전' ? -5 : 0;
    p.rel = '전쟁';
    p.tension = 0;
    p.weariness = 0;
    text = `${mine}, ${nm}에 선전포고했어요.${trust ? ' (휴전을 깨서 신뢰도 −5)' : ''}`;
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
  return {
    ok: ok || act === '선전포고',
    text,
    state: {
      ...s,
      world: { ...s.world, pairs, events: [ev, ...s.world.events] },
      officer: { ...s.officer, diploReadyMs: s.worldMs + DIPLO_COOLDOWN_HOURS * H, trust: Math.max(0, Math.min(100, s.officer.trust + trust)) },
    },
  };
}
