import { drillsNow } from '../game/officer';
import { useState, type ReactNode } from 'react';
import { CURRENCIES } from '../data/catalog';
import { RANKS } from '../data/ranks';
import { countryById } from '../data/world';
import { gameClock, type GameState } from '../game/state';
import { fmt } from './common';
import { Flag } from './flag';
import { Face } from './Portrait';
import { NAV, SCREEN_TITLES, type Screen } from './nav';

interface Props {
  state: GameState;
  screen: Screen;
  speed: number;
  go: (s: Screen) => void;
  back: () => void;
  children: ReactNode;
  /** 화면 위에 뜨는 것(부관 보고) */
  overlay?: ReactNode;
}

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * 화면 틀(용흔 참고): 휴대폰 세로 비율 고정 · 위 띠 고정 · 가운데만 스크롤 · 아래 메뉴 6칸 고정.
 * 본부(홈) 위 띠 = 장교 요약 + 재화 + 설정. 다른 화면 = ← · 화면 이름 · 재화 · 설정 · 본부.
 */
export function Shell({ state, screen, speed, go, back, children, overlay }: Props) {
  const [walletOpen, setWalletOpen] = useState(false);
  const me = countryById(state.player.countryId);
  const rank = RANKS[state.player.rankIndex];
  const clock = gameClock(state.worldMs);

  const amount = (id: string) =>
    id === 'salary'
      ? state.player.salary
      : id === 'merit'
        ? state.officer.merit
        : id === 'boost'
          ? (state.officer.boosts ?? 0)
          : id === 'drill'
            ? drillsNow(state.officer, state.worldMs).count
            : 0;
  const wallet = (
    <button className="wallet" onClick={() => setWalletOpen((v) => !v)} aria-label="보유 재화 보기">
      <span>💵 {fmt(state.player.salary)}</span>
      <span>🎫 {fmt(state.officer.boosts ?? 0)}</span>
      <span>💎 0</span>
    </button>
  );
  const gear = (
    <button className="icon-btn" onClick={() => go('settings')} aria-label="설정">
      ⚙️
    </button>
  );

  return (
    <div className="frame">
      <header className="top">
        {screen === 'home' ? (
          <button className="who" onClick={() => go('officer')}>
            <span className="portrait">
              <Face keys={['player', `leader-${me.id}`]} fallback={<Flag id={me.id} />} />
            </span>
            <span>
              <b>
                {rank.name} {state.player.name}
              </b>
              <small>
                {me.name} · {clock.month}/{clock.day} {pad(clock.hour)}:{pad(clock.minute)}
                {speed !== 1 ? ` ×${speed}` : ''}
              </small>
            </span>
          </button>
        ) : (
          <>
            <button className="icon-btn" onClick={back} aria-label="이전">
              ←
            </button>
            <h1 className="title">{SCREEN_TITLES[screen]}</h1>
          </>
        )}
        {wallet}
        {gear}
        {screen !== 'home' && (
          <button className="icon-btn" onClick={() => go('home')} aria-label="본부">
            🏠
          </button>
        )}
        {walletOpen && (
          <div className="bubble" role="dialog" aria-label="보유 재화" onClick={() => setWalletOpen(false)}>
            {CURRENCIES.map((c) => (
              <div key={c.id} className="bubble-row">
                <span className="bubble-ico">{c.icon}</span>
                <div>
                  <b>{c.name}</b>
                  <small>{c.where}</small>
                </div>
                <strong>{fmt(amount(c.id))}</strong>
              </div>
            ))}
          </div>
        )}
      </header>

      <main className="view" data-screen={screen}>
        {children}
      </main>

      {overlay}

      <nav className="bottom">
        {NAV.map((n) => (
          <button
            key={n.screen}
            className={[screen === n.screen ? 'active' : '', n.main ? 'main' : '', n.locked ? 'locked' : ''].join(' ').trim()}
            onClick={() => go(n.screen)}
            aria-label={n.locked ? `${n.label} · ${n.locked}` : n.label}
          >
            <span className="ico">{n.icon}</span>
            <small>{n.label}</small>
          </button>
        ))}
      </nav>
    </div>
  );
}
