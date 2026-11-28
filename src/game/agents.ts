// 11-28 대장 결정 v2: 특수 요원은 병과가 아니라 대통령 직속 비공식 기관 「그림자실」의 블랙 요원(개인 탭).
//  - 젊고 어두운 분위기의 요원. 나라마다 전설 요원 4명(사진 16장 중 4장, 새 판마다 새 이름·사진·능력치).
//  - 내 나라 전설 요원은 정보기관 소속 → 은밀한 만남으로 인연 100이면 그림자실로 합류.
//  - 다른 나라도 블랙 요원을 보냄(shadow.ts). 붙잡으면 포로 → 외교 협상 우위·교환·전향.
// (처음 11-28: 특수 요원(공작원 팀).)
// 이름·얼굴·특기·등급이 있는 소수정예 공작원. 정보전 작전(위성 정찰 빼고)에 한 명씩 보냄.
// 작전은 잠입 → 실행 → 탈출 3단계. 단계마다 조용히/빠르게/돈으로를 고르면 성공률·들킬 위험이 바뀜(안 고르면 조용히).
// 끝나면 성공/실패 + 들킴 여부. 들킨 채 실패하면 요원이 그 나라에 붙잡힘 → 구출 작전 또는 포로 교환(방첩으로 잡은 적 첩자).
import { LOOK, makeName } from '../data/names';
import { countryById } from '../data/world';
import { Rng } from './rng';
import { pushReport } from './report';
import { priceBase, type GameState } from './state';

const H = 3600e3;

export type AgentSkill = 'infil' | 'demo' | 'hack' | 'recruit' | 'snipe';
export const SKILLS: Record<AgentSkill, { name: string; icon: string }> = {
  infil: { name: '잠입', icon: '🥷' },
  demo: { name: '폭파', icon: '💣' },
  hack: { name: '해킹', icon: '💻' },
  recruit: { name: '포섭', icon: '🤝' },
  snipe: { name: '저격', icon: '🎯' },
};
const SKILL_IDS = Object.keys(SKILLS) as AgentSkill[];
const CODES = ['매', '여우', '늑대', '올빼미', '독수리', '살쾡이', '까마귀', '수달', '흑표', '참매', '그림자', '바람', '송곳', '유령'];

export type AgentStatus = 'idle' | 'busy' | 'hurt' | 'caught' | 'dead';
/** 전설 요원 고유 능력 */
export type LegendTrait = 'ghost' | 'blade' | 'key' | 'tongue' | 'shadow';
export const TRAITS: Record<LegendTrait, { name: string; text: string }> = {
  ghost: { name: '흔적 지우기', text: '들킬 위험 절반' },
  blade: { name: '냉혈', text: '정적 처리 성공 +15%p' },
  key: { name: '만능 열쇠', text: '기술 탈취·설계도·기지 잠입 +15%p' },
  tongue: { name: '언변', text: '포섭·회유·약점 잡기 +15%p' },
  shadow: { name: '그림자 걸음', text: '모든 지령 +8%p' },
};
export interface Agent {
  id: number;
  /** 11-28 v2 전설 요원(SS) · 사진 번호(0~15) · 출신 나라 · 출신 기관 · 고유 능력 · 능력치 */
  legend?: boolean;
  photo?: number;
  home?: string;
  from?: string;
  trait?: LegendTrait;
  stats?: { infil: number; ops: number; hush: number };
  name: string;
  code: string;
  sex: 'm' | 'f';
  age: number;
  face: number;
  skills: [AgentSkill, AgentSkill];
  lv: number;
  xp: number;
  status: AgentStatus;
  /** 부상·붙잡힘이 끝나는 때 */
  untilMs?: number;
  /** 붙잡혀 있는 나라 */
  where?: string;
  ops: number;
  wins: number;
}
/** 붙잡은 다른 나라 요원 */
export interface Prisoner {
  country: string;
  name: string;
  code: string;
  sex: 'm' | 'f';
  legend?: boolean;
  photo?: number;
  face?: number;
  sinceMs: number;
  /** 전향을 한 번 시도함 */
  tried?: boolean;
  /** 전설 요원이면 그 키(나라 명단에서 빠짐) */
  key?: string;
}
export interface AgentsState {
  list: Agent[];
  nextId: number;
  seed: number;
  /** 방첩으로 잡은 적 요원 — 포로 교환·외교 카드 */
  prisoners: Prisoner[];
  /** 11-28 v2 전설 요원 인연(키 → 0~100) · 다음 만남 가능 시각 · 명단에서 빠진 전설(합류·붙잡힘) */
  bond?: Record<string, number>;
  metMs?: Record<string, number>;
  gone?: string[];
  /** 외국 지도자 약점(나라 → 이 시각까지 협상 우위) */
  leverage?: Record<string, number>;
  /** 다른 나라 블랙 작전: 다음 시각 · 기록 */
  aiNextMs?: number;
  alog?: string[];
  /** 요인 포섭·기지 폭파 효과: 나라 → 이 시각까지 그 나라 적 부대 체력·공격 배수 */
  weak: Record<string, { untilMs: number; mul: number }>;
}

export const AGENT_MAX = 6;
export const AGENT_START = 2;
export const HURT_MS = 24 * H;
export const CAUGHT_MS = 6 * 24 * H;
export const XP_WIN = 40;
export const XP_FAIL = 15;
export const LV_MAX = 5;
/** 등급 하나당 성공률 +3%p, 맞는 특기 +8%p */
export const LV_BONUS = 0.03;
export const SKILL_BONUS = 0.08;
export const WEAK_MS = 48 * H;

export const agentCap = (s: GameState) => Math.min(AGENT_MAX, AGENT_START + Math.floor(s.player.rankIndex / 3));
export const recruitCost = (s: GameState) => ({ money: Math.max(500, Math.round(priceBase(s) * 0.15)), intel: 10 });

function makeAgent(s: GameState, rng: Rng, id: number, taken: Set<string>): Agent {
  const me = s.player.countryId;
  const sex: 'm' | 'f' = rng.next() < 0.35 ? 'f' : 'm';
  const name = makeName(me, sex, rng, taken);
  taken.add(name);
  const a = rng.pick(SKILL_IDS);
  const rest = SKILL_IDS.filter((x) => x !== a);
  const b = rng.pick(rest);
  const usedCodes = new Set(agentsOfRaw(s)?.list.map((x) => x.code) ?? []);
  const free = CODES.filter((c) => !usedCodes.has(c));
  const code = free.length ? rng.pick(free) : rng.pick(CODES);
  return { id, name, code, sex, age: 24 + Math.floor(rng.next() * 11), face: Math.floor(rng.next() * 1000), skills: [a, b], lv: 1, xp: 0, status: 'idle', ops: 0, wins: 0 };
}

const agentsOfRaw = (s: GameState): AgentsState | undefined => s.agents;

/** 요원 상태(처음엔 요원 2명이 생김. 저장에 없으면 씨앗으로 같은 2명을 만듦) */
export function agentsOf(s: GameState): AgentsState {
  if (s.agents) {
    // 옛 저장: 포로가 나라 이름만 있었음
    const pr = s.agents.prisoners as unknown as Array<string | Prisoner>;
    if (pr.some((p) => typeof p === 'string')) return { ...s.agents, prisoners: pr.map((p) => (typeof p === 'string' ? { country: p, name: '이름 모를 요원', code: '?', sex: 'm' as const, sinceMs: s.worldMs } : p)) };
    return s.agents;
  }
  const seed = (s.world.seed ^ 0x9e3779b9) >>> 0;
  const rng = new Rng(seed);
  const taken = new Set<string>();
  const list: Agent[] = [];
  const base: GameState = { ...s, agents: { list, nextId: 1, seed, prisoners: [], weak: {} } };
  for (let i = 0; i < AGENT_START; i++) list.push(makeAgent(base, rng, i + 1, taken));
  // 처음 두 명은 등급 2로(바로 쓸 만하게)
  for (const a of list) a.lv = 2;
  return { list, nextId: AGENT_START + 1, seed: rng.seed, prisoners: [], weak: {} };
}
export const withAgents = (s: GameState, a: AgentsState): GameState => ({ ...s, agents: a });
export const agentById = (s: GameState, id: number | undefined) => (id == null ? undefined : agentsOf(s).list.find((a) => a.id === id));
export const idleAgents = (s: GameState) => agentsOf(s).list.filter((a) => a.status === 'idle');
export const caughtIn = (s: GameState, country: string) => agentsOf(s).list.filter((a) => a.status === 'caught' && a.where === country);

/** 작전에 맞는 특기 */
export const OP_SKILL: Record<string, AgentSkill[]> = {
  techsteal: ['hack', 'infil'],
  dirt: ['recruit'],
  fund: ['hack'],
  'r-wiretap': ['hack'], 'r-expose': ['hack'], 'r-fakenews': ['recruit'], 'r-aide': ['recruit'], 'r-cash': ['hack'], 'r-split': ['recruit'],
  'r-woo': ['recruit'], 'r-probe': ['hack'], 'r-defect': ['recruit'], 'r-frame': ['infil'], 'r-family': ['infil'], 'r-accident': ['snipe', 'demo'],
  secret: ['recruit'],
  steal: ['hack'],
  rumor: ['recruit'],
  sabotage: ['demo'],
  coup: ['infil'],
  turn: ['recruit'],
  blueprint: ['hack', 'infil'],
  base: ['demo', 'infil'],
  rescue: ['snipe', 'infil'],
};
const TRAIT_OPS: Partial<Record<LegendTrait, (op: string) => boolean>> = {
  blade: (op) => op.startsWith('r-'),
  key: (op) => op === 'techsteal' || op === 'blueprint' || op === 'base',
  tongue: (op) => op === 'turn' || op === 'dirt' || op === 'r-woo' || op === 'r-aide',
};
export function agentBonus(a: Agent | undefined, op: string): number {
  if (!a) return 0;
  const fit = (OP_SKILL[op] ?? []).some((k) => a.skills.includes(k));
  let v = (a.lv - 1) * LV_BONUS + (fit ? SKILL_BONUS : 0);
  if (a.legend) v += 0.06 + ((a.stats?.ops ?? 85) - 85) / 200;
  if (a.trait === 'shadow') v += 0.08;
  else if (a.trait && TRAIT_OPS[a.trait]?.(op)) v += 0.15;
  return v;
}
/** 들킬 위험 배수(전설 요원·흔적 지우기) */
export const agentRiskMul = (a: Agent | undefined) => (!a ? 1 : (a.trait === 'ghost' ? 0.5 : 1) * (a.legend ? 1 - (a.stats?.hush ?? 85) / 400 : 1));
/** 이 작전에 가장 잘 맞는 쉬는 요원 */
export function bestAgent(s: GameState, op: string): Agent | undefined {
  return [...idleAgents(s)].sort((a, b) => agentBonus(b, op) - agentBonus(a, op) || b.lv - a.lv || a.id - b.id)[0];
}

export function canRecruit(s: GameState): string | null {
  const ag = agentsOf(s);
  const alive = ag.list.filter((a) => a.status !== 'dead' && !a.legend).length;
  if (alive >= agentCap(s)) return alive >= AGENT_MAX ? `요원은 ${AGENT_MAX}명까지예요` : '호칭이 오르면 더 뽑을 수 있어요';
  const c = recruitCost(s);
  if (s.officer.intel < c.intel) return `정보 점수 ${c.intel} 필요`;
  if (s.nations[s.player.countryId].treasury < c.money) return '나라 예산이 모자라요';
  return null;
}
export function recruitAgent(s: GameState): { state: GameState; text: string } {
  const why = canRecruit(s);
  if (why) return { state: s, text: why };
  const ag = agentsOf(s);
  const rng = new Rng(ag.seed);
  const a = makeAgent(s, rng, ag.nextId, new Set(ag.list.map((x) => x.name)));
  const c = recruitCost(s);
  const me = s.player.countryId;
  const ns: GameState = {
    ...s,
    nations: { ...s.nations, [me]: { ...s.nations[me], treasury: s.nations[me].treasury - c.money } },
    officer: { ...s.officer, intel: s.officer.intel - c.intel },
    agents: { ...ag, list: [...ag.list, a], nextId: ag.nextId + 1, seed: rng.seed },
  };
  return { state: ns, text: `🕵️ 새 요원 "${a.code}" ${a.name}(${SKILLS[a.skills[0]].name}·${SKILLS[a.skills[1]].name})이 합류했어요.` };
}

export function patchAgent(s: GameState, id: number, p: Partial<Agent>): GameState {
  const ag = agentsOf(s);
  return withAgents(s, { ...ag, list: ag.list.map((a) => (a.id === id ? { ...a, ...p } : a)) });
}

/** 작전을 마친 요원: 경험치·등급 */
export function agentDone(s: GameState, id: number, ok: boolean, after: { status: AgentStatus; untilMs?: number; where?: string }): { state: GameState; up: boolean } {
  const a = agentById(s, id);
  if (!a) return { state: s, up: false };
  let xp = a.xp + (ok ? XP_WIN : XP_FAIL);
  let lv = a.lv;
  let up = false;
  while (lv < LV_MAX && xp >= lv * 100) {
    xp -= lv * 100;
    lv++;
    up = true;
  }
  if (lv >= LV_MAX) xp = Math.min(xp, LV_MAX * 100);
  return { state: patchAgent(s, id, { xp, lv, ops: a.ops + 1, wins: a.wins + (ok ? 1 : 0), status: after.status, untilMs: after.untilMs, where: after.where }), up };
}

/** 포로 교환: 방첩으로 잡은 그 나라 첩자와 우리 요원을 맞바꿈 */
export function canSwap(s: GameState, id: number): string | null {
  const a = agentById(s, id);
  if (!a || a.status !== 'caught' || !a.where) return '붙잡힌 요원이 아니에요';
  if (!agentsOf(s).prisoners.some((p) => p.country === a.where)) return `${countryById(a.where).name} 요원을 잡아야 바꿀 수 있어요(방첩)`;
  return null;
}
export function swapAgent(s: GameState, id: number): { state: GameState; text: string } {
  const why = canSwap(s, id);
  if (why) return { state: s, text: why };
  const a = agentById(s, id)!;
  const ag = agentsOf(s);
  const i = ag.prisoners.findIndex((p) => p.country === a.where);
  const prisoners = ag.prisoners.filter((_, j) => j !== i);
  let ns = withAgents(s, { ...ag, prisoners });
  ns = patchAgent(ns, id, { status: 'hurt', untilMs: s.worldMs + HURT_MS, where: undefined });
  const text = `🔁 ${countryById(a.where!).name}과 포로를 맞바꿔 "${a.code}" ${a.name}이 돌아왔어요(하루 쉬어요).`;
  return { state: pushReport(ns, { icon: '🔁', text }), text };
}
/** 방첩으로 적 요원을 잡으면 포로로 둠(이름 없으면 그 나라 이름으로 지음) */
export function addPrisoner(s: GameState, country: string, who?: Partial<Prisoner>): GameState {
  const ag = agentsOf(s);
  const rng = new Rng((ag.seed ^ (s.worldMs >>> 3)) >>> 0);
  const sex: 'm' | 'f' = who?.sex ?? (rng.next() < 0.3 ? 'f' : 'm');
  const p: Prisoner = { country, name: who?.name ?? makeName(country, sex, rng, new Set()), code: who?.code ?? rng.pick(CODES), sex, sinceMs: s.worldMs, face: who?.face ?? Math.floor(rng.next() * 1000), ...who };
  const gone = p.key ? [...(ag.gone ?? []), p.key] : ag.gone;
  return withAgents(s, { ...ag, prisoners: [...ag.prisoners, p].slice(-8), gone });
}

/* ───────── 11-28 v2 전설 요원(나라마다 4명, 사진 16장 중) ───────── */
export const LEGEND_N = 4;
export const PHOTO_N = 16;
export const BOND_JOIN = 100;
export const MEET_GAP_MS = 6 * H;
/** 나라별 정보기관 이름 */
export const AGENCY: Record<string, string> = {
  kr: '국가정보원', us: 'CIA', ru: '대외정보국(SVR)', cn: '국가안전부', jp: '내각정보조사실', uk: 'MI6', fr: '대외안보총국(DGSE)', de: '연방정보국(BND)',
  il: '모사드', in: '연구분석국(RAW)', pk: '정보총국(ISI)', kp: '정찰총국', ir: '정보부(VAJA)', tr: '국가정보청(MIT)', sa: '정보총국(GIP)', tw: '국가안전국',
  au: 'ASIS', ca: 'CSIS', it: 'AISE', es: 'CNI', br: 'ABIN', eg: '정보총국(GIS)', ua: '해외정보국', pl: '정보국(AW)', ph: '국가정보조정청',
};
export const agencyOf = (country: string) => AGENCY[country] ?? `${countryById(country).name} 정보기관`;
export interface LegendDef {
  key: string;
  country: string;
  name: string;
  code: string;
  sex: 'm' | 'f';
  age: number;
  photo: number;
  trait: LegendTrait;
  stats: { infil: number; ops: number; hush: number };
  skills: [AgentSkill, AgentSkill];
}
const LEGEND_CODES = ['검은 별', '야차', '흑요석', '독사', '서리', '무영', '칼날', '밤까마귀', '흑매', '잿빛 늑대', '은장도', '그믐', '심연', '나비', '자정', '흑표범'];
const strHash = (t: string) => { let h = 2166136261; for (const c of t) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0; return h; };
/** 그 나라 전설 요원 4명(판마다 씨앗이 달라 이름·사진·능력치가 새로 정해짐) */
export function legendsOf(s: GameState, country: string): LegendDef[] {
  const rng = new Rng(((s.world.seed ?? 1) ^ strHash(`legend-${country}`)) >>> 0);
  const photos = Array.from({ length: PHOTO_N }, (_, i) => i);
  const taken = new Set<string>();
  const out: LegendDef[] = [];
  const codes = [...LEGEND_CODES];
  for (let i = 0; i < LEGEND_N; i++) {
    const photo = photos.splice(Math.floor(rng.next() * photos.length), 1)[0];
    // 사진 번호 0~7 남자, 8~15 여자(명령문과 같은 순서)
    const sex: 'm' | 'f' = photo < 8 ? 'm' : 'f';
    const name = makeName(country, sex, rng, taken);
    taken.add(name);
    const code = codes.splice(Math.floor(rng.next() * codes.length), 1)[0];
    const a = rng.pick(SKILL_IDS);
    const b = rng.pick(SKILL_IDS.filter((x) => x !== a));
    const st = () => 80 + Math.floor(rng.next() * 20);
    out.push({ key: `${country}-${i}`, country, name, code, sex, age: 24 + Math.floor(rng.next() * 10), photo, trait: rng.pick(Object.keys(TRAITS) as LegendTrait[]), stats: { infil: st(), ops: st(), hush: st() }, skills: [a, b] });
  }
  return out;
}
/** 아직 그 나라 정보기관에 남아 있는 전설 요원 */
export const freeLegends = (s: GameState, country: string) => legendsOf(s, country).filter((l) => !(agentsOf(s).gone ?? []).includes(l.key));
export const bondOf = (s: GameState, key: string) => agentsOf(s).bond?.[key] ?? 0;
export const meetCost = (s: GameState) => ({ intel: 5, money: Math.max(300, Math.round(priceBase(s) * 0.05)) });
export function canMeetLegend(s: GameState, key: string): string | null {
  const me = s.player.countryId;
  if (!freeLegends(s, me).some((l) => l.key === key)) return '만날 수 없는 요원';
  const ag = agentsOf(s);
  const next = ag.metMs?.[key] ?? 0;
  if (next > s.worldMs) return '아직 다시 만나기 일러요';
  const c = meetCost(s);
  if (s.officer.intel < c.intel) return `정보 점수 ${c.intel} 필요`;
  if (s.nations[me].treasury < c.money) return '나라 예산이 모자라요';
  return null;
}
/** 은밀한 만남: 인연 +12~24(정보 스탯이 높을수록), 100이면 그림자실 합류 */
export function meetLegend(s: GameState, key: string, way: 'warm' | 'deal' = 'warm'): { state: GameState; text: string } {
  const why = canMeetLegend(s, key);
  if (why) return { state: s, text: why };
  const me = s.player.countryId;
  const l = legendsOf(s, me).find((x) => x.key === key)!;
  const ag = agentsOf(s);
  const rng = new Rng((ag.seed ^ strHash(key) ^ (s.worldMs >>> 5)) >>> 0);
  const c = meetCost(s);
  const gain = Math.round((way === 'warm' ? 12 : 16) + rng.next() * 8 + (s.officer.stats['정보'] ?? 8) / 5);
  const bond = Math.min(BOND_JOIN, bondOf(s, key) + gain);
  let ns: GameState = {
    ...s,
    nations: { ...s.nations, [me]: { ...s.nations[me], treasury: s.nations[me].treasury - c.money * (way === 'deal' ? 3 : 1) } },
    officer: { ...s.officer, intel: s.officer.intel - c.intel },
    agents: { ...ag, bond: { ...(ag.bond ?? {}), [key]: bond }, metMs: { ...(ag.metMs ?? {}), [key]: s.worldMs + MEET_GAP_MS }, seed: rng.seed },
  };
  if (bond < BOND_JOIN) return { state: ns, text: `🕶️ "${l.code}" ${l.name}과 은밀히 만났어요. 인연 +${gain} (${bond}/100)` };
  ns = joinLegend(ns, l, agencyOf(me));
  const text = `🖤 ${agencyOf(me)}의 전설 요원 "${l.code}" ${l.name}이 정보기관을 나와 그림자실에 합류했어요!`;
  return { state: pushReport(ns, { icon: '🖤', text }), text };
}
/** 전설 요원을 내 블랙 요원으로 */
export function joinLegend(s: GameState, l: Pick<LegendDef, 'key' | 'name' | 'code' | 'sex' | 'age' | 'photo' | 'trait' | 'stats' | 'skills' | 'country'>, from: string): GameState {
  const ag = agentsOf(s);
  const a: Agent = { id: ag.nextId, name: l.name, code: l.code, sex: l.sex, age: l.age, face: l.photo, skills: l.skills, lv: LV_MAX, xp: 0, status: 'idle', ops: 0, wins: 0, legend: true, photo: l.photo, home: l.country, from, trait: l.trait, stats: l.stats };
  return withAgents(s, { ...ag, list: [...ag.list, a], nextId: ag.nextId + 1, gone: [...new Set([...(ag.gone ?? []), l.key])] });
}
/** 지령이 성공하면 소문이 나서 내 나라 전설 요원들의 인연이 조금 오름 */
export function bondRumor(s: GameState, v: number): GameState {
  const ag = agentsOf(s);
  const bond = { ...(ag.bond ?? {}) };
  for (const l of freeLegends(s, s.player.countryId)) bond[l.key] = Math.min(BOND_JOIN - 1, (bond[l.key] ?? 0) + v);
  return withAgents(s, { ...ag, bond });
}

/* ───────── 포로 외교 ───────── */
/** 그 나라와의 외교 협상 덤: 그 나라 요원 포로 1명당 +20%p(전설은 2배, 최대 +40%p), 약점을 쥐고 있으면 +15%p, 내 요원이 거기 붙잡혀 있으면 −10%p */
export function prisonerEdge(s: GameState, country: string): number {
  const ag = s.agents;
  if (!ag) return 0;
  const pr = (ag.prisoners as unknown as Array<string | Prisoner>).map((p) => (typeof p === 'string' ? { country: p, legend: false } : p));
  const n = pr.filter((p) => p.country === country).reduce((a, p) => a + (p.legend ? 2 : 1), 0);
  const lev = (ag.leverage?.[country] ?? 0) > s.worldMs ? 0.15 : 0;
  const mine = ag.list.some((a) => a.status === 'caught' && a.where === country) ? 0.1 : 0;
  return Math.min(0.4, n * 0.2) + lev - mine;
}
export const ransomOf = (s: GameState, legend?: boolean) => Math.round(Math.max(1500, priceBase(s) * 0.3) * (legend ? 2.5 : 1));

/** 요인 포섭·기지 폭파: 그 나라 적 부대가 잠시 약해짐 */
export function addWeak(s: GameState, country: string, mul: number): GameState {
  const ag = agentsOf(s);
  const cur = ag.weak[country];
  const m = cur && cur.untilMs > s.worldMs ? Math.min(cur.mul, mul) * (cur.mul < 1 && mul < 1 ? 0.95 : 1) : mul;
  return withAgents(s, { ...ag, weak: { ...ag.weak, [country]: { untilMs: s.worldMs + WEAK_MS, mul: Math.max(0.6, Math.round(m * 1000) / 1000) } } });
}
export const weakMul = (s: GameState, country: string | null | undefined): number => {
  if (!country) return 1;
  const w = s.agents?.weak[country];
  return w && w.untilMs > s.worldMs ? w.mul : 1;
};

/** 시간이 흐를 때: 부상 회복, 붙잡힌 요원은 6일 뒤 풀려남(등급 -1) */
export function agentsTick(s: GameState): GameState {
  const ag = s.agents;
  if (!ag) return s;
  let ns = s;
  for (const a of ag.list) {
    if (a.status === 'hurt' && (a.untilMs ?? 0) <= s.worldMs) ns = patchAgent(ns, a.id, { status: 'idle', untilMs: undefined });
    if (a.status === 'caught' && (a.untilMs ?? 0) <= s.worldMs) {
      ns = patchAgent(ns, a.id, { status: 'hurt', untilMs: s.worldMs + HURT_MS, where: undefined, lv: Math.max(1, a.lv - 1), xp: 0 });
      ns = pushReport(ns, { icon: '🕊️', text: `"${a.code}" ${a.name}이 ${countryById(a.where ?? s.player.countryId).name}에서 풀려났어요. 오래 갇혀 있어 등급이 하나 내려갔어요.` });
    }
  }
  return ns;
}

/** 얼굴 그림 고르는 데 쓰는 정보 */
export const agentLook = (s: GameState) => LOOK[s.player.countryId] ?? 'ea';

/* ───────── 작전 3단계 ───────── */
export type StepPick = 'quiet' | 'fast' | 'bribe';
export const PICKS: Record<StepPick, { icon: string; name: string; chance: number; risk: number; money: number }> = {
  quiet: { icon: '🤫', name: '조용히', chance: 0, risk: 5, money: 0 },
  fast: { icon: '💥', name: '빠르게', chance: 0.08, risk: 25, money: 0 },
  bribe: { icon: '💵', name: '돈으로 매수', chance: 0.03, risk: 0, money: 0.35 },
};
export const STEP_NAMES = ['잠입', '실행', '탈출'] as const;
/** 11-28 v2 정적 처리(나라 안)는 접근 → 실행 → 흔적 지우기 */
export const stepNames = (op: string): readonly string[] => (op.startsWith('r-') ? ['접근', '실행', '흔적 지우기'] : STEP_NAMES);
/** 단계 장면 그림 이름(src/assets/scenes/agent-<이름>.webp, 없으면 옛 장면 그림) */
export const STEP_ART: Record<string, string[]> = {
  secret: ['infil', 'contact', 'exfil'],
  steal: ['infil', 'server', 'exfil'],
  rumor: ['infil', 'contact', 'exfil'],
  sabotage: ['infil', 'base', 'exfil'],
  coup: ['infil', 'contact', 'exfil'],
  turn: ['infil', 'contact', 'exfil'],
  blueprint: ['infil', 'server', 'exfil'],
  base: ['infil', 'base', 'exfil'],
  rescue: ['infil', 'base', 'exfil'],
  'r-*': ['contact', 'contact', 'exfil'],
  techsteal: ['infil', 'server', 'exfil'],
  dirt: ['infil', 'contact', 'exfil'],
  fund: ['infil', 'server', 'exfil'],
};
const ACT_TEXT: Record<string, string> = {
  secret: '지도자 측근이 묵는 호텔 방 앞에 닿았어요.',
  steal: '연구소 서버실 문이 열렸어요. 내려받기에 시간이 걸려요.',
  rumor: '언론사 사람과 은밀히 만났어요. 소문을 어떻게 흘릴까요?',
  sabotage: '군수공장 변전실에 숨어들었어요. 경비 교대가 곧이에요.',
  coup: '반군 지도자와 접선했어요. 무기와 돈을 넘겨야 해요.',
  turn: '적 장군의 부관과 마주 앉았어요. 마음이 흔들리는 눈치예요.',
  blueprint: '설계 사무소 금고 앞이에요. 경보 장치가 보여요.',
  base: '새벽 3시, 탄약고 앞에 닿았어요. 순찰조가 5분 뒤 지나가요.',
  rescue: '우리 요원이 갇힌 수용소 담장 밑이에요. 탐조등이 돌아가요.',
  techsteal: '그 나라 국책 연구소 지하 서버실이에요. 복사에 12분이 걸려요.',
  dirt: '지도자의 비밀 계좌를 관리하는 은행가와 마주 앉았어요.',
  fund: '해외 비밀 계좌 관리인의 사무실 금고 앞이에요.',
};
const R_ACT: Record<string, string> = {
  wiretap: '정적 사무실 전화 단자함을 열었어요.',
  expose: '비리 장부 사본을 손에 넣었어요. 어느 기자에게 넘길까요?',
  fakenews: '여론 조작 팀이 기사와 댓글을 준비했어요.',
  aide: '정적의 최측근과 호텔 방에서 마주 앉았어요.',
  cash: '정적 후원 기업의 회계 담당자를 만났어요.',
  split: '두 정적 사이를 갈라 놓을 문서를 흘릴 차례예요.',
  woo: '정적에게 건넬 돈가방이 준비됐어요.',
  probe: '검찰에 넘길 증거를 정리했어요.',
  defect: '정적에게 해외로 떠나라는 "제안"을 전할 차례예요.',
  frame: '정적 금고에 간첩 증거를 숨겨 둘 차례예요.',
  family: '정적의 가족 주변을 조용히 맴돌고 있어요.',
  accident: '정적의 차량 정비 기록을 손에 넣었어요.',
};
export function stepText(op: string, step: number, country: string, rival?: string): string {
  if (op.startsWith('r-')) {
    if (step === 0) return `${rival ?? '정적'} 주변에 조용히 다가가요. 경호원과 기자 눈을 피해야 해요.`;
    if (step === 1) return R_ACT[op.slice(2)] ?? '목표에 닿았어요.';
    return '일은 끝났어요. 이제 흔적을 지워야 해요. 기자들이 냄새를 맡기 시작했어요.';
  }
  const where = countryById(country).name;
  if (step === 0) return `${where} 국경 검문소예요. 위조 여권으로 넘어갈까요?`;
  if (step === 1) return ACT_TEXT[op] ?? '목표에 닿았어요.';
  return '일은 끝났어요. 이제 빠져나가야 해요. 항구와 공항 모두 검문이 심해요.';
}
/** 11-28 v2: 블랙 요원이 가는 그림자실 지령만 단계가 있음(정보전 공식 작전은 요원 없이) */
export const SHADOW_FOREIGN = ['techsteal', 'turn', 'blueprint', 'base', 'rescue', 'dirt', 'fund'];
export const hasSteps = (op: string) => op.startsWith('r-') || SHADOW_FOREIGN.includes(op);
