// 11-28 무역 장관 추천: 경제부 무역 추천(tradeAdvice.ts, 하루 3번)을 공통 추천 틀(recs.ts)에 그대로 올림 + 멈춘 계약 정리.
// 숫자는 실제 시세(buyCost·sellGain)로 계산. 맡기기는 tradeAdvice.ts 무역 맡기기가 맡음(recTick은 경제를 건너뜀).
import { countryById } from '../data/world';
import { cancelContract, contractPaused } from './economy';
import { canRunTip, runTip, tradeTips } from './tradeAdvice';
import { approx, registerRecs, type Rec } from './recs';
import type { GameState } from './state';

const name = (id: string) => countryById(id).name;

export function tradeRecs(s: GameState): Rec[] {
  return tradeTips(s)
    .slice(0, 8)
    .map((t) => ({
      id: `trade:${t.id}`,
      field: 'economy' as const,
      tab: 'trade',
      icon: t.kind === 'flip' ? '🔁' : t.kind === 'sell' ? '📦' : '🛒',
      title: t.kind === 'flip' ? `${name(t.from!)}에서 ${t.res} ${t.qty}개 사서 ${name(t.to!)}에 팔기` : t.kind === 'sell' ? `${name(t.to!)}에 ${t.res} ${t.qty}개 팔기` : `${name(t.from!)}에서 ${t.res} ${t.qty}개 사기`,
      value: t.score,
      gain: (k: number) => `${t.gain >= 0 ? '+' : '−'}${approx(Math.abs(t.gain) * k)}`,
      why: t.why.join(' · ') || '지금 시세로 가장 남아요',
      act: (x: GameState) => {
        const cur = tradeTips(x).find((y) => y.id === t.id);
        return cur ? runTip(x, cur) : x;
      },
      can: (x: GameState) => canRunTip(x, t),
    }));
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

registerRecs('economy', tradeRecs);
registerRecs('economy', pausedContractRecs);
