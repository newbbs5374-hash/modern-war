// 3D 훈련 모음(11-26 안 1·2·3·5·6): 훈련 창 목록 · 병과 숙련도 · 주간 합동 훈련.
// 화면 없는 계산만(three.js 없음) — 훈련 창·전투 결과·자동 계산이 같이 씀.
import { DRILLS, drillById, runDrill } from './drills';
import { PUZZLES } from './puzzles';
import { COAST, DEF, defaultDeploy, headlessOutcome, useStage, type Kind, type Sim, type Stage } from './sim';
import { runAct } from './siege';
import { miniOutcome } from '../battle/minigames';
import { CORE, STREET } from './stages';

/* ───────── 훈련 창 목록 ───────── */
export interface Three3D { id: string; name: string; how: string; tag: '3D 실전' | '사격장' | '배치 퍼즐' }

/** 이 훈련에서 할 수 있는 3D 훈련(실전 1 · 사격장 0~1 · 퍼즐은 전술·통솔) */
export function threeFor(training: string): Three3D[] {
  const out: Three3D[] = DRILLS.filter((d) => d.training === training).map((d) => ({ id: d.id, name: d.name, how: d.how, tag: d.id.startsWith('c3-') ? '사격장' : '3D 실전' }));
  if (training === '전술' || training === '통솔') out.push({ id: 'p3', name: `배치 퍼즐 ${PUZZLES.length}판`, how: '정해진 예산으로 적 진지를 부수는 부대 조합을 찾아요. 같은 배치면 늘 같은 결과라 생각하는 만큼 풀려요. 판마다 별 3개.', tag: '배치 퍼즐' });
  return out;
}

export function drillName(id: string): string {
  if (id === 'p3' || id.startsWith('p3:')) return '배치 퍼즐';
  if (id.startsWith('w3')) return '주간 합동 훈련';
  return drillById(id)?.name ?? '3D 훈련';
}

/* ───────── 안 6: 병과 숙련도 ───────── */
/** 숙련 경험(훈련에서 그 병과를 쓴 별 수) → 단계 0~5. 단계마다 본 3D 전투에서 +2%(최대 +10%) */
export const UNIT_LV_AT = [3, 8, 15, 25, 40];
export const unitLevel = (xp: number) => UNIT_LV_AT.filter((n) => xp >= n).length;
export const unitBonusPct = (xp: number) => unitLevel(xp) * 2;
/** 본 전투에 넘길 배수(숙련 없는 병과는 빠짐) */
export function unitBuffs(xp: Record<string, number> | undefined): Partial<Record<Kind, number>> {
  const out: Partial<Record<Kind, number>> = {};
  for (const [k, v] of Object.entries(xp ?? {})) { const lv = unitLevel(v); if (lv && k in DEF) out[k as Kind] = 1 + 0.02 * lv; }
  return out;
}
export const unitName = (k: string) => (k in DEF ? DEF[k as Kind].name : k);

/* ───────── 안 5: 주간 합동 훈련 ───────── */
const WEEK_MS = 7 * 24 * 3600 * 1000;
export const weekOf = (ms: number) => Math.floor(ms / WEEK_MS);
export const weekLeftMs = (ms: number) => WEEK_MS - (ms % WEEK_MS);
const WEEK_STAGES: Array<{ stage: Stage; name: string; text: string }> = [
  { stage: COAST, name: '해안 상륙 합동 훈련', text: '육·해·공 모두 나와 해안 진지를 뚫는 큰 연습이에요.' },
  { stage: STREET, name: '시가지 거점 합동 훈련', text: '건물 사이 거리에서 거점 4곳을 차지하는 연습이에요.' },
  { stage: CORE, name: '도심 지휘소 합동 훈련', text: '도심 광장 지휘소를 부수고 최후 저항까지 막는 연습이에요.' },
];
export function weeklyInfo(ms: number) { return weekInfo(weekOf(ms)); }
export function weekInfo(w: number) {
  return { week: w, ...WEEK_STAGES[w % WEEK_STAGES.length] };
}
/** 이번 주에 경험치를 몰아줄 훈련(열린 훈련 중 돌아가며) */
export function weeklyTraining(ms: number, open: string[]): string {
  return open.length ? open[(weekOf(ms) * 5) % open.length] : '전술';
}
/** 주간 합동 훈련 보상 배수 */
export const WEEKLY_MULT = 3;

/* ───────── 결과 ───────── */
export interface DrillInfo { kinds: string[]; puzzle?: { n: number; stars: number }; weekly?: number }
/** 이 판에 나간 우리 병과(숙련이 쌓임) */
export function usedKinds(S: Sim): string[] {
  return [...new Set(S.units.filter((u) => u.side === 'us' && !u.d.missile && u.kind !== 'cvjet' && u.kind !== 'hq').map((u) => u.kind))];
}

/** 자동·즉시완료·부관: 화면 없이 돌림(실전·사격장은 봇 지휘, 퍼즐은 보통 점수, 합동은 기본 배치) */
export function autoThree(id: string, seed: number): { win: boolean; stars: number; text: string; drill?: DrillInfo } {
  const d = drillById(id);
  if (d) {
    const { S, score } = runDrill(d, seed, { bot: true });
    return { ...miniOutcome(score, d.name), drill: { kinds: (d.kinds as string[] | undefined) ?? usedKinds(S) } };
  }
  if (id.startsWith('w3')) {
    const w = weekInfo(Number(id.split(':')[1] ?? 0));
    useStage(w.stage);
    const S = runAct(w.stage, defaultDeploy());
    useStage(COAST);
    const o = headlessOutcome(S);
    return { ...o, text: `${w.name} · ${o.text}`, drill: { kinds: usedKinds(S), weekly: w.week } };
  }
  return { ...miniOutcome(0.6, '배치 퍼즐(맡김)'), drill: { kinds: [] } };
}
