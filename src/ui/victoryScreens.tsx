// 승리 조건 진행 카드 · 엔딩 · 명예의 전당
import { RANKS } from '../data/ranks';
import { MEGAS, MEGA_STAGES, megaLv, megaTotal } from '../game/megaPlan';
import { ALLIED_SHARE, ALONE_SHARE, continueAfterWin, hasWon, HOLD_DAYS, holdLeft, loadHall, recordHall, victoryProgress, VICTORY_RANK, type Ending, type HallEntry } from '../game/victory';
import { timeLeft } from './officerScreens';
import { Card } from './common';
import { FLAG } from './flag';
import { PEACE_COST, PEACE_FAVOR, PEACE_HOLD_DAYS, canProposePeace, peaceLeft, peaceName, peaceOf, peaceProgress, proposePeace } from '../game/peace';
import type { ScreenProps } from './screens';
import { cultureProgress, cultureWinLeft } from '../game/culture';
import { useState } from 'react';
import { Meter as KitMeter, Tile } from './kit';
import { CultureWinPanel } from './CultureScreen';
import { COUNTRIES } from '../data/world';
import { isAlive, relationOf } from '../game/world';
import { INF_BRANCHES, INF_DEADLINE_DAYS, INF_HOLD_DAYS, INF_LEAD, INF_WIN, infBonusRows, influenceProgress } from '../game/influence';
import { countryById } from '../data/world';
import { SECRET_INF, SECRET_RUBY, secretName, secretText, secretsOf } from '../game/secretGoals';

function Meter({ have, need }: { have: number; need: number }) {
  return (
    <span className="bar">
      <span className="bar-fill" style={{ width: `${Math.min(100, (have / need) * 100)}%` }} />
    </span>
  );
}

export function VictoryCard({ state, actions }: ScreenProps) {
  const p = victoryProgress(state);
  const ready = state.player.rankIndex >= VICTORY_RANK;
  return (
    <Card title="승리 조건" right={<small className="muted">{ready ? '지도자 · 하나만 이루면 승리' : `${RANKS[VICTORY_RANK].name}가 되면 열림`}</small>}>
      <div className="small">
        ① 연합 승리: 우리 + 연합국 도시 {p.allied} / {p.needAllied}
        <Meter have={p.allied} need={p.needAllied} />
        ② 정복 승리: 우리 도시 {p.mine} / {p.needAlone}
        {p.capsNeed > 0 && ` · 강대국 수도 ${p.capsHave} / ${p.capsNeed}`}
        <Meter have={p.mine} need={p.needAlone} />
      </div>
      <PeacePart state={state} onPropose={() => actions.apply(proposePeace)} />
      <CulturePart state={state} />
      {holdLeft(state) !== null && <p className="small result">🏁 조건 달성! {timeLeft(holdLeft(state)!)} 더 지키면 승리해요.</p>}
      <p className="small muted">넷 중 하나를 {HOLD_DAYS}일 동안 지키면 이겨요. 지도자 외교로 연합국을 늘릴 수 있어요. 대전투로 적 도시를 차지하고, 만든 부대와 복지로 점령지를 지키세요. 점령지는 가끔 반란이 일어나요.</p>
    </Card>
  );
}

/** ④ 문화 승리(자세한 건 개인 → 승리) */
function CulturePart({ state }: { state: ScreenProps['state'] }) {
  const p = cultureProgress(state);
  const left = cultureWinLeft(state);
  return (
    <div className="small" style={{ marginTop: 6 }}>
      ④ 문화 승리: 문화 우세 {p.have} / {p.need} · 5단계 시설 {p.top} / {p.needTop}
      <Meter have={p.have + Math.min(p.top, p.needTop)} need={p.need + p.needTop} />
      {left !== null && <p className="result">🎨 문화 승리 조건 달성! {timeLeft(left)} 더 지키면 이겨요.</p>}
    </div>
  );
}

/** ③ 평화 승리: 세계 평화 헌장 */
function PeacePart({ state, onPropose }: { state: ScreenProps['state']; onPropose: () => void }) {
  const pr = peaceProgress(state);
  const left = peaceLeft(state);
  const why = canProposePeace(state);
  const last = peaceOf(state).last;
  return (
    <div className="small" style={{ marginTop: 6 }}>
      ③ 평화 승리: 평화 헌장 서명 {pr.have} / {pr.need}
      <Meter have={pr.have} need={pr.need} />
      <details>
        <summary className="muted">어느 나라가 서명해 줄까?</summary>
        {pr.lines.map((l) => (
          <div key={l.id} className="list-row">
            <span>
              {FLAG[l.id]} {peaceName(l.id)} <span className="muted">호감 {l.favor}</span>
            </span>
            <span className={l.signs ? '' : 'muted'}>{l.signs ? '✍️ 서명' : l.why}</span>
          </div>
        ))}
        <p className="muted">
          호감 {PEACE_FAVOR} 이상이고 전쟁 중이 아닌 나라만 서명해요. 협정·대화·회의 투표로 호감을 올리세요. 헌장을 맺으면 {PEACE_HOLD_DAYS}일 동안 우리가 전쟁하지 않고 서명국을 지켜야 해요.
        </p>
      </details>
      {left !== null ? (
        <p className="result">☮️ 헌장을 지키는 중! {timeLeft(left)} 더 평화를 지키면 평화 승리예요.</p>
      ) : (
        <button className="wide" style={{ marginTop: 4 }} disabled={!!why} title={why ?? ''} onClick={onPropose}>
          ☮️ 세계 평화 헌장 제안 (나라 예산 {PEACE_COST.toLocaleString('ko-KR')}){why ? ` · ${why}` : ''}
        </button>
      )}
      {last && <p className="muted">{last}</p>}
    </div>
  );
}

export function EndingCard({ state, actions }: ScreenProps) {
  const e = state.ending;
  if (!e) return null;
  return (
    <div className="ending">
      <h2>{e.kind === '평화 승리' ? '🕊️' : e.kind === '문화 승리' ? '🎨' : e.kind === '과학 승리' ? '🔬' : e.kind === '세계 영향력 승리' ? '🌐' : e.kind === '점수 마감' ? '⏱️' : '🏆'} {e.kind}{e.kind === '점수 마감' ? ` · ${e.place ?? '?'}위` : '!'}</h2>
      <p>
        {e.name} 지도자가 이끈 {e.country}이(가) {e.day}일째에 {e.kind === '점수 마감' ? `12주 점수 마감에서 세계 영향력 ${e.place ?? '?'}위를 했어요. 계속 플레이해서 1등을 노릴 수도 있어요` : e.kind === '세계 영향력 승리' ? '군사·경제·외교·문화·과학을 아울러 세계를 이끄는 나라가 됐어요' : e.kind === '평화 승리' ? '세계 평화 헌장으로 전쟁 없는 세계를 열었어요' : e.kind === '문화 승리' ? '문화로 세계 사람들의 마음을 얻었어요' : e.kind === '과학 승리' ? '세 가지 국가 대계획을 이뤄 인류의 내일을 열었어요' : '전쟁을 끝냈어요'}.
      </p>
      <p className="small">
        도시 {e.cities}개{e.captured.length ? ` · 점령: ${e.captured.join(', ')}` : ''}
        {e.generals.length ? ` · 장군: ${e.generals.join(', ')}` : ''}
      </p>
      <p className="small muted">승리를 선언하면 명예의 전당에 오르고 다른 나라로 새 판을 시작해요. 계속 플레이하면 승리 기록만 남기고 지금 판을 그대로 이어 가요.</p>
      <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
        <button
          className="primary"
          onClick={() => {
            if (!window.confirm('승리를 선언하고 새 판을 시작할까요? 지금 판은 끝나요.')) return;
            recordHall(e, Date.now());
            actions.reset();
          }}
        >
          🏆 승리 선언 (새 나라로 새 판)
        </button>
        <button
          onClick={() => {
            recordHall({ ...e, kept: true }, Date.now());
            actions.apply(continueAfterWin);
          }}
        >
          ▶️ 계속 플레이
        </button>
      </div>
    </div>
  );
}

/** 계속 플레이 중 이미 이룬 승리 + 언제든 승리 선언 */
function WinsDone({ state, actions }: ScreenProps) {
  const wins = state.wins ?? [];
  if (!wins.length) return null;
  return (
    <Card title="✅ 이룬 승리" right={<small className="muted">계속 플레이 중</small>}>
      {wins.map((w, i) => (
        <div key={i} className="list-row small">
          <span>
            {w.kind === '평화 승리' ? '🕊️' : w.kind === '문화 승리' ? '🎨' : w.kind === '과학 승리' ? '🔬' : '🏆'} <b>{w.kind}</b>
          </span>
          <span className="muted">{w.day}일째 · 도시 {w.cities}</span>
        </div>
      ))}
      <p className="small muted">명예의 전당에도 기록했어요. 다른 승리도 이루면 또 기록돼요.</p>
      <button
        className="wide"
        onClick={() => {
          if (!window.confirm('지금 판을 끝내고 다른 나라로 새로 시작할까요?')) return;
          actions.reset();
        }}
      >
        🏁 판 끝내고 새 나라로 시작
      </button>
    </Card>
  );
}

export function HallList({ list = loadHall() }: { list?: HallEntry[] }) {
  if (!list.length) return null;
  const won = new Set(list.map((x) => x.country));
  return (
    <div className="hall">
      <h2>명예의 전당 · 이긴 나라 {won.size}</h2>
      {list.slice(0, 10).map((h, i) => (
        <div key={i} className="list-row small">
          <span>
            🏆 <b>{h.country}</b> {h.name} · {h.kind}
            {h.kept ? <span className="muted"> (계속 플레이)</span> : null}
          </span>
          <span className="muted">{h.day}일째 · 도시 {h.cities}</span>
        </div>
      ))}
    </div>
  );
}

/* ───────── 👤 개인 → 🏆 승리(11-24 대장 요청: 모든 승리 조건을 한곳에서) ───────── */
const ALONE_PCT = Math.round(ALONE_SHARE * 100);
type WinId = 'influence' | 'conquer' | 'allied' | 'peace' | 'culture' | 'science';

/** 승리 4가지의 진행률(0~1)과 지키는 중 남은 시간 */
export function winLines(s: ScreenProps['state']) {
  const p = victoryProgress(s);
  const pr = peaceProgress(s);
  const cp = cultureProgress(s);
  const hold = holdLeft(s);
  const conquerOn = hold !== null && p.mine >= p.needAlone && p.capsOk;
  const alliedOn = hold !== null && !conquerOn;
  const pl = peaceLeft(s);
  const cl = cultureWinLeft(s);
  const r = (a: number, b: number) => Math.max(0, Math.min(1, a / Math.max(1, b)));
  const ip = influenceProgress(s);
  const il = s.infl?.winSinceMs != null ? Math.max(0, s.infl.winSinceMs + INF_HOLD_DAYS * 24 * 3600e3 - s.worldMs) : null;
  const names: Record<WinId, Ending['kind']> = { influence: '세계 영향력 승리', conquer: '정복 승리', allied: '연합 승리', peace: '평화 승리', culture: '문화 승리', science: '과학 승리' };
  return ([
    { id: 'influence' as WinId, icon: '🌐', name: '세계 영향력', goal: `${INF_WIN}점 + 2등의 ${INF_LEAD}배`, now: `${ip.mine?.total ?? 0}점 · ${ip.place}위`, pct: r(Math.min(ip.mine?.total ?? 0, INF_WIN) + (ip.ok ? 1 : 0), INF_WIN + 1), left: il },
    { id: 'conquer' as WinId, icon: '⚔️', name: '정복 승리', goal: `우리 도시 ${p.needAlone}개(세계 ${ALONE_PCT}%)${p.capsNeed ? ' + 강대국 수도 3곳(통일·속국으로)' : ''}`, now: `${p.mine} / ${p.needAlone}${p.capsNeed ? ` · 수도 ${p.capsHave}/${p.capsNeed}` : ''}`, pct: r(p.mine + p.capsHave * 4, p.needAlone + p.capsNeed * 4), left: conquerOn ? hold : null },
    { id: 'allied' as WinId, icon: '🤝', name: '연합 승리', goal: `우리+연합국 도시 ${p.needAllied}개`, now: `${p.allied} / ${p.needAllied}`, pct: r(p.allied, p.needAllied), left: alliedOn ? hold : null },
    { id: 'peace' as WinId, icon: '🕊️', name: '평화 승리', goal: `평화 헌장 서명 ${pr.need}나라`, now: `${pr.have} / ${pr.need}`, pct: pl !== null ? 1 : r(pr.have, pr.need), left: pl },
    {
      id: 'culture' as WinId,
      icon: '🎨',
      name: '문화 승리',
      goal: `문화 우세 ${cp.need}나라 + 5단계 시설 ${cp.needTop}곳`,
      now: `${cp.have}/${cp.need} · ${Math.min(cp.top, cp.needTop)}/${cp.needTop}`,
      pct: (r(cp.have, cp.need) + r(cp.top, cp.needTop) + (cp.rankOk ? 1 : 0)) / 3,
      left: cl,
    },
    { id: 'science' as WinId, icon: '🔬', name: '과학 승리', goal: '국가 대계획 3가지 완성', now: `${megaTotal(s)} / ${MEGAS.length * MEGA_STAGES}단계`, pct: r(megaTotal(s), MEGAS.length * MEGA_STAGES), left: null },
  ] as const).map((l) => (hasWon(s, names[l.id]) ? { ...l, done: true, pct: 1, left: null } : { ...l, done: false }));
}

/** 지키는 중인 승리가 있으면 '!' */
export const winBadge = (s: ScreenProps['state']) => (winLines(s).some((l) => l.left !== null) ? '!' : null);

export function VictoryPanel(props: ScreenProps) {
  const { state, actions } = props;
  const lines = winLines(state);
  const score = (l: (typeof lines)[number]) => (l.done ? -1 : l.left !== null ? 2 : l.pct);
  const best = [...lines].sort((a, b) => score(b) - score(a))[0];
  const [pick, setPick] = useState<WinId>(best.id);
  const ready = state.player.rankIndex >= VICTORY_RANK;
  const p = victoryProgress(state);
  const me = state.player.countryId;
  const allies = COUNTRIES.filter((c) => c.id !== me && isAlive(state.world, c.id) && relationOf(state.world, me, c.id) === '연합');
  return (
    <>
      <Card title="🏆 승리 조건" right={<small className="muted">여섯 중 하나만 이루면 승리</small>}>
        <p className="small">
          {ready ? (
            <span className="ok">✅ 「{RANKS[VICTORY_RANK].name}」 호칭이라 이제 승리할 수 있어요.</span>
          ) : (
            <span className="warn">🔒 승리는 「{RANKS[VICTORY_RANK].name}」 호칭이 된 뒤에 이뤄져요. 그 전에도 미리 준비해 둘 수 있어요.</span>
          )}
        </p>
        <div className="tiles c2 win-tiles">
          {lines.map((l) => (
            <Tile
              key={l.id}
              icon={l.icon}
              label={l.name}
              sub={l.done ? '✅ 이뤘어요' : l.left !== null ? `지키는 중 · ${timeLeft(l.left)} 남음` : l.now}
              badge={l.done ? '✅' : l.left !== null ? '!' : l.id === best.id ? '가까움' : null}
              tone={pick === l.id ? 'gold' : undefined}
              onClick={() => setPick(l.id)}
            >
              <KitMeter value={l.pct} max={1} tone={l.left !== null ? 'green' : 'gold'} />
              <small className="muted">{Math.round(l.pct * 100)}%</small>
            </Tile>
          ))}
        </div>
        <p className="small muted">조건을 채운 채 {HOLD_DAYS}일 동안 지키면 이겨요. 아래 칸을 누르면 자세히 볼 수 있어요.</p>
      </Card>
      <SecretCard state={state} />
      {pick === 'influence' && <InfluencePart state={state} />}
      {pick === 'conquer' && (
        <Card title="⚔️ 정복 승리" right={<small className="muted">혼자 세계 도시 {ALONE_PCT}%</small>}>
          <div className="small">
            우리 도시 {p.mine} / {p.needAlone} <span className="muted">(세계 {p.total}개)</span>
            <Meter have={p.mine} need={p.needAlone} />
            {p.capsNeed > 0 && (
              <div className="caps-row">
                {p.caps.map((c) => (
                  <span key={c.id} className={c.held ? 'on' : ''}>
                    {c.held ? '✅' : '⬜'} {c.name} 수도 {c.city}
                  </span>
                ))}
              </div>
            )}
            {p.captured.length ? <>점령한 도시: {p.captured.join(', ')}</> : <span className="muted">아직 점령한 도시가 없어요.</span>}
          </div>
          <p className="small muted">국방 → 작전에서 대전투로 적 도시를 차지하세요. 점령지는 가끔 반란이 일어나니 부대와 복지로 지키세요.</p>
        </Card>
      )}
      {pick === 'allied' && (
        <Card title="🤝 연합 승리" right={<small className="muted">우리+연합국 도시 {Math.round(ALLIED_SHARE * 100)}%</small>}>
          <div className="small">
            우리 + 연합국 도시 {p.allied} / {p.needAllied}
            <Meter have={p.allied} need={p.needAllied} />
            연합국: {allies.length ? allies.map((c, i) => (
                  <span key={c.id}>
                    {i ? ' · ' : ''}
                    {FLAG[c.id]} {c.name}
                  </span>
                )) : <span className="muted">아직 없어요</span>}
          </div>
          <p className="small muted">외교 → 협정·외교관계에서 호감을 쌓아 연합을 맺으면 연합국 도시도 함께 세요.</p>
        </Card>
      )}
      {pick === 'peace' && (
        <Card title="🕊️ 평화 승리" right={<small className="muted">헌장 {PEACE_HOLD_DAYS}일 지키기</small>}>
          <PeacePart state={state} onPropose={() => actions.apply(proposePeace)} />
        </Card>
      )}
      {pick === 'culture' && <CultureWinPanel state={state} />}
      {pick === 'science' && (
        <Card title="🔬 과학 승리" right={<small className="muted">대계획 3가지 완성</small>}>
          <div className="small">
            {MEGAS.map((m) => (
              <div key={m.id}>
                {m.icon} {m.name} {megaLv(state, m.id)} / {MEGA_STAGES}단계
                <Meter have={megaLv(state, m.id)} need={MEGA_STAGES} />
              </div>
            ))}
          </div>
          <p className="small muted">경제 → 국가 사업 → 국가 대계획에서 한 단계씩 진행해요. 전쟁을 하지 않아도 이길 수 있는 길이에요.</p>
        </Card>
      )}
      <WinsDone {...props} />
      <HallList />
    </>
  );
}

/** 11-28 중-7 비밀 목표 3개 */
function SecretCard({ state }: { state: ScreenProps['state'] }) {
  const list = secretsOf(state);
  return (
    <Card title="🎯 비밀 목표" right={<small className="muted">{list.filter((o) => o.done).length}/{list.length}</small>}>
      <p className="small muted">판마다 나라에 맞춰 받는 숨은 목표예요. 하나 이룰 때마다 💎 +{SECRET_RUBY} · 세계 영향력 +{SECRET_INF}.</p>
      {list.map((o, i) => (
        <div key={i} className={`row ${o.done ? 'ok' : ''}`} style={{ gap: 6 }}>
          <span>{o.done ? '✅' : '🔒'}</span>
          <b className="small">{secretName(o)}</b>
          <small className="muted" style={{ flex: 1 }}>{secretText(o)}</small>
        </div>
      ))}
    </Card>
  );
}

/** 11-28 세계 영향력: 갈래별 점수 · 순위 · 12주 점수 마감 */
function InfluencePart({ state }: { state: ScreenProps['state'] }) {
  const ip = influenceProgress(state);
  const me = state.player.countryId;
  const top = ip.rank.slice(0, 6);
  const mine = ip.mine;
  return (
    <Card title="🌐 세계 영향력 승리" right={<small className="muted">점수 마감까지 {timeLeft(ip.left)}</small>}>
      <p className="small">
        {INF_WIN}점 이상이면서 2등의 {INF_LEAD}배 이상을 {INF_HOLD_DAYS}일 지키면 이겨요. 실제 {INF_DEADLINE_DAYS / 7}주가 지나면 점수 마감: 그때 1등이면 승리예요.
      </p>
      {mine && (
        <div className="inf-branches">
          {INF_BRANCHES.map((b) => (
            <div key={b.id} className="promo-line">
              <small>
                {b.icon} {b.name}
              </small>
              <KitMeter value={mine[b.id]} max={b.max} tone="gold" />
              <small className="muted">
                {mine[b.id]}/{b.max}
              </small>
            </div>
          ))}
          {mine.bonus > 0 && <p className="small ok">⭐ 덤 +{mine.bonus}점 ({infBonusRows(state, me).map(([k, v]) => `${k} +${v}`).join(' · ')})</p>}
          <p className="small muted">{INF_BRANCHES.map((b) => `${b.icon}${b.how}`).join(' · ')}</p>
        </div>
      )}
      <div className="inf-rank">
        {top.map((r, i) => (
          <div key={r.id} className={`row ${r.id === me ? 'ok' : ''}`} style={{ gap: 6 }}>
            <small style={{ width: 22 }}>{i + 1}위</small>
            <span>{FLAG[r.id] ?? ''}</span>
            <small style={{ flex: 1 }}>{countryById(r.id).name}</small>
            <b className="small">{r.total}점</b>
          </div>
        ))}
        {ip.place > top.length && (
          <div className="row ok" style={{ gap: 6 }}>
            <small style={{ width: 22 }}>{ip.place}위</small>
            <span>{FLAG[me] ?? ''}</span>
            <small style={{ flex: 1 }}>{countryById(me).name}</small>
            <b className="small">{mine?.total ?? 0}점</b>
          </div>
        )}
      </div>
    </Card>
  );
}
