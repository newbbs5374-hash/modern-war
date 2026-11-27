// 11/28 디자인 개편 A안: 본부 맨 아래 "지금 할 일" 카드 하나(옆으로 밀면 다음 일).
// 비서실장·부관 얼굴 + 한 문장 + 딱지 + 주황 단추. 급한 일(빨강)이 늘 먼저.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { GameState } from '../game/state';
import { Face } from './Portrait';
import { secretaryKeys, secretaryOf } from '../data/secretary';

export interface NextItem {
  key: string;
  tone: 'red' | 'amber' | 'teal';
  /** 말하는 사람(예: 비서실장, 합참) */
  who: string;
  /** 얼굴 대신 보여 줄 큰 아이콘(없으면 비서 얼굴) */
  icon?: ReactNode;
  title: ReactNode;
  chips?: Array<[cls: '' | 'up' | 'dn' | 'am' | 'te', text: string]>;
  act: string;
  on: () => void;
  disabled?: boolean;
}

export function NextCarousel({ state, items }: { state: GameState; items: NextItem[] }) {
  const [i, setI] = useState(0);
  const x0 = useRef<number | null>(null);
  const n = items.length;
  useEffect(() => {
    if (i >= n) setI(0);
  }, [i, n]);
  if (!n) return null;
  const it = items[Math.min(i, n - 1)];
  const sec = secretaryOf(state.player.countryId);
  const step = (d: number) => setI((v) => (v + d + n) % n);
  return (
    <div
      className={`gx-next glass tone-${it.tone}`}
      onPointerDown={(e) => (x0.current = e.clientX)}
      onPointerUp={(e) => {
        if (x0.current == null) return;
        const dx = e.clientX - x0.current;
        x0.current = null;
        if (Math.abs(dx) > 40) step(dx < 0 ? 1 : -1);
      }}
    >
      <span className="gx-next-face">
        {it.icon ? <span className="gx-next-ico">{it.icon}</span> : <Face keys={secretaryKeys(state.player.countryId)} fallback="👩‍💼" />}
      </span>
      <span className="gx-next-main">
        <small>
          {it.who === '비서실장' ? `비서실장 ${sec.name}` : it.who} · 지금 할 일 {Math.min(i, n - 1) + 1}/{n}
        </small>
        <b>{it.title}</b>
        {it.chips && it.chips.length > 0 && (
          <span className="gx-chips">
            {it.chips.map(([c, t]) => (
              <span key={t} className={`gx-chip ${c}`}>
                {t}
              </span>
            ))}
          </span>
        )}
      </span>
      <button className={it.tone === 'teal' ? 'btn-info gx-next-go' : 'btn-go gx-next-go'} disabled={it.disabled} onClick={it.on}>
        {it.act}
        <small>▶</small>
      </button>
      {n > 1 && (
        <span className="gx-next-dots">
          {items.slice(0, 8).map((x, k) => (
            <i key={x.key} className={k === Math.min(i, n - 1) ? 'on' : x.tone === 'red' ? 'red' : ''} onClick={() => setI(k)} />
          ))}
          <button className="gx-next-more" onClick={() => step(1)} aria-label="다음 할 일">
            ›
          </button>
        </span>
      )}
    </div>
  );
}
