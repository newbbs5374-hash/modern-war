import { describe, expect, it } from 'vitest';
import { DRILLS, runDrill } from './drills';
import { DEF, TABS } from './sim';

describe('11-28 대잠 초계기', () => {
  it('공군 칸에 있고 잠수함에 강함', () => {
    expect(TABS.find((t) => t.id === 'air')!.kinds).toContain('mpa');
    expect(DEF.mpa.hits.sub).toBeGreaterThan(2);
  });
  it('잠수함 사냥 훈련: 숨은 잠수함을 찾아 잡음', () => {
    const r = runDrill(DRILLS.find((d) => d.id === 'n3-mpa')!, 1);
    expect(r.S.result?.win).toBe(true);
    expect(r.score).toBeGreaterThan(0.5);
  });
});
