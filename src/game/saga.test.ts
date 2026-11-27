import { describe, expect, it } from 'vitest';
import { newGame, type GameState } from './state';
import { chooseCrisis, crisisById, crisisOf } from './crisis';
import { SAGAS, SAGA_FIRST_MS, SAGA_STEP_MS, gradeOf, sagaOf, sagaTick } from './saga';

const H = 3600e3;
const rich = (s: GameState): GameState => ({ ...s, nations: { ...s.nations, kr: { ...s.nations.kr, treasury: 1e7 } }, economy: { ...s.economy, stock: { ...s.economy.stock, 석유: 9999, 강철: 9999 } } });
const at = (s: GameState, ms: number): GameState => ({ ...s, worldMs: ms, crisis: { ...crisisOf(s), nextMs: ms + 999 * H } });

function play(pick: (opts: { m: number }[]) => number) {
  let s = rich(newGame('시험', 'kr', 0, { seed: 7 }));
  s = sagaTick(s);
  expect(sagaOf(s).id).toBeNull();
  let t = SAGA_FIRST_MS + 1;
  const seen: string[] = [];
  for (let day = 1; day <= 3; day++) {
    s = sagaTick(at(s, t));
    const o = crisisOf(s).open!;
    expect(o.def).toMatch(new RegExp(`^saga-[a-z]+-${day}`));
    seen.push(o.def);
    const d = crisisById(o.def);
    s = chooseCrisis(s, pick(d.options as unknown as { m: number }[]));
    s = sagaTick(s);
    t += SAGA_STEP_MS + 1;
  }
  return { s, seen };
}

describe('연속 위기 이야기', () => {
  it('카드가 모두 등록돼 있고 답마다 점수가 있다', () => {
    for (const d of SAGAS) for (const k of ['1', '2a', '2b', '3']) {
      const c = crisisById(`saga-${d.id}-${k}`);
      expect(c.id).toBe(`saga-${d.id}-${k}`);
      expect(c.options.length).toBe(3);
      expect(c.options.some((o) => (o as unknown as { m: number }).m < 0)).toBe(true);
    }
  });
  it('잘 고르면 좋게 끝나고 둘째 날은 차분한 카드', () => {
    const { s, seen } = play((o) => o.reduce((b, x, i) => (x.m < o[b].m ? i : b), 0));
    expect(seen[1]).toMatch(/-2a$/);
    expect(sagaOf(s).last?.grade).toBe('good');
    expect(sagaOf(s).id).toBeNull();
    expect(sagaOf(s).done).toBe(1);
  });
  it('못 고르면 나쁘게 끝나고 둘째 날은 번진 카드', () => {
    const { s, seen } = play((o) => o.reduce((b, x, i) => (x.m > o[b].m ? i : b), 0));
    expect(seen[1]).toMatch(/-2b$/);
    expect(sagaOf(s).last?.grade).toBe('bad');
  });
  it('다른 사건이 열려 있으면 기다린다', () => {
    let s = rich(newGame('시험', 'kr', 0, { seed: 7 }));
    s = sagaTick(s);
    s = { ...s, worldMs: SAGA_FIRST_MS + 1, crisis: { ...crisisOf(s), open: { id: 1, def: 'oil', target: null, untilMs: 9e15 } } };
    s = sagaTick(s);
    expect(crisisOf(s).open?.def).toBe('oil');
    expect(sagaOf(s).wait).toBeNull();
  });
  it('점수 등급', () => {
    expect(gradeOf(-2)).toBe('good');
    expect(gradeOf(0)).toBe('mid');
    expect(gradeOf(2)).toBe('bad');
  });
});
