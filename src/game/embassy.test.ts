// 11-28 대사관
import { describe, expect, test } from 'vitest';
import { newGame, type GameState } from './state';
const rich = (s: GameState): GameState => ({ ...s, nations: { ...s.nations, kr: { ...s.nations.kr, treasury: 1e7 } } });
import { canOpenEmbassy, embassyFavor, embassySlots, openEmbassy } from './embassy';
import { favorOf } from './civ';
import { tradePartners } from './economy';

describe('대사관', () => {
  test('대사를 보내면 호감이 오르고 날마다 커짐(최대 12)', () => {
    let s = rich(newGame('t', 'kr', 0, { seed: 4, realWorld: true }));
    const id = tradePartners(s)[0];
    const f0 = favorOf(s, id);
    expect(canOpenEmbassy(s, id)).toBeNull();
    s = openEmbassy(s, id);
    expect(favorOf(s, id)).toBeGreaterThan(f0);
    const later = { ...s, worldMs: s.worldMs + 10 * 24 * 3600e3 };
    expect(embassyFavor(later, id)).toBe(12);
    expect(canOpenEmbassy(s, id)).toBeTruthy();
  });
  test('칸 수 한도', () => {
    let s = rich(newGame('t', 'kr', 0, { seed: 4, realWorld: true }));
    for (const id of tradePartners(s).slice(0, embassySlots(s))) s = openEmbassy(s, id);
    expect(canOpenEmbassy(s, tradePartners(s)[embassySlots(s)])).toBeTruthy();
  });
});
