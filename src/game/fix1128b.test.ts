// 11/28 편의 손보기: 자동 모두 승인 · 장관 사직 · 인맥 만남 청하기
import { describe, expect, it } from 'vitest';
import { newGame, type GameState } from './state';
import { cabinetOf } from './cabinet';
import { MINISTRIES } from '../data/cabinet';
import { acceptAllNow, autoApproveOn, autoApproveTick, setAutoApprove } from './autoApprove';
import { propOf } from './proposals';
import { RESIGN_WAIT_H, acceptResign, keepResign, resignOf, resignPerson, resignTick } from './resign';
import { askMeet, canAskMeet, meetOf } from './meet';

const H = 3600e3;
const base = (seed = 31): GameState => {
  const s = newGame('t', 'kr', 0, { seed });
  return { ...s, worldMs: s.worldMs + H };
};
/** 장관 n명 앉힌 판 */
function withMinisters(n: number): GameState {
  const s = base();
  const c = structuredClone(cabinetOf(s));
  const pool = c.people.filter((p) => p.group === '인재').slice(0, n);
  pool.forEach((p, i) => {
    p.group = '내각';
    p.seat = { kind: 'min', id: MINISTRIES[i].id };
  });
  return { ...s, cabinet: c };
}

describe('자동 모두 승인(11-28)', () => {
  it('켜고 끄기, 켜져 있으면 시간이 흐를 때 승인할 수 있는 건 모두 처리', () => {
    let s = base();
    expect(autoApproveOn(s)).toBe(false);
    s = setAutoApprove(s, true);
    expect(autoApproveOn(s)).toBe(true);
    const r = acceptAllNow(s);
    expect(r.n).toBeGreaterThanOrEqual(0);
    const t = autoApproveTick(s);
    expect(propOf(t).autoAll).toBe(true);
    expect(autoApproveOn(setAutoApprove(s, false))).toBe(false);
  });
});

describe('장관 사직 요청(11-28)', () => {
  it('때가 되면 장관 한 명이 사표를 내고, 수리하면 자리가 비고 인재 명단에 새 후보', () => {
    let s = withMinisters(5);
    s = { ...s, resign: { ...resignOf(s), nextMs: s.worldMs } };
    s = resignTick(s);
    const p = resignPerson(s);
    expect(p).not.toBeNull();
    expect(p!.seat?.kind).toBe('min');
    const pool0 = cabinetOf(s).people.filter((x) => x.group === '인재').length;
    const a = acceptResign(s);
    expect(cabinetOf(a).people.some((x) => x.id === p!.id)).toBe(false);
    expect(cabinetOf(a).people.filter((x) => x.group === '인재').length).toBe(pool0 + 1);
    expect(a.resign?.ask).toBeNull();
  });
  it('12시간 안에 안 고르면 그대로 수리, 만류는 봉급을 씀', () => {
    let s = withMinisters(5);
    s = resignTick({ ...s, resign: { ...resignOf(s), nextMs: s.worldMs } });
    const pid = resignPerson(s)!.id;
    const late = resignTick({ ...s, worldMs: s.worldMs + RESIGN_WAIT_H * H + 1 });
    expect(cabinetOf(late).people.some((x) => x.id === pid)).toBe(false);
    const rich = { ...s, player: { ...s.player, salary: 10000 } };
    const k = keepResign(rich);
    expect(k.state.player.salary).toBeLessThan(10000);
    expect(k.state.resign?.ask).toBeNull();
    expect(cabinetOf(k.state).people.some((x) => x.id === pid)).toBe(k.ok);
  });
  it('장관이 3명 안 되면 사표가 없음', () => {
    const s = withMinisters(2);
    const t = resignTick({ ...s, resign: { ...resignOf(s), nextMs: s.worldMs } });
    expect(t.resign?.ask).toBeNull();
  });
});

describe('인맥 만남 청하기(11-28)', () => {
  it('잠긴 묶음은 힌트, 열리면 예산을 쓰고 만남 카드가 바로 열림', () => {
    const s = base();
    const c = cabinetOf(s);
    const pol = c.people.find((p) => p.group === '정계');
    if (pol) {
      const w = canAskMeet(s, `p:${pol.id}`);
      expect(w?.lock).toBe(true);
      expect(w?.why).toContain('법안');
    }
    // 잠금 없는 묶음(인재 등) 또는 조건을 채운 사람
    const free = c.people.find((p) => p.group === '인재');
    if (!free) return;
    const key = `p:${free.id}`;
    const me = s.player.countryId;
    const rich = { ...s, nations: { ...s.nations, [me]: { ...s.nations[me], treasury: 1e9 } } };
    expect(canAskMeet(rich, key)).toBeNull();
    const t = askMeet(rich, key);
    expect(meetOf(t).card?.key).toBe(key);
    expect(t.nations[me].treasury).toBeLessThan(1e9);
    // 1시간 안에는 또 못 청함
    expect(canAskMeet({ ...t, meet: { ...meetOf(t), card: null } }, key)?.why).toContain('1시간');
  });
});
