// 7단계: 부관 돌보기 · 훈련 숙련도 · 날씨/적 지휘관 · 총사령관 외교 · 승리 유지
import { describe, expect, test } from 'vitest';
import { advance, newGame, type GameState } from './state';
import { canGift, claimErrand, debugAddAide, giftAide, masteryLevel, readyAides, sendAide, trainAide, featuredTraining } from './officer';
import { canDiplo, diploChance, doDiplo, COMMAND_TOP } from './command';
import { checkVictory, HOLD_DAYS } from './victory';
import { createGridBattle } from '../battle/grid';
import { weatherOf } from '../battle/spec';
import { CITIES } from '../data/cities';
import { COUNTRIES } from '../data/world';

const H = 3600e3;
const rich = (s: GameState): GameState => ({ ...s, player: { ...s.player, salary: 1e6 } });
const withAide = () => rich(debugAddAide(newGame('t', 'kr', 0, { seed: 3 })));

describe('부관 돌보기', () => {
  test('선물은 하루 한 번, 인연 +8, 봉급을 씀', () => {
    const s = withAide();
    const a = s.officer.aides[0];
    const g = giftAide(s, a.id);
    expect(g.officer.aides[0].bond).toBe(a.bond + 8);
    expect(g.player.salary).toBeLessThan(s.player.salary);
    expect(canGift(g, a.id)).toBeTruthy();
    expect(giftAide(g, a.id)).toBe(g);
  });
  test('특별 훈련은 경험을 줌', () => {
    const s = withAide();
    const t = trainAide(s, s.officer.aides[0].id);
    const a = t.officer.aides[0];
    expect(a.level * 100 + a.exp).toBeGreaterThan(100);
  });
  test('심부름 중에는 전투에 못 나가고, 끝나면 보상', () => {
    const s = withAide();
    const id = s.officer.aides[0].id;
    let e = sendAide(s, id, '보급 조달');
    expect(readyAides(e.officer, e.worldMs)).toHaveLength(0);
    expect(claimErrand(e, id).text).toBe('');
    e = advance(e, 3 * H + 1000);
    const before = e.player.salary;
    const r = claimErrand(e, id);
    expect(r.state.player.salary).toBeGreaterThan(before);
    expect(r.state.officer.aides[0].errand).toBeNull();
  });
});

describe('훈련 숙련도', () => {
  test('횟수에 따라 1~5단계', () => {
    expect(masteryLevel(0)).toBe(1);
    expect(masteryLevel(5)).toBe(2);
    expect(masteryLevel(60)).toBe(5);
    expect(masteryLevel(999)).toBe(5);
  });
  test('오늘의 훈련은 계급에 맞는 것', () => {
    expect(typeof featuredTraining(0, 0)).toBe('string');
  });
});

describe('전투 다양화', () => {
  test('날씨는 정해진 값 중 하나, 같은 seed면 같음', () => {
    for (let i = 0; i < 30; i++) {
      expect(['맑음', '밤', '비', '안개', '눈']).toContain(weatherOf(i));
      expect(weatherOf(i)).toBe(weatherOf(i));
    }
  });
  test('섬멸전엔 적 지휘관이 나오고 이름에 상대 나라가 붙음', () => {
    const b = createGridBattle({ goal: 'eliminate', difficulty: 1, rank: 3, stats: {}, aides: [], seed: 5, enemy: '북한군' });
    const boss = b.units.filter((u) => u.boss);
    expect(boss).toHaveLength(1);
    expect(boss[0].name).toContain('북한군');
  });
});

describe('총사령관 외교', () => {
  const top = (s: GameState): GameState => ({ ...s, player: { ...s.player, rankIndex: COMMAND_TOP } });
  test('총사령관 전에는 못 함', () => {
    const s = newGame('t', 'kr', 0, { seed: 3 });
    expect(canDiplo(s, 'us', '연합 제안')).toBeTruthy();
  });
  test('한 번 하면 대기 시간, 확률은 0~1', () => {
    const s = top(newGame('t', 'kr', 0, { seed: 3 }));
    const other = COUNTRIES.find((c) => c.id !== 'kr' && !canDiplo(s, c.id, '선전포고'))!;
    const p = diploChance(s, other.id, '연합 제안');
    expect(p).toBeGreaterThanOrEqual(0);
    expect(p).toBeLessThanOrEqual(1);
    const r = doDiplo(s, other.id, '선전포고');
    expect(r.ok).toBe(true);
    expect(canDiplo(r.state, other.id, '휴전 제안')).toBeTruthy();
  });
});

describe('승리 유지', () => {
  test(`조건을 ${HOLD_DAYS}일 지켜야 이김`, () => {
    let s = newGame('t', 'kr', 0, { seed: 3 });
    s = { ...s, player: { ...s.player, rankIndex: COMMAND_TOP }, world: { ...s.world, owner: Object.fromEntries(CITIES.map((c) => [c.id, 'kr'])) } };
    s = checkVictory(s);
    expect(s.ending).toBeFalsy();
    expect(s.officer.winSinceMs).toBe(0);
    s = checkVictory({ ...s, worldMs: (HOLD_DAYS * 24 - 1) * H });
    expect(s.ending).toBeFalsy();
    s = checkVictory({ ...s, worldMs: HOLD_DAYS * 24 * H });
    expect(s.ending?.kind).toBe('정복 승리');
  });
});
