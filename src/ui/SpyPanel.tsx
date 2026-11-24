// 작전 → 첩보 탭: 공작원 보내기
import { BoostBar } from './BoostBar';
import { useState } from 'react';
import { Card, fmt } from './common';
import { FLAG } from './flag';
import { timeLeft } from './officerScreens';
import type { ScreenProps } from './screens';
import { COUNTRIES, countryById } from '../data/world';
import { RANKS } from '../data/ranks';
import { isAlive, relationOf } from '../game/world';
import { SPY_OPS, canSpy, scoutView, spyChance, spyOf, spyOpById, spyTeams, startSpy } from '../game/spy';

export function SpyPanel({ state, actions }: ScreenProps) {
  const me = state.player.countryId;
  const sp = spyOf(state);
  const others = COUNTRIES.filter((c) => c.id !== me && isAlive(state.world, c.id));
  const [target, setTarget] = useState<string>(() => others[0]?.id ?? '');
  const view = target ? scoutView(state, target) : null;
  return (
    <>
      <Card title="🕵️ 첩보 본부" right={<small className="muted">공작 팀 {sp.active.length}/{spyTeams(state)}</small>}>
        <p className="small">
          🕵️ 정보 점수 <b>{fmt(state.officer.intel)}</b> · 💰 국방예산 <b>{fmt(state.nations[me].treasury)}</b>
        </p>
        <p className="small muted">정보 점수는 부관 "정보 수집" 심부름과 정찰 임무로 모여요. 실패하면 들킨 나라가 우리를 미워하고 긴장이 올라요.</p>
        {sp.active.map((m) => {
          const d = spyOpById(m.op);
          const pct = Math.min(100, ((state.worldMs - m.startMs) / (m.endMs - m.startMs)) * 100);
          return (
            <div key={m.id} className="list-row small">
              <span style={{ flex: 1 }}>
                {d.icon} {d.name} → {FLAG[m.target]} {countryById(m.target).name}
                <span className="bar">
                  <span className="bar-fill" style={{ width: `${pct}%` }} />
                </span>
              </span>
              <span className="muted">{timeLeft(m.endMs - state.worldMs)}</span>
              <BoostBar state={state} apply={actions.apply} target={{ kind: 'spy', id: m.id }} compact />
            </div>
          );
        })}
      </Card>

      <Card title="어느 나라에?">
        <div className="spy-targets">
          {others.map((c) => (
            <button key={c.id} className={`spy-target ${target === c.id ? 'on' : ''}`} onClick={() => setTarget(c.id)}>
              {FLAG[c.id]}
              <small>{c.name}</small>
              <i className={`rel rel-${relationOf(state.world, me, c.id)}`}>{relationOf(state.world, me, c.id)}</i>
            </button>
          ))}
        </div>
        {view && (
          <p className="small result">
            🛰️ 정찰 중({timeLeft(view.untilMs - state.worldMs)}): 국방예산 {fmt(view.treasury)} · 병력 {fmt(view.troops)}
          </p>
        )}
      </Card>

      {target && (
        <Card title={`작전 고르기 · ${countryById(target).name}`}>
          {SPY_OPS.map((d) => {
            const why = canSpy(state, d.id, target);
            const locked = state.player.rankIndex < d.rank;
            return (
              <div key={d.id} className={`list-row small ${locked ? 'muted' : ''}`}>
                <span style={{ flex: 1 }}>
                  {d.icon} <b>{d.name}</b> · {d.hours}시간 · 성공 {Math.round(spyChance(state, d.id, target) * 100)}%
                  <br />
                  <span className="muted">{locked ? `🔒 ${RANKS[d.rank].name}부터` : d.text}</span>
                </span>
                <button disabled={!!why} title={why ?? ''} onClick={() => actions.apply((s) => startSpy(s, d.id, target))}>
                  🕵️{d.intel} · 💰{fmt(d.money)}
                </button>
              </div>
            );
          })}
        </Card>
      )}

      {sp.log.length > 0 && (
        <Card title="최근 첩보 결과" right={<small className="muted">성공 {sp.ok}/{sp.done}</small>}>
          {sp.log.map((t, i) => (
            <p key={i} className="small list-row">
              {t}
            </p>
          ))}
        </Card>
      )}
    </>
  );
}
