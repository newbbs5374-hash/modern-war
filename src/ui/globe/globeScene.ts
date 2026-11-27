// 입체 지구본(11/27 종합 확장안 세계 1). NASA 위성 사진을 둥근 지구에 입히고,
// 실제 시각의 낮·밤(밤인 쪽은 도시 불빛), 나라 경계 빛, 도시 점, 전쟁·연합 곡선, 날아가는 미사일을 그림.
// three.js 는 지구본을 열 때만 받음(Globe.tsx 가 이 파일을 늦게 불러옴).
import * as THREE from 'three';

export interface GlobeCity {
  id: string;
  name: string;
  lon: number;
  lat: number;
  color: string;
  capital: boolean;
  mine: boolean;
  /** 공격받는 중(붉게 깜빡임) */
  hot: boolean;
  /** 이름표를 붙일지 */
  label: boolean;
}
export interface GlobeArc {
  a: [number, number];
  b: [number, number];
  kind: 'war' | 'ally' | 'strike';
}
export interface GlobeUnit {
  /** 맴도는 중심 */
  at: [number, number];
  icon: string;
  /** 전쟁 상대 쪽(있으면 그쪽으로 치우쳐 맴돎) */
  to?: [number, number];
}
export interface GlobeData {
  cities: GlobeCity[];
  /** 나라 테두리: 지도 좌표(GEO, 1도 = px칸) path 와 색 */
  outlines: Array<{ d: string; color: string; bold?: boolean }>;
  /** 가는 국경선(지도 좌표 path) */
  borders?: string;
  arcs: GlobeArc[];
  units: GlobeUnit[];
  geo: { L0: number; B1: number; PX: number };
}

const RAD = Math.PI / 180;
/** 경도·위도 → 반지름 r 구 위의 점(three SphereGeometry 의 UV 와 맞춤: u=0 이 경도 -180) */
export function ll(lon: number, lat: number, r = 1): THREE.Vector3 {
  const phi = (lon + 180) * RAD;
  const th = (90 - lat) * RAD;
  return new THREE.Vector3(-r * Math.cos(phi) * Math.sin(th), r * Math.cos(th), r * Math.sin(phi) * Math.sin(th));
}
function toLL(v: THREE.Vector3): [number, number] {
  const n = v.clone().normalize();
  const lat = 90 - Math.acos(n.y) / RAD;
  let lon = Math.atan2(n.z, -n.x) / RAD - 180;
  if (lon < -180) lon += 360;
  return [lon, lat];
}
/** 지금 해가 머리 위에 있는 곳 */
export function sunLL(d: Date): [number, number] {
  const start = Date.UTC(d.getUTCFullYear(), 0, 0);
  const doy = (d.getTime() - start) / 86_400_000;
  const decl = -23.44 * Math.cos(((2 * Math.PI) / 365) * (doy + 10));
  const utcH = d.getUTCHours() + d.getUTCMinutes() / 60;
  return [-(utcH - 12) * 15, decl];
}
const angDeg = (a: [number, number], b: [number, number]) => ll(a[0], a[1]).angleTo(ll(b[0], b[1])) / RAD;

function dotTex(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  g.beginPath();
  g.arc(32, 32, 22, 0, 7);
  g.fillStyle = '#fff';
  g.fill();
  g.lineWidth = 7;
  g.strokeStyle = 'rgba(8,14,22,.9)';
  g.stroke();
  return new THREE.CanvasTexture(c);
}
function ringTex(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  g.beginPath();
  g.arc(32, 32, 26, 0, 7);
  g.lineWidth = 5;
  g.strokeStyle = '#fff';
  g.stroke();
  return new THREE.CanvasTexture(c);
}
function glowTex(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.35, 'rgba(255,255,255,.55)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}
function textTex(text: string, color: string, big: boolean): { tex: THREE.Texture; w: number; h: number } {
  const c = document.createElement('canvas');
  const g = c.getContext('2d')!;
  const px = big ? 44 : 36;
  const font = `${big ? 800 : 700} ${px}px system-ui, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif`;
  g.font = font;
  const w = Math.ceil(g.measureText(text).width) + 24;
  c.width = w;
  c.height = px + 20;
  g.font = font;
  g.textBaseline = 'middle';
  g.lineJoin = 'round';
  g.lineWidth = 9;
  g.strokeStyle = 'rgba(6,12,20,.92)';
  g.strokeText(text, 12, c.height / 2);
  g.fillStyle = color;
  g.fillText(text, 12, c.height / 2);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return { tex, w: c.width, h: c.height };
}
function iconTex(icon: string): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  g.font = '44px system-ui, "Apple Color Emoji", "Noto Color Emoji", sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(icon, 32, 36);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const EARTH_VS = `
varying vec2 vUv; varying vec3 vN; varying vec3 vP;
void main(){ vUv = uv; vN = normalize(position); vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`;
const EARTH_FS = `
uniform sampler2D day; uniform sampler2D night; uniform sampler2D over; uniform vec3 sun; uniform vec3 cam;
varying vec2 vUv; varying vec3 vN; varying vec3 vP;
void main(){
  vec3 d = texture2D(day, vUv).rgb;
  vec3 n = texture2D(night, vUv).rgb;
  vec4 o = texture2D(over, vUv);
  float s = dot(vN, sun);
  float k = smoothstep(-0.12, 0.22, s);
  vec3 dark = d * vec3(0.20, 0.25, 0.36);
  vec3 col = mix(dark, d * (0.82 + 0.3 * max(s, 0.0)), k);
  float lights = max(n.r, max(n.g, n.b));
  col += vec3(1.0, 0.82, 0.5) * pow(lights, 1.5) * 1.5 * (1.0 - k);
  // 해 지는 띠
  col += vec3(0.9, 0.42, 0.15) * 0.10 * (1.0 - abs(k * 2.0 - 1.0));
  // 바다에 비치는 햇빛
  vec3 v = normalize(cam - vP);
  float sea = step(d.r + d.g, d.b * 1.55);
  float spec = pow(max(dot(reflect(-sun, vN), v), 0.0), 60.0);
  col += vec3(1.0, 0.95, 0.8) * spec * 0.22 * sea * k;
  col = mix(col, o.rgb, o.a * 0.85);
  float f = pow(1.0 - max(dot(vN, v), 0.0), 2.6);
  col += vec3(0.32, 0.6, 1.0) * f * (0.35 + 0.45 * k);
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`;
const AIR_FS = `
uniform vec3 sun; uniform vec3 cam; varying vec3 vN; varying vec3 vP;
void main(){
  vec3 v = normalize(cam - vP);
  float f = pow(max(0.0, 0.72 - dot(-vN, v)), 3.0);
  float k = 0.35 + 0.65 * smoothstep(-0.3, 0.4, dot(vN, sun));
  gl_FragColor = vec4(vec3(0.3, 0.6, 1.0) * f * 2.4 * k, f * k);
}`;

export function makeGlobe(el: HTMLElement, base: string, onPick: (cityId: string | null) => void) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.setClearColor(0x03060c);
  const cv = renderer.domElement;
  cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none';
  el.appendChild(cv);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.05, 200);

  // ── 지구 ──
  const loader = new THREE.TextureLoader();
  const small = Math.min(window.innerWidth, window.innerHeight) < 520 && (window.devicePixelRatio || 1) < 2.5;
  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  const prep = (t: THREE.Texture) => {
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = Math.min(8, maxAniso);
    t.wrapS = THREE.RepeatWrapping;
    return t;
  };
  const black = new THREE.DataTexture(new Uint8Array([0, 0, 0, 0]), 1, 1);
  black.needsUpdate = true;
  const uni = {
    day: { value: prep(loader.load(base + (small ? 'day-s.webp' : 'day.webp'))) as THREE.Texture },
    night: { value: prep(loader.load(base + 'night.webp')) as THREE.Texture },
    over: { value: black as THREE.Texture },
    sun: { value: new THREE.Vector3(1, 0, 0) },
    cam: { value: new THREE.Vector3() },
  };
  const earth = new THREE.Mesh(
    new THREE.SphereGeometry(1, 96, 64),
    new THREE.ShaderMaterial({ uniforms: uni, vertexShader: EARTH_VS, fragmentShader: EARTH_FS }),
  );
  scene.add(earth);
  const air = new THREE.Mesh(
    new THREE.SphereGeometry(1.16, 64, 48),
    new THREE.ShaderMaterial({
      uniforms: { sun: uni.sun, cam: uni.cam },
      vertexShader: EARTH_VS,
      fragmentShader: AIR_FS,
      side: THREE.BackSide,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  scene.add(air);
  // 한국 둘레 고해상 땅(확대해도 흐리지 않게, "한국 먼저"). 경도 118~136, 위도 28~46
  const patchTex = prep(loader.load(base + 'kr.webp'));
  patchTex.wrapS = THREE.ClampToEdgeWrapping;
  const patch = new THREE.Mesh(
    new THREE.SphereGeometry(1.0006, 48, 48, (118 + 180) * RAD, 18 * RAD, (90 - 46) * RAD, 18 * RAD),
    new THREE.ShaderMaterial({
      uniforms: { map: { value: patchTex }, sun: uni.sun, near: { value: 0 } },
      vertexShader: EARTH_VS,
      fragmentShader: `
uniform sampler2D map; uniform vec3 sun; uniform float near; varying vec2 vUv; varying vec3 vN;
void main(){
  vec4 t = texture2D(map, vUv);
  float k = smoothstep(-0.12, 0.22, dot(vN, sun));
  vec3 col = mix(t.rgb * vec3(0.22, 0.27, 0.38), t.rgb * 1.02, k);
  gl_FragColor = vec4(col, t.a * near * (0.45 + 0.55 * k));
  #include <colorspace_fragment>
}`,
      transparent: true,
      depthWrite: false,
    }),
  );
  patch.renderOrder = 1;
  scene.add(patch);
  // 별
  {
    const N = 1400;
    const p = new Float32Array(N * 3);
    let s = 7;
    const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < N; i++) {
      const u = r() * 2 - 1;
      const a = r() * Math.PI * 2;
      const q = Math.sqrt(1 - u * u);
      p.set([q * Math.cos(a) * 60, u * 60, q * Math.sin(a) * 60], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0xbcd0ff, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0.75 })));
  }

  // ── 덧그림(나라 경계 빛) ──
  const OW = small ? 2048 : 4096;
  const oc = document.createElement('canvas');
  oc.width = OW;
  oc.height = OW / 2;
  const overTex = new THREE.CanvasTexture(oc);
  overTex.colorSpace = THREE.SRGBColorSpace;
  overTex.anisotropy = Math.min(8, maxAniso);
  function drawOver(d: GlobeData) {
    const g = oc.getContext('2d')!;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, oc.width, oc.height);
    const sx = OW / (360 * d.geo.PX);
    const tx = ((d.geo.L0 + 180) / 360) * OW;
    const ty = ((90 - d.geo.B1) / 180) * (OW / 2);
    for (const off of [0, -OW]) {
      g.setTransform(sx, 0, 0, sx, tx + off, ty);
      g.lineJoin = 'round';
      if (d.borders) {
        g.strokeStyle = 'rgba(235,245,255,.34)';
        g.lineWidth = 0.9 / sx;
        g.stroke(new Path2D(d.borders));
      }
      for (const o of d.outlines) {
        const p = new Path2D(o.d);
        g.globalAlpha = 0.07;
        g.fillStyle = o.color;
        g.fill(p);
        g.globalAlpha = 0.3;
        g.strokeStyle = o.color;
        g.lineWidth = (o.bold ? 6 : 4.5) / sx;
        g.stroke(p);
        g.globalAlpha = 0.95;
        g.lineWidth = (o.bold ? 2 : 1.3) / sx;
        g.stroke(p);
        g.globalAlpha = 1;
      }
    }
    overTex.needsUpdate = true;
    uni.over.value = overTex;
  }

  // ── 도시·곡선·부대 ──
  const marks = new THREE.Group();
  scene.add(marks);
  const TDOT = dotTex();
  const TRING = ringTex();
  const TGLOW = glowTex();
  const own: THREE.Texture[] = [];
  let cities: GlobeCity[] = [];
  let hots: THREE.Sprite[] = [];
  let dots: Array<{ s: THREE.Sprite; z: number }> = [];
  let labels: Array<{ s: THREE.Sprite; w: number; h: number; cap: boolean; pri: number; n: THREE.Vector3 }> = [];
  let pulses: Array<{ s: THREE.Sprite; curve: THREE.Curve<THREE.Vector3>; t: number; v: number }> = [];
  let units: Array<{ s: THREE.Sprite; c: THREE.Vector3; ax: THREE.Vector3; r: number; ph: number; v: number }> = [];
  function clearMarks() {
    for (const o of [...marks.children]) {
      marks.remove(o);
      const m = o as THREE.Mesh;
      if (m.geometry && (m as unknown as { isMesh?: boolean }).isMesh) m.geometry.dispose();
      const mat = (m.material ?? null) as THREE.Material | null;
      mat?.dispose();
    }
    for (const t of own) t.dispose();
    own.length = 0;
    hots = [];
    dots = [];
    labels = [];
    pulses = [];
    units = [];
  }
  function arcCurve(a: [number, number], b: [number, number]) {
    const va = ll(a[0], a[1]);
    const vb = ll(b[0], b[1]);
    const ang = va.angleTo(vb);
    const h = 0.02 + Math.min(ang, 1.2) * 0.08;
    const pts: THREE.Vector3[] = [];
    const N = 40;
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      const p = va.clone().lerp(vb, t).normalize();
      // 구면 보간(작은 각도에서도 고르게)
      if (ang > 0.01) {
        const sa = Math.sin((1 - t) * ang) / Math.sin(ang);
        const sb = Math.sin(t * ang) / Math.sin(ang);
        p.copy(va).multiplyScalar(sa).addScaledVector(vb, sb).normalize();
      }
      pts.push(p.multiplyScalar(1.006 + h * Math.sin(Math.PI * t)));
    }
    return new THREE.CatmullRomCurve3(pts);
  }
  function setData(d: GlobeData) {
    drawOver(d);
    clearMarks();
    cities = d.cities;
    for (const c of d.cities) {
      const p = ll(c.lon, c.lat, 1.004);
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: TDOT, color: c.color, sizeAttenuation: false, depthTest: false, depthWrite: false }));
      const z = c.capital ? 0.03 : c.mine ? 0.022 : 0.017;
      s.position.copy(p);
      s.renderOrder = 3;
      marks.add(s);
      dots.push({ s, z });
      if (c.hot) {
        const r = new THREE.Sprite(new THREE.SpriteMaterial({ map: TRING, color: 0xff4a3a, sizeAttenuation: false, depthTest: false, depthWrite: false, transparent: true }));
        r.position.copy(p);
        r.renderOrder = 4;
        marks.add(r);
        hots.push(r);
      }
      if (c.label) {
        const t = textTex(c.name, c.mine ? '#fff3b0' : '#f1f6ff', c.capital);
        own.push(t.tex);
        const l = new THREE.Sprite(new THREE.SpriteMaterial({ map: t.tex, sizeAttenuation: false, depthTest: false, depthWrite: false, transparent: true }));
        l.center.set(0.5, -0.55);
        l.position.copy(p);
        l.renderOrder = 5;
        marks.add(l);
        labels.push({ s: l, w: t.w, h: t.h, cap: c.capital, pri: (c.mine ? 2 : 0) + (c.capital ? 1 : 0), n: p.clone().normalize() });
      }
    }
    labels.sort((a, b) => b.pri - a.pri);
    for (const a of d.arcs) {
      const curve = arcCurve(a.a, a.b);
      const war = a.kind !== 'ally';
      const strike = a.kind === 'strike';
      const col = strike ? 0xffa23a : war ? 0xff4636 : 0x53a8ff;
      const core = new THREE.Mesh(
        new THREE.TubeGeometry(curve, 48, strike ? 0.0014 : war ? 0.0022 : 0.0015, 6, false),
        new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: war ? 0.95 : 0.7, blending: THREE.AdditiveBlending, depthWrite: false }),
      );
      const halo = new THREE.Mesh(
        new THREE.TubeGeometry(curve, 48, strike ? 0.004 : war ? 0.007 : 0.005, 6, false),
        new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false }),
      );
      marks.add(core, halo);
      const n = war ? 2 : 1;
      for (let i = 0; i < n; i++) {
        const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: TGLOW, color: war ? 0xffc27a : 0xbfe0ff, sizeAttenuation: false, depthTest: false, depthWrite: false, transparent: true, blending: THREE.AdditiveBlending }));
        const z = war ? 0.03 : 0.02;
        s.scale.set(z, z, 1);
        s.renderOrder = 6;
        marks.add(s);
        pulses.push({ s, curve, t: i / n, v: (strike ? 0.5 : war ? 0.3 : 0.14) / Math.max(0.35, angDeg(a.a, a.b) / 60) });
      }
    }
    d.units.forEach((u, i) => {
      const tex = iconTex(u.icon);
      own.push(tex);
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, sizeAttenuation: false, depthTest: false, depthWrite: false, transparent: true }));
      s.scale.set(0.034, 0.034, 1);
      s.renderOrder = 2;
      marks.add(s);
      let c = ll(u.at[0], u.at[1]);
      if (u.to) c = c.lerp(ll(u.to[0], u.to[1]), 0.28).normalize();
      const ax = c.clone().cross(new THREE.Vector3(0.3, 1, 0.2)).normalize();
      units.push({ s, c, ax, r: (3 + (i % 3) * 1.6) * RAD, ph: i * 2.1, v: 0.12 + (i % 4) * 0.03 });
    });
  }

  // ── 보는 자리 ──
  const view = { lon: 127, lat: 30, dist: 2.9, vx: 0, vy: 0 };
  let fly: { lon: number; lat: number; dist: number } | null = null;
  const DMIN = 1.36;
  const DMAX = 4.6;
  function size() {
    const w = el.clientWidth;
    const h = el.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // 세로 화면에서도 지구가 다 보이게
    camera.fov = w < h ? Math.min(62, 38 * (h / w) * 0.9) : 38;
    camera.updateProjectionMatrix();
  }
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(size) : null;
  ro?.observe(el);
  size();

  const ptr = new Map<number, { x: number; y: number }>();
  let down = { x: 0, y: 0, t: 0, moved: false };
  let pinch = 0;
  let touched = false;
  const onDown = (e: PointerEvent) => {
    cv.setPointerCapture?.(e.pointerId);
    ptr.set(e.pointerId, { x: e.clientX, y: e.clientY });
    touched = true;
    fly = null;
    if (ptr.size === 1) down = { x: e.clientX, y: e.clientY, t: performance.now(), moved: false };
    if (ptr.size === 2) {
      const [a, b] = [...ptr.values()];
      pinch = Math.hypot(a.x - b.x, a.y - b.y);
    }
  };
  const onMove = (e: PointerEvent) => {
    const p = ptr.get(e.pointerId);
    if (!p) return;
    const dx = e.clientX - p.x;
    const dy = e.clientY - p.y;
    p.x = e.clientX;
    p.y = e.clientY;
    if (ptr.size === 1) {
      if (Math.hypot(e.clientX - down.x, e.clientY - down.y) > 7) down.moved = true;
      const k = (0.42 * (view.dist - 1)) / Math.max(1, el.clientHeight / 400);
      view.vx = -dx * k;
      view.vy = dy * k;
      view.lon += view.vx;
      view.lat = Math.max(-80, Math.min(80, view.lat + view.vy));
    } else if (ptr.size === 2) {
      const [a, b] = [...ptr.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinch > 0 && d > 0) view.dist = Math.max(DMIN, Math.min(DMAX, 1 + ((view.dist - 1) * pinch) / d));
      pinch = d;
      down.moved = true;
    }
  };
  const ray = new THREE.Raycaster();
  const onUp = (e: PointerEvent) => {
    const had = ptr.delete(e.pointerId);
    if (!had) return;
    if (ptr.size > 0 || down.moved || performance.now() - down.t > 450) return;
    view.vx = view.vy = 0;
    const r = cv.getBoundingClientRect();
    ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera);
    const hit = new THREE.Vector3();
    if (!ray.ray.intersectSphere(new THREE.Sphere(new THREE.Vector3(), 1), hit)) return onPick(null);
    const at = toLL(hit);
    let best: GlobeCity | null = null;
    let bd = 2.2 + (view.dist - 1) * 2.4;
    for (const c of cities) {
      const d = angDeg(at, [c.lon, c.lat]);
      if (d < bd) {
        bd = d;
        best = c;
      }
    }
    onPick(best ? best.id : null);
  };
  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    touched = true;
    fly = null;
    view.dist = Math.max(DMIN, Math.min(DMAX, 1 + (view.dist - 1) * Math.exp(e.deltaY * 0.0012)));
  };
  cv.addEventListener('pointerdown', onDown);
  cv.addEventListener('pointermove', onMove);
  cv.addEventListener('pointerup', onUp);
  cv.addEventListener('pointercancel', onUp);
  cv.addEventListener('wheel', onWheel, { passive: false });

  // 11-27 지도 움직임 끄기: 끄면 비행기·공격선 불빛을 숨기고, 깜빡임·자동 회전을 멈춤
  let moving = true;
  let raf = 0;
  let last = performance.now();
  let clock = 0;
  let sunAt = 0;
  let seen = true;
  const io = typeof IntersectionObserver !== 'undefined' ? new IntersectionObserver((es) => (seen = es[0].isIntersecting)) : null;
  io?.observe(el);
  function frame(now: number) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!seen || document.hidden) return;
    clock += dt;
    if (now - sunAt > 30_000 || sunAt === 0) {
      sunAt = now;
      const [slon, slat] = sunLL(new Date());
      uni.sun.value.copy(ll(slon, slat));
    }
    if (fly) {
      const k = 1 - Math.exp(-dt * 4);
      let dl = fly.lon - view.lon;
      dl = ((((dl + 180) % 360) + 360) % 360) - 180;
      view.lon += dl * k;
      view.lat += (fly.lat - view.lat) * k;
      view.dist += (fly.dist - view.dist) * k;
      if (Math.abs(dl) < 0.05 && Math.abs(fly.lat - view.lat) < 0.05 && Math.abs(fly.dist - view.dist) < 0.005) fly = null;
    } else if (ptr.size === 0) {
      // 놓은 뒤 미끄러짐, 손대기 전엔 천천히 돎
      view.lon += view.vx;
      view.lat = Math.max(-80, Math.min(80, view.lat + view.vy));
      view.vx *= 0.92;
      view.vy *= 0.92;
      if (!touched && moving) view.lon += dt * 1.2;
    }
    camera.position.copy(ll(view.lon, view.lat, view.dist));
    camera.lookAt(0, 0, 0);
    uni.cam.value.copy(camera.position);
    // 가까이 볼 때만 고해상 땅을 서서히 겹침
    (patch.material as THREE.ShaderMaterial).uniforms.near.value = Math.max(0, Math.min(1, (2.3 - view.dist) / 0.5));
    // 이름표: 화면 크기에 맞춰 일정한 크기, 멀면 수도만
    const lk = 0.00056 * Math.max(0.8, Math.min(1.25, 420 / Math.max(1, el.clientHeight)));
    const cn = camera.position.clone().normalize();
    const hz = 1 / view.dist;
    const seenAt = (v: THREE.Vector3) => v.dot(cn) / v.length() > hz - 0.02;
    const zk = Math.max(0.55, Math.min(1.15, 2.4 / view.dist));
    for (const d of dots) {
      d.s.visible = seenAt(d.s.position);
      d.s.scale.set(d.z * zk, d.z * zk, 1);
    }
    const taken: Array<[number, number, number, number]> = [];
    const pv = new THREE.Vector3();
    for (const l of labels) {
      // 지구 가장자리·뒤쪽은 숨기고, 겹치면 중요한 것(내 수도 → 내 도시 → 다른 수도)만 남김
      let on = (l.cap || view.dist < 2.1) && l.n.dot(cn) > 1 / view.dist + 0.12;
      if (on) {
        pv.copy(l.s.position).project(camera);
        const hw = (l.w * lk) / camera.aspect * 0.5 * (1 / Math.tan((camera.fov * RAD) / 2));
        const hh = l.h * lk * 0.5 * (1 / Math.tan((camera.fov * RAD) / 2));
        const box: [number, number, number, number] = [pv.x - hw, pv.y + hh * 0.6, pv.x + hw, pv.y + hh * 2.6];
        if (taken.some((t) => box[0] < t[2] && box[2] > t[0] && box[1] < t[3] && box[3] > t[1])) on = false;
        else taken.push(box);
      }
      l.s.visible = on;
      l.s.scale.set(l.w * lk, l.h * lk, 1);
    }
    for (const h of hots) {
      const t = moving ? (clock * 1.1) % 1 : 0.35;
      const z = 0.03 + t * 0.05;
      h.visible = seenAt(h.position);
      h.scale.set(z, z, 1);
      (h.material as THREE.SpriteMaterial).opacity = 1 - t;
    }
    for (const p of pulses) {
      p.t = (p.t + dt * p.v) % 1;
      p.s.position.copy(p.curve.getPoint(p.t));
      p.s.visible = moving && seenAt(p.s.position);
    }
    for (const u of units) {
      const a = clock * u.v + u.ph;
      const q = new THREE.Quaternion().setFromAxisAngle(u.ax, u.r);
      const p = u.c.clone().applyQuaternion(q).applyAxisAngle(u.c, a);
      u.s.position.copy(p.multiplyScalar(1.02));
      u.s.visible = moving && seenAt(u.s.position);
    }
    renderer.render(scene, camera);
  }
  raf = requestAnimationFrame(frame);

  return {
    set: setData,
    /** 움직이는 연출 켜고 끄기 */
    motion(on: boolean) {
      moving = on;
    },
    /** 그 자리로 부드럽게 돌림 */
    focus(lon: number, lat: number, dist?: number, jump?: boolean) {
      if (jump) {
        view.lon = lon;
        view.lat = lat;
        if (dist) view.dist = dist;
        return;
      }
      fly = { lon, lat: Math.max(-80, Math.min(80, lat)), dist: dist ?? view.dist };
      view.vx = view.vy = 0;
      touched = true;
    },
    zoom(f: number) {
      touched = true;
      fly = { lon: view.lon, lat: view.lat, dist: Math.max(DMIN, Math.min(DMAX, 1 + (view.dist - 1) * f)) };
    },
    dispose() {
      cancelAnimationFrame(raf);
      ro?.disconnect();
      io?.disconnect();
      cv.removeEventListener('pointerdown', onDown);
      cv.removeEventListener('pointermove', onMove);
      cv.removeEventListener('pointerup', onUp);
      cv.removeEventListener('pointercancel', onUp);
      cv.removeEventListener('wheel', onWheel);
      clearMarks();
      [TDOT, TRING, TGLOW, overTex, patchTex, uni.day.value, uni.night.value].forEach((t) => t.dispose());
      earth.geometry.dispose();
      patch.geometry.dispose();
      air.geometry.dispose();
      renderer.dispose();
      cv.remove();
    },
  };
}
export type GlobeHandle = ReturnType<typeof makeGlobe>;
