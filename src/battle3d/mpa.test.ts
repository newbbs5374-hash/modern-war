import { describe, expect, it } from 'vitest';
import { DRILLS, runDrill } from './drills';
import { CMD_ORDER, DEF, TABS, createSim, setupDeploy, startBattle } from './sim';
import { UNIT_COST } from '../data/economy';
import { techForUnit } from '../data/civ';

const NEW = ['mpa', 'ewa', 'swarm', 'cuas', 'ugv', 'marine', 'tanker', 'mlay'] as const;

describe('11-28 전투 병과 8개 + 대잠 초계기', () => {
  it('배치 칸·생산 표·연구에 모두 있음', () => {
    const all = TABS.flatMap((t) => t.kinds);
    for (const k of NEW) {
      expect(all, k).toContain(k);
      expect(UNIT_COST[DEF[k].name], k).toBeDefined();
      expect(techForUnit(DEF[k].name), k).toBeTruthy();
    }
    expect(DEF.mpa.hits.sub).toBeGreaterThan(2);
    expect(CMD_ORDER).toContain('sat');
  });
  it('훈련 8개 모두 미리 놓은 부대로 이길 수 있음', () => {
    for (const id of ['n3-mpa', 'n3-ewa', 'n3-swarm', 'n3-cuas', 'n3-ugv', 'n3-marine', 'n3-tanker', 'n3-mlay']) {
      const r = runDrill(DRILLS.find((d) => d.id === id)!, 1);
      expect(r.S.result?.win, id).toBe(true);
      expect(r.score, id).toBeGreaterThan(0.5);
    }
  });
  it('정찰 위성이 있으면 숨은 적이 시작 때 드러남', () => {
    const S = createSim();
    setupDeploy(S, [{ kind: 'inf', tile: 0 }], { sat: 2 });
    S.units.filter((u) => u.side === 'foe').forEach((u) => (u.hidden = true));
    startBattle(S);
    expect(S.units.filter((u) => u.side === 'foe' && u.hidden).length).toBe(0);
  });
});
