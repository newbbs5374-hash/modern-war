// 개인 → 일정: 오늘 3칸(오전·오후·저녁) + 활동 8가지. 한 화면.
import { headTitle } from '../game/nation';
import { useState } from 'react';
import { ACTS, SLOTS, actById, actMult, canAct, doAct, nextDayIn, scheduleOf } from '../game/schedule';
import { Card } from './common';
import { Help } from './kit';
import { timeLeft } from './officerScreens';
import type { ScreenProps } from './screens';

export function SchedulePanel({ state, actions }: ScreenProps) {
  const sc = scheduleOf(state);
  const [msg, setMsg] = useState('');
  const left = sc.slots.filter((x) => !x).length;
  return (
    <>
      <Card
        title={`오늘 ${headTitle(state.player.countryId)} 일정`}
        icon="📅"
        right={
          <Help title={`${headTitle(state.player.countryId)} 일정`}>
            <p>하루(실제 24시간)에 3칸까지 활동을 넣을 수 있어요. 넣는 순간 바로 효과가 나요.</p>
            <p>분야 점수 덤은 12시간 동안 이어져요. 같은 활동은 하루에 한 번만 할 수 있어요.</p>
            <p>지도자 스탯이 높을수록 효과가 커요(활동마다 보는 스탯이 달라요).</p>
          </Help>
        }
      >
        <div className="sch-slots">
          {SLOTS.map((name, i) => {
            const id = sc.slots[i];
            const a = id ? actById(id) : null;
            return (
              <div key={name} className={`sch-slot ${a ? 'on' : ''}`}>
                <small>{name}</small>
                <span className="sch-ico">{a ? a.icon : '＋'}</span>
                <small>{a ? a.name : '비어 있음'}</small>
              </div>
            );
          })}
        </div>
        <p className="small muted center">{left ? `남은 칸 ${left}개` : '오늘 일정 끝!'} · 새 하루까지 {timeLeft(nextDayIn(state))} · 지금까지 {sc.total}번</p>
        {msg && <p className="small sch-msg">{msg}</p>}
      </Card>
      <div className="sch-acts">
        {ACTS.map((a) => {
          const why = canAct(state, a.id);
          return (
            <button key={a.id} className="pw-act" disabled={!!why} onClick={() => setMsg(actions.applyWith((s) => { const r = doAct(s, a.id); return { state: r.state, out: r.text }; }) ?? '')}>
              <span className="pw-act-ico">{a.icon}</span>
              <span className="li-main">
                <b>{a.name}</b>
                <small>{a.text}</small>
                <small className="muted">
                  {a.stat} ×{actMult(state, a).toFixed(2)}
                  {why && sc.slots.includes(a.id) ? ' · ✅ 오늘 함' : ''}
                </small>
              </span>
            </button>
          );
        })}
      </div>
    </>
  );
}
