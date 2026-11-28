// 11-28 대장 결정 "분쟁 사다리 A": 현실처럼 전면전은 시작하기 어렵고, 대부분은 항의·관세·그림자 공작·미사일 몇 발로 다툰다.
//  0 평화 → 1 외교 마찰 → 2 경제 전쟁 → 3 그림자 전쟁 → 4 제한 타격 → 5 전면전
//  · 전면전 관문: 명분 60 이상 + 지지도 45% 이상 → 총동원 24시간(실제) → 그 뒤 선전포고
//  · 동원하는 24시간 동안 상대는 7가지 준비(동원령·국경 요새화·동맹 호출·보복 관세·사이버 선제공격·여론전·예비 비축)를 함
//  · AI도 나와 긴장이 아주 높으면 24시간 총동원을 걸고 선전포고함(준비가 보임)
//  · 전쟁 비용·피로: 전쟁 중인 나라마다 하루 나라 예산이 들고, 오래 끌수록 지지도가 깎임
import { FRONT, cityById } from '../data/cities';
import { isArchRival } from '../data/archRivals';
import { PERSONALITIES } from '../data/leaders';
import { COUNTRIES, countryById } from '../data/world';
import { addPresMod, approvalOf } from './approval';
import { actBlocksWar } from './acts';
import { canDiplo, doDiplo } from './command';
import { tariffBetween, doTariff } from './pressure';
import { pushReport } from './report';
import { Rng } from './rng';
import { budgetPerDay, type GameState } from './state';
import { lordOf } from './surrender';
import { declareWar, gwa, isAlive, pairKey, relationOf } from './world';

const H = 3600e3;
const DAY = 24 * H;

/** 전면전 관문 */
export const CB_NEED = 60;
export const APPROVAL_NEED = 45;
export const MOB_HOURS = 24;
/** 사다리 한 칸 오르는 행동 대기(나라마다) */
export const STEP_COOLDOWN_H = 12;
/** 내 행동으로 쌓인 명분이 하루에 줄어드는 양 */
export const CB_DECAY_PER_DAY = 5;
/** 전쟁 비용: 전쟁 하나마다 하루 나라 예산의 이 몫 */
export const WAR_COST_SHARE = 0.04;
/** AI가 나를 향해 총동원을 거는 긴장 · 판단마다 확률(× 공격 성향) */
export const AI_MOB_TENSION = 75;
export const AI_MOB_CHANCE = 0.01;

export const LEVELS = [
  { lv: 0, icon: '🕊️', name: '평화', text: '다툼 없음' },
  { lv: 1, icon: '🗣️', name: '외교 마찰', text: '항의·대사 소환, 긴장이 오름' },
  { lv: 2, icon: '📦', name: '경제 전쟁', text: '관세·제재로 서로 예산을 깎음' },
  { lv: 3, icon: '🕶️', name: '그림자 전쟁', text: '공작원·사이버로 몰래 흔듦, 총동원 중' },
  { lv: 4, icon: '🚀', name: '제한 타격', text: '미사일 몇 발로 경고, 전쟁은 아님' },
  { lv: 5, icon: '⚔️', name: '전면전', text: '도시를 빼앗는 전쟁(비용·피로가 큼)' },
] as const;

export type StepId = 'protest' | 'tariff' | 'shadow' | 'strike';
export const STEPS: Array<{ id: StepId; lv: number; icon: string; name: string; text: string; cb: number; costDays: number }> = [
  { id: 'protest', lv: 1, icon: '🗣️', name: '공식 항의', text: '대사를 불러 항의. 긴장 +10', cb: 5, costDays: 0 },
  { id: 'tariff', lv: 2, icon: '📦', name: '경제 제재', text: '관세 30%를 48시간 매김', cb: 6, costDays: 0 },
  { id: 'shadow', lv: 3, icon: '🕶️', name: '그림자 공작', text: '국경 도시 방어도 −10 · 상대 예산 깎기. 들키면 긴장 크게 ↑', cb: 8, costDays: 0.15 },
  { id: 'strike', lv: 4, icon: '🚀', name: '제한 타격', text: '미사일로 한 도시 방어도 −20. 보복이 올 수 있음', cb: 12, costDays: 0.3 },
];

export type PrepId = 'troops' | 'fort' | 'allies' | 'tariff' | 'cyber' | 'media' | 'reserve';
export const PREPS: Record<PrepId, { icon: string; name: string }> = {
  troops: { icon: '🪖', name: '동원령(병력 +8%)' },
  fort: { icon: '🧱', name: '국경 요새화(도시 3곳 방어도 +15)' },
  allies: { icon: '📞', name: '동맹 호출(그 연합국들과 긴장 +15)' },
  tariff: { icon: '📦', name: '보복 관세' },
  cyber: { icon: '💻', name: '사이버 선제공격(상대 예산 깎기)' },
  media: { icon: '📺', name: '여론전(상대 지지도 −2)' },
  reserve: { icon: '🏦', name: '예비 비축(국고 +5%)' },
};
const PREP_ORDER: PrepId[] = ['troops', 'fort', 'allies', 'tariff', 'cyber', 'media', 'reserve'];

export interface Mob {
  /** 총동원을 건 나라 */
  by: string;
  /** 칠 나라 */
  vs: string;
  startMs: number;
  endMs: number;
  /** 지금까지 한 준비(맞서는 나라의 준비) */
  preps: PrepId[];
}
export interface LadderState {
  mobs: Mob[];
  /** 내 행동으로 쌓인 명분(나라마다) */
  cb: Record<string, number>;
  /** 나라마다 마지막 사다리 행동 시각 · 그 행동 단계 */
  last: Record<string, { ms: number; lv: number }>;
  /** 나에게 제한 타격·사이버를 한 시각(나라마다) */
  hitMe: Record<string, number>;
  /** 전쟁 비용·피로를 마지막으로 매긴 날 */
  costDay?: number;
  /** 시험용 24시간 건너뛰기 보고 */
  skipReport?: string[];
}
export const ladderOf = (s: GameState): LadderState => s.ladder ?? { mobs: [], cb: {}, last: {}, hitMe: {} };
const nm = (id: string) => countryById(id).name;

/** 지금 그 나라와 몇 단계인가 */
export function levelOf(s: GameState, foe: string): number {
  const me = s.player.countryId;
  if (relationOf(s.world, me, foe) === '전쟁') return 5;
  const L = ladderOf(s);
  const recent = (ms?: number) => ms != null && s.worldMs - ms < 72 * H;
  const last = L.last[foe];
  if ((last && last.lv >= 4 && recent(last.ms)) || recent(L.hitMe[foe])) return 4;
  if (L.mobs.some((m) => (m.by === me && m.vs === foe) || (m.by === foe && m.vs === me)) || (last && last.lv >= 3 && recent(last.ms))) return 3;
  if (tariffBetween(s, me, foe) || tariffBetween(s, foe, me)) return 2;
  const p = s.world.pairs[pairKey(me, foe)];
  if ((p?.tension ?? 0) >= 40 || (last && recent(last.ms))) return 1;
  return 0;
}

/** 명분(0~100)과 까닭 */
export function cbRows(s: GameState, foe: string): Array<[string, number]> {
  const me = s.player.countryId;
  const w = s.world;
  const p = w.pairs[pairKey(me, foe)];
  const rows: Array<[string, number]> = [];
  const t = Math.round((p?.tension ?? 0) * 0.3);
  if (t) rows.push([`긴장 ${Math.round(p?.tension ?? 0)}`, t]);
  if (FRONT.some((c) => c.home === me && w.owner[c.id] === foe)) rows.push(['우리 도시를 빼앗음', 40]);
  if (COUNTRIES.some((c) => c.id !== me && c.id !== foe && relationOf(w, me, c.id) === '연합' && relationOf(w, foe, c.id) === '전쟁')) rows.push(['연합국을 공격 중', 20]);
  if (isArchRival(me, foe)) rows.push(['숙적', 10]);
  if (tariffBetween(s, foe, me)) rows.push(['우리에게 관세', 10]);
  const hit = ladderOf(s).hitMe[foe];
  if (hit != null && s.worldMs - hit < 7 * DAY) rows.push(['우리를 먼저 때림', 25]);
  if (ladderOf(s).mobs.some((m) => m.by === foe && m.vs === me)) rows.push(['우리를 향해 총동원', 30]);
  const mine = Math.round(ladderOf(s).cb[foe] ?? 0);
  if (mine) rows.push(['사다리를 오르며 쌓은 명분', mine]);
  if (relationOf(w, me, foe) === '연합') rows.push(['연합국', -30]);
  if (relationOf(w, me, foe) === '휴전') rows.push(['휴전 중', -10]);
  return rows;
}
export const cbOf = (s: GameState, foe: string) => Math.max(0, Math.min(100, cbRows(s, foe).reduce((a, [, v]) => a + v, 0)));

export const mobOf = (s: GameState, by: string, vs: string) => ladderOf(s).mobs.find((m) => m.by === by && m.vs === vs);

/** 사다리 한 칸 행동을 할 수 있나 */
export function canStep(s: GameState, foe: string, step: StepId): string | null {
  const me = s.player.countryId;
  if (foe === me || !isAlive(s.world, foe)) return '할 수 없는 나라';
  if (relationOf(s.world, me, foe) === '전쟁') return '이미 전면전이에요';
  const st = STEPS.find((x) => x.id === step)!;
  const last = ladderOf(s).last[foe];
  if (last && s.worldMs - last.ms < STEP_COOLDOWN_H * H) return `${Math.ceil((last.ms + STEP_COOLDOWN_H * H - s.worldMs) / H)}시간 뒤 다시`;
  if (st.lv > levelOf(s, foe) + 1) return `먼저 ${LEVELS[st.lv - 1].name} 단계를 거쳐야 해요`;
  if (step === 'tariff' && tariffBetween(s, me, foe)) return '이미 관세를 매겼어요';
  const cost = stepCost(s, step);
  if (cost > s.nations[me].treasury) return `나라 예산 ${cost.toLocaleString('ko-KR')} 필요`;
  return null;
}
export const stepCost = (s: GameState, step: StepId) => Math.round(budgetPerDay(s, s.player.countryId) * STEPS.find((x) => x.id === step)!.costDays);

function bumpTension(s: GameState, foe: string, v: number): GameState {
  const k = pairKey(s.player.countryId, foe);
  const p = s.world.pairs[k];
  if (!p) return s;
  return { ...s, world: { ...s.world, pairs: { ...s.world.pairs, [k]: { ...p, tension: Math.min(99, p.tension + v) } } } };
}

/** 사다리 한 칸 행동 */
export function doStep(s: GameState, foe: string, step: StepId): { state: GameState; text: string } {
  const why = canStep(s, foe, step);
  if (why) return { state: s, text: why };
  const me = s.player.countryId;
  const st = STEPS.find((x) => x.id === step)!;
  const rng = new Rng((s.world.seed ^ Math.floor(s.worldMs / 1000) ^ 0x1add3) >>> 0);
  let ns: GameState = s;
  let text = '';
  const cost = stepCost(s, step);
  if (cost) ns = { ...ns, nations: { ...ns.nations, [me]: { ...ns.nations[me], treasury: ns.nations[me].treasury - cost } } };
  if (step === 'protest') {
    ns = bumpTension(ns, foe, 10);
    text = `${nm(foe)} 대사를 불러 공식 항의했어요. 긴장 +10`;
  } else if (step === 'tariff') {
    ns = doTariff(ns, foe).state;
    text = `${nm(foe)}에 경제 제재(관세 30%)를 걸었어요.`;
  } else if (step === 'shadow') {
    const city = FRONT.filter((c) => s.world.owner[c.id] === foe && !c.capital).sort((a, b) => s.world.defense[a.id] - s.world.defense[b.id])[0];
    const caught = rng.chance(0.3);
    const cut = Math.round(budgetPerDay(s, foe) * 0.25);
    ns = { ...ns, nations: { ...ns.nations, [foe]: { ...ns.nations[foe], treasury: Math.max(0, ns.nations[foe].treasury - cut) } } };
    if (city) ns = { ...ns, world: { ...ns.world, defense: { ...ns.world.defense, [city.id]: Math.max(0, ns.world.defense[city.id] - 10) } } };
    ns = bumpTension(ns, foe, caught ? 25 : 5);
    text = `${nm(foe)}에 그림자 공작: ${city ? `${city.name} 방어도 −10 · ` : ''}예산 −${cut.toLocaleString('ko-KR')}.${caught ? ' ⚠️ 들켜서 긴장 +25' : ''}`;
  } else {
    const city = FRONT.filter((c) => s.world.owner[c.id] === foe && !c.capital).sort((a, b) => s.world.defense[a.id] - s.world.defense[b.id])[0];
    if (city) ns = { ...ns, world: { ...ns.world, defense: { ...ns.world.defense, [city.id]: Math.max(0, ns.world.defense[city.id] - 20) } } };
    ns = bumpTension(ns, foe, 25);
    ns = addPresMod(ns, '🚀 단호한 대응', 2, 12);
    text = `${city ? `${nm(foe)} ${city.name}` : nm(foe)}에 제한 타격! 방어도 −20.`;
    if (rng.chance(0.4)) {
      const mineC = FRONT.filter((c) => s.world.owner[c.id] === me).sort((a, b) => a.id.localeCompare(b.id));
      const hit = mineC[Math.floor(rng.next() * mineC.length)];
      if (hit) ns = { ...ns, world: { ...ns.world, defense: { ...ns.world.defense, [hit.id]: Math.max(0, ns.world.defense[hit.id] - 8) } } };
      ns = withLadder(ns, (L) => ({ ...L, hitMe: { ...L.hitMe, [foe]: s.worldMs } }));
      text += ` ${nm(foe)}가 보복 미사일을 쐈어요${hit ? `(${hit.name} 방어도 −8)` : ''}.`;
    }
  }
  ns = withLadder(ns, (L) => ({ ...L, cb: { ...L.cb, [foe]: Math.min(40, (L.cb[foe] ?? 0) + st.cb) }, last: { ...L.last, [foe]: { ms: s.worldMs, lv: st.lv } } }));
  ns = { ...ns, world: { ...ns.world, events: [{ t: s.worldMs, kind: '외교', text: `${st.icon} ${text}`, mine: true }, ...ns.world.events] } };
  return { state: ns, text: `${text}${cost ? ` (나라 예산 −${cost.toLocaleString('ko-KR')})` : ''} · 명분 +${st.cb}` };
}

function withLadder(s: GameState, f: (L: LadderState) => LadderState): GameState {
  return { ...s, ladder: f(ladderOf(s)) };
}

/** 전면전(총동원)을 걸 수 있나. 독립 전쟁은 관문 없이 바로 */
export function canMobilize(s: GameState, foe: string): string | null {
  const me = s.player.countryId;
  const base = canDiplo(s, foe, '선전포고');
  if (base) return base;
  if (lordOf(s, me) === foe) return null;
  if (mobOf(s, me, foe)) return '이미 총동원 중이에요';
  const cb = cbOf(s, foe);
  if (cb < CB_NEED) return `명분 ${cb}/${CB_NEED} · 사다리를 올라 명분을 쌓아요`;
  const ap = Math.round(approvalOf(s));
  if (ap < APPROVAL_NEED) return `지지도 ${ap}%/${APPROVAL_NEED}% · 국민이 전쟁을 원하지 않아요`;
  return null;
}

/** 총동원 시작(독립 전쟁은 바로 선포) */
export function mobilize(s: GameState, foe: string): { state: GameState; text: string } {
  const why = canMobilize(s, foe);
  if (why) return { state: s, text: why };
  const me = s.player.countryId;
  if (lordOf(s, me) === foe) {
    const r = doDiplo(s, foe, '선전포고');
    return { state: r.state, text: r.text };
  }
  let ns = withLadder(s, (L) => ({ ...L, mobs: [...L.mobs, { by: me, vs: foe, startMs: s.worldMs, endMs: s.worldMs + MOB_HOURS * H, preps: [] }] }));
  ns = bumpTension(ns, foe, 15);
  const text = `🪖 ${nm(foe)}를 향해 총동원령! ${MOB_HOURS}시간 뒤 전면전이 시작돼요. 그동안 ${nm(foe)}도 전쟁 준비를 해요.`;
  ns = { ...ns, world: { ...ns.world, events: [{ t: s.worldMs, kind: '외교', text, mine: true }, ...ns.world.events] } };
  return { state: ns, text };
}
/** 총동원 거두기(긴장은 남음) */
export function standDown(s: GameState, foe: string): GameState {
  const me = s.player.countryId;
  if (!mobOf(s, me, foe)) return s;
  const ns = withLadder(s, (L) => ({ ...L, mobs: L.mobs.filter((m) => !(m.by === me && m.vs === foe)) }));
  return pushReport(ns, { icon: '🕊️', text: `대장님, ${nm(foe)}를 향한 총동원을 거뒀습니다.` });
}

/** 맞서는 나라가 준비 하나를 함. ns를 직접 바꾸지 않고 새 상태를 돌려줌 */
function doPrep(s: GameState, side: string, other: string, prep: PrepId): GameState {
  const me = s.player.countryId;
  let ns = s;
  const n = ns.nations[side];
  if (!n) return ns;
  if (prep === 'troops') ns = { ...ns, nations: { ...ns.nations, [side]: { ...n, troops: Math.round(n.troops * 1.08) } } };
  else if (prep === 'reserve') ns = { ...ns, nations: { ...ns.nations, [side]: { ...n, treasury: Math.round(n.treasury * 1.05) } } };
  else if (prep === 'fort') {
    const ids = FRONT.filter((c) => ns.world.owner[c.id] === side).sort((a, b) => ns.world.defense[a.id] - ns.world.defense[b.id]).slice(0, 3).map((c) => c.id);
    const defense = { ...ns.world.defense };
    for (const id of ids) defense[id] = Math.min(100, defense[id] + 15);
    ns = { ...ns, world: { ...ns.world, defense } };
  } else if (prep === 'allies') {
    const pairs = { ...ns.world.pairs };
    for (const c of COUNTRIES) {
      if (c.id === side || c.id === other || relationOf(ns.world, side, c.id) !== '연합') continue;
      const k = pairKey(c.id, other);
      if (pairs[k] && pairs[k].rel !== '전쟁') pairs[k] = { ...pairs[k], tension: Math.min(99, pairs[k].tension + 15) };
    }
    ns = { ...ns, world: { ...ns.world, pairs } };
  } else if (prep === 'tariff') {
    if (side !== me && other === me && !tariffBetween(ns, side, me)) {
      const tariffs = [...(ns.pressure?.tariffs ?? []).filter((x) => x.untilMs > ns.worldMs), { from: side, to: me, rate: 0.2, untilMs: ns.worldMs + 48 * H }];
      ns = { ...ns, pressure: { ...(ns.pressure ?? { tariffs: [] }), tariffs } };
    }
  } else if (prep === 'cyber') {
    const o = ns.nations[other];
    if (o) ns = { ...ns, nations: { ...ns.nations, [other]: { ...o, treasury: Math.max(0, o.treasury - Math.round(budgetPerDay(ns, other) * 0.5)) } } };
    if (other === me) ns = withLadder(ns, (L) => ({ ...L, hitMe: { ...L.hitMe, [side]: ns.worldMs } }));
  } else if (prep === 'media') {
    if (other === me) ns = addPresMod(ns, `📺 ${nm(side)} 여론전`, -2, 24);
  }
  return ns;
}

/** 세계 판단마다: 총동원 진행·준비·선포, AI 총동원, 전쟁 비용·피로, 명분 줄어듦 */
export function ladderTick(s: GameState): GameState {
  const me = s.player.countryId;
  let ns = s;
  const L0 = ladderOf(s);
  const rng = new Rng(((s.world.seed ^ Math.floor(s.worldMs / 60e3)) * 2654435761 + 0x1a) >>> 0);
  const keep: Mob[] = [];
  const done: Mob[] = [];
  for (const m0 of L0.mobs) {
    if (!isAlive(ns.world, m0.by) || !isAlive(ns.world, m0.vs) || relationOf(ns.world, m0.by, m0.vs) === '전쟁') continue;
    // AI 총동원은 연합·휴전이 되거나 긴장이 내려가면 거둠
    if (m0.by !== me && (relationOf(ns.world, m0.by, m0.vs) !== '중립' || (ns.world.pairs[pairKey(m0.by, m0.vs)]?.tension ?? 0) < 50)) {
      if (m0.vs === me) ns = pushReport(ns, { icon: '🕊️', text: `대장님, ${gwa(nm(m0.by))} 우리를 향한 총동원을 거뒀습니다.` });
      continue;
    }
    let m = m0;
    // 24시간 동안 7가지 준비를 고르게(맞서는 나라가)
    const want = Math.min(PREP_ORDER.length, Math.floor(((ns.worldMs - m.startMs) / (m.endMs - m.startMs)) * PREP_ORDER.length));
    while (m.preps.length < want) {
      const order = [...PREP_ORDER].sort((a, b) => ((m.startMs + a.length * 7) % 13) - ((m.startMs + b.length * 7) % 13));
      const next = order.find((x) => !m.preps.includes(x))!;
      ns = doPrep(ns, m.vs, m.by, next);
      m = { ...m, preps: [...m.preps, next] };
      if (m.vs === me) ns = pushReport(ns, { icon: PREPS[next].icon, text: `대장님, 총동원에 맞서 우리도 준비했습니다: ${PREPS[next].name}` });
    }
    if (ns.worldMs >= m.endMs) done.push(m);
    else keep.push(m);
  }
  ns = withLadder(ns, (L) => ({ ...L, mobs: keep }));
  for (const m of done) {
    if (m.by === me) {
      const block = actBlocksWar(ns, m.vs);
      if (block) {
        ns = pushReport(ns, { icon: '🪖', text: `대장님, 총동원은 끝났지만 ${nm(m.vs)}에 선전포고할 수 없습니다: ${block}` });
        continue;
      }
      const r = doDiplo(ns, m.vs, '선전포고');
      ns = pushReport(r.state, { icon: '⚔️', text: `대장님, 총동원이 끝나 ${nm(m.vs)}와(과) 전면전을 시작했습니다. 상대가 한 준비: ${m.preps.map((p) => PREPS[p].name).join(' · ') || '없음'}` });
    } else {
      const w = { ...ns.world, pairs: { ...ns.world.pairs }, events: [...ns.world.events] };
      for (const k of Object.keys(w.pairs)) w.pairs[k] = { ...w.pairs[k] };
      declareWar(w, ns.worldMs, me, m.by, m.vs, '총동원 끝');
      ns = { ...ns, world: w };
      if (m.vs === me) ns = pushReport(ns, { icon: '⚔️', text: `대장님, ${gwa(nm(m.by))} 총동원을 마치고 우리에게 선전포고했습니다!` });
    }
  }
  // AI가 나를 향해 총동원
  for (const c of COUNTRIES) {
    const id = c.id;
    if (id === me || !isAlive(ns.world, id) || relationOf(ns.world, me, id) === '전쟁' || relationOf(ns.world, me, id) === '연합') continue;
    if (mobOf(ns, id, me) || lordOf(ns, id) === me) continue;
    const p = ns.world.pairs[pairKey(me, id)];
    if (!p || p.tension < AI_MOB_TENSION || ns.world.act === 1) continue;
    const agg = PERSONALITIES[ns.world.personalities[id]]?.aggression ?? 1;
    if (!rng.chance(AI_MOB_CHANCE * agg)) continue;
    ns = withLadder(ns, (L) => ({ ...L, mobs: [...L.mobs, { by: id, vs: me, startMs: ns.worldMs, endMs: ns.worldMs + MOB_HOURS * H, preps: [] }] }));
    ns = pushReport(ns, { icon: '🚨', text: `대장님, ${gwa(nm(id))} 우리를 향해 총동원령을 내렸습니다! ${MOB_HOURS}시간 뒤 전쟁이 날 수 있습니다. 외교로 긴장을 낮추거나 맞서 준비하세요.` });
  }
  // 하루마다: 전쟁 비용·피로, 내가 쌓은 명분 줄어듦
  const day = Math.floor(ns.worldMs / DAY);
  const L = ladderOf(ns);
  if (L.costDay == null) ns = withLadder(ns, (x) => ({ ...x, costDay: day }));
  else if (day > L.costDay) {
    const days = Math.min(7, day - L.costDay);
    const wars = COUNTRIES.filter((c) => c.id !== me && isAlive(ns.world, c.id) && relationOf(ns.world, me, c.id) === '전쟁');
    if (wars.length) {
      const cost = Math.round(budgetPerDay(ns, me) * WAR_COST_SHARE * wars.length * days);
      const longest = Math.max(...wars.map((c) => (ns.world.pairs[pairKey(me, c.id)]?.weariness ?? 0) / 96));
      const tired = Math.min(8, Math.round(wars.length * 1.5 + longest / 7));
      ns = { ...ns, nations: { ...ns.nations, [me]: { ...ns.nations[me], treasury: Math.max(0, ns.nations[me].treasury - cost) } } };
      ns = addPresMod(ns, '⚔️ 전쟁 피로', -tired, 24);
      ns = pushReport(ns, { icon: '⚔️', text: `대장님, 전쟁 ${wars.length}곳 비용으로 나라 예산 −${cost.toLocaleString('ko-KR')}, 전쟁 피로로 지지도 −${tired}(하루).` });
    }
    const cb: Record<string, number> = {};
    for (const [k, v] of Object.entries(ladderOf(ns).cb)) if (v - CB_DECAY_PER_DAY * days > 0) cb[k] = v - CB_DECAY_PER_DAY * days;
    ns = withLadder(ns, (x) => ({ ...x, cb, costDay: day }));
  }
  return ns;
}

/** 시험용 "⏩ 24시간 뒤로" 보고: 앞뒤 상태를 비교해 줄글로 */
export function skipSummary(before: GameState, after: GameState): string[] {
  const me = before.player.countryId;
  const out: string[] = [];
  const fmt = (n: number) => `${n >= 0 ? '+' : ''}${Math.round(n).toLocaleString('ko-KR')}`;
  const cities = (s: GameState) => FRONT.filter((c) => s.world.owner[c.id] === me).length;
  out.push(`🏙️ 우리 도시 ${cities(before)} → ${cities(after)}`);
  out.push(`💰 나라 예산 ${fmt(after.nations[me].treasury - before.nations[me].treasury)}`);
  out.push(`🪖 병력 ${fmt(after.nations[me].troops - before.nations[me].troops)}`);
  out.push(`🙂 지지도 ${Math.round(approvalOf(before))}% → ${Math.round(approvalOf(after))}%`);
  for (const m of ladderOf(after).mobs) out.push(`🚨 ${nm(m.by)} → ${nm(m.vs)} 총동원 중 · 준비 ${m.preps.length}/7 · ${Math.max(0, Math.ceil((m.endMs - after.worldMs) / H))}시간 남음`);
  const evs = after.world.events.filter((e) => e.t > before.worldMs).slice(0, 12);
  for (const e of evs) out.push(`· ${e.text}`);
  const caps = FRONT.filter((c) => c.capital && after.world.owner[c.id] !== before.world.owner[c.id]).map((c) => cityById(c.id).name);
  if (caps.length) out.push(`🏛️ 수도 주인 바뀜: ${caps.join(', ')}`);
  return out;
}
