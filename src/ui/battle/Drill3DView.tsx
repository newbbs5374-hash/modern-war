// 3D 훈련 화면(11-26 안 1·2·3·5): 훈련 실전(d3-*) · 명령 사격장(c3-*) · 배치 퍼즐(p3) · 주간 합동(w3:주).
// 3D 전투 화면(view.ts)을 훈련 전장으로 띄우고, 끝나면 점수 → 별로 바꿔 넘김.
import { useEffect, useRef, useState } from 'react';
import type { FrameProps } from './BattleScreen';
import { drillById, drillStage } from '../../battle3d/drills';
import { PUZZLES, puzzleStage, puzzleStars, type Puzzle } from '../../battle3d/puzzles';
import { COAST, DEF, outcome, useStage, type Sim } from '../../battle3d/sim';
import { usedKinds, weekInfo } from '../../battle3d/train3d';
import { miniOutcome } from '../../battle/minigames';
import css from '../../battle3d/battle3d.css?raw';

const starStr = (n: number) => '★'.repeat(n) + '☆'.repeat(3 - n);

export function Drill3DView({ spec, onEnd, usBuff, puzzleStars: got = {} }: FrameProps) {
  const v = spec.variant;
  const isPuzzle = v === 'p3';
  const [pz, setPz] = useState<Puzzle | null>(null);
  const [sel, setSel] = useState<Puzzle | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const endRef = useRef(onEnd);
  endRef.current = onEnd;

  useEffect(() => {
    if (isPuzzle && !pz) return;
    let off: (() => void) | null = null;
    let gone = false;
    void import('../../battle3d/view').then(({ mountBattle3D }) => {
      if (gone || !ref.current) return;
      const buff = usBuff as Record<string, number> | undefined;
      const quit = () => endRef.current({ win: false, stars: 0, text: '훈련을 그만뒀어요.' });
      if (pz) {
        const st = puzzleStage(pz);
        useStage(st);
        off = mountBattle3D(ref.current, {
          stage: st, preset: [], budget: pz.budget, cp0: 0, usBuff: buff, actLabel: pz.title, endLabel: '결과 보기',
          bar: (S) => { const h = (S as Sim).units.find((u) => u.kind === 'hq'); return { label: '적 지휘소', pct: h ? (h.hp / h.max) * 100 : 0, txt: h ? `${Math.round((h.hp / h.max) * 100)}%` : '' }; },
          endText: (S, win) => { const s = S as Sim; const n = puzzleStars(pz, s, spent(s)); return win ? `${starStr(n)} · 쓴 예산 ${spent(s)} (★2: ${pz.parCost} 이하 · ★3: ${pz.parT}초 안에)` : '지휘소를 못 부쉈어요. 조합을 바꿔 봐요.'; },
          onEnd: (r) => {
            const S = (r.sim as Sim);
            const n = puzzleStars(pz, S, spent(S));
            endRef.current({ win: n > 0, stars: n, text: `${pz.title} ${n ? starStr(n) : '실패'} · 예산 ${spent(S)}/${pz.budget}`, drill: { kinds: usedKinds(S), puzzle: { n: pz.n, stars: n } } });
          },
          onQuit: quit,
        });
        return;
      }
      if (v.startsWith('w3')) {
        const w = weekInfo(Number(v.split(':')[1] ?? 0));
        useStage(w.stage);
        off = mountBattle3D(ref.current, {
          stage: w.stage, usBuff: buff, actLabel: w.name, endLabel: '결과 보기',
          onEnd: (r) => endRef.current({ ...outcome(r), drill: { kinds: usedKinds((r.sim as Sim)), weekly: w.week } }),
          onQuit: quit,
        });
        return;
      }
      const d = drillById(v);
      if (!d) { quit(); return; }
      const st = drillStage(d, spec.seed);
      useStage(st);
      off = mountBattle3D(ref.current, {
        stage: st, preset: d.preset, lockDeploy: d.lock, budget: d.budget, cp0: d.cp0, usBuff: buff, actLabel: d.name, endLabel: '결과 보기',
        onTap: d.tap as never, bar: d.bar as never,
        endText: (S, win) => d.endText?.(S as Sim, win) ?? `점수 ${Math.round(d.score(S as Sim) * 100)}점`,
        onEnd: (r) => {
          const S = (r.sim as Sim);
          endRef.current({ ...miniOutcome(d.score(S), d.name), drill: { kinds: (d.kinds as string[] | undefined) ?? usedKinds(S) } });
        },
        onQuit: quit,
      });
    });
    return () => {
      gone = true;
      off?.();
      useStage(COAST);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pz, v]);

  if (isPuzzle && !pz) {
    const open = (n: number) => n === 1 || (got[n - 1] ?? 0) > 0;
    return (
      <div className="d3-pick">
        <p className="small muted">판을 고르세요. 앞 판을 깨면 다음 판이 열려요. 같은 배치면 늘 같은 결과예요.</p>
        <div className="d3-grid">
          {PUZZLES.map((p) => (
            <button key={p.n} type="button" disabled={!open(p.n)} className={`${got[p.n] ? 'done' : ''} ${sel?.n === p.n ? 'on' : ''}`} onClick={() => setSel(p)}>
              <b>{p.n}</b>
              <small className="stars">{open(p.n) ? starStr(got[p.n] ?? 0) : '🔒'}</small>
            </button>
          ))}
        </div>
        {sel && (
          <div className="d3-detail">
            <b>{sel.title}</b>
            <p className="small">💡 {sel.hint}</p>
            <div className="kv2">
              <span>예산</span>
              <b>{sel.budget}</b>
              <span>쓸 수 있는 부대</span>
              <b>{sel.kinds.map((k) => DEF[k].name).join(' · ')}</b>
              <span>★2 · ★3</span>
              <b>예산 {sel.parCost} 이하 · {sel.parT}초 안에</b>
            </div>
            <button type="button" className="primary wide" onClick={() => setPz(sel)}>▶ {sel.n}판 시작</button>
          </div>
        )}
        <p className="small muted">★1 이기기 · ★2 기준 예산 이하로 · ★3 거기에 기준 시간 안에</p>
      </div>
    );
  }
  return (
    <div className="b3d-wrap">
      <style>{css}</style>
      <div className="b3d" ref={ref} />
    </div>
  );
}

const spent = (S: Sim) => S.units.filter((u) => u.side === 'us' && u.kind !== 'cvjet').reduce((s, u) => s + DEF[u.kind].cost, 0);
