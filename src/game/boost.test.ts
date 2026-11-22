import { describe, expect, test } from 'vitest';
import { newGame } from './state';
import { BOOST_MS, TEST_BOOSTS, boostLeft, boostsOf, boostsToFinish, useBoost } from './boost';
import { boardNow, debugAddAide, sendAide, startMission } from './officer';

describe('가속권', () => {
  test('새 판은 시험용 가속권을 넉넉히 받음', () => {
    expect(boostsOf(newGame('t', 'kr', 0, { seed: 1 }))).toBe(TEST_BOOSTS);
  });
  test('임무: 한 장에 30분, 바로 끝내기는 필요한 만큼만 씀', () => {
    let s = newGame('t', 'kr', 0, { seed: 1 });
    const b = boardNow(s);
    s = startMission(b.state, b.state.officer.board[0].id);
    const left = boostLeft(s, { kind: 'mission' });
    expect(left).toBeGreaterThan(0);
    const one = useBoost(s, { kind: 'mission' }, 1);
    expect(boostLeft(one, { kind: 'mission' })).toBe(left - BOOST_MS);
    expect(boostsOf(one)).toBe(TEST_BOOSTS - 1);
    const need = boostsToFinish(s, { kind: 'mission' });
    const all = useBoost(s, { kind: 'mission' }, 999);
    expect(boostLeft(all, { kind: 'mission' })).toBe(0);
    expect(boostsOf(all)).toBe(TEST_BOOSTS - need);
    expect(useBoost(all, { kind: 'mission' }, 1)).toBe(all); // 끝난 건 안 씀
  });
  test('부관 심부름도 줄어듦', () => {
    let s = debugAddAide(newGame('t', 'kr', 0, { seed: 3 }));
    const id = s.officer.aides[0].id;
    s = sendAide(s, id, '전공 쌓기');
    const t = { kind: 'errand', id } as const;
    expect(boostLeft(useBoost(s, t, 999), t)).toBe(0);
  });
});
