import { describe, expect, it } from 'vitest';
import { newGame } from './state';
import * as C from './civ';
import { MIL_TECHS } from '../data/civ';

describe('연구 목표', () => {
  it('목표까지 가는 길은 먼저 할 연구부터 차례로 나온다', () => {
    const s = newGame('t', 'kr', 0, { seed: 1 });
    const goal = MIL_TECHS.find((t) => t.needs.length && t.needs.some((n) => MIL_TECHS.find((x) => x.id === n)!.needs.length))!;
    const path = C.techPath(s, goal.id);
    expect(path[path.length - 1].id).toBe(goal.id);
    const idx = Object.fromEntries(path.map((t, i) => [t.id, i]));
    for (const t of path) for (const n of t.needs) if (n in idx) expect(idx[n]).toBeLessThan(idx[t.id]);
  });
  it('목표를 찍으면 빈 연구 칸에 다음 걸음이 알아서 들어간다', () => {
    let s = newGame('t', 'kr', 0, { seed: 1 });
    const goal = MIL_TECHS.find((t) => t.needs.length > 0 && !C.hasTech(s, t.id))!;
    s = C.setTechGoal(s, 'mil', goal.id);
    s = { ...s, civ: { ...C.civOf(s), cur: { ...C.civOf(s).cur, mil: null } } };
    s.nations[s.player.countryId].treasury = 1e9;
    const next = C.goalNext(s, 'mil')!;
    expect(next).toBeTruthy();
    const after = C.techGoalTick(s);
    expect(C.civOf(after).cur.mil).toBe(next.id);
    expect(C.techGoalOf(C.setTechGoal(after, 'mil', goal.id), 'mil')).toBeNull();
  });
});
