import { describe, expect, it } from 'vitest';
import { newGame, type GameState } from './state';
import { cabinetOf, minLevel, ministryPower } from './cabinet';
import { canUpMinistry, cabinetTick, minUpCost, startTask, taskHours, upMinistry } from './cabinetOps';
import { useBoost } from './boost';
import { MIN_LV_POWER } from '../data/ministryGrowth';

const H = 3600e3;
const rich = (s: GameState): GameState => ({ ...s, nations: { ...s.nations, kr: { ...s.nations.kr, treasury: 1e9 } } });
const at = (s: GameState, ms: number): GameState => ({ ...s, worldMs: ms });

/** 국방부에 내 사람 한 명을 장관으로 바로 앉힘(시험용) */
function withMinister(s: GameState): GameState {
  const c = structuredClone(cabinetOf(s));
  for (const x of c.people) if (x.seat?.kind === 'min' && x.seat.id === 'mnd') x.seat = null;
  const p = c.people.find((x) => !x.seat && !x.post && x.country === 'kr')!;
  p.group = '내각';
  p.seat = { kind: 'min', id: 'mnd' };
  return { ...s, cabinet: c };
}

describe('부처 청사 단계별 성장', () => {
  it('처음엔 1단계, 장관·업무가 있어야 키움', () => {
    let s = rich(newGame('t', 'kr', 0, { seed: 7 }));
    expect(minLevel(s.cabinet, 'mnd')).toBe(1);
    expect(canUpMinistry(s, 'mnd')).toMatch(/장관|업무/);
    s = withMinister(s);
    expect(canUpMinistry(s, 'mnd')).toMatch(/업무 0 \/ 1/);
    s = startTask(s, 'mnd', 'drill');
    s = cabinetTick(at(s, s.worldMs + 10 * H), H);
    expect(canUpMinistry(s, 'mnd')).toBeNull();
  });

  it('공사 → 시간이 지나면 2단계, 부처 힘이 커짐 · 가속 가능', () => {
    let s = withMinister(rich(newGame('t', 'kr', 0, { seed: 8 })));
    s = cabinetTick(at(startTask(s, 'mnd', 'drill'), s.worldMs + 10 * H), H);
    const before = ministryPower(s, 'mnd');
    const money = s.nations.kr.treasury;
    const k = minUpCost(s, 'mnd');
    s = upMinistry(s, 'mnd');
    expect(s.nations.kr.treasury).toBe(money - k.money);
    expect(canUpMinistry(s, 'mnd')).toMatch(/공사/);
    s = { ...s, officer: { ...s.officer, boosts: 100 } };
    s = useBoost(s, { kind: 'minUp', min: 'mnd' }, 100);
    s = cabinetTick(s, 60e3);
    expect(minLevel(s.cabinet, 'mnd')).toBe(2);
    expect(ministryPower(s, 'mnd')).toBeCloseTo((before / MIN_LV_POWER[1]) * MIN_LV_POWER[2], 5);
  });

  it('3단계부터 업무 시간 −15%, 5단계가 끝', () => {
    let s = withMinister(rich(newGame('t', 'kr', 0, { seed: 9 })));
    const h1 = taskHours(s, 'mnd', 'drill');
    s = { ...s, cabinet: { ...cabinetOf(s), minLv: { mnd: 3 } } };
    expect(taskHours(s, 'mnd', 'drill')).toBeCloseTo(h1 * 0.85, 5);
    s = { ...s, cabinet: { ...cabinetOf(s), minLv: { mnd: 5 } } };
    expect(canUpMinistry(s, 'mnd')).toMatch(/최고/);
  });
});
