// A2 국정 과제 나무(11/24): 취임 공약 5갈래 중 2개를 골라 과제를 완수. 과제는 연구가 아니라 '조건 달성'.
// 갈래마다 4단계 × 3과제. 한 단계에서 2개를 끝내면 다음 단계가 열림. 끝낸 과제는 판 끝까지 효과가 남음.
// 첫 단계를 3일 안에 못 끝내면 '공약 파기' 여론(지지도·신뢰도 −). 한 갈래를 다 끝내면 '공약 완수'(명성·지지도) + 갈래 하나 더.
import type { GameState } from './state';
import type { LawKey } from './laws';
import { domLog, domOf, registerDomRows, snap, withDom, type Rows } from './domestic';
import { METRICS, metric, type MetricId } from './metrics';
import { addPresMod, bumpApproval } from './approval';

const H = 3600e3;
export const PLEDGE_DAYS = 3;
export const PLEDGE_START = 2;

export interface AgendaTask {
  id: string;
  name: string;
  icon: string;
  metric: MetricId;
  /** 나라 크기에 맞추는 지표면 시작 값 × target, 아니면 그대로 목표 */
  target: number;
  eff: Partial<Record<LawKey, number>>;
}
export interface AgendaBranch {
  id: string;
  icon: string;
  name: string;
  slogan: string;
  tasks: AgendaTask[][];
  /** 다 끝내면 */
  finale: string;
}

const t = (id: string, icon: string, name: string, m: MetricId, target: number, eff: Partial<Record<LawKey, number>>): AgendaTask => ({ id, icon, name, metric: m, target, eff });

export const AGENDA: AgendaBranch[] = [
  {
    id: 'sec',
    icon: '🛡️',
    name: '안보 강국',
    slogan: '누구도 넘보지 못하는 나라',
    finale: '모집 +5% · 안보 +5',
    tasks: [
      [t('sec1', '🪖', '상비군 증강', 'troops', 1.08, { troop: 0.03 }), t('sec2', '⚙️', '국방 연구 착수', 'mil', 2, { build: 0.03 }), t('sec3', '🛡️', '안보 점수 +3', 'fdef', 3, { defense: 2 })],
      [t('sec4', '⚔️', '전투력 30% 강화', 'power', 1.3, { build: 0.03 }), t('sec5', '🔩', '첨단 무기 개발', 'mil', 6, { build: 0.03 }), t('sec6', '⚖️', '기본법 정비', 'codes', 1, { troop: 0.03 })],
      [t('sec7', '🎖️', '병력 30% 증원', 'troops', 1.3, { troop: 0.04 }), t('sec8', '🏗️', '국가 방위 사업', 'projects', 1, { defense: 3 }), t('sec9', '🧱', '안보 점수 +8', 'fdef', 8, { defense: 3 })],
      [t('sec10', '🚀', '국방 과학 강국', 'mil', 14, { build: 0.05 }), t('sec11', '💥', '전투력 두 배', 'power', 2, { build: 0.04 }), t('sec12', '🦅', '최강 군대(안보 +14)', 'fdef', 14, { defense: 4, trust: 2 })],
    ],
  },
  {
    id: 'eco',
    icon: '💰',
    name: '경제 성장',
    slogan: '국민 소득 두 배',
    finale: '예산 +6% · 경제 +5',
    tasks: [
      [t('eco1', '💵', '예산 10% 늘리기', 'budget', 1.1, { budget: 0.03 }), t('eco2', '🚢', '첫 무역 계약', 'trade', 1, { res: 0.03 }), t('eco3', '📈', '경제 지수 +3', 'feco', 3, { economy: 2 })],
      [t('eco4', '🏙️', '경제 특구 지정', 'zones', 1, { budget: 0.03 }), t('eco5', '📦', '수출 길 넓히기', 'trade', 3, { res: 0.04 }), t('eco6', '👪', '도시 키우기', 'pop', 1.25, { budget: 0.02, loyalty: 1 })],
      [t('eco7', '💹', '예산 30% 늘리기', 'budget', 1.3, { budget: 0.04 }), t('eco8', '🏗️', '국가 대형 사업 완공', 'projects', 1, { res: 0.04 }), t('eco9', '🏦', '경제 지수 +8', 'feco', 8, { economy: 3 })],
      [t('eco10', '🌏', '무역 강국', 'trade', 5, { res: 0.05 }), t('eco11', '🪙', '예산 두 배', 'budget', 2, { budget: 0.06 }), t('eco12', '🏆', '경제 선진국(+14)', 'feco', 14, { economy: 4, approval: 2 })],
    ],
  },
  {
    id: 'wel',
    icon: '🏥',
    name: '복지 국가',
    slogan: '아무도 뒤처지지 않는 나라',
    finale: '모든 도시 민심 +5 · 지지도 +3',
    tasks: [
      [t('wel1', '🏘️', '민심 +3', 'loyalty', 3, { loyalty: 2 }), t('wel2', '🙂', '지지도 +3', 'approval', 3, { approval: 1 }), t('wel3', '👥', '사회 안정 +3', 'fsoc', 3, { society: 2 })],
      [t('wel4', '📜', '복지 입법', 'laws', 2, { loyalty: 2 }), t('wel5', '👪', '살기 좋은 도시', 'pop', 1.2, { loyalty: 1, approval: 1 }), t('wel6', '🎓', '사회 연구', 'soc', 4, { research: 0.03 })],
      [t('wel7', '💗', '민심 +8', 'loyalty', 8, { loyalty: 3 }), t('wel8', '🏙️', '균형 발전 특구', 'zones', 2, { society: 2 }), t('wel9', '😊', '지지도 +8', 'approval', 8, { approval: 2 })],
      [t('wel10', '🏛️', '복지 제도 완성', 'soc', 12, { loyalty: 3 }), t('wel11', '🕊️', '갈등 없는 사회(+14)', 'fsoc', 14, { society: 4 }), t('wel12', '🌈', '국민 행복(지지도 +14)', 'approval', 14, { approval: 3, trust: 2 })],
    ],
  },
  {
    id: 'sci',
    icon: '🔬',
    name: '과학 선도',
    slogan: '기술로 먹고사는 나라',
    finale: '연구 +12%',
    tasks: [
      [t('sci1', '🧪', '연구 3개', 'soc', 2, { research: 0.03 }), t('sci2', '⚙️', '기술 국방', 'mil', 2, { research: 0.03 }), t('sci3', '📈', '첨단 산업 육성', 'feco', 3, { research: 0.02 })],
      [t('sci4', '🏙️', '연구개발특구', 'zones', 1, { research: 0.04 }), t('sci5', '🔭', '기초 과학', 'soc', 6, { research: 0.04 }), t('sci6', '💻', '정밀 무기', 'mil', 6, { build: 0.03 })],
      [t('sci7', '🚀', '우주·반도체 사업', 'projects', 1, { research: 0.05 }), t('sci8', '🎓', '과학 인재 양성', 'codes', 1, { research: 0.03 }), t('sci9', '📚', '연구 20개', 'soc', 10, { research: 0.04 })],
      [t('sci10', '🛰️', '기술 강국', 'mil', 16, { build: 0.04 }), t('sci11', '🧬', '노벨상 나라', 'soc', 16, { research: 0.06 }), t('sci12', '🏅', '과학 선진국', 'projects', 3, { research: 0.06, trust: 2 })],
    ],
  },
  {
    id: 'dip',
    icon: '🌐',
    name: '외교 중심',
    slogan: '세계가 찾는 나라',
    finale: '모든 나라 호감 +6 · 외교 +5',
    tasks: [
      [t('dip1', '📄', '첫 협정', 'agree', 1, { favor: 2 }), t('dip2', '🌐', '외교 위상 +3', 'fdip', 3, { diplo: 2 }), t('dip3', '🤝', '신뢰도 +3', 'trust', 3, { trust: 1 })],
      [t('dip4', '🗺️', '협정 3개', 'agree', 3, { favor: 3 }), t('dip5', '🚢', '무역 동반자', 'trade', 2, { diplo: 2 }), t('dip6', '⭐', '이름 알리기', 'fame', 80, { diplo: 2 })],
      [t('dip7', '🕊️', '외교 위상 +8', 'fdip', 8, { diplo: 3 }), t('dip8', '🏟️', '국제 행사 유치', 'projects', 1, { favor: 3 }), t('dip9', '🤝', '신뢰도 +8', 'trust', 8, { trust: 2 })],
      [t('dip10', '📑', '협정 6개', 'agree', 6, { favor: 4 }), t('dip11', '🌍', '세계의 중재자(+15)', 'fdip', 15, { diplo: 4 }), t('dip12', '👑', '세계적 지도자', 'fame', 300, { diplo: 3, approval: 2 })],
    ],
  },
];
const FINALE: Record<string, Partial<Record<LawKey, number>>> = {
  sec: { troop: 0.05, defense: 5 },
  eco: { budget: 0.06, economy: 5 },
  wel: { loyalty: 5, approval: 3 },
  sci: { research: 0.12 },
  dip: { favor: 6, diplo: 5 },
};

export const branchById = (id: string) => AGENDA.find((b) => b.id === id)!;
export const taskById = (id: string): AgendaTask | undefined => AGENDA.flatMap((b) => b.tasks.flat()).find((x) => x.id === id);

/** 나라 크기 지표의 바닥값(시작 값이 0일 때) */
const FLOOR: Partial<Record<MetricId, number>> = { power: 50, pop: 4, budget: 1000, troops: 1000 };

export function taskTarget(s: GameState, br: string, task: AgendaTask): number {
  if (METRICS[task.metric].plus) {
    const base = domOf(s).agenda.base[br]?.[task.metric] ?? metric(s, task.metric);
    return Math.min(97, Math.round(base) + task.target);
  }
  if (!METRICS[task.metric].scaled) return task.target;
  const base = domOf(s).agenda.base[br]?.[task.metric] ?? metric(s, task.metric);
  return Math.ceil(Math.max(base, FLOOR[task.metric] ?? 1) * task.target);
}
export function taskNow(s: GameState, task: AgendaTask): number {
  return metric(s, task.metric);
}
/** 단계가 열렸는지(앞 단계에서 2개 이상 끝냄) */
export function tierOpen(s: GameState, br: AgendaBranch, tier: number): boolean {
  if (tier === 0) return true;
  const done = new Set(domOf(s).agenda.done);
  return br.tasks[tier - 1].filter((x) => done.has(x.id)).length >= 2;
}
export function branchDone(s: GameState, br: AgendaBranch): boolean {
  const done = new Set(domOf(s).agenda.done);
  return br.tasks.flat().every((x) => done.has(x.id));
}
/** 공약으로 고를 수 있는 갈래 수 */
export function pledgeSlots(s: GameState): number {
  return PLEDGE_START + AGENDA.filter((b) => domOf(s).agenda.pledges.includes(b.id) && branchDone(s, b)).length;
}

export function canPledge(s: GameState, id: string): string | null {
  const a = domOf(s).agenda;
  if (a.pledges.includes(id)) return '이미 고른 공약이에요';
  if (a.pledges.length >= pledgeSlots(s)) return '공약은 지금 더 못 골라요(한 갈래를 다 끝내면 하나 더)';
  return null;
}
export function pledge(s: GameState, id: string): GameState {
  if (canPledge(s, id)) return s;
  const a = domOf(s).agenda;
  const base: Record<string, number> = {};
  for (const m of Object.keys(METRICS) as MetricId[]) if (METRICS[m].scaled || METRICS[m].plus) base[m] = Math.round(metric(s, m));
  const br = branchById(id);
  let ns = withDom(s, { agenda: { ...a, pledges: [...a.pledges, id], since: { ...a.since, [id]: s.worldMs }, base: { ...a.base, [id]: base } } });
  ns = domLog(ns, `${br.icon} 공약 '${br.name}' 발표`);
  return snap(ns, 'press', `공약 발표: ${br.name}`, br.slogan);
}

export function canFinish(s: GameState, id: string): string | null {
  const a = domOf(s).agenda;
  if (a.done.includes(id)) return '이미 끝낸 과제예요';
  const br = AGENDA.find((b) => b.tasks.flat().some((x) => x.id === id));
  if (!br || !a.pledges.includes(br.id)) return '공약으로 고른 갈래가 아니에요';
  const tier = br.tasks.findIndex((row) => row.some((x) => x.id === id));
  if (!tierOpen(s, br, tier)) return '앞 단계 과제를 2개 끝내야 열려요';
  const task = taskById(id)!;
  const now = taskNow(s, task);
  const goal = taskTarget(s, br.id, task);
  if (now < goal) return `${METRICS[task.metric].name} ${fmtN(now)} / ${fmtN(goal)}`;
  return null;
}
export function finishTask(s: GameState, id: string): GameState {
  if (canFinish(s, id)) return s;
  const a = domOf(s).agenda;
  const task = taskById(id)!;
  const br = AGENDA.find((b) => b.tasks.flat().some((x) => x.id === id))!;
  let ns = withDom(s, { agenda: { ...a, done: [...a.done, id] } });
  ns = bumpApproval(ns, 1);
  ns = { ...ns, officer: { ...ns.officer, fame: ns.officer.fame + 5 } };
  ns = domLog(ns, `${task.icon} 국정 과제 완수: ${task.name}`);
  if (branchDone(ns, br)) {
    ns = addPresMod(ns, `${br.icon} 공약 완수(${br.name})`, 6, 48);
    ns = { ...ns, officer: { ...ns.officer, fame: ns.officer.fame + 40 } };
    ns = domLog(ns, `🏆 공약 '${br.name}' 모두 지킴! 공약 하나를 더 고를 수 있어요`);
    ns = snap(ns, 'ceremony', `공약 완수: ${br.name}`, br.finale);
  }
  return ns;
}

/** 첫 단계 마감(공약 파기) 살피기: 실제 15분마다 */
export function agendaTick(s: GameState): GameState {
  if (!s.dom) return s;
  const a = s.dom.agenda;
  let ns = s;
  for (const id of a.pledges) {
    if (a.broken.includes(id)) continue;
    const br = branchById(id);
    if (tierOpen(ns, br, 1)) continue;
    if (ns.worldMs - (a.since[id] ?? ns.worldMs) < PLEDGE_DAYS * 24 * H) continue;
    const cur = domOf(ns).agenda;
    ns = withDom(ns, { agenda: { ...cur, broken: [...cur.broken, id] } });
    ns = bumpApproval(ns, -6);
    ns = { ...ns, officer: { ...ns.officer, trust: Math.max(0, ns.officer.trust - 3) } };
    ns = addPresMod(ns, `💢 공약 파기 논란(${br.name})`, -3, 48);
    ns = domLog(ns, `💢 '${br.name}' 첫 과제를 ${PLEDGE_DAYS}일 안에 못 지켜 공약 파기 논란`);
  }
  return ns;
}

/** 첫 단계 마감까지 남은 시간(이미 열렸으면 null) */
export function pledgeLeft(s: GameState, id: string): number | null {
  const a = domOf(s).agenda;
  if (a.broken.includes(id) || tierOpen(s, branchById(id), 1)) return null;
  return Math.max(0, (a.since[id] ?? s.worldMs) + PLEDGE_DAYS * 24 * H - s.worldMs);
}

export function fmtN(v: number): string {
  return Math.abs(v) >= 1000 ? Math.round(v).toLocaleString('ko-KR') : String(Math.round(v * 10) / 10);
}

registerDomRows((s, key) => {
  const a = s.dom!.agenda;
  if (!a.done.length) return [];
  let v = 0;
  for (const id of a.done) v += taskById(id)?.eff[key] ?? 0;
  const rows: Rows = v ? [['🏁 국정 과제', v]] : [];
  for (const id of a.pledges) {
    const f = FINALE[id]?.[key];
    if (f && branchDone(s, branchById(id))) rows.push([`🏆 공약 완수(${branchById(id).name})`, f]);
  }
  return rows;
});
