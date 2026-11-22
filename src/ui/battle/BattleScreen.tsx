// 전투 화면: 훈련·임무·작전(여러 판)·대전투·진급 심사·연습장. 틀에 맞는 화면을 열고, 끝나면 결과를 받음.
import { createContext, useContext, useState, type ReactNode } from 'react';
import { claimMission, finishTraining, perkBonus } from '../../game/officer';
import { autoResult } from '../../battle/auto';
import { FRAME_NAMES, getPendingPlan, nextDifficulty, planForMission, planOutcome, setPendingPlan, type BattlePlan, type BattleSpec } from '../../battle/spec';
import { Card } from '../common';
import type { ScreenProps } from '../screens';
import { GridView } from './GridView';
import { SideView } from './SideView';
import { ArtyView } from './ArtyView';
import { ShooterView } from './ShooterView';
import { PuzzleView } from './PuzzleView';
import { CourseView } from './CourseView';
import { RangeView } from './RangeView';

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

/** 자동전투·즉시완료를 썼는지(훈련은 별 최대 2개) */
const AutoUsed = createContext<() => void>(() => {});

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
  const mark = useContext(AutoUsed);
  return (
    <div className="battle-bar">
      <button
        className={props.auto ? 'on' : ''}
        disabled={props.done}
        onClick={() => {
          if (!props.auto) mark();
          props.setAuto(!props.auto);
        }}
      >
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
      <button
        disabled={props.done}
        onClick={() => {
          mark();
          props.onInstant();
        }}
      >
        ⏩ 즉시완료
      </button>
      {props.extra}
    </div>
  );
}

const VIEWS = { grid: GridView, side: SideView, arty: ArtyView, shooter: ShooterView, puzzle: PuzzleView, course: CourseView, range: RangeView };
const starText = (n: number) => '★'.repeat(n) + '☆'.repeat(3 - n);

export function BattleScreen({ state, actions, go }: ScreenProps) {
  const o = state.officer;
  const rank = state.player.rankIndex;
  // 처음 연 순간의 전투 묶음을 그대로 씀(결과를 받은 뒤에도 화면이 남도록)
  const [plan] = useState<BattlePlan | null>(() => {
    const pending = getPendingPlan();
    if (pending && (pending.source !== 'training' || o.training)) return pending;
    const a = o.active;
    return a && state.worldMs >= a.endMs ? planForMission(a, rank, o.seed) : null;
  });
  const [results, setResults] = useState<Array<Outcome & { auto: boolean }>>([]);
  const [current, setCurrent] = useState<(Outcome & { auto: boolean }) | null>(null);
  const [autoUsed, setAutoUsed] = useState(false);
  const [claimed, setClaimed] = useState<string | null>(null);
  const [round, setRound] = useState(0);

  if (!plan) {
    return (
      <Card title="전투">
        <p className="small muted">지금 싸울 전투가 없어요. 작전 화면에서 임무를 고르거나, 훈련 화면에서 훈련을 시작하세요.</p>
        <button onClick={() => go('ops')}>작전 화면으로</button>
      </Card>
    );
  }
  const stageIdx = results.length;
  const done = stageIdx >= plan.stages.length;
  const base = plan.stages[Math.min(stageIdx, plan.stages.length - 1)];
  const spec: BattleSpec = { ...base, difficulty: nextDifficulty(base.difficulty, results), seed: base.seed + round * 101 };
  // 특기는 전투 스탯에 더함
  const perks = perkBonus(o);
  const stats: Record<string, number> = { ...o.stats };
  for (const [k, v] of Object.entries(perks)) stats[k] = (stats[k] ?? 0) + v;
  const props: FrameProps = { spec, stats, rank, aides: o.aides, playerName: state.player.name, onEnd: (r) => setCurrent({ ...r, auto: autoUsed }) };
  const View = VIEWS[spec.frame];
  const multi = plan.stages.length > 1;
  const final = done ? planOutcome(plan, results) : null;
  const allAuto = results.length > 0 && results.every((r) => r.auto);

  const leave = () => {
    setPendingPlan(null);
    go(plan.source === 'mission' ? 'ops' : 'training');
  };
  const nextStage = () => {
    if (!current) return;
    setResults([...results, current]);
    setCurrent(null);
    setAutoUsed(false);
  };
  const delegate = () => {
    const r = autoResult({ spec, stats, rank, aides: o.aides });
    const who = o.generals[0]?.name ?? o.aides[0]?.name ?? '부대장';
    setCurrent({ ...r, stars: Math.min(2, r.stars), text: `${who}에게 맡겼어요. ${r.text}`, auto: true });
  };
  const claim = () => {
    if (!final) return;
    if (plan.source === 'training') {
      const res = actions.applyWith((s) => {
        const r = finishTraining(s, { win: final.win, stars: final.stars, auto: allAuto });
        return { state: r.state, out: r.result };
      });
      if (res?.ok) {
        const gains = Object.entries(res.gains)
          .map(([k, v]) => `${k} +${v}`)
          .join(' · ');
        setClaimed(`${plan.training} 훈련 ${starText(res.stars)} · ${gains}${allAuto && final.win ? ' (자동은 별 최대 2개)' : ''}${res.perk ? ` · 특기 "${res.perk}"!` : ''}`);
      } else setClaimed(res && !res.ok ? res.why : '');
    } else {
      const text = actions.applyWith((s) => {
        const r = claimMission(s, final);
        return { state: r.state, out: r.text ?? '' };
      });
      setClaimed(text ?? '');
    }
    setPendingPlan(null);
  };

  return (
    <AutoUsed.Provider value={() => setAutoUsed(true)}>
      <div className="battle">
        <div className="battle-head">
          <b>{plan.title}</b>
          <small className="muted">
            {multi ? `${Math.min(stageIdx + 1, plan.stages.length)} / ${plan.stages.length}판 · ` : ''}
            {FRAME_NAMES[spec.frame]}
            {plan.source === 'practice' ? ' · 연습(보상 없음)' : ''}
          </small>
          {!done && !current && (
            <button className="link" onClick={leave}>
              나가기
            </button>
          )}
        </div>
        {multi && (
          <ol className="stages small">
            {plan.stages.map((st, i) => (
              <li key={i} className={i < stageIdx ? (results[i].win ? 'won' : 'lost') : i === stageIdx ? 'now' : ''}>
                {st.label}
                {i === plan.mainIdx ? ' ⚑' : ''} {i < stageIdx ? (results[i].win ? starText(results[i].stars) : '패배') : ''}
              </li>
            ))}
          </ol>
        )}
        {plan.intro && stageIdx === 0 && !current && <p className="small muted">{plan.intro}</p>}
        {!done && !current && multi && (
          <div className="buttons">
            <small className="muted">
              {spec.label} · 난이도 {spec.difficulty.toFixed(2)}
            </small>
            <button onClick={delegate}>🧑‍✈️ 부관에게 맡기기(별 최대 2)</button>
          </div>
        )}
        {!done && !current && <View key={`${stageIdx}-${round}`} {...props} />}
        {current && (
          <div className={`battle-result ${current.win ? 'win' : 'lose'}`}>
            <b>
              {multi ? `${spec.label}: ` : ''}
              {current.win ? '승리' : '패배'} {current.win ? starText(current.stars) : ''}
            </b>
            <p className="small">{current.text}</p>
            <div className="buttons">
              {plan.source === 'practice' ? (
                <>
                  <button
                    className="primary"
                    onClick={() => {
                      setCurrent(null);
                      setRound((r) => r + 1);
                    }}
                  >
                    다시 하기
                  </button>
                  <button onClick={leave}>훈련 화면으로</button>
                </>
              ) : (
                <button className="primary" onClick={nextStage}>
                  {stageIdx + 1 < plan.stages.length ? '다음 판으로' : '결과 정리'}
                </button>
              )}
            </div>
          </div>
        )}
        {done && final && (
          <div className={`battle-result ${final.win ? 'win' : 'lose'}`}>
            <b>
              {multi ? '전체 결과: ' : ''}
              {final.win ? '승리' : '패배'} {final.win ? starText(final.stars) : ''}
            </b>
            {multi && <p className="small muted">꼭 이길 판 ⚑ 승리 + 절반 넘게 이기면 성공</p>}
            {claimed !== null && <p className="small result">{claimed}</p>}
            <div className="buttons">
              {claimed === null ? (
                <button className="primary" onClick={claim}>
                  결과 받기
                </button>
              ) : (
                <button className="primary" onClick={() => go(plan.source === 'training' ? 'training' : 'ops')}>
                  {plan.source === 'training' ? '훈련 화면으로' : '작전 화면으로'}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </AutoUsed.Provider>
  );
}
