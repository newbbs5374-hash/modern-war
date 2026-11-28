// 11-28 국정 37 강화: 세금 종류. 소득세·법인세·부가세를 낮춤·보통·높임 중에서 고름(처음엔 모두 보통 = 효과 없음).
// 높이면 나라 예산이 늘지만 지지도·경제·민심이 깎이고, 낮추면 반대. 실제 24시간마다 한 번 바꿀 수 있음.
import { registerDomRows, type Rows } from './domestic';
import type { LawKey } from './laws';
import type { GameState } from './state';

const H = 3600e3;
export const TAX_WAIT = 24 * H;
export type TaxId = 'income' | 'corp' | 'vat';
export type TaxLv = 'low' | 'mid' | 'high';
export interface TaxDef {
  id: TaxId;
  icon: string;
  name: string;
  low: Partial<Record<LawKey, number>>;
  high: Partial<Record<LawKey, number>>;
}
export const TAXES: TaxDef[] = [
  { id: 'income', icon: '👷', name: '소득세', low: { budget: -0.04, approval: 2 }, high: { budget: 0.04, approval: -2 } },
  { id: 'corp', icon: '🏢', name: '법인세', low: { budget: -0.03, economy: 2, res: 0.03 }, high: { budget: 0.04, economy: -2 } },
  { id: 'vat', icon: '🛒', name: '부가세', low: { budget: -0.03, loyalty: 2 }, high: { budget: 0.03, loyalty: -2 } },
];
export const TAX_LV_NAME: Record<TaxLv, string> = { low: '낮춤', mid: '보통', high: '높임' };
export interface TaxState {
  lv: Record<TaxId, TaxLv>;
  nextMs: number;
}
export const taxOf = (s: GameState): TaxState => s.taxes ?? { lv: { income: 'mid', corp: 'mid', vat: 'mid' }, nextMs: 0 };
export const taxEff = (d: TaxDef, lv: TaxLv): Partial<Record<LawKey, number>> => (lv === 'mid' ? {} : d[lv]);

export function canSetTax(s: GameState, id: TaxId, lv: TaxLv): string | null {
  const t = taxOf(s);
  if (t.lv[id] === lv) return '지금 그대로예요';
  if (s.worldMs < t.nextMs) return `${Math.ceil((t.nextMs - s.worldMs) / H)}시간 뒤에 다시 바꿀 수 있어요`;
  return null;
}
export function setTax(s: GameState, id: TaxId, lv: TaxLv): GameState {
  if (canSetTax(s, id, lv)) return s;
  const t = taxOf(s);
  return { ...s, taxes: { lv: { ...t.lv, [id]: lv }, nextMs: s.worldMs + TAX_WAIT } };
}
registerDomRows((s, key) => {
  if (!s.taxes) return [];
  const rows: Rows = [];
  for (const d of TAXES) {
    const lv = s.taxes.lv[d.id];
    const v = taxEff(d, lv)[key];
    if (v) rows.push([`🧾 ${d.name} ${TAX_LV_NAME[lv]}`, v]);
  }
  return rows;
});
