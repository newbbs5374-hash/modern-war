// 인물 사진을 누르면: ① 큰 초상화 팝업 → ② 인물 창(정보 · 스탯 · 관계 · 교류).
// 용흔의 서약자 정보창처럼 위에 큰 사진·이름·등급, 아래 탭. 사진 칸은 Portrait.tsx 의 Face를 그대로 씀.
import { createContext, useContext, useState, type ReactNode } from 'react';
import { AIDE_EFFECT } from '../battle/grid';
import { LEADERS, PERSONALITIES } from '../data/leaders';
import { STAT_IDS, generalSlots, statCap, statExpNeed } from '../data/officers';
import { RANKS } from '../data/ranks';
import { COUNTRIES, countryById } from '../data/world';
import { favorName, favorOf, favorReasons } from '../game/civ';
import {
  AIDE_STORIES,
  ERRANDS,
  aideTrainCost,
  canErrand,
  canGift,
  canTrainAide,
  claimErrand,
  dismissGeneral,
  errandReward,
  giftAide,
  giftCost,
  myRenown,
  promoteAide,
  rivalRenown,
  rivalRank,
  sendAide,
  trainAide,
  type ErrandKind,
} from '../game/officer';
import { NPC_INFO, actCost, actsOf, canAct, doAct, letterChance, personExists, type PersonRef } from '../game/people';
import { budgetPerDay, troopsPerDay, type GameState } from '../game/state';
import { citiesOf, isAlive, relationOf } from '../game/world';
import { fmt } from './common';
import { Flag } from './flag';
import { AIDE_ICON, RANK_ICON } from './icons';
import { Meter } from './kit';
import type { Screen } from './nav';
import { timeLeft } from './officerScreens';
import { Face, aideKeys } from './Portrait';
import type { GameActions } from './screens';

/* ───────── 어디서든 인물 열기 ───────── */
const PeopleCtx = createContext<(p: PersonRef) => void>(() => {});
export const useOpenPerson = () => useContext(PeopleCtx);

type View = { who: PersonRef; step: 'portrait' | 'window' } | null;

export function PeopleProvider({ state, actions, go, children }: { state: GameState; actions: GameActions; go: (s: Screen) => void; children: ReactNode }) {
  const [view, setView] = useState<View>(null);
  const open = (who: PersonRef) => setView({ who, step: 'portrait' });
  const live = view && personExists(state, view.who) ? view : null;
  return (
    <PeopleCtx.Provider value={open}>
      {children}
      {live?.step === 'portrait' && <PortraitPopup state={state} who={live.who} onClose={() => setView(null)} onMore={() => setView({ who: live.who, step: 'window' })} />}
      {live?.step === 'window' && (
        <PersonWindow
          state={state}
          actions={actions}
          who={live.who}
          onClose={() => setView(null)}
          onZoom={() => setView({ who: live.who, step: 'portrait' })}
          onOpen={(p) => setView({ who: p, step: 'window' })}
          go={(s) => (setView(null), go(s))}
        />
      )}
    </PeopleCtx.Provider>
  );
}

/** 누를 수 있는 인물 사진(다른 버튼 안에 있어도 됨 · 누르면 그 버튼은 안 눌림) */
export function PersonFace({ who, keys, fallback, className = '' }: { who: PersonRef; keys: (string | undefined | null)[]; fallback: ReactNode; className?: string }) {
  const open = useOpenPerson();
  const go = (e: { stopPropagation: () => void; preventDefault: () => void }) => {
    e.stopPropagation();
    e.preventDefault();
    open(who);
  };
  return (
    <span
      role="button"
      tabIndex={0}
      className={`person-face ${className}`}
      aria-label="인물 사진 크게 보기"
      onClick={go}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && go(e)}
    >
      <Face keys={keys} fallback={fallback} />
    </span>
  );
}

/* ───────── 인물 한 사람의 이름표 ───────── */
interface Card {
  name: string;
  title: string;
  keys: (string | undefined | null)[];
  fallback: ReactNode;
  tags: string[];
  intro: string;
}

function leaderName(id: string) {
  return `${LEADERS[id].title} ${LEADERS[id].name}`;
}

export function personCard(s: GameState, p: PersonRef): Card {
  const o = s.officer;
  const me = s.player.countryId;
  switch (p.kind) {
    case 'player': {
      const r = s.player.rankIndex;
      return {
        name: s.player.name,
        title: `${countryById(me).name} · ${RANKS[r].name}`,
        keys: ['player', `leader-${me}`],
        fallback: <Flag id={me} />,
        tags: [`등급 ${r + 1}/${RANKS.length}`, `지휘 ${RANKS[r].unit}`],
        intro: `${countryById(me).name}을 이끄는 지도자. 훈련·임무로 스탯을 키우고, 부관·장군과 함께 나라를 지켜요.`,
      };
    }
    case 'aide': {
      const a = o.aides.find((x) => x.id === p.id)!;
      const busy = a.errand && s.worldMs < a.errand.endMs;
      return {
        name: a.name,
        title: `${a.specialty} 부관 · Lv.${a.level}`,
        keys: aideKeys(a),
        fallback: AIDE_ICON[a.specialty],
        tags: [`💗 인연 ${a.bond}`, busy ? `${ERRANDS[a.errand!.kind].icon} ${a.errand!.kind} 중` : '대기 중'],
        intro: `전투에 함께 나가는 ${a.specialty} 부관. 인연이 깊어지면 이야기를 들려주고 전투에서 더 힘을 내요.`,
      };
    }
    case 'general': {
      const g = o.generals.find((x) => x.id === p.id)!;
      return {
        name: g.name,
        title: `${g.field} 장군 · ${g.style}`,
        keys: [`aide-${g.name}`],
        fallback: '⭐',
        tags: [`능력 ${g.skill}/10`, `충성 ${Math.round(g.loyalty)}`, g.from],
        intro: `우리 도시를 자동으로 지키는 장군. 능력이 높을수록 방어가 단단하고, 충성이 낮으면 떠날 수도 있어요.`,
      };
    }
    case 'rival': {
      const rv = o.rivals.find((x) => x.name === p.name)!;
      const rk = rivalRank(rv, s.worldMs);
      return {
        name: rv.name,
        title: `라이벌 · ${RANKS[rk].name}`,
        keys: [`aide-${rv.name}`],
        fallback: RANK_ICON[rk],
        tags: [`평판 ${fmt(rivalRenown(rv, s.worldMs))}`, o.chiefRival === rv.name ? '👑 1순위 후보' : '경쟁 중'],
        intro: '같은 나라에서 지도자 자리를 노리는 경쟁자. 평판(공훈 + 명성 + 신뢰)이 나보다 높으면 위험해요.',
      };
    }
    case 'leader': {
      const c = countryById(p.country);
      const pers = s.world.personalities[p.country];
      const mine = p.country === me;
      const rel = mine ? '우리 나라' : relationOf(s.world, me, p.country);
      return {
        name: LEADERS[p.country].name,
        title: `${c.name} ${LEADERS[p.country].title}`,
        keys: [`leader-${p.country}`],
        fallback: <Flag id={p.country} />,
        tags: [rel, pers, isAlive(s.world, p.country) ? `도시 ${citiesOf(s.world, p.country).length}` : '멸망'],
        intro: `${c.intro}. ${pers} 지도자 — ${PERSONALITIES[pers].text}.`,
      };
    }
    case 'npc': {
      const n = NPC_INFO[p.role];
      return {
        name: n.name,
        title: p.country ? `${countryById(p.country).name}` : '방문객',
        keys: [p.role],
        fallback: n.icon,
        tags: p.country && p.country !== me ? [relationOf(s.world, me, p.country)] : [],
        intro: n.text,
      };
    }
  }
}

/* ───────── ① 큰 초상화 팝업 ───────── */
function PortraitPopup({ state, who, onClose, onMore }: { state: GameState; who: PersonRef; onClose: () => void; onMore: () => void }) {
  const c = personCard(state, who);
  return (
    <div className="modal-back person-back" onClick={onClose}>
      <div className="portrait-pop" role="dialog" aria-label={`${c.name} 초상화`} onClick={(e) => e.stopPropagation()}>
        <button className="x" onClick={onClose} aria-label="닫기">
          ✕
        </button>
        <div className="pp-frame">
          <span className="pp-img">
            <Face keys={c.keys} fallback={<span className="pp-fallback">{c.fallback}</span>} className="pp-face" />
          </span>
          <span className="pp-corner tl" />
          <span className="pp-corner br" />
        </div>
        <div className="pp-name">
          <b>{c.name}</b>
          <small>{c.title}</small>
        </div>
        <div className="pp-tags">
          {c.tags.map((t) => (
            <span key={t} className="tag">
              {t}
            </span>
          ))}
        </div>
        <button className="primary wide" onClick={onMore}>
          📋 인물 창 열기
        </button>
      </div>
    </div>
  );
}

/* ───────── ② 인물 창 ───────── */
type Tab = 'info' | 'stats' | 'rel' | 'act';
const TABS: Array<{ id: Tab; label: string; icon: string }> = [
  { id: 'info', label: '정보', icon: '📋' },
  { id: 'stats', label: '스탯', icon: '📊' },
  { id: 'rel', label: '관계', icon: '🕸️' },
  { id: 'act', label: '교류', icon: '🤝' },
];

interface WinProps {
  state: GameState;
  actions: GameActions;
  who: PersonRef;
  onClose: () => void;
  onZoom: () => void;
  onOpen: (p: PersonRef) => void;
  go: (s: Screen) => void;
}

function PersonWindow(props: WinProps) {
  const { state, who, onClose, onZoom } = props;
  const [tab, setTab] = useState<Tab>('info');
  const c = personCard(state, who);
  const hasActs = actsOf(who).length > 0 || who.kind === 'aide';
  return (
    <div className="modal-back person-back" onClick={onClose}>
      <div className="modal person-win" role="dialog" aria-label={`${c.name} 인물 창`} onClick={(e) => e.stopPropagation()}>
        <div className="pw-head">
          <button className="pw-photo" onClick={onZoom} aria-label={`${c.name} 초상화 크게 보기`}>
            <Face keys={c.keys} fallback={<span className="pw-fallback">{c.fallback}</span>} />
            <i>🔍</i>
          </button>
          <div className="pw-id">
            <b>{c.name}</b>
            <small>{c.title}</small>
            <span className="pp-tags">
              {c.tags.map((t) => (
                <span key={t} className="tag">
                  {t}
                </span>
              ))}
            </span>
          </div>
          <button className="x" onClick={onClose} aria-label="닫기">
            ✕
          </button>
        </div>
        <div className="tabs pw-tabs" role="tablist">
          {TABS.filter((t) => t.id !== 'act' || hasActs).map((t) => (
            <button key={t.id} role="tab" aria-selected={tab === t.id} className={tab === t.id ? 'on' : ''} onClick={() => setTab(t.id)}>
              <span className="tab-ico">{t.icon}</span>
              <small>{t.label}</small>
            </button>
          ))}
        </div>
        <div className="modal-body pw-body">
          {tab === 'info' && <InfoTab {...props} intro={c.intro} />}
          {tab === 'stats' && <StatsTab {...props} />}
          {tab === 'rel' && <RelTab {...props} />}
          {tab === 'act' && <ActTab {...props} />}
        </div>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: ReactNode; v: ReactNode }) {
  return (
    <div className="pw-row">
      <small>{k}</small>
      <b>{v}</b>
    </div>
  );
}

/* 정보 */
function InfoTab({ state, who, intro, go }: WinProps & { intro: string }) {
  const o = state.officer;
  const me = state.player.countryId;
  return (
    <>
      <p className="small pw-intro">{intro}</p>
      {who.kind === 'player' && (
        <div className="pw-grid">
          <Row k="나라" v={countryById(me).name} />
          <Row k="지도자 등급" v={RANKS[state.player.rankIndex].name} />
          <Row k="📣 명성" v={fmt(o.fame)} />
          <Row k="🤝 의회 신뢰" v={Math.round(o.trust)} />
          <Row k="🔐 정보" v={fmt(o.intel)} />
          <Row k="🎖️ 모은 공훈" v={fmt(o.totalMerit)} />
          <Row k="💵 봉급" v={fmt(state.player.salary)} />
          <Row k="평판" v={fmt(myRenown(o))} />
        </div>
      )}
      {who.kind === 'aide' &&
        (() => {
          const a = o.aides.find((x) => x.id === who.id)!;
          return (
            <div className="pw-grid">
              <Row k="분야" v={`${AIDE_ICON[a.specialty]} ${a.specialty}`} />
              <Row k="레벨" v={`Lv.${a.level} / 10`} />
              <Row k="상태" v={a.errand ? (state.worldMs < a.errand.endMs ? `${a.errand.kind} · ${timeLeft(a.errand.endMs - state.worldMs)}` : `${a.errand.kind} 끝(보상 대기)`) : '대기 중'} />
              <Row k="인연 이야기" v={`${a.stories ?? 0} / 3`} />
              <div className="pw-wide">
                <small>⚔️ 전투 효과</small>
                <p className="small">{AIDE_EFFECT[a.specialty]}</p>
              </div>
            </div>
          );
        })()}
      {who.kind === 'general' &&
        (() => {
          const g = o.generals.find((x) => x.id === who.id)!;
          return (
            <div className="pw-grid">
              <Row k="분야" v={g.field} />
              <Row k="성향" v={g.style} />
              <Row k="들어온 길" v={g.from} />
              <Row k="도시 방어" v={`+${(g.skill * 1.5).toFixed(1)}%`} />
            </div>
          );
        })()}
      {who.kind === 'rival' &&
        (() => {
          const rv = o.rivals.find((x) => x.name === who.name)!;
          const rk = rivalRank(rv, state.worldMs);
          return (
            <div className="pw-grid">
              <Row k="계급" v={RANKS[rk].name} />
              <Row k="평판" v={fmt(rivalRenown(rv, state.worldMs))} />
              <Row k="내 평판" v={fmt(myRenown(o))} />
              <Row k="나와 비교" v={rk > state.player.rankIndex ? '⚠️ 나보다 앞섬' : rk === state.player.rankIndex ? '같은 등급' : '내가 앞섬'} />
            </div>
          );
        })()}
      {who.kind === 'leader' &&
        (() => {
          const id = who.country;
          const c = countryById(id);
          const n = state.nations[id];
          return (
            <>
              <div className="pw-grid">
                <Row k="나라" v={c.name} />
                <Row k="직함" v={LEADERS[id].title} />
                <Row k="성향" v={state.world.personalities[id]} />
                <Row k="도시" v={`${citiesOf(state.world, id).length}개`} />
                <Row k="💰 국방예산" v={fmt(n.treasury)} />
                <Row k="🪖 병력" v={`${fmt(n.troops)}명`} />
              </div>
              <div className="pw-wide">
                <small>특수 능력</small>
                <p className="small">
                  {c.ability.name} — {c.ability.effect}
                </p>
              </div>
              {id !== me && (
                <button className="wide" onClick={() => go('diplo')}>
                  🌐 외교 화면으로
                </button>
              )}
            </>
          );
        })()}
      {who.kind === 'npc' && who.country && (
        <div className="pw-grid">
          <Row k="보낸 나라" v={countryById(who.country).name} />
          <Row k="그 나라 지도자" v={leaderName(who.country)} />
        </div>
      )}
    </>
  );
}

/* 스탯 */
function StatsTab({ state, who }: WinProps) {
  const o = state.officer;
  if (who.kind === 'player') {
    const cap = statCap(state.player.rankIndex);
    return (
      <>
        <p className="small muted">스탯 상한 {cap} · 훈련·임무로 경험이 차면 1씩 올라요.</p>
        <div className="pw-stats">
          {STAT_IDS.map((id) => {
            const v = o.stats[id];
            const e = o.statExp?.[id] ?? 0;
            return (
              <div key={id} className="pw-stat">
                <span>
                  <small>{id}</small>
                  <b>{v}</b>
                </span>
                <Meter value={v} max={cap} tone="green" />
                <Meter value={e} max={statExpNeed(v)} tone="blue" />
              </div>
            );
          })}
        </div>
      </>
    );
  }
  if (who.kind === 'aide') {
    const a = o.aides.find((x) => x.id === who.id)!;
    return (
      <div className="pw-bars">
        <Bar label="⬆️ 레벨" v={a.level} max={10} tone="gold" />
        <Bar label="📘 경험" v={a.exp} max={a.level * 100} tone="blue" />
        <Bar label="💗 인연" v={a.bond} max={100} tone="red" />
        <p className="small muted">레벨만큼 전투에서 강해요. 인연 60: 전투 공격 +1 · 인연 90: 임무 성공 +5% · Lv.3부터 장군 승격 가능.</p>
      </div>
    );
  }
  if (who.kind === 'general') {
    const g = o.generals.find((x) => x.id === who.id)!;
    return (
      <div className="pw-bars">
        <Bar label="⭐ 능력" v={g.skill} max={10} tone="gold" />
        <Bar label="🫡 충성" v={Math.round(g.loyalty)} max={100} tone="green" />
      </div>
    );
  }
  if (who.kind === 'rival') {
    const rv = o.rivals.find((x) => x.name === who.name)!;
    const top = Math.max(myRenown(o), rivalRenown(rv, state.worldMs));
    return (
      <div className="pw-bars">
        <Bar label={`🏁 ${rv.name}`} v={rivalRenown(rv, state.worldMs)} max={top} tone="red" />
        <Bar label="🏁 나" v={myRenown(o)} max={top} tone="green" />
        <Bar label="🎖️ 계급" v={rivalRank(rv, state.worldMs) + 1} max={RANKS.length} tone="gold" />
      </div>
    );
  }
  if (who.kind === 'leader') {
    const id = who.country;
    const P = PERSONALITIES[state.world.personalities[id]];
    const c = countryById(id);
    return (
      <div className="pw-bars">
        <Bar label="⚔️ 침공 성향" v={P.aggression} max={1.5} tone="red" text={`×${P.aggression}`} />
        <Bar label="🔥 긴장 쌓임" v={P.tension} max={1.5} tone="gold" text={`×${P.tension}`} />
        <Bar label="🕊️ 평화 의지" v={P.peace} max={1.5} tone="green" text={`×${P.peace}`} />
        <Bar label="🏭 경제" v={c.economy} max={10} tone="blue" />
        <Bar label="🛡️ 군사력" v={c.military} max={10} tone="red" />
        <p className="small muted">
          국방예산 시간당 +{fmt(budgetPerDay(state, id))} · 병력 시간당 +{fmt(troopsPerDay(state, id))}
        </p>
      </div>
    );
  }
  return <p className="small muted">이 사람은 따로 스탯이 없어요.</p>;
}

function Bar({ label, v, max, tone, text }: { label: string; v: number; max: number; tone: 'gold' | 'red' | 'blue' | 'green'; text?: string }) {
  return (
    <div className="pw-bar">
      <small>{label}</small>
      <Meter value={v} max={max} tone={tone} />
      <b>{text ?? `${fmt(v)}/${fmt(max)}`}</b>
    </div>
  );
}

/* 관계 */
function Person({ state, who, onOpen, right }: { state: GameState; who: PersonRef; onOpen: (p: PersonRef) => void; right: ReactNode }) {
  const c = personCard(state, who);
  return (
    <button className="line-item wide-btn pw-person" onClick={() => onOpen(who)}>
      <span className="li-ico pw-mini">
        <Face keys={c.keys} fallback={c.fallback} />
      </span>
      <span className="li-main">
        <b>{c.name}</b>
        <small>{c.title}</small>
      </span>
      <span className="pw-right">{right}</span>
    </button>
  );
}

function RelTab({ state, who, onOpen }: WinProps) {
  const o = state.officer;
  const me = state.player.countryId;
  if (who.kind === 'player') {
    const others = COUNTRIES.filter((c) => c.id !== me && isAlive(state.world, c.id))
      .map((c) => ({ id: c.id, f: favorOf(state, c.id) }))
      .sort((a, b) => b.f - a.f);
    return (
      <>
        {o.aides.length > 0 && <small className="muted">🧑‍✈️ 부관</small>}
        {o.aides.map((a) => (
          <Person key={a.id} state={state} who={{ kind: 'aide', id: a.id }} onOpen={onOpen} right={<Meter value={a.bond} max={100} tone="red" />} />
        ))}
        {o.generals.length > 0 && <small className="muted">⭐ 장군</small>}
        {o.generals.map((g) => (
          <Person key={g.id} state={state} who={{ kind: 'general', id: g.id }} onOpen={onOpen} right={<Meter value={g.loyalty} max={100} tone="green" />} />
        ))}
        <small className="muted">🏁 라이벌</small>
        {o.rivals.map((r) => (
          <Person key={r.name} state={state} who={{ kind: 'rival', name: r.name }} onOpen={onOpen} right={<small>{fmt(rivalRenown(r, state.worldMs))}</small>} />
        ))}
        <small className="muted">🌐 다른 나라 지도자(호감 순)</small>
        {others.map((x) => (
          <Person key={x.id} state={state} who={{ kind: 'leader', country: x.id }} onOpen={onOpen} right={<FavorTag v={x.f} />} />
        ))}
      </>
    );
  }
  if (who.kind === 'aide') {
    const a = o.aides.find((x) => x.id === who.id)!;
    const told = a.stories ?? 0;
    return (
      <>
        <Bar label="💗 나와의 인연" v={a.bond} max={100} tone="red" />
        <div className="stories">
          <small className="muted">💬 인연 이야기 {told}/3</small>
          {AIDE_STORIES[a.specialty].map((t, i) => (
            <p key={i} className={`small ${i < told ? '' : 'muted'}`}>
              {i < told ? `“${t}”` : `🔒 인연 ${[30, 60, 90][i]}에 열려요`}
            </p>
          ))}
        </div>
        {o.aides.length > 1 && <small className="muted">함께 일하는 부관</small>}
        {o.aides
          .filter((x) => x.id !== a.id)
          .map((x) => (
            <Person key={x.id} state={state} who={{ kind: 'aide', id: x.id }} onOpen={onOpen} right={<small>Lv.{x.level}</small>} />
          ))}
      </>
    );
  }
  if (who.kind === 'general') {
    const g = o.generals.find((x) => x.id === who.id)!;
    return (
      <>
        <Bar label="🫡 나에 대한 충성" v={Math.round(g.loyalty)} max={100} tone="green" />
        <p className="small muted">{g.loyalty >= 70 ? '굳게 믿고 따라요.' : g.loyalty >= 40 ? '명령은 따르지만 아직 거리가 있어요.' : '불만이 쌓였어요. 회의·격려금으로 달래 주세요.'}</p>
      </>
    );
  }
  if (who.kind === 'rival') {
    const others = o.rivals.filter((r) => r.name !== who.name);
    return (
      <>
        <p className="small muted">나와는 지도자 자리를 두고 경쟁하는 사이예요.</p>
        <small className="muted">다른 라이벌</small>
        {others.map((r) => (
          <Person key={r.name} state={state} who={{ kind: 'rival', name: r.name }} onOpen={onOpen} right={<small>{fmt(rivalRenown(r, state.worldMs))}</small>} />
        ))}
      </>
    );
  }
  if (who.kind === 'leader' || (who.kind === 'npc' && who.country)) {
    const id = who.kind === 'leader' ? who.country : who.country!;
    const f = favorOf(state, id);
    const rows = id === me ? [] : favorReasons(state, id);
    return (
      <>
        {id !== me && (
          <>
            <div className="pw-favor">
              <b>
                {favorName(f).icon} 우리를 {favorName(f).name}
              </b>
              <Meter value={f + 100} max={200} tone={f >= 0 ? 'green' : 'red'} />
              <small>{f > 0 ? `+${f}` : f}</small>
            </div>
            <div className="pw-reasons">
              {rows.length === 0 && <small className="muted">아직 특별한 이유가 없어요.</small>}
              {rows.map(([t, v], i) => (
                <span key={i} className={v >= 0 ? 'ok' : 'warn'}>
                  {t} <b>{v > 0 ? `+${v}` : v}</b>
                </span>
              ))}
            </div>
          </>
        )}
        {who.kind === 'npc' && <Person state={state} who={{ kind: 'leader', country: id }} onOpen={onOpen} right={<small>보낸 사람</small>} />}
        {who.kind === 'leader' && (
          <>
            <small className="muted">다른 나라와의 사이</small>
            <div className="pw-rels">
              {COUNTRIES.filter((c) => c.id !== id && isAlive(state.world, c.id)).map((c) => {
                const rel = relationOf(state.world, id, c.id);
                return (
                  <button key={c.id} className={`pw-rel rel-${rel}`} onClick={() => onOpen({ kind: 'leader', country: c.id })}>
                    <Flag id={c.id} />
                    <small>{c.id === me ? '우리' : c.name}</small>
                    <i>{rel}</i>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </>
    );
  }
  return <p className="small muted">아직 알려진 관계가 없어요.</p>;
}

function FavorTag({ v }: { v: number }) {
  return (
    <small className={v >= 0 ? 'ok' : 'warn'}>
      {favorName(v).icon} {v > 0 ? `+${v}` : v}
    </small>
  );
}

/* 교류 */
function ActTab({ state, actions, who }: WinProps) {
  const [msg, setMsg] = useState('');
  const r = state.player.rankIndex;
  const run = (f: (s: GameState) => { state: GameState; out: string }) => setMsg(actions.applyWith((s) => f(s)) ?? '');
  return (
    <>
      <div className="pw-acts">
        {actsOf(who).map((a) => {
          const why = canAct(state, who, a.id);
          const cost = actCost(state, who, a.id);
          const odds = who.kind === 'leader' && a.id === 'letter' ? ` · 성공 ${Math.round(letterChance(state, who.country) * 100)}%` : '';
          return (
            <button key={a.id} className="pw-act" disabled={!!why} onClick={() => run((s) => doAct(s, who, a.id))}>
              <span className="pw-act-ico">{a.icon}</span>
              <span className="li-main">
                <b>{a.name}</b>
                <small>
                  {a.text}
                  {odds}
                </small>
                <small className={why ? 'warn' : 'muted'}>{why ?? (cost ? `💵 ${fmt(cost)}` : '무료 · 하루 한 번')}</small>
              </span>
            </button>
          );
        })}
      </div>
      {who.kind === 'aide' && <AideActs state={state} actions={actions} id={who.id} setMsg={setMsg} />}
      {who.kind === 'general' && (
        <button className="danger wide" onClick={() => window.confirm('이 장군을 보낼까요?') && actions.apply((s) => dismissGeneral(s, who.id))}>
          👋 장군 보내기
        </button>
      )}
      {msg && <p className="small result">{msg}</p>}
      {who.kind === 'player' && <p className="small muted">💡 스탯은 훈련 탭, 부관·장군은 사진을 눌러 각각 교류할 수 있어요. 지금 봉급 💵{fmt(state.player.salary)} · 선물 기준 {fmt(giftCost(r))}</p>}
    </>
  );
}

function AideActs({ state, actions, id, setMsg }: { state: GameState; actions: GameActions; id: number; setMsg: (m: string) => void }) {
  const a = state.officer.aides.find((x) => x.id === id)!;
  const r = state.player.rankIndex;
  const busy = a.errand && state.worldMs < a.errand.endMs;
  const done = a.errand && state.worldMs >= a.errand.endMs;
  const gWhy = canGift(state, a.id);
  const tWhy = canTrainAide(state, a.id);
  const canPromote = generalSlots(r) > state.officer.generals.length && a.level >= 3;
  return (
    <>
      <div className="pw-acts">
        <button className="pw-act" disabled={!!gWhy} onClick={() => (actions.apply((s) => giftAide(s, a.id)), setMsg(`🎁 ${a.name}에게 선물했어요. 인연 +8`))}>
          <span className="pw-act-ico">🎁</span>
          <span className="li-main">
            <b>선물</b>
            <small>인연 +8</small>
            <small className={gWhy ? 'warn' : 'muted'}>{gWhy ?? `💵 ${fmt(giftCost(r))}`}</small>
          </span>
        </button>
        <button className="pw-act" disabled={!!tWhy} onClick={() => (actions.apply((s) => trainAide(s, a.id)), setMsg(`📚 ${a.name} 특별 훈련 완료. 경험 +60`))}>
          <span className="pw-act-ico">📚</span>
          <span className="li-main">
            <b>특별 훈련</b>
            <small>경험 +60 · 인연 +2</small>
            <small className={tWhy ? 'warn' : 'muted'}>{tWhy ?? `💵 ${fmt(aideTrainCost(r))}`}</small>
          </span>
        </button>
      </div>
      {done ? (
        <button
          className="gold wide"
          onClick={() =>
            setMsg(
              actions.applyWith((s) => {
                const x = claimErrand(s, a.id);
                return { state: x.state, out: x.text };
              }) ?? '',
            )
          }
        >
          {ERRANDS[a.errand!.kind].icon} {a.errand!.kind} 보상 받기
        </button>
      ) : busy ? (
        <p className="small center">
          {ERRANDS[a.errand!.kind].icon} {a.errand!.kind} 중 · {timeLeft(a.errand!.endMs - state.worldMs)} 남음
        </p>
      ) : (
        <>
          <small className="muted">📤 임무 맡기기(그동안 전투에 못 나가요)</small>
          <div className="pw-acts c3">
            {(Object.keys(ERRANDS) as ErrandKind[]).map((k) => {
              const rw = errandReward(state, { ...a, errand: { kind: k, endMs: 0 } });
              return (
                <button key={k} className="pw-act small-act" disabled={!!canErrand(state, a.id)} onClick={() => (actions.apply((s) => sendAide(s, a.id, k)), setMsg(`${ERRANDS[k].icon} ${a.name}이(가) ${k}에 나갔어요.`))}>
                  <span className="pw-act-ico">{ERRANDS[k].icon}</span>
                  <span className="li-main">
                    <b>{k}</b>
                    <small>
                      {ERRANDS[k].hours}시간 · {rw.intel ? `정보+${rw.intel}` : rw.salary ? `💵+${rw.salary}` : `🎖️+${rw.merit}`}
                    </small>
                  </span>
                </button>
              );
            })}
          </div>
        </>
      )}
      {canPromote && (
        <button className="wide" onClick={() => (actions.apply((s) => promoteAide(s, a.id)), setMsg(`⭐ ${a.name}이(가) 장군이 되었어요.`))}>
          ⭐ 장군으로 승격
        </button>
      )}
    </>
  );
}
