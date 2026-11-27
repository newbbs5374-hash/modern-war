// @ts-nocheck
// 11-27 한 손가락 미니 훈련(1차) — 3D 화면 12개. 조작은 꾹·톡·끌기·놓기 가운데 하나.
// 규칙 계산 가운데 따로 시험하는 것은 battle/easyLogic.ts, 여기는 화면.
import { useRef, useState } from 'react';
import { Hud, clamp01, useLoop, useRng, type MiniProps } from './kit';
import { Box3D, use3D } from './three';
import { SAND_UNITS, sandCells, sandScore, pathEval, ambushKills } from '../../../battle/easyLogic';

const useTick = () => {
  const [, t] = useState(0);
  return () => t((x) => (x + 1) % 1000);
};
/** 꾹: 누르고 있는지 */
const holdProps = (st: { current: { hold: boolean } }) => ({
  onPointerDown: () => (st.current.hold = true),
  onPointerUp: () => (st.current.hold = false),
});

/* ── 잠입 · 야간 침투(꾹): 누르면 달리고 떼면 엎드림. 탐조등 빛 안에서는 엎드려야 함 ── */
export function EHoldRun({ level, seed, report, finish }: MiniProps) {
  const rng = useRng(seed);
  const START = 10, END = -15;
  const rows = useRef(
    (() => {
      const n = 5 + Math.round(level * 2);
      return Array.from({ length: n }, (_, i) => ({ z: 7 - (i + 0.5) * (20 / n), amp: 3.4, sp: rng.range(0.7, 1.15) * level * (rng.chance(0.5) ? 1 : -1), ph: rng.range(0, 6), r: 1.3, o: null }));
    })(),
  );
  const st = useRef({ z: START, hold: false, alert: 0, worst: 0, t: 0, over: false });
  const tick = useTick();
  const g = use3D({ cam: [0, 5.5, 16], look: [0, 0, 6], sky: 0x0b1522 }, ['b2w', 'crate', 'tree', 'antenna', 'barrel'], (k, S) => {
    k.floor(S.scene, k.M(0x2a3328), 40, 70);
    const road = k.floor(S.scene, k.M(0x3a3d38), 2.2, 70, 0.01);
    void road;
    const b = k.model('b2w');
    b.position.set(0, 0, END - 2.5);
    b.scale.multiplyScalar(2.2);
    S.scene.add(b);
    const an = k.model('antenna');
    an.position.set(3.4, 0, END - 1.5);
    S.scene.add(an);
    for (let i = 0; i < 16; i++) {
      const o = k.model(i % 3 ? 'tree' : 'crate');
      o.position.set((i % 2 ? 1 : -1) * (5.5 + (i % 4)), 0, 9 - i * 1.7);
      S.scene.add(o);
    }
    for (const r of rows.current) {
      const disc = new k.THREE.Mesh(new k.THREE.CircleGeometry(r.r, 24), new k.THREE.MeshBasicMaterial({ color: 0xfff2a8, transparent: true, opacity: 0.55 }));
      disc.rotation.x = -Math.PI / 2;
      disc.position.set(0, 0.04, r.z);
      S.scene.add(disc);
      r.o = disc;
      S.scene.add(k.box(0.18, 2.6, 0.18, k.MAT.metal, r.sp > 0 ? -4.8 : 4.8, 1.3, r.z));
    }
    const me = k.soldier('us');
    me.position.set(0, 0, START);
    me.rotation.y = Math.PI;
    S.scene.add(me);
    return { me };
  });
  useLoop((dt) => {
    const s = st.current, S = g.S.current, k = g.K.current, W = g.W.current;
    if (!S || !k || !W || s.over) return;
    s.t += dt;
    for (const r of rows.current) r.o.position.x = Math.sin(s.t * r.sp + r.ph) * r.amp;
    if (s.hold) s.z -= dt * 2.7;
    W.me.position.z = s.z;
    W.me.scale.y += ((s.hold ? 2.4 : 1) - W.me.scale.y) * Math.min(1, dt * 14);
    k.walk(W.me, s.t, s.hold);
    const lit = rows.current.some((r) => Math.abs(r.z - s.z) < r.r && Math.abs(r.o.position.x) < r.r);
    if (lit) s.alert += dt * (s.hold ? 1.5 : 0.1);
    else s.alert = Math.max(0, s.alert - dt * 0.12);
    s.worst = Math.max(s.worst, s.alert);
    S.camera.position.z = s.z + 6.5;
    S.camera.lookAt(0, 0.3, s.z - 4);
    S.fx(dt);
    S.render();
    const prog = clamp01((START - s.z) / (START - END));
    report(prog * (1 - 0.3 * clamp01(s.worst)));
    if (s.alert >= 1) {
      s.over = true;
      finish(prog * 0.5);
    } else if (s.z <= END) {
      s.over = true;
      finish(clamp01(0.72 + 0.28 * (1 - s.worst)));
    }
    tick();
  }, g.ready);
  const s = st.current;
  return (
    <>
      <Hud items={[['남은 거리', `${Math.max(0, Math.round(s.z - END))}m`], ['들킴', `${Math.round(clamp01(s.alert) * 100)}%`]]} />
      <Box3D r={g.ref} ready={g.ready} fail={g.fail} {...holdProps(st)}>
        <p className="mg-tip">{s.hold ? '🏃 달리는 중 · 빛이 오면 손을 떼요' : '🫥 엎드림 · 누르고 있으면 달려요'}</p>
      </Box3D>
    </>
  );
}

/* ── 잠입 · 담장 넘기(톡): 경비병이 등을 돌린 순간에 눌러 담을 넘음 ── */
export function EWall({ level, seed, report, finish }: MiniProps) {
  const rng = useRng(seed);
  const N = 8;
  const walls = useRef(Array.from({ length: N }, (_, i) => ({ x: 2 + i * 3.2, P: rng.range(2.3, 3.4) / level, off: rng.range(0, 3), g: null })));
  const st = useRef({ t: 0, i: 0, x: 0, jump: 0, from: 0, to: 0, caught: 0, freeze: 0, over: false });
  const tick = useTick();
  const back = (w, t) => ((t + w.off) / w.P) % 1 < 0.42;
  const g = use3D({ cam: [0, 3.4, 9], look: [0, 0.9, 0], sky: 0x1a2733 }, ['tree', 'crate', 'b1g'], (k, S) => {
    k.floor(S.scene, k.M(0x39422f), 120, 30);
    for (const w of walls.current) {
      S.scene.add(k.box(0.3, 1.1, 3.4, k.MAT.conc, w.x, 0.55, 0));
      const gd = k.soldier('foe');
      gd.position.set(w.x + 1.5, 0, -1);
      S.scene.add(gd);
      w.g = gd;
    }
    for (let i = 0; i < 20; i++) {
      const o = k.model(i % 4 === 0 ? 'b1g' : 'tree');
      o.position.set(-3 + i * 1.6, 0, -4 - (i % 3));
      S.scene.add(o);
    }
    const me = k.soldier('us');
    me.rotation.y = Math.PI / 2;
    S.scene.add(me);
    return { me };
  });
  useLoop((dt) => {
    const s = st.current, S = g.S.current, k = g.K.current, W = g.W.current;
    if (!S || !k || !W || s.over) return;
    s.t += dt;
    s.freeze = Math.max(0, s.freeze - dt);
    for (const w of walls.current) {
      const target = back(w, s.t) ? Math.PI / 2 : -Math.PI / 2;
      w.g.rotation.y += (target - w.g.rotation.y) * Math.min(1, dt * 7);
    }
    if (s.jump > 0) {
      s.jump = Math.max(0, s.jump - dt * 2.2);
      const k1 = 1 - s.jump;
      s.x = s.from + (s.to - s.from) * k1;
      W.me.position.y = Math.sin(k1 * Math.PI) * 1.5;
    }
    W.me.position.x = s.x;
    S.camera.position.x += (s.x + 2 - S.camera.position.x) * Math.min(1, dt * 4);
    S.camera.lookAt(S.camera.position.x, 0.9, 0);
    S.fx(dt);
    S.render();
    const sc = clamp01(s.i / N - s.caught * 0.07);
    report(sc);
    if (s.i >= N && s.jump === 0) {
      s.over = true;
      finish(sc);
    }
    tick();
  }, g.ready);
  const tap = () => {
    const s = st.current;
    if (s.over || s.jump > 0 || s.freeze > 0 || s.i >= N) return;
    const w = walls.current[s.i];
    if (back(w, s.t)) {
      s.from = s.x;
      s.to = w.x + 1.6;
      s.jump = 1;
      s.i++;
    } else {
      s.caught++;
      s.freeze = 0.9;
      g.S.current?.smoke(new (g.K.current.THREE.Vector3)(s.x, 0.8, 0), 0.5, true);
    }
  };
  const s = st.current;
  return (
    <>
      <Hud items={[['넘은 담', `${s.i}/${N}`], ['들킴', s.caught]]} />
      <Box3D r={g.ref} ready={g.ready} fail={g.fail} onPointerDown={tap}>
        <p className="mg-tip">{s.freeze > 0 ? '😳 들켰어요! 잠깐 숨어요' : '경비병이 등을 돌리면 톡'}</p>
      </Box3D>
    </>
  );
}

/* ── 체력 · 유격 코스(톡): 저절로 달리는 병사, 장애물 앞에서 눌러 뛰어넘기 ── */
export function ERunner({ level, seed, report, finish }: MiniProps) {
  const rng = useRng(seed);
  const obs = useRef(
    (() => {
      let z = -8;
      return Array.from({ length: 16 }, () => {
        z -= rng.range(5, 8.5);
        return { z, hit: false, done: false };
      });
    })(),
  );
  const END = obs.current[obs.current.length - 1].z - 8;
  const st = useRef({ z: 0, y: 0, vy: 0, v: 5.2 * Math.sqrt(level), t: 0, hits: 0, slow: 0, over: false });
  const tick = useTick();
  const g = use3D({ cam: [4.2, 3, 6], look: [0, 0.6, -3] }, ['tree', 'pine', 'crate', 'barrel', 'tent'], (k, S) => {
    k.floor(S.scene, k.MAT.grass, 80, 400);
    const lane = k.floor(S.scene, k.MAT.dirt, 2.4, 400, 0.01);
    void lane;
    obs.current.forEach((o, i) => {
      const m = k.model(i % 2 ? 'crate' : 'barrel');
      m.scale.multiplyScalar(2.6);
      m.position.set(0, 0, o.z);
      S.scene.add(m);
    });
    for (let i = 0; i < 60; i++) {
      const m = k.model(i % 5 === 0 ? 'tent' : i % 2 ? 'pine' : 'tree');
      m.position.set((i % 2 ? 1 : -1) * (3 + (i % 3) * 1.4), 0, 4 - i * 2.4);
      S.scene.add(m);
    }
    const me = k.soldier('us');
    me.rotation.y = Math.PI;
    S.scene.add(me);
    return { me };
  });
  useLoop((dt) => {
    const s = st.current, S = g.S.current, k = g.K.current, W = g.W.current;
    if (!S || !k || !W || s.over) return;
    s.t += dt;
    s.slow = Math.max(0, s.slow - dt);
    s.z -= s.v * (s.slow > 0 ? 0.45 : 1) * dt;
    s.vy -= 13 * dt;
    s.y = Math.max(0, s.y + s.vy * dt);
    if (s.y === 0) s.vy = 0;
    for (const o of obs.current) {
      if (o.done) continue;
      if (Math.abs(o.z - s.z) < 0.4 && s.y < 0.5) {
        o.done = o.hit = true;
        s.hits++;
        s.slow = 0.7;
        S.smoke(new k.THREE.Vector3(0, 0.5, s.z), 0.5, true);
      } else if (s.z < o.z - 0.6) o.done = true;
    }
    W.me.position.set(0, s.y, s.z);
    k.walk(W.me, s.t, s.y === 0);
    S.camera.position.z = s.z + 6;
    S.camera.lookAt(0, 0.6, s.z - 3);
    S.fx(dt);
    S.render();
    const passed = obs.current.filter((o) => o.done).length;
    const sc = clamp01((passed - s.hits * 1.5) / obs.current.length);
    report(sc);
    if (s.z <= END) {
      s.over = true;
      finish(clamp01((obs.current.length - s.hits * 1.5) / obs.current.length));
    }
    tick();
  }, g.ready);
  const tap = () => {
    const s = st.current;
    if (s.y === 0 && !s.over) s.vy = 5.4;
  };
  const s = st.current;
  return (
    <>
      <Hud items={[['넘은 장애물', `${obs.current.filter((o) => o.done && !o.hit).length}/${obs.current.length}`], ['걸림', s.hits]]} />
      <Box3D r={g.ref} ready={g.ready} fail={g.fail} onPointerDown={tap}>
        <p className="mg-tip">장애물 바로 앞에서 톡</p>
      </Box3D>
    </>
  );
}

/** 세로 막대: 초록 칸(목표)과 내 표시 */
function Gauge({ v, c, w, label }: { v: number; c: number; w: number; label: string }) {
  return (
    <div className="eg-gauge" aria-label={label}>
      <i className="eg-band" style={{ bottom: `${(c - w) * 100}%`, height: `${w * 200}%` }} />
      <i className="eg-mark" style={{ bottom: `${v * 100}%` }} />
      <small>{label}</small>
    </div>
  );
}

/* ── 체력 · 완전 군장 행군(꾹): 누르는 동안 빨라지고 떼면 느려짐. 초록 칸 빠르기를 지킴 ── */
export function EMarch({ level, seed, report }: MiniProps) {
  const rng = useRng(seed);
  const ph = useRef(rng.range(0, 6));
  const st = useRef({ hold: false, v: 0.3, c: 0.5, t: 0, good: 0, breath: 1, rest: 0, z: 0 });
  const W_ = 0.13 / Math.sqrt(level) + 0.04;
  const tick = useTick();
  const g = use3D({ cam: [5, 3.6, 7], look: [0, 0.6, -2] }, ['tree', 'pine', 'rock', 'bush'], (k, S) => {
    k.floor(S.scene, k.MAT.grass, 80, 600);
    k.floor(S.scene, k.MAT.road, 3, 600, 0.01);
    for (let i = 0; i < 80; i++) {
      const m = k.model(['tree', 'pine', 'rock', 'bush'][i % 4]);
      m.position.set((i % 2 ? 1 : -1) * (3 + (i % 5)), 0, 6 - i * 3);
      S.scene.add(m);
    }
    const squad = Array.from({ length: 6 }, (_, i) => {
      const o = k.soldier('us');
      o.rotation.y = Math.PI;
      o.position.set(i % 2 ? 0.5 : -0.5, 0, Math.floor(i / 2) * 1.1);
      S.scene.add(o);
      return o;
    });
    return { squad };
  });
  useLoop((dt) => {
    const s = st.current, S = g.S.current, k = g.K.current, W = g.W.current;
    if (!S || !k || !W) return;
    s.t += dt;
    s.rest = Math.max(0, s.rest - dt);
    const push = s.hold && s.rest === 0;
    s.v = clamp01(s.v + (push ? 0.75 : -0.6) * dt);
    s.c = 0.5 + 0.27 * Math.sin(s.t * 0.55 * level + ph.current) + 0.08 * Math.sin(s.t * 1.7);
    const inBand = Math.abs(s.v - s.c) <= W_;
    if (inBand) s.good += dt;
    s.breath = clamp01(s.breath + (s.v > s.c + W_ ? -0.4 : 0.1) * dt);
    if (s.breath === 0 && s.rest === 0) {
      s.rest = 2;
      s.breath = 0.35;
    }
    s.z -= (0.8 + s.v * 4) * dt;
    W.squad.forEach((o, i) => {
      o.position.z = s.z + Math.floor(i / 2) * 1.1;
      k.walk(o, s.t * (0.5 + s.v), s.v > 0.05);
    });
    S.camera.position.z = s.z + 7;
    S.camera.lookAt(0, 0.6, s.z - 2);
    S.fx(dt);
    S.render();
    report(clamp01((s.good / Math.max(1, s.t)) * 1.12));
    tick();
  }, g.ready);
  const s = st.current;
  return (
    <>
      <Hud items={[['맞춘 시간', `${Math.round((s.good / Math.max(1, s.t)) * 100)}%`], ['숨', `${Math.round(s.breath * 100)}%`]]} />
      <Box3D r={g.ref} ready={g.ready} fail={g.fail} {...holdProps(st)}>
        <Gauge v={s.v} c={s.c} w={W_} label="빠르기" />
        <p className="mg-tip">{s.rest > 0 ? '😮‍💨 숨이 차서 쉬는 중' : s.v > s.c + W_ ? '너무 빨라요 · 손을 떼요' : s.v < s.c - W_ ? '느려요 · 꾹 눌러요' : '👍 좋아요'}</p>
      </Box3D>
    </>
  );
}

/* ── 항공 · 항모에 내리기(꾹): 누르면 뜨고 떼면 내려감. 초록 고리를 따라 갑판에 닿기 ── */
export function ECarrier({ level, seed, report, finish }: MiniProps) {
  const rng = useRng(seed);
  const TRIES = 3;
  const DUR = 13 / Math.pow(level, 0.3);
  const st = useRef({ hold: false, v: 0.85, c: 0.85, p: 0, n: 0, good: 0, sum: 0, t: 0, ph: rng.range(0, 6), msg: '', wait: 0, over: false });
  const WB = 0.1;
  const tick = useTick();
  const g = use3D({ cam: [3.2, 4.2, 9], look: [0, 2.2, -4], sky: 0x8fb6cc }, ['jet'], (k, S) => {
    k.floor(S.scene, k.MAT.water, 200, 400);
    const cv = new k.THREE.Group();
    cv.add(k.box(4.2, 0.9, 16, k.M(0x4d6684), 0, 0.45, 0), k.box(4.6, 0.12, 16.4, k.M(0x33465d), 0, 0.96, 0), k.box(0.9, 1.6, 2.4, k.M(0x7590ae), 1.7, 1.8, 2), k.box(0.2, 0.02, 15, k.MAT.white, 0, 1.03, 0));
    S.scene.add(cv);
    const jet = k.model('jet', 'us');
    jet.rotation.y = Math.PI;
    S.scene.add(jet);
    const ring = new k.THREE.Mesh(new k.THREE.TorusGeometry(0.75, 0.06, 8, 24), new k.THREE.MeshBasicMaterial({ color: 0x5dff8a }));
    S.scene.add(ring);
    return { cv, jet, ring };
  });
  const Y = (v) => 1.25 + v * 5;
  useLoop((dt) => {
    const s = st.current, S = g.S.current, k = g.K.current, W = g.W.current;
    if (!S || !k || !W || s.over) return;
    s.t += dt;
    if (s.wait > 0) {
      s.wait -= dt;
      if (s.wait <= 0) {
        if (s.n >= TRIES) {
          s.over = true;
          finish(clamp01(s.sum / TRIES));
          return;
        }
        s.p = 0;
        s.v = 0.85;
        s.good = 0;
        s.msg = '';
        s.ph = rng.range(0, 6);
      }
    } else {
      s.p = Math.min(1, s.p + dt / DUR);
      s.v = clamp01(s.v + (s.hold ? 0.5 : -0.42) * dt);
      s.c = 0.85 - 0.83 * s.p + 0.07 * Math.sin(s.t * 1.4 * level + s.ph) * (1 - s.p);
      if (Math.abs(s.v - s.c) <= WB) s.good += dt;
      if (s.p >= 1) {
        const ok = Math.abs(s.v - s.c) <= WB * 1.3;
        const q = (s.good / DUR) * 0.7 + (ok ? 0.3 : 0);
        s.sum += clamp01(q * 1.1);
        s.n++;
        s.msg = ok ? '🪝 착함 성공!' : '💦 갑판을 놓쳤어요';
        if (!ok) S.splash(new k.THREE.Vector3(0, 0.2, -1), 1.5);
        s.wait = 1.6;
      }
    }
    W.cv.position.z = -6 - (1 - s.p) * 70;
    W.jet.position.set(0, Y(s.v), 0);
    W.jet.rotation.x = (s.hold ? -0.12 : 0.1) * (s.wait > 0 ? 0 : 1);
    W.ring.position.set(0, Y(s.c), -3);
    W.ring.visible = s.wait <= 0;
    S.fx(dt);
    S.render();
    report(clamp01((s.sum + (s.good / DUR) * 0.7) / TRIES));
    tick();
  }, g.ready);
  const s = st.current;
  return (
    <>
      <Hud items={[['착함', `${Math.min(TRIES, s.n + (s.wait > 0 ? 0 : 1))}/${TRIES}`], ['갑판까지', `${Math.round((1 - s.p) * 100)}%`]]} />
      <Box3D r={g.ref} ready={g.ready} fail={g.fail} {...holdProps(st)}>
        <Gauge v={s.v} c={s.c} w={WB} label="높이" />
        <p className="mg-tip">{s.msg || '초록 고리 안에 머물러요 · 꾹 = 위로'}</p>
      </Box3D>
    </>
  );
}

/* ── 전술 · 모래판 작전(놓기): 부대 3개를 칸에 놓고 ▶ 시작 → 싸움이 저절로 ── */
export function ESand({ level, seed, report, finish }: MiniProps) {
  const rng = useRng(seed);
  const ROUNDS = 3;
  const mk = () => sandCells(rng, level);
  const st = useRef({ round: 0, board: mk(), put: {} as Record<string, number>, sel: 'inf', phase: 'place', t: 0, sum: 0, last: null, over: false });
  const tick = useTick();
  const LX = [-3.2, 0, 3.2], RZ = [2.2, 4.8];
  const g = use3D({ cam: [0, 10.5, 10.5], look: [0, 0, 0.5] }, ['tank', 'spg', 'tree', 'pine', 'rock'], (k, S) => {
    k.floor(S.scene, k.M(0x8f845f), 40, 40);
    return { objs: [] as any[], units: {} as Record<string, any>, foes: [] as any[] };
  });
  const rebuild = () => {
    const S = g.S.current, k = g.K.current, W = g.W.current, s = st.current;
    if (!S || !k || !W) return;
    [...W.objs, ...W.foes, ...Object.values(W.units)].forEach((o) => S.scene.remove(o));
    W.objs = [];
    W.foes = [];
    W.units = {};
    s.board.cells.forEach((c, i) => {
      const x = LX[c.lane], z = RZ[c.row];
      const tile = k.box(2.8, 0.06, 2.2, k.M(c.terrain === 'forest' ? 0x4f6a3a : c.terrain === 'hill' ? 0x8a7a55 : 0xb9ad84), x, 0.03, z);
      tile.userData.cell = i;
      S.scene.add(tile);
      W.objs.push(tile);
      if (c.terrain === 'forest')
        for (let j = 0; j < 4; j++) {
          const t = k.model(j % 2 ? 'pine' : 'tree');
          t.scale.multiplyScalar(0.55);
          t.position.set(x - 1 + (j % 2) * 2, 0, z - 0.8 + Math.floor(j / 2) * 1.6);
          S.scene.add(t);
          W.objs.push(t);
        }
      if (c.terrain === 'hill') {
        const h = new k.THREE.Mesh(new k.THREE.ConeGeometry(1.2, 0.7, 6), k.M(0x7a6a48));
        h.position.set(x, 0.35, z);
        S.scene.add(h);
        W.objs.push(h);
      }
    });
    s.board.foes.forEach((f, lane) => {
      for (let j = 0; j < f.n; j++) {
        const o = f.type === 'armor' ? k.model('tank', 'foe') : k.soldier('foe');
        o.position.set(LX[lane] - 0.8 + j * 0.8, 0, -6.5);
        o.userData.lane = lane;
        S.scene.add(o);
        W.foes.push(o);
      }
    });
  };
  const built = useRef(-1);
  useLoop((dt) => {
    const s = st.current, S = g.S.current, k = g.K.current, W = g.W.current;
    if (!S || !k || !W || s.over) return;
    if (built.current !== s.round) {
      built.current = s.round;
      rebuild();
    }
    if (s.phase === 'run') {
      s.t += dt;
      for (const o of W.foes) {
        const res = s.last.lanes[o.userData.lane];
        const stop = res >= 1 ? -1.5 : 6;
        if (o.position.z < stop) o.position.z += dt * 3.2;
        else if (res >= 1 && !o.userData.dead) {
          o.userData.dead = true;
          S.boom(o.position.clone(), 0.8);
          o.visible = false;
        }
      }
      if (s.t > 4) {
        s.sum += s.last.score;
        s.round++;
        if (s.round >= ROUNDS) {
          s.over = true;
          finish(clamp01(s.sum / ROUNDS));
        } else {
          s.board = mk();
          s.put = {};
          s.sel = 'inf';
          s.phase = 'place';
        }
      }
    }
    S.fx(dt);
    S.render();
    report(clamp01(s.sum / ROUNDS));
    tick();
  }, g.ready);
  const down = (e) => {
    const s = st.current, S = g.S.current, k = g.K.current, W = g.W.current;
    if (!S || s.phase !== 'place' || !s.sel) return;
    const tile = S.hit(e, W.objs.filter((o) => o.userData.cell != null));
    if (!tile) return;
    const i = tile.userData.cell;
    for (const u of Object.keys(s.put)) if (s.put[u] === i) delete s.put[u];
    s.put[s.sel] = i;
    if (W.units[s.sel]) S.scene.remove(W.units[s.sel]);
    const c = s.board.cells[i];
    const o = s.sel === 'inf' ? k.soldier('us') : k.model(s.sel === 'tank' ? 'tank' : 'spg', 'us');
    o.position.set(LX[c.lane], c.terrain === 'hill' ? 0.7 : 0.06, RZ[c.row]);
    o.rotation.y = Math.PI;
    S.scene.add(o);
    W.units[s.sel] = o;
    s.sel = SAND_UNITS.map((u) => u.id).find((u) => s.put[u] == null) ?? s.sel;
  };
  const start = () => {
    const s = st.current;
    s.last = sandScore(s.board, s.put);
    s.phase = 'run';
    s.t = 0;
  };
  const s = st.current;
  return (
    <>
      <Hud items={[['판', `${Math.min(ROUNDS, s.round + 1)}/${ROUNDS}`], ['적', s.board.foes.map((f) => `${f.type === 'armor' ? '전차' : '보병'}${f.n}`).join(' · ')]]} />
      <Box3D r={g.ref} ready={g.ready} fail={g.fail} onPointerDown={down}>
        {s.phase === 'run' && s.last && <p className="mg-tip">{s.last.lanes.map((r) => (r >= 1 ? '🛡️ 막음' : '💥 뚫림')).join('  ')}</p>}
      </Box3D>
      {s.phase === 'place' && (
        <div className="eg-chips">
          {SAND_UNITS.map((u) => (
            <button key={u.id} className={`${s.sel === u.id ? 'on' : ''} ${s.put[u.id] != null ? 'done' : ''}`} onClick={() => ((st.current.sel = u.id), tick())}>
              <b>{u.icon} {u.name}</b>
              <small>{u.tip}</small>
            </button>
          ))}
          <button className="primary" disabled={Object.keys(s.put).length < 3} onClick={start}>
            ▶ 시작
          </button>
        </div>
      )}
    </>
  );
}

/* ── 전술 · 길목 매복(놓기): 길가에 매복조 2개를 놓고, 대열이 들어오면 사격 개시 한 번 ── */
export function EAmbush({ level, seed, report, finish }: MiniProps) {
  const rng = useRng(seed);
  const ROUNDS = 3, CARS = 6;
  const mkRoad = () => {
    const pts = [[rng.range(-4, 4), -10]];
    for (let z = -6; z <= 10; z += 4) pts.push([rng.range(-5, 5), z]);
    return pts;
  };
  const st = useRef({ round: 0, road: mkRoad(), teams: [] as number[][], phase: 'place', d: 0, fired: -1, kills: 0, sum: 0, over: false, wait: 0 });
  const tick = useTick();
  const lenOf = (pts) => pts.slice(1).reduce((a, p, i) => a + Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]), 0);
  const at = (pts, d) => {
    for (let i = 1; i < pts.length; i++) {
      const L = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      if (d <= L) return [pts[i - 1][0] + ((pts[i][0] - pts[i - 1][0]) * d) / L, pts[i - 1][1] + ((pts[i][1] - pts[i - 1][1]) * d) / L];
      d -= L;
    }
    return pts[pts.length - 1];
  };
  const g = use3D({ cam: [0, 17, 7], look: [0, 0, 0.5] }, ['tank', 'tree', 'pine', 'rock'], (k, S) => {
    k.floor(S.scene, k.MAT.grass, 50, 50);
    return { objs: [] as any[], cars: [] as any[], marks: [] as any[] };
  });
  const built = useRef(-1);
  const rebuild = () => {
    const S = g.S.current, k = g.K.current, W = g.W.current, s = st.current;
    [...W.objs, ...W.cars, ...W.marks].forEach((o) => S.scene.remove(o));
    W.objs = [];
    W.marks = [];
    for (let i = 1; i < s.road.length; i++) {
      const [x1, z1] = s.road[i - 1], [x2, z2] = s.road[i];
      const L = Math.hypot(x2 - x1, z2 - z1);
      const seg = k.box(1.1, 0.04, L + 0.5, k.MAT.road, (x1 + x2) / 2, 0.02, (z1 + z2) / 2);
      seg.rotation.y = Math.atan2(x2 - x1, z2 - z1);
      S.scene.add(seg);
      W.objs.push(seg);
    }
    for (let i = 0; i < 26; i++) {
      const t = k.model(i % 3 ? 'tree' : 'pine');
      t.scale.multiplyScalar(0.6);
      t.position.set(rng.range(-8, 8), 0, rng.range(-9, 9));
      S.scene.add(t);
      W.objs.push(t);
    }
    W.cars = Array.from({ length: CARS }, () => {
      const o = k.model('tank', 'foe');
      o.visible = false;
      S.scene.add(o);
      return o;
    });
  };
  useLoop((dt) => {
    const s = st.current, S = g.S.current, k = g.K.current, W = g.W.current;
    if (!S || !k || !W || s.over) return;
    if (built.current !== s.round) {
      built.current = s.round;
      rebuild();
    }
    if (s.phase === 'run') {
      s.d += dt * 2.6 * Math.sqrt(level);
      const total = lenOf(s.road);
      W.cars.forEach((o, i) => {
        const d = s.d - i * 1.7;
        if (d < 0 || o.userData.dead) return;
        const [x, z] = at(s.road, d);
        const [x2, z2] = at(s.road, d + 0.3);
        o.visible = d < total;
        o.position.set(x, 0.05, z);
        o.rotation.y = Math.atan2(x2 - x, z2 - z);
      });
      if (s.fired >= 0 && s.wait === 0) {
        const pos = W.cars.map((o, i) => (o.visible && !o.userData.dead ? [o.position.x, o.position.z] : null));
        const dead = ambushKills(s.teams, pos);
        dead.forEach((i) => {
          W.cars[i].userData.dead = true;
          S.boom(W.cars[i].position.clone(), 1);
          W.cars[i].visible = false;
        });
        s.kills = dead.length;
        s.wait = 2;
      }
      if (s.wait > 0 || s.d - CARS * 1.7 > total) {
        s.wait -= dt;
        if (s.wait <= 0) {
          s.sum += s.kills / CARS;
          s.round++;
          if (s.round >= ROUNDS) {
            s.over = true;
            finish(clamp01((s.sum / ROUNDS) * 1.2));
          } else Object.assign(s, { road: mkRoad(), teams: [], phase: 'place', d: 0, fired: -1, kills: 0, wait: 0 });
        }
      }
    }
    S.fx(dt);
    S.render();
    report(clamp01((s.sum / ROUNDS) * 1.2));
    tick();
  }, g.ready);
  const down = (e) => {
    const s = st.current, S = g.S.current, k = g.K.current, W = g.W.current;
    if (!S || s.phase !== 'place' || s.teams.length >= 2) return;
    const p = S.ground(e);
    if (!p || Math.abs(p.x) > 9 || Math.abs(p.z) > 10) return;
    s.teams.push([p.x, p.z]);
    const o = k.soldier('us');
    o.position.set(p.x, 0, p.z);
    const ring = new k.THREE.Mesh(new k.THREE.RingGeometry(3.05, 3.2, 40), new k.THREE.MeshBasicMaterial({ color: 0x7fd4ff, transparent: true, opacity: 0.8 }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(p.x, 0.06, p.z);
    S.scene.add(o, ring);
    W.marks.push(o, ring);
    if (s.teams.length === 2) s.phase = 'run';
  };
  const s = st.current;
  return (
    <>
      <Hud items={[['판', `${Math.min(ROUNDS, s.round + 1)}/${ROUNDS}`], ['격파', `${s.kills}/${CARS}`]]} />
      <Box3D r={g.ref} ready={g.ready} fail={g.fail} onPointerDown={down}>
        <p className="mg-tip">{s.phase === 'place' ? `길가를 눌러 매복조 놓기 (${s.teams.length}/2) · 파란 원 = 사거리` : s.fired < 0 ? '대열이 원 안에 많이 들어오면 사격 개시!' : '🔥 사격!'}</p>
        {s.phase === 'run' && s.fired < 0 && (
          <button className="eg-fire" onPointerDown={(ev) => (ev.stopPropagation(), (st.current.fired = st.current.d))}>
            🔥 사격 개시
          </button>
        )}
      </Box3D>
    </>
  );
}

/* ── 사격 · 숨 고르고 한 발(꾹): 누르면 조준 원이 모이고, 가장 작을 때 떼면 발사 ── */
export function EBreath({ level, seed, report, finish }: MiniProps) {
  const rng = useRng(seed);
  const SHOTS = 5;
  const T = 1.7 / Math.pow(level, 0.35), GRACE = 0.3 / level;
  const st = useRef({ hold: false, h: 0, r: 1, n: 0, sum: 0, last: -1, wait: 0, dist: rng.range(9, 15), over: false });
  const tick = useTick();
  const g = use3D({ cam: [0, 1.5, 6], look: [0, 1.2, -8], fov: 38 }, ['tree', 'crate', 'barrel', 'pine'], (k, S) => {
    k.floor(S.scene, k.MAT.grass, 60, 80);
    k.floor(S.scene, k.MAT.dirt, 8, 80, 0.01);
    for (let i = 0; i < 14; i++) {
      const t = k.model(i % 2 ? 'pine' : 'tree');
      t.position.set((i % 2 ? 1 : -1) * (5 + (i % 3)), 0, -2 - i * 2);
      S.scene.add(t);
    }
    const tg = new k.THREE.Group();
    tg.add(k.box(0.08, 1.2, 0.08, k.MAT.metal, 0, 0.6, 0));
    [[0.62, 0xffffff], [0.44, 0xd94a3d], [0.26, 0xffffff], [0.1, 0xd94a3d]].forEach(([r, c], i) => {
      const d = new k.THREE.Mesh(new k.THREE.CircleGeometry(r, 24), new k.THREE.MeshBasicMaterial({ color: c }));
      d.position.set(0, 1.4, 0.01 + i * 0.005);
      tg.add(d);
    });
    S.scene.add(tg);
    return { tg };
  });
  useLoop((dt) => {
    const s = st.current, S = g.S.current, k = g.K.current, W = g.W.current;
    if (!S || !k || !W || s.over) return;
    W.tg.position.set(0, 0, -s.dist);
    if (s.wait > 0) {
      s.wait -= dt;
      if (s.wait <= 0 && s.n >= SHOTS) {
        s.over = true;
        finish(clamp01((s.sum / SHOTS) * 1.08));
      }
      if (s.wait <= 0) s.dist = rng.range(9, 15);
    } else if (s.hold) {
      s.h += dt;
      s.r = s.h < T ? 1 - (s.h / T) * 0.94 : 0.06 + Math.max(0, s.h - T - GRACE) * 1.5;
      s.r = Math.min(1.2, s.r);
    } else s.r += (1 - s.r) * Math.min(1, dt * 6);
    S.camera.lookAt(Math.sin(performance.now() / 700) * s.r * 0.25, 1.2 + Math.cos(performance.now() / 500) * s.r * 0.15, -8);
    S.fx(dt);
    S.render();
    report(clamp01((s.sum / SHOTS) * 1.08));
    tick();
  }, g.ready);
  const up = () => {
    const s = st.current, S = g.S.current, k = g.K.current;
    if (!s.hold) return;
    s.hold = false;
    if (s.wait > 0 || s.over || s.h < 0.15) return void (s.h = 0);
    const q = clamp01(1 - s.r * 1.02 + rng.range(-0.04, 0.04));
    s.last = q;
    s.sum += q;
    s.n++;
    s.h = 0;
    s.wait = 1.1;
    const hit = new k.THREE.Vector3(rng.range(-1, 1) * (1 - q) * 0.9, 1.4 + rng.range(-1, 1) * (1 - q) * 0.9, -s.dist + 0.05);
    S.tracer(new k.THREE.Vector3(0.2, 1.2, 5), hit);
    S.smoke(hit, 0.25, true);
  };
  const s = st.current;
  const size = 26 + s.r * 150;
  return (
    <>
      <Hud items={[['발', `${s.n}/${SHOTS}`], ['방금', s.last < 0 ? '-' : `${Math.round(s.last * 100)}점`]]} />
      <Box3D r={g.ref} ready={g.ready} fail={g.fail} onPointerDown={() => st.current.wait <= 0 && ((st.current.hold = true), (st.current.h = 0))} onPointerUp={up}>
        <i className="eg-reticle" style={{ width: size, height: size, borderColor: s.r < 0.15 ? '#5dff8a' : '#ffffff' }} />
        <p className="mg-tip">{s.hold ? (s.r < 0.15 ? '지금! 손을 떼요' : s.h > T ? '숨이 차요…' : '숨 참는 중…') : '꾹 눌러 숨을 참아요'}</p>
      </Box3D>
    </>
  );
}

/* ── 포격 · 당겨서 쏘기(끌기): 아래로 당겼다 놓으면 발사. 당긴 만큼 멀리 ── */
export function ESling({ level, seed, report, finish }: MiniProps) {
  const rng = useRng(seed);
  const SHOTS = 5;
  const newT = () => ({ d: rng.range(9, 26), wind: Math.round(rng.range(-3, 3) * Math.min(1.5, level)) });
  const st = useRef({ ...newT(), drag: null as null | { y0: number; p: number }, n: 0, sum: 0, last: -1, fly: null as any, wait: 0, over: false });
  const tick = useTick();
  const range = (p) => 6 + p * 24;
  const g = use3D({ cam: [0, 10, 18.5], look: [0, 0, -3] }, ['spg', 'tank', 'tree', 'pine', 'rock'], (k, S) => {
    k.floor(S.scene, k.M(0x8f845f), 80, 120);
    for (let i = 0; i < 24; i++) {
      const t = k.model(['tree', 'pine', 'rock'][i % 3]);
      t.position.set((i % 2 ? 1 : -1) * (6 + (i % 4) * 1.5), 0, 6 - i * 1.6);
      S.scene.add(t);
    }
    const gun = k.model('spg', 'us');
    gun.position.set(0, 0, 8);
    gun.rotation.y = Math.PI;
    gun.scale.multiplyScalar(2);
    S.scene.add(gun);
    const foe = k.model('tank', 'foe');
    foe.scale.multiplyScalar(2);
    S.scene.add(foe);
    const flag = k.box(0.08, 2.4, 0.08, k.MAT.white, 0, 1.2, 0);
    flag.add(k.box(0.7, 0.4, 0.04, k.M(0xd94a3d), 0.38, 0.95, 0));
    S.scene.add(flag);
    const mark = new k.THREE.Mesh(new k.THREE.RingGeometry(0.7, 0.95, 28), new k.THREE.MeshBasicMaterial({ color: 0xffe07a, transparent: true, opacity: 0.9 }));
    mark.rotation.x = -Math.PI / 2;
    mark.visible = false;
    S.scene.add(mark);
    const shell = new k.THREE.Mesh(new k.THREE.SphereGeometry(0.16, 8, 6), k.MAT.black);
    shell.visible = false;
    S.scene.add(shell);
    return { foe, flag, mark, shell };
  });
  useLoop((dt) => {
    const s = st.current, S = g.S.current, k = g.K.current, W = g.W.current;
    if (!S || !k || !W || s.over) return;
    const tz = 8 - s.d;
    W.foe.position.set(0, 0, tz);
    W.flag.position.set(1.4, 0, tz);
    W.mark.visible = !!s.drag;
    if (s.drag) W.mark.position.set(0, 0.05, 8 - range(s.drag.p));
    if (s.fly) {
      s.fly.t += dt / 1.2;
      const kk = Math.min(1, s.fly.t);
      W.shell.visible = true;
      W.shell.position.set(0, 0.9 + Math.sin(kk * Math.PI) * 6, 8 + (s.fly.z - 8) * kk);
      if (kk >= 1) {
        W.shell.visible = false;
        S.boom(new k.THREE.Vector3(0, 0.1, s.fly.z), 1.3);
        const q = clamp01(1 - Math.abs(s.fly.z - tz) / 5);
        s.last = q;
        s.sum += q;
        s.n++;
        s.fly = null;
        s.wait = 1.2;
      }
    }
    if (s.wait > 0) {
      s.wait -= dt;
      if (s.wait <= 0) {
        if (s.n >= SHOTS) {
          s.over = true;
          finish(clamp01((s.sum / SHOTS) * 1.1));
        } else Object.assign(s, newT());
      }
    }
    S.fx(dt);
    S.render();
    report(clamp01((s.sum / SHOTS) * 1.1));
    tick();
  }, g.ready);
  const down = (e) => {
    const s = st.current;
    if (!s.fly && s.wait <= 0 && !s.over) s.drag = { y0: e.clientY, p: 0 };
  };
  const move = (e) => {
    const s = st.current;
    if (s.drag) s.drag.p = clamp01((e.clientY - s.drag.y0) / 200);
  };
  const up = () => {
    const s = st.current;
    if (!s.drag) return;
    const p = s.drag.p;
    s.drag = null;
    if (p < 0.05) return;
    s.fly = { t: 0, z: 8 - (range(p) + s.wind) };
  };
  const s = st.current;
  return (
    <>
      <Hud items={[['발', `${s.n}/${SHOTS}`], ['바람', s.wind === 0 ? '없음' : s.wind > 0 ? `뒷바람 ${s.wind} (더 멀리)` : `맞바람 ${-s.wind} (덜 감)`], ['방금', s.last < 0 ? '-' : `${Math.round(s.last * 100)}점`]]} />
      <Box3D r={g.ref} ready={g.ready} fail={g.fail} onPointerDown={down} onPointerMove={move} onPointerUp={up}>
        <p className="mg-tip">{s.drag ? '노란 원 = 바람 없을 때 떨어질 곳' : '화면을 아래로 당겼다 놓아요'}</p>
      </Box3D>
    </>
  );
}

/* ── 통솔 · 사열과 훈시(톡): 대열이 흰 선을 지날 때 눌러 경례 받기 ── */
export function EParade({ level, seed, report, finish }: MiniProps) {
  const rng = useRng(seed);
  const N = 18;
  const V = 3.1 * Math.sqrt(level);
  const rows = useRef(
    (() => {
      let x = -9;
      return Array.from({ length: N }, () => {
        x -= rng.pick([2.2, 2.2, 3.3, 4.4]);
        return { x0: x, q: -1, o: null };
      });
    })(),
  );
  const st = useRef({ t: 0, sum: 0, miss: 0, flash: 0, over: false });
  const tick = useTick();
  const g = use3D({ cam: [0, 4.2, 9.5], look: [0, 0.6, 0] }, ['b1g', 'b2w', 'tree', 'antenna'], (k, S) => {
    k.floor(S.scene, k.MAT.conc, 80, 40);
    S.scene.add(k.box(0.14, 0.02, 5, k.MAT.white, 0, 0.02, 0.6));
    const stand = k.model('b1g');
    stand.position.set(0, 0, -3.6);
    stand.scale.multiplyScalar(1.6);
    S.scene.add(stand);
    const me = k.soldier('us');
    me.position.set(0, 0, -1.9);
    S.scene.add(me);
    [-10, -6, 6, 10].forEach((x) => {
      const b = k.model(x % 4 ? 'b2w' : 'tree');
      b.position.set(x, 0, -6);
      b.scale.multiplyScalar(1.5);
      S.scene.add(b);
    });
    for (const r of rows.current) {
      const grp = new k.THREE.Group();
      for (let i = 0; i < 4; i++) {
        const o = k.soldier('us');
        o.rotation.y = Math.PI / 2;
        o.position.z = -0.4 + i * 0.75;
        grp.add(o);
      }
      S.scene.add(grp);
      r.o = grp;
    }
    return {};
  });
  useLoop((dt) => {
    const s = st.current, S = g.S.current, k = g.K.current;
    if (!S || !k || s.over) return;
    s.t += dt;
    s.flash = Math.max(0, s.flash - dt);
    for (const r of rows.current) {
      const x = r.x0 + s.t * V;
      r.o.position.x = x;
      r.o.children.forEach((c) => k.walk(c, s.t, true));
      if (r.q < 0 && x > 1.1) r.q = 0;
    }
    S.fx(dt);
    S.render();
    const sc = clamp01((s.sum - s.miss * 0.3) / N);
    report(sc);
    if (rows.current.every((r) => r.q >= 0)) {
      s.over = true;
      finish(sc);
    }
    tick();
  }, g.ready);
  const tap = () => {
    const s = st.current, S = g.S.current, k = g.K.current;
    if (s.over || !S) return;
    const r = rows.current.filter((x) => x.q < 0).sort((a, b) => Math.abs(a.x0 + s.t * V) - Math.abs(b.x0 + s.t * V))[0];
    const d = r ? Math.abs(r.x0 + s.t * V) : 9;
    if (d < 0.45) r.q = 1;
    else if (d < 0.95) r.q = 0.5;
    else return void s.miss++;
    s.sum += r.q;
    s.flash = 0.4;
    S.smoke(new k.THREE.Vector3(0, 1.6, 0.6), 0.3, false);
  };
  const s = st.current;
  return (
    <>
      <Hud items={[['경례 받음', `${rows.current.filter((r) => r.q > 0).length}/${N}`], ['헛손질', s.miss]]} />
      <Box3D r={g.ref} ready={g.ready} fail={g.fail} onPointerDown={tap}>
        <p className="mg-tip">{s.flash > 0 ? '🫡 충성!' : '대열이 흰 선에 닿을 때 톡'}</p>
      </Box3D>
    </>
  );
}

/* ── 통솔 · 무너지는 전선 붙잡기(톡): 사기가 떨어지는 분대를 눌러 다독임 ── */
export function ERally({ level, seed, report }: MiniProps) {
  const rng = useRng(seed);
  const POS = [[-4, -2], [0, -3.2], [4, -2], [-2.2, 1.6], [2.2, 1.6]];
  const st = useRef({ t: 0, cd: 0, next: 2, sq: POS.map(() => ({ m: 0.8, hot: 0, gone: false })) });
  const tick = useTick();
  const g = use3D({ cam: [0, 8.5, 10], look: [0, 0, -0.5] }, ['tree', 'rock', 'crate', 'bush'], (k, S) => {
    k.floor(S.scene, k.MAT.dirt, 60, 60);
    for (let i = 0; i < 18; i++) {
      const t = k.model(['rock', 'bush', 'tree'][i % 3]);
      t.position.set(rng.range(-9, 9), 0, rng.range(-9, -5));
      S.scene.add(t);
    }
    const groups = POS.map(([x, z], i) => {
      const grp = new k.THREE.Group();
      for (let j = 0; j < 3; j++) {
        const o = k.soldier('us');
        o.rotation.y = Math.PI;
        o.position.set(-0.6 + j * 0.6, 0, 0);
        grp.add(o);
      }
      grp.add(k.box(1.9, 0.5, 0.25, k.MAT.sand, 0, 0.25, -0.6));
      const pad = k.box(2.4, 1.6, 1.6, new k.THREE.MeshBasicMaterial({ visible: false }), 0, 0.8, 0);
      grp.add(pad);
      const bar = k.box(1.8, 0.16, 0.05, new k.THREE.MeshBasicMaterial({ color: 0x5dff8a }), 0, 1.75, 0);
      grp.add(bar);
      grp.position.set(x, 0, z);
      grp.userData.i = i;
      grp.userData.bar = bar;
      S.scene.add(grp);
      return grp;
    });
    return { groups };
  });
  useLoop((dt) => {
    const s = st.current, S = g.S.current, k = g.K.current, W = g.W.current;
    if (!S || !k || !W) return;
    s.t += dt;
    s.cd = Math.max(0, s.cd - dt);
    if (s.t > s.next) {
      s.next = s.t + rng.range(1.6, 2.8) / level;
      const live = s.sq.map((q, i) => (q.gone ? -1 : i)).filter((i) => i >= 0);
      if (live.length) {
        const i = rng.pick(live);
        s.sq[i].hot = 3;
        s.sq[i].m = Math.max(0.02, s.sq[i].m - 0.12);
        S.boom(new k.THREE.Vector3(POS[i][0] + rng.range(-1, 1), 0.1, POS[i][1] - 1.6), 1);
      }
    }
    s.sq.forEach((q, i) => {
      const grp = W.groups[i];
      if (q.gone) {
        grp.position.z += dt * 3;
        grp.visible = grp.position.z < 9;
        return;
      }
      q.hot = Math.max(0, q.hot - dt);
      q.m -= dt * (0.045 * level + (q.hot > 0 ? 0.11 : 0));
      if (q.m <= 0) q.gone = true;
      grp.userData.bar.scale.x = Math.max(0.02, q.m);
      grp.userData.bar.material.color.setHex(q.m > 0.5 ? 0x5dff8a : q.m > 0.25 ? 0xffc93c : 0xff5a4a);
    });
    S.fx(dt);
    S.render();
    const alive = s.sq.filter((q) => !q.gone);
    report(clamp01((alive.length / 5) * 0.65 + (alive.reduce((a, q) => a + q.m, 0) / 5) * 0.45));
    tick();
  }, g.ready);
  const down = (e) => {
    const s = st.current, S = g.S.current, W = g.W.current;
    if (!S || s.cd > 0) return;
    const grp = S.hit(e, W.groups.filter((x, i) => !s.sq[i].gone));
    if (!grp) return;
    const q = s.sq[grp.userData.i];
    q.m = Math.min(1, q.m + 0.3);
    s.cd = 0.55;
    S.smoke(grp.position.clone().add(new (g.K.current.THREE.Vector3)(0, 1.2, 0)), 0.3, false);
  };
  const s = st.current;
  return (
    <>
      <Hud items={[['버티는 분대', `${s.sq.filter((q) => !q.gone).length}/5`], ['다음 격려', s.cd > 0 ? '…' : '가능']]} />
      <Box3D r={g.ref} ready={g.ready} fail={g.fail} onPointerDown={down}>
        <p className="mg-tip">막대가 빨간 분대부터 톡 · 한 번에 한 분대</p>
      </Box3D>
    </>
  );
}

/* ── 보급 · 수송 대열 호송(끌기): 기지에서 깃발까지 길을 한 번에 그림 ── */
export function EConvoy({ level, seed, report, finish }: MiniProps) {
  const rng = useRng(seed);
  const ROUNDS = 3, TRUCKS = 4;
  const mk = () => {
    const bridges = [rng.range(-6, -1.5), rng.range(1.5, 6)];
    const haz = Array.from({ length: 3 + Math.round(level * 2) }, () => ({ x: rng.chance(0.5) ? rng.range(-5.2, -1.8) : rng.range(1.8, 5.2), z: rng.range(-6.5, 6.5), r: 1.35 }));
    return { start: [-7, rng.range(-4, 4)], goal: [7, rng.range(-4, 4)], bridges, haz };
  };
  const st = useRef({ round: 0, map: mk(), pts: [] as number[][], drawing: false, phase: 'draw', d: 0, res: null as any, sum: 0, msg: '', over: false });
  const tick = useTick();
  const g = use3D({ cam: [0, 21, 6], look: [0, 0, 0.3] }, ['tent', 'crate', 'tree', 'container'], (k, S) => {
    k.floor(S.scene, k.MAT.grass, 60, 60);
    return { objs: [] as any[], trucks: [] as any[], line: null as any };
  });
  const built = useRef(-1);
  const rebuild = () => {
    const S = g.S.current, k = g.K.current, W = g.W.current, m = st.current.map;
    [...W.objs, ...W.trucks].forEach((o) => S.scene.remove(o));
    if (W.line) S.scene.remove(W.line);
    W.line = null;
    W.objs = [];
    const add = (o) => (S.scene.add(o), W.objs.push(o), o);
    add(k.box(1.3, 0.05, 30, k.MAT.water, 0, 0.03, 0));
    m.bridges.forEach((z) => add(k.box(2.2, 0.12, 1.7, k.MAT.conc, 0, 0.08, z)));
    m.haz.forEach((h) => {
      const d = new k.THREE.Mesh(new k.THREE.CircleGeometry(h.r, 24), new k.THREE.MeshBasicMaterial({ color: 0xff5a4a, transparent: true, opacity: 0.45 }));
      d.rotation.x = -Math.PI / 2;
      d.position.set(h.x, 0.05, h.z);
      add(d);
      const f = k.soldier('foe');
      f.position.set(h.x, 0, h.z);
      add(f);
    });
    const tent = k.model('tent');
    tent.position.set(m.start[0], 0, m.start[1]);
    tent.scale.multiplyScalar(1.5);
    add(tent);
    const flag = k.box(0.1, 2, 0.1, k.MAT.white, m.goal[0], 1, m.goal[1]);
    flag.add(k.box(0.8, 0.5, 0.05, k.M(0x3fb8c9), 0.45, 0.7, 0));
    add(flag);
    for (let i = 0; i < 14; i++) {
      const t = k.model('tree');
      t.scale.multiplyScalar(0.6);
      t.position.set(rng.range(-9, 9), 0, rng.chance(0.5) ? rng.range(-9.5, -7.5) : rng.range(7.5, 9.5));
      add(t);
    }
    W.trucks = Array.from({ length: TRUCKS }, () => {
      const o = k.model('container', 'us');
      o.scale.multiplyScalar(0.7);
      o.visible = false;
      S.scene.add(o);
      return o;
    });
  };
  const drawLine = () => {
    const S = g.S.current, k = g.K.current, W = g.W.current;
    if (W.line) S.scene.remove(W.line);
    const geo = new k.THREE.BufferGeometry().setFromPoints(st.current.pts.map(([x, z]) => new k.THREE.Vector3(x, 0.12, z)));
    W.line = new k.THREE.Line(geo, new k.THREE.LineBasicMaterial({ color: 0xffe07a }));
    S.scene.add(W.line);
  };
  useLoop((dt) => {
    const s = st.current, S = g.S.current, k = g.K.current, W = g.W.current;
    if (!S || !k || !W || s.over) return;
    if (built.current !== s.round) {
      built.current = s.round;
      rebuild();
    }
    if (s.phase === 'run') {
      s.d += dt * 7;
      const total = s.res.len;
      W.trucks.forEach((o, i) => {
        const d = s.d - i * 1.3;
        const alive = i < s.res.alive || d < s.res.lossAt[i - s.res.alive];
        if (d < 0) return;
        if (!alive) {
          if (o.visible) S.boom(o.position.clone(), 0.9);
          o.visible = false;
          return;
        }
        let acc = 0;
        for (let j = 1; j < s.pts.length; j++) {
          const L = Math.hypot(s.pts[j][0] - s.pts[j - 1][0], s.pts[j][1] - s.pts[j - 1][1]);
          if (acc + L >= d || j === s.pts.length - 1) {
            const kk = L ? Math.min(1, (d - acc) / L) : 0;
            o.position.set(s.pts[j - 1][0] + (s.pts[j][0] - s.pts[j - 1][0]) * kk, 0.05, s.pts[j - 1][1] + (s.pts[j][1] - s.pts[j - 1][1]) * kk);
            o.rotation.y = Math.atan2(s.pts[j][0] - s.pts[j - 1][0], s.pts[j][1] - s.pts[j - 1][1]);
            break;
          }
          acc += L;
        }
        o.visible = true;
      });
      if (s.d > total + TRUCKS * 1.3 + 4) {
        s.sum += s.res.score;
        s.round++;
        if (s.round >= ROUNDS) {
          s.over = true;
          finish(clamp01(s.sum / ROUNDS));
        } else Object.assign(s, { map: mk(), pts: [], phase: 'draw', d: 0, res: null, msg: '' });
      }
    }
    S.fx(dt);
    S.render();
    report(clamp01(s.sum / ROUNDS));
    tick();
  }, g.ready);
  const near = (p, q, r) => Math.hypot(p[0] - q[0], p[1] - q[1]) < r;
  const down = (e) => {
    const s = st.current, p = g.S.current?.ground(e);
    if (!p || s.phase !== 'draw') return;
    if (!near([p.x, p.z], s.map.start, 2.2)) return void (s.msg = '기지(천막)에서부터 그려요');
    s.pts = [[...s.map.start]];
    s.drawing = true;
    s.msg = '';
  };
  const move = (e) => {
    const s = st.current, p = g.S.current?.ground(e);
    if (!p || !s.drawing) return;
    const last = s.pts[s.pts.length - 1];
    if (Math.hypot(p.x - last[0], p.z - last[1]) > 0.35) {
      s.pts.push([Math.max(-8, Math.min(8, p.x)), Math.max(-8, Math.min(8, p.z))]);
      drawLine();
    }
  };
  const up = () => {
    const s = st.current;
    if (!s.drawing) return;
    s.drawing = false;
    if (!near(s.pts[s.pts.length - 1], s.map.goal, 2.2)) return void ((s.msg = '깃발까지 이어 그려요'), (s.pts = []), drawLine());
    s.pts.push([...s.map.goal]);
    drawLine();
    s.res = pathEval(s.map, s.pts, TRUCKS);
    s.phase = 'run';
    s.d = 0;
  };
  const s = st.current;
  return (
    <>
      <Hud items={[['판', `${Math.min(ROUNDS, s.round + 1)}/${ROUNDS}`], ['도착', s.res ? `${s.res.alive}/${TRUCKS}대` : '-']]} />
      <Box3D r={g.ref} ready={g.ready} fail={g.fail} onPointerDown={down} onPointerMove={move} onPointerUp={up}>
        <p className="mg-tip">{s.msg || (s.phase === 'draw' ? '⛺ 기지 → 🚩 깃발 · 다리로만 강을 건너요' : '🚚 수송 중…')}</p>
      </Box3D>
    </>
  );
}

/* ── 해상 · 어뢰 피하기(끌기): 구축함을 좌우로 끌어 흰 물살을 피함 ── */
export function ETorpedo({ level, seed, report, finish }: MiniProps) {
  const rng = useRng(seed);
  const TOTAL = 26;
  const st = useRef({ t: 0, x: 0, tx: 0, hp: 3, dodged: 0, total: 0, next: 1, over: false, torps: [] as any[] });
  const tick = useTick();
  const g = use3D({ cam: [0, 11, 10.5], look: [0, 0, -1], sky: 0x8fb6cc }, ['boat'], (k, S) => {
    k.floor(S.scene, k.MAT.water, 80, 80);
    const me = k.ship('us', 2.2);
    me.position.set(0, 0, 3);
    me.rotation.y = Math.PI;
    S.scene.add(me);
    for (let i = 0; i < 3; i++) {
      const b = k.ship('foe', 1.6);
      b.position.set(-7 + i * 7, 0, -11);
      S.scene.add(b);
    }
    return { me };
  });
  useLoop((dt) => {
    const s = st.current, S = g.S.current, k = g.K.current, W = g.W.current;
    if (!S || !k || !W || s.over) return;
    s.t += dt;
    const dx = s.tx - s.x;
    s.x += Math.sign(dx) * Math.min(Math.abs(dx), dt * 5.5);
    W.me.position.x = s.x;
    W.me.rotation.z = -Math.sign(dx) * Math.min(0.12, Math.abs(dx) * 0.1);
    if (Math.random() < dt * 6) S.smoke(W.me.position.clone().add(new k.THREE.Vector3(0, 0.1, 1.1)), 0.2, false);
    if (s.t > s.next && s.total < TOTAL) {
      s.next = s.t + rng.range(0.6, 1.2) / level;
      s.total++;
      const o = new k.THREE.Group();
      o.add(k.box(0.12, 0.08, 0.7, k.MAT.metal, 0, 0.04, 0));
      o.position.set(rng.chance(0.3) ? s.x + rng.range(-0.6, 0.6) : rng.range(-4, 4), 0, -12);
      S.scene.add(o);
      s.torps.push({ o, v: rng.range(5, 7) * level, alive: true });
    }
    for (const tp of s.torps) {
      if (!tp.alive) continue;
      tp.o.position.z += tp.v * dt;
      if (Math.random() < dt * 20) S.smoke(tp.o.position.clone().add(new k.THREE.Vector3(0, 0.05, -0.4)), 0.15, false);
      if (Math.abs(tp.o.position.z - 3) < 0.9 && Math.abs(tp.o.position.x - s.x) < 0.42) {
        tp.alive = false;
        s.hp--;
        S.scene.remove(tp.o);
        S.splash(W.me.position.clone(), 1.2);
        S.boom(W.me.position.clone().add(new k.THREE.Vector3(0, 0.3, 0)), 0.8);
      } else if (tp.o.position.z > 6) {
        tp.alive = false;
        s.dodged++;
        S.scene.remove(tp.o);
      }
    }
    S.fx(dt);
    S.render();
    const sc = clamp01((s.dodged / TOTAL) * (0.55 + (0.45 * s.hp) / 3) * 1.08);
    report(sc);
    if (s.hp <= 0 || (s.total >= TOTAL && s.torps.every((x) => !x.alive))) {
      s.over = true;
      finish(s.hp <= 0 ? sc * 0.6 : sc);
    }
    tick();
  }, g.ready);
  const aim = (e) => {
    const p = g.S.current?.ground(e);
    if (p) st.current.tx = Math.max(-4.2, Math.min(4.2, p.x));
  };
  const s = st.current;
  return (
    <>
      <Hud items={[['피함', `${s.dodged}/${TOTAL}`], ['선체', '❤️'.repeat(Math.max(0, s.hp))]]} />
      <Box3D r={g.ref} ready={g.ready} fail={g.fail} onPointerDown={aim} onPointerMove={(e) => e.buttons && aim(e)}>
        <p className="mg-tip">화면을 끌면 배가 따라와요</p>
      </Box3D>
    </>
  );
}
