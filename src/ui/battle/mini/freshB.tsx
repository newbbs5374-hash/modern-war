// @ts-nocheck
// 새 훈련 틀 B "계획 짜고 재생"(11-26): 지도에 먼저 계획을 그리고 ▶ 실행을 누르면 3D로 펼쳐져요.
// 전술 작전 지도 동시 진행 · 해킹 서버 침투 지도. 계산은 battle/fresh.ts
import { useRef, useState } from 'react';
import { Hud, clamp01, useLoop, type MiniProps } from './kit';
import { Box3D, use3D } from './three';
import { WG, bestNetPath, linked, makeNet, netScore, runNetPath, wegoFoePlan, wegoNew, wegoOver, wegoScore, wegoStep } from '../../../battle/fresh';

/* ═════ B-1 전술: 작전 지도 동시 진행 ═════ */
const CS = 1.6; // 칸 크기
const cx = (c: number) => (c - (WG.W - 1) / 2) * CS;
const cz = (r: number) => (r - (WG.H - 1) / 2) * CS;

export function FTacWego({ seed, report, finish }: MiniProps) {
  const st = useRef({ g: wegoNew(seed), sel: null as any, mode: 'plan' as 'plan' | 'play' | 'done', step: 0, acc: 0, objs: new Map(), lines: new Map(), msg: '우리 분대(파랑)를 눌러 고르고, 땅을 눌러 갈 곳을 찍어요(3곳까지).', over: false });
  const [, tick] = useState(0);
  const g3 = use3D({ cam: [0, 17, 11], look: [0, 0, 0.8], fov: 50 }, ['pine', 'tree', 'houseA', 'houseB', 'b2s', 'crate'], (k, S) => {
    const T = k.THREE;
    const G = st.current.g;
    k.floor(S.scene, k.MAT.grass, 60, 60);
    const board = k.floor(S.scene, k.M(0x6d8a4c), WG.W * CS, WG.H * CS, 0.01);
    void board;
    const grid = new T.GridHelper(WG.H * CS, WG.H, 0x2f4026, 0x2f4026);
    grid.scale.x = WG.W / WG.H;
    grid.position.y = 0.02;
    S.scene.add(grid);
    for (let r = 0; r < WG.H; r++)
      for (let c = 0; c < WG.W; c++) {
        const t = G.map[r][c];
        if (t === 'f') {
          const o = k.model((r + c) % 2 ? 'pine' : 'tree');
          o.position.set(cx(c) + 0.2, 0, cz(r) - 0.1);
          o.scale.multiplyScalar(0.7);
          S.scene.add(o);
        }
        if (t === 'h') {
          const o = k.model(r === G.flag[1] && c === G.flag[0] ? 'b2s' : (r + c) % 2 ? 'houseA' : 'houseB');
          o.position.set(cx(c), 0, cz(r));
          o.scale.multiplyScalar(0.8);
          S.scene.add(o);
        }
      }
    const flag = new T.Group();
    flag.add(k.box(0.05, 1.8, 0.05, k.MAT.metal, 0, 0.9, 0), k.box(0.6, 0.38, 0.03, k.M(0xf39a3d, { emissive: 0x6a3000 }), 0.32, 1.6, 0));
    flag.position.set(cx(G.flag[0]) + 0.5, 0, cz(G.flag[1]) + 0.4);
    S.scene.add(flag);
    for (const u of G.units) {
      const grp = new T.Group();
      for (let i = 0; i < 3; i++) {
        const s = k.soldier(u.side);
        s.position.set((i - 1) * 0.32, 0, (i % 2) * 0.25);
        s.scale.multiplyScalar(0.85);
        if (u.side === 'foe') s.rotation.y = Math.PI;
        grp.add(s);
      }
      const ring = new T.Mesh(new T.RingGeometry(0.62, 0.72, 24), new T.MeshBasicMaterial({ color: u.side === 'us' ? 0x5aa0ff : 0xff5a3a, transparent: true, opacity: 0.8 }));
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.04;
      grp.add(ring);
      grp.userData.ring = ring;
      grp.userData.unit = u;
      grp.position.set(cx(u.c), 0, cz(u.r));
      S.scene.add(grp);
      st.current.objs.set(u.id, grp);
    }
    return {};
  });
  const k = () => g3.K.current;
  const drawPath = (u) => {
    const S = g3.S.current, K = k();
    const old = st.current.lines.get(u.id);
    if (old) S.scene.remove(old);
    if (!u.path.length) return;
    const pts = [[u.c, u.r], ...u.path].map(([c, r]) => new K.THREE.Vector3(cx(c), 0.15, cz(r)));
    const ln = new K.THREE.Line(new K.THREE.BufferGeometry().setFromPoints(pts), new K.THREE.LineDashedMaterial({ color: 0xf39a3d, dashSize: 0.3, gapSize: 0.15 }));
    ln.computeLineDistances();
    S.scene.add(ln);
    st.current.lines.set(u.id, ln);
  };
  useLoop((dt) => {
    const s = st.current, S = g3.S.current, K = k();
    if (!S || !K) return;
    const G = s.g;
    if (s.mode === 'play' && !s.over) {
      s.acc += dt;
      if (s.acc >= 0.55) {
        s.acc = 0;
        const shots = wegoStep(G);
        for (const sh of shots) {
          const a = new K.THREE.Vector3(cx(sh.from.c), 0.5, cz(sh.from.r)), b = new K.THREE.Vector3(cx(sh.to.c), 0.5, cz(sh.to.r));
          S.tracer(a, b, sh.from.side === 'us' ? 0x9cc8ff : 0xffb08a);
          if (Math.random() < 0.4) S.smoke(b, 0.3, false);
        }
        for (const u of G.units) {
          const grp = s.objs.get(u.id);
          if (u.hp <= 0 && grp.visible) {
            S.boom(grp.position.clone(), 0.6);
            grp.visible = false;
          }
          const alive = Math.ceil((u.hp / WG.HP) * 3);
          grp.children.forEach((c, i) => i < 3 && (c.visible = i < alive));
        }
        s.step++;
        for (const u of G.units.filter((x) => x.side === 'us')) drawPath(u);
        if (s.step >= WG.SECS) {
          G.round++;
          for (const u of G.units) u.path = [];
          for (const u of G.units) drawPath(u);
          s.mode = 'plan';
          if (wegoOver(G)) {
            s.over = true;
            s.mode = 'done';
            s.msg = `작전 끝! 적 ${G.units.filter((u) => u.side === 'foe' && u.hp <= 0).length}개 분대 제압.`;
            finish(wegoScore(G));
          } else s.msg = `${G.round}판 끝. 적 움직임을 보고 다음 계획을 세워요.`;
        }
      }
    }
    for (const u of G.units) {
      const grp = s.objs.get(u.id);
      const tx = cx(u.c), tz = cz(u.r);
      grp.position.x += (tx - grp.position.x) * Math.min(1, dt * 6);
      grp.position.z += (tz - grp.position.z) * Math.min(1, dt * 6);
      const moving = Math.abs(tx - grp.position.x) + Math.abs(tz - grp.position.z) > 0.05;
      grp.children.forEach((c) => c.userData.legs && K.walk(c, performance.now() / 1000, moving));
      grp.userData.ring.material.color.setHex(u === s.sel ? 0xffe066 : u.side === 'us' ? 0x5aa0ff : 0xff5a3a);
    }
    S.fx(dt);
    S.render();
    report(wegoScore(G));
    tick((x) => (x + 1) % 1000);
  }, g3.ready);
  const down = (e) => {
    const s = st.current, S = g3.S.current;
    if (!S || s.mode !== 'plan') return;
    const ours = [...s.objs.values()].filter((o) => o.userData.unit.side === 'us' && o.userData.unit.hp > 0);
    const hit = S.hit(e, ours);
    if (hit) {
      s.sel = hit.userData.unit;
      s.msg = `${s.sel.id.replace('u', '')}번째 분대 선택. 갈 곳을 눌러요(${s.sel.path.length}/3).`;
      return;
    }
    if (!s.sel) return;
    const p = S.ground(e);
    if (!p) return;
    const c = Math.round(p.x / CS + (WG.W - 1) / 2), r = Math.round(p.z / CS + (WG.H - 1) / 2);
    if (c < 0 || r < 0 || c >= WG.W || r >= WG.H) return;
    if (s.sel.path.length >= 3) s.sel.path = [];
    s.sel.path.push([c, r]);
    drawPath(s.sel);
    s.msg = `갈 곳 ${s.sel.path.length}/3 · 숲은 몸을 숨기기 좋고, 건물은 더 좋아요.`;
  };
  const run = () => {
    const s = st.current;
    if (s.mode !== 'plan' || s.over) return;
    wegoFoePlan(s.g);
    s.mode = 'play';
    s.step = 0;
    s.acc = 0;
    s.sel = null;
    s.msg = `${s.g.round + 1}판 진행 중… 적도 몰래 세운 계획대로 움직여요.`;
  };
  const s = st.current, G = s.g;
  const left = (side) => G.units.filter((u) => u.side === side && u.hp > 0).length;
  return (
    <>
      <Hud items={[['판', `${Math.min(WG.ROUNDS, G.round + (s.mode === 'play' ? 1 : 0))}/${WG.ROUNDS}`], ['우리', `${left('us')}/3`], ['적', `${left('foe')}/4`], ['점수', `${Math.round(wegoScore(G) * 100)}`]]} />
      <Box3D r={g3.ref} ready={g3.ready} fail={g3.fail} ratio={0.82} onPointerDown={down}>
        <p className="mg-tip">{s.msg}</p>
      </Box3D>
      <div className="mg-3d-pad">
        <button disabled={s.mode !== 'plan' || !s.sel} onClick={() => s.sel && ((s.sel.path = []), drawPath(s.sel))}>✖ 이 분대 길 지우기</button>
        <button className="gold" disabled={s.mode !== 'plan' || s.over} onClick={run}>▶ 실행 ({G.round + 1}판)</button>
      </div>
      <p className="small muted" style={{ textAlign: 'center', margin: '4px 0 0' }}>4판 동안 적을 제압하고 주황 깃발 건물을 차지해요. 움직이며 쏘면 덜 맞혀요.</p>
    </>
  );
}

/* ═════ B-2 해킹: 서버 침투 지도 ═════ */
const NX = (x: number) => (x - 2.5) * 2.6;
const NZ = (y: number) => (y - 1) * 2.6;
const SEC_COL = [0x3fc1b0, 0x9bd36a, 0xf3c23d, 0xf39a3d, 0xff5a3a, 0xc23030];

export function FHackNet({ level, seed, report, finish }: MiniProps) {
  const ROUNDS = 3;
  const st = useRef({ n: 0, net: makeNet(seed, level), path: [0], mode: 'plan' as 'plan' | 'play', t: 0, tick: 0, play: null as any, scores: [] as number[], over: false, msg: '입구(왼쪽)부터 오른쪽으로 서버를 하나씩 눌러 길을 이어요.', root: null, nodes: [] as any[], tracer: null, packet: null, det: 0 });
  const [, tick] = useState(0);
  const build = (k, S) => {
    const T = k.THREE;
    const s = st.current;
    if (s.root) S.scene.remove(s.root);
    const root = new T.Group();
    s.root = root;
    s.nodes = [];
    const net = s.net;
    for (const [a, b] of net.links) {
      const A = net.nodes[a], B = net.nodes[b];
      const ln = new T.Line(new T.BufferGeometry().setFromPoints([new T.Vector3(NX(A.x), 0.3, NZ(A.y)), new T.Vector3(NX(B.x), 0.3, NZ(B.y))]), new T.LineBasicMaterial({ color: 0x2f6f8f }));
      root.add(ln);
    }
    for (const nd of net.nodes) {
      const g = new T.Group();
      const col = nd.id === net.entry ? 0x5aa0ff : nd.id === net.target ? 0xffffff : SEC_COL[Math.min(5, nd.sec)];
      const h = 0.5 + nd.sec * 0.25;
      g.add(k.box(0.9, h, 0.9, k.M(col, { emissive: col, emissiveIntensity: 0.25 }), 0, h / 2, 0));
      if (nd.wall) {
        const sh = new T.Mesh(new T.IcosahedronGeometry(0.9, 1), new T.MeshBasicMaterial({ color: 0xff6a3a, wireframe: true, transparent: true, opacity: 0.5 }));
        sh.position.y = h / 2;
        g.add(sh);
      }
      g.position.set(NX(nd.x), 0, NZ(nd.y));
      g.userData.node = nd;
      root.add(g);
      s.nodes.push(g);
    }
    const tr = new T.Mesh(new T.TorusGeometry(0.75, 0.09, 8, 24), new T.MeshBasicMaterial({ color: 0xff3030 }));
    tr.rotation.x = Math.PI / 2;
    root.add(tr);
    s.tracer = tr;
    const pk = new T.Mesh(new T.SphereGeometry(0.28, 12, 8), new T.MeshBasicMaterial({ color: 0x6dffb0 }));
    pk.visible = false;
    root.add(pk);
    s.packet = pk;
    const pl = new T.Line(new T.BufferGeometry(), new T.LineBasicMaterial({ color: 0x6dffb0 }));
    root.add(pl);
    s.pathLine = pl;
    S.scene.add(root);
  };
  const g3 = use3D({ cam: [0, 13, 9], look: [0, 0, 0.3], fov: 45, sky: 0x0b1416 }, [], (k, S) => {
    S.scene.fog = null;
    k.floor(S.scene, k.M(0x0f1c20), 60, 60);
    const grid = new k.THREE.GridHelper(30, 30, 0x16343c, 0x16343c);
    grid.position.y = 0.01;
    S.scene.add(grid);
    build(k, S);
    return {};
  });
  const redrawPath = () => {
    const s = st.current, K = g3.K.current;
    const pts = s.path.map((id) => new K.THREE.Vector3(NX(s.net.nodes[id].x), 0.6, NZ(s.net.nodes[id].y)));
    s.pathLine.geometry.dispose();
    s.pathLine.geometry = new K.THREE.BufferGeometry().setFromPoints(pts);
  };
  const TICK = 0.6;
  useLoop((dt) => {
    const s = st.current, S = g3.S.current, K = g3.K.current;
    if (!S || !K || s.over) return;
    s.t += dt;
    const tk = Math.floor(s.t / TICK);
    const trId = s.net.tracer[tk % s.net.tracer.length];
    const tn = s.net.nodes[trId];
    s.tracer.position.x += (NX(tn.x) - s.tracer.position.x) * Math.min(1, dt * 8);
    s.tracer.position.z += (NZ(tn.y) - s.tracer.position.z) * Math.min(1, dt * 8);
    s.tracer.position.y = 1.6 + Math.sin(s.t * 4) * 0.1;
    if (s.mode === 'play') {
      const p = s.play;
      const step = Math.max(0, Math.floor((s.t - p.t0) / TICK));
      // 미리 계산한 틱별 위치로 패킷을 옮김(방화벽은 3틱 머묾)
      const at = p.seq[Math.min(step, p.seq.length - 1)];
      const nd = s.net.nodes[at];
      s.packet.visible = true;
      s.packet.position.set(NX(nd.x), 1 + Math.sin(s.t * 10) * 0.08, NZ(nd.y));
      s.det = p.detAt[Math.min(step, p.detAt.length - 1)];
      if (step >= p.seq.length) {
        const sc = netScore(p.res);
        s.scores.push(sc);
        s.msg = p.res.caught ? '🚨 들켰어요! 이 서버는 실패.' : `✅ 침투 성공! 들킴 ${p.res.det}/10`;
        if (p.res.caught) S.boom(s.packet.position.clone(), 0.8);
        s.mode = 'plan';
        s.packet.visible = false;
        if (s.scores.length >= ROUNDS) {
          s.over = true;
          finish(clamp01(s.scores.reduce((a, b) => a + b, 0) / ROUNDS));
        } else {
          s.n++;
          s.net = makeNet(seed + s.n * 97, level);
          s.path = [s.net.entry];
          s.det = 0;
          build(K, S);
          redrawPath();
          s.t = 0;
        }
      }
    }
    S.render();
    report(clamp01(s.scores.reduce((a, b) => a + b, 0) / ROUNDS));
    tick((x) => (x + 1) % 1000);
  }, g3.ready);
  const down = (e) => {
    const s = st.current, S = g3.S.current;
    if (!S || s.mode !== 'plan' || s.over) return;
    const o = S.hit(e, s.nodes);
    if (!o) return;
    const nd = o.userData.node;
    const last = s.path[s.path.length - 1];
    const idx = s.path.indexOf(nd.id);
    if (idx >= 0) {
      s.path = s.path.slice(0, Math.max(1, idx + 1));
    } else if (linked(s.net, last, nd.id) && nd.x === s.net.nodes[last].x + 1) s.path.push(nd.id);
    else return void (s.msg = '바로 옆(오른쪽으로 이어진) 서버만 고를 수 있어요.');
    redrawPath();
    s.msg = `보안 ${nd.sec}${nd.wall ? ' · 방화벽(3틱 머묾)' : ''} · 고른 길 보안 합 ${s.path.reduce((a, id) => a + s.net.nodes[id].sec, 0)}`;
  };
  const run = () => {
    const s = st.current;
    if (s.mode !== 'plan' || s.path[s.path.length - 1] !== s.net.target) return void (s.msg = '오른쪽 끝 흰 서버(목표)까지 이어야 실행할 수 있어요.');
    // 다음 틱에 출발(탐지기 박자는 화면에 보이는 그대로)
    const start = Math.floor(s.t / TICK) + 1;
    const res = runNetPath(s.net, s.path, start);
    const seq: number[] = [], detAt: number[] = [];
    let det = 0, tk = 0;
    for (const id of s.path) {
      const nd = s.net.nodes[id];
      for (let k = 0; k < (nd.wall ? 3 : 1); k++) {
        if (s.net.tracer[(tk + start) % s.net.tracer.length] === id) det += 4;
        seq.push(id);
        detAt.push(Math.min(10, det));
        tk++;
      }
      det += nd.sec;
      detAt[detAt.length - 1] = Math.min(10, det);
      if (det >= 10) break;
    }
    s.play = { t0: start * TICK, seq, detAt, res };
    s.mode = 'play';
    s.msg = '침투 중… 빨간 고리(탐지기)와 같은 서버에 있으면 크게 들켜요.';
  };
  const s = st.current;
  return (
    <>
      <Hud items={[['서버', `${Math.min(ROUNDS, s.scores.length + 1)}/${ROUNDS}`], ['들킴', `${Math.round(s.det)}/10`], ['점수', Math.round((s.scores.reduce((a, b) => a + b, 0) / ROUNDS) * 100)]]} />
      <Box3D r={g3.ref} ready={g3.ready} fail={g3.fail} ratio={1.1} onPointerDown={down}>
        <div className="fp-sus"><i style={{ width: `${s.det * 10}%` }} /></div>
        <p className="mg-tip">{s.msg}</p>
      </Box3D>
      <div className="mg-3d-pad">
        <button disabled={s.mode !== 'plan'} onClick={() => ((s.path = [s.net.entry]), redrawPath(), (s.msg = '길을 지웠어요.'))}>✖ 길 지우기</button>
        <button className="gold" disabled={s.mode !== 'plan' || s.over} onClick={run}>▶ 침투 실행</button>
      </div>
      <p className="small muted" style={{ textAlign: 'center', margin: '4px 0 0' }}>초록일수록 안전, 빨갈수록 보안이 세요. 🛡 그물은 방화벽(오래 머묾). 빨간 고리가 지나가는 박자를 보고 출발해요.</p>
    </>
  );
}
export { bestNetPath };
