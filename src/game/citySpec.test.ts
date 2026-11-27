import { describe, expect, it } from 'vitest';
import { domEff, withDom } from './domestic';
import { SPECS, SPEC_BELT_MUL, beltOn, canSpec, liveSpecs, specCost, upSpec } from './citySpec';
import { newGame } from './state';
import { myCityIds } from './zones';

function rich() {
  const s = withDom(newGame('시험', 'kr', 0, { seed: 3 }), {});
  s.nations.kr.treasury = 1e9;
  return s;
}

describe('도시 특화 나무', () => {
  it('길은 5개, 단계마다 값이 오른다', () => {
    const s = rich();
    const c = myCityIds(s)[0];
    expect(SPECS).toHaveLength(5);
    expect(specCost(s, c, 2)).toBeGreaterThan(specCost(s, c, 1));
    expect(specCost(s, c, 3)).toBeGreaterThan(specCost(s, c, 2));
  });
  it('1단계를 올리면 예산이 줄고 나라 효과가 붙는다', () => {
    let s = rich();
    const c = myCityIds(s)[0];
    const before = domEff(s, 'research');
    const cost = specCost(s, c, 1);
    s = upSpec(s, c, 'sci');
    expect(liveSpecs(s)).toEqual([[c, { path: 'sci', lv: 1 }]]);
    expect(s.nations.kr.treasury).toBe(1e9 - cost);
    expect(domEff(s, 'research') - before).toBeCloseTo(0.014);
  });
  it('예산이 모자라거나 남의 도시면 안 된다', () => {
    const s = rich();
    const c = myCityIds(s)[0];
    s.nations.kr.treasury = 0;
    expect(canSpec(s, c, 'ind')).toBe('나라 예산이 모자라요');
    expect(upSpec(s, c, 'ind')).toBe(s);
    expect(canSpec(rich(), 'us-0', 'ind')).toBe('내 도시가 아니에요');
  });
  it('길을 바꾸면 1단계부터 다시', () => {
    let s = rich();
    const c = myCityIds(s)[0];
    s = upSpec(s, c, 'fin');
    s = upSpec(s, c, 'tour');
    expect(liveSpecs(s)[0][1]).toEqual({ path: 'tour', lv: 1 });
  });
  it('같은 길 3곳이면 벨트 덤', () => {
    let s = rich();
    const cs = myCityIds(s).slice(0, 3);
    const base = domEff(s, 'res');
    for (const c of cs.slice(0, 2)) s = upSpec(s, c, 'ind');
    expect(beltOn(s, 'ind')).toBe(false);
    expect(domEff(s, 'res') - base).toBeCloseTo(0.024);
    s = upSpec(s, cs[2], 'ind');
    expect(beltOn(s, 'ind')).toBe(true);
    expect(domEff(s, 'res') - base).toBeCloseTo(0.036 * SPEC_BELT_MUL);
  });
  it('빼앗긴 도시의 특화는 효과가 없다', () => {
    let s = rich();
    const c = myCityIds(s)[1];
    s = upSpec(s, c, 'mil');
    s = { ...s, world: { ...s.world, owner: { ...s.world.owner, [c]: 'kp' } } };
    expect(liveSpecs(s)).toHaveLength(0);
  });
});
