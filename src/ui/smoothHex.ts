/**
 * 육각 칸의 변(선분)들을 이어 곡선 경로로 바꿔 준다.
 * 규칙(칸 판정)은 육각 그대로 두고, 화면에서만 해안선·경계선이 계단 모양으로 보이지 않게 한다.
 */
type P = [number, number];
export type Seg = [P, P];

const key = (p: P) => `${Math.round(p[0] * 10)},${Math.round(p[1] * 10)}`;
const mid = (a: P, b: P): P => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];

/** 선분들을 끝점끼리 이어 줄(열린 줄 또는 닫힌 고리)로 묶는다 */
export function chain(segs: Seg[]): { pts: P[]; closed: boolean }[] {
  const at = new Map<string, number[]>();
  segs.forEach(([a, b], i) => {
    for (const p of [a, b]) {
      const k = key(p);
      const l = at.get(k);
      if (l) l.push(i);
      else at.set(k, [i]);
    }
  });
  const used = new Array(segs.length).fill(false);
  const next = (p: P): number | undefined => at.get(key(p))?.find((i) => !used[i]);
  const out: { pts: P[]; closed: boolean }[] = [];
  // 열린 줄은 끝(이어진 선분이 하나뿐인 점)에서 시작
  const order = segs.map((_, i) => i).sort((i, j) => {
    const ends = (n: number) => Number((at.get(key(segs[n][0]))?.length ?? 0) === 1 || (at.get(key(segs[n][1]))?.length ?? 0) === 1);
    return ends(j) - ends(i);
  });
  for (const s of order) {
    if (used[s]) continue;
    used[s] = true;
    let [a, b] = segs[s];
    if ((at.get(key(a))?.length ?? 0) !== 1 && (at.get(key(b))?.length ?? 0) === 1) [a, b] = [b, a];
    const pts: P[] = [a, b];
    let cur = b;
    for (;;) {
      const n = next(cur);
      if (n === undefined) break;
      used[n] = true;
      const [p, q] = segs[n];
      cur = key(p) === key(cur) ? q : p;
      pts.push(cur);
    }
    const closed = pts.length > 3 && key(pts[0]) === key(pts[pts.length - 1]);
    if (closed) pts.pop();
    out.push({ pts, closed });
  }
  return out;
}

/** 모서리 깎기(Chaikin). 열린 줄은 양 끝을 그대로 둔다 */
function chaikin(pts: P[], closed: boolean, n: number): P[] {
  let p = pts;
  for (let it = 0; it < n; it++) {
    const q: P[] = closed ? [] : [p[0]];
    const m = closed ? p.length : p.length - 1;
    for (let i = 0; i < m; i++) {
      const a = p[i];
      const b = p[(i + 1) % p.length];
      q.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
    }
    if (!closed) q.push(p[p.length - 1]);
    p = q;
  }
  return p;
}

/** 모양을 줄이지 않고 다듬기(Taubin). 열린 줄은 양 끝을 고정 */
function relax(pts: P[], closed: boolean, n: number): P[] {
  let p = pts;
  const step = (f: number) => {
    const q = p.map((v, i): P => {
      if (!closed && (i === 0 || i === p.length - 1)) return v;
      const a = p[(i - 1 + p.length) % p.length];
      const b = p[(i + 1) % p.length];
      return [v[0] + f * ((a[0] + b[0]) / 2 - v[0]), v[1] + f * ((a[1] + b[1]) / 2 - v[1])];
    });
    p = q;
  };
  for (let i = 0; i < n; i++) {
    step(0.6);
    step(-0.62);
  }
  return p;
}

/** 해안이 너무 매끈하지 않게 바깥·안쪽으로 살짝 굽이치게(같은 지도면 늘 같은 모양) */
function wiggle(pts: P[], amp: number): P[] {
  if (amp <= 0) return pts;
  const n = pts.length;
  return pts.map((v, i) => {
    const a = pts[(i - 1 + n) % n];
    const b = pts[(i + 1) % n];
    const tx = b[0] - a[0];
    const ty = b[1] - a[1];
    const l = Math.hypot(tx, ty) || 1;
    const s = v[0] * 0.071 + v[1] * 0.053;
    const w = Math.sin(s) * 0.6 + Math.sin(s * 2.7 + 1.3) * 0.3 + Math.sin(s * 6.1 + 4.2) * 0.1;
    return [v[0] + (ty / l) * amp * w, v[1] - (tx / l) * amp * w];
  });
}

export interface SmoothOpts {
  /** 큰 모양 다듬기 횟수(클수록 둥글게). 0이면 칸 계단만 없앰 */
  relax?: number;
  /** 해안 굽이 크기(픽셀). 닫힌 고리에만 */
  wiggle?: number;
  /** 마지막 모서리 깎기 횟수 */
  round?: number;
}

/** 육각 변 → 부드러운 곡선 경로(d). 변의 가운데점을 이어서 지그재그를 없앤 뒤 둥글게 깎는다 */
export function smoothPath(segs: Seg[], opts: SmoothOpts = {}): string {
  const { relax: rn = 0, wiggle: amp = 0, round = 3 } = opts;
  let d = '';
  for (const { pts, closed } of chain(segs)) {
    let ctrl: P[];
    if (closed) ctrl = pts.map((p, i) => mid(p, pts[(i + 1) % pts.length]));
    else ctrl = [pts[0], ...pts.slice(0, -1).map((p, i) => mid(p, pts[i + 1])), pts[pts.length - 1]];
    if (ctrl.length < 2) continue;
    // 작은 섬은 덜 다듬어 사라지지 않게
    const r = closed ? Math.min(rn, ctrl.length * 2) : rn;
    ctrl = relax(ctrl, closed, r);
    if (closed) ctrl = wiggle(ctrl, amp * Math.min(1, ctrl.length / 24));
    const s = chaikin(ctrl, closed, round);
    d += 'M' + s.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join('L') + (closed ? 'Z' : '');
  }
  return d;
}
