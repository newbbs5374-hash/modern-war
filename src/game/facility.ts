// 시설 효과 계산(다른 모듈이 서로 부르지 않게 따로 둠)
import { BUFF_EFF, BUILDINGS, BUILDING_SCALE, levelEff, type BuildingId, type Facility } from '../data/economy';
import type { GameState } from './state';
import { FAC_EFF, FAC_MILESTONE, FAC_NEED, FIELD_TIER_AT, FIELD_TIER_EFF, scaleEff } from '../data/facilityGrowth';
import type { Eff } from '../data/civ';

/** 시설 효과(단계 + 특별 가동 중이면 +BUFF_EFF). 0단계(아직 안 지음) = 0 */
export function facEff(s: GameState, id: BuildingId): number {
  const b = s.economy?.buildings?.[id];
  if (!b || b.level < 1) return 0;
  return levelEff(id, b.level) + (b.buffEndMs > s.worldMs ? BUFF_EFF : 0);
}
/** 새 시설처럼 세기가 따로 정해진 효과(BUILDING_SCALE 곱함) */
export const facBonus = (s: GameState, id: BuildingId): number => facEff(s, id) * (BUILDING_SCALE[id] ?? 1);

// ── 시설 단계별 성장(11-24): 새 시설 효과 · 3·5단계 보너스 · 분야 성장 단계 ──

const lvOf = (s: GameState, id: BuildingId): number => s.economy?.buildings?.[id]?.level ?? 0;

/** 분야 성장 단계(0~5): 분야 시설 단계 합 ÷ (시설 수 × 5) */
export function fieldTier(s: GameState, f: Facility): number {
  const list = BUILDINGS.filter((b) => b.fac === f);
  const sum = list.reduce((a, b) => a + Math.max(0, lvOf(s, b.id)), 0);
  const r = sum / (list.length * 5);
  return FIELD_TIER_AT.filter((t) => r >= t - 1e-9).length;
}
/** 다음 분야 단계까지 필요한 시설 단계 합(이미 최고면 0) */
export function fieldTierProgress(s: GameState, f: Facility): { sum: number; max: number; next: number } {
  const list = BUILDINGS.filter((b) => b.fac === f);
  const sum = list.reduce((a, b) => a + Math.max(0, lvOf(s, b.id)), 0);
  const max = list.length * 5;
  const t = fieldTier(s, f);
  return { sum, max, next: t >= 5 ? max : Math.ceil(FIELD_TIER_AT[t] * max - 1e-9) };
}

/** 먼저 지어야 하는 시설이 모자라면 이유 */
export function facNeedWhy(s: GameState, id: BuildingId): string | null {
  const n = FAC_NEED[id];
  if (!n || lvOf(s, id) >= 1) return null;
  return lvOf(s, n.id) >= n.lv ? null : `${n.id} ${n.lv}단계 필요`;
}

/** 시설에서 나오는 모든 효과(연구·체제 효과와 함께 civEffects에서 더함) */
export function facilityEffects(s: GameState): Eff[] {
  if (!s.economy?.buildings) return [];
  const out: Eff[] = [];
  for (const b of BUILDINGS) {
    const lv = lvOf(s, b.id);
    if (lv < 1) continue;
    const base = FAC_EFF[b.id];
    if (base) {
      const buff = (s.economy.buildings[b.id].buffEndMs ?? 0) > s.worldMs ? BUFF_EFF : 0;
      out.push(scaleEff(base.eff, Math.min(1.2, levelEff(b.id, lv) + buff)));
    }
    const m = FAC_MILESTONE[b.id];
    if (m && lv >= 3) out.push(m[3].eff);
    if (m && lv >= 5) out.push(m[5].eff);
  }
  for (const f of Object.keys(FIELD_TIER_EFF) as Facility[]) {
    const t = fieldTier(s, f);
    if (t > 0) out.push(scaleEff(FIELD_TIER_EFF[f].eff, t));
  }
  return out;
}
