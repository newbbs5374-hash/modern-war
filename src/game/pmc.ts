// 11-28 새 병과 3: 용병(민간 군사기업). 돈을 내고 72시간 계약으로 바로 빌리는 부대.
// 우리 병력(사람)이 안 들고 쓰러져도 병력이 안 줄어요. 대신 충성도가 낮아 전쟁 중엔 더 많은 돈을 주는 나라로 넘어갈 수 있어요.
import { pushReport } from './report';
import { Rng } from './rng';
import type { GameState } from './state';
import { COUNTRIES } from '../data/world';
import { isAlive, relationOf } from './world';

const H = 3600e3;
export const PMC_UNIT = '용병';
export const PMC_HOURS = 72;
export const PMC_MAX = 3;
export const PMC_SIZES = [2, 4, 6] as const;
/** 한 부대 값(나라 예산), 계약이 늘수록 비싸짐 */
export const PMC_PRICE = 900;
/** 전쟁 중 계약 하나가 한 시간에 넘어갈 확률 */
export const PMC_DESERT = 0.004;
export const PMC_FIRMS = ['블랙스톤 시큐리티', '아이언울프', '세이블 디펜스', '노스게이트', '그레이호크'];

export interface PmcContract { id: number; n: number; untilMs: number; firm: string }
export interface PmcState { list: PmcContract[]; nextId: number; seed: number; nextCheckMs: number }
export const pmcOf = (s: GameState): PmcState => s.pmc ?? { list: [], nextId: 1, seed: (s.world.seed ^ 0x51ed) >>> 0, nextCheckMs: s.worldMs + H };
export const pmcCost = (s: GameState, n: number) => Math.round(PMC_PRICE * n * (1 + 0.25 * pmcOf(s).list.length));
const atWar = (s: GameState) => COUNTRIES.some((c) => c.id !== s.player.countryId && isAlive(s.world, c.id) && relationOf(s.world, s.player.countryId, c.id) === '전쟁');

export function canHire(s: GameState, n: number): string | null {
  if (pmcOf(s).list.length >= PMC_MAX) return `계약은 ${PMC_MAX}개까지예요`;
  if (s.nations[s.player.countryId].treasury < pmcCost(s, n)) return '나라 예산이 모자라요';
  return null;
}
export function hire(s: GameState, n: number): { state: GameState; text: string } {
  const why = canHire(s, n);
  if (why) return { state: s, text: why };
  const p = pmcOf(s);
  const rng = new Rng(p.seed);
  const firm = rng.pick(PMC_FIRMS);
  const me = s.player.countryId;
  const cost = pmcCost(s, n);
  const ns: GameState = {
    ...s,
    nations: { ...s.nations, [me]: { ...s.nations[me], treasury: s.nations[me].treasury - cost } },
    economy: { ...s.economy, army: { ...s.economy.army, [PMC_UNIT]: (s.economy.army[PMC_UNIT] ?? 0) + n } },
    pmc: { ...p, list: [...p.list, { id: p.nextId, n, untilMs: s.worldMs + PMC_HOURS * H, firm }], nextId: p.nextId + 1, seed: rng.seed },
  };
  return { state: ns, text: `💼 ${firm}과 용병 ${n}부대를 ${PMC_HOURS}시간 계약했어요. 바로 3D 전투에 낼 수 있어요.` };
}
function drop(s: GameState, c: PmcContract): GameState {
  const have = s.economy.army[PMC_UNIT] ?? 0;
  const p = pmcOf(s);
  return { ...s, economy: { ...s.economy, army: { ...s.economy.army, [PMC_UNIT]: Math.max(0, have - c.n) } }, pmc: { ...p, list: p.list.filter((x) => x.id !== c.id) } };
}
export function pmcTick(s: GameState): GameState {
  if (!s.pmc?.list.length) return s;
  let ns = s;
  for (const c of pmcOf(ns).list) {
    if (c.untilMs <= ns.worldMs) {
      ns = drop(ns, c);
      ns = pushReport(ns, { icon: '💼', text: `${c.firm} 용병 계약(${c.n}부대)이 끝나 돌아갔어요.` });
    }
  }
  // 전쟁 중엔 한 시간마다 배신 확인
  let p = pmcOf(ns);
  if (ns.worldMs >= p.nextCheckMs) {
    const rng = new Rng(p.seed);
    const war = atWar(ns);
    for (const c of [...p.list]) {
      if (war && rng.next() < PMC_DESERT * c.n) {
        ns = drop(ns, c);
        ns = pushReport(ns, { icon: '🐍', text: `${c.firm} 용병 ${c.n}부대가 돈을 더 주는 쪽으로 넘어갔어요! 계약이 깨졌어요.` });
      }
    }
    p = pmcOf(ns);
    ns = { ...ns, pmc: { ...p, seed: rng.seed, nextCheckMs: ns.worldMs + H } };
  }
  return ns;
}
