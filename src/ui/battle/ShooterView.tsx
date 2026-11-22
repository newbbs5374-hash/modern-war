// ④ 위에서 본 슈팅 화면(캔버스). 화면을 누른 채 움직이면 비행기가 따라옴, 기관포는 자동.
import { useEffect, useRef, useState } from 'react';
import { SH_H, SH_TICK, SH_W, createShooter, finishShooter, stepShooter, type ShooterBattle } from '../../battle/shooter';
import { BattleBar, type FrameProps } from './BattleScreen';

export function ShooterView({ spec, stats, rank, onEnd }: FrameProps) {
  const [b, setB] = useState<ShooterBattle>(() => createShooter({ difficulty: spec.difficulty, rank, stats, seed: spec.seed }));
  const [auto, setAuto] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [started, setStarted] = useState(false);
  const ref = useRef(b);
  ref.current = b;
  const aim = useRef<{ x: number; y: number } | null>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const ended = useRef(false);

  useEffect(() => {
    if (b.result && !ended.current) {
      ended.current = true;
      onEnd(b.result);
    }
  }, [b.result, onEnd]);

  useEffect(() => {
    if (!started || b.result) return;
    let last = performance.now();
    let carry = 0;
    let raf = 0;
    const loop = (now: number) => {
      carry += Math.min(200, now - last) * speed;
      last = now;
      const ms = Math.floor(carry / SH_TICK) * SH_TICK;
      if (ms > 0) {
        carry -= ms;
        const nb = stepShooter(ref.current, ms, auto, auto ? null : aim.current);
        ref.current = nb;
        setB(nb);
        if (nb.result) return;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [started, auto, speed, b.result]);

  // 그리기
  useEffect(() => {
    const c = canvas.current?.getContext('2d');
    if (!c) return;
    c.fillStyle = '#0c1a33';
    c.fillRect(0, 0, SH_W, SH_H);
    c.fillStyle = '#ffffff22';
    for (let i = 0; i < 30; i++) c.fillRect((i * 97) % SH_W, ((i * 53 + b.t / 20) % SH_H), 2, 2);
    const tri = (x: number, y: number, s: number, up: boolean, col: string) => {
      c.fillStyle = col;
      c.beginPath();
      c.moveTo(x, y + (up ? -s : s));
      c.lineTo(x - s * 0.8, y + (up ? s : -s));
      c.lineTo(x + s * 0.8, y + (up ? s : -s));
      c.closePath();
      c.fill();
    };
    for (const p of b.planes) {
      if (p.kind === '폭격기') {
        c.fillStyle = '#b91c1c';
        c.fillRect(p.x - 34, p.y - 10, 68, 20);
        c.fillRect(p.x - 8, p.y - 26, 16, 52);
        c.fillStyle = '#0008';
        c.fillRect(p.x - 34, p.y - 34, 68, 5);
        c.fillStyle = '#f87171';
        c.fillRect(p.x - 34, p.y - 34, (68 * Math.max(0, p.hp)) / p.maxHp, 5);
      } else if (p.kind === '포대') {
        c.fillStyle = '#7f1d1d';
        c.fillRect(p.x - 12, p.y - 12, 24, 24);
        c.fillStyle = '#f87171';
        c.fillRect(p.x - 3, p.y, 6, 16);
      } else tri(p.x, p.y, 11, false, p.kind === '지그재그' ? '#fb923c' : '#ef4444');
    }
    for (const u of b.bullets) {
      c.fillStyle = u.mine ? '#fde68a' : '#f472b6';
      c.fillRect(u.x - (u.mine ? 1 : 2.5), u.y - (u.mine ? 5 : 2.5), u.mine ? 2 : 5, u.mine ? 10 : 5);
    }
    const blink = b.t < b.me.hurtUntil && Math.floor(b.t / 100) % 2 === 0;
    if (!blink) tri(b.me.x, b.me.y, 13, true, '#60a5fa');
    if (!started) {
      c.fillStyle = '#fff';
      c.font = '18px sans-serif';
      c.textAlign = 'center';
      c.fillText('시작을 누르세요', SH_W / 2, SH_H / 2);
    }
  }, [b, started]);

  const toField = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    // 손가락에 가리지 않게 조금 위
    aim.current = { x: ((e.clientX - r.left) / r.width) * SH_W, y: ((e.clientY - r.top) / r.height) * SH_H - 40 };
  };
  const boss = b.planes.find((p) => p.kind === '폭격기');
  return (
    <>
      <BattleBar auto={auto} setAuto={setAuto} speed={speed} setSpeed={setSpeed} done={!!b.result} onInstant={() => setB(finishShooter(ref.current))} />
      <div className="battle-info small">
        <span>
          체력 {'❤'.repeat(Math.max(0, b.me.hp))} · 격추 {b.kills} · {Math.floor(b.t / 1000)}초
          {boss ? ' · 폭격기 등장!' : ''}
        </span>
        <span className="muted">화면을 누른 채 움직이면 비행기가 따라와요. 기관포는 자동. 마지막 폭격기를 떨어뜨리세요.</span>
      </div>
      <canvas
        ref={canvas}
        width={SH_W}
        height={SH_H}
        className="shooter"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          toField(e);
        }}
        onPointerMove={(e) => e.buttons && toField(e)}
      />
      {!started && (
        <button className="primary wide" onClick={() => setStarted(true)}>
          ▶ 시작
        </button>
      )}
    </>
  );
}
