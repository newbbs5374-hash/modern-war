// 첩보·특수 작전: 정보 점수와 나라 예산을 써서 다른 나라에 공작원을 보냄.
// 작전마다 걸리는 시간이 있고, 끝나면 성공/실패가 정해짐. 실패하면 들킨 나라 호감↓·긴장↑.
// 공작 팀 수 = 1 + 지도자 등급 4마다 1(최대 3). 성공률 = 기본 + (은밀+정보) 스탯.
import { originEff } from './origin';
import { cabSpy } from './cabinet';
import { lawEff } from './laws';
import { COUNTRIES, countryById } from '../data/world';
import { CITIES } from '../data/cities';
import { addFavorNote, civOf } from './civ';
import { Rng } from './rng';
import { pushReport } from './report';
import type { GameState } from './state';
import { isAlive, isRival, pairKey, relationOf, type WorldEvent } from './world';
import { HURT_MS, CAUGHT_MS, PICKS, addWeak, agentBonus, agentById, agentDone, agentRiskMul, agentsOf, bestAgent, bondRumor, caughtIn, hasSteps, patchAgent, withAgents, type StepPick } from './agents';
import { applyRivalMethod, domesticScandal, grantTech, stealable, type RivalMethod } from './shadow';
import { influenceOf } from './rivals';
import { specialsOf } from '../data/specials';

const H = 3600e3;

export type SpyOpId = 'scout' | 'sabotage' | 'secret' | 'steal' | 'rumor' | 'coup' | 'turn' | 'blueprint' | 'base' | 'rescue' | 'techsteal' | 'dirt' | 'fund'
  | 'r-wiretap' | 'r-expose' | 'r-fakenews' | 'r-aide' | 'r-cash' | 'r-split' | 'r-woo' | 'r-probe' | 'r-defect' | 'r-frame' | 'r-family' | 'r-accident';

export interface SpyOpDef {
  id: SpyOpId;
  name: string;
  icon: string;
  text: string;
  intel: number;
  money: number;
  hours: number;
  /** 기본 성공률 */
  base: number;
  /** 들키면 호감·긴장 */
  caught: { favor: number; tension: number };
  /** 이 등급부터 */
  rank: number;
  /** 11-28 v2 그림자실 지령(블랙 요원) · 나라 안 정적 처리(들키면 caught.favor = 지지도 −, caught.tension = 의회 신뢰 −) */
  shadow?: boolean;
  domestic?: boolean;
}

export const SPY_OPS: SpyOpDef[] = [
  { id: 'scout', name: '위성 정찰', icon: '🛰️', text: '그 나라 병력·나라 예산을 24시간 동안 봐요(늘 성공). 다른 작전 성공률 +5%.', intel: 5, money: 300, hours: 1, base: 1, caught: { favor: 0, tension: 0 }, rank: 0 },
  { id: 'secret', name: '지도자 비밀 캐기', icon: '📂', text: '약점을 잡아 조용히 압박해요. 성공하면 우리와 긴장 -20, 불만 장부 절반으로.', intel: 15, money: 800, hours: 3, base: 0.6, caught: { favor: -15, tension: 10 }, rank: 1 },
  { id: 'steal', name: '연구 자료 훔치기', icon: '💾', text: '해킹으로 연구 자료를 빼 와요. 성공하면 군사·사회 연구 각각 6시간치.', intel: 20, money: 1200, hours: 4, base: 0.55, caught: { favor: -15, tension: 10 }, rank: 2 },
  { id: 'rumor', name: '여론 공작', icon: '📢', text: '그 나라와 맞수 사이에 소문을 퍼뜨려요. 성공하면 두 나라 긴장 +15(우리에게서 눈을 돌림).', intel: 15, money: 1000, hours: 3, base: 0.6, caught: { favor: -12, tension: 8 }, rank: 2 },
  { id: 'sabotage', name: '군수공장 사보타주', icon: '💣', text: '공장을 멈춰요. 성공하면 그 나라 예산 -12%, 병력 -3%.', intel: 25, money: 1500, hours: 5, base: 0.5, caught: { favor: -25, tension: 20 }, rank: 3 },
  // 11-28 v2 그림자실 지령(블랙 요원): 해외 공작
  { id: 'techsteal', name: '기술 탈취', icon: '🧬', text: '그 나라가 먼저 끝낸 연구를 통째로 훔쳐 와요. 성공하면 그 기술을 바로 손에 넣어요.', intel: 30, money: 2400, hours: 8, base: 0.42, caught: { favor: -25, tension: 18 }, rank: 2, shadow: true },
  { id: 'dirt', name: '지도자 약점 잡기', icon: '📸', text: '외국 지도자의 비밀을 손에 쥐어요. 성공하면 4일 동안 그 나라와 협상 성공률 +15%p, 긴장 −10.', intel: 20, money: 1600, hours: 6, base: 0.5, caught: { favor: -20, tension: 15 }, rank: 1, shadow: true },
  { id: 'fund', name: '비밀 자금 회수', icon: '💼', text: '그 나라 비밀 계좌에서 돈을 빼 와요. 성공하면 그 나라 예산의 5%가 우리 예산으로.', intel: 20, money: 1200, hours: 6, base: 0.45, caught: { favor: -20, tension: 12 }, rank: 2, shadow: true },
  { id: 'turn', name: '요인 포섭', icon: '🤝', text: '적 장군을 몰래 우리 편으로 만들어요. 성공하면 48시간 동안 그 나라와의 3D 전투에서 적 체력·공격 −15%.', intel: 25, money: 1800, hours: 6, base: 0.5, caught: { favor: -20, tension: 15 }, rank: 2, shadow: true },
  { id: 'blueprint', name: '설계도 탈취', icon: '📐', text: '그 나라 특별 병과 설계도를 훔쳐요. 성공하면 그 특별 병과 1대가 우리 부대에 들어와요(없으면 군사 연구 10시간치).', intel: 30, money: 2000, hours: 6, base: 0.45, caught: { favor: -20, tension: 15 }, rank: 3, shadow: true },
  { id: 'base', name: '기지 잠입 폭파', icon: '🧨', text: '군 기지 탄약고를 터뜨려요. 성공하면 병력 −2%, 48시간 동안 그 나라와의 3D 전투에서 적 체력·공격 −20%.', intel: 30, money: 2200, hours: 6, base: 0.45, caught: { favor: -25, tension: 20 }, rank: 3, shadow: true },
  { id: 'rescue', name: '요원 구출', icon: '🚁', text: '그 나라에 붙잡힌 우리 요원을 빼내요.', intel: 20, money: 1500, hours: 5, base: 0.5, caught: { favor: -15, tension: 12 }, rank: 0, shadow: true },
  // 11-28 v2 그림자실 정적 처리 12가지(들키면 지지도·의회 신뢰가 크게 깎임)
  { id: 'r-wiretap', name: '도청', icon: '🎧', text: '정적 전화를 72시간 엿들어요. 그동안 방해 공작을 미리 막고 정보 +15.', intel: 10, money: 600, hours: 3, base: 0.7, caught: { favor: 8, tension: 4 }, rank: 0, shadow: true, domestic: true },
  { id: 'r-expose', name: '약점 폭로', icon: '📰', text: '숨은 비리를 언론에 흘려요. 영향력 −40.', intel: 15, money: 900, hours: 4, base: 0.6, caught: { favor: 10, tension: 5 }, rank: 0, shadow: true, domestic: true },
  { id: 'r-fakenews', name: '여론 역공작', icon: '💬', text: '기사·댓글로 정적을 깎아내려요. 영향력 −15, 지지도 +3(하루).', intel: 10, money: 800, hours: 3, base: 0.65, caught: { favor: 8, tension: 3 }, rank: 0, shadow: true, domestic: true },
  { id: 'r-aide', name: '측근 매수', icon: '🤫', text: '정적의 최측근을 우리 편으로. 영향력 −25, 48시간 방해 공작 없음.', intel: 15, money: 1400, hours: 5, base: 0.55, caught: { favor: 12, tension: 6 }, rank: 1, shadow: true, domestic: true },
  { id: 'r-cash', name: '자금줄 차단', icon: '🏦', text: '후원금 줄을 끊어요. 영향력 쌓이는 속도 절반, 영향력 −10.', intel: 15, money: 1200, hours: 5, base: 0.55, caught: { favor: 10, tension: 6 }, rank: 1, shadow: true, domestic: true },
  { id: 'r-split', name: '내분 조장', icon: '🪓', text: '가장 센 다른 정적과 싸움을 붙여요. 둘 다 영향력 −20.', intel: 15, money: 1000, hours: 4, base: 0.55, caught: { favor: 10, tension: 5 }, rank: 1, shadow: true, domestic: true },
  { id: 'r-woo', name: '돈으로 회유', icon: '💰', text: '거절 못 할 돈을 건네요. 성공하면 바로 우리 편(협력).', intel: 20, money: 2500, hours: 6, base: 0.45, caught: { favor: 15, tension: 8 }, rank: 2, shadow: true, domestic: true },
  { id: 'r-probe', name: '비리 수사 유도', icon: '⚖️', text: '증거를 검찰에 넘겨 구속시켜요. 정적이 물러나고 약한 후임이 들어와요. 지지도 +2(이틀).', intel: 20, money: 1800, hours: 8, base: 0.45, caught: { favor: 15, tension: 8 }, rank: 2, shadow: true, domestic: true },
  { id: 'r-defect', name: '망명 유도', icon: '✈️', text: '해외로 떠나게 만들어요. 정적이 물러나고 약한 후임이 들어와요.', intel: 25, money: 2200, hours: 8, base: 0.42, caught: { favor: 18, tension: 8 }, rank: 3, shadow: true, domestic: true },
  { id: 'r-frame', name: '누명 씌우기', icon: '🧾', text: '간첩 누명으로 정계에서 쫓아내요. 정적이 물러나고 약한 후임이 들어와요.', intel: 25, money: 2400, hours: 8, base: 0.4, caught: { favor: 22, tension: 10 }, rank: 3, shadow: true, domestic: true },
  { id: 'r-family', name: '가족 압박', icon: '🕯️', text: '가족을 빌미로 스스로 물러나게 해요. 정적이 물러나고 약한 후임이 들어와요.', intel: 25, money: 1800, hours: 6, base: 0.42, caught: { favor: 25, tension: 12 }, rank: 4, shadow: true, domestic: true },
  { id: 'r-accident', name: '사고 위장', icon: '🚗', text: '뜻밖의 사고로 정계에서 물러나게 해요. 정적이 물러나고 약한 후임이 들어와요. 들키면 가장 위험해요.', intel: 30, money: 3000, hours: 10, base: 0.38, caught: { favor: 30, tension: 15 }, rank: 5, shadow: true, domestic: true },
  { id: 'coup', name: '반란 지원', icon: '🔥', text: '그 나라 점령지 반군을 몰래 도와요. 성공하면 그 나라가 가진 남의 도시 하나 방어가 크게 떨어짐.', intel: 35, money: 2500, hours: 8, base: 0.4, caught: { favor: -30, tension: 25 }, rank: 5 },
];
export const spyOpById = (id: SpyOpId) => SPY_OPS.find((x) => x.id === id)!;

export interface SpyMission {
  id: number;
  op: SpyOpId;
  target: string;
  startMs: number;
  endMs: number;
  /** 시작 때 성공률(11-28: 끝날 때 다시 재지 않음) */
  chance?: number;
  /** 11-28 보낸 요원 */
  agent?: number;
  /** 11-28 잠입·실행·탈출 단계마다 고른 것(안 고르면 조용히) */
  picks?: (StepPick | null)[];
  /** 11-28 v2 정적 처리 대상(이름) */
  rival?: string;
}
export interface SpyState {
  active: SpyMission[];
  /** 위성 정찰: 나라 → 이 시각까지 보임 */
  scout: Record<string, number>;
  log: string[];
  nextId: number;
  done: number;
  ok: number;
}
export const newSpy = (): SpyState => ({ active: [], scout: {}, log: [], nextId: 1, done: 0, ok: 0 });
export const spyOf = (s: GameState): SpyState => s.spy ?? newSpy();

export const spyTeams = (s: GameState) => Math.min(3, 1 + Math.floor(s.player.rankIndex / 4));
export const scouted = (s: GameState, id: string) => (spyOf(s).scout[id] ?? 0) > s.worldMs;
/** 11-28 정보 신선도 0~1: 정찰 직후 1, 24시간 동안 줄어 0(낡음) */
export const intelFresh = (s: GameState, id: string) => Math.max(0, Math.min(1, ((spyOf(s).scout[id] ?? 0) - s.worldMs) / (24 * H)));
/** 신선한 정보가 주는 다른 공작 성공률 덤(최대 +10%p) */
export const INTEL_BONUS = 0.1;

/** 성공률(0~0.95) */
export function spyChance(s: GameState, op: SpyOpId, target: string, agentId?: number, rival?: string): number {
  const d = spyOpById(op);
  if (d.base >= 1) return 1;
  const ag = hasSteps(op) ? (agentId != null ? agentById(s, agentId) : bestAgent(s, op)) : undefined;
  const st = s.officer.stats;
  const skill = ((st['은밀'] ?? 8) + (st['정보'] ?? 8)) / 2;
  if (d.domestic) { // 정적 처리: 영향력이 클수록 어려움
    const rv = s.officer.rivals.find((r) => r.name === rival);
    const inf = rv ? influenceOf(rv) : 50;
    return Math.max(0.1, Math.min(0.95, d.base + skill * 0.004 + (50 - inf) / 400 + agentBonus(ag, op)));
  }
  const watch = relationOf(s.world, s.player.countryId, target) === '전쟁' ? -0.05 : 0; // 전쟁 중엔 경계가 심함
  const scout = op === 'scout' ? 0 : INTEL_BONUS * intelFresh(s, target); // 11-28 정보가 신선할수록(정찰 직후) 덤, 낡으면 사라짐
  return Math.max(0.1, Math.min(0.95, d.base + skill * 0.004 + watch + scout + originEff(s, 'spy') + cabSpy(s) + lawEff(s, 'spy') + agentBonus(ag, op)));
}

export function canSpy(s: GameState, op: SpyOpId, target: string, agentId?: number, rival?: string): string | null {
  const d = spyOpById(op);
  const me = s.player.countryId;
  if (d.domestic) {
    const rv = s.officer.rivals.find((r) => r.name === rival);
    if (!rv || rv.ally) return '정적을 골라요';
    if (spyOf(s).active.some((m) => m.rival === rival)) return '이 정적에게는 이미 지령이 나가 있어요';
  } else if (target === me || !isAlive(s.world, target)) return '고를 수 없는 나라';
  if (s.player.rankIndex < d.rank) return '호칭이 더 올라야 해요';
  const sp = spyOf(s);
  if (sp.active.length >= spyTeams(s)) return `공작 팀 ${spyTeams(s)}개가 모두 나가 있어요`;
  if (!d.domestic && sp.active.some((m) => m.target === target && m.op === op)) return '이미 같은 작전 중이에요';
  if (s.officer.intel < d.intel) return `정보 점수 ${d.intel} 필요`;
  if (s.nations[me].treasury < d.money) return `나라 예산 ${d.money.toLocaleString('ko-KR')} 필요`;
  if (op === 'coup' && !coupCity(s, target)) return '그 나라는 남의 도시를 가지고 있지 않아요';
  if (op === 'rescue' && !caughtIn(s, target).length) return '그 나라에 붙잡힌 요원이 없어요';
  if (op === 'techsteal' && !stealable(s, target).length) return '그 나라에는 우리보다 앞선 기술이 없어요';
  if (hasSteps(op)) {
    if (agentId != null) {
      const a = agentById(s, agentId);
      if (!a || a.status !== 'idle') return '그 요원은 지금 보낼 수 없어요';
    } else if (!bestAgent(s, op)) return '쉬고 있는 요원이 없어요';
  }
  return null;
}

/** 반란 지원 대상: 그 나라가 점령한(원래 남의) 도시 중 방어가 가장 낮은 곳 */
function coupCity(s: GameState, target: string): string | null {
  const ids = CITIES.filter((c) => s.world.owner[c.id] === target && c.home !== target).map((c) => c.id);
  if (!ids.length) return null;
  return ids.sort((a, b) => s.world.defense[a] - s.world.defense[b])[0];
}

export function startSpy(s: GameState, op: SpyOpId, target: string, agentId?: number, rival?: string): GameState {
  if (spyOpById(op).domestic) target = s.player.countryId;
  if (canSpy(s, op, target, agentId, rival)) return s;
  const d = spyOpById(op);
  const me = s.player.countryId;
  const sp = spyOf(s);
  const agent = hasSteps(op) ? (agentId ?? bestAgent(s, op)?.id) : undefined;
  const m: SpyMission = { id: sp.nextId, op, target, startMs: s.worldMs, endMs: s.worldMs + d.hours * H, chance: spyChance(s, op, target, agent, rival) };
  if (rival) m.rival = rival;
  if (agent != null) {
    m.agent = agent;
    m.picks = [null, null, null];
    s = patchAgent(s, agent, { status: 'busy' });
  }
  return {
    ...s,
    nations: { ...s.nations, [me]: { ...s.nations[me], treasury: s.nations[me].treasury - d.money } },
    officer: { ...s.officer, intel: s.officer.intel - d.intel },
    spy: { ...sp, active: [...sp.active, m], nextId: sp.nextId + 1 },
  };
}

function addEvent(s: GameState, text: string): GameState {
  const ev: WorldEvent = { t: s.worldMs, kind: '외교', text, mine: true };
  return { ...s, world: { ...s.world, events: [ev, ...s.world.events].slice(0, 200) } };
}
function tension(s: GameState, a: string, b: string, v: number): GameState {
  const k = pairKey(a, b);
  const p = s.world.pairs[k];
  if (!p || p.rel === '전쟁') return s;
  return { ...s, world: { ...s.world, pairs: { ...s.world.pairs, [k]: { ...p, tension: Math.max(0, Math.min(100, p.tension + v)) } } } };
}

/** 작전 하나 끝내기 */
function finish(s: GameState, m: SpyMission): GameState {
  if (spyOpById(m.op).domestic) return finishDomestic(s, m);
  const d = spyOpById(m.op);
  const me = s.player.countryId;
  const name = countryById(m.target).name;
  const rng = new Rng((m.id * 2654435761 + s.world.seed + m.startMs) >>> 0);
  const eff = missionOdds(s, m);
  const ok = rng.next() < eff.chance; // 11-28 시작 때 보여 준 확률 + 단계마다 고른 것
  const exposed = m.agent != null && rng.next() * 100 < eff.risk;
  const agent = agentById(s, m.agent);
  let ns = s;
  let text: string;
  if (ok) {
    switch (m.op) {
      case 'scout':
        ns = { ...ns, spy: { ...spyOf(ns), scout: { ...spyOf(ns).scout, [m.target]: ns.worldMs + 24 * H } } };
        text = `${name} 정찰 사진이 들어왔어요. 24시간 동안 병력·예산이 보여요.`;
        break;
      case 'secret': {
        ns = tension(ns, me, m.target, -20);
        const c = structuredClone(civOf(ns));
        c.grievance[m.target] = (c.grievance[m.target] ?? 0) / 2;
        ns = { ...ns, civ: c };
        text = `${name} 지도자의 약점을 잡았어요. 우리에게 한결 조심스러워졌어요.`;
        break;
      }
      case 'steal': {
        const c = structuredClone(civOf(ns));
        c.bank.mil += 6;
        c.bank.soc += 6;
        ns = { ...ns, civ: c };
        text = `${name}의 연구 자료를 손에 넣었어요. 연구가 빨라져요.`;
        break;
      }
      case 'rumor': {
        const foes = COUNTRIES.map((x) => x.id).filter((id) => id !== m.target && id !== me && isAlive(ns.world, id) && isRival(m.target, id));
        const foe = foes[0] ?? COUNTRIES.map((x) => x.id).find((id) => id !== m.target && id !== me && isAlive(ns.world, id));
        if (foe) ns = tension(ns, m.target, foe, 15);
        text = `${name}${foe ? `와 ${countryById(foe).name}` : ''} 사이에 의심이 퍼졌어요.`;
        break;
      }
      case 'sabotage': {
        const n = ns.nations[m.target];
        ns = { ...ns, nations: { ...ns.nations, [m.target]: { ...n, treasury: n.treasury * 0.88, troops: n.troops * 0.97 } } };
        text = `${name} 군수공장이 멈췄어요! 예산 -12%, 병력 -3%.`;
        break;
      }
      case 'coup': {
        const city = coupCity(ns, m.target);
        if (city) ns = { ...ns, world: { ...ns.world, defense: { ...ns.world.defense, [city]: Math.max(0, ns.world.defense[city] * 0.4) } } };
        text = `${name} 점령지 반군이 들고일어났어요. 그 도시 방어가 크게 떨어졌어요.`;
        break;
      }
      case 'turn':
        ns = addWeak(ns, m.target, 0.85);
        text = `${name} 장군 한 명이 우리 편이 됐어요. 48시간 동안 ${name}군이 3D 전투에서 약해져요(−15%).`;
        break;
      case 'blueprint': {
        const sp0 = specialsOf(m.target)[0];
        if (sp0) {
          ns = { ...ns, economy: { ...ns.economy, army: { ...ns.economy.army, [sp0.name]: (ns.economy.army[sp0.name] ?? 0) + 1 } } };
          text = `${name}의 「${sp0.name}」 설계도를 손에 넣었어요! 우리 부대에 1대가 들어왔어요.`;
        } else {
          const c = structuredClone(civOf(ns));
          c.bank.mil += 10;
          ns = { ...ns, civ: c };
          text = `${name}의 무기 설계도를 손에 넣었어요. 군사 연구가 빨라져요.`;
        }
        break;
      }
      case 'base': {
        const n = ns.nations[m.target];
        ns = { ...ns, nations: { ...ns.nations, [m.target]: { ...n, troops: n.troops * 0.98 } } };
        ns = addWeak(ns, m.target, 0.8);
        text = `${name} 군 기지 탄약고가 터졌어요! 병력 −2%, 48시간 동안 ${name}군이 3D 전투에서 약해져요(−20%).`;
        break;
      }
      case 'techsteal': {
        const t = stealable(ns, m.target)[0];
        if (t) {
          ns = grantTech(ns, t.id);
          text = `${name}의 「${t.name}」 기술을 통째로 손에 넣었어요!`;
        } else {
          const c = structuredClone(civOf(ns));
          c.bank.mil += 10;
          ns = { ...ns, civ: c };
          text = `${name}의 연구 자료를 손에 넣었어요(군사 연구 10시간치).`;
        }
        break;
      }
      case 'dirt': {
        ns = tension(ns, me, m.target, -10);
        const ag = agentsOf(ns);
        ns = withAgents(ns, { ...ag, leverage: { ...(ag.leverage ?? {}), [m.target]: ns.worldMs + 96 * H } });
        text = `${name} 지도자의 비밀을 손에 쥐었어요. 4일 동안 ${name}과의 협상 성공률 +15%p.`;
        break;
      }
      case 'fund': {
        const n = ns.nations[m.target];
        const got = Math.round(n.treasury * 0.05);
        ns = { ...ns, nations: { ...ns.nations, [m.target]: { ...n, treasury: n.treasury - got }, [me]: { ...ns.nations[me], treasury: ns.nations[me].treasury + got } } };
        text = `${name}의 비밀 계좌에서 ${got.toLocaleString('ko-KR')}을 빼 왔어요.`;
        break;
      }
      case 'rescue': {
        const who = caughtIn(ns, m.target)[0];
        if (who) ns = patchAgent(ns, who.id, { status: 'hurt', untilMs: ns.worldMs + HURT_MS, where: undefined });
        text = who ? `"${who.code}" ${who.name}을 ${name}에서 빼냈어요! 하루 쉬면 다시 나갈 수 있어요.` : `구출하러 갔지만 이미 풀려나 있었어요.`;
        break;
      }      default:
        text = `${d.name} 성공.`;
    }
    if (exposed) {
      ns = addFavorNote(ns, m.target, '첩보 작전이 들킴', Math.round(d.caught.favor / 2));
      text += ` 다만 빠져나오다 얼굴이 찍혔어요(호감 ${Math.round(d.caught.favor / 2)}).`;
    }
  } else {
    ns = addFavorNote(ns, m.target, '첩보 작전이 들킴', d.caught.favor);
    ns = tension(ns, me, m.target, d.caught.tension);
    text = `${d.name} 실패… ${name}에 공작원이 들켰어요. 호감 ${d.caught.favor}, 긴장 +${d.caught.tension}.`;
    if (agent && exposed) text += ` "${agent.code}" ${agent.name}이 붙잡혔어요! 구출 작전이나 포로 교환으로 데려와야 해요.`;
  }
  if (agent) {
    const after = !ok && exposed ? { status: 'caught' as const, untilMs: ns.worldMs + CAUGHT_MS, where: m.target } : exposed ? { status: 'hurt' as const, untilMs: ns.worldMs + HURT_MS } : { status: 'idle' as const };
    const r = agentDone(ns, agent.id, ok, after);
    ns = r.state;
    if (r.up) text += ` "${agent.code}" 등급이 올랐어요(★${agent.lv + 1}).`;
  }
  if (ok && d.shadow) ns = bondRumor(ns, 6);
  const sp = spyOf(ns);
  ns = { ...ns, spy: { ...sp, active: sp.active.filter((x) => x.id !== m.id), log: [`${ok ? '✅' : '❌'} ${d.icon} ${text}`, ...sp.log].slice(0, 10), done: sp.done + 1, ok: sp.ok + (ok ? 1 : 0) } };
  if (!ok || m.op !== 'scout') ns = addEvent(ns, `${d.icon} ${ok ? '' : '들킴: '}${text}`);
  return pushReport(ns, { icon: ok ? d.icon : '🚨', text });
}

/** 11-28 v2 정적 처리 끝내기: 성공하면 효과, 들키면 국내 스캔들 */
function finishDomestic(s: GameState, m: SpyMission): GameState {
  const d = spyOpById(m.op);
  const rng = new Rng((m.id * 2654435761 + s.world.seed + m.startMs) >>> 0);
  const eff = missionOdds(s, m);
  const ok = rng.next() < eff.chance;
  const exposed = rng.next() * 100 < eff.risk;
  const agent = agentById(s, m.agent);
  let ns = s;
  let text: string;
  if (ok) {
    const r = applyRivalMethod(ns, m.op.slice(2) as RivalMethod, m.rival ?? '');
    ns = r.state;
    text = r.text;
  } else text = `${d.name} 실패… ${m.rival ?? '정적'}이 눈치챘어요.`;
  if (exposed && !ok) {
    ns = domesticScandal(ns, d.caught.favor, d.caught.tension);
    text += ` 그림자실 공작이 폭로됐어요! 지지도 −${d.caught.favor}(7일) · 의회 신뢰 −${d.caught.tension} · 정적들 영향력 +8.`;
  } else if (exposed) {
    ns = domesticScandal(ns, Math.round(d.caught.favor / 2), Math.round(d.caught.tension / 2));
    text += ` 다만 기자가 뒤를 밟았어요(지지도 −${Math.round(d.caught.favor / 2)}).`;
  }
  if (agent) {
    const after = !ok && exposed ? { status: 'hurt' as const, untilMs: ns.worldMs + HURT_MS * 3 } : exposed ? { status: 'hurt' as const, untilMs: ns.worldMs + HURT_MS } : { status: 'idle' as const };
    if (!ok && exposed) text += ` "${agent.code}"은 경찰에 잡혔다가 그림자실이 몰래 빼냈어요(사흘 쉼).`;
    const r = agentDone(ns, agent.id, ok, after);
    ns = r.state;
    if (r.up) text += ` "${agent.code}" 등급이 올랐어요(★${agent.lv + 1}).`;
  }
  if (ok) ns = bondRumor(ns, 6);
  const sp = spyOf(ns);
  ns = { ...ns, spy: { ...sp, active: sp.active.filter((x) => x.id !== m.id), log: [`${ok ? '✅' : '❌'} ${d.icon} ${text}`, ...sp.log].slice(0, 10), done: sp.done + 1, ok: sp.ok + (ok ? 1 : 0) } };
  return pushReport(ns, { icon: ok ? '🕶️' : '🚨', text });
}

/** 11-28 지금 몇 번째 단계인지(0 잠입 · 1 실행 · 2 탈출) */
export const missionStep = (s: GameState, m: SpyMission) => Math.max(0, Math.min(2, Math.floor(((s.worldMs - m.startMs) / Math.max(1, m.endMs - m.startMs)) * 3)));
/** 고른 것까지 더한 성공률·들킬 위험(%) */
export function missionOdds(s: GameState, m: SpyMission): { chance: number; risk: number } {
  const d = spyOpById(m.op);
  let chance = m.chance ?? spyChance(s, m.op, m.target, m.agent, m.rival);
  if (m.agent == null) return { chance, risk: 0 };
  let risk = 10 + d.caught.tension;
  for (const p of m.picks ?? []) {
    const k = PICKS[p ?? 'quiet'];
    chance += k.chance;
    risk += k.risk;
  }
  risk *= agentRiskMul(agentById(s, m.agent));
  chance = Math.max(0.05, Math.min(0.95, chance));
  return { chance, risk: Math.max(0, Math.min(95, risk)) };
}
export const pickCost = (m: SpyMission) => Math.round(spyOpById(m.op).money * PICKS.bribe.money);
export function canPick(s: GameState, id: number, pick: StepPick): string | null {
  const m = spyOf(s).active.find((x) => x.id === id);
  if (!m || m.agent == null || !m.picks) return '요원 작전이 아니에요';
  const st = missionStep(s, m);
  if (m.picks[st]) return '이 단계는 이미 골랐어요';
  if (pick === 'bribe' && s.nations[s.player.countryId].treasury < pickCost(m)) return '나라 예산이 모자라요';
  return null;
}
/** 지금 단계에서 고르기 */
export function pickStep(s: GameState, id: number, pick: StepPick): GameState {
  if (canPick(s, id, pick)) return s;
  const sp = spyOf(s);
  const me = s.player.countryId;
  let ns = s;
  const active = sp.active.map((m) => {
    if (m.id !== id) return m;
    const picks = [...(m.picks ?? [null, null, null])];
    picks[missionStep(s, m)] = pick;
    return { ...m, picks };
  });
  if (pick === 'bribe') {
    const m = sp.active.find((x) => x.id === id)!;
    ns = { ...ns, nations: { ...ns.nations, [me]: { ...ns.nations[me], treasury: ns.nations[me].treasury - pickCost(m) } } };
  }
  return { ...ns, spy: { ...spyOf(ns), active } };
}

/** 시간이 흐를 때: 끝난 작전 처리 */
export function spyTick(s: GameState): GameState {
  const sp = s.spy;
  if (!sp || !sp.active.length) return s;
  let ns = s;
  for (const m of sp.active) if (s.worldMs >= m.endMs) ns = finish(ns, m);
  return ns;
}

/** 위성 정찰로 보이는 숫자 */
export function scoutView(s: GameState, id: string) {
  if (!scouted(s, id)) return null;
  const n = s.nations[id];
  return { treasury: Math.round(n.treasury), troops: Math.round(n.troops), untilMs: spyOf(s).scout[id] };
}
