// 11-25 1번안 시험: 3D 전장. 지도 위 전투(battle/field.ts) 계산은 그대로 쓰고, 그리기만 three.js 3D로.
// 전차·보병만 무료 3D 모델(public/models3d, 출처 public/models3d/README.md), 나머지 병과는 지금 그림을 세워서 보여 줌.
// 이 파일은 연습장 "3D 전장(시험)"에서만 불러옴(three.js가 무거워서 따로 나뉨).
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { FIELD_HEX, FIELD_REAL_HALF, FUNIT, FX_LIFE, hasRealField, type FUnit, type FieldBattle } from '../../battle/field';
import { FX_ART, UNIT_ART, fieldArt } from '../fieldArt';

const MODEL_BASE = `${import.meta.env.BASE_URL}models3d/`;
const SAT_BASE = `${import.meta.env.BASE_URL}field-sat/`;
/** 전차 길이·병사 키(지도 단위, 칸 사이 ≈ 24) */
const TANK_LEN = 17;
const SOLDIER_H = 8;
const SIDE_HEX = { me: 0x3b82f6, foe: 0xef4444 };

export interface Field3DProps {
  b: FieldBattle;
  /** 연출 시간 */
  vt: number;
  seen: FUnit[];
  sel: number | null;
  posOf: (u: FUnit) => { x: number; y: number };
  onTap: (cell: number) => void;
  /** 끌어서 옮긴 뒤에는 누른 것으로 치지 않게 */
  dragged: React.MutableRefObject<boolean>;
}

type Models = { tank: THREE.Object3D; soldier: THREE.Object3D; clips: THREE.AnimationClip[] };
let modelsP: Promise<Models> | null = null;
function loadModels(): Promise<Models> {
  if (modelsP) return modelsP;
  const L = new GLTFLoader();
  L.setMeshoptDecoder(MeshoptDecoder);
  modelsP = Promise.all([L.loadAsync(`${MODEL_BASE}tank.glb`), L.loadAsync(`${MODEL_BASE}soldier.glb`)]).then(([t, s]) => {
    // 전차: 길이 TANK_LEN, 바닥이 y=0, 앞(포신)이 +x
    const tank = t.scene;
    const mat = new THREE.MeshStandardMaterial({ color: 0x5b6440, roughness: 0.8, metalness: 0.2, flatShading: true });
    tank.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.material = mat;
        m.castShadow = true;
      }
    });
    normalize(tank, TANK_LEN, 'x');
    const soldier = s.scene;
    soldier.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) m.castShadow = true;
    });
    normalize(soldier, SOLDIER_H, 'y');
    return { tank, soldier, clips: s.animations };
  });
  return modelsP;
}
/** 크기를 맞추고 바닥 가운데를 원점으로 */
function normalize(o: THREE.Object3D, size: number, axis: 'x' | 'y') {
  const box = new THREE.Box3().setFromObject(o);
  const sz = box.getSize(new THREE.Vector3());
  const k = size / (axis === 'x' ? sz.x : sz.y);
  const wrap = new THREE.Group();
  const c = box.getCenter(new THREE.Vector3());
  o.position.set(-c.x * k, -box.min.y * k, -c.z * k);
  o.scale.setScalar(k);
  // 원래 자리 안에서 바꾸기 위해 자식으로 감쌈
  const parent = o.parent;
  wrap.add(o);
  if (parent) parent.add(wrap);
  (o as THREE.Object3D & { __wrap?: THREE.Group }).__wrap = wrap;
}
const wrapOf = (o: THREE.Object3D) => (o as THREE.Object3D & { __wrap?: THREE.Group }).__wrap ?? o;

const texCache = new Map<string, THREE.Texture>();
function tex(url: string): THREE.Texture {
  let t = texCache.get(url);
  if (!t) {
    t = new THREE.TextureLoader().load(url);
    t.colorSpace = THREE.SRGBColorSpace;
    texCache.set(url, t);
  }
  return t;
}

interface Piece {
  g: THREE.Group;
  ring: THREE.Mesh;
  hpBg: THREE.Sprite;
  hp: THREE.Sprite;
  mixers: THREE.AnimationMixer[];
  actions: { idle: THREE.AnimationAction; run: THREE.AnimationAction }[];
  moving: boolean;
  heading: number;
  body: THREE.Object3D;
  air: boolean;
}

export default function Field3D({ b, vt, seen, sel, posOf, onTap, dragged }: Field3DProps) {
  const host = useRef<HTMLDivElement | null>(null);
  const live = useRef({ b, vt, seen, sel, posOf, onTap });
  live.current = { b, vt, seen, sel, posOf, onTap };
  const zoomRef = useRef<(k: number) => void>(() => {});

  useEffect(() => {
    const el = host.current!;
    const f = b.field;
    const w = el.clientWidth;
    const h = el.clientHeight;
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.setSize(w, h);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x9fb3c4);
    scene.fog = new THREE.Fog(0x9fb3c4, 260, 620);
    scene.add(new THREE.HemisphereLight(0xe8f0ff, 0x3a4a2a, 1.1));
    const sun = new THREE.DirectionalLight(0xfff3dd, 2.4);
    sun.position.set(-120, 220, 140);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera as THREE.OrthographicCamera;
    sc.left = -230;
    sc.right = 230;
    sc.top = 230;
    sc.bottom = -230;
    sc.far = 800;
    scene.add(sun);

    // 땅: 위성 사진(도시 둘레 약 41km), 바깥은 바다색
    const H = FIELD_REAL_HALF;
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), new THREE.MeshLambertMaterial({ color: 0x18456a }));
    sea.rotation.x = -Math.PI / 2;
    sea.position.y = -0.3;
    scene.add(sea);
    const groundMat = new THREE.MeshLambertMaterial({ color: 0x55704a });
    if (hasRealField(f.city)) {
      groundMat.map = tex(`${SAT_BASE}${f.city}.webp`);
      groundMat.color.set(0xffffff);
    }
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(H * 2, H * 2), groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // 상륙 거점 깃발
    const flag = fieldArt(FX_ART.landing);
    if (flag) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex(flag), depthWrite: false }));
      s.scale.set(12, 12, 1);
      s.position.set(f.cells[f.landing].x, 7, f.cells[f.landing].y);
      scene.add(s);
    }

    // 카메라: 비스듬히 내려다봄. 끌면 옮기고, 두 손가락·휠로 확대
    const camera = new THREE.PerspectiveCamera(38, w / h, 1, 2000);
    const land = f.cells[f.landing];
    const cam = { tx: land.x * 0.6, tz: land.y * 0.6, dist: 190, pitch: 0.72, yaw: 0 };
    const placeCam = () => {
      cam.dist = Math.max(70, Math.min(480, cam.dist));
      cam.tx = Math.max(-H, Math.min(H, cam.tx));
      cam.tz = Math.max(-H, Math.min(H, cam.tz));
      const ch = Math.cos(cam.pitch);
      camera.position.set(cam.tx + Math.sin(cam.yaw) * cam.dist * ch, cam.dist * Math.sin(cam.pitch), cam.tz + Math.cos(cam.yaw) * cam.dist * ch);
      camera.lookAt(cam.tx, 0, cam.tz);
    };
    placeCam();
    zoomRef.current = (k: number) => {
      cam.dist /= k;
      placeCam();
    };

    const ray = new THREE.Raycaster();
    const groundAt = (cx: number, cy: number) => {
      const r = el.getBoundingClientRect();
      ray.setFromCamera(new THREE.Vector2(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1), camera);
      const hit = ray.intersectObject(sea)[0] ?? null;
      return hit ? hit.point : null;
    };
    const pointers = new Map<number, { x: number; y: number }>();
    let pinch = 0;
    let moved = 0;
    const down = (e: PointerEvent) => {
      if (e.target !== renderer.domElement) return;
      el.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 1) {
        moved = 0;
        dragged.current = false;
      }
      if (pointers.size === 2) {
        const [p1, p2] = [...pointers.values()];
        pinch = Math.hypot(p1.x - p2.x, p1.y - p2.y);
      }
    };
    const move = (e: PointerEvent) => {
      const prev = pointers.get(e.pointerId);
      if (!prev) return;
      const cur = { x: e.clientX, y: e.clientY };
      pointers.set(e.pointerId, cur);
      if (pointers.size >= 2) {
        const [p1, p2] = [...pointers.values()];
        const d = Math.hypot(p1.x - p2.x, p1.y - p2.y);
        if (pinch > 0 && d > 0) zoomRef.current(d / pinch);
        pinch = d;
        dragged.current = true;
        return;
      }
      moved += Math.abs(cur.x - prev.x) + Math.abs(cur.y - prev.y);
      if (moved > 8) dragged.current = true;
      if (!dragged.current) return;
      const a = groundAt(prev.x, prev.y);
      const c = groundAt(cur.x, cur.y);
      if (a && c) {
        cam.tx -= c.x - a.x;
        cam.tz -= c.z - a.z;
        placeCam();
      }
    };
    const up = (e: PointerEvent) => {
      if (!pointers.has(e.pointerId)) return;
      const wasDrag = dragged.current;
      pointers.delete(e.pointerId);
      if (pointers.size < 2) pinch = 0;
      if (pointers.size === 0 && !wasDrag && e.type === 'pointerup') {
        const p = groundAt(e.clientX, e.clientY);
        if (p) {
          // 가장 가까운 칸
          let best = -1;
          let bd = Infinity;
          f.cells.forEach((c, i) => {
            const d = (c.x - p.x) ** 2 + (c.y - p.z) ** 2;
            if (d < bd) {
              bd = d;
              best = i;
            }
          });
          if (best >= 0 && bd < (FIELD_HEX * 1.1) ** 2) live.current.onTap(best);
        }
      }
    };
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      zoomRef.current(e.deltaY < 0 ? 1.15 : 1 / 1.15);
    };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('wheel', wheel, { passive: false });

    // 부대
    const pieces = new Map<number, Piece>();
    let models: Models | null = null;
    loadModels()
      .then((m) => {
        models = m;
        // 모델이 오기 전 세운 그림으로 그린 전차·보병은 다시 만듦
        for (const [id, p] of pieces) {
          const u = live.current.b.units.find((x) => x.id === id);
          if (u && (u.kind === 'tank' || u.kind === 'infantry')) {
            scene.remove(p.g);
            pieces.delete(id);
          }
        }
      })
      .catch(() => {});
    const ringGeo = new THREE.RingGeometry(6.5, 8, 32);
    const makePiece = (u: FUnit): Piece => {
      const g = new THREE.Group();
      const air = FUNIT[u.kind].layer === 'air';
      const mixers: THREE.AnimationMixer[] = [];
      const actions: Piece['actions'] = [];
      let body: THREE.Object3D;
      if (models && u.kind === 'tank') {
        body = wrapOf(models.tank).clone();
      } else if (models && u.kind === 'infantry') {
        // 보병 1개 = 병사 3명
        body = new THREE.Group();
        const spots = [
          [0, -2.5],
          [-3.5, 2.5],
          [3.5, 2.5],
        ];
        for (const [sx, sz] of spots) {
          const s = cloneSkinned(wrapOf(models.soldier)) as THREE.Object3D;
          s.position.set(sx, 0, sz);
          body.add(s);
          const mx = new THREE.AnimationMixer(s);
          const clip = (n: string) => models!.clips.find((c) => c.name === n) ?? models!.clips[0];
          const idle = mx.clipAction(clip('Idle'));
          const run = mx.clipAction(clip('Run'));
          idle.play();
          mx.setTime(Math.random() * 2);
          mixers.push(mx);
          actions.push({ idle, run });
        }
      } else {
        // 다른 병과: 지금 그림을 세워서
        const url = fieldArt(UNIT_ART[u.kind]);
        const big = u.kind === 'carrier' || u.kind === 'cruiser' || u.kind === 'hq';
        const size = air ? 14 : big ? 24 : 16;
        const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: url ? tex(url) : null, color: url ? 0xffffff : SIDE_HEX[u.side] }));
        s.scale.set(size, size, 1);
        s.position.y = size * 0.42;
        body = s;
      }
      g.add(body);
      const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: SIDE_HEX[u.side], transparent: true, opacity: 0.85, depthWrite: false }));
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.4;
      g.add(ring);
      const hpBg = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0x000000, opacity: 0.6, transparent: true, depthTest: false }));
      hpBg.center.set(0, 0.5);
      hpBg.scale.set(12, 1.3, 1);
      const hp = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0x22c55e, depthTest: false }));
      hp.center.set(0, 0.5);
      hp.scale.set(12, 1.3, 1);
      hpBg.renderOrder = 10;
      hp.renderOrder = 11;
      g.add(hpBg, hp);
      scene.add(g);
      return { g, ring, hpBg, hp, mixers, actions, moving: false, heading: u.side === 'me' ? 0 : Math.PI, body, air };
    };

    // 효과: 폭발·포구 불꽃은 그림 판, 탄은 빛나는 선
    const fxGroup = new THREE.Group();
    scene.add(fxGroup);
    const boomUrl = fieldArt(FX_ART.explosion);
    const boomMat = boomUrl ? new THREE.SpriteMaterial({ map: tex(boomUrl), transparent: true, depthWrite: false }) : null;
    const tracerMat = new THREE.LineBasicMaterial({ color: 0xffe08a });

    const clock = new THREE.Clock();
    let raf = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.1, clock.getDelta());
      const { b: cur, vt: t, seen: sn, sel: s, posOf: pos } = live.current;
      const alive = new Set<number>();
      for (const u of sn) {
        alive.add(u.id);
        let p = pieces.get(u.id);
        if (!p) {
          p = makePiece(u);
          pieces.set(u.id, p);
        }
        const at = pos(u);
        const air = p.air;
        p.g.position.set(at.x, air ? 26 : 0, at.y);
        // 가는 쪽을 보게(부드럽게 돌기)
        const moving = u.path.length > 0;
        if (moving) {
          const n = cur.field.cells[u.path[0]];
          const want = Math.atan2(-(n.y - at.y), n.x - at.x);
          let d = want - p.heading;
          while (d > Math.PI) d -= Math.PI * 2;
          while (d < -Math.PI) d += Math.PI * 2;
          p.heading += d * Math.min(1, dt * 5);
        }
        if (!(p.body instanceof THREE.Sprite)) {
          // 전차 앞 = +x, 병사 앞 = +z
          p.body.rotation.y = u.kind === 'infantry' ? p.heading + Math.PI / 2 : p.heading;
        }
        if (moving !== p.moving) {
          p.moving = moving;
          for (const a of p.actions) {
            const [from, to] = moving ? [a.idle, a.run] : [a.run, a.idle];
            to.reset().play();
            from.crossFadeTo(to, 0.25, false);
          }
        }
        for (const mx of p.mixers) mx.update(dt);
        // 고른 부대는 노란 고리, 맞으면 하얗게 번쩍
        const hit = u.hitAt !== undefined ? t - u.hitAt : 9;
        (p.ring.material as THREE.MeshBasicMaterial).color.set(hit < 0.2 ? 0xffffff : u.id === s ? 0xfde047 : SIDE_HEX[u.side]);
        p.ring.scale.setScalar(u.id === s ? 1.25 : 1);
        p.ring.position.y = air ? -25.5 : 0.4;
        const top = u.kind === 'tank' || u.kind === 'infantry' ? 10 : p.body instanceof THREE.Sprite ? p.body.scale.y * 0.9 : 10;
        p.hpBg.position.set(-6, top, 0);
        p.hp.position.set(-6, top, 0);
        const r = Math.max(0, u.hp) / u.maxHp;
        p.hp.scale.x = 12 * r;
        (p.hp.material as THREE.SpriteMaterial).color.set(r > 0.5 ? 0x22c55e : r > 0.25 ? 0xf59e0b : 0xef4444);
      }
      for (const [id, p] of pieces)
        if (!alive.has(id)) {
          scene.remove(p.g);
          pieces.delete(id);
        }
      // 효과 다시 그림
      fxGroup.clear();
      const cell = (i: number, airAt: boolean) => new THREE.Vector3(cur.field.cells[i].x, airAt ? 26 : 4, cur.field.cells[i].y);
      for (const x of cur.fx) {
        const age = t - x.t;
        if (age < 0 || age > FX_LIFE[x.kind]) continue;
        if (x.kind === 'shot' && age < 0.35) {
          const a = cell(x.from, x.by !== undefined && FUNIT[x.by].layer === 'air');
          const c = cell(x.to, x.at === 'air');
          const k = Math.min(1, age / 0.3);
          const mid = a.clone().lerp(c, k);
          const tail = a.clone().lerp(c, Math.max(0, k - 0.25));
          if (x.by === 'artillery') {
            mid.y += Math.sin(k * Math.PI) * 30;
            tail.y += Math.sin(Math.max(0, k - 0.25) * Math.PI) * 30;
          }
          fxGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([tail, mid]), tracerMat));
        }
        if ((x.kind === 'boom' || x.kind === 'wreck') && boomMat && age < 0.9) {
          const sp = new THREE.Sprite(boomMat.clone());
          const big = x.kind === 'wreck' || x.big;
          const size = (big ? 26 : 14) * (0.5 + age);
          sp.scale.set(size, size, 1);
          sp.material.opacity = 1 - age / 0.9;
          sp.position.copy(cell(x.to, x.at === 'air')).add(new THREE.Vector3(0, size * 0.35, 0));
          fxGroup.add(sp);
        }
      }
      renderer.render(scene, camera);
    };
    loop();

    const onResize = () => {
      const w2 = el.clientWidth;
      const h2 = el.clientHeight;
      renderer.setSize(w2, h2);
      camera.aspect = w2 / h2;
      camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(onResize);
    ro.observe(el);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
      el.removeEventListener('wheel', wheel);
      renderer.dispose();
      el.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <div className="field-3d" ref={host}>
      <div className="field-zoom">
        <button onClick={() => zoomRef.current(1.4)} aria-label="확대">
          ＋
        </button>
        <button onClick={() => zoomRef.current(1 / 1.4)} aria-label="축소">
          －
        </button>
      </div>
      <p className="field-3d-credit">전차 모델: Jeyhun1985 · CC BY 4.0 / 병사: three.js 예제(Mixamo)</p>
    </div>
  );
}
