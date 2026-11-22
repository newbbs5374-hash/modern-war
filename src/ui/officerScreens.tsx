// 3단계 화면: 장교(진급·스탯·부관·장군·라이벌), 훈련(간이 훈련), 임무 카드.
import { useEffect, useState } from 'react';
import { TRAININGS } from '../data/catalog';
import { MISSION_KINDS, STAT_IDS, aideSlots, generalSlots, statCap } from '../data/officers';
import { RANKS } from '../data/ranks';
import { STAT_GROUPS } from '../data/catalog';
import {
  COMMAND_RANK,
  DRILL_MAX,
  RECRUIT_COST,
  TRAINING_STATS,
  boardNow,
  claimMission,
  dismissGeneral,
  drillsNow,
  generalDefense,
  missionChance,
  myRenown,
  promoteAide,
  promotionCheck,
  recruitGeneral,
  rivalsView,
  startExam,
  startMission,
} from '../game/officer';
import { train } from '../game/officer';
import { Card, fmt, rankLock } from './common';
import type { ScreenProps } from './screens';

const HOUR = 3600e3;

export function timeLeft(ms: number): string {
  if (ms <= 0) return '끝남';
  const m = Math.ceil(ms / 60000);
  return m >= 60 ? `${Math.floor(m / 60)}시간 ${m % 60}분` : `${m}분`;
}

function Bar({ have, need }: { have: number; need: number }) {
  return (
    <span className="bar">
      <span className="bar-fill" style={{ width: `${Math.min(100, (have / Math.max(1, need)) * 100)}%` }} />
    </span>
  );
}

/* ───────── 임무 카드(작전 화면 맨 위, 본부에서도 씀) ───────── */
export function MissionCard({ state, actions }: ScreenProps) {
  const o = state.officer;
  const [msg, setMsg] = useState('');
  // 게시판이 비었거나 오래되면 새로 만듦
  useEffect(() => {
    actions.apply((s) => boardNow(s).state);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [o.active === null]);
  const a = o.active;
  return (
    <Card title="임무" right={<small className="muted">공훈 {fmt(o.merit)}</small>}>
      {a ? (
        <div className="mission active">
          <b>{a.title}</b>
          <small className="muted">
            {a.exam ? '진급 심사' : MISSION_KINDS[a.kind].desc} · 성공 확률 {Math.round(missionChance(state, a) * 100)}%
          </small>
          <Bar have={state.worldMs - a.startMs} need={a.endMs - a.startMs} />
          {state.worldMs >= a.endMs ? (
            <button
              className="primary"
              onClick={() => setMsg(actions.applyWith((s) => {
                const r = claimMission(s);
                return { state: r.state, out: r.text ?? '' };
              }) ?? '')}
            >
              결과 받기
            </button>
          ) : (
            <small>남은 시간 {timeLeft(a.endMs - state.worldMs)} (꺼 두어도 진행돼요)</small>
          )}
        </div>
      ) : (
        <>
          <p className="small muted">하나를 고르면 실제 시간으로 진행돼요. 결과는 스탯·부관으로 정해져요(4단계에서 직접 싸우기로 바뀜).</p>
          {o.board.map((m) => (
            <div key={m.id} className="mission">
              <div className="row">
                <b>
                  <span className="tag">{m.kind}</span> {m.title}
                </b>
                <small>{m.hours}시간</small>
              </div>
              <small className="muted">
                {MISSION_KINDS[m.kind].desc} · 쓰는 스탯 {MISSION_KINDS[m.kind].stats.join('·')} · {m.difficulty < 0.95 ? "쉬움" : m.difficulty < 1.15 ? "보통" : "어려움"}
              </small>
              <div className="row">
                <small>성공 확률 {Math.round(missionChance(state, m) * 100)}%</small>
                <button onClick={() => actions.apply((s) => startMission(s, m.id))}>출발</button>
              </div>
            </div>
          ))}
          {o.board.length === 0 && <p className="small muted">지금은 맡을 임무가 없어요.</p>}
        </>
      )}
      {msg && <p className="small result">{msg}</p>}
    </Card>
  );
}

/* ───────── 장교 ───────── */
export function OfficerScreen(props: ScreenProps) {
  const { state, actions } = props;
  const o = state.officer;
  const r = state.player.rankIndex;
  const cap = statCap(r);
  const pc = promotionCheck(state);
  const rivals = rivalsView(state);
  const mine = myRenown(o);
  const examRunning = o.active?.exam;
  return (
    <>
      {o.dismissDeadlineMs !== null && (
        <div className="alert">
          ⚠️ 해임 경고: {timeLeft(o.dismissDeadlineMs - state.worldMs)} 안에 지도자 신뢰도를 40 넘게 올려야 해요. 임무에
          성공하면 올라요.
        </div>
      )}
      <Card title={`${RANKS[r].name} ${state.player.name}`} right={<span className="muted small">{RANKS[r].unit}</span>}>
        <div className="ranks">
          {RANKS.map((x, i) => (
            <span key={x.name} className={i === r ? 'now' : i < r ? 'done' : ''}>
              {x.name}
            </span>
          ))}
        </div>
        <div className="kv small">
          <span>명성</span>
          <b>{fmt(o.fame)}</b>
          <span>지도자 신뢰도</span>
          <b>
            {Math.round(o.trust)} / 100 {r >= COMMAND_RANK && o.trust < 40 ? '⚠️' : ''}
          </b>
          <span>정보 점수</span>
          <b>{fmt(o.intel)}</b>
          <span>평판(총사령관 경쟁)</span>
          <b>{fmt(mine)}</b>
        </div>
      </Card>

      {r < RANKS.length - 1 && (
        <Card title={`진급: ${RANKS[r + 1].name}`}>
          {pc.lines.map((l) => (
            <div key={l.label} className="prog">
              <small>
                {l.ok ? '✓' : '○'} {l.label} {fmt(l.have)} / {fmt(l.need)}
              </small>
              <Bar have={l.have} need={l.need} />
            </div>
          ))}
          {examRunning ? (
            <p className="small">진급 심사 중이에요. 작전 화면에서 결과를 받아요.</p>
          ) : (
            <button className="primary" disabled={!pc.ready} onClick={() => actions.apply(startExam)}>
              {pc.ready ? '진급 심사 작전 시작 (2시간)' : pc.why}
            </button>
          )}
        </Card>
      )}

      <Card title="스탯 9개" right={<small className="muted">이번 계급 상한 {cap}</small>}>
        {STAT_GROUPS.map((g) => (
          <div key={g.name} className="stat-group">
            <small className="muted">
              {g.name}
              {g.note ? ` · ${g.note}` : ''}
            </small>
            {g.stats.map((st) => {
              const v = o.stats[st.name as (typeof STAT_IDS)[number]];
              return (
                <div key={st.name} className="stat-row">
                  <span>
                    <b>{st.name}</b> <small className="muted">{st.does}</small>
                  </span>
                  <span className="stat-val">{Math.floor(v)}</span>
                  <Bar have={v} need={cap} />
                </div>
              );
            })}
          </div>
        ))}
      </Card>

      <Card title={`부관 ${o.aides.length} / ${aideSlots(r)}`}>
        {aideSlots(r) === 0 && <p className="small muted">중위가 되면 첫 부관이 합류해요.</p>}
        {o.aides.map((a) => (
          <div key={a.id} className="list-row">
            <span>
              <b>{a.name}</b> <span className="tag">{a.specialty}</span>{' '}
              <small className="muted">
                Lv.{a.level} · 경험 {a.exp}/{a.level * 100} · 신뢰 {a.bond}
              </small>
            </span>
            {generalSlots(r) > o.generals.length && a.level >= 3 && (
              <button onClick={() => actions.apply((s) => promoteAide(s, a.id))}>장군 승격</button>
            )}
          </div>
        ))}
        {o.aides.length > 0 && <p className="small muted">부관은 임무에 같이 나가 성공 확률을 올려요. 특기가 맞으면 더 많이.</p>}
      </Card>

      <Card
        title={`장군 ${o.generals.length} / ${generalSlots(r)}`}
        right={<small className="muted">내 나라 도시 방어 +{Math.round((generalDefense(o) - 1) * 100)}%</small>}
      >
        {generalSlots(r) === 0 ? (
          <p className="small muted">준장이 되면 장군을 둘 수 있어요(부관 Lv.3 승격 또는 영입).</p>
        ) : (
          <>
            {o.generals.map((g) => (
              <div key={g.id} className="list-row">
                <span>
                  <b>{g.name}</b> <span className="tag">{g.field}</span> <span className="tag">{g.style}</span>{' '}
                  <small className="muted">
                    능력 {g.skill} · 충성 {Math.round(g.loyalty)} · {g.from}
                  </small>
                </span>
                <button onClick={() => actions.apply((s) => dismissGeneral(s, g.id))}>보내기</button>
              </div>
            ))}
            <button
              disabled={o.generals.length >= generalSlots(r) || state.player.salary < RECRUIT_COST}
              onClick={() => actions.apply(recruitGeneral)}
            >
              같은 나라 장군 영입 (봉급 {fmt(RECRUIT_COST)})
            </button>
          </>
        )}
      </Card>

      <Card title="라이벌 장교 3명">
        {rivals.map((x) => (
          <div key={x.name} className="list-row">
            <span>
              <b>{x.name}</b> <small className="muted">평판 {fmt(x.renown)}</small>
            </span>
            <span className={x.rank > r ? 'tag war' : 'tag'}>{RANKS[x.rank].name}</span>
          </div>
        ))}
        {o.chiefRival && <p className="small warn">총사령관 후보 1순위: {o.chiefRival}. 평판으로 앞질러야 해요.</p>}
        <p className="small muted">대장에서 총사령관이 되려면 라이벌보다 평판(공훈 + 명성 + 신뢰도)이 높아야 해요.</p>
      </Card>
    </>
  );
}

/* ───────── 훈련(간이) ───────── */
export function TrainingScreen({ state, actions }: ScreenProps) {
  const o = state.officer;
  const d = drillsNow(o, state.worldMs);
  const [msg, setMsg] = useState('');
  const today = o.trainCounts;
  return (
    <>
      <Card title={`훈련 일정 ${d.count} / ${DRILL_MAX}`} right={<small className="muted">훈련 별 {o.stars}</small>}>
        <p className="small muted">
          {d.count < DRILL_MAX ? `다음 1개까지 ${timeLeft(d.nextInMs)}. ` : ''}실제 4시간마다 1개 차요. 같은 훈련은 하루
          3번째부터 효과 절반. 지금은 별이 스탯으로 정해지는 간이 훈련이고, 5단계에서 미니게임으로 바뀌어요.
        </p>
        {msg && <p className="small result">{msg}</p>}
      </Card>
      <div className="grid2">
        {TRAININGS.map((t) => {
          const lock = rankLock(state, t.rank);
          const n = today[t.name] ?? 0;
          return (
            <button
              key={t.name}
              className={`tile ${lock ? 'locked' : ''}`}
              disabled={!!lock || d.count <= 0}
              onClick={() => {
                const res = actions.applyWith((s) => {
                  const r = train(s, t.name);
                  return { state: r.state, out: r.result };
                });
                if (!res) return;
                setMsg(
                  res.ok
                    ? `${t.name} 훈련 ${'★'.repeat(res.stars)}${'☆'.repeat(3 - res.stars)} · ${Object.entries(res.gains)
                        .map(([k, v]) => `${k} +${v}`)
                        .join(' · ')}`
                    : res.why,
                );
              }}
            >
              <b>
                {lock ? '🔒 ' : ''}
                {t.name}
              </b>
              <small>{t.frame}</small>
              <small className="muted">↑ {TRAINING_STATS[t.name].join('·')}</small>
              <small className="muted">{lock ?? (n ? `오늘 ${n}번` : '바로 하기')}</small>
            </button>
          );
        })}
      </div>
    </>
  );
}

export { HOUR };
