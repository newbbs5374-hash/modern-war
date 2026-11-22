// 부대 화면: 1차 육군·해군·공군 → 2차 세부 병과(보병·특수전…). 병과마다 보유량 · 모집 · 가속.
import { useState } from 'react';
import { FORCE_BRANCHES, UNITS } from '../data/catalog';
import { RANKS } from '../data/ranks';
import { countryById } from '../data/world';
import { canProduce, produce, buildMs, QUEUE_MAX } from '../game/economy';
import { boostsOf, boostsToFinish, useBoost } from '../game/boost';
import { fmt } from './common';
import { UNIT_ICON } from './icons';
import { Chip, Help, Meter, useTab } from './kit';
import { UnitModal } from './economyScreens';
import { timeLeft } from './officerScreens';
import type { ScreenProps } from './screens';

type Branch = (typeof FORCE_BRANCHES)[number]['id'];

export function ForcesScreen(props: ScreenProps) {
  const { state, actions } = props;
  const me = countryById(state.player.countryId);
  const rank = state.player.rankIndex;
  const e = state.economy;
  const [tab, setTab] = useTab<Branch>('forces', '육');
  const [pick, setPick] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  const branch = FORCE_BRANCHES.find((b) => b.id === tab)!;
  const specialBase = me.specialUnit.base;
  const count = (b: (typeof FORCE_BRANCHES)[number]) =>
    b.groups.flatMap((g) => g.units).reduce((a, u) => a + (e.army[u] ?? 0) + (u === specialBase ? (e.army[me.specialUnit.name] ?? 0) : 0), 0);

  const row = (unit: string, special: boolean) => {
    const info = UNITS.find((u) => u.name === unit)!;
    const label = special ? me.specialUnit.name : unit;
    const lock = rank < info.rank;
    const have = e.army[label] ?? 0;
    const mine = e.queue.filter((q) => q.unit === unit && q.special === special);
    const first = mine[0];
    const running = first && state.worldMs >= first.startMs;
    const why = canProduce(state, unit, special);
    const need = first ? boostsToFinish(state, { kind: 'queue', id: first.id }) : 0;
    return (
      <div key={label} className={`frow ${lock ? 'locked' : ''} ${special ? 't-gold' : ''}`}>
        <button className="frow-main" onClick={() => setPick(special ? '★' : unit)}>
          <span className="frow-ico">{lock ? '🔒' : special ? '🌟' : UNIT_ICON[unit]}</span>
          <span className="frow-text">
            <b>{label}</b>
            {lock ? (
              <small className="muted">{RANKS[info.rank].name}부터</small>
            ) : first ? (
              <span className="frow-prog">
                <Meter value={running ? state.worldMs - first.startMs : 0} max={first.endMs - first.startMs} tone="blue" />
                <small className="muted">
                  {running ? timeLeft(first.endMs - state.worldMs) : '대기'}
                  {mine.length > 1 ? ` +${mine.length - 1}` : ''}
                </small>
              </span>
            ) : (
              <small className="muted">{special ? me.specialUnit.effect : info.role}</small>
            )}
          </span>
          <span className="frow-have">
            <b>{have}</b>
            <small>보유</small>
          </span>
        </button>
        {!lock && (
          <span className="frow-btns">
            <button
              className="primary"
              disabled={!!why}
              title={why ?? `모집 ${timeLeft(buildMs(state, unit, special))}`}
              onClick={() => {
                actions.apply((s) => produce(s, unit, special));
                setMsg(`${label} 모집 시작! ${timeLeft(buildMs(state, unit, special))} 뒤 완료`);
              }}
            >
              모집
            </button>
            <button
              className="gold"
              disabled={!first || boostsOf(state) < 1}
              title={first ? `가속권 ${need}장으로 바로 끝내기` : '모집 중일 때 쓸 수 있어요'}
              onClick={() => first && actions.apply((s) => useBoost(s, { kind: 'queue', id: first.id }, Math.min(need, boostsOf(s))))}
            >
              ⚡{first ? <small>🎫{need}</small> : null}
            </button>
          </span>
        )}
      </div>
    );
  };

  return (
    <>
      <section className="card">
        <div className="row">
          <div className="ichips">
            <Chip icon="🪖" value={fmt(state.nations[me.id].troops)} label="병력" />
            <Chip icon="💪" value={e.power} label="전투력" />
            <Chip icon="🔨" value={`${e.queue.length}/${QUEUE_MAX}`} label="모집 줄" />
          </div>
          <Help title="부대">
            <p>병과 15개와 우리 나라 특별 병과(🌟)를 육군·해군·공군으로 나눴어요. 병과는 계급이 오르면 하나씩 열려요.</p>
            <p>
              <b>모집</b>: 국방예산과 전략 자원을 써서 1부대를 모아요. 한 번에 {QUEUE_MAX}개까지 줄을 세울 수 있고, 차례대로 완성돼요.
            </p>
            <p>
              <b>⚡ 가속</b>: 가속권으로 모집 중인 부대를 바로 끝내요(1장 = 30분).
            </p>
            <p>모은 부대는 병력·전투력이 되고, 전투력이 높으면 대전투가 쉬워지고 점령지를 잘 지켜요. 병과를 누르면 비용과 자세한 정보를 봐요.</p>
          </Help>
        </div>
        {msg && <p className="small result">{msg}</p>}
      </section>
      <div className="seg branch-tabs">
        {FORCE_BRANCHES.map((b) => (
          <button key={b.id} className={tab === b.id ? 'on' : ''} onClick={() => (setMsg(''), setTab(b.id))}>
            {b.icon} {b.name} <small>{count(b)}</small>
          </button>
        ))}
      </div>
      {branch.groups.map((g) => (
        <div key={g.name} className="fgroup">
          <small className="stat-group-name">
            {g.icon} {g.name}
          </small>
          {g.units.flatMap((u) => (u === specialBase ? [row(u, false), row(u, true)] : [row(u, false)]))}
        </div>
      ))}
      {pick && <UnitModal {...props} unit={pick} onClose={() => setPick(null)} />}
    </>
  );
}
