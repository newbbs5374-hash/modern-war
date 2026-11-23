import { describe, expect, it } from 'vitest';
import { advance, newGame, setRank, type GameState } from './state';
import { canProduce, produce } from './economy';
import { gainStatExp, newOfficer } from './officer';
import { grantTestResources } from './testgrant';
import { addReports, dismissReport, reportsOf } from './report';
import { statExpNeed } from '../data/officers';
import { parseSave } from './save';
import { useBoost } from './boost';

const H = 3600e3;
const rich = (s: GameState): GameState => grantTestResources({ ...s, nations: { ...s.nations, kr: { ...s.nations.kr, treasury: 1e7 } } });

describe('스탯 경험치', () => {
  it('경험치가 차면 스탯 +1, 넘치는 건 남고, 상한에서 멈춤', () => {
    const o = newOfficer(1);
    expect(o.stats.체력).toBe(8);
    expect(gainStatExp(o, '체력', statExpNeed(8) - 1, 20)).toBe(0);
    expect(o.stats.체력).toBe(8);
    expect(gainStatExp(o, '체력', 1 + 5, 20)).toBe(1);
    expect(o.stats.체력).toBe(9);
    expect(o.statExp?.체력).toBe(5);
    expect(gainStatExp(o, '체력', 99999, 20)).toBe(11);
    expect(o.stats.체력).toBe(20);
    expect(o.statExp?.체력).toBe(0);
  });
  it('옛 저장의 소수점 스탯은 정수 + 경험치로 바뀜', () => {
    const s = newGame('t', 'kr', 0, { seed: 3 });
    const old = JSON.parse(JSON.stringify(s));
    delete old.officer.statExp;
    old.officer.stats.사격 = 12.5;
    const p = parseSave(JSON.stringify(old))!;
    expect(p.officer.stats.사격).toBe(12);
    expect(p.officer.statExp?.사격).toBe(Math.round(0.5 * statExpNeed(12)));
  });
});

describe('부대 모집 + 부관 보고', () => {
  it('소위도 보병 모집 가능, 고급 병과는 계급이 되어야 함', () => {
    const s = rich(newGame('t', 'kr', 0, { seed: 4 }));
    expect(canProduce(s, '보병')).toBeNull();
    expect(canProduce(s, '항공모함')).toMatch(/연구/); // 11-24: 호칭 잠금 없음, 연구만
  });
  it('모집이 끝나면 "보병 모집이 완료되었습니다" 보고, 누르면 사라짐', () => {
    let s = rich(newGame('t', 'kr', 0, { seed: 5 }));
    s = produce(s, '보병');
    expect(s.economy.queue.length).toBe(1);
    const before = s;
    s = addReports(before, advance(s, 2 * H));
    expect(s.economy.army.보병).toBe(1);
    expect(reportsOf(s).some((r) => r.text.includes('보병 모집이 완료되었습니다'))).toBe(true);
    const n = reportsOf(s).length;
    expect(reportsOf(dismissReport(s)).length).toBe(n - 1);
  });
  it('가속권으로 바로 끝내도 보고', () => {
    let s = rich(newGame('t', 'kr', 0, { seed: 6 }));
    s = produce(s, '특수부대');
    const id = s.economy.queue[0].id;
    const b = s;
    s = addReports(b, advance(useBoost(s, { kind: 'queue', id }, 99), 1000));
    expect(s.economy.army.특수부대).toBe(1);
    expect(reportsOf(s)[0].text).toContain('특수부대 모집이 완료');
  });
  it('호칭이 오르면 보고', () => {
    const s = newGame('t', 'kr', 0, { seed: 7 });
    const r = addReports(s, setRank(s, 1));
    expect(reportsOf(r)[0].text).toContain('불리게');
  });
});
