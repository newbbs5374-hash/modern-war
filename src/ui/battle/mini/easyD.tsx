// @ts-nocheck
// 11-27 한 손가락 미니 훈련(2차 ②) — "꾹" 12개. 틀 넷에 3D 장면만 갈아 끼움.
//  BandGame   누르면 오르고 떼면 내려감 → 초록 칸에 머물기
//  GateGame   문이 열렸을 때만 누르고 있기
//  ReleaseGame 누르고 있다가 알맞은 때 떼기(aim: 자리 맞추기 · luck: 터지기 직전까지 버티기)
//  EClimb     외줄 타기(힘 관리)
import { useRef, useState } from 'react';
import { Hud, clamp01, useLoop, useRng, type MiniProps } from './kit';
import { Box3D, use3D } from './three';
import { V, lerp, ringMesh, scatter, sp } from './easyC';

const useTick = () => {
  const [, t] = useState(0);
  return () => t((x) => (x + 1) % 1000);
};
function Gauge({ v, c, w, label, red }: { v: number; c?: number; w?: number; label: string; red?: boolean }) {
  return (
    <div className={`eg-gauge ${red ? 'red' : ''}`}>
      {c != null && <i className="eg-band" style={{ bottom: `${clamp01(c - w) * 100}%`, height: `${w * 200}%` }} />}
      {red ? <i className="eg-fill" style={{ height: `${clamp01(v) * 100}%` }} /> : <i className="eg-mark" style={{ bottom: `${clamp01(v) * 100}%` }} />}
      <small>{label}</small>
    </div>
  );
}
const holdOn = (st) => ({ onPointerDown: () => (st.current.hold = true), onPointerUp: () => (st.current.hold = false) });

/* ───────── 초록 칸에 머물기 ───────── */
interface BandSkin { cam; look; sky?; models: string[]; build; target: (t: number, lv: number, ph: number) => number; half: number; up: number; down: number; draw; label: string; tips: [string, string, string]; hudName: string }
function BandGame({ level, seed, report, skin }: MiniProps & { skin: BandSkin }) {
  const rng = useRng(seed);
  const ph = useRef(rng.range(0, 6));
  const st = useRef({ hold: false, v: 0.5, c: 0.5, t: 0, good: 0 });
  const half = skin.half / Math.sqrt(level) + 0.03;
  const tick = useTick();
  const g = use3D({ cam: skin.cam, look: skin.look, sky: skin.sky }, skin.models, (k, S) => skin.build(k, S, rng));
  useLoop((dt) => {
    const s = st.current, S = g.S.current, k = g.K.current, W = g.W.current;
    if (!S || !k || !W) return;
    s.t += dt;
    s.v = clamp01(s.v + (s.hold ? skin.up : -skin.down) * dt);
    s.c = skin.target(s.t, level, ph.current);
    const inBand = Math.abs(s.v - s.c) <= half;
    if (inBand) s.good += dt;
    skin.draw({ W, k, S, v: s.v, c: s.c, half, inBand, t: s.t, dt, hold: s.hold, level, ph: ph.current });
    S.fx(dt);
    S.render();
    report(clamp01((s.good / Math.max(1.5, s.t)) * 1.12));
    tick();
  }, g.ready);
  const s = st.current;
  return (
    <>
      <Hud items={[[skin.hudName, `${Math.round((s.good / Math.max(1, s.t)) * 100)}%`]]} />
      <Box3D r={g.ref} ready={g.ready} fail={g.fail} {...holdOn(st)}>
        <Gauge v={s.v} c={s.c} w={half} label={skin.label} />
        <p className="mg-tip">{s.v > s.c + half ? skin.tips[0] : s.v < s.c - half ? skin.tips[1] : skin.tips[2]}</p>
      </Box3D>
    </>
  );
}

/* 항공 · 하늘에서 기름 받기 */
const B_AIRFUEL: BandSkin = {
  cam: [4, 4.5, 9], look: [0, 3, -3], sky: 0x86b3d1, models: ['jet'], half: 0.11, up: 0.55, down: 0.5, label: '거리', hudName: '급유한 시간',
  tips: ['너무 붙었어요 · 손을 떼요', '멀어요 · 꾹 눌러요', '⛽ 급유 중'],
  target: (t, lv, ph) => 0.5 + 0.22 * Math.sin(t * 0.7 * lv + ph) + 0.08 * Math.sin(t * 2.1),
  build(k, S) {
    k.floor(S.scene, k.MAT.water, 300, 300);
    const tanker = k.model('jet', 'us');
    tanker.scale.multiplyScalar(2.6);
    tanker.rotation.y = Math.PI;
    const me = k.model('jet', 'us');
    me.rotation.y = Math.PI;
    const hose = k.box(0.06, 0.06, 1, k.MAT.black);
    const clouds = Array.from({ length: 8 }, (_, i) => {
      const c = new k.THREE.Mesh(new k.THREE.SphereGeometry(1.2, 7, 5), new k.THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7 }));
      c.position.set((i % 2 ? 1 : -1) * (5 + (i % 3) * 2), 1 + (i % 3), -30 + i * 6);
      c.scale.set(2, 0.6, 1.4);
      S.scene.add(c);
      return c;
    });
    S.scene.add(tanker, me, hose);
    return { tanker, me, hose, clouds };
  },
  draw({ W, v, c, inBand, t, dt }) {
    W.tanker.position.set(Math.sin(t * 0.5) * 0.4, 4, -6);
    // v 가 클수록 급유기에 붙음. c = 알맞은 거리
    const z = lerp(2.5, -5.5, v) - lerp(2.5, -5.5, c) - 2.6;
    W.me.position.set(W.tanker.position.x, 3.3, z);
    W.hose.visible = inBand;
    W.hose.position.set(W.tanker.position.x, 3.65, (z - 6) / 2 + 0.2);
    W.hose.scale.z = Math.abs(z + 6) - 0.5;
    W.clouds.forEach((o) => {
      o.position.z += dt * 14;
      if (o.position.z > 14) o.position.z -= 48;
    });
  },
};

/* 해상 · 바다에서 보급받기 */
const B_SEAFUEL: BandSkin = {
  cam: [0, 9, 9], look: [0, 0, -1], sky: 0x8fb6cc, models: ['boat'], half: 0.11, up: 0.45, down: 0.4, label: '빠르기', hudName: '보급받은 시간',
  tips: ['앞서 나갔어요 · 손을 떼요', '뒤처졌어요 · 꾹 눌러요', '🛢️ 줄이 이어졌어요'],
  target: (t, lv, ph) => 0.5 + 0.2 * Math.sin(t * 0.6 * lv + ph) + 0.1 * Math.sin(t * 1.5 + ph * 2),
  build(k, S) {
    k.floor(S.scene, k.MAT.water, 200, 200);
    const sup = k.ship('us', 4.2), me = k.ship('us', 2.6);
    sup.rotation.y = Math.PI;
    me.rotation.y = Math.PI;
    sup.position.x = -1.3;
    me.position.x = 1.3;
    const line = k.box(2.4, 0.05, 0.05, k.MAT.black, 0, 0.7, 0);
    S.scene.add(sup, me, line);
    return { sup, me, line, off: 0 };
  },
  draw({ W, k, S, v, c, inBand, t, dt }) {
    // 속도 차이가 쌓여 앞뒤로 벌어짐(가운데로 조금씩 돌아옴)
    W.off = Math.max(-5, Math.min(5, W.off + (v - c) * 9 * dt));
    W.off *= 1 - dt * 0.6;
    W.sup.position.z = -1;
    W.me.position.z = -1 - W.off;
    W.line.visible = inBand && Math.abs(W.off) < 1.2;
    W.line.position.z = -1 - W.off / 2;
    W.line.rotation.y = Math.atan2(W.off, 2.6);
    if (Math.random() < dt * 12) S.smoke(V(k, (Math.random() < 0.5 ? -1.3 : 1.3), 0.1, 1.5 + Math.random()), 0.25, false);
    W.sup.rotation.z = Math.sin(t) * 0.04;
  },
};

/* 항공 · 낮게 뚫고 들어가기: 산보다 높게, 레이더(빨간 띠)보다 낮게 */
const terr = (tt: number, lv: number, ph: number) => 0.42 + 0.24 * Math.sin(tt * 0.9 * lv + ph) + 0.1 * Math.sin(tt * 2.3 + ph);
const B_LOWFLY: BandSkin = {
  cam: [0, 5, 11], look: [0, 3.6, -6], sky: 0x9cbcd0, models: ['jet'], half: 0.1, up: 0.75, down: 0.7, label: '높이', hudName: '안 들킨 시간',
  tips: ['📡 레이더에 걸려요 · 손을 떼요', '⛰️ 산에 부딪혀요 · 꾹 눌러요', '🫥 레이더 아래로 나는 중'],
  target: (t, lv, ph) => terr(t, lv, ph) + 0.16,
  build(k, S) {
    k.floor(S.scene, k.M(0x55683f), 300, 300);
    const jet = k.model('jet', 'us');
    jet.rotation.y = Math.PI;
    const hills = Array.from({ length: 16 }, (_, i) => {
      const m = new k.THREE.Mesh(new k.THREE.ConeGeometry(2.6, 1, 6), k.M(i % 2 ? 0x6d7a4f : 0x7a7458));
      m.userData.tau = i * 0.35;
      S.scene.add(m);
      return m;
    });
    const radar = k.box(14, 0.05, 30, new k.THREE.MeshBasicMaterial({ color: 0xff5a4a, transparent: true, opacity: 0.22 }), 0, 0, -10);
    S.scene.add(jet, radar);
    return { jet, hills, radar };
  },
  draw({ W, v, c, half, t, hold, level, ph }) {
    const H = 7.5;
    W.jet.position.set(0, 0.6 + v * H, 0);
    W.jet.rotation.x = hold ? -0.18 : 0.14;
    W.radar.position.y = 0.6 + (c + half) * H + 0.5;
    for (const m of W.hills) {
      if (m.userData.tau < t - 0.5) m.userData.tau += 16 * 0.35;
      const h = Math.max(0.3, terr(m.userData.tau, level, ph) * H);
      m.scale.set(1, h, 1);
      m.position.set(Math.sin(m.userData.tau * 7) * 1.2, h / 2, -(m.userData.tau - t) * 9);
    }
  },
};

/* ───────── 문이 열렸을 때만 누르고 있기 ───────── */
function GateGame({ level, seed, report, finish, skin }: MiniProps & { skin }) {
  const rng = useRng(seed);
  const st = useRef({ hold: false, t: 0, good: 0, bad: 0, openT: 0, ammo: 1, open: false, m: 0.5, over: false, d: skin.init?.(rng, level) ?? {} });
  const tick = useTick();
  const g = use3D({ cam: skin.cam, look: skin.look, sky: skin.sky }, skin.models, (k, S) => skin.build(k, S, rng));
  useLoop((dt) => {
    const s = st.current, S = g.S.current, k = g.K.current, W = g.W.current;
    if (!S || !k || !W || s.over) return;
    s.t += dt;
    s.open = skin.gate(s, level, rng, dt);
    const firing = s.hold && (!skin.ammo || s.ammo > 0);
    if (skin.ammo) s.ammo = clamp01(s.ammo + (s.hold ? -skin.ammo[0] : skin.ammo[1]) * dt);
    if (s.open) s.openT += dt;
    if (firing && s.open) s.good += dt;
    if (firing && !s.open) s.bad += dt;
    skin.draw({ W, k, S, s, firing, dt, level });
    S.fx(dt);
    S.render();
    const sc = skin.need ? clamp01(s.good / skin.need - s.bad * 0.22) : clamp01((s.good / Math.max(1.5, s.openT)) * 1.1 - s.bad * 0.05);
    report(sc);
    if (skin.need && s.good >= skin.need) {
      s.over = true;
      finish(sc);
    }
    tick();
  }, g.ready);
  const s = st.current;
  return (
    <>
      <Hud items={skin.hud(s)} />
      <Box3D r={g.ref} ready={g.ready} fail={g.fail} {...holdOn(st)}>
        {skin.gauge && <Gauge v={s.m} c={0.5} w={skin.gauge(level)} label={skin.gaugeLabel} />}
        <p className="mg-tip">{skin.tip(s)}</p>
      </Box3D>
    </>
  );
}

/* 잠입 · 폭약 설치: 떨림 표시가 초록 칸에 있을 때만 누름 */
const G_BOMBSET = {
  cam: [2.5, 3, 6], look: [0, 0.8, 0], sky: 0x16222e, models: ['container', 'antenna', 'barrel', 'crate'], need: 9,
  gauge: (lv) => 0.17 / Math.sqrt(lv) + 0.03, gaugeLabel: '손 떨림',
  init: (rng) => ({ ph: rng.range(0, 6) }),
  gate(s, lv) {
    s.m = clamp01(0.5 + 0.33 * Math.sin(s.t * 2.1 * Math.sqrt(lv) + s.d.ph) + 0.13 * Math.sin(s.t * 6.3));
    return Math.abs(s.m - 0.5) <= this.gauge(lv);
  },
  hud: (s) => [['설치', `${Math.round(clamp01(s.good / 9) * 100)}%`], ['소리 남', `${s.bad.toFixed(1)}초`]],
  tip: (s) => (s.hold && !s.open ? '⚠️ 손이 떨려요 · 손을 떼요' : s.open ? '지금! 꾹 누르고 있어요' : '떨림이 초록 칸에 올 때까지 기다려요'),
  build(k, S) {
    k.floor(S.scene, k.M(0x343c3a), 40, 40);
    const tower = k.model('antenna');
    tower.scale.multiplyScalar(2.2);
    tower.position.set(0.9, 0, -0.6);
    scatter(k, S, ['container', 'barrel', 'crate'], 8, (i) => [(i % 2 ? 1 : -1) * (4 + (i % 3)), -5 + i * 0.9], 1.2);
    const me = k.soldier('us');
    me.rotation.y = Math.PI * 0.75;
    me.scale.y = 1.6;
    const bomb = k.box(0.5, 0.3, 0.35, k.M(0x7a5a3a), 0.6, 0.15, -0.1);
    const lamp = new k.THREE.Mesh(new k.THREE.SphereGeometry(0.09, 8, 6), new k.THREE.MeshBasicMaterial({ color: 0x5dff8a }));
    lamp.position.set(0.6, 0.4, -0.1);
    S.scene.add(tower, me, bomb, lamp);
    return { me, lamp };
  },
  draw({ W, k, S, s, firing, dt }) {
    W.lamp.material.color.setHex(firing && !s.open ? 0xff5a4a : firing ? 0x5dff8a : 0x888888);
    W.lamp.scale.setScalar(1 + (s.good / 9) * 2);
    W.me.position.set(Math.sin(s.t * 31) * (firing && !s.open ? 0.03 : 0), 0, 0.2);
    if (firing && !s.open && Math.random() < dt * 8) S.smoke(V(k, 0.6, 0.5, -0.1), 0.25, true);
  },
};

/* 사격 · 엄호 사격: 아군이 뛰는 동안만 쏨. 탄창이 비지 않게 */
const G_COVER = {
  cam: [0, 5.5, 11], look: [0, 1, -2], models: ['tree', 'rock', 'crate', 'b1g'], ammo: [0.42, 0.5],
  init: (rng) => ({ next: 1.5, until: 0, runs: 0 }),
  gate(s, lv, rng) {
    if (s.t > s.d.next && s.t > s.d.until) {
      s.d.until = s.t + rng.range(1.8, 3);
      s.d.next = s.d.until + rng.range(1.2, 2.4) / Math.sqrt(lv);
      s.d.runs++;
    }
    return s.t < s.d.until;
  },
  hud: (s) => [['엄호한 시간', `${Math.round((s.good / Math.max(1, s.openT)) * 100)}%`], ['탄창', `${Math.round(s.ammo * 100)}%`]],
  tip: (s) => (s.ammo <= 0 ? '탄창이 비었어요 · 손을 떼면 갈아 끼워요' : s.open ? '🏃 아군이 뛰어요 · 꾹 눌러 엄호!' : '아군이 숨었어요 · 손을 떼고 탄을 아껴요'),
  build(k, S) {
    k.floor(S.scene, k.MAT.grass, 80, 60);
    scatter(k, S, ['tree', 'rock'], 14, (i) => [-10 + i * 1.5, -10 - (i % 2)]);
    const bunker = k.model('b1g');
    bunker.position.set(0, 0, -8);
    bunker.scale.multiplyScalar(1.4);
    const covers = [0, 1, 2, 3].map((i) => {
      const c = k.model('crate');
      c.scale.multiplyScalar(2);
      c.position.set(3, 0, 4 - i * 3);
      S.scene.add(c);
      return c;
    });
    const men = [0, 1, 2].map((i) => {
      const o = k.soldier('us');
      o.rotation.y = Math.PI;
      o.userData.dx = 3 + (i - 1) * 0.5;
      S.scene.add(o);
      return o;
    });
    const gun = k.soldier('us');
    gun.position.set(-3, 0, 6);
    gun.rotation.y = Math.PI;
    gun.scale.multiplyScalar(1.4);
    S.scene.add(bunker, gun);
    return { men, z: 5.5 };
  },
  draw({ W, k, S, s, firing, dt }) {
    if (s.open) W.z -= dt * 1.25;
    if (W.z < -6) W.z = 5.5;
    W.men.forEach((o) => {
      o.position.set(o.userData.dx, 0, W.z);
      o.scale.y = s.open ? 2.4 : 1.5;
      k.walk(o, s.t, s.open);
    });
    if (firing && Math.random() < dt * 14) S.tracer(V(k, -3, 1, 5.5), V(k, (Math.random() - 0.5) * 2, 1 + Math.random(), -8), 0xfff2a8);
    if (s.open && !firing && Math.random() < dt * 7) S.tracer(V(k, 0, 1.2, -8), V(k, 3 + (Math.random() - 0.5), 0.6, W.z), 0xff5a4a);
  },
};

/* ───────── 누르고 있다가 알맞은 때 떼기 ───────── */
function ReleaseGame({ level, seed, report, finish, skin }: MiniProps & { skin }) {
  const rng = useRng(seed);
  const st = useRef({ i: 0, r: skin.next(rng, level, 0), hold: false, h: 0, x: 0, phase: 'idle', q: 0, wt: 0, sum: 0, t: 0, over: false });
  const tick = useTick();
  const g = use3D({ cam: skin.cam, look: skin.look, sky: skin.sky }, skin.models, (k, S) => skin.build(k, S, rng));
  /** aim: 지금 자리와 과녁의 거리(0~0.5) */
  const dist = (s) => {
    const d = Math.abs(s.x - s.r.sweet);
    return skin.wrap ? Math.min(d, 1 - d) : d;
  };
  const settle = (q) => {
    const s = st.current;
    s.q = q;
    s.phase = q > 0 ? 'hit' : 'miss';
    s.wt = 0;
    s.sum += q;
    s.hold = false;
  };
  useLoop((dt) => {
    const s = st.current, S = g.S.current, k = g.K.current, W = g.W.current;
    if (!S || !k || !W || s.over) return;
    s.t += dt;
    if (s.phase === 'hold') {
      if (skin.mode === 'aim') {
        s.h += dt / s.r.dur;
        s.x = skin.wrap ? s.h % 1 : 1 - Math.abs(1 - (s.h % 2));
      } else {
        s.h += (dt / s.r.dur) * (1 + 0.45 * Math.sin(s.t * 5 + s.r.ph));
        s.x = s.h;
        if (s.h >= 1) settle(0);
      }
    } else if (s.phase !== 'idle') {
      s.wt += dt;
      if (s.wt > 1.3) {
        s.i++;
        if (s.i >= skin.rounds) {
          s.over = true;
          return finish(clamp01((s.sum / skin.rounds) * 1.06));
        }
        Object.assign(s, { r: skin.next(rng, level, s.i), h: 0, x: 0, phase: 'idle' });
      }
    }
    const clar = skin.mode === 'aim' ? Math.exp(-Math.pow(dist(s) / 0.13, 2)) : 0;
    skin.draw({ W, k, S, s, r: s.r, x: s.x, phase: s.phase, q: s.q, wt: s.wt, t: s.t, dt, clar });
    S.fx(dt);
    S.render();
    report(clamp01((s.sum / skin.rounds) * 1.06));
    tick();
  }, g.ready);
  const down = () => {
    const s = st.current;
    if (s.phase === 'idle' && !s.over) {
      s.phase = 'hold';
      s.hold = true;
    }
  };
  const up = () => {
    const s = st.current;
    if (s.phase !== 'hold') return;
    if (skin.mode === 'aim') {
      const d = dist(s);
      settle(s.h < 0.08 ? 0 : d < 0.035 ? 1 : d < 0.08 ? 0.7 : d < 0.14 ? 0.4 : 0);
    } else settle(s.h < 0.1 ? 0 : Math.pow(s.h, 1.5));
  };
  const s = st.current;
  const clarNow = skin.mode === 'aim' ? Math.exp(-Math.pow(dist(s) / 0.13, 2)) : 0;
  return (
    <>
      <Hud items={[['차례', `${Math.min(skin.rounds, s.i + 1)}/${skin.rounds}`], ['방금', s.phase === 'hit' || s.phase === 'miss' ? `${Math.round(s.q * 100)}점` : '-'], ...(skin.mode === 'aim' && skin.meter ? [[skin.meter, '▮'.repeat(Math.round(clarNow * 6)) + '▯'.repeat(6 - Math.round(clarNow * 6))]] : [])]} />
      <Box3D r={g.ref} ready={g.ready} fail={g.fail} onPointerDown={down} onPointerUp={up}>
        {skin.mode === 'luck' && <Gauge v={s.phase === 'idle' ? 0 : s.x} label={skin.danger} red />}
        <p className="mg-tip">{s.phase === 'idle' ? skin.tips[0] : s.phase === 'hold' ? skin.tips[1] : s.phase === 'hit' ? skin.tips[2] : skin.tips[3]}</p>
      </Box3D>
    </>
  );
}

const waveLine = (k, S, col) => {
  const geo = new k.THREE.BufferGeometry().setFromPoints(Array.from({ length: 60 }, (_, i) => V(k, -4 + i * (8 / 59), 0, 0)));
  const l = new k.THREE.Line(geo, new k.THREE.LineBasicMaterial({ color: col }));
  S.scene.add(l);
  return l;
};
const setWave = (line, y0, amp, f, ph, noise) => {
  const a = line.geometry.attributes.position;
  for (let i = 0; i < a.count; i++) a.setY(i, y0 + Math.sin(a.getX(i) * f + ph) * amp + (Math.random() - 0.5) * noise);
  a.needsUpdate = true;
};

/* 정보 · 감청 주파수 잡기 */
const R_RADIO = {
  rounds: 6, mode: 'aim', meter: '또렷함', cam: [0, 2.5, 10], look: [0, 2.2, 0], sky: 0x0d1a24, models: ['antenna', 'container'],
  tips: ['꾹 누르면 바늘이 움직여요', '물결이 또렷해지는 곳에서 손을 떼요', '🎧 목소리를 잡았어요', '📻 잡음뿐이에요'],
  next: (rng, lv) => ({ dur: rng.range(2.6, 3.6) / sp(lv), sweet: rng.range(0.2, 0.9) }),
  build(k, S) {
    k.floor(S.scene, k.M(0x1c2a30), 60, 60);
    const an = k.model('antenna');
    an.scale.multiplyScalar(2.4);
    an.position.set(-4.6, 0, -2);
    const truck = k.model('container', 'us');
    truck.position.set(4.4, 0, -2);
    truck.scale.multiplyScalar(1.4);
    const dial = k.box(8, 0.08, 0.08, k.MAT.white, 0, 0.5, 2);
    const needle = k.box(0.12, 0.9, 0.12, k.M(0xffb020), 0, 0.5, 2);
    S.scene.add(an, truck, dial, needle);
    return { wave: waveLine(k, S, 0x5dff8a), needle };
  },
  draw({ W, x, clar, t }) {
    W.needle.position.x = lerp(-4, 4, x);
    setWave(W.wave, 3, 0.25 + clar * 1.1, 2.2, t * 6, (1 - clar) * 1.1);
  },
};

/* 정보 · 암호 원판: 금색 칸이 화살표 아래 올 때 뗌 */
const R_WHEEL = {
  rounds: 6, mode: 'aim', wrap: true, cam: [0, 0.3, 11], look: [0, 0.3, 0], sky: 0x0d1a24, models: [],
  tips: ['꾹 누르면 원판이 돌아요', '금색 칸이 ▼ 아래 오면 손을 떼요', '🔓 말이 됐어요', '🔒 뜻 없는 글자예요'],
  next: (rng, lv) => ({ dur: rng.range(2.2, 3.2) / sp(lv), sweet: rng.range(0.3, 0.95) }),
  build(k, S) {
    const wheel = new k.THREE.Group();
    const cells = Array.from({ length: 12 }, (_, i) => {
      const b = k.box(1, 1, 0.3, new k.THREE.MeshBasicMaterial({ color: i % 2 ? 0x45525f : 0x5a6877 }));
      const a = (i / 12) * Math.PI * 2;
      b.position.set(Math.cos(a) * 3.2, Math.sin(a) * 3.2, 0);
      b.rotation.z = a;
      wheel.add(b);
      return b;
    });
    wheel.add(new k.THREE.Mesh(new k.THREE.TorusGeometry(2.3, 0.08, 6, 40), new k.THREE.MeshBasicMaterial({ color: 0x3fb8c9 })));
    const arrow = new k.THREE.Mesh(new k.THREE.ConeGeometry(0.35, 0.7, 3), new k.THREE.MeshBasicMaterial({ color: 0xffffff }));
    arrow.position.set(0, 4.4, 0);
    arrow.rotation.z = Math.PI;
    S.scene.add(wheel, arrow);
    return { wheel, cells, gold: -1 };
  },
  draw({ W, r, x, phase }) {
    const gi = Math.round(r.sweet * 12) % 12;
    if (W.gold !== gi || phase === 'idle') {
      W.cells.forEach((b, i) => b.material.color.setHex(i === gi ? 0xffb020 : i % 2 ? 0x45525f : 0x5a6877));
      W.gold = gi;
    }
    // x = sweet 일 때 금색 칸(각도 gi/12)이 위(π/2)에 오게
    W.wheel.rotation.z = Math.PI / 2 - (gi / 12) * Math.PI * 2 + (x - r.sweet) * Math.PI * 2;
  },
};

const luckNext = (rng, lv, a = 2.2, b = 4.2) => ({ dur: rng.range(a, b) / sp(lv), ph: rng.range(0, 6) });

/* 해킹 · 흔적 지우기 */
const R_TRACE = {
  rounds: 5, mode: 'luck', danger: '추적', cam: [0, 4, 10], look: [0, 1.6, 0], sky: 0x07131c, models: ['container'],
  tips: ['꾹 누르면 자료를 빼내요', '추적 막대가 다 차기 전에 손을 떼요 · 오래 버틸수록 많이 빼내요', '💾 빼내고 흔적을 지웠어요', '🚨 추적당했어요'],
  next: (rng, lv) => luckNext(rng, lv),
  build(k, S) {
    k.floor(S.scene, k.M(0x10202a), 60, 60);
    const racks = [-4, -2, 0, 2, 4].map((x) => {
      const o = k.model('container');
      o.rotation.y = Math.PI / 2;
      o.position.set(x, 0, -3);
      o.scale.multiplyScalar(1.3);
      S.scene.add(o);
      return o;
    });
    const bits = Array.from({ length: 12 }, (_, i) => {
      const b = k.box(0.5, 0.5, 0.5, new k.THREE.MeshBasicMaterial({ color: 0x24404a }), -3.3 + i * 0.6, 0.4, 2);
      S.scene.add(b);
      return b;
    });
    const eye = new k.THREE.Mesh(new k.THREE.SphereGeometry(0.5, 12, 8), new k.THREE.MeshBasicMaterial({ color: 0xff5a4a }));
    eye.position.set(0, 4.2, -3);
    S.scene.add(eye);
    return { racks, bits, eye };
  },
  draw({ W, x, phase, t }) {
    W.bits.forEach((b, i) => b.material.color.setHex(phase === 'miss' ? 0xff5a4a : i < Math.round(x * 12) && phase !== 'idle' ? 0x5dff8a : 0x24404a));
    W.eye.scale.setScalar(phase === 'idle' ? 0.3 : 0.4 + x * 1.6 + Math.sin(t * 20) * 0.05 * x);
  },
};

/* 통솔 · 앞장서기 */
const R_FRONT = {
  rounds: 5, mode: 'luck', danger: '위험', cam: [4, 5, 10], look: [0, 1, -1], models: ['tree', 'rock', 'bush'],
  tips: ['꾹 누르면 내가 앞장서요', '포탄이 가까워져요 · 위험이 다 차기 전에 손을 떼요', '🫡 사기가 올랐어요', '🩹 다쳤어요'],
  next: (rng, lv) => luckNext(rng, lv),
  build(k, S) {
    k.floor(S.scene, k.MAT.dirt, 80, 80);
    scatter(k, S, ['tree', 'rock', 'bush'], 16, (i) => [(i % 2 ? 1 : -1) * (5 + (i % 4)), -10 + i * 1.2]);
    const me = k.soldier('us');
    me.rotation.y = Math.PI;
    me.scale.multiplyScalar(1.25);
    const men = Array.from({ length: 8 }, (_, i) => {
      const o = k.soldier('us');
      o.rotation.y = Math.PI;
      o.position.set(-1.8 + (i % 4) * 1.2, 0, 3 + Math.floor(i / 4) * 1.1);
      S.scene.add(o);
      return o;
    });
    const flag = k.box(0.02, 0.6, 0.02, k.MAT.white, 0.1, 0.4, 0);
    flag.add(k.box(0.22, 0.14, 0.015, k.M(0x3fb8c9), 0.12, 0.22, 0));
    me.add(flag);
    S.scene.add(me);
    return { me, men };
  },
  draw({ W, k, S, x, phase, t, dt }) {
    const z = phase === 'idle' ? 2 : phase === 'hold' ? 2 - x * 5 : 2 - (phase === 'hit' ? x * 5 : 0);
    W.me.position.set(0, 0, z);
    W.me.rotation.x = phase === 'miss' ? Math.PI / 2 : 0;
    k.walk(W.me, t, phase === 'hold');
    W.men.forEach((o) => {
      o.scale.y = 1.5 + (phase === 'idle' ? 0 : x) * 0.9;
      k.walk(o, t, phase === 'hit');
    });
    if (phase === 'hold' && Math.random() < dt * (1 + x * 6)) S.boom(V(k, (Math.random() - 0.5) * 8 * (1.2 - x), 0.1, z - 5 * (1.1 - x) + (Math.random() - 0.5)), 0.7 + x * 0.5);
  },
};

/* 보급 · 야전 수리 */
const R_REPAIR = {
  rounds: 5, mode: 'luck', danger: '적 접근', cam: [3, 4.5, 9], look: [0, 0.8, -2], models: ['tank', 'crate', 'tree', 'rock'],
  tips: ['꾹 누르면 전차를 고쳐요', '적 전차가 닿기 전에 손을 떼고 빠져요 · 많이 고칠수록 좋아요', '🔧 고쳐서 빠져나왔어요', '💥 고치다 당했어요'],
  next: (rng, lv) => luckNext(rng, lv, 2.6, 4.6),
  build(k, S) {
    k.floor(S.scene, k.MAT.grass, 80, 80);
    scatter(k, S, ['tree', 'rock', 'crate'], 14, (i) => [(i % 2 ? 1 : -1) * (4 + (i % 4)), -12 + i * 1.3]);
    const mine = k.model('tank', 'us'), foe = k.model('tank', 'foe');
    mine.scale.multiplyScalar(1.6);
    foe.scale.multiplyScalar(1.6);
    const me = k.soldier('us');
    me.position.set(1.3, 0, 0.6);
    me.rotation.y = -Math.PI / 2;
    S.scene.add(mine, foe, me);
    return { mine, foe, me };
  },
  draw({ W, k, S, x, phase, wt, t, dt }) {
    W.foe.position.set(-1, 0, phase === 'idle' ? -16 : lerp(-16, -3, x));
    W.mine.position.set(phase === 'hit' ? wt * 6 : 0, 0, 0.4);
    W.mine.rotation.y = phase === 'hit' ? Math.PI / 2 : 0;
    W.mine.visible = !(phase === 'miss' && wt > 0.1);
    W.me.visible = phase !== 'hit';
    W.me.position.y = phase === 'hold' ? Math.abs(Math.sin(t * 12)) * 0.08 : 0;
    if (phase === 'hold' && Math.random() < dt * 6) S.smoke(V(k, 0.6, 1, 0.4), 0.2, false);
    if (phase === 'miss' && wt - dt <= 0) S.boom(V(k, 0, 0.5, 0.4), 1.5);
  },
};

/* 포격 · 쏘고 자리 뜨기 */
const R_SCOOT = {
  rounds: 5, mode: 'luck', danger: '적 반격', cam: [0, 7, 12], look: [0, 1, -1], models: ['spg', 'tree', 'rock', 'bush'],
  tips: ['꾹 누르면 계속 쏴요', '적 반격 포탄이 오기 전에 손을 떼고 자리를 떠요', '🚚 쏘고 빠졌어요', '💥 반격에 맞았어요'],
  next: (rng, lv) => luckNext(rng, lv),
  build(k, S) {
    k.floor(S.scene, k.M(0x7d7a55), 80, 80);
    scatter(k, S, ['tree', 'rock', 'bush'], 16, (i) => [-12 + i * 1.6, -8 - (i % 3)]);
    const gun = k.model('spg', 'us');
    gun.scale.multiplyScalar(1.8);
    gun.rotation.y = Math.PI;
    const ring = ringMesh(k, 1, 0xff5a4a, 0.1);
    ring.position.y = 0.05;
    S.scene.add(gun, ring);
    return { gun, ring, shot: 0 };
  },
  draw({ W, k, S, x, phase, wt, dt, s }) {
    W.gun.position.set(phase === 'hit' ? Math.min(7, wt * 7) : 0, 0, 2);
    W.gun.rotation.y = phase === 'hit' ? Math.PI / 2 : Math.PI;
    W.gun.visible = !(phase === 'miss' && wt > 0.1);
    W.ring.visible = phase === 'hold';
    W.ring.position.set(0, 0.05, 2);
    W.ring.scale.setScalar(lerp(5, 1.3, x));
    if (phase === 'hold') {
      W.shot -= dt;
      if (W.shot <= 0) {
        W.shot = 0.45;
        S.tracer(V(k, 0, 1.6, 1), V(k, (Math.random() - 0.5) * 3, 9, -8), 0xfff2a8);
        S.smoke(V(k, 0, 1.6, 0.6), 0.5, false);
      }
    }
    if (phase !== 'idle' && phase !== 'hold' && wt >= 0.5 && wt - dt < 0.5) S.boom(V(k, 0, 0.2, 2), 1.6);
    void s;
  },
};

/* ───────── 체력 · 외줄 타기 ───────── */
export function EClimb({ level, seed, report, finish }: MiniProps) {
  const rng = useRng(seed);
  const H = 13;
  const st = useRef({ hold: false, y: 0, st: 1, slip: 0, slips: 0, t: 0, gust: 0, nextGust: rng.range(3, 6), over: false });
  const tick = useTick();
  const g = use3D({ cam: [5, 4, 9], look: [0, 3, 0], sky: 0x9cbcd0 }, ['tree', 'pine', 'rock', 'tent'], (k, S) => {
    k.floor(S.scene, k.MAT.grass, 60, 60);
    scatter(k, S, ['tree', 'pine', 'rock', 'tent'], 14, (i) => [(i % 2 ? 1 : -1) * (4 + (i % 4)), -8 + i]);
    S.scene.add(k.box(0.5, H + 1.5, 0.5, k.M(0x7a5a3a), -0.8, (H + 1.5) / 2, 0), k.box(2, 0.2, 0.5, k.M(0x7a5a3a), 0, H + 1.4, 0), k.box(0.07, H + 1.4, 0.07, k.M(0xd9c79a), 0.5, (H + 1.4) / 2, 0));
    const flag = k.box(0.9, 0.5, 0.05, k.M(0x3fb8c9), 0.5, H + 2, 0);
    const me = k.soldier('us');
    me.rotation.y = Math.PI / 2;
    S.scene.add(me, flag);
    return { me };
  });
  useLoop((dt) => {
    const s = st.current, S = g.S.current, k = g.K.current, W = g.W.current;
    if (!S || !k || !W || s.over) return;
    s.t += dt;
    if (s.t > s.nextGust) {
      s.gust = 1.6;
      s.nextGust = s.t + rng.range(4, 7) / level;
    }
    s.gust = Math.max(0, s.gust - dt);
    if (s.slip > 0) {
      s.slip -= dt;
      s.y = Math.max(0, s.y - dt * 3.2);
    } else if (s.hold) {
      s.y += dt * 1.25;
      s.st = clamp01(s.st - dt * 0.3 * Math.sqrt(level) * (s.gust > 0 ? 2.2 : 1));
      if (s.st <= 0) {
        s.slip = 1;
        s.slips++;
        s.st = 0.4;
      }
    } else {
      s.st = clamp01(s.st + dt * 0.45);
      s.y = Math.max(0, s.y - dt * (s.gust > 0 ? 0.5 : 0.12));
    }
    W.me.position.set(0.5 + (s.gust > 0 ? Math.sin(s.t * 9) * 0.12 : 0), s.y, 0);
    k.walk(W.me, s.t, s.hold && s.slip <= 0);
    S.camera.position.y = 4 + s.y * 0.85;
    S.camera.lookAt(0, 3 + s.y * 0.85, 0);
    if (s.gust > 0 && Math.random() < dt * 10) S.smoke(V(k, -3 + Math.random() * 6, s.y + Math.random() * 2, 1), 0.3, false);
    S.fx(dt);
    S.render();
    const sc = clamp01(s.y / H - s.slips * 0.06);
    report(sc);
    if (s.y >= H) {
      s.over = true;
      finish(clamp01(1 - s.slips * 0.08));
    }
    tick();
  }, g.ready);
  const s = st.current;
  return (
    <>
      <Hud items={[['높이', `${Math.round((s.y / H) * 100)}%`], ['미끄러짐', s.slips]]} />
      <Box3D r={g.ref} ready={g.ready} fail={g.fail} {...holdOn(st)}>
        <Gauge v={s.st} label="힘" red />
        <p className="mg-tip">{s.slip > 0 ? '😵 힘이 빠져 미끄러져요' : s.gust > 0 ? '💨 바람! 손을 떼고 버텨요' : s.st < 0.3 ? '힘이 얼마 없어요 · 손을 떼고 쉬어요' : '꾹 누르면 올라가요'}</p>
      </Box3D>
    </>
  );
}

const band = (skin) => (p: MiniProps) => <BandGame {...p} skin={skin} />;
const gate = (skin) => (p: MiniProps) => <GateGame {...p} skin={skin} />;
const rel = (skin) => (p: MiniProps) => <ReleaseGame {...p} skin={skin} />;
export const EAirFuel = band(B_AIRFUEL);
export const ESeaFuel = band(B_SEAFUEL);
export const ELowFly = band(B_LOWFLY);
export const EBombSet = gate(G_BOMBSET);
export const ECover = gate(G_COVER);
export const ERadio = rel(R_RADIO);
export const EWheel = rel(R_WHEEL);
export const ETrace = rel(R_TRACE);
export const EFront = rel(R_FRONT);
export const ERepair = rel(R_REPAIR);
export const EScoot = rel(R_SCOOT);
