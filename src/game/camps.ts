// 11-28 대장 결정 "중-1 진영 세계(신냉전)": 3장이 열리면 세계가 진영으로 갈림.
//  · 해양 진영 · 대륙 진영 · 비동맹 진영(뒤에 강대국이 무너지거나 4장이 되면 작은 나라들이 '신흥 연합'을 만듦)
//  · 진영 맹주: 진영 안에서 기여 점수 1등. 우리가 맹주면 나라 예산 +5% · 외교 +5 · 세계 영향력 외교 +20
//  · 진영 회의: 실제 48시간마다 12시간 열림. 안건(공동 제재 · 공동 방위 · 기술 공유 · 맹주 신임)에 찬반 투표
//  · 진영 바꾸기: 7일에 한 번. 옛 진영은 배신자로 봄(호감 −12, 맹주였으면 −20 · 명성 −30), 새 진영은 입단 선물
//  · 같은 진영끼리는 긴장이 풀리고, 큰 두 진영 맹주끼리는 긴장이 쌓임
import { COUNTRIES, countryById } from '../data/world';
import { addFavorNote } from './civ';
import { registerDomRows } from './domestic';
import { pushReport } from './report';
import { Rng } from './rng';
import { priceBase, type GameState } from './state';
import { isAlive, pairKey, relationOf } from './world';

const H = 3600e3;
const DAY = 24 * H;
export type CampId = 'west' | 'east' | 'south' | 'rise';
export const CAMPS: Record<CampId, { icon: string; name: string; color: string; text: string }> = {
  west: { icon: '🌊', name: '해양 진영', color: '#4aa3ff', text: '바다와 무역로를 쥔 나라들' },
  east: { icon: '🏔️', name: '대륙 진영', color: '#ff6b5a', text: '넓은 땅과 자원을 쥔 나라들' },
  south: { icon: '🌍', name: '비동맹 진영', color: '#7bd88f', text: '어느 큰 편에도 서지 않는 나라들' },
  rise: { icon: '✊', name: '신흥 연합', color: '#f5c542', text: '강대국 틈에서 뭉친 작은 나라들' },
};
export const CAMP_ACT = 3;
export const COUNCIL_GAP = 48 * H;
export const COUNCIL_OPEN = 12 * H;
export const SWITCH_WAIT = 7 * DAY;
export const CONTRIB_PER_DAY = 3;
export const CONTRIB_PTS = 12;
export const CONTRIB_COST = 0.4;
export const LEADER_BUDGET = 0.05;
export const EFFECT_MS = 72 * H;

export type TopicId = 'sanction' | 'defense' | 'tech' | 'trust';
export const TOPICS: Record<TopicId, { icon: string; name: string; text: string }> = {
  sanction: { icon: '🚫', name: '공동 제재', text: '맞선 진영 맹주에게 72시간 나라 예산 −10%' },
  defense: { icon: '🛡️', name: '공동 방위', text: '진영 나라 도시 방어도 +10 · 우리 안보 +4(72시간)' },
  tech: { icon: '🔬', name: '기술 공유', text: '72시간 연구 속도 +6%' },
  trust: { icon: '👑', name: '맹주 신임', text: '지면 맹주 기여 점수 −30%(맹주가 바뀔 수 있음)' },
};

export interface Council { camp: CampId; topic: TopicId; target: string | null; endMs: number; vote: 'yes' | 'no' | null; yes: number; no: number }
export interface CampEffect { camp: CampId; kind: TopicId; target: string | null; untilMs: number }
export interface CampState {
  sinceMs: number;
  member: Record<string, CampId>;
  pts: Record<string, number>;
  councilMs: number;
  council: Council | null;
  effects: CampEffect[];
  switchMs: number;
  contrib: { day: string; n: number };
  /** 신흥 연합이 생겼나 */
  rise?: boolean;
  /** 우리가 맹주였던 적이 있나(비밀 목표) */
  wasLeader?: boolean;
  dayMs: number;
  seed: number;
}

export const campsOn = (s: GameState) => (s.world.act ?? CAMP_ACT) >= CAMP_ACT;
export const campOf = (s: GameState, id: string): CampId | null => s.camps?.member[id] ?? null;
const dayKey = (ms: number) => String(Math.floor(ms / DAY));
const basePts = (id: string) => (countryById(id).military + countryById(id).economy) / 2;

function firstCamp(id: string): CampId {
  const b = countryById(id).bloc;
  return b === 'continental' ? 'east' : b === 'independent' ? 'south' : 'west';
}
export function newCamps(s: GameState): CampState {
  const member: Record<string, CampId> = {};
  const pts: Record<string, number> = {};
  for (const c of COUNTRIES) {
    member[c.id] = firstCamp(c.id);
    pts[c.id] = basePts(c.id);
  }
  return { sinceMs: s.worldMs, member, pts, councilMs: s.worldMs + 6 * H, council: null, effects: [], switchMs: 0, contrib: { day: '', n: 0 }, dayMs: s.worldMs, seed: (s.world.seed ^ 0x1b873593) >>> 0 };
}

/** 진영 나라들(살아 있는) */
export function campMembers(s: GameState, camp: CampId): string[] {
  const c = s.camps;
  if (!c) return [];
  return COUNTRIES.map((x) => x.id).filter((id) => c.member[id] === camp && isAlive(s.world, id));
}
/** 진영 맹주(기여 점수 1등) */
export function campLeader(s: GameState, camp: CampId): string | null {
  const c = s.camps;
  if (!c) return null;
  const list = campMembers(s, camp);
  if (!list.length) return null;
  return list.reduce((a, b) => ((c.pts[b] ?? 0) > (c.pts[a] ?? 0) ? b : a));
}
export const isCampLeader = (s: GameState, id: string) => {
  const camp = campOf(s, id);
  return !!camp && campLeader(s, camp) === id;
};
export function liveCamps(s: GameState): CampId[] {
  return (Object.keys(CAMPS) as CampId[]).filter((k) => campMembers(s, k).length > 0);
}
/** 맞선 큰 진영(서 ↔ 동, 나머지는 가장 큰 진영) */
export function rivalCamp(s: GameState, camp: CampId): CampId {
  if (camp === 'west') return 'east';
  if (camp === 'east') return 'west';
  return campMembers(s, 'west').length >= campMembers(s, 'east').length ? 'west' : 'east';
}

export const contribCost = (s: GameState) => Math.max(80, Math.round(priceBase(s) * CONTRIB_COST));
export function canContribute(s: GameState): string | null {
  if (!s.camps || !campsOn(s)) return `진영 세계는 ${CAMP_ACT}장부터 열려요`;
  const c = s.camps;
  const n = c.contrib.day === dayKey(s.worldMs) ? c.contrib.n : 0;
  if (n >= CONTRIB_PER_DAY) return `기여는 하루 ${CONTRIB_PER_DAY}번까지예요`;
  if (s.nations[s.player.countryId].treasury < contribCost(s)) return '나라 예산이 모자라요';
  return null;
}
export function contribute(s: GameState): { state: GameState; text: string } {
  const why = canContribute(s);
  if (why) return { state: s, text: why };
  const me = s.player.countryId;
  const c = s.camps!;
  const day = dayKey(s.worldMs);
  const n = c.contrib.day === day ? c.contrib.n : 0;
  const cost = contribCost(s);
  const camp = c.member[me];
  const wasLeader = campLeader(s, camp) === me;
  let ns: GameState = {
    ...s,
    camps: { ...c, pts: { ...c.pts, [me]: (c.pts[me] ?? 0) + CONTRIB_PTS }, contrib: { day, n: n + 1 } },
    nations: { ...s.nations, [me]: { ...s.nations[me], treasury: s.nations[me].treasury - cost } },
  };
  const now = campLeader(ns, camp) === me;
  if (now) ns = { ...ns, camps: { ...ns.camps!, wasLeader: true } };
  const text = now && !wasLeader ? `👑 우리가 ${CAMPS[camp].name} 맹주가 됐어요! 나라 예산 +${Math.round(LEADER_BUDGET * 100)}% · 외교 +5` : `🤝 진영 기여 +${CONTRIB_PTS} (나라 예산 −${cost.toLocaleString('ko-KR')})`;
  return { state: now && !wasLeader ? pushReport(ns, { icon: '👑', text }) : ns, text };
}

export function canSwitch(s: GameState, to: CampId): string | null {
  if (!s.camps || !campsOn(s)) return `진영 세계는 ${CAMP_ACT}장부터 열려요`;
  const me = s.player.countryId;
  if (s.camps.member[me] === to) return '지금 있는 진영이에요';
  if (!campMembers(s, to).length) return '그 진영은 아직 없어요';
  if (s.worldMs < s.camps.switchMs) return '진영은 7일에 한 번만 바꿀 수 있어요';
  return null;
}
/** 진영 바꾸기(배신): 옛 진영 호감 −, 새 진영 입단 선물 */
export function switchCamp(s: GameState, to: CampId): { state: GameState; text: string } {
  const why = canSwitch(s, to);
  if (why) return { state: s, text: why };
  const me = s.player.countryId;
  const c = s.camps!;
  const from = c.member[me];
  const leader = campLeader(s, from) === me;
  const old = campMembers(s, from).filter((x) => x !== me);
  const fresh = campMembers(s, to);
  let ns: GameState = { ...s, camps: { ...c, member: { ...c.member, [me]: to }, pts: { ...c.pts, [me]: basePts(me) / 2 }, switchMs: s.worldMs + SWITCH_WAIT } };
  for (const id of old) ns = addFavorNote(ns, id, `🗡️ ${CAMPS[from].name}을 배신함`, leader ? -20 : -12);
  for (const id of fresh) ns = addFavorNote(ns, id, `🤝 ${CAMPS[to].name}에 들어옴`, 4);
  const gift = Math.round(priceBase(s) * 1.5);
  ns = {
    ...ns,
    officer: { ...ns.officer, fame: Math.max(0, ns.officer.fame - 30) },
    nations: { ...ns.nations, [me]: { ...ns.nations[me], treasury: ns.nations[me].treasury + gift } },
  };
  const text = `🔀 ${CAMPS[from].name}을 떠나 ${CAMPS[to].name}에 들어갔어요. 옛 진영 ${old.length}곳 호감 −${leader ? 20 : 12} · 명성 −30 · 입단 선물 나라 예산 +${gift.toLocaleString('ko-KR')}`;
  ns = { ...ns, world: { ...ns.world, events: [{ t: s.worldMs, kind: '외교' as const, text, mine: true }, ...ns.world.events].slice(0, 200) } };
  return { state: pushReport(ns, { icon: '🔀', text }), text };
}

export function canVoteCouncil(s: GameState): string | null {
  const o = s.camps?.council;
  if (!o) return '열린 진영 회의가 없어요';
  if (o.camp !== campOf(s, s.player.countryId)) return '우리 진영 회의가 아니에요';
  if (o.vote) return '이미 투표했어요';
  return null;
}
/** 진영 회의 투표. 맹주는 표 3장 */
export function voteCouncil(s: GameState, vote: 'yes' | 'no'): { state: GameState; text: string } {
  const why = canVoteCouncil(s);
  if (why) return { state: s, text: why };
  const c = s.camps!;
  const o = c.council!;
  const w = isCampLeader(s, s.player.countryId) ? 3 : 1;
  const council: Council = { ...o, vote, yes: o.yes + (vote === 'yes' ? w : 0), no: o.no + (vote === 'no' ? w : 0) };
  return { state: { ...s, camps: { ...c, council } }, text: `🗳️ ${TOPICS[o.topic].name}에 ${vote === 'yes' ? '찬성' : '반대'}했어요${w > 1 ? '(맹주 표 3장)' : ''}.` };
}
/** 우리가 맹주면 회의 안건을 바꿀 수 있음(투표 전) */
export function canSetTopic(s: GameState): string | null {
  const o = s.camps?.council;
  if (!o) return '열린 진영 회의가 없어요';
  if (o.camp !== campOf(s, s.player.countryId) || !isCampLeader(s, s.player.countryId)) return '맹주만 안건을 정해요';
  if (o.vote) return '이미 투표했어요';
  return null;
}
export function setTopic(s: GameState, topic: TopicId): { state: GameState; text: string } {
  const why = canSetTopic(s);
  if (why) return { state: s, text: why };
  const c = s.camps!;
  const o = c.council!;
  const target = topic === 'sanction' ? campLeader(s, rivalCamp(s, o.camp)) : null;
  return { state: { ...s, camps: { ...c, council: { ...o, topic, target } } }, text: `👑 안건을 「${TOPICS[topic].name}」(으)로 정했어요.` };
}

const effOn = (s: GameState, kind: TopicId, camp: CampId | null) => !!camp && (s.camps?.effects ?? []).some((e) => e.kind === kind && e.camp === camp && e.untilMs > s.worldMs);

/** 나라 예산 배율(맹주 덤 · 공동 제재) */
export function campMult(s: GameState, id: string): number {
  if (!s.camps || !campsOn(s)) return 1;
  let m = 1;
  if (isCampLeader(s, id) && campMembers(s, campOf(s, id)!).length >= 3) m *= 1 + LEADER_BUDGET;
  if ((s.camps.effects ?? []).some((e) => e.kind === 'sanction' && e.target === id && e.untilMs > s.worldMs)) m *= 0.9;
  return m;
}

function log(ns: GameState, text: string, mine: boolean): GameState {
  return { ...ns, world: { ...ns.world, events: [{ t: ns.worldMs, kind: '외교' as const, text, mine }, ...ns.world.events].slice(0, 200) } };
}

/** 세계 판단마다 */
export function campsTick(s: GameState): GameState {
  if (s.ending || !campsOn(s)) return s;
  const me = s.player.countryId;
  if (!s.camps) {
    let ns: GameState = { ...s, camps: newCamps(s) };
    const camp = ns.camps!.member[me];
    const text = `🌐 신냉전이 시작됐어요. 세계가 ${liveCamps(ns).map((k) => CAMPS[k].name).join(' · ')}(으)로 갈렸고, 우리는 ${CAMPS[camp].name}이에요. 외교 → 🌐 진영에서 기여·회의·진영 바꾸기를 할 수 있어요.`;
    ns = log(ns, text, true);
    return pushReport(ns, { icon: '🌐', text });
  }
  let ns = s;
  let c = { ...s.camps };
  const rng = new Rng(c.seed);
  // 시간마다: 같은 진영 긴장 풀림 · 두 큰 진영 맹주 사이 긴장 쌓임
  const hours = Math.min(48, (s.worldMs - c.dayMs) / H);
  if (hours >= 1) {
    const pairs = { ...ns.world.pairs };
    for (const camp of liveCamps(ns)) {
      const list = campMembers(ns, camp);
      for (let i = 0; i < list.length; i++)
        for (let j = i + 1; j < list.length; j++) {
          const k = pairKey(list[i], list[j]);
          const p = pairs[k];
          if (p && p.rel !== '전쟁' && p.tension > 0) pairs[k] = { ...p, tension: Math.max(0, p.tension - 0.4 * hours) };
        }
    }
    const lw = campLeader(ns, 'west'), le = campLeader(ns, 'east');
    if (lw && le) {
      const k = pairKey(lw, le);
      const p = pairs[k];
      if (p && p.rel !== '전쟁' && p.rel !== '연합') pairs[k] = { ...p, tension: Math.min(85, p.tension + 0.25 * hours) };
    }
    // 하루 점수: 힘에 따라 쌓이고 3%씩 줄어듦
    const days = hours / 24;
    const pts = { ...c.pts };
    for (const x of COUNTRIES) {
      if (!isAlive(ns.world, x.id)) continue;
      const grow = x.id === me ? basePts(me) * 0.04 : basePts(x.id) * 0.05 * rng.range(0.6, 1.4) * (1 + (ns.world.grow?.[x.id]?.lv.eco ?? 0) * 0.02);
      pts[x.id] = Math.max(0, (pts[x.id] ?? 0) * Math.pow(0.97, days) + grow * days);
    }
    // AI가 자기 진영 맹주와 전쟁 중이면 맞은 진영으로 옮김
    const member = { ...c.member };
    for (const x of COUNTRIES) {
      if (x.id === me || !isAlive(ns.world, x.id)) continue;
      const lead = campLeader({ ...ns, camps: { ...c, member, pts } }, member[x.id]);
      if (lead && lead !== x.id && relationOf(ns.world, x.id, lead) === '전쟁') {
        const to = rivalCamp(ns, member[x.id]);
        if (to !== member[x.id]) {
          ns = log(ns, `🔀 ${x.name}이(가) 맹주 ${countryById(lead).name}와 싸우다 ${CAMPS[member[x.id]].name}을 떠나 ${CAMPS[to].name}으로 옮겼어요.`, lead === me);
          member[x.id] = to;
        }
      }
    }
    ns = { ...ns, world: { ...ns.world, pairs } };
    c = { ...c, pts, member, dayMs: s.worldMs };
    const mine = campLeader({ ...ns, camps: c }, c.member[me]) === me;
    if (mine && !c.wasLeader) c.wasLeader = true;
  }
  // 진영 회의
  if (c.council && s.worldMs >= c.council.endMs) {
    const o = c.council;
    const members = campMembers({ ...ns, camps: c }, o.camp).filter((x) => x !== me);
    let yes = o.yes, no = o.no;
    for (let i = 0; i < members.length; i++) {
      const p = o.topic === 'trust' ? 0.55 : 0.62;
      if (rng.chance(p)) yes++;
      else no++;
    }
    const pass = yes > no;
    const lead = campLeader({ ...ns, camps: c }, o.camp);
    const t = TOPICS[o.topic];
    const myCamp = c.member[me] === o.camp;
    let tail = '';
    if (pass) {
      if (o.topic === 'trust') tail = '맹주를 그대로 믿기로 했어요.';
      else {
        c = { ...c, effects: [...c.effects.filter((e) => e.untilMs > s.worldMs), { camp: o.camp, kind: o.topic, target: o.target, untilMs: s.worldMs + EFFECT_MS }] };
        tail = t.text + '.';
        if (o.topic === 'defense') {
          const defense = { ...ns.world.defense };
          for (const [cid, own] of Object.entries(ns.world.owner)) if (c.member[own] === o.camp) defense[cid] = Math.min(100, (defense[cid] ?? 0) + 10);
          ns = { ...ns, world: { ...ns.world, defense } };
        }
        if (o.topic === 'sanction' && o.target && o.target !== me && myCamp) ns = addFavorNote(ns, o.target, '🚫 진영 공동 제재', -6);
      }
    } else if (o.topic === 'trust' && lead) {
      c = { ...c, pts: { ...c.pts, [lead]: (c.pts[lead] ?? 0) * 0.7 } };
      tail = `${countryById(lead).name} 맹주 신임이 떨어졌어요(기여 −30%).`;
    } else tail = '안건이 부결됐어요.';
    if (myCamp && o.vote) {
      const sided = (o.vote === 'yes') === pass;
      for (const id of members) ns = addFavorNote(ns, id, sided ? '🗳️ 진영 회의에서 같은 뜻' : '🗳️ 진영 회의에서 다른 뜻', sided ? 2 : -2);
    }
    const text = `${CAMPS[o.camp].icon} ${CAMPS[o.camp].name} 회의 「${t.icon} ${t.name}」 ${pass ? '통과' : '부결'}(${yes} 대 ${no}). ${tail}`;
    ns = log(ns, text, myCamp || o.target === me);
    if (myCamp || o.target === me) ns = pushReport(ns, { icon: CAMPS[o.camp].icon, text });
    c = { ...c, council: null };
  }
  if (!c.council && s.worldMs >= c.councilMs) {
    // 진영을 돌아가며 열고, 우리 진영은 두 번에 한 번
    const live = liveCamps({ ...ns, camps: c });
    const myCamp = c.member[me];
    const camp = rng.chance(0.5) || !live.length ? myCamp : rng.pick(live);
    const topics: TopicId[] = ['sanction', 'defense', 'tech', 'trust'];
    const topic = rng.pick(topics);
    const target = topic === 'sanction' ? campLeader({ ...ns, camps: c }, rivalCamp(ns, camp)) : null;
    c = { ...c, council: { camp, topic, target, endMs: s.worldMs + COUNCIL_OPEN, vote: null, yes: 0, no: 0 }, councilMs: s.worldMs + COUNCIL_GAP };
    if (camp === myCamp) {
      const lead = campLeader({ ...ns, camps: c }, camp) === me;
      ns = pushReport({ ...ns, camps: c }, { icon: '🗳️', text: `대장님, ${CAMPS[camp].name} 회의가 열렸습니다. 안건 「${TOPICS[topic].icon} ${TOPICS[topic].name}」${target ? `(${countryById(target).name})` : ''}. 12시간 안에 외교 → 🌐 진영에서 투표해 주십시오.${lead ? ' 맹주라 안건을 바꿀 수 있고 표가 3장입니다.' : ''}` });
    }
  }
  c.seed = rng.seed;
  return { ...ns, camps: c };
}

/** 신흥 연합 만들기(강대국 붕괴 · 4장) */
export function formRise(s: GameState, why: string): GameState {
  const c = s.camps;
  if (!c || c.rise) return s;
  const me = s.player.countryId;
  const small = COUNTRIES.filter((x) => x.id !== me && isAlive(s.world, x.id) && x.military < 55 && c.member[x.id] !== 'west' && c.member[x.id] !== 'east')
    .concat(COUNTRIES.filter((x) => x.id !== me && isAlive(s.world, x.id) && x.military < 40 && (c.member[x.id] === 'west' || c.member[x.id] === 'east')))
    .slice(0, 7);
  if (small.length < 3) return { ...s, camps: { ...c, rise: true } };
  const member = { ...c.member };
  for (const x of small) member[x.id] = 'rise';
  const text = `✊ ${why} ${small.map((x) => x.name).join('·')}이(가) 「신흥 연합」을 만들었어요. 외교 → 🌐 진영에서 들어갈 수도 있어요.`;
  return pushReport(log({ ...s, camps: { ...c, member, rise: true } }, text, true), { icon: '✊', text });
}

registerDomRows((s, key) => {
  if (!s.camps || !campsOn(s)) return [];
  const me = s.player.countryId;
  const camp = campOf(s, me);
  const rows: Array<[string, number]> = [];
  if (key === 'diplo' && isCampLeader(s, me)) rows.push(['👑 진영 맹주', 5]);
  if (key === 'defense' && effOn(s, 'defense', camp)) rows.push(['🛡️ 진영 공동 방위', 4]);
  if (key === 'research' && effOn(s, 'tech', camp)) rows.push(['🔬 진영 기술 공유', 0.06]);
  return rows;
});
