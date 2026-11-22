// 기능별 화면 묶음. 아래 메뉴 6칸 + 본부(홈) + 설정·전령·도감.
import { useState } from 'react';
import { STAT_GROUPS, TRAININGS, UNITS } from '../data/catalog';
import { RANKS } from '../data/ranks';
import { BLOCS, COUNTRIES, FRONTS, countryById, startingRelation } from '../data/world';
import { PENDING_CAP_HOURS } from '../game/balance';
import { budgetPerDay, gameClock, pendingCap, salaryPerDay, troopsPerDay, type GameState } from '../game/state';
import { Card, CountryInfo, HOUR, Soon, fmt, rankLock } from './common';
import type { Screen } from './nav';
import { WorldMap } from './WorldMap';

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

export interface ScreenProps {
  state: GameState;
  speed: number;
  notices: string[];
  actions: GameActions;
  go: (s: Screen) => void;
}

const pad = (n: number) => String(n).padStart(2, '0');

/* ───────── 본부(홈): 왼쪽 = 지도·임무·받기, 오른쪽 = 작은 버튼 줄 ───────── */
export function HomeScreen({ state, notices, actions, go }: ScreenProps) {
  const me = countryById(state.player.countryId);
  const clock = gameClock(state.worldMs);
  const pending = state.player.pendingSalary;
  const cap = pendingCap(state);
  const n = state.nations[me.id];
  const wars = COUNTRIES.filter((c) => c.id !== me.id && startingRelation(me.id, c.id) === '전쟁');

  return (
    <div className="home">
      <div className="home-clock">
        <div className="clock">
          {clock.year}년 {clock.month}월 {clock.day}일 {pad(clock.hour)}:{pad(clock.minute)}
        </div>
        <small className="muted">전쟁 {clock.dayNumber}일째 · 실제 1시간 = 게임 하루</small>
      </div>

      <div className="home-body">
        <div className="home-left">
          <button className="minimap" onClick={() => go('ops')}>
            <WorldMap playerCountryId={me.id} selectedId={null} onSelect={() => go('ops')} mini />
            <small>세계 지도</small>
          </button>

          <div className="missions">
            <small>주요 임무</small>
            <button onClick={() => go('ops')}>전선 배치 대기 · {wars.length}개 나라와 전쟁 중</button>
            <small>보조 임무</small>
            <span className="muted small">다음 단계에서 열림</span>
          </div>

          <button className="chip claim" disabled={pending < 1} onClick={actions.claim}>
            <span>
              💵 봉급 받기 <b>+{fmt(pending)}</b>
            </span>
            <span className="bar">
              <span className="bar-fill" style={{ width: `${Math.min(100, (pending / cap) * 100)}%` }} />
            </span>
            <small>
              시간당 {fmt(salaryPerDay(state))} · 한도 {PENDING_CAP_HOURS}시간치
            </small>
          </button>

          <button className="chip" onClick={() => go('nation')}>
            <small>{me.name} 국방예산 · 병력</small>
            <b>
              {fmt(n.treasury)} · {fmt(n.troops)}명
            </b>
          </button>
        </div>

        <div className="utilities">
          <button onClick={() => go('herald')}>
            📯<small>전령</small>
            {notices.length > 0 && <i className="dot" aria-label="새 소식" />}
          </button>
          <button className="locked" disabled>
            📋<small>의뢰</small>
          </button>
          <button onClick={() => go('codex')}>
            📖<small>도감</small>
          </button>
          <button onClick={() => go('settings')}>
            🧪<small>시험</small>
          </button>
        </div>
      </div>
    </div>
  );
}

/* ───────── 작전: 세계 지도 · 전선 · 나라 정보 ───────── */
export function OpsScreen({ state }: ScreenProps) {
  const me = state.player.countryId;
  const [sel, setSel] = useState(me);
  return (
    <>
      <Card title="세계 지도">
        <WorldMap playerCountryId={me} selectedId={sel} onSelect={setSel} />
        <div className="legend small">
          {Object.values(BLOCS).map((b) => (
            <span key={b.name}>
              <i style={{ background: b.color }} /> {b.name}
            </span>
          ))}
          <span>
            <i className="line war" /> 전쟁
          </span>
          <span>
            <i className="line truce" /> 휴전
          </span>
        </div>
        <CountryInfo id={sel} state={state} />
      </Card>
      <Card title="전선">
        {FRONTS.map((f) => (
          <div key={f.name} className="list-row">
            <span>{f.name}</span>
            <span className={f.kind === '전쟁' ? 'tag war' : 'tag truce'}>{f.kind}</span>
          </div>
        ))}
      </Card>
      <Card title="임무 · 전투">
        <Soon stage="4단계">격자 턴제·옆보기 등 전투 틀 5개</Soon>
        <Soon stage="2단계">AI 나라의 침공·전쟁·휴전 변화</Soon>
        <Soon stage="준장">전략 지도에서 부대 움직이기</Soon>
      </Card>
    </>
  );
}

/* ───────── 장교: 계급·봉급·스탯·진급·부관 ───────── */
export function OfficerScreen({ state }: ScreenProps) {
  const r = state.player.rankIndex;
  return (
    <>
      <Card title={`${RANKS[r].name} ${state.player.name}`} right={<span className="muted small">{RANKS[r].unit}</span>}>
        <p className="small">봉급 시간당 {fmt(RANKS[r].salaryPerDay)} · 받은 봉급 {fmt(state.player.salary)}</p>
        <div className="ranks">
          {RANKS.map((x, i) => (
            <span key={x.name} className={i === r ? 'now' : i < r ? 'done' : ''}>
              {x.name}
            </span>
          ))}
        </div>
        <Soon stage="3단계">진급 = 공훈 + 훈련 성적 + 진급 심사 작전</Soon>
      </Card>
      <Card title="스탯 9개">
        {STAT_GROUPS.map((g) => (
          <div key={g.name} className="stat-group">
            <small className="muted">
              {g.name}
              {g.note ? ` · ${g.note}` : ''}
            </small>
            {g.stats.map((s) => (
              <div key={s.name} className="list-row">
                <span>
                  <b>{s.name}</b> <small className="muted">{s.does}</small>
                </span>
                <span>1</span>
              </div>
            ))}
          </div>
        ))}
      </Card>
      <Card title="부관 · 라이벌">
        <div className="list-row">
          <span>부관 (최대 3명)</span>
          <span className="tag">{rankLock(state, 1) ?? '빈 자리'}</span>
        </div>
        <div className="list-row">
          <span>경쟁 장교 3명</span>
          <span className="tag">3단계</span>
        </div>
      </Card>
    </>
  );
}

/* ───────── 부대: 병과 15개 · 편성 · 장군 ───────── */
export function ForcesScreen({ state }: ScreenProps) {
  const me = countryById(state.player.countryId);
  return (
    <>
      <Card title="병과 15개" right={<small className="muted">특별 병과: {me.specialUnit.name}</small>}>
        {UNITS.map((u) => {
          const lock = rankLock(state, u.rank);
          return (
            <div key={u.name} className={`list-row ${lock ? 'is-locked' : ''}`}>
              <span>
                <span className="tag">{u.domain}</span> <b>{u.name}</b> <small className="muted">{u.role}</small>
              </span>
              <span className="small">{lock ? `🔒 ${lock}` : '열림'}</span>
            </div>
          );
        })}
      </Card>
      <Card title="편성 · 장군">
        <Soon stage="4단계">전투 편성(병과 고르기·자리)</Soon>
        <Soon stage="준장">장군 임명(최대 5명)</Soon>
      </Card>
    </>
  );
}

/* ───────── 훈련: 12개 ───────── */
export function TrainingScreen({ state }: ScreenProps) {
  return (
    <>
      <Card title="훈련 일정" right={<span className="tag">5단계</span>}>
        <p className="small muted">매일 채워지는 훈련 횟수. 한 판 2~5분, 결과는 별 1~3개.</p>
      </Card>
      <div className="grid2">
        {TRAININGS.map((t) => {
          const lock = rankLock(state, t.rank);
          return (
            <button key={t.name} className={`tile ${lock ? 'locked' : ''}`} disabled>
              <b>
                {lock ? '🔒 ' : ''}
                {t.name}
              </b>
              <small>{t.frame}</small>
              <small className="muted">↑ {t.raises}</small>
              <small className="muted">{lock ?? '5단계에서 열림'}</small>
            </button>
          );
        })}
      </div>
    </>
  );
}

/* ───────── 나라: 금고 · 내정 · 자원 · 외교 · 모든 나라 ───────── */
export function NationScreen({ state, go }: ScreenProps) {
  const me = countryById(state.player.countryId);
  const n = state.nations[me.id];
  return (
    <>
      <Card title={`${me.name} 금고`} right={<small className="muted">AI 지도자 운영 중</small>}>
        <div className="kv">
          <span>국방예산</span>
          <b>
            {fmt(n.treasury)} <small className="muted">시간당 +{fmt(budgetPerDay(me.id))}</small>
          </b>
          <span>병력</span>
          <b>
            {fmt(n.troops)}명 <small className="muted">시간당 +{fmt(troopsPerDay(me.id))}</small>
          </b>
        </div>
        <p className="small muted">준장이 되면 도시 내정을, 총사령관이 되면 예산 나누기를 맡아요.</p>
      </Card>
      <Card title="내정 · 자원 · 외교">
        <Soon stage="6단계">내정 시설(산업·인프라·복지) · 전략 자원 7종 · 생산·교역</Soon>
        <Soon stage="2단계">동맹·휴전·선전포고, 긴장도</Soon>
      </Card>
      <Card title="모든 나라 (실시간)">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>나라</th>
                <th>우리와</th>
                <th>국방예산</th>
                <th>병력</th>
              </tr>
            </thead>
            <tbody>
              {COUNTRIES.map((c) => (
                <tr key={c.id} className={c.id === me.id ? 'sel' : ''} onClick={() => go('codex')}>
                  <td>
                    <i className="dot-bloc" style={{ background: BLOCS[c.bloc].color }} /> {c.name}
                  </td>
                  <td>{c.id === me.id ? '—' : startingRelation(me.id, c.id)}</td>
                  <td>{fmt(state.nations[c.id].treasury)}</td>
                  <td>{fmt(state.nations[c.id].troops)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}

/* ───────── 상점 ───────── */
export function ShopScreen(_: ScreenProps) {
  return (
    <Card title="상점">
      <p className="small muted">루비로 기다리는 시간(훈련 일정·진급 심사·생산·이동)을 줄이는 곳이에요.</p>
      <Soon stage="나중에">루비 얻는 곳과 결제는 아직 정하지 않았어요</Soon>
    </Card>
  );
}

/* ───────── 전령: 소식 ───────── */
export function HeraldScreen({ notices }: ScreenProps) {
  return (
    <Card title="받은 소식">
      {notices.length === 0 ? (
        <p className="small muted">새 소식이 없어요.</p>
      ) : (
        notices.map((t, i) => (
          <p key={i} className="small list-row">
            {t}
          </p>
        ))
      )}
    </Card>
  );
}

/* ───────── 도감: 나라 13개 ───────── */
export function CodexScreen({ state }: ScreenProps) {
  const [open, setOpen] = useState<string | null>(state.player.countryId);
  return (
    <Card title="나라 도감 13개">
      {COUNTRIES.map((c) => (
        <div key={c.id}>
          <button className="list-row wide" onClick={() => setOpen(open === c.id ? null : c.id)}>
            <span>
              <i className="dot-bloc" style={{ background: BLOCS[c.bloc].color }} /> <b>{c.name}</b>{' '}
              <small className="muted">{BLOCS[c.bloc].name}</small>
            </span>
            <span className="small">{c.difficulty}</span>
          </button>
          {open === c.id && <CountryInfo id={c.id} state={state} />}
        </div>
      ))}
    </Card>
  );
}

/* ───────── 설정: 저장/불러오기 + 시험 버튼 ───────── */
export function SettingsScreen({ state, speed, actions }: ScreenProps) {
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState('');
  return (
    <>
      <Card title="저장 / 불러오기">
        <p className="small muted">5초마다, 그리고 창을 닫을 때 이 브라우저에 자동 저장돼요.</p>
        <div className="buttons">
          <button onClick={() => (actions.save(), setMsg('저장했어요.'))}>지금 저장</button>
          <button onClick={() => (actions.load(), setMsg('마지막 저장을 불러왔어요.'))}>마지막 저장 불러오기</button>
          <button
            onClick={() => (
              setCode(actions.exportCode()),
              setMsg('아래 저장 코드를 복사해 두면 다른 기기에서도 이어할 수 있어요.')
            )}
          >
            저장 코드 만들기
          </button>
          <button onClick={() => setMsg(actions.importCode(code) ?? '저장 코드로 불러왔어요.')}>
            저장 코드로 불러오기
          </button>
        </div>
        <textarea value={code} onChange={(e) => setCode(e.target.value)} placeholder="저장 코드" />
        {msg && <p className="small">{msg}</p>}
        <button
          className="danger"
          onClick={() => {
            if (window.confirm('처음부터 다시 시작할까요? 지금 저장은 지워집니다.')) actions.reset();
          }}
        >
          새로 시작
        </button>
      </Card>

      <Card title="시험용 버튼" right={<small className="muted">정식판에서는 빠짐</small>}>
        <small>시간 건너뛰기</small>
        <div className="buttons">
          <button onClick={() => actions.skip(HOUR)}>+1시간 (1일)</button>
          <button onClick={() => actions.skip(12 * HOUR)}>+12시간</button>
          <button onClick={() => actions.skip(24 * HOUR)}>+실제 1일</button>
          <button onClick={() => actions.skip(7 * 24 * HOUR)}>+실제 1주</button>
        </div>
        <small>시계 빠르기</small>
        <div className="buttons">
          {[1, 60, 3600].map((x) => (
            <button key={x} className={speed === x ? 'on' : ''} onClick={() => actions.setSpeed(x)}>
              ×{x}
              {x === 60 ? ' (1분=하루)' : x === 3600 ? ' (1초=하루)' : ''}
            </button>
          ))}
        </div>
        <small>계급 바꾸기 (진급은 3단계)</small>
        <select value={state.player.rankIndex} onChange={(e) => actions.setRank(Number(e.target.value))}>
          {RANKS.map((r, i) => (
            <option key={r.name} value={i}>
              {r.name} · 봉급 시간당 {r.salaryPerDay}
            </option>
          ))}
        </select>
        <p className="small muted">지금까지 건너뛴 시간: {fmt(state.debugSkippedMs / HOUR)}시간</p>
      </Card>
    </>
  );
}

export const SCREENS: Record<Screen, (p: ScreenProps) => React.JSX.Element> = {
  home: HomeScreen,
  ops: OpsScreen,
  officer: OfficerScreen,
  forces: ForcesScreen,
  training: TrainingScreen,
  nation: NationScreen,
  shop: ShopScreen,
  settings: SettingsScreen,
  herald: HeraldScreen,
  codex: CodexScreen,
};
