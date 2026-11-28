import { describe, expect, it } from 'vitest';
import { newGame, setRank } from './state';
import { RANKS } from '../data/ranks';
import { ADVICE_PER_DAY, adviceLeft, adviceResetIn, autoTrade, canRunTip, runTip, setAuto, tradeTips } from './tradeAdvice';

const fresh = () => setRank(newGame('시험', 'kr', 0, { seed: 7 }), RANKS.length - 1);

describe('장관 무역 추천', () => {
  it('추천은 이득 순이고, 되팔기는 사는 값보다 파는 값이 비싸다', () => {
    const s = fresh();
    const tips = tradeTips(s);
    expect(tips.length).toBeGreaterThan(0);
    for (let i = 1; i < tips.length; i++) expect(tips[i - 1].score).toBeGreaterThanOrEqual(tips[i].score);
    for (const t of tips.filter((x) => x.kind === 'flip')) expect(t.gain).toBeGreaterThan(0);
  });
  it('실행하면 예산이 늘고 하루 몫이 줄며, 몫을 다 쓰면 막힌다', () => {
    let s = fresh();
    const me = s.player.countryId;
    const t = tradeTips(s).find((x) => x.kind === 'flip');
    if (!t) return;
    const before = s.nations[me].treasury;
    s = runTip(s, t);
    expect(s.nations[me].treasury).toBe(before + t.gain);
    expect(adviceLeft(s)).toBe(ADVICE_PER_DAY - 1);
    for (let i = 1; i < ADVICE_PER_DAY; i++) s = runTip(s, tradeTips(s).find((x) => x.kind === 'flip') ?? t);
    expect(adviceLeft(s)).toBe(0);
    expect(canRunTip(s, t)).toMatch(/4시간/);
    expect(runTip(s, t)).toBe(s);
    // 4시간이 지나면 다시 채워짐
    s = { ...s, worldMs: s.worldMs + adviceResetIn(s) + 1 };
    expect(adviceLeft(s)).toBe(ADVICE_PER_DAY);
  });
  it('맡기기를 켜면 시간이 흐를 때 장관이 알아서 실행한다', () => {
    let s = setAuto(fresh(), true);
    const n0 = adviceLeft(s);
    s = autoTrade(s);
    expect(adviceLeft(s)).toBeLessThanOrEqual(n0);
  });
});
