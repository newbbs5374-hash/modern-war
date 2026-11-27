import { describe, expect, it } from 'vitest';
import { advance, budgetPerDay, newGame, type GameState } from './state';
import { answerBully, bullyAsks, bullyStats, bullyTick, currentBullies } from './bully';
import { hegOf } from './hegemony';
import { relationOf } from './world';
import type { BullyAct } from '../data/bullies';
import { cultureOf } from './culture';

const H = 3600e3;
function withAsk(s: GameState, from: string, act: BullyAct, item = ''): GameState {
  const cost = Math.round(s.nations[s.player.countryId].treasury * 0.06);
  return { ...s, hegemony: { ...hegOf(s), asks: [{ id: 1, kind: 'bully', from, act, item, cost, untilMs: s.worldMs + 8 * H }], nextId: 2 } };
}

describe('대륙 깡패 강대국(11-27)', () => {
  it('대륙마다 깡패: 미국·중국·러시아·이란·이집트', () => {
    const s = newGame('t', 'kr', 0, { seed: 1 });
    const ids = currentBullies(s).map((x) => x.id);
    for (const id of ['us', 'cn', 'ru', 'ir', 'eg']) expect(ids).toContain(id);
  });
  it('내가 미국이면 미국은 깡패가 아니고, 아메리카 패권국이 새 깡패', () => {
    let s = newGame('t', 'us', 0, { seed: 2 });
    s = advance(s, 1 * H);
    const am = currentBullies(s).filter((x) => x.region === 'americas');
    expect(am.every((x) => x.id !== 'us')).toBe(true);
  });
  it('세계가 흐르면 깡패짓이 쌓이고, 우리에게도 오며 판이 망가지지 않음', () => {
    let s = newGame('t', 'kr', 0, { seed: 7, realWorld: true });
    s = advance(s, 3 * 24 * H);
    const b = bullyStats(s);
    const total = Object.values(b.acts).reduce((a, x) => a + x, 0);
    expect(total).toBeGreaterThan(5);
    expect(b.acts.cn ?? 0).toBeGreaterThan(0);
    for (const id of Object.keys(s.nations)) {
      expect(Number.isFinite(budgetPerDay(s, id))).toBe(true);
      expect(s.nations[id].treasury).toBeGreaterThanOrEqual(0);
    }
  }, 60000);
  it('방위비 청구: 굴복하면 돈을 내고, 맞서면 제재·명성', () => {
    const s = withAsk(newGame('t', 'kr', 0, { seed: 3 }), 'us', 'tribute');
    const g = answerBully(s, 1, true).state;
    expect(g.nations.kr.treasury).toBeLessThan(s.nations.kr.treasury);
    expect(g.nations.us.treasury).toBeGreaterThan(s.nations.us.treasury);
    expect(bullyAsks(g).length).toBe(0);
    const r = answerBully(s, 1, false).state;
    expect(hegOf(r).sanctions.some((x) => x.from === 'us' && x.to === 'kr')).toBe(true);
    expect(r.officer.fame ?? 0).toBeGreaterThan(s.officer.fame ?? 0);
  });
  it('문화 우기기: 못 본 척하면 문화 점수가 줄고, 반박하면 그대로', () => {
    let s = newGame('t', 'kr', 0, { seed: 4 });
    s = { ...s, culture: { ...cultureOf(s), points: 1000 } };
    s = withAsk(s, 'cn', 'culture', '김치');
    const g = answerBully(s, 1, true).state;
    expect(g.culture!.points).toBeLessThan(1000);
    const r = answerBully(s, 1, false);
    expect(r.state.culture!.points).toBe(1000);
    expect(r.text).toContain('김치');
  });
  it('답하지 않으면 시간이 지나 맞선 것으로 침(명성 없음)', () => {
    const s = withAsk(newGame('t', 'kr', 0, { seed: 5 }), 'ru', 'land');
    const later = bullyTick({ ...s, worldMs: s.worldMs + 9 * H });
    expect(bullyAsks(later).some((a) => a.id === 1)).toBe(false);
    expect(later.officer.fame ?? 0).toBe(s.officer.fame ?? 0);
    expect(relationOf(later.world, 'ru', 'kr')).toBeDefined();
  });
});
