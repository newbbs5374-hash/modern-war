import { describe, expect, it } from 'vitest';
import { runHeadless, defaultDeploy, BUDGET, DEF } from './sim';

describe('3D 전투 계산기(철벽 작전 v5.4 그대로)', () => {
  it('기본 배치, 명령 없이 두면 171.6초에 아슬아슬하게 이긴다', () => {
    const S = runHeadless();
    expect(S.result?.win).toBe(true);
    expect(S.result!.t.toFixed(1)).toBe('171.6');
  });
  it('기본 배치는 예산 460 안', () => {
    const d = defaultDeploy();
    expect(d.reduce((s, x) => s + DEF[x.kind].cost, 0)).toBeLessThanOrEqual(BUDGET);
  });
  it('같은 배치면 같은 결과', () => {
    expect(runHeadless().result).toEqual(runHeadless().result);
  });
});
