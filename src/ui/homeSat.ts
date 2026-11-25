// 본부 지도 실제 위성 바탕(11/25 대장 요청 K1·K2·K3·K4·K5).
// scripts/gen_homesat.py · gen_homerelief.py 가 만든 public/home-sat/ 자료를 필요할 때만 내려받음.
// - <id>-0.webp: 나라 전체 위성 사진(확대 1배), <id>/1-x-y.webp: 확대용 고해상 조각
// - <id>.json: 범위·조각 목록·정밀 해안선(세계 좌표 1도=6)
// - <id>-depth.webp: 바다 깊이 색, <id>-sh-am|noon|pm.webp: 해 방향별 산 그림자
// 위성 사진: ESA WorldCover 2021 Sentinel-2 합성(CC BY 4.0) · 높이·수심: Mapzen Terrarium(AWS Open Data)
import { useEffect, useState } from 'react';
import { GEO } from '../data/realGeo';

export interface HomeSat {
  /** 위성 사진 범위 [경도0, 위도0, 경도1, 위도1] */
  b: [number, number, number, number];
  /** 확대용 전체 크기(칸) */
  w1: number;
  h1: number;
  tile: number;
  tiles: Array<[number, number]>;
  /** 정밀 해안선(세계 좌표 path) */
  coast: string;
  /** 바다 깊이·산 그림자 그림 범위 */
  rb: [number, number, number, number] | null;
}

const BASE = `${import.meta.env.BASE_URL}home-sat/`;
export const satUrl = (name: string) => BASE + name;

const CACHE = new Map<string, HomeSat | null>();
const PENDING = new Map<string, Promise<HomeSat | null>>();

async function getJson<T>(name: string): Promise<T | null> {
  try {
    const r = await fetch(BASE + name);
    if (!r.ok) return null;
    return (await r.json()) as T;
  } catch {
    return null;
  }
}

export function loadHomeSat(id: string): Promise<HomeSat | null> {
  if (CACHE.has(id)) return Promise.resolve(CACHE.get(id) ?? null);
  const p0 = PENDING.get(id);
  if (p0) return p0;
  const p = Promise.all([getJson<Omit<HomeSat, 'rb'>>(`${id}.json`), getJson<{ b: HomeSat['rb'] }>(`${id}-relief.json`)]).then(([s, r]) => {
    PENDING.delete(id);
    if (!s) return null; // 연결 끊김: 다음에 다시
    const out: HomeSat = { ...s, rb: r?.b ?? null };
    CACHE.set(id, out);
    return out;
  });
  PENDING.set(id, p);
  return p;
}

export function useHomeSat(id: string): HomeSat | null {
  const [s, setS] = useState<HomeSat | null>(() => CACHE.get(id) ?? null);
  useEffect(() => {
    if (CACHE.get(id)) {
      setS(CACHE.get(id) ?? null);
      return;
    }
    let live = true;
    setS(null);
    loadHomeSat(id).then((d) => live && setS(d));
    return () => {
      live = false;
    };
  }, [id]);
  return s;
}

/** 경도·위도 범위 → 세계 좌표 사각형(1도=6, 경도 -15부터) */
export function geoRect(b: [number, number, number, number]): { x: number; y: number; w: number; h: number } {
  const [lon0, lat0, lon1, lat1] = b;
  const l = lon0 < GEO.L0 ? lon0 + 360 : lon0;
  return { x: (l - GEO.L0) * GEO.PX, y: (GEO.B1 - lat1) * GEO.PX, w: (lon1 - lon0) * GEO.PX, h: (lat1 - lat0) * GEO.PX };
}

/** 해 방향 그림자 섞기(실제 시각): 아침·한낮·저녁 세 장의 비율. 밤엔 0 */
export function sunMix(d = new Date()): { am: number; noon: number; pm: number } {
  const h = d.getHours() + d.getMinutes() / 60;
  if (h < 6 || h >= 19) return { am: 0, noon: 0, pm: 0 };
  if (h < 12) {
    const t = Math.max(0, (h - 7) / 5); // 7시 아침 → 12시 한낮
    return { am: 1 - t, noon: t, pm: 0 };
  }
  const t = Math.min(1, (h - 12) / 5); // 12시 → 17시 저녁
  return { am: 0, noon: 1 - t, pm: t };
}
