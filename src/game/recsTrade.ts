// 11-28 무역 장관 추천(대장 예: "A국에 X를 팔고, B국에서 Y를 사서 C국에 팔면 이득").
// 모두 실제 시세(buyCost·sellGain)로 계산하므로 숫자가 정확함. 장관이 서툴면 recs.ts가 숫자에 오차를 붙임.
import { countryById } from '../data/world';
import { RES_PRICE, RESOURCES, UNIT_COST, type Res } from '../data/economy';
import { buyCost, canTrade, cancelContract, contractPaused, marketRoom, producesOf, sellGain, trade, tradePartners, tradePrice, sellPrice } from './economy';
import { approx, registerRecs, type Rec } from './recs';
import type { GameState } from './state';

/** 부대 만들 때 쓰는 자원(모자라면 생산이 막힘) */
export const USED_RES: ReadonlySet<Res> = new Set(Object.values(UNIT_COST).flatMap((c) => Object.keys(c.res) as Res[]));
/** 이만큼은 남겨 두고 팖 */
export const KEEP = 20;
/** 이보다 적으면 모자람 */
export const LOW = 6;
const QTYS = [5, 10, 20, 40, 80];
const name = (id: string) => countryById(id).name;
const unit = (k: number, v: number) => approx(v * k);

/** 남는 자원을 가장 비싸게 사 주는 나라 */
export function sellSurplusRecs(s: GameState): Rec[] {
  const out: Rec[] = [];
  const ps = tradePartners(s);
  for (const r of RESOURCES) {
    const have = Math.floor(s.economy.stock[r] ?? 0);
    const extra = have - (USED_RES.has(r) ? KEEP * 2 : KEEP);
    if (extra < 5) continue;
    let best: { id: string; q: number; g: number } | null = null;
    for (const id of ps) {
      const q = Math.min(extra, marketRoom(s, id, r), 80);
      if (q < 5 || canTrade(s, id, r, q, false)) continue;
      const g = sellGain(s, id, r, q);
      if (!best || g > best.g) best = { id, q, g };
    }
    if (!best) continue;
    const b = best;
    out.push({
      id: `sell:${r}:${b.id}:${b.q}`,
      field: 'economy',
      tab: 'trade',
      icon: '📦',
      title: `${name(b.id)}에 ${r} ${b.q}개 팔기`,
      value: b.g,
      gain: (k) => `+${unit(k, b.g)}`,
      why: `${r}이(가) ${have}개로 남아요. ${name(b.id)}이(가) 가장 비싸게(개당 ${sellPrice(s, b.id, r).toLocaleString('ko-KR')}) 사 줘요.`,
      act: (x) => trade(x, b.id, r, b.q, false),
      can: (x) => canTrade(x, b.id, r, b.q, false),
    });
  }
  return out;
}

/** 부대 만들 자원이 모자라면 가장 싸게 파는 나라에서 사기 */
export function buyShortRecs(s: GameState): Rec[] {
  const out: Rec[] = [];
  const ps = tradePartners(s);
  for (const r of USED_RES) {
    const have = Math.floor(s.economy.stock[r] ?? 0);
    if (have >= LOW) continue;
    const q = 10;
    const sellers = ps.filter((id) => producesOf(s, id).includes(r) && !canTrade(s, id, r, q, true));
    if (!sellers.length) continue;
    const id = sellers.sort((a, b) => buyCost(s, a, r, q) - buyCost(s, b, r, q))[0];
    const cost = buyCost(s, id, r, q);
    const avg = sellers.reduce((a, x) => a + tradePrice(s, x, r), 0) / sellers.length;
    out.push({
      id: `buy:${r}:${id}`,
      field: 'economy',
      tab: 'trade',
      icon: '🛒',
      title: `${name(id)}에서 ${r} ${q}개 사기`,
      // 모자란 자원은 부대 생산을 막으므로 자원 기본값의 2배만큼 가치로 봄
      value: Math.max(1, RES_PRICE[r] * q * 2 - cost * 0.5),
      gain: (k) => `−${unit(k, cost)} · 생산 막힘 풀림`,
      why: `${r}이(가) ${have}개뿐이에요. ${name(id)}이(가) 가장 싸요(개당 ${tradePrice(s, id, r).toLocaleString('ko-KR')}, 평균 ${Math.round(avg).toLocaleString('ko-KR')}).`,
      act: (x) => trade(x, id, r, q, true),
      can: (x) => canTrade(x, id, r, q, true),
    });
  }
  return out;
}

/** 중계 무역: B국에서 사서 C국에 팔기(시세가 움직이는 만큼 계산해 가장 이득인 수량) */
export function relayRecs(s: GameState): Rec[] {
  const out: Rec[] = [];
  const ps = tradePartners(s);
  for (const r of RESOURCES) {
    const sellers = ps.filter((id) => producesOf(s, id).includes(r)).sort((a, b) => tradePrice(s, a, r) - tradePrice(s, b, r)).slice(0, 3);
    const buyers = [...ps].sort((a, b) => sellPrice(s, b, r) - sellPrice(s, a, r)).slice(0, 3);
    let best: { a: string; c: string; q: number; p: number; cost: number } | null = null;
    for (const a of sellers)
      for (const c of buyers) {
        if (a === c || sellPrice(s, c, r) <= tradePrice(s, a, r)) continue;
        for (const q of QTYS) {
          if (canTrade(s, a, r, q, true)) break;
          const s1 = trade(s, a, r, q, true);
          if (canTrade(s1, c, r, q, false)) break;
          const cost = buyCost(s, a, r, q);
          const p = sellGain(s1, c, r, q) - cost;
          if (p > 0 && (!best || p > best.p)) best = { a, c, q, p, cost };
        }
      }
    if (!best) continue;
    const b = best;
    out.push({
      id: `relay:${r}:${b.a}:${b.c}:${b.q}`,
      field: 'economy',
      tab: 'trade',
      icon: '🔁',
      title: `${name(b.a)}에서 ${r} ${b.q}개 사서 ${name(b.c)}에 팔기`,
      value: b.p,
      gain: (k) => `+${unit(k, b.p)}`,
      why: `${name(b.a)}은(는) ${r}을(를) 만들어 싸고, ${name(b.c)}은(는) 비싸게 사요. 사고팔면 값이 움직이니 ${b.q}개가 가장 이득이에요(먼저 ${approx(b.cost)} 듦).`,
      act: (x) => {
        if (canTrade(x, b.a, r, b.q, true)) return x;
        const x1 = trade(x, b.a, r, b.q, true);
        return canTrade(x1, b.c, r, b.q, false) ? x1 : trade(x1, b.c, r, b.q, false);
      },
      can: (x) => canTrade(x, b.a, r, b.q, true),
    });
  }
  return out;
}

/** 멈춘 정기 계약 정리(자리만 차지함) */
export function pausedContractRecs(s: GameState): Rec[] {
  return (s.economy.contracts ?? [])
    .filter((c) => contractPaused(s, c))
    .map((c) => ({
      id: `cancel:${c.id}`,
      field: 'economy' as const,
      tab: 'trade',
      icon: '🧹',
      title: `멈춘 계약 정리: ${name(c.country)} ${c.res}`,
      value: 300,
      gain: () => '계약 칸 1개 비움',
      why: `${contractPaused(s, c)} 새 계약을 맺을 자리를 만들어요.`,
      act: (x: GameState) => cancelContract(x, c.id),
    }));
}

registerRecs('economy', sellSurplusRecs);
registerRecs('economy', buyShortRecs);
registerRecs('economy', relayRecs);
registerRecs('economy', pausedContractRecs);
