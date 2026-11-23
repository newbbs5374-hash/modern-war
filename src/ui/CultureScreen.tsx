// 🎭 문화 탭(11-23): 시설 · 걸작 · 행사 · 세계 · 승리
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
  SPECIAL_BONUS, VENUES, VENUE_MAX, WORK_KINDS, venueById, workCost, type CultureEventId, type VenueId, type WorkKind,
} from '../data/culture';
import {
  aiStars, addWork, canAddWork, canHost, canPact, canUpgrade, cultureLines, cultureOf, culturePerHour, cultureProgress, cultureWinLeft,
  endPact, hostEvent, nextWorkName, signPact, tourismPerHour, upgradeCost, upgradeVenue, workSlots, TOUR_INCOME,
} from '../game/culture';
import { RES_ICON, type Res } from '../data/economy';

export type CultureTab = 'venue' | 'works' | 'event' | 'world' | 'win';

/** 시설 그림(src/assets/icons/icon-cul-<시설>-<단계>.webp), 없으면 이모지 */
export function VenueArt({ id, level, big }: { id: VenueId; level: number; big?: boolean }) {
  const url = iconArt(`icon-cul-${id}-${Math.max(1, level)}`);
  const d = venueById(id);
  if (url) return <img className={`art-ico cul-art ${big ? 'big' : ''} ${level === 0 ? 'dim' : ''}`} src={url} alt={d.name} draggable={false} />;
  return <span className={`cul-emoji ${big ? 'big' : ''} ${level === 0 ? 'dim' : ''}`}>{d.icon}</span>;
}
function EventArt({ id, icon }: { id: CultureEventId; icon: string }) {
  const url = iconArt(`icon-cul-ev-${id}`);
  return url ? <img className="art-ico" src={url} alt="" draggable={false} /> : <>{icon}</>;
}
const lv = (n: number) => '★'.repeat(n) + '☆'.repeat(VENUE_MAX - n);
const r1 = (n: number) => (Math.round(n * 10) / 10).toLocaleString('ko-KR');
const resText = (res: Partial<Record<Res, number>>) =>
  Object.entries(res)
    .map(([r, n]) => `${RES_ICON[r as Res]}${r} ${n}`)
    .join(' · ');

export function CultureScreen(props: ScreenProps) {
  const { state } = props;
  const c = cultureOf(state);
  const p = cultureProgress(state);
  const [tab, setTab] = useTab<CultureTab>('culture', 'venue');
  const evOn = c.event && state.worldMs < c.event.endMs;
  const tabs: TabDef<CultureTab>[] = [
    { id: 'venue', label: '시설', icon: '🏛️', badge: c.builds.length || null },
    { id: 'works', label: '걸작', icon: '🏺', badge: WORK_KINDS.some((k) => !canAddWork(state, k.id)) ? '!' : null },
    { id: 'event', label: '행사', icon: '🎉', badge: evOn ? '●' : null },
    { id: 'world', label: '세계', icon: '🌏' },
    { id: 'win', label: '승리', icon: '🏆', badge: c.winSinceMs != null ? '!' : null },
  ];
  return (
    <>
      <div className="cul-bar">
        <span title="시간당 문화">🎨 {r1(culturePerHour(state))}/h</span>
        <span title="시간당 관광">✈️ {r1(tourismPerHour(state))}/h</span>
        <span title="문화 점수">💠 {fmt(c.points)}</span>
        <span title="문화 우세 나라">🌏 {p.have}/{p.need}</span>
        <Help title="문화는 어떻게 하나요?">
          <p>🎨 <b>문화</b>: 시설·걸작이 시간마다 만들어요. 쌓인 <b>문화 점수 💠</b>로 걸작을 들여요.</p>
          <p>✈️ <b>관광</b>: 우리 문화가 다른 나라로 퍼지는 힘. 나라마다 <b>영향력</b>이 쌓이고, 그 나라가 스스로 쌓은 문화보다 커지면 <b>문화 우세</b>가 돼요. 관광 1점마다 시간당 국방예산 {TOUR_INCOME}의 관광 수입도 들어와요.</p>
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
      {tab === 'venue' && <VenuePanel {...props} />}
      {tab === 'works' && <WorksPanel {...props} />}
      {tab === 'event' && <EventPanel {...props} />}
      {tab === 'world' && <WorldPanel {...props} />}
      {tab === 'win' && <CultureWinPanel {...props} />}
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
          </div>
        ))}
        <div className="tiles c3 cul-tiles">
          {VENUES.map((d) => {
            const n = c.venues[d.id];
            const building = c.builds.some((b) => b.venue === d.id);
            return (
              <Tile
                key={d.id}
                icon={<VenueArt id={d.id} level={n} />}
                label={d.name}
                sub={<span className="cul-stars">{lv(n)}</span>}
                badge={building ? '🏗️' : sp?.venue === d.id ? '⭐' : !canUpgrade(state, d.id) ? '↑' : null}
                tone={n >= VENUE_MAX ? 'gold' : undefined}
                onClick={() => setSel(d.id)}
              >
                <small className="muted cul-lvname">{n ? d.levels[n - 1] : '아직 없음'}</small>
              </Tile>
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
  const cost = to <= VENUE_MAX ? upgradeCost(id, to) : null;
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
function WorksPanel({ state, actions }: ScreenProps) {
  const c = cultureOf(state);
  const total = c.works.relic.length + c.works.show.length + c.works.hit.length;
  return (
    <Card
      title="걸작"
      icon="🏺"
      right={<small className="muted">다음 걸작 💠{workCost(total)}</small>}
      help={<p>박물관·공연장·방송영화 단계만큼 걸작 칸이 생겨요. 걸작 하나마다 시간당 🎨 문화 +0.5, ✈️ 관광 +1. 문화 점수 💠로 들여요(들일수록 비싸져요).</p>}
    >
      {WORK_KINDS.map((k) => {
        const slots = workSlots(state, k.id);
        const have = c.works[k.id];
        const why = canAddWork(state, k.id);
        return (
          <div key={k.id} className="cul-works">
            <div className="list-row small">
              <b>
                {k.icon} {k.name} <span className="muted">({venueById(k.venue).name}) {have.length}/{slots}</span>
              </b>
              <button disabled={!!why} title={why ?? ''} onClick={() => actions.apply((s) => addWork(s, k.id as WorkKind))}>
                + 「{nextWorkName(state, k.id)}」
              </button>
            </div>
            <div className="cul-slots">
              {Array.from({ length: VENUE_MAX }, (_, i) => (
                <span key={i} className={`cul-slot ${i < have.length ? 'on' : i < slots ? 'open' : ''}`} title={have[i] ?? ''}>
                  {i < have.length ? k.icon : i < slots ? '＋' : '🔒'}
                  <small>{have[i] ?? ''}</small>
                </span>
              ))}
            </div>
            {why && <small className="muted">{why}</small>}
          </div>
        );
      })}
    </Card>
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
        <div className="tiles c3">
          {CULTURE_EVENTS.map((e) => {
            const cool = (c.cool[e.id] ?? 0) - state.worldMs;
            const needOk = Object.entries(e.needs).every(([v, n]) => c.venues[v as VenueId] >= n!);
            return (
              <Tile
                key={e.id}
                icon={<EventArt id={e.id} icon={e.icon} />}
                label={e.name}
                sub={cool > 0 ? `⏳${timeLeft(cool)}` : `💰${fmt(e.money)}`}
                locked={!needOk}
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
      icon={<EventArt id={id} icon={e.icon} />}
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
          막대는 그 나라가 스스로 쌓은 문화 대비 우리 영향력이에요. 100%가 되면 <b>문화 우세</b>. 🤝 문화 교류 협약(국방예산 {fmt(PACT_COST)})을 맺으면 그 나라에 ×{PACT_MULT} 더 퍼지고 호감도 올라요. ★는 그 나라 문화 수준이에요.
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
