// 장관·장군·부관 건의함 · 도시 개발 계획 · 인물 💬 대화 탭(11-25 대장 요청 1번)
import { useEffect, useRef, useState } from 'react';
import type { MinistryId } from '../data/cabinet';
import { chatWhy, talk, type ChatLine, type ChatTopic } from '../game/chat';
import { acceptProposal, actCost, actWhy, askProposal, canAsk, dropPlan, propOf, rejectProposal, setTrusted, speakerOf, type Proposal } from '../game/proposals';
import type { GameState } from '../game/state';
import type { GameActions } from './screens';
import { timeLeft } from './officerScreens';

type Acts = Pick<GameActions, 'apply' | 'applyWith'>;

/** 건의 한 장: 누가 · 무엇을 · 왜 · 값 · 받아들이기/미루기 */
export function ProposalCard({ state, actions, pr, onDone, hideWho }: { state: GameState; actions: Acts; pr: Proposal; onDone?: (t: string) => void; hideWho?: boolean }) {
  const w = actWhy(state, pr.act);
  return (
    <div className="prop-card">
      {!hideWho && (
        <small className="prop-who">
          📨 <b>{pr.whoName}</b> {pr.role} · {timeLeft(pr.untilMs - state.worldMs)} 남음
        </small>
      )}
      <b className="prop-text">{pr.text}</b>
      <small className="muted">{pr.why}</small>
      <small className={w.why ? (w.wait ? 'gold-t' : 'warn') : 'muted'}>
        {actCost(state, pr.act)}
        {w.why ? ` · ${w.wait ? '⏳ 모자라면 계획에 올려 두고 알아서 지어요' : `⚠️ ${w.why}`}` : ' · 바로 지을 수 있어요'}
      </small>
      <span className="prop-btns">
        <button
          className="gold"
          disabled={!!w.why && !w.wait}
          onClick={() => {
            const t = actions.applyWith((s) => {
              const r = acceptProposal(s, pr.id);
              return { state: r.state, out: r.text };
            });
            if (t) onDone?.(t);
          }}
        >
          ✅ 받아들이기
        </button>
        <button onClick={() => actions.apply((s) => rejectProposal(s, pr.id))}>✖ 미루기</button>
      </span>
    </div>
  );
}

/** 부처 화면 위 건의함(그 부처 묶음 + 국방이면 장군·부관) */
export function ProposalBox({ state, actions, mins }: { state: GameState; actions: Acts; mins: MinistryId[] }) {
  const [msg, setMsg] = useState('');
  const [fold, setFold] = useState(false);
  const [all, setAll] = useState(false);
  const p = propOf(state);
  const list = p.list.filter((x) => mins.includes(x.min));
  const plans = p.plans.filter((x) => {
    const sp = speakerOf(state, x.who);
    return !sp || mins.includes(sp.min);
  });
  if (!list.length && !plans.length && !msg) return null;
  return (
    <div className="prop-box">
      <button className="prop-head" onClick={() => setFold(!fold)}>
        <b>📨 건의함 {list.length}건</b>
        {plans.length > 0 && <small> · 🏗️ 개발 계획 {plans.length}건</small>}
        <small className="muted"> {fold ? '▾' : '▴'}</small>
      </button>
      {!fold && (
        <>
          {(all ? list : list.slice(0, 2)).map((pr) => (
            <ProposalCard key={pr.id} state={state} actions={actions} pr={pr} onDone={setMsg} />
          ))}
          {list.length > 2 && (
            <button className="wide" onClick={() => setAll(!all)}>
              {all ? '접기 ▴' : `건의 ${list.length - 2}건 더 보기 ▾`}
            </button>
          )}
          {plans.length > 0 && <PlanList state={state} actions={actions} ids={plans.map((x) => x.id)} />}
          {msg && <p className="small result">{msg}</p>}
        </>
      )}
    </div>
  );
}

/** 도시 개발 계획(받아들였지만 돈·자원을 기다리는 것) */
export function PlanList({ state, actions, ids }: { state: GameState; actions: Acts; ids?: number[] }) {
  const plans = propOf(state).plans.filter((x) => !ids || ids.includes(x.id));
  if (!plans.length) return null;
  return (
    <div className="prop-plans">
      <small className="muted">🏗️ 도시 개발 계획 · 돈·자원이 모이면 도시가 알아서 지어요</small>
      {plans.map((x) => {
        const w = actWhy(state, x.act);
        return (
          <div key={x.id} className="prop-plan">
            <span className="li-main">
              <small>
                <b>{x.title.replace(/ 합니다$/, '')}</b> · {x.whoName} 건의
              </small>
              <small className="muted">
                {actCost(state, x.act)} · {w.why ? `⏳ ${w.why}` : '곧 시작'}
              </small>
            </span>
            <button className="small-btn" onClick={() => actions.apply((s) => dropPlan(s, x.id))} aria-label="계획에서 빼기">
              ✕
            </button>
          </div>
        );
      })}
    </div>
  );
}

const TOPICS: Array<{
  id: ChatTopic | 'ask';
  icon: string;
  name: string;
  text: string;
}> = [
  { id: 'hello', icon: '👋', name: '요즘 어때요?', text: '근황·업무 보고' },
  {
    id: 'ask',
    icon: '💡',
    name: '건의할 것 있나요?',
    text: '발전 방안을 바로 들음',
  },
  {
    id: 'praise',
    icon: '👏',
    name: '칭찬하기',
    text: '충성 + · 6시간에 한 번',
  },
  {
    id: 'story',
    icon: '☕',
    name: '사적인 이야기',
    text: '충성 + · 하루 한 번 · 믿음이 깊으면 속마음까지',
  },
  {
    id: 'others',
    icon: '🗣️',
    name: '다른 사람은 어때요?',
    text: '동료 평·다른 건의 의견',
  },
];

/** 인물 창 💬 대화 탭. key = 'p:<번호>' · 'g:<번호>' · 'a:<번호>' */
export function TalkPanel({ state, actions, who }: { state: GameState; actions: Acts; who: string }) {
  const [lines, setLines] = useState<ChatLine[]>([]);
  const [msg, setMsg] = useState('');
  const logRef = useRef<HTMLDivElement>(null);
  // 새 말이 오면 맨 아래로(값을 돌려주지 않게 중괄호)
  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines.length]);
  const sp = speakerOf(state, who);
  if (!sp) return <p className="small muted">자리에 앉은 사람(장관·차관급 참모·청장·장군·부관)과 대화할 수 있어요. 먼저 자리를 맡겨 주세요.</p>;
  const p = propOf(state);
  const mine = p.list.filter((x) => x.who === who);
  const trusted = p.trusted.includes(who);
  const say = (topic: ChatTopic | 'ask') => {
    setMsg('');
    if (topic === 'ask') {
      const why = canAsk(state, who);
      if (why) {
        setLines((l) =>
          [
            ...l,
            { me: true, text: '건의할 것 있나요?' },
            {
              text: why === '이미 올린 건의가 있어요' ? '아래 올린 건의부터 봐 주십시오.' : `방금 말씀드렸습니다. (${why})`,
            },
          ].slice(-14),
        );
        return;
      }
      const pr = actions.applyWith((s) => {
        const r = askProposal(s, who);
        return { state: r.state, out: r.prop };
      });
      setLines((l) =>
        [
          ...l,
          { me: true, text: '건의할 것 있나요?' },
          {
            text: pr ? `${pr.text} ${pr.why}` : '지금은 특별히 없습니다. 상황이 바뀌면 바로 보고드리겠습니다.',
          },
        ].slice(-14),
      );
      return;
    }
    const out = actions.applyWith((s) => {
      const r = talk(s, who, topic);
      return { state: r.state, out: r.lines };
    });
    if (out) setLines((l) => [...l, ...out].slice(-14));
  };
  return (
    <div className="talk">
      <div className="talk-log" ref={logRef}>
        {!lines.length && (
          <p className="small muted center">
            아래에서 이야기할 거리를 골라 보세요. {sp.name} {sp.role} · 충성 {Math.round(sp.loyalty)}
          </p>
        )}
        {lines.map((l, i) => (
          <p key={i} className={`talk-line ${l.me ? 'me' : ''}`}>
            {l.text}
          </p>
        ))}
      </div>
      <div className="pw-acts talk-topics">
        {TOPICS.map((t) => {
          const wait = t.id === 'ask' ? null : chatWhy(state, who, t.id);
          return (
            <button key={t.id} className="pw-act" onClick={() => say(t.id)}>
              <span className="pw-act-ico">{t.icon}</span>
              <span className="li-main">
                <b>{t.name}</b>
                <small className={wait ? 'muted' : ''}>{wait ? `${wait} 다시` : t.text}</small>
              </span>
            </button>
          );
        })}
      </div>
      {mine.length > 0 && <h4 className="cab-h">📨 올린 건의</h4>}
      {mine.map((pr) => (
        <ProposalCard key={pr.id} state={state} actions={actions} pr={pr} onDone={setMsg} hideWho />
      ))}
      {msg && <p className="small result">{msg}</p>}
      <label className="talk-trust">
        <input type="checkbox" checked={trusted} onChange={(e) => actions.apply((s) => setTrusted(s, who, e.target.checked))} />
        <span>
          <b>🤝 알아서 하게 맡기기</b>
          <small className="muted"> — {sp.name}의 건의를 묻지 않고 바로 받아들여요(돈이 모자라면 개발 계획에 올림).</small>
        </span>
      </label>
    </div>
  );
}
