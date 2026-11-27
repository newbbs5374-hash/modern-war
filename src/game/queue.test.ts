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
