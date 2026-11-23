// 사회 → 정계: 국회(법안 카드 3장·표결·살아 있는 법) + 재신임 국민투표. 한 화면.
import { useState } from 'react';
import { CONF_FAME, CONF_RUBY, assemblyOf, billChance, billRows, canSubmit, confChance, submitBill } from '../game/assembly';
import { LAW_DAYS, LAW_MAX, billById, liveLaws, type BillId } from '../game/laws';
import { approvalOf } from '../game/approval';
import { Card } from './common';
import { Help, Meter, Modal } from './kit';
import { timeLeft } from './officerScreens';
import type { ScreenProps } from './screens';

const pct = (v: number) => `${Math.round(v * 100)}%`;
/** 하루가 넘으면 '3일 4시간' */
const longLeft = (ms: number) => (ms >= 48 * 3600e3 ? `${Math.floor(ms / 86400e3)}일 ${Math.floor((ms % 86400e3) / 3600e3)}시간` : timeLeft(ms));

export function AssemblyPanel({ state, actions }: ScreenProps) {
  const a = assemblyOf(state);
  const [why, setWhy] = useState<BillId | null>(null);
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
            <p>법은 한꺼번에 {LAW_MAX}개까지, 넘치면 가장 오래된 법이 끝나요. 카드는 12시간마다 바뀌어요.</p>
          </Help>
        }
      >
        {a.vote ? (
          <p className="small asm-vote">
            🗳️ {billById(a.vote.id).icon} {billById(a.vote.id).name} 표결 중 · {timeLeft(Math.max(0, a.vote.endMs - state.worldMs))} 남음 · 통과 {pct(a.vote.chance)}
          </p>
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
      <Card title="재신임 국민투표" icon="🗳️">
        <p className="small">
          다음 투표까지 <b>{longLeft(Math.max(0, a.confMs - state.worldMs))}</b> · 지금 지지도 {Math.round(approvalOf(state))} → 통과 {pct(cc)}
        </p>
        <Meter value={cc * 100} max={100} tone={cc >= 0.7 ? 'green' : cc >= 0.4 ? 'gold' : 'red'} />
        <p className="small muted">
          실제 14일마다 열려요. 지지도 35면 0%, 65면 100%. 통과 💎{CONF_RUBY} · 명성 +{CONF_FAME} / 실패하면 등급 한 단계 내려가요(게임은 계속). 지금까지 {a.confWins}승 {a.confLoss}패
        </p>
      </Card>
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
