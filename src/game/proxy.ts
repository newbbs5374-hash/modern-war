// 11-28 대장 결정 "중-2 대리전": AI끼리 싸울 때 한쪽에 무기·돈·정보를 대 주고, 이기면 영향력·광물 이권을 받음.
//  · 무기: 편든 나라 병력 +4% · 돈: 편든 나라 국고 + · 정보: 상대 국경 도시 방어도 −12
//  · 지원마다 15% 확률로 상대에게 들킴(호감 −8, 긴장 +10)
//  · 전쟁이 끝났을 때 편든 나라가 도시를 더 많이 얻었으면 승리: 💎 +10 · 그 나라 호감 +15 · 광물 이권 14일(자원 +5%, 3개까지) · 세계 영향력 +10(최대 40)
import { countryById } from '../data/world';
import { addFavorNote } from './civ';
import { registerDomRows } from './domestic';
import { goalsOf } from './goals';
import { firmLv } from './arms';
import { pushReport } from './report';
import { Rng } from './rng';
import { priceBase, type GameState } from './state';
import { frontOf, isAlive, pairKey, relationOf } from './world';

const H = 3600e3;
const DAY = 24 * H;
export const PROXY_ACT = 2;
export type ProxyKind = 'arms' | 'money' | 'intel';
export const PROXY_KINDS: Record<ProxyKind, { icon: string; name: string; text: string; cost: number }> = {
  arms: { icon: '🔫', name: '무기 지원', text: '편든 나라 병력 +4%', cost: 0.6 },
  money: { icon: '💵', name: '돈 지원', text: '편든 나라 국고 + (낸 돈의 1.5배)', cost: 0.8 },
  intel: { icon: '🛰️', name: '정보 지원', text: '상대 국경 도시 한 곳 방어도 −12', cost: 0.3 },
};
export const PROXY_MAX = 3;
export const PROXY_WAIT = 4 * H;
export const PROXY_CAUGHT = 0.15;
export const PROXY_RUBY = 10;
export const RIGHTS_MS = 14 * DAY;
export const RIGHTS_MAX = 3;
export const RIGHTS_RES = 0.05;
export const PROXY_INF = 10;
export const PROXY_INF_MAX = 40;

export interface ProxyOne { side: string; foe: string; startSide: number; startFoe: number; n: number; lastMs: number }
export interface ProxyState { list: Record<string, ProxyOne>; wins: number; rights: Array<{ from: string; untilMs: number }> }
export const proxyOf = (s: GameState): ProxyState => s.proxy ?? { list: {}, wins: 0, rights: [] };
export const proxyOn = (s: GameState) => (s.world.act ?? 3) >= PROXY_ACT;

/** 지금 AI끼리 하는 전쟁들 */
export function aiWars(s: GameState): Array<{ key: string; a: string; b: string }> {
  const me = s.player.countryId;
  const out: Array<{ key: string; a: string; b: string }> = [];
  for (const [key, p] of Object.entries(s.world.pairs)) {
    if (p.rel !== '전쟁') continue;
    const [a, b] = key.split('|');
    if (a === me || b === me || !isAlive(s.world, a) || !isAlive(s.world, b)) continue;
    out.push({ key, a, b });
  }
  return out;
}
export const proxyCost = (s: GameState, kind: ProxyKind) => Math.max(60, Math.round(priceBase(s) * PROXY_KINDS[kind].cost));

export function canBack(s: GameState, side: string, foe: string, kind: ProxyKind): string | null {
  if (!proxyOn(s)) return `대리전은 ${PROXY_ACT}장부터 열려요`;
  const me = s.player.countryId;
  if (side === me || foe === me) return '우리 전쟁은 대리전이 아니에요';
  if (relationOf(s.world, side, foe) !== '전쟁') return '두 나라가 싸우고 있지 않아요';
  if (relationOf(s.world, me, side) === '전쟁') return '우리와 싸우는 나라는 도울 수 없어요';
  const one = proxyOf(s).list[pairKey(side, foe)];
  if (one && one.side !== side) return '이미 반대편을 돕고 있어요';
  if (one && one.n >= PROXY_MAX * 3) return '이 전쟁엔 더 도울 수 없어요';
  if (one && s.worldMs - one.lastMs < PROXY_WAIT) return '4시간에 한 번 도울 수 있어요';
  if (s.nations[me].treasury < proxyCost(s, kind)) return '나라 예산이 모자라요';
  return null;
}
/** 한쪽을 몰래 돕기 */
export function backSide(s: GameState, side: string, foe: string, kind: ProxyKind): { state: GameState; text: string } {
  const why = canBack(s, side, foe, kind);
  if (why) return { state: s, text: why };
  const me = s.player.countryId;
  const p = proxyOf(s);
  const key = pairKey(side, foe);
  const cost = proxyCost(s, kind);
  const one: ProxyOne = p.list[key] ?? { side, foe, startSide: frontOf(s.world, side).length, startFoe: frontOf(s.world, foe).length, n: 0, lastMs: 0 };
  const rng = new Rng(((s.world.seed ^ Math.floor(s.worldMs / 1000)) * 2654435761) >>> 0);
  const nations = { ...s.nations, [me]: { ...s.nations[me], treasury: s.nations[me].treasury - cost } };
  let world = s.world;
  let what = '';
  if (kind === 'arms') {
    // 11-28 방산 수출 시장: 우리 지상 무기 기업이 클수록 대리전에서 우리 무기가 더 힘을 냄
    const add = Math.round(nations[side].troops * 0.04 * (1 + firmLv(s, 'land') * 0.25));
    nations[side] = { ...nations[side], troops: nations[side].troops + add };
    what = `${countryById(side).name} 병력 +${add.toLocaleString('ko-KR')}`;
  } else if (kind === 'money') {
    nations[side] = { ...nations[side], treasury: nations[side].treasury + Math.round(cost * 1.5) };
    what = `${countryById(side).name} 국고 +${Math.round(cost * 1.5).toLocaleString('ko-KR')}`;
  } else {
    const list = frontOf(s.world, foe);
    const target = list.sort((x, y) => (s.world.defense[x] ?? 0) - (s.world.defense[y] ?? 0))[0];
    if (target) {
      world = { ...s.world, defense: { ...s.world.defense, [target]: Math.max(1, (s.world.defense[target] ?? 0) - 12) } };
      what = `${countryById(foe).name} 도시 방어도 −12`;
    }
  }
  let ns: GameState = { ...s, nations, world, proxy: { ...p, list: { ...p.list, [key]: { ...one, n: one.n + 1, lastMs: s.worldMs } } } };
  ns = addFavorNote(ns, side, '🤝 전쟁 중에 몰래 도와줌', 3);
  let text = `${PROXY_KINDS[kind].icon} ${countryById(side).name}을(를) 도왔어요: ${what} (나라 예산 −${cost.toLocaleString('ko-KR')})`;
  if (rng.chance(PROXY_CAUGHT)) {
    ns = addFavorNote(ns, foe, '🕵️ 적을 몰래 도운 게 들킴', -8);
    const pk = pairKey(me, foe);
    const pr = ns.world.pairs[pk];
    if (pr && pr.rel !== '전쟁') ns = { ...ns, world: { ...ns.world, pairs: { ...ns.world.pairs, [pk]: { ...pr, tension: Math.min(95, pr.tension + 10) } } } };
    text += ` · ⚠️ ${countryById(foe).name}에 들켰어요(호감 −8 · 긴장 +10)`;
  }
  return { state: ns, text };
}

export const proxyInfluence = (s: GameState) => Math.min(PROXY_INF_MAX, proxyOf(s).wins * PROXY_INF);

/** 세계 판단마다: 끝난 대리전 정산 */
export function proxyTick(s: GameState): GameState {
  const p0 = s.proxy;
  if (!p0 || s.ending) return s;
  let ns = s;
  let p = { ...p0, list: { ...p0.list }, rights: p0.rights.filter((r) => r.untilMs > s.worldMs) };
  let changed = p.rights.length !== p0.rights.length;
  for (const [key, one] of Object.entries(p0.list)) {
    if (relationOf(s.world, one.side, one.foe) === '전쟁' && isAlive(s.world, one.side) && isAlive(s.world, one.foe)) continue;
    changed = true;
    delete p.list[key];
    const delta = (frontOf(s.world, one.side).length - one.startSide) - (frontOf(s.world, one.foe).length - one.startFoe);
    const won = !isAlive(s.world, one.foe) || (isAlive(s.world, one.side) && delta > 0);
    const sn = countryById(one.side).name, fn = countryById(one.foe).name;
    if (won) {
      p = { ...p, wins: p.wins + 1, rights: [...p.rights, { from: one.side, untilMs: s.worldMs + RIGHTS_MS }].slice(-RIGHTS_MAX) };
      ns = addFavorNote(ns, one.side, '🏅 대리전 승리를 도와줌', 15);
      const g = goalsOf(ns);
      ns = { ...ns, goals: { ...g, ruby: g.ruby + PROXY_RUBY } };
      ns = pushReport(ns, { icon: '🏅', text: `대장님, 우리가 도운 ${sn}이(가) ${fn}과의 전쟁에서 이겼습니다! 💎 +${PROXY_RUBY} · 호감 +15 · 광물 이권 14일(자원 +${Math.round(RIGHTS_RES * 100)}%) · 세계 영향력 +${PROXY_INF}` });
    } else {
      ns = pushReport(ns, { icon: '🥀', text: `대장님, 우리가 도운 ${sn}의 전쟁이 ${isAlive(s.world, one.side) ? '소득 없이 끝났습니다' : '패배로 끝났습니다'}. 대 준 것은 돌려받지 못합니다.` });
    }
  }
  return changed ? { ...ns, proxy: p } : ns;
}

registerDomRows((s, key) => {
  if (key !== 'res' || !s.proxy) return [];
  const n = s.proxy.rights.filter((r) => r.untilMs > s.worldMs).length;
  return n ? [[`⛏️ 대리전 광물 이권 ${n}곳`, n * RIGHTS_RES]] : [];
});
