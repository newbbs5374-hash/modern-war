// 6단계 내정: 시설 3개(산업·인프라·복지) · 전략 자원 7종 · 병과 생산 · 무역.
// 내 나라만 다룸. 순수 계산(새 상태를 돌려줌).
import { isArchRival } from '../data/archRivals';
import { originEff } from './origin';
import { CITIES } from '../data/cities';
import { UNITS } from '../data/catalog';
import {
  ALLY_DISCOUNT,
  LUXURIES,
  CHORES,
  CHORE_EXP,
  CHORE_HOURS,
  CITY_RES,
  ECON_RANK,
  FACILITIES,
  BUILDING_IDS,
  buildingStart,
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
import { addDef, defOf } from './defFund';
import { generalBuildMult, generalPowerMult, generalResMult } from './loyal';
import { homeOf, isAlive, isPuppet, relationOf } from './world';
import { facBonus, facEff, facNeedWhy } from './facility';
import { civBuildSpeed, civPowerMult, civResMult, extraContracts, hasTech, policyPowerMult, tradeEdge, unitTechLock } from './civ';
import { EXCLUSIVES, exclusiveLock, specialById, specialsOf, type SpecialDef } from '../data/specials';

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
  /** 바탕 병과 */
  unit: string;
  /** 예전 저장: true = 1번 특화 유닛 */
  special: boolean;
  /** 특화 유닛 이름표(us-2 등) */
  sp?: string;
  /** 갈륨 개량형(갈륨 1을 더 씀) */
  crystal?: boolean;
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
  /** 11/28 장관 무역 추천 실행 횟수(하루 단위) · 맡기기 스위치 */
  advice?: { day: number; n: number; auto?: boolean; autoDay?: number; autoN?: number };
  /** 복합소재 만들기(공업 구역). 없으면 켜짐 */
  composite?: boolean;
  /** 특수강·정밀부품 만들기(공업 구역). 없으면 켜짐 */
  process?: Partial<Record<Res, boolean>>;
  /** 11-28 나라별 시세: '나라|자원' → 우리가 사고판 압력(p)·마지막 시각(t)·오늘 거래량(vol, day) */
  market?: Record<string, MarketCell>;
}
export interface MarketCell {
  p: number;
  t: number;
  vol: number;
  day: number;
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
  return { facilities: { 산업: f(), 인프라: f(), 복지: f(), 과학: f(), 국방: f() }, buildings: newBuildings(), stock: emptyStock(), chore: null, queue: [], army: {}, power: 0, nextId: 1, log: [] };
}

export function newBuildings(from?: Partial<Record<Facility, FacilityState>>): Record<BuildingId, BuildingState> {
  return Object.fromEntries(BUILDING_IDS.map((id) => [id, { level: buildingStart(id) === 0 ? 0 : (from?.[buildingInfo(id).fac]?.level ?? 1), buildEndMs: 0, buffEndMs: 0 }])) as Record<BuildingId, BuildingState>;
}

function cloneEco(e: EconomyState): EconomyState {
  return {
    facilities: Object.fromEntries(Object.entries(e.facilities).map(([k, v]) => [k, { ...v }])) as EconomyState['facilities'],
    buildings: Object.fromEntries(Object.entries(e.buildings).map(([k, v]) => [k, { ...v }])) as Record<BuildingId, BuildingState>,
    stock: { ...emptyStock(), ...e.stock },
    chore: e.chore ? { ...e.chore } : null,
    queue: e.queue.map((q) => ({ ...q })),
    army: { ...e.army },
    power: e.power,
    nextId: e.nextId,
    log: [...e.log],
    contracts: (e.contracts ?? []).map((c) => ({ ...c })),
    composite: e.composite,
    process: e.process ? { ...e.process } : undefined,
    market: e.market ? { ...e.market } : undefined,
  };
}

function log(e: EconomyState, text: string) {
  e.log.unshift(text);
  if (e.log.length > 8) e.log.length = 8;
}

/** 시설 효과(단계 + 특별 가동 중이면 +BUFF_EFF). 0 = 효과 없음 */
export function buildingEff(s: GameState, id: BuildingId): number {
  return facEff(s, id);
}
/** 새 시설 효과(세기 반영): 국방과학연구소 연구 · 정보본부 임무 · 우주기지 전투력 · 방공포대 방어 · 훈련소 훈련 · 비축창고 보급 */
export { facBonus };
export const buffActive = (s: GameState, id: BuildingId) => (s.economy.buildings?.[id]?.buffEndMs ?? 0) > s.worldMs;
/** 군수공장: 나라 예산 배율 */
export const budgetMult = (s: GameState) => 1 + buildingEff(s, '군수공장');
/** 제련소·첨단공단: 자원 배율 */
export const resMult = (s: GameState, r: Res) => {
  const b = RES_BUILDING[r];
  return (b ? 1 + buildingEff(s, b) : 1) * generalResMult(s) * (LUXURIES.includes(r) ? 1 + originEff(s, 'luxury') : 1);
};
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
  const civ = civResMult(s);
  for (const c of CITIES) {
    if (s.world.owner[c.id] !== me) continue;
    const r = CITY_RES[c.name] ?? {};
    const k = homeOf(s.world, c.id) === me ? 1 : isPuppet(s.world, c.id) ? 0 : OCCUPIED_RES;
    for (const [res, v] of Object.entries(r)) out[res as Res] += v! * k * resMult(s, res as Res) * civ;
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
    const v = variantOf(s, q.sp ?? q.special);
    const c = costOf(s, q.unit, v?.id);
    const name = queueName(s, q);
    const power = Math.round(c.power * civPowerMult(s, q.unit) * generalPowerMult(s, q.unit) * (v ? specialPowerMult(s) : 1) * (q.crystal ? CRYSTAL_POWER : 1));
    e.army[name] = (e.army[name] ?? 0) + 1;
    e.power += power;
    troops += c.troops;
    log(e, `${name}${q.crystal ? '(갈륨 개량형)' : ''} 1부대 완성(전투력 +${power}).`);
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
/** 그 시설에 업무를 맡길 수 있는지(아직 안 지은 시설은 못 맡김) */
export function canChoreAt(s: GameState, id: BuildingId): string | null {
  if ((s.economy.buildings[id]?.level ?? 0) < 1) return '먼저 지어야 해요';
  return canChore(s);
}
/** 시설 이름(또는 예전처럼 분야 이름)으로 업무 시작 */
export function startChore(s: GameState, target: BuildingId | Facility): GameState {
  if (canChore(s)) return s;
  if (!(FACILITIES as readonly string[]).includes(target) && canChoreAt(s, target as BuildingId)) return s;
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

/** 국방 시설(국방 탭에 보이는 8개)은 국방비로 짓고 올린다(11-26) */
export const DEFENSE_BUILDINGS: readonly BuildingId[] = ['철도망', '군항', '공군기지', '방공포대', '훈련소', '비축창고', '정보본부', '우주기지'];
export const isDefBuilding = (id: BuildingId) => DEFENSE_BUILDINGS.includes(id);

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
    return `${RANKS[next]?.name ?? '다음 호칭'}부터 더 올려요`;
  }
  if (st.buildEndMs) return '공사 중';
  const need = facNeedWhy(s, id);
  if (need) return need;
  const c = upgradeCost(s, id);
  const fac = buildingInfo(id).fac;
  if (s.economy.facilities[fac].exp < c.exp) return `${fac} 경험치 ${Math.floor(s.economy.facilities[fac].exp)} / ${c.exp}`;
  if (isDefBuilding(id)) {
    if (defOf(s) < c.money) return `국방비 ${c.money.toLocaleString()} 필요`;
  } else if (s.nations[s.player.countryId].treasury < c.money) return `나라 예산 ${c.money.toLocaleString()} 필요`;
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
  if (isDefBuilding(id)) return addDef({ ...s, economy: e }, -c.money);
  return { ...s, economy: e, nations: { ...s.nations, [me]: { ...s.nations[me], treasury: s.nations[me].treasury - c.money } } };
}

// ── 병과 모집·생산(병과마다 열리는 계급부터) ──

/** 특화 유닛 고르기: 이름표('us-2') 또는 예전 저장의 true(= 1번) */
export function variantOf(s: GameState, v: string | boolean | undefined | null): SpecialDef | undefined {
  if (!v) return undefined;
  if (v === true) return specialsOf(s.player.countryId)[0];
  return specialById(v);
}
/** 줄에 선 부대 이름(특화 유닛이면 그 이름) */
export function queueName(s: GameState, q: QueueItem): string {
  return variantOf(s, q.sp ?? q.special)?.name ?? q.unit;
}
/** 국가 비밀 병기 연구: 특화 유닛 전투력 +15% */
export const SECRET_POWER = 1.15;
/** 갈륨 개량형: 갈륨 1을 더 써서 전투력 +15% */
export const CRYSTAL_POWER = 1.15;
export const specialPowerMult = (s: GameState) => (hasTech(s, 'm-secret') ? SECRET_POWER : 1);
/** 갈륨 레이더 연구 뒤 갈륨이 있으면 특화 유닛은 갈륨 개량형으로 만듦 */
export const crystalReady = (s: GameState) => hasTech(s, 'm-crystal') && (s.economy.stock.갈륨 ?? 0) >= 1;

export function costOf(s: GameState, unit: string, variant?: string | boolean): UnitCost {
  const v = variantOf(s, variant);
  return v ? specialCost(v.base, v.cost) : UNIT_COST[unit];
}
/** 인프라만큼 빨라진 실제 생산 시간(ms) */
export function buildMs(s: GameState, unit: string, variant?: string | boolean): number {
  return (costOf(s, unit, variant).hours * HOUR) / infraMult(s, unit) / civBuildSpeed(s, unit) / generalBuildMult(s, unit);
}
export const QUEUE_MAX = 5;
export function canProduce(s: GameState, unit: string, variant?: string | boolean): string | null {
  if (!UNIT_COST[unit]) return '없는 병과';
  const me = s.player.countryId;
  const ex = exclusiveLock(me, unit);
  if (ex) return ex;
  const v = variantOf(s, variant);
  if (variant && (!v || v.country !== me || v.base !== unit)) return '우리 나라 특화 유닛이 아니에요';
  if (s.player.rankIndex < unitRank(unit)) return `${RANKS[unitRank(unit)].name}부터`;
  const tech = unitTechLock(s, unit);
  if (tech) return tech;
  if (s.economy.queue.length >= QUEUE_MAX) return `생산 줄은 ${QUEUE_MAX}개까지`;
  const c = costOf(s, unit, variant);
  if (defOf(s) < c.money) return '국방비가 모자라요';
  for (const [r, n] of Object.entries(c.res)) if ((s.economy.stock[r as Res] ?? 0) < n!) return `${r}이(가) 모자라요`;
  return null;
}
export function produce(s: GameState, unit: string, variant?: string | boolean): GameState {
  if (canProduce(s, unit, variant)) return s;
  const e = cloneEco(s.economy);
  const v = variantOf(s, variant);
  const c = costOf(s, unit, v?.id);
  for (const [r, n] of Object.entries(c.res)) e.stock[r as Res] -= n!;
  const crystal = !!v && crystalReady(s);
  if (crystal) e.stock.갈륨 -= 1;
  const startMs = Math.max(s.worldMs, ...e.queue.map((q) => q.endMs));
  e.queue.push({ id: e.nextId++, unit, special: !!v, sp: v?.id, crystal: crystal || undefined, startMs, endMs: startMs + buildMs(s, unit, v?.id) });
  return addDef({ ...s, economy: e }, -c.money);
}

/** 지도 위 전투에 데려갈 우리 특화 유닛·독점 병과(가진 것만, 이름표 → 부대 수) */
export function fieldRoster(s: GameState): Record<string, number> {
  const out: Record<string, number> = {};
  for (const d of specialsOf(s.player.countryId)) if ((s.economy.army[d.name] ?? 0) > 0) out[d.id] = s.economy.army[d.name];
  for (const x of EXCLUSIVES) if ((s.economy.army[x.name] ?? 0) > 0) out[x.name] = s.economy.army[x.name];
  return out;
}
/** 우리 땅을 지킬 때 힘(특화 유닛 homeDef): 부대 하나마다 +2%, 최대 +30% */
export function homeDefBonus(s: GameState): number {
  let v = 0;
  for (const d of specialsOf(s.player.countryId)) if (d.field.homeDef) v += (s.economy.army[d.name] ?? 0) * 0.05 * d.field.homeDef;
  return Math.min(0.3, v);
}

/** 만든 부대 전투력 합(대전투가 쉬워짐) */
export function armyPower(s: GameState): number {
  // 11-27 체제·정책 카드 전투력은 지금 가진 부대 모두에 바로 붙음
  return Math.round(s.economy.power * policyPowerMult(s));
}

/**
 * 점령지 지키기: 플레이어가 점령한 도시는 군정이 있어 반란이 훨씬 적고(복지가 높으면 더 적음),
 * 만든 부대 전투력만큼 침공을 더 잘 막음(최대 2배).
 */
export const PLAYER_REBEL_MULT = 0.25;
export function occupyHold(s: GameState): { rebel: number; defense: number } {
  return { rebel: PLAYER_REBEL_MULT * (1 - 0.5 * buildingEff(s, '치안청')), defense: (1 + Math.min(1, armyPower(s) / 1500)) * (1 + homeDefBonus(s)) * (1 + facBonus(s, '방공포대')) };
}

// ── 무역(준장부터, 전쟁 중이 아닌 나라와) ──

/** 그 나라가 만드는 자원 */
export function producesOf(s: GameState, id: string): Res[] {
  const out = new Set<Res>();
  for (const c of CITIES) if (s.world.owner[c.id] === id) for (const r of Object.keys(CITY_RES[c.name] ?? {})) out.add(r as Res);
  return RESOURCES.filter((r) => out.has(r));
}
/** 숙적(data/archRivals.ts)과 교역: 살 때 값 × ARCH_PRICE, 팔 때 값 × ARCH_SELL, 정기 계약은 거절 */
export const ARCH_PRICE = 1.6;
export const ARCH_SELL = 0.6;
export function tradePartners(s: GameState): string[] {
  const me = s.player.countryId;
  return COUNTRIES.map((c) => c.id).filter((id) => id !== me && isAlive(s.world, id) && relationOf(s.world, me, id) !== '전쟁');
}

// ── 11-28 나라별 시세(대장 결정 "무역 시세 제도 넣기") ──
// 값 = 기본값 × 성향·연합·숙적·항로 × 그 나라가 만드는가(싸다/비싸다) × 전쟁 중 군수 자원 × 6시간마다 흔들림 × 우리가 사고판 압력.
// 많이 사면 그 나라 값이 오르고, 많이 팔면 내려가요(6시간마다 절반씩 제자리로). 한 나라·한 자원은 하루 MARKET_DAY_CAP개까지.
// → 싸게 사서 비싸게 파는 '중계 무역'은 되지만 끝없이 돈이 불어나지는 않아요(11-27 점검 오류 1).
const H6 = 6 * HOUR;
/** 그 나라가 만드는 자원 · 못 만드는 자원 값 배율 */
export const LOCAL_CHEAP = 0.85;
export const LOCAL_DEAR = 1.2;
/** 전쟁 중인 나라의 군수 자원 값 배율 */
export const WAR_DEAR = 1.2;
export const MIL_RES: ReadonlySet<Res> = new Set<Res>(['석유', '강철', '티타늄', '우라늄', '복합소재', '특수강', '정밀부품', '텅스텐']);
/** 흔들림 폭(±) */
export const WOBBLE = 0.12;
/** 이만큼 사면 값이 2배(압력 +1) */
export const MARKET_DEPTH = 150;
export const MARKET_P_MIN = -0.5;
export const MARKET_P_MAX = 1.5;
/** 한 나라·한 자원 하루(실제 24시간) 거래 한도 */
export const MARKET_DAY_CAP = 300;
const mkey = (id: string, r: Res) => `${id}|${r}`;
const dayOf = (ms: number) => Math.floor(ms / (24 * HOUR));
function hash01(...xs: Array<string | number>): number {
  let h = 2166136261;
  for (const x of xs) for (const ch of String(x)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  h = Math.imul(h ^ (h >>> 15), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
/** 그 나라가 전쟁 중인가(누구와든) */
export function nationAtWar(s: GameState, id: string): boolean {
  for (const [k, p] of Object.entries(s.world.pairs)) if (p.rel === '전쟁' && k.split('|').includes(id)) return true;
  return false;
}
/** 지금 압력(시간이 지나면 6시간마다 절반) */
export function marketPressure(s: GameState, id: string, r: Res): number {
  const c = s.economy.market?.[mkey(id, r)];
  if (!c) return 0;
  return c.p * Math.pow(0.5, Math.max(0, s.worldMs - c.t) / H6);
}
/** 오늘 그 나라와 그 자원을 더 거래할 수 있는 개수 */
export function marketRoom(s: GameState, id: string, r: Res): number {
  const c = s.economy.market?.[mkey(id, r)];
  const cap = Math.round(MARKET_DAY_CAP * (hasPrio(s, id) ? 1.5 : 1));
  return c && c.day === dayOf(s.worldMs) ? Math.max(0, cap - c.vol) : cap;
}
/** 압력을 뺀 1개 값의 바탕(그 나라 사정·흔들림까지) */
function priceCore(s: GameState, id: string, r: Res): number {
  const me = s.player.countryId;
  const mult = (TRADE_MULT[s.world.personalities[id]] ?? 1) * (relationOf(s.world, me, id) === '연합' ? ALLY_DISCOUNT : 1) * (isArchRival(me, id) ? ARCH_PRICE : 1);
  const local = producesOf(s, id).includes(r) ? LOCAL_CHEAP : LOCAL_DEAR;
  const war = MIL_RES.has(r) && nationAtWar(s, id) ? WAR_DEAR : 1;
  const wob = 1 + WOBBLE * (hash01(s.world.seed, id, r, Math.floor(s.worldMs / H6)) * 2 - 1);
  return RES_PRICE[r] * mult * local * war * wob * (1 - tradeEdge(s, id));
}
/** 11-28 은혜 장부: 파병해 준 나라에서 살 때 은혜 1마다 1% 싸게(최대 10%). 팔 때 값은 그대로 */
export const oweCut = (s: GameState, id: string) => (1 - Math.min(10, s.deploy?.owe?.[id] ?? 0) * 0.01) * (hasPrio(s, id) ? 1 - PRIO_CUT : 1);
/** 11-28 자원 우선 구매권 협정: 살 때 6% 싸고 하루 한도 +50% */
export const PRIO_CUT = 0.06;
const hasPrio = (s: GameState, id: string) => (s.civ?.agreements ?? []).some((a) => a.who === id && a.kind === 'prio' && a.untilMs > s.worldMs);
/** 1개 값(사기) */
export function tradePrice(s: GameState, id: string, r: Res): number {
  return Math.max(1, Math.round(priceCore(s, id, r) * (1 + marketPressure(s, id, r)) * oweCut(s, id)));
}
/** 팔 때 값 비율(항로 개방·체제 이득이면 더 비싸게 팖) */
export function sellRate(s: GameState, id: string): number {
  const e = tradeEdge(s, id);
  return ((SELL_RATE * (1 + e)) / (1 - e)) * (isArchRival(s.player.countryId, id) ? ARCH_SELL : 1);
}
/** 1개 팔 때 받는 값 */
export const sellPrice = (s: GameState, id: string, r: Res) => Math.max(1, Math.round(priceCore(s, id, r) * (1 + marketPressure(s, id, r)) * sellRate(s, id)));
const clampP = (p: number) => Math.max(MARKET_P_MIN, Math.min(MARKET_P_MAX, p));
/** qty개 사는 데 드는 돈(사는 동안 값이 오름) */
export function buyCost(s: GameState, id: string, r: Res, qty: number): number {
  const p0 = marketPressure(s, id, r);
  const p1 = clampP(p0 + qty / MARKET_DEPTH);
  return Math.round(priceCore(s, id, r) * (1 + (p0 + p1) / 2) * oweCut(s, id) * qty);
}
/** qty개 팔아 받는 돈(파는 동안 값이 내림) */
export function sellGain(s: GameState, id: string, r: Res, qty: number): number {
  const p0 = marketPressure(s, id, r);
  const p1 = clampP(p0 - qty / MARKET_DEPTH);
  return Math.round(priceCore(s, id, r) * (1 + (p0 + p1) / 2) * sellRate(s, id) * qty);
}
/** 거래 뒤 시세 기록 */
function pushMarket(e: EconomyState, s: GameState, id: string, r: Res, qty: number, buy: boolean, countVol = true): void {
  const k = mkey(id, r);
  const d = dayOf(s.worldMs);
  const c = e.market?.[k];
  const vol = countVol ? (c && c.day === d ? c.vol : 0) + qty : c && c.day === d ? c.vol : 0;
  e.market = { ...(e.market ?? {}), [k]: { p: clampP(marketPressure(s, id, r) + (buy ? qty : -qty) / MARKET_DEPTH), t: s.worldMs, vol, day: d } };
}
export const contractMax = (s: GameState) => CONTRACT_MAX + extraContracts(s);
export function canTrade(s: GameState, id: string, r: Res, qty: number, buy: boolean): string | null {
  if (s.player.rankIndex < ECON_RANK) return `${RANKS[ECON_RANK].name}부터 무역해요`;
  if (!tradePartners(s).includes(id)) return '전쟁 중인 나라와는 거래할 수 없어요';
  if (!(qty > 0)) return '수량';
  const room = marketRoom(s, id, r);
  if (room < qty) return room ? `오늘 ${countryById(id).name}와 ${r}은(는) ${room}개만 더 거래할 수 있어요` : `오늘 ${countryById(id).name}와 ${r} 거래 한도(${MARKET_DAY_CAP}개)를 다 썼어요`;
  if (buy) {
    if (!producesOf(s, id).includes(r)) return `${countryById(id).name}에는 ${r}이(가) 없어요`;
    if (s.nations[s.player.countryId].treasury < buyCost(s, id, r, qty)) return '나라 예산이 모자라요';
  } else {
    if ((s.economy.stock[r] ?? 0) < qty) return `${r}이(가) 모자라요`;
    if ((s.nations[id]?.treasury ?? 0) < sellGain(s, id, r, qty)) return `${countryById(id).name} 국고가 모자라 그만큼 살 수 없어요`;
  }
  return null;
}
export function trade(s: GameState, id: string, r: Res, qty: number, buy: boolean): GameState {
  if (canTrade(s, id, r, qty, buy)) return s;
  const me = s.player.countryId;
  const e = cloneEco(s.economy);
  const money = buy ? buyCost(s, id, r, qty) : sellGain(s, id, r, qty);
  e.stock[r] += buy ? qty : -qty;
  pushMarket(e, s, id, r, qty, buy);
  log(e, `${countryById(id).name}에 ${r} ${qty}개 ${buy ? '사기' : '팔기'} (${buy ? '-' : '+'}${money.toLocaleString()})`);
  const nations = { ...s.nations };
  nations[me] = { ...nations[me], treasury: nations[me].treasury + (buy ? -money : money) };
  nations[id] = { ...nations[id], treasury: Math.max(0, nations[id].treasury + (buy ? money : -money)) };
  return { ...s, economy: e, nations };
}

// ── 정기 무역 계약: 매시간 자동으로 수입·수출(전쟁이 나면 멈춤) ──

/** 계약이 지금 돌아가는가(멈춘 까닭, 없으면 null) */
export function contractPaused(s: GameState, c: Contract): string | null {
  if (!isAlive(s.world, c.country)) return '상대 나라가 무너졌어요';
  if (relationOf(s.world, s.player.countryId, c.country) === '전쟁') return '전쟁 중이라 멈췄어요';
  if (isArchRival(s.player.countryId, c.country)) return '숙적이라 계약을 멈췄어요';
  if (c.buy && !producesOf(s, c.country).includes(c.res)) return `상대에게 ${c.res}이(가) 없어요`;
  return null;
}
/** 계약 1개의 시간당 돈(수입은 −, 수출은 +) */
export function contractMoney(s: GameState, c: Contract): number {
  return c.buy ? -tradePrice(s, c.country, c.res) * c.qty : sellPrice(s, c.country, c.res) * c.qty;
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
  if ((s.economy.contracts ?? []).length >= contractMax(s)) return `계약은 ${contractMax(s)}개까지`;
  if (!tradePartners(s).includes(country)) return '전쟁 중인 나라와는 계약할 수 없어요';
  if (isArchRival(s.player.countryId, country)) return `${countryById(country).name}은(는) 숙적이라 정기 계약을 거절해요`;
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
/** ms 동안 계약 반영(돈이나 수출할 자원이 모자라면 그만큼만). 계약도 시세를 움직이고, 상대 국고가 바닥이면 그만큼만 사 줌 */
export function applyContracts(s: GameState, ms: number): GameState {
  const list = s.economy.contracts ?? [];
  if (!list.length || !(ms > 0)) return s;
  const h = ms / HOUR;
  const me = s.player.countryId;
  const stock = { ...s.economy.stock };
  const nations = { ...s.nations };
  const e = { ...s.economy, stock };
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
      const unit = price * sellRate(s, c.country);
      q = Math.min(q, Math.max(0, stock[c.res]), Math.max(0, nations[c.country].treasury) / unit);
      stock[c.res] -= q;
      nations[me] = { ...nations[me], treasury: nations[me].treasury + q * unit };
      nations[c.country] = { ...nations[c.country], treasury: nations[c.country].treasury - q * unit };
    }
    if (q > 0) pushMarket(e, s, c.country, c.res, q, c.buy, false);
  }
  return { ...s, nations, economy: e };
}
