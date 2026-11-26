import { describe, expect, it } from 'vitest';
import { CITIES } from '../data/cities';
import { newGame, type GameState } from './state';
import { START_DAMAGE, annexEntry, annexTick, applyOccTask, canChoose, canLiberate, canOccTask, canVote, liberate, makePuppet, voteYes } from './annex';
import { noteCapture } from './territory';
import { incomeShare, isPuppet, pairKey } from './world';
import { favorOf } from './civ';
import { resPerDay } from './economy';

const H = 3600e3;
const city = (n: string) => CITIES.find((c) => c.name === n)!.id;
function give(s: GameState, id: string, to: string): GameState {
  const w = { ...s.world, owner: { ...s.world.owner } };
  noteCapture(w, id, to);
  w.owner[id] = to;
  return { ...s, world: w };
}
const later = (s: GameState, h: number) => ({ ...s, worldMs: s.worldMs + h * H });

describe('점령 직후 처분 3갈래', () => {
  it('점령하면 전쟁 피해가 생기고 수입이 줄었다가 하루마다 회복', () => {
    const fk = city('후쿠오카');
    const base = give(newGame('t', 'kr', 0, { seed: 3 }), fk, 'kr');
    const before = incomeShare(base.world, 'kr');
    let s = annexTick(base);
    expect(annexEntry(s, fk)?.damage).toBe(START_DAMAGE);
    expect(incomeShare(s.world, 'kr')).toBeLessThan(before);
    s = annexTick(later(s, 49));
    expect(annexEntry(s, fk)?.damage).toBe(START_DAMAGE - 6);
  });
  it('꼭두각시 정부: 바로 세우고, 공물 30%·반란 없음·자원 없음, 투표·되돌리기 불가', () => {
    const fk = city('후쿠오카');
    let s = annexTick(give(newGame('t', 'kr', 0, { seed: 3 }), fk, 'kr'));
    expect(canChoose(s, fk)).toBeNull();
    const favor = favorOf(s, 'jp');
    const sum = (x: GameState) => Object.values(resPerDay(x)).reduce((a, b) => a + b, 0);
    const res = sum(s);
    s = makePuppet(s, fk);
    expect(sum(s)).toBeLessThanOrEqual(res);
    expect(isPuppet(s.world, fk)).toBe(true);
    expect(favorOf(s, 'jp')).toBeLessThan(favor);
    expect(canChoose(s, fk)).toBeTruthy();
    expect(canVote(s, fk)).toBeTruthy();
    // 시간이 지나도 민정으로 넘어가지 않음
    s = annexTick(later(s, 30));
    expect(annexEntry(s, fk)?.mode).toBe('puppet');
    expect(annexEntry(s, fk)?.stage).toBe('군정');
  });
  it('해방: 다른 나라에게서 빼앗은 도시는 원래 나라에 돌려주고 호감·명성·연합', () => {
    const fk = city('후쿠오카');
    let s = give(newGame('t', 'kr', 0, { seed: 3 }), fk, 'cn');
    s = annexTick(give(s, fk, 'kr'));
    expect(canLiberate(s, fk)).toBeNull();
    const fame = s.officer.fame, favor = favorOf(s, 'jp');
    s = liberate(s, fk);
    expect(s.world.owner[fk]).toBe('jp');
    expect(s.officer.fame).toBeGreaterThan(fame);
    expect(favorOf(s, 'jp')).toBeGreaterThan(favor);
    expect(['연합', '휴전']).toContain(s.world.pairs[pairKey('kr', 'jp')].rel);
    expect(annexEntry(s, fk)).toBeNull();
  });
  it('원래 나라에게서 바로 빼앗은 도시는 해방할 곳이 없음', () => {
    const fk = city('후쿠오카');
    const s = annexTick(give(newGame('t', 'kr', 0, { seed: 3 }), fk, 'kr'));
    expect(canLiberate(s, fk)).toBeTruthy();
  });
  it('민정으로 넘어가면 처분을 못 바꿈', () => {
    const fk = city('후쿠오카');
    let s = annexTick(give(newGame('t', 'kr', 0, { seed: 3 }), fk, 'kr'));
    s = annexTick(later(s, 25));
    expect(annexEntry(s, fk)?.stage).toBe('민정');
    expect(canChoose(s, fk)).toBeTruthy();
  });
});

describe('점령지 관리 임무', () => {
  it('잔당 소탕: 군정 단축·노획, 12시간 뒤 다시', () => {
    const fk = city('후쿠오카');
    let s = annexTick(give(newGame('t', 'kr', 0, { seed: 3 }), fk, 'kr'));
    const since = annexEntry(s, fk)!.since, money = s.nations.kr.treasury;
    expect(canOccTask(s, fk, '소탕')).toBeNull();
    s = applyOccTask(s, fk, '소탕', 3).state;
    expect(annexEntry(s, fk)!.since).toBe(since - 6 * H);
    expect(s.nations.kr.treasury).toBeGreaterThan(money);
    expect(canOccTask(s, fk, '소탕')).toMatch(/시간 뒤/);
    expect(canOccTask(s, fk, '선전')).toBeTruthy();
  });
  it('재건은 피해를 줄이고, 선전 방송은 찬성률을 올림', () => {
    const fk = city('후쿠오카');
    let s = annexTick(give(newGame('t', 'kr', 0, { seed: 3 }), fk, 'kr'));
    s = applyOccTask(s, fk, '재건', 2).state;
    expect(annexEntry(s, fk)!.damage).toBe(START_DAMAGE - 16);
    s = annexTick(later(s, 25));
    const yes = voteYes(s, fk).pct;
    s = applyOccTask(s, fk, '선전', 2).state;
    expect(voteYes(s, fk).pct).toBe(Math.min(95, yes + 6));
  });
  it('실패하면 효과 없이 시간만 씀', () => {
    const fk = city('후쿠오카');
    let s = annexTick(give(newGame('t', 'kr', 0, { seed: 3 }), fk, 'kr'));
    s = applyOccTask(s, fk, '재건', 0).state;
    expect(annexEntry(s, fk)!.damage).toBe(START_DAMAGE);
    expect(canOccTask(s, fk, '재건')).toMatch(/시간 뒤/);
  });
});
