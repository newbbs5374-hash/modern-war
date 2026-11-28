// 11-28 신앙 시설(문화 → 신앙 탭): 시설 3곳 1~5단계, 신앙 정보
import type { ScreenProps } from './screens';
import { Card } from './common';
import { FAITHS, countryById } from '../data/world';
import { FAITH_BUILDS, FAITH_MAX, canFaith, faithCost, faithHours, faithLv, faithOf, startFaith } from '../game/faith';
import { influenceProgress } from '../game/influence';

const H = 3600e3;
export function FaithPanel({ state, actions }: ScreenProps) {
  const me = countryById(state.player.countryId);
  const f = faithOf(state);
  const ip = influenceProgress(state);
  return (
    <Card title="🕯️ 신앙" right={<small className="muted">세계 영향력 문화 갈래 {ip.mine?.cul ?? 0}/200</small>}>
      <p className="small">
        우리 신앙: <b>{FAITHS[me.faith].name}</b> — {FAITHS[me.faith].trait}. 신앙 시설은 민심을 올리고 세계 영향력(문화·외교)에 더해져요.
      </p>
      <div className="faith-list">
        {FAITH_BUILDS.map((b) => {
          const lv = faithLv(state, b.id);
          const why = canFaith(state, b.id);
          const building = f.build?.id === b.id;
          return (
            <div key={b.id} className="faith-row">
              <span className="faith-ico">{b.icon}</span>
              <div className="faith-main">
                <b>
                  {b.name} <small className="muted">{lv}/{FAITH_MAX}단계</small>
                </b>
                <small>{b.text}</small>
                {building && <small className="ok">🏗️ 짓는 중 · {Math.max(1, Math.ceil((f.build!.endMs - state.worldMs) / H))}시간 남음</small>}
              </div>
              <button className="mini gold" disabled={!!why} title={why ?? ''} onClick={() => actions.apply((s) => startFaith(s, b.id))}>
                {lv ? '⬆️ 올리기' : '🏗️ 짓기'}
                <small>{why ?? `💰${faithCost(state, b.id).toLocaleString('ko-KR')} · ${faithHours(state, b.id)}시간`}</small>
              </button>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
