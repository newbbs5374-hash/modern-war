// 기능별 화면 묶음. 아래 메뉴 6칸 + 본부(홈) + 설정·전령·도감.
import { useState } from 'react';
import { STAT_GROUPS, TRAININGS, UNITS } from '../data/catalog';
import { RANKS } from '../data/ranks';
import { BLOCS, COUNTRIES, countryById } from '../data/world';
import { PENDING_CAP_HOURS } from '../game/balance';
import { budgetPerDay, gameClock, pendingCap, salaryPerDay, troopsPerDay, type GameState } from '../game/state';
import { citiesOf, isAlive, relationOf } from '../game/world';
import { Card, CountryInfo, EventList, HOUR, RelTag, Soon, TensionBar, fmt, leaderText, rankLock } from './common';
import type { Screen } from './nav';
import { REL_COLORS, WorldMap, type MapMode } from './WorldMap';

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
  /** 전령을 마지막으로 본 뒤 생긴 내 나라 소식 수 */
  unread: number;
  actions: GameActions;
  go: (s: Screen) => void;
}

const pad = (n: number) => String(n).padStart(2, '0');

/* ───────── 본부(홈): 왼쪽 = 지도·임무·받기, 오른쪽 = 작은 버튼 줄 ───────── */
export function HomeScreen({ state, unread, actions, go }: ScreenProps) {
  const me = countryById(state.player.countryId);
  const clock = gameClock(state.worldMs);
  const pending = state.player.pendingSalary;
  const cap = pendingCap(state);
  const n = state.nations[me.id];
  const wars = COUNTRIES.filter((c) => c.id !== me.id && isAlive(state.world, c.id) && relationOf(state.world, me.id, c.id) === '전쟁');
  const latest = state.world.events.find((e) => e.mine);
  const fallen = !isAlive(state.world, me.id);

  return (
    <div className="home">
      <div className="home-clock">
        <div className="clock">
          {clock.year}년 {clock.month}월 {clock.day}일 {pad(clock.hour)}:{pad(clock.minute)}
        </div>
        <small className="muted">전쟁 {clock.dayNumber}일째 · 실제 1시간 = 게임 하루</small>
      </div>

      {fallen && (
        <div className="alert">
          {me.name}의 도시를 모두 잃었어요. 망명 정부로 버티는 중이고, 점령지에서 반란이 일어나면 되찾아요.
        </div>
      )}
      <div className="home-body">
        <div className="home-left">
          <button className="minimap" onClick={() => go('ops')}>
            <WorldMap world={state.world} playerCountryId={me.id} selectedId={null} onSelect={() => go('ops')} mini />
            <small>세계 지도</small>
          </button>

          <div className="missions">
            <small>주요 임무</small>
            <button onClick={() => go('ops')}>
              전선 배치 대기 · {wars.length ? `${wars.map((c) => c.name).join('·')}와 전쟁 중` : '지금은 전쟁 없음'}
            </button>
            {latest && (
              <button className="latest" onClick={() => go('herald')}>
                <small>최근 전황</small> {latest.text}
              </button>
            )}
            <small>보조 임무</small>
            <span className="muted small">3단계에서 열림</span>
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
            <small>
              {me.name} 국방예산 · 병력 · 도시 {citiesOf(state.world, me.id).length}
            </small>
            <b>
              {fmt(n.treasury)} · {fmt(n.troops)}명
            </b>
          </button>
        </div>

        <div className="utilities">
          <button onClick={() => go('herald')}>
            📯<small>전령</small>
            {unread > 0 && <i className="dot" aria-label="새 소식" />}
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

/* ───────── 작전: 세계 지도 · 전쟁 · 전황 ───────── */
export function OpsScreen({ state }: ScreenProps) {
  const me = state.player.countryId;
  const w = state.world;
  const [sel, setSel] = useState(me);
  const [mode, setMode] = useState<MapMode>('관계');
  const wars = Object.entries(w.pairs)
    .filter(([k, p]) => p.rel === '전쟁' && k.split('|').every((id) => isAlive(w, id)))
    .map(([k, p]) => ({ ids: k.split('|'), p }));
  const myWars = wars.filter((x) => x.ids.includes(me));
  const otherWars = wars.filter((x) => !x.ids.includes(me));
  const nm = (id: string) => countryById(id).name;
  return (
    <>
      <Card
        title="세계 지도"
        right={
          <span className="seg">
            {(['관계', '묶음'] as MapMode[]).map((m) => (
              <button key={m} className={mode === m ? 'on' : ''} onClick={() => setMode(m)}>
                {m}
              </button>
            ))}
          </span>
        }
      >
        <WorldMap world={w} playerCountryId={me} selectedId={sel} onSelect={setSel} mode={mode} />
        <div className="legend small">
          {mode === '관계'
            ? (Object.keys(REL_COLORS) as Array<keyof typeof REL_COLORS>).map((k) => (
                <span key={k}>
                  <i style={{ background: REL_COLORS[k] }} /> {k === '나' ? '내 나라' : k}
                </span>
              ))
            : Object.values(BLOCS).map((b) => (
                <span key={b.name}>
                  <i style={{ background: b.color }} /> {b.name}
                </span>
              ))}
          <span>
            <i className="ring" /> 점령된 도시
          </span>
        </div>
        <CountryInfo id={sel} state={state} />
      </Card>
      <Card title={`우리 전쟁 ${myWars.length}`}>
        {myWars.length === 0 && <p className="small muted">지금 우리나라는 전쟁 중이 아니에요.</p>}
        {myWars.map(({ ids, p }) => {
          const foe = ids[0] === me ? ids[1] : ids[0];
          return (
            <button key={foe} className="list-row wide" onClick={() => setSel(foe)}>
              <span>⚔️ {nm(foe)}</span>
              <small className="muted">피로도 {Math.round(p.weariness)}</small>
            </button>
          );
        })}
      </Card>
      <Card title={`다른 나라 전쟁 ${otherWars.length}`}>
        <div className="chips">
          {otherWars.map(({ ids }) => (
            <span key={ids.join()} className="tag">
              {nm(ids[0])} ↔ {nm(ids[1])}
            </span>
          ))}
        </div>
      </Card>
      <Card title="최근 전황">
        <EventList events={w.events} limit={10} />
      </Card>
      <Card title="직접 싸우기">
        <Soon stage="4단계">격자 턴제·옆보기 등 전투 틀 5개</Soon>
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
            {fmt(n.treasury)} <small className="muted">시간당 +{fmt(budgetPerDay(state, me.id))}</small>
          </b>
          <span>병력</span>
          <b>
            {fmt(n.troops)}명 <small className="muted">시간당 +{fmt(troopsPerDay(state, me.id))}</small>
          </b>
        </div>
        <p className="small">지도자: {leaderText(state, me.id)}</p>
        <p className="small muted">준장이 되면 도시 내정을, 총사령관이 되면 예산 나누기를 맡아요.</p>
      </Card>
      <Card title="내정 · 자원 · 외교">
        <Soon stage="6단계">내정 시설(산업·인프라·복지) · 전략 자원 7종 · 생산·교역</Soon>
        <Soon stage="총사령관">선전포고 요청·휴전 제안(지금은 AI 지도자가 정함)</Soon>
      </Card>
      <Card title="외교 (우리와)">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>나라</th>
                <th>관계</th>
                <th>긴장도</th>
                <th>지도자 성향</th>
              </tr>
            </thead>
            <tbody>
              {COUNTRIES.map((c) => (
                <tr key={c.id} className={c.id === me.id ? 'sel' : ''} onClick={() => go('codex')}>
                  <td>{c.name}</td>
                  <td>
                    <RelTag state={state} id={c.id} />
                  </td>
                  <td>
                    <TensionBar state={state} a={me.id} b={c.id} />
                  </td>
                  <td>{state.world.personalities[c.id]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <Card title="모든 나라 (실시간)">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>나라</th>
                <th>도시</th>
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
                  <td>{citiesOf(state.world, c.id).length}</td>
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

/* ───────── 전령: 내 소식 · 세계 소식 ───────── */
export function HeraldScreen({ state, notices }: ScreenProps) {
  const [tab, setTab] = useState<'mine' | 'all'>('mine');
  const events = tab === 'mine' ? state.world.events.filter((e) => e.mine) : state.world.events;
  return (
    <>
      {notices.length > 0 && (
        <Card title="알림">
          {notices.map((t, i) => (
            <p key={i} className="small list-row">
              {t}
            </p>
          ))}
        </Card>
      )}
      <Card
        title="전황 소식"
        right={
          <span className="seg">
            <button className={tab === 'mine' ? 'on' : ''} onClick={() => setTab('mine')}>
              우리나라
            </button>
            <button className={tab === 'all' ? 'on' : ''} onClick={() => setTab('all')}>
              세계
            </button>
          </span>
        }
      >
        <EventList events={events} />
      </Card>
    </>
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
            <span className="small">
              {isAlive(state.world, c.id) ? c.difficulty : '도시 없음'}
            </span>
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
