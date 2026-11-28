// 11-28 6단계: 외교 → 🌐 진영. 진영 세계(신냉전) · 진영 회의 · 대리전 · 기술 경주 · 강대국 내전
import { useState } from 'react';
import { countryById } from '../data/world';
import {
  CAMPS,
  CAMP_ACT,
  CONTRIB_PER_DAY,
  CONTRIB_PTS,
  LEADER_BUDGET,
  TOPICS,
  campLeader,
  campMembers,
  campOf,
  campsOn,
  canContribute,
  canSetTopic,
  canSwitch,
  canVoteCouncil,
  contribCost,
  contribute,
  liveCamps,
  setTopic,
  switchCamp,
  voteCouncil,
  type CampId,
  type TopicId,
} from '../game/camps';
import { PROXY_ACT, PROXY_KINDS, aiWars, backSide, canBack, proxyCost, proxyOf, proxyOn, type ProxyKind } from '../game/proxy';
import { RACES, RACE_ACT, RACE_NEED, canPush, canSteal, pushCost, pushRace, raceOf, raceOn, raceTop, stealRace } from '../game/techRace';
import { collapseOf, inCivilWar } from '../game/collapse';
import type { GameState } from '../game/state';
import { FLAG } from './flag';
import { Help, Meter } from './kit';
import { timeLeft } from './officerScreens';
import type { ScreenProps } from './screens';

const nm = (id: string) => countryById(id).name;
const won = (v: number) => v.toLocaleString('ko-KR');

export const campBadge = (s: GameState) => (s.camps?.council && s.camps.council.camp === campOf(s, s.player.countryId) && !s.camps.council.vote ? '!' : null);

export function WorldOrderPanel({ state, actions }: ScreenProps) {
  const [said, setSaid] = useState('');
  const run = (f: (s: GameState) => { state: GameState; text: string }) => setSaid(actions.applyWith((s) => { const r = f(s); return { state: r.state, out: r.text }; }) ?? '');
  return (
    <>
      {said && (
        <section className="card">
          <p className="small">{said}</p>
        </section>
      )}
      <CampCard state={state} run={run} />
      <ProxyCard state={state} run={run} />
      <RaceCard state={state} run={run} />
    </>
  );
}

type Run = (f: (s: GameState) => { state: GameState; text: string }) => void;

function CampCard({ state, run }: { state: GameState; run: Run }) {
  const me = state.player.countryId;
  const head = (
    <div className="row">
      <b>🌐 진영 세계(신냉전)</b>
      <Help title="진영 세계">
        <p>{CAMP_ACT}장이 열리면 세계가 진영으로 갈려요. 진영 안에서 기여 점수 1등이 <b>맹주</b>예요. 맹주는 나라 예산 +{Math.round(LEADER_BUDGET * 100)}% · 외교 +5 · 세계 영향력 +20, 진영 회의에서 표 3장과 안건을 정할 권한을 가져요.</p>
        <p>진영 회의는 실제 48시간마다 12시간 열려요(공동 제재 · 공동 방위 · 기술 공유 · 맹주 신임). 같은 진영끼리는 긴장이 풀리고, 두 큰 진영 맹주끼리는 긴장이 쌓여요.</p>
        <p>진영은 7일에 한 번 바꿀 수 있지만, 옛 진영은 배신으로 봐요(호감 −12, 맹주였으면 −20 · 명성 −30). 새 진영은 입단 선물을 줘요.</p>
        <p>크게 진 강대국은 내전에 빠지고, 그러면 작은 나라들이 '신흥 연합'을 만들어요.</p>
      </Help>
    </div>
  );
  if (!state.camps || !campsOn(state))
    return (
      <section className="card">
        {head}
        <p className="small muted">{CAMP_ACT}장이 열리면 세계가 진영으로 갈려요.</p>
      </section>
    );
  const c = state.camps;
  const mine = c.member[me];
  const o = c.council;
  const civil = Object.entries(collapseOf(state).list).filter(([id]) => inCivilWar(state, id));
  return (
    <>
      <section className="card">
        {head}
        <div className="camp-grid">
          {liveCamps(state).map((k) => {
            const list = campMembers(state, k).sort((a, b) => (c.pts[b] ?? 0) - (c.pts[a] ?? 0));
            const lead = campLeader(state, k);
            const top = c.pts[lead ?? ''] ?? 1;
            return (
              <div key={k} className={`camp-box ${k === mine ? 'mine' : ''}`} style={{ borderColor: CAMPS[k].color }}>
                <div className="row">
                  <b>
                    {CAMPS[k].icon} {CAMPS[k].name}
                  </b>
                  <small className="muted">{list.length}개국</small>
                </div>
                {lead && (
                  <small>
                    👑 맹주 {FLAG[lead] ?? ''} {nm(lead)}
                    {lead === me ? ' (우리)' : ''}
                  </small>
                )}
                <div className="camp-flags">
                  {list.map((id) => (
                    <span key={id} title={`${nm(id)} 기여 ${Math.round(c.pts[id] ?? 0)}`} className={id === me ? 'me' : ''}>
                      {FLAG[id] ?? '🏳️'}
                    </span>
                  ))}
                </div>
                {k === mine && (
                  <div className="promo-line">
                    <small>우리 기여</small>
                    <Meter value={c.pts[me] ?? 0} max={Math.max(top, c.pts[me] ?? 0)} tone="gold" />
                    <small className="muted">{Math.round(c.pts[me] ?? 0)}/{Math.round(top)}</small>
                  </div>
                )}
                {k !== mine && (
                  <button disabled={!!canSwitch(state, k)} title={canSwitch(state, k) ?? ''} onClick={() => run((s) => switchCamp(s, k as CampId))}>
                    🔀 이 진영으로 옮기기
                  </button>
                )}
              </div>
            );
          })}
        </div>
        <button className="wide gold" disabled={!!canContribute(state)} onClick={() => run(contribute)}>
          🤝 진영에 기여 +{CONTRIB_PTS} · {canContribute(state) ?? `나라 예산 −${won(contribCost(state))} (하루 ${CONTRIB_PER_DAY}번)`}
        </button>
        {state.worldMs < c.switchMs && <p className="small muted">진영 바꾸기까지 {timeLeft(c.switchMs - state.worldMs)}</p>}
        {civil.length > 0 && <p className="small warn">💥 내전 중: {civil.map(([id, x]) => `${nm(id)}(${timeLeft(x.untilMs - state.worldMs)})`).join(' · ')}</p>}
      </section>
      <section className="card">
        <div className="row">
          <b>🗳️ 진영 회의</b>
          <small className="muted">{o ? `${CAMPS[o.camp].name} · 끝나기까지 ${timeLeft(o.endMs - state.worldMs)}` : `다음 회의까지 ${timeLeft(c.councilMs - state.worldMs)}`}</small>
        </div>
        {o ? (
          <>
            <p className="small">
              안건 <b>{TOPICS[o.topic].icon} {TOPICS[o.topic].name}</b>
              {o.target ? ` (대상 ${nm(o.target)})` : ''}: {TOPICS[o.topic].text}
            </p>
            {o.vote && <p className="small ok">우리는 {o.vote === 'yes' ? '찬성' : '반대'}했어요.</p>}
            {!canSetTopic(state) && (
              <div className="row wrap" style={{ gap: 4 }}>
                {(Object.keys(TOPICS) as TopicId[]).map((k) => (
                  <button key={k} className={k === o.topic ? 'primary' : ''} onClick={() => run((s) => setTopic(s, k))}>
                    {TOPICS[k].icon} {TOPICS[k].name}
                  </button>
                ))}
              </div>
            )}
            {!canVoteCouncil(state) ? (
              <div className="row" style={{ gap: 6 }}>
                <button className="primary" onClick={() => run((s) => voteCouncil(s, 'yes'))}>
                  👍 찬성
                </button>
                <button className="danger" onClick={() => run((s) => voteCouncil(s, 'no'))}>
                  👎 반대
                </button>
              </div>
            ) : (
              !o.vote && <p className="small muted">{canVoteCouncil(state)}</p>
            )}
          </>
        ) : (
          <p className="small muted">회의가 열리면 본부 보고로 알려 드려요.</p>
        )}
      </section>
    </>
  );
}

function ProxyCard({ state, run }: { state: GameState; run: Run }) {
  const [kind, setKind] = useState<ProxyKind>('arms');
  const wars = aiWars(state).slice(0, 8);
  const p = proxyOf(state);
  return (
    <section className="card">
      <div className="row">
        <b>🎭 대리전</b>
        <Help title="대리전">
          <p>다른 나라끼리 싸울 때 한쪽에 무기·돈·정보를 몰래 대 줘요. 우리 피는 흘리지 않고 상대를 약하게 만들어요.</p>
          <p>지원할 때마다 15% 확률로 상대에게 들켜요(호감 −8 · 긴장 +10). 전쟁이 끝났을 때 우리가 도운 나라가 도시를 더 얻었으면 💎 +10 · 그 나라 호감 +15 · 광물 이권 14일(자원 +5%) · 세계 영향력 +10을 받아요.</p>
        </Help>
        <small className="muted">이긴 대리전 {p.wins}번 · 광물 이권 {p.rights.filter((r) => r.untilMs > state.worldMs).length}곳</small>
      </div>
      {!proxyOn(state) ? (
        <p className="small muted">{PROXY_ACT}장부터 열려요.</p>
      ) : !wars.length ? (
        <p className="small muted">지금 다른 나라끼리 하는 전쟁이 없어요.</p>
      ) : (
        <>
          <div className="row wrap" style={{ gap: 4 }}>
            {(Object.keys(PROXY_KINDS) as ProxyKind[]).map((k) => (
              <button key={k} className={k === kind ? 'primary' : ''} onClick={() => setKind(k)}>
                {PROXY_KINDS[k].icon} {PROXY_KINDS[k].name} <small>{won(proxyCost(state, k))}</small>
              </button>
            ))}
          </div>
          <p className="small muted">{PROXY_KINDS[kind].text}</p>
          {wars.map((w) => {
            const one = p.list[w.key];
            return (
              <div key={w.key} className="row wrap proxy-row" style={{ gap: 6 }}>
                {[w.a, w.b].map((side, i) => {
                  const foe = i ? w.a : w.b;
                  const why = canBack(state, side, foe, kind);
                  return (
                    <button key={side} className={one?.side === side ? 'gold' : ''} disabled={!!why} title={why ?? ''} onClick={() => run((s) => backSide(s, side, foe, kind))}>
                      {FLAG[side] ?? ''} {nm(side)} 돕기{one?.side === side ? ` (${one.n}번)` : ''}
                    </button>
                  );
                })}
                <small className="muted">⚔️</small>
              </div>
            );
          })}
        </>
      )}
    </section>
  );
}

function RaceCard({ state, run }: { state: GameState; run: Run }) {
  const me = state.player.countryId;
  const r = raceOf(state);
  return (
    <section className="card">
      <div className="row">
        <b>🏁 기술 경주</b>
        <Help title="기술 경주">
          <p>초지능 AI · 우주 정거장 · 핵융합 · 초음속 여객기를 세계에서 먼저 {RACE_NEED}점 채운 나라만 영구 보너스와 세계 영향력 +25를 받아요. 다른 나라도 경제·기술만큼 스스로 나아가요.</p>
          <p>하루 3번 나라 예산을 부어 밀어붙이고(연구한 기술이 많을수록 더 많이), 12시간에 한 번 1등 나라의 연구를 훔칠 수 있어요(55%, 실패하면 호감 −10 · 긴장 +12).</p>
        </Help>
      </div>
      {!raceOn(state) ? (
        <p className="small muted">{RACE_ACT}장부터 열려요.</p>
      ) : (
        RACES.map((d) => {
          const top = raceTop(state, d.id);
          const lead = top[0];
          const mine = r.pts[d.id]?.[me] ?? 0;
          const win = r.winner[d.id];
          return (
            <div key={d.id} className="race-row">
              <div className="row">
                <b className="small">
                  {d.icon} {d.name}
                </b>
                <small className="muted">상: {d.prize}</small>
              </div>
              {win ? (
                <p className={`small ${win === me ? 'ok' : 'muted'}`}>🏆 {win === me ? '우리가 세계 최초!' : `${nm(win)}이(가) 먼저 완성`}</p>
              ) : (
                <>
                  <div className="promo-line">
                    <small>우리</small>
                    <Meter value={mine} max={RACE_NEED} tone="gold" />
                    <small className="muted">{Math.round(mine)}</small>
                  </div>
                  {lead && lead.id !== me && (
                    <div className="promo-line">
                      <small>{FLAG[lead.id] ?? ''} 1등</small>
                      <Meter value={lead.v} max={RACE_NEED} />
                      <small className="muted">{Math.round(lead.v)}</small>
                    </div>
                  )}
                  <div className="row" style={{ gap: 6 }}>
                    <button disabled={!!canPush(state, d.id)} title={canPush(state, d.id) ?? ''} onClick={() => run((s) => pushRace(s, d.id))}>
                      🔬 밀어붙이기 <small>{won(pushCost(state))}</small>
                    </button>
                    <button disabled={!!canSteal(state, d.id)} title={canSteal(state, d.id) ?? ''} onClick={() => run((s) => stealRace(s, d.id))}>
                      🕵️ 훔치기
                    </button>
                  </div>
                </>
              )}
            </div>
          );
        })
      )}
    </section>
  );
}
