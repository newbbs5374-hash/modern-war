// 11-27 화면 개편 1·3: 국정 나무 + 오늘 할 일.
// 지도자에서 가지 5개(국방·외교·내정·경제·문화)가 뻗고 가지마다 기능이 달린다.
// 빨간 점 = 할 일, 자물쇠 = 아직 잠김. 칸을 누르면 그 화면의 그 탭으로 간다.
// 탭 목록은 각 화면의 것(defenseTabs 등)을 그대로 써서 배지가 늘 같다.
import { useState, type ReactNode } from 'react';
import type { GameState } from '../game/state';
import { actInfo } from '../game/acts';
import { counterOf } from '../game/counter';
import { raidOf } from '../game/missileWar';
import { wcById, wcOf } from '../game/worldCrisis';
import { secOf } from '../game/security';
import { crisisById, crisisOf } from '../game/crisis';
import { goalsReady } from '../game/goals';
import { cityById } from '../data/cities';
import { playerKeys } from '../data/looks';
import { titleOf } from '../game/title';
import { cultureTabs } from './CultureScreen';
import { diploTabs } from './DiplomacyScreen';
import { defenseTabs, economyTabs, personalTabs, societyTabs } from './MainScreens';
import { Badge, Modal, type TabDef } from './kit';
import { GovHub } from './GovHub';
import { recommendActs, runDay } from '../game/dayPlan';
import { SLOTS, actById, doAct, scheduleOf } from '../game/schedule';
import { routeTo, type Screen } from './nav';
import { Face } from './Portrait';
import { FAV_MAX, favsOf, matches, toggleFav } from './favs';
import { BriefingModal } from './BriefingUI';
import { OrdersModal } from './OrdersModal';
import type { ScreenProps } from './screens';
import { morningBrief, runRec } from '../game/recs';

export interface Leaf { id: string; label: string; icon: ReactNode; badge?: number | string | null; locked?: boolean; screen: Screen }
export interface Branch { id: Screen; name: string; icon: string; leaves: Leaf[] }

const asProps = (state: GameState) => ({ state }) as unknown as ScreenProps;
const leaves = (screen: Screen, tabs: Array<TabDef<string>>): Leaf[] => tabs.map((t) => ({ id: t.id, label: t.label, icon: t.icon, badge: t.badge, locked: t.locked, screen }));

/** 가지 5개와 달린 기능 */
export function branchesOf(state: GameState): Branch[] {
  const p = asProps(state);
  return [
    { id: 'defense', name: '국방', icon: '🛡️', leaves: leaves('defense', defenseTabs(p)) },
    { id: 'diplo', name: '외교', icon: '🌐', leaves: leaves('diplo', diploTabs(p)) },
    { id: 'society', name: '내정', icon: '🏛️', leaves: leaves('society', societyTabs(p)) },
    { id: 'economy', name: '경제', icon: '💰', leaves: leaves('economy', economyTabs(p)) },
    { id: 'culture', name: '문화', icon: '🎭', leaves: leaves('culture', cultureTabs(p)) },
  ];
}

/** 숫자 배지인데 '할 일'로 치는 탭(나머지 숫자는 그냥 개수) */
const NUM_TODO = new Set(['personal/aides', 'personal/meet', 'personal/agenda', 'personal/plan', 'personal/win', 'society/press']);
const isTodo = (screen: string, l: { id: string; badge?: number | string | null }) => {
  const b = l.badge;
  if (b == null || b === '' || b === 0 || b === '●') return false;
  if (typeof b === 'number' || /^\d+$/.test(String(b))) return NUM_TODO.has(`${screen}/${l.id}`);
  return true;
};

export interface Todo { key: string; icon: ReactNode; text: string; sub: string; screen: Screen; tab?: string }
/** 오늘 할 일: 위기·반격·임무 + 탭마다 빨간 점이 뜬 곳을 한 줄로 */
export function todosOf(state: GameState): Todo[] {
  const out: Todo[] = [];
  const cr = crisisOf(state).open;
  if (cr) out.push({ key: 'crisis', icon: crisisById(cr.def).icon, text: crisisById(cr.def).title, sub: '본부에서 결정', screen: 'home' });
  { const wo = wcOf(state).open; if (wo && !wo.side) out.push({ key: 'wcrisis', icon: wcById(wo.def).icon, text: `세계 위기 · ${wcById(wo.def).title}`, sub: '본부에서 편 정하기', screen: 'home' }); }
  for (const c of secOf(state).list) out.push({ key: `sec-${c.id}`, icon: '🕵️', text: `저항 조직 · ${cityById(c.city).name}`, sub: '본부에서 소탕·회유', screen: 'home' });
  for (const r of raidOf(state).list) out.push({ key: `raid-${r.id}`, icon: '🚀', text: `미사일 경보 · ${cityById(r.city).name}`, sub: '본부에서 막기', screen: 'home' });
  for (const c of counterOf(state).list) out.push({ key: `counter-${c.id}`, icon: '🚨', text: `반격 경보 · ${cityById(c.city).name}`, sub: '본부에서 막기', screen: 'home' });
  for (const b of branchesOf(state)) for (const l of b.leaves) if (isTodo(b.id, l)) out.push({ key: `${b.id}/${l.id}`, icon: l.icon, text: `${b.name} · ${l.label}`, sub: '할 일이 있어요', screen: b.id, tab: l.id });
  for (const l of personalTabs(asProps(state))) if (isTodo('personal', l)) out.push({ key: `personal/${l.id}`, icon: l.icon, text: `사람 · ${l.label}`, sub: '할 일이 있어요', screen: 'personal', tab: l.id });
  const g = goalsReady(state);
  if (g > 0) out.push({ key: 'shop', icon: '🎁', text: `받을 보상 ${g}개`, sub: '상점에서 받기', screen: 'shop' });
  return out;
}
export interface Spot { key: string; label: string; group: string; icon: ReactNode; badge?: number | string | null; locked?: boolean; screen: Screen; tab?: string }
/** 찾기·즐겨찾기에 쓰는 모든 칸(가지 5개 + 사람 + 그 밖) */
export function spotsOf(state: GameState): Spot[] {
  const out: Spot[] = [];
  for (const b of branchesOf(state)) for (const l of b.leaves) out.push({ key: `${b.id}/${l.id}`, label: l.label, group: b.name, icon: l.icon, badge: l.badge, locked: l.locked, screen: b.id, tab: l.id });
  for (const l of personalTabs(asProps(state))) out.push({ key: `personal/${l.id}`, label: l.label, group: '사람', icon: l.icon, badge: l.badge, locked: l.locked, screen: 'personal', tab: l.id });
  for (const e of EXTRAS) out.push({ key: e.screen, label: e.label, group: '그 밖', icon: e.icon, screen: e.screen });
  return out;
}
/** 본부에서 옮겨 온 칸 */
const EXTRAS: Array<{ screen: Screen; label: string; icon: string }> = [
  { screen: 'herald', label: '전령', icon: '📯' },
  { screen: 'report', label: '보고', icon: '📨' },
  { screen: 'codex', label: '도감', icon: '📖' },
  { screen: 'shop', label: '상점', icon: '🛒' },
  { screen: 'settings', label: '설정·시험', icon: '⚙️' },
];
export const goSpot = (sp: Spot) => (sp.tab ? routeTo(sp.screen, sp.screen, sp.tab) : sp.screen);

export const todoCount = (state: GameState) => todosOf(state).length;

export function TodoList({ state, go, max }: { state: GameState; go: (s: Screen) => void; max?: number }) {
  const list = todosOf(state);
  if (!list.length) return <p className="empty">지금은 급한 일이 없어요. 👍</p>;
  return (
    <div className="todo-list">
      {(max ? list.slice(0, max) : list).map((t) => (
        <button key={t.key} className="todo-row" onClick={() => go(t.tab ? routeTo(t.screen, t.screen, t.tab) : t.screen)}>
          <span className="todo-ico">{t.icon}</span>
          <b>{t.text}</b>
          <small>{t.sub} ▸</small>
        </button>
      ))}
      {max && list.length > max ? <small className="muted">그 밖에 {list.length - max}건</small> : null}
    </div>
  );
}

type Apply = ScreenProps['actions']['apply'];
/** 11-27 대통령의 하루: 오늘 일정 3칸 + 부관 추천 카드. 한 번에 보내거나 한 장씩 고름 */
export function DayPlan({ state, apply, go }: { state: GameState; apply?: Apply; go: (s: Screen) => void }) {
  const [msg, setMsg] = useState('');
  const sc = scheduleOf(state);
  const rec = recommendActs(state);
  let k = 0;
  return (
    <div className="dayplan">
      <div className="dayplan-head">
        <b>☀️ 대통령의 하루</b>
        <button className="mini" onClick={() => go(routeTo('personal', 'personal', 'plan'))}>
          직접 고르기 ▸
        </button>
      </div>
      <div className="dayplan-slots">
        {SLOTS.map((name, i) => {
          const done = sc.slots[i];
          const card = done ? null : rec[k++];
          const a = done ? actById(done) : card ? actById(card.id) : null;
          return (
            <button key={name} className={done ? 'done' : ''} disabled={!!done || !card || !apply} onClick={() => card && apply?.((s) => doAct(s, card.id).state)}>
              <small>{name}</small>
              <span>{a ? a.icon : '·'}</span>
              <b>{a ? a.name : '빈 칸'}</b>
              <small className="muted">{done ? '마침 ✅' : card ? card.why : ''}</small>
            </button>
          );
        })}
      </div>
      {rec.length > 0 && apply && (
        <button
          className="gold wide"
          onClick={() => {
            const r = runDay(state);
            apply(() => r.state);
            setMsg(r.text);
          }}
        >
          ☀️ 추천대로 하루 보내기({rec.length}칸)
        </button>
      )}
      {msg && <p className="small sch-msg dayplan-msg">{msg}</p>}
    </div>
  );
}
export const dayFree = (state: GameState) => scheduleOf(state).slots.filter((x) => !x).length;

/** 본부 '주요 임무' 칸: 오늘 할 일 한 줄(누르면 목록) */
export function TodoCard({ state, go, apply }: { state: GameState; go: (s: Screen) => void; apply?: Apply }) {
  const [open, setOpen] = useState(false);
  const n = todoCount(state);
  if (!n && !dayFree(state) && !open) return null;
  return (
    <>
      <button className="hq todo-hq" onClick={() => setOpen(true)}>
        <span>📋</span>
        <span className="hq-main">
          <b>오늘 할 일 {n}건</b>
          <small>{dayFree(state) ? `☀️ 오늘 일정 ${dayFree(state)}칸이 비었어요` : '누르면 한곳에서 볼 수 있어요'}</small>
        </span>
      </button>
      {open && (
        <Modal title={`오늘 할 일 ${n}건`} icon="📋" onClose={() => setOpen(false)}>
          <DayPlan state={state} apply={apply} go={(s) => (setOpen(false), go(s))} />
          <TodoList state={state} go={(s) => (setOpen(false), go(s))} />
        </Modal>
      )}
    </>
  );
}

export function TreeScreen({ state, go, actions }: ScreenProps) {
  const [todoOpen, setTodoOpen] = useState(false);
  const [q, setQ] = useState('');
  const [favs, setFavs] = useState(favsOf);
  const [pin, setPin] = useState(false);
  const [pop, setPop] = useState<'orders' | 'brief' | 'desk' | null>(null);
  const desk = pop === 'desk' ? morningBrief(state, 5) : [];
  const spots = spotsOf(state);
  const found = q.trim() ? spots.filter((sp) => matches(`${sp.group}${sp.label}`, q.trim())) : [];
  const tap = (key: string, to: Screen) => (pin ? setFavs((f) => toggleFav(f, key)) : go(to));
  const branches = branchesOf(state);
  const n = todoCount(state);
  const act = state.world.act != null ? actInfo(state) : null;
  // 11/28 디자인 개편: 기본은 국정 허브(부처 5칸), 🌳 전체 나무로 옛 나무 보기
  const [view, setViewRaw] = useState<'hub' | 'tree'>(() => {
    try {
      return sessionStorage.getItem('gov-view') === 'tree' ? 'tree' : 'hub';
    } catch {
      return 'hub';
    }
  });
  const setView = (v: 'hub' | 'tree') => {
    setViewRaw(v);
    try {
      sessionStorage.setItem('gov-view', v);
    } catch {
      /* 무시 */
    }
  };
  return (
    <div className={`tree ${view === 'hub' ? 'is-hub' : ''}`}>
      <div className="tree-top">
        {act && (
          <span className="tree-chip">
            {act.icon} {act.n}장 {act.name}
          </span>
        )}
        <button className={`tree-chip ${n ? 'hot' : ''}`} onClick={() => setTodoOpen(true)}>
          📋 할 일 {n}
        </button>
        <button className="tree-chip" onClick={() => setPop('desk')}>
          🗂️ 장관 결재
        </button>
        <button className={`tree-chip ${view === 'tree' ? 'on' : ''}`} onClick={() => setView(view === 'hub' ? 'tree' : 'hub')}>
          {view === 'hub' ? '🌳 전체 나무' : '🏛️ 부처별 보기'}
        </button>
      </div>
      <div className="tree-find">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="🔍 기능 찾기 (예: 연구, 무역, 부관)" aria-label="기능 찾기" />
        {q && (
          <button className="mini" onClick={() => setQ('')} aria-label="지우기">
            ✕
          </button>
        )}
        <button className={`mini ${pin ? 'on' : ''}`} onClick={() => setPin(!pin)}>
          {pin ? '✅ 다 골랐어요' : `⭐ 즐겨찾기 ${favs.length}/${FAV_MAX}`}
        </button>
      </div>
      {pin && <p className="tree-legend">본부에 꽂을 칸을 눌러 고르세요({FAV_MAX}개까지). 다시 누르면 빠져요.</p>}
      {q.trim() && (
        <div className="todo-list tree-found">
          {found.length ? (
            found.slice(0, 12).map((sp) => (
              <button key={sp.key} className="todo-row" onClick={() => tap(sp.key, goSpot(sp))}>
                <span className="todo-ico">{sp.locked ? '🔒' : sp.icon}</span>
                <b>
                  {favs.includes(sp.key) ? '⭐ ' : ''}
                  {sp.label}
                </b>
                <small>{sp.group} ▸</small>
              </button>
            ))
          ) : (
            <p className="empty">「{q.trim()}」에 맞는 기능이 없어요.</p>
          )}
        </div>
      )}
      {view === 'hub' ? (
        <GovHub state={state} branches={branches} isTodo={isTodo} favs={favs} pin={pin} onLeaf={(key, br, leaf) => tap(key, routeTo(br, br, leaf))} go={go} apply={actions?.apply} />
      ) : (
        <>
          <button className="tree-root" onClick={() => go('personal')}>
            <span className="tree-face">
              <Face keys={playerKeys(state.player)} fallback="👤" />
            </span>
            <b>{state.player.name}</b>
            <small>{titleOf(state).name}</small>
          </button>
          <svg className="tree-lines" viewBox="0 0 500 60" preserveAspectRatio="none" aria-hidden>
            {[50, 150, 250, 350, 450].map((x) => (
              <path key={x} d={`M250 0 C250 34 ${x} 22 ${x} 60`} />
            ))}
          </svg>
          <div className="tree-cols">
            {branches.map((b) => {
              const hot = b.leaves.filter((l) => isTodo(b.id, l)).length;
              return (
                <div key={b.id} className="tree-col">
                  <button className="tree-branch" onClick={() => go(b.id)}>
                    <span>{b.icon}</span>
                    <b>{b.name}</b>
                    {hot > 0 && <i className="badge">{hot}</i>}
                  </button>
                  {b.leaves.map((l) => (
                    <button key={l.id} className={`tree-leaf ${l.locked ? 'locked' : ''} ${isTodo(b.id, l) ? 'hot' : ''}`} onClick={() => tap(`${b.id}/${l.id}`, routeTo(b.id, b.id, l.id))}>
                      {favs.includes(`${b.id}/${l.id}`) && <i className="tree-star">⭐</i>}
                      <span className="tree-ico">{l.locked ? '🔒' : l.icon}</span>
                      <small>{l.label}</small>
                      {l.badge ? <Badge v={l.badge} /> : null}
                    </button>
                  ))}
                </div>
              );
            })}
          </div>
        </>
      )}
      <div className="tree-more">
        <b>그 밖</b>
        {EXTRAS.map((e) => (
          <button key={e.screen} className={`tree-leaf ${favs.includes(e.screen) ? 'fav' : ''}`} onClick={() => tap(e.screen, e.screen)}>
            {favs.includes(e.screen) && <i className="tree-star">⭐</i>}
            <span className="tree-ico">{e.icon}</span>
            <small>{e.label}</small>
          </button>
        ))}
        <button className="tree-leaf" onClick={() => setPop('orders')}>
          <span className="tree-ico">📋</span>
          <small>명령</small>
        </button>
        <button className="tree-leaf" onClick={() => setPop('brief')}>
          <span className="tree-ico">📰</span>
          <small>국정 보고</small>
        </button>
      </div>
      {pop === 'desk' && (
        <Modal title="오늘의 장관 결재" icon="🗂️" onClose={() => setPop(null)}>
          <p className="small muted" style={{ margin: '0 0 6px' }}>
            각 분야 장관이 지금 가장 이득인 일을 골라 올렸어요. 숫자는 장관 정확도만큼 틀릴 수 있어요.
          </p>
          {desk.length ? (
            <div className="mrec-box">
              {desk.map((r, i) => (
                <div key={r.id} className="mrec-card">
                  <span className="mrec-ic">{r.icon}</span>
                  <span className="mrec-txt">
                    <b>
                      {i + 1}. {r.title}
                    </b>
                    <small>
                      {r.who} · {r.why}
                    </small>
                  </span>
                  <span className="mrec-act">
                    <b className={r.gain(r.k).startsWith('−') ? 'bad' : 'good'}>{r.gain(r.k)}</b>
                    {r.act && actions ? (
                      <button onClick={() => actions.apply((s) => runRec(s, r.field, r.id))}>결재</button>
                    ) : (
                      <button onClick={() => (setPop(null), go(routeTo(r.field, r.field, r.tab)))}>보기 →</button>
                    )}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="empty">지금 올라온 결재가 없어요. 장관을 앉히면 더 많이 올라와요.</p>
          )}
        </Modal>
      )}
      {pop === 'orders' && actions && <OrdersModal state={state} apply={actions.apply} onClose={() => setPop(null)} />}
      {pop === 'brief' && <BriefingModal state={state} onClose={() => setPop(null)} goTab={(sc, key, tab) => (setPop(null), go(routeTo(sc, key, tab)))} />}
      <p className="tree-legend">칸을 누르면 그 화면으로 가요 · 빨간 숫자 = 급한 일 · 주황 점 = 새 소식 · 🔒 = 아직 잠김</p>
      {todoOpen && (
        <Modal title={`오늘 할 일 ${n}건`} icon="📋" onClose={() => setTodoOpen(false)}>
          <DayPlan state={state} apply={actions?.apply} go={(s) => (setTodoOpen(false), go(s))} />
          <TodoList state={state} go={(s) => (setTodoOpen(false), go(s))} />
        </Modal>
      )}
    </div>
  );
}
