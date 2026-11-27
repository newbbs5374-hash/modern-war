// 11/28 디자인 개편 4단계: 경제부 장관 무역 추천.
// 지금 시세로 "어느 나라에서 무엇을 사서 → 어느 나라에 팔면 남는지", "창고에 남는 것을 어디에 팔지",
// "모자란 자원을 어디서 싸게 살지"를 모든 나라 × 모든 자원으로 따져 이득 순으로 고른다.
// 장관 추천 실행은 6시간마다 ADVICE_PER_DAY번(맡기기도 같은 몫을 씀). 11/28 대장: 3번→12번, 6시간마다 다시 채움.
import { RESOURCES, type Res } from '../data/economy';
import { countryById } from '../data/world';
import { isArchRival } from '../data/archRivals';
import { relationOf } from './world';
import { buyCost, canTrade, producesOf, sellGain, sellPrice, trade, tradePartners, tradePrice } from './economy';
import type { GameState } from './state';

/** 한 번(6시간) 동안 쓸 수 있는 추천 횟수 */
export const ADVICE_PER_DAY = 12;
/** 추천 횟수가 다시 채워지는 간격 */
export const ADVICE_RESET_H = 6;
/** 되팔기 한 번에 쓰는 돈: 나라 예산의 이만큼까지 */
export const ADVICE_SPEND = 0.25;
/** 창고에 남겨 둘 양(부대·시설에 쓸 몫) */
export const ADVICE_KEEP = 20;
/** 한 번에 사고파는 최대 개수 */
export const ADVICE_QTY_MAX = 60;

export type AdviceKind = 'flip' | 'sell' | 'buy';
export interface TradeTip {
  id: string;
  kind: AdviceKind;
  res: Res;
  qty: number;
  /** 사는 나라(되팔기·사기) */
  from?: string;
  /** 파는 나라(되팔기·팔기) */
  to?: string;
  /** 나라 예산 변화(+ 들어옴) */
  gain: number;
  /** 이 추천의 점수(이득 + 덤) */
  score: number;
  /** 까닭 딱지 */
  why: string[];
  /** 연합국과의 거래인가 */
  ally: boolean;
}

const H = 3600_000;
/** 6시간 단위 번호(옛 저장의 하루 번호와 달라 자연히 새로 채워짐) */
export const adviceDay = (s: GameState) => Math.floor(s.worldMs / (ADVICE_RESET_H * H));
/** 다음에 횟수가 다시 채워질 때까지 남은 시간(ms) */
export const adviceResetIn = (s: GameState) => (adviceDay(s) + 1) * ADVICE_RESET_H * H - s.worldMs;
export function adviceLeft(s: GameState): number {
  const a = s.economy.advice;
  return ADVICE_PER_DAY - (a && a.day === adviceDay(s) ? a.n : 0);
}

const persona = (s: GameState, id: string) => s.world.personalities[id] ?? '';

function whyBuy(s: GameState, id: string): string[] {
  const me = s.player.countryId;
  const w: string[] = [];
  if (relationOf(s.world, me, id) === '연합') w.push('연합 10% 할인');
  if (persona(s, id) === '경제형') w.push('경제형 나라 싸게 팖');
  return w;
}
function whySell(s: GameState, id: string): string[] {
  const w: string[] = [];
  if (persona(s, id) === '공격형') w.push(`${countryById(id).name} 비싸게 삼(공격형)`);
  else if (persona(s, id) === '기회주의') w.push(`${countryById(id).name} 조금 비싸게 삼`);
  return w;
}

/** 추천 목록(이득 큰 순). 숙적은 비싸고 싸게 쳐서 자연히 빠짐 */
export function tradeTips(s: GameState): TradeTip[] {
  const me = s.player.countryId;
  const partners = tradePartners(s);
  if (!partners.length) return [];
  const budget = Math.max(0, s.nations[me].treasury);
  const out: TradeTip[] = [];
  for (const r of RESOURCES) {
    const sellers = partners.filter((id) => producesOf(s, id).includes(r));
    let bestSell: { id: string; p: number } | null = null;
    for (const id of partners) {
      const p = sellPrice(s, id, r);
      if (!bestSell || p > bestSell.p) bestSell = { id, p };
    }
    let bestBuy: { id: string; p: number } | null = null;
    for (const id of sellers) {
      const p = tradePrice(s, id, r);
      if (!bestBuy || p < bestBuy.p) bestBuy = { id, p };
    }
    // 1) 되팔기: 싸게 파는 나라에서 사서 비싸게 사는 나라에 팖
    if (bestBuy && bestSell && bestSell.id !== bestBuy.id && bestSell.p > bestBuy.p) {
      // (gain이 0 이하면 아래에서 거름)
      // 11-28 시세 제도: 많이 살수록 값이 오르고 많이 팔수록 내리므로, 실제 값으로 가장 남는 수량을 고름
      const qmax = Math.min(ADVICE_QTY_MAX, Math.floor((budget * ADVICE_SPEND) / Math.max(1, bestBuy.p)));
      let qty = 0;
      let gain = 0;
      for (const q of [5, 10, 20, 40, ADVICE_QTY_MAX]) {
        if (q > qmax) break;
        const g = sellGain(s, bestSell.id, r, q) - buyCost(s, bestBuy.id, r, q);
        if (g > gain) (gain = g), (qty = q);
      }
      if (qty >= 1) {
        const ally = relationOf(s.world, me, bestBuy.id) === '연합' || relationOf(s.world, me, bestSell.id) === '연합';
        if (gain > 0) out.push({ id: `flip-${r}`, kind: 'flip', res: r, qty, from: bestBuy.id, to: bestSell.id, gain, score: gain, why: [...whyBuy(s, bestBuy.id), ...whySell(s, bestSell.id)].slice(0, 2), ally });
      }
    }
    // 2) 창고 정리: 남는 자원을 가장 비싸게 사 주는 나라에
    const have = Math.floor(s.economy.stock[r] ?? 0);
    if (bestSell && have > ADVICE_KEEP) {
      const qty = Math.min(ADVICE_QTY_MAX, have - ADVICE_KEEP);
      const gain = sellGain(s, bestSell.id, r, qty);
      const ally = relationOf(s.world, me, bestSell.id) === '연합';
      out.push({ id: `sell-${r}`, kind: 'sell', res: r, qty, to: bestSell.id, gain, score: gain * 0.6, why: [`창고 ${have}개 · ${ADVICE_KEEP}개 남김`, ...whySell(s, bestSell.id)].slice(0, 2), ally });
    }
    // 3) 모자란 자원: 가장 싸게 파는 나라에서 채우기(평균 값보다 아낀 만큼이 이득)
    if (bestBuy && have < 5 && sellers.length >= 1) {
      const avg = sellers.reduce((a, id) => a + tradePrice(s, id, r), 0) / sellers.length;
      const qty = Math.min(10, Math.floor((budget * 0.1) / Math.max(1, bestBuy.p)));
      if (qty >= 1) {
        const save = Math.round((avg - bestBuy.p) * qty);
        const ally = relationOf(s.world, me, bestBuy.id) === '연합';
        out.push({ id: `buy-${r}`, kind: 'buy', res: r, qty, from: bestBuy.id, gain: -buyCost(s, bestBuy.id, r, qty), score: Math.max(1, save) * 0.5 + 1, why: [`창고 ${have}개 · 부족`, ...(save > 0 ? [`평균보다 ${save} 아낌`] : []), ...whyBuy(s, bestBuy.id)].slice(0, 2), ally });
      }
    }
  }
  return out.filter((t) => !(t.from && isArchRival(me, t.from)) && !(t.to && isArchRival(me, t.to))).sort((a, b) => b.score - a.score);
}

export type TipSort = 'gain' | 'ally' | 'stock';
export function sortTips(list: TradeTip[], by: TipSort): TradeTip[] {
  if (by === 'ally') return [...list].sort((a, b) => Number(b.ally) - Number(a.ally) || b.score - a.score);
  if (by === 'stock') return list.filter((t) => t.kind !== 'flip');
  return list.filter((t) => t.kind !== 'buy');
}

/** 실행할 수 없으면 까닭 */
export function canRunTip(s: GameState, t: TradeTip): string | null {
  if (adviceLeft(s) <= 0) return `장관 추천은 ${ADVICE_RESET_H}시간에 ${ADVICE_PER_DAY}번이에요. ${Math.ceil(adviceResetIn(s) / H)}시간 안에 다시 채워져요`;
  if (t.from) {
    const why = canTrade(s, t.from, t.res, t.qty, true);
    if (why) return why;
  }
  if (t.to && t.kind === 'sell') {
    const why = canTrade(s, t.to, t.res, t.qty, false);
    if (why) return why;
  }
  return null;
}

/** 추천 실행: 사고(→ 팔고), 이번 몫 1 씀 */
export function runTip(s: GameState, t: TradeTip, auto = false): GameState {
  if (canRunTip(s, t)) return s;
  let n = s;
  if (t.from) n = trade(n, t.from, t.res, t.qty, true);
  if (t.to) n = trade(n, t.to, t.res, t.qty, false);
  const day = adviceDay(s);
  const a = s.economy.advice;
  const used = a && a.day === day ? a.n : 0;
  return { ...n, economy: { ...n.economy, advice: { ...(a ?? {}), day, n: used + 1, ...(auto ? { autoDay: day, autoN: (a?.autoDay === day ? (a.autoN ?? 0) : 0) + 1 } : {}) } } };
}

export const autoOn = (s: GameState) => !!s.economy.advice?.auto;
export function setAuto(s: GameState, on: boolean): GameState {
  const a = s.economy.advice ?? { day: adviceDay(s), n: 0 };
  return { ...s, economy: { ...s.economy, advice: { ...a, auto: on } } };
}
/** 맡기기: 1위 되팔기를 이번 몫이 남는 동안 알아서(시간이 흐를 때 부름) */
export function autoTrade(s: GameState): GameState {
  if (!autoOn(s) || adviceLeft(s) <= 0) return s;
  const t = tradeTips(s).find((x) => x.kind === 'flip' && !canRunTip(s, x));
  return t ? runTip(s, t, true) : s;
}
