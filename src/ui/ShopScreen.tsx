// 상점 탭: 매일 할 일 · 업적 · 루비 상점
import { Card, fmt } from './common';
import { Tabs, useTab } from './kit';
import type { ScreenProps } from './screens';
import { timeLeft } from './officerScreens';
import {
  ACHIEVEMENTS,
  DAILY_BONUS_BOOSTS,
  DAILY_BONUS_RUBY,
  DAILY_RUBY,
  SHOP,
  achState,
  buy,
  canBuy,
  claimAch,
  claimDaily,
  dailyInfo,
  dayOf,
  goalsOf,
  rubyOf,
} from '../game/goals';

const DAY = 24 * 3600e3;

function Bar({ have, need }: { have: number; need: number }) {
  return (
    <span className="bar">
      <span className="bar-fill" style={{ width: `${Math.min(100, (have / Math.max(1, need)) * 100)}%` }} />
    </span>
  );
}

export function ShopScreen({ state, actions }: ScreenProps) {
  const [tab, setTab] = useTab<'daily' | 'ach' | 'shop'>('shop', 'daily');
  const g = goalsOf(state);
  const sameDay = g.day === dayOf(state.worldMs);
  const daily = sameDay ? g.daily : [];
  const dReady = daily.filter((x) => !x.claimed && x.have >= x.need).length;
  const aReady = ACHIEVEMENTS.filter((a) => achState(state, a).ready).length;
  const resetIn = (dayOf(state.worldMs) + 1) * DAY - state.worldMs;
  return (
    <>
      <Card title="💎 루비" right={<b>{fmt(rubyOf(state))}</b>}>
        <p className="small muted">매일 할 일과 업적으로 루비를 모아 상점에서 가속권·자원으로 바꿔요.</p>
      </Card>
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'daily', icon: '📅', label: '매일 할 일', badge: dReady || undefined },
          { id: 'ach', icon: '🏅', label: '업적', badge: aReady || undefined },
          { id: 'shop', icon: '🛒', label: '루비 상점' },
        ]}
      />
      {tab === 'daily' && (
        <Card title="오늘 할 일" right={<small className="muted">새로 바뀌기까지 {timeLeft(resetIn)}</small>}>
          {!sameDay && <p className="small muted">새 할 일을 불러오는 중…</p>}
          {daily.map((x, i) => {
            const d = dailyInfo(x.id);
            const done = x.have >= x.need;
            return (
              <div key={x.id} className="list-row small">
                <span style={{ flex: 1 }}>
                  {d.icon} {d.name} {x.have}/{x.need}
                  <Bar have={x.have} need={x.need} />
                </span>
                <button className={done && !x.claimed ? 'primary' : ''} disabled={!done || x.claimed} onClick={() => actions.apply((s) => claimDaily(s, i))}>
                  {x.claimed ? '받음' : `💎 ${DAILY_RUBY}`}
                </button>
              </div>
            );
          })}
          <p className="small muted">
            3개 모두 받으면 보너스 💎 {DAILY_BONUS_RUBY} + 🎫 가속권 {DAILY_BONUS_BOOSTS}장{g.bonus ? ' (오늘 받음 ✓)' : ''}. 연속 {g.streak}일째.
          </p>
        </Card>
      )}
      {tab === 'ach' && (
        <Card title="업적" right={<small className="muted">{g.got.length}/{ACHIEVEMENTS.length}</small>}>
          {ACHIEVEMENTS.map((a) => {
            const st = achState(state, a);
            return (
              <div key={a.id} className={`list-row small ${st.got ? 'muted' : ''}`}>
                <span style={{ flex: 1 }}>
                  {a.icon} <b>{a.name}</b> · {a.text} {st.have}/{st.need}
                  <Bar have={st.have} need={st.need} />
                </span>
                <button className={st.ready ? 'primary' : ''} disabled={!st.ready} onClick={() => actions.apply((s) => claimAch(s, a.id))}>
                  {st.got ? '받음' : `💎 ${a.ruby}`}
                </button>
              </div>
            );
          })}
        </Card>
      )}
      {tab === 'shop' && (
        <Card title="루비 상점">
          {SHOP.map((it) => {
            const why = canBuy(state, it.id);
            return (
              <div key={it.id} className="list-row small">
                <span style={{ flex: 1 }}>
                  {it.icon} <b>{it.name}</b>
                  <br />
                  <span className="muted">{it.text}</span>
                </span>
                <button disabled={!!why} title={why ?? ''} onClick={() => actions.apply((s) => buy(s, it.id))}>
                  💎 {it.price}
                </button>
              </div>
            );
          })}
          <p className="small muted">진짜 돈 결제는 없어요. 루비는 게임 안에서만 얻어요.</p>
        </Card>
      )}
    </>
  );
}
