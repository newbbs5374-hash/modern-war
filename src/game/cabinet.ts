// 인물 약 100명 · 부처 15곳 장관/차관 · 인재 명단 · 청문회 · 파벌 · 궁합(11-23 대장 결정).
// 이 파일은 상태·인물 만들기·효과 계산만 해요(다른 계산 파일을 부르지 않아 순환이 없음). 시간 흐름·부처 업무 결과는 cabinetOps.ts
import { COUNTRIES } from '../data/world';
import { LEADERS } from '../data/leaders';
import { STAT_IDS } from '../data/officers';
import { ORIGIN_SHAPE2, STAT2_IDS, type AnyStat } from '../data/stats2';
import { NEEDS, type Need } from '../data/needs';
import { LOOK, ethOfName, makeNameEth, pickUsEth } from '../data/names';
import { US_ETH, deckSize, type UsEth } from '../data/faces';
import { assignFaces } from '../data/faces';
import {
  FACTION_BONUS_AT,
  GRADES,
  HIDDEN_IDS,
  MINISTRIES,
  PERSON_ORIGINS,
  TRAIT_IDS,
  ministryById,
  ministerSlots,
  type Faction,
  type Grade,
  type Group,
  type Hidden,
  type MinistryId,
  type PersonOrigin,
  type SpecId,
  type Trait,
} from '../data/cabinet';
import { EFF_CAP, GUARD_COUNTER_AT, HEAD_BOOST, OFFICES, POSTS, postById, type PostEff, type PostId } from '../data/staff';
import { Rng } from './rng';
import { govFacEff } from './govFac';
import type { GameState } from './state';

const H = 3600e3;
export const POOL_MAX = 20;
/** 인재 명단: 실제 1시간마다 새 후보 2명 */
export const POOL_EVERY_MS = H;
export const POOL_ADD = 2;
export const HEARING_MS = 0.5 * H;
export const VICE_POWER = 0.4;
export const REFRESH_RUBY = 10;
export const VET_INTEL = 30;
/** 시험판: 장관 청문회 생략(11-24 대장 지시 "테스트 한정 청문회는 생략"). 시험에서는 skip=false로 */
export const HEARING = { skip: true };

export type Seat = { kind: 'min' | 'vice'; id: MinistryId };
export interface Person {
  id: number;
  name: string;
  sex: 'm' | 'f';
  age: number;
  country: string;
  origin: PersonOrigin;
  grade: Grade;
  /** 스탯 18개(11-24: 예전 9 + 국정·인품 9). 옛 저장은 fillStats2로 채움 */
  stats: Record<AnyStat, number>;
  spec: SpecId;
  trait: Trait;
  hidden: Hidden | null;
  /** 숨은 특성을 알아냈는지 */
  known: boolean;
  faction: Faction;
  loyalty: number;
  group: Group;
  /** 직함(정계·재계·언론·시민·외국 인물) */
  title?: string;
  seat: Seat | null;
  /** 대통령실 참모·국무총리·기관장 자리(11-24, data/staff.ts). 부처 자리(seat)와 같이 앉을 수 없음 */
  post?: PostId;
  pals: number[];
  foes: number[];
  pay: number;
  /** 들어온 시각(인재 명단에 올라온 시각) */
  sinceMs: number;
  /** 자리에서 쌓은 시간(스탯 성장) */
  workMs?: number;
  /** 지도자 출신의 옛 동료 */
  buddy?: boolean;
  /** 얼굴 갈래(미국만: we·bl·hi·as) · 얼굴 번호(data/faces.ts, 11-24) */
  eth?: string;
  face?: number;
}
export interface CabBuff {
  key: 'build' | 'res' | 'secScore' | 'diploScore' | 'econScore' | 'socScore' | 'approval' | 'counter';
  v: number;
  untilMs: number;
  why: string;
}
export interface CabinetState {
  seed: number;
  nextId: number;
  people: Person[];
  poolMs: number;
  hearing: { pid: number; min: MinistryId; endMs: number } | null;
  tasks: Partial<Record<MinistryId, { task: string; endMs: number }>>;
  buffs: CabBuff[];
  log: string[];
  /** 분야별 마지막으로 조언 따른 때(11-24) */
  advice?: Partial<Record<string, number>>;
  /** 부처·청 소속 시설 단계(11-24) */
  fac?: Record<string, number>;
}

const clamp = (v: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));

/* ───────── 인물 만들기 ───────── */

export interface GenOpt {
  country: string;
  group: Group;
  origin?: PersonOrigin;
  grade?: Grade;
  age?: [number, number];
  title?: string;
  sex?: 'm' | 'f';
}

/** 미국 사람 갈래(11-24): 얼굴이 많이 남은 갈래일수록 잘 뽑힘 → 한 갈래만 얼굴이 모자라지 않게 */
function usEthFor(c: CabinetState, sex: 'm' | 'f', rng: Rng, group?: Group): UsEth {
  // 관료·공공기관은 자기 명단 안에서만 얼굴이 겹치지 않으면 되니 그 명단만 셈(11-24)
  const own = group === '관료' || group === '공공';
  const free = US_ETH.map((e) => Math.max(0, deckSize(`us-${e}`, sex) - c.people.filter((p) => p.country === 'us' && p.sex === sex && (p.eth ?? 'we') === e && (!own || p.group === group)).length));
  const sum = free.reduce((a, b) => a + b, 0);
  if (sum <= 0) return pickUsEth(rng);
  let r = rng.next() * sum;
  for (let i = 0; i < US_ETH.length; i++) if ((r -= free[i]) < 0) return US_ETH[i];
  return 'we';
}

export function genPerson(c: CabinetState, rng: Rng, o: GenOpt, worldMs: number, taken: Set<string>): Person {
  const origins = Object.keys(PERSON_ORIGINS) as PersonOrigin[];
  const origin = o.origin ?? rng.pick(origins);
  const info = PERSON_ORIGINS[origin];
  const grade: Grade = o.grade ?? (rng.chance(0.25) ? '우수' : '일반');
  const [lo, hi] = GRADES[grade].total;
  const total = lo + rng.next() * (hi - lo);
  const base = total / 9;
  const scale = total / 72;
  const [a0, a1] = o.age ?? [35, 65];
  const age = Math.round(a0 + rng.next() * (a1 - a0));
  const stats = {} as Record<AnyStat, number>;
  for (const id of STAT_IDS) {
    let v = base + (info.shape[id] ?? 0) * scale + (rng.next() * 6 - 3);
    if (age >= 60) v += id === '체력' ? -2 : id === '정치' || id === '통솔' ? 1 : 0;
    stats[id] = Math.max(3, Math.round(v));
  }
  const sex: 'm' | 'f' = o.sex ?? (rng.chance(origin === 'general' || origin === 'soldier' || origin === 'admiral' || origin === 'commando' ? 0.15 : 0.4) ? 'f' : 'm');
  // 10%는 출신과 다른 특화(숨은 재능)
  const spec = rng.chance(0.1) ? rng.pick(['경제통', '외교통', '행정통', '복지통', '과학자', '홍보통', '육군통', '해군통', '공군통', '정보통', '군수통'] as SpecId[]) : rng.pick(info.spec);
  const hidden: Hidden | null = rng.chance(0.3) ? rng.pick(HIDDEN_IDS) : null;
  const nm = makeNameEth(o.country, sex, rng, taken, o.country === 'us' ? usEthFor(c, sex, rng, o.group) : undefined);
  fillStats2(stats, origin, total, age, c.seed * 7919 + c.nextId);
  return {
    id: c.nextId++,
    name: nm.name,
    eth: nm.eth,
    sex,
    age,
    country: o.country,
    origin,
    grade,
    stats,
    spec,
    trait: rng.pick(TRAIT_IDS),
    hidden,
    known: false,
    faction: rng.chance(0.8) ? info.faction : rng.pick(['군부파', '경제파', '개혁파', '온건파'] as Faction[]),
    loyalty: Math.round(45 + rng.next() * 25),
    group: o.group,
    title: o.title,
    seat: null,
    pals: [],
    foes: [],
    pay: GRADES[grade].pay,
    sinceMs: worldMs,
  };
}

/** 새 스탯 9개(지휘·행정·경제·외교·법률·과학·언변·청렴·매력)를 출신 모양대로 채움. 따로 된 주사위라 예전 인물 뽑기 순서는 그대로 */
export function fillStats2(stats: Partial<Record<AnyStat, number>>, origin: PersonOrigin, total: number, age: number, seed: number): void {
  const r = new Rng(seed >>> 0);
  const base = total / 9;
  const scale = total / 72;
  const shape = ORIGIN_SHAPE2[origin] ?? {};
  for (const id of STAT2_IDS) {
    const roll = r.next() * 6 - 3;
    if (typeof stats[id] === 'number') continue;
    let v = base + (shape[id] ?? 0) * scale + roll;
    if (age >= 60 && (id === '지휘' || id === '외교')) v += 1;
    stats[id] = Math.max(3, Math.round(v));
  }
}
/** 옛 저장 인물: 새 스탯이 없으면 채움 */
/** 옛 저장: 관료 56명이 없으면 더함 */
export function migrateBureau(c: CabinetState, me: string, worldMs: number): void {
  if (c.people.some((p) => p.group === '관료' || p.title === '부처 1급 실장')) return;
  const rng = new Rng((c.seed ^ 0xb00) >>> 0 || 1);
  const taken = new Set(c.people.map((p) => p.name));
  for (const t of BUREAU_TITLES)
    for (let i = 0; i < t.n; i++) {
      const p = genPerson(c, rng, { country: me, group: t.group, origin: rng.pick(t.origin), age: t.age, title: t.title }, worldMs, taken);
      p.known = true;
      c.people.push(p);
    }
  giveFaces(c);
}
export function migrateStats2(c: CabinetState): void {
  for (const p of c.people) {
    if (typeof p.stats.지휘 === 'number') continue;
    const total = STAT_IDS.reduce((a, id) => a + (p.stats[id] ?? 0), 0);
    fillStats2(p.stats, p.origin, total, p.age, c.seed * 7919 + p.id);
  }
}

/** 인물끼리 궁합(같은 학교·전우 / 앙숙) 몇 쌍 */
function linkPeople(list: Person[], rng: Rng, pairs: number) {
  if (list.length < 2) return;
  for (let i = 0; i < pairs; i++) {
    const a = rng.pick(list);
    const b = rng.pick(list);
    if (a.id === b.id || a.pals.includes(b.id) || a.foes.includes(b.id)) continue;
    if (rng.chance(0.55)) {
      a.pals.push(b.id);
      b.pals.push(a.id);
    } else {
      a.foes.push(b.id);
      b.foes.push(a.id);
    }
  }
}

/** 관료 34명 + 공공기관 22명(11-24 대장 요청 5번: 부처 42곳에 맞춰 인물 약 150명). 영입할 수 있음 */
const BUREAU_TITLES: Array<{ group: Group; title: string; origin: PersonOrigin[]; n: number; age: [number, number] }> = [
  { group: '관료', title: '부처 1급 실장', origin: ['mayor', 'econ', 'lawyer', 'exec'], n: 12, age: [50, 60] },
  { group: '관료', title: '청 차장', origin: ['soldier', 'prosecutor', 'scientist', 'mayor'], n: 12, age: [50, 60] },
  { group: '관료', title: '전직 차관', origin: ['mayor', 'diplomat', 'econ', 'lawyer'], n: 10, age: [55, 68] },
  { group: '공공', title: '공기업 사장', origin: ['exec', 'econ', 'chaebol'], n: 8, age: [52, 66] },
  { group: '공공', title: '국책 연구원장', origin: ['scientist', 'professor', 'doctor'], n: 8, age: [50, 66] },
  { group: '공공', title: '시장·군수', origin: ['mayor', 'commoner', 'partisan'], n: 6, age: [48, 64] },
];
const NPC_TITLES: Array<{ group: Group; title: string; origin: PersonOrigin[]; n: number; age: [number, number] }> = [
  { group: '정계', title: '국회의장', origin: ['partisan', 'lawyer'], n: 1, age: [58, 70] },
  { group: '정계', title: '여당 대표', origin: ['partisan'], n: 1, age: [52, 66] },
  { group: '정계', title: '원내대표', origin: ['partisan', 'prosecutor'], n: 1, age: [48, 62] },
  { group: '정계', title: '정적 측근', origin: ['partisan', 'soldier', 'exec'], n: 6, age: [45, 64] },
  { group: '정계', title: '야당 의원', origin: ['partisan', 'lawyer', 'journalist'], n: 4, age: [44, 66] },
  { group: '정계', title: '도지사', origin: ['mayor', 'partisan'], n: 4, age: [50, 66] },
  { group: '재계', title: '그룹 회장', origin: ['chaebol', 'exec'], n: 4, age: [55, 72] },
  { group: '언론', title: '언론사 사장', origin: ['journalist', 'broadcaster'], n: 3, age: [50, 68] },
  { group: '시민', title: '시민단체 대표', origin: ['activist', 'lawyer', 'religious'], n: 3, age: [42, 66] },
  { group: '시민', title: '대학 총장', origin: ['professor', 'scientist', 'doctor'], n: 2, age: [56, 70] },
  { group: '시민', title: '노조 위원장', origin: ['activist', 'commoner'], n: 2, age: [45, 62] },
  { group: '군', title: '야전 사령관', origin: ['general', 'soldier', 'admiral', 'commando'], n: 6, age: [50, 60] },
  ...BUREAU_TITLES,
];

/** 판을 시작할 때(또는 옛 저장을 처음 열 때) 인물 약 100명 중 나라 안·밖 인물을 만듦 */
export function newCabinet(s: Pick<GameState, 'world' | 'worldMs' | 'player'>): CabinetState {
  const seed = (((s.world.seed ?? 1) * 31 + 7) >>> 0) || 1;
  const c: CabinetState = { seed, nextId: 1, people: [], poolMs: s.worldMs, hearing: null, tasks: {}, buffs: [], log: [] };
  const rng = new Rng(seed);
  const me = s.player.countryId;
  const taken = new Set<string>();
  for (const t of NPC_TITLES)
    for (let i = 0; i < t.n; i++) {
      const p = genPerson(c, rng, { country: me, group: t.group, origin: rng.pick(t.origin), age: t.age, title: t.title }, s.worldMs, taken);
      p.known = true;
      c.people.push(p);
    }
  // 다른 나라 외교장관·국방장관 24명
  for (const cc of COUNTRIES) {
    if (cc.id === me) continue;
    const p = genPerson(c, rng, { country: cc.id, group: '외국', origin: rng.pick(['diplomat', 'partisan', 'professor'] as PersonOrigin[]), age: [50, 66], title: `${cc.name} 외교장관` }, s.worldMs, taken);
    p.known = true;
    c.people.push(p);
    const g = genPerson(c, rng, { country: cc.id, group: '외국', origin: rng.pick(['general', 'admiral', 'soldier'] as PersonOrigin[]), age: [52, 64], title: `${cc.name} 국방장관` }, s.worldMs, taken);
    g.known = true;
    c.people.push(g);
  }
  // 인재 명단 처음 16명
  for (let i = 0; i < 16; i++) c.people.push(poolPerson(c, rng, me, s.worldMs, taken));
  linkPeople(c.people.filter((p) => p.group === '인재' || p.group === '군'), rng, 10);
  c.seed = rng.seed;
  giveFaces(c);
  return c;
}

/** 얼굴이 몇 번째에 놓이는지: 자리에 앉은 사람 > 내 나라 정계·군 > 인재 > 외국 */
const faceRank = (p: Person) => (p.seat || p.post ? 100 : 0) + (p.buddy ? 50 : 0) + (p.group === '외국' ? 0 : p.group === '인재' ? 10 : 20);
/** 한 화면에 같이 나오는 무리: 인재 명단과 내 내각은 한 화면, 나머지는 무리마다 */
const faceScreen = (p: Person) => (p.group === '인재' || p.group === '내각' ? 'cab' : p.group);
/** 얼굴 나눠 주기(빈 사람만, 겹치면 순위 낮은 쪽이 바꿈). c를 고침 */
export function giveFaces(c: CabinetState) {
  for (const p of c.people) if (p.country === 'us' && !p.eth) p.eth = ethOfName('us', p.name);
  const m = assignFaces(c.people.map((p) => ({ id: p.id, sex: p.sex, age: p.age, country: p.country, eth: p.eth, face: p.face, rank: faceRank(p), screen: faceScreen(p) })));
  for (const p of c.people) p.face = m.get(p.id);
}

/** 인재 명단 후보 한 명(나라 사람 90%, 다른 나라에서 온 사람 10%) */
export function poolPerson(c: CabinetState, rng: Rng, me: string, worldMs: number, taken: Set<string>): Person {
  const country = rng.chance(0.1) ? rng.pick(COUNTRIES.filter((x) => x.id !== me)).id : me;
  // 5%는 전설 등급(드물게 나타나는 큰 인물)
  const grade = rng.chance(0.05) ? '전설' : undefined;
  return genPerson(c, rng, { country, group: '인재', age: [38, 66], grade }, worldMs, taken);
}

export function cabinetOf(s: GameState): CabinetState {
  return s.cabinet ?? newCabinet(s);
}
export const personById = (s: GameState, id: number) => cabinetOf(s).people.find((p) => p.id === id) ?? null;
export const takenNames = (c: CabinetState) => new Set(c.people.map((p) => p.name));

/* ───────── 장관 힘 ───────── */

export const avgStats = (p: Person, ids: AnyStat[]) => ids.reduce((a, id) => a + (p.stats[id] ?? 0), 0) / ids.length;

/** 자리에 맞는 정도(성향·출신·특화 덤 포함, 충성·궁합 빼고). 보통 사람 ≈ 1 */
export function needPower(p: Person, need: Need, spec: readonly string[]): number {
  let v = (avgStats(p, need.main) * 0.8 + (p.stats[need.sub] ?? 0) * 0.2) / 12;
  if (spec.includes(p.spec)) v *= 1.3;
  if (need.traits.includes(p.trait)) v *= 1.1;
  if (need.origins.includes(p.origin)) v *= 1.05;
  return v;
}
/** 적합도 0~100%(안내용): 능력 1.6이면 100% */
export const fitPct = (p: Person, need: Need, spec: readonly string[]) => Math.max(0, Math.min(100, Math.round((needPower(p, need, spec) / 1.6) * 100)));
export const needOf = (id: string): Need => NEEDS[id];

/** 사람 한 명이 그 부처에서 내는 힘(일반 장관 ≈ 1) */
export function personPower(p: Person, min: MinistryId, c?: CabinetState): number {
  const m = ministryById(min);
  let v = needPower(p, NEEDS[min], m.spec);
  if (p.trait === '야심') v *= 1.15;
  if (p.hidden === '숨은 천재') v *= 1.25;
  v *= p.loyalty >= 80 ? 1.1 : p.loyalty < 30 ? 0.5 : 1;
  if (c) {
    const seated = c.people.filter((x) => (x.seat || x.post) && x.id !== p.id);
    if (p.pals.some((id) => seated.some((x) => x.id === id))) v *= 1.1;
  }
  return Math.max(0, v);
}
/** 자리에 앉은 사람(부처·대통령실·기관장 모두) */
export const seated = (c: CabinetState) => c.people.filter((p) => p.seat || p.post);
export const ministerOf = (c: CabinetState, id: MinistryId) => c.people.find((p) => p.seat?.kind === 'min' && p.seat.id === id) ?? null;
export const viceOf = (c: CabinetState, id: MinistryId) => c.people.find((p) => p.seat?.kind === 'vice' && p.seat.id === id) ?? null;
/** 부처 힘 = 장관 + 차관 × 0.4 */
export function ministryPower(s: GameState, id: MinistryId): number {
  const c = s.cabinet;
  if (!c) return 0;
  const m = ministerOf(c, id);
  const v = viceOf(c, id);
  return ((m ? personPower(m, id, c) : 0) + (v ? personPower(v, id, c) * VICE_POWER : 0)) * (1 + postEff(s, 'minPower'));
}

/* ───────── 대통령실 참모 · 국무총리 · 기관장(11-24) ───────── */

export const postHolder = (c: CabinetState, id: PostId) => c.people.find((p) => p.post === id) ?? null;
/** 사람 한 명이 그 자리에서 내는 힘(실장 덤 빼고, 보통 ≈ 1) */
export function personPostPower(p: Person, id: PostId): number {
  const m = postById(id);
  let v = needPower(p, NEEDS[id], m.spec);
  if (p.trait === '야심') v *= 1.15;
  if (p.hidden === '숨은 천재') v *= 1.25;
  v *= p.loyalty >= 80 ? 1.1 : p.loyalty < 30 ? 0.5 : 1;
  return Math.max(0, v);
}
/** 자리 힘 = 사람 힘 × (1 + 실장 힘 × 0.2) */
export function postPower(s: GameState, id: PostId): number {
  const c = s.cabinet;
  if (!c) return 0;
  const p = postHolder(c, id);
  if (!p) return 0;
  const office = OFFICES.find((o) => o.id === postById(id).office)!;
  let v = personPostPower(p, id);
  if (office.head && office.head !== id) {
    const h = postHolder(c, office.head);
    if (h) v *= 1 + personPostPower(h, office.head) * HEAD_BOOST;
  }
  // 청장: 위 부 장관이 유능하면 힘 + (장관 힘 1당 +10%, 최대 +15%)
  const par = postById(id).parent;
  if (par) {
    const m = ministerOf(c, par);
    if (m) v *= 1 + Math.min(0.15, personPower(m, par, c) * 0.1);
  }
  return v;
}
/** 대통령실·기관장 효과 합(자리 여럿이 같은 효과면 더함, 최대치 있음) */
export function postEff(s: GameState, key: PostEff): number {
  const c = s.cabinet;
  if (!c) return 0;
  let v = 0;
  for (const p of c.people) {
    if (!p.post) continue;
    const k = postById(p.post).eff[key];
    if (k) v += k * postPower(s, p.post);
  }
  v += govFacEff(s, key);
  if (key === 'taskTime') v += ministryPower(s, 'mpm') * 0.04;
  if (key === 'recruit') v += ministryPower(s, 'mpm') * 0.05;
  const cap = EFF_CAP[key];
  return cap !== undefined ? Math.min(cap, v) : v;
}
export const postCount = (c: CabinetState) => c.people.filter((p) => p.post).length;
export const guardOn = (s: GameState) => postPower(s, 'guard') >= GUARD_COUNTER_AT;
export const ministerCount = (c: CabinetState) => c.people.filter((p) => p.seat?.kind === 'min').length;
export const ministerSlotsOf = (s: GameState) => ministerSlots(s.player.rankIndex);

/* ───────── 효과(다른 계산이 읽음) ───────── */

const buffSum = (s: GameState, key: CabBuff['key']) => (s.cabinet?.buffs ?? []).filter((b) => b.key === key && b.untilMs > s.worldMs).reduce((a, b) => a + b.v, 0);

/** 파벌별 자리 수 */
export function factionCounts(c: CabinetState): Record<Faction, number> {
  const out: Record<Faction, number> = { 군부파: 0, 경제파: 0, 개혁파: 0, 온건파: 0 };
  for (const p of seated(c)) out[p.faction]++;
  return out;
}
const factionOn = (s: GameState, f: Faction) => !!s.cabinet && factionCounts(s.cabinet)[f] >= FACTION_BONUS_AT;
/** 한 파벌 쏠림(자리 5개 이상 · 한 파벌 60% 이상) */
export function factionTilt(s: GameState): Faction | null {
  if (!s.cabinet) return null;
  const fc = factionCounts(s.cabinet);
  const total = Object.values(fc).reduce((a, b) => a + b, 0);
  if (total < 5) return null;
  for (const [f, n] of Object.entries(fc)) if (n / total >= 0.6) return f as Faction;
  return null;
}
const seatedTrait = (s: GameState, t: Trait) => (s.cabinet ? seated(s.cabinet) : []).filter((p) => p.trait === t).length;

export const cabBuild = (s: GameState) => 1 + ministryPower(s, 'mnd') * 0.06 + ministryPower(s, 'molit') * 0.03 + postEff(s, 'build') + buffSum(s, 'build') + (factionOn(s, '군부파') ? 0.06 : 0);
export const cabTroop = (s: GameState) => 1 + ministryPower(s, 'mnd') * 0.05 + ministryPower(s, 'mpva') * 0.03 + postEff(s, 'troop');
export const cabSpy = (s: GameState) => ministryPower(s, 'nis') * 0.05;
export const cabMission = (s: GameState) => ministryPower(s, 'nis') * 0.03 + postEff(s, 'mission');
export const cabFavor = (s: GameState) => ministryPower(s, 'mofa') * 6 + ministryPower(s, 'mou') * 3 + ministryPower(s, 'mofs') * 1 + ministryPower(s, 'mcst') * 2 + postEff(s, 'favor') + (factionOn(s, '온건파') ? 5 : 0);
export const cabBudget = (s: GameState) => 1 + ministryPower(s, 'mof') * 0.06 + ministryPower(s, 'mss') * 0.02 + postEff(s, 'budget') + (factionOn(s, '경제파') ? 0.05 : 0);
export const cabTaxSoft = (s: GameState) => Math.min(0.7, ministryPower(s, 'mof') * 0.25 + ministryPower(s, 'moel') * 0.1 + postEff(s, 'taxSoft'));
export const cabRes = (s: GameState) => 1 + ministryPower(s, 'moti') * 0.08 + ministryPower(s, 'molit') * 0.03 + ministryPower(s, 'mofs') * 0.04 + ministryPower(s, 'mcee') * 0.05 + ministryPower(s, 'mafra') * 0.02 + buffSum(s, 'res');
export const cabLoyalty = (s: GameState) => ministryPower(s, 'mois') * 4 + ministryPower(s, 'mohw') * 2 + ministryPower(s, 'mafra') * 2 + postEff(s, 'loyalty') + (factionOn(s, '개혁파') ? 3 : 0);
export const cabGrowth = (s: GameState) => ministryPower(s, 'mohw') * 0.12 + ministryPower(s, 'moe') * 0.05 + ministryPower(s, 'mogef') * 0.08 + ministryPower(s, 'mfds') * 0.04 + postEff(s, 'growth');
export const cabResearch = (s: GameState) => ministryPower(s, 'msit') * 0.15 + ministryPower(s, 'moe') * 0.06 + postEff(s, 'research');
export const cabSpeech = (s: GameState) => ministryPower(s, 'kocis') * 0.2 + postEff(s, 'speech');
/** 지지도 목표 덤 [이유, 값] */
export function cabApprovalRows(s: GameState): Array<[string, number]> {
  const rows: Array<[string, number]> = [];
  const k = ministryPower(s, 'kocis') * 3;
  if (k) rows.push(['📺 문화홍보처', k]);
  const ct = ministryPower(s, 'mcst') * 2;
  if (ct) rows.push(['🎭 문화체육관광부', Math.round(ct * 10) / 10]);
  const pop = seatedTrait(s, '인기인') + (s.cabinet ? seated(s.cabinet) : []).filter((p) => p.hidden === '언론 인기').length * 2;
  if (pop) rows.push(['🌟 인기 있는 각료', pop]);
  const tilt = factionTilt(s);
  if (tilt) rows.push([`⚠️ 파벌 쏠림(${tilt})`, -2]);
  const b = buffSum(s, 'approval');
  if (b) rows.push(['🏛️ 부처 업무', b]);
  const st = postEff(s, 'approval');
  if (st) rows.push(['🏢 대통령실', Math.round(st * 10) / 10]);
  return rows;
}
/** 분야 점수 덤 */
export function cabFieldRows(s: GameState, f: 'defense' | 'diplo' | 'society' | 'economy'): Array<[string, number]> {
  const rows: Array<[string, number]> = [];
  const key = ({ defense: 'secScore', diplo: 'diploScore', society: 'socScore', economy: 'econScore' } as const)[f];
  const b = buffSum(s, key);
  if (b) rows.push(['🏛️ 부처 업무', b]);
  const hawk = seatedTrait(s, '강경파');
  if (hawk && f === 'defense') rows.push(['⚔️ 강경파 각료', 2 * hawk]);
  if (hawk && f === 'diplo') rows.push(['⚔️ 강경파 각료', -2 * hawk]);
  if (f === 'diplo' && ministryPower(s, 'mou')) rows.push(['🕊️ 통일부', Math.round(ministryPower(s, 'mou') * 2 * 10) / 10]);
  const NEW_FIELD: Array<[typeof f, MinistryId, string, number]> = [
    ['defense', 'mpva', '🎗️ 국가보훈부', 2],
    ['economy', 'mss', '🚀 중소벤처기업부', 2],
    ['society', 'mfds', '💊 식약처', 1.5],
    ['society', 'mogef', '👨‍👩‍👧 성평등가족부', 1.5],
    ['society', 'mcee', '🌍 기후에너지환경부', 1],
  ];
  for (const [ff, id, name, w] of NEW_FIELD) if (f === ff && ministryPower(s, id)) rows.push([name, Math.round(ministryPower(s, id) * w * 10) / 10]);
  if (f === 'economy' && ministryPower(s, 'moel')) rows.push(['👷 고용노동부', Math.round(ministryPower(s, 'moel') * 2 * 10) / 10]);
  const pe = postEff(s, ({ defense: 'sec', diplo: 'diplo', society: 'soc', economy: 'econ' } as const)[f]);
  if (pe) rows.push(['🏢 대통령실·기관장', Math.round(pe * 10) / 10]);
  return rows;
}
/** 신뢰도 목표 덤(파벌 쏠림) */
export const cabTrust = (s: GameState) => (factionTilt(s) ? -5 : 0) + Math.round((ministryPower(s, 'moj') + ministryPower(s, 'moleg')) * 1.5 * 10) / 10 + Math.round(postEff(s, 'trust') * 10) / 10;
export const counterOn = (s: GameState) => buffSum(s, 'counter') > 0 || guardOn(s);

/* ───────── 영입 · 임명 ───────── */

// 11-24: 호칭(혜택 단계)과 상관없이 몸값 그대로(PR #99 뒤 단계가 늘 최고라 2.5배로 비싸졌던 것 바로잡음)
export const recruitCost = (s: GameState, p: Person) => Math.round(p.pay * (1 - postEff(s, 'recruit')));

function withCab(s: GameState, f: (c: CabinetState, ns: GameState) => GameState | void): GameState {
  const c = structuredClone(cabinetOf(s));
  const ns: GameState = { ...s, cabinet: c };
  const out = f(c, ns);
  return out ?? ns;
}
export function cabLog(c: CabinetState, text: string) {
  c.log = [text, ...c.log].slice(0, 30);
}

export function canRecruit(s: GameState, id: number): string | null {
  const p = personById(s, id);
  if (!p || (p.group !== '인재' && p.group !== '관료' && p.group !== '공공')) return '명단에 없는 사람';
  const cost = recruitCost(s, p);
  if ((s.nations[s.player.countryId]?.treasury ?? 0) < cost) return `국방예산 ${cost.toLocaleString('ko-KR')} 필요`;
  return null;
}
export function recruit(s: GameState, id: number): GameState {
  if (canRecruit(s, id)) return s;
  const me = s.player.countryId;
  const cost = recruitCost(s, personById(s, id)!);
  return withCab({ ...s, nations: { ...s.nations, [me]: { ...s.nations[me], treasury: s.nations[me].treasury - cost } } }, (c) => {
    const p = c.people.find((x) => x.id === id)!;
    p.group = '내각';
    p.loyalty = clamp(p.loyalty + 10);
    cabLog(c, `🤝 ${p.name}(${PERSON_ORIGINS[p.origin].name})을(를) 영입했어요.`);
  });
}

export function canAppointMinister(s: GameState, pid: number, min: MinistryId): string | null {
  const c = cabinetOf(s);
  const p = c.people.find((x) => x.id === pid);
  if (!p || p.group !== '내각') return '영입한 사람만 앉힐 수 있어요';
  if (p.post) return `${postById(p.post).name} 자리에서 먼저 내려와야 해요`;
  if (c.hearing) {
    const h = c.people.find((x) => x.id === c.hearing!.pid);
    const left = Math.max(1, Math.ceil((c.hearing.endMs - s.worldMs) / 60000));
    return `${h ? `${h.name} ` : ''}청문회가 끝난 뒤에 할 수 있어요(약 ${left}분 남음, 청문회는 한 번에 한 명)`;
  }
  if (ministerOf(c, min)) return '이미 장관이 있어요(먼저 해임)';
  const cur = p.seat?.kind === 'min' ? 0 : 1;
  if (ministerCount(c) + cur > ministerSlots(s.player.rankIndex)) return `장관 자리가 다 찼어요(${ministerSlots(s.player.rankIndex)}석)`;
  return null;
}
/** 장관 임명: 국회 인사청문회(실제 30분) 뒤 결과. 시험판(HEARING.skip)은 바로 임명 */
export function appointMinister(s: GameState, pid: number, min: MinistryId): GameState {
  if (canAppointMinister(s, pid, min)) return s;
  if (HEARING.skip)
    return withCab(s, (c) => {
      const p = c.people.find((x) => x.id === pid)!;
      p.seat = { kind: 'min', id: min };
      p.loyalty = clamp(p.loyalty + 10);
      cabLog(c, `✅ ${p.name}을(를) ${ministryById(min).name} 장관으로 임명했어요(시험판: 청문회 생략).`);
    });
  return withCab(s, (c, ns) => {
    c.hearing = { pid, min, endMs: ns.worldMs + HEARING_MS };
    cabLog(c, `🏛️ ${c.people.find((x) => x.id === pid)!.name} ${ministryById(min).name} 장관 후보 인사청문회가 열렸어요.`);
  });
}
export function canAppointVice(s: GameState, pid: number, min: MinistryId): string | null {
  const c = cabinetOf(s);
  const p = c.people.find((x) => x.id === pid);
  if (!p || p.group !== '내각') return '영입한 사람만 앉힐 수 있어요';
  if (p.post) return `${postById(p.post).name} 자리에서 먼저 내려와야 해요`;
  if (viceOf(c, min)) return '이미 차관이 있어요';
  if (c.hearing?.pid === pid) return '청문회 중';
  return null;
}
export function appointVice(s: GameState, pid: number, min: MinistryId): GameState {
  if (canAppointVice(s, pid, min)) return s;
  return withCab(s, (c) => {
    const p = c.people.find((x) => x.id === pid)!;
    p.seat = { kind: 'vice', id: min };
    cabLog(c, `📌 ${p.name}을(를) ${ministryById(min).name} 차관으로 앉혔어요.`);
  });
}
export function unseat(s: GameState, pid: number): GameState {
  return withCab(s, (c) => {
    const p = c.people.find((x) => x.id === pid);
    if (!p?.seat) return;
    cabLog(c, `↩️ ${p.name}이(가) ${ministryById(p.seat.id).name} ${p.seat.kind === 'min' ? '장관' : '차관'}에서 물러났어요.`);
    p.seat = null;
    p.loyalty = clamp(p.loyalty - 8);
  });
}
/** 대통령실·기관장 자리에 앉히기: 청문회 없이 바로(대통령실 참모는 실제로도 청문회 없음). 앉아 있던 사람은 내려옴 */
export function canAppointPost(s: GameState, pid: number, id: PostId): string | null {
  const c = cabinetOf(s);
  const p = c.people.find((x) => x.id === pid);
  if (!p || p.group !== '내각') return '영입한 사람만 앉힐 수 있어요';
  if (p.post === id) return '이미 이 자리에 있어요';
  if (p.seat) return '부처 자리에서 먼저 내려와야 해요';
  if (c.hearing?.pid === pid) return '청문회 중';
  return null;
}
export function appointPost(s: GameState, pid: number, id: PostId): GameState {
  if (canAppointPost(s, pid, id)) return s;
  return withCab(s, (c) => {
    const old = c.people.find((x) => x.post === id);
    if (old) {
      old.post = undefined;
      old.loyalty = clamp(old.loyalty - 5);
    }
    const p = c.people.find((x) => x.id === pid)!;
    p.post = id;
    p.loyalty = clamp(p.loyalty + 8);
    cabLog(c, `🏢 ${p.name}을(를) ${postById(id).name}(으)로 임명했어요.${old ? ` ${old.name}은(는) 물러났어요.` : ''}`);
  });
}
export function unpost(s: GameState, pid: number): GameState {
  return withCab(s, (c) => {
    const p = c.people.find((x) => x.id === pid);
    if (!p?.post) return;
    cabLog(c, `↩️ ${p.name}이(가) ${postById(p.post).name}에서 물러났어요.`);
    p.post = undefined;
    p.loyalty = clamp(p.loyalty - 5);
  });
}
/** 자리에 가장 잘 맞는 내 사람(빈 사람만, 힘 큰 순) */
export function postCandidates(s: GameState, id: PostId, n = 4): Person[] {
  const c = cabinetOf(s);
  return c.people
    .filter((p) => p.group === '내각' && !p.seat && !p.post && c.hearing?.pid !== p.id)
    .sort((a, b) => personPostPower(b, id) - personPostPower(a, id))
    .slice(0, n);
}
/** 빈 자리를 실 하나 안에서 가장 잘 맞는 사람으로 채우기(실장부터) */
export function autoFillOffice(s: GameState, office: string): GameState {
  let ns = s;
  const posts = POSTS.filter((p) => p.office === office).sort((a, b) => Number(OFFICES.find((o) => o.head === b.id) != null) - Number(OFFICES.find((o) => o.head === a.id) != null));
  for (const post of posts) {
    if (postHolder(cabinetOf(ns), post.id)) continue;
    const best = postCandidates(ns, post.id, 1)[0];
    if (best) ns = appointPost(ns, best.id, post.id);
  }
  return ns;
}

export function dismiss(s: GameState, pid: number): GameState {
  return withCab(s, (c) => {
    const p = c.people.find((x) => x.id === pid);
    if (!p || p.group !== '내각' || p.post) return;
    c.people = c.people.filter((x) => x.id !== pid);
    cabLog(c, `👋 ${p.name}을(를) 내보냈어요.`);
  });
}
/** 격려(봉급으로 충성 +) */
export const ENCOURAGE_COST = 300;
export function encourage(s: GameState, pid: number): GameState {
  if (s.player.salary < ENCOURAGE_COST) return s;
  return withCab({ ...s, player: { ...s.player, salary: s.player.salary - ENCOURAGE_COST } }, (c) => {
    const p = c.people.find((x) => x.id === pid);
    if (p) p.loyalty = clamp(p.loyalty + 8);
  });
}
/** 신원 조회(정보 점수로 숨은 특성 알아내기) */
export function vet(s: GameState, pid: number): GameState {
  if (s.officer.intel < VET_INTEL) return s;
  return withCab({ ...s, officer: { ...s.officer, intel: s.officer.intel - VET_INTEL } }, (c) => {
    const p = c.people.find((x) => x.id === pid);
    if (p) p.known = true;
  });
}
/** 루비로 인재 명단 새로 받기 */
export function refreshPool(s: GameState): GameState {
  const ruby = s.goals?.ruby ?? 0;
  if (ruby < REFRESH_RUBY || !s.goals) return s;
  const s2: GameState = { ...s, goals: { ...s.goals, ruby: ruby - REFRESH_RUBY } };
  return withCab(s2, (c, ns) => {
    c.people = c.people.filter((p) => p.group !== '인재');
    const rng = new Rng(c.seed);
    const taken = takenNames(c);
    for (let i = 0; i < 16; i++) c.people.push(poolPerson(c, rng, ns.player.countryId, ns.worldMs, taken));
    c.seed = rng.seed;
    cabLog(c, '📋 인재 명단을 새로 받았어요.');
  });
}

/** 지도자 출신의 옛 동료(새 게임 시작 때 한 명 합류) */
export function addBuddy(s: GameState, origin: PersonOrigin, spec: SpecId | null): GameState {
  return withCab(s, (c, ns) => {
    const rng = new Rng(c.seed ^ 0x5bd1);
    const p = genPerson(c, rng, { country: ns.player.countryId, group: '내각', origin, grade: '우수', age: [40, 58] }, ns.worldMs, takenNames(c));
    if (spec) p.spec = spec;
    p.loyalty = 80;
    p.known = true;
    p.buddy = true;
    if (p.hidden === '비리 전력' || p.hidden === '이중 첩자 의혹') p.hidden = null;
    c.people.push(p);
    c.seed = (c.seed + rng.seed) >>> 0;
    cabLog(c, `👥 옛 동료 ${p.name}이(가) 함께 왔어요.`);
  });
}

/* ───────── 인물 수(도감) ───────── */

/** 지금 게임에 나오는 사람 수(정상 13 · 정적 3 · 부관 · 장군 포함) */
export function peopleCount(s: GameState): number {
  return cabinetOf(s).people.length + Object.keys(LEADERS).length + s.officer.rivals.length + s.officer.aides.length + s.officer.generals.length;
}
export function lookOf(p: Person) {
  return LOOK[p.country] ?? 'we';
}
export { faceTag } from '../data/faces';
export { MINISTRIES };
