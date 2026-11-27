// 11/28 디자인 개편 3단계: 국정 허브. 37칸 나무 한 장 → 부처 5칸 + 상태 카드 + 장관 추천 줄 + 기능 칸(상태 한 줄) + 진행 중.
// 37개 기능은 하나도 빼지 않는다(가지마다 6~8칸). 옛 나무는 "🌳 전체 나무"로 그대로 볼 수 있다.
import { useState, type ReactNode } from 'react';
import type { GameState } from '../game/state';
import type { AdviceField } from '../game/advice';
import { advisorOf } from '../game/advice';
import { cabinetOf, ministerOf } from '../game/cabinet';
import { presOf } from '../game/approval';
import { citiesOf, relationOf, isAlive } from '../game/world';
import { COUNTRIES } from '../data/world';
import { deployOf, deployMax } from '../game/deploy';
import { contractMax } from '../game/economy';
import { cultureOf, culturePerHour, starsOf, tourismPerHour } from '../game/culture';
import { GROUPS, groupSat } from '../game/groups';
import { busyProjects, projectById } from '../game/projects';
import { spyOf } from '../game/spy';
import { RESOURCES } from '../data/economy';
import { sceneArt } from './scenes';
import { PersonFace } from './CabinetUI';
import { UiIcon, fmtKM } from './uiIcon';
import { Badge, isNewMark } from './kit';
import { TabArt } from './tabArt';
import { RecommendSheet, recLine } from './RecommendSheet';
import { timeLeft } from './officerScreens';
import type { Branch } from './TreeScreen';
import type { Screen } from './nav';

const BR_ART: Record<string, string> = { defense: '국방', diplo: '외교', society: '사회', economy: '경제', culture: '문화' };
const BR_SCENE: Record<string, string> = { defense: 'airbase', diplo: 'summit', society: 'assembly', economy: 'port', culture: 'ceremony' };
const MIN_OF: Record<string, Parameters<typeof ministerOf>[1]> = { defense: 'mnd', diplo: 'mofa', society: 'mois', economy: 'mof', culture: 'mcst' };

type Mood = { text: string; tone: 'ok' | 'warn' | 'bad' };
/** 부처 상태 카드: 숫자 3개 + 좋음/주의/위험 */
function branchStat(s: GameState, id: string): { nums: Array<[string, string, string?]>; mood: Mood } {
  const me = s.player.countryId;
  const n = s.nations[me];
  const pres = presOf(s);
  const rels = COUNTRIES.filter((c) => c.id !== me && isAlive(s.world, c.id)).map((c) => relationOf(s.world, me, c.id));
  const wars = rels.filter((r) => r === '전쟁').length;
  if (id === 'defense') {
    const units = Object.values(s.economy.army).reduce((a, k) => a + k, 0);
    return { nums: [['국방비', fmtKM(n.def ?? 0)], ['병력', fmtKM(n.troops)], ['부대', String(units)]], mood: wars ? { text: '전쟁 중', tone: 'bad' } : units < 5 ? { text: '주의', tone: 'warn' } : { text: '좋음', tone: 'ok' } };
  }
  if (id === 'diplo') {
    const allies = rels.filter((r) => r === '연합').length;
    const dep = deployOf(s).list.filter((x) => !x.returnMs).length;
    return { nums: [['연합', String(allies)], ['전쟁', String(wars), wars ? 'bad' : undefined], ['파병', `${dep}/${deployMax(s)}`]], mood: wars ? { text: '위험', tone: 'bad' } : allies >= 3 ? { text: '좋음', tone: 'ok' } : { text: '보통', tone: 'warn' } };
  }
  if (id === 'society') {
    const low = Math.min(...GROUPS.map((g) => groupSat(s, g.id)));
    const ap = Math.round(pres.approval);
    return { nums: [['지지도', String(ap), ap < 35 ? 'bad' : ap >= 60 ? 'ok' : undefined], ['도시', String(citiesOf(s.world, me).length)], ['불만 단체', String(GROUPS.filter((g) => groupSat(s, g.id) <= 35).length)]], mood: ap < 30 || low <= 20 ? { text: '위험', tone: 'bad' } : ap < 50 ? { text: '주의', tone: 'warn' } : { text: '좋음', tone: 'ok' } };
  }
  if (id === 'economy') {
    const c = s.economy.contracts ?? [];
    const short = RESOURCES.filter((r) => (s.economy.stock[r] ?? 0) < 5).length;
    return { nums: [['나라 예산', fmtKM(n.treasury)], ['무역', `${c.length}/${contractMax(s)}`], ['부족 자원', String(short), short > 8 ? 'bad' : undefined]], mood: n.treasury < 500 ? { text: '위험', tone: 'bad' } : short > 8 ? { text: '주의', tone: 'warn' } : { text: '좋음', tone: 'ok' } };
  }
  const cu = cultureOf(s);
  return { nums: [['문화/시', String(Math.round(culturePerHour(s)))], ['관광/시', String(Math.round(tourismPerHour(s)))], ['스타', String(starsOf(cu).length)]], mood: culturePerHour(s) > 5 ? { text: '좋음', tone: 'ok' } : { text: '보통', tone: 'warn' } };
}

/** 기능 칸 아래 상태 한 줄(없으면 배지·설명) */
function leafLine(s: GameState, b: string, id: string): { text: string; tone?: 'up' | 'dn' | 'am' } | null {
  const me = s.player.countryId;
  if (b === 'defense' && id === 'ops') return s.officer.active ? (s.worldMs >= s.officer.active.endMs ? { text: '임무 도착', tone: 'am' } : { text: '임무 중' }) : { text: '새 임무', tone: 'am' };
  if (b === 'defense' && id === 'forces') return { text: `${Object.values(s.economy.army).reduce((a, k) => a + k, 0)}개 부대` };
  if (b === 'defense' && id === 'spy') return { text: spyOf(s).active.length ? `공작 ${spyOf(s).active.length}` : '공작 없음' };
  if (b === 'diplo' && id === 'agree') return { text: `연합 ${COUNTRIES.filter((c) => c.id !== me && relationOf(s.world, me, c.id) === '연합').length}` };
  if (b === 'diplo' && id === 'deploy') return { text: `${deployOf(s).list.filter((x) => !x.returnMs).length}/${deployMax(s)}곳` };
  if (b === 'society' && id === 'city') return { text: `도시 ${citiesOf(s.world, me).length}` };
  if (b === 'society' && id === 'opinion') {
    const low = Math.round(Math.min(...GROUPS.map((g) => groupSat(s, g.id))));
    return { text: `최저 ${low}`, tone: low <= 25 ? 'dn' : undefined };
  }
  if (b === 'economy' && id === 'vault') return { text: fmtKM(s.nations[me].treasury) };
  if (b === 'economy' && id === 'res') {
    const short = RESOURCES.filter((r) => (s.economy.stock[r] ?? 0) < 5).length;
    return short ? { text: `부족 ${short}`, tone: 'dn' } : { text: '넉넉함', tone: 'up' };
  }
  if (b === 'economy' && id === 'trade') return { text: `계약 ${(s.economy.contracts ?? []).length}/${contractMax(s)}` };
  if (b === 'economy' && id === 'proj') return { text: busyProjects(s).length ? `진행 ${busyProjects(s).length}` : '쉬는 중' };
  if (b === 'culture' && id === 'stars') return { text: `스타 ${starsOf(cultureOf(s)).length}` };
  return null;
}

/** 진행 중(공사·사업·임무) */
function busyList(s: GameState): Array<{ key: string; icon: ReactNode; name: string; endMs: number; total: number; screen: Screen; tab: string; branch: string }> {
  const out: Array<{ key: string; icon: ReactNode; name: string; endMs: number; total: number; screen: Screen; tab: string; branch: string }> = [];
  const ch = s.economy.chore;
  if (ch) out.push({ key: 'chore', icon: <TabArt k="economy/facall" e="🏗️" cls="hub-busy-ico" />, name: ch.title, endMs: ch.endMs, total: 6 * 3600_000, screen: 'economy', tab: 'facall', branch: 'economy' });
  for (const [id, p] of busyProjects(s)) if (p.endMs) out.push({ key: `proj-${id}`, icon: <TabArt k="economy/proj" e="🚄" cls="hub-busy-ico" />, name: `${projectById(id).name} ${p.stage + 1}단계`, endMs: p.endMs, total: 24 * 3600_000, screen: 'economy', tab: 'proj', branch: 'economy' });
  const a = s.officer.active;
  if (a) out.push({ key: 'mission', icon: <TabArt k="defense/ops" e="🗺️" cls="hub-busy-ico" />, name: a.title, endMs: a.endMs, total: 2 * 3600_000, screen: 'defense', tab: 'ops', branch: 'defense' });
  return out;
}

export function GovHub({
  state,
  branches,
  isTodo,
  favs,
  pin,
  onLeaf,
  go,
  apply,
}: {
  state: GameState;
  branches: Branch[];
  isTodo: (screen: string, l: { id: string; badge?: number | string | null }) => boolean;
  favs: string[];
  pin: boolean;
  onLeaf: (key: string, b: string, leaf: string) => void;
  go: (s: Screen) => void;
  apply?: (f: (s: GameState) => GameState) => void;
}) {
  const [sel, setSelRaw] = useState<string>(() => {
    try {
      return sessionStorage.getItem('hub-branch') || 'economy';
    } catch {
      return 'economy';
    }
  });
  const setSel = (v: string) => {
    setSelRaw(v);
    try {
      sessionStorage.setItem('hub-branch', v);
    } catch {
      /* 무시 */
    }
  };
  const [rec, setRec] = useState(false);
  const b = branches.find((x) => x.id === sel) ?? branches[0];
  const st = branchStat(state, b.id);
  const field = (b.id === 'culture' ? 'culture' : b.id) as AdviceField | 'culture';
  const adv = field === 'culture' ? null : advisorOf(state, field);
  const minister = adv?.p ?? ministerOf(cabinetOf(state), MIN_OF[b.id]);
  const scene = sceneArt(BR_SCENE[b.id], false);
  const rl = recLine(state, field);
  const busy = busyList(state).filter((x) => x.branch === b.id || b.id === 'economy');
  return (
    <div className="hub">
      <div className="hub-branches" role="tablist">
        {branches.map((x) => {
          const hot = x.leaves.filter((l) => isTodo(x.id, l)).length;
          return (
            <button key={x.id} role="tab" className={x.id === b.id ? 'on' : ''} onClick={() => setSel(x.id)}>
              <UiIcon label={BR_ART[x.id]} emoji={x.icon} />
              <small>{x.name}</small>
              {hot > 0 && <i className="badge">{hot}</i>}
            </button>
          );
        })}
      </div>

      <button className="hub-hero" onClick={() => go(b.id)} style={scene ? { backgroundImage: `url(${scene})` } : undefined}>
        <span className="hub-hero-fade" />
        <span className="hub-hero-main">
          <small>{adv ? `${adv.where} ${adv.p.name}` : minister ? `장관 ${minister.name}` : `${b.name} 장관 자리가 비었어요`}</small>
          <b className="gx-title">
            {b.name} 상태 <em className={`mood-${st.mood.tone}`}>{st.mood.text}</em>
          </b>
          <span className="hub-nums">
            {st.nums.map(([k, v, t]) => (
              <span key={k}>
                <small>{k}</small>
                <b className={t ? `n-${t}` : ''}>{v}</b>
              </span>
            ))}
          </span>
        </span>
        <span className="hub-hero-face">{minister ? <PersonFace p={minister} size={96} /> : <span className="hub-noface">?</span>}</span>
      </button>

      <button className={`hub-rec ${rl.n ? 'hot' : ''}`} onClick={() => setRec(true)}>
        <span className="hub-rec-ico">💡</span>
        <span className="hub-rec-text">
          <b>장관 추천{rl.n ? ` ${rl.n}건` : ''}</b> · {rl.text}
        </span>
        <span className="btn-go hub-rec-go">보기</span>
      </button>

      <div className="hub-grid">
        {b.leaves.map((l) => {
          const key = `${b.id}/${l.id}`;
          const line = leafLine(state, b.id, l.id);
          const todo = isTodo(b.id, l);
          return (
            <button key={l.id} className={`hub-leaf ${l.locked ? 'locked' : ''} ${todo ? 'hot' : ''} ${favs.includes(key) ? 'fav' : ''}`} onClick={() => onLeaf(key, b.id, l.id)}>
              {favs.includes(key) && <i className="tree-star">⭐</i>}
              {l.badge && !l.locked ? <Badge v={l.badge} /> : null}
              <span className="hub-leaf-ico">{l.locked ? '🔒' : <TabArt k={key} e={l.icon} cls="hub-art" />}</span>
              <b>{l.label}</b>
              <small className={line?.tone ? `t-${line.tone}` : todo ? 't-am' : ''}>{line ? line.text : todo ? (isNewMark(l.badge) ? '할 일 있음' : `할 일 ${l.badge}`) : ' '}</small>
            </button>
          );
        })}
      </div>

      {busy.length > 0 && (
        <div className="hub-busy glass">
          <p className="hub-sub">진행 중</p>
          {busy.slice(0, 3).map((x) => {
            const left = x.endMs - state.worldMs;
            const pct = left <= 0 ? 100 : Math.max(4, Math.min(100, 100 - (left / x.total) * 100));
            return (
              <button key={x.key} className="hub-busy-row" onClick={() => onLeaf(`${x.screen}/${x.tab}`, x.screen, x.tab)}>
                {x.icon}
                <span>
                  <span className="hub-busy-top">
                    <b>{x.name}</b>
                    <em>{left <= 0 ? '끝남' : timeLeft(left)}</em>
                  </span>
                  <i className="hub-bar">
                    <i style={{ width: `${pct}%` }} />
                  </i>
                </span>
              </button>
            );
          })}
        </div>
      )}
      {pin && <p className="tree-legend">본부에 꽂을 칸을 눌러 고르세요. 다시 누르면 빠져요.</p>}
      {rec && apply && <RecommendSheet state={state} field={field} apply={apply} onGo={(tab) => onLeaf(`${b.id}/${tab}`, b.id, tab)} onClose={() => setRec(false)} />}
    </div>
  );
}
