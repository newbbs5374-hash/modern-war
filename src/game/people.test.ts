import { describe, expect, it } from 'vitest';
import { favorOf } from './civ';
import { debugAddAide } from './officer';
import { canAct, doAct, personExists } from './people';
import { advance, newGame } from './state';
import { relationOf } from './world';

const H = 3600e3;

describe('인물 창 교류', () => {
  it('연설: 명성·신뢰가 오르고 하루 한 번만', () => {
    let s = newGame('t', 'kr', 0, { seed: 3 });
    s = { ...s, player: { ...s.player, salary: 10000 } };
    const fame = s.officer.fame;
    const r = doAct(s, { kind: 'player' }, 'speech');
    expect(r.state.officer.fame).toBeGreaterThan(fame);
    expect(r.state.player.salary).toBeLessThan(10000);
    expect(canAct(r.state, { kind: 'player' }, 'speech')).toMatch('오늘');
    expect(canAct(advance(r.state, 24 * H), { kind: 'player' }, 'speech')).toBeNull();
  });

  it('부관 대화: 인연 +3', () => {
    const s = debugAddAide(newGame('t', 'kr', 0, { seed: 4 }));
    const a = s.officer.aides[0];
    const r = doAct(s, { kind: 'aide', id: a.id }, 'chat');
    expect(r.state.officer.aides[0].bond).toBe(Math.min(100, a.bond + 3));
    expect(r.out).toContain(a.name);
  });

  it('지도자 선물: 호감 +8, 전쟁 중이면 못 함, 우리 나라는 못 함', () => {
    let s = newGame('t', 'kr', 0, { seed: 5 });
    s = { ...s, player: { ...s.player, salary: 100000 } };
    const other = Object.keys(s.nations).find((id) => id !== 'kr' && relationOf(s.world, 'kr', id) !== '전쟁')!;
    const before = favorOf(s, other);
    const r = doAct(s, { kind: 'leader', country: other }, 'gift');
    expect(favorOf(r.state, other)).toBe(Math.min(100, before + 8));
    expect(canAct(s, { kind: 'leader', country: 'kr' }, 'gift')).toBeTruthy();
  });

  it('없는 부관은 창을 열 수 없음', () => {
    const s = newGame('t', 'kr', 0, { seed: 6 });
    expect(personExists(s, { kind: 'aide', id: 9999 })).toBe(false);
    expect(canAct(s, { kind: 'aide', id: 9999 }, 'chat')).toBeTruthy();
  });
});
