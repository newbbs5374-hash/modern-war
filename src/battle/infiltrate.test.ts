import { describe, expect, it } from 'vitest';
import { FLOOR, PH, guardSees, infiltrateScore, newInfiltrate, stepInfiltrate } from './infiltrate';

describe('11-28 침투 작전', () => {
  it('달리면 앞으로 가고 점프하면 뜸', () => {
    const s = newInfiltrate(3);
    const x = s.px;
    for (let i = 0; i < 20; i++) stepInfiltrate(s, { left: false, right: true, jump: i === 0, low: false }, 1 / 60);
    expect(s.px).toBeGreaterThan(x);
    expect(s.py).toBeLessThan(FLOOR - PH);
  });
  it('경비병 앞에 서면 보이고, 그림자에서 숙이면 안 보임', () => {
    const s = newInfiltrate(3);
    const g = { x: 500, a: 400, b: 600, dir: 1 as const, v: 0, wait: 0, y: FLOOR };
    s.px = 600;
    s.py = FLOOR - PH;
    expect(guardSees(s, g)).toBe(true);
    s.shadows.push([550, 700]);
    s.low = true;
    expect(guardSees(s, g)).toBe(false);
  });
  it('구덩이에 빠지면 목숨을 잃고, 끝까지 가면 높은 점수', () => {
    const s = newInfiltrate(3);
    s.pits = [[100, 400]];
    s.solids = [];
    s.guards = [];
    s.cams = [];
    for (let i = 0; i < 90; i++) stepInfiltrate(s, { left: false, right: true, jump: false, low: false }, 1 / 60);
    expect(s.lives).toBeLessThan(3);
    s.pits = [];
    for (let i = 0; i < 60 * 30 && !s.done; i++) stepInfiltrate(s, { left: false, right: true, jump: false, low: false }, 1 / 60);
    expect(s.done).toBe(true);
    expect(infiltrateScore(s)).toBeGreaterThan(0.6);
  });
});
