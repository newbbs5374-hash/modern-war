// 11-28 대장 결정 v2: 대통령 직속 비공식 기관 「그림자실」.
//  - 정적 처리 12가지(정적 1명을 골라 블랙 요원을 보냄) · 다른 나라가 먼저 끝낸 기술 탈취 · 외국 지도자 약점 · 비밀 자금 회수 등
//    지령 자체는 첩보 작전(spy.ts)과 같은 틀(잠입→실행→탈출 3단계·들킬 위험)을 씀. 여기는 효과와 다른 나라 블랙 작전·포로 외교.
//  - 다른 나라도 블랙 요원을 보냄: 내 기술·정적·장관·도시를 노림. 방첩에 걸리면 포로(전설 요원이면 큰 외교 카드).
import { TECHS, techById, type Tech } from '../data/civ';
import { COUNTRIES, countryById } from '../data/world';
import { CITIES } from '../data/cities';
import { addPresMod } from './approval';
import { addFavorNote, civOf } from './civ';
import { cabinetOf, counterOn } from './cabinet';
import { BOND_JOIN, addPrisoner, agentsOf, agencyOf, freeLegends, joinLegend, legendsOf, patchAgent, ransomOf, withAgents, HURT_MS, type Prisoner } from './agents';
import { ensureRivalRoster, hostile, influenceOf, roleOf } from './rivals';
import type { Rival } from './officer';
import { pushReport } from './report';
import { Rng } from './rng';
import { priceBase, type GameState } from './state';
import { isAlive, isRival, pairKey, relationOf } from './world';

const H = 3600e3;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/* ───────── 정적 처리 12가지 ───────── */
export type RivalMethod = 'expose' | 'woo' | 'defect' | 'accident' | 'probe' | 'wiretap' | 'aide' | 'fakenews' | 'cash' | 'family' | 'split' | 'frame';
export const RIVAL_METHODS: RivalMethod[] = ['wiretap', 'expose', 'fakenews', 'aide', 'cash', 'split', 'woo', 'probe', 'defect', 'frame', 'family', 'accident'];
/** 정적이 그 자리를 떠나는 방법(후임자가 약하게 들어옴) */
export const REMOVES: RivalMethod[] = ['defect', 'accident', 'probe', 'family', 'frame'];

/** 다른 나라가 이미 아는 기술(그 나라 기술 성장 + 강대국 덤으로 시대가 정해짐) */
const TECH_POWERS = ['us', 'cn', 'ru', 'jp', 'de', 'uk', 'fr', 'kr', 'il'];
export function aiEra(s: GameState, id: string): number {
  const lv = s.world.grow?.[id]?.lv.tech ?? 0;
  const n = s.nations[id];
  const rich = n && n.treasury > (s.nations[s.player.countryId]?.treasury ?? 0) * 1.5 ? 1 : 0;
  return clamp(1 + Math.floor(lv / 7) + (TECH_POWERS.includes(id) ? 1 : 0) + rich, 1, 4);
}
/** 그 나라가 먼저 끝냈고 우리가 바로 이어 받을 수 있는 기술(시대 높은 것부터) */
export function stealable(s: GameState, id: string): Tech[] {
  const done = civOf(s).done;
  const era = aiEra(s, id);
  return TECHS.filter((t) => t.era <= era && !done.includes(t.id) && t.needs.every((n) => done.includes(n))).sort((a, b) => b.era - a.era || b.hours - a.hours);
}
/** 기술 하나를 바로 손에 넣음 */
export function grantTech(s: GameState, id: string): GameState {
  const c = structuredClone(civOf(s));
  if (c.done.includes(id)) return s;
  c.done.push(id);
  if (c.cur.mil === id) c.cur.mil = null;
  if (c.cur.soc === id) c.cur.soc = null;
  delete c.progress[id];
  if (c.stage) delete c.stage[id];
  return { ...s, civ: c };
}

const rivalBy = (s: GameState, name: string | undefined) => s.officer.rivals.find((r) => r.name === name);
/** 정적 고칠 때 쓰는 복사본 */
function editRivals(s: GameState, fn: (list: Rival[]) => void): GameState {
  const rivals = s.officer.rivals.map((r) => ({ ...r }));
  fn(rivals);
  return { ...s, officer: { ...s.officer, rivals } };
}
/** 정적을 자리에서 내보내고 약한 후임자를 들임 */
function replaceRival(s: GameState, name: string): { state: GameState; next?: Rival } {
  const i = s.officer.rivals.findIndex((r) => r.name === name);
  if (i < 0) return { state: s };
  const role = roleOf(s.officer.rivals[i], i);
  let ns: GameState = { ...s, officer: { ...s.officer, rivals: s.officer.rivals.filter((_, j) => j !== i) } };
  ns = ensureRivalRoster(ns);
  const next = ns.officer.rivals.find((r, j) => roleOf(r, j) === role && r.name !== name);
  if (next) ns = editRivals(ns, (list) => { const n = list.find((r) => r.name === next.name)!; n.influence = 5; n.nextPlotMs = ns.worldMs + 48 * H; });
  return { state: ns, next };
}

/** 정적 처리 성공 효과 */
export function applyRivalMethod(s: GameState, method: RivalMethod, name: string): { state: GameState; text: string } {
  const rv = rivalBy(s, name);
  if (!rv) return { state: s, text: `${name}은 이미 자리에 없었어요.` };
  const i = s.officer.rivals.indexOf(rv);
  const role = roleOf(rv, i);
  const who = `${role} ${rv.name}`;
  const hit = (v: number) => editRivals(s, (list) => { const r = list.find((x) => x.name === name)!; r.influence = clamp(influenceOf(r) - v, 0, 100); });
  switch (method) {
    case 'wiretap': {
      const ns = editRivals(s, (list) => { const r = list.find((x) => x.name === name)!; r.watchUntil = s.worldMs + 72 * H; });
      return { state: { ...ns, officer: { ...ns.officer, intel: ns.officer.intel + 15 } }, text: `${who}의 전화를 72시간 엿들어요. 방해 공작을 미리 막고 정보 +15.` };
    }
    case 'expose':
      return { state: hit(40), text: `${who}의 숨은 비리가 1면에 실렸어요. 영향력 −40.` };
    case 'fakenews': {
      const ns = hit(15);
      return { state: addPresMod(ns, '🕶️ 여론 역공작', 3, 24), text: `${who}을 노린 여론 역공작이 먹혔어요. 영향력 −15 · 지지도 +3(하루).` };
    }
    case 'aide': {
      const ns = editRivals(hit(25), (list) => { const r = list.find((x) => x.name === name)!; r.nextPlotMs = Math.max(r.nextPlotMs ?? 0, s.worldMs + 48 * H); });
      return { state: ns, text: `${who}의 최측근이 우리 편이 됐어요. 영향력 −25 · 48시간 방해 공작 없음.` };
    }
    case 'cash': {
      const ns = editRivals(s, (list) => { const r = list.find((x) => x.name === name)!; r.rate = Math.round(r.rate * 0.5); r.influence = clamp(influenceOf(r) - 10, 0, 100); });
      return { state: ns, text: `${who}의 돈줄을 끊었어요. 영향력이 쌓이는 속도 절반 · 영향력 −10.` };
    }
    case 'split': {
      const other = hostile(s.officer).filter((r) => r.name !== name).sort((a, b) => influenceOf(b) - influenceOf(a))[0];
      const ns = editRivals(s, (list) => { for (const r of list) if (r.name === name || r.name === other?.name) r.influence = clamp(influenceOf(r) - 20, 0, 100); });
      return { state: ns, text: `${who}${other ? `과 ${other.name}` : ''} 사이에 싸움을 붙였어요. 둘 다 영향력 −20.` };
    }
    case 'woo': {
      const ns = editRivals(s, (list) => { const r = list.find((x) => x.name === name)!; r.ally = true; r.woo = 3; });
      return { state: ns, text: `${who}이 몰래 받은 돈에 무너졌어요. 이제 우리 편(협력)이에요.` };
    }
    default: {
      const r = replaceRival(s, name);
      const why: Record<string, string> = {
        probe: `${who}이 검찰 수사 끝에 구속됐어요.`,
        defect: `${who}이 해외로 망명했어요.`,
        frame: `${who}이 간첩 누명을 쓰고 정계에서 쫓겨났어요.`,
        family: `${who}이 "가족 문제"로 갑자기 정계를 떠났어요.`,
        accident: `${who}이 뜻밖의 사고로 정계에서 물러났어요.`,
      };
      let ns = r.state;
      if (method === 'probe') ns = addPresMod(ns, '⚖️ 비리 정치인 구속', 2, 48);
      return { state: ns, text: `${why[method]} ${r.next ? `후임 ${r.next.name}은 아직 힘이 없어요(영향력 5).` : ''}` };
    }
  }
}
/** 정적 처리가 들켰을 때: 지지도·의회 신뢰가 크게 깎이고, 다른 정적들이 뭉침 */
export function domesticScandal(s: GameState, approval: number, trust: number): GameState {
  let ns = addPresMod(s, '🚨 그림자실 공작 폭로', -approval, 24 * 7);
  ns = editRivals(ns, (list) => { for (const r of list) if (!r.ally) r.influence = clamp(influenceOf(r) + 8, 0, 100); });
  return { ...ns, officer: { ...ns.officer, trust: Math.max(0, ns.officer.trust - trust) } };
}

/* ───────── 다른 나라 블랙 작전 ───────── */
export const AI_GAP_H: [number, number] = [8, 14];
type AiOp = 'tech' | 'rival' | 'bribe' | 'sabotage' | 'leak';
const AI_OPS: Record<AiOp, string> = {
  tech: '연구소 서버를 털었어요',
  rival: '정적에게 몰래 돈을 댔어요',
  bribe: '장관 한 명을 매수하려 했어요',
  sabotage: '도시 방어 시설을 망가뜨렸어요',
  leak: '정부 비밀 문서를 언론에 흘렸어요',
};
/** 우리를 노릴 만한 나라(전쟁·긴장 45 넘음·숙적) */
export function shadowFoes(s: GameState): string[] {
  const me = s.player.countryId;
  return COUNTRIES.map((c) => c.id).filter((id) => id !== me && isAlive(s.world, id) && (relationOf(s.world, me, id) === '전쟁' || (s.world.pairs[pairKey(me, id)]?.tension ?? 0) >= 45 || isRival(me, id)));
}
/** 적 요원을 잡을 확률 */
export function catchChance(s: GameState, legend: boolean): number {
  const ag = agentsOf(s);
  const idle = ag.list.filter((a) => a.status === 'idle');
  return clamp(0.3 + 0.06 * Math.min(4, idle.length) + (idle.some((a) => a.legend) ? 0.1 : 0) + (counterOn(s) ? 0.2 : 0) - (legend ? 0.15 : 0), 0.1, 0.85);
}
export function aiShadowTick(s: GameState): GameState {
  const ag0 = s.agents;
  if (!ag0) return s;
  if (ag0.aiNextMs == null) return withAgents(s, { ...agentsOf(s), aiNextMs: s.worldMs + AI_GAP_H[0] * H });
  if (s.worldMs < ag0.aiNextMs) return s;
  const ag = agentsOf(s);
  const rng = new Rng((ag.seed ^ (s.worldMs >>> 7) ^ 0x5bd1e995) >>> 0);
  let ns = withAgents(s, { ...ag, aiNextMs: s.worldMs + (AI_GAP_H[0] + rng.next() * (AI_GAP_H[1] - AI_GAP_H[0])) * H });
  const foes = shadowFoes(ns);
  if (!foes.length || rng.next() < 0.35) return ns;
  const from = rng.pick(foes);
  const legends = freeLegends(ns, from);
  const L = legends.length && rng.next() < 0.4 ? rng.pick(legends) : null;
  const op = rng.pick(Object.keys(AI_OPS) as AiOp[]);
  const nm = countryById(from).name;
  const label = L ? `전설 요원 "${L.code}" ${L.name}` : '요원';
  if (rng.next() < catchChance(ns, !!L)) {
    ns = addPrisoner(ns, from, L ? { name: L.name, code: L.code, sex: L.sex, legend: true, photo: L.photo, key: L.key } : undefined);
    const p = agentsOf(ns).prisoners.at(-1)!;
    const text = `🚨 방첩: ${nm}의 ${L ? label : `요원 "${p.code}" ${p.name}`}을 붙잡았어요(${AI_OPS[op].replace('었어요', '려다').replace('했어요', '하려다')}). 그림자실 포로 칸에서 외교 카드로 써요.`;
    return logAi(pushReport(ns, { icon: '🚨', text }), text);
  }
  const me = ns.player.countryId;
  let detail = '';
  switch (op) {
    case 'tech': {
      const c = structuredClone(civOf(ns));
      const lost = Math.min(c.bank.mil, 6);
      c.bank.mil -= lost;
      const cur = c.cur.mil;
      if (!lost && cur) c.progress[cur] = (c.progress[cur] ?? 0) * 0.8;
      ns = { ...ns, civ: c };
      detail = '군사 연구가 늦어졌어요';
      break;
    }
    case 'rival': {
      const top = hostile(ns.officer).sort((a, b) => influenceOf(b) - influenceOf(a))[0];
      if (top) ns = editRivals(ns, (list) => { const r = list.find((x) => x.name === top.name)!; r.influence = clamp(influenceOf(r) + 12, 0, 100); });
      detail = top ? `정적 ${top.name} 영향력 +12` : '';
      break;
    }
    case 'bribe': {
      const cab = cabinetOf(ns);
      const ppl = cab.people.filter((p) => p.loyalty > 20);
      if (ppl.length) {
        const t = rng.pick(ppl);
        ns = { ...ns, cabinet: { ...cab, people: cab.people.map((p) => (p.id === t.id ? { ...p, loyalty: Math.max(0, p.loyalty - 12) } : p)) } };
        detail = `${t.name} 충성 −12`;
      }
      break;
    }
    case 'sabotage': {
      const mine = CITIES.filter((c) => ns.world.owner[c.id] === me);
      if (mine.length) {
        const c = rng.pick(mine);
        ns = { ...ns, world: { ...ns.world, defense: { ...ns.world.defense, [c.id]: ns.world.defense[c.id] * 0.85 } } };
        detail = `${c.name} 방어 −15%`;
      }
      break;
    }
    case 'leak':
      ns = addPresMod(ns, '🕵️ 비밀 문서 유출', -4, 24);
      detail = '지지도 −4(하루)';
      break;
  }
  const text = `🕵️ 누군가 ${AI_OPS[op]}${detail ? `(${detail})` : ''}. 흔적으로 보아 ${nm} 짓 같아요.`;
  return logAi(pushReport(ns, { icon: '🕵️', text }), text);
}
function logAi(s: GameState, text: string): GameState {
  const ag = agentsOf(s);
  return withAgents(s, { ...ag, alog: [text, ...(ag.alog ?? [])].slice(0, 8) });
}

/* ───────── 포로 다루기 ───────── */
export type PrisonerAct = 'ransom' | 'tech' | 'turn';
const prisonerAt = (s: GameState, i: number): Prisoner | undefined => agentsOf(s).prisoners[i];
export const turnChance = (p: Prisoner) => (p.legend ? 0.2 : 0.35);
export function canPrisoner(s: GameState, i: number, act: PrisonerAct): string | null {
  const p = prisonerAt(s, i);
  if (!p) return '포로가 없어요';
  if (!isAlive(s.world, p.country)) return '그 나라가 없어졌어요';
  if (act === 'turn' && p.tried) return '이미 전향을 시도했어요';
  return null;
}
function dropPrisoner(s: GameState, i: number): GameState {
  const ag = agentsOf(s);
  return withAgents(s, { ...ag, prisoners: ag.prisoners.filter((_, j) => j !== i) });
}
export function prisonerAct(s: GameState, i: number, act: PrisonerAct): { state: GameState; text: string } {
  const why = canPrisoner(s, i, act);
  if (why) return { state: s, text: why };
  const p = prisonerAt(s, i)!;
  const me = s.player.countryId;
  const nm = countryById(p.country).name;
  if (act === 'ransom') {
    const money = ransomOf(s, p.legend);
    let ns = dropPrisoner(s, i);
    ns = { ...ns, nations: { ...ns.nations, [me]: { ...ns.nations[me], treasury: ns.nations[me].treasury + money } } };
    ns = addFavorNote(ns, p.country, '포로를 돌려받음', 5);
    return { state: ns, text: `💰 ${nm}에서 배상금 ${money.toLocaleString('ko-KR')}을 받고 "${p.code}"을 돌려보냈어요(호감 +5).` };
  }
  if (act === 'tech') {
    const t = stealable(s, p.country)[0];
    let ns = dropPrisoner(s, i);
    ns = addFavorNote(ns, p.country, '포로를 돌려받음', 3);
    if (t) return { state: grantTech(ns, t.id), text: `🔬 ${nm}이 「${t.name}」 기술 자료를 넘기고 "${p.code}"을 데려갔어요.` };
    const c = structuredClone(civOf(ns));
    c.bank.mil += 8;
    c.bank.soc += 8;
    return { state: { ...ns, civ: c }, text: `🔬 ${nm}이 연구 자료를 넘기고 "${p.code}"을 데려갔어요(연구 8시간치씩).` };
  }
  // 전향
  const rng = new Rng((agentsOf(s).seed ^ (s.worldMs >>> 4) ^ (i * 7919)) >>> 0);
  if (rng.next() < turnChance(p)) {
    let ns = dropPrisoner(s, i);
    const l = p.key ? legendsOf(s, p.country).find((x) => x.key === p.key) : undefined;
    ns = joinLegend(ns, l ?? { key: `turned-${p.country}-${p.sinceMs}`, name: p.name, code: p.code, sex: p.sex, age: 28, photo: p.photo ?? (p.face ?? 0) % 16, trait: 'shadow', stats: { infil: 80, ops: 80, hush: 80 }, skills: ['infil', 'hack'], country: p.country }, agencyOf(p.country));
    if (!p.legend) ns = patchAgent(ns, agentsOf(ns).list.at(-1)!.id, { legend: false, lv: 3, trait: undefined, stats: undefined });
    ns = addFavorNote(ns, p.country, '우리 요원이 전향함', -10);
    const text = `🖤 ${nm}의 "${p.code}" ${p.name}이 전향해 그림자실 요원이 됐어요!`;
    return { state: pushReport(ns, { icon: '🖤', text }), text };
  }
  const ag = agentsOf(s);
  const ns = withAgents(s, { ...ag, prisoners: ag.prisoners.map((x, j) => (j === i ? { ...x, tried: true } : x)) });
  return { state: ns, text: `"${p.code}"은 끝내 입을 열지 않았어요. 전향 실패.` };
}
/** 붙잡힌 내 요원: 몸값을 내고 데려오기 */
export function canPayRansom(s: GameState, id: number): string | null {
  const a = agentsOf(s).list.find((x) => x.id === id);
  if (!a || a.status !== 'caught') return '붙잡힌 요원이 아니에요';
  if (s.nations[s.player.countryId].treasury < ransomOf(s, a.legend)) return '나라 예산이 모자라요';
  return null;
}
export function payRansom(s: GameState, id: number): { state: GameState; text: string } {
  const why = canPayRansom(s, id);
  if (why) return { state: s, text: why };
  const a = agentsOf(s).list.find((x) => x.id === id)!;
  const me = s.player.countryId;
  const cost = ransomOf(s, a.legend);
  let ns: GameState = { ...s, nations: { ...s.nations, [me]: { ...s.nations[me], treasury: s.nations[me].treasury - cost } } };
  if (a.where) ns = addFavorNote(ns, a.where, '몸값을 받음', 4);
  ns = patchAgent(ns, id, { status: 'hurt', untilMs: s.worldMs + HURT_MS, where: undefined });
  return { state: ns, text: `💸 몸값 ${cost.toLocaleString('ko-KR')}을 치르고 "${a.code}" ${a.name}을 데려왔어요(하루 쉬어요).` };
}

/** 화면용: 내 나라 정보기관 전설 요원(인연 포함) */
export function myLegendsView(s: GameState) {
  const ag = agentsOf(s);
  return freeLegends(s, s.player.countryId).map((l) => ({ ...l, bond: ag.bond?.[l.key] ?? 0, nextMs: ag.metMs?.[l.key] ?? 0, join: BOND_JOIN }));
}
/** 쓰는 값: 기술 이름 */
export const techName = (id: string) => techById(id)?.name ?? id;
export const priceOf = (s: GameState) => priceBase(s);
