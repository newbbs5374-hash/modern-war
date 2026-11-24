// 화면별 담당 부하 조언(11-24 대장 요청 3번: "부하들이 각 콘텐츠 안에서 조언").
// 담당자의 자리 적합도가 높을수록 진짜 급한 일을 짚고, 낮으면 엉뚱한 말을 섞음. 말투는 성향 따라.
// 조언을 따르면(그 탭으로 가면) 충성 +2(분야마다 실제 1시간에 한 번).
import { NEEDS } from '../data/needs';
import { ministryById, type MinistryId, type Trait } from '../data/cabinet';
import { postById, type PostId } from '../data/staff';
import { cabinetOf, fitPct, ministerOf, postHolder, type Person } from './cabinet';
import { Rng } from './rng';
import type { GameState } from './state';

export type AdviceField = 'defense' | 'diplo' | 'society' | 'economy';
export interface Tip {
  id: string;
  text: string;
  tab: string;
  /** 급한 정도(0 = 그냥 하는 말). 클수록 먼저 짚어야 맞는 조언 */
  weight: number;
}
export interface Advisor {
  p: Person;
  where: string;
  need: string;
  spec: readonly string[];
}

const H = 3600_000;
export const ADVICE_LOYAL = 2;
export const ADVICE_COOLDOWN = H;

/** 분야마다 조언하는 자리(앞에서부터 사람이 있는 첫 자리) */
const ADVISOR_SEATS: Record<AdviceField, Array<{ min: MinistryId } | { post: PostId }>> = {
  defense: [{ min: 'mnd' }, { post: 'nsa2' }, { post: 'nsa' }, { min: 'nis' }],
  diplo: [{ min: 'mofa' }, { post: 'nsa1' }, { min: 'mou' }, { post: 'nsa' }],
  society: [{ min: 'mois' }, { post: 'social' }, { post: 'polit' }, { post: 'chief' }],
  economy: [{ min: 'mof' }, { post: 'econ' }, { post: 'policy' }, { min: 'moti' }],
};

export function advisorOf(s: GameState, f: AdviceField): Advisor | null {
  const c = cabinetOf(s);
  for (const seat of ADVISOR_SEATS[f]) {
    if ('min' in seat) {
      const p = ministerOf(c, seat.min);
      if (p) return { p, where: `${ministryById(seat.min).short} 장관`, need: seat.min, spec: ministryById(seat.min).spec };
    } else {
      const p = postHolder(c, seat.post);
      if (p) return { p, where: postById(seat.post).name, need: seat.post, spec: postById(seat.post).spec };
    }
  }
  return null;
}

/** 조언 정확도 0.25~0.97(적합도 따라) */
export const adviceAccuracy = (a: Advisor) => Math.max(0.25, Math.min(0.97, 0.2 + fitPct(a.p, NEEDS[a.need], a.spec) / 110));

/** 성향 말투 */
export const TONE: Record<Trait, (t: string) => string> = {
  강경파: (t) => `밀어붙여야 합니다. ${t}`,
  신중파: (t) => `조심스럽지만, ${t}`,
  실용주의: (t) => `실리를 따지면 ${t}`,
  원칙주의: (t) => `원칙대로라면 ${t}`,
  인기인: (t) => `국민이 지켜봅니다! ${t}`,
  청렴: (t) => `정직하게 말씀드리면 ${t}`,
  야심: (t) => `기회입니다. ${t}`,
  충직: (t) => `대통령님, ${t}`,
  협상가: (t) => `한발 물러서 보면 ${t}`,
  혁신가: (t) => `새 방법이 있습니다. ${t}`,
  현장형: (t) => `현장에서 보니 ${t}`,
  냉철: (t) => `냉정히 보면 ${t}`,
};
export const tone = (tr: Trait, t: string) => (TONE[tr] ?? ((x: string) => x))(t);

/**
 * 조언 3개 고르기. 정확도만큼 진짜 급한 일(무게 순)을 짚고, 나머지는 그냥 하는 말로 채움.
 * 같은 시간(실제 1시간) 안에는 같은 답.
 */
export function pickAdvice(tips: Tip[], acc: number, seed: number, n = 3): Array<Tip & { right: boolean }> {
  const rng = new Rng(seed);
  const real = tips.filter((t) => t.weight > 0).sort((a, b) => b.weight - a.weight);
  const idle = tips.filter((t) => t.weight <= 0);
  const out: Array<Tip & { right: boolean }> = [];
  const used = new Set<string>();
  for (let i = 0; i < n; i++) {
    const r = real.find((t) => !used.has(t.id));
    const fill = idle.filter((t) => !used.has(t.id));
    const pickReal = r && (rng.next() < acc || !fill.length);
    const t = pickReal ? r! : fill.length ? fill[Math.floor(rng.next() * fill.length)] : null;
    if (!t) break;
    used.add(t.id);
    out.push({ ...t, right: t.weight > 0 });
  }
  return out;
}

export const adviceSeed = (s: GameState, f: AdviceField, pid: number) => Math.floor(s.worldMs / H) * 31 + pid * 7 + f.length * 1013;

export function canFollow(s: GameState, f: AdviceField): boolean {
  const at = cabinetOf(s).advice?.[f] ?? -Infinity;
  return s.worldMs - at >= ADVICE_COOLDOWN;
}

/** 조언을 따름: 맞는 조언이면 충성 +2, 엉뚱한 조언이어도 +1(들어 준 것만으로) */
export function followAdvice(s: GameState, f: AdviceField, pid: number, right: boolean): GameState {
  if (!canFollow(s, f)) return s;
  const c = cabinetOf(s);
  const gain = right ? ADVICE_LOYAL : 1;
  return {
    ...s,
    cabinet: {
      ...c,
      advice: { ...(c.advice ?? {}), [f]: s.worldMs },
      people: c.people.map((p) => (p.id === pid ? { ...p, loyalty: Math.min(100, p.loyalty + gain) } : p)),
    },
  };
}
