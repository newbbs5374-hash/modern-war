// 11-27 종합 확장안 내정 10: 대통령의 하루.
// 아침마다 부관이 오늘 일정 카드 3장을 골라 줌(약한 분야 · 낮은 지지도 · 흔들리는 도시부터).
// 「추천대로 하루 보내기」 한 번이면 빈 일정 칸이 모두 채워지고, 직접 고르고 싶으면 한 장씩 눌러도 됨.
// 일정 자체(효과 · 하루 3칸)는 schedule.ts 그대로.
import { CITIES } from '../data/cities';
import { approvalOf, fieldScores } from './approval';
import { civOf } from './civ';
import { canAct, doAct, scheduleOf, type ActId } from './schedule';
import type { GameState } from './state';

export interface DayCard { id: ActId; why: string; score: number }

/** 오늘 남은 칸에 추천하는 일정(급한 순) */
export function recommendActs(s: GameState): DayCard[] {
  const sc = scheduleOf(s);
  const free = sc.slots.filter((x) => !x).length;
  if (!free) return [];
  const f = fieldScores(s);
  const me = s.player.countryId;
  const civ = civOf(s);
  const low = CITIES.filter((c) => s.world.owner[c.id] === me && civ.cities[c.id]).sort((a, b) => civ.cities[a.id].loyalty - civ.cities[b.id].loyalty)[0];
  const lowLoy = low ? civ.cities[low.id].loyalty : 100;
  const gens = s.officer.generals;
  const genLoy = gens.length ? Math.min(...gens.map((g) => g.loyalty)) : 100;
  const ap = approvalOf(s);
  const cards: DayCard[] = [
    { id: 'troops', why: genLoy < 60 ? `장군 충성이 ${Math.round(genLoy)}까지 내려갔어요` : `안보 점수 ${Math.round(f.defense)}`, score: (100 - f.defense) + (genLoy < 60 ? 25 : 0) },
    { id: 'visit', why: low ? `${low.name} 민심이 ${Math.round(lowLoy)}이에요` : `사회 점수 ${Math.round(f.society)}`, score: (100 - f.society) + (lowLoy < 50 ? 30 : lowLoy < 65 ? 10 : 0) },
    { id: 'business', why: `경제 점수 ${Math.round(f.economy)}`, score: 100 - f.economy },
    { id: 'call', why: `외교 점수 ${Math.round(f.diplo)}`, score: 100 - f.diplo },
    { id: 'press', why: `지지도가 ${Math.round(ap)}이에요`, score: (100 - ap) + (ap < 45 ? 25 : 0) },
    { id: 'cabinet', why: '진행 중인 부처 업무를 당겨요', score: 38 + (s.cabinet && Object.keys(s.cabinet.tasks ?? {}).length ? 15 : 0) },
    { id: 'assembly', why: `의회 신뢰도가 ${Math.round(s.officer.trust)}이에요`, score: (100 - s.officer.trust) + (s.officer.trust < 45 ? 20 : 0) },
    { id: 'rest', why: '쉬어 가는 것도 일이에요', score: 30 },
  ];
  return cards
    .filter((c) => !canAct(s, c.id))
    .sort((a, b) => b.score - a.score)
    .slice(0, free);
}

/** 추천대로 하루 보내기: 빈 칸을 모두 채움 */
export function runDay(s: GameState): { state: GameState; text: string } {
  const lines: string[] = [];
  let ns = s;
  for (const c of recommendActs(s)) {
    const r = doAct(ns, c.id);
    if (!r.text) continue;
    ns = r.state;
    lines.push(r.text);
  }
  return { state: ns, text: lines.join('\n') };
}
