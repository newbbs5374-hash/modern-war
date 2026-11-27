// 11-28 임무 예약 줄
import { describe, expect, test } from 'vitest';
import { newGame } from './state';
import { boardNow, canEnqueue, claimMission, enqueueMission, startMission } from './officer';

describe('임무 예약', () => {
  test('지금 임무가 끝나 결과를 받으면 예약한 임무가 바로 시작', () => {
    let s = newGame('t', 'kr', 0, { seed: 9, realWorld: true });
    s = { ...s, player: { ...s.player, rankIndex: 4 } };
    s = boardNow(s).state;
    const [a, b] = s.officer.board;
    expect(a && b).toBeTruthy();
    expect(canEnqueue(s, b.id)).toBeTruthy(); // 하는 임무가 없으면 예약 대신 바로 시작
    s = startMission(s, a.id);
    s = enqueueMission(s, b.id);
    expect(s.officer.queue?.length).toBe(1);
    s = { ...s, worldMs: s.officer.active!.endMs + 1 };
    s = claimMission(s).state;
    expect(s.officer.active?.id).toBe(b.id);
    expect(s.officer.queue?.length).toBe(0);
  });
});

import { PRESETS, producePreset } from './presets';
describe('편성 묶음', () => {
  test('만들 수 있는 부대만 줄에 세움', () => {
    let s = newGame('t', 'kr', 0, { seed: 9, realWorld: true });
    s = { ...s, player: { ...s.player, rankIndex: 10 }, nations: { ...s.nations, kr: { ...s.nations.kr, def: 1e9, treasury: 1e9 } }, economy: { ...s.economy, stock: Object.fromEntries(Object.keys(s.economy.stock).map((k) => [k, 999])) as typeof s.economy.stock } };
    const n = producePreset(s, PRESETS[1]).economy.queue.length;
    expect(n).toBeGreaterThan(0);
    expect(n).toBeLessThanOrEqual(5);
  });
});
