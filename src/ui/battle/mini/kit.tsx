// 미니게임 공통 도구: 매 프레임 돌리기, 무대(정사각 화면), 씨앗 난수.
import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import { Rng } from '../../../game/rng';

export interface MiniProps {
  /** 1 ~ 2 (계급이 오를수록 어려움) */
  level: number;
  seed: number;
  /** 지금 점수(0~1)를 알려 줌. 시간이 끝나면 마지막으로 알린 점수로 끝남 */
  report: (score: number) => void;
  /** 스스로 끝날 때 */
  finish: (score: number) => void;
}

/** 매 프레임 cb(초 단위 dt). 화면이 떠 있는 동안만 */
export function useLoop(cb: (dt: number) => void, on = true) {
  const ref = useRef(cb);
  ref.current = cb;
  useEffect(() => {
    if (!on) return;
    let last = performance.now();
    let raf = 0;
    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      ref.current(dt);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [on]);
}

/** 처음 한 번만 만드는 씨앗 난수 */
export function useRng(seed: number): Rng {
  const r = useRef<Rng | null>(null);
  if (!r.current) r.current = new Rng(seed >>> 0 || 1);
  return r.current;
}

/** 정사각(또는 비율) 무대. 안은 position:relative, 0~100 퍼센트 좌표로 놓기 쉬움 */
export function Stage(props: { children: ReactNode; ratio?: number; style?: CSSProperties; className?: string; onPointerDown?: (e: React.PointerEvent<HTMLDivElement>) => void; onPointerMove?: (e: React.PointerEvent<HTMLDivElement>) => void; onPointerUp?: (e: React.PointerEvent<HTMLDivElement>) => void; stageRef?: React.Ref<HTMLDivElement> }) {
  return (
    <div
      ref={props.stageRef}
      className={`mg-stage ${props.className ?? ''}`}
      style={{ aspectRatio: String(props.ratio ?? 1), ...props.style }}
      onPointerDown={props.onPointerDown}
      onPointerMove={props.onPointerMove}
      onPointerUp={props.onPointerUp}
      onPointerCancel={props.onPointerUp}
    >
      {props.children}
    </div>
  );
}

/** 무대 안 위치(퍼센트)에 놓는 것 */
export function At(props: { x: number; y: number; children: ReactNode; size?: number; style?: CSSProperties; onClick?: () => void; className?: string }) {
  return (
    <div
      className={`mg-at ${props.className ?? ''}`}
      onClick={props.onClick}
      style={{ left: `${props.x}%`, top: `${props.y}%`, fontSize: props.size ? `${props.size}px` : undefined, ...props.style }}
    >
      {props.children}
    </div>
  );
}

/** 포인터 위치 → 무대 안 퍼센트 좌표 */
export function pctOf(e: { clientX: number; clientY: number }, el: HTMLElement | null): { x: number; y: number } {
  if (!el) return { x: 0, y: 0 };
  const r = el.getBoundingClientRect();
  return { x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 };
}

/** 위 줄 점수판 */
export function Hud(props: { items: Array<[string, ReactNode]> }) {
  return (
    <div className="mg-hud">
      {props.items.map(([k, v]) => (
        <span key={k}>
          <small>{k}</small> <b>{v}</b>
        </span>
      ))}
    </div>
  );
}

export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

/** 정사각 격자 칸 번호 도우미 */
export const cellXY = (i: number, cols: number) => ({ c: i % cols, r: Math.floor(i / cols) });
