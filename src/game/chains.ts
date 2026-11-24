// 생산 줄(11/24 A1): 자원 → 공장(구역) → 실제 시설 단계 → 대형 사업·특구가 한 줄로 이어지면 나라 전체 효과.
// 고리마다 1/4씩 효과가 붙고, 4고리 모두 이으면 1.5배(완성 보너스).
// 도시 일자리: 시설·구역이 많으면 일자리가 넉넉해 민심 +, 인구만 늘고 일자리가 없으면 실업으로 민심 −.
import type { GameState } from './state';
import type { LawKey } from './laws';
import { domOf, registerDomRows, type Rows } from './domestic';
import { liveZones, myCityIds } from './zones';
import { cityCiv, cityMarks, markLevel, registerCityLoyaltyRows } from './civ';
import type { Res } from '../data/economy';
import { cityById } from '../data/cities';
import type { MarkKind } from '../data/krCities';

export interface ChainLink {
  icon: string;
  name: string;
  ok: (s: GameState) => boolean;
  /** 어떻게 잇는지(못 이었을 때 보여 줌) */
  how: string;
}
export interface ChainDef {
  id: string;
  icon: string;
  name: string;
  text: string;
  eff: Partial<Record<LawKey, number>>;
  links: ChainLink[];
}

const stock = (r: Res, n: number) => (s: GameState) => (s.economy.stock[r] ?? 0) >= n;
const stocks = (rs: Array<[Res, number]>) => (s: GameState) => rs.every(([r, n]) => (s.economy.stock[r] ?? 0) >= n);
/** 내 도시 중 한 곳이라도 이 구역을 다 지었나 */
export function hasDistrict(s: GameState, id: string): boolean {
  return myCityIds(s).some((c) => cityCiv(s, c).districts.some((d) => d.id === id && d.doneMs <= s.worldMs));
}
const district = (...ids: string[]) => (s: GameState) => ids.some((id) => hasDistrict(s, id));
/** 내 도시의 이 종류 실제 시설 중 가장 높은 단계 */
export function bestMark(s: GameState, kind: MarkKind): number {
  let best = 0;
  for (const c of myCityIds(s)) for (const m of cityMarks(c)) if (m.kind === kind) best = Math.max(best, markLevel(s, c, m.id));
  return best;
}
const mark = (kind: MarkKind, lv: number) => (s: GameState) => bestMark(s, kind) >= lv;
const project = (id: string) => (s: GameState) => (domOf(s).projects[id]?.stage ?? 0) >= 3;
const zone = (id: string) => (s: GameState) => liveZones(s).some(([, z]) => z.id === id);
const or = (...fs: Array<(s: GameState) => boolean>) => (s: GameState) => fs.some((f) => f(s));

export const CHAINS: ChainDef[] = [
  {
    id: 'ship',
    icon: '🚢',
    name: '조선',
    text: '배를 만드는 줄: 강철 → 군 조선소 → 조선소·항구 시설 → 항만물류특구',
    eff: { res: 0.04, build: 0.04, economy: 2 },
    links: [
      { icon: '🔩', name: '강철 10', ok: stock('강철', 10), how: '강철 10개 이상 모으기(채굴장·무역)' },
      { icon: '🛳️', name: '군 조선소', ok: district('shipyard'), how: '바닷가 도시에 군 조선소 구역 짓기' },
      { icon: '🚢', name: '조선소·항구', ok: or(mark('shipyard', 2), mark('port', 3)), how: '실제 조선소 2단계나 항구 3단계로 발전' },
      { icon: '⚓', name: '항만물류특구', ok: zone('port'), how: '경제 › 국가 사업에서 항만물류특구 지정' },
    ],
  },
  {
    id: 'chip',
    icon: '💽',
    name: '반도체',
    text: '칩을 만드는 줄: 희토류·반도체 → 공업 구역 → 대학 → 반도체 클러스터',
    eff: { budget: 0.05, research: 0.04, economy: 1 },
    links: [
      { icon: '🧲', name: '희토류·반도체 5', ok: stocks([['희토류', 5], ['반도체', 5]]), how: '희토류와 반도체를 5개씩 모으기' },
      { icon: '🏭', name: '공업 구역', ok: district('industry'), how: '도시에 공업 구역 짓기' },
      { icon: '🎓', name: '대학 2단계', ok: or(mark('univ', 2), district('lab')), how: '대학을 2단계로 발전하거나 연구소 구역 짓기' },
      { icon: '💽', name: '반도체 클러스터', ok: project('chip'), how: '국가 대형 사업 "반도체 클러스터" 완공' },
    ],
  },
  {
    id: 'aero',
    icon: '✈️',
    name: '항공',
    text: '비행기를 만드는 줄: 알루미늄·티타늄 → 비행장 → 항공우주 연구소 → 신공항',
    eff: { build: 0.03, diplo: 2, economy: 2 },
    links: [
      { icon: '🪙', name: '알루미늄 8·티타늄 4', ok: stocks([['알루미늄', 8], ['티타늄', 4]]), how: '알루미늄 8개·티타늄 4개 모으기' },
      { icon: '🛫', name: '비행장', ok: district('airfield'), how: '도시에 비행장 구역 짓기' },
      { icon: '🛰️', name: '항공우주 연구소', ok: or(district('aero'), mark('air', 3)), how: '항공우주 연구소 구역 짓거나 공군 시설 3단계' },
      { icon: '🛫', name: '신공항', ok: project('air'), how: '국가 대형 사업 "신공항" 완공' },
    ],
  },
  {
    id: 'arms',
    icon: '🛠️',
    name: '방산',
    text: '무기를 만드는 줄: 특수강 → 방산 공장 → 국방 연구 → 방위산업특구',
    eff: { build: 0.06, defense: 3 },
    links: [
      { icon: '🔩', name: '특수강 3 또는 강철 15', ok: or(stock('특수강', 3), stock('강철', 15)), how: '특수강 3개나 강철 15개 모으기' },
      { icon: '⚙️', name: '방산 공장', ok: district('arms'), how: '평지 칸에 방산 공장 구역 짓기' },
      { icon: '🧪', name: '국방 연구 2단계', ok: or(mark('lab', 2), district('missile')), how: '국방 연구 시설 2단계 또는 미사일 기지 구역' },
      { icon: '🛠️', name: '방위산업특구', ok: zone('arms'), how: '경제 › 국가 사업에서 방위산업특구 지정' },
    ],
  },
  {
    id: 'energy',
    icon: '⚡',
    name: '에너지',
    text: '전기를 만드는 줄: 석유 → 우라늄 → 발전소·산업 시설 → 원자력 발전소',
    eff: { res: 0.06, economy: 2, loyalty: 1 },
    links: [
      { icon: '🛢️', name: '석유 10', ok: stock('석유', 10), how: '석유 10개 이상 모으기' },
      { icon: '☢️', name: '우라늄 3', ok: stock('우라늄', 3), how: '우라늄 3개 이상 모으기' },
      { icon: '🏭', name: '발전소·산업 시설', ok: or(mark('energy', 2), mark('industry', 3)), how: '실제 발전소 2단계나 산업 시설 3단계로 발전' },
      { icon: '⚛️', name: '원자력 발전소', ok: project('nuke'), how: '국가 대형 사업 "원자력 발전소" 완공' },
    ],
  },
  {
    id: 'logi',
    icon: '📦',
    name: '물류',
    text: '물건을 나르는 줄: 항구 → 공항 → 고속철도 → 금융',
    eff: { budget: 0.04, res: 0.03, diplo: 1 },
    links: [
      { icon: '🚢', name: '항구 2단계', ok: or(mark('port', 2), district('harbor')), how: '항구 시설 2단계 또는 항만 구역' },
      { icon: '✈️', name: '공항 2단계', ok: or(mark('airport', 2), district('airfield')), how: '공항 시설 2단계 또는 비행장 구역' },
      { icon: '🚄', name: '고속철도', ok: project('rail'), how: '국가 대형 사업 "고속철도" 완공' },
      { icon: '🏦', name: '금융 2단계', ok: or(mark('bank', 2), zone('fez')), how: '금융 시설 2단계 또는 경제자유구역' },
    ],
  },
];

export function chainLinks(s: GameState, c: ChainDef): boolean[] {
  return c.links.map((l) => l.ok(s));
}
/** 이은 고리 수에 따른 효과 배율: 0, 0.25, 0.5, 0.75, 완성 1.5 */
export function chainMult(done: number): number {
  return done >= 4 ? 1.5 : done / 4;
}
type ChainRow = { def: ChainDef; links: boolean[]; done: number; mult: number };
const cache = new WeakMap<GameState, ChainRow[]>();
export function chainState(s: GameState): ChainRow[] {
  const hit = cache.get(s);
  if (hit) return hit;
  const out = CHAINS.map((def) => {
    const links = chainLinks(s, def);
    const done = links.filter(Boolean).length;
    return { def, links, done, mult: chainMult(done) };
  });
  cache.set(s, out);
  return out;
}
const CHAIN_KEYS = new Set(CHAINS.flatMap((c) => Object.keys(c.eff)));

registerDomRows((s, key) => {
  const rows: Rows = [];
  if (!CHAIN_KEYS.has(key)) return rows;
  for (const { def, done, mult } of chainState(s)) {
    const v = def.eff[key];
    if (!v || !done) continue;
    rows.push([`${def.icon} ${def.name} 생산 줄(${done}/4${done >= 4 ? ' 완성' : ''})`, v * mult]);
  }
  return rows;
});

// ── 도시 일자리 ──
export interface CityJobs {
  jobs: number;
  workers: number;
  ratio: number;
  label: string;
  loyalty: number;
}
export function cityJobs(s: GameState, cityId: string): CityJobs {
  const cc = cityCiv(s, cityId);
  // 처음엔 어느 나라든 일손보다 일자리가 조금 많음(알맞음). 그 뒤 시설을 더 키운 만큼만 늘어남
  const size = cityById(cityId).size;
  let jobs = 1.1 * (1 + (size - 1) * 1.2);
  for (const m of cityMarks(cityId)) if (m.kind !== 'nature') jobs += Math.max(0, markLevel(s, cityId, m.id) - m.lv);
  jobs += 2 * cc.districts.filter((d) => d.doneMs <= s.worldMs).length;
  jobs += (cc.mines ?? []).filter((m) => m.doneMs <= s.worldMs).length;
  const d = domOf(s);
  if (d.zones[cityId]) jobs += 3;
  for (const p of Object.values(d.projects)) if (p.cityId === cityId) jobs += p.stage >= 3 ? 4 : 2;
  const workers = 1 + cc.pop * 1.2;
  const ratio = jobs / workers;
  const [label, loyalty] = ratio >= 1.3 ? ['일자리 넉넉', 4] : ratio >= 0.95 ? ['일자리 알맞음', 1] : ratio >= 0.65 ? ['일자리 부족', -3] : ['실업 많음', -6];
  return { jobs: Math.round(jobs), workers: Math.round(workers * 10) / 10, ratio, label, loyalty };
}

registerCityLoyaltyRows((s, cityId) => {
  if (s.world.owner[cityId] !== s.player.countryId) return [];
  const j = cityJobs(s, cityId);
  return [[`💼 ${j.label}(일자리 ${j.jobs}/일손 ${j.workers})`, j.loyalty]];
});
