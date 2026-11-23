// 병과 팝업(부대 화면)과 공용 비용 표시. 내정 화면은 InteriorScreen, 무역은 DiplomacyScreen.
import { useState } from 'react';
import { UNITS } from '../data/catalog';
import { RES_ICON, type Res, type UnitCost } from '../data/economy';
import { exclusiveByName, specialById } from '../data/specials';
import { RANKS } from '../data/ranks';
import { countryById } from '../data/world';
import { buildMs, canProduce, costOf, crystalReady, produce } from '../game/economy';
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
        <span key={k} className={(stock[k as Res] ?? 0) < v! ? 'lack' : ''}>
          {RES_ICON[k as Res]}
          {v}
        </span>
      ))}
    </div>
  );
}


export function UnitModal({ state, actions, unit, onClose }: ScreenProps & { unit: string; onClose: () => void }) {
  const me = countryById(state.player.countryId);
  const [name, spId] = unit.split('|');
  const sp = spId ? specialById(spId) : undefined;
  const special = !!sp;
  const ex = exclusiveByName(name);
  const info = UNITS.find((u) => u.name === name)!;
  const c = costOf(state, name, spId);
  const why = canProduce(state, name, spId);
  const [msg, setMsg] = useState('');
  return (
    <Modal
      title={sp ? sp.name : name}
      icon={special ? '🌟' : ex ? '👑' : UNIT_ICON[name]}
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose}>닫기</button>
          <button
            className="primary"
            disabled={!!why}
            onClick={() => {
              actions.apply((s) => produce(s, name, spId));
              setMsg('모집을 시작했어요.');
            }}
          >
            {why ?? `🪖 모집 (${timeLeft(buildMs(state, name, spId))})`}
          </button>
        </>
      }
    >
      <p>
        <span className="tag">{info.domain}</span> {sp ? sp.effect : info.role}
      </p>
      {sp && (
        <p className="small muted">
          🌟 {name} 특화 유닛 · {name}와 같은 연구·등급에서 열려요(바탕 {name}도 계속 만들 수 있어요)
          {crystalReady(state) ? ' · 🧪 지금 만들면 갈륨 1을 더 써서 갈륨 개량형(+15%)' : ''}
        </p>
      )}
      {ex && (
        <p className="small muted">
          👑 독점 병과 · {ex.why} · 만드는 나라: {ex.only.map((id) => countryById(id).name).join(', ')}
        </p>
      )}
      <div className="kv2">
        <span>전투력</span>
        <b>💪 {c.power}</b>
        <span>병력</span>
        <b>🪖 +{fmt(c.troops)}</b>
        <span>보유</span>
        <b>{state.economy.army[sp ? sp.name : name] ?? 0}부대</b>
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

