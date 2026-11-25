// 미니게임 퍼즐 만들기(화면 없이 계산만). 모두 "풀 수 있는 판"만 만든다(battle/minigames.test.ts 에서 확인).
import { Rng } from '../game/rng';

export const D4 = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
] as const;

/* ── 전술: 몇 수 제압 퍼즐(곧게 미끄러지는 말) ── */
export interface SlidePuzzle {
  cols: number;
  rows: number;
  wall: boolean[];
  units: number[];
  enemies: number[];
  moves: number;
}
/** 말이 dir로 미끄러져 멈추는 칸(적에 닿으면 그 적 칸, 아니면 막히기 전 칸). 못 가면 -1 */
export function slideEnd(p: { cols: number; rows: number; wall: boolean[] }, units: number[], enemies: number[], from: number, dir: number): number {
  const [dx, dy] = D4[dir];
  let c = from % p.cols;
  let r = Math.floor(from / p.cols);
  let last = -1;
  for (;;) {
    c += dx;
    r += dy;
    if (c < 0 || r < 0 || c >= p.cols || r >= p.rows) return last;
    const i = r * p.cols + c;
    if (p.wall[i] || units.includes(i)) return last;
    if (enemies.includes(i)) return i;
    last = i;
  }
}
export function makeSlidePuzzle(rng: Rng, moves: number, cols = 5, rows = 6): SlidePuzzle {
  for (let tries = 0; tries < 500; tries++) {
    const n = cols * rows;
    const wall = Array.from({ length: n }, () => rng.chance(0.12));
    const units: number[] = [];
    while (units.length < 2) {
      const i = Math.floor(rng.next() * n);
      if (!wall[i] && !units.includes(i)) units.push(i);
    }
    const start = [...units];
    const cur = [...units];
    const enemies: number[] = [];
    const forbid = new Set<number>(units);
    let ok = true;
    for (let m = 0; m < moves && ok; m++) {
      let placed = false;
      for (let k = 0; k < 30 && !placed; k++) {
        const u = Math.floor(rng.next() * cur.length);
        const dir = Math.floor(rng.next() * 4);
        const [dx, dy] = D4[dir];
        // 앞으로 비어 있는 칸들
        const free: number[] = [];
        let c = cur[u] % cols;
        let r = Math.floor(cur[u] / cols);
        for (;;) {
          c += dx;
          r += dy;
          if (c < 0 || r < 0 || c >= cols || r >= rows) break;
          const i = r * cols + c;
          if (wall[i] || cur.includes(i) || enemies.includes(i)) break;
          free.push(i);
        }
        const cand = free.filter((i) => !forbid.has(i));
        if (!cand.length) continue;
        const pickIdx = Math.floor(rng.next() * cand.length);
        const target = cand[pickIdx];
        // 지나간 칸은 나중 적이 놓이면 안 됨
        for (const i of free) {
          forbid.add(i);
          if (i === target) break;
        }
        enemies.push(target);
        cur[u] = target;
        placed = true;
      }
      if (!placed) ok = false;
    }
    if (!ok) continue;
    // 처음부터 한 수에 다 잡히는 쉬운 판은 버림(적끼리 너무 가까우면)
    return { cols, rows, wall, units: start, enemies, moves };
  }
  // 거의 일어나지 않음: 아주 쉬운 판
  const wall = new Array(cols * rows).fill(false);
  return { cols, rows, wall, units: [0, cols - 1], enemies: [cols * (rows - 1)], moves: 1 };
}
/** 정해진 수 안에 풀리는지(깊이 우선 탐색) */
export function solvable(p: SlidePuzzle): boolean {
  const go = (units: number[], enemies: number[], left: number): boolean => {
    if (!enemies.length) return true;
    if (left <= 0) return false;
    for (let u = 0; u < units.length; u++)
      for (let d = 0; d < 4; d++) {
        const e = slideEnd(p, units, enemies, units[u], d);
        if (e < 0) continue;
        const nu = [...units];
        nu[u] = e;
        if (go(nu, enemies.filter((x) => x !== e), left - 1)) return true;
      }
    return false;
  };
  return go(p.units, p.enemies, p.moves);
}

/* ── 보급: 수송로 잇기(칸 돌리기) ── */
// 칸 모양: 연결 방향 비트(위1 오른2 아래4 왼8)
export const rot = (m: number, k: number) => {
  let x = m;
  for (let i = 0; i < ((k % 4) + 4) % 4; i++) x = ((x << 1) | (x >> 3)) & 15;
  return x;
};
export interface PipePuzzle {
  cols: number;
  rows: number;
  /** 정답 모양 */
  shape: number[];
  /** 처음 돌림(0~3) */
  turn: number[];
  inRow: number;
  outRow: number;
}
export function makePipePuzzle(rng: Rng, cols = 5, rows = 5): PipePuzzle {
  const n = cols * rows;
  // 왼쪽 inRow 에서 오른쪽 outRow 까지 무작위 길(자기 자신과 겹치지 않음)
  for (;;) {
    const inRow = Math.floor(rng.next() * rows);
    const path: number[] = [inRow * cols];
    const seen = new Set(path);
    let ok = false;
    for (let step = 0; step < 60; step++) {
      const a = path[path.length - 1];
      const c = a % cols;
      const r = Math.floor(a / cols);
      if (c === cols - 1 && rng.chance(0.5)) {
        ok = true;
        break;
      }
      const opts = D4.map(([dx, dy], d) => ({ d, c: c + dx, r: r + dy })).filter((o) => o.c >= 0 && o.r >= 0 && o.c < cols && o.r < rows && !seen.has(o.r * cols + o.c) && o.d !== 3);
      if (!opts.length) break;
      const o = rng.pick(opts);
      const i = o.r * cols + o.c;
      path.push(i);
      seen.add(i);
    }
    if (!ok || path.length < cols + 1) continue;
    const shape = new Array(n).fill(0);
    const dirTo = (a: number, b: number) => {
      const dc = (b % cols) - (a % cols);
      const dr = Math.floor(b / cols) - Math.floor(a / cols);
      return dr === -1 ? 1 : dc === 1 ? 2 : dr === 1 ? 4 : 8;
    };
    const opp = (b: number) => ({ 1: 4, 2: 8, 4: 1, 8: 2 })[b]!;
    shape[path[0]] |= 8; // 기지에서 들어옴
    for (let k = 0; k < path.length - 1; k++) {
      const b = dirTo(path[k], path[k + 1]);
      shape[path[k]] |= b;
      shape[path[k + 1]] |= opp(b);
    }
    shape[path[path.length - 1]] |= 2; // 전선으로 나감
    const outRow = Math.floor(path[path.length - 1] / cols);
    // 길이 아닌 칸은 아무 모양(곧은길·굽은길·세 갈래)
    const pieces = [5, 3, 7];
    for (let i = 0; i < n; i++) if (!shape[i]) shape[i] = rot(rng.pick(pieces), Math.floor(rng.next() * 4));
    const turn = shape.map(() => Math.floor(rng.next() * 4));
    return { cols, rows, shape, turn, inRow, outRow };
  }
}
/** 지금 돌림으로 기지→전선이 이어졌는지 */
export function pipeConnected(p: PipePuzzle, turn: number[]): boolean {
  const m = (i: number) => rot(p.shape[i], turn[i]);
  const start = p.inRow * p.cols;
  if (!(m(start) & 8)) return false;
  const seen = new Set([start]);
  const q = [start];
  while (q.length) {
    const a = q.shift()!;
    const c = a % p.cols;
    const r = Math.floor(a / p.cols);
    if (c === p.cols - 1 && r === p.outRow && m(a) & 2) return true;
    const ma = m(a);
    const steps: Array<[number, number, number, number]> = [
      [1, 0, -1, 4],
      [2, 1, 0, 8],
      [4, 0, 1, 1],
      [8, -1, 0, 2],
    ];
    for (const [bit, dx, dy, back] of steps) {
      if (!(ma & bit)) continue;
      const nc = c + dx;
      const nr = r + dy;
      if (nc < 0 || nr < 0 || nc >= p.cols || nr >= p.rows) continue;
      const b = nr * p.cols + nc;
      if (seen.has(b) || !(m(b) & back)) continue;
      seen.add(b);
      q.push(b);
    }
  }
  return false;
}

/* ── 해킹: 회로 잇기(겹치지 않는 선) ── */
export interface FlowPuzzle {
  size: number;
  /** 색마다 [시작, 끝] */
  pairs: Array<[number, number]>;
  /** 정답 길(확인용) */
  paths: number[][];
}
export function makeFlowPuzzle(rng: Rng, size: number, colors: number): FlowPuzzle {
  for (let tries = 0; tries < 400; tries++) {
    const used = new Set<number>();
    const paths: number[][] = [];
    for (let k = 0; k < colors; k++) {
      let made: number[] | null = null;
      for (let t = 0; t < 40 && !made; t++) {
        const s = Math.floor(rng.next() * size * size);
        if (used.has(s)) continue;
        const path = [s];
        const mine = new Set([s]);
        const want = 3 + Math.floor(rng.next() * (size + 1));
        while (path.length < want) {
          const a = path[path.length - 1];
          const c = a % size;
          const r = Math.floor(a / size);
          const opts = D4.map(([dx, dy]) => ({ c: c + dx, r: r + dy }))
            .filter((o) => o.c >= 0 && o.r >= 0 && o.c < size && o.r < size)
            .map((o) => o.r * size + o.c)
            .filter((i) => !used.has(i) && !mine.has(i));
          if (!opts.length) break;
          const i = rng.pick(opts);
          path.push(i);
          mine.add(i);
        }
        if (path.length >= 3) made = path;
      }
      if (!made) break;
      for (const i of made) used.add(i);
      paths.push(made);
    }
    if (paths.length === colors) return { size, pairs: paths.map((p) => [p[0], p[p.length - 1]]), paths };
  }
  return { size, pairs: [[0, size - 1]], paths: [Array.from({ length: size }, (_, i) => i)] };
}

/* ── 보급: 트럭 짐 싣기(짐칸을 조각으로 나눠 상자를 만듦 → 빈틈없이 채울 수 있음) ── */
export type Piece = Array<[number, number]>;
export function makeTruck(rng: Rng, cols: number, rows: number): Piece[] {
  const n = cols * rows;
  const owner = new Array(n).fill(-1);
  const pieces: number[][] = [];
  const order = Array.from({ length: n }, (_, i) => i);
  for (const i of order) {
    if (owner[i] >= 0) continue;
    const id = pieces.length;
    const cells = [i];
    owner[i] = id;
    const want = 2 + Math.floor(rng.next() * 3);
    while (cells.length < want) {
      const opts: number[] = [];
      for (const a of cells) {
        const c = a % cols;
        const r = Math.floor(a / cols);
        for (const [dx, dy] of D4) {
          const nc = c + dx;
          const nr = r + dy;
          if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue;
          const b = nr * cols + nc;
          if (owner[b] < 0) opts.push(b);
        }
      }
      if (!opts.length) break;
      const b = rng.pick(opts);
      owner[b] = id;
      cells.push(b);
    }
    pieces.push(cells);
  }
  // 모양만 남김(왼쪽 위 기준)
  return pieces.map((cells) => {
    const xs = cells.map((a) => a % cols);
    const ys = cells.map((a) => Math.floor(a / cols));
    const x0 = Math.min(...xs);
    const y0 = Math.min(...ys);
    return cells.map((a) => [(a % cols) - x0, Math.floor(a / cols) - y0] as [number, number]);
  });
}
export const rotPiece = (p: Piece): Piece => {
  const r = p.map(([x, y]) => [-y, x] as [number, number]);
  const x0 = Math.min(...r.map((q) => q[0]));
  const y0 = Math.min(...r.map((q) => q[1]));
  return r.map(([x, y]) => [x - x0, y - y0]);
};

/** 격자 거리 길 찾기(막힌 칸 피함). 못 가면 -1 */
export function bfsLen(cols: number, rows: number, from: number, to: number, blocked: (i: number) => boolean): number {
  const dist = new Map([[from, 0]]);
  const q = [from];
  while (q.length) {
    const a = q.shift()!;
    if (a === to) return dist.get(a)!;
    const c = a % cols;
    const r = Math.floor(a / cols);
    for (const [dx, dy] of D4) {
      const nc = c + dx;
      const nr = r + dy;
      if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue;
      const b = nr * cols + nc;
      if (dist.has(b) || (b !== to && blocked(b))) continue;
      dist.set(b, dist.get(a)! + 1);
      q.push(b);
    }
  }
  return -1;
}

/** 해킹: 비밀번호 힌트(● 자리·숫자 맞음, ○ 숫자만 맞음) */
export function codeHint(secret: number[], guess: number[]): { exact: number; near: number } {
  let exact = 0;
  let near = 0;
  guess.forEach((g, i) => {
    if (secret[i] === g) exact++;
    else if (secret.includes(g)) near++;
  });
  return { exact, near };
}

/** 정보: 암호 — 10칸 원판(때 0~2 · 방향 3~6 · 행동 7~9). 뜻이 통하는 돌림이 하나뿐인 전문만 */
export const CIPHER_WORDS = ['새벽', '정오', '한밤', '북쪽', '남쪽', '동쪽', '서쪽', '공격', '후퇴', '집결'];
const catOf = (i: number) => (i <= 2 ? 0 : i <= 6 ? 1 : 2);
export function makeCipher(rng: Rng): { nums: number[]; shift: number } {
  for (;;) {
    const words = [Math.floor(rng.next() * 3), 3 + Math.floor(rng.next() * 4), 7 + Math.floor(rng.next() * 3)];
    const shift = 1 + Math.floor(rng.next() * 9);
    const nums = words.map((w) => (w - shift + 10) % 10);
    const good = Array.from({ length: 10 }, (_, k) => k).filter((k) => nums.every((n, j) => catOf((n + k) % 10) === j));
    if (good.length === 1) return { nums, shift };
  }
}
export const cipherRead = (nums: number[], k: number) => nums.map((n) => CIPHER_WORDS[(n + k) % 10]);
export const cipherOk = (nums: number[], k: number) => nums.every((n, j) => catOf((n + k) % 10) === j);
