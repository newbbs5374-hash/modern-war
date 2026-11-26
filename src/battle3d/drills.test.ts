import { describe, expect, it } from 'vitest';
import { DRILLS, runDrill } from './drills';
import { runHeadless, headlessOutcome } from './sim';

describe('3D 훈련 전장', () => {
  it('모두 끝까지 돌고 점수 0~1', () => {
    const rows: string[] = [];
    for (const d of DRILLS) {
      const a = runDrill(d, 3);
      const b = runDrill(d, 3, { bot: true });
      rows.push(`${d.id.padEnd(10)} 명령없음 ${a.score.toFixed(2)} ${a.S.result?.win ? '승' : '패'} ${a.S.simT.toFixed(0)}s | 명령씀 ${b.score.toFixed(2)} ${b.S.result?.win ? '승' : '패'} ${b.S.simT.toFixed(0)}s`);
      expect(a.S.phase).toBe('end');
      expect(b.score).toBeGreaterThanOrEqual(0);
      expect(b.score).toBeLessThanOrEqual(1);
    }
    console.log(rows.join('\n'));
  });
  it('훈련 뒤에도 본 전투는 그대로(171.6초)', () => {
    runDrill(DRILLS[0], 1);
    const S = runHeadless();
    expect(headlessOutcome(S).win).toBe(true);
    expect(S.simT).toBeCloseTo(171.6, 1);
  });
});
