// 승리 조건 진행 카드 · 엔딩 · 명예의 전당
import { RANKS } from '../data/ranks';
import { HOLD_DAYS, holdLeft, loadHall, recordHall, victoryProgress, VICTORY_RANK, type HallEntry } from '../game/victory';
import { timeLeft } from './officerScreens';
import { Card } from './common';
import { FLAG } from './flag';
import { PEACE_COST, PEACE_FAVOR, PEACE_HOLD_DAYS, canProposePeace, peaceLeft, peaceName, peaceOf, peaceProgress, proposePeace } from '../game/peace';
import type { ScreenProps } from './screens';

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
      {holdLeft(state) !== null && <p className="small result">🏁 조건 달성! {timeLeft(holdLeft(state)!)} 더 지키면 승리해요.</p>}
      <p className="small muted">셋 중 하나를 {HOLD_DAYS}일 동안 지키면 이겨요. 지도자 외교로 연합국을 늘릴 수 있어요. 대전투로 적 도시를 차지하고, 만든 부대와 복지로 점령지를 지키세요. 점령지는 가끔 반란이 일어나요.</p>
    </Card>
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
      <h2>{e.kind === '평화 승리' ? '🕊️' : '🏆'} {e.kind}!</h2>
      <p>
        {e.name} 지도자가 이끈 {e.country}이(가) {e.day}일째에 {e.kind === '평화 승리' ? '세계 평화 헌장으로 전쟁 없는 세계를 열었어요' : '전쟁을 끝냈어요'}.
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
