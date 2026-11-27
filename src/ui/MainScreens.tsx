import { MINISTRIES } from '../data/cabinet';
import { overheat } from '../game/econ';
import { MeetBook, meetBadge } from './MeetUI';
import { Safe } from './Safe';
// 대통령식 메뉴(11-23 대장 결정): 개인 · 국방 · 외교 · 사회 · 경제 큰 탭.
// 지금 있던 기능은 하나도 빼지 않고, 맡은 분야 탭 안의 작은 탭으로 옮겼어요.
import { officeName } from '../game/nation';
import { AgendaPanel, AlbumPanel, BudgetSeasonCard, CodesPanel, GroupsPanel, ProjectsPanel } from './DomesticUI';
import { domOf } from '../game/domestic';
import { canFinish, AGENDA, pledgeSlots } from '../game/agenda';
import { GROUPS, groupSat } from '../game/groups';
import { busyProjects } from '../game/projects';
import { BUILDINGS, type BuildingId } from '../data/economy';
import { spyOf } from '../game/spy';
import { civOf } from '../game/civ';
import { aideSlots, generalSlots } from '../data/officers';
import { RANKS } from '../data/ranks';
import { GovPanel, CityPanel, ResearchPanel } from './CivScreens';
import { FacilityPanel, ResourcePanel, TreasuryPanel, needPick } from './InteriorScreen';
import { TradePanel } from './DiplomacyScreen';
import { ForcesScreen } from './ForcesScreen';
import { SpyPanel } from './SpyPanel';
import { AidesPanel, GeneralsPanel, LeaderCard, RivalsPanel, TrainingScreen } from './officerScreens';
import { OpsScreen, type ScreenProps } from './screens';
import { Tabs, useTab, type TabDef } from './kit';
import { FieldBar } from './PresUI';
import { PolicyPanel } from './PolicyPanel';
import type { DefenseTab, EconomyTab, PersonalTab, SocietyTab } from './nav';
import { MacroPanel, PolityScreen, SpeechPanel, polityBadge } from './PolityUI';
import { GeneralCandidates, MinistryCards, TalentPanel } from './CabinetUI';
import { SchedulePanel } from './ScheduleUI';
import { AssemblyPanel } from './AssemblyUI';
import { PetitionPanel, PressPanel } from './MediaUI';
import { mediaOf } from '../game/media';
import { assemblyOf } from '../game/assembly';
import { liveLaws } from '../game/laws';
import { scheduleOf } from '../game/schedule';
import { cabinetOf, postCount } from '../game/cabinet';
import { POSTS } from '../data/staff';
import { StaffPanel } from './StaffUI';
import { AdviceBar } from './AdviceBar';
import { VictoryPanel, winBadge } from './victoryScreens';

/** 시설 31개를 효과가 닿는 화면으로 나눔(11-24 새 16개: 산업·민간 인프라는 경제, 복지·과학은 사회) */
export { DEFENSE_BUILDINGS } from '../game/economy';
import { DEFENSE_BUILDINGS } from '../game/economy';
export const SOCIETY_BUILDINGS: readonly BuildingId[] = ['징병소', '군병원', '치안청', '공공주택단지', '국립대학교', '문화체육센터', '보훈복지관', '국방과학연구소', '기초과학연구원', '원자력연구원', '인공지능센터', '해양과학기지'];
export const ECONOMY_BUILDINGS: readonly BuildingId[] = ['군수공장', '제련소', '첨단공단', '반도체팹', '석유화학단지', '조선소', '항공우주단지', '발전소', '고속도로망', '국제무역항', '정보통신망'];

const choreDone = (p: ScreenProps) => !!p.state.economy.chore && p.state.worldMs >= p.state.economy.chore.endMs;
/** 끝난 내정 업무가 이 분야 시설 것인지 */
const choreIn = (p: ScreenProps, list: readonly BuildingId[]) => {
  const c = p.state.economy.chore;
  if (!c || !choreDone(p)) return false;
  if (c.building) return list.includes(c.building as BuildingId);
  return BUILDINGS.some((b) => b.fac === c.fac && list.includes(b.id));
};

/** 고른 탭이 목록에 없으면 첫 탭 */
function pickTab<T extends string>(tabs: TabDef<T>[], v: T): T {
  return tabs.some((t) => t.id === v && !t.locked) ? v : tabs[0].id;
}

/* ───────── 👤 개인 ───────── */
/** 작은 탭 목록(화면과 국정 나무가 함께 씀) */
export function personalTabs(props: ScreenProps): TabDef<PersonalTab>[] {
  const { state } = props;
  const o = state.officer;
  const errandsDone = o.aides.filter((a) => a.errand && state.worldMs >= a.errand.endMs).length;
  return [
    { id: 'profile', label: '프로필', icon: '🪪' },
    { id: 'win', label: '승리', icon: '🏆', badge: winBadge(state) },
    { id: 'aides', label: officeName(state.player.countryId), icon: '🏢', badge: errandsDone || null },
    { id: 'talent', label: `인재 ${cabinetOf(state).people.filter((p) => p.group === '인재').length}`, icon: '👥' },
    { id: 'meet', label: '인맥', icon: '📒', badge: meetBadge(state) },
    { id: 'plan', label: '일정', icon: '📅', badge: state.polity?.speech.open ? '🎤' : scheduleOf(state).slots.filter((x) => !x).length || null },
    { id: 'agenda', label: '국정 과제', icon: '🏁', badge: agendaBadge(state) },
    { id: 'album', label: '사진첩', icon: '📸' },
  ];
}

export function PersonalScreen(props: ScreenProps) {
  const { state } = props;
  const [raw, setTab] = useTab<PersonalTab>('personal', 'profile');
  const tabs = personalTabs(props);
  const tab = pickTab(tabs, raw);
  return (
    <>
      <FieldBar state={state} field="personal" />
      <Tabs value={tab} onChange={setTab} tabs={tabs} />
      <Safe key={tab} where={`personal/${tab}`}>
      {tab === 'profile' && (
        <LeaderCard {...props} />
      )}
      {tab === 'win' && <VictoryPanel {...props} />}
      {tab === 'aides' && <StaffTab {...props} />}
      {tab === 'talent' && <TalentPanel {...props} />}
      {tab === 'meet' && <MeetBook {...props} />}
      {tab === 'plan' && (
        <>
          {state.polity?.speech.open && <SpeechPanel {...props} />}
          <SchedulePanel {...props} />
        </>
      )}
      {tab === 'agenda' && <AgendaPanel {...props} />}
      {tab === 'album' && <AlbumPanel {...props} />}
      </Safe>
    </>
  );
}

/** 개인 → 대통령실(11-24): 대통령실 참모·기관장 | 수행 부관(전투 분대원, 지금 부관 그대로) */
function StaffTab(props: ScreenProps) {
  const o = props.state.officer;
  const [v, setV] = useTab<'staff' | 'aide'>('staff-view', 'staff');
  const errandsDone = o.aides.filter((a) => a.errand && props.state.worldMs >= a.errand.endMs).length;
  return (
    <>
      <div className="seg cab-seg">
        <button className={v === 'staff' ? 'on' : ''} onClick={() => setV('staff')}>
          🏢 참모·기관장 {postCount(cabinetOf(props.state))}/{POSTS.length}
        </button>
        <button className={v === 'aide' ? 'on' : ''} onClick={() => setV('aide')}>
          🧑‍✈️ 수행 부관 {o.aides.length}/{aideSlots(props.state.player.rankIndex)}
          {errandsDone ? ' ❗' : ''}
        </button>
      </div>
      {v === 'staff' ? <StaffPanel {...props} /> : <AidesPanel {...props} />}
    </>
  );
}

/* ───────── 🛡️ 국방 ───────── */
/** 작은 탭 목록(화면과 국정 나무가 함께 씀) */
export function defenseTabs(props: ScreenProps): TabDef<DefenseTab>[] {
  const { state } = props;
  const o = state.officer;
  const r = state.player.rankIndex;
  const ready = !!o.active && state.worldMs >= o.active.endMs;
  const civ = civOf(state);
  return [
    { id: 'ops', label: '작전', icon: '🗺️', badge: ready ? '!' : null },
    { id: 'train', label: '훈련', icon: '🎯' },
    { id: 'forces', label: '부대', icon: '🪖' },
    { id: 'command', label: `지휘부 ${o.generals.length}/${generalSlots(r)}`, icon: '⭐' },
    { id: 'spy', label: '정보전', icon: '🕵️', badge: spyOf(state).active.length || null },
    { id: 'tech', label: '군사 연구', icon: '⚙️', badge: !civ.cur.mil && needPick(state) ? '!' : null },
    { id: 'fac', label: '국방 시설', icon: '🛡️', badge: choreIn(props, DEFENSE_BUILDINGS) ? '!' : null },
  ];
}

export function DefenseScreen(props: ScreenProps) {
  const { state } = props;
  const o = state.officer;
  const r = state.player.rankIndex;
  const [raw, setTab] = useTab<DefenseTab>('defense', 'ops');
  const tabs = defenseTabs(props);
  const tab = pickTab(tabs, raw);
  return (
    <>
      <FieldBar state={state} field="defense" />
      <AdviceBar state={state} apply={props.actions.apply} field="defense" go={(t) => setTab(t as DefenseTab)} />
      <Tabs value={tab} onChange={setTab} tabs={tabs} />
      <Safe key={tab} where={`defense/${tab}`}>
      {tab === 'ops' && <OpsScreen {...props} />}
      {tab === 'train' && <TrainingScreen {...props} />}
      {tab === 'forces' && <ForcesScreen {...props} />}
      {tab === 'command' && (
        <>
          <MinistryCards state={state} actions={props.actions} ids={['mnd', 'nis', 'mpva']} title="국방 부처" compact go={props.go} />
          {generalSlots(r) === 0 ? <p className="empty">🔒 장군 자리는 「{RANKS[5].name}」 호칭부터 열려요(최대 6자리: 합참의장 + 병과 5).</p> : <GeneralsPanel {...props} />}
          {generalSlots(r) > o.generals.length && <GeneralCandidates state={state} actions={props.actions} />}
        </>
      )}
      {tab === 'spy' && <SpyPanel {...props} />}
      {tab === 'tech' && <ResearchPanel {...props} fixed="mil" />}
      {tab === 'fac' && <FacilityPanel {...props} only={DEFENSE_BUILDINGS} />}
      </Safe>
    </>
  );
}

/* ───────── 👥 사회 ───────── */
/** 작은 탭 목록(화면과 국정 나무가 함께 씀) */
export function societyTabs(props: ScreenProps): TabDef<SocietyTab>[] {
  const { state } = props;
  const o = state.officer;
  const civ = civOf(state);
  return [
    { id: 'mins', label: '부처·시설', icon: '🏛️', badge: choreIn(props, SOCIETY_BUILDINGS) ? '!' : null },
    { id: 'city', label: '도시', icon: '🏘️' },
    { id: 'gov', label: '체제·정책', icon: '🃏', badge: !civ.gov ? '!' : null },
    { id: 'tech', label: '사회 연구', icon: '📜', badge: !civ.cur.soc && needPick(state) ? '!' : null },
    { id: 'politics', label: '정계', icon: '🗳️', badge: o.chiefRival || o.dismissDeadlineMs !== null || (!assemblyOf(state).vote && !liveLaws(state).length) ? '!' : null },
    { id: 'nation', label: '국정 운영', icon: '📋', badge: polityBadge(state) },
    { id: 'press', label: '언론·청원', icon: '🎙️', badge: mediaOf(state).petitions.length || (state.worldMs >= mediaOf(state).pressMs ? '!' : null) },
    { id: 'opinion', label: '여론', icon: '👥', badge: GROUPS.some((g) => groupSat(state, g.id) <= 25) ? '!' : null },
  ];
}

export function SocietyScreen(props: ScreenProps) {
  const { state } = props;
  const [raw, setTab] = useTab<SocietyTab>('society', 'city');
  const tabs = societyTabs(props);
  const tab = pickTab(tabs, raw);
  return (
    <>
      <FieldBar state={state} field="society" />
      <AdviceBar state={state} apply={props.actions.apply} field="society" go={(t) => setTab(t as SocietyTab)} />
      <Tabs value={tab} onChange={setTab} tabs={tabs} />
      <Safe key={tab} where={`society/${tab}`}>
      {tab === 'mins' && (
        <>
          {/* 11-28 내각 한눈에: 모든 부처 큰 카드는 여기 한곳 */}
          <MinistryCards state={state} actions={props.actions} ids={MINISTRIES.filter((m) => m.tab === 'society').map((m) => m.id)} title="내정 부처" />
          <MinistryCards state={state} actions={props.actions} ids={MINISTRIES.filter((m) => m.tab !== 'society').map((m) => m.id)} title="국방·외교·경제 부처" />
          <FacilityPanel {...props} only={SOCIETY_BUILDINGS} />
        </>
      )}
      {tab === 'city' && <CityPanel {...props} />}
      {tab === 'gov' && <GovPanel {...props} />}
      {tab === 'tech' && <ResearchPanel {...props} fixed="soc" />}
      {tab === 'politics' && (
        <>
          <AssemblyPanel {...props} />
          <CodesPanel {...props} />
          <RivalsPanel {...props} />
        </>
      )}
      {tab === 'press' && (
        <>
          <PressPanel {...props} />
          <PetitionPanel {...props} />
        </>
      )}
      {tab === 'opinion' && <GroupsPanel {...props} />}
      {tab === 'nation' && <PolityScreen {...props} />}
      </Safe>
    </>
  );
}

/* ───────── 💰 경제 ───────── */
/** 작은 탭 목록(화면과 국정 나무가 함께 씀) */
export function economyTabs(props: ScreenProps): TabDef<EconomyTab>[] {
  return [
    { id: 'vault', label: '금고', icon: '💰' },
    { id: 'macro', label: '경기', icon: '📈', badge: props.state.polity?.econ.crisis || (props.state.polity && (overheat(props.state).hoursLeft ?? 99) < 6) ? '!' : null },
    { id: 'tax', label: '예산·세금', icon: '📊' },
    { id: 'res', label: '자원', icon: '⛏️' },
    { id: 'ind', label: '산업 시설', icon: '🏭', badge: choreIn(props, ECONOMY_BUILDINGS) ? '!' : null },
    { id: 'trade', label: '무역', icon: '🚢' },
    { id: 'facall', label: '공사 관리', icon: '🏗️', badge: choreDone(props) ? '!' : null },
    { id: 'proj', label: '국가 사업', icon: '🚄', badge: busyProjects(props.state).some(([, p]) => p.endMs <= props.state.worldMs) ? '!' : null },
  ];
}

export function EconomyScreen(props: ScreenProps) {
  const [raw, setTab] = useTab<EconomyTab>('economy', 'vault');
  const tabs = economyTabs(props);
  const tab = pickTab(tabs, raw);
  return (
    <>
      <FieldBar state={props.state} field="economy" />
      <AdviceBar state={props.state} apply={props.actions.apply} field="economy" go={(t) => setTab(t as EconomyTab)} />
      <Tabs value={tab} onChange={setTab} tabs={tabs} />
      <Safe key={tab} where={`economy/${tab}`}>
      {tab === 'vault' && <TreasuryPanel {...props} />}
      {tab === 'tax' && (
        <>
          <BudgetSeasonCard {...props} />
          <MinistryCards state={props.state} actions={props.actions} ids={['mof', 'moel', 'mss']} title="기획재정·고용·중소기업" compact go={props.go} />
          <PolicyPanel {...props} />
        </>
      )}
      {tab === 'macro' && <MacroPanel {...props} />}
      {tab === 'res' && <ResourcePanel {...props} />}
      {tab === 'ind' && (
        <>
          <MinistryCards state={props.state} actions={props.actions} ids={['moti', 'molit', 'mofs', 'mafra', 'mcee']} title="산업·국토·해양·농업·에너지 부처" compact go={props.go} />
          <FacilityPanel {...props} only={ECONOMY_BUILDINGS} />
        </>
      )}
      {tab === 'trade' && <TradePanel {...props} />}
      {tab === 'facall' && <FacilityPanel {...props} />}
      {tab === 'proj' && <ProjectsPanel {...props} />}
      </Safe>
    </>
  );
}

/** 국정 과제 배지: 완수할 수 있는 과제 수, 공약을 더 고를 수 있으면 ! */
function agendaBadge(state: ScreenProps['state']): string | number | null {
  const a = domOf(state).agenda;
  if (a.pledges.length < pledgeSlots(state)) return '!';
  const n = AGENDA.filter((b) => a.pledges.includes(b.id)).flatMap((b) => b.tasks.flat()).filter((t) => !canFinish(state, t.id)).length;
  return n || null;
}
