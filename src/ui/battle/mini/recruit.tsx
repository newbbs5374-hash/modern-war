// 모병 훈련 미니게임 3개
import { useMemo, useRef, useState } from 'react';
import { Hud, Stage, clamp01, useRng, type MiniProps } from './kit';

/* ── 지원자 면접 ── */
const FAM = ['김', '이', '박', '최', '정', '강', '조', '윤', '장', '임', '한', '오'];
const GIVEN = ['민준', '서연', '도윤', '하은', '지호', '수아', '현우', '지민', '우진', '예린', '태양', '나래', '건우', '소율'];
const HEALTH = ['A', 'B', 'C', 'D'];
export function RecInterview({ level, seed, report, finish }: MiniProps) {
  const rng = useRng(seed);
  const N = 20;
  const maxAge = level < 1.5 ? 35 : 32;
  const people = useMemo(
    () =>
      Array.from({ length: N }, () => {
        const age = Math.round(rng.range(16, 42));
        const health = rng.weighted(HEALTH, (h) => (h === 'A' ? 3 : h === 'B' ? 3 : 2)) as string;
        const record = rng.chance(0.18);
        return { name: rng.pick(FAM) + rng.pick(GIVEN), age, health, record, face: rng.pick(['🧑', '👩', '👨', '🧔', '👱']), ok: age >= 18 && age <= maxAge && (health === 'A' || health === 'B') && !record };
      }),
    [rng, maxAge],
  );
  const [i, setI] = useState(0);
  const [good, setGood] = useState(0);
  const [bad, setBad] = useState(0);
  const [drag, setDrag] = useState<{ x0: number; dx: number } | null>(null);
  const [last, setLast] = useState('');
  const decide = (yes: boolean) => {
    if (i >= N) return;
    const p = people[i];
    const right = p.ok === yes;
    const g = good + (right ? 1 : 0);
    const b = bad + (right ? 0 : 1);
    setGood(g);
    setBad(b);
    setLast(right ? '✅ 맞았어요' : `❌ 틀렸어요(${p.ok ? '합격' : '불합격'}이 맞아요)`);
    report(clamp01(g / N - b * 0.03));
    if (i + 1 >= N) finish(clamp01(g / N - b * 0.03));
    setI(i + 1);
  };
  const p = people[Math.min(i, N - 1)];
  return (
    <>
      <Hud items={[['면접', `${Math.min(i + 1, N)}/${N}`], ['맞음', good], ['틀림', bad]]} />
      <p className="small">
        📋 조건: 나이 18~{maxAge}세 · 건강 A·B · 전과 없음
      </p>
      <Stage
        ratio={1.25}
        className="mg-desk"
        onPointerDown={(e) => setDrag({ x0: e.clientX, dx: 0 })}
        onPointerMove={(e) => drag && setDrag({ ...drag, dx: e.clientX - drag.x0 })}
        onPointerUp={() => {
          if (drag && Math.abs(drag.dx) > 60) decide(drag.dx > 0);
          setDrag(null);
        }}
      >
        {i < N && (
          <div className="mg-card" style={{ transform: `translate(-50%,-50%) translateX(${drag?.dx ?? 0}px) rotate(${(drag?.dx ?? 0) / 20}deg)` }}>
            <div style={{ fontSize: 46 }}>{p.face}</div>
            <b>{p.name}</b>
            <div className="kv2 small">
              <span>나이</span>
              <b>{p.age}세</b>
              <span>건강</span>
              <b>{p.health}급</b>
              <span>전과</span>
              <b>{p.record ? '있음' : '없음'}</b>
            </div>
            {drag && Math.abs(drag.dx) > 30 && <i className={`mg-stamp ${drag.dx > 0 ? 'yes' : 'no'}`}>{drag.dx > 0 ? '합격' : '불합격'}</i>}
          </div>
        )}
      </Stage>
      <p className="small muted">{last || '서류를 오른쪽(합격)·왼쪽(불합격)으로 밀어요'}</p>
      <div className="buttons">
        <button onClick={() => decide(false)}>← 불합격</button>
        <button className="primary" onClick={() => decide(true)}>
          합격 →
        </button>
      </div>
    </>
  );
}

/* ── 연설 카드 ── */
const MOODS = [
  { k: '불안', i: '😟', card: '🛡️ "여러분의 가족은 우리가 지킵니다"' },
  { k: '분노', i: '😠', card: '⚔️ "빼앗긴 것을 되찾읍시다"' },
  { k: '자부심', i: '😤', card: '🏅 "우리 고장은 늘 영웅을 낳았습니다"' },
  { k: '피곤', i: '😩', card: '🎁 "입대하면 집과 봉급을 드립니다"' },
  { k: '의심', i: '🤨', card: '📊 "숫자로 보여 드리겠습니다"' },
];
export function RecSpeech({ seed, report, finish }: MiniProps) {
  const rng = useRng(seed);
  const N = 8;
  const rounds = useMemo(
    () =>
      Array.from({ length: N }, () => {
        const m = Math.floor(rng.next() * MOODS.length);
        const opts = [m];
        while (opts.length < 3) {
          const o = Math.floor(rng.next() * MOODS.length);
          if (!opts.includes(o)) opts.push(o);
        }
        return { m, opts: opts.sort(() => rng.next() - 0.5), crowd: Array.from({ length: 9 }, () => (rng.chance(0.75) ? m : Math.floor(rng.next() * MOODS.length))) };
      }),
    [rng],
  );
  const [no, setNo] = useState(0);
  const [good, setGood] = useState(0);
  const [msg, setMsg] = useState('');
  const R = rounds[Math.min(no, N - 1)];
  const pick = (o: number) => {
    const g = good + (o === R.m ? 1 : 0);
    setGood(g);
    setMsg(o === R.m ? '👏 박수가 터졌어요!' : `🙄 반응이 없어요. 청중은 "${MOODS[R.m].k}"였어요.`);
    report(g / N);
    if (no + 1 >= N) return finish(g / N);
    setNo(no + 1);
  };
  return (
    <>
      <Hud items={[['연설', `${no + 1}/${N}`], ['박수', good]]} />
      <Stage ratio={2} className="mg-hall">
        <div className="mg-crowd">
          {R.crowd.map((m, i) => (
            <span key={i}>{MOODS[m].i}</span>
          ))}
        </div>
        <div className="mg-tip">청중 표정을 보고 가장 많은 기분에 맞는 카드를 골라요</div>
      </Stage>
      <div className="mg-cards">
        {R.opts.map((o) => (
          <button key={o} onClick={() => pick(o)}>
            {MOODS[o].card}
          </button>
        ))}
      </div>
      <p className="small muted">{msg}</p>
    </>
  );
}

/* ── 홍보 포스터 붙이기 ── */
export function RecPoster({ level, seed, report, finish }: MiniProps) {
  const rng = useRng(seed);
  const S = 8;
  const POSTERS = 4;
  const pop = useMemo(() => {
    const spots = Array.from({ length: 4 + Math.round(level) }, () => ({ x: rng.range(0, S), y: rng.range(0, S), w: rng.range(4, 9) }));
    return Array.from({ length: S * S }, (_, i) => {
      const c = i % S;
      const r = Math.floor(i / S);
      return Math.round(spots.reduce((a, s) => a + s.w * Math.exp(-((c - s.x) ** 2 + (r - s.y) ** 2) / 2.5), 0));
    });
  }, [rng, level]);
  const cover = (centers: number[]) => {
    const set = new Set<number>();
    for (const ctr of centers) {
      const c0 = ctr % S;
      const r0 = Math.floor(ctr / S);
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const c = c0 + dx;
          const r = r0 + dy;
          if (c >= 0 && r >= 0 && c < S && r < S) set.add(r * S + c);
        }
    }
    return set;
  };
  const sum = (set: Set<number>) => [...set].reduce((a, i) => a + pop[i], 0);
  const best = useMemo(() => {
    const picks: number[] = [];
    for (let k = 0; k < POSTERS; k++) {
      let b = 0;
      let bv = -1;
      for (let i = 0; i < S * S; i++) {
        const v = sum(cover([...picks, i]));
        if (v > bv) {
          bv = v;
          b = i;
        }
      }
      picks.push(b);
    }
    return sum(cover(picks));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pop]);
  const [posters, setPosters] = useState<number[]>([]);
  const covered = cover(posters);
  const got = sum(covered);
  const sc = clamp01(got / best);
  const done = useRef(false);
  const tap = (i: number) => {
    if (done.current) return;
    if (posters.includes(i)) return setPosters(posters.filter((x) => x !== i));
    if (posters.length >= POSTERS) return;
    const np = [...posters, i];
    setPosters(np);
    report(clamp01(sum(cover(np)) / best));
  };
  return (
    <>
      <Hud items={[['포스터', `${posters.length}/${POSTERS}`], ['보는 사람', got]]} />
      <Stage ratio={1} className="mg-map">
        <div className="mg-grid" style={{ gridTemplateColumns: `repeat(${S}, 1fr)` }}>
          {pop.map((v, i) => (
            <button key={i} className={`mg-cell pop ${covered.has(i) ? 'path' : ''}`} style={{ background: `rgba(239,68,68,${Math.min(0.85, v / 14)})` }} onClick={() => tap(i)}>
              {posters.includes(i) ? '📜' : <small>{v || ''}</small>}
            </button>
          ))}
        </div>
      </Stage>
      <div className="buttons">
        <small className="muted">숫자 = 지나가는 사람(백 명). 포스터를 다시 누르면 떼요.</small>
        <button
          className="primary"
          disabled={posters.length < POSTERS}
          onClick={() => {
            done.current = true;
            finish(sc);
          }}
        >
          다 붙였어요 ({Math.round(sc * 100)}점)
        </button>
      </div>
    </>
  );
}
