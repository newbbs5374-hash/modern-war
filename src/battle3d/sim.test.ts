import { describe, expect, it } from 'vitest';
import { deployTiles } from './field';
import { COAST } from './fields/coast';
import { createSim, defaultPicks, picksCost, runToEnd, tileOk, type Sim } from './sim';
import type { CmdKind } from './units';
import baseJson from './fixtures/v54-default.json';
import withCmds from './fixtures/v54-commands.json';

type Cmd = { t: number; k: string; x: number; z: number };
type Fixture = typeof withCmds;
const base = baseJson as unknown as Fixture;

/** 명령 목록대로 끝까지 돌림(명령은 그 시각이 된 계산 직전에 넣음 — 시험판 화면과 같은 순서) */
function play(cmds: Cmd[]): Sim {
  const sim = createSim(COAST, defaultPicks(COAST));
  sim.start();
  const todo = cmds.map((c) => ({ ...c, done: false }));
  for (let n = 0; n < 5000 && !sim.over; n++) {
    for (const c of todo) {
      if (!c.done && sim.t >= c.t - 1e-9) {
        c.done = true;
        expect(sim.command(c.k as CmdKind, c.x, c.z)).toBe(true);
      }
    }
    sim.step();
  }
  return sim;
}

/** 시험판 원본과 유닛 하나하나까지 같은지 */
function sameAsOriginal(sim: Sim, fx: Fixture) {
  expect(sim.over?.win).toBe(fx.win);
  expect(sim.t.toFixed(2)).toBe(fx.t.toFixed(2));
  const mine = sim.units.map((u) => [u.id, u.side, u.kind, u.alive, +u.hp.toFixed(6), +u.x.toFixed(6), +u.z.toFixed(6)]);
  expect(mine).toEqual(fx.units);
  const logs = sim.logs.filter((l) => l.msg !== '작전 개시 · 육해공 동시 진격').map((l) => [+l.t.toFixed(2), l.msg]);
  expect(logs).toEqual(fx.logs);
}

describe('3D 메인 전투 계산기(철벽 작전 v5.4에서 옮김)', () => {
  it('배치 칸과 기본 배치가 시험판과 같음(칸 36개, 예산 안에서 20부대)', () => {
    const tiles = deployTiles(COAST);
    expect(tiles.length).toBe(36);
    const picks = defaultPicks(COAST);
    expect(picks.map((p) => [p.kind, p.tile])).toEqual(base.deploy);
    expect(picksCost(picks)).toBeLessThanOrEqual(COAST.budget);
    for (const p of picks) expect(tileOk(tiles[p.tile], p.kind)).toBe(true);
  });

  it('기본 배치 · 명령 없음 → 171.6초에 승리(시험판과 유닛 상태까지 똑같음)', () => {
    const sim = play([]);
    expect(sim.over).toEqual({ win: true, timeout: false, t: sim.t });
    expect(sim.t).toBeCloseTo(171.6, 6);
    sameAsOriginal(sim, base);
  });

  it('명령 7종을 쓴 판도 시험판과 똑같음(119.7초 승리)', () => {
    const sim = play(withCmds.cmds);
    sameAsOriginal(sim, withCmds);
  });

  it('자동 끝내기(runToEnd)도 같은 결과', () => {
    const r = runToEnd(createSim(COAST, defaultPicks(COAST)));
    expect(r?.win).toBe(true);
    expect(r?.t).toBeCloseTo(171.6, 6);
  });

  it('지휘력이 모자라거나 바다에 공수 투입이면 명령 거절', () => {
    const sim = createSim(COAST, defaultPicks(COAST));
    sim.start();
    expect(sim.command('cruise', 4, -8)).toBe(false); // 시작 지휘력 3 < 7
    sim.cp = 10;
    expect(sim.command('para', -8, 0)).toBe(false); // 바다
    expect(sim.command('para', 5, -4)).toBe(true);
  });
});
