// 세계지도에서 배가 땅으로 들어가지 않게 하는 바닷길 계산(11/25 대장 요청).
// - seaLoop: 앞바다 순찰 고리. 고리 둘레가 모두 바다가 되도록 줄이거나 옮김
// - seaRoute: 두 바다 지점 사이 바닷길(4px 칸 A* + 직선 펴기). 땅을 가로지르지 않음
import { GEO, isLand, project, seaNearXY } from "./realmap";
import { SEA_GRID } from "./seaGrid";

/** 칸 크기(px). 1도 = 6px */
export const GRID_C = 4;
const C = GRID_C;
const GW = Math.ceil(GEO.W / C);
const GH = Math.ceil(GEO.H / C);
/** 배가 지나갈 수 있는 칸(미리 계산한 자료 src/data/seaGrid.ts, 없으면 그 자리에서 계산) */
let OPEN: Uint8Array | null = null;
/** 이어진 바다 묶음 번호(같은 번호끼리만 길이 있음) */
let COMP: Int32Array | null = null;
function grid(): Uint8Array {
  if (OPEN) return OPEN;
  const o = new Uint8Array(GW * GH);
  if (SEA_GRID.W === GW && SEA_GRID.H === GH && SEA_GRID.bits) {
    const raw = atob(SEA_GRID.bits);
    for (let k = 0; k < GW * GH; k++) o[k] = (raw.charCodeAt(k >> 3) >> (k & 7)) & 1;
  } else
    for (let cy = 0; cy < GH; cy++)
      for (let cx = 0; cx < GW; cx++) {
        const x = cx * C + C / 2;
        const y = cy * C + C / 2;
        const land = isLand(x, y) || isLand(x - 1.5, y) || isLand(x + 1.5, y) || isLand(x, y - 1.5) || isLand(x, y + 1.5);
        o[cy * GW + cx] = land ? 0 : 1;
      }
  // 실제 배가 다니는 운하·좁은 해협은 지도 자료에서 막혀 있어 직접 뚫음
  for (const line of CANALS) {
    const pts = line.map(([lon, lat]) => project(lon, lat));
    for (let i = 1; i < pts.length; i++) {
      const d = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
      for (let t = 0; t <= d; t += 0.5) {
        const x = pts[i - 1].x + ((pts[i].x - pts[i - 1].x) * t) / Math.max(d, 0.01);
        const y = pts[i - 1].y + ((pts[i].y - pts[i - 1].y) * t) / Math.max(d, 0.01);
        const cx = Math.floor(x / C);
        const cy = Math.floor(y / C);
        // 0.5px마다 짚어 선이 지나는 칸을 모두 열면 칸끼리 옆으로 이어짐
        if (cx >= 0 && cy >= 0 && cx < GW && cy < GH) o[cy * GW + cx] = 1;
      }
    }
  }
  OPEN = o;
  // 묶음 번호 매기기(8방향, 대각선은 양옆 중 하나라도 열려야)
  const comp = new Int32Array(GW * GH).fill(-1);
  const q = new Int32Array(GW * GH);
  let id = 0;
  for (let k0 = 0; k0 < GW * GH; k0++) {
    if (!o[k0] || comp[k0] >= 0) continue;
    let h = 0;
    let t = 0;
    q[t++] = k0;
    comp[k0] = id;
    while (h < t) {
      const k = q[h++];
      const cx = k % GW;
      const cy = (k - cx) / GW;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          if (!passable(cx, cy, dx, dy)) continue;
          const nk = (cy + dy) * GW + cx + dx;
          if (comp[nk] < 0) {
            comp[nk] = id;
            q[t++] = nk;
          }
        }
    }
    id++;
  }
  COMP = comp;
  return o;
}
/** 운하·해협(경도, 위도): 수에즈·바브엘만데브·보스포루스와 다르다넬스·덴마크 해협·파나마.
 * (말라카 해협은 지도 아래(북위 5도)보다 남쪽이라 인도양↔태평양 바닷길은 없음: 그때 배는 길 없이 도착지에서 나타남) */
export const CANALS: Array<Array<[number, number]>> = [
  [[32.3, 31.6], [32.33, 31.2], [32.55, 30.3], [32.56, 29.7], [32.9, 29.0], [33.6, 27.9], [34.6, 26.8], [35.6, 25.4]],
  [[42.8, 13.6], [43.35, 12.6], [43.9, 12.0]],
  [[29.3, 41.5], [29.1, 41.2], [29.0, 41.0], [28.5, 40.85], [27.5, 40.7], [26.68, 40.4], [26.4, 40.15], [26.1, 40.0], [25.8, 39.9]],
  [[10.6, 57.9], [11.4, 56.8], [12.6, 56.05], [12.75, 55.5], [12.9, 54.9]],
  [[-79.95, 9.8], [-79.75, 9.2], [-79.55, 8.8], [-79.4, 8.3]],
];
function blocked(cx: number, cy: number): boolean {
  if (cx < 0 || cy < 0 || cx >= GW || cy >= GH) return true;
  return !grid()[cy * GW + cx];
}
/** (cx,cy)에서 (dx,dy)로 한 칸 갈 수 있나. 대각선은 양옆이 모두 열려야(땅 모서리 뚫기 방지) */
function passable(cx: number, cy: number, dx: number, dy: number): boolean {
  if (blocked(cx + dx, cy + dy)) return false;
  if (dx && dy && (blocked(cx + dx, cy) || blocked(cx, cy + dy))) return false;
  return true;
}

/** a→b 직선이 모두 바다인가(1px마다, 해안에서 m만큼 띄움) */
export function seaLine(
  a: { x: number; y: number },
  b: { x: number; y: number },
  m = 1,
): boolean {
  const d = Math.hypot(b.x - a.x, b.y - a.y);
  const n = Math.max(2, Math.ceil(d));
  for (let i = 0; i <= n; i++) {
    const x = a.x + ((b.x - a.x) * i) / n;
    const y = a.y + ((b.y - a.y) * i) / n;
    if (isLand(x, y)) return false;
    if (m > 0 && (isLand(x + m, y) || isLand(x - m, y) || isLand(x, y + m) || isLand(x, y - m)))
      return false;
  }
  return true;
}

/** 타원 고리 둘레가 모두 바다인가 */
function loopClear(x: number, y: number, rx: number, ry: number): boolean {
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    const px = x + Math.cos(a) * rx;
    const py = y + Math.sin(a) * ry;
    if (isLand(px, py) || isLand(px + 1, py) || isLand(px - 1, py) || isLand(px, py + 1) || isLand(px, py - 1))
      return false;
  }
  return !isLand(x, y);
}

const loopD = (x: number, y: number, rx: number, ry: number) =>
  `M${(x - rx).toFixed(1)},${y.toFixed(1)} a${rx.toFixed(1)},${ry.toFixed(1)} 0 1,0 ${(rx * 2).toFixed(1)},0 a${rx.toFixed(1)},${ry.toFixed(1)} 0 1,0 ${(-rx * 2).toFixed(1)},0`;

const loopMemo = new Map<string, { d: string; x: number; y: number }>();
/** (x,y) 둘레 순찰 고리(땅에 닿지 않게). 안 되면 줄이고, 그래도 안 되면 가까운 넓은 바다로 옮김 */
export function seaLoop(
  x: number,
  y: number,
  rx: number,
  ry: number,
): { d: string; x: number; y: number } {
  const key = `${x.toFixed(1)},${y.toFixed(1)},${rx},${ry}`;
  const hit = loopMemo.get(key);
  if (hit) return hit;
  let out: { d: string; x: number; y: number } | null = null;
  // 1) 그 자리에서 크기 줄이기 2) 둘레 조금씩 옮기기 3) 넓은 바다로
  for (const s of [1, 0.8, 0.6, 0.45]) {
    if (loopClear(x, y, rx * s, ry * s)) {
      out = { d: loopD(x, y, rx * s, ry * s), x, y };
      break;
    }
  }
  if (!out)
    for (let r = 2; r <= 14 && !out; r += 2)
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        const nx = x + Math.cos(a) * r;
        const ny = y + Math.sin(a) * r;
        if (loopClear(nx, ny, rx * 0.7, ry * 0.7)) {
          out = { d: loopD(nx, ny, rx * 0.7, ry * 0.7), x: nx, y: ny };
          break;
        }
      }
  if (!out) {
    const q = seaNearXY(x, y, Math.max(rx, ry) + 2);
    out = { d: loopD(q.x, q.y, rx * 0.6, ry * 0.6), x: q.x, y: q.y };
  }
  loopMemo.set(key, out);
  return out;
}

const cellOf = (p: { x: number; y: number }) => ({
  cx: Math.max(0, Math.min(GW - 1, Math.floor(p.x / C))),
  cy: Math.max(0, Math.min(GH - 1, Math.floor(p.y / C))),
});
/** 가장 가까운 바다 칸 */
function nearestOpen(cx: number, cy: number): { cx: number; cy: number } | null {
  if (!blocked(cx, cy)) return { cx, cy };
  for (let r = 1; r < 30; r++)
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        if (!blocked(cx + dx, cy + dy)) return { cx: cx + dx, cy: cy + dy };
      }
  return null;
}

const routeMemo = new Map<string, Array<{ x: number; y: number }> | null>();
/** 바다 지점 a → b 바닷길(점 목록). 길이 없으면 null */
/** 시험용: 지점의 바다 묶음 번호 */
export const seaComp = (x: number, y: number) => {
  grid();
  const c = cellOf({ x, y });
  return COMP![c.cy * GW + c.cx];
};

export function seaRoute(
  a: { x: number; y: number },
  b: { x: number; y: number },
): Array<{ x: number; y: number }> | null {
  const key = `${a.x.toFixed(0)},${a.y.toFixed(0)}>${b.x.toFixed(0)},${b.y.toFixed(0)}`;
  if (routeMemo.has(key)) return routeMemo.get(key)!;
  let res: Array<{ x: number; y: number }> | null = null;
  if (seaLine(a, b)) res = [a, b];
  else {
    const s0 = cellOf(a);
    const g0 = cellOf(b);
    const s = nearestOpen(s0.cx, s0.cy);
    const g = nearestOpen(g0.cx, g0.cy);
    if (s && g) {
      const cells = astar(s.cx, s.cy, g.cx, g.cy);
      if (cells) {
        const pts = [a, ...cells.map((k) => ({ x: (k % GW) * C + C / 2, y: Math.floor(k / GW) * C + C / 2 })), b];
        res = smooth(pts);
      }
    }
  }
  routeMemo.set(key, res);
  return res;
}

/** 칸 A*(8방향). 찾은 칸 번호 목록. 서로 다른 바다 묶음이면 바로 null */
function astar(sx: number, sy: number, gx: number, gy: number): number[] | null {
  grid();
  const start = sy * GW + sx;
  const goal = gy * GW + gx;
  if (COMP![start] !== COMP![goal]) return null;
  const N = GW * GH;
  const gs = new Float32Array(N).fill(Infinity);
  const from = new Int32Array(N).fill(-1);
  const done = new Uint8Array(N);
  gs[start] = 0;
  // 이진 힙(f, 칸)
  const hf: number[] = [0];
  const hk: number[] = [start];
  const swap = (i: number, j: number) => {
    [hf[i], hf[j]] = [hf[j], hf[i]];
    [hk[i], hk[j]] = [hk[j], hk[i]];
  };
  const push = (f: number, k: number) => {
    hf.push(f);
    hk.push(k);
    let i = hf.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (hf[p] <= hf[i]) break;
      swap(p, i);
      i = p;
    }
  };
  const pop = (): number => {
    const top = hk[0];
    const lf = hf.pop()!;
    const lk = hk.pop()!;
    if (hf.length) {
      hf[0] = lf;
      hk[0] = lk;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let m = i;
        if (l < hf.length && hf[l] < hf[m]) m = l;
        if (r < hf.length && hf[r] < hf[m]) m = r;
        if (m === i) break;
        swap(m, i);
        i = m;
      }
    }
    return top;
  };
  while (hf.length) {
    const k = pop();
    if (done[k]) continue;
    done[k] = 1;
    if (k === goal) {
      const out = [k];
      let c = k;
      while (from[c] >= 0) {
        c = from[c];
        out.push(c);
      }
      return out.reverse();
    }
    const cx = k % GW;
    const cy = (k - cx) / GW;
    const gk = gs[k];
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        if (!passable(cx, cy, dx, dy)) continue;
        const nk = (cy + dy) * GW + cx + dx;
        const ng = gk + (dx && dy ? Math.SQRT2 : 1);
        if (ng < gs[nk]) {
          gs[nk] = ng;
          from[nk] = k;
          push(ng + Math.hypot(cx + dx - gx, cy + dy - gy), nk);
        }
      }
  }
  return null;
}

/** a→b 직선이 지나는 칸이 모두 열려 있나(칸 자료로 빠르게) */
function gridLine(a: { x: number; y: number }, b: { x: number; y: number }): boolean {
  const d = Math.hypot(b.x - a.x, b.y - a.y);
  const n = Math.max(1, Math.ceil(d));
  for (let i = 0; i <= n; i++) {
    const x = a.x + ((b.x - a.x) * i) / n;
    const y = a.y + ((b.y - a.y) * i) / n;
    if (blocked(Math.floor(x / C), Math.floor(y / C))) return false;
  }
  return true;
}

/** 직선으로 이어도 바다인 점은 건너뜀(꺾임 줄이기). 앞으로 갈 수 있는 데까지 늘려 가는 방식 */
function smooth(pts: Array<{ x: number; y: number }>): Array<{ x: number; y: number }> {
  const out = [pts[0]];
  let i = 0;
  while (i < pts.length - 1) {
    let j = i + 1;
    while (j + 1 < pts.length && gridLine(pts[i], pts[j + 1])) j++;
    // 칸 사이 모서리에 걸친 땅까지 한 번 더 확인
    while (j > i + 1 && !seaLine(pts[i], pts[j], 0)) j--;
    out.push(pts[j]);
    i = j;
  }
  return out;
}

/** 점 목록 → path 문자열 */
export const polyD = (pts: Array<{ x: number; y: number }>) =>
  pts.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
