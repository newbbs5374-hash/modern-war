// 문명식 운영 화면: 내정 탭(연구 · 체제 · 도시) + 외교 탭(호감·협정 · 분쟁 지역 · 국제 회의).
// 그림(아이콘) 위주, 자세한 내용은 팝업, 설명은 (?) 도움말.
import { CITY_DEFENSE_MAX } from '../game/balance';
import { HOME_BELT, HOMETOWN_LOYALTY, isHometown } from '../data/krCities';
import { GOV_FACILITIES } from '../data/govFacilities';
import { govFacCity, govFacLevel } from '../game/govFac';
import { CLAIM_INFLUENCE, REAL_ISLANDS, claimsIsland } from '../data/islands';
import { BoostBar, BoostMini, BoostStart } from './BoostBar';
import { BOOST_MS, boostLeft, startAndFinish } from '../game/boost';
import { TOUR_DONE_APPROVAL, TOUR_DONE_LOYALTY, TOUR_PAY_LOYALTY, TOUR_TALK_LOYALTY, canSolve, canTour, issueById, payCost, solveIssue, startTour, tourOf } from '../game/tour';
import { Suspense, lazy, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';

/** 3D 도시(11/26 서울 시험): 누를 때만 three.js를 불러옴 */
const City3D = lazy(() => import('./City3D'));
import { CITY3D_FILE } from '../data/city3d';
import { CITIES, cityById, isCoastalCity } from '../data/cities';
import { UNITS } from '../data/catalog';
import {
  TECH_PTS_PER_BOOST,
  AI_GOV_EFF,
  AGENDAS,
  AGREES,
  CARDS,
  DISTRICTS,
  ENVOY_COST,
  ERAS,
  GOVS,
  GOV_CHANGE_COST,
  GOV_CHAOS_MS,
  ISLAND_LEAD_MIN,
  ISLAND_RES_PER_HOUR,
  LOYALTY_OK,
  MIL_TECHS,
  SLOT_ICON,
  SOC_TECHS,
  TECHS,
  agendaById,
  agreeById,
  cardById,
  districtById,
  govById,
  govSlots,
  slotCount,
  techById,
  type DistrictId,
  type GovId,
  type Tech,
} from '../data/civ';
import { RES_ICON } from '../data/economy';
import { specialsFor } from '../data/specials';
import { EDGE_DIR, HEX_DIRS, HEX_SIZE, PIONEER_ISLANDS, hexCorners, hexDist, hexKey } from '../data/hexmap';
import { CityView, cityArt, type CityCell, type CityLabel, type CityThing } from './CityView';
import { cityMap } from '../data/cityMap';
import { CITY_STAGES, cityPeopleAtStart, cityStage, stageOfPeople } from '../game/growth';
import { busyProjects, projectById } from '../game/projects';
import { zoneById } from '../game/zones';
import { domOf } from '../game/domestic';
import { cityJobs } from '../game/chains';
import { nightLevel, type DayMode } from './HomeLand';
import { KR_CITY_INFO, MARK_KIND, MARK_MAX, MARK_SCALE, effText, type CityEff } from '../data/krCities';
import { CITY_INST, instById } from '../data/institutions';
import { SIZE_NAME } from '../data/hexmap';
import { smoothPath, type Seg } from './smoothHex';
import { CityLogo } from './CityLogo';
import { AnnexBox, annexTag } from './AnnexBox';
import { CITY_LOGO } from '../data/cityLogos';
import { useDragScroll } from './dragScroll';
import { CARD_H, CARD_W, COL_GAP, cardPath, colX, layoutCards } from './techCards';
import { CARD_ORDER } from './techCardOrder';
import { RANKS } from '../data/ranks';
import { COUNTRIES, countryById } from '../data/world';
import * as C from '../game/civ';
import { isAlive } from '../game/world';
import { fmt, RelTag } from './common';
import { armyPower } from '../game/economy';
import { FLAG } from './flag';
import { Help, Meter, Modal, Tile } from './kit';
import { timeLeft } from './officerScreens';
import type { ScreenProps } from './screens';
import { Tip } from './InteriorScreen';
import { ArtIcon, IslandIcon, ResIcon, UnitIcon, cardArtKey, eraArtKey, govArtKey, iconArt, islandArtUrl, techArtKey } from './iconArt';

const H = 3600e3;
const r1 = (v: number) => Math.round(v * 10) / 10;
const signed = (v: number) => (v > 0 ? `+${v}` : `${v}`);

/* ═════════════ 연구 ═════════════ */

/** 연구 칸. fixed를 주면 그 줄만(국방 = 군사 기술, 사회 = 사회 제도) */
export function ResearchPanel(props: ScreenProps & { fixed?: 'mil' | 'soc' }) {
  const { state, actions, fixed } = props;
  const c = C.civOf(state);
  const [lineSel, setLine] = useState<'mil' | 'soc'>(fixed ?? 'mil');
  const line = fixed ?? lineSel;
  const [pick, setPick] = useState<Tech | null>(null);
  const rate = C.researchRate(state);
  const list = line === 'mil' ? MIL_TECHS : SOC_TECHS;
  const cur = (l: 'mil' | 'soc') => {
    const id = c.cur[l];
    const t = id ? techById(id)! : null;
    const cost = t ? C.techCost(state, t) : 0;
    const got = t ? (c.progress[t.id] ?? 0) : 0;
    const st = t ? C.techStage(state, t.id) : 0;
    const allDone = !t && (l === 'mil' ? MIL_TECHS : SOC_TECHS).every((x) => c.done.includes(x.id));
    return (
      <div className="civ-cur-wrap">
      <button className={`civ-cur ${t || allDone ? '' : 'idle'}`} onClick={() => (setLine(l), t && setPick(t))}>
        <span className="civ-cur-ico">{t ? <ArtIcon k={techArtKey(t.id)} emoji={t.icon} alt={t.name} /> : l === 'mil' ? '⚙️' : '📜'}</span>
        <span className="civ-cur-main">
          <small className="muted">{l === 'mil' ? '군사 기술' : '사회 제도'}</small>
          <b>
            {t ? t.name : allDone ? '모든 연구 끝' : '고르는 중…'}
            {t && <StagePips n={st} cur />}
          </b>
          {t ? (
            <>
              <Meter value={got} max={cost} tone={l === 'mil' ? 'blue' : 'gold'} />
              <small className="muted">
                {st + 1}/{C.TECH_STAGES}단계 · 이 단계 {timeLeft(((cost - got) / Math.max(0.01, rate)) * H)} · 전체 {timeLeft((C.techLeft(state, t) / Math.max(0.01, rate)) * H)} 남음{c.eureka.includes(t.id) ? ' · 💡' : ''}
              </small>
            </>
          ) : allDone ? (
            <small className="ok">✓ 이 줄 연구를 모두 끝냈어요</small>
          ) : (
            <small className="warn">아래에서 연구를 골라 주세요{c.bank[l] > 0.05 ? ` (모인 점수 ${r1(c.bank[l])})` : ''}</small>
          )}
        </span>
      </button>
      {t && <BoostBar state={state} apply={actions.apply} target={{ kind: 'research', line: l }} compact />}
      </div>
    );
  };
  return (
    <>
      <section className="card">
        <div className="row">
          <span className="civ-era">
            <ArtIcon k={eraArtKey(c.era)} emoji={ERAS[c.era].icon} cls="inline" /> <b>{ERAS[c.era].name}</b> <small className="muted">· 끝낸 연구 {c.done.length}/{MIL_TECHS.length + SOC_TECHS.length}</small>
          </span>
          <Tip label={`🔬 ×${r1(rate)}`} title="연구 속도(실제 1시간에)" rows={C.researchBreakdown(state).map(([k, v]) => [k, `+${r1(v)}`])} total={`${r1(rate)}`} />
          <Help title="연구">
            <p>
              <b>3단계 연구</b>: 기술 하나는 1단계 → 2단계 → 3단계로 나눠 연구해요. 3단계를 모두 끝내야 기술이 완성되고 병과·카드·구역이 열려요. 다른 연구로 바꿔도 끝낸 단계와 쌓인 점수는 그대로 남아요.
            </p>
            <p>
              <b>연구 비용</b>: 연구를 시작할 때 나라 예산(2시대부터는 자원도: 군사 강철·반도체, 사회 구리·리튬)을 내요. 뒤 시대일수록 오래 걸리고 비싸요. ⏩·⚡ 가속권 한 장은 언제나 연구 {TECH_PTS_PER_BOOST}점만큼 줄여요.
            </p>
            <p>
              <b>연구 트리</b>: 왼쪽에서 오른쪽으로 갈수록 다음 시대 연구예요. 선으로 이어진 왼쪽 카드가 "먼저 해야 하는 연구"예요. 청록 선은 끝남, 주황 선은 지금 열 수 있음, 흐린 점선은 아직 멀었음. 옆으로 밀어서 보고, 카드를 누르면 자세히 보여요. 카드 아래 작은 아이콘은 그 연구가 여는 병과·카드·구역·협정이에요.
            </p>
            <p>연구는 두 줄이에요. <b>군사 기술</b>은 병과와 무기 강화를, <b>사회 제도</b>는 정책 카드·협정·도시 구역을 열어요. 두 줄은 동시에 하나씩 진행돼요.</p>
            <p>
              <b>병과 열기</b>: 지도자 호칭(부대 크기)과 연구(무기 종류)가 둘 다 있어야 해요. 보병·특수부대는 처음부터 열려 있어요.
            </p>
            <p>
              <b>💡 번뜩임</b>: 훈련·임무·대화·구역 짓기 같은 일을 해내면 관련 연구가 절반으로 줄어요. 연구를 누르면 무엇을 하면 되는지 보여요.
            </p>
            <p>
              <b>시대</b>: 도약기 → 항로기 → 제공기 → 대양기. 한 시대 연구를 4개 끝내면 다음 시대로 가고, 맞수 나라들이 조금 긴장해요.
            </p>
            <p>연구 속도는 도시 인구·🔬연구소 구역·연구 협력 협정·카드로 빨라져요. 고르지 않은 동안 모인 점수는 12시간치까지 다음 연구에 쓰여요.</p>
          </Help>
        </div>
        {fixed ? (
          cur(fixed)
        ) : (
          <div className="grid2">
            {cur('mil')}
            {cur('soc')}
          </div>
        )}
      </section>
      {!fixed && <div className="seg branch-tabs">
        <button className={line === 'mil' ? 'on' : ''} onClick={() => setLine('mil')}>
          ⚙️ 군사 기술 <small>{c.done.filter((id) => id.startsWith('m-')).length}/{MIL_TECHS.length}</small>
        </button>
        <button className={line === 'soc' ? 'on' : ''} onClick={() => setLine('soc')}>
          📜 사회 제도 <small>{c.done.filter((id) => id.startsWith('s-')).length}/{SOC_TECHS.length}</small>
        </button>
      </div>}
      <TechTree {...props} list={list} onPick={setPick} />
      {c.log.length > 0 && (
        <section className="card">
          <small className="stat-group-name">📰 최근 소식</small>
          <ul className="events">
            {c.log.slice(0, 4).map((l, i) => (
              <li key={i}>{l}</li>
            ))}
          </ul>
        </section>
      )}
      {pick && <TechModal {...props} t={pick} onClose={() => setPick(null)} onGo={(id) => actions.apply((s) => C.startResearch(s, id))} />}
    </>
  );
}

/** 단계 점 ●●○ */
function StagePips({ n, cur }: { n: number; cur?: boolean }) {
  return (
    <span className="stage-pips" aria-label={`${n}/${C.TECH_STAGES}단계`}>
      {Array.from({ length: C.TECH_STAGES }, (_, i) => (
        <i key={i} className={i < n ? 'on' : cur && i === n ? 'cur' : ''} />
      ))}
    </span>
  );
}

/** 연구 카드 트리: 왼쪽(도약기) → 오른쪽(대양기)으로 이어지는 가로 스킬트리. 카드 = 아이콘 + 이름 + 여는 것 아이콘. 선은 미리 겹치지 않게 배치(techCards.ts) */
const TT_PAD = { x: 14, top: 30, bottom: 30 };
/** 이 연구가 여는 것(작은 아이콘용) */
function techUnlockIcons(t: Tech): Array<{ key: string; node: ReactNode; label: string }> {
  const out: Array<{ key: string; node: ReactNode; label: string }> = [];
  for (const u of t.units ?? []) out.push({ key: `u-${u}`, node: <UnitIcon unit={u} />, label: u });
  for (const k of t.cards ?? []) {
    const cd = cardById(k);
    if (cd) out.push({ key: `c-${k}`, node: <ArtIcon k={cardArtKey(k)} emoji={cd.icon} alt={cd.name} />, label: `${cd.name} 카드` });
  }
  for (const d of t.districts ?? []) out.push({ key: `d-${d}`, node: <>{districtById(d).icon}</>, label: districtById(d).name });
  for (const d of DISTRICTS.filter((x) => x.tech === t.id)) out.push({ key: `d-${d.id}`, node: <>{d.icon}</>, label: d.name });
  for (const a of t.agree ?? []) out.push({ key: `a-${a}`, node: <>{agreeById(a).icon}</>, label: `${agreeById(a).name} 협정` });
  if (t.eff) out.push({ key: 'eff', node: <>📈</>, label: '능력 강화' });
  return out;
}
function TechTree({ state, actions, list, onPick }: ScreenProps & { list: Tech[]; onPick: (t: Tech) => void }) {
  const c = C.civOf(state);
  const line = list[0]?.line ?? 'mil';
  const L = useMemo(() => layoutCards(list, CARD_ORDER[line]), [list, line]);
  const box = useRef<HTMLDivElement>(null);
  useDragScroll(box);
  const stateOf = (t: Tech) => {
    if (C.hasTech(state, t.id)) return 'done';
    if (c.cur[t.line] === t.id) return 'now';
    const why = C.canResearch(state, t.id);
    return why && why.startsWith('먼저') ? 'far' : 'open';
  };
  const st: Record<string, string> = Object.fromEntries(list.map((t) => [t.id, stateOf(t)]));
  const lineCls = (from: string, to: string) => {
    const a = st[from] === 'done';
    const b = st[to];
    return b === 'done' ? 'done' : b === 'now' && a ? 'now' : a ? 'open' : 'far';
  };
  const order = { far: 0, open: 1, done: 2, now: 3 } as Record<string, number>;
  const edges = L.edges.map((e) => ({ ...e, cls: lineCls(e.from, e.to) })).sort((a, b) => order[a.cls] - order[b.cls]);
  const W = L.width + TT_PAD.x * 2;
  const Hh = L.height + TT_PAD.top + TT_PAD.bottom;
  const doneN = list.filter((t) => st[t.id] === 'done').length;
  // 11-27 화면 4: 찍어 둔 목표까지 가는 길
  const goal = C.techGoalOf(state, line);
  const path = goal ? C.techPath(state, goal.id) : [];
  const onPath = new Set(path.map((t) => t.id));
  const goalHours = path.reduce((a, t) => a + C.techLeft(state, t), 0) / Math.max(0.01, C.researchRate(state));
  const step = goal ? C.goalNext(state, line) : null;
  // 처음 열 때·줄을 바꿀 때: 지금 연구(없으면 열 수 있는 첫 카드)가 보이게
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const focus = list.find((t) => st[t.id] === 'now') ?? list.find((t) => st[t.id] === 'open');
    const n = focus && L.nodes[focus.id];
    if (!n) {
      el.scrollTo({ left: 0, top: 0 }); // scrollTo는 요즘 Chrome에서 Promise를 돌려줘서 return 하면 탭을 바꿀 때 게임이 꺼졌음(11/25)
      return;
    }
    el.scrollTo({ left: Math.max(0, n.x + TT_PAD.x - 16), top: Math.max(0, n.y + TT_PAD.top - el.clientHeight / 2) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [line]);
  return (
    <section className="card tt-card">
      <div className="tt-head">
        <b>{line === 'mil' ? '⚙️ 군사 기술' : '📜 사회 제도'}</b>
        <small className="muted">
          {doneN}/{list.length} · 옆으로 밀어서 보기
        </small>
        <span className="tt-legend">
          <span className="lg-done">■ 끝남</span> <span className="lg-now">■ 연구 중</span> <span className="lg-open">■ 열 수 있음</span> <span className="lg-far">■ 아직</span>
        </span>
      </div>
      {goal ? (
        <div className="tt-goal">
          <span>
            🎯 목표 <b>{goal.name}</b> · 남은 연구 {path.length}개 · 약 {timeLeft(goalHours * H)}
          </span>
          {step && c.cur[line] !== step.id && (
            <button className="mini" disabled={!!C.techPayWhy(state, step.id)} onClick={() => actions.apply((s) => C.startResearch(s, step.id))}>
              ▶ {step.name}
            </button>
          )}
          <button className="mini" onClick={() => actions.apply((s) => C.setTechGoal(s, line, null))} aria-label="목표 지우기">
            ✕
          </button>
        </div>
      ) : (
        <p className="tt-goal muted">🎯 카드를 눌러 「목표로 찍기」를 하면 가는 길이 빛나고, 연구가 끝날 때마다 다음 걸음을 알아서 시작해요.</p>
      )}
      <div className="tt-box" ref={box}>
        <div className="tt-board" style={{ width: W, height: Hh }}>
          {L.eras.map((e, i) => {
            const x0 = colX(e.from) + TT_PAD.x - COL_GAP / 2;
            const x1 = colX(e.to) + CARD_W + TT_PAD.x + COL_GAP / 2;
            return (
              <div key={e.era} className={`tt-era ${i % 2 ? 'odd' : ''}`} style={{ left: Math.max(0, x0), width: Math.min(W, x1) - Math.max(0, x0) }}>
                <span>
                  <ArtIcon k={eraArtKey(e.era)} emoji={ERAS[e.era as Tech['era']].icon} cls="inline" /> {ERAS[e.era as Tech['era']].name}
                </span>
              </div>
            );
          })}
          <svg className="tt-lines" width={W} height={Hh} viewBox={`${-TT_PAD.x} ${-TT_PAD.top} ${W} ${Hh}`} aria-hidden>
            {edges.map((e) => (
              <path key={`${e.from}>${e.to}`} d={cardPath(e.pts)} className={`${e.cls}${onPath.has(e.to) && (onPath.has(e.from) || st[e.from] === 'done') ? ' goal' : ''}`} />
            ))}
          </svg>
          {list.map((t) => {
            const n = L.nodes[t.id];
            if (!n) return null;
            const s = st[t.id];
            const stage = C.techStage(state, t.id);
            const prog = s === 'now' ? C.techProgress(state, t) : 0;
            const icons = techUnlockIcons(t);
            // 카드 안 가속(11-25): 연구 중 카드뿐 아니라 지금 연구할 수 있는 모든 카드
            const few = s === 'now' || (s !== 'done' && !C.canResearch(state, t.id));
            return (
              <button
                key={t.id}
                className={`tt-node s-${s}${onPath.has(t.id) ? ' on-goal' : ''}${goal?.id === t.id ? ' is-goal' : ''}`}
                data-tech={t.id}
                style={{ left: n.x + TT_PAD.x, top: n.y + TT_PAD.top - CARD_H / 2, width: CARD_W, height: CARD_H }}
                onClick={() => onPick(t)}
                aria-label={t.name}
              >
                <span className="tt-ico">
                  <ArtIcon k={techArtKey(t.id)} emoji={t.icon} alt={t.name} />
                  {s !== 'done' && c.eureka.includes(t.id) && <i className="tt-eu">💡</i>}
                </span>
                <span className="tt-body">
                  <b className="tt-name">{t.name}</b>
                  <span className="tt-un">
                    {s === 'done' ? (
                      <i className="tt-ok">✓</i>
                    ) : (
                      <StagePips n={stage} cur={s === 'now'} />
                    )}
                    {icons.slice(0, few ? 1 : 4).map((u) => (
                      <i key={u.key} className="tt-u" title={u.label}>
                        {u.node}
                      </i>
                    ))}
                    {!few && icons.length > 4 && <small>+{icons.length - 4}</small>}
                  </span>
                </span>
                {s === 'now' && <span className="tt-prog" style={{ width: `${Math.round(prog * 100)}%` }} />}
              </button>
            );
          })}
          {list
            .filter((t) => L.nodes[t.id] && (st[t.id] === 'now' || (st[t.id] !== 'done' && !C.canResearch(state, t.id))))
            .map((t) => {
              const n = L.nodes[t.id];
              // 카드 안 오른쪽 아래(11-24·11-25): ⏩ 30분 · ⚡ 바로. 연구 중이 아닌 카드는 그 카드만 진행(하던 연구는 그대로)
              return (
                <span key={`b-${t.id}`} style={{ position: 'absolute', zIndex: 5, right: W - (n.x + TT_PAD.x + CARD_W) + 4, top: n.y + TT_PAD.top + CARD_H / 2 - 21 }}>
                  <BoostMini state={state} apply={actions.apply} target={st[t.id] === 'now' ? { kind: 'research', line: t.line } : { kind: 'tech', id: t.id }} cls="tt-boost" />
                </span>
              );
          })}
        </div>
      </div>
    </section>
  );
}

function TechModal({ state, actions, t, onClose, onGo }: ScreenProps & { t: Tech; onClose: () => void; onGo: (id: string) => void }) {
  const c = C.civOf(state);
  const done = C.hasTech(state, t.id);
  const now = c.cur[t.line] === t.id;
  const why = C.canResearch(state, t.id);
  const me = state.player.countryId;
  const unlocks: string[] = [
    ...(t.units ?? []).flatMap((u) => [`🪖 ${u}`, ...specialsFor(me, u).map((d) => `🌟 ${d.name}`)]),
    ...(t.cards ?? []).map((k) => cardById(k)).filter(Boolean).map((k) => `🃏 ${k!.name}`),
    ...(t.districts ?? []).map((d) => `${districtById(d).icon} ${districtById(d).name}`),
    ...DISTRICTS.filter((d) => d.tech === t.id).map((d) => `${d.icon} ${d.name}(군사 연구시설)`),
    ...(t.agree ?? []).map((a) => `${agreeById(a).icon} ${agreeById(a).name} 협정`),
  ];
  const switching = !done && !now && c.cur[t.line];
  // 11-27 연구 비용: 시작할 때 남은 단계만큼 나라 예산·자원을 냄
  const price = C.techPrice(state, t);
  const payWhy = why ? null : C.techPayWhy(state, t.id);
  const priceText = [price.money ? `💰${fmt(price.money)}` : '', ...Object.entries(price.res).map(([r, v]) => `${RES_ICON[r as keyof typeof RES_ICON] ?? ''}${r} ${v}`)].filter(Boolean).join(' ');
  const per = C.techStagePrice(t);
  return (
    <Modal
      title={t.name}
      icon={<ArtIcon k={techArtKey(t.id)} emoji={t.icon} alt={t.name} />}
      onClose={onClose}
      footer={
        done ? (
          <span className="good">✓ 끝낸 연구</span>
        ) : now ? (
          <span className="tech-now">
            <span className="muted">연구 중이에요</span>
            <BoostBar state={state} apply={actions.apply} target={{ kind: 'research', line: t.line }} />
          </span>
        ) : (
          <span className="tech-now">
            <button className="primary wide" disabled={!!why || !!payWhy} onClick={() => (onGo(t.id), onClose())}>
              {why ?? payWhy ?? (switching ? `이걸로 바꾸기(하던 연구는 그대로 남아요)${priceText ? ` · ${priceText}` : ''}` : `🔬 ${C.techStage(state, t.id) ? '이어서 연구' : '연구 시작'} · ${C.TECH_STAGES}단계 ${r1(C.techLeft(state, t))}시간${priceText ? ` · ${priceText}` : ''}`)}
            </button>
            {!why && !payWhy && <BoostBar state={state} apply={actions.apply} target={{ kind: 'tech', id: t.id }} compact />}
            <button className="wide" onClick={() => (actions.apply((s) => C.setTechGoal(s, t.line, t.id)), onClose())}>
              {c.goal?.[t.line] === t.id ? '🎯 목표에서 빼기' : `🎯 목표로 찍기 · 먼저 할 연구까지 ${C.techPath(state, t.id).length}개`}
            </button>
          </span>
        )
      }
    >
      {iconArt(techArtKey(t.id)) && (
        <div className="fac-hero">
          <img className="fac-art big contain" src={iconArt(techArtKey(t.id))!} alt={t.name} draggable={false} />
        </div>
      )}
      <p>
        <span className="tag">{t.line === 'mil' ? '⚙️ 군사 기술' : '📜 사회 제도'}</span> <span className="tag">{ERAS[t.era].icon} {ERAS[t.era].name}</span>
      </p>
      <p>{t.text}</p>
      <div className="tech-stages">
        {Array.from({ length: C.TECH_STAGES }, (_, i) => {
          const st = C.techStage(state, t.id);
          const on = i < st;
          const curSt = !on && i === st && now;
          const part = curSt ? (c.progress[t.id] ?? 0) / C.techCost(state, t) : on ? 1 : 0;
          return (
            <div key={i} className={`tech-stage ${on ? 'on' : ''} ${curSt ? 'cur' : ''}`}>
              <small>{i + 1}단계 {i === C.TECH_STAGES - 1 ? '· 완성' : ''}</small>
              <Meter value={part} max={1} tone={on ? 'green' : 'gold'} />
              <small className="muted">{on ? '✓ 끝' : `${r1(C.techCost(state, t))}시간`}</small>
            </div>
          );
        })}
      </div>
      {!done && (
        <p className="small tech-price">
          💳 <b>연구 비용</b>(한 단계): 💰{fmt(per.money)}
          {Object.entries(per.res).map(([r, v]) => ` · ${RES_ICON[r as keyof typeof RES_ICON] ?? ''}${r} ${v}`)} × {C.TECH_STAGES}단계 ·{' '}
          {C.techPaid(state, t.id) ? <span className="good">✓ 이미 냈어요</span> : <span className="muted">시작할 때 남은 단계만큼 한꺼번에 내요</span>}
        </p>
      )}
      {unlocks.length > 0 && (
        <div className="chips civ-unlocks">
          {unlocks.map((u) => (
            <span key={u} className="mini-chip">
              {u}
            </span>
          ))}
        </div>
      )}
      {t.units?.length ? (
        <p className="small muted">
          병과는 호칭도 필요해요:{' '}
          {t.units
            .map((u) => {
              const r = unitRankOf(u);
              return `${u} ${RANKS[r].name}부터`;
            })
            .join(' · ')}
        </p>
      ) : null}
      {t.needs.length > 0 && <p className="small">⬆️ 먼저 할 연구: {t.needs.map((n) => `${techById(n)!.icon} ${techById(n)!.name}${C.hasTech(state, n) ? ' ✓' : ''}`).join(', ')}</p>}
      {(() => {
        const next = TECHS.filter((x) => x.needs.includes(t.id));
        return next.length > 0 ? <p className="small">⬇️ 이어지는 연구: {next.map((x) => `${x.icon} ${x.name}${C.hasTech(state, x.id) ? ' ✓' : ''}`).join(', ')}</p> : null;
      })()}
      {t.eureka && (
        <div className={`civ-eureka ${c.eureka.includes(t.id) ? 'on' : ''}`}>
          💡 <b>번뜩임</b>: {t.eureka.text} → 연구 절반
          {c.eureka.includes(t.id) ? <b className="good"> · 이미 받았어요!</b> : null}
        </div>
      )}
    </Modal>
  );
}
const unitRankOf = (u: string) => UNITS.find((x) => x.name === u)?.rank ?? 0;

/* ═════════════ 체제 · 정책 카드 ═════════════ */

export function GovPanel(props: ScreenProps) {
  const { state, actions } = props;
  const c = C.civOf(state);
  const [choose, setChoose] = useState(false);
  const [slot, setSlot] = useState<number | null>(null);
  const rank = state.player.rankIndex;
  const gov = c.gov ? govById(c.gov) : null;
  const slots = gov ? govSlots(gov, rank) : [];
  const all = gov ? [...gov.slots, '자유', '자유', '자유'] : [];
  const free = C.swapCost(state) === 0;
  return (
    <>
      <section className="card">
        <div className="row">
          {gov ? (
            <span className="civ-gov">
              <span className="civ-gov-ico"><ArtIcon k={govArtKey(gov.id)} emoji={gov.icon} alt={gov.name} /></span>
              <span>
                <b>{gov.name}</b>
                <small className="muted">{gov.text}</small>
              </span>
            </span>
          ) : (
            <b>🏛️ 나라 체제를 골라 주세요</b>
          )}
          <Help title="체제와 정책 카드">
            <p>체제를 고르면 정책 카드 칸이 정해져요(⚔️군사 · 💰경제 · 🕊️외교 · ⭐자유). 자유 칸에는 아무 카드나 끼워요.</p>
            <p>칸은 지도자 호칭이 오를수록 늘어요: 처음 2칸 → 전설의 지도자 8칸.</p>
            <p>카드 바꾸기는 실제 하루 1번 무료, 그 밖엔 나라 예산이 들어요. 체제 바꾸기는 국가 헌장 연구 뒤, 예산 {fmt(GOV_CHANGE_COST)}과 하루 혼란(생산·연구 −20%)이 있어요. 처음 고르는 건 무료예요.</p>
            <p>다른 나라도 체제가 있어요. 같은 체제면 호감 +5, 다르면 −3이고, 다른 체제의 맞수와는 긴장이 조금씩 올라요.</p>
            <p>다른 나라 체제도 실제로 힘이 돼요: 군사 정부 전투력 +10%, 해군 통치 바다 건너 공격 +15%, 연방제 도시 지킬 때 +8%, 대통령제·상업 연합 예산이 더 많아요. 국기를 길게 누르면 보여요.</p>
            <p>전투력 효과(군사 정부·정예 부대 같은 카드)는 이미 가진 부대에도 바로 붙고, 빼면 바로 없어져요.</p>
          </Help>
        </div>
        {gov && (
          <div className="row">
            <small className="muted">
              카드 칸 {slots.length}/8 · 바꾸기 {free ? '오늘 무료' : `${fmt(C.swapCost(state))}`}
              {C.chaos(state) ? ` · ⚠️ 혼란 ${timeLeft(c.chaosUntil - state.worldMs)}` : ''}
            </small>
            <button onClick={() => setChoose(true)}>체제 바꾸기</button>
          </div>
        )}
        {gov && C.chaos(state) && (
          <div className="civ-gov-boost">
            <BoostBar state={state} apply={actions.apply} target={{ kind: 'chaos' }} compact />
          </div>
        )}
      </section>
      {gov && <PolicyNow state={state} />}
      {!gov && <GovChooser {...props} onDone={() => undefined} />}
      {gov && (
        <section className="card">
          <small className="stat-group-name">🃏 정책 카드 칸</small>
          <div className="tiles c4">
            {all.map((k, i) => {
              const open = i < slots.length;
              const card = open && c.cards[i] ? cardById(c.cards[i]!) : null;
              const needRank = RANKS.findIndex((_, r) => slotCount(r) > i);
              // 카드 안 가속(11-25): 끼운 카드는 다음 무료 바꾸기까지 남은 시간을 줄임
              const swapWait = !!card && boostLeft(state, { kind: 'swap' }) > 0;
              return (
                <div key={i} className={`bcard-cell ${swapWait ? 'boost-cell' : ''}`}>
                <Tile
                  icon={card ? <ArtIcon k={cardArtKey(card.id)} emoji={card.icon} alt={card.name} /> : SLOT_ICON[k as keyof typeof SLOT_ICON]}
                  label={card ? card.name : `${k} 칸`}
                  sub={open ? (card ? card.text : '비어 있음 · 누르기') : `${RANKS[needRank]?.name ?? ''}부터`}
                  locked={!open}
                  tone={card ? 'gold' : undefined}
                  onClick={() => open && setSlot(i)}
                />
                {swapWait && <BoostMini state={state} apply={actions.apply} target={{ kind: 'swap' }} />}
                </div>
              );
            })}
          </div>
          <p className="small muted">쓸 수 있는 카드 {C.unlockedCards(state).length}/{CARDS.length} · 사회 제도 연구로 더 열려요</p>
        </section>
      )}
      {gov && (
        <section className="card">
          <small className="stat-group-name">🌐 다른 나라의 체제</small>
          <div className="civ-govs">
            {COUNTRIES.filter((x) => x.id !== state.player.countryId && isAlive(state.world, x.id)).map((x) => (
              c.aiGov[x.id] && (
                <span key={x.id} className={`mini-chip ${c.aiGov[x.id] === c.gov ? 'same' : ''}`} title={`${x.name} · ${govById(c.aiGov[x.id]).name}: ${AI_GOV_EFF[c.aiGov[x.id]].text}`}>
                  {FLAG[x.id]} {govById(c.aiGov[x.id]).icon}
                </span>
              )
            ))}
          </div>
        </section>
      )}
      {choose && (
        <Modal title="체제 바꾸기" icon="🏛️" onClose={() => setChoose(false)}>
          <GovChooser {...props} onDone={() => setChoose(false)} />
        </Modal>
      )}
      {slot !== null && gov && (
        <Modal title={`${slots[slot]} 칸 카드`} icon={SLOT_ICON[slots[slot]]} onClose={() => setSlot(null)}>
          {c.cards[slot] && (
            <button className="wide" onClick={() => (actions.apply((s) => C.putCard(s, slot, null)), setSlot(null))}>
              카드 빼기
            </button>
          )}
          {CARDS.filter((k) => slots[slot] === '자유' || k.kind === slots[slot]).map((k) => {
            const why = C.canPutCard(state, slot, k.id);
            const unlocked = C.unlockedCards(state).includes(k.id);
            const from = SOC_TECHS.find((t) => t.cards?.includes(k.id)) ?? MIL_TECHS.find((t) => t.cards?.includes(k.id));
            return (
              <div key={k.id} className={`list-row ${unlocked ? '' : 'is-locked'}`}>
                <span>
                  <ArtIcon k={cardArtKey(k.id)} emoji={k.icon} alt={k.name} cls="inline" /> <b>{k.name}</b> <span className="tag">{k.kind}</span>
                  <br />
                  <small className="muted">{unlocked ? k.text : `🔒 ${from?.name ?? ''} 연구로 열림 · ${k.text}`}</small>
                </span>
                <button className="primary" disabled={!!why || c.cards[slot] === k.id} title={why ?? ''} onClick={() => (actions.apply((s) => C.putCard(s, slot, k.id)), setSlot(null))}>
                  {c.cards[slot] === k.id ? '끼움' : c.cards[slot] && !free ? `바꾸기 ${fmt(C.swapCost(state))}` : '끼우기'}
                </button>
              </div>
            );
          })}
        </Modal>
      )}
    </>
  );
}

/** 11-27 지금 체제·카드로 받는 효과 합계 */
function PolicyNow({ state }: { state: ScreenProps['state'] }) {
  const rows = C.policySummary(state);
  const base = state.economy.power;
  const now = armyPower(state);
  return (
    <section className="card">
      <small className="stat-group-name">✅ 지금 받는 효과(체제 + 카드)</small>
      {rows.length ? (
        <div className="civ-govs">
          {rows.map(([k, v]) => (
            <span key={k} className="mini-chip">
              {k} <b>{v}</b>
            </span>
          ))}
        </div>
      ) : (
        <p className="small muted">아직 효과가 없어요. 카드를 끼워 보세요.</p>
      )}
      {base > 0 && now !== base && (
        <p className="small muted">
          💪 전투력 {fmt(base)} → <b>{fmt(now)}</b>(체제·카드가 가진 부대 모두에 바로 붙음)
        </p>
      )}
    </section>
  );
}

function GovChooser({ state, actions, onDone }: ScreenProps & { onDone: () => void }) {
  const c = C.civOf(state);
  return (
    <div className="civ-gov-pick">
      {GOVS.map((g) => {
        const why = C.canSetGov(state, g.id as GovId);
        // 카드 안 가속(11-25): 지금 체제가 혼란 중이면 혼란 줄이기 · 바꿀 수 있는 체제는 ⚡혼란 없이 바로 바꾸기
        const calming = c.gov === g.id && C.chaos(state);
        const swapNow = !!c.gov && !why;
        return (
          <div key={g.id} className={`bcard-cell ${calming || swapNow ? 'boost-cell' : ''}`}>
          <button
            className={`civ-gov-card ${c.gov === g.id ? 'on' : ''}`}
            disabled={!!why}
            onClick={() => {
              if (c.gov && !window.confirm(`${g.name}로 바꿀까요? 나라 예산 ${fmt(GOV_CHANGE_COST)} · 하루 혼란`)) return;
              actions.apply((s) => C.setGov(s, g.id));
              onDone();
            }}
          >
            <span className="civ-gov-ico"><ArtIcon k={govArtKey(g.id)} emoji={g.icon} alt={g.name} /></span>
            <b>{g.name}</b>
            <small>{g.slots.map((k) => SLOT_ICON[k]).join(' ')}</small>
            <small>{g.text}</small>
            <small className="muted">어울림: {g.play}</small>
            {g.needs && !C.hasTech(state, g.needs) && <small className="warn">🔒 {techById(g.needs)?.name} 연구로 열림</small>}
            {why && c.gov && !(g.needs && !C.hasTech(state, g.needs)) && <small className="warn">{why}</small>}
          </button>
          {calming && <BoostMini state={state} apply={actions.apply} target={{ kind: 'chaos' }} />}
          {swapNow && (
            <BoostStart
              state={state}
              apply={(f) => {
                if (!window.confirm(`${g.name}로 바로 바꿀까요? 나라 예산 ${fmt(GOV_CHANGE_COST)} · 혼란은 가속권으로 바로 끝내요`)) return;
                actions.apply(f);
                onDone();
              }}
              need={Math.ceil(GOV_CHAOS_MS / BOOST_MS)}
              label="바로 바꾸기"
              run={(s) => startAndFinish(s, (x) => C.setGov(x, g.id), { kind: 'chaos' })}
            />
          )}
          </div>
        );
      })}
    </div>
  );
}

/* ═════════════ 도시: 구역 · 민심 · 인구 ═════════════ */

const loyaltyFace = (v: number) => (v >= 75 ? '😊' : v >= LOYALTY_OK ? '🙂' : v >= 30 ? '😟' : '😠');

export function CityPanel(props: ScreenProps) {
  const { state } = props;
  const me = state.player.countryId;
  // 본부 지도에서 '도시 안으로 들어가기'로 왔으면 그 도시를 바로 엶
  const [pick, setPick] = useState<string | null>(() => {
    try {
      const f = sessionStorage.getItem('city-focus');
      sessionStorage.removeItem('city-focus');
      return f && state.world.owner[f] === me ? f : null;
    } catch {
      return null;
    }
  });
  const mine = CITIES.filter((c) => state.world.owner[c.id] === me);
  const t = C.cityTotals(state);
  return (
    <>
      <section className="card">
        <div className="row">
          <div className="ichips">
            <span className="ichip">
              <span>{loyaltyFace(t.avgLoyalty)}</span>
              <b>{Math.round(t.avgLoyalty)}</b>
              <small>민심</small>
            </span>
            <span className="ichip">
              <span>👪</span>
              <b>{t.pop}</b>
              <small>인구</small>
            </span>
            <span className="ichip">
              <span>🏛️</span>
              <b>×{r1(C.civBudgetMult(state))}</b>
              <small>수입</small>
            </span>
          </div>
          <Help title="도시">
            <p>도시마다 육각 칸이 있어요(소도시 169 · 중도시 271 · 대도시 397칸). 칸에 <b>구역</b>을 지어요: 소도시 3 · 중도시 5 · 대도시 7개.</p>
            <p>🇰🇷 대한민국 10개 도시는 실제 행정구역 모양 그대로예요. 구·군 경계, 강, 실제 시설(대통령실·국방과학연구소·해군작전사령부 등)이 실제 자리에 있고, 시설마다 발전 단계(1~{MARK_MAX})를 올릴 수 있어요.</p>
            <p>
              <b>도시 특성·실제 시설·군사 연구시설</b>은 나라 전체 예산·자원·연구·모집·전투력·임무에 더해져요. 그 도시 민심이 낮으면 줄고, 점령지는 절반만 받아요.
            </p>
            <ul>
              {DISTRICTS.map((d) => (
                <li key={d.id}>
                  {d.icon} <b>{d.name}</b>({d.where}): {d.text}. {d.adj}
                </li>
              ))}
            </ul>
            <p>
              <b>민심</b>(0~100): 전쟁 피로·점령·자원 부족이면 내려가고, 주거 구역·복지 연구·평화 협정이면 올라요. {LOYALTY_OK}보다 낮으면 그 도시 생산이 줄어요. 아주 낮아도 도시를 잃지는 않아요.
            </p>
            <p>
              <b>인구</b>(1~10): 민심 60 이상이면 자라요. 처음보다 자란 인구만큼 나라 예산과 연구가 늘어요.
            </p>
          </Help>
        </div>
      </section>
      <div className="civ-cities">
        {mine.map((city) => {
          const cc = C.cityCiv(state, city.id);
          const building = cc.districts.filter((d) => d.doneMs > state.worldMs).length;
          const stg = cityStage(state, city.id);
          return (
            <button key={city.id} className={`civ-city ${cc.loyalty < LOYALTY_OK ? 'low' : ''}`} onClick={() => setPick(city.id)}>
              <CityLogo name={city.name} country={city.home} capital={city.capital} size={58} />
              <span className="civ-city-body">
                <span className="civ-city-top">
                  <b>
                    {city.capital ? '👑 ' : ''}
                    {isHometown(city.name) ? '🏡 ' : ''}
                    {city.name}
                  </b>
                  <span title={`민심 ${Math.round(cc.loyalty)}`}>
                    {loyaltyFace(cc.loyalty)}
                    <small>{Math.round(cc.loyalty)}</small>
                  </span>
                </span>
                <small className="civ-city-nick">
                  {KR_CITY_INFO[city.name] ? `${KR_CITY_INFO[city.name].trait.icon} ${KR_CITY_INFO[city.name].nick}` : `${SIZE_NAME[city.size]} · ${countryById(city.home).name}`}
                  {annexTag(state, city.id)}
                </small>
                <Meter value={cc.loyalty} max={100} tone={cc.loyalty >= LOYALTY_OK ? 'green' : 'red'} />
                <span className="civ-city-facts">
                  {city.front ? <span title="점령 도시(전쟁 거점)">⚔️</span> : <span title={`내정 도시 · ${cityById(city.hub).name}을 따라감`}>🏘️</span>}
                  <span title="도시 단계">
                    {stg.stage.icon}
                    {stg.stage.name}
                  </span>
                  <span title="인구">👪{people(C.cityPeople(state, city.id))}</span>
                  <span title="구역">
                    🏗️{cc.districts.length}/{C.districtSlots(state, city.id)}
                    {building ? '⏳' : ''}
                  </span>
                  {cityMarkCount(city.id) > 0 && <span title="실제 시설">🏛️{cityMarkCount(city.id)}</span>}
                </span>
              </span>
            </button>
          );
        })}
      </div>
      {pick && <CityModal {...props} id={pick} onClose={() => setPick(null)} />}
    </>
  );
}

const cityMarkCount = (id: string) => C.cityMarks(id).length;

/** 도시 칸 바깥 테두리 → 굽이진 해안선 */
function cityCoast(tiles: Array<{ q: number; r: number; x: number; y: number }>): string {
  const has = new Set(tiles.map((t) => hexKey(t.q, t.r)));
  const segs: Seg[] = [];
  for (const t of tiles) {
    const cs = hexCorners(t.x, t.y);
    cs.forEach((p, i) => {
      const dir = HEX_DIRS[EDGE_DIR[i]];
      if (!has.has(hexKey(t.q + dir.q, t.r + dir.r))) segs.push([p, cs[(i + 1) % 6]]);
    });
  }
  return smoothPath(segs, { relax: 70, wiggle: HEX_SIZE * 0.6 });
}

const TERRAIN_COLOR: Record<C.Terrain, string> = { 평지: '#4d7c3a', 산: '#78716c', 유적: '#a78b4f', 바닷가: '#c2a86b' };

const people = (v: number) => (v >= 10000 ? `${Math.round(v / 1000) / 10}천만` : `${v.toLocaleString()}만`);
const MARK_COLOR: Record<string, string> = {
  gov: '#c9b98f', intel: '#64748b', army: '#6b7a4f', navy: '#3b6e9c', air: '#7d93ad', lab: '#d8dee6', univ: '#b98a6b', bank: '#8fa4b8', industry: '#9a8f86',
  port: '#7c8ea0', airport: '#a3b3c2', culture: '#b8754f', tourism: '#4fa3a5', nature: '#5f8f4a', energy: '#a8a29e', shipyard: '#71839a',
};

/** 구·군이 다른 이웃 칸 사이 선 */
function guBorders(tiles: Array<{ q: number; r: number; x: number; y: number; gu?: number }>): string {
  const at = new Map(tiles.map((t) => [hexKey(t.q, t.r), t]));
  let d = '';
  for (const t of tiles) {
    if (t.gu === undefined) continue;
    const cs = hexCorners(t.x, t.y);
    cs.forEach((p, i) => {
      const dir = HEX_DIRS[EDGE_DIR[i]];
      const o = at.get(hexKey(t.q + dir.q, t.r + dir.r));
      if (o && o.gu !== undefined && o.gu > t.gu!) {
        const q2 = cs[(i + 1) % 6];
        d += `M${p[0].toFixed(2)},${p[1].toFixed(2)}L${q2[0].toFixed(2)},${q2[1].toFixed(2)}`;
      }
    });
  }
  return d;
}

/** 효과에 몫(민심·점령)을 곱해 한 줄로 */
const scaled = (e: CityEff, k: number): CityEff => Object.fromEntries(Object.entries(e).map(([key, v]) => [key, key === 'loyalty' ? v : (v as number) * k])) as CityEff;

function CityModal({ state, actions, go, id, onClose }: ScreenProps & { id: string; onClose: () => void }) {
  const city = cityById(id);
  const cc = C.cityCiv(state, id);
  const map = cityMap(id);
  const tiles = map.tiles;
  const info = KR_CITY_INFO[city.name] ?? null;
  const [sel, setSel] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  const [zoom, setZoom] = useState(1);
  const [open, setOpen] = useState(false);
  // 11-27 지방 순방
  const [issue, setIssue] = useState<number | null>(null);
  const tour = tourOf(state);
  const tourHere = tour.open?.city === id ? tour.open : null;
  const tourWhy = canTour(state, id);
  const mine = state.world.owner[id] === state.player.countryId;
  // 그때와 지금: 취임 첫날 모습으로 잠깐 되돌려 보기
  const [then, setThen] = useState(false);
  const [dayMode, setDayMode] = useState<DayMode>('자동');
  // 11-27 도시 1: 3D 자료가 있는 도시는 3D로 먼저 열림(2D로 바꾸면 그 선택을 기억)
  const [is3d, setIs3dRaw] = useState(() => {
    try {
      return localStorage.getItem('mw-city-3d') !== '0';
    } catch {
      return true;
    }
  });
  const setIs3d = (v: boolean) => {
    setIs3dRaw(v);
    try {
      localStorage.setItem('mw-city-3d', v ? '1' : '0');
    } catch {
      /* 저장 못 해도 그대로 */
    }
  };
  /** 3D 시험용: 단계 미리보기(null = 지금 인구) */
  const [preview, setPreview] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  useDragScroll(scrollRef, zoom > 1);
  // 확대하면 도심이 가운데 오게
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el || zoom === 1) return;
    el.scrollLeft = (el.scrollWidth - el.clientWidth) / 2;
    el.scrollTop = (el.scrollHeight - el.clientHeight) / 2;
  }, [zoom]);
  const distAt = (k: string) => cc.districts.find((d) => d.tile === k);
  const mineAt = (k: string) => (cc.mines ?? []).find((m) => m.tile === k);
  const selTile = sel ? tiles.find((t) => hexKey(t.q, t.r) === sel) : null;
  const dep = sel ? C.depositAt(id, sel) : null;
  const selMark = sel ? C.markAt(id, sel) : null;
  const target = C.loyaltyTarget(state, id);
  const marks = C.cityMarks(id);
  const coast = useMemo(() => cityCoast(tiles), [id]);
  const around = useMemo(() => {
    if (!map.outLand.size) return undefined;
    const pts = [...map.outLand].map((k) => {
      const [q, r] = k.split(',').map(Number);
      return { q, r, x: HEX_SIZE * Math.sqrt(3) * (q + r / 2), y: HEX_SIZE * 1.5 * r };
    });
    return cityCoast(pts);
  }, [id]);
  const borders = useMemo(() => (map.gu && map.gu.length > 1 ? guBorders(tiles) : undefined), [id]);
  const rivers = useMemo(
    () =>
      info?.rivers && map.geo
        ? info.rivers.map((r) => ({ w: r.w, d: 'M' + r.pts.map((p) => map.geo!(...p)).map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join('L') }))
        : undefined,
    [id],
  );
  const now = state.worldMs;
  const markLv = (mid: string) => (then ? (marks.find((m) => m.id === mid)?.lv ?? 0) : C.markLevel(state, id, mid));
  const view = then ? { ...cc, pop: city.size - 1, districts: [], mines: [], marks: undefined } : cc;
  const peopleNow = C.cityPeople(state, id);
  const stg = then ? stageOfPeople(cityPeopleAtStart(state, id)) : cityStage(state, id);
  const night = nightLevel(dayMode);
  const myProjects = then ? [] : busyProjects(state).filter(([, p]) => p.cityId === id);
  const zone = then ? undefined : zoneById(domOf(state).zones[id] ?? '');
  const cells = useMemo((): CityCell[] => {
    const cc = view;
    const base = tiles.map((t) => {
      const k = hexKey(t.q, t.r);
      const ground = C.terrainOf(id, t.q, t.r);
      const d = cc.districts.find((x) => x.tile === k);
      const m = (cc.mines ?? []).find((x) => x.tile === k);
      const mk = marks.find((x) => x.tile === k);
      const dp = C.depositAt(id, k);
      let thing = null as CityThing | null;
      if (t.center) thing = 'center';
      else if (mk) thing = 'mark';
      else if (d) thing = d.id as CityThing;
      else if (m) thing = 'mine';
      else if (dp) thing = null;
      else if (ground === '산') thing = 'mountain';
      else if (ground === '유적') thing = 'ruins';
      const st = mk ? cc.marks?.[mk.id] : undefined;
      return {
        key: k,
        x: t.x,
        y: t.y,
        ground,
        thing,
        building: (d && d.doneMs > now) || (m && m.doneMs > now) || (st && st.doneMs > now) || false,
        deposit: dp && !d ? RES_ICON[dp] : null,
        mined: !!m,
        mark: mk ? { icon: MARK_KIND[mk.kind].icon, lv: markLv(mk.id), color: MARK_COLOR[mk.kind], nature: mk.kind === 'nature' && !mk.home, home: !!mk.home, art: markLv(mk.id) > 0 ? cityArt(`city-mark-${id}-${mk.id}`) : null } : undefined,
        dist: hexDist(t, { q: 0, r: 0 }),
      };
    });
    // 빈 땅: 인구가 늘수록 도심에서 시가지가 퍼짐(가까운 곳은 아파트 단지, 바깥은 주택가), 멀리엔 숲
    const empty = base.filter((c) => !c.thing && !c.deposit && c.ground !== '바닷가').sort((a, b) => a.dist - b.dist || a.y - b.y);
    const built = cc.districts.length + marks.length;
    const urban = Math.min(empty.length, Math.round(cc.pop * 9 + built * 2));
    const dense = Math.round(urban * Math.min(0.5, cc.pop / 16));
    empty.slice(0, dense).forEach((c) => (c.thing = 'apt'));
    empty.slice(dense, urban).forEach((c) => (c.thing = 'suburb'));
    empty.slice(urban).forEach((c) => {
      const h = (Math.abs(Math.round(c.x * 7 + c.y * 13)) * 2654435761) % 97;
      if (h % 3 === 0) c.thing = 'forest';
    });
    return base;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, then, cc.districts, cc.mines, cc.marks, cc.pop, Math.floor(now / 60000)]);
  // 대형 사업 공사 중: 도심 가까운 시가지에 크레인
  const cranes = useMemo(() => {
    if (!myProjects.length) return [];
    return cells
      .filter((c) => c.thing === 'apt' || c.thing === 'suburb')
      .sort((a, b) => (a as CityCell & { dist: number }).dist - (b as CityCell & { dist: number }).dist)
      .slice(0, myProjects.length * 2)
      .filter((_, i) => i % 2 === 0)
      .map((c) => c.key);
  }, [cells, myProjects.length]);
  const labels = useMemo((): CityLabel[] => {
    const out: CityLabel[] = [];
    if (map.gu && map.gu.length > 1) {
      map.gu.forEach((name, gi) => {
        const ts = tiles.filter((t) => t.gu === gi);
        if (!ts.length) return;
        const cx = ts.reduce((a, t) => a + t.x, 0) / ts.length;
        const cy = ts.reduce((a, t) => a + t.y, 0) / ts.length;
        // 가운데에 가장 가까운 칸 위에
        const t = ts.reduce((b, x) => (Math.hypot(x.x - cx, x.y - cy) < Math.hypot(b.x - cx, b.y - cy) ? x : b));
        out.push({ x: t.x, y: t.y, text: name, kind: 'gu' });
      });
    }
    if (zoom >= 2)
      for (const mk of marks) {
        const t = map.at.get(mk.tile)!;
        out.push({ x: t.x, y: t.y, text: mk.name, kind: 'mark' });
      }
    return out;
  }, [id, zoom]);
  const parts = C.cityParts(state, id);
  const share = C.cityShare(state, id);
  const milDefs = DISTRICTS.filter((d) => d.mil);
  const baseDefs = DISTRICTS.filter((d) => !d.mil);
  const buildTile = (d: (typeof DISTRICTS)[number]) => {
    const why = C.canDistrict(state, id, sel!, d.id as DistrictId);
    const adj = C.adjCount(id, sel!, d.id, cc);
    return (
      <Tile
        key={d.id}
        icon={d.icon}
        label={d.name}
        sub={why ? why.replace(' 필요', '') : `${fmt(d.cost)} · 이웃+${adj}`}
        locked={!!why}
        onClick={() => {
          if (why) return setMsg(`${d.name}: ${why}`);
          actions.apply((s) => C.buildDistrict(s, id, sel!, d.id));
          setMsg(`${d.icon} ${d.name} 공사 시작! ${r1(C.districtHours(state, d.id))}시간 뒤 완공 · ${d.text}`);
          setSel(null);
        }}
      />
    );
  };
  return (
    <Modal title={isHometown(city.name) ? `${city.name} · 고향` : city.name} icon={city.capital ? '👑' : isHometown(city.name) ? '🏡' : '🏙️'} onClose={onClose}>
      <div className="row">
        <span>
          {loyaltyFace(cc.loyalty)} 민심 <b>{Math.round(cc.loyalty)}</b> <small className="muted">→ {Math.round(target)}</small>
        </span>
        <span>
          👪 <b>{people(C.cityPeople(state, id))}</b> <small className="muted">(발전 {cc.pop}/{C.popCap(state, id)})</small>
        </span>
        <Tip label="이유" title="민심 목표" rows={C.loyaltyReasons(state, id).map(([k, v]) => [k, signed(Math.round(v))])} total={`${Math.round(target)}`} />
      </div>
      <div className="city-stage">
        <span className="city-stage-badge">
          {stg.stage.icon} <b>{stg.stage.name}</b>
          <small> {stg.stage.lv + 1}/{CITY_STAGES.length}단계</small>
        </span>
        {stg.next ? (
          <span className="city-stage-bar" title={`${stg.next.name}까지 ${people(Math.max(0, stg.next.min - (then ? cityPeopleAtStart(state, id) : peopleNow)))} 명`}>
            <i style={{ width: `${Math.round(stg.frac * 100)}%` }} />
            <small>
              {stg.next.icon} {stg.next.name}까지 {Math.round(stg.frac * 100)}%
            </small>
          </span>
        ) : (
          <small className="muted">가장 높은 단계예요</small>
        )}
        {zone && (
          <span className="city-stage-tag" title={zone.text}>
            {zone.icon} {zone.name}
          </span>
        )}
        {!then && state.world.owner[id] === state.player.countryId && (() => {
          const j = cityJobs(state, id);
          return (
            <span className={`city-stage-tag ${j.loyalty < 0 ? 'bad' : ''}`} title={`일자리 ${j.jobs} · 일손 ${j.workers} → 민심 ${signed(j.loyalty)}. 실제 시설 단계·구역·특구·대형 사업이 일자리를 만들어요.`}>
              💼 {j.label} {signed(j.loyalty)}
            </span>
          );
        })()}
        {myProjects.map(([pid, p]) => (
          <span key={pid} className="city-stage-tag" title={`${p.stage + 1}/3단계 공사 중`}>
            🏗️ {projectById(pid).icon} {projectById(pid).name}
          </span>
        ))}
      </div>
      <AnnexBox state={state} id={id} apply={(f) => actions.apply(f)} go={go} />
      {cc.loyalty < LOYALTY_OK && <p className="small warn">민심이 낮아 이 도시 생산 ×{r1(C.loyaltyMult(cc.loyalty))} (도시는 잃지 않아요)</p>}
      <div className="city-info">
        <button className="city-info-top" onClick={() => setOpen(!open)}>
          <span className="city-info-name">
            <CityLogo name={city.name} country={city.home} capital={city.capital} size={36} />
            {info ? `${info.trait.icon} ${info.nick}` : `${SIZE_NAME[city.size]} · ${tiles.length}칸`}
          </span>
          <small>{open ? '접기 ▲' : '도시 정보 ▼'}</small>
        </button>
        {info && (
          <p className="small">
            <b>{info.trait.icon} {info.trait.name}</b>: {info.trait.text}
          </p>
        )}
        {(() => {
          const gf = GOV_FACILITIES.filter((f) => govFacCity(state, f) === id);
          return gf.length ? (
            <p className="small">
              🏛️ 정부 시설: {gf.map((f) => `${f.icon}${f.name} ${govFacLevel(state, f.id) ? '★'.repeat(govFacLevel(state, f.id)) : '(미착공)'}`).join(' · ')}
              <span className="muted"> · 부처 창에서 지어요</span>
            </p>
          ) : null;
        })()}
        {isHometown(city.name) && (
          <p className="small good">
            🏡 대장의 고향: 민심 +{HOMETOWN_LOYALTY} · 고향 전용 시설 {info?.landmarks.filter((m) => m.home).length ?? 0}가지(🏗️ 빈 터를 눌러 짓기)
            <br />
            {C.ownsHomeBelt(state) ? '✅' : '⬜'} 전라 고향 벨트(익산·여수·순천 모두 우리 땅): {effText(HOME_BELT)}
          </p>
        )}
        {open && (
          <div className="city-info-body small">
            {info ? (
              <>
                <p>
                  실제 인구 약 <b>{people(info.pop)}</b> 명 · 면적 {info.area.toLocaleString()}km² · {info.admin}
                </p>
                <p>주요 산업: {info.industry.join(' · ')}</p>
                {map.gu && map.gu.length > 1 && <p className="muted">행정구역: {map.gu.join(' · ')}</p>}
              </>
            ) : (
              <p>
                {SIZE_NAME[city.size]} · 칸 {tiles.length} · 인구 약 {people(C.cityPeople(state, id))} · 기관{' '}
                {(CITY_INST[city.name] ?? []).map((i) => `${instById(i).icon}${instById(i).name}`).join(' · ') || '없음'}
              </p>
            )}
            {CITY_LOGO[city.name]?.file && (
              <p className="muted">
                상징: {CITY_LOGO[city.name].kind} · 위키미디어 공용 「{CITY_LOGO[city.name].file}」 ({CITY_LOGO[city.name].lic === 'PD' ? '공공 저작물' : CITY_LOGO[city.name].lic}{CITY_LOGO[city.name].by ? ` · 만든 이 ${CITY_LOGO[city.name].by}` : ''})
              </p>
            )}
            <p className="stat-group-name">이 도시가 나라에 주는 힘 (민심·점령 반영 ×{r1(share)})</p>
            <ul className="city-eff">
              {info && <li>⭐ 도시 특성: {effText(scaled(parts.trait, share)) || '없음'}</li>}
              {marks.length > 0 && <li>🏛️ 실제 시설 {marks.length}곳: {effText(scaled(parts.marks, share)) || '없음'}</li>}
              <li>
                🧪 군사 연구시설:{' '}
                {effText(scaled(parts.mil, share)) || '없음'}
                {parts.mil.pDom && (['육', '해', '공'] as const).filter((d) => parts.mil.pDom![d]).map((d) => ` · ${d}군 전투력 +${r1(parts.mil.pDom![d] * share * 100)}%`).join('')}
              </li>
            </ul>
            {marks.length > 0 && (
              <div className="city-marks">
                {marks.map((mk) => (
                  <button key={mk.id} className={`city-mark ${sel === mk.tile ? 'on' : ''}`} onClick={() => (setSel(mk.tile), setMsg(''))}>
                    {MARK_KIND[mk.kind].icon} {mk.name} <b>{markLv(mk.id)}단계</b>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      {mine && (
        <div className="tour-box">
          {tourHere ? (
            <>
              <b>🚌 순방 중 · 현안 {tourHere.issues.filter((x) => x.done).length}/{tourHere.issues.length}</b>
              <small className="muted"> {is3d && CITY3D_FILE[id] ? '도시 위 표시나 아래 칸을 누르세요' : '아래 칸을 누르세요'}</small>
              <div className="tour-chips">
                {tourHere.issues.map((x, i) => (
                  <button key={i} className={x.done ? 'done' : ''} disabled={!!x.done} onClick={() => setIssue(i)}>
                    {x.done ? '✅' : issueById(x.def).icon} {issueById(x.def).title}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <button className="gold wide" disabled={!!tourWhy} onClick={() => actions.apply((s) => startTour(s, id))}>
              🚌 {city.name} 순방하기
              <small> {tourWhy ? (state.worldMs < tour.nextMs && !tour.open ? `· 다음 순방까지 ${timeLeft(tour.nextMs - state.worldMs)}` : `· ${tourWhy}`) : `· 현안 3곳을 풀면 민심·지지도 +${TOUR_DONE_APPROVAL}·이 도시 출신 인재`}</small>
            </button>
          )}
        </div>
      )}
      {issue != null && tourHere?.issues[issue] && !tourHere.issues[issue].done && (
        <Modal title={`${city.name} · ${issueById(tourHere.issues[issue].def).title}`} icon={issueById(tourHere.issues[issue].def).icon} onClose={() => setIssue(null)}>
          <div className="crisis">
            <p>{issueById(tourHere.issues[issue].def).text}</p>
            {(['pay', 'talk'] as const).map((how) => {
              const why = canSolve(state, issue, how);
              return (
                <button
                  key={how}
                  className="wide crisis-opt"
                  disabled={!!why}
                  onClick={() => {
                    actions.apply((s) => solveIssue(s, issue, how));
                    setIssue(null);
                  }}
                >
                  <b>{issueById(tourHere.issues[issue].def)[how]}</b>
                  <small className="muted">{why ?? (how === 'pay' ? `💰 나라 예산 −${fmt(payCost(state))} · 민심 +${TOUR_PAY_LOYALTY}` : `무료 · 민심 +${TOUR_TALK_LOYALTY}`)}</small>
                </button>
              );
            })}
            <p className="small muted">세 곳을 모두 풀면 민심 +{TOUR_DONE_LOYALTY} · 지지도 +{TOUR_DONE_APPROVAL}(하루) · {city.name} 출신 인재 한 명. 예산으로 두 곳 이상 풀면 우수 인재가 올 수 있어요.</p>
          </div>
        </Modal>
      )}
      <div className="city-zoom-bar">
        {[1, 2, 3].map((z) => (
          <button key={z} className={zoom === z ? 'on' : ''} onClick={() => setZoom(z)}>
            {z === 1 ? '전체' : `${z}배`}
          </button>
        ))}
        <button className={`city-dn ${night > 0.5 ? 'on' : ''}`} title={`낮·밤: ${dayMode}`} onClick={() => setDayMode(dayMode === '자동' ? (night > 0.5 ? '낮' : '밤') : dayMode === '낮' ? '밤' : '낮')}>
          {night > 0.5 ? '🌙' : '☀️'}
        </button>
        {CITY3D_FILE[id] && (
          <button className={`city-3d-btn ${is3d ? 'on' : ''}`} onClick={() => (setIs3d(!is3d), setPreview(null))}>
            {is3d ? '🗺️ 2D' : '🏙️ 3D'}
          </button>
        )}
        <button className={`city-then ${then ? 'on' : ''}`} onClick={() => setThen(!then)}>
          {then ? '📅 취임 첫날' : '📅 그때와 지금'}
        </button>
      </div>
      <small className="muted city-zoom-hint">
        {then ? `취임 첫날 모습(인구 약 ${people(cityPeopleAtStart(state, id))}). 다시 누르면 지금 모습.` : zoom > 1 ? '마우스로 잡고 끌거나 손가락으로 밀어서 둘러보기 · 시설 이름 보임' : '2배·3배로 확대하면 잡고 끌어서 둘러볼 수 있어요'}
      </small>
      {is3d && CITY3D_FILE[id] ? (
        <>
          <Suspense fallback={<div className="city3d city3d-msg">🏗️ 3D 도시 불러오는 중…</div>}>
            <City3D
              file={CITY3D_FILE[id]}
              level={preview ?? stg.stage.lv + stg.frac}
              night={night}
              marks={tourHere?.issues.map((x) => ({ x: x.x, y: x.y, icon: issueById(x.def).icon, label: issueById(x.def).title, done: !!x.done }))}
              onMark={setIssue}
              scars={Math.max(0, Math.min(1, (CITY_DEFENSE_MAX - (state.world.defense[id] ?? CITY_DEFENSE_MAX)) / (CITY_DEFENSE_MAX * 0.7)))}
            />
          </Suspense>
          <label className="city3d-preview small">
            <span>
              🧪 단계 미리보기(시험): <b>{CITY_STAGES[Math.floor(preview ?? stg.stage.lv)].icon} {CITY_STAGES[Math.floor(preview ?? stg.stage.lv)].name}</b>
              {preview == null ? ' · 지금 인구' : ''}
            </span>
            <input type="range" min={0} max={6} step={0.1} value={preview ?? stg.stage.lv + stg.frac} onChange={(e) => setPreview(+e.target.value)} />
          </label>
          <small className="muted">한 손가락으로 밀기 · 두 손가락으로 확대·돌리기(PC는 오른쪽 끌기로 돌리기) · 노란 크레인 = 다음에 지어질 자리</small>
        </>
      ) : (
      <div ref={scrollRef} className={`city-scroll ${zoom > 1 ? 'zoomed' : ''}`}>
        <CityView
          cells={cells}
          coast={coast}
          sel={sel}
          onPick={(k) => (setSel(k), setMsg(''))}
          uid={id}
          inland={!isCoastalCity(id)}
          around={around}
          borders={borders}
          rivers={rivers}
          labels={labels}
          zoom={zoom}
          stage={stg.stage.lv}
          night={night}
          cranes={cranes}
          traffic
        />
      </div>
      )}
      <div className="legend small muted">
        <span>
          <i style={{ background: TERRAIN_COLOR.평지 }} /> 평지
        </span>
        <span>
          <i style={{ background: TERRAIN_COLOR.바닷가 }} /> 바닷가
        </span>
        <span>⛰️ 산</span>
        <span>🏺 유적</span>
        <span>🏛️ 도심</span>
        {marks.length > 0 && <span>🔵 실제 시설(점 = 단계)</span>}
        <span>◌ 매장지 · ⛏️ 채굴장</span>
      </div>
      <p className="small muted">{isCoastalCity(id) ? '🌊 바다에 닿은 도시 · 가장자리 바닷가 칸에 ⚓항만·🛳️군 조선소를 지을 수 있어요' : '🏞️ 내륙 도시 · ⚓항만·🛳️조선소는 못 지어요(🛫비행장은 돼요)'}</p>
      <p className="small">
        구역 {cc.districts.length}/{C.districtSlots(state, id)} ·{' '}
        {cc.districts.map((d) => `${districtById(d.id).icon}${d.doneMs > state.worldMs ? `(${timeLeft(d.doneMs - state.worldMs)})` : ''}`).join(' ') || '아직 없음'}
      </p>
      {cc.districts
        .filter((d) => d.doneMs > state.worldMs)
        .map((d) => (
          <div key={d.tile} className="list-row small">
            <span>
              🏗️ {districtById(d.id).icon} {districtById(d.id).name} 공사 중
            </span>
            <BoostBar state={state} apply={actions.apply} target={{ kind: 'district', city: id, tile: d.tile }} compact />
          </div>
        ))}
      {(cc.mines ?? [])
        .filter((m) => m.doneMs > state.worldMs)
        .map((m) => (
          <div key={m.tile} className="list-row small">
            <span>⛏️ {m.res} 채굴장 공사 중</span>
            <BoostBar state={state} apply={actions.apply} target={{ kind: 'mine', city: id, tile: m.tile }} compact />
          </div>
        ))}
      {selTile && selMark ? (
        (() => {
          const lv = markLv(selMark.id);
          const st = cc.marks?.[selMark.id];
          const upWhy = C.canUpgradeMark(state, id, selMark.id);
          const cost = C.markCostOf(id, selMark.id, lv);
          const max = C.markMax(id, selMark.id);
          const home = selMark.home;
          return (
            <div className="civ-build">
              <div className="line-item">
                <span className="li-ico">{MARK_KIND[selMark.kind].icon}</span>
                <span className="li-main">
                  <b>
                    {home && '🏡 '}
                    {selMark.name} · {lv === 0 ? '빈 터' : `${lv}단계`}/{max}
                  </b>
                  <small>
                    {home ? '고향 전용 시설' : `${MARK_KIND[selMark.kind].name} 시설`}
                    {selMark.note ? ` · ${selMark.note.replace('고향 전용 · ', '')}` : ''}
                    <br />
                    {lv === 0 && home
                      ? `지으면(1단계마다): ${effText(home.eff)}`
                      : `지금 효과: ${effText(scaled(Object.fromEntries(Object.entries(MARK_KIND[selMark.kind].per).map(([k, v]) => [k, (v as number) * lv * MARK_SCALE + ((home?.eff as Record<string, number> | undefined)?.[k] ?? 0) * lv])) as CityEff, share))}`}
                    <br />
                    {st && st.doneMs > state.worldMs
                      ? `${st.lv}단계로 발전 공사 중 · ${timeLeft(st.doneMs - state.worldMs)}`
                      : lv < max
                        ? `${lv === 0 ? '짓기' : '다음 단계'}: 💰${fmt(cost.cost)} 🔩${cost.res.강철} · ${cost.hours}시간`
                        : '가장 높은 단계'}
                  </small>
                </span>
                {lv < max && !(st && st.doneMs > state.worldMs) && (
                  <button
                    className="primary"
                    disabled={!!upWhy}
                    title={upWhy ?? ''}
                    onClick={() => {
                      actions.apply((s) => C.upgradeMark(s, id, selMark.id));
                      setMsg(`🏗️ ${selMark.name} ${lv === 0 ? '짓기' : `${lv + 1}단계 발전`} 공사 시작! ${cost.hours}시간 뒤 완공`);
                    }}
                  >
                    {lv === 0 ? '🏗️ 짓기' : '⬆️ 발전'}
                  </button>
                )}
              </div>
            </div>
          );
        })()
      ) : selTile ? (
        <div className="civ-build">
          <small className="stat-group-name">
            고른 칸: {selTile.center ? '도심' : C.terrainOf(id, selTile.q, selTile.r)}
            {C.terrainOf(id, selTile.q, selTile.r) === '바닷가' ? ` · 옆 바다 ${C.seaAround(id, selTile.q, selTile.r)}칸` : ''}
            {map.gu && selTile.gu !== undefined ? ` · ${map.gu[selTile.gu]}` : ''}
          </small>
          {dep && !distAt(sel!) && (
            <div className="line-item">
              <span className="li-ico">{mineAt(sel!) ? '⛏️' : <ResIcon res={dep} />}</span>
              <span className="li-main">
                <b>
                  <ResIcon res={dep} inline /> {dep} 매장지
                </b>
                <small>
                  {mineAt(sel!)
                    ? mineAt(sel!)!.doneMs > state.worldMs
                      ? `채굴장 공사 중 · ${timeLeft(mineAt(sel!)!.doneMs - state.worldMs)}`
                      : `채굴장 가동 중 · ${dep} 시간당 +${C.MINE_PER_HOUR}`
                    : `채굴장을 지으면 ${dep} 시간당 +${C.MINE_PER_HOUR} · 💰${fmt(C.MINE_COST)} 🔩2 · ${C.MINE_HOURS}시간 (구역 칸 수와 따로)`}
                </small>
              </span>
              {!mineAt(sel!) && (
                <button
                  className="primary"
                  disabled={!!C.canMine(state, id, sel!)}
                  title={C.canMine(state, id, sel!) ?? ''}
                  onClick={() => {
                    actions.apply((s) => C.buildMine(s, id, sel!));
                    setMsg(`⛏️ ${dep} 채굴장 공사 시작! ${C.MINE_HOURS}시간 뒤 완공`);
                  }}
                >
                  ⛏️ 짓기
                </button>
              )}
            </div>
          )}
          {mineAt(sel!) ? null : distAt(sel!) ? (
            <p className="small">
              {districtById(distAt(sel!)!.id).icon} {districtById(distAt(sel!)!.id).name} · {districtById(distAt(sel!)!.id).text} · 이웃 보너스 {C.adjCount(id, sel!, distAt(sel!)!.id, cc)}개
            </p>
          ) : (
            <>
              <small className="stat-group-name">기본 구역</small>
              <div className="tiles c5">{baseDefs.map(buildTile)}</div>
              <small className="stat-group-name">🧪 군사 연구시설 (도시마다 1개씩)</small>
              <div className="tiles c4">{milDefs.map(buildTile)}</div>
            </>
          )}
        </div>
      ) : (
        <p className="small muted">
          칸을 누르면 지을 수 있는 구역이 나와요. {marks.length ? '🔵 실제 시설을 누르면 발전 단계를 올릴 수 있어요. ' : ''}매장지
          {C.deposits(id).length ? ` ${C.deposits(id).map((x) => RES_ICON[x.res]).join('')}` : ''}에는 채굴장을 지을 수 있어요.
        </p>
      )}
      {msg && <p className="small result">{msg}</p>}
    </Modal>
  );
}

/* ═════════════ 외교: 호감 · 협정 ═════════════ */

export function FavorBox({ state, id }: { state: ScreenProps['state']; id: string }) {
  if (id === state.player.countryId) return null;
  const v = C.favorOf(state, id);
  const f = C.favorName(v);
  const rows = C.favorReasons(state, id);
  return (
    <div className="civ-favor">
      <div className="row">
        <span>
          {f.icon} 나에 대한 호감 <b className={v >= 0 ? 'good' : 'warn'}>{signed(v)}</b> <small className="muted">{f.name}</small>
        </span>
        <span className="small">
          {C.activeAgreements(state, id)
            .map((a) => agreeById(a.kind).icon)
            .join(' ')}
        </span>
      </div>
      <div className="civ-reasons">
        {rows.map(([k, x], i) => (
          <span key={i} className={`mini-chip ${x >= 0 ? 'pos' : 'neg'}`}>
            {k} {signed(Math.round(x))}
          </span>
        ))}
      </div>
    </div>
  );
}

export function AgreePanel(props: ScreenProps) {
  const { state } = props;
  const me = state.player.countryId;
  const [pick, setPick] = useState<string | null>(null);
  const others = COUNTRIES.filter((c) => c.id !== me && isAlive(state.world, c.id)).sort((a, b) => C.favorOf(state, b.id) - C.favorOf(state, a.id));
  const c = C.civOf(state);
  return (
    <>
      <section className="card">
        <div className="row">
          <b>🤝 호감과 협정</b>
          <small className="muted">맺은 협정 {C.activeAgreements(state).length}</small>
          <Help title="호감·협정·불만 장부">
            <p>
              나라마다 나를 얼마나 좋아하는지(−100~+100)와 그 <b>이유</b>가 보여요. 대화에서 고른 태도, 같은 체제·신앙, 협정, 회의 투표가 쌓여요.
            </p>
            <p>
              <b>협정 5가지</b>(실제 1~3일): {AGREES.map((a) => `${a.icon}${a.name}`).join(' · ')}. 상대 호감이 충분해야 받아 줘요. 사회 제도 연구로 열려요.
            </p>
            <p>
              <b>😠 불만 장부</b>: 기습 침공(호감이 좋았거나 협정 중이던 나라에 선전포고), 협정 깨기, 성지 휴전 어기기는 오래 남고 이웃 나라도 함께 미워해요. 실제 하루에 10%씩 천천히 줄어요.
            </p>
          </Help>
        </div>
      </section>
      <div className="civ-nations">
        {others.map((x) => {
          const v = C.favorOf(state, x.id);
          const g = c.grievance[x.id] ?? 0;
          return (
            <button key={x.id} className="civ-nation" onClick={() => setPick(x.id)}>
              <span className="civ-nation-flag">{FLAG[x.id]}</span>
              <span className="civ-nation-main">
                <b>{x.name}</b>
                <small>
                  <RelTag state={state} id={x.id} /> {govById(c.aiGov[x.id]).icon} {C.activeAgreements(state, x.id).map((a) => agreeById(a.kind).icon).join('')}
                  {g >= 1 ? ` 😠${Math.round(g)}` : ''}
                </small>
              </span>
              <span className={`civ-favor-num ${v >= 0 ? 'good' : 'warn'}`}>
                {C.favorName(v).icon}
                <b>{signed(v)}</b>
              </span>
            </button>
          );
        })}
      </div>
      {pick && <AgreeModal {...props} id={pick} onClose={() => setPick(null)} />}
    </>
  );
}

function AgreeModal({ state, actions, id, onClose }: ScreenProps & { id: string; onClose: () => void }) {
  const [msg, setMsg] = useState('');
  const act = C.activeAgreements(state, id);
  return (
    <Modal title={countryById(id).name} icon={FLAG[id]} onClose={onClose}>
      <FavorBox state={state} id={id} />
      <small className="stat-group-name">📜 협정</small>
      {AGREES.map((a) => {
        const on = act.find((x) => x.kind === a.id);
        const why = C.canAgree(state, id, a.id);
        return (
          <div key={a.id} className={`list-row ${why && !on ? 'is-locked' : ''}`}>
            <span>
              {a.icon} <b>{a.name}</b> <small className="muted">· {a.hours}시간 · 호감 {a.favorNeed} 이상</small>
              <br />
              <small className="muted">{a.text}</small>
            </span>
            {on ? (
              <span className="tag">남은 {timeLeft(on.untilMs - state.worldMs)}</span>
            ) : (
              <button
                className="primary"
                disabled={!!why}
                title={why ?? ''}
                onClick={() => {
                  actions.apply((s) => C.makeAgreement(s, id, a.id));
                  setMsg(`${a.icon} ${a.name} 협정을 맺었어요!`);
                }}
              >
                {why ? why.replace('나라 예산 ', '💰') : `맺기 ${fmt(a.cost)}`}
              </button>
            )}
          </div>
        );
      })}
      {msg && <p className="small result">{msg}</p>}
    </Modal>
  );
}

/* ═════════════ 분쟁 지역 영향력 ═════════════ */

export function IslandPanel(props: ScreenProps) {
  const { state } = props;
  const me = state.player.countryId;
  const [pick, setPick] = useState<string | null>(null);
  const c = C.civOf(state);
  const ready = state.worldMs >= c.envoyReadyMs;
  return (
    <>
      <section className="card">
        <div className="row">
          <span>
            🏝️ 1등인 섬 <b>{C.myIslands(state).length}</b>/12
          </span>
          <small className={ready ? 'good' : 'muted'}>🕊️ 사절 {ready ? '준비됨' : timeLeft(c.envoyReadyMs - state.worldMs)}</small>
          <Help title="분쟁 지역 영향력">
            <p>여러 나라가 실제로 다투는 섬 12곳마다 주민 대표가 있어요. 그 섬을 실제로 다투는 나라는 영향력이 20% 더 쌓이고, 남이 1등을 하면 그 나라와 긴장이 조금씩 올라요.</p>
            <p> 사절을 보내거나(예산 {fmt(ENVOY_COST)}) 섬 부탁(자원 보내기)을 들어주면 영향력이 쌓여요.</p>
            <p>
              영향력 1등이면서 {ISLAND_LEAD_MIN} 이상이면 그 지역 자원을 시간당 {ISLAND_RES_PER_HOUR}개 받고, 국제 회의 표가 1장 늘어요. 다른 나라도 가까운 섬에 영향력을 쌓아요.
            </p>
            <p>국민 의회 체제·사절단 연구·상주 사절 카드로 영향력이 더 많이 쌓여요.</p>
          </Help>
        </div>
      </section>
      <div className="tiles c3 isle-tiles">
        {PIONEER_ISLANDS.map((p) => {
          const lead = C.islandLeader(state, p.id);
          const mineV = c.influence[p.id]?.[me] ?? 0;
          return (
            <Tile
              key={p.id}
              icon={<IslandIcon id={p.id} badge={lead.id ? FLAG[lead.id] : p.res === '항구' ? '⚓' : <ResIcon res={p.res} inline />} />}
              label={`${p.name}${claimsIsland(p.id, me) ? ' ★' : ''}`}
              sub={`나 ${Math.round(mineV)} · ${lead.id ? (lead.id === me ? '1등!' : countryById(lead.id).name.slice(0, 4)) : '주인 없음'}`}
              tone={lead.id === me ? 'gold' : undefined}
              onClick={() => setPick(p.id)}
            />
          );
        })}
      </div>
      {pick && <IslandModal {...props} id={pick} onClose={() => setPick(null)} />}
    </>
  );
}

function IslandModal({ state, actions, id, onClose }: ScreenProps & { id: string; onClose: () => void }) {
  const p = PIONEER_ISLANDS.find((x) => x.id === id)!;
  const me = state.player.countryId;
  const real = REAL_ISLANDS[id];
  const inf = C.civOf(state).influence[id] ?? {};
  const top = Object.entries(inf)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  const max = Math.max(ISLAND_LEAD_MIN, ...top.map(([, v]) => v));
  const req = C.islandRequest(state, id);
  const ev = C.canEnvoy(state, id);
  const fu = C.canFulfill(state, id);
  const [msg, setMsg] = useState('');
  return (
    <Modal title={p.name} icon={islandArtUrl(p.id) ? undefined : '🏝️'} onClose={onClose}>
      <div className={islandArtUrl(p.id) ? 'unit-hero' : ''}>
        {islandArtUrl(p.id) && (
          <div className="unit-photo island-photo">
            <IslandIcon id={p.id} />
          </div>
        )}
        {real && (
          <div className="small isle-real">
            {real.alt && <div className="muted">다른 이름: {real.alt}</div>}
            <div>
              ⚔️ 다투는 나라: {real.sides.map((x) => `${FLAG[x]} ${countryById(x).name}`).join(' · ')}
              {real.others.length > 0 && <span className="muted"> · {real.others.join(' · ')}</span>}
            </div>
            <div className="muted">📜 {real.story}</div>
            {claimsIsland(id, me) && <div className="good">★ 우리가 다투는 분쟁 지역: 영향력 +{Math.round(CLAIM_INFLUENCE * 100)}%</div>}
          </div>
        )}
        <p className="small">
          나는 자원:{' '}
          {p.res === '항구' ? (
            '⚓ 큰 항구(나라 예산 +3%)'
          ) : (
            <>
              <ResIcon res={p.res} inline /> {p.res} 시간당 {ISLAND_RES_PER_HOUR}개
            </>
          )}
          <br />1등이 되려면 영향력 {ISLAND_LEAD_MIN} 이상
        </p>
      </div>
      <small className="stat-group-name">📊 영향력</small>
      {top.length === 0 && <p className="small muted">아직 아무도 사절을 보내지 않았어요.</p>}
      {top.map(([who, v]) => (
        <div key={who} className="civ-inf">
          <span>
            {FLAG[who]} {who === me ? <b>우리</b> : countryById(who).name}
          </span>
          <Meter value={v} max={max} tone={who === me ? 'gold' : 'blue'} />
          <b>{Math.round(v)}</b>
        </div>
      ))}
      <div className="grid2" style={{ marginTop: 8 }}>
        <button
          className="primary"
          disabled={!!ev}
          onClick={() => {
            actions.apply((s) => C.sendEnvoy(s, id));
            setMsg('🕊️ 사절을 보냈어요!');
          }}
        >
          🕊️ 사절 보내기
          <br />
          <small>{ev ?? `${fmt(ENVOY_COST)} · 영향력 +${Math.round(10 * C.influenceMult(state, id))}`}</small>
        </button>
        <button
          className="gold"
          disabled={!!fu}
          onClick={() => {
            actions.apply((s) => C.fulfillRequest(s, id));
            setMsg('📦 부탁을 들어줬어요!');
          }}
        >
          📦 섬 부탁
          <br />
          <small>{req.done ? '들어줬어요(12시간마다 바뀜)' : `${RES_ICON[req.res]} ${req.res} ${req.qty}개 보내기${fu ? ` · ${fu}` : ''}`}</small>
        </button>
      </div>
      {msg && <p className="small result">{msg}</p>}
    </Modal>
  );
}

/* ═════════════ 국제 회의 ═════════════ */

export function CouncilPanel(props: ScreenProps) {
  const { state, actions } = props;
  const c = C.civOf(state);
  const o = c.council.open;
  const me = state.player.countryId;
  const active = c.council.active.filter((a) => a.untilMs > state.worldMs);
  return (
    <>
      <section className="card civ-council">
        <div className="row">
          <b>🏛️ 고대 성지 · 국제 회의</b>
          <Help title="국제 회의">
            <p>고대 성지에서 실제 하루마다 회의가 열려요. 안건에 나라들이 표를 던지고, 통과하면 하루 동안 효과가 있어요.</p>
            <ul>
              {AGENDAS.map((a) => (
                <li key={a.id}>
                  {a.icon} <b>{a.name}</b>: {a.text}
                </li>
              ))}
            </ul>
            <p>표 = 1 + 1등인 분쟁 지역 수 + 체제·연구·카드. 나를 좋아하는 나라는 내 표를 따라오기도 해요. 6시간 안에 투표하지 않으면 부관이 체제 성향대로 골라요.</p>
            <p>설정에서 회의를 끌 수 있어요.</p>
          </Help>
        </div>
        {!c.council.on ? (
          <p className="small muted">회의가 꺼져 있어요. 설정에서 켤 수 있어요.</p>
        ) : o ? (
          <div className="civ-agenda">
            <span className="civ-agenda-ico">{agendaById(o.agenda).icon}</span>
            <div>
              <b>
                {agendaById(o.agenda).name}
                {o.target ? ` → ${countryById(o.target).name}` : ''}
              </b>
              <small className="muted">{agendaById(o.agenda).text}</small>
              <small>
                ⏳ 투표 마감 {timeLeft(o.untilMs - state.worldMs)} · 내 표 {C.councilVotes(state, me)}장
              </small>
            </div>
          </div>
        ) : (
          <p className="small muted">다음 회의까지 {timeLeft(c.council.nextMs - state.worldMs)}</p>
        )}
        {o && c.council.on && (
          <div className="grid2">
            <button className={`primary ${o.vote === true ? 'on' : ''}`} disabled={o.vote !== null} onClick={() => actions.apply((s) => C.voteCouncil(s, true))}>
              👍 찬성
            </button>
            <button className={`danger ${o.vote === false ? 'on' : ''}`} style={{ marginTop: 0 }} disabled={o.vote !== null} onClick={() => actions.apply((s) => C.voteCouncil(s, false))}>
              👎 반대
            </button>
          </div>
        )}
        {o?.vote !== null && o && <p className="small good">투표했어요: {o.vote ? '찬성' : '반대'}. 마감 때 결과가 나와요.</p>}
      </section>
      {c.council.on && (
        <section className="card">
          <small className="stat-group-name">🗳️ 나라별 표</small>
          <div className="civ-govs">
            {COUNTRIES.filter((x) => isAlive(state.world, x.id)).map((x) => (
              <span key={x.id} className={`mini-chip ${x.id === me ? 'same' : ''}`}>
                {FLAG[x.id]} {C.councilVotes(state, x.id)}
              </span>
            ))}
          </div>
        </section>
      )}
      {(active.length > 0 || c.council.last) && (
        <section className="card">
          {active.map((a, i) => (
            <p key={i} className="small">
              ✅ {agendaById(a.agenda).icon} {agendaById(a.agenda).name}
              {a.target ? `(${countryById(a.target).name})` : ''} · 남은 {timeLeft(a.untilMs - state.worldMs)}
            </p>
          ))}
          {c.council.last && <p className="small muted">지난 회의: {c.council.last}</p>}
        </section>
      )}
    </>
  );
}

