// 함대 충돌 관전 화면: fleet.ts가 미리 계산한 장면을 시간대로 그림(배속 0.5·1·2, 결과 바로 보기).
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { countryById } from '../data/world';
import { FLEET_DURATION, SHIP_NAME, finishFleet, planFleet, type FleetPlan, type Ship, type ShipKind } from '../game/fleet';
import type { GameState } from '../game/state';
import { fieldArt } from './fieldArt';
import { FLAG } from './flag';

const ART: Record<ShipKind, string | null> = {
  carrier: fieldArt('unit-carrier'),
  cruiser: fieldArt('unit-cruiser'),
  destroyer: fieldArt('unit-destroyer'),
  sub: fieldArt('unit-submarine') ?? fieldArt('unit-ex-ssn'),
};
const EMOJI: Record<ShipKind, string> = { carrier: '🛳️', cruiser: '🚢', destroyer: '🚢', sub: '🛥️' };
const W: Record<ShipKind, number> = { carrier: 92, cruiser: 74, destroyer: 66, sub: 58 };
const FX = {
  missile: fieldArt('fx-missile'),
  boom: fieldArt('fx-explosion'),
  splash: fieldArt('fx-splash'),
  wreck: fieldArt('fx-wreck'),
  muzzle: fieldArt('fx-muzzle'),
  jet: fieldArt('unit-fighter'),
  sea: fieldArt('tile-sea'),
};
const SINK_S = 2.2;

function Img({ src, alt, w, flip, style }: { src: string | null; alt: string; w: number; flip?: boolean; style?: React.CSSProperties }) {
  const base: React.CSSProperties = { position: 'absolute', width: w, transform: `translate(-50%, -50%)${flip ? ' scaleX(-1)' : ''}`, pointerEvents: 'none', ...style };
  return src ? <img src={src} alt={alt} style={base} draggable={false} /> : <span style={{ ...base, fontSize: w * 0.45, textAlign: 'center' }}>{alt}</span>;
}

/** 시각 t에 배마다 남은 체력 */
function hpAt(plan: FleetPlan, t: number): number[] {
  const hp = plan.ships.map((s) => s.hp);
  for (const e of plan.events) if ((e.k === 'missile' || e.k === 'torpedo') && e.hit && e.t + e.dur <= t) hp[e.to] = Math.max(0, hp[e.to] - e.dmg);
  return hp;
}

export function FleetBattle({ state, a, b, seed, apply, onClose }: { state: GameState; a: string; b: string; seed: number; apply: (f: (s: GameState) => GameState) => void; onClose: () => void }) {
  const plan = useMemo(() => planFleet(state, a, b, seed), [a, b, seed]); // eslint-disable-line react-hooks/exhaustive-deps
  const [t, setT] = useState(0);
  const [speed, setSpeed] = useState(1);
  const done = t >= plan.end;
  const applied = useRef(false);
  useEffect(() => {
    if (done) return;
    let last = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      setT((x) => Math.min(plan.end, x + dt * speed));
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [speed, done, plan.end]);
  useEffect(() => {
    if (done && !applied.current) {
      applied.current = true;
      apply((s) => finishFleet(s, plan));
    }
  }, [done]); // eslint-disable-line react-hooks/exhaustive-deps

  const hp = hpAt(plan, t);
  const pos = (sh: Ship) => {
    const sinkT = plan.events.find((e) => e.k === 'sink' && e.ship === sh.idx)?.t;
    const sinking = sinkT !== undefined && t >= sinkT ? Math.min(1, (t - sinkT) / SINK_S) : 0;
    const bob = Math.sin(t * 1.8 + sh.idx) * 0.006;
    // 서로 조금씩 다가감
    const advance = Math.min(1, t / FLEET_DURATION) * 0.05 * (sh.side === 0 ? 1 : -1);
    return { x: sh.x + advance, y: sh.y + bob + sinking * 0.04, sinking };
  };
  const names = [countryById(a).name, countryById(b).name];
  const alive = [0, 1].map((side) => plan.ships.filter((sh) => sh.side === side && hp[sh.idx] > 0).length);
  const total = [0, 1].map((side) => plan.ships.filter((sh) => sh.side === side).length);
  const hpSum = [0, 1].map((side) => plan.ships.filter((sh) => sh.side === side).reduce((v, sh) => v + hp[sh.idx], 0));
  const hpMax = [0, 1].map((side) => plan.ships.filter((sh) => sh.side === side).reduce((v, sh) => v + sh.hp, 0));
  const pct = (v: number) => `${v * 100}%`;

  return createPortal(
    <div className="fleet-back" role="dialog" aria-label="함대 충돌 관전">
      <div className="fleet-box">
        <div className="fleet-hud">
          {[0, 1].map((side) => (
            <div key={side} className={`fleet-side s${side}`}>
              <span>
                {FLAG[side === 0 ? a : b]} <b>{names[side]}</b>
              </span>
              <span className="bar">
                <span className="bar-fill" style={{ width: `${(hpSum[side] / hpMax[side]) * 100}%` }} />
              </span>
              <small className="muted">
                함선 {alive[side]}/{total[side]} · 해군력 {Math.round(plan.power[side])}
              </small>
            </div>
          ))}
          <button className="icon-btn fleet-x" onClick={onClose} aria-label="닫기">
            ✕
          </button>
        </div>

        <div className="fleet-stage" style={FX.sea ? { backgroundImage: `linear-gradient(#0a1a2acc, #0a1a2a33 30%, #0000), url(${FX.sea})` } : undefined}>
          {/* 배 */}
          {plan.ships.map((sh) => {
            const p = pos(sh);
            const dead = hp[sh.idx] <= 0;
            if (p.sinking >= 1) return <Img key={sh.idx} src={FX.wreck} alt="💨" w={W[sh.kind] * 0.6} style={{ left: pct(p.x), top: pct(p.y), opacity: 0.85 }} />;
            return (
              <div key={sh.idx}>
                <Img
                  src={ART[sh.kind]}
                  alt={EMOJI[sh.kind]}
                  w={W[sh.kind]}
                  flip={sh.side === 1}
                  style={{ left: pct(p.x), top: pct(p.y), opacity: 1 - p.sinking * 0.7, filter: `${dead ? 'grayscale(1) brightness(0.6)' : ''} drop-shadow(0 4px 4px #0008)`, rotate: `${(sh.side ? -1 : 1) * p.sinking * 14}deg` }}
                />
                {!dead && (
                  <span className="fleet-hp" style={{ left: pct(p.x), top: `calc(${pct(p.y)} + 20px)` }} title={SHIP_NAME[sh.kind]}>
                    <i style={{ width: `${(hp[sh.idx] / sh.hp) * 100}%` }} className={sh.side ? 's1' : 's0'} />
                  </span>
                )}
              </div>
            );
          })}
          {/* 전투기·미사일·어뢰·폭발 */}
          {plan.events.map((e, i) => {
            if (e.k === 'jet') {
              if (t < e.t || t > e.t + e.dur) return null;
              const q = (t - e.t) / e.dur;
              const x = e.side === 0 ? 0.05 + q * 0.95 : 0.95 - q * 0.95;
              return <Img key={i} src={FX.jet} alt="✈️" w={46} flip={e.side === 1} style={{ left: pct(x), top: pct(e.y - Math.sin(q * Math.PI) * 0.08), opacity: q > 0.9 ? (1 - q) * 10 : 1 }} />;
            }
            if (e.k === 'sink') return null;
            const from = plan.ships[e.from];
            const to = plan.ships[e.to];
            const out: React.ReactNode[] = [];
            const pf = pos(from);
            const pt = pos(to);
            const tx = pt.x + (e.hit ? 0 : (to.side === 0 ? -1 : 1) * 0.06);
            const ty = pt.y + (e.hit ? 0 : 0.05);
            if (t >= e.t && t < e.t + 0.25 && e.k === 'missile') out.push(<Img key={`m${i}`} src={FX.muzzle} alt="✨" w={28} style={{ left: pct(pf.x), top: pct(pf.y - 0.04) }} />);
            if (t >= e.t && t < e.t + e.dur) {
              const q = (t - e.t) / e.dur;
              const x = pf.x + (tx - pf.x) * q;
              if (e.k === 'missile') {
                const arc = 0.2;
                const y = pf.y + (ty - pf.y) * q - Math.sin(q * Math.PI) * arc;
                const dy = (ty - pf.y) - Math.cos(q * Math.PI) * Math.PI * arc;
                const ang = (Math.atan2(dy * 0.75, tx - pf.x) * 180) / Math.PI; // 무대 가로:세로 ≈ 4:3
                out.push(<Img key={`f${i}`} src={FX.missile} alt="🚀" w={34} style={{ left: pct(x), top: pct(y), rotate: `${ang}deg` }} />);
              } else {
                const y = pf.y + 0.03 + (ty - pf.y) * q;
                out.push(<span key={`f${i}`} className="fleet-torpedo" style={{ left: pct(x), top: pct(y) }} />);
              }
            }
            const land = e.t + e.dur;
            if (t >= land && t < land + 0.7) {
              const q = (t - land) / 0.7;
              out.push(
                <Img key={`x${i}`} src={e.hit ? FX.boom : FX.splash} alt={e.hit ? '💥' : '💦'} w={(e.hit ? 52 : 36) * (0.6 + q * 0.6)} style={{ left: pct(tx), top: pct(ty - 0.02), opacity: 1 - q * 0.8 }} />,
              );
            }
            return out;
          })}
          {done && (
            <div className="fleet-result">
              <h3>
                {FLAG[plan.winner === 0 ? a : b]} {names[plan.winner]} 함대 승리!
              </h3>
              <p className="small">
                남은 함선 {names[0]} {plan.left[0]} · {names[1]} {plan.left[1]}
              </p>
              <button className="primary" onClick={onClose}>
                확인
              </button>
            </div>
          )}
        </div>

        <div className="fleet-ctrl">
          {[0.5, 1, 2].map((x) => (
            <button key={x} className={speed === x ? 'on' : ''} onClick={() => setSpeed(x)}>
              {x}배
            </button>
          ))}
          <button disabled={done} onClick={() => setT(plan.end)}>
            결과 바로 보기 ⏭
          </button>
          <small className="muted">{Math.floor(t)}초</small>
        </div>
      </div>
    </div>,
    document.querySelector('.frame') ?? document.body,
  );
}
