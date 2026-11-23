// 문명식 운영: 연구 두 줄 · 나라 체제와 정책 카드 · 호감/협정/불만 장부 · 분쟁 섬 영향력 · 국제 회의 · 도시 구역/민심/인구.
// 순수 계산(새 상태를 돌려줌). 상태는 GameState.civ 한 칸에만 둔다(다른 기능과 겹치지 않게).
import { originEff, originOf } from './origin';
import { cabBuild, cabFavor, cabGrowth, cabLoyalty, cabRes, cabResearch } from './cabinet';
import { splitBuild, splitEco, splitFavor, splitLoyalty, splitOf } from './policy';
import { CITIES, cityById, type City } from '../data/cities';
import { UNITS } from '../data/catalog';
import {
  AGENDAS,
  AGREES,
  AGREE_FAVOR,
  AI_INFLUENCE_PER_TICK,
  CARDS,
  CARD_SWAP_COST,
  CARD_SWAP_FREE_MS,
  COUNCIL_ANSWER_MS,
  COUNCIL_EFFECT_MS,
  COUNCIL_EVERY_MS,
  DISTRICTS,
  DISTRICT_SLOTS,
  ENVOY_COOLDOWN_MS,
  ENVOY_COST,
  ENVOY_INFLUENCE,
  ERAS,
  ERA_TENSION,
  FAVOR_DECAY_PER_DAY,
  GOVS,
  GOV_CHANGE_COST,
  GOV_CHAOS,
  GOV_CHAOS_MS,
  GRIEVANCE,
  GRIEVANCE_DECAY_PER_DAY,
  GROW_NEED_PER_POP,
  INFLUENCE_MAX,
  ISLAND_LEAD_MIN,
  ISLAND_REQUEST_INFLUENCE,
  ISLAND_REQUEST_MS,
  ISLAND_RES_PER_HOUR,
  LOYALTY_OK,
  LOYALTY_SPEED,
  POP_BUDGET,
  POP_MAX,
  RESEARCH_BASE,
  RESEARCH_PER_LAB,
  RESEARCH_PER_LAB_ADJ,
  RESEARCH_PER_POP,
  RESEARCH_PER_SCIENCE_PACT,
  START_CARDS,
  TECHS,
  agendaById,
  agreeById,
  cardById,
  districtById,
  govById,
  govSlots,
  techById,
  techForUnit,
  type AgendaId,
  type AgreeId,
  type DistrictId,
  type Eff,
  type Era,
  type EurekaKey,
  type GovId,
  type Tech,
} from '../data/civ';
import { BASIC_RES, CITY_RES, COMPOSITE_PER_INDUSTRY, LUXURIES, PROCESSED, LUXURY_LOYALTY, OCCUPIED_RES, RESOURCES, RES_ICON, type Res } from '../data/economy';
import { HEX_DIRS, PIONEER_ISLANDS, TILES, TILE_AT, hexKey, type Tile } from '../data/hexmap';
import { COUNTRIES, countryById } from '../data/world';
import { facBonus } from './facility';
import { Rng } from './rng';
import type { GameState } from './state';
import { isAlive, isRival, pairKey, relationOf, sameBloc, type WorldEvent } from './world';

const H = 3600e3;
const DAY = 24 * H;

// ── 상태 ──

export interface FavorNote {
  text: string;
  v: number;
  t: number;
}
export interface Agreement {
  id: number;
  who: string;
  kind: AgreeId;
  untilMs: number;
}
export interface DistrictState {
  id: DistrictId;
  /** 칸 "q,r" */
  tile: string;
  /** 다 지어지는 시각 */
  doneMs: number;
  /** 완공 소식을 알렸는지 */
  told?: boolean;
}
export interface CityCiv {
  loyalty: number;
  pop: number;
  grow: number;
  districts: DistrictState[];
  /** 채굴장(지도 칸 매장지 위, 자원 3안) */
  mines?: MineState[];
}
export interface MineState {
  tile: string;
  res: Res;
  doneMs: number;
}
export interface CouncilOpen {
  id: number;
  agenda: AgendaId;
  target?: string;
  untilMs: number;
  /** 내 표(null = 아직) */
  vote: boolean | null;
}
export interface CouncilActive {
  agenda: AgendaId;
  target?: string;
  untilMs: number;
}
export interface CivState {
  done: string[];
  eureka: string[];
  progress: Record<string, number>;
  cur: { mil: string | null; soc: string | null };
  /** 고르지 않은 동안 모인 연구 점수(다음 연구에 씀, 12시간치까지) */
  bank: { mil: number; soc: number };
  era: Era;
  gov: GovId | null;
  chaosUntil: number;
  cards: Array<string | null>;
  lastSwapMs: number;
  aiGov: Record<string, GovId>;
  notes: Record<string, FavorNote[]>;
  grievance: Record<string, number>;
  agreements: Agreement[];
  influence: Record<string, Record<string, number>>;
  envoyReadyMs: number;
  /** 섬 → 부탁을 들어준 주기 번호 */
  reqDone: Record<string, number>;
  council: { on: boolean; nextMs: number; open: CouncilOpen | null; active: CouncilActive[]; last: string | null };
  cities: Record<string, CityCiv>;
  nextId: number;
  log: string[];
}

/** AI 나라 체제: 성향마다 두 가지 중 나라 순서대로 하나(11-23 체제 8가지) */
const AI_GOV: Record<string, [GovId, GovId]> = { 공격형: ['navy', 'junta'], 경제형: ['merchant', 'technocracy'], 방어형: ['assembly', 'federation'], 기회주의: ['sanctum', 'republic'] };

export function newCiv(s: Pick<GameState, 'world' | 'worldMs'>): CivState {
  const aiGov: Record<string, GovId> = {};
  COUNTRIES.forEach((c, i) => (aiGov[c.id] = AI_GOV[s.world.personalities[c.id]]?.[i % 2] ?? 'assembly'));
  const influence: Record<string, Record<string, number>> = {};
  for (const p of PIONEER_ISLANDS) influence[p.id] = {};
  return {
    done: [],
    eureka: [],
    progress: {},
    cur: { mil: null, soc: null },
    bank: { mil: 0, soc: 0 },
    era: 1,
    gov: null,
    chaosUntil: 0,
    cards: [],
    lastSwapMs: -Infinity,
    aiGov,
    notes: {},
    grievance: {},
    agreements: [],
    influence,
    envoyReadyMs: 0,
    reqDone: {},
    council: { on: true, nextMs: s.worldMs + COUNCIL_EVERY_MS, open: null, active: [], last: null },
    cities: {},
    nextId: 1,
    log: [],
  };
}

let fallback: CivState | null = null;
/** 옛 저장·시험용 상태에도 안전하게 */
export function civOf(s: GameState): CivState {
  if (s.civ) return s.civ;
  return (fallback ??= newCiv(s));
}
function cloneCiv(c: CivState): CivState {
  return structuredClone(c);
}
function withCiv(s: GameState, f: (c: CivState, s: GameState) => GameState | void): GameState {
  const c = cloneCiv(civOf(s));
  const out = f(c, s);
  return { ...(out ?? s), civ: c };
}
function clog(c: CivState, text: string) {
  c.log.unshift(text);
  if (c.log.length > 10) c.log.length = 10;
}
function worldEvent(s: GameState, text: string): GameState {
  const ev: WorldEvent = { t: s.worldMs, kind: '외교', text, mine: true };
  return { ...s, world: { ...s.world, events: [ev, ...s.world.events].slice(0, 150) } };
}

// ── 효과 합치기 ──

/** 지금 켜진 모든 효과(연구 + 체제 + 카드 + 회의 결과) */
export function civEffects(s: GameState): Eff[] {
  const c = civOf(s);
  const out: Eff[] = [];
  for (const id of c.done) {
    const t = techById(id);
    if (t?.eff) out.push(t.eff);
  }
  if (c.gov) out.push(govById(c.gov).eff);
  const slots = c.gov ? govSlots(govById(c.gov), s.player.rankIndex) : [];
  c.cards.forEach((id, i) => {
    if (i >= slots.length || !id) return;
    const card = cardById(id);
    if (card) out.push(card.eff);
  });
  for (const a of c.council.active) if (a.untilMs > s.worldMs) out.push(agendaById(a.agenda).yes);
  return out;
}
type NumKey = 'research' | 'budget' | 'res' | 'loyalty' | 'favor' | 'influence' | 'mission' | 'trade' | 'contracts' | 'votes' | 'growth' | 'district';
export function effSum(s: GameState, k: NumKey): number {
  return civEffects(s).reduce((a, e) => a + (e[k] ?? 0), 0);
}
function domOf(unit: string): '육' | '해' | '공' {
  const d = UNITS.find((u) => u.name === unit)?.domain;
  return d === '해' ? '해' : d === '공' ? '공' : '육';
}
export function effDom(s: GameState, k: 'build' | 'power', dom: '육' | '해' | '공'): number {
  return civEffects(s).reduce((a, e) => a + (e[k] && (e[k]!.dom === 'all' || e[k]!.dom === dom) ? e[k]!.v : 0), 0);
}

// ── 연구 ──

export const hasTech = (s: GameState, id: string) => civOf(s).done.includes(id);
export function techCost(s: GameState, t: Tech): number {
  return t.hours * (civOf(s).eureka.includes(t.id) ? 0.5 : 1);
}
export function canResearch(s: GameState, id: string): string | null {
  const t = techById(id);
  if (!t) return '없는 연구';
  if (hasTech(s, id)) return '이미 끝냈어요';
  const miss = t.needs.filter((n) => !hasTech(s, n));
  if (miss.length) return `먼저: ${miss.map((n) => techById(n)!.name).join(', ')}`;
  return null;
}
export function startResearch(s: GameState, id: string): GameState {
  if (canResearch(s, id)) return s;
  const t = techById(id)!;
  return withCiv(s, (c) => {
    c.cur[t.line] = id;
  });
}

/** 실제 1시간에 쌓이는 연구 점수(두 줄이 따로 같은 속도로) */
export function researchRate(s: GameState): number {
  return researchBreakdown(s).reduce((a, [, v]) => a + v, 0) * (chaos(s) ? 1 - GOV_CHAOS : 1);
}
export function researchBreakdown(s: GameState): Array<[string, number]> {
  const me = s.player.countryId;
  const c = civOf(s);
  const rows: Array<[string, number]> = [['기본', RESEARCH_BASE]];
  let pop = 0;
  let lab = 0;
  for (const [id, cc] of Object.entries(c.cities)) {
    if (s.world.owner[id] !== me) continue;
    pop += cc.pop;
    for (const d of cc.districts) if (d.id === 'lab' && d.doneMs <= s.worldMs) lab += RESEARCH_PER_LAB + RESEARCH_PER_LAB_ADJ * adjCount(id, d.tile, 'lab', cc);
  }
  rows.push(['도시 인구', pop * RESEARCH_PER_POP]);
  if (lab) rows.push(['🔬 연구소 구역', lab]);
  const pacts = activeAgreements(s).filter((a) => a.kind === 'science').length;
  if (pacts) rows.push(['🔬 연구 협력 협정', pacts * RESEARCH_PER_SCIENCE_PACT]);
  const eff = effSum(s, 'research');
  if (eff) rows.push(['연구·체제·카드', eff]);
  const labB = facBonus(s, '국방과학연구소');
  if (labB) rows.push(['🧬 국방과학연구소', labB]);
  if (countryById(me).ability.effect.includes('연구 속도 +25%')) rows.push([`🌟 ${countryById(me).ability.name}`, 0.25]);
  const og = originEff(s, 'research');
  if (og) rows.push([`🎓 출신(${originOf(s)!.name})`, og]);
  const cr = cabResearch(s);
  if (cr) rows.push(['🔬 과학기술부', cr]);
  return rows;
}

function eraOf(c: CivState): Era {
  let era: Era = 1;
  for (const e of [1, 2, 3] as Era[]) {
    const n = TECHS.filter((t) => t.era === e && c.done.includes(t.id)).length;
    if (n >= 4 && era === e) era = (e + 1) as Era;
  }
  return era;
}

function finishTech(ns: GameState, c: CivState, t: Tech): GameState {
  c.done.push(t.id);
  c.cur[t.line] = null;
  delete c.progress[t.id];
  const what = [t.units?.length ? `병과 ${t.units.join('·')}` : '', t.cards?.length ? `카드 ${t.cards.length}장` : '', t.districts?.length ? `구역 ${t.districts.map((d) => districtById(d).name).join('·')}` : '', t.agree?.length ? `협정 ${t.agree.map((a) => agreeById(a).name).join('·')}` : ''].filter(Boolean).join(' · ');
  clog(c, `${t.icon} ${t.name} 연구 완료${what ? ` → ${what}` : ''}`);
  const era = eraOf(c);
  if (era > c.era) {
    c.era = era;
    const pairs = { ...ns.world.pairs };
    const me = ns.player.countryId;
    for (const o of COUNTRIES) {
      if (o.id === me) continue;
      const k = pairKey(me, o.id);
      const p = pairs[k];
      if (p && isRival(me, o.id) && p.rel !== '전쟁') pairs[k] = { ...p, tension: Math.min(99, p.tension + ERA_TENSION) };
    }
    ns = worldEvent({ ...ns, world: { ...ns.world, pairs } }, `${ERAS[era].icon} ${countryById(me).name}, ${ERAS[era].name}에 들어섰어요. 맞수 나라들이 긴장해요.`);
    clog(c, `${ERAS[era].icon} ${ERAS[era].name}에 들어섰어요!`);
  }
  return ns;
}

/** 번뜩임: 해낸 일에 맞는 연구가 절반으로 */
export function eureka(s: GameState, ev: EurekaKey): GameState {
  const c0 = civOf(s);
  const hits = TECHS.filter((t) => {
    if (!t.eureka || c0.eureka.includes(t.id) || c0.done.includes(t.id)) return false;
    const k = t.eureka.key;
    if (k.kind !== ev.kind) return false;
    if (k.kind === 'train' && ev.kind === 'train') return k.name === ev.name && ev.stars >= k.stars;
    if (k.kind === 'mission' && ev.kind === 'mission') return k.name === ev.name;
    if (k.kind === 'talk' && ev.kind === 'talk') return !k.att || k.att === ev.att;
    if (k.kind === 'district' && ev.kind === 'district') return k.id === ev.id;
    if (k.kind === 'agree' && ev.kind === 'agree') return k.id === ev.id;
    if (k.kind === 'rank' && ev.kind === 'rank') return ev.at >= k.at;
    if (k.kind === 'army' && ev.kind === 'army') return ev.count >= k.count;
    return k.kind === 'island';
  });
  if (!hits.length) return s;
  return withCiv(s, (c) => {
    for (const t of hits) {
      c.eureka.push(t.id);
      clog(c, `💡 번뜩임! ${t.eureka!.text} → ${t.name} 연구가 절반으로`);
    }
  });
}

// ── 체제 · 정책 카드 ──

export function chaos(s: GameState): boolean {
  return civOf(s).chaosUntil > s.worldMs;
}
export function canSetGov(s: GameState, id: GovId): string | null {
  const c = civOf(s);
  if (c.gov === id) return '지금 체제예요';
  const g = govById(id);
  if (g.needs && !hasTech(s, g.needs)) return `${techById(g.needs)?.name ?? ''} 연구 뒤 고를 수 있어요`;
  if (c.gov && !hasTech(s, 's-charter')) return '국가 헌장 연구 뒤 바꿀 수 있어요';
  if (c.gov && s.nations[s.player.countryId].treasury < GOV_CHANGE_COST) return `국방예산 ${GOV_CHANGE_COST.toLocaleString()} 필요`;
  return null;
}
export function setGov(s: GameState, id: GovId): GameState {
  if (canSetGov(s, id)) return s;
  const first = !civOf(s).gov;
  const me = s.player.countryId;
  const ns = first ? s : { ...s, nations: { ...s.nations, [me]: { ...s.nations[me], treasury: s.nations[me].treasury - GOV_CHANGE_COST } } };
  return withCiv(ns, (c) => {
    c.gov = id;
    c.cards = c.cards.slice(0, 8);
    if (!first) c.chaosUntil = s.worldMs + GOV_CHAOS_MS;
    clog(c, `${govById(id).icon} ${govById(id).name} 체제${first ? '를 골랐어요' : '로 바꿨어요(하루 동안 혼란: 생산 −20%)'}`);
  });
}
export function unlockedCards(s: GameState): string[] {
  const c = civOf(s);
  const set = new Set(START_CARDS);
  for (const id of c.done) for (const k of techById(id)?.cards ?? []) set.add(k);
  return CARDS.map((x) => x.id).filter((id) => set.has(id));
}
export function swapCost(s: GameState): number {
  return s.worldMs - civOf(s).lastSwapMs >= CARD_SWAP_FREE_MS ? 0 : CARD_SWAP_COST;
}
export function canPutCard(s: GameState, slot: number, cardId: string | null): string | null {
  const c = civOf(s);
  if (!c.gov) return '먼저 체제를 골라요';
  const slots = govSlots(govById(c.gov), s.player.rankIndex);
  if (slot < 0 || slot >= slots.length) return '아직 없는 칸(등급이 오르면 늘어요)';
  if (cardId === null) return null;
  const card = cardById(cardId);
  if (!card || !unlockedCards(s).includes(cardId)) return '아직 못 쓰는 카드';
  if (slots[slot] !== '자유' && slots[slot] !== card.kind) return `${slots[slot]} 칸에는 ${slots[slot]} 카드만`;
  if (c.cards.includes(cardId) && c.cards[slot] !== cardId) return '이미 끼운 카드';
  const cost = c.cards[slot] ? swapCost(s) : 0;
  if (s.nations[s.player.countryId].treasury < cost) return `바꾸기 비용 ${cost.toLocaleString()} 필요`;
  return null;
}
export function putCard(s: GameState, slot: number, cardId: string | null): GameState {
  if (canPutCard(s, slot, cardId)) return s;
  const c0 = civOf(s);
  const replacing = !!c0.cards[slot];
  const cost = replacing ? swapCost(s) : 0;
  const me = s.player.countryId;
  const ns = cost ? { ...s, nations: { ...s.nations, [me]: { ...s.nations[me], treasury: s.nations[me].treasury - cost } } } : s;
  return withCiv(ns, (c) => {
    while (c.cards.length <= slot) c.cards.push(null);
    c.cards[slot] = cardId;
    if (replacing) c.lastSwapMs = s.worldMs;
  });
}

// ── 외교: 호감 · 협정 · 불만 ──

export function activeAgreements(s: GameState, who?: string): Agreement[] {
  return civOf(s).agreements.filter((a) => a.untilMs > s.worldMs && (!who || a.who === who));
}
/** 그 나라이 나를 얼마나 좋아하는지와 이유 */
export function favorReasons(s: GameState, id: string): Array<[string, number]> {
  const me = s.player.countryId;
  const c = civOf(s);
  const rows: Array<[string, number]> = [];
  const rel = relationOf(s.world, me, id);
  const relV = { 연합: 25, 휴전: -10, 전쟁: -50, 중립: 0 }[rel];
  if (relV) rows.push([rel === '연합' ? '연합국' : rel === '전쟁' ? '전쟁 중' : '휴전 중', relV]);
  if (sameBloc(me, id)) rows.push(['같은 협약', 8]);
  if (isRival(me, id)) rows.push(['맞수', -10]);
  if (countryById(me).faith === countryById(id).faith) rows.push(['같은 신앙', 5]);
  if (c.gov) {
    if (c.aiGov[id] === c.gov) rows.push([`같은 체제(${govById(c.gov).name})`, 5]);
    else rows.push(['다른 체제', -3]);
  }
  for (const a of activeAgreements(s, id)) rows.push([`${agreeById(a.kind).icon} ${agreeById(a.kind).name} 협정`, AGREE_FAVOR[a.kind]]);
  const eff = effSum(s, 'favor');
  if (eff) rows.push(['연구·카드', eff]);
  for (const n of c.notes[id] ?? []) if (Math.round(n.v)) rows.push([n.text, Math.round(n.v)]);
  const g = c.grievance[id] ?? 0;
  if (g >= 1) rows.push(['😠 불만 장부', -Math.round(g)]);
  const sf = Math.round(splitFavor(s));
  if (sf) rows.push([`🌐 외교 예산 ${splitOf(s).dip}%`, sf]);
  const of = Math.round(originEff(s, 'favor') + (countryById(me).faith === countryById(id).faith ? originEff(s, 'favorFaith') : -originEff(s, 'favorFaith') / 3));
  if (of) rows.push([`🎓 출신(${originOf(s)!.name})`, of]);
  const cf = Math.round(cabFavor(s));
  if (cf) rows.push(['🌐 외교부', cf]);
  return rows;
}
export function favorOf(s: GameState, id: string): number {
  return Math.max(-100, Math.min(100, Math.round(favorReasons(s, id).reduce((a, [, v]) => a + v, 0))));
}
export function favorName(v: number): { name: string; icon: string } {
  if (v >= 50) return { name: '아주 좋아함', icon: '😍' };
  if (v >= 20) return { name: '좋아함', icon: '🙂' };
  if (v > -20) return { name: '보통', icon: '😐' };
  if (v > -50) return { name: '싫어함', icon: '😒' };
  return { name: '아주 싫어함', icon: '😡' };
}
/** 대화 결과·회의 투표처럼 쌓이는 호감 이유(시간이 지나면 줄어듦) */
export function addFavorNote(s: GameState, id: string, text: string, v: number): GameState {
  if (!id || id === s.player.countryId) return s;
  return withCiv(s, (c) => {
    const list = (c.notes[id] ??= []);
    const same = list.find((n) => n.text === text);
    if (same) same.v = Math.max(-60, Math.min(60, same.v + v));
    else list.unshift({ text, v, t: s.worldMs });
    if (list.length > 6) list.length = 6;
  });
}
/** 불만 장부: 맞은 나라 + 이웃 나라도 같이 */
export function addGrievance(s: GameState, id: string, v: number, why: string): GameState {
  const me = s.player.countryId;
  return withCiv(s, (c) => {
    c.grievance[id] = (c.grievance[id] ?? 0) + v;
    for (const o of COUNTRIES) {
      if (o.id === id || o.id === me) continue;
      if (sameBloc(o.id, id) || countryById(o.id).continent === countryById(id).continent) c.grievance[o.id] = (c.grievance[o.id] ?? 0) + v * GRIEVANCE.neighbor;
    }
    clog(c, `😠 ${why} → ${countryById(id).name} 불만 +${Math.round(v)} (이웃 나라도 기억해요)`);
  });
}
/** 내가 선전포고했을 때(대화·지도자 명령 모두): 기습·협정 깨기·성지 휴전 어기기는 오래 남음 */
export function onPlayerWar(before: GameState, after: GameState, id: string): GameState {
  const favor = favorOf(before, id);
  const pacts = activeAgreements(before, id);
  let s = after;
  let v = GRIEVANCE.war;
  const why: string[] = ['선전포고'];
  if (favor > 0 || pacts.length) {
    v = GRIEVANCE.surprise;
    why[0] = '기습 침공';
  }
  if (pacts.length) {
    v += GRIEVANCE.brokeAgree;
    why.push('협정 깨기');
  }
  if (civOf(before).council.active.some((a) => a.agenda === 'truce' && a.untilMs > before.worldMs)) {
    v += GRIEVANCE.holy;
    why.push('성지 휴전 어김');
  }
  s = addGrievance(s, id, v, why.join(' · '));
  if (pacts.length) s = withCiv(s, (c) => void (c.agreements = c.agreements.filter((a) => a.who !== id)));
  return s;
}

export function canAgree(s: GameState, id: string, kind: AgreeId): string | null {
  const me = s.player.countryId;
  const a = agreeById(kind);
  const tech = TECHS.find((t) => t.agree?.includes(kind));
  if (tech && !hasTech(s, tech.id)) return `${tech.name} 연구 필요`;
  if (id === me || !isAlive(s.world, id)) return '할 수 없는 나라';
  if (relationOf(s.world, me, id) === '전쟁') return '전쟁 중이에요';
  if (activeAgreements(s, id).some((x) => x.kind === kind)) return '이미 맺었어요';
  if (favorOf(s, id) < a.favorNeed) return `호감 ${a.favorNeed} 이상이어야 받아 줘요`;
  if (s.nations[me].treasury < a.cost) return `국방예산 ${a.cost.toLocaleString()} 필요`;
  return null;
}
export function makeAgreement(s: GameState, id: string, kind: AgreeId): GameState {
  if (canAgree(s, id, kind)) return s;
  const me = s.player.countryId;
  const a = agreeById(kind);
  let ns: GameState = { ...s, nations: { ...s.nations, [me]: { ...s.nations[me], treasury: s.nations[me].treasury - a.cost } } };
  ns = withCiv(ns, (c) => {
    c.agreements = c.agreements.filter((x) => x.untilMs > s.worldMs);
    c.agreements.push({ id: c.nextId++, who: id, kind, untilMs: s.worldMs + a.hours * H });
    clog(c, `${a.icon} ${countryById(id).name}와 ${a.name} 협정(${a.hours}시간)`);
  });
  ns = worldEvent(ns, `${a.icon} ${countryById(me).name}·${countryById(id).name}, ${a.name} 협정을 맺었어요.`);
  return eureka(ns, { kind: 'agree', id: kind });
}
/** 그 나라와 무역할 때 이득(항로 개방 + 체제·카드 − 회의 금수) */
export function tradeEdge(s: GameState, id: string): number {
  const route = activeAgreements(s, id).some((a) => a.kind === 'route') ? 0.1 : 0;
  return Math.max(-0.3, Math.min(0.3, route + effSum(s, 'trade')));
}
export function extraContracts(s: GameState): number {
  return Math.round(effSum(s, 'contracts'));
}
/** 협정 중엔 긴장이 오르지 않는 나라 */
export function calmWith(s: GameState, id: string): boolean {
  return activeAgreements(s, id).some((a) => a.kind === 'nonagg' || a.kind === 'defense');
}
export function defenseMult(s: GameState): number {
  return 1 + 0.05 * Math.min(3, activeAgreements(s).filter((a) => a.kind === 'defense').length);
}

// ── 분쟁 섬 영향력 ──

export function islandLeader(s: GameState, island: string): { id: string | null; v: number } {
  const inf = civOf(s).influence[island] ?? {};
  let best: string | null = null;
  let v = 0;
  for (const [id, x] of Object.entries(inf)) if (x > v) [best, v] = [id, x];
  return { id: v >= ISLAND_LEAD_MIN ? best : null, v };
}
export function myIslands(s: GameState): string[] {
  return PIONEER_ISLANDS.filter((p) => islandLeader(s, p.id).id === s.player.countryId).map((p) => p.id);
}
export function influenceMult(s: GameState): number {
  return 1 + effSum(s, 'influence') + (hasTech(s, 's-envoy') ? 0.2 : 0);
}
export function canEnvoy(s: GameState, island: string): string | null {
  if (!PIONEER_ISLANDS.some((p) => p.id === island)) return '없는 섬';
  if (s.worldMs < civOf(s).envoyReadyMs) return '사절이 돌아오는 중';
  if (s.nations[s.player.countryId].treasury < ENVOY_COST) return `국방예산 ${ENVOY_COST.toLocaleString()} 필요`;
  return null;
}
function addInfluence(c: CivState, island: string, who: string, v: number) {
  const m = (c.influence[island] ??= {});
  m[who] = Math.min(INFLUENCE_MAX, (m[who] ?? 0) + v);
}
export function sendEnvoy(s: GameState, island: string): GameState {
  if (canEnvoy(s, island)) return s;
  const me = s.player.countryId;
  const before = myIslands(s).length;
  let ns: GameState = { ...s, nations: { ...s.nations, [me]: { ...s.nations[me], treasury: s.nations[me].treasury - ENVOY_COST } } };
  ns = withCiv(ns, (c) => {
    addInfluence(c, island, me, ENVOY_INFLUENCE * influenceMult(s));
    c.envoyReadyMs = s.worldMs + ENVOY_COOLDOWN_MS;
    clog(c, `🕊️ ${PIONEER_ISLANDS.find((p) => p.id === island)!.name}에 사절 → 영향력 +${Math.round(ENVOY_INFLUENCE * influenceMult(s))}`);
  });
  return myIslands(ns).length > before ? eureka(ns, { kind: 'island' }) : ns;
}
/** 섬 부탁(주기마다 바뀜): 자원 몇 개 보내기 */
export function islandRequest(s: GameState, island: string): { res: Res; qty: number; period: number; done: boolean } {
  const i = PIONEER_ISLANDS.findIndex((p) => p.id === island);
  const period = Math.floor(s.worldMs / ISLAND_REQUEST_MS);
  const rng = new Rng((period * 977 + i * 131 + 7) >>> 0);
  const res = rng.pick([...RESOURCES]);
  const qty = 3 + Math.floor(rng.next() * 6);
  return { res, qty, period, done: civOf(s).reqDone[island] === period };
}
export function canFulfill(s: GameState, island: string): string | null {
  const r = islandRequest(s, island);
  if (r.done) return '이번 부탁은 들어줬어요';
  if (s.economy.stock[r.res] < r.qty) return `${r.res} ${r.qty}개 필요`;
  return null;
}
export function fulfillRequest(s: GameState, island: string): GameState {
  if (canFulfill(s, island)) return s;
  const r = islandRequest(s, island);
  const me = s.player.countryId;
  const before = myIslands(s).length;
  const ns = withCiv({ ...s, economy: { ...s.economy, stock: { ...s.economy.stock, [r.res]: s.economy.stock[r.res] - r.qty } } }, (c) => {
    c.reqDone[island] = r.period;
    addInfluence(c, island, me, ISLAND_REQUEST_INFLUENCE * influenceMult(s));
    clog(c, `🏝️ ${PIONEER_ISLANDS.find((p) => p.id === island)!.name} 부탁(${r.res} ${r.qty}개) 들어줌 → 영향력 +${Math.round(ISLAND_REQUEST_INFLUENCE * influenceMult(s))}`);
  });
  return myIslands(ns).length > before ? eureka(ns, { kind: 'island' }) : ns;
}

// ── 국제 회의 ──

export function councilVotes(s: GameState, id: string): number {
  const c = civOf(s);
  const led = PIONEER_ISLANDS.filter((p) => islandLeader(s, p.id).id === id).length;
  const gov = id === s.player.countryId ? Math.round(effSum(s, 'votes')) : c.aiGov[id] === 'sanctum' ? 1 : 0;
  return 1 + led + gov;
}
export function voteCouncil(s: GameState, yes: boolean): GameState {
  const o = civOf(s).council.open;
  if (!o || o.vote !== null) return s;
  return withCiv(s, (c) => {
    c.council.open!.vote = yes;
  });
}
export function setCouncilOn(s: GameState, on: boolean): GameState {
  return withCiv(s, (c) => {
    c.council.on = on;
    if (!on) c.council.open = null;
    else c.council.nextMs = Math.max(c.council.nextMs, s.worldMs + 60e3);
  });
}
/** 부관이 대신 고르는 표(체제 성향대로) */
function aideVote(c: CivState, a: AgendaId): boolean {
  const g = c.gov ?? 'assembly';
  if (a === 'embargo') return g === 'navy';
  if (a === 'sanction') return g === 'navy' || g === 'sanctum';
  return g !== 'navy' || a === 'science';
}
function aiVote(s: GameState, id: string, o: CouncilOpen, rng: Rng): boolean {
  const me = s.player.countryId;
  const p = s.world.personalities[id];
  if (o.agenda === 'sanction' && o.target) {
    if (id === o.target) return false;
    const r = relationOf(s.world, id, o.target);
    if (r === '전쟁') return true;
    if (r === '연합') return false;
    return rng.chance(0.35);
  }
  // 나를 좋아하면 내 표를 따라가는 편
  if (o.vote !== null && favorOf(s, id) >= 30 && rng.chance(0.6)) return o.vote;
  const base: Record<AgendaId, number> = { embargo: 0.35, sanction: 0.4, truce: 0.55, science: 0.6, islands: 0.5 };
  const lean = p === '공격형' ? (o.agenda === 'truce' ? -0.25 : 0.05) : p === '경제형' ? (o.agenda === 'embargo' ? -0.2 : 0.05) : 0;
  return rng.chance(base[o.agenda] + lean + (id === me ? 0 : 0));
}
function openCouncil(s: GameState, c: CivState) {
  const rng = new Rng((Math.floor(s.worldMs / COUNCIL_EVERY_MS) * 2654435761 + s.world.seed) >>> 0);
  const a = rng.pick(AGENDAS);
  let target: string | undefined;
  if (a.id === 'sanction') {
    // 가장 많이 싸우는(전쟁이 많은) 나라을 제재 대상으로
    const alive = COUNTRIES.map((x) => x.id).filter((id) => isAlive(s.world, id));
    const wars = (id: string) => alive.filter((o) => o !== id && relationOf(s.world, id, o) === '전쟁').length;
    target = [...alive].sort((x, y) => wars(y) - wars(x) || (rng.next() < 0.5 ? -1 : 1))[0];
  }
  c.council.open = { id: c.nextId++, agenda: a.id, target, untilMs: s.worldMs + COUNCIL_ANSWER_MS, vote: null };
  c.council.nextMs = s.worldMs + COUNCIL_EVERY_MS;
  clog(c, `🏛️ 국제 회의 안건: ${a.icon} ${a.name}${target ? `(${countryById(target).name})` : ''} — ${COUNCIL_ANSWER_MS / H}시간 안에 투표`);
}
function closeCouncil(s: GameState, c: CivState): GameState {
  const o = c.council.open!;
  const me = s.player.countryId;
  if (o.vote === null) {
    o.vote = aideVote(c, o.agenda);
    clog(c, `부관이 체제 성향대로 ${o.vote ? '찬성' : '반대'}표를 던졌어요.`);
  }
  const rng = new Rng((o.id * 7919 + s.world.seed) >>> 0);
  let yes = 0;
  let no = 0;
  const tmp: GameState = { ...s, civ: c };
  for (const x of COUNTRIES) {
    if (!isAlive(s.world, x.id)) continue;
    const v = councilVotes(tmp, x.id);
    const say = x.id === me ? o.vote : aiVote(tmp, x.id, o, rng);
    if (say) yes += v;
    else no += v;
  }
  const a = agendaById(o.agenda);
  const pass = yes > no;
  c.council.open = null;
  c.council.last = `${a.icon} ${a.name}${o.target ? `(${countryById(o.target).name})` : ''}: 찬성 ${yes} · 반대 ${no} → ${pass ? '통과' : '부결'} (내 표: ${o.vote ? '찬성' : '반대'})`;
  clog(c, `🏛️ ${c.council.last}`);
  let ns: GameState = { ...s, civ: c };
  if (pass) {
    c.council.active = c.council.active.filter((x) => x.untilMs > s.worldMs);
    c.council.active.push({ agenda: o.agenda, target: o.target, untilMs: s.worldMs + COUNCIL_EFFECT_MS });
    if (o.agenda === 'truce') {
      const pairs = { ...s.world.pairs };
      for (const [k, p] of Object.entries(pairs)) pairs[k] = { ...p, tension: Math.max(0, p.tension - 15) };
      ns = { ...ns, world: { ...ns.world, pairs } };
    }
  }
  // 제재 대상은 찬성한 나를 미워하고, 반대해 주면 고마워함
  if (o.agenda === 'sanction' && o.target && o.target !== me) {
    const n = c.notes[o.target] ?? (c.notes[o.target] = []);
    n.unshift({ text: o.vote ? '회의에서 제재에 찬성함' : '회의에서 제재를 막아 줌', v: o.vote ? -15 : 15, t: s.worldMs });
    if (n.length > 6) n.length = 6;
  }
  return worldEvent(ns, `🏛️ 국제 회의 ${c.council.last}`);
}
/** 회의 제재 중인 나라의 국방예산 배율 */
export function sanctionMult(s: GameState, id: string): number {
  return civOf(s).council.active.some((a) => a.agenda === 'sanction' && a.target === id && a.untilMs > s.worldMs) ? 0.8 : 1;
}

// ── 도시 구역 · 민심 · 인구 ──

const tilesOfCity = new Map<string, Tile[]>();
export function cityTiles(cityId: string): Tile[] {
  let t = tilesOfCity.get(cityId);
  if (!t) tilesOfCity.set(cityId, (t = TILES.filter((x) => x.place === cityId)));
  return t;
}
export type Terrain = '평지' | '산' | '유적' | '바닷가';
const hash = (q: number, r: number) => {
  let h = (q * 374761393 + r * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
export function isCoast(q: number, r: number): boolean {
  return HEX_DIRS.some((d) => !TILE_AT.has(hexKey(q + d.q, r + d.r)));
}
export function seaAround(q: number, r: number): number {
  return HEX_DIRS.filter((d) => !TILE_AT.has(hexKey(q + d.q, r + d.r))).length;
}
/** 칸 지형(정해진 규칙이라 늘 같음): 바닷가 · 산 15% · 유적 5% · 나머지 평지 */
export function terrainOf(q: number, r: number): Terrain {
  if (isCoast(q, r)) return '바닷가';
  const h = hash(q, r);
  return h < 0.15 ? '산' : h < 0.2 ? '유적' : '평지';
}
const parse = (k: string) => k.split(',').map(Number) as [number, number];

export function cityCiv(s: GameState, cityId: string): CityCiv {
  return civOf(s).cities[cityId] ?? defaultCity(s, cityById(cityId));
}
function defaultCity(s: GameState, c: City): CityCiv {
  const home = c.home === s.player.countryId;
  return { loyalty: home ? 70 : 50, pop: c.size - 1, grow: 0, districts: [] };
}
export function districtSlots(s: GameState, cityId: string): number {
  return DISTRICT_SLOTS[cityById(cityId).size] + (hasTech(s, 's-federal') ? 1 : 0);
}
export function districtUnlocked(s: GameState, id: DistrictId): boolean {
  return TECHS.some((t) => t.districts?.includes(id) && hasTech(s, t.id));
}
export function canDistrict(s: GameState, cityId: string, tile: string, id: DistrictId): string | null {
  const d = districtById(id);
  const tech = TECHS.find((t) => t.districts?.includes(id))!;
  if (!districtUnlocked(s, id)) return `${tech.name} 연구 필요`;
  if (s.world.owner[cityId] !== s.player.countryId) return '우리 도시가 아니에요';
  const cc = cityCiv(s, cityId);
  if (cc.districts.length >= districtSlots(s, cityId)) return `이 도시는 구역 ${districtSlots(s, cityId)}개까지`;
  const t = cityTiles(cityId).find((x) => hexKey(x.q, x.r) === tile);
  if (!t) return '이 도시 칸이 아니에요';
  if (t.center) return '도심 칸에는 못 지어요';
  if (cc.districts.some((x) => x.tile === tile)) return '이미 구역이 있어요';
  if ((cc.mines ?? []).some((x) => x.tile === tile)) return '채굴장이 있는 칸이에요';
  if (cc.districts.some((x) => x.id === id) && id !== 'housing' && id !== 'industry') return `${d.name}은 도시마다 1개`;
  const ter = terrainOf(t.q, t.r);
  if (d.where === '바닷가 칸' && ter !== '바닷가') return '바닷가 칸에만 지어요';
  if (d.where === '평지 칸' && ter !== '평지') return '평지 칸에만 지어요';
  const me = s.player.countryId;
  if (s.nations[me].treasury < d.cost) return `국방예산 ${d.cost.toLocaleString()} 필요`;
  for (const [r, v] of Object.entries(d.res)) if (s.economy.stock[r as Res] < v!) return `${r} ${v}개 필요`;
  return null;
}
export function districtHours(s: GameState, id: DistrictId): number {
  return districtById(id).hours * Math.max(0.4, 1 - effSum(s, 'district') - originEff(s, 'district'));
}
export function buildDistrict(s: GameState, cityId: string, tile: string, id: DistrictId): GameState {
  if (canDistrict(s, cityId, tile, id)) return s;
  const d = districtById(id);
  const me = s.player.countryId;
  const stock = { ...s.economy.stock };
  for (const [r, v] of Object.entries(d.res)) stock[r as Res] -= v!;
  const ns: GameState = { ...s, economy: { ...s.economy, stock }, nations: { ...s.nations, [me]: { ...s.nations[me], treasury: s.nations[me].treasury - d.cost } } };
  return withCiv(ns, (c) => {
    const cc = (c.cities[cityId] ??= defaultCity(s, cityById(cityId)));
    cc.districts.push({ id, tile, doneMs: s.worldMs + districtHours(s, id) * H });
    clog(c, `${d.icon} ${cityById(cityId).name}에 ${d.name} 공사 시작(${Math.round(districtHours(s, id) * 10) / 10}시간)`);
  });
}
// ── 지도 칸 매장지 · 채굴장(자원 3안) ──

/** 채굴장 1곳이 실제 1시간에 캐는 양 */
export const MINE_PER_HOUR = 1;
export const MINE_COST = 1500;
export const MINE_RES: Partial<Record<Res, number>> = { 강철: 2 };
export const MINE_HOURS = 2;
const MINE_COUNT: Record<number, number> = { 2: 1, 3: 2, 4: 3 };
const FALLBACK_DEPOSITS: Res[] = ['강철', '구리', '석유', '알루미늄'];
const depositCache = new Map<string, Array<{ tile: string; res: Res }>>();
/** 도시 칸 위 매장지(정해진 규칙이라 늘 같음). 도시에서 나는 자원이 먼저, 없으면 흔한 자원 */
export function deposits(cityId: string): Array<{ tile: string; res: Res }> {
  const hit = depositCache.get(cityId);
  if (hit) return hit;
  const city = cityById(cityId);
  const n = MINE_COUNT[city.size] ?? 1;
  const own = Object.keys(CITY_RES[city.name] ?? {}) as Res[];
  const cand = cityTiles(cityId)
    .filter((t) => !t.center)
    .map((t) => ({ t, h: hash(t.q * 7 + 3, t.r * 13 + 5) + (terrainOf(t.q, t.r) === '산' ? -0.3 : 0) + (terrainOf(t.q, t.r) === '바닷가' ? 0.4 : 0) }))
    .sort((a, b) => a.h - b.h)
    .slice(0, n);
  const out = cand.map(({ t }, i) => ({
    tile: hexKey(t.q, t.r),
    res: own[i] ?? FALLBACK_DEPOSITS[Math.floor(hash(t.q, t.r * 3) * FALLBACK_DEPOSITS.length)],
  }));
  depositCache.set(cityId, out);
  return out;
}
export function depositAt(cityId: string, tile: string): Res | null {
  return deposits(cityId).find((d) => d.tile === tile)?.res ?? null;
}
export function canMine(s: GameState, cityId: string, tile: string): string | null {
  if (s.world.owner[cityId] !== s.player.countryId) return '우리 도시가 아니에요';
  if (!depositAt(cityId, tile)) return '매장지가 아니에요';
  const cc = cityCiv(s, cityId);
  if ((cc.mines ?? []).some((m) => m.tile === tile)) return '이미 채굴장이 있어요';
  if (cc.districts.some((d) => d.tile === tile)) return '구역이 있는 칸이에요';
  if (s.nations[s.player.countryId].treasury < MINE_COST) return `국방예산 ${MINE_COST.toLocaleString()} 필요`;
  for (const [r, v] of Object.entries(MINE_RES)) if (s.economy.stock[r as Res] < v!) return `${r} ${v}개 필요`;
  return null;
}
export function buildMine(s: GameState, cityId: string, tile: string): GameState {
  if (canMine(s, cityId, tile)) return s;
  const res = depositAt(cityId, tile)!;
  const me = s.player.countryId;
  const stock = { ...s.economy.stock };
  for (const [r, v] of Object.entries(MINE_RES)) stock[r as Res] -= v!;
  const ns: GameState = { ...s, economy: { ...s.economy, stock }, nations: { ...s.nations, [me]: { ...s.nations[me], treasury: s.nations[me].treasury - MINE_COST } } };
  return withCiv(ns, (c) => {
    const cc = (c.cities[cityId] ??= defaultCity(s, cityById(cityId)));
    cc.mines = [...(cc.mines ?? []), { tile, res, doneMs: s.worldMs + MINE_HOURS * H }];
    clog(c, `⛏️ ${cityById(cityId).name} ${res} 채굴장 공사 시작(${MINE_HOURS}시간)`);
  });
}
/** 내 채굴장이 실제 1시간에 캐는 자원(다 지은 것만) */
export function minePerHour(s: GameState): Partial<Record<Res, number>> {
  const me = s.player.countryId;
  const out: Partial<Record<Res, number>> = {};
  for (const city of CITIES) {
    if (s.world.owner[city.id] !== me) continue;
    const cc = civOf(s).cities[city.id];
    for (const m of cc?.mines ?? []) if (m.doneMs <= s.worldMs) out[m.res] = (out[m.res] ?? 0) + MINE_PER_HOUR * (city.home === me ? 1 : OCCUPIED_RES) * loyaltyMult(cc!.loyalty);
  }
  return out;
}
/** 가공 자원(복합소재·특수강·정밀부품)을 만들고 있는지. 없으면 켜짐 */
export function processOn(e: GameState['economy'], r: Res): boolean {
  if (r === '복합소재') return e.composite !== false;
  return e.process?.[r] !== false;
}
/** 가공 자원 하나: 다 지은 공업 구역 수 × 시간당(꺼 두면 0) */
export function processPerHour(s: GameState, r: Res): number {
  return processOn(s.economy, r) ? builtDistricts(s).filter((x) => x.d.id === 'industry').length * COMPOSITE_PER_INDUSTRY : 0;
}
/** 복합소재: 다 지은 공업 구역 수 × 시간당 */
export const compositePerHour = (s: GameState) => processPerHour(s, '복합소재');

/** 이웃 보너스 개수 */
export function adjCount(cityId: string, tile: string, id: DistrictId, cc: CityCiv): number {
  const [q, r] = parse(tile);
  const near = HEX_DIRS.map((d) => ({ q: q + d.q, r: r + d.r }));
  const distAt = (k: string) => cc.districts.find((x) => x.tile === k)?.id;
  const onLand = (h: { q: number; r: number }) => TILE_AT.has(hexKey(h.q, h.r));
  void cityId;
  switch (id) {
    case 'harbor':
      return near.filter((h) => !onLand(h)).length;
    case 'lab':
      return near.filter((h) => onLand(h) && ['산', '유적'].includes(terrainOf(h.q, h.r))).length;
    case 'industry':
      return near.filter((h) => onLand(h) && (distAt(hexKey(h.q, h.r)) === 'industry' || terrainOf(h.q, h.r) === '산')).length;
    case 'airfield':
      return near.filter((h) => distAt(hexKey(h.q, h.r)) === 'industry').length;
    case 'housing':
      return near.filter((h) => !onLand(h) || distAt(hexKey(h.q, h.r)) === 'housing').length;
  }
}
/** 다 지은 구역 목록(내 도시만) */
function builtDistricts(s: GameState): Array<{ city: string; d: DistrictState; cc: CityCiv }> {
  const me = s.player.countryId;
  const out: Array<{ city: string; d: DistrictState; cc: CityCiv }> = [];
  for (const [city, cc] of Object.entries(civOf(s).cities)) {
    if (s.world.owner[city] !== me) continue;
    for (const d of cc.districts) if (d.doneMs <= s.worldMs) out.push({ city, d, cc });
  }
  return out;
}
export function hasDistrict(s: GameState, id: DistrictId): boolean {
  return builtDistricts(s).some((x) => x.d.id === id);
}
/** 구역이 주는 모집 빠르기(해군 항만 · 공군 비행장) */
function districtBuild(s: GameState, dom: '육' | '해' | '공'): number {
  let v = 0;
  for (const { city, d, cc } of builtDistricts(s)) {
    if (dom === '해' && d.id === 'harbor') v += 0.05 + 0.02 * adjCount(city, d.tile, 'harbor', cc);
    if (dom === '공' && d.id === 'airfield') v += 0.05 + 0.02 * adjCount(city, d.tile, 'airfield', cc);
  }
  return Math.min(0.4, v);
}
function industryBonus(s: GameState): number {
  let v = 0;
  for (const { city, d, cc } of builtDistricts(s)) if (d.id === 'industry') v += 0.04 + 0.01 * adjCount(city, d.tile, 'industry', cc);
  return v;
}

/** 그 도시 민심 목표와 이유 */
export function loyaltyReasons(s: GameState, cityId: string): Array<[string, number]> {
  const c = cityById(cityId);
  const me = s.player.countryId;
  const cc = cityCiv(s, cityId);
  const rows: Array<[string, number]> = [[c.home === me ? '우리 땅' : '점령지', c.home === me ? 65 : 40]];
  let house = 0;
  for (const d of cc.districts) if (d.id === 'housing' && d.doneMs <= s.worldMs) house += 10 + 2 * adjCount(cityId, d.tile, 'housing', cc);
  if (house) rows.push(['🏘️ 주거 구역', house]);
  const eff = effSum(s, 'loyalty');
  if (eff) rows.push(['연구·카드', eff]);
  const peace = Math.min(12, 3 * activeAgreements(s).length);
  if (peace) rows.push(['평화 협정', peace]);
  let wars = 0;
  let tired = 0;
  for (const o of COUNTRIES) {
    if (o.id === me) continue;
    const p = s.world.pairs[pairKey(me, o.id)];
    if (p?.rel === '전쟁') {
      wars++;
      tired += p.weariness / 10;
    }
  }
  if (wars) rows.push([`전쟁 피로(${wars}곳)`, -Math.min(30, wars * 4 + tired)]);
  const lux = LUXURIES.filter((r) => (s.economy.stock[r] ?? 0) >= 1);
  if (lux.length) rows.push([`생활 자원 ${lux.map((r) => RES_ICON[r]).join('')}`, lux.length * LUXURY_LOYALTY]);
  if (BASIC_RES.some((r) => (s.economy.stock[r] ?? 0) < 1)) rows.push(['자원 부족', -5]);
  if (chaos(s)) rows.push(['체제 혼란', -10]);
  const sl = Math.round(splitLoyalty(s) * 10) / 10;
  if (sl) rows.push([`👥 사회 예산 ${splitOf(s).soc}%`, sl]);
  const ol = originEff(s, 'loyalty');
  if (ol) rows.push([`🎓 출신(${originOf(s)!.name})`, ol]);
  const cl = Math.round(cabLoyalty(s) * 10) / 10;
  if (cl) rows.push(['🏘️ 행안부·복지부', cl]);
  return rows;
}
export function loyaltyTarget(s: GameState, cityId: string): number {
  return Math.max(0, Math.min(100, loyaltyReasons(s, cityId).reduce((a, [, v]) => a + v, 0)));
}
/** 민심이 낮으면 그 도시 생산이 줄어듦(아주 낮아도 도시는 잃지 않음) */
export function loyaltyMult(loyalty: number): number {
  return loyalty >= LOYALTY_OK ? 1 : 0.5 + loyalty / 100;
}
export function popCap(s: GameState, cityId: string): number {
  const cc = cityCiv(s, cityId);
  const house = cc.districts.filter((d) => d.id === 'housing' && d.doneMs <= s.worldMs).length;
  return Math.min(POP_MAX, cityById(cityId).size * 2 - 1 + house * 2);
}
/** 내 도시 전체: 민심 배율(수입 무게 평균) · 인구 수입 보너스 */
export function cityTotals(s: GameState): { mult: number; popBonus: number; pop: number; avgLoyalty: number } {
  const me = s.player.countryId;
  let w = 0;
  let m = 0;
  let pb = 0;
  let pop = 0;
  let loy = 0;
  for (const c of CITIES) {
    if (s.world.owner[c.id] !== me) continue;
    const cc = cityCiv(s, c.id);
    w += c.value;
    m += c.value * loyaltyMult(cc.loyalty);
    pb += c.value * (cc.pop - (c.size - 1)) * POP_BUDGET; // 처음 인구보다 자란 만큼
    pop += cc.pop;
    loy += c.value * cc.loyalty;
  }
  if (!w) return { mult: 1, popBonus: 0, pop: 0, avgLoyalty: 0 };
  return { mult: m / w, popBonus: pb / w, pop, avgLoyalty: loy / w };
}

// ── 기존 계산에 붙는 배율(국방예산·자원·모집·전투력·임무) ──

const islandPort = (s: GameState) => myIslands(s).filter((id) => PIONEER_ISLANDS.find((p) => p.id === id)!.res === '항구').length * 0.03;
export function civBudgetMult(s: GameState): number {
  const t = cityTotals(s);
  return Math.max(0.3, (1 + effSum(s, 'budget') + t.popBonus + industryBonus(s) + islandPort(s)) * t.mult * (chaos(s) ? 1 - GOV_CHAOS : 1));
}
export function civResMult(s: GameState): number {
  const t = cityTotals(s);
  return Math.max(0.3, (1 + effSum(s, 'res') + industryBonus(s)) * t.mult * (chaos(s) ? 1 - GOV_CHAOS : 1)) * splitEco(s) * cabRes(s);
}
/** 모집 빠르기 배율(시간을 이 값으로 나눔) */
export function civBuildSpeed(s: GameState, unit: string): number {
  const dom = domOf(unit);
  return Math.max(0.5, 1 + effDom(s, 'build', dom) + districtBuild(s, dom) + originEff(s, 'build') + (dom === '해' ? originEff(s, 'buildNavy') : 0)) * (chaos(s) ? 1 - GOV_CHAOS : 1) * splitBuild(s) * cabBuild(s);
}
export function civPowerMult(s: GameState, unit: string): number {
  return Math.max(0.5, 1 + effDom(s, 'power', domOf(unit)) + facBonus(s, '우주기지'));
}
export function civMission(s: GameState): number {
  return effSum(s, 'mission') + facBonus(s, '정보본부');
}

/** 병과가 열렸는지: 지도자 등급 + 연구 둘 다(11-22 결정). 등급은 economy가 먼저 봄 */
/** 특화 유닛도 바탕 병과와 같은 조건(11-23 결정). variant는 예전 호출과 맞추려고 남김 */
export function unitTechLock(s: GameState, unit: string, variant?: unknown): string | null {
  void variant;
  const t = techForUnit(unit);
  if (t && !hasTech(s, t.id)) return `${t.name} 연구 필요`;
  const dom = UNITS.find((u) => u.name === unit)?.domain;
  if (dom === '해' && !hasDistrict(s, 'harbor')) return '항만 구역이 있는 도시가 필요해요';
  if (['공격헬기', '전투기', '폭격기'].includes(unit) && !hasDistrict(s, 'airfield')) return '비행장 구역이 있는 도시가 필요해요';
  return null;
}

// ── 시간 흐름 ──

/** ms만큼 쌓이는 것: 연구 · 민심 · 인구 · 섬 자원 · 자원 교환 협정 */
export function civAccrue(s: GameState, ms: number): GameState {
  if (!(ms > 0)) return s;
  const h = ms / H;
  const me = s.player.countryId;
  const c = cloneCiv(civOf(s));
  let ns: GameState = s;
  // 연구
  const rate = researchRate(s);
  for (const line of ['mil', 'soc'] as const) {
    let pts = rate * h + c.bank[line];
    c.bank[line] = 0;
    while (pts > 0) {
      const id = c.cur[line];
      if (!id) {
        c.bank[line] = Math.min(rate * 12, pts);
        break;
      }
      const t = techById(id)!;
      const need = t.hours * (c.eureka.includes(id) ? 0.5 : 1) - (c.progress[id] ?? 0);
      if (pts < need) {
        c.progress[id] = (c.progress[id] ?? 0) + pts;
        pts = 0;
      } else {
        pts -= need;
        ns = finishTech({ ...ns, civ: c }, c, t);
      }
    }
  }
  // 도시: 민심이 목표로 다가가고, 좋으면 인구가 자람
  const tmp: GameState = { ...ns, civ: c };
  const growth = 1 + effSum(tmp, 'growth') + originEff(tmp, 'growth') + cabGrowth(tmp);
  for (const city of CITIES) {
    if (s.world.owner[city.id] !== me) continue;
    const cc = (c.cities[city.id] ??= defaultCity(s, city));
    const target = loyaltyTarget(tmp, city.id);
    cc.loyalty += (target - cc.loyalty) * (1 - Math.exp(-LOYALTY_SPEED * h));
    const house = cc.districts.filter((d) => d.id === 'housing' && d.doneMs <= s.worldMs).length;
    if (cc.loyalty >= 60 && cc.pop < popCap(tmp, city.id)) {
      cc.grow += (1 + house) * growth * h;
      const need = cc.pop * GROW_NEED_PER_POP;
      if (cc.grow >= need) {
        cc.grow -= need;
        cc.pop++;
        clog(c, `👪 ${city.name} 인구 ${cc.pop}단계`);
      }
    } else if (cc.loyalty < 30) cc.grow = Math.max(0, cc.grow - h);
  }
  // 섬 자원 · 자원 교환 협정
  const stock = { ...ns.economy.stock };
  let stockChanged = false;
  for (const id of myIslands(tmp)) {
    const p = PIONEER_ISLANDS.find((x) => x.id === id)!;
    if (p.res !== '항구') {
      stock[p.res] = (stock[p.res] ?? 0) + ISLAND_RES_PER_HOUR * h;
      stockChanged = true;
    }
  }
  // 채굴장(지도 칸 매장지) · 복합소재(공업 구역)
  for (const city of CITIES) {
    if (s.world.owner[city.id] !== me) continue;
    const cc = c.cities[city.id];
    for (const m of cc?.mines ?? []) {
      if (m.doneMs > s.worldMs) continue;
      stock[m.res] = (stock[m.res] ?? 0) + MINE_PER_HOUR * (city.home === me ? 1 : OCCUPIED_RES) * loyaltyMult(cc.loyalty) * h;
      stockChanged = true;
    }
  }
  const nInd = builtDistricts(tmp).filter((x) => x.d.id === 'industry').length;
  for (const pr of PROCESSED) {
    if (!nInd || !processOn(ns.economy, pr.res)) continue;
    let make = nInd * COMPOSITE_PER_INDUSTRY * h;
    for (const [r, v] of Object.entries(pr.input)) make = Math.min(make, Math.max(0, stock[r as Res] ?? 0) / v!);
    if (make > 0) {
      for (const [r, v] of Object.entries(pr.input)) stock[r as Res] -= v! * make;
      stock[pr.res] = (stock[pr.res] ?? 0) + make;
      stockChanged = true;
    }
  }
  for (const a of c.agreements) {
    if (a.kind !== 'swap' || a.untilMs <= s.worldMs) continue;
    const theirs = RESOURCES.find((r) => CITIES.some((ct) => s.world.owner[ct.id] === a.who && cityResHas(ct.name, r)));
    const mine = [...RESOURCES].sort((x, y) => stock[y] - stock[x])[0];
    if (!theirs || theirs === mine || stock[mine] < h) continue;
    stock[theirs] += h;
    stock[mine] -= h;
    stockChanged = true;
  }
  // 쌓인 호감 이유·불만은 천천히 줄어듦
  const fd = Math.exp(-FAVOR_DECAY_PER_DAY * (ms / DAY));
  const gd = Math.exp(-GRIEVANCE_DECAY_PER_DAY * (ms / DAY));
  for (const list of Object.values(c.notes)) for (const n of list) n.v *= fd;
  for (const k of Object.keys(c.notes)) c.notes[k] = c.notes[k].filter((n) => Math.abs(n.v) >= 0.5);
  for (const k of Object.keys(c.grievance)) {
    c.grievance[k] *= gd;
    if (c.grievance[k] < 0.5) delete c.grievance[k];
  }
  return { ...ns, civ: c, economy: stockChanged ? { ...ns.economy, stock } : ns.economy };
}
function cityResHas(name: string, r: Res): boolean {
  return (CITY_RES[name]?.[r] ?? 0) > 0;
}

/** AI 판단(실제 15분)마다: 섬 영향력 · 회의 · 끝난 구역 · 협정 중 긴장 막기 */
export function civTick(s: GameState, pairsBefore: Record<string, { tension: number }>): GameState {
  const c = cloneCiv(civOf(s));
  const me = s.player.countryId;
  let ns: GameState = { ...s, civ: c };
  // 협정 중인 나라와는 긴장이 오르지 않음
  const pairs = { ...s.world.pairs };
  let changed = false;
  for (const a of c.agreements) {
    if (a.untilMs <= s.worldMs || (a.kind !== 'nonagg' && a.kind !== 'defense')) continue;
    const k = pairKey(me, a.who);
    const before = pairsBefore[k]?.tension;
    if (before !== undefined && pairs[k] && pairs[k].rel !== '전쟁' && pairs[k].tension > before) {
      pairs[k] = { ...pairs[k], tension: before };
      changed = true;
    }
  }
  if (changed) ns = { ...ns, world: { ...ns.world, pairs } };
  // AI 나라이 가까운 섬에 영향력을 쌓음
  const rng = new Rng((Math.floor(s.worldMs / 60e3) * 31 + s.world.seed) >>> 0);
  for (const x of COUNTRIES) {
    if (x.id === me || !isAlive(s.world, x.id)) continue;
    const cap = CITIES.find((ct) => ct.home === x.id && ct.capital)!;
    const near = [...PIONEER_ISLANDS].sort((a, b) => Math.hypot(a.x - cap.x, a.y - cap.y) - Math.hypot(b.x - cap.x, b.y - cap.y)).slice(0, 2);
    const k = (c.aiGov[x.id] === 'assembly' ? 1.25 : 1) * (s.world.personalities[x.id] === '경제형' ? 1.2 : 1);
    for (const p of near) if (rng.chance(0.6)) addInfluence(c, p.id, x.id, AI_INFLUENCE_PER_TICK * k * (1 + rng.next()));
  }
  // 국제 회의
  if (c.council.on) {
    if (c.council.open && s.worldMs >= c.council.open.untilMs) ns = closeCouncil(ns, c);
    else if (!c.council.open && s.worldMs >= c.council.nextMs) openCouncil(ns, c);
  }
  // 체제가 다른 맞수와는 긴장이 조금씩 오름(같으면 내려감)
  if (c.gov) {
    const p2 = { ...ns.world.pairs };
    for (const x of COUNTRIES) {
      if (x.id === me) continue;
      const k = pairKey(me, x.id);
      const p = p2[k];
      if (!p || p.rel === '전쟁' || p.rel === '연합' || calmWith({ ...ns, civ: c }, x.id)) continue;
      const d = c.aiGov[x.id] === c.gov ? -0.05 : isRival(me, x.id) ? 0.05 : 0;
      if (d) p2[k] = { ...p, tension: Math.max(0, Math.min(99, p.tension + d)) };
    }
    ns = { ...ns, world: { ...ns.world, pairs: p2 } };
  }
  return districtNews({ ...ns, civ: c });
}

/** 다 지은 구역 소식 + 번뜩임 */
export function districtNews(s: GameState): GameState {
  const fresh: DistrictId[] = [];
  let ns = withCiv(s, (c) => {
    for (const cc of Object.values(c.cities))
      for (const d of cc.districts)
        if (d.doneMs <= s.worldMs && !d.told) {
          d.told = true;
          fresh.push(d.id);
          clog(c, `${districtById(d.id).icon} ${districtById(d.id).name} 완공`);
        }
  });
  if (!fresh.length) return s;
  for (const id of fresh) ns = eureka(ns, { kind: 'district', id });
  return ns;
}

// ── 시험 버튼 ──

/** 시험용: 진행 중인 연구 둘 다 바로 끝내기(없으면 고를 수 있는 첫 연구) */
export function debugFinishResearch(s: GameState): GameState {
  let ns = s;
  for (const line of ['mil', 'soc'] as const) {
    const c = civOf(ns);
    const id = c.cur[line] ?? TECHS.find((t) => t.line === line && !canResearch(ns, t.id))?.id;
    if (!id) continue;
    const c2 = cloneCiv(c);
    ns = finishTech({ ...ns, civ: c2 }, c2, techById(id)!);
    ns = { ...ns, civ: c2 };
  }
  return ns;
}
/** 시험용: 모든 연구 끝 */
export function debugAllResearch(s: GameState): GameState {
  return withCiv(s, (c) => {
    c.done = TECHS.map((t) => t.id);
    c.cur = { mil: null, soc: null };
    c.era = 4;
  });
}
/** 시험용: 짓는 중인 구역 바로 완공 */
export function debugFinishDistricts(s: GameState): GameState {
  return districtNews(
    withCiv(s, (c) => {
      for (const cc of Object.values(c.cities)) for (const d of cc.districts) d.doneMs = Math.min(d.doneMs, s.worldMs);
    }),
  );
}
/** 시험용: 회의를 바로 열기 */
export function debugCouncil(s: GameState): GameState {
  return withCiv(s, (c, ns) => {
    if (c.council.open) return closeCouncil(ns, c);
    openCouncil(ns, c);
  });
}

export { AGREES, GOVS, DISTRICTS, AGENDAS };

/** 도시 기본 생산 밖에서 실제 1시간에 들고 나는 자원: 분쟁 섬 · 채굴장 · 복합소재(재료는 −) */
export function extraResPerHour(s: GameState): Partial<Record<Res, number>> {
  const out: Partial<Record<Res, number>> = { ...minePerHour(s) };
  for (const id of myIslands(s)) {
    const p = PIONEER_ISLANDS.find((x) => x.id === id)!;
    if (p.res !== '항구') out[p.res] = (out[p.res] ?? 0) + ISLAND_RES_PER_HOUR;
  }
  for (const pr of PROCESSED) {
    const n = processPerHour(s, pr.res);
    if (n <= 0) continue;
    out[pr.res] = (out[pr.res] ?? 0) + n;
    for (const [r, v] of Object.entries(pr.input)) out[r as Res] = (out[r as Res] ?? 0) - v! * n;
  }
  return out;
}
