import { describe, expect, it } from 'vitest';
import { advance, newGame, setRank, type GameState } from './state';
import { canSpy, missionOdds, pickStep, spyOf, startSpy } from './spy';
import { addPrisoner, agentsOf, canRecruit, canSwap, patchAgent, recruitAgent, swapAgent, weakMul } from './agents';

const H = 3600e3;
const ready = (s: GameState): GameState => ({ ...s, officer: { ...s.officer, intel: 2000 }, nations: { ...s.nations, kr: { ...s.nations.kr, treasury: 1e7 } } });

describe('특수 요원', () => {
  it('처음엔 요원 2명, 같은 씨앗이면 같은 요원', () => {
    const a = agentsOf(newGame('t', 'kr', 0, { seed: 3 }));
    const b = agentsOf(newGame('t', 'kr', 0, { seed: 3 }));
    expect(a.list).toHaveLength(2);
    expect(a.list.map((x) => x.name)).toEqual(b.list.map((x) => x.name));
  });

  it('작전에 요원이 나가고, 끝나면 돌아오거나 붙잡힘', () => {
    let s = ready(setRank(newGame('t', 'kr', 0, { seed: 5 }), 6));
    s = startSpy(s, 'base', 'cn');
    const m = spyOf(s).active[0];
    expect(m.agent).toBeDefined();
    expect(agentsOf(s).list.find((a) => a.id === m.agent)!.status).toBe('busy');
    s = advance(s, 6 * H);
    const a = agentsOf(s).list.find((x) => x.id === m.agent)!;
    expect(['idle', 'hurt', 'caught']).toContain(a.status);
    expect(a.ops).toBe(1);
  });

  it('단계마다 고르면 성공률·위험이 바뀜', () => {
    let s = ready(setRank(newGame('t', 'kr', 0, { seed: 5 }), 6));
    s = startSpy(s, 'base', 'cn');
    const m0 = spyOf(s).active[0];
    const base = missionOdds(s, m0);
    s = pickStep(s, m0.id, 'fast');
    const m1 = spyOf(s).active[0];
    const o = missionOdds(s, m1);
    expect(o.chance).toBeGreaterThan(base.chance);
    expect(o.risk).toBeGreaterThan(base.risk);
    // 같은 단계는 한 번만
    expect(pickStep(s, m0.id, 'bribe')).toBe(s);
  });

  it('쉬는 요원이 없으면 못 보냄, 위성 정찰은 요원 없이', () => {
    let s = ready(setRank(newGame('t', 'kr', 0, { seed: 5 }), 9));
    s = startSpy(s, 'base', 'cn');
    s = startSpy(s, 'turn', 'jp');
    expect(canSpy(s, 'base', 'us')).toMatch(/요원/);
    expect(canSpy(s, 'scout', 'us')).toBeNull();
  });

  it('요원 뽑기는 호칭에 따라 늘어남', () => {
    let s = ready(setRank(newGame('t', 'kr', 0, { seed: 5 }), 0));
    expect(canRecruit(s)).toMatch(/호칭/);
    s = setRank(s, 6);
    s = recruitAgent(s).state;
    expect(agentsOf(s).list).toHaveLength(3);
  });

  it('붙잡힌 요원은 포로 교환으로 돌아옴', () => {
    let s = ready(newGame('t', 'kr', 0, { seed: 5 }));
    const id = agentsOf(s).list[0].id;
    s = patchAgent(s, id, { status: 'caught', where: 'cn', untilMs: s.worldMs + 1e9 });
    expect(canSwap(s, id)).toMatch(/요원을 잡아야/);
    expect(canSpy(s, 'rescue', 'cn')).toBeNull();
    s = addPrisoner(s, 'cn');
    s = swapAgent(s, id).state;
    expect(agentsOf(s).list[0].status).toBe('hurt');
    expect(agentsOf(s).prisoners).toHaveLength(0);
  });

  it('기지 폭파가 성공하면 그 나라 적이 48시간 약해짐', () => {
    let hit = 0;
    for (let seed = 1; seed <= 10; seed++) {
      let s = ready(setRank(newGame('t', 'kr', 0, { seed }), 6));
      s = startSpy(s, 'base', 'cn');
      s = advance(s, 6.1 * H);
      if (weakMul(s, 'cn') < 1) hit++;
    }
    expect(hit).toBeGreaterThan(0);
  });
});
