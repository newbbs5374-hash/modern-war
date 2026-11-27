// 11-28 스타 해외 진출
import { describe, expect, test } from 'vitest';
import { newGame, type GameState } from './state';
import { canSendAbroad, cultureOf, sendAbroad, spreadMult } from './culture';
import { tradePartners } from './economy';

describe('스타 해외 진출', () => {
  test('보낸 나라에 문화가 더 퍼지고, 그동안 걸작은 못 만듦', () => {
    let s: GameState = newGame('t', 'kr', 0, { seed: 6, realWorld: true });
    s = { ...s, nations: { ...s.nations, kr: { ...s.nations.kr, treasury: 1e7 } } };
    const c = cultureOf(s);
    s = { ...s, culture: { ...c, stars: [{ id: 1, kind: 'idol' as never, name: '테스트', made: 0 }] } };
    const to = tradePartners(s)[0];
    const m0 = spreadMult(s, to);
    expect(canSendAbroad(s, 1, to)).toBeNull();
    s = sendAbroad(s, 1, to);
    expect(spreadMult(s, to)).toBeGreaterThan(m0);
    expect(canSendAbroad(s, 1, to)).toBeTruthy();
  });
});
