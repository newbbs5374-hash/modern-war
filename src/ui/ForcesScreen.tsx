// 부대 화면: 1차 육군·해군·공군 → 2차 세부 병과(보병·특수전…). 병과마다 보유량 · 모집 · 가속.
import { useState } from 'react';
import { FORCE_BRANCHES, UNITS } from '../data/catalog';
import { RANKS } from '../data/ranks';
import { countryById } from '../data/world';
import { canProduce, produce, buildMs, QUEUE_MAX, queueName, crystalReady } from '../game/economy';
import { exclusiveByName, exclusiveLock, specialsFor, specialsOf, type SpecialDef } from '../data/specials';
import { unitTechLock } from '../game/civ';
import { boostPrice, boostsAffordable, boostsToFinish, useBoost } from '../game/boost';
import { priceText } from './BoostBar';
import { fmt } from './common';
import { UnitIcon } from './iconArt';
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
  const mySp = specialsOf(me.id);
  const count = (b: (typeof FORCE_BRANCHES)[number]) =>
    b.groups.flatMap((g) => g.units).reduce((a, u) => a + (e.army[u] ?? 0) + specialsFor(me.id, u).reduce((x, d) => x + (e.army[d.name] ?? 0), 0), 0);

  const row = (unit: string, sp?: SpecialDef) => {
    const info = UNITS.find((u) => u.name === unit)!;
    const special = !!sp;
    const label = sp ? sp.name : unit;
    const exLock = exclusiveLock(me.id, unit);
    const ex = exclusiveByName(unit);
    const lock = rank < info.rank || !!exLock;
    const techLock = !lock ? unitTechLock(state, unit) : null;
    const have = e.army[label] ?? 0;
    const mine = e.queue.filter((q) => q.unit === unit && queueName(state, q) === label);
    const first = mine[0];
    const running = first && state.worldMs >= first.startMs;
    const why = canProduce(state, unit, sp?.id);
    const need = first ? boostsToFinish(state, { kind: 'queue', id: first.id }) : 0;
    return (
      <div key={label} className={`frow ${lock ? 'locked' : ''} ${special || (ex && !exLock) ? 't-gold' : ''}`}>
        <button className="frow-main" onClick={() => setPick(sp ? `${unit}|${sp.id}` : unit)}>
          <span className="frow-ico"><UnitIcon unit={unit} sp={sp?.id} lock={lock} /></span>
          <span className="frow-text">
            <b>
              {label}
              {sp && <small className="muted"> · {unit} 특화</small>}
            </b>
            {exLock ? (
              <small className="muted">👑 {exLock}</small>
            ) : lock ? (
              <small className="muted">{RANKS[info.rank].name}부터</small>
            ) : techLock && !first ? (
              <small className="muted">🔬 {techLock}</small>
            ) : first ? (
              <span className="frow-prog">
                <Meter value={running ? state.worldMs - first.startMs : 0} max={first.endMs - first.startMs} tone="blue" />
                <small className="muted">
                  {running ? timeLeft(first.endMs - state.worldMs) : '대기'}
                  {mine.length > 1 ? ` +${mine.length - 1}` : ''}
                </small>
              </span>
            ) : (
              <small className="muted">
                {sp ? sp.effect : info.role}
                {sp && crystalReady(state) ? ' · 🧪갈륨 개량형으로 만듦' : ''}
              </small>
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
              title={why ?? `모집 ${timeLeft(buildMs(state, unit, sp?.id))}`}
              onClick={() => {
                actions.apply((s) => produce(s, unit, sp?.id));
                setMsg(`${label} 모집 시작! ${timeLeft(buildMs(state, unit, sp?.id))} 뒤 완료`);
              }}
            >
              모집
            </button>
            <button
              className="gold"
              disabled={!first || boostsAffordable(state) < 1}
              title={first ? (boostsAffordable(state) < need ? `가속권·루비가 모자라 할 수 있는 만큼만 줄여요` : `가속권 ${need}장(모자라면 루비)으로 바로 끝내기`) : '모집 중일 때 쓸 수 있어요'}
              onClick={() => first && actions.apply((s) => useBoost(s, { kind: 'queue', id: first.id }, need))}
            >
              ⚡{first ? <small>{priceText(boostPrice(state, need))}</small> : null}
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
            <p>병과 15개와 우리 나라 특화 유닛 2개(🌟), 몇 나라만 만드는 독점 병과(👑)를 육군·해군·공군으로 나눴어요. 병과는 호칭과 연구가 다 되면 열려요.</p>
            <p>
              <b>🌟 특화 유닛</b>: 바탕 병과와 같은 때 열리고, 바탕 병과도 계속 만들 수 있어요. 조금 비싸지만 더 세고 고유 능력이 지도 위 전투에서 실제로 작동해요. 🔬국가 비밀 병기 연구 = 특화 유닛 +15%, 💎갈륨 레이더 연구 뒤엔 갈륨 1을 더 써서 갈륨 개량형(+15%)이 돼요.
            </p>
            <p>
              <b>모집</b>: 국방예산과 전략 자원을 써서 1부대를 모아요. 한 번에 {QUEUE_MAX}개까지 줄을 세울 수 있고, 차례대로 완성돼요.
            </p>
            <p>
              <b>⚡ 가속</b>: 가속권으로 모집 중인 부대를 바로 끝내요(1장 = 30분).
            </p>
            <p>위 <b>모집 줄</b>에서 차례와 남은 시간을 보고 하나씩 가속할 수 있어요. 인프라 시설(🚆철도망·⚓군항·🛫공군기지)을 올리면 모집이 빨라져요.</p>
            <p>모은 부대는 병력·전투력이 되고, 전투력이 높으면 대전투가 쉬워지고 점령지를 잘 지켜요. 병과를 누르면 비용과 자세한 정보를 봐요.</p>
          </Help>
        </div>
        {/* 11-25 대장 요청: 모집 줄은 늘 {QUEUE_MAX}칸 자리를 차지해 화면이 위아래로 흔들리지 않게 고정 */}
        <div className="queue-slots">
          {Array.from({ length: QUEUE_MAX }, (_, i) => {
            const q = e.queue[i];
            if (!q) return <div key={`empty-${i}`} className="qslot empty"><small>빈 칸</small></div>;
            const name = queueName(state, q);
            const run = state.worldMs >= q.startMs;
            const need = boostsToFinish(state, { kind: 'queue', id: q.id });
            return (
              <div key={q.id} className={`qslot ${run ? 'run' : ''}`} title={name}>
                <span className="qslot-top">
                  <span className="queue-ico">
                    <UnitIcon unit={q.unit} sp={q.sp} fallback={q.special || q.sp ? '🌟' : undefined} />
                  </span>
                  <small>{run ? timeLeft(q.endMs - state.worldMs) : `대기 ${i}`}</small>
                </span>
                <Meter value={run ? state.worldMs - q.startMs : 0} max={q.endMs - q.startMs} tone="blue" />
                <button
                  className="gold qslot-boost"
                  disabled={need < 1 || boostsAffordable(state) < 1}
                  title={`${name} · 가속권 ${need}장(모자라면 루비)으로 바로 끝내기`}
                  onClick={() => actions.apply((s) => useBoost(s, { kind: 'queue', id: q.id }, need))}
                >
                  ⚡<small>{priceText(boostPrice(state, need))}</small>
                </button>
              </div>
            );
          })}
        </div>
        <p className="small forces-msg">{msg || <span className="muted">모집을 누르면 위 줄에 차례로 서요</span>}</p>
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
          {g.units.flatMap((u) => [row(u), ...mySp.filter((d) => d.base === u).map((d) => row(u, d))])}
        </div>
      ))}
      {pick && <UnitModal {...props} unit={pick} onClose={() => setPick(null)} />}
    </>
  );
}
