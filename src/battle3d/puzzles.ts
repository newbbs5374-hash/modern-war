// 배치 퍼즐 30판(11-26 안 2): "예산 N으로 이 적을 이겨라". 3D 전투는 같은 배치면 늘 같은 결과라 퍼즐이 된다.
// 판마다 적 배치·쓸 수 있는 병과·예산이 다름. 예산·기준(par)은 scripts에서 미리 풀어 본 값(puzzles.json).
import {
  COAST, DEF, createSim, setupDeploy, startBattle, step, useStage, TILES, tileOk,
  type Kind, type Pick3, type Place, type Sim, type Stage,
} from './sim';
import PAR from './puzzles.json';

export interface Puzzle {
  n: number;
  title: string;
  hint: string;
  enemy: Place[];
  hqHp: number;
  kinds: Kind[];
  /** 쓸 수 있는 예산 */
  budget: number;
  /** ★2: 이 예산 이하로 이기기 · ★3: 거기에 이 시간(초) 안에 */
  parCost: number;
  parT: number;
}

const LAND: Kind[] = ['inf', 'sf', 'ifv', 'tank', 'spg', 'aa', 'hack'];
const AIR: Kind[] = ['drone', 'heli', 'jet', 'bomber', 'missile'];
const SEA: Kind[] = ['dd', 'sub', 'lha', 'laser'];

/** 판 이름·생각할 거리 */
const THEMES: Array<{ title: string; hint: string; foe: Kind[]; kinds: Kind[] }> = [
  { title: '보병 진지', hint: '모여 있는 보병은 범위 공격(포병·폭격기)에 약해요.', foe: ['inf', 'inf', 'inf', 'sf'], kinds: ['inf', 'tank', 'spg', 'ifv'] },
  { title: '전차 벽', hint: '전차는 단단해요. 멀리서 치는 포병이나 하늘에서 치는 헬기를 생각해 봐요.', foe: ['tank', 'tank', 'ifv'], kinds: ['inf', 'tank', 'spg', 'heli', 'hack'] },
  { title: '방공 진지', hint: '방공부대는 하늘에는 무섭지만 땅 부대에는 약해요.', foe: ['aa', 'aa', 'inf'], kinds: ['tank', 'ifv', 'heli', 'jet', 'drone'] },
  { title: '포병 기지', hint: '포병은 가까이 붙으면 못 쏴요(최소 사거리).', foe: ['spg', 'spg', 'inf'], kinds: ['ifv', 'sf', 'tank', 'drone', 'inf'] },
  { title: '하늘 우산', hint: '적 헬기·드론에는 방공부대가 답이에요.', foe: ['heli', 'drone', 'drone', 'inf'], kinds: ['aa', 'tank', 'inf', 'ifv'] },
  { title: '해안 포대', hint: '바다에서 함포로 해안을 칠 수 있어요.', foe: ['spg', 'tank', 'inf'], kinds: ['dd', 'lha', 'tank', 'inf', 'sub'] },
];

function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

/** n번째 판의 적·병과(예산·기준 빼고) */
export function makePuzzle(n: number): Omit<Puzzle, 'budget' | 'parCost' | 'parT'> {
  const r = rng(n * 977 + 13);
  const th = THEMES[(n - 1) % THEMES.length];
  const tier = Math.floor((n - 1) / 10); // 0: 쉬움 1: 보통 2: 어려움
  const enemy: Place[] = [['hq', 3 + r() * 3, -10 + r() * 1.5]];
  const count = th.foe.length + tier + Math.floor((n - 1) % 10 / 4);
  for (let i = 0; i < count; i++) {
    const k = th.foe[i % th.foe.length];
    const x = 1 + r() * 8, z = -8.5 + r() * 6.5;
    enemy.push([k, x, z]);
  }
  if (tier >= 1) enemy.push([r() < .5 ? 'aa' : 'tank', 2 + r() * 6, -9 + r() * 2]);
  if (tier >= 2) enemy.push([r() < .5 ? 'spg' : 'ifv', 2 + r() * 6, -11 + r() * 2]);
  const extra = tier >= 1 ? [...LAND, ...AIR].filter((k) => !th.kinds.includes(k) && r() < .25).slice(0, 2) : [];
  const kinds = [...th.kinds, ...extra].filter((k, i, a) => a.indexOf(k) === i && (th.title === '해안 포대' || !SEA.includes(k)));
  return { n, title: `${n}. ${th.title}${tier ? ` ${['', 'Ⅱ', 'Ⅲ'][tier]}` : ''}`, hint: th.hint, enemy, hqHp: 600 + n * 45, kinds };
}

export const PUZZLES: Puzzle[] = Array.from({ length: 30 }, (_, i) => {
  const p = makePuzzle(i + 1);
  const par = (PAR as Record<string, { budget: number; parCost: number; parT: number }>)[String(i + 1)] ?? { budget: 160, parCost: 140, parT: 90 };
  return { ...p, ...par };
});

export function puzzleStage(p: Puzzle): Stage {
  return {
    ...COAST, id: `drill-p${p.n}`, name: '배치 퍼즐', op: `PUZZLE-${String(p.n).padStart(2, '0')}`, goal: `목표: 예산 ${p.budget} 안에서 지휘소 파괴`,
    enemy: p.enemy, timeLimit: 120, drill: true, usGoal: { x: 4.5, z: -10 }, kinds: p.kinds, cmds: [],
    setup: (S) => { const h = S.units.find((u) => u.kind === 'hq'); if (h) { h.max = p.hqHp; h.hp = p.hqHp; } S.units.forEach((u) => { if (u.side === 'foe' && u.kind !== 'hq') u.goal = { x: u.x, z: u.z }; }); S.drillLimit = 120; },
    rule: (S) => (!S.units.find((u) => u.kind === 'hq')?.alive ? 'win' : !S.units.some((u) => u.alive && u.side === 'us' && !u.d.missile) && !S.pending.length ? 'lose' : S.simT >= 120 ? 'time' : null),
    cam: { tz: 0, dist: 30 },
  };
}

/** 판 결과 → 별 */
export function puzzleStars(p: Puzzle, S: Sim, spent: number): number {
  const hq = S.units.find((u) => u.kind === 'hq');
  if (hq?.alive || !S.result?.win) return 0;
  if (spent > p.parCost) return 1;
  return S.simT <= p.parT ? 3 : 2;
}
export const puzzleScore = (stars: number) => [0.2, 0.5, 0.75, 0.95][stars];
export const spentOf = (picks: Pick3[]) => picks.reduce((s, d) => s + DEF[d.kind].cost, 0);

/** 화면 없이 한 판(풀이 찾기·시험용) */
export function runPuzzle(p: Puzzle, picks: Pick3[]): Sim {
  useStage(puzzleStage(p));
  const S = createSim();
  setupDeploy(S, picks, {});
  startBattle(S);
  for (let i = 0; i < 2600 && S.phase === 'battle'; i++) step(S);
  useStage(COAST);
  return S;
}

/** 칸에 놓기(땅 칸 앞줄부터) */
export function placeKinds(p: Puzzle, kinds: Kind[]): Pick3[] {
  useStage(puzzleStage(p));
  const out: Pick3[] = [];
  for (const k of kinds) {
    const i = TILES.findIndex((t, j) => tileOk(t, k) && !out.some((d) => d.tile === j) && (DEF[k].dom !== 'land' || t.x > -1));
    if (i >= 0) out.push({ kind: k, tile: i });
  }
  useStage(COAST);
  return out;
}
