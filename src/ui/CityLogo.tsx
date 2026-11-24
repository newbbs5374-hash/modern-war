// 도시 카드 왼쪽 상징 칸: 실제 도시 상징 그림(src/assets/logos/logo-<key>.webp)이 있으면 그것, 없으면 코드로 그린 방패 표지.
import { CITY_LOGO } from '../data/cityLogos';
import { COUNTRY_COLORS } from './WorldMap';

const FILES = import.meta.glob('../assets/logos/*.webp', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
const URLS: Record<string, string> = {};
for (const [path, url] of Object.entries(FILES)) URLS[path.split('/').pop()!.replace(/\.webp$/, '')] = url;

export const cityLogoUrl = (name: string): string | null => {
  const k = CITY_LOGO[name]?.key;
  return k ? (URLS[`logo-${k}`] ?? null) : null;
};

/** 코드로 그린 방패: 나라 색 테두리 + 도시 첫 글자 (+ 수도는 왕관) */
function Shield({ name, color, capital }: { name: string; color: string; capital?: boolean }) {
  return (
    <svg viewBox="0 0 48 56" className="city-logo-svg" aria-hidden>
      <path d="M24 2 L45 9 V27 C45 41 35 50 24 54 C13 50 3 41 3 27 V9 Z" fill="#e8edf2" stroke={color} strokeWidth="3.5" />
      <path d="M24 8 L40 13.5 V27 C40 38 32.5 45 24 48.5 C15.5 45 8 38 8 27 V13.5 Z" fill={color} opacity="0.22" />
      {capital && <path d="M15 15 l3 4 l3-5 l3 5 l3-5 l3 5 l3-4 v6 h-18 z" fill={color} />}
      <text x="24" y={capital ? 38 : 34} textAnchor="middle" fontSize={capital ? 15 : 18} fontWeight="800" fill="#1f2937">
        {name.slice(0, 1)}
      </text>
    </svg>
  );
}

export function CityLogo({ name, country, capital, size = 48 }: { name: string; country: string; capital?: boolean; size?: number }) {
  const url = cityLogoUrl(name);
  const color = COUNTRY_COLORS[country] ?? '#94a3b8';
  return (
    <span className="city-logo" style={{ width: size, height: size, borderColor: color }} title={url ? `${name} 상징` : `${name} (상징 그림 없음 · 임시 표지)`}>
      {url ? <img src={url} alt={`${name} 상징`} loading="lazy" /> : <Shield name={name} color={color} capital={capital} />}
    </span>
  );
}
