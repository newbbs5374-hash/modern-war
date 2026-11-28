// 11-28 국정 37 강화: 부처 예산 나누기. 예산 점수 10점을 5갈래(국방·경제·복지·과학·외교)에 나눔(처음엔 2점씩 = 효과 없음).
// 2점보다 많이 준 갈래는 점수마다 효과 +, 적게 준 갈래는 점수마다 효과 −(절반). 실제 12시간마다 한 번 바꿀 수 있음.
import { registerDomRows, type Rows } from './domestic';
import type { LawKey } from './laws';
import type { GameState } from './state';

const H = 3600e3;
export const MB_TOTAL = 10;
export const MB_BASE = 2;
export const MB_MAX = 5;
export const MB_WAIT = 12 * H;
export type MbId = 'def' | 'eco' | 'wel' | 'sci' | 'dip';
export interface MbDef {
  id: MbId;
  icon: string;
  name: string;
  /** 1점마다 효과(많이 줄 때) */
  per: Partial<Record<LawKey, number>>;
  text: string;
}
export const MB_DEFS: MbDef[] = [
  { id: 'def', icon: '🛡️', name: '국방', per: { build: 0.03, defense: 1.5 }, text: '모집 +3% · 안보 +1.5' },
  { id: 'eco', icon: '📈', name: '경제', per: { economy: 1.5, res: 0.03 }, text: '경제 +1.5 · 자원 +3%' },
  { id: 'wel', icon: '🏥', name: '복지', per: { approval: 1, loyalty: 1.5 }, text: '지지도 +1 · 민심 +1.5' },
  { id: 'sci', icon: '🔬', name: '과학', per: { research: 0.05 }, text: '연구 +5%' },
  { id: 'dip', icon: '🌐', name: '외교', per: { favor: 1, diplo: 1.5 }, text: '호감 +1 · 외교 +1.5' },
];
export interface MbState {
  pts: Record<MbId, number>;
  nextMs: number;
}
export const mbOf = (s: GameState): MbState => s.mbudget ?? { pts: { def: 2, eco: 2, wel: 2, sci: 2, dip: 2 }, nextMs: 0 };
export const mbUsed = (p: Record<MbId, number>) => Object.values(p).reduce((a, b) => a + b, 0);

export function canSetMb(s: GameState, pts: Record<MbId, number>): string | null {
  if (s.worldMs < mbOf(s).nextMs) return `${Math.ceil((mbOf(s).nextMs - s.worldMs) / H)}시간 뒤에 다시 바꿀 수 있어요`;
  if (mbUsed(pts) !== MB_TOTAL) return `점수 ${MB_TOTAL}점을 모두 나눠야 해요`;
  if (Object.values(pts).some((v) => v < 0 || v > MB_MAX || !Number.isInteger(v))) return `한 갈래에 0~${MB_MAX}점`;
  return null;
}
export function setMb(s: GameState, pts: Record<MbId, number>): GameState {
  if (canSetMb(s, pts)) return s;
  return { ...s, mbudget: { pts: { ...pts }, nextMs: s.worldMs + MB_WAIT } };
}
/** 한 갈래의 효과(점수 차 × 1점 효과, 적게 주면 절반) */
export function mbEff(d: MbDef, v: number): Partial<Record<LawKey, number>> {
  const k = v - MB_BASE;
  const m = k >= 0 ? k : k * 0.5;
  const out: Partial<Record<LawKey, number>> = {};
  for (const [key, x] of Object.entries(d.per)) out[key as LawKey] = Math.round(x! * m * 1000) / 1000;
  return out;
}
registerDomRows((s, key) => {
  if (!s.mbudget) return [];
  const rows: Rows = [];
  for (const d of MB_DEFS) {
    const v = mbEff(d, s.mbudget.pts[d.id])[key];
    if (v) rows.push([`💼 부처 예산 ${d.icon}${d.name} ${s.mbudget.pts[d.id]}점`, v]);
  }
  return rows;
});

export const MB_KEY_NAME: Partial<Record<LawKey, string>> = { build: '모집', defense: '안보', economy: '경제', res: '자원', approval: '지지도', loyalty: '민심', research: '연구', favor: '호감', diplo: '외교', budget: '나라 예산' };
const PCT: LawKey[] = ['build', 'res', 'research', 'budget', 'troop', 'spy'];
/** 효과 한 줄 글("모집 +3% · 안보 +1.5") */
export function mbText(e: Partial<Record<LawKey, number>>): string {
  return Object.entries(e)
    .filter(([, v]) => v)
    .map(([k, v]) => `${MB_KEY_NAME[k as LawKey] ?? k} ${v! > 0 ? '+' : '−'}${PCT.includes(k as LawKey) ? `${Math.round(Math.abs(v!) * 100)}%` : Math.round(Math.abs(v!) * 10) / 10}`)
    .join(' · ');
}
