// 3D 메인 전투 계산기(시험판 "철벽 작전" v5.4의 계산을 그대로 옮김).
// 1초에 20번(0.05초마다) 돌고, 같은 전장 · 같은 배치 · 같은 명령이면 항상 같은 결과.
// three.js를 쓰지 않음: 화면(view.ts)은 units와 fx(그림 신호)를 읽기만 함.
import { deployTiles, isSea, type DeployTile, type FieldConfig } from './field';
import { CMD, CP_MAX, CP_RATE, CP_START, TICK, unitDef, type CmdKind, type Dom, type Side, type UnitDef, type UnitKind } from './units';

/** 사격 그림 신호(화면이 한 번 읽고 지움) */
export interface VisFire {
  kind: UnitKind;
  /** 맞는 곳 */
  x: number;
  z: number;
  /** true면 땅/물 높이, 아니면 대상 유닛 높이 */
  ground?: boolean;
  tgt?: SimUnit;
  air?: boolean;
  fly?: number;
}

export interface SimUnit {
  id: number;
  kind: UnitKind;
  side: Side;
  d: UnitDef;
  hp: number;
  max: number;
  x: number;
  z: number;
  cd: number;
  cd2: number;
  spawnCd: number;
  tgt: SimUnit | null;
  alive: boolean;
  jam: number;
  kids: number;
  /** 바라보는 방향(전투기·미사일) */
  hd: number;
  launchAt?: number;
  waitT?: number;
  mom?: SimUnit;
  flying?: boolean;
  moving?: boolean;
  moveFace?: number;
  aim?: number;
  bank?: number;
  hitT?: number;
  healT?: number;
  visFire?: VisFire | null;
  visCruise?: { x: number; z: number } | null;
}

/** 화면에 보낼 그림 신호. at(전투 시간)이 되면 화면이 꺼내 씀. 계산에는 영향 없음 */
export type SimFx =
  | { at: number; type: 'death'; unit: SimUnit }
  | { at: number; type: 'boom'; x: number; z: number; size: number }
  | { at: number; type: 'landing'; ship: SimUnit; unit: SimUnit }
  | { at: number; type: 'artyShell'; x: number; z: number }
  | { at: number; type: 'smoke'; x: number; z: number; r: number }
  | { at: number; type: 'airstrike'; x: number; z: number }
  | { at: number; type: 'cruise'; x: number; z: number }
  | { at: number; type: 'emp'; x: number; z: number; r: number }
  | { at: number; type: 'repair'; x: number; z: number; r: number }
  | { at: number; type: 'para'; x: number; z: number };

export interface SimLog {
  t: number;
  msg: string;
  /** k 우리 좋음 · x 우리 나쁨 · c 명령 */
  cls: 'k' | 'x' | 'c';
}

export interface DeployPick {
  kind: UnitKind;
  /** 배치 칸 번호(deployTiles 순서) */
  tile: number;
}

export interface Sim {
  field: FieldConfig;
  tiles: DeployTile[];
  units: SimUnit[];
  /** 전투 시간(초) */
  t: number;
  /** 지휘력 */
  cp: number;
  smokes: Array<{ x: number; z: number; r: number; end: number }>;
  fx: SimFx[];
  logs: SimLog[];
  started: boolean;
  over: { win: boolean; timeout: boolean; t: number } | null;
  start(): void;
  step(): void;
  canCommand(k: CmdKind, x: number, z: number): boolean;
  command(k: CmdKind, x: number, z: number): boolean;
  /** 실제 전투 시간에 맞춰 여러 번 계산(화면 루프에서 부름). 끝나면 멈춤 */
  advance(dt: number): void;
}

const SURF: Dom[] = ['land', 'sea'];

export function angDiff(b: number, a: number) {
  return (((b - a + Math.PI) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
}

/** 칸이 그 병과를 받을 수 있는지(공군은 어디든, 잠수함은 바다 칸) */
export function tileOk(t: DeployTile, kind: UnitKind) {
  const dm = unitDef(kind).dom;
  return dm === 'air' || (dm === 'sub' ? 'sea' : dm) === t.dom;
}

/** 기본 배치: 가까운 빈 칸에 예산 안에서 차례로 놓음 */
export function defaultPicks(field: FieldConfig, tiles = deployTiles(field)): DeployPick[] {
  const out: DeployPick[] = [];
  let spent = 0;
  for (const [kind, x, z] of field.defaultDeploy) {
    let best = -1,
      bd = 1e9;
    tiles.forEach((t, i) => {
      if (!tileOk(t, kind) || out.some((d) => d.tile === i)) return;
      const q = Math.hypot(t.x - x, t.z - z);
      if (q < bd) {
        bd = q;
        best = i;
      }
    });
    const c = unitDef(kind).cost;
    if (best < 0 || spent + c > field.budget) continue;
    spent += c;
    out.push({ kind, tile: best });
  }
  return out;
}

export const picksCost = (p: DeployPick[]) => p.reduce((s, d) => s + unitDef(d.kind).cost, 0);

/** 전투 만들기: 적 → 우리 배치 순서로 유닛을 만듦(순서가 결과에 영향) */
export function createSim(field: FieldConfig, picks: DeployPick[]): Sim {
  const F = field.bounds;
  const tiles = deployTiles(field);
  let seed = 7;
  const rnd = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  let nid = 1;
  let pending: Array<{ at: number; fn: () => void }> = [];
  let acc = 0;

  const S: Sim = {
    field,
    tiles,
    units: [],
    t: 0,
    cp: CP_START,
    smokes: [],
    fx: [],
    logs: [],
    started: false,
    over: null,
    start,
    step,
    canCommand,
    command,
    advance,
  };
  const units = () => S.units;
  const log = (msg: string, cls: SimLog['cls']) => S.logs.push({ t: S.t, msg, cls });
  const coastX = field.coastX;
  const riverZ = field.riverZ;

  function makeUnit(kind: UnitKind, side: Side, x: number, z: number): SimUnit {
    const d = unitDef(kind);
    const u: SimUnit = { id: nid++, kind, side, d, hp: d.hp, max: d.hp, x, z, cd: rnd() * Math.min(d.cd, 3), cd2: 4 + rnd() * 3, spawnCd: 6 + rnd() * 4, tgt: null, alive: true, jam: 0, kids: 0, hd: side === 'us' ? Math.PI : 0 };
    if (d.missile) u.launchAt = 1.5 + rnd() * 1.5;
    S.units.push(u);
    return u;
  }
  const dist = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.hypot(a.x - b.x, a.z - b.z);
  const hitMul = (u: SimUnit, t: SimUnit) => u.d.hits[t.d.dom] || 0;
  const inSmoke = (u: SimUnit) => S.smokes.some((s) => Math.hypot(s.x - u.x, s.z - u.z) < s.r);

  function damage(t: SimUnit, amt: number, src: SimUnit | null) {
    if (!t.alive) return;
    let a = ((amt * 100) / (100 + t.d.def)) * (src && src.side === 'foe' ? field.foeMul : 1);
    if (inSmoke(t)) a *= 0.4;
    if (units().some((o) => o.alive && o.d.aura && o.side === t.side && o !== t && dist(o, t) < 2.4)) a *= 0.7; // 레이저 방공함 보호막
    t.hp -= a;
    t.hitT = S.t;
    if (t.hp <= 0) {
      t.hp = 0;
      t.alive = false;
      onDeath(t);
    }
  }
  function splash(x: number, z: number, r: number, amt: number, side: Side | null, src: SimUnit | null, doms?: Dom[]) {
    units().forEach((t) => {
      if (!t.alive || (side && t.side === side)) return;
      if (doms && !doms.includes(t.d.dom)) return;
      const dd = Math.hypot(t.x - x, t.z - z);
      if (dd < r) damage(t, amt * (1 - (dd / r) * 0.5), src);
    });
  }
  function onDeath(t: SimUnit) {
    S.fx.push({ at: S.t, type: 'death', unit: t });
    if (!(t.d.missile || t.d.kamikaze)) {
      const who = (t.side === 'us' ? '아군 ' : '적 ') + t.d.name;
      log(t.side === 'us' ? `${who} 손실` : `${who} 격파`, t.side === 'us' ? 'x' : 'k');
    }
  }
  function goalFor(u: SimUnit) {
    const g = field.goals[u.side];
    const seaZ = g.seaZ;
    // 칠 대상이 없을 때 향할 곳
    if (u.d.dom === 'sea' || u.d.dom === 'sub') return { x: Math.min(u.x, coastX(seaZ) - 1.5), z: seaZ };
    return g.land;
  }
  function clampDomain(u: SimUnit) {
    u.x = Math.max(F.xMin + 0.4, Math.min(F.xMax - 0.4, u.x));
    u.z = Math.max(F.zTop + 0.3, Math.min(F.zBot - 0.3, u.z));
    if (u.d.dom === 'land') {
      const m = coastX(u.z) + 0.35;
      if (u.x < m) u.x = m;
    } else if (u.d.dom === 'sea' || u.d.dom === 'sub') {
      const m = coastX(u.z) - (u.d.r * 0.55 + 0.35);
      if (u.x > m) u.x = m;
    }
  }

  // 유닛 만들기(적 위치는 바다/땅 경계 안쪽으로 맞춤)
  for (const [k, x0, z] of field.enemy) {
    const d = unitDef(k);
    let x = x0;
    if (d.dom === 'sea' || d.dom === 'sub') x = Math.min(x, coastX(z) - d.r * 0.55 - 0.5);
    if (d.dom === 'land') x = Math.max(x, coastX(z) + 0.6);
    makeUnit(k, 'foe', x, z);
  }
  for (const p of picks) {
    const t = tiles[p.tile];
    if (t) makeUnit(p.kind, 'us', t.x, t.z);
  }

  function start() {
    if (S.started) return;
    S.started = true;
    seed = 11;
    S.t = 0;
    acc = 0;
    log('작전 개시 · 육해공 동시 진격', 'c');
  }

  function endBattle(win: boolean, timeout = false) {
    if (S.over) return;
    S.over = { win, timeout, t: S.t };
  }

  function step() {
    if (!S.started || S.over) return;
    S.t += TICK;
    const simT = S.t;
    S.cp = Math.min(CP_MAX, S.cp + TICK * CP_RATE);
    for (let i = pending.length - 1; i >= 0; i--) {
      const e = pending[i];
      if (S.t >= e.at) {
        pending.splice(i, 1);
        e.fn();
      }
    }
    for (let i = S.smokes.length - 1; i >= 0; i--) if (S.t > S.smokes[i].end) S.smokes.splice(i, 1);
    const list = units().slice();
    for (const u of list) {
      if (!u.alive || u.kind === 'hq') continue;
      if (u.waitT && simT < u.waitT) continue;
      const jam = u.jam > simT;
      // 목표 고르기(1초마다)
      if (!u.tgt || !u.tgt.alive || ((simT * 20) | 0) % 20 === u.id % 20) {
        let best: SimUnit | null = null,
          bd = 1e9;
        for (const t of units()) {
          if (!t.alive || t.side === u.side) continue;
          if (!hitMul(u, t)) continue;
          let dd = dist(u, t);
          if (t.kind === 'hq') dd += 6;
          if (t.d.stealth) dd += 3;
          if (u.kind === 'spg' && dd < u.d.minR!) dd += 20;
          if (u.kind === 'aa' && t.d.dom === 'air') dd -= 4;
          if (u.d.aura && t.d.missile) dd -= 8;
          if (u.d.missile) dd = -t.max + dd * 20;
          if (dd < bd) {
            bd = dd;
            best = t;
          }
        }
        u.tgt = best;
      }
      const t = u.tgt;
      // 특수 행동: 항모 함재기 · 상륙함 · 원자력 잠수함 순항 미사일
      if (u.d.carrier) {
        u.spawnCd -= TICK;
        if (u.spawnCd <= 0) {
          u.spawnCd = 20;
          if (u.kids < 2) {
            const j = makeUnit('cvjet', u.side, u.x, u.z);
            j.mom = u;
            u.kids++;
            log(`${u.side === 'us' ? '아군' : '적'} 함재기 출격`, u.side === 'us' ? 'k' : 'x');
          }
        }
      }
      if (u.d.lha) {
        u.spawnCd -= TICK;
        if (u.spawnCd <= 0) {
          const lx = coastX(u.z) + 0.7;
          if (lx - u.x < 3.2 && u.kids < 3) {
            u.spawnCd = 16;
            u.kids++;
            const s = makeUnit('inf', u.side, lx, u.z);
            s.waitT = simT + 1.2;
            S.fx.push({ at: simT, type: 'landing', ship: u, unit: s });
            log(`${u.side === 'us' ? '아군' : '적'} 상륙 부대 해안 도착`, u.side === 'us' ? 'k' : 'x');
          } else u.spawnCd = 2;
        }
      }
      if (u.d.cruise) {
        u.cd2 -= TICK;
        if (u.cd2 <= 0 && !jam) {
          let lt: SimUnit | null = null,
            ld = 11;
          for (const o of units()) {
            if (o.alive && o.side !== u.side && o.d.dom === 'land') {
              const q = dist(u, o) + (o.kind === 'hq' ? -3 : 0);
              if (q < ld) {
                ld = q;
                lt = o;
              }
            }
          }
          if (lt) {
            u.cd2 = 9;
            const tx = lt.x,
              tz = lt.z;
            pending.push({ at: simT + 1.6, fn: () => splash(tx, tz, 1.1, 90, u.side, u, SURF) });
            u.visCruise = { x: tx, z: tz };
          } else u.cd2 = 1;
        }
      }
      let gx: number, gz: number;
      if (t) {
        gx = t.x;
        gz = t.z;
      } else {
        const g = goalFor(u);
        gx = g.x;
        gz = g.z;
      }
      const dd = Math.hypot(gx - u.x, gz - u.z);
      const want = Math.atan2(gx - u.x, gz - u.z);
      u.aim = want;
      const sp = u.d.spd * (jam ? 0.5 : 1);
      // 미사일: 발사대에서 기다렸다가 곧장 날아감
      if (u.d.missile) {
        if (simT < u.launchAt!) continue;
        u.flying = true;
        u.hd = want;
        u.x += Math.sin(want) * sp * TICK;
        u.z += Math.cos(want) * sp * TICK;
        u.moving = true;
        if (t && dd < u.d.range) {
          splash(u.x, u.z, u.d.splash!, u.d.atk, u.side, u, SURF);
          u.hp = 0;
          u.alive = false;
          onDeath(u);
        }
        continue;
      }
      if (u.d.kamikaze) {
        if (!t) {
          u.moving = false;
          continue;
        }
        u.x += Math.sin(want) * sp * TICK;
        u.z += Math.cos(want) * sp * TICK;
        u.moving = true;
        u.moveFace = want;
        if (dd < u.d.range) {
          splash(u.x, u.z, u.d.splash!, u.d.atk, u.side, u, SURF);
          u.hp = 0;
          u.alive = false;
          onDeath(u);
        }
        continue;
      }
      if (u.d.jet) {
        let ta = want;
        if (u.x < F.xMin + 1.6 || u.x > F.xMax - 1.6 || u.z < F.zTop + 1.4 || u.z > F.zBot - 1.6) ta = Math.atan2(field.airCenter.x - u.x, field.airCenter.z - u.z);
        else if (dd < 1.2 && !u.d.bomber) ta = u.hd;
        const diff = angDiff(ta, u.hd),
          mt = (u.d.bomber ? 1.3 : 2.1) * TICK;
        u.hd += Math.max(-mt, Math.min(mt, diff));
        u.bank = Math.max(-1, Math.min(1, diff * 1.6));
        u.x += Math.sin(u.hd) * sp * TICK;
        u.z += Math.cos(u.hd) * sp * TICK;
        u.x = Math.max(F.xMin - 1, Math.min(F.xMax + 1, u.x));
        u.z = Math.max(F.zTop - 1, Math.min(F.zBot + 1, u.z));
        u.moving = true;
        u.moveFace = u.hd;
        u.cd -= TICK;
        if (t && !jam && dd <= u.d.range && (u.d.bomber || Math.abs(angDiff(want, u.hd)) < 0.5) && u.cd <= 0) {
          u.cd = u.d.cd * (0.9 + rnd() * 0.2);
          fire(u, t);
        }
        continue;
      }
      const reach = t ? u.d.range * 0.92 : 0.4;
      if (dd > reach) {
        let vx = Math.sin(want),
          vz = Math.cos(want);
        const grp = u.d.dom === 'air' ? 'air' : u.d.dom === 'land' ? 'land' : 'sea';
        for (const o of units()) {
          if (o === u || !o.alive || o.d.jet || o.d.missile) continue;
          const og = o.d.dom === 'air' ? 'air' : o.d.dom === 'land' ? 'land' : 'sea';
          if (og !== grp) continue;
          const ox = u.x - o.x,
            oz = u.z - o.z,
            od = Math.hypot(ox, oz),
            R = (u.d.r + o.d.r) * 0.95;
          if (od < R && od > 0.001) {
            vx += (ox / od) * (R - od) * 1.6;
            vz += (oz / od) * (R - od) * 1.6;
          }
        }
        const L = Math.hypot(vx, vz) || 1;
        let s2 = sp;
        if (riverZ && u.d.dom === 'land' && Math.abs(u.z - riverZ(u.x)) < 0.9 && !field.bridges.some((bx) => Math.abs(u.x - bx) < 0.7)) s2 *= 0.45;
        // 바다 쪽 유닛은 해안에 막히면 해안을 따라 미끄러짐
        u.x += (vx / L) * s2 * TICK;
        u.z += (vz / L) * s2 * TICK;
        clampDomain(u);
        u.moveFace = Math.atan2(vx, vz);
        u.moving = true;
      } else u.moving = false;
      u.cd -= TICK;
      if (t && !jam && dd <= u.d.range && u.cd <= 0) {
        u.cd = u.d.cd * (0.9 + rnd() * 0.2);
        fire(u, t);
      }
    }
    const hq = units().find((u) => u.kind === 'hq');
    const usLeft = units().some((u) => u.alive && u.side === 'us' && !u.d.missile);
    if (hq && !hq.alive) endBattle(true);
    else if (!usLeft && !pending.length) endBattle(false);
    else if (S.t >= field.timeLimit) endBattle(false, true);
  }

  function fire(u: SimUnit, t: SimUnit) {
    const simT = S.t;
    const mul = hitMul(u, t);
    if (u.kind === 'spg') {
      const tx = t.x + (rnd() - 0.5) * 0.9,
        tz = t.z + (rnd() - 0.5) * 0.9;
      const fly = 1.4 + dist(u, t) * 0.08;
      u.visFire = { kind: 'spg', x: tx, z: tz, ground: true, fly };
      pending.push({
        at: simT + fly,
        fn: () => {
          splash(tx, tz, u.d.splash!, u.d.atk * mul, u.side, u, SURF);
          S.fx.push({ at: S.t, type: 'boom', x: tx, z: tz, size: 1.35 });
        },
      });
      return;
    }
    if (u.d.bomber) {
      const tx = t.x,
        tz = t.z;
      for (let i = 0; i < 4; i++) {
        const bx = tx + (i - 1.5) * 0.45 * Math.sin(u.hd + Math.PI / 2),
          bz = tz + (i - 1.5) * 0.45 * Math.cos(u.hd + Math.PI / 2);
        pending.push({ at: simT + 0.7 + i * 0.12, fn: () => splash(bx, bz, u.d.splash! * 0.6, u.d.atk * 0.4, u.side, u, SURF) });
      }
      u.visFire = { kind: 'bomber', x: tx, z: tz, ground: true };
      return;
    }
    if (u.d.hack) {
      t.jam = simT + 3;
      pending.push({ at: simT + 0.1, fn: () => t.alive && damage(t, u.d.atk * mul, u) });
      u.visFire = { kind: 'hack', x: t.x, z: t.z, tgt: t };
      return;
    }
    const delay = u.kind === 'tank' ? 0.12 : u.kind === 'sub' || u.kind === 'ssn' ? Math.min(2, dist(u, t) * 0.25) : u.kind === 'heli' ? 0.35 : 0.05;
    pending.push({ at: simT + delay, fn: () => t.alive && damage(t, u.d.atk * mul, u) });
    u.visFire = { kind: u.kind, x: t.x, z: t.z, tgt: t, air: t.d.dom === 'air', fly: delay };
  }

  function canCommand(k: CmdKind, x: number, z: number) {
    if (!S.started || S.over || S.cp < CMD[k].cost) return false;
    if (k === 'para' && isSea(field, x, z, -0.3)) return false;
    return true;
  }

  /** 명령 스킬(같은 시각 · 같은 좌표면 같은 결과) */
  function command(k: CmdKind, x: number, z: number) {
    if (!canCommand(k, x, z)) return false;
    const c = CMD[k];
    const simT = S.t;
    S.cp -= c.cost;
    log(`${c.name} 명령 · 좌표 ${gridRef(field, x, z)}`, 'c');
    if (k === 'arty') {
      for (let i = 0; i < 8; i++) {
        const a = rnd() * Math.PI * 2,
          r = Math.sqrt(rnd()) * c.r,
          tx = x + Math.cos(a) * r,
          tz = z + Math.sin(a) * r,
          at = simT + 1.1 + i * 0.2;
        pending.push({ at, fn: () => splash(tx, tz, 1.1, 62, 'us', null, SURF) });
        S.fx.push({ at: at - 1.1, type: 'artyShell', x: tx, z: tz });
      }
    } else if (k === 'smoke') {
      S.smokes.push({ x, z, r: c.r, end: simT + 9 });
      S.fx.push({ at: simT, type: 'smoke', x, z, r: c.r });
    } else if (k === 'air') {
      for (let i = 0; i < 5; i++) {
        const tx = x - 2 + i,
          tz = z;
        pending.push({ at: simT + 1.6 + i * 0.12, fn: () => splash(tx, tz, c.r, 120, 'us', null, ['land', 'sea', 'air']) });
      }
      S.fx.push({ at: simT, type: 'airstrike', x, z });
    } else if (k === 'cruise') {
      pending.push({ at: simT + 2.2, fn: () => splash(x, z, c.r, 300, 'us', null, SURF) });
      S.fx.push({ at: simT, type: 'cruise', x, z });
    } else if (k === 'emp') {
      pending.push({
        at: simT + 0.3,
        fn: () =>
          units().forEach((t) => {
            if (t.alive && t.side === 'foe' && Math.hypot(t.x - x, t.z - z) < c.r) {
              t.jam = S.t + 6;
              damage(t, 20, null);
            }
          }),
      });
      S.fx.push({ at: simT, type: 'emp', x, z, r: c.r });
    } else if (k === 'repair') {
      units().forEach((t) => {
        if (t.alive && t.side === 'us' && Math.hypot(t.x - x, t.z - z) < c.r) {
          t.hp = Math.min(t.max, t.hp + t.max * 0.35);
          t.healT = simT;
        }
      });
      S.fx.push({ at: simT, type: 'repair', x, z, r: c.r });
    } else if (k === 'para') {
      const pts = [
        [x - 0.4, z],
        [x + 0.4, z + 0.1],
      ].filter(([px, pz]) => !isSea(field, px, pz, -0.3));
      pts.forEach(([px, pz], i) => {
        pending.push({
          at: simT + 2.6 + i * 0.3,
          fn: () => {
            const s = makeUnit('inf', 'us', px, pz);
            s.waitT = S.t + 0.6;
          },
        });
      });
      S.fx.push({ at: simT, type: 'para', x, z });
    }
    return true;
  }

  function advance(dt: number) {
    if (!S.started || S.over) return;
    acc += dt;
    while (acc >= TICK) {
      acc -= TICK;
      step();
      if (S.over) break;
    }
  }

  return S;
}

/** 계산만 끝까지(자동전투 · 즉시완료 · 시험) */
export function runToEnd(sim: Sim, maxSteps = 20000) {
  sim.start();
  for (let i = 0; i < maxSteps && !sim.over; i++) sim.step();
  return sim.over;
}

/** 지도 좌표 → 격자 이름(A01 같은) */
export function gridRef(f: FieldConfig, x: number, z: number) {
  return String.fromCharCode(65 + Math.max(0, Math.min(7, Math.floor((x - f.bounds.xMin) / 2.5)))) + String(Math.max(1, Math.floor((z - f.bounds.zTop) / 2.4) + 1)).padStart(2, '0');
}
/** 전투 시간 → T+00:00 */
export function fmtTime(t: number) {
  const s = Math.floor(t);
  return 'T+' + String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
}
