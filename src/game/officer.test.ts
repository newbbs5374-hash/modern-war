import { SAVE_VERSION } from './state';
import { describe, expect, it, test } from 'vitest';
import { aideSlots, generalSlots, statCap } from '../data/officers';
import { advance, newGame, setRank, type GameState } from './state';
import {
  DRILL_MAX,
  boardNow,
  claimMission,
  drillsNow,
  generalDefense,
  missionChance,
  officerTick,
  recruitGeneral,
  startMission,
  finishTraining,
  startTraining,
} from './officer';
import { parseSave } from './save';
import { appointGeneral } from './loyal';

const H = 3600e3;

/** 훈련 시작 → 미니게임 결과(별 stars, 직접) 반영 */
function train(s: GameState, name: string, stars = 2, auto = false) {
  return finishTraining(startTraining(s, name), { win: stars > 0, stars, auto });
}

function finishMission(s: GameState): GameState {
  const s2 = advance(s, s.officer.active!.endMs - s.worldMs);
  return claimMission(s2).state;
}

describe('장교', () => {
  it('훈련: 일정 1개 쓰고 별·스탯이 오름, 일정은 4시간마다 1개 회복', () => {
    let s = newGame('t', 'kr', 0, { seed: 1 });
    const r = train(s, '사격');
    expect(r.result.ok).toBe(true);
    s = r.state;
    expect(s.officer.stars).toBeGreaterThan(0);
    expect(s.officer.stats['사격']).toBeGreaterThan(8);
    expect(drillsNow(s.officer, s.worldMs).count).toBe(DRILL_MAX - 1);
    for (let i = 0; i < 5; i++) s = train(s, '체력').state;
    expect(drillsNow(s.officer, s.worldMs).count).toBe(0);
    expect(train(s, '체력').result.ok).toBe(false);
    expect(drillsNow(s.officer, s.worldMs + 4 * H).count).toBe(1);
    expect(drillsNow(s.officer, s.worldMs + 30 * H).count).toBe(DRILL_MAX);
  });
  it('계급이 모자라면 훈련 잠김', () => {
    const s = newGame('t', 'kr', 0, { seed: 1 });
    expect(train(s, '포격').result.ok).toBe(false);
    expect(train(setRank(s, 1), '포격').result.ok).toBe(true);
  });
  it('스탯은 계급 상한을 넘지 않음', () => {
    let s = newGame('t', 'kr', 0, { seed: 2 });
    for (let d = 0; d < 20; d++) {
      for (let i = 0; i < 6; i++) s = train(s, '사격').state;
      s = advance(s, 24 * H);
    }
    expect(s.officer.stats['사격']).toBeLessThanOrEqual(statCap(0));
  });
  it('임무: 게시판 3개 → 시작 → 시간이 지나야 결과, 공훈이 쌓임', () => {
    let s = newGame('t', 'kr', 0, { seed: 3 });
    const b = boardNow(s);
    s = b.state;
    expect(b.board.length).toBe(3);
    const m = b.board[0];
    expect(missionChance(s, m)).toBeGreaterThan(0.1);
    s = startMission(s, m.id);
    expect(s.officer.active?.id).toBe(m.id);
    expect(claimMission(s).text).toBeNull(); // 아직 안 끝남
    s = finishMission(s);
    expect(s.officer.active).toBeNull();
    expect(s.officer.merit).toBeGreaterThan(0);
    expect(s.world.events.some((e) => e.kind === '장교')).toBe(true);
  });
  it('부관 승격·장군 영입은 장군 칸이 있어야, 장군은 방어 보너스', () => {
    let s = setRank(newGame('t', 'kr', 0, { seed: 5 }), 6); // 장군 2칸
    expect(generalSlots(7)).toBe(3);
    expect(aideSlots(7)).toBe(3);
    s = { ...s, player: { ...s.player, salary: 10000 } };
    s = recruitGeneral(s);
    expect(s.officer.generals.length).toBe(1);
    expect(s.player.salary).toBe(7000);
    s = {
      ...s,
      officer: { ...s.officer, aides: [{ id: 99, name: '테스트', specialty: '저격', level: 3, exp: 0, bond: 50 }] },
    };
    s = { ...s, officer: { ...s.officer, aides: [{ ...s.officer.aides[0], schooled: true }] } };
    const taken = s.officer.generals[0].field;
    expect(appointGeneral(s, 99, taken).officer.generals.length).toBe(1); // 병과마다 한 명
    const field = taken === '해군' ? '공군' : '해군';
    s = appointGeneral(s, 99, field);
    expect(s.officer.generals.length).toBe(2);
    expect(s.officer.generals[1].field).toBe(field);
    expect(s.officer.aides.length).toBe(0);
    expect(recruitGeneral(s).officer.generals.length).toBe(2); // 칸이 꽉 참
    expect(generalDefense(s.officer)).toBeGreaterThan(1);
  });
  it('불신임: 신뢰도가 낮으면 경고, 3일 안에 못 돌리면 명성 −150', () => {
    let s = setRank(newGame('t', 'kr', 0, { seed: 7 }), 6);
    s = { ...s, officer: { ...s.officer, trust: 10 } };
    officerTick(s, s.world.owner, 15 * 60e3);
    expect(s.officer.dismissDeadlineMs).not.toBeNull();
    const deadline = s.officer.dismissDeadlineMs!;
    const fame0 = s.officer.fame;
    s = { ...s, worldMs: deadline + 1, officer: { ...s.officer, trust: 10 } };
    officerTick(s, s.world.owner, 15 * 60e3);
    expect(s.officer.fame).toBe(Math.max(0, fame0 - 150));
    expect(s.officer.dismissDeadlineMs).toBeNull();
  });
  it('2단계 저장을 불러오면 장교를 새로 만들어 이어감', () => {
    const s = advance(newGame('대장', 'kr', 0, { seed: 8 }), 2 * H);
    const { officer: _o, ...rest } = s;
    void _o;
    const loaded = parseSave(JSON.stringify({ ...rest, version: 2 }));
    expect(loaded?.version).toBe(SAVE_VERSION);
    expect(loaded?.officer.rivals.length).toBe(3);
  });
});

test('직접 싸운 결과로 임무를 받으면 이기고 지는 것이 그대로, 별이 많으면 공훈이 큼', async () => {
  const { newGame } = await import('./state');
  const { boardNow, startMission, claimMission } = await import('./officer');
  const one = (stars: number, win: boolean) => {
    let s = newGame('t', 'kr', 0, { seed: 3 });
    s = boardNow(s).state;
    s = startMission(s, s.officer.board[0].id);
    s = { ...s, worldMs: s.officer.active!.endMs };
    return claimMission(s, { win, stars }).state.officer;
  };
  expect(one(3, true).merit).toBeGreaterThan(one(1, true).merit);
  expect(one(1, false).merit).toBeLessThan(one(1, true).merit);
});
