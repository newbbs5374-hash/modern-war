// 연구 성좌판: 가운데 시작 별에서 시대마다 바깥 고리로 뻗는 별자리 배치(용흔 성좌 "세 길" 판 참고).
// 선이 겹치지 않게: 기술마다 "주 선행"을 하나 골라 나무로 보고, 가지마다 부채꼴(각도 몫)을 나눠 줌.
// 같은 부채꼴 안에서만 뻗으니 주 선은 서로 엇갈리지 않음. 선행이 둘인 기술은 두 가지가 이웃하도록 순서를 골라 둠.
// 그리기 좌표만 계산(연구 규칙·저장은 그대로).
import type { Tech } from '../data/civ';
import { SKY_ORDER } from './techSkyOrder';

export const SKY_R = 280; // 판 반지름(좌표)
/** 시대 고리 반지름. 같은 시대 안에서 선행이 또 있으면 고리 안에서 바깥으로 한 칸(SUB) 더 나감 */
export const RING: Record<number, number> = { 1: 92, 2: 152, 3: 212, 4: 272 };
const SUB = 27;

export interface SkyNode {
  id: string;
  x: number;
  y: number;
  r: number;
  a: number; // 각도(라디안, 12시 = 0, 시계 방향)
}
export interface SkyEdge {
  from: string; // '' = 시작 별
  to: string;
  pts: Array<[number, number]>;
}
export interface SkyLayout {
  nodes: Record<string, SkyNode>;
  edges: SkyEdge[];
  crossings: number;
}

/** 휴대폰 세로 화면에 맞게 위아래로 늘린 타원 판(늘려도 선이 엇갈리지 않는 건 그대로) */
export const SKY_ASPECT = 1.55;
const xy = (r: number, a: number): [number, number] => [+(r * Math.sin(a)).toFixed(1), +(-r * Math.cos(a) * SKY_ASPECT).toFixed(1)];

/** 극좌표로 반지름·각도를 함께 옮기는 곡선(부채꼴 안에 머묾) */
function arcPts(r1: number, a1: number, r2: number, a2: number): Array<[number, number]> {
  const n = Math.max(2, Math.ceil(Math.abs(r2 - r1) / 10 + (Math.abs(a2 - a1) * (r1 + r2)) / 2 / 10));
  const out: Array<[number, number]> = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    // 시작은 바깥으로 곧게 나가고, 끝에서 옆으로 꺾이게(가운데를 지나는 선은 곧게)
    const tr = r1 === 0 ? t : t;
    const ta = r1 === 0 ? 1 : t * t * (3 - 2 * t);
    out.push(xy(r1 + (r2 - r1) * tr, a1 + (a2 - a1) * ta));
  }
  return out;
}

function segX(p: [number, number], p2: [number, number], q: [number, number], q2: [number, number]): boolean {
  const d = (a: [number, number], b: [number, number], c: [number, number]) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  const d1 = d(p, p2, q), d2 = d(p, p2, q2), d3 = d(q, q2, p), d4 = d(q, q2, p2);
  return d1 * d2 < 0 && d3 * d4 < 0;
}
function box(e: SkyEdge): [number, number, number, number] {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of e.pts) (x0 = Math.min(x0, x)), (y0 = Math.min(y0, y)), (x1 = Math.max(x1, x)), (y1 = Math.max(y1, y));
  return [x0, y0, x1, y1];
}
export function edgesCross(e: SkyEdge, f: SkyEdge): boolean {
  if (e.from === f.from || e.to === f.to || e.from === f.to || e.to === f.from) return false;
  const a = box(e), b = box(f);
  if (a[2] < b[0] || b[2] < a[0] || a[3] < b[1] || b[3] < a[1]) return false;
  for (let i = 1; i < e.pts.length; i++) for (let j = 1; j < f.pts.length; j++) if (segX(e.pts[i - 1], e.pts[i], f.pts[j - 1], f.pts[j])) return true;
  return false;
}
/** 선이 남의 별 가까이(별 반지름 안) 지나가는지 */
function nearNode(e: SkyEdge, n: SkyNode, rad: number): boolean {
  if (n.id === e.from || n.id === e.to) return false;
  for (let i = 1; i < e.pts.length; i++) {
    const [ax, ay] = e.pts[i - 1], [bx, by] = e.pts[i];
    const dx = bx - ax, dy = by - ay;
    const L = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((n.x - ax) * dx + (n.y - ay) * dy) / L));
    if (Math.hypot(ax + dx * t - n.x, ay + dy * t - n.y) < rad) return true;
  }
  return false;
}

/** 작은 시드 난수(같은 목록이면 늘 같은 판) */
function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => ((s = Math.imul(s ^ (s >>> 15), 2246822507) ^ Math.imul(s ^ (s >>> 13), 3266489909)), ((s ^= s >>> 16) >>> 0) / 4294967296);
}

function build(list: Tech[], order: Record<string, string[]>): SkyLayout {
  const ids = new Set(list.map((t) => t.id));
  const by = Object.fromEntries(list.map((t) => [t.id, t]));
  const par = (t: Tech) => order['@' + t.id]?.[0] ?? t.needs.find((n) => ids.has(n)) ?? '';
  // 같은 시대 안 깊이 → 반지름
  const sub: Record<string, number> = {};
  const subOf = (t: Tech): number => {
    if (sub[t.id] != null) return sub[t.id];
    const p = par(t);
    return (sub[t.id] = p && by[p].era === t.era ? subOf(by[p]) + 1 : 0);
  };
  const rad = (t: Tech) => RING[t.era] + SUB * subOf(t);
  // 가지 무게(잎 개수, 안쪽 잎은 조금 가볍게)
  const w: Record<string, number> = {};
  const weight = (id: string): number => {
    if (w[id] != null) return w[id];
    const kids = order[id] ?? [];
    const self = id ? 0.55 + 0.15 * by[id].era : 0;
    return (w[id] = Math.max(self, kids.reduce((a, k) => a + weight(k), 0)));
  };
  const nodes: Record<string, SkyNode> = {};
  const place = (id: string, a0: number, a1: number) => {
    if (id) {
      const a = (a0 + a1) / 2;
      const r = rad(by[id]);
      const [x, y] = xy(r, a);
      nodes[id] = { id, x, y, r, a };
    }
    const kids = order[id] ?? [];
    const tot = kids.reduce((s, k) => s + weight(k), 0) || 1;
    let cur = a0;
    for (const k of kids) {
      const span = ((a1 - a0) * weight(k)) / tot;
      place(k, cur, cur + span);
      cur += span;
    }
  };
  place('', 0, Math.PI * 2);
  // 선행이 둘인 기술: 두 선행 사이(각도 평균)로 살짝 당김 — 주 가지 부채꼴 밖으로는 안 나감
  for (const t of list) {
    const ps = t.needs.filter((n) => ids.has(n));
    if (ps.length < 2) continue;
    const n = nodes[t.id];
    const ref = n.a;
    const diffs = ps.map((p) => {
      let d = nodes[p].a - ref;
      while (d > Math.PI) d -= 2 * Math.PI;
      while (d < -Math.PI) d += 2 * Math.PI;
      return d;
    });
    const mean = diffs.reduce((a, d) => a + d, 0) / diffs.length;
    const a = ref + Math.max(-0.09, Math.min(0.09, mean * 0.5));
    const [x, y] = xy(n.r, a);
    nodes[t.id] = { ...n, x, y, a };
  }
  // 너무 붙은 별은 같은 고리 위에서 옆으로 밀어 벌림(반지름은 그대로)
  const ns = Object.values(nodes);
  const MIN = 50;
  for (let it = 0; it < 60; it++) {
    let moved = false;
    for (let i = 0; i < ns.length; i++)
      for (let j = i + 1; j < ns.length; j++) {
        const p = ns[i], q = ns[j];
        const d = Math.hypot(p.x - q.x, p.y - q.y);
        if (d >= MIN) continue;
        let da = q.a - p.a;
        while (da > Math.PI) da -= 2 * Math.PI;
        while (da < -Math.PI) da += 2 * Math.PI;
        const sp = (n: SkyNode) => n.r * Math.hypot(Math.cos(n.a), SKY_ASPECT * Math.sin(n.a)) || 1;
        const push = Math.min(6, (MIN - d) * 0.25);
        const dir = da >= 0 ? 1 : -1;
        p.a -= (dir * push) / sp(p);
        q.a += (dir * push) / sp(q);
        moved = true;
      }
    for (const n of ns) [n.x, n.y] = xy(n.r, n.a);
    if (!moved) break;
  }
  const edges: SkyEdge[] = [];
  for (const t of list) {
    const n = nodes[t.id];
    const ps = t.needs.filter((p) => ids.has(p));
    if (!ps.length) edges.push({ from: '', to: t.id, pts: arcPts(0, n.a, n.r, n.a) });
    for (const p of ps) {
      const m = nodes[p];
      let a2 = n.a;
      while (a2 - m.a > Math.PI) a2 -= 2 * Math.PI;
      while (m.a - a2 > Math.PI) a2 += 2 * Math.PI;
      edges.push({ from: p, to: t.id, pts: arcPts(m.r, m.a, n.r, a2) });
    }
  }
  let crossings = 0;
  for (let i = 0; i < edges.length; i++) for (let j = i + 1; j < edges.length; j++) if (edgesCross(edges[i], edges[j])) crossings++;
  return { nodes, edges, crossings };
}

/** 겹침 점수: 엇갈린 선 + 남의 별 위를 지나는 선 + 너무 붙은 별 */
function badness(L: SkyLayout): number {
  let near = 0;
  const ns = Object.values(L.nodes);
  for (const e of L.edges) for (const n of ns) if (nearNode(e, n, 20)) near++;
  let tight = 0;
  for (let i = 0; i < ns.length; i++)
    for (let j = i + 1; j < ns.length; j++) {
      const d = Math.hypot(ns[i].x - ns[j].x, ns[i].y - ns[j].y);
      if (d < 48) tight += ((48 - d) / 48) ** 2 * 20;
    }
  return L.crossings * 100 + near * 30 + tight * 5;
}

/** 주 선행(@id) 고르기를 반영한 가지 목록 */
function treeOf(list: Tech[], prim: Record<string, string>): Record<string, string[]> {
  const ids = new Set(list.map((t) => t.id));
  const kids: Record<string, string[]> = { '': [] };
  for (const t of list) {
    const p = prim[t.id] ?? t.needs.find((n) => ids.has(n)) ?? '';
    (kids[p] ??= []).push(t.id);
    if (prim[t.id]) kids['@' + t.id] = [p];
  }
  return kids;
}
/** 선행이 둘 이상인 기술의 주 선행을 바꾸면서 가지 순서를 유지 */
function switchPrimary(o: Record<string, string[]>, t: Tech, ids: Set<string>, p: string) {
  for (const [k, v] of Object.entries(o)) if (!k.startsWith('@')) o[k] = v.filter((x) => x !== t.id);
  (o[p] ??= []).push(t.id);
  o['@' + t.id] = [p];
  void ids;
}

export const skyKey = (list: Tech[]) => list.map((t) => t.id + ':' + t.needs.join('+')).join('|');

/** 가지 순서를 여러 번 섞어 보고 겹침이 가장 적은 순서를 고름(같은 목록·같은 횟수면 늘 같은 결과) */
export function optimizeSky(list: Tech[], rounds: number, start?: Record<string, string[]>): { order: Record<string, string[]>; score: number } {
  const key = skyKey(list);
  const ids = new Set(list.map((t) => t.id));
  const multi = list.filter((t) => t.needs.filter((n) => ids.has(n)).length > 1);
  const rand = rng(key.length * 7919 + 17);
  let bestScore = Infinity;
  let bestOrder = start ?? treeOf(list, {});
  const tryOrder = (o: Record<string, string[]>) => {
    const sc = badness(build(list, o));
    if (sc < bestScore) (bestScore = sc), (bestOrder = o);
  };
  tryOrder(bestOrder);
  for (let round = 0; round < rounds; round++) {
    const o: Record<string, string[]> = {};
    for (const [k, v] of Object.entries(bestOrder)) o[k] = [...v];
    const keys = Object.keys(o).filter((k) => !k.startsWith('@') && o[k].length > 1);
    const moves = round % 200 === 199 ? 6 : 1 + Math.floor(rand() * 2);
    if (multi.length && rand() < 0.25) {
      const t = multi[Math.floor(rand() * multi.length)];
      const ps = t.needs.filter((n) => ids.has(n));
      switchPrimary(o, t, ids, ps[Math.floor(rand() * ps.length)]);
    }
    for (let m = 0; m < moves && keys.length; m++) {
      const arr = o[keys[Math.floor(rand() * keys.length)]];
      const i = Math.floor(rand() * arr.length);
      const j = Math.floor(rand() * arr.length);
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    tryOrder(o);
  }
  return { order: bestOrder, score: bestScore };
}

/** 미리 골라 둔 순서와 목록이 같을 때만 씀 */
function savedOrder(list: Tech[]): Record<string, string[]> | null {
  const o = SKY_ORDER[list[0]?.line ?? 'mil'];
  if (!o) return null;
  const want = new Set(list.map((t) => t.id));
  const have = new Set(Object.entries(o).filter(([k]) => !k.startsWith('@')).flatMap(([, v]) => v));
  if (want.size !== have.size || [...want].some((x) => !have.has(x))) return null;
  // 주 선행이 실제 선행인지(데이터가 바뀌었으면 버림)
  const by = Object.fromEntries(list.map((t) => [t.id, t]));
  for (const [k, v] of Object.entries(o)) {
    if (k.startsWith('@')) {
      if (!by[k.slice(1)]?.needs.includes(v[0])) return null;
    } else for (const id of v) if (k === '' ? by[id].needs.some((n) => want.has(n)) : !by[id].needs.includes(k)) return null;
  }
  return o;
}

const cache = new Map<string, SkyLayout>();
/** 성좌판 배치. 미리 골라 둔 순서(techSkyOrder.ts)를 쓰고, 연구 목록이 바뀌었으면 그 자리에서 짧게 다시 고름 */
export function layoutSky(list: Tech[]): SkyLayout {
  const key = skyKey(list);
  const hit = cache.get(key);
  if (hit) return hit;
  const order = savedOrder(list) ?? optimizeSky(list, 120).order;
  const L = build(list, order);
  cache.set(key, L);
  return L;
}

/** 점들을 매끈한 SVG 길로 */
export function skyPath(pts: Array<[number, number]>): string {
  return pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x},${y}`).join(' ');
}

/** 시대 이름표 자리: 그 고리 위에서 별·선과 가장 먼 곳(위쪽 반을 먼저) */
export function eraLabelAt(L: SkyLayout, era: number): [number, number] {
  let best: [number, number] = xy(RING[era], 0);
  let bestD = -1;
  const ns = Object.values(L.nodes);
  for (let i = 0; i < 72; i++) {
    const a = (i / 72) * Math.PI * 2;
    const p = xy(RING[era], a);
    let d = Infinity;
    for (const n of ns) d = Math.min(d, Math.hypot((n.x - p[0]) * 0.55, n.y - p[1]));
    for (const e of L.edges) for (const q of e.pts) d = Math.min(d, Math.hypot((q[0] - p[0]) * 0.55, q[1] - p[1]) + 6);
    const sc = d + (Math.cos(a) > 0 ? 4 : 0);
    if (sc > bestD) (bestD = sc), (best = p);
  }
  return best;
}
