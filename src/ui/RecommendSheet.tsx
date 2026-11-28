// 11/28 디자인 개편 4단계: 장관 추천 창(아래에서 올라오는 판).
// 장관 얼굴 + 말풍선 한 줄 + 추천 카드. 경제는 무역 추천(사기→팔기)·정렬·맡기기 스위치까지.
// 다른 부처는 담당 장관 조언(advice.ts)을 같은 모양 카드로 보여 준다.
import { useState } from 'react';
import type { GameState } from '../game/state';
import { advisorOf, adviceAccuracy, adviceSeed, canFollow, followAdvice, pickAdvice, tone, type AdviceField } from '../game/advice';
import { RecCards, adviceTips } from './AdviceBar';
import { ADVICE_PER_DAY, ADVICE_RESET_H, adviceLeft, adviceResetIn, autoOn, canRunTip, runTip, setAuto, sortTips, tradeTips, type TipSort, type TradeTip } from '../game/tradeAdvice';
import { countryById } from '../data/world';
import { Modal } from './kit';
import { PersonFace } from './CabinetUI';
import { Flag } from './flag';
import { ResIcon } from './iconArt';
import { fmt } from './common';
import { cabinetOf, ministerOf } from '../game/cabinet';
import { timeLeft } from './officerScreens';

const NAME: Record<AdviceField | 'culture', string> = { defense: '국방', diplo: '외교', society: '내정', economy: '경제', culture: '문화' };

export function RecommendSheet({
  state,
  field,
  apply,
  onGo,
  onClose,
}: {
  state: GameState;
  field: AdviceField | 'culture';
  apply: (f: (s: GameState) => GameState) => void;
  onGo: (tab: string) => void;
  onClose: () => void;
}) {
  const [sort, setSort] = useState<TipSort>('gain');
  const [msg, setMsg] = useState('');
  const adv = field === 'culture' ? null : advisorOf(state, field);
  const culMin = field === 'culture' ? ministerOf(cabinetOf(state), 'mcst') : null;
  const person = adv?.p ?? culMin ?? null;
  const acc = adv ? adviceAccuracy(adv) : 0.6;
  const tips = field === 'culture' ? [] : pickAdvice(adviceTips(state, field), acc, adv ? adviceSeed(state, field, adv.p.id) : 0);
  const trades = field === 'economy' ? sortTips(tradeTips(state), sort).slice(0, 3) : [];
  const left = adviceLeft(state);
  const runnable = trades.filter((t) => !canRunTip(state, t));
  const sum = runnable.slice(0, left).reduce((a, t) => a + t.gain, 0);
  const lead =
    field === 'economy' && trades[0]
      ? `지금 시세로 보면 ${trades[0].res} ${trades[0].kind === 'flip' ? '되팔기' : trades[0].kind === 'sell' ? '팔기' : '사 두기'}가 제일 나아요. 길을 ${trades.length}가지 골라 왔어요.`
      : tips[0]
        ? tips[0].text
        : '지금은 특별히 드릴 말씀이 없어요.';
  const run = (t: TradeTip) => {
    const why = canRunTip(state, t);
    if (why) return setMsg(why);
    apply((s) => runTip(s, t));
    setMsg(`${t.res} ${t.qty}개 ${t.kind === 'flip' ? '되팔기' : t.kind === 'sell' ? '팔기' : '사기'} 했어요 (${t.gain >= 0 ? '+' : ''}${fmt(t.gain)})`);
  };
  return (
    <Modal title={`${NAME[field]} 장관 추천`} icon="💡" onClose={onClose}>
      <div className="rec-head">
        <span className="rec-face">{person ? <PersonFace p={person} size={72} /> : <span className="rec-noface">?</span>}</span>
        <div className="rec-say glass">
          <b>{adv ? `${adv.where} ${adv.p.name}` : culMin ? `문화체육관광부 장관 ${culMin.name}` : `${NAME[field]} 장관 없음`}</b>
          <span>{person ? (adv ? tone(adv.p.trait, lead) : lead) : '장관을 앉히면 이 자리에서 추천해 드려요(사람 → 인재).'}</span>
          {adv && <small>정확도 {Math.round(acc * 100)}% · 자리에 맞는 사람일수록 정확해요</small>}
        </div>
      </div>

      {field !== 'economy' && <RecCards state={state} apply={apply} field={field} go={onGo} />}
      {field === 'economy' && (
        <>
          <div className="rec-sorts">
            {(
              [
                ['gain', '💰 이득 큰 순'],
                ['ally', '🤝 연합국 먼저'],
                ['stock', '📦 창고 정리'],
              ] as Array<[TipSort, string]>
            ).map(([k, t]) => (
              <button key={k} className={`gx-chip ${sort === k ? 'am' : ''}`} onClick={() => setSort(k)}>
                {t}
              </button>
            ))}
            <span className="gx-chip te">
              남은 {left}/{ADVICE_PER_DAY}번 · {timeLeft(adviceResetIn(state))} 뒤 다시 채움
            </span>
          </div>
          {trades.length === 0 && <p className="empty">지금은 남는 거래가 없어요. 시세가 바뀌면 다시 골라 드릴게요.</p>}
          {trades.map((t, i) => {
            const why = canRunTip(state, t);
            return (
              <div key={t.id} className={`rec-card ${i === 0 ? 'best' : ''}`}>
                {i === 0 && <span className="rec-best">장관 강력 추천</span>}
                <span className="rec-ico">
                  <ResIcon res={t.res} />
                  <small>#{i + 1}</small>
                </span>
                <span className="rec-main">
                  <b>
                    {t.res} {t.qty}개 · {t.kind === 'flip' ? '되팔기' : t.kind === 'sell' ? '창고에서 팔기' : '사 두기'}
                  </b>
                  <span className="rec-route">
                    {t.from ? (
                      <>
                        <Flag id={t.from} size={0.6} /> {countryById(t.from).name}
                      </>
                    ) : (
                      <>
                        <Flag id={state.player.countryId} size={0.6} /> 우리 창고
                      </>
                    )}
                    <em>━━▶</em>
                    {t.to ? (
                      <>
                        <Flag id={t.to} size={0.6} /> {countryById(t.to).name}
                      </>
                    ) : (
                      <>우리 창고</>
                    )}
                  </span>
                  <span className="gx-chips">
                    {t.why.map((w) => (
                      <span key={w} className="gx-chip">
                        {w}
                      </span>
                    ))}
                  </span>
                </span>
                <span className="rec-side">
                  <b className={t.gain >= 0 ? 'rec-up' : 'rec-dn'}>
                    {t.gain >= 0 ? '+' : ''}
                    {fmt(t.gain)}
                  </b>
                  <small>{t.kind === 'buy' ? '예산 씀' : '나라 예산'}</small>
                  <button className={i === 0 ? 'btn-go' : 'btn-info'} disabled={!!why} title={why ?? ''} onClick={() => run(t)}>
                    실행
                  </button>
                </span>
              </div>
            );
          })}
          <div className="rec-auto glass">
            <span>
              <b>🤖 무역 맡기기</b>
              <small>장관이 1위 되팔기를 {ADVICE_RESET_H}시간마다 {ADVICE_PER_DAY}번까지 알아서 실행해요. 다시 접속하면 꺼져요</small>
            </span>
            <button className={`gx-switch ${autoOn(state) ? 'on' : ''}`} role="switch" aria-checked={autoOn(state)} onClick={() => apply((s) => setAuto(s, !autoOn(s)))}>
              <i />
            </button>
          </div>
          {runnable.length > 1 && left > 1 && (
            <button
              className="btn-go rec-all"
              onClick={() => {
                let n = 0;
                apply((s) => {
                  let x = s;
                  for (const t of runnable.slice(0, left)) {
                    const y = runTip(x, t);
                    if (y !== x) n++;
                    x = y;
                  }
                  return x;
                });
                setMsg(`추천 ${Math.min(runnable.length, left)}건을 모두 실행했어요`);
                void n;
              }}
            >
              {Math.min(runnable.length, left)}건 모두 실행 · {sum >= 0 ? '+' : ''}
              {fmt(sum)}
            </button>
          )}
          <details className="rec-why">
            <summary>왜 이 추천일까?</summary>
            <p>모든 나라 × 모든 자원의 지금 값(성향·연합 할인·숙적·항로 협정·체제 이득)을 견줘서 사는 값이 가장 싼 나라와 파는 값이 가장 비싼 나라를 짝지었어요. 한 번에 나라 예산의 1/4까지만 쓰고, 창고에는 {20}개씩 남겨요. 숙적과의 거래는 빼요.</p>
          </details>
        </>
      )}

      {tips.length > 0 && (
        <>
          <p className="rec-sub">{field === 'economy' ? '그 밖에 챙길 일' : '장관이 짚은 일'}</p>
          {tips.map((t, i) => (
            <div key={t.id} className={`rec-card small ${field !== 'economy' && i === 0 ? 'best' : ''}`}>
              <span className="rec-n">{i + 1}</span>
              <span className="rec-main">
                <b>{t.text}</b>
              </span>
              <button
                className={field !== 'economy' && i === 0 ? 'btn-go' : 'btn-info'}
                onClick={() => {
                  if (adv && canFollow(state, field as AdviceField)) apply((s) => followAdvice(s, field as AdviceField, adv.p.id, t.right));
                  onClose();
                  onGo(t.tab);
                }}
              >
                따르기
              </button>
            </div>
          ))}
        </>
      )}
      {msg && <p className="rec-msg">{msg}</p>}
    </Modal>
  );
}

/** 국정 화면 추천 줄에 쓸 한 줄 요약 */
export function recLine(state: GameState, field: AdviceField | 'culture'): { n: number; text: string } {
  if (field === 'economy') {
    const t = tradeTips(state).filter((x) => x.kind !== 'buy');
    const tips = adviceTips(state, 'economy').filter((x) => x.weight > 0);
    const parts = [...t.slice(0, 1).map((x) => `${x.res} ${x.kind === 'flip' ? '되팔기' : '팔기'} +${fmt(x.gain)}`), ...tips.slice(0, 1).map((x) => x.text.replace(/[.。]$/, ''))];
    return { n: Math.min(3, t.length) + tips.length, text: parts.join(' · ') || '지금은 챙길 일이 없어요' };
  }
  if (field === 'culture') return { n: 0, text: '문화 장관에게 물어보기' };
  const tips = adviceTips(state, field).filter((x) => x.weight > 0);
  return { n: tips.length, text: tips[0]?.text.replace(/[.。]$/, '') ?? '지금은 급한 일이 없어요' };
}
