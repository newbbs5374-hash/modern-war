// 사회 → 언론·청원(기자회견 + 국민 청원), 외교 → 외교부(정상회담). 한 화면.
import { useState } from 'react';
import { CITIES } from '../data/cities';
import { COUNTRIES } from '../data/world';
import { favorOf } from '../game/civ';
import {
  AGENDAS,
  PET_KINDS,
  answerPress,
  canGrant,
  canPress,
  grantPetition,
  mediaOf,
  pressAnswerText,
  pressMult,
  questionById,
  startPress,
  summitTargets,
  type Agenda,
} from '../game/media';
import { Card, fmt } from './common';
import { Help, Modal } from './kit';
import { LEADERS } from '../data/leaders';
import { PersonFace } from './People';
import { sceneArt } from './scenes';
import { INVITE_APPROVAL, INVITE_COST, MINE, STAGES, TONES, TONE_INFO, VISIT_FAVOR, canTalk, finishTalk, inviteCost, talkWants, theirLine, type Grade, type Mode, type Tone } from '../game/summitTalk';
import { timeLeft } from './officerScreens';
import type { ScreenProps } from './screens';

export function PressPanel({ state, actions }: ScreenProps) {
  const m = mediaOf(state);
  const [said, setSaid] = useState<string[]>([]);
  const p = m.press;
  const wait = canPress(state);
  const q = p ? questionById(p.qs[p.i]) : null;
  return (
    <Card
      title="기자회견"
      icon="🎙️"
      right={
        <Help title="기자회견">
          <p>실제 6시간마다 열 수 있어요. 한 번에 질문 7~10개. 나라 상황(전쟁·세금·스캔들·야당·도시 불만) 질문과 평소 질문 50여 개가 섞여 나오고, 지난 회견에 나온 질문은 되도록 피해요.</p>
          <p>답에 따라 지지도·신뢰도·분야 점수(하루)·호감·야당 영향력이 바뀌어요. 정치 스탯과 문화홍보처가 좋은 효과를 키워요. 한 회견의 지지도 효과는 ±8, 분야 점수는 분야마다 ±10까지 쌓여요.</p>
        </Help>
      }
    >
      {p && q ? (
        <>
          <p className="small muted">
            질문 {p.i + 1}/{p.qs.length} · 좋은 효과 ×{pressMult(state).toFixed(2)}
          </p>
          <p className="press-q">🗞️ “{q.ask(state)}”</p>
          <div className="press-as">
            {q.answers(state).map((a, n) => (
              <button
                key={n}
                className="pw-act"
                onClick={() => {
                  const t = pressAnswerText(state, n);
                  setSaid((x) => [...x, t]);
                  actions.apply((s) => answerPress(s, n));
                }}
              >
                <span className="li-main">
                  <b>{a.text}</b>
                  <small className="muted">{a.sum}</small>
                </span>
              </button>
            ))}
          </div>
        </>
      ) : (
        <>
          <button className="gold wide" disabled={!!wait} onClick={() => (setSaid([]), actions.apply(startPress))}>
            🎙️ 기자회견 열기
          </button>
          {wait && <p className="small muted center">다음 회견까지 {timeLeft(m.pressMs - state.worldMs)}</p>}
        </>
      )}
      {said.length > 0 && (
        <ul className="kv-list">
          {said.map((t, i) => (
            <li key={i}>
              <span>{t}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export function PetitionPanel({ state, actions }: ScreenProps) {
  const m = mediaOf(state);
  return (
    <Card
      title={`국민 청원 ${m.petitions.length}`}
      icon="📝"
      right={
        <Help title="국민 청원">
          <p>실제 4시간마다 민심 낮은 도시에서 청원이 올라와요(최대 3개).</p>
          <p>나라 예산으로 들어주면 그 도시 민심 +12, 사회 +2, 지지도 +1. 하루 안에 안 들어주면 그 도시 민심 −4.</p>
        </Help>
      }
    >
      {m.petitions.length ? (
        <div className="cab-list">
          {m.petitions.map((p) => {
            const k = PET_KINDS[p.kind];
            const why = canGrant(state, p.id);
            return (
              <div key={p.id} className="cab-row pet-row">
                <span className="cab-face" style={{ width: 34, height: 34, fontSize: 20 }}>
                  {k.icon}
                </span>
                <span className="cab-main">
                  <b>
                    {CITIES.find((c) => c.id === p.city)?.name} · {k.name}
                  </b>
                  <small>
                    “{k.text}” · ✍️{fmt(p.signs)}명 · ⏳{timeLeft(p.endMs - state.worldMs)}
                  </small>
                </span>
                <button className="gold" disabled={!!why} onClick={() => actions.apply((s) => grantPetition(s, p.id))}>
                  들어주기
                  <small>💵{fmt(p.cost)}</small>
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="empty">지금 올라온 청원이 없어요. 4시간마다 새로 와요.</p>
      )}
      <p className="small muted">지금까지 들어준 청원 {m.petDone}개</p>
    </Card>
  );
}

export function SummitPanel({ state, actions }: ScreenProps) {
  const m = mediaOf(state);
  const list = summitTargets(state);
  const [to, setTo] = useState<string>(list[0]?.id ?? '');
  const [ag, setAg] = useState<Agenda>('trade');
  const [mode, setMode] = useState<Mode>('visit');
  const [msg, setMsg] = useState('');
  const [talk, setTalk] = useState<Tone[] | null>(null);
  const [wants, setWants] = useState<Tone[]>([]);
  const [done, setDone] = useState<{ text: string; grade: Grade } | null>(null);
  const why = to ? canTalk(state, to, mode) : '나라를 고르세요';
  const name = COUNTRIES.find((c) => c.id === to)?.name ?? '';
  const art = sceneArt('summit', false);
  const pick = (tone: Tone) => {
    const picks = [...(talk ?? []), tone];
    if (picks.length < STAGES.length) return setTalk(picks);
    const r = actions.applyWith((s) => {
      const f = finishTalk(s, to, ag, mode, picks, wants);
      return { state: f.state, out: f };
    });
    setTalk(picks);
    if (r) {
      setDone({ text: r.text, grade: r.grade });
      setMsg(r.text);
    }
  };
  const close = () => {
    setTalk(null);
    setDone(null);
  };
  const step = talk?.length ?? 0;
  return (
    <Card
      title="정상회담 · 국빈 방문"
      icon="🤝"
      right={
        <Help title="정상회담">
          <p>실제 하루에 한 번, 전쟁 중이 아닌 나라 정상과 3단계(인사 · 의제 · 마무리)로 이야기해요.</p>
          <p>단계마다 상대 정상의 한마디를 읽고 어울리는 태도를 고르세요. 딱 맞으면 2점, 「따뜻하게」는 틀려도 1점이에요. 평소 사이가 좋으면(성공 70% 이상) 1점을 더 받아요.</p>
          <p>6점 이상 큰 협정(호감·명성 1.5배, 지지도 +3 사흘) · 4~5점 합의(호감 +12·명성 +20·의제 효과) · 3점 이하 결렬(호감 −4·지지도 −2).</p>
          <p>국빈 초청은 하루 예산의 {Math.round(INVITE_COST * 100)}%가 들지만 1점을 더 받고 지지도 +{INVITE_APPROVAL}. 찾아가면 돈이 안 들고 호감 +{VISIT_FAVOR}.</p>
        </Help>
      }
    >
      <div className="sum-pick">
        <select value={to} onChange={(e) => setTo(e.target.value)}>
          {list.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} (호감 {Math.round(favorOf(state, c.id))} · {LEADERS[c.id]?.personality})
            </option>
          ))}
        </select>
      </div>
      <div className="sum-ags">
        {(Object.keys(AGENDAS) as Agenda[]).map((k) => (
          <button key={k} className={`pw-act small-act ${ag === k ? 'on' : ''}`} onClick={() => setAg(k)}>
            <span className="pw-act-ico">{AGENDAS[k].icon}</span>
            <span className="li-main">
              <b>{AGENDAS[k].name}</b>
            </span>
          </button>
        ))}
      </div>
      <p className="small muted">{AGENDAS[ag].text}</p>
      <div className="sum-modes">
        <button className={mode === 'visit' ? 'on' : ''} onClick={() => setMode('visit')}>
          ✈️ 찾아가기 <small>무료 · 호감 +{VISIT_FAVOR}</small>
        </button>
        <button className={mode === 'invite' ? 'on' : ''} onClick={() => setMode('invite')}>
          🎌 국빈 초청 <small>💰{fmt(inviteCost(state))} · 점수 +1</small>
        </button>
      </div>
      <button className="gold wide" disabled={!!why} onClick={() => { setDone(null); setWants(talkWants(state, to)); setTalk([]); }}>
        🤝 {name} 정상과 만나기
      </button>
      {why && state.worldMs < m.summitMs ? <p className="small muted center">다음 회담까지 {timeLeft(m.summitMs - state.worldMs)}</p> : why && to ? <p className="small muted center">{why}</p> : null}
      {msg && <p className="small sch-msg">{msg}</p>}
      {talk && (
        <Modal title={`${name} 정상회담`} icon="🤝" onClose={close}>
          <div className="sum-talk">
            <div className="sum-scene" style={art ? { backgroundImage: `url(${art})` } : undefined}>
              <span className="sum-face">
                <PersonFace who={{ kind: 'leader', country: to }} keys={[`leader-${to}`]} fallback="👤" />
              </span>
              <span className="sum-who">
                <b>{LEADERS[to]?.name}</b>
                <small>
                  {name} {LEADERS[to]?.title} · {LEADERS[to]?.personality}
                </small>
              </span>
            </div>
            <div className="sum-steps">
              {STAGES.map((n, i) => (
                <span key={n} className={i < step ? 'done' : i === step && !done ? 'on' : ''}>
                  {i + 1}. {n}
                  {talk[i] && <em>{TONE_INFO[talk[i]].icon}</em>}
                </span>
              ))}
            </div>
            {done ? (
              <>
                <p className={`sum-result sum-${done.grade}`}>{done.grade === 'big' ? '📜 큰 협정을 맺었어요!' : done.grade === 'ok' ? '🤝 합의에 이르렀어요.' : '😶 회담이 결렬됐어요.'}</p>
                <p className="small">{done.text}</p>
                <button className="gold wide" onClick={close}>
                  확인
                </button>
              </>
            ) : (
              <>
                <p className="sum-line">“{theirLine(wants[step], step)}”</p>
                {TONES.map((tone) => (
                  <button key={tone} className="wide crisis-opt" onClick={() => pick(tone)}>
                    <b>
                      {TONE_INFO[tone].icon} {TONE_INFO[tone].name}
                    </b>
                    <small className="muted">{MINE[step][tone]}</small>
                  </button>
                ))}
              </>
            )}
          </div>
        </Modal>
      )}
    </Card>
  );
}
