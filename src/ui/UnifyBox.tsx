// 11-28 통일 권유: 점령지를 6개월(실제 180시간) 반란 없이 지키면 그 나라 지도자에게 통일을 권함(나라 창 안)
import type { GameState } from '../game/state';
import { countryById } from '../data/world';
import { canUnify, proposeUnify, unifyChance, unifyRows, unifyWait, UNIFY_HOLD_H } from '../game/unify';

type ApplyWith = <T>(f: (s: GameState) => { state: GameState; out: T }) => T | undefined;
const H = 3600e3;

export function UnifyBox({ state, id, applyWith, onMsg }: { state: GameState; id: string; applyWith: ApplyWith; onMsg: (m: string) => void }) {
  const u = state.unify?.[id];
  if (!u || !u.held.length) return null;
  const nm = countryById(id).name;
  const why = canUnify(state, id);
  const left = unifyWait(state, id);
  const kept = Math.min(UNIFY_HOLD_H, Math.floor((state.worldMs - u.since) / H));
  return (
    <div className="annex-box vpeace">
      <b>🇺🇳 통일 권유</b>
      <p className="small muted">
        수도는 함락할 수 없어요. 대신 {nm} 도시 {u.held.length}곳을 6개월(실제 {UNIFY_HOLD_H}시간) 동안 반란 없이 지키면 {nm} 지도자에게 통일을 권할 수 있어요. 받아들이면 수도까지 모든 도시가 우리 땅이 돼요. 도시를 하나라도 잃으면 처음부터 다시 세요.
      </p>
      <div className="promo-line">
        <small>지킨 시간</small>
        <progress max={UNIFY_HOLD_H} value={kept} style={{ flex: 1 }} />
        <small className="muted">
          {kept}/{UNIFY_HOLD_H}시간
        </small>
      </div>
      <p className="small">
        받아들일 확률 <b>{Math.round(unifyChance(state, id) * 100)}%</b> ·{' '}
        {unifyRows(state, id)
          .map(([k, v]) => `${k} ${v >= 0 ? '+' : ''}${v}`)
          .join(' · ')}
      </p>
      <button
        className="gold wide"
        disabled={!!why}
        title={why ?? ''}
        onClick={() => onMsg(applyWith((s) => { const r = proposeUnify(s, id); return { state: r.state, out: r.text }; }) ?? '')}
      >
        {why ? `⏳ ${left < Infinity ? `${Math.ceil(left / H)}시간 뒤 권유 가능` : why}` : `🤝 ${nm} 지도자에게 통일 권하기`}
      </button>
    </div>
  );
}
