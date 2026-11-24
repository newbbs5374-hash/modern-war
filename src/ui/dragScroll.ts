// 스크롤 칸을 마우스로 잡고 끌어 움직이기. 터치는 원래 손가락으로 밀리므로 그대로 둠.
// 끌고 난 뒤에는 그 클릭(칸 고르기)을 막아서, 끌다가 잘못 눌리지 않게 함.
import { useEffect, type RefObject } from 'react';

export function useDragScroll(ref: RefObject<HTMLElement | null>, on = true) {
  useEffect(() => {
    const el = ref.current;
    if (!el || !on) return;
    let down: { x: number; y: number; l: number; t: number; id: number } | null = null;
    let moved = false;
    const start = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      down = { x: e.clientX, y: e.clientY, l: el.scrollLeft, t: el.scrollTop, id: e.pointerId };
      moved = false;
    };
    const move = (e: PointerEvent) => {
      if (!down || e.pointerId !== down.id) return;
      const dx = e.clientX - down.x;
      const dy = e.clientY - down.y;
      if (!moved && Math.hypot(dx, dy) < 5) return;
      if (!moved) {
        moved = true;
        el.classList.add('dragging');
        try {
          el.setPointerCapture(e.pointerId);
        } catch {
          /* 무시 */
        }
      }
      el.scrollLeft = down.l - dx;
      el.scrollTop = down.t - dy;
      e.preventDefault();
    };
    const end = (e: PointerEvent) => {
      if (!down || e.pointerId !== down.id) return;
      down = null;
      el.classList.remove('dragging');
      if (moved) setTimeout(() => (moved = false), 0);
    };
    const click = (e: MouseEvent) => {
      if (moved) {
        e.stopPropagation();
        e.preventDefault();
        moved = false;
      }
    };
    el.addEventListener('pointerdown', start);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
    el.addEventListener('click', click, true);
    return () => {
      el.removeEventListener('pointerdown', start);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', end);
      el.removeEventListener('pointercancel', end);
      el.removeEventListener('click', click, true);
      el.classList.remove('dragging');
    };
  }, [ref, on]);
}
