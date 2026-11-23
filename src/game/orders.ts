// 미리 명령(자리 비운 동안 부관이 지키는 규칙)과 "자리 비운 동안" 보고서.
// 미리 명령은 실제 15분(세계 판단)마다 확인함 → 꺼 둔 동안에도 똑같이 작동.
import { CITIES } from '../data/cities';
import { countryById } from '../data/world';
import { techById } from '../data/civ';
import type { Res } from '../data/economy';
import { canChoose, chooseCrisis, crisisById, crisisOf } from './crisis';
import { canTrade, producesOf, trade, tradePartners, tradePrice } from './economy';
import type { GameState } from './state';
import { civOf } from './civ';

export interface OrdersState {
  /** 봉급이 쌓이면 바로 받기 */
  autoSalary: boolean;
  /** 강철·석유가 기준 아래로 떨어지면 가장 싼 나라에서 자동 수입 */
  autoImport: boolean;
  /** 방어 태세: 내 도시 방어 +10%, 대신 국방예산 수입 -10% */
  defendFirst: boolean;
  /** 돌발 사건은 부관이 바로 무난한 쪽으로 처리 */
  crisisToAide: boolean;
  /** 자동으로 한 일(최근) */
  log: string[];
  /** 지금까지 자동 수입에 쓴 돈 */
  spent: number;
  /** 지금까지 자동으로 한 일 수 */
  n?: number;
}

export const IMPORT_BELOW = 60;
export const IMPORT_QTY = 60;
/** 자동 수입은 국방예산이 이만큼은 남아 있을 때만 */
export const IMPORT_KEEP = 2000;
export const AUTO_IMPORT_RES: Res[] = ['강철', '석유'];
export const DEFEND_BONUS = 1.1;
export const DEFEND_BUDGET = 0.9;

export const newOrders = (): OrdersState => ({ autoSalary: false, autoImport: false, defendFirst: false, crisisToAide: false, log: [], spent: 0 });
export const ordersOf = (s: GameState): OrdersState => s.orders ?? newOrders();

export const ORDER_INFO: Array<{ key: 'autoSalary' | 'autoImport' | 'defendFirst' | 'crisisToAide'; icon: string; name: string; text: string }> = [
  { key: 'autoSalary', icon: '💵', name: '봉급 자동 받기', text: '봉급이 12시간 한도에 막히지 않게 부관이 바로 받아 둬요.' },
  { key: 'autoImport', icon: '🛢️', name: '자원 자동 수입', text: `강철·석유가 ${IMPORT_BELOW}개 아래로 떨어지면 가장 싼 나라에서 ${IMPORT_QTY}개씩 사요(국방예산 ${IMPORT_KEEP.toLocaleString('ko-KR')}은 남겨 둠).` },
  { key: 'defendFirst', icon: '🛡️', name: '방어 태세', text: '공격받을 때를 대비해 내 도시 방어 +10%. 대신 국방예산 수입 -10%.' },
  { key: 'crisisToAide', icon: '⚡', name: '돌발 사건 부관에게 맡기기', text: '사건이 터지면 기다리지 않고 부관이 바로 무난한 쪽을 골라요(해결 업적·할 일은 안 셈).' },
];

export function setOrder(s: GameState, key: (typeof ORDER_INFO)[number]['key'], on: boolean): GameState {
  return { ...s, orders: { ...ordersOf(s), [key]: on } };
}
export const ordersDefense = (s: GameState) => (s.orders?.defendFirst ? DEFEND_BONUS : 1);
export const ordersBudget = (s: GameState) => (s.orders?.defendFirst ? DEFEND_BUDGET : 1);

function olog(o: OrdersState, text: string): OrdersState {
  return { ...o, log: [text, ...o.log].slice(0, 12), n: (o.n ?? 0) + 1 };
}

/** 15분마다: 미리 명령 실행 */
export function ordersTick(s: GameState): GameState {
  const o0 = s.orders;
  if (!o0 || s.ending) return s;
  let ns = s;
  let o = o0;
  if (o.autoSalary && ns.player.pendingSalary >= 1) {
    const got = Math.floor(ns.player.pendingSalary);
    ns = { ...ns, player: { ...ns.player, salary: ns.player.salary + got, pendingSalary: ns.player.pendingSalary - got } };
  }
  if (o.autoImport) {
    const me = ns.player.countryId;
    for (const r of AUTO_IMPORT_RES) {
      if ((ns.economy.stock[r] ?? 0) >= IMPORT_BELOW) continue;
      const sellers = tradePartners(ns).filter((id) => producesOf(ns, id).includes(r));
      if (!sellers.length) continue;
      const id = sellers.sort((a, b) => tradePrice(ns, a, r) - tradePrice(ns, b, r))[0];
      const cost = tradePrice(ns, id, r) * IMPORT_QTY;
      if (ns.nations[me].treasury - cost < IMPORT_KEEP || canTrade(ns, id, r, IMPORT_QTY, true)) continue;
      ns = trade(ns, id, r, IMPORT_QTY, true);
      o = olog({ ...o, spent: o.spent + cost }, `🛢️ ${countryById(id).name}에서 ${r} ${IMPORT_QTY}개 자동 수입(-${cost.toLocaleString('ko-KR')})`);
    }
  }
  const open = crisisOf(ns).open;
  if (o.crisisToAide && open) {
    const d = crisisById(open.def);
    const i = !canChoose(ns, d.options[d.auto]) ? d.auto : d.options.findIndex((x) => !canChoose(ns, x));
    ns = chooseCrisis(ns, i < 0 ? d.options.length - 1 : i, true);
    o = olog(o, `⚡ ${d.title}: 부관이 "${d.options[i < 0 ? d.options.length - 1 : i].label}"을(를) 골랐어요`);
  }
  return o === o0 && ns === s ? s : { ...ns, orders: o };
}

// ── 자리 비운 동안 보고서 ──
export interface AwaySummary {
  hours: number;
  rows: Array<{ icon: string; label: string; value: string; tone?: 'good' | 'bad' }>;
  events: string[];
}

const sg = (v: number) => (v >= 0 ? '+' : '') + Math.round(v).toLocaleString('ko-KR');

/** 꺼 두기 전(b)과 따라잡은 뒤(a)를 비교한 한 장 보고 */
export function summarizeAway(b: GameState, a: GameState, awayMs: number): AwaySummary {
  const me = a.player.countryId;
  const rows: AwaySummary['rows'] = [];
  const dSalary = a.player.salary + a.player.pendingSalary - (b.player.salary + b.player.pendingSalary);
  if (Math.round(dSalary)) rows.push({ icon: '💵', label: '봉급', value: sg(dSalary), tone: 'good' });
  const dMoney = a.nations[me].treasury - b.nations[me].treasury;
  rows.push({ icon: '💰', label: '국방예산', value: sg(dMoney), tone: dMoney >= 0 ? 'good' : 'bad' });
  const dTroops = a.nations[me].troops - b.nations[me].troops;
  rows.push({ icon: '🪖', label: '병력', value: sg(dTroops), tone: dTroops >= 0 ? 'good' : 'bad' });
  const mine = (s: GameState) => CITIES.filter((c) => s.world.owner[c.id] === me).map((c) => c.id);
  const before = new Set(mine(b));
  const after = new Set(mine(a));
  const won = [...after].filter((x) => !before.has(x));
  const lost = [...before].filter((x) => !after.has(x));
  const cname = (id: string) => CITIES.find((c) => c.id === id)!.name;
  if (won.length) rows.push({ icon: '🏴', label: '차지한 도시', value: won.map(cname).join(', '), tone: 'good' });
  if (lost.length) rows.push({ icon: '🔥', label: '잃은 도시', value: lost.map(cname).join(', '), tone: 'bad' });
  const wars = (s: GameState) => Object.entries(s.world.pairs).filter(([k, p]) => p.rel === '전쟁' && k.split('|').includes(me)).map(([k]) => k);
  const wb = new Set(wars(b));
  const wa = new Set(wars(a));
  const other = (k: string) => countryById(k.split('|').find((x) => x !== me)!).name;
  const newWars = [...wa].filter((k) => !wb.has(k));
  const endWars = [...wb].filter((k) => !wa.has(k));
  if (newWars.length) rows.push({ icon: '⚔️', label: '새 전쟁', value: newWars.map(other).join(', '), tone: 'bad' });
  if (endWars.length) rows.push({ icon: '🕊️', label: '끝난 전쟁', value: endWars.map(other).join(', '), tone: 'good' });
  const techs = civOf(a).done.filter((t) => !civOf(b).done.includes(t));
  if (techs.length) rows.push({ icon: '🔬', label: '끝난 연구', value: techs.map((t) => techById(t)?.name ?? t).join(', '), tone: 'good' });
  const units = Object.entries(a.economy.army)
    .map(([n, v]) => [n, v - (b.economy.army[n] ?? 0)] as const)
    .filter(([, d]) => d > 0);
  if (units.length) rows.push({ icon: '🏭', label: '완성된 부대', value: units.map(([n, d]) => `${n} ${d}`).join(', '), tone: 'good' });
  const closed = (s: GameState) => crisisOf(s).nextId - (crisisOf(s).open ? 1 : 0);
  const crises = crisisOf(a).log.slice(0, Math.max(0, closed(a) - closed(b))).slice(0, 3);
  for (const c of crises) rows.push({ icon: '⚡', label: '돌발 사건', value: c });
  const auto = ordersOf(a).log.slice(0, Math.max(0, (ordersOf(a).n ?? 0) - (ordersOf(b).n ?? 0))).slice(0, 3);
  for (const t of auto) rows.push({ icon: '📋', label: '미리 명령', value: t });
  {
    const pa = Math.round(a.pres?.approval ?? 50);
    const pb = Math.round(b.pres?.approval ?? 50);
    if (pa !== pb) rows.push({ icon: '🙂', label: '지지도', value: `${pb} → ${pa}`, tone: pa >= pb ? 'good' : 'bad' });
  }
  if (Math.round(a.officer.trust) !== Math.round(b.officer.trust)) rows.push({ icon: '🤝', label: '신뢰도', value: `${Math.round(b.officer.trust)} → ${Math.round(a.officer.trust)}`, tone: a.officer.trust >= b.officer.trust ? 'good' : 'bad' });
  const events = a.world.events.filter((e) => e.mine && e.t > b.worldMs).slice(0, 6).map((e) => e.text);
  return { hours: awayMs / 3600e3, rows, events };
}
