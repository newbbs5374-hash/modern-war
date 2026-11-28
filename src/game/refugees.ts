// 11-28 7단계 추가 6 "난민과 인도주의": 전쟁으로 도시를 잃은 나라에서 난민이 생김(12시간마다 살핌).
//  · 받기: 나라 예산 · 지지도 −2(이틀) · 그 나라 호감 +10 · 문화 +300 · 세계 영향력 +3(최대 30)
//  · 거절(또는 12시간 안에 안 고름): 그 나라 호감 −6 · 연합국들 호감 −2(국제 비난)
import { FRONT } from '../data/cities';
import { COUNTRIES, countryById } from '../data/world';
import { addPresMod } from './approval';
import { addFavorNote } from './civ';
import { cultureOf } from './culture';
import { pushReport } from './report';
import { priceBase, type GameState } from './state';
import { isAlive, relationOf } from './world';

const H = 3600e3;
export const REF_EVERY = 12 * H;
export const REF_TTL = 12 * H;
export const REF_CULTURE = 300;
export const REF_INF = 3;
export const REF_INF_MAX = 30;
export interface RefOffer { from: string; people: number; untilMs: number }
export interface RefState { counts: Record<string, number>; checkMs: number; offer: RefOffer | null; taken: number; refused: number }
const countAll = (s: GameState) => {
  const out: Record<string, number> = {};
  for (const c of FRONT) out[s.world.owner[c.id]] = (out[s.world.owner[c.id]] ?? 0) + 1;
  return out;
};
export const refOf = (s: GameState): RefState => s.refugees ?? { counts: countAll(s), checkMs: s.worldMs + REF_EVERY, offer: null, taken: 0, refused: 0 };
export const refCost = (s: GameState, o: RefOffer) => Math.max(100, Math.round(priceBase(s) * (o.people / 100000) * 0.5));
export const refInfluence = (s: GameState) => Math.min(REF_INF_MAX, (s.refugees?.taken ?? 0) * REF_INF);

export function answerRefugees(s: GameState, take: boolean): { state: GameState; text: string } {
  const r = refOf(s);
  const o = r.offer;
  if (!o) return { state: s, text: '받을 난민이 없어요' };
  const me = s.player.countryId;
  const nm = countryById(o.from).name;
  const ppl = `${Math.round(o.people / 10000)}만 명`;
  if (take) {
    const cost = refCost(s, o);
    if (s.nations[me].treasury < cost) return { state: s, text: '나라 예산이 모자라요' };
    const c = cultureOf(s);
    let ns: GameState = { ...s, refugees: { ...r, offer: null, taken: r.taken + 1 }, culture: { ...c, points: c.points + REF_CULTURE, total: c.total + REF_CULTURE }, nations: { ...s.nations, [me]: { ...s.nations[me], treasury: s.nations[me].treasury - cost } } };
    ns = addFavorNote(ns, o.from, '🫂 난민을 받아 줌', 10);
    ns = addPresMod(ns, '🫂 난민 수용 부담', -2, 48);
    return { state: ns, text: `🫂 ${nm} 난민 ${ppl}을 받았어요. 나라 예산 −${cost.toLocaleString('ko-KR')} · 지지도 −2(이틀) · 호감 +10 · 문화 +${REF_CULTURE} · 세계 영향력 +${REF_INF}` };
  }
  return { state: refuse(s, r), text: `🚫 ${nm} 난민을 받지 않았어요. ${nm} 호감 −6 · 그 연합국 호감 −2` };
}
function refuse(s: GameState, r: RefState): GameState {
  const o = r.offer!;
  let ns: GameState = { ...s, refugees: { ...r, offer: null, refused: r.refused + 1 } };
  ns = addFavorNote(ns, o.from, '🚫 난민을 외면함', -6);
  for (const c of COUNTRIES) if (c.id !== o.from && isAlive(s.world, c.id) && relationOf(s.world, c.id, o.from) === '연합') ns = addFavorNote(ns, c.id, '🚫 난민 외면(국제 비난)', -2);
  return ns;
}

export function refugeeTick(s: GameState): GameState {
  if (s.ending) return s;
  const me = s.player.countryId;
  let r = refOf(s);
  let ns: GameState = s.refugees ? s : { ...s, refugees: r };
  if (r.offer && r.offer.untilMs <= s.worldMs) {
    ns = refuse(ns, r);
    r = refOf(ns);
  }
  if (s.worldMs < r.checkMs) return ns;
  const now = countAll(s);
  let worst: { id: string; lost: number } | null = null;
  for (const c of COUNTRIES) {
    if (c.id === me || !isAlive(s.world, c.id)) continue;
    const lost = (r.counts[c.id] ?? 0) - (now[c.id] ?? 0);
    if (lost > 0 && (!worst || lost > worst.lost)) worst = { id: c.id, lost };
  }
  r = { ...r, counts: now, checkMs: s.worldMs + REF_EVERY };
  if (worst && !r.offer && relationOf(s.world, me, worst.id) !== '전쟁') {
    const people = worst.lost * 120000;
    r = { ...r, offer: { from: worst.id, people, untilMs: s.worldMs + REF_TTL } };
    ns = pushReport({ ...ns, refugees: r }, { icon: '🫂', text: `대장님, 전쟁으로 도시를 잃은 ${countryById(worst.id).name}에서 난민 약 ${Math.round(people / 10000)}만 명이 도움을 청합니다. 12시간 안에 외교 → 🌐 진영에서 받을지 정해 주십시오.` });
    return ns;
  }
  return { ...ns, refugees: r };
}
