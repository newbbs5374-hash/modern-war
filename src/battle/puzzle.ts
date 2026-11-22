// 전투 틀 ⑤ 퍼즐·카드 4종: 모병(카드 고르기) · 정보(암호 풀기) · 보급(길 잇기) · 해킹(들키지 않고 서버까지).
// 자동/즉시완료는 같은 풀이기를 써서 결과가 같다.
import { Rng } from '../game/rng';

export type PuzzleKind = '모병' | '정보' | '보급' | '해킹';
export interface PResult {
  win: boolean;
  stars: number;
  text: string;
}
export const PUZZLE_GOAL: Record<PuzzleKind, string> = {
  모병: '예산 안에서 지원자를 최대 4명 뽑아 사격·체력 기준을 채우기',
  정보: '적 암호 4자리(1~6)를 7번 안에 맞히기. ● 자리까지 맞음 · ○ 숫자만 맞음',
  보급: '칸을 눌러 돌려서 왼쪽 창고 🏭에서 오른쪽 전선 🚩까지 길 잇기',
  해킹: '경비 👁️ 옆을 피해 서버 💾까지. 추적 게이지가 100이 되면 들킴',
};

// ── 모병: 카드 고르기 ──

export interface Recruit {
  id: number;
  name: string;
  cost: number;
  shoot: number;
  body: number;
  trait: string;
}
export interface RecruitPuzzle {
  kind: '모병';
  cards: Recruit[];
  picked: number[];
  budget: number;
  needShoot: number;
  needBody: number;
  result: PResult | null;
}
const TRAITS = ['사냥꾼 출신', '운동선수', '정비공', '학생', '어부', '전직 경찰', '농부', '배달원'];
export function createRecruit(seed: number, level: number): RecruitPuzzle {
  const rng = new Rng(seed >>> 0);
  const cards: Recruit[] = [];
  for (let i = 0; i < 7; i++) {
    const shoot = Math.round(rng.range(2, 9));
    const body = Math.round(rng.range(2, 9));
    cards.push({
      id: i,
      name: `지원자 ${String.fromCharCode(65 + i)}`,
      shoot,
      body,
      cost: Math.max(1, Math.round((shoot + body) / 2 + rng.range(-2, 2))),
      trait: rng.pick(TRAITS),
    });
  }
  const best = bestRecruit(cards, 99);
  const budget = Math.round(best.cost * 0.85 + 2);
  const opt = bestRecruit(cards, budget);
  return {
    kind: '모병',
    cards,
    picked: [],
    budget,
    needShoot: Math.max(6, Math.round(opt.shoot * (0.8 + level * 0.05))),
    needBody: Math.max(6, Math.round(opt.body * (0.8 + level * 0.05))),
    result: null,
  };
}
function bestRecruit(cards: Recruit[], budget: number) {
  let best = { ids: [] as number[], cost: 0, shoot: 0, body: 0, score: -1 };
  const n = cards.length;
  for (let m = 1; m < 1 << n; m++) {
    const ids = cards.filter((_, i) => m & (1 << i));
    if (ids.length > 4) continue;
    const cost = ids.reduce((a, c) => a + c.cost, 0);
    if (cost > budget) continue;
    const shoot = ids.reduce((a, c) => a + c.shoot, 0);
    const body = ids.reduce((a, c) => a + c.body, 0);
    const score = Math.min(shoot, body) * 2 + shoot + body - cost * 0.1;
    if (score > best.score) best = { ids: ids.map((c) => c.id), cost, shoot, body, score };
  }
  return best;
}
export function recruitTotals(p: RecruitPuzzle) {
  const sel = p.cards.filter((c) => p.picked.includes(c.id));
  return {
    cost: sel.reduce((a, c) => a + c.cost, 0),
    shoot: sel.reduce((a, c) => a + c.shoot, 0),
    body: sel.reduce((a, c) => a + c.body, 0),
  };
}
export function toggleRecruit(p: RecruitPuzzle, id: number): RecruitPuzzle {
  if (p.result) return p;
  const on = p.picked.includes(id);
  if (!on && p.picked.length >= 4) return p;
  const picked = on ? p.picked.filter((x) => x !== id) : [...p.picked, id];
  const next = { ...p, picked };
  return recruitTotals(next).cost > p.budget ? p : next;
}
export function submitRecruit(p: RecruitPuzzle): RecruitPuzzle {
  if (p.result) return p;
  const t = recruitTotals(p);
  const win = t.shoot >= p.needShoot && t.body >= p.needBody;
  const spare = (t.shoot - p.needShoot + t.body - p.needBody) / (p.needShoot + p.needBody);
  const stars = !win ? 0 : spare >= 0.15 ? 3 : spare >= 0.05 ? 2 : 1;
  return { ...p, result: { win, stars, text: win ? `사격 ${t.shoot} · 체력 ${t.body}, 좋은 분대를 꾸렸어요!` : '기준을 못 채웠어요. 모병 실패.' } };
}
/** 자동: 값이 싼 순서로 욕심껏(최적은 아님) */
function autoRecruit(p: RecruitPuzzle): RecruitPuzzle {
  let q = { ...p, picked: [] as number[] };
  const order = [...p.cards].sort((a, c) => (c.shoot + c.body) / c.cost - (a.shoot + a.body) / a.cost);
  for (const c of order) q = toggleRecruit(q, c.id);
  return submitRecruit(q);
}

// ── 정보: 암호 풀기 ──

export interface CodePuzzle {
  kind: '정보';
  code: number[];
  guesses: Array<{ g: number[]; exact: number; near: number }>;
  max: number;
  result: PResult | null;
}
export function createCode(seed: number): CodePuzzle {
  const rng = new Rng(seed >>> 0);
  return { kind: '정보', code: [0, 1, 2, 3].map(() => 1 + Math.floor(rng.next() * 6)), guesses: [], max: 7, result: null };
}
export function score(code: number[], g: number[]) {
  let exact = 0;
  const a: number[] = [];
  const b: number[] = [];
  code.forEach((c, i) => (c === g[i] ? exact++ : (a.push(c), b.push(g[i]))));
  let near = 0;
  for (const x of b) {
    const k = a.indexOf(x);
    if (k >= 0) {
      near++;
      a.splice(k, 1);
    }
  }
  return { exact, near };
}
export function guessCode(p: CodePuzzle, g: number[]): CodePuzzle {
  if (p.result || g.length !== 4) return p;
  const s = score(p.code, g);
  const guesses = [...p.guesses, { g, ...s }];
  let result: PResult | null = null;
  if (s.exact === 4) {
    const n = guesses.length;
    result = { win: true, stars: n <= 4 ? 3 : n <= 6 ? 2 : 1, text: `${n}번 만에 암호를 풀었어요! 적 통신을 엿들었어요.` };
  } else if (guesses.length >= p.max) result = { win: false, stars: 0, text: `못 풀었어요. 암호는 ${p.code.join('')}였어요.` };
  return { ...p, guesses, result };
}
const ALL_CODES: number[][] = (() => {
  const out: number[][] = [];
  for (let a = 1; a <= 6; a++) for (let b = 1; b <= 6; b++) for (let c = 1; c <= 6; c++) for (let d = 1; d <= 6; d++) out.push([a, b, c, d]);
  return out;
})();
/** 자동: 지금까지 힌트와 맞는 첫 후보를 계속 냄 */
function autoCode(p0: CodePuzzle): CodePuzzle {
  let p = p0;
  while (!p.result) {
    const cand = ALL_CODES.find((c) => p.guesses.every((h) => {
      const s = score(c, h.g);
      return s.exact === h.exact && s.near === h.near;
    }));
    p = guessCode(p, cand ?? [1, 1, 2, 2]);
  }
  return p;
}

// ── 보급: 길 잇기(돌리기) ──
// 칸 연결: 위=1 오른쪽=2 아래=4 왼쪽=8
export interface PipePuzzle {
  kind: '보급';
  w: number;
  h: number;
  cells: number[];
  start: number; // 왼쪽 줄의 y
  end: number; // 오른쪽 줄의 y
  taps: number;
  minTaps: number;
  limit: number;
  result: PResult | null;
}
const rot = (m: number) => ((m << 1) | (m >> 3)) & 15;
export function createPipes(seed: number, size = 5): PipePuzzle {
  const rng = new Rng(seed >>> 0);
  const w = size;
  const h = size;
  // 왼쪽에서 오른쪽으로 가는 무작위 길
  const start = Math.floor(rng.next() * h);
  const cells = Array(w * h).fill(0);
  let x = 0;
  let y = start;
  let from = 8; // 왼쪽에서 들어옴
  const visited = new Set<number>();
  for (let guard = 0; guard < 80; guard++) {
    visited.add(y * w + x);
    let dir: number;
    if (x === w - 1 && rng.chance(0.5)) dir = 2;
    else {
      const opts: number[] = [2, 2];
      if (y > 0 && !visited.has((y - 1) * w + x)) opts.push(1);
      if (y < h - 1 && !visited.has((y + 1) * w + x)) opts.push(4);
      dir = rng.pick(opts);
      if (dir === 2 && x === w - 1) dir = 2;
    }
    cells[y * w + x] = from | dir;
    if (dir === 2 && x === w - 1) break;
    if (dir === 2) x++;
    else if (dir === 1) y--;
    else y++;
    from = dir === 2 ? 8 : dir === 1 ? 4 : 1;
  }
  const end = y;
  // 빈 칸은 아무 조각
  const shapes = [5, 10, 3, 6, 12, 9, 7, 11, 13, 14];
  for (let i = 0; i < cells.length; i++) if (!cells[i]) cells[i] = rng.pick(shapes);
  // 섞기(몇 번 돌렸는지 = 최소 누르기)
  let minTaps = 0;
  const solved = [...cells];
  for (let i = 0; i < cells.length; i++) {
    const k = Math.floor(rng.next() * 4);
    for (let r = 0; r < k; r++) cells[i] = rot(cells[i]);
    if (cells[i] !== solved[i]) {
      // 다시 맞추려면 (4-k)%4번
      minTaps += (4 - k) % 4;
    }
  }
  return { kind: '보급', w, h, cells, start, end, taps: 0, minTaps, limit: minTaps + 14, result: null };
}
/** 창고에서 이어진 칸들(그림에서 불 켜기용) */
export function pipeFlow(p: PipePuzzle): Set<number> {
  const on = new Set<number>();
  const startI = p.start * p.w;
  if (!(p.cells[startI] & 8)) return on;
  const q = [startI];
  on.add(startI);
  while (q.length) {
    const i = q.shift()!;
    const x = i % p.w;
    const y = Math.floor(i / p.w);
    const m = p.cells[i];
    const nb: Array<[number, number, number, number]> = [
      [1, x, y - 1, 4],
      [2, x + 1, y, 8],
      [4, x, y + 1, 1],
      [8, x - 1, y, 2],
    ];
    for (const [bit, nx, ny, back] of nb) {
      if (!(m & bit) || nx < 0 || ny < 0 || nx >= p.w || ny >= p.h) continue;
      const j = ny * p.w + nx;
      if (on.has(j) || !(p.cells[j] & back)) continue;
      on.add(j);
      q.push(j);
    }
  }
  return on;
}
export function pipeDone(p: PipePuzzle) {
  const e = p.end * p.w + p.w - 1;
  return pipeFlow(p).has(e) && !!(p.cells[e] & 2);
}
export function tapPipe(p: PipePuzzle, i: number): PipePuzzle {
  if (p.result) return p;
  const cells = [...p.cells];
  cells[i] = rot(cells[i]);
  const q = { ...p, cells, taps: p.taps + 1 };
  if (pipeDone(q)) {
    const extra = q.taps - p.minTaps;
    q.result = { win: true, stars: extra <= 3 ? 3 : extra <= 8 ? 2 : 1, text: `${q.taps}번 만에 보급선을 이었어요!` };
  } else if (q.taps >= p.limit) q.result = { win: false, stars: 0, text: '누를 수 있는 횟수가 끝났어요. 보급 실패.' };
  return q;
}
/** 자동: 창고에서부터 한 칸씩 길을 찾아 돌림(깊이 우선) */
function autoPipes(p0: PipePuzzle): PipePuzzle {
  // 각 칸을 몇 번 돌릴지 찾기
  const { w, h } = p0;
  const turns = Array(w * h).fill(0);
  const used = new Set<number>();
  const target = p0.end * w + w - 1;
  const dfs = (i: number, inBit: number): boolean => {
    used.add(i);
    for (let r = 0; r < 4; r++) {
      let m = p0.cells[i];
      for (let k = 0; k < r; k++) m = rot(m);
      if (!(m & inBit)) continue;
      turns[i] = r;
      if (i === target && m & 2) return true;
      const x = i % w;
      const y = Math.floor(i / w);
      const next: Array<[number, number, number, number]> = [
        [2, x + 1, y, 8],
        [1, x, y - 1, 4],
        [4, x, y + 1, 1],
      ];
      for (const [bit, nx, ny, back] of next) {
        if (!(m & bit) || nx >= w || ny < 0 || ny >= h) continue;
        const j = ny * w + nx;
        if (used.has(j)) continue;
        if (dfs(j, back)) return true;
      }
    }
    used.delete(i);
    turns[i] = 0;
    return false;
  };
  let p = p0;
  if (dfs(p0.start * w, 8)) {
    for (let i = 0; i < turns.length && !p.result; i++) for (let r = 0; r < turns[i] && !p.result; r++) p = tapPipe(p, i);
  }
  if (!p.result) p = { ...p, result: { win: false, stars: 0, text: '길을 찾지 못했어요. 보급 실패.' } };
  return p;
}

// ── 해킹: 들키지 않고 서버까지 ──

export interface HackPuzzle {
  kind: '해킹';
  w: number;
  h: number;
  /** 0 빈칸 · 1 방화벽(못 지나감) · 2 경비 */
  grid: number[];
  pos: number;
  goal: number;
  trace: number;
  timeLimit: number;
  elapsed: number;
  path: number[];
  result: PResult | null;
}
export const HACK_STEP = 4;
export const HACK_NEAR = 18;
export function createHack(seed: number, level: number): HackPuzzle {
  const rng = new Rng(seed >>> 0);
  const w = 6;
  const h = 7;
  for (let tries = 0; tries < 50; tries++) {
    const grid = Array(w * h).fill(0);
    for (let i = 0; i < grid.length; i++) {
      const r = rng.next();
      grid[i] = r < 0.18 ? 1 : r < 0.18 + 0.08 + level * 0.01 ? 2 : 0;
    }
    const pos = (h - 1) * w + Math.floor(rng.next() * w);
    const goal = Math.floor(rng.next() * w);
    grid[pos] = 0;
    grid[goal] = 0;
    const p: HackPuzzle = { kind: '해킹', w, h, grid, pos, goal, trace: 0, timeLimit: 45_000, elapsed: 0, path: [pos], result: null };
    const best = hackBest(p);
    if (best && best.cost < 70 && best.cost > 20) return p;
  }
  // 실패하면 빈 판
  const grid = Array(w * h).fill(0);
  return { kind: '해킹', w, h, grid, pos: (h - 1) * w, goal: w - 1, trace: 0, timeLimit: 45_000, elapsed: 0, path: [(h - 1) * w], result: null };
}
export function stepCost(p: HackPuzzle, j: number) {
  const x = j % p.w;
  const y = Math.floor(j / p.w);
  let near = 0;
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= p.w || ny >= p.h) continue;
      if (p.grid[ny * p.w + nx] === 2) near++;
    }
  return HACK_STEP + near * HACK_NEAR;
}
function hackNeighbors(p: HackPuzzle, i: number) {
  const x = i % p.w;
  const y = Math.floor(i / p.w);
  const out: number[] = [];
  for (const [dx, dy] of [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ]) {
    const nx = x + dx;
    const ny = y + dy;
    if (nx < 0 || ny < 0 || nx >= p.w || ny >= p.h) continue;
    const j = ny * p.w + nx;
    if (p.grid[j] === 0) out.push(j);
  }
  return out;
}
function hackBest(p: HackPuzzle): { cost: number; path: number[] } | null {
  const dist = new Map<number, number>([[p.pos, 0]]);
  const prev = new Map<number, number>();
  const q = [p.pos];
  while (q.length) {
    q.sort((a, b) => dist.get(a)! - dist.get(b)!);
    const i = q.shift()!;
    for (const j of hackNeighbors(p, i)) {
      const c = dist.get(i)! + stepCost(p, j);
      if (c < (dist.get(j) ?? 1e9)) {
        dist.set(j, c);
        prev.set(j, i);
        q.push(j);
      }
    }
  }
  if (!dist.has(p.goal)) return null;
  const path = [p.goal];
  while (path[0] !== p.pos) path.unshift(prev.get(path[0])!);
  return { cost: dist.get(p.goal)!, path };
}
export function hackCanMove(p: HackPuzzle, j: number) {
  return !p.result && hackNeighbors(p, p.pos).includes(j);
}
export function moveHack(p: HackPuzzle, j: number): HackPuzzle {
  if (!hackCanMove(p, j)) return p;
  const trace = p.trace + stepCost(p, j);
  const q: HackPuzzle = { ...p, pos: j, trace, path: [...p.path, j] };
  if (trace >= 100) q.result = { win: false, stars: 0, text: '추적 게이지가 찼어요. 들켰어요!' };
  else if (j === p.goal) q.result = { win: true, stars: trace <= 45 ? 3 : trace <= 70 ? 2 : 1, text: `서버에 들어갔어요! 추적 ${Math.round(trace)}%` };
  return q;
}
export function tickHack(p: HackPuzzle, ms: number): HackPuzzle {
  if (p.result) return p;
  const elapsed = p.elapsed + ms;
  if (elapsed >= p.timeLimit) return { ...p, elapsed, result: { win: false, stars: 0, text: '시간이 다 됐어요. 연결이 끊겼어요.' } };
  return { ...p, elapsed };
}
function autoHack(p0: HackPuzzle): HackPuzzle {
  const best = hackBest(p0);
  let p = p0;
  if (best) for (const j of best.path.slice(1)) p = moveHack(p, j);
  if (!p.result) p = { ...p, result: { win: false, stars: 0, text: '길이 없어요.' } };
  return p;
}

// ── 공통 ──

export type Puzzle = RecruitPuzzle | CodePuzzle | PipePuzzle | HackPuzzle;
export function createPuzzle(kind: PuzzleKind, seed: number, level: number): Puzzle {
  if (kind === '모병') return createRecruit(seed, level);
  if (kind === '정보') return createCode(seed);
  if (kind === '보급') return createPipes(seed, level >= 4 ? 6 : 5);
  return createHack(seed, level);
}
export function finishPuzzle(p: Puzzle): Puzzle {
  if (p.result) return p;
  if (p.kind === '모병') return autoRecruit(p);
  if (p.kind === '정보') return autoCode(p);
  if (p.kind === '보급') return autoPipes(p);
  return autoHack(p);
}
