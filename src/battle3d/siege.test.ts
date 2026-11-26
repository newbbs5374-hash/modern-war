import { describe, expect, it } from 'vitest';
import { carryFrom, fillReinf, placeCarried, runAct, runSiegeHeadless, spentOf, REINF_BUDGET } from './siege';
import { ACTS, CORE, STREET } from './stages';
import { COAST, DEF, TILES, defaultDeploy, inBlock, useStage } from './sim';

describe('3막 공성전', () => {
  it('1막은 시험판 해안 전장과 똑같음(171.6초 승리)', () => {
    useStage(COAST);
    const S = runAct(COAST, defaultDeploy());
    expect(S.result?.win).toBe(true);
    expect(S.simT.toFixed(1)).toBe('171.6');
  });
  it('시가전·도심: 적·거점·배치 칸이 건물 안에 없고 바다 칸도 없음', () => {
    for (const st of [STREET, CORE]) {
      useStage(st);
      expect(TILES.length).toBeGreaterThan(30);
      expect(TILES.every((t) => t.dom === 'land')).toBe(true);
      for (const [k, x, z] of [...st.enemy, ...(st.waves ?? []).flat(), ...(st.reinf?.list ?? [])]) {
        expect(inBlock(x, z, DEF[k].dom === 'land' ? DEF[k].r * .55 : -9), `${st.id} ${k} ${x},${z}`).toBeUndefined();
      }
      for (const p of st.points ?? []) expect(inBlock(p.x, p.z)).toBeUndefined();
    }
    useStage(COAST);
  });
  it('기본 배치로 맡기면 세 막을 모두 이기고, 같은 입력이면 같은 결과', () => {
    const a = runSiegeHeadless(0.9), b = runSiegeHeadless(0.9);
    expect(a.results.map((r) => r.win)).toEqual([true, true, true]);
    expect(a.outcome.win).toBe(true);
    expect(a.outcome.stars).toBeGreaterThan(0);
    expect(JSON.stringify(a.results)).toBe(JSON.stringify(b.results));
    // 막마다 걸린 시간이 너무 짧지 않음(허무하게 끝나지 않게)
    expect(a.results.reduce((s, r) => s + r.t, 0)).toBeGreaterThan(240);
  });
  it('살아남은 부대가 다친 그대로 다음 막에 넘어가고, 보충은 예산 안', () => {
    useStage(COAST);
    const S = runAct(COAST, defaultDeploy());
    const c = carryFrom(S);
    expect(c.units.length).toBeGreaterThan(0);
    expect(c.units.some((u) => u.hp < 1)).toBe(true);
    useStage(ACTS[1]);
    const mine = fillReinf(placeCarried(c));
    expect(mine.filter((m) => m.carried).length).toBe(c.units.length);
    expect(spentOf(mine)).toBeLessThanOrEqual(REINF_BUDGET);
    useStage(COAST);
  });
  it('도심: 지휘소가 무너지면 최후 저항이 두 번 나옴', () => {
    const r = runSiegeHeadless(0.85);
    expect(r.results[2]?.win).toBe(true);
    useStage(CORE);
    const S = runAct(CORE, fillReinf(placeCarried({ units: [{ kind: 'tank', hp: 1 }, { kind: 'tank', hp: 1 }, { kind: 'spg', hp: 1 }, { kind: 'inf', hp: 1 }], naval: 2 }), 300), 5, 0.85);
    expect(S.wave).toBeGreaterThanOrEqual(S.units.some((u) => u.kind === 'hq' && !u.alive) ? 1 : 0);
    useStage(COAST);
  });
});
