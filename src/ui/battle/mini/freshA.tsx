// @ts-nocheck
// 새 훈련 틀 A "1인칭 눈높이"(11-26): 내 눈으로 보고 직접 움직이는 3D 훈련 6개.
// 사격 조준경 · 항공 조종석 · 잠입 그림자 · 포격 관측병 · 해상 함교 · 체력 달리기
import { useRef, useState } from 'react';
import { Hud, clamp01, useLoop, useRng, type MiniProps } from './kit';
import { Box3D, use3D } from './three';

/** 끌어서 둘러보기(좌우 yaw · 위아래 pitch) */
function useLook(yaw0 = 0, pitch0 = 0, k = 0.005) {
  const v = useRef({ yaw: yaw0, pitch: pitch0, drag: null as null | { x: number; y: number } });
  return {
    v,
    down: (e) => (v.current.drag = { x: e.clientX, y: e.clientY }),
    move: (e) => {
      const d = v.current.drag;
      if (!d) return;
      v.current.yaw -= (e.clientX - d.x) * k;
      v.current.pitch = Math.max(-0.9, Math.min(0.7, v.current.pitch - (e.clientY - d.y) * k));
      v.current.drag = { x: e.clientX, y: e.clientY };
    },
    up: () => (v.current.drag = null),
  };
}
const center = (S) => {
  const r = S.renderer.domElement.getBoundingClientRect();
  return { clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 };
};
const deg = (r: number) => Math.round((r * 180) / Math.PI);

/* ═════ A-1 사격: 1인칭 조준경 사격 ═════ */
export function FShootScope({ level, seed, report, finish }: MiniProps) {
  const rng = useRng(seed);
  const N = 12, AMMO = 20;
  const look = useLook(0, -0.02, 0.0035);
  const st = useRef({ t: 0, next: 1.2, made: 0, hit: 0, shots: 0, scope: false, hold: false, breath: 1, kick: 0, tg: [] as any[], over: false, flash: 0 });
  const [, tick] = useState(0);
  const g = use3D({ cam: [0, 1.6, 0], look: [0, 1.4, -10], fov: 50 }, ['tree', 'pine', 'houseA', 'houseB', 'rock', 'bush', 'crate', 'barrel'], (k, S) => {
    k.floor(S.scene, k.MAT.grass, 200, 200);
    const lane = k.floor(S.scene, k.MAT.dirt, 30, 60, 0.01);
    lane.position.z = -30;
    for (let i = 0; i < 26; i++) {
      const o = k.model(['tree', 'pine', 'bush', 'rock'][i % 4]);
      o.position.set(rng.range(-24, 24), 0, -rng.range(12, 60));
      if (Math.abs(o.position.x) < 4) o.position.x += 8;
      S.scene.add(o);
    }
    [['houseA', -9, -34], ['houseB', 8, -46], ['houseA', 2, -58]].forEach(([m, x, z]) => {
      const o = k.model(m);
      o.position.set(x, 0, z);
      o.scale.multiplyScalar(2);
      S.scene.add(o);
    });
    for (let i = 0; i < 8; i++) {
      const o = k.model(i % 2 ? 'crate' : 'barrel');
      o.position.set(rng.range(-10, 10), 0, -rng.range(14, 44));
      o.scale.multiplyScalar(2.5);
      S.scene.add(o);
    }
    S.camera.rotation.order = 'YXZ';
    return {};
  });
  useLoop((dt) => {
    const s = st.current, S = g.S.current, k = g.K.current;
    if (!S || !k || s.over) return;
    s.t += dt;
    // 표적: 한 번에 둘까지, 잠깐 일어섰다 숨음
    if (s.made < N && s.t > s.next && s.tg.filter((x) => x.alive).length < 2) {
      s.made++;
      s.next = s.t + rng.range(1.4, 2.6) / level;
      const o = k.soldier('foe');
      const z = -rng.range(14, 46), x = rng.range(-0.32, 0.32) * -z;
      o.position.set(x, -1, z);
      o.lookAt(0, 0, 0);
      o.scale.multiplyScalar(1.15);
      S.scene.add(o);
      s.tg.push({ o, at: s.t, life: rng.range(3.2, 4.6) / level, alive: true });
    }
    for (const t of s.tg) {
      if (!t.o) continue;
      const up = t.alive && s.t < t.at + t.life;
      if (t.alive && !up) t.alive = false;
      t.o.position.y += ((up ? 0 : -1.2) - t.o.position.y) * Math.min(1, dt * 8);
      if (!up && t.o.position.y < -1.1) {
        S.scene.remove(t.o);
        t.o = null;
      }
    }
    // 숨 참기: 참는 동안 흔들림 ↓, 숨 막대가 줄어요
    if (s.hold && s.breath > 0) s.breath = Math.max(0, s.breath - dt / 3.5);
    else s.breath = Math.min(1, s.breath + dt / 5);
    const calm = s.hold && s.breath > 0 ? 0.15 : 1;
    const amp = (s.scope ? 0.006 : 0.004) * calm * (0.8 + level * 0.3);
    s.kick = Math.max(0, s.kick - dt * 0.05);
    const L = look.v.current;
    S.camera.rotation.set(L.pitch + s.kick + Math.sin(s.t * 1.7) * amp, L.yaw + Math.sin(s.t * 1.1) * amp * 1.3, 0);
    const fov = s.scope ? 11 : 50;
    if (Math.abs(S.camera.fov - fov) > 0.1) {
      S.camera.fov += (fov - S.camera.fov) * Math.min(1, dt * 12);
      S.camera.updateProjectionMatrix();
    }
    s.flash = Math.max(0, s.flash - dt * 6);
    S.fx(dt);
    S.render();
    const sc = clamp01(s.hit / N);
    report(sc);
    if ((s.made >= N && s.tg.every((x) => !x.o)) || s.shots >= AMMO) {
      s.over = true;
      finish(sc);
    }
    tick((x) => (x + 1) % 1000);
  }, g.ready);
  const fire = () => {
    const s = st.current, S = g.S.current, k = g.K.current;
    if (!S || s.over || s.shots >= AMMO) return;
    s.shots++;
    s.flash = 1;
    const live = s.tg.filter((t) => t.alive && t.o).map((t) => t.o);
    const o = S.hit(center(S), live);
    const dir = new k.THREE.Vector3(0, 0, -1).applyEuler(S.camera.rotation);
    const far = S.camera.position.clone().add(dir.multiplyScalar(60));
    if (o) {
      const t = s.tg.find((q) => q.o === o);
      t.alive = false;
      s.hit++;
      o.rotation.x = -1.2;
      S.smoke(o.position.clone().add(new k.THREE.Vector3(0, 0.6, 0)), 0.5, false);
    } else S.smoke(far.setY(Math.max(0.2, far.y)), 0.3, false);
    s.kick += s.scope ? 0.012 : 0.03;
  };
  const s = st.current;
  return (
    <>
      <Hud items={[['명중', `${s.hit}/${N}`], ['남은 탄', AMMO - s.shots], ['숨', `${Math.round(s.breath * 100)}%`]]} />
      <Box3D r={g.ref} ready={g.ready} fail={g.fail} onPointerDown={look.down} onPointerMove={look.move} onPointerUp={look.up}>
        {s.scope ? <div className="fp-scope" /> : <div className="fp-cross" />}
        {s.flash > 0 && <div className="fp-flash" style={{ opacity: s.flash * 0.5 }} />}
        <p className="mg-tip">화면을 끌어 겨눠요 · 🔭 조준하고 🫁 숨을 참은 채 쏘면 정확해요</p>
      </Box3D>
      <div className="mg-3d-pad">
        <button className={s.scope ? 'primary' : ''} onClick={() => (st.current.scope = !st.current.scope)}>🔭 조준</button>
        <button onPointerDown={() => (st.current.hold = true)} onPointerUp={() => (st.current.hold = false)} onPointerLeave={() => (st.current.hold = false)}>🫁 숨 참기</button>
        <button className="gold" onClick={fire}>🔥 발사</button>
      </div>
    </>
  );
}

/* ═════ A-2 항공: 조종석 비행 ═════ */
export function FAirCockpit({ level, seed, report, finish }: MiniProps) {
  const rng = useRng(seed);
  const N = 12;
  const st = useRef({ t: 0, pos: null as any, yaw: 0, pitch: 0, roll: 0, sx: 0, sy: 0, drag: null as any, rings: [] as any[], passed: 0, missed: 0, crash: 0, over: false, warn: 0 });
  const [, tick] = useState(0);
  const g = use3D({ cam: [0, 10, 30], look: [0, 10, 0], fov: 62, sky: 0xa9cbe0 }, ['pine', 'tree'], (k, S) => {
    const T = k.THREE;
    k.floor(S.scene, k.MAT.grass, 900, 900);
    S.scene.fog = new T.Fog(0xa9cbe0, 60, 220);
    const rock = k.M(0x7d7468), snow = k.M(0xeef2f4);
    const path = (i: number) => new T.Vector3(Math.sin(i * 0.62) * 26, 10 + Math.sin(i * 1.3) * 5, -38 * i);
    for (let i = 1; i <= N; i++) {
      const p = path(i);
      const ring = new T.Mesh(new T.TorusGeometry(4, 0.35, 8, 28), k.M(0xf39a3d, { emissive: 0x6a3000 }));
      ring.position.copy(p);
      const nx = path(i + 1).sub(path(i - 1));
      ring.rotation.y = Math.atan2(nx.x, nx.z);
      S.scene.add(ring);
      st.current.rings.push({ o: ring, p, done: false });
    }
    // 산: 길 양옆 골짜기
    for (let i = 0; i < 70; i++) {
      const z = -rng.range(0, 38 * N + 60);
      const along = Math.sin((-z / 38) * 0.62) * 26;
      const side = rng.chance(0.5) ? 1 : -1;
      const x = along + side * rng.range(16, 70);
      const h = rng.range(14, 34), r = rng.range(8, 16);
      const m = new T.Mesh(new T.ConeGeometry(r, h, 7), rock);
      m.position.set(x, h / 2, z);
      S.scene.add(m);
      if (h > 24) {
        const c = new T.Mesh(new T.ConeGeometry(r * 0.32, h * 0.3, 7), snow);
        c.position.set(x, h * 0.86, z);
        S.scene.add(c);
      }
    }
    for (let i = 0; i < 60; i++) {
      const o = k.model(i % 2 ? 'pine' : 'tree');
      o.position.set(rng.range(-60, 60), 0, -rng.range(0, 38 * N));
      o.scale.multiplyScalar(3);
      S.scene.add(o);
    }
    S.camera.rotation.order = 'YXZ';
    st.current.pos = new T.Vector3(0, 10, 30);
    return {};
  });
  useLoop((dt) => {
    const s = st.current, S = g.S.current, k = g.K.current;
    if (!S || !k || s.over) return;
    s.t += dt;
    const sp = 15 + level * 3;
    s.yaw -= s.sx * 1.1 * dt;
    s.pitch = Math.max(-0.55, Math.min(0.55, s.pitch - s.sy * 0.9 * dt));
    if (!s.drag) s.pitch *= 1 - dt * 0.6;
    s.roll += (-s.sx * 0.6 - s.roll) * Math.min(1, dt * 4);
    const f = new k.THREE.Vector3(-Math.sin(s.yaw) * Math.cos(s.pitch), Math.sin(s.pitch), -Math.cos(s.yaw) * Math.cos(s.pitch));
    s.pos.addScaledVector(f, sp * dt);
    s.warn = Math.max(0, s.warn - dt);
    if (s.pos.y < 1.5) {
      s.crash++;
      s.pos.y = 8;
      s.pitch = 0.2;
      s.warn = 1.2;
      S.boom(s.pos.clone().setY(0.5), 2);
    }
    if (s.pos.y > 40) s.pos.y = 40;
    for (const r of s.rings) {
      if (r.done) continue;
      if (r.p.distanceTo(s.pos) < 4.3) {
        r.done = 'ok';
        s.passed++;
        r.o.material = k.M(0x3fc1b0, { emissive: 0x0d4a42 });
      } else if (s.pos.z < r.p.z - 6) {
        r.done = 'miss';
        s.missed++;
        r.o.material = k.M(0x777777);
      }
    }
    const next = s.rings.find((r) => !r.done);
    s.rings.forEach((r) => !r.done && r.o.scale.setScalar(r === next ? 1 + Math.sin(s.t * 6) * 0.05 : 1));
    S.camera.position.copy(s.pos);
    S.camera.rotation.set(s.pitch, s.yaw, s.roll);
    S.fx(dt);
    S.render();
    const sc = clamp01(s.passed / N - s.crash * 0.08);
    report(sc);
    if (!next) {
      s.over = true;
      finish(sc);
    }
    tick((x) => (x + 1) % 1000);
  }, g.ready);
  const s = st.current;
  const next = s.rings.find((r) => !r.done);
  let arrow = null;
  if (next && g.S.current) {
    const p = next.p.clone().project(g.S.current.camera);
    const behind = p.z > 1;
    const ax = Math.max(-0.9, Math.min(0.9, behind ? -p.x : p.x)), ay = Math.max(-0.85, Math.min(0.85, behind ? -p.y : p.y));
    if (behind || Math.abs(p.x) > 0.9 || Math.abs(p.y) > 0.85) arrow = { x: 50 + ax * 50, y: 50 - ay * 50 };
  }
  const down = (e) => (st.current.drag = { x: e.clientX, y: e.clientY });
  const move = (e) => {
    const d = st.current.drag;
    if (!d) return;
    const r = e.currentTarget.getBoundingClientRect();
    st.current.sx = Math.max(-1, Math.min(1, ((e.clientX - d.x) / r.width) * 3));
    st.current.sy = Math.max(-1, Math.min(1, ((e.clientY - d.y) / r.height) * 3));
  };
  const up = () => Object.assign(st.current, { drag: null, sx: 0, sy: 0 });
  return (
    <>
      <Hud items={[['통과', `${s.passed}/${N}`], ['놓침', s.missed], ['추락', s.crash], ['고도', `${Math.round((s.pos?.y ?? 0) * 30)}m`]]} />
      <Box3D r={g.ref} ready={g.ready} fail={g.fail} onPointerDown={down} onPointerMove={move} onPointerUp={up}>
        <div className="fp-hud-horizon" style={{ transform: `translate(-50%,-50%) rotate(${-deg(s.roll)}deg) translateY(${s.pitch * 120}px)` }} />
        <div className="fp-cockpit" />
        {arrow && <div className="fp-arrow" style={{ left: `${arrow.x}%`, top: `${arrow.y}%` }}>⭕</div>}
        {s.warn > 0 && <div className="fp-warn">⚠ 땅에 부딪혔어요!</div>}
        <p className="mg-tip">누른 채로 끌면 조종간: 옆으로 끌면 돌고, 아래로 끌면 올라가요 · 주황 고리를 통과</p>
      </Box3D>
    </>
  );
}

/* ═════ A-3 잠입: 1인칭 그림자 잠입 ═════ */
export function FSneakFP({ level, seed, report, finish }: MiniProps) {
  const rng = useRng(seed);
  const look = useLook(0, -0.08, 0.006);
  const st = useRef({ t: 0, x: 0, z: 13, fwd: false, crouch: true, sus: 0, over: false, guards: [] as any[], walls: [] as any[], goal: { x: 0, z: -13 }, start: 26, seen: false });
  const [, tick] = useState(0);
  const g = use3D({ cam: [0, 1, 13], look: [0, 1, 0], fov: 70, sky: 0x1c2a3a }, ['crate', 'barrel', 'container', 'tent', 'antenna', 'pine'], (k, S) => {
    const T = k.THREE;
    S.scene.fog = new T.Fog(0x1c2a3a, 8, 30);
    S.scene.children.forEach((c) => c.isLight && (c.intensity *= 0.55));
    k.floor(S.scene, k.MAT.dirt, 40, 40);
    const wallM = k.M(0x5d5a52);
    const W = st.current.walls;
    const addWall = (x, z, w, d, h = 2.2) => {
      const m = k.box(w, h, d, wallM, x, h / 2, z);
      S.scene.add(m);
      W.push({ x, z, w, d, m });
    };
    addWall(0, 15.5, 32, 1);
    addWall(0, -15.5, 32, 1);
    addWall(-15.5, 0, 1, 32);
    addWall(15.5, 0, 1, 32);
    // 가운데 엄폐물(씨앗마다 조금 다름)
    const cover = [[-6, 8, 5, 1], [5, 6, 1, 5], [-3, 1, 6, 1.2], [7, -2, 4, 1], [-8, -4, 1, 6], [2, -7, 6, 1], [-4, -10, 1, 4], [9, -10, 3, 1]];
    cover.forEach(([x, z, w, d]) => addWall(x + rng.range(-1, 1), z + rng.range(-0.6, 0.6), w, d, 1.6));
    for (let i = 0; i < 10; i++) {
      const o = k.model(['crate', 'barrel', 'container'][i % 3]);
      o.position.set(rng.range(-13, 13), 0, rng.range(-12, 12));
      o.scale.multiplyScalar(2.2);
      S.scene.add(o);
    }
    const flag = new T.Group();
    flag.add(k.box(0.06, 2, 0.06, k.MAT.metal, 0, 1, 0), k.box(0.7, 0.45, 0.04, k.M(0x3fc1b0, { emissive: 0x2a8a7c }), 0.36, 1.75, 0));
    flag.position.set(st.current.goal.x, 0, st.current.goal.z);
    S.scene.add(flag);
    const ant = k.model('antenna');
    ant.position.set(1.2, 0, -14);
    ant.scale.multiplyScalar(1.5);
    S.scene.add(ant);
    // 경비병 3명: 순찰 길 + 노란 시야 부채꼴
    const routes = [
      [[-12, 4], [12, 4]],
      [[10, -12], [10, 10], [-2, 10]],
      [[-12, -8], [4, -8], [4, -13]],
    ];
    const coneGeo = new T.CircleGeometry(7, 20, -0.62, 1.24);
    coneGeo.rotateX(-Math.PI / 2);
    const coneMat = new T.MeshBasicMaterial({ color: 0xffd34d, transparent: true, opacity: 0.22, depthWrite: false });
    routes.forEach((rt, i) => {
      const o = k.soldier('foe');
      o.scale.multiplyScalar(1.9);
      const lamp = new T.Mesh(coneGeo, coneMat.clone());
      lamp.position.y = 0.03;
      S.scene.add(o, lamp);
      st.current.guards.push({ o, lamp, rt, seg: 0, x: rt[0][0], z: rt[0][1], face: 0, sp: (1.3 + i * 0.15) * level, look: 0 });
    });
    S.camera.rotation.order = 'YXZ';
    return {};
  });
  const blocked = (x, z, pad = 0.35) => st.current.walls.some((w) => Math.abs(x - w.x) < w.w / 2 + pad && Math.abs(z - w.z) < w.d / 2 + pad);
  const los = (ax, az, bx, bz) => {
    const n = Math.ceil(Math.hypot(bx - ax, bz - az) / 0.3);
    for (let i = 1; i < n; i++) if (blocked(ax + ((bx - ax) * i) / n, az + ((bz - az) * i) / n, 0)) return false;
    return true;
  };
  useLoop((dt) => {
    const s = st.current, S = g.S.current, k = g.K.current;
    if (!S || !k || s.over) return;
    s.t += dt;
    const L = look.v.current;
    if (s.fwd) {
      const sp = s.crouch ? 1.6 : 3.2;
      const nx = s.x - Math.sin(L.yaw) * sp * dt, nz = s.z - Math.cos(L.yaw) * sp * dt;
      if (!blocked(nx, s.z)) s.x = nx;
      if (!blocked(s.x, nz)) s.z = nz;
    }
    const noise = s.fwd ? (s.crouch ? 1.2 : 4.5) : 0;
    s.seen = false;
    for (const gd of s.guards) {
      const [tx, tz] = gd.rt[(gd.seg + 1) % gd.rt.length];
      const dx = tx - gd.x, dz = tz - gd.z, d = Math.hypot(dx, dz);
      const pd = Math.hypot(s.x - gd.x, s.z - gd.z);
      if (pd < noise) gd.look = 1.5; // 소리를 듣고 돌아봄
      if (gd.look > 0) {
        gd.look -= dt;
        gd.face = Math.atan2(s.x - gd.x, s.z - gd.z);
      } else if (d < 0.1) gd.seg = (gd.seg + 1) % gd.rt.length;
      else {
        gd.x += (dx / d) * gd.sp * dt;
        gd.z += (dz / d) * gd.sp * dt;
        gd.face = Math.atan2(dx, dz);
        k.walk(gd.o, s.t, true);
      }
      gd.o.position.set(gd.x, 0, gd.z);
      gd.o.rotation.y = gd.face;
      gd.lamp.position.set(gd.x, 0.03, gd.z);
      gd.lamp.rotation.y = gd.face - Math.PI / 2;
      // 시야: 7m · 좌우 35도 · 벽에 가리면 못 봄
      let a = Math.atan2(s.x - gd.x, s.z - gd.z) - gd.face;
      a = Math.atan2(Math.sin(a), Math.cos(a));
      if (pd < 7 && Math.abs(a) < 0.62 && los(gd.x, gd.z, s.x, s.z)) {
        s.seen = true;
        s.sus += dt * (s.crouch ? 0.45 : 0.9) * (1 + (7 - pd) / 5) * level;
      }
      gd.lamp.material.color.setHex(s.seen && pd < 7 && Math.abs(a) < 0.62 ? 0xff5a3a : 0xffd34d);
    }
    if (!s.seen) s.sus = Math.max(0, s.sus - dt * 0.08);
    const left = Math.hypot(s.x - s.goal.x, s.z - s.goal.z);
    const prog = clamp01(1 - left / s.start);
    S.camera.position.set(s.x, s.crouch ? 0.75 : 1.4, s.z);
    S.camera.rotation.set(L.pitch + (s.fwd ? Math.sin(s.t * 9) * 0.01 : 0), L.yaw, 0);
    S.fx(dt);
    S.render();
    const sc = left < 1.4 ? clamp01(1 - s.sus * 0.4) : prog * 0.6 * (1 - s.sus * 0.5);
    report(sc);
    if (left < 1.4 || s.sus >= 1) {
      s.over = true;
      finish(s.sus >= 1 ? prog * 0.5 : sc);
    }
    tick((x) => (x + 1) % 1000);
  }, g.ready);
  const s = st.current;
  const yaw = look.v.current.yaw;
  const rel = (x, z) => {
    const dx = x - s.x, dz = z - s.z;
    const c = Math.cos(yaw), sn = Math.sin(yaw);
    const rx = dx * c - dz * sn, rz = dx * sn + dz * c;
    const m = 3.2;
    return { left: `${50 + Math.max(-46, Math.min(46, rx * m))}%`, top: `${50 + Math.max(-46, Math.min(46, rz * m))}%` };
  };
  return (
    <>
      <Hud items={[['들킴', `${Math.round(s.sus * 100)}%`], ['목표까지', `${Math.round(Math.hypot(s.x - s.goal.x, s.z - s.goal.z))}m`], ['자세', s.crouch ? '🧎 웅크림' : '🚶 서서']]} />
      <Box3D r={g.ref} ready={g.ready} fail={g.fail} onPointerDown={look.down} onPointerMove={look.move} onPointerUp={look.up}>
        <div className="fp-sus"><i style={{ width: `${Math.min(100, s.sus * 100)}%` }} /></div>
        <div className="fp-radar">
          {s.guards.map((gd, i) => (
            <span key={i} className="r-foe" style={rel(gd.x, gd.z)} />
          ))}
          <span className="r-goal" style={rel(s.goal.x, s.goal.z)} />
          <span className="r-me" />
        </div>
        {s.seen && <div className="fp-warn">👀 경비병이 보고 있어요!</div>}
        <p className="mg-tip">화면을 끌어 둘러봐요 · 노란 시야 밖으로 🚩 초록 깃발까지 · 서서 걸으면 발소리가 커요</p>
      </Box3D>
      <div className="mg-3d-pad">
        <button className={s.crouch ? 'primary' : ''} onClick={() => (st.current.crouch = !st.current.crouch)}>🧎 웅크리기</button>
        <button className="gold" onPointerDown={() => (st.current.fwd = true)} onPointerUp={() => (st.current.fwd = false)} onPointerLeave={() => (st.current.fwd = false)}>⬆ 누르는 동안 걷기</button>
      </div>
    </>
  );
}

/* ═════ A-4 포격: 관측병 무전 ═════ */
export function FArtyObserve({ level, seed, report, finish }: MiniProps) {
  const rng = useRng(seed);
  const N = 3, MAXR = 5, U = 20; // 1칸 = 20m
  const look = useLook(0, -0.12, 0.003);
  const st = useRef({ t: 0, i: 0, adj: { lr: 0, fn: 0 }, off: { x: 0, z: 0 }, rounds: 0, fly: null as any, got: [] as number[], over: false, tg: null as any, msg: '', endAt: 0 });
  const [, tick] = useState(0);
  const g = use3D({ cam: [0, 7, 0], look: [0, 0, -30], fov: 22 }, ['tank', 'spg', 'tent', 'tree', 'pine', 'houseA', 'rock', 'bush'], (k, S) => {
    k.floor(S.scene, k.MAT.grass, 300, 300);
    for (let i = 0; i < 60; i++) {
      const o = k.model(['tree', 'pine', 'bush', 'rock'][i % 4]);
      o.position.set(rng.range(-40, 40), 0, -rng.range(14, 80));
      S.scene.add(o);
    }
    for (let i = 0; i < 4; i++) {
      const o = k.model('houseA');
      o.position.set(rng.range(-25, 25), 0, -rng.range(30, 70));
      o.scale.multiplyScalar(1.6);
      S.scene.add(o);
    }
    S.camera.rotation.order = 'YXZ';
    return {};
  });
  const newTarget = () => {
    const s = st.current, S = g.S.current, k = g.K.current;
    const o = k.model(['tank', 'spg', 'tent'][s.i % 3], 'foe');
    const z = -rng.range(26, 46), x = rng.range(-0.28, 0.28) * -z;
    o.position.set(x, 0, z);
    o.rotation.y = rng.range(0, 6);
    o.scale.multiplyScalar(1.5);
    S.scene.add(o);
    const sgn = () => (rng.chance(0.5) ? 1 : -1);
    s.tg = { o, x, z };
    const step = () => (1 + Math.floor(rng.next() * (level > 1.4 ? 4 : 3))) * 2.5 + rng.range(-0.6, 0.6);
    s.off = { x: sgn() * step(), z: sgn() * step() };
    s.adj = { lr: 0, fn: 0 };
    s.rounds = 0;
    s.msg = `표적 ${s.i + 1}: ${['적 전차', '적 자주포', '적 지휘 천막'][s.i % 3]}. 첫 탄을 요청하세요.`;
  };
  useLoop((dt) => {
    const s = st.current, S = g.S.current, k = g.K.current;
    if (!S || !k || s.over) return;
    s.t += dt;
    if (!s.tg && s.i < N) newTarget();
    if (s.fly && s.t >= s.fly.at) {
      const p = s.fly.p;
      s.fly = null;
      S.boom(new k.THREE.Vector3(p.x, 0.3, p.z), 1.4);
      const miss = Math.hypot(p.x - s.tg.x, p.z - s.tg.z);
      if (miss < 2) {
        s.got.push(s.rounds);
        s.tg.o.traverse((m) => m.isMesh && (m.material = k.MAT.black));
        S.smoke(s.tg.o.position.clone(), 1.2, true);
        s.msg = `명중! 표적 파괴 (${s.rounds}발)`;
        s.endAt = s.t + 1.8;
      } else if (s.rounds >= MAXR) {
        s.got.push(0);
        s.msg = '포탄을 다 썼어요. 표적이 빠져나갔어요.';
        s.endAt = s.t + 1.8;
      } else s.msg = `탄착! 표적에서 약 ${Math.round(miss * U / 10) * 10}m. 보고 고쳐 불러요.`;
    }
    if (s.endAt && s.t > s.endAt) {
      s.endAt = 0;
      S.scene.remove(s.tg.o);
      s.tg = null;
      s.i++;
      if (s.i >= N) {
        s.over = true;
        finish(sc());
      }
    }
    const L = look.v.current;
    S.camera.rotation.set(L.pitch, L.yaw, 0);
    S.fx(dt);
    S.render();
    report(sc());
    tick((x) => (x + 1) % 1000);
  }, g.ready);
  const sc = () => clamp01(st.current.got.reduce((a, r) => a + (r ? 1 - (r - 1) * 0.15 : 0), 0) / N);
  const call = () => {
    const s = st.current, S = g.S.current, k = g.K.current;
    if (!S || !s.tg || s.fly || s.endAt || s.rounds >= MAXR) return;
    s.rounds++;
    const p = { x: s.tg.x + s.off.x + (s.adj.lr * 50) / U + rng.range(-0.4, 0.4), z: s.tg.z + s.off.z - (s.adj.fn * 50) / U + rng.range(-0.4, 0.4) };
    s.fly = { p, at: s.t + 2.2 };
    s.msg = '📻 "사격, 탄착 대기…"';
  };
  const s = st.current;
  const adj = (lr, fn) => !s.fly && !s.endAt && ((st.current.adj.lr += lr), (st.current.adj.fn += fn));
  const say = `${s.adj.lr ? `${s.adj.lr < 0 ? '좌' : '우'} ${Math.abs(s.adj.lr) * 50}` : ''}${s.adj.lr && s.adj.fn ? ' · ' : ''}${s.adj.fn ? `${s.adj.fn > 0 ? '멀리' : '가까이'} ${Math.abs(s.adj.fn) * 50}` : ''}` || '수정 없음';
  return (
    <>
      <Hud items={[['표적', `${Math.min(N, s.i + 1)}/${N}`], ['이번 표적 포탄', `${s.rounds}/${MAXR}`], ['수정', say]]} />
      <Box3D r={g.ref} ready={g.ready} fail={g.fail} onPointerDown={look.down} onPointerMove={look.move} onPointerUp={look.up}>
        <svg className="fp-bino" viewBox="0 0 100 100" preserveAspectRatio="none">
          <path fillRule="evenodd" fill="#000" d="M0 0H100V100H0Z M4 50a24 30 0 1 0 48 0a24 30 0 1 0 -48 0Z M48 50a24 30 0 1 0 48 0a24 30 0 1 0 -48 0Z" />
          <path d="M30 50H70M50 44V56" stroke="#000a" strokeWidth="0.4" />
        </svg>
        <p className="mg-tip">{s.msg}</p>
      </Box3D>
      <div className="mg-3d-pad">
        <button onClick={() => adj(-1, 0)}>◀ 좌 50</button>
        <button onClick={() => adj(1, 0)}>우 50 ▶</button>
        <button onClick={() => adj(0, -1)}>▼ 가까이 50</button>
        <button onClick={() => adj(0, 1)}>▲ 멀리 50</button>
      </div>
      <div className="mg-3d-pad">
        <button className="gold" disabled={!!s.fly || !!s.endAt} onClick={call}>📻 사격 요청</button>
      </div>
    </>
  );
}

/* ═════ A-5 해상: 함교 조함 ═════ */
export function FSeaBridge({ level, seed, report, finish }: MiniProps) {
  const rng = useRng(seed);
  const THR = [-1, 0, 1.4, 2.8, 4.2];
  const THN = ['후진', '정지', '저속', '반속', '전속'];
  const look = useLook(0, -0.12, 0.005);
  const st = useRef({ t: 0, x: 0, z: 40, h: 0, v: 0, thr: 3, rud: 0, cur: { x: rng.range(-0.4, 0.4) * level, z: 0 }, hit: 0, over: false, buoys: [] as any[], ship: null, berth: { x: rng.range(-8, 8), z: -46, h: 0 }, msg: '', cool: 0 });
  const [, tick] = useState(0);
  const g = use3D({ cam: [0, 4, 44], look: [0, 2, 0], fov: 60, sky: 0xb5d0e0 }, ['container', 'crate', 'dock', 'boat'], (k, S) => {
    const T = k.THREE;
    k.floor(S.scene, k.MAT.water, 400, 400);
    const s = st.current;
    // 부두: 선석 양옆 콘크리트, 가운데 초록 칸
    const pierM = k.MAT.conc;
    S.scene.add(k.box(60, 1.2, 14, pierM, 0, 0.6, s.berth.z - 12));
    S.scene.add(k.box(5, 1.2, 16, pierM, s.berth.x - 6, 0.6, s.berth.z + 2), k.box(5, 1.2, 16, pierM, s.berth.x + 6, 0.6, s.berth.z + 2));
    const slot = new T.Mesh(new T.PlaneGeometry(6, 14), new T.MeshBasicMaterial({ color: 0x3fc1b0, transparent: true, opacity: 0.35 }));
    slot.rotation.x = -Math.PI / 2;
    slot.position.set(s.berth.x, 0.08, s.berth.z + 2);
    S.scene.add(slot);
    for (let i = 0; i < 12; i++) {
      const o = k.model(i % 3 ? 'container' : 'crate');
      o.position.set(-28 + i * 5, 1.2, s.berth.z - 14 + (i % 2) * 3);
      o.scale.multiplyScalar(3);
      S.scene.add(o);
    }
    // 항로 부표(빨강 왼쪽·초록 오른쪽)
    for (let i = 0; i < 5; i++) {
      const z = 26 - i * 13, cx = (s.berth.x * (26 - z)) / 72 + (i ? Math.sin(i * 1.4) * 3 : 0);
      [[-5, 0xd23b2b], [5, 0x2bb35a]].forEach(([dx, c]) => {
        const b = new T.Mesh(new T.CylinderGeometry(0.4, 0.6, 1.4, 8), k.M(c, { emissive: c, emissiveIntensity: 0.2 }));
        b.position.set(cx + dx, 0.6, z);
        S.scene.add(b);
        s.buoys.push({ x: cx + dx, z, hit: false });
      });
    }
    for (let i = 0; i < 4; i++) {
      const o = k.model('boat');
      o.position.set(rng.range(-30, 30), 0, rng.range(-30, 30));
      if (Math.abs(o.position.x) < 12) o.position.x += 24;
      o.scale.multiplyScalar(4);
      S.scene.add(o);
    }
    const ship = k.ship('us', 12);
    S.scene.add(ship);
    s.ship = ship;
    S.camera.rotation.order = 'YXZ';
    return {};
  });
  useLoop((dt) => {
    const s = st.current, S = g.S.current, k = g.K.current;
    if (!S || !k || s.over) return;
    s.t += dt;
    s.v += (THR[s.thr] - s.v) * Math.min(1, dt * 0.25);
    s.h += s.rud * 0.22 * (s.v / 3) * dt;
    const fx = -Math.sin(s.h), fz = -Math.cos(s.h);
    s.x += (fx * s.v + s.cur.x) * dt;
    s.z += (fz * s.v + s.cur.z) * dt;
    s.cool = Math.max(0, s.cool - dt);
    for (const b of s.buoys) {
      if (!b.hit && Math.hypot(b.x - s.x, b.z - s.z) < 2) {
        b.hit = true;
        s.hit++;
        s.msg = '⚠ 부표에 부딪혔어요!';
        s.cool = 1.5;
      }
    }
    // 부두 벽: 선석 밖이면 멈춤
    const inSlot = Math.abs(s.x - s.berth.x) < 3.3;
    if (s.z < s.berth.z + 6 && !inSlot && s.z > s.berth.z - 6) {
      s.z = s.berth.z + 6;
      if (s.v > 0.5) s.hit++, (s.msg = '⚠ 부두에 부딪혔어요!');
      s.v = 0;
    }
    if (s.z < s.berth.z - 4) (s.z = s.berth.z - 4), s.v > 1 && (s.hit++, (s.msg = '⚠ 너무 빨리 들어왔어요!')), (s.v = 0);
    s.ship.position.set(s.x, 0, s.z);
    s.ship.rotation.y = s.h + Math.PI;
    s.ship.rotation.z = Math.sin(s.t * 0.9) * 0.015;
    const L = look.v.current;
    S.camera.position.set(s.x + Math.sin(s.h) * 2.5, 4.2 + Math.sin(s.t * 0.9) * 0.08, s.z + Math.cos(s.h) * 2.5);
    S.camera.rotation.set(L.pitch, s.h + L.yaw, 0);
    S.fx(dt);
    S.render();
    report(sc());
    if (s.t > 110 + 20 / level) {
      s.over = true;
      finish(sc());
    }
    tick((x) => (x + 1) % 1000);
  }, g.ready);
  const dist = () => Math.hypot(st.current.x - st.current.berth.x, st.current.z - (st.current.berth.z + 1));
  const sc = () => clamp01(0.6 * (1 - dist() / 85) - st.current.hit * 0.08);
  const moor = () => {
    const s = st.current;
    if (s.over) return;
    let a = s.h % (Math.PI * 2);
    a = Math.abs(Math.atan2(Math.sin(a), Math.cos(a)));
    if (dist() < 5 && Math.abs(s.v) < 0.8 && a < 0.3) {
      s.over = true;
      finish(clamp01(1 - s.hit * 0.1 - a * 0.4 - Math.abs(s.v) * 0.1));
    } else s.msg = dist() >= 5 ? '아직 선석(초록 칸)에 들어오지 않았어요' : Math.abs(s.v) >= 0.8 ? '너무 빨라요. 정지에 놓고 기다려요' : '배가 비스듬해요. 곧게 맞춰요';
  };
  const s = st.current;
  return (
    <>
      <Hud items={[['속도', `${(s.v * 4).toFixed(1)}노트`], ['키', s.rud ? `${s.rud < 0 ? '좌' : '우'} ${Math.abs(s.rud * 30)}°` : '중앙'], ['선석까지', `${Math.round(dist() * 10)}m`], ['충돌', s.hit]]} />
      <Box3D r={g.ref} ready={g.ready} fail={g.fail} onPointerDown={look.down} onPointerMove={look.move} onPointerUp={look.up}>
        <div className="fp-wheel" style={{ transform: `translateX(-50%) rotate(${s.rud * 90}deg)` }}>☸</div>
        {s.cool > 0 && <div className="fp-warn">{s.msg}</div>}
        <p className="mg-tip">{s.cool > 0 ? '' : s.msg || '빨강·초록 부표 사이로 · 조류에 밀려요 · 초록 선석에 천천히 곧게 대고 ⚓ 계류'}</p>
      </Box3D>
      <div className="mg-3d-pad">
        <button onClick={() => (st.current.rud = Math.max(-1, st.current.rud - 0.25))}>◀ 좌현</button>
        <button onClick={() => (st.current.rud = 0)}>키 중앙</button>
        <button onClick={() => (st.current.rud = Math.min(1, st.current.rud + 0.25))}>우현 ▶</button>
      </div>
      <div className="mg-3d-pad">
        <button onClick={() => (st.current.thr = Math.max(0, st.current.thr - 1))}>▼ 감속</button>
        <b style={{ alignSelf: 'center', minWidth: 48, textAlign: 'center' }}>{THN[s.thr]}</b>
        <button onClick={() => (st.current.thr = Math.min(4, st.current.thr + 1))}>▲ 가속</button>
        <button className="gold" onClick={moor}>⚓ 계류</button>
      </div>
    </>
  );
}

/* ═════ A-6 체력: 3D 달리기 코스 ═════ */
export function FFitRun({ level, seed, report, finish }: MiniProps) {
  const rng = useRng(seed);
  const N = 30;
  const LANE = [-1.6, 0, 1.6];
  const st = useRef({ t: 0, lane: 1, x: 0, jump: 0, crawl: 0, sta: 100, obs: [] as any[], made: 0, next: 1.2, ok: 0, bad: 0, over: false, me: null, sw: null as any });
  const [, tick] = useState(0);
  const g = use3D({ cam: [0, 3.2, 5.5], look: [0, 0.6, -6], fov: 55 }, ['tree', 'pine', 'bush', 'tent', 'barrel'], (k, S) => {
    k.floor(S.scene, k.MAT.grass, 200, 200);
    const track = k.floor(S.scene, k.MAT.dirt, 6, 200, 0.01);
    track.position.z = -60;
    const me = k.soldier('us');
    me.scale.multiplyScalar(1.3);
    me.rotation.y = Math.PI;
    S.scene.add(me);
    st.current.me = me;
    st.current.trees = [];
    for (let i = 0; i < 30; i++) {
      const o = k.model(['tree', 'pine', 'bush', 'tent'][i % 4]);
      o.position.set((i % 2 ? 1 : -1) * rng.range(5, 14), 0, -i * 4);
      S.scene.add(o);
      st.current.trees.push(o);
    }
    return {};
  });
  const spawn = (k, S) => {
    const s = st.current;
    const kind = rng.pick(['hurdle', 'wire', 'wall', 'wall', 'water']);
    const lanes = kind === 'wall' ? [rng.pick([0, 1, 2])] : kind === 'water' ? [rng.pick([0, 1, 2])] : [0, 1, 2];
    const T = k.THREE;
    const grp = new T.Group();
    lanes.forEach((l) => {
      const x = LANE[l];
      if (kind === 'hurdle') grp.add(k.box(1.3, 0.12, 0.12, k.M(0xf3c23d), x, 0.45, 0), k.box(0.08, 0.45, 0.08, k.MAT.metal, x - 0.6, 0.22, 0), k.box(0.08, 0.45, 0.08, k.MAT.metal, x + 0.6, 0.22, 0));
      if (kind === 'wire') grp.add(k.box(1.5, 0.05, 0.05, k.M(0x9aa0a6), x, 0.75, 0), k.box(1.5, 0.05, 0.05, k.M(0x9aa0a6), x, 0.95, 0), k.box(0.06, 1, 0.06, k.MAT.metal, x - 0.7, 0.5, 0), k.box(0.06, 1, 0.06, k.MAT.metal, x + 0.7, 0.5, 0));
      if (kind === 'wall') grp.add(k.box(1.4, 1.8, 0.5, k.M(0x8a857a), x, 0.9, 0));
      if (kind === 'water') grp.add(k.box(0.25, 0.45, 0.25, k.M(0x4fb0e8, { emissive: 0x1a5a80 }), x, 0.5, 0));
    });
    grp.position.z = -55;
    S.scene.add(grp);
    s.obs.push({ o: grp, kind, lanes, done: false });
  };
  useLoop((dt) => {
    const s = st.current, S = g.S.current, k = g.K.current;
    if (!S || !k || s.over) return;
    s.t += dt;
    const sp = (11 + s.t * 0.08) * (0.8 + level * 0.25);
    if (s.made < N && s.t > s.next) {
      s.made++;
      s.next = s.t + rng.range(1.1, 1.7) / level;
      spawn(k, S);
    }
    s.jump = Math.max(0, s.jump - dt);
    s.crawl = Math.max(0, s.crawl - dt);
    s.sta = Math.max(0, s.sta - dt * 1.3);
    s.x += (LANE[s.lane] - s.x) * Math.min(1, dt * 12);
    for (const o of s.obs) {
      o.o.position.z += sp * dt;
      if (!o.done && o.o.position.z > -0.3) {
        o.done = true;
        const here = o.lanes.includes(s.lane);
        if (o.kind === 'water') {
          if (here) (s.sta = Math.min(100, s.sta + 18)), (o.o.visible = false);
          continue;
        }
        const pass = !here || (o.kind === 'hurdle' && s.jump > 0) || (o.kind === 'wire' && s.crawl > 0);
        if (pass) s.ok++;
        else {
          s.bad++;
          s.sta = Math.max(0, s.sta - 15);
          S.smoke(new k.THREE.Vector3(s.x, 0.6, -0.4), 0.5, false);
        }
      }
      if (o.o.position.z > 8) (S.scene.remove(o.o), (o.gone = true));
    }
    s.obs = s.obs.filter((o) => !o.gone);
    for (const tr of s.trees) {
      tr.position.z += sp * dt;
      if (tr.position.z > 8) tr.position.z -= 120;
    }
    const me = s.me;
    me.position.set(s.x, s.jump > 0 ? Math.sin((1 - s.jump / 0.7) * Math.PI) * 1.1 : 0, 0);
    me.rotation.x = s.crawl > 0 ? -1.35 : 0;
    if (s.crawl > 0) me.position.y = 0.15;
    k.walk(me, s.t * 1.4, s.jump <= 0);
    S.fx(dt);
    S.render();
    const tot = s.obs.length ? s.ok + s.bad : s.ok + s.bad;
    const sc = clamp01((s.ok - s.bad * 0.5) / Math.max(1, N * 0.6));
    report(sc);
    if (s.sta <= 0 || (s.made >= N && s.obs.every((o) => o.done))) {
      s.over = true;
      finish(sc);
    }
    void tot;
    tick((x) => (x + 1) % 1000);
  }, g.ready);
  const act = (a) => {
    const s = st.current;
    if (a === 'L') s.lane = Math.max(0, s.lane - 1);
    if (a === 'R') s.lane = Math.min(2, s.lane + 1);
    if (a === 'U' && s.jump <= 0 && s.crawl <= 0) (s.jump = 0.7), (s.sta = Math.max(0, s.sta - 4));
    if (a === 'D' && s.jump <= 0) s.crawl = 0.9;
  };
  const down = (e) => (st.current.sw = { x: e.clientX, y: e.clientY });
  const up = (e) => {
    const d = st.current.sw;
    st.current.sw = null;
    if (!d) return;
    const dx = e.clientX - d.x, dy = e.clientY - d.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 18) return;
    act(Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'L' : 'R') : dy < 0 ? 'U' : 'D');
  };
  const s = st.current;
  return (
    <>
      <Hud items={[['통과', s.ok], ['걸림', s.bad], ['남은 장애물', N - s.made + s.obs.filter((o) => !o.done).length]]} />
      <Box3D r={g.ref} ready={g.ready} fail={g.fail} onPointerDown={down} onPointerUp={up}>
        <div className="fp-sta"><small>숨</small><i style={{ width: `${s.sta}%` }} className={s.sta < 30 ? 'low' : ''} /></div>
        <p className="mg-tip">밀어서 조작: ◀▶ 줄 바꾸기 · ⬆ 넘기(노란 허들) · ⬇ 포복(철조망) · 💧 물병은 숨 회복</p>
      </Box3D>
      <div className="mg-3d-pad">
        <button onClick={() => act('L')}>◀</button>
        <button onClick={() => act('U')}>⬆ 넘기</button>
        <button onClick={() => act('D')}>⬇ 포복</button>
        <button onClick={() => act('R')}>▶</button>
      </div>
    </>
  );
}
