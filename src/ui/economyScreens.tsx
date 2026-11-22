// 병과 팝업(부대 화면)과 공용 비용 표시. 내정 화면은 InteriorScreen, 무역은 DiplomacyScreen.
import { useState } from 'react';
import { UNITS } from '../data/catalog';
import { RES_ICON, UNIT_COST, specialCost, type Res, type UnitCost } from '../data/economy';
import { RANKS } from '../data/ranks';
import { countryById } from '../data/world';
import { buildMs, canProduce, produce } from '../game/economy';
import { fmt } from './common';
import { timeLeft } from './officerScreens';
import { UNIT_ICON } from './icons';
import { Modal } from './kit';
import type { ScreenProps } from './screens';

export function Cost({ c, stock, money }: { c: UnitCost; stock: Record<Res, number>; money: number }) {
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
              setMsg('모집을 시작했어요.');
            }}
          >
            {why ?? `🪖 모집 (${timeLeft(buildMs(state, name, special))})`}
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
        <span>열리는 등급</span>
        <b>{RANKS[info.rank].name}</b>
      </div>
      <p className="small muted" style={{ marginTop: 6 }}>
        비용
      </p>
      <Cost c={c} stock={state.economy.stock} money={state.nations[me.id].treasury} />
      {msg && <p className="small result">{msg}</p>}
    </Modal>
  );
}

