// 사회 → 정계: 국회(법안 카드 3장·표결·살아 있는 법) + 재신임 국민투표. 한 화면.
import { BoostBar } from './BoostBar';
import { useState } from 'react';
import { CONF_FAME, CONF_RUBY, assemblyOf, billChance, billRows, canSubmit, confChance, confRows, isOpposition, submitBill, termNo } from '../game/assembly';
import { LAW_DAYS, LAW_MAX, billById, liveLaws, type BillId } from '../game/laws';
import { approvalOf } from '../game/approval';
import { titleOf } from '../game/title';
import { BLOCS, DEBT_HARD, MAJORITY, WHIP_MAX, blocSeats, canWhip, debtCost, liveDebts, payCostOf, payDebt, talkChance, whip, whipOf, yesSeats, type WhipHow } from '../game/whip';
import { Card, fmt } from './common';
import { Help, Meter, Modal } from './kit';
import { timeLeft } from './officerScreens';
import type { ScreenProps } from './screens';

const pct = (v: number) => `${Math.round(v * 100)}%`;
/** 하루가 넘으면 '3일 4시간' */
const longLeft = (ms: number) => (ms >= 48 * 3600e3 ? `${Math.floor(ms / 86400e3)}일 ${Math.floor((ms % 86400e3) / 3600e3)}시간` : timeLeft(ms));

export function AssemblyPanel({ state, actions }: ScreenProps) {
  const a = assemblyOf(state);
  const [why, setWhy] = useState<BillId | null>(null);
  const [bloc, setBloc] = useState<number | null>(null);
  const [wmsg, setWmsg] = useState('');
  const w = whipOf(state);
  const seats = blocSeats(state);
  const debts = liveDebts(state);
  const laws = liveLaws(state);
  const cc = confChance(state);
  return (
    <>
      <Card
        title="국회"
        icon="🏛️"
        right={
          <Help title="법안·국회">
            <p>법안 카드 3장 중 하나를 내면 실제 2시간 뒤 표결해요. 통과하면 {LAW_DAYS}일 동안 법 효과가 나고 신뢰도 +2, 부결되면 신뢰도 −3이에요.</p>
            <p>통과 확률은 의회 신뢰도·정치 스탯·야당 대표 영향력(협력하면 +)·원칙주의 장관이 정해요. 국회 연설 일정이 도움이 돼요.</p>
            <p>표결을 기다리는 동안 「표 모으기」에서 의원 묶음을 {WHIP_MAX}번까지 설득할 수 있어요. 찬성이 {MAJORITY}석을 넘으면 통과 90% 이상이에요.</p>
            <p>법은 한꺼번에 {LAW_MAX}개까지, 넘치면 가장 오래된 법이 끝나요. 카드는 12시간마다 바뀌어요.</p>
          </Help>
        }
      >
        {a.vote ? (
          <>
            <p className="small asm-vote">
              🗳️ {billById(a.vote.id).icon} {billById(a.vote.id).name} 표결 중 · {timeLeft(Math.max(0, a.vote.endMs - state.worldMs))} 남음 · 통과 {pct(a.vote.chance)}
            </p>
            <BoostBar state={state} apply={actions.apply} target={{ kind: 'vote' }} />
            {w && (
              <div className="whip">
                <div className="whip-head">
                  <b>🗳️ 표 모으기</b>
                  <span className={yesSeats(state, w.st) >= MAJORITY ? 'good' : ''}>
                    찬성 {yesSeats(state, w.st)}석 / 과반 {MAJORITY}석
                  </span>
                  <small className="muted">
                    설득 {w.used}/{WHIP_MAX}
                  </small>
                </div>
                <div className="whip-bar">
                  {BLOCS.map((b, i) => (
                    <i key={b.id} className={`whip-${w.st[i]}`} style={{ flexGrow: seats[i] }} />
                  ))}
                  <u style={{ left: `${(MAJORITY / 300) * 100}%` }} />
                </div>
                <div className="whip-blocs">
                  {BLOCS.map((b, i) => (
                    <button key={b.id} className={`whip-bloc whip-${w.st[i]}`} disabled={w.st[i] === 'yes' || w.used >= WHIP_MAX} onClick={() => setBloc(i)}>
                      <b>{b.name}</b>
                      <small>{seats[i]}석</small>
                      <em>{w.st[i] === 'yes' ? '찬성' : w.st[i] === 'maybe' ? '고민' : '반대'}</em>
                    </button>
                  ))}
                </div>
                {wmsg && <p className="small sch-msg">{wmsg}</p>}
              </div>
            )}
          </>
        ) : (
          <p className="small muted">법안을 하나 골라 국회에 내세요 · 새 카드까지 {timeLeft(Math.max(0, a.offerMs - state.worldMs))}</p>
        )}
        <div className="asm-bills">
          {a.offer.map((id) => {
            const b = billById(id);
            const no = canSubmit(state, id);
            return (
              <div key={id} className="asm-bill">
                <span className="asm-ico">{b.icon}</span>
                <b>{b.name}</b>
                <small>{b.text}</small>
                <button className="asm-chance" onClick={() => setWhy(id)}>
                  통과 {pct(billChance(state, id))} ⓘ
                </button>
                <button className="gold" disabled={!!no} onClick={() => actions.apply((s) => submitBill(s, id))}>
                  📨 제출
                </button>
              </div>
            );
          })}
        </div>
        {debts > 0 && (
          <p className="small whip-debt">
            🤝 안 갚은 약속 {debts}건 · 법안 통과 −{Math.round(debts * DEBT_HARD * 100)}%{' '}
            <button className="mini" disabled={state.nations[state.player.countryId].treasury < debtCost(state)} onClick={() => actions.apply(payDebt)}>
              💰{fmt(debtCost(state))}로 하나 갚기
            </button>
          </p>
        )}
        <h4 className="cab-h">
          살아 있는 법 {laws.length}/{LAW_MAX}
        </h4>
        {laws.length ? (
          <div className="asm-laws">
            {laws.map((l) => (
              <span key={l.id}>
                {billById(l.id).icon} {billById(l.id).name} <small className="muted">{longLeft(l.untilMs - state.worldMs)}</small>
              </span>
            ))}
          </div>
        ) : (
          <p className="small muted">아직 통과된 법이 없어요.</p>
        )}
      </Card>
      <Card title={`${termNo(state)}번째 임기 · 재신임 선거`} icon="🗳️">
        {isOpposition(state) && <p className="small asm-vote">🪑 지금은 야당 지도자예요 · {longLeft(Math.max(0, (a.oppUntilMs ?? 0) - state.worldMs))} 뒤 다시 집권해요(그동안 법안을 못 내요)</p>}
        <p className="small">
          다음 투표까지 <b>{longLeft(Math.max(0, a.confMs - state.worldMs))}</b> · 지금 지지도 {Math.round(approvalOf(state))} · 호칭 「{titleOf(state).name}」 → 통과 {pct(cc)}
        </p>
        <Meter value={cc * 100} max={100} tone={cc >= 0.7 ? 'green' : cc >= 0.4 ? 'gold' : 'red'} />
        <ul className="kv-list">
          {confRows(state).map(([k, v]) => (
            <li key={k}>
              <span>{k}</span>
              <b className={v < 0 ? 'bad' : ''}>
                {v >= 0 ? '+' : ''}
                {Math.round(v * 100)}%
              </b>
            </li>
          ))}
        </ul>
        <p className="small muted">
          이번 임기에 지킨 공약(국정 과제) 한 건마다 +4%(많아야 +20%), 깬 공약 한 건마다 −6%. 지면 이틀 동안 야당 지도자로 지내다 다시 집권해요.
        </p>
        <p className="small muted">
          실제 14일마다 열려요. 지지도 35면 0%, 65면 100%에 호칭(평판)이 더하거나 빼요(가장 낮은 호칭 −25%p, 가장 높은 호칭 +25%p). 통과 💎{CONF_RUBY} · 명성 +{CONF_FAME} / 실패하면 신뢰도 −15 · 명성 −100(호칭이 내려갈 수 있어요, 게임은 계속). 지금까지 {a.confWins}승 {a.confLoss}패
        </p>
      </Card>
      {bloc != null && w && (
        <Modal title={`${BLOCS[bloc].name} 설득 · ${seats[bloc]}석`} icon="🗳️" onClose={() => setBloc(null)}>
          <div className="crisis">
            <p>
              {BLOCS[bloc].text}. 지금 태도: <b>{w.st[bloc] === 'maybe' ? '고민 중' : '반대'}</b>
              {w.st[bloc] === 'no' ? ' (한 번 설득하면 고민, 두 번이면 찬성)' : ''}
            </p>
            {(['pay', 'promise', 'talk'] as WhipHow[]).map((how) => {
              const no = canWhip(state, bloc, how);
              return (
                <button
                  key={how}
                  className="wide crisis-opt"
                  disabled={!!no}
                  onClick={() => {
                    setWmsg(actions.applyWith((s) => { const r = whip(s, bloc, how); return { state: r.state, out: r.text }; }) ?? '');
                    setBloc(null);
                  }}
                >
                  <b>{how === 'pay' ? '💰 지역 예산 주기' : how === 'promise' ? '🤝 다음에 돕기로 약속하기' : '🗣️ 직접 만나 설득하기'}</b>
                  <small className="muted">
                    {no ??
                      (how === 'pay'
                        ? `나라 예산 −${fmt(payCostOf(state, bloc))} · 꼭 한 단계 움직여요`
                        : how === 'promise'
                          ? `공짜 · 바로 찬성 · 약속 빚 +1(다음 법안 통과 −${Math.round(DEBT_HARD * 100)}%, 5일)`
                          : `공짜 · 성공 ${Math.round(talkChance(state) * 100)}%(정치 스탯) · 실패하면 신뢰도 −1`)}
                  </small>
                </button>
              );
            })}
          </div>
        </Modal>
      )}
      {why && (
        <Modal title={`${billById(why).name} 통과 확률`} icon={billById(why).icon} onClose={() => setWhy(null)}>
          <ul className="kv-list">
            {billRows(state, why).map(([k, v]) => (
              <li key={k}>
                <span>{k}</span>
                <b>{v >= 0 ? '+' : ''}{Math.round(v * 100)}%p</b>
              </li>
            ))}
          </ul>
          <p className="small">합계 {pct(billChance(state, why))}(10~95% 사이)</p>
        </Modal>
      )}
    </>
  );
}
