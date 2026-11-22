// 사격 훈련(② 옆보기 실시간): 사격장. 표적이 지나갈 때 누르기, 민간인 표적은 감점, 연속 명중 콤보.
import { Rng } from '../game/rng';

export const RANGE_W = 360;
export const RANGE_H = 240;
export const LANES = [60, 120, 180];

export interface Target {
  id: number;
  lane: number;
  t0: number;
  speed: number; // px/초(음수면 왼쪽으로)
  civ: boolean;
  hit: boolean;
}

export interface RangeGame {
  t: number;
  duration: number;
  targets: Target[];
  score: number;
  combo: number;
  best: number;
  hits: number;
  misses: number;
  civHits: number;
  radius: number;
  seed: number;
  goal: number;
  result: { win: boolean; stars: number; text: string } | null;
}

export interface RangeSetup {
  rank: number;
  stats: Record<string, number>;
  seed: number;
}

export function createRange(o: RangeSetup): RangeGame {
  const rng = new Rng(o.seed >>> 0);
  const cap = 20 + o.rank * 10;
  const rel = Math.min(1, (o.stats['사격'] ?? 8) / cap);
  const targets: Target[] = [];
  const duration = 30_000;
  let t = 600;
  let id = 1;
  while (t < duration - 1500) {
    const lane = Math.floor(rng.next() * 3);
    const dir = rng.chance(0.5) ? 1 : -1;
    targets.push({ id: id++, lane, t0: t, speed: dir * rng.range(70, 120 + o.rank * 8), civ: rng.chance(0.2), hit: false });
    t += rng.range(500, 1000) - Math.min(300, o.rank * 30);
  }
  const enemies = targets.filter((x) => !x.civ).length;
  return {
    t: 0,
    duration,
    targets,
    score: 0,
    combo: 0,
    best: 0,
    hits: 0,
    misses: 0,
    civHits: 0,
    radius: 16 + rel * 8,
    seed: rng.seed,
    goal: Math.round(enemies * 10 * 0.55),
    result: null,
  };
}

export function targetPos(g: RangeGame, x: Target, t = g.t): { x: number; y: number; on: boolean } {
  const dt = (t - x.t0) / 1000;
  const px = x.speed > 0 ? -20 + x.speed * dt : RANGE_W + 20 + x.speed * dt;
  return { x: px, y: LANES[x.lane], on: dt >= 0 && px > -20 && px < RANGE_W + 20 };
}

/** (x,y)를 쏨 */
export function shoot(g0: RangeGame, x: number, y: number): RangeGame {
  if (g0.result) return g0;
  const g = { ...g0, targets: g0.targets.map((t) => ({ ...t })) };
  const hitT = g.targets.find((t) => {
    if (t.hit) return false;
    const p = targetPos(g, t);
    return p.on && Math.hypot(p.x - x, p.y - y) <= g.radius;
  });
  if (!hitT) {
    g.misses++;
    g.combo = 0;
    return g;
  }
  hitT.hit = true;
  if (hitT.civ) {
    g.civHits++;
    g.score = Math.max(0, g.score - 30);
    g.combo = 0;
  } else {
    g.hits++;
    g.combo++;
    g.best = Math.max(g.best, g.combo);
    g.score += 10 + Math.min(10, (g.combo - 1) * 2);
  }
  return g;
}

function end(g: RangeGame) {
  if (g.t < g.duration || g.result) return;
  const win = g.score >= g.goal;
  const stars = !win ? 0 : g.score >= g.goal * 1.6 && g.civHits === 0 ? 3 : g.score >= g.goal * 1.25 ? 2 : 1;
  g.result = { win, stars, text: `점수 ${g.score}(기준 ${g.goal}) · 명중 ${g.hits} · 최고 콤보 ${g.best}${g.civHits ? ` · 민간인 ${g.civHits}` : ''}` };
}

export function stepRange(g0: RangeGame, ms: number, auto: boolean, aim: number): RangeGame {
  if (g0.result) return g0;
  let g = { ...g0 };
  const step = 50;
  for (let i = 0; i < Math.floor(ms / step) && !g.result; i++) {
    g.t += step;
    if (auto && g.t % 100 === 0) {
      // 자동: 가운데를 지나는 적 표적을 실력만큼 맞힘
      const rng = new Rng(g.seed);
      for (const t of g.targets) {
        if (t.hit || t.civ) continue;
        const p = targetPos(g, t);
        if (p.on && Math.abs(p.x - RANGE_W / 2) < 12) {
          g = rng.chance(aim) ? shoot(g, p.x, p.y) : { ...shoot(g, p.x, p.y + 99) };
          break;
        }
      }
      g.seed = rng.seed;
    }
    end(g);
  }
  return g;
}

export function finishRange(g0: RangeGame, aim: number): RangeGame {
  let g = g0;
  for (let i = 0; i < 200 && !g.result; i++) g = stepRange(g, 500, true, aim);
  return g;
}
