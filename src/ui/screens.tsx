// 기능별 화면 묶음. 아래 메뉴 6칸 + 본부(홈) + 설정·전령·도감.
import { useState } from 'react';
import { UNITS } from '../data/catalog';
import { RANKS } from '../data/ranks';
import { BLOCS, COUNTRIES, countryById } from '../data/world';
import { budgetPerDay, pendingCap, troopsPerDay, type GameState } from '../game/state';
import { citiesOf, isAlive, relationOf } from '../game/world';
import { Card, CountryInfo, EventList, HOUR, RelTag, Soon, TensionBar, fmt, leaderText } from './common';
import type { Screen } from './nav';
import { REL_COLORS, WorldMap, type MapMode } from './WorldMap';
import { GrandCard, MissionCard, OfficerScreen, TrainingScreen, timeLeft } from './officerScreens';
import { DRILL_MAX, debugAddAide, debugPromote, drillsNow, promotionCheck } from '../game/officer';
import { BattleScreen } from './battle/BattleScreen';
import { EndingCard, VictoryCard } from './victoryScreens';
import { FacilityCard, ProductionCard, ResourceCard, TradeCard, UnitModal } from './economyScreens';
import { Chip, Help, Modal, Tabs, Tile, useTab } from './kit';
import { UNIT_ICON } from './icons';
import { FLAG } from './flag';
import { fillPromotion, grantTestResources } from '../game/testgrant';
import { HomeLand, cityStatus, type DayMode } from './HomeLand';
import { cityById } from '../data/cities';
import { CITY_RES, RES_ICON, type Res } from '../data/economy';
import { CITY_DEFENSE_MAX } from '../game/balance';
import { boostsOf } from '../game/boost';
import { ECON_RANK } from '../data/economy';
import { DIPLO_RANK, DIPLO_COOLDOWN_HOURS, canDiplo, diploChance, diploReady, doDiplo, type DiploAct } from '../game/command';
import { OPERATION_RANK } from '../data/officers';
import { PROMOTION } from '../data/officers';
import { TalkModal } from './TalkModal';
import { debugTalk } from '../game/talk';

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

/* ───────── 본부(홈): 왼쪽 = 지도·임무·받기, 오른쪽 = 작은 버튼 줄 ───────── */
export function HomeScreen(props: ScreenProps) {
  const { state, unread, actions, go } = props;
  const me = countryById(state.player.countryId);
  const pending = state.player.pendingSalary;
  const cap = pendingCap(state);
  const n = state.nations[me.id];
  const wars = COUNTRIES.filter((c) => c.id !== me.id && isAlive(state.world, c.id) && relationOf(state.world, me.id, c.id) === '전쟁');
  const latest = state.world.events.find((e) => e.mine);
  const fallen = !isAlive(state.world, me.id);
  const a = state.officer.active;
  const rank = state.player.rankIndex;
  const drills = drillsNow(state.officer, state.worldMs).count;
  const pc = promotionCheck(state);
  const promoPct = pc.lines.length ? Math.round((pc.lines.reduce((x, l) => x + Math.min(1, l.have / Math.max(1, l.need)), 0) / pc.lines.length) * 100) : 100;
  const errandsDone = state.officer.aides.filter((x) => x.errand && state.worldMs >= x.errand.endMs).length;
  const [endingOpen, setEndingOpen] = useState(true);
  const [cityPick, setCityPick] = useState<string | null>(null);
  const [talkOpen, setTalkOpen] = useState(false);
  const talks = state.officer.talks ?? [];
  const [dayMode, setDayModeState] = useState<DayMode>(() => {
    try {
      return (localStorage.getItem('modern-war-day') as DayMode) || '자동';
    } catch {
      return '자동';
    }
  });
  const setDayMode = (m: DayMode) => {
    setDayModeState(m);
    try {
      localStorage.setItem('modern-war-day', m);
    } catch {
      /* 무시 */
    }
  };
  const goTab = (screen: Screen, key: string, tab: string) => {
    try {
      sessionStorage.setItem(`tab:${key}`, tab);
    } catch {
      /* 무시 */
    }
    go(screen);
  };
  const missionReady = !!a && state.worldMs >= a.endMs;

  // 지도 위 건물(아이콘 + 이름). x·y는 화면 비율(%)
  const spots: Array<{ icon: string; label: string; x: number; y: number; on: () => void; badge?: string | number | null; locked?: boolean; main?: boolean }> =
    [
      { icon: '💬', label: '대화', x: 90, y: 20, on: () => setTalkOpen(true), badge: talks.length || null },
      { icon: '🧑‍✈️', label: '부관', x: 90, y: 36, on: () => goTab('officer', 'officer', 'aides'), badge: errandsDone || null },
      { icon: '🏙️', label: '대전투', x: 10, y: 87, on: () => goTab('ops', 'ops', 'grand'), locked: rank < OPERATION_RANK },
      { icon: '📯', label: '전령', x: 30, y: 87, on: () => go('herald'), badge: unread > 0 ? unread : null },
      { icon: '📖', label: '도감', x: 50, y: 87, on: () => go('codex') },
      { icon: '🧪', label: '시험', x: 90, y: 87, on: () => go('settings') },
    ];

  return (
    <div className="home-stage">
      <HomeLand countryId={me.id} world={state.world} atWar={wars.length > 0} dayMode={dayMode} onDayMode={setDayMode} onCity={setCityPick} />
      {talkOpen && <TalkModal state={state} actions={actions} onClose={() => setTalkOpen(false)} />}
      {cityPick && <CityModal {...props} id={cityPick} atWar={wars.length > 0} onClose={() => setCityPick(null)} />}

      <div className="home-res">
        <Chip icon="💵" value={fmt(state.player.salary)} label="봉급" />
        <Chip icon="🏅" value={fmt(state.officer.merit)} label="공훈" />
        <Chip icon="💰" value={fmt(n.treasury)} label="국방예산" />
        <Chip icon="🪖" value={fmt(n.troops)} label="병력" />
        <Chip icon="🏙️" value={citiesOf(state.world, me.id).length} label="도시" />
      </div>

      <div className="home-side">
        <button className="home-mini" onClick={() => goTab('ops', 'ops', 'map')} aria-label="세계 지도">
          <WorldMap world={state.world} playerCountryId={me.id} selectedId={null} onSelect={() => goTab('ops', 'ops', 'map')} mini />
          <small>🌍 세계 지도</small>
        </button>

        <div className="home-quests">
          <b className="hq-title">📌 주요 임무</b>
          {talks.length > 0 && (
            <button className="hq hot talk-hq" onClick={() => setTalkOpen(true)}>
              <span>{talks[0].icon}</span>
              <span className="hq-main">
                <b>
                  {talks[0].speaker}
                  {talks.length > 1 ? ` 외 ${talks.length - 1}` : ''}
                </b>
                <small>💬 대화를 기다려요 · {timeLeft(talks[0].untilMs - state.worldMs)}</small>
              </span>
            </button>
          )}
          <button className={`hq ${!a || missionReady ? 'hot' : ''}`} onClick={() => goTab('ops', 'ops', 'mission')}>
            <span>{a ? (missionReady ? '✅' : '⏳') : '🎯'}</span>
            <span className="hq-main">
              <b>{a ? a.title : '임무 고르기'}</b>
              <small>{a ? (missionReady ? '도착! 전투하기' : `${timeLeft(a.endMs - state.worldMs)} 남음`) : '게시판에 새 임무'}</small>
            </span>
          </button>
          <button className={`hq ${pc.ready ? 'hot' : ''}`} onClick={() => goTab('officer', 'officer', 'stats')}>
            <span>🎓</span>
            <span className="hq-main">
              <b>{pc.ready ? '승급 심사 가능!' : `승급 준비 ${promoPct}%`}</b>
              <span className="bar">
                <span className="bar-fill" style={{ width: `${promoPct}%` }} />
              </span>
            </span>
          </button>
          <button className={`hq ${drills > 0 ? 'hot' : ''}`} onClick={() => go('training')}>
            <span>📅</span>
            <span className="hq-main">
              <b>
                훈련 일정 {drills}/{DRILL_MAX}
              </b>
              <small>{drills > 0 ? '훈련할 수 있어요' : '일정이 차는 중'}</small>
            </span>
          </button>
          <button className={`hq ${pending >= cap * 0.5 ? 'hot' : ''}`} disabled={pending < 1} onClick={actions.claim}>
            <span>💵</span>
            <span className="hq-main">
              <b>봉급 받기 +{fmt(pending)}</b>
              <span className="bar">
                <span className="bar-fill" style={{ width: `${Math.min(100, (pending / cap) * 100)}%` }} />
              </span>
            </span>
          </button>
          {wars.length > 0 && (
            <div className="hq-wars">
              <small>전쟁 중</small>
              {wars.slice(0, 5).map((c) => (
                <span key={c.id} title={c.name}>
                  {FLAG[c.id]}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="bld-col">
        {spots.map((sp) => (
          <button
            key={sp.label}
            className={`bld ${sp.main ? 'main' : ''} ${sp.locked ? 'locked' : ''}`}
            onClick={sp.locked ? undefined : sp.on}
            aria-label={sp.label}
          >
            <span className="bld-ico">{sp.locked ? '🔒' : sp.icon}</span>
            <small>{sp.label}</small>
            {sp.badge != null && sp.badge !== 0 && !sp.locked && <i className="bld-badge">{sp.badge}</i>}
          </button>
        ))}
      </div>

      {latest && (
        <button className="home-news" onClick={() => go('herald')}>
          📯 {latest.text}
        </button>
      )}
      {fallen && <div className="home-alert">{me.name}의 도시를 모두 잃었어요. 망명 정부로 버티는 중이에요.</div>}
      {state.ending && endingOpen && (
        <Modal title="전쟁 끝" icon="🏆" onClose={() => setEndingOpen(false)}>
          <EndingCard {...props} />
        </Modal>
      )}
    </div>
  );
}

const STATUS_TEXT: Record<string, string> = {
  평화: '🌤️ 평화로운 일상이에요. 시장과 도로가 붐벼요.',
  전시: '🛡️ 나라는 전쟁 중이지만 이 도시는 아직 평온해요.',
  공격받음: '🔥 적의 공격을 받고 있어요! 방어도가 떨어졌어요.',
  점령당함: '🚩 적에게 빼앗겼어요. 대전투로 되찾을 수 있어요.',
};

/** 본부 지도에서 도시를 눌렀을 때 */
function CityModal({ state, go, id, atWar, onClose }: ScreenProps & { id: string; atWar: boolean; onClose: () => void }) {
  const c = cityById(id);
  const owner = state.world.owner[id];
  const st = cityStatus(c, state.world, state.player.countryId, atWar);
  const def = Math.round(state.world.defense[id]);
  const res = Object.entries(CITY_RES[c.name] ?? {}) as Array<[Res, number]>;
  return (
    <Modal title={c.name} icon={FLAG[owner]} onClose={onClose}>
      <p className="small">{STATUS_TEXT[st]}</p>
      <div className="tiles c3">
        <Tile icon={c.capital ? '★' : '🏙️'} label={c.capital ? '수도' : '도시'} sub={countryById(owner).name} />
        <Tile icon="🛡️" label={`방어도 ${def}`} sub={`최대 ${CITY_DEFENSE_MAX}`} tone={def < CITY_DEFENSE_MAX - 2 ? 'red' : 'green'} />
        <Tile icon="⛏️" label="자원" sub={res.map(([r, n]) => `${RES_ICON[r]}${n}`).join(' ') || '없음'} />
      </div>
      {st === '점령당함' && (
        <button className="primary wide-btn" onClick={() => go('ops')}>
          🏙️ 작전 화면에서 되찾기
        </button>
      )}
    </Modal>
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
          <p className="empty">🔒 개척 지도자부터 작전, 존경받는 지도자부터 대전투(도시 점령)가 열려요.</p>
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
        help={<p>나라를 누르면 자세한 정보가 떠요. 두 손가락·휠·＋−로 확대하고 끌어서 옮겨요. 🚢 항모 전단은 평소 앞바다를 순찰하고, 전쟁이 나면 적 쪽으로 나아가요. ✈️ 전투기는 평시엔 순찰, 전쟁 땐 적 수도로 출격해요.</p>}
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
            <p>
              존경받는 지도자부터 국방예산과 전략 자원으로 부대를 만들 수 있어요. 만든 부대는 병력·전투력이 되고, 전투력이 높으면 대전투가 쉬워지고 점령지를 잘 지켜요.
            </p>
          </Help>
        </div>
        {e.queue.length > 0 && (
          <div className="small" style={{ marginTop: 6 }}>
            🔨 생산 중: {e.queue.map((q) => `${q.special ? me.specialUnit.name : q.unit}(${timeLeft(q.endMs - state.worldMs)})`).join(' · ')}
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
            tone={
              c.id === me ? 'gold' : relationOf(state.world, me, c.id) === '전쟁' ? 'red' : relationOf(state.world, me, c.id) === '연합' ? 'blue' : undefined
            }
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
  const top = state.player.rankIndex >= DIPLO_RANK;
  const wait = diploReady(state) - state.worldMs;
  return (
    <Card
      title="외교 (우리와)"
      icon="🌐"
      right={top ? <Chip icon="📜" value={wait > 0 ? timeLeft(wait) : '가능'} /> : undefined}
      help={
        <>
          <p>휴전·중립인 나라와는 긴장도가 쌓여요. 100이 되면 휴전이 깨지거나 전쟁이 나요.</p>
          <p>존경받는 지도자가 되면 나라를 눌러 직접 선전포고·휴전 제안·연합 제안을 해요({DIPLO_COOLDOWN_HOURS}시간마다 한 번). 연합국은 승리 조건에 함께 세어져요.</p>
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
                      setMsg(
                        actions.applyWith((s) => {
                          const r = doDiplo(s, sel, act);
                          return { state: r.state, out: r.text };
                        }) ?? '',
                      );
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
      <p className="small muted">루비로 기다리는 시간(훈련 일정·승급 심사·생산·이동)을 줄이는 곳이에요.</p>
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
          <Tile
            key={c.id}
            icon={FLAG[c.id]}
            label={c.name}
            sub={isAlive(state.world, c.id) ? c.difficulty : '도시 없음'}
            locked={!isAlive(state.world, c.id)}
            onClick={() => setSel(c.id)}
          >
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
          <button onClick={() => (setCode(actions.exportCode()), setMsg('아래 저장 코드를 복사해 두면 다른 기기에서도 이어할 수 있어요.'))}>
            저장 코드 만들기
          </button>
          <button onClick={() => setMsg(actions.importCode(code) ?? '저장 코드로 불러왔어요.')}>저장 코드로 불러오기</button>
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
          <button className="gold" onClick={() => (actions.apply(grantTestResources), setMsg('봉급·국방예산·병력·자원·가속권을 넉넉히 넣었어요.'))}>🎁 시험 자원 넉넉히</button>
          <button
            className={state.officer.examPenalty ? '' : 'on'}
            onClick={() => actions.apply((s) => ({ ...s, officer: { ...s.officer, examPenalty: !s.officer.examPenalty, examReadyMs: 0 } }))}
          >
            승급 심사 탈락 대기: {state.officer.examPenalty ? '켜짐(6시간)' : '꺼짐(바로 재도전)'}
          </button>
          <button className="gold" onClick={() => (actions.apply(debugTalk), setMsg('대화가 하나 왔어요. 본부의 💬 대화를 눌러 보세요.'))}>💬 대화 바로 받기</button>
          <button
            className="gold"
            disabled={state.player.rankIndex >= PROMOTION.length}
            onClick={() => (actions.apply(debugPromote), setMsg('승급 심사 없이 바로 다음 등급으로 올렸어요.'))}
          >
            ⏫ 바로 승급(심사 생략)
          </button>
          <button className="gold" onClick={() => (actions.apply(fillPromotion), setMsg('이번 등급의 승급 조건(공훈·훈련 별·신뢰도)을 채웠어요. 장교 화면에서 승급 심사를 보세요.'))}>
            🎖️ 승급 조건 채우기
          </button>
        </div>
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
        <small>승급 시험용</small>
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
            승급 조건 채우기
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
                  economy: {
                    ...s.economy,
                    stock,
                    facilities: Object.fromEntries(
                      Object.entries(s.economy.facilities).map(([k, f]) => [k, { ...f, exp: f.exp + 500 }]),
                    ) as typeof s.economy.facilities,
                  },
                };
              })
            }
          >
            내정 시험(예산·자원·경험치 채우기)
          </button>
          <button onClick={() => actions.apply((s) => ({ ...s, officer: { ...s.officer, boosts: boostsOf(s) + 100 } }))}>🎫 가속권 +100</button>
          <button onClick={() => actions.apply((s) => debugAddAide({ ...s, player: { ...s.player, salary: s.player.salary + 5000 } }))}>
            부관 데려오기 + 봉급 5000
          </button>
        </div>
        <small>등급 바로 바꾸기 (승급 심사 없이)</small>
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
