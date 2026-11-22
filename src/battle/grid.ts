// 전투 틀 ① 격자 턴제: 위에서 내려다본 칸 지도, 내 차례 → 적 차례.
// 시야·안개·지형(엄폐)·측면(포위)·기습·사기. 자동전투와 즉시완료는 같은 인공지능을 써서 결과가 같다.
import { Rng } from '../game/rng';
import {
  AMBUSH_MULT,
  FLANK_MULT,
  HEIGHT_MULT,
  MORALE_GAIN_ON_KILL,
  MORALE_LOSS_ON_DEATH,
  TERRAIN,
  UNIT_BASE,
  combatBonus,
  hitChance,
  moraleMult,
  rollDamage,
  typeMult,
  type Terrain,
  type UnitKind,
} from './calc';

export type Side = 'me' | 'foe';
/** survive = 깃발 지키기 · eliminate = 적 전멸 · rescue = 인질 데리고 아래 줄로 · reach = 목표 칸 닿기 */
/** infiltrate = 들키지 않고 목표 칸(잠입 훈련) · naval = 바다에서 숨은 잠수함 찾아 없애기(해상 훈련) */
export type Goal = 'survive' | 'eliminate' | 'rescue' | 'reach' | 'infiltrate' | 'naval';

export interface GUnit {
  id: number;
  side: Side;
  kind: UnitKind;
  name: string;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  atk: number;
  def: number;
  move: number;
  range: number;
  sight: number;
  morale: number;
  hit: number;
  moved: boolean;
  acted: boolean;
  /** 숲·건물에서 숨은 상태(바로 옆에서만 보임) */
  hidden: boolean;
  /** 아직 구하지 못한 인질 */
  captive?: boolean;
}

export interface GridBattle {
  w: number;
  h: number;
  tiles: Terrain[];
  units: GUnit[];
  turn: number;
  maxTurns: number;
  side: Side;
  goal: Goal;
  /** 깃발(지킬 곳) · 목표 칸 */
  mark: { x: number; y: number } | null;
  /** 적이 우리를 알아챘는지(기습 보너스는 이 전까지) */
  alarm: boolean;
  waves: Array<{ turn: number; count: number }>;
  seed: number;
  nextId: number;
  lostMine: number;
  result: { win: boolean; stars: number; text: string } | null;
  log: string[];
  /** 적 강함(난이도·계급) */
  foePower: number;
  /** 해상: 소나로 드러난 곳(이 턴 동안) */
  sonar: { x: number; y: number; r: number; turn: number } | null;
  /** 잠입: 한 번이라도 들켰나 */
  spotted: boolean;
}

export interface GridSetup {
  goal: Goal;
  difficulty: number;
  rank: number;
  stats: Record<string, number>;
  aides: Array<{ name: string; specialty: string; level: number }>;
  seed: number;
  playerName?: string;
  /** 분대 크기(잠입 훈련: 소위·중위 혼자, 그 뒤 3명) */
  squadSize?: number;
}

export const GRID_W = 7;
export const GRID_H = 9;
const MAX_TURNS: Record<Goal, number> = { survive: 8, eliminate: 10, rescue: 14, reach: 8, infiltrate: 12, naval: 12 };
const GOAL_TEXT: Record<Goal, string> = {
  survive: '깃발을 8턴 동안 지키기(적이 깃발에 서면 패배)',
  eliminate: '적을 모두 없애기(들키기 전 공격은 기습 피해 ×1.5)',
  rescue: '인질 옆으로 가서 구한 뒤, 맨 아래 줄까지 데려오기',
  reach: '⭐ 목표 칸에 닿기',
  infiltrate: '들키지 않고 ⭐ 목표(문서)까지. 들키면 경보가 울려 탈출 모드(별 최대 1개)',
  naval: '바다에 숨은 적 잠수함을 소나로 찾아 모두 없애기',
};
export const goalText = (g: Goal) => GOAL_TEXT[g];

const idx = (b: { w: number }, x: number, y: number) => y * b.w + x;
const inside = (b: { w: number; h: number }, x: number, y: number) => x >= 0 && y >= 0 && x < b.w && y < b.h;
export const dist = (a: { x: number; y: number }, c: { x: number; y: number }) => Math.max(Math.abs(a.x - c.x), Math.abs(a.y - c.y));
const NB = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

export const unitAt = (b: GridBattle, x: number, y: number) => b.units.find((u) => u.hp > 0 && u.x === x && u.y === y);
export const alive = (b: GridBattle, side: Side) => b.units.filter((u) => u.hp > 0 && u.side === side && !(side === 'me' && u.kind === '인질'));

function clone(b: GridBattle): GridBattle {
  return { ...b, units: b.units.map((u) => ({ ...u })), log: [...b.log], waves: b.waves.map((w) => ({ ...w })) };
}
function say(b: GridBattle, t: string) {
  b.log = [t, ...b.log].slice(0, 30);
}

// ── 만들기 ──

function makeTiles(rng: Rng, w: number, h: number): Terrain[] {
  for (let tries = 0; tries < 40; tries++) {
    const t: Terrain[] = [];
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const edge = y >= h - 2 || y === 0;
        const r = rng.next();
        t.push(r < 0.18 ? '숲' : r < 0.27 ? '건물' : r < 0.34 ? '언덕' : r < 0.4 && !edge ? '물' : '평지');
      }
    // 위 줄에서 아래 줄까지 걸어갈 수 있어야 함
    const seen = new Set<number>();
    const q: number[] = [];
    for (let x = 0; x < w; x++) if (t[idx({ w }, x, h - 1)] !== '물') q.push(idx({ w }, x, h - 1));
    q.forEach((i) => seen.add(i));
    while (q.length) {
      const i = q.shift()!;
      const x = i % w;
      const y = Math.floor(i / w);
      for (const [dx, dy] of NB) {
        const nx = x + dx;
        const ny = y + dy;
        const j = idx({ w }, nx, ny);
        if (inside({ w, h }, nx, ny) && !seen.has(j) && t[j] !== '물') {
          seen.add(j);
          q.push(j);
        }
      }
    }
    const ok = t.every((tt, i) => tt === '물' || seen.has(i));
    if (ok) return t;
  }
  return Array(w * h).fill('평지');
}

/** 바다 지도: 대부분 물, 작은 섬(언덕) 몇 개 */
function makeSea(rng: Rng, w: number, h: number): Terrain[] {
  const t: Terrain[] = Array(w * h).fill('물');
  const n = 3 + Math.floor(rng.next() * 3);
  for (let i = 0; i < n; i++) {
    const x = 1 + Math.floor(rng.next() * (w - 2));
    const y = 2 + Math.floor(rng.next() * (h - 4));
    t[y * w + x] = '언덕';
    if (rng.chance(0.5) && x + 1 < w - 1) t[y * w + x + 1] = '언덕';
  }
  return t;
}

const SHIP = new Set<UnitKind>(['구축함', '잠수함']);
/** 이동 비용: 배는 물만, 나머지는 지형대로 */
export function moveCost(kind: UnitKind, t: Terrain): number {
  if (SHIP.has(kind)) return t === '물' ? 1 : 0;
  return TERRAIN[t].cost;
}

function mkUnit(b: GridBattle, side: Side, kind: UnitKind, name: string, x: number, y: number, mod?: Partial<GUnit>): GUnit {
  const base = UNIT_BASE[kind];
  const u: GUnit = {
    id: b.nextId++,
    side,
    kind,
    name,
    x,
    y,
    hp: base.hp,
    maxHp: base.hp,
    atk: base.atk,
    def: base.def,
    move: base.move,
    range: base.range,
    sight: base.sight,
    morale: 70,
    hit: 0,
    moved: false,
    acted: false,
    hidden: false,
    ...mod,
  };
  if (mod?.hp !== undefined) u.maxHp = mod.hp;
  return u;
}

function freeSpot(b: GridBattle, rng: Rng, rows: number[], avoid: (x: number, y: number) => boolean = () => false, kind: UnitKind = '소총') {
  const spots: Array<[number, number]> = [];
  for (const y of rows)
    for (let x = 0; x < b.w; x++) if (moveCost(kind, b.tiles[idx(b, x, y)]) > 0 && !unitAt(b, x, y) && !avoid(x, y)) spots.push([x, y]);
  return spots.length ? rng.pick(spots) : null;
}

const AIDE_KIND: Record<string, UnitKind> = { 저격: '저격', 의무: '의무', 공병: '기관총', 통신: '소총', 정찰: '소총' };

export function createGridBattle(o: GridSetup): GridBattle {
  const rng = new Rng(o.seed >>> 0);
  const w = GRID_W;
  const h = GRID_H;
  const b: GridBattle = {
    w,
    h,
    tiles: makeTiles(rng, w, h),
    units: [],
    turn: 1,
    maxTurns: MAX_TURNS[o.goal],
    side: 'me',
    goal: o.goal,
    mark: null,
    alarm: o.goal === 'survive' || o.goal === 'naval',
    waves: [],
    seed: 0,
    nextId: 1,
    lostMine: 0,
    result: null,
    log: [],
    foePower: 0.85 + (o.difficulty - 1) * 0.8 + o.rank * 0.2,
    sonar: null,
    spotted: false,
  };
  if (o.goal === 'naval') b.tiles = makeSea(rng, w, h);
  const bonus = combatBonus(o.stats);
  const meMod = (u: GUnit) => {
    u.atk = Math.round(u.atk * bonus.atkMult * 10) / 10;
    u.hp += bonus.hpAdd;
    u.maxHp = u.hp;
    u.sight += bonus.sightAdd;
    u.move += bonus.moveAdd;
    u.morale = bonus.morale;
    u.hit = bonus.hit;
    // 계급이 오르면 부하도 단단해짐
    u.hp += Math.floor(o.rank / 2);
    u.maxHp = u.hp;
  };
  // 목표 자리
  if (o.goal === 'survive') {
    const x = 3;
    b.tiles[idx(b, x, h - 1)] = '건물';
    b.mark = { x, y: h - 1 };
  } else if (o.goal === 'reach' || o.goal === 'infiltrate') {
    const x = rng.pick([0, 1, 2, 3, 4, 5, 6]);
    b.tiles[idx(b, x, 0)] = '평지';
    b.mark = { x, y: 0 };
  }
  // 우리 분대: 나 + 소총 + 기관총 + 부관마다 1명(최대 6)
  const squad: Array<[UnitKind, string]> = [
    ['소총', o.playerName ? `${o.playerName}(나)` : '나'],
    ['소총', '1분대원'],
    ['소총', '2분대원'],
    ['기관총', '기관총 사수'],
  ];
  for (const a of o.aides.slice(0, 3)) squad.push([AIDE_KIND[a.specialty] ?? '소총', a.name]);
  if (o.goal === 'naval') {
    squad.length = 0;
    squad.push(['구축함', '기함(나)'], ['구축함', '2번함'], ['구축함', '3번함']);
    if (o.rank >= 7) squad.push(['구축함', '4번함']);
  }
  if (o.squadSize) squad.length = Math.min(squad.length, o.squadSize);
  const solo = squad.length === 1;
  for (const [kind, name] of squad) {
    const spot = freeSpot(b, rng, [h - 1, h - 2], (x, y) => !!b.mark && b.mark.x === x && b.mark.y === y, kind);
    if (!spot) break;
    const u = mkUnit(b, 'me', kind, name, spot[0], spot[1]);
    meMod(u);
    if (name.endsWith('(나)') || name === '나') u.atk += 1;
    // 혼자 하는 잠입은 버틸 힘을 더 줌
    if (solo) {
      u.hp = Math.round(u.hp * 1.8);
      u.maxHp = u.hp;
    }
    b.units.push(u);
  }
  // 인질
  if (o.goal === 'rescue') {
    const spot = freeSpot(b, rng, [0, 1]);
    if (spot) {
      b.tiles[idx(b, spot[0], spot[1])] = '건물';
      b.units.push(mkUnit(b, 'me', '인질', '인질', spot[0], spot[1], { captive: true }));
    }
  }
  // 적
  const count =
    { survive: 2, eliminate: 3, rescue: 2, reach: 3, infiltrate: 3, naval: 2 }[o.goal] +
    Math.max(0, Math.round((o.difficulty - 1) * 4)) +
    Math.floor(o.rank / (o.goal === 'naval' || o.goal === 'infiltrate' ? 3 : 2));
  const tank = o.difficulty >= 1.15 || o.rank >= 4;
  if (o.goal === 'naval') {
    for (let i = 0; i < count; i++) addFoe(b, rng, i % 3 === 2 ? '구축함' : '잠수함', [0, 1, 2, 3]);
  } else if (o.goal === 'infiltrate') {
    // 경비병은 지도 곳곳(목표 근처 많이)
    for (let i = 0; i < count; i++) addFoe(b, rng, i % 3 === 2 ? '기관총' : '소총', i < 2 ? [0, 1] : [2, 3, 4, 5]);
    // 경비병은 전투 부대보다 약함
    for (const f of b.units) if (f.side === 'foe') f.atk = Math.round(f.atk * 0.7 * 10) / 10;
  } else for (let i = 0; i < count; i++) addFoe(b, rng, tank && i === 0 ? '전차' : i % 3 === 2 ? '기관총' : i % 4 === 3 ? '저격' : '소총', [0, 1, 2]);
  if (o.goal === 'survive') b.waves = [{ turn: 3, count: 2 }, { turn: 5, count: 2 + (o.difficulty > 1.1 ? 1 : 0) }];
  // 적 시야는 은밀이 높으면 줄어듦. 잠입에서 경계 전 경비병은 시야 2(경보가 울리면 원래대로)
  for (const u of b.units) if (u.side === 'foe') u.sight = o.goal === 'infiltrate' ? 2 : Math.max(2, u.sight - bonus.stealth);
  b.seed = rng.seed;
  say(b, `작전 목표: ${GOAL_TEXT[o.goal]}`);
  return b;
}

function addFoe(b: GridBattle, rng: Rng, kind: UnitKind, rows: number[]) {
  const spot = freeSpot(b, rng, rows, (x, y) => !!b.mark && b.mark.x === x && b.mark.y === y, kind);
  if (!spot) return;
  const p = b.foePower;
  const u = mkUnit(b, 'foe', kind, `적 ${kind}`, spot[0], spot[1]);
  u.atk = Math.round(u.atk * (0.6 + 0.35 * p) * 10) / 10;
  u.hp = Math.round(u.hp * (0.6 + 0.4 * p));
  u.maxHp = u.hp;
  b.units.push(u);
}

// ── 시야 ──

/** side가 (x,y)의 유닛 u를 볼 수 있나 */
export function canSee(b: GridBattle, side: Side, u: GUnit): boolean {
  if (u.kind === '잠수함') {
    if (b.sonar && side !== u.side && b.sonar.turn === b.turn && dist(b.sonar, u) <= b.sonar.r) return true;
    return b.units.some((v) => v.hp > 0 && v.side === side && dist(v, u) <= 1);
  }
  const t = b.tiles[idx(b, u.x, u.y)];
  const need = u.hidden ? 1 : t === '숲' ? 2 : 99;
  return b.units.some((v) => v.hp > 0 && v.side === side && !v.captive && v.kind !== '인질' && dist(v, u) <= Math.min(need, v.sight + (b.tiles[idx(b, v.x, v.y)] === '언덕' ? 1 : 0)));
}

/** 우리 쪽에서 보이는 칸(안개 밖) */
export function visibleTiles(b: GridBattle, side: Side = 'me'): Set<number> {
  const out = new Set<number>();
  for (const v of b.units) {
    if (v.hp <= 0 || v.side !== side || v.captive) continue;
    const s = v.sight + (b.tiles[idx(b, v.x, v.y)] === '언덕' ? 1 : 0);
    for (let y = v.y - s; y <= v.y + s; y++) for (let x = v.x - s; x <= v.x + s; x++) if (inside(b, x, y)) out.add(idx(b, x, y));
  }
  return out;
}

// ── 이동 · 공격 ──

/** 갈 수 있는 칸과 비용 */
export function reachable(b: GridBattle, u: GUnit): Map<number, number> {
  const best = new Map<number, number>([[idx(b, u.x, u.y), 0]]);
  const q: Array<[number, number, number]> = [[u.x, u.y, 0]];
  while (q.length) {
    q.sort((a, c) => a[2] - c[2]);
    const [x, y, c] = q.shift()!;
    for (const [dx, dy] of NB) {
      const nx = x + dx;
      const ny = y + dy;
      if (!inside(b, nx, ny)) continue;
      const cost = moveCost(u.kind, b.tiles[idx(b, nx, ny)]);
      if (!cost) continue;
      const other = unitAt(b, nx, ny);
      if (other && other.side !== u.side && !other.captive) continue; // 적은 못 지나감
      const nc = c + cost;
      if (nc > u.move) continue;
      const j = idx(b, nx, ny);
      if ((best.get(j) ?? 99) <= nc) continue;
      best.set(j, nc);
      q.push([nx, ny, nc]);
    }
  }
  // 다른 유닛이 서 있는 칸에는 멈출 수 없음
  for (const j of [...best.keys()]) {
    const x = j % b.w;
    const y = Math.floor(j / b.w);
    const o = unitAt(b, x, y);
    if (o && o.id !== u.id) best.delete(j);
  }
  return best;
}

/** 지금 자리에서 쏠 수 있는 적 */
export function targetsFrom(b: GridBattle, u: GUnit, x = u.x, y = u.y): GUnit[] {
  if (u.kind === '인질') return [];
  const foeSide: Side = u.side === 'me' ? 'foe' : 'me';
  return b.units.filter(
    (t) => t.hp > 0 && t.side === foeSide && !t.captive && dist({ x, y }, t) <= u.range && canSee(b, u.side, t),
  );
}

function flanked(b: GridBattle, t: GUnit, attacker: GUnit): boolean {
  const n = b.units.filter((v) => v.hp > 0 && v.side === attacker.side && !v.captive && v.kind !== '인질' && dist(v, t) <= 1).length;
  return n >= 2;
}

/** 기대 피해(인공지능이 고를 때) */
export function preview(b: GridBattle, a: GUnit, t: GUnit, x = a.x, y = a.y) {
  const d = dist({ x, y }, t);
  const cover = TERRAIN[b.tiles[idx(b, t.x, t.y)]].cover + (t.hidden ? 0.1 : 0);
  const p = hitChance(a.kind, cover, d, a.hit);
  let mult = typeMult(a.kind, t.kind) * moraleMult(a.morale);
  if (dist({ x, y }, t) <= 1 && flanked(b, t, a)) mult *= FLANK_MULT;
  if (b.tiles[idx(b, x, y)] === '언덕') mult *= HEIGHT_MULT;
  if (a.side === 'me' && !b.alarm) mult *= AMBUSH_MULT;
  const dmg = (a.atk * mult * 10) / (10 + t.def * 2);
  return { p, dmg, kill: dmg >= t.hp };
}

function rngOf(b: GridBattle) {
  return new Rng(b.seed);
}

export function moveUnit(b0: GridBattle, id: number, x: number, y: number): GridBattle {
  const b = clone(b0);
  const u = b.units.find((v) => v.id === id);
  if (!u || u.moved || u.acted || b.result || u.captive) return b0;
  if (!reachable(b, u).has(idx(b, x, y))) return b0;
  u.x = x;
  u.y = y;
  u.moved = true;
  u.hidden = false;
  afterMove(b, u);
  return b;
}

function raiseAlarm(b: GridBattle, text: string) {
  if (b.alarm) return;
  b.alarm = true;
  b.spotted = true;
  say(b, text);
  // 잠입: 경보가 울리면 경비 증원(탈출 모드)
  if (b.goal === 'infiltrate') {
    for (const f of b.units) if (f.side === 'foe') f.sight = UNIT_BASE[f.kind].sight;
    const rng = new Rng(b.seed);
    addFoe(b, rng, '소총', [0]);
    addFoe(b, rng, '소총', [0, 1]);
    b.seed = rng.seed;
    say(b, '경비병 2명이 더 나타났어요. 탈출 모드!');
  }
}

/** 해상: 소나(이 턴 동안 반경 3칸의 잠수함이 보임) */
export function sonarPing(b0: GridBattle, id: number): GridBattle {
  const b = clone(b0);
  const u = b.units.find((v) => v.id === id);
  if (!u || u.kind !== '구축함' || u.acted || b.result) return b0;
  b.sonar = { x: u.x, y: u.y, r: 3, turn: b.turn };
  u.acted = true;
  u.moved = true;
  const found = b.units.filter((v) => v.hp > 0 && v.kind === '잠수함' && v.side !== u.side && dist(v, u) <= 3).length;
  say(b, `${u.name}: 소나! 잠수함 ${found}척 발견`);
  return b;
}

function afterMove(b: GridBattle, u: GUnit) {
  // 인질 구하기: 옆에 가면 합류
  if (u.side === 'me') {
    for (const h of b.units) {
      if (h.captive && h.hp > 0 && dist(h, u) <= 1) {
        h.captive = false;
        h.moved = true;
        h.acted = true;
        say(b, `${u.name}: 인질을 구했어요! 아래 줄까지 데려가요.`);
        raiseAlarm(b, '🚨 경보! 적이 알아챘어요.');
      }
    }
  }
  // 적에게 들키면 경보
  if (!b.alarm) {
    const spotted = alive(b, 'me').some((m) => canSee(b, 'foe', m));
    if (spotted) raiseAlarm(b, '🚨 들켰어요! 적이 경계해요.');
  }
  checkEnd(b);
}

export function attack(b0: GridBattle, id: number, targetId: number): GridBattle {
  const b = clone(b0);
  const a = b.units.find((v) => v.id === id);
  const t = b.units.find((v) => v.id === targetId);
  if (!a || !t || a.acted || b.result) return b0;
  if (!targetsFrom(b, a).some((x) => x.id === t.id)) return b0;
  doAttack(b, a, t);
  return b;
}

function doAttack(b: GridBattle, a: GUnit, t: GUnit) {
  const rng = rngOf(b);
  const pv = preview(b, a, t);
  a.acted = true;
  a.moved = true;
  a.hidden = false;
  const ambush = a.side === 'me' && !b.alarm;
  if (rng.chance(pv.p)) {
    const dmg = rollDamage(rng, a.atk, t.def, pv.dmg / ((a.atk * 10) / (10 + t.def * 2)));
    t.hp = Math.max(0, t.hp - dmg);
    say(b, `${a.name} → ${t.name} ${dmg} 피해${ambush ? ' (기습!)' : ''}${t.hp === 0 ? ' · 쓰러짐' : ''}`);
    if (t.hp === 0) {
      t.hidden = false;
      for (const v of b.units) {
        if (v.hp <= 0) continue;
        if (v.side === t.side) v.morale = Math.max(0, v.morale - MORALE_LOSS_ON_DEATH);
        else v.morale = Math.min(100, v.morale + MORALE_GAIN_ON_KILL);
      }
      if (t.side === 'me' && t.kind !== '인질') b.lostMine += 1;
    }
  } else {
    say(b, `${a.name} → ${t.name} 빗나감`);
  }
  b.seed = rng.seed;
  raiseAlarm(b, '🚨 총성에 적이 경계해요.');
  checkEnd(b);
}

export function hide(b0: GridBattle, id: number): GridBattle {
  const b = clone(b0);
  const u = b.units.find((v) => v.id === id);
  if (!u || u.acted || b.result) return b0;
  const t = b.tiles[idx(b, u.x, u.y)];
  if (t !== '숲' && t !== '건물') return b0;
  u.hidden = true;
  u.acted = true;
  u.moved = true;
  say(b, `${u.name} 숨음`);
  return b;
}

export function heal(b0: GridBattle, id: number): GridBattle {
  const b = clone(b0);
  const u = b.units.find((v) => v.id === id);
  if (!u || u.kind !== '의무' || u.acted || b.result) return b0;
  const t = healTarget(b, u);
  if (!t) return b0;
  t.hp = Math.min(t.maxHp, t.hp + 4);
  u.acted = true;
  u.moved = true;
  say(b, `${u.name}: ${t.name} 치료 +4`);
  return b;
}

function healTarget(b: GridBattle, u: GUnit) {
  return b.units
    .filter((v) => v.hp > 0 && v.side === u.side && !v.captive && dist(v, u) <= 1 && v.hp < v.maxHp)
    .sort((a, c) => a.hp / a.maxHp - c.hp / c.maxHp)[0];
}

export function canHeal(b: GridBattle, u: GUnit) {
  return u.kind === '의무' && !u.acted && !!healTarget(b, u);
}

export function wait(b0: GridBattle, id: number): GridBattle {
  const b = clone(b0);
  const u = b.units.find((v) => v.id === id);
  if (!u) return b0;
  u.moved = true;
  u.acted = true;
  return b;
}

// ── 승패 ──

function checkEnd(b: GridBattle) {
  if (b.result) return;
  const mine = alive(b, 'me');
  const foes = alive(b, 'foe');
  const hostage = b.units.find((u) => u.kind === '인질');
  const finish = (win: boolean, text: string) => {
    let stars = 0;
    if (win) {
      const fast = b.goal === 'survive' || b.turn <= Math.ceil(b.maxTurns * 0.6);
      stars = b.lostMine === 0 && fast ? 3 : b.lostMine <= 1 ? 2 : 1;
    }
    b.result = { win, stars, text };
    say(b, text);
  };
  if (!mine.length) return finish(false, '분대가 모두 쓰러졌어요. 작전 실패.');
  if (b.goal === 'survive') {
    if (b.mark && foes.some((f) => f.x === b.mark!.x && f.y === b.mark!.y)) return finish(false, '적이 깃발을 빼앗았어요. 작전 실패.');
    if (!foes.length && !b.waves.length) return finish(true, '적을 모두 막았어요! 방어 성공.');
  }
  if ((b.goal === 'eliminate' || b.goal === 'naval') && !foes.length) return finish(true, b.goal === 'naval' ? '적 함대를 모두 가라앉혔어요! 해전 승리.' : '적을 모두 없앴어요! 작전 성공.');
  if (b.goal === 'infiltrate' && b.mark && mine.some((m) => m.x === b.mark!.x && m.y === b.mark!.y)) {
    b.result = {
      win: true,
      stars: b.spotted ? 1 : b.lostMine === 0 ? 3 : 2,
      text: b.spotted ? '들켰지만 문서를 빼냈어요. 잠입 성공(별 최대 1개).' : '들키지 않고 문서를 빼냈어요! 완벽한 잠입.',
    };
    say(b, b.result.text);
    return;
  }
  if (b.goal === 'rescue') {
    if (hostage && hostage.hp <= 0) return finish(false, '인질을 잃었어요. 작전 실패.');
    if (hostage && !hostage.captive && hostage.y === b.h - 1) return finish(true, '인질을 데리고 빠져나왔어요! 구출 성공.');
  }
  if (b.goal === 'reach' && b.mark && mine.some((m) => m.x === b.mark!.x && m.y === b.mark!.y))
    return finish(true, '목표 지점에 닿았어요! 작전 성공.');
}

// ── 차례 넘기기 · 인공지능 ──

function startSide(b: GridBattle, side: Side) {
  b.side = side;
  for (const u of b.units) if (u.side === side) {
    u.moved = false;
    u.acted = false;
  }
}

/** 한쪽 유닛 하나를 인공지능이 움직임 */
function aiAct(b: GridBattle, u: GUnit) {
  if (u.hp <= 0 || u.captive || b.result) return;
  const side = u.side;
  const foeSide: Side = side === 'me' ? 'foe' : 'me';
  // 의무병: 다친 아군 치료 우선
  if (u.kind === '의무') {
    const t = healTarget(b, u);
    if (t && t.hp < t.maxHp * 0.7) {
      t.hp = Math.min(t.maxHp, t.hp + 4);
      u.acted = u.moved = true;
      say(b, `${u.name}: ${t.name} 치료 +4`);
      return;
    }
  }
  // 경계 전 적은 제자리 순찰(가끔 한 칸)
  if (side === 'foe' && !b.alarm) {
    const r = rngOf(b);
    if (r.chance(0.4)) {
      const opts = [...reachable(b, u).entries()].filter(([, c]) => c <= 1);
      const pick = r.pick(opts);
      if (pick) {
        u.x = pick[0] % b.w;
        u.y = Math.floor(pick[0] / b.w);
      }
    }
    b.seed = r.seed;
    u.moved = u.acted = true;
    afterMove(b, u);
    return;
  }
  // 목표 칸
  const enemies = b.units.filter((t) => t.hp > 0 && t.side === foeSide && !t.captive);
  const known = enemies.filter((t) => canSee(b, side, t));
  // 해상: 보이는 적이 없으면 소나부터(한 턴에 한 번)
  if (side === 'me' && b.goal === 'naval' && !known.length && u.kind === '구축함' && !(b.sonar && b.sonar.turn === b.turn) && !u.acted) {
    // 먼저 앞으로 조금 나간 뒤 소나
    const opts = [...reachable(b, u).keys()].sort((a, c) => Math.floor(a / b.w) - Math.floor(c / b.w));
    if (opts.length) {
      u.x = opts[0] % b.w;
      u.y = Math.floor(opts[0] / b.w);
    }
    u.moved = false;
    const nb = sonarPing(b, u.id);
    Object.assign(b, nb);
    return;
  }
  let goal: { x: number; y: number } | null = null;
  let rush = false;
  if (side === 'me') {
    const hostage = b.units.find((h) => h.kind === '인질' && h.hp > 0);
    if (u.kind === '인질') {
      goal = { x: u.x, y: b.h - 1 };
      rush = true;
    } else if (b.goal === 'rescue' && hostage?.captive) {
      goal = hostage;
      rush = true;
    } else if (b.goal === 'rescue' && hostage) {
      goal = known.length ? nearest(u, known) : { x: hostage.x, y: Math.min(b.h - 1, hostage.y + 1) };
    } else if ((b.goal === 'reach' || b.goal === 'infiltrate') && b.mark) {
      goal = b.mark;
      rush = true;
    } else if (b.goal === 'naval') {
      goal = known.length ? nearest(u, known) : { x: Math.floor(b.w / 2), y: 1 };
    } else if (b.goal === 'survive' && b.mark) {
      goal = known.length ? nearest(u, known) : b.mark;
    } else {
      goal = known.length ? nearest(u, known) : enemies.length ? nearest(u, enemies) : null;
    }
  } else {
    goal = b.goal === 'survive' && b.mark ? b.mark : known.length ? nearest(u, known) : enemies.length ? nearest(u, enemies) : null;
  }
  // 1) 지금 쏠 수 있으면 (서두르는 중이 아니면) 먼저 쏨
  const shootNow = targetsFrom(b, u);
  if (shootNow.length && !rush && u.kind !== '인질') {
    doAttack(b, u, bestTarget(b, u, shootNow));
    return;
  }
  // 2) 움직일 칸 고르기
  const reach = reachable(b, u);
  let bestIdx = idx(b, u.x, u.y);
  let bestScore = -1e9;
  for (const [j] of reach) {
    const x = j % b.w;
    const y = Math.floor(j / b.w);
    let score = 0;
    if (goal) score -= dist({ x, y }, goal) * (rush ? 3 : 1);
    const tgts = u.kind === '인질' ? [] : targetsFrom(b, u, x, y);
    if (tgts.length && !rush) score += 4 + Math.max(...tgts.map((t) => preview(b, u, t, x, y).dmg)) * 0.3;
    score += TERRAIN[b.tiles[j]].cover * 6;
    // 적에게 너무 붙지 않기(사거리 긴 병과)
    if (u.range >= 3 && enemies.some((e) => dist(e, { x, y }) <= 1)) score -= 2;
    if (side === 'foe' && b.goal === 'survive' && b.mark && x === b.mark.x && y === b.mark.y) score += 50;
    if (side === 'me' && (b.goal === 'reach' || b.goal === 'infiltrate') && b.mark && x === b.mark.x && y === b.mark.y) score += 50;
    // 잠입: 경계 전 경비병 시야 피하기
    if (side === 'me' && b.goal === 'infiltrate' && !b.alarm) {
      const t = b.tiles[j];
      const need = t === '숲' ? 2 : 99;
      if (enemies.some((e) => dist(e, { x, y }) <= Math.min(need, e.sight))) score -= 5;
    }
    if (side === 'me' && u.kind === '인질' && y === b.h - 1) score += 50;
    if (score > bestScore) {
      bestScore = score;
      bestIdx = j;
    }
  }
  const nx = bestIdx % b.w;
  const ny = Math.floor(bestIdx / b.w);
  if (nx !== u.x || ny !== u.y) {
    u.x = nx;
    u.y = ny;
    u.hidden = false;
  }
  u.moved = true;
  afterMove(b, u);
  if (b.result) return;
  // 3) 옮긴 뒤 쏘기
  const after = u.kind === '인질' ? [] : targetsFrom(b, u);
  if (after.length) doAttack(b, u, bestTarget(b, u, after));
  else {
    u.acted = true;
    // 숲·건물이면 숨기(우리 쪽 은밀 작전에서)
    const t = b.tiles[idx(b, u.x, u.y)];
    if (side === 'me' && !b.alarm && (t === '숲' || t === '건물')) u.hidden = true;
  }
}

function nearest(u: GUnit, list: GUnit[]) {
  return [...list].sort((a, c) => dist(u, a) - dist(u, c))[0];
}
function bestTarget(b: GridBattle, u: GUnit, list: GUnit[]) {
  return [...list].sort((a, c) => {
    const pa = preview(b, u, a);
    const pc = preview(b, u, c);
    return (pc.kill ? 100 : 0) + pc.p * pc.dmg - ((pa.kill ? 100 : 0) + pa.p * pa.dmg);
  })[0];
}

function order(b: GridBattle, side: Side) {
  return b.units.filter((u) => u.side === side && u.hp > 0 && !u.captive).sort((a, c) => (side === 'foe' ? c.y - a.y : a.y - c.y) || a.id - c.id);
}

/** 내 차례를 인공지능이 대신 둠. 한 유닛씩의 장면 목록(마지막 = 끝난 모습) */
export function autoMyTurn(b0: GridBattle): GridBattle[] {
  if (b0.result || b0.side !== 'me') return [];
  const frames: GridBattle[] = [];
  let b = clone(b0);
  for (const u0 of order(b, 'me')) {
    const u = b.units.find((v) => v.id === u0.id)!;
    if (u.acted || u.hp <= 0) continue;
    aiAct(b, u);
    frames.push(b);
    b = clone(b);
    if (b.result) break;
  }
  return frames;
}

/** 내 차례 끝 → 적 차례(장면 목록) → 다음 내 차례 시작. 마지막 장면이 다음 상태 */
export function endTurn(b0: GridBattle): GridBattle[] {
  if (b0.result) return [];
  let b = clone(b0);
  startSide(b, 'foe');
  // 증원
  const wave = b.waves.find((w) => w.turn === b.turn);
  if (wave) {
    const rng = rngOf(b);
    for (let i = 0; i < wave.count; i++) addFoe(b, rng, i === 0 && b.foePower > 1.3 ? '기관총' : '소총', [0]);
    b.seed = rng.seed;
    b.waves = b.waves.filter((w) => w !== wave);
    say(b, `적 증원 ${wave.count}명이 나타났어요.`);
  }
  const frames: GridBattle[] = [b];
  b = clone(b);
  for (const u0 of order(b, 'foe')) {
    const u = b.units.find((v) => v.id === u0.id)!;
    if (u.hp <= 0) continue;
    aiAct(b, u);
    frames.push(b);
    b = clone(b);
    if (b.result) return frames;
  }
  // 다음 턴
  b.turn += 1;
  startSide(b, 'me');
  if (b.turn > b.maxTurns && !b.result) {
    if (b.goal === 'survive') {
      b.waves = [];
      b.result = { win: true, stars: b.lostMine === 0 ? 3 : b.lostMine <= 1 ? 2 : 1, text: '끝까지 버텼어요! 방어 성공.' };
    } else b.result = { win: false, stars: 0, text: '시간이 다 됐어요. 작전 실패.' };
    say(b, b.result.text);
  }
  checkEnd(b);
  frames.push(b);
  return frames;
}

/** 즉시완료: 자동전투로 끝까지(자동전투와 같은 결과) */
export function finishGrid(b0: GridBattle): GridBattle {
  let b = b0;
  for (let guard = 0; guard < 60 && !b.result; guard++) {
    if (b.side === 'me') {
      const f = autoMyTurn(b);
      if (f.length) b = f[f.length - 1];
      if (b.result) break;
    }
    const e = endTurn(b);
    if (e.length) b = e[e.length - 1];
  }
  return b;
}

export const tileIdx = idx;
