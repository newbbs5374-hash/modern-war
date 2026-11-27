import { describe, expect, it } from 'vitest';
import { newGame, type GameState } from './state';
import { cabinetOf } from './cabinet';
import {
  BOND_FAVOR,
  BOND_MINE,
  CARD_WAIT_MS,
  FAVORS,
  MEET_DAY_MAX,
  SPOTS,
  SPOT_IDS,
  addBond,
  answerMeet,
  bookList,
  bookReady,
  canMeetNow,
  claimBook,
  meetOf,
  meetTick,
  openMeet,
  spotFor,
  trackMeet,
  whoOf,
  type MeetKey,
} from './meet';

const base = (seed = 31): GameState => {
  const s = newGame('t', 'kr', 0, { seed });
  return { ...s, worldMs: s.worldMs + 3600e3 };
};

describe('인물 만남(11-27)', () => {
  it('자리마다 만날 수 있는 사람이 있음', () => {
    const s = base();
    for (const id of SPOT_IDS) {
      const ns = openMeet(s, id, 1000 + SPOT_IDS.indexOf(id));
      expect(meetOf(ns).card, id).not.toBeNull();
      expect(whoOf(ns, meetOf(ns).card!.key), id).not.toBeNull();
    }
  });

  it('콘텐츠를 끝내면(법안 통과) 의회에서 만남이 열리고, 쉬는 시간·하루 상한을 지킴', () => {
    expect(spotFor({ law: 1 })).toBe('assembly');
    expect(spotFor({ capture: 1, law: 1 })).toBe('victory');
    expect(spotFor({ salary: 1 })).toBeNull();
    const s = base();
    const b = s;
    const a: GameState = { ...s, assembly: { ...(s.assembly as NonNullable<GameState['assembly']>), passed: ((s.assembly as { passed?: number } | undefined)?.passed ?? 0) + 1 } };
    const t = trackMeet(b, a);
    if (s.assembly) {
      expect(meetOf(t).card?.spot).toBe('assembly');
      expect(canMeetNow(t)).toBe(false);
    }
    // 하루 상한
    let x = base(32);
    for (let i = 0; i < MEET_DAY_MAX + 3; i++) {
      if (!canMeetNow(x)) break;
      x = openMeet(x, 'press', i + 1);
      x = answerMeet(x, 'warm');
      x = { ...x, worldMs: Math.max(x.worldMs, meetOf(x).nextMs) };
    }
    expect(meetOf(x).today).toBeLessThanOrEqual(MEET_DAY_MAX);
  });

  it('대답하면 인연이 오르고, 두 번째 만남부터 부탁 → 들어주면 인연 크게', () => {
    let s = openMeet(base(), 'factory', 7);
    const key = meetOf(s).card!.key;
    s = answerMeet(s, 'warm');
    const b1 = meetOf(s).bond[key];
    expect(b1).toBeGreaterThan(0);
    expect(meetOf(s).met).toContain(key);
    // 같은 사람과 다시 만남
    s = { ...s, meet: { ...meetOf(s), card: { key, spot: 'factory', step: 1, atMs: s.worldMs, untilMs: s.worldMs + CARD_WAIT_MS } } };
    s = answerMeet(s, 'deal');
    const fav = meetOf(s).favors.find((f) => f.key === key)!;
    expect(fav).toBeTruthy();
    const before = meetOf(s).bond[key];
    // 부탁 끝냄
    s = { ...s, meet: { ...meetOf(s), favors: meetOf(s).favors.map((f) => (f.key === key ? { ...f, have: FAVORS[f.id].need } : f)) } };
    s = meetTick(s);
    expect(meetOf(s).favors.length).toBe(0);
    expect(meetOf(s).bond[key]).toBe(Math.min(BOND_MINE, before + BOND_FAVOR));
    expect(meetOf(s).favorDone).toBe(1);
  });

  it('기한 넘긴 부탁은 인연이 깎이고, 오래 둔 카드는 지나감', () => {
    let s = openMeet(base(), 'press', 3);
    const key = meetOf(s).card!.key;
    s = { ...s, meet: { ...meetOf(s), card: { ...meetOf(s).card!, step: 1 } } };
    s = answerMeet(s, 'warm');
    const b = meetOf(s).bond[key];
    s = meetTick({ ...s, worldMs: s.worldMs + 25 * 3600e3 });
    expect(meetOf(s).bond[key]).toBeLessThan(b);
    s = openMeet(s, 'press', 9);
    s = meetTick({ ...s, worldMs: s.worldMs + CARD_WAIT_MS + 1 });
    expect(meetOf(s).card).toBeNull();
  });

  it('인연 100이면 내 사람(내각·충성 80·숨은 특성 공개)', () => {
    const s0 = base();
    const p = cabinetOf(s0).people.find((x) => x.group === '재계')!;
    const key: MeetKey = `p:${p.id}`;
    const s = addBond(s0, key, BOND_MINE);
    const q = cabinetOf(s).people.find((x) => x.id === p.id)!;
    expect(q.group).toBe('내각');
    expect(q.loyalty).toBeGreaterThanOrEqual(80);
    expect(q.known).toBe(true);
    expect(meetOf(s).mine).toContain(key);
    expect(bookList(s, '재계').some((w) => w.key === key)).toBe(true);
  });

  it('정적도 인연 100이면 협력 + 같은 얼굴의 내 사람이 내각에 들어옴', () => {
    const s0 = base();
    const rv = s0.officer.rivals[0];
    expect(rv).toBeTruthy();
    const n0 = cabinetOf(s0).people.length;
    const s = addBond(s0, `r:${rv.name}`, BOND_MINE);
    const r1 = s.officer.rivals[0];
    expect(r1.ally).toBe(true);
    expect(r1.mine).toBe(true);
    expect(r1.influence).toBe(0);
    const np = cabinetOf(s).people[cabinetOf(s).people.length - 1];
    expect(cabinetOf(s).people.length).toBe(n0 + 1);
    expect(np.name).toBe(rv.name);
    expect(np.group).toBe('내각');
  });

  it('모으기 보상: 내 사람 1명이면 루비·가속권', () => {
    const s0 = base();
    const p = cabinetOf(s0).people.find((x) => x.group === '언론')!;
    let s = addBond(s0, `p:${p.id}`, BOND_MINE);
    s = { ...s, goals: s.goals ?? { ruby: 0, day: 0, daily: [], bonus: false, streak: 0, total: {}, got: [] } };
    expect(bookReady(s)).toBeGreaterThan(0);
    const r0 = s.goals!.ruby;
    s = claimBook(s, 'mine1');
    expect(s.goals!.ruby).toBeGreaterThan(r0);
    expect(claimBook(s, 'mine1')).toBe(s);
  });

  it('대사·대답이 모든 자리에 있음', () => {
    for (const id of SPOT_IDS) {
      const d = SPOTS[id];
      expect(d.lines.every((x) => x.length > 5)).toBe(true);
      expect(d.favors.length).toBeGreaterThan(0);
    }
  });
});
