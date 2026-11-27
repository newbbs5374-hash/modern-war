import { describe, expect, it } from 'vitest';
import { advance, budgetPerDay, newGame, setRank, type GameState } from './state';
import * as C from './civ';
import { armyPower, contractMax } from './economy';
import { GOVS, techById, type GovId } from '../data/civ';

const H = 3600e3;
const withCiv = (s: GameState, gov: GovId | null, cards: string[] = []): GameState => ({ ...s, civ: { ...C.civOf(s), gov, cards } });
const armed = (s: GameState): GameState => ({ ...s, economy: { ...s.economy, army: { 보병: 10, 구축함: 2 }, power: 1000 } });

describe('체제·정책 카드가 실제로 작동(11-27)', () => {
  const base = armed(setRank(newGame('t', 'kr', 0, { seed: 3 }), 10));

  it('군사 정부·전투력 카드는 이미 가진 부대 전투력에 바로 붙고, 빼면 없어짐', () => {
    const none = withCiv(base, 'assembly');
    const junta = withCiv(base, 'junta');
    expect(armyPower(none)).toBe(1000);
    expect(armyPower(junta)).toBe(1100);
    const elite = withCiv(base, 'junta', ['군-정예']);
    expect(armyPower(elite)).toBe(1250);
    // 육군 카드는 육군 비중만큼만
    const land = armyPower(withCiv(base, 'assembly', ['군-징집']));
    expect(land).toBeGreaterThan(1000);
    expect(land).toBeLessThan(1100);
  });

  it('부대를 만들 때 체제 전투력을 굳히지 않음(두 번 붙지 않음)', () => {
    expect(C.civPowerMult(withCiv(base, 'junta'), '보병')).toBeCloseTo(C.civPowerMult(withCiv(base, 'assembly'), '보병'));
  });

  it('8가지 체제 모두 실제 숫자가 바뀜', () => {
    const me = base.player.countryId;
    const other = Object.keys(base.nations).find((x) => x !== me)!;
    const m = (s: GameState) => [C.researchRate(s), budgetPerDay(s, me), C.influenceMult(s, 'x' as never), C.civBuildSpeed(s, '구축함'), C.tradeEdge(s, other), contractMax(s), C.councilVotes(s, me), armyPower(s), C.districtHours(s, 'lab' as never), C.techCost(s, techById('m-crystal')!)].join('|');
    const seen = new Set<string>();
    for (const g of GOVS) seen.add(m(withCiv(base, g.id)));
    expect(seen.size).toBe(GOVS.length);
  });

  it('성지 회의: 갈륨 레이더 연구 2배 빨리', () => {
    const t = techById('m-crystal')!;
    expect(C.techCost(withCiv(base, 'sanctum'), t)).toBeCloseTo(C.techCost(withCiv(base, 'assembly'), t) / 2);
  });

  it('지금 받는 효과 요약에 체제와 카드가 다 나옴', () => {
    const rows = C.policySummary(withCiv(base, 'junta', ['경-학자']));
    const names = rows.map(([k]) => k).join(' ');
    expect(names).toMatch(/전투력/);
    expect(names).toMatch(/연구/);
    expect(names).toMatch(/민심/);
  });

  it('AI 나라 체제도 효과가 있음(군사 정부 전투력 · 예산)', () => {
    const s = withCiv(base, 'assembly');
    const c = C.civOf(s);
    const ai = Object.keys(c.aiGov).find((x) => x !== s.player.countryId)!;
    const junta = { ...s, civ: { ...c, aiGov: { ...c.aiGov, [ai]: 'junta' as GovId } } };
    expect(C.aiGovEff(junta)[ai]?.power).toBeCloseTo(0.1);
    const rep = { ...s, civ: { ...c, aiGov: { ...c.aiGov, [ai]: 'republic' as GovId } } };
    const asm = { ...s, civ: { ...c, aiGov: { ...c.aiGov, [ai]: 'assembly' as GovId } } };
    expect(budgetPerDay(rep, ai)).toBeGreaterThan(budgetPerDay(asm, ai));
    // 세계 시간이 흘러도 문제없음
    expect(() => advance(junta, 2 * H)).not.toThrow();
  });
});
