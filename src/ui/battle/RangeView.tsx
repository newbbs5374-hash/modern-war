// 사격 훈련 화면(② 옆보기 실시간): 지나가는 표적을 눌러 맞힘. 민간인(🧑) 표적은 감점.
import { useEffect, useRef, useState } from 'react';
import { RANGE_H, RANGE_W, createRange, finishRange, shoot, stepRange, targetPos, type RangeGame } from '../../battle/range';
import { rangeAim } from '../../battle/auto';
import { BattleBar, type FrameProps } from './BattleScreen';

export function RangeView({ spec, stats, rank, onEnd }: FrameProps) {
  const [g, setG] = useState<RangeGame>(() => createRange({ rank, stats, seed: spec.seed }));
  const [auto, setAuto] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [started, setStarted] = useState(false);
  const ref = useRef(g);
  ref.current = g;
  const canvas = useRef<HTMLCanvasElement>(null);
  const ended = useRef(false);
  const aim = rangeAim(stats, rank);

  useEffect(() => {
    if (g.result && !ended.current) {
      ended.current = true;
      onEnd(g.result);
    }
  }, [g.result, onEnd]);

  useEffect(() => {
    if (!started || g.result) return;
    let last = performance.now();
    let carry = 0;
    let raf = 0;
    const loop = (now: number) => {
      carry += Math.min(200, now - last) * speed;
      last = now;
      const ms = Math.floor(carry / 50) * 50;
      if (ms > 0) {
        carry -= ms;
        const n = stepRange(ref.current, ms, auto, aim);
        ref.current = n;
        setG(n);
        if (n.result) return;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [started, auto, speed, g.result, aim]);

  useEffect(() => {
    const c = canvas.current?.getContext('2d');
    if (!c) return;
    c.fillStyle = '#1c1917';
    c.fillRect(0, 0, RANGE_W, RANGE_H);
    c.strokeStyle = '#ffffff22';
    for (const y of [60, 120, 180]) {
      c.beginPath();
      c.moveTo(0, y + 22);
      c.lineTo(RANGE_W, y + 22);
      c.stroke();
    }
    c.font = '26px sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    for (const t of g.targets) {
      const p = targetPos(g, t);
      if (!p.on) continue;
      c.globalAlpha = t.hit ? 0.25 : 1;
      c.fillText(t.civ ? '🧑' : '🎯', p.x, p.y);
    }
    c.globalAlpha = 1;
    if (!started) {
      c.fillStyle = '#fff';
      c.font = '16px sans-serif';
      c.fillText('시작을 누르세요', RANGE_W / 2, RANGE_H / 2);
    }
  }, [g, started]);

  return (
    <>
      <BattleBar auto={auto} setAuto={setAuto} speed={speed} setSpeed={setSpeed} done={!!g.result} onInstant={() => setG(finishRange(ref.current, aim))} />
      <div className="battle-info small">
        <span>
          점수 {g.score} / 기준 {g.goal} · 콤보 {g.combo} · 남은 {Math.max(0, Math.ceil((g.duration - g.t) / 1000))}초
        </span>
        <span className="muted">🎯 표적을 누르면 쏴요. 연속으로 맞히면 점수가 커지고, 🧑 민간인을 쏘면 30점 깎여요.</span>
      </div>
      <canvas
        ref={canvas}
        width={RANGE_W}
        height={RANGE_H}
        className="shooter"
        onPointerDown={(e) => {
          if (!started || auto) return;
          const r = e.currentTarget.getBoundingClientRect();
          const x = ((e.clientX - r.left) / r.width) * RANGE_W;
          const y = ((e.clientY - r.top) / r.height) * RANGE_H;
          const n = shoot(ref.current, x, y);
          ref.current = n;
          setG(n);
        }}
      />
      {!started && (
        <button className="primary wide" onClick={() => setStarted(true)}>
          ▶ 시작
        </button>
      )}
    </>
  );
}
