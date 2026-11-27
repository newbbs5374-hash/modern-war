import { describe, expect, it } from 'vitest';
import { newGame } from './state';
import { cityCiv } from './civ';
import { act, secOf, secTick, SEC_DUE_MS, SAB_LOYALTY } from './security';
import { logBattle, logOf, medals, winRate } from './battleLog';
import { FRONT } from '../data/cities';

const occupied = () => {
  const s = newGame('t', 'kr', 0, { seed: 5 });
  const city = FRONT.find((c) => c.home === 'jp')!.id;
  s.world.owner[city] = 'kr';
  return { s, city };
};

describe('점령지 치안 작전', () => {
  it('점령 도시가 있으면 저항 조직이 생기고, 내버려 두면 민심이 깎인다', () => {
    const { s, city } = occupied();
    let cur = secTick(s);
    cur = secTick({ ...cur, worldMs: secOf(cur).nextMs + 1 });
    expect(secOf(cur).list.length).toBe(1);
    expect(secOf(cur).list[0].city).toBe(city);
    const before = cityCiv(cur, city).loyalty;
    const size = secOf(cur).list[0].size;
    const after = secTick({ ...cur, worldMs: cur.worldMs + SEC_DUE_MS + 1 });
    expect(secOf(after).hit).toBe(1);
    expect(cityCiv(after, city).loyalty).toBe(Math.max(0, before - SAB_LOYALTY * size));
  });
  it('점령 도시가 없으면 생기지 않는다', () => {
    const s = newGame('t', 'kr', 0, { seed: 5 });
    let cur = secTick(s);
    cur = secTick({ ...cur, worldMs: secOf(cur).nextMs + 1 });
    expect(secOf(cur).list.length).toBe(0);
  });
  it('소탕·회유는 성공하면 조직이 사라진다', () => {
    const { s } = occupied();
    let cur = secTick(s);
    cur = secTick({ ...cur, worldMs: secOf(cur).nextMs + 1 });
    const id = secOf(cur).list[0].id;
    let done = false;
    for (let i = 0; i < 30 && !done; i++) {
      const r = act(cur, id, i % 2 ? 'talk' : 'sweep');
      cur = r.state;
      done = r.ok;
    }
    expect(done).toBe(true);
    expect(secOf(cur).list.length).toBe(0);
    expect(secOf(cur).cleared).toBe(1);
  });
});

describe('전투 기록관', () => {
  it('전적 · 연승 · 훈장을 센다', () => {
    let s = newGame('t', 'kr', 0, { seed: 1 });
    for (let i = 0; i < 3; i++) s = logBattle(s, { kind: '대전투', title: 'x', win: true, stars: 3, direct: true });
    s = logBattle(s, { kind: '작전', title: 'y', win: false, stars: 0, direct: false });
    const b = logOf(s);
    expect([b.wins, b.losses, b.streak, b.best]).toEqual([3, 1, 0, 3]);
    expect(winRate(s)).toBeCloseTo(0.75);
    const got = medals(s).filter((m) => m.got).map((m) => m.id);
    expect(got).toEqual(expect.arrayContaining(['first', 's3', 'cap']));
  });
});
