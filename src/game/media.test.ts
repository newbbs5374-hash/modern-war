import { describe, expect, it } from 'vitest';
import { advance, newGame, type GameState } from './state';
import { answerPress, canPress, grantPetition, holdSummit, mediaOf, newMedia, startPress, summitTargets } from './media';

const H = 3600e3;
const rich = (s: GameState): GameState => ({ ...s, nations: { ...s.nations, kr: { ...s.nations.kr, treasury: 1e9 } } });
describe('기자회견·청원·정상회담', () => {
  it('기자회견: 질문 3개 답하면 끝나고 6시간 기다림', () => {
    let s = newGame('t', 'kr', 0, { seed: 21 });
    s = { ...s, media: newMedia(s) };
    expect(canPress(s)).toBeNull();
    s = startPress(s);
    expect(mediaOf(s).press?.qs.length).toBe(3);
    for (let i = 0; i < 3; i++) s = answerPress(s, 0);
    expect(mediaOf(s).press).toBeNull();
    expect(canPress(s)).not.toBeNull();
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
