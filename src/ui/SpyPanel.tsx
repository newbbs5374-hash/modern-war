// 작전 → 첩보 탭: 공작원 보내기
import { BoostBar } from './BoostBar';
import { useState } from 'react';
import { routeTo } from './nav';
import { Card, fmt } from './common';
import { FLAG } from './flag';
import { timeLeft } from './officerScreens';
import type { ScreenProps } from './screens';
import { COUNTRIES, countryById } from '../data/world';
import { RANKS } from '../data/ranks';
import { isAlive, relationOf } from '../game/world';
import { CATCH_FAME, CATCH_INTEL, LEAK_RESEARCH, LEAK_SPY, MOLE_SPOTS, arrest, canClue, clueCost, findClue, moleOf } from '../game/mole';
import { INTEL_BONUS, SPY_OPS, canPick, canSpy, intelFresh, missionOdds, missionStep, pickCost, pickStep, scoutView, spyChance, spyOf, spyOpById, spyTeams, startSpy, type SpyMission } from '../game/spy';
import { LV_MAX, PICKS, SKILLS, STEP_ART, TRAITS, powerOf, statsOf, agentById, agentLook, bestAgent, canSwap, hasSteps, ransomOf, stepNames, stepText, type Agent, type StepPick } from '../game/agents';
import { canPayRansom } from '../game/shadow';
import { countryFaceUrl, portraitUrl, youngFaceUrl } from './Portrait';
import { agentArt } from './scenes';
import type { GameState } from '../game/state';

export function SpyPanel({ state, actions, go }: ScreenProps) {
  const me = state.player.countryId;
  const sp = spyOf(state);
  const others = COUNTRIES.filter((c) => c.id !== me && isAlive(state.world, c.id));
  const [target, setTarget] = useState<string>(() => others[0]?.id ?? '');
  const view = target ? scoutView(state, target) : null;
  const mole = moleOf(state);
  const [mmsg, setMmsg] = useState('');
  const noClue = canClue(state);
  const pickAgent: number | undefined = undefined;
  return (
    <>
      <Card title="🕶️ 블랙 요원은 그림자실로">
        <p className="small muted">정적 처리·기술 탈취·기지 폭파처럼 공식으로는 못 하는 일은 개인 → 🕶️ 그림자실에서 블랙 요원에게 맡겨요. 여기는 정보기관의 공식 작전(정찰·소문·방해)만 해요.</p>
        <button className="wide" onClick={() => go(routeTo('personal', 'personal', 'shadow'))}>🕶️ 그림자실로 가기</button>
      </Card>
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
        {sp.active.filter((m) => !spyOpById(m.op).shadow).map((m) => {
          const d = spyOpById(m.op);
          const pct = Math.min(100, ((state.worldMs - m.startMs) / (m.endMs - m.startMs)) * 100);
          return (
            <div key={m.id} className={`list-row small ${m.agent != null ? 'agent-mrow' : ''}`}>
              <span style={{ flex: 1 }}>
                {d.icon} {d.name} → {FLAG[m.target]} {countryById(m.target).name}{m.agent != null && agentById(state, m.agent) ? ` · "${agentById(state, m.agent)!.code}"` : ''}
                <span className="bar">
                  <span className="bar-fill" style={{ width: `${pct}%` }} />
                </span>
              </span>
              <span className="muted">{timeLeft(m.endMs - state.worldMs)}</span>
              <BoostBar state={state} apply={actions.apply} target={{ kind: 'spy', id: m.id }} compact />
              {m.agent != null && <MissionSteps m={m} state={state} pick={(p) => actions.apply((s) => pickStep(s, m.id, p))} />}
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
            🛰️ 정찰 중({timeLeft(view.untilMs - state.worldMs)}): 나라 예산 {fmt(view.treasury)} · 병력 {fmt(view.troops)} · 정보 신선도 {Math.round(intelFresh(state, target!) * 100)}%(다른 공작 성공 +{Math.round(INTEL_BONUS * intelFresh(state, target!) * 100)}%p)
          </p>
        )}
        {target && !view && <p className="small muted">🗂️ 이 나라 정보가 낡았어요. 정찰부터 하면 다른 공작 성공률이 최대 +{Math.round(INTEL_BONUS * 100)}%p 올라요.</p>}
      </Card>

      {target && (
        <Card title={`작전 고르기 · ${countryById(target).name}`}>
          {SPY_OPS.filter((d) => !d.shadow).map((d) => {
            const why = canSpy(state, d.id, target, hasSteps(d.id) ? pickAgent : undefined);
            const who = hasSteps(d.id) ? bestAgent(state, d.id) : undefined;
            const locked = state.player.rankIndex < d.rank;
            return (
              <div key={d.id} className={`list-row small ${locked ? 'muted' : ''}`}>
                <span style={{ flex: 1 }}>
                  {d.icon} <b>{d.name}</b> · {d.hours}시간 · 성공 {Math.round(spyChance(state, d.id, target, who?.id) * 100)}%{who ? ` · "${who.code}"` : ''}
                  <br />
                  <span className="muted">{locked ? `🔒 ${RANKS[d.rank].name}부터` : d.text}</span>
                </span>
                <button disabled={!!why} title={why ?? ''} onClick={() => actions.apply((s) => startSpy(s, d.id, target, pickAgent))}>
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

const STATUS: Record<Agent['status'], { t: string; c: string }> = {
  idle: { t: '대기', c: '' },
  busy: { t: '작전 중', c: 'am' },
  hurt: { t: '부상', c: 'am' },
  caught: { t: '붙잡힘', c: 'dn' },
  dead: { t: '순직', c: 'dn' },
};
/** 요원 사진: 그 나라 요원 사진(agent-<나라>-01~16) → 젊은 얼굴 → 나라 얼굴 */
export const agentPhotoUrl = (a: Agent, state: GameState) => (a.home && a.photo != null ? portraitUrl(`agent-${a.home}-${String(a.photo + 1).padStart(2, '0')}`) : null) ?? youngFaceUrl(a.home ?? state.player.countryId, a.sex, a.face) ?? countryFaceUrl({ country: state.player.countryId, sex: a.sex, age: a.age, id: a.id, face: a.face }, agentLook(state));
export function AgentCard({ a, state, on, onPick, onSwap, onRansom, onInfo }: { a: Agent; state: GameState; on: boolean; onPick: () => void; onSwap: () => void; onRansom?: () => void; onInfo?: () => void }) {
  const url = agentPhotoUrl(a, state);
  const t = statsOf(a);
  const st = STATUS[a.status];
  const where = a.where ? ` · ${countryById(a.where).name}` : '';
  const left = a.untilMs && a.untilMs > state.worldMs ? ` ${timeLeft(a.untilMs - state.worldMs)}` : '';
  return (
    <div className={`agent-card ${on ? 'on' : ''} st-${a.status} ${a.legend ? 'legend' : ''}`} onClick={a.status === 'idle' ? onPick : undefined}>
      <div className="agent-face">
        {url ? <img src={url} alt="" /> : <span>🕵️</span>}
        {a.legend && <i className="agent-ss">SS</i>}
        <i className={`agent-tag ${st.c}`}>{st.t}{where}{left}</i>
        {onInfo && <button className="agent-info" aria-label="요원 키우기" onClick={(e) => { e.stopPropagation(); onInfo(); }}>⬆️{(a.pts ?? 0) > 0 ? <i>{a.pts}</i> : null}</button>}
      </div>
      <b>"{a.code}" {a.name}</b>
      <small className="muted">{a.skills.map((k) => `${SKILLS[k].icon}${SKILLS[k].name}`).join(' · ')}</small>
      {a.legend && a.trait && <small className="agent-trait">🖤 {TRAITS[a.trait].name} · {TRAITS[a.trait].text}{a.from ? ` · ${a.from} 출신` : ''}</small>}
      <small className="agent-star">등급 {a.lv}/{LV_MAX} · 힘 <b>{powerOf(a)}</b></small>
      <small className="agent-stats">🥷{t.infil} 🎯{t.ops} 🤫{t.hush}</small>
      <span className="bar"><span className="bar-fill" style={{ width: `${a.lv >= LV_MAX ? 100 : Math.min(100, (a.xp / (a.lv * 100)) * 100)}%` }} /></span>
      {a.status === 'caught' && (
        <button className="small" disabled={!!canSwap(state, a.id)} title={canSwap(state, a.id) ?? ''} onClick={(e) => { e.stopPropagation(); onSwap(); }}>
          🔁 포로 교환
        </button>
      )}
      {a.status === 'caught' && onRansom && (
        <button className="small" disabled={!!canPayRansom(state, a.id)} title={canPayRansom(state, a.id) ?? ''} onClick={(e) => { e.stopPropagation(); onRansom(); }}>
          💸 몸값 {fmt(ransomOf(state, a.legend))}
        </button>
      )}
      {a.status === 'caught' && <small className="muted">구출 작전은 해외 공작에서 그 나라를 골라서</small>}
    </div>
  );
}

export function MissionSteps({ m, state, pick }: { m: SpyMission; state: GameState; pick: (p: StepPick) => void }) {
  const step = missionStep(state, m);
  const odds = missionOdds(state, m);
  const art = agentArt((STEP_ART[m.op] ?? (m.op.startsWith('r-') ? STEP_ART['r-*'] : undefined))?.[step] ?? 'infil');
  const a = agentById(state, m.agent);
  return (
    <div className="agent-steps">
      <div className="agent-stage">
        {stepNames(m.op).map((n, i) => (
          <span key={n} className={i < step ? 'ok' : i === step ? 'now' : ''}>
            {i + 1} {n}
            {m.picks?.[i] ? ` ${PICKS[m.picks[i]!].icon}` : i < step ? ' 🤫' : ''}
          </span>
        ))}
      </div>
      <div className="agent-scene" style={art ? { backgroundImage: `url(${art})` } : undefined}>
        <p>{a ? `"${a.code}" · ` : ''}{stepText(m.op, step, m.target, m.rival)}</p>
      </div>
      <div className="agent-odds">
        <span>성공 {Math.round(odds.chance * 100)}%</span>
        <span>들킬 위험 {Math.round(odds.risk)}%</span>
      </div>
      <span className="bar"><span className="bar-fill risk" style={{ width: `${odds.risk}%` }} /></span>
      <div className="agent-picks">
        {(Object.keys(PICKS) as StepPick[]).map((k) => {
          const p = PICKS[k];
          const why = canPick(state, m.id, k);
          const chosen = m.picks?.[step] === k;
          return (
            <button key={k} className={chosen ? 'on' : ''} disabled={!!why && !chosen} title={why ?? ''} onClick={() => pick(k)}>
              {p.icon} {p.name}
              <small>{k === 'bribe' ? `💰${fmt(pickCost(m))} · ` : ''}성공 {p.chance ? `+${Math.round(p.chance * 100)}` : '±0'} · 위험 +{p.risk}</small>
            </button>
          );
        })}
      </div>
      {!m.picks?.[step] && <p className="small muted">이 단계에서 안 고르면 「조용히」로 해요.</p>}
    </div>
  );
}
