import { Safe } from './Safe';
// 🎭 문화 탭(11-23): 시설 · 걸작 · 스타 · 관광 · 행사 · 세계(스타·관광은 11-25) (승리 조건은 11-24 개인 → 승리로 옮김)
import { BoostBar, BoostMini, BoostStart } from './BoostBar';
import { BOOST_MS, startAndFinish } from '../game/boost';
import { useState } from 'react';
import { Card, fmt } from './common';
import { FLAG } from './flag';
import { Help, Meter, Modal, Tabs, Tile, useTab, type TabDef } from './kit';
import { iconArt } from './iconArt';
import { timeLeft } from './officerScreens';
import type { ScreenProps } from './screens';
import { countryById } from '../data/world';
import { RANKS } from '../data/ranks';
import {
  BUILD_TEAMS, CULTURE_EVENTS, CULTURE_SPECIAL, CULTURE_WIN_DAYS, CULTURE_WIN_SHARE, CULTURE_WIN_TOP, LEVEL_POWER, PACT_COST, PACT_MAX, PACT_MULT,
  SPECIAL_BONUS, VENUES, VENUE_MAX, WORK_KINDS, venueById, type CultureEventId, type VenueId, type WorkKind,
  COURSES, CREATE_HOURS, GRADES, STAR_KINDS, STAR_MAX, THEME_MIN, THEME_MULT, VISITORS_PER_TOUR, starKindById, workKindById, type CourseId,
} from '../data/culture';
import {
  aiStars, addWork, canAddWork, canHost, canPact, canUpgrade, cultureLines, cultureOf, culturePerHour, cultureProgress, cultureWinLeft,
  endPact, hostEvent, signPact, tourismPerHour, upgradeCost, upgradeVenue, workSlots, TOUR_INCOME,
  baseTourism, canCreate, canOpenCourse, canRecruit, recruitMoney, starVenueOk, talentShort, closeCourse, courseBonus, courseSlots, coursesOf, gradeOdds, nextStarCost, nextStarName, nextWorkCost,
  openCourse, recruitStar, starLevel, starsOf, startCreate, talentPerHour, themeDone, workInfo, worksPower, type CultureStar,
} from '../game/culture';
import { RES_ICON, type Res } from '../data/economy';
import type { StarKind } from '../data/culture';

export type CultureTab = 'venue' | 'works' | 'stars' | 'tour' | 'event' | 'world';

/** 시설 그림(src/assets/icons/icon-cul-<시설>-<단계>.webp), 없으면 이모지 */
export function VenueArt({ id, level, big }: { id: VenueId; level: number; big?: boolean }) {
  const url = iconArt(`icon-cul-${id}-${Math.max(1, level)}`);
  const d = venueById(id);
  if (url) return <img className={`art-ico cul-art ${big ? 'big' : ''} ${level === 0 ? 'dim' : ''}`} src={url} alt={d.name} draggable={false} />;
  return <span className={`cul-emoji ${big ? 'big' : ''} ${level === 0 ? 'dim' : ''}`}>{d.icon}</span>;
}
function EventArt({ id, icon, big }: { id: CultureEventId; icon: string; big?: boolean }) {
  const url = iconArt(`icon-cul-ev-${id}`);
  return url ? <img className={`art-ico cul-art ${big ? 'big' : ''}`} src={url} alt="" draggable={false} /> : <span className={`cul-emoji ${big ? 'big' : ''}`}>{icon}</span>;
}
/** 그림 칸(없으면 이모지): 걸작 icon-cul-work-<id>, 스타 icon-cul-star-<종류>, 관광 코스 icon-cul-course-<id> */
function Art({ k, icon, big, dim }: { k: string; icon: string; big?: boolean; dim?: boolean }) {
  const url = k ? iconArt(k) : null;
  if (url) return <img className={`art-ico cul-art ${big ? 'big' : ''} ${dim ? 'dim' : ''}`} src={url} alt="" draggable={false} />;
  return <span className={`cul-emoji ${big ? 'big' : ''} ${dim ? 'dim' : ''}`}>{icon}</span>;
}
const needText = (needs: Partial<Record<VenueId, number>>) =>
  Object.entries(needs)
    .map(([v, n]) => `${venueById(v as VenueId).name} ${n}`)
    .join(' · ');
const lv = (n: number) => '★'.repeat(n) + '☆'.repeat(VENUE_MAX - n);
const r1 = (n: number) => (Math.round(n * 10) / 10).toLocaleString('ko-KR');
const resText = (res: Partial<Record<Res, number>>) =>
  Object.entries(res)
    .map(([r, n]) => `${RES_ICON[r as Res]}${r} ${n}`)
    .join(' · ');

/** 작은 탭 목록(화면과 국정 나무가 함께 씀) */
export function cultureTabs(props: ScreenProps): TabDef<CultureTab>[] {
  const { state } = props;
  const c = cultureOf(state);
  const evOn = c.event && state.worldMs < c.event.endMs;
  return [
    { id: 'venue', label: '시설', icon: '🏛️', badge: c.builds.length || null },
    { id: 'works', label: '걸작', icon: '🏺', badge: WORK_KINDS.some((k) => !canAddWork(state, k.id)) ? '!' : null },
    { id: 'stars', label: '스타', icon: '🌟', badge: STAR_KINDS.some((k) => !canRecruit(state, k.id)) ? '!' : starsOf(c).filter((x) => x.job).length || null },
    { id: 'tour', label: '관광', icon: '✈️', badge: coursesOf(c).length || null },
    { id: 'event', label: '행사', icon: '🎉', badge: evOn ? '●' : null },
    { id: 'world', label: '세계', icon: '🌏' },
  ];
}

export function CultureScreen(props: ScreenProps) {
  const { state } = props;
  const c = cultureOf(state);
  const p = cultureProgress(state);
  const [raw, setTab] = useTab<CultureTab>('culture', 'venue');
  const tabs = cultureTabs(props);
  // 옛 '승리' 탭을 기억하고 있으면 첫 탭으로(승리는 개인 → 승리로 옮김)
  const tab: CultureTab = tabs.some((t) => t.id === raw) ? raw : 'venue';
  return (
    <>
      <div className="cul-bar">
        <span title="시간당 문화">🎨 {r1(culturePerHour(state))}/h</span>
        <span title="시간당 관광">✈️ {r1(tourismPerHour(state))}/h</span>
        <span title="문화 점수">💠 {fmt(c.points)}</span>
        <span title="문화 우세 나라">🌏 {p.have}/{p.need}</span>
        <Help title="문화는 어떻게 하나요?">
          <p>🎨 <b>문화</b>: 시설·걸작이 시간마다 만들어요. 쌓인 <b>문화 점수 💠</b>로 걸작을 들여요.</p>
          <p>✈️ <b>관광</b>: 우리 문화가 다른 나라로 퍼지는 힘. 나라마다 <b>영향력</b>이 쌓이고, 그 나라가 스스로 쌓은 문화보다 커지면 <b>문화 우세</b>가 돼요. 관광 1점마다 시간당 나라 예산 {TOUR_INCOME}의 관광 수입도 들어와요.</p>
          <p>⚔️ 전쟁 중인 나라엔 퍼지지 않고, 어느 나라와든 전쟁 중이면 관광이 20% 줄어요.</p>
          <p>🤝 문화 교류 협약·무역 계약·연합·호감 20 이상이면 그 나라에 더 잘 퍼져요.</p>
          {CULTURE_SPECIAL[state.player.countryId] && (
            <p>
              ⭐ 우리 나라 특기: <b>{CULTURE_SPECIAL[state.player.countryId].text}</b> — {venueById(CULTURE_SPECIAL[state.player.countryId].venue).name} 효과 +{SPECIAL_BONUS * 100}%
            </p>
          )}
        </Help>
      </div>
      <Tabs value={tab} onChange={setTab} tabs={tabs} />
      <Safe key={tab} where={`culture/${tab}`}>
      {tab === 'venue' && <VenuePanel {...props} />}
      {tab === 'works' && <WorksPanel {...props} go={() => setTab('stars')} />}
      {tab === 'stars' && <StarsPanel {...props} />}
      {tab === 'tour' && <TourPanel {...props} />}
      {tab === 'event' && <EventPanel {...props} />}
      {tab === 'world' && <WorldPanel {...props} />}
      {c.log.length > 0 && (
        <details className="fold">
          <summary>📜 문화 소식</summary>
          <div className="fold-body small">
            {c.log.slice(0, 8).map((l, i) => (
              <div key={i}>{l}</div>
            ))}
          </div>
        </details>
      )}
      </Safe>
    </>
  );
}

/* ── 시설 ── */
function VenuePanel({ state, actions }: ScreenProps) {
  const c = cultureOf(state);
  const [sel, setSel] = useState<VenueId | null>(null);
  const sp = CULTURE_SPECIAL[state.player.countryId];
  return (
    <>
      <Card title="문화 시설" icon="🏛️" right={<small className="muted">공사 팀 {c.builds.length}/{BUILD_TEAMS}</small>}>
        {c.builds.map((b) => (
          <div key={b.venue} className="list-row small">
            <span>
              🏗️ {venueById(b.venue).levels[b.to - 1]} ({b.to}단계)
            </span>
            <span className="muted">{timeLeft(b.endMs - state.worldMs)}</span>
            <BoostBar state={state} apply={actions.apply} target={{ kind: 'venue', venue: b.venue }} compact />
          </div>
        ))}
        <div className="tiles c2 cul-tiles">
          {VENUES.map((d) => {
            const n = c.venues[d.id];
            const building = c.builds.some((b) => b.venue === d.id);
            const why = canUpgrade(state, d.id);
            // 카드 안 가속(11-25): 공사 중 → ⏩/⚡ · 올릴 수 있으면 ⚡바로 짓기
            const canNow = !building && !why && n < VENUE_MAX;
            return (
              <div key={d.id} className={`bcard-cell ${building || canNow ? 'boost-cell' : ''}`}>
              <Tile
                icon={<VenueArt id={d.id} level={n} />}
                label={d.name}
                sub={<span className="cul-stars">{lv(n)}</span>}
                badge={building ? '🏗️' : sp?.venue === d.id ? '⭐' : !canUpgrade(state, d.id) ? '↑' : null}
                tone={n >= VENUE_MAX ? 'gold' : undefined}
                onClick={() => setSel(d.id)}
              >
                <small className="muted cul-lvname">{n ? d.levels[n - 1] : '아직 없음'}</small>
              </Tile>
              {building && <BoostMini state={state} apply={actions.apply} target={{ kind: 'venue', venue: d.id }} />}
              {canNow && (
                <BoostStart
                  state={state}
                  apply={actions.apply}
                  need={Math.ceil((upgradeCost(d.id, n + 1, state).hours * 3600e3) / BOOST_MS)}
                  label={n ? '올리기' : '짓기'}
                  run={(s) => startAndFinish(s, (x) => upgradeVenue(x, d.id), { kind: 'venue', venue: d.id })}
                />
              )}
              </div>
            );
          })}
        </div>
      </Card>
      {sel && <VenueModal state={state} actions={actions} id={sel} onClose={() => setSel(null)} />}
    </>
  );
}

function VenueModal({ state, actions, id, onClose }: Pick<ScreenProps, 'state' | 'actions'> & { id: VenueId; onClose: () => void }) {
  const c = cultureOf(state);
  const d = venueById(id);
  const n = c.venues[id];
  const to = n + 1;
  const why = canUpgrade(state, id);
  const cost = to <= VENUE_MAX ? upgradeCost(id, to, state) : null;
  const sp = CULTURE_SPECIAL[state.player.countryId]?.venue === id;
  return (
    <Modal
      title={`${d.name}${n ? ` · ${d.levels[n - 1]}` : ''}`}
      icon={d.icon}
      onClose={onClose}
      footer={
        cost && (
          <button className="wide primary" disabled={!!why} onClick={() => actions.apply((s) => upgradeVenue(s, id))}>
            🏗️ {n ? `${to}단계로 올리기` : '짓기'} · 💰{fmt(cost.money)} · ⏱{cost.hours}시간{Object.keys(cost.res).length ? ` · ${resText(cost.res)}` : ''}
            {why ? <small> ({why})</small> : null}
          </button>
        )
      }
    >
      <div className="cul-hero">
        <VenueArt id={id} level={Math.max(1, n)} big />
      </div>
      <p className="small">{d.text}</p>
      {sp && <p className="small result">⭐ 우리 나라 특기라 효과 +{SPECIAL_BONUS * 100}%</p>}
      <p className="small">
        지금: 🎨 문화 {r1(LEVEL_POWER[n] * d.cul)}/h · ✈️ 관광 {r1(LEVEL_POWER[n] * d.tour)}/h · 🙂 민심 +{r1(n * d.mood)}
      </p>
      <div className="cul-levels">
        {d.levels.map((name, i) => (
          <div key={name} className={`list-row small ${i < n ? '' : 'muted'}`}>
            <span>
              {i < n ? '✅' : i === n ? '▶️' : '⬜'} {i + 1}. {name}
            </span>
            <span>
              🎨{r1(LEVEL_POWER[i + 1] * d.cul)} ✈️{r1(LEVEL_POWER[i + 1] * d.tour)}
            </span>
          </div>
        ))}
      </div>
    </Modal>
  );
}

/* ── 걸작 ── */
function WorksPanel({ state, actions, go }: ScreenProps & { go: () => void }) {
  const c = cultureOf(state);
  const [sel, setSel] = useState<{ k: WorkKind; name: string } | null>(null);
  const wp = worksPower(c);
  const stars = starsOf(c);
  return (
    <>
      <Card
        title="걸작"
        icon="🏺"
        right={<small className="muted">다음 💠{fmt(nextWorkCost(state))}</small>}
        help={
          <>
            <p>
              <b>걸작은 스타가 만들어요.</b> 🌟스타 탭에서 고고학자(🏺유물)·예술가(🎻공연)·감독(📀히트작)을 데려온 뒤, 빈 칸의 ＋를 누르면 그 스타가 문화 점수 💠를 써서 몇 시간 동안 작품을 만들어요.
            </p>
            <p>
              다 만들면 등급이 정해져요: 보통(🎨+{GRADES.C.cul} ✈️+{GRADES.C.tour}) · 귀한(🎨+{GRADES.B.cul} ✈️+{GRADES.B.tour}) · 전설(🎨+{GRADES.A.cul} ✈️+{GRADES.A.tour} · 민심 +{GRADES.A.mood}). 스타가 작품을 많이 만들수록 좋은 등급이 잘 나와요.
            </p>
            <p>
              칸 수 = 박물관·공연장·방송영화 단계. {THEME_MIN}칸 이상을 모두 채우면 <b>테마 전시 완성</b>: 그 종류 걸작 효과 ×{THEME_MULT}.
            </p>
          </>
        }
      >
        <div className="cul-sum small">
          <span>걸작 효과</span>
          <b>🎨 +{r1(wp.cul)}/h</b>
          <b>✈️ +{r1(wp.tour)}/h</b>
          {wp.mood > 0 && <b>🙂 +{wp.mood}</b>}
        </div>
        {WORK_KINDS.map((k) => {
          const slots = workSlots(state, k.id);
          const have = c.works[k.id];
          const jobs = stars.filter((x) => x.job?.kind === k.id);
          const maker = STAR_KINDS.find((d) => d.work === k.id)!;
          const why = canAddWork(state, k.id);
          return (
            <div key={k.id} className="cul-works">
              <div className="list-row small">
                <b>
                  {k.icon} {k.name} <span className="muted">· {venueById(k.venue).name} {have.length}/{slots}칸</span>
                </b>
                {themeDone(c, k.id) ? <span className="cul-theme">✨ 테마 전시 ×{THEME_MULT}</span> : <small className="muted">{maker.icon} {maker.name}가 만들어요</small>}
              </div>
              <div className="tiles c4 cul-work-tiles">
                {/* 빈 칸·잠긴 칸은 다음 한 칸까지만 보여 줌(화면이 너무 길어지지 않게) */}
                {Array.from({ length: Math.min(VENUE_MAX, Math.max(slots, have.length) + 1) }, (_, i) => {
                  if (i < have.length) {
                    const w = workInfo(have[i], k.id);
                    const g = GRADES[w.grade];
                    return <Tile key={i} icon={<Art k={w.id ? `icon-cul-work-${w.id}` : ''} icon={k.icon} />} label={w.name} sub={<span className={`cul-grade g-${w.grade}`}>{g.name}</span>} tone={g.tone} onClick={() => setSel({ k: k.id, name: w.name })} />;
                  }
                  const j = jobs[i - have.length];
                  if (j) return <Tile key={i} icon={<span className="cul-emoji">⏳</span>} label="만드는 중" sub={`${j.name} · ${timeLeft(j.job!.endMs - state.worldMs)}`} />;
                  if (i < slots)
                    return (
                      <Tile
                        key={i}
                        icon={<span className="cul-emoji">＋</span>}
                        label={why ? '빈 칸' : '만들기'}
                        sub={why ?? `💠${fmt(nextWorkCost(state))} · ${CREATE_HOURS[k.id]}시간`}
                        tone={why ? undefined : 'green'}
                        onClick={() => (why ? go() : actions.apply((s) => addWork(s, k.id)))}
                      />
                    );
                  return <Tile key={i} icon={<span className="cul-emoji dim">🔒</span>} label={`${i + 1}칸째`} sub={`${venueById(k.venue).name} ${i + 1}단계`} />;
                })}
              </div>
            </div>
          );
        })}
      </Card>
      {sel && <WorkModal state={state} k={sel.k} name={sel.name} onClose={() => setSel(null)} />}
    </>
  );
}

function WorkModal({ state, k, name, onClose }: Pick<ScreenProps, 'state'> & { k: WorkKind; name: string; onClose: () => void }) {
  const c = cultureOf(state);
  const w = workInfo(name, k);
  const g = GRADES[w.grade];
  const m = themeDone(c, k) ? THEME_MULT : 1;
  return (
    <Modal title={w.name} icon={workKindById(k).icon} onClose={onClose}>
      <div className="cul-hero">
        <Art k={w.id ? `icon-cul-work-${w.id}` : ''} icon={workKindById(k).icon} big />
      </div>
      <p className="small">
        <span className={`cul-grade g-${w.grade}`}>{g.name} 걸작</span> · {workKindById(k).name} · {venueById(workKindById(k).venue).name}에 있어요
      </p>
      {w.text && <p className="small">{w.text}</p>}
      <p className="small result">
        시간당 🎨 문화 +{r1(g.cul * m)} · ✈️ 관광 +{r1(g.tour * m)}
        {g.mood ? ` · 🙂 민심 +${g.mood}` : ''}
        {m > 1 ? ` (테마 전시 ×${THEME_MULT})` : ''}
      </p>
    </Modal>
  );
}

/* ── 스타(문화 인물, 11-25) ── */
function StarsPanel({ state, actions }: ScreenProps) {
  const c = cultureOf(state);
  const stars = starsOf(c);
  const [sel, setSel] = useState<number | null>(null);
  const [rec, setRec] = useState<StarKind | null>(null);
  const cur = stars.find((x) => x.id === sel);
  return (
    <>
      <Card
        title="문화 스타"
        icon="🌟"
        right={<small className="muted">{stars.length}명</small>}
        help={
          <p>
            <b>첫 스타는 그 분야 시설만 있으면 바로</b> 데려올 수 있어요. 두 번째부터는 시설이 시간마다 모으는 <b>인재 점수</b>가 필요하고, 모자라면 나라 예산으로 채워서 바로 데려올 수도 있어요(분야마다 {STAR_MAX}명). 고고학자·예술가·감독은 걸작을 만들고, 스포츠 스타·건축가는 데리고만 있어도 효과가 있어요.
          </p>
        }
      >
        <div className="cul-talent">
          {STAR_KINDS.map((k) => {
            const have = stars.filter((x) => x.kind === k.id).length;
            const need = nextStarCost(state, k.id);
            const t = c.talent?.[k.id] ?? 0;
            const why = canRecruit(state, k.id);
            const rate = talentPerHour(state, k.id);
            return (
              <div key={k.id} className="cul-talent-row">
                <span className="cul-talent-ico">
                  <Art k={`icon-cul-star-${k.id}`} icon={k.icon} />
                </span>
                <span className="cul-talent-mid">
                  <b>
                    {k.name} <small className="muted">{have}/{STAR_MAX}명</small>
                  </b>
                  <small className="muted">{k.perk}</small>
                  {have < STAR_MAX && (
                    <>
                      <Meter value={t} max={need} tone="gold" />
                      <small className="muted">
                        다음 「{nextStarName(state, k.id)}」 · 인재 {Math.floor(Math.min(t, need))}/{need} · {rate > 0 ? `+${r1(rate)}/h` : `${k.from.map((v) => venueById(v).name).join('·')}을 지어요`}
                      </small>
                    </>
                  )}
                </span>
                {have < STAR_MAX && (
                  <button className={why ? '' : 'primary'} onClick={() => setRec(k.id)}>
                    데려오기
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </Card>
      {stars.length > 0 && (
        <Card title="우리 스타" icon="⭐">
          <div className="tiles c2 cul-star-tiles">
            {stars.map((x) => {
              const d = starKindById(x.kind);
              const why = d.work ? canCreate(state, x.id) : null;
              return (
                <Tile
                  key={x.id}
                  icon={<Art k={`icon-cul-star-${x.kind}`} icon={d.icon} />}
                  label={x.name}
                  sub={`${d.name} · ${'★'.repeat(starLevel(x))}`}
                  tone={x.job ? 'blue' : !why && d.work ? 'green' : undefined}
                  onClick={() => setSel(x.id)}
                >
                  <small className="muted cul-lvname">{x.job ? `⏳ ${workKindById(x.job.kind).name} 만드는 중 · ${timeLeft(x.job.endMs - state.worldMs)}` : d.work ? (why ?? `💠${fmt(nextWorkCost(state))}로 걸작을 만들 수 있어요`) : '효과 주는 중'}</small>
                </Tile>
              );
            })}
          </div>
        </Card>
      )}
      {cur && <StarModal state={state} actions={actions} x={cur} onClose={() => setSel(null)} />}
      {rec && <RecruitModal state={state} actions={actions} k={rec} onClose={() => setRec(null)} onDone={(id) => (setRec(null), setSel(id))} />}
    </>
  );
}

/** 데려오기 창: 왜 못 데려오는지·언제 되는지·돈으로 바로 데려오기 */
function RecruitModal({ state, actions, k, onClose, onDone }: Pick<ScreenProps, 'state' | 'actions'> & { k: StarKind; onClose: () => void; onDone: (id: number) => void }) {
  const d = starKindById(k);
  const c = cultureOf(state);
  const need = nextStarCost(state, k);
  const t = c.talent?.[k] ?? 0;
  const short = talentShort(state, k);
  const rate = talentPerHour(state, k);
  const free = canRecruit(state, k);
  const paid = canRecruit(state, k, true);
  const money = recruitMoney(state, k);
  const go = (payMoney: boolean) => {
    const id = c.starNext ?? 1;
    actions.apply((s) => recruitStar(s, k, payMoney));
    onDone(id);
  };
  return (
    <Modal
      title={`${d.name} 데려오기`}
      icon={d.icon}
      onClose={onClose}
      footer={
        <>
          <button className="wide primary" disabled={!!free} onClick={() => go(false)}>
            {d.icon} 「{nextStarName(state, k)}」 데려오기{need ? ` · 인재 ${need}` : ' · 무료'}
            {free ? <small> ({free})</small> : null}
          </button>
          {short > 0 && starVenueOk(state, k) && (
            <button className="wide" disabled={!!paid} onClick={() => go(true)}>
              💰 나라 예산 {fmt(money)}로 바로 데려오기{paid ? <small> ({paid})</small> : null}
            </button>
          )}
        </>
      }
    >
      <div className="cul-hero">
        <Art k={`icon-cul-star-${k}`} icon={d.icon} big />
      </div>
      <p className="small result">{d.perk}</p>
      <ol className="small cul-how">
        <li>
          {d.from.map((v) => venueById(v).name).join(' · ')} 시설이 있어야 해요 {starVenueOk(state, k) ? '✅' : '⬜ (시설 탭에서 지어요)'}
        </li>
        <li>
          {need === 0 ? '첫 스타는 인재 점수 없이 바로 데려와요 ✅' : `인재 점수 ${Math.floor(Math.min(t, need))}/${need} ${short ? `— ${short}점 모자람${rate > 0 ? ` (약 ${Math.ceil(short / rate)}시간 뒤)` : ''}` : '✅'}`}
        </li>
        <li>데려오면 「우리 스타」에 카드가 생겨요. {d.work ? `카드를 눌러 「걸작 만들기」를 누르면 ${workKindById(d.work).name} 걸작을 만들어요.` : '데리고만 있어도 효과가 바로 붙어요.'}</li>
      </ol>
    </Modal>
  );
}

function StarModal({ state, actions, x, onClose }: Pick<ScreenProps, 'state' | 'actions'> & { x: CultureStar; onClose: () => void }) {
  const d = starKindById(x.kind);
  const why = d.work ? canCreate(state, x.id) : null;
  const odds = gradeOdds(state, x);
  return (
    <Modal
      title={x.name}
      icon={d.icon}
      onClose={onClose}
      footer={
        d.work && (
          <button className="wide primary" disabled={!!why} onClick={() => actions.apply((s) => startCreate(s, x.id))}>
            {workKindById(d.work).icon} 걸작 만들기 · 💠{fmt(nextWorkCost(state))} · ⏱{CREATE_HOURS[d.work]}시간{why ? <small> ({why})</small> : null}
          </button>
        )
      }
    >
      <div className="cul-hero">
        <Art k={`icon-cul-star-${x.kind}`} icon={d.icon} big />
      </div>
      <p className="small">
        {d.name} · {'★'.repeat(starLevel(x))} · 만든 걸작 {x.made}개
      </p>
      <p className="small result">{d.perk}</p>
      {d.work && (
        <p className="small muted">
          나올 등급: 전설 {odds.A}% · 귀한 {odds.B}% · 보통 {odds.C}%{x.kind === 'arch' ? ' (문화유산 단계가 높을수록 좋아요)' : ''}
        </p>
      )}
      {x.job && <p className="small">⏳ 만드는 중 · {timeLeft(x.job.endMs - state.worldMs)} 남음</p>}
    </Modal>
  );
}

/* ── 관광(11-25) ── */
function TourPanel({ state, actions }: ScreenProps) {
  const c = cultureOf(state);
  const open = coursesOf(c);
  const cb = courseBonus(c);
  const tour = tourismPerHour(state);
  const lines = cultureLines(state).filter((l) => l.mult > 0);
  const tw = lines.reduce((v, l) => v + l.mult, 0) || 1;
  const from = [...lines].sort((a, b) => b.mult - a.mult || b.pct - a.pct).slice(0, 5);
  const [sel, setSel] = useState<CourseId | null>(null);
  return (
    <>
      <div className="cul-tour-top">
        <div>
          <b>{fmt(Math.round(tour * VISITORS_PER_TOUR))}명</b>
          <small>하루 관광객</small>
        </div>
        <div>
          <b>💰 {r1(baseTourism(state) * TOUR_INCOME * (1 + cb.income))}/h</b>
          <small>관광 수입</small>
        </div>
        <div>
          <b>
            {open.length}/{courseSlots(c)}
          </b>
          <small>관광 코스</small>
        </div>
      </div>
      <Card
        title="관광 코스"
        icon="🧳"
        right={cb.tour || cb.income ? <small className="muted">✈️ +{Math.round(cb.tour * 100)}%{cb.income ? ` · 💰 +${Math.round(cb.income * 100)}%` : ''}</small> : null}
        help={<p>시설 두 곳 이상을 묶어 관광 코스를 열면 관광·문화·관광 수입이 올라요. 한 번에 {courseSlots(c)}개까지 열 수 있고(관광 단지 5단계면 +1), 닫는 건 공짜예요. 다시 열면 돈이 또 들어요.</p>}
      >
        <div className="tiles c4 cul-course-tiles">
          {COURSES.map((d) => {
            const on = open.includes(d.id);
            const needOk = Object.entries(d.needs).every(([v, n]) => c.venues[v as VenueId] >= n!);
            return (
              <Tile
                key={d.id}
                icon={<Art k={`icon-cul-course-${d.id}`} icon={d.icon} dim={!needOk} />}
                label={d.name}
                sub={on ? '열림' : needOk ? `💰${fmt(d.money)}` : '조건 부족'}
                tone={on ? 'gold' : !canOpenCourse(state, d.id) ? 'green' : undefined}
                badge={on ? '✓' : null}
                onClick={() => setSel(d.id)}
              />
            );
          })}
        </div>
      </Card>
      <Card title="어디서 많이 오나" icon="🛬" help={<p>우리 문화가 잘 퍼지는 나라(협약·무역·연합·호감)에서 관광객이 많이 와요. 전쟁 중인 나라에선 안 와요.</p>}>
        {from.length === 0 && <p className="small muted">아직 오는 관광객이 없어요.</p>}
        {from.map((l) => (
          <div key={l.id} className="list-row small cul-row">
            <span className="cul-who">
              {FLAG[l.id]} {countryById(l.id).name}
            </span>
            <span className="cul-meter">
              <Meter value={l.mult} max={from[0].mult} tone="blue" />
              <small>하루 약 {fmt(Math.round((tour * VISITORS_PER_TOUR * l.mult) / tw))}명</small>
            </span>
          </div>
        ))}
      </Card>
      {sel && <CourseModal state={state} actions={actions} id={sel} onClose={() => setSel(null)} />}
    </>
  );
}

const courseEff = (d: (typeof COURSES)[number]) =>
  [d.tour ? `✈️ 관광 +${Math.round(d.tour * 100)}%` : '', d.perHit ? `히트작마다 ✈️ +${Math.round(d.perHit * 100)}%` : '', d.cul ? `🎨 문화 +${Math.round(d.cul * 100)}%` : '', d.income ? `💰 관광 수입 +${Math.round(d.income * 100)}%` : '', d.mood ? `🙂 민심 +${d.mood}` : '', d.eventPlus ? `🎉 행사 덤 +${Math.round(d.eventPlus * 100)}%` : '']
    .filter(Boolean)
    .join(' · ');

function CourseModal({ state, actions, id, onClose }: Pick<ScreenProps, 'state' | 'actions'> & { id: CourseId; onClose: () => void }) {
  const d = COURSES.find((x) => x.id === id)!;
  const on = coursesOf(cultureOf(state)).includes(id);
  const why = canOpenCourse(state, id);
  return (
    <Modal
      title={d.name}
      icon={d.icon}
      onClose={onClose}
      footer={
        on ? (
          <button className="wide" onClick={() => actions.apply((s) => closeCourse(s, id))}>
            코스 닫기(공짜)
          </button>
        ) : (
          <button className="wide primary" disabled={!!why} onClick={() => actions.apply((s) => openCourse(s, id))}>
            {d.icon} 코스 열기 · 💰{fmt(d.money)}
            {why ? <small> ({why})</small> : null}
          </button>
        )
      }
    >
      <div className="cul-hero">
        <Art k={`icon-cul-course-${id}`} icon={d.icon} big />
      </div>
      <p className="small">{d.text}</p>
      <p className="small result">{courseEff(d)}</p>
      <p className="small muted">필요: {needText(d.needs)}</p>
    </Modal>
  );
}

/* ── 행사 ── */
function EventPanel({ state, actions }: ScreenProps) {
  const c = cultureOf(state);
  const [sel, setSel] = useState<CultureEventId | null>(null);
  const on = c.event && state.worldMs < c.event.endMs ? c.event : null;
  return (
    <>
      <Card title="문화 행사" icon="🎉" help={<p>시설 단계를 채우면 큰 행사를 열 수 있어요. 행사 동안 관광이 크게 늘고, 끝나면 보상이 있어요. 한 번에 하나만 열려요.</p>}>
        {on && (
          <p className="small result">
            {CULTURE_EVENTS.find((e) => e.id === on.id)!.icon} {CULTURE_EVENTS.find((e) => e.id === on.id)!.name} 진행 중{on.target ? ` → ${countryById(on.target).name}` : ''} · {timeLeft(on.endMs - state.worldMs)} 남음
          </p>
        )}
        <div className="tiles c4 cul-ev-tiles">
          {CULTURE_EVENTS.map((e) => {
            const cool = (c.cool[e.id] ?? 0) - state.worldMs;
            const needOk = Object.entries(e.needs).every(([v, n]) => c.venues[v as VenueId] >= n!);
            return (
              <Tile
                key={e.id}
                icon={
                  <span className={needOk ? '' : 'cul-dim'}>
                    <EventArt id={e.id} icon={e.icon} />
                  </span>
                }
                label={e.name}
                sub={cool > 0 ? `⏳${timeLeft(cool)}` : needOk ? `💰${fmt(e.money)} · ⏱${e.hours}시간` : `필요: ${needText(e.needs)}`}
                badge={on?.id === e.id ? '●' : null}
                onClick={() => setSel(e.id)}
              />
            );
          })}
        </div>
      </Card>
      {sel && <EventModal state={state} actions={actions} id={sel} onClose={() => setSel(null)} />}
    </>
  );
}

function EventModal({ state, actions, id, onClose }: Pick<ScreenProps, 'state' | 'actions'> & { id: CultureEventId; onClose: () => void }) {
  const e = CULTURE_EVENTS.find((x) => x.id === id)!;
  const lines = cultureLines(state);
  const [target, setTarget] = useState<string | undefined>(() => (e.target ? lines.find((l) => l.mult > 0)?.id : undefined));
  const why = canHost(state, id, target);
  return (
    <Modal
      title={e.name}
      icon={e.icon}
      onClose={onClose}
      footer={
        <button
          className="wide primary"
          disabled={!!why}
          onClick={() => {
            actions.apply((s) => hostEvent(s, id, target));
            onClose();
          }}
        >
          {e.icon} 열기 · 💰{fmt(e.money)} · ⏱{e.hours}시간{why ? <small> ({why})</small> : null}
        </button>
      }
    >
      <div className="cul-hero">
        <EventArt id={id} icon={e.icon} big />
      </div>
      <p className="small">{e.text}</p>
      <p className="small muted">
        필요: {Object.entries(e.needs).map(([v, n]) => `${venueById(v as VenueId).name} ${n}단계`).join(' · ')} · 다시 열기까지 {e.coolHours >= 24 ? `${e.coolHours / 24}일` : `${e.coolHours}시간`}
      </p>
      {e.target && (
        <div className="spy-targets">
          {lines.map((l) => (
            <button key={l.id} className={`spy-target ${target === l.id ? 'on' : ''}`} disabled={l.mult === 0} onClick={() => setTarget(l.id)}>
              {FLAG[l.id]}
              <small>{countryById(l.id).name}</small>
              <i className="muted">{l.pct}%</i>
            </button>
          ))}
        </div>
      )}
    </Modal>
  );
}

/* ── 세계 ── */
function WorldPanel({ state, actions }: ScreenProps) {
  const c = cultureOf(state);
  const lines = [...cultureLines(state)].sort((a, b) => b.pct - a.pct);
  return (
    <Card
      title="세계에 퍼진 우리 문화"
      icon="🌏"
      right={<small className="muted">협약 {c.pacts.length}/{PACT_MAX}</small>}
      help={
        <p>
          막대는 그 나라가 스스로 쌓은 문화 대비 우리 영향력이에요. 100%가 되면 <b>문화 우세</b>. 🤝 문화 교류 협약(나라 예산 {fmt(PACT_COST)})을 맺으면 그 나라에 ×{PACT_MULT} 더 퍼지고 호감도 올라요. ★는 그 나라 문화 수준이에요.
        </p>
      }
    >
      {lines.map((l) => {
        const pact = c.pacts.includes(l.id);
        const why = canPact(state, l.id);
        return (
          <div key={l.id} className="list-row small cul-row">
            <span className="cul-who">
              {FLAG[l.id]} {countryById(l.id).name} <span className="muted">{'★'.repeat(aiStars(state, l.id))}</span>
            </span>
            <span className="cul-meter">
              <Meter value={l.pct} max={100} tone={l.sway === '우세' ? 'gold' : l.mult === 0 ? 'red' : 'blue'} />
              <small>{l.sway === '우세' ? '👑 우세' : l.mult === 0 ? '⚔️ 안 퍼짐' : `${l.pct}% ×${r1(l.mult)}`}</small>
            </span>
            {pact ? (
              <button className="mini" onClick={() => actions.apply((s) => endPact(s, l.id))} title="협약 끝내기">
                🤝✓
              </button>
            ) : (
              <button className="mini" disabled={!!why} title={why ?? '문화 교류 협약 맺기'} onClick={() => actions.apply((s) => signPact(s, l.id))}>
                🤝
              </button>
            )}
          </div>
        );
      })}
    </Card>
  );
}

/* ── 승리 ── */
export function CultureWinPanel({ state }: Pick<ScreenProps, 'state'>) {
  const p = cultureProgress(state);
  const left = cultureWinLeft(state);
  return (
    <Card title="🎨 문화 승리" right={<small className="muted">셋 다 채우고 {CULTURE_WIN_DAYS}일</small>}>
      <div className="small">
        ① 문화 우세 나라 {p.have} / {p.need} <span className="muted">(살아 있는 다른 나라의 {Math.round(CULTURE_WIN_SHARE * 100)}%)</span>
        <Meter value={p.have} max={p.need} tone="gold" />
        ② 5단계 문화 시설 {p.top} / {CULTURE_WIN_TOP}
        <Meter value={p.top} max={CULTURE_WIN_TOP} tone="gold" />
        ③ 호칭 「{RANKS[RANKS.length - 1].name}」 {p.rankOk ? '✅' : '⬜'}
      </div>
      {left !== null ? <p className="small result">🎨 조건 달성! {timeLeft(left)} 더 지키면 문화 승리예요.</p> : <p className="small muted">세 조건을 모두 채운 채 {CULTURE_WIN_DAYS}일 동안 지키면 문화로 세계를 이겨요. 전쟁을 하면 그 나라엔 문화가 안 퍼지니 평화가 유리해요.</p>}
    </Card>
  );
}
