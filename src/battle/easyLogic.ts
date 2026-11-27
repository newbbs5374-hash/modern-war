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

// ── 놓기(덮기): 원 n개로 표적을 가장 많이 덮기 ──
export interface CoverTarget { x: number; z: number; w: number }
export const coverSum = (targets: CoverTarget[], marks: number[][], r: number) => targets.reduce((a, t) => a + (marks.some((m) => Math.hypot(m[0] - t.x, m[1] - t.z) <= r) ? t.w : 0), 0);
/** 욕심쟁이 방식으로 찾은 가장 좋은 덮기(표적 자리·두 표적 사이를 후보로) */
export function coverBest(targets: CoverTarget[], n: number, r: number): number {
  const cands: number[][] = targets.map((t) => [t.x, t.z]);
  for (let i = 0; i < targets.length; i++) for (let j = i + 1; j < targets.length; j++) if (Math.hypot(targets[i].x - targets[j].x, targets[i].z - targets[j].z) <= r * 2) cands.push([(targets[i].x + targets[j].x) / 2, (targets[i].z + targets[j].z) / 2]);
  const marks: number[][] = [];
  for (let k = 0; k < n; k++) {
    let best = cands[0], bv = -1;
    for (const c of cands) {
      const v = coverSum(targets, [...marks, c], r);
      if (v > bv) { bv = v; best = c; }
    }
    if (best) marks.push(best);
  }
  return coverSum(targets, marks, r);
}
export const coverScore = (targets: CoverTarget[], marks: number[][], n: number, r: number) => {
  const best = coverBest(targets, n, r);
  return best > 0 ? Math.min(1, coverSum(targets, marks, r) / best) : 0;
};

// ── 항구 하역: 배 3척의 순서. 급한 짐일수록 기다리는 값이 큼 ──
export interface DockShip { name: string; icon: string; hours: number; urgent: number }
const DOCK_KINDS: Array<[string, string]> = [['탄약선', '🧨'], ['유조선', '⛽'], ['식량선', '🍞'], ['병원선', '🏥'], ['장비선', '🛠️'], ['증원 수송선', '🪖']];
export function dockShips(rng: Rng): DockShip[] {
  const kinds = [...DOCK_KINDS].sort(() => rng.next() - 0.5).slice(0, 3);
  for (let guard = 0; guard < 50; guard++) {
    const ships = kinds.map(([name, icon]) => ({ name, icon, hours: 1 + Math.floor(rng.next() * 5), urgent: 1 + Math.floor(rng.next() * 3) }));
    // 가장 좋은 순서가 하나뿐이게(비율이 모두 다름)
    const ratio = ships.map((s) => s.urgent / s.hours);
    if (new Set(ratio.map((x) => x.toFixed(3))).size === 3) return ships;
  }
  return kinds.map(([name, icon], i) => ({ name, icon, hours: i + 1, urgent: 3 - i }));
}
/** 기다린 값(작을수록 좋음): 급함 × 하역이 끝난 시각 */
export const dockCost = (ships: DockShip[], order: number[]) => {
  let t = 0, cost = 0;
  for (const i of order) {
    t += ships[i].hours;
    cost += ships[i].urgent * t;
  }
  return cost;
};
export function dockScore(ships: DockShip[], order: number[]): number {
  const perms = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]];
  const costs = perms.map((p) => dockCost(ships, p));
  const best = Math.min(...costs), worst = Math.max(...costs);
  const c = dockCost(ships, order);
  return worst === best ? 1 : 1 - (c - best) / (worst - best);
}

// ── 끌기(길 그리기) 공통 ──
export interface Circle { x: number; z: number; r: number }
/** 그린 길이 지나간 원들의 번호(길이 maxLen 까지만 셈) */
export function strokeHits(pts: number[][], circles: Circle[], maxLen = Infinity): number[] {
  const hit = new Set<number>();
  let len = 0;
  const test = (x: number, z: number) => circles.forEach((c, i) => Math.hypot(x - c.x, z - c.z) <= c.r && hit.add(i));
  if (pts.length) test(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) {
    const [x1, z1] = pts[i - 1], [x2, z2] = pts[i];
    const L = Math.hypot(x2 - x1, z2 - z1), n = Math.max(1, Math.ceil(L / 0.2));
    for (let k = 1; k <= n; k++) {
      if (len + (L * k) / n > maxLen) return [...hit];
      test(x1 + ((x2 - x1) * k) / n, z1 + ((z2 - z1) * k) / n);
    }
    len += L;
  }
  return [...hit];
}
export const strokeLen = (pts: number[][]) => pts.slice(1).reduce((a, p, i) => a + Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]), 0);
/** 가까운 것부터 도는 길이(드론 배터리의 기준) */
export function tourLen(start: number[], pts: Circle[]): number {
  let cur = start, left = [...pts], len = 0;
  while (left.length) {
    left.sort((a, b) => Math.hypot(a.x - cur[0], a.z - cur[1]) - Math.hypot(b.x - cur[0], b.z - cur[1]));
    const n = left.shift()!;
    len += Math.hypot(n.x - cur[0], n.z - cur[1]);
    cur = [n.x, n.z];
  }
  return len;
}
/** 기뢰밭: 구불구불한 안전한 길을 먼저 만들고, 그 밖에 기뢰를 깖 */
export function mineField(rng: Rng, level: number): { start: number[]; goal: number[]; way: number[][]; mines: Circle[] } {
  const way: number[][] = [[rng.range(-4, 4), 7.5]];
  for (let z = 4.5; z >= -4.5; z -= 3) way.push([Math.max(-5.5, Math.min(5.5, way[way.length - 1][0] + rng.range(-4, 4))), z]);
  way.push([way[way.length - 1][0] + rng.range(-1.5, 1.5), -7.5]);
  const near = (x: number, z: number) => {
    for (let i = 1; i < way.length; i++) {
      const [x1, z1] = way[i - 1], [x2, z2] = way[i];
      for (let k = 0; k <= 10; k++) if (Math.hypot(x1 + ((x2 - x1) * k) / 10 - x, z1 + ((z2 - z1) * k) / 10 - z) < 1.55) return true;
    }
    return false;
  };
  const mines: Circle[] = [];
  let guard = 0;
  const want = 16 + Math.round(level * 6);
  while (mines.length < want && guard++ < 2000) {
    const x = rng.range(-7, 7), z = rng.range(-6.5, 6.5);
    if (near(x, z) || mines.some((m) => Math.hypot(m.x - x, m.z - z) < 1.1)) continue;
    mines.push({ x, z, r: 0.7 });
  }
  return { start: way[0], goal: way[way.length - 1], way, mines };
}

// ── 신병 나누기 ──
export const SORT_BINS = ['육군', '해군', '공군', '사이버'];
const SORT_TRAITS: Array<[string, number]> = [
  ['마라톤 완주', 0], ['산악 구조대 출신', 0], ['사격 선수', 0], ['굴착기 기사', 0], ['전차 게임 말고 진짜 정비사', 0],
  ['수영 선수', 1], ['어선에서 3년', 1], ['잠수 자격증', 1], ['항해사 집안', 1], ['조선소 용접공', 1],
  ['경비행기 조종', 2], ['드론 대회 우승', 2], ['항공 정비 학과', 2], ['관제탑 근무 경험', 2], ['시력 2.0 · 멀미 없음', 2],
  ['해킹 대회 입상', 3], ['수학 올림피아드', 3], ['서버 관리자', 3], ['암호학 전공', 3], ['프로그래머 5년', 3],
];
export function sortRecruits(rng: Rng, n: number): Array<{ trait: string; bin: number }> {
  const a = [...SORT_TRAITS];
  const out: Array<{ trait: string; bin: number }> = [];
  while (out.length < n && a.length) {
    const [trait, bin] = a.splice(Math.floor(rng.next() * a.length), 1)[0];
    out.push({ trait, bin });
  }
  return out;
}
