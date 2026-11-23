// 돌발 사건 카드 창
import { Modal } from './kit';
import { timeLeft } from './officerScreens';
import { canChoose, chooseCrisis, crisisById, crisisOf, fill, fxText } from '../game/crisis';
import { FLAG } from './flag';
import type { GameState } from '../game/state';

export function CrisisModal({ state, apply, onClose }: { state: GameState; apply: (f: (s: GameState) => GameState) => void; onClose: () => void }) {
  const o = crisisOf(state).open;
  if (!o) return null;
  const d = crisisById(o.def);
  return (
    <Modal title={d.title} icon={d.icon} onClose={onClose}>
      <div className="crisis">
        <p>
          {o.target && <span style={{ marginRight: 4 }}>{FLAG[o.target]}</span>}
          {fill(d.text, o.target)}
        </p>
        <p className="small muted">⏳ {timeLeft(o.untilMs - state.worldMs)} 안에 고르지 않으면 부관이 "{d.options[d.auto].label}"을(를) 골라요.</p>
        {d.options.map((opt, i) => {
          const why = canChoose(state, opt);
          return (
            <button
              key={i}
              className="wide crisis-opt"
              disabled={!!why}
              title={why ?? ''}
              onClick={() => {
                apply((s) => chooseCrisis(s, i));
                onClose();
              }}
            >
              <b>{opt.label}</b>
              <small className="muted">{why ?? fxText(opt.fx, o.target)}</small>
            </button>
          );
        })}
      </div>
    </Modal>
  );
}
