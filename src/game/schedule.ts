// 대통령 일정(11-23 기획 ④): 하루(실제 24시간) 3칸(오전·오후·저녁)에 활동을 놓으면 바로 효과.
// 활동마다 분야 점수(12시간)·지지도·신뢰도·도시 민심·호감·정적·장관이 조금씩 움직여요.
import { COUNTRIES } from '../data/world';
import { CITIES } from '../data/cities';
import type { StatId } from '../data/officers';
import { addPresMod, type FieldId } from './approval';
import { civOf, addFavorNote, favorOf } from './civ';
import { note, withOfficer } from './officer';
import { roleOf, influenceOf } from './rivals';
import type { GameState } from './state';
import { isAlive, relationOf } from './world';

const H = 3600e3;
export const DAY_MS = 24 * H;
export const SLOTS = ['오전', '오후', '저녁'] as const;
const clamp = (v: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));

export type ActId = 'troops' | 'visit' | 'business' | 'call' | 'press' | 'cabinet' | 'assembly' | 'rest';
export interface Act {
  id: ActId;
  icon: string;
  name: string;
  text: string;
  /** 효과를 키우는 지도자 스탯 */
  stat: StatId;
  field: FieldId;
}
export const ACTS: Act[] = [
  { id: 'troops', icon: '🪖', name: '군부대 시찰', text: '안보 +6 · 장군 충성 +4', stat: '통솔', field: 'defense' },
  { id: 'visit', icon: '🏘️', name: '현장 방문', text: '민심 낮은 도시 +8 · 사회 +4', stat: '체력', field: 'society' },
  { id: 'business', icon: '💼', name: '경제인 간담회', text: '경제 +6 · 재벌 영향력 −5', stat: '군수', field: 'economy' },
  { id: 'call', icon: '☎️', name: '정상 통화', text: '호감 낮은 나라 +6 · 외교 +4', stat: '정치', field: 'diplo' },
  { id: 'press', icon: '🎤', name: '언론 인터뷰', text: '지지도 +4(12시간)', stat: '정치', field: 'personal' },
  { id: 'cabinet', icon: '🏛️', name: '국무회의', text: '장관 충성 +4 · 진행 중 부처 업무 1시간 당김', stat: '통솔', field: 'personal' },
  { id: 'assembly', icon: '🗳️', name: '국회 연설', text: '신뢰도 +3 · 야당 영향력 −5', stat: '정치', field: 'personal' },
  { id: 'rest', icon: '😴', name: '휴식', text: '훈련 피로 풀림 · 개인 평판 +3', stat: '체력', field: 'personal' },
];
export const actById = (id: ActId) => ACTS.find((a) => a.id === id)!;

export interface SchedMod {
  field: FieldId;
  v: number;
  untilMs: number;
  why: string;
}
export interface ScheduleState {
  /** 오늘 번호(worldMs / 24시간) */
  day: number;
  slots: Array<ActId | null>;
  mods: SchedMod[];
  /** 지금까지 소화한 일정 수 */
  total: number;
}

export const dayOf = (s: GameState) => Math.floor(s.worldMs / DAY_MS);
export function scheduleOf(s: GameState): ScheduleState {
  const sc = s.schedule;
  const day = dayOf(s);
  if (!sc) return { day, slots: [null, null, null], mods: [], total: 0 };
  return sc.day === day ? sc : { ...sc, day, slots: [null, null, null] };
}
/** 다음 날까지 남은 시간 */
export const nextDayIn = (s: GameState) => (dayOf(s) + 1) * DAY_MS - s.worldMs;

/** 지도자 스탯에 따른 효과 배율(스탯 10 → 1, 30 → 1.5) */
export function actMult(s: GameState, a: Act): number {
  const v = s.officer.stats[a.stat] ?? 8;
  return Math.max(0.8, Math.min(1.8, 0.75 + v / 40));
}
export function canAct(s: GameState, id: ActId): string | null {
  const sc = scheduleOf(s);
  if (sc.slots.every(Boolean)) return '오늘 일정이 다 찼어요';
  if (sc.slots.includes(id)) return '오늘 이미 했어요';
  return null;
}

/** 분야 점수 덤(국정 지표 계산에서 읽음) */
export function scheduleFieldRows(s: GameState, f: FieldId): Array<[string, number]> {
  const sc = s.schedule;
  if (!sc) return [];
  const v = sc.mods.filter((m) => m.field === f && m.untilMs > s.worldMs).reduce((a, m) => a + m.v, 0);
  return v ? [['📅 대통령 일정', v]] : [];
}

/** 일정 칸에 활동 놓기(바로 효과) */
export function doAct(s: GameState, id: ActId): { state: GameState; text: string } {
  if (canAct(s, id)) return { state: s, text: '' };
  const a = actById(id);
  const k = actMult(s, a);
  const sc = scheduleOf(s);
  const slot = sc.slots.indexOf(null);
  const slots = [...sc.slots];
  slots[slot] = id;
  const mods = sc.mods.filter((m) => m.untilMs > s.worldMs);
  const mod = (field: FieldId, v: number) => mods.push({ field, v: Math.round(v * 10) / 10, untilMs: s.worldMs + 12 * H, why: a.name });
  let ns: GameState = s;
  const me = s.player.countryId;
  let text = '';
  const r = (v: number) => Math.round(v);
  switch (id) {
    case 'troops':
      mod('defense', 6 * k);
      ns = withOfficer(ns, (o) => {
        for (const g of o.generals) g.loyalty = clamp(g.loyalty + 4);
      });
      text = `안보 +${r(6 * k)} · 장군 충성 +4`;
      break;
    case 'visit': {
      const civ = structuredClone(civOf(ns));
      const mine = CITIES.filter((c) => s.world.owner[c.id] === me && civ.cities[c.id]).sort((x, y) => civ.cities[x.id].loyalty - civ.cities[y.id].loyalty);
      const low = mine[0];
      if (low) civ.cities[low.id].loyalty = clamp(civ.cities[low.id].loyalty + 8 * k);
      ns = { ...ns, civ };
      mod('society', 4 * k);
      text = `${low ? `${low.name} 민심 +${r(8 * k)} · ` : ''}사회 +${r(4 * k)}`;
      break;
    }
    case 'business':
      mod('economy', 6 * k);
      ns = withOfficer(ns, (o) => {
        o.rivals.forEach((rv, i) => {
          if (roleOf(rv, i) === '재벌' && !rv.ally) rv.influence = clamp(influenceOf(rv) - 5);
        });
      });
      text = `경제 +${r(6 * k)} · 재벌 영향력 −5`;
      break;
    case 'call': {
      const list = COUNTRIES.filter((c) => c.id !== me && isAlive(s.world, c.id) && relationOf(s.world, me, c.id) !== '전쟁').sort((x, y) => favorOf(s, x.id) - favorOf(s, y.id));
      if (list[0]) ns = addFavorNote(ns, list[0].id, '☎️ 정상 통화', r(6 * k));
      mod('diplo', 4 * k);
      text = `${list[0] ? `${list[0].name} 호감 +${r(6 * k)} · ` : ''}외교 +${r(4 * k)}`;
      break;
    }
    case 'press':
      ns = addPresMod(ns, '🎤 언론 인터뷰', 4 * k, 12);
      text = `지지도 +${r(4 * k)}(12시간)`;
      break;
    case 'cabinet': {
      const c = ns.cabinet ? structuredClone(ns.cabinet) : null;
      if (c) {
        for (const p of c.people) if (p.seat || p.post) p.loyalty = clamp(p.loyalty + 4);
        for (const t of Object.values(c.tasks)) if (t) t.endMs = Math.max(s.worldMs, t.endMs - H);
        ns = { ...ns, cabinet: c };
      }
      text = '장관 충성 +4 · 부처 업무 1시간 당김';
      break;
    }
    case 'assembly':
      ns = withOfficer(ns, (o) => {
        o.trust = clamp(o.trust + 3 * k);
        o.rivals.forEach((rv, i) => {
          if (roleOf(rv, i) === '야당 대표' && !rv.ally) rv.influence = clamp(influenceOf(rv) - 5);
        });
      });
      text = `신뢰도 +${r(3 * k)} · 야당 영향력 −5`;
      break;
    case 'rest':
      ns = withOfficer(ns, (o) => {
        o.trainCounts = {};
      });
      mod('personal', 3);
      text = '훈련 피로가 풀렸어요 · 개인 평판 +3';
      break;
  }
  const out: GameState = { ...ns, schedule: { day: sc.day, slots, mods: mods.slice(-12), total: sc.total + 1 } };
  const ws: GameState = { ...out, world: { ...out.world, events: [...out.world.events] } };
  note(ws, `📅 ${SLOTS[slot]} 일정 · ${a.icon} ${a.name}: ${text}`);
  return { state: ws, text: `${a.icon} ${a.name}: ${text}` };
}
