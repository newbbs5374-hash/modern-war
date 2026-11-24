// 카카오 서버 저장을 게임에 잇는 고리(App에서 한 번 씀)
import { useCallback, useEffect, useRef, useState } from 'react';
import type { GameState } from '../game/state';
import {
  checkLogin,
  cloudView,
  decide,
  fetchHead,
  fetchSave,
  pushSave,
  readMeta,
  setCloudBusy,
  takeLoginResult,
  writeMeta,
  type ServerHead,
} from '../game/cloud';

/** 서로 다른 판이 부딪쳤을 때 묻는 것 */
export interface CloudAsk {
  server: GameState;
  head: ServerHead;
}

const PUSH_DELAY_MS = 3000;

/** 방금(몇 초 안) 사람이 누르거나 쳤는지. 브라우저가 모르면 그렇다고 봄 */
function byUser(): boolean {
  const ua = (navigator as Navigator & { userActivation?: { isActive: boolean } }).userActivation;
  return !ua || ua.isActive;
}
const POLL_MS = 90e3;

export function useCloudSync(opts: {
  stateRef: { current: GameState | null };
  /** 서버 저장으로 바꾸기 */
  adopt: (s: GameState, note: string) => void;
  notice: (t: string) => void;
}) {
  const optsRef = useRef(opts);
  optsRef.current = opts;
  const [ask, setAsk] = useState<CloudAsk | null>(null);
  const running = useRef<Promise<void> | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** 서버와 맞추기. startPick = 시작 화면에서 '이어 하기'를 직접 누름 */
  const syncOnce = useCallback(async (startPick = false, depth = 0): Promise<void> => {
    if (cloudView().status !== 'in') return;
    const { stateRef, adopt, notice } = optsRef.current;
    setCloudBusy(true);
    try {
      const head = await fetchHead();
      if (!head) return setCloudBusy(false, '서버와 연결이 안 돼요. 잠시 뒤 다시 해요.');
      const local = stateRef.current;
      const meta = readMeta();
      const d = decide(local, meta, head);
      if (d === 'upload' || d === 'force') {
        const r = await pushSave(local!, meta, d === 'force');
        if (r === 'conflict' && depth < 2) return syncOnce(false, depth + 1);
        if (r === 'ok' && meta.rev === null) notice('☁️ 이 기기 저장을 카카오 서버로 옮겼어요. 이제 다른 기기에서도 이어 할 수 있어요.');
        setCloudBusy(false, r === 'fail' ? '서버에 못 올렸어요. 잠시 뒤 다시 해요.' : '');
        return;
      }
      if (d === 'adopt') {
        // 새로 시작을 눌러 시작 화면에 있을 때는 저절로 되살리지 않음(시작 화면 버튼으로)
        if (!local && meta.rev !== null && !startPick) return setCloudBusy(false);
        const got = await fetchSave();
        if (!got?.state) return setCloudBusy(false, '서버 저장을 읽지 못했어요.');
        writeMeta({ rev: got.head.rev, dirty: false, actAt: got.head.info?.actAt ?? 0 });
        adopt(got.state, local ? '☁️ 다른 기기에서 이어 한 진행을 받아 왔어요.' : '☁️ 카카오 서버 저장으로 이어 해요.');
        return setCloudBusy(false);
      }
      if (d === 'ask') {
        const got = await fetchSave();
        if (got?.state) setAsk({ server: got.state, head: got.head });
        return setCloudBusy(false);
      }
      setCloudBusy(false);
    } catch {
      setCloudBusy(false, '서버와 연결이 안 돼요.');
    }
  }, []);

  const sync = useCallback((startPick = false) => {
    if (!running.current) running.current = syncOnce(startPick).finally(() => (running.current = null));
    return running.current;
  }, [syncOnce]);

  /** 직접 한 일이 생김 → 잠시 뒤 서버로.
   *  화면이 저절로 바꾼 것(창을 열 때 정리 등)은 세지 않음: 그걸 세면 옛 기기가 새 진행을 덮어쓸 수 있음 */
  const markDirty = useCallback((sure = false) => {
    if (!sure && !byUser()) return;
    writeMeta({ ...readMeta(), dirty: true, actAt: Date.now() });
    if (cloudView().status !== 'in') return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void sync(), PUSH_DELAY_MS);
  }, [sync]);

  /** 묻기 창에서 고름 */
  const choose = useCallback(async (pick: 'server' | 'local') => {
    const a = ask;
    setAsk(null);
    if (!a) return;
    const { stateRef, adopt, notice } = optsRef.current;
    if (pick === 'server') {
      writeMeta({ rev: a.head.rev, dirty: false, actAt: a.head.info?.actAt ?? 0 });
      adopt(a.server, '☁️ 카카오 서버 저장으로 바꿨어요.');
    } else if (stateRef.current) {
      const r = await pushSave(stateRef.current, readMeta(), true);
      notice(r === 'ok' ? '☁️ 이 기기 판을 서버에 올렸어요(서버의 다른 판은 덮어씀).' : '서버에 못 올렸어요. 잠시 뒤 다시 해요.');
    }
  }, [ask]);

  useEffect(() => {
    const got = takeLoginResult();
    if (got) optsRef.current.notice(got.ok ? '✅ 카카오로 로그인했어요.' : `카카오 로그인이 안 됐어요${got.why === 'cancel' ? '(취소함)' : ` (${got.why})`}.`);
    void checkLogin().then((st) => {
      if (st === 'in') void sync();
    });
    const onVis = () => {
      if (document.visibilityState === 'visible') void sync();
      else if (readMeta().dirty) void sync(); // 숨기기 직전 마저 올림
    };
    document.addEventListener('visibilitychange', onVis);
    const t = setInterval(() => document.visibilityState === 'visible' && void sync(), POLL_MS);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      clearInterval(t);
    };
  }, [sync]);

  return { ask, choose, dismiss: () => setAsk(null), markDirty, sync };
}
