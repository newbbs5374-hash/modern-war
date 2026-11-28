// 11-28 새 전체 화면 훈련 1 "포격전"(포트리스형). 계산은 battle/fortress.ts.
// 화면을 다 씀(고정 전체 화면). 포탄을 카메라가 따라가고, 높이 날면 화면을 넓게 줄여 끝까지 보여 줌.
// 조작: ◀ ▶ 꾹 = 전차 이동(연료) · 화면 위아래로 끌기 또는 ▲▼ = 포신 각도 · 🔥 꾹 눌렀다 떼기 = 힘 모아 발사
import { useEffect, useRef, useState } from 'react';
import { FH, FW, MAX_POWER, MAX_TURNS, MOVE_FUEL, STEP, aiAim, camFit, fire, flyPath, fortressScore, moveTank, newFortress, nextTurn, type FBattle, type FShot } from '../../../battle/fortress';
import { useLoop, type MiniProps } from './kit';

type Phase = 'aim' | 'fly' | 'think' | 'foefly' | 'over';
interface Boom { x: number; y: number; t: number; text: string }
interface Cam { x: number; y: number; w: number; h: number }

export function GFortress({ level, seed, report, finish }: MiniProps) {
  const cv = useRef<HTMLCanvasElement>(null);
  const b = useRef<FBattle>(newFortress(seed, level));
  const [phase, setPhase] = useState<Phase>('aim');
  const [, force] = useState(0);
  const st = useRef({
    shot: null as FShot | null,
    shown: 0,
    booms: [] as Boom[],
    charge: 0,
    charging: false,
    move: 0,
    lastPower: 0,
    cam: { x: 0, y: 0, w: FW, h: FH } as Cam,
    wait: 0,
    drag: null as null | { y: number; a: number },
    stars: Array.from({ length: 40 }, (_, i) => [((i * 137) % 100) / 100, ((i * 71) % 60) / 100]),
  });
  const refresh = () => force((n) => n + 1);
  // 세로 화면이면 게임을 눕혀서(가로로) 화면을 다 씀
  const [rot, setRot] = useState(() => window.innerHeight > window.innerWidth);
  useEffect(() => {
    const on = () => setRot(window.innerHeight > window.innerWidth);
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  const bat = b.current;

  // 화면 크기 맞추기
  useEffect(() => {
    const fit = () => {
      const c = cv.current;
      if (!c) return;
      const d = Math.min(2, window.devicePixelRatio || 1);
      c.width = Math.round(c.clientWidth * d);
      c.height = Math.round(c.clientHeight * d);
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [rot]);

  const shoot = (who: 'me' | 'foe') => {
    const s = st.current;
    s.shot = fire(bat, who, who === 'me' ? 1 + (level - 1) * 0.3 : 1);
    s.shown = 0;
    setPhase(who === 'me' ? 'fly' : 'foefly');
  };
  const landed = () => {
    const s = st.current;
    const sh = s.shot!;
    if (sh.hit) {
      const parts = [sh.dmgFoe ? `적 −${sh.dmgFoe}` : '', sh.dmgMe ? `우리 −${sh.dmgMe}` : ''].filter(Boolean).join(' · ');
      s.booms.push({ x: sh.hit.x, y: sh.hit.y, t: 0, text: parts || '빗나감' });
    } else s.booms.push({ x: Math.max(40, Math.min(FW - 40, sh.pts[sh.pts.length - 1][0])), y: FH * 0.4, t: 0, text: '화면 밖' });
    nextTurn(bat);
    report(fortressScore(bat));
    if (bat.over) {
      setPhase('over');
      s.wait = 1.6;
      return;
    }
    if (phase === 'fly') {
      setPhase('think');
      s.wait = 1.1;
    } else setPhase('aim');
    refresh();
  };

  useLoop((dt) => {
    const s = st.current;
    const c = cv.current;
    if (!c) return;
    // 차례 진행
    if (phase === 'aim') {
      if (s.charging) s.charge = Math.min(1, s.charge + dt * 0.55);
      if (s.move) {
        moveTank(bat, 'me', s.move * 140 * dt);
        if (bat.me.fuel <= 0) s.move = 0;
      }
    }
    if (phase === 'fly' || phase === 'foefly') {
      const sh = s.shot!;
      s.shown = Math.min(sh.pts.length, s.shown + dt * 60 * 1.6);
      if (s.shown >= sh.pts.length) landed();
    }
    if (phase === 'think') {
      s.wait -= dt;
      if (s.wait <= 0) {
        const aim = aiAim(bat, level);
        bat.foe.angle = aim.angle;
        bat.foe.power = Math.max(200, Math.min(MAX_POWER, aim.power));
        shoot('foe');
      }
    }
    if (phase === 'over') {
      s.wait -= dt;
      if (s.wait <= 0) {
        s.wait = 999;
        finish(fortressScore(bat));
      }
    }
    for (const bm of s.booms) bm.t += dt;
    s.booms = s.booms.filter((bm) => bm.t < 2.2);

    // 카메라: 조준 땐 두 전차 + 미리보기, 날 땐 포탄 길 전체(위로 높이 날면 넓게 줄어듦)
    const ratio = c.width / c.height;
    const want: Array<[number, number]> = [
      [bat.me.x, bat.me.y],
      [bat.foe.x, bat.foe.y],
    ];
    if (s.shot && (phase === 'fly' || phase === 'foefly')) for (let i = 0; i < s.shot.pts.length; i += 4) want.push(s.shot.pts[Math.floor(i)]);
    const tgt = camFit(want, ratio);
    const k = Math.min(1, dt * 5);
    s.cam = { x: s.cam.x + (tgt.x - s.cam.x) * k, y: s.cam.y + (tgt.y - s.cam.y) * k, w: s.cam.w + (tgt.w - s.cam.w) * k, h: s.cam.h + (tgt.h - s.cam.h) * k };
    draw(c, bat, s, phase, level);
    if (s.charging || s.move) refresh();
  });

  // 조작
  const down = (e: React.PointerEvent) => {
    if (phase !== 'aim') return;
    st.current.drag = { y: rot ? -e.clientX : e.clientY, a: bat.me.angle };
  };
  const moveP = (e: React.PointerEvent) => {
    const d = st.current.drag;
    if (!d || phase !== 'aim') return;
    bat.me.angle = Math.max(5, Math.min(85, d.a + (d.y - (rot ? -e.clientX : e.clientY)) * 0.25));
  };
  const up = () => (st.current.drag = null);
  const startCharge = () => {
    if (phase !== 'aim') return;
    st.current.charging = true;
    st.current.charge = 0;
  };
  const release = () => {
    const s = st.current;
    if (!s.charging || phase !== 'aim') return;
    s.charging = false;
    bat.me.power = Math.max(120, s.charge * MAX_POWER);
    s.lastPower = s.charge;
    shoot('me');
  };
  const nudge = (d: number) => {
    bat.me.angle = Math.max(5, Math.min(85, bat.me.angle + d));
    refresh();
  };

  const myTurn = phase === 'aim';
  return (
    <div className={`ft-full ${rot ? 'rot' : ''}`} onPointerDown={down} onPointerMove={moveP} onPointerUp={up} onPointerCancel={up}>
      <canvas ref={cv} className="ft-canvas" />
      <div className="ft-hud">
        <div className="ft-hp me">
          <small>🟦 우리 전차</small>
          <i style={{ width: `${bat.me.hp}%` }} />
        </div>
        <div className="ft-mid">
          <b>
            {Math.min(MAX_TURNS, Math.floor(bat.turn / 2) + 1)}/{MAX_TURNS}차례
          </b>
          <small>
            바람 {bat.wind < 0 ? '◀'.repeat(Math.min(3, Math.ceil(-bat.wind / 30))) : bat.wind > 0 ? '▶'.repeat(Math.min(3, Math.ceil(bat.wind / 30))) : '·'} {Math.abs(bat.wind)}
          </small>
        </div>
        <div className="ft-hp foe">
          <small>적 전차 🟥</small>
          <i style={{ width: `${bat.foe.hp}%` }} />
        </div>
        <button className="ft-exit" onPointerDown={(e) => e.stopPropagation()} onClick={() => finish(fortressScore(bat))}>
          ✕
        </button>
      </div>
      <div className="ft-turn">{phase === 'aim' ? '🎯 우리 차례 · 화면을 위아래로 끌어 각도' : phase === 'fly' ? '💥 발사!' : phase === 'over' ? (bat.over === 'win' ? '🏆 승리!' : bat.over === 'lose' ? '💀 패배' : '🤝 무승부') : '⏳ 적 차례'}</div>
      <div className="ft-ctl" onPointerDown={(e) => e.stopPropagation()}>
        <button
          disabled={!myTurn}
          onPointerDown={() => (st.current.move = -1)}
          onPointerUp={() => (st.current.move = 0)}
          onPointerLeave={() => (st.current.move = 0)}
        >
          ◀
        </button>
        <button
          disabled={!myTurn}
          onPointerDown={() => (st.current.move = 1)}
          onPointerUp={() => (st.current.move = 0)}
          onPointerLeave={() => (st.current.move = 0)}
        >
          ▶
        </button>
        <div className="ft-fuel">
          <small>연료</small>
          <i style={{ width: `${(bat.me.fuel / MOVE_FUEL) * 100}%` }} />
        </div>
        <div className="ft-ang">
          <button disabled={!myTurn} onClick={() => nudge(1)}>▲</button>
          <b>{Math.round(bat.me.angle)}°</b>
          <button disabled={!myTurn} onClick={() => nudge(-1)}>▼</button>
        </div>
        <button className="ft-fire" disabled={!myTurn} onPointerDown={startCharge} onPointerUp={release} onPointerLeave={release}>
          <span className="ft-gauge">
            <i style={{ width: `${st.current.charge * 100}%` }} />
            {st.current.lastPower > 0 && <em style={{ left: `${st.current.lastPower * 100}%` }} />}
          </span>
          🔥 꾹 눌러 힘 모으기
        </button>
      </div>
    </div>
  );
}

function draw(c: HTMLCanvasElement, b: FBattle, s: { cam: Cam; shot: FShot | null; shown: number; booms: Boom[]; charge: number; charging: boolean; stars: number[][] }, phase: Phase, level: number) {
  const g = c.getContext('2d');
  if (!g) return;
  const W = c.width, H = c.height;
  const cam = s.cam;
  const sx = W / cam.w;
  const X = (x: number) => (x - cam.x) * sx;
  const Y = (y: number) => (y - cam.y) * sx;
  // 하늘(위로 갈수록 어두움)
  const sky = g.createLinearGradient(0, 0, 0, H);
  const top = Math.max(0, Math.min(1, -cam.y / 3000));
  sky.addColorStop(0, `rgb(${Math.round(70 - 50 * top)},${Math.round(130 - 100 * top)},${Math.round(200 - 120 * top)})`);
  sky.addColorStop(1, '#cfe3f2');
  g.fillStyle = sky;
  g.fillRect(0, 0, W, H);
  if (top > 0.05) {
    g.fillStyle = `rgba(255,255,255,${top})`;
    for (const [px, py] of s.stars) g.fillRect(px * W, py * H, 2, 2);
  }
  // 먼 산(느리게 움직임)
  g.fillStyle = 'rgba(90,120,150,0.45)';
  g.beginPath();
  g.moveTo(0, H);
  for (let i = 0; i <= 24; i++) {
    const x = (i / 24) * W;
    g.lineTo(x, Y(FH * 0.55) + Math.sin(i * 1.3 + cam.x * 0.001) * 40 * sx);
  }
  g.lineTo(W, H);
  g.fill();
  // 땅
  const dirt = g.createLinearGradient(0, Y(FH * 0.4), 0, Y(FH));
  dirt.addColorStop(0, '#6b8f3a');
  dirt.addColorStop(0.08, '#7a5a35');
  dirt.addColorStop(1, '#3e2b1a');
  g.fillStyle = dirt;
  g.beginPath();
  g.moveTo(X(0), Y(FH + 2000));
  b.ground.forEach((h, i) => g.lineTo(X(i * STEP), Y(h)));
  g.lineTo(X(FW), Y(FH + 2000));
  g.closePath();
  g.fill();
  g.strokeStyle = '#8fc04f';
  g.lineWidth = Math.max(2, 6 * sx);
  g.beginPath();
  b.ground.forEach((h, i) => (i ? g.lineTo(X(i * STEP), Y(h)) : g.moveTo(X(0), Y(h))));
  g.stroke();
  // 전차
  const tank = (t: FBattle['me'], color: string) => {
    const x = X(t.x), y = Y(t.y), k = sx;
    g.save();
    g.translate(x, y);
    g.fillStyle = '#222';
    g.fillRect(-26 * k, -10 * k, 52 * k, 10 * k);
    g.fillStyle = color;
    g.fillRect(-22 * k, -22 * k, 44 * k, 13 * k);
    g.beginPath();
    g.arc(0, -22 * k, 12 * k, Math.PI, 0);
    g.fill();
    const a = (t.angle * Math.PI) / 180;
    g.strokeStyle = '#1b1b1b';
    g.lineWidth = 5 * k;
    g.beginPath();
    g.moveTo(0, -24 * k);
    g.lineTo(Math.cos(a) * 34 * k, -24 * k - Math.sin(a) * 34 * k);
    g.stroke();
    g.restore();
  };
  tank(b.me, '#3d7bd9');
  tank(b.foe, '#d9483d');
  // 조준 안내선(포격 실력이 높을수록 길게)
  if (phase === 'aim') {
    const { pts } = flyPath(b, b.me, b.me.angle, Math.max(200, (s.charging ? s.charge : 0.55) * MAX_POWER), b.wind);
    const n = Math.round(18 + level * 14);
    g.fillStyle = 'rgba(255,255,255,0.8)';
    for (let i = 0; i < Math.min(n * 3, pts.length); i += 3) g.fillRect(X(pts[i][0]) - 2, Y(pts[i][1]) - 2, 4, 4);
  }
  // 포탄과 꼬리
  if (s.shot && (phase === 'fly' || phase === 'foefly')) {
    const pts = s.shot.pts;
    const n = Math.floor(s.shown);
    g.strokeStyle = 'rgba(255,240,200,0.7)';
    g.lineWidth = 3;
    g.beginPath();
    for (let i = Math.max(0, n - 40); i < n; i++) (i === Math.max(0, n - 40) ? g.moveTo : g.lineTo).call(g, X(pts[i][0]), Y(pts[i][1]));
    g.stroke();
    const p = pts[Math.max(0, n - 1)];
    g.fillStyle = '#111';
    g.beginPath();
    g.arc(X(p[0]), Y(p[1]), Math.max(4, 9 * sx), 0, Math.PI * 2);
    g.fill();
    // 높이 표시(아주 높이 날 때)
    if (p[1] < 0) {
      g.fillStyle = '#fff';
      g.font = `${Math.round(H * 0.03)}px sans-serif`;
      g.fillText(`▲ 높이 ${Math.round((FH - p[1]) / 10)}m`, X(p[0]) + 12, Y(p[1]));
    }
  }
  // 폭발
  for (const bm of s.booms) {
    const r = (20 + bm.t * 120) * sx;
    g.fillStyle = `rgba(255,${Math.round(180 - bm.t * 60)},60,${Math.max(0, 0.8 - bm.t * 0.5)})`;
    g.beginPath();
    g.arc(X(bm.x), Y(bm.y), r, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = `rgba(255,255,255,${Math.max(0, 1 - bm.t / 2.2)})`;
    g.font = `bold ${Math.round(H * 0.035)}px sans-serif`;
    g.textAlign = 'center';
    g.fillText(bm.text, X(bm.x), Y(bm.y) - 40 - bm.t * 30);
    g.textAlign = 'left';
  }
}
