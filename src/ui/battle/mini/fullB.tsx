// 11-28 새 전체 화면 훈련 묶음 B 화면(계산은 battle/fullB.ts). 모두 화면을 다 쓰고, 세로 화면이면 눕혀서 씀.
// GCover 시가전 엄폐 사격 · GNaval 함대 포격전 · GHunt 어둠 속 사냥 · GRun 자폭 보트 돌격 · GStealth 스텔스 침투
import { useRef, useState } from 'react';
import {
  AH, AW, CH, CHP, CW, MAG, NN, OH, OTORPS, OW, RH, RHP, RL, SPOTS,
  addPoint, aiShoot, beamAngle, coverScore, fly, huntFire, huntMove, huntPing, huntScore, navalScore, navalShoot, newCover, newHunt, newNaval, newRun, newStealth, pathLen, pathReady, pointAt, runScore, shipAt, shootCover, stealthScore, stepCover, stepHunt, stepRun, stepStealth, sunk,
  type Cover, type Fleet, type Hunt, type Naval, type Run, type Stealth,
} from '../../../battle/fullB';
import { fitView, localPt, rr, toWorld, useFullCanvas, type View } from './full';
import { useLoop, type MiniProps } from './kit';

function useEnd(finish: (s: number) => void) {
  const ended = useRef(false);
  return (done: boolean, score: number) => {
    if (done && !ended.current) {
      ended.current = true;
      setTimeout(() => finish(score), 1300);
    }
  };
}
/** 바뀔 때만 다시 그리기(점수판) */
function useHud() {
  const key = useRef('');
  const [, force] = useState(0);
  return {
    sync: (k: string) => {
      if (k !== key.current) {
        key.current = k;
        force((n) => n + 1);
      }
    },
    bump: () => force((n) => n + 1),
  };
}
const world = (g: CanvasRenderingContext2D, v: View) => g.setTransform(v.sc, 0, 0, v.sc, v.ox, v.oy);
function clear(g: CanvasRenderingContext2D, c: HTMLCanvasElement, top: string, bot: string) {
  g.setTransform(1, 0, 0, 1, 0, 0);
  const bg = g.createLinearGradient(0, 0, 0, c.height);
  bg.addColorStop(0, top);
  bg.addColorStop(1, bot);
  g.fillStyle = bg;
  g.fillRect(0, 0, c.width, c.height);
}

// ───────────────────────── 6 시가전 엄폐 사격 ─────────────────────────
export function GCover({ level, seed, report, finish }: MiniProps) {
  const { cv, rot } = useFullCanvas();
  const s = useRef<Cover>(newCover(seed, level));
  const hide = useRef(false);
  const lift = useRef(0);
  const marks = useRef<Array<{ x: number; y: number; t: number; k: string }>>([]);
  const view = useRef<View>({ sc: 1, ox: 0, oy: 0 });
  const hud = useHud();
  const end = useEnd(finish);
  useLoop((dt) => {
    const st = s.current;
    stepCover(st, dt, !hide.current);
    lift.current += ((hide.current ? 1 : 0) - lift.current) * Math.min(1, dt * 14);
    for (const m of marks.current) m.t += dt;
    marks.current = marks.current.filter((m) => m.t < 0.5);
    const sc = coverScore(st);
    report(sc);
    end(st.done, sc);
    const c = cv.current;
    if (c) {
      view.current = fitView(c, CW, CH);
      drawCover(c, view.current, st, lift.current, marks.current);
    }
    hud.sync(`${st.hp}|${st.ammo}|${st.kills}|${st.civHit}|${st.done}|${hide.current}`);
  });
  const tap = (e: React.PointerEvent) => {
    const w = toWorld(view.current, localPt(e, cv.current, rot));
    const r = shootCover(s.current, w.x, w.y);
    if (r) marks.current.push({ ...w, t: 0, k: r });
    hud.bump();
  };
  const st = s.current;
  const set = (v: boolean) => () => (hide.current = v);
  return (
    <div className={`ft-full ${rot ? 'rot' : ''}`}>
      <canvas ref={cv} className="ft-canvas" onPointerDown={tap} />
      <div className="ft-hud">
        <div className="ft-hp me">
          <small>🪖 체력 {'❤️'.repeat(Math.max(0, st.hp))}{'🖤'.repeat(Math.max(0, CHP - st.hp))}</small>
        </div>
        <div className="ft-mid">
          <b>
            사살 {st.kills}/{st.total}
            {st.civHit ? ` · 민간인 ⚠️${st.civHit}` : ''}
          </b>
          <small>빨간 고리가 다 차기 전에 쏘거나 숨어요</small>
        </div>
        <div className="ft-hp foe">
          <small>탄창 {'▮'.repeat(st.ammo)}{'▯'.repeat(MAG - st.ammo)}</small>
        </div>
        <button className="ft-exit" onClick={() => finish(coverScore(st))}>✕</button>
      </div>
      {st.ammo === 0 && !st.done && <div className="ft-turn">🔄 숨어서 장전!</div>}
      {st.done && <div className="ft-turn">{st.hp > 0 ? '🏁 구역 확보!' : '🚑 부상 후송'}</div>}
      <div className="if-ctl">
        <div className="if-pad">
          <button className="fa-big" onPointerDown={set(true)} onPointerUp={set(false)} onPointerLeave={set(false)} onPointerCancel={set(false)}>
            🛡 꾹 = 숨기
          </button>
        </div>
      </div>
    </div>
  );
}
function drawCover(c: HTMLCanvasElement, v: View, s: Cover, lift: number, marks: Array<{ x: number; y: number; t: number; k: string }>) {
  const g = c.getContext('2d');
  if (!g) return;
  clear(g, c, '#8fa9c0', '#d9d2c2');
  world(g, v);
  // 건물 3채
  [120, 620, 1120].forEach((bx, i) => {
    g.fillStyle = ['#a08c78', '#8f8a84', '#9b7f6d'][i];
    g.fillRect(bx, 80, 360, 690);
    g.fillStyle = 'rgba(0,0,0,0.15)';
    for (let y = 100; y < 760; y += 24) g.fillRect(bx, y, 360, 2);
    g.fillStyle = '#5b4a3e';
    g.fillRect(bx - 8, 72, 376, 14);
  });
  // 창문·문
  SPOTS.forEach((p, i) => {
    const door = i % 10 === 9;
    const w = door ? 90 : 72, h = door ? 120 : 90;
    g.fillStyle = '#1b1d22';
    g.fillRect(p.x - w / 2, p.y - h / 2, w, h);
    g.strokeStyle = '#d8d0c0';
    g.lineWidth = 5;
    g.strokeRect(p.x - w / 2, p.y - h / 2, w, h);
  });
  // 사람
  for (const f of s.foes) {
    if (!f.alive) continue;
    g.fillStyle = f.civ ? '#f0eee8' : '#3d4a32';
    g.beginPath();
    g.ellipse(f.x, f.y + 28, 24, 28, 0, Math.PI, 0);
    g.fill();
    g.fillRect(f.x - 24, f.y + 26, 48, 18);
    g.fillStyle = f.civ ? '#d9b48f' : '#c49a76';
    g.beginPath();
    g.arc(f.x, f.y - 6, 15, 0, Math.PI * 2);
    g.fill();
    if (f.civ) {
      g.fillStyle = '#5a3d2b';
      g.beginPath();
      g.arc(f.x, f.y - 12, 15, Math.PI, 0);
      g.fill();
    } else {
      g.fillStyle = '#2e3826';
      g.beginPath();
      g.arc(f.x, f.y - 10, 17, Math.PI, 0);
      g.fill();
      g.strokeStyle = '#111';
      g.lineWidth = 6;
      g.beginPath();
      g.moveTo(f.x + 12, f.y + 22);
      g.lineTo(f.x + 40, f.y + 12);
      g.stroke();
      // 쏘기까지 남은 시간 고리
      const k = 1 - f.aim / f.aimMax;
      g.strokeStyle = k > 0.75 ? '#ff2d1a' : 'rgba(255,80,60,0.85)';
      g.lineWidth = 6;
      g.beginPath();
      g.arc(f.x, f.y + 6, 46, -Math.PI / 2, -Math.PI / 2 + k * Math.PI * 2);
      g.stroke();
      if (f.aim > f.aimMax - 0.12 && s.t > 2) {
        g.fillStyle = 'rgba(255,220,90,0.9)';
        g.beginPath();
        g.arc(f.x + 44, f.y + 10, 16, 0, Math.PI * 2);
        g.fill();
      }
    }
  }
  // 거리
  g.fillStyle = '#5d5a55';
  g.fillRect(0, 770, CW, 130);
  g.fillStyle = '#e8e2d0';
  for (let x = 40; x < CW; x += 160) g.fillRect(x, 830, 80, 8);
  for (const m of marks) {
    g.strokeStyle = m.k === 'foe' ? `rgba(255,60,40,${1 - m.t * 2})` : m.k === 'civ' ? `rgba(255,220,0,${1 - m.t * 2})` : `rgba(255,255,255,${1 - m.t * 2})`;
    g.lineWidth = 4;
    g.beginPath();
    g.arc(m.x, m.y, 12 + m.t * 40, 0, Math.PI * 2);
    g.stroke();
  }
  // 모래주머니(숨으면 올라옴)
  const top = 800 - lift * 420;
  g.fillStyle = `rgba(0,0,0,${lift * 0.35})`;
  g.fillRect(0, 0, CW, CH);
  for (let row = 0; row < 8; row++)
    for (let i = -1; i < 13; i++) {
      const x = i * 140 + (row % 2) * 70, y = top + row * 60;
      g.fillStyle = row % 2 ? '#a89466' : '#b6a274';
      rr(g, x, y, 136, 62, 26);
      g.fill();
      g.strokeStyle = 'rgba(70,55,30,0.6)';
      g.lineWidth = 3;
      g.stroke();
    }
  if (s.hurt > 0) {
    g.setTransform(1, 0, 0, 1, 0, 0);
    const gr = g.createRadialGradient(c.width / 2, c.height / 2, c.height * 0.3, c.width / 2, c.height / 2, c.width * 0.7);
    gr.addColorStop(0, 'rgba(255,0,0,0)');
    gr.addColorStop(1, `rgba(200,0,0,${s.hurt})`);
    g.fillStyle = gr;
    g.fillRect(0, 0, c.width, c.height);
  }
}

// ───────────────────────── 7 함대 포격전 ─────────────────────────
const NC = 70, MY = { x: 90, y: 200 }, FO = { x: 950, y: 200 };
export function GNaval({ level, seed, report, finish }: MiniProps) {
  const { cv, rot } = useFullCanvas();
  const n = useRef<Naval>(newNaval(seed, level));
  const anim = useRef<Array<{ side: 'me' | 'foe'; r: number; c: number; t: number; res: string }>>([]);
  const wait = useRef(0.9);
  const msg = useRef('🎯 적 바다를 눌러 포격');
  const view = useRef<View>({ sc: 1, ox: 0, oy: 0 });
  const hud = useHud();
  const end = useEnd(finish);
  const say = (who: string, res: string) => (msg.current = res === 'sunk' ? `💥 ${who} 배 격침!` : res === 'hit' ? `🔥 ${who} 명중! 한 번 더` : `💦 ${who} 빗나감`);
  useLoop((dt) => {
    const st = n.current;
    for (const a of anim.current) a.t += dt;
    anim.current = anim.current.filter((a) => a.t < 0.9);
    if (st.turn === 'foe' && !st.over) {
      wait.current -= dt;
      if (wait.current <= 0) {
        const r = aiShoot(st);
        if (r) {
          anim.current.push({ side: 'me', r: r.at[0], c: r.at[1], t: 0, res: r.res });
          say('적', r.res);
          if ((st.turn as string) === 'me') msg.current += ' · 🎯 우리 차례';
        }
        wait.current = 0.9;
      }
    }
    const sc = navalScore(st);
    report(sc);
    end(!!st.over, sc);
    const c = cv.current;
    if (c) {
      view.current = fitView(c, 1600, 900);
      drawNaval(c, view.current, st, anim.current);
    }
    hud.sync(`${st.turn}|${st.myShots}|${st.over}|${msg.current}`);
  });
  const tap = (e: React.PointerEvent) => {
    const st = n.current;
    const w = toWorld(view.current, localPt(e, cv.current, rot));
    const c = Math.floor((w.x - FO.x) / NC), r = Math.floor((w.y - FO.y) / NC);
    if (r < 0 || c < 0 || r >= NN || c >= NN) return;
    const res = navalShoot(st, r, c);
    if (!res || res === 'again') return;
    anim.current.push({ side: 'foe', r, c, t: 0, res });
    msg.current = res === 'sunk' ? '💥 적 배 격침! 한 번 더' : res === 'hit' ? '🔥 명중! 한 번 더' : '💦 빗나감 · ⏳ 적 차례';
    wait.current = 1.1;
    hud.bump();
  };
  const st = n.current;
  const left = (f: Fleet) => f.ships.filter((s) => !sunk(s)).length;
  return (
    <div className={`ft-full ${rot ? 'rot' : ''}`}>
      <canvas ref={cv} className="ft-canvas" onPointerDown={tap} />
      <div className="ft-hud">
        <div className="ft-hp me">
          <small>🟦 우리 함대 {left(st.me)}척</small>
          <i style={{ width: `${(left(st.me) / st.me.ships.length) * 100}%` }} />
        </div>
        <div className="ft-mid">
          <b>{st.over ? (st.over === 'win' ? '🏆 적 함대 전멸!' : '💀 우리 함대 전멸') : msg.current}</b>
          <small>포격 {st.myShots}발</small>
        </div>
        <div className="ft-hp foe">
          <small>적 함대 {left(st.foe)}척 🟥</small>
          <i style={{ width: `${(left(st.foe) / st.foe.ships.length) * 100}%` }} />
        </div>
        <button className="ft-exit" onClick={() => finish(navalScore(st))}>✕</button>
      </div>
    </div>
  );
}
function drawNaval(c: HTMLCanvasElement, v: View, n: Naval, anim: Array<{ side: 'me' | 'foe'; r: number; c: number; t: number; res: string }>) {
  const g = c.getContext('2d');
  if (!g) return;
  clear(g, c, '#0e2236', '#08131f');
  world(g, v);
  const t = performance.now() / 1000;
  const grid = (o: { x: number; y: number }, f: Fleet, mine: boolean, active: boolean) => {
    g.fillStyle = active ? 'rgba(255,211,77,0.12)' : 'rgba(0,0,0,0.2)';
    rr(g, o.x - 16, o.y - 60, NN * NC + 32, NN * NC + 76, 16);
    g.fill();
    g.fillStyle = '#cfe3f2';
    g.font = 'bold 30px sans-serif';
    g.textAlign = 'left';
    g.textBaseline = 'alphabetic';
    g.fillText(mine ? '🟦 우리 바다' : '🟥 적 바다 (눌러서 포격)', o.x, o.y - 20);
    for (let r = 0; r < NN; r++)
      for (let cc = 0; cc < NN; cc++) {
        const x = o.x + cc * NC, y = o.y + r * NC;
        const wave = Math.sin(t * 1.5 + r * 0.7 + cc * 0.5) * 0.05;
        g.fillStyle = `rgba(${40 + wave * 200},${110 + wave * 200},${170 + wave * 200},1)`;
        g.fillRect(x + 2, y + 2, NC - 4, NC - 4);
      }
    // 배
    for (const s of f.ships) {
      const show = mine || sunk(s);
      if (!show) continue;
      const rs = s.cells.map((q) => q[0]), cs = s.cells.map((q) => q[1]);
      const x0 = o.x + Math.min(...cs) * NC + 8, y0 = o.y + Math.min(...rs) * NC + 8;
      const w = (Math.max(...cs) - Math.min(...cs) + 1) * NC - 16, h = (Math.max(...rs) - Math.min(...rs) + 1) * NC - 16;
      g.fillStyle = sunk(s) ? '#3b3532' : '#8e9aa4';
      rr(g, x0, y0, w, h, Math.min(w, h) / 2);
      g.fill();
      g.fillStyle = sunk(s) ? '#2a2522' : '#6c7882';
      rr(g, x0 + w * 0.3, y0 + h * 0.3, w * 0.4, h * 0.4, 6);
      g.fill();
    }
    for (let r = 0; r < NN; r++)
      for (let cc = 0; cc < NN; cc++) {
        const sh = f.shot[r][cc];
        const x = o.x + cc * NC + NC / 2, y = o.y + r * NC + NC / 2;
        if (sh === 1) {
          g.fillStyle = 'rgba(235,245,255,0.75)';
          g.beginPath();
          g.arc(x, y, 8, 0, Math.PI * 2);
          g.fill();
        } else if (sh === 2) {
          const s = shipAt(f, r, cc);
          g.fillStyle = s && sunk(s) ? '#5a2018' : `rgba(255,${120 + Math.sin(t * 9 + r) * 50},40,0.95)`;
          g.beginPath();
          g.arc(x, y, 20, 0, Math.PI * 2);
          g.fill();
          g.strokeStyle = '#fff';
          g.lineWidth = 4;
          g.beginPath();
          g.moveTo(x - 12, y - 12);
          g.lineTo(x + 12, y + 12);
          g.moveTo(x + 12, y - 12);
          g.lineTo(x - 12, y + 12);
          g.stroke();
        }
      }
  };
  grid(MY, n.me, true, n.turn === 'foe' && !n.over);
  grid(FO, n.foe, false, n.turn === 'me' && !n.over);
  for (const a of anim) {
    const o = a.side === 'me' ? MY : FO;
    const x = o.x + a.c * NC + NC / 2, y = o.y + a.r * NC + NC / 2;
    const k = a.t / 0.9;
    g.strokeStyle = a.res === 'miss' ? `rgba(255,255,255,${1 - k})` : `rgba(255,140,40,${1 - k})`;
    g.lineWidth = 6;
    g.beginPath();
    g.arc(x, y, 10 + k * 60, 0, Math.PI * 2);
    g.stroke();
    // 날아오는 포탄(처음 0.3초)
    if (a.t < 0.3) {
      const from = a.side === 'foe' ? { x: MY.x + NN * NC, y: 500 } : { x: FO.x, y: 500 };
      const q = a.t / 0.3;
      g.fillStyle = '#ffd34d';
      g.beginPath();
      g.arc(from.x + (x - from.x) * q, from.y + (y - from.y) * q - Math.sin(q * Math.PI) * 200, 9, 0, Math.PI * 2);
      g.fill();
    }
  }
}

// ───────────────────────── 8 어둠 속 사냥 ─────────────────────────
export function GHunt({ level, seed, report, finish }: MiniProps) {
  const { cv, rot } = useFullCanvas();
  const s = useRef<Hunt>(newHunt(seed, level));
  const aim = useRef(false);
  const view = useRef<View>({ sc: 1, ox: 0, oy: 0 });
  const hud = useHud();
  const end = useEnd(finish);
  useLoop((dt) => {
    const st = s.current;
    stepHunt(st, dt);
    const sc = huntScore(st);
    report(sc);
    end(st.done, sc);
    const c = cv.current;
    if (c) {
      view.current = fitView(c, OW, OH);
      drawHunt(c, view.current, st, aim.current);
    }
    hud.sync(`${st.me.hp}|${st.kills}|${st.ammo}|${Math.ceil(st.pingCool)}|${aim.current}|${st.done}|${st.torps.some((t) => !t.mine && Math.hypot(t.x - st.me.x, t.y - st.me.y) < 520)}`);
  });
  const tap = (e: React.PointerEvent) => {
    const st = s.current;
    const w = toWorld(view.current, localPt(e, cv.current, rot));
    if (aim.current) {
      huntFire(st, w.x, w.y);
      aim.current = false;
    } else huntMove(st, w.x, w.y);
    hud.bump();
  };
  const st = s.current;
  const warn = st.torps.some((t) => !t.mine && Math.hypot(t.x - st.me.x, t.y - st.me.y) < 520);
  return (
    <div className={`ft-full ${rot ? 'rot' : ''}`}>
      <canvas ref={cv} className="ft-canvas" onPointerDown={tap} />
      <div className="ft-hud">
        <div className="ft-hp me">
          <small>🫧 선체 {'❤️'.repeat(Math.max(0, st.me.hp))}</small>
        </div>
        <div className="ft-mid">
          <b>
            격침 {st.kills}/{st.foes.length}
          </b>
          <small>{aim.current ? '🎯 어뢰 쏠 곳을 눌러요' : '바다를 누르면 그쪽으로 가요'}</small>
        </div>
        <div className="ft-hp foe" />
        <button className="ft-exit" onClick={() => finish(huntScore(st))}>✕</button>
      </div>
      {warn && !st.done && <div className="ft-turn">🔊 어뢰 접근! 피해요</div>}
      {st.done && <div className="ft-turn">{st.kills >= st.foes.length ? '🏆 적 잠수함 전멸!' : st.me.hp <= 0 ? '💀 피격 침몰' : '🚀 어뢰 소진'}</div>}
      <div className="if-ctl">
        <div className="if-pad">
          <button disabled={st.pingCool > 0} onPointerDown={() => (huntPing(st), hud.bump())}>
            📡 {st.pingCool > 0 ? Math.ceil(st.pingCool) : '핑'}
          </button>
        </div>
        <div className="if-pad">
          <button className={`fa-big ${aim.current ? 'if-jump' : ''}`} disabled={st.ammo <= 0} onPointerDown={() => ((aim.current = !aim.current), hud.bump())}>
            🎯 어뢰 {st.ammo}/{OTORPS}
          </button>
        </div>
      </div>
    </div>
  );
}
function subShape(g: CanvasRenderingContext2D, x: number, y: number, dir: number, fill: string, stroke?: string) {
  g.save();
  g.translate(x, y);
  g.scale(dir, 1);
  g.beginPath();
  g.ellipse(0, 0, 58, 14, 0, 0, Math.PI * 2);
  g.rect(-10, -26, 26, 14);
  g.fillStyle = fill;
  g.fill();
  if (stroke) {
    g.strokeStyle = stroke;
    g.lineWidth = 2;
    g.stroke();
  }
  g.restore();
}
function drawHunt(c: HTMLCanvasElement, v: View, s: Hunt, aiming: boolean) {
  const g = c.getContext('2d');
  if (!g) return;
  clear(g, c, '#03101c', '#000508');
  world(g, v);
  // 바닥 바위
  g.fillStyle = '#0a1a22';
  g.beginPath();
  g.moveTo(0, OH);
  for (let x = 0; x <= OW; x += 40) g.lineTo(x, OH - 30 - Math.abs(Math.sin(x * 0.013)) * 50);
  g.lineTo(OW, OH);
  g.fill();
  // 핑 고리
  for (const p of s.pings) {
    const r = p.mine ? p.t * 650 : 30 + p.t * 120;
    g.strokeStyle = p.mine ? `rgba(90,230,200,${Math.max(0, 0.8 - p.t / 2.2)})` : `rgba(255,150,60,${Math.max(0, 1 - p.t / 2.2)})`;
    g.lineWidth = p.mine ? 4 : 3;
    g.beginPath();
    g.arc(p.x, p.y, r, 0, Math.PI * 2);
    g.stroke();
  }
  // 접촉(핑에 잡힌 적)
  for (const ct of s.contacts) {
    const a = Math.max(0, 1 - ct.t / 3);
    subShape(g, ct.x, ct.y, -1, `rgba(255,80,60,${a * 0.55})`, `rgba(255,120,90,${a})`);
    g.strokeStyle = `rgba(255,90,70,${a})`;
    g.lineWidth = 2;
    g.strokeRect(ct.x - 70, ct.y - 34, 140, 60);
  }
  // 어뢰
  for (const t of s.torps) {
    const near = Math.hypot(t.x - s.me.x, t.y - s.me.y) < 520;
    if (!t.mine && !near) continue;
    g.strokeStyle = t.mine ? '#7ff' : '#ffb0a0';
    g.lineWidth = 4;
    g.beginPath();
    g.moveTo(t.x, t.y);
    g.lineTo(t.x - t.vx * 0.12, t.y - t.vy * 0.12);
    g.stroke();
    if (!t.mine) {
      g.strokeStyle = 'rgba(255,180,160,0.4)';
      g.beginPath();
      g.arc(t.x, t.y, 18 + Math.sin(performance.now() / 80) * 6, 0, Math.PI * 2);
      g.stroke();
    }
  }
  // 우리 잠수함
  const m = s.me;
  if (Math.hypot(m.tx - m.x, m.ty - m.y) > 4) {
    g.strokeStyle = 'rgba(120,255,200,0.35)';
    g.setLineDash([8, 10]);
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(m.x, m.y);
    g.lineTo(m.tx, m.ty);
    g.stroke();
    g.setLineDash([]);
  }
  subShape(g, m.x, m.y, m.tx >= m.x ? 1 : -1, s.hurt > 0 ? '#a33' : '#2b6b55', '#8fffd0');
  if (aiming) {
    g.strokeStyle = 'rgba(127,255,255,0.25)';
    g.lineWidth = 2;
    g.beginPath();
    g.arc(m.x, m.y, 300, 0, Math.PI * 2);
    g.stroke();
  }
  // 물 알갱이
  g.fillStyle = 'rgba(160,220,255,0.12)';
  const tt = performance.now() / 1000;
  for (let i = 0; i < 70; i++) g.fillRect(((i * 211 + tt * 8) % OW), ((i * 97 - tt * 14) % OH + OH) % OH, 3, 3);
}

// ───────────────────────── 9 자폭 보트 돌격 ─────────────────────────
export function GRun({ level, seed, report, finish }: MiniProps) {
  const { cv, rot } = useFullCanvas();
  const s = useRef<Run>(newRun(seed, level));
  const k = useRef(1);
  const hud = useHud();
  const end = useEnd(finish);
  useLoop((dt) => {
    const st = s.current;
    stepRun(st, dt);
    const sc = runScore(st);
    report(sc);
    end(st.done, sc);
    const c = cv.current;
    if (c) {
      k.current = c.height / RH;
      drawRun(c, st, k.current);
    }
    hud.sync(`${st.hp}|${Math.round(st.fuel / 5)}|${Math.round((st.x / RL) * 50)}|${st.done}`);
  });
  const steer = (e: React.PointerEvent) => {
    if (e.type === 'pointermove' && e.buttons === 0 && e.pointerType === 'mouse') return;
    const p = localPt(e, cv.current, rot);
    s.current.ty = p.y / k.current;
  };
  const st = s.current;
  return (
    <div className={`ft-full ${rot ? 'rot' : ''}`}>
      <canvas ref={cv} className="ft-canvas" onPointerDown={steer} onPointerMove={steer} />
      <div className="ft-hud">
        <div className="ft-hp me">
          <small>🚤 선체 {'❤️'.repeat(Math.max(0, st.hp))}{'🖤'.repeat(Math.max(0, RHP - st.hp))} · ⛽ {Math.round(st.fuel)}</small>
          <i style={{ width: `${st.fuel}%`, background: '#f5c542' }} />
        </div>
        <div className="ft-mid">
          <b>적 구축함까지 {Math.max(0, Math.round((RL - st.x) / 10))}m</b>
          <small>화면을 위아래로 끌어 방향</small>
        </div>
        <div className="ft-hp foe">
          <small>진행</small>
          <i style={{ width: `${Math.min(100, (st.x / RL) * 100)}%`, background: '#7bd88f' }} />
        </div>
        <button className="ft-exit" onClick={() => finish(runScore(st))}>✕</button>
      </div>
      {st.done && <div className="ft-turn">{st.win ? '💥 구축함 명중!' : st.x >= RL - 160 ? '🌊 빗나감' : st.hp <= 0 ? '💀 보트 격파' : '⛽ 연료 바닥'}</div>}
    </div>
  );
}
function drawRun(c: HTMLCanvasElement, s: Run, k: number) {
  const g = c.getContext('2d');
  if (!g) return;
  clear(g, c, '#1f5f86', '#0c3550');
  const viewW = c.width / k;
  const camX = s.x - viewW * 0.22;
  g.setTransform(k, 0, 0, k, -camX * k, 0);
  // 물결
  g.strokeStyle = 'rgba(255,255,255,0.13)';
  g.lineWidth = 3;
  for (let i = 0; i < 40; i++) {
    const wx = Math.floor(camX / 220) * 220 + (i % 10) * 220 + (Math.floor(i / 10) % 2) * 110;
    const wy = 60 + Math.floor(i / 10) * 230 + ((i * 37) % 80);
    g.beginPath();
    g.moveTo(wx, wy);
    g.quadraticCurveTo(wx + 30, wy - 10, wx + 60, wy);
    g.stroke();
  }
  for (const o of s.obs) {
    if (o.gone || o.x < camX - 100 || o.x > camX + viewW + 100) continue;
    if (o.k === 'mine') {
      g.fillStyle = '#1a1a1a';
      g.beginPath();
      g.arc(o.x, o.y, 24, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = '#1a1a1a';
      g.lineWidth = 5;
      for (let a = 0; a < 8; a++) {
        g.beginPath();
        g.moveTo(o.x + Math.cos(a) * 20, o.y + Math.sin(a) * 20);
        g.lineTo(o.x + Math.cos(a) * 34, o.y + Math.sin(a) * 34);
        g.stroke();
      }
      g.fillStyle = '#e33';
      g.beginPath();
      g.arc(o.x, o.y, 5, 0, Math.PI * 2);
      g.fill();
    } else if (o.k === 'buoy') {
      g.fillStyle = '#d33';
      g.beginPath();
      g.arc(o.x, o.y, 22, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#fff';
      g.fillRect(o.x - 22, o.y - 5, 44, 10);
    } else if (o.k === 'patrol') {
      g.fillStyle = '#6d7880';
      g.beginPath();
      g.moveTo(o.x - 60, o.y - 22);
      g.lineTo(o.x + 40, o.y - 22);
      g.lineTo(o.x + 66, o.y);
      g.lineTo(o.x + 40, o.y + 22);
      g.lineTo(o.x - 60, o.y + 22);
      g.fill();
      g.fillStyle = '#4b555c';
      g.fillRect(o.x - 30, o.y - 12, 34, 24);
      g.strokeStyle = '#333';
      g.lineWidth = 5;
      g.beginPath();
      g.moveTo(o.x - 10, o.y);
      g.lineTo(o.x - 42, o.y + (s.y > o.y ? 10 : -10));
      g.stroke();
    } else {
      g.fillStyle = '#f5c542';
      rr(g, o.x - 20, o.y - 26, 40, 52, 8);
      g.fill();
      g.fillStyle = '#7a5a10';
      g.font = 'bold 26px sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText('⛽', o.x, o.y + 2);
    }
  }
  g.fillStyle = '#ffd34d';
  for (const b of s.bullets) {
    g.beginPath();
    g.arc(b.x, b.y, 6, 0, Math.PI * 2);
    g.fill();
  }
  // 적 구축함(끝)
  const sx = RL - 100;
  if (sx < camX + viewW + 400) {
    g.fillStyle = '#59636b';
    rr(g, sx, s.ship.y - s.ship.h / 2 - 160, 140, s.ship.h + 320, 70);
    g.fill();
    g.fillStyle = 'rgba(255,60,40,0.55)';
    g.fillRect(sx - 6, s.ship.y - s.ship.h / 2, 18, s.ship.h);
    g.fillStyle = '#434b52';
    g.fillRect(sx + 35, s.ship.y - 70, 70, 140);
  }
  // 우리 보트 + 물보라
  g.fillStyle = 'rgba(255,255,255,0.35)';
  g.beginPath();
  g.moveTo(s.x - 30, s.y);
  g.lineTo(s.x - 200, s.y - 40);
  g.lineTo(s.x - 200, s.y + 40);
  g.fill();
  if (!(s.invul > 0 && Math.floor(s.t * 12) % 2)) {
    g.fillStyle = '#e07a2f';
    g.beginPath();
    g.moveTo(s.x - 40, s.y - 16);
    g.lineTo(s.x + 24, s.y - 16);
    g.lineTo(s.x + 48, s.y);
    g.lineTo(s.x + 24, s.y + 16);
    g.lineTo(s.x - 40, s.y + 16);
    g.fill();
    g.fillStyle = '#333';
    g.fillRect(s.x - 18, s.y - 8, 22, 16);
  }
}

// ───────────────────────── 10 스텔스 침투 ─────────────────────────
export function GStealth({ level, seed, report, finish }: MiniProps) {
  const { cv, rot } = useFullCanvas();
  const s = useRef<Stealth>(newStealth(seed, level));
  const drawing = useRef(false);
  const view = useRef<View>({ sc: 1, ox: 0, oy: 0 });
  const hud = useHud();
  const end = useEnd(finish);
  useLoop((dt) => {
    const st = s.current;
    stepStealth(st, dt);
    const sc = stealthScore(st);
    report(sc);
    end(st.done, sc);
    const c = cv.current;
    if (c) {
      view.current = fitView(c, AW, AH);
      drawStealth(c, view.current, st);
    }
    hud.sync(`${st.m}|${st.flying}|${Math.round(st.det * 20)}|${pathReady(st)}|${Math.round(pathLen(st.path) / 40)}|${st.done}`);
  });
  const down = (e: React.PointerEvent) => {
    const st = s.current;
    if (st.flying || st.done) return;
    const w = toWorld(view.current, localPt(e, cv.current, rot));
    st.path = [];
    drawing.current = addPoint(st, w);
    hud.bump();
  };
  const move = (e: React.PointerEvent) => {
    if (!drawing.current) return;
    addPoint(s.current, toWorld(view.current, localPt(e, cv.current, rot)));
  };
  const up = () => {
    drawing.current = false;
    hud.bump();
  };
  const st = s.current;
  const ms = st.missions[Math.min(st.m, st.missions.length - 1)];
  const fuel = ms ? 1 - pathLen(st.path) / ms.maxLen : 0;
  const last = st.res[st.res.length - 1];
  return (
    <div className={`ft-full ${rot ? 'rot' : ''}`}>
      <canvas ref={cv} className="ft-canvas" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} />
      <div className="ft-hud">
        <div className="ft-hp me">
          <small>⛽ 연료(그릴 수 있는 길) {Math.round(fuel * 100)}%</small>
          <i style={{ width: `${fuel * 100}%`, background: '#f5c542' }} />
        </div>
        <div className="ft-mid">
          <b>
            작전 {Math.min(st.m + 1, st.missions.length)}/{st.missions.length} {st.res.map((r) => (r === 'ok' ? '✅' : '❌')).join('')}
          </b>
          <small>{st.flying ? '비행 중…' : st.path.length > 1 ? (pathReady(st) ? '▶ 출격을 눌러요' : '🎯 표적까지 이어 그려요') : '🛫에서 🎯까지 손가락으로 길을 그려요'}</small>
        </div>
        <div className="ft-hp foe">
          <small>탐지 {Math.round(st.det * 100)}%</small>
          <i style={{ width: `${Math.min(100, st.det * 100)}%` }} />
        </div>
        <button className="ft-exit" onClick={() => finish(stealthScore(st))}>✕</button>
      </div>
      {!st.flying && last && !st.done && st.path.length < 2 && <div className="ft-turn">{last === 'ok' ? '✅ 표적 타격 성공' : '❌ 탐지되어 격추'} · 다음 작전</div>}
      {st.done && <div className="ft-turn">{st.res.every((r) => r === 'ok') ? '🏆 작전 3개 모두 성공!' : `작전 ${st.res.filter((r) => r === 'ok').length}/3 성공`}</div>}
      <div className="if-ctl">
        <div className="if-pad">
          <button disabled={st.flying || !st.path.length} onPointerDown={() => ((st.path = []), hud.bump())}>
            ↺ 다시
          </button>
        </div>
        <div className="if-pad">
          <button className="if-jump fa-big" disabled={!pathReady(st) || st.flying} onPointerDown={() => (fly(st), hud.bump())}>
            ▶ 출격
          </button>
        </div>
      </div>
    </div>
  );
}
function drawStealth(c: HTMLCanvasElement, v: View, s: Stealth) {
  const g = c.getContext('2d');
  if (!g) return;
  clear(g, c, '#1c2a1e', '#141d16');
  world(g, v);
  const ms = s.missions[Math.min(s.m, s.missions.length - 1)];
  // 땅결
  g.fillStyle = '#3a4a2f';
  g.fillRect(0, 0, AW, AH);
  g.strokeStyle = 'rgba(255,255,255,0.05)';
  g.lineWidth = 2;
  for (let i = 0; i < 18; i++) {
    g.beginPath();
    for (let x = 0; x <= AW; x += 40) g.lineTo(x, i * 55 + Math.sin(x * 0.006 + i) * 18);
    g.stroke();
  }
  for (const vl of ms.valleys) {
    const gr = g.createRadialGradient(vl.x, vl.y, 0, vl.x, vl.y, vl.r);
    gr.addColorStop(0, 'rgba(40,120,60,0.85)');
    gr.addColorStop(1, 'rgba(40,120,60,0.15)');
    g.fillStyle = gr;
    g.beginPath();
    g.arc(vl.x, vl.y, vl.r, 0, Math.PI * 2);
    g.fill();
  }
  // 레이더
  for (const r of ms.radars) {
    g.fillStyle = 'rgba(255,60,40,0.08)';
    g.beginPath();
    g.arc(r.x, r.y, r.r, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = 'rgba(255,90,60,0.4)';
    g.lineWidth = 2;
    g.stroke();
    const a = beamAngle(r, s.t);
    g.fillStyle = 'rgba(255,90,60,0.35)';
    g.beginPath();
    g.moveTo(r.x, r.y);
    g.arc(r.x, r.y, r.r, a - 0.4, a + 0.4);
    g.closePath();
    g.fill();
    g.fillStyle = 'rgba(255,60,40,0.25)';
    g.beginPath();
    g.arc(r.x, r.y, r.r * 0.3, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#ddd';
    g.fillRect(r.x - 8, r.y - 8, 16, 16);
  }
  // 출발·표적
  g.font = '44px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.strokeStyle = 'rgba(123,216,143,0.8)';
  g.lineWidth = 3;
  g.beginPath();
  g.arc(ms.start.x, ms.start.y, 60, 0, Math.PI * 2);
  g.stroke();
  g.fillText('🛫', ms.start.x, ms.start.y);
  g.strokeStyle = 'rgba(255,211,77,0.9)';
  g.beginPath();
  g.arc(ms.target.x, ms.target.y, 60, 0, Math.PI * 2);
  g.stroke();
  g.fillText('🎯', ms.target.x, ms.target.y);
  // 길
  if (s.path.length > 1) {
    g.strokeStyle = pathReady(s) ? '#ffd34d' : 'rgba(255,211,77,0.7)';
    g.lineWidth = 6;
    g.setLineDash([16, 12]);
    g.lineCap = 'round';
    g.beginPath();
    s.path.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)));
    g.stroke();
    g.setLineDash([]);
  }
  if (s.flying) {
    const p = pointAt(s.path, s.pos), q = pointAt(s.path, s.pos + 6);
    const a = Math.atan2(q.y - p.y, q.x - p.x);
    g.save();
    g.translate(p.x, p.y);
    g.rotate(a);
    g.fillStyle = s.det > 0.6 ? '#ff8a6a' : '#1c1f24';
    g.strokeStyle = '#9fb3c8';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(30, 0);
    g.lineTo(-20, -28);
    g.lineTo(-12, 0);
    g.lineTo(-20, 28);
    g.closePath();
    g.fill();
    g.stroke();
    g.restore();
  }
}
// 화면 크기 상수(다른 곳 참고용)
export const FULLB_SIZE = { CW, CH, OW, OH, AW, AH, RH };
