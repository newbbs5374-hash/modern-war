// 11-28 새 자원 12종의 '가지고 있으면' 효과(대장 "자원을 더 많이"). 생활 자원(금·와인·카카오)은 다른 생활 자원처럼 민심 +3.
import type { Res } from '../data/economy';
import { registerDomRows, type Rows } from './domestic';
import type { LawKey } from './laws';
import { RES_ICON } from '../data/economy';

/** 이만큼 넘게 가지고 있어야 효과 */
export const PERK_MIN = 50;
export const RES_PERKS: Array<{ res: Res; key: LawKey; v: number }> = [
  { res: '천연가스', key: 'budget', v: 0.02 },
  { res: '석탄', key: 'res', v: 0.03 },
  { res: '마그네슘', key: 'build', v: 0.02 },
  { res: '망간', key: 'build', v: 0.02 },
  { res: '크롬', key: 'defense', v: 2 },
  { res: '바나듐', key: 'defense', v: 2 },
  { res: '몰리브덴', key: 'defense', v: 2 },
  { res: '백금', key: 'research', v: 0.03 },
  { res: '인듐', key: 'research', v: 0.02 },
];

registerDomRows((s, key) => {
  const rows: Rows = [];
  for (const p of RES_PERKS) if (p.key === key && (s.economy.stock[p.res] ?? 0) >= PERK_MIN) rows.push([`${RES_ICON[p.res]} ${p.res} 비축`, p.v]);
  return rows;
});
