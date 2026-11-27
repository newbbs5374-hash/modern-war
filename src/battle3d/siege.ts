// 3막 공성전 흐름: 막마다 전장을 바꾸고, 살아남은 부대(다친 그대로)를 다음 막으로 넘긴다.
import {
  BUDGET, DEF, ST, autoDeploy, createSim, nearestTile, setupDeploy, startBattle, step, useStage,
  type DeployOpt, type Kind, type Pick3, type Sim, type Stage,
} from './sim';
import { ACTS, URBAN_FILL } from './stages';

/** 2·3막에 새로 보낼 수 있는 보충 예산 */
export const REINF_BUDGET = 240;
/** 막 하나 결과 */
export interface ActResult { win: boolean; timeout: boolean; t: number; lost: number; total: number; carried?: number; dead?: Record<string, number> }
/** 다음 막으로 넘어가는 것: 땅·하늘 부대(남은 체력 비율), 살아남은 배 수(함포 지원 → 지휘력) */
export interface Carry { units: Array<{ kind: Kind; hp: number }>; naval: number }

/** 이 막에서 살아남아 다음 막으로 가는 부대 */
export function carryFrom(S: Sim, prevNaval = 0): Carry {
  const alive = S.units.filter((u) => u.side === 'us' && u.alive && !u.d.missile && u.kind !== 'cvjet');
  return {
    units: alive.filter((u) => u.d.dom === 'land' || u.d.dom === 'air').map((u) => ({ kind: u.kind, hp: Math.round(u.hp / u.max * 100) / 100 })),
    // 시가지 막에는 배가 못 들어가니, 앞 막에서 살아남은 배가 그대로 남아 도움
    naval: ST.urban ? prevNaval : alive.filter((u) => u.d.dom === 'sea' || u.d.dom === 'sub').length,
  };
}
/** 배가 살아 있으면 막 시작 지휘력 +1씩(최대 +4) */
export const navalCp = (c: Carry) => 3 + Math.min(4, c.naval);

/** 넘어온 부대를 앞줄부터 칸에 놓음(땅 부대 먼저 앞, 하늘은 뒤) */
export function placeCarried(c: Carry): Pick3[] {
  const out: Pick3[] = [];
  const land = c.units.filter((u) => DEF[u.kind].dom === 'land').sort((a, b) => DEF[b.kind].hp - DEF[a.kind].hp);
  const air = c.units.filter((u) => DEF[u.kind].dom === 'air');
  [...land, ...air].forEach((u, i) => {
    const front = DEF[u.kind].dom === 'land' && u.kind !== 'spg';
    const x = -7 + (i * 3.1) % 16, z = front ? 9.8 : 12.6;
    const t = nearestTile(out, u.kind, x, z);
    if (t >= 0) out.push({ kind: u.kind, tile: t, hp: u.hp, carried: true });
  });
  return out;
}
/** 보충 예산 안에서 기본 보충을 더함 */
export function fillReinf(mine: Pick3[], budget = REINF_BUDGET): Pick3[] {
  const out = mine.slice();
  let spent = 0;
  for (const [kind, x, z] of URBAN_FILL) {
    if (spent + DEF[kind].cost > budget) continue;
    const t = nearestTile(out, kind, x, z); if (t < 0) continue;
    out.push({ kind, tile: t }); spent += DEF[kind].cost;
  }
  return out;
}
export function spentOf(mine: Pick3[]) { return mine.reduce((s, d) => s + (d.carried ? 0 : DEF[d.kind].cost), 0); }
export const budgetOf = (act: number, st?: Stage) => (act === 0 ? st?.budget ?? BUDGET : REINF_BUDGET);

/** 막 하나를 화면 없이 돌림 */
export function runAct(stage: Stage, mine: Pick3[], cp0 = 3, foeHp = 1, maxSteps = 6000, buffs: Pick<DeployOpt, 'usBuff' | 'foeBuff'> = {}): Sim {
  useStage(stage);
  const S = createSim();
  setupDeploy(S, mine, { cp0, foeHp, ...buffs });
  startBattle(S);
  for (let i = 0; i < maxSteps && S.phase === 'battle'; i++) step(S);
  return S;
}

export function actResult(S: Sim): ActResult {
  const mine = S.units.filter((u) => u.side === 'us' && !u.d.missile && u.kind !== 'cvjet');
  const r = S.result ?? { win: false, timeout: true, t: S.simT };
  return { ...r, lost: mine.filter((u) => !u.alive).length, total: mine.length, carried: mine.filter((u) => u.carried).length };
}

/** 세 막 결과 → 임무 결과(별·글) */
export function siegeOutcome(results: ActResult[], acts: Stage[] = ACTS): { win: boolean; stars: number; text: string; dead: Record<string, number> } {
  const dead: Record<string, number> = {};
  for (const r of results) for (const [k, v] of Object.entries(r.dead ?? {})) dead[k] = (dead[k] ?? 0) + v;
  const win = results.length === 3 && results.every((r) => r.win);
  // 넘어온 부대는 한 번만 셈
  const total = results.reduce((s, r) => s + r.total - (r.carried ?? 0), 0) || 1, lost = results.reduce((s, r) => s + r.lost, 0);
  const t = results.reduce((s, r) => s + r.t, 0);
  const loss = lost / total;
  const stars = win ? (loss <= 0.3 ? 3 : loss <= 0.55 ? 2 : 1) : 0;
  const m = Math.floor(t / 60), s = Math.floor(t % 60);
  const failAt = results.findIndex((r) => !r.win);
  const head = win ? '외곽·시가전·도심을 모두 뚫고 도시를 차지했어요.'
    : failAt >= 0 ? `${actName(acts, failAt)}에서 밀려났어요.` : '공성전을 그만뒀어요.';
  return { win, stars, text: `${head} 걸린 시간 ${m}분 ${s}초 · 아군 손실 ${lost}/${total}`, dead };
}

/** 막 이름(앞에 '1막 ·' 붙임) */
export const actName = (acts: Stage[], i: number) => (/^\d막/.test(acts[i]?.name ?? '') ? acts[i].name : `${i + 1}막 · ${acts[i]?.name ?? ''}`);
/** 맡기기: 세 막을 기본 배치로 끝까지 */
export function runSiegeHeadless(foeHp = 1, budget = REINF_BUDGET, acts: Stage[] = ACTS, buffs: Pick<DeployOpt, 'usBuff' | 'foeBuff'> = {}): { results: ActResult[]; outcome: ReturnType<typeof siegeOutcome> } {
  const results: ActResult[] = [];
  let carry: Carry | null = null;
  for (let a = 0; a < acts.length; a++) {
    useStage(acts[a]);
    const mine = a === 0 ? autoDeploy() : fillReinf(placeCarried(carry!), budget);
    const S = runAct(acts[a], mine, a === 0 ? 3 : navalCp(carry!), foeHp, undefined, buffs);
    const r = actResult(S); results.push(r);
    if (!r.win) break;
    carry = carryFrom(S, carry?.naval ?? 0);
  }
  useStage(ACTS[0]);
  return { results, outcome: siegeOutcome(results, acts) };
}
