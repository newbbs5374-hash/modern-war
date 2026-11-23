// 2단계: 세계가 스스로 움직이는 규칙(외교·긴장도·침공·점령). 화면과 떨어진 순수 계산.
// 실제 15분(게임 6시간)마다 한 번 "판단"한다. 같은 씨앗이면 결과가 늘 같다.

import { CITIES, cityById, homeValue } from '../data/cities';
import { LEADERS, PERSONALITIES, PERSONALITY_LIST, type Personality } from '../data/leaders';
import { COUNTRIES, countryById, startingRelation, type Relation } from '../data/world';
import {
  ALLY_DEFEND_SHARE,
  ALLY_JOIN_CHANCE,
  HOMELAND_DEFENSE,
  LAST_STAND_DEFENSE,
  LOSING_PEACE_MULT,
  PLAYER_HOME_DEFENSE,
  ATTACK_COMMIT,
  ATTACK_COST_PER_TROOP,
  CAPITAL_DEFENSE,
  CAPTURED_DEFENSE,
  CAPTURE_MARGIN,
  CITY_DEFENSE_MAX,
  CITY_DEFENSE_REGEN,
  OVERSEAS_ATTACK_RATE,
  REBEL_CHANCE,
  REBEL_FAITH_MULT,
  REVIVE_TROOPS,
  US_OVERSEAS,
  SIEGE_DAMAGE,
  DEFEND_COMMIT,
  EVENT_LOG_MAX,
  FAITH_EVENT_CHANCE,
  FAITH_EVENT_TENSION,
  INVADE_CHANCE,
  OCCUPIED_INCOME,
  OVERSEAS_PENALTY,
  PLAYER_TARGET_BONUS,
  TENSION_DECAY,
  TENSION_FAITH,
  TENSION_MAX,
  TENSION_NEUTRAL,
  TENSION_OTHER_LEADER,
  TENSION_OTHER_NEIGHBOR,
  TRUCE_COOLDOWN,
  TENSION_TRUCE,
  TRUCE_BASE,
  TRUCE_START_TENSION,
  WEARINESS_SCALE,
} from './balance';
import { Rng } from './rng';
import type { NationState } from './state';

export interface PairState {
  rel: Relation;
  /** 0~100. 휴전·중립에서 차면 전쟁 */
  tension: number;
  /** 전쟁 피로도. 높을수록 휴전하기 쉬움 */
  weariness: number;
}

export type EventKind = '외교' | '전투' | '점령' | '신앙' | '멸망' | '장교';

export interface WorldEvent {
  /** 일어난 세계 시간(ms) */
  t: number;
  kind: EventKind;
  text: string;
  /** 내 나라가 얽힌 소식 */
  mine: boolean;
}

export interface WorldState {
  seed: number;
  /** 다음 판단 시각(세계 시간 ms) */
  nextTickMs: number;
  personalities: Record<string, Personality>;
  /** 나라 쌍("가|나", 글자 순) → 관계 */
  pairs: Record<string, PairState>;
  /** 도시 → 지금 주인 */
  owner: Record<string, string>;
  /** 도시 → 방어도(0~100). 0이 되면 점령 */
  defense: Record<string, number>;
  events: WorldEvent[];
}

export const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

export function newWorld(seed: number, randomLeaders: boolean, firstTickMs: number): WorldState {
  const rng = new Rng(seed);
  const personalities: Record<string, Personality> = {};
  for (const c of COUNTRIES) {
    personalities[c.id] = randomLeaders ? rng.pick(PERSONALITY_LIST) : LEADERS[c.id].personality;
  }
  const pairs: Record<string, PairState> = {};
  for (const a of COUNTRIES) {
    for (const b of COUNTRIES) {
      if (a.id >= b.id) continue;
      const rel = startingRelation(a.id, b.id);
      pairs[pairKey(a.id, b.id)] = {
        rel,
        // 새 세계관: 모두 평화로 시작. 맞수 사이만 긴장 20~35에서 시작
        tension: rel === '중립' ? (isRival(a.id, b.id) ? Math.round(rng.range(20, 35)) : 5) : 0,
        weariness: 0,
      };
    }
  }
  const owner: Record<string, string> = {};
  const defense: Record<string, number> = {};
  for (const c of CITIES) {
    owner[c.id] = c.home;
    defense[c.id] = CITY_DEFENSE_MAX;
  }
  return { seed: rng.seed, nextTickMs: firstTickMs, personalities, pairs, owner, defense, events: [] };
}

export function relationOf(w: WorldState, a: string, b: string): Relation {
  if (a === b) return '연합';
  return w.pairs[pairKey(a, b)]?.rel ?? '중립';
}

export function citiesOf(w: WorldState, countryId: string): string[] {
  return CITIES.filter((c) => w.owner[c.id] === countryId).map((c) => c.id);
}

export function isAlive(w: WorldState, countryId: string): boolean {
  return CITIES.some((c) => w.owner[c.id] === countryId);
}

/** 도시 소유에 따른 수입 배율(처음 그대로면 1, 남의 도시는 절반만) */
export function incomeShare(w: WorldState, countryId: string): number {
  let v = 0;
  for (const c of CITIES) {
    if (w.owner[c.id] !== countryId) continue;
    v += c.home === countryId ? c.value : c.value * OCCUPIED_INCOME;
  }
  return v / homeValue(countryId);
}

/** 처음 도시의 반 넘게 잃었는가 */
export function isLosing(w: WorldState, id: string): boolean {
  const home = CITIES.filter((c) => c.home === id);
  const kept = home.filter((c) => w.owner[c.id] === id).length;
  return kept * 2 < home.length;
}

const pInfo = (w: WorldState, id: string) => PERSONALITIES[w.personalities[id]];

/** 두 나라 신앙이 부딪히는가(빛의 언약 ↔ 성검 교단, 또는 같은 북극성 정교끼리 정통 다툼) */
function faithClash(a: string, b: string): boolean {
  const fa = countryById(a).faith;
  const fb = countryById(b).faith;
  if ((fa === 'covenant' && fb === 'blade') || (fa === 'blade' && fb === 'covenant')) return true;
  return fa === 'polaris' && fb === 'polaris';
}

/** 맞수 사이: 태평양 연합 ↔ 대륙 협약, 러시아 ↔ 유럽 연합, 중국 ↔ 인도(항로 다툼), 신앙 충돌 */
export function isRival(a: string, b: string): boolean {
  const ba = countryById(a).bloc;
  const bb = countryById(b).bloc;
  const pair = [ba, bb].sort().join('-');
  if (pair === 'continental-pacific') return true;
  if ((a === 'ru' && bb === 'europe') || (b === 'ru' && ba === 'europe')) return true;
  const ab = [a, b].sort().join('-');
  if (ab === 'cn-in') return true;
  return faithClash(a, b);
}

export function sameBloc(a: string, b: string): boolean {
  const ba = countryById(a).bloc;
  return ba !== 'independent' && ba === countryById(b).bloc;
}

interface Ctx {
  w: WorldState;
  nations: Record<string, NationState>;
  rng: Rng;
  t: number;
  player: string;
  playerDefense: number;
  /** 내가 점령한 도시 지키기: 반란 확률 배율 · 방어 배율 */
  playerHold: { rebel: number; defense: number };
}

function log(ctx: Ctx, kind: EventKind, text: string, ...who: string[]) {
  ctx.w.events.unshift({ t: ctx.t, kind, text, mine: who.includes(ctx.player) });
  if (ctx.w.events.length > EVENT_LOG_MAX) ctx.w.events.length = EVENT_LOG_MAX;
}

const nm = (id: string) => countryById(id).name;

/** 받침에 맞는 조사(이/가, 을/를, 과/와, 은/는) */
function hasBatchim(word: string): boolean {
  const code = word.charCodeAt(word.length - 1) - 0xac00;
  return code >= 0 && code <= 11171 && code % 28 !== 0;
}
export const ga = (w: string) => w + (hasBatchim(w) ? '이' : '가');
export const eul = (w: string) => w + (hasBatchim(w) ? '을' : '를');
export const gwa = (w: string) => w + (hasBatchim(w) ? '과' : '와');

function startWar(ctx: Ctx, attacker: string, defender: string, why: string) {
  const p = ctx.w.pairs[pairKey(attacker, defender)];
  p.rel = '전쟁';
  p.tension = 0;
  p.weariness = 0;
  log(ctx, '외교', `${ga(nm(attacker))} ${nm(defender)}에 선전포고했어요. (${why})`, attacker, defender);
  // 연합국이 끌려 들어옴
  for (const [side, enemy] of [
    [defender, attacker],
    [attacker, defender],
  ]) {
    for (const ally of COUNTRIES.map((c) => c.id)) {
      if (ally === side || ally === enemy || !isAlive(ctx.w, ally)) continue;
      if (relationOf(ctx.w, ally, side) !== '연합') continue;
      const q = ctx.w.pairs[pairKey(ally, enemy)];
      if (q.rel !== '중립') continue;
      if (!ctx.rng.chance(ALLY_JOIN_CHANCE)) continue;
      q.rel = '전쟁';
      q.tension = 0;
      q.weariness = 0;
      log(ctx, '외교', `${ga(nm(ally))} 연합국 ${eul(nm(side))} 도와 ${gwa(nm(enemy))} 전쟁에 들어갔어요.`, ally, enemy, side);
    }
  }
}

function diplomacy(ctx: Ctx) {
  const { w, rng } = ctx;
  for (const [key, p] of Object.entries(w.pairs)) {
    const [a, b] = key.split('|');
    if (!isAlive(w, a) || !isAlive(w, b)) continue;
    const pa = pInfo(w, a);
    const pb = pInfo(w, b);
    const mult = (pa.tension + pb.tension) / 2;
    if (p.rel === '전쟁') {
      p.weariness += 1;
      const peace = ((pa.peace + pb.peace) / 2) * (isLosing(w, a) || isLosing(w, b) ? LOSING_PEACE_MULT : 1);
      if (rng.chance(TRUCE_BASE * peace * (1 + p.weariness / WEARINESS_SCALE))) {
        p.rel = '휴전';
        p.tension = TRUCE_START_TENSION;
        p.weariness = 0;
        log(ctx, '외교', `${gwa(nm(a))} ${ga(nm(b))} 휴전했어요.`, a, b);
      }
      continue;
    }
    if (p.rel === '연합') continue;
    let rise: number;
    if (sameBloc(a, b)) rise = -TENSION_DECAY;
    else if (isRival(a, b)) {
      rise = (p.rel === '휴전' ? TENSION_TRUCE : TENSION_NEUTRAL) * mult;
      if (faithClash(a, b)) rise += TENSION_FAITH;
    } else {
      const neighbor = countryById(a).continent === countryById(b).continent;
      rise = (mult - 1) * TENSION_OTHER_LEADER + (neighbor ? TENSION_OTHER_NEIGHBOR : -TENSION_OTHER_NEIGHBOR);
      if (p.rel === '휴전') rise -= TRUCE_COOLDOWN;
    }
    p.tension = Math.max(0, p.tension + rise * rng.range(0.5, 1.5));
    if (p.rel === '휴전' && p.tension === 0 && !isRival(a, b)) {
      p.rel = '중립';
      log(ctx, '외교', `${gwa(nm(a))} ${nm(b)} 사이 긴장이 풀려 평화를 되찾았어요.`, a, b);
      continue;
    }
    if (p.tension >= TENSION_MAX) {
      // 더 공격적인 쪽이 먼저 친다
      const [att, def] = pa.aggression >= pb.aggression ? [a, b] : [b, a];
      startWar(ctx, att, def, p.rel === '휴전' ? '휴전이 깨짐' : '긴장이 한계에 다다름');
    }
  }
  // 신앙 사건: "고대 성지"를 두고 빛의 언약 ↔ 성검 교단
  if (rng.chance(FAITH_EVENT_CHANCE)) {
    const covenant = COUNTRIES.filter((c) => c.faith === 'covenant' && isAlive(w, c.id));
    const blade = COUNTRIES.filter((c) => c.faith === 'blade' && isAlive(w, c.id));
    if (covenant.length && blade.length) {
      const a = rng.pick(covenant).id;
      const b = rng.pick(blade).id;
      const what = rng.pick(['성지 충돌', '순례자 공격', '신앙 지도자 선동']);
      const p = w.pairs[pairKey(a, b)];
      if (p.rel !== '전쟁') p.tension = Math.min(TENSION_MAX - 1, p.tension + FAITH_EVENT_TENSION);
      log(ctx, '신앙', `고대 성지에서 ${what}! ${gwa(nm(a))} ${nm(b)} 사이 긴장이 크게 올랐어요.`, a, b);
    }
  }
}

function power(ctx: Ctx, country: string, troops: number, defending: boolean, overseas: boolean): number {
  const c = countryById(country);
  let pw = troops * (0.5 + c.military / 100) * ctx.rng.range(0.75, 1.25);
  if (defending) {
    if (country === 'ru') pw *= 1.25; // 혹한 요새
    if (country === 'ua') pw *= 1.2; // 국토 방위 의지
  } else if (overseas) {
    pw *= country === 'us' ? US_OVERSEAS : OVERSEAS_PENALTY;
  }
  return pw;
}

/** 바다를 건너야 하는가(같은 지역이거나 튀르키예의 해협이면 아님) */
function isOverseas(from: string, cityHome: string): boolean {
  const a = countryById(from).continent;
  const b = countryById(cityHome).continent;
  if (a === b) return false;
  const strait = new Set(['eurona', 'sahar']);
  return !(from === 'tr' && strait.has(b));
}

function invasions(ctx: Ctx) {
  const { w, rng, nations } = ctx;
  for (const att of COUNTRIES.map((c) => c.id)) {
    if (!isAlive(w, att)) continue;
    const agg = pInfo(w, att).aggression;
    const enemies = COUNTRIES.map((c) => c.id).filter(
      (b) => b !== att && isAlive(w, b) && relationOf(w, att, b) === '전쟁',
    );
    for (const def of enemies) {
      const bonus = def === ctx.player ? PLAYER_TARGET_BONUS : 1;
      if (!rng.chance(INVADE_CHANCE * agg * bonus)) continue;
      const targets = citiesOf(w, def);
      // 가까운 도시(같은 대륙)를 먼저, 수도는 마지막에, 원래 내 도시였던 곳(되찾기)을 더 노림
      const target = rng.weighted(targets, (id) => {
        const c = cityById(id);
        return (
          (c.capital && targets.length > 1 ? 0.3 : 1) *
          (c.home === att ? 3 : 1) *
          (isOverseas(att, c.home) ? OVERSEAS_ATTACK_RATE : 1)
        );
      });
      if (!target) continue;
      const na = nations[att];
      const nd = nations[def];
      // 전선이 많으면 병력이 나뉨
      const commit = (na.troops * ATTACK_COMMIT) / Math.sqrt(enemies.length);
      const cost = commit * ATTACK_COST_PER_TROOP;
      if (commit < 1000 || na.treasury < cost) continue;
      na.treasury -= cost;
      const city = cityById(target);
      const overseas = isOverseas(att, city.home);
      const garrison = nd.troops * DEFEND_COMMIT;
      // 연합국 가운데 공격국과 전쟁 중인 나라가 함께 지킴
      let allyHelp = 0;
      for (const ally of COUNTRIES.map((c) => c.id)) {
        if (ally === def || ally === att || !isAlive(w, ally)) continue;
        if (relationOf(w, ally, def) === '연합' && relationOf(w, ally, att) === '전쟁') {
          allyHelp += nations[ally].troops * DEFEND_COMMIT * ALLY_DEFEND_SHARE;
        }
      }
      const ap = power(ctx, att, commit, false, overseas);
      let dp = power(ctx, def, garrison + allyHelp, true, false);
      if (city.capital) dp *= CAPITAL_DEFENSE;
      if (city.home === def) dp *= HOMELAND_DEFENSE;
      if (targets.length === 1) dp *= LAST_STAND_DEFENSE;
      if (def === ctx.player && city.home === def) dp *= PLAYER_HOME_DEFENSE * ctx.playerDefense;
      // 내가 만든 부대가 지켜 줌(내 땅 · 점령지 모두)
      if (def === ctx.player) dp *= ctx.playerHold.defense;
      const ratio = ap / Math.max(1, dp);
      na.troops = Math.max(0, na.troops - commit * 0.2 * Math.min(2, 1 / ratio));
      nd.troops = Math.max(0, nd.troops - garrison * 0.12 * Math.min(2, ratio));
      const p = w.pairs[pairKey(att, def)];
      p.weariness += 1;
      const prevOwner = w.owner[target];
      const won = ap > dp * CAPTURE_MARGIN;
      if (won) w.defense[target] -= SIEGE_DAMAGE * Math.min(2, ratio);
      if (won && w.defense[target] <= 0) {
        w.owner[target] = att;
        w.defense[target] = CAPTURED_DEFENSE;
        p.weariness += 4;
        const verb = city.home === att ? '되찾았어요' : '점령했어요';
        log(ctx, '점령', `${ga(nm(att))} ${nm(prevOwner)}의 ${eul(city.name)} ${verb}.`, att, def);
        if (!isAlive(w, def)) log(ctx, '멸망', `${nm(def)}의 마지막 도시가 무너졌어요.`, def, att);
      } else if (att === ctx.player || def === ctx.player) {
        const left = Math.max(0, Math.round(w.defense[target]));
        log(
          ctx,
          '전투',
          won
            ? `${ga(nm(att))} ${nm(def)}의 ${eul(city.name)} 몰아붙였어요. 방어도 ${left} 남음.`
            : `${ga(nm(att))} ${nm(def)}의 ${eul(city.name)} 공격했지만 막혔어요.`,
          att,
          def,
        );
      }
    }
  }
}

/** 점령지 반란: 원래 주인에게 돌아감(망한 나라는 되살아남) */
function rebellions(ctx: Ctx) {
  const { w, rng, nations } = ctx;
  for (const c of CITIES) {
    const occ = w.owner[c.id];
    if (occ === c.home) continue;
    const faithDiff = countryById(occ).faith !== countryById(c.home).faith;
    const hold = occ === ctx.player ? ctx.playerHold.rebel : 1;
    if (!rng.chance(REBEL_CHANCE * (faithDiff ? REBEL_FAITH_MULT : 1) * hold)) continue;
    const revived = !isAlive(w, c.home);
    w.owner[c.id] = c.home;
    w.defense[c.id] = CAPTURED_DEFENSE;
    if (revived) nations[c.home].troops = Math.max(nations[c.home].troops, REVIVE_TROOPS);
    log(
      ctx,
      '점령',
      revived
        ? `${c.name}에서 반란! ${ga(nm(c.home))} 되살아났어요.`
        : `${c.name}에서 반란! ${nm(occ)}의 점령이 끝나고 ${nm(c.home)} 땅으로 돌아갔어요.`,
      occ,
      c.home,
    );
  }
}

/** 도시 방어도가 조금씩 회복 */
function regen(w: WorldState) {
  for (const c of CITIES) w.defense[c.id] = Math.min(CITY_DEFENSE_MAX, w.defense[c.id] + CITY_DEFENSE_REGEN);
}

/** AI 판단 한 번(실제 15분마다). w와 nations를 바꾼다 */
export function aiTick(
  w: WorldState,
  nations: Record<string, NationState>,
  t: number,
  player: string,
  /** 내 나라 도시 방어 추가 배율(장군) */
  playerDefense = 1,
  playerHold: { rebel: number; defense: number } = { rebel: 1, defense: 1 },
): void {
  const ctx: Ctx = { w, nations, rng: new Rng(w.seed), t, player, playerDefense, playerHold };
  diplomacy(ctx);
  invasions(ctx);
  rebellions(ctx);
  regen(w);
  w.seed = ctx.rng.seed;
}

export function cloneWorld(w: WorldState): WorldState {
  const pairs: Record<string, PairState> = {};
  for (const [k, p] of Object.entries(w.pairs)) pairs[k] = { ...p };
  return { ...w, personalities: { ...w.personalities }, pairs, owner: { ...w.owner }, defense: { ...w.defense }, events: [...w.events] };
}
