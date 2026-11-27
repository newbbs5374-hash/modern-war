// 11-27 4장 구조: 본부 '주요 임무' 맨 위 막 카드 + 막 설명 창(조건 진행·다음 장).
import { useState } from 'react';
import type { GameState } from '../game/state';
import { ACTS, actGoals, actInfo, neighborsOf } from '../game/acts';
import { ACT_AI, ACT_REWARD, GRAND_EXTRA_MAX, GRAND_PER_DAY, actOf } from '../game/balance';
import { countryById } from '../data/world';
import { Modal } from './kit';

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
