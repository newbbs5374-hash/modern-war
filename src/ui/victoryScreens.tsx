// 승리 조건 진행 카드 · 엔딩 · 명예의 전당
import { RANKS } from '../data/ranks';
import { ALLIED_SHARE, ALONE_SHARE, HOLD_DAYS, holdLeft, loadHall, recordHall, victoryProgress, VICTORY_RANK, type HallEntry } from '../game/victory';
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
          ☮️ 세계 평화 헌장 제안 (국방예산 {PEACE_COST.toLocaleString('ko-KR')}){why ? ` · ${why}` : ''}
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
      <h2>{e.kind === '평화 승리' ? '🕊️' : e.kind === '문화 승리' ? '🎨' : '🏆'} {e.kind}!</h2>
      <p>
        {e.name} 지도자가 이끈 {e.country}이(가) {e.day}일째에 {e.kind === '평화 승리' ? '세계 평화 헌장으로 전쟁 없는 세계를 열었어요' : e.kind === '문화 승리' ? '문화로 세계 사람들의 마음을 얻었어요' : '전쟁을 끝냈어요'}.
      </p>
      <p className="small">
        도시 {e.cities}개{e.captured.length ? ` · 점령: ${e.captured.join(', ')}` : ''}
        {e.generals.length ? ` · 장군: ${e.generals.join(', ')}` : ''}
      </p>
      <p className="small muted">명예의 전당에 기록하고 다른 나라로 새 판을 시작할 수 있어요. 계속 둘러봐도 돼요.</p>
      <button
        className="primary"
        onClick={() => {
          if (!window.confirm('명예의 전당에 기록하고 새 판을 시작할까요? 지금 판은 끝나요.')) return;
          recordHall(e, Date.now());
          actions.reset();
        }}
      >
        명예의 전당에 올리고 새 나라로 시작
      </button>
    </div>
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
          </span>
          <span className="muted">{h.day}일째 · 도시 {h.cities}</span>
        </div>
      ))}
    </div>
  );
}

/* ───────── 👤 개인 → 🏆 승리(11-24 대장 요청: 모든 승리 조건을 한곳에서) ───────── */
const ALONE_PCT = Math.round(ALONE_SHARE * 100);
type WinId = 'conquer' | 'allied' | 'peace' | 'culture';

/** 승리 4가지의 진행률(0~1)과 지키는 중 남은 시간 */
export function winLines(s: ScreenProps['state']) {
  const p = victoryProgress(s);
  const pr = peaceProgress(s);
  const cp = cultureProgress(s);
  const hold = holdLeft(s);
  const conquerOn = hold !== null && p.mine >= p.needAlone;
  const alliedOn = hold !== null && !conquerOn;
  const pl = peaceLeft(s);
  const cl = cultureWinLeft(s);
  const r = (a: number, b: number) => Math.max(0, Math.min(1, a / Math.max(1, b)));
  return [
    { id: 'conquer' as WinId, icon: '⚔️', name: '정복 승리', goal: `우리 도시 ${p.needAlone}개(세계 ${ALONE_PCT}%)`, now: `${p.mine} / ${p.needAlone}`, pct: r(p.mine, p.needAlone), left: conquerOn ? hold : null },
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
  ];
}

/** 지키는 중인 승리가 있으면 '!' */
export const winBadge = (s: ScreenProps['state']) => (winLines(s).some((l) => l.left !== null) ? '!' : null);

export function VictoryPanel(props: ScreenProps) {
  const { state, actions } = props;
  const lines = winLines(state);
  const best = [...lines].sort((a, b) => (b.left !== null ? 2 : b.pct) - (a.left !== null ? 2 : a.pct))[0];
  const [pick, setPick] = useState<WinId>(best.id);
  const ready = state.player.rankIndex >= VICTORY_RANK;
  const p = victoryProgress(state);
  const me = state.player.countryId;
  const allies = COUNTRIES.filter((c) => c.id !== me && isAlive(state.world, c.id) && relationOf(state.world, me, c.id) === '연합');
  return (
    <>
      <Card title="🏆 승리 조건" right={<small className="muted">넷 중 하나만 이루면 승리</small>}>
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
              sub={l.left !== null ? `지키는 중 · ${timeLeft(l.left)} 남음` : l.now}
              badge={l.left !== null ? '!' : l.id === best.id ? '가까움' : null}
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
      {pick === 'conquer' && (
        <Card title="⚔️ 정복 승리" right={<small className="muted">혼자 세계 도시 {ALONE_PCT}%</small>}>
          <div className="small">
            우리 도시 {p.mine} / {p.needAlone} <span className="muted">(세계 {p.total}개)</span>
            <Meter have={p.mine} need={p.needAlone} />
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
      <HallList />
    </>
  );
}
