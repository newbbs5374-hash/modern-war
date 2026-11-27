import { describe, expect, it } from 'vitest';
import { newGame, type GameState } from './state';
import { campaignDiff, campaignInfo, campaignLocked, campaignNext, campaignRoute, noteCampaignLoss, noteCampaignWin } from './campaign';
import { grandTargets } from './officer';
import { cityById } from '../data/cities';

const war = (act: number | undefined): GameState => {
  const s = newGame('시험', 'kr', 0, { seed: 7, acts: true });
  s.world.act = act;
  s.world.pairs['jp|kr'].rel = '전쟁';
  s.player.rankIndex = 10;
  return s;
};

describe('전역', () => {
  it('길은 본토 거점 전부, 수도가 맨 끝', () => {
    const s = war(2);
    const r = campaignRoute(s, 'jp');
    expect(r.length).toBeGreaterThan(2);
    expect(cityById(r[r.length - 1]).capital).toBe(true);
    expect(r.slice(0, -1).some((id) => cityById(id).capital)).toBe(false);
    expect(campaignNext(s, 'jp')).toBe(r[0]);
  });
  it('차례가 아닌 도시는 잠기고 대전투 대상에서 빠진다(옛 저장은 순서 없음)', () => {
    const s = war(2);
    const r = campaignRoute(s, 'jp');
    expect(campaignLocked(s, r[0])).toBe(false);
    expect(campaignLocked(s, r[1])).toBe(true);
    const t = grandTargets(s).filter((id) => cityById(id).home === 'jp');
    expect(t).toEqual([r[0]]);
    const old = war(undefined);
    expect(campaignLocked(old, r[1])).toBe(false);
  });
  it('이기면 기세가 붙고, 반격에 지면 보급선이 끊긴다', () => {
    const s = war(2);
    const r = campaignRoute(s, 'jp');
    s.world.owner[r[0]] = 'kr';
    noteCampaignWin(s, r[0], 'jp');
    expect(campaignInfo(s, 'jp').streak).toBe(1);
    expect(campaignDiff(s, r[1])).toBeLessThan(0);
    expect(campaignNext(s, 'jp')).toBe(r[1]);
    noteCampaignLoss(s, 'jp');
    expect(campaignInfo(s, 'jp').cut).toBe(true);
    expect(campaignDiff(s, r[1])).toBeGreaterThan(0);
  });
  it('수도를 차지하면 전역 완료 보상을 한 번만', () => {
    const s = war(3);
    const r = campaignRoute(s, 'jp');
    for (const id of r) s.world.owner[id] = 'kr';
    const cap = r[r.length - 1];
    const b0 = s.officer.boosts ?? 0;
    noteCampaignWin(s, cap, 'jp');
    expect((s.officer.boosts ?? 0) - b0).toBe(3);
    noteCampaignWin(s, cap, 'jp');
    expect((s.officer.boosts ?? 0) - b0).toBe(3);
    expect(s.campaign?.done).toEqual(['jp']);
  });
});
