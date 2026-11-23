import { describe, expect, it } from 'vitest';
import { TITLES, rankOfTier } from '../data/ranks';
import { newGame, advance, setRank } from './state';
import { debugTitleUp, famePts, nextTitle, syncTitle, tierOf, titleScore } from './title';
import { demote } from './approval';

const H = 3600e3;

describe('호칭(11-23: 승급 대신 신뢰도+명성)', () => {
  it('15단계, 최대 200점, 혜택 단계 0~10', () => {
    expect(TITLES.length).toBe(15);
    expect(rankOfTier(0)).toBe(0);
    expect(rankOfTier(14)).toBe(10);
    expect(tierOf(0)).toBe(0);
    expect(tierOf(200)).toBe(14);
    expect(tierOf(65)).toBe(1);
  });
  it('내려갈 때 3점 여유', () => {
    expect(tierOf(58, 1)).toBe(1);
    expect(tierOf(56, 1)).toBe(0);
  });
  it('새 판은 첫 호칭, 명성이 쌓이면 저절로 오름', () => {
    let s = newGame('t', 'kr', 0, { seed: 2 });
    expect(s.player.title).toBe(0);
    expect(s.player.rankIndex).toBe(0);
    s = { ...s, officer: { ...s.officer, trust: 50, fame: 300 } };
    expect(famePts(s.officer)).toBe(30);
    expect(titleScore(s)).toBe(80);
    s = advance(s, 1000);
    expect(s.player.title).toBe(3);
    expect(s.player.rankIndex).toBe(rankOfTier(3));
    expect(s.world.events.some((e) => e.text.includes('호칭이'))).toBe(true);
  });
  it('시험 버튼은 다음 호칭으로', () => {
    let s = newGame('t', 'kr', 0, { seed: 3 });
    s = debugTitleUp(s);
    expect(s.player.title).toBe(1);
    expect(nextTitle(s)?.title.name).toBe(TITLES[2].name);
  });
  it('setRank은 그 혜택 단계가 되도록 점수를 맞춤', () => {
    for (const r of [0, 3, 5, 10]) expect(setRank(newGame('t', 'kr', 0, { seed: 4 }), r).player.rankIndex).toBe(r);
  });
  it('탄핵·재신임 실패는 신뢰도 −15 · 명성 −100 → 호칭이 내려감', () => {
    let s = setRank(newGame('t', 'kr', 0, { seed: 5 }), 5);
    const t0 = s.player.title!;
    s = syncTitle(demote(s, '시험'));
    expect(s.player.title!).toBeLessThan(t0);
  });
  it('옛 저장(승급 시절 등급)은 그 등급 호칭으로 이어짐', () => {
    const s0 = newGame('t', 'kr', 0, { seed: 6 });
    const old = { ...s0, player: { ...s0.player, title: undefined, rankIndex: 6 } };
    const s = syncTitle(old);
    expect(s.player.rankIndex).toBe(6);
    void H;
  });
});
