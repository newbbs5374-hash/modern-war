import { describe, expect, it } from 'vitest';
import { advance, newGame, type GameState } from './state';
import * as C from './cabinet';
import { cityCiv } from './civ';
import { citiesOf } from './world';
import { acceptProposal, askProposal, canAsk, makeProposal, propOf, propTick, rejectProposal, setTrusted, speakers, type Proposal } from './proposals';
import { talk } from './chat';
import { Rng } from './rng';

const H = 3600_000;
const rich = (s: GameState, v = 1e9): GameState => ({
  ...s,
  nations: { ...s.nations, [s.player.countryId]: { ...s.nations[s.player.countryId], treasury: v } },
  economy: { ...s.economy, stock: Object.fromEntries(Object.keys(s.economy.stock).map((k) => [k, 1e6])) as GameState['economy']['stock'] },
});
function withMinister(s: GameState, min: C.Person['seat'] extends infer X ? (X extends { id: infer I } ? I : never) : never): { s: GameState; pid: number } {
  const c = C.cabinetOf(s);
  const p = c.people.find((x) => x.group === '관료')!;
  const people = c.people.map((x) => (x.id === p.id ? { ...x, group: '내각' as const, loyalty: 60, seat: { kind: 'min' as const, id: min } } : x));
  return { s: { ...s, cabinet: { ...c, people } }, pid: p.id };
}

describe('장관 건의(11-25 대장 요청 1번)', () => {
  it('장관이 앉으면 몇 시간 뒤 자기 부처에 맞는 건의를 올림', () => {
    let { s, pid } = withMinister(rich(newGame('t', 'kr', 0, { seed: 31 })), 'molit');
    expect(speakers(s).some((x) => x.key === `p:${pid}`)).toBe(true);
    for (let i = 0; i < 12 * 4; i++) s = propTick({ ...s, worldMs: s.worldMs + H / 4 });
    const mine = propOf(s).list.filter((x) => x.who === `p:${pid}`);
    expect(mine.length).toBe(1);
    expect(mine[0].min).toBe('molit');
    expect(mine[0].text).toMatch(/합니다/);
  });

  it('국방부 장관은 군 공항(비행장)을, 복지부는 민심 낮은 도시에 주거 구역을 건의할 수 있음', () => {
    const base = rich(newGame('t', 'kr', 0, { seed: 32 }));
    const a = withMinister(base, 'mnd');
    const sp = speakers(a.s).find((x) => x.key === `p:${a.pid}`)!;
    const seen = new Set<string>();
    for (let i = 0; i < 40; i++) {
      const pr = makeProposal(a.s, { ...sp, sense: 0 }, new Rng(i + 1), i);
      if (pr) seen.add(pr.act.kind === 'district' ? pr.act.id : pr.act.kind);
    }
    expect([...seen]).toContain('airfield');
    const b = withMinister(base, 'mohw');
    const sp2 = speakers(b.s).find((x) => x.key === `p:${b.pid}`)!;
    const pr = makeProposal(b.s, { ...sp2, sense: 1, trait: '인기인' }, new Rng(3), 1)!;
    expect(pr).toBeTruthy();
  });

  it('받아들이면 도시가 알아서 칸을 골라 공사 시작, 충성 +3', () => {
    const { s: s0, pid } = withMinister(rich(newGame('t', 'kr', 0, { seed: 33 })), 'mohw');
    const city = citiesOf(s0.world, 'kr')[0];
    const pr: Proposal = { id: 1, who: `p:${pid}`, whoName: 'x', role: '보건복지부 장관', min: 'mohw', act: { kind: 'district', city, id: 'airfield' }, text: '', why: '', atMs: s0.worldMs, untilMs: s0.worldMs + H };
    const s1: GameState = { ...s0, props: { ...propOf(s0), list: [pr], seq: 2 } };
    const loy = C.personById(s1, pid)!.loyalty;
    const before = cityCiv(s1, city).districts.length;
    const r = acceptProposal(s1, 1);
    expect(cityCiv(r.state, city).districts.length).toBe(before + 1);
    expect(C.personById(r.state, pid)!.loyalty).toBeCloseTo(loy + 3, 5);
    expect(propOf(r.state).list.length).toBe(0);
    expect(r.text).toMatch(/공사/);
  });

  it('돈이 모자라면 개발 계획에 올렸다가, 돈이 생기면 알아서 지음', () => {
    const { s: s0, pid } = withMinister(rich(newGame('t', 'kr', 0, { seed: 34 }), 0), 'mohw');
    const city = citiesOf(s0.world, 'kr')[1];
    const pr: Proposal = { id: 1, who: `p:${pid}`, whoName: 'x', role: '장관', min: 'mohw', act: { kind: 'district', city, id: 'airfield' }, text: '', why: '', atMs: s0.worldMs, untilMs: s0.worldMs + H };
    const r = acceptProposal({ ...s0, props: { ...propOf(s0), list: [pr], seq: 2 } }, 1);
    expect(propOf(r.state).plans.length).toBe(1);
    const n0 = cityCiv(r.state, city).districts.length;
    const s2 = propTick(rich(r.state));
    expect(propOf(s2).plans.length).toBe(0);
    expect(cityCiv(s2, city).districts.length).toBe(n0 + 1);
  });

  it('미루면 충성 −1(충직·신중파는 그대로) · 맡기면 바로 받아들임', () => {
    let { s, pid } = withMinister(rich(newGame('t', 'kr', 0, { seed: 35 })), 'msit');
    s = { ...s, cabinet: { ...C.cabinetOf(s), people: C.cabinetOf(s).people.map((p) => (p.id === pid ? { ...p, trait: '야심' as const } : p)) } };
    const a = askProposal(s, `p:${pid}`);
    expect(a.prop).toBeTruthy();
    expect(canAsk(a.state, `p:${pid}`)).toBeTruthy();
    const loy = C.personById(a.state, pid)!.loyalty;
    const r = rejectProposal(a.state, a.prop!.id);
    expect(C.personById(r, pid)!.loyalty).toBeCloseTo(loy - 1, 5);
    let t = setTrusted(r, `p:${pid}`, true);
    t = { ...t, props: { ...propOf(t), next: { [`p:${pid}`]: t.worldMs } } };
    t = propTick(t);
    expect(propOf(t).list.filter((x) => x.who === `p:${pid}`).length).toBe(0);
    expect(propOf(t).yes).toBe(1);
  });

  it('대화: 근황·칭찬·사적인 이야기(충성 +, 쿨타임)', () => {
    const { s, pid } = withMinister(rich(newGame('t', 'kr', 0, { seed: 36 })), 'mofa');
    const k = `p:${pid}`;
    const h = talk(s, k, 'hello');
    expect(h.lines.length).toBeGreaterThanOrEqual(3);
    const l0 = C.personById(h.state, pid)!.loyalty;
    const p1 = talk(h.state, k, 'praise');
    expect(C.personById(p1.state, pid)!.loyalty).toBeGreaterThan(l0);
    const p2 = talk(p1.state, k, 'praise');
    expect(C.personById(p2.state, pid)!.loyalty).toBe(C.personById(p1.state, pid)!.loyalty);
    const st = talk(p2.state, k, 'story');
    expect(st.lines.some((x) => x.text.startsWith('☕'))).toBe(true);
    expect(talk(st.state, k, 'others').lines.length).toBeGreaterThan(1);
  });

  it('다른 나라로 시작해도 건의가 돌아감 · 게임 시간 흐름(advance)에 끼어 있음', () => {
    for (const cid of ['us', 'jp']) {
      let { s } = withMinister(rich(newGame('t', cid, 0, { seed: 37 })), 'mnd');
      s = advance(s, 10 * H);
      expect(propOf(s).list.length + propOf(s).yes).toBeGreaterThan(0);
    }
  });
});
