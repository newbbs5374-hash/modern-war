// 11-27 외교 → 👑 패권: 대륙마다 힘 순위·패권국, 강대국의 제재·약탈 계약, 도움 요청(game/hegemony.ts)
import { useState } from 'react';
import { regionIcon, regionName, regionOf } from '../data/regions';
import { countryById } from '../data/world';
import {
  ASK_HOURS,
  LEADER_BONUS,
  LEADER_SHARE,
  MY_HELP_MONEY,
  MY_HELP_TROOPS,
  answerHelp,
  answerSqueeze,
  askHelp,
  canAskHelp,
  canHelp,
  canLift,
  hegOf,
  liftCost,
  liftSanction,
  liveRegions,
  myHelpCands,
  openAsks,
  regionStanding,
  sanctionsOn,
  squeezesOn,
  type HelpMode,
} from '../game/hegemony';
import { ACT_ICON } from '../data/bullies';
import { BEAT_FAME, COAL_BLOCK, MY_COAL_DAYS, actLabel, answerBully, canMyCoal, claimLine, isBeaten, makeMyCoal, myCoalCands, myCoalCost, bullyChoice, bullyStats, currentBullies } from '../game/bully';
import type { GameState } from '../game/state';
import type { HegAsk } from '../game/hegemony';
import { timeLeft } from './officerScreens';
import { FLAG } from './flag';
import { Help, Meter } from './kit';
import type { ScreenProps } from './screens';

const nm = (id: string) => countryById(id).name;
const pct = (v: number) => `${Math.round(v * 100)}%`;

export const hegemonyBadge = (props: ScreenProps) => (openAsks(props.state).length ? `!${openAsks(props.state).length}` : null);

export function HegemonyPanel({ state, actions }: ScreenProps) {
  const [said, setSaid] = useState('');
  const me = state.player.countryId;
  const h = hegOf(state);
  const asks = openAsks(state);
  const run = (f: (s: typeof state) => { state: typeof state; text: string }) => setSaid(actions.applyWith((s) => { const r = f(s); return { state: r.state, out: r.text }; }) ?? '');
  const myRegion = regionOf(me);
  const regions = [myRegion, ...liveRegions(state).filter((r) => r !== myRegion)];
  const t = state.worldMs;
  const active = [
    ...h.sanctions.filter((x) => x.untilMs > t).map((x) => ({ ...x, kind: '🚫 제재', v: x.rate, res: '' })),
    ...h.squeezes.filter((x) => x.untilMs > t).map((x) => ({ ...x, kind: '⛓️ 약탈 계약', v: x.drain })),
  ].sort((a, b) => Number(b.to === me || b.from === me) - Number(a.to === me || a.from === me));
  const cands = myHelpCands(state).slice(0, 6);
  const st = h.stats;
  return (
    <>
      <section className="card">
        <div className="row">
          <b>👑 대륙 패권</b>
          <Help title="대륙 패권">
            <p>나라들은 먼저 자기 대륙의 패권을 노려요. 대륙에서 힘(병력·금고·도시) 지분 1등이 패권국이고, 지분이 {pct(LEADER_SHARE)}를 넘으면 나라 예산 +{pct(LEADER_BONUS)}.</p>
            <p>센 나라는 같은 대륙의 약한 이웃을 노려 긴장을 쌓다 쳐들어가고, 2등은 1등에게 도전해요. 강대국은 약한 나라에 <b>경제 제재</b>를 걸고, 자원을 헐값에 가져가는 <b>약탈 계약</b>을 강요해요.</p>
            <p>밀리는 나라는 연합국·이웃에 도움을 청하고, 같은 적이나 같은 패권국에 눌린 나라끼리 자주 연합을 맺어요. 연합은 패권 다툼·외면으로 자주 깨져요.</p>
          </Help>
        </div>
        {st && (
          <p className="small muted">
            지금까지 세계에서: 새 연합 {st.allies} · 연합 깨짐 {st.breaks} · 도움 {st.helps} · 제재 {st.sanctions} · 약탈 계약 {st.squeezes} · 패권 전쟁 {st.wars}
          </p>
        )}
        {said && <p className="small">{said}</p>}
      </section>

      <BullyCard state={state} run={run} />

      {asks.length > 0 && (
        <section className="card">
          <b>📨 우리에게 온 요구·요청 {asks.length}</b>
          {asks.map((a) => (
            <div key={a.id} className="deploy-clash">
              {a.kind === 'bully' ? (
                <BullyAskCard state={state} a={a} run={run} />
              ) : a.kind === 'squeeze' ? (
                <>
                  <p className="small" style={{ margin: '4px 0' }}>
                    {FLAG[a.from]} <b>{nm(a.from)}</b>: "{a.res}을(를) 우리가 정한 값에 넘기시오." · 받으면 4일 동안 나라 예산 −{pct(a.drain ?? 0)}, 거절하면 보복 제재.
                    <br />
                    <small className="warn">⏳ {timeLeft(a.untilMs - t)} 안에 답하지 않으면 거절로 쳐요</small>
                  </p>
                  <div className="buttons">
                    <button onClick={() => run((s) => answerSqueeze(s, a.id, true))}>🙇 받아들이기</button>
                    <button className="danger" onClick={() => run((s) => answerSqueeze(s, a.id, false))}>✊ 거절하기</button>
                  </div>
                </>
              ) : (
                <>
                  <p className="small" style={{ margin: '4px 0' }}>
                    🆘 {FLAG[a.from]} <b>{nm(a.from)}</b>가 {FLAG[a.enemy!]} {nm(a.enemy!)}에 밀려 도움을 청해요.
                    <br />
                    <small className="warn">⏳ {timeLeft(a.untilMs - t)} 남음 · 도우면 긴장 −20·명성 +, 외면하면 연합이 깨질 수도</small>
                  </p>
                  <div className="buttons">
                    {(
                      [
                        ['troops', `🪖 병력 ${pct(MY_HELP_TROOPS)} 보내기`],
                        ['money', `💰 예산 ${pct(MY_HELP_MONEY)} 보내기`],
                        ['join', `⚔️ 함께 참전`],
                        ['refuse', '🙅 거절'],
                      ] as Array<[HelpMode, string]>
                    ).map(([m, label]) => (
                      <button key={m} className={m === 'join' ? 'primary' : m === 'refuse' ? 'danger' : ''} disabled={!!canHelp(state, a.id, m)} title={canHelp(state, a.id, m) ?? ''} onClick={() => run((s) => answerHelp(s, a.id, m))}>
                        {label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          ))}
          <small className="muted">요구·요청은 {ASK_HOURS}시간 동안 기다려요.</small>
        </section>
      )}

      {regions.map((rid) => {
        const list = regionStanding(state, rid);
        if (!list.length) return null;
        return (
          <section key={rid} className="card">
            <b>
              {regionIcon(rid)} {regionName(rid)}
              {rid === myRegion ? ' · 우리 대륙' : ''}
            </b>
            {list.map((x, i) => (
              <div key={x.id} className="row" style={{ gap: 6, alignItems: 'center', margin: '3px 0' }}>
                <span style={{ width: 22 }}>{i === 0 && list.length > 1 ? '👑' : `${i + 1}`}</span>
                <span style={{ width: 118, fontWeight: x.id === me ? 700 : 400, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: countryById(x.id).name.length > 4 ? 12 : undefined }}>
                  {FLAG[x.id]} {nm(x.id)}
                </span>
                <span style={{ flex: 1 }}>
                  <Meter value={x.share * 100} max={100} tone={x.id === me ? 'blue' : i === 0 ? 'gold' : undefined} />
                </span>
                <small style={{ width: 36, textAlign: 'right' }}>{pct(x.share)}</small>
              </div>
            ))}
          </section>
        );
      })}

      <section className="card">
        <b>🚫 제재 · ⛓️ 약탈 계약 {active.length}</b>
        {active.length === 0 && <p className="small muted">지금 걸린 제재·약탈 계약이 없어요.</p>}
        {active.slice(0, 14).map((x, i) => (
          <div key={i} className="row" style={{ gap: 6, alignItems: 'center', margin: '3px 0' }}>
            <small style={{ flex: 1 }}>
              {x.kind} {FLAG[x.from]} {nm(x.from)} → {FLAG[x.to]} {nm(x.to)} · 예산 −{pct(x.v)}
              {'res' in x && x.res ? ` (${x.res})` : ''} · {timeLeft(x.untilMs - t)}
            </small>
            {x.to === me && x.kind === '🚫 제재' && (
              <button disabled={!!canLift(state, x.from)} title={canLift(state, x.from) ?? ''} onClick={() => run((s) => liftSanction(s, x.from))}>
                🤝 협상 <small>💰{liftCost(state, x.from).toLocaleString('ko-KR')}</small>
              </button>
            )}
          </div>
        ))}
        {(sanctionsOn(state, me).length > 0 || squeezesOn(state, me).length > 0) && <small className="warn">우리 나라 예산이 제재·계약만큼 줄고 있어요.</small>}
      </section>

      <section className="card">
        <b>🆘 우리가 도움 청하기</b>
        {cands.length === 0 ? (
          <p className="small muted">전쟁 중일 때 연합국·이웃에 도움을 청할 수 있어요.</p>
        ) : (
          <>
            <p className="small muted">{nm(cands[0].enemy)}에 맞서 도와 달라고 해요. 응하면 함께 참전하거나 병력·돈을 보내 줘요.</p>
            {cands.map((c) => (
              <div key={c.id} className="row" style={{ gap: 6, alignItems: 'center', margin: '3px 0' }}>
                <span style={{ flex: 1 }}>
                  {FLAG[c.id]} {nm(c.id)} <small className="muted">· 응할 확률 {pct(c.chance)}</small>
                </span>
                <button className="primary" disabled={!!canAskHelp(state, c.id)} title={canAskHelp(state, c.id) ?? ''} onClick={() => run((s) => askHelp(s, c.id))}>
                  🆘 요청 <small>{canAskHelp(state, c.id) ?? ''}</small>
                </button>
              </div>
            ))}
          </>
        )}
      </section>
    </>
  );
}

/** 😈 대륙 깡패 강대국: 나라마다 교리·깡패짓 수·최근 깡패짓 */
function BullyCard({ state, run }: { state: GameState; run: (f: (s: GameState) => { state: GameState; text: string }) => void }) {
  const [open, setOpen] = useState(false);
  const list = currentBullies(state);
  const b = bullyStats(state);
  const me = state.player.countryId;
  if (!list.length) return null;
  const log = b.log.slice(0, open ? 12 : 4);
  return (
    <section className="card">
      <div className="row">
        <b>😈 대륙 깡패 강대국</b>
        <Help title="깡패 강대국">
          <p>대륙마다 자국 우선주의 깡패 나라가 있어요. 동맹이든 이웃이든 관세 폭탄·방위비 청구·영토 주장·문화 우기기·대리 세력·불공정 계약으로 괴롭히고, 패권 전쟁도 더 자주 걸어요.</p>
          <p>우리가 당하면 위 "우리에게 온 요구"에 와요. 🙇 굴복하면 돈·문화를 내주고 넘어가고, ✊ 맞서면 제재·긴장·전쟁 위험이 있지만 명성이 올라요.</p>
          <p>🛡️ <b>반깡패 연합</b>: 깡패에게 여러 번 당한 나라들은 스스로 뭉쳐요. 우리도 깡패에게 당했거나 싸우는 중이면 연합을 이끌 수 있어요(나라 예산 5%, {MY_COAL_DAYS}일). 연합 회원에게 온 깡패짓은 {Math.round(COAL_BLOCK * 100)}% 확률로 막아 내고, 회원이 깡패와 싸우면 다른 회원이 함께 참전해요.</p>
          <p>🏆 깡패 나라의 수도를 차지하거나 속국으로 만들면 꺾은 거예요: 명성 +{BEAT_FAME}, 지지율, 전과 보상에서 루비 60·가속권 8.</p>
          <p>깡패 나라가 망하거나 내가 그 나라로 하면, 그 대륙 패권국이 새 깡패가 돼요. 모든 지도자는 가상 인물이에요.</p>
        </Help>
      </div>
      {list.map(({ id, d, generic, region }) => (
        <div key={id} className="deploy-clash" style={{ margin: '6px 0' }}>
          <div className="row" style={{ gap: 6, alignItems: 'center' }}>
            <span style={{ fontSize: 22 }}>{d.icon}</span>
            <span style={{ flex: 1 }}>
              <b>
                {FLAG[id]} {nm(id)}
              </b>{' '}
              <small className="sns-tag">{d.name}</small> <small className="muted">· {regionIcon(region)} {regionName(region)}{generic ? ' 새 깡패' : ''}</small>
            </span>
            <small className="muted" style={{ whiteSpace: 'nowrap' }}>
              깡패짓 {b.acts[id] ?? 0}
              {b.onMe[id] ? ` · 우리에게 ${b.onMe[id]}` : ''}
            </small>
          </div>
          <p className="small" style={{ margin: '3px 0' }}>
            <i>{d.slogan}</i>
          </p>
          <p className="small muted" style={{ margin: 0 }}>
            {d.desc} · {Object.keys(d.acts).map((a) => `${ACT_ICON[a as keyof typeof ACT_ICON]} ${actLabel(d, a as keyof typeof ACT_ICON)}`).join(' · ')}
          </p>
          <CoalRow state={state} bully={id} run={run} />
        </div>
      ))}
      {log.length > 0 && (
        <>
          <b className="small">최근 깡패짓</b>
          {log.map((x, i) => (
            <p key={i} className="small" style={{ margin: '2px 0', fontWeight: x.to === me ? 700 : 400 }}>
              {x.text}
            </p>
          ))}
          {b.log.length > 4 && (
            <button className="link" onClick={() => setOpen(!open)}>
              {open ? '접기' : `더 보기(${Math.min(12, b.log.length)})`}
            </button>
          )}
        </>
      )}
    </section>
  );
}

function BullyAskCard({ state, a, run }: { state: GameState; a: HegAsk; run: (f: (s: GameState) => { state: GameState; text: string }) => void }) {
  const ch = bullyChoice(a);
  const d = currentBullies(state).find((x) => x.id === a.from)?.d;
  const lab = d && a.act ? actLabel(d, a.act) : '깡패짓';
  return (
    <>
      <p className="small" style={{ margin: '4px 0' }}>
        {a.act ? ACT_ICON[a.act] : '😈'} {d?.icon} {FLAG[a.from]} <b>{nm(a.from)}</b>의 <b>{lab}</b>
        {a.item ? <>: "{claimLine(a.item)}이다!"</> : '!'}
        <br />
        <small className="warn">⏳ {timeLeft(a.untilMs - state.worldMs)} 안에 답하지 않으면 맞선 것으로 쳐요(명성은 없음)</small>
      </p>
      <div className="buttons">
        <button onClick={() => run((s) => answerBully(s, a.id, true))}>🙇 굴복: {ch.giveIn}</button>
        <button className="danger" onClick={() => run((s) => answerBully(s, a.id, false))}>✊ 맞서기: {ch.resist}</button>
      </div>
    </>
  );
}

/** 깡패 하나의 반깡패 연합 줄: 지금 연합 · 우리가 이끌기 */
function CoalRow({ state, bully, run }: { state: GameState; bully: string; run: (f: (s: GameState) => { state: GameState; text: string }) => void }) {
  const [open, setOpen] = useState(false);
  const me = state.player.countryId;
  const c = hegOf(state).bully?.coal?.[bully];
  const live = c && c.untilMs > state.worldMs ? c : undefined;
  const no = canMyCoal(state, bully);
  const cands = myCoalCands(state, bully).slice(0, 6);
  if (isBeaten(state, bully)) return <p className="small" style={{ margin: '4px 0 0' }}>🏆 우리가 꺾은 깡패예요.</p>;
  return (
    <div style={{ marginTop: 4 }}>
      {live && (
        <p className="small" style={{ margin: '2px 0' }}>
          🛡️ 반깡패 연합{live.mine ? '(우리가 이끎)' : ''}: {[...(live.mine ? [me] : []), ...live.members].map((x) => `${FLAG[x]} ${nm(x)}`).join(' · ')} · {timeLeft(live.untilMs - state.worldMs)} 남음
        </p>
      )}
      {!live?.mine && (
        <div className="row" style={{ gap: 6, alignItems: 'center' }}>
          <button className="primary" disabled={!!no} title={no ?? ''} onClick={() => run((s) => makeMyCoal(s, bully))}>
            🛡️ 반깡패 연합 이끌기 <small>{no ?? `💰${myCoalCost(state).toLocaleString('ko-KR')}`}</small>
          </button>
          {cands.length > 0 && (
            <button className="link" onClick={() => setOpen(!open)}>
              {open ? '접기' : `부를 나라 ${cands.length}`}
            </button>
          )}
        </div>
      )}
      {open &&
        cands.map((x) => (
          <p key={x.id} className="small muted" style={{ margin: '1px 0' }}>
            {FLAG[x.id]} {nm(x.id)} · 당한 깡패짓 {x.n} · 들어올 확률 {pct(x.chance)}
          </p>
        ))}
    </div>
  );
}
