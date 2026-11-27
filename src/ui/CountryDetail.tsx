// 외교 → 국가정보 → 나라 누르면 열리는 큰 팝업(11-24 대장 요청 4번).
// 위: 그 나라 실제 지도(도·도시·점령·분쟁 지역·우리 파병) · 아래: 세부 탭 6개(요약·인물·군사·경제·관계·첩보)
import { HELP_FAVOR, allyWars, canHelp, helpAlly, helpChance, helpLoot } from '../game/jointOps';
import { campaignArt } from './scenes';
import { GOALS, goalById, goalMet, setGoal, settleWar, takenIn, warGoalOf } from '../game/warGoal';
import { useMemo, useState } from 'react';
import { CITIES, cityById } from '../data/cities';
import { COUNTRY_FACTS } from '../data/countryFacts';
import { CITY_RES, type Res } from '../data/economy';
import { PIONEER_ISLANDS } from '../data/hexmap';
import { REAL_ISLANDS } from '../data/islands';
import { LEADERS } from '../data/leaders';
import { conflictsOf, otherSide } from '../data/conflicts';
import { agreeById } from '../data/civ';
import { EXCLUSIVES, specialsOf } from '../data/specials';
import { BLOCS, COUNTRIES, countryById } from '../data/world';
import { cabinetOf } from '../game/cabinet';
import { activeAgreements, islandLeader, sanctionMult } from '../game/civ';
import { COMMAND_TOP, canDiplo, diploChance, doDiplo, type DiploAct } from '../game/command';
import { canCede, cedeChance, cedeCities, doCede } from '../game/annex';
import { deployOf } from '../game/deploy';
import { regionIcon, regionName, regionOf } from '../data/regions';
import { regionStanding, sanctionsOn, squeezesOn } from '../game/hegemony';
import { TRIBUTE, acceptSurrender, canAccept, canDemand, canSurrender, demandChance, doDemand, doSurrender, lordOf } from '../game/surrender';
import { MY_TARIFF_HOURS, MY_TARIFF_RATE, canDeal, canTariff, dealCost, doDeal, doTariff, tariffBetween } from '../game/pressure';
import { scoutView } from '../game/spy';
import { landOwners, provincesOf } from '../game/territory';
import type { GameState } from '../game/state';
import { citiesOf, isAlive, relationOf } from '../game/world';
import { PersonModal, PersonRow } from './CabinetUI';
import { FavorBox } from './CivScreens';
import { CountryInfo, RelTag, fmt } from './common';
import { FLAG } from './flag';
import { ResIcon, iconArt } from './iconArt';
import { Meter, Modal } from './kit';
import { GROW_INFO, GROW_MAX, GROW_TRACKS, NATION_FOCUS, PLAN_BY_PERS } from '../game/aiGrowth';
import { PersonFace } from './People';
import type { ScreenProps } from './screens';
import { COUNTRY_COLORS, REL_COLORS } from './WorldMap';

type Tab = 'sum' | 'people' | 'mil' | 'eco' | 'rel' | 'intel';
const TABS: Array<{ id: Tab; label: string; icon: string }> = [
  { id: 'sum', label: '요약', icon: '📋' },
  { id: 'people', label: '인물', icon: '👤' },
  { id: 'mil', label: '군사', icon: '🪖' },
  { id: 'eco', label: '경제', icon: '💰' },
  { id: 'rel', label: '관계', icon: '🤝' },
  { id: 'intel', label: '첩보', icon: '🕵️' },
];

/** 경로 글자에서 숫자 쌍을 모두 읽어 범위를 구함 */
function bboxOf(ds: string[]): { x: number; y: number; w: number; h: number } {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const d of ds) {
    const n = d.match(/-?\d+(?:\.\d+)?/g);
    if (!n) continue;
    for (let i = 0; i + 1 < n.length; i += 2) {
      const x = +n[i];
      const y = +n[i + 1];
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/** 그 나라 실제 지도 */
export function CountryMap({ state, id }: { state: GameState; id: string }) {
  const me = state.player.countryId;
  const provs = useMemo(() => provincesOf(id), [id]);
  const land = landOwners(state.world);
  const [sel, setSel] = useState<string | null>(null);
  const box = useMemo(() => {
    const b = bboxOf(provs.map((p) => p.d));
    const pad = Math.max(b.w, b.h) * 0.08 + 4;
    // 너무 길쭉하면 위아래를 늘려 화면 비율(약 2:1)에 맞춤
    let { x, y, w, h } = { x: b.x - pad, y: b.y - pad, w: b.w + pad * 2, h: b.h + pad * 2 };
    if (w / h > 2.2) {
      const nh = w / 2.2;
      y -= (nh - h) / 2;
      h = nh;
    } else if (w / h < 1.4) {
      const nw = h * 1.4;
      x -= (nw - w) / 2;
      w = nw;
    }
    return { x, y, w, h };
  }, [provs]);
  const u = box.w / 100; // 글씨·점 크기 단위
  const inBox = (px: number, py: number) => px >= box.x && px <= box.x + box.w && py >= box.y && py <= box.y + box.h;
  const cities = CITIES.filter((c) => c.home === id || state.world.owner[c.id] === id);
  const isles = PIONEER_ISLANDS.filter((p) => REAL_ISLANDS[p.id]?.sides.includes(id) && inBox(p.x, p.y));
  const deps = deployOf(state).list.filter((d) => d.to === id && !d.returnMs);
  const capital = CITIES.find((c) => c.home === id && c.capital)!;
  const colorOf = (o: string) => (o === me ? REL_COLORS['나'] : COUNTRY_COLORS[o] ?? '#94a3b8');
  const selCity = sel ? CITIES.find((c) => c.id === sel) : null;
  return (
    <div className="cmap">
      <svg viewBox={`${box.x} ${box.y} ${box.w} ${box.h}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label={`${countryById(id).name} 지도`}>
        <defs>
          <pattern id={`cm-occ-${id}`} width={2.4 * u} height={2.4 * u} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width={1 * u} height={2.4 * u} fill="#0f172a" opacity={0.45} />
          </pattern>
        </defs>
        <rect x={box.x} y={box.y} width={box.w} height={box.h} fill="#1e3a52" />
        {provs.map((p) => {
          const o = land[p.id] ?? id;
          return (
            <g key={p.id}>
              <path d={p.d} fill={colorOf(o)} fillOpacity={o === id ? 0.75 : 0.9} stroke="#e2e8f0" strokeOpacity={0.55} strokeWidth={0.25 * u} />
              {o !== id && <path d={p.d} fill={`url(#cm-occ-${id})`} />}
            </g>
          );
        })}
        {isles.map((p) => {
          const lead = islandLeader(state, p.id).id;
          return (
            <g key={p.id}>
              <circle cx={p.x} cy={p.y} r={1.3 * u} fill={lead ? colorOf(lead) : '#cdb77a'} stroke="#0f172a" strokeWidth={0.3 * u} />
              <text x={p.x} y={p.y + 3.6 * u} fontSize={2.4 * u} textAnchor="middle" className="cmap-isle">
                🏝️{REAL_ISLANDS[p.id].name}
              </text>
            </g>
          );
        })}
        {cities.map((c) => {
          const o = state.world.owner[c.id];
          const def = Math.round(state.world.defense[c.id] ?? 0);
          const col = def >= 70 ? '#4ade80' : def >= 40 ? '#fbbf24' : '#f87171';
          return (
            <g key={c.id} onClick={() => setSel(c.id === sel ? null : c.id)} className="cmap-city">
              <circle cx={c.x} cy={c.y} r={(c.capital ? 2.1 : 1.5) * u} fill={col} stroke={o === c.home ? '#0f172a' : colorOf(o)} strokeWidth={(o === c.home ? 0.35 : 0.8) * u} />
              {c.capital && (
                <text x={c.x} y={c.y + 0.9 * u} fontSize={2.4 * u} textAnchor="middle">
                  ★
                </text>
              )}
              <text x={c.x} y={c.y - 2.6 * u} fontSize={(c.capital ? 3.2 : 2.6) * u} textAnchor="middle" className="cmap-name">
                {c.name}
              </text>
            </g>
          );
        })}
        {deps.length > 0 && (
          <text x={capital.x + 4 * u} y={capital.y + 4 * u} fontSize={3.2 * u}>
            🪖{deps.length}
          </text>
        )}
      </svg>
      <div className="cmap-legend small">
        {selCity ? (
          <span>
            {selCity.capital ? '★ ' : ''}
            <b>{selCity.name}</b> · 방어도 {Math.round(state.world.defense[selCity.id] ?? 0)} · 주인 {FLAG[state.world.owner[selCity.id]]} {countryById(state.world.owner[selCity.id]).name}
          </span>
        ) : (
          <span className="muted">도시 점 색 = 방어도(초록 높음·빨강 낮음) · 빗금 = 빼앗긴 땅 · 점을 누르면 정보</span>
        )}
      </div>
    </div>
  );
}

const PERS_TEXT: Record<string, string> = {
  공격형: '약한 이웃을 먼저 치려 해요. 긴장이 높으면 선전포고할 수 있어요.',
  방어형: '먼저 치지는 않지만 공격받으면 끝까지 버텨요.',
  경제형: '무역과 분쟁 지역 영향력을 늘리는 데 힘을 써요.',
  기회주의: '전쟁 중인 나라의 빈틈을 노려요.',
};

export function CountryDetail({ state, actions, id, onClose }: ScreenProps & { id: string; onClose: () => void }) {
  const [tab, setTab] = useState<Tab>('sum');
  const [msg, setMsg] = useState('');
  const [pid, setPid] = useState<number | null>(null);
  const me = state.player.countryId;
  const c = countryById(id);
  const f = COUNTRY_FACTS[id];
  const top = state.player.rankIndex >= COMMAND_TOP;
  const w = state.world;
  const scout = id === me ? { treasury: Math.round(state.nations[id].treasury), troops: Math.round(state.nations[id].troops) } : scoutView(state, id);
  const people = cabinetOf(state).people.filter((p) => p.group === '외국' && p.country === id);
  const homeCities = CITIES.filter((x) => x.home === id);
  const res = useMemo(() => {
    const out: Partial<Record<Res, number>> = {};
    for (const x of homeCities) for (const [r, v] of Object.entries(CITY_RES[x.name] ?? {})) out[r as Res] = (out[r as Res] ?? 0) + (v as number);
    return Object.entries(out).sort((a, b) => b[1] - a[1]) as Array<[Res, number]>;
  }, [id]);
  const contracts = (state.economy.contracts ?? []).filter((k) => k.country === id);
  const news = w.events.filter((e) => e.text.includes(c.name)).slice(-5).reverse();
  const isles = PIONEER_ISLANDS.filter((p) => REAL_ISLANDS[p.id]?.sides.includes(id));
  const deps = deployOf(state).list.filter((d) => d.to === id && !d.returnMs);
  const pers = w.personalities[id] ?? LEADERS[id]?.personality;

  return (
    <Modal title={c.name} icon={FLAG[id]} onClose={onClose} big>
      {id !== me && relationOf(w, me, id) === '전쟁' && campaignArt(id) ? (
        <div className="act-cover">
          <img src={campaignArt(id)!} alt="" draggable={false} />
          <b>⚔️ {c.name} 전역</b>
        </div>
      ) : (
        iconArt(`banner-${id}`) && <img className="cdetail-banner" src={iconArt(`banner-${id}`)!} alt="" draggable={false} />
      )}
      {id !== me && relationOf(w, me, id) === '전쟁' && <WarGoalBox state={state} actions={actions} id={id} />}
      {id !== me && relationOf(w, me, id) === '연합' && allyWars(state, id).length > 0 && <HelpAllyBox state={state} actions={actions} id={id} />}
      <div className="cdetail">
        <CountryMap state={state} id={id} />
        <div className="cdetail-side">
          <div className="seg cdetail-tabs">
            {TABS.map((t) => (
              <button key={t.id} className={tab === t.id ? 'on' : ''} onClick={() => setTab(t.id)}>
                {t.icon} {t.label}
              </button>
            ))}
          </div>

          {tab === 'sum' && (
            <>
              <p className="small">{c.intro}</p>
              <div className="cfacts">
                <span>🏛️ 수도 <b>{f.capital}</b></span>
                <span>👪 인구 <b>{f.pop >= 100 ? `${(f.pop / 100).toFixed(1)}억` : `${f.pop * 100}만`}</b></span>
                <span>🗺️ 면적 <b>{f.area}만 km²</b></span>
                <span>💹 경제 <b>세계 {f.gdpRank}위</b></span>
                <span>🤝 진영 <b>{BLOCS[c.bloc].name}</b></span>
                <span>⚖️ 난이도 <b>{c.difficulty}</b></span>
              </div>
              <p className="small muted">📌 {f.note}</p>
              <HegLine state={state} id={id} />
              {id !== me && <AiGrowBox state={state} id={id} />}
              {top && id !== me && (
                <div className="buttons">
                  {(['선전포고', '휴전 제안', relationOf(w, me, id) === '연합' ? '연합 깨기' : '연합 제안'] as DiploAct[]).map((act) => {
                    const why = canDiplo(state, id, act);
                    return (
                      <button
                        key={act}
                        style={{ flex: 1, marginTop: 0 }}
                        className={act === '선전포고' ? 'danger' : 'primary'}
                        disabled={!!why}
                        title={why ?? ''}
                        onClick={() => {
                          if (act === '연합 깨기' && !window.confirm(`${c.name}와(과) 맺은 연합을 깰까요?\n(신뢰 −5 · 명성 −5)`)) return;
                          if (act === '선전포고' && !window.confirm(`${c.name}에 선전포고할까요?${relationOf(w, me, id) === '연합' ? '\n(연합을 깨요: 신뢰 −10 · 명성 −10)' : relationOf(w, me, id) === '휴전' ? '\n(휴전을 깨요: 신뢰 −5)' : ''}`)) return;
                          setMsg(
                            actions.applyWith((s) => {
                              const r = doDiplo(s, id, act);
                              return { state: r.state, out: r.text };
                            }) ?? '',
                          );
                        }}
                      >
                        {act === '선전포고' && lordOf(state, me) === id ? '🗽 독립 전쟁' : <>{act === '선전포고' ? '⚔️' : act === '휴전 제안' ? '🕊️' : act === '연합 깨기' ? '💔' : '🤝'} {act}</>}
                        <small>{why ?? (act === '선전포고' ? '' : act === '연합 깨기' ? '언제든' : `성공 ${Math.round(diploChance(state, id, act) * 100)}%`)}</small>
                      </button>
                    );
                  })}
                </div>
              )}
              {id !== me && (lordOf(state, me) === id || lordOf(state, id) === me || relationOf(w, me, id) === '전쟁') && (
                <div className="cede-row">
                  <small className="muted" style={{ flexBasis: '100%' }}>
                    🏳️ 항복 ·{' '}
                    {lordOf(state, me) === id
                      ? `우리는 ${c.name}의 속국(공물 ${Math.round(TRIBUTE * 100)}%) · 선전포고하면 독립 전쟁`
                      : lordOf(state, id) === me
                        ? `${c.name}는 우리 속국(공물 ${Math.round(TRIBUTE * 100)}% 받음)`
                        : '크게 이기면 속국으로 받고, 지면 항복해 판을 이어 가요'}
                  </small>
                  {!canAccept(state, id) && (
                    <button className="primary" onClick={() => setMsg(actions.applyWith((s) => { const r = acceptSurrender(s, id); return { state: r.state, out: r.text }; }) ?? '')}>
                      🏳️ 항복 받기
                      <small>{c.name}가 항복을 제안했어요</small>
                    </button>
                  )}
                  {relationOf(w, me, id) === '전쟁' && (
                    <button className="primary" disabled={!!canDemand(state, id)} title={canDemand(state, id) ?? ''} onClick={() => setMsg(actions.applyWith((s) => { const r = doDemand(s, id); return { state: r.state, out: r.text }; }) ?? '')}>
                      📜 항복 요구
                      <small>{canDemand(state, id) ?? `성공 ${Math.round(demandChance(state, id) * 100)}%`}</small>
                    </button>
                  )}
                  {relationOf(w, me, id) === '전쟁' && (
                    <button
                      className="danger"
                      disabled={!!canSurrender(state, id)}
                      title={canSurrender(state, id) ?? ''}
                      onClick={() => {
                        if (!window.confirm(`${c.name}에 항복할까요?\n전쟁이 끝나고 속국이 돼요. 나라 예산 ${Math.round(TRIBUTE * 100)}%를 공물로 바쳐요(신뢰 −10 · 명성 −20).\n나중에 선전포고로 독립 전쟁을 할 수 있어요.`)) return;
                        setMsg(actions.applyWith((s) => { const r = doSurrender(s, id); return { state: r.state, out: r.text }; }) ?? '');
                      }}
                    >
                      🏳️ 항복하기
                      <small>{canSurrender(state, id) ?? '속국이 돼요'}</small>
                    </button>
                  )}
                </div>
              )}
              {id !== me && (
                <div className="cede-row">
                  <small className="muted" style={{ flexBasis: '100%' }}>
                    📦 관세 · {tariffBetween(state, id, me) ? `${c.name}가 우리에게 ${Math.round(tariffBetween(state, id, me)!.rate * 100)}% 매김(나라 예산 줄어듦)` : '우리에게 매긴 관세 없음'}
                    {tariffBetween(state, me, id) ? ` · 우리가 ${Math.round(tariffBetween(state, me, id)!.rate * 100)}% 매김` : ''}
                  </small>
                  <button
                    className="danger"
                    disabled={!!canTariff(state, id)}
                    title={canTariff(state, id) ?? ''}
                    onClick={() => setMsg(actions.applyWith((s) => { const r = doTariff(s, id); return { state: r.state, out: r.text }; }) ?? '')}
                  >
                    📦 {tariffBetween(state, id, me) ? '맞관세' : '관세 매기기'} {Math.round(MY_TARIFF_RATE * 100)}%
                    <small>{canTariff(state, id) ?? `${MY_TARIFF_HOURS}시간 · 나라 예산 + · 긴장 +`}</small>
                  </button>
                  {tariffBetween(state, id, me) && (
                    <button
                      className="primary"
                      disabled={!!canDeal(state, id)}
                      title={canDeal(state, id) ?? ''}
                      onClick={() => setMsg(actions.applyWith((s) => { const r = doDeal(s, id); return { state: r.state, out: r.text }; }) ?? '')}
                    >
                      🤝 관세 협상
                      <small>{canDeal(state, id) ?? `나라 예산 ${dealCost(state, id).toLocaleString('ko-KR')}`}</small>
                    </button>
                  )}
                </div>
              )}
              {top && id !== me && cedeCities(state, id).length > 0 && (
                <div className="cede-row">
                  <small className="muted" style={{ flexBasis: '100%' }}>📜 강화 조약: 전쟁을 끝내며 점령한 도시를 넘겨받아요(투표 없이 편입 · 반발 절반)</small>
                  {cedeCities(state, id).map((cid) => {
                    const why = canCede(state, id, cid);
                    return (
                      <button
                        key={cid}
                        className="primary"
                        disabled={!!why}
                        title={why ?? ''}
                        onClick={() =>
                          setMsg(
                            actions.applyWith((s) => {
                              const r = doCede(s, id, cid);
                              return { state: r.state, out: r.text };
                            }) ?? '',
                          )
                        }
                      >
                        📜 {cityById(cid).name} 넘겨받기
                        <small>{why ?? `성공 ${Math.round(cedeChance(state, id) * 100)}%`}</small>
                      </button>
                    );
                  })}
                </div>
              )}
              {msg && <p className="small result">{msg}</p>}
              {id !== me && <FavorBox state={state} id={id} />}
              <CountryInfo id={id} state={state} />
            </>
          )}

          {tab === 'people' && (
            <>
              <div className="cleader">
                <PersonFace who={{ kind: 'leader', country: id }} keys={[`leader-${id}`]} fallback={FLAG[id]} className="leader-big" />
                <div>
                  <b>{LEADERS[id]?.name}</b> <small className="muted">{LEADERS[id]?.title}</small>
                  <div className="small">성향: {pers}</div>
                  <div className="small muted">{pers ? PERS_TEXT[pers] : ''}</div>
                </div>
              </div>
              <small className="stat-group-name">🌐 장관</small>
              {people.length === 0 && <p className="small muted">아직 알려진 장관이 없어요.</p>}
              <div className="cab-list">
                {people.map((p) => (
                  <PersonRow key={p.id} state={state} p={p} onOpen={() => setPid(p.id)} right={<small>{p.title?.replace(`${c.name} `, '')}</small>} />
                ))}
              </div>
              <small className="stat-group-name">📰 최근 소식</small>
              {news.length === 0 && <p className="small muted">최근 소식이 없어요.</p>}
              {news.map((e, i) => (
                <p key={i} className="small">
                  {e.text}
                </p>
              ))}
            </>
          )}

          {tab === 'mil' && (
            <>
              <div className="cfacts">
                <span>🪖 현역 <b>약 {f.active}만 명</b></span>
                <span>☢️ 핵무기 <b>{f.nuke}</b></span>
                <span>🎖️ 병력(게임) <b>{scout ? fmt(scout.troops) : '❓ 정찰 필요'}</b></span>
                <span>🏙️ 도시 <b>{citiesOf(w, id).length}곳</b></span>
              </div>
              <small className="stat-group-name">🌟 특수 부대</small>
              {specialsOf(id).map((d) => (
                <p key={d.id} className="small">
                  <b>{d.name}</b>({d.base}) — {d.effect}
                </p>
              ))}
              {EXCLUSIVES.some((x) => x.only.includes(id)) && (
                <p className="small">👑 독점 병과: {EXCLUSIVES.filter((x) => x.only.includes(id)).map((x) => x.name).join(' · ')}</p>
              )}
              <small className="stat-group-name">🛡️ 도시 방어도</small>
              <div className="cdef">
                {citiesOf(w, id).map((cid) => {
                  const x = CITIES.find((y) => y.id === cid)!;
                  const d = Math.round(w.defense[cid] ?? 0);
                  return (
                    <span key={cid} className={d >= 70 ? 'good' : d >= 40 ? '' : 'warn'}>
                      {x.capital && x.home === id ? '★' : ''}
                      {x.name} {d}
                    </span>
                  );
                })}
              </div>
              {deps.length > 0 && <p className="small good">🪖 우리 파병 부대 {deps.length}개가 이 나라에 있어요.</p>}
            </>
          )}

          {tab === 'eco' && (
            <>
              <div className="cfacts">
                <span>💹 경제 <b>세계 {f.gdpRank}위</b></span>
                <span>💰 나라 예산(게임) <b>{scout ? fmt(scout.treasury) : '❓ 정찰 필요'}</b></span>
                <span>⛔ 국제 제재 <b>{sanctionMult(state, id) < 1 ? '받는 중' : '없음'}</b></span>
              </div>
              <p className="small">📦 실제 주요 수출: {f.exports.join(' · ')}</p>
              <small className="stat-group-name">⛏️ 나는 자원</small>
              <div className="cres">
                {res.map(([r, v]) => (
                  <span key={r}>
                    <ResIcon res={r} inline /> {r} ×{v}
                  </span>
                ))}
              </div>
              <small className="stat-group-name">🚢 우리와 무역 계약</small>
              {contracts.length === 0 ? (
                <p className="small muted">없음 · 외교 → 무역에서 맺을 수 있어요.</p>
              ) : (
                contracts.map((k) => (
                  <p key={k.id} className="small">
                    {k.buy ? '📥 수입' : '📤 수출'} <ResIcon res={k.res} inline /> {k.res} 시간당 {k.qty}개
                  </p>
                ))
              )}
            </>
          )}

          {tab === 'rel' && (
            <>
              {id !== me && (
                <p className="small">
                  우리와: <RelTag state={state} id={id} />
                </p>
              )}
              <small className="stat-group-name">🌍 다른 나라와 관계</small>
              <div className="crel">
                {COUNTRIES.filter((o) => o.id !== id).map((o) => {
                  const r = relationOf(w, id, o.id);
                  return (
                    <span key={o.id} className={`crel-chip ${!isAlive(w, o.id) ? 'dead' : ''}`} style={{ borderColor: REL_COLORS[r] }}>
                      {FLAG[o.id]} {o.name.slice(0, 4)} <b style={{ color: REL_COLORS[r] }}>{r}</b>
                    </span>
                  );
                })}
              </div>
              {conflictsOf(id).length > 0 && (
                <>
                  <small className="stat-group-name">⚔️ 지금 분쟁</small>
                  {conflictsOf(id).map((k) => (
                    <p key={k.name} className="small">
                      {k.icon} <b>{k.name}</b>({countryById(otherSide(k, id)).name}) — {k.text}
                    </p>
                  ))}
                </>
              )}
              {id !== me && activeAgreements(state, id).length > 0 && (
                <p className="small good">📜 우리와 협정: {activeAgreements(state, id).map((a) => `${agreeById(a.kind).icon} ${agreeById(a.kind).name}`).join(' · ')}</p>
              )}
              {isles.length > 0 && (
                <>
                  <small className="stat-group-name">🏝️ 다투는 분쟁 지역</small>
                  {isles.map((p) => {
                    const lead = islandLeader(state, p.id).id;
                    return (
                      <p key={p.id} className="small">
                        <b>{REAL_ISLANDS[p.id].name}</b> · 영향력 1등: {lead ? `${FLAG[lead]} ${countryById(lead).name}` : '없음'}
                      </p>
                    );
                  })}
                </>
              )}
            </>
          )}

          {tab === 'intel' && (
            <>
              {id === me ? (
                <p className="small muted">우리 나라예요.</p>
              ) : scout ? (
                <>
                  <p className="small good">🛰️ 위성 정찰 중: 숫자가 보여요.</p>
                  <div className="cfacts">
                    <span>🎖️ 병력 <b>{fmt(scout.troops)}</b></span>
                    <span>💰 나라 예산 <b>{fmt(scout.treasury)}</b></span>
                  </div>
                </>
              ) : (
                <p className="small">❓ 병력·나라 예산은 가려져 있어요. 외교 → 첩보에서 위성 정찰을 하면 보여요.</p>
              )}
              <small className="stat-group-name">🔮 다음 행동 예측</small>
              <p className="small">
                지도자 성향 <b>{pers}</b>: {pers ? PERS_TEXT[pers] : ''}
              </p>
              {(() => {
                const weak = citiesOf(w, id)
                  .map((cid) => [cid, w.defense[cid] ?? 0] as const)
                  .sort((a, b) => a[1] - b[1])[0];
                return weak ? (
                  <p className="small">
                    🎯 가장 약한 도시: <b>{CITIES.find((x) => x.id === weak[0])!.name}</b>(방어도 {Math.round(weak[1])})
                  </p>
                ) : null;
              })()}
              {conflictsOf(id).length > 0 && <p className="small warn">⚠️ 이미 분쟁 중이라 다른 전선에 힘을 덜 써요.</p>}
            </>
          )}
        </div>
      </div>
      {pid !== null && <PersonModal state={state} actions={actions} pid={pid} onClose={() => setPid(null)} />}
    </Modal>
  );
}

/** AI 나라 성장(11-26): 지금 전략과 갈래 5개 단계 */
/** 11-27 대륙 패권 한 줄: 대륙 순위·지분, 받는 제재·약탈 계약 */
function HegLine({ state, id }: { state: GameState; id: string }) {
  const rid = regionOf(id);
  const st = regionStanding(state, rid);
  const i = st.findIndex((x) => x.id === id);
  if (i < 0) return null;
  const sc = sanctionsOn(state, id).length;
  const sq = squeezesOn(state, id).length;
  return (
    <p className="small muted" style={{ margin: '4px 0' }}>
      {i === 0 && st.length > 1 ? '👑' : regionIcon(rid)} {regionName(rid)} {i + 1}위 · 힘 지분 {Math.round(st[i].share * 100)}%
      {sc ? ` · 🚫 제재 ${sc}` : ''}
      {sq ? ` · ⛓️ 약탈 계약 ${sq}` : ''}
    </p>
  );
}

function AiGrowBox({ state, id }: { state: GameState; id: string }) {
  const w = state.world;
  const g = w.grow?.[id];
  const pers = w.personalities[id];
  const base = PLAN_BY_PERS[pers];
  const focus = NATION_FOCUS[id];
  return (
    <div className="ai-grow">
      <small className="stat-group-name">📈 나라 키우기(AI 지도자 전략)</small>
      <p className="small">
        🧭 <b>{g?.plan || base?.name}</b> — {base?.text}
        {focus && <> · 잘하는 갈래 {GROW_INFO[focus].icon}{GROW_INFO[focus].name}(15% 싸게)</>}
      </p>
      <div className="pw-bars">
        {GROW_TRACKS.map((t) => {
          const lv = g?.lv[t] ?? 0;
          const info = GROW_INFO[t];
          return (
            <div className="pw-bar" key={t} title={`${info.eff} +${Math.round(lv * info.per * 100)}%`}>
              <small>{info.icon} {info.name}</small>
              <Meter value={lv} max={GROW_MAX} tone={t === 'eco' ? 'gold' : t === 'army' ? 'red' : t === 'tech' ? 'blue' : 'green'} />
              <b>{lv}단계</b>
            </div>
          );
        })}
      </div>
      <p className="small muted">남는 나라 예산을 성향대로 써서 단계를 올려요. 전쟁 중엔 군비·요새, 땅을 잃으면 되찾기에 힘을 몰아요.</p>
    </div>
  );
}

/** 11-27 전투 7: 싸우는 연합국을 도우러 가기 */
function HelpAllyBox({ state, actions, id }: Pick<ScreenProps, 'state' | 'actions'> & { id: string }) {
  const [msg, setMsg] = useState('');
  const no = canHelp(state, id);
  return (
    <div className="wargoal">
      <b className="small">🤝 {countryById(id).name}은(는) 지금 {allyWars(state, id).map((c) => c.name).join(' · ')}와(과) 싸우고 있어요</b>
      <button className="wide gold" disabled={!!no} onClick={() => setMsg(actions.applyWith((s) => { const r = helpAlly(s, id); return { state: r.state, out: r.text }; }) ?? '')}>
        ✈️ 도우러 가기 · {no ?? `성공 ${Math.round(helpChance(state) * 100)}% · 호감 +${HELP_FAVOR} · 전리품 ${helpLoot(state).toLocaleString('ko-KR')}`}
      </button>
      {msg && <p className="small sch-msg">{msg}</p>}
    </div>
  );
}

/** 11-27 전투 4: 전쟁 목표 고르기 · 목표를 이루면 협상으로 끝내기 */
function WarGoalBox({ state, actions, id }: Pick<ScreenProps, 'state' | 'actions'> & { id: string }) {
  const g = warGoalOf(state, id);
  const [msg, setMsg] = useState('');
  if (!g)
    return (
      <div className="wargoal">
        <b className="small">🎯 이 전쟁의 목표를 정하세요</b>
        <div className="wargoal-opts">
          {GOALS.map((d) => (
            <button key={d.id} onClick={() => actions.apply((s) => setGoal(s, id, d.id))}>
              <span>{d.icon}</span>
              <b>{d.name}</b>
              <small>{d.need}</small>
              <small className="muted">{d.reward}</small>
            </button>
          ))}
        </div>
        <small className="muted">목표를 이루면 확률 없이 협상으로 전쟁을 끝낼 수 있어요. 목표보다 더 차지하면 다른 나라들이 경계해요.</small>
      </div>
    );
  const d = goalById(g.goal);
  const met = goalMet(state, id);
  return (
    <div className="wargoal">
      <b className="small">
        🎯 전쟁 목표: {d.icon} {d.name} · 차지한 본토 도시 {takenIn(state, id)}곳
      </b>
      <small className="muted"> {d.id === 'total' ? '끝까지 싸워요.' : met ? '목표를 이뤘어요!' : `조건: ${d.need}`}</small>
      {d.id !== 'total' && (
        <button className="gold wide" disabled={!met} onClick={() => setMsg(actions.applyWith((s) => { const r = settleWar(s, id); return { state: r.state, out: r.text }; }) ?? '')}>
          🕊️ 협상으로 끝내기 <small>· {d.reward}</small>
        </button>
      )}
      {msg && <p className="small sch-msg">{msg}</p>}
    </div>
  );
}
