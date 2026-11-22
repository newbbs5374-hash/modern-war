import type { ReactNode } from 'react';
import { BLOCS, FAITHS, countryById, startingRelation } from '../data/world';
import { RANKS } from '../data/ranks';
import { budgetPerDay, troopsPerDay, type GameState } from '../game/state';

export const HOUR = 60 * 60 * 1000;
export const fmt = (n: number) => Math.floor(n).toLocaleString('ko-KR');

/** 계급이 모자라면 잠금 글 */
export function rankLock(state: GameState, rank: number): string | null {
  return state.player.rankIndex >= rank ? null : `${RANKS[rank].name}부터`;
}

/** 다음 단계에서 만들 기능 자리 */
export function Soon({ stage, children }: { stage: string; children: ReactNode }) {
  return (
    <div className="soon">
      <span className="tag">{stage}</span> {children}
    </div>
  );
}

export function Card({ title, children, right }: { title: string; children: ReactNode; right?: ReactNode }) {
  return (
    <section className="card">
      <div className="card-head">
        <h3>{title}</h3>
        {right}
      </div>
      {children}
    </section>
  );
}

export function CountryInfo({ id, state }: { id: string; state: GameState }) {
  const me = state.player.countryId;
  const c = countryById(id);
  const n = state.nations[id];
  return (
    <div className="country-info">
      <div className="row">
        <b>{c.name}</b>
        <span className="muted small">
          {BLOCS[c.bloc].name} · {id === me ? '내 나라' : `우리와 ${startingRelation(me, id)}`} · {c.difficulty}
        </span>
      </div>
      <p className="small">거점 도시: {c.cities.map((x, i) => (i === 0 ? `${x}(수도)` : x)).join(' · ')}</p>
      <p className="small">
        시작 수치: 경제 {c.economy} · 국방예산 {c.budget} · 군사력 {c.military}
        {c.estimated ? ' (일부 추정)' : ''} · 군사력 {c.gfpRank2026}위
      </p>
      <p className="small">
        신앙: {FAITHS[c.faith].name}({c.faithStrength}) — {FAITHS[c.faith].trait}
      </p>
      <p className="small">
        특별 병과: {c.specialUnit.name}({c.specialUnit.base}) — {c.specialUnit.effect}
      </p>
      <p className="small">
        특수 능력: {c.ability.name} — {c.ability.effect}
      </p>
      <p className="small">
        지금: 국방예산 {fmt(n.treasury)} (시간당 +{fmt(budgetPerDay(id))}) · 병력 {fmt(n.troops)}명 (시간당 +
        {fmt(troopsPerDay(id))})
      </p>
    </div>
  );
}
