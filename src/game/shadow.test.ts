import { describe, expect, it } from 'vitest';
import { newGame, setRank, type GameState } from './state';
import { canSpy, spyOf, startSpy } from './spy';
import { addPrisoner, agentsOf, legendsOf, meetLegend, prisonerEdge, withAgents } from './agents';
import { RIVAL_METHODS, aiShadowTick, applyRivalMethod, prisonerAct } from './shadow';
import { diploChance } from './command';

const H = 3600e3;
const ready = (s: GameState): GameState => ({ ...s, officer: { ...s.officer, intel: 5000 }, nations: { ...s.nations, kr: { ...s.nations.kr, treasury: 1e8 } } });

describe('그림자실(11-28)', () => {
  it('전설 요원: 나라마다 4명, 같은 씨앗이면 같고 다른 씨앗이면 달라짐', () => {
    const a = newGame('t', 'kr', 0, { seed: 3 });
    const b = newGame('t', 'kr', 0, { seed: 3 });
    const c = newGame('t', 'kr', 0, { seed: 4 });
    expect(legendsOf(a, 'kr')).toHaveLength(4);
    expect(legendsOf(a, 'kr')).toEqual(legendsOf(b, 'kr'));
    expect(legendsOf(a, 'kr').map((l) => l.name + l.photo)).not.toEqual(legendsOf(c, 'kr').map((l) => l.name + l.photo));
    for (const l of legendsOf(a, 'kr')) {
      expect(l.photo).toBeGreaterThanOrEqual(0);
      expect(l.photo).toBeLessThan(16);
      expect(l.sex).toBe(l.photo < 8 ? 'm' : 'f');
    }
    expect(new Set(legendsOf(a, 'kr').map((l) => l.photo)).size).toBe(4);
  });

  it('은밀한 만남을 거듭하면 인연 100에서 그림자실에 합류', () => {
    let s = ready(newGame('t', 'kr', 0, { seed: 5 }));
    const key = legendsOf(s, 'kr')[0].key;
    for (let i = 0; i < 12 && !agentsOf(s).list.some((a) => a.legend); i++) {
      s = meetLegend(s, key, 'deal').state;
      s = { ...s, worldMs: s.worldMs + 7 * H };
    }
    const lg = agentsOf(s).list.find((a) => a.legend)!;
    expect(lg).toBeDefined();
    expect(lg.lv).toBe(5);
    expect(legendsOf(s, 'kr').length).toBe(4);
    expect(agentsOf(s).gone).toContain(key);
  });

  it('정적 처리 12가지, 물러나게 하면 다른 사람이 들어옴', () => {
    expect(RIVAL_METHODS.length).toBeGreaterThanOrEqual(10);
    const s = newGame('t', 'kr', 0, { seed: 6 });
    const rv = s.officer.rivals.find((r) => !r.ally)!;
    const r = applyRivalMethod(s, 'defect', rv.name);
    expect(r.state.officer.rivals.some((x) => x.name === rv.name)).toBe(false);
    expect(r.state.officer.rivals.length).toBe(s.officer.rivals.length);
  });

  it('정적 지령은 정적을 골라야 보낼 수 있음', () => {
    const s = ready(setRank(newGame('t', 'kr', 0, { seed: 7 }), 8));
    const rv = s.officer.rivals.find((r) => !r.ally)!;
    expect(canSpy(s, 'r-expose', 'kr', undefined, undefined)).toBeTruthy();
    expect(canSpy(s, 'r-expose', 'kr', undefined, rv.name)).toBeNull();
    const t = startSpy(s, 'r-expose', 'kr', undefined, rv.name);
    expect(spyOf(t).active[0].rival).toBe(rv.name);
    expect(spyOf(t).active[0].agent).toBeDefined();
  });

  it('포로가 있으면 그 나라와 협상이 쉬워지고, 배상금을 받으면 풀어 줌', () => {
    let s = newGame('t', 'kr', 0, { seed: 8 });
    const before = diploChance(s, 'jp', '연합 제안');
    s = addPrisoner(s, 'jp', { legend: true, name: '가상', code: '독사', sex: 'm' });
    expect(prisonerEdge(s, 'jp')).toBeCloseTo(0.4);
    expect(diploChance(s, 'jp', '연합 제안')).toBeGreaterThan(before);
    const money = s.nations.kr.treasury;
    const r = prisonerAct(s, 0, 'ransom');
    expect(agentsOf(r.state).prisoners).toHaveLength(0);
    expect(r.state.nations.kr.treasury).toBeGreaterThan(money);
  });

  it('다른 나라도 블랙 작전을 보냄(기록이 쌓임)', () => {
    let s = newGame('t', 'kr', 0, { seed: 9 });
    s = { ...s, world: { ...s.world, pairs: Object.fromEntries(Object.entries(s.world.pairs).map(([k, p]) => [k, k.includes('kr') ? { ...p, tension: 90 } : p])) } };
    for (let i = 0; i < 40; i++) {
      s = withAgents(s, { ...agentsOf(s), aiNextMs: 0 });
      s = aiShadowTick({ ...s, worldMs: s.worldMs + 14 * H });
    }
    const ag = agentsOf(s);
    expect((ag.alog?.length ?? 0) + ag.prisoners.length).toBeGreaterThan(0);
  });
});
