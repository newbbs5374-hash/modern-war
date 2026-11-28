import { describe, expect, it } from 'vitest';
import { newGame, setRank } from './state';
import { buyGrand, canBuyGrand, noteGrand } from './acts';
import { GRAND_BOOST_PER_DAY, GRAND_EXTRA_RUBY, GRAND_PER_DAY } from './balance';
import { boostCapLeft, useBoost } from './boost';
import { goalsOf } from './goals';
import { FRONT } from '../data/cities';
import { RANKS } from '../data/ranks';

const H = 3600e3;
const fresh = () => setRank(newGame('시험', 'kr', 0, { seed: 7, acts: true }), RANKS.length - 1);

describe('11-28 중과금 밸런스', () => {
  it('대전투 가속권은 하루 24장까지, 다음 날 다시 참', () => {
    let s = fresh();
    s = { ...s, officer: { ...s.officer, boosts: 100, grandReadyMs: s.worldMs + 100 * H } };
    s = useBoost(s, { kind: 'grand' }, 30);
    expect(s.officer.boosts).toBe(100 - GRAND_BOOST_PER_DAY);
    expect(boostCapLeft(s, { kind: 'grand' })).toBe(0);
    expect(useBoost(s, { kind: 'grand' }, 1)).toBe(s);
    // 다른 가속은 상한 없음
    expect(boostCapLeft(s, { kind: 'chore' })).toBe(Infinity);
    expect(boostCapLeft({ ...s, worldMs: s.worldMs + 24 * H }, { kind: 'grand' })).toBe(GRAND_BOOST_PER_DAY);
  });

  it('2·4장에는 대전투를 루비로 더 살 수 없음', () => {
    let s = fresh();
    const foreign = FRONT.find((c) => c.home === 'kp')!.id;
    for (let i = 0; i < GRAND_PER_DAY; i++) s = { ...s, officer: { ...s.officer, grandDay: noteGrand(s, foreign) } };
    s = { ...s, goals: { ...goalsOf(s), ruby: GRAND_EXTRA_RUBY * 3 } };
    for (const act of [2, 4]) expect(canBuyGrand({ ...s, world: { ...s.world, act } })).toContain('장에는');
    const three = { ...s, world: { ...s.world, act: 3 } };
    expect(canBuyGrand(three)).toBeNull();
    expect(canBuyGrand(buyGrand(three))).toBeTruthy();
  });
});
