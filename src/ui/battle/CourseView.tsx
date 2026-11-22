// 체력 훈련 화면(② 옆보기 실시간): 장애물 코스. 점프·포복 버튼, 달리기/걷기 전환.
import { useEffect, useRef, useState } from 'react';
import { COURSE_LEN, COURSE_TICK, OBSTACLE_ACT, OBSTACLE_ICON, createCourse, finishCourse, press, setRunning, stepCourse, type CourseRun } from '../../battle/course';
import { BattleBar, type FrameProps } from './BattleScreen';

const W = 360;
const H = 160;
const VIEW = 300; // 화면에 보이는 코스 길이

export function CourseView({ spec, stats, rank, onEnd }: FrameProps) {
  const [c, setC] = useState<CourseRun>(() => createCourse({ rank, stats, seed: spec.seed }));
  const [auto, setAuto] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [started, setStarted] = useState(false);
  const ref = useRef(c);
  ref.current = c;
  const canvas = useRef<HTMLCanvasElement>(null);
  const ended = useRef(false);

  useEffect(() => {
    if (c.result && !ended.current) {
      ended.current = true;
      onEnd(c.result);
    }
  }, [c.result, onEnd]);

  useEffect(() => {
    if (!started || c.result) return;
    let last = performance.now();
    let carry = 0;
    let raf = 0;
    const loop = (now: number) => {
      carry += Math.min(200, now - last) * speed;
      last = now;
      const ms = Math.floor(carry / COURSE_TICK) * COURSE_TICK;
      if (ms > 0) {
        carry -= ms;
        const n = stepCourse(ref.current, ms, auto);
        ref.current = n;
        setC(n);
        if (n.result) return;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [started, auto, speed, c.result]);

  useEffect(() => {
    const g = canvas.current?.getContext('2d');
    if (!g) return;
    const left = Math.max(0, c.x - 60);
    const sx = (x: number) => ((x - left) / VIEW) * W;
    g.fillStyle = '#1e293b';
    g.fillRect(0, 0, W, H);
    g.fillStyle = '#3f6212';
    g.fillRect(0, H - 40, W, 40);
    // 결승선
    if (COURSE_LEN - left < VIEW) {
      g.fillStyle = '#fde68a';
      g.fillRect(sx(COURSE_LEN), 20, 4, H - 60);
    }
    g.font = '22px sans-serif';
    g.textAlign = 'center';
    c.obstacles.forEach((ob, i) => {
      const x = sx(ob.x);
      if (x < -20 || x > W + 20) return;
      g.globalAlpha = i < c.next ? 0.35 : 1;
      g.fillText(OBSTACLE_ICON[ob.kind], x, H - 44);
      g.globalAlpha = 1;
    });
    const stun = c.t < c.stunUntil;
    const y = c.act?.kind === '점프' ? H - 90 : H - 52;
    g.font = c.act?.kind === '포복' ? '18px sans-serif' : '26px sans-serif';
    g.fillText(stun ? '😵' : c.act?.kind === '포복' ? '🐛' : '🏃', sx(c.x), y + (c.act?.kind === '포복' ? 10 : 0));
    // 체력 막대
    g.fillStyle = '#0008';
    g.fillRect(10, 10, 120, 8);
    g.fillStyle = c.stamina < 25 ? '#f87171' : '#4ade80';
    g.fillRect(10, 10, (120 * c.stamina) / c.staminaMax, 8);
    if (!started) {
      g.fillStyle = '#fff';
      g.font = '16px sans-serif';
      g.fillText('시작을 누르세요', W / 2, H / 2);
    }
  }, [c, started]);

  const next = c.obstacles[c.next];
  return (
    <>
      <BattleBar auto={auto} setAuto={setAuto} speed={speed} setSpeed={setSpeed} done={!!c.result} onInstant={() => setC(finishCourse(ref.current))} />
      <div className="battle-info small">
        <span>
          {Math.round((c.x / COURSE_LEN) * 100)}% · {(c.t / 1000).toFixed(1)}초(기준 {(c.par / 1000).toFixed(0)}초) · 넘어짐 {c.falls}
        </span>
        <span className="muted">
          장애물 앞에서 맞는 동작을 누르세요. 🚧🧱 = 점프, 〰️ = 포복. 체력이 바닥나면 걷게 돼요.
          {next ? ` 다음: ${next.kind}(${OBSTACLE_ACT[next.kind]})` : ''}
        </span>
      </div>
      <canvas ref={canvas} width={W} height={H} className="shooter" />
      {!started ? (
        <button className="primary wide" onClick={() => setStarted(true)}>
          ▶ 시작
        </button>
      ) : (
        <div className="buttons">
          <button className="primary" disabled={!!c.result} onClick={() => setC((p) => (ref.current = press(p, '점프')))}>
            ⬆ 점프
          </button>
          <button className="primary" disabled={!!c.result} onClick={() => setC((p) => (ref.current = press(p, '포복')))}>
            ⬇ 포복
          </button>
          <button disabled={!!c.result} onClick={() => setC((p) => (ref.current = setRunning(p, !p.running)))}>
            {c.running ? '🚶 걷기(체력 회복)' : '🏃 달리기'}
          </button>
        </div>
      )}
    </>
  );
}
