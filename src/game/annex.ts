// 점령 도시 영토 편입(11-25 대장 결정: 제안서 추천안 그대로).
//  군정(점령 직후, 하루) → 민정(치안 확보, 수입 75%·반란 절반·민심 +) → 민심 60을 3일 지키면 주민투표(하루 뒤 결과) → 편입.
//  편입하면 '우리 땅'으로 대접: 수입·자원·생산 100%, 민심 바탕 65, 반란 없음, 본토 방어 보너스, 지도 빗금 없음.
//  원래 나라 수도도 편입할 수 있지만 찬성률이 낮음. 원래 나라가 망했으면 군정 기간 절반·찬성률 +10.
//  강화 조약으로 넘겨받은 도시는 민정부터 시작하고 투표 없이 편입(국제 반발 절반).
//  편입하면 원래 나라 호감 크게 ↓, 같은 진영 나라 호감 조금 ↓.
//  상태는 world.annex(진행) · world.annexed(끝난 것). 주인이 바뀌면 territory.noteCapture가 지움.
import { FRONT, cityById } from '../data/cities';
import { COUNTRIES, countryById } from '../data/world';
import type { GameState } from './state';
import { addFavorNote, cityCiv, registerCityLoyaltyRows } from './civ';
import { buildingEff } from './economy';
import { ministryPower } from './cabinet';
import { pushReport } from './report';
import { Rng } from './rng';
import { canDiplo, diploChance, DIPLO_COOLDOWN_HOURS } from './command';
import { eul, homeOf, isAlive, pairKey, relationOf, sameBloc, syncFollowers, type AnnexCity, type WorldEvent } from './world';
import { noteCapture } from './territory';
import { REVIVE_TROOPS } from './balance';

const H = 3600e3;
/** 군정 기간(시간) */
export const MIL_HOURS = 24;
/** 투표를 열 수 있는 민심 */
export const ANNEX_LOYALTY = 60;
/** 민심을 지켜야 하는 시간 */
export const OK_HOURS = 72;
/** 투표 결과까지 */
export const VOTE_HOURS = 24;
/** 떨어진 뒤 다시 열기까지 */
export const RETRY_HOURS = 48;
/** 편입 반발(호감) */
export const ANNEX_FAVOR_HOME = -30;
export const ANNEX_FAVOR_BLOC = -8;
/** 군정·민정 민심 */
export const MIL_LOYALTY = -8;
export const CIVIL_LOYALTY = 12;
/** 강화 조약 성공 확률 = 휴전 확률 × 이것 */
export const CEDE_RATE = 0.75;

const annexOf = (s: GameState) => s.world.annex ?? {};
/** 편입 진행(내정 도시는 따라가는 점령 도시의 진행을 봄) */
export const annexEntry = (s: GameState, cityId: string): AnnexCity | null => annexOf(s)[cityById(cityId).hub] ?? null;
export const isAnnexed = (s: GameState, cityId: string) => s.world.annexed?.[cityId] === s.player.countryId;
/** 편입한 도시 수 */
export const annexedCount = (s: GameState) => Object.entries(s.world.annexed ?? {}).filter(([id, who]) => who === s.player.countryId && s.world.owner[id] === who).length;

/** 편입할 수 있는 점령지(내 것이지만 아직 우리 땅이 아님) */
export function occupiedCities(s: GameState): string[] {
  const me = s.player.countryId;
  return FRONT.filter((c) => s.world.owner[c.id] === me && homeOf(s.world, c.id) !== me).map((c) => c.id);
}

/** 군정 기간(ms): 치안청이 있으면 최대 절반, 원래 나라가 망했으면 절반 */
export function milMs(s: GameState, cityId: string): number {
  const home = cityById(cityId).home;
  return MIL_HOURS * H * (1 - 0.5 * Math.min(1, buildingEff(s, '치안청'))) * (isAlive(s.world, home) ? 1 : 0.5);
}

/** 주민투표 예상 찬성률(%) */
export function voteYes(s: GameState, cityId: string): { pct: number; rows: Array<[string, number]> } {
  const c = cityById(cityId);
  const me = s.player.countryId;
  const loy = cityCiv(s, cityId).loyalty;
  const rows: Array<[string, number]> = [['민심', Math.round(loy * 0.8)], ['기본', 15]];
  if (countryById(me).faith !== countryById(c.home).faith) rows.push(['다른 신앙', -10]);
  if (c.capital) rows.push(['원래 나라 수도', -10]);
  if (!isAlive(s.world, c.home)) rows.push(['원래 나라가 사라짐', 10]);
  else if (relationOf(s.world, me, c.home) === '전쟁') rows.push(['원래 나라 선전(전쟁 중)', -5]);
  const prop = annexEntry(s, cityId)?.propaganda ?? 0;
  if (prop) rows.push(['📻 선전 방송', prop]);
  const mois = Math.round(Math.min(10, ministryPower(s, 'mois') * 2));
  if (mois) rows.push(['🏛️ 행정안전부', mois]);
  const pct = Math.max(5, Math.min(95, rows.reduce((a, [, v]) => a + v, 0)));
  return { pct, rows };
}

/** 주민투표를 열 수 있는지(안 되면 이유) */
export function canVote(s: GameState, cityId: string): string | null {
  const a = annexEntry(s, cityId);
  if (!cityById(cityId).front) return `${cityById(cityById(cityId).hub).name}에서 투표하면 함께 편입돼요`;
  if (!a || s.world.owner[cityId] !== s.player.countryId) return '편입할 수 있는 점령지가 아니에요';
  if (a.mode === 'puppet') return '꼭두각시 정부 도시는 편입하지 않아요';
  if (a.treaty) return '조약으로 받은 도시라 투표 없이 편입돼요';
  if (a.stage === '군정') return '군정이 끝나야 해요';
  if (a.voteAt) return '투표 중이에요';
  if (s.worldMs < a.retryMs) return `${Math.ceil((a.retryMs - s.worldMs) / H)}시간 뒤 다시 열 수 있어요`;
  if (a.okSince == null) return `민심 ${ANNEX_LOYALTY} 이상이 되어야 해요`;
  const left = a.okSince + OK_HOURS * H - s.worldMs;
  if (left > 0) return `민심 ${ANNEX_LOYALTY} 이상을 ${Math.ceil(left / H)}시간 더 지켜야 해요`;
  return null;
}

export function startVote(s: GameState, cityId: string): GameState {
  if (canVote(s, cityId)) return s;
  const a = annexEntry(s, cityId)!;
  const c = cityById(cityId);
  const ev: WorldEvent = { t: s.worldMs, kind: '외교', text: `🗳️ ${c.name} 편입 주민투표를 열었어요. 결과는 ${VOTE_HOURS}시간 뒤(예상 찬성 ${voteYes(s, cityId).pct}%).`, mine: true };
  return setEntry({ ...s, world: { ...s.world, events: [ev, ...s.world.events] } }, cityId, { ...a, voteAt: s.worldMs + VOTE_HOURS * H });
}

function setEntry(s: GameState, cityId: string, a: AnnexCity | null): GameState {
  const annex = { ...annexOf(s) };
  if (a) annex[cityId] = a;
  else delete annex[cityId];
  return { ...s, world: { ...s.world, annex } };
}

/** 편입 마무리: 우리 땅으로 · 다른 나라 반발 · 부관 보고 */
function finishAnnex(s: GameState, cityId: string, how: string): GameState {
  const me = s.player.countryId;
  const c = cityById(cityId);
  const a = annexEntry(s, cityId);
  const k = a?.treaty ? 0.5 : 1;
  let out = setEntry(s, cityId, null);
  out = { ...out, world: { ...out.world, annexed: { ...(out.world.annexed ?? {}), [cityId]: me } } };
  const ev: WorldEvent = { t: s.worldMs, kind: '점령', text: `🗺️ ${c.name}, ${how} 우리 영토로 편입됐어요.`, mine: true };
  out = { ...out, world: { ...out.world, events: [ev, ...out.world.events] } };
  if (isAlive(out.world, c.home)) out = addFavorNote(out, c.home, `🗺️ ${c.name} 편입`, ANNEX_FAVOR_HOME * k);
  for (const o of COUNTRIES) {
    if (o.id === me || o.id === c.home || !isAlive(out.world, o.id) || !sameBloc(o.id, c.home)) continue;
    out = addFavorNote(out, o.id, '🗺️ 남의 땅 편입', ANNEX_FAVOR_BLOC * k);
  }
  return pushReport(out, { icon: '🗺️', text: `대장님, ${c.name}${hasJong(c.name) ? '이' : '가'} 오늘부터 우리 영토입니다! 세금·자원이 모두 들어오고 반란 걱정도 없습니다.` });
}

function hasJong(w: string): boolean {
  const code = w.charCodeAt(w.length - 1);
  return code >= 0xac00 && code <= 0xd7a3 && (code - 0xac00) % 28 !== 0;
}

/** AI 판단마다: 점령지 기록 만들기·단계 넘기기·투표 결과 */
export function annexTick(s: GameState): GameState {
  const now = s.worldMs;
  let out = s;
  const occ = new Set(occupiedCities(s));
  // 내 점령지가 아닌 기록은 지움(주인이 바뀐 경우는 noteCapture가 이미 지움)
  for (const id of Object.keys(annexOf(out))) if (!occ.has(id)) out = setEntry(out, id, null);
  for (const id of occ) {
    let a = annexEntry(out, id);
    if (!a) {
      out = setEntry(out, id, freshEntry(out));
      const c0 = cityById(id);
      out = pushReport(out, { icon: '🏳️', text: `대장님, ${c0.name}${hasJong(c0.name) ? '을' : '를'} 차지했습니다. 군정 동안 처분을 정해 주십시오: 🗺️ 편입(그대로 두면 이 길) · 🎎 꼭두각시 정부${liberateTo(out, id) ? ' · 🕊️ 해방' : ''}. 도시 창에서 고를 수 있습니다.` });
      continue;
    }
    out = dailyOcc(out, id);
    if (s.world.owner[id] !== out.world.owner[id] || out.world.owner[id] !== out.player.countryId) continue;
    a = annexEntry(out, id)!;
    if (a.mode === 'puppet') continue;
    const c = cityById(id);
    if (a.stage === '군정' && now >= a.since + milMs(out, id)) {
      a = { ...a, stage: '민정', since: now };
      out = setEntry(out, id, a);
      out = pushReport(out, { icon: '🏛️', text: `대장님, ${c.name} 치안을 확보해 민정으로 넘겼습니다. 민심을 ${ANNEX_LOYALTY} 이상으로 ${OK_HOURS / 24}일 지키면 편입 주민투표를 열 수 있습니다.` });
    }
    if (a.stage !== '민정') continue;
    const ok = cityCiv(out, id).loyalty >= ANNEX_LOYALTY;
    if (ok && a.okSince == null) a = { ...a, okSince: now };
    if (!ok && a.okSince != null && !a.voteAt) a = { ...a, okSince: null };
    out = setEntry(out, id, a);
    if (a.treaty && a.okSince != null && now >= a.okSince + OK_HOURS * H) {
      out = finishAnnex(out, id, '강화 조약대로');
      continue;
    }
    if (a.voteAt && now >= a.voteAt) {
      const { pct } = voteYes(out, id);
      const rng = new Rng((out.world.seed ^ Math.floor(a.voteAt / 1000) ^ id.length * 7919) >>> 0);
      const got = Math.max(1, Math.min(99, Math.round(pct + rng.range(-6, 6))));
      if (got >= 50) out = finishAnnex(out, id, `주민투표(찬성 ${got}%)로`);
      else {
        out = setEntry(out, id, { ...a, voteAt: null, okSince: null, retryMs: now + RETRY_HOURS * H });
        const civ = out.civ;
        if (civ?.cities[id]) out = { ...out, civ: { ...civ, cities: { ...civ.cities, [id]: { ...civ.cities[id], loyalty: Math.max(0, civ.cities[id].loyalty - 5) } } } };
        out = pushReport(out, { icon: '🗳️', text: `대장님, ${c.name} 주민투표가 찬성 ${got}%로 부결됐습니다. 민심이 조금 내려갔고, ${RETRY_HOURS / 24}일 뒤 다시 열 수 있습니다.` });
      }
    }
  }
  // 편입한 점령 도시의 내정 도시도 함께 편입
  if (out.world.annexed !== s.world.annexed) {
    const w = { ...out.world, owner: { ...out.world.owner }, defense: { ...out.world.defense } };
    syncFollowers(w);
    out = { ...out, world: w };
  }
  return out;
}

// 민심: 군정은 −, 민정은 + (행정안전부가 셀수록 더)
registerCityLoyaltyRows((s, cityId) => {
  const a = annexEntry(s, cityId);
  if (!a || s.world.owner[cityId] !== s.player.countryId) return [];
  const relief: Array<[string, number]> = a.relief && (a.reliefUntil ?? 0) > s.worldMs ? [['📦 구호품', a.relief]] : [];
  if (a.mode === 'puppet') return [['🎎 꼭두각시 정부', 6], ...relief];
  if (a.stage === '군정') return [['🪖 군정', MIL_LOYALTY], ...relief];
  const rows: Array<[string, number]> = [['🏛️ 민정', CIVIL_LOYALTY], ...relief];
  const m = Math.round(Math.min(8, ministryPower(s, 'mois') * 3) * 10) / 10;
  if (m) rows.push(['🏛️ 행안부 민정 지원', m]);
  return rows;
});

// ── 강화 조약: 전쟁을 끝내며 점령한 도시를 넘겨받기 ──

/** 넘겨받을 수 있는 도시(그 나라 원래 땅 가운데 우리가 점령한 곳) */
export function cedeCities(s: GameState, id: string): string[] {
  return occupiedCities(s).filter((c) => cityById(c).home === id && !annexEntry(s, c)?.treaty && annexEntry(s, c)?.mode !== 'puppet');
}
export function cedeChance(s: GameState, id: string): number {
  return diploChance(s, id, '휴전 제안') * CEDE_RATE;
}
export function canCede(s: GameState, id: string, cityId: string): string | null {
  const why = canDiplo(s, id, '휴전 제안');
  if (why) return why;
  if (!cedeCities(s, id).includes(cityId)) return '넘겨받을 수 있는 도시가 아니에요';
  return null;
}
/** 강화 조약 제안: 받아들이면 휴전 + 그 도시는 민정부터 시작해 투표 없이 편입 */
export function doCede(s: GameState, id: string, cityId: string): { state: GameState; ok: boolean; text: string } {
  if (canCede(s, id, cityId)) return { state: s, ok: false, text: '' };
  const rng = new Rng((s.world.seed ^ Math.floor(s.worldMs / 1000) ^ 0x5eed) >>> 0);
  const ok = rng.chance(cedeChance(s, id));
  const nm = countryById(id).name;
  const city = cityById(cityId).name;
  const officer = { ...s.officer, diploReadyMs: s.worldMs + DIPLO_COOLDOWN_HOURS * H };
  if (!ok) {
    const text = `${nm}, ${eul(city)} 넘겨 달라는 강화 조약을 거절했어요.`;
    const ev: WorldEvent = { t: s.worldMs, kind: '외교', text: `🎖️ ${text}`, mine: true };
    return { ok, text, state: { ...s, officer, world: { ...s.world, events: [ev, ...s.world.events] } } };
  }
  const pairs = { ...s.world.pairs };
  const k = pairKey(s.player.countryId, id);
  pairs[k] = { ...pairs[k], rel: '휴전', tension: 20, weariness: 0 };
  const text = `${nm}, 강화 조약에 서명했어요. 전쟁을 멈추고 ${eul(city)} 우리에게 넘겨요.`;
  const ev: WorldEvent = { t: s.worldMs, kind: '외교', text: `📜 ${text}`, mine: true };
  let out: GameState = { ...s, officer, world: { ...s.world, pairs, events: [ev, ...s.world.events] } };
  const prev = annexEntry(out, cityId);
  out = setEntry(out, cityId, { stage: '민정', since: s.worldMs, okSince: prev?.okSince ?? null, voteAt: null, retryMs: 0, treaty: true });
  return { ok, text, state: out };
}

// ── 11-26 점령 직후 처분 3갈래(편입 · 꼭두각시 정부 · 해방) + 점령지 관리 임무 ──
//  처분은 군정 동안 고름(고르지 않으면 편입 길). 꼭두각시는 되돌릴 수 없음. 해방은 도시를 내줌.
/** 꼭두각시 정부 반발(편입보다 작음) */
export const PUPPET_FAVOR_HOME = -12;
export const PUPPET_FAVOR_BLOC = -3;
/** 해방: 받은 나라 호감 · 그 진영 호감 · 명성 */
export const LIBERATE_FAVOR = 40;
export const LIBERATE_FAVOR_BLOC = 8;
export const LIBERATE_FAME = 10;
/** 점령할 때 생기는 전쟁 피해(%) · 하루에 저절로 줄어드는 양 */
export const START_DAMAGE = 25;
export const DAMAGE_HEAL_PER_DAY = 3;
/** 꼭두각시 정부가 하루에 떨어져 나갈 확률(원래 나라가 강할 때 / 약할 때) */
export const PUPPET_BREAK_STRONG = 0.1;
export const PUPPET_BREAK_WEAK = 0.03;

/** 처분을 고를 수 있는지(안 되면 이유) */
/** 아직 기록이 없는 막 점령한 도시는 군정으로 보고 고르게 함 */
const freshEntry = (s: GameState): AnnexCity => ({ stage: '군정', since: s.worldMs, okSince: null, voteAt: null, retryMs: 0, damage: START_DAMAGE, dayMs: s.worldMs });
const entryOrFresh = (s: GameState, cityId: string) => annexEntry(s, cityId) ?? (occupiedCities(s).includes(cityId) ? freshEntry(s) : null);
export function canChoose(s: GameState, cityId: string): string | null {
  const a = entryOrFresh(s, cityId);
  if (!cityById(cityId).front) return `${cityById(cityById(cityId).hub).name}에서 정하면 함께 따라가요`;
  if (!a || s.world.owner[cityId] !== s.player.countryId) return '점령지가 아니에요';
  if (a.mode === 'puppet') return '이미 꼭두각시 정부를 세웠어요';
  if (a.treaty) return '조약으로 받은 도시예요';
  if (a.stage !== '군정') return '민정으로 넘어가서 이제 편입 길만 남았어요';
  return null;
}

/** 꼭두각시 정부 세우기: 바로, 투표 없이. 반란 없음 · 공물 30% · 자원·생산 없음 */
export function makePuppet(s: GameState, cityId: string): GameState {
  if (canChoose(s, cityId)) return s;
  const a = entryOrFresh(s, cityId)!;
  const c = cityById(cityId);
  let out = setEntry(s, cityId, { ...a, mode: 'puppet', since: s.worldMs, okSince: null, voteAt: null, dayMs: s.worldMs });
  const ev: WorldEvent = { t: s.worldMs, kind: '점령', text: `🎎 ${c.name}에 우리 말을 듣는 꼭두각시 정부를 세웠어요.`, mine: true };
  out = { ...out, world: { ...out.world, events: [ev, ...out.world.events] } };
  if (isAlive(out.world, c.home)) out = addFavorNote(out, c.home, `🎎 ${c.name} 꼭두각시 정부`, PUPPET_FAVOR_HOME);
  for (const o of COUNTRIES) {
    if (o.id === s.player.countryId || o.id === c.home || !isAlive(out.world, o.id) || !sameBloc(o.id, c.home)) continue;
    out = addFavorNote(out, o.id, '🎎 남의 땅 꼭두각시', PUPPET_FAVOR_BLOC);
  }
  return pushReport(out, { icon: '🎎', text: `대장님, ${c.name}에 꼭두각시 정부가 섰습니다. 반란 걱정 없이 세금의 30%를 공물로 받습니다. 다만 ${countryById(c.home).name}${hasJong(countryById(c.home).name) ? '이' : '가'} 강해지면 떨어져 나갈 수 있습니다.` });
}

/** 해방해서 돌려줄 나라(없으면 null): 원래 주인이 우리가 빼앗은 나라와 다르거나, 원래 나라가 망했을 때 */
export function liberateTo(s: GameState, cityId: string): string | null {
  const c = cityById(cityId);
  const me = s.player.countryId;
  if (c.home === me) return null;
  const from = s.world.from?.[cityId];
  if (!isAlive(s.world, c.home) || (from && from !== c.home)) return c.home;
  return null;
}
export function canLiberate(s: GameState, cityId: string): string | null {
  const why = canChoose(s, cityId);
  if (why) return why;
  if (!liberateTo(s, cityId)) return `${countryById(cityById(cityId).home).name}에게서 빼앗은 도시라 해방할 곳이 없어요`;
  return null;
}

/** 해방: 원래 나라에 돌려줌(망했으면 되살림) → 호감·명성 크게 +, 그 나라가 연합(전쟁 중이면 휴전) */
export function liberate(s: GameState, cityId: string): GameState {
  if (canLiberate(s, cityId)) return s;
  const me = s.player.countryId;
  const c = cityById(cityId);
  const to = liberateTo(s, cityId)!;
  const revived = !isAlive(s.world, to);
  const w = { ...s.world, owner: { ...s.world.owner }, defense: { ...s.world.defense }, pairs: { ...s.world.pairs } };
  noteCapture(w, cityId, to);
  w.owner[cityId] = to;
  w.defense[cityId] = Math.max(w.defense[cityId] ?? 0, 50);
  syncFollowers(w);
  const k = pairKey(me, to);
  const before = w.pairs[k]?.rel;
  const rel = before === '전쟁' ? '휴전' : '연합';
  w.pairs[k] = { ...w.pairs[k], rel, tension: Math.min(w.pairs[k]?.tension ?? 0, 10) };
  const nm = countryById(to).name;
  const ev: WorldEvent = { t: s.worldMs, kind: '외교', text: `🕊️ ${c.name}${hasJong(c.name) ? '을' : '를'} ${nm}에 돌려주며 해방했어요.${revived ? ` ${nm}${hasJong(nm) ? '이' : '가'} 되살아났어요.` : ''} ${nm}${hasJong(nm) ? '이' : '가'} ${rel === '연합' ? '연합을 맺었어요' : '휴전에 응했어요'}.`, mine: true };
  let out: GameState = { ...s, world: { ...w, events: [ev, ...w.events] } };
  if (revived) out = { ...out, nations: { ...out.nations, [to]: { ...out.nations[to], troops: Math.max(out.nations[to]?.troops ?? 0, REVIVE_TROOPS) } } };
  out = addFavorNote(out, to, `🕊️ ${c.name} 해방`, LIBERATE_FAVOR);
  for (const o of COUNTRIES) {
    if (o.id === me || o.id === to || !isAlive(out.world, o.id) || !sameBloc(o.id, to)) continue;
    out = addFavorNote(out, o.id, '🕊️ 도시 해방', LIBERATE_FAVOR_BLOC);
  }
  out = { ...out, officer: { ...out.officer, fame: out.officer.fame + LIBERATE_FAME } };
  return pushReport(out, { icon: '🕊️', text: `대장님, ${c.name} 해방을 세계가 반깁니다! 명성 +${LIBERATE_FAME}, ${nm} 호감 +${LIBERATE_FAVOR}. ${nm}${hasJong(nm) ? '이' : '가'} ${rel === '연합' ? '우리와 연합을 맺었습니다' : '휴전에 응했습니다'}.` });
}

/** 하루마다: 전쟁 피해 회복 · 꼭두각시 이탈 판정 */
function dailyOcc(s: GameState, cityId: string): GameState {
  let a = annexEntry(s, cityId);
  if (!a) return s;
  const day = 24 * H;
  const last = a.dayMs ?? a.since;
  if (s.worldMs < last + day) return s;
  const days = Math.floor((s.worldMs - last) / day);
  a = { ...a, dayMs: last + days * day, damage: Math.max(0, (a.damage ?? 0) - DAMAGE_HEAL_PER_DAY * days) };
  let out = setEntry(s, cityId, a);
  if (a.mode !== 'puppet') return out;
  const c = cityById(cityId);
  if (!isAlive(out.world, c.home)) return out;
  const homeFront = FRONT.filter((x) => x.home === c.home);
  const kept = homeFront.filter((x) => out.world.owner[x.id] === c.home).length;
  const p = kept >= homeFront.length * 0.6 ? PUPPET_BREAK_STRONG : PUPPET_BREAK_WEAK;
  const rng = new Rng((out.world.seed ^ Math.floor(a.dayMs! / 1000) ^ cityId.length * 131) >>> 0);
  let broke = false;
  for (let i = 0; i < Math.min(days, 7) && !broke; i++) broke = rng.chance(p);
  if (!broke) return out;
  const w = { ...out.world, owner: { ...out.world.owner }, defense: { ...out.world.defense } };
  noteCapture(w, cityId, c.home);
  w.owner[cityId] = c.home;
  w.defense[cityId] = CAPTURED_DEFENSE_BACK;
  syncFollowers(w);
  const ev: WorldEvent = { t: out.worldMs, kind: '점령', text: `🎎 ${c.name} 꼭두각시 정부가 무너지고 ${countryById(c.home).name} 땅으로 돌아갔어요.`, mine: true };
  out = { ...out, world: { ...w, events: [ev, ...w.events] } };
  return pushReport(out, { icon: '🎎', text: `대장님, ${c.name} 꼭두각시 정부가 ${countryById(c.home).name} 편으로 돌아섰습니다. 도시를 잃었습니다.` });
}
const CAPTURED_DEFENSE_BACK = 40;

// ── 점령지 관리 임무: 미니게임 한 판(별 1~3)으로 효과가 커짐 ──
export type OccTask = '소탕' | '구호' | '재건' | '선전';
export interface OccTaskDef { icon: string; name: string; mini: string; when: string; desc: string; cost: (value: number) => number }
export const OCC_TASKS: Record<OccTask, OccTaskDef> = {
  소탕: { icon: '🪖', name: '잔당 소탕', mini: 'shoot-popup', when: '군정', desc: '하루 동안 반란 확률 −25%×별, 군정 2시간×별 단축, 노획 국방예산', cost: () => 0 },
  구호: { icon: '📦', name: '구호품 배급', mini: 'sup-ration', when: '민정·꼭두각시', desc: '이틀 동안 민심 +4×별(국방예산 씀)', cost: (v) => v * 800 },
  재건: { icon: '🏗️', name: '전후 재건', mini: 'sup-road', when: '피해가 있을 때', desc: '전쟁 피해 −8%×별 → 수입 회복(국방예산 씀)', cost: (v) => v * 1000 },
  선전: { icon: '📻', name: '선전 방송', mini: 'rec-speech', when: '민정', desc: '주민투표 찬성률 +3%×별(최대 +12%)', cost: () => 0 },
};
export const OCC_TASK_HOURS = 12;
export const OCC_LOOT_PER_VALUE = 500;

/** 이 임무를 지금 할 수 있는지(안 되면 이유) */
export function canOccTask(s: GameState, cityId: string, t: OccTask): string | null {
  const a = annexEntry(s, cityId);
  if (!cityById(cityId).front) return '점령 도시에서 해요';
  if (!a || s.world.owner[cityId] !== s.player.countryId) return '점령지가 아니에요';
  const ready = a.taskReady?.[t] ?? 0;
  if (s.worldMs < ready) return `${Math.ceil((ready - s.worldMs) / H)}시간 뒤 다시 할 수 있어요`;
  const puppet = a.mode === 'puppet';
  if (t === '소탕' && (a.stage !== '군정' || puppet)) return '군정 동안만 해요';
  if (t === '구호' && a.stage !== '민정' && !puppet) return '민정이나 꼭두각시 정부에서 해요';
  if (t === '재건' && !(a.damage ?? 0)) return '고칠 피해가 없어요';
  if (t === '선전' && (a.stage !== '민정' || puppet || a.treaty)) return '편입을 기다리는 민정 도시에서 해요';
  if (t === '선전' && (a.propaganda ?? 0) >= 12) return '찬성률 보너스가 가득 찼어요';
  const cost = OCC_TASKS[t].cost(cityById(cityId).value);
  if (cost && s.nations[s.player.countryId].treasury < cost) return `국방예산 ${cost.toLocaleString('ko-KR')} 필요`;
  return null;
}

/** 임무 결과 반영(진 판도 시간은 씀). stars 0 = 실패 */
export function applyOccTask(s: GameState, cityId: string, t: OccTask, stars: number): { state: GameState; text: string } {
  const why = canOccTask(s, cityId, t);
  if (why) return { state: s, text: why };
  const me = s.player.countryId;
  const c = cityById(cityId);
  let a = annexEntry(s, cityId)!;
  a = { ...a, taskReady: { ...(a.taskReady ?? {}), [t]: s.worldMs + OCC_TASK_HOURS * H } };
  const cost = OCC_TASKS[t].cost(c.value);
  let treasury = s.nations[me].treasury - cost;
  let text = '';
  const st = Math.max(0, Math.min(3, stars));
  if (!st) text = `${OCC_TASKS[t].name} 실패… 효과 없음${cost ? ` (국방예산 −${cost.toLocaleString('ko-KR')})` : ''}`;
  else if (t === '소탕') {
    const loot = c.value * OCC_LOOT_PER_VALUE * st;
    treasury += loot;
    a = { ...a, sweepUntil: s.worldMs + 24 * H, sweepStars: st, since: a.since - 2 * H * st };
    text = `잔당 소탕 ${'★'.repeat(st)} · 하루 동안 반란 −${25 * st}% · 군정 ${2 * st}시간 단축 · 노획 국방예산 +${loot.toLocaleString('ko-KR')}`;
  } else if (t === '구호') {
    a = { ...a, relief: 4 * st, reliefUntil: s.worldMs + 48 * H };
    text = `구호품 배급 ${'★'.repeat(st)} · 이틀 동안 민심 +${4 * st}`;
  } else if (t === '재건') {
    const d = Math.max(0, (a.damage ?? 0) - 8 * st);
    text = `전후 재건 ${'★'.repeat(st)} · 전쟁 피해 ${a.damage ?? 0}% → ${d}%`;
    a = { ...a, damage: d };
  } else {
    const v = Math.min(12, (a.propaganda ?? 0) + 3 * st);
    a = { ...a, propaganda: v };
    text = `선전 방송 ${'★'.repeat(st)} · 주민투표 찬성률 보너스 +${v}%`;
  }
  let out = setEntry(s, cityId, a);
  out = { ...out, nations: { ...out.nations, [me]: { ...out.nations[me], treasury } } };
  return { state: out, text: `${c.name} ${text}` };
}
