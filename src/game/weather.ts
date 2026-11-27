// 본부 지도 날씨(11/27 종합 확장안 본부 1): 보기만 바뀌고 게임 수치에는 영향 없음.
// 실제 날짜·시각과 나라(수도 위도)로 정해져서, 같은 때 다시 열면 같은 날씨. 3시간마다 바뀜.
import { CITY_LONLAT } from '../data/realmap';
import { COUNTRIES } from '../data/world';

export type Weather = '맑음' | '흐림' | '비' | '눈';
export const WEATHER_ICON: Record<Weather, string> = { 맑음: '☀️', 흐림: '☁️', 비: '🌧️', 눈: '🌨️' };

const hash = (n: number) => {
  let x = (n | 0) * 374761393 + 668265263;
  x = (x ^ (x >>> 13)) * 1274126177;
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
};

/** 그 나라 수도가 눈 오는 철인지(북반구 겨울, 위도 33도 위. 55도 위는 11~3월) */
export function snowSeason(countryId: string, d: Date): boolean {
  const c = COUNTRIES.find((x) => x.id === countryId);
  const lat = c ? (CITY_LONLAT[c.cities[0]]?.[1] ?? 0) : 0;
  const m = d.getMonth() + 1;
  if (lat >= 55) return m >= 11 || m <= 3;
  return lat >= 33 && (m === 12 || m <= 2);
}

export function weatherAt(countryId: string, d: Date): Weather {
  const block = Math.floor(d.getTime() / (3 * 3600_000));
  let s = 0;
  for (const ch of countryId) s = s * 31 + ch.charCodeAt(0);
  const r = hash(block * 7919 + s);
  if (r < 0.58) return '맑음';
  if (r < 0.76) return '흐림';
  return snowSeason(countryId, d) ? '눈' : '비';
}
