// 3D 전투 화면(⑦): 화면 전체를 덮고, 끝나면 결과를 전투 화면에 넘김.
// variant 'siege' = 3막 공성전: 막마다 전장을 바꿔 새로 띄우고, 살아남은 부대를 다음 막으로 넘긴다.
import { useEffect, useRef, useState } from 'react';
import type { FrameProps } from './BattleScreen';
import { outcome } from '../../battle3d/sim';
import { ACTS } from '../../battle3d/stages';
import { budgetOf, navalCp, placeCarried, siegeOutcome, type ActResult, type Carry } from '../../battle3d/siege';
import { useStage } from '../../battle3d/sim';
import { foeHpOf } from '../../battle3d/foeHp';
import css from '../../battle3d/battle3d.css?raw';


const NEXT_TEXT = [
  '',
  '건물 사이 거리에서 싸워요. 거점 4곳(기차역 앞·시장 사거리·방송국 광장·구청 앞)에 우리 땅 부대만 서 있으면 조금씩 차지해요. 적이 거점을 쥐고 있는 동안 30초마다 증원이 와요. 건물에 붙은 부대는 덜 맞아요.',
  '도심 한가운데 광장에 적 지휘소가 있어요. 지휘소를 부수면 끝이 아니에요. 최후 저항 부대가 양옆과 뒤에서 두 번 몰려와요. 모두 막아 내면 도시를 차지해요.',
];

export function Battle3DView({ spec, onEnd, usBuff }: FrameProps) {
  const siege = spec.variant === 'siege';
  const ref = useRef<HTMLDivElement>(null);
  const endRef = useRef(onEnd);
  endRef.current = onEnd;
  const [act, setAct] = useState(0);
  const [between, setBetween] = useState(false);
  const results = useRef<ActResult[]>([]);
  const carry = useRef<Carry | null>(null);
  const foeHp = siege ? foeHpOf(spec.difficulty) : 1;

  useEffect(() => {
    if (between) return;
    let off: (() => void) | null = null;
    let gone = false;
    // three.js·모형은 이 전투를 열 때만 불러옴
    void import('../../battle3d/view').then(({ mountBattle3D }) => {
      if (gone || !ref.current) return;
      const stage = siege ? ACTS[act] : undefined;
      if (stage) useStage(stage);
      const c = carry.current;
      off = mountBattle3D(ref.current, {
        stage,
        foeHp,
        // 11-26 안 6: 3D 훈련으로 쌓은 병과 숙련(최대 +10%)
        usBuff: usBuff as Record<string, number> | undefined,
        budget: siege ? budgetOf(act) : undefined,
        preset: siege && act > 0 && c ? placeCarried(c) : undefined,
        cp0: siege && act > 0 && c ? navalCp(c) : undefined,
        naval: c?.naval ?? 0,
        actLabel: siege ? ACTS[act].name : undefined,
        endLabel: siege && act < 2 ? '다음 막으로' : '결과 보기',
        onEnd: (r) => {
          if (!siege) { endRef.current(outcome(r)); return; }
          const ar: ActResult = { win: r.win, timeout: r.timeout, t: r.t, lost: r.lost, total: r.total, carried: (r as { carried?: number }).carried ?? 0 };
          results.current = [...results.current.slice(0, act), ar];
          if (r.win && act < 2) { carry.current = r.carry as Carry; setBetween(true); return; }
          endRef.current(siegeOutcome(results.current));
        },
        onQuit: () => endRef.current(siege ? { ...siegeOutcome(results.current), win: false, stars: 0, text: '공성전을 그만뒀어요.' } : { win: false, stars: 0, text: '작전을 그만뒀어요.' }),
      });
    });
    return () => {
      gone = true;
      off?.();
    };
  }, [act, between, siege, foeHp]);

  const c = carry.current;
  const avg = c && c.units.length ? Math.round(c.units.reduce((s, u) => s + u.hp, 0) / c.units.length * 100) : 0;
  return (
    <div className="b3d-wrap">
      <style>{css}</style>
      {between ? (
        <div className="b3d-between" key="between">
          <div className="b3d-between-box">
            <p className="b3d-between-tag">{ACTS[act].name} 승리</p>
            <h2>{ACTS[act + 1].name}</h2>
            <p>{NEXT_TEXT[act + 1]}</p>
            <ul>
              <li>살아남은 부대 {c?.units.length ?? 0}개가 그대로 이어서 싸워요(평균 체력 {avg}%).</li>
              <li>살아남은 배 {c?.naval ?? 0}척이 바다에서 도와요 · 시작 지휘력 {c ? navalCp(c) : 3}</li>
              <li>보충 예산 {budgetOf(act + 1)}으로 새 부대를 더할 수 있어요.</li>
            </ul>
            <button type="button" className="b3d-between-go" onClick={() => { setAct(act + 1); setBetween(false); }}>
              {ACTS[act + 1].name} 시작
            </button>
          </div>
        </div>
      ) : (
        <div className="b3d" key={`act${act}`} ref={ref} />
      )}
    </div>
  );
}
