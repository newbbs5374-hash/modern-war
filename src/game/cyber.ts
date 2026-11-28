// 11-28 7단계 추가 9 "우주·사이버 사령부": 전쟁 없이 상대 정보·경제를 막음(위성 요격은 전략군 → 우주에 그대로).
//  · 전력망 마비: 48시간 그 나라 나라 예산 −12% · 금융망 해킹: 그 나라 국고 3%를 가져옴 · 통신 교란: 그 나라 도시 3곳 방어도 −10
//  · 성공 60% + 사이버 방어 단계마다 +5%, 실패하거나 들키면(30%) 호감 −12 · 긴장 +15. 12시간에 한 번
//  · 사이버 방어(0~5단계): AI의 사이버 공격을 단계마다 18%씩 막음. 우리와 긴장 높은 AI가 가끔 전력망을 노림(우리 예산 −8% 24시간)
import { COUNTRIES, countryById } from '../data/world';
import { FRONT } from '../data/cities';
import { addFavorNote } from './civ';
import { pushReport } from './report';
import { Rng } from './rng';
import { priceBase, type GameState } from './state';
import { isAlive, pairKey, relationOf } from './world';

const H = 3600e3;
export const CYBER_WAIT = 12 * H;
export const DEF_MAX = 5;
export type CyberOp = 'grid' | 'bank' | 'jam';
export const CYBER_OPS: Record<CyberOp, { icon: string; name: string; text: string; cost: number }> = {
  grid: { icon: '⚡', name: '전력망 마비', text: '48시간 그 나라 예산 −12%', cost: 0.8 },
  bank: { icon: '🏦', name: '금융망 해킹', text: '그 나라 국고 3%를 가져옴', cost: 0.6 },
  jam: { icon: '📡', name: '통신 교란', text: '그 나라 도시 3곳 방어도 −10', cost: 0.5 },
};
export interface CyberState { def: number; readyMs: number; down: Record<string, number>; seed: number }
export const cyberOf = (s: GameState): CyberState => s.cyber ?? { def: 0, readyMs: 0, down: {}, seed: (s.world.seed ^ 0x1f83d9ab) >>> 0 };
export const cyberCost = (s: GameState, op: CyberOp) => Math.max(100, Math.round(priceBase(s) * CYBER_OPS[op].cost));
export const defCost = (s: GameState) => Math.max(300, Math.round(priceBase(s) * 2 * (cyberOf(s).def + 1)));
/** 나라 예산 배율(전력망 마비) */
export const cyberMult = (s: GameState, id: string) => ((s.cyber?.down[id] ?? 0) > s.worldMs ? (id === s.player.countryId ? 0.92 : 0.88) : 1);
export const cyberChance = (s: GameState) => Math.min(0.9, 0.6 + cyberOf(s).def * 0.05);

export function canDefUp(s: GameState): string | null {
  if (cyberOf(s).def >= DEF_MAX) return '끝까지 키웠어요';
  if (s.nations[s.player.countryId].treasury < defCost(s)) return '나라 예산이 모자라요';
  return null;
}
export function defUp(s: GameState): { state: GameState; text: string } {
  const why = canDefUp(s);
  if (why) return { state: s, text: why };
  const me = s.player.countryId;
  const c = cyberOf(s);
  return {
    state: { ...s, cyber: { ...c, def: c.def + 1 }, nations: { ...s.nations, [me]: { ...s.nations[me], treasury: s.nations[me].treasury - defCost(s) } } },
    text: `🛡️ 사이버 사령부 방어 ${c.def + 1}단계: AI 사이버 공격을 ${(c.def + 1) * 18}% 막아요 · 우리 작전 성공 +5%`,
  };
}
export function canCyber(s: GameState, foe: string, op: CyberOp): string | null {
  const me = s.player.countryId;
  if (foe === me || !isAlive(s.world, foe)) return '할 수 없는 나라예요';
  if (relationOf(s.world, me, foe) === '연합') return '연합국에는 하지 않아요';
  if (cyberOf(s).readyMs > s.worldMs) return '사이버 작전은 12시간에 한 번이에요';
  if (s.nations[me].treasury < cyberCost(s, op)) return '나라 예산이 모자라요';
  return null;
}
export function runCyber(s: GameState, foe: string, op: CyberOp): { state: GameState; text: string } {
  const why = canCyber(s, foe, op);
  if (why) return { state: s, text: why };
  const me = s.player.countryId;
  const c = cyberOf(s);
  const rng = new Rng(c.seed);
  const d = CYBER_OPS[op];
  let ns: GameState = { ...s, nations: { ...s.nations, [me]: { ...s.nations[me], treasury: s.nations[me].treasury - cyberCost(s, op) } } };
  const ok = rng.chance(cyberChance(s));
  const caught = !ok || rng.chance(0.3);
  let text: string;
  let down = c.down;
  if (ok) {
    if (op === 'grid') down = { ...c.down, [foe]: s.worldMs + 48 * H };
    else if (op === 'bank') {
      const take = Math.round(ns.nations[foe].treasury * 0.03);
      ns = { ...ns, nations: { ...ns.nations, [foe]: { ...ns.nations[foe], treasury: ns.nations[foe].treasury - take }, [me]: { ...ns.nations[me], treasury: ns.nations[me].treasury + take } } };
    } else {
      const defense = { ...ns.world.defense };
      FRONT.filter((x) => ns.world.owner[x.id] === foe).slice(0, 3).forEach((x) => (defense[x.id] = Math.max(1, (defense[x.id] ?? 0) - 10)));
      ns = { ...ns, world: { ...ns.world, defense } };
    }
    text = `${d.icon} ${countryById(foe).name}에 ${d.name} 성공! ${d.text}`;
  } else text = `${d.icon} ${countryById(foe).name}에 ${d.name} 실패.`;
  if (caught) {
    ns = addFavorNote(ns, foe, `${d.icon} 사이버 공격이 들킴`, -12);
    const k = pairKey(me, foe);
    const p = ns.world.pairs[k];
    if (p && p.rel !== '전쟁') ns = { ...ns, world: { ...ns.world, pairs: { ...ns.world.pairs, [k]: { ...p, tension: Math.min(95, p.tension + 15) } } } };
    text += ' ⚠️ 들켰어요(호감 −12 · 긴장 +15)';
  }
  return { state: { ...ns, cyber: { ...c, down, readyMs: s.worldMs + CYBER_WAIT, seed: rng.seed } }, text };
}

/** 세계 판단마다: AI의 사이버 공격 */
export function cyberTick(s: GameState): GameState {
  if (s.ending || (s.world.act ?? 3) < 2) return s;
  const me = s.player.countryId;
  const c = cyberOf(s);
  if ((c.down[me] ?? 0) > s.worldMs) return s.cyber ? s : { ...s, cyber: c };
  const rng = new Rng(c.seed);
  const foes = COUNTRIES.filter((x) => x.id !== me && isAlive(s.world, x.id) && x.economy >= 40 && (relationOf(s.world, me, x.id) === '전쟁' || (s.world.pairs[pairKey(me, x.id)]?.tension ?? 0) >= 65));
  if (!foes.length || !rng.chance(0.003 * foes.length)) return { ...s, cyber: { ...c, seed: rng.seed } };
  const by = rng.pick(foes);
  if (rng.chance(c.def * 0.18)) {
    return pushReport({ ...s, cyber: { ...c, seed: rng.seed } }, { icon: '🛡️', text: `대장님, ${by.name}의 전력망 해킹을 사이버 사령부가 막아 냈습니다.` });
  }
  return pushReport({ ...s, cyber: { ...c, down: { ...c.down, [me]: s.worldMs + 24 * H }, seed: rng.seed } }, { icon: '⚡', text: `대장님, ${by.name}의 해킹으로 전력망이 마비됐습니다. 24시간 나라 예산 −8%. 사이버 방어를 키우면 막을 수 있습니다.` });
}
