// 가속 버튼: ⏩ 30분(가속권 1장) · ⚡ 바로 끝내기(필요한 만큼)
import { boostLeft, boostsOf, boostsToFinish, useBoost, type BoostTarget } from '../game/boost';
import type { GameState } from '../game/state';

export function BoostBar({ state, apply, target, compact }: { state: GameState; apply: (f: (s: GameState) => GameState) => void; target: BoostTarget; compact?: boolean }) {
  if (boostLeft(state, target) <= 0) return null;
  const have = boostsOf(state);
  const need = boostsToFinish(state, target);
  return (
    <div className={`boost-bar ${compact ? 'compact' : ''}`}>
      <button disabled={have < 1} onClick={() => apply((s) => useBoost(s, target, 1))} title="가속권 1장으로 30분 줄이기">
        ⏩ 30분 <small>🎫1</small>
      </button>
      <button className="gold" disabled={have < need} onClick={() => apply((s) => useBoost(s, target, need))} title="가속권으로 바로 끝내기">
        ⚡ 바로 <small>🎫{need}</small>
      </button>
      {!compact && <small className="muted">보유 🎫{have}</small>}
    </div>
  );
}
