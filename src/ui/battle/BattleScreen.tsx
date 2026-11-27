// 전투 화면: 훈련·임무·작전(여러 판)·대전투·승급 심사·연습장. 틀에 맞는 화면을 열고, 끝나면 결과를 받음.
import { createContext, useContext, useState, type ReactNode } from 'react';
import { claimMission, finishTraining, perkBonus, readyAides } from '../../game/officer';
import { applyOccTask, type OccTask } from '../../game/annex';
import { settleClash } from '../../game/deploy';
import { loseUnits, ownedByBase } from '../../game/losses';
import { deployOf } from '../../game/deploy';
import { routeTo } from '../nav';
import { autoResult } from '../../battle/auto';
import { FRAME_NAMES, getPendingPlan, nextDifficulty, planForMission, planOutcome, setPendingPlan, type BattlePlan, type BattleSpec } from '../../battle/spec';
import { Card } from '../common';
import { settleCounter } from '../../game/counter';
import { Tile } from '../kit';
import { FRAME_ICON } from '../icons';
import { COUNTRIES, countryById } from '../../data/world';
import { relationOf } from '../../game/world';
import type { ScreenProps } from '../screens';
import { MiniView } from './MiniView';
import { Battle3DView } from './Battle3DView';
import { Drill3DView } from './Drill3DView';
import { unitBuffs, unitName, type DrillInfo } from '../../battle3d/train3d';

export interface Outcome {
  win: boolean;
  stars: number;
  text: string;
  /** 11-26 3D 훈련: 쓴 병과 · 퍼즐 별 · 주간 합동 */
  drill?: DrillInfo;
  /** 11-26 3D 전투에서 쓰러진 우리 부대(병과 이름별) → 가진 부대에서 실제로 빠짐 */
  dead?: Record<string, number>;
}

export interface FrameProps {
  spec: BattleSpec;
  stats: Record<string, number>;
  rank: number;
  aides: Array<{ name: string; specialty: string; level: number; bond?: number }>;
  playerName: string;
  onEnd: (r: Outcome) => void;
  /** 11-26 안 6: 병과 숙련 배수(3D 전투) · 배치 퍼즐 판별 별 */
  usBuff?: Partial<Record<string, number>>;
  puzzleStars?: Record<string, number>;
  /** 11-26 대장 "가진 부대만": 3D 전투에 낼 수 있는 부대(병과 이름별). 없으면 제한 없음(훈련·연습) */
  owned?: Record<string, number>;
  /** 11-26: 싸우기 전에 나가거나 화면 오류로 나가면 결과 없이 돌아감(패배 아님) */
  onCancel?: () => void;
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

// 11-26: 전투는 3D 전투만(훈련 미니게임 · 3D 훈련 · 3D 전투)
const VIEWS = { mini: MiniView, b3d: Battle3DView, d3: Drill3DView };
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
    return planForMission(a, rank, o.seed, foeId ? `${countryById(foeId).name}군` : undefined, state.world.defense[a.city]);
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
  // 11-26 가진 부대만 냄: 앞 판에서 쓰러진 만큼은 빼고(작전·대전투는 여러 판)
  const deadSoFar: Record<string, number> = {};
  for (const r of results) for (const [k, v] of Object.entries(r.dead ?? {})) deadSoFar[k] = (deadSoFar[k] ?? 0) + v;
  const ownSrc = plan.source === 'deploy' && plan.deploy ? deployOf(state).list.find((x) => x.id === plan.deploy!.dep)?.units ?? {} : plan.source === 'training' || plan.source === 'practice' ? null : state.economy.army;
  const owned = ownSrc ? ownedByBase(ownSrc, deadSoFar) : undefined;
  const props: FrameProps = { spec, stats, rank, owned, aides: readyAides(o, state.worldMs), playerName: state.player.name, onEnd: (r) => setCurrent({ ...r, auto: autoUsed }), usBuff: unitBuffs(o.unitXp), puzzleStars: o.puzzle3d, onCancel: () => leave() };
  const View = VIEWS[spec.frame];
  const multi = plan.stages.length > 1;
  const final = done ? planOutcome(plan, results) : null;
  const allAuto = results.length > 0 && results.every((r) => r.auto);

  const leave = () => {
    setPendingPlan(null);
    go(plan.source === 'mission' ? 'ops' : plan.source === 'occupy' || plan.source === 'counter' ? 'home' : plan.source === 'deploy' ? routeTo('diplo', 'diplo', 'deploy') : 'training');
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
    // 11-26 3D 전투에서 쓰러진 우리 부대(모든 판 합). 훈련·연습은 모의전이라 안 빠짐
    const dead: Record<string, number> = {};
    for (const r of results) for (const [k, v] of Object.entries(r.dead ?? {})) dead[k] = (dead[k] ?? 0) + v;
    const hasDead = results.some((r) => r.dead);
    const lose = (t: string | null | undefined) => {
      if (plan.source === 'training' || plan.source === 'practice' || plan.source === 'deploy') return t ?? '';
      const lt = actions.applyWith((s) => { const r = loseUnits(s, dead); return { state: r.state, out: r.text }; });
      return [t, lt].filter(Boolean).join(' · ');
    };
    if (plan.source === 'occupy' && plan.occupy) {
      const { city, task } = plan.occupy;
      const text = actions.applyWith((s) => {
        const r = applyOccTask(s, city, task as OccTask, final.win ? final.stars : 0);
        return { state: r.state, out: r.text };
      });
      setClaimed(`${lose(text)}${allAuto && final.win ? ' (자동은 별 최대 2개)' : ''}`);
    } else if (plan.source === 'counter' && plan.counter != null) {
      const id = plan.counter;
      const text = actions.applyWith((s) => {
        const r = settleCounter(s, id, final.win, allAuto ? Math.min(2, final.stars) : final.stars, '직접');
        return { state: r.state, out: r.text };
      });
      setClaimed(lose(text));
    } else if (plan.source === 'deploy' && plan.deploy) {
      const dep = plan.deploy.dep;
      const text = actions.applyWith((s) => {
        const r = settleClash(s, dep, final.win, allAuto ? Math.min(2, final.stars) : final.stars, '직접', hasDead ? dead : undefined);
        return { state: r.state, out: r.text };
      });
      setClaimed(`${text ?? ''}${allAuto && final.win ? ' (자동은 별 최대 2개)' : ''}`);
    } else if (plan.source === 'training') {
      const res = actions.applyWith((s) => {
        const r = finishTraining(s, { win: final.win, stars: final.stars, auto: allAuto, drill: results.find((x) => x.drill)?.drill });
        return { state: r.state, out: r.result };
      });
      if (res?.ok) {
        const gains = Object.entries(res.exp)
          .map(([k, v]) => `${k} 경험치 +${v}${res.gains[k as keyof typeof res.gains] ? ` (⬆️${state.officer.stats[k as keyof typeof state.officer.stats] + (res.gains[k as keyof typeof res.gains] ?? 0)})` : ''}`)
          .join(' · ');
        setClaimed(`${plan.training} 훈련 ${starText(res.stars)} · ${gains}${allAuto && final.win ? ' (자동은 별 최대 2개)' : ''}${res.perk ? ` · 특기 "${res.perk}"!` : ''}${res.weekly ? ' · 🎖️ 주간 합동 보상 ×3' : ''}${res.unitUp ? ` · 병과 숙련 ⬆️ ${res.unitUp.map(unitName).join('·')}` : ''}`);
      } else setClaimed(res && !res.ok ? res.why : '');
    } else {
      const text = actions.applyWith((s) => {
        const r = claimMission(s, final);
        return { state: r.state, out: r.text ?? '' };
      });
      setClaimed(lose(text));
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
                <button className="primary" onClick={() => go(plan.source === 'training' ? 'training' : plan.source === 'occupy' || plan.source === 'counter' ? 'home' : plan.source === 'deploy' ? routeTo('diplo', 'diplo', 'deploy') : 'ops')}>
                  {plan.source === 'training' ? '훈련 화면으로' : plan.source === 'occupy' || plan.source === 'counter' ? '본부로' : plan.source === 'deploy' ? '파병 화면으로' : '작전 화면으로'}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </AutoUsed.Provider>
  );
}
