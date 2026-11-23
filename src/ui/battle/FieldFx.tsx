// 지도 위 전투 연출: 포탄(포물선)·미사일(연기 꼬리)·어뢰·기관포 예광탄, 포구 불꽃, 맞은 자리 폭발·물보라·공중 폭발,
// 부대가 부서질 때 큰 폭발과 충격파, 잔해 연기. 계산은 하지 않고 battle/field.ts가 남긴 기록(fx)을 그리기만 한다.
import type { ReactElement } from 'react';
import type { FFx, FKind, FieldBattle } from '../../battle/field';
import { FX_ART, fieldArt } from '../fieldArt';

type Kind = 'shell' | 'missile' | 'torpedo' | 'tracer';

/** 쏜 부대·맞은 층 → 탄 종류와 날아가는 시간(전투 초) */
export function shotStyle(by: FKind | undefined, at: FFx['at']): { kind: Kind; dur: number } {
  const air = at === 'air';
  switch (by) {
    case 'submarine':
      return { kind: 'torpedo', dur: 0.9 };
    case 'aa':
    case 'fighter':
    case 'drone':
      return { kind: 'missile', dur: by === 'drone' ? 0.45 : 0.55 };
    case 'destroyer':
    case 'cruiser':
      return air ? { kind: 'missile', dur: 0.5 } : { kind: 'shell', dur: 0.75 };
    case 'artillery':
      return { kind: 'shell', dur: 0.9 };
    case 'hq':
      return air ? { kind: 'missile', dur: 0.5 } : { kind: 'shell', dur: 0.7 };
    default:
      return { kind: 'tracer', dur: 0.2 };
  }
}
const IMPACT = 0.55;

type P = { x: number; y: number };
const lerp = (a: P, c: P, k: number): P => ({ x: a.x + (c.x - a.x) * k, y: a.y + (c.y - a.y) * k });

/** 탄이 날아가는 자리(포탄은 높이 떴다가 떨어짐) */
function flight(kind: Kind, a: P, c: P, k: number): P {
  const p = lerp(a, c, k);
  const d = Math.hypot(c.x - a.x, c.y - a.y);
  const h = kind === 'shell' ? 6 + d * 0.3 : kind === 'missile' ? 2 + d * 0.12 : 0;
  return { x: p.x, y: p.y - 4 * h * k * (1 - k) };
}

function Img({ art, x, y, size, opacity = 1, rot = 0, fallback }: { art: string; x: number; y: number; size: number; opacity?: number; rot?: number; fallback: ReactElement }) {
  const url = fieldArt(art);
  if (!url) return fallback;
  return (
    <image
      href={url}
      x={x - size / 2}
      y={y - size / 2}
      width={size}
      height={size}
      opacity={opacity}
      transform={rot ? `rotate(${rot} ${x} ${y})` : undefined}
      pointerEvents="none"
    />
  );
}

/** 폭발(그림 없으면 주황 원 겹침) */
function Blast({ x, y, size, q }: { x: number; y: number; size: number; q: number }) {
  const s = size * (0.55 + 0.7 * q);
  const o = Math.max(0, 1 - q * q);
  return (
    <Img
      art={FX_ART.explosion}
      x={x}
      y={y}
      size={s}
      opacity={o}
      fallback={
        <g opacity={o} pointerEvents="none">
          <circle cx={x} cy={y} r={s * 0.5} fill="#f97316" opacity={0.75} />
          <circle cx={x} cy={y} r={s * 0.3} fill="#fde047" />
          <circle cx={x + s * 0.25} cy={y - s * 0.2} r={s * 0.22} fill="#57534e" opacity={0.7 * q} />
        </g>
      }
    />
  );
}

function Splash({ x, y, size, q }: { x: number; y: number; size: number; q: number }) {
  const o = Math.max(0, 1 - q);
  return (
    <g pointerEvents="none">
      <circle cx={x} cy={y + 1} r={2 + q * size * 0.6} fill="none" stroke="#e0f2fe" strokeWidth={0.8} opacity={o} />
      <Img
        art={FX_ART.splash}
        x={x}
        y={y - size * 0.25}
        size={size * (0.6 + 0.6 * q)}
        opacity={o}
        fallback={
          <g opacity={o}>
            <ellipse cx={x} cy={y - size * 0.2 * (0.5 + q)} rx={size * 0.18} ry={size * 0.35 * (0.4 + q)} fill="#f0f9ff" opacity={0.85} />
            <circle cx={x - size * 0.2} cy={y - size * 0.15} r={size * 0.1} fill="#bae6fd" />
            <circle cx={x + size * 0.2} cy={y - size * 0.12} r={size * 0.09} fill="#bae6fd" />
          </g>
        }
      />
    </g>
  );
}

function Flak({ x, y, size, q }: { x: number; y: number; size: number; q: number }) {
  const o = Math.max(0, 1 - q);
  return (
    <Img
      art={FX_ART.flak}
      x={x}
      y={y}
      size={size * (0.6 + 0.6 * q)}
      opacity={o}
      fallback={
        <g opacity={o} pointerEvents="none">
          <circle cx={x} cy={y} r={size * 0.35 * (0.6 + q)} fill="#44403c" opacity={0.8} />
          <circle cx={x} cy={y} r={size * 0.18} fill="#fb923c" opacity={1 - q} />
        </g>
      }
    />
  );
}

function Muzzle({ x, y, q, size = 6 }: { x: number; y: number; q: number; size?: number }) {
  const o = Math.max(0, 1 - q);
  return (
    <Img
      art={FX_ART.muzzle}
      x={x}
      y={y}
      size={size}
      opacity={o}
      fallback={
        <g opacity={o} pointerEvents="none">
          <circle cx={x} cy={y} r={size * 0.45} fill="#fde68a" />
          <circle cx={x} cy={y} r={size * 0.22} fill="#fff" />
        </g>
      }
    />
  );
}

/** 맞은 층에 맞는 착탄 효과 */
function Impact({ x, y, at, big, q, kind }: { x: number; y: number; at: FFx['at']; big?: boolean; q: number; kind: Kind }) {
  const size = (big ? 13 : 9) * (kind === 'tracer' ? 0.6 : 1);
  if (at === 'air') return <Flak x={x} y={y} size={size} q={q} />;
  if (at === 'sea')
    return (
      <>
        <Splash x={x} y={y} size={size + 2} q={q} />
        {big && <Blast x={x} y={y - 1} size={size * 0.8} q={q} />}
      </>
    );
  return <Blast x={x} y={y} size={size} q={q} />;
}

export interface FxView {
  /** 화면 흔들림 세기(0~1) */
  shake: number;
  /** 내 부대가 크게 맞았거나 부서짐(빨간 테두리) */
  hurt: number;
}

/** 지금 화면 흔들림·빨간 테두리 세기 */
export function fxMood(b: FieldBattle, vt: number): FxView {
  let shake = 0;
  let hurt = 0;
  for (const x of b.fx) {
    const age = vt - x.t;
    if (x.kind === 'boom' && age < 0.45) {
      shake = Math.max(shake, (x.by === 'hq' || x.by === 'cruiser' || x.by === 'carrier' ? 1 : 0.6) * (1 - age / 0.45));
      if (x.side === 'me') hurt = Math.max(hurt, 1 - age / 0.8);
    }
    if (x.kind === 'shot' && x.big && x.side === 'foe') {
      const { dur } = shotStyle(x.by, x.at);
      const k = age - dur;
      if (k >= 0 && k < 0.3) hurt = Math.max(hurt, 0.45 * (1 - k / 0.3));
    }
    if (x.kind === 'shot' && x.big && (x.by === 'artillery' || x.by === 'cruiser')) {
      const { dur } = shotStyle(x.by, x.at);
      const k = age - dur;
      if (k >= 0 && k < 0.25) shake = Math.max(shake, 0.35 * (1 - k / 0.25));
    }
  }
  return { shake, hurt };
}

/**
 * 효과 그리기. pos(i, air) = 칸 i의 화면 자리(하늘 부대는 조금 위)
 */
export function FieldFx({ b, vt, pos }: { b: FieldBattle; vt: number; pos: (i: number, air: boolean) => P }) {
  const out: ReactElement[] = [];
  b.fx.forEach((x, n) => {
    const age = vt - x.t;
    if (age < 0) return;
    if (x.kind === 'wreck') {
      if (age < 0.5) return;
      const c = pos(x.to, false);
      const o = Math.max(0, 1 - (age - 0.5) / 2.5);
      out.push(
        <g key={`w${n}`} pointerEvents="none" opacity={o}>
          {x.at !== 'air' && (
            <Img art={FX_ART.wreck} x={c.x} y={c.y} size={12} fallback={<text x={c.x} y={c.y + 3} fontSize={8} textAnchor="middle">🔥</text>} />
          )}
          {[0, 1, 2].map((s) => {
            const k = ((age * 0.6 + s / 3) % 1 + 1) % 1;
            return <circle key={s} cx={c.x + Math.sin((age + s) * 2) * 1.5} cy={c.y - 3 - k * 10} r={1.2 + k * 2.4} fill="#57534e" opacity={0.55 * (1 - k)} />;
          })}
        </g>,
      );
      return;
    }
    if (x.kind === 'boom') {
      if (age > 1.2) return;
      const c = pos(x.to, x.at === 'air');
      const q = Math.min(1, age / 0.9);
      out.push(
        <g key={`b${n}`} pointerEvents="none">
          <circle cx={c.x} cy={c.y} r={3 + q * 16} fill="none" stroke="#fdba74" strokeWidth={1.4 * (1 - q)} opacity={1 - q} />
          {x.at === 'sea' && <Splash x={c.x} y={c.y} size={18} q={q} />}
          <Blast x={c.x} y={c.y} size={x.by === 'hq' || x.by === 'carrier' || x.by === 'cruiser' ? 30 : 22} q={q} />
          {age < 0.12 && <circle cx={c.x} cy={c.y} r={12} fill="#fff" opacity={0.6 * (1 - age / 0.12)} />}
        </g>,
      );
      return;
    }
    const st = shotStyle(x.by, x.at);
    const fromAir = x.by === 'fighter' || x.by === 'drone';
    const a = pos(x.from, fromAir);
    const c = pos(x.to, x.at === 'air');
    const k = age / st.dur;
    const color = x.side === 'me' ? '#93c5fd' : '#fca5a5';
    const g: ReactElement[] = [];
    // 쏠 때 포구 불꽃
    if (age < 0.18 && st.kind !== 'torpedo') g.push(<Muzzle key="m" x={a.x} y={a.y - 1} q={age / 0.18} size={st.kind === 'shell' ? 8 : 5} />);
    if (k < 1) {
      const p = flight(st.kind, a, c, k);
      if (st.kind === 'shell') {
        const trail = [0.08, 0.16, 0.24].map((d) => flight('shell', a, c, Math.max(0, k - d)));
        trail.forEach((t, i) => g.push(<circle key={`t${i}`} cx={t.x} cy={t.y} r={1 - i * 0.25} fill="#fde68a" opacity={0.5 - i * 0.15} />));
        g.push(<circle key="s" cx={p.x} cy={p.y} r={1.9} fill="#1c1917" stroke="#fbbf24" strokeWidth={0.5} />);
      } else if (st.kind === 'missile') {
        const back = flight('missile', a, c, Math.max(0, k - 0.06));
        const rot = (Math.atan2(p.y - back.y, p.x - back.x) * 180) / Math.PI;
        const smoke = [];
        for (let s = 1; s <= 6; s++) {
          const t = flight('missile', a, c, Math.max(0, k - s * 0.07));
          smoke.push(<circle key={s} cx={t.x} cy={t.y} r={0.7 + s * 0.35} fill="#d6d3d1" opacity={0.5 - s * 0.07} />);
        }
        g.push(<g key="smk">{smoke}</g>);
        g.push(
          <Img
            key="mis"
            art={FX_ART.missile}
            x={p.x}
            y={p.y}
            size={10}
            rot={rot}
            fallback={
              <g transform={`rotate(${rot} ${p.x} ${p.y})`}>
                <rect x={p.x - 3.4} y={p.y - 0.75} width={5.4} height={1.5} rx={0.7} fill="#e7e5e4" />
                <circle cx={p.x - 3.7} cy={p.y} r={1.2} fill="#fb923c" />
              </g>
            }
          />,
        );
      } else if (st.kind === 'torpedo') {
        g.push(<line key="wk" x1={a.x} y1={a.y} x2={p.x} y2={p.y} stroke="#f0f9ff" strokeWidth={0.9} strokeDasharray="1.5 1.2" opacity={0.75} />);
        g.push(<circle key="tp" cx={p.x} cy={p.y} r={1.1} fill="#0f172a" />);
      } else {
        const t0 = lerp(a, c, Math.max(0, k - 0.45));
        g.push(<line key="tr" x1={t0.x} y1={t0.y} x2={p.x} y2={p.y} stroke={x.side === 'me' ? '#fef08a' : '#fecaca'} strokeWidth={0.8} strokeLinecap="round" />);
      }
    } else if (age - st.dur < IMPACT) {
      g.push(<Impact key="im" x={c.x} y={c.y} at={x.at} big={x.big} q={(age - st.dur) / IMPACT} kind={st.kind} />);
    }
    if (g.length)
      out.push(
        <g key={`s${n}`} pointerEvents="none" data-side={x.side} style={{ color }}>
          {g}
        </g>,
      );
  });
  return <>{out}</>;
}
