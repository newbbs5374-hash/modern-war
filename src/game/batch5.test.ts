// 11-28 국정 37 강화 5차: 적 지원군 경고 · 선거 예측 · 반전 시위
import { describe, expect, test } from 'vitest';
import { advance, newGame, type GameState } from './state';
import { reinforceOf } from './reinforce';
import { seatForecast, seatsTick, VOTE_HIST_MS } from './seats';
import { antiwarOdds, antiwarTick, ANTIWAR_EVERY } from './antiwar';
import { cultureOf } from './culture';
import { pairKey } from './world';
import { upcomingOf } from './upcoming';

const H = 3600e3;
const atWar = (s: GameState, id: string): GameState => {
  const k = pairKey(s.player.countryId, id);
  return { ...s, world: { ...s.world, pairs: { ...s.world.pairs, [k]: { ...s.world.pairs[k], rel: '전쟁', tension: 100, weariness: 0 } } } };
};

describe('5차', () => {
  test('지원군 경고: 연합국은 꼭 나오고 확률 높은 순', () => {
    const s = newGame('t', 'kr', 0, { seed: 4, realWorld: true });
    const hs = reinforceOf(s, 'kp', 10);
    for (let i = 1; i < hs.length; i++) expect(hs[i - 1].help).toBeGreaterThanOrEqual(hs[i].help);
    for (const h of hs) {
      expect(h.id).not.toBe('kr');
      expect(h.id).not.toBe('kp');
      expect(h.troops).toBeGreaterThanOrEqual(0);
    }
    expect(reinforceOf(s, 'kr')).toEqual([]);
  });
  test('선거 예측: 득표율이 높을수록 의석·과반 확률이 오르고, 3시간마다 기록', () => {
    let s = advance(newGame('t', 'kr', 0, { seed: 4, realWorld: true }), H);
    const lo = seatForecast(s, 35);
    const hi = seatForecast(s, 65);
    expect(hi.mid).toBeGreaterThan(lo.mid);
    expect(hi.majority).toBeGreaterThanOrEqual(lo.majority);
    expect(lo.low).toBeLessThanOrEqual(lo.mid);
    expect(lo.mid).toBeLessThanOrEqual(lo.high);
    s = seatsTick({ ...s, polity: { ...s.polity!, voteHistMs: 0 }, worldMs: s.worldMs + VOTE_HIST_MS });
    const n = s.polity!.voteHist?.length ?? 0;
    expect(n).toBeGreaterThan(0);
    s = seatsTick({ ...s, worldMs: s.worldMs + 60e3 });
    expect(s.polity!.voteHist!.length).toBe(n);
  });
  test('반전 시위: 문화 우세 나라와 전쟁하면 피로가 쌓임', () => {
    let s = advance(newGame('t', 'kr', 0, { seed: 4, realWorld: true }), H);
    const c = cultureOf(s);
    s = atWar({ ...s, culture: { ...c, infl: { ...c.infl, jp: 1e9 } } }, 'jp');
    expect(antiwarOdds(s).find((o) => o.id === 'jp')?.p).toBe(0.5);
    const k = pairKey('kr', 'jp');
    let hit = false;
    for (let i = 0; i < 20 && !hit; i++) {
      s = antiwarTick({ ...s, antiwarMs: s.worldMs });
      hit = s.world.pairs[k].weariness > 0;
      s = { ...s, worldMs: s.worldMs + ANTIWAR_EVERY };
    }
    expect(hit).toBe(true);
  });
  test('일 미리 보기: 시각 순, 지난 일은 없음', () => {
    const s = advance(newGame('t', 'kr', 0, { seed: 4, realWorld: true }), H);
    const u = upcomingOf(s);
    expect(u.length).toBeGreaterThan(2);
    for (let i = 1; i < u.length; i++) expect(u[i].atMs).toBeGreaterThanOrEqual(u[i - 1].atMs);
    for (const x of u) expect(x.atMs).toBeGreaterThan(s.worldMs);
  });
});
