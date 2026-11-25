// 정보 훈련 미니게임 3개
import { useMemo, useRef, useState } from 'react';
import { CIPHER_WORDS, cipherOk, cipherRead, makeCipher } from '../../../battle/miniLogic';
import { Hud, Stage, clamp01, pctOf, useRng, type MiniProps } from './kit';

/* ── 위성 사진 비교 ── */
const THINGS = ['🌲', '🌳', '🏠', '🏚️', '⛺', '🛢️', '🚛', '🪨', '🏭'];
const SECRET = ['🛡️', '🚀', '🚁', '📡', '🚛', '⛺'];
export function IntelDiff({ level, seed, report, finish }: MiniProps) {
  const rng = useRng(seed);
  const DIFF = 5;
  const scene = useMemo(() => {
    const base: Array<{ x: number; y: number; k: string }> = [];
    while (base.length < 18 + Math.round(level * 4)) {
      const x = rng.range(6, 94);
      const y = rng.range(8, 92);
      if (base.some((b) => Math.hypot(b.x - x, (b.y - y) * 0.6) < 9)) continue;
      base.push({ x, y, k: rng.pick(THINGS) });
    }
    const today = base.map((b) => ({ ...b }));
    const diffs: Array<{ x: number; y: number }> = [];
    let guard = 0;
    while (diffs.length < DIFF && guard++ < 200) {
      const kind = rng.next();
      if (kind < 0.4) {
        // 새로 생김
        const x = rng.range(6, 94);
        const y = rng.range(8, 92);
        if (today.some((b) => Math.hypot(b.x - x, (b.y - y) * 0.6) < 9)) continue;
        today.push({ x, y, k: rng.pick(SECRET) });
        diffs.push({ x, y });
      } else {
        const i = Math.floor(rng.next() * base.length);
        if (diffs.some((d) => d.x === base[i].x)) continue;
        if (kind < 0.7) today[i].k = '';
        else today[i].k = rng.pick(SECRET.filter((s) => s !== base[i].k));
        diffs.push({ x: base[i].x, y: base[i].y });
      }
    }
    return { base, today, diffs };
  }, [rng, level]);
  const [found, setFound] = useState<number[]>([]);
  const [wrong, setWrong] = useState(0);
  const stage = useRef<HTMLDivElement>(null);
  const sc = (f: number, w: number) => clamp01(f / DIFF - w * 0.05);
  const tap = (e: React.PointerEvent) => {
    const p = pctOf(e, stage.current);
    const i = scene.diffs.findIndex((d, k) => !found.includes(k) && Math.hypot(d.x - p.x, (d.y - p.y) * 0.62) < 7);
    if (i < 0) {
      setWrong(wrong + 1);
      report(sc(found.length, wrong + 1));
      return;
    }
    const nf = [...found, i];
    setFound(nf);
    report(sc(nf.length, wrong));
    if (nf.length >= DIFF) finish(sc(nf.length, wrong));
  };
  const Pic = ({ list, label }: { list: typeof scene.base; label: string }) => (
    <>
      {list.map((b, i) =>
        b.k ? (
          <div key={i} className="mg-at" style={{ left: `${b.x}%`, top: `${b.y}%`, fontSize: 15 }}>
            {b.k}
          </div>
        ) : null,
      )}
      <div className="mg-label">{label}</div>
    </>
  );
  return (
    <>
      <Hud items={[['찾음', `${found.length}/${DIFF}`], ['헛짚음', wrong]]} />
      <Stage ratio={1.9} className="mg-sat">
        <Pic list={scene.base} label="어제" />
      </Stage>
      <Stage ratio={1.9} className="mg-sat" stageRef={stage} onPointerDown={tap}>
        <Pic list={scene.today} label="오늘 · 여기서 눌러요" />
        {found.map((k) => (
          <div key={k} className="mg-ring" style={{ left: `${scene.diffs[k].x}%`, top: `${scene.diffs[k].y}%` }} />
        ))}
      </Stage>
    </>
  );
}

/* ── 암호 풀기 ── */
export function IntelCipher({ seed, report, finish }: MiniProps) {
  const rng = useRng(seed);
  const N = 4;
  const msgs = useMemo(() => Array.from({ length: N }, () => makeCipher(rng)), [rng]);
  const [no, setNo] = useState(0);
  const [k, setK] = useState(0);
  const [miss, setMiss] = useState(0);
  const [ok, setOk] = useState(0);
  const [msg, setMsg] = useState('');
  const m = msgs[Math.min(no, N - 1)];
  const read = cipherRead(m.nums, k);
  const decode = () => {
    if (cipherOk(m.nums, k)) {
      const n = ok + 1;
      setOk(n);
      setMsg(`해독: "${read.join(' ')}"`);
      const sc = clamp01(n / N - miss * 0.08);
      report(sc);
      if (no + 1 >= N) return finish(sc);
      setNo(no + 1);
      setK(0);
    } else {
      setMiss(miss + 1);
      setMsg('뜻이 통하지 않아요. 때 → 방향 → 행동 순서가 되게 돌려요.');
      report(clamp01(ok / N - (miss + 1) * 0.08));
    }
  };
  return (
    <>
      <Hud items={[['전문', `${no + 1}/${N}`], ['틀림', miss]]} />
      <Stage ratio={1.3} className="mg-paper">
        <div className="mg-center">
          <div className="mg-cipher">
            {m.nums.map((n, i) => (
              <span key={i}>
                <small>{n}</small>
                <b>{read[i]}</b>
              </span>
            ))}
          </div>
          <div className="mg-wheel">
            {CIPHER_WORDS.map((w, i) => (
              <span key={i} style={{ transform: `rotate(${i * 36}deg) translateY(-62px) rotate(${-i * 36}deg)` }}>
                <small>{(i - k + 10) % 10}</small>
                {w}
              </span>
            ))}
          </div>
        </div>
      </Stage>
      <p className="small muted">{msg || '때(새벽·정오·한밤) → 방향(북·남·동·서) → 행동(공격·후퇴·집결)'}</p>
      <div className="buttons">
        <button onClick={() => setK((k + 9) % 10)}>↺ 돌리기</button>
        <button className="primary" onClick={decode}>
          🔓 해독
        </button>
        <button onClick={() => setK((k + 1) % 10)}>돌리기 ↻</button>
      </div>
    </>
  );
}

/* ── 단서 잇기 ── */
const CLUES: Array<[string, string]> = [
  ['📻 "연료 트럭 30대 이동"', '곧 큰 공격'],
  ['📷 강가에 다리 부품', '강을 건널 준비'],
  ['📻 "병원 침대 비워라"', '많은 부상자 예상'],
  ['📷 비행장에 전투기 2배', '공중 공격 준비'],
  ['📻 무전이 갑자기 끊김', '공격 직전 침묵'],
  ['📷 참호를 새로 팜', '방어로 돌아섬'],
  ['📻 "지도 북쪽 장 더 보내"', '북쪽으로 진격'],
  ['📷 항구에 상륙정', '바다로 상륙'],
  ['📻 "겨울 옷 보급"', '오래 머무를 생각'],
  ['📷 미끼 풍선 전차', '속임수 부대'],
  ['📻 "장군 전선 방문"', '중요한 작전 임박'],
  ['📷 철도에 빈 화차', '부대 철수 준비'],
];
export function IntelLink({ seed, report, finish }: MiniProps) {
  const rng = useRng(seed);
  const ROUNDS = 3;
  const PER = 4;
  const rounds = useMemo(() => {
    const idx = CLUES.map((_, i) => i).sort(() => rng.next() - 0.5);
    return Array.from({ length: ROUNDS }, (_, r) => {
      const pick = idx.slice(r * PER, r * PER + PER);
      return { left: pick, right: [...pick].sort(() => rng.next() - 0.5) };
    });
  }, [rng]);
  const [no, setNo] = useState(0);
  const [sel, setSel] = useState<number | null>(null);
  const [done, setDone] = useState<number[]>([]);
  const [wrong, setWrong] = useState(0);
  const good = useRef(0);
  const R = rounds[Math.min(no, ROUNDS - 1)];
  const sc = (g: number, w: number) => clamp01(g / (ROUNDS * PER) - w * 0.05);
  const pickRight = (j: number) => {
    if (sel === null || done.includes(j)) return;
    if (sel === j) {
      good.current++;
      const nd = [...done, j];
      setDone(nd);
      setSel(null);
      report(sc(good.current, wrong));
      if (nd.length >= PER) {
        if (no + 1 >= ROUNDS) return finish(sc(good.current, wrong));
        setTimeout(() => {
          setNo(no + 1);
          setDone([]);
        }, 400);
      }
    } else {
      setWrong(wrong + 1);
      setSel(null);
      report(sc(good.current, wrong + 1));
    }
  };
  return (
    <>
      <Hud items={[['판', `${no + 1}/${ROUNDS}`], ['틀림', wrong]]} />
      <div className="mg-link">
        <div>
          {R.left.map((i) => (
            <button key={i} className={`${sel === i ? 'on' : ''} ${done.includes(i) ? 'done' : ''}`} disabled={done.includes(i)} onClick={() => setSel(i)}>
              {CLUES[i][0]}
            </button>
          ))}
        </div>
        <div>
          {R.right.map((j) => (
            <button key={j} className={done.includes(j) ? 'done' : ''} disabled={done.includes(j)} onClick={() => pickRight(j)}>
              {CLUES[j][1]}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
