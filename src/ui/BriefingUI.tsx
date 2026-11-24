// 본부 → 📰 국정 보고서: 지지도·신뢰도 그래프 + 부관 3줄 보고 + 오늘 할 일(누르면 그 화면으로).
import { briefing } from '../game/briefing';
import { presOf } from '../game/approval';
import type { GameState } from '../game/state';
import { Modal } from './kit';
import { Spark } from './PresUI';
import { Face } from './Portrait';
import { secretaryKeys, secretaryOf } from '../data/secretary';

const sign = (v: number | null) => (v === null ? '' : v > 0 ? ` ▲${v}` : v < 0 ? ` ▼${-v}` : ' ■');

export function BriefingModal({ state, onClose, goTab }: { state: GameState; onClose: () => void; goTab: (screen: string, key: string, tab: string) => void }) {
  const b = briefing(state);
  const hist = presOf(state).hist.slice(-48);
  const sec = secretaryOf(state.player.countryId);
  return (
    <Modal title="오늘의 국정 보고서" icon="📰" onClose={onClose}>
      <div className="brf-top">
        <div>
          <small className="muted">🙂 지지도</small>
          <b>
            {b.approval}
            <small>{sign(b.dA)}</small>
          </b>
          <Spark data={hist.map((h) => h.a)} />
        </div>
        <div>
          <small className="muted">🤝 신뢰도</small>
          <b>
            {b.trust}
            <small>{sign(b.dT)}</small>
          </b>
          <Spark data={hist.map((h) => h.tr)} />
        </div>
      </div>
      <div className="brf-say">
        <span className="brf-face">
          <Face keys={secretaryKeys(state.player.countryId)} fallback="👩‍💼" />
        </span>
        <div>
          <small className="muted">수행비서 {sec.name}({sec.age})</small>
          {b.lines.map((l, i) => (
            <p key={i} className="small">
              {l}
            </p>
          ))}
        </div>
      </div>
      <h4 className="cab-h">오늘 할 일 {b.todos.length}</h4>
      {b.todos.length ? (
        <div className="brf-todos">
          {b.todos.map((t, i) => (
            <button key={i} className="pw-act" onClick={() => (onClose(), goTab(t.go.screen, t.go.key, t.go.tab))}>
              <span className="pw-act-ico">{t.icon}</span>
              <span className="li-main">
                <b>{t.text}</b>
              </span>
            </button>
          ))}
        </div>
      ) : (
        <p className="small muted">급한 일은 없어요. 잘하고 계십니다!</p>
      )}
    </Modal>
  );
}
