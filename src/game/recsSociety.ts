// 11-28 국정 37 강화 4단계: 내정 장관 추천(청원 · 민심 낮은 도시).
import { CITIES } from '../data/cities';
import { PET_KINDS, canGrant, grantPetition, mediaOf, petCost } from './media';
import { approx, registerRecs, type Rec } from './recs';
import { GROUPS, MEET_GAIN, MEET_HOURS, canMeet, groupSat, meetGroup } from './groups';
import type { GameState } from './state';

/** 끝나 가는 청원: 예산이 넉넉하면 전부, 아니면 일부 */
export function petitionRecs(s: GameState): Rec[] {
  const p = [...mediaOf(s).petitions].sort((a, b) => a.endMs - b.endMs)[0];
  if (!p) return [];
  const t = s.nations[s.player.countryId]?.treasury ?? 0;
  const a = t >= p.cost * 5 && !canGrant(s, p.id, 'full') ? 'full' : 'part';
  const city = CITIES.find((c) => c.id === p.city)?.name ?? '';
  return [
    {
      id: `pet:${p.id}:${a}`,
      field: 'society',
      tab: 'press',
      icon: '📝',
      title: `${city} 청원 "${PET_KINDS[p.kind].name}" ${a === 'full' ? '전부' : '일부'} 들어주기`,
      value: 3500 + (a === 'full' ? 1500 : 0),
      gain: () => `−${approx(petCost(p, a))} · 민심 +${a === 'full' ? 12 : 5}`,
      why: a === 'full' ? '예산이 넉넉해요. 지지도도 함께 올라요.' : '예산을 아끼면서 민심을 챙겨요. 그냥 두면 민심 −4.',
      act: (x) => grantPetition(x, p.id, a),
      can: (x) => canGrant(x, p.id, a),
    },
  ];
}

registerRecs('society', petitionRecs);

/** 만족도가 가장 낮은 무리 만나기 */
export function groupRecs(s: GameState): Rec[] {
  const low = GROUPS.map((g) => ({ g, v: groupSat(s, g.id) }))
    .filter((x) => x.v <= 45 && !canMeet(s, x.g.id))
    .sort((a, b) => a.v - b.v)[0];
  if (!low) return [];
  return [
    {
      id: `group:${low.g.id}`,
      field: 'society',
      tab: 'opinion',
      icon: low.g.icon,
      title: `${low.g.name} 만나기`,
      value: 3000 + (45 - low.v) * 120,
      gain: () => `만족도 ${Math.round(low.v)} → +${MEET_GAIN}(${MEET_HOURS}시간)`,
      why: `만족도가 가장 낮은 무리예요${low.v <= 25 ? '. 25 아래면 시위가 날 수 있어요' : ''}.`,
      act: (x) => meetGroup(x, low.g.id),
      can: (x) => canMeet(x, low.g.id),
    },
  ];
}
registerRecs('society', groupRecs);
