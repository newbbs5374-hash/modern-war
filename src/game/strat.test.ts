import { describe, expect, it } from 'vitest';
import { advance, newGame, type GameState } from './state';
import { canLaunch, canStep, launch, startStep, stratOf, targetCities } from './strat';
import { deterMul, icbmOf } from './world';
import { favorOf } from './civ';

const H = 3600e3;
const rich = (s: GameState): GameState => ({ ...s, nations: { ...s.nations, [s.player.countryId]: { ...s.nations[s.player.countryId], treasury: 1e9 } } });
const go = (s: GameState, id: Parameters<typeof startStep>[1], h: number) => advance(startStep(rich(s), id).state, h * H);

describe('전략군 사령부(ICBM)', () => {
  it('한국은 처음엔 없고, 미국은 처음부터 5기·핵탄두', () => {
    const kr = newGame('t', 'kr', 0, { seed: 1 });
    expect(stratOf(kr).deployed).toBe(0);
    expect(icbmOf(kr.world, 'kr')).toBe(0);
    const us = newGame('t', 'us', 0, { seed: 1 });
    expect(stratOf(us).deployed).toBe(5);
    expect(stratOf(us).nuke).toBe(true);
  });

  it('연구 → 엔진 → 시험 발사 2번 → 배치 → 억지력', () => {
    let s = rich(newGame('t', 'kr', 0, { seed: 2 }));
    expect(canStep(s, 'build')).toMatch(/시험/);
    s = go(s, 'research', 30.5);
    expect(stratOf(s).stage).toBe(1);
    s = go(s, 'engine', 24.5);
    s = go(s, 'test', 6.5);
    s = go(s, 'test', 6.5);
    expect(stratOf(s).stage).toBe(3);
    expect(stratOf(s).clips?.map((c) => c.key)).toEqual(['test', 'test']);
    s = go(s, 'build', 24.5);
    expect(stratOf(s).clips?.at(-1)?.key).toBe('deploy');
    expect(stratOf(s).deployed).toBe(1);
    expect(icbmOf(s.world, 'kr')).toBe(1);
    expect(deterMul(s.world, 'kr', 'jp')).toBeLessThan(1);
  });

  it('재래식 발사는 도시 방어를 깎고, 핵은 모든 나라 호감을 크게 깎음', () => {
    let s = rich(newGame('t', 'us', 0, { seed: 3 }));
    const city = targetCities(s).find((id) => s.world.owner[id] === 'kp')!;
    expect(canLaunch(s, city, 'conv')).toBeNull();
    const before = s.world.defense[city];
    s = launch(s, city, 'conv').state;
    expect(stratOf(s).clips?.[0].key).toBe('launch');
    s = advance(s, 0.6 * H);
    expect(['hit', 'intercept']).toContain(stratOf(s).clips?.at(-1)?.key);
    expect(stratOf(s).deployed).toBe(4);
    expect(s.world.defense[city] <= before).toBe(true);
    const fr = favorOf(s, 'de');
    const city2 = targetCities(s).find((id) => s.world.owner[id] === 'ir')!;
    expect(canLaunch(s, city2, 'nuke')).toBeNull();
    s = launch(s, city2, 'nuke').state;
    s = advance(s, 0.6 * H);
    expect(stratOf(s).nukesUsed).toBe(1);
    expect(favorOf(s, 'de')).toBeLessThan(fr - 30);
  });
});
