// 인물·부처 화면(11-23): 인재 명단·내 사람·인물 도감 / 부처 카드·부처 정보창 / 인물 창 / 사람을 장군으로.
// 웬만하면 한 화면: 목록은 한 줄 카드, 자세한 건 팝업.
import { useState } from 'react';
import { GENERAL_NEEDS, NEEDS } from '../data/needs';
import { ORIGIN_SHAPE2 } from '../data/stats2';
import { FitTag, NeedBox, PeopleGrid, Stats18, originLine } from './PersonCards';
import {
  FACTIONS,
  GRADES,
  GROUP_ICON,
  HIDDEN,
  MINISTRIES,
  PERSON_ORIGINS,
  TRAITS,
  ministerSlots,
  ministryById,
  type Group,
  type MinistryId,
} from '../data/cabinet';
import { COUNTRIES } from '../data/world';
import {
  ENCOURAGE_COST,
  HEARING,
  unpost,
  REFRESH_RUBY,
  VET_INTEL,
  appointMinister,
  appointVice,
  cabinetOf,
  canAppointMinister,
  canAppointVice,
  canRecruit,
  dismiss,
  encourage,
  factionCounts,
  factionTilt,
  lookOf,
  ministerCount,
  ministerOf,
  ministryPower,
  peopleCount,
  personById,
  personPower,
  recruit,
  recruitCost,
  refreshPool,
  unseat,
  vet,
  viceOf,
  type Person,
  fitPct,
} from '../game/cabinet';
import { appointPersonGeneral, bestFor, canPersonGeneral, canTask, hearingChance, personGeneralSkill, startTask, statTotal, taskHours } from '../game/cabinetOps';
import { FIELD_ICON, GENERAL_TITLE, freeFields, type GeneralField } from '../game/loyal';
import { postById } from '../data/staff';
import { AgencySection, PostPick } from './StaffUI';
import { generalSlots } from '../data/officers';
import type { GameState } from '../game/state';
import { Card, fmt } from './common';
import { Help, Meter, Modal } from './kit';
import { countryFaceUrl } from './Portrait';
import { BoostBar } from './BoostBar';
import { Flag } from './flag';
import { iconArt } from './iconArt';
import { timeLeft } from './officerScreens';
import type { ScreenProps } from './screens';
import { RecommendButton } from './RecommendUI';

const flag = (id: string) => <Flag id={id} size={0.55} />;
const cname = (id: string) => COUNTRIES.find((c) => c.id === id)?.name ?? id;
const pct = (v: number) => `${Math.round(v * 100)}%`;

/* ───────── 작은 부품 ───────── */

/** 부처 건물 그림(src/assets/icons/icon-min-<id>.webp, 11/23 9장 들어감), 없으면 이모지 */
export function MinIcon({ id, size = 30 }: { id: MinistryId; size?: number }) {
  const url = iconArt(`icon-min-${id}`);
  return url ? <img className="cab-min-art" src={url} alt="" draggable={false} style={{ width: size, height: size }} /> : <>{ministryById(id).icon}</>;
}

export function PersonFace({ p, size = 44 }: { p: Person; size?: number }) {
  const url = countryFaceUrl(p, lookOf(p));
  return (
    <span className="cab-face" style={{ width: size, height: size, fontSize: size * 0.55 }}>
      {url ? <img className="face-img" src={url} alt="" draggable={false} /> : PERSON_ORIGINS[p.origin].icon}
    </span>
  );
}

export function PersonRow({ state, p, onOpen, right }: { state: GameState; p: Person; onOpen: () => void; right?: React.ReactNode }) {
  const seat = p.seat ? `${ministryById(p.seat.id).short} ${p.seat.kind === 'min' ? '장관' : '차관'}` : p.post ? postById(p.post).name : null;
  const hearing = cabinetOf(state).hearing?.pid === p.id;
  return (
    <div className="cab-row" onClick={onOpen} role="button">
      <PersonFace p={p} />
      <span className="cab-main">
        <b>
          {GRADES[p.grade].icon} {p.name} <small className="muted">{p.age}세{p.country !== state.player.countryId ? <> {flag(p.country)}</> : null}</small>
        </b>
        <small>
          {PERSON_ORIGINS[p.origin].icon}
          {PERSON_ORIGINS[p.origin].name} · {p.spec} · {TRAITS[p.trait].icon}
          {p.trait}
          {p.known && p.hidden ? ` · ${HIDDEN[p.hidden].icon}` : ''}
          {p.buddy ? ' · 👥옛 동료' : ''}
        </small>
      </span>
      <span className="cab-side">
        {right ?? (
          <>
            <b>{statTotal(p)}</b>
            <small>{hearing ? '🏛️청문회' : (seat ?? (p.title || ''))}</small>
          </>
        )}
      </span>
    </div>
  );
}

/* ───────── 인물 창 ───────── */

export function PersonModal({ state, actions, pid, onClose }: Pick<ScreenProps, 'state' | 'actions'> & { pid: number; onClose: () => void }) {
  const p = personById(state, pid);
  const [pick, setPick] = useState<'min' | 'vice' | 'gen' | 'post' | null>(null);
  if (!p) return null;
  const c = cabinetOf(state);
  const apply = actions.apply;
  const o = PERSON_ORIGINS[p.origin];
  const mine = p.group === '내각';
  const pals = p.pals.map((id) => c.people.find((x) => x.id === id)).filter(Boolean) as Person[];
  const foes = p.foes.map((id) => c.people.find((x) => x.id === id)).filter(Boolean) as Person[];
  const recWhy = canRecruit(state, p.id);
  return (
    <Modal title={p.name} icon={<PersonFace p={p} size={30} />} onClose={onClose}>
      <p className="small">
        {flag(p.country)} {cname(p.country)} · {p.age}세 · {p.sex === 'm' ? '남' : '여'} · {o.icon}
        {o.name} 출신 · {GRADES[p.grade].icon}
        {p.grade}
        {p.title ? ` · ${p.title}` : ''}
      </p>
      <Stats18 p={p} />
      <p className="small muted" style={{ margin: '2px 0 4px' }}>
        {o.icon} {o.name} 출신: {originLine(p.origin, ORIGIN_SHAPE2[p.origin])}
      </p>
      <div className="cab-kv small">
        <span>🎯 특화</span>
        <b>{p.spec}</b>
        <span>
          {TRAITS[p.trait].icon} {p.trait}
        </span>
        <b className="muted">{TRAITS[p.trait].text}</b>
        <span>🔒 숨은 특성</span>
        <b>{p.known ? (p.hidden ? `${HIDDEN[p.hidden].icon} ${p.hidden}: ${HIDDEN[p.hidden].text}` : '없음') : '❓ 모름(신원 조회)'}</b>
        <span>{FACTIONS.find((f) => f.id === p.faction)!.icon} 파벌</span>
        <b>{p.faction}</b>
        {(pals.length > 0 || foes.length > 0) && (
          <>
            <span>💞 궁합</span>
            <b>
              {pals.map((x) => `🤝${x.name}`).join(' ')} {foes.map((x) => `💢${x.name}`).join(' ')}
            </b>
          </>
        )}
      </div>
      <div className="cab-loy">
        <small>충성 {Math.round(p.loyalty)}</small>
        <Meter value={p.loyalty} max={100} tone={p.loyalty >= 70 ? 'green' : p.loyalty < 35 ? 'red' : 'gold'} />
      </div>
      {(p.group === '인재' || p.group === '관료' || p.group === '공공') && (
        <button className="gold wide" disabled={!!recWhy} onClick={() => apply((s) => recruit(s, p.id))}>
          🤝 영입하기 <small>💵{fmt(recruitCost(state, p))}</small>
        </button>
      )}
      {(p.group === '인재' || p.group === '관료' || p.group === '공공') && recWhy && <p className="small muted">{recWhy}</p>}
      {mine && (
        <div className="cab-acts">
          {!p.seat && !p.post && (
            <>
              <button onClick={() => setPick(pick === 'post' ? null : 'post')}>🏢 대통령실·기관장</button>
              <button onClick={() => setPick(pick === 'min' ? null : 'min')}>🏛️ 장관으로</button>
              <button onClick={() => setPick(pick === 'vice' ? null : 'vice')}>📌 차관으로</button>
              <button onClick={() => setPick(pick === 'gen' ? null : 'gen')}>⭐ 장군으로</button>
            </>
          )}
          {p.seat && <button onClick={() => apply((s) => unseat(s, p.id))}>↩️ 자리에서 내리기</button>}
          {p.post && <button onClick={() => apply((s) => unpost(s, p.id))}>↩️ {postById(p.post).name}에서 내리기</button>}
          <button disabled={state.player.salary < ENCOURAGE_COST} onClick={() => apply((s) => encourage(s, p.id))}>
            💬 격려 <small>봉급 {ENCOURAGE_COST}</small>
          </button>
          {!p.known && (
            <button disabled={state.officer.intel < VET_INTEL} onClick={() => apply((s) => vet(s, p.id))}>
              🗂️ 신원 조회 <small>정보 {VET_INTEL}</small>
            </button>
          )}
          {!p.seat && !p.post && !p.buddy && (
            <button className="danger" onClick={() => (apply((s) => dismiss(s, p.id)), onClose())}>
              👋 내보내기
            </button>
          )}
        </div>
      )}
      {mine && !p.known && p.group === '인재' && null}
      {p.group === '인재' && !p.known && (
        <button className="wide" disabled={state.officer.intel < VET_INTEL} onClick={() => apply((s) => vet(s, p.id))}>
          🗂️ 영입 전에 신원 조회 <small>정보 {VET_INTEL}</small>
        </button>
      )}
      {pick === 'min' || pick === 'vice' ? (
        <div className="cab-pick">
          {MINISTRIES.map((m) => {
            const why = pick === 'min' ? canAppointMinister(state, p.id, m.id) : canAppointVice(state, p.id, m.id);
            const fit = fitPct(p, NEEDS[m.id], m.spec) >= 65;
            return (
              <button
                key={m.id}
                disabled={!!why}
                title={why ?? ''}
                onClick={() => (apply((s) => (pick === 'min' ? appointMinister(s, p.id, m.id) : appointVice(s, p.id, m.id))), setPick(null))}
              >
                <span>{m.icon}</span>
                <small>{m.short}</small>
                <small className={fit ? 'gold-t' : 'muted'}>{pct(personPower(p, m.id))}</small>
                <FitTag p={p} need={NEEDS[m.id]} spec={m.spec} />
              </button>
            );
          })}
          {(() => {
            const whys = MINISTRIES.map((m) => (pick === 'min' ? canAppointMinister(state, p.id, m.id) : canAppointVice(state, p.id, m.id)));
            const allNo = whys.every(Boolean);
            const why = whys.find((w) => w && !w.startsWith('이미')) ?? whys[0];
            return allNo && why ? (
              <p className="small warn" style={{ gridColumn: '1 / -1' }}>
                ⚠️ 지금은 못 앉혀요: {why}
              </p>
            ) : null;
          })()}
          <p className="small muted" style={{ gridColumn: '1 / -1' }}>
            {pick === 'min'
              ? HEARING.skip
                ? `시험판이라 청문회 없이 바로 장관이 돼요. 장관 ${ministerCount(c)}/${ministerSlots(state.player.rankIndex)}석`
                : `장관은 인사청문회(실제 30분)를 거쳐요. 통과 확률 ${pct(hearingChance(state, p))} · 장관 ${ministerCount(c)}/${ministerSlots(state.player.rankIndex)}석`
              : '차관은 청문회 없이 바로 앉고, 부처 힘에 40%를 보태요.'}{' '}
            위 숫자는 그 부처에서 낼 힘(100% = 보통 장관), 아래 %는 적합도(주 스탯·성향·출신·특화). 노란색은 잘 맞는 곳.
          </p>
        </div>
      ) : null}
      {pick === 'gen' && <GeneralPick state={state} actions={actions} p={p} onDone={onClose} />}
      {pick === 'post' && <PostPick state={state} actions={actions} p={p} onDone={() => setPick(null)} />}
    </Modal>
  );
}

function GeneralPick({ state, actions, p, onDone }: Pick<ScreenProps, 'state' | 'actions'> & { p: Person; onDone: () => void }) {
  const free = freeFields(state);
  const slots = generalSlots(state.player.rankIndex);
  return (
    <div className="cab-pick">
      {(['합참', '육군', '해군', '공군', '정보', '군수'] as GeneralField[]).map((f) => {
        const why = canPersonGeneral(state, p.id, f);
        return (
          <button key={f} disabled={!!why} title={why ?? ''} onClick={() => (actions.apply((s) => appointPersonGeneral(s, p.id, f)), onDone())}>
            <span>{FIELD_ICON[f]}</span>
            <small>{GENERAL_TITLE[f]}</small>
            <FitTag p={p} need={GENERAL_NEEDS[f]} spec={[]} />
          </button>
        );
      })}
      <p className="small muted" style={{ gridColumn: '1 / -1' }}>
        장군 능력 {personGeneralSkill(p)}/10(병과마다 보는 스탯이 달라요: 합참 지휘·전술, 육군 지휘·통솔, 해군 지휘·포격, 공군 지휘·과학, 정보 정보·은밀, 군수 군수·행정). %는 병과 적합도 · 장군 {state.officer.generals.length}/{slots}자리 · 빈 병과 {free.length}곳. 장군이 되면 내각 명단에서 빠져요.
      </p>
    </div>
  );
}

/* ───────── 👤 개인 → 인재 탭 ───────── */

type TalentView = 'pool' | 'mine' | 'book';
const BOOK_GROUPS: Group[] = ['관료', '공공', '정계', '재계', '언론', '시민', '군', '외국'];

export function TalentPanel(props: ScreenProps) {
  const { state, actions } = props;
  const c = cabinetOf(state);
  const [view, setView] = useState<TalentView>('pool');
  const [open, setOpen] = useState<number | null>(null);
  const [group, setGroup] = useState<Group>('정계');
  const pool = c.people.filter((p) => p.group === '인재').sort((a, b) => statTotal(b) - statTotal(a));
  const mine = c.people.filter((p) => p.group === '내각').sort((a, b) => Number(!!b.seat) - Number(!!a.seat) || statTotal(b) - statTotal(a));
  const ruby = state.goals?.ruby ?? 0;
  const hearing = c.hearing ? c.people.find((x) => x.id === c.hearing!.pid) : null;
  return (
    <>
      <Card
        title={`인물 ${peopleCount(state)}명`}
        icon="👥"
        right={
          <Help title="인재·인물">
            <p>나라 안팎에 약 100명이 나와요. 모두 스탯 18개(현장 전투·군사 지휘·국정 운영·정보·기술·인품 5갈래)와 특화·성향·숨은 특성·파벌을 가져요.</p>
            <p>📋 인재 명단: 실제 1시간마다 새 후보 2명(최대 20명). 국방예산으로 영입해요. 🔵우수·🟡전설은 드물어요.</p>
            <p>🏛️ 내 사람: 영입한 사람을 대통령실 참모·기관장·장관·차관·장군으로 앉혀요(시험판은 청문회 없음). 특화가 맞는 부처에서 힘이 30% 더 나요.</p>
            <p>💞 궁합: 친한 사람끼리 같이 앉으면 힘 +10%, 앙숙끼리 앉으면 가끔 다퉈요. 파벌이 3자리 넘게 모이면 덤, 한 파벌이 60% 넘으면 지지도·신뢰도가 떨어져요.</p>
            <p>충성이 35 밑이면 다른 나라가 빼 갈 수 있어요. 격려로 올려 주세요.</p>
          </Help>
        }
      >
        <div className="seg cab-seg">
          <button className={view === 'pool' ? 'on' : ''} onClick={() => setView('pool')}>
            📋 인재 {pool.length}
          </button>
          <button className={view === 'mine' ? 'on' : ''} onClick={() => setView('mine')}>
            🏛️ 내 사람 {mine.length}
          </button>
          <button className={view === 'book' ? 'on' : ''} onClick={() => setView('book')}>
            📖 도감
          </button>
        </div>
        <RecommendButton state={state} actions={actions} />
        {hearing && (
          <p className="small cab-hearing">
            🏛️ {hearing.name} {ministryById(c.hearing!.min).name} 장관 청문회 · {timeLeft(c.hearing!.endMs - state.worldMs)} 남음 · 통과 {pct(hearingChance(state, hearing))}
          </p>
        )}
        {hearing && <BoostBar state={state} apply={actions.apply} target={{ kind: 'hearing' }} compact />}
        <FactionLine state={state} />
      </Card>
      {view === 'pool' && (
        <div className="cab-list">
          <PeopleGrid
            state={state}
            list={pool}
            onOpen={setOpen}
            empty="새 후보가 곧 와요(1시간마다 2명)."
            badge={(p) => (
              <>
                <b>Σ{statTotal(p)}</b>
                <small>💵{fmt(recruitCost(state, p))}</small>
              </>
            )}
          />
          <button className="wide" disabled={ruby < REFRESH_RUBY} onClick={() => actions.apply(refreshPool)}>
            🔄 명단 새로 받기 <small>💎{REFRESH_RUBY}</small>
          </button>
        </div>
      )}
      {view === 'mine' && (
        <div className="cab-list">
          <PeopleGrid state={state} list={mine} onOpen={setOpen} empty="아직 영입한 사람이 없어요. 인재 명단에서 골라 보세요." />
        </div>
      )}
      {view === 'book' && (
        <>
          <div className="seg cab-seg">
            {BOOK_GROUPS.map((g) => (
              <button key={g} className={group === g ? 'on' : ''} onClick={() => setGroup(g)}>
                {GROUP_ICON[g]}
                {g}
              </button>
            ))}
          </div>
          <div className="cab-list">
            <PeopleGrid key={group} state={state} list={c.people.filter((p) => p.group === group)} onOpen={setOpen} />
          </div>
        </>
      )}
      {open !== null && <PersonModal state={state} actions={actions} pid={open} onClose={() => setOpen(null)} />}
    </>
  );
}

function FactionLine({ state }: { state: GameState }) {
  const fc = factionCounts(cabinetOf(state));
  const tilt = factionTilt(state);
  return (
    <p className="small cab-fac">
      {FACTIONS.map((f) => (
        <span key={f.id} className={fc[f.id] >= 3 ? 'on' : ''} title={f.bonus}>
          {f.icon}
          {f.id} {fc[f.id]}
        </span>
      ))}
      {tilt && <span className="bad">⚠️ {tilt} 쏠림</span>}
    </p>
  );
}

/* ───────── 부처 카드 · 정보창 ───────── */

export function MinistryCards({ state, actions, ids, title = '부처' }: Pick<ScreenProps, 'state' | 'actions'> & { ids: MinistryId[]; title?: string }) {
  const [open, setOpen] = useState<MinistryId | null>(null);
  const c = cabinetOf(state);
  return (
    <>
      <Card title={title} icon="🏛️" right={<small className="muted">장관 {ministerCount(c)}/{ministerSlots(state.player.rankIndex)}석</small>}>
        <RecommendButton state={state} actions={actions} />
        <div className="cab-mins">
          {ids.map((id) => {
            const m = ministryById(id);
            const mn = ministerOf(c, id);
            const t = c.tasks[id];
            const done = t && state.worldMs >= t.endMs;
            const hearing = c.hearing?.min === id;
            return (
              <button key={id} className="cab-min" onClick={() => setOpen(id)}>
                <span className="cab-min-ico">
                  <MinIcon id={id} size={54} />
                  {mn && <span className="cab-min-face"><PersonFace p={mn} size={18} /></span>}
                </span>
                <span className="cab-main">
                  <b>
                    {m.icon} {m.name}
                  </b>
                  <small>{mn ? `${mn.name} 장관` : hearing ? '🏛️ 청문회 중' : '장관 없음'}</small>
                  <small className="muted">{t ? (done ? '✅ 업무 끝' : `📋 ${timeLeft(t.endMs - state.worldMs)}`) : m.role}</small>
                </span>
                <b className="cab-pow">{pct(ministryPower(state, id))}</b>
              </button>
            );
          })}
        </div>
      </Card>
      {open && <MinistryModal state={state} actions={actions} id={open} onClose={() => setOpen(null)} />}
    </>
  );
}

export function MinistryModal({ state, actions, id, onClose }: Pick<ScreenProps, 'state' | 'actions'> & { id: MinistryId; onClose: () => void }) {
  const m = ministryById(id);
  const c = cabinetOf(state);
  const mn = ministerOf(c, id);
  const vc = viceOf(c, id);
  const [who, setWho] = useState<number | null>(null);
  const cands = bestFor(state, id, 3);
  const t = c.tasks[id];
  const tWhy = canTask(state, id);
  const apply = actions.apply;
  const seat = (p: Person | null, kind: 'min' | 'vice') =>
    p ? (
      <PersonRow state={state} p={p} onOpen={() => setWho(p.id)} right={<b>{pct(personPower(p, id, c) * (kind === 'vice' ? 0.4 : 1))}</b>} />
    ) : (
      <p className="small muted cab-empty">{kind === 'min' ? (c.hearing?.min === id ? '🏛️ 청문회 중…' : '장관 자리가 비었어요') : '차관 자리가 비었어요'}</p>
    );
  return (
    <Modal title={m.name} icon={m.icon} onClose={onClose}>
      {m.kind === '처' && <p className="small muted" style={{ margin: 0 }}>🏛️ 국무총리 소속 처(장관급 처장)</p>}
      {iconArt(`icon-min-${id}`) && <img className="cab-min-banner" src={iconArt(`icon-min-${id}`)!} alt="" draggable={false} />}
      <p className="small">{m.text}</p>
      <div className="cab-kv small">
        <span>🎯 맡은 일</span>
        <b>{m.effText}</b>
        <span>💪 부처 힘</span>
        <b>{pct(ministryPower(state, id))} (장관 + 차관 40%)</b>
      </div>
      <NeedBox need={NEEDS[id]} spec={m.spec} title="장관 고를 때 중요한 것" />
      <h4 className="cab-h">장관</h4>
      {seat(mn, 'min')}
      <h4 className="cab-h">차관</h4>
      {seat(vc, 'vice')}
      {(!mn || !vc) && cands.length > 0 && (
        <>
          <h4 className="cab-h">추천 후보(내 사람 중)</h4>
          {cands.map((p) => (
            <div key={p.id} className="cab-cand">
              <PersonRow state={state} p={p} onOpen={() => setWho(p.id)} right={<><b>{pct(personPower(p, id, c))}</b><FitTag p={p} need={NEEDS[id]} spec={m.spec} /></>} />
              <span className="cab-cand-acts">
                {!mn && (
                  <button disabled={!!canAppointMinister(state, p.id, id)} title={canAppointMinister(state, p.id, id) ?? ''} onClick={() => apply((s) => appointMinister(s, p.id, id))}>
                    장관
                  </button>
                )}
                {!vc && (
                  <button disabled={!!canAppointVice(state, p.id, id)} onClick={() => apply((s) => appointVice(s, p.id, id))}>
                    차관
                  </button>
                )}
              </span>
            </div>
          ))}
        </>
      )}
      {!mn && cands.length > 0 && cands.every((p) => canAppointMinister(state, p.id, id)) && <p className="small warn">⚠️ {canAppointMinister(state, cands[0].id, id)}</p>}
      {!cands.length && !mn && <p className="small muted">👤 개인 → 인재 탭에서 사람을 먼저 영입하세요(영입한 사람만 장관·차관이 될 수 있어요).</p>}
      <h4 className="cab-h">부처 업무</h4>
      {t ? (
        <>
          <p className="small">
            📋 {m.tasks.find((x) => x.id === t.task)?.name} · {state.worldMs >= t.endMs ? '곧 끝나요' : `${timeLeft(t.endMs - state.worldMs)} 남음`}
          </p>
          <BoostBar state={state} apply={apply} target={{ kind: 'task', min: id }} />
        </>
      ) : (
        <div className="cab-tasks">
          {m.tasks.map((x) => (
            <button key={x.id} className="pw-act" disabled={!!tWhy} onClick={() => apply((s) => startTask(s, id, x.id))}>
              <span className="pw-act-ico">{x.icon}</span>
              <span className="li-main">
                <b>
                  {x.name} <small>{Math.round(taskHours(state, id, x.id) * 10) / 10}시간</small>
                </b>
                <small>{x.text}</small>
              </span>
            </button>
          ))}
          {tWhy && <p className="small muted">{tWhy}</p>}
        </div>
      )}
      <AgencySection state={state} actions={actions} id={id} />
      {who !== null && <PersonModal state={state} actions={actions} pid={who} onClose={() => setWho(null)} />}
    </Modal>
  );
}

/** 국방 → 지휘부: 내 사람 가운데 장군감(장군 자리가 있을 때) */
export function GeneralCandidates({ state, actions }: Pick<ScreenProps, 'state' | 'actions'>) {
  const [open, setOpen] = useState<number | null>(null);
  const c = cabinetOf(state);
  const list = c.people
    .filter((p) => p.group === '내각' && !p.seat && !p.post)
    .sort((a, b) => personGeneralSkill(b) - personGeneralSkill(a))
    .slice(0, 4);
  if (!list.length) return null;
  return (
    <Card title="장군감(내 사람)" icon="⭐">
      <div className="cab-list">
        {list.map((p) => (
          <PersonRow key={p.id} state={state} p={p} onOpen={() => setOpen(p.id)} right={<b>능력 {personGeneralSkill(p)}</b>} />
        ))}
      </div>
      <p className="small muted">사람을 눌러 ⭐ 장군으로 → 병과를 고르면 바로 임명돼요(병과마다 한 명).</p>
      {open !== null && <PersonModal state={state} actions={actions} pid={open} onClose={() => setOpen(null)} />}
    </Card>
  );
}

/** 외교 → 외교부: 다른 나라 외교장관·국방장관(인물 창으로 스탯 보기) */
export function ForeignPeople({ state, actions }: Pick<ScreenProps, 'state' | 'actions'>) {
  const [open, setOpen] = useState<number | null>(null);
  const [kind, setKind] = useState<'외교' | '국방'>('외교');
  const list = cabinetOf(state).people.filter((p) => p.group === '외국' && p.title?.endsWith(`${kind}장관`));
  return (
    <Card title="다른 나라 장관" icon="🌐">
      <div className="seg cab-seg">
        <button className={kind === '외교' ? 'on' : ''} onClick={() => setKind('외교')}>
          🌐 외교장관
        </button>
        <button className={kind === '국방' ? 'on' : ''} onClick={() => setKind('국방')}>
          🛡️ 국방장관
        </button>
      </div>
      <div className="cab-list">
        {list.map((p) => (
          <PersonRow key={p.id} state={state} p={p} onOpen={() => setOpen(p.id)} right={<small>{cname(p.country)}</small>} />
        ))}
      </div>
      {open !== null && <PersonModal state={state} actions={actions} pid={open} onClose={() => setOpen(null)} />}
    </Card>
  );
}
