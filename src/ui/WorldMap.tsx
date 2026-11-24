import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as RPointerEvent,
  type WheelEvent as RWheelEvent,
} from "react";
import { CITIES } from "../data/cities";
import { CITY_RES, RES_ICON, type Res } from "../data/economy";
import { CITY_INST, instById } from "../data/institutions";
import { BLOCS, COUNTRIES, HOLY_CITY, type Relation } from "../data/world";
import { PIONEER_ISLANDS, HOLY_HEX } from "../data/hexmap";
import { KR_INNER, KR_OUTLINE } from "../data/krProvinces";
import { GEO_PROV_INNER } from "../data/provinces";
import { landOwners, provinces } from "../game/territory";
import { HOME_MARKS } from "./homeTerrain";
import { useHomeGeos } from "./homeGeo";
import { CITY_DEFENSE_MAX } from "../game/balance";
import { CITY_STAGES } from "../game/growth";
import {
  GEO,
  GEO_PATH,
  isLand,
  seaNearXY,
  project,
} from "../data/realmap";
import { isAlive, relationOf, type WorldState } from "../game/world";
import { Bomber, Carrier, Drone, Escort, Heli, Jet, Sub, Tank, Truck } from "./units";
import { MAP_DOMAIN, baseUnit, mapForces } from "../data/forces";

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
  /** 내가 만든 부대(지도에 우리 병과로 그림) */
  army?: Record<string, number>;
  /** 해외 파병(지도 표시) */
  deploys?: MapDeploy[];
  /** 도시 단계(0 마을 ~ 6 세계 도시): 확대하면 점 크기·단계 아이콘 */
  cityLv?: Record<string, number>;
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
/** 나라마다 도(주·성·현) 영역: 도시를 빼앗기거나 길목을 내주면 그 도 색이 바뀜(game/territory.ts) */
const PROVS = provinces();
/** 도시 이름과 같은 도(서울·모스크바 등)는 도 이름을 따로 쓰지 않음 */
const CITY_NAMES = new Set(CITIES.map((c) => c.name));
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

/** 병과 이름 → 지도 그림 */
function UnitIcon({ name, s, color }: { name: string; s: number; color: string }) {
  switch (name) {
    case "항공모함":
      return <Carrier s={0.7 * s} color={color} />;
    case "강습상륙함":
      return <Carrier s={0.55 * s} color={color} />;
    case "잠수함":
    case "원자력 잠수함":
      return <Sub s={0.7 * s} color={color} />;
    case "구축함":
    case "레이저 방공함":
      return <Escort s={0.8 * s} color={color} />;
    case "폭격기":
      return <Bomber s={0.6 * s} color={color} />;
    case "무인드론":
      return <Drone s={0.7 * s} color={color} />;
    case "공격헬기":
      return <Heli s={0.8 * s} color={color} />;
    case "전투기":
      return <Jet s={0.65 * s} color={color} />;
    case "미사일":
    case "방공부대":
      return <Truck s={0.7 * s} color={color} missile />;
    case "보병":
    case "특수부대":
    case "기갑병":
      return <Truck s={0.7 * s} color={color} />;
    default:
      return <Tank s={0.7 * s} color={color} />;
  }
}

/** path를 따라 계속 움직이는 그림 하나 */
function Mover({
  path,
  dur,
  begin,
  children,
}: {
  path: string;
  dur: number;
  begin: number;
  children: React.ReactNode;
}) {
  return (
    <g>
      {children}
      <animateMotion
        dur={`${dur}s`}
        begin={`${begin}s`}
        repeatCount="indefinite"
        rotate="auto"
        path={path}
      />
    </g>
  );
}

const loopAt = (x: number, y: number, rx: number, ry: number) =>
  `M${(x - rx).toFixed(1)},${y.toFixed(1)} a${rx},${ry} 0 1,0 ${rx * 2},0 a${rx},${ry} 0 1,0 ${-rx * 2},0`;
const capOf = (id: string) =>
  CITIES.find((x) => x.home === id && x.capital) ?? CITIES.find((x) => x.home === id)!;

/** 파병(지도 표시용): 가는 중·머무는 중·오는 중 */
export interface MapDeploy {
  from: string;
  to: string;
  units: string[];
  phase: "go" | "stay" | "back";
}

/** 땅 길: 두 도시 사이가 거의 땅이면 */
function landRoad(a: { x: number; y: number }, b: { x: number; y: number }) {
  let land = 0;
  for (let i = 1; i < 8; i++)
    if (isLand(a.x + ((b.x - a.x) * i) / 8, a.y + ((b.y - a.y) * i) / 8))
      land++;
  return land >= 6;
}

/** 나라마다 가진 병과가 움직임: 바다(앞바다 순찰·전쟁 땐 전진), 하늘(순찰·전쟁 땐 적 도시 출격), 땅(도시 사이 길·전선). 파병지에서도 움직임 */
function Fleets({
  world,
  colorOf,
  zr = 1,
  playerCountryId,
  army,
  deploys = [],
}: {
  world: WorldState;
  colorOf: (id: string) => string;
  /** 확대 배율에 맞춘 크기 비율(확대해도 배·전투기가 커지지 않게) */
  zr?: number;
  playerCountryId: string;
  army?: Record<string, number>;
  deploys?: MapDeploy[];
}) {
  // AI 강대국은 전쟁 중인 연합국에 전투기를 보냄(보이는 것만)
  const aiDeploys: MapDeploy[] = [];
  for (const big of ["us", "cn", "ru", "uk"]) {
    if (big === playerCountryId || !isAlive(world, big)) continue;
    const host = COUNTRIES.find(
      (a) =>
        a.id !== big &&
        isAlive(world, a.id) &&
        relationOf(world, big, a.id) === "연합" &&
        COUNTRIES.some(
          (e) => e.id !== a.id && relationOf(world, a.id, e.id) === "전쟁",
        ),
    );
    if (host) {
      const f = mapForces(big);
      aiDeploys.push({
        from: big,
        to: host.id,
        units: [...f.air.slice(0, 1), ...f.sea.slice(0, 1)],
        phase: "stay",
      });
    }
  }
  return (
    <g className="fleets" pointerEvents="none">
      {COUNTRIES.filter((c) => isAlive(world, c.id)).map((c) => {
        const f = mapForces(c.id, c.id === playerCountryId ? army : undefined);
        const p = SEA[c.id];
        const color = colorOf(c.id);
        const h = hash(c.id);
        const enemy = COUNTRIES.find(
          (e) =>
            e.id !== c.id &&
            isAlive(world, e.id) &&
            relationOf(world, c.id, e.id) === "전쟁",
        );
        // 바다: 전쟁이면 적 앞바다 쪽으로 30% 나아간 곳(땅이면 제자리)
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
        const loop = loopAt(fx, fy, 10, 4);
        const dur = 34 + (h % 14);
        // 하늘: 평시 = 수도 둘레 순찰, 전쟁 = 적 도시까지 갔다가 돌아옴
        const home = capOf(c.id);
        const target = enemy
          ? (CITIES.find(
              (x) =>
                x.home === enemy.id &&
                x.capital &&
                world.owner[x.id] === enemy.id,
            ) ??
            CITIES.find((x) => world.owner[x.id] === enemy.id) ??
            null)
          : null;
        let jetPath: string;
        if (target) {
          const dx = target.x - home.x;
          const dy = target.y - home.y;
          const c1 = `${(home.x + dx / 2 - dy * 0.25).toFixed(1)},${(home.y + dy / 2 + dx * 0.25).toFixed(1)}`;
          const c2 = `${(home.x + dx / 2 + dy * 0.25).toFixed(1)},${(home.y + dy / 2 - dx * 0.25).toFixed(1)}`;
          jetPath = `M${home.x},${home.y} Q${c1} ${target.x},${target.y} Q${c2} ${home.x},${home.y}`;
        } else jetPath = loopAt(home.x, home.y, 16, 11);
        const jdur = target ? 9 : 12;
        // 땅: 전쟁이면 가장 가까운 전선(땅으로 이어진 적 도시)까지, 평시엔 수도 ↔ 가까운 우리 도시
        const mine = CITIES.filter((x) => world.owner[x.id] === c.id);
        let road: string | null = null;
        let front = false;
        if (enemy) {
          let best = Infinity;
          for (const a of mine)
            for (const b of CITIES.filter((x) => world.owner[x.id] === enemy.id)) {
              const d = Math.hypot(a.x - b.x, a.y - b.y);
              if (d < best && d < 30 * GEO.PX && landRoad(a, b)) {
                best = d;
                const mx = a.x + (b.x - a.x) * 0.8;
                const my = a.y + (b.y - a.y) * 0.8;
                road = `M${a.x},${a.y} L${mx.toFixed(1)},${my.toFixed(1)} L${a.x},${a.y}`;
                front = true;
              }
            }
        }
        if (!road) {
          const near = mine
            .filter((x) => x.id !== home.id)
            .map((x) => ({ x, d: Math.hypot(x.x - home.x, x.y - home.y) }))
            .filter((o) => o.d < 18 * GEO.PX && landRoad(home, o.x))
            .sort((a, b) => a.d - b.d)[0]?.x;
          if (near) road = `M${home.x},${home.y} L${near.x},${near.y} L${home.x},${home.y}`;
          else if (isLand(home.x, home.y)) road = loopAt(home.x, home.y, 4, 3);
        }
        const rdur = front ? 14 : 26 + (h % 9);
        return (
          <g key={c.id}>
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
            {f.sea.length > 0 &&
              [0, 1, 2].map((j) => (
                <Mover key={`s${j}`} path={loop} dur={dur} begin={-j * 2.2 - (h % 9)}>
                  <UnitIcon name={f.sea[j % f.sea.length]} s={(j ? 0.75 : 1) * zr} color={color} />
                </Mover>
              ))}
            {f.air.slice(0, 2).map((n, j) => (
              <Mover key={`a${j}`} path={jetPath} dur={jdur} begin={-j * 0.6 - (h % 7)}>
                <UnitIcon name={n} s={zr} color={color} />
              </Mover>
            ))}
            {road &&
              f.land.slice(0, 2).map((n, j) => (
                <Mover key={`l${j}`} path={road} dur={rdur} begin={-j * 1.4 - (h % 5)}>
                  <UnitIcon name={n} s={0.8 * zr} color={color} />
                </Mover>
              ))}
            {target && (
              <circle cx={target.x} cy={target.y} r="5" fill="#f97316">
                <animate
                  attributeName="opacity"
                  values="0;0;0.9;0;0"
                  keyTimes="0;0.42;0.5;0.62;1"
                  dur={`${jdur}s`}
                  begin={`${-(h % 7)}s`}
                  repeatCount="indefinite"
                />
                <animate
                  attributeName="r"
                  values="2;2;8;11;2"
                  keyTimes="0;0.42;0.5;0.62;1"
                  dur={`${jdur}s`}
                  begin={`${-(h % 7)}s`}
                  repeatCount="indefinite"
                />
              </circle>
            )}
          </g>
        );
      })}
      {/* 해외 파병: 가는 길(점선) + 파병지 둘레에서 움직임 */}
      {[...deploys, ...aiDeploys].map((d, i) => {
        if (!isAlive(world, d.to)) return null;
        const color = colorOf(d.from);
        const a = capOf(d.from);
        const b = capOf(d.to);
        if (d.phase !== "stay") {
          const [s0, s1] = d.phase === "go" ? [a, b] : [b, a];
          const line = `M${s0.x},${s0.y} L${s1.x},${s1.y}`;
          return (
            <g key={`d${i}`}>
              <path d={line} fill="none" stroke={color} strokeOpacity="0.5" strokeWidth={0.8 * zr} strokeDasharray="4 3" />
              {d.units.slice(0, 2).map((n, j) => (
                <Mover key={j} path={line} dur={8} begin={-j * 1.5}>
                  <UnitIcon name={n} s={zr} color={color} />
                </Mover>
              ))}
            </g>
          );
        }
        const sea = SEA[d.to];
        return (
          <g key={`d${i}`}>
            {d.units.slice(0, 3).map((n, j) => {
              const dom = MAP_DOMAIN[baseUnit(n)] ?? "land";
              const path =
                dom === "sea"
                  ? loopAt(sea.x + 5, sea.y + 4, 8, 3)
                  : dom === "air"
                    ? loopAt(b.x, b.y, 12, 8)
                    : loopAt(b.x + 2, b.y + 2, 4, 3);
              return (
                <Mover key={j} path={path} dur={dom === "air" ? 10 : 24} begin={-j * 3 - i}>
                  <UnitIcon name={baseUnit(n)} s={zr} color={color} />
                </Mover>
              );
            })}
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
  army,
  deploys,
  cityLv,
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
  const land = landOwners(world);
  // 확대해도 글씨·점·선이 같이 커지지 않게(처음 배율 기준으로 화면 크기 유지)
  const z = mini ? 1 : Math.min(1, START_K / cv.k);
  const zr = mini ? 1 : Math.pow(z, 0.75);
  // ── 확대 단계별 상세(11/24 C3) ──
  // 1단계(처음): 나라 색·도시 / 2단계(×1.6~): 도 경계 / 3단계(×3~): 실제 강·고속도로·도시 단계 / 4단계(×5~): 철도·지방 도로
  const inView = (x: number, y: number, pad = 30) =>
    x > X0 + cv.x - pad && x < X0 + cv.x + vw(cv.k) + pad && y > Y0 + cv.y - pad && y < Y0 + cv.y + vh(cv.k) + pad;
  const seenIds = mini ? [] : COUNTRIES.filter((c) => CITIES.some((ci) => ci.home === c.id && inView(ci.x, ci.y, 120))).map((c) => c.id);
  const geos = useHomeGeos(seenIds, !mini && cv.k >= 3);
  // 전선: 서로 전쟁 중인 두 나라 땅이 맞닿은 곳
  const fronts: Array<[string, string]> = [];
  if (!mini)
    for (let i = 0; i < COUNTRIES.length; i++)
      for (let j = i + 1; j < COUNTRIES.length; j++) {
        const a = COUNTRIES[i].id;
        const b = COUNTRIES[j].id;
        if (isAlive(world, a) && isAlive(world, b) && relationOf(world, a, b) === "전쟁") fronts.push([a, b]);
      }
  const frontOwners = Array.from(new Set(fronts.flat()));
  const ownedBy = (o: string) => PROVS.filter((p) => (land[p.id] ?? p.c) === o);

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
        {frontOwners.map((o) => (
          <clipPath key={o} id={`wm-own-${o}`}>
            {ownedBy(o).map((p) => (
              <path key={p.id} d={p.d} />
            ))}
          </clipPath>
        ))}
        <filter id="wm-front-glow" x="-10%" y="-10%" width="120%" height="120%">
          <feGaussianBlur stdDeviation="1.2" />
        </filter>
        <pattern
          id="wm-occ"
          width="4"
          height="4"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <rect width="1.3" height="4" fill="#fff" fillOpacity="0.35" />
        </pattern>
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
      {/* 13개 나라: 도(주·성)마다 지금 주인 색 */}
      <g opacity={ART ? (mode === "나라" ? 0.58 : 0.48) : 1}>
        {COUNTRIES.map((c) => (
          <g
            key={c.id}
            clipPath={`url(#wm-c-${c.id})`}
            className="map-country"
            onClick={() => pick(c.id)}
          >
            {PROVS.filter((p) => p.c === c.id).map((p) => {
              const o = land[p.id] ?? c.id;
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
              return (
                <path
                  key={p.id}
                  d={p.d}
                  fill={col}
                  stroke={col}
                  strokeWidth={0.6}
                />
              );
            })}
          </g>
        ))}
      </g>
      {/* 점령당한 땅: 빗금(점령한 나라 색 위에) */}
      <g pointerEvents="none">
        {PROVS.filter((p) => (land[p.id] ?? p.c) !== p.c).map((p) => (
          <path
            key={p.id}
            d={p.d}
            fill="url(#wm-occ)"
            clipPath={`url(#wm-c-${p.c})`}
          />
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
      {/* 실제 강·고속도로(×3~)·철도·지방 도로(×5~): Natural Earth 자료 */}
      {!mini && cv.k >= 3 && (
        <g fill="none" strokeLinecap="round" strokeLinejoin="round" pointerEvents="none">
          {Object.entries(geos).map(([id, g]) => (
            <g key={id} clipPath={`url(#wm-c-${id})`}>
              <path d={g.river} stroke="#4fa3d9" strokeOpacity={0.75} strokeWidth={0.55 * z} />
              {cv.k >= 5 && <path d={g.road2} stroke="#e9dcc0" strokeOpacity={0.45} strokeWidth={0.3 * z} />}
              <path d={g.road} stroke="#3b2f1e" strokeOpacity={0.5} strokeWidth={1.1 * z} />
              <path d={g.road} stroke="#f6cf7a" strokeOpacity={0.85} strokeWidth={0.55 * z} />
              {cv.k >= 5 && (
                <>
                  <path d={g.rail} stroke="#1f2937" strokeOpacity={0.8} strokeWidth={0.6 * z} />
                  <path d={g.rail} stroke="#e5e7eb" strokeOpacity={0.9} strokeWidth={0.3 * z} strokeDasharray={`${1.2 * z} ${1.2 * z}`} />
                </>
              )}
            </g>
          ))}
        </g>
      )}
      {/* 전선: 전쟁 중인 두 나라 땅이 맞닿은 곳에 붉은 띠 */}
      {fronts.length > 0 && (
        <g pointerEvents="none">
          {fronts.flatMap(([a, b]) =>
            [
              [a, b],
              [b, a],
            ].map(([x, y]) => (
              <g key={`${x}-${y}`} clipPath={`url(#wm-own-${x})`}>
                <g fill="none" stroke="#ef4444" strokeLinejoin="round">
                  {ownedBy(y).map((p) => (
                    <path key={p.id} d={p.d} strokeWidth={6 * zr} strokeOpacity={0.8} filter="url(#wm-front-glow)" />
                  ))}
                </g>
                <g fill="none" stroke="#fecaca" strokeLinejoin="round" className="wm-front">
                  {ownedBy(y).map((p) => (
                    <path key={p.id} d={p.d} strokeWidth={1.6 * zr} strokeDasharray={`${3 * zr} ${2 * zr}`} />
                  ))}
                </g>
              </g>
            )),
          )}
        </g>
      )}
      {/* 도(주·성·현) 경계: 모든 나라(대한민국은 시·도 자료) */}
      {!mini && cv.k >= 1.6 && (
        <g
          fill="none"
          stroke="#f8fafc"
          strokeOpacity={cv.k >= 2.9 ? 0.6 : 0.35}
          strokeWidth={0.45 * z}
          strokeDasharray={`${1.6 * z} ${1 * z}`}
          strokeLinejoin="round"
          pointerEvents="none"
        >
          {COUNTRIES.map((c) => (
            <path key={c.id} d={c.id === "kr" ? KR_INNER : (GEO_PROV_INNER[c.id] ?? "")} />
          ))}
        </g>
      )}
      {/* 도 이름: 화면에서 이름이 들어갈 만큼 클 때만 */}
      {!mini &&
        cv.k >= 2.5 &&
        PROVS.filter(
          (p) =>
            !CITY_NAMES.has(p.name) &&
            p.name &&
            Math.sqrt(p.a) > 5 * z * p.name.length * 0.9 &&
            p.x > cv.x - 20 &&
            p.x < cv.x + vw(cv.k) + 20 &&
            p.y > cv.y - 20 &&
            p.y < cv.y + vh(cv.k) + 20,
        ).map((p) => (
          <text
            key={p.id}
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
        const lv = cityLv?.[city.id];
        const grow = lv === undefined || mini ? 1 : 0.8 + lv * 0.07;
        const hit = !mini && (world.defense[city.id] ?? CITY_DEFENSE_MAX) < CITY_DEFENSE_MAX - 2;
        return (
          <g key={city.id} className="map-city" onClick={() => pick(city.home)}>
            {hit && (
              <circle cx={city.x} cy={city.y} r={7 * zr} fill="none" stroke="#ef4444" strokeWidth={1.2 * zr} className="wm-hit">
                <title>공격받는 중</title>
              </circle>
            )}
            <circle
              cx={city.x}
              cy={city.y}
              r={(city.capital ? 3.8 : 2.8) * zr * grow}
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
                {hit ? " 🔥" : ""}
                {cv.k >= 3 && lv !== undefined ? ` ${CITY_STAGES[lv].icon}` : ""}
              </text>
            )}
            {!mini && cv.k >= 3 && (
              <text
                x={city.x}
                y={city.y + 8 * zr}
                textAnchor="middle"
                className="map-cityres"
              >
                {(Object.keys(CITY_RES[city.name] ?? {}) as Res[])
                  .map((r) => RES_ICON[r])
                  .join("")}
                {(CITY_INST[city.name] ?? []).length ? " " : ""}
                {(CITY_INST[city.name] ?? []).map((i) => instById(i).icon).join("")}
              </text>
            )}
            <title>
              {city.name}
              {city.capital ? "(수도)" : ""} ·{" "}
              {COUNTRIES.find((c) => c.id === o)!.name}
              {occupied ? " 점령 중" : ""}
              {"\n자원: "}
              {(Object.entries(CITY_RES[city.name] ?? {}) as Array<[Res, number]>)
                .map(([r, n]) => `${RES_ICON[r]}${r} ${n}`)
                .join(" · ") || "없음"}
              {"\n기관: "}
              {(CITY_INST[city.name] ?? []).map((i) => `${instById(i).icon}${instById(i).name}`).join(" · ") || "없음"}
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
      {!mini && (
        <Fleets
          world={world}
          colorOf={colorOf}
          zr={zr}
          playerCountryId={playerCountryId}
          army={army}
          deploys={deploys}
        />
      )}
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
