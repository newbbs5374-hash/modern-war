// 항공 훈련 미니게임 3개
import { useMemo, useRef, useState } from 'react';
import { Hud, Stage, clamp01, pctOf, useLoop, useRng, type MiniProps } from './kit';

/* ── 요격 비행 ── */
export function AirIntercept({ level, seed, report, finish }: MiniProps) {
  const rng = useRng(seed);
  const N = 24;
  const plan = useMemo(() => {
    let t = 0.6;
    return Array.from({ length: N }, () => {
      t += rng.range(0.9, 1.7) / level;
      return { at: t, x0: rng.range(10, 90), sw: rng.range(5, 18), sp: rng.range(14, 22) * level };
    });
  }, [rng, level]);
  const s = useRef({
    t: 0,
    px: 50,
    py: 85,
    tx: 50,
    ty: 85,
    fire: 0,
    shots: [] as Array<{ x: number; y: number }>,
    foes: [] as Array<{ i: number; x: number; y: number; hp: number; cd: number }>,
    eb: [] as Array<{ x: number; y: number }>,
    next: 0,
    kills: 0,
    hits: 0,
    inv: 0,
    gone: 0,
    over: false,
  });
  const [, tick] = useState(0);
  const stage = useRef<HTMLDivElement>(null);
  const st = s.current;
  useLoop((dt) => {
    if (st.over) return;
    st.t += dt;
    st.px += (st.tx - st.px) * Math.min(1, dt * 8);
    st.py += (st.ty - st.py) * Math.min(1, dt * 8);
    st.inv = Math.max(0, st.inv - dt);
    st.fire -= dt;
    if (st.fire <= 0) {
      st.fire = 0.22;
      st.shots.push({ x: st.px, y: st.py - 5 });
    }
    while (st.next < N && st.t >= plan[st.next].at) {
      const p = plan[st.next];
      st.foes.push({ i: st.next, x: p.x0, y: -5, hp: 2, cd: rng.range(0.8, 1.6) });
      st.next++;
    }
    for (const b of st.shots) b.y -= dt * 110;
    st.shots = st.shots.filter((b) => b.y > -5);
    for (const f of st.foes) {
      const p = plan[f.i];
      f.y += dt * p.sp;
      f.x = p.x0 + Math.sin(st.t * 1.5 + f.i) * p.sw;
      f.cd -= dt;
      if (f.cd <= 0 && f.y > 0 && f.y < 70) {
        f.cd = rng.range(1.2, 2.2) / level;
        st.eb.push({ x: f.x, y: f.y + 3 });
      }
      for (const b of st.shots)
        if (Math.abs(b.x - f.x) < 5 && Math.abs(b.y - f.y) < 4) {
          f.hp--;
          b.y = -99;
        }
    }
    st.kills += st.foes.filter((f) => f.hp <= 0).length;
    st.gone += st.foes.filter((f) => f.y > 105).length;
    st.foes = st.foes.filter((f) => f.hp > 0 && f.y <= 105);
    for (const b of st.eb) {
      b.y += dt * 45;
      if (st.inv <= 0 && Math.abs(b.x - st.px) < 4 && Math.abs(b.y - st.py) < 4) {
        st.hits++;
        st.inv = 1;
        b.y = 999;
      }
    }
    st.eb = st.eb.filter((b) => b.y < 105);
    const sc = clamp01(st.kills / (N * 0.85) - st.hits * 0.07);
    report(sc);
    if (st.next >= N && !st.foes.length) {
      st.over = true;
      finish(sc);
    }
    tick((x) => x + 1);
  });
  const aim = (e: React.PointerEvent) => {
    const p = pctOf(e, stage.current);
    st.tx = Math.max(4, Math.min(96, p.x));
    st.ty = Math.max(30, Math.min(95, p.y - 8));
  };
  return (
    <>
      <Hud items={[['격추', `${st.kills}/${N}`], ['피격', st.hits]]} />
      <Stage ratio={0.8} className="mg-sea" stageRef={stage} onPointerDown={aim} onPointerMove={(e) => (e.buttons || e.pointerType !== 'mouse') && aim(e)}>
        {st.foes.map((f) => (
          <div key={f.i} className="mg-at" style={{ left: `${f.x}%`, top: `${f.y}%`, fontSize: 22, transform: 'translate(-50%,-50%) rotate(180deg)' }}>
            ✈️
          </div>
        ))}
        {st.shots.map((b, i) => (
          <div key={i} className="mg-bullet" style={{ left: `${b.x}%`, top: `${b.y}%` }} />
        ))}
        {st.eb.map((b, i) => (
          <div key={i} className="mg-bullet foe" style={{ left: `${b.x}%`, top: `${b.y}%` }} />
        ))}
        <div className="mg-at" style={{ left: `${st.px}%`, top: `${st.py}%`, fontSize: 28, opacity: st.inv > 0 ? 0.5 : 1, transform: 'translate(-50%,-50%) rotate(-45deg)' }}>
          🛩️
        </div>
      </Stage>
    </>
  );
}

/* ── 항모 착륙 ── */
export function AirLanding({ level, seed, report, finish }: MiniProps) {
  const rng = useRng(seed);
  const N = 3;
  const s = useRef({ no: 0, alt: 300, speed: 165, sink: 7, thr: 0, pitch: 0, total: 0, msg: '', wait: 0, t: 0 });
  const [, tick] = useState(0);
  const st = s.current;
  const G = { s0: 128, s1: 145, k0: 1.5, k1: 4 };
  useLoop((dt) => {
    st.t += dt;
    if (st.no >= N) return;
    if (st.wait > 0) {
      st.wait -= dt;
      if (st.wait <= 0) Object.assign(st, { alt: 300, speed: rng.range(150, 175), sink: rng.range(5, 9), thr: 0, pitch: 0 });
      return tick((x) => x + 1);
    }
    // 돌풍
    const gust = Math.sin(st.t * 1.7) * 3 * level + (rng.chance(dt * 0.5) ? rng.range(-6, 6) * level : 0);
    st.speed += (st.thr * 9 - 2.5 + gust * 0.3) * dt;
    st.sink += (st.pitch * 2.2 + gust * 0.05) * dt;
    st.sink = Math.max(0, Math.min(12, st.sink));
    st.alt -= st.sink * dt * 6;
    if (st.alt <= 0) {
      const okS = st.speed >= G.s0 && st.speed <= G.s1;
      const okK = st.sink >= G.k0 && st.sink <= G.k1;
      const sc = okS && okK ? 1 : okS || okK ? 0.5 : st.sink > 8 ? 0 : 0.2;
      st.total += sc;
      st.msg = sc === 1 ? '✅ 완벽한 착함!' : okS ? '⚠️ 너무 세게/약하게 내렸어요' : okK ? '⚠️ 속도가 안 맞았어요(줄을 놓침)' : '💥 착함 실패';
      st.no++;
      report(st.total / N);
      if (st.no >= N) setTimeout(() => finish(st.total / N), 600);
      else st.wait = 1.6;
    }
    tick((x) => x + 1);
  });
  const Gauge = ({ label, v, lo, hi, min, max, unit }: { label: string; v: number; lo: number; hi: number; min: number; max: number; unit: string }) => {
    const pos = (x: number) => ((Math.max(min, Math.min(max, x)) - min) / (max - min)) * 100;
    return (
      <div className="mg-gauge">
        <small>{label}</small>
        <div>
          <b style={{ left: `${pos(lo)}%`, width: `${pos(hi) - pos(lo)}%` }} />
          <i style={{ left: `${pos(v)}%` }} />
        </div>
        <small>
          {Math.round(v * 10) / 10}
          {unit}
        </small>
      </div>
    );
  };
  const hold = (k: 'thr' | 'pitch', d: number) => ({
    onPointerDown: () => (st[k] = d),
    onPointerUp: () => (st[k] = 0),
    onPointerLeave: () => (st[k] = 0),
  });
  return (
    <>
      <Hud items={[['착함', `${Math.min(st.no + 1, N)}/${N}`], ['높이', `${Math.max(0, Math.round(st.alt))}m`]]} />
      <Stage ratio={1.6} className="mg-sea">
        <div className="mg-at" style={{ left: '50%', top: '80%', fontSize: 40, transform: `translate(-50%,-50%) rotate(${Math.sin(st.t * 0.9) * 3}deg)` }}>
          🚢
        </div>
        <div className="mg-at" style={{ left: '50%', top: `${78 - (st.alt / 300) * 65}%`, fontSize: 28 }}>
          ✈️
        </div>
        <div className="mg-tip">{st.msg || '초록 칸에 바늘 두 개를 맞춘 채로 내려요'}</div>
      </Stage>
      <Gauge label="속도" v={st.speed} lo={G.s0} hi={G.s1} min={100} max={190} unit="노트" />
      <Gauge label="내려가는 빠르기" v={st.sink} lo={G.k0} hi={G.k1} min={0} max={12} unit="m/s" />
      <div className="tiles c4">
        <button {...hold('thr', -1)}>출력 ▼</button>
        <button {...hold('thr', 1)}>출력 ▲</button>
        <button {...hold('pitch', 1)}>기수 ▼(빨리)</button>
        <button {...hold('pitch', -1)}>기수 ▲(천천히)</button>
      </div>
    </>
  );
}

/* ── 미사일 따돌리기 ── */
export function AirFlare({ level, seed, report, finish }: MiniProps) {
  const rng = useRng(seed);
  const N = 10;
  const plan = useMemo(() => {
    let t = 1;
    return Array.from({ length: N }, () => {
      t += rng.range(2.2, 3.6) / level;
      return { at: t, dir: Math.floor(rng.next() * 4), speed: rng.range(38, 55) * level };
    });
  }, [rng, level]);
  const s = useRef({ t: 0, ms: [] as Array<{ i: number; d: number; state: '' | 'ok' | 'hit' }>, next: 0, ok: 0, hit: 0, wasted: 0, cool: 0, flash: 0, over: false });
  const [, tick] = useState(0);
  const st = s.current;
  const W0 = 18;
  const W1 = 35;
  useLoop((dt) => {
    if (st.over) return;
    st.t += dt;
    st.cool = Math.max(0, st.cool - dt);
    st.flash = Math.max(0, st.flash - dt);
    while (st.next < N && st.t >= plan[st.next].at) st.ms.push({ i: st.next++, d: 100, state: '' });
    for (const m of st.ms) {
      if (m.state) continue;
      m.d -= dt * plan[m.i].speed;
      if (m.d <= 0) {
        m.state = 'hit';
        st.hit++;
      }
    }
    const sc = clamp01((st.ok - st.wasted * 0.3) / N);
    report(sc);
    if (st.next >= N && st.ms.every((m) => m.state)) {
      st.over = true;
      finish(sc);
    }
    tick((x) => x + 1);
  });
  const flare = () => {
    if (st.cool > 0) return;
    st.cool = 0.6;
    st.flash = 0.4;
    const live = st.ms.filter((m) => !m.state);
    if (!live.length) return;
    let any = false;
    for (const m of live)
      if (m.d >= W0 && m.d <= W1) {
        m.state = 'ok';
        st.ok++;
        any = true;
      } else if (m.d < W0) {
        // 너무 늦음: 그래도 반쯤 피함
      }
    if (!any) st.wasted++;
  };
  const pos = (dir: number, d: number) => {
    const r = (d / 100) * 45;
    return dir === 0 ? { x: 50, y: 50 - r } : dir === 1 ? { x: 50 + r, y: 50 } : dir === 2 ? { x: 50, y: 50 + r } : { x: 50 - r, y: 50 };
  };
  return (
    <>
      <Hud items={[['피함', `${st.ok}/${N}`], ['맞음', st.hit], ['헛씀', st.wasted]]} />
      <Stage ratio={1} className={`mg-radar ${st.flash > 0 ? 'mg-ok' : ''}`} onPointerDown={flare}>
        <div className="mg-ringzone" style={{ width: `${W1 * 0.9}%`, height: `${W1 * 0.9}%` }} />
        <div className="mg-ringzone inner" style={{ width: `${W0 * 0.9}%`, height: `${W0 * 0.9}%` }} />
        <div className="mg-at" style={{ left: '50%', top: '50%', fontSize: 28 }}>
          ✈️
        </div>
        {st.ms
          .filter((m) => !m.state)
          .map((m) => {
            const p = pos(plan[m.i].dir, m.d);
            return (
              <div key={m.i} className="mg-at" style={{ left: `${p.x}%`, top: `${p.y}%`, fontSize: 18, transform: `translate(-50%,-50%) rotate(${[180, 270, 0, 90][plan[m.i].dir]}deg)` }}>
                🚀
              </div>
            );
          })}
        {st.flash > 0 && (
          <div className="mg-at" style={{ left: '50%', top: '58%', fontSize: 22 }}>
            ✨✨
          </div>
        )}
        <div className="mg-tip">미사일이 노란 고리 안(빨간 고리 밖)에 들어오면 화면을 눌러요</div>
      </Stage>
    </>
  );
}
