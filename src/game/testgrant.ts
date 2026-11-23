// 시험판 전용: 자원을 넉넉히 주고, 승급 조건을 바로 채워 승급 뒤 상황을 볼 수 있게 함.
import { PROMOTION } from '../data/officers';
import { BASIC_RES, RESOURCES } from '../data/economy';
import { DRILL_MAX } from './officer';
import type { GameState } from './state';

/** 봉급·국방예산·병력·자원 7종·가속권·정보·신뢰도·훈련 일정 */
export function grantTestResources(s: GameState): GameState {
  const me = s.player.countryId;
  const stock = { ...s.economy.stock };
  for (const r of RESOURCES) stock[r] = (stock[r] ?? 0) + 1000;
  return {
    ...s,
    player: { ...s.player, salary: s.player.salary + 200_000 },
    nations: { ...s.nations, [me]: { ...s.nations[me], treasury: s.nations[me].treasury + 2_000_000, troops: s.nations[me].troops + 300_000 } },
    economy: {
      ...s.economy,
      stock,
      facilities: Object.fromEntries(Object.entries(s.economy.facilities).map(([k, f]) => [k, { ...f, exp: f.exp + 1000 }])) as GameState['economy']['facilities'],
    },
    officer: {
      ...s.officer,
      boosts: (s.officer.boosts ?? 0) + 300,
      intel: s.officer.intel + 500,
      trust: 100,
      drills: DRILL_MAX,
      drillAnchorMs: s.worldMs,
      testGrant: 2,
    },
  };
}

/** 지금 계급의 승급 조건(공훈·훈련 별·신뢰도)을 채움. 승급하면 0부터라 계급마다 누르면 됨 */
export function fillPromotion(s: GameState): GameState {
  const rule = PROMOTION[s.player.rankIndex];
  if (!rule) return s;
  const o = s.officer;
  const merit = Math.max(o.merit, rule.merit);
  return {
    ...s,
    officer: { ...o, merit, totalMerit: o.totalMerit + (merit - o.merit), stars: Math.max(o.stars, rule.stars), trust: Math.max(o.trust, rule.trust ?? 0, 100), examReadyMs: 0 },
  };
}

/** 새 판·옛 저장에 한 번만: 자원 넉넉히 + 첫 승급 조건 */
export function firstTestGrant(s: GameState): GameState {
  if (s.officer.testGrant === 1) {
    // 자원 3안(11-23) 전 저장: 새 자원 8종만 한 번 더 넉넉히
    const stock = { ...s.economy.stock };
    for (const r of RESOURCES) if (!BASIC_RES.includes(r)) stock[r] = (stock[r] ?? 0) + 1000;
    return { ...s, economy: { ...s.economy, stock }, officer: { ...s.officer, testGrant: 2 } };
  }
  if (s.officer.testGrant) return s;
  return fillPromotion(grantTestResources(s));
}
