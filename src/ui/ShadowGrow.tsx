// 11-28 그림자 요원 뽑기(후보 중 한 명 · 💎 새로 받기)와 키우기 창
import { useState } from 'react';
import { Card, fmt } from './common';
import { Modal } from './kit';
import type { ScreenProps } from './screens';
import type { GameState } from '../game/state';
import { LV_MAX, SKILLS, STAT_MAX, STAT_NAMES, TRAITS, agentById, powerOf, recruitCost, statsOf, type Agent, type AgentSkill, type StatKey } from '../game/agents';
import {
  CAND_RUBY, DRILL_RUBY, DRILL_XP, HEAL_RUBY, PT_STEP, RESKILL_RUBY, STAT_RUBY, STAT_RUBY_UP, TRAIN_XP,
  canDrill, canHeal, canHire, canRefreshCands, canReskill, canRetire, canRubyStat, canSpendPt, canTrain, candsOf, drill, heal, hire, refreshCands, reskill, retire, rubyStat, slotsText, spendPt, train, trainCost,
} from '../game/agentGrow';
import { OP_NEED, spyOpById } from '../game/spy';
import { agentPhotoUrl } from './SpyPanel';
import { timeLeft } from './officerScreens';

type Run = (f: (s: GameState) => { state: GameState; text: string }) => void;

function StatBars({ a }: { a: Agent }) {
  const t = statsOf(a);
  return (
    <div className="ag-stats">
      {(Object.keys(STAT_NAMES) as StatKey[]).map((k) => (
        <div key={k} className="ag-stat">
          <span>{STAT_NAMES[k].icon} {STAT_NAMES[k].name}</span>
          <span className="bar"><span className="bar-fill" style={{ width: `${(t[k] / STAT_MAX) * 100}%` }} /></span>
          <b>{t[k]}</b>
        </div>
      ))}
    </div>
  );
}

/** 요원 뽑기: 후보 3명 중 한 명 */
export function RecruitCard({ state, run }: { state: GameState; run: Run }) {
  const cands = candsOf(state);
  const cost = recruitCost(state);
  const ruby = state.goals?.ruby ?? 0;
  return (
    <Card title="🎲 요원 뽑기" right={<small className="muted">{slotsText(state)} · 💎{ruby}</small>}>
      <div className="cand-grid">
        {cands.map((c, i) => {
          const why = canHire(state, i);
          const url = agentPhotoUrl(c, state);
          return (
            <div key={`${c.name}-${i}`} className={`cand-card ${c.legend ? 'legend' : ''}`}>
              <div className="agent-face">{url ? <img src={url} alt="" /> : <span>🕵️</span>}{c.legend && <i className="agent-ss">SS</i>}</div>
              <b>"{c.code}" {c.name}</b>
              <small className="muted">{c.age}세 · {c.skills.map((k) => `${SKILLS[k].icon}${SKILLS[k].name}`).join(' ')}</small>
              {c.trait && <small className="agent-trait">🖤 {TRAITS[c.trait].name}</small>}
              <small>힘 <b>{powerOf(c)}</b> · 🥷{statsOf(c).infil} 🎯{statsOf(c).ops} 🤫{statsOf(c).hush}</small>
              <button className="small" disabled={!!why} title={why ?? ''} onClick={() => run((s) => hire(s, i))}>
                뽑기 🕵️{cost.intel} 💰{fmt(cost.money * (c.legend ? 3 : 1))}
              </button>
              {why && <small className="muted">{why}</small>}
            </div>
          );
        })}
      </div>
      <button className="wide" disabled={!!canRefreshCands(state)} onClick={() => run(refreshCands)}>
        🔄 후보 새로 받기 <small>💎{CAND_RUBY}</small>
      </button>
      <p className="small muted">마음에 드는 요원이 나올 때까지 새로 받을 수 있어요. 가끔 전설(SS)급이 나와요. 처음 능력치는 낮아도 훈련으로 키울 수 있어요.</p>
    </Card>
  );
}

/** 요원 키우기 창 */
export function AgentGrowModal({ state, id, run, apply, onClose }: { state: GameState; id: number; run: Run; apply: ScreenProps['actions']['apply']; onClose: () => void }) {
  const a = agentById(state, id);
  const [msg, setMsg] = useState('');
  if (!a) return null;
  const say: Run = (f) => run((s) => { const r = f(s); setMsg(r.text); return r; });
  const t = statsOf(a);
  const url = agentPhotoUrl(a, state);
  const power = powerOf(a);
  const opens = Object.entries(OP_NEED).filter(([, n]) => (n ?? 0) <= power).map(([op]) => spyOpById(op as never).name);
  const next = Object.entries(OP_NEED).filter(([, n]) => (n ?? 0) > power).sort((x, y) => (x[1] ?? 0) - (y[1] ?? 0))[0];
  const trainWhy = canTrain(state, id);
  return (
    <Modal title={`"${a.code}" ${a.name}`} icon="🕶️" onClose={onClose}>
      <div className="ag-head">
        <div className="agent-face">{url ? <img src={url} alt="" /> : <span>🕵️</span>}{a.legend && <i className="agent-ss">SS</i>}</div>
        <div>
          <b>등급 {a.lv}/{LV_MAX} · 힘 {power}</b>
          <small className="muted">{a.age}세 · {a.skills.map((k) => `${SKILLS[k].icon}${SKILLS[k].name}`).join(' · ')} · 작전 {a.ops}번(성공 {a.wins})</small>
          {a.trait && <small className="agent-trait">🖤 {TRAITS[a.trait].name} · {TRAITS[a.trait].text}</small>}
          <span className="bar"><span className="bar-fill" style={{ width: `${a.lv >= LV_MAX ? 100 : Math.min(100, (a.xp / (a.lv * 100)) * 100)}%` }} /></span>
          <small className="muted">경험치 {a.xp}/{a.lv >= LV_MAX ? '최고' : a.lv * 100}</small>
        </div>
      </div>
      <StatBars a={a} />
      <p className="small">
        🎯 갈 수 있는 주요 임무: {opens.length ? opens.join(' · ') : '아직 없음'}
        {next ? <><br /><span className="muted">다음: {spyOpById(next[0] as never).name}(힘 {next[1]} 필요)</span></> : null}
      </p>

      <h4 className="cab-h">🏋️ 경험치 쌓기</h4>
      <div className="ag-acts">
        <button disabled={!!trainWhy} title={trainWhy ?? ''} onClick={() => say((s) => train(s, id))}>
          🏋️ 훈련 +{TRAIN_XP} <small>💰{fmt(trainCost(state))}{(a.trainMs ?? 0) > state.worldMs ? ` · ${timeLeft((a.trainMs ?? 0) - state.worldMs)} 뒤` : ' · 6시간마다'}</small>
        </button>
        <button disabled={!!canDrill(state, id)} title={canDrill(state, id) ?? ''} onClick={() => say((s) => drill(s, id))}>
          🔥 특훈 +{DRILL_XP} <small>💎{DRILL_RUBY}</small>
        </button>
      </div>

      <h4 className="cab-h">⬆️ 능력치 올리기 <small className="muted">점수 {a.pts ?? 0} (등급이 오르면 +3)</small></h4>
      {(Object.keys(STAT_NAMES) as StatKey[]).map((k) => (
        <div key={k} className="list-row small">
          <span style={{ flex: 1 }}>{STAT_NAMES[k].icon} <b>{STAT_NAMES[k].name} {t[k]}</b> <span className="muted">· {STAT_NAMES[k].text}</span></span>
          <button className="small" disabled={!!canSpendPt(state, id, k)} onClick={() => apply((s) => spendPt(s, id, k))}>점수 1 → +{PT_STEP}</button>
          <button className="small" disabled={!!canRubyStat(state, id, k)} onClick={() => apply((s) => rubyStat(s, id, k))}>💎{STAT_RUBY} → +{STAT_RUBY_UP}</button>
        </div>
      ))}

      <h4 className="cab-h">🧰 그 밖에</h4>
      <div className="ag-acts">
        {(Object.keys(SKILLS) as AgentSkill[]).filter((k) => !a.skills.includes(k)).map((k) => (
          <button key={k} className="small" disabled={!!canReskill(state, id, k)} title={canReskill(state, id, k) ?? ''} onClick={() => { apply((s) => reskill(s, id, k)); setMsg(`${SKILLS[a.skills[1]].name} 대신 ${SKILLS[k].name}을 익혔어요.`); }}>
            📚 {SKILLS[a.skills[1]].name}→{SKILLS[k].icon}{SKILLS[k].name} <small>💎{RESKILL_RUBY}</small>
          </button>
        ))}
        {a.status === 'hurt' && (
          <button className="small" disabled={!!canHeal(state, id)} onClick={() => apply((s) => heal(s, id))}>🩹 바로 치료 <small>💎{HEAL_RUBY}</small></button>
        )}
        <button className="small" disabled={!!canRetire(state, id)} title={canRetire(state, id) ?? ''} onClick={() => { say((s) => retire(s, id)); onClose(); }}>👋 은퇴</button>
      </div>
      {msg && <p className="small sch-msg">{msg}</p>}
    </Modal>
  );
}
