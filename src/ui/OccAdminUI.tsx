// 11-27 점령지 관리청 화면: 도시 창 안 상자 · 보고 화면 카드
import { useState } from 'react';
import { cityById } from '../data/cities';
import { LOOK } from '../data/names';
import type { GameState } from '../game/state';
import {
  CAP_EARLY, CAP_NORMAL, EARLY_HOURS, TEAMS_MAX, addTeam, adminCities, approveAll, approveProp, canAddTeam, canApprove, capOf, effText, isEarly,
  occAdminOf, occKind, propCost, propsOfCity, rejectProp, teamCost, teamName, teamOf, type OccProp, type OccTeam,
} from '../game/occAdmin';
import { countryFaceUrl } from './Portrait';
import { Card } from './common';

const H = 3600e3;
type Apply = (f: (s: GameState) => GameState) => void;
const won = (n: number) => n.toLocaleString('ko-KR');
const hrs = (ms: number) => {
  const h = Math.max(0, Math.round(ms / H));
  return h >= 48 ? `${Math.floor(h / 24)}일` : `${h}시간`;
};

function Face({ state, p, size = 40 }: { state: GameState; p: { sex: 'm' | 'f'; age: number; face: number }; size?: number }) {
  const c = state.player.countryId;
  const url = countryFaceUrl({ country: c, sex: p.sex, age: p.age, id: p.face }, LOOK[c] ?? 'we');
  return (
    <span className="cab-face" style={{ width: size, height: size, fontSize: size * 0.5, flex: 'none' }}>
      {url ? <img className="face-img" src={url} alt="" draggable={false} /> : '🧑‍💼'}
    </span>
  );
}

function PropRow({ state, p, apply, onMsg, showCity }: { state: GameState; p: OccProp; apply: Apply; onMsg: (t: string) => void; showCity?: boolean }) {
  const k = occKind(p.kind);
  const why = canApprove(state, p.id);
  const cost = propCost(state, p);
  return (
    <div className="oa-prop">
      <span className="oa-ico">{k.icon}</span>
      <div className="li-main">
        <b>
          {showCity && <span className="muted">{cityById(p.city).name} · </span>}
          {k.name}
        </b>
        <small>"{k.say}"</small>
        <small className="oa-eff">
          {effText(k)} · 💰{won(cost)} · ⏱ {hrs(p.untilMs - state.worldMs)}
        </small>
      </div>
      <div className="oa-btns">
        <button
          className="primary"
          disabled={!!why}
          title={why ?? ''}
          onClick={() => {
            let t = '';
            apply((s) => {
              const r = approveProp(s, p.id);
              t = r.text;
              return r.state;
            });
            onMsg(t);
          }}
        >
          승인
        </button>
        <button onClick={() => apply((s) => rejectProp(s, p.id))}>미루기</button>
      </div>
    </div>
  );
}

/** 도시 창 안: 이 도시를 맡은 관리단과 건의 */
export function OccAdminCityBox({ state, id, apply }: { state: GameState; id: string; apply: Apply }) {
  const [msg, setMsg] = useState('');
  const hub = cityById(id).hub;
  if (!adminCities(state).includes(hub)) return null;
  const t = teamOf(state, id);
  const list = propsOfCity(state, id);
  const early = isEarly(state, id);
  return (
    <div className="oa-box">
      <b className="small">🏢 점령지 관리청 {t ? `· ${teamName(t)}` : ''}</b>
      {t ? (
        <div className="oa-team">
          <Face state={state} p={t} />
          <div>
            <b>
              단장 {t.name} <small className="muted">{t.age}세</small>
            </b>
            <small>
              시·도지사가 생기기(편입) 전까지 이 도시를 맡아요 · 건의 {list.length}/{capOf(state, id)}
              {early ? ` · 점령 직후라 건의가 많아요(${EARLY_HOURS}시간)` : ''}
            </small>
          </div>
        </div>
      ) : (
        <p className="small warn">관리단이 모두 다른 도시를 맡고 있어요. 보고 화면에서 관리단을 늘리거나, 다른 도시가 편입되면 이리 와요.</p>
      )}
      {list.map((p) => (
        <PropRow key={p.id} state={state} p={p} apply={apply} onMsg={setMsg} />
      ))}
      {t && !list.length && <p className="small muted">지금 올라온 건의가 없어요. 곧 새 방안을 올려요.</p>}
      {list.length > 1 && (
        <button
          className="gold wide"
          onClick={() => {
            let n = 0;
            apply((s) => {
              const r = approveAll(s, id);
              n = r.n;
              return r.state;
            });
            setMsg(n ? `✅ ${n}건 모두 승인했습니다.` : '지금 승인할 수 있는 건의가 없어요.');
          }}
        >
          ✅ 이 도시 건의 모두 승인
        </button>
      )}
      {msg && <p className="small result">{msg}</p>}
    </div>
  );
}

function teamLine(state: GameState, t: OccTeam): string {
  if (!t.city) return `쉬는 중 · ${hrs(state.worldMs - t.since)}째 · 점령하면 바로 출동`;
  return `${cityById(t.city).name} 관리 중 · ${hrs(state.worldMs - t.since)}째 · 건의 ${propsOfCity(state, t.city).length}건`;
}

/** 보고 화면: 관리청 전체(관리단·모든 건의) */
export function OccAdminCard({ state, apply }: { state: GameState; apply: Apply }) {
  const [msg, setMsg] = useState('');
  const want = adminCities(state);
  if (!want.length && !state.occAdmin) return null;
  const a = occAdminOf(state);
  const waiting = want.filter((c) => !a.teams.some((t) => t.city === c));
  const addWhy = canAddTeam(state);
  return (
    <Card
      title={`점령지 관리청 · 건의 ${a.list.length}건`}
      icon="🏢"
      help={
        <>
          <p>편입 전 점령 도시는 시·도지사가 없어서 관리청의 관리단이 맡아요. 관리단은 그 도시 형편(군정·민정·전쟁 피해)에 맞는 내정·정상화 방안을 수시로 올리고, 대장님이 승인하면 나라 예산으로 바로 시행해요.</p>
          <p>
            평소에는 도시마다 {CAP_NORMAL}건까지, 점령 직후 {EARLY_HOURS}시간은 {CAP_EARLY}건까지 더 자주 올라와요. 도시가 편입(정상화)되면 시·도지사에게 넘기고 관리단은 다른 점령 도시로 옮기거나 쉬어요.
          </p>
        </>
      }
      right={
        a.list.length > 1 ? (
          <button
            className="gold small-btn"
            onClick={() => {
              let n = 0;
              apply((s) => {
                const r = approveAll(s);
                n = r.n;
                return r.state;
              });
              setMsg(n ? `✅ ${n}건 모두 승인했습니다.` : '지금 승인할 수 있는 건의가 없어요.');
            }}
          >
            ✅ 모두 승인
          </button>
        ) : undefined
      }
    >
      <div className="oa-team">
        <Face state={state} p={a.chief} size={46} />
        <div>
          <b>
            청장 {a.chief.name} <small className="muted">{a.chief.age}세</small>
          </b>
          <small>
            관리 중 {want.length - waiting.length}곳 · 정상화해 넘긴 도시 {a.handed}곳 · 승인 {a.yes} · 미룸 {a.no}
          </small>
        </div>
      </div>
      <div className="oa-teams">
        {a.teams.map((t) => (
          <div key={t.id} className={`oa-team small ${t.city ? 'on' : 'off'}`}>
            <Face state={state} p={t} size={32} />
            <div>
              <b>
                {teamName(t)} · {t.name} <small className="muted">{t.age}세</small>
              </b>
              <small>{teamLine(state, t)}</small>
            </div>
          </div>
        ))}
      </div>
      {waiting.length > 0 && <p className="small warn">관리단을 기다리는 점령 도시: {waiting.map((c) => cityById(c).name).join(', ')}</p>}
      <button className="wide" disabled={!!addWhy} title={addWhy ?? ''} onClick={() => apply((s) => addTeam(s))}>
        ➕ 관리단 늘리기 ({a.teams.length}/{TEAMS_MAX}) <small>{addWhy ?? `💰${won(teamCost(state))}`}</small>
      </button>
      {a.list
        .slice()
        .sort((x, y) => x.untilMs - y.untilMs)
        .map((p) => (
          <PropRow key={p.id} state={state} p={p} apply={apply} onMsg={setMsg} showCity />
        ))}
      {!a.list.length && <p className="small muted">{want.length ? '지금 올라온 건의가 없어요.' : '관리할 점령 도시가 없어 관리단이 쉬고 있어요.'}</p>}
      {msg && <p className="small result">{msg}</p>}
      {a.log.length > 0 && (
        <details className="small">
          <summary>최근 관리청 기록</summary>
          {a.log.slice(0, 12).map((t, i) => (
            <p key={i} className="list-row">
              {t}
            </p>
          ))}
        </details>
      )}
    </Card>
  );
}
