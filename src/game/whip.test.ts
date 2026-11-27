import { describe, expect, it } from 'vitest';
import { newGame, type GameState } from './state';
import { assemblyOf, billChance, submitBill } from './assembly';
import { BLOCS, DEBT_HARD, MAJORITY, WHIP_MAX, blocSeats, canWhip, firstStances, liveDebts, payDebt, whip, whipChance, whipOf, yesSeats } from './whip';

const rich = (s: GameState): GameState => ({ ...s, nations: { ...s.nations, kr: { ...s.nations.kr, treasury: 1e7 } } });

describe('법안 표 대결', () => {
  const s0 = rich(newGame('t', 'kr', 0, { seed: 11 }));
  const bill = assemblyOf(s0).offer[0];
  it('의석은 모두 300, 첫 태도는 확률에 따라', () => {
    expect(blocSeats(s0).reduce((a, b) => a + b, 0)).toBe(300);
    expect(BLOCS.length).toBe(5);
    expect(firstStances(0.9)[2]).toBe('yes');
    expect(firstStances(0.3)[1]).toBe('maybe');
    expect(firstStances(0.3)[4]).toBe('no');
  });
  it('설득하면 표가 늘고 확률이 오른다, 3번까지', () => {
    let s = submitBill(s0, bill);
    const w0 = whipOf(s)!;
    const c0 = assemblyOf(s).vote!.chance;
    const targets = w0.st.map((x, i) => (x !== 'yes' ? i : -1)).filter((i) => i >= 0);
    let used = 0;
    for (const i of targets) {
      while (whipOf(s)!.st[i] !== 'yes' && used < WHIP_MAX) {
        s = whip(s, i, 'pay').state;
        used++;
      }
    }
    const w = whipOf(s)!;
    expect(w.used).toBe(used);
    expect(yesSeats(s, w.st)).toBeGreaterThan(w0.first);
    expect(assemblyOf(s).vote!.chance).toBeGreaterThan(c0);
    if (yesSeats(s, w.st) >= MAJORITY) expect(whipChance(s, w)).toBeGreaterThanOrEqual(0.9);
    if (used >= WHIP_MAX) expect(canWhip(s, 4, 'pay')).not.toBeNull();
  });
  it('약속은 빚이 남아 다음 법안이 어려워진다, 갚으면 없어진다', () => {
    let s = submitBill(s0, bill);
    const i = whipOf(s)!.st.findIndex((x) => x === 'maybe');
    expect(i).toBeGreaterThan(0);
    const before = billChance(s, bill);
    s = whip(s, i, 'promise').state;
    expect(whipOf(s)!.st[i]).toBe('yes');
    expect(liveDebts(s)).toBe(1);
    expect(billChance(s, bill)).toBeCloseTo(Math.max(0.1, before - DEBT_HARD), 5);
    s = payDebt(s);
    expect(liveDebts(s)).toBe(0);
    // 반대하는 쪽은 약속을 안 믿음
    const no = whipOf(s)!.st.findIndex((x) => x === 'no');
    if (no >= 0) expect(canWhip(s, no, 'promise')).not.toBeNull();
  });
});
