// 인물·부처의 시간 흐름(인재 명단 채우기·청문회 결과·부처 업무·충성·빼 가기·은퇴·스캔들·장관 다툼)과 부처 업무 시작.
import { BASIC_RES } from '../data/economy';
import { COUNTRIES } from '../data/world';
import { CITIES } from '../data/cities';
import { ministryById, type MinistryId } from '../data/cabinet';
import { postById } from '../data/staff';
import { STAT_IDS } from '../data/officers';
import { addPresMod } from './approval';
import {
  postEff,
  POOL_ADD,
  POOL_EVERY_MS,
  POOL_MAX,
  cabLog,
  cabinetOf,
  giveFaces,
  ministerOf,
  ministryPower,
  poolPerson,
  takenNames,
  viceOf,
  type CabinetState,
  type Person,
} from './cabinet';
import { addFavorNote, civOf, favorOf } from './civ';
import { note, withOfficer } from './officer';
import { canAppointGeneralSlot, fieldTaken, type GeneralField } from './loyal';
import { GENERAL_STYLES } from '../data/officers';
import { originEff } from './origin';
import { Rng } from './rng';
import { budgetPerDay, type GameState } from './state';
import { isAlive, pairKey, relationOf } from './world';

const H = 3600e3;
const clamp = (v: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));

/** 청문회 통과 확률 */
export function hearingChance(s: GameState, p: Person): number {
  let v = 0.55 + (s.officer.trust - 50) / 150 + (s.officer.stats['정치'] ?? 8) / 200;
  if (p.trait === '청렴') v += 0.15;
  if (p.trait === '원칙주의') v += 0.05;
  if (p.hidden === '비리 전력') v -= 0.35;
  if (p.grade === '우수') v += 0.03;
  v += originEff(s, 'hearing');
  return clamp(v, 0.1, 0.95);
}

/** 부처 업무 시간(실용주의 장관이면 −20%) */
export function taskHours(s: GameState, min: MinistryId, taskId: string): number {
  const t = ministryById(min).tasks.find((x) => x.id === taskId)!;
  const m = ministerOf(cabinetOf(s), min);
  return t.hours * (m?.trait === '실용주의' ? 0.8 : 1) * (1 - postEff(s, 'taskTime'));
}
export function canTask(s: GameState, min: MinistryId): string | null {
  const c = cabinetOf(s);
  if (!ministerOf(c, min) && !viceOf(c, min)) return '장관이나 차관이 있어야 해요';
  const t = c.tasks[min];
  if (t) return '업무 중이에요';
  return null;
}
export function startTask(s: GameState, min: MinistryId, taskId: string): GameState {
  if (canTask(s, min)) return s;
  const c = structuredClone(cabinetOf(s));
  c.tasks[min] = { task: taskId, endMs: s.worldMs + taskHours(s, min, taskId) * H };
  cabLog(c, `📋 ${ministryById(min).name}: ${ministryById(min).tasks.find((x) => x.id === taskId)!.name} 시작`);
  return { ...s, cabinet: c };
}

/** 업무 결과 배율(부처 힘, 신중파 +10%) */
function taskMult(s: GameState, min: MinistryId): number {
  const m = ministerOf(cabinetOf(s), min);
  return Math.max(0.4, ministryPower(s, min)) * (m?.trait === '신중파' ? 1.1 : 1);
}

function addBuff(c: CabinetState, key: CabinetState['buffs'][number]['key'], v: number, untilMs: number, why: string) {
  c.buffs = [...c.buffs.filter((b) => b.untilMs > untilMs - 48 * H), { key, v, untilMs, why }].slice(-16);
}

/** 업무 끝: 결과를 나라에 반영하고 한 줄 소식 */
function finishTask(s: GameState, min: MinistryId, taskId: string): GameState {
  const k = taskMult(s, min);
  const name = ministryById(min).name;
  const me = s.player.countryId;
  let ns: GameState = { ...s, cabinet: structuredClone(cabinetOf(s)) };
  const c = ns.cabinet!;
  const now = s.worldMs;
  let text = '';
  switch (`${min}:${taskId}`) {
    case 'mnd:reform':
      addBuff(c, 'build', 0.2 * k, now + 24 * H, name);
      text = `모든 모집 +${Math.round(20 * k)}%(하루)`;
      break;
    case 'mnd:drill': {
      addBuff(c, 'secScore', 8 * k, now + 12 * H, name);
      const add = Math.round((s.nations[me]?.troops ?? 0) * 0.01 * k);
      ns = { ...ns, nations: { ...ns.nations, [me]: { ...ns.nations[me], troops: ns.nations[me].troops + add } } };
      text = `안보 +${Math.round(8 * k)}(12시간) · 병력 +${add.toLocaleString('ko-KR')}`;
      break;
    }
    case 'nis:counter': {
      const intel = Math.round(20 * k);
      addBuff(c, 'counter', 1, now + 24 * H, name);
      ns = { ...ns, officer: { ...ns.officer, intel: ns.officer.intel + intel } };
      text = `정보 +${intel} · 하루 동안 정적 방해를 막아요`;
      break;
    }
    case 'nis:vet':
      for (const p of c.people) if (p.group === '인재' || p.group === '내각') p.known = true;
      text = '인재 명단·내 사람들의 숨은 특성을 모두 알아냈어요';
      break;
    case 'mofa:envoy': {
      let best: string | null = null;
      let worst = Infinity;
      for (const o of COUNTRIES) {
        if (o.id === me || !isAlive(s.world, o.id) || relationOf(s.world, me, o.id) === '전쟁') continue;
        const t = s.world.pairs[pairKey(me, o.id)]?.tension ?? 0;
        const score = -t + favorOf(s, o.id);
        if (score < worst) {
          worst = score;
          best = o.id;
        }
      }
      if (best) {
        const v = Math.round(10 * k);
        ns = addFavorNote(ns, best, '✈️ 특사 파견', v);
        text = `${COUNTRIES.find((x) => x.id === best)!.name} 호감 +${v}`;
      } else text = '특사를 보낼 나라가 없어요';
      break;
    }
    case 'mofa:summit':
      addBuff(c, 'diploScore', 8 * k, now + 24 * H, name);
      text = `외교 위상 +${Math.round(8 * k)}(하루)`;
      break;
    case 'mof:stimulus':
      addBuff(c, 'econScore', 10 * k, now + 12 * H, name);
      ns = addPresMod(ns, '📈 경기 부양', 3 * k, 12);
      text = `경제 지수 +${Math.round(10 * k)} · 지지도 +${Math.round(3 * k)}(12시간)`;
      break;
    case 'mof:bond': {
      const got = Math.round(budgetPerDay(s, me) * 6 * k);
      ns = { ...ns, nations: { ...ns.nations, [me]: { ...ns.nations[me], treasury: ns.nations[me].treasury + got } } };
      addBuff(c, 'econScore', -5, now + 24 * H, '국채');
      text = `금고 +${got.toLocaleString('ko-KR')} · 경제 지수 −5(하루)`;
      break;
    }
    case 'moti:survey': {
      const stock = { ...ns.economy.stock };
      const low = [...BASIC_RES].sort((a, b) => (stock[a] ?? 0) - (stock[b] ?? 0)).slice(0, 3);
      const q = Math.round(20 * k);
      for (const r of low) stock[r] = (stock[r] ?? 0) + q;
      ns = { ...ns, economy: { ...ns.economy, stock } };
      text = `${low.join('·')} +${q}`;
      break;
    }
    case 'moti:overtime':
      addBuff(c, 'res', 0.15 * k, now + 24 * H, name);
      addBuff(c, 'socScore', -3, now + 24 * H, '공장 특근');
      text = `자원 +${Math.round(15 * k)}%(하루) · 사회 안정 −3`;
      break;
    case 'mois:disaster':
    case 'mois:police':
    case 'mohw:welfare': {
      const civ = structuredClone(civOf(ns));
      const mine = CITIES.filter((ct) => s.world.owner[ct.id] === me && civ.cities[ct.id]);
      if (taskId === 'disaster') {
        for (const ct of mine) civ.cities[ct.id].loyalty = clamp(civ.cities[ct.id].loyalty + 5 * k);
        addBuff(c, 'socScore', 5 * k, now + 24 * H, name);
        text = `모든 도시 민심 +${Math.round(5 * k)} · 사회 안정 +${Math.round(5 * k)}(하루)`;
      } else if (taskId === 'police') {
        const occ = mine.filter((ct) => ct.home !== me);
        for (const ct of occ) civ.cities[ct.id].loyalty = clamp(civ.cities[ct.id].loyalty + 10 * k);
        text = occ.length ? `점령지 ${occ.length}곳 민심 +${Math.round(10 * k)}` : '점령지가 없어 치안만 다졌어요';
      } else {
        const low = [...mine].sort((a, b) => civ.cities[a.id].loyalty - civ.cities[b.id].loyalty)[0];
        if (low) {
          civ.cities[low.id].loyalty = clamp(civ.cities[low.id].loyalty + 12 * k);
          text = `${low.name} 민심 +${Math.round(12 * k)}`;
        } else text = '돌볼 도시가 없어요';
      }
      ns = { ...ns, civ };
      break;
    }
    case 'mohw:vaccine':
      ns = addPresMod(ns, '💉 예방 접종', 4 * k, 24);
      text = `지지도 +${Math.round(4 * k)}(하루)`;
      break;
    case 'msit:focus': {
      const civ = structuredClone(civOf(ns));
      const add = 3 * k;
      civ.bank = { mil: civ.bank.mil + add, soc: civ.bank.soc + add };
      ns = { ...ns, civ };
      text = `연구 두 줄에 ${Math.round(add * 10) / 10}시간치 점수`;
      break;
    }
    case 'msit:expo': {
      ns = addPresMod(ns, '🚀 과학 박람회', 3 * k, 24);
      const fame = Math.round(10 * k);
      ns = { ...ns, officer: { ...ns.officer, fame: ns.officer.fame + fame } };
      text = `지지도 +${Math.round(3 * k)}(하루) · 명성 +${fame}`;
      break;
    }
    case 'kocis:campaign':
      ns = addPresMod(ns, '📣 홍보 캠페인', 5 * k, 12);
      text = `지지도 +${Math.round(5 * k)}(12시간)`;
      break;
    case 'kocis:brief':
      ns = { ...ns, officer: { ...ns.officer, trust: clamp(ns.officer.trust + 3 * k) } };
      text = `신뢰도 +${Math.round(3 * k)}`;
      break;
  }
  const c2 = ns.cabinet!;
  delete c2.tasks[min];
  cabLog(c2, `✅ ${name}: ${text}`);
  ns = { ...ns, world: { ...ns.world, events: [...ns.world.events] } };
  note(ns, `🏛️ ${name} 업무 끝: ${text}`);
  return ns;
}

/**
 * AI 판단마다(실제 15분): 인재 명단 채우기 · 청문회 · 부처 업무 · 충성 · 성장 · 빼 가기·은퇴·스캔들·다툼.
 */
/** 끝난 청문회 결과 내기(c는 이미 복사본). 결과 글은 notes로 */
function settleHearing(s: GameState): { state: GameState; notes: string[] } {
  let ns = s;
  const c = ns.cabinet!;
  const notes: string[] = [];
  if (!c.hearing || s.worldMs < c.hearing.endMs) return { state: ns, notes };
  const rng = new Rng(c.seed);
  const p = c.people.find((x) => x.id === c.hearing!.pid);
  const min = c.hearing.min;
  c.hearing = null;
  if (p && p.group === '내각') {
    const ok = rng.chance(hearingChance(s, p));
    if (p.hidden === '비리 전력') p.known = true;
    if (ok && !c.people.some((x) => x.seat?.kind === 'min' && x.seat.id === min)) {
      p.seat = { kind: 'min', id: min };
      p.loyalty = clamp(p.loyalty + 10);
      notes.push(`✅ ${p.name}, 청문회 통과! ${ministryById(min).name} 장관이 되었어요.`);
    } else {
      p.loyalty = clamp(p.loyalty - 10);
      ns = { ...ns, officer: { ...ns.officer, trust: clamp(ns.officer.trust - 4) } };
      notes.push(`❌ ${p.name}, 청문회에서 떨어졌어요${p.hidden === '비리 전력' ? '(비리 전력이 드러남)' : ''}. 신뢰도 −4`);
    }
  }
  c.seed = rng.seed;
  return { state: ns, notes };
}

/** 가속권으로 끝낸 청문회를 바로 결과 내기(11-24) */
export function hearingNow(s: GameState): GameState {
  const c0 = s.cabinet;
  if (!c0?.hearing || s.worldMs < c0.hearing.endMs) return s;
  const r = settleHearing({ ...s, cabinet: structuredClone(c0) });
  let ns = r.state;
  if (r.notes.length) {
    ns = { ...ns, world: { ...ns.world, events: [...ns.world.events] } };
    for (const t of r.notes) {
      note(ns, t);
      cabLog(ns.cabinet!, t);
    }
  }
  return ns;
}

export function cabinetTick(s: GameState, tickMs: number): GameState {
  let ns: GameState = { ...s, cabinet: structuredClone(cabinetOf(s)) };
  let c = ns.cabinet!;
  const rng = new Rng(c.seed);
  const h = tickMs / H;
  const me = s.player.countryId;
  // 인재 명단
  const taken = takenNames(c);
  while (s.worldMs - c.poolMs >= POOL_EVERY_MS) {
    c.poolMs += POOL_EVERY_MS;
    for (let i = 0; i < POOL_ADD; i++) c.people.push(poolPerson(c, rng, me, s.worldMs, taken));
    const pool = c.people.filter((p) => p.group === '인재');
    if (pool.length > POOL_MAX) {
      const drop = new Set(pool.sort((a, b) => a.sinceMs - b.sinceMs).slice(0, pool.length - POOL_MAX).map((p) => p.id));
      c.people = c.people.filter((p) => !drop.has(p.id));
    }
  }
  const notes: string[] = [];
  // 청문회
  if (c.hearing && s.worldMs >= c.hearing.endMs) {
    c.seed = rng.seed;
    const r = settleHearing({ ...ns, cabinet: c });
    ns = r.state;
    c = ns.cabinet!;
    rng.seed = c.seed;
    notes.push(...r.notes);
  }
  // 부처 업무
  for (const [min, t] of Object.entries(c.tasks)) {
    if (t && s.worldMs >= t.endMs) {
      ns = finishTask({ ...ns, cabinet: c }, min as MinistryId, t.task);
      c = structuredClone(ns.cabinet!);
      ns = { ...ns, cabinet: c };
    }
  }
  c.buffs = c.buffs.filter((b) => b.untilMs > s.worldMs);
  // 사람마다: 충성 · 성장 · 빼 가기 · 은퇴 · 스캔들
  const trust = ns.officer.trust;
  const cabLoyalBonus = postEff(ns, 'cabLoyal');
  const scandalCut = postEff(ns, 'scandal');
  const leave = new Set<number>();
  for (const p of c.people) {
    if (p.group !== '내각') continue;
    const target = 50 + (trust - 50) * 0.3 + (p.seat || p.post ? 8 : 0) + cabLoyalBonus + (p.trait === '충직' ? 15 : p.trait === '야심' ? -10 : 0) + (p.buddy ? 15 : 0);
    p.loyalty = clamp(p.loyalty + (target - p.loyalty) * (1 - Math.pow(0.97, h)));
    if (p.seat || p.post) {
      p.workMs = (p.workMs ?? 0) + tickMs;
      if (p.workMs >= 24 * H) {
        p.workMs -= 24 * H;
        const key = p.seat ? ministryById(p.seat.id).stats[0] : postById(p.post!).stats[0];
        p.stats[key] = Math.min(40, p.stats[key] + 1);
      }
    }
    const poach = p.trait !== '청렴' && p.loyalty < 35 ? 0.02 * h * (p.hidden === '이중 첩자 의혹' ? 2 : 1) : 0;
    if (poach && rng.chance(poach)) {
      leave.add(p.id);
      const to = rng.pick(COUNTRIES.filter((x) => x.id !== me));
      notes.push(`🧲 ${p.name}이(가) ${to.name}의 손을 잡고 떠났어요(충성이 낮았어요).`);
      continue;
    }
    const old = p.age >= 68 || p.hidden === '건강 문제';
    if (old && rng.chance(0.004 * h)) {
      leave.add(p.id);
      notes.push(`🎗️ ${p.name}이(가) ${p.hidden === '건강 문제' ? '건강 문제로' : '나이가 들어'} 은퇴했어요.`);
      continue;
    }
    if ((p.seat || p.post) && p.hidden === '비리 전력' && rng.chance(0.01 * h * (1 - scandalCut))) {
      p.known = true;
      ns = addPresMod(ns, `💸 ${p.name} 비리 스캔들`, -5, 12);
      notes.push(`💸 ${p.name} 비리 스캔들! 지지도가 흔들려요(−5, 12시간).`);
    }
  }
  // 앙숙끼리 같이 자리에 있으면 가끔 다툼
  const on = c.people.filter((p) => p.seat || p.post);
  for (const a of on)
    for (const b of on)
      if (a.id < b.id && a.foes.includes(b.id) && rng.chance(0.03 * h)) {
        a.loyalty = clamp(a.loyalty - 5);
        b.loyalty = clamp(b.loyalty - 5);
        notes.push(`💢 국무회의에서 ${a.name}과(와) ${b.name}이(가) 크게 다퉜어요. 둘 다 충성 −5`);
      }
  if (leave.size) c.people = c.people.filter((p) => !leave.has(p.id));
  c.seed = rng.seed;
  giveFaces(c);
  ns = { ...ns, cabinet: c };
  if (notes.length) {
    ns = { ...ns, world: { ...ns.world, events: [...ns.world.events] } };
    for (const t of notes) {
      note(ns, t);
      cabLog(c, t);
    }
  }
  return ns;
}

/** 스탯 합(카드에 보여 줄 종합) */
export const statTotal = (p: Person) => STAT_IDS.reduce((a, id) => a + p.stats[id], 0);
/** 자리에 맞는 후보 3명(후보 비교 창) */
export function bestFor(s: GameState, min: MinistryId, n = 3): Person[] {
  const c = cabinetOf(s);
  const m = ministryById(min);
  return c.people
    .filter((p) => p.group === '내각' && !(p.seat?.kind === 'min') && !p.post)
    .sort((a, b) => scoreFor(b, m.stats, m.spec) - scoreFor(a, m.stats, m.spec))
    .slice(0, n);
}
const scoreFor = (p: Person, stats: readonly string[], spec: readonly string[]) => stats.reduce((a, id) => a + (p.stats[id as keyof Person['stats']] ?? 0), 0) * (spec.includes(p.spec) ? 1.3 : 1);

/* ───────── 인물을 장군으로(11-23) ───────── */

/** 사람 스탯으로 정한 장군 능력 1~10(통솔·전술·포격 평균) */
export function personGeneralSkill(p: Person): number {
  const v = (p.stats['통솔'] + p.stats['전술'] + p.stats['포격']) / 3;
  const spec = ['육군통', '해군통', '공군통', '정보통', '군수통'].includes(p.spec) ? 1 : 0;
  return clamp(Math.round(v / 3.2 + spec), 1, 10);
}
export function canPersonGeneral(s: GameState, pid: number, field: GeneralField): string | null {
  const p = cabinetOf(s).people.find((x) => x.id === pid);
  if (!p || p.group !== '내각') return '영입한 사람만 장군이 될 수 있어요';
  if (p.seat || p.post) return '자리(부처·대통령실)에서 먼저 내려와야 해요';
  if (cabinetOf(s).hearing?.pid === pid) return '청문회 중';
  if (fieldTaken(s, field)) return `${field} 장군이 이미 있어요`;
  return canAppointGeneralSlot(s);
}
export function appointPersonGeneral(s: GameState, pid: number, field: GeneralField): GameState {
  if (canPersonGeneral(s, pid, field)) return s;
  const c = structuredClone(cabinetOf(s));
  const p = c.people.find((x) => x.id === pid)!;
  c.people = c.people.filter((x) => x.id !== pid);
  cabLog(c, `⭐ ${p.name}을(를) ${field} 장군으로 임명했어요.`);
  return withOfficer({ ...s, cabinet: c }, (o, rng, ns) => {
    o.generals.push({
      id: o.nextId++,
      name: p.name,
      field,
      style: rng.pick([...GENERAL_STYLES]),
      skill: personGeneralSkill(p),
      loyalty: clamp(p.loyalty + 5),
      from: '인재 임명',
      seenMs: ns.worldMs,
    });
    note(ns, `⭐ ${p.name}을(를) ${field} 장군으로 임명했어요.`);
  });
}
