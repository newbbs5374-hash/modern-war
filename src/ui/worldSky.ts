// 세계지도 꾸밈(11/25 대장 요청 W1·W2·W4·W5)
// - 확대용 고해상 위성 조각(public/world-sat/, scripts/gen_worldsat.py)
// - 정밀 국경선(public/world-sat/borders.json, scripts/gen_worldborders.py)
// - 실제 시각의 낮·밤 경계(해가 진 곳만 어둡게, 그곳에 도시 불빛)
import { useEffect, useState } from 'react';
import { GEO } from '../data/realGeo';

const BASE = `${import.meta.env.BASE_URL}world-sat/`;
export const worldSatUrl = (name: string) => BASE + name;

export interface WorldSat {
  w1: number;
  h1: number;
  tile: number;
  tiles: Array<[number, number]>;
}

const memo = new Map<string, Promise<unknown>>();
function getJson<T>(name: string): Promise<T | null> {
  let p = memo.get(name) as Promise<T | null> | undefined;
  if (!p) {
    p = fetch(BASE + name)
      .then((r) => (r.ok ? (r.json() as Promise<T>) : null))
      .catch(() => null)
      .then((v) => {
        if (v === null) memo.delete(name); // 끊김: 다음에 다시
        return v;
      });
    memo.set(name, p);
  }
  return p;
}

/** on이 처음 true가 될 때 한 번 내려받음 */
export function useWorldJson<T>(name: string, on: boolean): T | null {
  const [v, setV] = useState<T | null>(null);
  useEffect(() => {
    if (!on || v) return;
    let live = true;
    getJson<T>(name).then((d) => live && d && setV(d));
    return () => {
      live = false;
    };
  }, [name, on, v]);
  return v;
}

/** 지금 시각(분 단위로 갱신) */
export function useNowMinute(): Date {
  const [d, setD] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setD(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);
  return d;
}

const rad = Math.PI / 180;
/** 해가 지평선 아래 a도 넘게 내려간 곳(밤) 모양: 지도 좌표 path. 없으면 '' */
export function nightPath(d: Date, below = 0): string {
  const start = Date.UTC(d.getUTCFullYear(), 0, 0);
  const doy = (d.getTime() - start) / 86_400_000;
  const decl = -23.44 * Math.cos(((2 * Math.PI) / 365) * (doy + 10)) * rad;
  const utcH = d.getUTCHours() + d.getUTCMinutes() / 60;
  const subLon = -(utcH - 12) * 15;
  const lim = -Math.sin(below * rad);
  const top: Array<[number, number]> = [];
  const bot: Array<[number, number]> = [];
  let any = false;
  for (let lon = GEO.L0; lon <= GEO.L1; lon += 2) {
    const ch = Math.cos((lon - subLon) * rad);
    let a = -1;
    let b = -1;
    for (let lat = GEO.B0; lat <= GEO.B1 + 0.01; lat += 0.5) {
      const cz = Math.sin(lat * rad) * Math.sin(decl) + Math.cos(lat * rad) * Math.cos(decl) * ch;
      if (cz < lim) {
        if (a < 0) a = lat;
        b = lat;
      }
    }
    const x = (lon - GEO.L0) * GEO.PX;
    if (a < 0) {
      top.push([x, 0]);
      bot.push([x, 0]);
    } else {
      any = true;
      // 위도 5·80 끝에 붙으면 지도 밖까지 늘림(가장자리 실금 방지)
      const yTop = b >= GEO.B1 ? -10 : (GEO.B1 - b) * GEO.PX;
      const yBot = a <= GEO.B0 ? GEO.H + 10 : (GEO.B1 - a) * GEO.PX;
      top.push([x, yTop]);
      bot.push([x, yBot]);
    }
  }
  if (!any) return '';
  const f = (p: [number, number]) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`;
  return `M${top.map(f).join('L')}L${bot.reverse().map(f).join('L')}Z`;
}
