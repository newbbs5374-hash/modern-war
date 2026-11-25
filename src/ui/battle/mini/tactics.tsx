// 전술 훈련 미니게임 3개
import { useMemo, useRef, useState } from 'react';
import { Rng } from '../../../game/rng';
import { D4, bfsLen, makeSlidePuzzle, slideEnd } from '../../../battle/miniLogic';
import { Hud, Stage, clamp01, pctOf, useRng, type MiniProps } from './kit';

/* ── 몇 수 제압 퍼즐 ── */
export function TacPuzzle({ level, seed, report, finish }: MiniProps) {
  const rng = useRng(seed);
  const N = 3;
  const puzzles = useMemo(() => Array.from({ length: N }, (_, i) => makeSlidePuzzle(rng, 2 + i + Math.round(level - 1))), [rng, level]);
  const [no, setNo] = useState(0);
  const p = puzzles[Math.min(no, N - 1)];
  const [units, setUnits] = useState(p.units);
  const [enemies, setEnemies] = useState(p.enemies);
  const [used, setUsed] = useState(0);
  const [sel, setSel] = useState(0);
  const [resets, setResets] = useState(0);
  const solved = useRef(0);
  const load = (k: number) => {
    setUnits(puzzles[k].units);
    setEnemies(puzzles[k].enemies);
    setUsed(0);
    setSel(0);
  };
  const next = (ok: boolean) => {
    if (ok) solved.current++;
    const sc = clamp01(solved.current / N - resets * 0.03);
    report(sc);
    if (no + 1 >= N) finish(sc);
    else {
      setNo(no + 1);
      load(no + 1);
    }
  };
  const tap = (i: number) => {
    const u = units.indexOf(i);
    if (u >= 0) return setSel(u);
    const from = units[sel];
    const c = i % p.cols;
    const r = Math.floor(i / p.cols);
    const fc = from % p.cols;
    const fr = Math.floor(from / p.cols);
    if (c !== fc && r !== fr) return;
    const dir = r < fr ? 0 : c > fc ? 1 : r > fr ? 2 : 3;
    const e = slideEnd(p, units, enemies, from, dir);
    if (e < 0) return;
    const nu = [...units];
    nu[sel] = e;
    const ne = enemies.filter((x) => x !== e);
    setUnits(nu);
    setEnemies(ne);
    const nUsed = used + 1;
    setUsed(nUsed);
    if (!ne.length) next(true);
  };
  const reset = () => {
    setResets(resets + 1);
    load(no);
  };
  const stuck = used >= p.moves && enemies.length > 0;
  return (
    <>
      <Hud items={[['판', `${no + 1}/${N}`], ['남은 수', Math.max(0, p.moves - used)], ['남은 적', enemies.length]]} />
      <Stage ratio={p.cols / p.rows}>
        <div className="mg-grid" style={{ gridTemplateColumns: `repeat(${p.cols}, 1fr)` }}>
          {p.wall.map((w, i) => {
            const u = units.indexOf(i);
            const from = units[sel];
            const line = !w && u < 0 && (i % p.cols === from % p.cols || Math.floor(i / p.cols) === Math.floor(from / p.cols));
            return (
              <button key={i} className={`mg-cell ${w ? 'wall' : ''} ${u === sel ? 'sel' : ''} ${line ? 'near' : ''}`} onClick={() => !stuck && tap(i)}>
                {w ? '🧱' : u >= 0 ? '🪖' : enemies.includes(i) ? '👹' : ''}
              </button>
            );
          })}
        </div>
      </Stage>
      <div className="buttons">
        {stuck && <span className="small warn">수를 다 썼어요</span>}
        <button onClick={reset}>↺ 처음부터</button>
        <button onClick={() => next(false)}>이 판 넘기기</button>
      </div>
    </>
  );
}

/* ── 엄폐 자리 찾기 ── */
const CC = 6;
const CR = 7;
interface CoverMap {
  wall: boolean[];
  foes: Array<{ c: number; r: number; d: number }>;
  green: number[];
}
function fireCells(m: CoverMap): Set<number> {
  const out = new Set<number>();
  for (const f of m.foes) {
    // 바라보는 쪽 + 양옆 대각선
    const [dx, dy] = D4[f.d];
    const rays: Array<[number, number]> = [[dx, dy], dx === 0 ? [1, dy] : [dx, 1], dx === 0 ? [-1, dy] : [dx, -1]];
    for (const [ax, ay] of rays) {
      let c = f.c;
      let r = f.r;
      for (;;) {
        c += ax;
        r += ay;
        if (c < 0 || r < 0 || c >= CC || r >= CR) break;
        const i = r * CC + c;
        if (m.wall[i]) break;
        out.add(i);
      }
    }
  }
  return out;
}
function makeCover(rng: Rng, level: number): CoverMap {
  for (;;) {
    const wall = Array.from({ length: CC * CR }, (_, i) => Math.floor(i / CC) > 0 && rng.chance(0.22));
    const foes: CoverMap['foes'] = [];
    const n = level > 1.5 ? 3 : 2;
    while (foes.length < n) {
      const c = Math.floor(rng.next() * CC);
      if (foes.some((f) => f.c === c)) continue;
      foes.push({ c, r: 0, d: 2 });
      wall[c] = false;
    }
    const green = [];
    for (let r = 3; r <= 4; r++) for (let c = 0; c < CC; c++) if (!wall[r * CC + c]) green.push(r * CC + c);
    const m = { wall, foes, green };
    const fire = fireCells(m);
    const safe = green.filter((i) => !fire.has(i)).length;
    if (safe >= 3 && safe <= green.length - 3) return m;
  }
}
export function TacCover({ level, seed, report, finish }: MiniProps) {
  const rng = useRng(seed);
  const N = 4;
  const maps = useMemo(() => Array.from({ length: N }, () => makeCover(rng, level)), [rng, level]);
  const [no, setNo] = useState(0);
  const [placed, setPlaced] = useState<number[]>([]);
  const [show, setShow] = useState(false);
  const total = useRef(0);
  const m = maps[Math.min(no, N - 1)];
  const fire = useMemo(() => fireCells(m), [m]);
  const tap = (i: number) => {
    if (show || !m.green.includes(i)) return;
    if (placed.includes(i)) setPlaced(placed.filter((x) => x !== i));
    else if (placed.length < 3) setPlaced([...placed, i]);
  };
  const done = () => {
    if (!show) {
      if (placed.length < 3) return;
      total.current += placed.filter((i) => !fire.has(i)).length / 3;
      report(total.current / N);
      setShow(true);
      return;
    }
    if (no + 1 >= N) return finish(total.current / N);
    setNo(no + 1);
    setPlaced([]);
    setShow(false);
  };
  return (
    <>
      <Hud items={[['판', `${no + 1}/${N}`], ['놓은 병사', `${placed.length}/3`]]} />
      <Stage ratio={CC / CR}>
        <div className="mg-grid" style={{ gridTemplateColumns: `repeat(${CC}, 1fr)` }}>
          {m.wall.map((w, i) => {
            const f = m.foes.find((x) => x.r * CC + x.c === i);
            const p = placed.includes(i);
            return (
              <button key={i} className={`mg-cell ${w ? 'wall' : ''} ${m.green.includes(i) ? 'goal' : ''} ${show && fire.has(i) ? 'fire' : ''}`} onClick={() => tap(i)}>
                {w ? '🧱' : f ? '🔫' : p ? (show ? (fire.has(i) ? '💥' : '🪖') : '🪖') : f === undefined && Math.floor(i / CC) === 0 ? '' : ''}
              </button>
            );
          })}
        </div>
      </Stage>
      <p className="small muted">🔫 적은 아래쪽 곧게 + 양 대각선으로 쏴요(벽 🧱에 막힘).</p>
      <button className="primary wide" disabled={!show && placed.length < 3} onClick={done}>
        {show ? (no + 1 >= N ? '끝' : '다음 판') : '배치 끝'}
      </button>
    </>
  );
}

/* ── 진격로 긋기 ── */
const RC = 7;
const RR = 9;
interface RouteMap {
  mine: boolean[];
  bunker: number[];
  start: number;
  goal: number;
}
function danger(m: RouteMap, i: number): boolean {
  if (m.mine[i]) return true;
  const c = i % RC;
  const r = Math.floor(i / RC);
  return m.bunker.some((b) => Math.max(Math.abs((b % RC) - c), Math.abs(Math.floor(b / RC) - r)) <= 1);
}
function makeRoute(rng: Rng, level: number): RouteMap & { best: number } {
  for (;;) {
    const start = RC * (RR - 1) + Math.floor(rng.next() * RC);
    const goal = Math.floor(rng.next() * RC);
    const mine = Array.from({ length: RC * RR }, (_, i) => i !== start && i !== goal && rng.chance(0.1 * level));
    const bunker: number[] = [];
    while (bunker.length < 3) {
      const i = RC * (2 + Math.floor(rng.next() * (RR - 4))) + Math.floor(rng.next() * RC);
      if (!bunker.includes(i)) bunker.push(i);
    }
    const m = { mine, bunker, start, goal };
    const best = bfsLen(RC, RR, start, goal, (i) => danger(m, i) || bunker.includes(i));
    if (best > 0) return { ...m, best };
  }
}
export function TacRoute({ level, seed, report, finish }: MiniProps) {
  const rng = useRng(seed);
  const N = 3;
  const maps = useMemo(() => Array.from({ length: N }, () => makeRoute(rng, level)), [rng, level]);
  const [no, setNo] = useState(0);
  const m = maps[Math.min(no, N - 1)];
  const [path, setPath] = useState<number[]>([m.start]);
  const [res, setRes] = useState<string>('');
  const total = useRef(0);
  const drawing = useRef(false);
  const stage = useRef<HTMLDivElement>(null);
  const cellAt = (e: React.PointerEvent) => {
    const p = pctOf(e, stage.current);
    const c = Math.floor((p.x / 100) * RC);
    const r = Math.floor((p.y / 100) * RR);
    return c < 0 || r < 0 || c >= RC || r >= RR ? -1 : r * RC + c;
  };
  const extend = (i: number) => {
    if (i < 0) return;
    setPath((pth) => {
      const last = pth[pth.length - 1];
      if (i === last || last === m.goal) return pth;
      if (pth.length > 1 && pth[pth.length - 2] === i) return pth.slice(0, -1);
      const adj = Math.abs((i % RC) - (last % RC)) + Math.abs(Math.floor(i / RC) - Math.floor(last / RC)) === 1;
      if (!adj || pth.includes(i) || m.bunker.includes(i)) return pth;
      const np = [...pth, i];
      if (i === m.goal) setTimeout(() => judge(np), 0);
      return np;
    });
  };
  const judge = (pth: number[]) => {
    const hits = pth.filter((i) => danger(m, i)).length;
    const len = pth.length - 1;
    const sc = clamp01(1 - hits * 0.25 - Math.max(0, len - m.best) * 0.04);
    total.current += sc;
    setRes(`위험 ${hits}칸 · 길이 ${len}칸(가장 짧은 안전한 길 ${m.best}칸) → ${Math.round(sc * 100)}점`);
    report(total.current / N);
  };
  const next = () => {
    if (no + 1 >= N) return finish(total.current / N);
    setNo(no + 1);
    setPath([maps[no + 1].start]);
    setRes('');
  };
  const done = path[path.length - 1] === m.goal;
  return (
    <>
      <Hud items={[['지도', `${no + 1}/${N}`], ['길이', path.length - 1]]} />
      <Stage
        ratio={RC / RR}
        stageRef={stage}
        onPointerDown={(e) => {
          drawing.current = true;
          (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
          extend(cellAt(e));
        }}
        onPointerMove={(e) => drawing.current && extend(cellAt(e))}
        onPointerUp={() => (drawing.current = false)}
      >
        <div className="mg-grid" style={{ gridTemplateColumns: `repeat(${RC}, 1fr)` }}>
          {m.mine.map((mi, i) => (
            <div key={i} className={`mg-cell ${path.includes(i) ? 'path' : ''} ${done && danger(m, i) ? 'fire' : ''}`}>
              {m.bunker.includes(i) ? '🏰' : i === m.goal ? '🚩' : i === m.start ? '🪖' : mi ? '💣' : ''}
            </div>
          ))}
        </div>
      </Stage>
      <p className="small muted">{res || '🏰 적 진지 둘레 8칸과 💣 지뢰는 위험해요.'}</p>
      <div className="buttons">
        <button disabled={done} onClick={() => setPath([m.start])}>
          ↺ 다시 긋기
        </button>
        {done && (
          <button className="primary" onClick={next}>
            {no + 1 >= N ? '끝' : '다음 지도'}
          </button>
        )}
      </div>
    </>
  );
}
