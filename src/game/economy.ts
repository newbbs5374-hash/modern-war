// 6단계 내정: 시설 3개(산업·인프라·복지) · 전략 자원 7종 · 병과 생산 · 무역.
// 내 나라만 다룸. 순수 계산(새 상태를 돌려줌).
import { CITIES } from '../data/cities';
import { UNITS } from '../data/catalog';
import {
  ALLY_DISCOUNT,
  CHORES,
  CHORE_EXP,
  CHORE_HOURS,
  CITY_RES,
  ECON_RANK,
  FACILITIES,
  FACILITY_EFF,
  BUILDING_IDS,
  BUFF_EFF,
  BUFF_HOURS,
  RES_BUILDING,
  buildingInfo,
  buildingMaxLevel,
  type BuildingId,
  OCCUPIED_RES,
  PASSIVE_EXP_PER_HOUR,
  RESOURCES,
  RES_PRICE,
  SELL_RATE,
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

/** 내정 시설 하나(군수공장 등) */
export interface BuildingState {
  level: number;
  /** 올리는 공사가 끝나는 시각(0 = 공사 없음) */
  buildEndMs: number;
  /** 특별 가동(내정 업무 보상)이 끝나는 시각 */
  buffEndMs: number;
}

export interface QueueItem {
  id: number;
  unit: string;
  special: boolean;
  startMs: number;
  endMs: number;
}

export interface EconomyState {
  /** 분야(산업·인프라·복지)마다 모은 경험치. level·buildEndMs는 예전 저장 호환용 */
  facilities: Record<Facility, FacilityState>;
  /** 내정 시설 9개 */
  buildings: Record<BuildingId, BuildingState>;
  stock: Stock;
  chore: { fac: Facility; building?: BuildingId; title: string; endMs: number } | null;
  queue: QueueItem[];
  /** 만든 부대 수(이름 → 개수) */
  army: Record<string, number>;
  /** 만든 부대 전투력 합 */
  power: number;
  nextId: number;
  /** 최근 내정 소식 */
  log: string[];
  /** 정기 무역 계약(매시간 자동으로 사고팖) */
  contracts?: Contract[];
}

export interface Contract {
  id: number;
  country: string;
  res: Res;
  /** 시간당 개수 */
  qty: number;
  /** true = 수입(삼), false = 수출(팖) */
  buy: boolean;
}
export const CONTRACT_MAX = 4;
export const CONTRACT_QTY = [1, 2, 5, 10];

export function newEconomy(): EconomyState {
  const f = (): FacilityState => ({ level: 1, exp: 0, buildEndMs: 0 });
  return { facilities: { 산업: f(), 인프라: f(), 복지: f() }, buildings: newBuildings(), stock: emptyStock(), chore: null, queue: [], army: {}, power: 0, nextId: 1, log: [] };
}

export function newBuildings(from?: Partial<Record<Facility, FacilityState>>): Record<BuildingId, BuildingState> {
  return Object.fromEntries(BUILDING_IDS.map((id) => [id, { level: from?.[buildingInfo(id).fac]?.level ?? 1, buildEndMs: 0, buffEndMs: 0 }])) as Record<BuildingId, BuildingState>;
}

function cloneEco(e: EconomyState): EconomyState {
  return {
    facilities: { 산업: { ...e.facilities.산업 }, 인프라: { ...e.facilities.인프라 }, 복지: { ...e.facilities.복지 } },
    buildings: Object.fromEntries(Object.entries(e.buildings).map(([k, v]) => [k, { ...v }])) as Record<BuildingId, BuildingState>,
    stock: { ...e.stock },
    chore: e.chore ? { ...e.chore } : null,
    queue: e.queue.map((q) => ({ ...q })),
    army: { ...e.army },
    power: e.power,
    nextId: e.nextId,
    log: [...e.log],
    contracts: (e.contracts ?? []).map((c) => ({ ...c })),
  };
}

function log(e: EconomyState, text: string) {
  e.log.unshift(text);
  if (e.log.length > 8) e.log.length = 8;
}

/** 시설 효과(단계 + 특별 가동 중이면 +BUFF_EFF). 0 = 효과 없음 */
export function buildingEff(s: GameState, id: BuildingId): number {
  const b = s.economy.buildings?.[id];
  if (!b) return 0;
  return FACILITY_EFF[Math.max(0, Math.min(4, b.level - 1))] + (b.buffEndMs > s.worldMs ? BUFF_EFF : 0);
}
export const buffActive = (s: GameState, id: BuildingId) => (s.economy.buildings?.[id]?.buffEndMs ?? 0) > s.worldMs;
/** 군수공장: 국방예산 배율 */
export const budgetMult = (s: GameState) => 1 + buildingEff(s, '군수공장');
/** 제련소·첨단공단: 자원 배율 */
export const resMult = (s: GameState, r: Res) => 1 + buildingEff(s, RES_BUILDING[r]);
/** 징병소: 모병 배율 */
export const welfareMult = (s: GameState) => 1 + buildingEff(s, '징병소');
/** 군병원: 병력이 줄어드는 정도(1 = 그대로, 0.5 = 절반) */
export const attritionMult = (s: GameState) => 1 - 0.5 * buildingEff(s, '군병원');
/** 병과 → 모집 속도 시설(철도망·군항·공군기지) */
export function unitBuilding(unit: string): BuildingId {
  const d = UNITS.find((u) => u.name === unit)?.domain;
  return d === '해' ? '군항' : d === '공' ? '공군기지' : '철도망';
}
/** 인프라: 모집 속도 배율 */
export const infraMult = (s: GameState, unit: string) => 1 + buildingEff(s, unitBuilding(unit));

/** 내 나라가 하루(실제 1시간)에 얻는 자원 */
export function resPerDay(s: GameState): Stock {
  const me = s.player.countryId;
  const out = emptyStock();
  for (const c of CITIES) {
    if (s.world.owner[c.id] !== me) continue;
    const r = CITY_RES[c.name] ?? {};
    const k = c.home === me ? 1 : OCCUPIED_RES;
    for (const [res, v] of Object.entries(r)) out[res as Res] += v! * k * resMult(s, res as Res);
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
  const doneBuild = BUILDING_IDS.some((id) => e0.buildings[id].buildEndMs && s.worldMs >= e0.buildings[id].buildEndMs);
  const doneQueue = e0.queue.some((q) => s.worldMs >= q.endMs);
  if (!doneBuild && !doneQueue) return s;
  const e = cloneEco(e0);
  for (const id of BUILDING_IDS) {
    const st = e.buildings[id];
    if (st.buildEndMs && s.worldMs >= st.buildEndMs) {
      st.level++;
      st.buildEndMs = 0;
      log(e, `${id}이(가) ${st.level}단계가 됐어요.`);
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

// ── 내정 업무: 시설 하나를 골라 1시간 → 분야 경험치 + 그 시설 특별 가동 ──

export function canChore(s: GameState): string | null {
  if (s.player.rankIndex < ECON_RANK) return `${RANKS[ECON_RANK].name}부터 내정을 맡아요`;
  if (s.economy.chore) return '하고 있는 내정 업무가 있어요';
  return null;
}
/** 시설 이름(또는 예전처럼 분야 이름)으로 업무 시작 */
export function startChore(s: GameState, target: BuildingId | Facility): GameState {
  if (canChore(s)) return s;
  const e = cloneEco(s.economy);
  const building = (FACILITIES as readonly string[]).includes(target) ? BUILDING_IDS.find((id) => buildingInfo(id).fac === target)! : (target as BuildingId);
  e.chore = { fac: buildingInfo(building).fac, building, title: CHORES[building], endMs: s.worldMs + CHORE_HOURS * HOUR };
  return { ...s, economy: e };
}
export function claimChore(s: GameState): GameState {
  const c = s.economy.chore;
  if (!c || s.worldMs < c.endMs) return s;
  const e = cloneEco(s.economy);
  e.facilities[c.fac].exp += CHORE_EXP;
  e.chore = null;
  if (c.building && e.buildings[c.building]) e.buildings[c.building].buffEndMs = s.worldMs + BUFF_HOURS * HOUR;
  log(e, `내정 업무 "${c.title}" 끝 · ${c.fac} 경험치 +${CHORE_EXP}${c.building ? ` · ${c.building} 특별 가동 ${BUFF_HOURS}시간` : ''}`);
  return { ...s, economy: e };
}

// ── 시설 올리기: 분야 경험치 + 예산 + 공사 시간. 지도자 등급마다 최고 단계가 오름 ──

export function maxLevel(rank: number): number {
  return buildingMaxLevel(rank);
}
export function upgradeCost(s: GameState, id: BuildingId) {
  const lv = s.economy.buildings[id].level;
  return { exp: UPGRADE_EXP[lv] ?? Infinity, money: UPGRADE_MONEY[lv] ?? Infinity, hours: UPGRADE_HOURS[lv] ?? 0 };
}
export function canUpgrade(s: GameState, id: BuildingId): string | null {
  const st = s.economy.buildings[id];
  if (!st) return '없는 시설';
  if (st.level >= 5) return '최고 단계';
  if (st.level >= maxLevel(s.player.rankIndex)) {
    const next = RANKS.findIndex((_, i) => maxLevel(i) > st.level);
    return `${RANKS[next]?.name ?? '다음 등급'}부터 더 올려요`;
  }
  if (st.buildEndMs) return '공사 중';
  const c = upgradeCost(s, id);
  const fac = buildingInfo(id).fac;
  if (s.economy.facilities[fac].exp < c.exp) return `${fac} 경험치 ${Math.floor(s.economy.facilities[fac].exp)} / ${c.exp}`;
  if (s.nations[s.player.countryId].treasury < c.money) return `국방예산 ${c.money.toLocaleString()} 필요`;
  return null;
}
export function upgradeFacility(s: GameState, id: BuildingId): GameState {
  if (canUpgrade(s, id)) return s;
  const e = cloneEco(s.economy);
  const c = upgradeCost(s, id);
  e.facilities[buildingInfo(id).fac].exp -= c.exp;
  e.buildings[id].buildEndMs = s.worldMs + c.hours * HOUR;
  log(e, `${id} 공사 시작(${c.hours}시간).`);
  const me = s.player.countryId;
  return { ...s, economy: e, nations: { ...s.nations, [me]: { ...s.nations[me], treasury: s.nations[me].treasury - c.money } } };
}

// ── 병과 모집·생산(병과마다 열리는 계급부터) ──

export function costOf(s: GameState, unit: string, special: boolean): UnitCost {
  return special ? specialCost(countryById(s.player.countryId).specialUnit.base) : UNIT_COST[unit];
}
/** 인프라만큼 빨라진 실제 생산 시간(ms) */
export function buildMs(s: GameState, unit: string, special: boolean): number {
  return (costOf(s, unit, special).hours * HOUR) / infraMult(s, unit);
}
export const QUEUE_MAX = 5;
export function canProduce(s: GameState, unit: string, special = false): string | null {
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

/**
 * 점령지 지키기: 플레이어가 점령한 도시는 군정이 있어 반란이 훨씬 적고(복지가 높으면 더 적음),
 * 만든 부대 전투력만큼 침공을 더 잘 막음(최대 2배).
 */
export const PLAYER_REBEL_MULT = 0.25;
export function occupyHold(s: GameState): { rebel: number; defense: number } {
  return { rebel: PLAYER_REBEL_MULT * (1 - 0.5 * buildingEff(s, '치안청')), defense: 1 + Math.min(1, s.economy.power / 1500) };
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

// ── 정기 무역 계약: 매시간 자동으로 수입·수출(전쟁이 나면 멈춤) ──

/** 계약이 지금 돌아가는가(멈춘 까닭, 없으면 null) */
export function contractPaused(s: GameState, c: Contract): string | null {
  if (!isAlive(s.world, c.country)) return '상대 나라가 무너졌어요';
  if (relationOf(s.world, s.player.countryId, c.country) === '전쟁') return '전쟁 중이라 멈췄어요';
  if (c.buy && !producesOf(s, c.country).includes(c.res)) return `상대에게 ${c.res}이(가) 없어요`;
  return null;
}
/** 계약 1개의 시간당 돈(수입은 −, 수출은 +) */
export function contractMoney(s: GameState, c: Contract): number {
  const p = tradePrice(s, c.country, c.res) * c.qty;
  return c.buy ? -p : Math.round(p * SELL_RATE);
}
/** 돌아가는 계약들의 시간당 돈 합 */
export function contractMoneyPerHour(s: GameState): number {
  return (s.economy.contracts ?? []).reduce((a, c) => a + (contractPaused(s, c) ? 0 : contractMoney(s, c)), 0);
}
/** 자원 하나의 시간당 계약 수입량(수출은 −) */
export function contractResPerHour(s: GameState, r: Res): number {
  return (s.economy.contracts ?? []).reduce((a, c) => a + (c.res === r && !contractPaused(s, c) ? (c.buy ? c.qty : -c.qty) : 0), 0);
}
export function canContract(s: GameState, country: string, r: Res, qty: number, buy: boolean): string | null {
  if ((s.economy.contracts ?? []).length >= CONTRACT_MAX) return `계약은 ${CONTRACT_MAX}개까지`;
  if (!tradePartners(s).includes(country)) return '전쟁 중인 나라와는 계약할 수 없어요';
  if (buy && !producesOf(s, country).includes(r)) return `${countryById(country).name}에는 ${r}이(가) 없어요`;
  if (!(qty > 0)) return '수량';
  return null;
}
export function addContract(s: GameState, country: string, r: Res, qty: number, buy: boolean): GameState {
  if (canContract(s, country, r, qty, buy)) return s;
  const e = cloneEco(s.economy);
  e.contracts = [...(e.contracts ?? []), { id: e.nextId++, country, res: r, qty, buy }];
  log(e, `${countryById(country).name}와 ${r} 시간당 ${qty}개 ${buy ? '수입' : '수출'} 계약`);
  return { ...s, economy: e };
}
export function cancelContract(s: GameState, id: number): GameState {
  const e = cloneEco(s.economy);
  e.contracts = (e.contracts ?? []).filter((c) => c.id !== id);
  return { ...s, economy: e };
}
/** ms 동안 계약 반영(돈이나 수출할 자원이 모자라면 그만큼만) */
export function applyContracts(s: GameState, ms: number): GameState {
  const list = s.economy.contracts ?? [];
  if (!list.length || !(ms > 0)) return s;
  const h = ms / HOUR;
  const me = s.player.countryId;
  const stock = { ...s.economy.stock };
  const nations = { ...s.nations };
  for (const c of list) {
    if (contractPaused(s, c)) continue;
    const price = tradePrice(s, c.country, c.res);
    let q = c.qty * h;
    if (c.buy) {
      q = Math.min(q, Math.max(0, nations[me].treasury) / price);
      stock[c.res] += q;
      nations[me] = { ...nations[me], treasury: nations[me].treasury - q * price };
      nations[c.country] = { ...nations[c.country], treasury: nations[c.country].treasury + q * price };
    } else {
      q = Math.min(q, Math.max(0, stock[c.res]));
      stock[c.res] -= q;
      nations[me] = { ...nations[me], treasury: nations[me].treasury + q * price * SELL_RATE };
      nations[c.country] = { ...nations[c.country], treasury: nations[c.country].treasury - q * price * SELL_RATE };
    }
  }
  return { ...s, nations, economy: { ...s.economy, stock } };
}
