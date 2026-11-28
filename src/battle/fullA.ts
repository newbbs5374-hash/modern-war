// 11-28 새 전체 화면 훈련 묶음 A(계산만, 화면은 ui/battle/mini/fullA.tsx).
// 1 부품 짝 맞추기(사천성형, 무인기) · 2 위성 사진 맞추기(조각 퍼즐, 무인기)
// 3 폭격 투하(앵그리버드형 떨어뜨리기, 항공기) · 4 탄도 사격(당겨 쏘기, 미사일) · 5 하늘의 방패(요격, 미사일방공)
import { Rng } from '../game/rng';

export interface Pt { x: number; y: number }

// ───────────────────────── 1 부품 짝 맞추기 ─────────────────────────
// 같은 부품 두 개를 꺾임 2번 이하의 빈 길로 이을 수 있으면 사라짐(판 밖 테두리로 돌아가도 됨).
export const PARTS = ['🔋', '⚙️', '📡', '🛞', '🔩', '🎥', '🛰️', '💡', '🔧', '🧭', '📶', '🪫', '🧲', '🔌', '🪛'];
export interface Pairs { rows: number; cols: number; b: number[][]; left: number; total: number; hints: number; shuffles: number; seed: number; t: number }
export interface Cell { r: number; c: number }

/** 판(테두리 한 칸 비움). 0 = 빈칸, 1~ = 부품 번호 */
export function newPairs(seed: number, level = 1): Pairs {
  const rng = new Rng(seed >>> 0 || 1);
  const rows = level >= 1.4 ? 7 : 6, cols = level >= 1.4 ? 10 : 8;
  const kinds = Math.min(PARTS.length, level >= 1.4 ? 14 : 12);
  const n = rows * cols;
  const bag: number[] = [];
  for (let i = 0; i < n / 2; i++) bag.push((i % kinds) + 1, (i % kinds) + 1);
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    [bag[i], bag[j]] = [bag[j], bag[i]];
  }
  const b = Array.from({ length: rows + 2 }, (_, r) => Array.from({ length: cols + 2 }, (_, c) => (r === 0 || c === 0 || r === rows + 1 || c === cols + 1 ? 0 : bag[(r - 1) * cols + (c - 1)])));
  const p: Pairs = { rows, cols, b, left: n, total: n, hints: 3, shuffles: 0, seed: rng.seed, t: 0 };
  if (!findPair(p)) reshuffle(p);
  return p;
}
const empty = (p: Pairs, r: number, c: number) => r >= 0 && c >= 0 && r < p.rows + 2 && c < p.cols + 2 && p.b[r][c] === 0;
/** 같은 줄·같은 칸 사이가 비었나(양 끝 빼고) */
function line(p: Pairs, a: Cell, z: Cell): boolean {
  if (a.r === z.r) {
    for (let c = Math.min(a.c, z.c) + 1; c < Math.max(a.c, z.c); c++) if (!empty(p, a.r, c)) return false;
    return true;
  }
  if (a.c === z.c) {
    for (let r = Math.min(a.r, z.r) + 1; r < Math.max(a.r, z.r); r++) if (!empty(p, r, a.c)) return false;
    return true;
  }
  return false;
}
/** 두 칸을 이을 길(꺾임 2번까지). 없으면 null */
export function linkPath(p: Pairs, a: Cell, z: Cell): Cell[] | null {
  if (a.r === z.r && a.c === z.c) return null;
  if (!p.b[a.r][a.c] || p.b[a.r][a.c] !== p.b[z.r][z.c]) return null;
  if (line(p, a, z)) return [a, z];
  for (const k of [{ r: a.r, c: z.c }, { r: z.r, c: a.c }]) if (empty(p, k.r, k.c) && line(p, a, k) && line(p, k, z)) return [a, k, z];
  for (let c = 0; c < p.cols + 2; c++) {
    const k1 = { r: a.r, c }, k2 = { r: z.r, c };
    if (c !== a.c && c !== z.c && empty(p, k1.r, k1.c) && empty(p, k2.r, k2.c) && line(p, a, k1) && line(p, k1, k2) && line(p, k2, z)) return [a, k1, k2, z];
  }
  for (let r = 0; r < p.rows + 2; r++) {
    const k1 = { r, c: a.c }, k2 = { r, c: z.c };
    if (r !== a.r && r !== z.r && empty(p, k1.r, k1.c) && empty(p, k2.r, k2.c) && line(p, a, k1) && line(p, k1, k2) && line(p, k2, z)) return [a, k1, k2, z];
  }
  return null;
}
/** 지금 지울 수 있는 짝 하나 */
export function findPair(p: Pairs): [Cell, Cell] | null {
  const cells: Cell[] = [];
  for (let r = 1; r <= p.rows; r++) for (let c = 1; c <= p.cols; c++) if (p.b[r][c]) cells.push({ r, c });
  for (let i = 0; i < cells.length; i++)
    for (let j = i + 1; j < cells.length; j++) if (p.b[cells[i].r][cells[i].c] === p.b[cells[j].r][cells[j].c] && linkPath(p, cells[i], cells[j])) return [cells[i], cells[j]];
  return null;
}
/** 남은 부품 섞기(지울 짝이 생길 때까지) */
export function reshuffle(p: Pairs): void {
  const rng = new Rng(p.seed);
  const cells: Cell[] = [];
  for (let r = 1; r <= p.rows; r++) for (let c = 1; c <= p.cols; c++) if (p.b[r][c]) cells.push({ r, c });
  for (let k = 0; k < 60; k++) {
    const vals = cells.map((x) => p.b[x.r][x.c]);
    for (let i = vals.length - 1; i > 0; i--) {
      const j = Math.floor(rng.next() * (i + 1));
      [vals[i], vals[j]] = [vals[j], vals[i]];
    }
    cells.forEach((x, i) => (p.b[x.r][x.c] = vals[i]));
    if (!cells.length || findPair(p)) break;
  }
  p.seed = rng.seed;
}
/** 두 칸 고르기 → 이으면 지움 */
export function tryPair(p: Pairs, a: Cell, z: Cell): Cell[] | null {
  const path = linkPath(p, a, z);
  if (!path) return null;
  p.b[a.r][a.c] = 0;
  p.b[z.r][z.c] = 0;
  p.left -= 2;
  if (p.left > 0 && !findPair(p)) {
    reshuffle(p);
    p.shuffles++;
  }
  return path;
}
export function pairsScore(p: Pairs, secs: number): number {
  const done = (p.total - p.left) / p.total;
  if (p.left === 0) return Math.min(1, 0.75 + Math.max(0, 1 - p.t / secs) * 0.2 + (p.hints === 3 ? 0.05 : 0));
  return Math.min(0.7, done * 0.7);
}

// ───────────────────────── 2 위성 사진 맞추기 ─────────────────────────
export const JW = 1600, JH = 900;
export const JB = { x: 70, y: 150, w: 960, h: 600 };
export interface Piece { r: number; c: number; x: number; y: number; placed: boolean }
export interface Jigsaw { rows: number; cols: number; pw: number; ph: number; tabR: number[][]; tabB: number[][]; pieces: Piece[]; t: number; seed: number; moves: number }

export function newJigsaw(seed: number, level = 1): Jigsaw {
  const rng = new Rng(seed >>> 0 || 1);
  const cols = level >= 1.4 ? 5 : 4, rows = level >= 1.4 ? 4 : 3;
  const pw = JB.w / cols, ph = JB.h / rows;
  const sgn = () => (rng.next() < 0.5 ? -1 : 1);
  const tabR = Array.from({ length: rows }, () => Array.from({ length: cols }, sgn));
  const tabB = Array.from({ length: rows }, () => Array.from({ length: cols }, sgn));
  const pieces: Piece[] = [];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) pieces.push({ r, c, x: rng.range(JB.x + JB.w + 60, JW - pw - 20), y: rng.range(40, JH - ph - 20), placed: false });
  for (let i = pieces.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    [pieces[i], pieces[j]] = [pieces[j], pieces[i]];
  }
  return { rows, cols, pw, ph, tabR, tabB, pieces, t: 0, seed: rng.seed, moves: 0 };
}
export const pieceHome = (j: Jigsaw, p: Piece): Pt => ({ x: JB.x + p.c * j.pw, y: JB.y + p.r * j.ph });
/** 놓기: 제자리 가까이면 딱 붙음 */
export function dropPiece(j: Jigsaw, i: number, x: number, y: number): boolean {
  const p = j.pieces[i];
  if (p.placed) return false;
  j.moves++;
  const h = pieceHome(j, p);
  p.x = Math.max(0, Math.min(JW - j.pw, x));
  p.y = Math.max(0, Math.min(JH - j.ph, y));
  if (Math.hypot(p.x - h.x, p.y - h.y) < Math.min(j.pw, j.ph) * 0.28) {
    p.x = h.x;
    p.y = h.y;
    p.placed = true;
    return true;
  }
  return false;
}
/** 누른 자리 맨 위 조각(놓인 조각은 못 집음) */
export function pickPiece(j: Jigsaw, x: number, y: number): number {
  for (let i = j.pieces.length - 1; i >= 0; i--) {
    const p = j.pieces[i];
    if (!p.placed && x >= p.x - 6 && x <= p.x + j.pw + 6 && y >= p.y - 6 && y <= p.y + j.ph + 6) return i;
  }
  return -1;
}
export const jigsawDone = (j: Jigsaw) => j.pieces.every((p) => p.placed);
export function jigsawScore(j: Jigsaw, secs: number): number {
  const n = j.pieces.length, done = j.pieces.filter((p) => p.placed).length;
  if (done === n) return Math.min(1, 0.75 + Math.max(0, 1 - j.t / secs) * 0.25);
  return Math.min(0.7, (done / n) * 0.7);
}

// ───────────────────────── 3·4 공통: 블록 진지 ─────────────────────────
export const BS = 40;
export type BlockKind = 'b' | 'w' | 'c' | 'a';
export interface Block { k: BlockKind; hp: number; fall: number }
/** 진지: 칸마다 아래서 위로 쌓인 블록. b 나무 · w 콘크리트 · c 표적(지휘소) · a 대공포 */
export interface Fort { x: number; ground: number; cols: Block[][] }
const blk = (k: BlockKind): Block => ({ k, hp: k === 'w' ? 2 : 1, fall: 0 });

export function makeFort(rng: Rng, x: number, ground: number, ncol: number, aa = false): Fort {
  const cols: Block[][] = [];
  const mid = Math.floor(ncol / 2);
  for (let i = 0; i < ncol; i++) {
    const h = i === 0 || i === ncol - 1 ? Math.floor(rng.range(2, 4)) : Math.floor(rng.range(1, 3));
    const col: Block[] = [];
    for (let k = 0; k < h; k++) col.push(blk(i === 0 || i === ncol - 1 ? 'w' : rng.chance(0.4) ? 'w' : 'b'));
    if (i === mid) col.push(blk('c'));
    else if (aa && i === ncol - 1) col.push(blk('a'));
    else if (rng.chance(0.4)) col.push(blk('b'));
    cols.push(col);
  }
  // 표적 위 지붕
  cols[mid].push(blk('b'));
  return { x, ground, cols };
}
export const blockAt = (f: Fort, i: number, k: number): Pt => ({ x: f.x + i * BS, y: f.ground - (k + 1) * BS });
/** 점이 진지 블록 안인가 */
export function fortHit(f: Fort, x: number, y: number): boolean {
  const i = Math.floor((x - f.x) / BS);
  if (i < 0 || i >= f.cols.length) return false;
  const k = Math.floor((f.ground - y) / BS);
  return k >= 0 && k < f.cols[i].length;
}
/** 폭발: 가까운 블록 부숨(가운데는 2), 남은 블록은 아래로 내려앉음. 부순 표적 수 */
export function blastFort(f: Fort, at: Pt, r: number): { cores: number; aa: number; broke: number } {
  let cores = 0, aa = 0, broke = 0;
  f.cols.forEach((col, i) => {
    col.forEach((b, k) => {
      const p = blockAt(f, i, k);
      const d = Math.hypot(p.x + BS / 2 - at.x, p.y + BS / 2 - at.y);
      if (d < r) b.hp -= d < r * 0.5 ? 2 : 1;
    });
    const keep: Block[] = [];
    col.forEach((b) => {
      if (b.hp > 0) keep.push(b);
      else {
        broke++;
        if (b.k === 'c') cores++;
        if (b.k === 'a') aa++;
      }
    });
    // 내려앉는 거리(그림용): 자기 아래 빠진 블록 수
    let gone = 0;
    col.forEach((b) => {
      if (b.hp <= 0) gone++;
      else b.fall += gone * BS;
    });
    f.cols[i] = keep;
  });
  return { cores, aa, broke };
}
export const coresIn = (f: Fort) => f.cols.reduce((n, c) => n + c.filter((b) => b.k === 'c').length, 0);
export const aaIn = (f: Fort) => f.cols.reduce((n, c) => n + c.filter((b) => b.k === 'a').length, 0);

// ───────────────────────── 3 폭격 투하 ─────────────────────────
// 비행기가 왼쪽에서 오른쪽으로 지나감(한 번에 폭탄 2발). ▲▼ 높이: 낮으면 정확하지만 대공포에 맞음.
export const BW = 2600, BH = 900, BGROUND = 820, BPASSES = 5, BOMB_R = 75, BGRAV = 520;
export interface Bomb { x: number; y: number; vx: number; vy: number }
export interface BombRun { forts: Fort[]; px: number; alt: number; speed: number; pass: number; drops: number; bombs: Bomb[]; hp: number; wind: number; cores: number; total: number; done: boolean; seed: number; t: number; booms: Array<Pt & { t: number }> }

export function newBombRun(seed: number, level = 1): BombRun {
  const rng = new Rng(seed >>> 0 || 1);
  const forts = [700, 1350, 2000].map((x) => makeFort(rng, x + rng.range(-60, 60), BGROUND, 5 + Math.floor(rng.range(0, 2)), true));
  const total = forts.reduce((n, f) => n + coresIn(f), 0);
  return { forts, px: -100, alt: 420, speed: 300 * Math.min(1.4, 0.8 + level * 0.2), pass: 1, drops: 2, bombs: [], hp: 100, wind: Math.round(rng.range(-40, 40) * level), cores: 0, total, done: false, seed: rng.seed, t: 0, booms: [] };
}
export const planeY = (s: BombRun) => BGROUND - s.alt;
export function dropBomb(s: BombRun): boolean {
  if (s.done || s.drops <= 0 || s.px < 0 || s.px > BW) return false;
  s.drops--;
  s.bombs.push({ x: s.px, y: planeY(s) + 16, vx: s.speed * 0.9, vy: 0 });
  return true;
}
/** 대공포 사거리 안이면 피해(낮게 날수록 큼) */
export function flakAt(s: BombRun): number {
  let n = 0;
  for (const f of s.forts) {
    if (!aaIn(f)) continue;
    const ax = f.x + f.cols.length * BS;
    if (Math.abs(ax - s.px) < 320 && s.alt < 460) n += aaIn(f) * (460 - s.alt) / 460;
  }
  return n;
}
export function stepBombRun(s: BombRun, dt: number): void {
  if (s.done) return;
  s.t += dt;
  s.px += s.speed * dt;
  s.hp = Math.max(0, s.hp - flakAt(s) * 45 * dt);
  for (const b of s.bombs) {
    b.vx += s.wind * dt;
    b.vy += BGRAV * dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
  }
  s.bombs = s.bombs.filter((b) => {
    const hitF = s.forts.find((f) => fortHit(f, b.x, b.y));
    if (hitF || b.y >= BGROUND) {
      const at = { x: b.x, y: Math.min(b.y, BGROUND) };
      for (const f of s.forts) s.cores += blastFort(f, at, BOMB_R).cores;
      s.booms.push({ ...at, t: 0 });
      return false;
    }
    return b.x < BW + 300;
  });
  for (const bm of s.booms) bm.t += dt;
  s.booms = s.booms.filter((bm) => bm.t < 1.2);
  if (s.hp <= 0 || s.cores >= s.total) {
    if (!s.bombs.length) s.done = true;
    return;
  }
  if (s.px > BW + 200 && !s.bombs.length) {
    if (s.pass >= BPASSES) s.done = true;
    else {
      s.pass++;
      s.px = -200;
      s.drops = 2;
      const rng = new Rng(s.seed);
      s.wind = Math.round(Math.max(-80, Math.min(80, s.wind + rng.range(-20, 20))));
      s.seed = rng.seed;
    }
  }
}
export function bombScore(s: BombRun): number {
  const k = s.cores / Math.max(1, s.total);
  if (k >= 1) return Math.min(1, 0.7 + (s.hp / 100) * 0.15 + ((BPASSES - s.pass) / BPASSES) * 0.15);
  return Math.min(0.65, k * 0.65);
}

// ───────────────────────── 4 탄도 사격 ─────────────────────────
// 발사대에서 뒤로 끌어 당겼다 놓음(앵그리버드형). 화면을 넘게 높이 날면 카메라가 넓게 줄여 끝까지 보여 줌.
export const MW = 3200, MH = 1200, MGROUND = 1100, MGRAV = 420, MSHOTS = 7, M_R = 85, MPOW = 1250;
export interface Missile { x: number; y: number; vx: number; vy: number; trail: Pt[] }
export interface Ballistic { forts: Fort[]; hill: { x: number; w: number; h: number }; launcher: Pt; shots: number; m: Missile | null; wind: number; cores: number; total: number; done: boolean; seed: number; t: number; booms: Array<Pt & { t: number }>; last: Pt[] }

export function newBallistic(seed: number, level = 1): Ballistic {
  const rng = new Rng(seed >>> 0 || 1);
  const n = level >= 1.4 ? 3 : 2;
  const xs = n === 3 ? [1900, 2350, 2800] : [2100, 2650];
  const forts = xs.map((x) => makeFort(rng, x + rng.range(-50, 50), MGROUND, 5));
  return {
    forts,
    hill: { x: 1100 + rng.range(-100, 100), w: 500, h: 260 + rng.range(0, 120) * level },
    launcher: { x: 220, y: MGROUND - 40 },
    shots: MSHOTS,
    m: null,
    wind: Math.round(rng.range(-30, 30) * level),
    cores: 0,
    total: forts.reduce((s, f) => s + coresIn(f), 0),
    done: false,
    seed: rng.seed,
    t: 0,
    booms: [],
    last: [],
  };
}
/** 산 높이(가운데 언덕, 매끈한 종 모양) */
export function hillAt(s: Ballistic, x: number): number {
  const d = (x - s.hill.x) / (s.hill.w / 2);
  return Math.abs(d) >= 1 ? MGROUND : MGROUND - s.hill.h * (0.5 + 0.5 * Math.cos(d * Math.PI));
}
/** 당긴 만큼(끈 방향 반대로) 속도 */
export function pullVel(dx: number, dy: number, maxPull: number): Pt {
  const len = Math.min(maxPull, Math.hypot(dx, dy));
  if (len < 4) return { x: 0, y: 0 };
  const k = (len / maxPull) * MPOW;
  return { x: (-dx / Math.hypot(dx, dy)) * k, y: (-dy / Math.hypot(dx, dy)) * k };
}
export function launch(s: Ballistic, v: Pt): boolean {
  if (s.done || s.m || s.shots <= 0 || Math.hypot(v.x, v.y) < 80) return false;
  s.shots--;
  s.m = { x: s.launcher.x, y: s.launcher.y, vx: v.x, vy: v.y, trail: [] };
  return true;
}
/** 미리 보기 점(앞부분만) */
export function preview(s: Ballistic, v: Pt, secs = 0.45): Pt[] {
  const out: Pt[] = [];
  let x = s.launcher.x, y = s.launcher.y, vx = v.x, vy = v.y;
  for (let t = 0; t < secs; t += 1 / 30) {
    vx += s.wind / 30;
    vy += MGRAV / 30;
    x += vx / 30;
    y += vy / 30;
    out.push({ x, y });
  }
  return out;
}
export function stepBallistic(s: Ballistic, dt: number): void {
  s.t += dt;
  for (const bm of s.booms) bm.t += dt;
  s.booms = s.booms.filter((bm) => bm.t < 1.2);
  const m = s.m;
  if (!m) return;
  const n = 4;
  for (let i = 0; i < n; i++) {
    const h = dt / n;
    m.vx += s.wind * h;
    m.vy += MGRAV * h;
    m.x += m.vx * h;
    m.y += m.vy * h;
    const hitF = s.forts.find((f) => fortHit(f, m.x, m.y));
    if (hitF || m.y >= hillAt(s, m.x) || m.x < -300 || m.x > MW + 300) {
      if (m.x >= -300 && m.x <= MW + 300) {
        const at = { x: m.x, y: Math.min(m.y, hillAt(s, m.x)) };
        for (const f of s.forts) s.cores += blastFort(f, at, M_R).cores;
        s.booms.push({ ...at, t: 0 });
      }
      s.last = m.trail;
      s.m = null;
      if (s.cores >= s.total || s.shots <= 0) s.done = true;
      else {
        const rng = new Rng(s.seed);
        s.wind = Math.round(Math.max(-60, Math.min(60, s.wind + rng.range(-15, 15))));
        s.seed = rng.seed;
      }
      return;
    }
  }
  m.trail.push({ x: m.x, y: m.y });
}
export function ballisticScore(s: Ballistic): number {
  const k = s.cores / Math.max(1, s.total);
  if (k >= 1) return Math.min(1, 0.7 + (s.shots / MSHOTS) * 0.3);
  return Math.min(0.65, k * 0.65);
}

// ───────────────────────── 5 하늘의 방패 ─────────────────────────
// 위에서 적 미사일이 도시로 떨어짐. 하늘을 누르면 가까운 포대에서 요격탄이 그 자리로 가서 터짐. 터진 불꽃에 닿은 미사일은 떨어짐.
export const SW = 1600, SH = 900, SGROUND = 830, WAVES = 5, AMMO = 12, EX_R = 70;
export interface Incoming { x: number; y: number; sx: number; tx: number; ty: number; v: number; split: boolean; dead: boolean }
export interface Interceptor { x: number; y: number; tx: number; ty: number; done: boolean }
export interface Burst { x: number; y: number; t: number }
export interface Shield {
  cities: Array<{ x: number; alive: boolean }>; bats: Array<{ x: number; ammo: number; alive: boolean }>;
  inc: Incoming[]; ints: Interceptor[]; bursts: Burst[]; wave: number; toSpawn: number; spawnT: number; pause: number; kills: number; done: boolean; seed: number; level: number; t: number;
}
export function newShield(seed: number, level = 1): Shield {
  const rng = new Rng(seed >>> 0 || 1);
  const s: Shield = {
    cities: [260, 420, 580, 1020, 1180, 1340].map((x) => ({ x, alive: true })),
    bats: [90, 800, 1510].map((x) => ({ x, ammo: AMMO, alive: true })),
    inc: [], ints: [], bursts: [], wave: 1, toSpawn: 0, spawnT: 0, pause: 1.5, kills: 0, done: false, seed: rng.seed, level, t: 0,
  };
  s.toSpawn = waveSize(s);
  return s;
}
const waveSize = (s: Shield) => Math.round((7 + s.wave * 3) * Math.min(1.5, s.level));
/** 요격: 탄 남은 가까운 포대에서 쏨 */
export function shoot(s: Shield, x: number, y: number): boolean {
  if (s.done || y > SGROUND - 60) return false;
  const live = s.bats.filter((b) => b.alive && b.ammo > 0).sort((a, b) => Math.abs(a.x - x) - Math.abs(b.x - x));
  const b = live[0];
  if (!b) return false;
  b.ammo--;
  s.ints.push({ x: b.x, y: SGROUND - 30, tx: x, ty: y, done: false });
  return true;
}
function spawn(s: Shield, rng: Rng) {
  const targets = [...s.cities.filter((c) => c.alive).map((c) => c.x), ...s.bats.filter((b) => b.alive).map((b) => b.x)];
  if (!targets.length) return;
  const sx = rng.range(40, SW - 40);
  s.inc.push({ x: sx, y: -10, sx, tx: rng.pick(targets), ty: SGROUND, v: rng.range(45, 75) * (1 + s.wave * 0.12) * Math.min(1.5, s.level), split: s.wave >= 3 && rng.chance(0.25), dead: false });
}
export function stepShield(s: Shield, dt: number): void {
  if (s.done) return;
  s.t += dt;
  const rng = new Rng(s.seed);
  if (s.pause > 0) s.pause -= dt;
  else if (s.toSpawn > 0) {
    s.spawnT -= dt;
    if (s.spawnT <= 0) {
      spawn(s, rng);
      s.toSpawn--;
      s.spawnT = rng.range(0.5, 1.6) / Math.min(1.5, s.level);
    }
  }
  // 요격탄
  for (const it of s.ints) {
    const d = Math.hypot(it.tx - it.x, it.ty - it.y);
    const step = 950 * dt;
    if (d <= step) {
      it.done = true;
      s.bursts.push({ x: it.tx, y: it.ty, t: 0 });
    } else {
      it.x += ((it.tx - it.x) / d) * step;
      it.y += ((it.ty - it.y) / d) * step;
    }
  }
  s.ints = s.ints.filter((i) => !i.done);
  for (const b of s.bursts) b.t += dt;
  s.bursts = s.bursts.filter((b) => b.t < 1);
  // 적 미사일
  const add: Incoming[] = [];
  for (const m of s.inc) {
    const d = Math.hypot(m.tx - m.x, m.ty - m.y);
    m.x += ((m.tx - m.x) / d) * m.v * dt;
    m.y += ((m.ty - m.y) / d) * m.v * dt;
    if (s.bursts.some((b) => Math.hypot(b.x - m.x, b.y - m.y) < burstR(b))) {
      m.dead = true;
      s.kills++;
      continue;
    }
    if (m.split && m.y > SH * 0.35) {
      m.dead = true;
      const targets = [...s.cities.filter((c) => c.alive).map((c) => c.x), ...s.bats.filter((b) => b.alive).map((b) => b.x)];
      for (let k = 0; k < 3 && targets.length; k++) add.push({ x: m.x, y: m.y, sx: m.x, tx: rng.pick(targets), ty: SGROUND, v: m.v * 1.1, split: false, dead: false });
      continue;
    }
    if (m.y >= SGROUND - 4) {
      m.dead = true;
      s.bursts.push({ x: m.x, y: SGROUND - 10, t: 0.5 });
      for (const c of s.cities) if (Math.abs(c.x - m.x) < 50) c.alive = false;
      for (const b of s.bats) if (Math.abs(b.x - m.x) < 40) { b.alive = false; b.ammo = 0; }
    }
  }
  s.inc = s.inc.filter((m) => !m.dead).concat(add);
  s.seed = rng.seed;
  if (!s.cities.some((c) => c.alive)) {
    s.done = true;
    return;
  }
  if (s.toSpawn <= 0 && !s.inc.length && !s.ints.length && s.pause <= 0) {
    if (s.wave >= WAVES) s.done = true;
    else {
      s.wave++;
      s.toSpawn = waveSize(s);
      s.pause = 2;
      for (const b of s.bats) if (b.alive) b.ammo = AMMO;
    }
  }
}
/** 불꽃 크기(커졌다 작아짐) */
export const burstR = (b: Burst) => EX_R * Math.sin(Math.min(1, b.t) * Math.PI);
export function shieldScore(s: Shield): number {
  const alive = s.cities.filter((c) => c.alive).length / s.cities.length;
  const waves = (s.wave - (s.done && s.wave >= WAVES && alive > 0 ? 0 : 1)) / WAVES;
  return Math.min(1, alive * 0.6 + waves * 0.4);
}
