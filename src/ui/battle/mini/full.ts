// 11-28 전체 화면 훈련 공통: 세로 화면이면 눕혀 쓰기, 캔버스 크기, 누른 자리 → 캔버스 좌표, 세계 → 화면 맞추기.
import { useEffect, useRef, useState } from 'react';

/** 세로 화면이면 눕혀서 쓰기 + 캔버스 크기 맞추기 */
export function useFullCanvas() {
  const cv = useRef<HTMLCanvasElement>(null);
  const [rot, setRot] = useState(() => window.innerHeight > window.innerWidth);
  useEffect(() => {
    const on = () => setRot(window.innerHeight > window.innerWidth);
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  useEffect(() => {
    const fit = () => {
      const c = cv.current;
      if (!c) return;
      const d = Math.min(2, window.devicePixelRatio || 1);
      c.width = Math.round(c.clientWidth * d);
      c.height = Math.round(c.clientHeight * d);
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [rot]);
  return { cv, rot };
}

/** 누른 자리 → 캔버스 픽셀 좌표(눕힌 화면도 맞게) */
export function localPt(e: { clientX: number; clientY: number }, c: HTMLCanvasElement | null, rot: boolean): { x: number; y: number } {
  if (!c) return { x: 0, y: 0 };
  const r = c.getBoundingClientRect();
  const k = c.width / Math.max(1, c.clientWidth);
  const lx = rot ? e.clientY - r.top : e.clientX - r.left;
  const ly = rot ? r.right - e.clientX : e.clientY - r.top;
  return { x: lx * k, y: ly * k };
}
/** 끈 거리(화면 기준 CSS px, 눕힌 화면도 맞게) */
export function screenDelta(a: { clientX: number; clientY: number }, b: { clientX: number; clientY: number }, rot: boolean): { x: number; y: number } {
  return rot ? { x: b.clientY - a.clientY, y: a.clientX - b.clientX } : { x: b.clientX - a.clientX, y: b.clientY - a.clientY };
}

export interface View { sc: number; ox: number; oy: number }
/** 정해진 크기 세계를 화면 가운데에 꽉 맞춤 */
export function fitView(c: HTMLCanvasElement, W: number, H: number): View {
  const sc = Math.min(c.width / W, c.height / H);
  return { sc, ox: (c.width - W * sc) / 2, oy: (c.height - H * sc) / 2 };
}
export const toWorld = (v: View, p: { x: number; y: number }) => ({ x: (p.x - v.ox) / v.sc, y: (p.y - v.oy) / v.sc });

/** 점들을 모두 담는 카메라(위는 점수판 자리만큼 더) */
export function fitCam(pts: Array<{ x: number; y: number }>, ratio: number, floorY: number, minW: number, pad = 120): { x: number; y: number; w: number; h: number } {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const p of pts) {
    x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x);
    y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y);
  }
  x0 -= pad; x1 += pad; y0 -= pad * 2.2; y1 = Math.max(y1 + pad, floorY + 60);
  let w = Math.max(minW, x1 - x0), h = y1 - y0;
  if (w / h < ratio) w = h * ratio;
  else h = w / ratio;
  const cx = (x0 + x1) / 2;
  return { x: cx - w / 2, y: y1 - h, w, h };
}

/** 둥근 네모 */
export function rr(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}
