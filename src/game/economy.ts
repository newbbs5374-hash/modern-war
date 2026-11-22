// 6단계 내정: 시설 3개(산업·인프라·복지) · 전략 자원 7종 · 병과 생산 · 무역.
// 내 나라만 다룸. 순수 계산(새 상태를 돌려줌).
import { CITIES } from '../data/cities';
import {
  ALLY_DISCOUNT,
  CHORES,
  CHORE_EXP,
  CHORE_HOURS,
  CITY_RES,
  ECON_RANK,
  FACILITIES,
  FACILITY_EFF,
  OCCUPIED_RES,
  PASSIVE_EXP_PER_HOUR,
  RESOURCES,
  RES_PRICE,
  SELL_RATE,
  TOP_RANK,
  TRADE_MULT,
  UNIT_COST,
  UPGRADE_EXP,
  UPGRADE_HOURS,
  UPGRADE_MONEY,
  emptyStock,
  specialCost,
  unitRank,
  type Facility,
  type Res,
  type Stock,
  type UnitCost,
} from '../data/economy';
import { COUNTRIES, countryById } from '../data/world';
import { RANKS } from '../data/ranks';
import type { GameState } from './state';
import { isAlive, relationOf } from './world';

const HOUR = 3600e3;

export interface FacilityState {
  level: number;
  exp: number;
  /** 올리는 공사가 끝나는 시각(0 = 공사 없음) */
  buildEndMs: number;
}

export interface QueueItem {
  id: number;
  unit: string;
  special: boolean;
  startMs: number;
  endMs: number;
}

export interface EconomyState {
  facilities: Record<Facility, FacilityState>;
  stock: Stock;
  chore: { fac: Facility; title: string; endMs: number } | null;
  queue: QueueItem[];
  /** 만든 부대 수(이름 → 개수) */
  army: Record<string, number>;
  /** 만든 부대 전투력 합 */
  power: number;
  nextId: number;
  /** 최근 내정 소식 */
  log: string[];
}

export function newEconomy(): EconomyState {
  const f = (): FacilityState => ({ level: 1, exp: 0, buildEndMs: 0 });
  return { facilities: { 산업: f(), 인프라: f(), 복지: f() }, stock: emptyStock(), chore: null, queue: [], army: {}, power: 0, nextId: 1, log: [] };
}

function cloneEco(e: EconomyState): EconomyState {
  return {
    facilities: { 산업: { ...e.facilities.산업 }, 인프라: { ...e.facilities.인프라 }, 복지: { ...e.facilities.복지 } },
    stock: { ...e.stock },
    chore: e.chore ? { ...e.chore } : null,
    queue: e.queue.map((q) => ({ ...q })),
    army: { ...e.army },
    power: e.power,
    nextId: e.nextId,
    log: [...e.log],
  };
}

function log(e: EconomyState, text: string) {
  e.log.unshift(text);
  if (e.log.length > 8) e.log.length = 8;
}

export const facilityEff = (e: EconomyState, f: Facility) => FACILITY_EFF[Math.max(0, Math.min(4, e.facilities[f].level - 1))];
/** 산업: 예산·자원 배율 */
export const industryMult = (e: EconomyState) => 1 + facilityEff(e, '산업');
/** 복지: 모병 배율 */
export const welfareMult = (e: EconomyState) => 1 + facilityEff(e, '복지');
/** 인프라: 생산 속도 배율 */
export const infraMult = (e: EconomyState) => 1 + facilityEff(e, '인프라');

/** 내 나라가 하루(실제 1시간)에 얻는 자원 */
export function resPerDay(s: GameState): Stock {
  const me = s.player.countryId;
  const out = emptyStock();
  const mult = industryMult(s.economy);
  for (const c of CITIES) {
    if (s.world.owner[c.id] !== me) continue;
    const r = CITY_RES[c.name] ?? {};
    const k = c.home === me ? 1 : OCCUPIED_RES;
    for (const [res, v] of Object.entries(r)) out[res as Res] += v! * k * mult;
  }
  return out;
}

/** 시간이 흐르며 쌓이는 것(자원·시설 경험치) */
export function accrueEconomy(s: GameState, ms: number): EconomyState {
  const e = { ...s.economy, stock: { ...s.economy.stock }, facilities: { ...s.economy.facilities } };
  const days = ms / HOUR;
  const per = resPerDay(s);
  for (const r of RESOURCES) e.stock[r] += per[r] * days;
  for (const f of FACILITIES) e.facilities[f] = { ...e.facilities[f], exp: e.facilities[f].exp + PASSIVE_EXP_PER_HOUR * days };
  return e;
}

/** 끝난 공사·생산을 반영 */
export function economyTick(s: GameState): GameState {
  const e0 = s.economy;
  const doneBuild = FACILITIES.some((f) => e0.facilities[f].buildEndMs && s.worldMs >= e0.facilities[f].buildEndMs);
  const doneQueue = e0.queue.some((q) => s.worldMs >= q.endMs);
  if (!doneBuild && !doneQueue) return s;
  const e = cloneEco(e0);
  for (const f of FACILITIES) {
    const st = e.facilities[f];
    if (st.buildEndMs && s.worldMs >= st.buildEndMs) {
      st.level++;
      st.buildEndMs = 0;
      log(e, `${f} 시설이 ${st.level}단계가 됐어요.`);
    }
  }
  const me = s.player.countryId;
  let troops = s.nations[me].troops;
  e.queue = e.queue.filter((q) => {
    if (s.worldMs < q.endMs) return true;
    const c = costOf(s, q.unit, q.special);
    const name = q.special ? countryById(me).specialUnit.name : q.unit;
    e.army[name] = (e.army[name] ?? 0) + 1;
    e.power += c.power;
    troops += c.troops;
    log(e, `${name} 1부대 완성(전투력 +${c.power}).`);
    return false;
  });
  return { ...s, economy: e, nations: { ...s.nations, [me]: { ...s.nations[me], troops } } };
}

// ── 내정 일(준장부터) ──

export function canChore(s: GameState): string | null {
  if (s.player.rankIndex < ECON_RANK) return `${RANKS[ECON_RANK].name}부터 내정을 맡아요`;
  if (s.economy.chore) return '하고 있는 내정 일이 있어요';
  return null;
}
export function startChore(s: GameState, fac: Facility): GameState {
  if (canChore(s)) return s;
  const e = cloneEco(s.economy);
  const list = CHORES[fac];
  e.chore = { fac, title: list[Math.floor(s.worldMs / HOUR) % list.length], endMs: s.worldMs + CHORE_HOURS * HOUR };
  return { ...s, economy: e };
}
export function claimChore(s: GameState): GameState {
  const c = s.economy.chore;
  if (!c || s.worldMs < c.endMs) return s;
  const e = cloneEco(s.economy);
  e.facilities[c.fac].exp += CHORE_EXP;
  e.chore = null;
  log(e, `내정 일 "${c.title}" 끝 · ${c.fac} 경험치 +${CHORE_EXP}`);
  return { ...s, economy: e };
}

// ── 시설 올리기(준장: 3단계까지, 총사령관: 5단계까지) ──

export function maxLevel(rank: number): number {
  return rank >= TOP_RANK ? 5 : rank >= ECON_RANK ? 3 : 1;
}
export function upgradeCost(e: EconomyState, f: Facility) {
  const lv = e.facilities[f].level;
  return { exp: UPGRADE_EXP[lv] ?? Infinity, money: UPGRADE_MONEY[lv] ?? Infinity, hours: UPGRADE_HOURS[lv] ?? 0 };
}
export function canUpgrade(s: GameState, f: Facility): string | null {
  const st = s.economy.facilities[f];
  if (s.player.rankIndex < ECON_RANK) return `${RANKS[ECON_RANK].name}부터`;
  if (st.level >= 5) return '최고 단계';
  if (st.level >= maxLevel(s.player.rankIndex)) return `${RANKS[TOP_RANK].name}이 되면 더 올려요`;
  if (st.buildEndMs) return '공사 중';
  const c = upgradeCost(s.economy, f);
  if (st.exp < c.exp) return `경험치 ${Math.floor(st.exp)} / ${c.exp}`;
  if (s.nations[s.player.countryId].treasury < c.money) return `국방예산 ${c.money.toLocaleString()} 필요`;
  return null;
}
export function upgradeFacility(s: GameState, f: Facility): GameState {
  if (canUpgrade(s, f)) return s;
  const e = cloneEco(s.economy);
  const c = upgradeCost(e, f);
  const st = e.facilities[f];
  st.exp -= c.exp;
  st.buildEndMs = s.worldMs + c.hours * HOUR;
  log(e, `${f} 시설 공사 시작(${c.hours}시간).`);
  const me = s.player.countryId;
  return { ...s, economy: e, nations: { ...s.nations, [me]: { ...s.nations[me], treasury: s.nations[me].treasury - c.money } } };
}

// ── 병과 생산(준장부터) ──

export function costOf(s: GameState, unit: string, special: boolean): UnitCost {
  return special ? specialCost(countryById(s.player.countryId).specialUnit.base) : UNIT_COST[unit];
}
/** 인프라만큼 빨라진 실제 생산 시간(ms) */
export function buildMs(s: GameState, unit: string, special: boolean): number {
  return (costOf(s, unit, special).hours * HOUR) / infraMult(s.economy);
}
export const QUEUE_MAX = 5;
export function canProduce(s: GameState, unit: string, special = false): string | null {
  if (s.player.rankIndex < ECON_RANK) return `${RANKS[ECON_RANK].name}부터 생산해요`;
  if (!UNIT_COST[unit]) return '없는 병과';
  if (s.player.rankIndex < unitRank(unit)) return `${RANKS[unitRank(unit)].name}부터`;
  if (s.economy.queue.length >= QUEUE_MAX) return `생산 줄은 ${QUEUE_MAX}개까지`;
  const c = costOf(s, unit, special);
  if (s.nations[s.player.countryId].treasury < c.money) return '국방예산이 모자라요';
  for (const [r, v] of Object.entries(c.res)) if (s.economy.stock[r as Res] < v!) return `${r}이(가) 모자라요`;
  return null;
}
export function produce(s: GameState, unit: string, special = false): GameState {
  if (canProduce(s, unit, special)) return s;
  const e = cloneEco(s.economy);
  const c = costOf(s, unit, special);
  for (const [r, v] of Object.entries(c.res)) e.stock[r as Res] -= v!;
  const startMs = Math.max(s.worldMs, ...e.queue.map((q) => q.endMs));
  e.queue.push({ id: e.nextId++, unit, special, startMs, endMs: startMs + buildMs(s, unit, special) });
  const me = s.player.countryId;
  return { ...s, economy: e, nations: { ...s.nations, [me]: { ...s.nations[me], treasury: s.nations[me].treasury - c.money } } };
}

/** 만든 부대 전투력 합(대전투가 쉬워짐) */
export function armyPower(s: GameState): number {
  return s.economy.power;
}

// ── 무역(준장부터, 전쟁 중이 아닌 나라와) ──

/** 그 나라가 만드는 자원 */
export function producesOf(s: GameState, id: string): Res[] {
  const out = new Set<Res>();
  for (const c of CITIES) if (s.world.owner[c.id] === id) for (const r of Object.keys(CITY_RES[c.name] ?? {})) out.add(r as Res);
  return RESOURCES.filter((r) => out.has(r));
}
export function tradePartners(s: GameState): string[] {
  const me = s.player.countryId;
  return COUNTRIES.map((c) => c.id).filter((id) => id !== me && isAlive(s.world, id) && relationOf(s.world, me, id) !== '전쟁');
}
/** 1개 값(사기) */
export function tradePrice(s: GameState, id: string, r: Res): number {
  const me = s.player.countryId;
  const mult = (TRADE_MULT[s.world.personalities[id]] ?? 1) * (relationOf(s.world, me, id) === '연합' ? ALLY_DISCOUNT : 1);
  return Math.round(RES_PRICE[r] * mult);
}
export function canTrade(s: GameState, id: string, r: Res, qty: number, buy: boolean): string | null {
  if (s.player.rankIndex < ECON_RANK) return `${RANKS[ECON_RANK].name}부터 무역해요`;
  if (!tradePartners(s).includes(id)) return '전쟁 중인 나라와는 거래할 수 없어요';
  if (!(qty > 0)) return '수량';
  if (buy) {
    if (!producesOf(s, id).includes(r)) return `${countryById(id).name}에는 ${r}이(가) 없어요`;
    if (s.nations[s.player.countryId].treasury < tradePrice(s, id, r) * qty) return '국방예산이 모자라요';
  } else if (s.economy.stock[r] < qty) return `${r}이(가) 모자라요`;
  return null;
}
export function trade(s: GameState, id: string, r: Res, qty: number, buy: boolean): GameState {
  if (canTrade(s, id, r, qty, buy)) return s;
  const me = s.player.countryId;
  const e = cloneEco(s.economy);
  const money = buy ? tradePrice(s, id, r) * qty : Math.round(tradePrice(s, id, r) * SELL_RATE * qty);
  e.stock[r] += buy ? qty : -qty;
  log(e, `${countryById(id).name}에 ${r} ${qty}개 ${buy ? '사기' : '팔기'} (${buy ? '-' : '+'}${money.toLocaleString()})`);
  const nations = { ...s.nations };
  nations[me] = { ...nations[me], treasury: nations[me].treasury + (buy ? -money : money) };
  nations[id] = { ...nations[id], treasury: nations[id].treasury + (buy ? money : -money) };
  return { ...s, economy: e, nations };
}
