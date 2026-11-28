import { describe, expect, it } from 'vitest';
import { newGame, setRank, type GameState } from './state';
import { agentsOf, powerOf, statsOf } from './agents';
import { CAND_N, CAND_RUBY, candsOf, drill, hire, refreshCands, retire, rubyStat, spendPt, train } from './agentGrow';
import { canSpy, opNeed } from './spy';

const ready = (s: GameState, ruby = 500): GameState => ({ ...s, goals: { ...s.goals!, ruby }, officer: { ...s.officer, intel: 5000 }, nations: { ...s.nations, kr: { ...s.nations.kr, treasury: 1e8 } } });

describe('그림자 요원 뽑기·키우기(11-28)', () => {
  it('후보 3명 중 하나를 뽑고, 💎10으로 후보를 새로 받음', () => {
    let s = ready(setRank(newGame('t', 'kr', 0, { seed: 4 }), 9));
    const c0 = candsOf(s);
    expect(c0).toHaveLength(CAND_N);
    const r = refreshCands(s);
    expect(r.state.goals!.ruby).toBe(500 - CAND_RUBY);
    expect(candsOf(r.state).map((c) => c.name)).not.toEqual(c0.map((c) => c.name));
    s = r.state;
    const pick = candsOf(s)[1];
    const n = agentsOf(s).list.length;
    s = hire(s, 1).state;
    expect(agentsOf(s).list).toHaveLength(n + 1);
    expect(agentsOf(s).list.at(-1)!.name).toBe(pick.name);
    expect(candsOf(s).map((c) => c.name)).not.toContain(pick.name);
  });

  it('💎가 모자라면 새로 받기 안 됨', () => {
    const s = ready(newGame('t', 'kr', 0, { seed: 4 }), 3);
    expect(refreshCands(s).state).toBe(s);
  });

  it('훈련·특훈으로 등급이 오르고 점수로 능력치를 올림', () => {
    let s = ready(newGame('t', 'kr', 0, { seed: 5 }));
    const id = agentsOf(s).list[0].id;
    const before = statsOf(agentsOf(s).list[0]).ops;
    s = train(s, id).state;
    expect(train(s, id).state).toBe(s); // 6시간마다
    for (let i = 0; i < 3; i++) s = drill(s, id).state;
    const a = agentsOf(s).list[0];
    expect(a.lv).toBeGreaterThan(2);
    expect(a.pts ?? 0).toBeGreaterThan(0);
    s = spendPt(s, id, 'ops');
    s = rubyStat(s, id, 'ops');
    expect(statsOf(agentsOf(s).list[0]).ops).toBe(Math.min(99, before + 3 + 4));
  });

  it('주요 임무는 힘이 모자라면 못 보내고, 키우면 보냄', () => {
    let s = ready(setRank(newGame('t', 'kr', 0, { seed: 6 }), 10));
    const rv = s.officer.rivals.find((r) => !r.ally)!;
    const id = agentsOf(s).list[0].id;
    s = { ...s, agents: { ...agentsOf(s), list: agentsOf(s).list.map((a) => ({ ...a, stats: { infil: 40, ops: 40, hush: 40 } })) } };
    expect(canSpy(s, 'r-accident', 'kr', id, rv.name)).toMatch(/힘/);
    for (let i = 0; i < 40 && powerOf(agentsOf(s).list[0]) < opNeed('r-accident'); i++) {
      s = rubyStat(s, id, (['infil', 'ops', 'hush'] as const)[i % 3]);
    }
    expect(canSpy(s, 'r-accident', 'kr', id, rv.name)).toBeNull();
  });

  it('은퇴하면 자리가 빔', () => {
    let s = ready(newGame('t', 'kr', 0, { seed: 7 }));
    const n = agentsOf(s).list.length;
    s = retire(s, agentsOf(s).list[0].id).state;
    expect(agentsOf(s).list).toHaveLength(n - 1);
  });
});
