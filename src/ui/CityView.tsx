// 도시 확대 화면: 섬을 비스듬히 내려다본 모습. 땅은 눕혀 그리고, 건물·산·숲은 칸 위에 세워 그림.
// 규칙(칸 고르기)은 육각 칸 그대로. 그림은 src/assets/city/ 에 정해진 이름(city-*.png)으로 넣으면 바로 나옴.
// 그림이 없으면 상자 모양 임시 건물로 그림. 명령문: /mnt/project-files/guides/city-art-prompts.md
import { memo, useMemo, type ReactElement } from 'react';
import { HEX_SIZE, hexCorners } from '../data/hexmap';

const FILES = import.meta.glob('../assets/city/*.{png,jpg,jpeg,webp,PNG,JPG,JPEG,WEBP}', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;
const URLS: Record<string, string> = {};
for (const [path, url] of Object.entries(FILES)) URLS[path.split('/').pop()!.replace(/\.[^.]+$/, '')] = url;
export const cityArt = (key: string): string | null => URLS[key] ?? null;

export type CityThing = 'center' | 'industry' | 'harbor' | 'airfield' | 'lab' | 'housing' | 'mine' | 'suburb' | 'mountain' | 'ruins' | 'forest';
export type CityGround = '평지' | '산' | '유적' | '바닷가';
export interface CityCell {
  key: string;
  x: number;
  y: number;
  ground: CityGround;
  thing: CityThing | null;
  /** 공사 중(반투명 + 크레인) */
  building?: boolean;
  /** 매장지 자원 아이콘(채굴장 없을 때 점선 고리) */
  deposit?: string | null;
  mined?: boolean;
}

/** 눕힌 정도(세로 줄임) */
const K = 0.56;
const S = HEX_SIZE;
const GROUND: Record<CityGround, string> = { 평지: '#5d8a3e', 산: '#7c7466', 유적: '#9a8a5c', 바닷가: '#cdb77d' };
const GROUND_ART: Partial<Record<CityGround, string>> = { 평지: 'city-ground-grass', 바닷가: 'city-ground-beach' };
const SIZE: Record<CityThing, number> = {
  center: 3.8,
  industry: 2.2,
  harbor: 2.2,
  airfield: 2.3,
  lab: 2.1,
  housing: 2.1,
  mine: 2.0,
  suburb: 1.7,
  mountain: 2.3,
  ruins: 1.8,
  forest: 1.9,
};

const hexPts = (x: number, y: number, r: number) =>
  hexCorners(x, y, r)
    .map((p) => p.map((v) => v.toFixed(2)).join(','))
    .join(' ');

interface Props {
  cells: CityCell[];
  coast: string;
  sel: string | null;
  onPick: (key: string) => void;
  uid: string;
}

export const CityView = memo(function CityView({ cells, coast, sel, onPick, uid }: Props) {
  const xs = cells.map((c) => c.x);
  const ys = cells.map((c) => c.y);
  const x0 = Math.min(...xs) - S * 1.6;
  const x1 = Math.max(...xs) + S * 1.6;
  const y0 = Math.min(...ys);
  const y1 = Math.max(...ys);
  // 위쪽은 세운 건물 높이만큼 여유
  const vb = `${x0} ${(y0 - S * 1.6) * K - S * 2.6} ${x1 - x0} ${(y1 - y0 + S * 3.2) * K + S * 3.6}`;
  const depth = (y: number) => 0.86 + (0.28 * (y - y0)) / Math.max(1, y1 - y0);
  const things = useMemo(() => cells.filter((c) => c.thing).sort((a, b) => a.y - b.y || a.x - b.x), [cells]);
  const grounds = Array.from(new Set(cells.map((c) => c.ground)));
  const paint = (g: CityGround) => (GROUND_ART[g] && cityArt(GROUND_ART[g]!) ? `url(#cg-${uid}-${g})` : GROUND[g]);
  const flat = `scale(1 ${K})`;
  return (
    <svg className="city-view" viewBox={vb} role="img" aria-label="도시 모습">
      <defs>
        <linearGradient id={`cv-sea-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0c3a5c" />
          <stop offset="1" stopColor="#0a4f78" />
        </linearGradient>
        <pattern id={`cv-wave-${uid}`} width={S * 3} height={S * 1.1} patternUnits="userSpaceOnUse">
          <path d={`M0,${S * 0.6} q${S * 0.75},${-S * 0.35} ${S * 1.5},0 t${S * 1.5},0`} fill="none" stroke="#7dd3fc" strokeOpacity="0.07" strokeWidth="0.3" />
        </pattern>
        <clipPath id={`cv-land-${uid}`}>
          <path d={coast} />
        </clipPath>
        <filter id={`cv-soft-${uid}`} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation={S * 0.32} />
        </filter>
        <filter id={`cv-shadow-${uid}`} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation={S * 0.18} />
        </filter>
        {grounds.map((g) => {
          const url = GROUND_ART[g] && cityArt(GROUND_ART[g]!);
          return url ? (
            <pattern key={g} id={`cg-${uid}-${g}`} patternUnits="userSpaceOnUse" width={S * 5} height={S * 5}>
              <image href={url} width={S * 5} height={S * 5} preserveAspectRatio="xMidYMid slice" />
            </pattern>
          ) : null;
        })}
      </defs>
      <rect x={x0 - 50} y={-5000} width={x1 - x0 + 100} height={10000} fill={`url(#cv-sea-${uid})`} />
      <rect x={x0 - 50} y={-5000} width={x1 - x0 + 100} height={10000} fill={`url(#cv-wave-${uid})`} />
      {/* 얕은 바다 빛 */}
      <g transform={flat}>
        <path d={coast} fill="none" stroke="#5eead4" strokeOpacity="0.22" strokeWidth={S * 1.6} strokeLinejoin="round" />
      </g>
      {/* 섬 두께(절벽) */}
      <g transform={`translate(0 ${S * 0.7}) ${flat}`}>
        <path d={coast} fill="#6b5536" />
      </g>
      {/* 땅: 지형이 칸 경계 없이 섞임 */}
      <g transform={flat}>
        <path d={coast} fill={paint('바닷가')} />
        <g clipPath={`url(#cv-land-${uid})`}>
          <g filter={`url(#cv-soft-${uid})`}>
            {cells.map((c) => (
              <polygon key={c.key} points={hexPts(c.x, c.y, S * 1.08)} fill={paint(c.ground)} />
            ))}
          </g>
        </g>
        <path d={coast} fill="none" stroke="#f3e6bb" strokeOpacity="0.6" strokeWidth={0.45} />
        {/* 매장지 고리·고른 칸 */}
        {cells.map((c) =>
          c.deposit && !c.thing ? (
            <circle key={`d${c.key}`} cx={c.x} cy={c.y} r={S * 0.72} fill="#fde68a22" stroke="#fde68a" strokeWidth={0.5} strokeDasharray="1 0.8" />
          ) : null,
        )}
        {sel && cells.find((c) => c.key === sel) && (
          <polygon points={hexPts(cells.find((c) => c.key === sel)!.x, cells.find((c) => c.key === sel)!.y, S * 0.96)} fill="#fde04722" stroke="#fde047" strokeWidth={0.9} strokeLinejoin="round" />
        )}
        {/* 누르는 자리(보이지 않음) */}
        {cells.map((c) => (
          <polygon key={`t${c.key}`} points={hexPts(c.x, c.y, S)} fill="transparent" onClick={() => onPick(c.key)} style={{ cursor: 'pointer' }} />
        ))}
      </g>
      {/* 세운 것들: 뒤(위)부터 앞(아래)으로 */}
      <g pointerEvents="none">
        {things.map((c) => {
          const k = depth(c.y);
          const w = S * SIZE[c.thing!] * k;
          const gx = c.x;
          const gy = c.y * K;
          const url = cityArt(`city-${c.thing}`);
          return (
            <g key={c.key} opacity={c.building ? 0.55 : 1}>
              <ellipse cx={gx} cy={gy + w * 0.06} rx={w * 0.42} ry={w * 0.16} fill="#000" opacity={0.28} filter={`url(#cv-shadow-${uid})`} />
              {url ? <image href={url} x={gx - w / 2} y={gy - w * 0.78} width={w} height={w} /> : <Fallback kind={c.thing!} x={gx} y={gy} w={w} />}
              {c.building && (
                <text x={gx} y={gy - w * 0.3} fontSize={S * 0.9} textAnchor="middle">
                  🏗️
                </text>
              )}
            </g>
          );
        })}
        {cells.map((c) =>
          c.deposit && !c.thing ? (
            <text key={`i${c.key}`} x={c.x} y={c.y * K + S * 0.3} fontSize={S * 0.95} textAnchor="middle">
              {c.deposit}
            </text>
          ) : null,
        )}
      </g>
    </svg>
  );
});

/** 비스듬히 본 상자 하나(앞면·옆면·지붕) */
function Box({ x, y, w, d, h, c, roof, win }: { x: number; y: number; w: number; d: number; h: number; c: string; roof?: string; win?: boolean }) {
  const r = roof ?? shade(c, 1.25);
  const out: ReactElement[] = [];
  out.push(<rect key="f" x={x - w / 2} y={y - h} width={w} height={h} fill={c} />);
  out.push(<path key="t" d={`M${x - w / 2},${y - h} L${x - w / 2 + d * 0.5},${y - h - d} L${x + w / 2 + d * 0.5},${y - h - d} L${x + w / 2},${y - h} Z`} fill={r} />);
  out.push(<path key="s" d={`M${x + w / 2},${y - h} L${x + w / 2 + d * 0.5},${y - h - d} L${x + w / 2 + d * 0.5},${y - d} L${x + w / 2},${y} Z`} fill={shade(c, 0.72)} />);
  if (win && h > w * 0.9) {
    for (let yy = y - h + w * 0.35; yy < y - w * 0.2; yy += w * 0.42) out.push(<line key={`w${yy}`} x1={x - w * 0.36} x2={x + w * 0.36} y1={yy} y2={yy} stroke="#e0f2fe" strokeOpacity={0.45} strokeWidth={w * 0.1} />);
  }
  return <g>{out}</g>;
}

function shade(hex: string, f: number): string {
  const n = (i: number) => Math.max(0, Math.min(255, Math.round(parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) * f)));
  return `rgb(${n(0)},${n(1)},${n(2)})`;
}

/** 그림이 오기 전 임시 모습 */
function Fallback({ kind, x, y, w }: { kind: CityThing; x: number; y: number; w: number }) {
  const u = w / 10;
  switch (kind) {
    case 'center':
      return (
        <g>
          <Box x={x - 2.6 * u} y={y - 1.2 * u} w={1.6 * u} d={1.4 * u} h={5.5 * u} c="#4f7f8f" win />
          <Box x={x + 0.2 * u} y={y - 1.8 * u} w={1.9 * u} d={1.6 * u} h={7.6 * u} c="#5b93a6" win />
          <Box x={x + 2.8 * u} y={y - 1 * u} w={1.6 * u} d={1.4 * u} h={4.6 * u} c="#6a8a99" win />
          <Box x={x - 1.2 * u} y={y + 0.4 * u} w={1.4 * u} d={1.2 * u} h={3.6 * u} c="#78909c" win />
          <Box x={x + 1.6 * u} y={y + 1.2 * u} w={3.2 * u} d={1.4 * u} h={1.6 * u} c="#e7e2d6" />
          <ellipse cx={x + 1.9 * u} cy={y - 0.6 * u} rx={1.1 * u} ry={0.9 * u} fill="#f5f1e6" />
        </g>
      );
    case 'industry':
      return (
        <g>
          <rect x={x + 1.6 * u} y={y - 6 * u} width={0.6 * u} height={5 * u} fill="#8a7f78" />
          <Box x={x - 1 * u} y={y + 0.6 * u} w={4.2 * u} d={1.8 * u} h={2 * u} c="#8b8f94" roof="#a35f45" />
          <Box x={x + 2.2 * u} y={y + 1.2 * u} w={1.8 * u} d={1.4 * u} h={1.4 * u} c="#7c8086" />
          <circle cx={x + 1.9 * u} cy={y - 6.6 * u} r={0.9 * u} fill="#e5e7eb" opacity={0.6} />
        </g>
      );
    case 'harbor':
      return (
        <g>
          <path d={`M${x - 4 * u},${y + 1.4 * u} L${x + 4 * u},${y + 1.4 * u} L${x + 3 * u},${y + 2.4 * u} L${x - 3 * u},${y + 2.4 * u} Z`} fill="#94a3b8" />
          <Box x={x - 1.6 * u} y={y + 0.8 * u} w={2.6 * u} d={1.2 * u} h={1.5 * u} c="#a8a29e" />
          <path d={`M${x + 1.6 * u},${y + 0.8 * u} V${y - 4 * u} H${x + 3.6 * u}`} fill="none" stroke="#f59e0b" strokeWidth={0.4 * u} />
          <Box x={x + 0.2 * u} y={y + 1.2 * u} w={1 * u} d={0.6 * u} h={0.7 * u} c="#2563eb" />
          <Box x={x + 1.4 * u} y={y + 1.2 * u} w={1 * u} d={0.6 * u} h={0.7 * u} c="#dc2626" />
        </g>
      );
    case 'airfield':
      return (
        <g>
          <path d={`M${x - 4.6 * u},${y + 1.6 * u} L${x + 3 * u},${y - 1 * u} L${x + 4.4 * u},${y - 0.2 * u} L${x - 3.2 * u},${y + 2.4 * u} Z`} fill="#4b5563" />
          <path d={`M${x - 3.6 * u},${y + 1.6 * u} L${x + 3.2 * u},${y - 0.6 * u}`} stroke="#f8fafc" strokeWidth={0.18 * u} strokeDasharray={`${0.6 * u} ${0.5 * u}`} />
          <Box x={x - 1.6 * u} y={y - 0.8 * u} w={2.2 * u} d={1.4 * u} h={1.3 * u} c="#9ca3af" roof="#6b7280" />
          <Box x={x + 2.2 * u} y={y + 1.6 * u} w={0.8 * u} d={0.6 * u} h={3 * u} c="#cbd5e1" roof="#7dd3fc" />
        </g>
      );
    case 'lab':
      return (
        <g>
          <Box x={x - 0.8 * u} y={y + 0.6 * u} w={3.6 * u} d={1.8 * u} h={2.6 * u} c="#e2e8f0" roof="#bae6fd" win />
          <Box x={x + 2.4 * u} y={y + 1.2 * u} w={1.6 * u} d={1.2 * u} h={1.6 * u} c="#cbd5e1" />
          <ellipse cx={x - 2.6 * u} cy={y - 3.6 * u} rx={1.2 * u} ry={0.8 * u} fill="#f1f5f9" stroke="#94a3b8" strokeWidth={0.15 * u} />
          <line x1={x - 2.6 * u} y1={y - 3 * u} x2={x - 2.6 * u} y2={y - 1.6 * u} stroke="#94a3b8" strokeWidth={0.3 * u} />
        </g>
      );
    case 'housing':
      return (
        <g>
          <Box x={x - 2 * u} y={y - 0.4 * u} w={1.8 * u} d={1.4 * u} h={3.8 * u} c="#d6c7a8" win />
          <Box x={x + 0.6 * u} y={y - 0.8 * u} w={1.8 * u} d={1.4 * u} h={3.2 * u} c="#cbb994" win />
          <Box x={x - 0.6 * u} y={y + 1.6 * u} w={1.4 * u} d={1 * u} h={1.1 * u} c="#e7e0d0" roof="#b45337" />
          <Box x={x + 2.4 * u} y={y + 1.4 * u} w={1.4 * u} d={1 * u} h={1.1 * u} c="#e7e0d0" roof="#64748b" />
          <circle cx={x + 3 * u} cy={y - 0.6 * u} r={0.9 * u} fill="#3f7a35" />
        </g>
      );
    case 'mine':
      return (
        <g>
          <ellipse cx={x - 0.6 * u} cy={y + 0.8 * u} rx={3.2 * u} ry={1.6 * u} fill="#7c5b3a" />
          <ellipse cx={x - 0.6 * u} cy={y + 0.9 * u} rx={2 * u} ry={0.9 * u} fill="#5a4029" />
          <path d={`M${x + 2.4 * u},${y + 0.6 * u} L${x + 2.9 * u},${y - 3.4 * u} L${x + 3.4 * u},${y + 0.6 * u}`} fill="none" stroke="#525252" strokeWidth={0.35 * u} />
          <Box x={x + 1.2 * u} y={y + 2 * u} w={1.2 * u} d={0.8 * u} h={0.8 * u} c="#eab308" />
        </g>
      );
    case 'suburb':
      return (
        <g>
          <Box x={x - 2 * u} y={y} w={1.6 * u} d={1.2 * u} h={1.1 * u} c="#e7e0d0" roof="#b45337" />
          <Box x={x + 1 * u} y={y - 0.6 * u} w={1.6 * u} d={1.2 * u} h={1.1 * u} c="#ece6d6" roof="#7c4a32" />
          <Box x={x - 0.2 * u} y={y + 1.8 * u} w={1.6 * u} d={1.2 * u} h={1.1 * u} c="#e7e0d0" roof="#64748b" />
          <circle cx={x + 3 * u} cy={y + 1 * u} r={0.9 * u} fill="#3f7a35" />
        </g>
      );
    case 'mountain':
      return (
        <g>
          <path d={`M${x - 4.6 * u},${y + 1.4 * u} L${x - 1.2 * u},${y - 5.4 * u} L${x + 1.2 * u},${y - 1.6 * u} L${x + 2.4 * u},${y - 3.6 * u} L${x + 4.6 * u},${y + 1.4 * u} Z`} fill="#857b6c" />
          <path d={`M${x - 1.2 * u},${y - 5.4 * u} L${x + 1.2 * u},${y - 1.6 * u} L${x - 0.2 * u},${y + 1.4 * u} Z`} fill="#6b6256" />
          <path d={`M${x - 1.2 * u},${y - 5.4 * u} L${x - 2 * u},${y - 3.8 * u} L${x - 0.4 * u},${y - 4 * u} Z`} fill="#f8fafc" />
        </g>
      );
    case 'ruins':
      return (
        <g>
          {[-2.4, -0.8, 0.8, 2.4].map((dx, i) => (
            <rect key={dx} x={x + dx * u - 0.4 * u} y={y - (i === 2 ? 1.6 : 3.2) * u} width={0.8 * u} height={(i === 2 ? 1.6 : 3.2) * u} fill="#d6d3d1" />
          ))}
          <rect x={x - 2.8 * u} y={y - 3.6 * u} width={3.2 * u} height={0.5 * u} fill="#e7e5e4" />
          <circle cx={x + 1.8 * u} cy={y + 0.6 * u} r={0.4 * u} fill="#67e8f9" />
        </g>
      );
    case 'forest':
      return (
        <g>
          {[
            [-2.4, 0.6],
            [-0.6, -0.6],
            [1.4, 0.2],
            [-1.2, 1.6],
            [0.8, 1.8],
            [2.8, 1.4],
          ].map(([dx, dy], i) => (
            <g key={i}>
              <circle cx={x + dx * u} cy={y + (dy - 1.6) * u} r={1.3 * u} fill={i % 2 ? '#2f6b2a' : '#3b7d33'} />
              <circle cx={x + (dx - 0.3) * u} cy={y + (dy - 2) * u} r={0.6 * u} fill="#5a9c48" opacity={0.6} />
            </g>
          ))}
        </g>
      );
  }
}
