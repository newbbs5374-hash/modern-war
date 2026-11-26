// 3D 전투 화면(⑦): 화면 전체를 덮고, 끝나면 결과를 전투 화면에 넘김.
import { useEffect, useRef } from 'react';
import type { FrameProps } from './BattleScreen';
import { outcome } from '../../battle3d/sim';
import css from '../../battle3d/battle3d.css?raw';

export function Battle3DView({ onEnd }: FrameProps) {
  const ref = useRef<HTMLDivElement>(null);
  const endRef = useRef(onEnd);
  endRef.current = onEnd;
  useEffect(() => {
    let off: (() => void) | null = null;
    let gone = false;
    // three.js·모형은 이 전투를 열 때만 불러옴
    void import('../../battle3d/view').then(({ mountBattle3D }) => {
      if (gone || !ref.current) return;
      off = mountBattle3D(ref.current, {
        endLabel: '결과 보기',
        onEnd: (r) => endRef.current(outcome(r)),
        onQuit: () => endRef.current({ win: false, stars: 0, text: '작전을 그만뒀어요.' }),
      });
    });
    return () => {
      gone = true;
      off?.();
    };
  }, []);
  return (
    <div className="b3d-wrap">
      <style>{css}</style>
      <div className="b3d" ref={ref} />
    </div>
  );
}
