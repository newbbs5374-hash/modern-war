// 잠입 훈련 미니게임 3개
import { useMemo, useRef, useState } from 'react';
import { Rng } from '../../../game/rng';
import { Hud, Stage, clamp01, useLoop, useRng, type MiniProps } from './kit';

/* ── 그림자 길 찾기 ── */
const PC = 7;
const PR = 9;
const DIRS = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
];
interface PathMap {
  wall: boolean[];
  guards: Array<{ c: number; r: number; d: number; phase: number }>;
  goal: number;
  start: number;
}
function makePathMap(rng: Rng, level: number): PathMap {
  for (;;) {
    const wall = Array.from({ length: PC * PR }, (_, i) => i >= PC && i < PC * (PR - 1) && rng.chance(0.14));
    const start = PC * (PR - 1) + 3;
    const goal = Math.floor(rng.next() * PC);
    wall[start] = false;
    wall[goal] = false;
    // 길이 있는지
    const seen = new Set([start]);
    const q = [start];
    while (q.length) {
      const a = q.shift()!;
      const c = a % PC;
      const r = Math.floor(a / PC);
      for (const [dx, dy] of DIRS) {
        const nc = c + dx;
        const nr = r + dy;
        if (nc < 0 || nr < 0 || nc >= PC || nr >= PR) continue;
        const b = nr * PC + nc;
        if (wall[b] || seen.has(b)) continue;
        seen.add(b);
        q.push(b);
      }
    }
    if (!seen.has(goal)) continue;
    const n = Math.round(2 + (level - 1) * 2);
    const guards: PathMap['guards'] = [];
    let tries = 0;
    while (guards.length < n && tries++ < 200) {
      const c = Math.floor(rng.next() * PC);
      const r = 2 + Math.floor(rng.next() * (PR - 4));
      const i = r * PC + c;
      if (wall[i] || guards.some((g) => Math.abs(g.r - r) + Math.abs(g.c - c) < 3)) continue;
      guards.push({ c, r, d: Math.floor(rng.next() * 4), phase: rng.next() * 2 });
    }
    return { wall, guards, goal, start };
  }
}
function coneOf(m: PathMap, g: { c: number; r: number }, d: number): Set<number> {
  const out = new Set<number>();
  const [dx, dy] = DIRS[d];
  for (let k = 1; k <= 3; k++) {
    const cc = g.c + dx * k;
    const rr = g.r + dy * k;
    if (cc < 0 || rr < 0 || cc >= PC || rr >= PR || m.wall[rr * PC + cc]) break;
    out.add(rr * PC + cc);
    if (k >= 2) {
      // 옆으로 한 칸 퍼짐
      const sx = dy;
      const sy = dx;
      for (const s of [-1, 1]) {
        const c2 = cc + sx * s;
        const r2 = rr + sy * s;
        if (c2 >= 0 && r2 >= 0 && c2 < PC && r2 < PR && !m.wall[r2 * PC + c2]) out.add(r2 * PC + c2);
      }
    }
  }
  return out;
}
export function SneakPath({ level, seed, report, finish }: MiniProps) {
  const rng = useRng(seed);
  const MAPS = 2;
  const [mapNo, setMapNo] = useState(0);
  const maps = useMemo(() => Array.from({ length: MAPS }, () => makePathMap(rng, level)), [rng, level]);
  const m = maps[Math.min(mapNo, MAPS - 1)];
  const [pos, setPos] = useState(m.start);
  const [caught, setCaught] = useState(0);
  const [flash, setFlash] = useState(0);
  const t = useRef(0);
  const mt = useRef(0);
  const scores = useRef<number[]>([]);
  const [, tick] = useState(0);
  const period = 1.8 / level;
  const dirOf = (g: PathMap['guards'][number]) => (g.d + Math.floor((t.current + g.phase) / period)) % 4;
  const cones = new Set<number>();
  for (const g of m.guards) for (const i of coneOf(m, g, dirOf(g))) cones.add(i);
  useLoop((dt) => {
    t.current += dt;
    mt.current += dt;
    if (flash > 0) setFlash((f) => Math.max(0, f - dt));
    if (pos !== m.start && cones.has(pos)) {
      setCaught((c) => c + 1);
      setPos(m.start);
      setFlash(0.6);
    }
    tick((x) => x + 1);
  });
  const step = (i: number) => {
    const c = i % PC;
    const r = Math.floor(i / PC);
    const pc = pos % PC;
    const pr = Math.floor(pos / PC);
    if (Math.abs(c - pc) + Math.abs(r - pr) !== 1 || m.wall[i] || m.guards.some((g) => g.c === c && g.r === r)) return;
    setPos(i);
    if (i === m.goal) {
      const s = clamp01(1 - caught * 0.2 - Math.max(0, mt.current - 25) / 60);
      scores.current.push(s);
      const avg = scores.current.reduce((a, b) => a + b, 0) / MAPS;
      report(avg);
      if (mapNo + 1 >= MAPS) finish(avg);
      else {
        setMapNo(mapNo + 1);
        setPos(maps[mapNo + 1].start);
        setCaught(0);
        mt.current = 0;
      }
    }
  };
  return (
    <>
      <Hud items={[['지도', `${mapNo + 1}/${MAPS}`], ['들킴', caught]]} />
      <Stage ratio={PC / PR} className={flash > 0 ? 'mg-alarm' : ''}>
        <div className="mg-grid" style={{ gridTemplateColumns: `repeat(${PC}, 1fr)` }}>
          {m.wall.map((w, i) => {
            const c = i % PC;
            const r = Math.floor(i / PC);
            const g = m.guards.find((x) => x.c === c && x.r === r);
            const pc = pos % PC;
            const pr = Math.floor(pos / PC);
            const near = Math.abs(c - pc) + Math.abs(r - pr) === 1 && !w;
            return (
              <button key={i} className={`mg-cell ${w ? 'wall' : ''} ${cones.has(i) ? 'cone' : ''} ${near ? 'near' : ''}`} onClick={() => step(i)}>
                {w ? '📦' : g ? <span style={{ display: 'inline-block', transform: `rotate(${dirOf(g) * 90}deg)` }}>⬆️</span> : i === pos ? '🥷' : i === m.goal ? '🚩' : ''}
                {g && <i className="mg-guard">💂</i>}
              </button>
            );
          })}
        </div>
      </Stage>
    </>
  );
}

/* ── 탐조등 박자 ── */
export function SneakLight({ level, seed, report, finish }: MiniProps) {
  const rng = useRng(seed);
  const lights = useMemo(() => Array.from({ length: 3 }, (_, i) => ({ y: 20 + i * 27, speed: rng.range(0.6, 1.1) * level, ph: rng.next() * 6, w: rng.range(14, 20) })), [rng, level]);
  const s = useRef({ x: 4, hold: false, t: 0, spotted: 0, cool: 0, done: false });
  const [, tick] = useState(0);
  const LANE = 3;
  // 플레이어는 위아래로 지그재그로 세 줄을 지나감: x 0~100 × 3줄
  useLoop((dt) => {
    const st = s.current;
    if (st.done) return;
    st.t += dt;
    st.cool = Math.max(0, st.cool - dt);
    if (!st.hold) st.x += dt * 22;
    const lane = Math.min(LANE - 1, Math.floor(st.x / 100));
    const lx = st.x - lane * 100;
    const L = lights[lane];
    const cx = 50 + 45 * Math.sin(st.t * L.speed + L.ph);
    if (!st.hold && Math.abs(lx - cx) < L.w / 2 && st.cool <= 0) {
      st.spotted++;
      st.cool = 1;
      st.x = Math.max(lane * 100, st.x - 20);
    }
    const prog = Math.min(1, st.x / (LANE * 100));
    report(prog * clamp01(1 - st.spotted * 0.15));
    if (st.x >= LANE * 100) {
      st.done = true;
      finish(clamp01(1 - st.spotted * 0.15 - Math.max(0, st.t - 22) / 80));
    }
    tick((x) => x + 1);
  });
  const st = s.current;
  const lane = Math.min(LANE - 1, Math.floor(st.x / 100));
  return (
    <>
      <Hud items={[['들킴', st.spotted], ['진행', `${Math.round(Math.min(100, st.x / 3))}%`]]} />
      <Stage
        ratio={1}
        className={`mg-night ${st.cool > 0.6 ? 'mg-alarm' : ''}`}
        onPointerDown={() => (s.current.hold = true)}
        onPointerUp={() => (s.current.hold = false)}
      >
        {lights.map((L, i) => {
          const cx = 50 + 45 * Math.sin(st.t * L.speed + L.ph);
          return (
            <div key={i}>
              <div className="mg-lane" style={{ top: `${L.y}%` }} />
              <div className="mg-beam" style={{ top: `${L.y - 9}%`, left: `${cx - L.w / 2}%`, width: `${L.w}%` }} />
              <div className="mg-at" style={{ left: `${cx}%`, top: `${L.y - 14}%` }}>
                🔦
              </div>
            </div>
          );
        })}
        <div className="mg-at" style={{ left: `${st.x - lane * 100}%`, top: `${lights[lane].y}%`, fontSize: 24 }}>
          {st.hold ? '🧎' : '🏃'}
        </div>
        <div className="mg-at" style={{ left: '96%', top: `${lights[LANE - 1].y}%` }}>
          🚪
        </div>
        <div className="mg-tip">{st.hold ? '멈춤(숨는 중)' : '달리는 중 · 누르고 있으면 멈춰요'}</div>
      </Stage>
    </>
  );
}

/* ── 소리 없이 자물쇠 따기 ── */
export function SneakLock({ level, seed, report, finish }: MiniProps) {
  const rng = useRng(seed);
  const spots = useMemo(() => Array.from({ length: 3 }, () => Math.floor(rng.next() * 360)), [rng]);
  const [ang, setAng] = useState(0);
  const [pin, setPin] = useState(0);
  const [noise, setNoise] = useState(0);
  const [msg, setMsg] = useState('');
  const turn = useRef(0);
  const t0 = useRef(performance.now());
  useLoop((dt) => {
    if (turn.current) setAng((a) => (a + turn.current * dt * 90 + 360) % 360);
  });
  const tol = 9 / level;
  const target = spots[Math.min(pin, 2)];
  const diff = Math.min(Math.abs(ang - target), 360 - Math.abs(ang - target));
  const shake = Math.max(0, 1 - diff / 60);
  const click = () => {
    if (diff <= tol) {
      const np = pin + 1;
      setPin(np);
      setMsg('딸깍! 핀 하나가 올라갔어요.');
      const sc = clamp01((np / 3) * (1 - noise * 0.12));
      report(sc);
      if (np >= 3) finish(clamp01(1 - noise * 0.12 - Math.max(0, (performance.now() - t0.current) / 1000 - 35) / 80));
    } else {
      const n = noise + 1;
      setNoise(n);
      setMsg(diff < 30 ? '거의 다 왔어요… 소리가 났어요!' : '찰칵! 소리가 크게 났어요.');
      if (n >= 6) finish(clamp01((pin / 3) * 0.6));
    }
  };
  const hold = (d: number) => ({
    onPointerDown: () => (turn.current = d),
    onPointerUp: () => (turn.current = 0),
    onPointerLeave: () => (turn.current = 0),
  });
  return (
    <>
      <Hud items={[['핀', `${pin}/3`], ['소리', `${noise}/6`]]} />
      <Stage ratio={1} className="mg-metal">
        <div className="mg-dial" style={{ transform: `translate(-50%,-50%) rotate(${ang}deg) translateX(${(Math.random() - 0.5) * shake * 6}px)` }}>
          <i />
        </div>
        <div className="mg-at" style={{ left: '50%', top: '50%', fontSize: 34 }}>
          🔒
        </div>
        <div className="mg-meter" style={{ left: '10%', right: '10%', bottom: '8%' }}>
          <i style={{ width: `${shake * 100}%`, background: shake > 0.85 ? '#4ade80' : shake > 0.5 ? '#facc15' : '#94a3b8' }} />
        </div>
        <div className="mg-tip">떨림 {Math.round(shake * 100)}%</div>
      </Stage>
      <p className="small result">{msg || '◀ ▶을 누르고 있으면 돌아가요.'}</p>
      <div className="buttons">
        <button {...hold(-1)}>◀ 돌리기</button>
        <button className="primary" onClick={click}>
          딸깍
        </button>
        <button {...hold(1)}>돌리기 ▶</button>
      </div>
    </>
  );
}
