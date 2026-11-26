// 부관 임명 창(11-24): 병과를 고르고, 그 병과에 특화된 후보 4명 중 한 명을 조건 없이 임명.
import { useState } from 'react';
import { AIDE_SPECIALTIES, type AideSpecialty } from '../data/officers';
import { AIDE_EFFECT } from '../data/aideEffect';
import { AIDE_TRAITS, aideSeats, appointAide, canAppointAide, candLeftMs, candsOf, rerollCands, rerollsLeft, type AideCand } from '../game/aidePick';
import { AIDE_ICON } from './icons';
import { Face } from './Portrait';
import { Modal } from './kit';
import { timeLeft } from './officerScreens';
import type { ScreenProps } from './screens';

export function AidePickModal({ state, actions, onClose, first }: Pick<ScreenProps, 'state' | 'actions'> & { onClose: () => void; first?: AideSpecialty }) {
  const [sp, setSp] = useState<AideSpecialty>(first ?? AIDE_SPECIALTIES[0]);
  const [pickKey, setPickKey] = useState<string | null>(null);
  const [replaceId, setReplaceId] = useState<number | null>(null);
  const [msg, setMsg] = useState('');
  const o = state.officer;
  const seats = aideSeats(state);
  const full = o.aides.length >= seats;
  const cands = candsOf(state, sp);
  const pick = cands.find((c) => c.key === pickKey) ?? null;
  const why = pick ? canAppointAide(state, pick.key, replaceId) : null;
  const left = rerollsLeft(state);
  return (
    <Modal title="부관 임명" icon="🧑‍✈️" onClose={onClose}>
      <p className="small muted">
        병과를 고르고 마음에 드는 후보를 임명하세요. 조건·비용 없이 바로 임명돼요. 부관 {o.aides.length}/{seats}
      </p>
      <div className="field-pick">
        {AIDE_SPECIALTIES.map((s) => (
          <button
            key={s}
            className={`pw-act small-act ${sp === s ? 'on' : ''}`}
            onClick={() => {
              setSp(s);
              setPickKey(null);
              setMsg('');
            }}
          >
            <span className="pw-act-ico">{AIDE_ICON[s]}</span>
            <span className="li-main">
              <b>{s}</b>
              <small>{o.aides.filter((a) => a.specialty === s).length ? '✓ 있음' : `${candsOf(state, s).length}명`}</small>
            </span>
          </button>
        ))}
      </div>
      <p className="small">⚔️ {sp} 부관 전투 효과: {AIDE_EFFECT[sp]}</p>
      <div className="aide-cands">
        {cands.map((c) => (
          <CandRow key={c.key} c={c} on={pickKey === c.key} onClick={() => (setPickKey(c.key), setMsg(''))} />
        ))}
        {!cands.length && <p className="empty">이 병과 후보를 모두 임명했어요. {timeLeft(candLeftMs(state.worldMs))} 뒤 새 후보가 와요.</p>}
      </div>
      {pick && full && (
        <>
          <small className="muted">자리가 꽉 찼어요. {pick.name}과(와) 바꿀 부관을 고르세요.</small>
          <div className="buttons" style={{ flexWrap: 'wrap' }}>
            {o.aides.map((a) => (
              <button key={a.id} disabled={!!a.school} className={replaceId === a.id ? 'on gold' : ''} onClick={() => setReplaceId(a.id)}>
                {AIDE_ICON[a.specialty]} {a.name} <small>Lv.{a.level}</small>
              </button>
            ))}
          </div>
        </>
      )}
      <button
        className="gold wide"
        disabled={!pick || !!why}
        onClick={() => {
          if (!pick) return;
          const rep = full ? o.aides.find((a) => a.id === replaceId) : null;
          actions.apply((s) => appointAide(s, pick.key, replaceId));
          setMsg(`🧑‍✈️ ${pick.name}을(를) ${pick.specialty} 부관으로 임명했어요.${rep ? ` ${rep.name} 부관은 원래 부대로 돌아갔어요.` : ''}`);
          setPickKey(null);
          setReplaceId(null);
        }}
      >
        🧑‍✈️ {pick ? `${pick.name} ${full ? '교대 임명' : '임명'}` : '후보를 골라 주세요'}
      </button>
      {pick && why && !full && <p className="small muted">{why}</p>}
      {msg && <p className="small result">{msg}</p>}
      <div className="buttons" style={{ marginTop: 6 }}>
        <button style={{ flex: 1 }} disabled={left <= 0} onClick={() => (actions.apply(rerollCands), setPickKey(null), setMsg('📋 새 후보 명단을 받았어요.'))}>
          🔄 새 후보 받기 <small>무료 · {left}번 남음</small>
        </button>
      </div>
      <p className="small muted center">후보는 {timeLeft(candLeftMs(state.worldMs))} 뒤 저절로 새로 바뀌어요.</p>
    </Modal>
  );
}

function CandRow({ c, on, onClick }: { c: AideCand; on: boolean; onClick: () => void }) {
  const t = AIDE_TRAITS[c.trait];
  return (
    <button className={`pw-act aide-cand ${on ? 'on' : ''}`} onClick={onClick}>
      <span className="aide-cand-face">
        <Face keys={[c.faceKey]} fallback={AIDE_ICON[c.specialty]} />
      </span>
      <span className="li-main">
        <b>
          {c.name} <small className="muted">{c.age}세</small>
        </b>
        <small>
          {t.icon} {c.trait} · Lv.{c.level} · 💗{c.bond} · 🫡{c.loyalty}
        </small>
        <small className="muted">{c.career}</small>
        {on && <small className="muted">{t.text}</small>}
      </span>
    </button>
  );
}
