// 도시 확대 화면: 섬을 비스듬히 내려다본 모습. 땅은 눕혀 그리고, 건물·산·숲은 칸 위에 세워 그림.
// 규칙(칸 고르기)은 육각 칸 그대로. 그림은 src/assets/city/ 에 정해진 이름(city-*.png)으로 넣으면 바로 나옴.
// 그림이 없으면 상자 모양 임시 건물로 그림. 명령문: /mnt/project-files/guides/city-art-prompts.md
import { createContext, memo, useContext, useMemo, type ReactElement } from 'react';
import { HEX_SIZE, hexCorners } from '../data/hexmap';

const FILES = import.meta.glob('../assets/city/*.{png,jpg,jpeg,webp,PNG,JPG,JPEG,WEBP}', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;
const URLS: Record<string, string> = {};
for (const [path, url] of Object.entries(FILES)) URLS[path.split('/').pop()!.replace(/\.[^.]+$/, '')] = url;
export const cityArt = (key: string): string | null => URLS[key] ?? null;
/** 도시 단계(0~6) → 건물 그림 단계(1~3): city-<종류>-<단계>.png 가 있으면 그것을 씀 */
export const artTier = (stage: number) => (stage <= 1 ? 1 : stage <= 3 ? 2 : 3);

/** 낮밤(0 낮 ~ 1 밤)·도시 단계: 상자 건물 색과 높이에 씀 */
const Look = createContext({ night: 0, stage: 3 });
/** 도시 단계별 높이 배율: 도심·아파트가 단계마다 높아짐 */
const heightOf = (kind: 'center' | 'apt', stage: number) => (kind === 'center' ? 0.6 + 0.22 * stage : 0.7 + 0.15 * stage);

export type CityThing =
  | 'center'
  | 'industry'
  | 'harbor'
  | 'airfield'
  | 'lab'
  | 'housing'
  | 'mine'
  | 'suburb'
  | 'apt'
  | 'mountain'
  | 'ruins'
  | 'forest'
  | 'mark'
  // 군사 연구시설(11/24)
  | 'adl'
  | 'shipyard'
  | 'arms'
  | 'missile'
  | 'drone'
  | 'cyber'
  | 'aero';
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
  /** 실제 시설: 아이콘·단계 */
  mark?: { icon: string; lv: number; color: string; nature?: boolean };
}
/** 글씨(구·군 이름, 시설 이름). x,y는 땅 좌표 */
export interface CityLabel {
  x: number;
  y: number;
  text: string;
  kind: 'gu' | 'mark' | 'river';
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
  apt: 2.0,
  mountain: 2.3,
  ruins: 1.8,
  forest: 1.9,
  mark: 2.3,
  adl: 2.2,
  shipyard: 2.3,
  arms: 2.2,
  missile: 2.3,
  drone: 2.1,
  cyber: 2.1,
  aero: 2.3,
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
  /** 바다에 닿지 않은 도시: 둘레를 바다 대신 들판으로 */
  inland?: boolean;
  /** 도시 밖 이웃 땅(실제 지도) 모양 */
  around?: string;
  /** 구·군 경계선 */
  borders?: string;
  /** 강(땅 좌표 path, 굵기) */
  rivers?: Array<{ d: string; w: number }>;
  labels?: CityLabel[];
  /** 확대 배율(1 = 화면 너비) */
  zoom?: number;
  /** 도시 단계 0(마을)~6(세계 도시): 건물 높이·차 수 */
  stage?: number;
  /** 0 낮 ~ 1 밤: 밤엔 창문 불빛·가로등 */
  night?: number;
  /** 대형 사업 공사 크레인을 세울 칸 */
  cranes?: string[];
  /** 도심에서 퍼지는 길과 오가는 차 */
  traffic?: boolean;
}

export const CityView = memo(function CityView({ cells, coast, sel, onPick, uid, inland, around, borders, rivers, labels, zoom = 1, stage = 3, night = 0, cranes, traffic }: Props) {
  const xs = cells.map((c) => c.x);
  const ys = cells.map((c) => c.y);
  const x0 = Math.min(...xs) - S * 1.6;
  const x1 = Math.max(...xs) + S * 1.6;
  const y0 = Math.min(...ys);
  const y1 = Math.max(...ys);
  // 위쪽은 세운 건물 높이만큼 여유
  const vb = `${x0} ${(y0 - S * 1.6) * K - S * 2.6} ${x1 - x0} ${(y1 - y0 + S * 3.2) * K + S * 3.6}`;
  const things = useMemo(() => cells.filter((c) => c.thing).sort((a, b) => a.y - b.y || a.x - b.x), [cells]);
  const grounds = Array.from(new Set(cells.map((c) => c.ground)));
  const paint = (g: CityGround) => (GROUND_ART[g] && cityArt(GROUND_ART[g]!) ? `url(#cg-${uid}-${g})` : GROUND[g]);
  const flat = `scale(1 ${K})`;
  const look = useMemo(() => ({ night, stage }), [night, stage]);
  const craneSet = useMemo(() => new Set(cranes ?? []), [cranes]);
  const urbanCells = useMemo(() => cells.filter((c) => c.thing === 'apt' || c.thing === 'suburb' || c.thing === 'center' || c.thing === 'mark' || c.thing === 'housing'), [cells]);
  // 도심 → 가까운 시가지로 뻗은 길(단계가 높을수록 많음)
  const roads = useMemo(() => {
    if (!traffic) return [];
    const ctr = cells.find((c) => c.thing === 'center');
    if (!ctr) return [];
    const far = urbanCells
      .filter((c) => c !== ctr)
      .map((c) => ({ c, d: Math.hypot(c.x - ctr.x, c.y - ctr.y), a: Math.atan2(c.y - ctr.y, c.x - ctr.x) }))
      .sort((a, b) => b.d - a.d);
    // 방향이 겹치지 않게 먼 곳부터 고름
    const out: Array<{ d: string; len: number; a: number }> = [];
    const n = Math.min(10, 3 + stage);
    for (const f of far) {
      if (out.length >= n) break;
      if (out.some((o) => Math.abs(Math.atan2(Math.sin(f.a - o.a), Math.cos(f.a - o.a))) < 0.45)) continue;
      const mx = (ctr.x + f.c.x) / 2 + (f.c.y - ctr.y) * 0.12;
      const my = (ctr.y + f.c.y) / 2 - (f.c.x - ctr.x) * 0.12;
      out.push({ d: `M${ctr.x.toFixed(1)},${(ctr.y * K).toFixed(1)} Q${mx.toFixed(1)},${(my * K).toFixed(1)} ${f.c.x.toFixed(1)},${(f.c.y * K).toFixed(1)}`, len: f.d, a: f.a });
    }
    return out;
  }, [cells, urbanCells, traffic, stage]);
  return (
    <Look.Provider value={look}>
    <svg className="city-view" viewBox={vb} role="img" aria-label="도시 모습" style={zoom > 1 ? { width: `${zoom * 100}%`, maxHeight: 'none' } : undefined}>
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
        <filter id={`cv-dark-${uid}`}>
          <feComponentTransfer>
            <feFuncR type="linear" slope={1 - 0.6 * night} />
            <feFuncG type="linear" slope={1 - 0.58 * night} />
            <feFuncB type="linear" slope={1 - 0.45 * night} />
          </feComponentTransfer>
        </filter>
        <radialGradient id={`cv-glow-${uid}`}>
          <stop offset="0" stopColor="#ffcf73" stopOpacity="0.9" />
          <stop offset="0.5" stopColor="#ff9f43" stopOpacity="0.35" />
          <stop offset="1" stopColor="#ff9f43" stopOpacity="0" />
        </radialGradient>
        {grounds.map((g) => {
          const url = GROUND_ART[g] && cityArt(GROUND_ART[g]!);
          return url ? (
            <pattern key={g} id={`cg-${uid}-${g}`} patternUnits="userSpaceOnUse" width={S * 5} height={S * 5}>
              <image href={url} width={S * 5} height={S * 5} preserveAspectRatio="xMidYMid slice" />
            </pattern>
          ) : null;
        })}
      </defs>
      {inland ? (
        <>
          {/* 내륙 도시: 둘레는 바다가 아니라 들판 */}
          <rect x={x0 - 50} y={-5000} width={x1 - x0 + 100} height={10000} fill="#3d5230" />
          <g transform={flat}>
            <path d={coast} fill="none" stroke="#1f2a17" strokeOpacity="0.35" strokeWidth={S * 1.2} strokeLinejoin="round" />
          </g>
        </>
      ) : (
        <>
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
        </>
      )}
      {/* 도시 밖 이웃 땅(실제 지도) */}
      {around && (
        <g transform={flat}>
          <path d={around} fill="#4a5d3a" opacity={0.85} />
          <path d={around} fill="none" stroke="#2c3a22" strokeOpacity={0.5} strokeWidth={0.4} />
        </g>
      )}
      {/* 땅: 지형이 칸 경계 없이 섞임 */}
      <g transform={flat}>
        <path d={coast} fill={paint(inland ? '평지' : '바닷가')} />
        <g clipPath={`url(#cv-land-${uid})`}>
          <g filter={`url(#cv-soft-${uid})`}>
            {cells.map((c) => (
              <polygon key={c.key} points={hexPts(c.x, c.y, S * 1.08)} fill={paint(c.ground)} />
            ))}
          </g>
        </g>
        {!inland && !around && <path d={coast} fill="none" stroke="#f3e6bb" strokeOpacity="0.6" strokeWidth={0.45} />}
        {/* 강 */}
        {rivers?.map((r, i) => (
          <g key={`rv${i}`} clipPath={`url(#cv-land-${uid})`}>
            <path d={r.d} fill="none" stroke="#2b6a92" strokeWidth={r.w * S * 0.55} strokeLinecap="round" strokeLinejoin="round" />
            <path d={r.d} fill="none" stroke="#5fb3e0" strokeWidth={r.w * S * 0.3} strokeLinecap="round" strokeLinejoin="round" opacity={0.8} />
          </g>
        ))}
        {/* 행정구역(구·군) 경계 */}
        {borders && <path d={borders} fill="none" stroke="#fef3c7" strokeOpacity={0.55} strokeWidth={0.35} strokeDasharray="1.2 0.8" />}
        {/* 도시 경계(실제 행정구역) */}
        {around && <path d={coast} fill="none" stroke="#fde68a" strokeOpacity={0.85} strokeWidth={0.6} />}
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
      {/* 밤: 어둡게 덮고, 시가지에 불빛 번짐 */}
      {night > 0.02 && (
        <g pointerEvents="none">
          <rect x={x0 - 50} y={-5000} width={x1 - x0 + 100} height={10000} fill="#081226" opacity={0.62 * night} />
          <g style={{ mixBlendMode: 'screen' }} opacity={night}>
            {urbanCells.map((c) => (
              <ellipse key={`g${c.key}`} cx={c.x} cy={c.y * K} rx={S * (c.thing === 'center' ? 3.4 : c.thing === 'suburb' ? 1.4 : 2)} ry={S * (c.thing === 'center' ? 2 : c.thing === 'suburb' ? 0.8 : 1.15)} fill={`url(#cv-glow-${uid})`} />
            ))}
          </g>
        </g>
      )}
      {/* 길과 차 */}
      {roads.length > 0 && (
        <g pointerEvents="none">
          {roads.map((r, i) => (
            <g key={`r${i}`}>
              <path d={r.d} fill="none" stroke={night > 0.5 ? '#3a3326' : '#4b5058'} strokeWidth={S * 0.32} strokeLinecap="round" opacity={0.75} />
              <path d={r.d} fill="none" stroke={night > 0.5 ? '#fbbf24' : '#e5e7eb'} strokeOpacity={0.35 + 0.3 * night} strokeWidth={S * 0.05} strokeDasharray={`${S * 0.3} ${S * 0.3}`} />
              {Array.from({ length: Math.min(3, 1 + Math.floor(stage / 2)) }, (_, j) => (
                <circle key={j} r={S * 0.13} fill={night > 0.5 ? (j % 2 ? '#fde68a' : '#f87171') : j % 2 ? '#f8fafc' : '#60a5fa'}>
                  <animateMotion dur={`${(5 + r.len / (S * 3) + j * 1.7).toFixed(1)}s`} begin={`${-(i * 1.3 + j * 2.1).toFixed(1)}s`} repeatCount="indefinite" path={r.d} keyPoints={j % 2 ? '1;0' : '0;1'} keyTimes="0;1" calcMode="linear" />
                </circle>
              ))}
            </g>
          ))}
        </g>
      )}
      {/* 세운 것들: 뒤(위)부터 앞(아래)으로 */}
      <g pointerEvents="none">
        {things.map((c) => {
          // 땅을 원근 없이(멀고 가까워도 같은 크기) 눕혀 그리므로 건물도 같은 크기로 세운다
          const w = S * SIZE[c.thing!];
          const gx = c.x;
          const gy = c.y * K;
          const url = cityArt(`city-${c.thing}-${artTier(stage)}`) ?? cityArt(`city-${c.thing}`);
          const crane = c.building || craneSet.has(c.key);
          return (
            <g key={c.key} opacity={c.building ? 0.55 : 1}>
              <ellipse cx={gx} cy={gy + w * 0.06} rx={w * 0.42} ry={w * 0.16} fill="#000" opacity={0.28} filter={`url(#cv-shadow-${uid})`} />
              {c.thing === 'mark' && c.mark ? (
                <Mark x={gx} y={gy} w={w} m={c.mark} />
              ) : url ? (
                <image href={url} x={gx - w / 2} y={gy - w * 0.78} width={w} height={w} filter={night > 0.02 ? `url(#cv-dark-${uid})` : undefined} />
              ) : (
                <Fallback kind={c.thing!} x={gx} y={gy} w={w} />
              )}
              {night > 0.3 && url && LIT[c.thing!] && <Lights x={gx} y={gy} w={w} n={Math.round(LIT[c.thing!]! * (0.8 + stage * 0.15))} seed={c.x * 31 + c.y * 17} night={night} />}
              {crane && <Crane x={gx} y={gy} w={w} night={night} />}
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
        {placeLabels(labels ?? []).map((l, i) => (
          <text
            key={`l${i}`}
            x={l.x}
            y={l.py}
            fontSize={l.kind === 'gu' ? S * 0.85 : S * 0.62}
            textAnchor="middle"
            fill={l.kind === 'gu' ? '#fef9c3' : l.kind === 'river' ? '#bae6fd' : '#ffffff'}
            stroke="#0f172a"
            strokeWidth={S * 0.14}
            paintOrder="stroke"
            fontWeight={l.kind === 'gu' ? 700 : 600}
            opacity={l.kind === 'gu' ? 0.9 : 0.95}
          >
            {l.text}
          </text>
        ))}
      </g>
    </svg>
    </Look.Provider>
  );
});

/** 밤 창문 불빛 개수(그림 건물 위에 점으로 켬) */
const LIT: Partial<Record<CityThing, number>> = { center: 26, apt: 16, suburb: 5, housing: 9, industry: 5, lab: 7, harbor: 5, mark: 8, airfield: 4, shipyard: 5, arms: 4, cyber: 6, aero: 4, drone: 4, adl: 4, missile: 3 };
function Lights({ x, y, w, n, seed, night }: { x: number; y: number; w: number; n: number; seed: number; night: number }) {
  let t = Math.abs(Math.round(seed * 1000)) >>> 0;
  const rnd = () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
  const out: ReactElement[] = [];
  for (let i = 0; i < n; i++) {
    const px = x + (rnd() - 0.5) * w * 0.62;
    // 가운데가 높은 건물: 가운데일수록 위까지 불이 켜짐
    const top = w * (0.62 - Math.abs(px - x) / w);
    const py = y - w * 0.06 - rnd() * top;
    out.push(<rect key={i} x={px} y={py} width={w * 0.055} height={w * 0.06} fill={rnd() < 0.25 ? '#fff7d6' : '#fcd34d'} opacity={(0.55 + rnd() * 0.45) * night} />);
  }
  return <g style={{ mixBlendMode: 'screen' }}>{out}</g>;
}

/** 공사 크레인(대형 사업·건설 중): 밤엔 꼭대기 빨간 불이 깜빡임 */
function Crane({ x, y, w, night }: { x: number; y: number; w: number; night: number }) {
  const u = w / 10;
  const tx = x + 2.6 * u;
  const top = y - 9 * u;
  return (
    <g>
      <path d={`M${tx - 0.4 * u},${y + 0.6 * u} V${top} M${tx + 0.4 * u},${y + 0.6 * u} V${top}`} stroke="#f59e0b" strokeWidth={0.22 * u} />
      {Array.from({ length: 8 }, (_, i) => (
        <line key={i} x1={tx - 0.4 * u} x2={tx + 0.4 * u} y1={y - i * 1.15 * u} y2={y - (i + 1) * 1.15 * u} stroke="#f59e0b" strokeWidth={0.12 * u} />
      ))}
      <path d={`M${tx - 2 * u},${top} H${tx - 7 * u} M${tx + 0.4 * u},${top} H${tx + 2.4 * u}`} stroke="#f59e0b" strokeWidth={0.3 * u} />
      <path d={`M${tx},${top - 1.2 * u} L${tx - 6 * u},${top} M${tx},${top - 1.2 * u} L${tx + 2.2 * u},${top}`} stroke="#d97706" strokeWidth={0.1 * u} />
      <rect x={tx + 1.4 * u} y={top - 0.1 * u} width={1.2 * u} height={0.9 * u} fill="#57534e" />
      <line x1={tx - 5 * u} x2={tx - 5 * u} y1={top} y2={y - 3.4 * u} stroke="#cbd5e1" strokeWidth={0.07 * u}>
        <animate attributeName="y2" values={`${y - 3.4 * u};${y - 5.2 * u};${y - 3.4 * u}`} dur="6s" repeatCount="indefinite" />
      </line>
      <rect x={tx - 5.5 * u} y={y - 3.4 * u} width={u} height={0.6 * u} fill="#64748b">
        <animate attributeName="y" values={`${y - 3.4 * u};${y - 5.2 * u};${y - 3.4 * u}`} dur="6s" repeatCount="indefinite" />
      </rect>
      <circle cx={tx} cy={top - 1.3 * u} r={0.35 * u} fill="#ef4444" opacity={0.4 + 0.6 * night}>
        <animate attributeName="opacity" values="1;0.15;1" dur="1.6s" repeatCount="indefinite" />
      </circle>
    </g>
  );
}

/** 글씨가 겹치지 않게: 시설 이름은 아래 → 위 → 안 보이게 */
function placeLabels(list: CityLabel[]): Array<CityLabel & { py: number }> {
  const out: Array<CityLabel & { py: number; w: number }> = [];
  const order = [...list].sort((a, b) => (a.kind === 'gu' ? 0 : 1) - (b.kind === 'gu' ? 0 : 1));
  for (const l of order) {
    const fs = l.kind === 'gu' ? S * 0.85 : S * 0.62;
    const w = l.text.length * fs * 0.95;
    const tries = l.kind === 'mark' ? [l.y * K + S * 0.95, l.y * K - S * 2.9] : [l.y * K];
    const py = tries.find((y) => !out.some((o) => Math.abs(o.x - l.x) < (o.w + w) / 2 && Math.abs(o.py - y) < fs * 1.05));
    if (py === undefined) continue;
    out.push({ ...l, py, w });
  }
  return out;
}

/** 비스듬히 본 상자 하나(앞면·옆면·지붕) */
function Box({ x, y, w, d, h, c: c0, roof, win }: { x: number; y: number; w: number; d: number; h: number; c: string; roof?: string; win?: boolean }) {
  const { night } = useContext(Look);
  const dark = 1 - 0.6 * night;
  const c = night > 0.02 ? hexOf(shade(c0, dark)) : c0;
  const r = roof ? (night > 0.02 ? shade(roof, dark) : roof) : shade(c, 1.25);
  const out: ReactElement[] = [];
  out.push(<rect key="f" x={x - w / 2} y={y - h} width={w} height={h} fill={c} />);
  out.push(<path key="t" d={`M${x - w / 2},${y - h} L${x - w / 2 + d * 0.5},${y - h - d} L${x + w / 2 + d * 0.5},${y - h - d} L${x + w / 2},${y - h} Z`} fill={r} />);
  out.push(<path key="s" d={`M${x + w / 2},${y - h} L${x + w / 2 + d * 0.5},${y - h - d} L${x + w / 2 + d * 0.5},${y - d} L${x + w / 2},${y} Z`} fill={shade(c, 0.72)} />);
  if (win && h > w * 0.9) {
    // 밤: 창문마다 불이 켜짐(몇 칸은 꺼짐)
    const lit = night > 0.3;
    let i = 0;
    for (let yy = y - h + w * 0.35; yy < y - w * 0.2; yy += w * 0.42, i++)
      out.push(
        <line
          key={`w${yy}`}
          x1={x - w * 0.36}
          x2={x + w * 0.36}
          y1={yy}
          y2={yy}
          stroke={lit ? (i % 3 === 1 ? '#fff7d6' : '#fcd34d') : '#e0f2fe'}
          strokeOpacity={lit ? 0.55 + 0.4 * night : 0.45}
          strokeWidth={w * 0.1}
          strokeDasharray={lit ? `${w * 0.14} ${w * (i % 2 ? 0.1 : 0.16)}` : undefined}
        />,
      );
  }
  return <g>{out}</g>;
}

function hexOf(rgb: string): string {
  const m = rgb.match(/\d+/g)!.map(Number);
  return '#' + m.map((v) => v.toString(16).padStart(2, '0')).join('');
}
function shade(hex: string, f: number): string {
  const n = (i: number) => Math.max(0, Math.min(255, Math.round(parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) * f)));
  return `rgb(${n(0)},${n(1)},${n(2)})`;
}

/** 실제 시설: 단계만큼 높아지는 건물 + 아이콘 */
function Mark({ x, y, w, m }: { x: number; y: number; w: number; m: { icon: string; lv: number; color: string; nature?: boolean } }) {
  const u = w / 10;
  const h = (2.2 + m.lv * 1.1) * u;
  if (m.nature)
    return (
      <g>
        <path d={`M${x - 5 * u},${y + 1.6 * u} L${x - 1 * u},${y - h} L${x + 1.4 * u},${y - h * 0.55} L${x + 2.6 * u},${y - h * 0.75} L${x + 5 * u},${y + 1.6 * u} Z`} fill="#5f7d4a" />
        <path d={`M${x - 1 * u},${y - h} L${x + 1.4 * u},${y - h * 0.55} L${x},${y + 1.6 * u} Z`} fill="#4b6a3a" />
        <circle cx={x} cy={y - h - 1.6 * u} r={1.7 * u} fill="#0f172a" stroke="#fde68a" strokeWidth={0.25 * u} />
        <text x={x} y={y - h - 1.0 * u} fontSize={2.0 * u} textAnchor="middle">
          {m.icon}
        </text>
      </g>
    );
  return (
    <g>
      <ellipse cx={x} cy={y + 0.6 * u} rx={3.6 * u} ry={1.5 * u} fill={m.color} opacity={0.35} />
      <Box x={x - 1.4 * u} y={y + 0.4 * u} w={2.4 * u} d={1.4 * u} h={h * 0.7} c={m.color} win />
      <Box x={x + 1.4 * u} y={y + 1 * u} w={2 * u} d={1.2 * u} h={h} c={shade(m.color, 0.85)} win />
      <circle cx={x} cy={y - h - 1.6 * u} r={1.7 * u} fill="#0f172a" stroke="#fde68a" strokeWidth={0.25 * u} />
      <text x={x} y={y - h - 1.0 * u} fontSize={2.0 * u} textAnchor="middle">
        {m.icon}
      </text>
      {Array.from({ length: m.lv }, (_, i) => (
        <circle key={i} cx={x - (m.lv - 1) * 0.55 * u + i * 1.1 * u} cy={y + 2.6 * u} r={0.38 * u} fill="#fde047" />
      ))}
    </g>
  );
}

/** 그림이 오기 전 임시 모습 */
function Fallback({ kind, x, y, w }: { kind: CityThing; x: number; y: number; w: number }) {
  const u = w / 10;
  const { stage, night } = useContext(Look);
  switch (kind) {
    case 'center': {
      const H = heightOf('center', stage);
      return (
        <g>
          {stage >= 5 && <Box x={x - 4.2 * u} y={y - 0.2 * u} w={1.4 * u} d={1.2 * u} h={6.4 * H * u} c="#3f6f86" win />}
          {stage >= 4 && <Box x={x + 4.2 * u} y={y + 0.2 * u} w={1.4 * u} d={1.2 * u} h={5.2 * H * u} c="#56808f" win />}
          <Box x={x - 2.6 * u} y={y - 1.2 * u} w={1.6 * u} d={1.4 * u} h={5.5 * H * u} c="#4f7f8f" win />
          <Box x={x + 0.2 * u} y={y - 1.8 * u} w={1.9 * u} d={1.6 * u} h={7.6 * H * u} c="#5b93a6" win />
          {stage >= 6 && (
            <>
              <line x1={x + 0.2 * u} x2={x + 0.2 * u} y1={y - 1.8 * u - 7.6 * H * u} y2={y - 1.8 * u - 7.6 * H * u - 3 * u} stroke="#cbd5e1" strokeWidth={0.25 * u} />
              <circle cx={x + 0.2 * u} cy={y - 1.8 * u - 7.6 * H * u - 3 * u} r={0.35 * u} fill="#ef4444" opacity={0.5 + 0.5 * night} />
            </>
          )}
          <Box x={x + 2.8 * u} y={y - 1 * u} w={1.6 * u} d={1.4 * u} h={4.6 * H * u} c="#6a8a99" win />
          <Box x={x - 1.2 * u} y={y + 0.4 * u} w={1.4 * u} d={1.2 * u} h={3.6 * H * u} c="#78909c" win />
          <Box x={x + 1.6 * u} y={y + 1.2 * u} w={3.2 * u} d={1.4 * u} h={1.6 * u} c="#e7e2d6" />
          <ellipse cx={x + 1.9 * u} cy={y - 0.6 * u} rx={1.1 * u} ry={0.9 * u} fill={night > 0.3 ? '#fde68a' : '#f5f1e6'} />
        </g>
      );
    }
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
    case 'apt': {
      // 단계가 낮으면 낮은 빌라·상가, 높을수록 고층 단지
      const H = heightOf('apt', stage);
      if (stage <= 1)
        return (
          <g>
            <Box x={x - 1.8 * u} y={y} w={2 * u} d={1.4 * u} h={2.6 * u} c="#d6cdb8" win />
            <Box x={x + 1.4 * u} y={y - 0.6 * u} w={2 * u} d={1.4 * u} h={3 * u} c="#cbd5e1" win />
            <Box x={x - 0.2 * u} y={y + 1.8 * u} w={2 * u} d={1.2 * u} h={1.6 * u} c="#e7e0d0" roof="#64748b" />
          </g>
        );
      return (
        <g>
          <Box x={x - 2.2 * u} y={y - 0.2 * u} w={1.5 * u} d={1.2 * u} h={6 * H * u} c="#cbd5e1" win />
          <Box x={x} y={y - 0.8 * u} w={1.5 * u} d={1.2 * u} h={7 * H * u} c="#d6dce4" win />
          <Box x={x + 2.2 * u} y={y + 0.2 * u} w={1.5 * u} d={1.2 * u} h={5.4 * H * u} c="#c4ccd6" win />
          <Box x={x - 0.8 * u} y={y + 1.8 * u} w={1.5 * u} d={1.2 * u} h={4.2 * H * u} c="#dde3ea" win />
        </g>
      );
    }
    case 'adl':
      return (
        <g>
          <Box x={x - 0.6 * u} y={y + 0.8 * u} w={4 * u} d={1.8 * u} h={2.4 * u} c="#cbd5e1" roof="#475569" win />
          <ellipse cx={x + 2.6 * u} cy={y - 2.8 * u} rx={1.4 * u} ry={1.1 * u} fill="#e2e8f0" stroke="#64748b" strokeWidth={0.15 * u} />
          <rect x={x - 3.2 * u} y={y - 4.2 * u} width={0.5 * u} height={4.4 * u} fill="#64748b" />
          <path d={`M${x - 3.8 * u},${y - 4.2 * u} L${x - 2.1 * u},${y - 4.2 * u}`} stroke="#ef4444" strokeWidth={0.35 * u} />
        </g>
      );
    case 'shipyard':
      return (
        <g>
          <path d={`M${x - 4.4 * u},${y + 1.6 * u} L${x + 4.4 * u},${y + 1.6 * u} L${x + 3.4 * u},${y + 2.6 * u} L${x - 3.4 * u},${y + 2.6 * u} Z`} fill="#64748b" />
          <path d={`M${x - 3 * u},${y + 1.2 * u} L${x + 2.6 * u},${y + 1.2 * u} L${x + 1.8 * u},${y + 0.2 * u} L${x - 2.4 * u},${y + 0.2 * u} Z`} fill="#94a3b8" />
          <Box x={x - 0.6 * u} y={y + 0.2 * u} w={1.2 * u} d={0.8 * u} h={1.2 * u} c="#cbd5e1" />
          <path d={`M${x - 3.6 * u},${y + 1.4 * u} V${y - 5 * u} H${x + 2 * u} M${x - 3.6 * u},${y - 3.4 * u} L${x - 2 * u},${y - 5 * u}`} fill="none" stroke="#f59e0b" strokeWidth={0.4 * u} />
          <line x1={x + 1.4 * u} y1={y - 5 * u} x2={x + 1.4 * u} y2={y - 2.4 * u} stroke="#cbd5e1" strokeWidth={0.12 * u} />
        </g>
      );
    case 'arms':
      return (
        <g>
          <Box x={x - 0.8 * u} y={y + 0.8 * u} w={4.6 * u} d={2 * u} h={2.2 * u} c="#6b7280" roof="#4d5a3a" />
          <Box x={x + 2.4 * u} y={y + 1.4 * u} w={1.6 * u} d={1.2 * u} h={1.4 * u} c="#57534e" />
          <rect x={x - 2.4 * u} y={y - 5 * u} width={0.6 * u} height={4.6 * u} fill="#78716c" />
          <rect x={x - 1.2 * u} y={y - 4 * u} width={0.6 * u} height={3.6 * u} fill="#78716c" />
          <circle cx={x - 2.1 * u} cy={y - 5.6 * u} r={0.8 * u} fill="#d6d3d1" opacity={0.6} />
        </g>
      );
    case 'missile':
      return (
        <g>
          <ellipse cx={x} cy={y + 1 * u} rx={3.6 * u} ry={1.4 * u} fill="#a8a29e" />
          <path d={`M${x - 0.6 * u},${y + 0.6 * u} V${y - 5 * u} L${x},${y - 6.4 * u} L${x + 0.6 * u},${y - 5 * u} V${y + 0.6 * u} Z`} fill="#f8fafc" stroke="#94a3b8" strokeWidth={0.12 * u} />
          <path d={`M${x - 0.6 * u},${y + 0.6 * u} l-0.8,0.6 v-1.6 Z M${x + 0.6 * u},${y + 0.6 * u} l0.8,0.6 v-1.6 Z`} fill="#dc2626" />
          <path d={`M${x + 1.2 * u},${y + 0.6 * u} L${x + 1.2 * u},${y - 3.6 * u} L${x + 2 * u},${y - 3.6 * u}`} fill="none" stroke="#475569" strokeWidth={0.35 * u} />
          <Box x={x - 2.6 * u} y={y + 1.6 * u} w={1.6 * u} d={1 * u} h={1 * u} c="#e5e7eb" />
        </g>
      );
    case 'drone':
      return (
        <g>
          <Box x={x - 0.6 * u} y={y + 0.8 * u} w={3.6 * u} d={1.6 * u} h={2.2 * u} c="#e2e8f0" roof="#0ea5e9" win />
          <g transform={`translate(${x + 1.6 * u} ${y - 4.4 * u})`}>
            <path d={`M${-2.2 * u},0 H${2.2 * u} M0,${-0.5 * u} V${0.5 * u}`} stroke="#334155" strokeWidth={0.35 * u} />
            <ellipse cx={-2.2 * u} cy={-0.3 * u} rx={0.9 * u} ry={0.25 * u} fill="#94a3b8" />
            <ellipse cx={2.2 * u} cy={-0.3 * u} rx={0.9 * u} ry={0.25 * u} fill="#94a3b8" />
          </g>
        </g>
      );
    case 'cyber':
      return (
        <g>
          <Box x={x - 0.4 * u} y={y + 0.8 * u} w={3.4 * u} d={1.8 * u} h={3 * u} c="#1e293b" roof="#334155" />
          {[0, 1, 2].map((i) => (
            <line key={i} x1={x - 1.8 * u} x2={x + 1 * u} y1={y - 1.6 * u + i * 0.8 * u} y2={y - 1.6 * u + i * 0.8 * u} stroke="#22d3ee" strokeWidth={0.18 * u} opacity={0.8} />
          ))}
          <path d={`M${x + 2.6 * u},${y - 2.2 * u} q${1.6 * u},${-1.6 * u} ${0},${-3.2 * u}`} fill="none" stroke="#94a3b8" strokeWidth={0.3 * u} />
          <line x1={x + 2.4 * u} y1={y - 2.2 * u} x2={x + 2.4 * u} y2={y} stroke="#94a3b8" strokeWidth={0.3 * u} />
        </g>
      );
    case 'aero':
      return (
        <g>
          <path d={`M${x - 3.6 * u},${y + 1.6 * u} V${y - 0.6 * u} Q${x - 1.2 * u},${y - 3.4 * u} ${x + 1.2 * u},${y - 0.6 * u} V${y + 1.6 * u} Z`} fill="#cbd5e1" stroke="#64748b" strokeWidth={0.15 * u} />
          <path d={`M${x + 2.6 * u},${y + 1.4 * u} V${y - 4.6 * u} L${x + 3.1 * u},${y - 5.8 * u} L${x + 3.6 * u},${y - 4.6 * u} V${y + 1.4 * u} Z`} fill="#f1f5f9" stroke="#94a3b8" strokeWidth={0.12 * u} />
          <circle cx={x + 3.1 * u} cy={y - 3.2 * u} r={0.3 * u} fill="#1d4ed8" />
        </g>
      );
    case 'mark':
      return null;
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
