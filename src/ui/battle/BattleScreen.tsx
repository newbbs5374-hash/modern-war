// 전투 화면: 훈련·임무·작전(여러 판)·대전투·승급 심사·연습장. 틀에 맞는 화면을 열고, 끝나면 결과를 받음.
import { fieldRoster } from '../../game/economy';
import { createContext, useContext, useState, type ReactNode } from 'react';
import { claimMission, finishTraining, perkBonus, readyAides } from '../../game/officer';
import { autoResult } from '../../battle/auto';
import { FRAME_NAMES, getPendingPlan, nextDifficulty, planForMission, planOutcome, setPendingPlan, type BattlePlan, type BattleSpec } from '../../battle/spec';
import { Card } from '../common';
import { Tile } from '../kit';
import { FRAME_ICON } from '../icons';
import { COUNTRIES, countryById } from '../../data/world';
import { relationOf } from '../../game/world';
import { WEATHER_ICON, WEATHER_TEXT } from '../../battle/grid';
import type { ScreenProps } from '../screens';
import { GridView } from './GridView';
import { SideView } from './SideView';
import { ArtyView } from './ArtyView';
import { ShooterView } from './ShooterView';
import { PuzzleView } from './PuzzleView';
import { CourseView } from './CourseView';
import { RangeView } from './RangeView';
import { FieldView } from './FieldView';
import { MiniView } from './MiniView';
import { Battle3DView } from './Battle3DView';

export interface Outcome {
  win: boolean;
  stars: number;
  text: string;
}

export interface FrameProps {
  spec: BattleSpec;
  stats: Record<string, number>;
  rank: number;
  aides: Array<{ name: string; specialty: string; level: number; bond?: number }>;
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

const VIEWS = { grid: GridView, side: SideView, arty: ArtyView, shooter: ShooterView, puzzle: PuzzleView, course: CourseView, range: RangeView, field: FieldView, mini: MiniView, b3d: Battle3DView };
const starText = (n: number) => '★'.repeat(n) + '☆'.repeat(3 - n);

export function BattleScreen({ state, actions, go }: ScreenProps) {
  const o = state.officer;
  const rank = state.player.rankIndex;
  // 처음 연 순간의 전투 묶음을 그대로 씀(결과를 받은 뒤에도 화면이 남도록)
  const [plan] = useState<BattlePlan | null>(() => {
    const pending = getPendingPlan();
    if (pending && (pending.source !== 'training' || o.training)) return pending;
    const a = o.active;
    if (!a || state.worldMs < a.endMs) return null;
    // 적 이름: 도시 주인이 남이면 그 나라, 내 도시면 전쟁 중인 나라
    const me = state.player.countryId;
    const owner = state.world.owner[a.city];
    const foeId = owner !== me ? owner : COUNTRIES.find((c) => c.id !== me && relationOf(state.world, me, c.id) === '전쟁')?.id;
    const p = planForMission(a, rank, o.seed, foeId ? `${countryById(foeId).name}군` : undefined, state.world.defense[a.city]);
    // 지도 위 전투: 우리 특화 유닛·독점 병과, 적 나라 특화 유닛, 출발 연료·탄약
    const army = { roster: fieldRoster(state), enemyId: foeId, fuel: a.fuel, ammo: a.ammo };
    return { ...p, stages: p.stages.map((st) => (st.frame === 'field' ? { ...st, army } : st)) };
  });
  const [results, setResults] = useState<Array<Outcome & { auto: boolean }>>([]);
  const [current, setCurrent] = useState<(Outcome & { auto: boolean }) | null>(null);
  const [autoUsed, setAutoUsed] = useState(false);
  const [claimed, setClaimed] = useState<string | null>(null);
  const [round, setRound] = useState(0);

  if (!plan) {
    return (
      <Card title="전투">
        <p className="small muted">지금 싸울 전투가 없어요. 국방 → 작전에서 임무를 고르거나, 국방 → 훈련에서 훈련을 시작하세요.</p>
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
  const props: FrameProps = { spec, stats, rank, aides: readyAides(o, state.worldMs), playerName: state.player.name, onEnd: (r) => setCurrent({ ...r, auto: autoUsed }) };
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
    const r = autoResult({ spec, stats, rank, aides: readyAides(o, state.worldMs) });
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
        const gains = Object.entries(res.exp)
          .map(([k, v]) => `${k} 경험치 +${v}${res.gains[k as keyof typeof res.gains] ? ` (⬆️${state.officer.stats[k as keyof typeof state.officer.stats] + (res.gains[k as keyof typeof res.gains] ?? 0)})` : ''}`)
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
            {spec.weather && spec.weather !== '맑음' ? ` · ${WEATHER_ICON[spec.weather]} ${spec.weather}(${WEATHER_TEXT[spec.weather]})` : ''}
            {spec.enemy ? ` · 상대 ${spec.enemy}` : ''}
          </small>
          {!done && !current && (
            <button className="link" onClick={leave}>
              나가기
            </button>
          )}
        </div>
        {multi && (
          <div className={`tiles c${Math.min(5, plan.stages.length)}`}>
            {plan.stages.map((st, i) => (
              <Tile
                key={i}
                icon={i < stageIdx ? (results[i].win ? '✅' : '❌') : FRAME_ICON[st.frame]}
                label={`${i + 1}${i === plan.mainIdx ? ' ⚑' : ''}`}
                sub={st.label}
                tone={i === stageIdx ? 'gold' : i < stageIdx ? (results[i].win ? 'green' : 'red') : undefined}
              >
                {i < stageIdx && results[i].win && <small className="stars">{starText(results[i].stars)}</small>}
              </Tile>
            ))}
          </div>
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
              {current.win ? '🏅 승리' : '💀 패배'}
            </b>
            {current.win && <div className="big-stars">{starText(current.stars)}</div>}
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
              {final.win ? '🏆 승리' : '💀 패배'}
            </b>
            {final.win && <div className="big-stars">{starText(final.stars)}</div>}
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
