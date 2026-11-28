// 11-28 분쟁 사다리(나라 창 안): 지금 단계 · 명분 · 사다리 행동 · 총동원(24시간) · 시험용 "⏩ 24시간 뒤로"
import { useState } from 'react';
import type { GameState } from '../game/state';
import { skip } from '../game/state';
import { countryById } from '../data/world';
import { approvalOf } from '../game/approval';
import { TEST_MODE } from '../game/balance';
import { APPROVAL_NEED, CB_NEED, LEVELS, PREPS, STEPS, canMobilize, canStep, cbOf, cbRows, doStep, levelOf, mobOf, mobilize, skipSummary, standDown, stepCost } from '../game/ladder';
import { lordOf } from '../game/surrender';
import { relationOf } from '../game/world';

type ApplyWith = <T>(f: (s: GameState) => { state: GameState; out: T }) => T | undefined;
const H = 3600e3;

export function LadderBox({ state, id, applyWith, onMsg }: { state: GameState; id: string; applyWith: ApplyWith; onMsg: (m: string) => void }) {
  const me = state.player.countryId;
  const [report, setReport] = useState<string[] | null>(null);
  const nm = countryById(id).name;
  const lv = levelOf(state, id);
  const cb = cbOf(state, id);
  const ap = Math.round(approvalOf(state));
  const mine = mobOf(state, me, id);
  const theirs = mobOf(state, id, me);
  const war = relationOf(state.world, me, id) === '전쟁';
  const why = canMobilize(state, id);
  const indep = lordOf(state, me) === id;
  const run = (f: (s: GameState) => { state: GameState; text: string }) => onMsg(applyWith((s) => { const r = f(s); return { state: r.state, out: r.text }; }) ?? '');
  return (
    <div className="annex-box ladder-box">
      <b>🪜 분쟁 사다리 · 지금 {LEVELS[lv].icon} {LEVELS[lv].name}</b>
      <div className="ladder-steps">
        {LEVELS.map((L) => (
          <span key={L.lv} className={`ladder-chip ${L.lv === lv ? 'on' : L.lv < lv ? 'past' : ''}`} title={L.text}>
            {L.icon}
            <small>{L.name}</small>
          </span>
        ))}
      </div>
      {!war && (
        <>
          <p className="small muted">전면전은 시작하기 어려워요. 명분 {CB_NEED}·지지도 {APPROVAL_NEED}%를 넘긴 뒤 총동원 24시간이 지나야 선포돼요. 그 사이 {nm}도 전쟁 준비를 해요.</p>
          <div className="promo-line">
            <small>⚖️ 명분</small>
            <progress max={100} value={cb} style={{ flex: 1 }} />
            <small className={cb >= CB_NEED ? '' : 'muted'}>
              {cb}/{CB_NEED}
            </small>
          </div>
          <p className="small muted">{cbRows(state, id).map(([k, v]) => `${k} ${v >= 0 ? '+' : ''}${v}`).join(' · ') || '아직 명분이 없어요'} · 🙂 지지도 {ap}%</p>
          <div className="ladder-acts">
            {STEPS.map((st) => {
              const no = canStep(state, id, st.id);
              const cost = stepCost(state, st.id);
              return (
                <button key={st.id} className="mini" disabled={!!no} title={no ?? st.text} onClick={() => run((s) => doStep(s, id, st.id))}>
                  {st.icon} {st.name}
                  <small>{no ?? `${st.text}${cost ? ` · 예산 ${cost.toLocaleString('ko-KR')}` : ''} · 명분 +${st.cb}`}</small>
                </button>
              );
            })}
          </div>
          {mine ? (
            <div className="ladder-mob">
              <b>🪖 총동원 중 · {Math.max(0, Math.ceil((mine.endMs - state.worldMs) / H))}시간 뒤 전면전</b>
              <small className="muted">{nm}의 준비 {mine.preps.length}/7: {mine.preps.map((p) => `${PREPS[p].icon}${PREPS[p].name}`).join(' · ') || '아직 없음'}</small>
              <button className="mini" onClick={() => applyWith((s) => ({ state: standDown(s, id), out: null }))}>
                🕊️ 총동원 거두기
              </button>
            </div>
          ) : (
            <button
              className="danger wide"
              disabled={!!why}
              title={why ?? ''}
              onClick={() => {
                if (!window.confirm(indep ? `${nm}에 독립 전쟁을 선포할까요?` : `${nm}를 향해 총동원령을 내릴까요?\n24시간 뒤 전면전이 시작돼요. 전쟁 중엔 매일 예산이 들고 지지도가 깎여요.`)) return;
                run((s) => mobilize(s, id));
              }}
            >
              {indep ? '🗽 독립 전쟁' : '🪖 총동원(24시간 뒤 전면전)'}
              <small>{why ?? (indep ? '속국은 바로 선포' : '명분·지지도 충분')}</small>
            </button>
          )}
        </>
      )}
      {theirs && (
        <div className="ladder-mob danger-line">
          <b>🚨 {nm}가 우리를 향해 총동원 중 · {Math.max(0, Math.ceil((theirs.endMs - state.worldMs) / H))}시간 뒤 전쟁</b>
          <small className="muted">우리 쪽 준비 {theirs.preps.length}/7: {theirs.preps.map((p) => `${PREPS[p].icon}${PREPS[p].name}`).join(' · ') || '아직 없음'} · 휴전·연합 제안으로 막을 수 있어요(긴장이 내려가면 거둬요)</small>
        </div>
      )}
      {TEST_MODE.skip24 && (mine || theirs) && (
        <button
          className="gold wide"
          onClick={() => {
            const out = applyWith((s) => {
              const after = skip(s, 24 * H);
              return { state: after, out: skipSummary(s, after) };
            });
            if (out) setReport(out);
          }}
        >
          ⏩ 24시간 뒤로 (시험판 전용)
          <small>내정·AI 준비가 저절로 흐르고 보고를 받아요</small>
        </button>
      )}
      {report && (
        <div className="ladder-report">
          <b>📋 24시간 보고</b>
          {report.map((line, i) => (
            <small key={i}>{line}</small>
          ))}
          <button className="mini" onClick={() => setReport(null)}>
            닫기
          </button>
        </div>
      )}
    </div>
  );
}
