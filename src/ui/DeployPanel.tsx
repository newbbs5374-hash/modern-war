// 외교 → 파병: 내가 만든 부대를 연합국·친한 나라로 보냄(game/deploy.ts)
import { useState } from 'react';
import { COUNTRIES, countryById } from '../data/world';
import {
  DEPLOY_FAVOR,
  DEPLOY_MAX,
  canDeploy,
  canHost,
  deployHelp,
  deployOf,
  deployTroops,
  recallTroops,
  travelMs,
  unitsCount,
  unitsPower,
  upkeepPerHour,
} from '../game/deploy';
import { isAlive } from '../game/world';
import { favorOf } from '../game/civ';
import { FLAG } from './flag';
import { Help } from './kit';
import { RelTag } from './common';
import type { ScreenProps } from './screens';

const h = (ms: number) => `${Math.max(0, Math.round((ms / 3600e3) * 10) / 10)}시간`;

export function DeployPanel({ state, actions }: ScreenProps) {
  const me = state.player.countryId;
  const d = deployOf(state);
  const help = deployHelp(state);
  const hosts = COUNTRIES.filter((c) => c.id !== me && isAlive(state.world, c.id)).sort(
    (a, b) => Number(!!canHost(state, a.id)) - Number(!!canHost(state, b.id)) || favorOf(state, b.id) - favorOf(state, a.id),
  );
  const [to, setTo] = useState<string>(hosts.find((c) => !canHost(state, c.id))?.id ?? hosts[0]?.id ?? '');
  const [pick, setPick] = useState<Record<string, number>>({});
  const army = Object.entries(state.economy.army).filter(([, k]) => k > 0);
  const why = canDeploy(state, to, pick);
  const upkeep = upkeepPerHour(state);
  return (
    <>
      <section className="card">
        <div className="row">
          <b>🪖 해외 파병</b>
          <small className="muted">
            {d.list.length}/{DEPLOY_MAX}곳 · 유지비 시간당 💰{Math.round(upkeep).toLocaleString('ko-KR')}
          </small>
          <Help title="해외 파병">
            <p>
              내가 만든 부대를 <b>연합국</b>이나 <b>호감 {DEPLOY_FAVOR} 이상</b>인 나라로 보내요. 거리에 따라 실제 1~6시간 걸려 도착해요.
            </p>
            <p>
              도착하면 그 나라 호감 +15, 그 나라 도시를 함께 지켜 <b>방어가 전투력만큼(최대 +40%)</b> 올라요. 세계지도에서 우리 병과가 그 나라 둘레를 움직여요.
            </p>
            <p>그 나라가 전쟁 중이면 가끔 부대를 하나씩 잃지만 명성을 얻어요. 머무는 동안 국방예산에서 유지비가 나가요. 언제든 불러들일 수 있어요.</p>
          </Help>
        </div>
      </section>

      {d.list.length > 0 && (
        <section className="card">
          <b>파병 중</b>
          {d.list.map((x) => {
            const st = x.returnMs
              ? `↩️ 돌아오는 중 · ${h(x.returnMs - state.worldMs)} 남음`
              : state.worldMs < x.arriveMs
                ? `✈️ 가는 중 · ${h(x.arriveMs - state.worldMs)} 남음`
                : `🛡️ 주둔 중 · 방어 +${Math.round(((help[x.to] ?? 1) - 1) * 100)}%`;
            return (
              <div key={x.id} className="row" style={{ gap: 8, marginTop: 6, alignItems: 'center' }}>
                <span style={{ fontSize: 20 }}>{FLAG[x.to]}</span>
                <span style={{ flex: 1 }}>
                  <b>{countryById(x.to).name}</b>{' '}
                  <small className="muted">
                    {Object.entries(x.units)
                      .map(([n, k]) => `${n} ${k}`)
                      .join(' · ')}
                    {x.lost ? ` · 잃음 ${x.lost}` : ''}
                  </small>
                  <br />
                  <small>{st}</small>
                </span>
                {!x.returnMs && <button onClick={() => actions.apply((s) => recallTroops(s, x.id))}>불러들이기</button>}
              </div>
            );
          })}
        </section>
      )}

      <section className="card">
        <b>새로 파병하기</b>
        <div className="row" style={{ flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
          {hosts.map((c) => {
            const no = canHost(state, c.id);
            return (
              <button key={c.id} className={to === c.id ? 'on' : ''} style={{ opacity: no ? 0.5 : 1 }} title={no ?? ''} onClick={() => setTo(c.id)}>
                {FLAG[c.id]} {c.name}
              </button>
            );
          })}
        </div>
        {to && (
          <p className="small" style={{ marginTop: 6 }}>
            {FLAG[to]} {countryById(to).name} <RelTag state={state} id={to} /> · 호감 {favorOf(state, to)} · 가는 데 {h(travelMs(me, to))}
            {canHost(state, to) ? <span className="warn"> · {canHost(state, to)}</span> : null}
          </p>
        )}
        {army.length === 0 ? (
          <p className="small muted">보낼 부대가 없어요. 국방 → 부대에서 먼저 만들어요.</p>
        ) : (
          <div style={{ marginTop: 6 }}>
            {army.map(([n, have]) => {
              const k = pick[n] ?? 0;
              const set = (v: number) => setPick((p) => ({ ...p, [n]: Math.max(0, Math.min(have, v)) }));
              return (
                <div key={n} className="row" style={{ gap: 8, alignItems: 'center', marginTop: 4 }}>
                  <span style={{ flex: 1 }}>
                    {n} <small className="muted">보유 {have}</small>
                  </span>
                  <button onClick={() => set(k - 1)} disabled={k <= 0}>
                    −
                  </button>
                  <b style={{ minWidth: 22, textAlign: 'center' }}>{k}</b>
                  <button onClick={() => set(k + 1)} disabled={k >= have}>
                    ＋
                  </button>
                  <button onClick={() => set(have)}>모두</button>
                </div>
              );
            })}
          </div>
        )}
        <button
          className="primary wide-btn"
          style={{ marginTop: 8 }}
          disabled={!!why}
          onClick={() => {
            actions.apply((s) => deployTroops(s, to, pick));
            setPick({});
          }}
        >
          {why ? `🔒 ${why}` : `🪖 ${countryById(to).name}에 ${unitsCount(pick)}개 파병(전투력 ${unitsPower(pick)})`}
        </button>
      </section>
    </>
  );
}
