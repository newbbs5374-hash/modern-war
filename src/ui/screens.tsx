import { meetBadge } from './MeetUI';
// 기능별 화면 묶음. 아래 메뉴 7칸 + 본부(홈) + 설정·전령·도감.
import { payPreview } from '../game/payday';
import { CITY_INST, instById } from '../data/institutions';
import { ReportScreen, reportCount } from './ReportScreen';
import { CultureScreen } from './CultureScreen';
import { BriefingModal } from './BriefingUI';
import { todos } from '../game/briefing';
import { useState } from 'react';
import { BLOCS, COUNTRIES, countryById } from '../data/world';
import { pendingCap, type GameState } from '../game/state';
import { citiesOf, isAlive, relationOf } from '../game/world';
import { Card, CountryInfo, EventList, fmt } from './common';
import type { Screen } from './nav';
import { COUNTRY_COLORS, REL_COLORS, WorldMap, type MapMode } from './WorldMap';
import { Globe } from './globe/Globe';
import { Safe } from './Safe';
import { GrandCard, MissionCard, timeLeft } from './officerScreens';
import { DRILL_MAX, drillsNow } from '../game/officer';
import { nextTitle, titleOf, titleScore } from '../game/title';
import { BattleScreen } from './battle/BattleScreen';
import { EndingCard, VictoryCard } from './victoryScreens';
import { Chip, Modal, Tile, useTab } from './kit';
import { FLAG } from './flag';
import { HomeLand, cityStatus, type DayMode } from './HomeLand';
import { cityGrowthMap, cityStage } from '../game/growth';
import { cityTagMap } from '../game/cityTags';
import { CITIES, cityById } from '../data/cities';
import { CITY_RES, RES_ICON, type Res } from '../data/economy';
import { CITY_DEFENSE_MAX } from '../game/balance';
import { GRAND_RANK, OPERATION_RANK } from '../data/officers';
import { RANKS } from '../data/ranks';
import { TalkModal } from './TalkModal';
import { CrisisModal } from './CrisisModal';
import { clashes, openRequests, placeName } from '../game/deploy';
import { clashById } from '../data/deployOps';
import { OrdersModal } from './OrdersModal';
import { FleetWatchCard } from './FleetWatch';
import { ORDER_INFO, ordersOf } from '../game/orders';
import { crisisById, crisisOf } from '../game/crisis';
import { goalsReady } from '../game/goals';
import { GUIDE, claimGuide, guideOf, guideStep, hideGuide, rewardText } from '../game/guide';
import { DiplomacyScreen } from './DiplomacyScreen';
import { DefenseScreen, EconomyScreen, PersonalScreen, SocietyScreen } from './MainScreens';
import { routeTo } from './nav';
import { SettingsScreen } from './SettingsScreen';
import { UiIcon } from './uiIcon';
import { SnsPhone } from './SnsPhone';
import { ActCard, BattleLogCard, CounterCards, RaidCards, SecurityCards, WorldCrisisCard } from './ActsUI';
import { TodoCard, TreeScreen } from './TreeScreen';
import { snsUnread } from '../game/leaderSns';

export interface GameActions {
  claim: () => void;
  save: () => void;
  /** 카카오 서버와 지금 맞추기 */
  cloudSync: () => void;
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
  const pay = payPreview(state);
  const wars = COUNTRIES.filter((c) => c.id !== me.id && isAlive(state.world, c.id) && relationOf(state.world, me.id, c.id) === '전쟁');
  const latest = state.world.events.find((e) => e.mine);
  const fallen = !isAlive(state.world, me.id);
  const a = state.officer.active;
  const rank = state.player.rankIndex;
  const drills = drillsNow(state.officer, state.worldMs).count;
  const ttl = titleOf(state);
  const ttlNext = nextTitle(state);
  const ttlPct = ttlNext ? Math.round(Math.min(1, titleScore(state) / Math.max(1, ttlNext.title.min)) * 100) : 100;
  const errandsDone = state.officer.aides.filter((x) => x.errand && state.worldMs >= x.errand.endMs).length;
  const [endingOpen, setEndingOpen] = useState(true);
  const [cityPick, setCityPick] = useState<string | null>(null);
  const [brfOpen, setBrfOpen] = useState(false);
  const [talkOpen, setTalkOpen] = useState(false);
  const [crisisOpen, setCrisisOpen] = useState(false);
  const [ordersOpen, setOrdersOpen] = useState(false);
  const [snsOpen, setSnsOpen] = useState(false);
  const crisis = crisisOf(state).open;
  const gstep = guideStep(state);
  const gready = !!gstep && gstep.done(state);
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
  const goTab = (screen: string, key: string, tab: string) => go(routeTo(screen, key, tab));
  const missionReady = !!a && state.worldMs >= a.endMs;
  // 레이더 아래 숫자: 우리나라와 다른 나라 사이 가장 높은 긴장(전쟁 아닌 쌍)
  const tension = Math.round(
    Object.entries(state.world.pairs).reduce((m, [k, p]) => (k.split('|').includes(me.id) && p.rel !== '전쟁' ? Math.max(m, p.tension) : m), 0),
  );

  // 지도 위 건물(아이콘 + 이름). x·y는 화면 비율(%)
  const spots: Array<{ icon: string; label: string; x: number; y: number; on: () => void; badge?: string | number | null; locked?: boolean; main?: boolean }> =
    [
      { icon: '💬', label: '대화', x: 90, y: 20, on: () => setTalkOpen(true), badge: talks.length || null },
      { icon: '📱', label: '정상 SNS', x: 90, y: 28, on: () => setSnsOpen(true), badge: snsUnread(state) || null },
      { icon: '🧑‍✈️', label: '부관', x: 90, y: 36, on: () => goTab('officer', 'officer', 'aides'), badge: errandsDone || null },
      { icon: '📒', label: '인맥', x: 90, y: 44, on: () => goTab('personal', 'personal', 'meet'), badge: meetBadge(state) },
      { icon: '📋', label: '명령', x: 90, y: 52, on: () => setOrdersOpen(true), badge: ORDER_INFO.filter((x) => ordersOf(state)[x.key]).length || null },
      { icon: '🛒', label: '상점', x: 90, y: 68, on: () => go('shop'), badge: goalsReady(state) || null },
      { icon: '🏙️', label: '대전투', x: 10, y: 87, on: () => goTab('ops', 'ops', 'grand'), locked: rank < OPERATION_RANK },
      { icon: '📨', label: '보고', x: 90, y: 4, on: () => go('report'), badge: reportCount(state) || null },
      { icon: '📯', label: '전령', x: 30, y: 87, on: () => go('herald'), badge: unread > 0 ? unread : null },
      { icon: '📖', label: '도감', x: 50, y: 87, on: () => go('codex') },
      { icon: '📰', label: '국정 보고', x: 70, y: 87, on: () => setBrfOpen(true), badge: todos(state).length || null },
      { icon: '🧪', label: '시험', x: 90, y: 87, on: () => go('settings') },
    ];

  return (
    <div className="home-stage">
      <HomeLand countryId={me.id} world={state.world} atWar={wars.length > 0} dayMode={dayMode} onDayMode={setDayMode} onCity={setCityPick} cityGrowth={cityGrowthMap(state, me.id)} cityTags={cityTagMap(state)} />
      {talkOpen && <TalkModal state={state} actions={actions} onClose={() => setTalkOpen(false)} />}
      {crisisOpen && crisis && <CrisisModal state={state} apply={actions.apply} onClose={() => setCrisisOpen(false)} />}
      {snsOpen && <SnsPhone state={state} actions={actions} onClose={() => setSnsOpen(false)} />}
      {ordersOpen && <OrdersModal state={state} apply={actions.apply} onClose={() => setOrdersOpen(false)} />}
      {cityPick && <CityModal {...props} id={cityPick} atWar={wars.length > 0} onClose={() => setCityPick(null)} />}
      {brfOpen && <BriefingModal state={state} onClose={() => setBrfOpen(false)} goTab={goTab} />}

      <div className="home-side">
        <button className="home-mini radar" onClick={() => goTab('ops', 'ops', 'map')} aria-label="세계 레이더(세계 지도)">
          <span className="radar-scope">
            <WorldMap world={state.world} playerCountryId={me.id} selectedId={null} onSelect={() => goTab('ops', 'ops', 'map')} mini />
            <i className="ring r1" />
            <i className="ring r2" />
            <i className="cross" />
            <i className="sweep" />
          </span>
          <small className={`radar-label ${wars.length > 0 || tension >= 60 ? 'hot' : ''}`}>
            ◤ 세계 레이더 · {wars.length > 0 ? `전쟁 ${wars.length}` : `긴장 ${tension}%`}
          </small>
        </button>
        <div className="home-quests">
          <b className="hq-title">📌 주요 임무</b>
          <ActCard state={state} />
          <CounterCards state={state} go={go} />
          <RaidCards state={state} apply={actions.apply} applyWith={actions.applyWith} />
          <WorldCrisisCard state={state} apply={actions.apply} />
          <SecurityCards state={state} applyWith={actions.applyWith} />
          <TodoCard state={state} go={go} apply={actions.apply} />
          {gstep && !guideOf(state).hidden && (
            <div className="guide-hq">
              <button
                className={`hq ${gready ? 'hot' : ''}`}
                onClick={() => (gready ? actions.apply(claimGuide) : goTab(gstep.go.screen, gstep.go.key ?? '', gstep.go.tab ?? ''))}
                title={gstep.say}
              >
                <span>{gstep.icon}</span>
                <span className="hq-main">
                  <b>
                    📘 {guideOf(state).step + 1}/{GUIDE.length} {gstep.title}
                  </b>
                  <small>{gready ? `✅ 보상 받기 · ${rewardText(gstep.reward)}` : gstep.say}</small>
                </span>
              </button>
              <button className="guide-hide" aria-label="안내 숨기기" onClick={() => actions.apply((s) => hideGuide(s, true))}>
                ✕
              </button>
            </div>
          )}
          {crisis && (
            <button className="hq hot crisis-hq" onClick={() => setCrisisOpen(true)}>
              <span>{crisisById(crisis.def).icon}</span>
              <span className="hq-main">
                <b>⚡ {crisisById(crisis.def).title}</b>
                <small>결정을 기다려요 · {timeLeft(crisis.untilMs - state.worldMs)}</small>
              </span>
            </button>
          )}
          {clashes(state).slice(0, 1).map((x) => (
            <button key={x.id} className="hq hot crisis-hq" onClick={() => goTab('diplo', 'diplo', 'deploy')}>
              <span>{clashById(x.clash!.id)?.icon ?? '⚔️'}</span>
              <span className="hq-main">
                <b>
                  ⚔️ {placeName(x.to)} · {clashById(x.clash!.id)?.title}
                  {clashes(state).length > 1 ? ` 외 ${clashes(state).length - 1}` : ''}
                </b>
                <small>파병 부대 교전 · {timeLeft(x.clash!.untilMs - state.worldMs)}</small>
              </span>
            </button>
          ))}
          {openRequests(state).length > 0 && (
            <button className="hq" onClick={() => goTab('diplo', 'diplo', 'deploy')}>
              <span>📨</span>
              <span className="hq-main">
                <b>파병 요청 {openRequests(state).length}건</b>
                <small>{openRequests(state).map((r) => placeName(r.region)).join(' · ')}</small>
              </span>
            </button>
          )}
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
          <button className="hq" onClick={() => goTab('personal', 'personal', 'profile')}>
            <span>{ttl.icon}</span>
            <span className="hq-main">
              <b>{ttl.name}</b>
              {ttlNext ? <small>다음 호칭까지 {ttlNext.need}점</small> : <small>가장 높은 호칭</small>}
              <span className="bar">
                <span className="bar-fill" style={{ width: `${ttlPct}%` }} />
              </span>
            </span>
          </button>
          <button className={`hq ${drills > 0 ? 'hot' : ''}`} onClick={() => goTab('training', 'defense', 'train')}>
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
              {pay.salary > 0 && <small>💰예산 +{fmt(pay.budget)}{pay.ruby ? ` · 💎+${pay.ruby}` : ''}{pay.boosts ? ` · 🎫+${pay.boosts}` : ''}</small>}
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
            onClick={sp.on}
            aria-label={sp.label}
          >
            <span className="bld-ico">{sp.locked ? <span className="ui-emo">🔒</span> : <UiIcon label={sp.label} emoji={sp.icon} />}</span>
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
        <Modal title="승리!" icon="🏆" onClose={() => setEndingOpen(false)}>
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
      <p className="small" style={{ marginTop: 6 }}>
        🏛️ 기관:{' '}
        {(CITY_INST[c.name] ?? []).length
          ? (CITY_INST[c.name] ?? []).map((i) => `${instById(i).icon} ${instById(i).name}(${instById(i).does})`).join(' · ')
          : '없음'}
      </p>
      {st === '점령당함' && (
        <button className="primary wide-btn" onClick={() => go(routeTo('ops', 'ops', 'mission'))}>
          🏙️ 국방 → 작전에서 되찾기
        </button>
      )}
    </Modal>
  );
}

/* ───────── 작전: 임무 · 대전투 · 지도 · 전황 (탭) ───────── */
type OpsTab = 'mission' | 'grand' | 'map' | 'news';
/** 국방 > 작전: 임무 · 대전투 · 지도 · 전황(작은 버튼 줄로 한 화면) */
export function OpsScreen(props: ScreenProps) {
  const { state } = props;
  const rank = state.player.rankIndex;
  const [raw, setTab] = useTab<OpsTab>('ops', 'mission');
  const tab: OpsTab = (['mission', 'grand', 'map', 'news'] as const).includes(raw) ? raw : 'mission';
  const ready = state.officer.active && state.worldMs >= state.officer.active.endMs;
  const segs: Array<{ id: OpsTab; label: string; locked?: boolean; badge?: boolean }> = [
    { id: 'mission', label: '🎯 임무', badge: !!ready },
    { id: 'grand', label: '🏙️ 대전투', locked: rank < OPERATION_RANK },
    { id: 'map', label: '🗺️ 지도' },
    { id: 'news', label: '📰 전황' },
  ];
  return (
    <>
      <div className="seg branch-tabs">
        {segs.map((x) => (
          <button key={x.id} className={tab === x.id ? 'on' : ''} onClick={() => setTab(x.id)}>
            {x.locked ? '🔒 ' : ''}
            {x.label}
            {x.badge ? ' ❗' : ''}
          </button>
        ))}
      </div>
      {tab === 'mission' && (
        <>
          <MissionCard {...props} />
          <WarStrip {...props} />
          <BattleLogCard state={props.state} />
        </>
      )}
      {tab === 'grand' &&
        (rank < OPERATION_RANK ? (
          <p className="empty">🔒 {RANKS[OPERATION_RANK].name}부터 작전, {RANKS[GRAND_RANK].name}부터 대전투(도시 점령)가 열려요.</p>
        ) : (
          <>
            <GrandCard {...props} />
            {rank >= 8 && <VictoryCard {...props} />}
          </>
        ))}
      {tab === 'map' && <MapPanel {...props} />}
      {tab === 'news' && <FleetWatchCard {...props} />}
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
  const [mode, setMode] = useState<MapMode>('나라');
  // 11-27 입체 지구본: 기본은 지구본, 고른 보기는 기억
  const [globe, setGlobeRaw] = useState(() => {
    try {
      return localStorage.getItem('mw-map-globe') !== '0';
    } catch {
      return true;
    }
  });
  const setGlobe = (v: boolean) => {
    setGlobeRaw(v);
    try {
      localStorage.setItem('mw-map-globe', v ? '1' : '0');
    } catch {
      /* 저장 못 해도 그대로 */
    }
  };
  const globeColor = (id: string) =>
    mode === '나라' ? COUNTRY_COLORS[id] ?? '#94a3b8' : mode === '묶음' ? BLOCS[countryById(id).bloc].color : id === me ? REL_COLORS['나'] : REL_COLORS[relationOf(w, me, id)];
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
            <button className={globe ? 'on' : ''} onClick={() => setGlobe(!globe)} aria-label="지구본으로 보기">
              🌐
            </button>
            {(['나라', '관계', '묶음'] as MapMode[]).map((m) => (
              <button key={m} className={mode === m ? 'on' : ''} onClick={() => setMode(m)}>
                {m}
              </button>
            ))}
          </span>
        }
        help={<p>나라를 누르면 자세한 정보가 떠요. 두 손가락·휠·＋−로 확대하고 끌어서 옮겨요. 점선은 도(주·성) 경계예요. 주요 도시를 점령하면 공격을 시작한 도시부터 그 도시까지 길목의 땅도 함께 차지하고, 빼앗긴 땅은 점령한 나라 색에 빗금으로 보여요. 🚢✈️🛡️ 배·비행기·전차는 그 나라가 가진 병과예요(우리나라는 직접 만든 부대). 평소엔 자기 나라 둘레를 순찰하고, 전쟁이 나면 적 쪽으로 나아가요. 해외 파병(외교 → 파병) 부대는 파병 간 나라 둘레에서 움직여요. 확대할수록 자세해져요: 3배부터 실제 강·고속도로와 도시 단계 아이콘, 5배부터 철도·지방 도로. 서로 전쟁 중인 두 나라 땅이 맞닿은 곳엔 붉은 전선이 생기고, 공격받는 도시는 붉게 깜빡여요.</p>}
      >
        {globe ? (
          <Safe where="지구본" small>
            <Globe world={w} playerCountryId={me} selectedId={sel} onSelect={setSel} colorOf={globeColor} onFail={() => setGlobe(false)} />
          </Safe>
        ) : (
        <WorldMap
          world={w}
          playerCountryId={me}
          selectedId={sel ?? me}
          onSelect={setSel}
          mode={mode}
          cityLv={Object.fromEntries(CITIES.map((c) => [c.id, cityStage(state, c.id).stage.lv]))}
          army={{ ...state.economy.army }}
          deploys={(state.deploy?.list ?? []).map((d) => ({
            from: me,
            to: d.to,
            units: Object.entries(d.units)
              .sort((a, b) => b[1] - a[1])
              .map(([n]) => n),
            phase: d.returnMs ? 'back' : state.worldMs < d.arriveMs ? 'go' : 'stay',
          }))}
        />
        )}
        <div className="legend small">
          {mode === '나라'
            ? COUNTRIES.filter((c) => isAlive(w, c.id)).map((c) => (
                <span key={c.id}>
                  <i style={{ background: COUNTRY_COLORS[c.id] }} /> {c.id === me ? `${c.name}(나)` : c.name}
                </span>
              ))
            : mode === '관계'
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

/* ───────── 상점: ShopScreen.tsx ───────── */
import { ShopScreen } from './ShopScreen';
export { ShopScreen };

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

export const SCREENS: Record<Screen, (p: ScreenProps) => React.JSX.Element> = {
  home: HomeScreen,
  personal: PersonalScreen,
  defense: DefenseScreen,
  diplo: DiplomacyScreen,
  society: SocietyScreen,
  economy: EconomyScreen,
  culture: CultureScreen,
  tree: TreeScreen,
  // 옛 이름(routeTo가 새 탭으로 옮겨 주지만, 혹시 남아 있어도 열리게)
  ops: DefenseScreen,
  officer: PersonalScreen,
  forces: DefenseScreen,
  training: PersonalScreen,
  nation: EconomyScreen,
  shop: ShopScreen,
  settings: SettingsScreen,
  herald: HeraldScreen,
  report: ReportScreen,
  codex: CodexScreen,
  battle: BattleScreen,
};
