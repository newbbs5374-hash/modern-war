// @ts-nocheck
// 새 훈련 틀 C "대화로 풀기"(11-26): 사람 얼굴을 보며 말·증거를 골라 마음을 움직여요.
// 정보 · 포로 심문. 사건 글은 battle/fresh.ts CASES
import { useRef, useState } from 'react';
import { Hud, useLoop, type MiniProps } from './kit';
import { Box3D, use3D } from './three';
import { caseFor, interroScore } from '../../../battle/fresh';

export function FInterro({ seed, report, finish }: MiniProps) {
  const cs = useRef(caseFor(seed)).current;
  const MAXW = 4;
  const st = useRef({ t: 0, found: [] as number[], wrong: 0, line: -1, card: '', say: `"${cs.lines[0]}"`, mood: 'calm' as 'calm' | 'nervous' | 'smug' | 'broken', moodT: 0, pressed: [] as number[], over: false, p: null as any, lamp: null as any });
  const [, tick] = useState(0);
  const g = use3D({ cam: [0, 1.25, 2.3], look: [0, 0.95, 0], fov: 42, sky: 0x141414 }, [], (k, S) => {
    const T = k.THREE;
    S.scene.fog = null;
    S.scene.children.forEach((c) => c.isLight && (c.intensity *= 0.35));
    const wall = k.M(0x3d4044), floor = k.M(0x2a2c2e);
    S.scene.add(k.box(8, 4, 0.2, wall, 0, 2, -2.2), k.box(0.2, 4, 6, wall, -3, 2, 0), k.box(0.2, 4, 6, wall, 3, 2, 0));
    k.floor(S.scene, floor, 10, 10);
    S.scene.add(k.box(1.8, 0.06, 0.9, k.M(0x5a4a3a), 0, 0.78, 0.4), k.box(0.06, 0.78, 0.06, k.MAT.metal, -0.8, 0.39, 0.05), k.box(0.06, 0.78, 0.06, k.MAT.metal, 0.8, 0.39, 0.05), k.box(0.06, 0.78, 0.06, k.MAT.metal, -0.8, 0.39, 0.75), k.box(0.06, 0.78, 0.06, k.MAT.metal, 0.8, 0.39, 0.75));
    // 서류철·전등
    S.scene.add(k.box(0.32, 0.03, 0.24, k.M(0xc9b98c), 0.4, 0.82, 0.55));
    const lamp = new T.PointLight(0xffe2a8, 1.6, 6);
    lamp.position.set(0, 2.1, 0.3);
    S.scene.add(lamp, k.box(0.3, 0.12, 0.3, k.M(0x222222), 0, 2.2, 0.3));
    const bulb = new T.Mesh(new T.SphereGeometry(0.06, 8, 6), new T.MeshBasicMaterial({ color: 0xfff1c0 }));
    bulb.position.set(0, 2.12, 0.3);
    S.scene.add(bulb);
    // 포로(적 군복, 의자에 앉음)
    const p = k.soldier('foe');
    p.scale.multiplyScalar(1.25);
    p.position.set(0, 0.42, -0.25);
    S.scene.add(p, k.box(0.5, 0.06, 0.45, k.M(0x4a3a2e), 0, 0.44, -0.25), k.box(0.5, 0.6, 0.06, k.M(0x4a3a2e), 0, 0.75, -0.48));
    st.current.p = p;
    st.current.lamp = lamp;
    return {};
  });
  useLoop((dt) => {
    const s = st.current, S = g.S.current;
    if (!S) return;
    s.t += dt;
    s.moodT = Math.max(0, s.moodT - dt);
    const p = s.p;
    const head = p.children.filter((c) => c.geometry?.type === 'IcosahedronGeometry')[0];
    // 몸짓: 초조 = 들썩임 · 거들먹 = 뒤로 젖힘 · 무너짐 = 고개 숙임
    p.rotation.x = s.mood === 'broken' ? 0.35 : s.mood === 'smug' && s.moodT > 0 ? -0.15 : 0;
    p.rotation.y = s.mood === 'nervous' && s.moodT > 0 ? Math.sin(s.t * 18) * 0.08 : Math.sin(s.t * 0.7) * 0.05;
    p.position.y = 0.42 + (s.mood === 'nervous' && s.moodT > 0 ? Math.abs(Math.sin(s.t * 12)) * 0.02 : 0);
    s.lamp.intensity = 1.6 + Math.sin(s.t * 23) * (Math.random() < 0.02 ? 0.6 : 0.03);
    void head;
    S.render();
    report(interroScore(s.found.length, s.wrong));
    tick((x) => (x + 1) % 1000);
  }, g.ready);
  const end = () => {
    const s = st.current;
    if (s.over) return;
    s.over = true;
    setTimeout(() => finish(interroScore(s.found.length, s.wrong)), 2200);
  };
  const press = () => {
    const s = st.current;
    if (s.line < 0 || s.over) return;
    s.say = cs.press[s.line] ?? '…';
    s.mood = 'nervous';
    s.moodT = 1.5;
    if (!s.pressed.includes(s.line)) s.pressed.push(s.line);
  };
  const show = () => {
    const s = st.current;
    if (s.line < 0 || !s.card || s.over) return;
    if (s.found.includes(s.line)) return void (s.say = '"그건 이미 털어놨잖아…"');
    if (cs.lies[s.line] === s.card) {
      s.found.push(s.line);
      s.mood = s.found.length >= 3 ? 'broken' : 'nervous';
      s.moodT = 2;
      const c = cs.cards.find((x) => x.id === s.card);
      s.say = `"…${c.name}까지 있었나." — 거짓말이 들통났어요! (${s.found.length}/3)`;
      if (s.found.length >= 3) {
        s.say = `무너졌어요. "${cs.truth}"`;
        end();
      }
    } else {
      s.wrong++;
      s.mood = 'smug';
      s.moodT = 1.8;
      s.say = `"그게 무슨 상관이지?" — 이 말과는 맞지 않는 증거예요. (헛짚음 ${s.wrong}/${MAXW})`;
      if (s.wrong >= MAXW) {
        s.say = '포로가 입을 꾹 닫았어요. 더는 말하지 않아요.';
        end();
      }
    }
    s.card = '';
  };
  const s = st.current;
  return (
    <>
      <Hud items={[['밝힌 거짓말', `${s.found.length}/3`], ['헛짚음', `${s.wrong}/${MAXW}`], ['포로', `${cs.face} ${cs.who}`]]} />
      <Box3D r={g.ref} ready={g.ready} fail={g.fail} ratio={1.45}>
        <div className="ci-say">{s.say}</div>
      </Box3D>
      <div className="ci-lines">
        {cs.lines.map((l, i) => (
          <button key={i} className={`${s.line === i ? 'on' : ''} ${s.found.includes(i) ? 'lie' : ''}`} onClick={() => ((s.line = i), (s.say = `"${l}"`))}>
            <small>진술 {i + 1}</small> {l}
            {s.pressed.includes(i) && !s.found.includes(i) && <i>🤔</i>}
            {s.found.includes(i) && <i>❗거짓</i>}
          </button>
        ))}
      </div>
      <div className="ci-cards">
        {cs.cards.map((c) => (
          <button key={c.id} className={s.card === c.id ? 'on' : ''} onClick={() => (s.card = s.card === c.id ? '' : c.id)}>
            <b>🗂 {c.name}</b>
            <small>{c.text}</small>
          </button>
        ))}
      </div>
      <div className="mg-3d-pad">
        <button disabled={s.line < 0 || s.over} onClick={press}>😠 다그치기</button>
        <button className="gold" disabled={s.line < 0 || !s.card || s.over} onClick={show}>🗂 증거 내밀기</button>
      </div>
      <p className="small muted" style={{ textAlign: 'center', margin: '4px 0 0' }}>진술을 하나 고르고 다그쳐 반응을 봐요. 앞뒤가 안 맞는 진술에 맞는 증거를 내밀면 거짓말이 들통나요. 3개를 찾으면 끝.</p>
    </>
  );
}
