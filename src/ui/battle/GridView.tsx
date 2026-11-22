// ① 격자 턴제 화면
import { useEffect, useRef, useState } from 'react';
import { TERRAIN, UNIT_BASE } from '../../battle/calc';
import {
  attack,
  autoMyTurn,
  canHeal,
  canSee,
  createGridBattle,
  endTurn,
  finishGrid,
  goalText,
  heal,
  hide,
  moveUnit,
  reachable,
  targetsFrom,
  tileIdx,
  visibleTiles,
  wait,
  type Goal,
  type GridBattle,
} from '../../battle/grid';
import { BattleBar, type FrameProps } from './BattleScreen';

export function GridView({ spec, stats, rank, aides, playerName, onEnd }: FrameProps) {
  const [b, setB] = useState<GridBattle>(() =>
    createGridBattle({ goal: spec.variant as Goal, difficulty: spec.difficulty, rank, stats, aides, seed: spec.seed, playerName }),
  );
  const [sel, setSel] = useState<number | null>(null);
  const [auto, setAuto] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [busy, setBusy] = useState(false);
  const speedRef = useRef(speed);
  speedRef.current = speed;
  const ended = useRef(false);

  useEffect(() => {
    if (b.result && !ended.current) {
      ended.current = true;
      onEnd(b.result);
    }
  }, [b.result, onEnd]);

  // 장면 목록을 차례로 보여 줌
  const play = (frames: GridBattle[], then?: (last: GridBattle) => void) => {
    if (!frames.length) {
      then?.(b);
      return;
    }
    setBusy(true);
    let i = 0;
    const next = () => {
      setB(frames[i]);
      i++;
      if (i < frames.length && !frames[i - 1].result) setTimeout(next, 320 / speedRef.current);
      else {
        setBusy(false);
        then?.(frames[i - 1]);
      }
    };
    next();
  };
  const doEnd = (from: GridBattle) => {
    setSel(null);
    play(endTurn(from));
  };
  // 자동전투: 내 차례가 오면 대신 둠
  useEffect(() => {
    if (!auto || busy || b.result || b.side !== 'me') return;
    const t = setTimeout(() => play(autoMyTurn(b), (last) => !last.result && doEnd(last)), 200 / speed);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto, busy, b]);

  const vis = visibleTiles(b, 'me');
  const selU = sel !== null ? b.units.find((u) => u.id === sel && u.hp > 0) : undefined;
  const reach = selU && !selU.moved && !selU.acted ? reachable(b, selU) : new Map<number, number>();
  const tg = selU && !selU.acted ? targetsFrom(b, selU) : [];
  const myTurn = b.side === 'me' && !busy && !b.result && !auto;

  const tap = (x: number, y: number) => {
    if (!myTurn) return;
    const u = b.units.find((v) => v.hp > 0 && v.x === x && v.y === y);
    if (u && u.side === 'me' && !u.captive && u.kind !== '인질' && !(u.moved && u.acted)) {
      setSel(u.id);
      return;
    }
    if (!selU) return;
    if (u && tg.some((t) => t.id === u.id)) {
      setB(attack(b, selU.id, u.id));
      setSel(null);
      return;
    }
    if (reach.has(tileIdx(b, x, y))) {
      const nb = moveUnit(b, selU.id, x, y);
      setB(nb);
      const after = nb.units.find((v) => v.id === selU.id)!;
      if (!targetsFrom(nb, after).length && !canHeal(nb, after) && !['숲', '건물'].includes(nb.tiles[tileIdx(nb, x, y)])) {
        setB(wait(nb, selU.id));
        setSel(null);
      }
    }
  };

  const mine = b.units.filter((u) => u.side === 'me' && u.hp > 0 && !u.captive && u.kind !== '인질');
  const left = mine.filter((u) => !(u.moved && u.acted)).length;
  return (
    <>
      <BattleBar
        auto={auto}
        setAuto={setAuto}
        speed={speed}
        setSpeed={setSpeed}
        done={!!b.result}
        onInstant={() => {
          setSel(null);
          setB(finishGrid(b));
        }}
      />
      <div className="battle-info small">
        <span>
          턴 {Math.min(b.turn, b.maxTurns)} / {b.maxTurns} · {b.side === 'me' ? '내 차례' : '적 차례'}
          {b.alarm ? ' · 🚨 경계' : ' · 🤫 들키지 않음'}
        </span>
        <span className="muted">{goalText(b.goal)}</span>
      </div>
      <div className="grid-board" style={{ gridTemplateColumns: `repeat(${b.w}, 1fr)` }}>
        {b.tiles.map((t, i) => {
          const x = i % b.w;
          const y = Math.floor(i / b.w);
          const u = b.units.find((v) => v.hp > 0 && v.x === x && v.y === y);
          const seen = vis.has(i);
          const showU = u && (u.side === 'me' || canSee(b, 'me', u));
          const cls = [
            'cell',
            `t-${t}`,
            seen ? '' : 'fog',
            reach.has(i) && !u ? 'can-move' : '',
            u && tg.some((g) => g.id === u.id) ? 'can-hit' : '',
            u && u.id === sel ? 'sel' : '',
          ]
            .join(' ')
            .trim();
          return (
            <button key={i} className={cls} onClick={() => tap(x, y)} aria-label={`${x},${y}`}>
              <span className="terrain">{TERRAIN[t].icon}</span>
              {b.mark && b.mark.x === x && b.mark.y === y && <span className="mark">{b.goal === 'survive' ? '🚩' : '⭐'}</span>}
              {showU && u && (
                <span className={`unit ${u.side} ${u.hidden ? 'hidden' : ''} ${u.moved && u.acted && u.side === 'me' ? 'done' : ''}`}>
                  <span className="ico">{UNIT_BASE[u.kind].icon}</span>
                  {u.kind !== '인질' && (
                    <span className="hp">
                      <span style={{ width: `${(u.hp / u.maxHp) * 100}%` }} />
                    </span>
                  )}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <div className="battle-actions">
        {selU ? (
          <>
            <small>
              <b>{selU.name}</b> {selU.kind} · 체력 {selU.hp}/{selU.maxHp} · 사거리 {selU.range} · 사기 {Math.round(selU.morale)}
            </small>
            <div className="buttons">
              {!selU.acted && ['숲', '건물'].includes(b.tiles[tileIdx(b, selU.x, selU.y)]) && (
                <button onClick={() => (setB(hide(b, selU.id)), setSel(null))}>🌿 숨기</button>
              )}
              {canHeal(b, selU) && <button onClick={() => (setB(heal(b, selU.id)), setSel(null))}>⛑️ 치료</button>}
              <button onClick={() => (setB(wait(b, selU.id)), setSel(null))}>대기</button>
            </div>
          </>
        ) : (
          <small className="muted">
            {myTurn ? `우리 부대를 눌러 고르고, 파란 칸으로 움직이거나 빨간 테두리 적을 쏘세요. 남은 부대 ${left}` : auto ? '자동전투 중…' : '…'}
          </small>
        )}
        <button className="primary" disabled={!myTurn} onClick={() => doEnd(b)}>
          턴 끝
        </button>
      </div>
      <ul className="battle-log small">
        {b.log.slice(0, 4).map((l, i) => (
          <li key={i}>{l}</li>
        ))}
      </ul>
    </>
  );
}
