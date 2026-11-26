// @ts-nocheck
// 3D 미니게임 8개(11-26 안 4): 2D 미니게임 규칙은 그대로, 화면만 3D 전투 모형으로.
// three.js·모형은 이 게임을 열 때만 받음(kit3d를 늦게 불러옴).
import { useEffect, useRef, useState } from 'react';
import { Hud, clamp01, useLoop, useRng, type MiniProps } from './kit';

type K3 = typeof import('../../../battle3d/mini3d/kit3d');

/** 3D 무대: 모형을 받고 장면을 만든 뒤 build로 게임 세계를 꾸밈 */
function use3D<W>(opt: { cam: [number, number, number]; look: [number, number, number]; fov?: number; sky?: number }, models: string[], build: (k: K3, S: ReturnType<K3['makeScene']>) => W) {
  const ref = useRef<HTMLDivElement>(null);
  const S = useRef<ReturnType<K3['makeScene']> | null>(null);
  const W = useRef<W | null>(null);
  const K = useRef<K3 | null>(null);
  const [ready, setReady] = useState(false);
  const [fail, setFail] = useState(false);
  useEffect(() => {
    let gone = false;
    import('../../../battle3d/mini3d/kit3d')
      .then(async (k) => {
        await k.loadModels(models);
        if (gone || !ref.current) return;
        K.current = k;
        S.current = k.makeScene(ref.current, opt);
        W.current = build(k, S.current);
        setReady(true);
      })
      .catch(() => setFail(true));
    return () => {
      gone = true;
      S.current?.dispose();
      S.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return { ref, S, W, K, ready, fail };
}

function Box3D(props: { r: React.RefObject<HTMLDivElement>; ready: boolean; fail: boolean; ratio?: number; children?: React.ReactNode; onPointerDown?: (e: React.PointerEvent) => void; onPointerMove?: (e: React.PointerEvent) => void; onPointerUp?: (e: React.PointerEvent) => void }) {
  return (
    <div
      ref={props.r}
      className="mg-stage mg-3d"
      style={{ aspectRatio: String(props.ratio ?? 1) }}
      onPointerDown={props.onPointerDown}
      onPointerMove={props.onPointerMove}
      onPointerUp={props.onPointerUp}
      onPointerCancel={props.onPointerUp}
    >
      {!props.ready && <div className="mg-center">{props.fail ? '3D를 열 수 없어요' : '3D 훈련장 준비 중…'}</div>}
      {props.children}
      <p className="mg-credit">모형: Quaternius (CC0) · “Jet”, “Helicopter” by jeremy, Poly Pizza (CC-BY 3.0)</p>
    </div>
  );
}

/* ── 1. 3D 마을 표적(사격) ── 창문·골목에 나온 적만 눌러요. 민간인은 감점 */
export function M3ShootPopup({ level, seed, report, finish }: MiniProps) {
  const rng = useRng(seed);
  const N = 26;
  const spots = [
    [-3.2, 0, -2], [0, 0, -2.4], [3.2, 0, -2], [-1.6, 0, 0.4], [1.6, 0, 0.4], [-3.6, 1.15, -2.6], [3.6, 1.15, -2.6], [0, 1.55, -3.2], [-0.2, 0, 2],
  ];
  const plan = useRef(
    (() => {
      let t = 1;
      return Array.from({ length: N }, () => {
        t += rng.range(0.6, 1.3) / level;
        return { at: t, spot: Math.floor(rng.next() * spots.length), foe: rng.chance(0.72), life: rng.range(1, 1.5) / level, state: '' as '' | 'hit' | 'bad' | 'gone', o: null };
      });
    })(),
  );
  const st = useRef({ t: 0, hit: 0, bad: 0, over: false });
  const [, tick] = useState(0);
  const foes = plan.current.filter((p) => p.foe).length;
  const sc = () => clamp01((st.current.hit - st.current.bad * 2) / foes);
  const g = use3D({ cam: [0, 4.2, 9], look: [0, 0.8, -1] }, ['b2s', 'b3s', 'houseA', 'houseB', 'b4', 'crate', 'barrel', 'tree'], (k, S) => {
    k.floor(S.scene, k.MAT.road, 40, 40);
    const side = k.floor(S.scene, k.MAT.conc, 40, 3, 0.01);
    side.position.z = -4;
    [['b3s', -3.6, -4.2], ['b4', 0, -4.6], ['b2s', 3.6, -4.2], ['houseA', -6.5, -3], ['houseB', 6.5, -3]].forEach(([m, x, z]) => {
      const o = k.model(m);
      o.position.set(x, 0, z);
      o.scale.multiplyScalar(1.6);
      S.scene.add(o);
    });
    [['crate', -1.6, 0.9], ['crate', 1.6, 0.9], ['barrel', -1.2, 1], ['barrel', 2, 0.8], ['crate', -0.2, 2.5]].forEach(([m, x, z]) => {
      const o = k.model(m);
      o.position.set(x, 0, z);
      o.scale.multiplyScalar(2.2);
      S.scene.add(o);
    });
    return { figs: [] as any[] };
  });
  useLoop((dt) => {
    const s = st.current;
    const S = g.S.current, k = g.K.current;
    if (!S || !k || s.over) return;
    s.t += dt;
    for (const p of plan.current) {
      if (!p.o && !p.state && s.t >= p.at) {
        p.o = k.soldier(p.foe ? 'foe' : 'civ');
        const [x, y, z] = spots[p.spot];
        p.o.position.set(x, y - 0.9, z);
        p.o.userData.base = y;
        p.o.userData.plan = p;
        S.scene.add(p.o);
      }
      if (p.o) {
        const up = !p.state && s.t < p.at + p.life;
        const target = up ? p.o.userData.base : p.o.userData.base - 0.9;
        p.o.position.y += (target - p.o.position.y) * Math.min(1, dt * 14);
        if (!up && !p.state) p.state = 'gone';
        if (p.state && s.t > p.at + p.life + 0.5) {
          S.scene.remove(p.o);
          p.o = null;
        }
      }
    }
    S.fx(dt);
    S.render();
    report(sc());
    if (plan.current.every((p) => p.state) && plan.current.every((p) => !p.o)) {
      s.over = true;
      finish(sc());
    }
    tick((x) => (x + 1) % 1000);
  }, g.ready);
  const down = (e) => {
    const S = g.S.current;
    if (!S) return;
    const live = plan.current.filter((p) => p.o && !p.state).map((p) => p.o);
    const o = S.hit(e, live);
    if (!o) return;
    const p = o.userData.plan;
    p.state = p.foe ? 'hit' : 'bad';
    if (p.foe) st.current.hit++;
    else st.current.bad++;
    const pos = o.position.clone();
    pos.y += 0.6;
    S.tracer(new (g.K.current!.THREE.Vector3)(0, 2.5, 8), pos);
    S.smoke(pos, 0.4, false);
  };
  return (
    <>
      <Hud items={[['명중', `${st.current.hit}/${foes}`], ['민간인 오사', st.current.bad]]} />
      <Box3D r={g.ref} ready={g.ready} fail={g.fail} onPointerDown={down}>
        <p className="mg-tip">🪖 붉은 군복만 쏘기 · 🟢 초록 옷은 민간인</p>
      </Box3D>
    </>
  );
}

/* ── 2. 3D 움직이는 표적(사격) ── 탄이 0.4초 뒤에 닿아요. 달리는 적 앞을 눌러요 */
export function M3ShootMoving({ level, seed, report, finish }: MiniProps) {
  const rng = useRng(seed);
  const N = 14;
  const st = useRef({ t: 0, hit: 0, shots: 0, next: 0.8, spawned: 0, over: false, runners: [] as any[], shells: [] as any[] });
  const [, tick] = useState(0);
  const g = use3D({ cam: [0, 5, 10], look: [0, 0, -1] }, ['tree', 'pine', 'rock', 'bush', 'crate'], (k, S) => {
    k.floor(S.scene, k.MAT.grass, 60, 60);
    const lane = k.floor(S.scene, k.MAT.dirt, 30, 6, 0.01);
    lane.position.z = -1;
    for (let i = 0; i < 14; i++) {
      const o = k.model(i % 3 === 0 ? 'pine' : i % 3 === 1 ? 'tree' : 'bush');
      o.position.set(-12 + i * 1.9, 0, -5.5 - (i % 2));
      o.scale.multiplyScalar(1.3);
      S.scene.add(o);
    }
    return {};
  });
  useLoop((dt) => {
    const s = st.current, S = g.S.current, k = g.K.current;
    if (!S || !k || s.over) return;
    s.t += dt;
    if (s.spawned < N && s.t > s.next) {
      s.spawned++;
      s.next = s.t + rng.range(1.2, 2.2) / level;
      const dir = rng.chance(0.5) ? 1 : -1;
      const o = k.soldier('foe');
      const z = rng.range(-2.6, 0.6);
      o.position.set(-dir * 9, 0, z);
      o.rotation.y = (dir * Math.PI) / 2;
      S.scene.add(o);
      s.runners.push({ o, v: dir * rng.range(2.2, 3.6) * level, alive: true });
    }
    for (const r of s.runners) {
      if (!r.alive) continue;
      r.o.position.x += r.v * dt;
      k.walk(r.o, s.t, true);
      if (Math.abs(r.o.position.x) > 10) {
        r.alive = false;
        S.scene.remove(r.o);
      }
    }
    for (const sh of s.shells) {
      if (sh.done || s.t < sh.at) continue;
      sh.done = true;
      S.smoke(sh.p, 0.35, false);
      const r = s.runners.find((q) => q.alive && q.o.position.distanceTo(sh.p) < 0.75);
      if (r) {
        r.alive = false;
        s.hit++;
        r.o.rotation.x = -1.4;
        setTimeout(() => S.scene.remove(r.o), 600);
      }
    }
    S.fx(dt);
    S.render();
    const sc = clamp01(s.hit / N - Math.max(0, s.shots - N * 1.6) * 0.02);
    report(sc);
    if (s.spawned >= N && s.runners.every((r) => !r.alive)) {
      s.over = true;
      finish(sc);
    }
    tick((x) => (x + 1) % 1000);
  }, g.ready);
  const down = (e) => {
    const S = g.S.current;
    if (!S) return;
    const p = S.ground(e);
    if (!p) return;
    p.y = 0.5;
    st.current.shots++;
    st.current.shells.push({ p, at: st.current.t + 0.4 / Math.max(1, level * 0.9) });
    S.tracer(new (g.K.current!.THREE.Vector3)(0, 1.5, 9), p, 0xfff1b0);
  };
  return (
    <>
      <Hud items={[['명중', `${st.current.hit}/${N}`], ['쏜 탄', st.current.shots]]} />
      <Box3D r={g.ref} ready={g.ready} fail={g.fail} onPointerDown={down}>
        <p className="mg-tip">달리는 방향 앞쪽을 미리 눌러요</p>
      </Box3D>
    </>
  );
}

/* ── 3. 3D 대열 끊기(포격) ── 포탄은 2초 뒤 떨어져요. 지나가는 전차 대열 앞 길을 눌러요. 6발 */
export function M3ArtyLead({ level, seed, report, finish }: MiniProps) {
  const rng = useRng(seed);
  const SHOTS = 6;
  const st = useRef({ t: 0, shots: 0, kills: 0, total: 0, over: false, tanks: [] as any[], shells: [] as any[], next: 0.5, endAt: 0 });
  const [, tick] = useState(0);
  const g = use3D({ cam: [0, 13, 9], look: [0, 0, -1], fov: 50 }, ['tank', 'spg', 'tree', 'pine', 'rock', 'houseA'], (k, S) => {
    k.floor(S.scene, k.MAT.grass, 80, 80);
    const road = k.floor(S.scene, k.MAT.road, 60, 1.6, 0.01);
    road.position.z = -1;
    for (let i = 0; i < 18; i++) {
      const o = k.model(i % 2 ? 'pine' : 'tree');
      o.position.set(-16 + i * 2 + rng.range(-0.5, 0.5), 0, i % 2 ? -4 : 2.5 + rng.range(0, 1.5));
      S.scene.add(o);
    }
    const h = k.model('houseA');
    h.position.set(-6, 0, 3.5);
    S.scene.add(h);
    return {};
  });
  useLoop((dt) => {
    const s = st.current, S = g.S.current, k = g.K.current;
    if (!S || !k || s.over) return;
    s.t += dt;
    if (s.t > s.next && s.total < 12) {
      s.next = s.t + rng.range(1.1, 1.9) / level;
      s.total++;
      const o = k.model(rng.chance(0.7) ? 'tank' : 'spg', 'foe');
      o.position.set(-15, 0, -1);
      o.rotation.y = Math.PI / 2;
      o.scale.multiplyScalar(1.3);
      S.scene.add(o);
      s.tanks.push({ o, v: rng.range(1.6, 2.4) * level, alive: true });
    }
    for (const tk of s.tanks) {
      if (!tk.alive) continue;
      tk.o.position.x += tk.v * dt;
      if (Math.random() < dt * 4) S.smoke(tk.o.position.clone().add(new k.THREE.Vector3(-0.6, 0.1, 0)), 0.25, false);
      if (tk.o.position.x > 15) {
        tk.alive = false;
        S.scene.remove(tk.o);
      }
    }
    for (const sh of s.shells) {
      if (sh.done) continue;
      sh.mark.scale.setScalar(1 + Math.sin(s.t * 12) * 0.08);
      if (s.t < sh.at) continue;
      sh.done = true;
      S.scene.remove(sh.mark);
      S.boom(sh.p, 1.3);
      for (const tk of s.tanks) {
        if (tk.alive && tk.o.position.distanceTo(sh.p) < 1.6) {
          tk.alive = false;
          s.kills++;
          tk.o.traverse((m) => m.isMesh && (m.material = k.MAT.black));
          S.smoke(tk.o.position.clone(), 1, true);
        }
      }
    }
    S.fx(dt);
    S.render();
    const sc = clamp01(s.kills / 6);
    report(sc);
    if (s.shots >= SHOTS && s.shells.every((x) => x.done)) {
      if (!s.endAt) s.endAt = s.t + 1;
      if (s.t > s.endAt) {
        s.over = true;
        finish(sc);
      }
    }
    tick((x) => (x + 1) % 1000);
  }, g.ready);
  const down = (e) => {
    const S = g.S.current, k = g.K.current;
    if (!S || !k || st.current.shots >= SHOTS) return;
    const p = S.ground(e);
    if (!p) return;
    st.current.shots++;
    const mark = new k.THREE.Mesh(new k.THREE.RingGeometry(1.2, 1.5, 24), new k.THREE.MeshBasicMaterial({ color: 0xffb020, transparent: true, opacity: 0.8 }));
    mark.rotation.x = -Math.PI / 2;
    mark.position.set(p.x, 0.05, p.z);
    S.scene.add(mark);
    st.current.shells.push({ p, at: st.current.t + 2, mark });
  };
  return (
    <>
      <Hud items={[['격파', st.current.kills], ['남은 포탄', SHOTS - st.current.shots]]} />
      <Box3D r={g.ref} ready={g.ready} fail={g.fail} onPointerDown={down}>
        <p className="mg-tip">포탄은 2초 뒤에 떨어져요 · 대열 앞쪽 길을 눌러요</p>
      </Box3D>
    </>
  );
}

/* ── 4. 3D 어뢰 피하기(해상) ── ◀ ▶으로 배를 옮겨 어뢰를 피해요 */
export function M3SeaTorpedo({ level, seed, report, finish }: MiniProps) {
  const rng = useRng(seed);
  const LANES = [-3, -1.5, 0, 1.5, 3];
  const st = useRef({ t: 0, lane: 2, hp: 3, dodged: 0, total: 0, next: 1, over: false, torps: [] as any[] });
  const [, tick] = useState(0);
  const g = use3D({ cam: [0, 9, 8], look: [0, 0, -1.5], sky: 0x8fb6cc }, ['boat'], (k, S) => {
    k.floor(S.scene, k.MAT.water, 80, 80);
    const me = k.ship('us', 2.2);
    me.position.set(0, 0, 3);
    me.rotation.y = Math.PI;
    S.scene.add(me);
    for (let i = 0; i < 3; i++) {
      const b = k.model('boat');
      b.position.set(-7 + i * 7, 0, -9);
      S.scene.add(b);
    }
    return { me };
  });
  useLoop((dt) => {
    const s = st.current, S = g.S.current, k = g.K.current, W = g.W.current;
    if (!S || !k || !W || s.over) return;
    s.t += dt;
    W.me.position.x += (LANES[s.lane] - W.me.position.x) * Math.min(1, dt * 8);
    W.me.rotation.z = Math.sin(s.t * 1.3) * 0.03;
    if (Math.random() < dt * 6) S.smoke(W.me.position.clone().add(new k.THREE.Vector3(0, 0.1, 1.1)), 0.2, false);
    if (s.t > s.next && s.total < 24) {
      s.next = s.t + rng.range(0.7, 1.3) / level;
      s.total++;
      const lane = Math.floor(rng.next() * LANES.length);
      const o = new k.THREE.Group();
      o.add(k.box(0.12, 0.08, 0.7, k.MAT.metal, 0, 0.04, 0));
      o.position.set(LANES[lane], 0, -12);
      S.scene.add(o);
      s.torps.push({ o, v: rng.range(5, 7) * level, alive: true });
    }
    for (const tp of s.torps) {
      if (!tp.alive) continue;
      tp.o.position.z += tp.v * dt;
      if (Math.random() < dt * 20) S.smoke(tp.o.position.clone().add(new k.THREE.Vector3(0, 0.05, -0.4)), 0.15, false);
      if (Math.abs(tp.o.position.z - 3) < 0.8 && Math.abs(tp.o.position.x - W.me.position.x) < 0.6) {
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
    const sc = clamp01((s.dodged / 24) * (s.hp / 3) * 1.15);
    report(sc);
    if (s.hp <= 0 || (s.total >= 24 && s.torps.every((x) => !x.alive))) {
      s.over = true;
      finish(s.hp <= 0 ? sc * 0.5 : sc);
    }
    tick((x) => (x + 1) % 1000);
  }, g.ready);
  const mv = (d: number) => (st.current.lane = Math.max(0, Math.min(LANES.length - 1, st.current.lane + d)));
  return (
    <>
      <Hud items={[['피함', st.current.dodged], ['선체', '❤️'.repeat(Math.max(0, st.current.hp))]]} />
      <Box3D r={g.ref} ready={g.ready} fail={g.fail}>
        <div className="mg-3d-pad">
          <button onPointerDown={() => mv(-1)}>◀</button>
          <button onPointerDown={() => mv(1)}>▶</button>
        </div>
      </Box3D>
    </>
  );
}

/* ── 5. 3D 소나 사냥(해상) ── 칸을 누르면 잠수함까지 거리. 폭뢰로 바꿔 눌러 3척 */
export function M3SeaSonar({ level, seed, report, finish }: MiniProps) {
  const rng = useRng(seed);
  const C = 7;
  const subs = useRef(
    (() => {
      const out: Array<{ c: number; r: number; dead: boolean }> = [];
      while (out.length < 3) {
        const c = Math.floor(rng.next() * C), r = Math.floor(rng.next() * C);
        if (!out.some((s) => s.c === c && s.r === r)) out.push({ c, r, dead: false });
      }
      return out;
    })(),
  );
  const st = useRef({ mode: 'ping' as 'ping' | 'bomb', pings: 0, bombs: 0, over: false, labels: [] as Array<{ c: number; r: number; d: number }> });
  const [, tick] = useState(0);
  const cell = 1.3;
  const at = (c: number, r: number) => [(c - (C - 1) / 2) * cell, (r - (C - 1) / 2) * cell];
  const g = use3D({ cam: [0, 11, 6.5], look: [0, 0, 0], sky: 0x8fb6cc }, [], (k, S) => {
    k.floor(S.scene, k.MAT.water, 80, 80);
    const grid = new k.THREE.GridHelper(C * cell, C, 0x9ff6ff, 0x9ff6ff);
    grid.material.transparent = true;
    grid.material.opacity = 0.35;
    grid.position.y = 0.03;
    S.scene.add(grid);
    const me = k.ship('us', 2);
    me.position.set(0, 0, (C / 2) * cell + 1.4);
    me.rotation.y = Math.PI;
    S.scene.add(me);
    return {};
  });
  const left = () => subs.current.filter((s) => !s.dead).length;
  const score = () => clamp01((3 - left()) / 3 - Math.max(0, st.current.bombs - 5) * 0.06 - Math.max(0, st.current.pings - 10) * 0.02);
  useLoop((dt) => {
    const S = g.S.current;
    if (!S) return;
    S.fx(dt);
    S.render();
    report(score());
    tick((x) => (x + 1) % 1000);
  }, g.ready);
  const down = (e) => {
    const S = g.S.current, k = g.K.current, s = st.current;
    if (!S || !k || s.over) return;
    const p = S.ground(e);
    if (!p) return;
    const c = Math.round(p.x / cell + (C - 1) / 2), r = Math.round(p.z / cell + (C - 1) / 2);
    if (c < 0 || r < 0 || c >= C || r >= C) return;
    const [x, z] = at(c, r);
    if (s.mode === 'ping') {
      s.pings++;
      const live = subs.current.filter((q) => !q.dead);
      const d = live.length ? Math.min(...live.map((q) => Math.max(Math.abs(q.c - c), Math.abs(q.r - r)))) : 0;
      s.labels = [...s.labels.filter((l) => !(l.c === c && l.r === r)), { c, r, d }];
      const ring = new k.THREE.Mesh(new k.THREE.RingGeometry(0.2, 0.3, 24), new k.THREE.MeshBasicMaterial({ color: 0x6bf2ff, transparent: true }));
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(x, 0.06, z);
      S.scene.add(ring);
      let t = 0;
      const grow = () => {
        t += 0.03;
        ring.scale.setScalar(1 + t * 10);
        ring.material.opacity = 1 - t;
        if (t < 1) requestAnimationFrame(grow);
        else S.scene.remove(ring);
      };
      grow();
    } else {
      s.bombs++;
      const hit = subs.current.find((q) => !q.dead && q.c === c && q.r === r);
      S.splash(new k.THREE.Vector3(x, 0, z), 1.2);
      if (hit) {
        hit.dead = true;
        const sub = new k.THREE.Group();
        sub.add(k.box(0.3, 0.25, 1.2, k.M(0x5f2f28), 0, 0.05, 0), k.box(0.15, 0.25, 0.3, k.M(0x5f2f28), 0, 0.25, 0));
        sub.position.set(x, -0.1, z);
        S.scene.add(sub);
        S.boom(new k.THREE.Vector3(x, 0.1, z), 1);
        s.labels = s.labels.filter((l) => !(l.c === c && l.r === r));
      }
      if (!left()) {
        s.over = true;
        setTimeout(() => finish(score()), 900);
      }
    }
  };
  // 화면 위 거리 숫자(칸 위치 → 화면 퍼센트)
  const toScreen = (c: number, r: number) => {
    const S = g.S.current, k = g.K.current;
    if (!S || !k) return null;
    const [x, z] = at(c, r);
    const v = new k.THREE.Vector3(x, 0.1, z).project(S.camera);
    return { left: `${(v.x * 0.5 + 0.5) * 100}%`, top: `${(-v.y * 0.5 + 0.5) * 100}%` };
  };
  return (
    <>
      <Hud items={[['남은 잠수함', left()], ['소나', st.current.pings], ['폭뢰', st.current.bombs]]} />
      <Box3D r={g.ref} ready={g.ready} fail={g.fail} onPointerDown={down}>
        {g.ready &&
          st.current.labels.map((l) => {
            const pos = toScreen(l.c, l.r);
            return pos ? (
              <span key={`${l.c}-${l.r}`} className="mg-3d-label" style={pos}>
                {l.d}
              </span>
            ) : null;
          })}
        <div className="mg-3d-pad">
          <button className={st.current.mode === 'ping' ? 'on' : ''} onPointerDown={(e) => { e.stopPropagation(); st.current.mode = 'ping'; }}>
            📡 소나
          </button>
          <button className={st.current.mode === 'bomb' ? 'on' : ''} onPointerDown={(e) => { e.stopPropagation(); st.current.mode = 'bomb'; }}>
            💣 폭뢰
          </button>
        </div>
      </Box3D>
    </>
  );
}

/* ── 6. 3D 요격 비행(항공) ── 화면을 끌면 전투기가 따라와요. 사격은 저절로 */
export function M3AirIntercept({ level, seed, report, finish }: MiniProps) {
  const rng = useRng(seed);
  const N = 16;
  const st = useRef({ t: 0, kills: 0, hits: 0, spawned: 0, next: 1, over: false, foes: [] as any[], bullets: [] as any[], fire: 0, tx: 0, tz: 4 });
  const [, tick] = useState(0);
  const g = use3D({ cam: [0, 14, 7], look: [0, 0, -1], sky: 0x9fc3d8 }, ['jet'], (k, S) => {
    const sea = k.floor(S.scene, k.MAT.water, 120, 120, -3);
    sea.userData.scroll = true;
    const isl = [] as any[];
    for (let i = 0; i < 6; i++) {
      const m = k.box(rng.range(2, 4), 0.3, rng.range(2, 4), k.MAT.grass, rng.range(-8, 8), -2.9, -20 + i * 8);
      S.scene.add(m);
      isl.push(m);
    }
    const me = k.model('jet', 'us');
    me.scale.multiplyScalar(1.4);
    me.rotation.y = Math.PI;
    me.position.set(0, 1, 4);
    S.scene.add(me);
    return { me, isl };
  });
  useLoop((dt) => {
    const s = st.current, S = g.S.current, k = g.K.current, W = g.W.current;
    if (!S || !k || !W || s.over) return;
    s.t += dt;
    W.isl.forEach((m) => {
      m.position.z += dt * 6;
      if (m.position.z > 12) m.position.z -= 48;
    });
    const dx = s.tx - W.me.position.x;
    W.me.position.x += dx * Math.min(1, dt * 6);
    W.me.position.z += (s.tz - W.me.position.z) * Math.min(1, dt * 6);
    W.me.rotation.z = Math.max(-0.7, Math.min(0.7, -dx * 0.4));
    s.fire -= dt;
    if (s.fire <= 0) {
      s.fire = 0.22;
      const a = W.me.position.clone();
      const b = a.clone().add(new k.THREE.Vector3(0, 0, -8));
      S.tracer(a, b, 0xffe9a0);
      for (const f of s.foes) if (f.alive && Math.abs(f.o.position.x - a.x) < 0.8 && f.o.position.z < a.z && f.o.position.z > a.z - 9) {
        f.hp--;
        if (f.hp <= 0) {
          f.alive = false;
          s.kills++;
          S.boom(f.o.position.clone(), 1);
          S.scene.remove(f.o);
        }
        break;
      }
    }
    if (s.spawned < N && s.t > s.next) {
      s.spawned++;
      s.next = s.t + rng.range(1, 1.8) / level;
      const o = k.model('jet', 'foe');
      o.scale.multiplyScalar(1.3);
      o.position.set(rng.range(-5, 5), 1, -14);
      S.scene.add(o);
      s.foes.push({ o, v: rng.range(3, 4.5) * level, alive: true, hp: 2, cd: rng.range(0.5, 1.2), wob: rng.range(0, 6) });
    }
    for (const f of s.foes) {
      if (!f.alive) continue;
      f.o.position.z += f.v * dt;
      f.o.position.x += Math.sin(s.t * 1.3 + f.wob) * dt * 1.6;
      f.cd -= dt;
      if (f.cd <= 0 && f.o.position.z < 2) {
        f.cd = rng.range(0.9, 1.6) / level;
        const b = k.box(0.12, 0.12, 0.35, new k.THREE.MeshBasicMaterial({ color: 0xff6b3a }), f.o.position.x, 1, f.o.position.z + 0.8);
        S.scene.add(b);
        s.bullets.push({ o: b, v: 9, alive: true });
      }
      if (f.o.position.z > 9) {
        f.alive = false;
        S.scene.remove(f.o);
      }
    }
    for (const b of s.bullets) {
      if (!b.alive) continue;
      b.o.position.z += b.v * dt;
      if (b.o.position.distanceTo(W.me.position) < 0.7) {
        b.alive = false;
        s.hits++;
        S.scene.remove(b.o);
        S.boom(W.me.position.clone(), 0.5);
      } else if (b.o.position.z > 10) {
        b.alive = false;
        S.scene.remove(b.o);
      }
    }
    S.fx(dt);
    S.render();
    const sc = clamp01(s.kills / N - s.hits * 0.08);
    report(sc);
    if (s.spawned >= N && s.foes.every((f) => !f.alive)) {
      s.over = true;
      finish(sc);
    }
    tick((x) => (x + 1) % 1000);
  }, g.ready);
  const move = (e) => {
    const S = g.S.current;
    if (!S || (e.buttons === 0 && e.pointerType === 'mouse')) return;
    const p = S.ground(e, 1);
    if (!p) return;
    st.current.tx = Math.max(-6, Math.min(6, p.x));
    st.current.tz = Math.max(-2, Math.min(6, p.z));
  };
  return (
    <>
      <Hud items={[['격추', `${st.current.kills}/${N}`], ['피탄', st.current.hits]]} />
      <Box3D r={g.ref} ready={g.ready} fail={g.fail} onPointerDown={move} onPointerMove={move}>
        <p className="mg-tip">손가락으로 끌어 전투기를 옮겨요</p>
      </Box3D>
    </>
  );
}

/* ── 7. 3D 미사일 따돌리기(항공) ── 미사일이 노란 고리에 들어오면 플레어! 10발 */
export function M3AirFlare({ level, seed, report, finish }: MiniProps) {
  const rng = useRng(seed);
  const N = 10;
  const st = useRef({ t: 0, ok: 0, hit: 0, n: 0, next: 1.2, over: false, ms: null as any, flareCd: 0, msg: '' });
  const [, tick] = useState(0);
  const g = use3D({ cam: [0, 9, 9], look: [0, 1, 0], sky: 0x9fc3d8 }, ['jet'], (k, S) => {
    k.floor(S.scene, k.MAT.grass, 120, 120, -4);
    const me = k.model('jet', 'us');
    me.scale.multiplyScalar(1.6);
    me.position.set(0, 1, 0);
    me.rotation.y = Math.PI;
    S.scene.add(me);
    const ring = new k.THREE.Mesh(new k.THREE.RingGeometry(2.6, 3.6, 48), new k.THREE.MeshBasicMaterial({ color: 0xffd23a, transparent: true, opacity: 0.25, side: k.THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 1;
    S.scene.add(ring);
    return { me, ring };
  });
  const flare = () => {
    const s = st.current, S = g.S.current, k = g.K.current, W = g.W.current;
    if (!S || !k || !W || s.flareCd > 0 || s.over) return;
    s.flareCd = 0.6;
    for (let i = 0; i < 6; i++) {
      const f = new k.THREE.Mesh(new k.THREE.SphereGeometry(0.08, 6, 4), new k.THREE.MeshBasicMaterial({ color: 0xffe08a }));
      f.position.copy(W.me.position);
      S.scene.add(f);
      const vx = (Math.random() - 0.5) * 3, vz = 1 + Math.random() * 2;
      let t = 0;
      const fly = () => {
        t += 0.016;
        f.position.x += vx * 0.016;
        f.position.z += vz * 0.016;
        f.position.y -= 0.016 * 1.5;
        if (Math.random() < 0.4) S.smoke(f.position.clone(), 0.15, false);
        if (t < 1.2) requestAnimationFrame(fly);
        else S.scene.remove(f);
      };
      fly();
    }
    if (s.ms) {
      const d = s.ms.o.position.distanceTo(W.me.position);
      if (d >= 2.6 && d <= 3.6) {
        s.ok++;
        s.msg = '따돌림!';
        S.boom(s.ms.o.position.clone(), 0.6);
        S.scene.remove(s.ms.o);
        s.ms = null;
      } else if (d > 3.6) {
        s.msg = '너무 빨라요';
        s.ms.v *= 1.15;
      }
    }
  };
  useLoop((dt) => {
    const s = st.current, S = g.S.current, k = g.K.current, W = g.W.current;
    if (!S || !k || !W || s.over) return;
    s.t += dt;
    s.flareCd = Math.max(0, s.flareCd - dt);
    W.me.rotation.z = Math.sin(s.t * 1.4) * 0.25;
    W.me.position.y = 1 + Math.sin(s.t * 2) * 0.08;
    if (!s.ms && s.n < N && s.t > s.next) {
      s.n++;
      const a = rng.range(0, Math.PI * 2);
      const o = new k.THREE.Group();
      o.add(k.box(0.12, 0.12, 0.6, k.MAT.white));
      o.position.set(Math.cos(a) * 13, 1, Math.sin(a) * 13);
      S.scene.add(o);
      s.ms = { o, v: rng.range(4, 6) * level };
    }
    if (s.ms) {
      const m = s.ms;
      const dir = W.me.position.clone().sub(m.o.position);
      const d = dir.length();
      m.o.lookAt(W.me.position);
      m.o.position.addScaledVector(dir.normalize(), m.v * dt);
      if (Math.random() < dt * 30) S.smoke(m.o.position.clone(), 0.2, false);
      if (d < 0.7) {
        s.hit++;
        s.msg = '맞았어요';
        S.boom(W.me.position.clone(), 0.9);
        S.scene.remove(m.o);
        s.ms = null;
      }
      if (!s.ms) s.next = s.t + rng.range(0.8, 1.5) / level;
      const inRing = d >= 2.6 && d <= 3.6;
      W.ring.material.opacity = inRing ? 0.75 : 0.25;
    } else W.ring.material.opacity = 0.25;
    S.fx(dt);
    S.render();
    const sc = clamp01(s.ok / N);
    report(sc);
    if (s.n >= N && !s.ms) {
      s.over = true;
      finish(sc);
    }
    tick((x) => (x + 1) % 1000);
  }, g.ready);
  return (
    <>
      <Hud items={[['따돌림', `${st.current.ok}/${N}`], ['피격', st.current.hit], ['', st.current.msg]]} />
      <Box3D r={g.ref} ready={g.ready} fail={g.fail} onPointerDown={flare}>
        <p className="mg-tip">미사일이 노란 고리 안에 오면 화면을 눌러 플레어</p>
      </Box3D>
    </>
  );
}

/* ── 8. 3D 탐조등 박자(잠입) ── 누르고 있으면 멈추고, 떼면 달려요. 빛 속에서 움직이면 들켜요 */
export function M3SneakLight({ level, seed, report, finish }: MiniProps) {
  const rng = useRng(seed);
  const LEN = 16;
  const st = useRef({ t: 0, x: -8, hold: false, caught: 0, over: false, flash: 0 });
  const [, tick] = useState(0);
  const lights = useRef(Array.from({ length: 3 }, (_, i) => ({ x0: -4 + i * 4, amp: rng.range(1.8, 3), sp: rng.range(0.8, 1.4) * level, ph: rng.range(0, 6) })));
  const g = use3D({ cam: [0, 7, 9], look: [0, 0, 0], sky: 0x1b2433 }, ['container', 'crate', 'barrel', 'tent', 'antenna', 'b2w'], (k, S) => {
    k.floor(S.scene, k.MAT.dirt, 60, 60);
    const yard = k.floor(S.scene, k.MAT.conc, 20, 3, 0.01);
    yard.position.z = 0;
    S.scene.children.forEach((c) => {
      if (c.isHemisphereLight) c.intensity = 0.35;
      if (c.isDirectionalLight) c.intensity = 0.25;
    });
    [['container', -6, -2.5], ['b2w', 0, -4], ['container', 5, -2.5], ['tent', -3, 2.8], ['crate', 3, 2.2], ['barrel', 6, 2.4], ['antenna', 9, -1]].forEach(([m, x, z]) => {
      const o = k.model(m);
      o.position.set(x, 0, z);
      o.scale.multiplyScalar(1.5);
      S.scene.add(o);
    });
    const me = k.soldier('us');
    me.position.set(-8, 0, 0.3);
    me.rotation.y = Math.PI / 2;
    S.scene.add(me);
    const cones = lights.current.map(() => {
      const c = new k.THREE.Mesh(new k.THREE.CircleGeometry(1.3, 24), new k.THREE.MeshBasicMaterial({ color: 0xfff2a8, transparent: true, opacity: 0.45, depthWrite: false }));
      c.rotation.x = -Math.PI / 2;
      c.position.y = 0.03;
      S.scene.add(c);
      const beam = new k.THREE.Mesh(new k.THREE.CylinderGeometry(0.05, 1.3, 5, 16, 1, true), new k.THREE.MeshBasicMaterial({ color: 0xfff2a8, transparent: true, opacity: 0.12, depthWrite: false }));
      S.scene.add(beam);
      return { c, beam };
    });
    return { me, cones };
  });
  useLoop((dt) => {
    const s = st.current, S = g.S.current, k = g.K.current, W = g.W.current;
    if (!S || !k || !W || s.over) return;
    s.t += dt;
    s.flash = Math.max(0, s.flash - dt);
    const moving = !s.hold && s.flash <= 0;
    if (moving) s.x += dt * 2.2;
    W.me.position.x = s.x;
    k.walk(W.me, s.t, moving);
    lights.current.forEach((L, i) => {
      const z = Math.sin(s.t * L.sp + L.ph) * L.amp;
      const { c, beam } = W.cones[i];
      c.position.set(L.x0, 0.03, z);
      beam.position.set(L.x0, 2.5, z * 0.5);
      beam.rotation.x = Math.atan2(z * 0.5, 5) * -1;
      const inLight = Math.hypot(s.x - L.x0, 0.3 - z) < 1.3;
      c.material.color.set(inLight ? 0xff6b5a : 0xfff2a8);
      if (inLight && moving) {
        s.caught++;
        s.flash = 1;
        s.x = Math.max(-8, s.x - 2.5);
      }
    });
    S.fx(dt);
    S.render();
    const prog = clamp01((s.x + 8) / LEN);
    const sc = clamp01(prog - s.caught * 0.15);
    report(sc);
    if (s.x >= 8) {
      s.over = true;
      finish(sc);
    }
    tick((x) => (x + 1) % 1000);
  }, g.ready);
  return (
    <>
      <Hud items={[['진행', `${Math.round(clamp01((st.current.x + 8) / LEN) * 100)}%`], ['들킴', st.current.caught]]} />
      <Box3D
        r={g.ref}
        ready={g.ready}
        fail={g.fail}
        onPointerDown={() => (st.current.hold = true)}
        onPointerUp={() => (st.current.hold = false)}
      >
        <p className="mg-tip">누르고 있으면 멈춤 · 떼면 달림 · 빛 속에서 움직이면 들켜요</p>
      </Box3D>
    </>
  );
}
