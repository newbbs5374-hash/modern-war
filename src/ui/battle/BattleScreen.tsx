// 전투 화면: 임무·진급 심사·연습장에서 들어옴. 틀에 맞는 화면을 열고, 끝나면 결과를 받음.
import { useState, type ReactNode } from 'react';
import { claimMission } from '../../game/officer';
import { FRAME_NAMES, getPractice, setPractice, specForMission, type BattleSpec } from '../../battle/spec';
import { Card } from '../common';
import type { ScreenProps } from '../screens';
import { GridView } from './GridView';
import { SideView } from './SideView';
import { ArtyView } from './ArtyView';
import { ShooterView } from './ShooterView';
import { PuzzleView } from './PuzzleView';

export interface Outcome {
  win: boolean;
  stars: number;
  text: string;
}

export interface FrameProps {
  spec: BattleSpec;
  stats: Record<string, number>;
  rank: number;
  aides: Array<{ name: string; specialty: string; level: number }>;
  playerName: string;
  onEnd: (r: Outcome) => void;
}

/** 모든 전투 공통 버튼: 자동전투 · 0.5/1/2배속 · 즉시완료 */
export function BattleBar(props: {
  auto: boolean;
  setAuto: (v: boolean) => void;
  speed?: number;
  setSpeed?: (v: number) => void;
  onInstant: () => void;
  extra?: ReactNode;
  done: boolean;
}) {
  return (
    <div className="battle-bar">
      <button className={props.auto ? 'on' : ''} disabled={props.done} onClick={() => props.setAuto(!props.auto)}>
        🤖 자동{props.auto ? ' 켜짐' : ''}
      </button>
      {props.setSpeed && (
        <span className="seg">
          {[0.5, 1, 2].map((x) => (
            <button key={x} className={props.speed === x ? 'on' : ''} onClick={() => props.setSpeed!(x)}>
              ×{x}
            </button>
          ))}
        </span>
      )}
      <button disabled={props.done} onClick={props.onInstant}>
        ⏩ 즉시완료
      </button>
      {props.extra}
    </div>
  );
}

export function BattleScreen({ state, actions, go }: ScreenProps) {
  const o = state.officer;
  const a = o.active;
  const [practice] = useState(getPractice);
  // 처음 연 순간의 전투를 그대로 씀(결과를 받은 뒤에도 화면이 남도록)
  const [spec] = useState<BattleSpec | null>(() =>
    practice ?? (a && state.worldMs >= a.endMs ? specForMission(a, state.player.rankIndex, o.seed) : null),
  );
  const [result, setResult] = useState<Outcome | null>(null);
  const [claimed, setClaimed] = useState<string | null>(null);
  const [round, setRound] = useState(0);

  if (!spec) {
    return (
      <Card title="전투">
        <p className="small muted">지금 싸울 전투가 없어요. 작전 화면에서 임무를 고르거나, 훈련 화면의 연습장을 써 보세요.</p>
        <button onClick={() => go('ops')}>작전 화면으로</button>
      </Card>
    );
  }
  const leave = () => {
    setPractice(null);
    go(practice ? 'training' : 'ops');
  };
  const claim = () => {
    if (!result) return;
    const text = actions.applyWith((s) => {
      const r = claimMission(s, { win: result.win, stars: result.stars });
      return { state: r.state, out: r.text ?? '' };
    });
    setClaimed(text ?? '');
  };
  const props: FrameProps = {
    spec: { ...spec, seed: spec.seed + round * 101 },
    stats: o.stats,
    rank: state.player.rankIndex,
    aides: o.aides,
    playerName: state.player.name,
    onEnd: setResult,
  };
  const View = { grid: GridView, side: SideView, arty: ArtyView, shooter: ShooterView, puzzle: PuzzleView }[spec.frame];
  return (
    <div className="battle">
      <div className="battle-head">
        <b>{spec.title}</b>
        <small className="muted">
          {FRAME_NAMES[spec.frame]}
          {spec.practice ? ' · 연습(보상 없음)' : ''}
        </small>
        {!result && (
          <button className="link" onClick={leave}>
            나가기
          </button>
        )}
      </div>
      <View key={round} {...props} />
      {result && (
        <div className={`battle-result ${result.win ? 'win' : 'lose'}`}>
          <b>
            {result.win ? '승리' : '패배'} {result.win ? '★'.repeat(result.stars) + '☆'.repeat(3 - result.stars) : ''}
          </b>
          <p className="small">{result.text}</p>
          {claimed !== null && <p className="small result">{claimed}</p>}
          <div className="buttons">
            {spec.practice ? (
              <>
                <button
                  className="primary"
                  onClick={() => {
                    setResult(null);
                    setRound((r) => r + 1);
                  }}
                >
                  다시 하기
                </button>
                <button onClick={leave}>연습장으로</button>
              </>
            ) : claimed === null ? (
              <button className="primary" onClick={claim}>
                결과 받기
              </button>
            ) : (
              <button className="primary" onClick={() => go('ops')}>
                작전 화면으로
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
