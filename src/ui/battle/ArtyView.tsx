// ③ 포물선 대결 화면
import { useEffect, useRef, useState } from 'react';
import { ARTY_H, ARTY_W, aiFire, createArty, finishArty, fire, heightAt, trajectory, type ArtyBattle } from '../../battle/arty';
import { BattleBar, type FrameProps } from './BattleScreen';

const Y = (y: number) => ARTY_H - y;

export function ArtyView({ spec, stats, rank, onEnd }: FrameProps) {
  const [b, setB] = useState<ArtyBattle>(() => createArty({ difficulty: spec.difficulty, rank, stats, seed: spec.seed }));
  const [angle, setAngle] = useState(45);
  const [power, setPower] = useState(60);
  const [auto, setAuto] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [flying, setFlying] = useState<{ path: Array<[number, number]>; n: number; next: ArtyBattle } | null>(null);
  const ended = useRef(false);

  useEffect(() => {
    if (b.result && !ended.current) {
      ended.current = true;
      onEnd(b.result);
    }
  }, [b.result, onEnd]);

  // 포탄 날아가는 모습
  useEffect(() => {
    if (!flying) return;
    if (flying.n >= flying.path.length) {
      setB(flying.next);
      setFlying(null);
      return;
    }
    const t = setTimeout(() => setFlying({ ...flying, n: flying.n + Math.ceil(6 * speed) }), 16);
    return () => clearTimeout(t);
  }, [flying, speed]);

  const shoot = (next: ArtyBattle) => setFlying({ path: next.last?.path ?? [], n: 0, next });
  // 적 차례, 또는 자동전투일 때 내 차례
  useEffect(() => {
    if (flying || b.result) return;
    if (b.turn === 'foe' || auto) {
      const t = setTimeout(() => shoot(aiFire(b)), 500 / speed);
      return () => clearTimeout(t);
    }
  }, [b, auto, flying, speed]);

  const guide = b.turn === 'me' && !flying ? trajectory(b, 'me', angle, power).path : [];
  const shown = guide.slice(0, Math.max(4, Math.floor(guide.length * b.guide)));
  const ground = b.ground.map((h, i) => `${i * 5},${Y(h)}`).join(' ');
  const gun = (x: number) => Y(heightAt(b, x) + 8);
  const myTurn = b.turn === 'me' && !flying && !b.result && !auto;
  return (
    <>
      <BattleBar auto={auto} setAuto={setAuto} speed={speed} setSpeed={setSpeed} done={!!b.result} onInstant={() => (setFlying(null), setB(finishArty(b)))} />
      <div className="battle-info small">
        <span>
          {Math.min(b.round, 8)}번째 / 8 · {b.turn === 'me' ? '내 차례' : '적 차례'} · 바람 {b.wind === 0 ? '없음' : `${b.wind > 0 ? '→' : '←'} ${Math.abs(b.wind)}`}
        </span>
        <span className="muted">각도와 힘을 맞춰 적 포를 맞히세요. 포격 스탯이 높으면 안내선이 길어요.</span>
      </div>
      <div className="side-field">
        <svg viewBox={`0 0 ${ARTY_W} ${ARTY_H}`}>
          <rect x="0" y="0" width={ARTY_W} height={ARTY_H} fill="#16233a" />
          <polygon points={`0,${ARTY_H} ${ground} ${ARTY_W},${ARTY_H}`} fill="#4b5a2e" />
          {shown.map(([x, y], i) => (i % 3 === 0 ? <circle key={i} cx={x} cy={Y(y)} r={1.8} fill="#fde68a" /> : null))}
          {flying && flying.path.slice(0, flying.n).map(([x, y], i) => (i % 2 === 0 ? <circle key={i} cx={x} cy={Y(y)} r={1.5} fill="#f97316" /> : null))}
          {flying && flying.n > 0 && flying.path[Math.min(flying.n, flying.path.length - 1)] && (
            <circle cx={flying.path[Math.min(flying.n, flying.path.length - 1)][0]} cy={Y(flying.path[Math.min(flying.n, flying.path.length - 1)][1])} r={4} fill="#fff" />
          )}
          {!flying && b.last?.impact && <circle cx={b.last.impact.x} cy={Y(b.last.impact.y)} r={18} fill="#f97316" opacity={0.3} />}
          {[
            { g: b.me, c: '#60a5fa' },
            { g: b.foe, c: '#f87171' },
          ].map(({ g, c }, i) => (
            <g key={i}>
              <rect x={g.x - 9} y={gun(g.x)} width={18} height={9} rx={2} fill={c} />
              <rect x={g.x - 14} y={gun(g.x) - 14} width={28} height={4} fill="#0008" />
              <rect x={g.x - 14} y={gun(g.x) - 14} width={(28 * g.hp) / g.maxHp} height={4} fill={c} />
            </g>
          ))}
        </svg>
      </div>
      <div className="arty-ctrl">
        <label>
          각도 {angle}°
          <input type="range" min={5} max={85} value={angle} disabled={!myTurn} onChange={(e) => setAngle(Number(e.target.value))} />
        </label>
        <label>
          힘 {power}
          <input type="range" min={10} max={100} value={power} disabled={!myTurn} onChange={(e) => setPower(Number(e.target.value))} />
        </label>
        <button className="primary" disabled={!myTurn} onClick={() => shoot(fire(b, angle, power))}>
          💥 발사
        </button>
      </div>
      <p className="small">
        우리 포 {b.me.hp}/{b.me.maxHp} · 적 포 {b.foe.hp}/{b.foe.maxHp}
      </p>
      <ul className="battle-log small">
        {b.log.slice(0, 3).map((l, i) => (
          <li key={i}>{l}</li>
        ))}
      </ul>
    </>
  );
}
