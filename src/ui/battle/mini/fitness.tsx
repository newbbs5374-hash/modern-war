// 체력 훈련 미니게임 3개
import { useMemo, useRef, useState } from 'react';
import { Hud, Stage, clamp01, useLoop, useRng, type MiniProps } from './kit';

/* ── 장애물 달리기 ── */
export function FitRun({ level, seed, report, finish }: MiniProps) {
  const rng = useRng(seed);
  const N = 18;
  const obs = useMemo(() => {
    let x = 60;
    return Array.from({ length: N }, () => {
      x += rng.range(30, 55) / level + 12;
      return { x, kind: rng.chance(0.5) ? 'hurdle' : 'wire', done: false };
    });
  }, [rng, level]);
  const s = useRef({ dist: 0, act: '' as '' | 'jump' | 'crawl', actT: 0, hits: 0, passed: 0, hitT: 0, over: false });
  const [, tick] = useState(0);
  const RX = 20;
  useLoop((dt) => {
    const st = s.current;
    if (st.over) return;
    st.dist += dt * (st.hitT > 0 ? 12 : 26) * level;
    st.actT = Math.max(0, st.actT - dt);
    if (st.actT === 0) st.act = '';
    st.hitT = Math.max(0, st.hitT - dt);
    for (const o of obs) {
      if (o.done) continue;
      const sx = o.x - st.dist;
      if (sx < RX - 2) {
        o.done = true;
        st.passed++;
        const ok = (o.kind === 'hurdle' && st.act === 'jump') || (o.kind === 'wire' && st.act === 'crawl');
        if (!ok) {
          st.hits++;
          st.hitT = 0.7;
        }
      }
    }
    report(clamp01((st.passed - st.hits * 1.3) / N));
    if (st.passed >= N) {
      st.over = true;
      finish(clamp01(1 - (st.hits * 1.3) / N));
    }
    tick((x) => x + 1);
  });
  const st = s.current;
  const act = (a: 'jump' | 'crawl') => {
    if (s.current.actT > 0.15) return;
    s.current.act = a;
    s.current.actT = 0.55;
  };
  const y = st.act === 'jump' ? 42 : st.act === 'crawl' ? 72 : 64;
  return (
    <>
      <Hud items={[['넘음', `${st.passed - st.hits}/${N}`], ['넘어짐', st.hits]]} />
      <Stage ratio={1.8} className="mg-field">
        <div className="mg-ground" />
        {obs.map((o, i) => {
          const sx = o.x - st.dist;
          if (sx < -10 || sx > 110) return null;
          return (
            <div key={i} className="mg-at" style={{ left: `${sx}%`, top: o.kind === 'hurdle' ? '68%' : '74%', fontSize: 24, opacity: o.done ? 0.4 : 1 }}>
              {o.kind === 'hurdle' ? '🚧' : '〰️'}
            </div>
          );
        })}
        <div className="mg-at" style={{ left: `${RX}%`, top: `${y}%`, fontSize: st.act === 'crawl' ? 20 : 28 }}>
          {st.hitT > 0 ? '😵' : st.act === 'crawl' ? '🐛' : '🏃'}
        </div>
      </Stage>
      <div className="buttons">
        <button className="primary" onPointerDown={() => act('jump')}>
          ⬆ 점프
        </button>
        <button className="primary" onPointerDown={() => act('crawl')}>
          ⬇ 포복
        </button>
      </div>
    </>
  );
}

/* ── 리듬 행군 ── */
export function FitMarch({ level, seed, report, finish }: MiniProps) {
  const rng = useRng(seed);
  const N = 40;
  const gap = 0.7 / level;
  const feet = useMemo(() => {
    const out: Array<'L' | 'R'> = [];
    for (let i = 0; i < N; i++) out.push(i === 0 ? 'L' : rng.chance(0.82) ? (out[i - 1] === 'L' ? 'R' : 'L') : out[i - 1]);
    return out;
  }, [rng]);
  const s = useRef({ t: -1.5, judged: new Array<string>(N).fill(''), score: 0, over: false });
  const [, tick] = useState(0);
  const [last, setLast] = useState('');
  useLoop((dt) => {
    const st = s.current;
    if (st.over) return;
    st.t += dt;
    for (let i = 0; i < N; i++) if (!st.judged[i] && st.t - i * gap > 0.25) st.judged[i] = 'miss';
    report(st.score / N);
    if (st.t > N * gap + 0.4) {
      st.over = true;
      finish(st.score / N);
    }
    tick((x) => x + 1);
  });
  const hit = (f: 'L' | 'R') => {
    const st = s.current;
    let best = -1;
    let bd = 9;
    for (let i = 0; i < N; i++) {
      if (st.judged[i]) continue;
      const d = Math.abs(st.t - i * gap);
      if (d < bd) {
        bd = d;
        best = i;
      }
    }
    if (best < 0 || bd > 0.25) return setLast('너무 일러요');
    if (feet[best] !== f) {
      st.judged[best] = 'miss';
      return setLast('발이 틀렸어요');
    }
    const g = bd < 0.09 ? 'perfect' : 'good';
    st.judged[best] = g;
    st.score += g === 'perfect' ? 1 : 0.6;
    setLast(g === 'perfect' ? '딱 맞아요!' : '좋아요');
  };
  const st = s.current;
  return (
    <>
      <Hud items={[['박자', `${st.judged.filter(Boolean).length}/${N}`], ['판정', last || '-']]} />
      <Stage ratio={1.4} className="mg-field">
        <div className="mg-hitline" style={{ left: '20%' }} />
        {feet.map((f, i) => {
          const x = 20 + (i * gap - st.t) * 40;
          if (x < -5 || x > 105) return null;
          const j = st.judged[i];
          return (
            <div key={i} className="mg-at" style={{ left: `${x}%`, top: f === 'L' ? '38%' : '62%', fontSize: 24, opacity: j ? 0.3 : 1 }}>
              {j === 'perfect' ? '✨' : j === 'miss' ? '✖️' : f === 'L' ? '🦶' : '🦶🏽'}
            </div>
          );
        })}
        <div className="mg-tip">위 = 왼발 · 아래 = 오른발 · 세로 줄에 닿을 때 눌러요</div>
      </Stage>
      <div className="buttons">
        <button className="primary" onPointerDown={() => hit('L')}>
          왼발
        </button>
        <button className="primary" onPointerDown={() => hit('R')}>
          오른발
        </button>
      </div>
    </>
  );
}

/* ── 지구력 게이지 ── */
export function FitPushup({ level, report, finish }: MiniProps) {
  const target = Math.round(60 + 20 * (level - 1));
  const s = useRef({ reps: 0, breath: 0, rest: 0, down: false, t: 0, over: false });
  const [, tick] = useState(0);
  useLoop((dt) => {
    const st = s.current;
    if (st.over) return;
    st.t += dt;
    st.breath = Math.max(0, st.breath - dt * 24);
    st.rest = Math.max(0, st.rest - dt);
    report(st.reps / target);
    if (st.reps >= target) {
      st.over = true;
      finish(1);
    }
    tick((x) => x + 1);
  });
  const press = () => {
    const st = s.current;
    if (st.rest > 0) return;
    st.reps++;
    st.down = !st.down;
    st.breath += 11;
    if (st.breath >= 100) {
      st.rest = 2;
      st.breath = 60;
    }
  };
  const st = s.current;
  return (
    <>
      <Hud items={[['횟수', `${st.reps}/${target}`], ['상태', st.rest > 0 ? '숨 고르는 중' : '좋아요']]} />
      <Stage ratio={1.6} className="mg-field">
        <div className="mg-at" style={{ left: '50%', top: '55%', fontSize: 56, transform: `translate(-50%,-50%) scaleY(${st.down ? 0.7 : 1})` }}>
          {st.rest > 0 ? '😮‍💨' : '🏋️'}
        </div>
        <div className="mg-meter vert" style={{ right: '8%', top: '10%', bottom: '10%' }}>
          <i style={{ height: `${st.breath}%`, background: st.breath > 75 ? '#ef4444' : '#38bdf8' }} />
          <b style={{ bottom: '75%' }} />
        </div>
        <div className="mg-tip">숨 막대가 노란 줄을 넘지 않게 박자를 맞춰요</div>
      </Stage>
      <button className="primary wide big" onPointerDown={press} disabled={st.rest > 0}>
        {st.rest > 0 ? '쉬는 중…' : '💪 누르기'}
      </button>
    </>
  );
}
