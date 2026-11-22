import { useCallback, useEffect, useRef, useState } from 'react';
import * as G from './game/state';
import { deleteSave, exportCode, importCode, loadGame, saveGame } from './game/save';
import { SCREENS, type GameActions } from './ui/screens';
import { Shell } from './ui/Shell';
import { parseScreen, type Screen } from './ui/nav';
import { StartScreen } from './ui/StartScreen';

const TICK_MS = 250;
const AUTOSAVE_MS = 5000;

/** 꺼 둔 사이 흐른 시간을 반영하고, 알림 글을 만든다 */
function resume(saved: G.GameState, now: number): { state: G.GameState; notice: string } {
  const away = now - saved.lastRealTime;
  const before = saved.player.pendingSalary;
  const state = G.catchUp(saved, now);
  if (away < 60 * 1000) return { state, notice: '' };
  const hours = away / (60 * 60 * 1000);
  const got = Math.floor(state.player.pendingSalary - before);
  const capped = state.player.pendingSalary >= G.pendingCap(state) - 0.001;
  return {
    state,
    notice:
      `자리를 비운 ${hours < 1 ? `${Math.round(hours * 60)}분` : `${hours.toFixed(1)}시간`} 동안 ` +
      `세계가 ${hours.toFixed(1)}일 흘렀어요. 봉급 +${got.toLocaleString('ko-KR')}` +
      (capped ? ' (12시간 한도까지 찼어요)' : ''),
  };
}

export function App() {
  const [init] = useState(() => {
    const saved = loadGame();
    return saved ? resume(saved, Date.now()) : { state: null, notice: '' };
  });
  const [state, setState] = useState<G.GameState | null>(init.state);
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
  const go = (s: Screen) => {
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
  const speedRef = useRef(1);
  const stateRef = useRef(state);
  stateRef.current = state;

  // 실시간 시계
  useEffect(() => {
    const t = setInterval(() => {
      setState((s) => (s ? G.catchUp(s, Date.now(), speedRef.current) : s));
    }, TICK_MS);
    return () => clearInterval(t);
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
    saveGame(r.state);
    return null;
  }, []);

  if (!state) {
    return (
      <StartScreen
        onStart={(name, countryId) => {
          const s = G.newGame(name, countryId, Date.now());
          saveGame(s);
          setState(s);
          setNotices([]);
        }}
        onImport={doImport}
      />
    );
  }

  const update = (f: (s: G.GameState) => G.GameState) =>
    setState((s) => (s ? f(G.catchUp(s, Date.now(), speedRef.current)) : s));

  const actions: GameActions = {
    claim: () => update(G.claimSalary),
    save: () => saveGame(G.catchUp(state, Date.now(), speedRef.current)),
    load: () => {
      const saved = loadGame();
      if (saved) {
        const r = resume(saved, Date.now());
        setState(r.state);
        setNotice(r.notice);
      }
    },
    exportCode: () => exportCode(G.catchUp(state, Date.now(), speedRef.current)),
    importCode: doImport,
    reset: () => {
      deleteSave();
      setState(null);
      setNotices([]);
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
  };

  const View = SCREENS[screen];
  return (
    <Shell state={state} screen={screen} speed={speed} go={go} back={back}>
      <View state={state} speed={speed} notices={notices} actions={actions} go={go} />
    </Shell>
  );
}
