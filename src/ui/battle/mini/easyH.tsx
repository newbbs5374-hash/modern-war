// @ts-nocheck
// 11-27 한 손가락 미니 훈련(2차 ⑥) — 남은 "톡" 7개: 박자 3 · 때맞추기 2 · 야간 사격 · 전력망 지키기.
import { useRef, useState } from 'react';
import { Hud, clamp01, useLoop, useRng, type MiniProps } from './kit';
import { Box3D, use3D } from './three';
import { TimingGame, V, lerp, ringMesh, scatter, sp, type TimingSkin } from './easyC';

const useTick = () => {
  const [, t] = useState(0);
  return () => t((x) => (x + 1) % 1000);
};

/* ───────── 박자 틀: 구슬이 고리에 들어올 때 누르기 ───────── */
function RhythmGame({ level, seed, report, finish, skin }: MiniProps & { skin }) {
  const rng = useRng(seed);
  const N = skin.beats ?? 24, LEAD = 1.6;
  const beats = useRef(
    (() => {
      let t = 2;
      const base = 0.82 / Math.pow(level, 0.35);
      return Array.from({ length: N }, () => {
        const b = { t, q: -1, o: null };
        t += rng.chance(0.25) ? base / 2 : base;
        return b;
      });
    })(),
  );
  const st = useRef({ t: 0, sum: 0, combo: 0, pulse: 9, miss: 0, last: '', over: false });
  const tick = useTick();
  const g = use3D({ cam: skin.cam, look: skin.look, sky: skin.sky }, skin.models, (k, S) => {
    const W = skin.build(k, S, rng);
    // 박자 길: 화면 아래쪽 띠
    const rail = k.box(6, 0.05, 0.05, k.MAT.white, 0.4, skin.railY ?? 0.3, skin.railZ ?? 3.6);
    const ring = new k.THREE.Mesh(new k.THREE.TorusGeometry(0.42, 0.06, 6, 24), new k.THREE.MeshBasicMaterial({ color: 0xffd84a }));
    ring.position.set(-2.2, skin.railY ?? 0.3, skin.railZ ?? 3.6);
    ring.rotation.x = -0.9;
    S.scene.add(rail, ring);
    beats.current.forEach((b) => {
      b.o = new k.THREE.Mesh(new k.THREE.SphereGeometry(0.26, 10, 8), new k.THREE.MeshBasicMaterial({ color: 0x5dff8a }));
      b.o.visible = false;
      S.scene.add(b.o);
    });
    return { ...W, ring };
  });
  useLoop((dt) => {
    const s = st.current, S = g.S.current, k = g.K.current, W = g.W.current;
    if (!S || !k || !W || s.over) return;
    s.t += dt;
    s.pulse += dt;
    for (const b of beats.current) {
      const d = b.t - s.t;
      if (b.q < 0 && d < -0.28) {
        b.q = 0;
        s.combo = 0;
        s.miss++;
        s.last = '놓침';
      }
      b.o.visible = b.q < 0 && d < LEAD;
      b.o.position.set(-2.2 + (d / LEAD) * 5.4, skin.railY ?? 0.3, skin.railZ ?? 3.6);
    }
    W.ring.scale.setScalar(1 + Math.max(0, 0.3 - s.pulse) * 1.5);
    const done = beats.current.filter((b) => b.q >= 0).length;
    skin.draw({ W, k, S, t: s.t, dt, pulse: s.pulse, combo: s.combo, prog: s.sum / N, done: done / N, miss: s.miss });
    S.fx(dt);
    S.render();
    const sc = clamp01((s.sum / N) * 1.08);
    report(sc);
    if (done >= N) {
      s.over = true;
      finish(sc);
    }
    tick();
  }, g.ready);
  const tap = () => {
    const s = st.current;
    if (s.over) return;
    const b = beats.current.filter((x) => x.q < 0).sort((a, c) => Math.abs(a.t - s.t) - Math.abs(c.t - s.t))[0];
    const d = b ? Math.abs(b.t - s.t) : 9;
    if (d > 0.3) return void ((s.combo = 0), (s.last = '헛박자'));
    b.q = d < 0.11 ? 1 : d < 0.2 ? 0.7 : 0.35;
    s.sum += b.q;
    s.combo++;
    s.pulse = 0;
    s.last = b.q >= 1 ? '딱!' : b.q >= 0.7 ? '좋아요' : '조금 어긋남';
  };
  const s = st.current;
  return (
    <>
      <Hud items={[['박자', `${beats.current.filter((b) => b.q >= 0).length}/${N}`], ['이어 맞힘', s.combo], ['방금', s.last || '-']]} />
      <Box3D r={g.ref} ready={g.ready} fail={g.fail} onPointerDown={tap}>
        <p className="mg-tip">{skin.tip}</p>
      </Box3D>
    </>
  );
}

/* 체력 · 수영 도하 */
const H_SWIM = {
  cam: [0, 7, 11], look: [0, 0, 1], sky: 0x8fb6cc, models: ['tree', 'rock', 'tent'], tip: '초록 구슬이 노란 고리에 들어올 때 톡 · 박자가 맞으면 물살을 이겨요',
  build(k, S) {
    k.floor(S.scene, k.MAT.water, 80, 80);
    k.floor(S.scene, k.MAT.grass, 80, 6, 0.05).position.z = -8;
    scatter(k, S, ['tree', 'rock', 'tent'], 10, (i) => [-9 + i * 2, -8]);
    const me = k.soldier('us');
    me.rotation.x = -Math.PI / 2;
    me.rotation.z = Math.PI;
    S.scene.add(me);
    return { me, z: 3.5 };
  },
  draw({ W, k, S, dt, pulse, prog, t, miss }) {
    const want = lerp(3.5, -5.2, clamp01(prog * 1.1)) + Math.min(2, miss * 0.08);
    W.z += (want - W.z) * Math.min(1, dt * 3);
    W.me.position.set(Math.sin(t * 0.7) * 0.4, 0.12, W.z);
    k.walk(W.me, t, pulse < 0.4);
    if (pulse < 0.05) S.splash(V(k, W.me.position.x, 0.1, W.z + 0.5), 0.6);
  },
};
/* 통솔 · 구호 맞추기 */
const H_CHANT = {
  cam: [0, 6, 11], look: [0, 0.8, 0], models: ['b1g', 'b2w', 'tree'], tip: '초록 구슬이 노란 고리에 들어올 때 톡 · 박자가 맞으면 발이 하나가 돼요',
  build(k, S) {
    k.floor(S.scene, k.MAT.conc, 80, 60);
    scatter(k, S, ['b1g', 'b2w', 'tree'], 7, (i) => [-9 + i * 3, -7], 1.5);
    const men = Array.from({ length: 15 }, (_, i) => {
      const o = k.soldier('us');
      o.rotation.y = Math.PI / 2;
      o.userData.h = [(i % 5) * 1.1 - 2.2, Math.floor(i / 5) * 1.1 - 1.2, Math.random() * 6];
      S.scene.add(o);
      return o;
    });
    return { men, ph: 0 };
  },
  draw({ W, k, t, dt, combo, pulse }) {
    const mess = clamp01(1 - combo / 5);
    if (pulse < dt * 1.5) W.ph += Math.PI;
    W.men.forEach((o) => {
      const [x, z, r] = o.userData.h;
      o.position.set(x + Math.sin(t * 2 + r) * 0.25 * mess, 0, z + Math.cos(t * 1.7 + r) * 0.2 * mess);
      k.walk(o, (W.ph + Math.min(pulse, 0.3) * 10) / 11 + r * mess * 0.3, true);
    });
  },
};
/* 모병 · 입대하는 날 */
const H_ENLIST = {
  cam: [0, 6, 11], look: [0, 0.8, 0], models: ['b2w', 'tree', 'tent'], tip: '초록 구슬이 노란 고리에 들어올 때 톡 · 박자에 맞춰 한 명씩 인사하고 들어가요',
  build(k, S) {
    k.floor(S.scene, k.MAT.conc, 80, 60);
    const gate = k.model('b2w');
    gate.position.set(5.5, 0, -1);
    gate.scale.multiplyScalar(1.8);
    scatter(k, S, ['tree', 'tent'], 8, (i) => [-9 + i * 2, -6.5]);
    const fam = Array.from({ length: 10 }, (_, i) => {
      const o = k.soldier('civ');
      o.position.set(-6 + i * 1.1, 0, 2.2);
      o.rotation.y = Math.PI;
      S.scene.add(o);
      return o;
    });
    const line = Array.from({ length: 8 }, (_, i) => {
      const o = k.soldier('us');
      o.rotation.y = Math.PI / 2;
      S.scene.add(o);
      return o;
    });
    S.scene.add(gate);
    return { fam, line, shift: 0 };
  },
  draw({ W, k, t, dt, pulse, combo }) {
    if (pulse < dt * 1.5) W.shift += 1.2;
    W.line.forEach((o, i) => {
      const x = ((-5 + i * 1.2 + W.shift + (pulse < 0.3 ? -(0.3 - pulse) * 4 : 0)) % 9.6) - 4.6;
      o.position.set(x, 0, 0);
      k.walk(o, t, pulse < 0.3);
    });
    W.fam.forEach((o, i) => (o.position.y = combo > 2 ? Math.abs(Math.sin(t * 6 + i)) * 0.25 : 0));
  },
};

/* 체력 · 사격 뒤 달리기: 달리다 멈춰, 숨(고리)이 가장 작아질 때 */
const T_BIATHLON: TimingSkin = {
  rounds: 5, cam: [0, 2.4, 8], look: [0, 1.4, -6], fov: 42, models: ['tree', 'pine', 'rock'],
  tip: '숨이 가라앉아 노란 고리가 가장 작아질 때 톡', word: ['🎯 명중 · 다시 달려요', '💨 숨이 차서 빗나갔어요'],
  build(k, S) {
    k.floor(S.scene, k.MAT.grass, 80, 80);
    scatter(k, S, ['tree', 'pine', 'rock'], 16, (i) => [(i % 2 ? 1 : -1) * (4 + (i % 4)), -4 - i * 1.4]);
    const tg = new k.THREE.Group();
    tg.add(k.box(0.08, 1.2, 0.08, k.MAT.metal, 0, 0.6, 0));
    [[0.6, 0xffffff], [0.38, 0xd94a3d], [0.16, 0xffffff]].forEach(([r, c], i) => {
      const d = new k.THREE.Mesh(new k.THREE.CircleGeometry(r, 24), new k.THREE.MeshBasicMaterial({ color: c }));
      d.position.set(0, 1.5, 0.01 + i * 0.01);
      tg.add(d);
    });
    tg.position.z = -9;
    const ring = new k.THREE.Mesh(new k.THREE.TorusGeometry(1, 0.04, 6, 32), new k.THREE.MeshBasicMaterial({ color: 0xffd84a }));
    ring.position.set(0, 1.5, -8.9);
    const me = k.soldier('us');
    me.rotation.y = Math.PI;
    me.position.set(1.6, 0, 1.5);
    S.scene.add(tg, ring, me);
    return { ring, me };
  },
  next: (rng, lv) => ({ dur: rng.range(1.5, 2.2) / sp(lv), sweet: 1, win: 0.16, wave: true, data: { ph: rng.range(0, 6) } }),
  draw(c) {
    const { W, k, S } = c;
    const pp = c.phase === 'run' ? c.p : c.tp;
    W.ring.scale.setScalar(1.7 - 1.45 * pp);
    W.ring.position.x = Math.sin(c.t * 5 + c.r.data.ph) * (1 - pp) * 0.5;
    W.ring.visible = c.phase === 'run';
    k.walk(W.me, c.t, c.phase !== 'run');
    W.me.position.x = c.phase === 'run' ? 1.6 : 1.6 + Math.sin(c.wt * 5) * 0.3;
    if (c.phase !== 'run' && c.wt - c.dt <= 0) S.tracer(V(k, 1.6, 1, 1.5), V(k, c.phase === 'hit' ? 0 : 0.9, 1.5, -9), 0xfff2a8);
  },
};

/* 사격 · 사격 대회: AI 선수 셋과 겨룸 */
const rivals = { ai: [0, 0, 0], me: 0 };
const T_MATCH: TimingSkin = {
  rounds: 8, cam: [0, 2.2, 8], look: [0, 1.5, -6], fov: 42, models: ['tree', 'pine', 'b1g'],
  tip: '움직이는 조준 고리가 과녁 한가운데 올 때 톡', word: ['🎯 10점!', '💨 빗나감'],
  hud: () => ['AI 선수', rivals.ai.map((x) => x.toFixed(0)).join(' · ')],
  build(k, S) {
    k.floor(S.scene, k.MAT.grass, 80, 80);
    scatter(k, S, ['tree', 'pine', 'b1g'], 12, (i) => [(i % 2 ? 1 : -1) * (5 + (i % 3)), -5 - i * 1.3]);
    [-3, -1, 1, 3].forEach((x, i) => {
      S.scene.add(k.box(0.08, 1.2, 0.08, k.MAT.metal, x, 0.6, -9));
      [[0.6, 0xffffff], [0.38, i === 3 ? 0x3fb8c9 : 0xd94a3d], [0.16, 0xffffff]].forEach(([r, c], j) => {
        const d = new k.THREE.Mesh(new k.THREE.CircleGeometry(r, 24), new k.THREE.MeshBasicMaterial({ color: c }));
        d.position.set(x, 1.5, -8.99 + j * 0.01);
        S.scene.add(d);
      });
      const o = k.soldier(i === 3 ? 'us' : 'civ');
      o.rotation.y = Math.PI;
      o.position.set(x, 0, 0.5);
      S.scene.add(o);
    });
    const ring = new k.THREE.Mesh(new k.THREE.TorusGeometry(0.3, 0.04, 6, 24), new k.THREE.MeshBasicMaterial({ color: 0xffd84a }));
    S.scene.add(ring);
    return { ring };
  },
  next(rng, lv, i) {
    if (i === 0) rivals.ai = [0, 0, 0];
    // AI 는 평균 6~7.5점
    rivals.ai = rivals.ai.map((x, j) => x + Math.round(rng.range(4, 10) * (0.8 + j * 0.08)));
    return { dur: rng.range(1.3, 2) / sp(lv), sweet: 0.5, win: 0.1, data: { dir: rng.chance(0.5) ? 1 : -1, wob: rng.range(0, 6) } };
  },
  draw(c) {
    const { W, k, S, r } = c;
    const pp = c.phase === 'run' ? c.p : c.tp;
    W.ring.position.set(3 + r.data.dir * lerp(-2, 2, pp), 1.5 + Math.sin(pp * 9 + r.data.wob) * 0.25 * Math.abs(pp - 0.5) * 2, -8.9);
    if (c.phase !== 'run' && c.wt - c.dt <= 0) {
      S.tracer(V(k, 3, 1, 3.5), W.ring.position.clone(), 0xfff2a8);
      [-3, -1, 1].forEach((x) => S.tracer(V(k, x, 1, 3.5), V(k, x + (Math.random() - 0.5) * 0.6, 1.5 + (Math.random() - 0.5) * 0.6, -9), 0xffffff));
    }
  },
};

/* ───────── 사격 · 야간 사격: 총구 불빛이 번쩍인 자리를 기억했다가 누름 ───────── */
export function ENightShot({ level, seed, report, finish }: MiniProps) {
  const rng = useRng(seed);
  const ROUNDS = 7;
  const mk = () => ({ x: rng.range(-6, 6), z: rng.range(-7, 3), t: 0, shot: null as null | number[], q: 0 });
  const st = useRef({ i: 0, r: mk(), sum: 0, wait: 0, over: false });
  const tick = useTick();
  const FLASH = 0.45 / Math.sqrt(level), AT = 1;
  const g = use3D({ cam: [0, 12, 10], look: [0, 0, -1.5], sky: 0x05090d }, ['tree', 'rock', 'bush', 'b1g'], (k, S) => {
    k.floor(S.scene, k.M(0x1b241d), 60, 60);
    S.scene.children.forEach((c) => c.isLight && (c.intensity *= 0.35));
    scatter(k, S, ['tree', 'rock', 'bush', 'b1g'], 26, (i) => [-8 + ((i * 37) % 17), -9 + ((i * 23) % 13)], 0.9);
    const flash = new k.THREE.Mesh(new k.THREE.SphereGeometry(0.5, 10, 8), new k.THREE.MeshBasicMaterial({ color: 0xfff2a8 }));
    const foe = k.soldier('foe');
    const mine = ringMesh(k, 0.5, 0x7fd4ff, 0.12);
    const zone = ringMesh(k, 1.6, 0xffd84a, 0.08);
    S.scene.add(flash, foe, mine, zone);
    return { flash, foe, mine, zone };
  });
  useLoop((dt) => {
    const s = st.current, S = g.S.current, k = g.K.current, W = g.W.current, r = s.r;
    if (!S || !k || !W || s.over) return;
    r.t += dt;
    W.flash.visible = !r.shot && r.t > AT && r.t < AT + FLASH;
    W.flash.position.set(r.x, 0.9, r.z);
    W.flash.scale.setScalar(1 + Math.random() * 0.5);
    W.foe.visible = W.zone.visible = !!r.shot;
    W.foe.position.set(r.x, 0, r.z);
    W.zone.position.set(r.x, 0.05, r.z);
    W.mine.visible = !!r.shot;
    if (r.shot) W.mine.position.set(r.shot[0], 0.06, r.shot[1]);
    if (s.wait > 0) {
      s.wait -= dt;
      if (s.wait <= 0) {
        s.i++;
        if (s.i >= ROUNDS) {
          s.over = true;
          return finish(clamp01((s.sum / ROUNDS) * 1.08));
        }
        s.r = mk();
      }
    }
    S.fx(dt);
    S.render();
    report(clamp01((s.sum / ROUNDS) * 1.08));
    tick();
  }, g.ready);
  const down = (e) => {
    const s = st.current, S = g.S.current, k = g.K.current, r = s.r;
    if (!S || r.shot || r.t < AT + FLASH || s.wait > 0) return;
    const p = S.ground(e);
    if (!p) return;
    r.shot = [p.x, p.z];
    const d = Math.hypot(p.x - r.x, p.z - r.z);
    r.q = d < 0.8 ? 1 : d < 1.6 ? 0.7 : d < 2.6 ? 0.35 : 0;
    s.sum += r.q;
    s.wait = 1.4;
    S.tracer(V(k, 0, 1, 9), V(k, p.x, 0.5, p.z), 0xfff2a8);
    if (r.q >= 0.7) S.boom(V(k, r.x, 0.4, r.z), 0.8);
  };
  const s = st.current, r = s.r;
  return (
    <>
      <Hud items={[['발', `${Math.min(ROUNDS, s.i + 1)}/${ROUNDS}`], ['방금', r.shot ? `${Math.round(r.q * 100)}점` : '-']]} />
      <Box3D r={g.ref} ready={g.ready} fail={g.fail} onPointerDown={down}>
        <p className="mg-tip">{r.shot ? (r.q >= 1 ? '🎯 정확해요' : r.q > 0 ? '🙂 근처예요' : '💨 엉뚱한 곳이에요') : r.t < AT ? '어둠 속을 잘 봐요…' : r.t < AT + FLASH ? '⚡ 번쩍!' : '불빛이 번쩍인 자리를 눌러요'}</p>
      </Box3D>
    </>
  );
}

/* ───────── 해킹 · 전력망 지키기: 빨간 침입만 누름. 초록 점검 신호는 미끼 ───────── */
export function EGrid({ level, seed, report, finish }: MiniProps) {
  const rng = useRng(seed);
  const TOTAL = 26, COLS = 4, ROWS = 3;
  const st = useRef({ t: 0, next: 1.2, spawned: 0, real: 0, caught: 0, wrong: 0, lost: 0, cells: Array.from({ length: COLS * ROWS }, () => ({ kind: 0, until: 0 })), over: false });
  const tick = useTick();
  const g = use3D({ cam: [0, 15, 10], look: [0, 0, 0.6], sky: 0x07131c }, ['antenna'], (k, S) => {
    k.floor(S.scene, k.M(0x10202a), 60, 60);
    const nodes = st.current.cells.map((_, i) => {
      const x = (i % COLS) * 3 - 4.5, z = Math.floor(i / COLS) * 3 - 2.6;
      const b = k.box(1.7, 0.8, 1.7, new k.THREE.MeshBasicMaterial({ color: 0x29495a }), x, 0.4, z);
      b.userData.i = i;
      const an = k.model('antenna');
      an.position.set(x, 0.8, z);
      an.scale.multiplyScalar(0.8);
      S.scene.add(b, an);
      return b;
    });
    for (let i = 0; i < COLS * ROWS; i++) {
      const x = (i % COLS) * 3 - 4.5, z = Math.floor(i / COLS) * 3 - 2.6;
      if (i % COLS < COLS - 1) S.scene.add(k.box(1.3, 0.06, 0.06, k.M(0x3fb8c9), x + 1.5, 0.3, z));
      if (i < COLS * (ROWS - 1)) S.scene.add(k.box(0.06, 0.06, 1.3, k.M(0x3fb8c9), x, 0.3, z + 1.5));
    }
    return { nodes };
  });
  useLoop((dt) => {
    const s = st.current, S = g.S.current, k = g.K.current, W = g.W.current;
    if (!S || !k || !W || s.over) return;
    s.t += dt;
    if (s.t > s.next && s.spawned < TOTAL) {
      s.next = s.t + rng.range(0.55, 1.1) / Math.sqrt(level);
      const free = s.cells.map((c, i) => (c.kind ? -1 : i)).filter((i) => i >= 0);
      if (free.length) {
        const i = rng.pick(free), real = rng.chance(0.68);
        s.cells[i] = { kind: real ? 1 : 2, until: s.t + rng.range(1.2, 1.8) / Math.sqrt(level) };
        s.spawned++;
        if (real) s.real++;
      }
    }
    s.cells.forEach((c, i) => {
      if (c.kind && s.t > c.until) {
        if (c.kind === 1) {
          s.lost++;
          S.smoke(V(k, W.nodes[i].position.x, 1, W.nodes[i].position.z), 0.6, true);
        }
        c.kind = 0;
      }
      W.nodes[i].material.color.setHex(c.kind === 1 ? 0xff3b30 : c.kind === 2 ? 0x34c759 : 0x29495a);
      W.nodes[i].scale.y = c.kind ? 1 + Math.sin(s.t * 18) * 0.08 : 1;
    });
    S.fx(dt);
    S.render();
    const sc = clamp01((s.caught / Math.max(1, s.real + (TOTAL - s.spawned) * 0.68)) - s.wrong * 0.06);
    report(sc);
    if (s.spawned >= TOTAL && s.cells.every((c) => !c.kind)) {
      s.over = true;
      finish(clamp01(s.caught / Math.max(1, s.real) - s.wrong * 0.06));
    }
    tick();
  }, g.ready);
  const down = (e) => {
    const s = st.current, S = g.S.current, W = g.W.current;
    if (!S || s.over) return;
    const o = S.hit(e, W.nodes);
    if (!o) return;
    const c = s.cells[o.userData.i];
    if (c.kind === 1) s.caught++;
    else s.wrong++;
    c.kind = 0;
  };
  const s = st.current;
  return (
    <>
      <Hud items={[['막음', s.caught], ['뚫림', s.lost], ['잘못 누름', s.wrong]]} />
      <Box3D r={g.ref} ready={g.ready} fail={g.fail} onPointerDown={down}>
        <p className="mg-tip">🔴 빨간 침입만 눌러 막아요 · 🟢 초록은 점검 신호(미끼)예요</p>
      </Box3D>
    </>
  );
}

const rhythm = (skin) => (p: MiniProps) => <RhythmGame {...p} skin={skin} />;
export const ESwim = rhythm(H_SWIM);
export const EChant = rhythm(H_CHANT);
export const EEnlist = rhythm(H_ENLIST);
export const EBiathlon = (p: MiniProps) => <TimingGame {...p} skin={T_BIATHLON} />;
export const EMatch = (p: MiniProps) => <TimingGame {...p} skin={T_MATCH} />;
