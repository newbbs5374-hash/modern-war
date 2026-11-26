import { describe, expect, it } from 'vitest';
import { archRivalsOf, isArchRival } from '../data/archRivals';
import { COUNTRIES } from '../data/world';
import { addContract, canContract, sellRate, tradePrice } from './economy';
import { answerPost, fillSns, snsOf, snsSeen, snsUnread } from './leaderSns';
import { pressureOf } from './pressure';
import { advance, newGame } from './state';
import { isRival, pairKey } from './world';

const H = 3600e3;

describe('숙적(11-26)', () => {
  it('모든 나라에 숙적이 1개 이상, 서로 짝', () => {
    for (const c of COUNTRIES) {
      expect(archRivalsOf(c.id).length).toBeGreaterThan(0);
      for (const r of archRivalsOf(c.id)) {
        expect(isArchRival(r, c.id)).toBe(true);
        expect(isRival(c.id, r)).toBe(true);
      }
    }
    expect(isArchRival('kr', 'kp')).toBe(true);
    expect(isArchRival('kr', 'us')).toBe(false);
  });
  it('숙적과 교역: 비싸게 사고 싸게 팔고, 정기 계약은 거절', () => {
    const s = newGame('t', 'kr', 0, { seed: 3 });
    expect(tradePrice(s, 'jp', '석유')).toBeGreaterThan(tradePrice({ ...s, player: { ...s.player, countryId: 'us' } }, 'jp', '석유'));
    expect(sellRate(s, 'jp')).toBeLessThan(sellRate(s, 'us'));
    expect(canContract(s, 'jp', '석유', 1, false)).toContain('숙적');
    expect(addContract(s, 'jp', '석유', 1, false)).toBe(s);
  });
  it('사흘이면 AI 숙적끼리 높은 관세를 서로 걸어 둠', () => {
    const s = advance(newGame('t', 'kr', 0, { seed: 5 }), 72 * H);
    const ts = pressureOf(s).tariffs.filter((t) => t.untilMs > s.worldMs && isArchRival(t.from, t.to) && t.from !== 'kr' && t.to !== 'kr');
    expect(ts.length).toBeGreaterThanOrEqual(5);
    expect(ts.some((t) => t.rate >= 0.3)).toBe(true);
  });
});

describe('정상 SNS(11-26)', () => {
  it('조사 붙이기', () => {
    expect(fillSns('{B:은} {A:이} {B:과}', { A: '한국', B: '미국' })).toBe('미국은 한국이 미국과');
    expect(fillSns('{B:은} {B:을}', { B: '러시아' })).toBe('러시아는 러시아를');
  });
  it('하루면 글이 50개쯤, 숙적 헐뜯기가 가장 많고 맞받아치기도 있음', () => {
    const s = advance(newGame('t', 'kr', 0, { seed: 4 }), 24 * H);
    const posts = snsOf(s).posts;
    expect(posts.length).toBeGreaterThanOrEqual(40);
    const diss = posts.filter((p) => p.kind === 'diss');
    expect(diss.length).toBeGreaterThan(posts.length / 3);
    expect(diss.every((p) => isArchRival(p.from, p.to!))).toBe(true);
    expect(posts.some((p) => p.kind === 'reply')).toBe(true);
    expect(posts.every((p) => !p.text.includes('{'))).toBe(true);
    expect(snsUnread(s)).toBeGreaterThan(0);
    expect(snsUnread(snsSeen(s))).toBe(0);
  });
  it('우리 나라를 헐뜯은 글에 맞받아치기: 명성·긴장 오르고 한 번만', () => {
    const s = advance(newGame('t', 'kr', 0, { seed: 4 }), 48 * H);
    const p = snsOf(s).posts.find((x) => x.to === 'kr' && x.kind === 'diss');
    expect(p).toBeTruthy();
    const r = answerPost(s, p!.id, true);
    expect(r.state.officer.fame).toBe(s.officer.fame + 3);
    const k = pairKey('kr', p!.from);
    if (!['전쟁', '연합'].includes(s.world.pairs[k].rel)) expect(r.state.world.pairs[k].tension).toBeGreaterThan(s.world.pairs[k].tension);
    expect(snsOf(r.state).posts[0].kind).toBe('mine');
    expect(answerPost(r.state, p!.id, true).state).toBe(r.state);
  });
});
