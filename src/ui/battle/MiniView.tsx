// 훈련 미니게임 화면(11-25): 안내 → 제한 시간 동안 놀이 → 점수 → 별 1~3. 게임 36개는 ./mini/*
import { useEffect, useRef, useState } from 'react';
import { STAR_AT, autoMini, miniById, miniLevel, miniOutcome, MINIGAMES } from '../../battle/minigames';
import { BattleBar, type FrameProps } from './BattleScreen';
import { MINI_VIEWS } from './mini';

export function MiniView({ spec, stats, rank, onEnd }: FrameProps) {
  const def = miniById(spec.variant) ?? MINIGAMES[0];
  const Game = MINI_VIEWS[def.id];
  const [phase, setPhase] = useState<'intro' | 'play' | 'done'>('intro');
  const [left, setLeft] = useState(def.secs);
  const [shown, setShown] = useState(0);
  const score = useRef(0);
  const ended = useRef(false);
  const end = (s: number) => {
    if (ended.current) return;
    ended.current = true;
    setPhase('done');
    onEnd(miniOutcome(s, def.name));
  };
  useEffect(() => {
    if (phase !== 'play') return;
    const t0 = performance.now();
    const t = setInterval(() => {
      const l = Math.max(0, def.secs - (performance.now() - t0) / 1000);
      setLeft(l);
      setShown(score.current);
      if (l <= 0) end(score.current);
    }, 200);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const instant = () => {
    if (ended.current) return;
    ended.current = true;
    setPhase('done');
    onEnd(autoMini(def.id, stats, rank, spec.seed));
  };
  const pct = Math.round(shown * 100);
  const star = shown >= STAR_AT[2] ? 3 : shown >= STAR_AT[1] ? 2 : shown >= STAR_AT[0] ? 1 : 0;
  return (
    <>
      <BattleBar auto={false} setAuto={instant} done={phase === 'done'} onInstant={instant} extra={<span className="small muted">자동 = 즉시완료(별 최대 2)</span>} />
      {phase === 'intro' && (
        <div className="mg-intro">
          <b>🎮 {def.name}</b>
          <p className="small">{def.how}</p>
          <p className="small muted">
            제한 {def.secs}초 · {Math.round(STAR_AT[0] * 100)}점 성공 · {Math.round(STAR_AT[1] * 100)}점 ★★ · {Math.round(STAR_AT[2] * 100)}점 ★★★
          </p>
          <button className="primary wide" onClick={() => setPhase('play')}>
            ▶ 시작
          </button>
        </div>
      )}
      {phase !== 'intro' && (
        <div className="mg-top">
          <div className="mg-time">
            <i style={{ width: `${(left / def.secs) * 100}%` }} className={left < 10 ? 'low' : ''} />
          </div>
          <small>
            ⏱ {Math.ceil(left)}초 · {pct}점 <span className="stars">{'★'.repeat(star) + '☆'.repeat(3 - star)}</span>
          </small>
          {phase === 'play' && (
            <button className="link" onClick={() => end(score.current)}>
              여기서 끝내기
            </button>
          )}
        </div>
      )}
      {phase === 'play' && Game && <Game level={miniLevel(rank)} seed={spec.seed} report={(s) => (score.current = Math.max(0, Math.min(1, s)))} finish={(s) => end(Math.max(0, Math.min(1, s)))} />}
    </>
  );
}

