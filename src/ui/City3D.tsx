// 도시 3D 화면(11/26 서울 시험): OpenStreetMap 실제 건물 윤곽을 높이만큼 세워 그림.
// - 자료: public/city3d/<이름>.json (scripts/gen_city3d.py, GitHub Actions에서 만듦). 좌표는 시청 기준 미터.
// - 인구 단계(0~6, 소수 가능)에 따라 도심에서 가까운 건물부터 켜지고, 높이도 단계마다 올라감.
//   다음에 지어질 건물 자리에는 공사 크레인이 섬. 밤엔 창문 불빛, 인구가 많을수록 차가 많음.
// - 이 파일은 3D 버튼을 누를 때만 따로 불러옴(three.js). 전투 3D(src/battle3d)와는 따로임.
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { MapControls } from 'three/examples/jsm/controls/MapControls.js';

export interface City3DData {
  name: string;
  center: [number, number];
  credit: string;
  /** 건물: [높이m, 종류(0 주거·1 상업·2 공업·3 공공·4 기타), x0,y0, x1,y1, …] */
  b: number[][];
  /** 큰길: [굵기 1~3, x0,y0, …] */
  r: number[][];
  /** 물 */
  w: number[][];
  /** 공원·숲 */
  p: number[][];
}

interface Props {
  /** public/city3d/ 안 파일 이름(확장자 빼고) */
  file: string;
  /** 도시 단계 0~6(소수 가능) */
  level: number;
  /** 0 낮 ~ 1 밤 */
  night: number;
}

const BASE = import.meta.env.BASE_URL ?? '/';
const cache = new Map<string, Promise<City3DData>>();
export function loadCity3D(file: string): Promise<City3DData> {
  let p = cache.get(file);
  if (!p) {
    p = fetch(`${BASE}city3d/${file}.json`).then((r) => {
      if (!r.ok) throw new Error(`${r.status}`);
      return r.json();
    });
    cache.set(file, p);
  }
  return p;
}

/** 단계(0~6) → 보이는 건물 비율·높이 배율·밤 불빛 비율 */
export function growthLook(level: number) {
  const g = Math.max(0, Math.min(6, level)) / 6;
  return {
    show: 0.04 + 0.96 * Math.pow(g, 1.6),
    height: 0.35 + 0.65 * g,
    lights: 0.25 + 0.5 * g,
    cars: Math.round(30 + 330 * g),
  };
}

// 결정적 난수(같은 건물은 늘 같은 색)
const hash = (i: number) => {
  let x = (i + 1) * 374761393;
  x = (x ^ (x >>> 13)) * 1274126177;
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
};

/** 창문 무늬(한 칸 = 가로 4m × 세로 3.3m). 낮 그림·밤 불빛 두 장 */
function windowTextures() {
  const W = 128;
  const H = 128;
  const mk = (nightMode: boolean) => {
    const cv = document.createElement('canvas');
    cv.width = W;
    cv.height = H;
    const g = cv.getContext('2d')!;
    g.fillStyle = nightMode ? '#000' : '#ffffff';
    g.fillRect(0, 0, W, H);
    // 4×4 칸
    for (let y = 0; y < 4; y++)
      for (let x = 0; x < 4; x++) {
        const r = hash(y * 7 + x * 13 + 5);
        if (nightMode) {
          if (r < 0.6) continue;
          g.fillStyle = r > 0.85 ? '#fff1c9' : '#ffc46b';
          g.fillRect(x * 32 + 10, y * 32 + 10, 12, 10);
          continue;
        } else g.fillStyle = r < 0.5 ? '#5d7387' : '#70889c';
        g.fillRect(x * 32 + 6, y * 32 + 8, 20, 15);
      }
    const t = new THREE.CanvasTexture(cv);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  };
  return { day: mk(false), night: mk(true) };
}

/** 도시별 처음 카메라 자리(없으면 기본) */
const START_VIEW: Record<string, { cam: [number, number, number]; at: [number, number, number] }> = {
  seoul: { cam: [1100, 1300, 7000], at: [100, 0, 3700] },
};

const KIND_COLOR = ['#d9d2c5', '#b9c4cf', '#b8b2a6', '#d6c7b0', '#cfcac0'];

interface Built {
  walls: THREE.BufferGeometry;
  roofs: THREE.BufferGeometry;
  /** i번째 건물까지 그릴 때 벽·지붕 인덱스 끝 */
  wallEnd: Uint32Array;
  roofEnd: Uint32Array;
  /** 보이는 순서대로 건물 중심·윤곽 크기 */
  order: Array<{ x: number; z: number; h: number; r: number }>;
}

/** 건물을 도심 가까운 순서로 정렬해 벽·지붕을 각각 한 덩어리로 합침 */
function buildCity(d: City3DData): Built {
  const items = d.b.map((b, i) => {
    let cx = 0;
    let cy = 0;
    const n = (b.length - 2) / 2;
    for (let k = 0; k < n; k++) {
      cx += b[2 + k * 2];
      cy += b[3 + k * 2];
    }
    cx /= n;
    cy /= n;
    // 도심에서 가까울수록 먼저, 높은 건물은 조금 일찍
    const key = Math.hypot(cx, cy) * (0.75 + 0.5 * hash(i)) - Math.min(b[0], 150) * 12;
    return { b, i, cx, cy, key };
  });
  items.sort((a, z) => a.key - z.key);
  const wp: number[] = [];
  const wu: number[] = [];
  const wc: number[] = [];
  const wi: number[] = [];
  const rp: number[] = [];
  const rc: number[] = [];
  const ri: number[] = [];
  const wallEnd = new Uint32Array(items.length);
  const roofEnd = new Uint32Array(items.length);
  const order: Built['order'] = [];
  const col = new THREE.Color();
  items.forEach((it, idx) => {
    const { b, i } = it;
    const h = Math.max(3, b[0]);
    col.set(KIND_COLOR[b[1]] ?? KIND_COLOR[4]);
    const t = 0.82 + 0.3 * hash(i * 3 + 1);
    col.multiplyScalar(t);
    const n = (b.length - 2) / 2;
    const pts: THREE.Vector2[] = [];
    let rad = 0;
    for (let k = 0; k < n; k++) {
      const x = b[2 + k * 2];
      const y = b[3 + k * 2];
      pts.push(new THREE.Vector2(x, y));
      rad = Math.max(rad, Math.hypot(x - it.cx, y - it.cy));
    }
    // 벽: 둘레 길이로 u, 높이로 v (창문 칸 4m × 3.3m)
    let run = 0;
    for (let k = 0; k < n; k++) {
      const a = pts[k];
      const c = pts[(k + 1) % n];
      const len = a.distanceTo(c);
      if (len < 0.5) continue;
      const base = wp.length / 3;
      // three: x=동, y=위, z=-북
      wp.push(a.x, 0, -a.y, c.x, 0, -c.y, c.x, h, -c.y, a.x, h, -a.y);
      const u0 = run / 4;
      const u1 = (run + len) / 4;
      const v1 = h / 3.3;
      wu.push(u0, 0, u1, 0, u1, v1, u0, v1);
      for (let q = 0; q < 4; q++) wc.push(col.r, col.g, col.b);
      wi.push(base, base + 1, base + 2, base, base + 2, base + 3);
      run += len;
    }
    // 지붕
    const tris = THREE.ShapeUtils.triangulateShape(pts, []);
    const rb = rp.length / 3;
    const rcol = col.clone().multiplyScalar(0.78);
    for (const p of pts) {
      rp.push(p.x, h, -p.y);
      rc.push(rcol.r, rcol.g, rcol.b);
    }
    for (const tr of tris) ri.push(rb + tr[0], rb + tr[2], rb + tr[1]);
    wallEnd[idx] = wi.length;
    roofEnd[idx] = ri.length;
    order.push({ x: it.cx, z: -it.cy, h, r: rad });
  });
  const walls = new THREE.BufferGeometry();
  walls.setAttribute('position', new THREE.Float32BufferAttribute(wp, 3));
  walls.setAttribute('uv', new THREE.Float32BufferAttribute(wu, 2));
  walls.setAttribute('color', new THREE.Float32BufferAttribute(wc, 3));
  walls.setIndex(wi);
  walls.computeVertexNormals();
  const roofs = new THREE.BufferGeometry();
  roofs.setAttribute('position', new THREE.Float32BufferAttribute(rp, 3));
  roofs.setAttribute('color', new THREE.Float32BufferAttribute(rc, 3));
  roofs.setIndex(ri);
  roofs.computeVertexNormals();
  return { walls, roofs, wallEnd, roofEnd, order };
}

/** 평평한 다각형(물·공원) 한 덩어리 */
function flatShapes(list: number[][], y: number): THREE.BufferGeometry {
  const pos: number[] = [];
  const idx: number[] = [];
  for (const f of list) {
    const pts: THREE.Vector2[] = [];
    for (let k = 0; k + 1 < f.length; k += 2) pts.push(new THREE.Vector2(f[k], f[k + 1]));
    if (pts.length < 3) continue;
    const tris = THREE.ShapeUtils.triangulateShape(pts, []);
    const b = pos.length / 3;
    for (const p of pts) pos.push(p.x, y, -p.y);
    for (const t of tris) idx.push(b + t[0], b + t[2], b + t[1]);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** 큰길: 띠 모양 + 차가 다닐 길 목록 */
function roadStrips(list: number[][]) {
  const pos: number[] = [];
  const idx: number[] = [];
  const paths: Array<{ pts: THREE.Vector3[]; len: number[] }> = [];
  for (const r of list) {
    const w = [0, 9, 14, 22][r[0]] ?? 10;
    const pts: THREE.Vector3[] = [];
    for (let k = 1; k + 1 < r.length; k += 2) pts.push(new THREE.Vector3(r[k], 2, -r[k + 1]));
    if (pts.length < 2) continue;
    const len = [0];
    for (let k = 1; k < pts.length; k++) len.push(len[k - 1] + pts[k].distanceTo(pts[k - 1]));
    if (len[len.length - 1] > 300) paths.push({ pts, len });
    for (let k = 0; k + 1 < pts.length; k++) {
      const a = pts[k];
      const c = pts[k + 1];
      const dx = c.x - a.x;
      const dz = c.z - a.z;
      const L = Math.hypot(dx, dz) || 1;
      const nx = (-dz / L) * (w / 2);
      const nz = (dx / L) * (w / 2);
      const b = pos.length / 3;
      pos.push(a.x + nx, 1.8, a.z + nz, a.x - nx, 1.8, a.z - nz, c.x - nx, 1.8, c.z - nz, c.x + nx, 1.8, c.z + nz);
      idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return { g, paths };
}

/** 타워 크레인(노란 기둥 + 팔 + 공사 가림막) */
function makeCrane(): THREE.Group {
  const g = new THREE.Group();
  const y = new THREE.MeshLambertMaterial({ color: '#f2b01e' });
  const mast = new THREE.Mesh(new THREE.BoxGeometry(3, 1, 3), y);
  mast.name = 'mast';
  g.add(mast);
  const jib = new THREE.Mesh(new THREE.BoxGeometry(60, 2.4, 2.4), y);
  jib.name = 'jib';
  jib.position.x = 15;
  g.add(jib);
  const net = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial({ color: '#8fa3b0', transparent: true, opacity: 0.55 }));
  net.name = 'net';
  g.add(net);
  return g;
}

export default function City3D({ file, level, night }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(true);
  const api = useRef<{ setLook: (level: number, night: number) => void } | null>(null);
  const levelRef = useRef(level);
  const nightRef = useRef(night);
  levelRef.current = level;
  nightRef.current = night;

  useEffect(() => {
    const el = box.current!;
    let alive = true;
    let raf = 0;
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    el.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const cam = new THREE.PerspectiveCamera(40, 1, 40, 40000);
    // 처음 보는 자리: 서울은 한강 남쪽 위에서 도심(북쪽)을, 다른 도시는 남쪽 위에서 중심을 바라봄
    const v = START_VIEW[file] ?? { cam: [700, 1500, 3300], at: [0, 0, 300] };
    cam.position.set(...v.cam);
    const ctl = new MapControls(cam, renderer.domElement);
    ctl.target.set(...v.at);
    ctl.enableDamping = true;
    ctl.maxPolarAngle = 1.32;
    ctl.minDistance = 250;
    ctl.maxDistance = 14000;
    ctl.screenSpacePanning = false;
    const hemi = new THREE.HemisphereLight('#ffffff', '#6b7560', 1.2);
    scene.add(hemi);
    const sun = new THREE.DirectionalLight('#fff2dc', 2.2);
    sun.position.set(-3000, 5000, 2000);
    scene.add(sun);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(60000, 60000), new THREE.MeshLambertMaterial({ color: '#a3a49b' }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -1;
    scene.add(ground);
    const tex = windowTextures();
    const wallMat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide, map: tex.day, emissive: '#ffffff', emissiveMap: tex.night, emissiveIntensity: 0 });
    const roofMat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
    const waterMat = new THREE.MeshLambertMaterial({ color: '#3d7aa8', side: THREE.DoubleSide });
    const parkMat = new THREE.MeshLambertMaterial({ color: '#5f8a4a', side: THREE.DoubleSide });
    const roadMat = new THREE.MeshLambertMaterial({ color: '#56595e', side: THREE.DoubleSide });
    const carMat = new THREE.MeshBasicMaterial({ color: '#ffffff' });
    let built: Built | null = null;
    let wallMesh: THREE.Mesh | null = null;
    let roofMesh: THREE.Mesh | null = null;
    const cranes: THREE.Group[] = [];
    let cars: THREE.InstancedMesh | null = null;
    let carState: Array<{ p: number; s: number; at: number; dir: number }> = [];
    let paths: Array<{ pts: THREE.Vector3[]; len: number[] }> = [];
    let carCount = 0;
    let curNight = 0;

    const resize = () => {
      const w = el.clientWidth || 360;
      const h = el.clientHeight || 420;
      renderer.setSize(w, h, false);
      cam.aspect = w / h;
      cam.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(el);

    const setLook = (lv: number, nt: number) => {
      curNight = nt;
      const look = growthLook(lv);
      // 낮밤
      const sky = new THREE.Color('#bcd6ea').lerp(new THREE.Color('#0a1222'), nt);
      scene.background = sky;
      scene.fog = new THREE.Fog(sky, 7000, 22000);
      hemi.intensity = 1.2 - 0.95 * nt;
      sun.intensity = 2.2 - 2.0 * nt;
      sun.color.set(nt > 0.5 ? '#8fa6d8' : '#fff2dc');
      (ground.material as THREE.MeshLambertMaterial).color.set(nt > 0.5 ? '#1c201c' : '#a3a49b');
      roadMat.color.set(nt > 0.5 ? '#2d2f33' : '#56595e');
      wallMat.emissiveIntensity = nt * (0.5 + 0.9 * look.lights);
      wallMat.color.set(nt > 0.5 ? '#6b7280' : '#ffffff');
      roofMat.color.set(nt > 0.5 ? '#4b5563' : '#ffffff');
      carMat.color.set(nt > 0.5 ? '#ffd27a' : '#f4f4f4');
      if (!built || !wallMesh || !roofMesh) return;
      const n = Math.max(1, Math.round(built.order.length * look.show));
      wallMesh.geometry.setDrawRange(0, built.wallEnd[n - 1]);
      roofMesh.geometry.setDrawRange(0, built.roofEnd[n - 1]);
      wallMesh.scale.y = roofMesh.scale.y = look.height;
      // 다음에 지어질 큰 건물 4곳에 크레인
      const next = built.order.slice(n, n + 400).filter((o) => o.h * look.height > 25).slice(0, 4);
      cranes.forEach((c, i) => {
        const o = next[i];
        c.visible = !!o && lv < 6;
        if (!o) return;
        const hh = o.h * look.height;
        c.position.set(o.x, 0, o.z);
        const mast = c.getObjectByName('mast')!;
        mast.scale.y = hh + 30;
        mast.position.set(o.r * 0.6, (hh + 30) / 2, 0);
        const jib = c.getObjectByName('jib')!;
        jib.position.set(o.r * 0.6 + 15, hh + 30, 0);
        const net = c.getObjectByName('net')!;
        net.scale.set(o.r * 1.3, hh * 0.4, o.r * 1.3);
        net.position.y = (hh * 0.4) / 2;
        c.rotation.y = (i * 1.7) % (Math.PI * 2);
      });
      carCount = Math.min(look.cars, cars?.count ?? 0);
      if (cars) cars.count = carCount;
    };
    api.current = { setLook };
    if (import.meta.env.DEV) (window as unknown as { __city3d?: unknown }).__city3d = { cam, ctl, scene };

    loadCity3D(file)
      .then((d) => {
        if (!alive) return;
        built = buildCity(d);
        wallMesh = new THREE.Mesh(built.walls, wallMat);
        roofMesh = new THREE.Mesh(built.roofs, roofMat);
        scene.add(wallMesh, roofMesh);
        const water = new THREE.Mesh(flatShapes(d.w, 2.5), waterMat);
        const parks = new THREE.Mesh(flatShapes(d.p, 1.2), parkMat);
        const rs = roadStrips(d.r);
        const roads = new THREE.Mesh(rs.g, roadMat);
        scene.add(parks, roads, water);
        paths = rs.paths;
        for (let i = 0; i < 4; i++) {
          const c = makeCrane();
          cranes.push(c);
          scene.add(c);
        }
        const MAX = 360;
        cars = new THREE.InstancedMesh(new THREE.BoxGeometry(9, 4, 4.5), carMat, MAX);
        carState = Array.from({ length: MAX }, (_, i) => ({ p: Math.floor(hash(i * 11) * paths.length), s: 0, at: hash(i * 17), dir: hash(i * 23) < 0.5 ? 1 : -1 }));
        for (const c of carState) c.s = c.at * (paths[c.p]?.len.at(-1) ?? 0);
        scene.add(cars);
        setBusy(false);
        api.current?.setLook(levelRef.current, nightRef.current);
      })
      .catch((e) => alive && setErr(String(e)));

    const tmp = new THREE.Object3D();
    let last = performance.now();
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      ctl.update();
      if (cars && paths.length) {
        for (let i = 0; i < carCount; i++) {
          const c = carState[i];
          const path = paths[c.p];
          const total = path.len[path.len.length - 1];
          c.s += c.dir * dt * 45;
          if (c.s > total || c.s < 0) {
            c.dir = -c.dir;
            c.s = Math.max(0, Math.min(total, c.s));
          }
          let k = 1;
          while (k < path.len.length - 1 && path.len[k] < c.s) k++;
          const a = path.pts[k - 1];
          const b = path.pts[k];
          const f = (c.s - path.len[k - 1]) / Math.max(1, path.len[k] - path.len[k - 1]);
          tmp.position.set(a.x + (b.x - a.x) * f, 2.5, a.z + (b.z - a.z) * f);
          tmp.rotation.y = Math.atan2(-(b.z - a.z), b.x - a.x);
          // 차선: 진행 방향 오른쪽으로 살짝
          tmp.translateZ(c.dir * 3);
          tmp.scale.setScalar(curNight > 0.5 ? 1.4 : 1);
          tmp.updateMatrix();
          cars.setMatrixAt(i, tmp.matrix);
        }
        cars.instanceMatrix.needsUpdate = true;
      }
      renderer.render(scene, cam);
    };
    raf = requestAnimationFrame(tick);
    const onVis = () => {
      cancelAnimationFrame(raf);
      if (!document.hidden) raf = requestAnimationFrame(tick);
    };
    document.addEventListener('visibilitychange', onVis);

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      document.removeEventListener('visibilitychange', onVis);
      ro.disconnect();
      ctl.dispose();
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
      });
      [wallMat, roofMat, waterMat, parkMat, roadMat, carMat, tex.day, tex.night].forEach((x) => x.dispose());
      renderer.dispose();
      renderer.domElement.remove();
      api.current = null;
    };
  }, [file]);

  useEffect(() => {
    api.current?.setLook(level, night);
  }, [level, night]);

  return (
    <div className="city3d">
      <div ref={box} className="city3d-canvas" />
      {busy && !err && <div className="city3d-msg">🏗️ 3D 도시 불러오는 중…</div>}
      {err && <div className="city3d-msg">3D 자료를 못 불러왔어요({err}). 2D 화면을 써 주세요.</div>}
      <div className="city3d-credit">건물 자료 © OpenStreetMap 기여자 (ODbL)</div>
    </div>
  );
}
