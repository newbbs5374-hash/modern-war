import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as RPointerEvent,
  type WheelEvent as RWheelEvent,
} from "react";
import { CITIES } from "../data/cities";
import { BLOCS, COUNTRIES, HOLY_CITY, type Relation } from "../data/world";
import {
  EDGE_DIR,
  HEX_DIRS,
  HEX_SIZE,
  HOLY_HEX,
  MAP_BOUNDS,
  WORLD_ART,
  PIONEER_ISLANDS,
  TILES,
  TILE_AT,
  disk,
  hexCorners,
  hexKey,
  pixelToHex,
  seaNear,
} from "../data/hexmap";
import { isAlive, relationOf, type WorldState } from "../game/world";
import { Carrier, Escort, Jet } from "./units";
import { smoothPath, type Seg } from "./smoothHex";

export type MapMode = "나라" | "관계" | "묶음";
/** 나라마다 한눈에 구분되는 색(국경선 대신 색으로 영토를 보여 줌). 이웃끼리 겹치지 않게 고름 */
export const COUNTRY_COLORS: Record<string, string> = {
  us: "#3b82f6",
  cn: "#ef4444",
  ru: "#8b5cf6",
  de: "#f59e0b",
  jp: "#ec4899",
  uk: "#14b8a6",
  in: "#f97316",
  kr: "#facc15",
  tr: "#22c55e",
  il: "#38bdf8",
  ir: "#a16207",
  ua: "#84cc16",
  kp: "#64748b",
};

export const REL_COLORS: Record<Relation | "나", string> = {
  나: "#fde047",
  연합: "#3b82f6",
  전쟁: "#ef4444",
  휴전: "#f59e0b",
  중립: "#9ca3af",
};

interface Props {
  world: WorldState;
  playerCountryId: string;
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** 관계 = 우리나라와의 관계 색, 묶음 = 처음 연합 묶음 색 */
  mode?: MapMode;
  /** 본부 화면의 작은 지도 */
  mini?: boolean;
}

/** 실사 세계지도 그림: src/assets/world/world-map.(png|webp) 를 넣으면 바다·땅 바탕으로 깔림(명령문 /mnt/project-files/guides/world-art-prompts.md) */
const ART_FILES = import.meta.glob(
  "../assets/world/world-map.{png,jpg,jpeg,webp}",
  { eager: true, query: "?url", import: "default" },
) as Record<string, string>;
const ART: string | undefined = Object.values(ART_FILES)[0];

const B = MAP_BOUNDS;
const X0 = B.x;
const Y0 = B.y;
const MW = B.w;
const MH = B.h;

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++)
    h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

const polyPath = (x: number, y: number) =>
  "M" +
  hexCorners(x, y)
    .map(([a, b]) => `${a.toFixed(1)},${b.toFixed(1)}`)
    .join("L") +
  "Z";
/** 장소(도시·섬)마다 육각형을 모은 경로 하나(그림 수를 줄여 휴대폰에서도 가볍게) */
const PLACE_PATH: Record<string, string> = {};
for (const t of TILES)
  PLACE_PATH[t.place] = (PLACE_PATH[t.place] ?? "") + polyPath(t.x, t.y);
const CITY_PLACES = CITIES.map((c) => c.id);
/** 해안선: 땅 칸의 변 중 바다와 닿은 변(육각 그대로) */
const COAST_SEGS: Seg[] = [];
/** 장소마다 바다와 닿은 변(곡선 해안까지 색을 채우는 굵은 선) */
const PLACE_COAST: Record<string, string> = {};
for (const t of TILES) {
  const cs = hexCorners(t.x, t.y);
  cs.forEach((p, i) => {
    const dir = HEX_DIRS[EDGE_DIR[i]];
    if (!TILE_AT.has(hexKey(t.q + dir.q, t.r + dir.r))) {
      const q2 = cs[(i + 1) % 6];
      COAST_SEGS.push([p, q2]);
      PLACE_COAST[t.place] =
        (PLACE_COAST[t.place] ?? "") +
        `M${p[0].toFixed(1)},${p[1].toFixed(1)}L${q2[0].toFixed(1)},${q2[1].toFixed(1)}`;
    }
  });
}
/** 화면에 그리는 해안선: 육각 계단 대신 둥근 곡선 */
const COAST = smoothPath(COAST_SEGS, { relax: 14, wiggle: HEX_SIZE * 0.9 });
const LAND_BASE = "#06140d";
/** 땅 색을 바탕색과 미리 섞어 불투명하게(겹쳐도 진해지지 않게) */
function mixColor(hex: string, a: number): string {
  const n = (h: string, i: number) =>
    parseInt(h.slice(1 + i * 2, 3 + i * 2), 16);
  const c = (i: number) =>
    Math.round(n(hex, i) * a + n(LAND_BASE, i) * (1 - a));
  return `rgb(${c(0)},${c(1)},${c(2)})`;
}
/** 나라 이름 자리(그 나라 땅 한가운데) */
const COUNTRY_LABEL = Object.fromEntries(
  COUNTRIES.map((c) => {
    const ts = TILES.filter((t) => t.home === c.id);
    return [
      c.id,
      {
        x: ts.reduce((a, t) => a + t.x, 0) / ts.length,
        y: ts.reduce((a, t) => a + t.y, 0) / ts.length,
      },
    ];
  }),
);

const onLand = (x: number, y: number) => {
  const h = pixelToHex(x, y);
  return disk(h, 1).some((n) => TILE_AT.has(hexKey(n.q, n.r)));
};
const SEA = Object.fromEntries(
  COUNTRIES.map((c) => [c.id, { ...seaNear(c.id), vertical: false }]),
);

/** 함대: 평시엔 앞바다 순찰, 전쟁이면 적 쪽으로 전진하고 전투기가 출격 */
function Fleets({
  world,
  colorOf,
}: {
  world: WorldState;
  colorOf: (id: string) => string;
}) {
  return (
    <g className="fleets" pointerEvents="none">
      {COUNTRIES.filter((c) => isAlive(world, c.id)).map((c) => {
        const p = SEA[c.id];
        const carrier = c.military >= 45;
        const enemy = COUNTRIES.find(
          (e) =>
            e.id !== c.id &&
            isAlive(world, e.id) &&
            relationOf(world, c.id, e.id) === "전쟁",
        );
        const color = colorOf(c.id);
        // 전쟁: 적 앞바다 쪽으로 30% 나아간 곳(땅이면 제자리)
        let fx = p.x;
        let fy = p.y;
        if (enemy) {
          const q = SEA[enemy.id];
          const nx = p.x + (q.x - p.x) * 0.3;
          const ny = p.y + (q.y - p.y) * 0.3;
          if (!onLand(nx, ny)) {
            fx = nx;
            fy = ny;
          }
        }
        const rx = p.vertical ? 7 : 17;
        const ry = p.vertical ? 17 : 7;
        const loop = `M${fx - rx},${fy} a${rx},${ry} 0 1,0 ${rx * 2},0 a${rx},${ry} 0 1,0 ${-rx * 2},0`;
        const dur = 34 + (hash(c.id) % 14);
        // 전투기: 평시 = 큰 원 순찰, 전쟁 = 적 수도까지 갔다가 돌아옴
        let jetPath: string;
        let target: { x: number; y: number } | null = null;
        if (enemy) {
          target =
            CITIES.find(
              (x) =>
                x.home === enemy.id &&
                x.capital &&
                world.owner[x.id] === enemy.id,
            ) ??
            CITIES.find((x) => world.owner[x.id] === enemy.id) ??
            null;
        }
        if (target) {
          const dx = target.x - fx;
          const dy = target.y - fy;
          const c1 = `${(fx + dx / 2 - dy * 0.25).toFixed(1)},${(fy + dy / 2 + dx * 0.25).toFixed(1)}`;
          const c2 = `${(fx + dx / 2 + dy * 0.25).toFixed(1)},${(fy + dy / 2 - dx * 0.25).toFixed(1)}`;
          jetPath = `M${fx},${fy} Q${c1} ${target.x},${target.y} Q${c2} ${fx},${fy}`;
        } else {
          const R = 26;
          jetPath = `M${fx - R},${fy} a${R},${R * 0.7} 0 1,1 ${R * 2},0 a${R},${R * 0.7} 0 1,1 ${-R * 2},0`;
        }
        const jdur = target ? 9 : 12;
        const jets = c.military >= 25 ? 2 : 1;
        return (
          <g key={c.id}>
            <path id={`fl-${c.id}`} d={loop} fill="none" />
            <path id={`fj-${c.id}`} d={jetPath} fill="none" />
            {target && (
              <path
                d={jetPath}
                fill="none"
                stroke="#ef4444"
                strokeOpacity="0.25"
                strokeWidth="0.8"
                strokeDasharray="3 3"
              />
            )}
            {[0, 1, 2].map((j) => (
              <g key={j}>
                {j === 0 ? (
                  carrier ? (
                    <Carrier s={1.15} color={color} />
                  ) : (
                    <Escort s={1.3} color={color} />
                  )
                ) : (
                  <Escort s={0.85} color={color} />
                )}
                <animateMotion
                  dur={`${dur}s`}
                  begin={`${-j * 2.2 - (hash(c.id) % 9)}s`}
                  repeatCount="indefinite"
                  rotate="auto"
                >
                  <mpath href={`#fl-${c.id}`} />
                </animateMotion>
              </g>
            ))}
            {Array.from({ length: jets }, (_, j) => (
              <g key={`j${j}`}>
                <Jet s={1} color={color} />
                <animateMotion
                  dur={`${jdur}s`}
                  begin={`${-j * 0.35 - (hash(c.id) % 7)}s`}
                  repeatCount="indefinite"
                  rotate="auto"
                >
                  <mpath href={`#fj-${c.id}`} />
                </animateMotion>
              </g>
            ))}
            {target && (
              <circle cx={target.x} cy={target.y} r="5" fill="#f97316">
                <animate
                  attributeName="opacity"
                  values="0;0;0.9;0;0"
                  keyTimes="0;0.42;0.5;0.62;1"
                  dur={`${jdur}s`}
                  begin={`${-(hash(c.id) % 7)}s`}
                  repeatCount="indefinite"
                />
                <animate
                  attributeName="r"
                  values="2;2;8;11;2"
                  keyTimes="0;0.42;0.5;0.62;1"
                  dur={`${jdur}s`}
                  begin={`${-(hash(c.id) % 7)}s`}
                  repeatCount="indefinite"
                />
              </circle>
            )}
          </g>
        );
      })}
    </g>
  );
}

const MAX_K = 4;
type View = { k: number; x: number; y: number };

/** 전략 지도(임시 도형). 섬 = 들쭉날쭉한 땅, 나라 = 색 네모, 도시 = 점(지금 주인 색), 함대·전투기가 움직임 */
export function WorldMap({
  world,
  playerCountryId,
  selectedId,
  onSelect,
  mode = "나라",
  mini,
}: Props) {
  const colorOf = (id: string) =>
    mode === "나라"
      ? (COUNTRY_COLORS[id] ?? "#94a3b8")
      : mode === "묶음"
      ? BLOCS[COUNTRIES.find((c) => c.id === id)!.bloc].color
      : id === playerCountryId
        ? REL_COLORS["나"]
        : REL_COLORS[relationOf(world, playerCountryId, id)];

  // ── 확대·이동(작은 지도는 없음) ──
  const svgRef = useRef<SVGSVGElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  // 화면 비율(가로/세로). 세로 화면이면 지도 높이에 맞추고 좌우로 끌어 봄
  const [ar, setAr] = useState(MW / MH);
  const kMin = Math.min(1, (MH * ar) / MW);
  const capX =
    (CITIES.find((c) => c.home === playerCountryId && c.capital)?.x ??
      X0 + MW / 2) - X0;
  const [view, setView] = useState<View>({
    k: 1,
    x: capX - (MH * (MW / MH)) / 2,
    y: 0,
  });
  const centered = useRef(false);
  useEffect(() => {
    const el = wrapRef.current;
    if (!el || mini) return;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) {
        const a = r.width / r.height;
        setAr(a);
        // 처음 한 번: 내 나라가 가운데 오게
        if (!centered.current) {
          centered.current = true;
          setView((v) => ({ ...v, x: capX - (MH * a) / v.k / 2 }));
        }
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [mini]);
  const vw = (k: number) => (MH * ar) / k;
  const vh = (k: number) => MH / k;
  const pts = useRef(new Map<number, { x: number; y: number }>());
  const moved = useRef(0);
  const clamp = (v: View): View => {
    const k = Math.max(kMin, Math.min(MAX_K, v.k));
    const w = vw(k);
    const h = vh(k);
    const fit = (o: number, size: number, full: number) =>
      size >= full ? (full - size) / 2 : Math.max(0, Math.min(full - size, o));
    return { k, x: fit(v.x, w, MW), y: fit(v.y, h, MH) };
  };
  const toSvg = (cx: number, cy: number) => {
    const m = svgRef.current?.getScreenCTM();
    if (!m) return { x: cx, y: cy };
    const p = new DOMPoint(cx, cy).matrixTransform(m.inverse());
    return { x: p.x - X0, y: p.y - Y0 };
  };
  const zoomAt = (px: number, py: number, f: number, v: View) => {
    const k = Math.max(kMin, Math.min(MAX_K, v.k * f));
    const s = v.k / k;
    return clamp({ k, x: px - (px - v.x) * s, y: py - (py - v.y) * s });
  };
  const onDown = (e: RPointerEvent) => {
    if (mini) return;
    pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.current.size === 1) moved.current = 0;
  };
  const onMove = (e: RPointerEvent) => {
    const prev = pts.current.get(e.pointerId);
    if (!prev || mini) return;
    const cur = { x: e.clientX, y: e.clientY };
    const a = toSvg(prev.x, prev.y);
    const b = toSvg(cur.x, cur.y);
    if (pts.current.size === 1) {
      moved.current += Math.abs(cur.x - prev.x) + Math.abs(cur.y - prev.y);
      if (
        moved.current > 8 &&
        !(e.currentTarget as Element).hasPointerCapture?.(e.pointerId)
      )
        (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
      setView((v) => {
        const c = clamp(v);
        return clamp({ ...c, x: c.x - (b.x - a.x), y: c.y - (b.y - a.y) });
      });
    } else if (pts.current.size === 2) {
      const [p1, p2] = [...pts.current.entries()];
      const other = p1[0] === e.pointerId ? p2[1] : p1[1];
      const d0 = Math.hypot(prev.x - other.x, prev.y - other.y);
      const d1 = Math.hypot(cur.x - other.x, cur.y - other.y);
      moved.current += 99;
      const o = toSvg(other.x, other.y);
      if (d0 > 4)
        setView((v) =>
          zoomAt((b.x + o.x) / 2, (b.y + o.y) / 2, d1 / d0, clamp(v)),
        );
    }
    pts.current.set(e.pointerId, cur);
  };
  const onUp = (e: RPointerEvent) => {
    pts.current.delete(e.pointerId);
  };
  const onWheel = (e: RWheelEvent) => {
    if (mini) return;
    const p = toSvg(e.clientX, e.clientY);
    setView((v) => zoomAt(p.x, p.y, e.deltaY < 0 ? 1.2 : 1 / 1.2, clamp(v)));
  };
  const pick = (id: string) => {
    if (moved.current > 8) return;
    onSelect(id);
  };

  const cv = clamp(view);
  const vb = mini
    ? `${X0} ${Y0} ${MW} ${MH}`
    : `${(X0 + cv.x).toFixed(1)} ${(Y0 + cv.y).toFixed(1)} ${vw(cv.k).toFixed(1)} ${vh(cv.k).toFixed(1)}`;
  const owner = world.owner;
  // 나라(지금 주인)마다 땅 모양을 곡선 하나로: 나라 사이 경계도 해안처럼 둥글게(육각 계단 없음)
  const ownerShapes = useMemo(() => {
    const segs: Record<string, Seg[]> = {};
    for (const t of TILES) {
      if (t.kind !== "city") continue;
      const o = owner[t.place];
      const cs = hexCorners(t.x, t.y);
      for (let i = 0; i < 6; i++) {
        const dir = HEX_DIRS[EDGE_DIR[i]];
        const n = TILE_AT.get(hexKey(t.q + dir.q, t.r + dir.r));
        if (!n || n.kind !== "city" || owner[n.place] !== o) (segs[o] ??= []).push([cs[i], cs[(i + 1) % 6]]);
      }
    }
    return Object.entries(segs).map(([o, sg]) => ({ o, d: smoothPath(sg, { relax: 10 }) }));
  }, [owner]);

  const svg = (
    <svg
      ref={svgRef}
      className={mini ? "map mini" : "map"}
      viewBox={vb}
      role="img"
      aria-label="세계 지도"
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      onWheel={onWheel}
    >
      <defs>
        <radialGradient id="wm-sea" cx="50%" cy="50%" r="75%">
          <stop offset="0%" stopColor="#0b2a1c" />
          <stop offset="100%" stopColor="#030a06" />
        </radialGradient>
        {/* 땅 모양(곡선 해안) 안쪽만 칠하기 */}
        <clipPath id="wm-land">
          <path d={COAST} clipRule="evenodd" />
        </clipPath>
        <pattern
          id="wm-wave"
          width="26"
          height="14"
          patternUnits="userSpaceOnUse"
        >
          <path
            d="M2,8 q4,-4 8,0 t8,0"
            fill="none"
            stroke="#45f59a"
            strokeOpacity="0.12"
            strokeWidth="0.8"
          />
        </pattern>
      </defs>
      <rect x={X0} y={Y0} width={MW} height={MH} fill="url(#wm-sea)" />
      {ART ? (
        <>
          {/* 실사 지도 그림 위에 바다만 살짝 어둡게(작전 콘솔 느낌 유지) */}
          <image
            href={ART}
            x={WORLD_ART.x}
            y={WORLD_ART.y}
            width={WORLD_ART.w}
            height={WORLD_ART.h}
            preserveAspectRatio="none"
          />
          <path
            d={`M${WORLD_ART.x},${WORLD_ART.y}h${WORLD_ART.w}v${WORLD_ART.h}h${-WORLD_ART.w}Z${COAST}`}
            fill="#020a06"
            fillOpacity="0.35"
            fillRule="evenodd"
            pointerEvents="none"
          />
        </>
      ) : (
        <>
          {!mini && (
            <rect
              x={X0}
              y={Y0}
              width={MW}
              height={MH}
              fill="url(#wm-wave)"
              className="wm-waves"
            />
          )}
          {/* 얕은 바다 → 곡선 해안 → 땅 */}
          <path
            d={COAST}
            fill="none"
            stroke="#1d6b44"
            strokeOpacity="0.6"
            strokeWidth="7"
            strokeLinejoin="round"
          />
          <path d={COAST} fill={LAND_BASE} fillRule="evenodd" />
        </>
      )}
      <g clipPath="url(#wm-land)">
        {/* 그림이 있으면 나라 색은 반투명하게 덮어 땅 그림이 비침 */}
        <g opacity={ART ? (mode === "나라" ? 0.5 : 0.4) : 1}>
          {ownerShapes.map(({ o, d }) => {
            const sel = o === selectedId;
            const alive = isAlive(world, o);
            const c = mixColor(
              colorOf(o),
              mode === "나라"
                ? sel
                  ? 0.95
                  : alive
                    ? 0.8
                    : 0.4
                : sel
                  ? 0.75
                  : o === playerCountryId
                    ? 0.62
                    : alive
                      ? 0.48
                      : 0.25,
            );
            const coast = CITY_PLACES.filter((id) => owner[id] === o)
              .map((id) => PLACE_COAST[id] ?? "")
              .join("");
            return (
              <g key={o} className="map-country" onClick={() => pick(o)}>
                <path d={d} fill={c} fillRule="evenodd" stroke={c} strokeWidth={2} strokeLinejoin="round" />
                {coast && <path d={coast} fill="none" stroke={c} strokeWidth={HEX_SIZE * 2.4} strokeLinecap="round" />}
              </g>
            );
          })}
          {PIONEER_ISLANDS.map((p) => {
            const c = mixColor("#cdb77a", 0.7);
            return (
              <g key={p.id}>
                <title>
                  {p.name} · 주인 없는 분쟁 섬 · {p.res}
                </title>
                <path d={PLACE_PATH[p.id]} fill={c} />
                {PLACE_COAST[p.id] && (
                  <path
                    d={PLACE_COAST[p.id]}
                    fill="none"
                    stroke={c}
                    strokeWidth={HEX_SIZE * 2.4}
                    strokeLinecap="round"
                  />
                )}
              </g>
            );
          })}
          <g>
            <title>{HOLY_CITY.name}</title>
            <path d={PLACE_PATH.holy} fill={mixColor("#fbbf24", 0.85)} />
            {PLACE_COAST.holy && (
              <path
                d={PLACE_COAST.holy}
                fill="none"
                stroke={mixColor("#fbbf24", 0.85)}
                strokeWidth={HEX_SIZE * 2.4}
                strokeLinecap="round"
              />
            )}
          </g>
        </g>
      </g>
      <path
        d={COAST}
        fill="none"
        stroke="#45f59a"
        strokeOpacity="0.8"
        strokeWidth="1.2"
        strokeLinejoin="round"
        pointerEvents="none"
      />
      {!mini &&
        PIONEER_ISLANDS.map((p) => (
          <text
            key={p.id}
            x={p.x}
            y={p.y + HEX_SIZE * 5.6}
            textAnchor="middle"
            className="map-island"
          >
            {p.name}
          </text>
        ))}
      {COUNTRIES.map((c) => (
        <text
          key={c.id}
          x={COUNTRY_LABEL[c.id].x}
          y={COUNTRY_LABEL[c.id].y}
          textAnchor="middle"
          className="map-label"
          fontSize={mini ? 22 : 11}
          opacity={isAlive(world, c.id) ? 1 : 0.4}
        >
          {c.id === playerCountryId ? "★ " : ""}
          {c.name}
        </text>
      ))}
      {CITIES.map((city) => {
        const o = owner[city.id];
        const occupied = o !== city.home;
        return (
          <g key={city.id} className="map-city" onClick={() => pick(city.home)}>
            <circle
              cx={city.x}
              cy={city.y}
              r={city.capital ? 3.8 : 2.8}
              fill={colorOf(o)}
              stroke={occupied ? "#fff" : "#0c1a2b"}
              strokeWidth={occupied ? 1.6 : 1}
            />
            {!mini && (
              <text
                x={city.x}
                y={city.y - 5}
                textAnchor="middle"
                className="map-cityname"
              >
                {city.capital ? "★" : ""}
                {city.name}
              </text>
            )}
            <title>
              {city.name}
              {city.capital ? "(수도)" : ""} ·{" "}
              {COUNTRIES.find((c) => c.id === o)!.name}
              {occupied ? " 점령 중" : ""}
            </title>
          </g>
        );
      })}
      {!mini && (
        <text
          x={HOLY_HEX.x}
          y={HOLY_HEX.y + HEX_SIZE * 3.6}
          textAnchor="middle"
          className="map-island holy"
        >
          {HOLY_CITY.name}
        </text>
      )}
      {!mini && <Fleets world={world} colorOf={colorOf} />}
    </svg>
  );

  if (mini) return svg;
  return (
    <div className="wm-wrap" ref={wrapRef}>
      {svg}
      <div className="map-zoom wm-zoom">
        <button
          aria-label="확대"
          onClick={() =>
            setView((v) =>
              zoomAt(
                clamp(v).x + vw(v.k) / 2,
                clamp(v).y + vh(v.k) / 2,
                1.5,
                clamp(v),
              ),
            )
          }
        >
          ＋
        </button>
        <button
          aria-label="축소"
          onClick={() =>
            setView((v) =>
              zoomAt(
                clamp(v).x + vw(v.k) / 2,
                clamp(v).y + vh(v.k) / 2,
                1 / 1.5,
                clamp(v),
              ),
            )
          }
        >
          －
        </button>
        <button
          aria-label="전체 보기"
          onClick={() => setView({ k: kMin, x: 0, y: 0 })}
        >
          ⤢
        </button>
      </div>
    </div>
  );
}
