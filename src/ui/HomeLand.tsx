// 본부 배경: 살아 있는 우리나라 지도. 땅은 수도 둘레 실제 해안선(homeTerrain.ts).
// - 두 손가락/휠로 확대·축소, 끌어서 이동, 도시를 누르면 가까이 가서 정보 팝업
// - 평소: 도로에 자동차·버스, 바다에 배, 하늘에 여객기, 구름 그림자, 흐르는 강, 실제 시각에 맞춘 낮·밤과 불빛
// - 전쟁 때만: 공격받는 도시에 연기·불꽃, 군 차량 행렬, 전투기 / 빼앗긴 도시에는 상대 깃발
// 꾸밈 그림: src/assets/field/land-*.png 가 있으면 건물·나무·산을 그 그림으로 그림(명령문 src/assets/field/LAND.md). 도로·강·차량·날씨·전쟁 연출은 그대로 코드로 그림.
import { Carrier, Escort } from './units';
import { Mover } from './mover';
import { iconArt } from './iconArt';
import { useEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent, type WheelEvent as RWheelEvent } from 'react';
import { CITIES, type City } from '../data/cities';
import { CITY_DEFENSE_MAX } from '../game/balance';
import { FLAG_DEF } from './flag';
import { CITY_LANDMARK, LAND_ART, fieldArt, landPick } from './fieldArt';
import type { WorldState } from '../game/world';
import { homeTerrain } from './homeTerrain';
import { landOwners } from '../game/territory';
import { COUNTRY_COLORS } from './WorldMap';
// 바닥 그림(11-23 대장 결정 "코드 실사화"): 이음새 없는 풀·들판·모래·바다 그림을 깔고 햇빛·그림자를 코드로 더함.
// 11-24: 대장이 만든 바닥 그림 4장(home-ground-*, 이음새 없는 항공사진풍)으로 바꿈. 땅·먼 바다·해안 얕은 바다·도시 둘레.
import groundLand from '../assets/field/home-ground-land.webp';
import groundSea from '../assets/field/home-ground-sea.webp';
import groundShallow from '../assets/field/home-ground-shallow.webp';
import groundUrban from '../assets/field/home-ground-urban.webp';
import groundSand from '../assets/city/city-ground-beach.webp';
// 실사 자료(11/24 C2): 나라마다 NASA 야간 불빛·지형 음영 그림 + Natural Earth 실제 도로·철도·강(scripts/gen_homegeo.py)
import HOME_BOUNDS from '../assets/home/bounds.json';
import { GEO } from '../data/realGeo';
import { useHomeGeo } from './homeGeo';
import { geoRect, satUrl, sunMix, useHomeSat } from './homeSat';
export type { HomeGeo } from './homeGeo';

const HOME_IMG = import.meta.glob('../assets/home/*.webp', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
const homeImg = (kind: 'night' | 'relief', id: string): string | null => HOME_IMG[`../assets/home/${kind}-${id}.webp`] ?? null;
/** 그림 범위(경도·위도) → 세계 좌표 사각형 */
function boundsRect(id: string): { x: number; y: number; w: number; h: number } | null {
  const b = (HOME_BOUNDS as Record<string, number[]>)[id];
  if (!b) return null;
  const [lon0, lat0, lon1, lat1] = b;
  const l = lon0 < GEO.L0 ? lon0 + 360 : lon0;
  return { x: (l - GEO.L0) * GEO.PX, y: (GEO.B1 - lat1) * GEO.PX, w: (lon1 - lon0) * GEO.PX, h: (lat1 - lat0) * GEO.PX };
}
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

// 11-25 대장 요청: 하늘의 비행체를 실사 그림으로(부대·연구 그림 재사용). 그림은 오른쪽(여객기는 왼쪽)을 봄.
const PLANE_ART = { fighter: iconArt('icon-unit-fighter'), airliner: iconArt('icon-tech-m-tanker') };
/** 실사 비행기: 길 방향으로 돌고(rotate=auto), 그림자를 땅에 드리움. flipY = 오른쪽→왼쪽 길에서 뒤집힘 방지 */
function PlaneArt({ kind, size, flipY = false, trail = false }: { kind: 'fighter' | 'airliner'; size: number; flipY?: boolean; trail?: boolean }) {
  const href = PLANE_ART[kind];
  if (!href) return null;
  // 여객기 그림은 왼쪽을 보므로 좌우를 뒤집어 진행 방향(오른쪽)에 맞춤
  const sx = kind === 'airliner' ? -1 : 1;
  const sy = flipY ? -1 : 1;
  return (
    <g transform={`scale(${sx},${sy})`}>
      {trail && <path d={`M${-size * 0.35 * sx},-1.2 l${-size * 1.4 * sx},0 M${-size * 0.35 * sx},1.2 l${-size * 1.4 * sx},0`} stroke="#ffffff" strokeOpacity="0.4" strokeWidth="0.9" />}
      <image href={href} x={-size / 2} y={-size / 2} width={size} height={size} filter="url(#plane-shadow)" />
    </g>
  );
}

// 11-25 움직이는 것 실사 그림: 군용은 부대 그림, 민간 차·배는 대장 그림(move-*.webp, 없으면 코드 도형)
const MOVE_ART = {
  cars: landPick(['move-car-1', 'move-car-2', 'move-car-3']),
  bus: fieldArt('move-bus'),
  ferry: fieldArt('move-ferry'),
  fishing: fieldArt('move-fishing'),
  carrier: fieldArt('unit-carrier'),
  escort: fieldArt('unit-destroyer'),
  ifv: iconArt('icon-unit-ifv'),
  tank: fieldArt('unit-tank'),
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
  /** 도시 크기(0~1): 인구·건물 단계가 클수록 불빛이 넓고 밝음 */
  cityGrowth?: Record<string, number>;
  /** 도시 위 표시: 특구·대형 사업 공사(🏗️) 아이콘 */
  cityTags?: Record<string, string>;
}) {
  const { countryId, world, atWar, dayMode, onDayMode, onCity, focus, cityGrowth, cityTags } = props;
  const geo = useHomeGeo(countryId);
  // 11-25 실제 위성 바탕·정밀 해안선·바다 깊이·해 방향 그림자(없으면 예전 그림 바닥)
  const sat = useHomeSat(countryId);
  const vw = homeTerrain(countryId).view;
  const worldT = `translate(${(-vw.tx * vw.s).toFixed(2)},${(-vw.ty * vw.s).toFixed(2)}) scale(${vw.s.toFixed(4)})`;
  const imgRect = boundsRect(countryId);
  const nightImg = homeImg('night', countryId);
  const reliefImg = homeImg('relief', countryId);
  const r = rng(hash(countryId));
  // 땅 = 수도 둘레 실제 해안선(homeTerrain.ts)
  const terrain = homeTerrain(countryId);
  // 정밀 해안선(세계 좌표) → 본부 좌표. 없으면 예전 해안선
  const coastH = useMemo(
    () =>
      sat?.coast
        ? sat.coast.replace(/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g, (_m, a, b) => `${((+a - vw.tx) * vw.s).toFixed(1)},${((+b - vw.ty) * vw.s).toFixed(1)}`)
        : null,
    [sat, vw.tx, vw.ty, vw.s],
  );
  const land = coastH ?? terrain.land;
  const flag = FLAG_DEF[countryId];
  const mine = flag?.color ?? '#3b82f6';
  // 본부 지도 = 우리나라 전체(11/24 대장 결정 2안). 내 도시 모두 실제 위치, 수도가 맨 앞
  const homeCities = CITIES.filter((c) => c.home === countryId).sort((a, b) => Number(b.capital) - Number(a.capital));
  const pos = (i: number): [number, number] => terrain.cityPos[homeCities[i].id];
  const CAP: [number, number] = pos(0);
  /** 도시 크기(건물 무리 배율): 수도 0.5, 다른 도시 0.34 */
  const citySc = (i: number) => (homeCities[i].capital ? 0.5 : 0.34);
  // 11-25 산·숲 그림은 지웠지만, 뒤 도시 배치가 그대로이도록 같은 수만큼 난수를 씀
  for (let k = 0; k < 190; k++) r();
  const riverY = 260 + r() * 120;
  // 도시마다 건물 무리(가운데가 높음)
  const blocks = homeCities.map((_c, i) => {
    const [cx, cy] = pos(i);
    // 수도: 가운데 고층 빌딩 숲 → 바깥으로 낮은 주택가
    const n = 64;
    return Array.from({ length: n }, (_, j) => {
      const a = (j / n) * Math.PI * 2 * 3 + r();
      const d = 6 + Math.sqrt(j / n) * 80 + r() * 8;
      const w = 6 + r() * 6;
      const h = Math.max(5, 34 + r() * 26 - d * 0.42);
      return { x: cx + Math.cos(a) * d - w / 2, y: cy + Math.sin(a) * d * 0.62 - h, w, h, d };
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
  // 수도 순환 도로 + 수도 ↔ 다른 도시 고속도로
  const [ccx, ccy] = CAP;
  const ring = (rx: number, ry: number) => `M${ccx - rx},${ccy} a${rx},${ry} 0 1,0 ${rx * 2},0 a${rx},${ry} 0 1,0 ${-rx * 2},0`;
  roads.push({ id: `road-${countryId}-ring1`, d: ring(58, 36), a: 0, b: 0 });
  homeCities.forEach((_c, i) => {
    if (i && !terrain.far.includes(homeCities[i].id)) road(0, i);
  });

  // 대장이 만든 꾸밈 그림(있을 때만). 없으면 아래 도형 그대로
  const art = {
    landmark: fieldArt(LAND_ART.landmark),
    towers: landPick(LAND_ART.towers),
    offices: landPick(LAND_ART.offices),
    houses: landPick(LAND_ART.houses),
    factory: fieldArt(LAND_ART.factory),
    port: fieldArt(LAND_ART.port),
    base: fieldArt(LAND_ART.base),
    trees: landPick(LAND_ART.trees),
    mountain: fieldArt(LAND_ART.mountain),
  };
  /** 건물 칸의 그림: 가운데 고층 → 중간 빌딩 → 바깥 주택 */
  const blockArt = (d: number, j: number): string | null => {
    const set = d < 34 ? art.towers : d < 62 ? art.offices : art.houses;
    return set.length ? set[j % set.length] : null;
  };
  const lands = landOwners(world);
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
  // 위성 사진: 확대 1배는 한 장, 1.5배 넘게 확대하면 화면에 보이는 고해상 조각만 더 불러옴
  const satRect = sat ? geoRect(sat.b) : null;
  const reliefRect = sat?.rb ? geoRect(sat.rb) : null;
  const satTiles =
    sat && satRect && view.k >= 1.5
      ? sat.tiles.filter(([tx, ty]) => {
          const wx0 = satRect.x + ((tx * sat.tile) / sat.w1) * satRect.w;
          const wy0 = satRect.y + ((ty * sat.tile) / sat.h1) * satRect.h;
          const wx1 = satRect.x + (Math.min(sat.w1, (tx + 1) * sat.tile) / sat.w1) * satRect.w;
          const wy1 = satRect.y + (Math.min(sat.h1, (ty + 1) * sat.tile) / sat.h1) * satRect.h;
          const sx0 = (wx0 - vw.tx) * vw.s * view.k + view.x;
          const sx1 = (wx1 - vw.tx) * vw.s * view.k + view.x;
          const sy0 = (wy0 - vw.ty) * vw.s * view.k + view.y;
          const sy1 = (wy1 - vw.ty) * vw.s * view.k + view.y;
          return sx1 > -40 && sx0 < W + 40 && sy1 > -40 && sy0 < H + 40;
        })
      : [];
  // 해 방향 그림자: 실제 시각(낮 고정이면 한낮), 밤에는 사라짐
  const sm = sunMix();
  const sun = dayMode === '낮' && sm.am + sm.noon + sm.pm === 0 ? { am: 0, noon: 1, pm: 0 } : sm;
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
          <pattern id="g-grass" patternUnits="userSpaceOnUse" width="240" height="240"><image href={groundLand} width="240" height="240" /></pattern>
          <pattern id="g-sea" patternUnits="userSpaceOnUse" width="240" height="240"><image href={groundSea} width="240" height="240" /></pattern>
          <pattern id="g-shoal" patternUnits="userSpaceOnUse" width="160" height="160"><image href={groundShallow} width="160" height="160" /></pattern>
          <pattern id="g-urban" patternUnits="userSpaceOnUse" width="120" height="120"><image href={groundUrban} width="120" height="120" /></pattern>
          <radialGradient id="g-urban-fade">
            <stop offset="55%" stopColor="#fff" stopOpacity="1" />
            <stop offset="100%" stopColor="#fff" stopOpacity="0" />
          </radialGradient>
          <mask id="g-urban-mask" maskContentUnits="objectBoundingBox">
            <rect width="1" height="1" fill="url(#g-urban-fade)" />
          </mask>
          <pattern id="g-sand" patternUnits="userSpaceOnUse" width="60" height="60"><image href={groundSand} width="60" height="60" /></pattern>
          {/* 햇빛: 왼쪽 위가 밝고 가장자리는 살짝 어둡게 */}
          <radialGradient id="g-sun" cx="20%" cy="10%" r="95%">
            <stop offset="0%" stopColor="#fff6d8" stopOpacity="0.3" />
            <stop offset="55%" stopColor="#fff6d8" stopOpacity="0" />
            <stop offset="100%" stopColor="#0b1d33" stopOpacity="0.35" />
          </radialGradient>
          <radialGradient id="g-shallow" cx="50%" cy="50%" r="50%">
            <stop offset="70%" stopColor="#3fb6c9" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#3fb6c9" stopOpacity="0" />
          </radialGradient>
          {/* 땅 높낮이 얼룩 */}
          <filter id="g-relief" x="0" y="0" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="0.012" numOctaves="4" seed="7" />
            <feColorMatrix type="matrix" values="0 0 0 0 .2  0 0 0 0 .25  0 0 0 0 .1  0 0 0 .9 -.3" />
            <feComposite in2="SourceGraphic" operator="in" />
          </filter>
          <filter id="plane-shadow" x="-50%" y="-50%" width="220%" height="220%">
            <feDropShadow dx="5" dy="9" stdDeviation="1.6" floodColor="#0b1a10" floodOpacity="0.35" />
          </filter>
          {/* 11-25 흐르는 물결(바다 그림을 두 겹으로 반대로 천천히 움직임) */}
          <pattern id="g-ripple1" patternUnits="userSpaceOnUse" width="200" height="200">
            <image href={groundSea} width="200" height="200" />
            <animateTransform attributeName="patternTransform" type="translate" from="0 0" to="200 100" dur="60s" repeatCount="indefinite" />
          </pattern>
          <pattern id="g-ripple2" patternUnits="userSpaceOnUse" width="140" height="140" patternTransform="rotate(30)">
            <image href={groundSea} width="140" height="140" />
            <animateTransform attributeName="patternTransform" type="translate" from="140 0" to="0 70" dur="45s" repeatCount="indefinite" additive="sum" />
          </pattern>
          <filter id="g-soft2">
            <feGaussianBlur stdDeviation="3" />
          </filter>
          <filter id="g-soft">
            <feGaussianBlur stdDeviation="6" />
          </filter>
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
          {/* 배 길: 수도 가까운 실제 바다(바다가 화면에 없으면 배를 안 그림) */}
          <path id={`coast-${countryId}`} d={terrain.seaLoop ?? 'M0,0'} />
          <clipPath id={`home-land-${countryId}`}>
            <path d={land} />
          </clipPath>
          <path id={`air-${countryId}`} d="M-40,120 L430,40" />
          <path id={`jet-${countryId}`} d="M430,560 C300,420 200,300 -40,200" />
          <path id={`cap-${countryId}`} d="M-60,470 C60,560 250,640 450,560" />
        </defs>
        <g style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})`, transformOrigin: '0 0', transition: smooth ? 'transform .5s ease' : 'none' }}>
          {/* 바다 */}
          <rect x={-W} y={-H} width={W * 3} height={H * 3} fill="url(#g-sea)" />
          {Array.from({ length: 12 }, (_, i) => (
            <path key={i} className="wave" d={`M${-20 + (i % 3) * 40},${30 + i * 52} q20,-6 40,0 t40,0`} fill="none" stroke="#ffffff22" strokeWidth="2" style={{ animationDelay: `${-i * 0.7}s` }} />
          ))}
          {sat && satRect ? (
            <>
              {/* 11-25 실제 바다 깊이 색(얕은 청록 → 깊은 남색) + 흐르는 물결 */}
              {reliefRect && (
                <g transform={worldT} pointerEvents="none">
                  <image href={satUrl(`${countryId}-depth.webp`)} x={reliefRect.x} y={reliefRect.y} width={reliefRect.w} height={reliefRect.h} preserveAspectRatio="none" />
                </g>
              )}
              <rect x={-W} y={-H} width={W * 3} height={H * 3} fill="url(#g-ripple1)" opacity="0.22" style={{ mixBlendMode: 'soft-light' }} pointerEvents="none" />
              <rect x={-W} y={-H} width={W * 3} height={H * 3} fill="url(#g-ripple2)" opacity="0.16" style={{ mixBlendMode: 'screen' }} pointerEvents="none" />
              {/* 해안 얕은 물빛(선 없이 번짐) */}
              <path d={land} fill="none" stroke="#7fe3e0" strokeOpacity="0.22" strokeWidth="9" strokeLinejoin="round" filter="url(#g-soft2)" pointerEvents="none" />
              <path d={land} fill="#7d8a5a" pointerEvents="none" />
              {/* 실제 위성 사진(1배 한 장 + 확대 조각) */}
              <g transform={worldT} pointerEvents="none">
                <image href={satUrl(`${countryId}-0.webp`)} x={satRect.x} y={satRect.y} width={satRect.w} height={satRect.h} preserveAspectRatio="none" />
                {satTiles.map(([tx, ty]) => {
                  const x = satRect.x + ((tx * sat.tile) / sat.w1) * satRect.w;
                  const y = satRect.y + ((ty * sat.tile) / sat.h1) * satRect.h;
                  const w = (Math.min(sat.tile, sat.w1 - tx * sat.tile) / sat.w1) * satRect.w;
                  const h = (Math.min(sat.tile, sat.h1 - ty * sat.tile) / sat.h1) * satRect.h;
                  // 조각 사이 실금 방지: 아주 조금 겹침
                  const e = (0.6 / sat.tile) * (satRect.w / sat.w1) * sat.tile;
                  return <image key={`${tx}-${ty}`} href={satUrl(`${countryId}/1-${tx}-${ty}.webp`)} x={x} y={y} width={w + e} height={h + e} preserveAspectRatio="none" />;
                })}
                {/* 해 방향 산 그림자(아침 동쪽 해 → 저녁 서쪽 해) */}
                {reliefRect &&
                  (['am', 'noon', 'pm'] as const).map((k) =>
                    sun[k] * (1 - night) > 0.02 ? (
                      <image key={k} href={satUrl(`${countryId}-sh-${k}.webp`)} x={reliefRect.x} y={reliefRect.y} width={reliefRect.w} height={reliefRect.h} preserveAspectRatio="none" opacity={(sun[k] * (1 - night) * 0.42).toFixed(2)} />
                    ) : null,
                  )}
              </g>
            </>
          ) : (
            <>
          {/* 땅 층(나중에 제작 이미지로 바꿀 자리) */}
          {/* 얕은 바다 띠 → 모래 해안 → 풀밭 + 들판 + 높낮이 얼룩 + 파도 거품 */}
          <path d={land} fill="none" stroke="url(#g-shoal)" strokeWidth="40" strokeLinejoin="round" />
          <path d={land} fill="url(#g-shallow)" stroke="#5fd0dc" strokeWidth="34" strokeOpacity="0.15" filter="url(#g-soft)" />
          <path d={land} fill="url(#g-sand)" stroke="url(#g-sand)" strokeWidth="12" />
          <path d={land} fill="url(#g-grass)" />
          {reliefImg && imgRect ? (
            <g clipPath={`url(#home-land-${countryId})`} pointerEvents="none">
              <path d={land} fill="#000" filter="url(#g-relief)" opacity="0.12" />
              <g transform={worldT}>
                <image href={reliefImg} x={imgRect.x} y={imgRect.y} width={imgRect.w} height={imgRect.h} preserveAspectRatio="none" opacity="0.95" />
              </g>
            </g>
          ) : (
            <path d={land} fill="#000" filter="url(#g-relief)" opacity="0.3" />
          )}
            </>
          )}
          {/* 빼앗긴 도: 점령한 나라 색 + 빗금 */}
          <defs>
            <pattern id="home-occ" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="3" height="10" fill="#fff" fillOpacity="0.3" />
            </pattern>
          </defs>
          {terrain.provs
            .filter((p) => (lands[p.id] ?? countryId) !== countryId)
            .map((p) => (
              <g key={p.id} pointerEvents="none">
                <path d={p.d} fill={COUNTRY_COLORS[lands[p.id]] ?? '#ef4444'} fillOpacity="0.45" />
                <path d={p.d} fill="url(#home-occ)" />
              </g>
            ))}
          {/* 11-25 대장 요청: 나라·도 윤곽선(흰 점선) 없앰 */}
          {geo ? (
            <g clipPath={`url(#home-land-${countryId})`} pointerEvents="none">
              <g transform={worldT}>
                {/* 실제 강 */}
                <path d={geo.river} fill="none" stroke="#2b7fa3" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
                <path className="river-flow" d={geo.river} fill="none" stroke="#e0f2fe" strokeWidth="0.9" strokeDasharray="3 9" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
                {/* 실제 국도(작은 나라만)·철도·고속도로 */}
                {geo.road2 && <path d={geo.road2} fill="none" stroke="#e7dcc0" strokeOpacity="0.55" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />}
                {/* 11-25: 철도의 흰 점선이 나라 경계선처럼 보여서 은은한 실선만 남김 */}
                <path d={geo.rail} fill="none" stroke="#3b3f46" strokeOpacity="0.4" strokeWidth="0.9" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
                <path d={geo.road} fill="none" stroke="#3a3d42" strokeOpacity="0.55" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
                <path d={geo.road} fill="none" stroke="#f3c969" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
              </g>
            </g>
          ) : (
            <g clipPath={`url(#home-land-${countryId})`}>
              <path d={`M120,${riverY} C190,${riverY - 40} 240,${riverY + 60} 400,${riverY + 10}`} fill="none" stroke="#2b7fa3" strokeWidth="4" strokeLinecap="round" />
              <path className="river-flow" d={`M120,${riverY} C190,${riverY - 40} 240,${riverY + 60} 400,${riverY + 10}`} fill="none" stroke="#e0f2fe" strokeWidth="1.4" strokeDasharray="3 9" strokeLinecap="round" />
            </g>
          )}
          {/* 11-25 대장 요청: 나무·산 그림 지움(위성 사진이 실제 숲·산을 보여 줌) */}
          {/* 밤: 땅과 바다를 어둡게(불빛·차량은 그 위) */}
          <rect x={-W} y={-H} width={W * 3} height={H * 3} fill="#0b1638" opacity={night * (nightImg ? 0.72 : 0.55)} pointerEvents="none" />
          {/* 밤: 실제 야간 위성 불빛(NASA) + 고속도로 가로등 */}
          {nightOn && geo && geo.dots[0] ? (
            <g pointerEvents="none" opacity={night} transform={worldT}>
              <path d={geo.road} fill="none" stroke="#ffb54a" strokeOpacity="0.35" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
              <path d={geo.dots[0]} stroke="#ffcf7a" strokeOpacity="0.55" strokeWidth="1.3" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
              <path d={geo.dots[1]} stroke="#ffd98f" strokeOpacity="0.85" strokeWidth="1.7" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
              <path d={geo.dots[2]} stroke="#fff3d1" strokeWidth="2.1" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
              <path d={geo.dots[2]} stroke="#ffb347" strokeOpacity="0.18" strokeWidth="7" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
            </g>
          ) : nightOn && nightImg && imgRect && (
            <g pointerEvents="none" opacity={night}>
              <image href={nightImg} transform={worldT} x={imgRect.x} y={imgRect.y} width={imgRect.w} height={imgRect.h} preserveAspectRatio="none" filter="url(#g-soft)" opacity="0.8" style={{ mixBlendMode: 'screen' }} />
              <g transform={worldT}>
                <image href={nightImg} x={imgRect.x} y={imgRect.y} width={imgRect.w} height={imgRect.h} preserveAspectRatio="none" />
                {geo && <path d={geo.road} fill="none" stroke="#ffb54a" strokeOpacity="0.45" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />}
              </g>
            </g>
          )}

          {/* 도로와 차량 */}
          {roads.map((rd) => (
            <g key={rd.id}>
              <path d={rd.d} fill="none" stroke="#c9c2a8" strokeWidth="7" strokeLinecap="round" opacity="0.6" />
              <path id={rd.id} d={rd.d} fill="none" stroke="#5b5f66" strokeWidth="4" strokeLinecap="round" />
              <path d={rd.d} fill="none" stroke="#fde68a" strokeWidth="0.6" strokeDasharray="4 4" />
            </g>
          ))}
          {roads.flatMap((rd, ri) =>
            [0, 1, 2].map((j) => {
              const back = (ri + j) % 2 === 1;
              const bus = j === 2 && ri % 2 === 0;
              const dur = 9 + ((ri * 5 + j * 3) % 7);
              // 11-25 실사 차량 그림(있으면): 승용차 3종·버스
              const art = bus ? MOVE_ART.bus : MOVE_ART.cars[(ri * 3 + j) % Math.max(1, MOVE_ART.cars.length)];
              if (art)
                return (
                  <Mover key={`${rd.id}-car${j}`} path={rd.d} dur={dur} begin={-j * dur / 3} tilt={35} reverse={back}>
                    <image href={art} x={bus ? -7 : -5} y={bus ? -7 : -5} width={bus ? 14 : 10} height={bus ? 14 : 10} />
                    {nightOn && <circle cx={bus ? 6 : 4.5} cy="1" r="1.4" fill="#fef9c3" opacity={night} />}
                  </Mover>
                );
              const color = CAR_COLORS[(ri * 3 + j) % CAR_COLORS.length];
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
            if (terrain.far.includes(c.id)) {
              // 먼 도시: 화면 가장자리 표지판(누르면 도시 정보)
              const [qx, qy] = CAP;
              const ang = (Math.atan2(y - qy, x - qx) * 180) / Math.PI;
              return (
                <g key={c.id} className="city" onClick={() => tapCity(c.id, x, y)}>
                  <g transform={`translate(${x},${y}) rotate(${ang})`}>
                    <path d="M4,-6 L14,0 L4,6Z" fill="#f8fafc" stroke="#3b4855" strokeWidth="1" />
                  </g>
                  <circle cx={x} cy={y} r="5" fill={st === '점령당함' ? '#ef4444' : mine} stroke="#f8fafc" strokeWidth="1.4" />
                  <text x={x} y={y + 16} textAnchor="middle" className="homeland-city small">
                    {c.name}
                    {st === '공격받음' ? ' 🔥' : st === '점령당함' ? ' (빼앗김)' : ''}
                  </text>
                  <circle cx={x} cy={y} r="16" fill="transparent" />
                </g>
              );
            }
            return (
              <g key={c.id} className="city" onClick={() => tapCity(c.id, x, y)}>
                <g transform={`translate(${x},${y}) scale(${citySc(i)}) translate(${-x},${-y})`}>
                <ellipse cx={x} cy={y + 4} rx={c.capital ? 100 : 22} ry={c.capital ? 60 : 10} fill="url(#g-urban)" mask="url(#g-urban-mask)" opacity="0.9" />
                {c.capital && art.factory && <image href={art.factory} x={x - 118} y={y - 6} width="44" height="44" />}
                {c.capital && art.base && <image href={art.base} x={x - 96} y={y + 34} width="48" height="48" />}
                {c.capital && art.port && <image href={art.port} x={x + 72} y={y + 10} width="48" height="48" />}
                {[...blocks[i]]
                  .map((b, j) => ({ b, j }))
                  .sort((p, q) => p.b.y + p.b.h - (q.b.y + q.b.h))
                  .map(({ b, j }) => {
                    const img = blockArt(b.d, j);
                    if (img) {
                      // 그림은 정사각형: 건물 높이에 맞춰 조금 크게, 바닥 가운데를 맞춤
                      const sz = Math.max(b.w * 1.9, b.h * 1.25);
                      return (
                        <g key={j}>
                          <image href={img} x={b.x + b.w / 2 - sz / 2} y={b.y + b.h - sz} width={sz} height={sz} />
                          {nightOn && <circle cx={b.x + b.w / 2} cy={b.y + b.h * 0.4} r={b.w * 0.6} fill="#fde047" opacity={night * 0.22} />}
                        </g>
                      );
                    }
                    return (
                  <g key={j}>
                    <rect x={b.x} y={b.y} width={b.w} height={b.h} fill={j % 3 === 0 ? '#cbd5e1' : j % 3 === 1 ? '#94a3b8' : '#e2e8f0'} stroke="#334155" strokeWidth="0.4" />
                    <rect x={b.x} y={b.y} width={b.w} height="1.6" fill="#64748b" />
                    {nightOn && (
                      <rect x={b.x + 1} y={b.y + 2.5} width={Math.max(1, b.w - 2)} height={Math.max(1, b.h - 4)} fill="#fde047" opacity={night * (0.35 + ((j * 37) % 10) / 20)} className="win" style={{ animationDelay: `${-j}s` }} />
                    )}
                  </g>
                    );
                  })}
                {(() => {
                  // 도시별 랜드마크 그림(있으면), 수도는 없으면 공용 랜드마크
                  const lm = (CITY_LANDMARK[c.name] && fieldArt(CITY_LANDMARK[c.name])) || (c.capital ? art.landmark : null);
                  if (!lm) return null;
                  const sz = c.capital ? 64 : 84;
                  return <image href={lm} x={x - sz / 2} y={y - sz - (c.capital ? 2 : 8)} width={sz} height={sz} />;
                })()}
                {nightOn && st !== '공격받음' && st !== '점령당함' && (
                  <circle cx={x} cy={y - 4} r={(c.capital ? 110 : 24) * (0.7 + 0.8 * (cityGrowth?.[c.id] ?? 0.4))} fill="url(#glow)" opacity={night * (0.45 + 0.5 * (cityGrowth?.[c.id] ?? 0.4))} />
                )}
                {/* 전쟁: 공격받거나 빼앗긴 도시는 불이 꺼짐(등화관제) */}
                {nightOn && (st === '공격받음' || st === '점령당함') && <circle cx={x} cy={y} r={c.capital ? 120 : 40} fill="#020617" opacity={night * 0.55} />}
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
                </g>
                {cityTags?.[c.id] && (
                  <text x={x} y={y - (c.capital ? 44 : 22)} textAnchor="middle" className="homeland-city small homeland-tag">
                    {cityTags[c.id]}
                  </text>
                )}
                <text x={x} y={y + (c.capital ? 20 : 12)} textAnchor="middle" className={c.capital ? 'homeland-city' : 'homeland-city small'}>
                  {c.capital ? '★ ' : ''}
                  {c.name}
                  {st === '공격받음' ? ' 🔥' : st === '점령당함' ? ' (빼앗김)' : ''}
                </text>
                <circle cx={x} cy={y - 4} r={c.capital ? 22 : 14} fill="transparent" />
              </g>
            );
          })}

          {/* 표기만 하는 지명(여수 등): 도시 기능 없음 */}
          {terrain.marks.map((m) => (
            <g key={m.name} pointerEvents="none">
              <circle cx={m.x} cy={m.y} r="2.2" fill="#f8fafc" stroke="#3b4855" strokeWidth="1" />
              <text x={m.x} y={m.y + 11} textAnchor="middle" className="homeland-mark">
                {m.name}
              </text>
            </g>
          ))}
          {/* 바다: 배 · 여객선 */}
          {terrain.seaLoop &&
            [0, 1, 2].map((j) => {
              const art = j === 1 ? MOVE_ART.ferry : MOVE_ART.fishing;
              if (art)
                return (
                  <Mover key={`boat${j}`} path={terrain.seaLoop!} dur={50 + j * 15} begin={-j * 20} tilt={15} reverse={j === 2}>
                    <image href={art} x={-7} y={-7} width={14} height={14} />
                  </Mover>
                );
              return (
                <g key={`boat${j}`}>
                  <path d="M-5,0 L5,0 L3.5,2.4 L-3.5,2.4Z" fill={j === 1 ? '#f8fafc' : '#b45309'} />
                  <rect x="-2" y="-3" width={j === 1 ? 5 : 3} height="3" fill={j === 1 ? '#ef4444' : '#f8fafc'} />
                  <path d="M-5,1 l-8,-2 M-5,1.6 l-8,2" stroke="#e0f2fe" strokeWidth="0.6" opacity="0.7" />
                  <animateMotion dur={`${50 + j * 15}s`} begin={`${-j * 20}s`} repeatCount="indefinite" rotate="auto" keyPoints={j === 2 ? '1;0' : '0;1'} keyTimes="0;1" calcMode="linear">
                    <mpath href={`#coast-${countryId}`} />
                  </animateMotion>
                </g>
              );
            })}

          {/* 우리 함대: 항모 전단이 앞바다를 천천히 순찰(11-25 실사 부대 그림) */}
          {terrain.seaLoop &&
            [0, 1, 2].map((j) =>
              MOVE_ART.carrier && MOVE_ART.escort ? (
                <Mover key={`cv${j}`} path={terrain.seaLoop!} dur={150} begin={-40 - j * 5} tilt={12} reverse>
                  <image href={j === 0 ? MOVE_ART.carrier : MOVE_ART.escort} x={j === 0 ? -14 : -9} y={j === 0 ? -14 : -9} width={j === 0 ? 28 : 18} height={j === 0 ? 28 : 18} />
                </Mover>
              ) : (
                <g key={`cv${j}`}>
                  {j === 0 ? <Carrier s={2.1} color={mine} /> : <Escort s={1.6} color={mine} />}
                  <animateMotion dur="150s" begin={`${-40 - j * 5}s`} repeatCount="indefinite" rotate="auto" keyPoints="1;0" keyTimes="0;1" calcMode="linear">
                    <mpath href={`#coast-${countryId}`} />
                  </animateMotion>
                </g>
              ),
            )}

          {/* 전쟁 때만: 군 차량 행렬(11-25 실사 장갑차·전차 그림) */}
          {hot &&
            roads.slice(0, 2).map((rd) =>
              [0, 1, 2].map((j) =>
                MOVE_ART.ifv ? (
                  <Mover key={`${rd.id}-mil${j}`} path={rd.d} dur={16} begin={-j * 1.6} tilt={30}>
                    <image href={(j === 1 && MOVE_ART.tank) || MOVE_ART.ifv} x={-6} y={-6} width={12} height={12} />
                  </Mover>
                ) : (
                  <g key={`${rd.id}-mil${j}`}>
                    <rect x="-4" y="-2" width="8" height="4" rx="0.6" fill="#4d5b2c" stroke="#1a2010" strokeWidth="0.4" />
                    <rect x="1" y="-1.4" width="2.4" height="2.8" fill="#3a4520" />
                    <animateMotion dur="16s" begin={`${-j * 1.6}s`} repeatCount="indefinite" rotate="auto" keyPoints="0;1" keyTimes="0;1" calcMode="linear">
                      <mpath href={`#${rd.id}`} />
                    </animateMotion>
                  </g>
                ),
              ),
            )}
        </g>

        {/* 하늘 층(확대와 상관없이 위를 지나감) */}
        <g className="sky" pointerEvents="none">
          {/* 평시 초계 비행: 전투기 두 대가 남쪽 바다를 지나감 */}
          {!hot &&
            [0, 1].map((j) => (
              <g key={`pj${j}`}>
                <g transform={`translate(${-j * 10},${j * 8})`}>
                  <PlaneArt kind="fighter" size={22} trail />
                </g>
                <animateMotion dur="22s" begin="-6s" repeatCount="indefinite" rotate="auto">
                  <mpath href={`#cap-${countryId}`} />
                </animateMotion>
              </g>
            ))}
          {[0, 1, 2].map((j) => (
            <g key={`cl${j}`} className="cloud" style={{ animationDuration: `${70 + j * 25}s`, animationDelay: `${-j * 30}s` }}>
              <ellipse cx={40} cy={120 + j * 170} rx="46" ry="16" fill="#00000022" transform="translate(14,26)" />
              <ellipse cx={40} cy={120 + j * 170} rx="46" ry="16" fill="url(#cloud)" opacity={0.75 - night * 0.45} />
              <ellipse cx={66} cy={112 + j * 170} rx="30" ry="13" fill="url(#cloud)" opacity={0.75 - night * 0.45} />
            </g>
          ))}
          <g>
            <PlaneArt kind="airliner" size={26} />
            {nightOn && <circle cx="-8" cy="0" r="1.2" fill="#ef4444" className="blink" />}
            <animateMotion dur="26s" repeatCount="indefinite" rotate="auto">
              <mpath href={`#air-${countryId}`} />
            </animateMotion>
          </g>
          {hot &&
            [0, 1].map((j) => (
              <g key={`jet${j}`}>
                <PlaneArt kind="fighter" size={20} flipY trail />
                <animateMotion dur="7s" begin={`${-j * 0.6}s`} repeatCount="indefinite" rotate="auto">
                  <mpath href={`#jet-${countryId}`} />
                </animateMotion>
              </g>
            ))}
          {/* 낮·밤 */}
          {night > 0 && night < 1 && <rect x="0" y="0" width={W} height={H} fill="#fb923c" opacity={(1 - Math.abs(night - 0.5) * 2) * 0.12} />}
          <rect x="0" y="0" width={W} height={H} fill="url(#g-sun)" pointerEvents="none" />
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
