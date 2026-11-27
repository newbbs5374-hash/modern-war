// 11-28 장관 추천(국정 37 강화안 핵심, 대장 승인): 화면마다 담당 장관이 "무엇을 하면 얼마 이득"인지 숫자로 추천하고 바로 실행.
// 추천은 게임이 실제로 계산해서 고름. 장관 적합도가 높을수록 진짜 1등 안을 짚고 숫자 오차가 작음(낮으면 2~3등 안이 섞이고 숫자가 틀림).
// 장관이 없으면 비서실이 1개만(정확도 50%). 따른 추천은 성적표에 남음. 분야 맡기기(자동 운영)는 처음엔 꺼져 있음.
import { advisorOf, adviceAccuracy, adviceSeed, type AdviceField, type Advisor } from './advice';
import { Rng } from './rng';
import type { GameState } from './state';

export interface Rec {
  /** 같은 추천을 다시 찾는 이름(실행할 때 다시 계산해서 찾음) */
  id: string;
  field: AdviceField;
  /** 그 분야 안 작은 탭(눌러서 가 볼 곳) */
  tab: string;
  icon: string;
  title: string;
  /** 예상 이득 숫자(나라 예산으로 환산, 정렬용). 숫자 오차는 이 값에 붙음 */
  value: number;
  /** 화면에 보이는 이득 글: k = 장관 오차 배율(1 = 정확) */
  gain: (k: number) => string;
  /** 왜 이걸 추천하는지 한 줄 */
  why: string;
  /** 바로 실행(없으면 그 탭으로 가 보기만) */
  act?: (s: GameState) => GameState;
  /** 실행해도 되는지(이유 = 못 함) */
  can?: (s: GameState) => string | null;
}
export type RecGen = (s: GameState) => Rec[];

const GENS: Record<AdviceField, RecGen[]> = { defense: [], diplo: [], society: [], economy: [], culture: [] };
/** 분야별 추천 만들기 등록(무역·파병·작전 등 각 파일에서) */
export function registerRecs(field: AdviceField, gen: RecGen) {
  GENS[field].push(gen);
}
/** 그 분야 추천 전부(이득 큰 순) */
export function allRecs(s: GameState, field: AdviceField): Rec[] {
  const out: Rec[] = [];
  for (const g of GENS[field]) {
    try {
      out.push(...g(s));
    } catch {
      /* 추천 하나가 잘못돼도 화면은 그대로 */
    }
  }
  return out.filter((r) => r.value > 0 && (!r.can || !r.can(s))).sort((a, b) => b.value - a.value);
}

export interface Picked extends Rec {
  /** 진짜 상위 안인가(성적표) */
  right: boolean;
  /** 이 장관의 숫자 오차 배율 */
  k: number;
}
export interface RecView {
  advisor: Advisor | null;
  acc: number;
  list: Picked[];
}
export const NO_ADVISOR_ACC = 0.5;
/** 장관(없으면 비서실)이 고른 추천 n개. 같은 시간(실제 1시간) 안에는 같은 답 */
export function pickRecs(s: GameState, field: AdviceField, n = 3): RecView {
  const advisor = advisorOf(s, field);
  const acc = advisor ? adviceAccuracy(advisor) : NO_ADVISOR_ACC;
  const want = advisor ? n : 1;
  const all = allRecs(s, field);
  const rng = new Rng(adviceSeed(s, field, advisor?.p.id ?? 0) ^ 0x5eed);
  const top = new Set(all.slice(0, want).map((r) => r.id));
  const used = new Set<string>();
  const list: Picked[] = [];
  for (let i = 0; i < want && used.size < all.length; i++) {
    const left = all.filter((r) => !used.has(r.id));
    let r = left[0];
    // 정확도가 낮으면 1등 대신 그 아래 안을 고름
    if (left.length > 1 && rng.next() >= acc) r = left[1 + Math.floor(rng.next() * Math.min(3, left.length - 1))];
    used.add(r.id);
    const k = 1 + (rng.next() * 2 - 1) * (1 - acc) * 0.6;
    list.push({ ...r, right: top.has(r.id), k });
  }
  return { advisor, acc, list };
}

/** 장관 성적표: 사람 id → 따른 추천 수 · 맞힌 수 */
export interface RecLog {
  score: Record<number, { n: number; ok: number }>;
  /** 분야 맡기기(자동 운영) — 처음엔 모두 꺼짐 */
  auto: Partial<Record<AdviceField, boolean>>;
  /** 맡기기로 한 번에 쓸 수 있는 나라 예산 한도 */
  autoCap: number;
  /** 분야마다 마지막 자동 실행 시각 */
  autoMs: Partial<Record<AdviceField, number>>;
  /** 최근 자동 실행 기록 */
  log: string[];
}
export const AUTO_CAP = 20_000;
const H = 3600e3;
export const recLogOf = (s: GameState): RecLog => s.recLog ?? { score: {}, auto: {}, autoCap: AUTO_CAP, autoMs: {}, log: [] };

/** 추천 실행(다시 계산해서 같은 id를 찾음). 장관 성적표에 남김 */
export function runRec(s: GameState, field: AdviceField, id: string, auto = false): GameState {
  const v = pickRecs(s, field, 5);
  const r = v.list.find((x) => x.id === id) ?? allRecs(s, field).map((x) => ({ ...x, right: false, k: 1 })).find((x) => x.id === id);
  if (!r?.act || (r.can && r.can(s))) return s;
  let ns = r.act(s);
  if (ns === s) return s;
  const lg = recLogOf(ns);
  const pid = v.advisor?.p.id ?? 0;
  const sc = lg.score[pid] ?? { n: 0, ok: 0 };
  ns = {
    ...ns,
    recLog: {
      ...lg,
      score: { ...lg.score, [pid]: { n: sc.n + 1, ok: sc.ok + (r.right ? 1 : 0) } },
      ...(auto ? { log: [`${r.icon} ${r.title}`, ...lg.log].slice(0, 12) } : {}),
    },
  };
  return ns;
}
export function setAuto(s: GameState, field: AdviceField, on: boolean): GameState {
  const lg = recLogOf(s);
  return { ...s, recLog: { ...lg, auto: { ...lg.auto, [field]: on } } };
}
export function setAutoCap(s: GameState, cap: number): GameState {
  return { ...s, recLog: { ...recLogOf(s), autoCap: Math.max(0, cap) } };
}
/** 판단(15분)마다: 맡긴 분야는 1시간에 한 번 장관이 1순위 추천을 실행(돈이 한도 안일 때만) */
export function recTick(s: GameState): GameState {
  const lg = s.recLog;
  if (!lg || !Object.values(lg.auto).some(Boolean)) return s;
  let ns = s;
  for (const f of Object.keys(lg.auto) as AdviceField[]) {
    if (f === 'economy' || !lg.auto[f] || ns.worldMs - (recLogOf(ns).autoMs[f] ?? -Infinity) < H) continue;
    const me = ns.player.countryId;
    const r = pickRecs(ns, f, 3).list.find((x) => x.act);
    ns = { ...ns, recLog: { ...recLogOf(ns), autoMs: { ...recLogOf(ns).autoMs, [f]: ns.worldMs } } };
    if (!r) continue;
    const before = ns.nations[me].treasury;
    const after = runRec(ns, f, r.id, true);
    if (before - after.nations[me].treasury > recLogOf(ns).autoCap) continue; // 한도를 넘는 일은 하지 않음
    ns = after;
  }
  return ns;
}

/** 아침 국정 보고: 모든 분야에서 장관이 고른 추천 중 실행할 수 있는 것, 이득 큰 순 n건 */
export function morningBrief(s: GameState, n = 5): Array<Picked & { who: string }> {
  const out: Array<Picked & { who: string }> = [];
  for (const f of ['economy', 'defense', 'diplo', 'society', 'culture'] as AdviceField[]) {
    const v = pickRecs(s, f, 3);
    for (const r of v.list) out.push({ ...r, who: v.advisor ? v.advisor.where : '비서실' });
  }
  return out.sort((a, b) => (b.act ? 1 : 0) - (a.act ? 1 : 0) || b.value - a.value).slice(0, n);
}

/** 숫자 보기 좋게(예상치라 둥글게) */
export function approx(v: number): string {
  const a = Math.abs(v);
  const r = a >= 1e6 ? `${(a / 1e6).toFixed(1)}M` : a >= 1e4 ? `${(a / 1e4).toFixed(1)}만` : Math.round(a).toLocaleString('ko-KR');
  return `${v < 0 ? '−' : ''}${r}`;
}
