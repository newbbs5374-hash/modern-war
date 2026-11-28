import { describe, expect, it } from 'vitest';
import { newGame, setRank, type GameState } from './state';
import { RANKS } from '../data/ranks';
import { FRONT } from '../data/cities';
import { campLeader, campOf, campsTick, canSwitch, contribute, isCampLeader, switchCamp, voteCouncil, campMult } from './camps';
import { aiWars, backSide, canBack, proxyTick } from './proxy';
import { RACE_NEED, pushRace, raceTick, stealRace, canSteal } from './techRace';
import { newSecrets, secretTick } from './secretGoals';
import { collapseTick, inCivilWar } from './collapse';
import { canPacify, pacify } from './control';
import { influenceAll } from './influence';
import { pairKey } from './world';
import { voteRows } from './seats';

const H = 3600e3;
const fresh = (act = 3): GameState => {
  const s = setRank(newGame('시험', 'kr', 0, { seed: 11, acts: true }), RANKS.length - 1);
  return { ...s, world: { ...s.world, act }, nations: { ...s.nations, kr: { ...s.nations.kr, treasury: 1e9 } } };
};
const war = (s: GameState, a: string, b: string): GameState => {
  const k = pairKey(a, b);
  return { ...s, world: { ...s.world, pairs: { ...s.world.pairs, [k]: { ...s.world.pairs[k], rel: '전쟁', tension: 100 } } } };
};

describe('11-28 6단계 진영 세계', () => {
  it('2장에는 진영이 없고, 3장이 되면 세계가 갈림', () => {
    expect(campsTick(fresh(2)).camps).toBeUndefined();
    const s = campsTick(fresh(3));
    expect(s.camps).toBeTruthy();
    expect(campOf(s, 'kr')).toBe('west');
    expect(campOf(s, 'cn')).toBe('east');
  });
  it('기여를 쌓으면 맹주가 되고 예산 덤을 받음', () => {
    let s = campsTick(fresh());
    for (let d = 0; d < 6 && !isCampLeader(s, 'kr'); d++) {
      for (let i = 0; i < 3; i++) s = contribute(s).state;
      s = { ...s, camps: { ...s.camps!, contrib: { day: '', n: 0 } } };
    }
    expect(campLeader(s, 'west')).toBe('kr');
    expect(campMult(s, 'kr')).toBeGreaterThan(1);
    expect(s.camps!.wasLeader).toBe(true);
    expect(influenceAll(s).kr.bonus).toBeGreaterThanOrEqual(20);
  });
  it('진영 바꾸기는 7일에 한 번, 옛 진영 호감이 떨어짐', () => {
    let s = campsTick(fresh());
    expect(canSwitch(s, 'east')).toBeNull();
    s = switchCamp(s, 'east').state;
    expect(campOf(s, 'kr')).toBe('east');
    expect(canSwitch(s, 'west')).toContain('7일');
    expect(s.civ!.notes['us']?.some((n) => n.text.includes('배신'))).toBe(true);
  });
  it('진영 회의가 열리고 투표·결과가 남음', () => {
    let s = campsTick(fresh());
    s = { ...s, worldMs: s.camps!.councilMs + 1 };
    for (let i = 0; i < 6 && (!s.camps!.council || s.camps!.council.camp !== 'west'); i++) {
      s = campsTick({ ...s, camps: { ...s.camps!, council: null, councilMs: s.worldMs } });
    }
    expect(s.camps!.council).toBeTruthy();
    if (s.camps!.council!.camp === 'west') {
      s = voteCouncil(s, 'yes').state;
      expect(s.camps!.council!.vote).toBe('yes');
    }
    s = campsTick({ ...s, worldMs: s.camps!.council!.endMs + 1 });
    expect(s.camps!.council).toBeNull();
  });
});

describe('11-28 6단계 대리전·기술 경주·비밀 목표·붕괴·점령지·선거', () => {
  it('AI끼리 전쟁이면 한쪽을 도울 수 있고, 이기면 이권', () => {
    let s = war(fresh(), 'in', 'pk');
    expect(aiWars(s).some((w) => w.key === pairKey('in', 'pk'))).toBe(true);
    expect(canBack(s, 'in', 'pk', 'arms')).toBeNull();
    const before = s.nations.in.troops;
    s = backSide(s, 'in', 'pk', 'arms').state;
    expect(s.nations.in.troops).toBeGreaterThan(before);
    expect(canBack(s, 'pk', 'in', 'money')).toContain('반대편');
    // 인도가 파키스탄 도시를 하나 가져가고 전쟁이 끝남
    const city = FRONT.find((c) => c.home === 'pk' && !c.capital)!;
    const k = pairKey('in', 'pk');
    s = { ...s, world: { ...s.world, owner: { ...s.world.owner, [city.id]: 'in' }, pairs: { ...s.world.pairs, [k]: { ...s.world.pairs[k], rel: '휴전' } } } };
    s = proxyTick(s);
    expect(s.proxy!.wins).toBe(1);
    expect(s.proxy!.rights.length).toBe(1);
  });
  it('기술 경주는 먼저 채운 나라가 이김', () => {
    let s = raceTick(fresh());
    s = { ...s, race: { ...s.race!, pts: { ...s.race!.pts, ai: { kr: RACE_NEED - 1 } } } };
    s = pushRace(s, 'ai').state;
    expect(s.race!.winner.ai).toBe('kr');
    expect(pushRace(s, 'ai').text).toContain('끝난');
    s = { ...s, race: { ...s.race!, pts: { ...s.race!.pts, fusion: { cn: 50 } } } };
    expect(canSteal(s, 'fusion')).toBeNull();
    const r = stealRace(s, 'fusion');
    expect(r.state.race!.stealMs).toBeGreaterThan(s.worldMs);
  });
  it('한국은 북한 통일 비밀 목표를 받고, 이루면 표시됨', () => {
    const s0 = fresh();
    const list = newSecrets(s0);
    expect(list.length).toBe(3);
    expect(list[0]).toMatchObject({ id: 'unifyOne', arg: 'kp' });
    let s = secretTick(s0);
    const cap = FRONT.find((c) => c.home === 'kp' && c.capital)!;
    s = secretTick({ ...s, world: { ...s.world, owner: { ...s.world.owner, [cap.id]: 'kr' } } });
    expect(s.secrets![0].done).toBe(true);
  });
  it('크게 진 강대국은 내전에 빠짐', () => {
    let s = fresh();
    const owner = { ...s.world.owner };
    const home = FRONT.filter((c) => c.home === 'ru');
    home.filter((c) => !c.capital).forEach((c) => (owner[c.id] = 'ua'));
    s = campsTick({ ...s, world: { ...s.world, owner } });
    const troops = s.nations.ru.troops;
    s = collapseTick(s);
    expect(inCivilWar(s, 'ru')).toBe(true);
    expect(s.nations.ru.troops).toBeLessThan(troops);
    expect(s.camps!.rise).toBe(true);
  });
  it('점령지 강경 진압·재건 사업', () => {
    let s = fresh();
    const city = FRONT.find((c) => c.home === 'kp' && !c.capital)!;
    s = { ...s, world: { ...s.world, owner: { ...s.world.owner, [city.id]: 'kr' }, annex: { [city.id]: { stage: '군정', since: s.worldMs, okSince: null, voteAt: null, retryMs: 0, ctl: 10, ctlMs: s.worldMs } } } };
    expect(canPacify(s, city.id, 'crush')).toBeNull();
    s = pacify(s, city.id, 'crush').state;
    expect(s.world.annex![city.id].ctl).toBe(35);
    expect(canPacify(s, city.id, 'heal')).toContain('24시간');
  });
  it('전쟁 피로가 득표를 깎음', () => {
    let s = war(fresh(), 'kr', 'kp');
    const k = pairKey('kr', 'kp');
    s = { ...s, world: { ...s.world, pairs: { ...s.world.pairs, [k]: { ...s.world.pairs[k], weariness: 90 } } } };
    if (s.polity) expect(voteRows(s).some(([n]) => n.includes('전쟁 피로'))).toBe(true);
  });
  it('3장 판이 하루 흘러도 깨지지 않음', async () => {
    const { skip } = await import('./state');
    const s = skip(fresh(), 24 * H);
    expect(s.camps).toBeTruthy();
    expect(s.race).toBeTruthy();
    expect(s.secrets?.length).toBe(3);
  });
});
