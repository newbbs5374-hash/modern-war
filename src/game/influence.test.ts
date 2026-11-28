import { describe, expect, it } from 'vitest';
import type { GameState } from './state';
import { newGame, setRank } from './state';
import { RANKS } from '../data/ranks';
import { INF_DEADLINE_DAYS, influenceAll, influenceProgress } from './influence';
import { canFaith, faithLv, faithTick, startFaith } from './faith';
import { checkVictory } from './victory';
import { loyaltyReasons } from './civ';

const H = 3600e3;
const fresh = (): GameState => {
  const s = setRank(newGame('시험', 'kr', 0, { seed: 7, acts: true }), RANKS.length - 1);
  return { ...s, nations: { ...s.nations, kr: { ...s.nations.kr, treasury: 1e9 } } };
};

describe('11-28 세계 영향력·신앙', () => {
  it('모든 나라 점수는 갈래 최대를 넘지 않음', () => {
    const all = influenceAll(fresh());
    for (const sc of Object.values(all)) {
      expect(sc.mil).toBeLessThanOrEqual(250);
      expect(sc.eco).toBeLessThanOrEqual(200);
      expect(sc.total).toBeLessThanOrEqual(1000);
    }
    expect(all.us.total).toBeGreaterThan(all.kr.total);
  });
  it('신앙 시설을 지으면 민심 줄이 생김', () => {
    let s = fresh();
    expect(canFaith(s, 'center')).toBeNull();
    s = startFaith(s, 'center');
    expect(canFaith(s, 'dialog')).toContain('짓는 중');
    s = faithTick({ ...s, worldMs: s.worldMs + 7 * H });
    expect(faithLv(s, 'center')).toBe(1);
    expect(loyaltyReasons(s, 'kr-0').some(([k]) => k.includes('신앙 센터'))).toBe(true);
  });
  it('12주 점수 마감이 오면 엔딩(1등 아니면 점수 마감)', () => {
    let s = checkVictory(fresh());
    expect(s.infl?.startMs).toBe(0);
    s = checkVictory({ ...s, worldMs: INF_DEADLINE_DAYS * 24 * H + 1 });
    expect(s.ending?.kind).toMatch(/점수 마감|세계 영향력 승리/);
    expect(influenceProgress(s).left).toBe(0);
  });
});
