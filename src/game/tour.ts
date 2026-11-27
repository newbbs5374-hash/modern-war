// 11-27 종합 확장안 내정 6: 지방 순방.
// 하루에 한 도시를 찾아가 현안 3곳을 풀어 줌(3D 도시 화면에서 표시를 눌러서).
// 현안마다 「예산으로 풀기」(민심 많이) / 「직접 듣고 달래기」(무료 · 민심 조금) 가운데 하나.
// 세 곳을 모두 풀면 순방 완료: 민심 덤 + 지지도 + 그 도시 출신 인재 한 명이 인재 명단에 오름.
import { cityById } from '../data/cities';
import { addPresMod } from './approval';
import { cabinetOf, genPerson, giveFaces, takenNames } from './cabinet';
import { cityCiv, civOf } from './civ';
import { pushReport } from './report';
import { Rng } from './rng';
import { priceBase, type GameState } from './state';

const H = 3600e3;
export const TOUR_GAP_MS = 20 * H;
export const TOUR_ISSUES = 3;
/** 예산으로 풀 때 값(하루 예산의 몫) */
export const TOUR_PAY = 0.04;
export const TOUR_PAY_LOYALTY = 6;
export const TOUR_TALK_LOYALTY = 2;
/** 다 풀었을 때 덤 */
export const TOUR_DONE_LOYALTY = 4;
export const TOUR_DONE_APPROVAL = 2;

export interface IssueDef { id: string; icon: string; title: string; text: string; pay: string; talk: string }
export const ISSUES: IssueDef[] = [
  { id: 'market', icon: '🧺', title: '전통 시장', text: '상인들이 손님이 줄어 가게를 닫게 생겼다고 해요.', pay: '시장 고치는 돈을 내려요', talk: '국밥 한 그릇 먹으며 이야기를 들어요' },
  { id: 'bridge', icon: '🌉', title: '낡은 다리', text: '50년 된 다리에 금이 가서 주민들이 불안해해요.', pay: '새 다리를 놓기로 해요', talk: '안전 점검을 약속해요' },
  { id: 'school', icon: '🏫', title: '학교', text: '아이들이 줄어 학교가 문을 닫을 처지예요.', pay: '학교 지원금을 내려요', talk: '아이들과 급식을 같이 먹어요' },
  { id: 'hospital', icon: '🏥', title: '병원', text: '밤에 여는 병원이 없어 먼 도시까지 가야 해요.', pay: '야간 진료소를 지어 줘요', talk: '의사와 간호사를 만나 격려해요' },
  { id: 'factory', icon: '🏭', title: '공장', text: '큰 공장이 문을 닫는다는 소문에 노동자들이 걱정해요.', pay: '공장에 지원금을 줘요', talk: '노동자 대표와 손을 잡아요' },
  { id: 'youth', icon: '🧑‍💻', title: '청년 일자리', text: '젊은이들이 일자리를 찾아 도시를 떠나고 있어요.', pay: '청년 창업 기금을 만들어요', talk: '청년들과 밤늦게까지 이야기해요' },
  { id: 'farm', icon: '🌾', title: '농민', text: '올해 농사가 흉년이라 농민들의 한숨이 깊어요.', pay: '수매 값을 올려 줘요', talk: '논에 들어가 같이 일해요' },
  { id: 'port', icon: '⚓', title: '부두', text: '부두가 낡아 배들이 다른 항구로 가고 있어요.', pay: '부두를 넓혀 줘요', talk: '어민들과 새벽 시장을 돌아요' },
  { id: 'elder', icon: '👵', title: '어르신', text: '혼자 사는 어르신들이 겨울나기를 걱정해요.', pay: '난방비를 대 줘요', talk: '경로당에서 말동무가 돼 드려요' },
  { id: 'base', icon: '🪖', title: '부대 앞 마을', text: '부대 소음 때문에 마을 사람들이 힘들어해요.', pay: '방음벽과 보상금을 줘요', talk: '주민과 부대장을 한자리에 앉혀요' },
];
export const issueById = (id: string) => ISSUES.find((x) => x.id === id) ?? ISSUES[0];

export type How = 'pay' | 'talk';
export interface TourIssue {
  def: string;
  /** 3D 도시에서 표시 자리(시청 기준 미터: 동쪽 x, 북쪽 y) */
  x: number;
  y: number;
  done: How | null;
}
export interface TourState {
  nextMs: number;
  open: { city: string; issues: TourIssue[] } | null;
  /** 끝낸 순방 수 */
  count: number;
  /** 최근 다녀온 도시 */
  recent: string[];
}
export const tourOf = (s: GameState): TourState => s.tour ?? { nextMs: 0, open: null, count: 0, recent: [] };

export const payCost = (s: GameState) => Math.max(50, Math.round(priceBase(s) * TOUR_PAY));

export function canTour(s: GameState, city: string): string | null {
  const t = tourOf(s);
  if (s.world.owner[city] !== s.player.countryId) return '우리 도시만 순방할 수 있어요';
  if (t.open) return t.open.city === city ? '순방 중이에요' : `${cityById(t.open.city).name} 순방을 먼저 끝내세요`;
  if (s.worldMs < t.nextMs) return '순방은 하루에 한 번이에요';
  return null;
}

export function startTour(s: GameState, city: string): GameState {
  if (canTour(s, city)) return s;
  const t = tourOf(s);
  const rng = new Rng((s.world.seed + t.count * 7919 + city.length * 31 + city.charCodeAt(0) * 131) >>> 0);
  const pool = [...ISSUES];
  const issues: TourIssue[] = [];
  for (let i = 0; i < TOUR_ISSUES; i++) {
    const d = pool.splice(Math.floor(rng.next() * pool.length), 1)[0];
    const ang = (i / TOUR_ISSUES) * Math.PI * 2 + rng.next() * 1.2;
    const r = 700 + rng.next() * 1100;
    issues.push({ def: d.id, x: Math.round(Math.cos(ang) * r), y: Math.round(Math.sin(ang) * r), done: null });
  }
  return { ...s, tour: { ...t, open: { city, issues } } };
}

export function canSolve(s: GameState, i: number, how: How): string | null {
  const o = tourOf(s).open;
  if (!o || !o.issues[i]) return '순방 중이 아니에요';
  if (o.issues[i].done) return '이미 풀었어요';
  if (how === 'pay' && s.nations[s.player.countryId].treasury < payCost(s)) return '나라 예산이 모자라요';
  return null;
}

export function solveIssue(s: GameState, i: number, how: How): GameState {
  if (canSolve(s, i, how)) return s;
  const me = s.player.countryId;
  const t = tourOf(s);
  const o = t.open!;
  const issues = o.issues.map((x, k) => (k === i ? { ...x, done: how } : x));
  const civ = structuredClone(civOf(s));
  const cc = (civ.cities[o.city] ??= structuredClone(cityCiv(s, o.city)));
  const up = (v: number) => (cc.loyalty = Math.max(0, Math.min(100, cc.loyalty + v)));
  up(how === 'pay' ? TOUR_PAY_LOYALTY : TOUR_TALK_LOYALTY);
  let ns: GameState = { ...s, civ, tour: { ...t, open: { ...o, issues } } };
  if (how === 'pay') ns = { ...ns, nations: { ...ns.nations, [me]: { ...ns.nations[me], treasury: ns.nations[me].treasury - payCost(s) } } };
  if (issues.some((x) => !x.done)) return ns;
  // 순방 완료
  up(TOUR_DONE_LOYALTY);
  const city = cityById(o.city);
  const cab = structuredClone(cabinetOf(ns));
  const rng = new Rng((cab.seed + t.count * 104729 + 17) >>> 0);
  const paid = issues.filter((x) => x.done === 'pay').length;
  const p = genPerson(cab, rng, { country: me, group: '인재', age: [38, 62], grade: paid >= 2 && rng.chance(0.5) ? '우수' : undefined }, ns.worldMs, takenNames(cab));
  p.home = o.city;
  cab.people.push(p);
  giveFaces(cab);
  ns = { ...ns, civ, cabinet: cab, tour: { nextMs: ns.worldMs + TOUR_GAP_MS, open: null, count: t.count + 1, recent: [o.city, ...t.recent].slice(0, 5) } };
  ns = addPresMod(ns, `🚌 ${city.name} 순방`, TOUR_DONE_APPROVAL, 24);
  return pushReport(ns, { icon: '🚌', text: `${city.name} 순방을 마쳤습니다. 민심이 올랐고, ${city.name} 출신 인재 ${p.name} 님이 인재 명단에 올랐습니다.` });
}
