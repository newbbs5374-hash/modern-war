import { describe, expect, it } from 'vitest';
import { MIL_TECHS, SOC_TECHS } from '../data/civ';
import { SKY_ORDER } from './techSkyOrder';
import { edgesCross, layoutSky } from './techSky';

describe('연구 성좌판', () => {
  for (const [line, list] of [['mil', MIL_TECHS], ['soc', SOC_TECHS]] as const) {
    it(`${line}: 미리 골라 둔 순서가 지금 연구 목록과 맞음(안 맞으면 npx tsx scripts/gen-tech-sky.ts)`, () => {
      const have = Object.entries(SKY_ORDER[line]).filter(([k]) => !k.startsWith('@')).flatMap(([, v]) => v).sort();
      expect(have).toEqual(list.map((t) => t.id).sort());
    });
    it(`${line}: 선이 하나도 엇갈리지 않고 별끼리 붙지 않음`, () => {
      const L = layoutSky(list);
      expect(Object.keys(L.nodes).length).toBe(list.length);
      let x = 0;
      for (let i = 0; i < L.edges.length; i++) for (let j = i + 1; j < L.edges.length; j++) if (edgesCross(L.edges[i], L.edges[j])) x++;
      expect(x).toBe(0);
      const ns = Object.values(L.nodes);
      for (let i = 0; i < ns.length; i++) for (let j = i + 1; j < ns.length; j++) expect(Math.hypot(ns[i].x - ns[j].x, ns[i].y - ns[j].y)).toBeGreaterThanOrEqual(46);
      // 선행마다 선이 하나씩(시작 별 선 포함)
      expect(L.edges.length).toBe(list.reduce((a, t) => a + Math.max(1, t.needs.length), 0));
    });
  }
});
