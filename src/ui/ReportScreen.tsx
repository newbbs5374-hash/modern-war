// 📨 보고 탭(11-25 대장 요청): 장관·참모·장군·부관 건의, 도시 개발 계획, 할 일, 최근 보고를 한곳에.
// 여기서 바로 승인(받아들이기)하거나, 그 기능이 있는 화면으로 바로 갈 수 있음.
import { useState } from 'react';
import { ministryById, type MinistryId } from '../data/cabinet';
import { buildingInfo } from '../data/economy';
import { todos } from '../game/briefing';
import { actWhy, propOf, type PropAct, type Proposal } from '../game/proposals';
import type { GameState } from '../game/state';
import { Card } from './common';
import { routeTo, type Screen } from './nav';
import type { ScreenProps } from './screens';
import { PlanList, ProposalCard } from './TalkUI';
import { OccAdminCard } from './OccAdminUI';
import { ResignCard } from './ResignUI';
import { acceptAllNow, autoApproveOn, setAutoApprove } from '../game/autoApprove';

/** 부처가 있는 화면(큰 탭·작은 탭) */
const MIN_PLACE: Record<string, [string, string]> = {
  defense: ['defense', 'command'],
  diplo: ['diplo', 'mofa'],
  society: ['society', 'mins'],
};
const ECON_TAX: MinistryId[] = ['mof', 'moel', 'mss'];
function minPlace(id: MinistryId): [string, string] {
  const m = ministryById(id);
  if (m.tab === 'economy') return ['economy', ECON_TAX.includes(id) ? 'tax' : 'ind'];
  return MIN_PLACE[m.tab] ?? ['society', 'mins'];
}
/** 건의 → 바로 갈 화면 */
export function placeOf(act: PropAct, min: MinistryId): { screen: string; tab: string; label: string } {
  switch (act.kind) {
    case 'district':
    case 'mark':
      return { screen: 'society', tab: 'city', label: '🏙️ 도시 화면' };
    case 'facility': {
      const f = buildingInfo(act.id).fac;
      return f === '국방'
        ? { screen: 'defense', tab: 'fac', label: '🛡️ 국방 시설' }
        : f === '복지' || f === '과학'
          ? { screen: 'society', tab: 'mins', label: '🏛️ 사회 시설' }
          : { screen: 'economy', tab: 'ind', label: '🏭 산업 시설' };
    }
    default: {
      const [screen, tab] = minPlace(act.kind === 'govfac' ? min : act.min);
      return { screen, tab, label: '🏛️ 부처 화면' };
    }
  }
}

/** 받을 보고 수(위 띠 배지) */
export const reportCount = (s: GameState) => propOf(s).list.length + (s.occAdmin?.list.length ?? 0) + (s.resign?.ask ? 1 : 0);

export function ReportScreen({ state, actions, go }: ScreenProps) {
  const [msg, setMsg] = useState('');
  const p = propOf(state);
  const goTo = (screen: string, tab: string, key = screen) => go(routeTo(screen, key, tab) as Screen);
  const ready = p.list.filter((x) => !actWhy(state, x.act).why);
  const acceptAll = () => {
    let n = 0;
    actions.apply((s) => {
      const r = acceptAllNow(s);
      n = r.n;
      return r.state;
    });
    setMsg(n ? `✅ ${n}건을 한꺼번에 승인했습니다.` : '지금 바로 승인할 수 있는 건의가 없어요.');
  };
  const auto = autoApproveOn(state);
  const todo = todos(state);
  return (
    <>
      <ResignCard state={state} apply={(f) => actions.apply(f)} />
      <Card
        title="자동 모두 승인"
        icon="🤖"
        right={
          <button className={auto ? 'gold small-btn' : 'small-btn'} onClick={() => actions.apply((s) => setAutoApprove(s, !autoApproveOn(s)))}>
            {auto ? '✅ 켜짐' : '⏸️ 꺼짐'}
          </button>
        }
      >
        <p className="small muted">
          켜 두면 건의와 점령지 관리청 건의를 <b>들어오는 대로 모두 승인</b>해요. 접속하지 않은 동안에도 나라 예산이 허락하는 만큼 승인하고, 돈이 모자란 건은 남겨 둬요.
          {(p.autoN ?? 0) > 0 && ` 지금까지 자동 승인 ${p.autoN}건.`}
        </p>
      </Card>
      <Card
        title={`건의 ${p.list.length}건`}
        icon="📨"
        help={
          <p>
            장관·참모·청장·장군·부관이 <b>지금 바로 할 수 있는 발전 방안</b>이 생기면 곧바로 올려요. ✅ 받아들이면 도시가 알맞은 칸을 골라 알아서 지어요. ➡️ 바로 가기를 누르면 그 기능 화면으로 가요.
          </p>
        }
        right={
          ready.length + (state.occAdmin?.list.length ?? 0) > 1 ? (
            <button className="gold small-btn" onClick={acceptAll}>
              ✅ 모두 승인 {ready.length + (state.occAdmin?.list.length ?? 0)}
            </button>
          ) : undefined
        }
      >
        {!p.list.length && <p className="small muted">지금 올라온 건의가 없어요. 장관을 임명하면 할 수 있는 일이 생기는 대로 바로 건의해요.</p>}
        {p.list.map((pr: Proposal) => {
          const pl = placeOf(pr.act, pr.min);
          return (
            <div key={pr.id} className="rep-item">
              <ProposalCard state={state} actions={actions} pr={pr} onDone={setMsg} />
              <button className="rep-go" onClick={() => goTo(pl.screen, pl.tab)}>
                ➡️ 바로 가기 · {pl.label}
              </button>
            </div>
          );
        })}
        {msg && <p className="small result">{msg}</p>}
      </Card>
      <OccAdminCard state={state} apply={(f) => actions.apply(f)} />
      {p.plans.length > 0 && (
        <Card title={`도시 개발 계획 ${p.plans.length}건`} icon="🏗️">
          <PlanList state={state} actions={actions} />
        </Card>
      )}
      {todo.length > 0 && (
        <Card title={`할 일 ${todo.length}건`} icon="📋">
          {todo.map((t, i) => (
            <button key={i} className="rep-todo" onClick={() => goTo(t.go.screen, t.go.tab, t.go.key)}>
              <span>{t.icon}</span>
              <span className="li-main">{t.text}</span>
              <small>➡️</small>
            </button>
          ))}
        </Card>
      )}
      <Card title="최근 보고" icon="📜">
        {!p.log.length && <p className="small muted">아직 보고가 없어요.</p>}
        {p.log.slice(0, 20).map((t, i) => (
          <p key={i} className="small list-row">
            {t}
          </p>
        ))}
        <button className="wide" onClick={() => go('herald')}>
          📯 전령에서 모든 소식 보기
        </button>
      </Card>
    </>
  );
}
