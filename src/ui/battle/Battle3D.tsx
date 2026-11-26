// 3D 메인 전투(시험판 "철벽 작전"에서 옮김). three.js가 무거워서 이 파일은 따로 나뉘어 불러옴.
import { useEffect, useRef } from 'react';
import { fieldById } from '../../battle3d/fields';
import { outcomeOf, type B3dEnd } from '../../battle3d/outcome';
import { mountBattle3D } from '../../battle3d/view';
import type { FrameProps } from './BattleScreen';

export default function Battle3D({ spec, onEnd }: FrameProps) {
  const box = useRef<HTMLDivElement>(null);
  const end = useRef(onEnd);
  end.current = onEnd;
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    let sent = false;
    const view = mountBattle3D(el, {
      field: fieldById(spec.variant),
      onEnd: (e: B3dEnd) => {
        if (sent) return;
        sent = true;
        // 결과 패널을 잠깐 보여 준 뒤 게임 결과 화면으로
        setTimeout(() => end.current(outcomeOf(e)), 1200);
      },
    });
    (window as unknown as { __b3d?: unknown }).__b3d = view.debug;
    return () => view.dispose();
  }, [spec.variant, spec.seed]);
  return <div ref={box} className="b3d-host" />;
}
