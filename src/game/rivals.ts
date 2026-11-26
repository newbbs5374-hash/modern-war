// 11/23 대장 결정: 지도자가 된 뒤의 라이벌 = 나라 안 정적(야당 대표·군부 실력자·재벌). 11/26 12명으로 늘림.
// 영향력이 쌓이면 방해 사건을 일으키고, 지도자는 동향 살피기·견제·회유로 맞섬. 회유에 성공하면 내 편(협력)이 되어 덤을 줌.
import { RANKS } from '../data/ranks';
import { REAL_MS_PER_GAME_DAY } from './balance';
import { Rng } from './rng';
import type { GameState } from './state';
import { note, type OfficerState, type Rival } from './officer';
import { cabinetOf, counterOn } from './cabinet';
import { addPresMod } from './approval';
import { makeNameEth } from '../data/names';
import { deckSize, deckSlot, faceFile, faceTag } from '../data/faces';

const HOUR = 60 * 60 * 1000;
const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));

// 11/26 대장 "반 지도자 인물을 더 많이": 3명 → 12명(역할 12가지). 앞 3개는 옛 정적이라 순서를 바꾸지 않아요.
export const RIVAL_ROLES = [
  '야당 대표',
  '군부 실력자',
  '재벌',
  '야당 원내대표',
  '퇴역 대장',
  '금융 큰손',
  '언론 사주',
  '노조 위원장',
  '지방 실세',
  '종교계 거물',
  '전 정보기관장',
  '여당 비주류',
] as const;
export type RivalRole = (typeof RIVAL_ROLES)[number];
/** 처음부터 있던 큰 정적 3명(더 세고 자주 공작) */
export const BIG_ROLES: readonly RivalRole[] = ['야당 대표', '군부 실력자', '재벌'];

/** 방해 공작 갈래: 의회 신뢰 · 군 충성 · 봉급 · 지지도 · 정보 */
export type PlotKind = 'trust' | 'army' | 'money' | 'approval' | 'intel';

export const ROLE_INFO: Record<RivalRole, { icon: string; text: string; plot: string; ally: string; kind: PlotKind; deed: string }> = {
  '야당 대표': { icon: '🗳️', kind: 'trust', deed: '예산안 반대 연설을 했어요', text: '의회에서 지도자를 몰아내려는 야당 대표예요.', plot: '예산안 반대·폭로 연설로 의회 신뢰를 깎아요.', ally: '협력하면 의회 신뢰가 천천히 올라요(70까지).' },
  '군부 실력자': { icon: '🎖️', kind: 'army', deed: '불만을 퍼뜨렸어요', text: '군 안에 따르는 사람이 많은 장성 출신 실력자예요.', plot: '장군·부관 사이에 불만을 퍼뜨려 충성을 깎아요.', ally: '협력하면 장군 도시 방어 +5%.' },
  재벌: { icon: '💼', kind: 'money', deed: '자금줄을 죄었어요', text: '나라 돈줄을 쥔 재벌 회장이에요.', plot: '자금줄을 죄어 봉급을 빼앗아요.', ally: '협력하면 봉급이 10% 더 들어와요.' },
  '야당 원내대표': { icon: '🏛️', kind: 'trust', deed: '법안 처리를 막았어요', text: '국회 표를 쥐고 법안마다 발목을 잡는 야당 원내대표예요.', plot: '법안·예산 처리를 미뤄 의회 신뢰를 깎아요.', ally: '협력하면 의회 신뢰가 천천히 올라요(65까지).' },
  '퇴역 대장': { icon: '🪖', kind: 'army', deed: '예비역 모임에서 지도자를 깎아내렸어요', text: '전역한 뒤에도 후배 장성들을 움직이는 강경파 예비역 대장이에요.', plot: '장군들에게 "지도자는 군을 모른다"고 부추겨 충성을 깎아요.', ally: '협력하면 장군 충성이 천천히 올라요.' },
  '금융 큰손': { icon: '🏦', kind: 'money', deed: '정부 채권을 팔아 치웠어요', text: '은행·투자사를 거느린 금융계 큰손이에요.', plot: '정부 채권을 내다 팔아 봉급을 빼앗아요.', ally: '협력하면 봉급이 5% 더 들어와요.' },
  '언론 사주': { icon: '📰', kind: 'approval', deed: '1면에 지도자 비판 기사를 실었어요', text: '신문·방송을 여럿 가진 언론 사주예요.', plot: '비판 기사를 쏟아내 지지도를 깎아요.', ally: '협력하면 지지도가 덤으로 올라요.' },
  '노조 위원장': { icon: '✊', kind: 'approval', deed: '총파업을 예고했어요', text: '수십만 조합원을 거느린 노동조합 위원장이에요.', plot: '파업과 집회로 지지도를 깎아요.', ally: '협력하면 지지도가 덤으로 올라요.' },
  '지방 실세': { icon: '🏙️', kind: 'approval', deed: '정부 정책을 따르지 않겠다고 선언했어요', text: '큰 지방을 오래 다스린 광역단체장 출신 실세예요.', plot: '지방에서 정부 정책을 거부해 지지도를 깎아요.', ally: '협력하면 지지도가 덤으로 올라요.' },
  '종교계 거물': { icon: '🕊️', kind: 'approval', deed: '설교에서 지도자를 꾸짖었어요', text: '신도 수백만을 이끄는 종교계 거물이에요.', plot: '설교·성명으로 민심을 흔들어 지지도를 깎아요.', ally: '협력하면 지지도가 덤으로 올라요.' },
  '전 정보기관장': { icon: '🕶️', kind: 'intel', deed: '정부 비밀 문서를 언론에 흘렸어요', text: '정보기관을 이끌다 밀려난, 비밀을 많이 아는 사람이에요.', plot: '비밀을 흘려 정보 점수와 의회 신뢰를 깎아요.', ally: '협력하면 정보 점수가 천천히 쌓여요.' },
  '여당 비주류': { icon: '🎭', kind: 'trust', deed: '당 안에서 지도자 교체론을 꺼냈어요', text: '같은 당이지만 지도자 자리를 노리는 여당 비주류 거물이에요.', plot: '당 안에서 흔들어 의회 신뢰를 깎아요.', ally: '협력하면 의회 신뢰가 천천히 올라요(65까지).' },
};

// ── 숫자(초안) ──
/** 이 영향력을 넘으면 방해 사건을 일으키기 시작 */
export const PLOT_MIN = 40;
/** 이 영향력을 넘는 정적이 있으면 전설의 지도자 승급이 막힘 */
export const BLOCK_AT = 70;
/** 방해 사건 간격(실제 시간) */
export const PLOT_GAP_H: [number, number] = [6, 10];
/** 새로 생긴 정적 9명의 방해 간격(조금 드뭄) */
export const PLOT_GAP_MINOR_H: [number, number] = [9, 15];
const isBig = (role: RivalRole) => BIG_ROLES.includes(role);
/** 동향 살피기로 지켜보는 시간 */
export const WATCH_HOURS = 6;
/** 견제 값(정보 점수) */
export const PRESS_INTEL = 10;
/** 회유 3번 성공하면 협력 */
export const WOO_NEED = 3;
export const wooCost = (rank: number) => 500 + rank * 200;

export const roleOf = (rv: Rival, i: number): RivalRole => rv.role ?? RIVAL_ROLES[i % RIVAL_ROLES.length];
export const influenceOf = (rv: Rival) => rv.influence ?? clamp(Math.round(25 + (rv.rate - 170) / 4), 0, 100);

/** 옛 저장·새 판: 빈 칸을 채움 */
export function ensureRivals(o: OfficerState, worldMs: number) {
  o.rivals.forEach((rv, i) => {
    if (!rv.role) rv.role = RIVAL_ROLES[i % RIVAL_ROLES.length];
    if (rv.influence === undefined) rv.influence = influenceOf(rv);
    if (rv.nextPlotMs === undefined) rv.nextPlotMs = worldMs + PLOT_GAP_H[0] * HOUR;
  });
}

export const watching = (rv: Rival, worldMs: number) => (rv.watchUntil ?? 0) > worldMs;
export const hostile = (o: OfficerState) => o.rivals.filter((r) => !r.ally);
export const hasAlly = (o: OfficerState, role: RivalRole) => o.rivals.some((r, i) => r.ally && roleOf(r, i) === role);

/** 가장 위험한 정적(영향력 70 넘는 사람 중 가장 센 사람) */
export function chiefRivalOf(o: OfficerState): Rival | null {
  const top = hostile(o).sort((a, b) => influenceOf(b) - influenceOf(a))[0];
  return top && influenceOf(top) >= BLOCK_AT ? top : null;
}

/** 모든 적대 정적의 영향력 바꾸기(승급 −, 도시를 잃으면 + 등) */
export function shiftInfluence(o: OfficerState, v: number) {
  for (const r of hostile(o)) r.influence = clamp(influenceOf(r) + v, 0, 100);
}

/** 판단마다(실제 15분): 영향력이 쌓이고, 때가 되면 방해 사건. 협력한 정적은 덤 */
export function rivalTick(ns: GameState, o: OfficerState, rng: Rng, tickMs: number) {
  ensureRivals(o, ns.worldMs);
  const h = tickMs / HOUR;
  o.rivals.forEach((rv, i) => {
    const role = roleOf(rv, i);
    if (rv.ally) {
      allyBonus(ns, o, role, tickMs);
      return;
    }
    // 하루(실제 24시간)에 약 3~5씩 쌓임
    rv.influence = clamp(influenceOf(rv) + (rv.rate / 50 / 24) * h, 0, 100);
    if (ns.worldMs < (rv.nextPlotMs ?? 0)) return;
    const gap = isBig(role) ? PLOT_GAP_H : PLOT_GAP_MINOR_H;
    rv.nextPlotMs = ns.worldMs + rng.range(gap[0], gap[1]) * HOUR;
    const inf = influenceOf(rv);
    if (inf < PLOT_MIN || !rng.chance(inf / 100)) return;
    if (watching(rv, ns.worldMs) || counterOn(ns)) {
      rv.influence = clamp(inf - 8, 0, 100);
      o.intel += 5;
      note(ns, `🕵️ ${rv.name}(${role})의 방해 공작을 미리 막았어요. 영향력 −8 · 정보 +5`);
      return;
    }
    plot(ns, o, rv, role, inf, rng);
  });
  const chief = chiefRivalOf(o);
  if (chief && o.chiefRival !== chief.name) note(ns, `⚠️ 정적 ${chief.name}의 영향력이 ${BLOCK_AT}을 넘었어요. 이대로면 전설의 지도자 호칭을 막아요.`);
  o.chiefRival = chief?.name ?? null;
}

/** 협력한 정적의 덤(판단마다) */
function allyBonus(ns: GameState, o: OfficerState, role: RivalRole, tickMs: number) {
  const h = tickMs / HOUR;
  const day = tickMs / REAL_MS_PER_GAME_DAY;
  const r = ns.player.rankIndex;
  const kind = ROLE_INFO[role].kind;
  if (kind === 'trust') {
    const cap = role === '야당 대표' ? 70 : 65;
    if (o.trust < cap) o.trust = Math.min(cap, o.trust + (role === '야당 대표' ? 0.25 : 0.15) * h);
  } else if (kind === 'money') {
    ns.player = { ...ns.player, salary: ns.player.salary + RANKS[r].salaryPerDay * (role === '재벌' ? 0.1 : 0.05) * day };
  } else if (kind === 'army' && role === '퇴역 대장') {
    for (const g of o.generals) g.loyalty = Math.min(100, g.loyalty + 0.1 * h);
  } else if (kind === 'intel') {
    o.intel += 0.5 * h;
  }
  // 지지도 덤은 approvalAllyBonus(지지도 계산)에서
}

/** 협력한 '지지도' 정적 한 명마다 지지도 +2 */
export const approvalAllyBonus = (o: OfficerState) => o.rivals.filter((r, i) => r.ally && ROLE_INFO[roleOf(r, i)].kind === 'approval').length * 2;

/** 방해 공작 하나 */
function plot(ns: GameState, o: OfficerState, rv: Rival, role: RivalRole, inf: number, rng: Rng) {
  const info = ROLE_INFO[role];
  const big = isBig(role);
  const r = ns.player.rankIndex;
  const who = `${info.icon} ${role} ${rv.name}이(가) ${info.deed}.`;
  switch (info.kind) {
    case 'trust': {
      const loss = Math.round((big ? 3 : 2) + inf / (big ? 20 : 30));
      o.trust = Math.max(0, o.trust - loss);
      note(ns, `${who} 의회 신뢰 −${loss}`);
      return;
    }
    case 'army': {
      const pool = [...o.generals.map((g) => ({ name: `${g.name} 장군`, hit: () => (g.loyalty = Math.max(0, g.loyalty - (big ? 8 : 5))) })), ...o.aides.map((a) => ({ name: `${a.name} 부관`, hit: () => (a.loyalty = Math.max(0, (a.loyalty ?? 40 + a.bond / 2) - (big ? 6 : 4))) }))];
      if (pool.length) {
        const t = rng.pick(pool);
        t.hit();
        note(ns, `${info.icon} ${role} ${rv.name}이(가) ${t.name}에게 불만을 퍼뜨렸어요. 충성 −`);
      } else {
        o.trust = Math.max(0, o.trust - 2);
        note(ns, `${info.icon} ${role} ${rv.name}이(가) 군 안에 지도자 험담을 퍼뜨렸어요. 의회 신뢰 −2`);
      }
      return;
    }
    case 'money': {
      const loss = Math.min(Math.round(ns.player.salary * (big ? 0.1 : 0.06)), (big ? 500 : 300) + r * (big ? 200 : 120));
      ns.player = { ...ns.player, salary: Math.max(0, ns.player.salary - loss) };
      note(ns, `${who} 봉급 −${loss}`);
      return;
    }
    case 'approval': {
      const v = -Math.round(2 + inf / 30);
      ns.pres = addPresMod(ns, `${info.icon} ${rv.name}(${role})`, v, 12).pres;
      note(ns, `${who} 지지도 ${v}(12시간)`);
      return;
    }
    case 'intel': {
      const lost = Math.min(o.intel, 10);
      o.intel -= lost;
      o.trust = Math.max(0, o.trust - 2);
      note(ns, `${who} 정보 −${Math.round(lost)} · 의회 신뢰 −2`);
      return;
    }
  }
}

/* ───────── 정적 명단 채우기(11/26: 3명 → 12명) ───────── */
const HOUR_INFL = (rate: number) => Math.round(25 + (rate - 170) / 4);

/** 정적들에게 그 나라 얼굴 주기: 장관·참모·부관·장군이 안 쓰는 얼굴, 되도록 60대 */
function rivalFace(used: Map<string, number>, country: string, eth: string | undefined, sex: 'm' | 'f', rng: Rng): string {
  const tag = faceTag(country, eth);
  const n = deckSize(tag, sex);
  const all = Array.from({ length: n }, (_, i) => ({ f: faceFile(tag, sex, i), old: deckSlot(tag, sex, i).band === '60' }));
  const min = Math.min(...all.map((x) => used.get(x.f) ?? 0));
  const free = all.filter((x) => (used.get(x.f) ?? 0) === min);
  const old = free.filter((x) => x.old);
  const f = rng.pick(old.length ? old : free).f;
  used.set(f, (used.get(f) ?? 0) + 1);
  return f;
}
function faceUsage(s: GameState): Map<string, number> {
  const m = new Map<string, number>();
  const add = (k?: string) => k && m.set(k, (m.get(k) ?? 0) + 1);
  for (const p of cabinetOf(s).people) if (p.face !== undefined) add(faceFile(faceTag(p.country, p.eth), p.sex, p.face));
  for (const a of s.officer.aides) add(a.faceKey);
  for (const g of s.officer.generals) add(g.faceKey);
  for (const r of s.officer.rivals) add(r.faceKey);
  return m;
}

/**
 * 새 판·옛 저장: 빠진 역할의 정적을 채우고, 얼굴이 없는 정적에게 얼굴을 줘요.
 * fresh(새 판)면 처음 3명도 그 나라 이름으로 다시 지어요(옛 이름표는 한국 이름뿐이었음).
 */
export function ensureRivalRoster(s: GameState, fresh = false): GameState {
  const o = s.officer;
  ensureRivals(o, s.worldMs);
  const country = s.player.countryId;
  const rng = new Rng(((s.world.seed ?? 1) * 31 + o.rivals.length * 7919 + 17) >>> 0);
  const taken = new Set<string>([...cabinetOf(s).people.map((p) => p.name), ...o.aides.map((a) => a.name), ...o.generals.map((g) => g.name), ...o.rivals.map((r) => r.name)]);
  const have = new Set(o.rivals.map((r, i) => roleOf(r, i)));
  const used = faceUsage(s);
  const make = (role: RivalRole): Rival => {
    const big = isBig(role);
    const sex: 'm' | 'f' = rng.chance(role === '군부 실력자' || role === '퇴역 대장' ? 0.05 : 0.3) ? 'f' : 'm';
    const nm = makeNameEth(country, sex, rng, taken);
    taken.add(nm.name);
    const rate = Math.round(big ? rng.range(170, 260) : rng.range(130, 220));
    const gap = big ? PLOT_GAP_H : PLOT_GAP_MINOR_H;
    return { name: nm.name, rate, shownRank: 0, role, influence: HOUR_INFL(rate), nextPlotMs: s.worldMs + rng.range(gap[0], gap[1]) * HOUR, sex, eth: nm.eth, faceKey: rivalFace(used, country, nm.eth, sex, rng) };
  };
  if (fresh) {
    o.rivals = o.rivals.map((rv, i) => make(roleOf(rv, i)));
  }
  for (const role of RIVAL_ROLES) if (!have.has(role)) o.rivals.push(make(role));
  for (const rv of o.rivals) {
    if (rv.faceKey) continue;
    const sex = rv.sex ?? 'm';
    rv.faceKey = rivalFace(used, country, rv.eth, sex, rng);
  }
  return s;
}

/** 가장 높은 호칭(전설의 지도자)을 막는 까닭(11-23: 승급 대신 호칭) */
export function rivalBlock(s: GameState): string | null {
  const c = chiefRivalOf(s.officer);
  return c ? `정적 ${c.name}의 영향력이 ${BLOCK_AT}을 넘어요(견제·회유 필요)` : null;
}

/** 회유 성공 확률: 정치 스탯 + 의회 신뢰, 영향력이 클수록 어려움 */
export function wooChance(s: GameState, rv: Rival): number {
  const pol = s.officer.stats['정치'] ?? 0;
  return clamp(0.25 + pol * 0.01 + (60 - influenceOf(rv)) / 200 + s.officer.trust / 400, 0.1, 0.85);
}
/** 견제로 깎는 영향력 */
export const pressAmount = (s: GameState) => Math.round(6 + (s.officer.stats['정보'] ?? 0) / 5);

/** 화면용 */
export function rivalsView(s: GameState) {
  return s.officer.rivals.map((rv, i) => ({
    name: rv.name,
    role: roleOf(rv, i),
    influence: Math.round(influenceOf(rv)),
    ally: !!rv.ally,
    woo: rv.woo ?? 0,
    watch: watching(rv, s.worldMs),
    nextPlotMs: rv.nextPlotMs ?? 0,
    faceKey: rv.faceKey,
  }));
}
