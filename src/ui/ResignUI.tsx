// 11/28 장관 사직 요청 카드(📨 보고 화면).
import { useState } from 'react';
import { ministryById } from '../data/cabinet';
import { RESIGN_KEEP_COST, RESIGN_WHY, acceptResign, canKeep, keepChance, keepResign, resignPerson } from '../game/resign';
import type { GameState } from '../game/state';
import { PersonFace } from './CabinetUI';
import { Card } from './common';
import { timeLeft } from './officerScreens';

export function ResignCard({ state, apply }: { state: GameState; apply: (f: (s: GameState) => GameState) => void }) {
  const [msg, setMsg] = useState('');
  const a = state.resign?.ask;
  const p = resignPerson(state);
  if (!a || !p) return msg ? <p className="small result">{msg}</p> : null;
  const w = RESIGN_WHY[a.why];
  const min = p.seat ? ministryById(p.seat.id).name : '';
  const why = canKeep(state);
  return (
    <Card
      title={`사직 요청 · ${w.icon} ${w.name}`}
      icon="📄"
      right={<b className="dom-warn">⏱ {timeLeft(a.untilMs - state.worldMs)}</b>}
      help={<p>장관이 개인 사정·건강·비리 같은 까닭으로 가끔 사표를 내요. 수리하면 자리가 비고 인재 명단에 새 후보가 들어와요. 만류는 충성이 높을수록 잘 되고, 비리 의혹인데 붙잡으면 감싸기 논란으로 지지도가 내려가요. 12시간 안에 정하지 않으면 그대로 수리해요.</p>}
    >
      <div className="resign-row">
        <PersonFace p={p} size={56} />
        <div>
          <b>
            {p.name} <small className="muted">{min} 장관 · {p.age}세 · 충성 {Math.round(p.loyalty)}</small>
          </b>
          <p className="small">"{a.text}"</p>
        </div>
      </div>
      <div className="resign-btns">
        <button
          onClick={() => {
            apply(acceptResign);
            setMsg(`📄 ${p.name} 장관의 사표를 수리했어요. ${min} 장관 자리를 새로 채워 주세요.`);
          }}
        >
          📄 사직 수리
        </button>
        <button
          className="gold"
          disabled={!!why}
          title={why ?? ''}
          onClick={() => {
            let ok = false;
            apply((s) => {
              const r = keepResign(s);
              ok = r.ok;
              return r.state;
            });
            setMsg(ok ? `🤝 ${p.name} 장관을 붙잡았어요.` : `🚪 만류했지만 ${p.name} 장관은 떠났어요.`);
          }}
        >
          🤝 만류 {Math.round(keepChance(state) * 100)}% <small>봉급 {RESIGN_KEEP_COST}</small>
        </button>
      </div>
    </Card>
  );
}
