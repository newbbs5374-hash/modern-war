import { describe, expect, it } from 'vitest';
import { advance, newGame, type GameState } from './state';
import { answerPress, canPress, grantPetition, holdSummit, mediaOf, newMedia, PRESS_APPROVAL_CAP, PRESS_MAX, PRESS_MIN, QUESTIONS, startPress, summitTargets } from './media';
import { presOf } from './approval';

const H = 3600e3;
const rich = (s: GameState): GameState => ({ ...s, nations: { ...s.nations, kr: { ...s.nations.kr, treasury: 1e9 } } });
describe('기자회견·청원·정상회담', () => {
  it('기자회견: 질문 7~10개 답하면 끝나고 6시간 기다림', () => {
    let s = newGame('t', 'kr', 0, { seed: 21 });
    s = { ...s, media: newMedia(s) };
    expect(canPress(s)).toBeNull();
    s = startPress(s);
    const n = mediaOf(s).press!.qs.length;
    expect(n).toBeGreaterThanOrEqual(PRESS_MIN);
    expect(n).toBeLessThanOrEqual(PRESS_MAX);
    expect(new Set(mediaOf(s).press!.qs).size).toBe(n);
    for (let i = 0; i < n; i++) s = answerPress(s, 0);
    expect(mediaOf(s).press).toBeNull();
    expect(canPress(s)).not.toBeNull();
  });
  it('기자회견: 다음 회견은 지난번과 다른 질문이 대부분, 효과는 한 줄로 합쳐 한도 안', () => {
    let s = newGame('t', 'kr', 0, { seed: 31 });
    s = { ...s, media: newMedia(s) };
    s = startPress(s);
    const first = mediaOf(s).press!.qs;
    for (let i = 0; i < first.length; i++) s = answerPress(s, 0);
    expect(presOf(s).mods.filter((x) => x.why === '🎙️ 기자회견').length).toBeLessThanOrEqual(1);
    for (const x of presOf(s).mods) if (x.why === '🎙️ 기자회견') expect(Math.abs(x.v)).toBeLessThanOrEqual(PRESS_APPROVAL_CAP);
    s = { ...s, worldMs: s.worldMs + 6 * H };
    s = startPress(s);
    const second = mediaOf(s).press!.qs;
    const same = second.filter((id) => first.includes(id)).length;
    expect(same).toBeLessThanOrEqual(2);
  });
  it('모든 질문은 답이 3개이고 효과 글이 있다', () => {
    const s = newGame('t', 'kr', 0, { seed: 5 });
    expect(QUESTIONS.length).toBeGreaterThanOrEqual(50);
    expect(new Set(QUESTIONS.map((q) => q.id)).size).toBe(QUESTIONS.length);
    for (const q of QUESTIONS) {
      expect(q.answers(s).length).toBe(3);
      for (const a of q.answers(s)) expect(a.sum.length).toBeGreaterThan(0);
    }
  });
  it('청원이 올라오고 들어주면 사라짐', () => {
    let s = rich(newGame('t', 'kr', 0, { seed: 22 }));
    s = advance(s, 6 * H);
    const pets = mediaOf(s).petitions;
    expect(pets.length).toBeGreaterThan(0);
    s = grantPetition(s, pets[0].id);
    expect(mediaOf(s).petitions.length).toBe(pets.length - 1);
    expect(mediaOf(s).petDone).toBe(1);
  });
  it('정상회담은 하루 한 번', () => {
    let s = newGame('t', 'kr', 0, { seed: 23 });
    const to = summitTargets(s)[0].id;
    const r = holdSummit(s, to, 'trade');
    expect(r.text).toContain('정상회담');
    s = r.state;
    expect(holdSummit(s, to, 'trade').text).toBe('');
  });
});
