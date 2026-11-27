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
import { CATCH_FAME, CATCH_INTEL, LEAK_RESEARCH, LEAK_SPY, MOLE_SPOTS, arrest, canClue, clueCost, findClue, moleOf } from '../game/mole';
import { SPY_OPS, canSpy, scoutView, spyChance, spyOf, spyOpById, spyTeams, startSpy } from '../game/spy';

export function SpyPanel({ state, actions }: ScreenProps) {
  const me = state.player.countryId;
  const sp = spyOf(state);
  const others = COUNTRIES.filter((c) => c.id !== me && isAlive(state.world, c.id));
  const [target, setTarget] = useState<string>(() => others[0]?.id ?? '');
  const view = target ? scoutView(state, target) : null;
  const mole = moleOf(state);
  const [mmsg, setMmsg] = useState('');
  const noClue = canClue(state);
  return (
    <>
      <Card title="🛡️ 방첩" right={<small className="muted">잡음 {mole.caught} · 놓침 {mole.missed}</small>}>
        {mole.open ? (
          <>
            <p className="small asm-vote">
              🚨 부처 어딘가에 첩자가 있어요 · {timeLeft(Math.max(0, mole.open.untilMs - state.worldMs))} 뒤 달아나요 · 연구 {Math.round(LEAK_RESEARCH * 100)}% · 첩보 성공 {Math.round(LEAK_SPY * 100)}%
            </p>
            <div className="mole-spots">
              {MOLE_SPOTS.map((sp2, i) => {
                const clear = mole.open!.clear.includes(i);
                return (
                  <button key={sp2.name} className={clear ? 'clear' : ''} disabled={clear} onClick={() => setMmsg(actions.applyWith((s) => { const r = arrest(s, i); return { state: r.state, out: r.text }; }) ?? '')}>
                    <span>{clear ? '✅' : sp2.icon}</span>
                    <b>{sp2.name}</b>
                    <small>{clear ? '결백' : '체포하기'}</small>
                  </button>
                );
              })}
            </div>
            <button className="gold wide" disabled={!!noClue} onClick={() => setMmsg(actions.applyWith((s) => { const r = findClue(s); return { state: r.state, out: r.text }; }) ?? '')}>
              🔎 조사하기 · 💰{fmt(clueCost(state))}
              {noClue && state.worldMs < mole.open.clueMs ? ` · ${timeLeft(mole.open.clueMs - state.worldMs)} 뒤` : ''}
            </button>
            <p className="small muted">조사하면 결백한 부처가 하나씩 지워져요(4시간마다 한 번). 맞게 체포하면 정보 +{CATCH_INTEL} · 명성 +{CATCH_FAME}, 틀리면 신뢰도 −3 · 지지도 −2.</p>
          </>
        ) : (
          <p className="small muted">지금은 숨어든 첩자가 없어요. 적 첩자가 들어오면 부관이 알려요.</p>
        )}
        {mmsg && <p className="small sch-msg">{mmsg}</p>}
      </Card>
      <Card title="🕵️ 첩보 본부" right={<small className="muted">공작 팀 {sp.active.length}/{spyTeams(state)}</small>}>
        <p className="small">
          🕵️ 정보 점수 <b>{fmt(state.officer.intel)}</b> · 💰 나라 예산 <b>{fmt(state.nations[me].treasury)}</b>
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
            🛰️ 정찰 중({timeLeft(view.untilMs - state.worldMs)}): 나라 예산 {fmt(view.treasury)} · 병력 {fmt(view.troops)}
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
