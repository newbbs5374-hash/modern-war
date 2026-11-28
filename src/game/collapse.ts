// 11-28 대장 결정 "중-8 강대국 붕괴·새 세력": 후반(3장부터)에 크게 진 강대국은 내전으로 흔들리고, 작은 나라들은 새 연합을 만듦.
//  · 강대국(군사 70 이상)이 본토 도시 절반 넘게 잃으면 7일 내전: 병력 −40% · 국고 −70% · 도시 방어도 −30 · 남의 땅에서 차지한 도시는 모두 원래 나라로 돌아감
//  · 내전 동안은 국고가 바닥이라 쳐들어오지 못함
//  · 강대국이 무너지거나 4장이 되면 작은 나라들이 '신흥 연합' 진영을 만듦(camps.ts)
import { FRONT } from '../data/cities';
import { COUNTRIES, countryById } from '../data/world';
import { CAPTURED_DEFENSE } from './balance';
import { formRise } from './camps';
import { pushReport } from './report';
import type { GameState } from './state';
import { noteCapture } from './territory';
import { isAlive, isLosing } from './world';

const H = 3600e3;
const DAY = 24 * H;
export const COLLAPSE_ACT = 3;
export const COLLAPSE_MIL = 70;
export const CIVIL_WAR_MS = 7 * DAY;

export interface CollapseState { list: Record<string, { untilMs: number }>; done: string[] }
export const collapseOf = (s: GameState): CollapseState => s.collapse ?? { list: {}, done: [] };
export const inCivilWar = (s: GameState, id: string) => (collapseOf(s).list[id]?.untilMs ?? 0) > s.worldMs;

export function collapseTick(s: GameState): GameState {
  if (s.ending || (s.world.act ?? COLLAPSE_ACT) < COLLAPSE_ACT) return s;
  const me = s.player.countryId;
  const c0 = collapseOf(s);
  let ns = s;
  let c: CollapseState = { list: { ...c0.list }, done: [...c0.done] };
  let changed = !s.collapse;
  // 내전 중인 나라: 국고를 바닥에 묶음(쳐들어오지 못함) · 끝나면 알림
  for (const [id, x] of Object.entries(c0.list)) {
    if (x.untilMs > s.worldMs) {
      if (ns.nations[id] && ns.nations[id].treasury > 0) ns = { ...ns, nations: { ...ns.nations, [id]: { ...ns.nations[id], treasury: 0 } } };
      continue;
    }
    delete c.list[id];
    changed = true;
    ns = pushReport(ns, { icon: '🕊️', text: `${countryById(id).name}의 내전이 끝났어요. 다시 힘을 모으기 시작합니다.` });
  }
  for (const k of COUNTRIES) {
    const id = k.id;
    if (id === me || k.military < COLLAPSE_MIL || c.done.includes(id) || !isAlive(ns.world, id) || !isLosing(ns.world, id)) continue;
    // 내전 시작
    c.done.push(id);
    c.list[id] = { untilMs: s.worldMs + CIVIL_WAR_MS };
    changed = true;
    const n = ns.nations[id];
    const owner = { ...ns.world.owner };
    const defense = { ...ns.world.defense };
    const w = { ...ns.world, owner, defense };
    let freed = 0;
    for (const city of FRONT) {
      if (owner[city.id] !== id) continue;
      if (city.home !== id) {
        noteCapture(w, city.id, city.home);
        owner[city.id] = city.home;
        defense[city.id] = CAPTURED_DEFENSE;
        freed++;
      } else defense[city.id] = Math.max(1, (defense[city.id] ?? 0) - 30);
    }
    const text = `💥 강대국 ${k.name}이(가) 잇단 패배 끝에 내전에 빠졌어요! 7일 동안 병력 −40% · 국고 −70% · 도시 방어도 −30${freed ? ` · 점령했던 도시 ${freed}곳이 원래 나라로 돌아갔어요` : ''}.`;
    ns = {
      ...ns,
      world: { ...w, events: [{ t: s.worldMs, kind: '멸망' as const, text, mine: false }, ...w.events].slice(0, 200) },
      nations: { ...ns.nations, [id]: { ...n, troops: Math.round(n.troops * 0.6), treasury: Math.round(n.treasury * 0.3) } },
    };
    ns = pushReport(ns, { icon: '💥', text });
    ns = formRise(ns, `${k.name}이(가) 무너지자`);
  }
  if ((ns.world.act ?? 0) >= 4 && ns.camps && !ns.camps.rise) ns = formRise(ns, '마지막 장이 열리자');
  return changed ? { ...ns, collapse: c } : ns;
}
