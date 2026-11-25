// 보급 훈련 미니게임 3개
import { useMemo, useRef, useState } from 'react';
import { makePipePuzzle, makeTruck, pipeConnected, rot, rotPiece, type Piece } from '../../../battle/miniLogic';
import { Hud, Stage, clamp01, useRng, type MiniProps } from './kit';

/* ── 수송로 잇기 ── */
/** 연결 비트 → 도로 그림(SVG) */
export function RoadTile({ mask, lit }: { mask: number; lit?: boolean }) {
  const c = lit ? '#facc15' : '#cbd5e1';
  const seg = (b: number, d: string) => (mask & b ? <path d={d} stroke={c} strokeWidth={22} strokeLinecap="round" /> : null);
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%">
      {seg(1, 'M50 50 L50 0')}
      {seg(2, 'M50 50 L100 50')}
      {seg(4, 'M50 50 L50 100')}
      {seg(8, 'M50 50 L0 50')}
      <circle cx={50} cy={50} r={11} fill={c} />
    </svg>
  );
}
export function SupRoad({ level, seed, report, finish }: MiniProps) {
  const rng = useRng(seed);
  const N = 3;
  const size = level < 1.5 ? 5 : 6;
  const puzzles = useMemo(() => Array.from({ length: N }, () => makePipePuzzle(rng, size, size)), [rng, size]);
  const [no, setNo] = useState(0);
  const p = puzzles[Math.min(no, N - 1)];
  const [turn, setTurn] = useState(p.turn);
  const [taps, setTaps] = useState(0);
  const solved = useRef(0);
  const ok = pipeConnected(p, turn);
  const tap = (i: number) => {
    if (ok) return;
    const nt = [...turn];
    nt[i] = (nt[i] + 1) % 4;
    setTurn(nt);
    setTaps(taps + 1);
    if (pipeConnected(p, nt)) {
      solved.current++;
      report(solved.current / N);
      setTimeout(() => {
        if (no + 1 >= N) return finish(solved.current / N);
        setNo(no + 1);
        setTurn(puzzles[no + 1].turn);
      }, 700);
    }
  };
  return (
    <>
      <Hud items={[['판', `${no + 1}/${N}`], ['돌림', taps]]} />
      <div className="mg-pipe-wrap">
        <div className="mg-pipe-side">{Array.from({ length: p.rows }, (_, r) => <span key={r}>{r === p.inRow ? '🏭' : ''}</span>)}</div>
        <Stage ratio={1}>
          <div className="mg-grid" style={{ gridTemplateColumns: `repeat(${p.cols}, 1fr)` }}>
            {p.shape.map((m, i) => (
              <button key={i} className="mg-cell road" onClick={() => tap(i)}>
                <RoadTile mask={rot(m, turn[i])} lit={ok} />
              </button>
            ))}
          </div>
        </Stage>
        <div className="mg-pipe-side">{Array.from({ length: p.rows }, (_, r) => <span key={r}>{r === p.outRow ? '🚩' : ''}</span>)}</div>
      </div>
      {ok && <p className="small result">수송로가 이어졌어요! 🚚</p>}
    </>
  );
}

/* ── 트럭 짐 싣기 ── */
const COLORS = ['#f59e0b', '#22c55e', '#3b82f6', '#ef4444', '#a855f7', '#14b8a6', '#eab308', '#ec4899'];
export function SupTruck({ level, seed, report, finish }: MiniProps) {
  const rng = useRng(seed);
  const COLS = 6;
  const ROWS = level < 1.5 ? 4 : 5;
  const pieces = useMemo(() => makeTruck(rng, COLS, ROWS).map((p) => {
    let q = p;
    for (let k = Math.floor(rng.next() * 4); k > 0; k--) q = rotPiece(q);
    return q;
  }), [rng, ROWS]);
  const [shapes, setShapes] = useState<Piece[]>(pieces);
  const [placed, setPlaced] = useState<Record<number, number[]>>({});
  const [sel, setSel] = useState<number>(0);
  const grid = new Array(COLS * ROWS).fill(-1);
  for (const [k, cells] of Object.entries(placed)) for (const c of cells) grid[c] = Number(k);
  const filled = grid.filter((x) => x >= 0).length;
  const tap = (i: number) => {
    if (grid[i] >= 0) {
      // 실은 상자 빼기
      const k = grid[i];
      const np = { ...placed };
      delete np[k];
      setPlaced(np);
      setSel(k);
      return;
    }
    if (placed[sel] !== undefined) return;
    const c0 = i % COLS;
    const r0 = Math.floor(i / COLS);
    const cells: number[] = [];
    for (const [x, y] of shapes[sel]) {
      const c = c0 + x;
      const r = r0 + y;
      if (c >= COLS || r >= ROWS || grid[r * COLS + c] >= 0) return;
      cells.push(r * COLS + c);
    }
    const np = { ...placed, [sel]: cells };
    setPlaced(np);
    const f = filled + cells.length;
    report(f / (COLS * ROWS));
    if (f >= COLS * ROWS) return finish(1);
    const nxt = shapes.findIndex((_, k) => np[k] === undefined);
    if (nxt >= 0) setSel(nxt);
  };
  const turn = () => setShapes(shapes.map((s, k) => (k === sel ? rotPiece(s) : s)));
  return (
    <>
      <Hud items={[['채움', `${Math.round((filled / (COLS * ROWS)) * 100)}%`], ['남은 상자', shapes.length - Object.keys(placed).length]]} />
      <Stage ratio={COLS / ROWS} className="mg-truck">
        <div className="mg-grid" style={{ gridTemplateColumns: `repeat(${COLS}, 1fr)` }}>
          {grid.map((g, i) => (
            <button key={i} className="mg-cell" style={g >= 0 ? { background: COLORS[g % COLORS.length] } : undefined} onClick={() => tap(i)} />
          ))}
        </div>
      </Stage>
      <p className="small muted">상자를 고르고 짐칸을 누르면 왼쪽 위 칸 기준으로 실려요. 실은 상자를 누르면 다시 빼요.</p>
      <div className="mg-pieces">
        {shapes.map((s, k) =>
          placed[k] === undefined ? (
            <button key={k} className={sel === k ? 'on' : ''} onClick={() => setSel(k)}>
              <svg viewBox="0 0 40 40" width={40} height={40}>
                {s.map(([x, y], j) => (
                  <rect key={j} x={x * 10 + 1} y={y * 10 + 1} width={9} height={9} fill={COLORS[k % COLORS.length]} />
                ))}
              </svg>
            </button>
          ) : null,
        )}
        <button onClick={turn}>↻ 돌리기</button>
      </div>
    </>
  );
}

/* ── 배급 나누기 ── */
const RES = [
  { k: '탄약', i: '🧨' },
  { k: '식량', i: '🥫' },
  { k: '연료', i: '⛽' },
];
export function SupRation({ level, seed, report, finish }: MiniProps) {
  const rng = useRng(seed);
  const N = 3;
  const UNITS = ['🪖 보병대', '🛡️ 전차대', '💥 포병대'];
  const rounds = useMemo(
    () =>
      Array.from({ length: N }, () =>
        UNITS.map((_, u) => RES.map((_, r) => Math.round(rng.range(1, 6 + level * 2)) + (u === 1 && r === 2 ? 3 : u === 2 && r === 0 ? 3 : 0))),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rng, level],
  );
  const [no, setNo] = useState(0);
  const need = rounds[Math.min(no, N - 1)];
  const stock = RES.map((_, r) => need.reduce((a, u) => a + u[r], 0));
  const [give, setGive] = useState<number[][]>(UNITS.map(() => [0, 0, 0]));
  const total = useRef(0);
  const [res, setRes] = useState('');
  const left = RES.map((_, r) => stock[r] - give.reduce((a, u) => a + u[r], 0));
  const add = (u: number, r: number, d: number) => {
    if (d > 0 && left[r] <= 0) return;
    if (d < 0 && give[u][r] <= 0) return;
    setGive(give.map((row, i) => (i === u ? row.map((v, j) => (j === r ? v + d : v)) : row)));
  };
  const send = () => {
    const err = need.reduce((a, row, u) => a + row.reduce((b, v, r) => b + Math.abs(v - give[u][r]), 0), 0);
    const all = stock.reduce((a, b) => a + b, 0);
    const sc = clamp01(1 - err / all);
    total.current += sc;
    report(total.current / N);
    setRes(`${Math.round(sc * 100)}점 · ${err ? `${err}개 어긋남` : '딱 맞아요!'}`);
    if (no + 1 >= N) return finish(total.current / N);
    setNo(no + 1);
    setGive(UNITS.map(() => [0, 0, 0]));
  };
  return (
    <>
      <Hud items={[['보급', `${no + 1}/${N}`], ['남은 물자', RES.map((x, r) => `${x.i}${left[r]}`).join(' ')]]} />
      <div className="mg-ration">
        {UNITS.map((u, ui) => (
          <div key={u} className="mg-ration-row">
            <b>{u}</b>
            {RES.map((x, r) => (
              <span key={x.k} className={give[ui][r] === need[ui][r] ? 'ok' : ''}>
                <small>
                  {x.i} 필요 {need[ui][r]}
                </small>
                <button onClick={() => add(ui, r, -1)}>−</button>
                <b>{give[ui][r]}</b>
                <button onClick={() => add(ui, r, 1)}>+</button>
              </span>
            ))}
          </div>
        ))}
      </div>
      {res && <p className="small result">{res}</p>}
      <button className="primary wide" onClick={send}>
        🚚 보내기
      </button>
    </>
  );
}
