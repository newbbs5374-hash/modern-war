// 점령 도시 영토 편입(11-25 대장 결정: 제안서 추천안 그대로).
//  군정(점령 직후, 하루) → 민정(치안 확보, 수입 75%·반란 절반·민심 +) → 민심 60을 3일 지키면 주민투표(하루 뒤 결과) → 편입.
//  편입하면 '우리 땅'으로 대접: 수입·자원·생산 100%, 민심 바탕 65, 반란 없음, 본토 방어 보너스, 지도 빗금 없음.
//  원래 나라 수도도 편입할 수 있지만 찬성률이 낮음. 원래 나라가 망했으면 군정 기간 절반·찬성률 +10.
//  강화 조약으로 넘겨받은 도시는 민정부터 시작하고 투표 없이 편입(국제 반발 절반).
//  편입하면 원래 나라 호감 크게 ↓, 같은 진영 나라 호감 조금 ↓.
//  상태는 world.annex(진행) · world.annexed(끝난 것). 주인이 바뀌면 territory.noteCapture가 지움.
import { CITIES, cityById } from '../data/cities';
import { COUNTRIES, countryById } from '../data/world';
import type { GameState } from './state';
import { addFavorNote, cityCiv, registerCityLoyaltyRows } from './civ';
import { buildingEff } from './economy';
import { ministryPower } from './cabinet';
import { pushReport } from './report';
import { Rng } from './rng';
import { canDiplo, diploChance, DIPLO_COOLDOWN_HOURS } from './command';
import { eul, homeOf, isAlive, pairKey, relationOf, sameBloc, type AnnexCity, type WorldEvent } from './world';

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
export const annexEntry = (s: GameState, cityId: string): AnnexCity | null => annexOf(s)[cityId] ?? null;
export const isAnnexed = (s: GameState, cityId: string) => s.world.annexed?.[cityId] === s.player.countryId;
/** 편입한 도시 수 */
export const annexedCount = (s: GameState) => Object.entries(s.world.annexed ?? {}).filter(([id, who]) => who === s.player.countryId && s.world.owner[id] === who).length;

/** 편입할 수 있는 점령지(내 것이지만 아직 우리 땅이 아님) */
export function occupiedCities(s: GameState): string[] {
  const me = s.player.countryId;
  return CITIES.filter((c) => s.world.owner[c.id] === me && homeOf(s.world, c.id) !== me).map((c) => c.id);
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
  const mois = Math.round(Math.min(10, ministryPower(s, 'mois') * 2));
  if (mois) rows.push(['🏛️ 행정안전부', mois]);
  const pct = Math.max(5, Math.min(95, rows.reduce((a, [, v]) => a + v, 0)));
  return { pct, rows };
}

/** 주민투표를 열 수 있는지(안 되면 이유) */
export function canVote(s: GameState, cityId: string): string | null {
  const a = annexEntry(s, cityId);
  if (!a || s.world.owner[cityId] !== s.player.countryId) return '편입할 수 있는 점령지가 아니에요';
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
      out = setEntry(out, id, { stage: '군정', since: now, okSince: null, voteAt: null, retryMs: 0 });
      continue;
    }
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
  return out;
}

// 민심: 군정은 −, 민정은 + (행정안전부가 셀수록 더)
registerCityLoyaltyRows((s, cityId) => {
  const a = annexEntry(s, cityId);
  if (!a || s.world.owner[cityId] !== s.player.countryId) return [];
  if (a.stage === '군정') return [['🪖 군정', MIL_LOYALTY]];
  const rows: Array<[string, number]> = [['🏛️ 민정', CIVIL_LOYALTY]];
  const m = Math.round(Math.min(8, ministryPower(s, 'mois') * 3) * 10) / 10;
  if (m) rows.push(['🏛️ 행안부 민정 지원', m]);
  return rows;
});

// ── 강화 조약: 전쟁을 끝내며 점령한 도시를 넘겨받기 ──

/** 넘겨받을 수 있는 도시(그 나라 원래 땅 가운데 우리가 점령한 곳) */
export function cedeCities(s: GameState, id: string): string[] {
  return occupiedCities(s).filter((c) => cityById(c).home === id && !annexEntry(s, c)?.treaty);
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
