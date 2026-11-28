// 경제 → 예산·세금: 국가 예산 4칸 나누기(5% 단위) + 세금 3단계. 한 화면.
import { useState } from 'react';
import {
  SPLIT_DEFAULT,
  SPLIT_INFO,
  SPLIT_MAX,
  SPLIT_MIN,
  SPLIT_STEP,
  TAX_INFO,
  canSetPolicy,
  defConsentCap,
  defConsentProblem,
  defConsentRows,
  policyOf,
  setSplit,
  setTax,
  splitProblem,
  type Split,
  type SplitKey,
  type Tax,
} from '../game/policy';
import { budgetPerDay } from '../game/state';
import { canMoveDef, defMoveAmount, moveDefToNation } from '../game/defFund';
import { DEF_MOVE_LOSS, DEF_MOVE_SHARE } from '../game/balance';
import { Card, fmt } from './common';
import { Help, Meter } from './kit';
import type { ScreenProps } from './screens';

/** 이 나누기일 때 효과 한 줄 */
function effText(k: SplitKey, v: number): string {
  const d = v - SPLIT_DEFAULT[k];
  const sign = (x: number) => (x > 0 ? `+${x}` : `${x}`);
  const r1 = (x: number) => Math.round(x * 10) / 10;
  switch (k) {
    case 'def':
      return `모집 ${sign(r1(d * 0.8))}% · 징병 ${sign(r1(d * 0.5))}% · 안보 ${sign(r1(d * 0.25))}`;
    case 'dip':
      return `호감 ${sign(r1(d * 0.3))} · 외교 위상 ${sign(r1(d * 0.4))}`;
    case 'soc':
      return `도시 민심 ${sign(r1(d * 0.35))}`;
    case 'eco':
      return `예산·자원 ${sign(r1(d * 0.6))}% · 경제 ${sign(r1(d * 0.3))}`;
  }
}

export function PolicyPanel({ state, actions }: ScreenProps) {
  const p = policyOf(state);
  const [draft, setDraft] = useState<Split>(p.split);
  const total = SPLIT_INFO.reduce((a, x) => a + draft[x.key], 0);
  const prob = splitProblem(draft) ?? defConsentProblem(state, draft);
  const cap = defConsentCap(state);
  const wait = canSetPolicy(state);
  const waitTax = canSetPolicy(state, 'tax');
  const same = SPLIT_INFO.every((x) => draft[x.key] === p.split[x.key]);
  const step = (k: SplitKey, d: number) => setDraft((o) => ({ ...o, [k]: Math.max(SPLIT_MIN, Math.min(SPLIT_MAX, o[k] + d)) }));
  const perHour = budgetPerDay(state, state.player.countryId);
  return (
    <>
      <Card
        title="국가 예산 나누기"
        icon="📊"
        right={
          <Help title="예산 나누기">
            <p>나라 살림을 국방·외교·사회·경제 4곳에 나눠요. 합은 100%, 한 곳은 {SPLIT_MIN}~{SPLIT_MAX}%, {SPLIT_STEP}% 단위예요.</p>
            <p>기본(국방 40 · 외교 20 · 사회 20 · 경제 20)에서 늘리면 그 분야가 좋아지고, 줄이면 나빠져요. 한 분야만 키우면 다른 분야가 흔들려요.</p>
            <p>실제 1시간(게임 하루)에 한 번 바꿀 수 있어요. 세금은 따로 1시간에 한 번이에요.</p>
            <p>🏛️ 국방 몫(=국방비)을 늘리려면 국회 동의가 필요해요. 국회는 의회 신뢰도와 여당 의석에 따라 {cap}%까지 동의해요. 줄이는 건 언제나 돼요.</p>
          </Help>
        }
      >
        {SPLIT_INFO.map((x) => (
          <div key={x.key} className="split-row">
            <span className="split-name">
              {x.icon} <b>{x.name}</b>
            </span>
            <button className="split-btn" disabled={draft[x.key] <= SPLIT_MIN} onClick={() => step(x.key, -SPLIT_STEP)} aria-label={`${x.name} 줄이기`}>
              −
            </button>
            <span className="split-val">
              <Meter value={draft[x.key]} max={SPLIT_MAX} tone={draft[x.key] > SPLIT_DEFAULT[x.key] ? 'green' : draft[x.key] < SPLIT_DEFAULT[x.key] ? 'gold' : undefined} />
              <b className="num">{draft[x.key]}%</b>
            </span>
            <button className="split-btn" disabled={draft[x.key] >= SPLIT_MAX} onClick={() => step(x.key, SPLIT_STEP)} aria-label={`${x.name} 늘리기`}>
              +
            </button>
            <small className="split-eff muted">
              {effText(x.key, draft[x.key])}
              {x.key === 'def' && (
                <span className={draft.def > cap && draft.def > p.split.def ? 'warn' : ''} title={defConsentRows(state).map(([k, v]) => `${k} ${v}`).join(' · ')}>
                  {' '}· 🏛️ 국회 동의 {cap}%까지
                </span>
              )}
            </small>
          </div>
        ))}
        <div className="row" style={{ marginTop: 6 }}>
          <small className={total === 100 ? 'muted' : 'warn'}>합 {total}% · 🛡️ 국방 몫은 국방비로 들어가요(시간당 {fmt(perHour * p.split.def / 100)})</small>
          <button onClick={() => setDraft({ ...SPLIT_DEFAULT })}>
            기본으로
          </button>
          <button className="primary" disabled={!!prob || !!wait || same} onClick={() => actions.apply((s) => setSplit(s, draft))}>
            {wait ?? prob ?? (same ? '지금 나누기' : '✅ 이대로 정하기')}
          </button>
        </div>
      </Card>
      <Card title="세금" icon="🧾" right={<small className="muted">수입 시간당 {fmt(perHour)}</small>}>
        <div className="tax-row">
          {(Object.keys(TAX_INFO) as Tax[]).map((t) => (
            <button key={t} className={`tax-btn ${p.tax === t ? 'on' : ''}`} disabled={p.tax === t || !!waitTax} onClick={() => actions.apply((s) => setTax(s, t))}>
              <span>{TAX_INFO[t].icon}</span>
              <b>{TAX_INFO[t].name}</b>
              <small>{TAX_INFO[t].text}</small>
            </button>
          ))}
        </div>
        {waitTax && <small className="muted">{waitTax}</small>}
      </Card>
      <MoveDefCard state={state} actions={actions} />
    </>
  );
}

/** 11-27 국방비 → 나라 예산 옮기기 + 나라 예산 늘리는 길 */
function MoveDefCard({ state, actions }: Pick<ScreenProps, 'state' | 'actions'>) {
  const mv = defMoveAmount(state);
  const why = canMoveDef(state);
  return (
    <Card
      title="국방비 → 나라 예산"
      icon="💱"
      right={
        <Help title="나라 예산 늘리는 길">
          <p>
            <b>바로 들어오는 돈</b>: 도시 점령 전리품(주변 내정 도시 몫까지) · 통일하면 그 나라 국고 전부 · 나라를 무너뜨리면 남은 국고 30% · 편입이 끝나면 정착 지원금 · 침공을 막으면 노획 · 봉급날·임무 수당.
          </p>
          <p>
            <b>계속 들어오는 돈</b>: 가진 도시 세금(점령 60% · 민정 85% · 편입 100%) · 본토보다 커지면 🌏 나라 규모 보너스(최대 +40%) · 경제 몫·세금·군수공장·기재부·무역 계약.
          </p>
          <p>내정 비용은 이제 본토 크기로 매겨요. 땅이 늘어도 비용은 그대로라 넓힐수록 여유가 생겨요.</p>
          <p>국방비가 남으면 여기서 나라 예산으로 옮길 수 있어요. 한 번에 {Math.round(DEF_MOVE_SHARE * 100)}%씩, {Math.round(DEF_MOVE_LOSS * 100)}%는 행정 비용으로 사라져요.</p>
        </Help>
      }
    >
      <div className="row">
        <small className="muted">
          국방비 −{fmt(mv.from)} → 나라 예산 +{fmt(mv.to)}
        </small>
        <button className="primary" disabled={!!why} onClick={() => actions.apply(moveDefToNation)}>
          {why ?? '💱 옮기기'}
        </button>
      </div>
    </Card>
  );
}
