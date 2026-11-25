// 사격 훈련 미니게임 3개
import { useMemo, useRef, useState } from 'react';
import { Hud, Stage, clamp01, pctOf, useLoop, useRng, type MiniProps } from './kit';

/* ── 튀어나오는 표적 ── */
export function ShootPopup({ level, seed, report, finish }: MiniProps) {
  const rng = useRng(seed);
  const N = 30;
  const plan = useMemo(() => {
    let t = 0.8;
    return Array.from({ length: N }, () => {
      t += rng.range(0.6, 1.3) / level;
      return { at: t, win: Math.floor(rng.next() * 9), foe: rng.chance(0.72), life: rng.range(0.9, 1.4) / level, state: '' as '' | 'hit' | 'gone' | 'bad' };
    });
  }, [rng, level]);
  const s = useRef({ t: 0, hit: 0, bad: 0, over: false });
  const [, tick] = useState(0);
  const foes = plan.filter((p) => p.foe).length;
  const sc = () => clamp01((s.current.hit - s.current.bad * 2) / foes);
  useLoop((dt) => {
    const st = s.current;
    if (st.over) return;
    st.t += dt;
    for (const p of plan) if (!p.state && st.t > p.at + p.life) p.state = 'gone';
    report(sc());
    if (plan.every((p) => p.state)) {
      st.over = true;
      finish(sc());
    }
    tick((x) => x + 1);
  });
  const tap = (w: number) => {
    const p = plan.find((x) => x.win === w && !x.state && s.current.t >= x.at);
    if (!p) return;
    if (p.foe) {
      p.state = 'hit';
      s.current.hit++;
    } else {
      p.state = 'bad';
      s.current.bad++;
    }
  };
  const t = s.current.t;
  return (
    <>
      <Hud items={[['명중', `${s.current.hit}/${foes}`], ['민간인 오사', s.current.bad]]} />
      <Stage ratio={1} className="mg-city">
        <div className="mg-grid gap" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
          {Array.from({ length: 9 }, (_, w) => {
            const p = plan.find((x) => x.win === w && t >= x.at && (!x.state || t < x.at + x.life + 0.3));
            const show = p && (!p.state || p.state === 'hit' || p.state === 'bad');
            return (
              <button key={w} className="mg-window" onPointerDown={() => tap(w)}>
                {show ? (p!.state === 'hit' ? '💥' : p!.state === 'bad' ? '❌' : p!.foe ? '🪖' : '🧑') : ''}
              </button>
            );
          })}
        </div>
      </Stage>
    </>
  );
}

/* ── 바람 보는 저격 ── */
export function ShootSniper({ level, seed, report, finish }: MiniProps) {
  const rng = useRng(seed);
  const SHOTS = 5;
  const shots = useMemo(() => Array.from({ length: SHOTS }, () => ({ wind: rng.range(-1, 1), tx: rng.range(30, 70), ty: rng.range(35, 65) })), [rng]);
  const s = useRef({ t: 0, hold: 0, breath: 100, shot: 0, pts: 0, aimX: 50, aimY: 50, mark: null as null | { x: number; y: number; hit: number } });
  const [, tick] = useState(0);
  const stage = useRef<HTMLDivElement>(null);
  useLoop((dt) => {
    const st = s.current;
    st.t += dt;
    if (st.hold > 0) {
      st.breath = Math.max(0, st.breath - dt * 45);
      if (st.breath === 0) st.hold = 0;
    } else st.breath = Math.min(100, st.breath + dt * 20);
    tick((x) => x + 1);
  });
  const st = s.current;
  const cur = shots[Math.min(st.shot, SHOTS - 1)];
  const sway = (st.hold > 0 ? 1.2 : 7) * level;
  const sx = st.aimX + Math.sin(st.t * 1.3) * sway + Math.sin(st.t * 3.1) * sway * 0.3;
  const sy = st.aimY + Math.cos(st.t * 1.7) * sway * 0.8;
  const tx = cur.tx + Math.sin(st.t * 0.6 + st.shot) * 6;
  const fire = () => {
    if (st.shot >= SHOTS) return;
    const bx = sx + cur.wind * 9;
    const d = Math.hypot(bx - tx, sy - cur.ty);
    const hit = d < 2.2 ? 1 : d < 5 ? 0.6 : 0;
    st.pts += hit;
    st.mark = { x: bx, y: sy, hit };
    st.shot++;
    st.hold = 0;
    report(st.pts / SHOTS);
    if (st.shot >= SHOTS) setTimeout(() => finish(st.pts / SHOTS), 600);
  };
  return (
    <>
      <Hud items={[['탄', `${Math.max(0, SHOTS - st.shot)}/${SHOTS}`], ['바람', `${cur.wind < 0 ? '←' : '→'} ${Math.abs(Math.round(cur.wind * 10))}`]]} />
      <Stage
        ratio={1}
        className="mg-scope"
        stageRef={stage}
        onPointerMove={(e) => {
          if (e.buttons || e.pointerType === 'mouse') {
            const p = pctOf(e, stage.current);
            st.aimX = Math.max(5, Math.min(95, p.x));
            st.aimY = Math.max(5, Math.min(95, p.y));
          }
        }}
      >
        <div className="mg-at" style={{ left: `${tx}%`, top: `${cur.ty}%`, fontSize: 26 }}>
          🎯
        </div>
        {st.mark && (
          <div className="mg-at" style={{ left: `${st.mark.x}%`, top: `${st.mark.y}%`, fontSize: 14 }}>
            {st.mark.hit ? '💥' : '•'}
          </div>
        )}
        <div className="mg-cross" style={{ left: `${sx}%`, top: `${sy}%` }} />
        <div className="mg-meter" style={{ left: '8%', width: '30%', bottom: '6%' }}>
          <i style={{ width: `${st.breath}%`, background: '#38bdf8' }} />
        </div>
        <div className="mg-tip">화면을 끌어 겨눠요 · 바람 {cur.wind < 0 ? '왼쪽' : '오른쪽'}으로 밀려요</div>
      </Stage>
      <div className="buttons">
        <button onPointerDown={() => (st.hold = st.breath > 10 ? 1 : 0)} onPointerUp={() => (st.hold = 0)} onPointerLeave={() => (st.hold = 0)}>
          😤 숨 참기(누르고 있기)
        </button>
        <button className="primary" onClick={fire} disabled={st.shot >= SHOTS}>
          🔫 발사
        </button>
      </div>
    </>
  );
}

/* ── 움직이는 표적 ── */
export function ShootMoving({ level, seed, report, finish }: MiniProps) {
  const rng = useRng(seed);
  const N = 10;
  const FLY = 0.4;
  const tg = useMemo(() => {
    let t = 0.5;
    return Array.from({ length: N }, () => {
      t += rng.range(1.6, 2.6) / level;
      const dir = rng.chance(0.5) ? 1 : -1;
      return { at: t, y: rng.range(20, 80), dir, speed: rng.range(28, 45) * level, state: '' as '' | 'hit' | 'gone' };
    });
  }, [rng, level]);
  const s = useRef({ t: 0, hits: 0, shots: [] as Array<{ x: number; y: number; land: number; done: boolean }>, over: false });
  const [, tick] = useState(0);
  const stage = useRef<HTMLDivElement>(null);
  const posX = (g: (typeof tg)[number], t: number) => (g.dir > 0 ? -5 : 105) + g.dir * (t - g.at) * g.speed;
  useLoop((dt) => {
    const st = s.current;
    if (st.over) return;
    st.t += dt;
    for (const b of st.shots) {
      if (b.done || st.t < b.land) continue;
      b.done = true;
      for (const g of tg) {
        if (g.state || st.t < g.at) continue;
        if (Math.abs(posX(g, st.t) - b.x) < 5 && Math.abs(g.y - b.y) < 6) {
          g.state = 'hit';
          st.hits++;
        }
      }
    }
    for (const g of tg) if (!g.state && st.t > g.at && (posX(g, st.t) < -8 || posX(g, st.t) > 108)) g.state = 'gone';
    report(st.hits / N);
    if (tg.every((g) => g.state)) {
      st.over = true;
      finish(st.hits / N);
    }
    tick((x) => x + 1);
  });
  const st = s.current;
  return (
    <>
      <Hud items={[['명중', `${st.hits}/${N}`], ['쏜 탄', st.shots.length]]} />
      <Stage
        ratio={1.3}
        className="mg-field"
        stageRef={stage}
        onPointerDown={(e) => {
          const p = pctOf(e, stage.current);
          st.shots.push({ x: p.x, y: p.y, land: st.t + FLY, done: false });
        }}
      >
        {tg.map((g, i) =>
          st.t >= g.at && !g.state ? (
            <div key={i} className="mg-at" style={{ left: `${posX(g, st.t)}%`, top: `${g.y}%`, fontSize: 26, transform: `translate(-50%,-50%) scaleX(${g.dir > 0 ? -1 : 1})` }}>
              🏃
            </div>
          ) : null,
        )}
        {st.shots
          .filter((b) => st.t - b.land < 0.4)
          .map((b, i) => (
            <div key={i} className="mg-at" style={{ left: `${b.x}%`, top: `${b.y}%`, fontSize: b.done ? 18 : 10 }}>
              {b.done ? '💨' : '⊕'}
            </div>
          ))}
      </Stage>
    </>
  );
}
