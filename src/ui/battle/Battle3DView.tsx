// 3D 전투 화면(⑦): 화면 전체를 덮고, 끝나면 결과를 전투 화면에 넘김.
// variant 'siege' = 3막 공성전: 막마다 전장을 바꿔 새로 띄우고, 살아남은 부대를 다음 막으로 넘긴다(11-26: 막마다 여러 전장 중 돌아가며).
// 그 밖의 variant = 전장 id(fields.ts 큰 전장 · 파병 전장). 'coast' = 시험판 해안 전장.
import { useEffect, useMemo, useRef, useState } from 'react';
import type { FrameProps } from './BattleScreen';
import { outcome } from '../../battle3d/sim';
import { actsFor } from '../../battle3d/stages';
import { actName, budgetOf, navalCp, placeCarried, siegeOutcome, type ActResult, type Carry } from '../../battle3d/siege';
import { useStage } from '../../battle3d/sim';
import { foeHpOf } from '../../battle3d/foeHp';
import { stageFor } from '../../battle3d/pick';
import { isCoastalCity } from '../../data/cities';
import css from '../../battle3d/battle3d.css?raw';

import { DEF, type Kind } from '../../battle3d/sim';

/** 병과 이름별 → 3D 병과별 수(이름이 같은 것만) */
function capsOf(owned: Record<string, number> | undefined, dead: Record<string, number>, carried: Kind[]): Record<string, number> | undefined {
  if (!owned) return undefined;
  const out: Record<string, number> = {};
  for (const [k, d] of Object.entries(DEF)) {
    const n = (owned[d.name] ?? 0) - (dead[d.name] ?? 0) - carried.filter((c) => c === k).length;
    if (n > 0) out[k] = n;
  }
  return out;
}

export function Battle3DView({ spec, onEnd, usBuff, owned }: FrameProps) {
  const siege = spec.variant === 'siege';
  const acts = useMemo(() => (siege ? actsFor(spec.seed, spec.city ? isCoastalCity(spec.city) : undefined) : []), [siege, spec.seed, spec.city]);
  const one = useMemo(() => (siege ? undefined : stageFor(spec)), [siege, spec]);
  const ref = useRef<HTMLDivElement>(null);
  const endRef = useRef(onEnd);
  endRef.current = onEnd;
  const [act, setAct] = useState(0);
  const [between, setBetween] = useState(false);
  const results = useRef<ActResult[]>([]);
  const carry = useRef<Carry | null>(null);
  const foeHp = spec.variant === 'coast' ? 1 : foeHpOf(spec.difficulty);

  useEffect(() => {
    if (between) return;
    let off: (() => void) | null = null;
    let gone = false;
    // three.js·모형은 이 전투를 열 때만 불러옴
    void import('../../battle3d/view').then(({ mountBattle3D }) => {
      if (gone || !ref.current) return;
      const stage = siege ? acts[act] : one;
      if (stage) useStage(stage);
      const c = carry.current;
      // 앞 막에서 쓰러진 부대 · 넘어온 부대는 새로 못 냄
      const prevDead: Record<string, number> = {};
      for (const r of results.current.slice(0, act)) for (const [k, v] of Object.entries(r.dead ?? {})) prevDead[k] = (prevDead[k] ?? 0) + v;
      off = mountBattle3D(ref.current, {
        stage,
        owned: capsOf(owned, prevDead, siege && act > 0 && c ? c.units.map((u) => u.kind) : []),
        foeHp,
        // 11-26 안 6: 3D 훈련으로 쌓은 병과 숙련(최대 +10%)
        usBuff: usBuff as Record<string, number> | undefined,
        budget: siege ? budgetOf(act, acts[act]) : undefined,
        preset: siege && act > 0 && c ? placeCarried(c) : undefined,
        cp0: siege && act > 0 && c ? navalCp(c) : undefined,
        naval: c?.naval ?? 0,
        actLabel: siege ? actName(acts, act) : undefined,
        endLabel: siege && act < 2 ? '다음 막으로' : '결과 보기',
        onEnd: (r) => {
          if (!siege) { endRef.current(outcome(r)); return; }
          const ar: ActResult = { win: r.win, timeout: r.timeout, t: r.t, lost: r.lost, total: r.total, carried: (r as { carried?: number }).carried ?? 0, dead: r.dead };
          results.current = [...results.current.slice(0, act), ar];
          if (r.win && act < 2) { carry.current = r.carry as Carry; setBetween(true); return; }
          endRef.current(siegeOutcome(results.current, acts));
        },
        onQuit: () => endRef.current(siege ? { ...siegeOutcome(results.current, acts), win: false, stars: 0, text: '공성전을 그만뒀어요.' } : { win: false, stars: 0, text: '작전을 그만뒀어요.' }),
      });
    });
    return () => {
      gone = true;
      off?.();
    };
  }, [act, between, siege, foeHp, acts, one]);

  const c = carry.current;
  const avg = c && c.units.length ? Math.round(c.units.reduce((s, u) => s + u.hp, 0) / c.units.length * 100) : 0;
  return (
    <div className="b3d-wrap">
      <style>{css}</style>
      {between ? (
        <div className="b3d-between" key="between">
          <div className="b3d-between-box">
            <p className="b3d-between-tag">{actName(acts, act)} 승리</p>
            <h2>{actName(acts, act + 1)}</h2>
            <p>{acts[act + 1]?.desc}</p>
            <ul>
              <li>살아남은 부대 {c?.units.length ?? 0}개가 그대로 이어서 싸워요(평균 체력 {avg}%).</li>
              <li>살아남은 배 {c?.naval ?? 0}척이 바다에서 도와요 · 시작 지휘력 {c ? navalCp(c) : 3}</li>
              <li>보충 예산 {budgetOf(act + 1)}으로 새 부대를 더할 수 있어요.</li>
            </ul>
            <button type="button" className="b3d-between-go" onClick={() => { setAct(act + 1); setBetween(false); }}>
              {actName(acts, act + 1)} 시작
            </button>
          </div>
        </div>
      ) : (
        <div className="b3d" key={`act${act}`} ref={ref} />
      )}
    </div>
  );
}
