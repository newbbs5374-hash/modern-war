import { describe, expect, it } from 'vitest';
import { advance, defOf, newGame, setRank, type GameState } from './state';
import { canUpgrade, isDefBuilding, produce, upgradeFacility } from './economy';
import { parseSave } from './save';

const H = 3600e3;

describe('국방비와 나라 예산 나누기(11-26)', () => {
  it('새 판은 국방비를 따로 갖고, 수입의 국방 몫이 국방비로 들어감', () => {
    const s = newGame('t', 'kr', 0, { seed: 1 });
    expect(defOf(s)).toBeGreaterThan(0);
    const a = advance(s, H / 6);
    expect(defOf(a)).toBeGreaterThan(defOf(s));
  });
  it('부대 만들기는 국방비만 쓰고 나라 예산은 그대로', () => {
    let s: GameState = setRank(newGame('t', 'kr', 0, { seed: 3 }), 6);
    s = { ...s, nations: { ...s.nations, kr: { ...s.nations.kr, def: 1e6 } }, economy: { ...s.economy, stock: { ...s.economy.stock, 강철: 50, 석유: 20 } } };
    const t0 = s.nations.kr.treasury;
    const d0 = defOf(s);
    const a = produce(s, '보병');
    expect(a.economy.queue.length).toBe(1);
    expect(a.nations.kr.treasury).toBe(t0);
    expect(defOf(a)).toBeLessThan(d0);
    // 국방비가 없으면 못 만듦
    expect(produce({ ...s, nations: { ...s.nations, kr: { ...s.nations.kr, def: 0 } } }, '보병').economy.queue.length).toBe(0);
  });
  it('국방 시설은 국방비, 다른 시설은 나라 예산', () => {
    expect(isDefBuilding('방공포대')).toBe(true);
    expect(isDefBuilding('군수공장')).toBe(false);
    let s: GameState = setRank(newGame('t', 'kr', 0, { seed: 3 }), 10);
    const fac = { ...s.economy.facilities };
    for (const k of Object.keys(fac) as Array<keyof typeof fac>) fac[k] = { ...fac[k], exp: 1e6 };
    s = { ...s, economy: { ...s.economy, facilities: fac }, nations: { ...s.nations, kr: { ...s.nations.kr, treasury: 1e7, def: 1e7 } } };
    expect(canUpgrade(s, '군수공장')).toBeNull();
    const a = upgradeFacility(s, '군수공장');
    expect(a.nations.kr.treasury).toBeLessThan(1e7);
    expect(defOf(a)).toBe(1e7);
    const def = (['철도망', '군항', '공군기지'] as const).find((id) => !canUpgrade(s, id))!;
    const b = upgradeFacility(s, def);
    expect(b.nations.kr.treasury).toBe(1e7);
    expect(defOf(b)).toBeLessThan(1e7);
  });
  it('옛 저장은 금고의 국방 몫을 국방비로 옮김', () => {
    const s = newGame('t', 'kr', 0, { seed: 1 });
    const old = { ...s, nations: { ...s.nations, kr: { treasury: 10000, troops: s.nations.kr.troops } } };
    const l = parseSave(JSON.stringify(old))!;
    expect(l.nations.kr.def).toBeCloseTo(4000);
    expect(l.nations.kr.treasury).toBeCloseTo(6000);
  });
});
