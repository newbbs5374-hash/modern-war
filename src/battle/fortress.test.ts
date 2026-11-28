import { describe, expect, it } from 'vitest';
import { FW, aiAim, camFit, fire, flyPath, fortressScore, moveTank, newFortress, nextTurn } from './fortress';
import { minisFor } from './minigames';

describe('11-28 포격전', () => {
  it('땅·전차가 만들어지고 포탄이 날아감', () => {
    const b = newFortress(5);
    expect(b.me.x).toBeLessThan(b.foe.x);
    const { pts, hit } = flyPath(b, b.me, 45, 600, 0);
    expect(pts.length).toBeGreaterThan(10);
    expect(hit).toBeTruthy();
  });
  it('아주 높이 쏴도 포탄은 끝까지 계산되고, 화면은 그만큼 넓어짐', () => {
    const b = newFortress(5);
    const { pts } = flyPath(b, b.me, 85, 900, 0);
    const minY = Math.min(...pts.map((p) => p[1]));
    expect(minY).toBeLessThan(0);
    const cam = camFit(pts, 9 / 16);
    expect(cam.y).toBeLessThanOrEqual(minY);
  });
  it('AI는 점점 정확해지고, 맞히면 피해·땅 패임', () => {
    const b = newFortress(9, 1.5);
    let dealt = 0;
    for (let i = 0; i < 8 && !b.over; i++) {
      const a = aiAim(b, 1.5);
      b.foe.angle = a.angle;
      b.foe.power = a.power;
      dealt += fire(b, 'foe').dmgMe;
      nextTurn(b);
      nextTurn(b);
    }
    expect(dealt).toBeGreaterThan(0);
  });
  it('이동은 연료만큼', () => {
    const b = newFortress(3);
    const x = b.me.x;
    moveTank(b, 'me', 1000);
    expect(b.me.x - x).toBeLessThanOrEqual(160);
    expect(b.me.x).toBeLessThan(FW);
  });
  it('이기면 0.6 넘는 점수, 훈련 목록에 나옴', () => {
    const b = newFortress(3);
    b.foe.hp = 0;
    nextTurn(b);
    expect(b.over).toBe('win');
    expect(fortressScore(b)).toBeGreaterThan(0.6);
    expect(minisFor('포격').some((m) => m.id === 'g-fortress')).toBe(true);
  });
});
