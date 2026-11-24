import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { newGame, advance, type GameState } from './state';
import {
  appointMinister,
  appointVice,
  cabinetOf,
  canAppointMinister,
  ministerOf,
  ministryPower,
  peopleCount,
  recruit,
  recruitCost,
  cabBudget,
  HEARING,
} from './cabinet';
import { appointPersonGeneral, bestFor, cabinetTick, hearingChance, startTask } from './cabinetOps';
import { generalSlots } from '../data/officers';

const H = 3600e3;
const rich = (s: GameState): GameState => ({ ...s, nations: { ...s.nations, kr: { ...s.nations.kr, treasury: 1e9 } } });

// 청문회 시험은 시험판 생략(HEARING.skip)을 끄고 해요
beforeAll(() => {
  HEARING.skip = false;
});
afterAll(() => {
  HEARING.skip = true;
});

describe('인물·부처', () => {
  it('새 게임에 사람이 100명 가까이, 이름은 겹치지 않음', () => {
    const s = newGame('t', 'kr', 0, { seed: 3, origin: 'econ' });
    const c = cabinetOf(s);
    expect(peopleCount(s)).toBeGreaterThanOrEqual(90);
    expect(new Set(c.people.map((p) => p.name)).size).toBe(c.people.length);
    expect(c.people.some((p) => p.buddy)).toBe(true);
    for (const p of c.people) for (const v of Object.values(p.stats)) expect(v).toBeGreaterThan(0);
  });
  it('영입 → 장관 후보 청문회 → 결과 · 차관 · 부처 업무', () => {
    let s = rich(newGame('t', 'kr', 0, { seed: 4 }));
    const pool = cabinetOf(s).people.filter((p) => p.group === '인재');
    const p = pool[0];
    const before = s.nations.kr.treasury;
    s = recruit(s, p.id);
    expect(s.nations.kr.treasury).toBe(before - recruitCost(s, p));
    expect(cabinetOf(s).people.find((x) => x.id === p.id)!.group).toBe('내각');
    expect(canAppointMinister(s, p.id, 'mof')).toBeNull();
    expect(hearingChance(s, cabinetOf(s).people.find((x) => x.id === p.id)!)).toBeGreaterThan(0.1);
    s = appointMinister(s, p.id, 'mof');
    expect(cabinetOf(s).hearing?.pid).toBe(p.id);
    s = advance(s, H);
    expect(cabinetOf(s).hearing).toBeNull();
    const q = pool[1];
    s = appointVice(recruit(s, q.id), q.id, 'mof');
    expect(ministryPower(s, 'mof')).toBeGreaterThan(0);
    expect(cabBudget(s)).toBeGreaterThan(1);
    s = startTask(s, 'mof', 'bond');
    const t0 = s.nations.kr.treasury;
    s = advance(s, 3 * H);
    expect(cabinetOf(s).tasks.mof).toBeUndefined();
    expect(s.nations.kr.treasury).toBeGreaterThan(t0);
    expect(bestFor(s, 'mnd').length).toBeGreaterThan(0);
    void ministerOf;
  });
  it('인재 명단은 시간마다 채워지고 20명을 넘지 않음', () => {
    let s = newGame('t', 'kr', 0, { seed: 5 });
    s = advance(s, 30 * H);
    const pool = cabinetOf(s).people.filter((p) => p.group === '인재');
    expect(pool.length).toBeLessThanOrEqual(20);
    expect(pool.length).toBeGreaterThanOrEqual(12);
  });
  it('사람을 장군으로: 병과마다 한 명, 자리 수 제한', () => {
    let s = rich(newGame('t', 'kr', 0, { seed: 6 }));
    s = { ...s, player: { ...s.player, rankIndex: 6 } };
    expect(generalSlots(6)).toBe(2);
    const [a, b, d] = cabinetOf(s).people.filter((p) => p.group === '인재');
    s = recruit(recruit(recruit(s, a.id), b.id), d.id);
    s = appointPersonGeneral(s, a.id, '합참');
    expect(s.officer.generals.length).toBe(1);
    expect(appointPersonGeneral(s, b.id, '합참').officer.generals.length).toBe(1);
    s = appointPersonGeneral(s, b.id, '육군');
    expect(s.officer.generals.length).toBe(2);
    expect(appointPersonGeneral(s, d.id, '해군').officer.generals.length).toBe(2);
  });
  it('이틀 흘러도 오류 없이', () => {
    let s = newGame('t', 'kr', 0, { seed: 7, origin: 'general' });
    s = cabinetTick(s, H);
    s = advance(s, 48 * H);
    expect(cabinetOf(s).people.length).toBeGreaterThan(50);
  });
});

describe('장관 임명 조건(11-24)', () => {
  it('영입 값은 몸값 그대로, 영입 → 장관 청문회 → 자리', async () => {
    const { newGame, advance } = await import('./state');
    const C = await import('./cabinet');
    let s = newGame('t', 'kr', 0, { seed: 1 });
    const p = C.cabinetOf(s).people.find((x) => x.group === '인재')!;
    expect(C.recruitCost(s, p)).toBe(p.pay);
    expect(C.canAppointMinister(s, p.id, 'mnd')).toMatch(/영입/);
    s = C.recruit(s, p.id);
    s = C.appointMinister(s, p.id, 'mnd');
    const q = C.cabinetOf(s).people.find((x) => x.group === '인재')!;
    s = C.recruit(s, q.id);
    expect(C.canAppointMinister(s, q.id, 'mofa')).toMatch(/청문회가 끝난 뒤/);
    s = advance(s, 0.6 * 3600e3);
    expect(C.cabinetOf(s).hearing).toBeNull();
  });
});

describe('청문회 가속권(11-24)', () => {
  it('가속권 1장 → 청문회 바로 결과', async () => {
    const { newGame } = await import('./state');
    const C = await import('./cabinet');
    const B = await import('./boost');
    let s = newGame('t', 'kr', 0, { seed: 2 });
    s = { ...s, officer: { ...s.officer, boosts: 3 } };
    const p = C.cabinetOf(s).people.find((x) => x.group === '인재')!;
    s = C.appointMinister(C.recruit(s, p.id), p.id, 'mnd');
    expect(C.cabinetOf(s).hearing).not.toBeNull();
    expect(B.boostsToFinish(s, { kind: 'hearing' })).toBe(1);
    s = B.useBoost(s, { kind: 'hearing' }, 1);
    expect(C.cabinetOf(s).hearing).toBeNull();
    expect(B.boostsOf(s)).toBe(2);
    expect(s.world.events.some((e) => e.text.includes('청문회'))).toBe(true);
  });
});

describe('얼굴 겹침(11-24)', () => {
  it('한 화면(인재+내각, 무리별 명단) 안에서는 같은 얼굴이 없음', async () => {
    const { newGame, advance } = await import('./state');
    const C = await import('./cabinet');
    const { faceTag } = await import('../data/faces');
    for (const cid of ['kr', 'us']) {
      let s = newGame('t', cid, 0, { seed: 3 });
      for (let d = 0; d < 3; d++) {
        s = advance(s, 24 * 3600e3);
        const seen = new Set<string>();
        for (const p of C.cabinetOf(s).people) {
          const g = p.group === '인재' || p.group === '내각' ? 'cab' : p.group;
          const k = `${g}|${faceTag(p.country, p.eth)}-${p.sex}-${p.face}`;
          expect(seen.has(k)).toBe(false);
          seen.add(k);
        }
      }
    }
  });
});
