import { describe, expect, it } from 'vitest';
import { newGame } from './state';
import { favorOf } from './civ';
import { mediaOf, summitTargets } from './media';
import { STAGES, canTalk, finishTalk, gradeOfTalk, inviteCost, stepScore, talkScore, talkWants, theirLine, type Tone } from './summitTalk';

describe('정상회담 3단계 대화', () => {
  const s0 = newGame('t', 'kr', 0, { seed: 23 });
  const to = summitTargets(s0)[0].id;
  it('바라는 태도는 회담 전에 정해지고 한마디가 있다', () => {
    const w = talkWants(s0, to);
    expect(w.length).toBe(STAGES.length);
    expect(talkWants(s0, to)).toEqual(w);
    for (let i = 0; i < 3; i++) expect(theirLine(w[i], i).length).toBeGreaterThan(5);
  });
  it('점수: 딱 맞으면 2, 따뜻하게는 무난 1', () => {
    expect(stepScore('deal', 'deal')).toBe(2);
    expect(stepScore('deal', 'warm')).toBe(1);
    expect(stepScore('deal', 'firm')).toBe(0);
    expect(gradeOfTalk(6)).toBe('big');
    expect(gradeOfTalk(4)).toBe('ok');
    expect(gradeOfTalk(3)).toBe('fail');
  });
  it('다 맞히면 큰 협정, 다 틀리면 결렬', () => {
    const w = talkWants(s0, to);
    const good = finishTalk(s0, to, 'trade', 'visit', w);
    expect(good.grade).toBe('big');
    expect(favorOf(good.state, to)).toBeGreaterThan(favorOf(s0, to) + 15);
    expect(mediaOf(good.state).summits).toBe(1);
    const wrong = w.map((t): Tone => (t === 'firm' ? 'deal' : 'firm'));
    expect(talkScore(s0, to, 'visit', wrong)).toBeLessThanOrEqual(1);
    const bad = finishTalk(s0, to, 'trade', 'visit', wrong);
    expect(bad.grade).toBe('fail');
    expect(favorOf(bad.state, to)).toBeLessThan(favorOf(s0, to));
    // 하루 한 번
    expect(canTalk(good.state, to, 'visit')).not.toBeNull();
  });
  it('국빈 초청은 돈이 들고 점수 +1', () => {
    const rich = { ...s0, nations: { ...s0.nations, kr: { ...s0.nations.kr, treasury: 1e7 } } };
    const w = talkWants(rich, to);
    expect(talkScore(rich, to, 'invite', w)).toBe(talkScore(rich, to, 'visit', w) + 1);
    const r = finishTalk(rich, to, 'culture', 'invite', w);
    expect(r.state.nations.kr.treasury).toBe(1e7 - inviteCost(rich));
    const poor = { ...s0, nations: { ...s0.nations, kr: { ...s0.nations.kr, treasury: 0 } } };
    expect(canTalk(poor, to, 'invite')).not.toBeNull();
  });
});
