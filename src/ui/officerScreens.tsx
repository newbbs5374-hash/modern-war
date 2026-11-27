// 장교(승급·스탯·부관·장군·라이벌) · 훈련(미니게임 12개) · 임무·대전투 패널. 그림 위주 + 팝업.
import { buyGrand, canBuyGrand, grandCapLeft, grandToday } from '../game/acts';
import { GRAND_EXTRA_MAX, GRAND_EXTRA_RUBY } from '../game/balance';
import { salaryPerDay } from '../game/state';
import { playerKeys } from '../data/looks';
import { originFits, originOf } from '../game/origin';
import { BoostBar } from './BoostBar';
import { useEffect, useState } from 'react';
import { STAT_GROUPS, TRAININGS } from '../data/catalog';
import { GRAND_COOLDOWN_HOURS, GRAND_RANK, MISSION_KINDS, OPERATION_RANK, STAT_IDS, TRAIN_EXP_LOSE, TRAIN_EXP_PER_STAR, aideSlots, generalSlots, statCap, statExpNeed, type StatId } from '../data/officers';
import { RANKS } from '../data/ranks';
import { cityById } from '../data/cities';
import { COUNTRIES, countryById } from '../data/world';
import { canDiplo, doDiplo } from '../game/command';
import { isAlive, relationOf } from '../game/world';
import { campaignInfo } from '../game/campaign';
import { CAMPAIGN_STREAK_MAX } from '../game/balance';
import type { GameState } from '../game/state';
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
  recruitGeneral,
  rivalsView,
  sendAide,
  startGrand,
  startMission,
  startTraining,
  trainAide,
  type Aide,
  type ErrandKind,
  type Mission,
} from '../game/officer';
import { AIDE_EFFECT } from '../data/aideEffect';
import { minisFor } from '../battle/minigames';
import { easyById, easyLv, easyStats } from '../battle/easy';
import { FRAME_NAME } from '../battle/fresh';
import { UNIT_LV_AT, threeFor, unitBonusPct, unitLevel, unitName, weekLeftMs, weekOf, weeklyInfo, weeklyTraining } from '../battle3d/train3d';
import { TEST_MODE } from '../game/balance';
import { OPERATIONS, PRACTICE, PRACTICE_GROUPS, battleLabel, practicePlan, setPendingPlan, trainingPlan } from '../battle/spec';
import { ACT_POOLS } from '../battle3d/stages';
import { Card, fmt } from './common';
import { aideKeys } from './Portrait';
import { PersonFace } from './People';
import { AideCareer, BondLoyalty } from './AideCareer';
import { AidePickModal } from './AidePick';
import { dismissAide } from '../game/aidePick';
import { FIELD_ICON, GENERAL_TITLE, branchSummary, generalEffectText, loyaltyOf, type GeneralField } from '../game/loyal';
import { BLOCK_AT, PLOT_MIN, ROLE_INFO } from '../game/rivals';
import { TrainIcon } from './iconArt';
import { TitleBox } from './TitleUI';
import { TITLES } from '../data/ranks';
import { tierNow, titleOf } from '../game/title';
import { VOICE_ICON, remarksOf } from '../game/remarks';
import { AIDE_ICON, FRAME_ICON, MISSION_ICON, RANK_ICON, STAT_ICON, TRAINING_ICON } from './icons';
import { FLAG } from './flag';
import { Chip, Help, Meter, Modal, Tile, stars } from './kit';
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
          <p>지도자다운 일(안보회의·특수작전 승인·전선 시찰·정상 통화·민생 현장 방문 등)을 고르면 실제 시간이 지나 결과가 나와요(게임을 꺼 두어도 돼요).</p>
          <p>때가 되면 ⚔️ 상황실에서 직접 지휘하거나 🤖 참모에게 맡겨요(스탯으로 계산). 직접 지휘해 별을 많이 받으면 공훈이 더 커요(★★★ ×1.4).</p>
          <p>{RANKS[OPERATION_RANK].name}부터는 세 번째 칸에 2~3판을 이어 싸우는 🗺️ 작전이 나와요.</p>
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
                ⚔️ 직접 지휘
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
                🤖 참모에게 맡기기
              </button>
            </div>
          ) : (
            <>
              <p className="small muted center">⏳ 결과까지 {timeLeft(a.endMs - state.worldMs)} (꺼 두어도 진행돼요)</p>
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
                🚀 시작 ({pick.hours}시간)
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

/** 전쟁 중인 나라가 없을 때: 대전투 칸에서 바로 선전포고할 나라 고르기 */
function WarPick({ state, actions }: Pick<ScreenProps, 'state' | 'actions'>) {
  const me = state.player.countryId;
  const [msg, setMsg] = useState('');
  const list = COUNTRIES.filter((c) => c.id !== me && isAlive(state.world, c.id));
  return (
    <>
      <p className="empty">지금 전쟁 중인 나라가 없어요. 선전포고하면 그 나라 도시를 점령하러 갈 수 있어요.</p>
      <div className="tiles c3">
        {list.map((c) => {
          const rel = relationOf(state.world, me, c.id);
          const no = canDiplo(state, c.id, '선전포고');
          return (
            <Tile
              key={c.id}
              icon={FLAG[c.id]}
              label={c.name}
              sub={no ?? (rel === '연합' ? '⚔️ 연합을 깨고 선전포고' : rel === '휴전' ? '⚔️ 휴전을 깨고 선전포고' : '⚔️ 선전포고')}
              onClick={() => {
                if (no) return;
                const warn = rel === '연합' ? '\n(연합을 깨요: 신뢰 −10 · 명성 −10)' : rel === '휴전' ? '\n(휴전을 깨요: 신뢰 −5)' : '';
                if (!window.confirm(`${c.name}에 선전포고할까요?${warn}`)) return;
                setMsg(actions.applyWith((s) => {
                  const r = doDiplo(s, c.id, '선전포고');
                  return { state: r.state, out: r.text };
                }) ?? '');
              }}
            />
          );
        })}
      </div>
      {msg && <p className="small">{msg}</p>}
    </>
  );
}

/* ───────── 대전투(존경받는 지도자부터): 도시 하나를 다섯 판으로 차지 ───────── */
export function GrandCard({ state, actions }: ScreenProps) {
  const rank = state.player.rankIndex;
  const [pick, setPick] = useState<string | null>(null);
  if (rank < OPERATION_RANK) return null;
  const why = canGrand(state);
  const targets = rank >= GRAND_RANK ? grandTargets(state).slice(0, 6) : [];
  const help = (
    <>
      <p>🏙️ 전쟁 중인 나라의 도시 하나를 골라 점령하러 가요. 싸움은 3D <b>3막 공성전</b>이에요.</p>
      <p>🏰 1막 외곽 → 2막 시가전(거점 차지) → 3막 도심(지휘소 + 최후 저항). 막마다 전장이 여러 곳 중에서 바뀌어요(1막 {ACT_POOLS[0].length}곳 · 2막 {ACT_POOLS[1].length}곳 · 3막 {ACT_POOLS[2].length}곳). 바닷가 도시는 1막에 바다가 있는 전장이 나와요. 살아남은 부대는 다친 그대로 다음 막으로 이어져요.</p>
      <p>부관에게 맡길 수 있어요(별 최대 2).</p>
      <p>방어도가 낮은 도시일수록 쉽고, 국방 → 부대에서 부대를 만들면 더 쉬워져요. {GRAND_COOLDOWN_HOURS}시간마다 한 번.</p>
    </>
  );
  return (
    <Card title="대전투 · 도시 점령" icon="🏙️" help={help} right={<small className="muted">{rank >= GRAND_RANK ? (state.world.act != null ? `오늘 ${grandToday(state).n}/${grandToday(state).cap}번` : `${GRAND_COOLDOWN_HOURS}시간마다`) : `${RANKS[GRAND_RANK].name}부터`}</small>}>
      {rank >= GRAND_RANK && !targets.length ? (
        <WarPick state={state} actions={actions} />
      ) : rank < GRAND_RANK || why ? (
        <>
          <p className="empty">{why}</p>
          {rank >= GRAND_RANK && grandCapLeft(state) <= 0 && state.world.act != null ? (
            <button className="gold" disabled={!!canBuyGrand(state)} title={canBuyGrand(state) ?? ''} onClick={() => actions.apply(buyGrand)}>
              💎 {GRAND_EXTRA_RUBY}로 오늘 한 번 더 ({grandToday(state).extra}/{GRAND_EXTRA_MAX})
            </button>
          ) : (
            rank >= GRAND_RANK && <BoostBar state={state} apply={actions.apply} target={{ kind: 'grand' }} />
          )}
        </>
      ) : (
        <div className="tiles c3">
          {state.world.act != null && <CampaignStrips state={state} onPick={setPick} />}
          {targets.filter((id) => state.world.act == null || cityById(id).home !== state.world.owner[id]).map((id) => {
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
                  actions.apply((s) => startGrand(s, pick, true));
                  setPick(null);
                }}
              >
                🏰 3막 공성전으로 출격
              </button>
            </>
          }
        >
          <p>
            {countryById(state.world.owner[pick]).name} · 방어도 {Math.round(state.world.defense[pick])}
            {cityById(pick).capital && cityById(pick).home === state.world.owner[pick] ? ' · 수도' : ''}
          </p>
          <div className="tiles c3" style={{ margin: '8px 0' }}>
            {['외곽', '시가전', '도심'].map((g, i) => (
              <Tile key={g} icon={['🌄', '🏙️', '🏛️'][i]} label={`${i + 1}막`} sub={g} tone={i === 2 ? 'gold' : undefined} />
            ))}
          </div>
          <p className="small muted">🏰 3막 공성전: 막마다 다른 3D 전장에서 외곽 → 시가전 → 도심을 차례로 뚫어요. 도착(4시간 이동)하면 작전 탭에서 시작해요.</p>
        </Modal>
      )}
    </Card>
  );
}

/** 11-27 전역: 전쟁 중인 나라마다 국경 → 수도 길 한 줄. 빛나는 칸이 다음에 칠 도시 */
function CampaignStrips({ state, onPick }: { state: GameState; onPick: (city: string) => void }) {
  const me = state.player.countryId;
  const foes = COUNTRIES.filter((c) => c.id !== me && isAlive(state.world, c.id) && relationOf(state.world, me, c.id) === '전쟁');
  return (
    <>
      {foes.map((f) => {
        const info = campaignInfo(state, f.id);
        if (!info.route.length) return null;
        return (
          <div key={f.id} className="camp">
            <div className="camp-head">
              <b>
                {FLAG[f.id]} {f.name} 전역
              </b>
              <small>
                {info.mine}/{info.route.length}
                {info.streak > 0 && ` · 🔥 기세 ${Math.min(CAMPAIGN_STREAK_MAX, info.streak)}`}
                {info.cut && ' · ⚠️ 보급선 끊김'}
              </small>
            </div>
            <div className="camp-route">
              {info.route.map((id, i) => {
                const c = cityById(id);
                const mine = state.world.owner[id] === me;
                const next = id === info.next;
                return (
                  <button key={id} className={`camp-node ${mine ? 'mine' : ''} ${next ? 'next' : ''}`} disabled={!next} onClick={() => onPick(id)}>
                    <i>{mine ? '✅' : c.capital ? '⭐' : next ? '⚔️' : i + 1}</i>
                    <small>{c.name}</small>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </>
  );
}

/* ───────── 장교 ───────── */
/** 개인 > 프로필: 캐릭터 카드형(11-23 대장 결정). 큰 인물 카드 + 명성·신뢰·정보 칩 + 호칭 + 묶음별 색 막대 9줄 */
const GROUP_TONE = ['g1', 'g2', 'g3'];
export function LeaderCard(props: ScreenProps) {
  const { state } = props;
  const o = state.officer;
  const r = state.player.rankIndex;
  const og = originOf(state);
  const tier = tierNow(state);
  const tt = titleOf(state);
  const cap = statCap(r);
  const [pick, setPick] = useState<StatId | null>(null);
  const total = STAT_IDS.reduce((a, id) => a + Math.floor(o.stats[id]), 0);
  return (
    <>
      {o.dismissDeadlineMs !== null && (
        <div className="alert">
          ⚠️ 불신임 경고: {timeLeft(o.dismissDeadlineMs - state.worldMs)} 안에 의회 신뢰도를 40 넘게 올려야 해요. 임무에 성공하면 올라요.
        </div>
      )}
      <div className="lc-card">
        <div className="lc-photo">
          <PersonFace who={{ kind: 'player' }} keys={playerKeys(state.player)} fallback={RANK_ICON[r]} />
          <span className="lc-step">
            {tier + 1}/{TITLES.length}
          </span>
        </div>
        <div className="lc-info">
          <span className="lc-rank">
            {tt.icon} {tt.name}
          </span>
          <div className="lc-name">{state.player.name}</div>
          <div className="lc-sub">
            {FLAG[state.player.countryId]} {countryById(state.player.countryId).name} · 봉급 시간당 {Math.round(salaryPerDay(state))}
          </div>
          {og && (
            <div className="lc-sub lc-origin">
              {og.icon} {og.name}
              {originFits(og, state.player.countryId) ? ' ★' : ''} · {og.perk}
            </div>
          )}
          <div className="lc-chips">
            <span>
              📣<small>명성</small>
              <b>{fmt(o.fame)}</b>
            </span>
            <span className={r >= COMMAND_RANK && o.trust < 40 ? 'warn' : ''}>
              🤝<small>신뢰</small>
              <b>{Math.round(o.trust)}</b>
            </span>
            <span>
              🔐<small>정보</small>
              <b>{fmt(o.intel)}</b>
            </span>
          </div>
          <div className="lc-road" aria-label="호칭 단계">
            {TITLES.map((x, i) => (
              <i key={x.name} className={i < tier ? 'done' : i === tier ? 'now' : ''} title={x.name} />
            ))}
          </div>
        </div>
      </div>
      <TitleBox state={state} />
      <div className="lc-box">
        <div className="lc-head">
          <b>능력치</b>
          <small>
            종합 {total} · 상한 {cap}
          </small>
          <Help title="스탯과 경험치">
            <p>훈련을 하면 그 훈련이 키우는 스탯에 경험치가 쌓여요. 막대 밑 얇은 줄이 다 차면 스탯이 1 올라요.</p>
            <p>별을 많이 받을수록 경험치가 많아요(별 1개당 {TRAIN_EXP_PER_STAR}, 지면 {TRAIN_EXP_LOSE}). 오늘의 훈련은 2배, 숙련 단계가 오르면 +10%씩 더 받아요.</p>
            <p>스탯 상한은 호칭 단계가 오르면 +10. 줄을 누르면 자세히 볼 수 있어요.</p>
          </Help>
        </div>
        {STAT_GROUPS.map((g, gi) => (
          <div key={g.name} className={`lc-group ${GROUP_TONE[gi % 3]}`}>
            {g.stats.map(({ name }) => {
              const id = name as StatId;
              const v = Math.floor(o.stats[id]);
              const max = v >= cap;
              const exp = max ? 1 : statExpOf(o, id) / statExpNeed(v);
              return (
                <button key={id} className="lc-bar" onClick={() => setPick(id)}>
                  <span className="lc-i">{STAT_ICON[id]}</span>
                  <span className="lc-n">{id}</span>
                  <span className="lc-track">
                    <i style={{ width: `${Math.min(100, (v / cap) * 100)}%` }} />
                    <em style={{ width: `${Math.min(100, exp * 100)}%` }} />
                  </span>
                  <b>{max ? 'MAX' : v}</b>
                </button>
              );
            })}
          </div>
        ))}
      </div>
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

const STAT_DOES: Record<string, string> = Object.fromEntries(STAT_GROUPS.flatMap((g) => g.stats.map((s) => [s.name, s.does])));
const TRAIN_FOR: Record<string, string[]> = Object.fromEntries(STAT_IDS.map((id) => [id, Object.entries(TRAINING_STATS).filter(([, v]) => v.includes(id)).map(([k]) => k)]));

export function StatsPanel({ state }: ScreenProps) {
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
        <span className="muted small">스탯 상한 {cap} · 호칭이 오르면 +10</span>
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

export function AidesPanel({ state, actions }: ScreenProps) {
  const o = state.officer;
  const r = state.player.rankIndex;
  const slots = aideSlots(r);
  const [pickId, setPickId] = useState<number | null>(null);
  const [hire, setHire] = useState(false);
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
              icon={<PersonFace who={{ kind: 'aide', id: a.id }} keys={aideKeys(a)} fallback={AIDE_ICON[a.specialty]} className="tile-face" />}
              label={a.name}
              sub={`${a.specialty} · Lv.${a.level}`}
              badge={done ? '✓' : null}
              tone={done ? 'green' : busy ? 'blue' : undefined}
              onClick={() => {
                setMsg('');
                setPickId(a.id);
              }}
            >
              <small>{a.school ? `🎓 ${timeLeft(a.school.endMs - state.worldMs)}` : busy ? `${ERRANDS[a.errand!.kind].icon} ${timeLeft(a.errand!.endMs - state.worldMs)}` : `💗 ${Math.round(a.bond)} · 🫡 ${Math.round(loyaltyOf(a))}`}</small>
              <Meter value={a.bond} max={100} tone="red" />
              <Meter value={loyaltyOf(a)} max={100} tone="green" />
            </Tile>
          );
        })}
        {Array.from({ length: empty }).map((_, i) => (
          <Tile key={`e${i}`} icon="➕" label="부관 임명" sub="병과별 후보 중 고르기" onClick={() => setHire(true)} />
        ))}
      </div>
      <button className="wide" style={{ marginTop: 6 }} onClick={() => setHire(true)}>
        🧑‍✈️ 부관 후보 보기 · 임명/교대 <small>조건 없음</small>
      </button>
      <p className="small muted center" style={{ marginTop: 6 }}>
        병과(저격·의무·통신·공병·정찰)마다 특화된 후보 4명 중에서 골라 바로 임명해요. 부관은 전투에 함께 나가고(레벨만큼 강함) 병과마다 분대에 효과를 줘요. 💗인연과 🫡충성을 키워 장군 교육을 보내면 장군으로 임명할 수 있어요.
      </p>
      {hire && <AidePickModal state={state} actions={actions} onClose={() => setHire(false)} />}
      {pick && <AideModal aide={pick} state={state} actions={actions} msg={msg} setMsg={setMsg} onClose={() => setPickId(null)} />}
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
}: {
  aide: Aide;
  state: ScreenProps['state'];
  actions: ScreenProps['actions'];
  msg: string;
  setMsg: (m: string) => void;
  onClose: () => void;
}) {
  const r = state.player.rankIndex;
  const busy = a.errand && state.worldMs < a.errand.endMs;
  const done = a.errand && state.worldMs >= a.errand.endMs;
  const told = a.stories ?? 0;
  const gWhy = canGift(state, a.id);
  const tWhy = canTrainAide(state, a.id);
  return (
    <Modal title={`${a.name} 부관`} icon={<PersonFace who={{ kind: 'aide', id: a.id }} keys={aideKeys(a)} fallback={AIDE_ICON[a.specialty]} className="modal-face" />} onClose={onClose}>
      <div className="ichips">
        <Chip icon="🏷️" value={a.specialty} />
        {a.trait && <Chip icon="✨" value={a.trait} />}
        <Chip icon="⬆️" value={`Lv.${a.level}`} />
        <Chip icon="💗" value={Math.round(a.bond)} label="인연" />
        <Chip icon="🫡" value={Math.round(loyaltyOf(a))} label="충성" />
      </div>
      {a.career && <p className="small muted">📜 {a.career}{a.age ? ` · ${a.age}세` : ''}</p>}
      <BondLoyalty a={a} />
      <div className="promo-line" style={{ marginTop: 6 }}>
        <small>경험</small>
        <Meter value={a.exp} max={a.level * 100} tone="blue" />
        <small className="muted">
          {a.exp}/{a.level * 100}
        </small>
      </div>
      <p className="small">⚔️ 전투 효과: {AIDE_EFFECT[a.specialty]}</p>
      <p className="small muted">인연 60: 전투 공격 +1 · 인연 90: 임무 성공 +5%</p>
      {a.school ? null : done ? (
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
      <AideCareer state={state} a={a} apply={actions.apply} onDone={(t) => (setMsg(t), t.startsWith('⭐') && onClose())} />
      {!a.school && (
        <button className="wide" style={{ marginTop: 6 }} onClick={() => window.confirm(`${a.name} 부관을 원래 부대로 돌려보낼까요? 자리가 비면 새 후보를 바로 임명할 수 있어요.`) && (actions.apply((s) => dismissAide(s, a.id)), onClose())}>
          👋 부관 돌려보내기(자리 비우기)
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

export function GeneralsPanel({ state, actions }: ScreenProps) {
  const o = state.officer;
  const r = state.player.rankIndex;
  const slots = generalSlots(r);
  if (slots === 0) return <p className="empty">⭐ 존경받는 지도자가 되면 장군을 둘 수 있어요(장군 교육을 마친 부관을 임명하거나 영입).</p>;
  return (
    <Card title={`장군 ${o.generals.length} / ${slots}`} icon="⭐" right={<Chip icon="🛡️" value={`+${Math.round((generalDefense(o) - 1) * 100)}%`} label="방어" />} help={<p>장군은 맡은 병과의 효율을 올려요(육군·해군·공군 = 그 병과 전투력·모집 속도, 정보 = 임무 성공, 군수 = 전략 자원). 내 나라 도시 방어도 조금 올려요. 충성 80 넘으면 효과 ×1.2, 30 밑이면 절반. 장군 교육을 마친 부관을 임명하거나 봉급으로 영입해요.</p>}>
      <div className="ichips gen-chips">
        {branchSummary(state).map((b) => (
          <Chip key={b.field} icon={FIELD_ICON[b.field]} value={b.on ? b.text : '-'} label={b.field} />
        ))}
      </div>
      {o.generals.map((g) => (
        <div key={g.id} className="line-item">
          <span className="li-ico">
            <PersonFace who={{ kind: 'general', id: g.id }} keys={[g.faceKey, `aide-${g.name}`]} fallback={FIELD_ICON[g.field as keyof typeof FIELD_ICON] ?? '⭐'} />
          </span>
          <span className="li-main">
            <b>
              {g.name} <small className="muted">{GENERAL_TITLE[g.field as GeneralField] ?? g.field} · {g.style}</small>
            </b>
            <small>
              능력 {g.skill} · 충성 {Math.round(g.loyalty)} · {g.from}
            </small>
            <small className="muted" style={{ display: 'block' }}>📈 {generalEffectText(g)}</small>
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

export function RivalsPanel({ state }: ScreenProps) {
  const o = state.officer;
  const rivals = rivalsView(state);
  return (
    <Card
      title="나라 안 정적"
      icon="🏁"
      help={
        <p>
          지도자 자리를 흔드는 정적 {rivals.length}명이에요. 영향력이 {PLOT_MIN}을 넘으면 몇 시간마다 방해 공작을 해요(야당·여당 비주류 = 의회 신뢰 −, 군부·퇴역 대장 = 장군·부관 충성 −, 재벌·금융 = 봉급 −, 언론·노조·지방·종교 = 지지도 −, 전 정보기관장 = 정보 −). 20~40분마다 누군가 발언하고, 다른 정적이 거들기도 해요. 영향력이 {BLOCK_AT}을 넘으면 전설의 지도자 호칭을 막아요. 사진을 눌러 🕵️동향 살피기(공작을 미리 막음)·🗞️견제(영향력 −)·🤝회유(3번 성공하면 내 편)를 하세요. 연설은 영향력을 낮추고, 도시를 잃으면 올라가요.
        </p>
      }
    >
      {rivals.map((x) => (
        <div key={x.name} className="line-item">
          <span className="li-ico">
            <PersonFace who={{ kind: 'rival', name: x.name }} keys={[x.faceKey, `aide-${x.name}`, `rival-${x.name}`]} fallback={ROLE_INFO[x.role].icon} />
          </span>
          <span className="li-main">
            <b>
              {x.name} <small className="muted">{x.role}</small> {x.ally ? '🤝' : x.influence >= BLOCK_AT ? '⚠️' : ''}
            </b>
            {x.ally ? <small className="good">내 편 · {ROLE_INFO[x.role].ally}</small> : <Meter value={x.influence} max={100} tone={x.influence >= PLOT_MIN ? 'red' : 'gold'} />}
            {!x.ally && (
              <small className="muted">
                영향력 {x.influence}
                {x.watch ? ' · 🕵️ 지켜보는 중' : ''}
                {x.woo ? ` · 회유 ${x.woo}/3` : ''}
              </small>
            )}
          </span>
        </div>
      ))}
      <p className="small muted center">사진을 눌러 🕵️동향 살피기 · 🗞️견제 · 🤝회유</p>
      {remarksOf(state).log.length > 0 && (
        <>
          <h4 className="cab-h">🎙️ 최근 발언</h4>
          {remarksOf(state)
            .log.slice(0, 10)
            .map((r) => (
              <p key={r.t + r.who} className="small">
                {r.echo ? '↪ ' : ''}
                {VOICE_ICON[r.who]} <b>{r.name ? `${r.who} ${r.name}` : r.who}</b> {r.text}
              </p>
            ))}
        </>
      )}
      {o.chiefRival && <p className="small warn">⚠️ {o.chiefRival}의 영향력이 {BLOCK_AT}을 넘었어요. 견제·회유로 낮춰야 전설의 지도자가 될 수 있어요.</p>}
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
  const start = (name: string, mini?: string) => {
    const why = canTrain(state, name);
    if (why) return setMsg(why);
    const tr = actions.applyWith((s) => {
      const ns = startTraining(s, name);
      return { state: ns, out: ns.officer.training };
    });
    if (!tr) return;
    setPendingPlan(trainingPlan(name, rank, tr.seed, mini));
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
            <p>훈련 일정은 실제 4시간마다 1개씩 차요(최대 {DRILL_MAX}개). 훈련은 직접 하는 3D 훈련이에요(3D 실전·사격장·3D 미니게임·배치 퍼즐).</p>
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
      <WeeklyCard state={state} onStart={start} />
      <div className="tlist">
        {TRAININGS.map((tr) => {
          const lock = rank < tr.rank;
          const runs = o.mastery?.[tr.name] ?? 0;
          const lv = masteryLevel(runs);
          const hot = tr.name === featured;
          const perk = (o.perfect[tr.name] ?? 0) >= PERK_AT;
          return (
            <button key={tr.name} className={`trow ${lock ? 'locked' : ''} ${hot ? 't-gold' : perk ? 't-green' : ''}`} onClick={() => setPick(tr.name)}>
              <span className="trow-ico"><TrainIcon name={tr.name} lock={lock} /></span>
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
          onStart={(mini) => {
            setPick(null);
            start(t.name, mini);
          }}
        />
      )}
      {practice && (
        <Modal title="전투 연습장" icon="🎮" onClose={() => setPractice(false)}>
          <p className="small muted">임무에 나오는 전투를 보상 없이 해 봐요.</p>
          {PRACTICE_GROUPS.map((g) => {
            const list = PRACTICE.map((x, i) => ({ x, i })).filter(({ x }) => x.group === g.id);
            if (!list.length) return null;
            return (
              <details key={g.id} className="prac-group">
                <summary>
                  <span className="prac-ico">{g.icon}</span>
                  <b>{g.name}</b>
                  <small className="muted">{g.text}</small>
                  <i className="prac-n">{list.length}</i>
                </summary>
                <div className="tiles c3">
                  {list.map(({ x, i }) => (
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
              </details>
            );
          })}
        </Modal>
      )}
    </>
  );
}

/** 11-26 안 5·6: 주간 합동 훈련(주마다 전장이 바뀜, 보상 ×3은 주에 한 번) · 병과 숙련(본 3D 전투 +2%씩) */
function WeeklyCard({ state, onStart }: { state: ScreenProps['state']; onStart: (name: string, mini?: string) => void }) {
  const o = state.officer;
  const rank = state.player.rankIndex;
  const wk = weeklyInfo(state.worldMs);
  const done = o.weekly3d === wk.week;
  const open = TRAININGS.filter((t) => rank >= t.rank).map((t) => t.name);
  const tr = weeklyTraining(state.worldMs, open);
  const units = Object.entries(o.unitXp ?? {}).sort((a, b) => b[1] - a[1]);
  return (
    <section className="card">
      <div className="d3-week">
        <span className="d3-week-ico">🎖️</span>
        <div className="d3-week-main">
          <b>주간 합동 훈련 · {wk.name}</b>
          <small>{wk.text}</small>
          <small className="muted">
            이번 주 {tr} 경험치 ×3 · {done ? '이번 주 보상 받음(다시 해도 보통 보상)' : `${Math.max(1, Math.ceil(weekLeftMs(state.worldMs) / 86400000))}일 뒤 바뀜`}
          </small>
        </div>
        <button className={done ? '' : 'gold'} onClick={() => onStart(tr, `w3:${weekOf(state.worldMs)}`)}>
          ▶ 출전
        </button>
      </div>
      <details style={{ marginTop: 6 }}>
        <summary className="small">🪖 병과 숙련 {units.length ? `· ${units.filter(([, v]) => unitLevel(v) > 0).length}개 병과 강화` : '· 3D 훈련에서 쓴 병과가 강해져요'}</summary>
        <p className="small muted">3D 훈련에서 별을 받으면 나간 병과에 숙련이 쌓여요. 단계마다 본 3D 전투·공성전에서 그 병과 공격·체력 +2%(최대 +10%).</p>
        {units.length > 0 && (
          <div className="d3-units">
            {units.map(([k, v]) => {
              const lv = unitLevel(v);
              return (
                <span key={k}>
                  {unitName(k)} {lv}단계
                  <b>{lv ? `+${unitBonusPct(v)}%` : `${v}/${UNIT_LV_AT[0]}`}</b>
                </span>
              );
            })}
          </div>
        )}
      </details>
    </section>
  );
}

function TrainModal({ name, state, featured, onClose, onStart }: { name: string; state: ScreenProps['state']; featured: boolean; onClose: () => void; onStart: (mini?: string) => void }) {
  const minis = minisFor(name);
  const three = threeFor(name);
  const [mini, setMini] = useState((minis.find((m) => m.easy) ?? minis.find((m) => m.fresh) ?? three[0] ?? minis[0])?.id);
  const o = state.officer;
  const rank = state.player.rankIndex;
  const t = TRAININGS.find((x) => x.name === name)!;
  const lock = rank < t.rank;
  const runs = o.mastery?.[name] ?? 0;
  const lv = masteryLevel(runs);
  const next = MASTERY_AT[lv];
  const why = lock ? `${RANKS[t.rank].name}부터 할 수 있어요` : canTrain(state, name);
  return (
    <Modal
      title={`${name} 훈련`}
      icon={<TrainIcon name={name} />}
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose}>닫기</button>
          <button className={featured ? 'gold' : 'primary'} disabled={!!why} onClick={() => onStart(mini)}>
            {why ?? (TEST_MODE.freeTraining ? '▶ 시작 (시험 중 · 일정 안 씀)' : '▶ 시작 (일정 1개)')}
          </button>
        </>
      }
    >
      <p>
        🪖 3D 훈련 {minis.length + three.length}개 중 고르기 · 계급이 오를수록 빨라지고 어려워져요
        {featured ? ' · 🔥 오늘 2배' : ''}
      </p>
      {(
        [
          ['👆 한 손가락 훈련', minis.filter((m) => m.easy).map((m) => ({ id: m.id, name: m.name, how: m.how, tag: `${m.easy} · ${easyLv(o.easyLv, m.id)}단계`, sub: easyStats(easyById(m.id)!).map((x) => `${STAT_ICON[x]}${x}`).join(' ') }))],
          ['✨ 새 훈련', minis.filter((m) => m.fresh).map((m) => ({ id: m.id, name: m.name, how: m.how, tag: FRAME_NAME[m.fresh!] }))],
          ['🧊 3D 미니게임', minis.filter((m) => !m.fresh && !m.easy).map((m) => ({ id: m.id, name: m.name, how: m.how, tag: '3D' }))],
          ['🪖 3D 실전 훈련', three.map((m) => ({ id: m.id, name: m.name, how: m.how, tag: m.tag }))],
        ] as const
      )
        .filter(([, list]) => list.length)
        .map(([head, list]) => (
          <div key={head}>
            <p className="mg-sec">{head}</p>
            <div className="mg-pick">
              {list.map((m) => (
                <button key={m.id} className={mini === m.id ? 'on' : ''} onClick={() => setMini(m.id)}>
                  <b>
                    {m.name}
                    {m.tag && <i className="mg-tag">{m.tag}</i>}
                  </b>
                  {'sub' in m && <small className="eg-sub">{m.sub}</small>}
                  <small>{m.how}</small>
                </button>
              ))}
            </div>
          </div>
        ))}
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
