// 시험판 전용: 자원을 넉넉히 줌(신뢰도는 호칭 점수라 건드리지 않음, 11-23).
import { BASIC_RES, RESOURCES, type Res } from '../data/economy';
/** 자원 24종으로 늘릴 때(11-23) 들어온 9종 */
const NEW_RES_24: Res[] = ['니켈', '텅스텐', '코발트', '특수강', '정밀부품', '게르마늄', '헬륨', '커피', '비단'];
import { DRILL_MAX } from './officer';
import type { GameState } from './state';

/** 봉급·국방예산·병력·자원·가속권·정보·훈련 일정 */
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
      drills: DRILL_MAX,
      drillAnchorMs: s.worldMs,
      testGrant: 3,
    },
  };
}

/** 새 판·옛 저장에 한 번만: 자원 넉넉히 */
export function firstTestGrant(s: GameState): GameState {
  if (s.officer.testGrant === 1 || s.officer.testGrant === 2) {
    // 자원 3안(11-23) 전 저장: 새 자원 8종, 자원 24종(11-23 저녁) 전 저장: 새 자원 9종만 한 번 더 넉넉히
    const stock = { ...s.economy.stock };
    const add = s.officer.testGrant === 1 ? RESOURCES.filter((r) => !BASIC_RES.includes(r)) : NEW_RES_24;
    for (const r of add) stock[r] = (stock[r] ?? 0) + 1000;
    return { ...s, economy: { ...s.economy, stock }, officer: { ...s.officer, testGrant: 3 } };
  }
  if (s.officer.testGrant) return s;
  return grantTestResources(s);
}
