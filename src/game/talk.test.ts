import { describe, expect, it } from 'vitest';
import { advance, newGame, setRank, type GameState } from './state';
import { answerTalk, debugTalk, makeTalk, TALK_TTL_MS, worldMood, type Talk } from './talk';
import { pairKey, relationOf } from './world';
import { COMMAND_TOP, doDiplo } from './command';
import { Rng } from './rng';

const H = 3600e3;

function withTalk(s: GameState, t: Partial<Talk>): GameState {
  const talk: Talk = {
    id: 999,
    kind: '시험',
    who: 'cn',
    speaker: '시험 사절',
    icon: '🧪',
    text: '',
    untilMs: s.worldMs + TALK_TTL_MS,
    ignore: { text: '무시', tension: 10 },
    choices: [],
    ...t,
  };
  return { ...s, officer: { ...s.officer, talks: [talk] } };
}

describe('대화', () => {
  it('시간이 지나면 대화가 찾아오고, 3개까지만 쌓임', () => {
    let s = newGame('t', 'kr', 0, { seed: 3 });
    s = advance(s, 2 * H);
    expect((s.officer.talks ?? []).length).toBeGreaterThan(0);
    s = advance(s, 5 * H);
    expect((s.officer.talks ?? []).length).toBeLessThanOrEqual(3);
  });

  it('상황에 맞는 대화: 전쟁 중이면 휴전 제의가 나올 수 있음', () => {
    let s = newGame('t', 'kr', 0, { seed: 3 });
    const k = pairKey('kr', 'kp');
    s = { ...s, world: { ...s.world, pairs: { ...s.world.pairs, [k]: { ...s.world.pairs[k], rel: '전쟁' } } } };
    const kinds = new Set<string>();
    for (let i = 0; i < 60; i++) kinds.add(makeTalk(s, new Rng(i))?.kind ?? '');
    expect(kinds.has('휴전 제의')).toBe(true);
    expect(kinds.has('시민')).toBe(true);
  });

  it('고른 대답이 관계를 바꿈: 연합 · 전쟁 · 긴장', () => {
    let s = newGame('t', 'kr', 0, { seed: 3 });
    s = withTalk(s, { who: 'in', choices: [{ att: '화해', label: '연합', base: 1, ok: { text: '연합', rel: '연합' } }] });
    s = answerTalk(s, 999, 0).state;
    expect(relationOf(s.world, 'kr', 'in')).toBe('연합');
    expect(s.officer.talks).toHaveLength(0);
    expect(s.world.events[0].text).toContain('연합');

    s = withTalk(s, { who: 'kp', choices: [{ att: '위협', label: '쏜다', base: 1, ok: { text: '전쟁', rel: '전쟁' } }] });
    s = answerTalk(s, 999, 0).state;
    expect(relationOf(s.world, 'kr', 'kp')).toBe('전쟁');

    // 긴장이 한계를 넘으면 전쟁
    const k = pairKey('kr', 'cn');
    s = { ...s, world: { ...s.world, pairs: { ...s.world.pairs, [k]: { ...s.world.pairs[k], rel: '중립', tension: 90 } } } };
    s = withTalk(s, { who: 'cn', choices: [{ att: '위협', label: '도발', base: 1, ok: { text: '도발', tension: 30 } }] });
    s = answerTalk(s, 999, 0).state;
    expect(relationOf(s.world, 'kr', 'cn')).toBe('전쟁');
  });

  it('스탯이 모자라면 선택지가 잠김', () => {
    let s = newGame('t', 'kr', 0, { seed: 3 });
    s = withTalk(s, { choices: [{ att: '위협', label: '위협', stat: '통솔', need: 99, base: 0.5, ok: { text: 'x', tension: -50 } }] });
    const r = answerTalk(s, 999, 0);
    expect(r.out).toBeNull();
    expect(r.state).toBe(s);
  });

  it('답하지 않으면 6시간 뒤 무시한 결과가 남음', () => {
    let s = newGame('t', 'kr', 0, { seed: 3 });
    const before = s.world.pairs[pairKey('kr', 'cn')].tension;
    s = withTalk(s, { who: 'cn', choices: [] });
    s = { ...s, officer: { ...s.officer, talkNextMs: 1e15 } };
    s = advance(s, 7 * H);
    expect((s.officer.talks ?? []).some((t) => t.id === 999)).toBe(false);
    expect(s.world.events.some((e) => e.text.includes('무시'))).toBe(true);
    expect(s.world.pairs[pairKey('kr', 'cn')].tension).toBeGreaterThan(before);
  });

  it('불가침 약속을 깨고 선전포고하면 신뢰·명성이 떨어짐', () => {
    let s = setRank(newGame('t', 'kr', 0, { seed: 3 }), COMMAND_TOP);
    s = withTalk(s, { who: 'in', choices: [{ att: '원칙', label: '약속', base: 1, ok: { text: '약속', promise: true } }] });
    s = answerTalk(s, 999, 0).state;
    s = { ...s, officer: { ...s.officer, trust: 80, fame: 50 } };
    const r = doDiplo(s, 'in', '선전포고');
    expect(r.text).toContain('불가침 약속');
    expect(r.state.officer.trust).toBe(70);
    expect(r.state.officer.fame).toBe(40);
  });

  it('세계 흐름은 처음엔 평화, 시험 버튼으로 대화를 바로 받음', () => {
    const s = newGame('t', 'kr', 0, { seed: 3 });
    expect(worldMood(s.world)).toBeLessThan(30);
    expect(debugTalk(s).officer.talks?.length).toBe(1);
  });
});
