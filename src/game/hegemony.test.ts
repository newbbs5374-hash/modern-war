import { describe, expect, it } from 'vitest';
import { advance, budgetPerDay, newGame, type GameState } from './state';
import { answerHelp, answerSqueeze, askHelp, canAskHelp, hegemonyMult, hegemonyTick, hegOf, openAsks, regionStanding } from './hegemony';
import { canDemand, demandChance, doDemand, lordOf } from './surrender';
import { pairKey, relationOf } from './world';
import { aiStrength } from './balance';

const H = 3600e3;
const step = (s: GameState) => hegemonyTick({ ...s, worldMs: s.worldMs + 15 * 60e3 });
function war(s: GameState, a: string, b: string): GameState {
  const k = pairKey(a, b);
  return { ...s, world: { ...s.world, pairs: { ...s.world.pairs, [k]: { ...s.world.pairs[k], rel: '전쟁', tension: 0, weariness: 0 } } } };
}

describe('대륙 패권(11-27)', () => {
  it('대륙 순위: 아시아는 중국이 1등, 지분 합 1', () => {
    const s = newGame('t', 'kr', 0, { seed: 1 });
    const st = regionStanding(s, 'asia');
    expect(st[0].id).toBe('cn');
    expect(st.reduce((a, x) => a + x.share, 0)).toBeCloseTo(1, 5);
  });
  it('AI는 내 나라보다 훨씬 셈(한국도 AI면 1.5배)', () => {
    expect(aiStrength('us', 'kr')).toBeGreaterThan(2);
    expect(aiStrength('kr', 'jp')).toBe(1.5);
    expect(aiStrength('kr', 'kr')).toBe(1);
  });
  it('세계가 흐르면 패권 전쟁·제재·약탈 계약·연합이 생기고 망가지지 않음', () => {
    let s = newGame('t', 'kr', 0, { seed: 7, realWorld: true });
    s = advance(s, 4 * 24 * H);
    const st = hegOf(s).stats!;
    expect(st.sanctions + st.squeezes).toBeGreaterThan(0);
    expect(st.wars + st.allies + st.helps).toBeGreaterThan(0);
    for (const id of Object.keys(s.nations)) {
      expect(Number.isFinite(budgetPerDay(s, id))).toBe(true);
      expect(s.nations[id].troops).toBeGreaterThanOrEqual(0);
    }
  }, 60000);
  it('강대국 요구: 받으면 예산이 줄고, 거절하면 제재', () => {
    let s = newGame('t', 'kr', 0, { seed: 3 });
    s = { ...s, hegemony: { ...hegOf(s), asks: [{ id: 1, kind: 'squeeze', from: 'cn', res: '희토류', drain: 0.15, untilMs: s.worldMs + 8 * H }], nextId: 2 } };
    const before = hegemonyMult(s, 'kr');
    const acc = answerSqueeze(s, 1, true).state;
    expect(hegemonyMult(acc, 'kr')).toBeCloseTo(before * 0.85, 5);
    expect(hegemonyMult(acc, 'cn')).toBeGreaterThan(1);
    const ref = answerSqueeze(s, 1, false).state;
    expect(hegOf(ref).sanctions.some((x) => x.from === 'cn' && x.to === 'kr')).toBe(true);
    expect(openAsks(ref).length).toBe(0);
  });
  it('도움 요청에 병력을 보내면 우리 병력이 줄고 상대가 늘어남', () => {
    let s = war(newGame('t', 'kr', 0, { seed: 4 }), 'jp', 'cn');
    s = { ...s, hegemony: { ...hegOf(s), asks: [{ id: 1, kind: 'help', from: 'jp', enemy: 'cn', untilMs: s.worldMs + 8 * H }], nextId: 2 } };
    const r = answerHelp(s, 1, 'troops').state;
    expect(r.nations.kr.troops).toBeLessThan(s.nations.kr.troops);
    expect(r.nations.jp.troops).toBeGreaterThan(s.nations.jp.troops);
  });
  it('우리도 전쟁 중이면 도움을 청할 수 있음(같은 나라는 잠깐 쉬었다가)', () => {
    const s = war(newGame('t', 'kr', 0, { seed: 5 }), 'kr', 'kp');
    expect(canAskHelp(s, 'jp')).toBeNull();
    const r = askHelp(s, 'jp');
    expect(r.text).not.toBe('');
    expect(canAskHelp(r.state, 'jp')).toMatch(/다시/);
  });
  it('연합이 새로 맺어짐(같은 적과 싸우는 나라끼리)', () => {
    let s = newGame('t', 'kr', 0, { seed: 9 });
    s = war(war(s, 'in', 'cn'), 'tw', 'cn');
    for (let i = 0; i < 8000 && relationOf(s.world, 'in', 'tw') !== '연합'; i++) s = step(s);
    expect(relationOf(s.world, 'in', 'tw')).toBe('연합');
  });
});

describe('항복 요구 대기 없음(11-27)', () => {
  it('거절당해도 바로 다시 요구 가능, 대신 확률이 조금 줄어듦', () => {
    let s = war(newGame('t', 'kr', 0, { seed: 4 }), 'kr', 'kp');
    for (let i = 0; i < 30 && !lordOf(s, 'kp'); i++) {
      const c0 = demandChance(s, 'kp');
      const r = doDemand(s, 'kp').state;
      if (lordOf(r, 'kp')) break;
      expect(canDemand(r, 'kp')).toBeNull();
      expect(demandChance(r, 'kp')).toBeLessThanOrEqual(c0);
      s = r;
    }
  });
});
