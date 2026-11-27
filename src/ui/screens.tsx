import { favsOf, fullHomeOn } from './favs';
import { goSpot, spotsOf } from './TreeScreen';
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
import { COUNTRY_COLORS, MODE_LEGEND, REL_COLORS, WorldMap, modeColor, type MapMode } from './WorldMap';
import { Globe } from './globe/Globe';
import { Safe } from './Safe';
import { GrandCard, MissionCard, timeLeft } from './officerScreens';
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
import { GUIDE, claimGuide, guideOf, guideStep, rewardText } from '../game/guide';
import { DiplomacyScreen } from './DiplomacyScreen';
import { DefenseScreen, EconomyScreen, PersonalScreen, SocietyScreen } from './MainScreens';
import { routeTo } from './nav';
import { SettingsScreen } from './SettingsScreen';
import { UiIcon } from './uiIcon';
import { SnsPhone } from './SnsPhone';
import { ActRing, BattleLogCard, CounterCards, RaidCards, SecurityCards, WorldCrisisCard } from './ActsUI';
import { NextCarousel, type NextItem } from './HomeNext';
import { raidOf } from '../game/missileWar';
import { counterOf } from '../game/counter';
import { secOf } from '../game/security';
import { wcById, wcOf } from '../game/worldCrisis';
import { DayPlan, TodoList, TreeScreen, dayFree, todoCount } from './TreeScreen';
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
  const allSpots: Array<{ icon: string; label: string; x: number; y: number; on: () => void; badge?: string | number | null; locked?: boolean; main?: boolean }> =
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
  // 11-27 화면 5: 본부 간단히 = 아이콘 3개(대화·SNS·보고) + 내가 꽂은 즐겨찾기 4개
  const simple = !fullHomeOn();
  const favSpots = simple
    ? favsOf()
        .map((k) => spotsOf(state).find((sp) => sp.key === k))
        .filter((sp): sp is NonNullable<typeof sp> => !!sp)
    : [];
  const spots = simple ? allSpots.filter((sp) => ['대화', '정상 SNS', '보고'].includes(sp.label)) : allSpots;

  // 11/28 지금 할 일 카드(급한 것 → 받을 것 → 할 것 순)
  const [pop, setPop] = useState<'urgent' | 'todo' | null>(null);
  const urgentNames = [
    ...raidOf(state).list.map((r) => `미사일 경보 · ${cityById(r.city).name}`),
    ...counterOf(state).list.map((c) => `반격 경보 · ${cityById(c.city).name}`),
    ...secOf(state).list.map((c) => `저항 조직 · ${cityById(c.city).name}`),
    ...(wcOf(state).open && !wcOf(state).open!.side ? [`세계 위기 · ${wcById(wcOf(state).open!.def).title}`] : []),
  ];
  const nextItems: NextItem[] = [];
  if (crisis)
    nextItems.push({ key: 'crisis', tone: 'red', who: '비서실장', title: <>⚡ {crisisById(crisis.def).title}</>, chips: [['dn', `남은 ${timeLeft(crisis.untilMs - state.worldMs)}`]], act: '결정', on: () => setCrisisOpen(true) });
  if (urgentNames.length)
    nextItems.push({ key: 'urgent', tone: 'red', who: '합참', icon: '🚨', title: urgentNames[0], chips: urgentNames.length > 1 ? [['dn', `외 ${urgentNames.length - 1}건`]] : [['dn', '지금 막기']], act: '보기', on: () => setPop('urgent') });
  for (const x of clashes(state).slice(0, 1))
    nextItems.push({ key: `clash-${x.id}`, tone: 'red', who: '파병 부대', icon: clashById(x.clash!.id)?.icon ?? '⚔️', title: `${placeName(x.to)} · ${clashById(x.clash!.id)?.title ?? '교전'}`, chips: [['dn', `남은 ${timeLeft(x.clash!.untilMs - state.worldMs)}`]], act: '지휘', on: () => goTab('diplo', 'diplo', 'deploy') });
  if (pending >= cap * 0.5)
    nextItems.push({ key: 'pay', tone: 'amber', who: '비서실장', title: <>봉급과 나라 예산이 쌓였어요 · +{fmt(pending)}</>, chips: [['up', `예산 +${fmt(pay.budget)}`], ...(pay.ruby ? ([['am', `💎+${pay.ruby}`]] as NextItem['chips'] & object) : [])], act: '받기', on: actions.claim });
  if (talks.length)
    nextItems.push({ key: 'talk', tone: 'amber', who: talks[0].speaker, icon: talks[0].icon, title: talks.length > 1 ? `대화를 기다려요 (외 ${talks.length - 1}명)` : '대화를 기다려요', chips: [['', `⏱ ${timeLeft(talks[0].untilMs - state.worldMs)}`]], act: '대화', on: () => setTalkOpen(true) });
  if (missionReady) nextItems.push({ key: 'mission', tone: 'amber', who: '작전과', icon: '✅', title: `${a!.title} · 도착했어요`, act: '전투', on: () => goTab('ops', 'ops', 'mission') });
  if (gstep && !guideOf(state).hidden)
    nextItems.push({ key: 'guide', tone: gready ? 'amber' : 'teal', who: '비서실장', title: <>📘 {gstep.title}</>, chips: [[gready ? 'up' : '', gready ? rewardText(gstep.reward) : `${guideOf(state).step + 1}/${GUIDE.length}`]], act: gready ? '받기' : '가기', on: () => (gready ? actions.apply(claimGuide) : goTab(gstep.go.screen, gstep.go.key ?? '', gstep.go.tab ?? '')) });
  if (openRequests(state).length)
    nextItems.push({ key: 'req', tone: 'teal', who: '외교부', icon: '📨', title: `파병 요청 ${openRequests(state).length}건 · ${openRequests(state).map((r) => placeName(r.region)).join(' · ')}`, act: '보기', on: () => goTab('diplo', 'diplo', 'deploy') });
  if (!a) nextItems.push({ key: 'pick', tone: 'teal', who: '작전과', icon: '🎯', title: '게시판에 새 임무가 있어요', act: '고르기', on: () => goTab('ops', 'ops', 'mission') });
  else if (!missionReady) nextItems.push({ key: 'mission-go', tone: 'teal', who: '작전과', icon: '⏳', title: a.title, chips: [['te', `${timeLeft(a.endMs - state.worldMs)} 남음`]], act: '보기', on: () => goTab('ops', 'ops', 'mission') });
  if (todoCount(state) > 0 || dayFree(state) > 0)
    nextItems.push({ key: 'todo', tone: 'teal', who: '비서실장', icon: '📋', title: `오늘 할 일 ${todoCount(state)}건`, chips: dayFree(state) ? [['', `일정 ${dayFree(state)}칸 비었어요`]] : [], act: '보기', on: () => setPop('todo') });
  if (pending >= 1 && pending < cap * 0.5)
    nextItems.push({ key: 'pay2', tone: 'teal', who: '비서실장', icon: '💵', title: <>봉급 받기 +{fmt(pending)}</>, chips: [['up', `예산 +${fmt(pay.budget)}`]], act: '받기', on: actions.claim });
  // 지도 위 경보(도시 자리에 붉은 원)
  const alerts: Record<string, string> = {};
  for (const r of raidOf(state).list) alerts[r.city] = '미사일 경보';
  for (const c of counterOf(state).list) alerts[c.city] = '반격 경보';
  for (const c of secOf(state).list) alerts[c.city] ??= '저항 조직';
  const capId = CITIES.find((c) => c.home === me.id && c.capital)?.id;
  if (crisis && capId) alerts[capId] ??= crisisById(crisis.def).title;

  return (
    <div className="home-stage">
      <HomeLand countryId={me.id} world={state.world} atWar={wars.length > 0} dayMode={dayMode} onDayMode={setDayMode} onCity={setCityPick} cityGrowth={cityGrowthMap(state, me.id)} cityTags={cityTagMap(state)} alerts={alerts} onAlert={(id) => (crisis && id === capId && !raidOf(state).list.some((r) => r.city === id) ? setCrisisOpen(true) : setPop('urgent'))} />
      {talkOpen && <TalkModal state={state} actions={actions} onClose={() => setTalkOpen(false)} />}
      {crisisOpen && crisis && <CrisisModal state={state} apply={actions.apply} onClose={() => setCrisisOpen(false)} />}
      {snsOpen && <SnsPhone state={state} actions={actions} onClose={() => setSnsOpen(false)} />}
      {ordersOpen && <OrdersModal state={state} apply={actions.apply} onClose={() => setOrdersOpen(false)} />}
      {cityPick && <CityModal {...props} id={cityPick} atWar={wars.length > 0} onClose={() => setCityPick(null)} />}
      {brfOpen && <BriefingModal state={state} onClose={() => setBrfOpen(false)} goTab={goTab} />}

      {/* 11/28 디자인 개편 A안: 왼쪽 목록을 치우고 지도를 넓게. 왼쪽 위 = 장 진행 + 레이더, 맨 아래 = 지금 할 일 카드 하나 */}
      <div className="home-side gx-side">
        <ActRing state={state} />
        <button className="home-mini radar" onClick={() => goTab('ops', 'ops', 'map')} aria-label="세계 레이더(세계 지도)">
          <span className="radar-scope">
            <WorldMap world={state.world} playerCountryId={me.id} selectedId={null} onSelect={() => goTab('ops', 'ops', 'map')} mini />
            <i className="ring r1" />
            <i className="ring r2" />
            <i className="cross" />
            <i className="sweep" />
          </span>
          <small className={`radar-label ${wars.length > 0 || tension >= 60 ? 'hot' : ''}`}>
            {wars.length > 0 ? `전쟁 ${wars.length}` : `긴장 ${tension}%`}
          </small>
        </button>
      </div>
      {pop === 'urgent' && (
        <Modal title="급한 일" icon="🚨" onClose={() => setPop(null)}>
          <div className="home-quests gx-in-modal">
            <CounterCards state={state} go={go} />
            <RaidCards state={state} apply={actions.apply} applyWith={actions.applyWith} />
            <WorldCrisisCard state={state} apply={actions.apply} />
            <SecurityCards state={state} applyWith={actions.applyWith} />
          </div>
        </Modal>
      )}
      {pop === 'todo' && (
        <Modal title={`오늘 할 일 ${todoCount(state)}건`} icon="📋" onClose={() => setPop(null)}>
          <DayPlan state={state} apply={actions.apply} go={(sc) => (setPop(null), go(sc))} />
          <TodoList state={state} go={(sc) => (setPop(null), go(sc))} />
        </Modal>
      )}
      <NextCarousel state={state} items={nextItems} />

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
        {favSpots.map((sp) => (
          <button key={sp.key} className="bld fav" onClick={() => go(goSpot(sp))} aria-label={sp.label}>
            <span className="bld-ico"><span className="ui-emo">{sp.locked ? '🔒' : sp.icon}</span></span>
            <small>{sp.label}</small>
            {sp.badge ? <i className="bld-badge">{sp.badge}</i> : null}
          </button>
        ))}
        <button className="bld gx-gear" onClick={() => go('settings')} aria-label="설정">
          <span className="bld-ico"><span className="ui-emo">⚙️</span></span>
          <small>설정</small>
        </button>
        {simple && (
          <button className="bld fav-add" onClick={() => go('tree')} aria-label="즐겨찾기 고르기">
            <span className="bld-ico"><span className="ui-emo">{favSpots.length ? '🌳' : '⭐'}</span></span>
            <small>{favSpots.length ? '국정 나무' : '꽂기'}</small>
          </button>
        )}
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
      {owner === state.player.countryId && (
        <button
          className="primary wide-btn"
          onClick={() => {
            try {
              sessionStorage.setItem('city-focus', id);
            } catch {
              /* 무시 */
            }
            go(routeTo('society', 'society', 'city'));
          }}
        >
          🏙️ 도시 안으로 들어가기
        </button>
      )}
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
  const globeColor = (id: string) => modeColor(mode, w, me, id);
  const otherWars = Object.entries(w.pairs)
    .filter(([k, p]) => p.rel === '전쟁' && !k.split('|').includes(me) && k.split('|').every((id) => isAlive(w, id)))
    .map(([k]) => k.split('|'));
  return (
    <>
      <Card
        title="세계 지도"
        icon="🗺️"
        right={
          <span className="seg wm-modes">
            <button className={globe ? 'on' : ''} onClick={() => setGlobe(!globe)} aria-label="지구본으로 보기">
              🌐
            </button>
            {(['나라', '관계', '묶음', '군사', '긴장'] as MapMode[]).map((m) => (
              <button key={m} className={mode === m ? 'on' : ''} onClick={() => setMode(m)}>
                {m}
              </button>
            ))}
          </span>
        }
        help={<p>나라를 누르면 자세한 정보가 떠요. 두 손가락·휠·＋−로 확대하고 끌어서 옮겨요. 점선은 도(주·성) 경계예요. 주요 도시를 점령하면 공격을 시작한 도시부터 그 도시까지 길목의 땅도 함께 차지하고, 빼앗긴 땅은 점령한 나라 색에 빗금으로 보여요. 🚢✈️🛡️ 배·비행기·전차는 그 나라가 가진 병과예요(우리나라는 직접 만든 부대). 평소엔 자기 나라 둘레를 순찰하고, 전쟁이 나면 적 쪽으로 나아가요. 해외 파병(외교 → 파병) 부대는 파병 간 나라 둘레에서 움직여요. 확대할수록 자세해져요: 3배부터 실제 강·고속도로와 도시 단계 아이콘, 5배부터 철도·지방 도로. 서로 전쟁 중인 두 나라 땅이 맞닿은 곳엔 붉은 전선이 생기고, 공격받는 도시는 붉게 깜빡여요.</p>}
      >
        {MODE_LEGEND[mode].length > 0 && (
          <p className="wm-legend">
            {MODE_LEGEND[mode].map(([c, n]) => (
              <span key={n}>
                <i style={{ background: c }} />
                {n}
              </span>
            ))}
          </p>
        )}
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
