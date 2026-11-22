import { useState } from 'react';
import { BLOCS, COUNTRIES, FAITHS, countryById, startingRelation } from '../data/world';
import { RANKS } from '../data/ranks';
import {
  budgetPerDay,
  gameClock,
  pendingCap,
  salaryPerDay,
  troopsPerDay,
  type GameState,
} from '../game/state';
import { PENDING_CAP_HOURS } from '../game/balance';
import { WorldMap } from './WorldMap';

const HOUR = 60 * 60 * 1000;
const fmt = (n: number) => Math.floor(n).toLocaleString('ko-KR');
const pad = (n: number) => String(n).padStart(2, '0');

export interface GameActions {
  claim: () => void;
  save: () => void;
  load: () => void;
  exportCode: () => string;
  importCode: (code: string) => string | null;
  reset: () => void;
  skip: (ms: number) => void;
  setSpeed: (x: number) => void;
  setRank: (i: number) => void;
}

interface Props {
  state: GameState;
  speed: number;
  notice: string;
  actions: GameActions;
}

export function GameScreen({ state, speed, notice, actions }: Props) {
  const me = countryById(state.player.countryId);
  const myNation = state.nations[me.id];
  const [selected, setSelected] = useState<string>(me.id);
  const clock = gameClock(state.worldMs);
  const rank = RANKS[state.player.rankIndex];
  const cap = pendingCap(state);
  const pending = state.player.pendingSalary;

  return (
    <div className="game">
      <header className="topbar">
        <div>
          <div className="clock">
            {clock.year}년 {clock.month}월 {clock.day}일 {pad(clock.hour)}:{pad(clock.minute)}
          </div>
          <div className="muted small">
            전쟁 {clock.dayNumber}일째 · 실제 1시간 = 게임 하루{speed !== 1 ? ` · 시험 속도 ×${speed}` : ''}
          </div>
        </div>
        <div className="who">
          <b>
            {me.name} {rank.name} {state.player.name}
          </b>
          <div className="muted small">지휘: {rank.unit}</div>
        </div>
      </header>

      {notice && <div className="notice">{notice}</div>}

      <section className="panels">
        <div className="panel">
          <h3>내 주머니</h3>
          <div className="big-num">{fmt(state.player.salary)} 봉급</div>
          <div className="small muted">시간당 {fmt(salaryPerDay(state))} (실제 1시간 = 하루치)</div>
          <div className="bar">
            <div className="bar-fill" style={{ width: `${Math.min(100, (pending / cap) * 100)}%` }} />
          </div>
          <div className="small">
            쌓인 봉급 {fmt(pending)} / 한도 {fmt(cap)} ({PENDING_CAP_HOURS}시간치)
          </div>
          <button className="primary" disabled={pending < 1} onClick={actions.claim}>
            봉급 받기
          </button>
        </div>

        <div className="panel">
          <h3>{me.name} 나라 금고</h3>
          <div className="big-num">{fmt(myNation.treasury)} 국방예산</div>
          <div className="small muted">시간당 +{fmt(budgetPerDay(me.id))}</div>
          <div className="big-num">{fmt(myNation.troops)} 명</div>
          <div className="small muted">시간당 모병 +{fmt(troopsPerDay(me.id))}</div>
          <div className="small muted">나라 운영은 아직 AI 지도자가 합니다(준장부터 일부를 맡음).</div>
        </div>
      </section>

      <section className="panel">
        <h3>세계 지도</h3>
        <WorldMap playerCountryId={me.id} selectedId={selected} onSelect={setSelected} />
        <div className="legend small">
          {Object.values(BLOCS).map((b) => (
            <span key={b.name}>
              <i style={{ background: b.color }} /> {b.name}
            </span>
          ))}
          <span>
            <i className="line war" /> 전쟁 중
          </span>
          <span>
            <i className="line truce" /> 휴전 중
          </span>
          <span>★ 내 나라</span>
        </div>
        <CountryInfo id={selected} me={me.id} state={state} />
      </section>

      <section className="panel">
        <h3>모든 나라 (실시간으로 쌓임)</h3>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>나라</th>
                <th>묶음</th>
                <th>우리와</th>
                <th>국방예산</th>
                <th>병력</th>
                <th>난이도</th>
              </tr>
            </thead>
            <tbody>
              {COUNTRIES.map((c) => (
                <tr key={c.id} className={c.id === selected ? 'sel' : ''} onClick={() => setSelected(c.id)}>
                  <td>{c.name}</td>
                  <td>{BLOCS[c.bloc].name}</td>
                  <td>{c.id === me.id ? '—' : startingRelation(me.id, c.id)}</td>
                  <td>{fmt(state.nations[c.id].treasury)}</td>
                  <td>{fmt(state.nations[c.id].troops)}</td>
                  <td>{c.difficulty}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <SavePanel actions={actions} />
      <TestPanel state={state} speed={speed} actions={actions} />
    </div>
  );
}

function CountryInfo({ id, me, state }: { id: string; me: string; state: GameState }) {
  const c = countryById(id);
  const n = state.nations[id];
  return (
    <div className="country-info">
      <div className="row">
        <b>{c.name}</b>
        <span className="muted small">
          {BLOCS[c.bloc].name} · {id === me ? '내 나라' : `우리와 ${startingRelation(me, id)}`} · 난이도 {c.difficulty}
        </span>
      </div>
      <div className="small">거점 도시: {c.cities.map((x, i) => (i === 0 ? `${x}(수도)` : x)).join(' · ')}</div>
      <div className="small">
        시작 수치: 경제 {c.economy} · 국방예산 {c.budget} · 군사력 {c.military}
        {c.estimated ? ' (일부 추정)' : ''} · 군사력 순위 {c.gfpRank2026}위
      </div>
      <div className="small">
        신앙: {FAITHS[c.faith].name}({c.faithStrength}) — {FAITHS[c.faith].trait}
      </div>
      <div className="small">
        특별 병과: {c.specialUnit.name}({c.specialUnit.base}) — {c.specialUnit.effect}
      </div>
      <div className="small">
        특수 능력: {c.ability.name} — {c.ability.effect}
      </div>
      <div className="small">
        지금: 국방예산 {fmt(n.treasury)} (시간당 +{fmt(budgetPerDay(id))}) · 병력 {fmt(n.troops)}명 (시간당 +
        {fmt(troopsPerDay(id))})
      </div>
    </div>
  );
}

function SavePanel({ actions }: { actions: GameActions }) {
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState('');
  return (
    <section className="panel">
      <h3>저장 / 불러오기</h3>
      <p className="small muted">5초마다, 그리고 창을 닫을 때 이 브라우저에 자동 저장됩니다.</p>
      <div className="buttons">
        <button
          onClick={() => {
            actions.save();
            setMsg('저장했어요.');
          }}
        >
          지금 저장
        </button>
        <button
          onClick={() => {
            actions.load();
            setMsg('마지막 저장을 불러왔어요.');
          }}
        >
          마지막 저장 불러오기
        </button>
        <button
          onClick={() => {
            setCode(actions.exportCode());
            setMsg('아래 저장 코드를 복사해 두면 다른 기기에서도 이어할 수 있어요.');
          }}
        >
          저장 코드 만들기
        </button>
        <button
          onClick={() => {
            const err = actions.importCode(code);
            setMsg(err ?? '저장 코드로 불러왔어요.');
          }}
        >
          저장 코드로 불러오기
        </button>
        <button
          className="danger"
          onClick={() => {
            if (window.confirm('처음부터 다시 시작할까요? 지금 저장은 지워집니다.')) actions.reset();
          }}
        >
          새로 시작
        </button>
      </div>
      <textarea value={code} onChange={(e) => setCode(e.target.value)} placeholder="저장 코드" />
      {msg && <div className="small">{msg}</div>}
    </section>
  );
}

function TestPanel({ state, speed, actions }: { state: GameState; speed: number; actions: GameActions }) {
  return (
    <section className="panel test">
      <h3>시험용 버튼</h3>
      <p className="small muted">숫자 맞추기용입니다. 정식판에서는 빠집니다.</p>
      <div className="small">시간 건너뛰기</div>
      <div className="buttons">
        <button onClick={() => actions.skip(HOUR)}>+1시간 (게임 1일)</button>
        <button onClick={() => actions.skip(12 * HOUR)}>+12시간 (12일)</button>
        <button onClick={() => actions.skip(24 * HOUR)}>+실제 1일 (24일)</button>
        <button onClick={() => actions.skip(7 * 24 * HOUR)}>+실제 1주 (168일)</button>
      </div>
      <div className="small">시계 빠르기</div>
      <div className="buttons">
        {[1, 60, 3600].map((x) => (
          <button key={x} className={speed === x ? 'on' : ''} onClick={() => actions.setSpeed(x)}>
            ×{x}
            {x === 60 ? ' (1분 = 하루)' : x === 3600 ? ' (1초 = 하루)' : ' (보통)'}
          </button>
        ))}
      </div>
      <div className="small">계급 바꾸기 (진급은 다음 단계)</div>
      <select value={state.player.rankIndex} onChange={(e) => actions.setRank(Number(e.target.value))}>
        {RANKS.map((r, i) => (
          <option key={r.name} value={i}>
            {r.name} · 봉급 시간당 {r.salaryPerDay}
          </option>
        ))}
      </select>
      <div className="small muted">
        지금까지 건너뛴 시간: {Math.round(state.debugSkippedMs / HOUR).toLocaleString('ko-KR')}시간
      </div>
    </section>
  );
}
