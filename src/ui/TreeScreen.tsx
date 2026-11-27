// 11-27 화면 개편 1·3: 국정 나무 + 오늘 할 일.
// 지도자에서 가지 5개(국방·외교·내정·경제·문화)가 뻗고 가지마다 기능이 달린다.
// 빨간 점 = 할 일, 자물쇠 = 아직 잠김. 칸을 누르면 그 화면의 그 탭으로 간다.
// 탭 목록은 각 화면의 것(defenseTabs 등)을 그대로 써서 배지가 늘 같다.
import { useState, type ReactNode } from 'react';
import type { GameState } from '../game/state';
import { actInfo } from '../game/acts';
import { counterOf } from '../game/counter';
import { raidOf } from '../game/missileWar';
import { crisisById, crisisOf } from '../game/crisis';
import { goalsReady } from '../game/goals';
import { cityById } from '../data/cities';
import { playerKeys } from '../data/looks';
import { titleOf } from '../game/title';
import { cultureTabs } from './CultureScreen';
import { diploTabs } from './DiplomacyScreen';
import { defenseTabs, economyTabs, personalTabs, societyTabs } from './MainScreens';
import { Modal, type TabDef } from './kit';
import { recommendActs, runDay } from '../game/dayPlan';
import { SLOTS, actById, doAct, scheduleOf } from '../game/schedule';
import { routeTo, type Screen } from './nav';
import { Face } from './Portrait';
import type { ScreenProps } from './screens';

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
  for (const r of raidOf(state).list) out.push({ key: `raid-${r.id}`, icon: '🚀', text: `미사일 경보 · ${cityById(r.city).name}`, sub: '본부에서 막기', screen: 'home' });
  for (const c of counterOf(state).list) out.push({ key: `counter-${c.id}`, icon: '🚨', text: `반격 경보 · ${cityById(c.city).name}`, sub: '본부에서 막기', screen: 'home' });
  for (const b of branchesOf(state)) for (const l of b.leaves) if (isTodo(b.id, l)) out.push({ key: `${b.id}/${l.id}`, icon: l.icon, text: `${b.name} · ${l.label}`, sub: '할 일이 있어요', screen: b.id, tab: l.id });
  for (const l of personalTabs(asProps(state))) if (isTodo('personal', l)) out.push({ key: `personal/${l.id}`, icon: l.icon, text: `사람 · ${l.label}`, sub: '할 일이 있어요', screen: 'personal', tab: l.id });
  const g = goalsReady(state);
  if (g > 0) out.push({ key: 'shop', icon: '🎁', text: `받을 보상 ${g}개`, sub: '상점에서 받기', screen: 'shop' });
  return out;
}
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
  const branches = branchesOf(state);
  const n = todoCount(state);
  const act = state.world.act != null ? actInfo(state) : null;
  return (
    <div className="tree">
      <div className="tree-top">
        {act && (
          <span className="tree-chip">
            {act.icon} {act.n}장 {act.name}
          </span>
        )}
        <button className={`tree-chip ${n ? 'hot' : ''}`} onClick={() => setTodoOpen(true)}>
          📋 할 일 {n}
        </button>
      </div>
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
                <button key={l.id} className={`tree-leaf ${l.locked ? 'locked' : ''} ${isTodo(b.id, l) ? 'hot' : ''}`} onClick={() => go(routeTo(b.id, b.id, l.id))}>
                  <span className="tree-ico">{l.locked ? '🔒' : l.icon}</span>
                  <small>{l.label}</small>
                  {l.badge ? <i className="badge">{l.badge}</i> : null}
                </button>
              ))}
            </div>
          );
        })}
      </div>
      <p className="tree-legend">칸을 누르면 그 화면으로 가요 · 빨간 점 = 할 일 · 🔒 = 아직 잠김 · 맨 위 얼굴 = 사람(인사·인맥)</p>
      {todoOpen && (
        <Modal title={`오늘 할 일 ${n}건`} icon="📋" onClose={() => setTodoOpen(false)}>
          <DayPlan state={state} apply={actions?.apply} go={(s) => (setTodoOpen(false), go(s))} />
          <TodoList state={state} go={(s) => (setTodoOpen(false), go(s))} />
        </Modal>
      )}
    </div>
  );
}
