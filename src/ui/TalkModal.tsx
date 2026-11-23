import { useState } from 'react';
import { countryById } from '../data/world';
import type { GameState } from '../game/state';
import { ATTITUDE_ICON, answerTalk, choiceChance, choiceLocked, effectHint, moodName, worldMood, type Talk } from '../game/talk';
import { relationOf } from '../game/world';
import { Modal } from './kit';
import { FLAG } from './flag';
import type { GameActions } from './screens';
import { timeLeft } from './officerScreens';
import { aideKeys } from './Portrait';
import { PersonFace } from './People';
import type { PersonRef } from '../game/people';

/** 대화 상대 사진: 부관이면 이름 → 분야 → 기본 부관 */
function talkFaceKeys(state: GameState, t: Talk): (string | undefined)[] {
  if (t.face?.startsWith('aide')) {
    const a = state.officer.aides.find((x) => `aide-${x.name}` === t.face);
    return a ? aideKeys(a) : [t.face, 'aide'];
  }
  return [t.face];
}

/** 대화 상대 → 인물 창 */
function talkWho(state: GameState, t: Talk): PersonRef {
  if (t.face?.startsWith('aide')) {
    const a = state.officer.aides.find((x) => `aide-${x.name}` === t.face);
    if (a) return { kind: 'aide', id: a.id };
  }
  if (t.face === 'envoy' || t.face === 'coastguard' || t.face === 'settler') return { kind: 'npc', role: t.face, country: t.who };
  return { kind: 'leader', country: t.who };
}

/** 세계 흐름 막대(평화 개척 → 냉전 → 국지전 → 대전쟁) */
export function MoodBar({ state }: { state: GameState }) {
  const m = worldMood(state.world);
  const n = moodName(m);
  return (
    <div className="mood">
      <div className="mood-head">
        <b>
          {n.icon} 세계 흐름: {n.name}
        </b>
        <small>{m} / 100</small>
      </div>
      <div className="mood-bar">
        <span style={{ left: `${m}%` }} />
      </div>
      <small className="muted">{n.text}</small>
    </div>
  );
}

export function TalkModal({ state, actions, onClose }: { state: GameState; actions: GameActions; onClose: () => void }) {
  const talks = state.officer.talks ?? [];
  const [pick, setPick] = useState<number | null>(talks[0]?.id ?? null);
  const [result, setResult] = useState<{ ok: boolean; text: string; hint: string; who: string } | null>(null);
  const t = talks.find((x) => x.id === pick) ?? null;

  const answer = (talk: Talk, i: number) => {
    const out = actions.applyWith((s) => answerTalk(s, talk.id, i));
    if (out) {
      setResult({ ...out, who: talk.speaker });
      const next = talks.find((x) => x.id !== talk.id);
      setPick(next?.id ?? null);
    }
  };

  return (
    <Modal title="대화" icon="💬" onClose={onClose}>
      <MoodBar state={state} />
      {result && (
        <div className={`talk-result ${result.ok ? 'ok' : 'bad'}`}>
          <b>{result.ok ? '✅' : '❌'} {result.text}</b>
          {result.hint && <small>{result.hint}</small>}
        </div>
      )}
      {talks.length === 0 && <p className="small muted">지금은 기다리는 대화가 없어요. 몇 시간마다 지도자·사절·부관이 찾아와요.</p>}
      {talks.length > 1 && (
        <div className="talk-tabs">
          {talks.map((x) => (
            <button key={x.id} className={x.id === pick ? 'on' : ''} onClick={() => (setPick(x.id), setResult(null))}>
              {x.icon} {x.kind}
            </button>
          ))}
        </div>
      )}
      {t && (
        <div className="talk">
          <div className="talk-who">
            <span className="talk-face">
              <PersonFace who={talkWho(state, t)} keys={talkFaceKeys(state, t)} fallback={t.icon} />
            </span>
            <span>
              <b>{t.speaker}</b>
              <small className="muted">
                {FLAG[t.who]} {countryById(t.who).name} · 지금 {relationOf(state.world, state.player.countryId, t.who)} · 답할 시간 {timeLeft(t.untilMs - state.worldMs)}
              </small>
            </span>
          </div>
          <p className="talk-text">{t.text}</p>
          <div className="talk-choices">
            {t.choices.map((c, i) => {
              const lock = choiceLocked(state.officer, c);
              const p = choiceChance(state, c);
              return (
                <button key={i} className="talk-choice" disabled={!!lock} onClick={() => answer(t, i)}>
                  <span className="talk-att">
                    {ATTITUDE_ICON[c.att]}
                    <small>{c.att}</small>
                  </span>
                  <span className="talk-main">
                    <b>{c.label}</b>
                    <small>
                      {lock ? `🔒 ${lock}` : p >= 1 ? '반드시' : `성공 ${Math.round(p * 100)}%`}
                      {c.stat && !lock && p < 1 ? ` (${c.stat})` : ''} · {effectHint(c.ok)}
                    </small>
                    {c.fail && !lock && <small className="warn">실패하면: {effectHint(c.fail) || '효과 없음'}</small>}
                  </span>
                </button>
              );
            })}
          </div>
          <small className="muted">답하지 않으면: {t.ignore.text}</small>
        </div>
      )}
    </Modal>
  );
}
