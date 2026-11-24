// 연구 카드 트리: 왼쪽(도약기) → 오른쪽(대양기)으로 이어지는 가로 스킬트리 배치.
// 열 = 시대 안에서 선행 깊이. 두 칸 넘게 건너뛰는 선은 사이 열에 "빈 길"을 두고 그 길로 지나감(카드를 가로지르지 않음).
// 한 열 안 순서는 선이 엇갈리지 않게 여러 번 고름(무게중심 쓸기 + 이웃 바꾸기, 정해진 씨앗이라 늘 같은 결과).
// 그리기 좌표만 계산(연구 규칙·저장은 그대로).
import type { Tech } from '../data/civ';

export const CARD_W = 132;
export const CARD_H = 46;
export const COL_GAP = 38;
export const PITCH = 54; // 카드 한 줄 높이(카드 + 틈)
const LANE = 0.45; // 빈 길이 차지하는 높이(줄 몫)

export interface CardNode {
  id: string;
  col: number;
  x: number; // 카드 왼쪽
  y: number; // 카드 가운데
}
export interface CardEdge {
  from: string;
  to: string;
  pts: Array<[number, number]>; // 오른쪽 끝 → (빈 길 들어가는 점, 나오는 점)… → 왼쪽 끝
}
export interface CardLayout {
  nodes: Record<string, CardNode>;
  edges: CardEdge[];
  cols: number;
  eras: Array<{ era: number; from: number; to: number }>;
  width: number;
  height: number;
  crossings: number;
  /** 열마다 위→아래 순서(빈 길 포함). 미리 골라 둘 때 씀 */
  order: string[][];
}

export const colX = (c: number) => c * (CARD_W + COL_GAP);

interface Item {
  id: string;
  real: boolean;
  h: number;
}

/** 0~1 정해진 난수 */
function rng(seed: number) {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

/** saved = 미리 골라 둔 열 안 순서(techCardOrder.ts). 연구 목록이 바뀌어 안 맞으면 그 자리에서 짧게(budget번) 다시 고름 */
export function layoutCards(list: Tech[], saved?: string[][], budget = 60000): CardLayout {
  const ids = new Set(list.map((t) => t.id));
  const byId = Object.fromEntries(list.map((t) => [t.id, t]));
  // 1) 열 정하기: 시대 순서, 같은 시대 안에서는 선행 다음 열
  const col: Record<string, number> = {};
  const eras: CardLayout['eras'] = [];
  let start = 0;
  for (const era of [...new Set(list.map((t) => t.era))].sort((a, b) => a - b)) {
    const inEra = list.filter((t) => t.era === era);
    let end = start;
    const get = (t: Tech, seen: Set<string> = new Set()): number => {
      if (col[t.id] != null) return col[t.id];
      if (seen.has(t.id)) return start;
      seen.add(t.id);
      let c = start;
      for (const n of t.needs) if (ids.has(n)) c = Math.max(c, get(byId[n], seen) + 1);
      return (col[t.id] = c);
    };
    for (const t of inEra) end = Math.max(end, get(t));
    eras.push({ era, from: start, to: end });
    start = end + 1;
  }
  const cols = start;
  // 2) 층 만들기(멀리 가는 선은 사이 열마다 빈 길)
  const layers: Item[][] = Array.from({ length: cols }, () => []);
  for (const t of list) layers[col[t.id]].push({ id: t.id, real: true, h: 1 });
  const links: Array<[string, string]> = []; // 이웃 열끼리 잇는 짧은 선
  const chains: Array<{ from: string; to: string; via: string[] }> = [];
  for (const t of list)
    for (const n of t.needs) {
      if (!ids.has(n)) continue;
      const via: string[] = [];
      let prev = n;
      for (let c = col[n] + 1; c < col[t.id]; c++) {
        const d = `${n}>${t.id}#${c}`;
        layers[c].push({ id: d, real: false, h: LANE });
        via.push(d);
        links.push([prev, d]);
        prev = d;
      }
      links.push([prev, t.id]);
      chains.push({ from: n, to: t.id, via });
    }
  const colOf = (id: string) => (col[id] != null ? col[id] : +id.split('#')[1]);
  const left: Record<string, string[]> = {};
  const right: Record<string, string[]> = {};
  for (const [a, b] of links) (right[a] ??= []).push(b), (left[b] ??= []).push(a);

  // 3) 열 안 순서: 엇갈림이 가장 적은 순서 찾기
  const pos: Record<string, number> = {};
  const setPos = (ls: Item[][]) => ls.forEach((l) => l.forEach((it, i) => (pos[it.id] = i)));
  const crossAt = (ls: Item[][], c: number) => {
    const es: Array<[number, number]> = [];
    for (const it of ls[c]) for (const b of right[it.id] ?? []) es.push([pos[it.id], pos[b]]);
    let x = 0;
    for (let i = 0; i < es.length; i++)
      for (let j = i + 1; j < es.length; j++) if ((es[i][0] - es[j][0]) * (es[i][1] - es[j][1]) < 0) x++;
    return x;
  };
  const crossAll = (ls: Item[][]) => {
    setPos(ls);
    let x = 0;
    for (let c = 0; c < cols - 1; c++) x += crossAt(ls, c);
    return x;
  };
  const sweep = (ls: Item[][], dir: 1 | -1) => {
    const order = dir === 1 ? [...Array(cols).keys()].slice(1) : [...Array(cols).keys()].reverse().slice(1);
    for (const c of order) {
      setPos(ls);
      const nb = dir === 1 ? left : right;
      const bary = (it: Item, i: number) => {
        const ns = nb[it.id] ?? [];
        return ns.length ? ns.reduce((a, n) => a + pos[n], 0) / ns.length : i - 0.01;
      };
      const keyed = ls[c].map((it, i) => ({ it, k: bary(it, i), i }));
      // 이웃이 없는 카드는 제자리 근처에 둠
      keyed.sort((a, b) => a.k - b.k || a.i - b.i);
      ls[c] = keyed.map((k) => k.it);
    }
  };
  let best = layers.map((l) => [...l]);
  let bestX = crossAll(best);
  const r = rng(20261124);
  const flat = (ls: Array<Array<{ id: string }> | string[]>) => ls.map((l) => l.map((q) => (typeof q === 'string' ? q : q.id)).sort().join()).join('|');
  if (saved && saved.length === cols && flat(saved) === flat(layers)) {
    const it = Object.fromEntries(layers.flat().map((q) => [q.id, q]));
    best = saved.map((l) => l.map((id) => it[id]));
    bestX = crossAll(best);
  }
  for (let round = 0; round < 12 && bestX > 0; round++) {
    const ls = best.map((l) => [...l]);
    if (round > 0) for (const l of ls) l.sort(() => r() - 0.5);
    for (let k = 0; k < 8; k++) {
      sweep(ls, 1);
      sweep(ls, -1);
      const x = crossAll(ls);
      if (x < bestX) (bestX = x), (best = ls.map((l) => [...l]));
      if (!x) break;
    }
  }
  // 남은 엇갈림은 한 카드씩 옮겨 보며 줄임(처음엔 조금 나빠지는 것도 받아들여 막힌 곳을 빠져나옴)
  if (bestX > 0) {
    const ls = best.map((l) => [...l]);
    let cur = crossAll(ls);
    const local = (c: number) => (c > 0 ? crossAt(ls, c - 1) : 0) + (c < cols - 1 ? crossAt(ls, c) : 0);
    const fix = (c: number) => ls[c].forEach((it, i) => (pos[it.id] = i));
    for (let k = 0, N = budget; k < N && cur > 0; k++) {
      const T = 1.5 * (1 - k / N) + 0.02;
      const c = Math.floor(r() * cols);
      const l = ls[c];
      if (l.length < 2) continue;
      const i = Math.floor(r() * l.length);
      const j = Math.floor(r() * l.length);
      if (i === j) continue;
      const before = local(c);
      const [it] = l.splice(i, 1);
      l.splice(j, 0, it);
      fix(c);
      const after = local(c);
      if (after <= before || r() < Math.exp((before - after) / T)) {
        cur += after - before;
        if (cur < bestX) (bestX = cur), (best = ls.map((q) => [...q]));
      } else {
        l.splice(j, 1);
        l.splice(i, 0, it);
        fix(c);
      }
    }
  }

  // 4) 높이: 이웃과 높이를 맞추되 순서·간격은 지킴(쌓아 맞추기)
  const y: Record<string, number> = {};
  best.forEach((l) => {
    let acc = 0;
    l.forEach((it, i) => {
      if (i) acc += (l[i - 1].h + it.h) / 2;
      y[it.id] = acc;
    });
  });
  const place = (l: Item[], want: number[]) => {
    // 간격 조건 y[i] >= y[i-1] + gap → z = y - off 가 오름차순이 되게(풀 합치기)
    const off: number[] = [];
    l.forEach((it, i) => (off[i] = i ? off[i - 1] + (l[i - 1].h + it.h) / 2 : 0));
    const blocks: Array<{ sum: number; n: number; from: number }> = [];
    want.forEach((w, i) => {
      blocks.push({ sum: w - off[i], n: 1, from: i });
      while (blocks.length > 1 && blocks[blocks.length - 2].sum / blocks[blocks.length - 2].n > blocks[blocks.length - 1].sum / blocks[blocks.length - 1].n) {
        const b = blocks.pop()!;
        blocks[blocks.length - 1].sum += b.sum;
        blocks[blocks.length - 1].n += b.n;
      }
    });
    for (const b of blocks) for (let i = b.from; i < b.from + b.n; i++) y[l[i].id] = b.sum / b.n + off[i];
  };
  for (let k = 0; k < 30; k++) {
    const cs = k % 2 ? [...Array(cols).keys()].reverse() : [...Array(cols).keys()];
    for (const c of cs) {
      const l = best[c];
      place(
        l,
        l.map((it) => {
          const ns = [...(left[it.id] ?? []), ...(right[it.id] ?? [])];
          // 빈 길은 곧게 가도록 무게를 더 줌
          if (!ns.length) return y[it.id];
          let s = 0, w = 0;
          for (const n of ns) {
            const ww = it.real && best[colOf(n)].find((q) => q.id === n)?.real ? 1 : 2;
            s += y[n] * ww;
            w += ww;
          }
          return s / w;
        }),
      );
    }
  }
  // 반 줄 단위로 맞추고 간격 다시 지킴
  for (const l of best) {
    let prev = -Infinity;
    l.forEach((it, i) => {
      const gap = i ? (l[i - 1].h + it.h) / 2 : 0;
      const v = Math.max(Math.round(y[it.id] * 2) / 2, i ? prev + gap : -Infinity);
      y[it.id] = v;
      prev = v;
    });
  }
  const minY = Math.min(...Object.values(y));
  const maxY = Math.max(...Object.values(y));
  const Y = (id: string) => (y[id] - minY) * PITCH + PITCH / 2;
  const nodes: Record<string, CardNode> = {};
  for (const t of list) nodes[t.id] = { id: t.id, col: col[t.id], x: colX(col[t.id]), y: Y(t.id) };
  const edges: CardEdge[] = chains.map(({ from, to, via }) => {
    const pts: Array<[number, number]> = [[colX(col[from]) + CARD_W, Y(from)]];
    for (const d of via) {
      const c = colOf(d);
      pts.push([colX(c), Y(d)], [colX(c) + CARD_W, Y(d)]);
    }
    pts.push([colX(col[to]), Y(to)]);
    return { from, to, pts };
  });
  return {
    nodes,
    edges,
    cols,
    eras,
    width: colX(cols - 1) + CARD_W,
    height: (maxY - minY) * PITCH + PITCH,
    crossings: bestX,
    order: best.map((l) => l.map((q) => q.id)),
  };
}

/** 점들을 잇는 선: 열 사이 틈에서는 S자 곡선, 빈 길에서는 곧은 가로선 */
export function cardPath(pts: Array<[number, number]>): string {
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1];
    const [x1, y1] = pts[i];
    if (y0 === y1) d += ` L${x1},${y1}`;
    else {
      const m = (x1 - x0) / 2;
      d += ` C${x0 + m},${y0} ${x1 - m},${y1} ${x1},${y1}`;
    }
  }
  return d;
}
