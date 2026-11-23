import { useState } from 'react';
import { BLOCS, COUNTRIES } from '../data/world';
import { HallList } from './victoryScreens';
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

  return (
    <div className="start">
      <h1>현대전 사령관 · 시험판</h1>
      <p className="muted">
        대융기로 바다에서 떠오른 새 군도, 여명 군도. 막 세워진 나라들은 평화롭게 출발하지만 자원과 항로를 두고 긴장이
        쌓입니다. 나라를 골라 지도자로 취임하세요. 처음엔 임시 지도자이고, 명성과 신뢰를 쌓아 전설의 지도자까지 등급을 올려요. 세계 시계는 실제 1시간 = 게임 하루로 흐르고, 게임을 꺼 두어도 흐릅니다.
      </p>
      <label className="field">
        장교 이름
        <input value={name} maxLength={12} placeholder="예: 김철수" onChange={(e) => setName(e.target.value)} />
      </label>
      <HallList />
      <h2>나라 고르기</h2>
      <div className="country-grid">
        {COUNTRIES.map((c) => (
          <button
            key={c.id}
            className={`country-card ${pick === c.id ? 'picked' : ''}`}
            style={{ borderColor: BLOCS[c.bloc].color }}
            onClick={() => setPick(c.id)}
          >
            <div className="row">
              <Flag id={c.id} size={1.2} />
              <b>{c.name}</b>
              <span className={`diff diff-${c.difficulty.replace(' ', '')}`}>{c.difficulty}</span>
            </div>
            <div className="muted small">
              {BLOCS[c.bloc].name} · {LEADERS[c.id].title} {LEADERS[c.id].name}
            </div>
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
            <div className="small">⭐ {c.ability.name}</div>
            <div className="small muted">
              🌟 {specialsOf(c.id)
                .map((d) => d.name)
                .join(' · ')}
            </div>
          </button>
        ))}
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

      <details className="import">
        <summary>저장 코드로 이어하기</summary>
        <textarea value={code} onChange={(e) => setCode(e.target.value)} placeholder="저장 코드를 붙여 넣으세요" />
        <button onClick={() => setErr(onImport(code) ?? '')}>불러오기</button>
        {err && <div className="error">{err}</div>}
      </details>
    </div>
  );
}
