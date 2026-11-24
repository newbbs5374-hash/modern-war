// 가속 버튼: ⏩ 30분(가속권 1장) · ⚡ 바로 끝내기(필요한 만큼). 가속권이 모자라면 루비로(1장 = 💎5)
import { boostLeft, boostPrice, boostsAffordable, boostsOf, boostsToFinish, useBoost, type BoostTarget } from '../game/boost';
import { rubyOf } from '../game/goals';
import type { GameState } from '../game/state';

export const priceText = (p: { boosts: number; ruby: number }) => [p.boosts ? `🎫${p.boosts}` : '', p.ruby ? `💎${p.ruby}` : ''].filter(Boolean).join('+');

export function BoostBar({ state, apply, target, compact }: { state: GameState; apply: (f: (s: GameState) => GameState) => void; target: BoostTarget; compact?: boolean }) {
  if (boostLeft(state, target) <= 0) return null;
  const can = boostsAffordable(state);
  const need = boostsToFinish(state, target);
  const one = boostPrice(state, 1);
  const all = boostPrice(state, need);
  return (
    <div className={`boost-bar ${compact ? 'compact' : ''}`}>
      <button disabled={can < 1} onClick={() => apply((s) => useBoost(s, target, 1))} title={one.ruby ? '가속권이 없어 루비로 30분 줄이기' : '가속권 1장으로 30분 줄이기'}>
        ⏩ 30분 <small>{priceText(one)}</small>
      </button>
      <button className="gold" disabled={can < need} onClick={() => apply((s) => useBoost(s, target, need))} title={can < need ? '가속권·루비가 모자라요' : all.ruby ? '모자란 가속권은 루비로 내고 바로 끝내기' : '가속권으로 바로 끝내기'}>
        ⚡ 바로 <small>{priceText(all)}</small>
      </button>
      {!compact && (
        <small className="muted">
          보유 🎫{boostsOf(state)} 💎{rubyOf(state)}
        </small>
      )}
    </div>
  );
}
