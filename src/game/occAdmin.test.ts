import { describe, expect, it } from 'vitest';
import { CITIES } from '../data/cities';
import { newGame, type GameState } from './state';
import { annexEntry, annexTick, MIL_HOURS, patchEntry } from './annex';
import { noteCapture } from './territory';
import { CAP_EARLY, CAP_NORMAL, EARLY_HOURS, FIRST_BATCH, adminCities, approveAll, approveProp, canApprove, occAdminOf, occAdminTick, propsOfCity, teamOf, addTeam } from './occAdmin';
import { myGovernors } from './governors';
import { polityOf, withPolity } from './polity';

const H = 3600e3;
const city = (n: string) => CITIES.find((c) => c.name === n)!.id;
function give(s: GameState, id: string, to: string): GameState {
  const w = { ...s.world, owner: { ...s.world.owner } };
  noteCapture(w, id, to);
  w.owner[id] = to;
  return { ...s, world: w };
}
const later = (s: GameState, h: number) => ({ ...s, worldMs: s.worldMs + h * H });
const tick = (s: GameState) => occAdminTick(annexTick(s));
const rich = (s: GameState): GameState => ({ ...s, nations: { ...s.nations, kr: { ...s.nations.kr, treasury: 1e9 } } });
const base = () => {
  const s = rich(newGame('t', 'kr', 0, { seed: 3 }));
  return withPolity(s, polityOf(s));
};

describe('점령지 관리청', () => {
  it('점령하면 관리단이 맡고 건의 3건을 한꺼번에 올림, 점령 직후엔 더 자주', () => {
    const fk = city('후쿠오카');
    let s = tick(give(base(), fk, 'kr'));
    expect(adminCities(s)).toContain(fk);
    expect(teamOf(s, fk)).not.toBeNull();
    expect(propsOfCity(s, fk).length).toBe(FIRST_BATCH);
    for (let i = 0; i < 12; i++) s = tick(later(s, 1));
    const n = propsOfCity(s, fk).length;
    expect(n).toBeGreaterThan(FIRST_BATCH);
    expect(n).toBeLessThanOrEqual(CAP_EARLY);
  });

  it('점령 도시에는 시·도지사가 없고 관리청이 맡음', () => {
    const fk = city('후쿠오카');
    const s = tick(give(base(), fk, 'kr'));
    expect(myGovernors(s).some(([id]) => id === fk)).toBe(false);
  });

  it('승인하면 예산을 쓰고 효과(군정 단축·피해 복구)가 바로 들어감', () => {
    const fk = city('후쿠오카');
    let s = tick(give(base(), fk, 'kr'));
    const before = annexEntry(s, fk)!;
    const money = s.nations.kr.treasury;
    const r = approveAll(s, fk);
    s = r.state;
    expect(r.n).toBeGreaterThan(0);
    expect(s.nations.kr.treasury).toBeLessThan(money);
    const after = annexEntry(s, fk)!;
    const changed = after.since !== before.since || after.damage !== before.damage || (after.reliefUntil ?? 0) > 0 || (after.sweepUntil ?? 0) > 0 || occAdminOf(s).marks.length > 0;
    expect(changed).toBe(true);
    expect(propsOfCity(s, fk).length).toBe(0);
  });

  it('예산이 모자라면 승인 못 함', () => {
    const fk = city('후쿠오카');
    let s = tick(give(base(), fk, 'kr'));
    s = { ...s, nations: { ...s.nations, kr: { ...s.nations.kr, treasury: 0 } } };
    const p = propsOfCity(s, fk)[0];
    expect(canApprove(s, p.id)).toMatch(/예산/);
    expect(approveProp(s, p.id).state).toBe(s);
  });

  it('점령 직후가 지나면 건의는 4건까지', () => {
    const fk = city('후쿠오카');
    let s = tick(give(base(), fk, 'kr'));
    s = tick(later(s, EARLY_HOURS + 1));
    for (let i = 0; i < 20; i++) s = tick(later(s, 3));
    expect(propsOfCity(s, fk).length).toBeLessThanOrEqual(CAP_NORMAL);
  });

  it('편입되면 시·도지사에게 넘기고 관리단은 기다리던 도시로 옮김', () => {
    const a = city('후쿠오카');
    const b = city('오사카');
    const c = city('나고야');
    let s = tick(give(give(give(base(), a, 'kr'), b, 'kr'), c, 'kr'));
    expect(occAdminOf(s).teams.length).toBe(2);
    const waiting = [a, b, c].find((x) => !teamOf(s, x))!;
    expect(waiting).toBeTruthy();
    const done = [a, b, c].find((x) => teamOf(s, x))!;
    s = { ...s, world: { ...s.world, annexed: { ...(s.world.annexed ?? {}), [done]: 'kr' } } };
    s = tick(later(s, 1));
    expect(teamOf(s, done)).toBeNull();
    expect(teamOf(s, waiting)).not.toBeNull();
    expect(myGovernors(s).some(([id]) => id === done)).toBe(true);
    expect(occAdminOf(s).handed).toBe(1);
    expect((s.reports ?? []).some((r) => r.text.includes('시·도지사'))).toBe(true);
  });

  it('도시를 잃으면 철수하고, 점령이 없으면 쉼', () => {
    const fk = city('후쿠오카');
    let s = tick(give(base(), fk, 'kr'));
    s = tick(later(give(s, fk, 'jp'), 1));
    expect(occAdminOf(s).teams.every((t) => !t.city)).toBe(true);
    expect(occAdminOf(s).list.length).toBe(0);
  });

  it('관리단은 늘릴 수 있음(6개까지)', () => {
    let s = base();
    s = { ...s, occAdmin: occAdminOf(s) };
    for (let i = 0; i < 10; i++) s = addTeam(s);
    expect(occAdminOf(s).teams.length).toBe(6);
  });

  it('군정 단축 건의는 군정 기간을 줄임', () => {
    const fk = city('후쿠오카');
    let s = tick(give(base(), fk, 'kr'));
    const a0 = annexEntry(s, fk)!;
    s = patchEntry(s, fk, { since: a0.since });
    s = { ...s, occAdmin: { ...occAdminOf(s), list: [{ id: 999, city: fk, kind: 'patrol', team: 1, atMs: s.worldMs, untilMs: s.worldMs + H }] } };
    s = approveProp(s, 999).state;
    expect(annexEntry(s, fk)!.since).toBe(a0.since - 4 * H);
    expect(MIL_HOURS).toBeGreaterThan(4);
  });
});
