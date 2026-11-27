import { describe, expect, it } from 'vitest';
import { FRONT } from '../data/cities';
import { strikes } from './frontline';
import { newWorld, pairKey } from './world';

describe('전선 지도 화살표', () => {
  it('평화로우면 화살표가 없다', () => {
    const w = newWorld(1, false, 0);
    expect(strikes(w)).toEqual([]);
  });
  it('공격받는 도시는 전쟁 상대의 가장 가까운 도시에서 화살표가 온다', () => {
    const w = newWorld(1, false, 0);
    const seoul = FRONT.find((c) => c.name === '서울')!;
    w.pairs[pairKey('kr', 'kp')].rel = '전쟁';
    w.defense[seoul.id] = 40;
    const s = strikes(w);
    expect(s).toHaveLength(1);
    expect(s[0].to.id).toBe(seoul.id);
    expect(s[0].by).toBe('kp');
    expect(s[0].left).toBeCloseTo(0.4);
    // 북한 도시 가운데 서울에 가장 가까운 곳
    const near = FRONT.filter((c) => c.home === 'kp').sort((a, b) => Math.hypot(a.x - seoul.x, a.y - seoul.y) - Math.hypot(b.x - seoul.x, b.y - seoul.y))[0];
    expect(s[0].from.id).toBe(near.id);
  });
  it('전쟁 상대가 없으면(반란 등) 화살표를 그리지 않는다', () => {
    const w = newWorld(1, false, 0);
    const seoul = FRONT.find((c) => c.name === '서울')!;
    for (const k of Object.keys(w.pairs)) if (w.pairs[k].rel === '전쟁') w.pairs[k].rel = '중립';
    w.defense[seoul.id] = 40;
    expect(strikes(w)).toEqual([]);
  });
});
