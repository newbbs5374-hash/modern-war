// 11-28 대장 결정 v2: 개인 → 🕶️ 그림자실(대통령 직속 비공식 기관)
//  블랙 요원 명부 · 정보기관 전설 요원(인연 100이면 합류) · 지령(정적 처리 12가지 / 해외 공작) · 포로 외교 · 다른 나라 블랙 작전 기록
import { useState } from 'react';
import { BoostBar } from './BoostBar';
import { Card, fmt } from './common';
import { FLAG } from './flag';
import { timeLeft } from './officerScreens';
import type { ScreenProps } from './screens';
import { COUNTRIES, countryById } from '../data/world';
import { RANKS } from '../data/ranks';
import { isAlive, relationOf } from '../game/world';
import { SPY_OPS, canSpy, pickStep, spyChance, spyOf, spyOpById, spyTeams, startSpy } from '../game/spy';
import { BOND_JOIN, SKILLS, TRAITS, agencyOf, agentById, agentCap, agentsOf, bestAgent, canMeetLegend, canRecruit, meetCost, meetLegend, prisonerEdge, ransomOf, recruitAgent, recruitCost, swapAgent } from '../game/agents';
import { canPrisoner, myLegendsView, payRansom, prisonerAct, stealable, turnChance } from '../game/shadow';
import { ROLE_INFO, influenceOf, roleOf } from '../game/rivals';
import { portraitUrl, youngFaceUrl } from './Portrait';
import { AgentCard, MissionSteps } from './SpyPanel';

const legendPhoto = (country: string, photo: number, sex: 'm' | 'f') => portraitUrl(`agent-${country}-${String(photo + 1).padStart(2, '0')}`) ?? youngFaceUrl(country, sex, photo);

export function ShadowPanel({ state, actions }: ScreenProps) {
  const me = state.player.countryId;
  const sp = spyOf(state);
  const ag = agentsOf(state);
  const [mode, setMode] = useState<'rival' | 'foreign'>('rival');
  const [agentSel, setAgentSel] = useState<number | null>(null);
  const selAgent = agentSel != null ? agentById(state, agentSel) : undefined;
  const pickAgent = selAgent && selAgent.status === 'idle' ? selAgent.id : undefined;
  const rivals = state.officer.rivals.filter((r) => !r.ally);
  const [rival, setRival] = useState<string>(() => rivals[0]?.name ?? '');
  const others = COUNTRIES.filter((c) => c.id !== me && isAlive(state.world, c.id));
  const [target, setTarget] = useState<string>(() => others[0]?.id ?? '');
  const [msg, setMsg] = useState('');
  const say = (r: { state: typeof state; text: string }) => r;
  const run = (f: (s: typeof state) => { state: typeof state; text: string }) => setMsg(actions.applyWith((s) => { const r = say(f(s)); return { state: r.state, out: r.text }; }) ?? '');
  const shadowActive = sp.active.filter((m) => spyOpById(m.op).shadow);
  const legends = myLegendsView(state);
  const ops = SPY_OPS.filter((d) => d.shadow && (mode === 'rival' ? d.domestic : !d.domestic));
  const curRival = rivals.find((r) => r.name === rival) ?? rivals[0];
  const tgt = target || others[0]?.id;
  return (
    <>
      <div className="shadow-hero">
        <b>🕶️ 그림자실</b>
        <span>대통령 직속 · 존재하지 않는 기관</span>
        <small>정적 처리 · 다른 나라 기술 탈취 · 공식으로는 못 하는 일. 들키면 나라 안팎이 뒤집혀요.</small>
      </div>

      {msg && <p className="small sch-msg">{msg}</p>}

      {shadowActive.length > 0 && (
        <Card title="진행 중인 지령" right={<small className="muted">팀 {sp.active.length}/{spyTeams(state)}</small>}>
          {shadowActive.map((m) => {
            const d = spyOpById(m.op);
            const pct = Math.min(100, ((state.worldMs - m.startMs) / (m.endMs - m.startMs)) * 100);
            return (
              <div key={m.id} className="list-row small agent-mrow">
                <span style={{ flex: 1 }}>
                  {d.icon} {d.name} → {d.domestic ? <>👤 {m.rival}</> : <>{FLAG[m.target]} {countryById(m.target).name}</>}
                  {agentById(state, m.agent) ? ` · "${agentById(state, m.agent)!.code}"` : ''}
                  <span className="bar"><span className="bar-fill" style={{ width: `${pct}%` }} /></span>
                </span>
                <span className="muted">{timeLeft(m.endMs - state.worldMs)}</span>
                <BoostBar state={state} apply={actions.apply} target={{ kind: 'spy', id: m.id }} compact />
                {m.agent != null && <MissionSteps m={m} state={state} pick={(p) => actions.apply((s) => pickStep(s, m.id, p))} />}
              </div>
            );
          })}
        </Card>
      )}

      <Card title="🖤 블랙 요원" right={<small className="muted">{ag.list.filter((a) => a.status !== 'dead').length}명 · 일반 {ag.list.filter((a) => !a.legend && a.status !== 'dead').length}/{agentCap(state)}</small>}>
        <div className="agent-grid">
          {ag.list.filter((a) => a.status !== 'dead').map((a) => (
            <AgentCard key={a.id} a={a} state={state} on={agentSel === a.id} onPick={() => setAgentSel(agentSel === a.id ? null : a.id)}
              onSwap={() => run((s) => swapAgent(s, a.id))} onRansom={() => run((s) => payRansom(s, a.id))} />
          ))}
        </div>
        <p className="small muted">요원을 누르면 그 요원을 보내요(안 고르면 지령에 가장 맞는 요원). 전설 요원(SS)은 등급 5 + 고유 능력.</p>
        <button className="wide" disabled={!!canRecruit(state)} title={canRecruit(state) ?? ''} onClick={() => run(recruitAgent)}>
          ➕ 일반 요원 뽑기 · 🕵️{recruitCost(state).intel} · 💰{fmt(recruitCost(state).money)}{canRecruit(state) ? ` · ${canRecruit(state)}` : ''}
        </button>
      </Card>

      <Card title={`🏛️ ${agencyOf(me)} 전설 요원`} right={<small className="muted">인연 {BOND_JOIN}이면 합류</small>}>
        {legends.length ? (
          <div className="legend-grid">
            {legends.map((l) => {
              const why = canMeetLegend(state, l.key);
              const url = legendPhoto(me, l.photo, l.sex);
              return (
                <div key={l.key} className="legend-card">
                  <div className="legend-face">{url ? <img src={url} alt="" /> : <span>🕶️</span>}<i className="agent-ss">SS</i></div>
                  <b>"{l.code}" {l.name}</b>
                  <small className="muted">{l.age}세 · {l.skills.map((k) => `${SKILLS[k].icon}${SKILLS[k].name}`).join(' · ')}</small>
                  <small className="agent-trait">🖤 {TRAITS[l.trait].name} · {TRAITS[l.trait].text}</small>
                  <small className="muted">잠입 {l.stats.infil} · 공작 {l.stats.ops} · 은밀 {l.stats.hush}</small>
                  <span className="bar"><span className="bar-fill" style={{ width: `${l.bond}%` }} /></span>
                  <small>인연 {l.bond}/{BOND_JOIN}{l.nextMs > state.worldMs ? ` · ${timeLeft(l.nextMs - state.worldMs)} 뒤 다시` : ''}</small>
                  <div className="legend-btns">
                    <button className="small" disabled={!!why} title={why ?? ''} onClick={() => run((s) => meetLegend(s, l.key, 'warm'))}>☕ 은밀한 만남 💰{fmt(meetCost(state).money)}</button>
                    <button className="small" disabled={!!why} title={why ?? ''} onClick={() => run((s) => meetLegend(s, l.key, 'deal'))}>💼 거래 제안 💰{fmt(meetCost(state).money * 3)}</button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="small muted">우리 정보기관의 전설 요원은 모두 그림자실에 들어왔어요.</p>
        )}
        <p className="small muted">새 게임마다 이름·사진·능력치가 새로 정해져요. 그림자실 지령이 성공하면 소문이 나서 인연이 조금씩 올라요.</p>
      </Card>

      <Card title="📜 지령 내리기" right={<small className="muted">{pickAgent != null ? `보낼 요원: "${selAgent!.code}"` : '요원: 자동'}</small>}>
        <div className="shadow-mode">
          <button className={mode === 'rival' ? 'on' : ''} onClick={() => setMode('rival')}>👤 정적 처리 ({SPY_OPS.filter((d) => d.domestic).length}가지)</button>
          <button className={mode === 'foreign' ? 'on' : ''} onClick={() => setMode('foreign')}>🌍 해외 공작</button>
        </div>
        {mode === 'rival' ? (
          rivals.length ? (
            <div className="shadow-rivals">
              {state.officer.rivals.map((r, i) => {
                if (r.ally) return null;
                const url = portraitUrl(r.faceKey, `aide-${r.name}`, `rival-${r.name}`);
                const role = roleOf(r, i);
                return (
                  <button key={r.name} className={`shadow-rival ${curRival?.name === r.name ? 'on' : ''}`} onClick={() => setRival(r.name)}>
                    {url ? <img src={url} alt="" /> : <span>{ROLE_INFO[role].icon}</span>}
                    <b>{r.name}</b>
                    <small>{role} · 영향력 {Math.round(influenceOf(r))}</small>
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="small muted">맞서는 정적이 없어요.</p>
          )
        ) : (
          <div className="spy-targets">
            {others.map((c) => (
              <button key={c.id} className={`spy-target ${tgt === c.id ? 'on' : ''}`} onClick={() => setTarget(c.id)}>
                {FLAG[c.id]}
                <small>{c.name}</small>
                <i className={`rel rel-${relationOf(state.world, me, c.id)}`}>{relationOf(state.world, me, c.id)}</i>
              </button>
            ))}
          </div>
        )}
        {mode === 'foreign' && tgt && stealable(state, tgt).length > 0 && (
          <p className="small result">🧬 {countryById(tgt).name}이 먼저 끝낸 기술: {stealable(state, tgt).slice(0, 3).map((t) => t.name).join(' · ')}</p>
        )}
        {(mode === 'rival' ? !!curRival : !!tgt) &&
          ops
            .filter((d) => d.id !== 'rescue' || ag.list.some((a) => a.status === 'caught' && a.where === tgt))
            .map((d) => {
              const t = d.domestic ? me : tgt!;
              const rv = d.domestic ? curRival?.name : undefined;
              const why = canSpy(state, d.id, t, pickAgent, rv);
              const who = pickAgent != null ? selAgent : bestAgent(state, d.id);
              const locked = state.player.rankIndex < d.rank;
              return (
                <div key={d.id} className={`list-row small ${locked ? 'muted' : ''}`}>
                  <span style={{ flex: 1 }}>
                    {d.icon} <b>{d.name}</b> · {d.hours}시간 · 성공 {Math.round(spyChance(state, d.id, t, who?.id, rv) * 100)}%{who ? ` · "${who.code}"` : ''}
                    <br />
                    <span className="muted">{locked ? `🔒 ${RANKS[d.rank].name}부터` : d.text}{d.domestic ? ` 들키면 지지도 −${d.caught.favor}·의회 신뢰 −${d.caught.tension}.` : ''}</span>
                  </span>
                  <button disabled={!!why} title={why ?? ''} onClick={() => { actions.apply((s) => startSpy(s, d.id, t, pickAgent, rv)); setAgentSel(null); }}>
                    🕵️{d.intel} · 💰{fmt(d.money)}
                  </button>
                </div>
              );
            })}
      </Card>

      <Card title="⛓️ 포로와 외교 카드" right={<small className="muted">{ag.prisoners.length}명</small>}>
        {ag.prisoners.length ? (
          ag.prisoners.map((p, i) => {
            const url = p.legend && p.photo != null ? legendPhoto(p.country, p.photo, p.sex) : youngFaceUrl(p.country, p.sex, p.face ?? 0);
            return (
              <div key={`${p.country}-${p.sinceMs}-${i}`} className="list-row small prisoner-row">
                <span className="prisoner-face">{url ? <img src={url} alt="" /> : '🕵️'}</span>
                <span style={{ flex: 1 }}>
                  {FLAG[p.country]} <b>"{p.code}" {p.name}</b>{p.legend ? ' · SS 전설' : ''}
                  <br />
                  <span className="muted">{countryById(p.country).name}과 협상 +{Math.round(prisonerEdge(state, p.country) * 100)}%p(휴전·연합·정상회담)</span>
                </span>
                <button className="small" disabled={!!canPrisoner(state, i, 'ransom')} onClick={() => run((s) => prisonerAct(s, i, 'ransom'))}>💰 배상금 {fmt(ransomOf(state, p.legend))}</button>
                <button className="small" disabled={!!canPrisoner(state, i, 'tech')} onClick={() => run((s) => prisonerAct(s, i, 'tech'))}>🔬 기술과 맞바꾸기</button>
                <button className="small" disabled={!!canPrisoner(state, i, 'turn')} title={canPrisoner(state, i, 'turn') ?? ''} onClick={() => run((s) => prisonerAct(s, i, 'turn'))}>🖤 전향 {Math.round(turnChance(p) * 100)}%</button>
              </div>
            );
          })
        ) : (
          <p className="small muted">아직 잡은 외국 블랙 요원이 없어요. 다른 나라가 보낸 요원이 방첩에 걸리면 여기로 와요. 데리고 있으면 그 나라와의 협상이 쉬워져요.</p>
        )}
      </Card>

      {(ag.alog?.length ?? 0) > 0 && (
        <Card title="🌑 다른 나라 블랙 작전">
          {ag.alog!.map((t, i) => (
            <p key={i} className="small list-row">{t}</p>
          ))}
        </Card>
      )}

      {sp.log.length > 0 && (
        <Card title="최근 지령 결과" right={<small className="muted">성공 {sp.ok}/{sp.done}</small>}>
          {sp.log.map((t, i) => (
            <p key={i} className="small list-row">{t}</p>
          ))}
        </Card>
      )}
    </>
  );
}
