// 승리 조건 진행 카드 · 엔딩 · 명예의 전당
import { RANKS } from '../data/ranks';
import { loadHall, recordHall, victoryProgress, VICTORY_RANK, type HallEntry } from '../game/victory';
import { Card } from './common';
import type { ScreenProps } from './screens';

function Meter({ have, need }: { have: number; need: number }) {
  return (
    <span className="bar">
      <span className="bar-fill" style={{ width: `${Math.min(100, (have / need) * 100)}%` }} />
    </span>
  );
}

export function VictoryCard({ state }: ScreenProps) {
  const p = victoryProgress(state);
  const ready = state.player.rankIndex >= VICTORY_RANK;
  return (
    <Card title="승리 조건" right={<small className="muted">{ready ? '총사령관 · 하나만 이루면 승리' : `${RANKS[VICTORY_RANK].name}이 되면 열림`}</small>}>
      <div className="small">
        ① 연합 승리: 우리 + 연합국 도시 {p.allied} / {p.needAllied}
        <Meter have={p.allied} need={p.needAllied} />
        ② 정복 승리: 우리 도시 {p.mine} / {p.needAlone}
        <Meter have={p.mine} need={p.needAlone} />
      </div>
      <p className="small muted">대전투로 적 도시를 차지하고, 만든 부대와 복지로 점령지를 지키세요. 점령지는 가끔 반란이 일어나요.</p>
    </Card>
  );
}

export function EndingCard({ state, actions }: ScreenProps) {
  const e = state.ending;
  if (!e) return null;
  return (
    <div className="ending">
      <h2>🏆 {e.kind}!</h2>
      <p>
        {e.name} 총사령관이 이끈 {e.country}이(가) 전쟁 {e.day}일째에 전쟁을 끝냈어요.
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
