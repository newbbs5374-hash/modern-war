// 11-28 새 전체 화면 훈련 묶음 A 화면(계산은 battle/fullA.ts). 모두 화면을 다 쓰고, 세로 화면이면 눕혀서 씀.
// GPairs 부품 짝 맞추기 · GJigsaw 위성 사진 맞추기 · GBomb 폭격 투하 · GBallistic 탄도 사격 · GShield 하늘의 방패
import { useMemo, useRef, useState } from 'react';
import {
  BGROUND, BH, BOMB_R, BPASSES, BS, BW, JB, JH, JW, MGROUND, MH, MSHOTS, M_R, MW, PARTS, SGROUND, SH, SW, WAVES,
  aaIn, ballisticScore, bombScore, burstR, dropBomb, dropPiece, findPair, flakAt, hillAt, jigsawDone, jigsawScore, launch, newBallistic, newBombRun, newJigsaw, newPairs, newShield, pairsScore, pickPiece, planeY, preview, pullVel, reshuffle, shieldScore, shoot, stepBallistic, stepBombRun, stepShield, tryPair,
  type Ballistic, type BombRun, type Cell, type Fort, type Jigsaw, type Pairs, type Piece, type Pt, type Shield,
} from '../../../battle/fullA';
import { Rng } from '../../../game/rng';
import { fitCam, fitView, localPt, rr, screenDelta, toWorld, useFullCanvas, type View } from './full';
import { useLoop, type MiniProps } from './kit';

const EMOJI = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';

/** 끝나면 1.2초 뒤 한 번만 finish */
function useEnd(finish: (s: number) => void) {
  const ended = useRef(false);
  return (done: boolean, score: number) => {
    if (done && !ended.current) {
      ended.current = true;
      setTimeout(() => finish(score), 1200);
    }
  };
}
const world = (g: CanvasRenderingContext2D, v: View) => g.setTransform(v.sc, 0, 0, v.sc, v.ox, v.oy);

// ───────────────────────── 1 부품 짝 맞추기 ─────────────────────────
const PAIR_SECS = 180;
function pairGeo(p: Pairs) {
  const cols = p.cols + 2, rows = p.rows + 2;
  const cell = Math.min(1560 / cols, 790 / rows);
  return { cell, bx: (1600 - cell * cols) / 2, by: 100 + (790 - cell * rows) / 2 };
}
export function GPairs({ level, seed, report, finish }: MiniProps) {
  const { cv, rot } = useFullCanvas();
  const p = useRef<Pairs>(newPairs(seed, level));
  const u = useRef({ sel: null as Cell | null, path: null as Cell[] | null, pathT: 0, hint: null as [Cell, Cell] | null, pops: [] as Array<Cell & { t: number; k: number }>, bad: 0, sec: -1, msg: '' });
  const [, force] = useState(0);
  const end = useEnd(finish);
  const view = useRef<View>({ sc: 1, ox: 0, oy: 0 });

  useLoop((dt) => {
    const st = p.current, s = u.current;
    if (st.left > 0 && st.t < PAIR_SECS) st.t += dt;
    s.pathT = Math.max(0, s.pathT - dt);
    s.bad = Math.max(0, s.bad - dt);
    for (const x of s.pops) x.t += dt;
    s.pops = s.pops.filter((x) => x.t < 0.45);
    const sc = pairsScore(st, PAIR_SECS);
    report(sc);
    end(st.left === 0 || st.t >= PAIR_SECS, sc);
    const c = cv.current;
    if (c) {
      view.current = fitView(c, 1600, 900);
      drawPairs(c, view.current, st, s);
    }
    if (Math.floor(st.t) !== s.sec) {
      s.sec = Math.floor(st.t);
      force((n) => n + 1);
    }
  });

  const tap = (e: React.PointerEvent) => {
    const st = p.current, s = u.current;
    if (st.left === 0 || st.t >= PAIR_SECS) return;
    const w = toWorld(view.current, localPt(e, cv.current, rot));
    const { cell, bx, by } = pairGeo(st);
    const c = Math.floor((w.x - bx) / cell), r = Math.floor((w.y - by) / cell);
    if (r < 1 || c < 1 || r > st.rows || c > st.cols || !st.b[r][c]) return;
    const here = { r, c };
    if (!s.sel) s.sel = here;
    else if (s.sel.r === r && s.sel.c === c) s.sel = null;
    else {
      const k = st.b[r][c];
      const a = s.sel;
      const path = tryPair(st, a, here);
      if (path) {
        s.pops.push({ ...a, t: 0, k }, { ...here, t: 0, k });
        s.path = path;
        s.pathT = 0.4;
        s.sel = null;
        s.hint = null;
        s.msg = st.shuffles && st.left > 0 && !findPair(st) ? '' : s.msg;
      } else {
        if (st.b[a.r][a.c] === k) s.bad = 0.35;
        s.sel = here;
      }
    }
    force((n) => n + 1);
  };
  const hint = () => {
    const st = p.current;
    if (st.hints <= 0) return;
    st.hints--;
    u.current.hint = findPair(st);
    force((n) => n + 1);
  };
  const mix = () => {
    const st = p.current;
    reshuffle(st);
    st.t = Math.min(PAIR_SECS, st.t + 10);
    u.current.sel = null;
    u.current.hint = null;
    force((n) => n + 1);
  };
  const st = p.current;
  const left = Math.max(0, Math.ceil(PAIR_SECS - st.t));
  return (
    <div className={`ft-full ${rot ? 'rot' : ''}`}>
      <canvas ref={cv} className="ft-canvas" onPointerDown={tap} />
      <div className="ft-hud">
        <div className="ft-hp me">
          <small>🛸 무인기 부품 · 남은 {st.left}개</small>
          <i style={{ width: `${((st.total - st.left) / st.total) * 100}%`, background: '#7bd88f' }} />
        </div>
        <div className="ft-mid">
          <b>⏱ {Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}</b>
          <small>꺾임 2번까지 이어지면 사라져요</small>
        </div>
        <div className="fa-btns">
          <button onClick={hint} disabled={st.hints <= 0}>💡 {st.hints}</button>
          <button onClick={mix}>🔀 +10초</button>
        </div>
        <button className="ft-exit" onClick={() => finish(pairsScore(st, PAIR_SECS))}>✕</button>
      </div>
      {st.left === 0 && <div className="ft-turn">🛸 무인기 조립 완료!</div>}
      {st.left > 0 && st.t >= PAIR_SECS && <div className="ft-turn">⏱ 시간 끝</div>}
    </div>
  );
}
function tileFace(g: CanvasRenderingContext2D, x: number, y: number, cell: number, k: number, glow: string | null) {
  const pad = cell * 0.06;
  g.fillStyle = 'rgba(0,0,0,0.35)';
  rr(g, x + pad + 3, y + pad + 5, cell - pad * 2, cell - pad * 2, cell * 0.14);
  g.fill();
  const gr = g.createLinearGradient(x, y, x, y + cell);
  gr.addColorStop(0, '#f4f7fb');
  gr.addColorStop(1, '#b9c6d4');
  g.fillStyle = gr;
  rr(g, x + pad, y + pad, cell - pad * 2, cell - pad * 2, cell * 0.14);
  g.fill();
  g.strokeStyle = glow ?? 'rgba(40,60,80,0.45)';
  g.lineWidth = glow ? 6 : 2;
  g.stroke();
  g.font = `${Math.round(cell * 0.56)}px ${EMOJI}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = '#000';
  g.fillText(PARTS[(k - 1) % PARTS.length], x + cell / 2, y + cell / 2 + cell * 0.03);
}
function drawPairs(c: HTMLCanvasElement, v: View, p: Pairs, s: { sel: Cell | null; path: Cell[] | null; pathT: number; hint: [Cell, Cell] | null; pops: Array<Cell & { t: number; k: number }>; bad: number }) {
  const g = c.getContext('2d');
  if (!g) return;
  g.setTransform(1, 0, 0, 1, 0, 0);
  const bg = g.createLinearGradient(0, 0, 0, c.height);
  bg.addColorStop(0, '#1d2d3f');
  bg.addColorStop(1, '#0d1620');
  g.fillStyle = bg;
  g.fillRect(0, 0, c.width, c.height);
  world(g, v);
  const { cell, bx, by } = pairGeo(p);
  // 작업대
  g.fillStyle = 'rgba(120,160,190,0.12)';
  rr(g, bx + cell * 0.6, by + cell * 0.6, cell * (p.cols + 0.8), cell * (p.rows + 0.8), 18);
  g.fill();
  g.strokeStyle = 'rgba(160,200,230,0.25)';
  g.lineWidth = 2;
  g.stroke();
  const t = performance.now() / 1000;
  for (let r = 1; r <= p.rows; r++)
    for (let cc = 1; cc <= p.cols; cc++) {
      const k = p.b[r][cc];
      if (!k) continue;
      const sel = s.sel && s.sel.r === r && s.sel.c === cc;
      const hint = s.hint && s.hint.some((h) => h.r === r && h.c === cc);
      let x = bx + cc * cell, y = by + r * cell;
      if (sel) y -= 6;
      if (sel && s.bad > 0) x += Math.sin(s.bad * 60) * 5;
      tileFace(g, x, y, cell, k, sel ? '#ffd34d' : hint ? `rgba(123,216,143,${0.6 + 0.4 * Math.sin(t * 8)})` : null);
    }
  // 이은 길
  if (s.path && s.pathT > 0) {
    g.strokeStyle = `rgba(255,211,77,${s.pathT / 0.4})`;
    g.lineWidth = 8;
    g.lineJoin = 'round';
    g.beginPath();
    s.path.forEach((q, i) => {
      const x = bx + q.c * cell + cell / 2, y = by + q.r * cell + cell / 2;
      if (i) g.lineTo(x, y);
      else g.moveTo(x, y);
    });
    g.stroke();
  }
  for (const q of s.pops) {
    const k = q.t / 0.45;
    g.save();
    g.globalAlpha = 1 - k;
    const cx = bx + q.c * cell + cell / 2, cy = by + q.r * cell + cell / 2;
    g.translate(cx, cy);
    g.scale(1 + k * 0.5, 1 + k * 0.5);
    tileFace(g, -cell / 2, -cell / 2, cell, q.k, '#7bd88f');
    g.restore();
  }
}

// ───────────────────────── 2 위성 사진 맞추기 ─────────────────────────
const JIG_SECS = 180;
/** 씨앗으로 위성 사진(밭·강·길·마을·활주로·기지)을 그림 */
function makeSatImage(seed: number): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = JB.w;
  cv.height = JB.h;
  const g = cv.getContext('2d')!;
  const rng = new Rng((seed ^ 0x5a17) >>> 0 || 1);
  g.fillStyle = '#5d7a3e';
  g.fillRect(0, 0, JB.w, JB.h);
  const pal = ['#6f8b45', '#8a9a52', '#a39a62', '#4f6d36', '#7d6b45', '#93a86a', '#b5a774'];
  for (let i = 0; i < 70; i++) {
    g.save();
    g.translate(rng.range(0, JB.w), rng.range(0, JB.h));
    g.rotate(rng.range(-0.25, 0.25));
    g.fillStyle = rng.pick(pal);
    const w = rng.range(50, 160), h = rng.range(40, 120);
    g.fillRect(-w / 2, -h / 2, w, h);
    g.strokeStyle = 'rgba(0,0,0,0.12)';
    for (let k = -w / 2; k < w / 2; k += 9) {
      g.beginPath();
      g.moveTo(k, -h / 2);
      g.lineTo(k, h / 2);
      g.stroke();
    }
    g.restore();
  }
  // 숲
  for (let i = 0; i < 260; i++) {
    g.fillStyle = `rgba(${30 + rng.range(0, 20)},${60 + rng.range(0, 30)},${30},0.8)`;
    g.beginPath();
    g.arc(rng.range(0, 260), rng.range(JB.h * 0.5, JB.h), rng.range(5, 12), 0, Math.PI * 2);
    g.fill();
  }
  // 강
  const ry = rng.range(120, 220);
  g.lineCap = 'round';
  for (const [w, col] of [[44, '#8fa46a'], [30, '#3c6e8f'], [14, '#4d86a8']] as Array<[number, string]>) {
    g.strokeStyle = col;
    g.lineWidth = w;
    g.beginPath();
    g.moveTo(-20, ry);
    g.bezierCurveTo(JB.w * 0.3, ry + 220, JB.w * 0.6, ry - 160, JB.w + 20, ry + 120);
    g.stroke();
  }
  // 길
  for (let i = 0; i < 3; i++) {
    const y0 = rng.range(0, JB.h), y1 = rng.range(0, JB.h);
    g.strokeStyle = '#c9c0ae';
    g.lineWidth = 9;
    g.beginPath();
    g.moveTo(0, y0);
    g.quadraticCurveTo(JB.w / 2, rng.range(0, JB.h), JB.w, y1);
    g.stroke();
    g.strokeStyle = '#8a8274';
    g.lineWidth = 1.5;
    g.setLineDash([10, 10]);
    g.stroke();
    g.setLineDash([]);
  }
  // 마을
  const tx = rng.range(300, 520), ty = rng.range(300, 480);
  for (let i = 0; i < 70; i++) {
    g.fillStyle = rng.pick(['#d8d2c6', '#b9b3a8', '#c98f7a', '#a9a9a9', '#e6e1d6']);
    g.fillRect(tx + rng.range(-110, 110), ty + rng.range(-70, 70), rng.range(8, 20), rng.range(8, 18));
  }
  // 활주로
  g.save();
  g.translate(rng.range(620, 760), rng.range(380, 480));
  g.rotate(rng.range(-0.5, 0.5));
  g.fillStyle = '#4a4d50';
  g.fillRect(-170, -16, 340, 32);
  g.fillStyle = '#e8e8e8';
  for (let k = -150; k < 150; k += 30) g.fillRect(k, -2, 16, 4);
  g.restore();
  // 적 기지(둘레 울타리·격납고)
  const bx = rng.range(640, 820), by = rng.range(60, 180);
  g.strokeStyle = '#d7d2b0';
  g.lineWidth = 3;
  g.strokeRect(bx, by, 120, 90);
  g.fillStyle = '#6d7376';
  for (let i = 0; i < 3; i++) {
    g.beginPath();
    g.ellipse(bx + 25 + i * 35, by + 30, 13, 18, 0, 0, Math.PI * 2);
    g.fill();
  }
  g.fillStyle = '#9da3a6';
  g.fillRect(bx + 15, by + 60, 90, 18);
  // 사진 결
  for (let i = 0; i < 2600; i++) {
    g.fillStyle = `rgba(${rng.chance(0.5) ? 255 : 0},${rng.chance(0.5) ? 255 : 0},${rng.chance(0.5) ? 255 : 0},0.05)`;
    g.fillRect(rng.range(0, JB.w), rng.range(0, JB.h), 2, 2);
  }
  return cv;
}
function edge(g: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, nx: number, ny: number, s: number, h: number) {
  if (!s) {
    g.lineTo(x1, y1);
    return;
  }
  const dx = x1 - x0, dy = y1 - y0;
  const P = (t: number, o: number): [number, number] => [x0 + dx * t + nx * o * s * h, y0 + dy * t + ny * o * s * h];
  g.lineTo(...P(0.38, 0));
  g.bezierCurveTo(...P(0.42, 0.5), ...P(0.3, 1), ...P(0.5, 1));
  g.bezierCurveTo(...P(0.7, 1), ...P(0.58, 0.5), ...P(0.62, 0));
  g.lineTo(x1, y1);
}
function piecePath(g: CanvasRenderingContext2D, j: Jigsaw, p: Piece, x: number, y: number) {
  const { pw, ph } = j;
  const h = Math.min(pw, ph) * 0.2;
  const top = p.r > 0 ? -j.tabB[p.r - 1][p.c] : 0;
  const right = p.c < j.cols - 1 ? j.tabR[p.r][p.c] : 0;
  const bot = p.r < j.rows - 1 ? j.tabB[p.r][p.c] : 0;
  const left = p.c > 0 ? -j.tabR[p.r][p.c - 1] : 0;
  g.beginPath();
  g.moveTo(x, y);
  edge(g, x, y, x + pw, y, 0, -1, top, h);
  edge(g, x + pw, y, x + pw, y + ph, 1, 0, right, h);
  edge(g, x + pw, y + ph, x, y + ph, 0, 1, bot, h);
  edge(g, x, y + ph, x, y, -1, 0, left, h);
  g.closePath();
}
export function GJigsaw({ level, seed, report, finish }: MiniProps) {
  const { cv, rot } = useFullCanvas();
  const j = useRef<Jigsaw>(newJigsaw(seed, level));
  const img = useMemo(() => makeSatImage(seed), [seed]);
  const view = useRef<View>({ sc: 1, ox: 0, oy: 0 });
  const drag = useRef<{ i: number; dx: number; dy: number } | null>(null);
  const flash = useRef<Array<{ x: number; y: number; t: number }>>([]);
  const sec = useRef(-1);
  const [, force] = useState(0);
  const end = useEnd(finish);

  useLoop((dt) => {
    const st = j.current;
    const done = jigsawDone(st);
    if (!done && st.t < JIG_SECS) st.t += dt;
    for (const f of flash.current) f.t += dt;
    flash.current = flash.current.filter((f) => f.t < 0.6);
    const sc = jigsawScore(st, JIG_SECS);
    report(sc);
    end(done || st.t >= JIG_SECS, sc);
    const c = cv.current;
    if (c) {
      view.current = fitView(c, JW, JH);
      drawJigsaw(c, view.current, st, img, drag.current?.i ?? -1, flash.current, done);
    }
    if (Math.floor(st.t) !== sec.current) {
      sec.current = Math.floor(st.t);
      force((n) => n + 1);
    }
  });
  const down = (e: React.PointerEvent) => {
    const st = j.current;
    const w = toWorld(view.current, localPt(e, cv.current, rot));
    const i = pickPiece(st, w.x, w.y);
    if (i < 0) return;
    const [p] = st.pieces.splice(i, 1);
    st.pieces.push(p);
    drag.current = { i: st.pieces.length - 1, dx: w.x - p.x, dy: w.y - p.y };
  };
  const move = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const w = toWorld(view.current, localPt(e, cv.current, rot));
    const p = j.current.pieces[d.i];
    p.x = w.x - d.dx;
    p.y = w.y - d.dy;
  };
  const up = () => {
    const d = drag.current;
    if (!d) return;
    drag.current = null;
    const st = j.current;
    const p = st.pieces[d.i];
    if (dropPiece(st, d.i, p.x, p.y)) {
      // 붙은 조각은 맨 아래로
      st.pieces.splice(d.i, 1);
      st.pieces.unshift(p);
      flash.current.push({ x: p.x + st.pw / 2, y: p.y + st.ph / 2, t: 0 });
      force((n) => n + 1);
    }
  };
  const st = j.current;
  const placed = st.pieces.filter((p) => p.placed).length;
  const left = Math.max(0, Math.ceil(JIG_SECS - st.t));
  return (
    <div className={`ft-full ${rot ? 'rot' : ''}`} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
      <canvas ref={cv} className="ft-canvas" />
      <div className="ft-hud" onPointerDown={(e) => e.stopPropagation()}>
        <div className="ft-hp me">
          <small>🛰️ 정찰 사진 {placed}/{st.pieces.length}조각</small>
          <i style={{ width: `${(placed / st.pieces.length) * 100}%`, background: '#7bd88f' }} />
        </div>
        <div className="ft-mid">
          <b>⏱ {Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}</b>
          <small>조각을 끌어 제자리에 놓아요</small>
        </div>
        <div className="ft-hp foe" />
        <button className="ft-exit" onClick={() => finish(jigsawScore(st, JIG_SECS))}>✕</button>
      </div>
      {jigsawDone(st) && <div className="ft-turn">🎯 적 기지 위치 확인!</div>}
    </div>
  );
}
function drawJigsaw(c: HTMLCanvasElement, v: View, j: Jigsaw, img: HTMLCanvasElement, dragI: number, flash: Array<{ x: number; y: number; t: number }>, done: boolean) {
  const g = c.getContext('2d');
  if (!g) return;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.fillStyle = '#121c26';
  g.fillRect(0, 0, c.width, c.height);
  world(g, v);
  // 판
  g.fillStyle = '#0a1118';
  rr(g, JB.x - 14, JB.y - 14, JB.w + 28, JB.h + 28, 14);
  g.fill();
  g.globalAlpha = done ? 1 : 0.16;
  g.drawImage(img, JB.x, JB.y);
  g.globalAlpha = 1;
  g.strokeStyle = 'rgba(120,200,255,0.18)';
  g.lineWidth = 1;
  for (let k = 1; k < j.cols; k++) {
    g.beginPath();
    g.moveTo(JB.x + k * j.pw, JB.y);
    g.lineTo(JB.x + k * j.pw, JB.y + JB.h);
    g.stroke();
  }
  for (let k = 1; k < j.rows; k++) {
    g.beginPath();
    g.moveTo(JB.x, JB.y + k * j.ph);
    g.lineTo(JB.x + JB.w, JB.y + k * j.ph);
    g.stroke();
  }
  // 조각 바구니
  g.fillStyle = 'rgba(255,255,255,0.04)';
  rr(g, JB.x + JB.w + 40, 30, JW - (JB.x + JB.w + 40) - 10, JH - 50, 18);
  g.fill();
  // 조각
  if (!done)
    j.pieces.forEach((p, i) => {
      const lift = i === dragI ? 10 : 0;
      g.save();
      if (!p.placed) {
        g.shadowColor = 'rgba(0,0,0,0.6)';
        g.shadowBlur = 14 + lift;
        g.shadowOffsetY = 4 + lift;
      }
      piecePath(g, j, p, p.x, p.y - lift);
      g.fillStyle = '#333';
      g.fill();
      g.restore();
      g.save();
      piecePath(g, j, p, p.x, p.y - lift);
      g.clip();
      g.drawImage(img, p.x - p.c * j.pw, p.y - lift - p.r * j.ph);
      g.restore();
      piecePath(g, j, p, p.x, p.y - lift);
      g.strokeStyle = p.placed ? 'rgba(255,255,255,0.12)' : i === dragI ? '#ffd34d' : 'rgba(255,255,255,0.55)';
      g.lineWidth = i === dragI ? 3 : 1.5;
      g.stroke();
    });
  for (const f of flash) {
    g.strokeStyle = `rgba(123,216,143,${1 - f.t / 0.6})`;
    g.lineWidth = 6;
    g.beginPath();
    g.arc(f.x, f.y, 30 + f.t * 120, 0, Math.PI * 2);
    g.stroke();
  }
  if (done) {
    g.strokeStyle = '#ff4d3a';
    g.lineWidth = 4;
    g.strokeRect(JB.x, JB.y, JB.w, JB.h);
  }
}

// ───────────────────────── 3·4 공통 그림 ─────────────────────────
function drawFort(g: CanvasRenderingContext2D, f: Fort, dt: number, aim?: Pt) {
  f.cols.forEach((col, i) => {
    col.forEach((b, k) => {
      b.fall = Math.max(0, b.fall - dt * 600);
      const x = f.x + i * BS, y = f.ground - (k + 1) * BS - b.fall;
      if (b.k === 'b') {
        g.fillStyle = '#9a6b3c';
        g.fillRect(x, y, BS, BS);
        g.strokeStyle = '#6b4523';
        g.lineWidth = 2;
        g.strokeRect(x + 1, y + 1, BS - 2, BS - 2);
        g.beginPath();
        g.moveTo(x + 2, y + 2);
        g.lineTo(x + BS - 2, y + BS - 2);
        g.stroke();
      } else if (b.k === 'w') {
        g.fillStyle = b.hp > 1 ? '#8e959b' : '#6b7177';
        g.fillRect(x, y, BS, BS);
        g.strokeStyle = '#55595e';
        g.lineWidth = 2;
        g.strokeRect(x + 1, y + 1, BS - 2, BS - 2);
        if (b.hp < 2) {
          g.beginPath();
          g.moveTo(x + 8, y + 5);
          g.lineTo(x + 20, y + 22);
          g.lineTo(x + 14, y + 34);
          g.stroke();
        }
      } else if (b.k === 'c') {
        g.fillStyle = '#b8332b';
        g.fillRect(x, y, BS, BS);
        g.fillStyle = '#ffd34d';
        g.font = `bold 24px sans-serif`;
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillText('★', x + BS / 2, y + BS / 2 + 1);
        g.strokeStyle = '#ffd34d';
        g.lineWidth = 2;
        g.strokeRect(x + 2, y + 2, BS - 4, BS - 4);
      } else {
        g.fillStyle = '#3d4f33';
        g.fillRect(x + 4, y + 14, BS - 8, BS - 14);
        const a = aim ? Math.atan2(aim.y - (y + 16), aim.x - (x + BS / 2)) : -Math.PI / 2.5;
        g.strokeStyle = '#2a3624';
        g.lineWidth = 6;
        g.beginPath();
        g.moveTo(x + BS / 2, y + 16);
        g.lineTo(x + BS / 2 + Math.cos(a) * 30, y + 16 + Math.sin(a) * 30);
        g.stroke();
      }
    });
  });
}
function drawBooms(g: CanvasRenderingContext2D, booms: Array<Pt & { t: number }>, r: number) {
  for (const b of booms) {
    const k = b.t / 1.2;
    const rad = r * Math.min(1, b.t / 0.25) * (1 + k * 0.3);
    const gr = g.createRadialGradient(b.x, b.y, 0, b.x, b.y, rad);
    gr.addColorStop(0, `rgba(255,240,180,${1 - k})`);
    gr.addColorStop(0.4, `rgba(255,140,40,${0.9 * (1 - k)})`);
    gr.addColorStop(1, 'rgba(90,40,20,0)');
    g.fillStyle = gr;
    g.beginPath();
    g.arc(b.x, b.y, rad, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = `rgba(60,55,50,${0.5 * (1 - k)})`;
    g.beginPath();
    g.arc(b.x, b.y - 40 - k * 80, rad * 0.6, 0, Math.PI * 2);
    g.fill();
  }
}
function sky(g: CanvasRenderingContext2D, W: number, H: number, high: number) {
  const gr = g.createLinearGradient(0, 0, 0, H);
  gr.addColorStop(0, `rgb(${Math.round(70 - 50 * high)},${Math.round(130 - 100 * high)},${Math.round(200 - 120 * high)})`);
  gr.addColorStop(1, '#d5e5f0');
  g.fillStyle = gr;
  g.fillRect(0, 0, W, H);
  if (high > 0.05) {
    g.fillStyle = `rgba(255,255,255,${high})`;
    for (let i = 0; i < 50; i++) g.fillRect(((i * 137) % 100) / 100 * W, ((i * 71) % 60) / 100 * H, 2, 2);
  }
}
function holdBtn(set: (v: boolean) => void) {
  return { onPointerDown: () => set(true), onPointerUp: () => set(false), onPointerLeave: () => set(false), onPointerCancel: () => set(false) };
}
const windTxt = (w: number) => `${w < 0 ? '◀'.repeat(Math.min(3, Math.ceil(-w / 25))) : w > 0 ? '▶'.repeat(Math.min(3, Math.ceil(w / 25))) : '·'} ${Math.abs(w)}`;

// ───────────────────────── 3 폭격 투하 ─────────────────────────
export function GBomb({ level, seed, report, finish }: MiniProps) {
  const { cv, rot } = useFullCanvas();
  const s = useRef<BombRun>(newBombRun(seed, level));
  const ctl = useRef({ up: false, down: false });
  const camX = useRef(0);
  const hud = useRef('');
  const [, force] = useState(0);
  const end = useEnd(finish);
  useLoop((dt) => {
    const st = s.current;
    if (ctl.current.up) st.alt = Math.min(680, st.alt + 240 * dt);
    if (ctl.current.down) st.alt = Math.max(200, st.alt - 240 * dt);
    stepBombRun(st, dt);
    const sc = bombScore(st);
    report(sc);
    end(st.done, sc);
    const c = cv.current;
    if (c) {
      const k = c.height / BH;
      const viewW = c.width / k;
      const want = viewW >= BW ? (BW - viewW) / 2 : Math.max(0, Math.min(BW - viewW, st.px - viewW * 0.35));
      camX.current += (want - camX.current) * Math.min(1, dt * (Math.abs(want - camX.current) > 800 ? 10 : 4));
      drawBomb(c, st, camX.current, k, dt);
    }
    const key = `${st.pass}|${st.drops}|${Math.round(st.hp)}|${st.cores}|${st.wind}|${Math.round(st.alt / 20)}|${st.done}`;
    if (key !== hud.current) {
      hud.current = key;
      force((n) => n + 1);
    }
  });
  const st = s.current;
  return (
    <div className={`ft-full ${rot ? 'rot' : ''}`}>
      <canvas ref={cv} className="ft-canvas" />
      <div className="ft-hud">
        <div className="ft-hp me">
          <small>✈️ 기체 {Math.round(st.hp)}% · 고도 {Math.round(st.alt * 10)}m</small>
          <i style={{ width: `${st.hp}%` }} />
        </div>
        <div className="ft-mid">
          <b>
            {st.pass}/{BPASSES}번째 비행 · 💣 {st.drops}
          </b>
          <small>바람 {windTxt(st.wind)}</small>
        </div>
        <div className="ft-hp foe">
          <small>
            지휘소 {st.cores}/{st.total} ★
          </small>
          <i style={{ width: `${(1 - st.cores / Math.max(1, st.total)) * 100}%` }} />
        </div>
        <button className="ft-exit" onClick={() => finish(bombScore(st))}>✕</button>
      </div>
      {st.done && <div className="ft-turn">{st.cores >= st.total ? '🏆 지휘소 모두 파괴!' : st.hp <= 0 ? '💥 기체 격추' : '🛬 귀환'}</div>}
      <div className="if-ctl">
        <div className="if-pad">
          <button {...holdBtn((v) => (ctl.current.up = v))}>▲ 위로</button>
          <button {...holdBtn((v) => (ctl.current.down = v))}>▼ 아래로</button>
        </div>
        <div className="if-pad">
          <button className="if-jump fa-big" disabled={st.drops <= 0 || st.done} onPointerDown={() => dropBomb(st) && force((n) => n + 1)}>
            💣 투하
          </button>
        </div>
      </div>
    </div>
  );
}
function drawPlane(g: CanvasRenderingContext2D, x: number, y: number, hurt: boolean) {
  g.save();
  g.translate(x, y);
  g.fillStyle = hurt ? '#8a6f6a' : '#6f7c86';
  g.beginPath();
  g.ellipse(0, 0, 70, 13, 0, 0, Math.PI * 2);
  g.fill();
  g.beginPath();
  g.moveTo(-10, 0);
  g.lineTo(-40, -6);
  g.lineTo(-30, 30);
  g.lineTo(10, 4);
  g.fill();
  g.beginPath();
  g.moveTo(-58, -4);
  g.lineTo(-78, -34);
  g.lineTo(-64, -34);
  g.lineTo(-44, -6);
  g.fill();
  g.fillStyle = '#a8d4ef';
  g.beginPath();
  g.ellipse(40, -6, 16, 6, -0.15, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = 'rgba(255,180,80,0.8)';
  g.beginPath();
  g.ellipse(-76, 2, 10, 4, 0, 0, Math.PI * 2);
  g.fill();
  g.restore();
}
function drawBomb(c: HTMLCanvasElement, s: BombRun, camX: number, k: number, dt: number) {
  const g = c.getContext('2d');
  if (!g) return;
  g.setTransform(1, 0, 0, 1, 0, 0);
  sky(g, c.width, c.height, 0);
  g.setTransform(k, 0, 0, k, -camX * k, 0);
  // 먼 산
  g.fillStyle = 'rgba(100,130,150,0.45)';
  g.beginPath();
  g.moveTo(camX * 0.6 - 400, BGROUND);
  for (let x = -400; x <= BW + 800; x += 80) g.lineTo(x + camX * 0.6, BGROUND - 160 - Math.sin(x * 0.004) * 70 - Math.sin(x * 0.013) * 30);
  g.lineTo(BW + 800 + camX * 0.6, BGROUND);
  g.fill();
  // 땅
  const gr = g.createLinearGradient(0, BGROUND, 0, BH);
  gr.addColorStop(0, '#6b8f3a');
  gr.addColorStop(0.15, '#7a5a35');
  gr.addColorStop(1, '#3e2b1a');
  g.fillStyle = gr;
  g.fillRect(-1000, BGROUND, BW + 2000, BH - BGROUND + 200);
  const py = planeY(s);
  // 비행기 그림자
  g.fillStyle = 'rgba(0,0,0,0.18)';
  g.beginPath();
  g.ellipse(s.px, BGROUND + 4, 50, 6, 0, 0, Math.PI * 2);
  g.fill();
  for (const f of s.forts) drawFort(g, f, dt, { x: s.px, y: py });
  // 대공포 불꽃
  if (flakAt(s) > 0 && s.px > 0 && s.px < BW && !s.done) {
    for (let i = 0; i < 3; i++) {
      g.fillStyle = 'rgba(60,60,60,0.55)';
      g.beginPath();
      g.arc(s.px + (Math.random() - 0.5) * 260, py + (Math.random() - 0.5) * 140, 10 + Math.random() * 14, 0, Math.PI * 2);
      g.fill();
    }
    for (const f of s.forts)
      if (aaIn(f)) {
        g.strokeStyle = 'rgba(255,230,120,0.7)';
        g.lineWidth = 2;
        const ax = f.x + f.cols.length * BS - BS / 2, ay = BGROUND - f.cols[f.cols.length - 1].length * BS + 16;
        if (Math.abs(ax - s.px) < 320) {
          g.beginPath();
          g.moveTo(ax, ay);
          g.lineTo(s.px + (Math.random() - 0.5) * 120, py + (Math.random() - 0.5) * 60);
          g.stroke();
        }
      }
  }
  if (s.hp > 0 && s.px > -150 && s.px < BW + 150) drawPlane(g, s.px, py, s.hp < 40);
  for (const b of s.bombs) {
    g.save();
    g.translate(b.x, b.y);
    g.rotate(Math.atan2(b.vy, b.vx));
    g.fillStyle = '#2a2d30';
    g.beginPath();
    g.ellipse(0, 0, 16, 6, 0, 0, Math.PI * 2);
    g.fill();
    g.fillRect(-20, -6, 6, 12);
    g.restore();
  }
  drawBooms(g, s.booms, BOMB_R);
}

// ───────────────────────── 4 탄도 사격 ─────────────────────────
const MAX_PULL = 170;
export function GBallistic({ level, seed, report, finish }: MiniProps) {
  const { cv, rot } = useFullCanvas();
  const s = useRef<Ballistic>(newBallistic(seed, level));
  const drag = useRef<{ x: number; y: number; dx: number; dy: number } | null>(null);
  const cam = useRef({ x: 0, y: 0, w: MW, h: MH });
  const ang = useRef(-0.8);
  const hud = useRef('');
  const [, force] = useState(0);
  const end = useEnd(finish);
  useLoop((dt) => {
    const st = s.current;
    stepBallistic(st, dt);
    const sc = ballisticScore(st);
    report(sc);
    end(st.done, sc);
    const c = cv.current;
    if (c) {
      const pts: Pt[] = [st.launcher, ...st.forts.flatMap((f) => [{ x: f.x, y: MGROUND - 220 }, { x: f.x + f.cols.length * BS, y: MGROUND }])];
      const d = drag.current;
      const v = d ? pullVel(d.dx, d.dy, MAX_PULL) : null;
      if (st.m) {
        for (let i = 0; i < st.m.trail.length; i += 3) pts.push(st.m.trail[i]);
        pts.push({ x: st.m.x, y: st.m.y });
      } else if (v) pts.push(...preview(st, v));
      const t = fitCam(pts, c.width / c.height, MGROUND, 1500);
      const k = Math.min(1, dt * (st.m ? 4 : 3));
      const cm = cam.current;
      cam.current = { x: cm.x + (t.x - cm.x) * k, y: cm.y + (t.y - cm.y) * k, w: cm.w + (t.w - cm.w) * k, h: cm.h + (t.h - cm.h) * k };
      if (v && Math.hypot(v.x, v.y) > 0) ang.current = Math.atan2(v.y, v.x);
      if (st.m) ang.current = Math.atan2(st.m.vy, st.m.vx);
      drawBallistic(c, st, cam.current, v, ang.current, d, dt);
    }
    const key = `${st.shots}|${st.cores}|${st.wind}|${st.done}|${!!st.m}`;
    if (key !== hud.current) {
      hud.current = key;
      force((n) => n + 1);
    }
  });
  const down = (e: React.PointerEvent) => {
    const st = s.current;
    if (st.m || st.done || st.shots <= 0) return;
    drag.current = { x: e.clientX, y: e.clientY, dx: 0, dy: 0 };
  };
  const move = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const q = screenDelta({ clientX: d.x, clientY: d.y }, e, rot);
    d.dx = q.x;
    d.dy = q.y;
  };
  const up = () => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    if (launch(s.current, pullVel(d.dx, d.dy, MAX_PULL))) force((n) => n + 1);
  };
  const st = s.current;
  return (
    <div className={`ft-full ${rot ? 'rot' : ''}`} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
      <canvas ref={cv} className="ft-canvas" />
      <div className="ft-hud" onPointerDown={(e) => e.stopPropagation()}>
        <div className="ft-hp me">
          <small>🚀 남은 미사일 {'▮'.repeat(st.shots)}{'▯'.repeat(MSHOTS - st.shots)}</small>
        </div>
        <div className="ft-mid">
          <b>바람 {windTxt(st.wind)}</b>
          <small>{st.m ? '비행 중' : '어디든 눌러 뒤로 당겼다 놓기'}</small>
        </div>
        <div className="ft-hp foe">
          <small>
            지휘소 {st.cores}/{st.total} ★
          </small>
          <i style={{ width: `${(1 - st.cores / Math.max(1, st.total)) * 100}%` }} />
        </div>
        <button className="ft-exit" onClick={() => finish(ballisticScore(st))}>✕</button>
      </div>
      {st.done && <div className="ft-turn">{st.cores >= st.total ? '🏆 표적 모두 파괴!' : '🚀 미사일 소진'}</div>}
    </div>
  );
}
function drawBallistic(c: HTMLCanvasElement, s: Ballistic, cam: { x: number; y: number; w: number; h: number }, v: Pt | null, ang: number, d: { dx: number; dy: number } | null, dt: number) {
  const g = c.getContext('2d');
  if (!g) return;
  g.setTransform(1, 0, 0, 1, 0, 0);
  sky(g, c.width, c.height, Math.max(0, Math.min(1, -cam.y / 3000)));
  const k = c.width / cam.w;
  g.setTransform(k, 0, 0, k, -cam.x * k, -cam.y * k);
  // 땅 + 언덕
  const gr = g.createLinearGradient(0, MGROUND - s.hill.h, 0, MGROUND + 200);
  gr.addColorStop(0, '#6b8f3a');
  gr.addColorStop(0.3, '#7a5a35');
  gr.addColorStop(1, '#3e2b1a');
  g.fillStyle = gr;
  g.beginPath();
  g.moveTo(-3000, MGROUND + 3000);
  g.lineTo(-3000, MGROUND);
  for (let x = s.hill.x - s.hill.w / 2; x <= s.hill.x + s.hill.w / 2; x += 20) g.lineTo(x, hillAt(s, x));
  g.lineTo(MW + 3000, MGROUND);
  g.lineTo(MW + 3000, MGROUND + 3000);
  g.fill();
  g.fillStyle = '#7fa64a';
  g.fillRect(-3000, MGROUND - 2, MW + 6000, 6);
  for (const f of s.forts) drawFort(g, f, dt);
  // 지난 궤적
  if (s.last.length) {
    g.strokeStyle = 'rgba(255,255,255,0.35)';
    g.setLineDash([12, 14]);
    g.lineWidth = 3 / Math.max(0.3, k);
    g.beginPath();
    s.last.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)));
    g.stroke();
    g.setLineDash([]);
  }
  // 발사대
  const L = s.launcher;
  g.fillStyle = '#4c5a3c';
  rr(g, L.x - 70, L.y + 8, 140, 30, 8);
  g.fill();
  g.fillStyle = '#222';
  for (const wx of [-45, 0, 45]) {
    g.beginPath();
    g.arc(L.x + wx, L.y + 40, 12, 0, Math.PI * 2);
    g.fill();
  }
  g.save();
  g.translate(L.x, L.y);
  g.rotate(ang);
  g.fillStyle = '#5f6e4a';
  g.fillRect(-20, -9, 110, 18);
  g.restore();
  // 당기기: 미사일이 뒤로 물러남 + 미리 보기 점
  if (v && d && !s.m) {
    const pull = Math.min(MAX_PULL, Math.hypot(d.dx, d.dy)) / MAX_PULL;
    drawMissile(g, L.x - Math.cos(ang) * pull * 50, L.y - Math.sin(ang) * pull * 50, ang, false);
    g.fillStyle = '#fff';
    for (const [i, p] of preview(s, v).entries()) {
      if (i % 2) continue;
      g.globalAlpha = 1 - i / 14;
      g.beginPath();
      g.arc(p.x, p.y, 7, 0, Math.PI * 2);
      g.fill();
    }
    g.globalAlpha = 1;
    g.fillStyle = 'rgba(0,0,0,0.6)';
    g.font = 'bold 34px sans-serif';
    g.textAlign = 'center';
    g.fillText(`${Math.round(pull * 100)}%`, L.x, L.y - 70);
  } else if (!s.m && s.shots > 0) drawMissile(g, L.x, L.y, ang, false);
  if (s.m) {
    g.strokeStyle = 'rgba(240,240,240,0.7)';
    g.lineWidth = 8;
    g.lineCap = 'round';
    g.beginPath();
    s.m.trail.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)));
    g.stroke();
    drawMissile(g, s.m.x, s.m.y, ang, true);
  }
  drawBooms(g, s.booms, M_R);
}
function drawMissile(g: CanvasRenderingContext2D, x: number, y: number, a: number, fly: boolean) {
  g.save();
  g.translate(x, y);
  g.rotate(a);
  if (fly) {
    g.fillStyle = 'rgba(255,170,60,0.9)';
    g.beginPath();
    g.moveTo(-30, -6);
    g.lineTo(-62 - Math.random() * 16, 0);
    g.lineTo(-30, 6);
    g.fill();
  }
  g.fillStyle = '#e8e8e8';
  g.fillRect(-30, -7, 52, 14);
  g.fillStyle = '#c0392b';
  g.beginPath();
  g.moveTo(22, -7);
  g.lineTo(40, 0);
  g.lineTo(22, 7);
  g.fill();
  g.fillStyle = '#555';
  g.beginPath();
  g.moveTo(-30, -7);
  g.lineTo(-40, -16);
  g.lineTo(-22, -7);
  g.moveTo(-30, 7);
  g.lineTo(-40, 16);
  g.lineTo(-22, 7);
  g.fill();
  g.restore();
}

// ───────────────────────── 5 하늘의 방패 ─────────────────────────
export function GShield({ level, seed, report, finish }: MiniProps) {
  const { cv, rot } = useFullCanvas();
  const s = useRef<Shield>(newShield(seed, level));
  const view = useRef<View>({ sc: 1, ox: 0, oy: 0 });
  const hud = useRef('');
  const [, force] = useState(0);
  const end = useEnd(finish);
  useLoop((dt) => {
    const st = s.current;
    stepShield(st, dt);
    const sc = shieldScore(st);
    report(sc);
    end(st.done, sc);
    const c = cv.current;
    if (c) {
      view.current = fitView(c, SW, SH);
      drawShield(c, view.current, st);
    }
    const key = `${st.wave}|${st.kills}|${st.cities.filter((x) => x.alive).length}|${st.bats.map((b) => b.ammo).join()}|${st.done}|${st.pause > 0}`;
    if (key !== hud.current) {
      hud.current = key;
      force((n) => n + 1);
    }
  });
  const tap = (e: React.PointerEvent) => {
    const w = toWorld(view.current, localPt(e, cv.current, rot));
    shoot(s.current, w.x, w.y);
  };
  const st = s.current;
  const alive = st.cities.filter((c) => c.alive).length;
  return (
    <div className={`ft-full ${rot ? 'rot' : ''}`}>
      <canvas ref={cv} className="ft-canvas" onPointerDown={tap} />
      <div className="ft-hud">
        <div className="ft-hp me">
          <small>🏙️ 지킨 도시 {alive}/{st.cities.length}</small>
          <i style={{ width: `${(alive / st.cities.length) * 100}%` }} />
        </div>
        <div className="ft-mid">
          <b>
            {st.wave}/{WAVES}파 · 요격 {st.kills}
          </b>
          <small>하늘을 누르면 그 자리에서 터져요</small>
        </div>
        <div className="ft-hp foe" />
        <button className="ft-exit" onClick={() => finish(shieldScore(st))}>✕</button>
      </div>
      {st.pause > 0 && !st.done && <div className="ft-turn">🚨 {st.wave}파 적 미사일 접근</div>}
      {st.done && <div className="ft-turn">{alive ? '🛡️ 방어 성공!' : '💥 도시 모두 피격'}</div>}
    </div>
  );
}
function drawShield(c: HTMLCanvasElement, v: View, s: Shield) {
  const g = c.getContext('2d');
  if (!g) return;
  g.setTransform(1, 0, 0, 1, 0, 0);
  const bg = g.createLinearGradient(0, 0, 0, c.height);
  bg.addColorStop(0, '#050a1a');
  bg.addColorStop(1, '#1b2a4a');
  g.fillStyle = bg;
  g.fillRect(0, 0, c.width, c.height);
  world(g, v);
  g.fillStyle = 'rgba(255,255,255,0.7)';
  for (let i = 0; i < 80; i++) g.fillRect((i * 197) % SW, (i * 83) % (SH * 0.6), 2, 2);
  // 땅
  g.fillStyle = '#1e2b1c';
  g.fillRect(-400, SGROUND, SW + 800, SH - SGROUND + 300);
  g.fillStyle = '#34482e';
  g.fillRect(-400, SGROUND, SW + 800, 5);
  // 도시
  for (const ct of s.cities) {
    if (ct.alive) {
      for (let i = 0; i < 6; i++) {
        const h = 30 + ((i * 37 + ct.x) % 50);
        g.fillStyle = i % 2 ? '#3f5878' : '#4f6b8f';
        g.fillRect(ct.x - 55 + i * 18, SGROUND - h, 16, h);
        g.fillStyle = 'rgba(255,220,120,0.8)';
        for (let y = SGROUND - h + 6; y < SGROUND - 6; y += 10) g.fillRect(ct.x - 51 + i * 18, y, 3, 3);
      }
    } else {
      g.fillStyle = '#3a3330';
      for (let i = 0; i < 6; i++) g.fillRect(ct.x - 55 + i * 18, SGROUND - 8 - ((i * 7) % 10), 16, 12);
      g.fillStyle = 'rgba(255,120,40,0.4)';
      g.beginPath();
      g.arc(ct.x, SGROUND - 6, 20 + Math.sin(performance.now() / 120 + ct.x) * 4, 0, Math.PI * 2);
      g.fill();
    }
  }
  // 포대
  for (const b of s.bats) {
    g.fillStyle = b.alive ? '#5b6a4a' : '#3a3330';
    g.beginPath();
    g.moveTo(b.x - 40, SGROUND);
    g.lineTo(b.x, SGROUND - 40);
    g.lineTo(b.x + 40, SGROUND);
    g.fill();
    g.fillStyle = '#ffd34d';
    for (let i = 0; i < b.ammo; i++) g.fillRect(b.x - 33 + (i % 6) * 11, SGROUND + 12 + Math.floor(i / 6) * 12, 7, 9);
  }
  // 적 미사일
  for (const m of s.inc) {
    const gr = g.createLinearGradient(m.sx, -10, m.x, m.y);
    gr.addColorStop(0, 'rgba(255,80,60,0)');
    gr.addColorStop(1, 'rgba(255,80,60,0.8)');
    g.strokeStyle = gr;
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(m.sx, -10);
    g.lineTo(m.x, m.y);
    g.stroke();
    g.fillStyle = m.split ? '#ff9de0' : '#fff';
    g.beginPath();
    g.arc(m.x, m.y, m.split ? 6 : 4, 0, Math.PI * 2);
    g.fill();
  }
  // 요격탄
  for (const it of s.ints) {
    g.strokeStyle = 'rgba(120,220,255,0.8)';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(it.x, it.y);
    g.lineTo(it.x - (it.tx - it.x) * 0.05, it.y - (it.ty - it.y) * 0.05);
    g.stroke();
    g.fillStyle = '#bff';
    g.beginPath();
    g.arc(it.x, it.y, 4, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = 'rgba(120,220,255,0.6)';
    g.beginPath();
    g.moveTo(it.tx - 10, it.ty - 10);
    g.lineTo(it.tx + 10, it.ty + 10);
    g.moveTo(it.tx + 10, it.ty - 10);
    g.lineTo(it.tx - 10, it.ty + 10);
    g.stroke();
  }
  for (const b of s.bursts) {
    const r = burstR(b);
    if (r <= 0) continue;
    const gr = g.createRadialGradient(b.x, b.y, 0, b.x, b.y, r);
    gr.addColorStop(0, 'rgba(255,255,230,0.95)');
    gr.addColorStop(0.5, 'rgba(255,190,80,0.7)');
    gr.addColorStop(1, 'rgba(255,90,40,0)');
    g.fillStyle = gr;
    g.beginPath();
    g.arc(b.x, b.y, r, 0, Math.PI * 2);
    g.fill();
  }
}
