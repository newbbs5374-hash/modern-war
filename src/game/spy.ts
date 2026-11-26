// 첩보·특수 작전: 정보 점수와 나라 예산을 써서 다른 나라에 공작원을 보냄.
// 작전마다 걸리는 시간이 있고, 끝나면 성공/실패가 정해짐. 실패하면 들킨 나라 호감↓·긴장↑.
// 공작 팀 수 = 1 + 지도자 등급 4마다 1(최대 3). 성공률 = 기본 + (은밀+정보) 스탯.
import { originEff } from './origin';
import { cabSpy } from './cabinet';
import { lawEff } from './laws';
import { COUNTRIES, countryById } from '../data/world';
import { CITIES } from '../data/cities';
import { addFavorNote, civOf } from './civ';
import { Rng } from './rng';
import { pushReport } from './report';
import type { GameState } from './state';
import { isAlive, isRival, pairKey, relationOf, type WorldEvent } from './world';

const H = 3600e3;

export type SpyOpId = 'scout' | 'sabotage' | 'secret' | 'steal' | 'rumor' | 'coup';

export interface SpyOpDef {
  id: SpyOpId;
  name: string;
  icon: string;
  text: string;
  intel: number;
  money: number;
  hours: number;
  /** 기본 성공률 */
  base: number;
  /** 들키면 호감·긴장 */
  caught: { favor: number; tension: number };
  /** 이 등급부터 */
  rank: number;
}

export const SPY_OPS: SpyOpDef[] = [
  { id: 'scout', name: '위성 정찰', icon: '🛰️', text: '그 나라 병력·나라 예산을 24시간 동안 봐요(늘 성공). 다른 작전 성공률 +5%.', intel: 5, money: 300, hours: 1, base: 1, caught: { favor: 0, tension: 0 }, rank: 0 },
  { id: 'secret', name: '지도자 비밀 캐기', icon: '📂', text: '약점을 잡아 조용히 압박해요. 성공하면 우리와 긴장 -20, 불만 장부 절반으로.', intel: 15, money: 800, hours: 3, base: 0.6, caught: { favor: -15, tension: 10 }, rank: 1 },
  { id: 'steal', name: '연구 자료 훔치기', icon: '💾', text: '해킹으로 연구 자료를 빼 와요. 성공하면 군사·사회 연구 각각 6시간치.', intel: 20, money: 1200, hours: 4, base: 0.55, caught: { favor: -15, tension: 10 }, rank: 2 },
  { id: 'rumor', name: '여론 공작', icon: '📢', text: '그 나라와 맞수 사이에 소문을 퍼뜨려요. 성공하면 두 나라 긴장 +15(우리에게서 눈을 돌림).', intel: 15, money: 1000, hours: 3, base: 0.6, caught: { favor: -12, tension: 8 }, rank: 2 },
  { id: 'sabotage', name: '군수공장 사보타주', icon: '💣', text: '공장을 멈춰요. 성공하면 그 나라 예산 -12%, 병력 -3%.', intel: 25, money: 1500, hours: 5, base: 0.5, caught: { favor: -25, tension: 20 }, rank: 3 },
  { id: 'coup', name: '반란 지원', icon: '🔥', text: '그 나라 점령지 반군을 몰래 도와요. 성공하면 그 나라가 가진 남의 도시 하나 방어가 크게 떨어짐.', intel: 35, money: 2500, hours: 8, base: 0.4, caught: { favor: -30, tension: 25 }, rank: 5 },
];
export const spyOpById = (id: SpyOpId) => SPY_OPS.find((x) => x.id === id)!;

export interface SpyMission {
  id: number;
  op: SpyOpId;
  target: string;
  startMs: number;
  endMs: number;
}
export interface SpyState {
  active: SpyMission[];
  /** 위성 정찰: 나라 → 이 시각까지 보임 */
  scout: Record<string, number>;
  log: string[];
  nextId: number;
  done: number;
  ok: number;
}
export const newSpy = (): SpyState => ({ active: [], scout: {}, log: [], nextId: 1, done: 0, ok: 0 });
export const spyOf = (s: GameState): SpyState => s.spy ?? newSpy();

export const spyTeams = (s: GameState) => Math.min(3, 1 + Math.floor(s.player.rankIndex / 4));
export const scouted = (s: GameState, id: string) => (spyOf(s).scout[id] ?? 0) > s.worldMs;

/** 성공률(0~0.95) */
export function spyChance(s: GameState, op: SpyOpId, target: string): number {
  const d = spyOpById(op);
  if (d.base >= 1) return 1;
  const st = s.officer.stats;
  const skill = ((st['은밀'] ?? 8) + (st['정보'] ?? 8)) / 2;
  const watch = relationOf(s.world, s.player.countryId, target) === '전쟁' ? -0.05 : 0; // 전쟁 중엔 경계가 심함
  const scout = scouted(s, target) ? 0.05 : 0;
  return Math.max(0.1, Math.min(0.95, d.base + skill * 0.004 + watch + scout + originEff(s, 'spy') + cabSpy(s) + lawEff(s, 'spy')));
}

export function canSpy(s: GameState, op: SpyOpId, target: string): string | null {
  const d = spyOpById(op);
  const me = s.player.countryId;
  if (target === me || !isAlive(s.world, target)) return '고를 수 없는 나라';
  if (s.player.rankIndex < d.rank) return '호칭이 더 올라야 해요';
  const sp = spyOf(s);
  if (sp.active.length >= spyTeams(s)) return `공작 팀 ${spyTeams(s)}개가 모두 나가 있어요`;
  if (sp.active.some((m) => m.target === target && m.op === op)) return '이미 같은 작전 중이에요';
  if (s.officer.intel < d.intel) return `정보 점수 ${d.intel} 필요`;
  if (s.nations[me].treasury < d.money) return `나라 예산 ${d.money.toLocaleString('ko-KR')} 필요`;
  if (op === 'coup' && !coupCity(s, target)) return '그 나라는 남의 도시를 가지고 있지 않아요';
  return null;
}

/** 반란 지원 대상: 그 나라가 점령한(원래 남의) 도시 중 방어가 가장 낮은 곳 */
function coupCity(s: GameState, target: string): string | null {
  const ids = CITIES.filter((c) => s.world.owner[c.id] === target && c.home !== target).map((c) => c.id);
  if (!ids.length) return null;
  return ids.sort((a, b) => s.world.defense[a] - s.world.defense[b])[0];
}

export function startSpy(s: GameState, op: SpyOpId, target: string): GameState {
  if (canSpy(s, op, target)) return s;
  const d = spyOpById(op);
  const me = s.player.countryId;
  const sp = spyOf(s);
  const m: SpyMission = { id: sp.nextId, op, target, startMs: s.worldMs, endMs: s.worldMs + d.hours * H };
  return {
    ...s,
    nations: { ...s.nations, [me]: { ...s.nations[me], treasury: s.nations[me].treasury - d.money } },
    officer: { ...s.officer, intel: s.officer.intel - d.intel },
    spy: { ...sp, active: [...sp.active, m], nextId: sp.nextId + 1 },
  };
}

function addEvent(s: GameState, text: string): GameState {
  const ev: WorldEvent = { t: s.worldMs, kind: '외교', text, mine: true };
  return { ...s, world: { ...s.world, events: [ev, ...s.world.events].slice(0, 200) } };
}
function tension(s: GameState, a: string, b: string, v: number): GameState {
  const k = pairKey(a, b);
  const p = s.world.pairs[k];
  if (!p || p.rel === '전쟁') return s;
  return { ...s, world: { ...s.world, pairs: { ...s.world.pairs, [k]: { ...p, tension: Math.max(0, Math.min(100, p.tension + v)) } } } };
}

/** 작전 하나 끝내기 */
function finish(s: GameState, m: SpyMission): GameState {
  const d = spyOpById(m.op);
  const me = s.player.countryId;
  const name = countryById(m.target).name;
  const rng = new Rng((m.id * 2654435761 + s.world.seed + m.startMs) >>> 0);
  const ok = rng.next() < spyChance(s, m.op, m.target);
  let ns = s;
  let text: string;
  if (ok) {
    switch (m.op) {
      case 'scout':
        ns = { ...ns, spy: { ...spyOf(ns), scout: { ...spyOf(ns).scout, [m.target]: ns.worldMs + 24 * H } } };
        text = `${name} 정찰 사진이 들어왔어요. 24시간 동안 병력·예산이 보여요.`;
        break;
      case 'secret': {
        ns = tension(ns, me, m.target, -20);
        const c = structuredClone(civOf(ns));
        c.grievance[m.target] = (c.grievance[m.target] ?? 0) / 2;
        ns = { ...ns, civ: c };
        text = `${name} 지도자의 약점을 잡았어요. 우리에게 한결 조심스러워졌어요.`;
        break;
      }
      case 'steal': {
        const c = structuredClone(civOf(ns));
        c.bank.mil += 6;
        c.bank.soc += 6;
        ns = { ...ns, civ: c };
        text = `${name}의 연구 자료를 손에 넣었어요. 연구가 빨라져요.`;
        break;
      }
      case 'rumor': {
        const foes = COUNTRIES.map((x) => x.id).filter((id) => id !== m.target && id !== me && isAlive(ns.world, id) && isRival(m.target, id));
        const foe = foes[0] ?? COUNTRIES.map((x) => x.id).find((id) => id !== m.target && id !== me && isAlive(ns.world, id));
        if (foe) ns = tension(ns, m.target, foe, 15);
        text = `${name}${foe ? `와 ${countryById(foe).name}` : ''} 사이에 의심이 퍼졌어요.`;
        break;
      }
      case 'sabotage': {
        const n = ns.nations[m.target];
        ns = { ...ns, nations: { ...ns.nations, [m.target]: { treasury: n.treasury * 0.88, troops: n.troops * 0.97 } } };
        text = `${name} 군수공장이 멈췄어요! 예산 -12%, 병력 -3%.`;
        break;
      }
      case 'coup': {
        const city = coupCity(ns, m.target);
        if (city) ns = { ...ns, world: { ...ns.world, defense: { ...ns.world.defense, [city]: Math.max(0, ns.world.defense[city] * 0.4) } } };
        text = `${name} 점령지 반군이 들고일어났어요. 그 도시 방어가 크게 떨어졌어요.`;
        break;
      }
    }
  } else {
    ns = addFavorNote(ns, m.target, '첩보 작전이 들킴', d.caught.favor);
    ns = tension(ns, me, m.target, d.caught.tension);
    text = `${d.name} 실패… ${name}에 공작원이 들켰어요. 호감 ${d.caught.favor}, 긴장 +${d.caught.tension}.`;
  }
  const sp = spyOf(ns);
  ns = { ...ns, spy: { ...sp, active: sp.active.filter((x) => x.id !== m.id), log: [`${ok ? '✅' : '❌'} ${d.icon} ${text}`, ...sp.log].slice(0, 10), done: sp.done + 1, ok: sp.ok + (ok ? 1 : 0) } };
  if (!ok || m.op !== 'scout') ns = addEvent(ns, `${d.icon} ${ok ? '' : '들킴: '}${text}`);
  return pushReport(ns, { icon: ok ? d.icon : '🚨', text });
}

/** 시간이 흐를 때: 끝난 작전 처리 */
export function spyTick(s: GameState): GameState {
  const sp = s.spy;
  if (!sp || !sp.active.length) return s;
  let ns = s;
  for (const m of sp.active) if (s.worldMs >= m.endMs) ns = finish(ns, m);
  return ns;
}

/** 위성 정찰로 보이는 숫자 */
export function scoutView(s: GameState, id: string) {
  if (!scouted(s, id)) return null;
  const n = s.nations[id];
  return { treasury: Math.round(n.treasury), troops: Math.round(n.troops), untilMs: spyOf(s).scout[id] };
}
