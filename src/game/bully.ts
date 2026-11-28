// 11-27 대장 요청: 대륙마다 '깡패 강대국'(data/bullies.ts).
// 깡패 나라는 판단(실제 15분)마다 일정 확률로 깡패짓을 함: 관세 폭탄·방위비 청구·영토 주장·문화 우기기·대리 세력·불공정 거래.
// 패권 전쟁도 더 자주 걸고(hegemony.ts 먹잇감 공격성 × agg), 미국·이집트는 다른 대륙까지 노림.
// 우리 나라가 당하면 외교 → 👑 패권에 '깡패짓'이 와서 🙇 굴복(돈·문화를 내줌) / ✊ 맞서기(제재·긴장·전쟁 위험, 대신 명성) 중 고름.
import { isArchRival } from '../data/archRivals';
import { ACT_ICON, BULLIES, BULLY_DEFY, BULLY_GENERIC, BULLY_SNS, CULTURE_CLAIMS, CULTURE_CLAIM_DEFAULT, type BullyAct, type BullyDoctrine } from '../data/bullies';
import { regionOf } from '../data/regions';
import { CITIES } from '../data/cities';
import { COUNTRIES, countryById } from '../data/world';
import { ME_MAX_FRONTS, aiStrength } from './balance';
import { fillSns, snsOf, SNS_MAX, type SnsPost } from './leaderSns';
import { ASK_HOURS, ASK_MAX, addTension, event, hegOf, live, mine, put, strengthScore, warsOf, type HegAsk, type Tick } from './hegemony';
import { addPresMod } from './approval';
import { cultureOf } from './culture';
import { Rng } from './rng';
import type { GameState } from './state';
import { isVassalPair, lordOf } from './surrender';
import { declareWar, deterMul, eul, ga, isAlive, pairKey, playerFronts, relationOf } from './world';

const H = 3600e3;
const nm = (id: string) => countryById(id).name;

// ── 숫자(밸런스) ──
/** 깡패 나라 하나가 판단마다 깡패짓을 할 확률(실제 하루 96번 → 하루 약 5번) */
export const BULLY_ACT = 0.05;
/** 우리 나라를 고를 가중치 배율 */
export const BULLY_ME = 3;
/** 관세: 나라 예산 깎는 몫 · 시간 */
export const BULLY_TARIFF: [number, number] = [0.1, 0.2];
export const BULLY_TARIFF_HOURS: [number, number] = [36, 72];
/** 방위비·보호비: 금고에서 뜯는 몫(AI) · 우리가 굴복할 때 내는 몫 */
export const BULLY_TRIBUTE = 0.06;
/** 영토 주장 긴장 · 대리 세력 병력 피해 · 불공정 거래 몫 */
export const BULLY_LAND_TENSION = 30;
export const BULLY_PROXY = 0.03;
export const BULLY_DEAL: [number, number] = [0.08, 0.15];
/** 문화 우기기: 그 나라 문화 몫을 빼앗음 · 우리 문화 점수 잃는 몫 */
export const BULLY_CULTURE_AI = 0.04;
export const BULLY_CULTURE_ME = 0.2;
/** 우리 나라가 굴복할 때 내는 금고 몫(깡패짓마다) */
export const GIVE_IN_COST: Record<BullyAct, number> = { tariff: 0.04, tribute: 0.06, land: 0.08, culture: 0, proxy: 0.04, deal: 0 };
/** 맞설 때 얻는 명성 */
export const RESIST_FAME: Record<BullyAct, number> = { tariff: 3, tribute: 4, land: 6, culture: 5, proxy: 3, deal: 4 };

// ── 안 B: 반깡패 연합 · 깡패 꺾기 보상 ──
/** AI 반깡패 연합: 깡패마다 판단마다 맺어질 확률 · 회원이 되려면 당한 수 · 최근 며칠 · 연합 기간 */
export const COAL_FORM = 0.03;
export const COAL_MIN_HITS = 2;
export const COAL_RECENT_DAYS = 5;
export const COAL_DAYS = 5;
/** 연합 회원에게 온 깡패짓을 막아 낼 확률 · 깡패와 싸우는 회원을 돕는 참전 확률(판단마다) */
export const COAL_BLOCK = 0.4;
export const COAL_JOIN = 0.04;
/** 우리가 이끄는 연합: 금고 몫 · 기간 · 다시 만들기까지 · 명성 */
export const MY_COAL_COST = 0.05;
export const MY_COAL_DAYS = 7;
export const MY_COAL_CD_DAYS = 3;
export const MY_COAL_FAME = 5;
/** 깡패 나라를 꺾으면(수도 차지·속국): 명성 · 지지율 (루비·가속권은 전과 보상 goals.ts 'bully') */
export const BEAT_FAME = 30;
export const BEAT_APPROVAL = 5;

/** 지금 대륙마다 깡패 나라: 정해진 나라가 살아 있고 AI면 그 나라, 아니면 그 대륙 AI 패권국이 '자국 우선' 교리로 */
export function currentBullies(s: Pick<GameState, 'world' | 'player' | 'hegemony'>): Array<{ id: string; region: string; d: BullyDoctrine; generic: boolean }> {
  const me = s.player.countryId;
  const leaders = s.hegemony?.leaders ?? {};
  const out: Array<{ id: string; region: string; d: BullyDoctrine; generic: boolean }> = [];
  const regions = [...new Set(COUNTRIES.filter((c) => isAlive(s.world, c.id)).map((c) => regionOf(c.id)))];
  for (const rid of regions) {
    const fixed = BULLIES.find((b) => b.region === rid);
    if (fixed && fixed.id !== me && isAlive(s.world, fixed.id)) {
      out.push({ id: fixed.id, region: rid, d: fixed, generic: false });
      continue;
    }
    const lead = leaders[rid];
    const others = COUNTRIES.filter((c) => regionOf(c.id) === rid && isAlive(s.world, c.id)).length;
    if (lead && lead !== me && isAlive(s.world, lead) && others > 1 && !out.some((x) => x.id === lead)) out.push({ id: lead, region: rid, d: { ...BULLY_GENERIC, id: lead, region: rid }, generic: true });
  }
  return out;
}
export function bullyDoctrineOf(s: Pick<GameState, 'world' | 'player' | 'hegemony'>, id: string): BullyDoctrine | undefined {
  return currentBullies(s).find((x) => x.id === id)?.d;
}
export const bullyStats = (s: GameState) => hegOf(s).bully ?? { acts: {}, onMe: {}, log: [] };
export const actLabel = (d: BullyDoctrine, a: BullyAct) => d.label[a] ?? BULLY_GENERIC.label[a] ?? a;

/** 깡패짓을 할 수 있는 종류(상대에 따라) */
function actsFor(k: Tick, d: BullyDoctrine, to: string): BullyAct[] {
  const out: BullyAct[] = [];
  for (const a of Object.keys(d.acts) as BullyAct[]) {
    if (a === 'culture' && regionOf(to) !== 'asia') continue;
    if (a === 'land' && relationOf(k.w, d.id, to) === '전쟁') continue;
    if (a === 'tribute' && (k.nations[to]?.treasury ?? 0) <= 0) continue;
    out.push(a);
  }
  return out;
}

function record(k: Tick, from: string, to: string, act: BullyAct, text: string) {
  const b = k.h.bully!;
  b.acts[from] = (b.acts[from] ?? 0) + 1;
  if (to === k.me) b.onMe[from] = (b.onMe[from] ?? 0) + 1;
  const key = `${from}>${to}`;
  b.hits![key] = { n: (b.hits![key]?.n ?? 0) + 1, last: k.t };
  b.log.unshift({ t: k.t, from, to, act, text });
  if (b.log.length > 30) b.log.length = 30;
}
function bullySns(k: Tick, from: string, to: string, act: BullyAct, item: string, defy: boolean) {
  const st = snsOf(k.s);
  const rng = k.rng;
  const speaker = defy ? to : from;
  const target = defy ? from : to;
  const list = defy ? BULLY_DEFY[act] : BULLY_SNS[act];
  const vars = { A: nm(from), B: nm(to), X: item };
  const likes = Math.round(rng.range(0.5, 1.4) * countryById(speaker).economy * 800);
  const post: SnsPost = { id: st.nextId, t: k.t, from: speaker, to: target, kind: 'heg', text: fillSns(rng.pick(list), vars), likes, shares: Math.round(likes * rng.range(0.1, 0.35)) };
  k.s = { ...live(k), sns: { ...st, nextId: st.nextId + 1, posts: [post, ...st.posts].slice(0, SNS_MAX) } };
}
/** "김치는 원래 우리 것" */
export const claimLine = (item: string) => fillSns('{X:은} 원래 우리 것', { X: item });
const claimItem = (rng: Rng, to: string) => rng.pick(CULTURE_CLAIMS[to] ?? CULTURE_CLAIM_DEFAULT);

/** 문화 우기기를 AI 나라에: 그 나라 문화 일부를 깡패 나라가 가져감(우리 문화 상태 안의 AI 문화 기록) */
function stealAiCulture(k: Tick, from: string, to: string) {
  const c = k.s.culture;
  if (!c) return;
  const v = (c.ai[to] ?? 0) * BULLY_CULTURE_AI;
  k.s = { ...live(k), culture: { ...c, ai: { ...c.ai, [to]: (c.ai[to] ?? 0) - v, [from]: (c.ai[from] ?? 0) + v } } };
}

/** 깡패짓을 AI 나라에 바로 함 */
function hitAi(k: Tick, d: BullyDoctrine, to: string, act: BullyAct) {
  if (coalBlocks(k, d, to, act)) return;
  const { w, h, rng, t, me, nations } = k;
  const from = d.id;
  const lab = actLabel(d, act);
  let text = '';
  let item = '';
  if (act === 'tariff') {
    const rate = Math.round(rng.range(...BULLY_TARIFF) * 100) / 100;
    put(h.sanctions, { from, to, rate, untilMs: t + rng.range(...BULLY_TARIFF_HOURS) * H });
    h.stats!.sanctions++;
    addTension(w, from, to, 8);
    text = `${ACT_ICON.tariff} ${d.icon} ${ga(nm(from))} ${nm(to)}에 ${lab}! 예산 −${Math.round(rate * 100)}%.${relationOf(w, from, to) === '연합' ? ' 동맹인데도 봐주지 않아요.' : ''}`;
  } else if (act === 'tribute') {
    const v = Math.round((nations[to]?.treasury ?? 0) * BULLY_TRIBUTE);
    const fear = Math.min(0.85, Math.max(0.25, 1 - strengthScore(live(k), to) / Math.max(1, strengthScore(live(k), from))));
    if (rng.chance(fear)) {
      nations[to] = { ...nations[to], treasury: nations[to].treasury - v };
      nations[from] = { ...nations[from], treasury: nations[from].treasury + v };
      text = `${ACT_ICON.tribute} ${d.icon} ${ga(nm(from))} ${nm(to)}에 ${lab}. ${ga(nm(to))} 겁먹고 ${v.toLocaleString('ko-KR')}을 냈어요.`;
    } else {
      addTension(w, from, to, 20);
      if (relationOf(w, from, to) === '연합' && !isVassalPair(k.s, from, to)) {
        const p = w.pairs[pairKey(from, to)];
        p.rel = '중립';
        p.tension = 45;
        h.stats!.breaks++;
      }
      put(h.sanctions, { from, to, rate: 0.15, untilMs: t + 48 * H });
      text = `${ACT_ICON.tribute} ${d.icon} ${nm(from)}의 ${lab}에 ${ga(nm(to))} 버텼어요. 보복 제재 −15%.`;
      if (rng.chance(0.6)) bullySns(k, from, to, act, '', true);
    }
  } else if (act === 'land') {
    const v = addTension(w, from, to, BULLY_LAND_TENSION * rng.range(0.7, 1.3));
    text = `${ACT_ICON.land} ${d.icon} ${ga(nm(from))} ${nm(to)}에 ${lab}! 긴장 ${Math.round(v)}.`;
    if (v >= 100 && warsOf(w, from).length < 3 && !isVassalPair(k.s, from, to)) {
      declareWar(w, t, me, from, to, `${d.name}를 외치며 '역사적 영토'를 되찾겠다고`);
      h.stats!.wars++;
    }
  } else if (act === 'culture') {
    item = claimItem(rng, to);
    stealAiCulture(k, from, to);
    addTension(w, from, to, 12);
    text = `${ACT_ICON.culture} ${d.icon} ${ga(nm(from))} "${claimLine(item)}"이라 우겨요! ${nm(to)} 문화 −${Math.round(BULLY_CULTURE_AI * 100)}%.`;
  } else if (act === 'proxy') {
    const v = Math.round((nations[to]?.troops ?? 0) * BULLY_PROXY);
    nations[to] = { ...nations[to], troops: Math.max(0, nations[to].troops - v) };
    addTension(w, from, to, 15);
    text = `${ACT_ICON.proxy} ${d.icon} ${nm(from)}의 ${lab}! ${nm(to)} 병력 −${v.toLocaleString('ko-KR')}명. ${ga(nm(from))} "우리와 상관없다"고 해요.`;
  } else {
    const drain = Math.round(rng.range(...BULLY_DEAL) * 100) / 100;
    put(h.squeezes, { from, to, res: lab, drain, untilMs: t + 72 * H });
    h.stats!.squeezes++;
    text = `${ACT_ICON.deal} ${d.icon} ${ga(nm(from))} ${nm(to)}에 ${eul(lab)} 강요했어요. ${nm(to)} 예산 −${Math.round(drain * 100)}%.`;
  }
  event(w, t, text, me, from, to);
  record(k, from, to, act, text);
  if (rng.chance(0.55)) bullySns(k, from, to, act, item, false);
  else if (act === 'culture' && rng.chance(0.5)) bullySns(k, from, to, act, item, true);
}

/** 우리 나라에 온 깡패짓: 요구로 받아 고름 */
function hitMe(k: Tick, d: BullyDoctrine, act: BullyAct) {
  if (coalBlocks(k, d, k.me, act)) return;
  if (!k.rng.chance(deterMul(k.w, k.me, d.id))) return; // 11-28 ICBM 억지력: 요구가 덜 옴
  const { w, h, rng, t, me, nations } = k;
  if (h.asks.filter((x) => x.kind === 'bully').length >= ASK_MAX - 1 || h.asks.some((x) => x.kind === 'bully' && x.from === d.id)) return;
  const item = act === 'culture' ? claimItem(rng, me) : '';
  const cost = Math.round((nations[me]?.treasury ?? 0) * GIVE_IN_COST[act]);
  h.asks.push({ id: h.nextId++, kind: 'bully', from: d.id, act, item, cost, untilMs: t + ASK_HOURS * H });
  const lab = actLabel(d, act);
  const text = `${ACT_ICON[act]} ${d.icon} ${ga(nm(d.id))} 우리에게 ${lab}${item ? `: "${claimLine(item)}"` : ''}! 외교 → 패권에서 ${ASK_HOURS}시간 안에 굴복할지 맞설지 고르세요.`;
  event(w, t, text, me, d.id, me);
  record(k, d.id, me, act, text);
  bullySns(k, d.id, me, act, item, false);
}

/** 판단마다: 깡패 나라들의 깡패짓 + 우리가 답하지 않은 깡패짓은 맞선 것으로 침 */
export function bullyTick(s: GameState): GameState {
  if (s.ending) return s;
  const k = mine(s);
  k.rng = new Rng((Math.floor(s.worldMs / 60e3) * 2654435761 + s.world.seed * 31 + 7) >>> 0);
  const { h, rng, t, me, w } = k;
  for (const a of h.asks.filter((x) => x.kind === 'bully' && x.untilMs <= t)) {
    h.asks = h.asks.filter((x) => x.id !== a.id);
    if (isAlive(w, a.from)) resist(k, a, true);
  }
  const bullies = currentBullies(s);
  checkBeaten(k);
  coalTick(k, bullies.map((b) => b.id));
  if (!bullies.length) return live(k);
  const meFull = playerFronts(w, me) >= ME_MAX_FRONTS;
  for (const b of bullies) {
    const d = b.d;
    if (!rng.chance(BULLY_ACT * Math.min(1.5, aiStrength(d.id, me) / 1.5))) continue;
    const my = strengthScore(s, d.id);
    const cands = COUNTRIES.map((c) => c.id).filter((id) => {
      if (id === d.id || !isAlive(w, id) || isVassalPair(s, d.id, id)) return false;
      if (!d.global && regionOf(id) !== b.region && !isArchRival(d.id, id)) return false;
      if (!d.hitsAllies && relationOf(w, d.id, id) === '연합') return false;
      return d.anyTarget || strengthScore(s, id) < my * 1.3;
    });
    const to = rng.weighted(cands, (id) => (regionOf(id) === b.region ? 3 : 1) * (isArchRival(d.id, id) ? 2.5 : 1) * (id === me ? BULLY_ME : 1));
    if (!to) continue;
    const acts = actsFor(k, d, to).filter((a) => !(to === me && meFull && a === 'land'));
    const act = rng.weighted(acts, (a) => d.acts[a] ?? 1);
    if (!act) continue;
    if (to === me) hitMe(k, d, act);
    else hitAi(k, d, to, act);
  }
  return live(k);
}

// ── 우리 나라가 답하기 ──

export const bullyAsks = (s: GameState) => hegOf(s).asks.filter((a) => a.kind === 'bully' && a.untilMs > s.worldMs);

/** 굴복하면 무엇을 잃는지 · 맞서면 무엇이 오는지(화면) */
export function bullyChoice(a: HegAsk): { giveIn: string; resist: string } {
  const c = (a.cost ?? 0).toLocaleString('ko-KR');
  switch (a.act) {
    case 'tariff':
      return { giveIn: `💰 ${c} 내고 관세 피하기`, resist: '관세 맞기(예산 −15~20%, 2~3일) · 명성 +' };
    case 'tribute':
      return { giveIn: `💰 ${c} 내기`, resist: '거절(보복 제재 −15%, 동맹이면 깨짐) · 명성 +' };
    case 'land':
      return { giveIn: `💰 ${c} 주고 달래기(긴장 −20)`, resist: `"한 뼘도 못 준다"(긴장 +${BULLY_LAND_TENSION}, 전쟁 위험) · 명성 +` };
    case 'culture':
      return { giveIn: `못 본 척(문화 점수 −${Math.round(BULLY_CULTURE_ME * 100)}%·지지율 −)`, resist: '세계에 반박(긴장 +12) · 명성·지지율 +' };
    case 'proxy':
      return { giveIn: `💰 ${c} 내고 잠잠하게`, resist: `소탕 작전(병력 −${Math.round(BULLY_PROXY * 100)}%) · 명성 +` };
    default:
      return { giveIn: '계약 받기(4일 예산 −8~15%)', resist: '거절(보복 제재 −20%) · 명성 +' };
  }
}

function resist(k: Tick, a: HegAsk, timeout: boolean): string {
  const { w, h, t, me, nations, rng } = k;
  const from = a.from;
  const act = a.act ?? 'tariff';
  const d = bullyDoctrineOf(live(k), from) ?? { ...BULLY_GENERIC, id: from };
  let text = '';
  if (act === 'tariff') {
    const rate = Math.round(rng.range(0.15, 0.2) * 100) / 100;
    put(h.sanctions, { from, to: me, rate, untilMs: t + rng.range(48, 72) * H });
    h.stats!.sanctions++;
    addTension(w, from, me, 10);
    text = `${nm(from)}의 ${actLabel(d, act)}을(를) 맞았어요. 예산 −${Math.round(rate * 100)}%.`;
  } else if (act === 'tribute') {
    addTension(w, from, me, 20);
    put(h.sanctions, { from, to: me, rate: 0.15, untilMs: t + 48 * H });
    h.stats!.sanctions++;
    if (relationOf(w, from, me) === '연합' && !isVassalPair(k.s, from, me)) {
      const p = w.pairs[pairKey(from, me)];
      p.rel = '중립';
      p.tension = 45;
      text = `${nm(from)}에 돈을 안 냈어요. 화가 나 연합을 깨고 보복 제재 −15%.`;
    } else text = `${nm(from)}에 돈을 안 냈어요. 보복 제재 −15%.`;
  } else if (act === 'land') {
    const v = addTension(w, from, me, BULLY_LAND_TENSION);
    text = `${nm(from)}의 영토 주장에 맞섰어요. 긴장 ${Math.round(v)}.`;
    if (v >= 100 && !(w.act === 1) && playerFronts(w, me) < ME_MAX_FRONTS) {
      declareWar(w, t, me, from, me, `${d.name}를 외치며 '역사적 영토'를 되찾겠다고`);
      h.stats!.wars++;
      text += ' 결국 전쟁이 났어요!';
    }
  } else if (act === 'culture') {
    addTension(w, from, me, 12);
    text = timeout ? `${nm(from)}의 문화 우기기에 대꾸하지 않았어요. 문화 점수를 지켰지만 긴장 +12.` : `"${a.item}"${fillSns('{X:은}', { X: a.item ?? '' }).slice((a.item ?? '').length)} 우리 문화라고 세계에 반박했어요! 긴장 +12.`;
  } else if (act === 'proxy') {
    const v = Math.round((nations[me]?.troops ?? 0) * BULLY_PROXY);
    nations[me] = { ...nations[me], troops: Math.max(0, nations[me].troops - v) };
    addTension(w, from, me, 15);
    text = `${nm(from)}의 무장 세력을 소탕했어요. 병력 −${v.toLocaleString('ko-KR')}명.`;
  } else {
    addTension(w, from, me, 25);
    put(h.sanctions, { from, to: me, rate: 0.2, untilMs: t + 72 * H });
    h.stats!.sanctions++;
    text = `${nm(from)}의 ${actLabel(d, act)}을(를) 거절했어요. 보복 제재 −20%(3일).`;
  }
  const fame = timeout ? 0 : RESIST_FAME[act];
  if (fame) {
    text += ` 명성 +${fame}.`;
    k.s = { ...live(k), officer: { ...k.s.officer, fame: Math.min(1000, (k.s.officer.fame ?? 0) + fame) } };
  }
  event(w, t, `✊ ${text}`, me, from);
  if (!timeout) bullySns(k, from, me, act, a.item ?? '', true);
  return text;
}

/** 깡패짓에 답하기: giveIn = 굴복 */
export function answerBully(s: GameState, askId: number, giveIn: boolean): { state: GameState; text: string } {
  const a = bullyAsks(s).find((x) => x.id === askId);
  if (!a) return { state: s, text: '' };
  const k = mine(s);
  k.h.asks = k.h.asks.filter((x) => x.id !== askId);
  const { w, h, t, me, nations } = k;
  const act = a.act ?? 'tariff';
  if (!giveIn) {
    const text = resist(k, a, false);
    let out = live(k);
    if (act === 'culture') out = addPres(out, '문화 지키기', 3);
    return { state: out, text };
  }
  let text: string;
  if (act === 'culture') {
    const c = cultureOf(s);
    k.s = { ...live(k), culture: { ...c, points: Math.round(c.points * (1 - BULLY_CULTURE_ME)) } };
    addTension(w, a.from, me, -5);
    text = `${nm(a.from)}의 문화 우기기를 못 본 척했어요. 문화 점수 −${Math.round(BULLY_CULTURE_ME * 100)}%.`;
    event(w, t, `🙇 ${text}`, me, a.from);
    return { state: addPres(live(k), '문화 뺏김', -3), text: text + ' 지지율 −3.' };
  }
  if (act === 'deal') {
    const drain = Math.round((BULLY_DEAL[0] + BULLY_DEAL[1]) * 50) / 100;
    put(h.squeezes, { from: a.from, to: me, res: '불공정 계약', drain, untilMs: t + 96 * H });
    h.stats!.squeezes++;
    addTension(w, a.from, me, -15);
    text = `${nm(a.from)}의 계약을 받았어요. 4일 동안 나라 예산 −${Math.round(drain * 100)}% · 긴장 −15.`;
  } else {
    const cost = Math.min(a.cost ?? 0, nations[me]?.treasury ?? 0);
    nations[me] = { ...nations[me], treasury: nations[me].treasury - cost };
    if (nations[a.from]) nations[a.from] = { ...nations[a.from], treasury: nations[a.from].treasury + cost };
    addTension(w, a.from, me, act === 'land' ? -20 : -10);
    text = `${nm(a.from)}에 ${cost.toLocaleString('ko-KR')}을 내고 넘어갔어요. 긴장 ${act === 'land' ? '−20' : '−10'}.`;
  }
  event(w, t, `🙇 ${text}`, me, a.from);
  return { state: live(k), text };
}

function addPres(s: GameState, why: string, v: number): GameState {
  return addPresMod(s, why, v, 24);
}

// ── 반깡패 연합 ──

const coalOf = (k: Tick | GameState, bully: string) => {
  const c = ('h' in k ? k.h.bully?.coal : hegOf(k).bully?.coal)?.[bully];
  const t = 'h' in k ? k.t : k.worldMs;
  return c && c.untilMs > t ? c : undefined;
};
/** 그 나라가 들어 있는 반깡패 연합(깡패 → 회원) */
export function coalitionsOf(s: GameState, id: string): string[] {
  const me = s.player.countryId;
  return Object.entries(hegOf(s).bully?.coal ?? {})
    .filter(([, c]) => c.untilMs > s.worldMs && (c.members.includes(id) || (c.mine && id === me)))
    .map(([b]) => b);
}
const inCoal = (k: Tick, bully: string, id: string) => {
  const c = coalOf(k, bully);
  return !!c && (c.members.includes(id) || (c.mine && id === k.me));
};

/** 연합 회원에게 온 깡패짓을 연합이 막아 냄 */
function coalBlocks(k: Tick, d: BullyDoctrine, to: string, act: BullyAct): boolean {
  if (!inCoal(k, d.id, to) || !k.rng.chance(COAL_BLOCK)) return false;
  addTension(k.w, d.id, to, 5);
  const text = `🛡️ 반깡패 연합이 ${nm(d.id)}의 ${actLabel(d, act)}을(를) 막아 냈어요(${nm(to)}).`;
  event(k.w, k.t, text, k.me, d.id, to);
  return true;
}

const COAL_SNS = [
  '"{B} 혼자가 아닙니다. 오늘부터 우리는 함께 {E}에 맞섭니다."',
  '"{E}의 깡패짓은 여기까지입니다. 반깡패 연합이 출범했습니다."',
  '"작은 나라도 뭉치면 큽니다. {E}, 이제 우리 모두를 상대하세요."',
];
function coalSns(k: Tick, from: string, to: string | undefined, bully: string) {
  const st = snsOf(k.s);
  const likes = Math.round(k.rng.range(0.6, 1.5) * countryById(from).economy * 900);
  const post: SnsPost = { id: st.nextId, t: k.t, from, to, kind: from === k.me ? 'mine' : 'ally', text: fillSns(k.rng.pick(COAL_SNS), { A: nm(from), B: to ? nm(to) : '친구들', E: nm(bully) }), likes, shares: Math.round(likes * k.rng.range(0.15, 0.4)) };
  k.s = { ...live(k), sns: { ...st, nextId: st.nextId + 1, posts: [post, ...st.posts].slice(0, SNS_MAX) } };
}

/** 그 깡패에게 최근 당한 나라(많이 당한 순) */
export function victimsOf(s: GameState | Tick, bully: string, days = COAL_RECENT_DAYS, min = 1): Array<{ id: string; n: number }> {
  const hits = ('h' in s ? s.h.bully?.hits : hegOf(s).bully?.hits) ?? {};
  const t = 'h' in s ? s.t : s.worldMs;
  const w = 'w' in s ? s.w : s.world;
  return Object.entries(hits)
    .filter(([key, v]) => key.startsWith(`${bully}>`) && v.n >= min && t - v.last <= days * 24 * H)
    .map(([key, v]) => ({ id: key.slice(bully.length + 1), n: v.n }))
    .filter((x) => isAlive(w, x.id))
    .sort((a, b) => b.n - a.n);
}

/** 판단마다: AI 약소국들이 반깡패 연합을 맺고, 연합 회원이 깡패와 싸우면 함께 참전 */
function coalTick(k: Tick, bullies: string[]) {
  const { w, h, rng, t, me } = k;
  for (const b of bullies) {
    if (coalOf(k, b) || !rng.chance(COAL_FORM)) continue;
    const vs = victimsOf(k, b, COAL_RECENT_DAYS, COAL_MIN_HITS)
      .map((x) => x.id)
      .filter((id) => id !== me && relationOf(w, id, b) !== '연합' && !isVassalPair(k.s, id, b));
    const members: string[] = [];
    for (const id of vs) {
      if (members.length >= 4) break;
      if (members.every((m) => relationOf(w, m, id) !== '전쟁')) members.push(id);
    }
    if (members.length < 2) continue;
    for (let i = 0; i < members.length; i++)
      for (let j = i + 1; j < members.length; j++) {
        const p = w.pairs[pairKey(members[i], members[j])];
        if (p && (p.rel === '중립' || p.rel === '휴전')) {
          p.rel = '연합';
          p.tension = 0;
          h.stats!.allies++;
        }
      }
    for (const m of members) addTension(w, m, b, 15);
    h.bully!.coal![b] = { members, mine: false, untilMs: t + COAL_DAYS * 24 * H };
    event(w, t, `🛡️ ${members.map(nm).join('·')}이(가) ${nm(b)}의 깡패짓에 맞서 반깡패 연합을 맺었어요!`, me, b, ...members);
    coalSns(k, members[0], members[1], b);
  }
  // 회원이 깡패와 싸우면 다른 회원이 함께 참전(우리 나라는 저절로 참전하지 않음)
  for (const [b, c] of Object.entries(h.bully!.coal!)) {
    if (c.untilMs <= t || !isAlive(w, b)) continue;
    const side = [...c.members, ...(c.mine ? [me] : [])].filter((id) => isAlive(w, id));
    if (!side.some((id) => relationOf(w, id, b) === '전쟁')) continue;
    for (const m of c.members) {
      if (m === me || !isAlive(w, m) || relationOf(w, m, b) === '전쟁' || warsOf(w, m).length >= 3 || isVassalPair(k.s, m, b)) continue;
      if (!rng.chance(COAL_JOIN)) continue;
      declareWar(w, t, me, m, b, '반깡패 연합으로');
      h.stats!.wars++;
    }
  }
}

/** 우리가 반깡패 연합을 만들 때 부를 수 있는 나라와 들어올 확률 */
export function myCoalCands(s: GameState, bully: string): Array<{ id: string; n: number; chance: number }> {
  const me = s.player.countryId;
  const w = s.world;
  const vs = victimsOf(s, bully, 7, 1);
  const ids = new Set([...vs.map((x) => x.id), ...COUNTRIES.map((c) => c.id).filter((id) => isArchRival(id, bully))]);
  return [...ids]
    .filter((id) => id !== me && id !== bully && isAlive(w, id) && relationOf(w, id, me) !== '전쟁' && relationOf(w, id, bully) !== '연합' && !isVassalPair(s, id, bully))
    .map((id) => {
      const n = vs.find((x) => x.id === id)?.n ?? 0;
      const tz = w.pairs[pairKey(id, me)]?.tension ?? 0;
      const p = 0.3 + 0.12 * Math.min(4, n) + (isArchRival(id, bully) ? 0.25 : 0) + (relationOf(w, id, me) === '연합' ? 0.3 : 0) - tz / 150;
      return { id, n, chance: Math.max(0.05, Math.min(0.9, p)) };
    })
    .sort((a, b) => b.chance - a.chance);
}
export const myCoalCost = (s: GameState) => Math.round((s.nations[s.player.countryId]?.treasury ?? 0) * MY_COAL_COST);
export function canMyCoal(s: GameState, bully: string): string | null {
  const b = hegOf(s).bully;
  if (!currentBullies(s).some((x) => x.id === bully)) return '깡패 나라가 아니에요';
  const c = coalOf(s, bully);
  if (c?.mine) return '이미 우리가 이끄는 연합이 있어요';
  if ((b?.myCoalCd ?? 0) > s.worldMs) return `다시 만들기까지 ${Math.ceil(((b?.myCoalCd ?? 0) - s.worldMs) / 60e3)}분`;
  const me = s.player.countryId;
  if (!(b?.onMe?.[bully] ?? 0) && relationOf(s.world, me, bully) !== '전쟁') return '우리가 당했거나 싸우는 깡패에게만';
  if (!myCoalCands(s, bully).length) return '부를 나라가 없어요';
  return null;
}
/** 우리가 반깡패 연합을 이끔: 후보 나라마다 확률로 들어와 우리와 연합 */
export function makeMyCoal(s: GameState, bully: string): { state: GameState; text: string } {
  if (canMyCoal(s, bully)) return { state: s, text: '' };
  const k = mine(s);
  const { w, h, t, me, nations, rng } = k;
  const cost = myCoalCost(s);
  nations[me] = { ...nations[me], treasury: nations[me].treasury - cost };
  const cands = myCoalCands(s, bully).slice(0, 6);
  const joined: string[] = [];
  for (const c of cands) {
    if (!rng.chance(c.chance)) continue;
    joined.push(c.id);
    const p = w.pairs[pairKey(c.id, me)];
    if (p && (p.rel === '중립' || p.rel === '휴전')) {
      p.rel = '연합';
      p.tension = 0;
      h.stats!.allies++;
    }
    addTension(w, c.id, bully, 15);
  }
  h.bully!.myCoalCd = t + MY_COAL_CD_DAYS * 24 * H;
  if (!joined.length) {
    nations[me] = { ...nations[me], treasury: nations[me].treasury + Math.round(cost / 2) };
    const text = `반깡패 연합을 제안했지만 아무도 ${nm(bully)}에 맞서려 하지 않았어요. 비용 절반을 돌려받았어요.`;
    event(w, t, `🛡️ ${text}`, me, bully);
    return { state: live(k), text };
  }
  const old = coalOf(k, bully);
  h.bully!.coal![bully] = { members: [...new Set([...(old?.members ?? []), ...joined])], mine: true, untilMs: t + MY_COAL_DAYS * 24 * H };
  addTension(w, me, bully, 20);
  const text = `우리가 이끄는 반깡패 연합 출범! ${joined.map(nm).join('·')}이(가) ${nm(bully)}에 함께 맞서요(${MY_COAL_DAYS}일). 명성 +${MY_COAL_FAME}.`;
  event(w, t, `🛡️ ${text}`, me, bully, ...joined);
  coalSns(k, me, joined[0], bully);
  const out = live(k);
  return { state: { ...out, officer: { ...out.officer, fame: Math.min(1000, (out.officer.fame ?? 0) + MY_COAL_FAME) } }, text };
}

// ── 깡패 꺾기 ──

/** 깡패 나라를 꺾었나: 그 나라 수도를 우리가 차지했거나 우리 속국이 됨 */
export function isBeaten(s: Pick<GameState, 'world' | 'player' | 'vassal'>, id: string): boolean {
  const me = s.player.countryId;
  const cap = CITIES.find((c) => c.home === id && c.capital);
  return lordOf(s, id) === me || (!!cap && s.world.owner[cap.id] === me);
}
export const beatenCount = (s: GameState) => hegOf(s).bully?.beaten?.length ?? 0;

function checkBeaten(k: Tick) {
  const b = k.h.bully!;
  const ids = new Set([...BULLIES.map((x) => x.id), ...Object.keys(b.acts)]);
  for (const id of ids) {
    if (id === k.me || b.beaten!.includes(id) || !(b.acts[id] ?? 0)) continue;
    if (!isBeaten({ world: k.w, player: k.s.player, vassal: k.s.vassal }, id)) continue;
    b.beaten!.push(id);
    const d = BULLIES.find((x) => x.id === id);
    const text = `🏆 깡패 강대국 ${nm(id)}${d ? `(${d.name})` : ''}을(를) 꺾었어요! 명성 +${BEAT_FAME} · 지지율 +${BEAT_APPROVAL} · 전과 보상(상점)에서 루비·가속권.`;
    event(k.w, k.t, text, k.me, id);
    const vs = victimsOf(k, id, 30, 1).filter((x) => x.id !== k.me);
    if (vs.length) {
      const st = snsOf(k.s);
      const from = vs[0].id;
      const post: SnsPost = { id: st.nextId, t: k.t, from, to: k.me, kind: 'ally', text: fillSns('"고마워요, {B}! {E}의 깡패짓이 드디어 끝났습니다. 세계가 숨을 쉽니다."', { B: nm(k.me), E: nm(id) }), likes: Math.round(countryById(from).economy * 1500), shares: Math.round(countryById(from).economy * 400) };
      k.s = { ...live(k), sns: { ...st, nextId: st.nextId + 1, posts: [post, ...st.posts].slice(0, SNS_MAX) } };
    }
    const out = addPresMod(live(k), `깡패 ${nm(id)} 꺾음`, BEAT_APPROVAL, 72);
    k.s = { ...out, officer: { ...out.officer, fame: Math.min(1000, (out.officer.fame ?? 0) + BEAT_FAME) } };
  }
}
