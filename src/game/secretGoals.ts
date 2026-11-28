// 11-28 대장 결정 "중-7 비밀 목표 3개": 판을 시작하면 나라별 비밀 목표 3개를 받음(예: 한국 "통일", 폴란드 "러시아 견제").
// 채울 때마다 💎 +20 · 세계 영향력 +30. 한 번 채운 목표는 계속 채운 것으로 셈.
import { archRivalsOf } from '../data/archRivals';
import { FRONT } from '../data/cities';
import { COUNTRIES, countryById } from '../data/world';
import { goalsOf } from './goals';
import { pushReport } from './report';
import { Rng } from './rng';
import type { GameState } from './state';
import { isAlive, relationOf } from './world';

export const SECRET_INF = 30;
export const SECRET_RUBY = 20;

export interface SecretDef { id: string; icon: string; name: string; text: string; check: (s: GameState, arg: string) => boolean }
const me = (s: GameState) => s.player.countryId;
const heldFrom = (s: GameState, foe: string) => FRONT.filter((c) => c.home === foe && s.world.owner[c.id] === me(s)).length;
const ownsCapital = (s: GameState, foe: string) => FRONT.some((c) => c.home === foe && c.capital && s.world.owner[c.id] === me(s));

export const SECRETS: SecretDef[] = [
  { id: 'unifyOne', icon: '🕊️', name: '{arg} 통일', text: '{arg}의 수도까지 품어 통일하기', check: (s, a) => ownsCapital(s, a) },
  { id: 'check', icon: '🧱', name: '{arg} 견제', text: '{arg} 본토 도시 2곳 차지하기', check: (s, a) => heldFrom(s, a) >= 2 },
  { id: 'leader', icon: '👑', name: '진영 맹주', text: '진영 맹주가 한 번이라도 되기', check: (s) => !!s.camps?.wasLeader },
  { id: 'race', icon: '🏁', name: '기술 선진국', text: '기술 경주 하나를 세계에서 먼저 끝내기', check: (s) => Object.values(s.race?.winner ?? {}).includes(me(s)) },
  { id: 'proxy', icon: '🎭', name: '그림자 후원자', text: '대리전에서 한 번 이기기', check: (s) => (s.proxy?.wins ?? 0) >= 1 },
  { id: 'allies', icon: '🤝', name: '동맹의 중심', text: '연합국 4곳 갖기', check: (s) => COUNTRIES.filter((c) => c.id !== me(s) && isAlive(s.world, c.id) && relationOf(s.world, me(s), c.id) === '연합').length >= 4 },
  { id: 'cities', icon: '🗺️', name: '대국의 길', text: '도시 30곳 갖기', check: (s) => FRONT.filter((c) => s.world.owner[c.id] === me(s)).length >= 30 },
  { id: 'unifyAny', icon: '🏛️', name: '통일 대업', text: '어느 나라든 한 곳 통일하기', check: (s) => FRONT.some((c) => c.capital && c.home !== me(s) && s.world.owner[c.id] === me(s)) },
  { id: 'faith', icon: '🙏', name: '믿음의 나라', text: '신앙 시설 단계 합 8 만들기', check: (s) => Object.values(s.faith?.lv ?? {}).reduce((a, v) => a + (v ?? 0), 0) >= 8 },
];
export const secretById = (id: string) => SECRETS.find((d) => d.id === id)!;

/** 나라마다 꼭 받는 목표(현실 다툼) */
const FIXED: Record<string, { id: string; arg: string }> = {
  kr: { id: 'unifyOne', arg: 'kp' },
  kp: { id: 'unifyOne', arg: 'kr' },
  pl: { id: 'check', arg: 'ru' },
  ua: { id: 'check', arg: 'ru' },
  fi: { id: 'check', arg: 'ru' },
  tw: { id: 'check', arg: 'cn' },
  cn: { id: 'unifyOne', arg: 'tw' },
  in: { id: 'check', arg: 'pk' },
  pk: { id: 'check', arg: 'in' },
  il: { id: 'check', arg: 'ir' },
  ir: { id: 'check', arg: 'il' },
  sa: { id: 'check', arg: 'ir' },
};

export interface SecretOne { id: string; arg: string; done: boolean }
export type SecretState = SecretOne[];

export function newSecrets(s: GameState): SecretState {
  const id = me(s);
  const rng = new Rng(((s.world.seed ^ 0x85ebca6b) >>> 0) + id.charCodeAt(0));
  const out: SecretState = [];
  const fixed = FIXED[id];
  if (fixed && COUNTRIES.some((c) => c.id === fixed.arg)) out.push({ ...fixed, done: false });
  const rival = archRivalsOf(id).find((x) => COUNTRIES.some((c) => c.id === x) && x !== fixed?.arg);
  if (rival && out.length < 2) out.push({ id: 'check', arg: rival, done: false });
  const pool = SECRETS.filter((d) => d.id !== 'unifyOne' && d.id !== 'check').map((d) => d.id);
  while (out.length < 3 && pool.length) {
    const pick = pool.splice(Math.floor(rng.next() * pool.length), 1)[0];
    out.push({ id: pick, arg: '', done: false });
  }
  return out;
}
export const secretsOf = (s: GameState): SecretState => s.secrets ?? newSecrets(s);
export const secretName = (o: SecretOne) => secretById(o.id).name.replace('{arg}', o.arg ? countryById(o.arg).name : '');
export const secretText = (o: SecretOne) => secretById(o.id).text.replace('{arg}', o.arg ? countryById(o.arg).name : '');
export const secretInfluence = (s: GameState) => (s.secrets ?? []).filter((o) => o.done).length * SECRET_INF;

/** 세계 판단마다: 채운 목표 확인 */
export function secretTick(s: GameState): GameState {
  if (s.ending) return s;
  const list = secretsOf(s);
  let ns: GameState = s.secrets ? s : { ...s, secrets: list };
  let changed = false;
  const next = list.map((o) => {
    if (o.done || !secretById(o.id).check(ns, o.arg)) return o;
    changed = true;
    return { ...o, done: true };
  });
  if (!changed) return ns;
  for (let i = 0; i < next.length; i++) {
    if (!next[i].done || list[i].done) continue;
    const g = goalsOf(ns);
    ns = { ...ns, goals: { ...g, ruby: g.ruby + SECRET_RUBY } };
    ns = pushReport(ns, { icon: '🎯', text: `대장님, 비밀 목표 「${secretName(next[i])}」을(를) 이뤘습니다! 💎 +${SECRET_RUBY} · 세계 영향력 +${SECRET_INF}` });
  }
  return { ...ns, secrets: next };
}
