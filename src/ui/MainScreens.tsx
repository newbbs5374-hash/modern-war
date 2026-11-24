// 대통령식 메뉴(11-23 대장 결정): 개인 · 국방 · 외교 · 사회 · 경제 큰 탭.
// 지금 있던 기능은 하나도 빼지 않고, 맡은 분야 탭 안의 작은 탭으로 옮겼어요.
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

/** 시설 15개를 효과가 닿는 분야로 나눔 */
export const DEFENSE_BUILDINGS: readonly BuildingId[] = ['철도망', '군항', '공군기지', '방공포대', '훈련소', '비축창고', '정보본부', '우주기지'];
export const SOCIETY_BUILDINGS: readonly BuildingId[] = ['징병소', '군병원', '치안청', '국방과학연구소'];
export const ECONOMY_BUILDINGS: readonly BuildingId[] = ['군수공장', '제련소', '첨단공단'];

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
export function PersonalScreen(props: ScreenProps) {
  const { state } = props;
  const o = state.officer;
  const [raw, setTab] = useTab<PersonalTab>('personal', 'profile');
  const errandsDone = o.aides.filter((a) => a.errand && state.worldMs >= a.errand.endMs).length;
  const tabs: TabDef<PersonalTab>[] = [
    { id: 'profile', label: '프로필', icon: '🪪' },
    { id: 'train', label: '훈련', icon: '🎯' },
    { id: 'aides', label: '대통령실', icon: '🏢', badge: errandsDone || null },
    { id: 'talent', label: `인재 ${cabinetOf(state).people.filter((p) => p.group === '인재').length}`, icon: '👥' },
    { id: 'plan', label: '일정', icon: '📅', badge: scheduleOf(state).slots.filter((x) => !x).length || null },
    { id: 'agenda', label: '국정 과제', icon: '🏁', badge: agendaBadge(state) },
    { id: 'album', label: '사진첩', icon: '📸' },
  ];
  const tab = pickTab(tabs, raw);
  return (
    <>
      <FieldBar state={state} field="personal" />
      <Tabs value={tab} onChange={setTab} tabs={tabs} />
      {tab === 'profile' && (
        <LeaderCard {...props} />
      )}
      {tab === 'train' && <TrainingScreen {...props} />}
      {tab === 'aides' && <StaffTab {...props} />}
      {tab === 'talent' && <TalentPanel {...props} />}
      {tab === 'plan' && <SchedulePanel {...props} />}
      {tab === 'agenda' && <AgendaPanel {...props} />}
      {tab === 'album' && <AlbumPanel {...props} />}
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
export function DefenseScreen(props: ScreenProps) {
  const { state } = props;
  const o = state.officer;
  const r = state.player.rankIndex;
  const [raw, setTab] = useTab<DefenseTab>('defense', 'ops');
  const ready = !!o.active && state.worldMs >= o.active.endMs;
  const civ = civOf(state);
  const tabs: TabDef<DefenseTab>[] = [
    { id: 'ops', label: '작전', icon: '🗺️', badge: ready ? '!' : null },
    { id: 'forces', label: '부대', icon: '🪖' },
    { id: 'command', label: `지휘부 ${o.generals.length}/${generalSlots(r)}`, icon: '⭐' },
    { id: 'spy', label: '정보전', icon: '🕵️', badge: spyOf(state).active.length || null },
    { id: 'tech', label: '군사 연구', icon: '⚙️', badge: !civ.cur.mil && needPick(state) ? '!' : null },
    { id: 'fac', label: '국방 시설', icon: '🛡️', badge: choreIn(props, DEFENSE_BUILDINGS) ? '!' : null },
  ];
  const tab = pickTab(tabs, raw);
  return (
    <>
      <FieldBar state={state} field="defense" />
      <Tabs value={tab} onChange={setTab} tabs={tabs} />
      {tab === 'ops' && <OpsScreen {...props} />}
      {tab === 'forces' && <ForcesScreen {...props} />}
      {tab === 'command' && (
        <>
          <MinistryCards state={state} actions={props.actions} ids={['mnd', 'nis']} title="국방 부처" />
          {generalSlots(r) === 0 ? <p className="empty">🔒 장군 자리는 「{RANKS[5].name}」 호칭부터 열려요(최대 6자리: 합참의장 + 병과 5).</p> : <GeneralsPanel {...props} />}
          {generalSlots(r) > o.generals.length && <GeneralCandidates state={state} actions={props.actions} />}
        </>
      )}
      {tab === 'spy' && <SpyPanel {...props} />}
      {tab === 'tech' && <ResearchPanel {...props} fixed="mil" />}
      {tab === 'fac' && <FacilityPanel {...props} only={DEFENSE_BUILDINGS} />}
    </>
  );
}

/* ───────── 👥 사회 ───────── */
export function SocietyScreen(props: ScreenProps) {
  const { state } = props;
  const o = state.officer;
  const civ = civOf(state);
  const [raw, setTab] = useTab<SocietyTab>('society', 'city');
  const tabs: TabDef<SocietyTab>[] = [
    { id: 'mins', label: '부처·시설', icon: '🏛️', badge: choreIn(props, SOCIETY_BUILDINGS) ? '!' : null },
    { id: 'city', label: '도시', icon: '🏘️' },
    { id: 'gov', label: '체제·정책', icon: '🃏', badge: !civ.gov ? '!' : null },
    { id: 'tech', label: '사회 연구', icon: '📜', badge: !civ.cur.soc && needPick(state) ? '!' : null },
    { id: 'politics', label: '정계', icon: '🗳️', badge: o.chiefRival || o.dismissDeadlineMs !== null || (!assemblyOf(state).vote && !liveLaws(state).length) ? '!' : null },
    { id: 'press', label: '언론·청원', icon: '🎙️', badge: mediaOf(state).petitions.length || (state.worldMs >= mediaOf(state).pressMs ? '!' : null) },
    { id: 'opinion', label: '여론', icon: '👥', badge: GROUPS.some((g) => groupSat(state, g.id) <= 25) ? '!' : null },
  ];
  const tab = pickTab(tabs, raw);
  return (
    <>
      <FieldBar state={state} field="society" />
      <Tabs value={tab} onChange={setTab} tabs={tabs} />
      {tab === 'mins' && (
        <>
          <MinistryCards state={state} actions={props.actions} ids={['mois', 'mohw', 'msit', 'kocis', 'moj', 'moe']} title="사회 부처" />
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
    </>
  );
}

/* ───────── 💰 경제 ───────── */
export function EconomyScreen(props: ScreenProps) {
  const [raw, setTab] = useTab<EconomyTab>('economy', 'vault');
  const tabs: TabDef<EconomyTab>[] = [
    { id: 'vault', label: '금고', icon: '💰' },
    { id: 'tax', label: '예산·세금', icon: '📊' },
    { id: 'res', label: '자원', icon: '⛏️' },
    { id: 'ind', label: '산업 시설', icon: '🏭', badge: choreIn(props, ECONOMY_BUILDINGS) ? '!' : null },
    { id: 'trade', label: '무역', icon: '🚢' },
    { id: 'facall', label: '시설 현황', icon: '🏗️', badge: choreDone(props) ? '!' : null },
    { id: 'proj', label: '국가 사업', icon: '🚄', badge: busyProjects(props.state).some(([, p]) => p.endMs <= props.state.worldMs) ? '!' : null },
  ];
  const tab = pickTab(tabs, raw);
  return (
    <>
      <FieldBar state={props.state} field="economy" />
      <Tabs value={tab} onChange={setTab} tabs={tabs} />
      {tab === 'vault' && <TreasuryPanel {...props} />}
      {tab === 'tax' && (
        <>
          <BudgetSeasonCard {...props} />
          <MinistryCards state={props.state} actions={props.actions} ids={['mof', 'moel']} title="기획재정부·고용노동부" />
          <PolicyPanel {...props} />
        </>
      )}
      {tab === 'res' && <ResourcePanel {...props} />}
      {tab === 'ind' && (
        <>
          <MinistryCards state={props.state} actions={props.actions} ids={['moti', 'molit', 'mofs']} title="산업·국토·해양 부처" />
          <FacilityPanel {...props} only={ECONOMY_BUILDINGS} />
        </>
      )}
      {tab === 'trade' && <TradePanel {...props} />}
      {tab === 'facall' && <FacilityPanel {...props} />}
      {tab === 'proj' && <ProjectsPanel {...props} />}
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
