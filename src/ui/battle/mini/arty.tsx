// 포격 훈련 미니게임 3개
import { useMemo, useRef, useState } from 'react';
import { Hud, Stage, clamp01, pctOf, useLoop, useRng, type MiniProps } from './kit';

const GROUND = 85;

/* ── 당겨서 쏘기 ── */
export function ArtyPull({ level, seed, report, finish }: MiniProps) {
  const rng = useRng(seed);
  const SHOTS = 5;
  const rounds = useMemo(() => Array.from({ length: SHOTS }, () => ({ tx: rng.range(45, 92), wind: rng.range(-1, 1) * 8 * level })), [rng, level]);
  const s = useRef({ shot: 0, pts: 0, drag: null as null | { x: 0 | number; y: number; cx: number; cy: number }, ball: null as null | { x: number; y: number; vx: number; vy: number }, marks: [] as Array<{ x: number; ok: number }> });
  const [, tick] = useState(0);
  const stage = useRef<HTMLDivElement>(null);
  const st = s.current;
  const cur = rounds[Math.min(st.shot, SHOTS - 1)];
  useLoop((dt) => {
    const b = st.ball;
    if (b) {
      b.vy += 60 * dt;
      b.vx += cur.wind * dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.y >= GROUND || b.x > 105 || b.x < -5) {
        const d = Math.abs(b.x - cur.tx);
        const ok = d < 3 ? 1 : d < 7 ? 0.5 : 0;
        st.pts += ok;
        st.marks.push({ x: b.x, ok });
        st.ball = null;
        st.shot++;
        report(st.pts / SHOTS);
        if (st.shot >= SHOTS) setTimeout(() => finish(st.pts / SHOTS), 500);
      }
    }
    tick((x) => x + 1);
  });
  const vel = (d: NonNullable<typeof st.drag>) => {
    const dx = d.x - d.cx;
    const dy = d.y - d.cy;
    const k = Math.min(1, Math.hypot(dx, dy) / 35);
    const a = Math.atan2(-dy, dx);
    return { vx: Math.cos(a) * k * 105, vy: -Math.sin(a) * k * 105, k, a };
  };
  return (
    <>
      <Hud items={[['탄', `${Math.max(0, SHOTS - st.shot)}/${SHOTS}`], ['바람', `${cur.wind < 0 ? '←' : '→'} ${Math.abs(Math.round(cur.wind))}`], ['점수', st.pts]]} />
      <Stage
        ratio={1.6}
        className="mg-sky"
        stageRef={stage}
        onPointerDown={(e) => {
          if (st.ball || st.shot >= SHOTS) return;
          const p = pctOf(e, stage.current);
          st.drag = { x: p.x, y: p.y, cx: p.x, cy: p.y };
        }}
        onPointerMove={(e) => {
          if (!st.drag) return;
          const p = pctOf(e, stage.current);
          st.drag.cx = p.x;
          st.drag.cy = p.y;
        }}
        onPointerUp={() => {
          const d = st.drag;
          st.drag = null;
          if (!d) return;
          const v = vel(d);
          if (v.k < 0.1 || v.vy > 0) return;
          st.ball = { x: 8, y: GROUND - 3, vx: v.vx, vy: v.vy };
        }}
      >
        <div className="mg-ground" />
        <div className="mg-at" style={{ left: '8%', top: `${GROUND - 3}%`, fontSize: 26 }}>
          🛡️
        </div>
        <div className="mg-at" style={{ left: `${cur.tx}%`, top: `${GROUND - 3}%`, fontSize: 24 }}>
          🛖
        </div>
        {st.marks.slice(-1).map((m, i) => (
          <div key={i} className="mg-at" style={{ left: `${m.x}%`, top: `${GROUND - 4}%`, fontSize: 22 }}>
            {m.ok ? '💥' : '💨'}
          </div>
        ))}
        {st.ball && (
          <div className="mg-at" style={{ left: `${st.ball.x}%`, top: `${st.ball.y}%`, fontSize: 12 }}>
            ●
          </div>
        )}
        {st.drag &&
          (() => {
            const v = vel(st.drag);
            // 앞부분 궤적만 살짝(끝까지는 안 보여 줌)
            return Array.from({ length: 6 }, (_, i) => {
              const t = (i + 1) * 0.06;
              return <div key={i} className="mg-dot" style={{ left: `${8 + v.vx * t}%`, top: `${GROUND - 3 + v.vy * t + 30 * t * t}%` }} />;
            });
          })()}
        <div className="mg-tip">아무 데나 누르고 뒤로(왼쪽 아래) 당겼다 놓아요</div>
      </Stage>
    </>
  );
}

/* ── 관측병 수정 사격 ── */
export function ArtyAdjust({ level, seed, report, finish }: MiniProps) {
  const rng = useRng(seed);
  const N = 3;
  const targets = useMemo(() => Array.from({ length: N }, () => ({ dist: Math.round(rng.range(900, 2400) / 10) * 10, side: Math.round(rng.range(-500, 500) / 10) * 10 })), [rng]);
  const [no, setNo] = useState(0);
  const [dist, setDist] = useState(1500);
  const [side, setSide] = useState(0);
  const [shots, setShots] = useState(0);
  const [log, setLog] = useState<string[]>([]);
  const [imp, setImp] = useState<Array<{ d: number; s: number }>>([]);
  const total = useRef(0);
  const t = targets[Math.min(no, N - 1)];
  const fire = () => {
    const spread = 25 * level;
    const d = dist + rng.range(-spread, spread);
    const sd = side + rng.range(-spread, spread);
    const dd = t.dist - d;
    const ds = t.side - sd;
    const n = shots + 1;
    setShots(n);
    setImp([...imp, { d, s: sd }]);
    if (Math.hypot(dd, ds) < 60) {
      const sc = clamp01(1 - (n - 1) * 0.18);
      total.current += sc;
      report(total.current / N);
      setLog([`🎯 명중! ${n}발 만에 · ${Math.round(sc * 100)}점`, ...log]);
      if (no + 1 >= N) return setTimeout(() => finish(total.current / N), 700);
      setNo(no + 1);
      setShots(0);
      setImp([]);
      return;
    }
    const r50 = (x: number) => Math.round(Math.abs(x) / 50) * 50;
    const a = ds === 0 ? '' : `${ds < 0 ? '왼쪽' : '오른쪽'} ${r50(ds)}`;
    const b = `${dd > 0 ? '더 멀리' : '더 가까이'} ${r50(dd)}`;
    setLog([`📻 관측병: "${[a, b].filter(Boolean).join(', ')}"`, ...log].slice(0, 4));
    if (n >= 7) {
      setLog([`표적을 놓쳤어요`, ...log]);
      if (no + 1 >= N) return finish(total.current / N);
      setNo(no + 1);
      setShots(0);
      setImp([]);
    }
  };
  const Dial = ({ label, v, set, step, min, max }: { label: string; v: number; set: (x: number) => void; step: number; min: number; max: number }) => (
    <div className="mg-dialrow">
      <small>{label}</small>
      <button onClick={() => set(Math.max(min, v - step * 2))}>−−</button>
      <button onClick={() => set(Math.max(min, v - step))}>−</button>
      <b>{v}m</b>
      <button onClick={() => set(Math.min(max, v + step))}>+</button>
      <button onClick={() => set(Math.min(max, v + step * 2))}>++</button>
    </div>
  );
  return (
    <>
      <Hud items={[['표적', `${no + 1}/${N}`], ['쏜 탄', shots]]} />
      <Stage ratio={1.5} className="mg-map">
        <div className="mg-at" style={{ left: '50%', top: '92%' }}>
          🛡️
        </div>
        {imp.map((p, i) => (
          <div key={i} className="mg-at" style={{ left: `${50 + (p.s / 700) * 50}%`, top: `${92 - (p.d / 2600) * 85}%`, fontSize: 14, opacity: 0.4 + (i / imp.length) * 0.6 }}>
            💥
          </div>
        ))}
        <div className="mg-at" style={{ left: `${50 + (side / 700) * 50}%`, top: `${92 - (dist / 2600) * 85}%`, fontSize: 18 }}>
          ⊕
        </div>
        <div className="mg-tip">표적은 안개 속에 있어요. 관측병 말을 듣고 고쳐요</div>
      </Stage>
      <Dial label="거리" v={dist} set={setDist} step={50} min={500} max={2600} />
      <Dial label="좌우" v={side} set={setSide} step={50} min={-700} max={700} />
      <button className="primary wide" onClick={fire}>
        💥 발사
      </button>
      {log.map((l, i) => (
        <p key={i} className={`small ${i ? 'muted' : 'result'}`}>
          {l}
        </p>
      ))}
    </>
  );
}

/* ── 움직이는 대열 끊기 ── */
export function ArtyLead({ level, seed, report, finish }: MiniProps) {
  const rng = useRng(seed);
  const SHELLS = 6;
  const DELAY = 2;
  const cars = useMemo(() => {
    const out: Array<{ at: number; speed: number; y: number; dead: boolean }> = [];
    for (let w = 0; w < 2; w++) {
      const speed = rng.range(9, 14) * level;
      const y = w === 0 ? 38 : 66;
      for (let k = 0; k < 5; k++) out.push({ at: 1 + w * 12 + k * (8 / speed), speed, y, dead: false });
    }
    return out;
  }, [rng, level]);
  const s = useRef({ t: 0, shells: [] as Array<{ x: number; y: number; land: number; done: boolean }>, kills: 0, over: false });
  const [, tick] = useState(0);
  const stage = useRef<HTMLDivElement>(null);
  const px = (c: (typeof cars)[number], t: number) => 105 - (t - c.at) * c.speed;
  useLoop((dt) => {
    const st = s.current;
    if (st.over) return;
    st.t += dt;
    for (const b of st.shells) {
      if (b.done || st.t < b.land) continue;
      b.done = true;
      for (const c of cars) if (!c.dead && st.t > c.at && Math.abs(px(c, st.t) - b.x) < 6 && Math.abs(c.y - b.y) < 8) {
        c.dead = true;
        st.kills++;
      }
    }
    const sc = clamp01(st.kills / 8);
    report(sc);
    const allGone = cars.every((c) => c.dead || px(c, st.t) < -5);
    if (allGone || (st.shells.length >= SHELLS && st.shells.every((b) => b.done))) {
      st.over = true;
      finish(sc);
    }
    tick((x) => x + 1);
  });
  const st = s.current;
  return (
    <>
      <Hud items={[['포탄', `${SHELLS - st.shells.length}/${SHELLS}`], ['격파', `${st.kills}/10`]]} />
      <Stage
        ratio={1.4}
        className="mg-map"
        stageRef={stage}
        onPointerDown={(e) => {
          if (st.shells.length >= SHELLS) return;
          const p = pctOf(e, stage.current);
          st.shells.push({ x: p.x, y: p.y, land: st.t + DELAY, done: false });
        }}
      >
        <div className="mg-road" style={{ top: '38%' }} />
        <div className="mg-road" style={{ top: '66%' }} />
        {cars.map((c, i) => {
          const x = px(c, st.t);
          if (st.t < c.at || x < -6 || (c.dead && st.t > c.at + 40)) return null;
          return (
            <div key={i} className="mg-at" style={{ left: `${x}%`, top: `${c.y}%`, fontSize: 20 }}>
              {c.dead ? '🔥' : '🚚'}
            </div>
          );
        })}
        {st.shells.map((b, i) =>
          st.t - b.land < 0.5 ? (
            <div key={i} className="mg-at" style={{ left: `${b.x}%`, top: `${b.y}%`, fontSize: b.done ? 26 : 14 }}>
              {b.done ? '💥' : <span className="mg-count">{Math.max(0, b.land - st.t).toFixed(1)}</span>}
            </div>
          ) : null,
        )}
      </Stage>
    </>
  );
}
