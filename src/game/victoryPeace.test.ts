import { describe, expect, it } from 'vitest';
import { FRONT } from '../data/cities';
import { newGame, type GameState } from './state';
import { annexEntry, annexTick } from './annex';
import { noteCapture } from './territory';
import { homeOf, incomeShare, pairKey, syncFollowers } from './world';
import { canVictoryPeace, doVictoryPeace, peaceChance, warLead } from './victoryPeace';
import { doUnrestAct, unrestOf, unrestRisk, unrestTick, CALM_DAYS } from './unrest';
import { canChoose } from './annex';
import { giftCity, giftTargets, makeBase, makeZone, swapCity, swapTargets } from './occChoices';

const H = 3600e3;
const jp = FRONT.filter((c) => c.home === 'jp' && !c.capital).map((c) => c.id);
const kr = FRONT.filter((c) => c.home === 'kr' && !c.capital).map((c) => c.id);

function own(s: GameState, id: string, who: string): GameState {
  const w = { ...s.world, owner: { ...s.world.owner }, defense: { ...s.world.defense } };
  noteCapture(w, id, who);
  w.owner[id] = who;
  syncFollowers(w);
  return { ...s, world: w };
}
function rel(s: GameState, b: string, r: '전쟁' | '연합' | '중립') {
  const k = pairKey('kr', b);
  return { ...s, world: { ...s.world, pairs: { ...s.world.pairs, [k]: { ...s.world.pairs[k], rel: r, weariness: 300 } } } };
}
function setLoyalty(s: GameState, id: string, v: number): GameState {
  const civ = s.civ!;
  const cur = civ.cities[id] ?? { loyalty: v, pop: 1, grow: 0, districts: [] };
  return { ...s, civ: { ...civ, cities: { ...civ.cities, [id]: { ...cur, loyalty: v } } } };
}
const later = (s: GameState, h: number) => ({ ...s, worldMs: s.worldMs + h * H });
function base(): GameState {
  let s = newGame('t', 'kr', 0, { seed: 5 });
  s = { ...s, player: { ...s.player, rankIndex: 10 }, nations: { ...s.nations, kr: { ...s.nations.kr, treasury: 1e9 } } };
  s = own(own(s, jp[0], 'kr'), jp[1], 'kr');
  return annexTick(rel(s, 'jp', '전쟁'));
}
function sign(s: GameState, keep: string[], back: string[] = []): GameState {
  for (let i = 0; i < 40; i++) {
    const r = doVictoryPeace(later(s, i * 13), 'jp', keep, back);
    if (r.ok) return r.state;
  }
  throw new Error('never accepted');
}

describe('승전 강화', () => {
  it('이기고 있어야 열림', () => {
    let s = base();
    expect(warLead(s, 'jp').winning).toBe(true);
    expect(canVictoryPeace(s, 'jp')).toBeNull();
    s = own(own(own(s, kr[0], 'jp'), kr[1], 'jp'), kr[2], 'jp');
    expect(warLead(s, 'jp').winning).toBe(false);
    expect(canVictoryPeace(s, 'jp')).toBeTruthy();
  });
  it('많이 가질수록 받아들일 확률 ↓', () => {
    const s = base();
    expect(peaceChance(s, 'jp', [jp[0]])).toBeGreaterThan(peaceChance(s, 'jp', [jp[0], jp[1]]) - 1e-9);
  });
  it('고른 도시는 우리 땅(불안), 나머지는 돌려주고 휴전', () => {
    let s = sign(base(), [jp[0]]);
    expect(s.world.pairs[pairKey('kr', 'jp')].rel).toBe('휴전');
    expect(homeOf(s.world, jp[0])).toBe('kr');
    expect(s.world.owner[jp[1]]).toBe('jp');
    expect(unrestOf(s, jp[0])?.from).toBe('jp');
    expect(annexEntry(s, jp[0])).toBeNull();
    s = annexTick(s);
    expect(homeOf(s.world, jp[0])).toBe('kr');
  });
  it('빼앗긴 우리 도시도 돌려받음', () => {
    let s = own(base(), kr[0], 'jp');
    s = sign(s, [jp[0], jp[1]], [kr[0]]);
    expect(s.world.owner[kr[0]]).toBe('kr');
  });
  it('내정이 부실하면 반란 확률이 크고, 오래 두면 반란이 남', () => {
    let s = sign(base(), [jp[0]]);
    const good = unrestRisk(setLoyalty(s, jp[0], 80), jp[0]).pct;
    const bad = unrestRisk(setLoyalty(s, jp[0], 10), jp[0]).pct;
    expect(bad).toBeGreaterThan(good);
    let lostIt = false;
    for (let d = 0; d < 60 && !lostIt; d++) {
      s = unrestTick(setLoyalty(later(s, 24), jp[0], 5));
      lostIt = s.world.owner[jp[0]] === 'jp';
    }
    expect(lostIt).toBe(true);
    expect(unrestOf(s, jp[0])).toBeNull();
  });
  it('민심을 지키면 안정되고, 주둔군은 확률을 낮춤', () => {
    let s = sign(base(), [jp[0]]);
    const before = unrestRisk(s, jp[0]).pct;
    const r = doUnrestAct(s, jp[0], 'troops');
    expect(unrestRisk(r.state, jp[0]).pct).toBeLessThan(before);
    s = r.state;
    s = unrestTick(setLoyalty(s, jp[0], 95));
    for (let d = 0; d <= CALM_DAYS && unrestOf(s, jp[0]); d++) s = unrestTick(setLoyalty(later(s, 24), jp[0], 95));
    expect(unrestOf(s, jp[0])).toBeNull();
  });
});

describe('점령 후 선택', () => {
  it('군사 기지·경제 특구', () => {
    let s = base();
    const inc = incomeShare(s.world, 'kr', true);
    s = makeZone(s, jp[0]);
    expect(annexEntry(s, jp[0])?.mode).toBe('zone');
    expect(incomeShare(s.world, 'kr', true)).toBeGreaterThan(inc);
    s = makeBase(s, jp[1]);
    expect(annexEntry(s, jp[1])?.mode).toBe('base');
    expect(s.world.defense[jp[1]]).toBeGreaterThanOrEqual(80);
    expect(canChoose(s, jp[1])).toBeTruthy();
  });
  it('연합국에 넘기기', () => {
    let s = rel(base(), 'us', '연합');
    expect(giftTargets(s, jp[0])).toContain('us');
    s = giftCity(s, jp[0], 'us');
    expect(s.world.owner[jp[0]]).toBe('us');
  });
  it('도시 맞바꾸기', () => {
    let s = own(base(), kr[0], 'jp');
    expect(swapTargets(s, jp[0])).toContain(kr[0]);
    s = swapCity(s, jp[0], kr[0]);
    expect(s.world.owner[jp[0]]).toBe('jp');
    expect(s.world.owner[kr[0]]).toBe('kr');
    expect(s.world.pairs[pairKey('kr', 'jp')].rel).toBe('휴전');
  });
});
