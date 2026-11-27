import { REAL_ISLANDS } from '../data/islands';
import {
  useEffect,
  useRef,
  useMemo,
  useState,
  type PointerEvent as RPointerEvent,
  type WheelEvent as RWheelEvent,
} from "react";
import { CITIES } from "../data/cities";
import { CITY_RES, RES_ICON, type Res } from "../data/economy";
import { CITY_INST, instById } from "../data/institutions";
import { BLOCS, COUNTRIES, HOLY_CITY, countryById, type Relation } from "../data/world";
import { PIONEER_ISLANDS, HOLY_HEX } from "../data/hexmap";
import { KR_OUTLINE } from "../data/krProvinces";
import { annexedProv, landOwners, provinces } from "../game/territory";
import { HOME_MARKS } from "./homeTerrain";
import { useHomeGeos } from "./homeGeo";
import { CITY_DEFENSE_MAX } from "../game/balance";
import { strikes } from "../game/frontline";
import { CITY_STAGES } from "../game/growth";
import {
  GEO,
  GEO_PATH,
  isLand,
  seaNearXY,
  project,
} from "../data/realmap";
import { homeOf, isAlive, relationOf, type WorldState } from "../game/world";
import { Bomber, Carrier, Drone, Escort, Heli, Jet, Sub, Tank, Truck } from "./units";
import { MAP_DOMAIN, baseUnit, mapForces } from "../data/forces";
import { unitArtUrl } from "./iconArt";
import { Mover } from "./mover";
import { nightPath, useNowMinute, useWorldJson, worldSatUrl, type WorldSat } from "./worldSky";
import { polyD, seaLoop, seaRoute } from "../data/seaPath";

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
  tw: "#6366f1",
  pl: "#f43f5e",
  ph: "#d946ef",
  pk: "#15803d",
  sa: "#c2410c",
  // 11-27 새 나라 18개
  eg: "#eab308",
  ng: "#16a34a",
  za: "#0d9488",
  et: "#b45309",
  dz: "#4d7c0f",
  br: "#10b981",
  ar: "#7dd3fc",
  co: "#fde047",
  ve: "#be123c",
  cl: "#2563eb",
  au: "#0ea5e9",
  ca: "#dc2626",
  mx: "#65a30d",
  fr: "#1d4ed8",
  it: "#059669",
  es: "#f59e0b",
  gr: "#60a5fa",
  fi: "#e0f2fe",
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
// 11-25 밤 불빛·구름(scripts/gen_worldsat.py)
const SKY_FILES = import.meta.glob("../assets/world/world-{night,clouds}.webp", { eager: true, query: "?url", import: "default" }) as Record<string, string>;
const NIGHT_ART = SKY_FILES["../assets/world/world-night.webp"];
const CLOUD_ART = SKY_FILES["../assets/world/world-clouds.webp"];

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
/** 분쟁 지역·성지 모양(작은 가상 섬) */
const islandPath = (x: number, y: number, r: number, seed: number) => {
  const pts = Array.from({ length: 9 }, (_, i) => {
    const a = (i / 9) * Math.PI * 2;
    const rr = r * (0.75 + (((seed * (i + 3) * 2654435761) >>> 0) % 100) / 200);
    return `${(x + Math.cos(a) * rr * 1.3).toFixed(1)},${(y + Math.sin(a) * rr).toFixed(1)}`;
  });
  return `M${pts.join("L")}Z`;
};

const SEA = Object.fromEntries(
  COUNTRIES.map((c) => {
    const cap = CITIES.find((x) => x.home === c.id && x.capital)!;
    return [c.id, { ...seaNearXY(cap.x, cap.y, 9), vertical: false }];
  }),
);

/** 지도에 그릴 병과 그림 크기(지도 단위, 그림 256px 안에 물체가 약 70%) */
const UNIT_SIZE: Record<string, number> = {
  항공모함: 21, 강습상륙함: 18, 구축함: 16, "레이저 방공함": 16, 잠수함: 15, "원자력 잠수함": 16,
  폭격기: 16, 전투기: 14, 무인드론: 12, 공격헬기: 13,
  전차: 12, 기갑병: 12, 포병: 12, 미사일: 13, 방공부대: 12, 보병: 11, 특수부대: 11,
  탄도미사일: 13, 다연장로켓: 12, "장거리 방공": 12, "해안 미사일": 12, 상륙장갑차: 12, "바다 드론": 11,
  "정찰 무인기": 12, "스텔스 전투기": 14, 조기경보기: 16, "지상 공격기": 15,
};

/** 옛 코드 그림(실제 그림 파일이 없을 때만) */
function CodeUnit({ name, s, color }: { name: string; s: number; color: string }) {
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
    case "바다 드론":
      return <Escort s={0.8 * s} color={color} />;
    case "폭격기":
    case "조기경보기":
    case "지상 공격기":
      return <Bomber s={0.6 * s} color={color} />;
    case "무인드론":
    case "정찰 무인기":
      return <Drone s={0.7 * s} color={color} />;
    case "공격헬기":
      return <Heli s={0.8 * s} color={color} />;
    case "전투기":
    case "스텔스 전투기":
      return <Jet s={0.65 * s} color={color} />;
    case "미사일":
    case "방공부대":
    case "탄도미사일":
    case "다연장로켓":
    case "장거리 방공":
    case "해안 미사일":
      return <Truck s={0.7 * s} color={color} missile />;
    case "보병":
    case "특수부대":
    case "기갑병":
      return <Truck s={0.7 * s} color={color} />;
    default:
      return <Tank s={0.7 * s} color={color} />;
  }
}

/** 병과 이름 → 지도 그림: 부대 탭과 같은 실제 부대 그림(오른쪽을 봄) + 아래에 나라 색 고리 */
function UnitIcon({ name, s, color }: { name: string; s: number; color: string }) {
  const url = unitArtUrl(name);
  if (!url) return <CodeUnit name={name} s={s} color={color} />;
  const w = (UNIT_SIZE[name] ?? 13) * s;
  const dom = MAP_DOMAIN[name] ?? "land";
  return (
    <g>
      <ellipse
        cx={0}
        cy={w * (dom === "air" ? 0.3 : 0.16)}
        rx={w * (dom === "air" ? 0.28 : 0.36)}
        ry={w * (dom === "air" ? 0.08 : 0.13)}
        fill={color}
        fillOpacity={dom === "air" ? 0.3 : 0.6}
        stroke={dom === "air" ? "none" : color}
        strokeWidth={0.5 * s}
      />
      <image href={url} x={-w / 2} y={-w / 2} width={w} height={w} preserveAspectRatio="xMidYMid meet" />
    </g>
  );
}

/** 병과 → 움직일 때 기울기 최대 */
const tiltOf = (name: string) => ((MAP_DOMAIN[baseUnit(name)] ?? "land") === "air" ? 40 : 18);

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
        // 바다: 전쟁이면 적 앞바다 쪽으로 바닷길을 따라 30% 나아간 곳(바닷길이 없으면 제자리)
        let fx = p.x;
        let fy = p.y;
        if (enemy) {
          const route = seaRoute(p, SEA[enemy.id]);
          if (route && route.length > 1) {
            const seg = route.slice(1).map((q, i) => Math.hypot(q.x - route[i].x, q.y - route[i].y));
            let left = seg.reduce((a, b) => a + b, 0) * 0.3;
            for (let i = 0; i < seg.length; i++) {
              if (left <= seg[i]) {
                const r = left / seg[i];
                fx = route[i].x + (route[i + 1].x - route[i].x) * r;
                fy = route[i].y + (route[i + 1].y - route[i].y) * r;
                break;
              }
              left -= seg[i];
            }
          }
        }
        // 순찰 고리: 둘레가 모두 바다가 되게(땅에 닿으면 줄이거나 옮김)
        const loop = seaLoop(fx, fy, 10, 4).d;
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
                <Mover key={`s${j}`} path={loop} dur={dur} begin={-j * 2.2 - (h % 9)} tilt={tiltOf(f.sea[j % f.sea.length])}>
                  <UnitIcon name={f.sea[j % f.sea.length]} s={(j ? 0.75 : 1) * zr} color={color} />
                </Mover>
              ))}
            {f.air.slice(0, 2).map((n, j) => (
              <Mover key={`a${j}`} path={jetPath} dur={jdur} begin={-j * 0.6 - (h % 7)} tilt={tiltOf(n)}>
                <UnitIcon name={n} s={zr} color={color} />
              </Mover>
            ))}
            {road &&
              f.land.slice(0, 2).map((n, j) => (
                <Mover key={`l${j}`} path={road} dur={rdur} begin={-j * 1.4 - (h % 5)} tilt={tiltOf(n)}>
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
          // 배는 바닷길로(땅을 가로지르지 않게), 하늘·땅 부대는 곧장
          const [q0, q1] = d.phase === "go" ? [SEA[d.from], SEA[d.to]] : [SEA[d.to], SEA[d.from]];
          const route = seaRoute(q0, q1);
          const seaLine = route ? polyD(route) : null;
          const units = d.units.slice(0, 2);
          const anySea = units.some((n) => MAP_DOMAIN[baseUnit(n)] === "sea");
          return (
            <g key={`d${i}`}>
              {(!anySea || !seaLine) && (
                <path d={line} fill="none" stroke={color} strokeOpacity="0.5" strokeWidth={0.8 * zr} strokeDasharray="4 3" />
              )}
              {anySea && seaLine && (
                <path d={seaLine} fill="none" stroke={color} strokeOpacity="0.5" strokeWidth={0.8 * zr} strokeDasharray="4 3" />
              )}
              {units.map((n, j) => {
                const isSea = MAP_DOMAIN[baseUnit(n)] === "sea";
                if (isSea && !seaLine) return null;
                return (
                  <Mover key={j} path={isSea ? seaLine! : line} dur={isSea ? 20 : 8} begin={-j * 1.5} tilt={tiltOf(n)}>
                    <UnitIcon name={baseUnit(n)} s={zr} color={color} />
                  </Mover>
                );
              })}
            </g>
          );
        }
        const sea = SEA[d.to];
        const seaRing = seaLoop(sea.x + 5, sea.y + 4, 8, 3).d;
        return (
          <g key={`d${i}`}>
            {d.units.slice(0, 3).map((n, j) => {
              const dom = MAP_DOMAIN[baseUnit(n)] ?? "land";
              const path =
                dom === "sea"
                  ? seaRing
                  : dom === "air"
                    ? loopAt(b.x, b.y, 12, 8)
                    : loopAt(b.x + 2, b.y + 2, 4, 3);
              return (
                <Mover key={j} path={path} dur={dom === "air" ? 10 : 24} begin={-j * 3 - i} tilt={tiltOf(n)}>
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

  const defKey = Object.entries(world.defense).filter(([, v]) => v < CITY_DEFENSE_MAX - 2).map(([k]) => k).join(',');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const atk = useMemo(() => (mini ? [] : strikes(world)), [mini, defKey, world.pairs, world.owner]);
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
  // ── 11-25 실사 꾸밈 ──
  // 확대 2.5배 넘으면 화면에 보이는 고해상 위성 조각, 2배 넘으면 정밀 국경선
  const satMeta = useWorldJson<WorldSat>("meta.json", !mini && cv.k >= 2.5);
  const tileU = satMeta ? (satMeta.tile / satMeta.w1) * MW : 0;
  const satTiles =
    satMeta && cv.k >= 2.5
      ? satMeta.tiles.filter(([tx, ty]) => inView(tx * tileU + tileU / 2, ty * tileU + tileU / 2, tileU))
      : [];
  // 실제 시각 낮·밤: 해가 진 곳은 어둡게(노을 3단), 그곳에만 도시 불빛
  const now = useNowMinute();
  const nights = [-2, 1, 4, 7, 10, 13].map((a) => nightPath(now, a));
  const nightClip = nightPath(now, 3);
  // 나라 색: 확대할수록 옅게(위성 사진이 보이게)
  const fillA = mode === "나라" ? (cv.k >= 3 ? 0.36 : cv.k >= 2 ? 0.46 : 0.52) : cv.k >= 3 ? 0.3 : 0.42;

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
        <linearGradient id="wm-haze" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#cfe8ff" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#cfe8ff" stopOpacity="0" />
        </linearGradient>
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
        <>
          <image
            href={ART}
            x={X0}
            y={Y0}
            width={MW}
            height={MH}
            preserveAspectRatio="none"
          />
          {satMeta &&
            satTiles.map(([tx, ty]) => (
              <image
                key={`${tx}-${ty}`}
                href={worldSatUrl(`1-${tx}-${ty}.webp`)}
                x={X0 + tx * tileU}
                y={Y0 + ty * tileU}
                width={(Math.min(satMeta.tile, satMeta.w1 - tx * satMeta.tile) / satMeta.w1) * MW + 0.05}
                height={(Math.min(satMeta.tile, satMeta.h1 - ty * satMeta.tile) / satMeta.h1) * MH + 0.05}
                preserveAspectRatio="none"
                pointerEvents="none"
              />
            ))}
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
        pointerEvents="none"
      />
      {/* 13개 나라: 도(주·성)마다 지금 주인 색 */}
      <g opacity={ART ? fillA : 1}>
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
        {PROVS.filter((p) => (land[p.id] ?? p.c) !== p.c && !annexedProv(world, p, land[p.id])).map((p) => (
          <path
            key={p.id}
            d={p.d}
            fill="url(#wm-occ)"
            clipPath={`url(#wm-c-${p.c})`}
          />
        ))}
      </g>
      {/* 11-25 대장 요청: 나라 윤곽선 없음(나라 구분은 색으로만, 전선은 전쟁 때만) */}
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
                  {/* 11-25: 철도 흰 점선은 경계선처럼 보여 은은한 실선만 */}
                  <path d={g.rail} stroke="#1f2937" strokeOpacity={0.45} strokeWidth={0.5 * z} />
                </>
              )}
            </g>
          ))}
        </g>
      )}
      {/* 11-25 실제 시각 낮·밤 경계 + 밤 쪽 도시 불빛 */}
      <g pointerEvents="none">
        {nights.map((d, i) => d && <path key={i} d={d} fill="#050d24" fillOpacity={0.09} />)}
        {NIGHT_ART && nightClip && (
          <>
            <clipPath id="wm-night">
              <path d={nightClip} />
            </clipPath>
            <image href={NIGHT_ART} x={X0} y={Y0} width={MW} height={MH} preserveAspectRatio="none" clipPath="url(#wm-night)" opacity={0.9} style={{ mixBlendMode: "screen" }} />
          </>
        )}
      </g>
      {/* 11-25 구름층(천천히 흐름, 확대할수록 옅게) + 극지방 대기 빛 */}
      {CLOUD_ART && cv.k < 6 && (
        <g pointerEvents="none" opacity={mini ? 0.45 : Math.max(0, 0.55 * (1 - (cv.k - 1) / 5)).toFixed(2)}>
          <g>
            <image href={CLOUD_ART} x={X0} y={Y0} width={MW} height={MH} preserveAspectRatio="none" />
            <image href={CLOUD_ART} x={X0 - MW} y={Y0} width={MW} height={MH} preserveAspectRatio="none" />
            <animateTransform attributeName="transform" type="translate" from="0 0" to={`${MW} 0`} dur="1800s" repeatCount="indefinite" />
          </g>
        </g>
      )}
      <rect x={X0} y={Y0} width={MW} height={MH * 0.2} fill="url(#wm-haze)" pointerEvents="none" />
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
      {/* 11-27 전선 지도: 공격받는 도시로 향하는 움직이는 화살표 */}
      {!mini && atk.length > 0 && (
        <g pointerEvents="none">
          {atk.map((s) => {
            const dx = s.to.x - s.from.x;
            const dy = s.to.y - s.from.y;
            const len = Math.hypot(dx, dy) || 1;
            const bend = Math.min(18, len * 0.22);
            const mx = (s.from.x + s.to.x) / 2 - (dy / len) * bend;
            const my = (s.from.y + s.to.y) / 2 + (dx / len) * bend - bend * 0.4;
            // 화살촉: 도착점 바로 앞
            const tx = s.to.x - mx;
            const ty = s.to.y - my;
            const tl = Math.hypot(tx, ty) || 1;
            const ux = tx / tl;
            const uy = ty / tl;
            const ex = s.to.x - ux * 3.2 * zr;
            const ey = s.to.y - uy * 3.2 * zr;
            const hw = 3.2 * zr;
            const d = `M${s.from.x},${s.from.y}Q${mx},${my} ${ex},${ey}`;
            return (
              <g key={s.to.id}>
                <path d={d} fill="none" stroke="#7f1d1d" strokeWidth={3.4 * zr} strokeOpacity={0.55} strokeLinecap="round" />
                <path d={d} fill="none" stroke="#fb7185" strokeWidth={1.7 * zr} strokeDasharray={`${4 * zr} ${3 * zr}`} strokeLinecap="round" className="wm-atk" style={{ ['--d' as string]: `${-7 * zr}px` }} />
                <path
                  d={`M${ex + ux * hw * 1.5},${ey + uy * hw * 1.5}L${ex - uy * hw},${ey + ux * hw}L${ex + uy * hw},${ey - ux * hw}Z`}
                  fill="#fb7185"
                  stroke="#7f1d1d"
                  strokeWidth={0.5 * zr}
                />
              </g>
            );
          })}
        </g>
      )}
      {/* 도 이름: 화면에서 이름이 들어갈 만큼 클 때만 */}
      {!mini &&
        cv.k >= 2.5 &&
        PROVS.filter(
          (p) =>
            !CITY_NAMES.has(p.name) &&
            p.name &&
            Math.sqrt(p.a) > 3.5 * z * p.name.length * 0.9 &&
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
      {/* 분쟁 지역(실제 분쟁 지역)·고대 성지 */}
      {PIONEER_ISLANDS.map((p) => (
        <path
          key={p.id}
          d={islandPath(p.x, p.y, 3.4, hash(p.id))}
          fill="#cdb77a"
          stroke="#0f172a"
          strokeWidth="0.5"
        >
          <title>
            {p.name} · 분쟁 지역({REAL_ISLANDS[p.id]?.sides.map((x) => countryById(x).name).join('·')} 등) · {p.res}
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
            y={p.y + 8 * z}
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
          fontSize={mini ? 22 : (c.cities.length >= 4 ? 7.5 : 5) * z}
          opacity={(isAlive(world, c.id) ? 1 : 0.4) * (!mini && cv.k >= 5 ? 0.35 : 1)}
        >
          {c.id === playerCountryId ? "★ " : ""}
          {c.name}
        </text>
      ))}
      {CITIES.map((city) => {
        const o = owner[city.id];
        const occupied = o !== homeOf(world, city.id);
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
              r={(city.capital ? 3.2 : city.front ? 2.3 : 1.5) * zr * grow}
              fill={colorOf(o)}
              stroke={occupied ? "#fff" : "#0c1a2b"}
              strokeWidth={(occupied ? 1.6 : 1) * zr}
            />
            {/* 11-25 확대 단계별: 멀리선 수도만, 1.5배~ 점령 도시, 2배~ 모든 도시 */}
            {!mini && (city.capital || (city.front && cv.k >= 1.5) || cv.k >= 2) && (
              <text
                x={city.x}
                y={city.y - (city.front ? 4.2 : 3.2) * zr}
                textAnchor="middle"
                className={city.front ? "map-cityname" : "map-cityname sub"}
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
                y={city.y + 6.5 * zr}
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
              {city.front ? "\n⚔️ 점령 도시(직접 공격할 수 있는 거점)" : `\n🏘️ 내정 도시(${CITIES.find((x) => x.id === city.hub)!.name}을 따라감)`}
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
          y={HOLY_HEX.y + 8 * z}
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
