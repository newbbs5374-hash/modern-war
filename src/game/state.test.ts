import { describe, expect, it } from 'vitest';
import { cabBudget } from './cabinet';
import { civBudgetMult } from './civ';
import { firstTestGrant } from './testgrant';
import { CITIES } from '../data/cities';
import { COUNTRIES, startingRelation } from '../data/world';
import { advance, budgetPerDay, catchUp, claimSalary, gameClock, newGame, pendingCap, defShare, salaryPerDay, setRank, skip, troopsPerDay } from './state';
import { exportCode, importCode, loadGame, parseSave, saveGame, type Storage } from './save';

const HOUR = 60 * 60 * 1000;

describe('세계 데이터', () => {
  it('나라 36개(11-27 새 나라 18개), 도시 8~13개·점령 도시 5~6개(11-25, 11-26 미국·중국·러시아는 더 많음), 대륙 8개', () => {
    expect(COUNTRIES).toHaveLength(36);
    const big: Record<string, [number, number]> = { us: [20, 8], cn: [16, 7], ru: [15, 6] };
    for (const c of COUNTRIES) {
      const front = CITIES.filter((x) => x.home === c.id && x.front).length;
      if (big[c.id]) {
        expect(c.cities.length, c.id).toBe(big[c.id][0]);
        expect(front, c.id).toBe(big[c.id][1]);
        continue;
      }
      expect(c.cities.length).toBeGreaterThanOrEqual(8);
      expect(c.cities.length).toBeLessThanOrEqual(13);
      expect(front, c.id).toBeGreaterThanOrEqual(5);
      expect(front, c.id).toBeLessThanOrEqual(6);
    }
    expect(CITIES.filter((c) => c.home === 'kr' && c.front).map((c) => c.name)).toEqual(['서울', '부산', '대전', '전주', '강릉', '여수']);
    expect(new Set(COUNTRIES.map((c) => c.continent)).size).toBe(8);
  });
  it('시작 구도', () => {
    // 새 세계관: 모두 평화로 시작(같은 협약은 연합)
    expect(startingRelation('us', 'cn')).toBe('중립');
    expect(startingRelation('kr', 'kp')).toBe('중립');
    expect(startingRelation('ua', 'ru')).toBe('중립');
    expect(startingRelation('us', 'jp')).toBe('연합');
    expect(startingRelation('cn', 'kp')).toBe('연합');
    expect(startingRelation('de', 'ru')).toBe('중립');
    expect(startingRelation('tr', 'in')).toBe('중립');
  });
});

describe('세계 시계', () => {
  it('실제 1시간 = 게임 하루', () => {
    expect(gameClock(0)).toMatchObject({ dayNumber: 1, year: 2031, month: 3, day: 1, hour: 0, minute: 0 });
    expect(gameClock(HOUR)).toMatchObject({ dayNumber: 2, day: 2, hour: 0 });
    expect(gameClock(HOUR / 2)).toMatchObject({ dayNumber: 1, hour: 12 });
    expect(gameClock(31 * HOUR)).toMatchObject({ month: 4, day: 1 });
  });
});

describe('시간당 누적', () => {
  it('봉급·나라 예산·병력이 시간에 맞게 쌓인다(AI 판단 전 10분)', () => {
    const s0 = newGame('테스트', 'kr', 0);
    const s1 = advance(s0, HOUR / 6);
    expect(s1.player.pendingSalary).toBeCloseTo(salaryPerDay(s0) / 6);
    expect(s1.nations.kr.treasury - s0.nations.kr.treasury).toBeCloseTo(((22 * 10) / 6) * civBudgetMult(s0) * cabBudget(s0) * (1 - defShare(s0)), 1);
    // 11-26 국방 몫(예산 나누기 40%)은 국방비로
    expect((s1.nations.kr.def ?? 0) - (s0.nations.kr.def ?? 0)).toBeCloseTo(((22 * 10) / 6) * civBudgetMult(s0) * cabBudget(s0) * defShare(s0), 1); // 금융 센터·도시 특성·실제 시설(11/24) · 나라 특징 방산 수출(11/25)
    const t0 = s0.nations.kr.troops;
    expect(s1.nations.kr.troops).toBeCloseTo(t0 * Math.exp(-0.008 / 6) + (45 * 40) / 6);
  });
  it('봉급은 3시간이면 3일치', () => {
    const g = newGame('t', 'kr', 0);
    expect(advance(g, 3 * HOUR).player.pendingSalary).toBeCloseTo(salaryPerDay(g) * 3);
  });
  it('작게 여러 번 흘려도 한 번에 흘린 것과 같다', () => {
    let a = newGame('a', 'us', 0);
    for (let i = 0; i < 360; i++) a = advance(a, 20000);
    const b = advance(newGame('b', 'us', 0), 2 * HOUR);
    // 지지도(11-23)가 도시 민심·병력을 보고 나라 예산 배율을 정하는데, 민심·병력은 잘게 나눠 흘리면 아주 조금 달라짐 → 0.01% 안이면 같음
    expect(Math.abs(a.nations.us.treasury - b.nations.us.treasury) / b.nations.us.treasury).toBeLessThan(1e-4);
    expect(a.player.pendingSalary).toBeCloseTo(b.player.pendingSalary, 6);
    expect(a.world).toEqual(b.world);
  });
  it('받지 않은 봉급은 12시간치까지만 쌓인다', () => {
    const s = skip(newGame('t', 'kr', 0), 48 * HOUR);
    expect(s.player.pendingSalary).toBeCloseTo(pendingCap(s));
    expect(pendingCap(s)).toBeCloseTo(salaryPerDay(s) * 12);
  });
  it('받기', () => {
    const s = claimSalary(advance(newGame('t', 'kr', 0), 2.5 * HOUR));
    expect(s.player.salary).toBe(Math.floor(salaryPerDay(s) * 2.5));
    expect(s.player.pendingSalary).toBeCloseTo(0);
  });
  it('계급이 오르면 봉급이 오른다', () => {
    const s = advance(setRank(newGame('t', 'kr', 0), 10), HOUR);
    expect(s.player.pendingSalary).toBeCloseTo(3000);
  });
  it('꺼 둔 동안 따라잡기, 기기 시계가 거꾸로 가면 무시', () => {
    const s = catchUp(newGame('t', 'kr', 1000), 1000 + 5 * HOUR);
    expect(s.worldMs).toBe(5 * HOUR);
    const back = catchUp(s, 0);
    expect(back.worldMs).toBe(5 * HOUR);
  });
});

describe('저장/불러오기', () => {
  it('저장한 그대로 불러온다', () => {
    const mem = new Map<string, string>();
    const st: Storage = {
      getItem: (k) => mem.get(k) ?? null,
      setItem: (k, v) => void mem.set(k, v),
      removeItem: (k) => void mem.delete(k),
    };
    const s = firstTestGrant(advance(newGame('대장', 'de', 0), 7 * HOUR)); // 시험판 지급은 이미 받은 저장
    expect(saveGame(s, st)).toBe(true);
    expect(loadGame(st)).toEqual(s);
  });
  it('저장 코드 내보내기/들여오기(한글 이름 포함)', () => {
    const s = firstTestGrant(advance(newGame('대장', 'ua', 0), HOUR));
    expect(importCode(exportCode(s))).toEqual(s);
  });
  it('11-26 난이도: 한국을 뺀 나라는 더 강함(미국 > 중국 > 러시아)', () => {
    const g = newGame('대장', 'kr', 0);
    const t = (id: string) => g.nations[id].troops;
    expect(t('us')).toBeGreaterThan(t('cn'));
    expect(t('cn')).toBeGreaterThan(t('ru'));
    expect(budgetPerDay(g, 'us')).toBeGreaterThan(budgetPerDay(g, 'cn'));
    expect(budgetPerDay(g, 'cn')).toBeGreaterThan(budgetPerDay(g, 'ru'));
    expect(troopsPerDay(g, 'cn')).toBeGreaterThan(troopsPerDay(g, 'ru'));
  });
  it('11-26 난이도: 새 판은 시험판 자원을 받지 않고 적게 시작', () => {
    const s = advance(newGame('대장', 'kr', 0), HOUR);
    const back = importCode(exportCode(s))!;
    expect(back.player.salary).toBe(s.player.salary);
    expect(back.officer.testGrant).toBe(4);
    expect(newGame('대장', 'kr', 0).nations.kr.treasury).toBeLessThan(2000);
    expect(newGame('대장', 'kr', 0).officer.boosts).toBe(10);
  });
  it('시험판: 옛 저장(11-26 전)은 불러올 때 한 번만 자원을 받음', () => {
    const s0 = advance(newGame('대장', 'kr', 0), HOUR);
    const s = { ...s0, officer: { ...s0.officer, testGrant: undefined } };
    const once = importCode(exportCode(s))!;
    expect(once.player.salary).toBeGreaterThan(s.player.salary + 100_000);
    expect(once.officer.testGrant).toBe(4);
    expect(once.goals?.ruby ?? 0).toBeGreaterThanOrEqual(5000);
    expect(importCode(exportCode(once))).toEqual(once);
  });
  it('망가진 저장은 거부', () => {
    expect(parseSave('{}')).toBeNull();
    expect(parseSave('not json')).toBeNull();
    expect(importCode('@@@')).toBeNull();
  });
});
