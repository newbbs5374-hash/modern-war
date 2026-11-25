// 통솔 훈련 미니게임 3개
import { useMemo, useRef, useState } from 'react';
import { Hud, Stage, clamp01, useLoop, useRng, type MiniProps } from './kit';

/* ── 방어선 옮기기 ── */
export function LeadLine({ level, seed, report, finish }: MiniProps) {
  const rng = useRng(seed);
  const LANES = 5;
  const SQ = level < 1.4 ? 2 : 3;
  const foes = useMemo(() => {
    let t = 1;
    return Array.from({ length: 26 }, () => {
      t += rng.range(1.2, 2.4) / level;
      return { at: t, lane: Math.floor(rng.next() * LANES), y: 0, hp: 1, state: '' as '' | 'dead' | 'broke', speed: rng.range(9, 13) * level };
    });
  }, [rng, level]);
  const s = useRef({ t: 0, squads: Array.from({ length: SQ }, (_, i) => ({ lane: Math.round(((i + 1) * LANES) / (SQ + 1)), to: -1, x: Math.round(((i + 1) * LANES) / (SQ + 1)) })), sel: 0, kills: 0, broke: 0, over: false });
  const [, tick] = useState(0);
  const st = s.current;
  useLoop((dt) => {
    if (st.over) return;
    st.t += dt;
    for (const q of st.squads) {
      if (q.to >= 0) {
        const d = q.to - q.x;
        const step = dt * 3.2;
        if (Math.abs(d) <= step) {
          q.x = q.to;
          q.lane = q.to;
          q.to = -1;
        } else q.x += Math.sign(d) * step;
      }
    }
    for (const f of foes) {
      if (f.state || st.t < f.at) continue;
      f.y += dt * f.speed;
      const guard = st.squads.some((q) => q.to < 0 && q.lane === f.lane);
      if (guard && f.y > 45) {
        f.hp -= dt * 1.6;
        if (f.hp <= 0) {
          f.state = 'dead';
          st.kills++;
        }
        f.y = Math.min(f.y, 72);
      }
      if (f.y >= 92) {
        f.state = 'broke';
        st.broke++;
      }
    }
    const seen = foes.filter((f) => f.state).length;
    report(clamp01((seen - st.broke * 2.2) / foes.length));
    if (foes.every((f) => f.state)) {
      st.over = true;
      finish(clamp01(1 - (st.broke / foes.length) * 2.2));
    }
    tick((x) => x + 1);
  });
  return (
    <>
      <Hud items={[['막음', st.kills], ['뚫림', st.broke], ['남은 적', foes.filter((f) => !f.state).length]]} />
      <Stage ratio={0.9} className="mg-field">
        <div className="mg-lanes" style={{ gridTemplateColumns: `repeat(${LANES}, 1fr)` }}>
          {Array.from({ length: LANES }, (_, l) => (
            <button key={l} className="mg-lanebtn" onClick={() => (st.squads[st.sel].to = l)} />
          ))}
        </div>
        {foes.map((f, i) =>
          !f.state && st.t >= f.at ? (
            <div key={i} className="mg-at" style={{ left: `${(f.lane + 0.5) * (100 / LANES)}%`, top: `${f.y}%`, fontSize: 20, pointerEvents: 'none' }}>
              👹
            </div>
          ) : null,
        )}
        {st.squads.map((q, i) => (
          <button
            key={i}
            className={`mg-squad ${st.sel === i ? 'sel' : ''}`}
            style={{ left: `${(q.x + 0.5) * (100 / LANES)}%`, top: '80%' }}
            onClick={(e) => {
              e.stopPropagation();
              st.sel = i;
            }}
          >
            🪖{i + 1}
          </button>
        ))}
        <div className="mg-tip">분대를 고르고(노란 테두리) 길을 눌러 옮겨요</div>
      </Stage>
    </>
  );
}

/* ── 사기 지키기 ── */
export function LeadMorale({ level, seed, report }: MiniProps) {
  const rng = useRng(seed);
  const N = Math.round(4 + (level - 1) * 2);
  const s = useRef({
    t: 0,
    bars: Array.from({ length: N }, () => ({ v: rng.range(60, 90), rate: rng.range(5, 11) * level, routT: 0, shock: 0 })),
    sum: 0,
    cool: 0,
    routs: 0,
  });
  const [, tick] = useState(0);
  const st = s.current;
  useLoop((dt) => {
    st.t += dt;
    st.cool = Math.max(0, st.cool - dt);
    for (const b of st.bars) {
      if (b.routT > 0) {
        b.routT -= dt;
        if (b.routT <= 0) b.v = 40;
        continue;
      }
      if (rng.chance(dt * 0.08)) b.shock = 1.2; // 포격: 잠깐 빨리 떨어짐
      b.shock = Math.max(0, b.shock - dt);
      b.v -= dt * b.rate * (b.shock > 0 ? 3 : 1);
      if (b.v <= 0) {
        b.v = 0;
        b.routT = 3;
        st.routs++;
      }
    }
    const avg = st.bars.reduce((a, b) => a + (b.routT > 0 ? 0 : b.v), 0) / N / 100;
    st.sum += avg * dt;
    report(clamp01((st.sum / Math.max(1, st.t)) * 1.25));
    tick((x) => x + 1);
  });
  const cheer = (i: number) => {
    const b = st.bars[i];
    if (st.cool > 0 || b.routT > 0) return;
    b.v = Math.min(100, b.v + 38);
    st.cool = 0.35;
  };
  return (
    <>
      <Hud items={[['분대', N], ['흩어짐', st.routs]]} />
      <div className="mg-bars">
        {st.bars.map((b, i) => (
          <button key={i} className={`mg-bar ${b.shock > 0 ? 'shock' : ''}`} onPointerDown={() => cheer(i)}>
            <span>{b.routT > 0 ? '🏳️' : b.v < 30 ? '😨' : b.v < 60 ? '😐' : '😤'} {i + 1}분대</span>
            <i style={{ width: `${b.routT > 0 ? 0 : b.v}%`, background: b.v < 30 ? '#ef4444' : b.v < 60 ? '#f59e0b' : '#22c55e' }} />
          </button>
        ))}
      </div>
      <p className="small muted">💥 포격 맞은 분대는 사기가 빨리 떨어져요(빨간 테두리).</p>
    </>
  );
}

/* ── 명령 순서 기억 ── */
const ORDERS = [
  { k: '전진', i: '⬆️' },
  { k: '엄폐', i: '🛡️' },
  { k: '사격', i: '🔫' },
  { k: '후퇴', i: '⬇️' },
];
export function LeadOrder({ level, seed, report, finish }: MiniProps) {
  const rng = useRng(seed);
  const TARGET = 9;
  const seq = useMemo(() => Array.from({ length: 20 }, () => Math.floor(rng.next() * 4)), [rng]);
  const [len, setLen] = useState(3);
  const [phase, setPhase] = useState<'show' | 'input'>('show');
  const [showI, setShowI] = useState(-1);
  const [inp, setInp] = useState(0);
  const [lives, setLives] = useState(2);
  const best = useRef(2);
  const timer = useRef(0);
  const gapT = 0.75 / level;
  useLoop((dt) => {
    if (phase !== 'show') return;
    timer.current += dt;
    const k = Math.floor(timer.current / gapT) - 1;
    if (k >= len) {
      setPhase('input');
      setShowI(-1);
      setInp(0);
    } else setShowI(k);
  });
  const restart = (n: number) => {
    timer.current = 0;
    setLen(n);
    setPhase('show');
  };
  const press = (o: number) => {
    if (phase !== 'input') return;
    if (seq[inp] !== o) {
      const l = lives - 1;
      setLives(l);
      if (l < 0) return finish(clamp01((best.current - 2) / (TARGET - 2)));
      return restart(len);
    }
    if (inp + 1 >= len) {
      best.current = len;
      const sc = clamp01((len - 2) / (TARGET - 2));
      report(sc);
      if (len >= TARGET) return finish(1);
      return restart(len + 1);
    }
    setInp(inp + 1);
  };
  return (
    <>
      <Hud items={[['길이', `${len}/${TARGET}`], ['기회', Math.max(0, lives) + 1]]} />
      <Stage ratio={1.6} className="mg-hq">
        <div className="mg-center">
          <div style={{ fontSize: 44 }}>{phase === 'show' ? (showI >= 0 ? ORDERS[seq[showI]].i : '🧑‍✈️') : '❓'}</div>
          <small>{phase === 'show' ? (showI >= 0 ? `${showI + 1}. ${ORDERS[seq[showI]].k}!` : '부관: 잘 보세요') : `${inp + 1}번째 명령은?`}</small>
        </div>
      </Stage>
      <div className="tiles c4">
        {ORDERS.map((o, i) => (
          <button key={o.k} className="mg-order" disabled={phase !== 'input'} onClick={() => press(i)}>
            <span>{o.i}</span>
            {o.k}
          </button>
        ))}
      </div>
    </>
  );
}
