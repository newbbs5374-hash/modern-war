// 부관 → 장군: 인연·충성 막대, 장군 교육, 병과를 골라 임명. 장교 탭 부관 팝업과 인물 창이 함께 씀.
import { useState } from 'react';
import { GENERAL_FIELDS } from '../data/officers';
import {
  FIELD_ICON,
  FIELD_TEXT,
  LOYALTY_HIGH,
  LOYALTY_LOW,
  SCHOOL_BOND,
  SCHOOL_HOURS,
  SCHOOL_LEVEL,
  SCHOOL_LOYALTY,
  appointGeneral,
  appointSkill,
  bondStage,
  canAppoint,
  canSchool,
  loyaltyMood,
  loyaltyOf,
  schoolCost,
  startSchool,
  type GeneralField,
} from '../game/loyal';
import type { Aide } from '../game/officer';
import type { GameState } from '../game/state';
import { fmt } from './common';
import { Meter } from './kit';
import { timeLeft } from './officerScreens';

/** 인연·충성 두 줄 막대와 지금 상태 */
export function BondLoyalty({ a }: { a: Aide }) {
  const st = bondStage(a.bond);
  const lv = Math.round(loyaltyOf(a));
  const mood = loyaltyMood(lv);
  return (
    <div className="bond-box">
      <div className="promo-line">
        <small>💗 인연</small>
        <Meter value={a.bond} max={100} tone="red" />
        <small className="muted">
          {Math.round(a.bond)} {st.icon}
          {st.name}
        </small>
      </div>
      <div className="promo-line">
        <small>🫡 충성</small>
        <Meter value={lv} max={100} tone={lv >= LOYALTY_LOW ? 'green' : 'red'} />
        <small className="muted">
          {lv} {mood.icon}
          {mood.name}
        </small>
      </div>
      <p className="small muted">
        {mood.text} 인연이 깊을수록, 의회 신뢰가 높을수록 충성이 올라요. 하루 넘게 돌보지 않으면 인연이 줄어요.
        {lv < LOYALTY_HIGH ? ` 충성 ${LOYALTY_HIGH}부터 '충직'.` : ''}
      </p>
    </div>
  );
}

/** 장군 교육 → 임명 */
export function AideCareer({ state, a, apply, onDone }: { state: GameState; a: Aide; apply: (f: (s: GameState) => GameState) => void; onDone?: (text: string) => void }) {
  const [field, setField] = useState<GeneralField | null>(null);
  const r = state.player.rankIndex;
  const sWhy = canSchool(state, a.id);
  const aWhy = canAppoint(state, a.id);
  const conds = [
    { k: `Lv.${SCHOOL_LEVEL}`, ok: a.level >= SCHOOL_LEVEL },
    { k: `인연 ${SCHOOL_BOND}`, ok: a.bond >= SCHOOL_BOND },
    { k: `충성 ${SCHOOL_LOYALTY}`, ok: loyaltyOf(a) >= SCHOOL_LOYALTY },
  ];
  return (
    <div className="career-box">
      <small className="muted">⭐ 장군으로 키우기</small>
      {a.school ? (
        <p className="small center">
          🎓 장군 교육 중 · {timeLeft(a.school.endMs - state.worldMs)} 남음(그동안 전투·임무에 못 나가요)
        </p>
      ) : !a.schooled ? (
        <>
          <p className="small">
            조건: {conds.map((c) => `${c.ok ? '✅' : '⬜'} ${c.k}`).join(' · ')}
          </p>
          <button className="wide" disabled={!!sWhy} onClick={() => (apply((s) => startSchool(s, a.id)), onDone?.(`🎓 ${a.name} 장군 교육 시작(${SCHOOL_HOURS}시간)`))}>
            🎓 장군 교육 보내기 <small>💵{fmt(schoolCost(r))} · {SCHOOL_HOURS}시간</small>
          </button>
          {sWhy && <p className="small muted">{sWhy}</p>}
        </>
      ) : (
        <>
          <p className="small">🎓 교육을 마쳤어요. 맡길 병과를 골라 임명하세요(능력 {appointSkill(a)}/10).</p>
          <div className="field-pick">
            {GENERAL_FIELDS.map((f) => (
              <button key={f} className={`pw-act small-act ${field === f ? 'on' : ''}`} onClick={() => setField(f)}>
                <span className="pw-act-ico">{FIELD_ICON[f]}</span>
                <span className="li-main">
                  <b>{f}</b>
                </span>
              </button>
            ))}
          </div>
          {field && <p className="small muted">{FIELD_TEXT[field]}</p>}
          <button className="gold wide" disabled={!!aWhy || !field} onClick={() => field && (apply((s) => appointGeneral(s, a.id, field)), onDone?.(`⭐ ${a.name}을(를) ${field} 장군으로 임명했어요.`))}>
            ⭐ {field ?? '병과'} 장군으로 임명
          </button>
          {aWhy && <p className="small muted">{aWhy}</p>}
        </>
      )}
    </div>
  );
}
