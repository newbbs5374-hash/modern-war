import { useState } from 'react';
import { BLOCS, COUNTRIES } from '../data/world';
import { HallList } from './victoryScreens';
import { loadHall } from '../game/victory';
import { Flag } from './flag';
import { LEADERS } from '../data/leaders';
import { specialsOf } from '../data/specials';
import { ORIGINS, originFits, originOpen, type OriginId } from '../game/origin';
import { STAT_ICON } from './icons';
import { conflictsOf, otherSide, NOW_CONFLICTS } from '../data/conflicts';
import { LEADER_LOOKS, lookName, playerKeys, type LeaderLook } from '../data/looks';
import { Face } from './Portrait';
import { CloudStartCard } from './CloudUI';

export interface StartPick {
  randomLeaders: boolean;
  origin: OriginId;
  look: LeaderLook;
  realWorld: boolean;
}

interface Props {
  onStart: (name: string, countryId: string, pick: StartPick) => void;
  onImport: (code: string) => string | null;
  /** 카카오 서버 저장으로 이어 하기 */
  onCloud: () => void;
}

/** 새 게임: 이름과 나라 고르기 */
export function StartScreen({ onStart, onImport, onCloud }: Props) {
  const [name, setName] = useState('');
  const [pick, setPick] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [err, setErr] = useState('');
  const [randomLeaders, setRandomLeaders] = useState(false);

  const [open, setOpen] = useState<string | null>(null);
  const [step, setStep] = useState<'country' | 'face' | 'origin'>('country');
  const [look, setLook] = useState<LeaderLook>('m40');
  const [realWorld, setRealWorld] = useState(true);
  const [origin, setOrigin] = useState<OriginId>('econ');
  const hall = loadHall();

  if (step === 'origin' && pick) {
    const o = ORIGINS.find((x) => x.id === origin)!;
    const c = COUNTRIES.find((x) => x.id === pick)!;
    return (
      <div className="start start-compact">
        <h1>출신 고르기</h1>
        <p className="muted small start-intro">
          <Flag id={c.id} size={0.8} /> {c.name}의 새 지도자 {name.trim()}. 어떤 길을 걸어 왔나요? 출신에 따라 첫 스탯과 혜택·약점이 달라져요(스탯 합은 같아요). ★ = {c.name}와(과) 잘 맞음(혜택 1.5배).
        </p>
        <div className="origin-grid">
          {ORIGINS.map((x) => {
            const ok = originOpen(x, hall);
            return (
              <button key={x.id} className={`origin-tile ${origin === x.id ? 'on' : ''} ${ok ? '' : 'locked'}`} disabled={!ok} onClick={() => setOrigin(x.id)} title={ok ? x.line : `🔒 ${x.lock?.text}`}>
                <span className="ot-ico">{ok ? x.icon : '🔒'}</span>
                <small>{x.name}</small>
                {ok && originFits(x, c.id) && <i className="ot-star">★</i>}
              </button>
            );
          })}
        </div>
        <section className="card origin-detail">
          <div className="row">
            <b>
              {o.icon} {o.name}
              {originFits(o, c.id) ? ' ★' : ''}
            </b>
            <small className="muted">{o.line}</small>
          </div>
          <div className="origin-stats">
            {Object.entries(o.stats).map(([k, v]) => (
              <span key={k} className={v! > 0 ? 'up' : 'down'}>
                {STAT_ICON[k as keyof typeof STAT_ICON]} {k} {v! > 0 ? `+${v}` : v}
              </span>
            ))}
          </div>
          <div className="small">✅ {o.perk}</div>
          <div className="small">⚠️ {o.weak}</div>
          <div className="small muted">
            🙂 지지도 {o.startApproval} · 🤝 신뢰도 {o.startTrust} 출발 · 👥 옛 동료: {o.buddy}
          </div>
        </section>
        <small className="muted">🔒 잠긴 출신: {ORIGINS.filter((x) => !originOpen(x, hall)).map((x) => `${x.name}(${x.lock!.text})`).join(' · ') || '없음'}</small>
        <div className="row" style={{ gap: 6, marginTop: 8 }}>
          <button onClick={() => setStep('face')}>← 얼굴</button>
          <button className="primary big" style={{ flex: 1 }} onClick={() => onStart(name.trim(), pick, { randomLeaders, origin, look, realWorld })}>
            지도자로 취임하기
          </button>
        </div>
      </div>
    );
  }

  if (step === 'face' && pick) {
    const c = COUNTRIES.find((x) => x.id === pick)!;
    return (
      <div className="start start-compact">
        <h1>지도자 얼굴 고르기</h1>
        <p className="muted small start-intro">
          <Flag id={c.id} size={0.8} /> {c.name}의 새 지도자 {name.trim()}. 내 사진으로 쓸 얼굴을 골라 주세요. 게임 안 내 사진·프로필 카드에 나와요.
        </p>
        <div className="look-grid">
          {LEADER_LOOKS.map((l) => (
            <button key={l} className={`look-tile ${look === l ? 'on' : ''}`} onClick={() => setLook(l)}>
              <span className="look-photo">
                <Face keys={playerKeys({ countryId: c.id, look: l })} fallback={l[0] === 'm' ? '👨' : '👩'} />
              </span>
              <small>{lookName(l)}</small>
            </button>
          ))}
        </div>
        <section className="card look-big">
          <span className="look-photo big">
            <Face keys={playerKeys({ countryId: c.id, look })} fallback={look[0] === 'm' ? '👨' : '👩'} />
          </span>
          <div>
            <b>{name.trim()}</b>
            <div className="small muted">
              {c.name} 지도자 · {lookName(look)}
            </div>
            <div className="small muted">얼굴은 모습만 바꿔요. 스탯·능력은 다음 단계 출신에서 정해져요.</div>
          </div>
        </section>
        <div className="row" style={{ gap: 6, marginTop: 8 }}>
          <button onClick={() => setStep('country')}>← 나라</button>
          <button className="primary big" style={{ flex: 1 }} onClick={() => setStep('origin')}>
            다음: 출신 고르기 ▸
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="start start-compact">
      <h1>현대전 사령관 · 시험판</h1>
      <p className="muted small start-intro">
        {realWorld
          ? '지금 세계 그대로 시작해요. 러시아와 우크라이나는 전쟁 중이고, 중동과 한반도는 불안한 휴전이에요. 나라를 골라 지도자로 취임하세요. '
          : '가까운 미래, 13개 나라는 평화롭게 출발하지만 자원과 바닷길을 두고 긴장이 쌓여요. 나라를 골라 지도자로 취임하세요. '}
        세계 시계는 실제 1시간 = 게임 하루예요.
      </p>
      <CloudStartCard onContinue={onCloud} />
      <label className="field start-name">
        지도자 이름
        <input value={name} maxLength={12} placeholder="예: 김철수" onChange={(e) => setName(e.target.value)} />
      </label>
      <div className="country-list" role="list">
        {COUNTRIES.map((c) => {
          const isOpen = open === c.id;
          const L = LEADERS[c.id];
          return (
            <div key={c.id} role="listitem" className={`country-line ${pick === c.id ? 'picked' : ''} ${isOpen ? 'open' : ''}`} style={{ borderLeftColor: BLOCS[c.bloc].color }}>
              <button
                className="cl-head"
                aria-expanded={isOpen}
                onClick={() => {
                  setPick(c.id);
                  setOpen(isOpen ? null : c.id);
                }}
              >
                <Flag id={c.id} size={0.9} />
                <b>{c.name}</b>
                <small className="muted cl-bloc">{BLOCS[c.bloc].name}</small>
                {realWorld && conflictsOf(c.id).some((x) => x.rel !== '중립') && (
                  <span className={`cl-war ${conflictsOf(c.id).some((x) => x.rel === '전쟁') ? 'hot' : ''}`}>{conflictsOf(c.id).some((x) => x.rel === '전쟁') ? '⚔️ 전쟁 중' : '⚠️ 휴전'}</span>
                )}
                <span className={`diff diff-${c.difficulty.replace(' ', '')}`}>{c.difficulty}</span>
                <span className="cl-arrow">{isOpen ? '▾' : '▸'}</span>
              </button>
              {isOpen && (
                <div className="cl-body small">
                  <div className="muted">
                    {L.title} {L.name} · {c.intro}
                  </div>
                  <div className="cl-stats">
                    {(['경제', '예산', '군사'] as const).map((k) => {
                      const v = k === '경제' ? c.economy : k === '예산' ? c.budget : c.military;
                      return (
                        <div key={k} className="cc-stat">
                          <small>{k}</small>
                          <span className="bar">
                            <span className="bar-fill" style={{ width: `${v}%` }} />
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  <div>
                    ⭐ <b>{c.ability.name}</b> <span className="muted">{c.ability.effect}</span>
                  </div>
                  <div className="muted">
                    🌟 {specialsOf(c.id)
                      .map((d) => d.name)
                      .join(' · ')}
                  </div>
                  <div className="muted">🏙️ {c.cities.join(' · ')}</div>
                  {realWorld &&
                    conflictsOf(c.id).map((x) => (
                      <div key={x.name} className={x.rel === '전쟁' ? 'cl-war-line hot' : 'cl-war-line'}>
                        {x.icon} <b>{x.name}</b> <span className="muted">· {COUNTRIES.find((o) => o.id === otherSide(x, c.id))!.name}와(과) {x.rel === '전쟁' ? '전쟁 중' : x.rel === '휴전' ? '휴전 중' : `긴장 ${x.tension}`}</span>
                      </div>
                    ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <label className="check" title={NOW_CONFLICTS.map((x) => `${x.icon} ${x.name}`).join('\n')}>
        <input type="checkbox" checked={realWorld} onChange={(e) => setRealWorld(e.target.checked)} />
        지금 세계 정세로 시작 (러-우 전쟁 중 · 끄면 모두 평화)
      </label>
      <label className="check">
        <input type="checkbox" checked={randomLeaders} onChange={(e) => setRandomLeaders(e.target.checked)} />
        AI 지도자 성향을 무작위로 (판마다 다른 세계)
      </label>
      <button
        className="primary big"
        disabled={!pick || !name.trim()}
        onClick={() => pick && setStep('face')}
      >
        {pick && name.trim() ? '다음: 얼굴 고르기 ▸' : '이름을 쓰고 나라를 고르세요'}
      </button>

      {loadHall().length > 0 && (
        <details className="import">
          <summary>명예의 전당</summary>
          <HallList />
        </details>
      )}
      <details className="import">
        <summary>저장 코드로 이어하기</summary>
        <textarea value={code} onChange={(e) => setCode(e.target.value)} placeholder="저장 코드를 붙여 넣으세요" />
        <button onClick={() => setErr(onImport(code) ?? '')}>불러오기</button>
        {err && <div className="error">{err}</div>}
      </details>
    </div>
  );
}
