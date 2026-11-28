// 11-27 지도 움직임 끄기: 세계 지도(지구본·평면)·본부 지도의 움직이는 연출(비행기·배·차·공격선 불빛·깜빡임·구름·자동 회전)을 한 번에 끄고 켬.
// 기기마다 기억(localStorage). 끄면 <html data-map-still> 이 붙어 CSS 움직임도 멈춤.
import { useSyncExternalStore } from 'react';

const KEY = 'mw-map-motion';
const subs = new Set<() => void>();

function read(): boolean {
  try {
    return localStorage.getItem(KEY) !== '0';
  } catch {
    return true;
  }
}
let on = read();
function mark() {
  if (typeof document === 'undefined') return;
  if (on) document.documentElement.removeAttribute('data-map-still');
  else document.documentElement.setAttribute('data-map-still', '');
}
mark();

/** 지도 움직임이 켜져 있나 */
export function mapMotionOn(): boolean {
  return on;
}
export function setMapMotion(v: boolean) {
  on = v;
  try {
    if (v) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, '0');
  } catch {
    /* 저장 못 해도 이번 판은 그대로 */
  }
  mark();
  subs.forEach((f) => f());
}
function subscribe(f: () => void) {
  subs.add(f);
  return () => {
    subs.delete(f);
  };
}
/** 화면에서 쓰는 손잡이: [켜짐, 바꾸기] */
export function useMapMotion(): [boolean, (v: boolean) => void] {
  const v = useSyncExternalStore(subscribe, mapMotionOn, mapMotionOn);
  return [v, setMapMotion];
}

/** 지도 위 빠른 버튼 */
export function MapMotionButton() {
  const [v, set] = useMapMotion();
  const label = v ? '움직임 끄기' : '움직임 켜기';
  return (
    <button aria-label={label} title={`${label} (비행기·배·불빛 등)`} className={v ? '' : 'off'} onClick={() => set(!v)}>
      {v ? '✈️' : '⏸️'}
    </button>
  );
}

// 11/28 대장 요청: 지구 3D의 이동 노선(전쟁·연합·공격 곡선)을 지우는 버튼. 기기마다 기억.
const RKEY = 'mw-map-routes';
const rsubs = new Set<() => void>();
function readRoutes(): boolean {
  try {
    return localStorage.getItem(RKEY) !== '0';
  } catch {
    return true;
  }
}
let routes = readRoutes();
export function mapRoutesOn(): boolean {
  return routes;
}
export function setMapRoutes(v: boolean) {
  routes = v;
  try {
    if (v) localStorage.removeItem(RKEY);
    else localStorage.setItem(RKEY, '0');
  } catch {
    /* 저장 못 해도 이번 판은 그대로 */
  }
  rsubs.forEach((f) => f());
}
function rsubscribe(f: () => void) {
  rsubs.add(f);
  return () => {
    rsubs.delete(f);
  };
}
export function useMapRoutes(): [boolean, (v: boolean) => void] {
  const v = useSyncExternalStore(rsubscribe, mapRoutesOn, mapRoutesOn);
  return [v, setMapRoutes];
}
/** 지도 위 빠른 버튼: 이동 노선 보이기/지우기 */
export function MapRoutesButton() {
  const [v, set] = useMapRoutes();
  const label = v ? '이동 노선 지우기' : '이동 노선 보이기';
  return (
    <button aria-label={label} title={`${label} (전쟁·연합·공격 곡선)`} className={v ? '' : 'off'} onClick={() => set(!v)}>
      {v ? '〰️' : '➖'}
    </button>
  );
}
