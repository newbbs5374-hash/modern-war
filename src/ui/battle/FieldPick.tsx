// 11-25 2.5D 전장: 싸우기 전 출전 편성. 우리 병과 9개 중 8개를 골라 그 병과만 전장에 나감.
// 고르지 않은 병과 자리는 고른 병과로 채워서 전체 부대 수는 같음(battle/field.ts createField의 picks).
import { useMemo, useState } from 'react';
import { CAPTURERS, FUNIT, PICKABLE, PICK_DEFAULT, PICK_MAX, fieldHasSea, type FKind } from '../../battle/field';
import type { BattleSpec } from '../../battle/spec';
import { CITIES } from '../../data/cities';
import { UNIT_ART, fieldArt } from '../fieldArt';

const LAYER_NAME = { land: '육군', air: '공군', sea: '해군' } as const;

export function FieldPick({ spec, onDone }: { spec: BattleSpec; onDone: (picks: FKind[]) => void }) {
  const sea = useMemo(() => fieldHasSea(spec.city, spec.seed), [spec.city, spec.seed]);
  const usable = (k: FKind) => sea || FUNIT[k].layer !== 'sea';
  const [sel, setSel] = useState<FKind[]>(() => {
    const base = PICK_DEFAULT.filter(usable);
    // 바다 없는 도시는 남는 자리를 육군·공군으로
    for (const k of PICKABLE) if (base.length < PICK_MAX && usable(k) && !base.includes(k)) base.push(k);
    return base;
  });
  const toggle = (k: FKind) => {
    if (!usable(k)) return;
    setSel((s) => (s.includes(k) ? s.filter((x) => x !== k) : s.length >= PICK_MAX ? s : [...s, k]));
  };
  const canCapture = sel.some((k) => CAPTURERS.includes(k));
  const city = CITIES.find((c) => c.id === spec.city)?.name;
  return (
    <div className="fp">
      <h3>🎖️ 출전 편성 {city ? `· ${city}` : ''}</h3>
      <p className="small">
        병과를 <b>{PICK_MAX}개까지</b> 골라요. 고른 병과만 전장에 나가고, 빠진 병과 자리는 고른 병과가 채워요.
        {!sea && ' 이 도시는 바다가 없어 함선은 못 나가요.'}
      </p>
      <div className="fp-grid">
        {PICKABLE.map((k) => {
          const d = FUNIT[k];
          const on = sel.includes(k);
          const art = fieldArt(`obl-${k}-se`) ?? fieldArt(UNIT_ART[k]);
          const off = !usable(k);
          return (
            <button key={k} className={`fp-card ${on ? 'on' : ''}`} disabled={off} onClick={() => toggle(k)} aria-pressed={on}>
              <span className="fp-art">{art ? <img src={art} alt="" /> : <span>{d.icon}</span>}</span>
              <b>{d.name}</b>
              <small>{off ? '바다 없음' : LAYER_NAME[d.layer]}</small>
              {on && <i className="fp-check">✓</i>}
            </button>
          );
        })}
      </div>
      <p className="small fp-count">
        고른 병과 <b>{sel.length}</b> / {PICK_MAX}
        {!canCapture && <span className="bad"> · 도심을 차지하려면 보병이나 전차가 꼭 있어야 해요</span>}
      </p>
      <button className="big" disabled={!sel.length || !canCapture} onClick={() => onDone(sel)}>
        ▶ 이 편성으로 출전
      </button>
    </div>
  );
}
