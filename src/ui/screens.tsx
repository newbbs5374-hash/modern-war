// 기능별 화면 묶음. 아래 메뉴 6칸 + 본부(홈) + 설정·전령·도감.
import { useState } from 'react';
import { UNITS } from '../data/catalog';
import { RANKS } from '../data/ranks';
import { BLOCS, COUNTRIES, countryById } from '../data/world';
import { PENDING_CAP_HOURS } from '../game/balance';
import { budgetPerDay, gameClock, pendingCap, salaryPerDay, troopsPerDay, type GameState } from '../game/state';
import { citiesOf, isAlive, relationOf } from '../game/world';
import { Card, CountryInfo, EventList, HOUR, RelTag, Soon, TensionBar, fmt, leaderText } from './common';
import type { Screen } from './nav';
import { REL_COLORS, WorldMap, type MapMode } from './WorldMap';
import { GrandCard, MissionCard, OfficerScreen, TrainingScreen, timeLeft } from './officerScreens';
import { DRILL_MAX, debugAddAide, drillsNow, promotionCheck } from '../game/officer';
import { BattleScreen } from './battle/BattleScreen';
import { EndingCard, VictoryCard } from './victoryScreens';
import { FacilityCard, ProductionCard, ResourceCard, TradeCard, UnitModal } from './economyScreens';
import { Chip, Help, Modal, Tabs, Tile, useTab } from './kit';
import { FLAG, UNIT_ICON } from './icons';
import { ECON_RANK } from '../data/economy';
import { COMMAND_TOP, DIPLO_COOLDOWN_HOURS, canDiplo, diploChance, diploReady, doDiplo, type DiploAct } from '../game/command';
import { OPERATION_RANK } from '../data/officers';
import { PROMOTION } from '../data/officers';

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
  /** 게임 상태를 바꾸는 함수를 바로 적용하고 저장 */
  apply: (f: (s: GameState) => GameState) => void;
  /** 결과 값이 있는 함수(예: 임무 결과 글) */
  applyWith: <T>(f: (s: GameState) => { state: GameState; out: T }) => T | undefined;
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
export function HomeScreen(props: ScreenProps) {
  const { state, unread, actions, go } = props;
  const me = countryById(state.player.countryId);
  const clock = gameClock(state.worldMs);
  const pending = state.player.pendingSalary;
  const cap = pendingCap(state);
  const n = state.nations[me.id];
  const wars = COUNTRIES.filter((c) => c.id !== me.id && isAlive(state.world, c.id) && relationOf(state.world, me.id, c.id) === '전쟁');
  const latest = state.world.events.find((e) => e.mine);
  const fallen = !isAlive(state.world, me.id);
  const a = state.officer.active;
  const drills = drillsNow(state.officer, state.worldMs).count;
  const pc = promotionCheck(state);
  const promoPct = pc.lines.length ? Math.round((pc.lines.reduce((x, l) => x + Math.min(1, l.have / Math.max(1, l.need)), 0) / pc.lines.length) * 100) : 100;
  const errandsDone = state.officer.aides.filter((x) => x.errand && state.worldMs >= x.errand.endMs).length;

  return (
    <div className="home">
      <div className="home-clock">
        <div className="clock">
          {clock.year}년 {clock.month}월 {clock.day}일 {pad(clock.hour)}:{pad(clock.minute)}
        </div>
        <small className="muted">전쟁 {clock.dayNumber}일째 · 실제 1시간 = 게임 하루</small>
      </div>

      <EndingCard {...props} />
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
            <div className="ichips">
              {wars.slice(0, 5).map((c) => (
                <span key={c.id} className="ichip">
                  {FLAG[c.id]}⚔️
                </span>
              ))}
              {!wars.length && <small>지금은 전쟁 없음</small>}
            </div>
            {latest && (
              <button className="latest" onClick={() => go('herald')}>
                <small>📯</small> {latest.text}
              </button>
            )}
          </div>
          <div className="tiles c4">
            <Tile
              icon={a ? (state.worldMs >= a.endMs ? '✅' : '⏳') : '🎯'}
              label="임무"
              sub={a ? (state.worldMs >= a.endMs ? '결과 받기' : timeLeft(a.endMs - state.worldMs)) : '고르기'}
              badge={a && state.worldMs >= a.endMs ? '!' : !a ? '!' : null}
              onClick={() => go('ops')}
            />
            <Tile icon="📅" label="훈련" sub={`일정 ${drills}/${DRILL_MAX}`} badge={drills > 0 ? drills : null} onClick={() => go('training')} />
            <Tile icon="🎓" label="진급" sub={pc.ready ? '심사 가능!' : `${promoPct}%`} tone={pc.ready ? 'gold' : undefined} badge={pc.ready ? '!' : null} onClick={() => go('officer')} />
            <Tile icon="🧑‍✈️" label="부관" sub={`${state.officer.aides.length}명`} badge={errandsDone || null} onClick={() => go('officer')} />
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

/* ───────── 작전: 임무 · 대전투 · 지도 · 전황 (탭) ───────── */
type OpsTab = 'mission' | 'grand' | 'map' | 'news';
export function OpsScreen(props: ScreenProps) {
  const { state } = props;
  const rank = state.player.rankIndex;
  const [tab, setTab] = useTab<OpsTab>('ops', 'mission');
  const ready = state.officer.active && state.worldMs >= state.officer.active.endMs;
  return (
    <>
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'mission', label: '임무', icon: '🎯', badge: ready ? '!' : null },
          { id: 'grand', label: '대전투', icon: '🏙️', locked: rank < OPERATION_RANK },
          { id: 'map', label: '지도', icon: '🗺️' },
          { id: 'news', label: '전황', icon: '📰' },
        ]}
      />
      {tab === 'mission' && (
        <>
          <MissionCard {...props} />
          <WarStrip {...props} />
        </>
      )}
      {tab === 'grand' &&
        (rank < OPERATION_RANK ? (
          <p className="empty">🔒 대위부터 작전, 준장부터 대전투(도시 점령)가 열려요.</p>
        ) : (
          <>
            <GrandCard {...props} />
            {rank >= 8 && <VictoryCard {...props} />}
          </>
        ))}
      {tab === 'map' && <MapPanel {...props} />}
      {tab === 'news' && (
        <Card title="최근 전황" icon="📰">
          <EventList events={state.world.events} limit={12} />
        </Card>
      )}
    </>
  );
}

/** 우리 전쟁 한 줄 요약(국기 칩) */
function WarStrip({ state }: ScreenProps) {
  const me = state.player.countryId;
  const w = state.world;
  const foes = COUNTRIES.filter((c) => c.id !== me && isAlive(w, c.id) && relationOf(w, me, c.id) === '전쟁');
  const allies = COUNTRIES.filter((c) => c.id !== me && isAlive(w, c.id) && relationOf(w, me, c.id) === '연합');
  return (
    <Card title="전선" icon="⚔️" right={<Chip icon="🏙️" value={citiesOf(w, me).length} label="우리 도시" />}>
      <div className="ichips">
        {foes.map((c) => (
          <Chip key={c.id} icon={FLAG[c.id]} value={c.name} label="전쟁" />
        ))}
        {allies.map((c) => (
          <Chip key={c.id} icon={FLAG[c.id]} value={c.name} label="연합" />
        ))}
        {!foes.length && <span className="small muted">지금은 전쟁 중이 아니에요.</span>}
      </div>
    </Card>
  );
}

function MapPanel({ state }: ScreenProps) {
  const me = state.player.countryId;
  const w = state.world;
  const [sel, setSel] = useState<string | null>(null);
  const [mode, setMode] = useState<MapMode>('관계');
  const otherWars = Object.entries(w.pairs)
    .filter(([k, p]) => p.rel === '전쟁' && !k.split('|').includes(me) && k.split('|').every((id) => isAlive(w, id)))
    .map(([k]) => k.split('|'));
  return (
    <>
      <Card
        title="세계 지도"
        icon="🗺️"
        right={
          <span className="seg">
            {(['관계', '묶음'] as MapMode[]).map((m) => (
              <button key={m} className={mode === m ? 'on' : ''} onClick={() => setMode(m)}>
                {m}
              </button>
            ))}
          </span>
        }
        help={<p>나라를 누르면 자세한 정보가 떠요. 점선 = 전쟁(빨강)·휴전(주황), 동그라미 = 점령된 도시.</p>}
      >
        <WorldMap world={w} playerCountryId={me} selectedId={sel ?? me} onSelect={setSel} mode={mode} />
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
        </div>
        {otherWars.length > 0 && (
          <div className="ichips">
            {otherWars.map(([a, b]) => (
              <span key={a + b} className="ichip">
                {FLAG[a]}⚔️{FLAG[b]}
              </span>
            ))}
          </div>
        )}
      </Card>
      {sel && (
        <Modal title={countryById(sel).name} icon={FLAG[sel]} onClose={() => setSel(null)}>
          <CountryInfo id={sel} state={state} />
        </Modal>
      )}
    </>
  );
}

/* ───────── 부대: 병과 15개(누르면 정보·생산) · 장군 ───────── */
export function ForcesScreen(props: ScreenProps) {
  const { state } = props;
  const me = countryById(state.player.countryId);
  const [pick, setPick] = useState<string | null>(null);
  const rank = state.player.rankIndex;
  const e = state.economy;
  return (
    <>
      <section className="card">
        <div className="row">
          <div className="ichips">
            <Chip icon="🪖" value={fmt(state.nations[me.id].troops)} label="병력" />
            <Chip icon="💪" value={e.power} label="전투력" />
            <Chip icon="⭐" value={state.officer.generals.length} label="장군" />
          </div>
          <Help title="부대">
            <p>병과 15개와 우리 나라 특별 병과예요. 눌러서 역할과 생산 비용을 봐요.</p>
            <p>준장부터 국방예산과 전략 자원으로 부대를 만들 수 있어요. 만든 부대는 병력·전투력이 되고, 전투력이 높으면 대전투가 쉬워지고 점령지를 잘 지켜요.</p>
          </Help>
        </div>
        {e.queue.length > 0 && (
          <div className="small" style={{ marginTop: 6 }}>
            🔨 생산 중:{' '}
            {e.queue
              .map((q) => `${q.special ? me.specialUnit.name : q.unit}(${timeLeft(q.endMs - state.worldMs)})`)
              .join(' · ')}
          </div>
        )}
      </section>
      <div className="tiles c5">
        <Tile icon="🌟" label="특별" sub={me.specialUnit.name} tone="gold" onClick={() => setPick('★')} />
        {UNITS.map((u) => (
          <Tile
            key={u.name}
            icon={UNIT_ICON[u.name]}
            label={u.name}
            sub={rank < u.rank ? RANKS[u.rank].name : `보유 ${e.army[u.name] ?? 0}`}
            locked={rank < u.rank}
            onClick={() => setPick(u.name)}
          />
        ))}
      </div>
      {pick && <UnitModal {...props} unit={pick} onClose={() => setPick(null)} />}
    </>
  );
}

/* ───────── 나라: 금고 · 자원 · 시설 · 생산 · 무역 · 외교 (탭) ───────── */
type NationTab = 'home' | 'res' | 'fac' | 'make' | 'trade' | 'dip';
export function NationScreen(props: ScreenProps) {
  const { state } = props;
  const me = countryById(state.player.countryId);
  const n = state.nations[me.id];
  const [tab, setTab] = useTab<NationTab>('nation', 'home');
  const locked = state.player.rankIndex < ECON_RANK;
  const choreDone = state.economy.chore && state.worldMs >= state.economy.chore.endMs;
  return (
    <>
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'home', label: '금고', icon: '💰' },
          { id: 'res', label: '자원', icon: '⛏️' },
          { id: 'fac', label: '시설', icon: '🏭', badge: choreDone ? '!' : null },
          { id: 'make', label: '생산', icon: '🛠️', locked },
          { id: 'trade', label: '무역', icon: '🤝', locked },
          { id: 'dip', label: '외교', icon: '🌐' },
        ]}
      />
      {tab === 'home' && (
        <>
          <section className="card">
            <div className="hero">
              <span className="avatar">{FLAG[me.id]}</span>
              <div className="hero-main">
                <b>{me.name}</b>
                <div className="small muted">{leaderText(state, me.id)}</div>
              </div>
            </div>
            <div className="kv2" style={{ marginTop: 8 }}>
              <span>💰 국방예산</span>
              <b>{fmt(n.treasury)}</b>
              <span>　시간당</span>
              <b>+{fmt(budgetPerDay(state, me.id))}</b>
              <span>🪖 병력</span>
              <b>{fmt(n.troops)}명</b>
              <span>　시간당</span>
              <b>+{fmt(troopsPerDay(state, me.id))}</b>
              <span>🏙️ 도시</span>
              <b>{citiesOf(state.world, me.id).length}</b>
              <span>💪 전투력</span>
              <b>{state.economy.power}</b>
            </div>
          </section>
          <Card title="모든 나라" icon="📊" help={<p>나라를 누르면 자세한 정보가 떠요. 숫자는 실시간으로 바뀌어요.</p>}>
            <AllNations {...props} />
          </Card>
        </>
      )}
      {tab === 'res' && <ResourceCard {...props} />}
      {tab === 'fac' && <FacilityCard {...props} />}
      {tab === 'make' && <ProductionCard {...props} />}
      {tab === 'trade' && <TradeCard {...props} />}
      {tab === 'dip' && <DiplomacyCard {...props} />}
    </>
  );
}

function AllNations({ state }: ScreenProps) {
  const [sel, setSel] = useState<string | null>(null);
  const me = state.player.countryId;
  return (
    <>
      <div className="tiles c4">
        {COUNTRIES.map((c) => (
          <Tile
            key={c.id}
            icon={FLAG[c.id]}
            label={c.name}
            sub={`🏙️${citiesOf(state.world, c.id).length} · ${fmt(state.nations[c.id].troops / 1000)}k`}
            locked={!isAlive(state.world, c.id)}
            tone={c.id === me ? 'gold' : relationOf(state.world, me, c.id) === '전쟁' ? 'red' : relationOf(state.world, me, c.id) === '연합' ? 'blue' : undefined}
            onClick={() => setSel(c.id)}
          />
        ))}
      </div>
      {sel && (
        <Modal title={countryById(sel).name} icon={FLAG[sel]} onClose={() => setSel(null)}>
          <CountryInfo id={sel} state={state} />
        </Modal>
      )}
    </>
  );
}

function DiplomacyCard({ state, actions }: ScreenProps) {
  const me = state.player.countryId;
  const [sel, setSel] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  const top = state.player.rankIndex >= COMMAND_TOP;
  const wait = diploReady(state) - state.worldMs;
  return (
    <Card
      title="외교 (우리와)"
      icon="🌐"
      right={top ? <Chip icon="📜" value={wait > 0 ? timeLeft(wait) : '가능'} /> : undefined}
      help={
        <>
          <p>휴전·중립인 나라와는 긴장도가 쌓여요. 100이 되면 휴전이 깨지거나 전쟁이 나요.</p>
          <p>총사령관이 되면 나라를 눌러 직접 선전포고·휴전 제안·연합 제안을 해요({DIPLO_COOLDOWN_HOURS}시간마다 한 번). 연합국은 승리 조건에 함께 세어져요.</p>
        </>
      }
    >
      {COUNTRIES.filter((c) => c.id !== me).map((c) => (
        <button key={c.id} className="line-item wide-btn" onClick={() => setSel(c.id)}>
          <span className="li-ico">{FLAG[c.id]}</span>
          <span className="li-main">
            <b>
              {c.name} <RelTag state={state} id={c.id} />
            </b>
            <small>{state.world.personalities[c.id]}</small>
          </span>
          <TensionBar state={state} a={me} b={c.id} />
        </button>
      ))}
      {sel && (
        <Modal title={countryById(sel).name} icon={FLAG[sel]} onClose={() => (setSel(null), setMsg(''))}>
          {top && (
            <div className="buttons">
              {(['선전포고', '휴전 제안', '연합 제안'] as DiploAct[]).map((act) => {
                const why = canDiplo(state, sel, act);
                return (
                  <button
                    key={act}
                    style={{ flex: 1, marginTop: 0 }}
                    className={act === '선전포고' ? 'danger' : 'primary'}
                    disabled={!!why}
                    title={why ?? ''}
                    onClick={() => {
                      if (act === '선전포고' && !window.confirm(`${countryById(sel).name}에 선전포고할까요?`)) return;
                      setMsg(actions.applyWith((s) => {
                        const r = doDiplo(s, sel, act);
                        return { state: r.state, out: r.text };
                      }) ?? '');
                    }}
                  >
                    {act === '선전포고' ? '⚔️' : act === '휴전 제안' ? '🕊️' : '🤝'} {act}
                    <small>{why ?? (act === '선전포고' ? '' : `성공 ${Math.round(diploChance(state, sel, act) * 100)}%`)}</small>
                  </button>
                );
              })}
            </div>
          )}
          {msg && <p className="small result">{msg}</p>}
          <CountryInfo id={sel} state={state} />
        </Modal>
      )}
    </Card>
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

/* ───────── 도감: 나라 13개(국기 타일 → 팝업) ───────── */
export function CodexScreen({ state }: ScreenProps) {
  const [sel, setSel] = useState<string | null>(null);
  return (
    <Card title="나라 도감 13개" icon="📖" help={<p>나라마다 특별 병과·특수 능력·신앙이 달라요. 이긴 나라는 첫 화면 명예의 전당에 남아요.</p>}>
      <div className="tiles c4">
        {COUNTRIES.map((c) => (
          <Tile key={c.id} icon={FLAG[c.id]} label={c.name} sub={isAlive(state.world, c.id) ? c.difficulty : '도시 없음'} locked={!isAlive(state.world, c.id)} onClick={() => setSel(c.id)}>
            <i className="dot-bloc" style={{ background: BLOCS[c.bloc].color }} />
          </Tile>
        ))}
      </div>
      {sel && (
        <Modal title={countryById(sel).name} icon={FLAG[sel]} onClose={() => setSel(null)}>
          <CountryInfo id={sel} state={state} />
        </Modal>
      )}
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
        <small>진급 시험용</small>
        <div className="buttons">
          <button
            onClick={() =>
              actions.apply((s) => {
                const rule = PROMOTION[s.player.rankIndex];
                if (!rule) return s;
                const o = structuredClone(s.officer);
                o.merit = Math.max(o.merit, rule.merit);
                o.stars = Math.max(o.stars, rule.stars);
                o.trust = Math.max(o.trust, rule.trust);
                o.drills = DRILL_MAX;
                o.drillAnchorMs = s.worldMs;
                return { ...s, officer: o };
              })
            }
          >
            진급 조건 채우기
          </button>
          <button
            onClick={() =>
              actions.apply((s) => {
                const me = s.player.countryId;
                const stock = { ...s.economy.stock };
                for (const k of Object.keys(stock) as Array<keyof typeof stock>) stock[k] += 50;
                return {
                  ...s,
                  nations: { ...s.nations, [me]: { ...s.nations[me], treasury: s.nations[me].treasury + 50000 } },
                  economy: { ...s.economy, stock, facilities: Object.fromEntries(Object.entries(s.economy.facilities).map(([k, f]) => [k, { ...f, exp: f.exp + 500 }])) as typeof s.economy.facilities },
                };
              })
            }
          >
            내정 시험(예산·자원·경험치 채우기)
          </button>
          <button onClick={() => actions.apply((s) => debugAddAide({ ...s, player: { ...s.player, salary: s.player.salary + 5000 } }))}>부관 데려오기 + 봉급 5000</button>
        </div>
        <small>계급 바로 바꾸기 (진급 심사 없이)</small>
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
  battle: BattleScreen,
};
