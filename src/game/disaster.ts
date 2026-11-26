// 안 3 재난 대응 지휘실(11/26): 실제 20~32시간마다 내 도시에 태풍·지진·산불·홍수·전염병·붕괴 사고.
// 대비 → 구조 → 복구 3단계, 단계마다 대응 3가지 중 하나를 골라 지휘(단계 마감 2시간, 넘기면 실패).
// 성공 확률 = 기본 + 알맞은 대응 + 담당 장관·청장 능력. 결과에 따라 그 도시 민심·지지도·신뢰도·야당 공세.
import { addPresMod } from './approval';
import { ministryPower, postPower } from './cabinet';
import { payTreasury, snap } from './domestic';
import { DAY, H, addMark, bumpRival, bumpTrust, clamp, polityOf, polityLog, roll, tell, withPolity, type Disaster } from './polity';
import { budgetPerDay, type GameState } from './state';
import { myCityIds } from './zones';
import { cityById, isCoastalCity } from '../data/cities';
import type { MinistryId } from '../data/cabinet';
import type { PostId } from '../data/staff';

export const STAGE_MS = 2 * H;
export const GAP_H: [number, number] = [20, 32];
export const STAGE_NAMES = ['대비', '구조', '복구'] as const;

export interface Responder {
  id: string;
  icon: string;
  name: string;
  min?: MinistryId;
  post?: PostId;
  text: string;
}
export const RESPONDERS: Responder[] = [
  { id: 'fire', icon: '🚒', name: '소방', min: 'mois', post: 'nfa', text: '소방청장·행정안전부' },
  { id: 'army', icon: '🪖', name: '군 투입', min: 'mnd', text: '국방부 · 병력 0.5% 씀' },
  { id: 'med', icon: '🏥', name: '의료진', min: 'mohw', post: 'kdca', text: '질병관리청장·보건복지부' },
  { id: 'police', icon: '🚓', name: '경찰 통제', min: 'mois', post: 'police', text: '경찰청장·행정안전부' },
  { id: 'coast', icon: '🚤', name: '해경', min: 'mofs', post: 'kcg', text: '해양경찰청장·해양수산부' },
  { id: 'forest', icon: '🚁', name: '산림 헬기', min: 'mafra', post: 'kfs', text: '산림청장·농림축산식품부' },
  { id: 'weather', icon: '🌦️', name: '기상 예보', min: 'mcee', post: 'kma', text: '기상청장·기후에너지부' },
  { id: 'build', icon: '🏗️', name: '건설 복구', min: 'molit', text: '국토교통부' },
  { id: 'money', icon: '💰', name: '긴급 예산', min: 'mof', text: '기획재정부 · 나라 예산 반나절치' },
  { id: 'volunteer', icon: '🙋', name: '자원봉사', text: '시민 자원봉사(능력 없이 기본)' },
];
export const responderById = (id: string) => RESPONDERS.find((r) => r.id === id)!;

export interface DisasterKind {
  id: string;
  icon: string;
  name: string;
  coastal?: boolean;
  /** 단계마다 [고를 수 있는 3개, 알맞은 것] */
  stages: Array<[string[], string[]]>;
  text: string;
}
export const DISASTERS: DisasterKind[] = [
  { id: 'typhoon', icon: '🌀', name: '태풍', coastal: true, text: '강한 바람과 폭우가 몰려와요', stages: [[['weather', 'coast', 'police'], ['weather', 'coast']], [['fire', 'army', 'coast'], ['fire', 'coast']], [['build', 'money', 'volunteer'], ['build', 'money']]] },
  { id: 'quake', icon: '🌋', name: '지진', text: '땅이 흔들려 건물이 무너졌어요', stages: [[['build', 'police', 'weather'], ['build']], [['fire', 'army', 'med'], ['fire', 'army']], [['build', 'money', 'med'], ['build', 'money']]] },
  { id: 'wildfire', icon: '🔥', name: '산불', text: '마른 바람을 타고 산불이 번져요', stages: [[['forest', 'weather', 'police'], ['forest', 'weather']], [['forest', 'fire', 'army'], ['forest', 'fire']], [['build', 'volunteer', 'money'], ['volunteer', 'money']]] },
  { id: 'flood', icon: '🌊', name: '홍수', text: '강이 넘쳐 마을이 잠겼어요', stages: [[['weather', 'build', 'police'], ['weather', 'build']], [['fire', 'army', 'coast'], ['army', 'fire']], [['build', 'money', 'med'], ['build', 'money']]] },
  { id: 'virus', icon: '🦠', name: '전염병', text: '새 감염병이 빠르게 퍼져요', stages: [[['med', 'police', 'weather'], ['med']], [['med', 'army', 'fire'], ['med']], [['money', 'med', 'volunteer'], ['money', 'med']]] },
  { id: 'collapse', icon: '🏚️', name: '대형 붕괴 사고', text: '다리·건물이 무너져 사람이 갇혔어요', stages: [[['build', 'police', 'weather'], ['build', 'police']], [['fire', 'army', 'med'], ['fire', 'med']], [['build', 'money', 'police'], ['build', 'police']]] },
];
export const disasterKind = (id: string) => DISASTERS.find((d) => d.id === id)!;

export const disasterOf = (s: GameState): Disaster | null => polityOf(s).disaster;

/** 대응 하나의 힘(장관·청장 중 큰 쪽) */
export function responderPower(s: GameState, r: Responder): number {
  const a = r.min ? ministryPower(s, r.min) : 0;
  const b = r.post ? postPower(s, r.post) : 0;
  return Math.min(1.6, Math.max(a, b));
}
export function responseRows(s: GameState, rid: string): Array<[string, number]> {
  const d = disasterOf(s);
  const rows: Array<[string, number]> = [['기본', 0.35]];
  if (!d) return rows;
  const k = disasterKind(d.kind);
  const [, best] = k.stages[d.stage];
  const r = responderById(rid);
  if (best.includes(rid)) rows.push(['✅ 알맞은 대응', 0.25]);
  const pw = responderPower(s, r);
  if (pw) rows.push([`👤 담당 능력 ${pw.toFixed(1)}`, Math.round(pw * 0.2 * 100) / 100]);
  else if (r.min || r.post) rows.push(['🪑 담당 자리가 비었어요', -0.1]);
  if (rid === 'army') rows.push(['🪖 병력 투입', 0.08]);
  if (rid === 'money') rows.push(['💰 돈을 아끼지 않음', 0.05]);
  // 앞 단계를 잘했으면 다음이 쉬움
  const won = d.wins.reduce((a, b) => a + b, 0);
  if (won) rows.push(['📋 앞 단계 성공', 0.05 * won]);
  return rows;
}
export const responseChance = (s: GameState, rid: string) => clamp(responseRows(s, rid).reduce((a, [, v]) => a + v, 0), 0.1, 0.92);

export function canRespond(s: GameState, rid: string): string | null {
  const d = disasterOf(s);
  if (!d) return '재난이 없어요';
  if (!disasterKind(d.kind).stages[d.stage][0].includes(rid)) return '이 단계에서 고를 수 없어요';
  if (rid === 'money') {
    const me = s.nations[s.player.countryId];
    if (!me || me.treasury < budgetPerDay(s, s.player.countryId) * 0.5) return '나라 예산이 모자라요';
  }
  return null;
}

/** 대응 고르기 → 바로 결과 */
export function respond(s: GameState, rid: string): GameState {
  if (canRespond(s, rid)) return s;
  let ns = s;
  const me = ns.player.countryId;
  if (rid === 'money') ns = payTreasury(ns, budgetPerDay(ns, me) * 0.5) ?? ns;
  if (rid === 'army') {
    const n = ns.nations[me];
    ns = { ...ns, nations: { ...ns.nations, [me]: { ...n, troops: n.troops * 0.995 } } };
  }
  const chance = responseChance(ns, rid);
  let rnd: number;
  [rnd, ns] = roll(ns);
  const ok = rnd < chance;
  return stageDone(ns, rid, ok);
}

function stageDone(s: GameState, rid: string | null, ok: boolean): GameState {
  const d = disasterOf(s)!;
  const k = disasterKind(d.kind);
  const r = rid ? responderById(rid) : null;
  const cname = cityById(d.cityId).name;
  let ns = polityLog(s, `${k.icon} ${cname} ${k.name} ${STAGE_NAMES[d.stage]}: ${r ? `${r.icon} ${r.name}` : '⌛ 시간 초과'} → ${ok ? '성공' : '실패'}`);
  if (!ok && d.stage === 1 && rid !== 'army') {
    let who: string | null;
    [ns, who] = bumpRival(ns, '군부 실력자', 3);
    if (who) ns = tell(ns, `🎖️ 군부 실력자 ${who}: "군을 왜 진작 보내지 않았나? 정부가 국민을 버렸다."`);
  }
  const next: Disaster = { ...d, stage: d.stage + 1, wins: [...d.wins, ok ? 1 : 0], picks: [...d.picks, rid ?? ''], endMs: ns.worldMs + STAGE_MS };
  if (next.stage < 3) return withPolity(ns, { disaster: next });
  return finish(ns, next);
}

function finish(s: GameState, d: Disaster): GameState {
  const k = disasterKind(d.kind);
  const w = d.wins.reduce((a, b) => a + b, 0);
  const cname = cityById(d.cityId).name;
  const p = polityOf(s);
  let gap: number;
  let ns = s;
  [gap, ns] = roll(ns);
  ns = withPolity(ns, {
    disaster: null,
    disasterMs: ns.worldMs + (GAP_H[0] + (GAP_H[1] - GAP_H[0]) * gap) * H,
    disasterWins: p.disasterWins + (w >= 2 ? 1 : 0),
    disasterLoss: p.disasterLoss + (w < 2 ? 1 : 0),
  });
  const me = ns.player.countryId;
  if (w === 3) {
    ns = addPresMod(ns, `${k.icon} ${cname} ${k.name} 완벽 대응`, 6, 48);
    ns = addMark(ns, d.cityId, 10, 72, `${k.icon} 재난 완벽 대응`);
    ns = bumpTrust(ns, 2);
    ns = tell(ns, `${k.icon} ${cname} ${k.name}에 완벽하게 대응했어요! 지지도 +6 · ${cname} 민심 +10`);
  } else if (w === 2) {
    ns = addPresMod(ns, `${k.icon} ${cname} ${k.name} 대응`, 2, 24);
    ns = addMark(ns, d.cityId, 4, 48, `${k.icon} 재난 대응`);
    ns = tell(ns, `${k.icon} ${cname} ${k.name}을(를) 잘 넘겼어요. 지지도 +2`);
  } else {
    const days = w === 1 ? 1 : 2;
    ns = payTreasury(ns, Math.min(ns.nations[me].treasury, budgetPerDay(ns, me) * days)) ?? ns;
    ns = addPresMod(ns, `${k.icon} ${cname} ${k.name} 늑장 대응`, w === 1 ? -3 : -6, 48);
    ns = addMark(ns, d.cityId, w === 1 ? -6 : -12, 72, `${k.icon} 재난 피해`);
    if (w === 0) ns = bumpTrust(ns, -3);
    let who: string | null;
    [ns, who] = bumpRival(ns, '야당 대표', w === 1 ? 4 : 8);
    ns = tell(ns, `${k.icon} ${cname} ${k.name} 피해가 커졌어요. 복구비 ${days}일치 · 지지도 ${w === 1 ? -3 : -6}${who ? ` · 야당 대표 ${who}: "무능한 정부가 재난을 키웠다!"` : ''}`);
  }
  return snap(ns, 'disaster', `${cname} ${k.name}`, `대응 ${w}/3 성공`);
}

/** 15분마다: 재난 시작 · 단계 마감 */
export function disasterTick(s: GameState): GameState {
  if (!s.polity) return s;
  let ns = s;
  const p = polityOf(ns);
  if (p.disaster) {
    if (p.disaster.endMs <= ns.worldMs) return stageDone(ns, null, false);
    return ns;
  }
  if (ns.worldMs < p.disasterMs) return ns;
  const cities = myCityIds(ns);
  if (!cities.length) return withPolity(ns, { disasterMs: ns.worldMs + DAY });
  let a: number, b: number;
  [a, ns] = roll(ns);
  [b, ns] = roll(ns);
  const coast = cities.filter((c) => isCoastalCity(c));
  const kinds = DISASTERS.filter((k) => !k.coastal || coast.length);
  const k = kinds[Math.floor(a * kinds.length)];
  const pool = k.coastal ? coast : cities;
  const cityId = pool[Math.floor(b * pool.length)];
  const d: Disaster = { kind: k.id, cityId, stage: 0, endMs: ns.worldMs + STAGE_MS, wins: [], picks: [] };
  ns = withPolity(ns, { disaster: d });
  const cname = cityById(cityId).name;
  ns = polityLog(ns, `${k.icon} ${cname}에 ${k.name}! 재난 지휘실을 열어 주세요`);
  return tell(ns, `🚨 ${cname}에 ${k.name}이(가) 닥쳤어요. ${k.text}. 사회 → 국정 → 재난에서 지휘해 주세요(단계마다 2시간).`);
}
