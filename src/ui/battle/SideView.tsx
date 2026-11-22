// ② 옆보기 실시간 화면
import { useEffect, useRef, useState } from 'react';
import { UNIT_BASE, type UnitKind } from '../../battle/calc';
import {
  COMMAND_CD,
  COMMAND_TEXT,
  DEPLOY_COST,
  FIELD,
  command,
  createSideBattle,
  deploy,
  finishSide,
  sideGoalText,
  stepSide,
  SIDE_TICK_MS,
  type Command,
  type SideBattle,
  type SideGoal,
} from '../../battle/side';
import { BattleBar, type FrameProps } from './BattleScreen';

const ICON: Record<string, string> = { 트럭: '🚚', 진지: '🏰' };

export function SideView({ spec, stats, rank, onEnd }: FrameProps) {
  const [b, setB] = useState<SideBattle>(() =>
    createSideBattle({ goal: spec.variant as SideGoal, difficulty: spec.difficulty, rank, stats, seed: spec.seed }),
  );
  const [auto, setAuto] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [aiming, setAiming] = useState(false);
  const [started, setStarted] = useState(false);
  const ref = useRef(b);
  ref.current = b;
  const ended = useRef(false);
  const svg = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (b.result && !ended.current) {
      ended.current = true;
      onEnd(b.result);
    }
  }, [b.result, onEnd]);

  // 실시간 돌리기(명령 고를 때 멈춤). 남는 시간은 다음 틀로 넘김 → 자동전투 = 즉시완료 결과
  useEffect(() => {
    if (!started || aiming || b.result) return;
    let last = performance.now();
    let carry = 0;
    let raf = 0;
    const loop = (now: number) => {
      carry += Math.min(200, now - last) * speed;
      last = now;
      const ms = Math.floor(carry / SIDE_TICK_MS) * SIDE_TICK_MS;
      if (ms > 0) {
        carry -= ms;
        const nb = stepSide(ref.current, ms, auto);
        ref.current = nb;
        setB(nb);
        if (nb.result) return;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [started, aiming, auto, speed, b.result]);

  const pickX = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!aiming || !svg.current) return;
    const r = svg.current.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * FIELD;
    setB(command(ref.current, '포격', x));
    setAiming(false);
  };
  const cmd = (c: Command) => {
    if (c === '포격') setAiming(true);
    else setB(command(b, c));
  };
  const truck = b.units.find((u) => u.kind === '트럭');
  return (
    <>
      <BattleBar
        auto={auto}
        setAuto={setAuto}
        speed={speed}
        setSpeed={setSpeed}
        done={!!b.result}
        onInstant={() => setB(finishSide(ref.current))}
      />
      <div className="battle-info small">
        <span>
          {Math.floor(b.t / 1000)}초 / {b.timeLimit / 1000}초{truck ? ` · 트럭 ${Math.round((truck.x / FIELD) * 100)}%` : ''}
        </span>
        <span className="muted">{sideGoalText(b.goal)}</span>
      </div>
      <div className="side-field">
        <svg ref={svg} viewBox={`0 0 ${FIELD} 260`} onClick={pickX} className={aiming ? 'aiming' : ''}>
          <rect x="0" y="0" width={FIELD} height="200" fill="#16233a" />
          <rect x="0" y="200" width={FIELD} height="60" fill="#3a4a2a" />
          {b.blasts.map((x, i) => (
            <circle key={i} cx={x.x} cy={190} r={60} fill="#f97316" opacity={0.35} />
          ))}
          {b.units
            .filter((u) => u.hp > 0)
            .map((u) => {
              const y = 196 - u.lane * 22;
              const icon = ICON[u.kind] ?? UNIT_BASE[u.kind as UnitKind].icon;
              const big = u.kind === '트럭' || u.kind === '진지';
              return (
                <g key={u.id} transform={`translate(${u.x},${y})`}>
                  <text
                    fontSize={big ? 76 : 56}
                    textAnchor="middle"
                    transform={u.side === 'foe' ? 'scale(-1,1)' : undefined}
                    style={{ filter: u.side === 'foe' ? 'hue-rotate(140deg) saturate(2)' : undefined }}
                  >
                    {icon}
                  </text>
                  <rect x={-22} y={big ? -80 : -60} width={44} height={6} fill="#0008" />
                  <rect x={-22} y={big ? -80 : -60} width={(44 * u.hp) / u.maxHp} height={6} fill={u.side === 'me' ? '#4ade80' : '#f87171'} />
                </g>
              );
            })}
          {!started && (
            <text x={FIELD / 2} y={110} textAnchor="middle" fontSize="40" fill="#fff">
              시작을 누르세요
            </text>
          )}
          {aiming && (
            <text x={FIELD / 2} y={40} textAnchor="middle" fontSize="30" fill="#fde68a">
              포탄을 떨어뜨릴 곳을 누르세요
            </text>
          )}
        </svg>
      </div>
      {!started ? (
        <button className="primary wide" onClick={() => setStarted(true)}>
          ▶ 시작
        </button>
      ) : (
        <>
          <div className="points">
            <small>투입 점수 {Math.floor(b.points)} (통솔이 높으면 빨리 참)</small>
            <span className="bar">
              <span className="bar-fill" style={{ width: `${(b.points / 30) * 100}%` }} />
            </span>
          </div>
          <div className="buttons deploy">
            {(Object.keys(DEPLOY_COST) as UnitKind[]).map((k) => (
              <button key={k} disabled={b.points < DEPLOY_COST[k]! || !!b.result || auto} onClick={() => setB(deploy(b, k))}>
                {UNIT_BASE[k].icon} {k} {DEPLOY_COST[k]}
              </button>
            ))}
          </div>
          <div className="buttons">
            {(Object.keys(COMMAND_CD) as Command[]).map((c) => (
              <button key={c} title={COMMAND_TEXT[c]} disabled={b.cooldowns[c] > 0 || !!b.result || auto} onClick={() => cmd(c)} className={aiming && c === '포격' ? 'on' : ''}>
                {c === '포격' ? '💥' : c === '연막' ? '🌫️' : '⚡'} {c}
                {b.cooldowns[c] > 0 ? ` ${Math.ceil(b.cooldowns[c] / 1000)}초` : ''}
              </button>
            ))}
            {aiming && <button onClick={() => setAiming(false)}>취소</button>}
          </div>
        </>
      )}
      <ul className="battle-log small">
        {b.log.slice(0, 3).map((l, i) => (
          <li key={i}>{l}</li>
        ))}
      </ul>
    </>
  );
}
