// @ts-nocheck
// 11-27 한 손가락 미니 훈련(2차 ①) — "톡" 12개. 틀 하나(때맞춰 누르기)에 3D 장면만 갈아 끼움.
//  p 가 0 → 1 로 흐르고, p 가 sweet 근처(win)일 때 누르면 성공. wave 는 0↔1 을 오가며 되풀이.
import { useRef, useState } from 'react';
import { Hud, clamp01, useLoop, useRng, type MiniProps } from './kit';
import { Box3D, use3D } from './three';

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export interface TimingSkin {
  rounds: number;
  cam: number[];
  look: number[];
  sky?: number;
  fov?: number;
  models: string[];
  build: (k, S, rng) => any;
  next: (rng, level: number, i: number) => { dur: number; sweet: number; win: number; wave?: boolean; data?: any };
  enter?: (c) => void;
  draw: (c) => void;
  tip: string;
  hud?: (r) => [string, any];
  word?: [string, string];
}

export function TimingGame({ level, seed, report, finish, skin }: MiniProps & { skin: TimingSkin }) {
  const rng = useRng(seed);
  const st = useRef({ i: 0, r: skin.next(rng, level, 0), t: 0, p: 0, phase: 'run', q: 0, tp: 0, wt: 0, sum: 0, hits: 0, entered: -1, over: false });
  const [, setN] = useState(0);
  const g = use3D({ cam: skin.cam, look: skin.look, sky: skin.sky, fov: skin.fov }, skin.models, (k, S) => skin.build(k, S, rng));
  const settle = (q: number) => {
    const s = st.current;
    s.q = q;
    s.tp = s.p;
    s.phase = q > 0 ? 'hit' : 'miss';
    s.wt = 0;
    s.sum += q;
    if (q > 0) s.hits++;
  };
  useLoop((dt) => {
    const s = st.current, S = g.S.current, k = g.K.current, W = g.W.current;
    if (!S || !k || !W || s.over) return;
    const c = { W, k, S, rng, level, i: s.i, r: s.r, dt, get p() { return s.p; }, get phase() { return s.phase; }, get q() { return s.q; }, get tp() { return s.tp; }, get wt() { return s.wt; }, get t() { return s.t; } };
    if (s.entered !== s.i) {
      s.entered = s.i;
      skin.enter?.(c);
    }
    if (s.phase === 'run') {
      s.t += dt;
      if (s.r.wave) {
        s.p = 0.5 - 0.5 * Math.cos((Math.PI * 2 * s.t) / s.r.dur);
        if (s.t > s.r.dur * 3.2) settle(0);
      } else {
        s.p = s.t / s.r.dur;
        if (s.p >= 1) {
          s.p = 1;
          settle(0);
        }
      }
    } else {
      s.wt += dt;
      if (s.wt > 1.25) {
        s.i++;
        if (s.i >= skin.rounds) {
          s.over = true;
          return finish(clamp01((s.sum / skin.rounds) * 1.06));
        }
        Object.assign(s, { r: skin.next(rng, level, s.i), t: 0, p: 0, phase: 'run' });
      }
    }
    skin.draw(c);
    S.fx(dt);
    S.render();
    report(clamp01((s.sum / skin.rounds) * 1.06));
    setN((x) => (x + 1) % 1000);
  }, g.ready);
  const tap = () => {
    const s = st.current;
    if (s.over || s.phase !== 'run' || s.t < 0.25) return;
    const d = Math.abs(s.p - s.r.sweet);
    settle(d < s.r.win * 0.5 ? 1 : d < s.r.win ? 0.6 : 0);
  };
  const s = st.current;
  const [good, bad] = skin.word ?? ['👍 딱 맞았어요', '😵 놓쳤어요'];
  return (
    <>
      <Hud items={[['차례', `${Math.min(skin.rounds, s.i + 1)}/${skin.rounds}`], ['성공', s.hits], ...(skin.hud ? [skin.hud(s.r)] : [])]} />
      <Box3D r={g.ref} ready={g.ready} fail={g.fail} onPointerDown={tap}>
        <p className="mg-tip">{s.phase === 'run' ? skin.tip : s.phase === 'hit' ? (s.q >= 1 ? good : '🙂 조금 빗나갔지만 성공') : bad}</p>
      </Box3D>
    </>
  );
}

export const ringMesh = (k, r: number, col: number, w = 0.08) => {
  const m = new k.THREE.Mesh(new k.THREE.RingGeometry(r - w, r, 40), new k.THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.9, side: 2 }));
  m.rotation.x = -Math.PI / 2;
  return m;
};
export const scatter = (k, S, list: string[], n: number, f: (i: number) => number[], sc = 1) => {
  for (let i = 0; i < n; i++) {
    const o = k.model(list[i % list.length]);
    const [x, z] = f(i);
    o.position.set(x, 0, z);
    o.scale.multiplyScalar(sc);
    S.scene.add(o);
  }
};
export const V = (k, x: number, y: number, z: number) => new k.THREE.Vector3(x, y, z);
export const sp = (level: number) => Math.pow(level, 0.45);

/* 1. 잠입 · 조용한 제압: 좁아지는 원이 흰 원과 겹칠 때 */
const S_TAKEDOWN: TimingSkin = {
  rounds: 7, cam: [2.5, 5.2, 7.5], look: [0, 0.5, 0], sky: 0x16222e, models: ['container', 'crate', 'barrel', 'b2w'],
  tip: '노란 원이 흰 원과 겹칠 때 톡', word: ['🤫 소리 없이 제압', '😳 들켰어요'],
  build(k, S) {
    k.floor(S.scene, k.M(0x34403a), 40, 40);
    scatter(k, S, ['container', 'crate', 'barrel', 'b2w'], 10, (i) => [(i % 2 ? 1 : -1) * (4.5 + (i % 3)), -9 + i * 1.1], 1);
    const foe = k.soldier('foe'), me = k.soldier('us');
    foe.rotation.y = Math.PI;
    me.rotation.y = Math.PI;
    const base = ringMesh(k, 0.7, 0xffffff), ring = ringMesh(k, 0.7, 0xffd84a);
    base.position.y = 0.03;
    ring.position.y = 0.05;
    S.scene.add(foe, me, base, ring);
    return { foe, me, ring };
  },
  next: (rng, lv) => ({ dur: rng.range(1.5, 2.3) / sp(lv), sweet: 0.78, win: 0.13 }),
  enter(c) {
    c.W.foe.rotation.x = 0;
    c.W.foe.position.y = 0;
  },
  draw(c) {
    const { W, k } = c;
    W.ring.scale.setScalar(Math.max(0.15, 1 + (0.78 - c.p) * 4.6));
    W.ring.visible = c.phase === 'run';
    W.me.position.set(0, 0, 1.4 - c.p * 0.8);
    k.walk(W.me, c.t, c.phase === 'run');
    k.walk(W.foe, c.t, c.phase === 'run');
    if (c.phase === 'hit') W.foe.rotation.x = Math.min(Math.PI / 2, c.wt * 6);
    if (c.phase === 'miss') W.foe.rotation.y = Math.PI + Math.min(Math.PI, c.wt * 8);
    else W.foe.rotation.y = Math.PI;
  },
};

/* 2. 사격 · 움직이는 차량: 표적이 조준선에 닿기 조금 전에 */
const S_LEADSHOT: TimingSkin = {
  rounds: 8, cam: [0, 2.2, 9], look: [0, 1, -6], fov: 40, models: ['tank', 'tree', 'pine', 'rock'],
  tip: '탄이 날아가는 동안 표적이 움직여요 · 흰 기둥에 닿기 조금 전에 톡', word: ['🎯 명중', '💨 빗나감'],
  hud: (r) => ['빠르기', r.data.fast ? '빠름' : '보통'],
  build(k, S) {
    k.floor(S.scene, k.MAT.grass, 80, 80);
    k.floor(S.scene, k.MAT.road, 80, 2.4, 0.01).position.z = -9;
    scatter(k, S, ['tree', 'pine', 'rock'], 18, (i) => [-13 + i * 1.5, -12 - (i % 3)]);
    S.scene.add(k.box(0.08, 3, 0.08, k.MAT.white, 0, 1.5, -9));
    const car = k.model('tank', 'foe');
    car.scale.multiplyScalar(2.2);
    S.scene.add(car);
    return { car };
  },
  next(rng, lv) {
    const fast = rng.chance(0.4);
    const dur = (fast ? 1.7 : 2.6) / sp(lv);
    // 탄이 0.35초 걸림 → 그만큼 앞서 눌러야 함
    return { dur, sweet: 0.5 - 0.35 / dur, win: 0.09, data: { fast, dir: rng.chance(0.5) ? 1 : -1 } };
  },
  enter(c) {
    c.W.car.visible = true;
  },
  draw(c) {
    const { W, k, S, r } = c;
    const x = (pp) => r.data.dir * lerp(-9, 9, pp);
    W.car.rotation.y = (r.data.dir * Math.PI) / 2;
    if (c.phase === 'run') W.car.position.set(x(c.p), 0, -9);
    else if (c.wt < 0.35) {
      W.car.position.x = x(c.tp + c.wt / r.dur);
      if (c.wt - c.dt <= 0) S.tracer(V(k, 0.3, 1.2, 8), V(k, 0, 0.9, -9));
    } else if (W.car.visible && c.phase === 'hit') {
      S.boom(W.car.position.clone(), 1.2);
      W.car.visible = false;
    } else if (c.phase === 'miss') W.car.position.x = x(c.tp + c.wt / r.dur);
  },
};

/* 3. 보급 · 하늘에서 떨어뜨리기 */
const S_AIRDROP: TimingSkin = {
  rounds: 6, cam: [0, 6, 14], look: [0, 2.2, 0], models: ['heli', 'tent', 'crate', 'tree', 'pine', 'rock'],
  tip: '상자는 앞으로 밀리며 떨어져요 · 천막에 닿기 조금 전에 톡', word: ['📦 딱 떨어졌어요', '😓 엉뚱한 데 떨어졌어요'],
  build(k, S) {
    k.floor(S.scene, k.MAT.grass, 80, 60);
    scatter(k, S, ['tree', 'pine', 'rock'], 20, (i) => [-12 + i * 1.3, -4 - (i % 4)]);
    const tent = k.model('tent');
    tent.scale.multiplyScalar(1.8);
    const mark = ringMesh(k, 1.5, 0xffd84a, 0.12);
    mark.position.y = 0.04;
    const plane = k.model('heli', 'us');
    plane.scale.multiplyScalar(1.4);
    const crate = k.model('crate');
    crate.scale.multiplyScalar(1.6);
    const men = [0, 1, 2].map((i) => {
      const o = k.soldier('us');
      S.scene.add(o);
      return o;
    });
    S.scene.add(tent, mark, plane, crate);
    return { tent, mark, plane, crate, men };
  },
  next(rng, lv) {
    const tx = rng.range(-4.5, 4.5), dir = rng.chance(0.5) ? 1 : -1, dur = rng.range(2.6, 3.4) / sp(lv);
    // 떨어지는 0.9초 동안 앞으로 밀림
    const drift = (18 / dur) * 0.9 * 0.6;
    return { dur, sweet: (dir * (tx - dir * drift) + 9) / 18, win: 0.085, data: { tx, dir, drift } };
  },
  enter(c) {
    const { W, r } = c;
    W.tent.position.set(r.data.tx, 0, 0.6);
    W.mark.position.x = r.data.tx;
    W.men.forEach((o, i) => o.position.set(r.data.tx - 1 + i, 0, 1.6));
    W.crate.visible = false;
  },
  draw(c) {
    const { W, k, S, r } = c;
    const px = r.data.dir * lerp(-9, 9, c.phase === 'run' ? c.p : c.tp + c.wt / r.dur);
    W.plane.position.set(px, 5, 0);
    W.plane.rotation.y = (r.data.dir * Math.PI) / 2;
    if (c.phase !== 'run' && c.tp < 1) {
      const kk = Math.min(1, c.wt / 0.9), x0 = r.data.dir * lerp(-9, 9, c.tp);
      W.crate.visible = true;
      W.crate.position.set(x0 + r.data.dir * r.data.drift * kk, 4.6 * (1 - kk * kk), 0);
      if (kk >= 1 && c.wt - c.dt < 0.9) S.smoke(W.crate.position.clone(), 0.6, c.phase === 'miss');
    }
  },
};

/* 4. 보급 · 급유 맞추기: 급유차가 나란히 온 순간 */
const S_REFUEL: TimingSkin = {
  rounds: 7, cam: [0, 5.5, 9], look: [0, 0.5, 0], models: ['tank', 'container', 'tree', 'pine', 'bush'],
  tip: '급유차(파란 차)가 전차 옆에 나란히 오면 톡', word: ['⛽ 달리면서 급유 성공', '😓 호스가 안 닿았어요'],
  build(k, S) {
    k.floor(S.scene, k.MAT.grass, 200, 60);
    k.floor(S.scene, k.MAT.road, 200, 4.4, 0.01);
    const trees = Array.from({ length: 16 }, (_, i) => {
      const o = k.model(['tree', 'pine', 'bush'][i % 3]);
      o.position.set(-16 + i * 2.2, 0, i % 2 ? -3.6 : -5.5);
      S.scene.add(o);
      return o;
    });
    const tank = k.model('tank', 'us');
    tank.scale.multiplyScalar(1.6);
    tank.rotation.y = Math.PI / 2;
    tank.position.z = -0.9;
    const truck = k.model('container', 'us');
    truck.rotation.y = Math.PI / 2;
    truck.position.z = 1.1;
    const hose = k.box(0.08, 0.08, 1.6, k.MAT.black, 0, 0.7, 0.1);
    S.scene.add(tank, truck, hose);
    return { trees, truck, hose };
  },
  next: (rng, lv) => ({ dur: rng.range(1.6, 2.6) / sp(lv), sweet: 0.5, win: 0.1, data: { dir: rng.chance(0.5) ? 1 : -1 } }),
  draw(c) {
    const { W, r } = c;
    W.trees.forEach((o) => {
      o.position.x -= c.dt * 6;
      if (o.position.x < -17) o.position.x += 35;
    });
    const pp = c.phase === 'run' ? c.p : c.phase === 'hit' ? 0.5 : c.tp + c.wt / r.dur;
    W.truck.position.x = r.data.dir * lerp(-8, 8, pp);
    W.hose.visible = c.phase === 'hit';
  },
};

/* 5. 항공 · 미사일 따돌리기: 미사일이 원에 닿는 순간 플레어 */
const S_FLARE: TimingSkin = {
  rounds: 7, cam: [3, 3.5, 9], look: [0, 2.6, -3], sky: 0x86b3d1, models: ['jet'],
  tip: '미사일이 노란 원에 닿는 순간 톡 · 이르면 헛쏘고 늦으면 맞아요', word: ['🎆 미사일이 플레어를 쫓아갔어요', '💥 맞았어요'],
  build(k, S) {
    k.floor(S.scene, k.MAT.water, 200, 200);
    const jet = k.model('jet', 'us');
    jet.rotation.y = Math.PI;
    jet.position.set(0, 3, -3);
    const ring = new k.THREE.Mesh(new k.THREE.TorusGeometry(1.5, 0.05, 6, 32), new k.THREE.MeshBasicMaterial({ color: 0xffd84a }));
    ring.position.copy(jet.position);
    const ms = k.box(0.14, 0.14, 0.9, k.M(0xd94a3d), 0, 0, 0);
    S.scene.add(jet, ring, ms);
    return { jet, ring, ms };
  },
  next: (rng, lv) => ({ dur: rng.range(1.5, 2.6) / sp(lv), sweet: 0.84, win: 0.1, data: { a: rng.range(-1, 1) } }),
  draw(c) {
    const { W, k, S, r } = c;
    const from = V(k, r.data.a * 7, 3 + r.data.a * 1.5, 9), to = W.jet.position;
    const pp = c.phase === 'run' ? c.p : c.tp;
    W.ms.visible = c.phase === 'run' || c.wt < 0.5;
    W.ms.position.lerpVectors(from, to, pp);
    W.ms.lookAt(to);
    W.jet.rotation.z = Math.sin(c.t * 2) * 0.15;
    if (c.phase === 'run' && Math.random() < c.dt * 25) S.smoke(W.ms.position.clone(), 0.18, false);
    if (c.phase !== 'run' && c.wt - c.dt <= 0) {
      if (c.phase === 'hit') for (let i = 0; i < 4; i++) S.tracer(to.clone(), to.clone().add(V(k, (i - 1.5) * 1.6, -1.6, 1.5)), 0xffe07a);
      else if (c.tp >= r.sweet) S.boom(to.clone(), 1.2);
    }
    if (c.phase === 'hit') W.ms.position.y -= c.wt * 3;
  },
};

/* 6. 항공 · 정밀 폭격: 바람을 보고 표적이 상자에 들어오기 전·후에 */
const S_BOMB: TimingSkin = {
  rounds: 6, cam: [0, 16, 3], look: [0, 0, 0], models: ['b2w', 'b1g', 'tree', 'container', 'tank'],
  tip: '표적이 노란 상자에 들어올 때 톡 · 뒷바람이면 조금 늦게, 맞바람이면 조금 일찍', word: ['💣 명중', '💨 빗나갔어요'],
  hud: (r) => ['바람', r.data.wind === 0 ? '없음' : r.data.wind > 0 ? `뒷바람 ${r.data.wind}` : `맞바람 ${-r.data.wind}`],
  build(k, S) {
    k.floor(S.scene, k.MAT.grass, 80, 200);
    const land = new k.THREE.Group();
    for (let i = 0; i < 26; i++) {
      const o = k.model(['tree', 'b1g', 'tree', 'container'][i % 4]);
      o.position.set((i % 2 ? 1 : -1) * (2.5 + ((i * 7) % 5)), 0, -30 + i * 2.4);
      land.add(o);
    }
    const tgt = k.model('b2w');
    tgt.scale.multiplyScalar(1.6);
    tgt.add(k.box(1.6, 0.05, 1.6, k.M(0xd94a3d), 0, 0.02, 0));
    land.add(tgt);
    const box = new k.THREE.LineSegments(new k.THREE.EdgesGeometry(new k.THREE.BoxGeometry(2.4, 0.1, 2.4)), new k.THREE.LineBasicMaterial({ color: 0xffd84a }));
    box.position.set(0, 0.3, 0);
    S.scene.add(land, box);
    return { land, tgt };
  },
  next(rng, lv) {
    const wind = Math.round(rng.range(-2, 2));
    return { dur: rng.range(2.4, 3.2) / sp(lv), sweet: 0.5 + wind * 0.045, win: 0.08, data: { wind } };
  },
  enter(c) {
    c.W.tgt.visible = true;
  },
  draw(c) {
    const { W, k, S, r } = c;
    const pp = c.phase === 'run' ? c.p : c.tp + c.wt / r.dur;
    W.tgt.position.z = 0;
    W.land.position.z = lerp(-10, 10, pp);
    if (c.phase !== 'run' && c.wt >= 0.5 && c.wt - c.dt < 0.5) {
      S.boom(V(k, 0, 0.2, c.phase === 'hit' ? W.land.position.z : W.land.position.z + (r.sweet - c.tp) * 20), 1.6);
      if (c.phase === 'hit') W.tgt.visible = false;
    }
  },
};

/* 7. 포격 · 날아오는 것 막기 */
const S_INTERCEPT: TimingSkin = {
  rounds: 8, cam: [0, 5, 13], look: [0, 4, 0], sky: 0x23344a, models: ['b2w', 'b1g', 'b3s', 'antenna', 'spg'],
  tip: '로켓이 노란 고리 안에 들어올 때 톡', word: ['🚀 떨어뜨렸어요', '💥 도시에 떨어졌어요'],
  build(k, S) {
    k.floor(S.scene, k.M(0x2f3a33), 80, 40);
    scatter(k, S, ['b2w', 'b1g', 'b3s'], 7, (i) => [-7 + i * 2.3, -1 - (i % 2)], 1.3);
    const gun = k.model('spg', 'us');
    gun.position.set(0, 0, 3);
    gun.scale.multiplyScalar(1.3);
    const ring = new k.THREE.Mesh(new k.THREE.TorusGeometry(1.1, 0.05, 6, 32), new k.THREE.MeshBasicMaterial({ color: 0xffd84a }));
    const rk = k.box(0.14, 0.14, 0.8, k.M(0xd94a3d));
    S.scene.add(gun, ring, rk);
    return { ring, rk };
  },
  next(rng, lv) {
    const side = rng.chance(0.5) ? 1 : -1;
    return { dur: rng.range(1.5, 2.5) / sp(lv), sweet: rng.range(0.45, 0.7), win: 0.085, data: { x0: side * rng.range(8, 11), x1: rng.range(-5, 5), h: rng.range(7, 10) } };
  },
  enter(c) {
    c.W.rk.visible = true;
  },
  draw(c) {
    const { W, k, S, r } = c;
    const at = (pp) => V(k, lerp(r.data.x0, r.data.x1, pp), lerp(r.data.h, 0.2, pp * pp), -1);
    W.ring.position.copy(at(r.sweet));
    W.ring.lookAt(at(r.sweet + 0.05));
    const pp = c.phase === 'run' ? c.p : c.phase === 'hit' ? c.tp : Math.min(1, c.tp + c.wt / r.dur);
    W.rk.position.copy(at(pp));
    W.rk.lookAt(at(pp + 0.03));
    if (c.phase === 'run' && Math.random() < c.dt * 25) S.smoke(W.rk.position.clone(), 0.18, true);
    if (c.phase !== 'run' && c.wt - c.dt <= 0) S.tracer(V(k, 0, 1, 3), at(c.tp), 0xfff2a8);
    if (c.phase === 'hit' && W.rk.visible) {
      S.boom(at(c.tp), 1);
      W.rk.visible = false;
    }
    if (c.phase === 'miss' && W.rk.visible && pp >= 1) {
      S.boom(at(1), 1.6);
      W.rk.visible = false;
    }
  },
};

/* 8. 모병 · 홍보 영상 찍기: 전차와 전투기가 함께 화면 틀에 들어올 때 */
const S_FILM: TimingSkin = {
  rounds: 6, cam: [0, 2.6, 12], look: [0, 2.6, 0], fov: 42, models: ['tank', 'jet', 'tree', 'pine', 'b1g'],
  tip: '전차와 전투기가 함께 노란 틀 안에 들어올 때 톡', word: ['🎬 멋진 장면!', '🙈 빈 화면을 찍었어요'],
  build(k, S) {
    k.floor(S.scene, k.MAT.grass, 80, 60);
    scatter(k, S, ['tree', 'pine', 'b1g'], 14, (i) => [-13 + i * 2, -6 - (i % 3)]);
    const tank = k.model('tank', 'us'), jet = k.model('jet', 'us');
    tank.scale.multiplyScalar(1.7);
    jet.scale.multiplyScalar(1.3);
    const frame = new k.THREE.LineSegments(new k.THREE.EdgesGeometry(new k.THREE.BoxGeometry(5.4, 6.2, 0.1)), new k.THREE.LineBasicMaterial({ color: 0xffd84a }));
    frame.position.set(0, 3, 1);
    S.scene.add(tank, jet, frame);
    return { tank, jet, frame };
  },
  next(rng, lv) {
    const dur = rng.range(2.2, 3) / sp(lv);
    return { dur, sweet: rng.range(0.4, 0.7), win: 0.085, data: { d1: rng.chance(0.5) ? 1 : -1, d2: rng.chance(0.5) ? 1 : -1, v2: rng.range(1.8, 2.6) } };
  },
  draw(c) {
    const { W, r } = c;
    const pp = c.phase === 'run' ? c.p : c.tp;
    // 둘 다 sweet 때 가운데(x=0)를 지남. 전투기가 훨씬 빠름
    W.tank.position.set(r.data.d1 * (pp - r.sweet) * 12, 0, 0);
    W.tank.rotation.y = (r.data.d1 * Math.PI) / 2;
    W.jet.position.set(r.data.d2 * (pp - r.sweet) * 12 * r.data.v2, 5, -1);
    W.jet.rotation.y = (r.data.d2 * Math.PI) / 2;
    W.frame.material.color.setHex(c.phase === 'hit' ? 0x5dff8a : c.phase === 'miss' ? 0xff5a4a : 0xffd84a);
  },
};

/* 9. 해상 · 상륙 물때: 물이 가장 찼을 때 출발 */
const S_TIDE: TimingSkin = {
  rounds: 5, cam: [0, 10, 16], look: [0, 0, 2], sky: 0x8fb6cc, models: ['boat', 'rock', 'tent', 'b1g'],
  tip: '물이 가장 높이 찼을 때(기둥의 흰 띠까지) 톡', word: ['🌊 물때를 탔어요', '😓 갯벌에 걸렸어요'],
  build(k, S) {
    k.floor(S.scene, k.M(0x8a7d5a), 80, 60);
    const sea = k.floor(S.scene, k.MAT.water, 80, 30, 0.02);
    sea.position.z = 14;
    scatter(k, S, ['rock', 'tent', 'b1g'], 9, (i) => [-9 + i * 2.3, -6 - (i % 2) * 2], 1.3);
    const pole = k.box(0.3, 2.4, 0.3, k.M(0x7a5a3a), 3.4, 1.2, 4.5);
    pole.add(k.box(0.36, 0.14, 0.36, k.MAT.white, 0, -0.62, 0));
    const boats = [-2.5, 0, 2.5].map((x) => {
      const o = k.ship('us', 1.8);
      o.rotation.y = Math.PI;
      S.scene.add(o);
      o.userData.x = x;
      return o;
    });
    S.scene.add(pole);
    return { sea, boats };
  },
  next: (rng, lv) => ({ dur: rng.range(2.6, 3.6) / sp(lv), sweet: 1, win: 0.13, wave: true }),
  draw(c) {
    const { W } = c;
    const pp = c.phase === 'run' ? c.p : c.tp;
    // 물가가 z=8(썰물) ~ z=1(밀물)
    const edge = lerp(8.5, 2.5, pp);
    W.sea.position.z = edge + 15;
    W.sea.position.y = 0.04 + pp * 0.5;
    W.boats.forEach((o) => {
      const go = c.phase === 'run' ? 0 : Math.min(1, c.wt / 1.1);
      const stop = c.phase === 'hit' ? 2.4 : edge + 0.6;
      o.position.set(o.userData.x, 0.05 + pp * 0.45, lerp(edge + 2.6, stop, go));
      o.rotation.z = c.phase === 'miss' && go >= 1 ? 0.3 : 0;
    });
  },
};

/* 10. 해킹 · 드론 빼앗기: 두 물결이 겹칠 때 */
const S_WAVES: TimingSkin = {
  rounds: 6, cam: [0, 1.5, 11], look: [0, 1.5, 0], sky: 0x07131c, models: ['heli'],
  tip: '빨간 물결(적 드론)이 파란 물결(내 신호)과 겹칠 때 톡', word: ['📡 드론을 빼앗았어요', '📵 신호가 어긋났어요'],
  build(k, S) {
    const mk = (col) => {
      const geo = new k.THREE.BufferGeometry().setFromPoints(Array.from({ length: 60 }, (_, i) => V(k, -5 + i * (10 / 59), 0, 0)));
      const l = new k.THREE.Line(geo, new k.THREE.LineBasicMaterial({ color: col }));
      S.scene.add(l);
      return l;
    };
    const mine = mk(0x3fb8c9), foe = mk(0xff5a4a);
    const drone = k.model('heli', 'foe');
    drone.position.set(0, 4.2, -2);
    drone.scale.multiplyScalar(1.2);
    S.scene.add(drone);
    return { mine, foe, drone };
  },
  next: (rng, lv) => ({ dur: rng.range(2.2, 3.2) / sp(lv), sweet: 1, win: 0.12, wave: true, data: { f: rng.range(1.2, 1.9) } }),
  draw(c) {
    const { W, r } = c;
    const pp = c.phase === 'run' ? c.p : c.tp;
    const set = (line, ph, amp) => {
      const a = line.geometry.attributes.position;
      for (let i = 0; i < a.count; i++) a.setY(i, 1.5 + Math.sin(a.getX(i) * r.data.f + c.t * 3 + ph) * amp);
      a.needsUpdate = true;
    };
    set(W.mine, 0, 1.2);
    set(W.foe, (1 - pp) * Math.PI, 1.2);
    W.drone.rotation.y += c.dt * (c.phase === 'hit' ? 6 : 1);
    W.drone.position.x = Math.sin(c.t) * 2;
  },
};

/* 11. 전술 · 고지 뺏기: 포격이 멎고 연막이 퍼진 순간 돌격 */
const S_HILL: TimingSkin = {
  rounds: 5, cam: [0, 5, 13], look: [0, 1.6, 0], models: ['tree', 'pine', 'rock', 'b1g'],
  tip: '포격이 멎고 연막이 퍼졌을 때 톡 · 이르면 아군 포에, 늦으면 적 총에 맞아요', word: ['🚩 고지를 뺏었어요', '🩸 돌격이 막혔어요'],
  build(k, S) {
    k.floor(S.scene, k.MAT.grass, 80, 60);
    const hill = new k.THREE.Mesh(new k.THREE.ConeGeometry(6, 3, 8), k.M(0x6f7a4a));
    hill.position.set(0, 1.5, -4);
    const bunker = k.model('b1g');
    bunker.position.set(0, 2.9, -4);
    bunker.scale.multiplyScalar(0.9);
    scatter(k, S, ['tree', 'pine', 'rock'], 14, (i) => [-10 + i * 1.5, -9 - (i % 2)]);
    const flag = k.box(0.08, 2, 0.08, k.MAT.white, 0.9, 4, -4);
    flag.add(k.box(0.8, 0.5, 0.04, k.M(0x3fb8c9), 0.45, 0.7, 0));
    const squad = Array.from({ length: 6 }, (_, i) => {
      const o = k.soldier('us');
      o.rotation.y = Math.PI;
      o.userData.x = -2.5 + i;
      S.scene.add(o);
      return o;
    });
    S.scene.add(hill, bunker, flag);
    return { squad, flag };
  },
  next: (rng, lv) => ({ dur: rng.range(3.2, 4.4) / sp(lv), sweet: rng.range(0.55, 0.7), win: 0.1 }),
  enter(c) {
    c.W.flag.visible = false;
  },
  draw(c) {
    const { W, k, S, r } = c;
    const top = () => V(k, (Math.random() - 0.5) * 6, 1.5 + Math.random() * 1.5, -3 + (Math.random() - 0.5) * 3);
    if (c.phase === 'run') {
      if (c.p < r.sweet - r.win && Math.random() < c.dt * 5) S.boom(top(), 0.9);
      else if (c.p >= r.sweet - r.win && c.p < r.sweet + r.win && Math.random() < c.dt * 14) S.smoke(top(), 1.1, false);
      else if (c.p >= r.sweet + r.win && Math.random() < c.dt * 6) S.tracer(V(k, 0, 3, -4), V(k, (Math.random() - 0.5) * 6, 0.4, 5), 0xff5a4a);
    }
    const go = c.phase === 'run' ? 0 : Math.min(1, c.wt / 1.1);
    W.squad.forEach((o) => {
      const far = c.phase === 'hit' ? 1 : 0.45;
      o.position.set(o.userData.x * (1 - go * far * 0.7), go * far * 2.6, 5.5 - go * far * 8.5);
      k.walk(o, c.t, c.phase !== 'run' && go < 1);
      o.rotation.x = c.phase === 'miss' && go >= 1 ? Math.PI / 2 : 0;
    });
    if (c.phase === 'hit' && go >= 1) W.flag.visible = true;
  },
};

/* 12. 포격 · 한꺼번에 떨어뜨리기: 먼 포부터 차례로 쏴 포탄이 같이 떨어지게 */
const S_TOT: TimingSkin = {
  rounds: 9, cam: [0, 10, 16], look: [0, 1, -1], models: ['spg', 'tank', 'tree', 'rock'],
  tip: '불빛이 노란 포 위에 올 때 톡 · 먼 포부터 차례로', word: ['💥 발사!', '⏱️ 때를 놓쳤어요'],
  hud: (r) => ['쏠 포', `${r.data.g + 1}번`],
  build(k, S) {
    k.floor(S.scene, k.M(0x8f845f), 80, 60);
    scatter(k, S, ['tree', 'rock'], 12, (i) => [-10 + i * 1.8, -10 - (i % 2)]);
    const foe = [0, 1, 2].map((i) => {
      const o = k.model('tank', 'foe');
      o.position.set(-1.5 + i * 1.5, 0, -7);
      S.scene.add(o);
      return o;
    });
    const guns = [-4, 0, 4].map((x) => {
      const o = k.model('spg', 'us');
      o.position.set(x, 0, 4);
      o.rotation.y = Math.PI;
      o.scale.multiplyScalar(1.5);
      const mark = ringMesh(k, 1.4, 0xffd84a, 0.12);
      mark.position.set(x, 0.05, 4);
      S.scene.add(o, mark);
      return { o, mark, x };
    });
    const lamp = new k.THREE.Mesh(new k.THREE.SphereGeometry(0.35, 12, 8), new k.THREE.MeshBasicMaterial({ color: 0xfff2a8 }));
    S.scene.add(k.box(12, 0.06, 0.06, k.MAT.metal, 0, 3.2, 4), lamp);
    return { guns, lamp, foe, salvo: 0 };
  },
  next: (rng, lv, i) => ({ dur: rng.range(1.8, 2.6) / sp(lv), sweet: [0.17, 0.5, 0.83][i % 3], win: 0.09, data: { g: i % 3 } }),
  enter(c) {
    if (c.r.data.g === 0) c.W.salvo = 0;
  },
  draw(c) {
    const { W, k, S, r } = c;
    W.guns.forEach((gn, i) => (gn.mark.visible = i === r.data.g && c.phase === 'run'));
    W.lamp.position.set(lerp(-6, 6, c.phase === 'run' ? c.p : c.tp), 3.2, 4);
    if (c.phase !== 'run' && c.wt - c.dt <= 0) {
      if (c.phase === 'hit') {
        W.salvo++;
        S.smoke(V(k, W.guns[r.data.g].x, 1.2, 3), 0.7, false);
        S.tracer(V(k, W.guns[r.data.g].x, 1.2, 3), V(k, W.guns[r.data.g].x * 0.5, 9, -2), 0xfff2a8);
      }
    }
    if (r.data.g === 2 && c.phase !== 'run' && c.wt >= 0.7 && c.wt - c.dt < 0.7) for (let i = 0; i < W.salvo; i++) S.boom(V(k, -1.5 + i * 1.5, 0.2, -7), 1.3);
  },
};

const mk = (skin: TimingSkin) => (p: MiniProps) => <TimingGame {...p} skin={skin} />;
export const ETakedown = mk(S_TAKEDOWN);
export const ELeadShot = mk(S_LEADSHOT);
export const EAirdrop = mk(S_AIRDROP);
export const ERefuel = mk(S_REFUEL);
export const EFlare = mk(S_FLARE);
export const EBomb = mk(S_BOMB);
export const EIntercept = mk(S_INTERCEPT);
export const EFilm = mk(S_FILM);
export const ETide = mk(S_TIDE);
export const EWaves = mk(S_WAVES);
export const EHill = mk(S_HILL);
export const ETot = mk(S_TOT);
