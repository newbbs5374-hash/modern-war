import { describe, expect, it } from 'vitest';
import { CITIES } from '../data/cities';
import { buildField, createField, finishField, fMult, orderMove, stepField, FUNIT } from './field';

const stats = { 통솔: 30, 전술: 30, 포격: 30, 정보: 30, 군수: 30, 사격: 30 };

describe('지도 위 전투', () => {
  it('모든 도시에서 전장을 만들 수 있음(도심·상륙 거점)', () => {
    for (const c of CITIES) {
      const f = buildField(c.id);
      expect(f.cells[f.center].terrain).toBe('도심');
      expect(f.landing).not.toBe(f.center);
      const b = createField({ city: c.id, difficulty: 1, rank: 6, stats, seed: 1 });
      expect(b.units.some((u) => u.kind === 'hq')).toBe(true);
      expect(b.units.filter((u) => u.side === 'me' && FUNIT[u.kind].layer === 'land').length).toBeGreaterThan(3);
    }
  });
  it('같은 입력이면 같은 결과', () => {
    const a = finishField(createField({ city: CITIES[3].id, difficulty: 1.1, rank: 6, stats, seed: 42 })).result;
    const b = finishField(createField({ city: CITIES[3].id, difficulty: 1.1, rank: 6, stats, seed: 42 })).result;
    expect(a).toEqual(b);
  });
  it('상성: 방공은 비행기에 강하고, 육군 대부분은 잠수함을 못 때림', () => {
    expect(fMult('aa', 'fighter')).toBeGreaterThan(2);
    expect(fMult('tank', 'submarine')).toBe(0);
    expect(fMult('destroyer', 'submarine')).toBeGreaterThan(1);
  });
  it('전투기는 항모 4칸 밖으로 못 나감', () => {
    const b = createField({ city: CITIES.find((c) => buildField(c.id).hasSea)!.id, difficulty: 1, rank: 6, stats, seed: 3 });
    const ft = b.units.find((u) => u.side === 'me' && u.kind === 'fighter' && u.base! > 0);
    if (!ft) return;
    const cv = b.units.find((u) => u.id === ft.base)!;
    const far = b.field.cells.findIndex((_, i) => b.field.dist[i * b.field.n + cv.at] > 4);
    expect(orderMove(b, ft.id, far)).toMatch(/범위/);
  });
  it('자동전투 승률(난이도별)', { timeout: 120000 }, () => {
    for (const d of [0.9, 1.1, 1.3, 1.5]) {
      let win = 0;
      let stars = 0;
      let t = 0;
      const n = CITIES.length;
      for (const [i, c] of CITIES.entries()) {
        const b = finishField(createField({ city: c.id, difficulty: d, rank: 6, stats, seed: 100 + i }));
        if (b.result!.win) win++;
        stars += b.result!.stars;
        t += b.t;
      }
      console.log(`난이도 ${d}: 승률 ${Math.round((win / n) * 100)}% · 별 평균 ${(stars / n).toFixed(2)} · 평균 ${Math.round(t / n)}초`);
    }
    expect(true).toBe(true);
  });
  it('직접 조작: 걸음마다 멈춤(물어보기)이 생길 수 있음', () => {
    const b = createField({ city: CITIES[0].id, difficulty: 1, rank: 6, stats, seed: 9 });
    b.auto = false;
    stepField(b, 5);
    expect(b.t).toBeGreaterThan(0);
  });
});
