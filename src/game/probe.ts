// 안 4 감사·수사·국정감사(11/26)
// - 비리 의혹: 실제 20~36시간마다 자리에 앉은 장관·참모 한 명에게 의혹(숨은 특성 '비리 전력'이면 잘 걸림). 12시간 안에 감싸기·수사·경질.
// - 정적 수사: 검찰총장·감사원장 능력으로 정적 영향력을 깎음(48시간마다). 정치 보복 논란으로 시민단체·언론이 싫어함.
// - 국정감사: 실제 7일마다 하루 동안 야당 질문 3개. 자료 공개·장관 답변·답변 거부 중 하나.
import { addPresMod } from './approval';
import { cabinetOf, ministryPower, postPower } from './cabinet';
import { atWar } from './codes';
import { domOf, payTreasury, registerDomRows, snap, withDom } from './domestic';
import { baseOf, econOf } from './econ';
import { DAY, H, bumpTrust, clamp, polityOf, polityLog, roll, tell, withPolity, type Audit, type Scandal } from './polity';
import { budgetPerDay, type GameState } from './state';
import { ministryById, type MinistryId } from '../data/cabinet';
import { postById } from '../data/staff';

export const SCANDAL_MS = 12 * H;
export const SCANDAL_GAP_H: [number, number] = [20, 36];
export const PROBE_WAIT_MS = 2 * DAY;
export const AUDIT_GAP_MS = 7 * DAY;
export const AUDIT_MS = DAY;
export const SCANDAL_KINDS = ['땅 투기', '자녀 채용 특혜', '뇌물 수수', '논문 표절', '세금 탈루', '부하 갑질', '해외 비자금'];

export const scandalOf = (s: GameState): Scandal | null => polityOf(s).scandal;
export const scandalPerson = (s: GameState) => {
  const sc = scandalOf(s);
  return sc ? (cabinetOf(s).people.find((p) => p.id === sc.pid) ?? null) : null;
};
export function seatName(s: GameState, pid: number): string {
  const p = cabinetOf(s).people.find((x) => x.id === pid);
  if (!p) return '';
  if (p.seat) return `${ministryById(p.seat.id).short} ${p.seat.kind === 'min' ? '장관' : '차관'}`;
  if (p.post) return postById(p.post).name;
  return p.title ?? '';
}

/** 자리에서 내림(부처·참모 모두) · 충성 */
function unseatAny(s: GameState, pid: number, loyalty: number): GameState {
  const c = cabinetOf(s);
  const people = c.people.map((p) => (p.id === pid ? { ...p, seat: null, post: undefined, loyalty: clamp(p.loyalty + loyalty) } : p));
  return { ...s, cabinet: { ...c, people } };
}
function addLoyalty(s: GameState, pid: number, v: number): GameState {
  const c = cabinetOf(s);
  return { ...s, cabinet: { ...c, people: c.people.map((p) => (p.id === pid ? { ...p, loyalty: clamp(p.loyalty + v) } : p)) } };
}
function groupMod(s: GameState, g: string, v: number, hours: number, why: string): GameState {
  const d = domOf(s);
  return withDom(s, { groups: { ...d.groups, mods: [...d.groups.mods.filter((m) => m.untilMs > s.worldMs), { g, v, untilMs: s.worldMs + hours * H, why }] } });
}

export type ScandalPick = 'cover' | 'probe' | 'fire';
export function probePower(s: GameState): number {
  return Math.min(1.6, postPower(s, 'pros') + postPower(s, 'audit') * 0.5);
}
export function scandalChance(s: GameState): number {
  return clamp(0.55 + probePower(s) * 0.25, 0.3, 0.95);
}
export function answerScandal(s: GameState, pick: ScandalPick): GameState {
  const sc = scandalOf(s);
  const person = scandalPerson(s);
  if (!sc) return s;
  let ns = s;
  const who = person ? `${seatName(ns, sc.pid)} ${person.name}` : '그 인사';
  let r: number;
  [r, ns] = roll(ns);
  const guilty = r < sc.evidence * 0.3;
  if (pick === 'cover') {
    ns = addLoyalty(ns, sc.pid, 15);
    ns = addPresMod(ns, `🛡️ ${who} 감싸기`, -sc.evidence * 2, 24);
    let r2: number;
    [r2, ns] = roll(ns);
    if (guilty && r2 < 0.5) {
      ns = addPresMod(ns, `📰 ${who} 추가 폭로`, -4, 48);
      ns = bumpTrust(ns, -3);
      ns = tell(ns, `📰 감싸던 ${who}의 비리가 더 드러났어요! 지지도 −4 · 신뢰도 −3`);
    } else ns = tell(ns, `🛡️ ${who}을(를) 감쌌어요. 충성 +15 · 지지도 −${sc.evidence * 2}`);
  } else if (pick === 'probe') {
    let r2: number;
    [r2, ns] = roll(ns);
    if (guilty && r2 < scandalChance(ns)) {
      ns = unseatAny(ns, sc.pid, -30);
      ns = addPresMod(ns, `⚖️ ${who} 비리 밝혀냄`, 4, 48);
      ns = groupMod(ns, 'press', 6, 48, '⚖️ 성역 없는 수사');
      ns = groupMod(ns, 'civic', 4, 48, '⚖️ 성역 없는 수사');
      ns = tell(ns, `⚖️ 수사로 ${who}의 비리를 밝혀 자리에서 내보냈어요. 지지도 +4`);
    } else if (guilty) {
      ns = addPresMod(ns, `⚖️ ${who} 봐주기 수사 논란`, -3, 24);
      ns = tell(ns, `⚖️ ${who} 수사가 흐지부지 끝났어요(증거 부족). 봐주기 논란 지지도 −3`);
    } else {
      ns = addLoyalty(ns, sc.pid, -10);
      ns = addPresMod(ns, `⚖️ ${who} 무혐의`, 1, 24);
      ns = tell(ns, `⚖️ ${who}은(는) 무혐의였어요. 본인은 서운해해요(충성 −10).`);
    }
  } else {
    ns = unseatAny(ns, sc.pid, -20);
    ns = addPresMod(ns, `✂️ ${who} 경질`, 2, 24);
    ns = tell(ns, `✂️ ${who}을(를) 경질했어요. 지지도 +2 · 자리가 비었어요`);
  }
  const pick0 = { cover: '감싸기', probe: '수사', fire: '경질' }[pick];
  ns = polityLog(ns, `🔍 ${who} ${sc.kind} 의혹 → ${pick0}`);
  let gap: number;
  [gap, ns] = roll(ns);
  return withPolity(ns, { scandal: null, scandalMs: ns.worldMs + (SCANDAL_GAP_H[0] + (SCANDAL_GAP_H[1] - SCANDAL_GAP_H[0]) * gap) * H });
}

/* 정적 수사 */
export const rivalProbeCost = (s: GameState) => Math.round(budgetPerDay(s, s.player.countryId));
export const rivalProbeChance = (s: GameState) => clamp(0.3 + probePower(s) * 0.3, 0.2, 0.85);
export function canProbeRival(s: GameState, idx: number): string | null {
  if (!s.polity) return '아직 준비 중이에요';
  const rv = s.officer.rivals[idx];
  if (!rv || rv.ally) return '수사할 정적이 아니에요';
  if (polityOf(s).probeMs > s.worldMs) return '정적 수사는 48시간마다 할 수 있어요';
  const me = s.nations[s.player.countryId];
  if (!me || me.treasury < rivalProbeCost(s)) return '나라 예산이 모자라요';
  return null;
}
export function probeRival(s: GameState, idx: number): GameState {
  if (canProbeRival(s, idx)) return s;
  let ns = payTreasury(s, rivalProbeCost(s)) ?? s;
  const rv = ns.officer.rivals[idx];
  let r: number;
  [r, ns] = roll(ns);
  const ok = r < rivalProbeChance(ns);
  const base = rv.influence ?? clamp(Math.round(25 + (rv.rate - 170) / 4));
  const rivals = ns.officer.rivals.map((x, i) => (i === idx ? { ...x, influence: clamp(base + (ok ? -25 : 10)) } : x));
  ns = { ...ns, officer: { ...ns.officer, rivals } };
  ns = groupMod(ns, 'civic', -6, 24, '⚖️ 정치 보복 논란');
  ns = groupMod(ns, 'press', -6, 24, '⚖️ 정치 보복 논란');
  ns = addPresMod(ns, '⚖️ 정치 보복 논란', -2, 24);
  ns = withPolity(ns, { probeMs: ns.worldMs + PROBE_WAIT_MS });
  ns = polityLog(ns, `🔍 정적 ${rv.name} 수사 → ${ok ? '혐의 드러남(영향력 −25)' : '실패(영향력 +10)'}`);
  return tell(ns, ok ? `🔍 ${rv.name}의 비리가 드러나 영향력이 크게 줄었어요(−25). 다만 정치 보복 논란이 일어요.` : `🔍 ${rv.name} 수사가 실패했어요. "정치 탄압이다!" 오히려 영향력 +10`);
}

/* 국정감사 */
export interface AuditQ {
  id: string;
  icon: string;
  ask: string;
  min: MinistryId;
  /** 정부가 약한 곳이면 true(자료 공개가 위험) */
  bad: (s: GameState) => boolean;
}
export const AUDIT_QS: AuditQ[] = [
  { id: 'def', icon: '🎖️', ask: '국방 예산을 어디에 썼습니까?', min: 'mnd', bad: (s) => (s.policy?.split.def ?? 40) > 45 },
  { id: 'war', icon: '⚔️', ask: '왜 전쟁을 막지 못했습니까?', min: 'mofa', bad: atWar },
  { id: 'cpi', icon: '🛒', ask: '물가는 언제 잡힙니까?', min: 'mof', bad: (s) => econOf(s).cpi > baseOf(s).cpi + 1 },
  { id: 'disaster', icon: '🚒', ask: '재난 대응은 왜 늦었습니까?', min: 'mois', bad: (s) => polityOf(s).disasterLoss > 0 },
  { id: 'scandal', icon: '🔍', ask: '측근 비리를 감싸는 것 아닙니까?', min: 'moj', bad: (s) => !!scandalOf(s) },
  { id: 'spy', icon: '🕵️', ask: '정보기관이 민간인을 사찰했다는데요?', min: 'nis', bad: (s) => (s.assembly?.laws ?? []).some((l) => l.id === 'intel' && l.untilMs > s.worldMs) },
  { id: 'jobs', icon: '🧑‍💼', ask: '청년 일자리 대책이 있습니까?', min: 'moel', bad: (s) => econOf(s).unemp > 5 },
  { id: 'house', icon: '🏠', ask: '집값 폭등 책임은 누가 집니까?', min: 'molit', bad: (s) => econOf(s).house > 15 },
  { id: 'welfare', icon: '🤲', ask: '복지 예산이 왜 줄었습니까?', min: 'mohw', bad: (s) => (s.policy?.split.soc ?? 20) < 15 },
];
export const auditQ = (id: string) => AUDIT_QS.find((q) => q.id === id)!;
export type AuditPick = 'open' | 'minister' | 'refuse';
export const auditOf = (s: GameState): Audit | null => polityOf(s).audit;
export function auditChance(s: GameState, id: string): number {
  return clamp(0.4 + ministryPower(s, auditQ(id).min) * 0.3, 0.15, 0.9);
}
export function answerAudit(s: GameState, id: string, pick: AuditPick): GameState {
  const a = auditOf(s);
  if (!a || !a.qs.includes(id) || a.done.includes(id)) return s;
  const q = auditQ(id);
  let ns = s;
  let line = '';
  if (pick === 'open') {
    if (q.bad(ns)) {
      ns = bumpTrust(ns, 2);
      ns = addPresMod(ns, `${q.icon} 국감 자료 공개(약점 드러남)`, -2, 24);
      line = '자료 공개: 신뢰도 +2 · 약점이 드러나 지지도 −2';
    } else {
      ns = bumpTrust(ns, 3);
      line = '자료 공개: 신뢰도 +3';
    }
  } else if (pick === 'minister') {
    let r: number;
    [r, ns] = roll(ns);
    const ok = r < auditChance(ns, id);
    ns = bumpTrust(ns, ok ? 4 : -4);
    if (!ok) ns = addPresMod(ns, `${q.icon} 국감 장관 답변 실수`, -2, 24);
    line = ok ? `${ministryById(q.min).short} 장관 답변 성공: 신뢰도 +4` : `${ministryById(q.min).short} 장관 답변 실수: 신뢰도 −4 · 지지도 −2`;
  } else {
    ns = bumpTrust(ns, -5);
    line = '답변 거부: 신뢰도 −5';
  }
  ns = withPolity(ns, { audit: { ...a, done: [...a.done, id] } });
  return polityLog(ns, `📋 국정감사 ${q.icon} "${q.ask}" → ${line}`);
}

/** 15분마다: 의혹·국정감사 */
export function probeTick(s: GameState): GameState {
  if (!s.polity) return s;
  let ns = s;
  const p = polityOf(ns);
  // 의혹이 사라진 사람(나간 사람)이면 정리
  if (p.scandal && !scandalPerson(ns)) ns = withPolity(ns, { scandal: null, scandalMs: ns.worldMs + 12 * H });
  else if (p.scandal && p.scandal.untilMs <= ns.worldMs) {
    const sc = p.scandal;
    ns = addPresMod(ns, '🔍 비리 의혹 방치', -sc.evidence * 2 - 2, 24);
    ns = polityLog(ns, '🔍 비리 의혹에 답하지 않았어요(방치)');
    ns = tell(ns, `🔍 비리 의혹을 내버려 뒀어요. 지지도 −${sc.evidence * 2 + 2}`);
    ns = withPolity(ns, { scandal: null, scandalMs: ns.worldMs + SCANDAL_GAP_H[0] * H });
  } else if (!p.scandal && ns.worldMs >= p.scandalMs && ns.cabinet) {
    const list = cabinetOf(ns).people.filter((x) => x.seat || x.post);
    if (!list.length) ns = withPolity(ns, { scandalMs: ns.worldMs + DAY });
    else {
      let a: number, b: number, c: number;
      [a, ns] = roll(ns);
      [b, ns] = roll(ns);
      [c, ns] = roll(ns);
      const w = list.map((x) => (x.hidden === '비리 전력' ? 4 : 1) * (x.loyalty < 40 ? 1.5 : 1));
      let t = a * w.reduce((x, y) => x + y, 0);
      let pick = list[0];
      for (let i = 0; i < list.length; i++) {
        t -= w[i];
        if (t <= 0) {
          pick = list[i];
          break;
        }
      }
      const dirty = pick.hidden === '비리 전력';
      const evidence = dirty ? 2 + Math.round(b) : 1 + Math.floor(b * 3);
      const kind = SCANDAL_KINDS[Math.floor(c * SCANDAL_KINDS.length)];
      ns = withPolity(ns, { scandal: { pid: pick.id, kind, evidence, untilMs: ns.worldMs + SCANDAL_MS } });
      const who = `${seatName(ns, pick.id)} ${pick.name}`;
      ns = polityLog(ns, `🔍 ${who} ${kind} 의혹(증거 ${evidence}/3)`);
      ns = tell(ns, `📰 ${who}의 ${kind} 의혹이 터졌어요! 사회 → 국정 → 감사에서 12시간 안에 정해 주세요.`);
      ns = snap(ns, 'press', `${pick.name} ${kind} 의혹`, `증거 ${evidence}/3`);
    }
  }
  // 국정감사
  const p2 = polityOf(ns);
  if (p2.audit && p2.audit.untilMs <= ns.worldMs) {
    let a = p2.audit;
    for (const id of a.qs) if (!a.done.includes(id)) {
      ns = answerAudit(ns, id, 'refuse');
      a = polityOf(ns).audit!;
    }
    ns = withPolity(ns, { audit: null });
  } else if (!p2.audit && ns.worldMs >= p2.auditMs) {
    let r: number;
    [r, ns] = roll(ns);
    const bad = AUDIT_QS.filter((q) => q.bad(ns)).map((q) => q.id);
    const rest = AUDIT_QS.map((q) => q.id).filter((id) => !bad.includes(id));
    const off = Math.floor(r * rest.length);
    const qs = [...bad, ...rest.slice(off), ...rest.slice(0, off)].slice(0, 3);
    ns = withPolity(ns, { audit: { untilMs: ns.worldMs + AUDIT_MS, qs, done: [] }, auditMs: ns.worldMs + AUDIT_GAP_MS });
    ns = tell(ns, '📋 국정감사가 열렸어요. 하루 안에 야당 질문 3개에 답해 주세요(사회 → 국정 → 감사).');
    ns = snap(ns, 'assembly', '국정감사', '야당 의원들의 질문이 쏟아져요');
  }
  return ns;
}

registerDomRows((s, key) => {
  if (!s.polity || key !== 'approval') return [];
  const sc = scandalOf(s);
  return sc ? [[`🔍 ${sc.kind} 의혹`, -2]] : [];
});
