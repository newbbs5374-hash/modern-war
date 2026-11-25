// path를 따라 움직이는 실사 그림(세계지도 PR #172에서 꺼냄, 11-25 본부 지도도 씀)
import { useEffect, useRef } from 'react';

/** 움직이는 그림들: 한 번의 그리기 반복(초당 약 30번)으로 모두 옮김.
 * 그림이 오른쪽을 보고 있어서, 왼쪽으로 갈 땐 좌우를 뒤집어 거꾸로 서지 않게 함 */
interface MoveEntry {
  g: SVGGElement;
  p: SVGPathElement;
  L: number;
  dur: number;
  begin: number;
  tilt: number;
  rev: boolean;
}
const MOVERS = new Set<MoveEntry>();
let moveRaf = 0;
let moveLast = 0;
function moveTick(now: number) {
  moveRaf = MOVERS.size ? requestAnimationFrame(moveTick) : 0;
  if (now - moveLast < 33) return;
  moveLast = now;
  const t = now / 1000;
  for (const e of MOVERS) {
    if (!e.L) {
      e.L = e.p.getTotalLength();
      if (!e.L) continue;
    }
    const f0 = ((((t - e.begin) / e.dur) % 1) + 1) % 1;
    const f = e.rev ? 1 - f0 : f0;
    const at = f * e.L;
    const a = e.p.getPointAtLength(at);
    const b = e.p.getPointAtLength(at + 0.8 <= e.L ? at + 0.8 : Math.max(0, at - 0.8));
    let dx = b.x - a.x;
    let dy = b.y - a.y;
    if ((at + 0.8 > e.L) !== e.rev) {
      dx = -dx;
      dy = -dy;
    }
    const left = dx < -0.01;
    let rot = (Math.atan2(dy, dx) * 180) / Math.PI;
    if (left) rot -= 180;
    if (rot > 180) rot -= 360;
    if (rot < -180) rot += 360;
    rot = Math.max(-e.tilt, Math.min(e.tilt, rot));
    e.g.setAttribute(
      "transform",
      `translate(${a.x.toFixed(2)},${a.y.toFixed(2)}) rotate(${rot.toFixed(1)}) scale(${left ? -1 : 1},1)`,
    );
  }
}

/** path를 따라 계속 움직이는 그림 하나. tilt = 기울기 최대(도): 배·땅 부대는 조금만 기울어짐 */
export function Mover({
  path,
  dur,
  begin,
  tilt = 30,
  reverse = false,
  children,
}: {
  path: string;
  dur: number;
  begin: number;
  tilt?: number;
  /** 길을 거꾸로(끝 → 처음) */
  reverse?: boolean;
  children: React.ReactNode;
}) {
  const gRef = useRef<SVGGElement>(null);
  const pRef = useRef<SVGPathElement>(null);
  useEffect(() => {
    if (!gRef.current || !pRef.current) return;
    const e: MoveEntry = { g: gRef.current, p: pRef.current, L: 0, dur, begin, tilt, rev: reverse };
    MOVERS.add(e);
    if (!moveRaf) moveRaf = requestAnimationFrame(moveTick);
    return () => {
      MOVERS.delete(e);
    };
  }, [path, dur, begin, tilt, reverse]);
  return (
    <>
      <path ref={pRef} d={path} fill="none" stroke="none" />
      <g ref={gRef} transform="translate(-9999,-9999)">
        {children}
      </g>
    </>
  );
}

