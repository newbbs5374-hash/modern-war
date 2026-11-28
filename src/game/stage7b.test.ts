import { describe, expect, it } from 'vitest';
import { newGame, setRank, skip, type GameState } from './state';
import { RANKS } from '../data/ranks';
import { FRONT } from '../data/cities';
import { blockStrait, canBlock, straitCity, straitMult, straitTick } from './straits';
import { canTakeSeat, takeSeat, unscOf } from './unsc';
import { isP5 } from './unscSeats';
import { backDown, brinkTick, press, yieldChance } from './brink';
import { MOOD_BLOCK, moodOf, runOp } from './opinion';
import { answerRefugees, refugeeTick } from './refugees';
import { canControl, exportControl, mineralShares, mineralMult } from './minerals';
import { coupMove, coupTick } from './coup';
import { canCyber, cyberMult, defUp, runCyber } from './cyber';
import { influenceAll } from './influence';
import { pairKey } from './world';
import { presOf } from './approval';

const H = 3600e3;
const fresh = (): GameState => {
  const s = setRank(newGame('시험', 'kr', 0, { seed: 11, acts: true }), RANKS.length - 1);
  return { ...s, world: { ...s.world, act: 3 }, nations: { ...s.nations, kr: { ...s.nations.kr, treasury: 1e9 } } };
};
const own = (s: GameState, ids: string[], to = 'kr'): GameState => ({ ...s, world: { ...s.world, owner: { ...s.world.owner, ...Object.fromEntries(ids.map((i) => [i, to])) } } });
const tension = (s: GameState, foe: string, t: number): GameState => {
  const k = pairKey('kr', foe);
  return { ...s, world: { ...s.world, pairs: { ...s.world.pairs, [k]: { ...s.world.pairs[k], rel: '중립', tension: t } } } };
};

describe('11-28 7단계 추가 9가지', () => {
  it('해협: 쥐면 봉쇄할 수 있고 예산이 흔들림', () => {
    let s = fresh();
    expect(canBlock(s, 'hormuz')).toContain('아니에요');
    s = own(s, [straitCity('hormuz')]);
    s = blockStrait(s, 'hormuz').state;
    expect(straitMult(s, 'kr')).toBeGreaterThan(1);
    expect(straitMult(s, 'us')).toBeLessThan(1);
    expect(canBlock(s, 'hormuz')).toBeTruthy();
    s = straitTick(s);
    expect(s.straits).toBeTruthy();
  });
  it('안보리: 처음은 미·중·러·영·프, 영향력이 높아야 도전', () => {
    let s = fresh();
    expect(isP5(s, 'us')).toBe(true);
    expect(canTakeSeat(s, 'fr')).toBeTruthy();
    const all = influenceAll(s);
    if ((all.kr?.total ?? 0) > (all.fr?.total ?? 0)) {
      s = takeSeat(s, 'fr').state;
      expect(unscOf(s).readyMs).toBeGreaterThan(s.worldMs);
    }
  });
  it('벼랑끝 위기: 핵 가진 나라와 긴장이 높으면 열리고, 물러서면 영향력 −', () => {
    let s = tension(fresh(), 'kp', 90);
    for (let i = 0; i < 400 && !s.brink?.open; i++) s = brinkTick({ ...s, worldMs: s.worldMs + 15 * 60e3, brink: s.brink ? { ...s.brink, nextMs: 0 } : undefined });
    expect(s.brink?.open?.foe).toBeTruthy();
    const p0 = yieldChance(s);
    s = press(s).state;
    expect(yieldChance(s)).toBeGreaterThan(p0);
    const before = influenceAll(s).kr.total;
    s = backDown(s).state;
    expect(s.brink!.open).toBeNull();
    expect(influenceAll(s).kr.total).toBeLessThan(before);
  });
  it('여론전: 여론이 무너지면 총동원 관문이 막힘', () => {
    let s = fresh();
    s = runOp(s, 'cn', 'meddle').state;
    s = { ...s, opinion: { ...s.opinion!, ready: {} } };
    s = runOp(s, 'cn', 'fake').state;
    expect(moodOf(s, 'cn')).toBeLessThanOrEqual(MOOD_BLOCK);
  });
  it('난민: 도시를 잃은 나라에서 생기고 받으면 문화·호감', () => {
    let s = refugeeTick(fresh());
    const c = FRONT.find((x) => x.home === 'ua' && !x.capital)!;
    s = own(s, [c.id], 'ru');
    s = refugeeTick({ ...s, worldMs: s.refugees!.checkMs + 1 });
    expect(s.refugees!.offer?.from).toBe('ua');
    const cul = s.culture?.total ?? 0;
    s = answerRefugees(s, true).state;
    expect(s.refugees!.taken).toBe(1);
    expect(s.culture!.total).toBeGreaterThan(cul);
  });
  it('자원 독점: 중국 도시를 많이 쥐면 희토류 수출 통제', () => {
    let s = fresh();
    expect(canControl(s, 'rare', 'jp')).toContain('몫');
    s = own(s, FRONT.filter((c) => c.home === 'cn' && !c.capital).map((c) => c.id));
    expect(mineralShares(s, 'rare').kr).toBeGreaterThan(0.5);
    s = own(s, FRONT.filter((c) => c.home === 'cn').map((c) => c.id));
    s = exportControl(s, 'rare', 'jp').state;
    expect(mineralMult(s, 'jp')).toBeLessThan(1);
  });
  it('쿠데타: 지지도가 낮으면 위협, 막는 수가 확률을 낮춤', () => {
    let s = fresh();
    const p = presOf(s);
    s = { ...s, pres: { ...p, approval: 10 } };
    s = coupTick({ ...s, coup: { open: null, nextMs: 0, heirs: 0, seed: 3 } });
    expect(s.coup!.open).toBeTruthy();
    const r0 = s.coup!.open!.risk;
    s = coupMove(s, 'purge').state;
    expect(s.coup!.open!.risk).toBeLessThan(r0);
    s = coupTick({ ...s, worldMs: s.coup!.open!.endMs + 1 });
    expect(s.coup!.open).toBeNull();
  });
  it('사이버 사령부: 작전은 12시간에 한 번, 방어를 키움', () => {
    let s = fresh();
    s = defUp(s).state;
    expect(s.cyber!.def).toBe(1);
    s = runCyber(s, 'cn', 'grid').state;
    expect(canCyber(s, 'cn', 'bank')).toContain('12시간');
    expect(cyberMult(s, 'cn')).toBeLessThanOrEqual(1);
  });
  it('3장 판이 이틀 흘러도 깨지지 않음', () => {
    const s = skip(tension(fresh(), 'cn', 80), 48 * H);
    expect(s.straits && s.unsc && s.opinion && s.refugees && s.minerals && s.coup && s.cyber).toBeTruthy();
  });
});
