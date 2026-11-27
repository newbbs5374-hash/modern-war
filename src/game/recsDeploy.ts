// 11-28 외교 장관 파병 추천: 맞는 부대를 골라 요청 받기 · 지친 부대 교대.
import { countryById } from '../data/world';
import { requestKindById, type Branch } from '../data/deployOps';
import { acceptRequest, branchOf, canAccept, deployOf, openRequests, placeName, recallTroops, tired, unitsPower } from './deploy';
import { approx, registerRecs, type Rec } from './recs';
import type { GameState } from './state';

/** 요청에 맞는 부대 고르기: 꼭 있어야 하는 병과마다 가장 많이 가진 부대 2개(없으면 아무 부대 2개) */
export function pickUnits(s: GameState, need: Branch[]): Record<string, number> | null {
  const army = Object.entries(s.economy.army).filter(([, k]) => k > 0);
  const out: Record<string, number> = {};
  const wants: Array<Branch | null> = need.length ? need : [null];
  for (const b of wants) {
    const c = army.filter(([n]) => !b || branchOf(n) === b).sort((x, y) => y[1] - x[1])[0];
    if (!c) return null;
    out[c[0]] = Math.min(c[1], (out[c[0]] ?? 0) + 2);
  }
  return out;
}

export function requestRecs(s: GameState): Rec[] {
  const out: Rec[] = [];
  for (const r of openRequests(s)) {
    const k = requestKindById(r.kind);
    if (!k) continue;
    const units = pickUnits(s, k.need);
    if (!units || canAccept(s, r.id, units)) continue;
    const value = k.money + k.fame * 200;
    const list = Object.entries(units).map(([n, q]) => `${n} ${q}`).join('·');
    out.push({
      id: `req:${r.id}`,
      field: 'diplo',
      tab: 'deploy',
      icon: k.icon,
      title: `${placeName(r.region)} ${k.name} 요청 받기`,
      value,
      gain: (m) => `+${approx(k.money * m)} · 명성 +${k.fame}`,
      why: `${list}을(를) ${k.hours}시간 보내면 돼요. 끝나면 친한 나라 은혜 +2.`,
      act: (x) => acceptRequest(x, r.id, units),
      can: (x) => canAccept(x, r.id, units),
    });
  }
  return out;
}

export function tiredRecs(s: GameState): Rec[] {
  return deployOf(s)
    .list.filter((x) => tired(s, x))
    .map((x) => ({
      id: `tired:${x.id}`,
      field: 'diplo' as const,
      tab: 'deploy',
      icon: '😮‍💨',
      title: `${placeName(x.to)} 파병 부대 교대`,
      value: Math.max(200, unitsPower(x.units) * 20),
      gain: () => '도움 절반 → 교대 후 다시 100%',
      why: `이틀 넘게 머물러 지쳤어요. 불러들이고 새 부대를 보내요.${x.to.startsWith('r-') ? '' : ` ${countryById(x.to).name} 은혜는 그대로 남아요.`}`,
      act: (g: GameState) => recallTroops(g, x.id),
    }));
}

registerRecs('diplo', requestRecs);
registerRecs('diplo', tiredRecs);
