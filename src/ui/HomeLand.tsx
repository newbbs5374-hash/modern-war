// 본부 배경: 우리나라 땅(임시 그림). 나라마다 모양이 다르게 seed로 그린 섬 + 산·숲·강 + 거점 도시.
import { CITIES } from '../data/cities';
import { FLAG_DEF } from './flag';
import type { WorldState } from '../game/world';

const W = 390;
const H = 640;

function hash(s: string): number {
  let h = 2166136261;
  for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
}
function rng(seed: number) {
  let t = seed;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/** 땅 모양: 가운데를 둘러싼 울퉁불퉁한 고리 */
function landPath(r: () => number, cx: number, cy: number, rx: number, ry: number): string {
  const n = 18;
  const pts: Array<[number, number]> = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const k = 0.78 + r() * 0.3;
    pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]);
  }
  // 부드러운 곡선(점 사이 중간점을 지나는 2차 곡선)
  const mid = (i: number) => {
    const [x1, y1] = pts[i % n];
    const [x2, y2] = pts[(i + 1) % n];
    return [(x1 + x2) / 2, (y1 + y2) / 2];
  };
  let d = `M${mid(0)[0].toFixed(1)},${mid(0)[1].toFixed(1)}`;
  for (let i = 1; i <= n; i++) {
    const [px, py] = pts[i % n];
    const [mx, my] = mid(i);
    d += ` Q${px.toFixed(1)},${py.toFixed(1)} ${mx.toFixed(1)},${my.toFixed(1)}`;
  }
  return d + 'Z';
}

/** 도시 자리(땅 안쪽, 나라 안 순서대로) */
const SPOTS: Array<[number, number]> = [
  [240, 250],
  [262, 405],
  [205, 500],
  [222, 330],
];

export function HomeLand({ countryId, world }: { countryId: string; world: WorldState }) {
  const r = rng(hash(countryId));
  const land = landPath(r, 235, 380, 160, 250);
  const flag = FLAG_DEF[countryId];
  const mine = flag?.bands[flag.bands.length > 2 ? 1 : 0] ?? '#3b82f6';
  const homeCities = CITIES.filter((c) => c.home === countryId);
  const mountains = Array.from({ length: 6 }, () => [140 + r() * 200, 200 + r() * 330, 14 + r() * 12] as const);
  const forests = Array.from({ length: 10 }, () => [130 + r() * 220, 220 + r() * 320] as const);
  const riverY = 260 + r() * 120;
  return (
    <svg className="homeland" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <radialGradient id="sea" cx="60%" cy="55%" r="80%">
          <stop offset="0%" stopColor="#0f3d5e" />
          <stop offset="100%" stopColor="#061424" />
        </radialGradient>
        <linearGradient id="land" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#3f6b3a" />
          <stop offset="60%" stopColor="#4c7a3c" />
          <stop offset="100%" stopColor="#6b7d3a" />
        </linearGradient>
        <pattern id="grid" width="26" height="26" patternUnits="userSpaceOnUse">
          <path d="M26 0H0V26" fill="none" stroke="#ffffff0d" strokeWidth="1" />
        </pattern>
      </defs>
      <rect width={W} height={H} fill="url(#sea)" />
      {Array.from({ length: 9 }, (_, i) => (
        <path key={i} d={`M${-20 + (i % 3) * 30},${40 + i * 70} q20,-8 40,0 t40,0`} fill="none" stroke="#7dd3fc22" strokeWidth="2" />
      ))}
      <path d={land} fill="#0b2a40" transform="translate(4,6)" opacity="0.7" />
      <path d={land} fill="url(#land)" stroke="#d9c58a" strokeWidth="3" />
      <path d={land} fill="url(#grid)" />
      <path d={`M120,${riverY} C190,${riverY - 40} 240,${riverY + 60} 400,${riverY + 10}`} fill="none" stroke="#38bdf8aa" strokeWidth="5" strokeLinecap="round" />
      {forests.map(([x, y], i) => (
        <g key={`f${i}`} opacity="0.85">
          <circle cx={x} cy={y} r="7" fill="#1f4d2a" />
          <circle cx={x + 7} cy={y + 3} r="6" fill="#265c32" />
        </g>
      ))}
      {mountains.map(([x, y, s], i) => (
        <g key={`m${i}`}>
          <polygon points={`${x - s},${y + s * 0.7} ${x},${y - s} ${x + s},${y + s * 0.7}`} fill="#7c6a4f" />
          <polygon points={`${x},${y - s} ${x + s},${y + s * 0.7} ${x + s * 0.2},${y + s * 0.7}`} fill="#5b4c38" />
          <polygon points={`${x - s * 0.3},${y - s * 0.4} ${x},${y - s} ${x + s * 0.3},${y - s * 0.4}`} fill="#f1f5f9" />
        </g>
      ))}
      {homeCities.map((c, i) => {
        const [x, y] = SPOTS[i % SPOTS.length];
        const ours = world.owner[c.id] === countryId;
        return (
          <g key={c.id}>
            {c.capital && <circle cx={x} cy={y} r="17" fill="none" stroke={ours ? '#fde047' : '#ef4444'} strokeWidth="2" strokeDasharray="4 3" />}
            <circle cx={x} cy={y} r={c.capital ? 10 : 7} fill={ours ? mine : '#ef4444'} stroke="#0b1220" strokeWidth="2.5" />
            <text x={x} y={y + (c.capital ? 30 : 24)} textAnchor="middle" className="homeland-city">
              {c.capital ? '★ ' : ''}
              {c.name}
              {ours ? '' : ' (빼앗김)'}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
