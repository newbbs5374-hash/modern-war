// @ts-nocheck
// 새 훈련 틀 D "기지 관리판"(11-26): 여러 일이 한꺼번에 들어오고 무엇부터 할지 정해요.
// 보급 기지 운영 · 통솔 동시 무전 지휘 · 모병 광고 캠페인. 계산은 battle/fresh.ts
import { useRef, useState } from 'react';
import { Hud, useLoop, useRng, type MiniProps } from './kit';
import { Box3D, use3D } from './three';
import { AD, ADS, RADIO_TYPES, SQUADS, SUP, SUP_KINDS, adDay, adNew, adScore, radioAnswer, radioNew, radioScore, radioTick, supNew, supOrder, supScore, supSend, supTick } from '../../../battle/fresh';

const KIND_ICON = { 탄약: '🧨', 연료: '⛽', 식량: '🍚', 부품: '🔩' };

/** 간단한 군용 트럭(코드 모형) */
function truck(k, col = 0x4f5d3a) {
  const T = k.THREE;
  const g = new T.Group();
  const body = k.M(col);
  g.add(k.box(0.7, 0.45, 0.6, body, 0, 0.45, 0.55), k.box(0.75, 0.55, 1.3, k.M(0x6b7a4c), 0, 0.55, -0.4), k.box(0.5, 0.2, 0.05, k.M(0x9fc3d8), 0, 0.6, 0.86));
  [[-0.38, 0.55], [0.38, 0.55], [-0.38, -0.6], [0.38, -0.6]].forEach(([x, z]) => {
    const w = new T.Mesh(new T.CylinderGeometry(0.18, 0.18, 0.12, 10), k.MAT.track);
    w.rotation.z = Math.PI / 2;
    w.position.set(x, 0.18, z);
    g.add(w);
  });
  return g;
}

/* ═════ D-1 보급: 보급 기지 운영 ═════ */
export function FSupBase({ level, seed, report, finish }: MiniProps) {
  const rng = useRng(seed);
  const st = useRef({ s: supNew(), over: false, msg: '전선 요청을 눌러 트럭을 보내요. 모자란 물자는 공장에 주문해요.', trucks: [] as any[] });
  const [, tick] = useState(0);
  const g = use3D({ cam: [7, 7, 9], look: [0, 0, -1], fov: 45 }, ['container', 'crate', 'barrel', 'tent', 'antenna', 'pine'], (k, S) => {
    k.floor(S.scene, k.MAT.dirt, 60, 60);
    const road = k.floor(S.scene, k.MAT.road, 2.2, 40, 0.01);
    road.position.set(0, 0.01, -14);
    for (let i = 0; i < 8; i++) {
      const o = k.model(i % 2 ? 'container' : 'crate');
      o.position.set(-4 + (i % 4) * 1.3, 0, 1.5 + Math.floor(i / 4) * 1.3);
      o.scale.multiplyScalar(i % 2 ? 1.4 : 2.2);
      S.scene.add(o);
    }
    [['tent', 4, 1.5], ['tent', 4, 3.5], ['antenna', 5.5, -1], ['pine', -6, -4], ['pine', 6, -6]].forEach(([m, x, z]) => {
      const o = k.model(m);
      o.position.set(x, 0, z);
      o.scale.multiplyScalar(1.5);
      S.scene.add(o);
    });
    for (let i = 0; i < 12; i++) {
      const o = k.model('barrel');
      o.position.set(-5 + (i % 6) * 0.4, 0, -1 - Math.floor(i / 6) * 0.4);
      o.scale.multiplyScalar(1.6);
      S.scene.add(o);
    }
    for (let i = 0; i < SUP.TRUCKS; i++) {
      const t = truck(k);
      t.rotation.y = Math.PI;
      t.position.set(-1 + i * 1.1, 0, -0.5);
      S.scene.add(t);
      st.current.trucks.push({ o: t, home: t.position.clone() });
    }
    return {};
  });
  useLoop((dt) => {
    const c = st.current, S = g.S.current;
    if (!S || c.over) return;
    supTick(c.s, dt, rng, level);
    // 트럭: 남은 시간 앞 절반은 북쪽으로 가고, 뒤 절반은 돌아옴
    c.trucks.forEach((tr, i) => {
      const left = c.s.trucks[i];
      const k2 = left > 0 ? 1 - Math.abs(left / SUP.TRIP - 0.5) * 2 : 0;
      tr.o.position.set(left > 0 ? 0 : tr.home.x, 0, tr.home.z - k2 * 22);
      tr.o.rotation.y = left > SUP.TRIP / 2 ? Math.PI : 0;
    });
    S.render();
    report(supScore(c.s));
    if (c.s.t >= SUP.SECS) {
      c.over = true;
      finish(supScore(c.s));
    }
    tick((x) => (x + 1) % 1000);
  }, g.ready);
  const c = st.current, s = c.s;
  const wait = s.reqs.filter((r) => r.state === 'wait').sort((a, b) => a.left - b.left);
  return (
    <>
      <Hud items={[['보냄', s.done], ['늦음', s.late], ['빈 트럭', `${s.trucks.filter((x) => x <= 0).length}/${SUP.TRUCKS}`], ['예산', s.budget]]} />
      <Box3D r={g.ref} ready={g.ready} fail={g.fail} ratio={1.9}>
        <p className="mg-tip">{c.msg}</p>
      </Box3D>
      <div className="dm-stock">
        {SUP_KINDS.map((kd) => (
          <button key={kd} onClick={() => (c.msg = supOrder(s, kd) ?? `${kd} 4개 주문 · ${SUP.ORDER}초 뒤 도착`)}>
            <b>{KIND_ICON[kd]} {kd} {s.stock[kd]}</b>
            <small>+4 주문{s.orders.some((o) => o.kind === kd) ? ' ⏳' : ''}</small>
          </button>
        ))}
      </div>
      <div className="dm-list">
        {wait.length === 0 && <p className="small muted">전선 요청을 기다리는 중…</p>}
        {wait.slice(0, 6).map((r) => (
          <button key={r.id} className={r.left < 6 ? 'hot' : ''} onClick={() => (c.msg = supSend(s, r.id) ?? `${r.unit}에 ${r.kind} ${r.qty} 보냄 🚚`)}>
            <b>{r.unit}</b> {KIND_ICON[r.kind]} {r.kind} ×{r.qty}
            <span className="dm-bar"><i style={{ width: `${(r.left / SUP.DEADLINE) * 100}%` }} /></span>
          </button>
        ))}
      </div>
    </>
  );
}

/* ═════ D-2 통솔: 동시 무전 지휘 ═════ */
export function FLeadRadio({ level, seed, report, finish }: MiniProps) {
  const rng = useRng(seed);
  const SECS = 60;
  const st = useRef({ s: radioNew(), over: false, marks: [] as any[], last: '' });
  const [, tick] = useState(0);
  const pos = [[-6, -5], [-2, -7], [2, -6], [6, -4], [0, -2]];
  const g = use3D({ cam: [0, 11, 6], look: [0, 0, -4], fov: 50 }, ['pine', 'tree', 'rock', 'bush', 'tent', 'antenna'], (k, S) => {
    const T = k.THREE;
    k.floor(S.scene, k.MAT.grass, 80, 80);
    for (let i = 0; i < 30; i++) {
      const o = k.model(['pine', 'tree', 'rock', 'bush'][i % 4]);
      o.position.set(rng.range(-12, 12), 0, -rng.range(-2, 14));
      S.scene.add(o);
    }
    [['tent', 0, 3], ['antenna', 1.4, 3.4]].forEach(([m, x, z]) => {
      const o = k.model(m);
      o.position.set(x, 0, z);
      o.scale.multiplyScalar(1.5);
      S.scene.add(o);
    });
    pos.forEach(([x, z]) => {
      const grp = new T.Group();
      for (let i = 0; i < 3; i++) {
        const s = k.soldier('us');
        s.position.set((i - 1) * 0.35, 0, (i % 2) * 0.3);
        s.scale.multiplyScalar(0.8);
        grp.add(s);
      }
      const ring = new T.Mesh(new T.RingGeometry(0.8, 0.95, 24), new T.MeshBasicMaterial({ color: 0x3fc1b0, transparent: true, opacity: 0.85 }));
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.05;
      grp.add(ring);
      grp.position.set(x, 0, z);
      S.scene.add(grp);
      st.current.marks.push({ grp, ring });
    });
    return {};
  });
  useLoop((dt) => {
    const c = st.current, S = g.S.current, k = g.K.current;
    if (!S || !k || c.over) return;
    radioTick(c.s, dt, rng, level);
    c.marks.forEach((m, i) => {
      const mo = c.s.morale[i];
      const call = c.s.msgs.find((x) => x.sq === i);
      m.ring.material.color.setHex(mo > 60 ? 0x3fc1b0 : mo > 30 ? 0xf3c23d : 0xff5a3a);
      m.ring.scale.setScalar(call ? 1 + Math.abs(Math.sin(c.s.t * 6)) * 0.35 : 1);
      if (call && Math.random() < dt * 2) S.smoke(m.grp.position.clone().add(new k.THREE.Vector3(rng.range(-1, 1), 0.2, -1.2)), 0.4, true);
    });
    S.fx(dt);
    S.render();
    report(radioScore(c.s));
    if (c.s.t >= SECS) {
      c.over = true;
      finish(radioScore(c.s));
    }
    tick((x) => (x + 1) % 1000);
  }, g.ready);
  const c = st.current, s = c.s;
  return (
    <>
      <Hud items={[['바른 지시', s.right], ['틀림', s.wrong], ['놓침', s.miss]]} />
      <Box3D r={g.ref} ready={g.ready} fail={g.fail} ratio={2.1}>
        <p className="mg-tip">{c.last || '분대 무전이 한꺼번에 들어와요. 급한 것부터 맞는 지시를 골라요.'}</p>
      </Box3D>
      <div className="dm-morale">
        {SQUADS.map((n, i) => (
          <span key={n}>
            <small>{n}</small>
            <i style={{ width: `${s.morale[i]}%` }} className={s.morale[i] < 30 ? 'low' : s.morale[i] < 60 ? 'mid' : ''} />
          </span>
        ))}
      </div>
      <div className="dm-list">
        {s.msgs.length === 0 && <p className="small muted">📻 조용해요… 곧 무전이 와요.</p>}
        {[...s.msgs].sort((a, b) => a.left - b.left).map((m) => {
          const ty = RADIO_TYPES[m.type];
          return (
            <div key={m.id} className={`dm-radio ${m.left < 3 ? 'hot' : ''}`}>
              <b>📻 {SQUADS[m.sq]} · {ty.kind}</b> <small>"{ty.msg}"</small>
              <span className="dm-bar"><i style={{ width: `${(m.left / 8) * 100}%` }} /></span>
              <div className="dm-opts">
                {ty.opts.map((o, j) => (
                  <button key={j} onClick={() => (c.last = radioAnswer(s, m.id, j) ? `✅ ${SQUADS[m.sq]}: "알겠습니다!" 사기 ↑` : `❌ ${SQUADS[m.sq]}: "네…?" 사기 ↓`)}>{o}</button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

/* ═════ D-3 모병: 광고 캠페인 ═════ */
export function FRecAds({ seed, report, finish }: MiniProps) {
  const rng = useRng(seed);
  const st = useRef({ a: adNew(seed), dayT: 0, over: false, walkers: [] as any[], pend: 0 });
  const [, tick] = useState(0);
  const g = use3D({ cam: [0, 7, 10], look: [0, 0, 0], fov: 45 }, ['b2s', 'b3s', 'b4', 'houseA', 'houseB', 'tent', 'tree'], (k, S) => {
    k.floor(S.scene, k.MAT.conc, 60, 60);
    const road = k.floor(S.scene, k.MAT.road, 30, 2.4, 0.01);
    road.position.z = 1;
    [['b3s', -7, -4], ['b4', -3.5, -5], ['b2s', 0, -4.5], ['b4', 3.5, -5], ['b3s', 7, -4], ['houseA', -8, 5], ['houseB', 8, 5], ['tree', -5, 4], ['tree', 5, 4]].forEach(([m, x, z]) => {
      const o = k.model(m);
      o.position.set(x, 0, z);
      o.scale.multiplyScalar(1.8);
      S.scene.add(o);
    });
    const tent = k.model('tent', 'us');
    tent.position.set(0, 0, 3.5);
    tent.scale.multiplyScalar(2.2);
    S.scene.add(tent);
    // 홍보판 4개(채널 색)
    [0x5aa0ff, 0xf39a3d, 0x3fc1b0, 0xc77dff].forEach((col, i) => S.scene.add(k.box(1.4, 0.9, 0.08, k.M(col, { emissive: col, emissiveIntensity: 0.3 }), -4.5 + i * 3, 1.6, -2), k.box(0.08, 1.2, 0.08, k.MAT.metal, -4.5 + i * 3, 0.6, -2)));
    return {};
  });
  useLoop((dt) => {
    const c = st.current, S = g.S.current, k = g.K.current;
    if (!S || !k || c.over) return;
    c.dayT += dt;
    if (c.dayT >= AD.DAY_SECS) {
      c.dayT = 0;
      const n = adDay(c.a, rng);
      c.pend += Math.min(16, Math.round(n / 8));
      if (c.a.day >= AD.DAYS) {
        c.over = true;
        setTimeout(() => finish(adScore(c.a)), 1500);
      }
    }
    // 지원자: 길에서 홍보 천막으로 걸어 들어감
    if (c.pend > 0 && Math.random() < dt * 6) {
      c.pend--;
      const p = k.soldier('civ');
      const side = rng.chance(0.5) ? -1 : 1;
      p.position.set(side * 13, 0, 1 + rng.range(-0.6, 0.6));
      S.scene.add(p);
      c.walkers.push({ o: p });
    }
    for (const w of c.walkers) {
      const d = new k.THREE.Vector3(0, 0, 3.2).sub(w.o.position);
      if (d.length() < 0.3) (S.scene.remove(w.o), (w.gone = true));
      else {
        d.normalize();
        w.o.position.addScaledVector(d, dt * 3);
        w.o.rotation.y = Math.atan2(d.x, d.z);
        k.walk(w.o, performance.now() / 1000, true);
      }
    }
    c.walkers = c.walkers.filter((w) => !w.gone);
    S.render();
    report(adScore(c.a));
    tick((x) => (x + 1) % 1000);
  }, g.ready);
  const c = st.current, a = c.a;
  const used = a.spend.reduce((x, y) => x + y, 0);
  const setSp = (i, d) => {
    const nv = a.spend[i] + d;
    if (nv < 0 || (d > 0 && used >= AD.BUDGET)) return;
    a.spend[i] = nv;
  };
  const max = Math.max(1, ...a.hist, a.target / AD.DAYS);
  return (
    <>
      <Hud items={[['날', `${Math.min(AD.DAYS, a.day + 1)}/${AD.DAYS}일`], ['모은 지원자', `${a.total}/${a.target}`], ['예산', `${used}/${AD.BUDGET}`]]} />
      <Box3D r={g.ref} ready={g.ready} fail={g.fail} ratio={1.9}>
        <p className="mg-tip">{a.event ? `📰 ${a.event}` : '예산 10을 채널에 나눠요. 같은 곳에 몰수록 효과가 줄어요.'}</p>
      </Box3D>
      <div className="dm-ads">
        {ADS.map((ch, i) => (
          <div key={ch.k} className={a.boost === i ? 'boost' : ''}>
            <b>{ch.icon} {ch.k}</b>
            <small>어제 +{a.last[i]}명</small>
            <span>
              <button onClick={() => setSp(i, -1)}>−</button>
              <b>{a.spend[i]}</b>
              <button onClick={() => setSp(i, 1)}>+</button>
            </span>
          </div>
        ))}
      </div>
      <div className="dm-chart">
        {Array.from({ length: AD.DAYS }, (_, i) => (
          <span key={i}>
            <i style={{ height: `${((a.hist[i] ?? 0) / max) * 100}%` }} />
            <small>{i + 1}일</small>
          </span>
        ))}
      </div>
      <div className="mg-3d-pad">
        <button className="gold" disabled={c.over} onClick={() => (st.current.dayT = AD.DAY_SECS)}>⏩ 다음 날로 ({Math.ceil(AD.DAY_SECS - c.dayT)}초)</button>
      </div>
    </>
  );
}
