// @ts-nocheck
// 11-27 한 손가락 미니 훈련(2차 ⑤) — "끌기" 10개.
//  FollowGame 손가락을 따라오는 내 부대를 움직이는 칸 안에 두기
//  PathGame   길을 한 번에 그리기
//  그 밖: 들것 옮기기 · 바람 읽는 저격 · 함포 사격 · 신병 나누기
import { useRef, useState } from 'react';
import { Hud, clamp01, pctOf, useLoop, useRng, type MiniProps } from './kit';
import { Box3D, use3D } from './three';
import { V, lerp, ringMesh, scatter } from './easyC';
import { SORT_BINS, mineField, sortRecruits, strokeHits, strokeLen, tourLen } from '../../../battle/easyLogic';

const useTick = () => {
  const [, t] = useState(0);
  return () => t((x) => (x + 1) % 1000);
};
const clampN = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/* ───────── 따라가기 틀 ───────── */
function FollowGame({ level, seed, report, finish, skin }: MiniProps & { skin }) {
  const rng = useRng(seed);
  const ph = useRef(rng.range(0, 6));
  const st = useRef({ me: skin.start ?? 0, want: skin.start ?? 0, t: 0, good: 0, tgt: 0, in: false, over: false });
  const half = skin.half / Math.pow(level, 0.3);
  const tick = useTick();
  const g = use3D({ cam: skin.cam, look: skin.look, sky: skin.sky }, skin.models, (k, S) => skin.build(k, S, rng));
  useLoop((dt) => {
    const s = st.current, S = g.S.current, k = g.K.current, W = g.W.current;
    if (!S || !k || !W || s.over) return;
    s.t += dt;
    s.tgt = skin.target(s.t, level, ph.current);
    const d = s.want - s.me;
    s.me += Math.sign(d) * Math.min(Math.abs(d), dt * skin.speed);
    s.in = Math.abs(s.me - s.tgt) <= half;
    if (s.in) s.good += dt;
    skin.draw({ W, k, S, me: s.me, tgt: s.tgt, half, inZone: s.in, t: s.t, dt, level });
    S.fx(dt);
    S.render();
    const sc = clamp01((s.good / Math.max(1.5, s.t)) * 1.12);
    report(sc);
    if (skin.endAt && s.t >= skin.endAt) {
      s.over = true;
      finish(sc);
    }
    tick();
  }, g.ready);
  const aim = (e) => {
    const p = g.S.current?.ground(e);
    if (p) st.current.want = clampN(skin.axis === 'z' ? p.z : p.x, skin.range[0], skin.range[1]);
  };
  const s = st.current;
  return (
    <>
      <Hud items={[[skin.hudName, `${Math.round((s.good / Math.max(1, s.t)) * 100)}%`]]} />
      <Box3D r={g.ref} ready={g.ready} fail={g.fail} onPointerDown={aim} onPointerMove={(e) => e.buttons && aim(e)}>
        <p className="mg-tip">{s.in ? skin.tips[1] : skin.tips[0]}</p>
      </Box3D>
    </>
  );
}

/* 잠입 · 그림자 따라가기 */
const F_SHADOW = {
  axis: 'x', range: [-7, 7], speed: 5, half: 1, hudName: '그림자 안', cam: [0, 8, 9], look: [0, 0, -0.5], sky: 0x1b2433,
  models: ['container', 'antenna', 'b2w', 'barrel'], tips: ['🔦 그림자 밖이에요! 화면을 끌어 트럭 그림자로', '🫥 그림자 속'],
  target: (t, lv, ph) => 3.4 * Math.sin(t * 0.45 * lv + ph) + 1.1 * Math.sin(t * 1.3 + ph * 2),
  build(k, S) {
    k.floor(S.scene, k.M(0x4d5049), 60, 60);
    scatter(k, S, ['b2w', 'antenna', 'container', 'barrel'], 8, (i) => [-9 + i * 2.6, -5.5], 1.3);
    const truck = k.model('container', 'foe');
    truck.rotation.y = Math.PI / 2;
    truck.scale.multiplyScalar(1.6);
    const shade = new k.THREE.Mesh(new k.THREE.PlaneGeometry(2.4, 2.2), new k.THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.55 }));
    shade.rotation.x = -Math.PI / 2;
    const me = k.soldier('us');
    S.scene.add(truck, shade, me);
    return { truck, shade, me, px: 0 };
  },
  draw({ W, k, me, tgt, half, inZone, t }) {
    W.truck.position.set(tgt, 0, -1.2);
    W.shade.position.set(tgt, 0.03, 0.9);
    W.shade.scale.x = half / 1.1;
    W.me.position.set(me, 0, 0.9);
    W.me.rotation.y = me > W.px ? Math.PI / 2 : -Math.PI / 2;
    k.walk(W.me, t, Math.abs(me - W.px) > 0.002);
    W.px = me;
    W.me.scale.y = inZone ? 1.8 : 2.4;
  },
};

/* 항공 · 편대 지키기 */
const F_WING = {
  axis: 'x', range: [-6, 6], speed: 6, half: 0.85, hudName: '자리 지킨 시간', cam: [0, 7, 9], look: [0, 2.5, -3], sky: 0x86b3d1,
  models: ['jet'], tips: ['대장기 오른쪽 뒤(초록 자리)로 끌어요', '👍 편대 유지'],
  target: (t, lv, ph) => 3 * Math.sin(t * 0.6 * lv + ph) + 1.2 * Math.sin(t * 1.7 + ph) + 1.8,
  build(k, S) {
    k.floor(S.scene, k.MAT.water, 300, 300);
    const lead = k.model('jet', 'us'), me = k.model('jet', 'us');
    lead.rotation.y = me.rotation.y = Math.PI;
    lead.scale.multiplyScalar(1.2);
    const slot = ringMesh(k, 0.85, 0x5dff8a, 0.08);
    const cloud = new k.THREE.Mesh(new k.THREE.SphereGeometry(1.5, 8, 6), new k.THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.93 }));
    cloud.scale.set(2.2, 0.7, 1.2);
    S.scene.add(lead, me, slot, cloud);
    return { lead, me, slot, cloud, px: 0 };
  },
  draw({ W, me, tgt, t, half }) {
    const lx = tgt - 1.8;
    W.lead.position.set(lx, 3, -4);
    W.lead.rotation.z = Math.cos(t * 0.6) * 0.25;
    W.slot.position.set(tgt, 3, -2);
    W.slot.rotation.x = -Math.PI / 2;
    W.slot.scale.setScalar(half / 0.85);
    W.me.position.set(me, 3, -2);
    W.me.rotation.z = clampN((me - W.px) * -4, -0.5, 0.5);
    W.px = me;
    // 구름: 8초마다 3초 동안 대장기와 자리를 가림
    const c = (t % 8) / 8;
    W.cloud.visible = c > 0.55;
    W.slot.visible = c <= 0.55;
    W.cloud.position.set(lx + 1, 3.6, -3.4);
  },
};

/* 전술 · 물러나며 싸우기 */
const F_DELAY = {
  axis: 'z', range: [-5, 8], speed: 4, half: 0.9, start: -2, hudName: '알맞은 거리', endAt: 42, cam: [0, 13, 9], look: [0, 0, 1],
  models: ['tank', 'tree', 'rock', 'bush'], tips: ['초록 띠(알맞은 거리)로 방어선을 끌어요 · 가까우면 피해, 멀면 헛일', '🛡️ 싸우며 물러나는 중'],
  target: (t, lv, ph) => -5 + t * 0.26 + 1.1 * Math.sin(t * 0.8 * lv + ph) + 3.2,
  build(k, S) {
    k.floor(S.scene, k.MAT.grass, 60, 60);
    scatter(k, S, ['tree', 'rock', 'bush'], 16, (i) => [(i % 2 ? 1 : -1) * (7.5 + (i % 2)), -8 + i]);
    const foe = new k.THREE.Group(), us = new k.THREE.Group();
    for (let i = 0; i < 7; i++) {
      const a = i % 2 ? k.model('tank', 'foe') : k.soldier('foe');
      a.position.x = -6 + i * 2;
      foe.add(a);
      const b = k.soldier('us');
      b.rotation.y = Math.PI;
      b.position.x = -6 + i * 2;
      us.add(b, k.box(1.2, 0.35, 0.3, k.MAT.sand, -6 + i * 2, 0.18, -0.5));
    }
    const band = k.box(15, 0.04, 1.8, new k.THREE.MeshBasicMaterial({ color: 0x5dff8a, transparent: true, opacity: 0.3 }));
    S.scene.add(foe, us, band);
    return { foe, us, band };
  },
  draw({ W, k, S, me, tgt, half, inZone, dt }) {
    W.foe.position.z = tgt - 3.2;
    W.band.position.set(0, 0.1, tgt);
    W.band.scale.z = half / 0.9;
    W.us.position.z = me;
    if (inZone && Math.random() < dt * 8) S.tracer(V(k, (Math.random() - 0.5) * 12, 0.7, me), V(k, (Math.random() - 0.5) * 12, 0.7, tgt - 3.2), 0xfff2a8);
    if (me < tgt - half && Math.random() < dt * 5) S.boom(V(k, (Math.random() - 0.5) * 12, 0.2, me), 0.8);
  },
};

/* ───────── 체력 · 부상병 옮기기: 들것을 끌어 포탄 자국을 피함 ───────── */
export function EStretcher({ level, seed, report, finish }: MiniProps) {
  const rng = useRng(seed);
  const LEN = 70;
  const holes = useRef(Array.from({ length: 22 + Math.round(level * 6) }, (_, i) => ({ x: rng.range(-3.6, 3.6), z: -6 - i * (LEN / 28) - rng.range(0, 1.5), r: rng.range(0.6, 1), hit: false })));
  const st = useRef({ x: 0, want: 0, z: 0, hits: 0, slow: 0, t: 0, over: false });
  const tick = useTick();
  const g = use3D({ cam: [0, 8, 8], look: [0, 0, -2] }, ['tent', 'tree', 'rock'], (k, S) => {
    k.floor(S.scene, k.MAT.dirt, 60, 300);
    holes.current.forEach((h) => {
      const c = new k.THREE.Mesh(new k.THREE.CircleGeometry(h.r, 16), new k.THREE.MeshBasicMaterial({ color: 0x241c14 }));
      c.rotation.x = -Math.PI / 2;
      c.position.set(h.x, 0.03, h.z);
      S.scene.add(c);
    });
    for (let i = 0; i < 40; i++) {
      const o = k.model(i % 2 ? 'tree' : 'rock');
      o.position.set((i % 2 ? 1 : -1) * (5.5 + (i % 3)), 0, 4 - i * 2.2);
      S.scene.add(o);
    }
    const tent = k.model('tent');
    tent.scale.multiplyScalar(2.4);
    tent.position.set(0, 0, -LEN - 6);
    const team = new k.THREE.Group();
    const a = k.soldier('us'), b = k.soldier('us');
    a.rotation.y = b.rotation.y = Math.PI;
    a.position.z = -0.7;
    b.position.z = 0.7;
    team.add(a, b, k.box(0.5, 0.08, 1.3, k.MAT.white, 0, 0.55, 0), k.box(0.3, 0.16, 0.9, k.M(0x8a4a3a), 0, 0.66, 0));
    S.scene.add(tent, team);
    return { team, a, b };
  });
  useLoop((dt) => {
    const s = st.current, S = g.S.current, k = g.K.current, W = g.W.current;
    if (!S || !k || !W || s.over) return;
    s.t += dt;
    s.slow = Math.max(0, s.slow - dt);
    const d = s.want - s.x;
    s.x += Math.sign(d) * Math.min(Math.abs(d), dt * 4.5);
    s.z -= dt * 3.4 * Math.sqrt(level) * (s.slow > 0 ? 0.35 : 1);
    for (const h of holes.current)
      if (!h.hit && Math.hypot(h.x - s.x, h.z - s.z) < h.r + 0.25) {
        h.hit = true;
        s.hits++;
        s.slow = 1;
        S.smoke(V(k, s.x, 0.5, s.z), 0.5, true);
      }
    W.team.position.set(s.x, s.slow > 0 ? -0.12 : 0, s.z);
    k.walk(W.a, s.t, true);
    k.walk(W.b, s.t, true);
    S.camera.position.z = s.z + 8;
    S.camera.lookAt(0, 0, s.z - 2);
    S.fx(dt);
    S.render();
    const sc = clamp01((-s.z / LEN) * (1 - s.hits * 0.09));
    report(sc);
    if (-s.z >= LEN) {
      s.over = true;
      finish(clamp01(1 - s.hits * 0.1));
    }
    tick();
  }, g.ready);
  const aim = (e) => {
    const p = g.S.current?.ground(e);
    if (p) st.current.want = clampN(p.x, -4, 4);
  };
  const s = st.current;
  return (
    <>
      <Hud items={[['구호소까지', `${Math.max(0, Math.round(LEN + s.z))}m`], ['빠짐', s.hits]]} />
      <Box3D r={g.ref} ready={g.ready} fail={g.fail} onPointerDown={aim} onPointerMove={(e) => e.buttons && aim(e)}>
        <p className="mg-tip">{s.slow > 0 ? '😣 구덩이에 빠졌어요' : '화면을 끌어 검은 구덩이를 피해요'}</p>
      </Box3D>
    </>
  );
}

/* ───────── 길 그리기 틀 ───────── */
function PathGame({ level, seed, report, finish, skin }: MiniProps & { skin }) {
  const rng = useRng(seed);
  const st = useRef({ i: 0, map: skin.gen(rng, level), strokes: [] as number[][][], cur: null as number[][] | null, phase: 'draw', t: 0, res: null as any, sum: 0, msg: '', built: -1, over: false });
  const tick = useTick();
  const g = use3D({ cam: skin.cam ?? [0, 18, 7], look: [0, 0, 0.3], sky: skin.sky }, skin.models, (k, S) => ({ ...skin.build(k, S, rng), tmp: [], lines: [] }));
  const clear = (list) => {
    list.forEach((o) => g.S.current.scene.remove(o));
    list.length = 0;
  };
  const drawLines = () => {
    const S = g.S.current, k = g.K.current, W = g.W.current, s = st.current;
    clear(W.lines);
    [...s.strokes, ...(s.cur ? [s.cur] : [])].forEach((pts) => {
      const l = new k.THREE.Line(new k.THREE.BufferGeometry().setFromPoints(pts.map(([x, z]) => V(k, x, 0.15, z))), new k.THREE.LineBasicMaterial({ color: 0xffe07a }));
      S.scene.add(l);
      W.lines.push(l);
    });
  };
  useLoop((dt) => {
    const s = st.current, S = g.S.current, k = g.K.current, W = g.W.current;
    if (!S || !k || !W || s.over) return;
    if (s.built !== s.i) {
      s.built = s.i;
      clear(W.tmp);
      clear(W.lines);
      skin.spawn({ k, S, W, map: s.map, add: (o) => (S.scene.add(o), W.tmp.push(o), o) });
    }
    if (s.phase === 'run') {
      s.t += dt;
      skin.run?.({ k, S, W, s, dt, map: s.map });
      if (s.t > 2.4) {
        s.sum += s.res.score;
        s.i++;
        if (s.i >= skin.rounds) {
          s.over = true;
          return finish(clamp01(s.sum / skin.rounds));
        }
        Object.assign(s, { map: skin.gen(rng, level), strokes: [], cur: null, phase: 'draw', res: null, msg: '' });
      }
    }
    S.fx(dt);
    S.render();
    report(clamp01(s.sum / skin.rounds));
    tick();
  }, g.ready);
  const near = (p, q, r) => Math.hypot(p[0] - q[0], p[1] - q[1]) < r;
  const down = (e) => {
    const s = st.current, p = g.S.current?.ground(e);
    if (!p || s.phase !== 'draw') return;
    const from = s.map.strokes[s.strokes.length];
    if (!near([p.x, p.z], from.start, 2)) return void (s.msg = skin.startMsg);
    s.cur = [[...from.start]];
    s.msg = '';
  };
  const move = (e) => {
    const s = st.current, p = g.S.current?.ground(e);
    if (!p || !s.cur) return;
    const last = s.cur[s.cur.length - 1];
    if (Math.hypot(p.x - last[0], p.z - last[1]) > 0.3) {
      s.cur.push([clampN(p.x, -8, 8), clampN(p.z, -8.5, 8.5)]);
      drawLines();
    }
  };
  const up = () => {
    const s = st.current;
    if (!s.cur) return;
    const def = s.map.strokes[s.strokes.length], pts = s.cur;
    s.cur = null;
    if (def.goal && !near(pts[pts.length - 1], def.goal, 2)) {
      s.msg = skin.goalMsg;
      return drawLines();
    }
    if (pts.length < 3) return drawLines();
    if (def.goal) pts.push([...def.goal]);
    s.strokes.push(pts);
    drawLines();
    if (s.strokes.length >= s.map.strokes.length) {
      s.res = skin.evalu(s.map, s.strokes);
      s.phase = 'run';
      s.t = 0;
    }
  };
  const s = st.current;
  return (
    <>
      <Hud items={[['판', `${Math.min(skin.rounds, s.i + 1)}/${skin.rounds}`], ['방금', s.res ? `${Math.round(s.res.score * 100)}점` : '-']]} />
      <Box3D r={g.ref} ready={g.ready} fail={g.fail} onPointerDown={down} onPointerMove={move} onPointerUp={up}>
        <p className="mg-tip">{s.msg || (s.phase === 'draw' ? skin.tip : s.res.msg)}</p>
      </Box3D>
    </>
  );
}
const disc = (k, r, col, op = 0.45) => {
  const d = new k.THREE.Mesh(new k.THREE.CircleGeometry(r, 24), new k.THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: op }));
  d.rotation.x = -Math.PI / 2;
  return d;
};
/** 길 위에서 거리 d 만큼 간 자리 */
const along = (pts, d) => {
  for (let i = 1; i < pts.length; i++) {
    const L = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    if (d <= L) return [pts[i - 1][0] + ((pts[i][0] - pts[i - 1][0]) * d) / (L || 1), pts[i - 1][1] + ((pts[i][1] - pts[i - 1][1]) * d) / (L || 1)];
    d -= L;
  }
  return pts[pts.length - 1];
};

/* 정보 · 정찰 드론 날리기 */
const P_DRONE = {
  rounds: 3, models: ['heli', 'tent', 'tank', 'antenna', 'b1g', 'tree'], startMsg: '기지(천막)에서부터 그려요', goalMsg: '',
  tip: '⛺ 기지에서 길을 한 번에 그어 표적 5개(노란 원)를 지나요 · 빨간 원(대공포)은 피하고, 배터리는 넉넉하지 않아요',
  build(k, S) {
    k.floor(S.scene, k.MAT.grass, 60, 60);
    const drone = k.model('heli', 'us');
    drone.scale.multiplyScalar(0.8);
    drone.visible = false;
    S.scene.add(drone);
    return { drone };
  },
  gen(rng, lv) {
    const start = [rng.range(-6, 6), 7];
    const points = [], haz = [];
    let guard = 0;
    while (points.length < 5 && guard++ < 300) {
      const p = { x: rng.range(-6.5, 6.5), z: rng.range(-7, 4.5), r: 1.1 };
      if (!points.some((q) => Math.hypot(q.x - p.x, q.z - p.z) < 2.6)) points.push(p);
    }
    while (haz.length < 2 + Math.round(lv) && guard++ < 600) {
      const h = { x: rng.range(-6.5, 6.5), z: rng.range(-6.5, 4), r: 1.25 };
      if (!points.some((q) => Math.hypot(q.x - h.x, q.z - h.z) < 2.6) && !haz.some((q) => Math.hypot(q.x - h.x, q.z - h.z) < 2.6)) haz.push(h);
    }
    return { strokes: [{ start }], points, haz, maxLen: tourLen(start, points) * 1.3 + 2 };
  },
  spawn({ k, map, add }) {
    const t = k.model('tent');
    t.position.set(map.strokes[0].start[0], 0, map.strokes[0].start[1]);
    t.scale.multiplyScalar(1.4);
    add(t);
    map.points.forEach((p, i) => {
      const d = disc(k, p.r, 0xffd84a);
      d.position.set(p.x, 0.05, p.z);
      add(d);
      const o = k.model(['tank', 'antenna', 'b1g'][i % 3], 'foe');
      o.position.set(p.x, 0, p.z);
      add(o);
    });
    map.haz.forEach((h) => {
      const d = disc(k, h.r, 0xff5a4a);
      d.position.set(h.x, 0.05, h.z);
      add(d);
      const o = k.soldier('foe');
      o.position.set(h.x, 0, h.z);
      add(o);
    });
  },
  evalu(map, strokes) {
    const pts = strokes[0];
    const seen = strokeHits(pts, map.points, map.maxLen).length, shot = strokeHits(pts, map.haz, map.maxLen).length;
    const over = strokeLen(pts) > map.maxLen;
    return { score: clamp01(seen / 5 - shot * 0.25), msg: `📷 ${seen}/5 찍음${shot ? ` · 대공포에 ${shot}번 걸림` : ''}${over ? ' · 배터리가 떨어졌어요' : ''}` };
  },
  run({ W, s, map }) {
    const [x, z] = along(s.strokes[0], Math.min(map.maxLen, (s.t / 2) * strokeLen(s.strokes[0])));
    W.drone.visible = true;
    W.drone.position.set(x, 1.6, z);
    W.drone.rotation.y += 0.3;
  },
};

/* 해상 · 기뢰밭 지나기 */
const P_MINES = {
  rounds: 3, models: ['boat'], sky: 0x8fb6cc, startMsg: '우리 배(아래)에서부터 그려요', goalMsg: '초록 깃발까지 이어 그려요',
  tip: '🚢 아래 배에서 위 깃발까지 · 부표(흰 점) 길을 따라 기뢰(빨간 원)를 피해 그려요',
  build(k, S) {
    k.floor(S.scene, k.MAT.water, 80, 80);
    const ship = k.ship('us', 1.8);
    ship.rotation.y = Math.PI;
    S.scene.add(ship);
    return { ship };
  },
  gen(rng, lv) {
    const f = mineField(rng, lv);
    return { strokes: [{ start: f.start, goal: f.goal }], haz: f.mines, way: f.way };
  },
  spawn({ k, W, map, add }) {
    const st = map.strokes[0];
    W.ship.position.set(st.start[0], 0, st.start[1]);
    const flag = k.box(0.1, 1.6, 0.1, k.MAT.white, st.goal[0], 0.8, st.goal[1]);
    flag.add(k.box(0.7, 0.45, 0.05, k.M(0x5dff8a), 0.4, 0.5, 0));
    add(flag);
    map.haz.forEach((h) => {
      const d = disc(k, h.r, 0xff5a4a, 0.4);
      d.position.set(h.x, 0.05, h.z);
      add(d);
      const m = new k.THREE.Mesh(new k.THREE.IcosahedronGeometry(0.22, 0), k.MAT.black);
      m.position.set(h.x, 0.12, h.z);
      add(m);
    });
    map.way.slice(1, -1).forEach(([x, z]) => {
      const b = new k.THREE.Mesh(new k.THREE.SphereGeometry(0.16, 8, 6), k.MAT.white);
      b.position.set(x, 0.15, z);
      add(b);
    });
  },
  evalu(map, strokes) {
    const hit = strokeHits(strokes[0], map.haz);
    return { score: clamp01(1 - hit.length * 0.34), msg: hit.length ? `💥 기뢰 ${hit.length}개에 닿았어요` : '✅ 무사히 지나갔어요', hit };
  },
  run({ k, S, W, s, map }) {
    const [x, z] = along(s.strokes[0], (s.t / 2) * strokeLen(s.strokes[0]));
    W.ship.position.set(x, 0, z);
    s.res.hit.forEach((i) => {
      const h = map.haz[i];
      if (!h.done && Math.hypot(h.x - x, h.z - z) < h.r + 0.3) {
        h.done = true;
        S.splash(V(k, h.x, 0.2, h.z), 1.4);
      }
    });
  },
};

/* 전술 · 양쪽에서 조이기 */
const P_PINCER = {
  rounds: 3, models: ['tank', 'tree', 'rock'], startMsg: '우리 부대(파란 전차)에서부터 그려요', goalMsg: '적 옆구리(초록 원)까지 이어 그려요',
  tip: '화살표 2개를 그려요 · 왼쪽·오른쪽 부대를 적 옆구리(초록 원)로 · 정면(빨간 원)은 피해요',
  build(k, S) {
    k.floor(S.scene, k.MAT.grass, 60, 60);
    scatter(k, S, ['tree', 'rock'], 12, (i) => [-9 + i * 1.7, i % 2 ? -8.6 : 8.8], 0.8);
    const us = [0, 1].map(() => {
      const o = k.model('tank', 'us');
      o.scale.multiplyScalar(1.5);
      S.scene.add(o);
      return o;
    });
    return { us };
  },
  gen(rng, lv) {
    const ex = rng.range(-2, 2), ez = rng.range(-4, -1);
    const haz = [{ x: ex, z: ez + 2.8, r: 2.3 }];
    for (let i = 0; i < Math.round(lv); i++) haz.push({ x: ex + (rng.chance(0.5) ? 1 : -1) * rng.range(3, 5.5), z: rng.range(0, 4), r: 1.1 });
    return { ex, ez, haz, strokes: [{ start: [-5.5, 7], goal: [ex - 3, ez] }, { start: [5.5, 7], goal: [ex + 3, ez] }] };
  },
  spawn({ k, W, map, add }) {
    for (let i = 0; i < 5; i++) {
      const o = i % 2 ? k.soldier('foe') : k.model('tank', 'foe');
      o.position.set(map.ex - 1.6 + i * 0.8, 0, map.ez + (i % 2) * 0.6);
      add(o);
    }
    map.haz.forEach((h) => {
      const d = disc(k, h.r, 0xff5a4a, 0.35);
      d.position.set(h.x, 0.05, h.z);
      add(d);
    });
    map.strokes.forEach((sdef, i) => {
      const d = disc(k, 1.2, 0x5dff8a, 0.45);
      d.position.set(sdef.goal[0], 0.05, sdef.goal[1]);
      add(d);
      W.us[i].position.set(sdef.start[0], 0, sdef.start[1]);
      W.us[i].rotation.y = Math.PI;
    });
  },
  evalu(map, strokes) {
    const bad = strokes.map((p) => strokeHits(p, map.haz).length);
    const score = strokes.reduce((a, _p, i) => a + (bad[i] ? 0.15 : 0.5), 0);
    return { score, msg: bad.some(Boolean) ? '🩸 정면 화망에 걸렸어요' : '✅ 양쪽에서 조였어요' };
  },
  run({ k, S, W, s, map }) {
    s.strokes.forEach((p, i) => {
      const [x, z] = along(p, Math.min(1, s.t / 1.6) * strokeLen(p));
      W.us[i].position.set(x, 0, z);
    });
    if (s.t > 1.6 && s.t - 0.02 <= 1.6) S.boom(V(k, map.ex, 0.3, map.ez), 1.6);
  },
};

/* ───────── 사격 · 바람 읽는 저격 ───────── */
export function EWindSnipe({ level, seed, report, finish }: MiniProps) {
  const rng = useRng(seed);
  const SHOTS = 5, K = 4.2;
  const newW = () => ({ w: Math.round(rng.range(-3, 3) * Math.min(1.4, level)) || (rng.chance(0.5) ? 1 : -1), drop: Math.round(rng.range(0, 2)) });
  const [st, setSt] = useState(() => ({ n: 0, ...newW(), aim: null as null | { x: number; y: number }, hit: null as null | { x: number; y: number; q: number }, sum: 0 }));
  const ref = useRef<HTMLDivElement>(null);
  const g = use3D({ cam: [0, 1.6, 6], look: [0, 1.5, -8], fov: 38 }, ['tree', 'pine'], (k, S) => {
    k.floor(S.scene, k.MAT.grass, 60, 80);
    scatter(k, S, ['tree', 'pine'], 14, (i) => [(i % 2 ? 1 : -1) * (4 + (i % 3)), -3 - i * 1.6]);
    return {};
  });
  useLoop(() => g.S.current?.render(), g.ready);
  const move = (e) => st.hit == null && e.buttons && setSt({ ...st, aim: pctOf(e, ref.current) });
  const up = () => {
    if (!st.aim || st.hit) return;
    const x = st.aim.x + st.w * K, y = st.aim.y + st.drop * K;
    const d = Math.hypot(x - 50, y - 46);
    const q = d < 4 ? 1 : d < 9 ? 0.75 : d < 15 ? 0.45 : d < 21 ? 0.2 : 0;
    const sum = st.sum + q;
    setSt({ ...st, hit: { x, y, q }, sum });
    report(sum / SHOTS);
    setTimeout(() => {
      if (st.n + 1 >= SHOTS) return finish(clamp01((sum / SHOTS) * 1.05));
      setSt({ n: st.n + 1, ...newW(), aim: null, hit: null, sum });
    }, 1200);
  };
  return (
    <>
      <Hud items={[['발', `${st.n + (st.hit ? 1 : 0)}/${SHOTS}`], ['바람', `${st.w > 0 ? '→' : '←'} ${Math.abs(st.w)}`], ['거리', st.drop ? `멀어요(아래로 ${st.drop})` : '가까움']]} />
      <Box3D r={g.ref} ready={g.ready} fail={g.fail}>
        <div ref={ref} className="eg-wind" onPointerDown={move} onPointerMove={move} onPointerUp={up}>
          <i className="eg-wind-t" />
          <i className="eg-wind-flag" style={{ transform: `scaleX(${st.w > 0 ? 1 : -1})`, width: 14 + Math.abs(st.w) * 9 }} />
          {st.aim && <i className="eg-wind-x" style={{ left: `${st.aim.x}%`, top: `${st.aim.y}%` }} />}
          {st.hit && <i className={`eg-wind-h ${st.hit.q > 0 ? 'ok' : ''}`} style={{ left: `${st.hit.x}%`, top: `${st.hit.y}%` }} />}
        </div>
        <p className="mg-tip">{st.hit ? (st.hit.q >= 1 ? '🎯 한가운데!' : st.hit.q > 0 ? '🙂 맞았어요' : '💨 빗나갔어요') : '조준점을 끌어 바람 반대쪽에 두고 손을 떼요 · 바람 1 = 과녁 안쪽 원 반 칸'}</p>
      </Box3D>
    </>
  );
}

/* ───────── 해상 · 함포 사격: 당겨서 쏘되, 배가 수평일 때 놓기 ───────── */
export function ENaval({ level, seed, report, finish }: MiniProps) {
  const rng = useRng(seed);
  const SHOTS = 5;
  const st = useRef({ d: rng.range(10, 24), drag: null as null | { y0: number; p: number }, n: 0, sum: 0, last: -1, fly: null as any, wait: 0, t: 0, roll: 0, over: false });
  const tick = useTick();
  const range = (p) => 6 + p * 24;
  const g = use3D({ cam: [0, 8, 17], look: [0, 0, -3], sky: 0x8fb6cc }, ['boat'], (k, S) => {
    k.floor(S.scene, k.MAT.water, 120, 160);
    const me = k.ship('us', 4);
    me.rotation.y = Math.PI;
    me.position.set(0, 0, 8);
    const foe = k.ship('foe', 3.2);
    foe.rotation.y = Math.PI / 2;
    const mark = ringMesh(k, 0.95, 0xffe07a, 0.25);
    mark.visible = false;
    const shell = new k.THREE.Mesh(new k.THREE.SphereGeometry(0.16, 8, 6), k.MAT.black);
    shell.visible = false;
    S.scene.add(me, foe, mark, shell);
    return { me, foe, mark, shell };
  });
  useLoop((dt) => {
    const s = st.current, S = g.S.current, k = g.K.current, W = g.W.current;
    if (!S || !k || !W || s.over) return;
    s.t += dt;
    s.roll = Math.sin(s.t * 1.7 * Math.sqrt(level)) * 0.8 + Math.sin(s.t * 3.1) * 0.2;
    W.me.rotation.z = s.roll * 0.35;
    const tz = 8 - s.d;
    W.foe.position.set(0, 0, tz);
    W.mark.visible = !!s.drag;
    if (s.drag) W.mark.position.set(0, 0.05, 8 - range(s.drag.p) - s.roll * 5);
    if (s.fly) {
      s.fly.t += dt / 1.2;
      const kk = Math.min(1, s.fly.t);
      W.shell.visible = true;
      W.shell.position.set(0, 0.9 + Math.sin(kk * Math.PI) * 6, 8 + (s.fly.z - 8) * kk);
      if (kk >= 1) {
        W.shell.visible = false;
        const q = clamp01(1 - Math.abs(s.fly.z - tz) / 4.5);
        if (q > 0.3) S.boom(V(k, 0, 0.3, s.fly.z), 1.3);
        else S.splash(V(k, 0, 0.1, s.fly.z), 1.5);
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
        } else s.d = rng.range(10, 24);
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
    if (p >= 0.05) s.fly = { t: 0, z: 8 - range(p) - s.roll * 5 };
  };
  const s = st.current;
  return (
    <>
      <Hud items={[['발', `${s.n}/${SHOTS}`], ['배 기울기', Math.abs(s.roll) < 0.15 ? '수평 ✓' : s.roll > 0 ? '앞으로 쏠림' : '뒤로 쏠림'], ['방금', s.last < 0 ? '-' : `${Math.round(s.last * 100)}점`]]} />
      <Box3D r={g.ref} ready={g.ready} fail={g.fail} onPointerDown={down} onPointerMove={move} onPointerUp={up}>
        <p className="mg-tip">{s.drag ? '노란 고리가 적함 위에 올 때 손을 떼요 · 파도에 고리가 흔들려요' : '화면을 아래로 당겼다 놓아요'}</p>
      </Box3D>
    </>
  );
}

/* ───────── 모병 · 신병 나누기 ───────── */
export function ERecSort({ seed, report, finish }: MiniProps) {
  const rng = useRng(seed);
  const N = 12;
  const list = useRef(sortRecruits(rng, N)).current;
  const [st, setSt] = useState({ n: 0, ok: 0, pos: null as null | { x: number; y: number }, fb: '' });
  const ref = useRef<HTMLDivElement>(null);
  const cur = list[Math.min(st.n, N - 1)];
  const move = (e) => e.buttons && st.n < N && setSt({ ...st, pos: pctOf(e, ref.current) });
  const up = () => {
    if (!st.pos || st.n >= N) return;
    if (st.pos.y < 62) return setSt({ ...st, pos: null });
    const bin = clampN(Math.floor(st.pos.x / 25), 0, 3);
    const good = bin === cur.bin, ok = st.ok + (good ? 1 : 0), n = st.n + 1;
    setSt({ n, ok, pos: null, fb: good ? `✅ ${SORT_BINS[bin]} 맞아요` : `❌ "${cur.trait}"은(는) ${SORT_BINS[cur.bin]}` });
    report(ok / N);
    if (n >= N) setTimeout(() => finish(ok / N), 600);
  };
  return (
    <>
      <Hud items={[['신병', `${Math.min(N, st.n + 1)}/${N}`], ['맞게 보냄', st.ok]]} />
      <div ref={ref} className="mg-stage eg-sort" style={{ aspectRatio: '1' }} onPointerDown={move} onPointerMove={move} onPointerUp={up}>
        <p className="eg-sort-fb">{st.fb || '신병 카드를 끌어 알맞은 병과 칸에 놓아요'}</p>
        {st.n < N && (
          <div className="eg-sort-card" style={st.pos ? { left: `${st.pos.x}%`, top: `${st.pos.y}%` } : undefined}>
            <span>🧑‍🎓</span>
            <b>{cur.trait}</b>
          </div>
        )}
        <div className="eg-sort-bins">
          {SORT_BINS.map((b, i) => (
            <div key={b} className={st.pos && st.pos.y >= 62 && clampN(Math.floor(st.pos.x / 25), 0, 3) === i ? 'on' : ''}>
              <span>{['🪖', '⚓', '✈️', '💻'][i]}</span>
              <b>{b}</b>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

const follow = (skin) => (p: MiniProps) => <FollowGame {...p} skin={skin} />;
const path = (skin) => (p: MiniProps) => <PathGame {...p} skin={skin} />;
export const EShadow = follow(F_SHADOW);
export const EWing = follow(F_WING);
export const EDelay = follow(F_DELAY);
export const EDronePath = path(P_DRONE);
export const EMines = path(P_MINES);
export const EPincer = path(P_PINCER);
void lerp;
