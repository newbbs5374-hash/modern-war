// 지도 위 전투(기획서 "지도 위에서 바로 싸우기"): 실제 육각 지도에서 도시 주변을 잘라 와,
// 부대 말이 실시간으로 움직이고 옆 칸(포병·함선은 2~3칸) 적과 알아서 싸움.
// - 항모가 움직이면 전투기 작전 범위(4칸)도 따라감
// - 보급: 상륙 거점·항모에서 멀어지면 힘이 줄어듦
// - 안개: 내 부대 주변만 보임(드론·잠수함이 멀리 봄). 잠수함은 가까이 가거나 구축함이 있어야 보임
// - 큰 싸움(적 사령부·적 기함)에 닿으면 "직접 지휘"로 기존 전투 틀에 들어갈 수 있음
// - 특화 유닛(11-23): 우리·적 나라의 특화 유닛·독점 병과가 고유 능력을 갖고 나옴(data/specials.ts)
// - 연료·탄약(자원 3안): 쏠 때 탄약, 비행기·배는 움직일 때 연료를 씀. 보급 범위에서 다시 채움. 떨어지면 약하고 느려짐
// 계산은 이 파일에서만 하고(같은 입력·같은 조작이면 같은 결과), 화면은 보여 주기만 한다.
import { CITY_HEX, HEX_DIRS, TILE_AT, disk, hexDist, hexKey, type Hex } from '../data/hexmap';
import { CITIES, cityById } from '../data/cities';
import { exclusiveByName, specialById, specialsByKind, type FieldMod } from '../data/specials';
import { UNITS } from '../data/catalog';
import { Rng } from '../game/rng';

export type FTerrain = '평지' | '숲' | '산' | '시가지' | '도심' | '바다' | '해협' | '해안';
export type Layer = 'land' | 'sea' | 'air';
export type FKind = 'infantry' | 'tank' | 'artillery' | 'aa' | 'drone' | 'fighter' | 'destroyer' | 'submarine' | 'carrier' | 'cruiser' | 'hq';
export type Side = 'me' | 'foe';

export interface FUnitDef {
  name: string;
  icon: string;
  layer: Layer;
  hp: number;
  atk: number;
  def: number;
  /** 한 칸 가는 데 걸리는 시간(전투 초). 0 = 못 움직임 */
  move: number;
  range: number;
  sight: number;
  /** 공격 간격(초) */
  cd: number;
  /** 비행 부대: 기지(항모·비행장)에서 나갈 수 있는 거리 */
  op?: number;
  does: string;
}

export const FUNIT: Record<FKind, FUnitDef> = {
  infantry: { name: '보병', icon: '🪖', layer: 'land', hp: 100, atk: 13, def: 10, move: 3, range: 1, sight: 2, cd: 2, does: '싸고 튼튼. 도심은 보병·전차만 차지할 수 있어요' },
  tank: { name: '전차', icon: '🛡️', layer: 'land', hp: 150, atk: 21, def: 17, move: 2, range: 1, sight: 2, cd: 2, does: '빠르고 세요. 보병에 강해요' },
  artillery: { name: '포병', icon: '💥', layer: 'land', hp: 80, atk: 22, def: 6, move: 3.5, range: 3, sight: 2, cd: 3, does: '3칸 밖에서 쏴요. 가까이 붙으면 약해요' },
  aa: { name: '방공', icon: '📡', layer: 'land', hp: 90, atk: 9, def: 10, move: 3, range: 2, sight: 3, cd: 1.5, does: '전투기·드론을 잘 떨어뜨려요' },
  drone: { name: '드론', icon: '🛸', layer: 'air', hp: 40, atk: 5, def: 4, move: 1, range: 1, sight: 4, cd: 2, op: 6, does: '멀리(4칸) 봐요. 안개를 걷어요' },
  fighter: { name: '전투기', icon: '✈️', layer: 'air', hp: 90, atk: 19, def: 10, move: 0.8, range: 1, sight: 3, cd: 1.5, op: 4, does: '기지(항모)에서 4칸 안을 날아요. 항모가 움직이면 범위도 따라가요' },
  destroyer: { name: '구축함', icon: '🚢', layer: 'sea', hp: 150, atk: 17, def: 14, move: 1.5, range: 3, sight: 3, cd: 2, does: '3칸 사격. 잠수함을 찾아내고 비행기에 강해요' },
  submarine: { name: '잠수함', icon: '🫧', layer: 'sea', hp: 110, atk: 27, def: 10, move: 1.8, range: 2, sight: 3, cd: 3, does: '숨어 다니며 배를 잡아요. 구축함 옆에선 들켜요' },
  carrier: { name: '항공모함', icon: '🛳️', layer: 'sea', hp: 230, atk: 4, def: 16, move: 2, range: 1, sight: 3, cd: 2, does: '바다 위 비행장. 지면 전투기가 상륙 거점으로 돌아가요' },
  cruiser: { name: '적 기함', icon: '⚓', layer: 'sea', hp: 280, atk: 23, def: 18, move: 2, range: 3, sight: 3, cd: 2, does: '적 함대의 우두머리. 붙으면 함대 결전을 직접 지휘할 수 있어요' },
  hq: { name: '적 사령부', icon: '🏯', layer: 'land', hp: 260, atk: 15, def: 22, move: 0, range: 2, sight: 3, cd: 2, does: '도심을 지켜요. 무너뜨리고 육군이 도심에 닿으면 점령' },
};

export const TERRAIN_INFO: Record<FTerrain, { color: string; cover: number; cost: number; text: string }> = {
  평지: { color: '#7fa65a', cover: 1, cost: 1, text: '보통' },
  숲: { color: '#4f7f45', cover: 1.25, cost: 1.3, text: '방어 +25% · 조금 느림' },
  산: { color: '#8c8273', cover: 1.45, cost: 2, text: '방어 +45% · 2배 느림' },
  시가지: { color: '#a59e92', cover: 1.25, cost: 1.2, text: '방어 +25%(도시 방어도만큼 더)' },
  도심: { color: '#6f6a78', cover: 1.4, cost: 1.2, text: '방어 +40%(도시 방어도만큼 더) · 적 비행장' },
  해안: { color: '#d8c48a', cover: 1, cost: 1, text: '상륙 거점 · 보급이 시작되는 곳' },
  바다: { color: '#2f6f9f', cover: 1, cost: 1, text: '함선이 다니는 곳' },
  해협: { color: '#3f9bb0', cover: 1, cost: 1.8, text: '얕은 바다 · 함선이 1.8배 느림' },
};

const LAND: FTerrain[] = ['평지', '숲', '산', '시가지', '도심', '해안'];
export const isLand = (t: FTerrain) => LAND.includes(t);
/** 도심을 차지할 수 있는 부대 */
export const CAPTURERS: FKind[] = ['infantry', 'tank'];

/** 전투 화면 칸 크기(픽셀) */
export const FIELD_HEX = 14;
/** 잘라 올 반지름(169칸) */
export const FIELD_R = 7;
/** 전투 시간 한도(초) */
export const FIELD_LIMIT = 360;
/** 전투 1초 = 게임 2분(화면 표시용) */
export const GAME_MIN_PER_SEC = 2;
/** 보급: 거점에서 이 거리 안 / 항모에서 이 거리 안 */
export const SUPPLY_RANGE = 5;
export const SUPPLY_CARRIER = 3;
const DT = 0.25;
/** 전체 피해 배율(낮을수록 싸움이 길어져 손쓸 틈이 생김) */
const DMG = 0.7;

export interface FCell {
  q: number;
  r: number;
  x: number;
  y: number;
  terrain: FTerrain;
}

export interface Field {
  city: string;
  cells: FCell[];
  idx: Map<string, number>;
  nbr: number[][];
  dist: Uint8Array;
  n: number;
  center: number;
  landing: number;
  hasSea: boolean;
  /** 칸마다 바다 덩어리 번호(땅은 -1) */
  seaComp: Int32Array;
  /** 함대가 다니는 바다 덩어리(상륙 거점에 닿은 큰 바다) */
  fleetSea: number;
  w: number;
  h: number;
}

export interface FUnit {
  id: number;
  kind: FKind;
  side: Side;
  at: number;
  hp: number;
  maxHp: number;
  cd: number;
  mv: number;
  path: number[];
  goal: number | null;
  face: 1 | -1;
  supply: number;
  /** 마지막으로 맞은 때(연출용) */
  hitAt?: number;
  /** 비행 부대 기지: 항모 id, -1 = 상륙 거점·적 비행장 */
  base?: number;
  /** 처음 자리(적이 지키는 곳) */
  home: number;
  /** 큰 싸움 물어봤는지 */
  prompted?: boolean;
  /** 잠수함이 쏜 뒤 드러나는 시간 */
  reveal?: number;
  /** 우리 편에 막혀 기다린 시간 */
  wait?: number;
  /** 특화 유닛 이름표(us-2) 또는 독점 병과 이름 */
  sp?: string;
  /** 한 번이라도 쐈는지(기습 첫 공격) */
  fired?: boolean;
  /** 탄약·연료(0~1) */
  ammo: number;
  fuel: number;
}

/** 탄약 1발 = 이만큼(쏠 때마다) · 연료 1칸 = 이만큼(비행기·배가 움직일 때) */
export const AMMO_PER_SHOT = 0.04;
export const FUEL_PER_STEP = 0.035;
/** 보급 범위 안에서 1초에 다시 차는 양 */
const REFILL = 0.005;
/** 떨어지면: 공격 ×0.35 · 움직임 2.5배 느림 */
export const NO_AMMO_ATK = 0.35;
export const NO_FUEL_MOVE = 2.5;

/** 그 부대의 특화 능력(없으면 undefined) */
export function modOf(u: { sp?: string }): FieldMod | undefined {
  if (!u.sp) return undefined;
  return specialById(u.sp)?.field ?? exclusiveByName(u.sp)?.field;
}
/** 화면에 보일 이름 */
export function unitName(u: { kind: FKind; sp?: string }): string {
  if (!u.sp) return FUNIT[u.kind].name;
  return specialById(u.sp)?.name ?? u.sp;
}
/** 특화 능력을 더한 수치 */
export function defOf(u: { kind: FKind; sp?: string }): FUnitDef {
  const d = FUNIT[u.kind];
  const m = modOf(u);
  if (!m) return d;
  return {
    ...d,
    name: unitName(u),
    hp: Math.round(d.hp * (m.hp ?? 1)),
    atk: d.atk * (m.atk ?? 1),
    def: d.def * (m.def ?? 1),
    range: d.range + (m.range ?? 0),
    sight: d.sight + (m.sight ?? 0),
    move: d.move * (m.move ?? 1),
    does: specialById(u.sp!)?.effect ?? UNITS.find((x) => x.name === u.sp)?.role ?? d.does,
  };
}

export interface FFx {
  kind: 'shot' | 'boom' | 'wreck';
  from: number;
  to: number;
  t: number;
  side: Side;
  /** 쏜 부대 종류 · 맞은 부대 층(연출용: 포탄·미사일·어뢰·물보라) */
  by?: FKind;
  at?: Layer;
  /** 크게 맞음(피해가 큼) */
  big?: boolean;
}

/** 효과가 화면에 남는 시간(전투 초) */
export const FX_LIFE: Record<FFx['kind'], number> = { shot: 1.4, boom: 1.2, wreck: 3 };

export interface FieldInput {
  city?: string;
  difficulty: number;
  rank: number;
  stats: Record<string, number>;
  seed: number;
  enemy?: string;
  /** 도시 방어도(0~100) */
  defense?: number;
  /** 우리가 가진 특화 유닛·독점 병과(이름표 → 부대 수) */
  roster?: Record<string, number>;
  /** 적 나라 id(적 특화 유닛) */
  enemyId?: string;
  /** 출발 때 연료·탄약(0~1, 나라 창고의 석유·구리만큼) */
  fuel?: number;
  ammo?: number;
}

export interface FieldBattle {
  field: Field;
  t: number;
  units: FUnit[];
  fx: FFx[];
  log: string[];
  nextId: number;
  seed: number;
  auto: boolean;
  /** 큰 싸움 물어보는 중(그동안 멈춤) */
  prompt: { boss: number; by: number } | null;
  hqDown: boolean;
  startCount: number;
  difficulty: number;
  defense: number;
  mods: { atk: number; cover: number; ranged: number; sight: number; decay: number };
  enemy: string;
  result: { win: boolean; stars: number; text: string } | null;
  /** 자동 지휘: 모이는 곳(돌격 전) · 돌격 시작했는지 */
  rally: number;
  charge: boolean;
  /** 잃은 내 부대 수 */
  lost: number;
  killed: number;
}

// ── 지도 자르기 ──

function noise(q: number, r: number, salt: number): number {
  let h = Math.imul(q * 374761393 + r * 668265263 + salt * 2246822519, 1274126177) ^ 0x5bd1e995;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function smooth(q: number, r: number): number {
  let s = noise(q, r, 7) * 2;
  for (const d of HEX_DIRS) s += noise(q + d.q, r + d.r, 7);
  return s / 8;
}

const fieldCache = new Map<string, Field>();

/** 바다가 닿는 도시만(함대·항모가 나올 수 있게). 없으면 아무 도시 */
export function defaultCity(seed: number): string {
  const ok = CITIES.filter((c) => buildField(c.id).hasSea);
  const list = ok.length ? ok : CITIES;
  return list[Math.abs(seed) % list.length].id;
}

export function buildField(city: string): Field {
  const hit = fieldCache.get(city);
  if (hit) return hit;
  const c0 = CITY_HEX[city];
  const center: Hex = { q: c0.q, r: c0.r };
  const hexes = disk(center, FIELD_R);
  const SQ3 = Math.sqrt(3);
  const cells: FCell[] = hexes.map((h) => {
    const dq = h.q - center.q;
    const dr = h.r - center.r;
    const tile = TILE_AT.get(hexKey(h.q, h.r));
    let terrain: FTerrain;
    if (tile) {
      if (tile.place === city) terrain = tile.center ? '도심' : '시가지';
      else {
        const v = smooth(h.q, h.r);
        terrain = v > 0.62 ? '산' : v > 0.5 ? '숲' : '평지';
      }
    } else {
      const landN = HEX_DIRS.filter((d) => TILE_AT.has(hexKey(h.q + d.q, h.r + d.r))).length;
      terrain = landN >= 3 ? '해협' : '바다';
    }
    return { q: h.q, r: h.r, x: FIELD_HEX * SQ3 * (dq + dr / 2), y: FIELD_HEX * 1.5 * dr, terrain };
  });
  const idx = new Map(cells.map((c, i) => [hexKey(c.q, c.r), i]));
  const nbr = cells.map((c) => HEX_DIRS.map((d) => idx.get(hexKey(c.q + d.q, c.r + d.r))).filter((v): v is number => v !== undefined));
  const n = cells.length;
  const dist = new Uint8Array(n * n);
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) dist[i * n + j] = hexDist(cells[i], cells[j]);
  const ci = idx.get(hexKey(center.q, center.r))!;
  // 도심과 땅으로 이어진 칸
  const linked = new Set<number>([ci]);
  const queue = [ci];
  while (queue.length) {
    const a = queue.shift()!;
    for (const b of nbr[a]) if (!linked.has(b) && isLand(cells[b].terrain)) {
      linked.add(b);
      queue.push(b);
    }
  }
  // 바다 덩어리(이어진 바다 칸 묶음). 작은 웅덩이에는 함대를 두지 않음
  const seaComp = new Int32Array(n).fill(-1);
  const compSize: number[] = [];
  for (let i = 0; i < n; i++) {
    if (isLand(cells[i].terrain) || seaComp[i] >= 0) continue;
    const id = compSize.length;
    let size = 0;
    const st = [i];
    seaComp[i] = id;
    while (st.length) {
      const a = st.pop()!;
      size++;
      for (const b of nbr[a]) if (!isLand(cells[b].terrain) && seaComp[b] < 0) {
        seaComp[b] = id;
        st.push(b);
      }
    }
    compSize.push(size);
  }
  const BIG = 14;
  const bigSeaOf = (i: number) => {
    let best = -1;
    for (const j of nbr[i]) if (seaComp[j] >= 0 && compSize[seaComp[j]] >= BIG && (best < 0 || compSize[seaComp[j]] > compSize[best])) best = seaComp[j];
    return best;
  };
  const seaNext = (i: number) => bigSeaOf(i) >= 0;
  const D = (i: number) => dist[i * n + ci];
  // 상륙 거점: 이어진 땅 중 바다에 닿고 도심에서 먼 칸(도시 밖 땅이면 더 좋음, 산은 피함)
  const far4 = [...linked].filter((i) => i !== ci && cells[i].terrain !== '산' && D(i) >= 4 && seaNext(i));
  const cand = far4.length ? far4 : [...linked].filter((i) => i !== ci && cells[i].terrain !== '산' && D(i) >= 3);
  const score = (i: number) => (seaNext(i) ? 10 : 0) + Math.min(D(i), 6) + (cells[i].terrain === '시가지' ? 0 : 1.5) + noise(cells[i].q, cells[i].r, 3);
  cand.sort((a, b) => score(b) - score(a));
  const landing = cand[0] ?? [...linked].sort((a, b) => D(b) - D(a))[0] ?? ci;
  const fleetSea = seaNext(landing) ? bigSeaOf(landing) : -1;
  const hasSea = fleetSea >= 0;
  if (hasSea) cells[landing].terrain = '해안';
  const xs = cells.map((c) => c.x);
  const ys = cells.map((c) => c.y);
  const f: Field = {
    city,
    cells,
    idx,
    nbr,
    dist,
    n,
    center: ci,
    landing,
    hasSea,
    seaComp,
    fleetSea,
    w: Math.max(...xs) - Math.min(...xs) + FIELD_HEX * SQ3,
    h: Math.max(...ys) - Math.min(...ys) + FIELD_HEX * 2,
  };
  fieldCache.set(city, f);
  return f;
}

export const fDist = (f: Field, a: number, b: number) => f.dist[a * f.n + b];

// ── 만들기 ──

const statF = (stats: Record<string, number>, k: string, rank: number) => Math.min(1, (stats[k] ?? 8) / (20 + rank * 10));

export function createField(inp: FieldInput): FieldBattle {
  const city = inp.city && CITY_HEX[inp.city] ? inp.city : defaultCity(inp.seed);
  const f = buildField(city);
  const rng = new Rng(inp.seed >>> 0);
  const d = inp.difficulty;
  const b: FieldBattle = {
    field: f,
    t: 0,
    units: [],
    fx: [],
    log: [],
    nextId: 1,
    seed: rng.seed,
    auto: false,
    prompt: null,
    hqDown: false,
    startCount: 0,
    difficulty: d,
    defense: inp.defense ?? 40 + d * 20,
    mods: {
      atk: 1 + 0.2 * statF(inp.stats, '통솔', inp.rank),
      cover: 1 + 0.15 * statF(inp.stats, '전술', inp.rank),
      ranged: 1 + 0.25 * statF(inp.stats, '포격', inp.rank),
      sight: statF(inp.stats, '정보', inp.rank) > 0.6 ? 1 : 0,
      decay: 1 - 0.5 * statF(inp.stats, '군수', inp.rank),
    },
    enemy: inp.enemy ?? '적군',
    result: null,
    rally: f.landing,
    charge: false,
    lost: 0,
    killed: 0,
  };
  const used = new Set<string>();
  const layerKey = (i: number, k: FKind) => `${i}:${FUNIT[k].layer === 'air' ? 'a' : 's'}`;
  const startFuel = Math.max(0.3, Math.min(1, inp.fuel ?? 1));
  const startAmmo = Math.max(0.3, Math.min(1, inp.ammo ?? 1));
  const add = (kind: FKind, side: Side, at: number, extra: Partial<FUnit> = {}) => {
    const def = defOf({ kind, sp: extra.sp });
    const hp = Math.round(def.hp * (side === 'foe' ? 0.7 + 0.25 * d : 1));
    used.add(layerKey(at, kind));
    const u: FUnit = {
      id: b.nextId++, kind, side, at, hp, maxHp: hp, cd: rng.range(0, def.cd), mv: 0, path: [], goal: null, face: side === 'me' ? 1 : -1, supply: 1, home: at,
      ammo: side === 'me' ? startAmmo : 1, fuel: side === 'me' ? startFuel : 1, ...extra,
    };
    b.units.push(u);
    return u;
  };
  /** 이미 놓인 부대를 특화 유닛으로 바꿈(체력도 다시) */
  const promote = (u: FUnit, sp: string) => {
    const was = u.maxHp;
    u.sp = sp;
    const k = u.side === 'foe' ? 0.7 + 0.25 * d : 1;
    u.maxHp = Math.round(defOf(u).hp * k);
    u.hp = Math.round((u.hp / was) * u.maxHp);
  };
  const D = (a: number, c: number) => fDist(f, a, c);
  const C = f.center;
  // 빈 칸 찾기: 조건에 맞는 칸을 점수 순서로
  const pick = (kind: FKind, ok: (i: number) => boolean, score: (i: number) => number): number | null => {
    const layer = FUNIT[kind].layer;
    let best: number | null = null;
    let bs = Infinity;
    for (let i = 0; i < f.n; i++) {
      if (used.has(layerKey(i, kind))) continue;
      const t = f.cells[i].terrain;
      if (layer === 'land' && !isLand(t)) continue;
      if (layer === 'sea' && (isLand(t) || f.seaComp[i] !== f.fleetSea)) continue;
      if (!ok(i)) continue;
      const s = score(i) + noise(f.cells[i].q, f.cells[i].r, inp.seed & 0xff) * 0.5;
      if (s < bs) {
        bs = s;
        best = i;
      }
    }
    return best;
  };

  // 적: 사령부 + 수비대 + (바다가 있으면) 함대
  add('hq', 'foe', C, { prompted: false });
  const enemyLand: FKind[] = [];
  const nInf = 1 + Math.round(d * 2);
  for (let i = 0; i < nInf; i++) enemyLand.push('infantry');
  enemyLand.push('tank');
  if (d > 1.3) enemyLand.push('tank');
  enemyLand.push('artillery');
  if (d > 1.4) enemyLand.push('artillery');
  enemyLand.push('aa');
  const linkedLand = (i: number) => isLand(f.cells[i].terrain) && D(i, C) <= FIELD_R;
  for (const k of enemyLand) {
    const want = k === 'artillery' || k === 'aa' ? 1 : 2.2;
    const at = pick(k, (i) => linkedLand(i) && D(i, f.landing) >= 3 && D(i, C) <= 3, (i) => Math.abs(D(i, C) - want) + D(i, f.landing) * -0.15);
    if (at !== null) add(k, 'foe', at);
  }
  add('fighter', 'foe', C, { base: -1 });
  if (d > 1.15) {
    const at = pick('fighter', (i) => D(i, C) === 1, () => 0);
    if (at !== null) add('fighter', 'foe', at, { base: -1 });
  }

  // 나: 상륙 거점 주변
  const L = f.landing;
  const myLand: FKind[] = ['tank', 'infantry', 'tank', 'infantry', 'tank', 'infantry', 'infantry', 'artillery', 'aa'];
  if (!f.hasSea) myLand.push('tank', 'infantry', 'artillery');
  for (const k of myLand) {
    const sc = (i: number) => D(i, L) * 1 + (k === 'artillery' || k === 'aa' ? -0.5 * D(i, C) : 0.4 * D(i, C));
    const at = pick(k, (i) => D(i, L) <= 4 && !b.units.some((u) => u.side === 'foe' && D(u.at, i) <= 2), sc) ?? pick(k, (i) => D(i, L) <= 5 && D(i, C) >= 2, sc);
    if (at !== null) add(k, 'me', at);
  }
  add('drone', 'me', L, { base: -1 });
  if (f.hasSea) {
    const seaNearL = (i: number) => D(i, L) <= 4 && D(i, C) >= 4;
    const cv = pick('carrier', seaNearL, (i) => -D(i, C) + D(i, L) * 0.6);
    if (cv !== null) {
      const carrier = add('carrier', 'me', cv);
      for (let k = 0; k < 2; k++) {
        const at = pick('fighter', (i) => D(i, cv) <= 1, (i) => D(i, cv));
        if (at !== null) add('fighter', 'me', at, { base: carrier.id });
      }
      for (const k of ['destroyer', 'destroyer', 'submarine'] as FKind[]) {
        const at = pick(k, (i) => D(i, cv) <= 3 && D(i, C) >= 3, (i) => D(i, cv) + D(i, C) * 0.2);
        if (at !== null) add(k, 'me', at);
      }
    }
    // 적 함대: 도심 가까운 바다, 내 함대와 떨어져서
    const mine = b.units.filter((u) => u.side === 'me' && FUNIT[u.kind].layer === 'sea').map((u) => u.at);
    const far = (i: number) => mine.every((m) => D(i, m) >= 4);
    const fleet: FKind[] = ['cruiser', 'destroyer'];
    if (d > 1.0) fleet.push('destroyer');
    for (const k of fleet) {
      const at = pick(k, far, (i) => D(i, C));
      if (at !== null) add(k, 'foe', at, k === 'cruiser' ? { prompted: false } : {});
    }
  } else {
    for (let k = 0; k < 2; k++) {
      const at = pick('fighter', (i) => D(i, L) <= 1, (i) => D(i, L));
      if (at !== null) add('fighter', 'me', at, { base: -1 });
    }
  }
  // 특화 유닛: 가진 만큼(종류마다 2개까지) 우리 부대를 바꿈 · 독점 병과는 새로 데려옴
  const roster = inp.roster ?? {};
  const free = (kind: FKind, side: Side) => b.units.filter((u) => u.side === side && u.kind === kind && !u.sp);
  const ssn = roster['원자력 잠수함'] ?? 0;
  for (const u of free('submarine', 'me').slice(0, Math.min(2, ssn))) promote(u, '원자력 잠수함');
  for (const [id, n] of Object.entries(roster)) {
    const sd = specialById(id);
    if (!sd) continue;
    for (const u of free(sd.field.kind, 'me').slice(0, Math.min(2, n))) promote(u, id);
  }
  const cvU = b.units.find((u) => u.side === 'me' && u.kind === 'carrier');
  if (f.hasSea && cvU) {
    for (const name of ['강습상륙함', '청광 방벽함']) {
      if (!(roster[name] > 0)) continue;
      const at = pick('destroyer', (i) => D(i, cvU.at) <= 3 && D(i, C) >= 3, (i) => D(i, cvU.at) + D(i, C) * 0.1);
      if (at !== null) add('destroyer', 'me', at, { sp: name });
      const ex = exclusiveByName(name)!;
      for (let k = 0; k < (ex.field.extraInfantry ?? 0); k++) {
        const ia = pick('infantry', (i) => D(i, L) <= 3, (i) => D(i, L));
        if (ia !== null) add('infantry', 'me', ia);
      }
    }
  }
  // 적 나라 특화 유닛: 종류마다 하나씩
  if (inp.enemyId) {
    for (const kind of [...new Set(b.units.filter((u) => u.side === 'foe').map((u) => u.kind))]) {
      const list = specialsByKind(inp.enemyId, kind);
      const us = free(kind, 'foe');
      list.forEach((sd, i) => us[i] && promote(us[i], sd.id));
    }
  }
  if (Object.keys(roster).length) {
    const names = b.units.filter((u) => u.side === 'me' && u.sp).map((u) => unitName(u));
    if (names.length) b.log.unshift(`🌟 특화 유닛 출전: ${[...new Set(names)].join(' · ')}`);
  }
  const foeSp = b.units.filter((u) => u.side === 'foe' && u.sp).map((u) => unitName(u));
  if (foeSp.length) b.log.unshift(`⚠️ 적 특화 유닛: ${[...new Set(foeSp)].join(' · ')}`);
  if (startFuel < 1 || startAmmo < 1) b.log.unshift(`⛽ 창고의 석유·구리가 모자라 연료 ${Math.round(startFuel * 100)}% · 탄약 ${Math.round(startAmmo * 100)}%로 출발해요.`);
  b.startCount = b.units.filter((u) => u.side === 'me').length;
  // 모이는 곳: 상륙 거점에서 도심 쪽으로, 도심에서 4칸 떨어진 땅
  b.rally =
    pick('infantry', (i) => D(i, C) === 4 && f.cells[i].terrain !== '산', (i) => D(i, L) * 1.5) ??
    pick('infantry', (i) => D(i, C) >= 3, (i) => D(i, L)) ??
    L;
  used.delete(`${b.rally}:s`);
  b.seed = rng.seed;
  b.log.unshift(`${cityById(city).name} 앞 상륙 거점에 도착했어요. 적 사령부(🏯)를 무너뜨리고 육군으로 도심을 차지하세요.`);
  return b;
}

// ── 규칙 ──

export function canEnter(kind: FKind, t: FTerrain): boolean {
  const layer = FUNIT[kind].layer;
  if (layer === 'air') return true;
  if (layer === 'land') return isLand(t);
  return !isLand(t);
}
function stepCost(kind: FKind, t: FTerrain, u?: { sp?: string }): number {
  if (FUNIT[kind].layer === 'air') return 1;
  if (u && modOf(u)?.terrain?.at.includes(t)) return 1;
  return TERRAIN_INFO[t].cost;
}
const group = (k: FKind) => (FUNIT[k].layer === 'air' ? 'a' : 's');

/** 공격 상성(0 = 못 때림) */
export function fMult(a: FKind, d: FKind): number {
  const A = FUNIT[a];
  const Dd = FUNIT[d];
  if (Dd.layer === 'air') {
    if (a === 'aa') return 2.2;
    if (a === 'fighter') return 1.6;
    if (a === 'destroyer' || a === 'cruiser') return 1.3;
    if (a === 'carrier' || a === 'hq') return 0.6;
    if (a === 'infantry') return 0.25;
    return 0;
  }
  if (d === 'submarine') return a === 'destroyer' ? 1.6 : a === 'submarine' ? 1 : a === 'fighter' ? 0.6 : 0;
  if (a === 'aa') return 0.3;
  if (a === 'submarine') return Dd.layer === 'sea' ? 1.5 : 0;
  if (a === 'drone') return 0.5;
  if (A.layer === 'sea' && Dd.layer === 'land') return 0.7;
  if (A.layer === 'land' && Dd.layer === 'sea') return a === 'artillery' ? 0.8 : 0.4;
  if (a === 'fighter') return d === 'hq' ? 0.4 : Dd.layer === 'sea' ? 1.1 : 1;
  if (a === 'tank' && d === 'infantry') return 1.2;
  if (a === 'infantry' && d === 'tank') return 0.75;
  return 1;
}

/** 비행 부대 기지 칸 */
export function baseOf(b: FieldBattle, u: FUnit): number | null {
  if (FUNIT[u.kind].layer !== 'air') return null;
  if (u.side === 'foe') return b.hqDown ? null : b.field.center;
  if (u.base && u.base > 0) {
    const c = b.units.find((x) => x.id === u.base);
    if (c) return c.at;
  }
  return b.field.landing;
}

/** 한쪽이 보는 칸 */
export function visibleSet(b: FieldBattle, side: Side): Set<number> {
  const f = b.field;
  const out = new Set<number>();
  if (b.units.some((u) => u.side === side && modOf(u)?.reveal)) {
    for (let i = 0; i < f.n; i++) out.add(i);
    return out;
  }
  const srcs: Array<[number, number]> = b.units.filter((u) => u.side === side).map((u) => [u.at, defOf(u).sight + (side === 'me' ? b.mods.sight : 0)]);
  if (side === 'me') srcs.push([f.landing, 2]);
  else srcs.push([f.center, 4]);
  for (const [at, s] of srcs) for (let i = 0; i < f.n; i++) if (f.dist[at * f.n + i] <= s) out.add(i);
  return out;
}
/** side가 적 유닛 u를 볼 수 있는지 */
export function canSeeUnit(b: FieldBattle, side: Side, u: FUnit, vis?: Set<number>): boolean {
  if (u.side === side) return true;
  const v = vis ?? visibleSet(b, side);
  if (!v.has(u.at)) return false;
  const hidden = modOf(u)?.hidden;
  if (u.kind !== 'submarine' && !hidden) return true;
  if ((u.reveal ?? -1) > b.t) return true;
  if (b.units.some((x) => x.side === side && modOf(x)?.reveal)) return true;
  // 숨는 부대: 잠수함은 1칸(구축함 2칸), 숨는 특화 유닛은 1칸(잠수함이면 구축함도 1칸)
  return b.units.some((x) => x.side === side && (fDist(b.field, x.at, u.at) <= 1 || (!hidden && x.kind === 'destroyer' && fDist(b.field, x.at, u.at) <= 2)));
}

function occupied(b: FieldBattle, i: number, g: 'a' | 's'): FUnit | undefined {
  return b.units.find((u) => u.at === i && group(u.kind) === g);
}

/** 길 찾기(다익스트라). 적이 있는 칸은 못 지나감. 목표 칸에 적이 있으면 그 옆까지 */
export function findPath(b: FieldBattle, u: FUnit, goal: number, limit?: { center: number; r: number }, avoidFriends = false): number[] {
  const f = b.field;
  const g = group(u.kind);
  if (goal === u.at) return [];
  const blocked = new Set<number>();
  for (const x of b.units) if (x !== u && (x.side !== u.side || avoidFriends) && group(x.kind) === g) blocked.add(x.at);
  const distArr = new Float64Array(f.n).fill(Infinity);
  const prev = new Int32Array(f.n).fill(-1);
  distArr[u.at] = 0;
  const open: number[] = [u.at];
  const done = new Uint8Array(f.n);
  while (open.length) {
    let bi = 0;
    for (let k = 1; k < open.length; k++) if (distArr[open[k]] < distArr[open[bi]]) bi = k;
    const a = open.splice(bi, 1)[0];
    if (done[a]) continue;
    done[a] = 1;
    if (a === goal) break;
    for (const c of f.nbr[a]) {
      if (done[c]) continue;
      if (!canEnter(u.kind, f.cells[c].terrain)) continue;
      if (limit && f.dist[c * f.n + limit.center] > limit.r) continue;
      if (blocked.has(c) && c !== goal) continue;
      const nd = distArr[a] + stepCost(u.kind, f.cells[c].terrain, u);
      if (nd < distArr[c]) {
        distArr[c] = nd;
        prev[c] = a;
        open.push(c);
      }
    }
  }
  let end = goal;
  if (!Number.isFinite(distArr[goal])) {
    // 못 가면: 갈 수 있는 칸 중 목표에 가장 가까운 칸
    let best = -1;
    let bd = Infinity;
    for (let i = 0; i < f.n; i++)
      if (Number.isFinite(distArr[i])) {
        const dd = f.dist[i * f.n + goal] * 10 + distArr[i] * 0.1;
        if (dd < bd) {
          bd = dd;
          best = i;
        }
      }
    if (best < 0 || best === u.at) return [];
    end = best;
  }
  const path: number[] = [];
  for (let c = end; c !== u.at && c >= 0; c = prev[c]) path.unshift(c);
  if (path.length && blocked.has(path[path.length - 1])) path.pop();
  return path;
}

/** 내 부대에 이동 명령(화면에서 칸을 누름). 안 되면 까닭 */
export function orderMove(b: FieldBattle, id: number, goal: number): string | null {
  const u = b.units.find((x) => x.id === id && x.side === 'me');
  if (!u) return '부대를 먼저 골라 주세요';
  const def = FUNIT[u.kind];
  if (!def.move) return '움직일 수 없는 부대예요';
  if (def.layer !== 'air' && !canEnter(u.kind, b.field.cells[goal].terrain)) return def.layer === 'sea' ? '배는 바다로만 갈 수 있어요' : '육군은 땅으로만 갈 수 있어요';
  if (def.layer === 'air') {
    const base = baseOf(b, u);
    if (base !== null && fDist(b.field, base, goal) > (def.op ?? 4)) return `기지에서 ${def.op}칸 밖이에요(작전 범위 밖)`;
  }
  u.goal = goal;
  u.path = findPath(b, u, goal, airLimit(b, u));
  return null;
}
function airLimit(b: FieldBattle, u: FUnit) {
  const base = baseOf(b, u);
  return base === null ? undefined : { center: base, r: FUNIT[u.kind].op ?? 4 };
}

/** 한 칸 가는 데 걸리는 시간(특화 능력 · 연료 떨어짐 포함) */
export function moveNeed(u: FUnit, t: FTerrain): number {
  const def = defOf(u);
  return def.move * stepCost(u.kind, t, u) * (u.side === 'me' && def.layer !== 'land' && u.fuel <= 0 ? NO_FUEL_MOVE : 1);
}

// ── 한 걸음 ──

function rngOf(b: FieldBattle) {
  const r = new Rng(b.seed);
  return {
    r,
    save: () => {
      b.seed = r.seed;
    },
  };
}

function damage(b: FieldBattle, a: FUnit, t: FUnit, roll: number): number {
  const A = defOf(a);
  const T = defOf(t);
  const ma = modOf(a);
  const mt = modOf(t);
  const f = b.field;
  let mult = fMult(a.kind, t.kind);
  if (ma?.seaStrike && T.layer === 'sea') mult = Math.max(mult, 0.8 * ma.seaStrike);
  let atk = A.atk * mult * a.supply;
  if (a.ammo <= 0) atk *= NO_AMMO_ATK;
  if (ma) {
    if (ma.ambush && !a.fired) atk *= ma.ambush;
    if (ma.terrain && ma.terrain.at.includes(f.cells[a.at].terrain)) atk *= ma.terrain.atk;
    if (ma.vs && ma.vs.kinds.includes(t.kind)) atk *= ma.vs.v;
    if (ma.buddy && b.units.some((x) => x !== a && x.side === a.side && x.kind === ma.buddy!.kind && fDist(f, x.at, a.at) <= 1)) atk *= ma.buddy.v;
  }
  let taken = 1;
  if (mt) {
    if (mt.evadeAA && (a.kind === 'aa' || a.kind === 'destroyer' || a.kind === 'cruiser')) taken *= mt.evadeAA;
    if (mt.taken) taken *= mt.taken;
    if (mt.pack && b.units.some((x) => x !== t && x.side === t.side && x.kind === t.kind && fDist(f, x.at, t.at) <= 1)) taken *= mt.pack;
  }
  for (const w of b.units) {
    const sh = w.side === t.side ? modOf(w)?.shield : undefined;
    if (sh && fDist(f, w.at, t.at) <= sh.r) {
      taken *= sh.v;
      break;
    }
  }
  atk *= taken;
  if (a.side === 'me') {
    atk *= b.mods.atk;
    if (A.range >= 2 && A.layer !== 'air') atk *= b.mods.ranged;
  } else atk *= 0.75 + 0.2 * b.difficulty;
  let cover = 1;
  if (T.layer === 'land') {
    const ter = f.cells[t.at].terrain;
    cover = TERRAIN_INFO[ter].cover;
    if (t.side === 'foe' && (ter === '시가지' || ter === '도심')) cover += b.defense / 400;
  }
  if (t.side === 'me') cover *= b.mods.cover;
  return Math.max(1, (DMG * atk * (0.85 + 0.3 * roll) * 12) / (12 + T.def * cover));
}

function nearest(b: FieldBattle, from: number, list: FUnit[]): FUnit | null {
  let best: FUnit | null = null;
  let bd = Infinity;
  for (const u of list) {
    const d = fDist(b.field, from, u.at);
    if (d < bd) {
      bd = d;
      best = u;
    }
  }
  return best;
}

function setGoal(b: FieldBattle, u: FUnit, goal: number | null) {
  if (goal === null) {
    u.goal = null;
    u.path = [];
    return;
  }
  if (u.goal === goal && u.path.length) return;
  u.goal = goal;
  u.path = findPath(b, u, goal, airLimit(b, u));
}

/** 적 판단(1초마다) */
function foeThink(b: FieldBattle, vis: Set<number>) {
  const f = b.field;
  const mine = b.units.filter((u) => u.side === 'me' && canSeeUnit(b, 'foe', u, vis));
  for (const u of b.units) {
    if (u.side !== 'foe' || !FUNIT[u.kind].move) continue;
    const def = defOf(u);
    if (def.layer === 'land') {
      if (u.kind === 'artillery' || u.kind === 'aa') {
        if (u.at !== u.home && !u.path.length) setGoal(b, u, u.home);
        continue;
      }
      const near = nearest(b, u.at, mine.filter((m) => FUNIT[m.kind].layer === 'land' && fDist(f, m.at, u.home) <= 4));
      if (near && fDist(f, near.at, u.at) <= 3) setGoal(b, u, near.at);
      else if (u.at !== u.home) setGoal(b, u, u.home);
    } else if (def.layer === 'sea') {
      const near = nearest(b, u.at, mine.filter((m) => FUNIT[m.kind].layer === 'sea'));
      if (near && fDist(f, near.at, u.at) <= 5) setGoal(b, u, fDist(f, near.at, u.at) <= def.range ? u.at : near.at);
      else if (u.at !== u.home) setGoal(b, u, u.home);
    } else {
      const base = baseOf(b, u);
      if (base === null) continue;
      const inR = (m: FUnit) => fDist(f, m.at, base) <= (def.op ?? 4);
      const air = nearest(b, u.at, mine.filter((m) => FUNIT[m.kind].layer === 'air' && inR(m)));
      const any = air ?? nearest(b, u.at, mine.filter((m) => inR(m) && fMult(u.kind, m.kind) > 0));
      setGoal(b, u, any ? any.at : base);
    }
  }
}

/** 내 부대 자동 판단(자동전투·즉시완료·부관에게 맡기기) */
function meThink(b: FieldBattle, vis: Set<number>) {
  const f = b.field;
  const C = f.center;
  const foes = b.units.filter((u) => u.side === 'foe' && canSeeUnit(b, 'me', u, vis));
  const hq = b.units.find((u) => u.kind === 'hq');
  const myLand = b.units.filter((u) => u.side === 'me' && FUNIT[u.kind].layer === 'land');
  if (!b.charge) {
    const troops = myLand.filter((u) => u.kind === 'tank' || u.kind === 'infantry');
    const ready = troops.filter((u) => fDist(f, u.at, b.rally) <= 2).length;
    if (ready >= Math.ceil(troops.length * 0.75) || b.t >= 45) {
      b.charge = true;
      b.log.unshift('📣 모두 모였어요. 도심으로 돌격!');
    }
  }
  const aaFoes = foes.filter((e) => e.kind === 'aa' || e.kind === 'destroyer' || e.kind === 'cruiser');
  for (const u of b.units) {
    if (u.side !== 'me') continue;
    const def = defOf(u);
    const inRange = foes.some((e) => fDist(f, u.at, e.at) <= def.range && fMult(u.kind, e.kind) > 0);
    // 강습상륙함은 항모 곁, 청광 방벽함은 우리 함대 한가운데(보호막)
    if (u.sp === '강습상륙함' || u.sp === '청광 방벽함') {
      const fleet = b.units.filter((x) => x.side === 'me' && x !== u && FUNIT[x.kind].layer === 'sea' && (u.sp === '강습상륙함' ? x.kind === 'carrier' : x.kind !== 'carrier'));
      const buddy = nearest(b, u.at, fleet.length ? fleet : b.units.filter((x) => x.side === 'me' && x !== u && FUNIT[x.kind].layer === 'sea'));
      if (buddy && fDist(f, buddy.at, u.at) > 1) setGoal(b, u, buddy.at);
      else setGoal(b, u, null);
      continue;
    }
    switch (u.kind) {
      case 'tank':
      case 'infantry': {
        if (!b.charge) {
          // 다 모일 때까지 모이는 곳 둘레에서 기다림(하나씩 들어가 각개격파 당하지 않게)
          if (fDist(f, u.at, b.rally) > 1) setGoal(b, u, b.rally);
          else setGoal(b, u, null);
          break;
        }
        const close = nearest(b, u.at, foes.filter((e) => FUNIT[e.kind].layer === 'land' && fDist(f, e.at, u.at) <= 2));
        setGoal(b, u, close ? close.at : hq ? hq.at : C);
        break;
      }
      case 'artillery': {
        if (inRange) setGoal(b, u, null);
        else if (fDist(f, u.at, C) > 3) setGoal(b, u, b.charge ? C : b.rally);
        else setGoal(b, u, null);
        break;
      }
      case 'aa': {
        const buddy = nearest(b, u.at, myLand.filter((x) => x !== u && x.kind !== 'aa'));
        if (buddy && fDist(f, buddy.at, u.at) > 1) setGoal(b, u, buddy.at);
        else if (!buddy) setGoal(b, u, C);
        break;
      }
      case 'drone':
        setGoal(b, u, C);
        break;
      case 'fighter': {
        const base = baseOf(b, u)!;
        const inR = (e: FUnit) => fDist(f, e.at, base) <= (def.op ?? 4);
        const air = nearest(b, u.at, foes.filter((e) => FUNIT[e.kind].layer === 'air' && inR(e)));
        // 방공·함선 2칸 안은 피해서 때림
        const safe = (e: FUnit) => !aaFoes.some((a) => a !== e && fDist(f, a.at, e.at) <= 2);
        const tgt = air ?? nearest(b, u.at, foes.filter((e) => inR(e) && !aaFoes.includes(e) && safe(e) && fMult(u.kind, e.kind) > 0));
        setGoal(b, u, tgt ? tgt.at : base);
        break;
      }
      case 'carrier': {
        const threat = foes.some((e) => FUNIT[e.kind].layer === 'sea' && fDist(f, e.at, u.at) <= 3);
        if (threat || fDist(f, u.at, C) <= 4) setGoal(b, u, null);
        else setGoal(b, u, C);
        break;
      }
      case 'destroyer':
      case 'submarine': {
        const ships = foes.filter((e) => FUNIT[e.kind].layer === 'sea');
        const tgt = (u.kind === 'submarine' ? ships.find((e) => e.kind === 'cruiser') : null) ?? nearest(b, u.at, ships);
        if (tgt) setGoal(b, u, fDist(f, tgt.at, u.at) <= Math.max(1, def.range - 1) ? null : tgt.at);
        else setGoal(b, u, C);
        break;
      }
    }
  }
}

/** 큰 싸움 상대(사령부·기함)에 닿았는지 */
function bossTouch(b: FieldBattle): { boss: number; by: number } | null {
  for (const boss of b.units) {
    if (boss.prompted !== false) continue;
    const by = b.units.find(
      (u) =>
        u.side === 'me' &&
        (boss.kind === 'hq' ? FUNIT[u.kind].layer === 'land' && fDist(b.field, u.at, boss.at) <= 1 : FUNIT[u.kind].layer === 'sea' && u.kind !== 'carrier' && fDist(b.field, u.at, boss.at) <= 2),
    );
    if (by) return { boss: boss.id, by: by.id };
  }
  return null;
}

/** dt초 흘리기(0.25초씩). 물어볼 게 생기면 멈춤 */
export function stepField(b: FieldBattle, seconds: number, ask = true): FieldBattle {
  let left = seconds;
  while (left > 1e-9 && !b.result && !b.prompt) {
    tick(b, ask);
    left -= DT;
  }
  return b;
}

function tick(b: FieldBattle, ask: boolean) {
  const f = b.field;
  const { r, save } = rngOf(b);
  const before = b.t;
  b.t = Math.round((b.t + DT) * 1000) / 1000;
  const think = Math.floor(b.t) !== Math.floor(before);
  const visMe = visibleSet(b, 'me');
  const visFoe = visibleSet(b, 'foe');
  // 보급(상륙 거점 · 항모 · 강습상륙함). 보급 안에서는 탄약·연료도 다시 참
  const carriers = b.units.filter((u) => u.side === 'me' && (u.kind === 'carrier' || modOf(u)?.supply));
  for (const u of b.units) {
    if (u.side !== 'me') continue;
    const layer = FUNIT[u.kind].layer;
    const ok =
      layer === 'air'
        ? (() => {
            const base = baseOf(b, u);
            return base !== null && fDist(f, base, u.at) <= 1;
          })()
        : fDist(f, u.at, f.landing) <= (layer === 'sea' ? 2 : SUPPLY_RANGE) || carriers.some((c) => c !== u && fDist(f, c.at, u.at) <= SUPPLY_CARRIER) || (layer === 'sea' && !!modOf(u)?.supply) || u.kind === 'carrier';
    if (layer === 'land') u.supply = ok ? Math.min(1, u.supply + 0.05 * DT) : Math.max(0.5, u.supply - 0.02 * b.mods.decay * DT);
    if (ok) {
      u.ammo = Math.min(1, u.ammo + REFILL * DT);
      u.fuel = Math.min(1, u.fuel + REFILL * DT);
    }
  }
  // 회복(특화 능력)
  for (const u of b.units) {
    const rg = modOf(u)?.regen;
    if (rg) u.hp = Math.min(u.maxHp, u.hp + u.maxHp * rg * DT);
  }
  if (think) {
    foeThink(b, visFoe);
    if (b.auto) meThink(b, visMe);
    // 비행 부대는 범위 밖이면 기지로
    for (const u of b.units) {
      const def = FUNIT[u.kind];
      if (def.layer !== 'air') continue;
      const base = baseOf(b, u);
      if (base === null) continue;
      if (fDist(f, u.at, base) > (def.op ?? 4)) setGoal(b, u, base);
      else if (u.goal !== null && fDist(f, u.goal, base) > (def.op ?? 4)) setGoal(b, u, base);
    }
    // 길이 막혔으면 다시 찾기
    for (const u of b.units) if (u.goal !== null && !u.path.length && u.at !== u.goal && fDist(f, u.at, u.goal) > 1) u.path = findPath(b, u, u.goal, airLimit(b, u));
  }
  // 이동
  for (const u of b.units) {
    if (!u.path.length) continue;
    const def = defOf(u);
    const next = u.path[0];
    const need = moveNeed(u, f.cells[next].terrain);
    u.mv += DT;
    if (u.mv < need) continue;
    const occ = occupied(b, next, group(u.kind));
    if (occ) {
      u.mv = need;
      u.wait = (u.wait ?? 0) + DT;
      if (occ.side !== u.side || u.path.length === 1) u.path = [];
      else if (u.wait >= 2 && u.goal !== null) {
        // 우리 편이 길을 막고 있으면 돌아가는 길
        u.path = findPath(b, u, u.goal, airLimit(b, u), true);
        u.wait = 0;
      }
      continue;
    }
    u.wait = 0;
    if (f.cells[next].x !== f.cells[u.at].x) u.face = f.cells[next].x > f.cells[u.at].x ? 1 : -1;
    u.at = next;
    u.path.shift();
    u.mv = 0;
    if (u.side === 'me' && def.layer !== 'land') u.fuel = Math.max(0, u.fuel - FUEL_PER_STEP * (modOf(u)?.thrift ?? 1) * (u.sp === '원자력 잠수함' || u.kind === 'carrier' ? 0 : 1));
    if (!u.path.length && u.goal === u.at) u.goal = null;
  }
  // 공격
  const dead = new Set<number>();
  for (const u of b.units) {
    u.cd -= DT;
    if (u.cd > 0) continue;
    const def = defOf(u);
    const vis = u.side === 'me' ? visMe : visFoe;
    let tgt: FUnit | null = null;
    let ts = Infinity;
    for (const e of b.units) {
      if (e.side === u.side || dead.has(e.id)) continue;
      const dd = fDist(f, u.at, e.at);
      if (dd > def.range) continue;
      const m = fMult(u.kind, e.kind);
      if (m <= 0) continue;
      if (!canSeeUnit(b, u.side, e, vis)) continue;
      const s = e.hp / e.maxHp - m * 0.3 + dd * 0.05;
      if (s < ts) {
        ts = s;
        tgt = e;
      }
    }
    if (!tgt) {
      u.cd = 0;
      continue;
    }
    u.cd = def.cd * (u.ammo <= 0 ? 1.5 : 1);
    const dmg = damage(b, u, tgt, r.next());
    tgt.hp -= dmg;
    u.fired = true;
    if (u.side === 'me') u.ammo = Math.max(0, u.ammo - AMMO_PER_SHOT * (modOf(u)?.thrift ?? 1));
    if (modOf(u)?.hidden) u.reveal = b.t + 3;
    if (u.kind === 'submarine') u.reveal = b.t + 3;
    tgt.hitAt = b.t;
    if (u.side === 'me' || visMe.has(u.at) || visMe.has(tgt.at))
      b.fx.push({ kind: 'shot', from: u.at, to: tgt.at, t: b.t, side: u.side, by: u.kind, at: FUNIT[tgt.kind].layer, big: dmg >= tgt.maxHp * 0.12 });
    if (tgt.hp <= 0) dead.add(tgt.id);
  }
  if (dead.size) {
    for (const id of dead) {
      const u = b.units.find((x) => x.id === id)!;
      b.fx.push({ kind: 'boom', from: u.at, to: u.at, t: b.t, side: u.side, by: u.kind, at: FUNIT[u.kind].layer, big: true });
      b.fx.push({ kind: 'wreck', from: u.at, to: u.at, t: b.t, side: u.side, at: FUNIT[u.kind].layer });
      const name = FUNIT[u.kind].name;
      if (u.side === 'me') {
        b.lost++;
        b.log.unshift(`💀 우리 ${unitName(u)}을(를) 잃었어요.`);
      } else {
        b.killed++;
        if (u.kind === 'hq') {
          b.hqDown = true;
          b.log.unshift('🏯 적 사령부가 무너졌어요! 육군을 도심으로 보내 점령하세요.');
        } else if (u.kind === 'cruiser') b.log.unshift('⚓ 적 기함을 격침했어요! 바다는 우리 차지예요.');
        else if (visMe.has(u.at)) b.log.unshift(`🎯 적 ${u.sp ? `🌟${unitName(u)}` : name} 격파.`);
      }
      if (u.kind === 'carrier') {
        for (const w of b.units) if (w.base === u.id) w.base = -1;
        b.log.unshift('전투기들이 상륙 거점으로 기지를 옮겨요.');
      }
    }
    b.units = b.units.filter((u) => !dead.has(u.id));
  }
  b.fx = b.fx.filter((x) => b.t - x.t < FX_LIFE[x.kind]);
  if (b.log.length > 30) b.log.length = 30;
  save();
  // 끝?
  const troops = b.units.filter((u) => u.side === 'me' && CAPTURERS.includes(u.kind));
  if (b.hqDown && troops.some((u) => fDist(f, u.at, f.center) <= 1)) return finish(b, true);
  if (!troops.length) return finish(b, false, '보병·전차를 모두 잃어 도심을 차지할 수 없어요.');
  if (b.t >= FIELD_LIMIT) return finish(b, false, '시간 안에 도심을 차지하지 못했어요.');
  if (ask && !b.auto) b.prompt = bossTouch(b);
}

function finish(b: FieldBattle, win: boolean, why = '') {
  const lossRatio = b.lost / Math.max(1, b.startCount);
  const time = b.t / FIELD_LIMIT;
  const stars = win ? (lossRatio <= 0.25 && time <= 0.6 ? 3 : lossRatio <= 0.5 ? 2 : 1) : 0;
  const name = cityById(b.field.city).name;
  b.result = {
    win,
    stars,
    text: win
      ? `${name} 도심을 점령했어요! ${gameTime(b.t)} 만에 · 적 ${b.killed}개 격파 · 우리 부대 ${b.lost}개 잃음`
      : `${why} 적 ${b.killed}개 격파 · 우리 부대 ${b.lost}개 잃음`,
  };
  b.prompt = null;
}

/** 전투 초 → "3시간 20분" */
export function gameTime(sec: number): string {
  const m = Math.round(sec * GAME_MIN_PER_SEC);
  const h = Math.floor(m / 60);
  return h ? `${h}시간${m % 60 ? ` ${m % 60}분` : ''}` : `${m}분`;
}

/** 큰 싸움: 직접 지휘 결과 넣기 */
export function resolveBoss(b: FieldBattle, win: boolean): FieldBattle {
  const p = b.prompt;
  if (!p) return b;
  const boss = b.units.find((u) => u.id === p.boss);
  const by = b.units.find((u) => u.id === p.by);
  if (boss) {
    boss.prompted = true;
    if (win) {
      boss.hp = Math.min(boss.hp, 1);
      // 다음 걸음에서 무너지도록 한 번 더 때림
      boss.hp = 0;
      b.units = b.units.filter((u) => u !== boss);
      b.killed++;
      b.fx.push({ kind: 'boom', from: boss.at, to: boss.at, t: b.t, side: 'foe', by: boss.kind, at: FUNIT[boss.kind].layer, big: true });
      b.fx.push({ kind: 'wreck', from: boss.at, to: boss.at, t: b.t, side: 'foe', at: FUNIT[boss.kind].layer });
      if (boss.kind === 'hq') {
        b.hqDown = true;
        b.log.unshift('🏯 직접 지휘로 적 사령부를 무너뜨렸어요! 이제 육군이 도심에 닿으면 점령이에요.');
      } else b.log.unshift('⚓ 직접 지휘로 적 기함을 격침했어요!');
      if (by) by.hp = Math.max(1, by.hp - by.maxHp * 0.15);
    } else {
      if (by) by.hp = Math.max(1, by.hp * 0.5);
      boss.hp = Math.min(boss.maxHp, boss.hp + boss.maxHp * 0.1);
      b.log.unshift(`${FUNIT[boss.kind].name}과의 결전에서 밀렸어요. 지도 위에서 계속 싸워요.`);
    }
  }
  b.prompt = null;
  return b;
}
/** 큰 싸움: 직접 지휘 안 하고 지도 위에서 계속 */
export function skipBoss(b: FieldBattle): FieldBattle {
  const p = b.prompt;
  if (!p) return b;
  const boss = b.units.find((u) => u.id === p.boss);
  if (boss) boss.prompted = true;
  b.prompt = null;
  return b;
}

/** 즉시완료·맡기기: 자동으로 끝까지 */
export function finishField(b: FieldBattle): FieldBattle {
  b.auto = true;
  b.prompt = null;
  for (const u of b.units) if (u.prompted === false) u.prompted = true;
  while (!b.result) stepField(b, 10, false);
  return b;
}

/** 큰 싸움 직접 지휘 난이도: 주변에 남은 적이 많을수록 어려움(밀고 들어가기만 하면 손해) */
export function bossDifficulty(b: FieldBattle, kind: FKind): number {
  const layer = kind === 'hq' ? 'land' : 'sea';
  const left = b.units.filter((u) => u.side === 'foe' && u.kind !== kind && FUNIT[u.kind].layer === layer).length;
  return Math.round((b.difficulty + 0.08 * left) * 100) / 100;
}

/** 다른 칸에서 쓰는 이름 */
export const bossName = (k: FKind) => (k === 'hq' ? '시가지 결전' : '함대 결전');
