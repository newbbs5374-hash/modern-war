// 6단계 화면: 내정 시설 · 전략 자원 · 병과 생산 · 무역 (나라 화면 안)
import { useState } from 'react';
import { UNITS } from '../data/catalog';
import { CHORE_EXP, ECON_RANK, FACILITIES, FACILITY_EFF, FACILITY_TEXT, RESOURCES, RES_ICON, SELL_RATE, TOP_RANK, UNIT_COST, specialCost, type Res, type UnitCost } from '../data/economy';
import { RANKS } from '../data/ranks';
import { countryById } from '../data/world';
import {
  QUEUE_MAX,
  buildMs,
  canChore,
  canProduce,
  canTrade,
  canUpgrade,
  claimChore,
  maxLevel,
  produce,
  producesOf,
  resPerDay,
  startChore,
  trade,
  tradePartners,
  tradePrice,
  upgradeCost,
  upgradeFacility,
} from '../game/economy';
import { relationOf } from '../game/world';
import { Card, fmt } from './common';
import { timeLeft } from './officerScreens';
import type { ScreenProps } from './screens';

const resText = (r: Partial<Record<Res, number>>) =>
  Object.entries(r)
    .map(([k, v]) => `${RES_ICON[k as Res]}${v}`)
    .join(' ');

export function ResourceCard({ state }: ScreenProps) {
  const e = state.economy;
  const per = resPerDay(state);
  return (
    <Card title="전략 자원 7종" right={<small className="muted">시간당 · 점령 도시는 절반</small>}>
      <div className="res-grid">
        {RESOURCES.map((r) => (
          <div key={r} className="res">
            <span>
              {RES_ICON[r]} {r}
            </span>
            <b>{fmt(Math.floor(e.stock[r]))}</b>
            <small className="muted">+{Math.round(per[r] * 10) / 10}</small>
          </div>
        ))}
      </div>
      <p className="small muted">내 나라 도시에서 자원이 나와요. 도시를 점령하면 그 도시 자원도 들어오고, 모자란 자원은 무역으로 사요.</p>
    </Card>
  );
}

export function FacilityCard({ state, actions }: ScreenProps) {
  const e = state.economy;
  const rank = state.player.rankIndex;
  const chore = e.chore;
  const choreWhy = canChore(state);
  return (
    <Card title="내정 시설" right={<small className="muted">최대 {maxLevel(rank)}단계</small>}>
      {FACILITIES.map((f) => {
        const st = e.facilities[f];
        const c = upgradeCost(e, f);
        const why = canUpgrade(state, f);
        return (
          <div key={f} className="facility">
            <div className="row">
              <b>
                {f} {st.level}단계
              </b>
              <small className="muted">
                효과 +{Math.round(FACILITY_EFF[st.level - 1] * 100)}% · {FACILITY_TEXT[f]}
              </small>
            </div>
            <div className="row">
              <small>
                경험치 {Math.floor(st.exp)}
                {st.level < 5 ? ` / ${c.exp} · 예산 ${fmt(c.money)} · ${c.hours}시간` : ''}
              </small>
              {st.buildEndMs ? (
                <small className="tag">공사 중 {timeLeft(st.buildEndMs - state.worldMs)}</small>
              ) : (
                <button disabled={!!why} title={why ?? ''} onClick={() => actions.apply((s) => upgradeFacility(s, f))}>
                  {why && rank >= ECON_RANK ? why : rank < ECON_RANK ? `${RANKS[ECON_RANK].name}부터` : '올리기'}
                </button>
              )}
            </div>
          </div>
        );
      })}
      <div className="facility">
        <b>내정 일</b>
        {chore ? (
          <div className="row">
            <small>
              {chore.fac}: {chore.title}
            </small>
            {state.worldMs >= chore.endMs ? (
              <button className="primary" onClick={() => actions.apply(claimChore)}>
                끝내기(+{CHORE_EXP})
              </button>
            ) : (
              <small className="muted">{timeLeft(chore.endMs - state.worldMs)}</small>
            )}
          </div>
        ) : (
          <div className="buttons">
            {FACILITIES.map((f) => (
              <button key={f} disabled={!!choreWhy} onClick={() => actions.apply((s) => startChore(s, f))}>
                {f} 일 맡기(1시간)
              </button>
            ))}
          </div>
        )}
        <small className="muted">
          {choreWhy && !chore ? `${choreWhy}. ` : ''}시설 경험치는 가만히 있어도 조금씩 쌓이고, 내정 일을 하면 {CHORE_EXP}씩 더 쌓여요. {RANKS[ECON_RANK].name}은 3단계까지,{' '}
          {RANKS[TOP_RANK].name}은 5단계까지 올려요.
        </small>
      </div>
    </Card>
  );
}

function CostLine({ c, ms }: { c: UnitCost; ms: number }) {
  return (
    <small className="muted">
      💰{fmt(c.money)} {resText(c.res)} · {timeLeft(ms)} · 전투력 {c.power}
    </small>
  );
}

export function ProductionCard({ state, actions }: ScreenProps) {
  const e = state.economy;
  const me = countryById(state.player.countryId);
  const [msg, setMsg] = useState('');
  const rank = state.player.rankIndex;
  const list = UNITS.filter((u) => u.rank <= rank);
  const try_ = (unit: string, special: boolean) => {
    const why = canProduce(state, unit, special);
    if (why) return setMsg(why);
    setMsg('');
    actions.apply((s) => produce(s, unit, special));
  };
  return (
    <Card title="병과 생산" right={<small className="muted">줄 {e.queue.length} / {QUEUE_MAX} · 전투력 {e.power}</small>}>
      {rank < ECON_RANK ? (
        <p className="small muted">{RANKS[ECON_RANK].name}이 되면 국방예산과 자원으로 부대를 만들어요. 만든 부대는 병력과 전투력이 되고, 전투력이 높으면 대전투가 쉬워져요.</p>
      ) : (
        <>
          {e.queue.map((q, i) => (
            <div key={q.id} className="row small">
              <span>
                {i === 0 ? '🔨' : '⏳'} {q.special ? me.specialUnit.name : q.unit}
              </span>
              <span className="muted">{timeLeft(q.endMs - state.worldMs)}</span>
            </div>
          ))}
          {msg && <p className="small warn">{msg}</p>}
          <div className="list-row">
            <span>
              <span className="tag">특별</span> <b>{me.specialUnit.name}</b>
              <br />
              <CostLine c={specialCost(me.specialUnit.base)} ms={buildMs(state, me.specialUnit.base, true)} />
            </span>
            <button onClick={() => try_(me.specialUnit.base, true)}>만들기</button>
          </div>
          {list.map((u) => (
            <div key={u.name} className="list-row">
              <span>
                <b>{u.name}</b> <small className="muted">보유 {e.army[u.name] ?? 0}</small>
                <br />
                <CostLine c={UNIT_COST[u.name]} ms={buildMs(state, u.name, false)} />
              </span>
              <button onClick={() => try_(u.name, false)}>만들기</button>
            </div>
          ))}
        </>
      )}
    </Card>
  );
}

export function TradeCard({ state, actions }: ScreenProps) {
  const rank = state.player.rankIndex;
  const partners = tradePartners(state);
  const [who, setWho] = useState(partners[0] ?? '');
  const [qty, setQty] = useState(5);
  const [msg, setMsg] = useState('');
  const me = state.player.countryId;
  if (rank < ECON_RANK) {
    return (
      <Card title="무역">
        <p className="small muted">{RANKS[ECON_RANK].name}부터 전쟁 중이 아닌 나라와 자원을 사고팔아요. 상대 지도자 성향에 따라 값이 달라요(경제형 싸게, 공격형 비싸게, 연합은 10% 깎아 줌).</p>
      </Card>
    );
  }
  const cur = partners.includes(who) ? who : partners[0];
  if (!cur) return <Card title="무역"><p className="small muted">거래할 나라가 없어요.</p></Card>;
  const has = producesOf(state, cur);
  const go = (r: Res, buy: boolean) => {
    const why = canTrade(state, cur, r, qty, buy);
    if (why) return setMsg(why);
    setMsg('');
    actions.apply((s) => trade(s, cur, r, qty, buy));
  };
  return (
    <Card title="무역" right={<small className="muted">{state.world.personalities[cur]} · {relationOf(state.world, me, cur)}</small>}>
      <div className="row">
        <select value={cur} onChange={(e) => setWho(e.target.value)}>
          {partners.map((id) => (
            <option key={id} value={id}>
              {countryById(id).name}
            </option>
          ))}
        </select>
        <span className="seg">
          {[1, 5, 20].map((n) => (
            <button key={n} className={qty === n ? 'on' : ''} onClick={() => setQty(n)}>
              {n}개
            </button>
          ))}
        </span>
      </div>
      {msg && <p className="small warn">{msg}</p>}
      {RESOURCES.map((r) => {
        const p = tradePrice(state, cur, r);
        return (
          <div key={r} className="list-row">
            <span className="small">
              {RES_ICON[r]} {r} <span className="muted">· 1개 {fmt(p)} · 보유 {Math.floor(state.economy.stock[r])}</span>
            </span>
            <span className="buttons">
              <button disabled={!has.includes(r)} onClick={() => go(r, true)}>
                사기
              </button>
              <button onClick={() => go(r, false)}>팔기({fmt(Math.round(p * SELL_RATE))})</button>
            </span>
          </div>
        );
      })}
      <p className="small muted">그 나라 도시에서 나는 자원만 살 수 있어요. 팔 때는 값의 {Math.round(SELL_RATE * 100)}%를 받아요.</p>
      {state.economy.log.length > 0 && (
        <ul className="small muted log">
          {state.economy.log.slice(0, 5).map((t, i) => (
            <li key={i}>{t}</li>
          ))}
        </ul>
      )}
    </Card>
  );
}
