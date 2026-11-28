// 11-28 새 병과 1: 특수 요원(공작원 팀).
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
export interface Agent {
  id: number;
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
export interface AgentsState {
  list: Agent[];
  nextId: number;
  seed: number;
  /** 방첩으로 잡은 적 첩자(보낸 나라 id) — 포로 교환에 씀 */
  prisoners: string[];
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
  return { id, name, code, sex, age: 30 + Math.floor(rng.next() * 16), face: Math.floor(rng.next() * 1000), skills: [a, b], lv: 1, xp: 0, status: 'idle', ops: 0, wins: 0 };
}

const agentsOfRaw = (s: GameState): AgentsState | undefined => s.agents;

/** 요원 상태(처음엔 요원 2명이 생김. 저장에 없으면 씨앗으로 같은 2명을 만듦) */
export function agentsOf(s: GameState): AgentsState {
  if (s.agents) return s.agents;
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
export function agentBonus(a: Agent | undefined, op: string): number {
  if (!a) return 0;
  const fit = (OP_SKILL[op] ?? []).some((k) => a.skills.includes(k));
  return (a.lv - 1) * LV_BONUS + (fit ? SKILL_BONUS : 0);
}
/** 이 작전에 가장 잘 맞는 쉬는 요원 */
export function bestAgent(s: GameState, op: string): Agent | undefined {
  return [...idleAgents(s)].sort((a, b) => agentBonus(b, op) - agentBonus(a, op) || b.lv - a.lv || a.id - b.id)[0];
}

export function canRecruit(s: GameState): string | null {
  const ag = agentsOf(s);
  const alive = ag.list.filter((a) => a.status !== 'dead').length;
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
  if (!agentsOf(s).prisoners.includes(a.where)) return `${countryById(a.where).name} 첩자를 잡아야 바꿀 수 있어요(방첩)`;
  return null;
}
export function swapAgent(s: GameState, id: number): { state: GameState; text: string } {
  const why = canSwap(s, id);
  if (why) return { state: s, text: why };
  const a = agentById(s, id)!;
  const ag = agentsOf(s);
  const i = ag.prisoners.indexOf(a.where!);
  const prisoners = ag.prisoners.filter((_, j) => j !== i);
  let ns = withAgents(s, { ...ag, prisoners });
  ns = patchAgent(ns, id, { status: 'hurt', untilMs: s.worldMs + HURT_MS, where: undefined });
  const text = `🔁 ${countryById(a.where!).name}과 포로를 맞바꿔 "${a.code}" ${a.name}이 돌아왔어요(하루 쉬어요).`;
  return { state: pushReport(ns, { icon: '🔁', text }), text };
}
/** 방첩으로 적 첩자를 잡으면 포로로 둠 */
export function addPrisoner(s: GameState, country: string): GameState {
  const ag = agentsOf(s);
  return withAgents(s, { ...ag, prisoners: [...ag.prisoners, country].slice(-6) });
}

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
};
export function stepText(op: string, step: number, country: string): string {
  const where = countryById(country).name;
  if (step === 0) return `${where} 국경 검문소예요. 위조 여권으로 넘어갈까요?`;
  if (step === 1) return ACT_TEXT[op] ?? '목표에 닿았어요.';
  return '일은 끝났어요. 이제 빠져나가야 해요. 항구와 공항 모두 검문이 심해요.';
}
/** 요원 없는 옛 저장의 작전 · 위성 정찰은 단계 없음 */
export const hasSteps = (op: string) => op !== 'scout';
