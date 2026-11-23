import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as RPointerEvent,
  type WheelEvent as RWheelEvent,
} from "react";
import { CITIES } from "../data/cities";
import { BLOCS, COUNTRIES, HOLY_CITY, type Relation } from "../data/world";
import { PIONEER_ISLANDS, HOLY_HEX } from "../data/hexmap";
import { KR_INNER, KR_OUTLINE, KR_PROVINCES } from "../data/krProvinces";
import { HOME_MARKS } from "./homeTerrain";
import {
  GEO,
  GEO_PATH,
  isLand,
  seaNearXY,
  voronoiCells,
  project,
} from "../data/realmap";
import { isAlive, relationOf, type WorldState } from "../game/world";
import { Carrier, Escort, Jet } from "./units";

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
  kp: "#06b6d4",
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

const X0 = 0;
const Y0 = 0;
const MW = GEO.W;
const MH = GEO.H;

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++)
    h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

const LAND_BASE = "#1b2a24";
/** 땅 색을 바탕색과 미리 섞어 불투명하게(겹쳐도 진해지지 않게) */
function mixColor(hex: string, a: number): string {
  const n = (h: string, i: number) =>
    parseInt(h.slice(1 + i * 2, 3 + i * 2), 16);
  const c = (i: number) =>
    Math.round(n(hex, i) * a + n(LAND_BASE, i) * (1 - a));
  return `rgb(${c(0)},${c(1)},${c(2)})`;
}
/** 나라마다 도시 영역(실제 나라 모양 안에서 가장 가까운 도시 몫): 도시를 빼앗기면 그 영역 색이 바뀜 */
const CELL_PATH: Record<string, string> = {};
for (const c of COUNTRIES) {
  const cells = voronoiCells(CITIES.filter((x) => x.home === c.id));
  for (const [id, poly] of Object.entries(cells))
    CELL_PATH[id] =
      "M" +
      poly.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join("L") +
      "Z";
}
/** 나라 이름 자리: 수도 가까이(멀리 떨어진 섬 도시는 빼고) 도시들의 가운데 */
const COUNTRY_LABEL = Object.fromEntries(
  COUNTRIES.map((c) => {
    const cap = CITIES.find((x) => x.home === c.id && x.capital)!;
    const cs = CITIES.filter(
      (x) =>
        x.home === c.id && Math.hypot(x.x - cap.x, x.y - cap.y) < GEO.PX * 30,
    );
    return [
      c.id,
      {
        x: cs.reduce((a, t) => a + t.x, 0) / cs.length,
        y: cs.reduce((a, t) => a + t.y, 0) / cs.length + 12,
      },
    ];
  }),
);
/** 분쟁 섬·성지 모양(작은 가상 섬) */
const islandPath = (x: number, y: number, r: number, seed: number) => {
  const pts = Array.from({ length: 9 }, (_, i) => {
    const a = (i / 9) * Math.PI * 2;
    const rr = r * (0.75 + (((seed * (i + 3) * 2654435761) >>> 0) % 100) / 200);
    return `${(x + Math.cos(a) * rr * 1.3).toFixed(1)},${(y + Math.sin(a) * rr).toFixed(1)}`;
  });
  return `M${pts.join("L")}Z`;
};

const onLand = (x: number, y: number) => isLand(x, y);
const SEA = Object.fromEntries(
  COUNTRIES.map((c) => {
    const cap = CITIES.find((x) => x.home === c.id && x.capital)!;
    return [c.id, { ...seaNearXY(cap.x, cap.y, 9), vertical: false }];
  }),
);

/** 함대: 평시엔 앞바다 순찰, 전쟁이면 적 쪽으로 전진하고 전투기가 출격 */
function Fleets({
  world,
  colorOf,
  zr = 1,
}: {
  world: WorldState;
  colorOf: (id: string) => string;
  /** 확대 배율에 맞춘 크기 비율(확대해도 배·전투기가 커지지 않게) */
  zr?: number;
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
        const rx = p.vertical ? 4 : 10;
        const ry = p.vertical ? 10 : 4;
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
          const R = 16;
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
                    <Carrier s={0.7 * zr} color={color} />
                  ) : (
                    <Escort s={0.8 * zr} color={color} />
                  )
                ) : (
                  <Escort s={0.55 * zr} color={color} />
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
                <Jet s={0.65 * zr} color={color} />
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

const MAX_K = 9;
/** 처음 열 때 확대: 내 나라 둘레가 보이게 */
const START_K = 2;
// 나라 모양: 대한민국은 시·도 자료(더 자세함)로, 나머지는 세계 자료로
const COAST: Record<string, string> = {
  ...GEO_PATH,
  kr: KR_OUTLINE,
};
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
  const capY =
    (CITIES.find((c) => c.home === playerCountryId && c.capital)?.y ??
      Y0 + MH / 2) - Y0;
  const [view, setView] = useState<View>({
    k: START_K,
    x: capX - (MH * (MW / MH)) / START_K / 2,
    y: capY - MH / START_K / 2,
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
          setView((v) => ({
            ...v,
            x: capX - (MH * a) / v.k / 2,
            y: capY - MH / v.k / 2,
          }));
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
  // 작은 지도(본부 레이더): 내 수도를 가운데 둔 정사각형
  const vb = mini
    ? `${(Math.max(0, Math.min(MW - MH, capX - MH / 2)) + X0).toFixed(1)} ${Y0} ${MH} ${MH}`
    : `${(X0 + cv.x).toFixed(1)} ${(Y0 + cv.y).toFixed(1)} ${vw(cv.k).toFixed(1)} ${vh(cv.k).toFixed(1)}`;
  const owner = world.owner;
  // 확대해도 글씨·점·선이 같이 커지지 않게(처음 배율 기준으로 화면 크기 유지)
  const z = mini ? 1 : Math.min(1, START_K / cv.k);
  const zr = mini ? 1 : Math.pow(z, 0.75);

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
      style={{ ["--z" as string]: z } as React.CSSProperties}
    >
      <defs>
        <radialGradient id="wm-sea" cx="50%" cy="50%" r="75%">
          <stop offset="0%" stopColor="#0b2a1c" />
          <stop offset="100%" stopColor="#030a06" />
        </radialGradient>
        {/* 13개 나라 모양 안쪽만 칠하기 */}
        {COUNTRIES.map((c) => (
          <clipPath key={c.id} id={`wm-c-${c.id}`}>
            <path d={COAST[c.id]} />
          </clipPath>
        ))}
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
        <image
          href={ART}
          x={X0}
          y={Y0}
          width={MW}
          height={MH}
          preserveAspectRatio="none"
        />
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
          {/* 땅 바탕(모든 나라) */}
          {Object.values(GEO_PATH).map((d, i) => (
            <path key={i} d={d} fill={LAND_BASE} />
          ))}
        </>
      )}
      {/* 게임에 없는 나라: 회색으로 덮어 꺼 둠 */}
      <path
        d={GEO_PATH.x}
        fill="#4b5563"
        fillOpacity={ART ? 0.55 : 0.6}
        stroke="#0f172a"
        strokeOpacity="0.4"
        strokeWidth="0.4"
        pointerEvents="none"
      />
      {/* 13개 나라: 도시 영역마다 지금 주인 색 */}
      <g opacity={ART ? (mode === "나라" ? 0.58 : 0.48) : 1}>
        {COUNTRIES.map((c) => (
          <g
            key={c.id}
            clipPath={`url(#wm-c-${c.id})`}
            className="map-country"
            onClick={() => pick(c.id)}
          >
            {CITIES.filter((x) => x.home === c.id).map((city) => {
              const o = owner[city.id];
              const sel = c.id === selectedId;
              const alive = isAlive(world, o);
              const col = mixColor(
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
              return <path key={city.id} d={CELL_PATH[city.id]} fill={col} />;
            })}
          </g>
        ))}
      </g>
      {/* 13개 나라 해안선 */}
      {COUNTRIES.map((c) => (
        <path
          key={c.id}
          d={COAST[c.id]}
          fill="none"
          stroke={c.id === selectedId ? "#e2f3ff" : "#7dd3fc"}
          strokeOpacity={c.id === selectedId ? 0.9 : 0.45}
          strokeWidth={(c.id === selectedId ? 1 : 0.6) * zr}
          pointerEvents="none"
        />
      ))}
      {/* 대한민국 시·도 경계 */}
      {!mini && cv.k >= 2.9 && (
        <path
          d={KR_INNER}
          fill="none"
          stroke="#f8fafc"
          strokeOpacity="0.65"
          strokeWidth={0.45 * z}
          strokeDasharray={`${1.6 * z} ${1 * z}`}
          strokeLinejoin="round"
          pointerEvents="none"
        />
      )}
      {!mini &&
        cv.k >= 3.5 &&
        KR_PROVINCES.filter((p) => !p.metro).map((p) => (
          <text
            key={p.full}
            x={p.x}
            y={p.y}
            textAnchor="middle"
            className="map-prov"
          >
            {p.name}
          </text>
        ))}
      {/* 표기만 하는 지명(여수 등) */}
      {!mini &&
        cv.k >= 3.5 &&
        Object.values(HOME_MARKS)
          .flat()
          .map((m) => {
            const q = project(...m.lonlat);
            return (
              <g key={m.name} pointerEvents="none">
                <circle cx={q.x} cy={q.y} r={0.9 * zr} fill="#f8fafc" />
                <text x={q.x} y={q.y - 2 * z} textAnchor="middle" className="map-prov">
                  {m.name}
                </text>
              </g>
            );
          })}
      {/* 분쟁 섬(가상의 작은 섬)·고대 성지 */}
      {PIONEER_ISLANDS.map((p) => (
        <path
          key={p.id}
          d={islandPath(p.x, p.y, 3.4, hash(p.id))}
          fill="#cdb77a"
          stroke="#0f172a"
          strokeWidth="0.5"
        >
          <title>
            {p.name} · 주인 없는 분쟁 섬 · {p.res}
          </title>
        </path>
      ))}
      <path
        d={islandPath(HOLY_HEX.x, HOLY_HEX.y, 3, 7)}
        fill="#fbbf24"
        stroke="#0f172a"
        strokeWidth="0.5"
      >
        <title>{HOLY_CITY.name}</title>
      </path>
      {!mini &&
        PIONEER_ISLANDS.map((p) => (
          <text
            key={p.id}
            x={p.x}
            y={p.y + 11 * z}
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
          fontSize={mini ? 22 : (c.cities.length >= 4 ? 11 : 6.5) * z}
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
              r={(city.capital ? 3.8 : 2.8) * zr}
              fill={colorOf(o)}
              stroke={occupied ? "#fff" : "#0c1a2b"}
              strokeWidth={(occupied ? 1.6 : 1) * zr}
            />
            {!mini && (
              <text
                x={city.x}
                y={city.y - 5 * zr}
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
          y={HOLY_HEX.y + 10 * z}
          textAnchor="middle"
          className="map-island holy"
        >
          {HOLY_CITY.name}
        </text>
      )}
      {!mini && <Fleets world={world} colorOf={colorOf} zr={zr} />}
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
