// 내정 새 콘텐츠 8가지 화면(11/26): 사회 → 📋 국정(국회·선거 / 재난 / 감사 / 지방 / 인구 / 개헌 / 연설), 경제 → 📈 경기, 개인 → 일정(연설)
import { useState } from 'react';
import type { ScreenProps } from './screens';
import type { GameState } from '../game/state';
import { Card, fmt } from './common';
import { Meter, Modal } from './kit';
import { timeLeft } from './officerScreens';
import { SceneImg } from './DomesticUI';
import { PersonFace } from './CabinetUI';
import { countryFaceUrl } from './Portrait';
import { LOOK } from '../data/names';
import { cityById } from '../data/cities';
import { polityOf } from '../game/polity';
import { CAMPAIGN_MS, MAJORITY, RALLY_PER_DAY, SEATS, TWO_THIRDS, campaignOpen, canRally, electionName, electionOf, rally, rallyCost, voteRows, voteShare } from '../game/seats';
import { RATE_WAIT_MS, baseOf, canSetRate, econOf, econTargets, rateStep, setRate } from '../game/econ';
import { DISASTERS, RESPONDERS, STAGE_NAMES, canRespond, disasterKind, respond, responderById, responderPower, responseChance, responseRows } from '../game/disaster';
import { AUDIT_QS, answerAudit, answerScandal, auditChance, auditQ, canProbeRival, probePower, probeRival, rivalProbeChance, rivalProbeCost, scandalChance, scandalPerson, seatName, type AuditPick, type ScandalPick } from '../game/probe';
import { DEMANDS, answerDemand, canAnswer, demandCost, demandDef, localChance, myGovernors } from '../game/governors';
import { POP_POLICIES, canPopPolicy, livePolicy, popBase, popOf, pyramid, setPopPolicy } from '../game/population';
import { AMENDS, AMEND_MAX, amendOf, amendYes, canPropose, propose, refChance } from '../game/amend';
import { CLASH, SPEECH_PICK, canSpeak, dayByName, speak, speechOf, speechRows, speechText, wordById } from '../game/speech';
import { myCityIds } from '../game/zones';

const pct = (v: number) => `${Math.round(v * 100)}%`;
const sign = (v: number, d = 1) => `${v >= 0 ? '+' : ''}${Math.round(v * 10 ** d) / 10 ** d}`;

function Rows({ rows, sum, unit = '' }: { rows: Array<[string, number]>; sum?: string; unit?: string }) {
  const total = rows.reduce((a, [, v]) => a + v, 0);
  return (
    <div className="dom-rows">
      {rows.map(([n, v], i) => (
        <div key={i}>
          <span>{n}</span>
          <b className={v < 0 ? 'dom-warn' : ''}>
            {i === 0 ? '' : v >= 0 ? '+' : ''}
            {unit === '%' ? Math.round(v * 100) : Math.round(v * 100) / 100}
            {unit}
          </b>
        </div>
      ))}
      {sum && (
        <div className="dom-sum">
          <span>{sum}</span>
          <b>
            {unit === '%' ? Math.round(total * 100) : Math.round(total * 10) / 10}
            {unit}
          </b>
        </div>
      )}
    </div>
  );
}

/** 국정 칸 배지(할 일 수) */
export function polityBadge(s: GameState): number | null {
  if (!s.polity) return null;
  const p = polityOf(s);
  const n = (p.disaster ? 1 : 0) + (p.scandal ? 1 : 0) + (p.audit && p.audit.done.length < p.audit.qs.length ? 1 : 0) + (p.demand ? 1 : 0) + (p.speech.open ? 1 : 0) + (campaignOpen(s) ? 1 : 0);
  return n || null;
}

type Pill = 'seat' | 'disaster' | 'probe' | 'local' | 'pop' | 'amend' | 'speech';
export function PolityScreen(props: ScreenProps) {
  const { state } = props;
  const [pill, setPill] = useState<Pill | null>(null);
  if (!state.polity) return <p className="empty">국정 자료를 준비하고 있어요(15분 안에 열려요).</p>;
  const p = polityOf(state);
  const pills: Array<{ id: Pill; icon: string; name: string; on: boolean }> = [
    { id: 'seat', icon: '🗳️', name: '국회·선거', on: campaignOpen(state) },
    { id: 'disaster', icon: '🚨', name: '재난', on: !!p.disaster },
    { id: 'probe', icon: '🔍', name: '감사', on: !!p.scandal || (!!p.audit && p.audit.done.length < p.audit.qs.length) },
    { id: 'local', icon: '🗺️', name: '지방', on: !!p.demand },
    { id: 'pop', icon: '👶', name: '인구', on: false },
    { id: 'amend', icon: '📜', name: '개헌', on: !!p.amend.vote },
    { id: 'speech', icon: '🎤', name: '연설', on: !!p.speech.open },
  ];
  const cur: Pill = pill ?? pills.find((x) => x.on)?.id ?? 'seat';
  return (
    <>
      <div className="pol-pills">
        {pills.map((x) => (
          <button key={x.id} className={cur === x.id ? 'on' : ''} onClick={() => setPill(x.id)}>
            <span>{x.icon}</span>
            <small>{x.name}</small>
            {x.on && <i className="badge">!</i>}
          </button>
        ))}
      </div>
      {cur === 'seat' && <SeatsPanel {...props} />}
      {cur === 'disaster' && <DisasterPanel {...props} />}
      {cur === 'probe' && <ProbePanel {...props} />}
      {cur === 'local' && <GovernorsPanel {...props} />}
      {cur === 'pop' && <PopPanel {...props} />}
      {cur === 'amend' && <AmendPanel {...props} />}
      {cur === 'speech' && <SpeechPanel {...props} />}
      <PolityLog state={state} />
    </>
  );
}

function PolityLog({ state }: { state: GameState }) {
  const [open, setOpen] = useState(false);
  const log = polityOf(state).log;
  if (!log.length) return null;
  return (
    <Card title="국정 소식" icon="🗞️" right={<button className="pol-mini" onClick={() => setOpen(!open)}>{open ? '접기' : `더 보기 ${log.length}`}</button>}>
      <ul className="pol-log">
        {(open ? log : log.slice(0, 3)).map((t, i) => (
          <li key={i}>{t}</li>
        ))}
      </ul>
    </Card>
  );
}

/* ───────── 🗳️ 국회·선거 ───────── */
export function SeatArc({ ruling, opp, ind }: { ruling: number; opp: number; ind: number }) {
  const rows: Array<[number, number]> = [
    [60, 34],
    [78, 44],
    [96, 54],
    [114, 62],
    [132, 70],
    [150, 36],
  ];
  const pts: Array<[number, number, number]> = [];
  rows.forEach(([r, n]) => {
    for (let i = 0; i < n; i++) {
      const a = Math.PI * (1 - i / (n - 1));
      pts.push([182 + r * Math.cos(a), 156 - r * Math.sin(a), a]);
    }
  });
  pts.sort((x, y) => y[2] - x[2]);
  return (
    <svg className="pol-arc" viewBox="0 0 364 162" role="img" aria-label={`여당 ${ruling} 야당 ${opp} 무소속 ${ind}`}>
      {pts.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={3.6} fill={i < ruling ? '#4a8fe0' : i < ruling + ind ? '#9aa3ad' : '#e5534b'} />
      ))}
    </svg>
  );
}
function SeatsPanel({ state, actions }: ScreenProps) {
  const p = polityOf(state);
  const st = p.seats;
  const e = electionOf(state);
  const open = campaignOpen(state);
  const share = voteShare(state);
  const cities = myCityIds(state);
  const today = state.worldMs - e.dayMs < 24 * 3600e3 ? e.dayCount : 0;
  return (
    <>
      <Card
        title={`국회 ${SEATS}석`}
        icon="🏛️"
        help={
          <>
            <p>여당 의석이 많을수록 법안·기본법·예산안이 잘 통과돼요(150석 기준, 50석마다 ±20%). 과반({MAJORITY})이면 신뢰도 +2, 3분의 2({TWO_THIRDS})면 +4이고 개헌도 할 수 있어요.</p>
            <p>실제 7일마다 총선과 지방선거가 번갈아 열려요. 투표 2일 전부터 하루 {RALLY_PER_DAY}곳씩 유세할 수 있어요(고향은 2배).</p>
          </>
        }
      >
        <SeatArc {...st} />
        <div className="pol-legend">
          <span className="b">■ 여당 {st.ruling}</span>
          <span className="r">■ 야당 {st.opp}</span>
          <span>■ 무소속 {st.ind}</span>
        </div>
        <p className="pol-bubble">
          {st.ruling >= TWO_THIRDS
            ? '여당이 3분의 2를 넘었어요. 개헌도 혼자 밀어붙일 수 있어요.'
            : st.ruling >= MAJORITY
              ? `과반이에요. 법안이 잘 통과돼요(+${Math.round(((st.ruling - 150) / 250) * 100)}%).`
              : `과반 ${MAJORITY}석에 ${MAJORITY - st.ruling}석 모자라요. 법안 통과 ${Math.round(((st.ruling - 150) / 250) * 100)}%.`}
        </p>
      </Card>
      <Card
        title={`${electionName(e)}까지 ${timeLeft(e.atMs - state.worldMs)}${open ? ' · 유세 중' : ''}`}
        icon="📣"
        help={<Rows rows={voteRows(state)} sum="예상 득표율" unit="" />}
      >
        <p className="small">
          예상 득표율 <b>{Math.round(share)}%</b> · {e.kind === 'general' ? '국회 의석을 다시 뽑아요' : `내 도시 ${cities.length}곳의 시·도지사를 다시 뽑아요`}
        </p>
        {open ? (
          <>
            <p className="small muted">
              오늘 유세 {today}/{RALLY_PER_DAY} · 한 번에 💵{fmt(rallyCost(state))}
            </p>
            <div className="pol-cities">
              {cities.map((id) => {
                const n = e.rally.filter((c) => c === id).length;
                const why = canRally(state, id);
                return (
                  <button key={id} disabled={!!why} onClick={() => actions.apply((s) => rally(s, id))} title={why ?? ''}>
                    <b>{cityById(id).name}</b>
                    <small>{e.kind === 'local' ? `여당 ${pct(localChance(state, id, share))}` : n ? `유세 ${n}번` : '유세하기'}</small>
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          <p className="small muted">투표 {timeLeft(CAMPAIGN_MS)} 전부터 유세할 수 있어요.</p>
        )}
      </Card>
    </>
  );
}

/* ───────── 🚨 재난 ───────── */
function DisasterPanel({ state, actions }: ScreenProps) {
  const p = polityOf(state);
  const d = p.disaster;
  const [why, setWhy] = useState<string | null>(null);
  if (!d)
    return (
      <Card title="재난 대응 지휘실" icon="🚨" help={<p>실제 20~32시간마다 내 도시에 재난이 닥쳐요. 대비 → 구조 → 복구 3단계를 단계마다 2시간 안에 지휘해요. 알맞은 대응과 담당 장관·청장 능력이 성공 확률이에요.</p>}>
        <div className="pol-sc"><SceneImg scene="disaster" /></div>
        <p className="small">
          지금은 평온해요. 지금까지 잘 막은 재난 <b>{p.disasterWins}</b> · 피해가 컸던 재난 <b className="dom-warn">{p.disasterLoss}</b>
        </p>
        <div className="pol-kinds">
          {DISASTERS.map((k) => (
            <span key={k.id}>
              {k.icon} {k.name}
            </span>
          ))}
        </div>
      </Card>
    );
  const k = disasterKind(d.kind);
  const [opts] = k.stages[d.stage];
  return (
    <>
      <Card title={`${k.icon} ${cityById(d.cityId).name} ${k.name}`} icon="🚨" right={<b className="dom-warn">⏱ {timeLeft(d.endMs - state.worldMs)}</b>}>
        <div className="pol-sc"><SceneImg scene="disaster" /></div>
        <p className="small">{k.text}</p>
        <div className="pol-stages">
          {STAGE_NAMES.map((n, i) => (
            <span key={n} className={i < d.stage ? (d.wins[i] ? 'ok' : 'bad') : i === d.stage ? 'now' : ''}>
              {i + 1} {n} {i < d.stage ? (d.wins[i] ? '✅' : '❌') : ''}
            </span>
          ))}
        </div>
        <div className="pol-resp">
          {opts.map((rid) => {
            const r = responderById(rid);
            const pw = responderPower(state, r);
            return (
              <button key={rid} disabled={!!canRespond(state, rid)} onClick={() => actions.apply((s) => respond(s, rid))}>
                <span className="ico">{r.icon}</span>
                <b>{r.name}</b>
                <small>성공 {pct(responseChance(state, rid))}</small>
                <small className="muted">{r.min || r.post ? (pw ? `능력 ${pw.toFixed(1)}` : '담당 없음') : '기본'}</small>
              </button>
            );
          })}
        </div>
        <button className="pol-mini" onClick={() => setWhy(opts[0])}>
          확률 근거 보기
        </button>
      </Card>
      {why && (
        <Modal title="대응 성공 확률" icon="📋" onClose={() => setWhy(null)}>
          {opts.map((rid) => (
            <div key={rid}>
              <p className="small">
                <b>
                  {responderById(rid).icon} {responderById(rid).name}
                </b>{' '}
                · {responderById(rid).text}
              </p>
              <Rows rows={responseRows(state, rid)} sum="성공 확률" unit="%" />
            </div>
          ))}
          <p className="small muted">대응 종류: {RESPONDERS.map((r) => `${r.icon}${r.name}`).join(' · ')}</p>
        </Modal>
      )}
    </>
  );
}

/* ───────── 🔍 감사·수사·국정감사 ───────── */
function ProbePanel({ state, actions }: ScreenProps) {
  const p = polityOf(state);
  const sc = p.scandal;
  const person = scandalPerson(state);
  const a = p.audit;
  const rivals = state.officer.rivals.map((rv, i) => ({ rv, i })).filter(({ rv }) => !rv.ally);
  const ROLE = ['야당 대표', '군부 실력자', '재벌'];
  return (
    <>
      <Card title={sc ? `${sc.kind} 의혹` : '비리 의혹'} icon="🔍" right={sc ? <b className="dom-warn">⏱ {timeLeft(sc.untilMs - state.worldMs)}</b> : null} help={<p>실제 20~36시간마다 자리에 앉은 장관·참모 중 한 명에게 의혹이 터져요. 숨은 특성 '비리 전력'이면 잘 걸리고 증거도 많아요. 12시간 안에 정하지 않으면 지지도가 깎여요.</p>}>
        {sc && person ? (
          <>
            <div className="pol-person">
              <PersonFace p={person} size={56} />
              <div>
                <b>
                  {seatName(state, sc.pid)} {person.name}
                </b>
                <small>
                  증거 {'●'.repeat(sc.evidence)}
                  {'○'.repeat(3 - sc.evidence)} · 충성 {Math.round(person.loyalty)}
                </small>
                <small className="muted">의혹이 있는 동안 지지도 −2</small>
              </div>
            </div>
            <div className="pol-3">
              {(
                [
                  ['cover', '🛡️', '감싸기', `충성 +15 · 지지도 −${sc.evidence * 2}`],
                  ['probe', '⚖️', '수사', `밝혀낼 확률 ${pct(scandalChance(state))}`],
                  ['fire', '✂️', '경질', '지지도 +2 · 자리 빔'],
                ] as Array<[ScandalPick, string, string, string]>
              ).map(([id, ico, name, sub]) => (
                <button key={id} className={id === 'probe' ? 'on' : ''} onClick={() => actions.apply((s) => answerScandal(s, id))}>
                  <span className="ico">{ico}</span>
                  <b>{name}</b>
                  <small>{sub}</small>
                </button>
              ))}
            </div>
          </>
        ) : (
          <p className="small muted">지금은 의혹이 없어요. 검찰총장·감사원장 수사력 {probePower(state).toFixed(1)}</p>
        )}
      </Card>
      <Card title={a ? `국정감사 ⏱ ${timeLeft(a.untilMs - state.worldMs)}` : '국정감사'} icon="📋" help={<p>실제 7일마다 하루 동안 야당 질문 3개가 와요. 정부가 약한 곳일수록 먼저 나와요. 자료 공개는 안전하지만 약점이면 지지도 −2, 장관 답변은 그 부처 장관 능력에 달렸고, 답변 거부는 신뢰도 −5예요.</p>}>
        {a ? (
          a.qs.map((id) => {
            const q = auditQ(id);
            const done = a.done.includes(id);
            return (
              <div key={id} className="pol-q">
                <p className="small">
                  {q.icon} 야당 의원: "{q.ask}" {q.bad(state) && <b className="dom-warn">약점</b>}
                </p>
                {done ? (
                  <small className="muted">✅ 답했어요</small>
                ) : (
                  <div className="pol-3">
                    {(
                      [
                        ['open', '📂 자료 공개'],
                        ['minister', `🎙️ 장관 답변 ${pct(auditChance(state, id))}`],
                        ['refuse', '🙅 답변 거부'],
                      ] as Array<[AuditPick, string]>
                    ).map(([pk, label]) => (
                      <button key={pk} onClick={() => actions.apply((s) => answerAudit(s, id, pk))}>
                        <small>{label}</small>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <p className="small muted">
            다음 국정감사까지 {timeLeft(p.auditMs - state.worldMs)} · 질문 {AUDIT_QS.length}가지 중 약점이 먼저 나와요
          </p>
        )}
      </Card>
      <Card title="정적 수사" icon="⚖️" help={<p>검찰총장·감사원장 능력으로 정적의 영향력을 깎아요(성공 −25, 실패 +10). 48시간마다, 나라 예산 하루치. 정치 보복 논란으로 시민단체·언론 −6, 지지도 −2(하루).</p>}>
        {rivals.length ? (
          <div className="pol-rivals">
            {rivals.map(({ rv, i }) => {
              const why = canProbeRival(state, i);
              return (
                <button key={rv.name} disabled={!!why} onClick={() => actions.apply((s) => probeRival(s, i))} title={why ?? ''}>
                  <b>{rv.name}</b>
                  <small>
                    {rv.role ?? ROLE[i % 3]} · 영향력 {Math.round(rv.influence ?? 40)}
                  </small>
                  <small className="muted">{why ? why : `성공 ${pct(rivalProbeChance(state))} · 💵${fmt(rivalProbeCost(state))}`}</small>
                </button>
              );
            })}
          </div>
        ) : (
          <p className="small muted">수사할 정적이 없어요.</p>
        )}
      </Card>
    </>
  );
}

/* ───────── 🗺️ 시·도지사 ───────── */
function GovFace({ country, g }: { country: string; g: { sex: 'm' | 'f'; age: number; id: number } }) {
  const url = countryFaceUrl({ country, sex: g.sex, age: g.age, id: g.id }, LOOK[country] ?? 'we');
  return <span className="cab-face" style={{ width: 46, height: 46, fontSize: 24 }}>{url ? <img className="face-img" src={url} alt="" draggable={false} /> : '🧑‍💼'}</span>;
}
function GovernorsPanel({ state, actions }: ScreenProps) {
  const p = polityOf(state);
  const list = myGovernors(state);
  const me = state.player.countryId;
  const d = p.demand;
  const ruling = list.filter(([, g]) => g.party === 'ruling').length;
  return (
    <>
      {d && (
        <Card title={`${demandDef(d.kind).icon} ${cityById(d.cityId).name} 요구`} icon="📨" right={<b className="dom-warn">⏱ {timeLeft(d.untilMs - state.worldMs)}</b>}>
          {p.governors[d.cityId] && (
            <div className="pol-person">
              <GovFace country={me} g={p.governors[d.cityId]} />
              <div>
                <b>
                  {p.governors[d.cityId].name} <span className={p.governors[d.cityId].party === 'ruling' ? 'pol-chip b' : 'pol-chip r'}>{p.governors[d.cityId].party === 'ruling' ? '여' : '야'}</span>
                </b>
                <small>"{demandDef(d.kind).name}을(를) 꼭 해 주십시오."</small>
              </div>
            </div>
          )}
          <div className="pol-2">
            <button className="on" disabled={!!canAnswer(state, true)} onClick={() => actions.apply((s) => answerDemand(s, true))}>
              <b>들어주기</b>
              <small>
                💵{fmt(demandCost(state, d))} · 협조 +15 · 민심 +6
              </small>
            </button>
            <button onClick={() => actions.apply((s) => answerDemand(s, false))}>
              <b>거절</b>
              <small>협조 −15 · 민심 −6</small>
            </button>
          </div>
        </Card>
      )}
      <Card
        title={`시·도지사 ${list.length}명 · 여당 ${ruling}`}
        icon="🗺️"
        help={
          <>
            <p>내 도시마다 지사(시장)가 있어요. 여당 지사는 협조도가 70 쪽으로, 야당 지사는 30 쪽으로 움직여요. 협조 70↑이면 그 도시 민심 +, 30↓이면 −, 80↑·20↓이면 자원 ±1%(지사마다).</p>
            <p>지사는 실제 14~22시간마다 지역 요구를 올려요({DEMANDS.map((x) => x.name).join('·')}). 지방선거에서 다시 뽑혀요.</p>
          </>
        }
      >
        <div className="pol-govs">
          {list.map(([id, g]) => (
            <div key={id} className={`pol-gov ${g.party}`}>
              <GovFace country={me} g={g} />
              <div>
                <b>{cityById(id).name}</b>
                <small>
                  {g.name} <span className={g.party === 'ruling' ? 'pol-chip b' : 'pol-chip r'}>{g.party === 'ruling' ? '여' : '야'}</span>
                </small>
                <Meter value={g.coop} max={100} tone={g.coop >= 60 ? 'green' : g.coop < 30 ? 'red' : 'gold'} />
                <small className="muted">협조 {Math.round(g.coop)}</small>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </>
  );
}

/* ───────── 👶 인구 ───────── */
function PopPanel({ state, actions }: ScreenProps) {
  const p = popOf(state);
  const b = popBase(state);
  const now = pyramid(p);
  const fut = pyramid({ old: p.old + (2.1 - p.birth) * 0.0015 * 96 * 30, young: p.young + (p.birth - 2.1) * 0.0012 * 96 * 30, birth: p.birth });
  const pol = livePolicy(state);
  const AGES = ['80+', '60대', '40대', '20대', '10세↓'];
  const max = Math.max(...now, ...fut);
  return (
    <>
      <Card title={`인구 · 출산율 ${p.birth.toFixed(2)}`} icon="👶" help={<p>출산율이 2.1보다 낮으면 고령 비율이 천천히 오르고 청년이 줄어요. 고령화가 처음보다 오르면 징병과 나라 예산(연금)이 줄어요. 집값·실업률·지지도가 출산율 목표를 움직여요.</p>}>
        <div className="pol-kpis">
          <div>
            <small>출산율</small>
            <b className={p.birth < b.birth ? 'dom-warn' : ''}>{p.birth.toFixed(2)}</b>
          </div>
          <div>
            <small>고령</small>
            <b>{p.old.toFixed(1)}%</b>
          </div>
          <div>
            <small>청년</small>
            <b>{p.young.toFixed(1)}%</b>
          </div>
          <div>
            <small>이민</small>
            <b>{p.migrant.toFixed(1)}%</b>
          </div>
          <div>
            <small>인구</small>
            <b>{p.size.toFixed(1)}</b>
          </div>
          <div>
            <small>처음 고령</small>
            <b>{b.old}%</b>
          </div>
        </div>
        <p className="small muted">나이 모양 (막대 = 지금, 주황 점선 = 30일 뒤 예상)</p>
        {AGES.map((a, i) => (
          <div key={a} className="pol-pyr">
            <span>{a}</span>
            <div>
              <i style={{ width: `${(now[i] / max) * 100}%` }} />
              <em style={{ width: `${(fut[i] / max) * 100}%` }} />
            </div>
          </div>
        ))}
      </Card>
      <Card title={pol ? `${pol.icon} ${pol.name} · ${timeLeft(p.policy!.untilMs - state.worldMs)}` : '장기 정책(7일)'} icon="📌">
        <div className="pol-2">
          {POP_POLICIES.map((x) => (
            <button key={x.id} className={pol?.id === x.id ? 'on' : ''} disabled={!!canPopPolicy(state, x.id)} onClick={() => actions.apply((s) => setPopPolicy(s, x.id))}>
              <b>
                {x.icon} {x.name}
              </b>
              <small>{x.text}</small>
            </button>
          ))}
        </div>
      </Card>
    </>
  );
}

/* ───────── 📜 개헌 ───────── */
function AmendPanel({ state, actions }: ScreenProps) {
  const a = amendOf(state);
  const yes = amendYes(state);
  return (
    <Card title={`개헌 ${a.passed.length}/${AMEND_MAX}`} icon="📜" help={<p>한 판에 {AMEND_MAX}번까지 헌법을 고칠 수 있어요. 국회 찬성(여당 + 무소속 절반, 야당 대표와 협력하면 야당 4분의 1도)이 {TWO_THIRDS}표를 넘어야 국민투표로 가요. 국민투표는 6시간 뒤, 지지도가 높을수록 통과해요. 실패하면 지지도·신뢰도 −8, 3일 쉬어요.</p>}>
      <div className="pol-sc"><SceneImg scene="assembly" /></div>
      <p className="small">
        국회 찬성 예상 <b className={yes >= TWO_THIRDS ? '' : 'dom-warn'}>{yes}</b> / {TWO_THIRDS} {yes >= TWO_THIRDS ? '✅' : '❌'} · 국민 찬성 예상 <b>{pct(refChance(state))}</b>
      </p>
      {a.vote && (
        <p className="pol-bubble">
          📜 '{AMENDS.find((x) => x.id === a.vote!.id)!.name}' 국민투표까지 {timeLeft(a.vote.atMs - state.worldMs)}
        </p>
      )}
      <div className="pol-2">
        {AMENDS.map((x) => {
          const done = a.passed.includes(x.id);
          const why = canPropose(state, x.id);
          return (
            <button key={x.id} className={done ? 'on' : ''} disabled={!!why} onClick={() => actions.apply((s) => propose(s, x.id))} title={why ?? ''}>
              <b>
                {x.icon} {x.name} {done ? '✅' : ''}
              </b>
              <small>{x.text}</small>
            </button>
          );
        })}
      </div>
      {canPropose(state, AMENDS[0].id) && !a.vote && <p className="small muted">{canPropose(state, AMENDS.find((x) => !a.passed.includes(x.id))?.id ?? AMENDS[0].id)}</p>}
    </Card>
  );
}

/* ───────── 🎤 연설 ───────── */
export function SpeechPanel({ state, actions }: ScreenProps) {
  const sp = speechOf(state);
  const [pick, setPick] = useState<string[]>([]);
  const o = sp.open;
  if (!o)
    return (
      <Card title="국가 기념일 연설" icon="🎤" help={<p>실제 3.5일마다 기념일이 와요. 하루 안에 낱말 8개 중 3개를 골라 연설해요. 그날 뜻에 맞는 낱말이면 지지도 덤, 부딪치는 낱말이면 감점. 낱말마다 이익집단 반응이 이틀 동안 붙어요.</p>}>
        <div className="pol-sc"><SceneImg scene="ceremony" /></div>
        <p className="small muted">다음 기념일까지 {timeLeft(sp.nextMs - state.worldMs)}</p>
        {sp.last && (
          <p className="pol-bubble">
            지난 {sp.last.day} 연설: {sp.last.text}
          </p>
        )}
      </Card>
    );
  const day = dayByName(o.day);
  const rows = speechRows(o.day, pick);
  const toggle = (id: string) => setPick((x) => (x.includes(id) ? x.filter((y) => y !== id) : x.length >= SPEECH_PICK ? x : [...x, id]));
  return (
    <Card title={`${day.icon} ${o.day} 연설`} icon="🎤" right={<b className="dom-warn">⏱ {timeLeft(o.untilMs - state.worldMs)}</b>}>
      <div className="pol-sc"><SceneImg scene="ceremony" /></div>
      <p className="small">낱말 {SPEECH_PICK}개를 골라 주세요. 오늘의 뜻에 맞는 낱말을 찾아보세요.</p>
      <div className="pol-words">
        {o.words.map((id) => (
          <button key={id} className={pick.includes(id) ? 'on' : ''} onClick={() => toggle(id)}>
            {wordById(id).label}
            <small>
              {Object.entries(wordById(id).groups)
                .filter(([, v]) => v)
                .map(([g, v]) => `${{ biz: '재계', labor: '노동', mil: '군', civic: '시민', press: '언론', youth: '청년' }[g] ?? g}${sign(v!, 0)}`)
                .join(' ')}
            </small>
          </button>
        ))}
      </div>
      {pick.length === SPEECH_PICK && (
        <>
          <p className="pol-bubble">{speechText(pick)}</p>
          <Rows rows={rows} sum="지지도(이틀)" />
        </>
      )}
      <p className="small muted">부딪치는 낱말: {CLASH.map(([x, y]) => `${wordById(x).label}↔${wordById(y).label}`).join(' · ')}</p>
      <button className="gold pol-wide" disabled={!!canSpeak(state, pick)} onClick={() => (actions.apply((s) => speak(s, pick)), setPick([]))}>
        🎤 연설하기 ({pick.length}/{SPEECH_PICK})
      </button>
    </Card>
  );
}

/* ───────── 📈 경기(경제 탭) ───────── */
function Spark({ data, color, base }: { data: number[]; color: string; base?: number }) {
  if (data.length < 2) return <p className="small muted">기록을 모으는 중이에요(3시간마다 한 점).</p>;
  const lo = Math.min(...data, base ?? Infinity);
  const hi = Math.max(...data, base ?? -Infinity);
  const span = Math.max(1e-6, hi - lo);
  const W = 340;
  const Hh = 80;
  const y = (v: number) => Hh - 6 - ((v - lo) / span) * (Hh - 12);
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * W},${y(v).toFixed(1)}`).join(' ');
  return (
    <svg className="pol-spark" viewBox={`0 0 ${W} ${Hh}`}>
      {base !== undefined && <line x1={0} x2={W} y1={y(base)} y2={y(base)} stroke="#5b6a79" strokeDasharray="4" />}
      <polyline fill="none" stroke={color} strokeWidth={3} points={pts} />
    </svg>
  );
}
export function MacroPanel({ state, actions }: ScreenProps) {
  const [line, setLine] = useState<'cpi' | 'growth' | 'stock'>('cpi');
  const [why, setWhy] = useState(false);
  if (!state.polity) return <p className="empty">경제 지표를 모으고 있어요(15분 안에 열려요).</p>;
  const e = econOf(state);
  const b = baseOf(state);
  const t = econTargets(state);
  const up = canSetRate(state, 1);
  const dn = canSetRate(state, -1);
  const step = rateStep(state);
  const kpis: Array<[string, string, string]> = [
    ['물가', `${e.cpi.toFixed(1)}%`, e.cpi > b.cpi + 1 ? 'bad' : ''],
    ['실업률', `${e.unemp.toFixed(1)}%`, e.unemp > 5 ? 'bad' : ''],
    ['성장률', `${e.growth.toFixed(1)}%`, e.growth < b.growth - 1 ? 'bad' : 'good'],
    ['주가', fmt(e.stock), e.stock < 2200 ? 'bad' : ''],
    ['환율', `${e.fx.toFixed(0)}`, e.fx > 110 ? 'bad' : ''],
    ['집값', `${e.house >= 0 ? '+' : ''}${e.house.toFixed(0)}%`, e.house > 15 ? 'bad' : ''],
  ];
  return (
    <>
      {e.crisis && <p className="pol-alert">📉 {e.crisis.kind === 'bank' ? '금융위기' : '집값 거품 붕괴'} · {timeLeft(e.crisis.untilMs - state.worldMs)} 남음 · 성장률 −3 · 지지도 −5</p>}
      <Card title="경제 상황판" icon="📈" right={<button className="pol-mini" onClick={() => setWhy(true)}>근거</button>} help={<p>15분마다 숫자가 목표 쪽으로 움직여요. 물가가 나라 기본({b.cpi}%)보다 1%p 넘게 높으면 지지도가 깎이고, 성장률이 높으면 나라 예산이 늘어요. 물가·집값 과열이 오래가면 금융위기·집값 폭락이 터져요. 환율 100 = 보통.</p>}>
        <div className="pol-kpis">
          {kpis.map(([n, v, tone]) => (
            <div key={n} className={tone}>
              <small>{n}</small>
              <b>{v}</b>
            </div>
          ))}
        </div>
        <div className="pol-tabs">
          {(
            [
              ['cpi', '물가'],
              ['growth', '성장률'],
              ['stock', '주가'],
            ] as const
          ).map(([id, n]) => (
            <button key={id} className={line === id ? 'on' : ''} onClick={() => setLine(id)}>
              {n}
            </button>
          ))}
        </div>
        <Spark data={e.hist[line]} color={line === 'cpi' ? '#ffb020' : line === 'growth' ? '#3fb8c9' : '#a3e635'} base={line === 'cpi' ? b.cpi : line === 'growth' ? b.growth : 2500} />
        <p className="small muted">최근 {e.hist[line].length * 3}시간 · 점선 = 나라 기본</p>
      </Card>
      <Card title={`기준금리 ${e.rate.toFixed(2)}%`} icon="🏦" help={<p>금리를 내리면 성장률·주가·집값이 오르지만 물가도 올라요. 올리면 물가를 잡지만 성장이 줄고 재계가 싫어해요. 6시간마다 {step}%p씩, 중앙은행 총재 능력이 좋으면 0.5%p씩 움직여요. 이 나라 보통 금리 {b.rate}%.</p>}>
        <div className="pol-3">
          <button disabled={!!dn} onClick={() => actions.apply((s) => setRate(s, -1))}>
            <b>▼ 내림</b>
            <small>성장↑ 물가↑</small>
          </button>
          <button className="on" disabled>
            <b>그대로</b>
            <small>{up && dn ? timeLeft(e.rateMs - state.worldMs) : `6시간마다`}</small>
          </button>
          <button disabled={!!up} onClick={() => actions.apply((s) => setRate(s, 1))}>
            <b>▲ 올림</b>
            <small>물가↓ 재계 불만</small>
          </button>
        </div>
        <p className="small muted">한 번에 {step}%p · 다시 바꾸기까지 {timeLeft(Math.max(0, e.rateMs - state.worldMs)) === '끝남' ? '지금 가능' : timeLeft(e.rateMs - state.worldMs)} (간격 {RATE_WAIT_MS / 3600e3}시간)</p>
      </Card>
      {why && (
        <Modal title="경제 목표 근거" icon="📈" onClose={() => setWhy(false)}>
          <p className="small">
            <b>성장률 목표</b>
          </p>
          <Rows rows={t.growth} sum="목표" />
          <p className="small">
            <b>물가 목표</b>
          </p>
          <Rows rows={t.cpi} sum="목표" />
        </Modal>
      )}
    </>
  );
}
