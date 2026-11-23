// 미리 명령 창 · 자리 비운 동안 보고 창
import { Modal } from './kit';
import { ORDER_INFO, ordersOf, setOrder, type AwaySummary } from '../game/orders';
import type { GameState } from '../game/state';

export function OrdersModal({ state, apply, onClose }: { state: GameState; apply: (f: (s: GameState) => GameState) => void; onClose: () => void }) {
  const o = ordersOf(state);
  return (
    <Modal title="미리 명령" icon="📋" onClose={onClose}>
      <p className="small muted">자리를 비운 동안에도 부관이 이 규칙대로 움직여요. 켜고 끄는 건 언제든 바꿀 수 있어요.</p>
      {ORDER_INFO.map((x) => (
        <label key={x.key} className="order-row">
          <input type="checkbox" checked={!!o[x.key]} onChange={(e) => apply((s) => setOrder(s, x.key, e.target.checked))} />
          <span>
            <b>
              {x.icon} {x.name}
            </b>
            <small className="muted">{x.text}</small>
          </span>
        </label>
      ))}
      {o.log.length > 0 && (
        <details className="small">
          <summary>부관이 한 일 {o.log.length}</summary>
          {o.log.map((t, i) => (
            <div key={i} className="list-row">
              {t}
            </div>
          ))}
        </details>
      )}
    </Modal>
  );
}

export function AwayModal({ sum, onClose, onOrders }: { sum: AwaySummary; onClose: () => void; onOrders: () => void }) {
  const h = sum.hours;
  return (
    <Modal title={`자리 비운 ${h < 1 ? `${Math.round(h * 60)}분` : `${h.toFixed(1)}시간`} 동안`} icon="🗒️" onClose={onClose}>
      <p className="small muted">지도자님이 안 계신 동안 세계는 {h.toFixed(1)}일 흘렀어요. 부관이 정리했습니다.</p>
      <div className="away-rows">
        {sum.rows.map((r, i) => (
          <div key={i} className={`list-row small away-${r.tone ?? 'plain'}`}>
            <span>
              {r.icon} {r.label}
            </span>
            <b>{r.value}</b>
          </div>
        ))}
      </div>
      {sum.events.length > 0 && (
        <details className="small" open>
          <summary>주요 소식</summary>
          {sum.events.map((t, i) => (
            <div key={i} className="list-row">
              {t}
            </div>
          ))}
        </details>
      )}
      <div className="row" style={{ display: 'flex', gap: 6, marginTop: 8 }}>
        <button className="wide" onClick={onOrders}>
          📋 미리 명령 바꾸기
        </button>
        <button className="wide primary" onClick={onClose}>
          확인
        </button>
      </div>
    </Modal>
  );
}
