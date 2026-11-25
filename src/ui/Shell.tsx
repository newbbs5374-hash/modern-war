import { drillsNow } from '../game/officer';
import { playerKeys } from '../data/looks';
import { goalsReady, rubyOf } from '../game/goals';
import { useState, type ReactNode } from 'react';
import { CURRENCIES } from '../data/catalog';
import { titleOf } from '../game/title';
import { countryById } from '../data/world';
import { gameClock, type GameState } from '../game/state';
import { fmt } from './common';
import { Flag } from './flag';
import { PersonFace } from './People';
import { NAV, SCREEN_TITLES, type Screen } from './nav';
import { UiIcon, fmtK } from './uiIcon';
import { citiesOf } from '../game/world';
import { moodLabel, presOf } from '../game/approval';
import { PresModal } from './PresUI';
import { reportCount } from './ReportScreen';

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
  const [presOpen, setPresOpen] = useState(false);
  const me = countryById(state.player.countryId);
  const rank = titleOf(state);
  const clock = gameClock(state.worldMs);

  const amount = (id: string) =>
    id === 'salary'
      ? state.player.salary
      : id === 'merit'
        ? state.officer.merit
        : id === 'boost'
          ? (state.officer.boosts ?? 0)
          : id === 'ruby'
            ? rubyOf(state)
          : id === 'drill'
            ? drillsNow(state.officer, state.worldMs).count
            : 0;
  const n = state.nations[me.id];
  const pres = presOf(state);
  // 맨 위 줄 = 주요 자원만(k 단위). 누르면 말풍선에 전부.
  const wallet = (
    <button className="wallet" onClick={() => setWalletOpen((v) => !v)} aria-label="자원 현황 보기">
      <span>💰{fmtK(n.treasury)}</span>
      <span>🪖{fmtK(n.troops)}</span>
      <span>💵{fmtK(state.player.salary)}</span>
      <span>💎{fmtK(rubyOf(state))}</span>
    </button>
  );
  const nationRows: Array<{ icon: string; name: string; where: string; v: string; tone?: string }> = [
    { icon: '🙂', name: '지지도', where: pres.impeachMs !== null ? '⚠️ 탄핵 위기' : '국민이 나를 지지하는 정도', v: String(Math.round(pres.approval)), tone: moodLabel(pres.approval).tone },
    { icon: '🤝', name: '신뢰도', where: state.officer.dismissDeadlineMs !== null ? '⚠️ 해임 위기' : '윗선·동료가 나를 믿는 정도', v: String(Math.round(state.officer.trust)), tone: moodLabel(state.officer.trust).tone },
    { icon: '💰', name: '국방예산', where: '부대 모집·시설·외교에 써요', v: fmt(n.treasury) },
    { icon: '🪖', name: '병력', where: '우리나라 전체 병력', v: fmt(n.troops) },
    { icon: '🏙️', name: '도시', where: '우리나라가 가진 도시', v: String(citiesOf(state.world, me.id).length) },
  ];
  const nRep = reportCount(state);
  const gear = (
    <>
      {/* 11-25 📨 보고: 건의·할 일을 한곳에서 */}
      <button className="icon-btn rep-btn" onClick={() => go('report')} aria-label={`보고 ${nRep}건`}>
        📨{nRep > 0 && <i className="rep-badge">{nRep}</i>}
      </button>
      {/* 본부가 아닌 화면은 위 띠가 좁아서 설정 대신 보고(설정은 본부에서) */}
      {screen === 'home' && (
        <button className="icon-btn" onClick={() => go('settings')} aria-label="설정">
          ⚙️
        </button>
      )}
    </>
  );

  return (
    <div className="frame">
      <header className="top">
        {screen === 'home' ? (
          <button className="who" onClick={() => go('personal')}>
            <span className="portrait">
              <PersonFace who={{ kind: 'player' }} keys={playerKeys(state.player)} fallback={<Flag id={me.id} />} />
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
          <div className="bubble res-bubble" role="dialog" aria-label="자원 현황" onClick={() => setWalletOpen(false)}>
            <b className="bubble-head">🏛️ 나라</b>
            {nationRows.map((r) => (
              <div key={r.name} className={`bubble-row ${r.tone ?? ''}`}>
                <span className="bubble-ico">{r.icon}</span>
                <div>
                  <b>{r.name}</b>
                  <small>{r.where}</small>
                </div>
                <strong>{r.v}</strong>
              </div>
            ))}
            <b className="bubble-head">👤 내 재화</b>
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
            <button className="bubble-more" onClick={() => setPresOpen(true)}>
              📊 국정 현황 자세히
            </button>
          </div>
        )}
      </header>

      <main className="view" data-screen={screen}>
        {children}
      </main>

      {overlay}
      {presOpen && <PresModal state={state} onClose={() => setPresOpen(false)} />}

      <nav className="bottom">
        {NAV.map((nv) => (
          <button
            key={nv.screen}
            className={[screen === nv.screen ? 'active' : '', nv.main ? 'main' : '', nv.locked ? 'locked' : ''].join(' ').trim()}
            onClick={() => go(nv.screen)}
            aria-label={nv.locked ? `${nv.label} · ${nv.locked}` : nv.label}
          >
            <span className="ico">
              <UiIcon label={nv.label} emoji={nv.icon} />
            </span>
            <small>{nv.label}</small>
            {nv.screen === 'shop' && goalsReady(state) > 0 && <i className="badge">{goalsReady(state)}</i>}
          </button>
        ))}
      </nav>
    </div>
  );
}
