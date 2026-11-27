// 11-28 국방 장관 추천: 생산 줄이 비면 돈값(전투력 ÷ 국방비)이 가장 좋은 부대 만들기.
import { UNIT_COST } from '../data/economy';
import { canProduce, produce, QUEUE_MAX } from './economy';
import { approx, registerRecs, type Rec } from './recs';
import type { GameState } from './state';

export function produceRecs(s: GameState): Rec[] {
  const free = QUEUE_MAX - s.economy.queue.length;
  if (free <= 0) return [];
  const ok = Object.entries(UNIT_COST).filter(([n]) => !canProduce(s, n));
  if (!ok.length) return [];
  const [n, c] = ok.sort((a, b) => b[1].power / Math.max(1, b[1].money) - a[1].power / Math.max(1, a[1].money))[0];
  return [
    {
      id: `prod:${n}`,
      field: 'defense',
      tab: 'forces',
      icon: '🏭',
      title: `${n} 만들기 (생산 줄 ${free}칸 빔)`,
      value: c.power * 120 + free * 200,
      gain: (k) => `전투력 +${Math.round(c.power * k)} · 🛡️−${approx(c.money)}`,
      why: `지금 만들 수 있는 부대 중 국방비 대비 전투력이 가장 좋아요(${c.hours}시간).`,
      act: (x) => produce(x, n),
      can: (x) => canProduce(x, n),
    },
  ];
}

registerRecs('defense', produceRecs);
