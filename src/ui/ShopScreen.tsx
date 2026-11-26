import { PAY_BOOST_CAP, PAY_BOOST_HOURS, PAY_BUDGET_PER_SALARY, PAY_RUBY_CAP } from '../game/payday';
import { Safe } from './Safe';
// 상점 탭: 매일 할 일 · 업적 · 루비 상점
import { Card, fmt } from './common';
import { Fold, Tabs, useTab } from './kit';
import type { ScreenProps } from './screens';
import { timeLeft } from './officerScreens';
import {
  achList,
  DAILY_BONUS_BOOSTS,
  DAILY_BONUS_RUBY,
  DAILY_RUBY,
  SHOP,
  achState,
  buy,
  canBuy,
  claimAch,
  claimAll,
  claimAllPreview,
  claimDaily,
  claimSpoils,
  SPOILS,
  SPOIL_SMALL_CAP,
  SPOIL_SMALL_BOOST_CAP,
  achBoosts,
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
  const aReady = achList(state).filter((a) => achState(state, a).ready).length;
  const resetIn = (dayOf(state.worldMs) + 1) * DAY - state.worldMs;
  const all = claimAllPreview(state);
  const spoils = g.spoils ?? [];
  return (
    <>
      <Card title="💎 루비" right={<b>{fmt(rubyOf(state))}</b>}>
        <p className="small muted">매일 할 일·업적·전과(모든 콘텐츠)·봉급날로 루비와 🎫 가속권을 모아요. 루비는 상점에서 가속권·자원으로 바꿔요.</p>
        <button className={all.ruby > 0 ? 'primary' : ''} disabled={all.ruby <= 0 && all.boosts <= 0} style={{ width: '100%', marginTop: 6 }} onClick={() => actions.apply(claimAll)}>
          {all.ruby > 0 || all.boosts > 0 ? `🎁 모두받기 · 💎 ${fmt(all.ruby)}${all.boosts ? ` + 🎫 ${all.boosts}장` : ''} (${all.count}개)` : '🎁 모두받기 · 받을 보상이 없어요'}
        </button>
      </Card>
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'daily', icon: '📅', label: '매일 할 일', badge: dReady + (spoils.length ? 1 : 0) || undefined },
          { id: 'ach', icon: '🏅', label: '업적', badge: aReady || undefined },
          { id: 'shop', icon: '🛒', label: '루비 상점' },
        ]}
      />
      <Safe key={tab} where={`shop/${tab}`}>
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
            할 일을 다 하면 받을 수 있어요. 3개 모두 받으면 보너스 💎 {DAILY_BONUS_RUBY} + 🎫 가속권 {DAILY_BONUS_BOOSTS}장{g.bonus ? ' (오늘 받음 ✓)' : ''}. 연속 {g.streak}일째.
          </p>
        </Card>
      )}
      {tab === 'daily' && (
        <Card title="🏆 전과 보상" right={<small className="muted">작은 전과 하루 최대 💎 {SPOIL_SMALL_CAP} · 🎫 {SPOIL_SMALL_BOOST_CAP}</small>}>
          {spoils.length === 0 && <p className="small muted">본부·개인·국방·외교·사회·경제·문화 어디서든 일을 마치면 루비와 가속권이 여기 쌓여요.</p>}
          {spoils.map((x) => (
            <div key={x.k} className="list-row small">
              <span style={{ flex: 1 }}>
                {SPOILS[x.k].icon} {SPOILS[x.k].name} ×{x.n}
              </span>
              <b>💎 {x.ruby}{x.boosts ? ` · 🎫 ${x.boosts}` : ''}</b>
            </div>
          ))}
          {spoils.length > 0 && (
            <button className="primary" onClick={() => actions.apply(claimSpoils)}>
              전과 보상 받기
            </button>
          )}
          <Fold title="📋 어디서 얼마나 받나요(모든 콘텐츠)">
            {['본부', '개인', '국방', '외교', '사회', '경제', '문화'].map((w) => (
              <p key={w} className="small">
                <b>{w}</b>{' '}
                {(Object.keys(SPOILS) as Array<keyof typeof SPOILS>)
                  .filter((k) => SPOILS[k].where === w && SPOILS[k].ruby > 0)
                  .map((k) => `${SPOILS[k].icon} ${SPOILS[k].name} 💎${SPOILS[k].ruby}${SPOILS[k].boosts ? `+🎫${SPOILS[k].boosts}` : ''}`)
                  .join(' · ')}
                {w === '본부' ? ' · 💵 봉급 받기(아래)' : ''}
              </p>
            ))}
          </Fold>
          <p className="small muted">💵 봉급 받기: 봉급 1마다 나라 예산 {PAY_BUDGET_PER_SALARY} · 1시간치마다 💎1(하루 {PAY_RUBY_CAP}) · {PAY_BOOST_HOURS}시간치마다 🎫1(하루 {PAY_BOOST_CAP})
          </p>
        </Card>
      )}
      {tab === 'ach' && (
        <Card title="업적" right={<small className="muted">{achList(state).filter((a) => g.got.includes(a.id)).length}/{achList(state).length}</small>}>
          {achList(state).map((a) => {
            const st = achState(state, a);
            return (
              <div key={a.id} className={`list-row small ${st.got ? 'muted' : ''}`}>
                <span style={{ flex: 1 }}>
                  {a.icon} <b>{a.name}</b> · {a.text} {st.have}/{st.need}
                  <Bar have={st.have} need={st.need} />
                </span>
                <button className={st.ready ? 'primary' : ''} disabled={!st.ready} onClick={() => actions.apply((s) => claimAch(s, a.id))}>
                  {st.got ? '받음' : `💎 ${a.ruby} 🎫${achBoosts(a)}`}
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
      </Safe>
    </>
  );
}
