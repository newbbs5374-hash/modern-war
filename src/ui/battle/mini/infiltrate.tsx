// 11-28 새 전체 화면 훈련 2 "침투 작전"(옆으로 가는 플랫폼 + 잠입). 계산은 battle/infiltrate.ts.
// 조작: ◀ ▶ 꾹 = 달리기 · ⤴ = 점프 · ⤵ 꾹 = 숙이기(그림자 속이면 안 보임, 상자 뒤면 시선이 막힘)
import { useRef, useState } from 'react';
import { useFullCanvas } from './full';
import { FLOOR, IH, IW, LIVES, PH, PH_LOW, PW, camAngle, inShadow, infiltrateScore, newInfiltrate, stepInfiltrate, type IState } from '../../../battle/infiltrate';
import { useLoop, type MiniProps } from './kit';

export function GInfiltrate({ level, seed, report, finish }: MiniProps) {
  const { cv, rot } = useFullCanvas();
  const s = useRef<IState>(newInfiltrate(seed, level));
  const inp = useRef({ left: false, right: false, jump: false, low: false });
  const camX = useRef(0);
  const [, force] = useState(0);
  const ended = useRef(false);
  const hud = useRef({ lives: LIVES, alert: 0, prog: 0 });

  useLoop((dt) => {
    const st = s.current;
    stepInfiltrate(st, inp.current, dt);
    inp.current.jump = false;
    report(infiltrateScore(st));
    if ((st.done || st.dead) && !ended.current) {
      ended.current = true;
      setTimeout(() => finish(infiltrateScore(st)), 1200);
    }
    const c = cv.current;
    if (c) {
      const sc = c.height / IH;
      const viewW = c.width / sc;
      const want = Math.max(0, Math.min(IW - viewW, st.px - viewW * 0.35));
      camX.current += (want - camX.current) * Math.min(1, dt * 6);
      draw(c, st, camX.current);
    }
    const h = hud.current;
    const prog = Math.round((st.px / st.end) * 100);
    if (h.lives !== st.lives || Math.abs(h.alert - st.alert) > 0.04 || h.prog !== prog) {
      hud.current = { lives: st.lives, alert: st.alert, prog };
      force((n) => n + 1);
    }
  });

  const hold = (k: 'left' | 'right' | 'low', v: boolean) => () => (inp.current[k] = v);
  const st = s.current;
  const h = hud.current;
  return (
    <div className={`ft-full ${rot ? 'rot' : ''}`}>
      <canvas ref={cv} className="ft-canvas" />
      <div className="ft-hud">
        <div className="ft-hp me">
          <small>
            {'❤️'.repeat(h.lives)}
            {'🖤'.repeat(Math.max(0, LIVES - h.lives))} · 진행 {Math.min(100, h.prog)}%
          </small>
          <i style={{ width: `${Math.min(100, h.prog)}%`, background: '#7bd88f' }} />
        </div>
        <div className="ft-mid">
          <b>{st.seen ? '❗ 들키는 중' : inShadow(st) && st.low ? '🌑 숨음' : '🥷 침투 중'}</b>
        </div>
        <div className="ft-hp foe">
          <small>경보</small>
          <i style={{ width: `${h.alert * 100}%`, background: h.alert > 0.6 ? '#ff4d3a' : '#f5c542' }} />
        </div>
        <button className="ft-exit" onClick={() => finish(infiltrateScore(st))}>
          ✕
        </button>
      </div>
      {(st.done || st.dead) && <div className="ft-turn">{st.done ? '🏁 기지 침투 성공!' : '🚨 작전 실패'}</div>}
      <div className="if-ctl">
        <div className="if-pad">
          <button onPointerDown={hold('left', true)} onPointerUp={hold('left', false)} onPointerLeave={hold('left', false)} onPointerCancel={hold('left', false)}>
            ◀
          </button>
          <button onPointerDown={hold('right', true)} onPointerUp={hold('right', false)} onPointerLeave={hold('right', false)} onPointerCancel={hold('right', false)}>
            ▶
          </button>
        </div>
        <div className="if-pad">
          <button onPointerDown={hold('low', true)} onPointerUp={hold('low', false)} onPointerLeave={hold('low', false)} onPointerCancel={hold('low', false)}>
            ⤵ 숙이기
          </button>
          <button className="if-jump" onPointerDown={() => (inp.current.jump = true)}>
            ⤴ 점프
          </button>
        </div>
      </div>
    </div>
  );
}

function draw(c: HTMLCanvasElement, s: IState, camX: number) {
  const g = c.getContext('2d');
  if (!g) return;
  const W = c.width, H = c.height;
  const sc = H / IH;
  const X = (x: number) => (x - camX) * sc;
  const Y = (y: number) => y * sc;
  // 밤하늘
  const sky = g.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#0b1530');
  sky.addColorStop(1, '#283a5c');
  g.fillStyle = sky;
  g.fillRect(0, 0, W, H);
  g.fillStyle = '#f2f0d8';
  g.beginPath();
  g.arc(W * 0.82, H * 0.15, H * 0.05, 0, Math.PI * 2);
  g.fill();
  // 먼 건물(천천히)
  g.fillStyle = '#16223d';
  for (let i = 0; i < 40; i++) {
    const bx = ((i * 173) % 4000) - camX * 0.3;
    const bw = 60 + ((i * 37) % 70), bh = 90 + ((i * 53) % 160);
    g.fillRect(bx * sc, Y(FLOOR - bh), bw * sc, bh * sc);
  }
  // 땅(구덩이 빼고)
  g.fillStyle = '#2b2f25';
  let x0 = 0;
  const pits = [...s.pits].sort((a, b) => a[0] - b[0]);
  for (const [a, b] of pits) {
    g.fillRect(X(x0), Y(FLOOR), (a - x0) * sc, H);
    x0 = b;
  }
  g.fillRect(X(x0), Y(FLOOR), (IW - x0) * sc, H);
  g.fillStyle = '#4a5a3a';
  g.fillRect(X(0), Y(FLOOR), IW * sc, 4 * sc);
  for (const [a, b] of pits) {
    g.fillStyle = '#05070c';
    g.fillRect(X(a), Y(FLOOR), (b - a) * sc, H);
  }
  // 깃발 · 목표
  s.checks.forEach((x, i) => {
    if (!i) return;
    g.fillStyle = i <= s.check ? '#7bd88f' : '#9aa7b8';
    g.fillRect(X(x), Y(FLOOR - 70), 3 * sc, 70 * sc);
    g.fillRect(X(x), Y(FLOOR - 70), 22 * sc, 14 * sc);
  });
  g.fillStyle = '#3c4a63';
  g.fillRect(X(s.end), Y(FLOOR - 130), 110 * sc, 130 * sc);
  g.fillStyle = '#f5c542';
  g.fillRect(X(s.end + 40), Y(FLOOR - 60), 30 * sc, 60 * sc);
  // 카메라 빛
  for (const cm of s.cams) {
    const a = camAngle(cm);
    g.fillStyle = 'rgba(255,240,150,0.22)';
    g.beginPath();
    g.moveTo(X(cm.x), Y(cm.y));
    g.lineTo(X(cm.x + Math.cos(a - 0.22) * 320), Y(cm.y + Math.sin(a - 0.22) * 320));
    g.lineTo(X(cm.x + Math.cos(a + 0.22) * 320), Y(cm.y + Math.sin(a + 0.22) * 320));
    g.fill();
    g.fillStyle = '#9aa7b8';
    g.fillRect(X(cm.x - 10), Y(cm.y - 8), 20 * sc, 12 * sc);
    g.fillStyle = '#ff4d3a';
    g.fillRect(X(cm.x - 2), Y(cm.y - 4), 4 * sc, 4 * sc);
  }
  // 상자·발판
  for (const b of s.solids) {
    g.fillStyle = b.h > 30 ? '#6b5233' : '#55606e';
    g.fillRect(X(b.x), Y(b.y), b.w * sc, b.h * sc);
    g.strokeStyle = 'rgba(0,0,0,0.4)';
    g.lineWidth = 2;
    g.strokeRect(X(b.x), Y(b.y), b.w * sc, b.h * sc);
  }
  // 그림자 구역
  for (const [a, b] of s.shadows) {
    g.fillStyle = 'rgba(0,0,0,0.5)';
    g.fillRect(X(a), Y(FLOOR - 170), (b - a) * sc, 170 * sc);
  }
  // 경비병 + 손전등
  for (const gd of s.guards) {
    g.fillStyle = 'rgba(255,230,120,0.25)';
    g.beginPath();
    g.moveTo(X(gd.x), Y(gd.y - 30));
    g.lineTo(X(gd.x + gd.dir * 240), Y(gd.y - 75));
    g.lineTo(X(gd.x + gd.dir * 240), Y(gd.y + 5));
    g.fill();
    g.fillStyle = '#7a2a22';
    g.fillRect(X(gd.x - 11), Y(gd.y - 46), 22 * sc, 46 * sc);
    g.fillStyle = '#d9b48f';
    g.beginPath();
    g.arc(X(gd.x), Y(gd.y - 52), 9 * sc, 0, Math.PI * 2);
    g.fill();
  }
  // 우리 요원
  const h = s.low ? PH_LOW : PH;
  const hid = s.low && inShadow(s);
  g.globalAlpha = hid ? 0.45 : 1;
  g.fillStyle = s.seen ? '#ff8a6a' : '#1f2a1f';
  g.fillRect(X(s.px), Y(s.py + (PH - h)), PW * sc, h * sc);
  g.fillStyle = '#7bd88f';
  g.fillRect(X(s.px + 4), Y(s.py + (PH - h) + 6), (PW - 8) * sc, 4 * sc);
  g.globalAlpha = 1;
  if (s.seen) {
    g.fillStyle = '#ff4d3a';
    g.font = `bold ${Math.round(28 * sc)}px sans-serif`;
    g.fillText('!', X(s.px + PW / 2 - 4), Y(s.py - 10));
  }
}
