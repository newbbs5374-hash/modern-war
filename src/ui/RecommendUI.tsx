// 비서 인사 추천 보고(11-25 대장 요청). 버튼 → 큰 창: 대통령실 · 총리·기관장 · 부처별(장관 + 딸린 청장).
// 자리마다 추천 인물·적합도·이유 한 줄(비서 말투)·바로 임명. 계산은 src/game/recommend.ts
import { useMemo, useState } from 'react';
import { MINISTRIES, type FieldTab, type MinistryId } from '../data/cabinet';
import { OFFICES, postById } from '../data/staff';
import { REFRESH_RUBY, cabinetOf, postHolder, refreshPool, type Person } from '../game/cabinet';
import { canTakeRec, recommend, seatKey, takeRec, takeRecs, type Rec, type RecReport, type SeatInfo } from '../game/recommend';
import type { GameState } from '../game/state';
import { fmt } from './common';
import { Modal } from './kit';
import { PersonFace, PersonModal } from './CabinetUI';
import type { ScreenProps } from './screens';

type Part = 'office' | 'gov' | 'min';
const FIELD_NAME: Record<FieldTab, string> = { defense: '🛡️ 국방', diplo: '🌐 외교', society: '🏘️ 사회', economy: '📈 경제' };

/** 이 추천이 어느 묶음인지 */
function partOf(r: { seat: Rec['seat'] }): Part {
  if (r.seat.kind === 'min') return 'min';
  const o = postById(r.seat.id).office;
  return o === 'agency' ? 'min' : o === 'gov' ? 'gov' : 'office';
}
/** 부처 묶음 열쇠(청장은 위의 부) */
function minOf(r: { seat: Rec['seat'] }): MinistryId | null {
  if (r.seat.kind === 'min') return r.seat.id;
  return postById(r.seat.id).parent ?? null;
}
/** 대통령실 묶음 열쇠(실) */
const officeOf = (r: { seat: Rec['seat'] }) => (r.seat.kind === 'post' ? postById(r.seat.id).office : null);

/** 보고 버튼(누르면 창). 비어서 추천할 자리 수를 붙임 */
export function RecommendButton({ state, actions }: Pick<ScreenProps, 'state' | 'actions'>) {
  const [open, setOpen] = useState(false);
  const rep = useMemo(() => recommend(state), [state]);
  const n = rep.recs.length;
  return (
    <>
      <button className="wide rec-btn" onClick={() => setOpen(true)}>
        🧑‍💼 비서 인사 추천 보고 {n ? <b className="rec-n">{n}건</b> : <small className="muted">· 추천할 자리 없음</small>}
      </button>
      {open && <RecommendModal state={state} actions={actions} onClose={() => setOpen(false)} />}
    </>
  );
}

export function RecommendModal({ state, actions, onClose }: Pick<ScreenProps, 'state' | 'actions'> & { onClose: () => void }) {
  const rep = useMemo(() => recommend(state), [state]);
  const counts: Record<Part, number> = { office: 0, gov: 0, min: 0 };
  for (const r of rep.recs) counts[partOf(r)]++;
  const first: Part = counts.min ? 'min' : counts.office ? 'office' : counts.gov ? 'gov' : 'min';
  const [part, setPart] = useState<Part>(first);
  const [who, setWho] = useState<number | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const chief = postHolder(cabinetOf(state), 'chief');
  const list = rep.recs.filter((r) => partOf(r) === part);
  const ok = list.filter((r) => !canTakeRec(state, r));
  const swaps = rep.recs.filter((r) => r.holder).length;
  const take = (r: Rec) => {
    actions.apply((s) => takeRec(s, r));
    setMsg(`✅ ${r.name} 임명 완료`);
  };
  const takeAll = () => {
    let n = 0;
    actions.apply((s) => {
      const out = takeRecs(s, ok);
      n = out.done;
      return out.s;
    });
    setMsg(`✅ 추천 ${n || ok.length}건을 따랐어요`);
  };
  return (
    <Modal
      big
      title="인사 추천 보고"
      icon="🧑‍💼"
      onClose={onClose}
      footer={
        <button className="gold wide" disabled={!ok.length} onClick={takeAll}>
          ✅ 이 쪽 추천 모두 따르기 ({ok.length}건)
        </button>
      }
    >
      <div className="rec-head">
        {chief ? <PersonFace p={chief} size={40} /> : <span className="cab-face" style={{ width: 40, height: 40, fontSize: 22 }}>🧑‍💼</span>}
        <p className="small">
          <b>{chief ? `비서실장 ${chief.name}` : '수행비서'}</b>
          <br />
          {headLine(rep, swaps)}
        </p>
      </div>
      {msg && <p className="small rec-msg">{msg}</p>}
      <div className="seg cab-seg">
        <button className={part === 'min' ? 'on' : ''} onClick={() => setPart('min')}>
          🏛️ 부처별 {counts.min}
        </button>
        <button className={part === 'office' ? 'on' : ''} onClick={() => setPart('office')}>
          🏢 대통령실 {counts.office}
        </button>
        <button className={part === 'gov' ? 'on' : ''} onClick={() => setPart('gov')}>
          ⚖️ 총리·기관장 {counts.gov}
        </button>
      </div>
      {part === 'min' && rep.minBlocked > 0 && (
        <p className="small muted" style={{ margin: '2px 0' }}>
          📌 장관 석이 모자라 빈 부처 {rep.minBlocked}곳은 이번에 추천하지 않았어요(잘 맞는 부처부터). 지금 남은 장관 석 {rep.minLeft}석.
        </p>
      )}
      <RecGroups state={state} rep={rep} part={part} onTake={take} onFace={setWho} />
      {rep.noOne.length > 0 && (
        <button className="wide" disabled={(state.goals?.ruby ?? 0) < REFRESH_RUBY} onClick={() => (actions.apply(refreshPool), setMsg('🔄 인재 명단을 새로 받았어요'))}>
          🔄 인재 명단 새로 받기(빈 자리 {rep.noOne.length}곳에 맞는 분 찾기) <small>💎{REFRESH_RUBY}</small>
        </button>
      )}
      {who !== null && <PersonModal state={state} actions={actions} pid={who} onClose={() => setWho(null)} />}
    </Modal>
  );
}

function headLine(rep: RecReport, swaps: number): string {
  const fill = rep.recs.length - swaps;
  if (!rep.recs.length)
    return rep.noOne.length
      ? `각하, 빈 자리 ${rep.noOne.length}곳에 맞는 사람이 아직 없습니다. 인재 명단을 새로 받아 보시길 권합니다.`
      : '각하, 모든 자리에 알맞은 분들이 앉아 있습니다. 지금은 바꿀 곳이 없습니다.';
  return `각하, 인사 보고 올립니다. 빈 자리 ${fill}곳에 추천드릴 분을 골랐습니다.${swaps ? ` 교체를 건의드릴 자리도 ${swaps}곳 있습니다.` : ''} 적합도는 스탯·특화·성향·출신으로 따졌습니다.`;
}

/** 묶음별로 줄 세우기 */
function RecGroups({ state, rep, part, onTake, onFace }: { state: GameState; rep: RecReport; part: Part; onTake: (r: Rec) => void; onFace: (id: number) => void }) {
  const recs = rep.recs.filter((r) => partOf(r) === part);
  const none = rep.noOne.filter((x) => partOf(x) === part);
  if (!recs.length && !none.length)
    return <p className="small muted rec-empty">이 쪽은 모두 알맞은 분들이 앉아 있습니다. 👍</p>;
  if (part === 'min') {
    // 분야 → 부처 → (장관 + 청장)
    const fields: FieldTab[] = ['defense', 'diplo', 'society', 'economy'];
    return (
      <>
        {fields.map((f) => {
          const mins = MINISTRIES.filter((m) => m.tab === f).filter((m) => recs.some((r) => minOf(r) === m.id) || none.some((x) => minOf(x) === m.id));
          if (!mins.length) return null;
          return (
            <div key={f} className="rec-field">
              <h4 className="rec-h">{FIELD_NAME[f]}</h4>
              {mins.map((m) => (
                <div key={m.id} className="rec-group">
                  <div className="rec-gname">
                    {m.icon} {m.name}
                  </div>
                  <RecRows state={state} recs={recs.filter((r) => minOf(r) === m.id)} none={none.filter((x) => minOf(x) === m.id)} onTake={onTake} onFace={onFace} />
                </div>
              ))}
            </div>
          );
        })}
      </>
    );
  }
  if (part === 'office') {
    return (
      <>
        {OFFICES.filter((o) => o.id !== 'agency' && o.id !== 'gov').map((o) => {
          const rs = recs.filter((r) => officeOf(r) === o.id);
          const ns = none.filter((x) => officeOf(x) === o.id);
          if (!rs.length && !ns.length) return null;
          return (
            <div key={o.id} className="rec-group">
              <div className="rec-gname">
                {o.icon} {o.name}
              </div>
              <RecRows state={state} recs={rs} none={ns} onTake={onTake} onFace={onFace} />
            </div>
          );
        })}
      </>
    );
  }
  return (
    <div className="rec-group">
      <RecRows state={state} recs={recs} none={none} onTake={onTake} onFace={onFace} />
    </div>
  );
}

function RecRows({ state, recs, none, onTake, onFace }: { state: GameState; recs: Rec[]; none: SeatInfo[]; onTake: (r: Rec) => void; onFace: (id: number) => void }) {
  const c = cabinetOf(state);
  return (
    <>
      {recs.map((r) => {
        const p = c.people.find((x) => x.id === r.pid) as Person | undefined;
        if (!p) return null;
        const why = canTakeRec(state, r);
        return (
          <div key={seatKey(r.seat)} className="rec-row">
            <div className="rec-top">
              <span className="rec-seat">
                {r.icon} <b>{r.name}</b>
                {r.holder ? <small className="rec-swap">교체 건의</small> : <small className="muted">빈 자리</small>}
              </span>
            </div>
            <div className="rec-mid">
              <button className="rec-face" onClick={() => onFace(p.id)} title="인물 보기">
                <PersonFace p={p} size={38} />
              </button>
              <span className="rec-who">
                <b>
                  {p.name} <small className="muted">{p.age}세</small>
                </b>
                <small>
                  {p.spec} · {p.trait}
                  {p.group === '인재' ? ' · 📋인재 명단' : ' · 🏛️내 사람'}
                </small>
              </span>
              <span className={`fit ${r.fit >= 65 ? 'good' : r.fit < 45 ? 'low' : ''}`} title="적합도">
                <b>{r.fit}%</b>
                <small>{r.holder ? `지금 ${r.holder.fit}%` : '적합도'}</small>
              </span>
            </div>
            <p className="small rec-say">💬 {r.say}</p>
            <button className="gold wide" disabled={!!why} title={why ?? ''} onClick={() => onTake(r)}>
              {r.holder ? '🔁 교체 임명' : '✅ 바로 임명'}
              {r.cost ? <small> · 영입 💵{fmt(r.cost)}</small> : null}
            </button>
            {why && <small className="muted rec-why">{why}</small>}
          </div>
        );
      })}
      {none.length > 0 && (
        <p className="small muted rec-none">
          💬 맞는 분이 아직 없는 자리: {none.map((x) => `${x.icon}${x.name}`).join(' · ')}
        </p>
      )}
    </>
  );
}
