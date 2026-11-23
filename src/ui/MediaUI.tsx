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
  canSummit,
  grantPetition,
  holdSummit,
  mediaOf,
  pressAnswerText,
  pressMult,
  questionById,
  startPress,
  summitChance,
  summitTargets,
  type Agenda,
} from '../game/media';
import { Card, fmt } from './common';
import { Help } from './kit';
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
          <p>실제 6시간마다 열 수 있어요. 지금 나라 상황(전쟁·세금·스캔들·야당·도시 불만)에 맞는 질문이 먼저 나와요.</p>
          <p>답에 따라 지지도·신뢰도·분야 점수(하루)·호감·야당 영향력이 바뀌어요. 정치 스탯과 문화홍보처가 좋은 효과를 키워요.</p>
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
          <p>국방예산으로 들어주면 그 도시 민심 +12, 사회 +2, 지지도 +1. 하루 안에 안 들어주면 그 도시 민심 −4.</p>
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
  const [msg, setMsg] = useState('');
  const why = to ? canSummit(state, to) : '나라를 고르세요';
  return (
    <Card
      title="정상회담"
      icon="🤝"
      right={
        <Help title="정상회담">
          <p>실제 하루에 한 번, 전쟁 중이 아닌 나라 정상과 만나요. 성공 확률은 호감·정치 스탯·외교부 힘으로 정해져요.</p>
          <p>성공: 호감 +12(평화 선언은 +16)·명성 +20·의제 효과. 실패: 호감 −4·지지도 −2.</p>
        </Help>
      }
    >
      <div className="sum-pick">
        <select value={to} onChange={(e) => setTo(e.target.value)}>
          {list.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} (호감 {Math.round(favorOf(state, c.id))} · 성공 {Math.round(summitChance(state, c.id) * 100)}%)
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
      <button className="gold wide" disabled={!!why} onClick={() => setMsg(actions.applyWith((s) => { const r = holdSummit(s, to, ag); return { state: r.state, out: r.text }; }) ?? '')}>
        🤝 {COUNTRIES.find((c) => c.id === to)?.name ?? ''} 정상회담
      </button>
      {why && state.worldMs < m.summitMs && <p className="small muted center">다음 회담까지 {timeLeft(m.summitMs - state.worldMs)}</p>}
      {msg && <p className="small sch-msg">{msg}</p>}
    </Card>
  );
}
