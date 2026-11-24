import { describe, expect, it } from 'vitest';
import { newGame, type GameState } from './state';
import * as C from './cabinet';
import { POSTS, OFFICES } from '../data/staff';
import { counterOn } from './cabinet';

const rich = (s: GameState): GameState => ({ ...s, nations: { ...s.nations, kr: { ...s.nations.kr, treasury: 1e9 } } });
/** 인재 명단 n명 영입 */
function hire(s: GameState, n: number): GameState {
  for (const p of C.cabinetOf(s).people.filter((x) => x.group === '인재').slice(0, n)) s = C.recruit(s, p.id);
  return s;
}

describe('대통령실 참모진·기관장(11-24)', () => {
  it('자리는 37개(청 18 포함), 실장은 자기 실에 있음', () => {
    expect(POSTS.length).toBe(37);
    expect(POSTS.filter((p) => p.office === 'agency').length).toBe(18);
    for (const p of POSTS) if (p.office === 'agency') expect(p.parent).toBeTruthy();
    expect(new Set(POSTS.map((p) => p.id)).size).toBe(POSTS.length);
    for (const o of OFFICES) if (o.head) expect(POSTS.find((p) => p.id === o.head)!.office).toBe(o.id);
  });
  it('영입한 사람만 바로 임명 · 효과가 켜지고 · 내리면 꺼짐', () => {
    let s = hire(rich(newGame('t', 'kr', 0, { seed: 11 })), 3);
    const pool = C.cabinetOf(s).people.find((p) => p.group === '인재')!;
    expect(C.canAppointPost(s, pool.id, 'polit')).not.toBeNull();
    const mine = C.cabinetOf(s).people.filter((p) => p.group === '내각' && !p.seat && !p.post);
    const p = mine[0];
    const t0 = C.cabTrust(s);
    s = C.appointPost(s, p.id, 'polit');
    expect(C.postHolder(C.cabinetOf(s), 'polit')?.id).toBe(p.id);
    expect(C.cabTrust(s)).toBeGreaterThan(t0);
    // 장관과 겹쳐 앉을 수 없음
    expect(C.canAppointMinister(s, p.id, 'mof')).not.toBeNull();
    s = C.unpost(s, p.id);
    expect(C.postHolder(C.cabinetOf(s), 'polit')).toBeNull();
    expect(C.cabTrust(s)).toBe(t0);
  });
  it('비서실장이 있으면 비서실 수석 힘이 올라감 · 교체하면 앞사람이 내려옴', () => {
    let s = hire(rich(newGame('t', 'kr', 0, { seed: 12 })), 4);
    const mine = C.cabinetOf(s).people.filter((p) => p.group === '내각' && !p.seat && !p.post);
    s = C.appointPost(s, mine[0].id, 'press');
    const before = C.postPower(s, 'press');
    s = C.appointPost(s, mine[1].id, 'chief');
    expect(C.postPower(s, 'press')).toBeGreaterThan(before);
    s = C.appointPost(s, mine[2].id, 'press');
    expect(C.cabinetOf(s).people.find((p) => p.id === mine[0].id)!.post).toBeUndefined();
  });
  it('총리는 장관 힘을 올리고, 추천 채우기는 빈 자리를 채움', () => {
    let s = hire(rich(newGame('t', 'kr', 0, { seed: 13 })), 10);
    const mine = C.cabinetOf(s).people.filter((p) => p.group === '내각' && !p.seat && !p.post);
    s = C.appointMinister(s, mine[0].id, 'mnd');
    expect(C.ministerOf(C.cabinetOf(s), 'mnd')?.id).toBe(mine[0].id); // 시험판: 청문회 생략
    const m0 = C.ministryPower(s, 'mnd');
    s = C.appointPost(s, mine[1].id, 'pm');
    expect(C.ministryPower(s, 'mnd')).toBeGreaterThan(m0);
    s = C.autoFillOffice(s, 'sec');
    expect(POSTS.filter((p) => p.office === 'sec').every((p) => C.postHolder(C.cabinetOf(s), p.id))).toBe(true);
  });
  it('경호처장이 강하면 정적 방해를 막음', () => {
    let s = hire(rich(newGame('t', 'kr', 0, { seed: 14 })), 2);
    const p = C.cabinetOf(s).people.find((x) => x.group === '내각' && !x.seat && !x.post)!;
    s = C.appointPost(s, p.id, 'guard');
    const cab = structuredClone(C.cabinetOf(s));
    const g = cab.people.find((x) => x.id === p.id)!;
    g.stats['은밀'] = 30;
    g.stats['체력'] = 30;
    s = { ...s, cabinet: cab };
    expect(counterOn(s)).toBe(true);
  });
});

describe('부처 15곳(11-24)', () => {
  it('새 부처 6곳: 장관 앉히고 업무 끝내면 결과가 나옴', async () => {
    const { MINISTRIES, ministerSlots } = await import('../data/cabinet');
    const { startTask, cabinetTick } = await import('./cabinetOps');
    expect(MINISTRIES.length).toBe(24);
    expect(ministerSlots(10)).toBe(15);
    let s = hire(rich(newGame('t', 'kr', 0, { seed: 21 })), 8);
    const ids = ['mou', 'moj', 'moe', 'molit', 'mofs', 'moel'] as const;
    const mine = C.cabinetOf(s).people.filter((p) => p.group === '내각' && !p.seat && !p.post);
    ids.forEach((id, i) => (s = C.appointMinister(s, mine[i].id, id)));
    for (const id of ids) expect(C.ministerOf(C.cabinetOf(s), id)).not.toBeNull();
    const pool0 = C.cabinetOf(s).people.filter((p) => p.group === '인재').length;
    for (const id of ids) s = startTask(s, id, MINISTRIES.find((m) => m.id === id)!.tasks[0].id);
    s = { ...s, worldMs: s.worldMs + 7 * 3600e3 };
    s = cabinetTick(s, 60e3);
    expect(Object.keys(C.cabinetOf(s).tasks).length).toBe(0);
    expect(C.cabinetOf(s).people.filter((p) => p.group === '인재').length).toBeGreaterThanOrEqual(pool0 + 2);
  });
});
