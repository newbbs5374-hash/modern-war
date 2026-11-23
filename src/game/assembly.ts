// 국회·재신임(11-23 기획 ⑤⑨): 법안 카드 3장 중 하나 제출 → 실제 2시간 뒤 표결 → 통과하면 7일 동안 법 효과.
// 실제 14일마다 재신임 국민투표: 지지도로 결과. 통과하면 루비·명성, 실패하면 등급 한 단계 내려감(게임은 계속).
import { RANKS } from '../data/ranks';
import { addPresMod, approvalOf, demote } from './approval';
import { cabinetOf } from './cabinet';
import { goalsOf } from './goals';
import { BILLS, LAW_MAX, LAW_MS, billById, liveLaws, type AssemblyState, type BillId } from './laws';
import { note, withOfficer } from './officer';
import { originEff } from './origin';
import { influenceOf, roleOf } from './rivals';
import { Rng } from './rng';
import type { GameState } from './state';

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
  const pr = c ? c.people.filter((p) => p.seat && p.trait === '원칙주의').length : 0;
  if (pr) rows.push(['📏 원칙주의 각료', pr * 0.03]);
  const og = originEff(s, 'law');
  if (og) rows.push(['🎓 출신', og]);
  const hard = billById(id).hard;
  if (hard) rows.push(['법안이 어려움', -hard]);
  return rows;
}
export const billChance = (s: GameState, id: BillId) => Math.max(0.1, Math.min(0.95, billRows(s, id).reduce((a, [, v]) => a + v, 0)));

export function canSubmit(s: GameState, id: BillId): string | null {
  const a = assemblyOf(s);
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

/** 재신임 통과 확률(지지도 35 → 0%, 65 → 100%) */
export const confChance = (s: GameState) => clamp((approvalOf(s) - 35) / 30, 0, 1);

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
  if (s.worldMs >= a.confMs) {
    const ok = rng.chance(confChance(ns));
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
      const r = ns.player.rankIndex;
      if (r >= 1) {
        ns = demote({ ...ns, assembly: a }, `😞 재신임 국민투표에서 졌어요. ${RANKS[r - 1].name}(으)로 내려가요. 게임은 계속돼요.`);
      } else notes.push('😞 재신임 국민투표에서 졌어요. 더 내려갈 등급이 없어 그대로예요.');
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
