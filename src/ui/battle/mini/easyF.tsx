// @ts-nocheck
// 11-27 한 손가락 미니 훈련(2차 ④) — "놓기" 7개: 미리 놓아 두고 ▶ 시작하면 저절로 펼쳐짐.
import { useRef, useState } from 'react';
import { Hud, clamp01, useLoop, useRng, type MiniProps } from './kit';
import { Box3D, use3D } from './three';
import { V, lerp, ringMesh, scatter } from './easyC';
import { coverScore, dockScore, dockShips } from '../../../battle/easyLogic';
import { sceneArt } from '../../scenes';

const useTick = () => {
  const [, t] = useState(0);
  return () => t((x) => (x + 1) % 1000);
};

/* ───────── 덮기 틀 ───────── */
function CoverGame({ level, seed, report, finish, skin }: MiniProps & { skin }) {
  const rng = useRng(seed);
  const st = useRef({ i: 0, map: skin.gen(rng, level), marks: [] as number[][], picks: [] as number[], phase: 'place', t: 0, sum: 0, last: 0, built: -1, over: false });
  const tick = useTick();
  const g = use3D({ cam: skin.cam ?? [0, 17, 8.5], look: skin.look ?? [0, 0, 0.5], sky: skin.sky }, skin.models, (k, S) => ({ ...skin.build(k, S, rng), tmp: [], mk: [] }));
  const clear = (list) => {
    list.forEach((o) => g.S.current.scene.remove(o));
    list.length = 0;
  };
  const redraw = () => {
    const S = g.S.current, k = g.K.current, W = g.W.current, s = st.current;
    clear(W.mk);
    s.marks.forEach(([x, z]) => {
      const o = skin.marker(k);
      o.position.set(x, 0, z);
      const ring = ringMesh(k, skin.R, skin.ringCol ?? 0x7fd4ff, 0.1);
      ring.position.set(x, 0.06, z);
      S.scene.add(o, ring);
      W.mk.push(o, ring);
    });
  };
  useLoop((dt) => {
    const s = st.current, S = g.S.current, k = g.K.current, W = g.W.current;
    if (!S || !k || !W || s.over) return;
    s.t += dt;
    if (s.built !== s.i) {
      s.built = s.i;
      clear(W.tmp);
      clear(W.mk);
      skin.spawn({ k, S, W, map: s.map, add: (o) => (S.scene.add(o), W.tmp.push(o), o) });
    }
    skin.tick?.({ k, S, W, s, dt, map: s.map });
    if (s.phase === 'run' && s.t > 2.6) {
      s.sum += s.last;
      s.i++;
      if (s.i >= skin.rounds) {
        s.over = true;
        return finish(clamp01(s.sum / skin.rounds));
      }
      Object.assign(s, { map: skin.gen(rng, level), marks: [], picks: [], phase: 'place', t: 0 });
    }
    S.fx(dt);
    S.render();
    report(clamp01(s.sum / skin.rounds));
    tick();
  }, g.ready);
  const down = (e) => {
    const s = st.current, S = g.S.current, W = g.W.current;
    if (!S || s.phase !== 'place') return;
    if (skin.pick) {
      const o = S.hit(e, W.tmp.filter((x) => x.userData.cand != null));
      if (!o) return;
      const i = o.userData.cand;
      if (s.picks.includes(i)) s.picks = s.picks.filter((x) => x !== i);
      else if (s.picks.length < skin.markers) s.picks.push(i);
      s.marks = s.picks.map((c) => [s.map.cands[c].x, s.map.cands[c].z]);
      return redraw();
    }
    const p = S.ground(e);
    if (!p || Math.abs(p.x) > 8 || Math.abs(p.z) > 8) return;
    const near = s.marks.findIndex((m) => Math.hypot(m[0] - p.x, m[1] - p.z) < 0.9);
    if (near >= 0) s.marks.splice(near, 1);
    else {
      if (s.marks.length >= skin.markers) s.marks.shift();
      s.marks.push([p.x, p.z]);
    }
    redraw();
  };
  const start = () => {
    const s = st.current;
    s.last = skin.pick ? s.picks.filter((c) => s.map.cands[c].good).length / skin.markers : coverScore(s.map.targets, s.marks, skin.markers, skin.R);
    s.phase = 'run';
    s.t = 0;
    skin.play?.({ k: g.K.current, S: g.S.current, W: g.W.current, s, map: s.map });
  };
  const s = st.current;
  return (
    <>
      <Hud items={[['판', `${Math.min(skin.rounds, s.i + 1)}/${skin.rounds}`], [skin.unit, `${s.marks.length}/${skin.markers}`], ['방금', s.phase === 'run' ? `${Math.round(s.last * 100)}점` : '-']]} />
      <Box3D r={g.ref} ready={g.ready} fail={g.fail} onPointerDown={down}>
        <p className="mg-tip">{s.phase === 'place' ? skin.tip : skin.runTip}</p>
      </Box3D>
      {s.phase === 'place' && (
        <div className="eg-chips one">
          <button className="primary" disabled={s.marks.length < skin.markers} onClick={start}>
            ▶ 시작 {s.marks.length < skin.markers ? `(${skin.unit} ${skin.markers - s.marks.length}개 더)` : ''}
          </button>
        </div>
      )}
    </>
  );
}

const cluster = (rng, n, cx, cz, spread) => Array.from({ length: n }, () => [cx + rng.range(-spread, spread), cz + rng.range(-spread, spread)]);

/* 포격 · 다연장 한 방 */
const C_MLRS = {
  rounds: 3, markers: 1, R: 3, unit: '표적 원', models: ['tank', 'tree', 'rock', 'tent'], ringCol: 0xffd84a,
  tip: '한 번만 쏠 수 있어요 · 가장 많이 덮는 자리를 눌러요(전차는 2점)', runTip: '🚀 다연장 발사!',
  build(k, S) {
    k.floor(S.scene, k.M(0x77784f), 60, 60);
    scatter(k, S, ['tree', 'rock'], 12, (i) => [-9 + i * 1.6, i % 2 ? -8.5 : 8.5], 0.7);
    return {};
  },
  gen(rng, lv) {
    const targets = [];
    const groups = 3 + (lv > 1.4 ? 1 : 0);
    for (let gI = 0; gI < groups; gI++) {
      const cx = rng.range(-5.5, 5.5), cz = rng.range(-5.5, 5.5);
      cluster(rng, 3 + Math.floor(rng.next() * 4), cx, cz, 1.7).forEach(([x, z]) => targets.push({ x, z, w: rng.chance(0.35) ? 2 : 1 }));
    }
    return { targets };
  },
  marker: (k) => new k.THREE.Group(),
  spawn({ k, map, add }) {
    map.targets.forEach((t) => {
      const o = t.w === 2 ? k.model('tank', 'foe') : k.soldier('foe');
      o.position.set(t.x, 0, t.z);
      o.userData.t = t;
      add(o);
    });
  },
  play({ k, S, W, s }) {
    const [mx, mz] = s.marks[0];
    for (let i = 0; i < 9; i++) S.boom(V(k, mx + (Math.random() - 0.5) * 5, 0.2, mz + (Math.random() - 0.5) * 5), 1 + Math.random());
    W.tmp.forEach((o) => {
      if (o.userData.t && Math.hypot(o.userData.t.x - mx, o.userData.t.z - mz) <= 3) o.visible = false;
    });
  },
};

/* 모병 · 포스터 붙이기 */
const C_POSTER = {
  rounds: 2, markers: 4, R: 2, unit: '포스터', models: ['b2w', 'b1g', 'b3s', 'tree', 'houseA', 'houseB'], ringCol: 0x5dff8a,
  tip: '사람이 많이 모인 곳을 눌러 포스터 4장을 놓아요 · 다시 누르면 떼요', runTip: '📣 사람들이 포스터를 봐요',
  build(k, S) {
    k.floor(S.scene, k.MAT.conc, 60, 60);
    scatter(k, S, ['b2w', 'b1g', 'b3s', 'houseA', 'houseB', 'tree'], 12, (i) => [-9 + (i % 6) * 3.6, i < 6 ? -8.6 : 8.8], 1.1);
    return {};
  },
  gen(rng, lv) {
    const targets = [];
    for (let gI = 0; gI < 5 + (lv > 1.4 ? 1 : 0); gI++) cluster(rng, 2 + Math.floor(rng.next() * 5), rng.range(-6, 6), rng.range(-6, 6), 1.2).forEach(([x, z]) => targets.push({ x, z, w: 1 }));
    return { targets };
  },
  marker(k) {
    const o = k.box(0.1, 1.4, 0.1, k.MAT.metal, 0, 0.7, 0);
    o.add(k.box(0.9, 0.7, 0.06, k.M(0x3fb8c9), 0, 0.5, 0));
    const grp = new k.THREE.Group();
    grp.add(o);
    return grp;
  },
  spawn({ k, map, add }) {
    map.targets.forEach((t) => {
      const o = k.soldier('civ');
      o.position.set(t.x, 0, t.z);
      o.rotation.y = Math.random() * 6;
      o.userData.t = t;
      add(o);
    });
  },
  tick({ W, s }) {
    if (s.phase !== 'run') return;
    W.tmp.forEach((o) => {
      if (o.userData.t && s.marks.some((m) => Math.hypot(m[0] - o.userData.t.x, m[1] - o.userData.t.z) <= 2)) o.position.y = Math.abs(Math.sin(s.t * 8 + o.userData.t.x)) * 0.35;
    });
  },
};

/* 해킹 · 가짜 신호 심기 */
const C_DECOY = {
  rounds: 3, markers: 3, R: 2.6, unit: '가짜 표적', models: ['heli', 'jet'], sky: 0x07131c, ringCol: 0x5dff8a,
  tip: '적 요격기(빨간 헬기) 가까이에 가짜 표적 3개를 놓아 꾀어내요', runTip: '✈️ 진짜 편대가 지나가요',
  build(k, S) {
    k.floor(S.scene, k.M(0x0f2a2e), 60, 60);
    for (let r = 2; r <= 8; r += 2) {
      const c = ringMesh(k, r, 0x1f6b5a, 0.04);
      c.position.y = 0.02;
      S.scene.add(c);
    }
    const flight = k.model('jet', 'us');
    flight.rotation.y = Math.PI;
    flight.scale.multiplyScalar(1.2);
    S.scene.add(flight);
    return { flight };
  },
  gen(rng, lv) {
    const n = 5 + Math.round(lv * 1.5);
    const targets = [];
    let guard = 0;
    while (targets.length < n && guard++ < 200) {
      const x = rng.range(-6.5, 6.5), z = rng.range(-6.5, 6.5);
      if (!targets.some((t) => Math.hypot(t.x - x, t.z - z) < 1.3)) targets.push({ x, z, w: 1 });
    }
    return { targets };
  },
  marker(k) {
    const o = new k.THREE.Mesh(new k.THREE.OctahedronGeometry(0.35), new k.THREE.MeshBasicMaterial({ color: 0x5dff8a, wireframe: true }));
    o.position.y = 0.6;
    const grp = new k.THREE.Group();
    grp.add(o);
    return grp;
  },
  spawn({ k, W, map, add }) {
    W.flight.position.set(0, 1.2, 9.5);
    map.targets.forEach((t) => {
      const o = k.model('heli', 'foe');
      o.scale.multiplyScalar(0.7);
      o.position.set(t.x, 0.6, t.z);
      o.userData.t = t;
      add(o);
    });
  },
  tick({ k, S, W, s, dt }) {
    W.tmp.forEach((o) => o.userData.t && (o.rotation.y += dt * 2));
    if (s.phase !== 'run') return;
    W.flight.position.z = lerp(9.5, -9.5, Math.min(1, s.t / 2.4));
    W.tmp.forEach((o) => {
      const t = o.userData.t;
      if (!t) return;
      const lured = s.marks.some((m) => Math.hypot(m[0] - t.x, m[1] - t.z) <= 2.6);
      if (!lured && Math.random() < dt * 3) S.tracer(V(k, t.x, 0.8, t.z), W.flight.position.clone(), 0xff5a4a);
    });
  },
};

/* 해상 · 함대 대형 */
const C_FLEET = {
  rounds: 3, markers: 4, R: 2.3, unit: '호위함', models: ['boat'], sky: 0x8fb6cc, ringCol: 0x7fd4ff,
  tip: '빨간 화살(적이 올 쪽)과 항모 사이에 호위함 4척을 놓아요', runTip: '🚀 적 미사일이 날아와요',
  build(k, S) {
    k.floor(S.scene, k.MAT.water, 80, 80);
    const cv = new k.THREE.Group();
    cv.add(k.box(1.3, 0.5, 4.2, k.M(0x4d6684), 0, 0.25, 0), k.box(1.5, 0.08, 4.4, k.M(0x33465d), 0, 0.54, 0), k.box(0.35, 0.7, 0.8, k.M(0x7590ae), 0.5, 0.9, 0.4));
    S.scene.add(cv);
    return { cv };
  },
  gen(rng, lv) {
    const n = 4 + (lv > 1.3 ? 1 : 0) + (lv > 1.7 ? 1 : 0);
    const targets = [];
    let guard = 0;
    while (targets.length < n && guard++ < 200) {
      const a = rng.range(0, Math.PI * 2);
      const t = { x: Math.cos(a) * 3.6, z: Math.sin(a) * 3.6, w: 1, a };
      if (!targets.some((o) => Math.hypot(o.x - t.x, o.z - t.z) < 1.6)) targets.push(t);
    }
    return { targets };
  },
  marker(k) {
    const o = k.ship('us', 1.6);
    o.rotation.y = Math.PI;
    return o;
  },
  spawn({ k, map, add }) {
    map.targets.forEach((t) => {
      const arrow = new k.THREE.Mesh(new k.THREE.ConeGeometry(0.45, 1.3, 4), new k.THREE.MeshBasicMaterial({ color: 0xff5a4a }));
      arrow.position.set(Math.cos(t.a) * 6.3, 0.5, Math.sin(t.a) * 6.3);
      arrow.rotation.set(0, -t.a, Math.PI / 2);
      add(arrow);
    });
  },
  play({ k, S, s, map }) {
    map.targets.forEach((t) => {
      const from = V(k, Math.cos(t.a) * 9, 1, Math.sin(t.a) * 9);
      const m = s.marks.find((mm) => Math.hypot(mm[0] - t.x, mm[1] - t.z) <= 2.3);
      if (m) {
        S.tracer(from, V(k, m[0], 0.8, m[1]), 0xff5a4a);
        S.splash(V(k, (m[0] + t.x) / 2, 0.1, (m[1] + t.z) / 2), 1);
      } else {
        S.tracer(from, V(k, 0, 0.8, 0), 0xff5a4a);
        S.boom(V(k, 0, 0.8, 0), 1.2);
      }
    });
  },
};

/* 잠입 · 드론 눈 피하기: 드론이 도는 길 밖의 숨을 곳 3곳을 고름 */
const C_HIDE = {
  rounds: 3, markers: 3, R: 0.8, pick: true, unit: '숨을 곳', models: ['crate', 'bush', 'rock', 'container', 'heli', 'tree'], sky: 0x16222e, ringCol: 0x5dff8a,
  cam: [0, 16, 9], tip: '드론이 도는 길을 보고, 그 길 밖에 있는 숨을 곳 3곳을 눌러요', runTip: '🚁 드론이 지나가요',
  build(k, S) {
    k.floor(S.scene, k.M(0x303a33), 60, 60);
    const drone = k.model('heli', 'foe');
    drone.scale.multiplyScalar(0.8);
    const eye = ringMesh(k, 1.5, 0xfff2a8, 1.5);
    eye.material.opacity = 0.3;
    S.scene.add(drone, eye);
    return { drone, eye };
  },
  gen(rng, lv) {
    const path = { rx: rng.range(3.5, 5.5), rz: rng.range(2.5, 4.5), cx: rng.range(-1, 1), cz: rng.range(-1, 1), sp: rng.range(0.9, 1.3) * Math.sqrt(lv) };
    const dist = (x, z) => {
      let d = 99;
      for (let a = 0; a < 6.28; a += 0.1) d = Math.min(d, Math.hypot(path.cx + Math.cos(a) * path.rx - x, path.cz + Math.sin(a) * path.rz - z));
      return d;
    };
    const cands = [];
    let guard = 0;
    while (cands.length < 7 && guard++ < 400) {
      const x = rng.range(-6.5, 6.5), z = rng.range(-6.5, 6.5), d = dist(x, z);
      if (cands.some((c) => Math.hypot(c.x - x, c.z - z) < 2) || (d > 1.5 && d < 2.3)) continue;
      const good = d >= 2.3;
      if ((good && cands.filter((c) => c.good).length >= 4) || (!good && cands.filter((c) => !c.good).length >= 3)) continue;
      cands.push({ x, z, good });
    }
    return { path, cands, targets: [] };
  },
  marker: (k) => new k.THREE.Group(),
  spawn({ k, map, add }) {
    map.cands.forEach((c, i) => {
      const o = k.model(['crate', 'bush', 'rock', 'container'][i % 4]);
      o.scale.multiplyScalar(1.5);
      o.position.set(c.x, 0, c.z);
      o.userData.cand = i;
      add(o);
    });
  },
  tick({ k, S, W, s, map }) {
    const p = map.path, a = s.t * p.sp * (s.phase === 'run' ? 2.4 : 1);
    const x = p.cx + Math.cos(a) * p.rx, z = p.cz + Math.sin(a) * p.rz;
    W.drone.position.set(x, 2.2, z);
    W.drone.rotation.y = -a;
    W.eye.position.set(x, 0.04, z);
    if (s.phase === 'run' && Math.random() < 0.08) s.picks.forEach((c) => !map.cands[c].good && S.smoke(V(k, map.cands[c].x, 0.6, map.cands[c].z), 0.4, true));
  },
};

/* ───────── 통솔 · 예비대 넣기: 세 전선 가운데 한 곳에, 한 번만 ───────── */
export function EReserve({ level, seed, report, finish }: MiniProps) {
  const rng = useRng(seed);
  const ROUNDS = 3, DUR = 11;
  const mk = () => ({ m: [rng.range(0.6, 0.9), rng.range(0.6, 0.9), rng.range(0.6, 0.9)], rate: [0, 1, 2].map(() => rng.range(0.03, 0.06) * level), surge: Math.floor(rng.next() * 3), surgeAt: rng.range(3, 7), used: -1, t: 0, lost: [false, false, false] });
  const st = useRef({ i: 0, r: mk(), sum: 0, wait: 0, over: false });
  const tick = useTick();
  const LX = [-4.2, 0, 4.2];
  const g = use3D({ cam: [0, 9, 11], look: [0, 0.5, -1] }, ['tank', 'tree', 'rock'], (k, S) => {
    k.floor(S.scene, k.MAT.dirt, 60, 60);
    scatter(k, S, ['tree', 'rock'], 12, (i) => [-10 + i * 1.8, -9.5], 0.8);
    const lanes = LX.map((x, i) => {
      const us = new k.THREE.Group(), foe = new k.THREE.Group();
      for (let j = 0; j < 4; j++) {
        const a = k.soldier('us');
        a.rotation.y = Math.PI;
        a.position.set(-0.9 + j * 0.6, 0, 0);
        us.add(a);
        const b = j % 2 ? k.model('tank', 'foe') : k.soldier('foe');
        b.position.set(-0.9 + j * 0.6, 0, 0);
        foe.add(b);
      }
      us.position.set(x, 0, 1);
      foe.position.set(x, 0, -5);
      const bar = k.box(2.4, 0.2, 0.06, new k.THREE.MeshBasicMaterial({ color: 0x5dff8a }), x, 1.6, 1);
      const pad = k.box(3.4, 0.05, 9, new k.THREE.MeshBasicMaterial({ visible: false }), x, 0.05, -1);
      pad.userData.lane = i;
      S.scene.add(us, foe, bar, pad);
      return { us, foe, bar, pad };
    });
    const res = new k.THREE.Group();
    for (let j = 0; j < 3; j++) {
      const t = k.model('tank', 'us');
      t.rotation.y = Math.PI;
      t.position.x = -1.2 + j * 1.2;
      res.add(t);
    }
    S.scene.add(res);
    return { lanes, res };
  });
  useLoop((dt) => {
    const s = st.current, S = g.S.current, k = g.K.current, W = g.W.current;
    if (!S || !k || !W || s.over) return;
    const r = s.r;
    if (s.wait > 0) {
      s.wait -= dt;
      if (s.wait <= 0) {
        s.i++;
        if (s.i >= ROUNDS) {
          s.over = true;
          return finish(clamp01(s.sum / ROUNDS));
        }
        s.r = mk();
      }
    } else {
      r.t += dt;
      r.m.forEach((m, i) => {
        if (r.lost[i]) return;
        r.m[i] = m - r.rate[i] * dt * (i === r.surge && r.t > r.surgeAt ? 3.2 : 1);
        if (Math.random() < dt * (i === r.surge && r.t > r.surgeAt ? 5 : 1.2)) S.tracer(V(k, LX[i] + (Math.random() - 0.5) * 2, 0.8, -5), V(k, LX[i] + (Math.random() - 0.5) * 2, 0.6, 1), 0xff5a4a);
        if (r.m[i] <= 0) {
          r.lost[i] = true;
          S.boom(V(k, LX[i], 0.3, 1), 1.4);
        }
      });
      if (r.t >= DUR) {
        s.sum += r.lost.filter((x) => !x).length / 3;
        s.wait = 1.4;
      }
    }
    W.lanes.forEach((L, i) => {
      L.us.visible = !r.lost[i];
      L.bar.visible = !r.lost[i];
      L.bar.scale.x = Math.max(0.02, Math.min(1, r.m[i]));
      L.bar.material.color.setHex(r.m[i] > 0.5 ? 0x5dff8a : r.m[i] > 0.25 ? 0xffc93c : 0xff5a4a);
      L.foe.position.z = r.lost[i] ? Math.min(1, L.foe.position.z + dt * 4) : -5 + (1 - Math.min(1, r.m[i])) * 3;
    });
    W.res.position.set(r.used >= 0 ? LX[r.used] : 0, 0, r.used >= 0 ? 2.6 : 6.5);
    S.fx(dt);
    S.render();
    report(clamp01((s.sum + (s.wait > 0 ? 0 : (r.lost.filter((x) => !x).length / 3) * (r.t / DUR))) / ROUNDS));
    tick();
  }, g.ready);
  const down = (e) => {
    const s = st.current, S = g.S.current, W = g.W.current, r = s.r;
    if (!S || s.wait > 0 || r.used >= 0) return;
    const pad = S.hit(e, W.lanes.map((L) => L.pad));
    if (!pad || r.lost[pad.userData.lane]) return;
    r.used = pad.userData.lane;
    r.m[r.used] = Math.min(1, r.m[r.used] + 0.55);
  };
  const s = st.current;
  return (
    <>
      <Hud items={[['판', `${Math.min(ROUNDS, s.i + 1)}/${ROUNDS}`], ['남은 시간', `${Math.max(0, Math.ceil(DUR - s.r.t))}초`], ['예비대', s.r.used >= 0 ? '넣음' : '대기']]} />
      <Box3D r={g.ref} ready={g.ready} fail={g.fail} onPointerDown={down}>
        <p className="mg-tip">{s.wait > 0 ? `전선 ${s.r.lost.filter((x) => !x).length}/3 지킴` : s.r.used >= 0 ? '예비대를 넣었어요 · 지켜봐요' : '무너질 것 같은 전선을 한 번 눌러 예비대를 넣어요 · 너무 일찍 넣으면 아까워요'}</p>
      </Box3D>
    </>
  );
}

/* ───────── 보급 · 항구 하역: 배 3척이 닿을 순서 ───────── */
export function EDock({ seed, report, finish }: MiniProps) {
  const rng = useRng(seed);
  const ROUNDS = 4;
  const [st, setSt] = useState(() => ({ n: 0, ships: dockShips(rng), order: [] as number[], sum: 0, last: -1 }));
  const art = sceneArt('port', false);
  const tapShip = (i: number) => {
    if (st.last >= 0 || st.order.includes(i)) return;
    const order = [...st.order, i];
    if (order.length < 3) return setSt({ ...st, order });
    const q = dockScore(st.ships, order), sum = st.sum + q;
    setSt({ ...st, order, last: q, sum });
    report(sum / ROUNDS);
    setTimeout(() => {
      if (st.n + 1 >= ROUNDS) return finish(sum / ROUNDS);
      setSt({ n: st.n + 1, ships: dockShips(rng), order: [], sum, last: -1 });
    }, 1500);
  };
  return (
    <>
      <Hud items={[['판', `${st.n + 1}/${ROUNDS}`], ['방금', st.last < 0 ? '-' : `${Math.round(st.last * 100)}점`]]} />
      <div className="mg-stage eg-liar eg-quiz">
        <div className="eg-qhead" style={art ? { backgroundImage: `url(${art})` } : { background: '#0c2a4a' }}>
          <b>부두는 하나예요. 먼저 댈 배부터 차례로 눌러요</b>
        </div>
        <div className="eg-jug">
          {st.ships.map((s, i) => (
            <button key={`${st.n}-${i}`} className={st.order.includes(i) ? 'on' : ''} onClick={() => tapShip(i)}>
              <span className="eg-jug-ic">{s.icon}</span>
              <b>{s.name}</b>
              <small>하역 {s.hours}시간</small>
              <small className="eg-jug-next">급함 {'★'.repeat(s.urgent)}</small>
              <span className="eg-jug-act">{st.order.includes(i) ? `${st.order.indexOf(i) + 1}번째` : '누르기'}</span>
            </button>
          ))}
        </div>
        <p className="eg-liar-a">{st.last < 0 ? '급하고 빨리 끝나는 배가 먼저예요. (급함 ÷ 시간이 큰 순서)' : st.last >= 0.99 ? '✅ 가장 좋은 순서예요' : '🙂 더 좋은 순서가 있었어요'}</p>
        {st.order.length > 0 && st.last < 0 && (
          <button className="eg-undo" onClick={() => setSt({ ...st, order: [] })}>
            ↩︎ 다시 고르기
          </button>
        )}
      </div>
    </>
  );
}

const cover = (skin) => (p: MiniProps) => <CoverGame {...p} skin={skin} />;
export const EMlrs = cover(C_MLRS);
export const EPoster = cover(C_POSTER);
export const EDecoy = cover(C_DECOY);
export const EFleet = cover(C_FLEET);
export const EHide = cover(C_HIDE);
