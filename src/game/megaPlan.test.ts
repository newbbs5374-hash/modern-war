import { describe, expect, it } from 'vitest';
import { newGame, type GameState } from './state';
import { domEff } from './domestic';
import { MEGAS, MEGA_DAYS, MEGA_STAGES, canMega, megaCost, megaDoneAll, megaLv, megaTick, megaTotal, startMega } from './megaPlan';

const DAY = 24 * 3600e3;
const rich = (s: GameState): GameState => ({ ...s, nations: { ...s.nations, kr: { ...s.nations.kr, treasury: 1e9 } } });

describe('국가 대계획', () => {
  it('한 번에 한 단계, 끝나면 영구 효과와 명성', () => {
    let s = rich(newGame('t', 'kr', 0, { seed: 3 }));
    const base = domEff(s, 'research');
    const fame = s.officer.fame;
    const money = s.nations.kr.treasury;
    const cost = megaCost(s, 'space');
    s = startMega(s, 'space');
    expect(s.nations.kr.treasury).toBe(money - cost);
    expect(canMega(s, 'tunnel')).not.toBeNull();
    expect(megaTick(s)).toBe(s);
    s = megaTick({ ...s, worldMs: s.worldMs + MEGA_DAYS[0] * DAY });
    expect(megaLv(s, 'space')).toBe(1);
    expect(s.officer.fame).toBeGreaterThan(fame);
    expect(domEff(s, 'research')).toBeGreaterThanOrEqual(base + 0.03 - 1e-9);
    expect(megaCost(s, 'space')).toBeGreaterThan(cost);
  });
  it('세 가지를 모두 끝내면 과학 승리 조건', () => {
    let s = rich(newGame('t', 'kr', 0, { seed: 3 }));
    for (const d of MEGAS) for (let i = 0; i < MEGA_STAGES; i++) {
      s = startMega(s, d.id);
      s = megaTick({ ...s, worldMs: s.worldMs + 4 * DAY });
    }
    expect(megaTotal(s)).toBe(12);
    expect(megaDoneAll(s)).toBe(true);
    expect(canMega(s, 'space')).toBe('이미 완성했어요');
  });
});
