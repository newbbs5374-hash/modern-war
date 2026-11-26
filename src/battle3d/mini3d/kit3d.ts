// @ts-nocheck
// 3D 미니게임 공통 도구(11-26): 가벼운 장면 하나(빛·카메라·바닥) + 3D 전투와 같은 모형(glb) + 폭발·연기.
// 휴대폰용: 그림자 없음, 화면 배율 최대 1.5, 모형은 한 번 받으면 다시 안 받음.
import * as THREE from 'three128';
import { GLTFLoader } from '../vendor/GLTFLoader.js';

export { THREE };
const BASE = `${import.meta.env.BASE_URL}battle3d/glb/`;

/** 쓰는 모형 이름 → 파일 · 맞출 크기(h=높이, len=긴 쪽) · 앞을 +Z로 돌리는 각도 */
const FILES: Record<string, { f: string; h?: number; len?: number; rot?: number }> = {
  tank: { f: 'Tank', len: 1.35, rot: Math.PI / 2 },
  spg: { f: 'Tank4', len: 1.45, rot: Math.PI / 2 },
  jet: { f: 'Jet', len: 1.9 },
  heli: { f: 'Heli', len: 1.7, rot: -Math.PI / 2 },
  b2s: { f: '2Story_Mat', h: 1.6 },
  b1g: { f: '1Story_GableRoof_Mat', h: 1.15 },
  b3s: { f: '3Story_Small_Mat', h: 2.1 },
  b2w: { f: '2Story_Wide_Mat', h: 1.6 },
  b4: { f: '4Story_Mat', h: 2.7 },
  houseA: { f: 'Building2_Small', h: 1.5 },
  houseB: { f: 'Building3_Small', h: 1.7 },
  tree: { f: 'CommonTree_1', h: 2 },
  tree2: { f: 'CommonTree_3', h: 2 },
  pine: { f: 'PineTree_2', h: 2.4 },
  rock: { f: 'Rock_2', len: 0.55 },
  bush: { f: 'Bush_1', h: 0.5 },
  crate: { f: 'Crate', h: 0.24 },
  barrel: { f: 'Barrel', h: 0.3 },
  tent: { f: 'Tent', len: 1.1 },
  antenna: { f: 'Antenna_1', h: 1.8 },
  container: { f: 'Props_ContainerFull', len: 1.15 },
  boat: { f: 'Boat', len: 0.9 },
  dock: { f: 'Dock_Wide', len: 2.6 },
};
const CACHE: Record<string, THREE.Object3D> = {};
const LOADING: Record<string, Promise<void>> = {};

/** 모형 받기(이미 받은 것은 바로) */
export function loadModels(keys: string[]): Promise<void> {
  const L = new GLTFLoader();
  return Promise.all(
    keys.map((k) => {
      if (CACHE[k] || !FILES[k]) return Promise.resolve();
      if (LOADING[k]) return LOADING[k];
      const fit = FILES[k];
      LOADING[k] = fetch(BASE + fit.f + '.glb')
        .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(0)))
        .then(
          (buf) =>
            new Promise<void>((res) =>
              L.parse(
                buf,
                '',
                (g) => {
                  const o = g.scene;
                  o.traverse((m) => {
                    if (!m.isMesh) return;
                    const mats = Array.isArray(m.material) ? m.material : [m.material];
                    mats.forEach((mt) => {
                      if (mt.color) mt.color.setRGB(Math.min(1, mt.color.r * 1.7 + 0.03), Math.min(1, mt.color.g * 1.7 + 0.03), Math.min(1, mt.color.b * 1.7 + 0.03));
                      mt.metalness = 0;
                      mt.roughness = Math.max(0.7, mt.roughness || 0);
                      mt.flatShading = true;
                      mt.needsUpdate = true;
                    });
                  });
                  const wrap = new THREE.Group();
                  o.rotation.y = fit.rot || 0;
                  wrap.add(o);
                  const sz = new THREE.Box3().setFromObject(wrap).getSize(new THREE.Vector3());
                  o.scale.setScalar(fit.h ? fit.h / sz.y : fit.len! / Math.max(sz.x, sz.z));
                  o.updateMatrixWorld(true);
                  const b2 = new THREE.Box3().setFromObject(wrap);
                  const c = b2.getCenter(new THREE.Vector3());
                  o.position.set(-c.x, -b2.min.y, -c.z);
                  CACHE[k] = wrap;
                  res();
                },
                () => res(),
              ),
            ),
        )
        .catch(() => undefined);
      return LOADING[k];
    }),
  ).then(() => undefined);
}

export const PAL = {
  us: { hull: 0x4d6684, dark: 0x33465d, light: 0x7590ae, cloth: 0x4a5f78 },
  foe: { hull: 0x8f4a3e, dark: 0x5f2f28, light: 0xb26c5c, cloth: 0x83493d },
};
export const M = (c: number, o?: object) => new THREE.MeshStandardMaterial(Object.assign({ color: c, flatShading: true, roughness: 0.85, metalness: 0 }, o || {}));
export const MAT = {
  track: M(0x26292a), metal: M(0x3b3f42), skin: M(0xc9a27e), pants: M(0x3b3f33), vest: M(0x2f3529), black: M(0x1c1e1f), white: M(0xe9ece6),
  road: M(0x4b4842), dirt: M(0x6b5a3e), grass: M(0x5f7a45), sand: M(0xc9b98c), conc: M(0x8a857a), water: M(0x2f6f8f, { roughness: 0.3, transparent: true, opacity: 0.92 }),
  civ: M(0x3f8f5a), civ2: M(0xc9a23e),
};

/** 모형 하나(편 색으로 다시 칠함). 없으면 상자 */
export function model(k: string, side?: 'us' | 'foe'): THREE.Object3D {
  const src = CACHE[k];
  if (!src) {
    const g = new THREE.Group();
    g.add(box(0.8, 0.4, 1.2, side ? M(PAL[side].hull) : MAT.conc, 0, 0.2, 0));
    return g;
  }
  const o = src.clone(true);
  if (!side) return o;
  const P = PAL[side];
  const hull = new THREE.Color(P.hull), dark = new THREE.Color(P.dark), light = new THREE.Color(P.light);
  o.traverse((m) => {
    if (!m.isMesh) return;
    const one = (mt) => {
      const n = mt.clone();
      if (n.color) {
        const l = n.color.getHSL({}).l;
        n.color.copy(l < 0.14 ? MAT.track.color : l < 0.3 ? dark : l < 0.55 ? hull : light);
      }
      return n;
    };
    m.material = Array.isArray(m.material) ? m.material.map(one) : one(m.material);
  });
  return o;
}

export function box(w: number, h: number, d: number, mat: THREE.Material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  return m;
}

/** 병사 한 명(코드 모형). kind: us 우리, foe 적, civ 민간인 */
export function soldier(kind: 'us' | 'foe' | 'civ'): THREE.Group {
  const g = new THREE.Group();
  const cloth = kind === 'civ' ? MAT.civ : M(PAL[kind].cloth);
  const legs = [-0.035, 0.035].map((x) => {
    const pv = new THREE.Group();
    pv.position.set(x, 0.14, 0);
    pv.add(box(0.05, 0.14, 0.06, kind === 'civ' ? MAT.civ2 : MAT.pants, 0, -0.07, 0));
    g.add(pv);
    return pv;
  });
  g.add(box(0.13, 0.15, 0.08, cloth, 0, 0.215, 0));
  if (kind !== 'civ') g.add(box(0.14, 0.1, 0.09, MAT.vest, 0, 0.225, 0.003));
  const h = new THREE.Mesh(new THREE.IcosahedronGeometry(0.055, 0), MAT.skin);
  h.position.y = 0.34;
  g.add(h);
  if (kind !== 'civ') {
    const helm = new THREE.Mesh(new THREE.SphereGeometry(0.068, 7, 4, 0, Math.PI * 2, 0, Math.PI / 2), cloth);
    helm.position.y = 0.35;
    g.add(helm);
    g.add(box(0.025, 0.035, 0.26, MAT.metal, 0.03, 0.23, 0.1));
  }
  g.userData.legs = legs;
  g.scale.setScalar(2.4);
  return g;
}
/** 다리 흔들기(달리는 모습) */
export function walk(g: THREE.Group, t: number, moving: boolean) {
  const legs = g.userData.legs as THREE.Group[] | undefined;
  if (!legs) return;
  const sw = moving ? Math.sin(t * 11) * 0.6 : 0;
  legs[0].rotation.x = sw;
  legs[1].rotation.x = -sw;
}

/** 간단한 구축함(코드 모형) */
export function ship(side: 'us' | 'foe', len = 2.2): THREE.Group {
  const g = new THREE.Group();
  const P = PAL[side];
  const hull = M(P.hull), dark = M(P.dark), light = M(P.light);
  const shape = new THREE.Shape();
  const b = len * 0.18;
  shape.moveTo(0, len / 2);
  shape.quadraticCurveTo(b, len * 0.2, b, -len * 0.1);
  shape.lineTo(b * 0.8, -len / 2);
  shape.lineTo(-b * 0.8, -len / 2);
  shape.lineTo(-b, -len * 0.1);
  shape.quadraticCurveTo(-b, len * 0.2, 0, len / 2);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.22, bevelEnabled: false });
  geo.rotateX(Math.PI / 2);
  const m = new THREE.Mesh(geo, hull);
  m.position.y = 0.22;
  g.add(m, box(b * 1.1, 0.25, len * 0.22, light, 0, 0.32, -len * 0.05), box(b * 0.7, 0.22, len * 0.12, dark, 0, 0.55, -len * 0.08), box(0.05, 0.45, 0.05, dark, 0, 0.75, -len * 0.1));
  g.add(box(0.12, 0.1, 0.18, dark, 0, 0.3, len * 0.28));
  return g;
}

export interface Scene3D {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  /** 화면 좌표 → 바닥(높이 y) 위 점 */
  ground(ev: { clientX: number; clientY: number }, y?: number): THREE.Vector3 | null;
  /** 화면 좌표에서 누른 물체(목록 안에서) */
  hit(ev: { clientX: number; clientY: number }, list: THREE.Object3D[]): THREE.Object3D | null;
  render(): void;
  fx(dt: number): void;
  boom(p: THREE.Vector3, s?: number): void;
  splash(p: THREE.Vector3, s?: number): void;
  smoke(p: THREE.Vector3, s?: number, dark?: boolean): void;
  tracer(a: THREE.Vector3, b: THREE.Vector3, col?: number): void;
  dispose(): void;
}

/** 장면 만들기: el 안에 캔버스를 깔고, 크기를 맞춰 줌 */
export function makeScene(el: HTMLElement, opt: { cam: [number, number, number]; look: [number, number, number]; fov?: number; sky?: number }): Scene3D {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(1.5, window.devicePixelRatio || 1));
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.domElement.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none';
  el.prepend(renderer.domElement);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(opt.sky ?? 0x9fc3d8);
  scene.fog = new THREE.Fog(opt.sky ?? 0x9fc3d8, 30, 70);
  const camera = new THREE.PerspectiveCamera(opt.fov ?? 45, 1, 0.1, 120);
  camera.position.set(...opt.cam);
  camera.lookAt(new THREE.Vector3(...opt.look));
  scene.add(new THREE.HemisphereLight(0xd6ecff, 0x3d3526, 0.75));
  const sun = new THREE.DirectionalLight(0xffe4bc, 1);
  sun.position.set(-11, 22, 8);
  scene.add(sun);
  const size = () => {
    const w = el.clientWidth || 360, h = el.clientHeight || 360;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  size();
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(size) : null;
  ro?.observe(el);
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const pick = (ev) => {
    const r = renderer.domElement.getBoundingClientRect();
    ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
  };
  const fxs: Array<{ o: THREE.Object3D; t: number; life: number; upd: (k: number, dt: number) => void }> = [];
  const add = (o: THREE.Object3D, life: number, upd: (k: number, dt: number) => void) => {
    if (fxs.length > 220) return;
    scene.add(o);
    fxs.push({ o, t: 0, life, upd });
  };
  const sph = new THREE.IcosahedronGeometry(0.3, 1);
  const fireMat = new THREE.MeshBasicMaterial({ color: 0xff8a3a, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const smokeMat = (dark: boolean) => new THREE.MeshBasicMaterial({ color: dark ? 0x3a3530 : 0xd8d4cc, transparent: true, opacity: 0.7, depthWrite: false });
  const api: Scene3D = {
    scene,
    camera,
    renderer,
    ground(ev, y = 0) {
      pick(ev);
      const p = new THREE.Vector3();
      return ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -y), p) ? p : null;
    },
    hit(ev, list) {
      pick(ev);
      const h = ray.intersectObjects(list, true)[0];
      if (!h) return null;
      let o = h.object;
      while (o && !list.includes(o)) o = o.parent;
      return o ?? null;
    },
    render() {
      renderer.render(scene, camera);
    },
    fx(dt) {
      for (let i = fxs.length - 1; i >= 0; i--) {
        const f = fxs[i];
        f.t += dt;
        const k = Math.min(1, f.t / f.life);
        f.upd(k, dt);
        if (k >= 1) {
          scene.remove(f.o);
          fxs.splice(i, 1);
        }
      }
    },
    boom(p, s = 1) {
      for (let i = 0; i < 4; i++) {
        const m = new THREE.Mesh(sph, fireMat.clone());
        m.position.copy(p).add(new THREE.Vector3((Math.random() - 0.5) * 0.5 * s, 0.15 + Math.random() * 0.3 * s, (Math.random() - 0.5) * 0.5 * s));
        const sz = s * (0.8 + Math.random() * 0.6);
        add(m, 0.5, (k) => {
          m.scale.setScalar(sz * (0.6 + k * 1.4));
          m.material.opacity = 1 - k;
          m.position.y += 0.01;
        });
      }
      for (let i = 0; i < 3; i++) api.smoke(p.clone().add(new THREE.Vector3((Math.random() - 0.5) * s, 0.2, (Math.random() - 0.5) * s)), 0.8 * s, true);
    },
    splash(p, s = 1) {
      for (let i = 0; i < 5; i++) {
        const m = new THREE.Mesh(sph, smokeMat(false));
        const vx = (Math.random() - 0.5) * 0.8, vz = (Math.random() - 0.5) * 0.8;
        m.position.copy(p);
        add(m, 0.9, (k, dt) => {
          m.position.x += vx * dt;
          m.position.z += vz * dt;
          m.position.y = p.y + Math.sin(k * Math.PI) * 1.2 * s;
          m.scale.setScalar(0.5 * s + k * 0.6);
          m.material.opacity = 0.8 * (1 - k);
        });
      }
    },
    smoke(p, s = 0.6, dark = false) {
      const m = new THREE.Mesh(sph, smokeMat(dark));
      m.position.copy(p);
      add(m, 1.6, (k, dt) => {
        m.position.y += dt * 0.6;
        m.scale.setScalar(s * (0.5 + k * 1.4));
        m.material.opacity = 0.7 * (1 - k);
      });
    },
    tracer(a, b, col = 0xffd27a) {
      const geo = new THREE.BufferGeometry().setFromPoints([a.clone(), b.clone()]);
      const ln = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: col, transparent: true }));
      add(ln, 0.15, (k) => (ln.material.opacity = 1 - k));
    },
    dispose() {
      ro?.disconnect();
      renderer.dispose();
      renderer.domElement.remove();
      scene.traverse((o) => {
        if (o.isMesh) o.geometry?.dispose?.();
      });
    },
  };
  return api;
}

/** 넓은 바닥(색) */
export function floor(scene: THREE.Scene, mat: THREE.Material, w = 60, d = 60, y = 0) {
  const g = new THREE.PlaneGeometry(w, d);
  g.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(g, mat);
  m.position.y = y;
  scene.add(m);
  return m;
}
