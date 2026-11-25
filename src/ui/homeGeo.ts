// 나라별 실제 도로·철도·강·밤 불빛 점(세계 좌표 path). scripts/gen_homegeo.py 가 만든 src/assets/home/geo-<나라>.json 을 필요할 때만 불러옴.
// 본부 지도(HomeLand)와 세계지도 확대(WorldMap, 11/24 C3)가 함께 씀.
import { useEffect, useState } from 'react';

export interface HomeGeo {
  road: string;
  road2: string;
  rail: string;
  river: string;
  /** 가까이 보는 나라의 밤 불빛 점(밝기 3단계, 빈 문자열이면 그림 사용) */
  dots: [string, string, string];
}
const FILES = import.meta.glob('../assets/home/geo-*.json', { import: 'default' }) as Record<string, () => Promise<HomeGeo>>;
const CACHE = new Map<string, HomeGeo>();
const PENDING = new Map<string, Promise<HomeGeo | null>>();

export function loadHomeGeo(id: string): Promise<HomeGeo | null> {
  const hit = CACHE.get(id);
  if (hit) return Promise.resolve(hit);
  const p0 = PENDING.get(id);
  if (p0) return p0;
  const load = FILES[`../assets/home/geo-${id}.json`];
  if (!load) return Promise.resolve(null);
  const p = load()
    .then((d) => {
      CACHE.set(id, d);
      return d;
    })
    .catch(() => {
      // 새 버전이 올라와 옛 파일이 없어졌거나 연결이 끊김: 지도 선만 빼고 계속(다음에 다시 시도)
      PENDING.delete(id);
      return null;
    });
  PENDING.set(id, p);
  return p;
}

export function useHomeGeo(id: string): HomeGeo | null {
  const [g, setG] = useState<HomeGeo | null>(() => CACHE.get(id) ?? null);
  useEffect(() => {
    const hit = CACHE.get(id);
    if (hit) {
      setG(hit);
      return;
    }
    let live = true;
    loadHomeGeo(id).then((d) => live && setG(d));
    return () => {
      live = false;
    };
  }, [id]);
  return g;
}

/** 여러 나라를 한꺼번에(세계지도에서 화면에 보이는 나라만). on=false면 불러오지 않음 */
export function useHomeGeos(ids: string[], on: boolean): Record<string, HomeGeo> {
  const key = on ? ids.slice().sort().join(',') : '';
  const [got, setGot] = useState<Record<string, HomeGeo>>({});
  useEffect(() => {
    if (!key) return;
    let live = true;
    for (const id of key.split(',')) {
      if (CACHE.has(id)) continue;
      loadHomeGeo(id).then((d) => live && d && setGot((o) => ({ ...o, [id]: d })));
    }
    return () => {
      live = false;
    };
  }, [key]);
  if (!key) return {};
  const out: Record<string, HomeGeo> = {};
  for (const id of key.split(',')) {
    const d = CACHE.get(id) ?? got[id];
    if (d) out[id] = d;
  }
  return out;
}
