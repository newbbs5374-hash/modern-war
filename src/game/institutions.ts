// 도시 기관 효과 합치기(data/institutions.ts). 내 나라가 가진 도시의 기관만, 점령지는 절반.
import { CITIES } from '../data/cities';
import { CITY_INST, type InstId } from '../data/institutions';
import { homeOf, type WorldState } from './world';

const VALUE: Record<InstId, number> = { lab: 0.15, univ: 0.1, bank: 0.04, army: 0.08, navy: 0.1, air: 0.1, nuke: 0.03, intel: 0.03 };

/** 나라가 가진 기관 효과 합(점령지 기관은 절반) */
export function instSum(w: WorldState, countryId: string, id: InstId): number {
  let v = 0;
  for (const c of CITIES) {
    if (w.owner[c.id] !== countryId) continue;
    const n = (CITY_INST[c.name] ?? []).filter((x) => x === id).length;
    v += n * VALUE[id] * (homeOf(w, c.id) === countryId ? 1 : 0.5);
  }
  return v;
}
/** 도시 방어 배율(육군 기지) */
export const instDefense = (cityName: string) => ((CITY_INST[cityName] ?? []).includes('army') ? 1.15 : 1);
/** 나라가 가진 기관 도시 목록(지도 표시용) */
export function instCities(w: WorldState, countryId: string, id: InstId): string[] {
  return CITIES.filter((c) => w.owner[c.id] === countryId && (CITY_INST[c.name] ?? []).includes(id)).map((c) => c.id);
}
