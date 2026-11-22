// 나라 화면 탭: 전략 자원 · 내정 시설 · 병과 생산 · 무역, 그리고 병과 팝업(부대 화면과 같이 씀)
import { useState } from 'react';
import { UNITS } from '../data/catalog';
import { CHORE_EXP, ECON_RANK, FACILITIES, FACILITY_EFF, FACILITY_TEXT, RESOURCES, RES_ICON, SELL_RATE, TOP_RANK, UNIT_COST, specialCost, type Facility, type Res, type UnitCost } from '../data/economy';
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
import { FACILITY_ICON, UNIT_ICON } from './icons';
import { FLAG } from './flag';
import { Chip, Meter, Modal, Tile } from './kit';
import type { ScreenProps } from './screens';

function Cost({ c, stock, money }: { c: UnitCost; stock: Record<Res, number>; money: number }) {
  return (
    <div className="cost">
      <span className={money < c.money ? 'lack' : ''}>💰{fmt(c.money)}</span>
      {Object.entries(c.res).map(([k, v]) => (
        <span key={k} className={stock[k as Res] < v! ? 'lack' : ''}>
          {RES_ICON[k as Res]}
          {v}
        </span>
      ))}
    </div>
  );
}

export function ResourceCard({ state }: ScreenProps) {
  const e = state.economy;
  const per = resPerDay(state);
  return (
    <Card
      title="전략 자원 7종"
      icon="⛏️"
      help={
        <>
          <p>내 나라 도시마다 나는 자원이 달라요. 실제 1시간마다 쌓여요.</p>
          <p>도시를 점령하면 그 도시 자원도 들어와요(점령지는 절반). 산업 시설이 높으면 더 많이 나와요.</p>
          <p>자원이 없으면 그 자원이 드는 병과를 만들 수 없어요. 모자란 자원은 무역 탭에서 사요.</p>
        </>
      }
    >
      <div className="tiles c4">
        {RESOURCES.map((r) => (
          <Tile key={r} icon={RES_ICON[r]} label={fmt(Math.floor(e.stock[r]))} sub={r}>
            <small className={per[r] > 0 ? 'ok' : 'muted'}>{per[r] > 0 ? `+${Math.round(per[r] * 10) / 10}/시간` : '안 남'}</small>
          </Tile>
        ))}
      </div>
    </Card>
  );
}

export function FacilityCard({ state, actions }: ScreenProps) {
  const e = state.economy;
  const rank = state.player.rankIndex;
  const chore = e.chore;
  const choreWhy = canChore(state);
  const [pick, setPick] = useState<Facility | null>(null);
  return (
    <Card
      title="내정 시설"
      icon="🏭"
      help={
        <>
          <p>🏭 산업 = 예산·자원 · 🛤️ 인프라 = 생산 속도 · 🏥 복지 = 모병, 점령지 반란 줄이기.</p>
          <p>시설 경험치는 가만히 있어도 조금씩 쌓이고, {RANKS[ECON_RANK].name}부터 내정 일(1시간)을 하면 {CHORE_EXP}씩 더 쌓여요.</p>
          <p>{RANKS[TOP_RANK].name}이 되면 모아 둔 경험치와 예산으로 5단계까지 올려요.</p>
        </>
      }
    >
      <div className="tiles c3">
        {FACILITIES.map((f) => {
          const st = e.facilities[f];
          const c = upgradeCost(e, f);
          return (
            <Tile key={f} icon={FACILITY_ICON[f]} label={`${f} ${st.level}단계`} sub={`효과 +${Math.round(FACILITY_EFF[st.level - 1] * 100)}%`} tone={st.buildEndMs ? 'blue' : !canUpgrade(state, f) ? 'gold' : undefined} onClick={() => setPick(f)}>
              {st.level < 5 && <Meter value={st.exp} max={c.exp} />}
              <small>{st.buildEndMs ? `🏗️ ${timeLeft(st.buildEndMs - state.worldMs)}` : `경험 ${Math.floor(st.exp)}`}</small>
            </Tile>
          );
        })}
      </div>
      <div className="line-item" style={{ marginTop: 6 }}>
        <span className="li-ico">📝</span>
        <span className="li-main">
          <b>{chore ? `${chore.fac}: ${chore.title}` : '내정 일'}</b>
          <small>{chore ? (state.worldMs >= chore.endMs ? '끝났어요!' : `${timeLeft(chore.endMs - state.worldMs)} 남음`) : choreWhy ?? '시설 하나를 골라 1시간 일해요'}</small>
        </span>
        {chore && state.worldMs >= chore.endMs && (
          <button className="gold" onClick={() => actions.apply(claimChore)}>
            +{CHORE_EXP} 받기
          </button>
        )}
      </div>
      {!chore && !choreWhy && (
        <div className="buttons">
          {FACILITIES.map((f) => (
            <button key={f} style={{ flex: 1 }} onClick={() => actions.apply((s) => startChore(s, f))}>
              {FACILITY_ICON[f]} {f} 일
            </button>
          ))}
        </div>
      )}
      {pick && (
        <Modal
          title={`${pick} 시설`}
          icon={FACILITY_ICON[pick]}
          onClose={() => setPick(null)}
          footer={
            <>
              <button onClick={() => setPick(null)}>닫기</button>
              <button className="gold" disabled={!!canUpgrade(state, pick)} onClick={() => actions.apply((s) => upgradeFacility(s, pick))}>
                {canUpgrade(state, pick) ?? '⬆️ 올리기'}
              </button>
            </>
          }
        >
          <p>{FACILITY_TEXT[pick]}</p>
          <div className="kv2">
            <span>지금</span>
            <b>
              {e.facilities[pick].level}단계 · +{Math.round(FACILITY_EFF[e.facilities[pick].level - 1] * 100)}%
            </b>
            {e.facilities[pick].level < 5 && (
              <>
                <span>다음 단계</span>
                <b>+{Math.round(FACILITY_EFF[e.facilities[pick].level] * 100)}%</b>
                <span>필요 경험</span>
                <b>
                  {Math.floor(e.facilities[pick].exp)} / {upgradeCost(e, pick).exp}
                </b>
                <span>예산 · 공사</span>
                <b>
                  💰{fmt(upgradeCost(e, pick).money)} · {upgradeCost(e, pick).hours}시간
                </b>
              </>
            )}
          </div>
          {rank < TOP_RANK && <p className="small muted">{RANKS[TOP_RANK].name}이 되면 올릴 수 있어요. 지금은 경험치를 모아 두세요.</p>}
        </Modal>
      )}
    </Card>
  );
}

/** 병과 팝업: 역할·비용·만들기(부대 화면, 생산 탭) */
export function UnitModal({ state, actions, unit, onClose }: ScreenProps & { unit: string; onClose: () => void }) {
  const me = countryById(state.player.countryId);
  const special = unit === '★';
  const name = special ? me.specialUnit.base : unit;
  const info = UNITS.find((u) => u.name === name)!;
  const c = special ? specialCost(name) : UNIT_COST[name];
  const why = canProduce(state, name, special);
  const [msg, setMsg] = useState('');
  return (
    <Modal
      title={special ? me.specialUnit.name : name}
      icon={special ? '🌟' : UNIT_ICON[name]}
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose}>닫기</button>
          <button
            className="primary"
            disabled={!!why}
            onClick={() => {
              actions.apply((s) => produce(s, name, special));
              setMsg('생산 줄에 넣었어요.');
            }}
          >
            {why ?? `🛠️ 만들기 (${timeLeft(buildMs(state, name, special))})`}
          </button>
        </>
      }
    >
      <p>
        <span className="tag">{info.domain}</span> {special ? me.specialUnit.effect : info.role}
      </p>
      <div className="kv2">
        <span>전투력</span>
        <b>💪 {c.power}</b>
        <span>병력</span>
        <b>🪖 +{fmt(c.troops)}</b>
        <span>보유</span>
        <b>{state.economy.army[special ? me.specialUnit.name : name] ?? 0}부대</b>
        <span>열리는 계급</span>
        <b>{RANKS[Math.max(info.rank, ECON_RANK)].name}</b>
      </div>
      <p className="small muted" style={{ marginTop: 6 }}>
        비용
      </p>
      <Cost c={c} stock={state.economy.stock} money={state.nations[me.id].treasury} />
      {msg && <p className="small result">{msg}</p>}
    </Modal>
  );
}

export function ProductionCard(props: ScreenProps) {
  const { state } = props;
  const e = state.economy;
  const me = countryById(state.player.countryId);
  const rank = state.player.rankIndex;
  const [pick, setPick] = useState<string | null>(null);
  if (rank < ECON_RANK) return <p className="empty">🔒 {RANKS[ECON_RANK].name}이 되면 부대를 만들어요.</p>;
  return (
    <Card title="병과 생산" icon="🛠️" right={<Chip icon="🔨" value={`${e.queue.length}/${QUEUE_MAX}`} />} help={<p>국방예산과 자원으로 부대를 만들어요. 인프라 시설이 높으면 빨라져요. 만든 부대 전투력은 대전투 난이도를 낮추고 점령지를 지켜요.</p>}>
      {e.queue.map((q, i) => (
        <div key={q.id} className="promo-line">
          <small>
            {i === 0 ? '🔨' : '⏳'} {q.special ? me.specialUnit.name : q.unit}
          </small>
          <Meter value={Math.max(0, state.worldMs - q.startMs)} max={q.endMs - q.startMs} tone="blue" />
          <small className="muted">{timeLeft(q.endMs - state.worldMs)}</small>
        </div>
      ))}
      <div className="tiles c5" style={{ marginTop: 6 }}>
        <Tile icon="🌟" label="특별" sub={me.specialUnit.name} tone="gold" onClick={() => setPick('★')} />
        {UNITS.filter((u) => u.rank <= rank).map((u) => (
          <Tile key={u.name} icon={UNIT_ICON[u.name]} label={u.name} sub={`💰${fmt(UNIT_COST[u.name].money)}`} locked={!!canProduce(state, u.name) && canProduce(state, u.name)!.includes('부터')} onClick={() => setPick(u.name)} />
        ))}
      </div>
      {pick && <UnitModal {...props} unit={pick} onClose={() => setPick(null)} />}
    </Card>
  );
}

export function TradeCard({ state, actions }: ScreenProps) {
  const rank = state.player.rankIndex;
  const partners = tradePartners(state);
  const [who, setWho] = useState(partners[0] ?? '');
  const [pick, setPick] = useState<Res | null>(null);
  const [qty, setQty] = useState(5);
  const [msg, setMsg] = useState('');
  const me = state.player.countryId;
  if (rank < ECON_RANK) return <p className="empty">🔒 {RANKS[ECON_RANK].name}부터 무역해요.</p>;
  const cur = partners.includes(who) ? who : partners[0];
  if (!cur) return <p className="empty">거래할 나라가 없어요.</p>;
  const has = producesOf(state, cur);
  const go = (r: Res, buy: boolean) => {
    const why = canTrade(state, cur, r, qty, buy);
    if (why) return setMsg(why);
    setMsg(`${buy ? '샀어요' : '팔았어요'}: ${r} ${qty}개`);
    actions.apply((s) => trade(s, cur, r, qty, buy));
  };
  return (
    <Card
      title="무역"
      icon="🤝"
      right={<Chip icon="💰" value={fmt(state.nations[me].treasury)} />}
      help={<p>전쟁 중이 아닌 나라와 사고팔아요. 상대 지도자 성향에 따라 값이 달라요(경제형 싸게, 공격형 비싸게, 연합은 10% 할인). 그 나라 도시에서 나는 자원만 살 수 있고, 팔 때는 값의 {Math.round(SELL_RATE * 100)}%를 받아요.</p>}
    >
      <div className="pillrow">
        {partners.map((id) => (
          <button key={id} className={`flagbtn ${id === cur ? 'on' : ''}`} onClick={() => setWho(id)}>
            {FLAG[id]}
          </button>
        ))}
      </div>
      <p className="small muted">
        {countryById(cur).name} · {state.world.personalities[cur]} · {relationOf(state.world, me, cur)}
      </p>
      <div className="tiles c4">
        {RESOURCES.map((r) => (
          <Tile key={r} icon={RES_ICON[r]} label={`💰${tradePrice(state, cur, r)}`} sub={`${r} ${has.includes(r) ? '' : '(팔기만)'}`} tone={has.includes(r) ? 'green' : undefined} onClick={() => (setMsg(''), setPick(r))}>
            <small>보유 {Math.floor(state.economy.stock[r])}</small>
          </Tile>
        ))}
      </div>
      {pick && (
        <Modal title={`${pick} 거래`} icon={RES_ICON[pick]} onClose={() => setPick(null)}>
          <p className="small">
            {FLAG[cur]} {countryById(cur).name} · 1개 💰{tradePrice(state, cur, pick)} · 보유 {Math.floor(state.economy.stock[pick])}
          </p>
          <span className="seg">
            {[1, 5, 20, 50].map((n) => (
              <button key={n} className={qty === n ? 'on' : ''} onClick={() => setQty(n)}>
                {n}개
              </button>
            ))}
          </span>
          <div className="buttons" style={{ marginTop: 8 }}>
            <button className="primary" style={{ flex: 1 }} disabled={!has.includes(pick)} onClick={() => go(pick, true)}>
              사기 −💰{fmt(tradePrice(state, cur, pick) * qty)}
            </button>
            <button style={{ flex: 1 }} onClick={() => go(pick, false)}>
              팔기 +💰{fmt(Math.round(tradePrice(state, cur, pick) * SELL_RATE * qty))}
            </button>
          </div>
          {msg && <p className="small result">{msg}</p>}
        </Modal>
      )}
      {state.economy.log.length > 0 && (
        <ul className="small muted log">
          {state.economy.log.slice(0, 3).map((t, i) => (
            <li key={i}>{t}</li>
          ))}
        </ul>
      )}
    </Card>
  );
}
