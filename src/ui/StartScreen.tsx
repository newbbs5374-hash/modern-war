import { useState } from 'react';
import { BLOCS, COUNTRIES } from '../data/world';
import { HallList } from './victoryScreens';
import { loadHall } from '../game/victory';
import { Flag } from './flag';
import { LEADERS } from '../data/leaders';
import { specialsOf } from '../data/specials';

interface Props {
  onStart: (name: string, countryId: string, randomLeaders: boolean) => void;
  onImport: (code: string) => string | null;
}

/** 새 게임: 이름과 나라 고르기 */
export function StartScreen({ onStart, onImport }: Props) {
  const [name, setName] = useState('');
  const [pick, setPick] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [err, setErr] = useState('');
  const [randomLeaders, setRandomLeaders] = useState(false);

  const [open, setOpen] = useState<string | null>(null);

  return (
    <div className="start start-compact">
      <h1>현대전 사령관 · 시험판</h1>
      <p className="muted small start-intro">
        가까운 미래, 13개 나라는 평화롭게 출발하지만 자원과 바닷길을 두고 긴장이 쌓여요. 나라를 골라 지도자로 취임하세요.
        세계 시계는 실제 1시간 = 게임 하루예요.
      </p>
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
                </div>
              )}
            </div>
          );
        })}
      </div>
      <label className="check">
        <input type="checkbox" checked={randomLeaders} onChange={(e) => setRandomLeaders(e.target.checked)} />
        AI 지도자 성향을 무작위로 (판마다 다른 세계)
      </label>
      <button
        className="primary big"
        disabled={!pick || !name.trim()}
        onClick={() => pick && onStart(name.trim(), pick, randomLeaders)}
      >
        {pick && name.trim() ? '지도자로 취임하기' : '이름을 쓰고 나라를 고르세요'}
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
