// 외교 → 파병: 내가 만든 부대를 연합국·친한 나라로 보냄(game/deploy.ts)
// 11-26: 다른 나라·바다의 파병 요청(자주 옴) · 파병 중 교전(병과에 맞는 3D 전투 40가지)
import { BoostBar } from './BoostBar';
import { useState } from 'react';
import { COUNTRIES, countryById } from '../data/world';
import { autoField } from '../battle/auto';
import { setPendingPlan } from '../battle/spec';
import { BRANCH_ICON, BRANCH_NAME, clashById, regionById, requestKindById } from '../data/deployOps';
import { timeLeft } from './officerScreens';
import {
  acceptRequest,
  branchOf,
  canAccept,
  clashModeName,
  clashPlan,
  clashText,
  clashes,
  declineRequest,
  openRequests,
  placeName,
  settleClash,
  REQ_MAX,
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

export function DeployPanel({ state, actions, go }: ScreenProps) {
  const me = state.player.countryId;
  const d = deployOf(state);
  const help = deployHelp(state);
  const hosts = COUNTRIES.filter((c) => c.id !== me && isAlive(state.world, c.id)).sort(
    (a, b) => Number(!!canHost(state, a.id)) - Number(!!canHost(state, b.id)) || favorOf(state, b.id) - favorOf(state, a.id),
  );
  const [to, setTo] = useState<string>(hosts.find((c) => !canHost(state, c.id))?.id ?? hosts[0]?.id ?? '');
  const [pick, setPick] = useState<Record<string, number>>({});
  const [reqSel, setReqSel] = useState<number | null>(null);
  const [said, setSaid] = useState<string | null>(null);
  const reqs = openRequests(state);
  const req = reqs.find((r) => r.id === reqSel) ?? null;
  const reqKind = req ? requestKindById(req.kind) : undefined;
  const reqRegion = req ? regionById(req.region) : undefined;
  const fights = clashes(state);
  const army = Object.entries(state.economy.army).filter(([, k]) => k > 0);
  const why = req ? canAccept(state, req.id, pick) : canDeploy(state, to, pick);
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
            <p>그 나라가 전쟁 중이면 가끔 부대를 하나씩 잃지만 명성을 얻어요. 머무는 동안 나라 예산에서 유지비가 나가요. 언제든 불러들일 수 있어요.</p>
            <p>
              <b>📨 파병 요청</b>: 인도양·아덴만·폴란드·사헬 등 28곳에서 해적 퇴치·평화유지·영공 초계 같은 요청이 자주 와요(한 번에 {REQ_MAX}개까지, 10시간 기다려 줌). 요청에 맞는 병과를 보내 임무 시간을 채우면 나라 예산·명성을 받아요.
            </p>
            <p>
              <b>⚔️ 파병 교전</b>: 파병 중인 부대에 해적·반군·정체불명 함대 같은 교전이 생겨요(40가지). 보낸 병과에 맞는 공중전·해상전·육상전·해상-육상전·해상-공중전·육상-공중전이 3D 전장에서 벌어져요. 직접 싸우거나 맡길 수 있고, 4시간 안에 고르지 않으면 현지 부대가 알아서 싸워요(지면 부대 2개를 잃음).
            </p>
          </Help>
        </div>
      </section>

      {said && (
        <section className="card">
          <p className="small">{said}</p>
        </section>
      )}

      {fights.length > 0 && (
        <section className="card">
          <b>⚔️ 교전 발생 {fights.length}</b>
          {fights.map((x) => {
            const c = clashById(x.clash!.id)!;
            return (
              <div key={x.id} className="deploy-clash">
                <div className="row" style={{ gap: 8, alignItems: 'center' }}>
                  <span style={{ fontSize: 22 }}>{c.icon}</span>
                  <span style={{ flex: 1 }}>
                    <b>{c.title}</b> <small className="muted">· {clashModeName(x)} · {placeName(x.to)}</small>
                    <br />
                    <small className="warn">⏳ {timeLeft(x.clash!.untilMs - state.worldMs)} 안에 정하지 않으면 현지 부대가 알아서 싸워요</small>
                  </span>
                </div>
                <p className="small" style={{ margin: '4px 0' }}>{clashText(x)}</p>
                <div className="buttons">
                  <button
                    className="primary"
                    onClick={() => {
                      const plan = clashPlan(x);
                      if (!plan) return;
                      setPendingPlan(plan);
                      go('battle');
                    }}
                  >
                    ⚔️ 소탕하러 가기(3D 전투)
                  </button>
                  <button
                    onClick={() => {
                      const plan = clashPlan(x);
                      if (!plan) return;
                      const r = autoField(plan.stages[0]);
                      const text = actions.applyWith((s) => {
                        const o = settleClash(s, x.id, r.win, Math.min(2, r.stars), '맡김');
                        return { state: o.state, out: o.text };
                      });
                      setSaid(`🧑‍✈️ 현지 지휘관에게 맡겼어요. ${text ?? ''}`);
                    }}
                  >
                    🧑‍✈️ 현지에 맡기기(별 최대 2)
                  </button>
                </div>
              </div>
            );
          })}
        </section>
      )}

      <section className="card">
        <b>📨 파병 요청 {reqs.length}/{REQ_MAX}</b>
        {reqs.length === 0 && <p className="small muted">지금 온 요청이 없어요. 곧 여러 나라·바다에서 요청이 와요.</p>}
        {reqs.map((r) => {
          const k = requestKindById(r.kind)!;
          const reg = regionById(r.region)!;
          return (
            <div key={r.id} className={`deploy-req ${reqSel === r.id ? 'on' : ''}`}>
              <div className="row" style={{ gap: 8, alignItems: 'center' }}>
                <span style={{ fontSize: 22 }}>{reg.icon}</span>
                <span style={{ flex: 1 }}>
                  <b>
                    {reg.name} · {k.icon} {k.name}
                  </b>
                  <br />
                  <small className="muted">
                    {k.need.length ? k.need.map((b) => `${BRANCH_ICON[b]} ${BRANCH_NAME[b]}`).join(' + ') + ' 필요' : '어떤 부대든'} · 임무 {k.hours}시간 · 💰{k.money.toLocaleString('ko-KR')} · 명성 +{k.fame}
                    {reg.friend ? ` · ${countryById(reg.friend).name} 호감↑` : ''} · ⏳ {timeLeft(r.untilMs - state.worldMs)}
                  </small>
                </span>
              </div>
              <p className="small" style={{ margin: '4px 0' }}>{k.text.replaceAll('{곳}', reg.name)}</p>
              <div className="buttons">
                <button className={reqSel === r.id ? 'primary' : ''} onClick={() => setReqSel(reqSel === r.id ? null : r.id)}>
                  {reqSel === r.id ? '✅ 골랐어요(아래에서 부대 고르기)' : '🪖 받아들이기'}
                </button>
                <button
                  onClick={() => {
                    if (reqSel === r.id) setReqSel(null);
                    actions.apply((s) => declineRequest(s, r.id));
                  }}
                >
                  거절
                </button>
              </div>
            </div>
          );
        })}
      </section>

      {d.list.length > 0 && (
        <section className="card">
          <b>파병 중</b>
          {d.list.map((x) => {
            const st = x.returnMs
              ? `↩️ 돌아오는 중 · ${h(x.returnMs - state.worldMs)} 남음`
              : state.worldMs < x.arriveMs
                ? `✈️ 가는 중 · ${h(x.arriveMs - state.worldMs)} 남음`
                : x.req || !help[x.to]
                  ? '🛡️ 임무 중'
                  : `🛡️ 주둔 중 · 방어 +${Math.round(((help[x.to] ?? 1) - 1) * 100)}%`;
            return (
              <div key={x.id} className="row" style={{ gap: 8, marginTop: 6, alignItems: 'center' }}>
                <span style={{ fontSize: 20 }}>{FLAG[x.to] ?? regionById(x.to)?.icon}</span>
                <span style={{ flex: 1 }}>
                  <b>{placeName(x.to)}</b>{' '}
                  <small className="muted">
                    {Object.entries(x.units)
                      .map(([n, k]) => `${n} ${k}`)
                      .join(' · ')}
                    {x.lost ? ` · 잃음 ${x.lost}` : ''}
                  </small>
                  <br />
                  <small>
                    {st}
                    {x.req && !x.returnMs ? ` · ${requestKindById(x.req.kind)?.icon} ${requestKindById(x.req.kind)?.name} ${state.worldMs < x.arriveMs ? `${requestKindById(x.req.kind)?.hours}시간` : `${timeLeft(x.req.endMs - state.worldMs)} 남음`}` : ''}
                    {x.clash && !x.returnMs ? ` · ⚔️ ${clashById(x.clash.id)?.title}` : ''}
                    {x.wins ? ` · 교전 승리 ${x.wins}` : ''}
                  </small>
                </span>
                {(x.returnMs || state.worldMs < x.arriveMs) && <BoostBar state={state} apply={actions.apply} target={{ kind: 'deploy', id: x.id }} compact />}
                {!x.returnMs && <button onClick={() => actions.apply((s) => recallTroops(s, x.id))}>불러들이기</button>}
              </div>
            );
          })}
        </section>
      )}

      <section className="card">
        <b>{req ? `요청에 파병하기 · ${reqRegion?.icon} ${reqRegion?.name}` : '새로 파병하기'}</b>
        {req && reqKind && (
          <p className="small" style={{ marginTop: 4 }}>
            {reqKind.icon} {reqKind.name} · {reqKind.need.length ? `${reqKind.need.map((b) => `${BRANCH_ICON[b]} ${BRANCH_NAME[b]}`).join(' + ')}가 꼭 있어야 해요` : '어떤 부대든 좋아요'} · 가는 데 {h(travelMs(me, req.region))} · 임무 {reqKind.hours}시간{' '}
            <button className="link" onClick={() => setReqSel(null)}>
              나라 파병으로
            </button>
          </p>
        )}
        {!req && <div className="deploy-hosts">
          {hosts.map((c) => {
            const no = canHost(state, c.id);
            return (
              <button key={c.id} className={to === c.id ? 'on' : ''} style={{ opacity: no ? 0.5 : 1 }} title={no ?? ''} onClick={() => setTo(c.id)}>
                {FLAG[c.id]} {c.name}
              </button>
            );
          })}
        </div>}
        {!req && to && (
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
                    {BRANCH_ICON[branchOf(n)]} {n} <small className="muted">보유 {have}</small>
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
            if (req) actions.apply((s) => acceptRequest(s, req.id, pick));
            else actions.apply((s) => deployTroops(s, to, pick));
            setPick({});
            setReqSel(null);
          }}
        >
          {why ? `🔒 ${why}` : `🪖 ${req ? reqRegion?.name : countryById(to).name}에 ${unitsCount(pick)}개 파병(전투력 ${unitsPower(pick)})`}
        </button>
      </section>
    </>
  );
}
