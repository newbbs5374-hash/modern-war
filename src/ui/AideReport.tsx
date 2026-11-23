// 부관 보고 말풍선: 중요한 일이 끝나면 부관 얼굴과 함께 아래에 뜸. 누르면 다음 보고, 2초 뒤 저절로 사라짐(11-24 대장 지시).
import { useEffect } from 'react';
import { reportsOf } from '../game/report';
import type { GameState } from '../game/state';
import { AIDE_ICON } from './icons';
import { Face, aideKeys } from './Portrait';
import { PersonFace } from './People';

export const REPORT_SHOW_MS = 2000;

export function AideReport({ state, onNext }: { state: GameState; onNext: () => void }) {
  const list = reportsOf(state);
  const r = list[0];
  useEffect(() => {
    if (!r) return;
    const t = setTimeout(onNext, REPORT_SHOW_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [r?.id]);
  if (!r) return null;
  const aides = state.officer.aides;
  const aide = (r.who && aides.find((a) => a.name === r.who)) || aides.find((a) => !a.errand || state.worldMs >= a.errand.endMs) || aides[0];
  const title = '지도자님';
  return (
    <div className="aide-report" role="status" aria-live="polite" key={r.id}>
      <span className="aide-face">
        {aide ? (
          <PersonFace who={{ kind: 'aide', id: aide.id }} keys={aideKeys(aide)} fallback={AIDE_ICON[aide.specialty]} />
        ) : (
          <Face keys={aideKeys(aide)} fallback="🧑‍✈️" />
        )}
        <i>{r.icon}</i>
      </span>
      <button className="aide-bubble" onClick={onNext}>
        <b>{aide ? `${aide.specialty} 부관 ${aide.name}` : '부관 보고'}</b>
        <p>
          {title}, {r.text}
        </p>
        <small>{list.length > 1 ? `다음 보고 ${list.length - 1}개 · 눌러서 넘기기` : '눌러서 닫기'}</small>
      </button>
    </div>
  );
}
