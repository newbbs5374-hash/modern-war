// 국회·재신임(11-23 기획 ⑤⑨): 법안 카드 3장 중 하나 제출 → 실제 2시간 뒤 표결 → 통과하면 7일 동안 법 효과.
// 실제 14일마다 재신임 국민투표: 지지도로 결과. 통과하면 루비·명성, 실패하면 신뢰도·명성 벌점(호칭이 내려갈 수 있음, 게임은 계속).
import { addPresMod, approvalOf, demote } from './approval';
import { cabinetOf } from './cabinet';
import { goalsOf } from './goals';
import { BILLS, LAW_MAX, LAW_MS, billById, liveLaws, type AssemblyState, type BillId } from './laws';
import { note, withOfficer } from './officer';
import { originEff } from './origin';
import { influenceOf, roleOf } from './rivals';
import { Rng } from './rng';
import { amendConfBonus, seatBonus } from './polity';
import type { GameState } from './state';
import { titleOf, titleScore } from './title';

const H = 3600e3;
export const VOTE_MS = 2 * H;
export const OFFER_MS = 12 * H;
export const CONF_MS = 14 * 24 * H;
/** 재신임 투표: 첫 투표는 시작하고 14일 뒤 */
export const CONF_RUBY = 30;
export const CONF_FAME = 50;
const clamp = (v: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));

function rollOffer(rng: Rng, avoid: BillId[] = []): BillId[] {
  const ids = BILLS.map((b) => b.id).filter((id) => !avoid.includes(id));
  const out: BillId[] = [];
  while (out.length < 3 && ids.length) out.push(ids.splice(Math.floor(rng.next() * ids.length), 1)[0]);
  return out;
}
export function newAssembly(s: Pick<GameState, 'worldMs' | 'world'>): AssemblyState {
  const seed = (((s.world.seed ?? 1) * 17 + 3) >>> 0) || 1;
  const rng = new Rng(seed);
  return { seed: rng.seed, offer: rollOffer(rng), offerMs: s.worldMs + OFFER_MS, vote: null, laws: [], confMs: s.worldMs + CONF_MS, confWins: 0, confLoss: 0, confWarned: false, log: [] };
}
export const assemblyOf = (s: GameState): AssemblyState => s.assembly ?? newAssembly(s);

/** 법안 통과 확률과 이유 */
export function billRows(s: GameState, id: BillId): Array<[string, number]> {
  const o = s.officer;
  const rows: Array<[string, number]> = [['기본', 0.45]];
  rows.push([`의회 신뢰도 ${Math.round(o.trust)}`, (o.trust - 50) / 100]);
  rows.push([`정치 스탯 ${Math.floor(o.stats['정치'] ?? 0)}`, Math.min(0.2, (o.stats['정치'] ?? 0) / 100)]);
  o.rivals.forEach((rv, i) => {
    if (roleOf(rv, i) !== '야당 대표') return;
    if (rv.ally) rows.push([`🤝 야당 대표 ${rv.name}(협력)`, 0.15]);
    else rows.push([`🗳️ 야당 대표 영향력 ${Math.round(influenceOf(rv))}`, -influenceOf(rv) / 300]);
  });
  const c = s.cabinet ? cabinetOf(s) : null;
  const pr = c ? c.people.filter((p) => (p.seat || p.post) && p.trait === '원칙주의').length : 0;
  if (pr) rows.push(['📏 원칙주의 각료', pr * 0.03]);
  const og = originEff(s, 'law');
  if (og) rows.push(['🎓 출신', og]);
  const sb = seatBonus(s);
  if (sb) rows.push([`🏛️ 여당 의석 ${s.polity!.seats.ruling}/300`, Math.round(sb * 100) / 100]);
  const hard = billById(id).hard;
  if (hard) rows.push(['법안이 어려움', -hard]);
  return rows;
}
export const billChance = (s: GameState, id: BillId) => Math.max(0.1, Math.min(0.95, billRows(s, id).reduce((a, [, v]) => a + v, 0)));

export function canSubmit(s: GameState, id: BillId): string | null {
  const a = assemblyOf(s);
  if (isOpposition(s)) return '야당 지도자인 동안은 법안을 못 내요';
  if (a.vote) return '표결 중인 법안이 있어요';
  if (!a.offer.includes(id)) return '지금 고를 수 없는 법안';
  if (liveLaws(s).some((l) => l.id === id)) return '이미 살아 있는 법이에요';
  return null;
}
export function submitBill(s: GameState, id: BillId): GameState {
  if (canSubmit(s, id)) return s;
  const a = structuredClone(assemblyOf(s));
  a.vote = { id, endMs: s.worldMs + VOTE_MS, chance: billChance(s, id) };
  a.log = [`📨 ${billById(id).name} 제출(통과 ${Math.round(a.vote.chance * 100)}%)`, ...a.log].slice(0, 20);
  return { ...s, assembly: a };
}
/** 법 폐지(자리를 비울 때) */
export function repealLaw(s: GameState, id: BillId): GameState {
  const a = structuredClone(assemblyOf(s));
  a.laws = a.laws.filter((l) => l.id !== id);
  return { ...s, assembly: a };
}

/** 11-27 내정 2 임기와 선거: 이번 임기(재신임 투표 사이 14일) 동안 지킨 공약·깬 공약 */
export const TERM_KEEP = 0.04;
export const TERM_KEEP_MAX = 0.2;
export const TERM_BREAK = 0.06;
export const OPP_MS = 48 * H;
export function termPledges(s: GameState): { kept: number; broken: number } {
  const a = assemblyOf(s);
  const ag = s.dom?.agenda;
  return {
    kept: Math.max(0, (ag?.done.length ?? 0) - (a.termDone ?? 0)),
    broken: Math.max(0, (ag?.broken.length ?? 0) - (a.termBroken ?? 0)),
  };
}
/** 지금이 몇 번째 임기인지(재신임 투표를 치른 횟수 + 1) */
export const termNo = (s: GameState) => assemblyOf(s).confWins + assemblyOf(s).confLoss + 1;
export const isOpposition = (s: GameState) => (assemblyOf(s).oppUntilMs ?? 0) > s.worldMs;

/** 재신임 통과 확률의 까닭: 지지도(35 → 0%, 65 → 100%) + 호칭(평판, 11-24 대장 결정: 평판은 재신임에만 영향) */
export function confRows(s: GameState): Array<[string, number]> {
  const ap = approvalOf(s);
  const t = titleOf(s);
  return [
    [`지지도 ${Math.round(ap)}`, (ap - 35) / 30],
    [`호칭(평판) 「${t.name}」`, Math.round(((titleScore(s) - 100) / 400) * 100) / 100],
    ...(termPledges(s).kept ? [[`📋 이번 임기에 지킨 공약 ${termPledges(s).kept}건`, Math.min(TERM_KEEP_MAX, termPledges(s).kept * TERM_KEEP)] as [string, number]] : []),
    ...(termPledges(s).broken ? [[`💔 이번 임기에 깬 공약 ${termPledges(s).broken}건`, -termPledges(s).broken * TERM_BREAK] as [string, number]] : []),
    ...(amendConfBonus(s) ? [['📜 개헌 임기 연장', amendConfBonus(s)] as [string, number]] : []),
  ];
}
export const confChance = (s: GameState) => clamp(confRows(s).reduce((a, [, v]) => a + v, 0), 0, 1);

export function assemblyTick(s: GameState): GameState {
  const a = structuredClone(assemblyOf(s));
  const rng = new Rng(a.seed);
  let ns: GameState = { ...s, assembly: a };
  const notes: string[] = [];
  a.laws = a.laws.filter((l) => l.untilMs > s.worldMs);
  // 표결
  if (a.vote && s.worldMs >= a.vote.endMs) {
    const b = billById(a.vote.id);
    const ok = rng.chance(a.vote.chance);
    if (ok) {
      if (a.laws.length >= LAW_MAX) a.laws.sort((x, y) => x.untilMs - y.untilMs).shift();
      a.laws.push({ id: b.id, untilMs: s.worldMs + LAW_MS });
      a.passed = (a.passed ?? 0) + 1;
      ns = withOfficer(ns, (o) => {
        o.trust = clamp(o.trust + 2);
      });
      notes.push(`📜 ${b.name} 국회 통과! 7일 동안 ${b.text}. 신뢰도 +2`);
    } else {
      ns = withOfficer(ns, (o) => {
        o.trust = clamp(o.trust - 3);
      });
      notes.push(`❌ ${b.name}이(가) 국회에서 부결됐어요. 신뢰도 −3`);
    }
    a.log = [notes[notes.length - 1], ...a.log].slice(0, 20);
    a.vote = null;
    a.offer = rollOffer(rng, [b.id]);
    a.offerMs = s.worldMs + OFFER_MS;
  }
  if (!a.vote && s.worldMs >= a.offerMs) {
    a.offer = rollOffer(rng, a.offer);
    a.offerMs = s.worldMs + OFFER_MS;
  }
  // 재신임 투표
  if (!a.confWarned && a.confMs - s.worldMs <= 24 * H) {
    a.confWarned = true;
    notes.push(`🗳️ 내일 재신임 국민투표예요. 지금 지지도면 통과 확률 ${Math.round(confChance(ns) * 100)}%.`);
  }
  if (a.oppUntilMs && s.worldMs >= a.oppUntilMs) {
    a.oppUntilMs = undefined;
    ns = addPresMod({ ...ns, assembly: a }, '🔁 다시 돌아온 지도자', 6, 48);
    notes.push('🔁 야당 지도자에서 다시 집권했어요. 이틀 동안 지지도 +6. 새 임기에는 공약을 지켜 표를 모으세요.');
  }
  if (s.worldMs >= a.confMs) {
    const ok = rng.chance(confChance(ns));
    // 새 임기: 공약 셈을 다시 시작
    a.termDone = s.dom?.agenda.done.length ?? 0;
    a.termBroken = s.dom?.agenda.broken.length ?? 0;
    a.confMs = s.worldMs + CONF_MS;
    a.confWarned = false;
    if (ok) {
      a.confWins++;
      const g = goalsOf(ns);
      ns = { ...ns, goals: { ...g, ruby: g.ruby + CONF_RUBY }, officer: { ...ns.officer, fame: ns.officer.fame + CONF_FAME } };
      ns = addPresMod(ns, '🗳️ 재신임 통과', 5, 48);
      notes.push(`🎉 재신임 국민투표 통과! 루비 +${CONF_RUBY} · 명성 +${CONF_FAME} · 이틀 동안 지지도 +5`);
    } else {
      a.confLoss++;
      a.oppUntilMs = s.worldMs + OPP_MS;
      ns = demote({ ...ns, assembly: a }, '😞 재신임 국민투표에서 졌어요. 신뢰도 −15 · 명성 −100. 호칭이 내려갈 수 있어요. 이틀 동안 야당 지도자로 지내고(법안을 못 내요) 다시 집권해요.');
    }
    a.log = [ok ? '🎉 재신임 통과' : '😞 재신임 실패', ...a.log].slice(0, 20);
  }
  a.seed = rng.seed;
  ns = { ...ns, assembly: a };
  if (notes.length) {
    ns = { ...ns, world: { ...ns.world, events: [...ns.world.events] } };
    for (const t of notes) note(ns, t);
  }
  return ns;
}
