import { describe, expect, it } from 'vitest';
import {
  AH, CHP, MAG, NN, RL, SHIPS, addPoint, aiShoot, allSunk, coverScore, detectRate, fly, huntFire, huntMove, huntPing, huntScore, navalScore, navalShoot, newCover, newHunt, newNaval, newRun, newStealth, pathReady, runScore, shootCover, stealthScore, stepCover, stepHunt, stepRun, stepStealth,
} from './fullB';

describe('11-28 시가전 엄폐 사격', () => {
  it('일어서 있으면 맞고, 숨어 있으면 안 맞고 탄창이 참', () => {
    const s = newCover(4);
    for (let i = 0; i < 60 * 8; i++) stepCover(s, 1 / 60, true);
    expect(s.hp).toBeLessThan(CHP);
    const t = newCover(4);
    t.ammo = 0;
    for (let i = 0; i < 60 * 8; i++) stepCover(t, 1 / 60, false);
    expect(t.hp).toBe(CHP);
    expect(t.ammo).toBe(MAG);
  });
  it('적을 쏘면 점수, 민간인은 감점, 숨어서는 못 쏨', () => {
    const s = newCover(4);
    s.up = true;
    s.foes.push({ x: 300, y: 300, aim: 2, aimMax: 2, alive: true, civ: false, life: 0, spot: 0 }, { x: 900, y: 300, aim: 2, aimMax: 2, alive: true, civ: true, life: 3, spot: 1 });
    expect(shootCover(s, 305, 298)).toBe('foe');
    expect(shootCover(s, 900, 300)).toBe('civ');
    expect(shootCover(s, 10, 10)).toBe('miss');
    s.up = false;
    expect(shootCover(s, 10, 10)).toBeNull();
    expect(s.kills).toBe(1);
    expect(coverScore(s)).toBeGreaterThan(0);
  });
});

describe('11-28 함대 포격전', () => {
  it('배 5척이 겹치지 않게 놓이고, 다 쏘면 이김', () => {
    const n = newNaval(12);
    const cells = n.foe.ships.flatMap((s) => s.cells.map((c) => c.join()));
    expect(new Set(cells).size).toBe(SHIPS.reduce((a, b) => a + b, 0));
    for (const s of n.foe.ships) for (const [r, c] of s.cells) {
      n.turn = 'me';
      navalShoot(n, r, c);
    }
    expect(allSunk(n.foe)).toBe(true);
    expect(n.over).toBe('win');
    expect(navalScore(n)).toBeGreaterThan(0.9);
  });
  it('빗나가면 적 차례, 적은 끝까지 쏘면 이김', () => {
    const n = newNaval(5);
    let miss: [number, number] | null = null;
    for (let r = 0; r < NN && !miss; r++) for (let c = 0; c < NN && !miss; c++) if (!n.foe.ships.some((s) => s.cells.some(([a, b]) => a === r && b === c))) miss = [r, c];
    expect(navalShoot(n, miss![0], miss![1])).toBe('miss');
    expect(n.turn).toBe('foe');
    for (let i = 0; i < 200 && !n.over; i++) {
      if (n.turn === 'me') n.turn = 'foe';
      aiShoot(n);
    }
    expect(n.over).toBe('lose');
  });
});

describe('11-28 어둠 속 사냥', () => {
  it('핑을 치면 적이 보이고 알아챔, 어뢰로 맞히면 잡음', () => {
    const s = newHunt(3);
    expect(huntPing(s)).toBe(true);
    expect(huntPing(s)).toBe(false);
    expect(s.contacts.length).toBeGreaterThan(0);
    expect(s.foes.some((f) => f.alert > 0)).toBe(true);
    const f = s.foes[0];
    huntFire(s, f.x, f.y);
    for (let i = 0; i < 60 * 6 && f.alive; i++) {
      f.x = s.torps.find((t) => t.mine)?.x ?? f.x;
      f.y = s.torps.find((t) => t.mine)?.y ?? f.y;
      stepHunt(s, 1 / 60);
    }
    expect(s.kills).toBe(1);
    huntMove(s, 500, 500);
    stepHunt(s, 1);
    expect(s.me.x).toBeGreaterThan(180);
    expect(huntScore(s)).toBeGreaterThan(0.2);
  });
});

describe('11-28 자폭 보트 돌격', () => {
  it('장애물 없이 달리면 끝에 닿고, 구축함 띠 안이면 성공', () => {
    const s = newRun(8);
    s.obs = [];
    s.ty = s.ship.y;
    for (let i = 0; i < 60 * 40 && !s.done; i++) {
      stepRun(s, 1 / 60);
      s.fuel = 100;
    }
    expect(s.x).toBeGreaterThanOrEqual(RL - 160);
    expect(s.win).toBe(true);
    expect(runScore(s)).toBeGreaterThan(0.9);
  });
  it('기뢰에 부딪히면 선체가 깎이고 연료가 떨어지면 끝', () => {
    const s = newRun(8);
    s.obs = [{ x: 200, y: s.y, k: 'mine', vy: 0, cool: 0, gone: false }];
    for (let i = 0; i < 60; i++) stepRun(s, 1 / 60);
    expect(s.hp).toBe(2);
    s.fuel = 0.01;
    stepRun(s, 0.1);
    expect(s.done).toBe(true);
    expect(s.win).toBe(false);
  });
});

describe('11-28 스텔스 침투', () => {
  it('출발점에서 표적까지 그려야 출격, 레이더 없으면 성공', () => {
    const s = newStealth(6);
    const ms = s.missions[0];
    expect(addPoint(s, { x: 800, y: 400 })).toBe(false);
    ms.radars = [];
    for (let k = 0; k <= 40; k++) addPoint(s, { x: ms.start.x + ((ms.target.x - ms.start.x) * k) / 40, y: ms.start.y + ((ms.target.y - ms.start.y) * k) / 40 });
    expect(pathReady(s)).toBe(true);
    expect(fly(s)).toBe(true);
    for (let i = 0; i < 60 * 20 && s.m === 0; i++) stepStealth(s, 1 / 60);
    expect(s.res[0]).toBe('ok');
    expect(stealthScore(s)).toBeGreaterThan(0.3);
  });
  it('레이더 빛줄기 안은 탐지, 골짜기 위는 덜 잡힘', () => {
    const s = newStealth(6);
    const ms = s.missions[0];
    ms.radars = [{ x: 500, y: 450, r: 200, a0: 0, spd: 0 }];
    ms.valleys = [];
    expect(detectRate(ms, { x: 600, y: 450 }, 0)).toBeGreaterThan(2);
    expect(detectRate(ms, { x: 500, y: 600 }, 0)).toBe(0);
    ms.valleys = [{ x: 600, y: 450, r: 50 }];
    expect(detectRate(ms, { x: 600, y: 450 }, 0)).toBeLessThan(1);
    expect(AH).toBe(900);
  });
});
