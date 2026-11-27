// 11-27 대장 요청 3번: 점령지 관리청.
//  편입한 도시가 많아지면 관리가 어려우니, 점령 도시는 시·도지사가 생기기 전까지(편입 = 정상화) '점령지 관리청'의 관리단이 맡음.
//  관리단은 맡은 도시의 형편(군정·민정·전쟁 피해)을 보고 내정·정상화 방안을 수시로 3~4건 건의 → 지도자가 승인하면 나라 예산을 써서 바로 효과.
//  점령 직후(48시간)에는 건의가 더 자주, 더 많이(6건까지) 올라옴.
//  도시가 편입되면 시·도지사에게 넘기고(지사는 governors.ts가 새로 세움), 관리단은 다른 점령 도시로 옮기거나 일이 없으면 쉼.
//  꼭두각시 정부를 세우면 그 정부에 넘기고, 도시를 잃으면 철수.
import { cityById } from '../data/cities';
import { makeName } from '../data/names';
import { annexEntry, occupiedCities, patchEntry } from './annex';
import { registerCityLoyaltyRows } from './civ';
import { payTreasury } from './domestic';
import { ensureGovernors } from './governors';
import { pushReport } from './report';
import { Rng } from './rng';
import { budgetPerDay, type GameState } from './state';
import { homeOf } from './world';

const H = 3600e3;
/** 점령 직후 건의가 많이 올라오는 시간 */
export const EARLY_HOURS = 48;
/** 한 도시에 쌓이는 건의 수(점령 직후 / 평소) */
export const CAP_EARLY = 6;
export const CAP_NORMAL = 4;
/** 다음 건의까지(점령 직후 / 평소) */
export const GAP_EARLY = 1 * H;
export const GAP_NORMAL = 3 * H;
/** 관리단을 처음 보내면 한꺼번에 올리는 건의 수 */
export const FIRST_BATCH = 3;
/** 건의는 실제 18시간 동안 기다림 */
export const PROP_TTL = 18 * H;
/** 관리단 수: 처음 2개, 늘리기로 6개까지 */
export const TEAMS_START = 2;
export const TEAMS_MAX = 6;
/** 관리단 하나 늘리는 비용(나라 예산 하루치 × 이것) */
export const TEAM_COST_DAYS = 0.8;
/** 선전 효과(찬성률) 최대 */
export const VOTE_MAX = 20;

export type Effect =
  | { k: 'mil'; h: number }
  | { k: 'damage'; v: number }
  | { k: 'loy'; v: number; h: number }
  | { k: 'vote'; v: number }
  | { k: 'sweep'; h: number }
  | { k: 'relief'; v: number; h: number };

export interface OccKindDef {
  id: string;
  icon: string;
  name: string;
  /** 군정 / 민정 / 아무 때 */
  when: '군정' | '민정' | 'any';
  /** 나라 예산 하루치 × 이것 × 도시 크기 */
  cost: number;
  eff: Effect[];
  /** 건의 말 */
  say: string;
  /** 피해가 이만큼은 있어야 */
  dmg?: number;
  /** 조약 도시에서는 안 함(투표가 없어서) */
  noTreaty?: boolean;
}

export const OCC_KINDS: OccKindDef[] = [
  { id: 'patrol', icon: '🚓', name: '치안 순찰 강화', when: '군정', cost: 0.15, eff: [{ k: 'mil', h: 4 }], say: '거리마다 순찰을 늘리면 치안을 더 빨리 잡을 수 있습니다.' },
  { id: 'disarm', icon: '🔫', name: '무기 회수 작전', when: '군정', cost: 0.1, eff: [{ k: 'sweep', h: 24 }], say: '집집마다 숨긴 무기를 거두면 반란 걱정이 줄어듭니다.' },
  { id: 'ration', icon: '🍞', name: '긴급 배급소 설치', when: '군정', cost: 0.25, eff: [{ k: 'relief', v: 4, h: 48 }], say: '주민들이 굶고 있습니다. 배급소부터 열어야 합니다.' },
  { id: 'checkpoint', icon: '🚧', name: '검문소 줄이기', when: '군정', cost: 0.05, eff: [{ k: 'loy', v: 4, h: 48 }, { k: 'mil', h: 2 }], say: '검문이 너무 많아 원성이 큽니다. 큰길만 남기겠습니다.' },
  { id: 'fieldhosp', icon: '🏥', name: '야전 병원 개방', when: '군정', cost: 0.3, eff: [{ k: 'damage', v: 4 }, { k: 'loy', v: 3, h: 48 }], say: '다친 주민도 우리 군 병원에서 치료하겠습니다.' },
  { id: 'power', icon: '💡', name: '전기·수도 복구', when: '민정', cost: 0.4, eff: [{ k: 'damage', v: 8 }], say: '전기와 물이 끊긴 동네가 많습니다. 복구부터 하겠습니다.', dmg: 1 },
  { id: 'market', icon: '🛒', name: '시장 다시 열기', when: '민정', cost: 0.2, eff: [{ k: 'loy', v: 6, h: 72 }], say: '시장이 열려야 사람들이 일상으로 돌아옵니다.' },
  { id: 'school', icon: '🏫', name: '학교 다시 열기', when: '민정', cost: 0.18, eff: [{ k: 'loy', v: 4, h: 96 }], say: '아이들이 학교로 돌아가면 부모 마음도 돌아섭니다.' },
  { id: 'jobs', icon: '👷', name: '일자리 사업', when: '민정', cost: 0.35, eff: [{ k: 'loy', v: 5, h: 72 }, { k: 'damage', v: 3 }], say: '주민을 복구 공사에 고용하면 돈도 돌고 도시도 고쳐집니다.' },
  { id: 'hire', icon: '🧑‍💼', name: '현지 공무원 채용', when: '민정', cost: 0.2, eff: [{ k: 'vote', v: 3 }, { k: 'loy', v: 2, h: 48 }], say: '현지 사람을 공무원으로 쓰면 편입 찬성이 늘어납니다.', noTreaty: true },
  { id: 'townhall', icon: '📢', name: '주민 설명회', when: '민정', cost: 0.08, eff: [{ k: 'vote', v: 2 }, { k: 'loy', v: 3, h: 48 }], say: '편입하면 무엇이 좋아지는지 직접 설명하겠습니다.', noTreaty: true },
  { id: 'bridge', icon: '🌉', name: '다리·도로 재건', when: '민정', cost: 0.5, eff: [{ k: 'damage', v: 10 }], say: '무너진 다리를 다시 놓아야 물자가 들어옵니다.', dmg: 10 },
  { id: 'police', icon: '👮', name: '현지 경찰 창설', when: '민정', cost: 0.25, eff: [{ k: 'sweep', h: 48 }, { k: 'loy', v: 2, h: 48 }], say: '군인 대신 현지 경찰이 치안을 맡으면 반발이 줄어듭니다.' },
  { id: 'shelter', icon: '⛑️', name: '이재민 임시 주택', when: 'any', cost: 0.3, eff: [{ k: 'damage', v: 5 }, { k: 'loy', v: 3, h: 72 }], say: '집을 잃은 주민들에게 임시 주택을 짓겠습니다.', dmg: 1 },
];
export const occKind = (id: string) => OCC_KINDS.find((k) => k.id === id)!;

export interface OccTeam {
  id: number;
  /** 단장 */
  name: string;
  sex: 'm' | 'f';
  age: number;
  /** 얼굴 번호 */
  face: number;
  /** 맡은 도시(없으면 쉼) */
  city: string | null;
  /** 지금 일(또는 쉼)을 시작한 시각 */
  since: number;
  /** 정상화해 넘긴 도시 수 */
  done: number;
}
export interface OccProp {
  id: number;
  city: string;
  kind: string;
  team: number;
  atMs: number;
  untilMs: number;
}
export interface OccMark {
  city: string;
  v: number;
  untilMs: number;
  why: string;
}
export interface OccAdminState {
  seed: number;
  seq: number;
  /** 청장 */
  chief: { name: string; sex: 'm' | 'f'; age: number; face: number };
  teams: OccTeam[];
  list: OccProp[];
  /** 도시 → 다음 건의 시각 */
  next: Record<string, number>;
  /** 도시 → 처음 맡은(점령 뒤 본) 시각 */
  first: Record<string, number>;
  marks: OccMark[];
  /** '도시|방안' → 다시 건의할 수 있는 시각(승인한 방안은 효과가 끝날 때까지 다시 안 올림) */
  cool: Record<string, number>;
  yes: number;
  no: number;
  handed: number;
  log: string[];
}

function person(s: GameState, rng: Rng, taken: Set<string>, lo: number, hi: number) {
  const sex: 'm' | 'f' = rng.next() < 0.25 ? 'f' : 'm';
  const name = makeName(s.player.countryId, sex, rng, taken);
  taken.add(name);
  return { name, sex, age: lo + Math.floor(rng.next() * (hi - lo + 1)), face: 8000 + Math.floor(rng.next() * 90000) };
}

function newTeam(s: GameState, rng: Rng, taken: Set<string>, id: number): OccTeam {
  return { id, ...person(s, rng, taken, 50, 62), city: null, since: s.worldMs, done: 0 };
}

export function occAdminOf(s: GameState): OccAdminState {
  if (s.occAdmin) return s.occAdmin;
  const rng = new Rng((7717 ^ (s.world.seed ?? 1)) >>> 0);
  const taken = new Set<string>();
  const chief = person(s, rng, taken, 56, 64);
  const teams = Array.from({ length: TEAMS_START }, (_, i) => newTeam(s, rng, taken, i + 1));
  return { seed: rng.seed, seq: 1, chief, teams, list: [], next: {}, first: {}, marks: [], cool: {}, yes: 0, no: 0, handed: 0, log: [] };
}
const withAdmin = (s: GameState, a: OccAdminState): GameState => ({ ...s, occAdmin: a });
const logOf = (a: OccAdminState, t: string) => [t, ...a.log].slice(0, 30);
export const teamName = (t: OccTeam) => `제${t.id}관리단`;
const nm = (id: string) => cityById(id).name;

/** 관리청이 맡을 도시: 아직 편입 안 된 내 점령 도시(꼭두각시 정부는 제 정부가 있어서 빼고) */
export function adminCities(s: GameState): string[] {
  return occupiedCities(s).filter((id) => annexEntry(s, id)?.mode !== 'puppet');
}
export const teamOf = (s: GameState, cityId: string) => occAdminOf(s).teams.find((t) => t.city === cityById(cityId).hub) ?? null;
export const propsOfCity = (s: GameState, cityId: string) => occAdminOf(s).list.filter((p) => p.city === cityById(cityId).hub);
/** 점령 직후(건의가 많이 오는 때)인가 */
export function isEarly(s: GameState, cityId: string): boolean {
  const f = occAdminOf(s).first[cityById(cityId).hub];
  return f != null && s.worldMs < f + EARLY_HOURS * H;
}
export const capOf = (s: GameState, cityId: string) => (isEarly(s, cityId) ? CAP_EARLY : CAP_NORMAL);

export function propCost(s: GameState, p: { city: string; kind: string }): number {
  return Math.round(budgetPerDay(s, s.player.countryId) * occKind(p.kind).cost * cityById(p.city).value);
}

/** 효과 설명 한 줄 */
export function effText(k: OccKindDef): string {
  return k.eff
    .map((e) => {
      switch (e.k) {
        case 'mil': return `군정 −${e.h}시간`;
        case 'damage': return `전쟁 피해 −${e.v}%`;
        case 'loy': return `민심 +${e.v}(${e.h}시간)`;
        case 'vote': return `투표 찬성 +${e.v}%`;
        case 'sweep': return `반란 −25%(${e.h}시간)`;
        case 'relief': return `배급 민심 +${e.v}(${e.h}시간)`;
      }
    })
    .join(' · ');
}

/** 이 도시에 지금 건의할 수 있는 방안 */
function kindsFor(s: GameState, city: string, pending: Set<string>): OccKindDef[] {
  const a = annexEntry(s, city);
  if (!a) return [];
  const dmg = a.damage ?? 0;
  return OCC_KINDS.filter((k) => {
    if (pending.has(k.id)) return false;
    if ((occAdminOf(s).cool?.[`${city}|${k.id}`] ?? 0) > s.worldMs) return false;
    if (k.when !== 'any' && k.when !== a.stage) return false;
    if (k.dmg && dmg < k.dmg) return false;
    if (k.noTreaty && a.treaty) return false;
    if (k.eff.some((e) => e.k === 'vote') && (a.propaganda ?? 0) >= VOTE_MAX) return false;
    return true;
  });
}

function propose(s: GameState, a: OccAdminState, city: string, team: OccTeam, rng: Rng): OccAdminState {
  const mine = a.list.filter((p) => p.city === city);
  const pick = kindsFor(s, city, new Set(mine.map((p) => p.kind)));
  if (!pick.length) return a;
  const k = pick[Math.floor(rng.next() * pick.length)];
  const p: OccProp = { id: a.seq, city, kind: k.id, team: team.id, atMs: s.worldMs, untilMs: s.worldMs + PROP_TTL };
  return { ...a, seq: a.seq + 1, list: [...a.list, p] };
}

/** 승인할 수 있는지(안 되면 이유) */
export function canApprove(s: GameState, id: number): string | null {
  const p = occAdminOf(s).list.find((x) => x.id === id);
  if (!p) return '없는 건의예요';
  if (!annexEntry(s, p.city)) return '이제 관리하지 않는 도시예요';
  const k = occKind(p.kind);
  if (k.when !== 'any' && annexEntry(s, p.city)!.stage !== k.when) return `${k.when} 때만 할 수 있어요`;
  const cost = propCost(s, p);
  if ((s.nations[s.player.countryId]?.treasury ?? 0) < cost) return `나라 예산 ${cost.toLocaleString('ko-KR')} 필요`;
  return null;
}

function applyEffects(s: GameState, city: string, k: OccKindDef): GameState {
  let out = s;
  const now = s.worldMs;
  let marks = occAdminOf(out).marks;
  for (const e of k.eff) {
    const a = annexEntry(out, city);
    if (!a) break;
    if (e.k === 'mil' && a.stage === '군정') out = patchEntry(out, city, { since: a.since - e.h * H });
    if (e.k === 'damage') out = patchEntry(out, city, { damage: Math.max(0, (a.damage ?? 0) - e.v) });
    if (e.k === 'vote') out = patchEntry(out, city, { propaganda: Math.min(VOTE_MAX, (a.propaganda ?? 0) + e.v) });
    if (e.k === 'sweep') out = patchEntry(out, city, { sweepUntil: Math.max(a.sweepUntil ?? 0, now + e.h * H), sweepStars: Math.max(1, a.sweepStars ?? 0) });
    if (e.k === 'relief') {
      const live = (a.reliefUntil ?? 0) > now ? (a.relief ?? 0) : 0;
      out = patchEntry(out, city, { relief: Math.max(live, e.v), reliefUntil: Math.max(a.reliefUntil ?? 0, now + e.h * H) });
    }
    if (e.k === 'loy') marks = [...marks, { city, v: e.v, untilMs: now + e.h * H, why: `${k.icon} ${k.name}` }];
  }
  return withAdmin(out, { ...occAdminOf(out), marks });
}

export function approveProp(s: GameState, id: number): { state: GameState; text: string } {
  const why = canApprove(s, id);
  if (why) return { state: s, text: why };
  const a = occAdminOf(s);
  const p = a.list.find((x) => x.id === id)!;
  const k = occKind(p.kind);
  const paid = payTreasury(s, propCost(s, p));
  if (!paid) return { state: s, text: '나라 예산이 모자라요' };
  const coolH = Math.max(24, ...k.eff.map((e) => ('h' in e && e.k !== 'mil' ? e.h : 0)));
  const cool = { ...(a.cool ?? {}), [`${p.city}|${p.kind}`]: s.worldMs + coolH * H };
  let out = withAdmin(paid, { ...a, cool, list: a.list.filter((x) => x.id !== id), yes: a.yes + 1 });
  out = applyEffects(out, p.city, k);
  const text = `✅ ${nm(p.city)} ${k.icon} ${k.name} 승인 · ${effText(k)}`;
  const a2 = occAdminOf(out);
  return { state: withAdmin(out, { ...a2, log: logOf(a2, text) }), text };
}

export function rejectProp(s: GameState, id: number): GameState {
  const a = occAdminOf(s);
  const p = a.list.find((x) => x.id === id);
  if (!p) return s;
  return withAdmin(s, { ...a, list: a.list.filter((x) => x.id !== id), no: a.no + 1, log: logOf(a, `⏸️ ${nm(p.city)} ${occKind(p.kind).name} 미룸`) });
}

/** 승인할 수 있는 건 모두 승인(비싼 것보다 싼 것부터) */
export function approveAll(s: GameState, city?: string): { state: GameState; n: number } {
  let out = s;
  let n = 0;
  const ids = occAdminOf(s)
    .list.filter((p) => !city || p.city === cityById(city).hub)
    .sort((x, y) => propCost(s, x) - propCost(s, y))
    .map((p) => p.id);
  for (const id of ids) {
    if (canApprove(out, id)) continue;
    out = approveProp(out, id).state;
    n++;
  }
  return { state: out, n };
}

export function teamCost(s: GameState): number {
  return Math.round(budgetPerDay(s, s.player.countryId) * TEAM_COST_DAYS * occAdminOf(s).teams.length);
}
export function canAddTeam(s: GameState): string | null {
  if (occAdminOf(s).teams.length >= TEAMS_MAX) return `관리단은 ${TEAMS_MAX}개까지예요`;
  const c = teamCost(s);
  if ((s.nations[s.player.countryId]?.treasury ?? 0) < c) return `나라 예산 ${c.toLocaleString('ko-KR')} 필요`;
  return null;
}
export function addTeam(s: GameState): GameState {
  if (canAddTeam(s)) return s;
  const paid = payTreasury(s, teamCost(s));
  if (!paid) return s;
  const a = occAdminOf(paid);
  const rng = new Rng(a.seed);
  const taken = new Set([a.chief.name, ...a.teams.map((t) => t.name)]);
  const t = newTeam(paid, rng, taken, a.teams.length + 1);
  return withAdmin(paid, { ...a, seed: rng.seed, teams: [...a.teams, t], log: logOf(a, `➕ ${teamName(t)}을 새로 꾸렸어요(단장 ${t.name})`) });
}

/** 15분마다: 넘기기·옮기기·건의 */
export function occAdminTick(s: GameState): GameState {
  const want = adminCities(s);
  if (!want.length && !s.occAdmin) return s;
  const me = s.player.countryId;
  const now = s.worldMs;
  let out = s;
  let a = occAdminOf(out);
  const rng = new Rng(a.seed ^ (Math.floor(now / 1000) >>> 0));
  const wantSet = new Set(want);
  const first = { ...a.first };
  for (const id of want) if (first[id] == null) first[id] = now;
  const reports: string[] = [];
  // 1) 일이 끝난 관리단: 정상화(편입)면 시·도지사에게, 꼭두각시면 그 정부에, 잃으면 철수
  let teams = a.teams.map((t) => {
    if (!t.city || wantSet.has(t.city)) return t;
    const c = t.city;
    const owned = out.world.owner[c] === me;
    if (owned && homeOf(out.world, c) === me) {
      if (out.polity) out = ensureGovernors(out);
      const g = out.polity?.governors[c];
      reports.push(`${nm(c)} 정상화를 마쳐 ${g ? `시·도지사 ${g.name}에게` : '시·도지사에게'} 넘겼습니다`);
      return { ...t, city: null, since: now, done: t.done + 1 };
    }
    reports.push(owned ? `${nm(c)}은(는) 꼭두각시 정부에 넘기고 나왔습니다` : `${nm(c)}을(를) 잃어 철수했습니다`);
    return { ...t, city: null, since: now };
  });
  const handed = a.handed + teams.filter((t, i) => t.done > a.teams[i].done).length;
  // 2) 쉬는 관리단은 아직 맡은 단이 없는 점령 도시로(먼저 점령한 곳부터)
  const free = want.filter((id) => !teams.some((t) => t.city === id)).sort((x, y) => (first[x] ?? 0) - (first[y] ?? 0));
  const fresh: number[] = [];
  teams = teams.map((t) => {
    if (t.city || !free.length) return t;
    const c = free.shift()!;
    fresh.push(t.id);
    reports.push(`${teamName(t)}(단장 ${t.name})이 ${nm(c)} 관리를 맡았습니다`);
    return { ...t, city: c, since: now };
  });
  // 3) 관리하지 않는 도시의 건의·기록 정리
  const list = a.list.filter((p) => wantSet.has(p.city) && p.untilMs > now && teams.some((t) => t.city === p.city));
  const marks = a.marks.filter((m) => m.untilMs > now && out.world.owner[m.city] === me);
  for (const k of Object.keys(first)) if (!wantSet.has(k)) delete first[k];
  const next = Object.fromEntries(Object.entries(a.next).filter(([k]) => wantSet.has(k)));
  const cool = Object.fromEntries(Object.entries(a.cool ?? {}).filter(([, v]) => v > now));
  a = { ...a, teams, list, marks, first, next, handed, cool };
  out = withAdmin(out, a);
  // 4) 건의: 처음 맡으면 3건 한꺼번에, 그 뒤로는 점령 직후 1시간·평소 3시간마다 1건(쌓이는 수 6/4)
  for (const t of a.teams) {
    if (!t.city) continue;
    const c = t.city;
    const cap = capOf(out, c);
    if (fresh.includes(t.id)) {
      for (let i = 0; i < FIRST_BATCH; i++) a = propose(out, a, c, t, rng);
      a = { ...a, next: { ...a.next, [c]: now + (isEarly(out, c) ? GAP_EARLY : GAP_NORMAL) } };
      continue;
    }
    if (now < (a.next[c] ?? 0)) continue;
    if (a.list.filter((p) => p.city === c).length < cap) a = propose(out, a, c, t, rng);
    a = { ...a, next: { ...a.next, [c]: now + (isEarly(out, c) ? GAP_EARLY : GAP_NORMAL) } };
  }
  a = { ...a, seed: rng.seed };
  for (const r of reports) a = { ...a, log: logOf(a, `🏢 ${r}`) };
  out = withAdmin(out, a);
  if (reports.length) out = pushReport(out, { icon: '🏢', text: `대장님, 점령지 관리청 보고입니다. ${reports.join('. ')}.` });
  return out;
}

// 승인한 방안의 민심 효과(내정 도시는 따라가는 점령 도시 것을 받음)
registerCityLoyaltyRows((s, cityId) => {
  if (!s.occAdmin) return [];
  const hub = cityById(cityId).hub;
  return s.occAdmin.marks.filter((m) => m.city === hub && m.untilMs > s.worldMs).map((m) => [m.why, m.v] as [string, number]);
});
