import { describe, expect, it } from 'vitest';
import { newGame, type GameState } from './state';
import * as C from './cabinet';
import { recommend, takeRec, takeRecs, canTakeRec, seatFit, SWAP_GAP, OWN_OK, urgencyOf } from './recommend';

const rich = (s: GameState): GameState => ({ ...s, nations: { ...s.nations, kr: { ...s.nations.kr, treasury: 1e9 } } });
function hire(s: GameState, n: number): GameState {
  for (const p of C.cabinetOf(s).people.filter((x) => x.group === '인재').slice(0, n)) s = C.recruit(s, p.id);
  return s;
}

describe('비서 인사 추천(11-25)', () => {
  it('빈 자리마다 겹치지 않게 한 명씩 · 장관은 남은 석만큼', () => {
    const s = hire(rich(newGame('t', 'kr', 0, { seed: 21 })), 6);
    const rep = recommend(s);
    expect(rep.recs.length).toBeGreaterThan(0);
    const ids = rep.recs.map((r) => r.pid);
    expect(new Set(ids).size).toBe(ids.length);
    expect(rep.recs.filter((r) => r.seat.kind === 'min' && !r.holder).length).toBeLessThanOrEqual(rep.minLeft);
    for (const r of rep.recs) expect(r.say).toContain('각하');
  });
  it('바로 임명: 인재 명단 사람은 영입하고 앉힘', () => {
    let s = rich(newGame('t', 'kr', 0, { seed: 22 }));
    const r = recommend(s).recs.find((x) => x.cost > 0)!;
    expect(r).toBeTruthy();
    expect(canTakeRec(s, r)).toBeNull();
    s = takeRec(s, r);
    const p = C.personById(s, r.pid)!;
    expect(p.group).toBe('내각');
    expect(r.seat.kind === 'min' ? p.seat?.id : p.post).toBe(r.seat.id);
  });
  it('모두 따르면 다시 보고받을 때 빈 자리 추천이 줄고, 교체 건의는 차이가 클 때만', () => {
    let s = hire(rich(newGame('t', 'kr', 0, { seed: 23 })), 10);
    const before = recommend(s).recs.length;
    s = takeRecs(s, recommend(s).recs).s;
    const after = recommend(s);
    expect(after.recs.filter((r) => !r.holder).length).toBeLessThan(before);
    for (const r of after.recs.filter((x) => x.holder)) expect(r.fit - r.holder!.fit).toBeGreaterThanOrEqual(SWAP_GAP);
    // 앉은 사람 적합도 계산이 실제와 같음
    const c = C.cabinetOf(s);
    for (const p of c.people.filter((x) => x.post)) expect(seatFit(p, { kind: 'post', id: p.post! })).toBeGreaterThanOrEqual(0);
  });
  it('시급한 공석부터 · 빈 자리 추천은 시급도가 줄어드는 순', () => {
    const s = hire(rich(newGame('t', 'kr', 0, { seed: 24 })), 12);
    const fills = recommend(s).recs.filter((r) => !r.holder);
    for (let i = 1; i < fills.length; i++) expect(fills[i - 1].urgency).toBeGreaterThanOrEqual(fills[i].urgency);
    expect(urgencyOf(s, { kind: 'post', id: 'pm' })).toBeGreaterThan(urgencyOf(s, { kind: 'post', id: 'kfs' }));
  });
  it('내 사람 먼저: 내 사람이 쓸 만하면 인재 명단 사람을 추천하지 않음', () => {
    const s = hire(rich(newGame('t', 'kr', 0, { seed: 25 })), 12);
    const c = C.cabinetOf(s);
    const rep = recommend(s);
    const used = new Set(rep.recs.map((r) => r.pid));
    for (const r of rep.recs.filter((x) => x.cost > 0 && !x.holder)) {
      // 이 자리에 OWN_OK 넘는, 아직 안 쓴 내 사람이 남아 있으면 안 됨(앞 자리에서 쓰인 사람은 제외)
      const free = c.people.filter((p) => p.group === '내각' && !p.seat && !p.post && !used.has(p.id));
      for (const p of free) expect(seatFit(p, r.seat)).toBeLessThan(Math.max(OWN_OK, r.fit + 1));
    }
    expect(rep.recs.some((r) => r.cost === 0)).toBe(true);
  });
});
