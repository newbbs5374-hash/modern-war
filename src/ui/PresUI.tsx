// 지지도 · 신뢰도 · 분야 점수 화면 부품(본부 칩, 큰 탭 맨 위 한 줄, 국정 현황 팝업)
import { useState } from 'react';
import {
  APPROVAL_W,
  FIELDS,
  IMPEACH_BELOW,
  IMPEACH_SAFE,
  TRUST_W,
  approvalBudgetMult,
  approvalRows,
  approvalTarget,
  approvalTroopMult,
  fieldRows,
  fieldScore,
  fieldScores,
  moodLabel,
  presOf,
  trustTarget,
  type FieldId,
} from '../game/approval';
import type { GameState } from '../game/state';
import { timeLeft } from './officerScreens';
import { Fold, Help, Meter, Modal } from './kit';

const r0 = (v: number) => Math.round(v);
const pct = (v: number) => `${v >= 1 ? '+' : '−'}${Math.abs(Math.round((v - 1) * 1000) / 10)}%`;

/** 분야 점수를 올리는 방법(팝업 아래 도움말) */
const HOW: Record<FieldId, string[]> = {
  personal: ['임무·대전투로 명성을 쌓아요', '훈련으로 정치 스탯을 올려요', '등급이 오르면 조금씩 올라요'],
  defense: ['국방 → 부대에서 병력을 늘려요', '빼앗긴 우리 도시를 되찾아요', '적과의 긴장을 외교로 낮춰요'],
  diplo: ['외교 → 호감·협정에서 협정을 맺어요', '친서·선물로 호감을 올려요', '전쟁을 줄이고 연합을 늘려요'],
  society: ['사회 → 도시에서 주거 구역을 지어요', '복지 연구·정책 카드로 민심을 올려요', '생활 자원(향신료·커피 등)을 갖춰요'],
  economy: ['경제 → 산업 시설(군수공장)을 올려요', '무역 계약을 맺어요', '기본 자원이 떨어지지 않게 해요'],
};

export function Spark({ data, max = 100 }: { data: number[]; max?: number }) {
  if (data.length < 2) return <small className="muted">기록이 쌓이는 중(실제 1시간마다)</small>;
  const w = 220;
  const h = 40;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - (v / max) * h}`).join(' ');
  return (
    <svg className="spark" viewBox={`0 0 ${w} ${h}`} width="100%" height={h} preserveAspectRatio="none" aria-hidden>
      <line x1="0" x2={w} y1={h - (IMPEACH_SAFE / max) * h} y2={h - (IMPEACH_SAFE / max) * h} className="spark-line-warn" />
      <polyline points={pts} fill="none" className="spark-line" />
    </svg>
  );
}

function Gauge({ icon, label, v, target }: { icon: string; label: string; v: number; target: number }) {
  const m = moodLabel(v);
  const dir = target > v + 1 ? '▲' : target < v - 1 ? '▼' : '■';
  return (
    <div className={`pres-gauge ${m.tone ?? ''}`}>
      <div className="row">
        <b>
          {icon} {label} {r0(v)}
        </b>
        <small className="muted">
          {m.name} · 목표 {r0(target)} {dir}
        </small>
      </div>
      <Meter value={v} max={100} tone={m.tone} />
    </div>
  );
}

/** 국정 현황 팝업: 지지도·신뢰도·분야 5개 */
export function PresModal({ state, onClose, focus }: { state: GameState; onClose: () => void; focus?: FieldId }) {
  const p = presOf(state);
  const sc = fieldScores(state);
  const o = state.officer;
  return (
    <Modal title="국정 현황" icon="🏛️" onClose={onClose}>
      {p.impeachMs !== null && (
        <div className="alert">
          ⚠️ 탄핵 위기: {timeLeft(p.impeachMs - state.worldMs)} 안에 지지도를 {IMPEACH_SAFE} 넘게 올려야 해요.
        </div>
      )}
      {o.dismissDeadlineMs !== null && <div className="alert">⚠️ 불신임 경고: {timeLeft(o.dismissDeadlineMs - state.worldMs)} 안에 신뢰도를 40 넘게 올려야 해요.</div>}
      <Gauge icon="🙂" label="지지도" v={p.approval} target={approvalTarget(state)} />
      <Gauge icon="🤝" label="신뢰도" v={o.trust} target={trustTarget(state)} />
      <Spark data={p.hist.map((x) => x.a)} />
      <div className="pres-fields">
        {FIELDS.map((f) => {
          const v = sc[f.id];
          const m = moodLabel(v);
          return (
            <Fold
              key={f.id}
              open={focus === f.id}
              title={
                <span className="pres-field-head">
                  <span>{f.icon}</span>
                  <b>{f.name}</b>
                  <Meter value={v} max={100} tone={m.tone} />
                  <b className="num">{v}</b>
                </span>
              }
            >
              <ul className="kv-list">
                {fieldRows(state, f.id).map(([k, val]) => (
                  <li key={k}>
                    <span>{k}</span>
                    <b>{r0(val) > 0 ? `+${r0(val)}` : r0(val)}</b>
                  </li>
                ))}
              </ul>
              <small className="muted">
                지지도 {Math.round(APPROVAL_W[f.id] * 100)}% · 신뢰도 {Math.round(TRUST_W[f.id] * 100)}% 반영 · 💡 {HOW[f.id].join(' · ')}
              </small>
            </Fold>
          );
        })}
      </div>
      <Fold title="🙂 지지도 목표 계산">
        <ul className="kv-list">
          {approvalRows(state).map(([k, v]) => (
            <li key={k}>
              <span>{k}</span>
              <b>{Math.round(v * 10) / 10 > 0 ? `+${Math.round(v * 10) / 10}` : Math.round(v * 10) / 10}</b>
            </li>
          ))}
        </ul>
      </Fold>
      <p className="small muted">
        지금 효과: 국방예산 {pct(approvalBudgetMult(state))} · 징병 {pct(approvalTroopMult(state))}
        <Help title="지지도와 신뢰도">
          <p>
            <b>🙂 지지도</b>는 국민 마음이에요. 사회 안정 40% · 경제 30% · 안보 20% · 지도자 평판 10%로 목표가 정해지고, 지지도는 그 목표 쪽으로 천천히 움직여요.
          </p>
          <p>
            높으면 국방예산과 징병이 늘고, 낮으면 줄어요. {IMPEACH_BELOW} 밑으로 떨어지면 <b>탄핵 위기</b>: 실제 3일 안에 {IMPEACH_SAFE} 넘게 올리지 못하면 지도자 등급이 한 단계 내려가요(게임이 끝나지는 않아요).
          </p>
          <p>
            <b>🤝 신뢰도</b>는 의회·군·재계 마음이에요. 임무 성공·연설로 오르고, 정적 방해·도시 잃기로 떨어져요. 외교 40% · 안보 30% · 경제 30% 점수 쪽으로도 조금씩 끌려가요. 낮으면 불신임 경고가 와요.
          </p>
        </Help>
      </p>
    </Modal>
  );
}

/** 큰 탭 맨 위 한 줄: 그 분야 점수 + 지지도·신뢰도 */
export function FieldBar({ state, field }: { state: GameState; field: FieldId }) {
  const [open, setOpen] = useState(false);
  const f = FIELDS.find((x) => x.id === field)!;
  const v = fieldScore(state, field);
  const a = presOf(state).approval;
  const t = state.officer.trust;
  const warn = presOf(state).impeachMs !== null || state.officer.dismissDeadlineMs !== null;
  return (
    <>
      <button className={`field-bar ${warn ? 'warn' : ''}`} onClick={() => setOpen(true)} aria-label={`${f.name} ${v}, 국정 현황 보기`}>
        <span className="fb-name">
          {f.icon} {f.name}
        </span>
        <Meter value={v} max={100} tone={moodLabel(v).tone} />
        <b className="num">{v}</b>
        <span className={`fb-mini ${moodLabel(a).tone ?? ''}`}>🙂{r0(a)}</span>
        <span className={`fb-mini ${moodLabel(t).tone ?? ''}`}>🤝{r0(t)}</span>
        <span className="fb-arrow">▸</span>
      </button>
      {open && <PresModal state={state} focus={field} onClose={() => setOpen(false)} />}
    </>
  );
}
