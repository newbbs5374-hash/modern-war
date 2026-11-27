// 병과 팝업(부대 화면)과 공용 비용 표시. 내정 화면은 InteriorScreen, 무역은 DiplomacyScreen.
import { useState } from 'react';
import { UNITS } from '../data/catalog';
import { UNIT_COST, type Res, type UnitCost } from '../data/economy';
import { exclusiveByName, specialById } from '../data/specials';
import { RANKS } from '../data/ranks';
import { countryById } from '../data/world';
import { buildMs, canProduce, costOf, crystalReady, produce } from '../game/economy';
import { fmt } from './common';
import { defOf } from '../game/defFund';
import { timeLeft } from './officerScreens';
import { ResIcon, UnitIcon } from './iconArt';
import { Modal } from './kit';
import type { ScreenProps } from './screens';

export function Cost({ c, stock, money }: { c: UnitCost; stock: Record<Res, number>; money: number }) {
  return (
    <div className="cost">
      <span className={money < c.money ? 'lack' : ''}>🛡️국방비 {fmt(c.money)}</span>
      {Object.entries(c.res).map(([k, v]) => (
        <span key={k} className={(stock[k as Res] ?? 0) < v! ? 'lack' : ''}>
          <ResIcon res={k as Res} inline />
          {v}
        </span>
      ))}
    </div>
  );
}


/** 11-28 부대 가성비: 전투력 ÷ 국방비를 모든 병과 평균과 비교 */
const AVG_VALUE = Object.values(UNIT_COST).reduce((a, c) => a + c.power / Math.max(1, c.money), 0) / Object.values(UNIT_COST).length;
const valueRatio = (power: number, money: number) => (power / Math.max(1, money) / AVG_VALUE).toFixed(1);

export function UnitModal({ state, actions, unit, onClose }: ScreenProps & { unit: string; onClose: () => void }) {
  const [name, spId] = unit.split('|');
  const sp = spId ? specialById(spId) : undefined;
  const ex = exclusiveByName(name);
  const info = UNITS.find((u) => u.name === name)!;
  const c = costOf(state, name, spId);
  const why = canProduce(state, name, spId);
  const [msg, setMsg] = useState('');
  return (
    <Modal
      title={sp ? sp.name : name}
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
      <div className="unit-hero">
        <div className="unit-photo">
          <UnitIcon unit={name} sp={spId} />
        </div>
        <div className="kv2 unit-kv">
          <span>전투력</span>
          <b>💪 {c.power}</b>
          <span>병력</span>
          <b>🪖 +{fmt(c.troops)}</b>
          <span>보유</span>
          <b>{state.economy.army[sp ? sp.name : name] ?? 0}부대</b>
          <span>열리는 호칭</span>
          <b>{RANKS[info.rank].name}</b>
          <span>가성비</span>
          <b title="전투력 ÷ 국방비 1,000(모든 병과 평균과 비교)">⚖️ {valueRatio(c.power, c.money)}배</b>
          <span>파병 유지비</span>
          <b>🛡️{fmt(c.money * 0.0016)}/시간</b>
        </div>
      </div>
      <p>
        <span className="tag">{info.domain}</span> {sp ? sp.effect : info.role}
      </p>
      {sp && (
        <p className="small muted">
          🌟 {name} 특화 유닛 · {name}와 같은 연구·호칭에서 열려요(바탕 {name}도 계속 만들 수 있어요)
          {crystalReady(state) ? ' · 🧪 지금 만들면 갈륨 1을 더 써서 갈륨 개량형(+15%)' : ''}
        </p>
      )}
      {ex && (
        <p className="small muted">
          👑 독점 병과 · {ex.why} · 만드는 나라: {ex.only.map((id) => countryById(id).name).join(', ')}
        </p>
      )}
      <p className="small muted" style={{ marginTop: 6 }}>
        비용
      </p>
      <Cost c={c} stock={state.economy.stock} money={defOf(state)} />
      {msg && <p className="small result">{msg}</p>}
    </Modal>
  );
}

