// 11-28 ICBM 영상 6편(모든 나라 공통 1세트). 영상 파일: src/assets/video/icbm-<장면>.mp4
// 글자(나라·목표 도시)는 영상 위에 게임이 얹음. 영상이 아직 없으면 비슷한 장면 그림 + 움직임으로 대신 보여 줌.
// 설정 → "ICBM 영상"을 끄면 영상 없이 알림만.
import { useEffect, useState, useSyncExternalStore } from 'react';
import type { GameState } from '../game/state';
import { ICBM_CLIPS, type IcbmClip } from '../game/strat';
import { crisisArt, sceneArt } from './scenes';

const FILES = import.meta.glob('../assets/video/icbm-*.mp4', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
const URLS: Record<string, string> = {};
for (const [p, u] of Object.entries(FILES)) URLS[p.split('/').pop()!.replace(/\.mp4$/, '').replace(/^icbm-/, '')] = u;
export const clipUrl = (k: IcbmClip): string | null => URLS[k] ?? null;
const STILL: Record<IcbmClip, () => string | null> = {
  test: () => sceneArt('launch', false),
  launch: () => sceneArt('launch', true),
  intercept: () => sceneArt('strike', true),
  hit: () => sceneArt('strike', false),
  nuke: () => crisisArt('nuke') ?? sceneArt('strike', true),
  deploy: () => sceneArt('airbase', true),
};

const KEY = 'mw-icbm-video';
const subs = new Set<() => void>();
const read = () => {
  try {
    return localStorage.getItem(KEY) !== '0';
  } catch {
    return true;
  }
};
let on = read();
export function setIcbmVideo(v: boolean) {
  on = v;
  try {
    if (v) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, '0');
  } catch {
    /* 무시 */
  }
  subs.forEach((f) => f());
}
export function useIcbmVideo(): [boolean, (v: boolean) => void] {
  const v = useSyncExternalStore((f) => (subs.add(f), () => void subs.delete(f)), () => on, () => on);
  return [v, setIcbmVideo];
}

export function IcbmVideo({ state, onDone }: { state: GameState; onDone: () => void }) {
  const [enabled] = useIcbmVideo();
  const cue = state.strat?.clips?.[0];
  const [ended, setEnded] = useState(false);
  useEffect(() => setEnded(false), [cue?.atMs, cue?.key]);
  const url = cue ? clipUrl(cue.key) : null;
  // 그림으로 대신 보여 줄 때는 5초 뒤 저절로 닫힘
  useEffect(() => {
    if (!cue || !enabled || url) return;
    const t = setTimeout(() => setEnded(true), 5000);
    return () => clearTimeout(t);
  }, [cue, enabled, url]);
  useEffect(() => {
    if (cue && !enabled) onDone();
  }, [cue, enabled, onDone]);
  if (!cue || !enabled) return null;
  const name = ICBM_CLIPS.find((c) => c.key === cue.key)?.name ?? '';
  const still = STILL[cue.key]();
  return (
    <div className={`icbm-video k-${cue.key}`} role="dialog" aria-label={name}>
      <div className="icbm-frame">
        {url ? (
          <video src={url} autoPlay muted playsInline onEnded={() => setEnded(true)} onError={() => setEnded(true)} />
        ) : (
          <div className="icbm-still" style={still ? { backgroundImage: `url(${still})` } : undefined} />
        )}
        <div className="icbm-cap">
          <small>{name}</small>
          <b>{cue.title}</b>
          <span>{cue.sub}</span>
        </div>
        <button className="icbm-skip" onClick={onDone}>{ended ? '닫기 ✕' : '건너뛰기 ⏭'}</button>
      </div>
      {ended && <button className="icbm-close wide" onClick={onDone}>확인</button>}
    </div>
  );
}
