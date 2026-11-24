// 부처·청 소속 시설(11-24 대장 요청 5번). 단계는 cabinet.fac[id]에 둠.
import { COUNTRIES } from '../data/world';
import { GOV_FACILITIES, GOV_FAC_MAX, govFacById, govFacCost, type GovFacility } from '../data/govFacilities';
import type { MinistryId } from '../data/cabinet';
import type { PostEff } from '../data/staff';
import { cabinetOf, ministerOf, postHolder } from './cabinet';
import { domOf } from './domestic';
import type { GameState } from './state';

/** 시설이 있는 도시(한국은 실제 도시, 다른 나라는 내 나라 도시에 차례로) */
export function govFacCity(s: GameState, f: GovFacility): string {
  const me = s.player.countryId;
  const n = COUNTRIES.find((c) => c.id === me)?.cities.length ?? 1;
  return `${me}-${me === 'kr' ? f.city : f.city % n}`;
}
/** 지금 단계(국가 사업을 끝내면 +1 덤) */
export function govFacLevel(s: GameState, id: string): number {
  const f = govFacById(id);
  if (!f) return 0;
  const built = s.cabinet?.fac?.[id] ?? 0;
  const bonus = f.project && s.dom ? (domOf(s).projects[f.project]?.stage === 3 ? 1 : 0) : 0;
  return Math.min(GOV_FAC_MAX, built + bonus);
}
/** 주인 자리에 사람이 있는지 */
export function govFacOwned(s: GameState, f: GovFacility): boolean {
  const c = cabinetOf(s);
  return 'min' in f.owner ? !!ministerOf(c, f.owner.min) : !!postHolder(c, f.owner.post);
}
/** 효과가 나는지(내 도시이고 주인 자리가 차 있음) */
export const govFacOn = (s: GameState, f: GovFacility) => s.world.owner[govFacCity(s, f)] === s.player.countryId && govFacOwned(s, f);

export function govFacEff(s: GameState, key: PostEff): number {
  if (!s.cabinet) return 0;
  let v = 0;
  for (const f of GOV_FACILITIES) {
    const k = f.eff[key];
    if (!k) continue;
    const lv = govFacLevel(s, f.id);
    if (lv && govFacOn(s, f)) v += k * lv;
  }
  return v;
}

export function canBuildGovFac(s: GameState, id: string): string | null {
  const f = govFacById(id);
  if (!f) return '없는 시설이에요';
  if (govFacLevel(s, id) >= GOV_FAC_MAX) return '다 키웠어요';
  if (!govFacOwned(s, f)) return 'min' in f.owner ? '장관이 있어야 해요' : '청장이 있어야 해요';
  if (s.world.owner[govFacCity(s, f)] !== s.player.countryId) return '우리 도시가 아니에요';
  const cost = govFacCost(govFacLevel(s, id));
  if ((s.nations[s.player.countryId]?.treasury ?? 0) < cost) return `국방예산 ${cost.toLocaleString('ko-KR')} 필요`;
  return null;
}
export function buildGovFac(s: GameState, id: string): GameState {
  if (canBuildGovFac(s, id)) return s;
  const me = s.player.countryId;
  const cost = govFacCost(govFacLevel(s, id));
  const c = cabinetOf(s);
  const n = s.nations[me];
  return {
    ...s,
    nations: { ...s.nations, [me]: { ...n, treasury: n.treasury - cost } },
    cabinet: { ...c, fac: { ...(c.fac ?? {}), [id]: (c.fac?.[id] ?? 0) + 1 }, log: [...c.log, `🏗️ ${govFacById(id)!.name} ${govFacLevel(s, id) + 1}단계`].slice(-40) },
  };
}
/** 부처(또는 그 아래 청)에 딸린 시설 */
export const govFacsOf = (min: MinistryId, agencyIds: string[]) => GOV_FACILITIES.filter((f) => ('min' in f.owner ? f.owner.min === min : agencyIds.includes(f.owner.post)));
