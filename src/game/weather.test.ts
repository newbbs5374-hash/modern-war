import { describe, expect, it } from 'vitest';
import { snowSeason, weatherAt } from './weather';

describe('본부 날씨', () => {
  it('같은 시각·나라는 늘 같은 날씨, 3시간 안에서는 바뀌지 않는다', () => {
    const a = new Date('2026-11-27T03:10:00Z');
    const b = new Date('2026-11-27T05:50:00Z');
    expect(weatherAt('kr', a)).toBe(weatherAt('kr', a));
    expect(weatherAt('kr', a)).toBe(weatherAt('kr', b));
  });
  it('눈은 겨울에 추운 나라에서만', () => {
    expect(snowSeason('kr', new Date('2026-01-10T00:00:00Z'))).toBe(true);
    expect(snowSeason('kr', new Date('2026-07-10T00:00:00Z'))).toBe(false);
    expect(snowSeason('ph', new Date('2026-01-10T00:00:00Z'))).toBe(false);
    expect(snowSeason('ru', new Date('2026-11-27T00:00:00Z'))).toBe(true);
    for (let i = 0; i < 400; i++) {
      const d = new Date(Date.UTC(2026, 6, 1) + i * 3 * 3600_000);
      expect(weatherAt('kr', d)).not.toBe('눈');
      expect(weatherAt('ph', new Date(Date.UTC(2026, 0, 1) + i * 3 * 3600_000))).not.toBe('눈');
    }
  });
  it('한 해를 보면 맑은 날이 절반을 넘고 비·눈도 온다', () => {
    const n: Record<string, number> = {};
    for (let i = 0; i < 2920; i++) {
      const w = weatherAt('kr', new Date(Date.UTC(2026, 0, 1) + i * 3 * 3600_000));
      n[w] = (n[w] ?? 0) + 1;
    }
    expect(n['맑음'] / 2920).toBeGreaterThan(0.5);
    expect(n['비']).toBeGreaterThan(100);
    expect(n['눈']).toBeGreaterThan(30);
  });
});
