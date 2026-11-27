import { describe, expect, it } from 'vitest';
import { newGame, type GameState } from './state';
import { counterAutoChance, counterOf, counterPlan, counterTick, planCounter, settleCounter } from './counter';
import { finaleFoes, finaleTick, FINALE_CRISES, FINALE_AT_H } from './finale';
import { crisisById, crisisOf } from './crisis';
import { greatPowers, victoryProgress } from './victory';
import { legacyOf, unlockedNations, applyLegacy } from './unlock';
import { actsTick } from './acts';
import { relationOf } from './world';

const H = 3600e3;
const game = (act: number): GameState => {
  const s = newGame('시험', 'kr', 0, { seed: 7, acts: true });
  s.world.act = act;
  return s;
};
/** 일본과 전쟁 중에 도쿄를 빼앗은 상태 */
const taken = (act: number) => {
  const s = game(act);
  s.world.pairs['jp|kr'].rel = '전쟁';
  s.world.owner['jp-0'] = 'kr';
  return s;
};

describe('AI 반격', () => {
  it('1장과 옛 저장에는 반격이 없다', () => {
    const a = taken(1);
    planCounter(a, 'jp-0', 'jp');
    expect(counterOf(a).list).toHaveLength(0);
    const b = taken(3);
    b.world.act = undefined;
    planCounter(b, 'jp-0', 'jp');
    expect(counterOf(b).list).toHaveLength(0);
  });
  it('3장에서는 여러 번 빼앗으면 반격이 걸리고 한꺼번에 2건까지', () => {
    const s = taken(3);
    for (const c of ['jp-0', 'jp-1', 'jp-2', 'jp-3', 'jp-4']) for (let i = 0; i < 6; i++) planCounter(s, c, 'jp');
    const n = counterOf(s).list.length;
    expect(n).toBeGreaterThan(0);
    expect(n).toBeLessThanOrEqual(2);
  });
  it('막아 내면 도시를 지키고 보상, 지면 도시를 돌려줌', () => {
    const s = taken(3);
    s.counter = { list: [{ id: 1, city: 'jp-0', from: 'jp', dueMs: 5 * H }], nextId: 2, won: 0, lost: 0 };
    const before = s.nations.kr.treasury;
    const win = settleCounter(s, 1, true, 3, '직접').state;
    expect(win.world.owner['jp-0']).toBe('kr');
    expect(win.nations.kr.treasury).toBeGreaterThan(before);
    expect(counterOf(win).won).toBe(1);
    const lose = settleCounter(s, 1, false, 0, '직접').state;
    expect(lose.world.owner['jp-0']).toBe('jp');
    expect(counterOf(lose).list).toHaveLength(0);
  });
  it('시간이 되면 부대가 알아서 맞고, 직접 막기는 버티기 전투 한 판', () => {
    const s = taken(3);
    s.counter = { list: [{ id: 1, city: 'jp-0', from: 'jp', dueMs: 5 * H }], nextId: 2, won: 0, lost: 0 };
    expect(counterTick(s)).toBe(s);
    const done = counterTick({ ...s, worldMs: 6 * H });
    expect(counterOf(done).list).toHaveLength(0);
    const plan = counterPlan(s, counterOf(s).list[0]);
    expect(plan.source).toBe('counter');
    expect(plan.stages).toHaveLength(1);
    expect(counterAutoChance(s)).toBeGreaterThan(0.1);
    expect(counterAutoChance(s)).toBeLessThan(0.95);
  });
});

describe('정복 승리: 강대국 수도', () => {
  it('강대국은 나를 뺀 군사력 상위 셋', () => {
    expect(greatPowers('kr')).toEqual(['us', 'ru', 'cn']);
    expect(greatPowers('us')).not.toContain('us');
  });
  it('장 구조 판은 수도 3곳이 필요, 옛 저장은 필요 없음', () => {
    const s = game(3);
    expect(victoryProgress(s).capsNeed).toBe(3);
    expect(victoryProgress(s).capsOk).toBe(false);
    for (const id of greatPowers('kr')) s.world.owner[`${id}-0`] = 'kr';
    expect(victoryProgress(s).capsOk).toBe(true);
    const old = game(3);
    old.world.act = undefined;
    expect(victoryProgress(old).capsOk).toBe(true);
  });
});

describe('마지막 위기', () => {
  it('4장에 들어서면 센 나라 셋이 선전포고하고 위기 카드 3장이 차례로 온다', () => {
    let s = game(4);
    s.officer.winSinceMs = 0;
    const foes = finaleFoes(s);
    expect(foes).toHaveLength(3);
    s = finaleTick(s);
    for (const id of foes) expect(relationOf(s.world, 'kr', id)).toBe('전쟁');
    expect(s.finale?.step).toBe(0);
    for (let i = 0; i < FINALE_CRISES.length; i++) {
      s = { ...s, worldMs: FINALE_AT_H[i] * H, crisis: { ...crisisOf(s), open: null } };
      s = finaleTick(s);
      expect(crisisOf(s).open?.def).toBe(FINALE_CRISES[i].id);
      expect(crisisById(FINALE_CRISES[i].id).options).toHaveLength(3);
    }
    expect(s.finale?.step).toBe(3);
  });
  it('승리 조건을 놓치면 3장으로 돌아가고 위기 진행이 지워진다', () => {
    let s = game(4);
    s.finale = { sinceMs: 0, step: 2 };
    s = finaleTick(actsTick(s));
    expect(s.world.act).toBe(3);
    expect(s.finale).toBeUndefined();
  });
});

describe('나라 열기 · 유산', () => {
  it('첫 판은 한국만, 이기면 가까운 나라 5곳이 열린다', () => {
    expect(unlockedNations([])).toEqual(['kr']);
    const one = unlockedNations([{ country: '한국' }]);
    expect(one).toHaveLength(6);
    for (const id of ['kp', 'jp', 'cn', 'tw', 'ph']) expect(one).toContain(id);
    expect(unlockedNations([{ country: '일본' }, { country: '한국' }]).length).toBe(11);
    expect(unlockedNations([], true).length).toBe(36);
  });
  it('유산은 이긴 횟수만큼(5번까지) 시작 보너스', () => {
    expect(legacyOf([])).toEqual({ wins: 0, ruby: 0, boosts: 0 });
    expect(legacyOf(new Array(9).fill(0)).wins).toBe(5);
    const s = game(1);
    const t = applyLegacy(s, [{}, {}]);
    expect((t.officer.boosts ?? 0) - (s.officer.boosts ?? 0)).toBe(6);
  });
});
