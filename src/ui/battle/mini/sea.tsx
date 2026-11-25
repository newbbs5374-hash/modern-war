// 해상 훈련 미니게임 3개
import { useMemo, useRef, useState } from 'react';
import { Hud, Stage, clamp01, useLoop, useRng, type MiniProps } from './kit';

/* ── 소나 사냥 ── */
export function SeaSonar({ level, seed, report, finish }: MiniProps) {
  const rng = useRng(seed);
  const S = 8;
  const N = 3;
  const subs = useMemo(() => Array.from({ length: N }, () => Math.floor(rng.next() * S * S)), [rng]);
  const [no, setNo] = useState(0);
  const [pings, setPings] = useState<Record<number, number>>({});
  const [bombs, setBombs] = useState<number[]>([]);
  const [mode, setMode] = useState<'ping' | 'bomb'>('ping');
  const total = useRef(0);
  const [msg, setMsg] = useState('');
  const sub = subs[Math.min(no, N - 1)];
  const dist = (a: number, b: number) => Math.max(Math.abs((a % S) - (b % S)), Math.abs(Math.floor(a / S) - Math.floor(b / S)));
  const used = Object.keys(pings).length + bombs.length * 2;
  const nextSub = (sc: number, m: string) => {
    total.current += sc;
    report(total.current / N);
    setMsg(m);
    if (no + 1 >= N) return finish(total.current / N);
    setNo(no + 1);
    setPings({});
    setBombs([]);
    setMode('ping');
  };
  const tap = (i: number) => {
    if (mode === 'ping') {
      if (pings[i] !== undefined) return;
      setPings({ ...pings, [i]: dist(i, sub) });
      if (i === sub) nextSub(1, '소나가 잠수함에 바로 닿았어요! 격침');
      return;
    }
    if (bombs.includes(i)) return;
    const nb = [...bombs, i];
    setBombs(nb);
    if (dist(i, sub) === 0) nextSub(clamp01(1 - Math.max(0, used - 4) * 0.08 * level), `💥 격침! (소나 ${Object.keys(pings).length}번 · 폭뢰 ${nb.length}발)`);
    else if (nb.length >= 3) nextSub(0.1, '폭뢰를 다 썼어요. 잠수함이 도망쳤어요.');
    else setMsg(`빗나감 · 거리 ${dist(i, sub)}칸`);
  };
  return (
    <>
      <Hud items={[['잠수함', `${no + 1}/${N}`], ['소나', Object.keys(pings).length], ['폭뢰', `${3 - bombs.length}/3`]]} />
      <Stage ratio={1} className="mg-sea">
        <div className="mg-grid" style={{ gridTemplateColumns: `repeat(${S}, 1fr)` }}>
          {Array.from({ length: S * S }, (_, i) => (
            <button key={i} className={`mg-cell sea ${pings[i] !== undefined ? 'ping' : ''}`} onClick={() => tap(i)}>
              {bombs.includes(i) ? '💦' : pings[i] !== undefined ? <b>{pings[i]}</b> : ''}
            </button>
          ))}
        </div>
      </Stage>
      <p className="small muted">{msg || '숫자 = 가장 먼 쪽(가로·세로·대각선) 칸 수. 같은 숫자 칸들이 고리를 이뤄요.'}</p>
      <div className="buttons">
        <button className={mode === 'ping' ? 'primary' : ''} onClick={() => setMode('ping')}>
          📡 소나
        </button>
        <button className={mode === 'bomb' ? 'primary' : ''} onClick={() => setMode('bomb')}>
          💣 폭뢰
        </button>
      </div>
    </>
  );
}

/* ── 어뢰 피하기 ── */
export function SeaTorpedo({ level, seed, report, finish }: MiniProps) {
  const rng = useRng(seed);
  const N = 22;
  const plan = useMemo(() => {
    let t = 1;
    return Array.from({ length: N }, () => {
      t += rng.range(1.1, 2) / level;
      const fromLeft = rng.chance(0.5);
      return { at: t, x0: fromLeft ? -5 : 105, y0: rng.range(-10, 30), vx: (fromLeft ? 1 : -1) * rng.range(14, 26), vy: rng.range(22, 32) * level };
    });
  }, [rng, level]);
  const s = useRef({ t: 0, x: 50, steer: 0, hits: 0, inv: 0, dodged: 0, over: false, done: new Set<number>() });
  const [, tick] = useState(0);
  const st = s.current;
  useLoop((dt) => {
    if (st.over) return;
    st.t += dt;
    st.x = Math.max(8, Math.min(92, st.x + st.steer * dt * 38));
    st.inv = Math.max(0, st.inv - dt);
    plan.forEach((p, i) => {
      if (st.done.has(i) || st.t < p.at) return;
      const k = st.t - p.at;
      const x = p.x0 + p.vx * k;
      const y = p.y0 + p.vy * k;
      if (st.inv <= 0 && Math.abs(x - st.x) < 6 && Math.abs(y - 80) < 6) {
        st.hits++;
        st.inv = 1.2;
        st.done.add(i);
      } else if (y > 105 || x < -10 || x > 110) {
        st.done.add(i);
        st.dodged++;
      }
    });
    const sc = clamp01(1 - (st.hits / N) * 3);
    report(sc * (st.done.size / N));
    if (st.done.size >= N) {
      st.over = true;
      finish(sc);
    }
    tick((x) => x + 1);
  });
  const hold = (d: number) => ({
    onPointerDown: () => (st.steer = d),
    onPointerUp: () => (st.steer = 0),
    onPointerLeave: () => (st.steer = 0),
  });
  return (
    <>
      <Hud items={[['피함', st.dodged], ['맞음', st.hits]]} />
      <Stage ratio={0.85} className="mg-sea">
        {plan.map((p, i) => {
          if (st.done.has(i) || st.t < p.at) return null;
          const k = st.t - p.at;
          const ang = (Math.atan2(p.vy, p.vx) * 180) / Math.PI;
          return <div key={i} className="mg-torp" style={{ left: `${p.x0 + p.vx * k}%`, top: `${p.y0 + p.vy * k}%`, transform: `translate(-50%,-50%) rotate(${ang}deg)` }} />;
        })}
        <div className="mg-at" style={{ left: `${st.x}%`, top: '80%', fontSize: 30, opacity: st.inv > 0 ? 0.5 : 1 }}>
          🚢
        </div>
      </Stage>
      <div className="buttons">
        <button className="primary" {...hold(-1)}>
          ◀ 왼쪽
        </button>
        <button className="primary" {...hold(1)}>
          오른쪽 ▶
        </button>
      </div>
    </>
  );
}

/* ── 함대 대형 ── */
const SHIPS = [
  { k: '구축함', i: '🛳️' },
  { k: '호위함', i: '⛴️' },
  { k: '잠수함', i: '🐋' },
  { k: '보급함', i: '🚤' },
];
export function SeaFormation({ level, seed, report, finish }: MiniProps) {
  const rng = useRng(seed);
  const S = 5;
  const C = 12; // 가운데 항모
  const N = 3;
  const rounds = useMemo(
    () =>
      Array.from({ length: N }, (_, r) => {
        const n = 3 + r + Math.round(level - 1);
        const slots: Array<{ at: number; ship: number }> = [];
        while (slots.length < n) {
          const at = Math.floor(rng.next() * S * S);
          if (at === C || slots.some((s) => s.at === at)) continue;
          slots.push({ at, ship: Math.floor(rng.next() * SHIPS.length) });
        }
        return slots;
      }),
    [rng, level],
  );
  const [no, setNo] = useState(0);
  const [phase, setPhase] = useState<'look' | 'place' | 'check'>('look');
  const [placed, setPlaced] = useState<Record<number, number>>({});
  const [sel, setSel] = useState(0);
  const total = useRef(0);
  const lookT = useRef(0);
  const R = rounds[Math.min(no, N - 1)];
  useLoop((dt) => {
    if (phase !== 'look') return;
    lookT.current += dt;
    if (lookT.current > 2.4 + R.length * 0.5) setPhase('place');
  });
  const tap = (i: number) => {
    if (phase !== 'place' || i === C) return;
    if (placed[i] === sel) {
      const np = { ...placed };
      delete np[i];
      return setPlaced(np);
    }
    setPlaced({ ...placed, [i]: sel });
  };
  const check = () => {
    if (phase === 'place') {
      const right = R.filter((s) => placed[s.at] === s.ship).length;
      const extra = Object.keys(placed).length - right;
      const sc = clamp01((right - extra * 0.5) / R.length);
      total.current += sc;
      report(total.current / N);
      return setPhase('check');
    }
    if (no + 1 >= N) return finish(total.current / N);
    setNo(no + 1);
    setPlaced({});
    lookT.current = 0;
    setPhase('look');
  };
  const want = (i: number) => R.find((s) => s.at === i);
  return (
    <>
      <Hud items={[['대형', `${no + 1}/${N}`], ['배', R.length], ['단계', phase === 'look' ? '기억하기' : phase === 'place' ? '놓기' : '확인']]} />
      <Stage ratio={1} className="mg-sea">
        <div className="mg-grid" style={{ gridTemplateColumns: `repeat(${S}, 1fr)` }}>
          {Array.from({ length: S * S }, (_, i) => {
            const w = want(i);
            const p = placed[i];
            const show = phase === 'look' ? (w ? SHIPS[w.ship].i : '') : p !== undefined ? SHIPS[p].i : '';
            const mark = phase === 'check' ? (w && p === w.ship ? 'path' : w || p !== undefined ? 'fire' : '') : '';
            return (
              <button key={i} className={`mg-cell sea ${mark}`} onClick={() => tap(i)}>
                {i === C ? '🛫' : show}
                {phase === 'check' && w && p !== w.ship && <small className="mg-ghost">{SHIPS[w.ship].i}</small>}
              </button>
            );
          })}
        </div>
      </Stage>
      {phase !== 'look' ? (
        <>
          <div className="tiles c4">
            {SHIPS.map((s, k) => (
              <button key={s.k} className={sel === k ? 'on' : ''} disabled={phase !== 'place'} onClick={() => setSel(k)}>
                {s.i} {s.k}
              </button>
            ))}
          </div>
          <button className="primary wide" onClick={check}>
            {phase === 'place' ? '대형 완성' : no + 1 >= N ? '끝' : '다음 대형'}
          </button>
        </>
      ) : (
        <p className="small muted">🛫 항모 둘레 배 자리를 기억해요…</p>
      )}
    </>
  );
}
