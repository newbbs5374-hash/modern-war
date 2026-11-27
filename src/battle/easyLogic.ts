// 11-27 한 손가락 미니 훈련의 규칙 계산(화면 없이 시험할 수 있는 것만).
import type { Rng } from '../game/rng';

// ── 모래판 작전 ──
export type SandTerrain = 'flat' | 'forest' | 'hill';
export type SandUnit = 'inf' | 'tank' | 'spg';
export interface SandBoard {
  /** 길 3개 × 줄 2개 */
  cells: Array<{ lane: number; row: number; terrain: SandTerrain }>;
  /** 길마다 오는 적 */
  foes: Array<{ type: 'armor' | 'inf'; n: number }>;
}
export const SAND_UNITS: Array<{ id: SandUnit; icon: string; name: string; tip: string }> = [
  { id: 'inf', icon: '🪖', name: '보병', tip: '숲에서 세요 · 보병을 잘 막아요' },
  { id: 'tank', icon: '🛡️', name: '전차', tip: '평지에서 세요 · 전차를 잘 막아요' },
  { id: 'spg', icon: '💥', name: '포병', tip: '언덕에서 세요 · 옆 길도 도와요' },
];
const BEST: Record<SandUnit, SandTerrain> = { inf: 'forest', tank: 'flat', spg: 'hill' };

export function sandCells(rng: Rng, level: number): SandBoard {
  const T: SandTerrain[] = ['flat', 'forest', 'hill'];
  const cells = [0, 1, 2].flatMap((lane) => [0, 1].map((row) => ({ lane, row, terrain: rng.pick(T) })));
  // 지형 세 가지가 적어도 하나씩은 있게
  T.forEach((t, i) => {
    if (!cells.some((c) => c.terrain === t)) cells[(i * 2 + 1) % 6].terrain = t;
  });
  const foes = [0, 1, 2].map(() => ({ type: rng.chance(0.5) ? ('armor' as const) : ('inf' as const), n: 1 + Math.floor(rng.next() * (level > 1.4 ? 3 : 2)) }));
  return { cells, foes };
}
function sandRaw(b: SandBoard, put: Partial<Record<SandUnit, number>>): number[] {
  const def = [0, 0, 0];
  (Object.keys(put) as SandUnit[]).forEach((u) => {
    const c = b.cells[put[u] as number];
    if (!c) return;
    let p = 2 * (c.terrain === BEST[u] ? 1.5 : 1);
    const f = b.foes[c.lane];
    if ((u === 'tank' && f.type === 'armor') || (u === 'inf' && f.type === 'inf')) p *= 1.5;
    def[c.lane] += p;
    if (u === 'spg') for (const l of [c.lane - 1, c.lane + 1]) if (l >= 0 && l < 3) def[l] += p * 0.5;
  });
  return def.map((d, i) => d / (b.foes[i].n * 1.5));
}
const sandSum = (r: number[]) => r.reduce((a, x) => a + Math.min(1, x), 0);
/** 가장 좋은 배치의 점수(모든 배치를 다 해 봄) */
export function sandBest(b: SandBoard): number {
  let best = 0;
  for (let a = 0; a < 6; a++) for (let c = 0; c < 6; c++) for (let d = 0; d < 6; d++) if (a !== c && a !== d && c !== d) best = Math.max(best, sandSum(sandRaw(b, { inf: a, tank: c, spg: d })));
  return best;
}
/** 길마다 막은 정도(1 이상이면 막음)와 점수(가장 좋은 배치 = 1) */
export function sandScore(b: SandBoard, put: Partial<Record<SandUnit, number>>): { lanes: number[]; score: number } {
  const lanes = sandRaw(b, put);
  const best = sandBest(b);
  return { lanes, score: best > 0 ? Math.min(1, sandSum(lanes) / best) : 0 };
}

// ── 길목 매복 ──
export const AMBUSH_RANGE = 3.2;
export const AMBUSH_PER_TEAM = 3;
/** 매복조마다 사거리 안에서 가까운 차 3대까지 격파. 돌려주는 값은 격파한 차 번호 */
export function ambushKills(teams: number[][], cars: Array<number[] | null>): number[] {
  const dead = new Set<number>();
  for (const t of teams) {
    cars
      .map((c, i) => ({ i, d: c ? Math.hypot(c[0] - t[0], c[1] - t[1]) : 99 }))
      .filter((x) => x.d <= AMBUSH_RANGE && !dead.has(x.i))
      .sort((a, b) => a.d - b.d)
      .slice(0, AMBUSH_PER_TEAM)
      .forEach((x) => dead.add(x.i));
  }
  return [...dead].sort((a, b) => a - b);
}

// ── 수송 대열 호송 ──
export interface ConvoyMap {
  start: number[];
  goal: number[];
  /** 다리의 z 위치(강은 x=0을 따라 흐름) */
  bridges: number[];
  haz: Array<{ x: number; z: number; r: number }>;
}
export const RIVER_HALF = 0.65;
export const BRIDGE_HALF = 0.85;
/** 그린 길 평가: 강을 다리 없이 건너면 모두 잃음, 매복 원을 지날 때마다 1대 잃음, 너무 돌면 감점 */
export function pathEval(m: ConvoyMap, pts: number[][], trucks: number): { alive: number; lossAt: number[]; len: number; score: number } {
  let len = 0;
  const lossAt: number[] = [];
  const seen = new Set<number>();
  let drown = -1;
  for (let i = 1; i < pts.length; i++) {
    const [x1, z1] = pts[i - 1], [x2, z2] = pts[i];
    const L = Math.hypot(x2 - x1, z2 - z1);
    const n = Math.max(1, Math.ceil(L / 0.25));
    for (let k = 1; k <= n; k++) {
      const x = x1 + ((x2 - x1) * k) / n, z = z1 + ((z2 - z1) * k) / n;
      const d = len + (L * k) / n;
      if (drown < 0 && Math.abs(x) < RIVER_HALF && !m.bridges.some((b) => Math.abs(z - b) <= BRIDGE_HALF)) drown = d;
      m.haz.forEach((h, j) => {
        if (!seen.has(j) && Math.hypot(x - h.x, z - h.z) < h.r) {
          seen.add(j);
          lossAt.push(d);
        }
      });
    }
    len += L;
  }
  let losses = lossAt.filter((d) => drown < 0 || d < drown).slice(0, trucks);
  if (drown >= 0) losses = [...losses, ...Array(trucks - losses.length).fill(drown)];
  const alive = trucks - losses.length;
  const straight = Math.hypot(m.goal[0] - m.start[0], m.goal[1] - m.start[1]);
  const detour = len > straight * 2.2 ? 0.85 : 1;
  return { alive, lossAt: losses, len, score: (alive / trucks) * detour };
}

// ── 짐 싣기: 5×4 짐칸을 조각으로 나눔(반드시 다 채울 수 있음) ──
export const PACK_W = 5;
export const PACK_H = 4;
export interface PackPiece { cells: number[][]; home: number[] }
export function packPieces(rng: Rng, level: number): PackPiece[] {
  const want = level > 1.4 ? 7 : level > 1.1 ? 6 : 5;
  const own = Array(PACK_W * PACK_H).fill(-1);
  const idx = (x: number, y: number) => y * PACK_W + x;
  const seeds: number[] = [];
  while (seeds.length < want) {
    const i = Math.floor(rng.next() * own.length);
    if (!seeds.includes(i)) seeds.push(i);
  }
  seeds.forEach((s, p) => (own[s] = p));
  let left = own.length - want, guard = 0;
  while (left > 0 && guard++ < 4000) {
    const i = Math.floor(rng.next() * own.length);
    if (own[i] >= 0) continue;
    const x = i % PACK_W, y = Math.floor(i / PACK_W);
    const nb = [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]].filter(([a, b]) => a >= 0 && b >= 0 && a < PACK_W && b < PACK_H && own[idx(a, b)] >= 0);
    if (!nb.length) continue;
    const [a, b] = rng.pick(nb);
    own[i] = own[idx(a, b)];
    left--;
  }
  return seeds.map((_, p) => {
    const cs = own.map((o, i) => (o === p ? [i % PACK_W, Math.floor(i / PACK_W)] : null)).filter(Boolean) as number[][];
    const mx = Math.min(...cs.map((c) => c[0])), my = Math.min(...cs.map((c) => c[1]));
    return { cells: cs.map(([x, y]) => [x - mx, y - my]), home: [mx, my] };
  });
}
/** 조각을 (x,y)에 놓을 수 있나 */
export function packFits(grid: number[], piece: PackPiece, x: number, y: number): boolean {
  return piece.cells.every(([cx, cy]) => {
    const a = x + cx, b = y + cy;
    return a >= 0 && b >= 0 && a < PACK_W && b < PACK_H && grid[b * PACK_W + a] < 0;
  });
}

// ── 첩보 맞춰 보기: 보고 3개 가운데 거짓 하나 ──
export interface LiarRound { facts: string[]; lie: number; why: string }
const PLACES = ['북쪽 항구', '동쪽 비행장', '국경 다리', '남쪽 창고', '산속 기지', '서쪽 조선소'];
const THINGS = ['전차', '수송 트럭', '미사일 차', '보병', '헬기', '고속정'];
export function liarRound(rng: Rng, level: number): LiarRound {
  const place = rng.pick(PLACES), thing = rng.pick(THINGS);
  const n = 10 + Math.floor(rng.next() * 30);
  const hour = 1 + Math.floor(rng.next() * 10);
  const kind = Math.floor(rng.next() * 3);
  const near = level > 1.3;
  let facts: string[], why: string;
  if (kind === 0) {
    const wrong = n + (near ? rng.pick([4, -4, 6]) : rng.pick([15, 20, -8]));
    facts = [`위성: ${place}에 ${thing} ${n}대가 찍혔습니다.`, `감청: "${thing} ${n}대, ${place} 도착 완료."`, `첩보원: ${place}에서 ${thing} ${Math.max(1, wrong)}대를 세었습니다.`];
    why = `숫자가 달라요(${n}대)`;
  } else if (kind === 1) {
    const other = rng.pick(PLACES.filter((p) => p !== place));
    facts = [`위성: 새벽 ${hour}시 ${place}에 ${thing}가 모였습니다.`, `감청: "${thing}는 ${place}에서 대기한다."`, `첩보원: 같은 시각 ${thing}는 모두 ${other}에 있었습니다.`];
    why = `곳이 달라요(${place})`;
  } else {
    const late = hour + (near ? 1 : 3);
    facts = [`위성: 새벽 ${hour}시에 ${place}는 비어 있었습니다.`, `감청: "${thing} 부대, ${late}시에 ${place}로 들어간다."`, `첩보원: 새벽 ${hour}시에 ${place}는 ${thing}로 가득했습니다.`];
    why = `${hour}시에는 비어 있었어요`;
  }
  // 거짓(셋째)을 섞음
  const order = [0, 1, 2].sort(() => rng.next() - 0.5);
  return { facts: order.map((i) => facts[i]), lie: order.indexOf(2), why };
}
