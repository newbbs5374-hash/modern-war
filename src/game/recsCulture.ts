// 11-28 국정 37 강화 5단계: 문화체육관광부 장관 추천(시설·스타·걸작·관광 코스).
import { COURSES, STAR_KINDS, VENUES, venueById } from '../data/culture';
import { canCreate, canOpenCourse, canRecruit, canUpgrade, cultureOf, nextStarName, openCourse, recruitStar, startCreate, starsOf, upgradeCost, upgradeVenue } from './culture';
import { approx, registerRecs, type Rec } from './recs';
import type { GameState } from './state';

/** 공사 팀이 놀면: 문화(cul)+관광(tour)이 가장 큰 시설을 가장 싸게 */
export function venueRecs(s: GameState): Rec[] {
  const c = cultureOf(s);
  const ok = VENUES.filter((v) => !canUpgrade(s, v.id))
    .map((v) => ({ v, cost: upgradeCost(v.id, c.venues[v.id] + 1, s) }))
    .sort((a, b) => (b.v.cul + b.v.tour) / b.cost.money - (a.v.cul + a.v.tour) / a.cost.money);
  const top = ok[0];
  if (!top) return [];
  const to = c.venues[top.v.id] + 1;
  return [
    {
      id: `venue:${top.v.id}`,
      field: 'culture',
      tab: 'venue',
      icon: top.v.icon,
      title: `${venueById(top.v.id).levels[to - 1]}(${top.v.name} ${to}단계) 짓기`,
      value: 3000 + (to === 1 ? 2000 : 0),
      gain: () => `−${approx(top.cost.money)} · ${top.cost.hours}시간`,
      why: `공사 팀이 놀고 있어요. 돈 대비 문화·관광이 가장 많이 오르는 시설이에요${to === 1 ? '(처음 지으면 새 스타·걸작 길이 열려요)' : ''}.`,
      act: (x) => upgradeVenue(x, top.v.id),
      can: (x) => canUpgrade(x, top.v.id),
    },
  ];
}

/** 데려올 수 있는 스타 · 놀고 있는 스타에게 걸작 맡기기 */
export function starRecs(s: GameState): Rec[] {
  const out: Rec[] = [];
  const k = STAR_KINDS.find((x) => !canRecruit(s, x.id));
  if (k)
    out.push({
      id: `star:${k.id}`,
      field: 'culture',
      tab: 'stars',
      icon: k.icon,
      title: `${k.name} ${nextStarName(s, k.id)} 데려오기`,
      value: 4000,
      gain: () => '스타 +1',
      why: '재능 점수가 모였어요. 지금 데려오면 바로 일을 시작해요.',
      act: (x) => recruitStar(x, k.id),
      can: (x) => canRecruit(x, k.id),
    });
  const idle = starsOf(cultureOf(s)).find((x) => !canCreate(s, x.id));
  if (idle)
    out.push({
      id: `create:${idle.id}`,
      field: 'culture',
      tab: 'works',
      icon: '🎨',
      title: `${idle.name}에게 걸작 맡기기`,
      value: 4500,
      gain: () => '걸작 +1(시간이 지나면 등급이 정해짐)',
      why: '스타가 놀고 있고 걸작 칸·문화 점수가 있어요.',
      act: (x) => startCreate(x, idle.id),
      can: (x) => canCreate(x, idle.id),
    });
  return out;
}

/** 비어 있는 관광 코스 열기 */
export function courseRecs(s: GameState): Rec[] {
  const d = COURSES.find((x) => !canOpenCourse(s, x.id));
  if (!d) return [];
  return [
    {
      id: `course:${d.id}`,
      field: 'culture',
      tab: 'tour',
      icon: d.icon,
      title: `${d.name} 관광 코스 열기`,
      value: 3500,
      gain: () => d.text,
      why: '관광 코스 칸이 비어 있어요.',
      act: (x) => openCourse(x, d.id),
      can: (x) => canOpenCourse(x, d.id),
    },
  ];
}

registerRecs('culture', venueRecs);
registerRecs('culture', starRecs);
registerRecs('culture', courseRecs);
