// 11-28 대장 결정(분쟁 사다리 4단계): 점령은 도시를 갖는 것으로 끝나지 않는다.
//  · 장악도 0→100: 점령 직후 0에서 시작해 실제 1시간마다 오름(주둔군·민정·민심이 빠르게)
//  · 주둔군: 가볍게·보통·많이(0~2). 많을수록 장악도가 빨리 오르지만 나라 병력이 그만큼 묶임
//  · 저항: 장악도 50 밑이면 가끔 저항(방어도·민심 ↓). 장악도가 낮으면 점령지 세금이 덜 들어옴
//  · 편입 주민투표는 장악도 60부터
// 장악도는 편입 진행 기록(world.annex.ctl), 주둔군은 s.gars(도시를 잃어도 남아 병력을 돌려줌). 옛 저장의 점령지는 장악도 50으로 대접.
import { cityById } from '../data/cities';
import { annexEntry, occupiedCities, setEntry } from './annex';
import { cityCiv } from './civ';
import { pushReport } from './report';
import { faithResist } from './faith';
import { Rng } from './rng';
import type { GameState } from './state';
import type { AnnexCity } from './world';

const H = 3600e3;
/** 실제 1시간에 오르는 장악도: 바탕 + 주둔군 단계마다 + 민정이면 + 민심 60 넘으면 */
export const CTL_BASE = 1;
export const CTL_PER_GAR = 1.5;
export const CTL_CIVIL = 1;
export const CTL_LOYAL = 0.5;
/** 주둔군 한 단계가 묶는 병력 = 도시 값어치 × 이것 */
export const GAR_TROOPS = 400;
/** 장악도 50 밑일 때 실제 1시간 저항 확률 = (50 − 장악도)/50 × 이것 */
export const RESIST_CHANCE = 0.04;
/** 편입 투표에 필요한 장악도 */
export const CTL_VOTE = 60;
export const GAR_NAMES = ['가볍게', '보통', '많이'] as const;

export const ctlOf = (a: AnnexCity | null | undefined) => (a ? (a.ctl ?? 50) : 100);
/** 점령지 세금 배율(장악도 0 → 0.6, 100 → 1) */
export const ctlIncome = (a: AnnexCity | null | undefined) => (a && !a.mode ? 0.6 + 0.4 * (ctlOf(a) / 100) : 1);
export const garTroops = (cityId: string, gar: number) => Math.round(cityById(cityId).value * GAR_TROOPS * gar);

export const garOf = (s: GameState, cityId: string): 0 | 1 | 2 => s.gars?.[cityId] ?? 0;
export function ctlRate(s: GameState, cityId: string): number {
  const a = annexEntry(s, cityId);
  if (!a) return 0;
  return CTL_BASE + garOf(s, cityId) * CTL_PER_GAR + (a.stage === '민정' ? CTL_CIVIL : 0) + (cityCiv(s, cityId).loyalty >= 60 ? CTL_LOYAL : 0);
}

/** 주둔군 바꾸기: 나라 병력에서 묶거나 돌려줌 */
export function setGarrison(s: GameState, cityId: string, gar: 0 | 1 | 2): GameState {
  const a = annexEntry(s, cityId);
  if (!a || a.mode) return s;
  const me = s.player.countryId;
  const need = garTroops(cityId, gar) - garTroops(cityId, garOf(s, cityId));
  if (need > 0 && s.nations[me].troops < need) return s;
  const gars = { ...(s.gars ?? {}) };
  if (gar) gars[cityId] = gar;
  else delete gars[cityId];
  return { ...s, gars, nations: { ...s.nations, [me]: { ...s.nations[me], troops: s.nations[me].troops - need } } };
}
export function canGarrison(s: GameState, cityId: string, gar: 0 | 1 | 2): string | null {
  const a = annexEntry(s, cityId);
  if (!a || a.mode) return '점령지가 아니에요';
  if (garOf(s, cityId) === gar) return '지금 그대로예요';
  const need = garTroops(cityId, gar) - garTroops(cityId, garOf(s, cityId));
  if (need > 0 && s.nations[s.player.countryId].troops < need) return `병력 ${need.toLocaleString('ko-KR')} 필요`;
  return null;
}

/** 세계 판단마다: 장악도 오름 · 저항 · 잃은 도시 주둔군 돌려받기 */
export function controlTick(s: GameState): GameState {
  let out = s;
  const me = s.player.countryId;
  const occ = occupiedCities(s);
  const rng = new Rng(((s.world.seed ^ Math.floor(s.worldMs / 60e3)) * 40503 + 0xc7) >>> 0);
  for (const id of occ) {
    const a = annexEntry(out, id);
    if (!a || a.mode) continue;
    const last = a.ctlMs ?? s.worldMs;
    const h = Math.min(48, (s.worldMs - last) / H);
    if (a.ctlMs == null) {
      out = setEntry(out, id, { ...a, ctl: a.ctl ?? 50, ctlMs: s.worldMs });
      continue;
    }
    if (h < 0.25) continue;
    let ctl = Math.min(100, ctlOf(a) + ctlRate(out, id) * h);
    let next: AnnexCity = { ...a, ctl, ctlMs: s.worldMs };
    if (ctl < 50 && rng.chance(Math.min(0.9, ((50 - ctl) / 50) * RESIST_CHANCE * h * faithResist(out) / (1 + garOf(out, id))))) {
      ctl = Math.max(0, ctl - 5);
      next = { ...next, ctl };
      out = setEntry(out, id, next);
      const defense = { ...out.world.defense, [id]: Math.max(0, (out.world.defense[id] ?? 0) - 5) };
      out = { ...out, world: { ...out.world, defense } };
      const civ = out.civ;
      if (civ?.cities[id]) out = { ...out, civ: { ...civ, cities: { ...civ.cities, [id]: { ...civ.cities[id], loyalty: Math.max(0, civ.cities[id].loyalty - 3) } } } };
      out = pushReport(out, { icon: '💥', text: `대장님, ${cityById(id).name}에서 저항이 일어났습니다. 방어도 −5 · 민심 −3 · 장악도 −5. 주둔군을 늘리면 줄어듭니다.` });
      continue;
    }
    if (ctlOf(a) < 100 && ctl >= 100) out = pushReport(out, { icon: '🛡️', text: `대장님, ${cityById(id).name} 장악도가 100이 됐습니다. 주둔군을 줄여 병력을 돌려받아도 됩니다.` });
    out = setEntry(out, id, next);
  }
  // 주둔군 장부: 잃은 도시는 절반만, 편입·처분이 끝난 도시는 모두 돌아옴
  const gars = { ...(out.gars ?? {}) };
  let back = 0;
  for (const [id, g] of Object.entries(gars)) {
    const a = annexEntry(out, id);
    if (out.world.owner[id] === me && a && !a.mode) continue;
    back += garTroops(id, g) * (out.world.owner[id] === me ? 1 : 0.5);
    delete gars[id];
  }
  if (back || Object.keys(gars).length !== Object.keys(out.gars ?? {}).length) {
    out = { ...out, gars, nations: { ...out.nations, [me]: { ...out.nations[me], troops: out.nations[me].troops + Math.round(back) } } };
  }
  return out;
}

