import type { ReactNode } from 'react';
import { Help } from './kit';
import { CITIES } from '../data/cities';
import { LEADERS, PERSONALITIES } from '../data/leaders';
import { BLOCS, FAITHS, countryById } from '../data/world';
import { gameClock } from '../game/state';
import { citiesOf, isAlive, pairKey, relationOf, type WorldEvent } from '../game/world';
import { REL_COLORS } from './WorldMap';
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

export function Card({ title, children, right, icon, help }: { title: string; children: ReactNode; right?: ReactNode; icon?: string; help?: ReactNode }) {
  return (
    <section className="card">
      <div className="card-head">
        <h3>
          {icon && <span className="card-ico">{icon}</span>}
          {title}
          {help && <Help title={title}>{help}</Help>}
        </h3>
        <span className="right">{right}</span>
      </div>
      {children}
    </section>
  );
}

export function RelTag({ state, id }: { state: GameState; id: string }) {
  const me = state.player.countryId;
  if (id === me) return <span className="tag me">내 나라</span>;
  const rel = relationOf(state.world, me, id);
  return (
    <span className="tag" style={{ background: REL_COLORS[rel], color: '#111' }}>
      {rel}
    </span>
  );
}

/** 긴장도 막대(전쟁·연합이면 표시 안 함) */
export function TensionBar({ state, a, b }: { state: GameState; a: string; b: string }) {
  if (a === b) return null;
  const p = state.world.pairs[pairKey(a, b)];
  if (!p || p.rel === '전쟁' || p.rel === '연합') return <span className="muted small">—</span>;
  return (
    <span className="tension" title={`긴장도 ${Math.round(p.tension)}`}>
      <span style={{ width: `${Math.min(100, p.tension)}%` }} />
    </span>
  );
}

export function leaderText(state: GameState, id: string): string {
  const l = LEADERS[id];
  const p = state.world.personalities[id];
  return `${l.title} ${l.name} · ${p}(${PERSONALITIES[p].text})`;
}

export function CountryInfo({ id, state }: { id: string; state: GameState }) {
  const me = state.player.countryId;
  const c = countryById(id);
  const n = state.nations[id];
  const w = state.world;
  const owned = citiesOf(w, id);
  const lost = CITIES.filter((x) => x.home === id && w.owner[x.id] !== id);
  const p = id === me ? null : w.pairs[pairKey(me, id)];
  return (
    <div className="country-info">
      <div className="row">
        <b>
          {c.name} <RelTag state={state} id={id} />
        </b>
        <span className="muted small">
          {BLOCS[c.bloc].name} · {c.difficulty}
        </span>
      </div>
      {!isAlive(w, id) && <p className="small warn">도시를 모두 잃었어요. 반란이 일어나면 되살아나요.</p>}
      <p className="small">지도자: {leaderText(state, id)}</p>
      {p && p.rel !== '전쟁' && p.rel !== '연합' && (
        <p className="small">
          우리와 긴장도 {Math.round(p.tension)} / 100 {p.rel === '휴전' ? '(100이 되면 휴전이 깨짐)' : ''}
        </p>
      )}
      {p && p.rel === '전쟁' && <p className="small">전쟁 피로도 {Math.round(p.weariness)} (높을수록 휴전하기 쉬움)</p>}
      <p className="small">
        도시:{' '}
        {owned
          .map((cid) => {
            const x = CITIES.find((y) => y.id === cid)!;
            return `${x.name}${x.capital && x.home === id ? '(수도)' : ''}${x.home !== id ? '(점령)' : ''} ${Math.round(w.defense[cid])}`;
          })
          .join(' · ') || '없음'}
      </p>
      {lost.length > 0 && (
        <p className="small warn">빼앗긴 도시: {lost.map((x) => `${x.name}(${countryById(w.owner[x.id]).name})`).join(' · ')}</p>
      )}
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
        국방예산 {fmt(n.treasury)} (시간당 +{fmt(budgetPerDay(state, id))}) · 병력 {fmt(n.troops)}명 (시간당 +
        {fmt(troopsPerDay(state, id))})
      </p>
      <p className="small muted">
        {c.intro} · 시작 수치: 경제 {c.economy} · 국방예산 {c.budget} · 군사력 {c.military}
      </p>
    </div>
  );
}

const KIND_ICON: Record<string, string> = { 외교: '📜', 전투: '⚔️', 점령: '🚩', 신앙: '🕯️', 멸망: '💀' };

export function EventList({ events, limit }: { events: WorldEvent[]; limit?: number }) {
  const list = limit ? events.slice(0, limit) : events;
  if (list.length === 0) return <p className="small muted">아직 소식이 없어요.</p>;
  return (
    <ul className="events">
      {list.map((e, i) => {
        const c = gameClock(e.t);
        return (
          <li key={`${e.t}-${i}`} className={e.mine ? 'mine' : ''}>
            <span className="ev-ico">{KIND_ICON[e.kind]}</span>
            <span>
              {e.text}
              <small className="muted">
                {' '}
                {c.month}/{c.day} {String(c.hour).padStart(2, '0')}시
              </small>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
