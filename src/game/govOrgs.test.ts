import { describe, expect, it } from 'vitest';
import { newGame, type GameState } from './state';
import * as C from './cabinet';
import { MINISTRIES } from '../data/cabinet';
import { POSTS, agenciesOf } from '../data/staff';
import { NEEDS } from '../data/needs';
import { GOV_FACILITIES } from '../data/govFacilities';
import { buildGovFac, canBuildGovFac, govFacLevel } from './govFac';
import { cabinetTick, startTask } from './cabinetOps';

const rich = (s: GameState): GameState => ({ ...s, nations: { ...s.nations, kr: { ...s.nations.kr, treasury: 1e9 } } });
/** 관료를 내 사람으로 바로 들임 */
function staffUp(s: GameState, n: number): GameState {
  const c = C.cabinetOf(s);
  const ids = new Set(c.people.filter((p) => p.group === '관료' || p.group === '공공').slice(0, n).map((p) => p.id));
  return { ...s, cabinet: { ...c, people: c.people.map((p) => (ids.has(p.id) ? { ...p, group: '내각' as const, loyalty: 70 } : p)) } };
}

describe('부처 42곳(11-24 대장 요청 5번)', () => {
  it('부 21 + 처 3 = 장관 자리 24곳, 청 18곳은 모두 위 부가 있음', () => {
    expect(MINISTRIES.length).toBe(24);
    expect(MINISTRIES.filter((m) => m.kind === '처').length).toBe(3);
    const ag = POSTS.filter((p) => p.office === 'agency');
    expect(ag.length).toBe(18);
    for (const a of ag) expect(MINISTRIES.some((m) => m.id === a.parent)).toBe(true);
    expect(agenciesOf('mnd').map((p) => p.id).sort()).toEqual(['dapa', 'mma']);
    for (const m of MINISTRIES) expect(NEEDS[m.id], m.id).toBeTruthy();
    for (const p of POSTS) expect(NEEDS[p.id], p.id).toBeTruthy();
  });
  it('인물이 약 135명(+인재 명단이 차면 약 150명)(관료·공공기관 56명 더함)', () => {
    const s = newGame('t', 'kr', 0, { seed: 5 });
    const ppl = C.cabinetOf(s).people;
    expect(ppl.filter((p) => p.group === '관료' || p.group === '공공').length).toBe(56);
    expect(ppl.length).toBeGreaterThanOrEqual(130);
  });
  it('옛 저장에 관료가 없으면 채움(두 번 하지 않음)', () => {
    const s = newGame('t', 'kr', 0, { seed: 6 });
    const c = structuredClone(C.cabinetOf(s));
    c.people = c.people.filter((p) => p.group !== '관료' && p.group !== '공공');
    const n0 = c.people.length;
    C.migrateBureau(c, 'kr', 0);
    expect(c.people.length).toBe(n0 + 56);
    C.migrateBureau(c, 'kr', 0);
    expect(c.people.length).toBe(n0 + 56);
  });
  it('새 부처 9곳: 업무를 끝내면 자료대로 결과가 나옴', () => {
    let s = staffUp(rich(newGame('t', 'kr', 0, { seed: 22 })), 20);
    s = { ...s, player: { ...s.player, rankIndex: 15 } };
    const ids = ['mafra', 'mcee', 'mss', 'mpva', 'mogef', 'mcst', 'mpm', 'moleg', 'mfds'] as const;
    const mine = C.cabinetOf(s).people.filter((p) => p.group === '내각' && !p.seat && !p.post);
    ids.forEach((id, i) => (s = C.appointMinister(s, mine[i].id, id)));
    for (const id of ids) expect(C.ministerOf(C.cabinetOf(s), id), id).not.toBeNull();
    for (const id of ids) s = startTask(s, id, MINISTRIES.find((m) => m.id === id)!.tasks[0].id);
    s = { ...s, worldMs: s.worldMs + 7 * 3600e3 };
    s = cabinetTick(s, 60e3);
    expect(Object.keys(C.cabinetOf(s).tasks).length).toBe(0);
    const log = C.cabinetOf(s).log.join('\n');
    expect(log).toContain('✅ 기후에너지환경부: 자원 +');
    expect(log).toContain('✅ 인사혁신처: 인재 명단에 🔵우수 후보');
    expect(C.cabinetOf(s).log.filter((l) => l.startsWith('✅') && l.endsWith(': ')).length).toBe(0);
  });
  it('청장은 위 부 장관이 있으면 힘이 더 남', () => {
    let s = staffUp(rich(newGame('t', 'kr', 0, { seed: 23 })), 6);
    s = { ...s, player: { ...s.player, rankIndex: 15 } };
    const [a, b] = C.cabinetOf(s).people.filter((p) => p.group === '내각');
    s = C.appointPost(s, a.id, 'mma');
    const p0 = C.postPower(s, 'mma');
    s = C.appointMinister(s, b.id, 'mnd');
    expect(C.postPower(s, 'mma')).toBeGreaterThan(p0);
  });
  it('소속 시설: 주인 자리가 차야 짓고, 단계마다 효과', () => {
    let s = staffUp(rich(newGame('t', 'kr', 0, { seed: 24 })), 4);
    s = { ...s, player: { ...s.player, rankIndex: 15 } };
    expect(GOV_FACILITIES.length).toBe(57);
    expect(canBuildGovFac(s, 'kcgacademy')).toContain('청장');
    const p = C.cabinetOf(s).people.find((x) => x.group === '내각')!;
    s = C.appointPost(s, p.id, 'kcg');
    const sec0 = C.postEff(s, 'sec');
    expect(canBuildGovFac(s, 'kcgacademy')).toBeNull();
    s = buildGovFac(s, 'kcgacademy');
    s = buildGovFac(s, 'kcgacademy');
    expect(govFacLevel(s, 'kcgacademy')).toBe(2);
    expect(C.postEff(s, 'sec')).toBeCloseTo(sec0 + 1, 5);
    s = buildGovFac(s, 'kcgacademy');
    s = buildGovFac(s, 'kcgacademy');
    s = buildGovFac(s, 'kcgacademy');
    expect(govFacLevel(s, 'kcgacademy')).toBe(5);
    expect(canBuildGovFac(s, 'kcgacademy')).toBe('다 키웠어요');
  });
  it('고향(익산·여수·순천)에 시설 8곳', () => {
    expect(GOV_FACILITIES.filter((f) => [8, 9, 10].includes(f.city)).length).toBe(10);
  });
});
