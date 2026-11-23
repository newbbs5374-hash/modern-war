import { describe, expect, it } from 'vitest';
import { advance, newGame } from './state';
import { canAct, doAct, scheduleOf, DAY_MS } from './schedule';
import { fieldValue } from './approval';

describe('대통령 일정', () => {
  it('하루 3칸, 같은 활동 한 번, 다음 날 비워짐, 분야 점수 덤', () => {
    let s = newGame('t', 'kr', 0, { seed: 9 });
    const d0 = fieldValue(s, 'defense');
    s = doAct(s, 'troops').state;
    expect(fieldValue(s, 'defense')).toBeGreaterThan(d0);
    expect(canAct(s, 'troops')).not.toBeNull();
    s = doAct(s, 'call').state;
    s = doAct(s, 'assembly').state;
    expect(scheduleOf(s).slots.every(Boolean)).toBe(true);
    expect(canAct(s, 'rest')).not.toBeNull();
    s = advance(s, DAY_MS);
    expect(scheduleOf(s).slots.every((x) => !x)).toBe(true);
    expect(scheduleOf(s).total).toBe(3);
    expect(doAct(s, 'visit').text).toContain('현장 방문');
  });
});
