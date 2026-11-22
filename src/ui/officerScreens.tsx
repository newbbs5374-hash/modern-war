// 장교(진급·스탯·부관·장군·라이벌) · 훈련(미니게임 12개) · 임무·대전투 패널. 그림 위주 + 팝업.
import { BoostBar } from './BoostBar';
import { useEffect, useState } from 'react';
import { STAT_GROUPS, TRAININGS } from '../data/catalog';
import { GRAND_COOLDOWN_HOURS, GRAND_RANK, MISSION_KINDS, OPERATION_RANK, STAT_IDS, TRAIN_EXP_LOSE, TRAIN_EXP_PER_STAR, aideSlots, generalSlots, statCap, statExpNeed, type StatId } from '../data/officers';
import { RANKS } from '../data/ranks';
import { cityById } from '../data/cities';
import { countryById } from '../data/world';
import {
  AIDE_STORIES,
  COMMAND_RANK,
  DRILL_MAX,
  ERRANDS,
  MASTERY_AT,
  MASTERY_NAME,
  PERKS,
  PERK_AT,
  RECRUIT_COST,
  TRAINING_STATS,
  statExpOf,
  aideTrainCost,
  boardNow,
  canErrand,
  canGift,
  canGrand,
  canTrain,
  canTrainAide,
  claimErrand,
  claimMission,
  dismissGeneral,
  drillsNow,
  errandReward,
  featuredTraining,
  generalDefense,
  giftAide,
  giftCost,
  grandTargets,
  masteryLevel,
  missionChance,
  myRenown,
  promoteAide,
  promotionCheck,
  recruitGeneral,
  rivalsView,
  sendAide,
  startExam,
  startGrand,
  startMission,
  startTraining,
  trainAide,
  type Aide,
  type ErrandKind,
  type Mission,
} from '../game/officer';
import { AIDE_EFFECT } from '../battle/grid';
import { GRAND_STAGES, OPERATIONS, PRACTICE, battleLabel, practicePlan, setPendingPlan, trainingPlan, trainingScale } from '../battle/spec';
import { Card, fmt } from './common';
import { AIDE_ICON, FRAME_ICON, MISSION_ICON, RANK_ICON, STAT_ICON, TRAINING_ICON } from './icons';
import { FLAG } from './flag';
import { Chip, Help, Meter, Modal, Tabs, Tile, stars, useTab } from './kit';
import type { ScreenProps } from './screens';

const HOUR = 3600e3;

export function timeLeft(ms: number): string {
  if (ms <= 0) return '끝남';
  const m = Math.ceil(ms / 60000);
  return m >= 60 ? `${Math.floor(m / 60)}시간 ${m % 60}분` : `${m}분`;
}

const pct = (x: number) => `${Math.round(x * 100)}%`;
const diffName = (d: number) => (d < 0.95 ? '쉬움' : d < 1.15 ? '보통' : '어려움');

/* ───────── 임무(작전 화면 첫 탭) ───────── */
export function MissionCard({ state, actions, go }: ScreenProps) {
  const o = state.officer;
  const [msg, setMsg] = useState('');
  const [pick, setPick] = useState<Mission | null>(null);
  useEffect(() => {
    actions.apply((s) => boardNow(s).state);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [o.active === null]);
  const a = o.active;
  const rank = state.player.rankIndex;
  return (
    <Card
      title="임무"
      icon="🎯"
      right={<Chip icon="🎖️" value={fmt(o.merit)} />}
      help={
        <>
          <p>임무를 고르면 실제 시간으로 이동해요(게임을 꺼 두어도 돼요).</p>
          <p>도착하면 ⚔️ 직접 싸우거나 🤖 스탯으로 자동 계산해요. 직접 싸워 별을 많이 받으면 공훈이 더 커요(★★★ ×1.4).</p>
          <p>대위부터는 세 번째 칸에 2~3판을 이어 싸우는 🗺️ 작전이 나와요.</p>
        </>
      }
    >
      {a ? (
        <div className="active-mission">
          <div className="line-item">
            <span className="li-ico">{a.exam ? '🎓' : MISSION_ICON[a.kind]}</span>
            <span className="li-main">
              <b>{a.title}</b>
              <small>
                {battleLabel(a, rank)} · 성공 확률 {pct(missionChance(state, a))}
              </small>
            </span>
          </div>
          <Meter value={state.worldMs - a.startMs} max={a.endMs - a.startMs} tone="blue" />
          {state.worldMs >= a.endMs ? (
            <div className="buttons" style={{ marginTop: 8 }}>
              <button
                className="primary"
                style={{ flex: 1 }}
                onClick={() => {
                  setPendingPlan(null);
                  go('battle');
                }}
              >
                ⚔️ 직접 싸우기
              </button>
              <button
                style={{ flex: 1 }}
                onClick={() =>
                  setMsg(
                    actions.applyWith((s) => {
                      const r = claimMission(s);
                      return { state: r.state, out: r.text ?? '' };
                    }) ?? '',
                  )
                }
              >
                🤖 자동 계산
              </button>
            </div>
          ) : (
            <>
              <p className="small muted center">⏳ 도착까지 {timeLeft(a.endMs - state.worldMs)} (꺼 두어도 진행돼요)</p>
              <BoostBar state={state} apply={actions.apply} target={{ kind: 'mission' }} />
            </>
          )}
        </div>
      ) : (
        <div className="tiles c3">
          {o.board.map((m) => (
            <Tile
              key={m.id}
              icon={MISSION_ICON[m.kind]}
              label={cityById(m.city).name}
              sub={`${m.kind} · ${m.hours}시간`}
              tone={m.kind === '작전' ? 'gold' : undefined}
              onClick={() => setPick(m)}
            >
              <small className={missionChance(state, m) < 0.4 ? 'warn' : ''}>성공 {pct(missionChance(state, m))}</small>
            </Tile>
          ))}
          {o.board.length === 0 && <p className="empty">지금은 맡을 임무가 없어요.</p>}
        </div>
      )}
      {msg && <p className="small result">{msg}</p>}
      {pick && (
        <Modal
          title={pick.title}
          icon={MISSION_ICON[pick.kind]}
          onClose={() => setPick(null)}
          footer={
            <>
              <button onClick={() => setPick(null)}>닫기</button>
              <button
                className="primary"
                onClick={() => {
                  actions.apply((s) => startMission(s, pick.id));
                  setPick(null);
                }}
              >
                🚀 출발 ({pick.hours}시간)
              </button>
            </>
          }
        >
          <p>{MISSION_KINDS[pick.kind].desc}</p>
          <div className="kv2" style={{ margin: '8px 0' }}>
            <span>성공 확률</span>
            <b>{pct(missionChance(state, pick))}</b>
            <span>난이도</span>
            <b>{diffName(pick.difficulty)}</b>
            <span>쓰는 스탯</span>
            <b>
              {MISSION_KINDS[pick.kind].stats.map((x) => `${STAT_ICON[x]}${x}`).join(' ')}
            </b>
            <span>잘 맞는 부관</span>
            <b>
              {AIDE_ICON[MISSION_KINDS[pick.kind].aideFit]} {MISSION_KINDS[pick.kind].aideFit}
            </b>
          </div>
          <p className="small muted">전투: {battleLabel({ ...pick, startMs: 0, endMs: 0 }, rank)}</p>
          {pick.kind === '작전' && <p className="small">🗺️ {OPERATIONS[(pick.op ?? 0) % OPERATIONS.length].name}: 꼭 이길 판(마지막)을 이기고 절반 넘게 이기면 성공</p>}
        </Modal>
      )}
    </Card>
  );
}

/* ───────── 대전투(준장부터): 도시 하나를 다섯 판으로 차지 ───────── */
export function GrandCard({ state, actions }: ScreenProps) {
  const rank = state.player.rankIndex;
  const [pick, setPick] = useState<string | null>(null);
  if (rank < OPERATION_RANK) return null;
  const why = canGrand(state);
  const targets = rank >= GRAND_RANK ? grandTargets(state).slice(0, 6) : [];
  const help = (
    <>
      <p>🏙️ 전쟁 중인 나라의 도시 하나를 골라 다섯 판을 이어 싸워요.</p>
      <p>{GRAND_STAGES.map((g) => `${FRAME_ICON[g.frame]} ${g.label}`).join(' → ')}</p>
      <p>시가지 돌입(⚑)은 꼭 이겨야 하고, 다섯 판 중 세 판 이상 이기면 도시를 차지해요. 어느 판이든 부관에게 맡길 수 있어요(별 최대 2).</p>
      <p>방어도가 낮은 도시일수록 쉽고, 나라 화면에서 부대를 만들면 더 쉬워져요. {GRAND_COOLDOWN_HOURS}시간마다 한 번.</p>
    </>
  );
  return (
    <Card title="대전투 · 도시 점령" icon="🏙️" help={help} right={<small className="muted">{rank >= GRAND_RANK ? `${GRAND_COOLDOWN_HOURS}시간마다` : `${RANKS[GRAND_RANK].name}부터`}</small>}>
      {rank < GRAND_RANK || why ? (
        <>
          <p className="empty">{why}</p>
          {rank >= GRAND_RANK && <BoostBar state={state} apply={actions.apply} target={{ kind: 'grand' }} />}
        </>
      ) : (
        <div className="tiles c3">
          {targets.map((id) => {
            const c = cityById(id);
            const owner = state.world.owner[id];
            return (
              <Tile key={id} icon={FLAG[owner] ?? '🏙️'} label={c.name} sub={countryById(owner).name} onClick={() => setPick(id)}>
                <Meter value={state.world.defense[id]} max={100} tone="red" />
              </Tile>
            );
          })}
        </div>
      )}
      {pick && (
        <Modal
          title={`${cityById(pick).name} 점령 대전투`}
          icon={FLAG[state.world.owner[pick]]}
          onClose={() => setPick(null)}
          footer={
            <>
              <button onClick={() => setPick(null)}>닫기</button>
              <button
                className="gold"
                onClick={() => {
                  actions.apply((s) => startGrand(s, pick));
                  setPick(null);
                }}
              >
                ⚔️ 출격 (4시간 이동)
              </button>
            </>
          }
        >
          <p>
            {countryById(state.world.owner[pick]).name} · 방어도 {Math.round(state.world.defense[pick])}
            {cityById(pick).capital && cityById(pick).home === state.world.owner[pick] ? ' · 수도' : ''}
          </p>
          <div className="tiles c5" style={{ margin: '8px 0' }}>
            {GRAND_STAGES.map((g, i) => (
              <Tile key={i} icon={FRAME_ICON[g.frame]} label={`${i + 1}`} sub={g.label} tone={i === 3 ? 'gold' : undefined} />
            ))}
          </div>
          <p className="small muted">도착하면 작전 탭에서 "직접 싸우기"로 다섯 판을 시작해요.</p>
        </Modal>
      )}
    </Card>
  );
}

/* ───────── 장교 ───────── */
type OfficerTab = 'stats' | 'aides' | 'generals' | 'rivals';

export function OfficerScreen(props: ScreenProps) {
  const { state, actions } = props;
  const o = state.officer;
  const r = state.player.rankIndex;
  const pc = promotionCheck(state);
  const [tab, setTab] = useTab<OfficerTab>('officer', 'stats');
  const examRunning = o.active?.exam;
  const errandsDone = o.aides.filter((a) => a.errand && state.worldMs >= a.errand.endMs).length;
  return (
    <>
      {o.dismissDeadlineMs !== null && (
        <div className="alert">
          ⚠️ 해임 경고: {timeLeft(o.dismissDeadlineMs - state.worldMs)} 안에 지도자 신뢰도를 40 넘게 올려야 해요. 임무에 성공하면 올라요.
        </div>
      )}
      <section className="card">
        <div className="hero">
          <span className="avatar">{RANK_ICON[r]}</span>
          <div className="hero-main">
            <b>
              {RANKS[r].name} {state.player.name}
            </b>
            <div className="small muted">지휘: {RANKS[r].unit}</div>
            <div className="ichips" style={{ marginTop: 4 }}>
              <Chip icon="📣" value={fmt(o.fame)} label="명성" />
              <Chip icon="🤝" value={Math.round(o.trust)} label={r >= COMMAND_RANK && o.trust < 40 ? '신뢰 ⚠️' : '신뢰'} />
              <Chip icon="🔐" value={fmt(o.intel)} label="정보" />
            </div>
          </div>
        </div>
        <div className="pillrow" style={{ marginTop: 8 }}>
          {RANKS.map((x, i) => (
            <span key={x.name} className={i === r ? 'now' : i < r ? 'done' : ''}>
              {x.name}
            </span>
          ))}
        </div>
        {r < RANKS.length - 1 && (
          <div className="promo">
            <div className="row">
              <b className="small">⏫ 다음: {RANKS[r + 1].name}</b>
              <Help title="진급">
                <p>공훈(임무)·훈련 별(훈련)·지도자 신뢰도(소령부터)를 채우면 진급 심사 작전(2시간)을 볼 수 있어요.</p>
                <p>심사에 붙으면 진급하고, 공훈과 별은 0부터 다시 모아요. 대장 → 총사령관은 라이벌보다 평판이 높아야 해요.</p>
              </Help>
            </div>
            {pc.lines.map((l) => (
              <div key={l.label} className="promo-line">
                <small>
                  {l.ok ? '✅' : '⬜'} {l.label}
                </small>
                <Meter value={l.have} max={l.need} tone={l.ok ? 'green' : undefined} />
                <small className="muted">
                  {fmt(l.have)}/{fmt(l.need)}
                </small>
              </div>
            ))}
            {examRunning ? (
              <p className="small center">🎓 진급 심사 중 · 작전 화면에서 결과를 받아요</p>
            ) : (
              <button className={pc.ready ? 'gold wide' : 'wide'} disabled={!pc.ready} onClick={() => actions.apply(startExam)}>
                {pc.ready ? '🎓 진급 심사 시작 (2시간)' : pc.why}
              </button>
            )}
          </div>
        )}
      </section>
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'stats', label: '스탯', icon: '📈' },
          { id: 'aides', label: `부관 ${o.aides.length}/${aideSlots(r)}`, icon: '🧑‍✈️', badge: errandsDone || null },
          { id: 'generals', label: `장군 ${o.generals.length}/${generalSlots(r)}`, icon: '⭐', locked: generalSlots(r) === 0 },
          { id: 'rivals', label: '라이벌', icon: '🏁', badge: o.chiefRival ? '!' : null },
        ]}
      />
      {tab === 'stats' && <StatsPanel {...props} />}
      {tab === 'aides' && <AidesPanel {...props} />}
      {tab === 'generals' && <GeneralsPanel {...props} />}
      {tab === 'rivals' && <RivalsPanel {...props} />}
    </>
  );
}

const STAT_DOES: Record<string, string> = Object.fromEntries(STAT_GROUPS.flatMap((g) => g.stats.map((s) => [s.name, s.does])));
const TRAIN_FOR: Record<string, string[]> = Object.fromEntries(STAT_IDS.map((id) => [id, Object.entries(TRAINING_STATS).filter(([, v]) => v.includes(id)).map(([k]) => k)]));

function StatsPanel({ state }: ScreenProps) {
  const o = state.officer;
  const cap = statCap(state.player.rankIndex);
  const [pick, setPick] = useState<StatId | null>(null);
  const total = STAT_IDS.reduce((a, id) => a + Math.floor(o.stats[id]), 0);
  return (
    <>
      <div className="stat-sum">
        <span>
          종합 <b>{total}</b>
        </span>
        <span className="muted small">스탯 상한 {cap} · 계급이 오르면 +10</span>
        <Help title="스탯과 경험치">
          <p>훈련을 하면 그 훈련이 키우는 스탯에 경험치가 쌓여요. 초록 막대가 다 차면 스탯이 1 올라요.</p>
          <p>별을 많이 받을수록 경험치가 많아요(별 1개당 {TRAIN_EXP_PER_STAR}, 지면 {TRAIN_EXP_LOSE}). 오늘의 훈련은 2배, 숙련 단계가 오르면 +10%씩 더 받아요.</p>
          <p>임무에 성공해도 그 임무가 쓰는 스탯에 경험치가 들어와요. 스탯이 높을수록 다음 1점에 드는 경험치가 조금씩 늘어요.</p>
        </Help>
      </div>
      {STAT_GROUPS.map((g) => (
        <div key={g.name} className="stat-group">
          <small className="stat-group-name">{g.name}</small>
          <div className="tiles c3">
            {g.stats.map(({ name }) => {
              const id = name as StatId;
              const v = Math.floor(o.stats[id]);
              const max = v >= cap;
              return (
                <button key={id} className={`stat-card ${max ? 'max' : ''}`} onClick={() => setPick(id)}>
                  <span className="stat-top">
                    <span>{STAT_ICON[id]}</span>
                    <small>{id}</small>
                    <b className="stat-num">{v}</b>
                  </span>
                  <Meter value={max ? 1 : statExpOf(o, id)} max={max ? 1 : statExpNeed(v)} tone="green" />
                  <small className="muted">{max ? 'MAX' : `${Math.floor(statExpOf(o, id))}/${statExpNeed(v)}`}</small>
                </button>
              );
            })}
          </div>
        </div>
      ))}
      {pick && (
        <Modal title={pick} icon={STAT_ICON[pick]} onClose={() => setPick(null)}>
          <div className="big-ico">{Math.floor(o.stats[pick])}</div>
          <p className="small center muted">
            상한 {cap} · 다음 1점까지 경험치 {Math.floor(statExpOf(o, pick))} / {statExpNeed(Math.floor(o.stats[pick]))}
          </p>
          <Meter value={statExpOf(o, pick)} max={statExpNeed(Math.floor(o.stats[pick]))} tone="green" />
          <p>{STAT_DOES[pick]}</p>
          <p className="small">올리는 훈련: {TRAIN_FOR[pick].map((t) => `${TRAINING_ICON[t]} ${t}`).join(' · ') || '임무'}</p>
          <p className="small muted">임무에 성공해도 그 임무가 쓰는 스탯에 경험치가 들어와요.</p>
        </Modal>
      )}
    </>
  );
}

function AidesPanel({ state, actions }: ScreenProps) {
  const o = state.officer;
  const r = state.player.rankIndex;
  const slots = aideSlots(r);
  const [pickId, setPickId] = useState<number | null>(null);
  const [msg, setMsg] = useState('');
  const pick = o.aides.find((a) => a.id === pickId) ?? null;
  const empty = Math.max(0, slots - o.aides.length);
  return (
    <>
      <div className="tiles c3">
        {o.aides.map((a) => {
          const busy = a.errand && state.worldMs < a.errand.endMs;
          const done = a.errand && state.worldMs >= a.errand.endMs;
          return (
            <Tile
              key={a.id}
              icon={AIDE_ICON[a.specialty]}
              label={a.name}
              sub={`${a.specialty} · Lv.${a.level}`}
              badge={done ? '✓' : null}
              tone={done ? 'green' : busy ? 'blue' : undefined}
              onClick={() => {
                setMsg('');
                setPickId(a.id);
              }}
            >
              <small>{busy ? `${ERRANDS[a.errand!.kind].icon} ${timeLeft(a.errand!.endMs - state.worldMs)}` : `💗 ${a.bond}`}</small>
              <Meter value={a.bond} max={100} tone="red" />
            </Tile>
          );
        })}
        {Array.from({ length: empty }).map((_, i) => (
          <Tile key={`e${i}`} icon="➕" label="빈자리" sub="임무 성공·모병 훈련에서 합류" />
        ))}
        {slots === 0 && <p className="empty">중위가 되면 첫 부관이 합류해요.</p>}
      </div>
      {slots > 0 && (
        <p className="small muted center" style={{ marginTop: 6 }}>
          부관은 전투에 함께 나가고(레벨만큼 강함) 특기마다 분대에 효과를 줘요. 눌러서 선물·훈련·임무.
        </p>
      )}
      {pick && <AideModal aide={pick} state={state} actions={actions} msg={msg} setMsg={setMsg} onClose={() => setPickId(null)} canPromote={generalSlots(r) > o.generals.length && pick.level >= 3} />}
    </>
  );
}

function AideModal({
  aide: a,
  state,
  actions,
  msg,
  setMsg,
  onClose,
  canPromote,
}: {
  aide: Aide;
  state: ScreenProps['state'];
  actions: ScreenProps['actions'];
  msg: string;
  setMsg: (m: string) => void;
  onClose: () => void;
  canPromote: boolean;
}) {
  const r = state.player.rankIndex;
  const busy = a.errand && state.worldMs < a.errand.endMs;
  const done = a.errand && state.worldMs >= a.errand.endMs;
  const told = a.stories ?? 0;
  const gWhy = canGift(state, a.id);
  const tWhy = canTrainAide(state, a.id);
  return (
    <Modal title={`${a.name} 부관`} icon={AIDE_ICON[a.specialty]} onClose={onClose}>
      <div className="ichips">
        <Chip icon="🏷️" value={a.specialty} />
        <Chip icon="⬆️" value={`Lv.${a.level}`} />
        <Chip icon="💗" value={a.bond} label="인연" />
      </div>
      <div className="promo-line" style={{ marginTop: 6 }}>
        <small>경험</small>
        <Meter value={a.exp} max={a.level * 100} tone="blue" />
        <small className="muted">
          {a.exp}/{a.level * 100}
        </small>
      </div>
      <p className="small">⚔️ 전투 효과: {AIDE_EFFECT[a.specialty]}</p>
      <p className="small muted">인연 60: 전투 공격 +1 · 인연 90: 임무 성공 +5%</p>
      {done ? (
        <button
          className="gold wide"
          onClick={() =>
            setMsg(
              actions.applyWith((s) => {
                const x = claimErrand(s, a.id);
                return { state: x.state, out: x.text };
              }) ?? '',
            )
          }
        >
          {ERRANDS[a.errand!.kind].icon} {a.errand!.kind} 보상 받기
        </button>
      ) : busy ? (
        <p className="small center">
          {ERRANDS[a.errand!.kind].icon} {a.errand!.kind} 중 · {timeLeft(a.errand!.endMs - state.worldMs)} 남음(그동안 전투에 못 나가요)
          <BoostBar state={state} apply={actions.apply} target={{ kind: 'errand', id: a.id }} />
        </p>
      ) : (
        <>
          <div className="buttons">
            <button style={{ flex: 1 }} disabled={!!gWhy} onClick={() => actions.apply((s) => giftAide(s, a.id))}>
              🎁 선물 <small>💵{giftCost(r)} · 💗+8</small>
            </button>
            <button style={{ flex: 1 }} disabled={!!tWhy} onClick={() => actions.apply((s) => trainAide(s, a.id))}>
              📚 특별 훈련 <small>💵{aideTrainCost(r)} · 경험+60</small>
            </button>
          </div>
          {(gWhy || tWhy) && <p className="small muted">{[gWhy, tWhy].filter(Boolean).join(' · ')}</p>}
          <small className="muted">📤 부관 임무 보내기(그동안 전투에 못 나감)</small>
          <div className="tiles c3" style={{ marginTop: 4 }}>
            {(Object.keys(ERRANDS) as ErrandKind[]).map((k) => {
              const rw = errandReward(state, { ...a, errand: { kind: k, endMs: 0 } });
              return (
                <Tile
                  key={k}
                  icon={ERRANDS[k].icon}
                  label={k}
                  sub={`${ERRANDS[k].hours}시간 · ${rw.intel ? `정보+${rw.intel}` : rw.salary ? `💵+${rw.salary}` : `🎖️+${rw.merit}`}`}
                  onClick={() => !canErrand(state, a.id) && actions.apply((s) => sendAide(s, a.id, k))}
                />
              );
            })}
          </div>
        </>
      )}
      {canPromote && (
        <button className="wide" style={{ marginTop: 8 }} onClick={() => (actions.apply((s) => promoteAide(s, a.id)), onClose())}>
          ⭐ 장군으로 승격
        </button>
      )}
      {msg && <p className="small result">{msg}</p>}
      <div className="stories">
        <small className="muted">💬 인연 이야기 {told}/3</small>
        {AIDE_STORIES[a.specialty].map((t, i) => (
          <p key={i} className={`small ${i < told ? '' : 'muted'}`}>
            {i < told ? `“${t}”` : `🔒 인연 ${[30, 60, 90][i]}에 열려요`}
          </p>
        ))}
      </div>
    </Modal>
  );
}

function GeneralsPanel({ state, actions }: ScreenProps) {
  const o = state.officer;
  const r = state.player.rankIndex;
  const slots = generalSlots(r);
  if (slots === 0) return <p className="empty">⭐ 준장이 되면 장군을 둘 수 있어요(부관 Lv.3 승격 또는 영입).</p>;
  const FIELD_ICON: Record<string, string> = { 육군: '🪖', 해군: '⚓', 공군: '✈️', 정보: '🔐', 군수: '📦' };
  return (
    <Card title={`장군 ${o.generals.length} / ${slots}`} icon="⭐" right={<Chip icon="🛡️" value={`+${Math.round((generalDefense(o) - 1) * 100)}%`} label="방어" />} help={<p>장군은 내 나라 도시를 자동으로 지켜요(능력이 높을수록 방어 +). 부관 Lv.3을 승격하거나 봉급으로 영입해요.</p>}>
      {o.generals.map((g) => (
        <div key={g.id} className="line-item">
          <span className="li-ico">{FIELD_ICON[g.field] ?? '⭐'}</span>
          <span className="li-main">
            <b>
              {g.name} <small className="muted">{g.field} · {g.style}</small>
            </b>
            <small>
              능력 {g.skill} · 충성 {Math.round(g.loyalty)} · {g.from}
            </small>
          </span>
          <button onClick={() => window.confirm(`${g.name} 장군을 보낼까요?`) && actions.apply((s) => dismissGeneral(s, g.id))}>보내기</button>
        </div>
      ))}
      <button className="wide" disabled={o.generals.length >= slots || state.player.salary < RECRUIT_COST} onClick={() => actions.apply(recruitGeneral)}>
        ➕ 장군 영입 (💵 {fmt(RECRUIT_COST)})
      </button>
    </Card>
  );
}

function RivalsPanel({ state }: ScreenProps) {
  const o = state.officer;
  const r = state.player.rankIndex;
  const rivals = rivalsView(state);
  const mine = myRenown(o);
  const top = Math.max(mine, ...rivals.map((x) => x.renown));
  return (
    <Card title="총사령관 경쟁" icon="🏁" help={<p>대장에서 총사령관이 되려면 라이벌 세 명보다 평판(공훈 + 명성 + 신뢰도)이 높아야 해요. 라이벌도 시간이 지나면 진급해요.</p>}>
      <div className="line-item">
        <span className="li-ico">{RANK_ICON[r]}</span>
        <span className="li-main">
          <b>나 · {RANKS[r].name}</b>
          <Meter value={mine} max={top} tone="green" />
        </span>
        <small>{fmt(mine)}</small>
      </div>
      {rivals.map((x) => (
        <div key={x.name} className="line-item">
          <span className="li-ico">{RANK_ICON[x.rank]}</span>
          <span className="li-main">
            <b>
              {x.name} · {RANKS[x.rank].name} {x.rank > r ? '⚠️' : ''}
            </b>
            <Meter value={x.renown} max={top} tone="red" />
          </span>
          <small>{fmt(x.renown)}</small>
        </div>
      ))}
      {o.chiefRival && <p className="small warn">총사령관 후보 1순위: {o.chiefRival}. 평판으로 앞질러야 해요.</p>}
    </Card>
  );
}

/* ───────── 훈련(미니게임 12개) ───────── */
export function TrainingScreen({ state, actions, go }: ScreenProps) {
  const o = state.officer;
  const rank = state.player.rankIndex;
  const d = drillsNow(o, state.worldMs);
  const [pick, setPick] = useState<string | null>(null);
  const [practice, setPractice] = useState(false);
  const [msg, setMsg] = useState('');
  const featured = featuredTraining(state.worldMs, rank);
  const today = o.trainCounts;
  const start = (name: string) => {
    const why = canTrain(state, name);
    if (why) return setMsg(why);
    const tr = actions.applyWith((s) => {
      const ns = startTraining(s, name);
      return { state: ns, out: ns.officer.training };
    });
    if (!tr) return;
    setPendingPlan(trainingPlan(name, rank, tr.seed));
    go('battle');
  };
  const t = pick ? TRAININGS.find((x) => x.name === pick)! : null;
  return (
    <>
      <section className="card">
        <div className="row">
          <div className="ichips">
            <Chip icon="📅" value={`${d.count}/${DRILL_MAX}`} label={d.count < DRILL_MAX ? `+1 ${timeLeft(d.nextInMs)}` : '가득'} />
            <Chip icon="⭐" value={o.stars} label="별" />
            <Chip icon="🔥" value={featured} label="오늘 2배" />
          </div>
          <Help title="훈련">
            <p>훈련 일정은 실제 4시간마다 1개씩 차요(최대 {DRILL_MAX}개). 훈련은 직접 하는 미니게임이에요.</p>
            <ul>
              <li>훈련하면 스탯 경험치를 받아요. 별이 많을수록 많이 받고, 져도 조금 받아요. 경험치가 차면 스탯 +1.</li>
              <li>🤖 자동·⏩ 즉시완료를 쓰면 별은 최대 2개.</li>
              <li>🔥 오늘의 훈련은 경험치 2배.</li>
              <li>같은 훈련을 많이 하면 숙련 단계(초보→달인)가 올라 경험치를 더 받아요.</li>
              <li>같은 훈련 하루 3번째부터는 효과 절반.</li>
              <li>별 3개를 {PERK_AT}번 받으면 특기(전투 스탯 +)가 생겨요.</li>
            </ul>
          </Help>
        </div>
        {o.training && (
          <button
            className="gold wide"
            style={{ marginTop: 8 }}
            onClick={() => {
              setPendingPlan(trainingPlan(o.training!.name, rank, o.training!.seed));
              go('battle');
            }}
          >
            ▶ {o.training.name} 훈련 이어서 하기
          </button>
        )}
        {msg && <p className="small result">{msg}</p>}
      </section>
      <div className="tlist">
        {TRAININGS.map((tr) => {
          const lock = rank < tr.rank;
          const runs = o.mastery?.[tr.name] ?? 0;
          const lv = masteryLevel(runs);
          const hot = tr.name === featured;
          const perk = (o.perfect[tr.name] ?? 0) >= PERK_AT;
          return (
            <button key={tr.name} className={`trow ${lock ? 'locked' : ''} ${hot ? 't-gold' : perk ? 't-green' : ''}`} onClick={() => setPick(tr.name)}>
              <span className="trow-ico">{lock ? '🔒' : TRAINING_ICON[tr.name]}</span>
              <span className="trow-main">
                <b>
                  {tr.name}
                  {hot && <i className="trow-hot">🔥2배</i>}
                </b>
                <small>{TRAINING_STATS[tr.name].map((x) => `${STAT_ICON[x]}${x}`).join(' ')}</small>
                <small className="muted">{lock ? `${RANKS[tr.rank].name}부터` : `${MASTERY_NAME[lv - 1]} · 오늘 ${today[tr.name] ?? 0}번`}</small>
              </span>
              {!lock && <small className="stars trow-stars">{stars(o.best?.[tr.name] ?? 0)}</small>}
            </button>
          );
        })}
      </div>
      <button className="wide" style={{ marginTop: 8 }} onClick={() => setPractice(true)}>
        🎮 전투 연습장 (보상 없음)
      </button>
      {t && (
        <TrainModal
          name={t.name}
          state={state}
          featured={featured === t.name}
          onClose={() => setPick(null)}
          onStart={() => {
            setPick(null);
            start(t.name);
          }}
        />
      )}
      {practice && (
        <Modal title="전투 연습장" icon="🎮" onClose={() => setPractice(false)}>
          <p className="small muted">임무에 나오는 전투를 보상 없이 해 봐요.</p>
          <div className="tiles c3">
            {PRACTICE.map((x, i) => (
              <Tile
                key={x.label}
                icon={FRAME_ICON[x.frame]}
                label={x.label}
                onClick={() => {
                  setPendingPlan(practicePlan(i, (Date.now() & 0xffff) + i));
                  go('battle');
                }}
              />
            ))}
          </div>
        </Modal>
      )}
    </>
  );
}

function TrainModal({ name, state, featured, onClose, onStart }: { name: string; state: ScreenProps['state']; featured: boolean; onClose: () => void; onStart: () => void }) {
  const o = state.officer;
  const rank = state.player.rankIndex;
  const t = TRAININGS.find((x) => x.name === name)!;
  const lock = rank < t.rank;
  const runs = o.mastery?.[name] ?? 0;
  const lv = masteryLevel(runs);
  const next = MASTERY_AT[lv];
  const why = lock ? `${RANKS[t.rank].name}부터 할 수 있어요` : canTrain(state, name);
  const scale = trainingScale(name, rank);
  return (
    <Modal
      title={`${name} 훈련`}
      icon={TRAINING_ICON[name]}
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose}>닫기</button>
          <button className={featured ? 'gold' : 'primary'} disabled={!!why} onClick={onStart}>
            {why ?? '▶ 시작 (일정 1개)'}
          </button>
        </>
      }
    >
      <p>
        {FRAME_ICON[trainingPlan(name, rank, 0).stages[0].frame]} {t.frame}
        {scale ? ` · ${scale}` : ''}
        {featured ? ' · 🔥 오늘 2배' : ''}
      </p>
      <div className="kv2">
        <span>오르는 스탯</span>
        <b>{TRAINING_STATS[name].map((x) => `${STAT_ICON[x]}${x} ${Math.floor(o.stats[x])}`).join(' · ')}</b>
        <span>받는 경험치</span>
        <b>
          ★1개당 {Math.round(TRAIN_EXP_PER_STAR * (1 + 0.1 * (lv - 1)) * (featured ? 2 : 1))}
          {(o.trainCounts[name] ?? 0) >= 2 ? ' (오늘 3번째부터 절반)' : ''}
        </b>
        <span>최고 기록</span>
        <b className="stars">{stars(o.best?.[name] ?? 0)}</b>
        <span>숙련</span>
        <b>
          {MASTERY_NAME[lv - 1]} ({lv}단계 · +{(lv - 1) * 10}%)
        </b>
        <span>오늘 한 횟수</span>
        <b>{o.trainCounts[name] ?? 0}번</b>
      </div>
      {next !== undefined && (
        <div className="promo-line" style={{ marginTop: 6 }}>
          <small>다음 숙련</small>
          <Meter value={runs} max={next} tone="blue" />
          <small className="muted">
            {runs}/{next}
          </small>
        </div>
      )}
      {PERKS[name] && (
        <div className="promo-line">
          <small>특기 "{PERKS[name]}"</small>
          <Meter value={o.perfect[name] ?? 0} max={PERK_AT} tone="green" />
          <small className="muted">
            ★★★ {Math.min(PERK_AT, o.perfect[name] ?? 0)}/{PERK_AT}
          </small>
        </div>
      )}
      <p className="small muted">{t.raises}</p>
    </Modal>
  );
}

export { HOUR };
