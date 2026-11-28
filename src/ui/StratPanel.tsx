// 11-28 국방 → 전략군: ICBM 개발·배치·발사(재래식/핵)
import { useState } from 'react';
import worldMap from '../assets/world/world-map.webp';
import { CITIES, cityById } from '../data/cities';
import { COUNTRIES, countryById } from '../data/world';
import { GEO } from '../data/realmap';
import { CONV, FLIGHT_MS, NUKE, TESTS_NEED, canLaunch, canStep, interceptOf, launch, myDeter, nextStep, startStep, stepCost, stepDef, stratOf, targetCities, type StratStep } from '../game/strat';
import { DEFAULT_ICBM, ICBM_MAX, icbmOf, isAlive, relationOf } from '../game/world';
import { Card, fmt } from './common';
import { FLAG } from './flag';
import { timeLeft } from './officerScreens';
import type { ScreenProps } from './screens';

const DEV: StratStep[] = ['research', 'engine', 'test'];

export function StratPanel({ state, actions }: ScreenProps) {
  const st = stratOf(state);
  const me = state.player.countryId;
  const [msg, setMsg] = useState('');
  const [foe, setFoe] = useState<string>('');
  const [city, setCity] = useState<string>('');
  const [arm, setArm] = useState<'conv' | 'nuke' | null>(null);
  const run = (f: (s: typeof state) => { state: typeof state; out: string }) => setMsg(actions.applyWith<string>(f) ?? '');
  const job = st.job;
  const next = nextStep(st);
  const targets = targetCities(state);
  const foes = COUNTRIES.filter((c) => targets.some((id) => state.world.owner[id] === c.id)).sort((a, b) => Number(relationOf(state.world, me, b.id) === '전쟁') - Number(relationOf(state.world, me, a.id) === '전쟁'));
  const foeCities = foe ? targets.filter((id) => state.world.owner[id] === foe).sort((a, b) => Number(cityById(b).capital) - Number(cityById(a).capital) || cityById(b).value - cityById(a).value) : [];
  const ready = st.deployed - st.flights.length;
  const nukers = COUNTRIES.filter((c) => c.id !== me && isAlive(state.world, c.id) && icbmOf(state.world, c.id) > 0);
  return (
    <>
      <Card title="☢️ 전략군 사령부" right={<small className="muted">갖고 있으면 억지력, 쏘면 세계가 등을 돌려요</small>}>
        <div className="strat-steps">
          {DEV.map((id, i) => {
            const d = stepDef(id);
            const done = st.stage > i;
            const now = job?.step === id || (!job && next === id);
            return (
              <span key={id} className={done ? 'ok' : now ? 'now' : ''}>
                {d.icon} {d.name}
                {id === 'test' ? ` ${Math.min(st.tests, TESTS_NEED)}/${TESTS_NEED}` : ''}
                {done ? ' ✓' : ''}
              </span>
            );
          })}
          <span className={st.stage >= 3 ? 'ok' : ''}>🏗️ 실전 배치{st.stage >= 3 ? ' ✓' : ''}</span>
        </div>
        {job ? (
          <p className="small">
            {stepDef(job.step).icon} {stepDef(job.step).name} 중 · {timeLeft(Math.max(0, job.endMs - state.worldMs))} 남음
            <span className="bar">
              <span className="bar-fill" style={{ width: `${Math.min(100, 100 - ((job.endMs - state.worldMs) / (stepDef(job.step).hours * 3600e3)) * 100)}%` }} />
            </span>
          </p>
        ) : next ? (
          <>
            <p className="small muted">{stepDef(next).text}</p>
            <button className="gold wide" disabled={!!canStep(state, next)} title={canStep(state, next) ?? ''} onClick={() => run((s) => { const r = startStep(s, next); return { state: r.state, out: r.text }; })}>
              {stepDef(next).icon} {stepDef(next).name} 시작 · 💰{fmt(stepCost(state, next))} · {stepDef(next).hours}시간
            </button>
          </>
        ) : null}
        <h4 className="strat-h">
          배치 <span className="gx-chip te">{st.deployed} / {ICBM_MAX}기</span>
          {myDeter(state) > 0 && <span className="gx-chip up">억지력: 쳐들어올 확률 −{myDeter(state)}%</span>}
          {st.nuke && <span className="gx-chip am">☢️ 핵탄두</span>}
        </h4>
        <div className="strat-silos">
          {Array.from({ length: ICBM_MAX }, (_, i) => (
            <span key={i} className={i < ready ? 'f' : i < st.deployed ? 'fly' : ''}>{i < ready ? '🚀' : i < st.deployed ? '✈️' : '＋'}</span>
          ))}
        </div>
        {st.stage >= 3 && !job && (
          <div className="strat-row">
            <button disabled={!!canStep(state, 'build')} title={canStep(state, 'build') ?? ''} onClick={() => run((s) => { const r = startStep(s, 'build'); return { state: r.state, out: r.text }; })}>
              🏗️ 1기 더 세우기 · 💰{fmt(stepCost(state, 'build'))} · 24시간
            </button>
            {!st.nuke && (
              <button className="danger" disabled={!!canStep(state, 'nuke')} title={canStep(state, 'nuke') ?? ''} onClick={() => run((s) => { const r = startStep(s, 'nuke'); return { state: r.state, out: r.text }; })}>
                ☢️ 핵탄두 개발 · 💰{fmt(stepCost(state, 'nuke'))} · 48시간
              </button>
            )}
          </div>
        )}
        {!st.nuke && st.stage >= 3 && <p className="small muted">{stepDef('nuke').text}</p>}
        {msg && <p className="small sch-msg">{msg}</p>}
      </Card>

      {st.deployed > 0 && (
        <Card title="🎯 발사" right={<small className="muted">쏠 수 있는 것 {ready}기</small>}>
          <select className="strat-select" value={foe} onChange={(e) => { setFoe(e.target.value); setCity(''); setArm(null); }}>
            <option value="">쏠 나라 고르기…</option>
            {foes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} · {relationOf(state.world, me, c.id)} · 요격 {Math.round(interceptOf(c.id) * 100)}%
              </option>
            ))}
          </select>
          {foe && (
            <div className="strat-cities">
              {foeCities.slice(0, 12).map((id) => (
                <button key={id} className={city === id ? 'on' : ''} onClick={() => { setCity(id); setArm(null); }}>
                  {cityById(id).capital ? '⭐' : ''}{cityById(id).name}
                  <small>방어 {Math.round(state.world.defense[id] ?? 0)}</small>
                </button>
              ))}
            </div>
          )}
          {city && <FlightMap from={myCapital(state)} to={city} flights={st.flights.map((f) => f.city)} />}
          {city && (
            <>
              <div className="strat-row">
                <button disabled={!!canLaunch(state, city, 'conv')} className={arm === 'conv' ? 'armed' : ''} onClick={() => (arm === 'conv' ? (run((s) => { const r = launch(s, city, 'conv'); return { state: r.state, out: r.text }; }), setArm(null)) : setArm('conv'))}>
                  {arm === 'conv' ? '⚠️ 한 번 더 누르면 발사' : '🎯 재래식 탄두'}
                  <small>방어 −{Math.round((1 - CONV.def) * 100)}% · 호감 {CONV.favor}</small>
                </button>
                <button disabled={!!canLaunch(state, city, 'nuke')} title={canLaunch(state, city, 'nuke') ?? ''} className={`danger ${arm === 'nuke' ? 'armed' : ''}`} onClick={() => (arm === 'nuke' ? (run((s) => { const r = launch(s, city, 'nuke'); return { state: r.state, out: r.text }; }), setArm(null)) : setArm('nuke'))}>
                  {arm === 'nuke' ? '☢️ 정말 쏩니까? 한 번 더' : '☢️ 핵탄두'}
                  <small>도시 무력화 · 모든 나라 호감 {NUKE.favor} · 지지율 {NUKE.approval}</small>
                </button>
              </div>
              <p className="small muted">날아가는 데 {Math.round(FLIGHT_MS / 60000)}분 · {countryById(state.world.owner[city]).name} 요격 확률 {Math.round(interceptOf(state.world.owner[city]) * 100)}% · 쏜 미사일은 사일로에서 빠져요.</p>
            </>
          )}
          {st.flights.map((f) => (
            <p key={f.id} className="small list-row">
              {f.warhead === 'nuke' ? '☢️' : '🚀'} {cityById(f.city).name}으로 비행 중 · {timeLeft(Math.max(0, f.arriveMs - state.worldMs))}
            </p>
          ))}
        </Card>
      )}

      <Card title="🌐 세계의 ICBM">
        <div className="strat-world">
          {nukers.map((c) => (
            <span key={c.id}>
              {FLAG[c.id]} {c.name} <b>{icbmOf(state.world, c.id)}</b>
            </span>
          ))}
        </div>
        <p className="small muted">ICBM이 있는 나라끼리는 서로 덜 덤벼요. 우리는 지금 {icbmOf(state.world, me)}기{DEFAULT_ICBM[me] ? '(처음부터 핵보유국)' : ''}.</p>
      </Card>
    </>
  );
}

function myCapital(state: ScreenProps['state']): string {
  const me = state.player.countryId;
  return CITIES.find((c) => c.home === me && c.capital && state.world.owner[c.id] === me)?.id ?? CITIES.find((c) => state.world.owner[c.id] === me)?.id ?? CITIES.find((c) => c.home === me)!.id;
}

/** 실사 세계지도 위에 날아가는 궤적 */
function FlightMap({ from, to, flights }: { from: string; to: string; flights: string[] }) {
  const a = cityById(from);
  const b = cityById(to);
  const mx = (a.x + b.x) / 2;
  const my = Math.min(a.y, b.y) - Math.abs(a.x - b.x) * 0.35 - 20;
  // 지도 칸(가로:세로 ≈ 2.15)에 두 도시와 궤적이 다 들어오게
  const R = 2.15;
  const top = Math.min(my, a.y, b.y) - 20;
  const bot = Math.max(a.y, b.y) + 30;
  let w = Math.max(Math.abs(a.x - b.x) + 120, (bot - top) * R, 160);
  let h = w / R;
  if (w > GEO.W) { w = GEO.W; h = w / R; }
  const x0 = Math.max(0, Math.min(GEO.W - w, mx - w / 2));
  const y0 = Math.max(0, Math.min(GEO.H - h, (top + bot) / 2 - h / 2));
  const x1 = x0 + w;
  const fly = flights.includes(to);
  return (
    <div className="strat-map">
      <svg viewBox={`${x0} ${y0} ${w} ${h}`} preserveAspectRatio="xMidYMid slice">
        <image href={worldMap} x={0} y={0} width={GEO.W} height={GEO.H} />
        <path d={`M ${a.x} ${a.y} Q ${mx} ${my} ${b.x} ${b.y}`} fill="none" stroke={fly ? '#ff5d5d' : '#ffb020'} strokeWidth={(x1 - x0) / 140} strokeDasharray={`${(x1 - x0) / 60} ${(x1 - x0) / 90}`} />
        <circle cx={a.x} cy={a.y} r={(x1 - x0) / 90} fill="#3fb8c9" />
        <circle cx={b.x} cy={b.y} r={(x1 - x0) / 60} fill="none" stroke="#ff5d5d" strokeWidth={(x1 - x0) / 300} />
        <circle cx={b.x} cy={b.y} r={(x1 - x0) / 200} fill="#ff5d5d" />
        <text x={a.x} y={a.y + (x1 - x0) / 25} fontSize={(x1 - x0) / 28} fill="#fff" textAnchor="middle" fontWeight={700}>{a.name}</text>
        <text x={b.x} y={b.y + (x1 - x0) / 25} fontSize={(x1 - x0) / 28} fill="#fff" textAnchor="middle" fontWeight={700}>{b.name}</text>
      </svg>
    </div>
  );
}

