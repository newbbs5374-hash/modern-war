import { describe, expect, test } from 'vitest';
import { attack, createGridBattle, endTurn, finishGrid, moveUnit, reachable, type Goal } from './grid';
import { createSideBattle, finishSide, stepSide } from './side';
import { createArty, finishArty, fire } from './arty';
import { createShooter, finishShooter, stepShooter } from './shooter';
import { createPuzzle, finishPuzzle, guessCode, score, type CodePuzzle } from './puzzle';
import { hitChance, typeMult } from './calc';
import { battleOf } from './spec';

const stats = { 체력: 12, 사격: 12, 은밀: 12, 통솔: 12, 전술: 12, 포격: 12, 군수: 12, 정치: 12, 정보: 12 };

describe('공통 계산기', () => {
  test('엄폐·거리가 명중을 깎고, 상성이 맞음', () => {
    expect(hitChance('소총', 0.3, 1)).toBeLessThan(hitChance('소총', 0, 1));
    expect(hitChance('소총', 0, 4)).toBeLessThan(hitChance('소총', 0, 1));
    expect(typeMult('전차', '소총')).toBeGreaterThan(1);
    expect(typeMult('소총', '전차')).toBeLessThan(1);
  });
});

describe('① 격자 턴제', () => {
  test('모든 목표가 즉시완료로 끝나고, 같은 씨앗이면 같은 결과', () => {
    for (const goal of ['survive', 'eliminate', 'rescue', 'reach'] as Goal[]) {
      const setup = { goal, difficulty: 1, rank: 0, stats, aides: [], seed: 42 };
      const a = finishGrid(createGridBattle(setup));
      const b = finishGrid(createGridBattle(setup));
      expect(a.result).not.toBeNull();
      expect(a.result).toEqual(b.result);
      expect(a.turn).toBe(b.turn);
    }
  });
  test('움직이고 쏘면 한 번만 행동, 턴 끝이면 적 차례 뒤 다시 내 차례', () => {
    let b = createGridBattle({ goal: 'eliminate', difficulty: 1, rank: 0, stats, aides: [], seed: 7 });
    const u = b.units.find((x) => x.side === 'me')!;
    const [j] = [...reachable(b, u).keys()].filter((k) => k !== u.y * b.w + u.x);
    b = moveUnit(b, u.id, j % b.w, Math.floor(j / b.w));
    expect(b.units.find((x) => x.id === u.id)!.moved).toBe(true);
    expect(moveUnit(b, u.id, u.x, u.y)).toBe(b); // 두 번은 못 움직임
    const foe = b.units.find((x) => x.side === 'foe')!;
    expect(attack(b, u.id, foe.id)).toBe(b); // 안 보이거나 멀면 못 쏨
    const frames = endTurn(b);
    const last = frames[frames.length - 1];
    if (!last.result) {
      expect(last.side).toBe('me');
      expect(last.turn).toBe(2);
    }
  });
  test('스탯·계급이 높으면 자동전투 승률이 오름', () => {
    const rate = (v: number, rank: number) => {
      let w = 0;
      for (let i = 0; i < 40; i++) {
        const s = Object.fromEntries(Object.keys(stats).map((k) => [k, v]));
        if (finishGrid(createGridBattle({ goal: 'eliminate', difficulty: 1, rank, stats: s, aides: [], seed: i * 13 + 1 })).result!.win) w++;
      }
      return w;
    };
    expect(rate(20, 0)).toBeGreaterThanOrEqual(rate(5, 0));
  });
});

describe('② 옆보기 실시간', () => {
  test('잘게 나눠 돌린 자동전투 = 즉시완료', () => {
    const setup = { goal: 'escort' as const, difficulty: 1, rank: 1, stats, seed: 9 };
    let a = createSideBattle(setup);
    for (let i = 0; i < 5000 && !a.result; i++) a = stepSide(a, 150, true);
    const c = finishSide(createSideBattle(setup));
    expect(a.result).toEqual(c.result);
    expect(a.t).toBe(c.t);
  });
  test('세 목표 모두 끝남', () => {
    for (const goal of ['escort', 'breakthrough', 'hold'] as const) expect(finishSide(createSideBattle({ goal, difficulty: 1, rank: 0, stats, seed: 3 })).result).not.toBeNull();
  });
});

describe('③ 포물선 대결', () => {
  test('쏘면 차례가 넘어가고, 즉시완료는 끝남', () => {
    const b = createArty({ difficulty: 1, rank: 0, stats, seed: 5 });
    const n = fire(b, 45, 60);
    expect(n.turn).toBe('foe');
    expect(n.last?.path.length).toBeGreaterThan(5);
    const f = finishArty(b);
    expect(f.result).not.toBeNull();
    expect(finishArty(b).result).toEqual(f.result);
  });
});

describe('④ 위에서 본 슈팅', () => {
  test('자동 = 즉시완료, 끝남', () => {
    const setup = { difficulty: 1, rank: 0, stats, seed: 11 };
    let a = createShooter(setup);
    for (let i = 0; i < 3000 && !a.result; i++) a = stepShooter(a, 200, true, null);
    const c = finishShooter(createShooter(setup));
    expect(c.result).not.toBeNull();
    expect(a.result).toEqual(c.result);
  });
});

describe('⑤ 퍼즐·카드', () => {
  test('암호 힌트 계산', () => {
    expect(score([1, 2, 3, 4], [1, 3, 2, 6])).toEqual({ exact: 1, near: 2 });
    expect(score([1, 1, 2, 2], [1, 2, 1, 1])).toEqual({ exact: 1, near: 2 });
    const p = createPuzzle('정보', 1, 0) as CodePuzzle;
    expect(guessCode(p, p.code).result?.win).toBe(true);
  });
  test('네 가지 모두 자동으로 끝남', () => {
    for (const k of ['모병', '정보', '보급', '해킹'] as const) expect(finishPuzzle(createPuzzle(k, 3, 1)).result).not.toBeNull();
  });
});

test('임무 종류마다 전투 틀이 정해짐', () => {
  const base = { id: 1, title: 't', city: 'kr-0', difficulty: 1, hours: 1, startMs: 0, endMs: 0 };
  expect(battleOf({ ...base, kind: '방어' }, 0).frame).toBe('grid');
  expect(battleOf({ ...base, kind: '호송' }, 0).frame).toBe('side');
  expect(battleOf({ ...base, kind: '기습', exam: true }, 4).frame).toBe('arty');
});
