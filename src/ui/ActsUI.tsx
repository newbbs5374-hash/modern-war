// 11-27 4장 구조: 본부 '주요 임무' 맨 위 막 카드 + 막 설명 창(조건 진행·다음 장).
import { useState } from 'react';
import type { GameState } from '../game/state';
import { ACTS, actGoals, actInfo, neighborsOf } from '../game/acts';
import { ACT_AI, ACT_REWARD, GRAND_EXTRA_MAX, GRAND_PER_DAY, actOf } from '../game/balance';
import { countryById } from '../data/world';
import { Modal } from './kit';
import { cityById } from '../data/cities';
import { counterAutoChance, counterOf, counterPlan, type Counter } from '../game/counter';
import { setPendingPlan } from '../battle/spec';
import type { Screen } from './nav';

export function ActCard({ state }: { state: GameState }) {
  const [open, setOpen] = useState(false);
  if (state.world.act == null) return null;
  const a = actInfo(state);
  const goals = actGoals(state);
  const done = goals.filter((g) => g.done).length;
  return (
    <>
      <button className="hq act-hq" onClick={() => setOpen(true)}>
        <span>{a.icon}</span>
        <span className="hq-main">
          <b>
            {a.n}장 {a.name}
          </b>
          <small>{goals.length ? `다음 장 조건 ${done}/${goals.length}` : a.next}</small>
        </span>
      </button>
      {open && <ActModal state={state} onClose={() => setOpen(false)} />}
    </>
  );
}

function ActModal({ state, onClose }: { state: GameState; onClose: () => void }) {
  const act = actOf(state.world);
  const goals = actGoals(state);
  const nb = neighborsOf(state.player.countryId).map((id) => countryById(id).name).join(' · ');
  return (
    <Modal title="이번 판의 4장" icon="🎬" onClose={onClose} footer={<button onClick={onClose}>닫기</button>}>
      <div className="act-steps">
        {ACTS.map((x) => (
          <div key={x.n} className={`act-step ${x.n === act ? 'on' : x.n < act ? 'past' : ''}`}>
            <b>
              {x.icon} {x.n}장 {x.name}
              {x.n < act ? ' ✓' : ''}
            </b>
            <small>{x.text}</small>
            {x.n > 1 && <small className="muted">다른 나라 힘 ×{ACT_AI[x.n]}</small>}
          </div>
        ))}
      </div>
      {goals.length > 0 && (
        <>
          <p className="act-sub">
            <b>{act + 1}장으로 가는 조건</b> <small className="muted">· 루비·가속권으로 건너뛸 수 없어요</small>
          </p>
          {goals.map((g, i) => (
            <div key={i} className={`act-goal ${g.done ? 'done' : ''}`}>
              <span>{g.done ? '✅' : g.icon}</span>
              <span className="act-goal-main">
                <b>{g.text}</b>
                <i className="act-bar">
                  <i style={{ width: `${Math.round((g.have / Math.max(1, g.need)) * 100)}%` }} />
                </i>
              </span>
              <small>
                {g.have.toLocaleString('ko-KR')}/{g.need.toLocaleString('ko-KR')}
                {g.unit}
              </small>
            </div>
          ))}
          <p className="muted" style={{ fontSize: 12 }}>
            장이 넘어가면 💎 {ACT_REWARD[act].ruby} · 🎫 {ACT_REWARD[act].boosts}
          </p>
        </>
      )}
      {act === 2 && <p style={{ fontSize: 13 }}>🧭 이웃 나라: {nb}</p>}
      <p className="muted" style={{ fontSize: 12 }}>
        ⚔️ 대전투는 하루 {GRAND_PER_DAY}번(루비로 {GRAND_EXTRA_MAX}번 더). 빼앗긴 우리 도시 되찾기는 세지 않아요.
      </p>
    </Modal>
  );
}

const leftText = (ms: number) => {
  const m = Math.max(0, Math.round(ms / 60000));
  return m >= 60 ? `${Math.floor(m / 60)}시간 ${m % 60}분` : `${m}분`;
};

/** 본부 '주요 임무': 반격 경보 카드 + 직접 막기·맡기기 창 */
export function CounterCards({ state, go }: { state: GameState; go: (s: Screen) => void }) {
  const [open, setOpen] = useState<Counter | null>(null);
  const list = counterOf(state).list;
  if (!list.length) return null;
  const pct = Math.round(counterAutoChance(state) * 100);
  return (
    <>
      {list.map((c) => (
        <button key={c.id} className="hq hot counter-hq" onClick={() => setOpen(c)}>
          <span>🚨</span>
          <span className="hq-main">
            <b>반격 경보 · {cityById(c.city).name}</b>
            <small>
              {countryById(c.from).name}군 도착까지 {leftText(c.dueMs - state.worldMs)}
            </small>
          </span>
        </button>
      ))}
      {open && (
        <Modal title={`${cityById(open.city).name} 반격 경보`} icon="🚨" onClose={() => setOpen(null)}>
          <p className="act-sub">
            {countryById(open.from).name}군이 {cityById(open.city).name}을(를) 되찾으러 와요. 도착까지 <b>{leftText(open.dueMs - state.worldMs)}</b>.
          </p>
          <div className="counter-pick">
            <button
              className="primary"
              onClick={() => {
                setPendingPlan(counterPlan(state, open));
                setOpen(null);
                go('battle');
              }}
            >
              <b>🛡️ 직접 막기</b>
              <small>3D 방어전 한 판 · 시간까지 버티면 승리 · 별 3개면 🎫 +1</small>
            </button>
            <button onClick={() => setOpen(null)}>
              <b>🤝 부대에 맡기기</b>
              <small>도착하면 알아서 맞아요 · 막아 낼 확률 {pct}%</small>
            </button>
          </div>
          <p className="act-sub">막아 내면 노획 예산과 신뢰도를 얻고, 지면 도시를 다시 빼앗겨요. 부대 전투력이 높을수록 맡겨도 잘 막아요.</p>
        </Modal>
      )}
    </>
  );
}
