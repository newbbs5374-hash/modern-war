// 해킹 훈련 미니게임 3개
import { useMemo, useRef, useState } from 'react';
import { codeHint, makeFlowPuzzle } from '../../../battle/miniLogic';
import { Hud, Stage, clamp01, pctOf, useLoop, useRng, type MiniProps } from './kit';

/* ── 회로 잇기 ── */
const FLOW_C = ['#ef4444', '#3b82f6', '#22c55e', '#eab308', '#a855f7', '#f97316'];
export function HackFlow({ level, seed, report, finish }: MiniProps) {
  const rng = useRng(seed);
  const N = 3;
  const puzzles = useMemo(() => Array.from({ length: N }, (_, i) => makeFlowPuzzle(rng, 5 + (i > 0 && level > 1.3 ? 1 : 0), 3 + Math.min(2, i))), [rng, level]);
  const [no, setNo] = useState(0);
  const p = puzzles[Math.min(no, N - 1)];
  const [lines, setLines] = useState<number[][]>(p.pairs.map(() => []));
  const drawing = useRef<number | null>(null);
  const stage = useRef<HTMLDivElement>(null);
  const done = useRef(0);
  const ownerOf = (i: number) => lines.findIndex((l) => l.includes(i));
  const dotOf = (i: number) => p.pairs.findIndex(([a, b]) => a === i || b === i);
  const cellAt = (e: React.PointerEvent) => {
    const q = pctOf(e, stage.current);
    const c = Math.floor((q.x / 100) * p.size);
    const r = Math.floor((q.y / 100) * p.size);
    return c < 0 || r < 0 || c >= p.size || r >= p.size ? -1 : r * p.size + c;
  };
  const complete = (ls: number[][]) => ls.every((l, k) => l.length > 1 && l.includes(p.pairs[k][0]) && l.includes(p.pairs[k][1]));
  const down = (e: React.PointerEvent) => {
    const i = cellAt(e);
    if (i < 0) return;
    const d = dotOf(i);
    const o = ownerOf(i);
    const k = d >= 0 ? d : o;
    if (k < 0) return;
    drawing.current = k;
    setLines((ls) => ls.map((l, j) => (j !== k ? l : d >= 0 ? [i] : l.slice(0, l.indexOf(i) + 1))));
  };
  const move = (e: React.PointerEvent) => {
    const k = drawing.current;
    if (k === null) return;
    const i = cellAt(e);
    if (i < 0) return;
    setLines((ls) => {
      const l = ls[k];
      const last = l[l.length - 1];
      if (i === last) return ls;
      if (l.length > 1 && l[l.length - 2] === i) return ls.map((x, j) => (j === k ? x.slice(0, -1) : x));
      const adj = Math.abs((i % p.size) - (last % p.size)) + Math.abs(Math.floor(i / p.size) - Math.floor(last / p.size)) === 1;
      if (!adj || l.includes(i)) return ls;
      const d = dotOf(i);
      if (d >= 0 && d !== k) return ls;
      // 끝점에 닿았으면 더 못 감
      if (l.length > 1 && (last === p.pairs[k][0] || last === p.pairs[k][1]) && last !== l[0]) return ls;
      // 다른 선을 끊음
      const cut = ls.map((x, j) => (j !== k && x.includes(i) ? x.slice(0, x.indexOf(i)) : x));
      return cut.map((x, j) => (j === k ? [...l, i] : x));
    });
  };
  const up = () => {
    drawing.current = null;
    setLines((ls) => {
      if (complete(ls)) {
        done.current++;
        report(done.current / N);
        setTimeout(() => {
          if (no + 1 >= N) return finish(done.current / N);
          setNo(no + 1);
          setLines(puzzles[no + 1].pairs.map(() => []));
        }, 500);
      }
      return ls;
    });
  };
  const cs = 100 / p.size;
  return (
    <>
      <Hud items={[['회로', `${no + 1}/${N}`], ['이은 선', `${lines.filter((l, k) => l.includes(p.pairs[k][0]) && l.includes(p.pairs[k][1]) && l.length > 1).length}/${p.pairs.length}`]]} />
      <Stage ratio={1} className="mg-chip" stageRef={stage} onPointerDown={down} onPointerMove={move} onPointerUp={up}>
        <svg viewBox="0 0 100 100" className="mg-svg">
          {Array.from({ length: p.size * p.size }, (_, i) => (
            <rect key={i} x={(i % p.size) * cs + 0.5} y={Math.floor(i / p.size) * cs + 0.5} width={cs - 1} height={cs - 1} rx={2} fill="#0f172a" stroke="#1e3a5f" strokeWidth={0.4} />
          ))}
          {lines.map((l, k) =>
            l.length > 1 ? (
              <polyline key={k} points={l.map((i) => `${(i % p.size) * cs + cs / 2},${Math.floor(i / p.size) * cs + cs / 2}`).join(' ')} fill="none" stroke={FLOW_C[k]} strokeWidth={cs * 0.32} strokeLinecap="round" strokeLinejoin="round" />
            ) : null,
          )}
          {p.pairs.map(([a, b], k) =>
            [a, b].map((i) => <circle key={`${k}-${i}`} cx={(i % p.size) * cs + cs / 2} cy={Math.floor(i / p.size) * cs + cs / 2} r={cs * 0.3} fill={FLOW_C[k]} stroke="#fff" strokeWidth={0.8} />),
          )}
        </svg>
      </Stage>
    </>
  );
}

/* ── 비밀번호 맞히기 ── */
export function HackCode({ seed, report, finish }: MiniProps) {
  const rng = useRng(seed);
  const N = 2;
  const TRIES = 8;
  const secrets = useMemo(
    () =>
      Array.from({ length: N }, () => {
        const pool = [1, 2, 3, 4, 5, 6];
        const out: number[] = [];
        while (out.length < 4) out.push(pool.splice(Math.floor(rng.next() * pool.length), 1)[0]);
        return out;
      }),
    [rng],
  );
  const [no, setNo] = useState(0);
  const [cur, setCur] = useState<number[]>([]);
  const [hist, setHist] = useState<Array<{ g: number[]; exact: number; near: number }>>([]);
  const total = useRef(0);
  const sec = secrets[Math.min(no, N - 1)];
  const nextCode = (sc: number) => {
    total.current += sc;
    report(total.current / N);
    if (no + 1 >= N) return finish(total.current / N);
    setNo(no + 1);
    setHist([]);
    setCur([]);
  };
  const submit = () => {
    if (cur.length < 4) return;
    const h = codeHint(sec, cur);
    const nh = [{ g: cur, ...h }, ...hist];
    setHist(nh);
    setCur([]);
    if (h.exact === 4) return nextCode(clamp01(1 - Math.max(0, nh.length - 4) * 0.12));
    if (nh.length >= TRIES) nextCode(0.15 * Math.max(...nh.map((x) => x.exact)));
  };
  return (
    <>
      <Hud items={[['암호', `${no + 1}/${N}`], ['남은 기회', TRIES - hist.length]]} />
      <div className="mg-code">
        <div className="mg-code-cur">
          {[0, 1, 2, 3].map((i) => (
            <span key={i}>{cur[i] ?? '·'}</span>
          ))}
        </div>
        <div className="tiles c6">
          {[1, 2, 3, 4, 5, 6].map((d) => (
            <button key={d} disabled={cur.includes(d) || cur.length >= 4} onClick={() => setCur([...cur, d])}>
              {d}
            </button>
          ))}
        </div>
        <div className="buttons">
          <button onClick={() => setCur(cur.slice(0, -1))}>⌫ 지우기</button>
          <button className="primary" disabled={cur.length < 4} onClick={submit}>
            ⏎ 넣기
          </button>
        </div>
        <div className="mg-code-hist">
          {hist.map((h, i) => (
            <p key={i}>
              <b>{h.g.join(' ')}</b> <span>{'●'.repeat(h.exact) + '○'.repeat(h.near) || '없음'}</span>
            </p>
          ))}
        </div>
      </div>
    </>
  );
}

/* ── 방화벽 뚫기 ── */
const GLYPH = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function HackFirewall({ level, seed, report, finish }: MiniProps) {
  const rng = useRng(seed);
  const N = 8;
  const stream = useMemo(() => Array.from({ length: 400 }, () => GLYPH[Math.floor(rng.next() * GLYPH.length)]), [rng]);
  const targets = useMemo(() => Array.from({ length: N }, () => GLYPH[Math.floor(rng.next() * GLYPH.length)]), [rng]);
  // 목표 글자가 자주 나오도록 심어 둠
  useMemo(() => {
    targets.forEach((t) => {
      for (let k = 0; k < 6; k++) stream[Math.floor(rng.next() * stream.length)] = t;
    });
  }, [rng, stream, targets]);
  const s = useRef({ pos: 0, got: 0, miss: 0, flash: 0 });
  const [, tick] = useState(0);
  const st = s.current;
  const SPEED = 3.2 * level;
  useLoop((dt) => {
    st.pos += dt * SPEED;
    st.flash = Math.max(0, st.flash - dt);
    tick((x) => x + 1);
  });
  const W = 9;
  const center = Math.floor(st.pos + 0.5) + 4;
  const tap = () => {
    if (st.got >= N) return;
    const ch = stream[center % stream.length];
    if (ch === targets[st.got]) {
      st.got++;
      st.flash = 0.4;
      report(clamp01(st.got / N - st.miss * 0.06));
      if (st.got >= N) finish(clamp01(1 - st.miss * 0.06));
    } else {
      st.miss++;
      report(clamp01(st.got / N - st.miss * 0.06));
    }
  };
  const frac = st.pos - Math.floor(st.pos);
  return (
    <>
      <Hud items={[['뚫음', `${st.got}/${N}`], ['헛누름', st.miss], ['목표', targets[Math.min(st.got, N - 1)]]]} />
      <Stage ratio={2.2} className={`mg-term ${st.flash > 0 ? 'mg-ok' : ''}`} onPointerDown={tap}>
        <div className="mg-stream" style={{ transform: `translateX(${-frac * (100 / W)}%)` }}>
          {Array.from({ length: W + 1 }, (_, k) => (
            <span key={k}>
              {stream[(Math.floor(st.pos) + k) % stream.length]}
            </span>
          ))}
        </div>
        <div className="mg-window-box" />
        <div className="mg-tip">목표 글자 [{targets[Math.min(st.got, N - 1)]}] 가 가운데 칸에 오면 화면을 눌러요</div>
      </Stage>
    </>
  );
}
