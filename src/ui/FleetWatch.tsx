// 작전 → 전황: 지금 벌어지는 해전 목록과 관전 버튼
import { useState } from 'react';
import { Card } from './common';
import { FLAG } from './flag';
import { countryById } from '../data/world';
import { fleetSeed, fleetStateOf, seaWars } from '../game/fleet';
import type { ScreenProps } from './screens';
import { FleetBattle } from './FleetBattle';

export function FleetWatchCard({ state, actions }: ScreenProps) {
  const wars = seaWars(state);
  const [watch, setWatch] = useState<{ a: string; b: string; seed: number } | null>(null);
  const f = fleetStateOf(state);
  return (
    <Card title="⚓ 해전 관전" right={<small className="muted">본 해전 {f.watched}</small>}>
      {wars.length === 0 ? (
        <p className="small muted">지금은 전쟁 중인 나라가 없어 바다가 조용해요.</p>
      ) : (
        wars.slice(0, 8).map((w) => (
          <div key={w.a + w.b} className="list-row small">
            <span>
              {FLAG[w.a]} {countryById(w.a).name} ⚔️ {FLAG[w.b]} {countryById(w.b).name}
              {w.mine && <b className="result"> · 우리 전쟁</b>}
            </span>
            <button className={w.ready ? 'primary' : ''} onClick={() => setWatch({ a: w.a, b: w.b, seed: fleetSeed(state, w.a, w.b) })}>
              {w.ready ? '관전 ▶' : '다시 보기'}
            </button>
          </div>
        ))
      )}
      <p className="small muted">함대끼리 부딪히는 장면을 확대해서 봐요. 같은 두 나라 해전 결과는 6시간에 한 번 반영돼요(진 쪽 나라 예산 -3%·병력 -1%, 우리가 이기면 공훈 +30). 남의 해전을 보면 정보 +3.</p>
      {f.log.length > 0 && (
        <details className="small">
          <summary>최근 해전</summary>
          {f.log.map((t, i) => (
            <div key={i} className="list-row">
              {t}
            </div>
          ))}
        </details>
      )}
      {watch && <FleetBattle state={state} a={watch.a} b={watch.b} seed={watch.seed} apply={actions.apply} onClose={() => setWatch(null)} />}
    </Card>
  );
}
