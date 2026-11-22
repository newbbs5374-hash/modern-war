// 본부 배경: 살아 있는 우리나라 지도(임시 그림).
// - 두 손가락/휠로 확대·축소, 끌어서 이동, 도시를 누르면 가까이 가서 정보 팝업
// - 평소: 도로에 자동차·버스, 바다에 배, 하늘에 여객기, 구름 그림자, 흐르는 강, 실제 시각에 맞춘 낮·밤과 불빛
// - 전쟁 때만: 공격받는 도시에 연기·불꽃, 군 차량 행렬, 전투기 / 빼앗긴 도시에는 상대 깃발
// 나중에 제작 이미지로 바꿀 때는 "땅" 층(landPath·산·숲)만 그림으로 갈아 끼우면 위 층(차량·날씨·전쟁)은 그대로 씀.
import { useEffect, useRef, useState, type PointerEvent as RPointerEvent, type WheelEvent as RWheelEvent } from 'react';
import { CITIES, type City } from '../data/cities';
import { CITY_DEFENSE_MAX } from '../game/balance';
import { FLAG_DEF } from './flag';
import type { WorldState } from '../game/world';

const W = 390;
const H = 640;
const MAX_K = 3.5;

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

export type DayMode = '자동' | '낮' | '밤';
/** 실제 시각(이 기기)으로 낮·밤: 0 = 한낮, 1 = 한밤 */
export function nightLevel(mode: DayMode, d = new Date()): number {
  if (mode === '낮') return 0;
  if (mode === '밤') return 1;
  const h = d.getHours() + d.getMinutes() / 60;
  if (h >= 7 && h < 17) return 0;
  if (h >= 20 || h < 5) return 1;
  if (h >= 17) return (h - 17) / 3; // 저녁노을
  return 1 - (h - 5) / 2; // 새벽
}

export type CityStatus = '평화' | '전시' | '공격받음' | '점령당함';
export function cityStatus(c: City, world: WorldState, me: string, atWar: boolean): CityStatus {
  if (world.owner[c.id] !== me) return '점령당함';
  if (world.defense[c.id] < CITY_DEFENSE_MAX - 2) return '공격받음';
  return atWar ? '전시' : '평화';
}

interface View {
  k: number;
  x: number;
  y: number;
}
const clampView = (v: View): View => {
  const k = Math.max(1, Math.min(MAX_K, v.k));
  return { k, x: Math.min(0, Math.max(W - W * k, v.x)), y: Math.min(0, Math.max(H - H * k, v.y)) };
};

const CAR_COLORS = ['#f8fafc', '#ef4444', '#3b82f6', '#facc15', '#22c55e', '#a855f7', '#0ea5e9', '#f97316'];

export function HomeLand(props: {
  countryId: string;
  world: WorldState;
  atWar: boolean;
  dayMode: DayMode;
  onDayMode: (m: DayMode) => void;
  onCity: (id: string) => void;
  focus?: string | null;
}) {
  const { countryId, world, atWar, dayMode, onDayMode, onCity, focus } = props;
  const r = rng(hash(countryId));
  const land = landPath(r, 235, 380, 160, 250);
  const flag = FLAG_DEF[countryId];
  const mine = flag?.bands[flag.bands.length > 2 ? 1 : 0] ?? '#3b82f6';
  const homeCities = CITIES.filter((c) => c.home === countryId);
  const pos = (i: number) => SPOTS[i % SPOTS.length];
  const mountains = Array.from({ length: 6 }, () => [140 + r() * 200, 200 + r() * 330, 14 + r() * 12] as const);
  const forests = Array.from({ length: 10 }, () => [130 + r() * 220, 220 + r() * 320] as const);
  const riverY = 260 + r() * 120;
  // 도시마다 건물 무리(가운데가 높음)
  const blocks = homeCities.map((c, i) => {
    const [cx, cy] = pos(i);
    const n = c.capital ? 11 : 7;
    return Array.from({ length: n }, (_, j) => {
      const a = (j / n) * Math.PI * 2 + r();
      const d = 6 + r() * (c.capital ? 20 : 14);
      const w = 4 + r() * 4;
      const h = (c.capital ? 10 : 6) + r() * (c.capital ? 16 : 9) - d * 0.25;
      return { x: cx + Math.cos(a) * d - w / 2, y: cy + Math.sin(a) * d * 0.6 - h, w, h: Math.max(4, h) };
    });
  });
  // 도로: 수도 ↔ 다른 도시, 그리고 이웃 도시끼리
  const roads: Array<{ id: string; d: string; a: number; b: number }> = [];
  const road = (a: number, b: number) => {
    const [x1, y1] = pos(a);
    const [x2, y2] = pos(b);
    const mx = (x1 + x2) / 2 + (y2 - y1) * 0.18;
    const my = (y1 + y2) / 2 - (x2 - x1) * 0.18;
    roads.push({ id: `road-${countryId}-${a}-${b}`, d: `M${x1},${y1} Q${mx.toFixed(1)},${my.toFixed(1)} ${x2},${y2}`, a, b });
  };
  for (let i = 1; i < homeCities.length; i++) road(0, i);
  for (let i = 1; i + 1 < homeCities.length; i++) road(i, i + 1);

  const status = homeCities.map((c) => cityStatus(c, world, countryId, atWar));
  const hot = status.some((s) => s === '공격받음' || s === '점령당함');
  const [night, setNight] = useState(() => nightLevel(dayMode));
  useEffect(() => {
    setNight(nightLevel(dayMode));
    const t = setInterval(() => setNight(nightLevel(dayMode)), 60_000);
    return () => clearInterval(t);
  }, [dayMode]);

  // ── 확대·축소·이동 ──
  const svgRef = useRef<SVGSVGElement>(null);
  const [view, setView] = useState<View>({ k: 1, x: 0, y: 0 });
  const [smooth, setSmooth] = useState(false);
  const pts = useRef(new Map<number, { x: number; y: number }>());
  const moved = useRef(0);
  const toSvg = (cx: number, cy: number) => {
    const svg = svgRef.current;
    const m = svg?.getScreenCTM();
    if (!svg || !m) return { x: cx, y: cy };
    const p = new DOMPoint(cx, cy).matrixTransform(m.inverse());
    return { x: p.x, y: p.y };
  };
  const zoomAt = (px: number, py: number, f: number, v: View) => {
    const k = Math.max(1, Math.min(MAX_K, v.k * f));
    const s = k / v.k;
    return clampView({ k, x: px - (px - v.x) * s, y: py - (py - v.y) * s });
  };
  const flyTo = (x: number, y: number, k: number) => {
    setSmooth(true);
    setView(clampView({ k, x: W / 2 - x * k, y: H * 0.45 - y * k }));
    setTimeout(() => setSmooth(false), 520);
  };
  useEffect(() => {
    if (!focus) return;
    const i = homeCities.findIndex((c) => c.id === focus);
    if (i >= 0) flyTo(pos(i)[0], pos(i)[1], 2.4);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus]);

  const onDown = (e: RPointerEvent) => {
    pts.current.set(e.pointerId, toSvg(e.clientX, e.clientY));
    if (pts.current.size === 1) moved.current = 0;
  };
  const onMove = (e: RPointerEvent) => {
    const prev = pts.current.get(e.pointerId);
    if (!prev) return;
    const cur = toSvg(e.clientX, e.clientY);
    if (pts.current.size === 1) {
      moved.current += Math.abs(cur.x - prev.x) + Math.abs(cur.y - prev.y);
      // 끄는 중일 때만 잡음(그냥 누르면 도시 클릭이 그대로 감)
      if (moved.current > 8 && !(e.currentTarget as Element).hasPointerCapture?.(e.pointerId)) (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
      setView((v) => clampView({ ...v, x: v.x + (cur.x - prev.x), y: v.y + (cur.y - prev.y) }));
    } else if (pts.current.size === 2) {
      const [a, b] = [...pts.current.entries()];
      const other = a[0] === e.pointerId ? b[1] : a[1];
      const d0 = Math.hypot(prev.x - other.x, prev.y - other.y);
      const d1 = Math.hypot(cur.x - other.x, cur.y - other.y);
      moved.current += 99;
      if (d0 > 4) setView((v) => zoomAt((cur.x + other.x) / 2, (cur.y + other.y) / 2, d1 / d0, v));
    }
    pts.current.set(e.pointerId, cur);
  };
  const onUp = (e: RPointerEvent) => {
    pts.current.delete(e.pointerId);
  };
  const onWheel = (e: RWheelEvent) => {
    const p = toSvg(e.clientX, e.clientY);
    setView((v) => zoomAt(p.x, p.y, e.deltaY < 0 ? 1.15 : 1 / 1.15, v));
  };
  const tapCity = (id: string, x: number, y: number) => {
    if (moved.current > 8) return;
    flyTo(x, y, 2.4);
    onCity(id);
  };

  const nightOn = night > 0.05;
  return (
    <div className="homeland-wrap">
      <svg
        ref={svgRef}
        className="homeland"
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid slice"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onWheel={onWheel}
      >
        <defs>
          <radialGradient id="sea" cx="60%" cy="55%" r="80%">
            <stop offset="0%" stopColor="#13507a" />
            <stop offset="100%" stopColor="#072033" />
          </radialGradient>
          <linearGradient id="land" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#4a7a40" />
            <stop offset="60%" stopColor="#5a8a45" />
            <stop offset="100%" stopColor="#7a8c42" />
          </linearGradient>
          <radialGradient id="glow">
            <stop offset="0%" stopColor="#fde68a" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#fde68a" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="cloud">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="smoke">
            <stop offset="0%" stopColor="#1f2937" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#374151" stopOpacity="0" />
          </radialGradient>
          <path id={`coast-${countryId}`} d="M30,90 C150,20 330,40 370,140 S380,520 300,610 S40,600 20,420 S-10,160 30,90Z" />
          <path id={`air-${countryId}`} d="M-40,120 L430,40" />
          <path id={`jet-${countryId}`} d="M430,560 C300,420 200,300 -40,200" />
        </defs>
        <g style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})`, transformOrigin: '0 0', transition: smooth ? 'transform .5s ease' : 'none' }}>
          {/* 바다 */}
          <rect x={-W} y={-H} width={W * 3} height={H * 3} fill="url(#sea)" />
          {Array.from({ length: 12 }, (_, i) => (
            <path key={i} className="wave" d={`M${-20 + (i % 3) * 40},${30 + i * 52} q20,-6 40,0 t40,0`} fill="none" stroke="#bae6fd33" strokeWidth="2" style={{ animationDelay: `${-i * 0.7}s` }} />
          ))}
          {/* 땅 층(나중에 제작 이미지로 바꿀 자리) */}
          <path d={land} fill="#0b2a40" transform="translate(4,6)" opacity="0.7" />
          <path d={land} fill="#e8d9a8" stroke="#e8d9a8" strokeWidth="9" />
          <path d={land} fill="url(#land)" />
          <path d={`M120,${riverY} C190,${riverY - 40} 240,${riverY + 60} 400,${riverY + 10}`} fill="none" stroke="#38bdf8" strokeWidth="5" strokeLinecap="round" />
          <path className="river-flow" d={`M120,${riverY} C190,${riverY - 40} 240,${riverY + 60} 400,${riverY + 10}`} fill="none" stroke="#e0f2fe" strokeWidth="1.4" strokeDasharray="3 9" strokeLinecap="round" />
          {forests.map(([x, y], i) => (
            <g key={`f${i}`} className="tree" style={{ animationDelay: `${-i * 0.4}s`, transformOrigin: `${x}px ${y + 6}px` }}>
              <circle cx={x} cy={y} r="7" fill="#1f5a2e" />
              <circle cx={x + 7} cy={y + 3} r="6" fill="#2a6b38" />
            </g>
          ))}
          {mountains.map(([x, y, s], i) => (
            <g key={`m${i}`}>
              <polygon points={`${x - s},${y + s * 0.7} ${x},${y - s} ${x + s},${y + s * 0.7}`} fill="#8a7656" />
              <polygon points={`${x},${y - s} ${x + s},${y + s * 0.7} ${x + s * 0.2},${y + s * 0.7}`} fill="#64543d" />
              <polygon points={`${x - s * 0.3},${y - s * 0.4} ${x},${y - s} ${x + s * 0.3},${y - s * 0.4}`} fill="#f1f5f9" />
            </g>
          ))}
          {/* 밤: 땅과 바다를 어둡게(불빛·차량은 그 위) */}
          <rect x={-W} y={-H} width={W * 3} height={H * 3} fill="#0b1638" opacity={night * 0.55} pointerEvents="none" />

          {/* 도로와 차량 */}
          {roads.map((rd) => (
            <g key={rd.id}>
              <path id={rd.id} d={rd.d} fill="none" stroke="#3f3f46" strokeWidth="5" strokeLinecap="round" />
              <path d={rd.d} fill="none" stroke="#fde68a" strokeWidth="0.6" strokeDasharray="4 4" />
            </g>
          ))}
          {roads.flatMap((rd, ri) =>
            [0, 1, 2].map((j) => {
              const back = (ri + j) % 2 === 1;
              const bus = j === 2 && ri % 2 === 0;
              const color = CAR_COLORS[(ri * 3 + j) % CAR_COLORS.length];
              const dur = 9 + ((ri * 5 + j * 3) % 7);
              return (
                <g key={`${rd.id}-car${j}`}>
                  {bus ? <rect x="-5" y="-2" width="10" height="4" rx="1" fill="#16a34a" stroke="#052e16" strokeWidth="0.4" /> : <rect x="-3" y="-1.6" width="6" height="3.2" rx="1" fill={color} stroke="#111" strokeWidth="0.3" />}
                  {nightOn && <circle cx={bus ? 5.5 : 3.5} cy="0" r="1.4" fill="#fef9c3" opacity={night} />}
                  <animateMotion dur={`${dur}s`} begin={`${-j * dur / 3}s`} repeatCount="indefinite" rotate="auto" keyPoints={back ? '1;0' : '0;1'} keyTimes="0;1" calcMode="linear">
                    <mpath href={`#${rd.id}`} />
                  </animateMotion>
                </g>
              );
            }),
          )}

          {/* 도시: 건물 무리 · 밤 불빛 */}
          {homeCities.map((c, i) => {
            const [x, y] = pos(i);
            const st = status[i];
            return (
              <g key={c.id} className="city" onClick={() => tapCity(c.id, x, y)}>
                <ellipse cx={x} cy={y + 4} rx={c.capital ? 30 : 22} ry={c.capital ? 14 : 10} fill="#cbd5e1" opacity="0.35" />
                {blocks[i].map((b, j) => (
                  <g key={j}>
                    <rect x={b.x} y={b.y} width={b.w} height={b.h} fill={j % 3 === 0 ? '#cbd5e1' : j % 3 === 1 ? '#94a3b8' : '#e2e8f0'} stroke="#334155" strokeWidth="0.4" />
                    <rect x={b.x} y={b.y} width={b.w} height="1.6" fill="#64748b" />
                    {nightOn && (
                      <rect x={b.x + 1} y={b.y + 2.5} width={Math.max(1, b.w - 2)} height={Math.max(1, b.h - 4)} fill="#fde047" opacity={night * (0.35 + ((j * 37) % 10) / 20)} className="win" style={{ animationDelay: `${-j}s` }} />
                    )}
                  </g>
                ))}
                {nightOn && <circle cx={x} cy={y - 4} r={c.capital ? 34 : 24} fill="url(#glow)" opacity={night * 0.75} />}
                {st === '점령당함' ? (
                  <g transform={`translate(${x + 8},${y - 34})`}>
                    <line x1="0" y1="0" x2="0" y2="26" stroke="#e5e7eb" strokeWidth="1.2" />
                    <g className="flag-wave">
                      {(FLAG_DEF[world.owner[c.id]]?.bands ?? ['#ef4444']).map((col, k, arr) => (
                        <rect key={k} x="0.6" y={(12 / arr.length) * k} width="17" height={12 / arr.length + 0.1} fill={col} />
                      ))}
                    </g>
                  </g>
                ) : (
                  c.capital && (
                    <g transform={`translate(${x + 10},${y - 32})`}>
                      <line x1="0" y1="0" x2="0" y2="22" stroke="#e5e7eb" strokeWidth="1" />
                      <rect className="flag-wave" x="0.5" y="0" width="13" height="8" fill={mine} stroke="#0b1220" strokeWidth="0.4" />
                    </g>
                  )
                )}
                {(st === '공격받음' || st === '점령당함') && (
                  <g>
                    {[0, 1, 2, 3].map((k) => (
                      <circle key={k} className="smoke" cx={x - 6 + k * 5} cy={y - 12} r="10" fill="url(#smoke)" style={{ animationDelay: `${-k * 0.8}s` }} />
                    ))}
                    <circle className="fire" cx={x - 3} cy={y - 6} r="3.4" fill="#f97316" />
                    <circle className="fire" cx={x + 4} cy={y - 4} r="2.4" fill="#facc15" style={{ animationDelay: '-.3s' }} />
                  </g>
                )}
                <text x={x} y={y + (c.capital ? 28 : 22)} textAnchor="middle" className="homeland-city">
                  {c.capital ? '★ ' : ''}
                  {c.name}
                  {st === '공격받음' ? ' 🔥' : st === '점령당함' ? ' (빼앗김)' : ''}
                </text>
                <circle cx={x} cy={y - 6} r={c.capital ? 30 : 22} fill="transparent" />
              </g>
            );
          })}

          {/* 바다: 배 · 여객선 */}
          {[0, 1, 2].map((j) => (
            <g key={`boat${j}`}>
              <path d="M-5,0 L5,0 L3.5,2.4 L-3.5,2.4Z" fill={j === 1 ? '#f8fafc' : '#b45309'} />
              <rect x="-2" y="-3" width={j === 1 ? 5 : 3} height="3" fill={j === 1 ? '#ef4444' : '#f8fafc'} />
              <path d="M-5,1 l-8,-2 M-5,1.6 l-8,2" stroke="#e0f2fe" strokeWidth="0.6" opacity="0.7" />
              <animateMotion dur={`${50 + j * 15}s`} begin={`${-j * 20}s`} repeatCount="indefinite" rotate="auto" keyPoints={j === 2 ? '1;0' : '0;1'} keyTimes="0;1" calcMode="linear">
                <mpath href={`#coast-${countryId}`} />
              </animateMotion>
            </g>
          ))}

          {/* 전쟁 때만: 군 차량 행렬 */}
          {hot &&
            roads.slice(0, 2).map((rd) =>
              [0, 1, 2].map((j) => (
                <g key={`${rd.id}-mil${j}`}>
                  <rect x="-4" y="-2" width="8" height="4" rx="0.6" fill="#4d5b2c" stroke="#1a2010" strokeWidth="0.4" />
                  <rect x="1" y="-1.4" width="2.4" height="2.8" fill="#3a4520" />
                  <animateMotion dur="16s" begin={`${-j * 1.6}s`} repeatCount="indefinite" rotate="auto" keyPoints="0;1" keyTimes="0;1" calcMode="linear">
                    <mpath href={`#${rd.id}`} />
                  </animateMotion>
                </g>
              )),
            )}
        </g>

        {/* 하늘 층(확대와 상관없이 위를 지나감) */}
        <g className="sky" pointerEvents="none">
          {[0, 1, 2].map((j) => (
            <g key={`cl${j}`} className="cloud" style={{ animationDuration: `${70 + j * 25}s`, animationDelay: `${-j * 30}s` }}>
              <ellipse cx={40} cy={120 + j * 170} rx="46" ry="16" fill="#00000022" transform="translate(14,26)" />
              <ellipse cx={40} cy={120 + j * 170} rx="46" ry="16" fill="url(#cloud)" opacity={0.75 - night * 0.45} />
              <ellipse cx={66} cy={112 + j * 170} rx="30" ry="13" fill="url(#cloud)" opacity={0.75 - night * 0.45} />
            </g>
          ))}
          <g>
            <path d="M-7,0 L7,0 M0,-5 L-2,0 L0,5 M-6,-2 L-7,0 L-6,2" stroke="#f8fafc" strokeWidth="1.6" fill="none" strokeLinecap="round" />
            {nightOn && <circle cx="-7" cy="0" r="1.2" fill="#ef4444" className="blink" />}
            <animateMotion dur="26s" repeatCount="indefinite" rotate="auto">
              <mpath href={`#air-${countryId}`} />
            </animateMotion>
          </g>
          {hot &&
            [0, 1].map((j) => (
              <g key={`jet${j}`}>
                <path d="M-6,0 L6,0 M1,-4 L-1,0 L1,4 M-5,-2 L-6,0 L-5,2" stroke="#9ca3af" strokeWidth="1.4" fill="none" strokeLinecap="round" />
                <path d="M-6,0 L-22,0" stroke="#ffffff66" strokeWidth="1" />
                <animateMotion dur="7s" begin={`${-j * 0.6}s`} repeatCount="indefinite" rotate="auto">
                  <mpath href={`#jet-${countryId}`} />
                </animateMotion>
              </g>
            ))}
          {/* 낮·밤 */}
          {night > 0 && night < 1 && <rect x="0" y="0" width={W} height={H} fill="#fb923c" opacity={(1 - Math.abs(night - 0.5) * 2) * 0.12} />}
        </g>
      </svg>
      <div className="map-zoom">
        <button aria-label="확대" onClick={() => setView((v) => zoomAt(W / 2, H / 2, 1.4, v))}>
          ＋
        </button>
        <button aria-label="축소" onClick={() => setView((v) => zoomAt(W / 2, H / 2, 1 / 1.4, v))}>
          －
        </button>
        <button aria-label="전체 보기" onClick={() => flyTo(W / 2, H / 2 / 0.9, 1)}>
          ⤢
        </button>
        <button aria-label={`낮·밤: ${dayMode}`} title={`낮·밤: ${dayMode}(누르면 바뀜)`} onClick={() => onDayMode(dayMode === '자동' ? '낮' : dayMode === '낮' ? '밤' : '자동')}>
          {dayMode === '자동' ? '🕒' : dayMode === '낮' ? '☀️' : '🌙'}
        </button>
      </div>
    </div>
  );
}
