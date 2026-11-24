import { describe, expect, it } from 'vitest';
import { MIL_TECHS, SOC_TECHS } from '../data/civ';
import { CARD_ORDER } from './techCardOrder';
import { CARD_H, PITCH, layoutCards } from './techCards';

describe('연구 카드 트리', () => {
  for (const [line, list] of [['mil', MIL_TECHS], ['soc', SOC_TECHS]] as const) {
    it(`${line}: 미리 골라 둔 순서로 선이 하나도 엇갈리지 않음(안 맞으면 npx tsx scripts/gen-tech-cards.ts)`, () => {
      const L = layoutCards(list, CARD_ORDER[line], 0);
      expect(L.crossings).toBe(0);
      expect(Object.keys(L.nodes).length).toBe(list.length);
      // 선행마다 선이 하나씩
      expect(L.edges.length).toBe(list.reduce((a, t) => a + t.needs.length, 0));
    });
    it(`${line}: 왼쪽 → 오른쪽(선행은 늘 왼쪽 열, 시대 순서대로)`, () => {
      const L = layoutCards(list, CARD_ORDER[line], 0);
      for (const t of list) for (const n of t.needs) expect(L.nodes[n].col).toBeLessThan(L.nodes[t.id].col);
      for (const a of list) for (const b of list) if (a.era < b.era) expect(L.nodes[a.id].col).toBeLessThan(L.nodes[b.id].col);
    });
    it(`${line}: 카드끼리 겹치지 않고, 지나가는 선이 카드를 뚫지 않음`, () => {
      const L = layoutCards(list, CARD_ORDER[line], 0);
      const ns = Object.values(L.nodes);
      for (let i = 0; i < ns.length; i++)
        for (let j = i + 1; j < ns.length; j++) if (ns[i].col === ns[j].col) expect(Math.abs(ns[i].y - ns[j].y)).toBeGreaterThanOrEqual(PITCH);
      for (const e of L.edges)
        for (let k = 1; k + 1 < e.pts.length; k += 2) {
          const [x, y] = e.pts[k];
          for (const n of ns) if (n.x === x) expect(Math.abs(n.y - y)).toBeGreaterThan(CARD_H / 2 + 4);
        }
    });
  }
});
