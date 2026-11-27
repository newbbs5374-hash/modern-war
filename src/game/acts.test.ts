import { describe, expect, it } from 'vitest';
import { newGame, type GameState } from './state';
import { actBlocksWar, actGoals, actsTick, buyGrand, canBuyGrand, grandCapLeft, neighborsOf, noteGrand, subdued } from './acts';
import { ACT1_MIN_HOURS, ACT2_MAX_HOURS, ACT_AI, ACT_REWARD, GRAND_EXTRA_RUBY, GRAND_PER_DAY, actAi, actOf } from './balance';
import { canDiplo } from './command';
import { goalsOf, rubyOf } from './goals';
import { TECHS } from '../data/civ';
import { FRONT } from '../data/cities';
import { pairKey } from './world';
import { setRank } from './state';
import { RANKS } from '../data/ranks';

const H = 3600e3;
const fresh = (acts: boolean) => setRank(newGame('시험', 'kr', 0, { seed: 7, acts }), RANKS.length - 1);
const withAct = (s: GameState, act: number): GameState => ({ ...s, world: { ...s.world, act, actSinceMs: s.worldMs } });

describe('4장 구조', () => {
  it('장 기록이 없는 판(옛 저장·시험)은 아무것도 막지 않는다', () => {
    const s = fresh(false);
    expect(s.world.act).toBeUndefined();
    expect(actOf(s.world)).toBe(3);
    expect(actAi(s.world)).toBe(1);
    expect(actBlocksWar(s, 'jp')).toBeNull();
    expect(grandCapLeft(s)).toBeGreaterThan(10);
    expect(actsTick(s)).toBe(s);
  });

  it('1장: 먼저 선전포고할 수 없다', () => {
    const s = fresh(true);
    expect(s.world.act).toBe(1);
    expect(actBlocksWar(s, 'kp')).toContain('1장');
    expect(canDiplo(s, 'kp', '선전포고')).toContain('1장');
    expect(actGoals(s)).toHaveLength(3);
  });

  it('1장 조건(100일·군사 연구·전투력)을 다 채우면 2장으로 넘어가고 보상을 받는다', () => {
    let s = fresh(true);
    expect(actsTick(s).world.act).toBe(1);
    const mil = TECHS.filter((t) => t.line === 'mil').map((t) => t.id);
    s = { ...s, worldMs: ACT1_MIN_HOURS * H, civ: { ...s.civ!, done: mil }, economy: { ...s.economy, power: 99999 } };
    expect(actGoals(s).every((g) => g.done)).toBe(true);
    const r0 = rubyOf(s);
    const n = actsTick(s);
    expect(n.world.act).toBe(2);
    expect(n.world.actSinceMs).toBe(s.worldMs);
    expect(rubyOf(n) - r0).toBe(ACT_REWARD[1].ruby);
    expect((n.officer.boosts ?? 0) - (s.officer.boosts ?? 0)).toBe(ACT_REWARD[1].boosts);
    expect(actAi(n.world)).toBe(ACT_AI[2]);
  });

  it('2장: 이웃 나라와만, 한 번에 한 나라', () => {
    const s = withAct(fresh(true), 2);
    const nb = neighborsOf('kr');
    expect(nb).toHaveLength(5);
    expect(nb).toContain('kp');
    expect(nb).toContain('jp');
    expect(nb).not.toContain('uk');
    expect(actBlocksWar(s, 'uk')).toContain('이웃');
    expect(actBlocksWar(s, 'kp')).toBeNull();
    const war = { ...s, world: { ...s.world, pairs: { ...s.world.pairs, [pairKey('kr', 'kp')]: { ...s.world.pairs[pairKey('kr', 'kp')], rel: '전쟁' as const } } } };
    expect(actBlocksWar(war, 'cn')).toContain('한 나라');
  });

  it('2장: 두 나라를 굴복시키거나 시간이 다 되면 3장', () => {
    let s = withAct(fresh(true), 2);
    expect(actsTick(s).world.act).toBe(2);
    const owner = { ...s.world.owner };
    for (const c of FRONT) if (c.home === 'kp' || c.home === 'tw') owner[c.id] = 'kr';
    const won = { ...s, world: { ...s.world, owner } };
    expect(subdued(won).sort()).toEqual(['kp', 'tw']);
    expect(actsTick(won).world.act).toBe(3);
    s = { ...s, worldMs: s.worldMs + ACT2_MAX_HOURS * H };
    expect(actsTick(s).world.act).toBe(3);
  });

  it('3장: 승리 조건을 채우면 4장', () => {
    const s = withAct(fresh(true), 3);
    expect(actsTick(s).world.act).toBe(3);
    expect(actsTick({ ...s, officer: { ...s.officer, winSinceMs: s.worldMs } }).world.act).toBe(4);
  });

  it('하루 대전투 상한: 남의 도시만 세고, 루비로 더 살 수 있다', () => {
    let s = fresh(true);
    const foreign = FRONT.find((c) => c.home === 'kp')!.id;
    const home = FRONT.find((c) => c.home === 'kr')!.id;
    for (let i = 0; i < GRAND_PER_DAY; i++) s = { ...s, officer: { ...s.officer, grandDay: noteGrand(s, foreign) } };
    expect(grandCapLeft(s)).toBe(0);
    expect({ ...s, officer: { ...s.officer, grandDay: noteGrand(s, home) } }.officer.grandDay!.n).toBe(GRAND_PER_DAY);
    expect(canBuyGrand(s)).toContain('루비');
    s = { ...s, goals: { ...goalsOf(s), ruby: GRAND_EXTRA_RUBY * 3 } };
    s = buyGrand(s);
    expect(grandCapLeft(s)).toBe(1);
    expect(rubyOf(s)).toBe(GRAND_EXTRA_RUBY * 2);
    // 다음 날이면 다시 채워짐
    expect(grandCapLeft({ ...s, worldMs: s.worldMs + 24 * H })).toBe(GRAND_PER_DAY);
  });
});
