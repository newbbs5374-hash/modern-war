// 땅(도·주·성) 주인: 도시 주인 + "출발 도시 → 점령한 도시" 길목.
// 11/24 대장 요청: 주요 도시만 공격하면, 전투를 시작한 곳부터 점령한 도시까지의 땅을 얻고 색으로 보인다.
// 저장은 w.via(점령한 도시 → 출발 도시)만. 나머지는 매번 계산(옛 저장도 그대로 동작).
import { CITIES, type City } from '../data/cities';
import { GEO_PROVS } from '../data/provinces';
import { KR_PROVINCES } from '../data/krProvinces';
import type { WorldState } from './world';

export interface Prov {
  id: string;
  /** 처음 나라 */
  c: string;
  name: string;
  /** 이름 자리 */
  x: number;
  y: number;
  /** 넓이(지도 px²) */
  a: number;
  d: string;
  /** 다스리는 도시(그 나라 도시 가운데 안에 있거나 가장 가까운 것) */
  seat: string;
  /** 땅 모양(점 목록 여러 개) */
  rings: number[][][];
}

function parseRings(d: string): number[][][] {
  const out: number[][][] = [];
  for (const seg of d.split('M')) {
    if (!seg.trim()) continue;
    const pts: number[][] = [];
    const re = /(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(seg))) pts.push([+m[1], +m[2]]);
    if (pts.length >= 3) out.push(pts);
  }
  return out;
}
function ringArea(r: number[][]): number {
  let a = 0;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) a += r[j][0] * r[i][1] - r[i][0] * r[j][1];
  return Math.abs(a) / 2;
}
function inRing(x: number, y: number, r: number[][]): boolean {
  let c = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const [xi, yi] = r[i];
    const [xj, yj] = r[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}
export const inProv = (p: Prov, x: number, y: number) => p.rings.some((r) => inRing(x, y, r));

function build(): Prov[] {
  const raw = [
    ...GEO_PROVS.map((p) => ({ ...p })),
    ...KR_PROVINCES.map((p) => ({ c: 'kr', name: p.name, x: p.x, y: p.y, a: 0, d: p.d })),
  ];
  const counts: Record<string, number> = {};
  const list: Prov[] = raw.map((p) => {
    const rings = parseRings(p.d);
    const n = (counts[p.c] = (counts[p.c] ?? 0) + 1);
    return { ...p, id: `${p.c}-p${n - 1}`, a: p.a || rings.reduce((s, r) => s + ringArea(r), 0), seat: '', rings };
  });
  for (const p of list) {
    const home = CITIES.filter((c) => c.home === p.c);
    const inside = home.find((c) => inProv(p, c.x, c.y));
    const near = (c: City) => Math.hypot(c.x - p.x, c.y - p.y);
    // 도시가 없는 도는 가장 가까운 점령 도시(거점)가 다스림(11-25)
    const fronts = home.filter((c) => c.front);
    p.seat = (inside ?? (fronts.length ? fronts : home).slice().sort((a, b) => near(a) - near(b))[0])?.id ?? '';
  }
  // 도시가 들어 있는 도는 반드시 그 도시가 다스림(위에서 가까운 도시로 잡혔어도)
  for (const c of CITIES) {
    const p = list.find((q) => q.c === c.home && inProv(q, c.x, c.y));
    if (p) p.seat = c.id;
  }
  return list;
}

let PROVS_CACHE: Prov[] | null = null;
export function provinces(): Prov[] {
  return (PROVS_CACHE ??= build());
}
export const provincesOf = (countryId: string) => provinces().filter((p) => p.c === countryId);

/** 공격 출발 도시: 공격국이 가진 도시 가운데 목표에 가장 가까운 곳 */
export function startCity(w: WorldState, att: string, target: string): string | null {
  const t = CITIES.find((c) => c.id === target);
  if (!t) return null;
  let best: string | null = null;
  let bd = Infinity;
  for (const c of CITIES) {
    if (c.id === target || w.owner[c.id] !== att) continue;
    const d = Math.hypot(c.x - t.x, c.y - t.y);
    if (d < bd) {
      bd = d;
      best = c.id;
    }
  }
  return best;
}

/** 도시를 차지할 때 부름: 출발 도시를 적어 둠(되찾으면 지움) */
export function noteCapture(w: WorldState, target: string, att: string): void {
  const via = { ...(w.via ?? {}) };
  const home = CITIES.find((c) => c.id === target)?.home;
  if (att === home) delete via[target];
  else {
    const s = startCity(w, att, target);
    if (s) via[target] = s;
  }
  w.via = via;
  // 주인이 바뀌면 편입 진행·편입 기록은 끝남(되찾기·반란·다른 나라 점령 모두)
  if (w.annex?.[target]) {
    const { [target]: _a, ...rest } = w.annex;
    w.annex = rest;
  }
  if (w.annexed?.[target]) {
    const { [target]: _b, ...rest } = w.annexed;
    w.annexed = rest;
  }
}

/** 편입한 도시가 다스리는 도(빗금 없이 그 나라 땅처럼 그림) */
export function annexedProv(w: WorldState, p: Prov, landOwner: string): boolean {
  return !!p.seat && w.annexed?.[p.seat] === landOwner;
}

/** 길목 너비(지도 px): 1도 = 6px → 약 2도 */
const LANE = 12;

/** 점 p가 선분 a→b 위(양 끝 사이, 너비 안)인가 */
function onLane(px: number, py: number, ax: number, ay: number, bx: number, by: number, w: number): boolean {
  const dx = bx - ax;
  const dy = by - ay;
  const L2 = dx * dx + dy * dy || 1;
  const t = ((px - ax) * dx + (py - ay) * dy) / L2;
  if (t < 0 || t > 1) return false;
  return Math.hypot(ax + dx * t - px, ay + dy * t - py) <= w;
}

const OWN_CACHE = { key: '', v: {} as Record<string, string> };
/** 도 id → 지금 주인 */
export function landOwners(w: WorldState): Record<string, string> {
  const key = JSON.stringify(w.owner) + JSON.stringify(w.via ?? {});
  if (OWN_CACHE.key === key) return OWN_CACHE.v;
  const out: Record<string, string> = {};
  const ps = provinces();
  for (const p of ps) out[p.id] = w.owner[p.seat] ?? p.c;
  // 점령한 도시마다 출발 도시 → 그 도시 길목의 땅(그 도시 나라 땅만)
  const byId = new Map(CITIES.map((c) => [c.id, c]));
  for (const c of CITIES) {
    const occ = w.owner[c.id];
    if (occ === c.home) continue;
    let fromId = w.via?.[c.id];
    if (!fromId || w.owner[fromId] !== occ) fromId = startCity(w, occ, c.id) ?? undefined;
    const from = fromId ? byId.get(fromId) : undefined;
    if (!from) continue;
    for (const p of ps) {
      if (p.c !== c.home) continue;
      // 그 나라가 아직 도청 도시를 가진 도는 길목일 때만, 다른 점령국 땅은 그대로
      if (out[p.id] !== c.home) continue;
      const hit =
        onLane(p.x, p.y, from.x, from.y, c.x, c.y, LANE) ||
        // 큰 도: 선이 도 안을 지나가면
        Array.from({ length: 12 }, (_, i) => (i + 0.5) / 12).some((t) => inProv(p, from.x + (c.x - from.x) * t, from.y + (c.y - from.y) * t));
      // 수도·다른 도시가 들어 있는 도는 그 도시를 점령해야 넘어감
      if (hit && !(byId.get(p.seat)?.home === c.home && w.owner[p.seat] === c.home && inProv(p, byId.get(p.seat)!.x, byId.get(p.seat)!.y))) out[p.id] = occ;
    }
  }
  OWN_CACHE.key = key;
  OWN_CACHE.v = out;
  return out;
}

/** 나라가 가진 도 수 */
export function landCount(w: WorldState, countryId: string): number {
  return Object.values(landOwners(w)).filter((o) => o === countryId).length;
}
