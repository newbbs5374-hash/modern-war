import { describe, expect, it } from 'vitest';
import { BIG_FIELDS, URBAN_FIELDS } from './fields';
import { DEPLOY_FIELDS } from './deployFields';
import { ACT_POOLS, actsFor } from './stages';
import { COAST, DEF, FIELD, TILES, autoDeploy, createSim, headlessOutcome, inBlock, setupDeploy, startBattle, step, useStage, type Stage } from './sim';
import { fillReinf, placeCarried, runSiegeHeadless } from './siege';
import { autoField } from '../battle/auto';

const ALL = [...BIG_FIELDS, ...URBAN_FIELDS, ...DEPLOY_FIELDS];
function run(st: Stage, foeHp: number) {
  useStage(st);
  const S = createSim();
  const carried = st.urban && (st.win === 'points' || st.win === 'hqwaves');
  const mine = carried ? fillReinf(placeCarried({ units: [{ kind: 'tank', hp: .7 }, { kind: 'tank', hp: .6 }, { kind: 'inf', hp: .8 }, { kind: 'ifv', hp: .7 }, { kind: 'spg', hp: .9 }, { kind: 'aa', hp: .8 }, { kind: 'heli', hp: .7 }], naval: 2 }), st.budget) : autoDeploy();
  setupDeploy(S, mine, { foeHp, cp0: carried ? 5 : 3 });
  startBattle(S);
  for (let i = 0; i < 9000 && S.phase === 'battle'; i++) step(S);
  return S;
}

describe('11-26 큰 3D 전장', () => {
  it('전장이 37곳이고 id가 겹치지 않음', () => {
    expect(BIG_FIELDS.length).toBeGreaterThanOrEqual(14);
    expect(DEPLOY_FIELDS.length).toBeGreaterThanOrEqual(20);
    expect(new Set(ALL.map((s) => s.id)).size).toBe(ALL.length);
  });
  it('큰 전장은 시험판보다 넓고, 배치 칸이 충분하고, 적이 건물·절벽 안에 없음', () => {
    for (const st of ALL) {
      useStage(st);
      expect((FIELD.xMax - FIELD.xMin) * (FIELD.zBot - FIELD.zTop), st.id).toBeGreaterThan(20 * 29 * 1.8);
      expect(TILES.length, st.id).toBeGreaterThan(40);
      const places = [...st.enemy, ...(st.waves ?? []).flat(), ...(st.timed ?? []).flatMap((t) => t.list), ...(st.allies ?? [])];
      for (const [k, x, z] of places) {
        if (DEF[k].dom === 'land') expect(inBlock(x, z, DEF[k].r * .55), `${st.id} ${k} ${x},${z}`).toBeUndefined();
        expect(x >= FIELD.xMin - .1 && x <= FIELD.xMax + .1 && z >= FIELD.zTop - 2.1 && z <= FIELD.zBot, `${st.id} ${k} ${x},${z} 밖`).toBe(true);
      }
      // 쓸 수 있는 병과를 놓을 칸이 있음
      const mine = autoDeploy();
      expect(mine.length, st.id).toBeGreaterThan(5);
      if (st.kinds) expect(mine.every((m) => st.kinds!.includes(m.kind)), st.id).toBe(true);
    }
    useStage(COAST);
  });
  it('기본 배치로 맡기면(적 체력 0.9) 모든 전장을 이기고, 너무 빨리 끝나지 않음', { timeout: 120000 }, () => {
    for (const st of ALL) {
      const S = run(st, 0.9);
      expect(S.result?.win, `${st.id} ${headlessOutcome(S).text}`).toBe(true);
      expect(S.simT, st.id).toBeGreaterThan(50);
    }
    useStage(COAST);
  });
  it('같은 입력이면 같은 결과', () => {
    const a = autoField({ variant: 'highland', difficulty: 1 }), b = autoField({ variant: 'highland', difficulty: 1 });
    expect(a).toEqual(b);
    useStage(COAST);
  });
  it('공성전 막은 씨앗마다 바뀌고, 바닷가 도시는 1막에 바다가 있음', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 60; i++) { const a = actsFor(i * 31); seen.add(a.map((s) => s.id).join('>')); expect(ACT_POOLS[0]).toContain(a[0]); }
    expect(seen.size).toBeGreaterThan(15);
    for (let i = 0; i < 20; i++) {
      useStage(actsFor(i, true)[0]); expect(TILES.some((t) => t.dom === 'sea')).toBe(true);
      useStage(actsFor(i, false)[0]); expect(TILES.some((t) => t.dom === 'sea')).toBe(false);
    }
    useStage(COAST);
  });
  it('공성전 맡기기: 대부분의 막 조합을 이김', { timeout: 120000 }, () => {
    let win = 0, n = 0;
    for (const a of ACT_POOLS[0]) for (const b of ACT_POOLS[1]) for (const c of ACT_POOLS[2]) { n++; if (runSiegeHeadless(0.9, undefined, [a, b, c]).outcome.win) win++; }
    expect(win / n).toBeGreaterThan(0.85);
  });
});
