import { describe, expect, it } from 'vitest';
import { newGame, setRank, type GameState } from './state';
import { officerTick, type Aide } from './officer';
import { appointGeneral, canAppoint, canSchool, generalBuildMult, generalPowerMult, loyaltyOf, startSchool, NEGLECT_MS } from './loyal';
import { BLOCK_AT, rivalBlock, rivalsView } from './rivals';
import { doAct } from './people';
import { PROMOTION } from '../data/officers';

const H = 3600e3;
const aide = (x: Partial<Aide> = {}): Aide => ({ id: 99, name: '테스트', specialty: '저격', level: 5, exp: 0, bond: 60, loyalty: 70, ...x });
function withAide(s: GameState, a: Aide): GameState {
  return { ...s, officer: { ...s.officer, aides: [a] }, player: { ...s.player, salary: 100000 } };
}
/** 판단을 n번(15분씩) */
function ticks(s: GameState, n: number): GameState {
  for (let i = 0; i < n; i++) {
    s = { ...s, worldMs: s.worldMs + 15 * 60e3 };
    officerTick(s, s.world.owner, 15 * 60e3);
  }
  return s;
}

describe('부관 인연·충성', () => {
  it('충성은 옛 저장에서 인연으로 채워짐', () => {
    expect(loyaltyOf(aide({ loyalty: undefined, bond: 40 }))).toBe(60);
  });
  it('오래 돌보지 않으면 인연과 충성이 줄고, 충성이 아주 낮으면 떠남', () => {
    let s = withAide(newGame('t', 'kr', 0, { seed: 3 }), aide({ bond: 2, loyalty: 16, seenMs: 0 }));
    s = { ...s, worldMs: NEGLECT_MS + H, officer: { ...s.officer, trust: 0 } };
    s = ticks(s, 8);
    expect(s.officer.aides.length).toBe(0);
  });
  it('인연이 깊고 신뢰가 높으면 충성이 오름', () => {
    let s = withAide(newGame('t', 'kr', 0, { seed: 3 }), aide({ bond: 90, loyalty: 50 }));
    s = { ...s, officer: { ...s.officer, trust: 80 } };
    s = ticks(s, 40);
    expect(loyaltyOf(s.officer.aides[0])).toBeGreaterThan(55);
  });
});

describe('장군 교육 → 임명', () => {
  it('조건이 안 되면 교육 못 감', () => {
    const s = withAide(setRank(newGame('t', 'kr', 0, { seed: 4 }), 7), aide({ level: 3 }));
    expect(canSchool(s, 99)).toContain('Lv.5');
  });
  it('교육 6시간 → 병과 골라 임명 → 그 병과 효율이 오름', () => {
    let s = withAide(setRank(newGame('t', 'kr', 0, { seed: 4 }), 7), aide());
    expect(canSchool(s, 99)).toBeNull();
    s = startSchool(s, 99);
    expect(s.officer.aides[0].school).toBeTruthy();
    expect(canAppoint(s, 99)).not.toBeNull();
    s = ticks(s, 6 * 4 + 1);
    expect(s.officer.aides[0].schooled).toBe(true);
    const before = generalPowerMult(s, '구축함');
    s = appointGeneral(s, 99, '해군');
    expect(s.officer.aides.length).toBe(0);
    expect(s.officer.generals[0].from).toBe('부관 임명');
    expect(generalPowerMult(s, '구축함')).toBeGreaterThan(before);
    expect(generalBuildMult(s, '구축함')).toBeGreaterThan(1);
    expect(generalPowerMult(s, '보병')).toBe(1);
  });
});

describe('정적', () => {
  it('정적 12명은 역할이 다르고, 얼굴이 겹치지 않고, 영향력이 쌓임', () => {
    let s = newGame('t', 'kr', 0, { seed: 5 });
    const v0 = rivalsView(s);
    expect(v0.length).toBe(12);
    expect(new Set(v0.map((x) => x.role)).size).toBe(12);
    expect(new Set(v0.map((x) => x.faceKey)).size).toBe(12);
    expect(v0.every((x) => x.faceKey?.startsWith('face-kr-'))).toBe(true);
    const us = rivalsView(newGame('t', 'us', 0, { seed: 5 }));
    expect(us.every((x) => x.faceKey?.startsWith('face-us-'))).toBe(true);
    s = ticks(s, 4 * 24);
    expect(rivalsView(s)[0].influence).toBeGreaterThan(v0[0].influence);
  });
  it('영향력 70 넘는 정적이 있으면 마지막 승급이 막힘, 견제로 낮춤', () => {
    let s = setRank(newGame('t', 'kr', 0, { seed: 6 }), PROMOTION.length - 1);
    s = { ...s, officer: { ...s.officer, intel: 100, rivals: s.officer.rivals.map((r, i) => ({ ...r, influence: i === 0 ? BLOCK_AT + 2 : 10 })) } };
    expect(rivalBlock(s)).not.toBeNull();
    s = doAct(s, { kind: 'rival', name: s.officer.rivals[0].name }, 'press').state;
    expect(rivalBlock(s)).toBeNull();
  });
  it('회유 3번 성공하면 내 편', () => {
    let s = newGame('t', 'kr', 0, { seed: 7 });
    s = { ...s, player: { ...s.player, salary: 1e6 }, officer: { ...s.officer, rivals: s.officer.rivals.map((r) => ({ ...r, woo: 2, influence: 0 })), stats: { ...s.officer.stats, 정치: 100 } } };
    const name = s.officer.rivals[0].name;
    for (let d = 0; d < 10 && !s.officer.rivals[0].ally; d++) {
      s = doAct(s, { kind: 'rival', name }, 'woo').state;
      s = { ...s, worldMs: s.worldMs + H };
    }
    expect(s.officer.rivals[0].ally).toBe(true);
  });
});
