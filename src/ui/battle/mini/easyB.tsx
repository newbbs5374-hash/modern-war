// @ts-nocheck
// 11-27 한 손가락 미니 훈련(1차) — 나머지 4개: 위성 사진 판독·첩보 맞춰 보기·짐 싣기·방화벽 틈.
import { useRef, useState } from 'react';
import { Hud, clamp01, pctOf, useLoop, useRng, type MiniProps } from './kit';
import { Box3D, use3D } from './three';
import { satUrl } from '../../homeSat';
import { PACK_H, PACK_W, liarRound, packFits, packPieces } from '../../../battle/easyLogic';

const useTick = () => {
  const [, t] = useState(0);
  return () => t((x) => (x + 1) % 1000);
};

/* ── 정보 · 위성 사진 판독(톡): 실제 위성 사진 두 장에서 새로 생긴 것 찾기 ── */
const SAT_TILES = ['1-0-0', '1-1-0', '1-2-0', '1-3-0', '1-4-0', '1-1-1', '1-2-1', '1-1-2'];
const SAT_KINDS = ['cars', 'strip', 'camp', 'silo', 'depot'];
function SatThing({ o, found }: { o: { x: number; y: number; k: string; a: number }; found?: boolean }) {
  return (
    <span className={`eg-sat-o ${o.k} ${found ? 'found' : ''}`} style={{ left: `${o.x}%`, top: `${o.y}%`, transform: `translate(-50%,-50%) rotate(${o.a}deg)` }}>
      <i />
    </span>
  );
}
export function ESatDiff({ level, seed, report, finish }: MiniProps) {
  const rng = useRng(seed);
  const SCENES = 2, NEW = 5;
  const mk = () => {
    const all: Array<{ x: number; y: number; k: string; a: number }> = [];
    const n = 5 + Math.round(level * 3) + NEW;
    let guard = 0;
    while (all.length < n && guard++ < 500) {
      const x = rng.range(7, 93), y = rng.range(12, 88);
      if (all.some((b) => Math.hypot(b.x - x, (b.y - y) * 0.5) < 11)) continue;
      all.push({ x, y, k: rng.pick(SAT_KINDS), a: Math.round(rng.range(0, 180)) });
    }
    return { tile: rng.pick(SAT_TILES), off: Math.round(rng.range(10, 90)), old: all.slice(NEW), fresh: all.slice(0, NEW) };
  };
  const [sc, setSc] = useState(() => ({ n: 0, scene: mk(), found: [] as number[], total: 0, wrong: 0, over: false }));
  const ref = useRef<HTMLDivElement>(null);
  const score = (t: number, w: number) => clamp01((t / (SCENES * NEW) - w * 0.04) * 1.05);
  const tap = (e) => {
    if (sc.over) return;
    const p = pctOf(e, ref.current);
    const i = sc.scene.fresh.findIndex((d, k) => !sc.found.includes(k) && Math.hypot(d.x - p.x, (d.y - p.y) * 0.5) < 8);
    if (i < 0) {
      const w = sc.wrong + 1;
      setSc({ ...sc, wrong: w });
      return report(score(sc.total, w));
    }
    const found = [...sc.found, i], total = sc.total + 1;
    report(score(total, sc.wrong));
    if (found.length < NEW) return setSc({ ...sc, found, total });
    if (sc.n + 1 >= SCENES) {
      setSc({ ...sc, found, total, over: true });
      return finish(score(total, sc.wrong));
    }
    setSc({ ...sc, n: sc.n + 1, scene: mk(), found: [], total });
  };
  const bg = { backgroundImage: `url(${satUrl(`kr/${sc.scene.tile}.webp`)})`, backgroundSize: '100% auto', backgroundPosition: `0 ${sc.scene.off}%` };
  return (
    <>
      <Hud items={[['찾음', `${sc.found.length}/${NEW}`], ['사진', `${sc.n + 1}/${SCENES}`], ['헛짚음', sc.wrong]]} />
      <div className="mg-stage eg-sat" style={{ aspectRatio: '1' }}>
        <div className="eg-sat-p" style={bg}>
          <b>어제</b>
          {sc.scene.old.map((o, i) => <SatThing key={i} o={o} />)}
        </div>
        <div className="eg-sat-p" style={bg} ref={ref} onPointerDown={tap}>
          <b>오늘 · 새로 생긴 것을 눌러요</b>
          {sc.scene.old.map((o, i) => <SatThing key={i} o={o} />)}
          {sc.scene.fresh.map((o, i) => <SatThing key={`n${i}`} o={o} found={sc.found.includes(i)} />)}
        </div>
      </div>
    </>
  );
}

/* ── 정보 · 첩보 맞춰 보기(고르기): 보고 3개 가운데 거짓 하나 ── */
export function ELiar({ level, seed, report, finish }: MiniProps) {
  const rng = useRng(seed);
  const ROUNDS = 5;
  const [st, setSt] = useState(() => ({ n: 0, r: liarRound(rng, level), ok: 0, pick: -1 }));
  const choose = (i: number) => {
    if (st.pick >= 0) return;
    const ok = st.ok + (i === st.r.lie ? 1 : 0);
    setSt({ ...st, pick: i, ok });
    report(ok / ROUNDS);
    setTimeout(() => {
      if (st.n + 1 >= ROUNDS) return finish(ok / ROUNDS);
      setSt({ n: st.n + 1, r: liarRound(rng, level), ok, pick: -1 });
    }, 1300);
  };
  return (
    <>
      <Hud items={[['문제', `${st.n + 1}/${ROUNDS}`], ['맞힘', st.ok]]} />
      <div className="mg-stage eg-liar">
        <p className="eg-liar-q">🕵️ 앞뒤가 안 맞는 <b>거짓 보고</b> 하나를 골라요</p>
        {st.r.facts.map((f, i) => (
          <button key={`${st.n}-${i}`} className={st.pick < 0 ? '' : i === st.r.lie ? 'good' : i === st.pick ? 'bad' : 'dim'} onClick={() => choose(i)}>
            {f}
          </button>
        ))}
        <p className="eg-liar-a">{st.pick < 0 ? ' ' : st.pick === st.r.lie ? `✅ 맞아요 · ${st.r.why}` : `❌ 아니에요 · ${st.r.why}`}</p>
      </div>
    </>
  );
}

/* ── 보급 · 짐 싣기(끌기): 상자 묶음을 끌어 수송기 짐칸을 빈틈없이 채움 ── */
export function EPack({ level, seed, report, finish }: MiniProps) {
  const rng = useRng(seed);
  const BAYS = 3;
  const X0 = -PACK_W / 2 + 0.5, Z0 = -5.6;
  const COLS = [0x9b7a4a, 0x6f8250, 0x7d8a96, 0xa8694a, 0x5d7f8f, 0xb09a5a, 0x7a6a8c];
  const st = useRef({ bay: 0, pieces: packPieces(rng, level), grid: Array(PACK_W * PACK_H).fill(-1), at: [] as Array<number[] | null>, drag: null as any, done: 0, wait: 0, over: false });
  const tick = useTick();
  const g = use3D({ cam: [0, 20, 5.2], look: [0, 0, 1.3], sky: 0x9fb4c2 }, ['jet'], (k, S) => {
    k.floor(S.scene, k.M(0x4f565c), 60, 60);
    S.scene.add(k.box(PACK_W + 0.5, 0.1, PACK_H + 0.5, k.M(0x39424c), 0, 0.05, Z0 + PACK_H / 2 - 0.5));
    for (let x = 0; x < PACK_W; x++)
      for (let y = 0; y < PACK_H; y++) S.scene.add(k.box(0.92, 0.04, 0.92, k.M((x + y) % 2 ? 0x525d68 : 0x5b6772), X0 + x, 0.12, Z0 + y));
    // 수송기 꼬리·날개(모양만)
    S.scene.add(k.box(PACK_W + 5, 0.2, 1.4, k.M(0x8793a0), 0, 0.1, Z0 - 1.6), k.box(1.6, 0.2, 2.2, k.M(0x8793a0), 0, 0.1, Z0 - 2.6));
    return { objs: [] as any[] };
  });
  /** 대기 자리: 왼쪽부터 줄 맞춰 늘어놓음 */
  const homes = () => {
    const out = [];
    let x = -5.2, z = 0.6, rowH = 0;
    for (const p of st.current.pieces) {
      const w = Math.max(...p.cells.map((c) => c[0])) + 1, h = Math.max(...p.cells.map((c) => c[1])) + 1;
      if (x + w > 5.6) {
        x = -5.2;
        z += rowH + 0.5;
        rowH = 0;
      }
      out.push([x + 0.5, z + 0.5]);
      x += w + 0.5;
      rowH = Math.max(rowH, h);
    }
    return out;
  };
  const home = (i) => homes()[i];
  const built = useRef(-1);
  const rebuild = () => {
    const S = g.S.current, k = g.K.current, W = g.W.current, s = st.current;
    W.objs.forEach((o) => S.scene.remove(o));
    W.objs = s.pieces.map((p, i) => {
      const grp = new k.THREE.Group();
      const mat = k.M(COLS[i % COLS.length]);
      p.cells.forEach(([x, y]) => grp.add(k.box(0.9, 0.7, 0.9, mat, x, 0.35, y), k.box(0.94, 0.08, 0.2, k.MAT.metal, x, 0.72, y)));
      const [hx, hz] = home(i);
      grp.position.set(hx, 0.12, hz);
      grp.userData.i = i;
      S.scene.add(grp);
      return grp;
    });
    s.at = s.pieces.map(() => null);
  };
  useLoop((dt) => {
    const s = st.current, S = g.S.current, W = g.W.current;
    if (!S || !W || s.over) return;
    if (built.current !== s.bay) {
      built.current = s.bay;
      rebuild();
    }
    if (s.wait > 0) {
      s.wait -= dt;
      if (s.wait <= 0) {
        s.done++;
        if (s.done >= BAYS) {
          s.over = true;
          return finish(1);
        }
        Object.assign(s, { bay: s.bay + 1, pieces: packPieces(rng, level), grid: Array(PACK_W * PACK_H).fill(-1), drag: null });
      }
    }
    S.fx(dt);
    S.render();
    report(clamp01((s.done + (s.grid.filter((x) => x >= 0).length / s.grid.length) * 0.85) / BAYS));
    tick();
  }, g.ready);
  const down = (e) => {
    const s = st.current, S = g.S.current, W = g.W.current;
    if (!S || s.wait > 0 || s.over) return;
    const o = S.hit(e, W.objs), p = S.ground(e);
    if (!o || !p) return;
    const i = o.userData.i;
    s.grid = s.grid.map((x) => (x === i ? -1 : x));
    s.at[i] = null;
    s.drag = { i, dx: o.position.x - p.x, dz: o.position.z - p.z };
    o.position.y = 0.6;
  };
  const move = (e) => {
    const s = st.current, S = g.S.current, W = g.W.current;
    if (!s.drag || !S) return;
    const p = S.ground(e);
    if (p) W.objs[s.drag.i].position.set(p.x + s.drag.dx, 0.6, p.z + s.drag.dz);
  };
  const up = () => {
    const s = st.current, W = g.W.current;
    if (!s.drag) return;
    const i = s.drag.i, o = W.objs[i], pc = s.pieces[i];
    s.drag = null;
    const gx = Math.round(o.position.x - X0), gy = Math.round(o.position.z - Z0);
    if (packFits(s.grid, pc, gx, gy)) {
      pc.cells.forEach(([x, y]) => (s.grid[(gy + y) * PACK_W + gx + x] = i));
      s.at[i] = [gx, gy];
      o.position.set(X0 + gx, 0.14, Z0 + gy);
      if (s.grid.every((x) => x >= 0)) s.wait = 0.9;
    } else {
      const [hx, hz] = home(i);
      o.position.set(hx, 0.12, hz);
    }
  };
  const s = st.current;
  return (
    <>
      <Hud items={[['짐칸', `${Math.min(BAYS, s.done + 1)}/${BAYS}`], ['채움', `${s.grid.filter((x) => x >= 0).length}/${s.grid.length}칸`]]} />
      <Box3D r={g.ref} ready={g.ready} fail={g.fail} onPointerDown={down} onPointerMove={move} onPointerUp={up}>
        <p className="mg-tip">{s.wait > 0 ? '✅ 가득 실었어요!' : '상자 묶음을 끌어 짐칸(위쪽)에 놓아요'}</p>
      </Box3D>
    </>
  );
}

/* ── 해킹 · 방화벽 틈(톡): 도는 고리의 틈이 위쪽 화살표에 올 때 눌러 멈춤. 바깥부터 3겹 ── */
export function ERings({ level, seed, report, finish }: MiniProps) {
  const rng = useRng(seed);
  const NEED = 6, GAP = 0.75;
  const mkRing = () => [0, 1, 2].map(() => ({ a: rng.range(0, 6.28), w: rng.range(1.7, 2.6) * Math.sqrt(level) * (rng.chance(0.5) ? 1 : -1), lock: false }));
  const st = useRef({ rings: mkRing(), cur: 0, done: 0, miss: 0, wait: 0, bad: 0, over: false });
  const tick = useTick();
  const g = use3D({ cam: [0, 0.4, 13], look: [0, 0.4, 0], sky: 0x07131c }, [], (k, S) => {
    const T = k.THREE;
    const cols = [0x3fb8c9, 0x5dff8a, 0xffb020];
    const meshes = [3.6, 2.6, 1.6].map((r, i) => {
      const m = new T.Mesh(new T.TorusGeometry(r, 0.26, 10, 64, Math.PI * 2 - GAP), new T.MeshBasicMaterial({ color: cols[i] }));
      S.scene.add(m);
      return m;
    });
    const core = new T.Mesh(new T.IcosahedronGeometry(0.7, 1), new T.MeshBasicMaterial({ color: 0xff5a4a, wireframe: true }));
    S.scene.add(core);
    const arrow = new T.Mesh(new T.ConeGeometry(0.3, 0.6, 3), new T.MeshBasicMaterial({ color: 0xffffff }));
    arrow.position.set(0, 4.5, 0);
    arrow.rotation.z = Math.PI;
    S.scene.add(arrow);
    const beam = k.box(0.12, 4.4, 0.12, new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.25 }), 0, 2.2, 0);
    S.scene.add(beam);
    return { meshes, core, beam };
  });
  /** 틈 가운데가 위(π/2)에서 얼마나 벗어났나 */
  const off = (r) => {
    let d = (r.a - GAP / 2 - Math.PI / 2) % (Math.PI * 2);
    if (d > Math.PI) d -= Math.PI * 2;
    if (d < -Math.PI) d += Math.PI * 2;
    return Math.abs(d);
  };
  useLoop((dt) => {
    const s = st.current, S = g.S.current, W = g.W.current;
    if (!S || !W || s.over) return;
    s.bad = Math.max(0, s.bad - dt);
    s.rings.forEach((r, i) => {
      if (!r.lock) r.a += r.w * dt;
      W.meshes[i].rotation.z = r.a;
      W.meshes[i].material.opacity = 1;
      W.meshes[i].scale.setScalar(i === s.cur && !r.lock ? 1 + Math.sin(performance.now() / 120) * 0.012 : 1);
    });
    W.core.rotation.y += dt;
    W.core.rotation.x += dt * 0.6;
    W.beam.material.opacity = s.wait > 0 ? 0.95 : 0.2;
    if (s.wait > 0) {
      s.wait -= dt;
      if (s.wait <= 0) {
        s.done++;
        if (s.done >= NEED) {
          s.over = true;
          return finish(clamp01(1 - s.miss * 0.04));
        }
        s.rings = mkRing();
        s.cur = 0;
      }
    }
    S.render();
    report(clamp01((s.done * 3 + s.cur) / (NEED * 3) - s.miss * 0.04));
    tick();
  }, g.ready);
  const tap = () => {
    const s = st.current;
    if (s.over || s.wait > 0 || s.cur > 2) return;
    const r = s.rings[s.cur];
    if (off(r) < GAP / 2 - 0.08) {
      r.lock = true;
      r.a = Math.PI / 2 + GAP / 2;
      s.cur++;
      if (s.cur > 2) s.wait = 0.7;
    } else {
      s.miss++;
      s.bad = 0.5;
      r.w = -r.w;
    }
  };
  const s = st.current;
  return (
    <>
      <Hud items={[['뚫음', `${s.done}/${NEED}`], ['고리', `${Math.min(3, s.cur + (s.wait > 0 ? 0 : 1))}/3`], ['헛손질', s.miss]]} />
      <Box3D r={g.ref} ready={g.ready} fail={g.fail} onPointerDown={tap}>
        <p className="mg-tip">{s.wait > 0 ? '🔓 뚫었어요!' : s.bad > 0 ? '⚠️ 아직이에요' : `${['바깥', '가운데', '안쪽'][Math.min(2, s.cur)]} 고리의 틈이 ▼ 아래에 오면 톡`}</p>
      </Box3D>
    </>
  );
}
