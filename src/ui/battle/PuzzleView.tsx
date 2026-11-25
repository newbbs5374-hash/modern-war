// ⑤ 퍼즐·카드 4종 화면
import { useEffect, useRef, useState } from 'react';
import {
  PUZZLE_GOAL,
  createPuzzle,
  finishPuzzle,
  guessCode,
  hackCanMove,
  moveHack,
  pipeFlow,
  recruitTotals,
  stepCost,
  submitRecruit,
  tapPipe,
  tickHack,
  toggleRecruit,
  type CodePuzzle,
  type HackPuzzle,
  type PipePuzzle,
  type Puzzle,
  type PuzzleKind,
  type RecruitPuzzle,
} from '../../battle/puzzle';
import { BattleBar, type FrameProps } from './BattleScreen';

export function PuzzleView({ spec, rank, onEnd }: FrameProps) {
  const kind = spec.variant as PuzzleKind;
  const [p, setP] = useState<Puzzle>(() => createPuzzle(kind, spec.seed, rank + Math.round((spec.difficulty - 1) * 10)));
  const [speed, setSpeed] = useState(1);
  const ended = useRef(false);
  useEffect(() => {
    if (p.result && !ended.current) {
      ended.current = true;
      onEnd(p.result);
    }
  }, [p.result, onEnd]);
  // 해킹은 시간이 흐름
  useEffect(() => {
    if (p.kind !== '해킹' || p.result) return;
    const t = setInterval(() => setP((q) => tickHack(q as HackPuzzle, 200 * speed)), 200);
    return () => clearInterval(t);
  }, [p.kind, p.result, speed]);

  return (
    <>
      <BattleBar
        auto={false}
        setAuto={() => setP(finishPuzzle(p))}
        speed={p.kind === '해킹' ? speed : undefined}
        setSpeed={p.kind === '해킹' ? setSpeed : undefined}
        done={!!p.result}
        onInstant={() => setP(finishPuzzle(p))}
      />
      <div className="battle-info small">
        <span className="muted">{PUZZLE_GOAL[kind]}</span>
      </div>
      {p.kind === '모병' && <RecruitUI p={p} set={setP} />}
      {p.kind === '정보' && <CodeUI p={p} set={setP} />}
      {p.kind === '보급' && <PipeUI p={p} set={setP} />}
      {p.kind === '해킹' && <HackUI p={p} set={setP} />}
    </>
  );
}

function RecruitUI({ p, set }: { p: RecruitPuzzle; set: (p: Puzzle) => void }) {
  const t = recruitTotals(p);
  return (
    <>
      <div className="kv small">
        <span>예산</span>
        <b>
          {t.cost} / {p.budget}
        </b>
        <span>사격</span>
        <b className={t.shoot >= p.needShoot ? 'ok' : ''}>
          {t.shoot} / {p.needShoot}
        </b>
        <span>체력</span>
        <b className={t.body >= p.needBody ? 'ok' : ''}>
          {t.body} / {p.needBody}
        </b>
      </div>
      <div className="cards">
        {p.cards.map((c) => (
          <button key={c.id} className={`card-pick ${p.picked.includes(c.id) ? 'on' : ''}`} onClick={() => set(toggleRecruit(p, c.id))} disabled={!!p.result}>
            <b>{c.name}</b>
            <small className="muted">{c.trait}</small>
            <small>
              🎯 {c.shoot} · 💪 {c.body}
            </small>
            <small>💵 {c.cost}</small>
          </button>
        ))}
      </div>
      <button className="primary wide" disabled={!p.picked.length || !!p.result} onClick={() => set(submitRecruit(p))}>
        이 분대로 정하기 ({p.picked.length}/4명)
      </button>
    </>
  );
}

function CodeUI({ p, set }: { p: CodePuzzle; set: (p: Puzzle) => void }) {
  const [cur, setCur] = useState<number[]>([]);
  return (
    <>
      <ul className="code-list">
        {p.guesses.map((g, i) => (
          <li key={i}>
            <span className="code">{g.g.join(' ')}</span>
            <span>
              {'●'.repeat(g.exact)}
              {'○'.repeat(g.near)}
              {g.exact + g.near === 0 ? '없음' : ''}
            </span>
          </li>
        ))}
        {!p.result && (
          <li className="now">
            <span className="code">{[0, 1, 2, 3].map((i) => cur[i] ?? '_').join(' ')}</span>
            <small className="muted">
              {p.guesses.length + 1}번째 / {p.max}
            </small>
          </li>
        )}
      </ul>
      <div className="buttons keypad">
        {[1, 2, 3, 4, 5, 6].map((n) => (
          <button key={n} disabled={cur.length >= 4 || !!p.result} onClick={() => setCur([...cur, n])}>
            {n}
          </button>
        ))}
        <button disabled={!cur.length} onClick={() => setCur(cur.slice(0, -1))}>
          ⌫
        </button>
        <button
          className="primary"
          disabled={cur.length !== 4 || !!p.result}
          onClick={() => {
            set(guessCode(p, cur));
            setCur([]);
          }}
        >
          확인
        </button>
      </div>
    </>
  );
}

function PipeUI({ p, set }: { p: PipePuzzle; set: (p: Puzzle) => void }) {
  const flow = pipeFlow(p);
  return (
    <>
      <p className="small">
        누른 횟수 {p.taps} / {p.limit}
      </p>
      <div className="pipe-wrap">
        <div className="pipe-side">{Array.from({ length: p.h }, (_, y) => <span key={y}>{y === p.start ? '🏭' : ''}</span>)}</div>
        <div className="pipe-board" style={{ gridTemplateColumns: `repeat(${p.w}, minmax(0, 1fr))` }}>
          {p.cells.map((m, i) => (
            <button key={i} className={`pipe ${flow.has(i) ? 'flow' : ''}`} onClick={() => set(tapPipe(p, i))} disabled={!!p.result}>
              <svg viewBox="0 0 40 40">
                {m & 1 ? <line x1="20" y1="20" x2="20" y2="0" /> : null}
                {m & 2 ? <line x1="20" y1="20" x2="40" y2="20" /> : null}
                {m & 4 ? <line x1="20" y1="20" x2="20" y2="40" /> : null}
                {m & 8 ? <line x1="20" y1="20" x2="0" y2="20" /> : null}
                <circle cx="20" cy="20" r="4" />
              </svg>
            </button>
          ))}
        </div>
        <div className="pipe-side">{Array.from({ length: p.h }, (_, y) => <span key={y}>{y === p.end ? '🚩' : ''}</span>)}</div>
      </div>
    </>
  );
}

function HackUI({ p, set }: { p: HackPuzzle; set: (p: Puzzle) => void }) {
  return (
    <>
      <div className="points">
        <small>
          추적 게이지 {Math.round(p.trace)}% · 남은 시간 {Math.max(0, Math.ceil((p.timeLimit - p.elapsed) / 1000))}초
        </small>
        <span className="bar">
          <span className="bar-fill danger" style={{ width: `${Math.min(100, p.trace)}%` }} />
        </span>
      </div>
      <div className="grid-board hack" style={{ gridTemplateColumns: `repeat(${p.w}, minmax(0, 1fr))` }}>
        {p.grid.map((g, i) => {
          const can = hackCanMove(p, i);
          return (
            <button key={i} className={`cell ${g === 1 ? 'wall' : ''} ${p.path.includes(i) ? 'trail' : ''} ${can ? 'can-move' : ''}`} onClick={() => set(moveHack(p, i))} disabled={!can}>
              {i === p.pos ? '🧑‍💻' : i === p.goal ? '💾' : g === 2 ? '👁️' : g === 1 ? '🧱' : can ? <small>+{stepCost(p, i)}</small> : ''}
            </button>
          );
        })}
      </div>
    </>
  );
}
