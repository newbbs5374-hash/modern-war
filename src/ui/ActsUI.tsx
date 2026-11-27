// 11-27 4장 구조: 본부 '주요 임무' 맨 위 막 카드 + 막 설명 창(조건 진행·다음 장).
import { canNet, canStrike, interceptRate, netCost, raidOf, raiseNet, strikeChance, strikeFirst } from '../game/missileWar';
import { useState } from 'react';
import { act as secAct, canAct as canSec, secOf, sweepChance, talkChance as secTalkChance, talkCost as secTalkCost } from '../game/security';
import { logOf, medals, winRate } from '../game/battleLog';
import { WC_GIVE_MAX, WC_RUBY, canGive, canSide, give, giveCost, pickSide, wcById, wcOf } from '../game/worldCrisis';
import { gameClock, type GameState } from '../game/state';
import { ACTS, actGoals, actInfo, neighborsOf } from '../game/acts';
import { ACT_AI, ACT_REWARD, GRAND_EXTRA_MAX, GRAND_PER_DAY, actOf } from '../game/balance';
import { countryById } from '../data/world';
import { Modal } from './kit';
import { actArt } from './scenes';
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
      {actArt(act) && (
        <div className="act-cover">
          <img src={actArt(act)!} alt="" draggable={false} />
          <b>
            {ACTS[act - 1].icon} {act}장 {ACTS[act - 1].name}
          </b>
        </div>
      )}
      <div className="act-steps">
        {ACTS.map((x) => (
          <div key={x.n} className={`act-step ${x.n === act ? 'on' : x.n < act ? 'past' : ''}`}>
            {actArt(x.n) && <img className="act-thumb" src={actArt(x.n)!} alt="" draggable={false} />}
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

/** 11-27 전투 6: 미사일 경보(본부). 요격망을 켜거나 발사대를 먼저 침 */
export function RaidCards({ state, apply, applyWith }: { state: GameState; apply: (f: (s: GameState) => GameState) => void; applyWith: <T>(f: (s: GameState) => { state: GameState; out: T }) => T | undefined }) {
  const [open, setOpen] = useState<number | null>(null);
  const [msg, setMsg] = useState('');
  const list = raidOf(state).list;
  const r = list.find((x) => x.id === open) ?? null;
  if (!list.length && !msg) return null;
  return (
    <>
      {list.map((x) => (
        <button key={x.id} className="hq hot counter-hq" onClick={() => (setMsg(''), setOpen(x.id))}>
          <span>🚀</span>
          <span className="hq-main">
            <b>
              미사일 경보 · {cityById(x.city).name} · {x.n}발
            </b>
            <small>
              {countryById(x.from).name} · 떨어지기까지 {leftText(x.dueMs - state.worldMs)}
              {x.net ? ' · 요격망 켬' : ''}
            </small>
          </span>
        </button>
      ))}
      {(r || msg) && open != null && (
        <Modal title={r ? `${cityById(r.city).name} 미사일 경보` : '미사일 경보'} icon="🚀" onClose={() => (setOpen(null), setMsg(''))}>
          {r ? (
            <>
              <p className="act-sub">
                {countryById(r.from).name}이(가) {cityById(r.city).name}(으)로 미사일·드론 <b>{r.n}발</b>을 쏘려 해요. 떨어지기까지 <b>{leftText(r.dueMs - state.worldMs)}</b>. 지금 요격률 {Math.round(interceptRate(state, r.net) * 100)}%.
              </p>
              <div className="counter-pick">
                <button className="primary" disabled={!!canNet(state, r.id)} onClick={() => apply((s) => raiseNet(s, r.id))}>
                  <b>🛡️ 요격망 가동</b>
                  <small>{canNet(state, r.id) ?? `나라 예산 −${netCost(state).toLocaleString('ko-KR')} · 요격률 ${Math.round(interceptRate(state, true) * 100)}%로`}</small>
                </button>
                <button disabled={!!canStrike(state, r.id)} onClick={() => setMsg(applyWith((s) => { const o = strikeFirst(s, r.id); return { state: o.state, out: o.text }; }) ?? '')}>
                  <b>🎯 발사대 선제 타격</b>
                  <small>{canStrike(state, r.id) ?? `성공 ${Math.round(strikeChance(state) * 100)}% · 성공하면 공습 취소`}</small>
                </button>
              </div>
              <p className="act-sub">맞은 발마다 그 도시 민심과 방어도가 깎이고 복구비가 나가요. 방공 부대가 많을수록 요격률이, 미사일·공군 부대가 많을수록 선제 타격 성공률이 올라요.</p>
            </>
          ) : null}
          {msg && <p className="small sch-msg">{msg}</p>}
        </Modal>
      )}
    </>
  );
}

/** 11-27 전투 8: 주간 세계 위기(본부). 편을 정하고 힘을 보탬 */
export function WorldCrisisCard({ state, apply }: { state: GameState; apply: (f: (s: GameState) => GameState) => void }) {
  const [open, setOpen] = useState(false);
  const o = wcOf(state).open;
  if (!o) return null;
  const d = wcById(o.def);
  const tot = Math.max(1, o.pa + o.pb);
  const names = (ids: string[]) => ids.map((id) => countryById(id).name).join(' · ');
  return (
    <>
      <button className={`hq counter-hq${o.side ? '' : ' hot'}`} onClick={() => setOpen(true)}>
        <span>{d.icon}</span>
        <span className="hq-main">
          <b>세계 위기 · {d.title}</b>
          <small>
            {o.side ? (o.side === 'n' ? '중립' : `「${o.side === 'a' ? d.a : d.b}」 편`) : '편을 정하세요'} · 끝나기까지 {leftText(o.endMs - state.worldMs)}
          </small>
        </span>
      </button>
      {open && (
        <Modal title={`세계 위기 · ${d.title}`} icon={d.icon} onClose={() => setOpen(false)}>
          <p className="act-sub">{d.text}</p>
          <div className="wc-bar">
            <i style={{ width: `${(o.pa / tot) * 100}%` }} />
          </div>
          <div className="wc-sides">
            <div className={o.side === 'a' ? 'on' : ''}>
              <b>{d.a}</b>
              <em>{Math.round(o.pa)}점</em>
              <small>{names(o.a)}</small>
            </div>
            <div className={o.side === 'b' ? 'on' : ''}>
              <b>{d.b}</b>
              <em>{Math.round(o.pb)}점</em>
              <small>{names(o.b)}</small>
            </div>
          </div>
          {!canSide(state) ? (
            <div className="counter-pick">
              <button className="primary" onClick={() => apply((s) => pickSide(s, 'a'))}>
                <b>{d.a}</b>
                <small>이 편 나라 호감 +3 · 맞은편 −3</small>
              </button>
              <button className="primary" onClick={() => apply((s) => pickSide(s, 'b'))}>
                <b>{d.b}</b>
                <small>이 편 나라 호감 +3 · 맞은편 −3</small>
              </button>
              <button onClick={() => apply((s) => pickSide(s, 'n'))}>
                <b>중립</b>
                <small>얻는 것도 잃는 것도 없어요</small>
              </button>
            </div>
          ) : o.side !== 'n' ? (
            <button className="wide gold" disabled={!!canGive(state)} onClick={() => apply(give)}>
              💪 힘 보태기 {o.gave}/{WC_GIVE_MAX} · {canGive(state) ?? `나라 예산 −${giveCost(state).toLocaleString('ko-KR')}`}
            </button>
          ) : null}
          <p className="act-sub">
            사흘 뒤 점수가 높은 편이 이겨요. 이긴 편에 섰으면 💎{WC_RUBY}와 명성, 일주일 동안 {d.effText} 덤을 받고, 진 편이면 그 절반만큼 손해를 봐요.
          </p>
        </Modal>
      )}
    </>
  );
}

/** 11-27 전투 9: 점령지 저항 조직(본부). 소탕하거나 회유 */
export function SecurityCards({ state, applyWith }: { state: GameState; applyWith: <T>(f: (s: GameState) => { state: GameState; out: T }) => T | undefined }) {
  const [open, setOpen] = useState<number | null>(null);
  const [msg, setMsg] = useState('');
  const list = secOf(state).list;
  const c = list.find((x) => x.id === open) ?? null;
  if (!list.length && !msg) return null;
  const run = (how: 'sweep' | 'talk') => setMsg(applyWith((s) => { const o = secAct(s, open!, how); return { state: o.state, out: o.text }; }) ?? '');
  return (
    <>
      {list.map((x) => (
        <button key={x.id} className="hq hot counter-hq" onClick={() => (setMsg(''), setOpen(x.id))}>
          <span>🕵️</span>
          <span className="hq-main">
            <b>
              저항 조직 · {cityById(x.city).name} · {['작은', '중간', '큰'][x.size - 1]} 조직
            </b>
            <small>파괴 공작까지 {leftText(x.dueMs - state.worldMs)}</small>
          </span>
        </button>
      ))}
      {(c || msg) && open != null && (
        <Modal title={c ? `${cityById(c.city).name} 치안 작전` : '치안 작전'} icon="🕵️" onClose={() => (setOpen(null), setMsg(''))}>
          {c && (
            <>
              <p className="act-sub">
                점령한 {cityById(c.city).name}에 저항 조직이 숨어 있어요. <b>{leftText(c.dueMs - state.worldMs)}</b> 안에 손쓰지 않으면 파괴 공작으로 민심과 방어도가 깎여요.
              </p>
              <div className="counter-pick">
                <button className="primary" disabled={!!canSec(state, c.id, 'sweep')} onClick={() => run('sweep')}>
                  <b>🪖 소탕</b>
                  <small>성공 {Math.round(sweepChance(state, c.size) * 100)}% · 명성 + · 민심 조금 −</small>
                </button>
                <button disabled={!!canSec(state, c.id, 'talk')} onClick={() => run('talk')}>
                  <b>🤝 회유</b>
                  <small>{canSec(state, c.id, 'talk') ?? `성공 ${Math.round(secTalkChance(state, c.size) * 100)}% · 예산 −${secTalkCost(state).toLocaleString('ko-KR')} · 민심 +`}</small>
                </button>
              </div>
            </>
          )}
          {msg && <p className="small sch-msg">{msg}</p>}
        </Modal>
      )}
    </>
  );
}

/** 11-27 전투 10: 전투 기록관(작전 화면) */
export function BattleLogCard({ state }: { state: GameState }) {
  const [open, setOpen] = useState(false);
  const b = logOf(state);
  const ms = medals(state);
  const day = (t: number) => `${gameClock(t).dayNumber}일째`;
  return (
    <>
      <button className="hq blog-hq" onClick={() => setOpen(true)}>
        <span>📜</span>
        <span className="hq-main">
          <b>전투 기록관</b>
          <small>
            {b.wins}승 {b.losses}패 · 승률 {Math.round(winRate(state) * 100)}% · 연승 {b.streak} · 훈장 {ms.filter((m) => m.got).length}/{ms.length}
          </small>
        </span>
      </button>
      {open && (
        <Modal title="전투 기록관" icon="📜" onClose={() => setOpen(false)}>
          <div className="blog-stats">
            <span><b>{b.wins}</b>승</span>
            <span><b>{b.losses}</b>패</span>
            <span><b>{Math.round(winRate(state) * 100)}%</b>승률</span>
            <span><b>{b.best}</b>최고 연승</span>
          </div>
          <div className="blog-medals">
            {ms.map((m) => (
              <div key={m.id} className={m.got ? 'on' : ''} title={m.need}>
                <span>{m.icon}</span>
                <b>{m.name}</b>
                <small>{m.need}</small>
              </div>
            ))}
          </div>
          {b.list.length ? (
            <ul className="blog-list">
              {b.list.map((r, i) => (
                <li key={i} className={r.win ? 'win' : 'lose'}>
                  <em>{r.win ? '승' : '패'}</em>
                  <span>
                    <b>{r.title}</b>
                    <small>
                      {day(r.t)} · {r.kind}
                      {r.city ? ` · ${cityById(r.city).name}` : ''} · {r.direct ? '직접 지휘' : '맡김'}
                    </small>
                  </span>
                  <i>{r.win && r.stars ? '★'.repeat(r.stars) : ''}</i>
                </li>
              ))}
            </ul>
          ) : (
            <p className="small muted">아직 적힌 전투가 없어요. 대전투·작전·반격 방어가 끝나면 여기에 남아요.</p>
          )}
        </Modal>
      )}
    </>
  );
}
