// 내정 3 방산 기업과 수출(11/27 종합 확장안): 방산 기업 4곳을 키우고 다른 나라에 무기를 팔아 예산과 호감을 얻음.
// 판 무기는 그 나라 병력으로 실제로 더해짐(그 나라가 싸울 때 그만큼 셈). 전쟁 중인 나라에는 못 팖.
// 내 적과 싸우는 나라에 팔면 호감이 더 오르고, 내 연합국과 싸우는 나라에 팔면 연합국이 싫어함.
import { COUNTRIES, countryById } from '../data/world';
import { addFavorNote } from './civ';
import { domLog, domOf, payTreasury, registerDomRows, withDom, type Rows } from './domestic';
import { budgetPerDay, type GameState } from './state';
import { isAlive, relationOf } from './world';

export type FirmId = 'land' | 'sea' | 'air' | 'missile';
export const FIRMS: Array<{ id: FirmId; icon: string; name: string; goods: string }> = [
  { id: 'land', icon: '🛡️', name: '지상 무기', goods: '전차·자주포' },
  { id: 'sea', icon: '⚓', name: '조선', goods: '호위함·잠수함' },
  { id: 'air', icon: '✈️', name: '항공', goods: '전투기·훈련기' },
  { id: 'missile', icon: '🚀', name: '유도 무기', goods: '미사일·방공망' },
];
export const firmById = (id: string) => FIRMS.find((f) => f.id === id);
export const FIRM_MAX = 5;
/** 기업 한 단계 올리는 값: 나라 하루 예산 × 이만큼 × (다음 단계) */
export const FIRM_COST_DAYS = 1.5;
/** 수출 계약 하나가 이어지는 시간과, 기업 단계 하나마다의 예산 덤 */
export const DEAL_MS = 3 * 24 * 3600e3;
export const DEAL_BUDGET = 0.012;
/** 계약할 때 사는 나라 병력에 더해지는 양(기업 단계 하나마다) */
export const DEAL_TROOPS = 600;
export const DEAL_FAVOR = 6;

export interface ArmsDeal {
  to: string;
  firm: FirmId;
  lv: number;
  untilMs: number;
}
export interface ArmsState {
  lv: Partial<Record<FirmId, number>>;
  deals: ArmsDeal[];
  /** 지금까지 맺은 계약 수 */
  sold: number;
}
export const armsOf = (s: GameState): ArmsState => domOf(s).arms ?? { lv: {}, deals: [], sold: 0 };
export const firmLv = (s: GameState, id: FirmId) => armsOf(s).lv[id] ?? 0;
export const liveDeals = (s: GameState) => armsOf(s).deals.filter((d) => d.untilMs > s.worldMs && isAlive(s.world, d.to) && relationOf(s.world, s.player.countryId, d.to) !== '전쟁');
/** 한꺼번에 맺을 수 있는 계약 수: 기업 단계 합 ÷ 2(올림), 많아야 6 */
export const dealSlots = (s: GameState) => Math.min(6, Math.ceil(FIRMS.reduce((a, f) => a + firmLv(s, f.id), 0) / 2));

export const firmCost = (s: GameState, id: FirmId) => Math.round(budgetPerDay(s, s.player.countryId) * FIRM_COST_DAYS * (firmLv(s, id) + 1));
export function canGrowFirm(s: GameState, id: FirmId): string | null {
  if (!firmById(id)) return '없는 기업이에요';
  if (firmLv(s, id) >= FIRM_MAX) return '끝까지 키웠어요';
  const me = s.nations[s.player.countryId];
  if (!me || me.treasury < firmCost(s, id)) return '나라 예산이 모자라요';
  return null;
}
export function growFirm(s: GameState, id: FirmId): GameState {
  if (canGrowFirm(s, id)) return s;
  const paid = payTreasury(s, firmCost(s, id));
  if (!paid) return s;
  const a = armsOf(paid);
  const lv = (a.lv[id] ?? 0) + 1;
  const f = firmById(id)!;
  return domLog(withDom(paid, { arms: { ...a, lv: { ...a.lv, [id]: lv } } }), `${f.icon} ${f.name} 기업 ${lv}단계`);
}

/** 그 나라에 팔면 생기는 일 미리 보기 */
export function dealPreview(s: GameState, to: string): { favor: number; angry: string[] } {
  const me = s.player.countryId;
  const others = COUNTRIES.filter((c) => c.id !== me && c.id !== to && isAlive(s.world, c.id));
  const atWar = others.filter((c) => relationOf(s.world, to, c.id) === '전쟁');
  const fightsMyFoe = atWar.some((c) => relationOf(s.world, me, c.id) === '전쟁');
  const angry = atWar.filter((c) => relationOf(s.world, me, c.id) === '연합').map((c) => c.id);
  return { favor: DEAL_FAVOR + (fightsMyFoe ? 4 : 0), angry };
}
export function canDeal(s: GameState, to: string, firm: FirmId): string | null {
  const me = s.player.countryId;
  if (to === me || !COUNTRIES.some((c) => c.id === to) || !isAlive(s.world, to)) return '팔 수 없는 나라예요';
  if (firmLv(s, firm) < 1) return '기업을 먼저 키워요';
  if (relationOf(s.world, me, to) === '전쟁') return '전쟁 중인 나라에는 못 팔아요';
  const live = liveDeals(s);
  if (live.some((d) => d.to === to)) return '이미 계약 중인 나라예요';
  if (live.length >= dealSlots(s)) return `계약은 ${dealSlots(s)}건까지(기업을 키우면 늘어요)`;
  return null;
}
export function signDeal(s: GameState, to: string, firm: FirmId): GameState {
  if (canDeal(s, to, firm)) return s;
  const a = armsOf(s);
  const lv = firmLv(s, firm);
  const f = firmById(firm)!;
  const pv = dealPreview(s, to);
  const buyer = s.nations[to];
  let ns: GameState = buyer ? { ...s, nations: { ...s.nations, [to]: { ...buyer, troops: buyer.troops + DEAL_TROOPS * lv } } } : s;
  ns = withDom(ns, { arms: { ...a, deals: [...liveDeals(s), { to, firm, lv, untilMs: s.worldMs + DEAL_MS }], sold: a.sold + 1 } });
  ns = addFavorNote(ns, to, '🤝 무기 수출 계약', pv.favor);
  for (const id of pv.angry) ns = addFavorNote(ns, id, `😠 우리 적(${countryById(to).name})에 무기를 팖`, -8);
  return domLog(ns, `${f.icon} ${countryById(to).name}에 ${f.goods} 수출 계약(3일) · 호감 +${pv.favor}${pv.angry.length ? ` · ${pv.angry.map((id) => countryById(id).name).join('·')} 호감 −8` : ''}`);
}

registerDomRows((s, key) => {
  const rows: Rows = [];
  if (key !== 'budget') return rows;
  for (const d of liveDeals(s)) {
    const f = firmById(d.firm);
    if (f) rows.push([`${f.icon} 무기 수출(${countryById(d.to).name})`, DEAL_BUDGET * d.lv]);
  }
  return rows;
});
