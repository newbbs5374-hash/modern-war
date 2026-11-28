// 11-28 국제 회의 안건 올리기·로비
import { describe, expect, test } from 'vitest';
import { advance, newGame, type GameState } from './state';
import { PROPOSE_COST, canLobby, canPropose, civOf, councilTally, lobby, lobbyCost, proposeCouncil, LOBBY_MAX } from './civ';
import { COUNTRIES } from '../data/world';

const rich = (s: GameState): GameState => ({ ...s, nations: { ...s.nations, kr: { ...s.nations.kr, treasury: 1e7 } } });

describe('국제 회의 안건·로비', () => {
  test('안건을 올리면 바로 열리고 내 표는 찬성, 다시 올리려면 기다림', () => {
    let s = rich(newGame('t', 'kr', 0, { seed: 4, realWorld: true }));
    const civ0 = civOf(s);
    s = { ...s, civ: { ...civ0, council: { ...civ0.council, open: null } } };
    expect(canPropose(s, 'sanction')).toBeTruthy();
    expect(canPropose(s, 'science')).toBeNull();
    const t0 = s.nations.kr.treasury;
    s = proposeCouncil(s, 'science');
    const o = civOf(s).council.open!;
    expect(o.agenda).toBe('science');
    expect(o.vote).toBe(true);
    expect(s.nations.kr.treasury).toBe(t0 - PROPOSE_COST);
    expect(canPropose({ ...s, civ: { ...civOf(s), council: { ...civOf(s).council, open: null } } }, 'science')).toBeTruthy();
    // 로비
    const ids = COUNTRIES.filter((x) => x.id !== 'kr' && !canLobby(s, x.id)).map((x) => x.id);
    expect(ids.length).toBeGreaterThan(LOBBY_MAX);
    const before = councilTally(s)!.yes;
    const t1 = s.nations.kr.treasury;
    s = lobby(s, ids[0]);
    expect(s.nations.kr.treasury).toBe(t1 - lobbyCost(s, ids[0]));
    expect(councilTally(s)!.yes).toBeGreaterThan(before);
    expect(canLobby(s, ids[0])).toBeTruthy();
    for (const id of ids.slice(1, LOBBY_MAX)) s = lobby(s, id);
    expect(canLobby(s, ids[LOBBY_MAX])).toBeTruthy();
    s = advance(s, 7 * 3600e3);
    expect(civOf(s).council.open?.mine ?? false).toBe(false);
    expect(civOf(s).council.last).toContain('연구 공유');
  });
});

import { isleEventTick, isleHot } from './isleEvents';
import { chooseCrisis, crisisOf } from './crisis';
import { PIONEER_ISLANDS } from '../data/hexmap';

describe('분쟁 지역 사건', () => {
  test('영향력을 다투는 섬에서 사건이 열리고, 고르면 그 섬 영향력이 바뀜', () => {
    let s = rich(advance(newGame('t', 'kr', 0, { seed: 4, realWorld: true }), 3600e3));
    const isle = PIONEER_ISLANDS[0].id;
    const civ = civOf(s);
    s = { ...s, civ: { ...civ, influence: { ...civ.influence, [isle]: { kr: 20, jp: 25 } } }, crisis: { ...crisisOf(s), open: null } };
    const hot = isleHot(s);
    expect(hot).toBeTruthy();
    s = isleEventTick({ ...s, isleEvMs: s.worldMs });
    const o = crisisOf(s).open!;
    expect(o.isle).toBe(hot!.isle);
    expect(o.def.startsWith('isle_')).toBe(true);
    const before = civOf(s).influence[o.isle!]?.kr ?? 0;
    s = chooseCrisis(s, 0);
    expect(crisisOf(s).open).toBeNull();
    expect(civOf(s).influence[o.isle!]?.kr ?? 0).toBeGreaterThan(before);
  });
});

import { CH_COST, canChallenge, challenge, challengeInfo, isCrowned } from './regionChallenge';
import { regionStanding } from './hegemony';
import { regionOf } from '../data/regions';
import { domRows } from './domestic';

describe('대륙 패권 도전', () => {
  test('조건이 맞으면 도전, 이기면 맹주(예산 +10%), 다시 하려면 기다림', () => {
    let s = rich(advance(newGame('t', 'kr', 0, { seed: 4, realWorld: true }), 3600e3));
    const st = regionStanding(s, regionOf('kr'));
    const top = st[0].id === 'kr' ? st[1].id : st[0].id;
    // 1등을 우리보다 조금 세게 맞춤
    s = { ...s, nations: { ...s.nations, [top]: { ...s.nations[top], troops: s.nations.kr.troops, treasury: s.nations.kr.treasury * 1.2 } } };
    const i = challengeInfo(s);
    expect(i.rank).toBeGreaterThan(1);
    expect(i.rank).toBeLessThanOrEqual(3);
    expect(i.ratio).toBeGreaterThanOrEqual(0.6);
    expect(canChallenge(s)).toBeNull();
    const t0 = s.nations.kr.treasury;
    const r = challenge(s);
    expect(r.state.nations.kr.treasury).toBe(t0 - CH_COST);
    expect(canChallenge(r.state)).toBeTruthy();
    if (isCrowned(r.state)) expect(domRows(r.state, 'budget').some(([n]) => n.includes('맹주'))).toBe(true);
  });
});
