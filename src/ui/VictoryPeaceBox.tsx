// 11-27 승전 강화: 이기고 있는 전쟁에서 점령한 도시 가운데 가질 곳을 골라 휴전(나라 창 안)
import { useState } from 'react';
import type { GameState } from '../game/state';
import { cityById } from '../data/cities';
import { countryById } from '../data/world';
import { canVictoryPeace, doVictoryPeace, peaceChance, peaceLost, peaceTaken, warLead } from '../game/victoryPeace';
import { relationOf } from '../game/world';

type ApplyWith = <T>(f: (s: GameState) => { state: GameState; out: T }) => T | undefined;

export function VictoryPeaceBox({ state, id, applyWith, onMsg }: { state: GameState; id: string; applyWith: ApplyWith; onMsg: (m: string) => void }) {
  const me = state.player.countryId;
  const taken = peaceTaken(state, id);
  const lost = peaceLost(state, id);
  const [keep, setKeep] = useState<string[]>([]);
  const [back, setBack] = useState<string[]>([]);
  if (relationOf(state.world, me, id) !== '전쟁' || !taken.length) return null;
  const k = keep.filter((c) => taken.includes(c));
  const b = back.filter((c) => lost.includes(c));
  const lead = warLead(state, id);
  const why = canVictoryPeace(state, id);
  const pct = Math.round(peaceChance(state, id, k, b) * 100);
  const nm = countryById(id).name;
  const flip = (list: string[], set: (v: string[]) => void, c: string) => set(list.includes(c) ? list.filter((x) => x !== c) : [...list, c]);
  return (
    <div className="annex-box vpeace">
      <b>📜 승전 강화 · 가질 도시 골라 휴전</b>
      <p className="small muted">
        전쟁 형세: 빼앗은 도시 {lead.took} · 빼앗긴 도시 {lead.lost} {lead.winning ? '· 🟢 이기는 중' : '· 이기고 있어야 해요'}. 고른 도시는 바로 우리 땅이 되지만 한동안 불안해서 반란이 날 수 있어요. 고르지 않은 점령 도시는 {nm}에 돌려줘요.
      </p>
      <div className="vpeace-list">
        {taken.map((c) => (
          <label key={c} className={`vpeace-pick ${k.includes(c) ? 'on' : ''}`}>
            <input type="checkbox" checked={k.includes(c)} onChange={() => flip(keep, setKeep, c)} />
            🏙️ {cityById(c).name}
            {cityById(c).capital ? ' 🏛️' : ''}
            <small>{k.includes(c) ? '갖기' : '돌려주기'}</small>
          </label>
        ))}
      </div>
      {lost.length > 0 && (
        <>
          <small className="muted">빼앗긴 우리 도시 돌려받기(고를수록 받아들일 확률 ↓)</small>
          <div className="vpeace-list">
            {lost.map((c) => (
              <label key={c} className={`vpeace-pick ${b.includes(c) ? 'on' : ''}`}>
                <input type="checkbox" checked={b.includes(c)} onChange={() => flip(back, setBack, c)} />
                ↩️ {cityById(c).name}
              </label>
            ))}
          </div>
        </>
      )}
      <button
        className="primary wide"
        disabled={!!why || !k.length}
        title={why ?? ''}
        onClick={() => {
          onMsg(applyWith((s) => { const r = doVictoryPeace(s, id, k, b); return { state: r.state, out: r.text }; }) ?? '');
          setKeep([]);
          setBack([]);
        }}
      >
        📜 승전 강화 제안 <small>{why ?? (k.length ? `${k.length}곳 갖기${b.length ? ` · ${b.length}곳 돌려받기` : ''} · 받아들일 확률 ${pct}%` : '가질 도시를 골라 주세요')}</small>
      </button>
      <small className="muted">많이 가질수록·수도를 고를수록 받아들일 확률이 내려가고, 돌려주는 도시가 많을수록 올라가요.</small>
    </div>
  );
}
