// 인물 카드 2열 · 정렬 · 필터 · 자리 안내(11-24 대장 요청 3번)
import { useState } from 'react';
import { FACTIONS, GRADES, PERSON_ORIGINS, SPECS, TRAITS, ministryById, type PersonOrigin, type SpecId, type Trait } from '../data/cabinet';
import type { Need } from '../data/needs';
import { postById } from '../data/staff';
import { ALL_STATS, STAT18, STAT_GROUPS18, originStrongWeak, type AnyStat } from '../data/stats2';
import { COUNTRIES } from '../data/world';
import { cabinetOf, fitPct, type Person } from '../game/cabinet';
import { statTotal } from '../game/cabinetOps';
import type { GameState } from '../game/state';
import { PersonFace } from './CabinetUI';
import { Flag } from './flag';

/** 인물 카드(2열용): 얼굴 · 이름·나이 · 자리 · 출신 · 등급 · 상위 스탯 3 · 성향 · 충성 */
export function PersonCard({ state, p, onOpen, badge }: { state: GameState; p: Person; onOpen: () => void; badge?: React.ReactNode }) {
  const seat = p.seat ? `${ministryById(p.seat.id).short} ${p.seat.kind === 'min' ? '장관' : '차관'}` : p.post ? postById(p.post).name : p.title || '';
  const top3 = [...ALL_STATS].sort((a, b) => (p.stats[b] ?? 0) - (p.stats[a] ?? 0)).slice(0, 3);
  const hearing = cabinetOf(state).hearing?.pid === p.id;
  const o = PERSON_ORIGINS[p.origin];
  return (
    <button className={`pcard ${p.seat || p.post ? 'on' : ''}`} onClick={onOpen}>
      <span className="pcard-face">
        <PersonFace p={p} size={52} />
        <span className="pcard-grade">{GRADES[p.grade].icon}</span>
      </span>
      <span className="pcard-main">
        <b className="pcard-name">
          {p.name} <small>{p.age}</small>
          {p.country !== state.player.countryId && <Flag id={p.country} size={0.45} />}
        </b>
        <small className="pcard-seat">{hearing ? '🏛️ 청문회 중' : seat || '자리 없음'}</small>
        <small className="pcard-org">
          {o.icon}
          {o.name} · {TRAITS[p.trait].icon}
          {p.trait}
        </small>
        <span className="pcard-stats">
          {top3.map((id) => (
            <span key={id}>
              {STAT18[id].icon}
              {id}
              <b>{p.stats[id]}</b>
            </span>
          ))}
        </span>
        <span className="pcard-loy">
          <i style={{ width: `${Math.round(p.loyalty)}%` }} className={p.loyalty >= 70 ? 'g' : p.loyalty < 35 ? 'r' : 'y'} />
        </span>
      </span>
      {badge !== undefined ? <span className="pcard-badge">{badge}</span> : <span className="pcard-badge muted">Σ{statTotal(p)}</span>}
    </button>
  );
}

type SortKey = 'power' | 'loyalty' | 'age' | 'name' | 'new' | AnyStat;
type Filter = { seat: 'all' | 'yes' | 'no'; origin: PersonOrigin | ''; spec: SpecId | ''; trait: Trait | ''; faction: string; grade: string; country: string };
const NO_FILTER: Filter = { seat: 'all', origin: '', spec: '', trait: '', faction: '', grade: '', country: '' };

/** 정렬·필터가 붙은 인물 카드 2열 */
export function PeopleGrid({ state, list, onOpen, badge, empty }: { state: GameState; list: Person[]; onOpen: (id: number) => void; badge?: (p: Person) => React.ReactNode; empty?: string }) {
  const [sort, setSort] = useState<SortKey>('power');
  const [f, setF] = useState<Filter>(NO_FILTER);
  const [open, setOpen] = useState(false);
  const shown = list
    .filter(
      (p) =>
        (f.seat === 'all' || (f.seat === 'yes') === !!(p.seat || p.post)) &&
        (!f.origin || p.origin === f.origin) &&
        (!f.spec || p.spec === f.spec) &&
        (!f.trait || p.trait === f.trait) &&
        (!f.faction || p.faction === f.faction) &&
        (!f.grade || p.grade === f.grade) &&
        (!f.country || p.country === f.country),
    )
    .sort((a, b) => {
      switch (sort) {
        case 'power':
          return statTotal(b) - statTotal(a);
        case 'loyalty':
          return b.loyalty - a.loyalty;
        case 'age':
          return a.age - b.age;
        case 'name':
          return a.name.localeCompare(b.name, 'ko');
        case 'new':
          return b.sinceMs - a.sinceMs;
        default:
          return (b.stats[sort] ?? 0) - (a.stats[sort] ?? 0);
      }
    });
  const nf = Object.entries(f).filter(([k, v]) => (k === 'seat' ? v !== 'all' : !!v)).length;
  const origins = [...new Set(list.map((p) => p.origin))];
  const countries = [...new Set(list.map((p) => p.country))];
  return (
    <div className="pgrid-wrap">
      <div className="pgrid-bar">
        <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} aria-label="정렬">
          <option value="power">↕ 능력순(스탯 합)</option>
          <option value="loyalty">↕ 충성순</option>
          <option value="new">↕ 들어온 순</option>
          <option value="age">↕ 젊은 순</option>
          <option value="name">↕ 이름순</option>
          {STAT_GROUPS18.map((g) => (
            <optgroup key={g.name} label={`${g.icon} ${g.name}`}>
              {g.ids.map((id) => (
                <option key={id} value={id}>
                  {STAT18[id].icon} {id} 높은 순
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <button className={`pgrid-fbtn ${nf ? 'on' : ''}`} onClick={() => setOpen(!open)}>
          🔍 필터{nf ? ` ${nf}` : ''}
        </button>
        <small className="muted">{shown.length}명</small>
      </div>
      <div className="pgrid-chips">
        {(['all', 'yes', 'no'] as const).map((v) => (
          <button key={v} className={f.seat === v ? 'on' : ''} onClick={() => setF({ ...f, seat: v })}>
            {v === 'all' ? '전체' : v === 'yes' ? '🪑 자리 있음' : '💤 자리 없음'}
          </button>
        ))}
      </div>
      {open && (
        <div className="pgrid-filters">
          <select value={f.origin} onChange={(e) => setF({ ...f, origin: e.target.value as PersonOrigin | '' })}>
            <option value="">출신 전체</option>
            {origins.map((o) => (
              <option key={o} value={o}>
                {PERSON_ORIGINS[o].icon} {PERSON_ORIGINS[o].name}
              </option>
            ))}
          </select>
          <select value={f.spec} onChange={(e) => setF({ ...f, spec: e.target.value as SpecId | '' })}>
            <option value="">특화 전체</option>
            {SPECS.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
          <select value={f.trait} onChange={(e) => setF({ ...f, trait: e.target.value as Trait | '' })}>
            <option value="">성향 전체</option>
            {(Object.keys(TRAITS) as Trait[]).map((x) => (
              <option key={x} value={x}>
                {TRAITS[x].icon} {x}
              </option>
            ))}
          </select>
          <select value={f.faction} onChange={(e) => setF({ ...f, faction: e.target.value })}>
            <option value="">파벌 전체</option>
            {FACTIONS.map((x) => (
              <option key={x.id} value={x.id}>
                {x.icon} {x.id}
              </option>
            ))}
          </select>
          <select value={f.grade} onChange={(e) => setF({ ...f, grade: e.target.value })}>
            <option value="">등급 전체</option>
            {Object.keys(GRADES).map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
          {countries.length > 1 && (
            <select value={f.country} onChange={(e) => setF({ ...f, country: e.target.value })}>
              <option value="">나라 전체</option>
              {countries.map((x) => (
                <option key={x} value={x}>
                  {COUNTRIES.find((c) => c.id === x)?.name ?? x}
                </option>
              ))}
            </select>
          )}
          {nf > 0 && <button onClick={() => setF(NO_FILTER)}>↺ 필터 지우기</button>}
        </div>
      )}
      <div className="pgrid">
        {shown.map((p) => (
          <PersonCard key={p.id} state={state} p={p} onOpen={() => onOpen(p.id)} badge={badge?.(p)} />
        ))}
      </div>
      {!shown.length && <p className="empty">{list.length ? '조건에 맞는 사람이 없어요.' : (empty ?? '아직 없어요.')}</p>}
    </div>
  );
}

/** 인물 창 스탯 18개(5갈래) */
export function Stats18({ p }: { p: Person }) {
  const best = Math.max(...ALL_STATS.map((id) => p.stats[id] ?? 0));
  return (
    <div className="stats18">
      {STAT_GROUPS18.map((g) => (
        <div key={g.name} className="stats18-row">
          <small className="stats18-g">
            {g.icon} {g.name}
          </small>
          <span className="stats18-v">
            {g.ids.map((id) => (
              <span key={id} className={(p.stats[id] ?? 0) === best ? 'top' : ''} title={STAT18[id].text}>
                <small>{id}</small>
                <b>{p.stats[id] ?? '-'}</b>
              </span>
            ))}
          </span>
        </div>
      ))}
    </div>
  );
}

/** 자리 안내: 어떤 스탯·성향·출신이 중요한지 */
export function NeedBox({ need, spec, title = '이 자리에 중요한 것' }: { need: Need; spec: readonly string[]; title?: string }) {
  return (
    <div className="needbox small">
      <b>📌 {title}</b>
      <div>
        ⭐⭐ 주 스탯: {need.main.map((x) => `${STAT18[x].icon}${x}`).join(' · ')} <span className="muted">(능력의 80%)</span>
      </div>
      <div>
        ⭐ 보조 스탯: {STAT18[need.sub].icon}
        {need.sub} <span className="muted">(20%)</span>
      </div>
      <div>
        🧭 맞는 성향: {need.traits.map((t) => `${TRAITS[t].icon}${t}`).join(' · ')} <span className="muted">(+10%)</span>
      </div>
      <div>
        🎓 맞는 출신: {need.origins.map((o) => `${PERSON_ORIGINS[o].icon}${PERSON_ORIGINS[o].name}`).join(' · ')} <span className="muted">(+5%)</span>
      </div>
      <div>
        🎯 맞는 특화: {spec.join(' · ')} <span className="muted">(+30%)</span>
      </div>
    </div>
  );
}

/** 적합도 막대 */
export function FitTag({ p, need, spec }: { p: Person; need: Need; spec: readonly string[] }) {
  const v = fitPct(p, need, spec);
  const stars = v >= 85 ? '★★★' : v >= 65 ? '★★' : v >= 45 ? '★' : '·';
  return (
    <span className={`fit ${v >= 65 ? 'good' : v < 45 ? 'low' : ''}`} title="적합도">
      <b>{v}%</b>
      <small>{stars}</small>
    </span>
  );
}

/** 출신 강약 한 줄 */
export function originLine(o: PersonOrigin, shape2: Partial<Record<AnyStat, number>>): string {
  const sw = originStrongWeak({ ...PERSON_ORIGINS[o].shape, ...shape2 });
  return `강함 ${sw.strong.join('·')} / 약함 ${sw.weak.join('·')}`;
}
