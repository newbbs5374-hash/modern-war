import { checkVictory } from './game/victory';
import { useCallback, useEffect, useRef, useState } from 'react';
import * as G from './game/state';
import { firstTestGrant } from './game/testgrant';
import { deleteSave, exportCode, importCode, loadGame, saveGame } from './game/save';
import { SCREENS, type GameActions } from './ui/screens';
import { Shell } from './ui/Shell';
import { parseScreen, routeTo, type Screen } from './ui/nav';
import { StartScreen } from './ui/StartScreen';
import { AideReport } from './ui/AideReport';
import { PeopleProvider } from './ui/People';
import { addReports as addReports0, dismissReport } from './game/report';
import { trackGoals } from './game/goals';
import { summarizeAway, type AwaySummary } from './game/orders';
import { AwayModal, OrdersModal } from './ui/OrdersModal';

/** 이만큼 넘게 비웠다 오면 '자리 비운 동안' 보고 창 */
const AWAY_REPORT_MS = 20 * 60e3;

/** 바뀌기 전·후 비교: 부관 보고 + 매일 할 일·업적 */
const addReports = (b: G.GameState | null, a: G.GameState) => trackGoals(b, addReports0(b, a));

const TICK_MS = 250;
const AUTOSAVE_MS = 5000;
const SEEN_KEY = 'modern-war-herald-seen';

function readSeen(): number {
  try {
    return Number(localStorage.getItem(SEEN_KEY)) || 0;
  } catch {
    return 0;
  }
}
function writeSeen(t: number) {
  try {
    localStorage.setItem(SEEN_KEY, String(t));
  } catch {
    /* 무시 */
  }
}

/** 꺼 둔 사이 흐른 시간을 반영하고, 알림 글을 만든다 */
function resume(saved: G.GameState, now: number): { state: G.GameState; notice: string; away?: AwaySummary } {
  const away = now - saved.lastRealTime;
  const before = saved.player.pendingSalary;
  const state = addReports(saved, G.catchUp(saved, now));
  if (away < 60 * 1000) return { state, notice: '' };
  const sum = away >= AWAY_REPORT_MS ? summarizeAway(saved, state, away) : undefined;
  const hours = away / (60 * 60 * 1000);
  const got = Math.floor(state.player.pendingSalary - before);
  const capped = state.player.pendingSalary >= G.pendingCap(state) - 0.001;
  return {
    state,
    notice:
      `자리를 비운 ${hours < 1 ? `${Math.round(hours * 60)}분` : `${hours.toFixed(1)}시간`} 동안 ` +
      `세계가 ${hours.toFixed(1)}일 흘렀어요. 봉급 +${got.toLocaleString('ko-KR')}` +
      (capped ? ' (12시간 한도까지 찼어요)' : ''),
    away: sum,
  };
}

export function App() {
  const [init] = useState(() => {
    const saved = loadGame();
    return saved ? resume(saved, Date.now()) : { state: null, notice: '', away: undefined };
  });
  const [state, setState] = useState<G.GameState | null>(init.state);
  const [away, setAway] = useState<AwaySummary | null>(init.away ?? null);
  const [ordersOpen, setOrdersOpen] = useState(false);
  const [notices, setNotices] = useState<string[]>(init.notice ? [init.notice] : []);
  const setNotice = (t: string) => {
    if (t) setNotices((l) => [t, ...l].slice(0, 20));
  };
  const [screen, setScreen] = useState<Screen>(() => parseScreen(location.hash));
  const history = useRef<Screen[]>([]);

  // 주소의 #화면 이름 = 지금 화면(새로고침해도 같은 화면)
  useEffect(() => {
    const onHash = () => setScreen(parseScreen(location.hash));
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  // 같은 화면 안에서 다른 작은 탭으로 갈 때도 다시 그리도록(작은 탭은 화면을 열 때 읽음)
  const [visit, setVisit] = useState(0);
  const go = (to: Screen) => {
    const s = routeTo(to);
    setVisit((v) => v + 1);
    if (s === screen) return;
    history.current.push(screen);
    location.hash = s === 'home' ? '' : s;
    setScreen(s);
  };
  const back = () => {
    const prev = history.current.pop() ?? 'home';
    location.hash = prev === 'home' ? '' : prev;
    setScreen(prev);
  };
  const [speed, setSpeedState] = useState(1);
  // 전령을 마지막으로 본 시각(세계 시간). 그 뒤의 내 나라 소식 + 새 알림이 있으면 빨간 점
  const [seenT, setSeenT] = useState(readSeen);
  const [noticesSeen, setNoticesSeen] = useState(0);
  useEffect(() => {
    if (screen !== 'herald' || !state) return;
    const t = state.world.events[0]?.t ?? 0;
    if (t > seenT) {
      setSeenT(t);
      writeSeen(t);
    }
    if (noticesSeen !== notices.length) setNoticesSeen(notices.length);
  }, [screen, state, seenT, notices.length, noticesSeen]);
  const speedRef = useRef(1);
  const stateRef = useRef(state);
  stateRef.current = state;

  // 실시간 시계
  useEffect(() => {
    const t = setInterval(() => {
      setState((s) => (s ? addReports(s, G.catchUp(s, Date.now(), speedRef.current)) : s));
    }, TICK_MS);
    return () => clearInterval(t);
  }, []);

  // 창을 오래 숨겼다가 돌아오면(휴대폰 화면 끄기 등) '자리 비운 동안' 보고
  useEffect(() => {
    let snap: { s: G.GameState; t: number } | null = null;
    const onVis = () => {
      if (document.visibilityState === 'hidden') {
        if (stateRef.current) snap = { s: stateRef.current, t: Date.now() };
        return;
      }
      if (!snap || !stateRef.current) return;
      const ms = Date.now() - snap.t;
      const b = snap.s;
      snap = null;
      if (ms < AWAY_REPORT_MS) return;
      const now = addReports(stateRef.current, G.catchUp(stateRef.current, Date.now(), speedRef.current));
      stateRef.current = now;
      setState(now);
      setAway(summarizeAway(b, now, ms));
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  // 자동 저장
  useEffect(() => {
    const save = () => {
      if (stateRef.current) saveGame(G.catchUp(stateRef.current, Date.now(), speedRef.current));
    };
    const t = setInterval(save, AUTOSAVE_MS);
    const onHide = () => document.visibilityState === 'hidden' && save();
    window.addEventListener('pagehide', save);
    document.addEventListener('visibilitychange', onHide);
    return () => {
      clearInterval(t);
      window.removeEventListener('pagehide', save);
      document.removeEventListener('visibilitychange', onHide);
    };
  }, []);

  const doImport = useCallback((code: string): string | null => {
    const s = importCode(code);
    if (!s) return '저장 코드가 올바르지 않아요.';
    const r = resume(s, Date.now());
    setState(r.state);
    setNotice(r.notice);
    setAway(r.away ?? null);
    saveGame(r.state);
    return null;
  }, []);

  if (!state) {
    return (
      <StartScreen
        onStart={(name, countryId, randomLeaders) => {
          const s = firstTestGrant(G.newGame(name, countryId, Date.now(), { randomLeaders }));
          saveGame(s);
          setState(s);
          setNotices([]);
        }}
        onImport={doImport}
      />
    );
  }

  // 버튼으로 바꾼 것은 바로 저장(창을 금방 닫아도 남도록)
  const update = (f: (s: G.GameState) => G.GameState) => {
    if (!stateRef.current) return;
    const next = addReports(stateRef.current, checkVictory(f(G.catchUp(stateRef.current, Date.now(), speedRef.current))));
    stateRef.current = next;
    setState(next);
    saveGame(next);
  };

  const actions: GameActions = {
    claim: () => update(G.claimSalary),
    save: () => saveGame(G.catchUp(state, Date.now(), speedRef.current)),
    load: () => {
      const saved = loadGame();
      if (saved) {
        const r = resume(saved, Date.now());
        setState(r.state);
        setNotice(r.notice);
        setAway(r.away ?? null);
      }
    },
    exportCode: () => exportCode(G.catchUp(state, Date.now(), speedRef.current)),
    importCode: doImport,
    reset: () => {
      deleteSave();
      setState(null);
      setNotices([]);
      setNoticesSeen(0);
      setSeenT(0);
      writeSeen(0);
      history.current = [];
      location.hash = '';
      setScreen('home');
      speedRef.current = 1;
      setSpeedState(1);
    },
    skip: (ms) => update((s) => G.skip(s, ms)),
    setSpeed: (x) => {
      update((s) => s); // 지금까지를 옛 속도로 정리
      speedRef.current = x;
      setSpeedState(x);
    },
    setRank: (i) => update((s) => G.setRank(s, i)),
    apply: (f) => update(f),
    applyWith: (f) => {
      let out;
      update((s) => {
        const r = f(s);
        out = r.out;
        return r.state;
      });
      return out;
    },
  };

  const View = SCREENS[screen];
  return (
    <PeopleProvider state={state} actions={actions} go={go}>
    <Shell
      state={state}
      screen={screen}
      speed={speed}
      go={go}
      back={back}
      overlay={
        screen !== 'battle' && (
          <>
            <AideReport state={state} onNext={() => update(dismissReport)} />
            {away && <AwayModal sum={away} onClose={() => setAway(null)} onOrders={() => (setAway(null), setOrdersOpen(true))} />}
            {ordersOpen && <OrdersModal state={state} apply={update} onClose={() => setOrdersOpen(false)} />}
          </>
        )
      }
    >
      <View
        key={`${screen}-${visit}`}
        state={state}
        speed={speed}
        notices={notices}
        unread={state.world.events.filter((e) => e.mine && e.t > seenT).length + (notices.length - noticesSeen)}
        actions={actions}
        go={go}
      />
    </Shell>
    </PeopleProvider>
  );
}
